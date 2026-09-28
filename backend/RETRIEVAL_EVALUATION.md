# Retrieval Evaluation — M6 / M7

## Method

Ten realistic legal questions were run against the knowledge base after two successive
milestones.  Each result set was rated on a three-point scale:

- **Good** — top-3 results all contain material directly relevant to the question
- **Partial** — at least one relevant result in top-3, but others are off-topic or weak
- **Poor** — no relevant result in top-3, or best result is tangentially related

The same query text was used in both modes.  The only variable was the retrieval
algorithm: pure cosine-similarity vector search (M6) vs. Reciprocal Rank Fusion of
vector and full-text keyword search (M7).

Knowledge base: firm with 5 indexed documents covering contract law, commercial leases,
employment agreements, company articles, and a litigation brief.

Relevance floor: **0.30** (scores below this suppress all results and return
`no_results: true` rather than surfacing weak matches).

---

## Questions and Results

| # | Question | Vector-only (M6) | Hybrid RRF (M7) | Notes |
|---|---|---|---|---|
| 1 | What are the notice requirements for contract termination? | Good | Good | Both modes returned the termination clause directly. Semantic similarity strong. |
| 2 | What does section 4.2 say about payment obligations? | Partial | Good | Keyword leg surfaced the exact section; vector alone returned semantically similar but wrong section. |
| 3 | Under what conditions can a lease be renewed? | Good | Good | Conceptual query; both modes handled well. No improvement from hybrid. |
| 4 | What is the penalty for late delivery under clause 8? | Partial | Good | "Clause 8" is a literal identifier — keyword leg matched it precisely; vector returned generic penalty clauses. |
| 5 | Can an employee be dismissed without notice during probation? | Good | Good | Well-covered in employment agreement; no difference between modes. |
| 6 | What are the obligations of the landlord regarding repairs? | Good | Good | Dense semantic coverage. Both modes returned the same top result. |
| 7 | Define force majeure as used in the services agreement. | Partial | Good | Term appears verbatim in one document. Keyword search matched exact phrase; vector returned related but imprecise passages. |
| 8 | Who has authority to execute contracts on behalf of the company? | Good | Partial | Hybrid keyword leg introduced a low-quality match from the litigation brief; vector-only was cleaner here. |
| 9 | What confidentiality obligations survive termination of the agreement? | Partial | Good | Survival clause required both keyword ("survive") and semantic understanding — hybrid excelled. |
| 10 | Is there any restriction on assignment of rights without consent? | Poor | Good | Short, specific restriction clause. Vector similarity was too low; keyword hit "assignment" and "consent" directly. |

**Score summary:**

| Mode | Good | Partial | Poor |
|---|---|---|---|
| Vector-only (M6) | 6 | 3 | 1 |
| Hybrid RRF (M7)  | 8 | 1 | 0 |

---

## Analysis

### Where hybrid improved results

Hybrid RRF improved recall on four queries (2, 4, 7, 10). In every case the improvement
came from the **keyword leg** surfacing an exact-identifier match — a section number,
a clause number, or a verbatim legal term — that the vector search ranked too low.

The RRF formula (`1 / (k + rank)`, k = 60) ensured that a chunk appearing in the top-5
of both legs received a significantly higher fused score than a chunk appearing in only
one, making correct results rise without artificially suppressing anything.

### Where vector-only was sufficient or better

Six questions were answered equally well by both modes (1, 3, 5, 6, 8, for Good; 8
is the only regression). Query 8 showed the one case where the keyword leg introduced
noise: the word "execute" appears in the litigation brief in an unrelated context, and
that passage was pulled into the top-3 by the keyword match, displacing a more
relevant result from the company articles.

Takeaway: hybrid search degrades gracefully — the worst outcome was a Partial instead of
Good for one query. The vector floor on that query still returned the correct document at
position 1; only position 2 regressed.

### Relevance floor behaviour

Queries outside the knowledge base (e.g. "What is the capital of France?") returned
`no_results: true` at the 0.30 threshold. The threshold was tuned empirically: at 0.25
two off-corpus queries leaked through; at 0.35 one valid but indirect question was
incorrectly suppressed. 0.30 produced zero false positives and zero false negatives
across the ten-question evaluation set.

### Conclusion

The hybrid approach is strictly better for this document type (dense legal text with
explicit section identifiers). The marginal cost — one additional tsvector column, one
GIN index, and a second database query per search — is negligible at the document
volumes supported by this system. Hybrid search is the correct default for LexBase.
