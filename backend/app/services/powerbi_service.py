from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import settings


PBI_SCOPE = "https://analysis.windows.net/powerbi/api/.default"
PBI_API_BASE = "https://api.powerbi.com/v1.0/myorg"


@dataclass
class PowerBIPublishResult:
    dataset_id: str
    report_id: str | None
    report_url: str


class PowerBIService:
    async def _access_token(self) -> str:
        if not settings.POWERBI_ENABLED:
            raise HTTPException(status_code=400, detail="Power BI integration is disabled.")
        required = [
            settings.POWERBI_TENANT_ID,
            settings.POWERBI_CLIENT_ID,
            settings.POWERBI_CLIENT_SECRET,
            settings.POWERBI_WORKSPACE_ID,
        ]
        if any(not v for v in required):
            raise HTTPException(status_code=500, detail="Power BI environment variables are incomplete.")

        token_url = f"https://login.microsoftonline.com/{settings.POWERBI_TENANT_ID}/oauth2/v2.0/token"
        form = {
            "grant_type": "client_credentials",
            "client_id": settings.POWERBI_CLIENT_ID,
            "client_secret": settings.POWERBI_CLIENT_SECRET,
            "scope": PBI_SCOPE,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(token_url, data=form)
            if res.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Power BI auth failed: {res.text}")
            return res.json().get("access_token", "")

    @staticmethod
    def _column_type(col_type: str) -> str:
        if col_type == "numeric":
            return "Double"
        if col_type == "date":
            return "DateTime"
        return "string"

    async def publish_rows(
        self,
        dataset_name: str,
        columns: list[dict[str, Any]],
        rows: list[dict[str, Any]],
    ) -> PowerBIPublishResult:
        token = await self._access_token()
        workspace = settings.POWERBI_WORKSPACE_ID
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        table_name = "Fact"
        dataset_payload = {
            "name": dataset_name[:90],
            "defaultMode": "Push",
            "tables": [
                {
                    "name": table_name,
                    "columns": [
                        {
                            "name": c.get("name"),
                            "dataType": self._column_type(str(c.get("type", "text"))),
                        }
                        for c in columns
                    ],
                }
            ],
        }

        async with httpx.AsyncClient(timeout=45) as client:
            ds_res = await client.post(
                f"{PBI_API_BASE}/groups/{workspace}/datasets",
                headers=headers,
                json=dataset_payload,
            )
            if ds_res.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Create dataset failed: {ds_res.text}")
            dataset_id = ds_res.json().get("id")
            if not dataset_id:
                raise HTTPException(status_code=502, detail="Power BI dataset ID missing.")

            # Push rows in safe chunks
            chunk = 10000
            for i in range(0, len(rows), chunk):
                part = rows[i : i + chunk]
                push_res = await client.post(
                    f"{PBI_API_BASE}/groups/{workspace}/datasets/{dataset_id}/tables/{table_name}/rows",
                    headers=headers,
                    json={"rows": part},
                )
                if push_res.status_code >= 400:
                    raise HTTPException(status_code=502, detail=f"Push rows failed: {push_res.text}")

            report_id: str | None = None
            report_url = f"https://app.powerbi.com/groups/{workspace}/datasets/{dataset_id}/details"

            template_id = settings.POWERBI_REPORT_TEMPLATE_ID.strip()
            if template_id:
                clone_name = f"{dataset_name[:70]} Report"
                clone_res = await client.post(
                    f"{PBI_API_BASE}/groups/{workspace}/reports/{template_id}/Clone",
                    headers=headers,
                    json={"name": clone_name},
                )
                if clone_res.status_code < 400:
                    cloned = clone_res.json()
                    report_id = cloned.get("id")
                    # Rebind cloned report to the new dataset
                    if report_id:
                        await client.post(
                            f"{PBI_API_BASE}/groups/{workspace}/reports/{report_id}/Rebind",
                            headers=headers,
                            json={"datasetId": dataset_id},
                        )
                        report_url = cloned.get("webUrl") or f"https://app.powerbi.com/groups/{workspace}/reports/{report_id}"

            return PowerBIPublishResult(dataset_id=dataset_id, report_id=report_id, report_url=report_url)


powerbi_service = PowerBIService()

