# embedding_service.py — BGE model singleton and embedding helpers
#
# The model is loaded ONCE on first use — never at import time and never per request.
# Deferring the import of sentence_transformers (which pulls in torch, transformers,
# and tokenizers — ~500 MB of C/CUDA libraries) keeps uvicorn startup under 2 seconds.
# The model loads on the first search or generate request (~3–5 s), then stays cached.
#
# BGE prefix rule (critical — gets wrong results if applied inconsistently):
#   Passages  → embed WITHOUT any prefix
#   Queries   → embed WITH prefix "Represent this sentence for searching relevant passages: "
#
# This rule is enforced in exactly one place: this file.

# Internal model identifier string matching the HuggingFace model name
_MODEL_NAME = "BAAI/bge-small-en-v1.5"
# Prefix required by BGE for query embeddings — must NOT be used on passages
_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

# Loaded once on first use — None until the first call to get_model()
_model = None


# Return the shared model instance, loading it from disk on first call only
def get_model():
    """Return the singleton model, loading it on first call."""
    global _model
    # Only load the model if it has not been initialised yet
    if _model is None:
        # Deferred import — keeps startup fast by not loading torch at module import time
        from sentence_transformers import SentenceTransformer
        # Force CPU device explicitly.
        # Some sentence-transformers / torch version combinations fail with
        # "Cannot copy out of meta tensor" when torch tries to auto-detect CUDA
        # and the CUDA runtime is absent or mismatched. CPU is correct here —
        # BGE-small is tiny (33 MB) and fast enough on CPU for query embedding.
        _model = SentenceTransformer(_MODEL_NAME, device="cpu")
    return _model


# Embed a list of passage texts for storage — no query prefix applied
def embed_passages(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of passage texts WITHOUT the query prefix.
    Used during ingestion — call with a list, not one at a time.
    Returns a list of 384-float vectors.
    """
    model = get_model()
    # Encode all passages at once in batches of 32 and normalise the vectors
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return vectors.tolist()


# Embed a single search query string with the BGE query prefix applied
def embed_query(query: str) -> list[float]:
    """
    Embed a single query string WITH the BGE query prefix.
    Used at search time.
    Returns a single 384-float vector.
    """
    model = get_model()
    # Prepend the BGE query prefix before encoding to improve retrieval quality
    prefixed = _QUERY_PREFIX + query
    # Encode as a one-element list and return the single vector
    vector = model.encode([prefixed], normalize_embeddings=True)[0]
    return vector.tolist()


# Exported model name so ingestion can record which model produced each embedding
MODEL_NAME = _MODEL_NAME   # exported so ingestion can store it with each chunk
