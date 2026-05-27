from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.credit import UserCredit, CreditTransaction
from app.models.user import User


class UserService:
    """
    Bridges Firebase Auth with internal PostgreSQL users.
    On first login the user row is created automatically (upsert).
    """

    async def sync_user(
        self,
        db: AsyncSession,
        firebase_uid: str,
        email: str,
        display_name: Optional[str] = None,
    ) -> User:
        """
        Get or create a User row keyed by firebase_uid.
        All downstream data is scoped to this user's PK (id).
        """
        result = await db.execute(
            select(User).where(User.firebase_uid == firebase_uid)
        )
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                firebase_uid=firebase_uid,
                email=email,
                display_name=display_name,
                plan="free",
            )
            db.add(user)
            await db.flush()
            credit = UserCredit(
                user_id=user.id,
                balance=settings.WELCOME_CREDITS,
                status="active",
            )
            db.add(credit)
            await db.flush()
            db.add(
                CreditTransaction(
                    credit_id=credit.id,
                    amount=settings.WELCOME_CREDITS,
                    reason="Welcome bonus",
                    performed_by="system",
                )
            )
            await db.commit()
            await db.refresh(user)
        else:
            # Ensure credit row exists for legacy users
            from app.services.credit_service import credit_service
            await credit_service.ensure_credit(db, user.id)

        return user

    async def get_by_firebase_uid(
        self,
        db: AsyncSession,
        firebase_uid: str,
    ) -> Optional[User]:
        result = await db.execute(
            select(User).where(User.firebase_uid == firebase_uid)
        )
        return result.scalar_one_or_none()


user_service = UserService()
