from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .base import AIProviderError, AIProviderResponse, BaseAIProvider, ChatMessage


class LocalOllamaProvider(BaseAIProvider):
    def chat(self, messages: list[ChatMessage]) -> AIProviderResponse:
        if not self.base_url:
            raise AIProviderError("URL Ollama manquante.")
        payload = {
            "model": self.model,
            "messages": [{"role": item.role, "content": item.content} for item in messages],
            "stream": False,
            "options": {"temperature": 0.2},
        }
        request = Request(
            f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=120) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise AIProviderError(f"Erreur Ollama: {detail or exc.reason}") from exc
        except (URLError, TimeoutError) as exc:
            raise AIProviderError(f"Ollama indisponible: {exc}") from exc
        content = data.get("message", {}).get("content", "")
        if not content:
            raise AIProviderError("Reponse Ollama vide.")
        return AIProviderResponse(content=content.strip(), raw=data)
