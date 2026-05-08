from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ChatMessage:
    role: str
    content: str


@dataclass(slots=True)
class AIProviderResponse:
    content: str
    raw: dict | list | str | None = None


class AIProviderError(RuntimeError):
    """Raised when a provider cannot return a usable answer."""


class BaseAIProvider:
    def __init__(self, model: str, api_key: str = "", base_url: str = "", max_new_tokens: int | None = None) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.max_new_tokens = max_new_tokens

    def chat(self, messages: list[ChatMessage]) -> AIProviderResponse:
        raise NotImplementedError


def text_from_messages(messages: list[ChatMessage]) -> str:
    return "\n\n".join(f"{item.role.upper()}:\n{item.content}" for item in messages)
