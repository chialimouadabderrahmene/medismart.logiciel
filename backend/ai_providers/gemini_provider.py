from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .base import AIProviderError, AIProviderResponse, BaseAIProvider, ChatMessage, text_from_messages


class GeminiProvider(BaseAIProvider):
    def chat(self, messages: list[ChatMessage]) -> AIProviderResponse:
        if not self.api_key:
            raise AIProviderError("Cle API Gemini manquante.")
        payload = {
            "contents": [{
                "role": "user",
                "parts": [{"text": text_from_messages(messages)}],
            }],
            "generationConfig": {"temperature": 0.2},
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(self.model, safe='')}:generateContent?key={quote(self.api_key, safe='')}"
        request = Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise AIProviderError(f"Erreur Gemini: {detail or exc.reason}") from exc
        except (URLError, TimeoutError) as exc:
            raise AIProviderError(f"Gemini indisponible: {exc}") from exc
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        content = "\n".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
        if not content:
            raise AIProviderError("Reponse Gemini vide.")
        return AIProviderResponse(content=content, raw=data)
