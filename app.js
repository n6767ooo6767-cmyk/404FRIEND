const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messages = document.getElementById("messages");
const usageCount = document.getElementById("usage-count");
const planName = document.getElementById("plan-name");

const API_URL = "/api/chat";

let state = {
    plan: "Free",
    baseLimit: 50,
    extraMessages: 0,
    usedMessages: 0
};

function getTotalLimit() {
    return state.baseLimit + state.extraMessages;
}

function updateUsage() {
    const totalLimit = getTotalLimit();

    planName.textContent = state.plan;
    usageCount.textContent =
        `${state.usedMessages} / ${totalLimit} сообщений`;
}

function addMessage(text, type) {
    const message = document.createElement("div");

    message.className =
        type === "user"
            ? "message user-message"
            : "message ai-message";

    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent =
        type === "user" ? "Ты" : "404FRIEND";

    const content = document.createElement("div");
    content.className = "message-text";
    content.textContent = text;

    message.appendChild(name);
    message.appendChild(content);

    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
}

function setLoading(loading) {
    messageInput.disabled = loading;

    const button = chatForm.querySelector("button");
    button.disabled = loading;

    if (loading) {
        button.textContent = "…";
    } else {
        button.textContent = "➤";
    }
}

async function sendMessage(message) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
            message
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "Не удалось получить ответ."
        );
    }

    return data;
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = messageInput.value.trim();

    if (!message) {
        return;
    }

    messageInput.value = "";
    addMessage(message, "user");

    setLoading(true);

    try {
        const data = await sendMessage(message);

        if (data.reply) {
            addMessage(data.reply, "ai");
        }

        if (typeof data.usedMessages === "number") {
            state.usedMessages = data.usedMessages;
        }

        if (typeof data.baseLimit === "number") {
            state.baseLimit = data.baseLimit;
        }

        if (typeof data.extraMessages === "number") {
            state.extraMessages = data.extraMessages;
        }

        if (data.plan) {
            state.plan = data.plan;
        }

        updateUsage();

    } catch (error) {
        addMessage(
            error.message || "Что-то пошло не так.",
            "ai"
        );
    } finally {
        setLoading(false);
        messageInput.focus();
    }
});

async function loadUsage() {
    try {
        const response = await fetch("/api/usage", {
            credentials: "include"
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (data.plan) {
            state.plan = data.plan;
        }

        if (typeof data.baseLimit === "number") {
            state.baseLimit = data.baseLimit;
        }

        if (typeof data.extraMessages === "number") {
            state.extraMessages = data.extraMessages;
        }

        if (typeof data.usedMessages === "number") {
            state.usedMessages = data.usedMessages;
        }

        updateUsage();

    } catch {
        updateUsage();
    }
}

document.querySelector(".login-btn")?.addEventListener(
    "click",
    () => {
        window.location.href = "/login";
    }
);

document.querySelectorAll(".plan-btn").forEach((button) => {
    button.addEventListener("click", () => {
        const text = button.textContent.trim();

        if (text === "Получить Pro") {
            window.location.href = "/pricing?plan=pro";
            return;
        }

        if (text === "Extra 1") {
            window.location.href = "/pricing?plan=extra1";
            return;
        }

        if (text === "Extra 2") {
            window.location.href = "/pricing?plan=extra2";
        }
    });
});

loadUsage();
