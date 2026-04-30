from typing import AsyncGenerator

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import AsyncSessionLocal

# ── Firebase Admin SDK init (once at import time) ──────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)


# ── DB session dependency ──────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ── Auth dependency ────────────────────────────────────────────────────────
async def get_current_user(
    authorization: str = Header(..., description="Bearer <firebase-id-token>"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Verify Firebase ID token and return decoded claims.
    The calling controller can then use firebase_uid to look up the PG user row.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format.",
        )
    token = authorization.split(" ", 1)[1]
    try:
        decoded = auth.verify_id_token(token)
        return decoded  # contains uid, email, etc.
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token.",
        )
