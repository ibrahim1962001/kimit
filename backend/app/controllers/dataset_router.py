"""
dataset_router.py — authenticated dataset & AI endpoints.
"""
import io
import uuid

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, get_current_user
from app.services.dataset_service import dataset_service
from app.services.chat_service import chat_service
from app.services.user_service import user_service
from app.services.sheets_service import sheets_service
from app.services.credit_service import credit_service
from app.services.powerbi_service import powerbi_service

router = APIRouter(prefix="/api", tags=["Datasets"])


async def _resolve_user(claims: dict, db: AsyncSession) -> int:
    user = await user_service.get_by_firebase_uid(db, claims["uid"])
    if not user:
        raise HTTPException(status_code=401, detail="User not synced. Call /auth/sync first.")
    return user.id


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    user_id = await _resolve_user(claims, db)
    await credit_service.require_balance(db, user_id, settings.CREDIT_COST_UPLOAD)
    result = await dataset_service.process_upload(contents, file.filename, user_id, db)
    balance = await credit_service.deduct(
        db, user_id, settings.CREDIT_COST_UPLOAD, f"Upload: {file.filename}"
    )
    result["creditBalance"] = balance
    return result


@router.post("/datasets/import-sheets")
async def import_sheets(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    url = request.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Google Sheet URL is required.")
    user_id = await _resolve_user(claims, db)
    await credit_service.require_balance(db, user_id, settings.CREDIT_COST_UPLOAD)
    result = await sheets_service.import_sheet(url, user_id, db)
    balance = await credit_service.deduct(db, user_id, settings.CREDIT_COST_UPLOAD, "Google Sheets import")
    result["creditBalance"] = balance
    return result


@router.post("/clean")
async def clean_data(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    dataset_id = int(request.get("datasetId", 0))
    await credit_service.require_balance(db, user_id, settings.CREDIT_COST_CLEAN)
    result = await dataset_service.clean_dataset(dataset_id, user_id, db)
    result["creditBalance"] = await credit_service.deduct(
        db, user_id, settings.CREDIT_COST_CLEAN, f"Clean dataset #{dataset_id}"
    )
    return result


@router.post("/ai/summary")
async def get_ai_summary(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    dataset_id = int(request.get("datasetId", 0))
    language = request.get("language", "en")
    await credit_service.require_balance(db, user_id, settings.CREDIT_COST_AI_SUMMARY)
    summary = await dataset_service.get_summary_for_ai(dataset_id, user_id, db)
    result = await chat_service.get_ai_summary(summary, language, user_id, dataset_id, db)
    result["creditBalance"] = await credit_service.deduct(
        db, user_id, settings.CREDIT_COST_AI_SUMMARY, f"AI summary dataset #{dataset_id}"
    )
    return result


@router.post("/ai/chat")
async def chat_with_ai(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    dataset_id = int(request.get("datasetId", 0))
    language = request.get("language", "en")
    question = request.get("question", "")
    session_id = request.get("sessionId", str(uuid.uuid4()))
    await credit_service.require_balance(db, user_id, settings.CREDIT_COST_AI_CHAT)
    summary = await dataset_service.get_summary_for_ai(dataset_id, user_id, db)
    result = await chat_service.chat(
        question, summary, language, user_id, dataset_id, session_id, db
    )
    result["creditBalance"] = await credit_service.deduct(
        db, user_id, settings.CREDIT_COST_AI_CHAT, "AI chat message"
    )
    return result


@router.get("/ai/history/{session_id}")
async def get_chat_history(
    session_id: str,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    return await chat_service.get_history(session_id, user_id, db)


@router.get("/credits/balance")
async def get_credit_balance(
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    balance = await credit_service.get_balance(db, user_id)
    credit = await credit_service.ensure_credit(db, user_id)
    user = await user_service.get_by_firebase_uid(db, claims["uid"])
    return {
        "balance": balance,
        "status": credit.status,
        "plan": user.plan if user else "free",
    }


@router.post("/export")
async def export_data(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    dataset_id = int(request.get("datasetId", 0))
    fmt = request.get("format", "csv")
    df = await dataset_service.get_dataframe(dataset_id, user_id, db)
    name = request.get("filename", "export").rsplit(".", 1)[0]

    if fmt == "csv":
        data = df.to_csv(index=False, encoding="utf-8-sig")
        return StreamingResponse(
            io.StringIO(data), media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={name}_cleaned.csv"},
        )
    if fmt == "json":
        data = df.to_json(orient="records", force_ascii=False, indent=2)
        return StreamingResponse(
            io.StringIO(data), media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={name}_cleaned.json"},
        )
    raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'json'.")


@router.post("/powerbi/publish")
async def publish_to_powerbi(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ = await _resolve_user(claims, db)
    dataset_name = (request.get("datasetName") or "Kimit Dataset").strip()
    rows = request.get("rows") or []
    columns = request.get("columns") or []

    if not rows:
        raise HTTPException(status_code=400, detail="No rows provided.")
    if not columns:
        # Best-effort fallback
        columns = [{"name": k, "type": "text"} for k in rows[0].keys()]

    result = await powerbi_service.publish_rows(
        dataset_name=dataset_name,
        columns=columns,
        rows=rows,
    )
    return {
        "ok": True,
        "datasetId": result.dataset_id,
        "reportId": result.report_id,
        "reportUrl": result.report_url,
    }
