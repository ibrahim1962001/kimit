from celery import Celery
from app.config import settings

celery_app = Celery(
    "kimit",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.alert_worker"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Beat schedule — runs anomaly checks every 30 minutes
    beat_schedule={
        "scan-alerts-every-30-min": {
            "task": "app.workers.alert_worker.scan_all_alerts",
            "schedule": 1800.0,
        }
    },
)
