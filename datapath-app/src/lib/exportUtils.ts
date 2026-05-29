import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { DataRow, ColumnInfo } from '../types';

// ─────────────────────────────────────────────
//  PDF Export
// ─────────────────────────────────────────────
export const exportBrandedPDF = async (
  elementId: string,
  filename = 'Kimit_Report.pdf',
): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) { console.error(`Element #${elementId} not found`); return; }
  try {
    const canvas = await html2canvas(element, {
      scale: 2, useCORS: true, backgroundColor: '#020617', logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pdfWidth, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.text('KIMIT CLOUD — EXECUTIVE REPORT', 10, 13);
    pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Generated on ${new Date().toLocaleString()} | kimit.cloud`, 10, 290);
    pdf.save(filename);
  } catch (err) { console.error('PDF export error:', err); }
};

// ─────────────────────────────────────────────
//  Excel Export (strictly typed)
// ─────────────────────────────────────────────
export const exportToExcel = (data: DataRow[], filename = 'Kimit_Data.xlsx'): void => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');
  XLSX.writeFile(workbook, filename);
};

export interface SmartDashboardExcelPayload {
  filename?: string;
  datasetName: string;
  data: DataRow[];
  categoryColumn?: string | null;
  metricColumn?: string | null;
  dateColumn?: string | null;
  kpis?: Array<{ title: string; value: string | number; sub?: string }>;
  insights?: Array<{ title: string; desc: string }>;
  topRows?: DataRow[];
  quality?: {
    score: number;
    grade: string;
    fillRate: number;
    dupRate: number;
    outlierPct: number;
  };
}

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export function buildSmartDashboardWorkbook(payload: SmartDashboardExcelPayload): XLSX.WorkBook {
  const {
    datasetName,
    data,
    categoryColumn,
    metricColumn,
    dateColumn,
    kpis = [],
    insights = [],
    topRows = [],
    quality,
  } = payload;

  const workbook = XLSX.utils.book_new();

  const dashboardRows: (string | number)[][] = [
    ['KIMIT Smart Dashboard Export'],
    [`Dataset: ${datasetName}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ['KPIs'],
    ['Metric', 'Value', 'Notes'],
    ...kpis.map(k => [k.title, String(k.value), k.sub ?? '']),
    [],
    ['Quality Snapshot'],
    ['Score', 'Grade', 'Fill Rate %', 'Duplicate Rate %', 'Outlier %'],
    quality
      ? [quality.score, quality.grade, quality.fillRate, quality.dupRate, quality.outlierPct]
      : ['', '', '', '', ''],
    [],
    ['Insights'],
    ['Title', 'Details'],
    ...insights.map(i => [i.title, i.desc]),
  ];
  const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardRows);
  dashboardSheet['!cols'] = [{ wch: 30 }, { wch: 28 }, { wch: 52 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, dashboardSheet, 'Dashboard');

  const dataSheet = XLSX.utils.json_to_sheet(data);
  dataSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(1, data.length), c: Math.max(0, Object.keys(data[0] ?? {}).length - 1) },
    }),
  };
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data');

  if (categoryColumn) {
    const countMap = new Map<string, number>();
    const sumMap = new Map<string, number>();
    for (const row of data) {
      const key = String(row[categoryColumn] ?? 'Unknown');
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
      if (metricColumn) {
        sumMap.set(key, (sumMap.get(key) ?? 0) + toNumber(row[metricColumn]));
      }
    }
    const categoryRows = [...countMap.entries()]
      .map(([cat, count]) => ({
        category: cat,
        count,
        metricTotal: metricColumn ? Math.round((sumMap.get(cat) ?? 0) * 100) / 100 : null,
      }))
      .sort((a, b) => b.count - a.count);
    const catSheet = XLSX.utils.json_to_sheet(categoryRows);
    XLSX.utils.book_append_sheet(workbook, catSheet, 'Category_Data');
  }

  if (dateColumn && metricColumn) {
    const trendMap = new Map<string, number>();
    for (const row of data) {
      const key = String(row[dateColumn] ?? '').slice(0, 10);
      if (!key) continue;
      trendMap.set(key, (trendMap.get(key) ?? 0) + toNumber(row[metricColumn]));
    }
    const trendRows = [...trendMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, [metricColumn]: Math.round(value * 100) / 100 }));
    const trendSheet = XLSX.utils.json_to_sheet(trendRows);
    XLSX.utils.book_append_sheet(workbook, trendSheet, 'Trend_Data');
  }

  if (topRows.length && categoryColumn && metricColumn) {
    const topSheet = XLSX.utils.json_to_sheet(
      topRows.map(row => ({
        [categoryColumn]: row[categoryColumn],
        [metricColumn]: row[metricColumn],
      })),
    );
    XLSX.utils.book_append_sheet(workbook, topSheet, 'Top_Records');
  }

  const notesSheet = XLSX.utils.aoa_to_sheet([
    ['KIMIT Smart Dashboard — How to use'],
    [''],
    ['1. Interactive charts (recommended)'],
    ['   Open the .html file that downloaded with this Excel file (same name).'],
    ['   It opens in Chrome/Edge with live, interactive charts — no Excel Add-in needed.'],
    [''],
    ['2. Excel data & pivots'],
    ['   Edit raw data on the Data sheet.'],
    ['   Build PivotCharts from Category_Data or Trend_Data if you need charts inside Excel.'],
  ]);
  notesSheet['!cols'] = [{ wch: 88 }];
  XLSX.utils.book_append_sheet(workbook, notesSheet, 'How_To_Use');

  return workbook;
}

export const exportSmartDashboardExcel = (payload: SmartDashboardExcelPayload): void => {
  const workbook = buildSmartDashboardWorkbook(payload);
  XLSX.writeFile(workbook, payload.filename ?? `Smart_Dashboard_${payload.datasetName}.xlsx`);
};


// ─────────────────────────────────────────────
//  Power BI — Optimised CSV Export
//  Adds a header row with proper BOM so Power BI detects UTF-8
//  Enforces sanitized headers and ISO date strings.
// ─────────────────────────────────────────────
export const exportPowerBICSV = (data: DataRow[], filename = 'Kimit_PowerBI.csv'): void => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const sanitizedHeaders = headers.map(h => h.trim().replace(/[^a-zA-Z0-9_]/g, '_'));
  
  const escape = (v: unknown): string => {
    if (v instanceof Date) return v.toISOString();
    const s = String(v ?? '');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
      return new Date(s).toISOString();
    }
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  
  const rows = [
    sanitizedHeaders.join(','),
    ...data.map(row => headers.map(h => escape(row[h])).join(',')),
  ];
  
  // BOM for Power BI UTF-8 auto-detect
  const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────
//  Power BI — DAX Measure Generator
//  Generates ready-to-paste DAX for each numeric column
// ─────────────────────────────────────────────
export interface DAXMeasure {
  column: string;
  dax: string;
}

export const generateDAXMeasures = (
  columns: ColumnInfo[],
  tableName = 'KimitData',
): DAXMeasure[] =>
  columns
    .filter(c => c.type === 'numeric')
    .map(c => ({
      column: c.name,
      dax: [
        `// ── ${c.name} ──────────────────────────────────────`,
        `Total_${c.name} = SUM('${tableName}'[${c.name}])`,
        `Avg_${c.name} = AVERAGE('${tableName}'[${c.name}])`,
        `Max_${c.name} = MAX('${tableName}'[${c.name}])`,
        `Min_${c.name} = MIN('${tableName}'[${c.name}])`,
        `// MoM Growth`,
        `MoM_${c.name} =`,
        `  VAR _cur = CALCULATE(SUM('${tableName}'[${c.name}]), DATESMTD('${tableName}'[Date]))`,
        `  VAR _prev = CALCULATE(SUM('${tableName}'[${c.name}]), DATEADD(DATESMTD('${tableName}'[Date]), -1, MONTH))`,
        `  RETURN DIVIDE(_cur - _prev, _prev, 0)`,
      ].join('\n'),
    }));

// ─────────────────────────────────────────────
//  High-Res Chart PNG (ECharts instance based)
//  Called directly with the ECharts instance from DataChart
// ─────────────────────────────────────────────
export const downloadChartPNG = (
  getDataURL: (opts: { type: string; pixelRatio: number; backgroundColor: string }) => string,
  title: string,
): void => {
  const url = getDataURL({ type: 'png', pixelRatio: 3, backgroundColor: '#0a0f1d' });
  const link = document.createElement('a');
  link.download = `${title.replace(/\s+/g, '_')}_hires.png`;
  link.href = url;
  link.click();
};
