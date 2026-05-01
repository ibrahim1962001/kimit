import logging
import io
from datetime import datetime
from minio import Minio
from minio.error import S3Error
import os

logger = logging.getLogger("uvicorn.error")

MINIO_ENDPOINT   = os.getenv("MINIO_ENDPOINT",    "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY",  "kimit_admin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY",  "kimit_storage_secret")
MINIO_BUCKET     = os.getenv("MINIO_BUCKET",       "datasets")
MINIO_SECURE     = os.getenv("MINIO_SECURE", "False").lower() == "true"

# Content-type mapping by file extension
CONTENT_TYPES: dict[str, str] = {
    ".csv":  "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls":  "application/vnd.ms-excel",
}


def get_minio_client() -> Minio | None:
    """Return a configured Minio client, or None if connection fails (graceful)."""
    try:
        client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
        # Verify connectivity by checking if bucket exists
        client.bucket_exists(MINIO_BUCKET)
        return client
    except Exception as e:
        logger.warning(f"[MinIO] Client init failed: {e}")
        return None


def _ensure_bucket(client: Minio) -> None:
    """Create bucket if it doesn't exist yet."""
    try:
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
            logger.info(f"[MinIO] Bucket '{MINIO_BUCKET}' created.")
    except Exception as e:
        logger.warning(f"[MinIO] _ensure_bucket failed: {e}")


def build_object_name(filename: str, user_id: str | None = None) -> str:
    """
    Build the MinIO storage path.
    - Authenticated: user_uploads/{user_id}/{timestamp}_{filename}
    - Guest:         user_uploads/guest/{timestamp}_{filename}
    """
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    folder = f"user_uploads/{user_id}" if user_id else "user_uploads/guest"
    return f"{folder}/{ts}_{filename}"


def upload_file_to_minio(
    file_bytes: bytes,
    object_name: str,
    content_type: str = "application/octet-stream",
) -> bool:
    """
    Upload raw bytes to MinIO.
    Returns True on success, False on failure — never raises.
    """
    client = get_minio_client()
    if client is None:
        logger.warning("[MinIO] Upload skipped — client unavailable.")
        return False
    try:
        _ensure_bucket(client)
        client.put_object(
            MINIO_BUCKET,
            object_name,
            io.BytesIO(file_bytes),
            length=len(file_bytes),
            content_type=content_type,
        )
        logger.info(f"[MinIO] Uploaded: {object_name} ({len(file_bytes)} bytes)")
        return True
    except S3Error as e:
        logger.warning(f"[MinIO] Upload failed for '{object_name}': {e}")
        return False
    except Exception as e:
        logger.warning(f"[MinIO] Unexpected upload error: {e}")
        return False


def list_uploaded_files(prefix: str = "user_uploads/") -> list[dict]:
    """
    Return list of objects under the given prefix.
    Each item: { object_name, filename, size_bytes, size_display, last_modified, download_url }
    """
    client = get_minio_client()
    if client is None:
        return []
    try:
        _ensure_bucket(client)
        objects = client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True)
        results = []
        for obj in objects:
            name = obj.object_name or ""
            filename = name.split("/")[-1]
            # Strip timestamp prefix from display name  e.g. "20250501_123456_sales.csv" → "sales.csv"
            parts = filename.split("_", 2)
            display_name = parts[2] if len(parts) == 3 else filename

            size_bytes = obj.size or 0
            if size_bytes >= 1024 * 1024:
                size_display = f"{size_bytes / (1024*1024):.1f} MB"
            else:
                size_display = f"{size_bytes / 1024:.1f} KB"

            last_mod = obj.last_modified
            last_modified_str = last_mod.strftime("%d/%m/%Y %H:%M") if last_mod else ""

            from urllib.parse import quote
            results.append({
                "object_name":   name,
                "filename":      display_name,
                "size_bytes":    size_bytes,
                "size_display":  size_display,
                "last_modified": last_modified_str,
                "download_url":  f"/api/files/download/{quote(name, safe='')}",
            })
        return results
    except Exception as e:
        logger.warning(f"[MinIO] list_uploaded_files error: {e}")
        return []


def download_file_from_minio(object_name: str) -> tuple[bytes, str] | None:
    """
    Stream file bytes from MinIO.
    Returns (file_bytes, content_type) or None if not found.
    """
    client = get_minio_client()
    if client is None:
        return None
    try:
        response = client.get_object(MINIO_BUCKET, object_name)
        file_bytes = response.read()
        response.close()
        response.release_conn()

        ext = "." + object_name.rsplit(".", 1)[-1].lower() if "." in object_name else ""
        content_type = CONTENT_TYPES.get(ext, "application/octet-stream")
        return file_bytes, content_type
    except S3Error as e:
        logger.warning(f"[MinIO] Download failed for '{object_name}': {e}")
        return None
    except Exception as e:
        logger.warning(f"[MinIO] Unexpected download error: {e}")
        return None
