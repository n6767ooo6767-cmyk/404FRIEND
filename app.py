import os
import sqlite3
import time
import requests

from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder=".")

DB = "usage.db"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "nvidia/nemotron-3.5-lightning:free"


def init_db():
    with sqlite3.connect(DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usage (
                user_id TEXT PRIMARY KEY,
                count INTEGER NOT NULL DEFAULT 0,
                reset_at INTEGER NOT NULL
            )
        """)
        conn.commit()


def get_usage(user_id):
    now = int(time.time())

    with sqlite3.connect(DB) as conn:
        row = conn.execute(
            "SELECT count, reset_at FROM usage WHERE user_id = ?",
            (user_id,)
        ).fetchone()

        if row is None:
            reset_at = now + 86400

            conn.execute(
                "INSERT INTO usage (user_id, count, reset_at) VALUES (?, ?, ?)",
                (user_id, 0, reset_at)
            )

            conn.commit()

            return 0, reset_at

        count, reset_at = row

        if now >= reset_at:
            reset_at = now + 86400
            count = 0

            conn.execute(
                "UPDATE usage SET count = ?, reset_at = ? WHERE user_id = ?",
                (count, reset_at, user_id)
            )

            conn.commit()

        return count, reset_at


def add_usage(user_id):
    count, reset_at = get_usage(user_id)

    with sqlite3.connect(DB) as conn:
        conn.execute(
            "UPDATE usage SET count = ? WHERE user_id = ?",
            (count + 1, user_id)
        )
        conn.commit()

    return count + 1, reset_at


def get_limit(plan):
    limits = {
        "free": 50,
        "pro": 150,
        "extra1": 100,
        "extra2": 150
    }

    return limits.get(plan, 50)


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/<path:path>")
def catch_all(path):
    full_path = os.path.join(".", path)

    if os.path.isfile(full_path):
        return send_from_directory(".", path)

    return send_from_directory(".", "index.html")


@app.get("/api/usage")
def usage():
    user_id = request.args.get("user_id", "guest")
    plan = request.args.get("plan", "free")

    count, reset_at = get_usage(user_id)

    return jsonify({
        "used": count,
        "limit": get_limit(plan),
        "reset_at": reset_at
    })


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}

    message = str(data.get("message", "")).strip()
    user_id = str(data.get("user_id", "guest"))
    plan = str(data.get("plan", "free"))

    if not message:
        return jsonify({
            "error": "Сообщение пустое."
        }), 400

    if not OPENROUTER_API_KEY:
        return jsonify({
            "error": "OPENROUTER_API_KEY не настроен."
        }), 500

    count, reset_at = get_usage(user_id)
    limit = get_limit(plan)

    if count >= limit:
        return jsonify({
            "error": "Лимит сообщений закончился.",
            "used": count,
            "limit": limit,
            "reset_at": reset_at
        }), 429

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "Ты — 404FRIEND. Отвечай живо и дружелюбно."
                    },
                    {
                        "role": "user",
                        "content": message
                    }
                ]
            },
            timeout=60
        )

        result = response.json()

        if not response.ok:
            print("OpenRouter error:", result)

            return jsonify({
                "error": "Ошибка OpenRouter API.",
                "details": result
            }), response.status_code

        reply = (
            result
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        if not reply:
            return jsonify({
                "error": "Пустой ответ OpenRouter."
            }), 500

        used, reset_at = add_usage(user_id)

        return jsonify({
            "reply": reply,
            "used": used,
            "limit": limit,
            "reset_at": reset_at
        })

    except requests.RequestException as error:
        print("Request error:", error)

        return jsonify({
            "error": "Ошибка соединения с OpenRouter."
        }), 500


init_db()


if __name__ == "__main__":
    port = int(os.getenv("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
