import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { ColumnInfo } from '../types';
import { generateDAXMeasures } from './exportUtils';
import type { SmartDashboardBundlePayload } from './smartDashboardHtmlExport';

export interface SmartDashboardPowerBIPayload extends SmartDashboardBundlePayload {
  columns: ColumnInfo[];
}

const sanitizeName = (name: string): string =>
  name.trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'Field';

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Flatten ECharts option → rows for Power BI chart replication */
function chartOptionToRows(
  chartTitle: string,
  option: Record<string, unknown>,
): Array<{ chart: string; category: string; series: string; value: number }> {
  const rows: Array<{ chart: string; category: string; series: string; value: number }> = [];
  const seriesList = (option.series as Array<Record<string, unknown>>) ?? [];
  const xAxis = option.xAxis as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  const labels: string[] = Array.isArray(xAxis)
    ? ((xAxis[0]?.data as string[]) ?? [])
    : ((xAxis?.data as string[]) ?? []);

  for (const s of seriesList) {
    const seriesName = String(s.name ?? s.type ?? 'Value');
    const data = s.data;
    if (!Array.isArray(data)) continue;

    if (data.length && typeof data[0] === 'object' && data[0] !== null && 'value' in (data[0] as object)) {
      for (const pt of data as Array<{ name?: string; value?: number }>) {
        rows.push({
          chart: chartTitle,
          category: String(pt.name ?? ''),
          series: seriesName,
          value: toNum(pt.value),
        });
      }
      continue;
    }

    data.forEach((val, i) => {
      const v = typeof val === 'object' && val !== null && 'value' in val ? toNum((val as { value: number }).value) : toNum(val);
      rows.push({
        chart: chartTitle,
        category: labels[i] ?? String(i + 1),
        series: seriesName,
        value: v,
      });
    });
  }

  return rows;
}

function buildPowerQueryM(tableNames: string[], isAr: boolean): string {
  const loads = tableNames
    .map(
      name => `
    ${name}_Table = Source{[Item="${name}",Kind="Table"]}[Data],
    ${name} = Table.TransformColumnTypes(Table.PromoteHeaders(${name}_Table, [PromoteAllScalars=true]), {})`,
    )
    .join(',\n');

  const header = isAr
    ? '// Kimit Smart Dashboard — Power Query (الصق في Power BI: Get Data > Blank Query > Advanced Editor)'
    : '// Kimit Smart Dashboard — Power Query (Paste in Power BI: Get Data > Blank Query > Advanced Editor)';

  return `${header}
// After pasting: set parameter FilePath to your extracted Kimit_PowerBI.xlsx path, or replace File.Contents path below.

let
    FilePath = "C:\\Path\\To\\Kimit_PowerBI.xlsx",
    Source = Excel.Workbook(File.Contents(FilePath), null, true),${loads}
in
    Fact`;
}

function buildGuide(isAr: boolean, datasetName: string): string {
  if (isAr) {
    return `دليل Power BI التفاعلي — ${datasetName}
================================

1) فك ضغط الملف ZIP وافتح Power BI Desktop.
2) Get Data > Excel > اختر Kimit_PowerBI.xlsx > حدد كل الجداول (Fact, DimCategory, DimTrend, KPIs, ChartData).
3) في Model: اربط DimCategory[category] → Fact (إن وُجد عمود فئة)، DimTrend[date] → Fact (إن وُجد تاريخ).
4) Data view > New measure: الصق مقاييس DAX من Kimit_Measures.dax
5) Report view — أنشئ تقريراً تفاعلياً:
   - Card: KPIs[value] مع KPIs[metric]
   - Line chart: DimTrend[date] + DimTrend[metric value]
   - Bar chart: DimCategory[category] + DimCategory[metricTotal]
   - Pie/Donut: ChartData (chart + category + value) مع فلتر chart
   - أضف Slicers على category و date للتفاعل الكامل

ملاحظة: التفاعل (فلاتر، drill، cross-filter) يعمل داخل Power BI Desktop/Service بعد بناء التقرير.
`;
  }
  return `Kimit Interactive Power BI Guide — ${datasetName}
================================

1) Unzip and open Power BI Desktop.
2) Get Data > Excel > Kimit_PowerBI.xlsx > select all tables (Fact, DimCategory, DimTrend, KPIs, ChartData).
3) Model view: relate DimCategory[category] and DimTrend[date] to Fact when matching columns exist.
4) Paste DAX from Kimit_Measures.dax as new measures.
5) Build interactive report:
   - Cards: KPIs[metric] / KPIs[value]
   - Line: DimTrend[date] + metric column
   - Clustered bar: DimCategory[category] + DimCategory[metricTotal]
   - Donut: ChartData with Legend = category, Values = value, Filter = chart
   - Add slicers on category and date

Interactivity (cross-filtering, drill-down) is native in Power BI after you publish or share the report.
`;
}

async function addTableSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  tableName: string,
  headers: string[],
  bodyRows: (string | number | null)[][],
): Promise<void> {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(headers);
  for (const row of bodyRows) {
    sheet.addRow(row);
  }
  const colCount = headers.length;
  const rowCount = bodyRows.length + 1;
  const colLetter = String.fromCharCode(64 + Math.min(colCount, 26));
  const ref =
    colCount <= 26
      ? `A1:${colLetter}${rowCount}`
      : `A1:${sheet.getColumn(colCount).letter}${rowCount}`;

  if (rowCount >= 2) {
    sheet.addTable({
      name: tableName,
      ref,
      headerRow: true,
      columns: headers.map(h => ({ name: h, filterButton: true })),
      rows: bodyRows.map(r => r.map(c => (c === null ? '' : c))),
    });
  }
  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 18;
  });
}

export async function exportSmartDashboardPowerBI(payload: SmartDashboardPowerBIPayload): Promise<void> {
  const isAr = payload.isAr ?? false;
  const baseName = `Kimit_PowerBI_${payload.datasetName.replace(/[^\w\-]+/g, '_')}`;
  const { data, categoryColumn, metricColumn, dateColumn, kpis = [], charts = [], columns } = payload;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kimit AI Studio';
  workbook.created = new Date();

  const factKeys = data.length ? Object.keys(data[0]) : ['id'];
  const factHeaders = factKeys.map(sanitizeName);
  const factRows = data.map(row =>
    factKeys.map(k => {
      const v = row[k];
      return v === null || v === undefined ? '' : v;
    }),
  );
  await addTableSheet(workbook, 'Fact', 'KimitFact', factHeaders, factRows);

  if (categoryColumn && metricColumn) {
    const countMap = new Map<string, number>();
    const sumMap = new Map<string, number>();
    for (const row of data) {
      const key = String(row[categoryColumn] ?? 'Unknown');
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
      sumMap.set(key, (sumMap.get(key) ?? 0) + toNum(row[metricColumn]));
    }
    const catHeaders = ['category', 'count', 'metricTotal'];
    const catRows = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => [cat, count, Math.round((sumMap.get(cat) ?? 0) * 100) / 100]);
    await addTableSheet(workbook, 'DimCategory', 'KimitDimCategory', catHeaders, catRows);
  }

  if (dateColumn && metricColumn) {
    const trendMap = new Map<string, number>();
    for (const row of data) {
      const key = String(row[dateColumn] ?? '').slice(0, 10);
      if (!key) continue;
      trendMap.set(key, (trendMap.get(key) ?? 0) + toNum(row[metricColumn]));
    }
    const metricKey = sanitizeName(metricColumn);
    const trendHeaders = ['date', metricKey];
    const trendRows = [...trendMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => [date, Math.round(value * 100) / 100]);
    await addTableSheet(workbook, 'DimTrend', 'KimitDimTrend', trendHeaders, trendRows);
  }

  const kpiHeaders = ['metric', 'value', 'notes'];
  const kpiRows = kpis.map(k => [k.title, String(k.value), k.sub ?? '']);
  await addTableSheet(workbook, 'KPIs', 'KimitKPIs', kpiHeaders, kpiRows);

  const chartRows: (string | number)[][] = [];
  for (const c of charts) {
    const flat = chartOptionToRows(c.title, c.option as Record<string, unknown>);
    for (const r of flat) {
      chartRows.push([r.chart, r.category, r.series, r.value]);
    }
  }
  if (chartRows.length) {
    await addTableSheet(workbook, 'ChartData', 'KimitChartData', ['chart', 'category', 'series', 'value'], chartRows);
  }

  const excelBuffer = await workbook.xlsx.writeBuffer();
  const tableNames = ['Fact', ...(categoryColumn ? ['DimCategory'] : []), ...(dateColumn ? ['DimTrend'] : []), 'KPIs', ...(chartRows.length ? ['ChartData'] : [])];

  const daxBlocks = generateDAXMeasures(columns, 'Fact');
  const daxContent = daxBlocks.map(m => m.dax).join('\n\n');

  const pqContent = buildPowerQueryM(tableNames, isAr);
  const guideContent = buildGuide(isAr, payload.datasetName);

  const zip = new JSZip();
  zip.file(`${baseName}.xlsx`, excelBuffer);
  zip.file(`${baseName}_Model.pq`, pqContent);
  zip.file(`${baseName}_Measures.dax`, daxContent);
  zip.file(`${baseName}_Guide.txt`, guideContent);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
