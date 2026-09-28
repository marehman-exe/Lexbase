# suggestion_service.py — extract keyphrases from indexed chunks using TF-IDF.
#
# Called once after a document finishes ingestion (status → ready).
# Replaces any existing suggestions for that document so re-ingestion stays clean.
#
# Algorithm:
#   1. Collect the text of all chunks belonging to this document.
#   2. Run sklearn TfidfVectorizer with n-gram range (1,3) to score unigrams,
#      bigrams and trigrams.
#   3. Pick the top MAX_PER_DOC phrases by TF-IDF score.
#   4. Filter to phrases between MIN_WORDS and MAX_WORDS words.
#   5. Title-case them so they read naturally as chip labels.
#
# The firm_id is always taken from the document row — never from the caller.

# uuid for generating unique row IDs, logging for non-fatal error reporting
import uuid
import logging

# SQLAlchemy Session type used for database queries and inserts
from sqlalchemy.orm import Session

# ORM models for chunks, documents, and suggested query chip rows
from models.orm import Chunk, Document, SuggestedQuery

# Module-level logger for recording suggestion generation outcomes
logger = logging.getLogger(__name__)

# How many suggestion chips to produce per document
MAX_PER_DOC = 8
# MIN_WORDS must be >= settings.min_query_words (3) so chips never trigger
# the "Query too short" guard when clicked.
MIN_WORDS   = 3
# Slightly wider ceiling to allow natural multi-word legal phrases
MAX_WORDS   = 6   # slightly wider ceiling to allow natural legal phrases

# A small list of legal stop-words that TF-IDF alone won't suppress because
# they appear in every document but carry no query intent.
_EXTRA_STOP = {
    "shall", "herein", "hereof", "thereof", "therein", "pursuant",
    "section", "article", "clause", "paragraph", "agreement", "party",
    "parties", "date", "page", "including", "without", "limitation",
    "provided", "notwithstanding", "ii", "iii", "iv", "vi", "vii",
}


# Decide whether a candidate phrase is suitable as a suggestion chip
def _good_phrase(phrase: str) -> bool:
    words = phrase.split()
    # Must meet the search endpoint's min_query_words=3 guard exactly
    if not (MIN_WORDS <= len(words) <= MAX_WORDS):
        return False
    # Drop phrases that are purely stop-word combos
    if all(w in _EXTRA_STOP for w in words):
        return False
    # Drop phrases that start or end with a stop word
    if words[0] in _EXTRA_STOP or words[-1] in _EXTRA_STOP:
        return False
    # Drop phrases the off-topic guard would reject (e.g. weather, sports)
    from services.query_guard import is_off_topic
    off_topic, _ = is_off_topic(phrase)
    if off_topic:
        return False
    return True


# Extract TF-IDF keyphrases from a document's chunks and save them as suggestions
def generate_suggestions(db: Session, document_id: uuid.UUID) -> None:
    """
    Extract keyphrases from document_id's chunks and store them as
    SuggestedQuery rows.  Existing rows for this document are deleted first
    so re-ingestion is idempotent.

    Silently skips if the document has no chunks (should not normally happen).
    """
    try:
        # Lazily import sklearn to avoid hard dependency at module import time
        from sklearn.feature_extraction.text import TfidfVectorizer  # lazy import
        import numpy as np
    except ImportError:
        logger.warning("scikit-learn not available — skipping suggestion generation")
        return

    # Look up the document row to obtain its firm_id for the suggestion rows
    doc: Document | None = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return

    # Fetch the text of every chunk belonging to this document
    chunks = (
        db.query(Chunk.text)
        .filter(Chunk.document_id == document_id)
        .all()
    )
    if not chunks:
        return

    # Collect all chunk texts into a plain list for TF-IDF fitting
    texts = [row.text for row in chunks]

    # Delete stale suggestions for this document before writing new ones
    db.query(SuggestedQuery).filter(
        SuggestedQuery.document_id == document_id
    ).delete(synchronize_session=False)

    try:
        # Configure TF-IDF to score 1-to-3-gram phrases across all chunks
        vec = TfidfVectorizer(
            ngram_range=(1, 3),
            stop_words="english",
            max_features=200,
            min_df=1,          # phrase must appear in at least 1 chunk
            sublinear_tf=True, # log-scale term frequency
        )
        # Fit the vectoriser on all chunk texts and transform them into a matrix
        tfidf_matrix = vec.fit_transform(texts)
        feature_names = vec.get_feature_names_out()

        # Sum TF-IDF scores across all chunks → importance per phrase
        scores = np.asarray(tfidf_matrix.sum(axis=0)).flatten()
        # Sort phrase indices from highest to lowest importance score
        ranked_indices = scores.argsort()[::-1]  # descending

        selected: list[str] = []
        # Walk ranked phrases and keep the first MAX_PER_DOC that pass the filter
        for idx in ranked_indices:
            if len(selected) >= MAX_PER_DOC:
                break
            phrase = feature_names[idx]
            if _good_phrase(phrase):
                # Title-case the phrase so it reads naturally as a UI chip label
                selected.append(phrase.title())

        # Build ORM row objects for each selected suggestion phrase
        rows = [
            SuggestedQuery(
                id=uuid.uuid4(),
                firm_id=doc.firm_id,
                document_id=doc.id,
                query_text=phrase,
            )
            for phrase in selected
        ]
        # Save all suggestion rows to the database in one operation
        db.bulk_save_objects(rows)
        db.commit()
        logger.info(
            "suggestion_service: %d phrases generated for document %s",
            len(rows), document_id,
        )

    except Exception as exc:
        # Never let suggestion failure break ingestion
        db.rollback()
        logger.warning("suggestion_service failed for %s: %s", document_id, exc)
