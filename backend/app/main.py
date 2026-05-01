import os
import json
import io
import chardet
import charset_normalizer
import polars as pl
from pyxlsb import open_workbook
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from groq import Groq
import pandas as pd
import numpy as np
from app.utils.storage import storage_manager
from app.utils import minio_client
import logging

load_dotenv()
logger = logging.getLogger("uvicorn.error")

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

app = FastAPI(title="DataPath Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), request: Request = None):
    """Upload and process CSV or Excel file."""
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        # ── MinIO: save raw bytes (additive layer, never blocks processing) ──
        dataset_id = len(DATA_STORE) + 1

        # Extract user_id from Authorization header if present
        user_id: str | None = None
        if request:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                # Use a short hash of the token as anonymous user key
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
        file_path = object_name

        # Legacy boto3 backup (kept for compatibility, silent on failure)
        try:
            logger.info(f"Uploading raw file {file.filename} ({len(contents)} bytes) to MinIO path: {file_path}")
            storage_manager.upload_file(contents, file_path)
        except Exception as e:
            logger.warning(f"Legacy storage backup failed: {str(e)}")

        try:
            df = robust_read_file(contents, file.filename)
        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"خطأ داخلي في معالجة الملف: {str(e)}. تواصل مع الدعم."
            )
        
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        
        df.columns = df.columns.str.strip()
        df = df.replace([np.inf, -np.inf], np.nan)
        
        preview = df.head(10).to_dict(orient='records')
        duplicates = int(df.duplicated().sum())
        
        DATA_STORE[dataset_id] = {
            "df": df,
            "filename": file.filename,
            "storage_path": file_path,
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "shape": list(df.shape),
            "null_counts": df.isnull().sum().to_dict(),
            "duplicates": duplicates
        }
        
        anomalies = detect_anomalies(df)
        correlations = get_correlations(df)
        
        return {
            "datasetId": dataset_id,
            "filename": file.filename,
            "columns": df.columns.tolist(),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "shape": list(df.shape),
            "nullCounts": df.isnull().sum().to_dict(),
            "duplicates": duplicates,
            "preview": preview,
            "charts": generate_chart_config(df),
            "anomalies": anomalies,
            "correlations": correlations,
            "minio_path": object_name,
            "saved_to_storage": saved_to_storage,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


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


@app.post("/api/datasets/import-sheets")
async def import_sheets(request: dict):
    url = request.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Google Sheet URL is required.")
        
    import re
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid Google Sheets URL.")
    
    spreadsheet_id = match.group(1)
    gid_match = re.search(r"[#&]gid=([0-9]+)", url)
    gid_param = f"&gid={gid_match.group(1)}" if gid_match else ""
    
    export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv{gid_param}"
    
    try:
        df = pd.read_csv(export_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Google Sheet: {str(e)}")
        
    if df.empty:
        raise HTTPException(status_code=400, detail="The Google Sheet is empty.")
        
    # PERSISTENT STORAGE FIRST
    dataset_id = len(DATA_STORE) + 1
    sheet_path = f"google_sheets/{dataset_id}_import.csv"
    try:
        csv_bytes = df.to_csv(index=False).encode('utf-8')
        logger.info(f"Saving Google Sheet import to MinIO: {sheet_path}")
        storage_manager.upload_file(csv_bytes, sheet_path, content_type="text/csv")
    except Exception as e:
        logger.error(f"MinIO Backup Failed for sheet: {str(e)}")
    
    preview = df.head(10).to_dict(orient='records')
    duplicates = int(df.duplicated().sum())
    
    DATA_STORE[dataset_id] = {
        "df": df,
        "filename": "Google Sheet Import",
        "storage_path": sheet_path,
        "columns": df.columns.tolist(),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "shape": list(df.shape),
        "null_counts": df.isnull().sum().to_dict(),
        "duplicates": duplicates
    }
    
    anomalies = detect_anomalies(df)
    correlations = get_correlations(df)
    
    return {
        "datasetId": dataset_id,
        "filename": "Google Sheet Import",
        "sourceUrl": url,
        "columns": df.columns.tolist(),
        "dtypes": df.dtypes.astype(str).to_dict(),
        "shape": list(df.shape),
        "nullCounts": df.isnull().sum().to_dict(),
        "duplicates": duplicates,
        "preview": preview,
        "fullData": df.to_dict(orient='records'),
        "charts": generate_chart_config(df),
        "anomalies": anomalies,
        "correlations": correlations
    }


@app.post("/api/clean")
async def clean_data(request: dict):
    """Auto-clean data: fill nulls and remove duplicates."""
    dataset_id = int(request.get("datasetId", 0))
    
    if dataset_id not in DATA_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload a file first.")
    
    df = DATA_STORE[dataset_id]["df"].copy()
    
    original_nulls = int(df.isnull().sum().sum())
    original_duplicates = int(df.duplicated().sum())
    
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if df[col].isnull().any():
            median_val = df[col].median()
            if pd.notna(median_val):
                df[col].fillna(median_val, inplace=True)
    
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in categorical_cols:
        if df[col].isnull().any():
            mode_val = df[col].mode()
            if len(mode_val) > 0 and pd.notna(mode_val[0]):
                df[col].fillna(mode_val[0], inplace=True)
            else:
                df[col].fillna("Unknown", inplace=True)
    
    df.drop_duplicates(inplace=True)
    
    DATA_STORE[dataset_id]["df"] = df
    DATA_STORE[dataset_id]["shape"] = list(df.shape)
    DATA_STORE[dataset_id]["null_counts"] = df.isnull().sum().to_dict()
    DATA_STORE[dataset_id]["duplicates"] = int(df.duplicated().sum())
    
    return {
        "cleaned": True,
        "removedNulls": original_nulls,
        "removedDuplicates": original_duplicates,
        "newShape": list(df.shape),
        "nullCounts": df.isnull().sum().to_dict(),
        "preview": df.head(10).to_dict(orient='records')
    }


@app.post("/api/ai/summary")
async def get_ai_summary(request: dict):
    """Get AI-generated executive summary and suggestions."""
    dataset_id = int(request.get("datasetId", 0))
    language = request.get("language", "en")
    
    if dataset_id not in DATA_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload a file first.")
    
    if not groq_client:
        df = DATA_STORE[dataset_id]["df"]
        return {
            "summary": f"The dataset contains {len(df)} rows and {len(df.columns)} columns ready for analysis." if language == "en" else f"تحتوي مجموعة البيانات على {len(df)} صف و {len(df.columns)} عمود جاهزة للتحليل.",
            "suggestions": [
                "What are the main trends?" if language == "en" else "ما هي الاتجاهات الرئيسية؟",
                "Show column statistics" if language == "en" else "عرض إحصائيات الأعمدة",
                "Find missing values" if language == "en" else "البحث عن القيم المفقودة",
                "Show data distribution" if language == "en" else "عرض توزيع البيانات",
                "Identify correlations" if language == "en" else "تحديد العلاقات"
            ]
        }
    
    df = DATA_STORE[dataset_id]["df"]
    data_summary = get_summary_for_ai(df)
    lang_instruction = "Respond in Arabic language." if language == "ar" else "Respond in English language."
    
    prompt = f"""You are an expert data analyst assistant. Analyze the dataset and provide insights.

{lang_instruction}

Dataset Information:
{data_summary}

Please provide:
1. A concise 3-sentence executive summary of the data
2. 5 suggested questions the user might ask about this data

Format your response as JSON with this exact structure:
{{
    "summary": "Your 3-sentence summary here...",
    "suggestions": ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
}}

Make sure suggestions are practical and related to the actual data columns."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=600
        )
        
        content = response.choices[0].message.content.strip()
        
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        
        result = json.loads(content.strip())
        return result
        
    except json.JSONDecodeError:
        return {
            "summary": f"The dataset contains {len(df)} rows and {len(df.columns)} columns with various data types ready for analysis." if language == "en" else f"تحتوي مجموعة البيانات على {len(df)} صف و {len(df.columns)} عمود جاهزة للتحليل.",
            "suggestions": [
                "What are the main trends in this data?" if language == "en" else "ما هي الاتجاهات الرئيسية في هذه البيانات؟",
                "Which columns have missing values?" if language == "en" else "أي الأعمدة تحتوي على قيم مفقودة؟",
                "What is the distribution of key metrics?" if language == "en" else "ما هو توزيع المقاييس الرئيسية؟",
                "Are there any correlations between columns?" if language == "en" else "هل هناك علاقات بين الأعمدة؟",
                "What insights can we derive?" if language == "en" else "ما هي الرؤى التي يمكننا استنتاجها؟"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI processing error: {str(e)}")


@app.post("/api/ai/chat")
async def chat_with_ai(request: dict):
    """Chat with AI about the data."""
    question = request.get("question", "")
    dataset_id = int(request.get("datasetId", 0))
    language = request.get("language", "en")
    
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    
    if dataset_id not in DATA_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload a file first.")
    
    if not groq_client:
        return {
            "answer": "AI is not configured. Please set GROQ_API_KEY in .env file." if language == "en" else "لم يتم تكوين الذكاء الاصطناعي. يرجى تعيين GROQ_API_KEY في ملف .env"
        }
    
    df = DATA_STORE[dataset_id]["df"]
    data_context = get_summary_for_ai(df)
    lang_instruction = "Respond in Arabic language." if language == "ar" else "Respond in English language."
    
    prompt = f"""You are a helpful data analyst assistant. Answer the user's question about their dataset.

{lang_instruction}

Dataset Information:
{data_context}

User Question: {question}

Provide a clear, helpful, and accurate answer based on the data. If the question requires calculations, show the results. If it requires filtering or analysis, explain what you would do and the insights you can derive.

Keep your response concise but informative (2-3 paragraphs max)."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=400
        )
        
        return {"answer": response.choices[0].message.content}
        
    except Exception as e:
        error_msg = "I apologize, but I encountered an error processing your question. Please try again." if language == "en" else "أعتذر، لكنني واجهت خطأ في معالجة سؤالك. يرجى المحاولة مرة أخرى."
        return {"answer": error_msg}


@app.post("/api/export")
async def export_data(request: dict):
    """Export data as CSV or JSON."""
    dataset_id = int(request.get("datasetId", 0))
    format_type = request.get("format", "csv")
    
    if dataset_id not in DATA_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found. Please upload a file first.")
    
    df = DATA_STORE[dataset_id]["df"]
    filename = DATA_STORE[dataset_id]["filename"].rsplit('.', 1)[0]
    
    if format_type == "csv":
        csv_data = df.to_csv(index=False, encoding='utf-8-sig')
        return StreamingResponse(
            io.StringIO(csv_data),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}_cleaned.csv"}
        )
    elif format_type == "json":
        json_data = df.to_json(orient='records', force_ascii=False, indent=2)
        return StreamingResponse(
            io.StringIO(json_data),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}_cleaned.json"}
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'json'.")


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