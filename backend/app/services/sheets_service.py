import re
import pandas as pd
import numpy as np
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.dataset import Dataset
from app.services.dataset_service import _generate_charts, _detect_anomalies, _get_correlations, _DATA_STORE

class SheetsService:
    def _extract_export_url(self, url: str) -> str:
        """
        Convert a Google Sheets URL to a CSV export URL.
        Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvGdBZjgmUUqptlbs74OgvE2upms/edit
        To: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvGdBZjgmUUqptlbs74OgvE2upms/export?format=csv
        """
        # Match the spreadsheet ID
        match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
        if not match:
            raise HTTPException(status_code=400, detail="Invalid Google Sheets URL.")
        
        spreadsheet_id = match.group(1)
        
        gid_match = re.search(r"[#&]gid=([0-9]+)", url)
        gid_param = f"&gid={gid_match.group(1)}" if gid_match else ""
        
        export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv{gid_param}"
        
        return export_url

    async def import_sheet(self, url: str, user_id: int, db: AsyncSession):
        export_url = self._extract_export_url(url)
        
        try:
            # Read CSV from Google Sheets export URL
            df = pd.read_csv(export_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read Google Sheet: {str(e)}")
            
        if df.empty:
            raise HTTPException(status_code=400, detail="The Google Sheet is empty.")
            
        df.columns = df.columns.str.strip()
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        
        # Save metadata to DB
        dataset = Dataset(
            user_id=user_id,
            filename="Google Sheet Import",
            row_count=len(df),
            col_count=len(df.columns),
            columns=df.columns.tolist(),
            dtypes=df.dtypes.astype(str).to_dict(),
            null_counts=df.isnull().sum().to_dict(),
            source="sheets",
        )
        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)
        
        # Store in memory for immediate analysis
        _DATA_STORE[str(dataset.id)] = df
        
        return {
            "datasetId": dataset.id,
            "filename": dataset.filename,
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "shape": list(df.shape),
            "nullCounts": df.isnull().sum().to_dict(),
            "duplicates": int(df.duplicated().sum()),
            "preview": df.head(10).to_dict(orient="records"),
            "fullData": df.to_dict(orient="records"),
            "charts": _generate_charts(df),
            "anomalies": _detect_anomalies(df),
            "correlations": _get_correlations(df),
        }

sheets_service = SheetsService()
