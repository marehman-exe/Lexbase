# ollama_provider.py — Ollama local inference implementation of LLMProvider.
# Calls a locally-running Ollama server via its OpenAI-compatible endpoint.
# No API key required — Ollama listens on localhost only by default.

import httpx

from core.llm_provider import LLMProvider
from core.config import settings

# Local GPU inference is slower than a cloud API — allow up to 2 minutes.
# RTX 3060 12GB on qwen2.5:3b generates ~60–80 tok/s; 800 tokens ≈ 12s worst case.
_TIMEOUT     = 120
_MAX_RETRIES = 3
_RETRY_CODES = {429, 500, 502, 503}


class OllamaProvider(LLMProvider):

    async def generate(self, system_prompt: str, user_message: str) -> str:
        """
        POST to the locally-running Ollama server using async httpx.
        Using async means FastAPI's event loop is not blocked while the
        model generates — other requests can still be served concurrently.

        keep_alive: "10m" — keeps the model loaded in VRAM between requests
        so there is no cold-load delay on the second and subsequent calls.

        num_ctx: 4096 — ensures our full passage block fits in the context
        window (10 passages × ~300 tokens each ≈ 3,000 tokens + prompt overhead).
        Without this, Ollama silently truncates the oldest passages when the
        default 2048-token window is exceeded.

        max_tokens: 800 — matches the Groq limit; a ## Summary + ## Key Findings
        + ## Sources response always fits inside 800 tokens.

        Raises RuntimeError("Ollama is not reachable …") on connection failure
        so the caller can detect it and show a friendly UI message.
        """
        url = f"{settings.ollama_base_url.rstrip('/')}/v1/chat/completions"
        # No Authorization header — Ollama on localhost requires none
        headers = {"Content-Type": "application/json"}
        payload = {
            "model":      settings.ollama_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            "temperature": 0.1,
            # 800 tokens is enough for the structured ## Summary/Key Findings/Sources
            # format. Requesting more just means waiting longer for the model to stop.
            "max_tokens":  800,
            # Keep the model warm in VRAM — eliminates the 5–15s cold-load penalty
            # that happens when the model was unloaded after 5min of inactivity.
            "keep_alive":  "10m",
            # Ollama-specific options — passed through to llama.cpp
            "options": {
                # Extend context window to fit 10 passages + system prompt comfortably.
                # Default is 2048 which can silently truncate long passage blocks.
                "num_ctx":     4096,
                # num_predict mirrors max_tokens at the llama.cpp layer — belt and braces.
                "num_predict": 800,
            },
        }

        last_error = None
        async with httpx.AsyncClient() as client:
            for attempt in range(_MAX_RETRIES):
                try:
                    resp = await client.post(
                        url, headers=headers, json=payload, timeout=_TIMEOUT
                    )

                    if resp.status_code == 200:
                        return resp.json()["choices"][0]["message"]["content"]

                    if resp.status_code in _RETRY_CODES:
                        import asyncio
                        last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                        await asyncio.sleep(2 ** attempt)
                        continue

                    raise RuntimeError(f"Ollama error {resp.status_code}: {resp.text[:200]}")

                except httpx.ConnectError:
                    # Ollama is not running — raise immediately, do not retry.
                    # ConnectError means the server is simply not there.
                    raise RuntimeError(
                        f"Ollama is not reachable at {settings.ollama_base_url}. Is it running? "
                        "Start it with: ollama serve"
                    )

                except httpx.TimeoutException:
                    import asyncio
                    last_error = f"Timeout on attempt {attempt + 1}"
                    await asyncio.sleep(2 ** attempt)
                    continue

        raise RuntimeError(f"Ollama failed after {_MAX_RETRIES} attempts. Last: {last_error}")
