/**
 * Gamma-style executive presentation PDF
 * — light canvas, slide-per-topic, card grids, large type, minimal chrome
 */
import jsPDF from 'jspdf';
import type { DatasetInfo } from '../types';
import logoImg from '../assets/logo.png';
import {
  ensurePdfArabicFont,
  pickPdfFont,
  PDF_FONT_ARABIC,
  PDF_FONT_LATIN,
} from './pdfFonts';
import { latinizeBriefingForPdf, latinizeColumnName } from './reportPdfLabels';

// ── Gamma-inspired palette (light deck) ───────────────────────────────
const G = {
  canvas: [252, 251, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  ink: [23, 23, 33] as [number, number, number],
  inkSoft: [71, 71, 95] as [number, number, number],
  inkMuted: [130, 130, 155] as [number, number, number],
  border: [230, 228, 240] as [number, number, number],
  accent: [99, 91, 255] as [number, number, number],
  accent2: [56, 189, 248] as [number, number, number],
  accentSoft: [237, 236, 255] as [number, number, number],
  mint: [16, 185, 129] as [number, number, number],
  mintSoft: [236, 253, 245] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  amberSoft: [255, 251, 235] as [number, number, number],
  rose: [244, 63, 94] as [number, number, number],
  roseSoft: [255, 241, 242] as [number, number, number],
  violet: [139, 92, 246] as [number, number, number],
  violetSoft: [245, 243, 255] as [number, number, number],
};

export interface ReportBriefing {
  executiveSummary: string;
  insights: string[];
  warnings: string[];
  qualityIssues: string[];
  recommendations: string[];
  opportunities: string[];
  isLocal?: boolean;
}

export interface ReportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  aiSummary?: string;
  insights?: { title: string; description: string; type: 'info' | 'positive' | 'warning' }[];
  briefing?: ReportBriefing;
}

type RGB = [number, number, number];
type PdfFont = typeof PDF_FONT_LATIN | typeof PDF_FONT_ARABIC;
type SlideCtx = {
  doc: jsPDF;
  W: number;
  H: number;
  logo: HTMLImageElement | null;
  file: string;
  font: PdfFont;
  rtl: boolean;
};

const LINE = 5.2;

function setPdfFont(ctx: SlideCtx, size: number, bold = false) {
  if (ctx.font === PDF_FONT_ARABIC) {
    ctx.doc.setFont(PDF_FONT_ARABIC, 'normal');
    ctx.doc.setFontSize(bold ? size + 0.5 : size);
  } else {
    ctx.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    ctx.doc.setFontSize(size);
  }
}

function pdfSplit(ctx: SlideCtx, text: string, maxW: number): string[] {
  setPdfFont(ctx, ctx.doc.getFontSize() || 9);
  return ctx.doc.splitTextToSize(text, maxW);
}

/** Draw wrapped text; returns bottom Y. */
function pdfWrite(
  ctx: SlideCtx,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts?: { align?: 'left' | 'right' | 'center'; size?: number; bold?: boolean; lineHeight?: number },
): number {
  const lh = opts?.lineHeight ?? LINE;
  if (opts?.size) setPdfFont(ctx, opts.size, opts.bold);
  const lines = pdfSplit(ctx, text, maxW);
  const align = opts?.align ?? (ctx.rtl ? 'right' : 'left');
  const ax = align === 'right' ? x + maxW : align === 'center' ? x + maxW / 2 : x;
  ctx.doc.text(lines, ax, y, { align });
  return y + lines.length * lh;
}

const fmtN = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toLocaleString();
const pct = (a: number, b: number) => (b === 0 ? '0%' : ((a / b) * 100).toFixed(1) + '%');

async function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = logoImg;
    img.onload = () => res(img);
    img.onerror = () => res(null);
  });
}

function fill(d: jsPDF, c: RGB, x: number, y: number, w: number, h: number, r = 0) {
  d.setFillColor(...c);
  if (r > 0) d.roundedRect(x, y, w, h, r, r, 'F');
  else d.rect(x, y, w, h, 'F');
}

function textRgb(d: jsPDF, c: RGB) {
  d.setTextColor(...c);
}

function slideBg(ctx: SlideCtx) {
  const { doc, W, H } = ctx;
  fill(doc, G.canvas, 0, 0, W, H);
  // soft gradient accent (top-right blob)
  fill(doc, G.accentSoft, W - 95, -25, 120, 90, 60);
  fill(doc, G.violetSoft, W - 140, 15, 70, 50, 35);
}

function slideChrome(ctx: SlideCtx, page: number, total: number, tag?: string) {
  const { doc, W, H, logo, file } = ctx;
  if (logo) doc.addImage(logo, 'PNG', 14, 10, 11, 11);
  setPdfFont(ctx, 8, true);
  textRgb(doc, G.inkMuted);
  doc.text('KIMIT AI STUDIO', logo ? 28 : 14, 17);

  if (tag) {
    setPdfFont(ctx, 7, true);
    const tw = doc.getTextWidth(tag) + 10;
    fill(doc, G.accentSoft, W - tw - 14, 10, tw, 9, 4);
    textRgb(doc, G.accent);
    doc.text(tag.toUpperCase(), W - 14 - tw / 2, 16.5, { align: 'center' });
  }

  setPdfFont(ctx, 7);
  textRgb(doc, G.inkMuted);
  const fname = file.length > 42 ? file.slice(0, 39) + '…' : file;
  doc.text(fname, ctx.rtl ? W - 14 : 14, H - 8, { align: ctx.rtl ? 'right' : 'left' });
  doc.text(`${page} / ${total}`, ctx.rtl ? 14 : W - 14, H - 8, { align: ctx.rtl ? 'left' : 'right' });
}

function accentBar(doc: jsPDF, y: number, W: number, h = 3) {
  const seg = W / 4;
  fill(doc, G.accent, 0, y, seg, h);
  fill(doc, G.violet, seg, y, seg, h);
  fill(doc, G.accent2, seg * 2, y, seg, h);
  fill(doc, G.mint, seg * 3, y, seg, h);
}

function slideTitle(ctx: SlideCtx, title: string, subtitle: string, y: number): number {
  const { doc, W, rtl } = ctx;
  const pad = 28;
  const maxW = W - 56;
  const x = rtl ? W - pad : pad;
  setPdfFont(ctx, 26, true);
  textRgb(doc, G.ink);
  const lines = pdfSplit(ctx, title, maxW);
  doc.text(lines, x, y, { align: rtl ? 'right' : 'left' });
  y += lines.length * 11 + 4;
  setPdfFont(ctx, 11);
  textRgb(doc, G.inkSoft);
  const sub = pdfSplit(ctx, subtitle, maxW);
  doc.text(sub, x, y, { align: rtl ? 'right' : 'left' });
  return y + sub.length * 6 + 8;
}

function pill(ctx: SlideCtx, label: string, x: number, y: number, bg: RGB, fg: RGB): number {
  const { doc } = ctx;
  setPdfFont(ctx, 7, true);
  const w = doc.getTextWidth(label) + 12;
  fill(doc, bg, x, y, w, 8, 4);
  textRgb(doc, fg);
  doc.text(label.toUpperCase(), x + 6, y + 5.5);
  return w + 6;
}

function metricCard(
  ctx: SlideCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub: string,
  accent: RGB,
  soft: RGB,
) {
  const { doc, rtl } = ctx;
  fill(doc, G.white, x, y, w, h, 8);
  doc.setDrawColor(...G.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 8, 8, 'S');
  fill(doc, soft, x + 1, y + 1, w - 2, 14, 7);
  fill(doc, accent, x + 1, y + 1, w - 2, 2.5, 7);

  const tx = rtl ? x + w - 10 : x + 10;
  setPdfFont(ctx, 7, true);
  textRgb(doc, G.inkMuted);
  doc.text(label.toUpperCase(), tx, y + 11, { align: rtl ? 'right' : 'left' });
  setPdfFont(ctx, 22, true);
  textRgb(doc, G.ink);
  doc.text(value, tx, y + 28, { align: rtl ? 'right' : 'left' });
  setPdfFont(ctx, 8);
  textRgb(doc, G.inkSoft);
  const subLines = pdfSplit(ctx, sub, w - 16);
  doc.text(subLines[0] ?? sub, tx, y + h - 8, { align: rtl ? 'right' : 'left' });
}

function measureInsightHeight(ctx: SlideCtx, text: string, w: number): number {
  setPdfFont(ctx, 9.5);
  const lines = pdfSplit(ctx, text, w - 32);
  return Math.max(40, 26 + lines.length * LINE + 8);
}

function insightCard(
  ctx: SlideCtx,
  x: number,
  y: number,
  w: number,
  index: number,
  text: string,
  accent: RGB,
  soft: RGB,
): number {
  const { doc, rtl } = ctx;
  const h = measureInsightHeight(ctx, text, w);
  fill(doc, soft, x, y, w, h, 10);
  fill(doc, accent, rtl ? x + w - 6 : x, y, 6, h, 10);

  const numX = rtl ? x + w - 18 : x + 14;
  setPdfFont(ctx, 16, true);
  textRgb(doc, accent);
  doc.text(String(index).padStart(2, '0'), numX, y + 16, { align: rtl ? 'right' : 'left' });

  const textX = rtl ? x + w - 22 : x + 22;
  const textW = w - 32;
  setPdfFont(ctx, 9.5);
  textRgb(doc, G.ink);
  const lines = pdfSplit(ctx, text, textW);
  doc.text(lines, textX, y + 24, { align: rtl ? 'right' : 'left' });
  return h;
}

function bulletCard(
  ctx: SlideCtx,
  x: number,
  y: number,
  w: number,
  text: string,
  n: number,
  accent: RGB,
): number {
  const { doc, rtl } = ctx;
  setPdfFont(ctx, 9);
  const lines = pdfSplit(ctx, text, w - 36);
  const h = Math.max(24, 14 + lines.length * LINE);
  fill(doc, G.white, x, y, w, h, 6);
  doc.setDrawColor(...G.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 6, 6, 'S');

  const badgeX = rtl ? x + w - 20 : x + 8;
  fill(doc, accent, badgeX, y + 6, 10, 10, 5);
  setPdfFont(ctx, 9, true);
  textRgb(doc, G.white);
  doc.text(String(n), badgeX + 5, y + 13.5, { align: 'center' });

  const textX = rtl ? x + w - 26 : x + 24;
  setPdfFont(ctx, 9);
  textRgb(doc, G.ink);
  doc.text(lines, textX, y + 12, { align: rtl ? 'right' : 'left' });
  return h + 8;
}

// ── SLIDE: Cover ──────────────────────────────────────────────────────
function slideCover(ctx: SlideCtx, opts: {
  title: string;
  subtitle: string;
  filename: string;
  rows: number;
  cols: number;
  generatedAt: string;
  author?: string;
}) {
  const { doc, W, H } = ctx;
  slideBg(ctx);
  accentBar(doc, 0, W, 5);

  fill(doc, G.white, 24, 32, W - 48, H - 64, 14);
  doc.setDrawColor(...G.border);
  doc.setLineWidth(0.35);
  doc.roundedRect(24, 32, W - 48, H - 64, 14, 14, 'S');

  const pad = ctx.rtl ? W - 40 : 40;
  let y = 58;
  pill(ctx, 'Executive Report', ctx.rtl ? pad - 80 : pad, y, G.accentSoft, G.accent);
  y += 22;

  setPdfFont(ctx, 34, true);
  textRgb(doc, G.ink);
  const titleLines = pdfSplit(ctx, opts.title, W - 96);
  doc.text(titleLines, pad, y, { align: ctx.rtl ? 'right' : 'left' });
  y += titleLines.length * 14 + 6;

  setPdfFont(ctx, 14);
  textRgb(doc, G.inkSoft);
  pdfWrite(ctx, opts.subtitle, pad, y, W - 96, { align: ctx.rtl ? 'right' : 'left' });
  y += 20;

  const metaW = (W - 96) / 4;
  const metas = [
    { l: 'Dataset', v: opts.filename },
    { l: 'Records', v: fmtN(opts.rows) },
    { l: 'Columns', v: String(opts.cols) },
    { l: 'Generated', v: opts.generatedAt.split(',')[0] ?? opts.generatedAt },
  ];
  metas.forEach((m, i) => {
    const mx = 40 + i * (metaW + 4);
    const my = H - 72;
    fill(doc, G.canvas, mx, my, metaW - 4, 28, 6);
    setPdfFont(ctx, 7, true);
    textRgb(doc, G.inkMuted);
    doc.text(m.l.toUpperCase(), mx + 8, my + 10);
    setPdfFont(ctx, 10);
    textRgb(doc, G.ink);
    const vl = pdfSplit(ctx, m.v, metaW - 16);
    doc.text(vl[0] ?? '', mx + 8, my + 20);
  });

  setPdfFont(ctx, 8);
  textRgb(doc, G.inkMuted);
  doc.text(opts.author || 'Kimit AI Studio · Data Intelligence', pad, H - 38, {
    align: ctx.rtl ? 'right' : 'left',
  });
  slideChrome(ctx, 1, 0, 'Cover');
}

// ── SLIDE: KPI overview ───────────────────────────────────────────────
function slideOverview(
  ctx: SlideCtx,
  info: DatasetInfo,
  health: { score: number; label: string },
  page: number,
  total: number,
) {
  const { doc, W, H } = ctx;
  doc.addPage();
  slideBg(ctx);
  accentBar(doc, 0, W, 3);

  let y = slideTitle(ctx, 'At a glance', 'Your dataset in four numbers that matter for decision-making.', 28);
  y += 6;

  const completeness =
    info.rows * info.columns.length > 0
      ? (100 - (info.totalNulls / (info.rows * info.columns.length)) * 100).toFixed(1)
      : '100.0';

  const cw = (W - 56 - 18) / 4;
  const ch = 52;
  metricCard(ctx, 28, y, cw, ch, 'Total records', fmtN(info.rows), info.filename, G.accent, G.accentSoft);
  metricCard(ctx, 28 + cw + 6, y, cw, ch, 'Completeness', `${completeness}%`, 'Non-null cells', G.mint, G.mintSoft);
  metricCard(
    ctx,
    28 + (cw + 6) * 2,
    y,
    cw,
    ch,
    'Duplicates',
    fmtN(info.duplicates),
    pct(info.duplicates, info.rows) + ' of rows',
    info.duplicates > 0 ? G.rose : G.mint,
    info.duplicates > 0 ? G.roseSoft : G.mintSoft,
  );
  metricCard(
    ctx,
    28 + (cw + 6) * 3,
    y,
    cw,
    ch,
    'Health score',
    `${health.score}`,
    health.label,
    health.score >= 80 ? G.mint : health.score >= 60 ? G.amber : G.rose,
    health.score >= 80 ? G.mintSoft : health.score >= 60 ? G.amberSoft : G.roseSoft,
  );

  y += ch + 16;
  fill(doc, G.white, 28, y, W - 56, H - y - 28, 10);
  doc.setDrawColor(...G.border);
  doc.roundedRect(28, y, W - 56, H - y - 28, 10, 10, 'S');

  setPdfFont(ctx, 10, true);
  textRgb(doc, G.ink);
  doc.text('Dataset snapshot', ctx.rtl ? W - 40 : 40, y + 14, { align: ctx.rtl ? 'right' : 'left' });
  const snap = `This dataset has ${info.columns.length} dimensions (${info.columns.filter(c => c.type === 'numeric').length} numeric, ${info.columns.filter(c => c.type !== 'numeric').length} categorical). Missing values: ${fmtN(info.totalNulls)}. Use the following slides for insights, risks, and recommended actions.`;
  pdfWrite(ctx, snap, ctx.rtl ? W - 40 : 40, y + 24, W - 80, { align: ctx.rtl ? 'right' : 'left', size: 9.5 });

  slideChrome(ctx, page, total, 'Overview');
}

// ── SLIDE: Executive summary ──────────────────────────────────────────
function slideExecutiveSummary(
  ctx: SlideCtx,
  summary: string,
  isLocal: boolean | undefined,
  page: number,
  total: number,
) {
  const { doc, W, H } = ctx;
  doc.addPage();
  slideBg(ctx);
  accentBar(doc, 0, W, 3);
  slideTitle(ctx, 'Executive summary', 'The story your data tells — in plain language.', 28);

  fill(doc, G.white, 28, 72, W - 56, H - 100, 12);
  doc.setDrawColor(...G.border);
  doc.roundedRect(28, 72, W - 56, H - 100, 12, 12, 'S');

  setPdfFont(ctx, 11);
  textRgb(doc, G.ink);
  const lines = pdfSplit(ctx, summary, W - 88);
  const maxLines = Math.min(lines.length, Math.floor((H - 120) / LINE));
  doc.text(lines.slice(0, maxLines), ctx.rtl ? W - 44 : 44, 90, { align: ctx.rtl ? 'right' : 'left' });

  if (isLocal) {
    fill(doc, G.amberSoft, 44, H - 38, W - 88, 12, 4);
    setPdfFont(ctx, 8);
    textRgb(doc, G.amber);
    doc.text('Statistical mode · Add VITE_OPENROUTER_KEY for AI-enhanced narrative', 52, H - 30);
  }
  slideChrome(ctx, page, total, 'Summary');
}

// ── SLIDES: Card grid (insights / risks / etc.) ─────────────────────────
function slidesCardGrid(
  ctx: SlideCtx,
  sectionTitle: string,
  sectionSub: string,
  items: string[],
  accent: RGB,
  soft: RGB,
  tag: string,
  startPage: number,
  total: number,
): number {
  if (items.length === 0) return startPage;
  const { doc, W } = ctx;
  const perSlide = ctx.rtl ? 2 : 3;
  const chunks: string[][] = [];
  for (let i = 0; i < items.length; i += perSlide) chunks.push(items.slice(i, i + perSlide));

  chunks.forEach((chunk, ci) => {
    const page = startPage + ci;
    doc.addPage();
    slideBg(ctx);
    accentBar(doc, 0, W, 3);
    const sub =
      chunks.length > 1
        ? `${sectionSub} (${ci + 1}/${chunks.length})`
        : sectionSub;
    let y = slideTitle(ctx, sectionTitle, sub, 28);
    y += 4;

    const cardW = W - 56;
    chunk.forEach((item, i) => {
      const cardH = insightCard(ctx, 28, y, cardW, i + 1 + ci * perSlide, item, accent, soft);
      y += cardH + 10;
    });
    slideChrome(ctx, page, total, tag);
  });

  return startPage + chunks.length;
}

// ── SLIDE: Recommendations (numbered list) ──────────────────────────────
function slidesRecommendations(
  ctx: SlideCtx,
  items: string[],
  startPage: number,
  total: number,
): number {
  if (items.length === 0) return startPage;
  const { doc, W, H } = ctx;
  doc.addPage();
  slideBg(ctx);
  accentBar(doc, 0, W, 3);
  let y = slideTitle(ctx, 'Recommended actions', 'Prioritized steps you can take immediately.', 28);
  y += 8;

  items.slice(0, 5).forEach((item, i) => {
    if (y > H - 30) return;
    y += bulletCard(ctx, 28, y, W - 56, item, i + 1, G.accent);
  });
  slideChrome(ctx, startPage, total, 'Actions');
  return startPage + 1;
}

// ── SLIDE: Data dimensions (compact table) ──────────────────────────────
function slideDimensions(ctx: SlideCtx, info: DatasetInfo, page: number, total: number) {
  const { doc, W, H } = ctx;
  doc.addPage();
  slideBg(ctx);
  accentBar(doc, 0, W, 3);
  slideTitle(ctx, 'Data dimensions', 'Column-level health at a glance.', 28);

  const cols = info.columns.slice(0, 10);
  const rowH = 12;
  let y = 78;
  const colW = [(W - 56) * 0.38, (W - 56) * 0.14, (W - 56) * 0.16, (W - 56) * 0.16, (W - 56) * 0.16];

  fill(doc, G.accent, 28, y, W - 56, rowH, 4);
  setPdfFont(ctx, 8, true);
  textRgb(doc, G.white);
  let x = 32;
  ['Column', 'Type', 'Nulls', 'Distinct', 'Health'].forEach((h, i) => {
    doc.text(h, x, y + 8);
    x += colW[i];
  });
  y += rowH;

  cols.forEach((col, i) => {
    if (y > H - 28) return;
    if (i % 2 === 0) fill(doc, G.white, 28, y, W - 56, rowH);
    else fill(doc, G.canvas, 28, y, W - 56, rowH);
    const healthPct =
      info.rows > 0 ? Math.round(((info.rows - (col.nullCount ?? 0)) / info.rows) * 100) : 100;
    setPdfFont(ctx, 8);
    textRgb(doc, G.ink);
    x = 32;
    const displayName =
      ctx.font === PDF_FONT_LATIN && /[\u0600-\u06FF]/.test(col.name)
        ? latinizeColumnName(col.name, i)
        : col.name;
    const nameLines = pdfSplit(ctx, displayName, colW[0] - 4);
    const cells = [
      nameLines[0] ?? displayName,
      col.type,
      fmtN(col.nullCount ?? 0),
      fmtN(col.uniqueCount ?? 0),
      `${healthPct}%`,
    ];
    cells.forEach((cell, j) => {
      doc.text(String(cell), x, y + 8);
      x += colW[j];
    });
    y += rowH;
  });

  if (info.columns.length > 10) {
    setPdfFont(ctx, 8);
    textRgb(doc, G.inkMuted);
    doc.text(`+ ${info.columns.length - 10} more columns in the full dataset`, 28, y + 6);
  }
  slideChrome(ctx, page, total, 'Schema');
}

// ── SLIDE: Closing ──────────────────────────────────────────────────────
function slideClosing(ctx: SlideCtx, page: number, total: number) {
  const { doc, W, H } = ctx;
  doc.addPage();
  slideBg(ctx);
  accentBar(doc, 0, W, 5);
  fill(doc, G.white, 28, 40, W - 56, H - 80, 14);

  setPdfFont(ctx, 28, true);
  textRgb(doc, G.ink);
  doc.text('Thank you', W / 2, 95, { align: 'center' });
  setPdfFont(ctx, 12);
  textRgb(doc, G.inkSoft);
  doc.text('Prepared with Kimit AI Studio', W / 2, 112, { align: 'center' });
  setPdfFont(ctx, 9);
  textRgb(doc, G.inkMuted);
  doc.text('Confidential · For internal decision-making only', W / 2, 128, { align: 'center' });

  slideChrome(ctx, page, total, 'End');
}

// ── Parse narrative sections into slides (optional appendix) ───────────
function slidesNarrativeAppendix(ctx: SlideCtx, narrative: string, startPage: number, total: number): number {
  const sections = narrative.split(/\n(?=\*\*)/).filter(s => s.trim());
  if (sections.length === 0) return startPage;

  const { doc, W, H } = ctx;
  let page = startPage;

  sections.slice(0, 4).forEach(block => {
    doc.addPage();
    slideBg(ctx);
    accentBar(doc, 0, W, 3);

    const titleMatch = block.match(/^\*\*(.+?)\*\*/);
    const title = titleMatch ? titleMatch[1] : 'Details';
    const body = block.replace(/^\*\*.+?\*\*\n?/, '').trim();

    slideTitle(ctx, title, 'Supporting analysis', 28);
    fill(doc, G.white, 28, 72, W - 56, H - 100, 10);
    setPdfFont(ctx, 9.5);
    textRgb(doc, G.ink);
    const lines = pdfSplit(ctx, body.replace(/\*\*/g, ''), W - 88);
    doc.text(lines.slice(0, 16), ctx.rtl ? W - 44 : 44, 88, { align: ctx.rtl ? 'right' : 'left' });
    slideChrome(ctx, page, total, 'Appendix');
    page++;
  });

  return page;
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════
export async function generateExecutiveReport(
  info: DatasetInfo,
  health: { score: number; label: string; color: string },
  options: ReportOptions = {},
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const file = (info.filename || 'Dataset').toUpperCase();
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const logo = await loadLogo();
  const arabicFontOk = await ensurePdfArabicFont(doc);

  const rawBriefing = options.briefing;
  const briefingTexts = rawBriefing
    ? [
        rawBriefing.executiveSummary,
        ...rawBriefing.insights,
        ...rawBriefing.warnings,
        ...rawBriefing.qualityIssues,
        ...rawBriefing.recommendations,
        ...rawBriefing.opportunities,
      ]
    : [];
  const briefing =
    rawBriefing && !arabicFontOk
      ? latinizeBriefingForPdf(rawBriefing, info.columns)
      : rawBriefing;

  const font = pickPdfFont(arabicFontOk, info.columns, briefingTexts);
  const rtl = font === PDF_FONT_ARABIC;
  const ctx: SlideCtx = { doc, W, H, logo, file, font, rtl };

  const perGrid = rtl ? 2 : 3;
  const gridSlides = (items: string[]) => Math.max(0, Math.ceil(items.length / perGrid));
  let planned =
    1 + // cover
    1 + // overview
    1 + // dimensions
    (briefing ? 1 : 0) + // exec summary
    (briefing ? gridSlides(briefing.insights) : 0) +
    (briefing ? gridSlides(briefing.warnings) : 0) +
    (briefing ? gridSlides(briefing.qualityIssues) : 0) +
    (briefing ? 1 : 0) + // recommendations
    (briefing ? gridSlides(briefing.opportunities) : 0) +
    (options.aiSummary ? Math.min(4, 4) : 0) +
    1; // closing
  let total = planned;

  // ── Build deck ──────────────────────────────────────────────────────
  slideCover(ctx, {
    title: options.title || 'Executive Intelligence Report',
    subtitle: options.subtitle || 'Data-driven insights for leadership',
    filename: file,
    rows: info.rows,
    cols: info.columns.length,
    generatedAt: now,
    author: options.author,
  });

  let page = 2;
  slideOverview(ctx, info, health, page++, total);

  if (briefing) {
    slideExecutiveSummary(ctx, briefing.executiveSummary, briefing.isLocal, page++, total);

    page = slidesCardGrid(
      ctx,
      'Key insights',
      'Patterns and metrics worth your attention',
      briefing.insights,
      G.accent,
      G.accentSoft,
      'Insights',
      page,
      total,
    );

    page = slidesCardGrid(
      ctx,
      'Risks & anomalies',
      'Issues that may affect analysis accuracy',
      briefing.warnings,
      G.rose,
      G.roseSoft,
      'Risks',
      page,
      total,
    );

    page = slidesCardGrid(
      ctx,
      'Data quality',
      'Completeness and integrity findings',
      briefing.qualityIssues,
      G.amber,
      G.amberSoft,
      'Quality',
      page,
      total,
    );

    page = slidesRecommendations(ctx, briefing.recommendations, page, total);

    page = slidesCardGrid(
      ctx,
      'Strategic opportunities',
      'Where to invest analysis effort next',
      briefing.opportunities,
      G.violet,
      G.violetSoft,
      'Opportunities',
      page,
      total,
    );
  }

  slideDimensions(ctx, info, page++, total);

  if (options.aiSummary) {
    page = slidesNarrativeAppendix(ctx, options.aiSummary, page, total);
  }

  slideClosing(ctx, page, total);

  // Fix total page numbers on all slides
  total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    setPdfFont(ctx, 7);
    textRgb(doc, G.inkMuted);
    doc.text(`${p} / ${total}`, rtl ? 14 : W - 14, H - 8, { align: rtl ? 'left' : 'right' });
  }

  doc.save(`KIMIT_REPORT_${file.replace(/[^a-z0-9_-]/gi, '_')}.pdf`);
}
