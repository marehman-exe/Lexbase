# llm_provider.py — the only interface the rest of the codebase knows about.
# No module outside core/ may import a concrete provider directly.

# Import the abstract base class tools used to define a required interface
from abc import ABC, abstractmethod


# Abstract base class that all LLM providers must implement
class LLMProvider(ABC):
    """
    One method. generate() takes a system prompt and a user message,
    returns the model's reply as a plain string.

    Why separate system and user?
    - The system prompt contains grounding instructions (our code controls this).
    - The user message contains the assembled passages and the question.
    - Keeping them separate makes prompt injection harder: user-supplied text
      can never bleed into the instruction half.

    All providers implement generate() as async so FastAPI's event loop is
    never blocked during a potentially multi-second LLM call.
    """

    # Every concrete provider must implement this method to call the actual LLM
    @abstractmethod
    async def generate(self, system_prompt: str, user_message: str) -> str:
        """Call the LLM and return the reply text. Raises on unrecoverable error."""
        ...
