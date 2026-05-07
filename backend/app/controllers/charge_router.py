"""
User-facing charge request endpoints — anyone can submit a top-up request.
"""
from __future__ import annotations

import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import ChargeRequest, User

router = APIRouter(prefix="/api/charge-requests", tags=["charge-requests"])


def _get_user_by_uid(uid: str, db: Session) -> User:
    user = db.scalar(select(User).where(User.firebase_uid == uid))
    if not user:
        raise HTTPException(404, "User not found — please log in first")
    return user


@router.post("")
async def submit_charge_request(
    amount: float = Form(...),
    transfer_number: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    screenshot: UploadFile | None = File(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    """User submits a manual top-up request with optional screenshot."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    uid = authorization.split(" ", 1)[1]

    # Verify with Firebase if SDK available
    try:
        from firebase_admin import auth as fb_auth
        decoded = fb_auth.verify_id_token(uid)
        uid = decoded["uid"]
    except Exception:
        pass  # Dev mode — uid is the raw token

    user = _get_user_by_uid(uid, db)

    screenshot_url: str | None = None
    if screenshot and screenshot.filename:
        try:
            from app.utils.storage import storage_manager
            content = await screenshot.read()
            path = f"charge_screenshots/{user.id}/{datetime.datetime.utcnow().timestamp()}_{screenshot.filename}"
            screenshot_url = await storage_manager.upload_bytes(content, path, screenshot.content_type or "image/jpeg")
        except Exception as e:
            # Store without screenshot if storage fails
            print(f"Screenshot upload failed: {e}")

    req = ChargeRequest(
        user_id=user.id,
        amount=amount,
        transfer_number=transfer_number,
        screenshot_url=screenshot_url,
        notes=notes,
    )
    db.add(req)
    db.commit()
    return {
        "id": req.id,
        "status": req.status,
        "amount": req.amount,
        "message": "Your request has been submitted and is pending review.",
    }


@router.get("/my")
def get_my_requests(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Any:
    """Authenticated user gets their own charge request history."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    uid = authorization.split(" ", 1)[1]
    try:
        from firebase_admin import auth as fb_auth
        decoded = fb_auth.verify_id_token(uid)
        uid = decoded["uid"]
    except Exception:
        pass

    user = _get_user_by_uid(uid, db)
    requests = db.scalars(
        select(ChargeRequest).where(ChargeRequest.user_id == user.id).order_by(ChargeRequest.created_at.desc())
    ).all()
    return [
        {
            "id": r.id, "amount": r.amount, "status": r.status,
            "transfer_number": r.transfer_number,
            "review_note": r.review_note,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in requests
    ]
