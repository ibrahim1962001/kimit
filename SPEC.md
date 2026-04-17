# DataPath Analyzer - Technical Specification

## 1. Project Overview

**Project Name:** DataPath Analyzer  
**Type:** Autonomous Data Intelligence Platform  
**Core Functionality:** AI-powered data analysis tool that processes CSV/Excel files, provides automated cleaning, generates insights via Groq API, and visualizes data with dynamic charts.  
**Target Users:** Data analysts, business users, and non-technical stakeholders who need quick data insights.

---

## 2. Tech Stack

### Backend
- **Framework:** FastAPI (Python)
- **File Processing:** pandas, openpyxl
- **AI Integration:** Groq API (llama-3.1-70b-versatile)
- **CORS:** fastapi-cors

### Frontend
- **Framework:** React 18 (CDN) with Babel
- **Styling:** Custom CSS with CSS Variables
- **Charts:** Recharts
- **HTTP Client:** Axios
- **Language:** Custom i18n (Arabic RTL / English LTR)

---

## 3. UI/UX Specification

### Color Palette
- **Background Primary:** #0f172a (slate-900)
- **Background Secondary:** #1e293b (slate-800)
- **Background Card:** #334155 (slate-700)
- **Accent Primary:** #10b981 (emerald-500)
- **Accent Secondary:** #3b82f6 (blue-500)
- **Text Primary:** #f8fafc (slate-50)
- **Text Secondary:** #94a3b8 (slate-400)
- **Error:** #ef4444 (red-500)
- **Success:** #22c55e (green-500)
- **Warning:** #f59e0b (amber-500)

### Typography
- **Font Family:** "Inter", "Noto Sans Arabic", system-ui
- **Headings:** Bold, 28px/24px/20px
- **Body:** Regular, 14px-15px
- **Small:** 12px-13px

### Layout
- **Sidebar:** Fixed left (RTL) / Fixed right (LTR), 260px width
- **Main Content:** Fluid, padding 28px
- **Cards:** Rounded 14px, border 1px solid #334155

### Responsive Breakpoints
- **Mobile:** < 768px (collapsed sidebar)
- **Tablet:** 768px - 1024px
- **Desktop:** > 1024px

---

## 4. Component Specification

### Sidebar Navigation
- Logo + App Name at top
- Navigation items with SVG icons:
  - Dashboard (grid icon)
  - Data Cleaning (wrench icon)
  - AI Consultant (message icon)
  - Export (download icon)
- Language toggle at bottom (EN/AR)
- Active state: emerald background + border

### File Uploader
- Drag-and-drop zone with dashed border
- Hover effect: scale + border color change
- Accepted: .csv, .xlsx, .xls
- File info display after upload (icon, name, stats)
- Remove file button

### Dashboard Tab
- 4 chart grid (2x2)
- Chart types: Line, Bar, Area, Pie
- AI auto-selects chart type based on column data type
- Loading spinner during data processing

### Data Cleaning Tab
- Stats panel: Total rows, columns, missing, duplicates
- Auto-Fix button with loading state
- Data preview table (first 10 rows)
- Success notifications

### AI Consultant Tab
- Executive summary card with AI badge
- 5 suggested questions as clickable chips
- Chat interface:
  - User input field
  - Send button
  - Message bubbles (user green, AI gray)
  - Timestamps on messages
  - Auto-scroll to latest message

### Export Tab
- Download as CSV button
- Download as JSON button

---

## 5. API Endpoints

### GET /
- Returns: `{ message, version, status }`

### GET /api/health
- Returns: `{ status, groq_configured }`

### POST /api/upload
- Input: file (multipart/form-data)
- Output: `{ fileId, filename, columns, dtypes, shape, nullCounts, duplicates, preview, charts }`

### POST /api/clean
- Input: `{ fileId }`
- Output: `{ cleaned, removedNulls, removedDuplicates, newShape, nullCounts, preview }`

### POST /api/ai/summary
- Input: `{ fileId, language }`
- Output: `{ summary, suggestions }`

### POST /api/ai/chat
- Input: `{ question, fileId, language }`
- Output: `{ answer }`

### POST /api/export
- Input: `{ fileId, format }`
- Output: file download (CSV or JSON)

---

## 6. Environment Variables

```
GROQ_API_KEY=your_groq_api_key_here
```

---

## 7. AI Logic

### Data Summary (for >100 rows)
Send to Groq:
- Column Names
- Data Types
- Unique Values Count
- Missing Values Count + Percentage
- Statistical Summary (Mean, Median, Min, Max, Std Dev)
- Top 5 values for categorical columns

### Chart Selection Logic
- Numeric columns → Line Chart (trends)
- Categorical (<=15 unique) → Bar Chart
- Numeric (secondary) → Area Chart
- Categorical (distribution) → Pie Chart

### Language Detection
- AI responds in Arabic when `language="ar"`
- AI responds in English when `language="en"`

---

## 8. Acceptance Criteria

1. ✅ File upload works for CSV and Excel
2. ✅ Auto-fix fills nulls with Median (numeric) and Mode (categorical)
3. ✅ AI generates 3-sentence summary in user's language
4. ✅ 4 charts render dynamically based on data (Line, Bar, Area, Pie)
5. ✅ Chat interface responds to data questions via Groq API
6. ✅ Export downloads cleaned data as CSV or JSON
7. ✅ RTL/LTR toggle switches layout direction
8. ✅ Dark theme with emerald accents applied throughout

---

## 9. File Structure

```
d:\اداه تحليل لبيانات\
├── index.html              # Frontend (React CDN)
├── SPEC.md                 # This specification
├── README.md               # Documentation
├── backend/
│   ├── main.py            # FastAPI backend
│   ├── requirements.txt   # Python dependencies
│   └── .env               # Environment variables
└── frontend/              # (Reserved for future React build)
```
