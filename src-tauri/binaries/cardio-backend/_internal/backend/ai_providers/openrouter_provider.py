from __future__ import annotations

import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .base import AIProviderError, AIProviderResponse, BaseAIProvider, ChatMessage, text_from_messages


OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"


def _extract_text(payload: object) -> str:
    if isinstance(payload, dict):
        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict) and message.get("content"):
                    return str(message["content"])
                if first.get("text"):
                    return str(first["text"])
        for key in ("generated_text", "summary_text", "text", "answer"):
            if payload.get(key):
                return str(payload[key])
        return json.dumps(payload, ensure_ascii=False)
    if isinstance(payload, list):
        return "\n".join(_extract_text(item) for item in payload)
    return str(payload or "")


def _messages_payload(messages: list[ChatMessage]) -> list[dict[str, str]]:
    payload: list[dict[str, str]] = []
    for message in messages:
        role = (message.role or "user").strip().lower()
        if role not in {"system", "user", "assistant"}:
            role = "user"
        payload.append({"role": role, "content": message.content})
    if not payload:
        payload.append({"role": "user", "content": text_from_messages(messages)})
    return payload


def _clean_error_detail(detail: str, fallback: str) -> str:
    text = (detail or "").strip()
    if not text:
        return fallback
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = None
    if isinstance(data, dict):
        error = data.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error.get("detail") or error).strip()
        message = str(data.get("message") or data.get("detail") or data.get("error") or data).strip()
        return message
    if "<html" in text.lower() or "<!doctype" in text.lower():
        stripped = re.sub(r"<[^>]+>", " ", text)
        stripped = re.sub(r"\s+", " ", stripped).strip()
        return stripped or fallback
    return text


class OpenRouterProvider(BaseAIProvider):
    def chat(self, messages: list[ChatMessage]) -> AIProviderResponse:
        if not self.api_key:
            raise AIProviderError("Cle API OpenRouter manquante.")
        max_tokens = self.max_new_tokens or 512
        payload = {
            "model": self.model,
            "messages": _messages_payload(messages),
            "max_tokens": max_tokens,
            "temperature": 0.15,
            "stream": False,
        }
        request = Request(
            OPENROUTER_CHAT_COMPLETIONS_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://medicalbk.vercel.app",
                "X-Title": "MediSmart Pro",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            clean_detail = _clean_error_detail(detail, str(exc.reason))
            raise AIProviderError(f"Erreur OpenRouter: {clean_detail}") from exc
        except (URLError, TimeoutError) as exc:
            raise AIProviderError(f"OpenRouter indisponible: {exc}") from exc
        content = _extract_text(data).strip()
        if not content:
            raise AIProviderError("Reponse OpenRouter vide.")
        return AIProviderResponse(content=content, raw=data)
