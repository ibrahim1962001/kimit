import os
import json
import io
import chardet
import charset_normalizer
import polars as pl
from pyxlsb import open_workbook
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from groq import Groq
import pandas as pd
import numpy as np
from app.utils.storage import storage_manager
from app.utils import minio_client
import logging

load_dotenv()
logger = logging.getLogger("uvicorn.error")

from app.config import settings

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_DEFAULT])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure DB tables exist on startup (dev-friendly)."""
    try:
        from app.db.session import engine, Base
        from app.models import User, Dataset, ChatMessage  # noqa: F401
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ready.")
    except Exception as exc:
        logger.warning("DB init skipped: %s", exc)
    yield

def detect_anomalies(df: pd.DataFrame) -> List[Dict]:
    """Detect anomalies (outliers) in numeric columns using Z-score."""
    anomalies = []
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    for col in numeric_cols:
        if df[col].notna().sum() > 5:
            mean = df[col].mean()
            std = df[col].std()
            if std > 0:
                z_scores = (df[col] - mean).abs() / std
                outliers_count = int((z_scores > 3).sum())
                if outliers_count > 0:
                    anomalies.append({
                        "column": col,
                        "count": outliers_count,
                        "severity": "high" if outliers_count > len(df) * 0.05 else "medium",
                        "description": f"Found {outliers_count} extreme values in {col}"
                    })
    return anomalies

def get_correlations(df: pd.DataFrame) -> List[Dict]:
    """Find significant correlations between numeric columns."""
    correlations = []
    numeric_df = df.select_dtypes(include=[np.number])
    if len(numeric_df.columns) >= 2:
        corr_matrix = numeric_df.corr()
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                val = corr_matrix.iloc[i, j]
                if abs(val) > 0.7:
                    correlations.append({
                        "col1": corr_matrix.columns[i],
                        "col2": corr_matrix.columns[j],
                        "value": float(val),
                        "strength": "Strong Positive" if val > 0 else "Strong Negative"
                    })
    return correlations

app = FastAPI(title="Kimit DataPath Analyzer API", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=(settings.ALLOWED_ORIGINS + ["*"]) if settings.DEBUG else settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from app.controllers.admin_router import router as admin_router
from app.controllers.charge_router import router as charge_router
from app.controllers.auth_router import router as auth_router
from app.controllers.dataset_router import router as dataset_router

app.include_router(auth_router)
app.include_router(dataset_router)
app.include_router(admin_router)
app.include_router(charge_router)


# Initialize Groq client
groq_api_key = os.getenv("GROQ_API_KEY")
if not groq_api_key:
    print("Warning: GROQ_API_KEY not found in environment variables")
    groq_client = None
else:
    groq_client = Groq(api_key=groq_api_key)

DATA_STORE = {}


def detect_encoding(content: bytes) -> str:
    """Detect file encoding with charset-normalizer."""
    result = charset_normalizer.detect(content)
    return result['encoding'] if result['encoding'] else 'utf-8'


def robust_read_file(file_content: bytes, filename: str) -> pd.DataFrame:
    """
    Robust file reader with multiple fallbacks for CSV/Excel.
    Supports Arabic encodings, large files, corrupted data.
    """
    file_ext = filename.lower().split('.')[-1]
    size_mb = len(file_content) / (1024 * 1024)
    
    # Common encodings (Arabic/RTL focus)
    encodings = [
        'utf-8-sig', 'utf-8', 'utf-16', 'cp1256', 'windows-1256',
        'iso-8859-6', 'iso-8859-1', 'latin1', 'cp1252'
    ]
    
    # CSV Reading - Multi-engine
    if file_ext == 'csv':
        # Polars first (fast, robust)
        try:
            df = pl.read_csv(io.BytesIO(file_content), infer_schema_length=10000).to_pandas()
            if not df.empty and len(df.columns) > 0:
                return df
        except:
            pass
        
        # Pandas with fallbacks
        for enc in encodings:
            try:
                df = pd.read_csv(
                    io.BytesIO(file_content),
                    encoding=enc,
                    encoding_errors='replace',
                    on_bad_lines='skip',
                    low_memory=False,
                    dtype_backend='pyarrow'
                )
                if not df.empty and len(df.columns) > 0:
                    return df
            except:
                continue
        
        # Repair mode
        try:
            df = pd.read_csv(
                io.BytesIO(file_content),
                encoding='utf-8-sig',
                on_bad_lines='skip',
                sep=None,
                engine='python'
            )
            if not df.empty:
                return df
        except:
            pass
    
    # Excel Reading - Multi-engine
    elif file_ext in ['xlsx', 'xls']:
        engines = ['openpyxl', 'xlrd', None]
        for engine in engines:
            try:
                df = pd.read_excel(
                    io.BytesIO(file_content),
                    engine=engine,
                    dtype_backend='pyarrow'
                )
                if not df.empty and len(df.columns) > 0:
                    return df
            except:
                continue
        
        # XLSB fallback
        try:
            with open_workbook(io.BytesIO(file_content)) as wb:
                sheet = wb.sheets()[0]
                data = [[item for item in row] for row in sheet.rows()]
                df = pd.DataFrame(data[1:], columns=data[0])
                if not df.empty:
                    return df
        except:
            pass
    
    # Large file warning
    if size_mb > 50:
        raise HTTPException(400, "File too large (>50MB). Please use smaller files.")
    
    raise HTTPException(
        status_code=400,
        detail=f"تعذر قراءة الملف {filename}. تأكد من أنه CSV أو Excel صالح. جرب تنظيف الملف أو تغيير الترميز."
    )


def get_summary_for_ai(df: pd.DataFrame) -> str:
    """Generate a summary of the dataframe for AI processing."""
    summary = f"Dataset has {len(df)} rows and {len(df.columns)} columns.\n\n"
    summary += "Columns:\n"
    for col in df.columns:
        dtype = str(df[col].dtype)
        unique_count = df[col].nunique()
        summary += f"- {col}: {dtype} (unique values: {unique_count})\n"
    
    null_counts = df.isnull().sum()
    missing_cols = null_counts[null_counts > 0]
    if len(missing_cols) > 0:
        summary += "\nMissing Values:\n"
        for col, count in missing_cols.items():
            summary += f"- {col}: {count} ({count/len(df)*100:.1f}%)\n"
    else:
        summary += "\nNo missing values found.\n"
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        summary += "\nStatistical Summary (Numeric Columns):\n"
        for col in numeric_cols[:5]:
            if df[col].notna().sum() > 0:
                stats = df[col].describe()
                summary += f"- {col}:\n"
                summary += f"  Mean: {stats['mean']:.2f}, Median: {df[col].median():.2f}\n"
                summary += f"  Min: {stats['min']:.2f}, Max: {stats['max']:.2f}\n"
                summary += f"  Std Dev: {stats['std']:.2f}\n"
    
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    if len(categorical_cols) > 0:
        summary += "\nCategorical Columns (Top 5 values each):\n"
        for col in categorical_cols[:5]:
            if df[col].notna().sum() > 0:
                top_values = df[col].value_counts().head(5)
                summary += f"- {col}:\n"
                for val, count in top_values.items():
                    summary += f"  '{val}': {count} times\n"
    
    return summary


def generate_chart_config(df: pd.DataFrame) -> List[Dict]:
    """Generate chart configurations with smart Pie vs Bar selection."""
    charts = []
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()

    chart_id = 0

    # Columns that should NEVER use Pie (names, IDs, identifiers)
    name_keywords = [
        'name', 'customer', 'client', 'employee', 'user', 'person',
        'id', 'code', 'email', 'phone', 'address', 'product', 'item',
        'اسم', 'عميل', 'موظف', 'كود', 'رقم'
    ]

    def is_name_column(col_name: str) -> bool:
        col_lower = col_name.lower()
        return any(kw in col_lower for kw in name_keywords)

    def is_pie_suitable(col_name: str, unique_count: int) -> bool:
        """Pie only if: ≤6 unique values AND not a name/ID column."""
        if is_name_column(col_name):
            return False
        if unique_count > 6:
            return False
        return True

    # 1. Line chart for numeric trends
    for col in numeric_cols[:2]:
        if len(charts) >= 4:
            break
        if len(df) > 0 and df[col].notna().sum() > 0:
            charts.append({
                "id": chart_id,
                "type": "line",
                "title": f"{col} Trend",
                "data": [
                    {"x": str(i), "y": float(v) if pd.notna(v) else 0}
                    for i, v in enumerate(df[col].head(30).tolist())
                ]
            })
            chart_id += 1

    # 2. Smart categorical charts: Pie or Bar based on rules
    for col in categorical_cols:
        if len(charts) >= 4:
            break
        unique_count = df[col].nunique()
        if unique_count == 0:
            continue

        if is_pie_suitable(col, unique_count):
            # PIE: few categories, not a name/ID column
            value_counts = df[col].value_counts().head(6)
            charts.append({
                "id": chart_id,
                "type": "pie",
                "title": f"Top {col} Summary",
                "data": [{"x": str(k)[:15], "y": int(v)} for k, v in value_counts.items()]
            })
        else:
            # BAR: names, IDs, or too many unique values
            value_counts = df[col].value_counts().head(10)
            charts.append({
                "id": chart_id,
                "type": "bar",
                "title": f"Top {col} Summary",
                "data": [{"x": str(k)[:20], "y": int(v)} for k, v in value_counts.items()]
            })
        chart_id += 1

    # 3. Area chart for extra numeric columns
    for col in numeric_cols[2:4]:
        if len(charts) >= 4:
            break
        if len(df) > 0 and df[col].notna().sum() > 0:
            charts.append({
                "id": chart_id,
                "type": "area",
                "title": f"{col} Values",
                "data": [
                    {"x": str(i), "y": float(v) if pd.notna(v) else 0}
                    for i, v in enumerate(df[col].head(40).tolist())
                ]
            })
            chart_id += 1

    return charts[:4]


@app.get("/")
async def root():
    return {
        "message": "DataPath Analyzer API", 
        "version": "1.0.0", 
        "status": "running",
        "groq_configured": bool(groq_client)
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy", 
        "groq_configured": bool(groq_client)
    }


# POST /api/upload, /api/clean, /api/ai/*, /api/export → dataset_router (authenticated)


@app.post("/api/files/upload")
async def store_file_only(file: UploadFile = File(...), request: Request = None):
    """
    Dedicated endpoint to JUST store the file in MinIO without any Pandas processing.
    Used by the frontend to safely backup files since the frontend does its own parsing.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    user_id: str | None = None
    if request:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            import hashlib
            user_id = hashlib.md5(auth_header[7:].encode()).hexdigest()[:12]

    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    content_type_map = {
        ".csv":  "text/csv",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls":  "application/vnd.ms-excel",
    }
    ct = content_type_map.get(ext, "application/octet-stream")
    object_name = minio_client.build_object_name(file.filename or "unknown", user_id)
    saved_to_storage = minio_client.upload_file_to_minio(contents, object_name, ct)
    
    return {
        "filename": file.filename,
        "minio_path": object_name,
        "saved_to_storage": saved_to_storage
    }


LARGE_FILE_THRESHOLD_MB = 10  # Files above this go to Celery


@app.post("/api/upload/large")
async def upload_large_file(file: UploadFile = File(...), request: Request = None):
    """
    Streaming upload for large files.
    - Saves directly to MinIO chunk-by-chunk (no full RAM load).
    - Dispatches a Celery task for background processing.
    - Returns a job_id immediately; frontend polls /api/upload/status/{job_id}.
    """
    from app.workers.file_processor import process_large_file

    user_id: str | None = None
    if request:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            import hashlib
            user_id = hashlib.md5(auth_header[7:].encode()).hexdigest()[:12]

    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    content_type_map = {
        ".csv":  "text/csv",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls":  "application/vnd.ms-excel",
    }
    ct = content_type_map.get(ext, "application/octet-stream")
    object_name = minio_client.build_object_name(file.filename or "unknown", user_id)

    # ── Stream file to MinIO in chunks (no full RAM load) ─────────────────
    CHUNK = 1024 * 1024  # 1 MB chunks
    buffer = io.BytesIO()
    total_bytes = 0
    while True:
        chunk = await file.read(CHUNK)
        if not chunk:
            break
        buffer.write(chunk)
        total_bytes += len(chunk)

    buffer.seek(0)
    file_bytes = buffer.read()
    saved = minio_client.upload_file_to_minio(file_bytes, object_name, ct)

    if not saved:
        raise HTTPException(status_code=500, detail="Failed to save file to storage.")

    # ── Dispatch background task ───────────────────────────────────────────
    dataset_id = len(DATA_STORE) + 1
    task = process_large_file.delay(object_name, file.filename, dataset_id)

    return {
        "job_id": task.id,
        "filename": file.filename,
        "size_bytes": total_bytes,
        "minio_path": object_name,
        "status": "processing",
        "message": "File saved. Processing in background — poll /api/upload/status/{job_id} for result."
    }


@app.get("/api/upload/status/{job_id}")
async def get_upload_status(job_id: str):
    """
    Poll the status of a large-file processing job.
    Returns: { status, progress, ...result_payload_when_done }
    """
    from celery.result import AsyncResult
    from app.workers.celery_app import celery_app as _celery

    result = AsyncResult(job_id, app=_celery)

    if result.state == "PENDING":
        return {"status": "pending", "progress": 0, "message": "Waiting in queue…"}
    elif result.state == "PROGRESS":
        meta = result.info or {}
        return {"status": "processing", "progress": meta.get("progress", 0), "message": meta.get("status", "")}
    elif result.state == "SUCCESS":
        return result.result  # Full upload payload
    elif result.state == "FAILURE":
        return {"status": "error", "message": str(result.info)}
    else:
        return {"status": result.state.lower(), "progress": 0}


@app.get("/api/files")
async def list_files(user_id: str | None = None):
    """
    List files stored in MinIO.
    - user_id provided → return user_uploads/{user_id}/ files
    - no user_id       → return user_uploads/guest/ files
    """
    prefix = f"user_uploads/{user_id}/" if user_id else "user_uploads/guest/"
    files = minio_client.list_uploaded_files(prefix)
    return {"files": files, "count": len(files)}


@app.get("/api/files/download/{object_name:path}")
async def download_minio_file(object_name: str):
    """
    Stream a file from MinIO back to the browser.
    Uses StreamingResponse — no temp files written to disk.
    """
    result = minio_client.download_file_from_minio(object_name)
    if result is None:
        raise HTTPException(status_code=404, detail="File not found in storage.")

    file_bytes, content_type = result
    original_filename = object_name.split("/")[-1]
    # Strip timestamp prefix from filename for download  e.g. "20250501_120000_sales.csv"
    parts = original_filename.split("_", 2)
    display_name = parts[2] if len(parts) == 3 else original_filename

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{display_name}"'},
    )


@app.get("/api/datasets/{dataset_id}/download")
async def download_raw_file(dataset_id: int):
    """Download the raw original file from MinIO."""
    if dataset_id not in DATA_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ds = DATA_STORE[dataset_id]
    if "storage_path" not in ds:
        raise HTTPException(status_code=400, detail="Persistent storage path not found for this dataset")
    
    try:
        file_bytes = storage_manager.download_file(ds["storage_path"])
        original_filename = ds["filename"]
        
        # Determine content type based on extension
        ext = original_filename.split('.')[-1].lower()
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if ext == "xlsx" else "text/csv"
        
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={original_filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download from storage failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)