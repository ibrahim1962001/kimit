"""
dataset_router.py
HTTP concerns only: request parsing, auth, response shaping.
All logic delegated to DatasetService and ChatService.
"""
import io
import uuid

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.services.dataset_service import dataset_service
from app.services.chat_service import chat_service
from app.services.user_service import user_service
from app.services.sheets_service import sheets_service

router = APIRouter(prefix="/api", tags=["Datasets"])


async def _resolve_user(claims: dict, db: AsyncSession) -> int:
    """Helper: get internal user PK from Firebase claims."""
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
    return await dataset_service.process_upload(contents, file.filename, user_id, db)


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
    return await sheets_service.import_sheet(url, user_id, db)


@router.post("/clean")
async def clean_data(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    dataset_id = int(request.get("datasetId", 0))
    return await dataset_service.clean_dataset(dataset_id, user_id, db)


@router.post("/ai/summary")
async def get_ai_summary(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    dataset_id = int(request.get("datasetId", 0))
    language = request.get("language", "en")
    summary = dataset_service.get_summary_for_ai(dataset_id, user_id)
    return await chat_service.get_ai_summary(summary, language, user_id, dataset_id, db)


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
    summary = dataset_service.get_summary_for_ai(dataset_id, user_id)
    return await chat_service.chat(
        question, summary, language, user_id, dataset_id, session_id, db
    )


@router.get("/ai/history/{session_id}")
async def get_chat_history(
    session_id: str,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    return await chat_service.get_history(session_id, user_id, db)


@router.post("/export")
async def export_data(
    request: dict,
    claims: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = await _resolve_user(claims, db)
    dataset_id = int(request.get("datasetId", 0))
    fmt = request.get("format", "csv")
    df = dataset_service.get_dataframe(dataset_id, user_id)
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
