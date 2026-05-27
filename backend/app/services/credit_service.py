"""
credit_service.py — balance checks and deductions for billable operations.
"""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.credit import CreditTransaction, UserCredit


class CreditService:

    async def ensure_credit(self, db: AsyncSession, user_id: int) -> UserCredit:
        result = await db.execute(select(UserCredit).where(UserCredit.user_id == user_id))
        credit = result.scalar_one_or_none()
        if credit is None:
            credit = UserCredit(user_id=user_id, balance=settings.WELCOME_CREDITS, status="active")
            db.add(credit)
            await db.flush()
            txn = CreditTransaction(
                credit_id=credit.id,
                amount=settings.WELCOME_CREDITS,
                reason="Welcome bonus",
                performed_by="system",
            )
            db.add(txn)
            await db.commit()
            await db.refresh(credit)
        return credit

    async def get_balance(self, db: AsyncSession, user_id: int) -> float:
        credit = await self.ensure_credit(db, user_id)
        return float(credit.balance)

    async def require_balance(self, db: AsyncSession, user_id: int, amount: float) -> UserCredit:
        credit = await self.ensure_credit(db, user_id)
        if credit.status != "active":
            raise HTTPException(
                status_code=403,
                detail=f"Account is {credit.status}. Contact support.",
            )
        if credit.balance < amount:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Need {amount}, have {credit.balance:.1f}.",
            )
        return credit

    async def deduct(
        self,
        db: AsyncSession,
        user_id: int,
        amount: float,
        reason: str,
    ) -> float:
        credit = await self.require_balance(db, user_id, amount)
        credit.balance = max(0.0, credit.balance - amount)
        db.add(
            CreditTransaction(
                credit_id=credit.id,
                amount=-amount,
                reason=reason,
                performed_by="system",
            )
        )
        await db.commit()
        await db.refresh(credit)
        return float(credit.balance)


credit_service = CreditService()
