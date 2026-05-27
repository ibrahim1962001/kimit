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
from app.services.credit_service import credit_service

router = APIRouter(tags=["Auth"])


@router.post("/api/auth/sync", response_model=UserOut)
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
    credit = await credit_service.ensure_credit(db, user.id)
    return UserOut(
        id=user.id,
        firebase_uid=user.firebase_uid,
        email=user.email,
        display_name=user.display_name,
        plan=user.plan,
        credit_balance=credit.balance,
        credit_status=credit.status,
        created_at=user.created_at,
    )
