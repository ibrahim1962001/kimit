"""
alert_worker.py
Celery task that scans all active alert rules for anomalies.
Stub — full logic added in Milestone 4.
"""
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.alert_worker.scan_all_alerts")
def scan_all_alerts() -> dict:
    """
    Iterate user alert rules, run anomaly checks on latest datasets,
    and dispatch notifications if thresholds are breached.
    Full implementation: Milestone 4.
    """
    # TODO: query DB for active alert_rules, load datasets, check thresholds
    return {"status": "ok", "scanned": 0}
