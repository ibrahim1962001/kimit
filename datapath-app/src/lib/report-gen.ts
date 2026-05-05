/**
 * report-gen.ts — Kimit AI Data Storyteller
 * Compiles active charts, AI insights, KPI stats, and growth indicators
 * into a professionally branded multi-page PDF report.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { DatasetInfo } from '../types';
import logoImg from '../assets/logo.png';

// ── Brand Palette ─────────────────────────────────────────────────────────────
const BRAND = {
  bg:       [10,  15,  29]  as [number, number, number],
  surface:  [15,  23,  42]  as [number, number, number],
  gold:     [212, 175, 55]  as [number, number, number],
  goldDim:  [163, 130, 10]  as [number, number, number],
  emerald:  [16,  185, 129] as [number, number, number],
  sky:      [56,  189, 248] as [number, number, number],
  slate:    [148, 163, 184] as [number, number, number],
  red:      [239, 68,  68]  as [number, number, number],
  white:    [241, 245, 249] as [number, number, number],
  dim:      [71,  85,  105] as [number, number, number],
};

export interface ReportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  chartElementIds?: string[];
  insights?: { title: string; description: string; type: 'info' | 'positive' | 'warning' }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rgb(doc: jsPDF, color: [number, number, number]) { doc.setTextColor(...color); }
function fillRect(doc: jsPDF, color: [number, number, number], x: number, y: number, w: number, h: number) { doc.setFillColor(...color); doc.rect(x, y, w, h, 'F'); }
function line(doc: jsPDF, color: [number, number, number], x1: number, y1: number, x2: number, y2: number, lw = 0.3) { doc.setDrawColor(...color); doc.setLineWidth(lw); doc.line(x1, y1, x2, y2); }
function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = logoImg;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

// ── Cover Page ────────────────────────────────────────────────────────────────
async function drawCover(doc: jsPDF, opts: ReportOptions & { filename: string; rows: number; cols: number; generatedAt: string }) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  fillRect(doc, BRAND.bg, 0, 0, W, H);
  fillRect(doc, BRAND.gold, 0, 0, W, 3);
  fillRect(doc, BRAND.gold, 0, H - 3, W, 3);
  fillRect(doc, BRAND.goldDim, 0, 0, 5, H);

  // Logo & Header
  const logo = await loadLogo();
  if (logo) {
    doc.addImage(logo, 'PNG', 15, 15, 14, 14);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  rgb(doc, BRAND.gold);
  doc.text('KIMIT AI STUDIO', 32, 21);
  doc.setFontSize(9);
  rgb(doc, BRAND.slate);
  doc.text('Advanced Data Intelligence & Analytics', 32, 27);

  // Main title
  const titleY = H * 0.38;
  rgb(doc, BRAND.gold);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.title || 'Executive Data Report', W / 2, titleY, { align: 'center' });

  if (opts.subtitle) {
    rgb(doc, BRAND.slate);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(opts.subtitle, W / 2, titleY + 16, { align: 'center' });
  }

  line(doc, BRAND.goldDim, 30, titleY + 28, W - 30, titleY + 28, 0.5);

  // Meta box
  const metaY = titleY + 45;
  const metaItems = [
    { label: 'File Analyzed', value: opts.filename },
    { label: 'Total Records', value: formatNumber(opts.rows) },
    { label: 'Total Columns', value: String(opts.cols) },
    { label: 'Generated On', value: opts.generatedAt },
  ];

  metaItems.forEach((item, i) => {
    const colX = i % 2 === 0 ? W / 2 - 40 : W / 2 + 40;
    const rowY = metaY + Math.floor(i / 2) * 22;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    rgb(doc, BRAND.goldDim);
    doc.text(item.label.toUpperCase(), colX, rowY, { align: 'center' });
    doc.setFontSize(13);
    rgb(doc, BRAND.white);
    doc.text(item.value, colX, rowY + 7, { align: 'center' });
  });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  rgb(doc, BRAND.dim);
  doc.text('CONFIDENTIAL & PROPRIETARY — MANAGER USE ONLY', W / 2, H - 15, { align: 'center' });
}

function drawSectionHeader(doc: jsPDF, title: string, y: number): number {
  const W = doc.internal.pageSize.getWidth();
  fillRect(doc, BRAND.surface, 10, y - 6, W - 20, 14);
  fillRect(doc, BRAND.gold, 10, y - 6, 3, 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); rgb(doc, BRAND.gold);
  doc.text(title, 17, y + 3);
  return y + 16;
}

function drawPageChrome(doc: jsPDF, pageNum: number, totalPages: number, filename: string, logo: HTMLImageElement | null) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  fillRect(doc, BRAND.bg, 0, 0, W, 14);
  fillRect(doc, BRAND.gold, 0, 14, W, 0.5);
  if (logo) { doc.addImage(logo, 'PNG', 10, 3, 8, 8); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); rgb(doc, BRAND.gold);
  doc.text('KIMIT AI STUDIO', 22, 9);
  rgb(doc, BRAND.slate);
  doc.text(filename, W / 2, 9, { align: 'center' });
  doc.text(`PAGE ${pageNum} / ${totalPages}`, W - 10, 9, { align: 'right' });

  fillRect(doc, BRAND.gold, 0, H - 10, W, 0.5);
  doc.setFontSize(7); rgb(doc, BRAND.dim);
  doc.text('Generated by Kimit AI Studio • Managerial Intelligence Report', W / 2, H - 4, { align: 'center' });
}

// ── Page 2: KPI & Data Health ─────────────────────────────────────────────────
function drawDataDetailsPage(doc: jsPDF, info: DatasetInfo, health: { score: number; label: string; color: string }) {
  const W = doc.internal.pageSize.getWidth();
  let y = 26;

  y = drawSectionHeader(doc, '01  DATASET METRICS & HEALTH', y);
  y += 4;

  const kpis = [
    { label: 'Total Records', value: formatNumber(info.rows), color: BRAND.emerald },
    { label: 'Data Columns', value: String(info.columns.length), color: BRAND.sky },
    { label: 'Missing Values', value: String(info.totalNulls), color: info.totalNulls > 0 ? BRAND.red : BRAND.emerald },
    { label: 'Duplicates', value: String(info.duplicates), color: info.duplicates > 0 ? BRAND.red : BRAND.emerald },
    { label: 'Numeric Cols', value: String(info.columns.filter(c => c.type === 'numeric').length), color: BRAND.gold },
    { label: 'Text Cols', value: String(info.columns.filter(c => c.type === 'text').length), color: BRAND.slate },
    { label: 'Health Score', value: `${health.score}%`, color: BRAND.emerald },
    { label: 'Data Quality', value: health.label, color: BRAND.gold },
  ];

  const cardW = (W - 30) / 4; const cardH = 28;
  kpis.forEach((kpi, i) => {
    const col = i % 4; const row = Math.floor(i / 4);
    const cx = 10 + col * (cardW + 3); const cy = y + row * (cardH + 6);
    fillRect(doc, BRAND.surface, cx, cy, cardW, cardH);
    doc.setDrawColor(...BRAND.dim); doc.setLineWidth(0.2); doc.rect(cx, cy, cardW, cardH);
    fillRect(doc, kpi.color, cx, cy, cardW, 2);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); rgb(doc, BRAND.slate); doc.text(kpi.label.toUpperCase(), cx + 4, cy + 10);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...kpi.color); doc.text(kpi.value, cx + 4, cy + 22);
  });
  y += 2 * (cardH + 6) + 12;

  y = drawSectionHeader(doc, '02  COMPREHENSIVE COLUMN PROFILE', y);
  y += 2;

  const colHeaders = ['Column Name', 'Type', 'Nulls', 'Unique', 'Min', 'Max', 'Mean'];
  const colWidths = [55, 18, 16, 18, 22, 22, 22];
  const rowH = 8;

  fillRect(doc, BRAND.surface, 10, y, W - 20, rowH);
  fillRect(doc, BRAND.gold, 10, y, W - 20, 0.5); fillRect(doc, BRAND.gold, 10, y + rowH, W - 20, 0.5);
  let tx = 12;
  colHeaders.forEach((h, i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); rgb(doc, BRAND.gold); doc.text(h, tx, y + 5.5); tx += colWidths[i];
  });
  y += rowH;

  const cols = info.columns.slice(0, 25);
  cols.forEach((col, idx) => {
    if (idx > 0 && idx % 2 === 0) fillRect(doc, BRAND.surface, 10, y, W - 20, rowH);
    tx = 12;
    const vals = [
      col.name.length > 22 ? col.name.slice(0, 22) + '…' : col.name, col.type, String(col.nullCount), String(col.uniqueCount),
      col.min !== undefined ? col.min.toFixed(1) : '—', col.max !== undefined ? col.max.toFixed(1) : '—', col.mean !== undefined ? col.mean.toFixed(2) : '—',
    ];
    vals.forEach((v, i) => {
      doc.setFont('helvetica', i === 1 ? 'bold' : 'normal'); doc.setFontSize(7);
      rgb(doc, i === 1 ? (col.type === 'numeric' ? BRAND.sky : BRAND.gold) : BRAND.slate);
      doc.text(v, tx, y + 5.5); tx += colWidths[i];
    });
    y += rowH;
  });
  return y;
}

// ── Page 3: Insights & Improvement Suggestions ──────────────────────────────
function drawInsightsAndSuggestions(
  doc: jsPDF,
  info: DatasetInfo,
  insights: { title: string; description: string; type: 'info' | 'positive' | 'warning' }[]
) {
  const W = doc.internal.pageSize.getWidth();
  let y = 26;

  y = drawSectionHeader(doc, '03  AI ANALYTICAL INSIGHTS', y);
  y += 4;

  const typeConfig = {
    positive: { color: BRAND.emerald, icon: '✓', label: 'POSITIVE' },
    warning:  { color: BRAND.red,     icon: '⚠', label: 'WARNING'  },
    info:     { color: BRAND.sky,     icon: '●', label: 'INSIGHT'  },
  };

  insights.slice(0, 6).forEach((ins) => {
    const cfg = typeConfig[ins.type];
    fillRect(doc, BRAND.surface, 10, y, W - 20, 1); fillRect(doc, cfg.color, 10, y, 3, 22);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...cfg.color); doc.text(`${cfg.icon}  ${cfg.label}`, 17, y + 6);
    doc.setFontSize(9); rgb(doc, BRAND.white); doc.text(ins.title, 17, y + 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); rgb(doc, BRAND.slate);
    const wrapped = doc.splitTextToSize(ins.description, W - 30); doc.text(wrapped, 17, y + 19);
    y += 12 + wrapped.length * 4 + 6; fillRect(doc, BRAND.surface, 10, y - 2, W - 20, 0.2);
  });

  y += 6;
  y = drawSectionHeader(doc, '04  ACTIONABLE IMPROVEMENT SUGGESTIONS', y);
  y += 4;

  const suggestions: { title: string; desc: string }[] = [];
  if (info.totalNulls > 0) {
    suggestions.push({ title: 'Data Imputation Required', desc: `Detected ${info.totalNulls} missing values. Consider using the Magic Clean tool to auto-fill these gaps using statistical means or dropping incomplete records to prevent skewed analysis.` });
  }
  if (info.duplicates > 0) {
    suggestions.push({ title: 'Remove Duplicated Records', desc: `Found ${info.duplicates} duplicate rows. Deduplicating the dataset will improve processing speed and ensure metric accuracy.` });
  }
  const numericCols = info.columns.filter(c => c.type === 'numeric');
  if (numericCols.length > 0) {
    suggestions.push({ title: 'Outlier Investigation', desc: `Numeric fields like "${numericCols[0].name}" may contain statistical outliers. Use the Z-Score filter in the Data Grid to isolate and review these anomalies.` });
  }
  if (suggestions.length === 0) {
    suggestions.push({ title: 'Pristine Data Quality', desc: 'The dataset structure is excellent. Proceed with advanced machine learning modeling or creating multi-metric custom charts in the Dashboard.' });
  }
  suggestions.push({ title: 'Cross-Filter Exploitation', desc: 'Leverage the interactive charts by clicking on segments to drill down into specific data subsets and uncover hidden correlations.' });

  suggestions.forEach(sug => {
    fillRect(doc, BRAND.surface, 10, y, W - 20, 1); fillRect(doc, BRAND.gold, 10, y, 3, 22);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); rgb(doc, BRAND.gold); doc.text('💡 STRATEGY', 17, y + 6);
    doc.setFontSize(9); rgb(doc, BRAND.white); doc.text(sug.title, 17, y + 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); rgb(doc, BRAND.slate);
    const wrapped = doc.splitTextToSize(sug.desc, W - 30); doc.text(wrapped, 17, y + 19);
    y += 12 + wrapped.length * 4 + 6; fillRect(doc, BRAND.surface, 10, y - 2, W - 20, 0.2);
  });
}

// ── Chart Capture ─────────────────────────────────────────────────────────────
async function drawChartPage(doc: jsPDF, elementId: string, title: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) return;
  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#0a0f1d', useCORS: true, allowTaint: true, logging: false });
    doc.addPage();
    const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
    fillRect(doc, BRAND.bg, 0, 0, W, H);
    let y = 26;
    y = drawSectionHeader(doc, title, y);
    y += 4;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const maxW = W - 20; const maxH = H - y - 20;
    const ratio = canvas.width / canvas.height;
    const imgW = Math.min(maxW, maxH * ratio); const imgH = imgW / ratio;
    const cx = (W - imgW) / 2;
    doc.addImage(imgData, 'JPEG', cx, y, imgW, imgH);
  } catch (err) {
    console.warn(`[ReportGen] Capture failed for #${elementId}:`, err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateExecutiveReport(
  info: DatasetInfo,
  health: { score: number; label: string; color: string },
  options: ReportOptions = {}
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const filename = info.filename || 'Dataset';
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const logo = await loadLogo();

  // Page 1: Cover
  await drawCover(doc, { ...options, filename, rows: info.rows, cols: info.columns.length, generatedAt: now });

  // Page 2: KPI + Columns
  doc.addPage();
  fillRect(doc, BRAND.bg, 0, 0, 210, 297);
  drawDataDetailsPage(doc, info, health);

  // Page 3: Insights + Suggestions
  const insightsToRender = options.insights && options.insights.length > 0 ? options.insights : [];
  doc.addPage();
  fillRect(doc, BRAND.bg, 0, 0, 210, 297);
  drawInsightsAndSuggestions(doc, info, insightsToRender);

  // Pages 4+: Charts
  const chartIds = options.chartElementIds ?? [];
  for (let i = 0; i < chartIds.length; i++) {
    await drawChartPage(doc, chartIds[i], `05.${i + 1}  VISUALIZATION — ${chartIds[i].replace(/-/g, ' ').toUpperCase()}`);
  }

  // Add Headers/Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageChrome(doc, p, totalPages, filename, logo);
  }

  const safeName = filename.replace(/[^a-z0-9_-]/gi, '_');
  doc.save(`Kimit_Manager_Report_${safeName}.pdf`);
}

