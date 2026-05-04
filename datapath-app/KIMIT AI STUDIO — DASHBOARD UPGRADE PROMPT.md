# KIMIT AI STUDIO — DASHBOARD UPGRADE PROMPT
# انسخ كل ده وحطه مباشرة في Cursor / Claude Code / ChatGPT

---

## CONTEXT: READ THIS FIRST

You are working inside the project **Kimit AI Studio** (github: ibrahim1962001/kimit).

### Project Structure:
```
kimit/
├── datapath-app/          ← React 19 + TypeScript + Vite (FRONTEND)
│   └── src/
│       ├── App.tsx                  ← main controller, sidebar nav, global state
│       ├── pages/
│       │   ├── DashboardPage.tsx    ← THE FILE YOU WILL UPGRADE
│       │   └── CleaningPage.tsx
│       ├── components/
│       │   ├── ChatPanel.tsx        ← AI chat, saves to localStorage('datapath_chat_sessions')
│       │   └── EditorSidebar.tsx    ← react-data-grid interactive editor
│       └── lib/
│           └── dataUtils.ts         ← statistical analysis engine
├── backend/               ← FastAPI (Python)
│   ├── main.py            ← DATA_STORE={} in-memory, endpoints: /api/upload /api/clean /api/ai/summary /api/ai/chat /api/export
│   └── .env               ← GROQ_API_KEY
└── docker-compose.yml     ← frontend:5173, backend:8000
```

### Tech Stack (confirmed from codebase):
- **Frontend:** React 19 + TypeScript + Vite
- **Charts:** Apache ECharts (echarts-for-react)
- **File Parsing:** PapaParse (CSV) + SheetJS (Excel) — done in-browser
- **AI:** Groq API — key stored in `localStorage('groq_key')`
- **State:** All dataset state lives in memory (App.tsx) — NOT persisted
- **Styling:** Custom CSS + Glassmorphism dark theme (no Tailwind)
- **i18n:** Custom bilingual Arabic/English support already built in
- **Storage:** localStorage only for `groq_key`, `datapath_chat_sessions`, `datapath_chat_history`
- **Backend:** FastAPI at http://localhost:8000 with in-memory DATA_STORE

### Existing Features (DO NOT BREAK ANY OF THESE):
- ✅ Data Health Score meter
- ✅ Live Slicers (filters by text column values)
- ✅ Custom Chart Builder (user picks X-axis, Y-axis, chart type from ECharts)
- ✅ Pearson Correlation analysis
- ✅ AI Executive Summary (calls Groq via backend or direct)
- ✅ AI Chat with multi-session management + voice input
- ✅ Anomaly/Outlier highlighting (red cells in editor)
- ✅ Data Anonymization (emails, phones)
- ✅ Auto-clean (remove duplicates, fill nulls with median/mode)
- ✅ Export: Excel (.xlsx), PDF, CSV, JSON

### Color System (match exactly, no changes):
```css
--bg-primary:    #0f172a   /* main background */
--bg-secondary:  #1e293b   /* sidebar, panels */
--bg-card:       #334155   /* card backgrounds */
--accent-green:  #10b981   /* primary CTA, active nav */
--accent-blue:   #3b82f6   /* secondary accent */
--accent-amber:  #f59e0b   /* warnings */
--accent-red:    #ef4444   /* errors, danger */
--text-primary:  #f8fafc
--text-muted:    #94a3b8
--radius:        14px
--border-color:  rgba(255,255,255,0.08)

/* Glassmorphism pattern used throughout: */
background: rgba(30, 41, 59, 0.7);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 14px;
```

---

## YOUR TASK

**Open `datapath-app/src/pages/DashboardPage.tsx` and read it fully first.**

Then add a new **"Live Dashboard"** section at the TOP of the page, above everything else that currently exists. Do NOT remove or modify any existing sections — only add above them.

The dataset variable (rows of parsed data) is passed as a prop or accessed from context — look at how the file currently reads it and use the exact same variable.

---

## SECTION 1 — KPI STRIP (4 animated cards in a CSS grid)

**Layout:** `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;`  
**Mobile (<768px):** `grid-template-columns: repeat(2, 1fr);`

Compute these values from the dataset in the component using `useMemo`:

```typescript
const totalRows = dataset.length;
const totalCols = dataset.length > 0 ? Object.keys(dataset[0]).length : 0;

const totalMissing = useMemo(() => {
  return dataset.reduce((acc, row) => {
    return acc + Object.values(row).filter(v => v === null || v === undefined || v === '').length;
  }, 0);
}, [dataset]);

const totalDuplicates = useMemo(() => {
  const seen = new Set<string>();
  let count = 0;
  dataset.forEach(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) count++;
    else seen.add(key);
  });
  return count;
}, [dataset]);
```

**KPI Card specs:**

Each card must have:
- Glassmorphism background (pattern above)
- 4px solid left border in its accent color
- Icon (use inline SVG — no icon library needed)
- Big animated number (count-up)
- Label in Arabic + English: `"إجمالي الصفوف / Total Rows"`
- Entrance animation: `slideUpFade` CSS keyframe, staggered delays: 0ms / 100ms / 200ms / 300ms
- Hover: `transform: scale(1.02); box-shadow: 0 0 20px {accentColor}33;`

| Card | Label | Value | Border Color |
|------|-------|-------|-------------|
| 1 | إجمالي الصفوف / Total Rows | totalRows | #10b981 |
| 2 | إجمالي الأعمدة / Total Columns | totalCols | #3b82f6 |
| 3 | قيم مفقودة / Missing Values | totalMissing | #f59e0b |
| 4 | مكررات / Duplicates | totalDuplicates | #ef4444 |

**Count-up animation (implement exactly like this):**

```typescript
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}
```

**CSS keyframes to add:**

```css
@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Inline SVG icons (use these exactly):**

```tsx
// Rows icon
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
  <line x1="3" y1="15" x2="21" y2="15"/>
</svg>

// Columns icon
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
  <line x1="15" y1="3" x2="15" y2="21"/>
</svg>

// Warning icon
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
</svg>

// Duplicate icon
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
</svg>
```

---

## SECTION 2 — DATA QUALITY RING + COLUMN HEALTH

**Layout:** `display: grid; grid-template-columns: 2fr 3fr; gap: 16px; margin-top: 16px;`  
**Mobile:** `grid-template-columns: 1fr;`

### LEFT CARD — "Data Quality Score"

Compute:
```typescript
const qualityScore = useMemo(() => {
  if (totalRows === 0) return 0;
  const score = ((totalRows - totalMissing - totalDuplicates) / totalRows) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}, [totalRows, totalMissing, totalDuplicates]);

const scoreColor = qualityScore >= 80 ? '#10b981' : qualityScore >= 60 ? '#f59e0b' : '#ef4444';
```

SVG circular progress ring:
```tsx
const r = 54;
const circumference = 2 * Math.PI * r; // ≈ 339.3
const offset = circumference * (1 - qualityScore / 100);

// Animate the dashoffset with useEffect + requestAnimationFrame
// from circumference → offset over 1500ms with easeOutQuart

<svg width="140" height="140" viewBox="0 0 140 140">
  {/* Track circle */}
  <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
  {/* Progress circle */}
  <circle
    cx="70" cy="70" r={r}
    fill="none"
    stroke={scoreColor}
    strokeWidth="10"
    strokeLinecap="round"
    strokeDasharray={circumference}
    strokeDashoffset={animatedOffset}  // animated value
    transform="rotate(-90 70 70)"
    style={{ transition: 'stroke 0.3s ease' }}
  />
  {/* Center text */}
  <text x="70" y="65" textAnchor="middle" fill="#f8fafc" fontSize="28" fontWeight="bold">
    {qualityScore}
  </text>
  <text x="70" y="85" textAnchor="middle" fill="#94a3b8" fontSize="13">
    %
  </text>
</svg>
```

Below the ring, show 3 status lines:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
  <StatusLine color="#10b981" label={`بيانات محللة: ${totalRows.toLocaleString()} صف`} />
  <StatusLine color="#f59e0b" label={`مشاكل مكتشفة: ${totalMissing + totalDuplicates}`} />
  <StatusLine color="#3b82f6" label={`قابل للإصلاح: ${totalMissing + totalDuplicates > 0 ? 'نعم ✓' : 'لا يوجد'}`} />
</div>
```

Each StatusLine: colored dot (8px circle) + text in --text-muted color.

### RIGHT CARD — "صحة الأعمدة / Column Health"

Show a table with one row per column:

```typescript
const columnStats = useMemo(() => {
  if (dataset.length === 0) return [];
  const cols = Object.keys(dataset[0]);
  return cols.map(col => {
    const values = dataset.map(row => row[col]);
    const missing = values.filter(v => v === null || v === undefined || v === '').length;
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const isNumeric = nonNull.every(v => !isNaN(Number(v)));
    const isDate = !isNumeric && nonNull.some(v => !isNaN(Date.parse(String(v))));
    const type = isNumeric ? 'رقمي' : isDate ? 'تاريخ' : 'نصي';
    const typeColor = isNumeric ? '#3b82f6' : isDate ? '#8b5cf6' : '#10b981';
    const health = Math.round(((totalRows - missing) / totalRows) * 100);
    const healthColor = health >= 80 ? '#10b981' : health >= 50 ? '#f59e0b' : '#ef4444';
    return { col, type, typeColor, missing, health, healthColor };
  });
}, [dataset, totalRows]);
```

Table layout:
```
| اسم العمود | النوع | مفقود | صحة البيانات       |
|------------|-------|-------|---------------------|
| Revenue    | [رقمي]| 3     | ████████░░░ 82%     |
```

- Max height: `280px`, `overflow-y: auto`
- Alternating rows: `background: transparent` / `rgba(255,255,255,0.025)`
- Health bar: `height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08)`
  - Fill div: `width: {health}%; background: {healthColor}; height: 100%; border-radius: 3px;`
- Staggered row fade-in: `animation: fadeIn 0.3s ease both; animation-delay: {i*20}ms`
- Type badge: small pill `padding: 2px 8px; border-radius: 99px; font-size: 11px;`

---

## SECTION 3 — QUICK ACTIONS BAR

Place this between the new dashboard sections and the existing content.

```tsx
<div style={{
  display: 'flex', gap: '12px', flexWrap: 'wrap',
  padding: '16px', marginTop: '16px',
  background: 'rgba(30,41,59,0.5)',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.06)'
}}>
```

4 action buttons:

| Button | Icon (inline SVG) | Action |
|--------|-------------------|--------|
| 🧹 تنقية البيانات | broom/wrench SVG | navigate to CleaningPage or call setActiveTab('cleaning') |
| 🤖 محادثة AI | message SVG | navigate to ChatPanel or call setActiveTab('ai') |
| 📥 تصدير Excel | download SVG | trigger existing Excel export function |
| 🔄 رفع ملف جديد | refresh SVG | clear dataset state (setDataset(null) or equivalent) |

Button style:
```css
padding: 10px 20px;
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 10px;
color: #f8fafc;
cursor: pointer;
display: flex; align-items: center; gap: 8px;
font-size: 14px;
transition: all 0.2s ease;

/* hover: */
border-color: #10b981;
background: rgba(16,185,129,0.08);
box-shadow: 0 0 12px rgba(16,185,129,0.15);
```

---

## SECTION 4 — EMPTY STATE (when no file is loaded)

If dataset is empty/null, show this INSTEAD of the KPI strip and quality cards:

```tsx
<div style={{
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '60px 20px',
  background: 'rgba(30,41,59,0.4)',
  borderRadius: '16px',
  border: '2px dashed rgba(16,185,129,0.3)',
  marginBottom: '24px'
}}>
  {/* Upload cloud SVG icon, 64px, color #10b981 */}
  <h3 style={{ color: '#f8fafc', margin: '16px 0 8px' }}>
    ارفع ملف البيانات للبدء
  </h3>
  <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '400px' }}>
    يدعم النظام ملفات CSV و Excel بأي حجم. سيتم تحليل بياناتك فوراً.
  </p>
  {/* 3 skeleton ghost KPI cards below — grey shimmer placeholders */}
</div>
```

Skeleton shimmer effect:
```css
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 400px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}
```

---

## IMPLEMENTATION RULES

1. **Read `DashboardPage.tsx` first** before writing any code — understand current props, state variables, and how the dataset is passed in.

2. **Use exact same variable names** as the existing file for the dataset (don't rename anything).

3. **No new npm packages** — use only what's in `datapath-app/package.json` already. All icons must be inline SVG.

4. **TypeScript strict** — all new code must be properly typed. No `any` unless the existing file already uses it.

5. **CSS approach** — match the existing styling pattern (inline styles + CSS modules or styled-components — whatever the file currently uses). Do NOT add Tailwind.

6. **Bilingual labels** — use the existing i18n/translation pattern found in the file (`t('key')` or whatever pattern is used). If no i18n system exists, use `Arabic / English` format directly in the label text.

7. **Performance** — wrap all computed values in `useMemo`. The count-up animations use `requestAnimationFrame`, not `setInterval`.

8. **DO NOT touch** any existing JSX below your new sections. Only prepend new sections at the top of the return statement (after any header that already exists).

9. **Verify Docker compatibility** — the app runs in Docker on `localhost:5173` (frontend) and `localhost:8000` (backend). Any API calls must use the existing API base URL pattern already in the codebase.

10. **After writing the code** — run a mental check:
    - Does it compile without TypeScript errors?
    - Does it work when dataset is empty?
    - Does it work when dataset has 1 row? 100,000 rows?
    - Are all existing features still intact?

---

## DELIVERABLE FORMAT

Give me the complete updated `DashboardPage.tsx` file — the full file, not a diff.
Start with the imports, then the component, then the return JSX.
Add a comment `// ===== LIVE DASHBOARD SECTION — NEW =====` at the start of your new code
and `// ===== END LIVE DASHBOARD SECTION =====` at the end, so I can find it easily.