export type Lang = 'ar' | 'en';

export interface DataRow {
  [key: string]: string | number | null;
}

export interface ColumnInfo {
  name: string;
  type: 'numeric' | 'text';
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  topValues?: { value: string; count: number }[];
}

export interface Anomaly {
  column: string;
  count: number;
  severity: 'high' | 'medium';
  description: string;
}

export interface Correlation {
  col1: string;
  col2: string;
  value: number;
  strength: string;
}

export interface ChartInfo {
  type: 'line' | 'bar' | 'area' | 'pie';
  title: string;
  data: { x: string | number; y: number }[];
  labels?: string[]; // Optional for aggregated builder results
  values?: number[]; // Optional for aggregated builder results
  color?: string;
}

export interface DatasetInfo {
  filename: string;
  fileSize: number;
  rows: number;
  columns: ColumnInfo[];
  rawData: DataRow[];
  workData: DataRow[];
  anomalies: Anomaly[];
  correlations: Correlation[];
  charts: ChartInfo[];
  duplicates: number;
  totalNulls: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: string;
}

export interface QuickQuestion {
  id: string;
  icon: string;
  label: string;
  labelEn: string;
  prompt: string;
  promptEn: string;
  category: 'data' | 'general' | 'analysis';
}

export interface SummaryReport {
  isLocal: boolean;
  executiveSummary: string;
  insights: string[];
  warnings: string[];
  qualityIssues: string[];
  recommendations: string[];
  opportunities: string[];
}
