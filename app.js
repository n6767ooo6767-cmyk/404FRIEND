const userId =
    localStorage.getItem("404friend_user_id") ||
    crypto.randomUUID();

localStorage.setItem("404friend_user_id", userId);


let currentPlan =
    localStorage.getItem("404friend_plan") || "free";


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


function updateLimit(used, limit) {
    const element = document.getElementById("usage");

    if (element) {
        element.textContent = `${used} / ${limit} сообщений`;
    }
}


async function loadUsage() {
    try {
        const response = await fetch(
            `/api/usage?user_id=${encodeURIComponent(userId)}&plan=${encodeURIComponent(currentPlan)}`
        );

        const data = await response.json();

        updateLimit(data.used, data.limit);

    } catch (error) {
        console.error("Usage error:", error);
    }
}


async function sendMessage(message) {
    if (!message.trim()) {
        return;
    }

    try {
        const response = await fetch("/api/chat", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message,
                user_id: userId,
                plan: currentPlan
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(data);

            if (data.used !== undefined) {
                updateLimit(data.used, data.limit);
            }

            return;
        }

        updateLimit(data.used, data.limit);

        return data.reply;

    } catch (error) {
        console.error("Chat error:", error);
    }
}


document.addEventListener("DOMContentLoaded", () => {
    route();
    loadUsage();
});
