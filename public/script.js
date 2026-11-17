const appShell = document.getElementById("app-shell");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const newChatButtons = [
  document.getElementById("new-chat-button"),
  document.getElementById("topbar-new-chat"),
];
const historyItem = document.getElementById("history-item");
const historyEmpty = document.getElementById("history-empty");

const messages = [];

function addMessage(text, sender) {
  const message = document.createElement("div");
  message.classList.add("message", sender);

  const content = document.createElement("div");
  content.classList.add("message-content");
  content.textContent = text;

  message.appendChild(content);
  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
  return content;
}

function closeSidebar() {
  appShell.classList.remove("sidebar-open");
}

function startNewChat() {
  messages.length = 0;
  chatBox.replaceChildren();
  userInput.value = "";
  appShell.classList.remove("chatting");
  historyItem.hidden = true;
  historyEmpty.hidden = false;
  closeSidebar();
  userInput.focus();
}

newChatButtons.forEach((button) => {
  button.addEventListener("click", startNewChat);
});

document
  .getElementById("mobile-menu-button")
  .addEventListener("click", () => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      appShell.classList.add("sidebar-open");
    } else {
      appShell.classList.remove("collapsed");
    }
  });

document
  .getElementById("sidebar-collapse")
  .addEventListener("click", () => appShell.classList.toggle("collapsed"));

document
  .getElementById("sidebar-backdrop")
  .addEventListener("click", closeSidebar);

document.getElementById("search-chat-button").addEventListener("click", () => {
  if (!historyItem.hidden) {
    historyItem.focus();
  }
});

document.getElementById("explore-button").addEventListener("click", () => {
  userInput.value = "Apa saja yang bisa kamu bantu?";
  userInput.focus();
  closeSidebar();
});

historyItem.addEventListener("click", () => {
  appShell.classList.add("chatting");
  closeSidebar();
  chatBox.scrollTop = chatBox.scrollHeight;
});

document.querySelectorAll(".suggestion").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    userInput.value = suggestion.dataset.prompt;
    userInput.focus();
  });
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    startNewChat();
  }

  if (event.key === "Escape") {
    closeSidebar();
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = userInput.value.trim();

  if (!message) {
    return;
  }

  const button = chatForm.querySelector('button[type="submit"]');
  const btnText = button.querySelector(".btn-text");
  const isFirstMessage = messages.length === 0;

  appShell.classList.add("chatting");
  addMessage(message, "user");
  messages.push({
    role: "user",
    content: message,
  });

  if (isFirstMessage) {
    historyItem.textContent =
      message.length > 32 ? `${message.slice(0, 32)}...` : message;
    historyItem.hidden = false;
    historyEmpty.hidden = true;
  }

  userInput.value = "";
  userInput.disabled = true;
  button.disabled = true;
  if (btnText) btnText.textContent = "Menunggu";

  const botContent = addMessage("", "bot");
  let botResponse = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      let errorData = { error: "Terjadi kesalahan" };

      try {
        errorData = await response.json();
      } catch (error) {
        console.error("Gagal membaca respons error:", error);
      }

      let errorMessage =
        errorData?.error?.message ||
        errorData?.message ||
        errorData?.error ||
        "Terjadi kesalahan";

      if (typeof errorMessage === "string") {
        try {
          const nestedError = JSON.parse(errorMessage);
          errorMessage =
            nestedError.error?.message ||
            nestedError.message ||
            errorMessage;
        } catch (error) {
          // Keep the original message when it is not JSON.
        }
      }

      throw new Error(
        typeof errorMessage === "string"
          ? errorMessage
          : JSON.stringify(errorMessage),
      );
    }

    if (!response.body) {
      throw new Error("Respons streaming tidak tersedia");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function readStreamLine(line) {
      const trimmedLine = line.trim();

      if (!trimmedLine.startsWith("data:")) {
        return;
      }

      const data = trimmedLine.slice(5).trim();

      if (!data || data === "[DONE]") {
        return;
      }

      try {
        const token = JSON.parse(data);
        botResponse += token;
        botContent.textContent = botResponse;
        chatBox.scrollTop = chatBox.scrollHeight;
      } catch (error) {
        console.error("Gagal membaca token:", error);
      }
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(readStreamLine);
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      readStreamLine(buffer);
    }

    if (botResponse) {
      messages.push({
        role: "assistant",
        content: botResponse,
      });
    }
  } catch (error) {
    console.error(error);
    botContent.textContent = "Maaf, terjadi kesalahan: " + error.message;
  } finally {
    userInput.disabled = false;
    button.disabled = false;
    if (btnText) btnText.textContent = "Kirim";
    userInput.focus();
  }
});
