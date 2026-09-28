# openrouter_provider.py — OpenRouter fallback implementation.
# Identical interface to GroqProvider. Only the URL and auth header differ.

# Import asyncio for non-blocking sleep between retries
import asyncio
# Import httpx for making HTTP requests to the OpenRouter API
import httpx

# Import the abstract LLMProvider interface that this class must implement
from core.llm_provider import LLMProvider
# Import app settings to read the OpenRouter API key and chosen model name
from core.config import settings

# The full URL for OpenRouter's chat completions API endpoint
_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
# Maximum seconds to wait for a response before giving up — OpenRouter can be slower
_TIMEOUT  = 45
# Maximum number of times to retry a failed request before raising an error
_MAX_RETRIES = 3
# HTTP status codes that are worth retrying (rate limit, server errors)
_RETRY_CODES = {429, 500, 502, 503}


# OpenRouter LLM provider — same interface as Groq but calls a different service
class OpenRouterProvider(LLMProvider):

    # Send the system prompt and user message to OpenRouter and return the text reply
    async def generate(self, system_prompt: str, user_message: str) -> str:
        """
        POST to OpenRouter chat completions using async httpx.
        Async keeps FastAPI's event loop unblocked during the network call.
        Retries up to _MAX_RETRIES times on transient errors with exponential backoff.
        Raises RuntimeError if all retries fail.
        """
        # Build the authorization and content-type headers for the API request
        headers = {
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost",   # OpenRouter asks for a referrer
        }
        # Build the request body with the model name, messages, and generation settings
        payload = {
            "model": settings.openrouter_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            "temperature": 0.1,
            # 500 tokens matches Groq — enough for Summary + Key Findings + Sources.
            # 1500 was never needed and made every response wait ~3× longer than necessary.
            "max_tokens":  500,
        }

        # Keep track of the last error message for reporting if all retries fail
        last_error = None
        async with httpx.AsyncClient() as client:
            # Retry the request up to the maximum number of allowed attempts
            for attempt in range(_MAX_RETRIES):
                try:
                    # Send the POST request to the OpenRouter API
                    resp = await client.post(
                        _BASE_URL,
                        headers=headers,
                        json=payload,
                        timeout=_TIMEOUT,
                    )
                    # On success, extract and return the model's reply text
                    if resp.status_code == 200:
                        return resp.json()["choices"][0]["message"]["content"]

                    # On a retryable error, wait with exponential backoff and try again
                    if resp.status_code in _RETRY_CODES:
                        last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                        await asyncio.sleep(2 ** attempt)
                        continue

                    # Raise immediately for non-retryable errors — retrying won't help
                    raise RuntimeError(f"OpenRouter error {resp.status_code}: {resp.text[:200]}")

                # If the request timed out, record the error and retry after a delay
                except httpx.TimeoutException:
                    last_error = f"Timeout on attempt {attempt + 1}"
                    await asyncio.sleep(2 ** attempt)
                    continue

        # If all retries were exhausted, raise an error with the last known failure reason
        raise RuntimeError(f"OpenRouter failed after {_MAX_RETRIES} attempts. Last: {last_error}")
