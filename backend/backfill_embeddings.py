"""
backfill_embeddings.py — embed all chunks that currently have embedding=NULL.
Run once after deploying M6 if you had documents ingested during M5.

Usage:
    cd backend
    python backfill_embeddings.py
"""
# sys and os used to add the backend directory to the Python import path
import sys
import os
# Ensure the backend package root is on sys.path so local imports resolve
sys.path.insert(0, os.path.dirname(__file__))

# Database session factory for opening a connection to the database
from db.session import SessionLocal
# ORM Chunk model used for querying and updating embedding rows
from models.orm import Chunk
# embed_passages generates vectors for a list of text strings in one batch
# MODEL_NAME is stored on each chunk row to record which model embedded it
from services.embedding_service import embed_passages, MODEL_NAME

# Number of chunks to embed and update in each database commit cycle
BATCH = 32

# Open a single database session for the entire backfill operation
db = SessionLocal()
try:
    # Count how many chunks still have no embedding before starting
    total = db.query(Chunk).filter(Chunk.embedding == None).count()
    print(f"Chunks to embed: {total}")
    # Exit early if all chunks are already embedded
    if total == 0:
        print("Nothing to do.")
        sys.exit(0)

    done = 0
    # Loop until there are no more chunks without embeddings
    while True:
        # Fetch the next batch of chunks that still have a NULL embedding
        chunks = (
            db.query(Chunk)
            .filter(Chunk.embedding == None)
            .limit(BATCH)
            .all()
        )
        # Break out of the loop when no more unembedded chunks remain
        if not chunks:
            break

        # Extract the text from each chunk for batch embedding
        texts = [c.text for c in chunks]
        # Generate embedding vectors for all texts in this batch at once
        vectors = embed_passages(texts)

        # Assign each computed vector back to its corresponding chunk row
        for chunk, vector in zip(chunks, vectors):
            chunk.embedding = vector
            # Record which model produced this embedding for auditing purposes
            chunk.embedding_model = MODEL_NAME

        # Commit this batch so progress is saved even if the script is interrupted
        db.commit()
        done += len(chunks)
        print(f"  {done}/{total} embedded...")

    print("Backfill complete.")
finally:
    # Always close the database session when the script finishes or fails
    db.close()
