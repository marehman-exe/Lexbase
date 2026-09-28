# Factory — reads LLM_PROVIDER from config and returns the right implementation.
# This is the only place in the codebase that knows all three providers exist.
# Every other module imports get_llm_provider() and calls .generate().
#
# The optional `override` parameter allows a per-request provider selection
# (e.g. from the frontend Online/Local toggle) that takes precedence over the
# .env default without requiring a server restart.

from core.config import settings
from core.llm_provider import LLMProvider

_VALID = ("groq", "openrouter", "ollama")


def get_llm_provider(override: str | None = None) -> LLMProvider:
    """
    Return the configured LLM provider instance.

    override — when provided (e.g. from the frontend toggle), takes precedence
               over settings.llm_provider.  Must be one of: groq, openrouter, ollama.
    """
    # Resolve: per-request override wins; fall back to .env setting
    provider = (override or settings.llm_provider).lower().strip()

    if provider == "groq":
        from core.providers.groq_provider import GroqProvider
        return GroqProvider()

    if provider == "openrouter":
        from core.providers.openrouter_provider import OpenRouterProvider
        return OpenRouterProvider()

    if provider == "ollama":
        from core.providers.ollama_provider import OllamaProvider
        return OllamaProvider()

    raise ValueError(
        f"Unknown LLM provider '{provider}'. Valid values: {', '.join(_VALID)}"
    )