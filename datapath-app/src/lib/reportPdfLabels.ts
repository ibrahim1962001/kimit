import type { ColumnInfo } from '../types';
import type { ReportBriefing } from './report-gen';

/** Fallback when Arabic font cannot load — replace Arabic names with readable Latin labels. */
export function buildColumnLabelMap(columns: ColumnInfo[]): Map<string, string> {
  const map = new Map<string, string>();
  columns.forEach((col, i) => {
    if (/[\u0600-\u06FF]/.test(col.name)) {
      map.set(col.name, `Column ${i + 1}`);
    }
  });
  return map;
}

function replaceColumnNames(text: string, labelMap: Map<string, string>): string {
  let out = text;
  const entries = [...labelMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [arabic, label] of entries) {
    out = out.split(arabic).join(label);
  }
  return out;
}

export function latinizeBriefingForPdf(
  briefing: ReportBriefing,
  columns: ColumnInfo[],
): ReportBriefing {
  const map = buildColumnLabelMap(columns);
  if (map.size === 0) return briefing;

  const fix = (s: string) => replaceColumnNames(s, map);
  return {
    ...briefing,
    executiveSummary: fix(briefing.executiveSummary),
    insights: briefing.insights.map(fix),
    warnings: briefing.warnings.map(fix),
    qualityIssues: briefing.qualityIssues.map(fix),
    recommendations: briefing.recommendations.map(fix),
    opportunities: briefing.opportunities.map(fix),
  };
}

export function latinizeColumnName(name: string, index: number): string {
  if (!/[\u0600-\u06FF]/.test(name)) return name;
  return `Column ${index + 1}`;
}
