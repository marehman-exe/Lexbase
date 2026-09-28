# chat_history_repo.py — read/write operations for the chat_history table

# uuid for typing ID parameters
import uuid
# json for serialising and deserialising the stored response blobs
import json
# datetime utilities for the 7-day cutoff calculation
from datetime import datetime, timezone, timedelta

# SQLAlchemy Session type
from sqlalchemy.orm import Session

# BaseRepository provides the shared db session attribute
from repositories.base import BaseRepository
# ORM model for the chat_history table
from models.orm import ChatHistory


class ChatHistoryRepository(BaseRepository):

    # Insert a new history record after a search (generate_resp is null until patched)
    def create(
        self,
        firm_id: uuid.UUID,
        user_id: uuid.UUID,
        query_text: str,
        search_resp: dict | None,
        generate_resp: dict | None = None,
    ) -> ChatHistory:
        """
        Persist a new chat history row.
        search_resp and generate_resp are stored as JSON text so no extra
        Postgres JSON column is needed — Text handles cross-provider portability.
        """
        entry = ChatHistory(
            firm_id=firm_id,
            user_id=user_id,
            query_text=query_text,
            search_resp=json.dumps(search_resp) if search_resp is not None else None,
            generate_resp=json.dumps(generate_resp) if generate_resp is not None else None,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    # Patch an existing row with the generate response once generation completes
    def set_generate_resp(
        self,
        record_id: uuid.UUID,
        user_id: uuid.UUID,
        generate_resp: dict,
    ) -> None:
        """
        Update only the generate_resp column for a record that already exists.
        Scoped to user_id to prevent cross-user writes.
        """
        entry = (
            self.db.query(ChatHistory)
            .filter(ChatHistory.id == record_id, ChatHistory.user_id == user_id)
            .first()
        )
        if entry:
            entry.generate_resp = json.dumps(generate_resp)
            self.db.commit()

    # Return chat history rows for this user from the last 7 days, newest first
    def get_recent(
        self,
        user_id: uuid.UUID,
        days: int = 7,
        limit: int = 100,
    ) -> list[dict]:
        """
        Fetch the most recent `limit` rows within the past `days` days for a user.
        Returns plain dicts with search_resp and generate_resp already decoded.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        rows = (
            self.db.query(ChatHistory)
            .filter(
                ChatHistory.user_id == user_id,
                ChatHistory.created_at >= cutoff,
            )
            .order_by(ChatHistory.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id":            str(row.id),
                "query_text":    row.query_text,
                "search_resp":   json.loads(row.search_resp)   if row.search_resp   else None,
                "generate_resp": json.loads(row.generate_resp) if row.generate_resp else None,
                "created_at":    row.created_at.isoformat(),
            }
            for row in rows
        ]
