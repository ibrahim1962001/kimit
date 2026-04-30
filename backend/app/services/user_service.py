from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
            await db.commit()
            await db.refresh(user)

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
