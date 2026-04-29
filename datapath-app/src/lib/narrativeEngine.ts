import type { DatasetInfo, ColumnInfo } from '../types';

export interface Insight {
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'info';
  /** Optional DAX snippet for the BI Bridge copy feature */
  daxSnippet?: string;
}

// ── Helpers ──────────────────────────────────────────────────
function fmt(n: number | undefined): string {
  if (n === undefined) return '—';
  return n >= 1_000_000
    ? (n / 1_000_000).toFixed(2) + 'M'
    : n >= 1_000
    ? (n / 1_000).toFixed(1) + 'K'
    : n.toFixed(2);
}

function topNumericCols(info: DatasetInfo, limit = 3): ColumnInfo[] {
  return info.columns.filter(c => c.type === 'numeric').slice(0, limit);
}

// ── Main Generator ────────────────────────────────────────────
export const generateAInarrative = (info: DatasetInfo): Insight[] => {
  const insights: Insight[] = [];
  const numericCols = topNumericCols(info);

  // 1. Data Quality Story
  if (info.totalNulls > 0) {
    insights.push({
      title: 'The Narrative Gap',
      description: `Your data story has missing chapters. With ${info.totalNulls} empty cells, your analysis is operating on partial visibility. Filling these gaps will reveal the complete business trajectory.`,
      type: 'warning',
    });
  } else {
    insights.push({
      title: 'A Flawless Foundation',
      description: 'Your dataset is perfectly contiguous. This integrity ensures that every trend we discover is backed by solid, uninterrupted evidence.',
      type: 'positive',
    });
  }

  // 2. Efficiency / Duplicates
  if (info.duplicates > 0) {
    insights.push({
      title: 'Resource Optimization',
      description: `We've identified ${info.duplicates} redundant entries that are inflating your metrics. Pruning this noise will sharpen your focus on unique customer behaviors.`,
      type: 'warning',
    });
  }

  // 3. Performance Story
  if (numericCols.length > 0) {
    const col = numericCols[0];
    insights.push({
      title: 'Revenue/Value Velocity',
      description: `The pulse of your data, "${col.name}", is beating at an average of ${fmt(col.mean)}. We've observed peaks up to ${fmt(col.max)}, suggesting high-growth potential if we can replicate those specific conditions.`,
      type: 'info',
      daxSnippet: `Avg_${col.name} = AVERAGE('KimitData'[${col.name}])`,
    });
  }

  // 4. Strategic Insight
  if (numericCols.length >= 2) {
    const [a, b] = numericCols;
    insights.push({
      title: 'Interconnected Growth',
      description: `There is a subtle dance between "${a.name}" and "${b.name}". Uncovering the strength of this relationship could be the key to your next cross-selling or optimization strategy.`,
      type: 'info',
      daxSnippet: `Correlation_${a.name}_${b.name} = DIVIDE(SUMX(KimitData, (KimitData[${a.name}] - [Avg_${a.name}]) * (KimitData[${b.name}] - [Avg_${b.name}])), SQRT(SUMX(KimitData, (KimitData[${a.name}] - [Avg_${a.name}])^2) * SUMX(KimitData, (KimitData[${b.name}] - [Avg_${b.name}])^2)))`,
    });
  }

  return insights;
};
