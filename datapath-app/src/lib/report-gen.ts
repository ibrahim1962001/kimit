import jsPDF from 'jspdf';
import type { DatasetInfo } from '../types';
import logoImg from '../assets/logo.png';

// ── Color Palette (light/print-friendly for managers) ──────────────
const C = {
  navy:    [15, 32, 67]    as [number,number,number],
  gold:    [180, 140, 30]  as [number,number,number],
  goldL:   [212, 175, 55]  as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
  offW:    [248, 249, 252] as [number,number,number],
  lightBg: [241, 244, 250] as [number,number,number],
  slate:   [71, 85, 105]   as [number,number,number],
  slateL:  [148, 163, 184] as [number,number,number],
  green:   [5, 150, 105]   as [number,number,number],
  red:     [185, 28, 28]   as [number,number,number],
  orange:  [180, 100, 10]  as [number,number,number],
  sky:     [14, 116, 144]  as [number,number,number],
  border:  [220, 225, 235] as [number,number,number],
};

export interface ReportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  insights?: { title: string; description: string; type: 'info'|'positive'|'warning' }[];
}

// ── Helpers ─────────────────────────────────────────────────────────
const rgb  = (d: jsPDF, c: [number,number,number]) => d.setTextColor(...c);
const fill = (d: jsPDF, c: [number,number,number], x: number, y: number, w: number, h: number) => {
  d.setFillColor(...c); d.rect(x, y, w, h, 'F');
};
const line = (d: jsPDF, c: [number,number,number], x1: number, y1: number, x2: number, lw = 0.4) => {
  d.setDrawColor(...c); d.setLineWidth(lw); d.line(x1, y1, x2, y1);
};
const fmtN = (n: number) =>
  n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n.toLocaleString();
const pct  = (a: number, b: number) => b === 0 ? '0%' : ((a/b)*100).toFixed(1)+'%';

async function loadLogo(): Promise<HTMLImageElement|null> {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = logoImg;
    img.onload = () => res(img);
    img.onerror = () => res(null);
  });
}

// ── PAGE HEADER + FOOTER ────────────────────────────────────────────
function pageChrome(d: jsPDF, page: number, total: number, filename: string, logo: HTMLImageElement|null) {
  const W = d.internal.pageSize.getWidth();
  const H = d.internal.pageSize.getHeight();

  // Header bar
  fill(d, C.navy, 0, 0, W, 16);
  if (logo) d.addImage(logo, 'PNG', 8, 2.5, 11, 11);
  d.setFont('helvetica', 'bold'); d.setFontSize(9);
  rgb(d, C.goldL); d.text('KIMIT AI STUDIO', 22, 10);
  d.setFont('helvetica', 'normal'); d.setFontSize(7.5);
  rgb(d, C.slateL); d.text(filename, W/2, 10, { align: 'center' });
  d.text(`Page ${page} of ${total}`, W - 8, 10, { align: 'right' });

  // Gold underline
  fill(d, C.goldL, 0, 16, W, 0.6);

  // Footer
  fill(d, C.lightBg, 0, H - 10, W, 10);
  line(d, C.border, 0, H - 10, W, 0.3);
  d.setFontSize(6.5); rgb(d, C.slate);
  d.text('KIMIT AI STUDIO  •  Confidential Executive Report  •  For Authorized Management Use Only', W/2, H - 4, { align: 'center' });
}

// ── SECTION HEADING ─────────────────────────────────────────────────
function secHead(d: jsPDF, label: string, y: number, accent: [number,number,number] = C.navy): number {
  const W = d.internal.pageSize.getWidth();
  fill(d, C.lightBg, 10, y, W - 20, 11);
  fill(d, accent, 10, y, 3, 11);
  d.setFont('helvetica', 'bold'); d.setFontSize(9);
  d.setTextColor(...accent); d.text(label, 16, y + 7.5);
  return y + 17;
}

// ── KPI CARDS ───────────────────────────────────────────────────────
function kpiCards(
  d: jsPDF,
  cards: { label: string; val: string; sub?: string; color: [number,number,number] }[],
  y: number
): number {
  const W = d.internal.pageSize.getWidth();
  const n = cards.length;
  const cw = (W - 20 - (n - 1) * 4) / n;
  cards.forEach((c, i) => {
    const cx = 10 + i * (cw + 4);
    fill(d, C.white, cx, y, cw, 22);
    d.setDrawColor(...C.border); d.setLineWidth(0.3);
    d.rect(cx, y, cw, 22, 'S');
    fill(d, c.color, cx, y, cw, 2.5);
    d.setFont('helvetica', 'normal'); d.setFontSize(6.5);
    rgb(d, C.slate); d.text(c.label.toUpperCase(), cx + 4, y + 9);
    d.setFont('helvetica', 'bold'); d.setFontSize(14);
    d.setTextColor(...c.color); d.text(c.val, cx + 4, y + 19);
    if (c.sub) { d.setFontSize(6); rgb(d, C.slateL); d.text(c.sub, cx + cw - 4, y + 19, { align: 'right' }); }
  });
  return y + 28;
}

// ── TABLE ROW ───────────────────────────────────────────────────────
function tableRow(
  d: jsPDF,
  cols: string[],
  y: number,
  widths: number[],
  startX: number,
  isHeader = false,
  isAlt = false
): number {
  const rowH = isHeader ? 9 : 8;
  if (isHeader) fill(d, C.navy, startX, y, widths.reduce((a, b) => a + b, 0) + (cols.length - 1) * 0.3, rowH);
  else if (isAlt) fill(d, C.lightBg, startX, y, widths.reduce((a, b) => a + b, 0) + (cols.length - 1) * 0.3, rowH);

  d.setFont('helvetica', isHeader ? 'bold' : 'normal');
  d.setFontSize(isHeader ? 7 : 7.5);
  rgb(d, isHeader ? C.white : C.navy);

  let x = startX;
  cols.forEach((col, i) => {
    const txt = d.splitTextToSize(col, widths[i] - 4);
    d.text(txt[0] ?? '', x + 3, y + (isHeader ? 6 : 5.5));
    x += widths[i] + 0.3;
  });
  return y + rowH + 0.5;
}

// ══════════════════════════════════════════════════════════════════
// PAGE 1 — COVER
// ══════════════════════════════════════════════════════════════════
async function drawCover(
  d: jsPDF,
  opts: { title?: string; subtitle?: string; filename: string; rows: number; cols: number; generatedAt: string }
) {
  const W = d.internal.pageSize.getWidth();
  const H = d.internal.pageSize.getHeight();

  // White background
  fill(d, C.white, 0, 0, W, H);

  // Top navy band
  fill(d, C.navy, 0, 0, W, 50);
  fill(d, C.goldL, 0, 50, W, 1.5);

  // Logo + brand
  const logo = await loadLogo();
  if (logo) d.addImage(logo, 'PNG', 14, 12, 22, 22);
  d.setFont('helvetica', 'bold'); d.setFontSize(22);
  rgb(d, C.goldL); d.text('KIMIT AI STUDIO', 42, 27);
  d.setFont('helvetica', 'normal'); d.setFontSize(9);
  rgb(d, C.slateL); d.text('Advanced Data Intelligence & Analytics Platform', 42, 37);

  // Title block
  const tY = 80;
  fill(d, C.lightBg, 0, tY, W, 60);
  fill(d, C.goldL, 0, tY, 5, 60);
  d.setFont('helvetica', 'bold'); d.setFontSize(24);
  rgb(d, C.navy);
  const titleLines = d.splitTextToSize(opts.title || 'Executive Intelligence Report', W - 30);
  d.text(titleLines, W/2, tY + 22, { align: 'center' });
  d.setFont('helvetica', 'normal'); d.setFontSize(11);
  rgb(d, C.gold);
  d.text(opts.subtitle || 'Strategic Data Analysis & Decision Intelligence', W/2, tY + 38, { align: 'center' });

  // Meta info
  const metaY = tY + 72;
  const metas = [
    { l: 'DATASET', v: opts.filename },
    { l: 'RECORDS', v: fmtN(opts.rows) },
    { l: 'COLUMNS', v: String(opts.cols) },
    { l: 'GENERATED', v: opts.generatedAt },
  ];
  metas.forEach((m, i) => {
    const cx = 14 + i * 47;
    fill(d, C.lightBg, cx, metaY, 43, 24);
    d.setDrawColor(...C.border); d.setLineWidth(0.3);
    d.rect(cx, metaY, 43, 24, 'S');
    fill(d, C.navy, cx, metaY, 43, 3);
    d.setFont('helvetica', 'bold'); d.setFontSize(6);
    rgb(d, C.goldL); d.text(m.l, cx + 4, metaY + 8.5);
    d.setFont('helvetica', 'bold'); d.setFontSize(13);
    rgb(d, C.navy); d.text(m.v, cx + 4, metaY + 20);
  });

  // Prepared for
  const prepY = metaY + 36;
  d.setFont('helvetica', 'bold'); d.setFontSize(9);
  rgb(d, C.navy); d.text('PREPARED FOR', W/2, prepY, { align: 'center' });
  d.setFont('helvetica', 'normal'); d.setFontSize(8);
  rgb(d, C.slate); d.text('Management & Executive Leadership Team', W/2, prepY + 8, { align: 'center' });

  // Divider
  line(d, C.border, 14, prepY + 16, W - 14, 0.5);

  // Confidential footer
  fill(d, C.navy, 0, H - 22, W, 22);
  d.setFont('helvetica', 'bold'); d.setFontSize(8);
  rgb(d, C.goldL); d.text('CONFIDENTIAL & PROPRIETARY', W/2, H - 12, { align: 'center' });
  d.setFont('helvetica', 'normal'); d.setFontSize(6.5);
  rgb(d, C.slateL); d.text('For Authorized Management Use Only — Do Not Distribute', W/2, H - 5, { align: 'center' });
}

// ══════════════════════════════════════════════════════════════════
// PAGE 2 — EXECUTIVE SUMMARY
// ══════════════════════════════════════════════════════════════════
function drawPage2(d: jsPDF, info: DatasetInfo, health: { score: number; label: string }) {
  const W = d.internal.pageSize.getWidth();
  fill(d, C.white, 0, 0, W, 297);
  let y = 22;


  const completeness = info.totalNulls > 0
    ? (100 - (info.totalNulls / (info.rows * info.columns.length) * 100)).toFixed(1)
    : '100.0';

  // 01 — EXECUTIVE SUMMARY
  y = secHead(d, '01   EXECUTIVE SUMMARY', y);

  // Situation block
  fill(d, C.lightBg, 10, y, W - 20, 26);
  d.setDrawColor(...C.border); d.rect(10, y, W - 20, 26, 'S');
  fill(d, C.sky, 10, y, 3, 26);
  d.setFont('helvetica', 'bold'); d.setFontSize(8); rgb(d, C.sky);
  d.text('CURRENT SITUATION', 16, y + 7);
  d.setFont('helvetica', 'normal'); d.setFontSize(8); rgb(d, C.navy);
  const sit = `Dataset "${info.filename}" contains ${fmtN(info.rows)} records across ${info.columns.length} fields. Data completeness rate: ${completeness}% — Health Status: "${health.label}".`;
  const sitW = d.splitTextToSize(sit, W - 34);
  d.text(sitW, 16, y + 15);
  y += 32;

  // KPI Cards
  y = kpiCards(d, [
    { label: 'Total Records',   val: fmtN(info.rows),        color: C.green },
    { label: 'Completeness',    val: `${completeness}%`,     color: info.totalNulls > 0 ? C.orange : C.green },
    { label: 'Missing Values',  val: fmtN(info.totalNulls),  sub: pct(info.totalNulls, info.rows * info.columns.length), color: info.totalNulls > 0 ? C.red : C.green },
    { label: 'Duplicates',      val: fmtN(info.duplicates),  sub: pct(info.duplicates, info.rows), color: info.duplicates > 0 ? C.red : C.green },
    { label: 'Health Score',    val: `${health.score}%`,     color: health.score >= 80 ? C.green : health.score >= 60 ? C.orange : C.red },
  ], y + 4) + 8;

  // 02 — COLUMN SUMMARY TABLE
  y = secHead(d, '02   COLUMN-LEVEL DATA QUALITY REPORT', y, C.sky);

  const colW = [55, 22, 22, 28, 28, 28];
  y = tableRow(d, ['Column Name', 'Type', 'Missing', 'Miss %', 'Unique', 'Health'], y, colW, 10, true);
  info.columns.slice(0, 18).forEach((col, i) => {
    const missPct = info.rows > 0 ? ((col.nullCount ?? 0) / info.rows * 100).toFixed(1) + '%' : '0%';
    const colHealth = info.rows > 0 ? Math.round(((info.rows - (col.nullCount ?? 0)) / info.rows) * 100) : 100;
    y = tableRow(d, [
      col.name,
      col.type,
      String(col.nullCount ?? 0),
      missPct,
      String(col.uniqueCount ?? 0),
      `${colHealth}%`,
    ], y, colW, 10, false, i % 2 === 1);
    if (y > 260) return;
  });
  if (info.columns.length > 18) {
    d.setFontSize(7); rgb(d, C.slate);
    d.text(`... and ${info.columns.length - 18} more columns`, 14, y + 5);
    y += 10;
  }

  return y;
}

// ══════════════════════════════════════════════════════════════════
// PAGE 3 — ANOMALY + STRATEGIC RECOMMENDATIONS
// ══════════════════════════════════════════════════════════════════
function drawPage3(
  d: jsPDF,
  info: DatasetInfo,
  health: { score: number; label: string },
  insights: { title: string; description: string; type: string }[]
) {
  const W = d.internal.pageSize.getWidth();
  fill(d, C.white, 0, 0, W, 297);
  let y = 22;

  const numCols = info.columns.filter(c => c.type === 'numeric');

  // 03 — ANOMALY DETECTION
  y = secHead(d, '03   ANOMALY DETECTION & RISK SIGNALS', y, C.red);

  const anomalies: { tag: string; text: string; color: [number,number,number] }[] = [];
  if (info.duplicates > 0)
    anomalies.push({ tag: 'CRITICAL — Duplicates:', text: `${fmtN(info.duplicates)} duplicate rows found (${pct(info.duplicates, info.rows)} of dataset). All aggregate KPIs are currently overstated. Immediate deduplication required before any reporting.`, color: C.red });
  if (info.totalNulls > 0) {
    const np = ((info.totalNulls / (info.rows * info.columns.length)) * 100).toFixed(1);
    anomalies.push({ tag: 'WARNING — Missing Data:', text: `${fmtN(info.totalNulls)} null values detected (${np}% of all cells). Imputation or exclusion needed before statistical modeling.`, color: C.orange });
  }
  numCols.forEach(c => {
    if (c.min !== undefined && c.max !== undefined && c.mean !== undefined && c.max > 0) {
      const ratio = (c.max - c.min) / (c.mean || 1);
      if (ratio > 10)
        anomalies.push({ tag: `OUTLIER — "${c.name}":`, text: `Value range ${c.min.toFixed(2)} → ${c.max.toFixed(2)} (${ratio.toFixed(1)}× mean). Likely outlier records. Requires segment-level review.`, color: C.sky });
    }
  });
  if (anomalies.length === 0)
    anomalies.push({ tag: 'ALL CLEAR:', text: 'No critical anomalies detected. All numeric columns are within acceptable ranges. Dataset is ready for analysis.', color: C.green });

  anomalies.forEach(item => {
    fill(d, C.lightBg, 10, y, W - 20, 16);
    d.setDrawColor(...C.border); d.rect(10, y, W - 20, 16, 'S');
    fill(d, item.color, 10, y, 3, 16);
    d.setFont('helvetica', 'bold'); d.setFontSize(7.5); d.setTextColor(...item.color);
    d.text(item.tag, 16, y + 6);
    d.setFont('helvetica', 'normal'); d.setFontSize(7.5); rgb(d, C.navy);
    const w = d.splitTextToSize(item.text, W - 34);
    d.text(w[0] ?? '', 16, y + 12);
    y += 20;
  });
  y += 4;

  // 04 — STRATEGIC DECISION SCENARIOS
  y = secHead(d, '04   STRATEGIC DECISION ARCHITECTURE — 3 PATHS FORWARD', y, C.navy);

  const scenarios = [
    { label: 'PATH A — SAFE (Low Risk)', desc: `Clean data first: remove ${fmtN(info.duplicates)} duplicates and fill ${fmtN(info.totalNulls)} missing values. Export a validated, clean dataset for reporting. Timeline: 1 day. Output: 100% reliable baseline metrics.`, color: C.green },
    { label: 'PATH B — BALANCED (Medium Risk)', desc: `Clean + Analyze: After cleaning, apply segmentation on "${numCols[0]?.name ?? 'key columns'}" to identify top and under-performing groups. Provide management with actionable segment-level insights. Timeline: 3 days.`, color: C.sky },
    { label: 'PATH C — BOLD (High ROI)', desc: `Full Intelligence Loop: Clean → Segment → Predict. Feed cleaned data into a forecasting model. Automate threshold alerts when KPIs deviate by >2 standard deviations. Timeline: 1 week.`, color: C.gold },
  ];

  scenarios.forEach(s => {
    fill(d, C.white, 10, y, W - 20, 26);
    d.setDrawColor(...C.border); d.rect(10, y, W - 20, 26, 'S');
    fill(d, s.color, 10, y, 3, 26);
    d.setFont('helvetica', 'bold'); d.setFontSize(8.5); d.setTextColor(...s.color);
    d.text(s.label, 16, y + 8);
    d.setFont('helvetica', 'normal'); d.setFontSize(7.5); rgb(d, C.navy);
    const w = d.splitTextToSize(s.desc, W - 34);
    d.text(w.slice(0, 2), 16, y + 16);
    y += 30;
  });
  y += 4;

  // 05 — FINAL RECOMMENDATION
  y = secHead(d, '05   FINAL RECOMMENDATION — NEXT 24-HOUR ACTION PLAN', y, C.gold);

  fill(d, C.lightBg, 10, y, W - 20, 52);
  d.setDrawColor(...C.border); d.rect(10, y, W - 20, 52, 'S');
  fill(d, C.goldL, 10, y, W - 20, 3);

  const recs = [
    info.duplicates > 0 || info.totalNulls > 0
      ? `Step 1: Run "Magic Clean" immediately — remove ${fmtN(info.duplicates)} duplicates and impute ${fmtN(info.totalNulls)} null values. No decision should be based on uncleaned data.`
      : `Step 1: Data is clean (${health.label}). Proceed directly to segmentation analysis.`,
    numCols.length > 0
      ? `Step 2: Set a KPI alert on "${numCols[0].name}" — trigger escalation if value drops below ${((numCols[0].mean ?? 0) * 0.8).toFixed(2)} or exceeds ${((numCols[0].mean ?? 0) * 1.2).toFixed(2)}.`
      : `Step 2: Add numeric KPI columns to enable automated threshold monitoring.`,
    `Step 3: Distribute this report to all department heads. Assign an owner to each anomaly in Section 03 with a 48-hour resolution deadline.`,
  ];

  recs.forEach((rec, i) => {
    d.setFont('helvetica', 'normal'); d.setFontSize(8); rgb(d, C.navy);
    const w = d.splitTextToSize(rec, W - 36);
    d.text(w, 16, y + 14 + i * 14);
  });
  y += 58;

  // 06 — AI INSIGHTS (if space remains)
  if (insights.length > 0 && y < 225) {
    y = secHead(d, '06   AI-GENERATED NARRATIVE INSIGHTS', y, C.sky);
    const cfg: Record<string, { c: [number,number,number]; lbl: string }> = {
      positive: { c: C.green, lbl: '▲ POSITIVE' },
      warning:  { c: C.red,   lbl: '▼ WARNING'  },
      info:     { c: C.sky,   lbl: '● INSIGHT'  },
    };
    insights.slice(0, 3).forEach(ins => {
      if (y > 260) return;
      const t = cfg[ins.type] ?? cfg.info;
      fill(d, C.lightBg, 10, y, W - 20, 18);
      d.setDrawColor(...C.border); d.rect(10, y, W - 20, 18, 'S');
      fill(d, t.c, 10, y, 3, 18);
      d.setFont('helvetica', 'bold'); d.setFontSize(7); d.setTextColor(...t.c);
      d.text(t.lbl, 16, y + 6);
      d.setFont('helvetica', 'bold'); d.setFontSize(8); rgb(d, C.navy);
      d.text(d.splitTextToSize(ins.title, W - 34)[0] ?? '', 16, y + 12);
      d.setFont('helvetica', 'normal'); d.setFontSize(7); rgb(d, C.slate);
      d.text(d.splitTextToSize(ins.description, W - 34)[0] ?? '', 16, y + 17);
      y += 22;
    });
  }
}

// ══════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════
export async function generateExecutiveReport(
  info: DatasetInfo,
  health: { score: number; label: string; color: string },
  options: ReportOptions = {}
): Promise<void> {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const file = info.filename || 'Dataset';
  const now  = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const logo = await loadLogo();

  // Page 1 — Cover
  await drawCover(doc, { ...options, filename: file, rows: info.rows, cols: info.columns.length, generatedAt: now });

  // Page 2 — Executive Summary + Column Table
  doc.addPage();
  fill(doc, C.white, 0, 0, 210, 297);
  drawPage2(doc, info, health);

  // Page 3 — Anomalies + Decisions + Recommendations
  doc.addPage();
  fill(doc, C.white, 0, 0, 210, 297);
  drawPage3(doc, info, health, options.insights ?? []);

  // Apply header/footer to pages 2+
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    pageChrome(doc, p, total, file, logo);
  }

  doc.save(`Kimit_Executive_Report_${file.replace(/[^a-z0-9_-]/gi, '_')}.pdf`);
}
