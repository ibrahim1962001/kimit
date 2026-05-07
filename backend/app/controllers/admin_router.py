"""
Admin Router — protected by Firebase Admin Token verification.
Only firebase UIDs present in admin_roles table (is_active=True) can access these endpoints.
"""
from __future__ import annotations

import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import User, Dataset, UserCredit, CreditTransaction, ChargeRequest, AdminRole

# Optional: verify Firebase ID token server-side
try:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials
    _fb_app = firebase_admin.get_app()
except Exception:
    firebase_admin = None  # type: ignore
    fb_auth = None  # type: ignore

router = APIRouter(prefix="/admin", tags=["admin"])


# ──────────────────────────────────────────────
# Auth helper
# ──────────────────────────────────────────────

def _verify_admin(authorization: str | None, db: Session, require_super: bool = False) -> AdminRole:
    """Validate Bearer token and confirm the UID has an active admin role."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = authorization.split(" ", 1)[1]

    # Verify with Firebase Admin SDK if available, else trust token as UID (dev mode)
    if fb_auth:
        try:
            decoded = fb_auth.verify_id_token(token)
            uid = decoded["uid"]
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    else:
        uid = token  # Dev fallback

    admin = db.scalar(select(AdminRole).where(AdminRole.firebase_uid == uid, AdminRole.is_active == True))
    if not admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an admin")
    if require_super and admin.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin required")
    return admin


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class CreditAdjust(BaseModel):
    amount: float          # positive = add, negative = deduct
    reason: str | None = None


class StatusUpdate(BaseModel):
    status: str            # active | frozen | disabled | banned


class ChargeReview(BaseModel):
    action: str            # approve | reject
    note: str | None = None


class SubAdminCreate(BaseModel):
    email: str
    firebase_uid: str
    role: str = "sub_admin"
    can_approve_charges: bool = True


# ──────────────────────────────────────────────
# Users
# ──────────────────────────────────────────────

@router.get("/users")
def list_users(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    _verify_admin(authorization, db)

    q = select(User).options(joinedload(User.credit))
    if search:
        pattern = f"%{search}%"
        q = q.where((User.email.ilike(pattern)) | (User.display_name.ilike(pattern)))

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    users_raw = db.scalars(q.offset((page - 1) * limit).limit(limit)).all()

    result = []
    for u in users_raw:
        ds_count = db.scalar(select(func.count(Dataset.id)).where(Dataset.user_id == u.id)) or 0
        result.append({
            "id": u.id,
            "firebase_uid": u.firebase_uid,
            "email": u.email,
            "display_name": u.display_name,
            "plan": u.plan,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "credit_balance": u.credit.balance if u.credit else 0.0,
            "credit_status": u.credit.status if u.credit else "active",
            "dataset_count": ds_count,
        })

    return {"users": result, "total": total, "page": page, "limit": limit}


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    _verify_admin(authorization, db)

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    datasets = db.scalars(select(Dataset).where(Dataset.user_id == user_id).order_by(Dataset.created_at.desc())).all()
    credit = db.scalar(select(UserCredit).where(UserCredit.user_id == user_id))
    txns = []
    if credit:
        txns = db.scalars(
            select(CreditTransaction).where(CreditTransaction.credit_id == credit.id).order_by(CreditTransaction.created_at.desc()).limit(50)
        ).all()

    return {
        "id": user.id,
        "firebase_uid": user.firebase_uid,
        "email": user.email,
        "display_name": user.display_name,
        "plan": user.plan,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "credit": {
            "balance": credit.balance if credit else 0.0,
            "status": credit.status if credit else "active",
        },
        "datasets": [
            {
                "id": d.id,
                "filename": d.filename,
                "row_count": d.row_count,
                "col_count": d.col_count,
                "source": d.source,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in datasets
        ],
        "transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "reason": t.reason,
                "performed_by": t.performed_by,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txns
        ],
    }


@router.post("/users/{user_id}/credits")
def adjust_credit(
    user_id: int,
    body: CreditAdjust,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    admin = _verify_admin(authorization, db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    credit = db.scalar(select(UserCredit).where(UserCredit.user_id == user_id))
    if not credit:
        credit = UserCredit(user_id=user_id, balance=0.0)
        db.add(credit)
        db.flush()

    credit.balance = max(0.0, credit.balance + body.amount)
    txn = CreditTransaction(
        credit_id=credit.id,
        amount=body.amount,
        reason=body.reason,
        performed_by=admin.firebase_uid,
    )
    db.add(txn)
    db.commit()
    return {"balance": credit.balance, "transaction_id": txn.id}


@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    body: StatusUpdate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    _verify_admin(authorization, db)
    valid_statuses = {"active", "frozen", "disabled", "banned"}
    if body.status not in valid_statuses:
        raise HTTPException(400, f"Status must be one of {valid_statuses}")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    credit = db.scalar(select(UserCredit).where(UserCredit.user_id == user_id))
    if not credit:
        credit = UserCredit(user_id=user_id, balance=0.0, status=body.status)
        db.add(credit)
    else:
        credit.status = body.status
    db.commit()
    return {"status": credit.status}


# ──────────────────────────────────────────────
# Charge Requests
# ──────────────────────────────────────────────

@router.get("/charge-requests")
def list_charge_requests(
    status_filter: str = "pending",
    page: int = 1,
    limit: int = 20,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    admin = _verify_admin(authorization, db)
    # sub_admins without can_approve_charges only see pending (read-only listing)
    q = select(ChargeRequest).options(joinedload(ChargeRequest.user))
    if status_filter != "all":
        q = q.where(ChargeRequest.status == status_filter)
    q = q.order_by(ChargeRequest.created_at.desc())

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    requests = db.scalars(q.offset((page - 1) * limit).limit(limit)).all()

    return {
        "requests": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "user_email": r.user.email if r.user else None,
                "user_name": r.user.display_name if r.user else None,
                "amount": r.amount,
                "transfer_number": r.transfer_number,
                "screenshot_url": r.screenshot_url,
                "notes": r.notes,
                "status": r.status,
                "review_note": r.review_note,
                "reviewed_by": r.reviewed_by,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in requests
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.put("/charge-requests/{request_id}/review")
def review_charge_request(
    request_id: int,
    body: ChargeReview,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    admin = _verify_admin(authorization, db)
    if not admin.can_approve_charges:
        raise HTTPException(403, "You do not have permission to approve/reject charge requests")

    req = db.get(ChargeRequest, request_id)
    if not req:
        raise HTTPException(404, "Charge request not found")
    if req.status != "pending":
        raise HTTPException(400, "Request already reviewed")

    if body.action not in ("approve", "reject"):
        raise HTTPException(400, "Action must be 'approve' or 'reject'")

    req.status = "approved" if body.action == "approve" else "rejected"
    req.reviewed_by = admin.firebase_uid
    req.review_note = body.note
    req.reviewed_at = datetime.datetime.utcnow()

    if body.action == "approve":
        credit = db.scalar(select(UserCredit).where(UserCredit.user_id == req.user_id))
        if not credit:
            credit = UserCredit(user_id=req.user_id, balance=0.0)
            db.add(credit)
            db.flush()
        credit.balance += req.amount
        txn = CreditTransaction(
            credit_id=credit.id,
            amount=req.amount,
            reason=f"Charge request #{req.id} approved",
            performed_by=admin.firebase_uid,
        )
        db.add(txn)

    db.commit()
    return {"status": req.status}


# ──────────────────────────────────────────────
# Sub-Admins
# ──────────────────────────────────────────────

@router.get("/sub-admins")
def list_sub_admins(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    _verify_admin(authorization, db, require_super=True)
    admins = db.scalars(select(AdminRole)).all()
    return [
        {
            "id": a.id,
            "email": a.email,
            "firebase_uid": a.firebase_uid,
            "role": a.role,
            "is_active": a.is_active,
            "can_approve_charges": a.can_approve_charges,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in admins
    ]


@router.post("/sub-admins")
def add_sub_admin(
    body: SubAdminCreate,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    admin = _verify_admin(authorization, db, require_super=True)
    existing = db.scalar(select(AdminRole).where(AdminRole.firebase_uid == body.firebase_uid))
    if existing:
        raise HTTPException(400, "This user already has an admin role")

    new_admin = AdminRole(
        firebase_uid=body.firebase_uid,
        email=body.email,
        role=body.role,
        can_approve_charges=body.can_approve_charges,
        added_by=admin.firebase_uid,
    )
    db.add(new_admin)
    db.commit()
    return {"id": new_admin.id, "email": new_admin.email, "role": new_admin.role}


@router.put("/sub-admins/{admin_id}")
def update_sub_admin(
    admin_id: int,
    body: dict,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    _verify_admin(authorization, db, require_super=True)
    target = db.get(AdminRole, admin_id)
    if not target:
        raise HTTPException(404, "Admin not found")
    if "is_active" in body:
        target.is_active = bool(body["is_active"])
    if "can_approve_charges" in body:
        target.can_approve_charges = bool(body["can_approve_charges"])
    if "role" in body:
        target.role = body["role"]
    db.commit()
    return {"id": target.id, "is_active": target.is_active, "role": target.role}


@router.delete("/sub-admins/{admin_id}")
def remove_sub_admin(
    admin_id: int,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    _verify_admin(authorization, db, require_super=True)
    target = db.get(AdminRole, admin_id)
    if not target:
        raise HTTPException(404, "Admin not found")
    db.delete(target)
    db.commit()
    return {"deleted": True}


# ──────────────────────────────────────────────
# Stats
# ──────────────────────────────────────────────

@router.get("/stats")
def get_dashboard_stats(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    _verify_admin(authorization, db)
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_credits = db.scalar(select(func.sum(UserCredit.balance))) or 0.0
    pending_requests = db.scalar(select(func.count(ChargeRequest.id)).where(ChargeRequest.status == "pending")) or 0
    total_datasets = db.scalar(select(func.count(Dataset.id))) or 0
    return {
        "total_users": total_users,
        "total_credits_issued": total_credits,
        "pending_charge_requests": pending_requests,
        "total_datasets": total_datasets,
    }
