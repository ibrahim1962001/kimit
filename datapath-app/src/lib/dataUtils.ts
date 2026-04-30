import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { DataRow, DatasetInfo, ColumnInfo, Anomaly, Correlation, ChartInfo } from '../types';

export async function parseFile(file: File, onProgress?: (p: number) => void): Promise<DataRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('File exceeds 50MB limit');
  }

  if (ext === 'csv') return parseCSV(file, onProgress);
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file, onProgress);
  throw new Error('Unsupported file type');
}

function parseCSV(file: File, onProgress?: (p: number) => void): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    let rows: DataRow[] = [];
    const totalBytes = file.size;

    Papa.parse<DataRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      chunk: (results) => {
        rows = rows.concat(results.data);
        // Estimate progress based on rows if cursor isn't reliable, but let's just do a simple increment for now
        // PapaParse doesn't easily expose exact bytes per chunk in the callback natively without stepping, 
        // but we can estimate:
        if (onProgress) {
          onProgress(Math.min(90, 10 + Math.round((rows.length / (totalBytes / 100)) * 10)));
        }
      },
      complete: () => {
        if (onProgress) onProgress(90);
        resolve(rows);
      },
      error: reject,
    });
  });
}

function parseExcel(file: File, onProgress?: (p: number) => void): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.min(90, Math.round((event.loaded / event.total) * 100)));
      }
    };
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<DataRow>(ws, { defval: null });
        if (onProgress) onProgress(95);
        resolve(data);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function detectType(data: DataRow[], col: string): 'numeric' | 'text' {
  let numCount = 0, total = 0;
  for (const row of data) {
    const v = row[col];
    if (v !== null && v !== undefined && v !== '') {
      total++;
      if (typeof v === 'number' || !isNaN(Number(v))) numCount++;
    }
  }
  return total > 0 && numCount / total > 0.8 ? 'numeric' : 'text';
}

function getNumericVals(data: DataRow[], col: string): number[] {
  return data.map(r => Number(r[col])).filter(v => !isNaN(v) && isFinite(v));
}

function median(vals: number[]): number {
  const sorted = [...vals].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function countDups(data: DataRow[]): number {
  const seen = new Set<string>();
  let dups = 0;
  for (const row of data) {
    const key = JSON.stringify(row);
    if (seen.has(key)) dups++;
    else seen.add(key);
  }
  return dups;
}

function pearson(data: DataRow[], c1: string, c2: string): number {
  const pairs = data
    .map(r => [Number(r[c1]), Number(r[c2])])
    .filter(([a, b]) => !isNaN(a) && !isNaN(b) && isFinite(a) && isFinite(b));
  if (pairs.length < 5) return 0;
  const n = pairs.length;
  const mA = pairs.reduce((s, [a]) => s + a, 0) / n;
  const mB = pairs.reduce((s, [, b]) => s + b, 0) / n;
  const num = pairs.reduce((s, [a, b]) => s + (a - mA) * (b - mB), 0);
  const dA = Math.sqrt(pairs.reduce((s, [a]) => s + (a - mA) ** 2, 0));
  const dB = Math.sqrt(pairs.reduce((s, [, b]) => s + (b - mB) ** 2, 0));
  return dA * dB === 0 ? 0 : num / (dA * dB);
}

export function analyzeDataset(file: File, data: DataRow[]): DatasetInfo {
  const colNames = Object.keys(data[0] ?? {});

  const rowCount = data.length;
  const sampleLimit = 5000;
  const sampleData = rowCount > sampleLimit ? data.slice(0, sampleLimit) : data;
  
  const columns: ColumnInfo[] = colNames.map(name => {
    const type = detectType(sampleData, name);
    const nullCount = data.filter(r => r[name] === null || r[name] === undefined || r[name] === '').length;
    const uniqueCount = new Set(sampleData.map(r => r[name])).size;

    if (type === 'numeric') {
      const vals = getNumericVals(sampleData, name);
      if (vals.length === 0) return { name, type, nullCount, uniqueCount: 0 };
      return {
        name, type, nullCount, uniqueCount,
        min: Math.min(...vals), max: Math.max(...vals),
        mean: vals.reduce((a, b) => a + b, 0) / vals.length,
        median: median(vals),
      };
    } else {
      const freq: Record<string, number> = {};
      for (const row of sampleData) {
        const v = String(row[name] ?? '');
        if (v) freq[v] = (freq[v] || 0) + 1;
      }
      const topValues = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([value, count]) => ({ value, count }));
      return { name, type, nullCount, uniqueCount, topValues };
    }
  });

  const numCols = columns.filter(c => c.type === 'numeric' && c.uniqueCount > 0).map(c => c.name);
  const txtCols = columns.filter(c => c.type === 'text').map(c => c.name);

  const anomalies: Anomaly[] = [];
  for (const col of numCols.slice(0, 15)) {
    const vals = getNumericVals(sampleData, col);
    if (vals.length < 10) continue;
    
    // Phase 2.2: IQR Method for Anomaly Detection
    const sorted = [...vals].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers = vals.filter(v => v < lowerBound || v > upperBound).length;
    
    if (outliers > 0) {
      anomalies.push({
        column: col, count: outliers * (rowCount / sampleData.length),
        severity: outliers > vals.length * 0.05 ? 'high' : 'medium',
        description: `Approximately ${Math.round(outliers * (rowCount / sampleData.length))} outliers detected (IQR method)`,
      });
    }
  }

  const correlations: Correlation[] = [];
  const corrLimit = numCols.slice(0, 10);
  for (let i = 0; i < corrLimit.length; i++) {
    for (let j = i + 1; j < corrLimit.length; j++) {
      const v = pearson(sampleData, corrLimit[i], corrLimit[j]);
      if (Math.abs(v) > 0.6) {
        correlations.push({ col1: corrLimit[i], col2: corrLimit[j], value: v, strength: Math.abs(v) > 0.8 ? 'Very Strong' : 'Strong' });
      }
    }
  }

  const charts: ChartInfo[] = [];
  const chartPoints = 800;
  const chartSample = rowCount > chartPoints ? data.slice(0, chartPoints) : data;

  numCols.slice(0, 12).forEach((col, i) => {
    charts.push({
      type: i % 3 === 0 ? 'line' : (i % 3 === 1 ? 'area' : 'bar'),
      title: `${col} Distribution`,
      data: chartSample.map((r) => ({ x: 0, y: Number(r[col]) || 0 }))
    });
  });

  txtCols.slice(0, 8).forEach((col) => {
    const freq: Record<string, number> = {};
    for (const r of chartSample) { 
      const v = String(r[col] ?? '').slice(0, 15); 
      if (v && v !== 'null' && v !== 'undefined') freq[v] = (freq[v] || 0) + 1; 
    }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (top.length > 1) {
      // CHART SELECTION RULES:
      // Never use Pie for names, IDs, or >6 unique values
      const isNameOrId = /name|id|customer|client|product|person|user|email/i.test(col);
      const isPieSuitable = !isNameOrId && top.length <= 6;
      
      charts.push({
        type: isPieSuitable ? 'pie' : 'bar',
        title: `Top ${col} Summary`,
        data: top.map(([x, y]) => ({ x, y }))
      });
    }
  });

  const duplicates = countDups(data);
  const totalNulls = columns.reduce((s, c) => s + c.nullCount, 0);

  return {
    filename: file.name,
    fileSize: file.size,
    rows: data.length,
    columns,
    rawData: data,
    workData: JSON.parse(JSON.stringify(data)),
    anomalies,
    correlations,
    charts,
    duplicates,
    totalNulls,
  };
}

export function cleanDataset(info: DatasetInfo): DatasetInfo {
  const data = JSON.parse(JSON.stringify(info.workData)) as DataRow[];

  for (const col of info.columns) {
    if (col.nullCount === 0) continue;
    const fillVal = col.type === 'numeric' ? col.median ?? col.mean ?? 0
      : col.topValues?.[0]?.value ?? 'Unknown';
    for (const row of data) {
      if (row[col.name] === null || row[col.name] === undefined || row[col.name] === '') {
        row[col.name] = fillVal;
      }
    }
  }

  const seen = new Set<string>();
  const clean: DataRow[] = [];
  for (const row of data) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) { seen.add(key); clean.push(row); }
  }

  return analyzeDataset(new File([], info.filename), clean);
}

export function exportCSV(data: DataRow[], filename: string) {
  const csv = '\uFEFF' + Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.replace(/\.[^/.]+$/, '') + '_kemet.csv');
}

export function exportJSON(data: DataRow[], filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, filename.replace(/\.[^/.]+$/, '') + '_kemet.json');
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function convertBackendResultToDatasetInfo(result: any): DatasetInfo {
  const columns: ColumnInfo[] = result.columns.map((name: string) => {
    const dtype = result.dtypes[name] || '';
    const type = (dtype.includes('int') || dtype.includes('float')) ? 'numeric' : 'text';
    return {
      name,
      type,
      nullCount: result.nullCounts[name] || 0,
      uniqueCount: 0, // Not provided by backend currently, but could be added
    };
  });

  return {
    filename: result.filename,
    fileSize: 0, // Remote file
    rows: result.shape[0],
    columns,
    rawData: result.fullData || result.preview,
    workData: JSON.parse(JSON.stringify(result.fullData || result.preview)),
    anomalies: result.anomalies,
    correlations: result.correlations,
    charts: result.charts,
    duplicates: result.duplicates,
    totalNulls: Object.values(result.nullCounts as Record<string, number>).reduce((a, b) => a + b, 0),
  };
}
