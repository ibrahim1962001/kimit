"""
dataset_service.py
All business logic for file parsing, cleaning, anomaly detection,
chart generation, and dataset persistence.
Extracted from main.py — routers must NOT duplicate any of this logic.
"""
import io
import json
from typing import Any

import chardet
import charset_normalizer
import numpy as np
import pandas as pd
import polars as pl
from pyxlsb import open_workbook
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.dataset import Dataset

# ── In-memory DataFrame store (replaced by DB in Milestone 2) ──────────────
# Key: dataset DB id (str), Value: pd.DataFrame
_DATA_STORE: dict[str, pd.DataFrame] = {}


# ── File Parsing ───────────────────────────────────────────────────────────

def _robust_read_file(content: bytes, filename: str) -> pd.DataFrame:
    """Multi-engine file reader supporting CSV, XLSX, XLS, XLSB."""
    ext = filename.lower().rsplit(".", 1)[-1]
    encodings = [
        "utf-8-sig", "utf-8", "utf-16", "cp1256",
        "windows-1256", "iso-8859-6", "latin1", "cp1252",
    ]

    if ext == "csv":
        try:
            df = pl.read_csv(io.BytesIO(content), infer_schema_length=10000).to_pandas()
            if not df.empty:
                return df
        except Exception:
            pass

        for enc in encodings:
            try:
                df = pd.read_csv(
                    io.BytesIO(content), encoding=enc,
                    encoding_errors="replace", on_bad_lines="skip",
                    low_memory=False,
                )
                if not df.empty:
                    return df
            except Exception:
                continue

    elif ext in ("xlsx", "xls"):
        for engine in ("openpyxl", "xlrd", None):
            try:
                df = pd.read_excel(io.BytesIO(content), engine=engine)
                if not df.empty:
                    return df
            except Exception:
                continue

        try:
            with open_workbook(io.BytesIO(content)) as wb:
                sheet = wb.sheets()[0]
                data = [list(row) for row in sheet.rows()]
                df = pd.DataFrame(data[1:], columns=data[0])
                if not df.empty:
                    return df
        except Exception:
            pass

    raise HTTPException(
        status_code=400,
        detail=f"Cannot read file '{filename}'. Ensure it is a valid CSV or Excel file.",
    )


# ── Analytics helpers ──────────────────────────────────────────────────────

def _detect_anomalies(df: pd.DataFrame) -> list[dict]:
    anomalies: list[dict] = []
    for col in df.select_dtypes(include=[np.number]).columns:
        if df[col].notna().sum() > 5:
            std = df[col].std()
            if std > 0:
                z = (df[col] - df[col].mean()).abs() / std
                count = int((z > 3).sum())
                if count:
                    anomalies.append({
                        "column": col,
                        "count": count,
                        "severity": "high" if count > len(df) * 0.05 else "medium",
                        "description": f"Found {count} extreme values in '{col}'",
                    })
    return anomalies


def _get_correlations(df: pd.DataFrame) -> list[dict]:
    result: list[dict] = []
    num = df.select_dtypes(include=[np.number])
    if len(num.columns) >= 2:
        corr = num.corr()
        cols = corr.columns.tolist()
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                val = float(corr.iloc[i, j])
                if abs(val) > 0.7:
                    result.append({
                        "col1": cols[i], "col2": cols[j],
                        "value": val,
                        "strength": "Strong Positive" if val > 0 else "Strong Negative",
                    })
    return result


def _generate_charts(df: pd.DataFrame) -> list[dict]:
    charts: list[dict] = []
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    name_kws = ["name", "customer", "id", "email", "phone", "اسم", "عميل"]
    chart_id = 0

    def _is_pie(col: str, uniq: int) -> bool:
        return uniq <= 6 and not any(k in col.lower() for k in name_kws)

    for col in num_cols[:2]:
        if df[col].notna().sum() > 0:
            charts.append({
                "id": chart_id, "type": "line", "title": f"{col} Trend",
                "data": [{"name": str(i), "value": float(v) if pd.notna(v) else 0}
                         for i, v in enumerate(df[col].head(30))],
            })
            chart_id += 1

    for col in cat_cols:
        uniq = df[col].nunique()
        if uniq == 0:
            continue
        vc = df[col].value_counts()
        if _is_pie(col, uniq):
            charts.append({
                "id": chart_id, "type": "pie", "title": f"{col} Distribution",
                "data": [{"name": str(k)[:15], "value": int(v)} for k, v in vc.head(6).items()],
            })
        else:
            charts.append({
                "id": chart_id, "type": "bar", "title": f"Top {col}",
                "data": [{"name": str(k)[:20], "value": int(v)} for k, v in vc.head(10).items()],
            })
        chart_id += 1
        if len(charts) >= 4:
            break

    return charts[:4]


def _get_ai_summary(df: pd.DataFrame) -> str:
    """Build a compact text summary of the DataFrame for the AI prompt."""
    lines = [f"Rows: {len(df)}, Columns: {len(df.columns)}", "Columns:"]
    for col in df.columns:
        lines.append(f"  - {col}: {df[col].dtype} ({df[col].nunique()} unique)")
    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if not missing.empty:
        lines.append("Missing values:")
        for col, cnt in missing.items():
            lines.append(f"  - {col}: {cnt} ({cnt / len(df) * 100:.1f}%)")
    return "\n".join(lines)


# ── Public service methods ─────────────────────────────────────────────────

class DatasetService:

    async def process_upload(
        self,
        content: bytes,
        filename: str,
        user_id: int,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Parse file, persist metadata to DB, return analysis payload."""
        df = _robust_read_file(content, filename)
        df.columns = df.columns.str.strip()
        df.replace([np.inf, -np.inf], np.nan, inplace=True)

        dataset = Dataset(
            user_id=user_id,
            filename=filename,
            row_count=len(df),
            col_count=len(df.columns),
            columns=df.columns.tolist(),
            dtypes=df.dtypes.astype(str).to_dict(),
            null_counts=df.isnull().sum().to_dict(),
            source="upload",
        )
        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)

        # Store DataFrame in memory keyed by DB id
        _DATA_STORE[str(dataset.id)] = df

        return {
            "datasetId": dataset.id,
            "filename": filename,
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "shape": list(df.shape),
            "nullCounts": df.isnull().sum().to_dict(),
            "duplicates": int(df.duplicated().sum()),
            "preview": df.head(10).to_dict(orient="records"),
            "charts": _generate_charts(df),
            "anomalies": _detect_anomalies(df),
            "correlations": _get_correlations(df),
        }

    async def clean_dataset(
        self,
        dataset_id: int,
        user_id: int,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Impute nulls + drop duplicates, persist changes."""
        df = self._get_df(dataset_id, user_id)
        original_nulls = int(df.isnull().sum().sum())
        original_dupes = int(df.duplicated().sum())

        for col in df.select_dtypes(include=[np.number]).columns:
            if df[col].isnull().any():
                df[col].fillna(df[col].median(), inplace=True)

        for col in df.select_dtypes(include=["object", "category"]).columns:
            if df[col].isnull().any():
                mode = df[col].mode()
                df[col].fillna(mode[0] if not mode.empty else "Unknown", inplace=True)

        df.drop_duplicates(inplace=True)
        _DATA_STORE[str(dataset_id)] = df

        # Update DB metadata
        result = await db.execute(
            select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
        )
        dataset = result.scalar_one_or_none()
        if dataset:
            dataset.row_count = len(df)
            dataset.null_counts = df.isnull().sum().to_dict()
            await db.commit()

        return {
            "cleaned": True,
            "removedNulls": original_nulls,
            "removedDuplicates": original_dupes,
            "newShape": list(df.shape),
            "nullCounts": df.isnull().sum().to_dict(),
            "preview": df.head(10).to_dict(orient="records"),
        }

    def get_summary_for_ai(self, dataset_id: int, user_id: int) -> str:
        return _get_ai_summary(self._get_df(dataset_id, user_id))

    def get_dataframe(self, dataset_id: int, user_id: int) -> pd.DataFrame:
        return self._get_df(dataset_id, user_id)

    def _get_df(self, dataset_id: int, user_id: int) -> pd.DataFrame:
        """Retrieve DataFrame; raises 404 if not found."""
        df = _DATA_STORE.get(str(dataset_id))
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found. Please upload first.")
        return df


dataset_service = DatasetService()
