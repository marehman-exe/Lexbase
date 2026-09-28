# Learning script only — not production code.
# Proves the model measures meaning, not word overlap.

from sentence_transformers import SentenceTransformer
import numpy as np

# Downloads ~130 MB on first run, cached after.
# BGE-small is fast and accurate enough for experimentation.
model = SentenceTransformer("BAAI/bge-small-en-v1.5")

# S1+S2 = dismissal (expect high score), S3+S4 = law (expect high score),
# S5 = rent (expect low score against all others).
sentences = [
    "Termination of employment by the employer.",           # S1
    "Dismissal of a worker without cause.",                 # S2
    "The contract shall be governed by English law.",       # S3
    "Applicable law and jurisdiction clause.",              # S4
    "The tenant must pay rent on the first of each month.", # S5
]

# normalize_embeddings=True produces unit vectors so dot product equals cosine similarity.
# Unit vectors — dot product equals cosine similarity, no extra math.
embeddings = model.encode(sentences, normalize_embeddings=True)

# Matrix multiply embeddings by its transpose to get all pairwise similarity scores.
# 5x5 matrix: cell [i][j] = similarity between sentence i and j.
similarity_matrix = np.dot(embeddings, embeddings.T)

print("\n=== Cosine Similarity Matrix ===\n")
# Build column header row aligned to match the numeric columns below.
labels = [f"S{i+1}" for i in range(len(sentences))]
header = f"{'':>6}" + "".join(f"{l:>8}" for l in labels)
print(header)
# Separator line sized to match the header and data columns.
print("-" * (6 + 8 * len(sentences)))

# Print each row with its sentence label and similarity scores rounded to 4 decimal places.
for i, row in enumerate(similarity_matrix):
    row_str = f"{labels[i]:>6}" + "".join(f"{v:>8.4f}" for v in row)
    print(row_str)

print("\n=== Sentences ===")
for i, s in enumerate(sentences):
    print(f"S{i+1}: {s}")

print("\n=== What to look for ===")
print("S1 ↔ S2 highest score (both = dismissal).")
print("S3 ↔ S4 second highest (both = governing law).")
print("S5 lowest against everything (different topic).")
