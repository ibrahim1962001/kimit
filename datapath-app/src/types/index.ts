export type ColumnType = 'numeric' | 'text' | 'date';

export interface ColumnMetadata {
  id: string;
  name: string;
  type: ColumnType;
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
}

export interface DataRow {
  [key: string]: string | number | null;
}

export interface DatasetInfo {
  datasetId?: number;
  sourceUrl?: string;
  filename: string;
  columns: ColumnMetadata[];
  rows: number;
  data: DataRow[];
}

export interface Dataset {
  id: string;
  filename: string;
  fileSize: number;
  rows: number;
  columns: ColumnMetadata[];
  data: DataRow[];
}

export interface ParseResult {
  data: DataRow[];
  columns: string[];
  errors: unknown[];
  meta: {
    fields: string[];
    truncated: boolean;
  };
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  xAxisKey: string;
  yAxisKey: string;
  title?: string;
  color?: string;
}

export interface DataHealthScore {
  score: number;
  issues: string[];
  recommendations: string[];
}
