# groq_provider.py — Groq implementation of LLMProvider.
# Uses the OpenAI-compatible REST API directly with async httpx (no SDK needed).

# Import asyncio for non-blocking sleep between retries
import asyncio
# Import httpx for making HTTP requests to the Groq API
import httpx

# Import the abstract LLMProvider interface that this class must implement
from core.llm_provider import LLMProvider
# Import app settings to read the Groq API key and chosen model name
from core.config import settings

# The full URL for Groq's chat completions API endpoint
_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
# Maximum seconds to wait for Groq to respond before giving up on a request
_TIMEOUT  = 30          # seconds — Groq is fast; 30s is generous
# Maximum number of times to retry a failed request before raising an error
_MAX_RETRIES = 3
# HTTP status codes that are worth retrying (rate limit, server errors)
_RETRY_CODES = {429, 500, 502, 503}


# Groq LLM provider that calls the Groq REST API and returns the model's reply
class GroqProvider(LLMProvider):

    # Send the system prompt and user message to Groq and return the text reply
    async def generate(self, system_prompt: str, user_message: str) -> str:
        """
        POST to Groq chat completions using async httpx.
        Async keeps FastAPI's event loop unblocked during the network call.
        Retries up to _MAX_RETRIES times on transient errors with exponential backoff.
        Raises RuntimeError if all retries fail.
        """
        # Build the authorization and content-type headers for the API request
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        # Build the request body with the model name, messages, and generation settings
        payload = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            "temperature": 0.1,   # low temperature — factual retrieval task
            # 800 tokens — reasoning models (gpt-oss-20b) spend ~20–50 tokens on
            # internal reasoning before emitting visible content. 500 was too tight
            # and caused empty responses. 800 comfortably fits reasoning overhead
            # + ## Summary + ## Key Findings + ## Sources.
            "max_tokens":  800,
        }

        # Keep track of the last error message for reporting if all retries fail
        last_error = None
        async with httpx.AsyncClient() as client:
            # Retry the request up to the maximum number of allowed attempts
            for attempt in range(_MAX_RETRIES):
                try:
                    # Send the POST request to the Groq API
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

                    # Non-retryable error (400, 401, 403 etc.)
                    # Raise immediately — retrying won't help these errors
                    raise RuntimeError(f"Groq error {resp.status_code}: {resp.text[:200]}")

                # If the request timed out, record the error and retry after a delay
                except httpx.TimeoutException:
                    last_error = f"Timeout on attempt {attempt + 1}"
                    await asyncio.sleep(2 ** attempt)
                    continue

        # If all retries were exhausted, raise an error with the last known failure reason
        raise RuntimeError(f"Groq failed after {_MAX_RETRIES} attempts. Last: {last_error}")
