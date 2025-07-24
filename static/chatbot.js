document.addEventListener("DOMContentLoaded", function () {
    const chatButton = document.createElement("div");
    chatButton.id = "chatbot-toggle";
    chatButton.innerHTML = "¿Preguntas?";
    document.body.appendChild(chatButton);

    const chatBox = document.createElement("div");
    chatBox.id = "chatbot-box";
    chatBox.innerHTML = `
        <div id="chatbot-header">Asistente SIG <span id="chatbot-close">×</span></div>
        <div id="chatbot-messages"></div>
        <input type="text" id="chatbot-input" placeholder="Escribí tu pregunta..." />
    `;
    document.body.appendChild(chatBox);

    document.getElementById("chatbot-toggle").addEventListener("click", () => {
        chatBox.classList.toggle("open");
    });

    document.getElementById("chatbot-close").addEventListener("click", () => {
        chatBox.classList.remove("open");
    });

    document.getElementById("chatbot-input").addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            const input = this.value;
            if (!input) return;
            appendMessage("user", input);
            this.value = "";

            fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input })
            })
            .then(res => res.json())
            .then(data => {
                appendMessage("bot", data.reply);
            })
            .catch(err => {
                appendMessage("bot", "Error al consultar el asistente.");
            });
        }
    });

    function appendMessage(sender, text) {
        const msg = document.createElement("div");
        msg.className = "chatbot-msg " + sender;
        msg.innerText = text;
        document.getElementById("chatbot-messages").appendChild(msg);
        document.getElementById("chatbot-messages").scrollTop = document.getElementById("chatbot-messages").scrollHeight;
    }
});
