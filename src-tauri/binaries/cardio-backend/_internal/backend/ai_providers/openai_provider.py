from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .base import AIProviderError, AIProviderResponse, BaseAIProvider, ChatMessage


class OpenAICompatibleProvider(BaseAIProvider):
    def chat(self, messages: list[ChatMessage]) -> AIProviderResponse:
        if not self.api_key:
            raise AIProviderError("Cle API OpenAI-compatible manquante.")
        if not self.base_url:
            raise AIProviderError("URL OpenAI-compatible manquante.")
        payload = {
            "model": self.model,
            "messages": [{"role": item.role, "content": item.content} for item in messages],
            "temperature": 0.2,
        }
        request = Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=90) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise AIProviderError(f"Erreur OpenAI-compatible: {detail or exc.reason}") from exc
        except (URLError, TimeoutError) as exc:
            raise AIProviderError(f"OpenAI-compatible indisponible: {exc}") from exc
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise AIProviderError("Reponse OpenAI-compatible vide.")
        return AIProviderResponse(content=content.strip(), raw=data)
