// src/types/dataset.ts
export interface ColumnDtype {
  [column: string]: string;
}

export interface ChartData {
  id: number;
  type: "line" | "bar" | "pie" | "area";
  title: string;
  data: Array<Record<string, string | number>>;
}

export interface Anomaly {
  column: string;
  count: number;
  severity: "high" | "medium" | "low";
  description: string;
}

export interface Correlation {
  col1: string;
  col2: string;
  value: number;
  strength: string;
}

export interface UploadResult {
  datasetId: number;
  filename: string;
  sourceUrl?: string;
  columns: string[];
  dtypes: ColumnDtype;
  shape: [number, number];
  nullCounts: Record<string, number>;
  duplicates: number;
  preview: Array<Record<string, unknown>>;
  fullData: Array<Record<string, unknown>>;
  charts: ChartData[];
  anomalies: Anomaly[];
  correlations: Correlation[];
}

export interface CleanResult {
  cleaned: boolean;
  removedNulls: number;
  removedDuplicates: number;
  newShape: [number, number];
  nullCounts: Record<string, number>;
  preview: Array<Record<string, unknown>>;
}

export interface Dataset {
  id: number;
  filename: string;
  rowCount: number;
  colCount: number;
  source: "upload" | "sheets" | "sql";
  createdAt: string;
}
