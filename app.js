const userId =
    localStorage.getItem("404friend_user_id") ||
    crypto.randomUUID();

localStorage.setItem("404friend_user_id", userId);

let currentPlan =
    localStorage.getItem("404friend_plan") || "free";


// ============================================================
// ROUTING
// ============================================================

function showPage(page) {
    document.querySelectorAll(".page").forEach(section => {
        section.style.display = "none";
    });

    const selected = document.getElementById(page);

    if (selected) {
        selected.style.display = "block";
    }
}


function route() {
    const path = window.location.pathname;

    if (path === "/login") {
        showPage("login");
    } else if (path === "/pricing") {
        showPage("pricing");
    } else {
        showPage("home");
    }
}


// ============================================================
// LIMIT
// ============================================================

function updateLimit(used, limit) {
    const element = document.getElementById("usage");

    if (element) {
        element.textContent =
            `${used} / ${limit} сообщений`;
    }
}


async function loadUsage() {
    try {
        const response = await fetch(
            `/api/usage?user_id=${encodeURIComponent(userId)}&plan=${encodeURIComponent(currentPlan)}`
        );

        const data = await response.json();

        if (response.ok) {
            updateLimit(data.used, data.limit);
        }

    } catch (error) {
        console.error("Usage error:", error);
    }
}


// ============================================================
// ADD MESSAGE TO CHAT
// ============================================================

function addMessage(text, type) {

    const messages = document.getElementById("messages");

    if (!messages) {
        console.error("Element #messages not found.");
        return;
    }

    const message = document.createElement("div");

    message.classList.add(
        "message",
        type === "user"
            ? "user-message"
            : "ai-message"
    );

    message.textContent = text;

    messages.appendChild(message);

    messages.scrollTop =
        messages.scrollHeight;
}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage(message) {

    message = String(message || "").trim();

    if (!message) {
        return;
    }


    // Показываем сообщение пользователя

    addMessage(
        message,
        "user"
    );


    try {

        const response = await fetch(
            "/api/chat",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    message: message,
                    user_id: userId,
                    plan: currentPlan
                })
            }
        );


        const data =
            await response.json();


        // Ошибка API

        if (!response.ok) {

            console.error(
                "Chat API error:",
                data
            );


            if (
                data.used !== undefined
            ) {

                updateLimit(
                    data.used,
                    data.limit
                );

            }


            addMessage(
                data.error ||
                "Произошла ошибка 😭",
                "ai"
            );

            return;
        }


        // Обновляем лимит

        updateLimit(
            data.used,
            data.limit
        );


        // Ответ 404FRIEND

        if (data.reply) {

            addMessage(
                data.reply,
                "ai"
            );

        }


    } catch (error) {

        console.error(
            "Chat error:",
            error
        );


        addMessage(
            "Не удалось подключиться к серверу 😭",
            "ai"
        );
    }
}


// ============================================================
// CHAT FORM
// ============================================================

function setupChat() {

    const input =
        document.querySelector(
            "#message"
        ) ||
        document.querySelector(
            "#messageInput"
        ) ||
        document.querySelector(
            "textarea"
        ) ||
        document.querySelector(
            "input[type='text']"
        );


    const button =
        document.querySelector(
            "#send"
        ) ||
        document.querySelector(
            "#sendButton"
        ) ||
        document.querySelector(
            "button[type='submit']"
        );


    if (!input) {

        console.warn(
            "404FRIEND: поле сообщения не найдено."
        );

        return;
    }


    if (!button) {

        console.warn(
            "404FRIEND: кнопка отправки не найдена."
        );

        return;
    }


    // Чтобы форма не перезагружала страницу

    const form =
        button.closest("form");


    if (form) {

        form.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                const text =
                    input.value.trim();

                if (!text) {
                    return;
                }

                input.value = "";

                sendMessage(text);
            }
        );

    } else {

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const text =
                    input.value.trim();

                if (!text) {
                    return;
                }

                input.value = "";

                sendMessage(text);
            }
        );
    }


    // Enter = отправить
    // Shift + Enter = новая строка

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                const text =
                    input.value.trim();

                if (!text) {
                    return;
                }

                input.value = "";

                sendMessage(text);
            }
        }
    );
}


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        route();

        loadUsage();

        setupChat();

    }
);
