"""
auth_router.py
Single endpoint: POST /auth/sync
Verifies Firebase token → upserts user in PostgreSQL.
No business logic here — delegates entirely to UserService.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.services.user_service import user_service
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/sync", response_model=UserOut)
async def sync_user(
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the frontend immediately after Firebase login.
    Creates the PostgreSQL user row on first call; returns it on subsequent calls.
    """
    user = await user_service.sync_user(
        db=db,
        firebase_uid=claims["uid"],
        email=claims.get("email", ""),
        display_name=claims.get("name"),
    )
    return user
