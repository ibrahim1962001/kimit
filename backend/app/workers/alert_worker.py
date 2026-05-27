"""
alert_worker.py — periodic scan for datasets with high null rates or duplicate ratios.
"""
import logging

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import _sync_database_url
from app.models.dataset import Dataset
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _check_dataset_health(ds: Dataset) -> list[str]:
    """Return human-readable alert messages for a dataset."""
    alerts: list[str] = []
    nulls = ds.null_counts or {}
    total_cells = max(ds.row_count * max(ds.col_count, 1), 1)
    null_total = sum(int(v) for v in nulls.values() if v)
    null_pct = (null_total / total_cells) * 100
    if null_pct > 20:
        alerts.append(f"Dataset #{ds.id} ({ds.filename}): {null_pct:.1f}% missing values")
    if ds.row_count > 0 and ds.col_count > 0:
        dup_estimate = nulls.get("__duplicates__", 0)  # optional future field
        if dup_estimate and int(dup_estimate) > ds.row_count * 0.1:
            alerts.append(f"Dataset #{ds.id}: high duplicate count")
    return alerts


@celery_app.task(name="app.workers.alert_worker.scan_all_alerts")
def scan_all_alerts() -> dict:
    """Scan recent datasets and log health warnings."""
    engine = create_engine(_sync_database_url(settings.DATABASE_URL), pool_pre_ping=True)
    all_alerts: list[str] = []
    scanned = 0
    try:
        with Session(engine) as db:
            datasets = db.scalars(
                select(Dataset).order_by(Dataset.created_at.desc()).limit(100)
            ).all()
            for ds in datasets:
                scanned += 1
                all_alerts.extend(_check_dataset_health(ds))
    except Exception as exc:
        logger.error("Alert scan failed: %s", exc)
        return {"status": "error", "message": str(exc), "scanned": scanned}
    finally:
        engine.dispose()

    for msg in all_alerts:
        logger.warning("DATA_ALERT: %s", msg)

    return {"status": "ok", "scanned": scanned, "alerts": len(all_alerts), "messages": all_alerts[:20]}
