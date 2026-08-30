import os
import requests

from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder=".")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

MODEL = "nvidia/nemotron-3.5-lightning:free"


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/<path:path>")
def files(path):
    return send_from_directory(".", path)


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()

    if not message:
        return jsonify({"error": "Сообщение пустое."}), 400

    if not OPENROUTER_API_KEY:
        return jsonify({"error": "OPENROUTER_API_KEY не настроен."}), 500

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
            result.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        return jsonify({
            "reply": reply
        })

    except requests.RequestException as error:
        print("Request error:", error)

        return jsonify({
            "error": "Не удалось связаться с OpenRouter."
        }), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
