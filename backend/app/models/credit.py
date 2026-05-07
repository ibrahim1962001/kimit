import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class UserCredit(Base):
    """Stores a user's credit balance and account status."""
    __tablename__ = "user_credits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Status: active | frozen | disabled | banned
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="credit")
    transactions = relationship("CreditTransaction", back_populates="credit", cascade="all, delete-orphan")


class CreditTransaction(Base):
    """Audit log of every credit add/deduct operation."""
    __tablename__ = "credit_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    credit_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_credits.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)  # positive = add, negative = deduct
    reason: Mapped[str | None] = mapped_column(String(255))
    performed_by: Mapped[str | None] = mapped_column(String(128))  # admin uid
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    credit = relationship("UserCredit", back_populates="transactions")


class ChargeRequest(Base):
    """User-submitted manual credit top-up requests."""
    __tablename__ = "charge_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)          # requested credit amount
    transfer_number: Mapped[str | None] = mapped_column(String(128))      # bank/payment transfer reference
    screenshot_url: Mapped[str | None] = mapped_column(String(1024))      # Firebase Storage URL
    notes: Mapped[str | None] = mapped_column(Text)                       # user notes
    # Status: pending | approved | rejected
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(128))          # admin uid who reviewed
    review_note: Mapped[str | None] = mapped_column(Text)                 # admin rejection note
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="charge_requests")


class AdminRole(Base):
    """Maps Firebase UIDs to admin or sub-admin roles."""
    __tablename__ = "admin_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    # role: super_admin | sub_admin
    role: Mapped[str] = mapped_column(String(32), default="sub_admin", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # sub_admin permissions
    can_approve_charges: Mapped[bool] = mapped_column(Boolean, default=True)
    added_by: Mapped[str | None] = mapped_column(String(128))             # super admin uid
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
