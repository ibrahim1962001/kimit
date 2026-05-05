"""
file_processor.py — Celery task for async large-file processing.

Flow:
  1. Frontend uploads large file → Backend saves it to MinIO, returns a job_id immediately.
  2. This Celery task picks it up, processes with Polars/Pandas, and stores the result in Redis.
  3. Frontend polls GET /api/upload/status/{job_id} to get progress + final result.
"""
import io
import json
import logging
import numpy as np
import pandas as pd

from app.workers.celery_app import celery_app
from app.utils import minio_client

logger = logging.getLogger(__name__)

# ── Shared result helpers (stored in Redis via Celery backend) ─────────────────

def _build_result(df: pd.DataFrame, filename: str, dataset_id: int, object_name: str) -> dict:
    """Build the standard upload result payload from a processed DataFrame."""
    from app.main import detect_anomalies, get_correlations, generate_chart_config

    df.columns = df.columns.str.strip()
    df = df.replace([np.inf, -np.inf], np.nan)
    duplicates = int(df.duplicated().sum())

    return {
        "status": "done",
        "progress": 100,
        "datasetId": dataset_id,
        "filename": filename,
        "columns": df.columns.tolist(),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "shape": list(df.shape),
        "nullCounts": df.isnull().sum().to_dict(),
        "duplicates": duplicates,
        "preview": df.head(10).to_dict(orient="records"),
        "fullData": df.to_dict(orient="records"),
        "charts": generate_chart_config(df),
        "anomalies": detect_anomalies(df),
        "correlations": get_correlations(df),
        "minio_path": object_name,
        "saved_to_storage": True,
    }


# ── Celery Task ────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="app.workers.file_processor.process_large_file")
def process_large_file(self, object_name: str, filename: str, dataset_id: int):
    """
    Background task: reads a file from MinIO, processes it, and stores
    the result in the Celery backend (Redis). The frontend polls for the result.
    """
    try:
        # ── Step 1: Download raw bytes from MinIO ──────────────────────────
        self.update_state(state="PROGRESS", meta={"progress": 10, "status": "Downloading from storage…"})
        result = minio_client.download_file_from_minio(object_name)
        if result is None:
            raise FileNotFoundError(f"File not found in MinIO: {object_name}")
        file_bytes, _ = result

        # ── Step 2: Parse file ─────────────────────────────────────────────
        self.update_state(state="PROGRESS", meta={"progress": 30, "status": "Parsing file…"})
        from app.main import robust_read_file
        df = robust_read_file(file_bytes, filename)

        # ── Step 3: Run analytics ──────────────────────────────────────────
        self.update_state(state="PROGRESS", meta={"progress": 70, "status": "Running analytics…"})
        payload = _build_result(df, filename, dataset_id, object_name)

        # ── Step 4: Store DataFrame in DATA_STORE so other endpoints work ──
        self.update_state(state="PROGRESS", meta={"progress": 90, "status": "Finalizing…"})
        from app.main import DATA_STORE
        df.columns = df.columns.str.strip()
        DATA_STORE[dataset_id] = {
            "df": df,
            "filename": filename,
            "storage_path": object_name,
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "shape": list(df.shape),
            "null_counts": df.isnull().sum().to_dict(),
            "duplicates": int(df.duplicated().sum()),
        }

        return payload

    except Exception as e:
        logger.error(f"[file_processor] Failed for {filename}: {e}")
        # Celery will mark this task as FAILURE automatically
        raise
