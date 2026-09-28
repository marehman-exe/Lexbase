# search_repo.py — vector search, keyword search, and RRF fusion
# Every query is firm-scoped — firm_id is required and never optional.

# uuid for typing all firm ID parameters
import uuid
# text() wraps raw SQL strings for safe SQLAlchemy execution
from sqlalchemy import text
# SQLAlchemy Session type used throughout this repository
from sqlalchemy.orm import Session

# BaseRepository provides the shared db session attribute
from repositories.base import BaseRepository
# Reuse the firm_id guard from the document repository for consistent enforcement
from repositories.document_repo import _require_firm_id


# RRF constant — standard value from the original paper.
# Adding 60 to rank prevents very high-ranked results from dominating too much.
_RRF_K = 60


# Repository class for vector, keyword, and hybrid search operations
class SearchRepository(BaseRepository):

    # Run a cosine-distance vector search and return the top matching chunks
    def vector_search(
        self,
        firm_id: uuid.UUID | None,
        query_vector: list[float],
        limit: int = 20,
    ) -> list[dict]:
        """
        Find the `limit` nearest chunks to query_vector for this firm.
        Uses cosine distance (<=>) — lower distance = more similar.
        Returns rows with chunk_id, similarity (1 - distance), text,
        page_number, document_id, original_filename.

        firm_id filter is INSIDE the SQL — never filtered in Python afterwards.
        """
        firm_id = _require_firm_id(firm_id)
        # Format the query vector as a Postgres vector literal string
        vector_str = "[" + ",".join(str(v) for v in query_vector) + "]"
        # SQL selects the nearest chunks ordered by cosine distance ascending
        sql = text("""
            SELECT
                c.id                    AS chunk_id,
                c.text                  AS text,
                c.page_number           AS page_number,
                c.document_id           AS document_id,
                d.original_filename     AS filename,
                1 - (c.embedding <=> CAST(:qvec AS vector)) AS similarity
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE c.firm_id = :firm_id
              AND c.embedding IS NOT NULL
            ORDER BY c.embedding <=> CAST(:qvec AS vector)
            LIMIT :limit
        """)
        # Execute the parameterised query and convert each row to a plain dict
        rows = self.db.execute(sql, {
            "qvec":    vector_str,
            "firm_id": str(firm_id),
            "limit":   limit,
        }).fetchall()
        return [dict(r._mapping) for r in rows]

    # Run a full-text keyword search using the pre-built tsvector column
    def keyword_search(
        self,
        firm_id: uuid.UUID | None,
        query: str,
        limit: int = 20,
    ) -> list[dict]:
        """
        Full-text search using the generated tsvector column.
        Uses plainto_tsquery — handles plain English phrases without
        requiring the user to know tsquery syntax.
        firm_id filter is INSIDE the SQL.
        """
        firm_id = _require_firm_id(firm_id)
        # SQL ranks chunks by BM25-like ts_rank and filters by tsvector match
        sql = text("""
            SELECT
                c.id                    AS chunk_id,
                c.text                  AS text,
                c.page_number           AS page_number,
                c.document_id           AS document_id,
                d.original_filename     AS filename,
                ts_rank(c.text_search, plainto_tsquery('english', :query)) AS rank
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE c.firm_id = :firm_id
              AND c.text_search @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :limit
        """)
        # Execute with bound parameters and return each row as a plain dict
        rows = self.db.execute(sql, {
            "query":   query,
            "firm_id": str(firm_id),
            "limit":   limit,
        }).fetchall()
        return [dict(r._mapping) for r in rows]

    # Combine vector and keyword results using Reciprocal Rank Fusion
    def hybrid_search(
        self,
        firm_id: uuid.UUID | None,
        query_vector: list[float],
        query_text: str,
        top_n: int = 10,
        relevance_floor: float = 0.0,
    ) -> list[dict]:
        """
        Reciprocal Rank Fusion of vector and keyword results.

        RRF formula: score(d) = Σ 1 / (k + rank(d))
        where k=60 and rank is 1-based position in each list.

        Why ranks instead of scores: cosine similarity and ts_rank are on
        completely different scales — you cannot average or add them directly.
        RRF only uses positions, so no normalisation is needed.

        Deduplication:
          1. By chunk_id — same chunk appearing in both lists is merged (correct RRF).
          2. By near-identical text — adjacent overlapping chunks share many words.
             We keep only the first occurrence per (document_id, page_number) pair
             after ranking, preventing the same page from filling multiple slots.

        Relevance filtering:
          Every result is individually checked against relevance_floor.
          Results below the floor are dropped — the caller gets fewer than top_n
          when the corpus does not have enough relevant passages.

        Returns at most top_n results, only those above relevance_floor.
        """
        # Fetch a larger candidate pool so RRF has room to rerank before trimming
        pool = top_n * 3
        vec_results = self.vector_search(firm_id, query_vector, limit=pool)
        kw_results  = self.keyword_search(firm_id, query_text,   limit=pool)

        # Build RRF score map: chunk_id → {rrf_score, row data}
        scores: dict[str, dict] = {}

        # Accumulate RRF contribution from the vector search rankings
        for rank, row in enumerate(vec_results, start=1):
            cid = str(row["chunk_id"])
            rrf = 1.0 / (_RRF_K + rank)
            if cid not in scores:
                scores[cid] = {**row, "rrf_score": 0.0}
            scores[cid]["rrf_score"] += rrf

        # Accumulate RRF contribution from the keyword search rankings
        for rank, row in enumerate(kw_results, start=1):
            cid = str(row["chunk_id"])
            rrf = 1.0 / (_RRF_K + rank)
            if cid not in scores:
                # Initialise similarity to 0.0 for chunks only found by keyword
                scores[cid] = {**row, "rrf_score": 0.0, "similarity": 0.0}
            scores[cid]["rrf_score"] += rrf

        # Sort by RRF score descending
        ranked = sorted(scores.values(), key=lambda r: r["rrf_score"], reverse=True)

        # ── Per-result relevance filter ──────────────────────────────────────
        # Drop any result whose vector similarity is below the floor.
        # This means the caller receives fewer than top_n results when the
        # corpus does not contain enough relevant passages — which is correct.
        if relevance_floor > 0.0:
            ranked = [r for r in ranked if float(r.get("similarity", 0.0)) >= relevance_floor]

        # ── Near-duplicate suppression ───────────────────────────────────────
        # Adjacent chunks from the same document overlap heavily in text.
        # Keep only the highest-ranked chunk per (document_id, page_number) pair.
        # This prevents the same page from occupying multiple result slots.
        seen_pages: set[tuple] = set()
        deduped: list[dict] = []
        for row in ranked:
            page_key = (str(row["document_id"]), row["page_number"])
            if page_key in seen_pages:
                # Skip — this page is already represented by a higher-ranked chunk
                continue
            seen_pages.add(page_key)
            deduped.append(row)
            if len(deduped) == top_n:
                break

        return deduped
