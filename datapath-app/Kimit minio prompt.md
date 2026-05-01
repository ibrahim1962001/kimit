# 🚀 Kimit — MinIO Persistent File Storage Integration Prompt

---

## 🧠 ROLE

You are a **senior fullstack engineer** specializing in FastAPI and React applications with object storage integration. You have deep expertise in MinIO, file streaming, and building production-grade file management systems.

---

## 📦 PROJECT CONTEXT

**Project:** Kimit — DataPath Analyzer (`https://kimit.cloud`)
**Repository:** `https://github.com/ibrahim1962001/kimit`

### Tech Stack (existing — DO NOT change)
| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Frontend | React 18 via CDN + Babel |
| Styling | Custom CSS Variables |
| Charts | Recharts |
| AI | Groq API (llama-3.1-70b-versatile) |
| Language | Custom i18n — Arabic RTL / English LTR |

### Design Tokens (existing — match exactly)
```
--bg-primary:    #0f172a
--bg-secondary:  #1e293b
--bg-card:       #334155
--accent-green:  #10b981
--accent-blue:   #3b82f6
--text-primary:  #f8fafc
--text-secondary:#94a3b8
--error:         #ef4444
--success:       #22c55e
--warning:       #f59e0b
Font: "Inter", "Noto Sans Arabic", system-ui
```

### Current File Flow (existing — DO NOT break)
1. User uploads CSV / XLSX / XLS via `POST /api/upload`
2. File is processed in-memory by pandas → returns `fileId`, columns, charts, preview
3. All other endpoints (`/api/clean`, `/api/ai/summary`, `/api/ai/chat`, `/api/export`) use `fileId` from memory

---

## 🎯 TASK

**Implement MinIO persistent file storage as an additive layer.**

Every file uploaded through the app — whether the user is **authenticated or anonymous (guest)** — must be:
1. ✅ Saved to MinIO automatically on every upload
2. ✅ Stored with its original format preserved (CSV, XLSX, XLS)
3. ✅ Listed and browsable through the app
4. ✅ Downloadable in original format via the app

**MinIO is ADDITIVE only.** The existing in-memory pandas flow must remain 100% unchanged.

---

## 🏗️ ARCHITECTURE

### MinIO Config
```
Host:    localhost:9001
Bucket:  datasets
Secure:  False (local)
```

### Storage Path Convention
```
# Authenticated user:
datasets/user_uploads/{user_id}/{yyyymmdd_HHMMSS}_{original_filename}

# Anonymous / guest user:
datasets/user_uploads/guest/{yyyymmdd_HHMMSS}_{original_filename}
```

---

## 📋 IMPLEMENTATION REQUIREMENTS

### 1. Environment Variables — add to `.env` and `.env.example`

```env
MINIO_ENDPOINT=localhost:9001
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET=datasets
MINIO_SECURE=False
```

---

### 2. New File: `backend/minio_client.py`

Create a standalone MinIO utility module with:

```python
# Functions to implement:

def get_minio_client() -> Minio | None
# Returns configured Minio client, or None if connection fails (graceful degradation)

def upload_file_to_minio(file_bytes: bytes, object_name: str, content_type: str) -> bool
# Uploads raw bytes to MinIO, returns True on success, False on failure
# Must NOT raise exceptions — log errors silently

def list_uploaded_files(prefix: str = "user_uploads/") -> list[dict]
# Returns list of objects: [{ object_name, filename, size_bytes, last_modified }]

def download_file_from_minio(object_name: str) -> tuple[bytes, str] | None
# Returns (file_bytes, content_type) or None if not found

def build_object_name(filename: str, user_id: str | None = None) -> str
# Builds the storage path based on auth state and timestamp
```

**Rules for this module:**
- Use `minio` Python package (NOT boto3)
- All functions must handle exceptions internally — never let MinIO failure crash the app
- Log all errors with `logging.warning(...)` not `print()`
- If MinIO client returns `None`, all functions return graceful fallback values

---

### 3. Updated: `backend/main.py` — `POST /api/upload`

**Add MinIO upload AFTER successful pandas processing.** Do not change anything before it.

```python
# After existing processing logic succeeds:
# 1. Reset file pointer: await file.seek(0)
# 2. Read raw bytes: file_bytes = await file.read()
# 3. Determine user_id: extract from Authorization header or session if present, else None
# 4. Build object_name: minio_client.build_object_name(file.filename, user_id)
# 5. Upload: minio_client.upload_file_to_minio(file_bytes, object_name, content_type)
# 6. Add to response: { ..., "minio_path": object_name, "saved_to_storage": True/False }
```

Content-type mapping:
```python
".csv"  → "text/csv"
".xlsx" → "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
".xls"  → "application/vnd.ms-excel"
```

---

### 4. New Endpoint: `GET /api/files`

```python
@app.get("/api/files")
async def list_files(user_id: str | None = None):
    """
    Lists all files in MinIO under user_uploads/
    - If user_id provided: return user_uploads/{user_id}/ files only
    - If no user_id: return user_uploads/guest/ files only
    Returns: [{ object_name, filename, size_kb, last_modified, download_url }]
    download_url = f"/api/files/download/{encoded_object_name}"
    """
```

---

### 5. New Endpoint: `GET /api/files/download/{object_name:path}`

```python
@app.get("/api/files/download/{object_name:path}")
async def download_file(object_name: str):
    """
    Streams file from MinIO back to browser.
    - Detect content-type from file extension
    - Set Content-Disposition: attachment; filename="{original_filename}"
    - Use StreamingResponse with BytesIO
    - Return 404 if object not found in MinIO
    """
```

**Important:** Use `StreamingResponse` not `FileResponse`. Never write temp files to disk.

---

### 6. Updated: `requirements.txt`

Add these lines:
```
minio>=7.2.0
python-dotenv>=1.0.0
```

---

### 7. Frontend: React — "Saved Files" Panel

**Add a new sidebar section** between "Export" and the language toggle.

#### Sidebar Nav Item (add to existing nav list)
```jsx
// Icon: cloud/database SVG (consistent with existing nav icons)
// Label EN: "Saved Files"  |  Label AR: "الملفات المحفوظة"
// Active state: same emerald style as other nav items
```

#### New Tab Component: `SavedFilesTab`

**Layout:** Match existing tab card style exactly — `#1e293b` bg, `14px` border-radius, `28px` padding.

**Behavior:**
1. On mount: `GET /api/files` → display list
2. Show loading spinner while fetching (same spinner style as Dashboard tab)
3. If list empty: show empty state with cloud-upload icon + message
4. File list row contains:
   - 📄 File type icon (CSV green / Excel blue — SVG inline)
   - Filename (truncated if > 40 chars with `...`)
   - File size in KB/MB
   - Upload date formatted as `DD/MM/YYYY HH:MM`
   - **Download button** → calls `/api/files/download/{object_name}` → triggers browser download
5. Refresh button top-right (same style as Dashboard "Refresh")
6. All text bilingual: EN/AR based on existing `lang` state

**Download trigger (JS):**
```javascript
const handleDownload = (objectName, filename) => {
  const link = document.createElement('a');
  link.href = `/api/files/download/${encodeURIComponent(objectName)}`;
  link.download = filename;
  link.click();
};
```

#### Upload Success Notification (add to existing upload flow)
After successful upload, show a toast/badge:
```
✅ EN: "File saved to cloud storage"
✅ AR: "تم حفظ الملف في التخزين السحابي"
```
Use existing success color `#22c55e`. Duration: 3 seconds. Same notification style as existing messages.

---

## ✅ ACCEPTANCE CRITERIA

| # | Criteria | Must Pass |
|---|---|---|
| 1 | Upload any CSV/XLSX while logged in → file appears in MinIO at `user_uploads/{user_id}/` | ✅ |
| 2 | Upload any CSV/XLSX as guest → file appears in MinIO at `user_uploads/guest/` | ✅ |
| 3 | `/api/files` returns correct list filtered by user/guest | ✅ |
| 4 | Download via `/api/files/download/` returns exact original file bytes | ✅ |
| 5 | Downloaded file opens correctly in Excel / pandas | ✅ |
| 6 | If MinIO is down → upload still works in-memory, no 500 error, `saved_to_storage: false` | ✅ |
| 7 | All existing endpoints unchanged and fully functional | ✅ |
| 8 | Frontend Saved Files tab works in both AR and EN | ✅ |
| 9 | No temp files written to disk at any point | ✅ |
| 10 | No presigned URLs used (MinIO is private) | ✅ |

---

## 🚫 CONSTRAINTS

- ❌ Do NOT use boto3 — use `minio` Python package only
- ❌ Do NOT write temp files to disk
- ❌ Do NOT use presigned URLs (bucket is PRIVATE)
- ❌ Do NOT change any existing endpoint signatures or response shapes (only ADD new fields)
- ❌ Do NOT change existing CSS variables or design tokens
- ❌ Do NOT add new npm packages or CDN libraries — use only what's already loaded

---

## 📤 OUTPUT FORMAT

Provide your output in this exact order:

1. **`backend/minio_client.py`** — full file
2. **`backend/main.py` diff** — show only changed/added sections with context lines
3. **`requirements.txt` additions** — just the new lines
4. **`.env.example` additions** — just the new lines
5. **Frontend `SavedFilesTab` component** — full JSX/JS code
6. **Frontend sidebar addition** — exact lines to add to nav array
7. **Frontend upload success notification** — exact lines to add to upload handler
8. **Quick test checklist** — 5 curl commands to verify everything works

---

*Prompt version: 1.0 | Project: Kimit DataPath Analyzer | Target: MinIO Community Edition*