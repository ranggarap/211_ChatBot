const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

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

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = userInput.value.trim();
  if (!message) {
    return;
  }

  // Tampilkan pesan user
  addMessage(message, "user");
  messages.push({
    role: "user",
    content: message,
  });

  userInput.value = "";
  userInput.disabled = true;

  const button = chatForm.querySelector("button");
  const btnText = button.querySelector(".btn-text");
  button.disabled = true;
  if (btnText) btnText.textContent = "Menunggu...";

  // Buat bubble AI kosong untuk streaming response
  const botContent = addMessage("", "bot");
  let botResponse = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
      }),
    });

    if (!response.ok) {
      let errorData = { error: "Terjadi kesalahan" };

      try {
        errorData = await response.json();
      } catch (error) {
        try {
          const textError = await response.text();
          errorData = { error: textError || "Terjadi kesalahan" };
        } catch (readError) {
          console.error("Gagal membaca pesan error:", readError);
        }
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
        } catch (parseError) {
          // Keep the original message when it is not JSON.
        }
      }

      throw new Error(typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

        const data = trimmedLine.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const token = JSON.parse(data);
          botResponse += token;
          botContent.textContent = botResponse;
          chatBox.scrollTop = chatBox.scrollHeight;
        } catch (error) {
          console.error("Gagal membaca token:", error);
        }
      }
    }

    messages.push({
      role: "assistant",
      content: botResponse,
    });
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