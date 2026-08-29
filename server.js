require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY не найден в .env");
    process.exit(1);
}

app.use(express.json());
app.use(express.static(__dirname));

/*
    404FRIEND LIMITS

    Free   = 50 сообщений / 24 часа
    Pro    = 150 сообщений / 24 часа
    Extra1 = +50 сообщений
    Extra2 = +100 сообщений
*/

const PLANS = {
    Free: 50,
    Pro: 150
};

const users = new Map();

function getUserId(req) {
    return req.headers["x-user-id"] || "demo-user";
}

function getUser(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            plan: "Free",
            extraMessages: 0,
            messages: []
        });
    }

    return users.get(userId);
}

function cleanOldMessages(user) {
    const now = Date.now();

    user.messages = user.messages.filter((timestamp) => {
        return now - timestamp < 24 * 60 * 60 * 1000;
    });
}

function getLimit(user) {
    const baseLimit = PLANS[user.plan] || PLANS.Free;

    return baseLimit + user.extraMessages;
}

function getUsage(user) {
    cleanOldMessages(user);

    return {
        plan: user.plan,
        baseLimit: PLANS[user.plan] || PLANS.Free,
        extraMessages: user.extraMessages,
        usedMessages: user.messages.length,
        totalLimit: getLimit(user)
    };
}

/*
    Главная страница
*/

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

/*
    Проверка использования
*/

app.get("/api/usage", (req, res) => {
    const userId = getUserId(req);
    const user = getUser(userId);

    res.json(getUsage(user));
});

/*
    404FRIEND CHAT
*/

app.post("/api/chat", async (req, res) => {
    try {
        const userId = getUserId(req);
        const user = getUser(userId);

        cleanOldMessages(user);

        const limit = getLimit(user);
        const used = user.messages.length;

        if (used >= limit) {
            return res.status(429).json({
                error: "Лимит сообщений за 24 часа исчерпан.",
                ...getUsage(user)
            });
        }

        const message = String(req.body.message || "").trim();

        if (!message) {
            return res.status(400).json({
                error: "Сообщение пустое."
            });
        }

        if (message.length > 4000) {
            return res.status(400).json({
                error: "Сообщение слишком длинное."
            });
        }

        user.messages.push(Date.now());

        const response = await fetch(
            "https://api.deepseek.com/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
                },

                body: JSON.stringify({
                    model: "deepseek-chat",

                    messages: [
                        {
                            role: "system",
                            content: `
Ты — 404FRIEND, также называемый Good Friend.

Ты был создан 404KidYT 29.08.2026.

Создатель:
YouTube: @404KidYT
ТТ: @404kidyt

Отвечай живо, эмоционально, грамотно и понятно.

Используй подростковый Gen Z/Alfa-вайб,
мемный и абсурдный юмор,
неожиданные реакции,
сарказм,
гиперболу,
внезапные панчи
и подходящие эмодзи.

Не делай каждый ответ одинаковым.

Формат ответа:

[404KidYTTeam]: сообщение.
`
                        },

                        {
                            role: "user",
                            content: message
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("DeepSeek API error:", data);

            return res.status(response.status).json({
                error: "Ошибка DeepSeek API."
            });
        }

        const reply =
            data.choices?.[0]?.message?.content ||
            "404FRIEND молчит 💀";

        res.json({
            reply,
            ...getUsage(user)
        });

    } catch (error) {
        console.error("Server error:", error);

        res.status(500).json({
            error: "Ошибка сервера."
        });
    }
});

/*
    ТЕСТОВЫЕ ПЕРЕКЛЮЧАТЕЛИ ТАРИФОВ

    Потом заменим их настоящей системой оплаты.
*/

app.post("/api/test/pro", (req, res) => {
    const userId = getUserId(req);
    const user = getUser(userId);

    user.plan = "Pro";

    res.json(getUsage(user));
});

app.post("/api/test/extra1", (req, res) => {
    const userId = getUserId(req);
    const user = getUser(userId);

    user.extraMessages += 50;

    res.json(getUsage(user));
});

app.post("/api/test/extra2", (req, res) => {
    const userId = getUserId(req);
    const user = getUser(userId);

    user.extraMessages += 100;

    res.json(getUsage(user));
});

/*
    Запуск
*/

app.listen(PORT, () => {
    console.log(
        `404FRIEND запущен: http://localhost:${PORT}`
    );
});
