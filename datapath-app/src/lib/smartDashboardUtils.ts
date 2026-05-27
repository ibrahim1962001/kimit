import type { ColumnInfo, DataRow } from '../types';

type ColumnLike = Pick<ColumnInfo, 'name' | 'type'>;

export type SmartCategory =
  | 'sales'
  | 'finance'
  | 'sports'
  | 'hr'
  | 'health'
  | 'iot'
  | 'general';

export const SMART_CAT_META: Record<
  SmartCategory,
  { label: string; labelAr: string; icon: string; p: string; s: string; accent: string }
> = {
  sales: { label: 'Sales & Commerce', labelAr: 'مبيعات وتجارة', icon: '🛒', p: '#10b981', s: '#34d399', accent: '#059669' },
  finance: { label: 'Finance & Markets', labelAr: 'مالية وأسواق', icon: '💹', p: '#f59e0b', s: '#fbbf24', accent: '#d97706' },
  sports: { label: 'Sports Analytics', labelAr: 'تحليل رياضي', icon: '⚽', p: '#3b82f6', s: '#60a5fa', accent: '#2563eb' },
  hr: { label: 'Human Resources', labelAr: 'موارد بشرية', icon: '👥', p: '#8b5cf6', s: '#a78bfa', accent: '#7c3aed' },
  health: { label: 'Health & Medical', labelAr: 'صحة وطب', icon: '🏥', p: '#06b6d4', s: '#22d3ee', accent: '#0891b2' },
  iot: { label: 'IoT & Devices', labelAr: 'إنترنت الأشياء', icon: '📡', p: '#f43f5e', s: '#fb7185', accent: '#e11d48' },
  general: { label: 'Data Analytics', labelAr: 'تحليل بيانات', icon: '📊', p: '#6366f1', s: '#818cf8', accent: '#4f46e5' },
};

/** Behance-style layout preset per detected data domain */
export type SmartLayoutId =
  | 'commerce'
  | 'markets'
  | 'sports'
  | 'people'
  | 'clinical'
  | 'sensors'
  | 'explorer';

export interface SmartDashboardLayout {
  id: SmartLayoutId;
  /** CSS grid areas order for hero bento */
  hero: ('trend' | 'distribution' | 'breakdown' | 'composition')[];
  /** Secondary row chart slots */
  secondary: ('funnel' | 'pareto' | 'waterfall' | 'radar' | 'heatmap' | 'treemap' | 'bubble' | 'stacked')[];
  taglineEn: string;
  taglineAr: string;
}

export const SMART_DASH_LAYOUT: Record<SmartCategory, SmartDashboardLayout> = {
  sales: {
    id: 'commerce',
    hero: ['trend', 'composition', 'breakdown'],
    secondary: ['funnel', 'pareto', 'waterfall'],
    taglineEn: 'Revenue flow, category mix, and conversion funnel',
    taglineAr: 'تدفق الإيرادات، توزيع الفئات، وقمع التحويل',
  },
  finance: {
    id: 'markets',
    hero: ['trend', 'distribution', 'composition'],
    secondary: ['heatmap', 'waterfall', 'pareto'],
    taglineEn: 'Market trend, volatility, and correlation matrix',
    taglineAr: 'اتجاه السوق، التذبذب، ومصفوفة الارتباط',
  },
  sports: {
    id: 'sports',
    hero: ['breakdown', 'composition', 'trend'],
    secondary: ['radar', 'pareto', 'bubble'],
    taglineEn: 'Leaderboards, performance radar, and match metrics',
    taglineAr: 'لوحات الصدارة، رادار الأداء، ومقاييس المباريات',
  },
  hr: {
    id: 'people',
    hero: ['composition', 'breakdown', 'distribution'],
    secondary: ['funnel', 'radar', 'treemap'],
    taglineEn: 'Headcount mix, department breakdown, distributions',
    taglineAr: 'توزيع الموظفين، الأقسام، والتوزيعات الإحصائية',
  },
  health: {
    id: 'clinical',
    hero: ['distribution', 'trend', 'composition'],
    secondary: ['heatmap', 'radar', 'bubble'],
    taglineEn: 'Clinical distributions, vitals trend, cohort mix',
    taglineAr: 'توزيعات سريرية، اتجاه المؤشرات، ومزيج الفئات',
  },
  iot: {
    id: 'sensors',
    hero: ['trend', 'distribution', 'breakdown'],
    secondary: ['stacked', 'heatmap', 'bubble'],
    taglineEn: 'Sensor streams, signal distribution, device breakdown',
    taglineAr: 'تيارات الحساسات، توزيع الإشارة، وتفصيل الأجهزة',
  },
  general: {
    id: 'explorer',
    hero: ['trend', 'breakdown', 'composition'],
    secondary: ['treemap', 'pareto', 'radar'],
    taglineEn: 'Adaptive overview for any tabular dataset',
    taglineAr: 'نظرة عامة تتكيف مع أي مجموعة بيانات',
  },
};

export function getSmartDashboardLayout(cat: SmartCategory): SmartDashboardLayout {
  return SMART_DASH_LAYOUT[cat];
}

const ID_LIKE = /^(id|uuid|index|row|#|معرف|رقم|كود|code)$/i;
const ID_LIKE_PARTIAL = /\b(id|uuid|index|معرف)\b/i;

export function detectSmartCategory(columnNames: string[]): SmartCategory {
  const s = columnNames.join(' ').toLowerCase();
  if (/revenue|sales|profit|order|customer|product|price|discount|quantity|مبيعات|إيراد|ربح|طلب|عميل|منتج|سعر/.test(s)) return 'sales';
  if (/stock|dividend|asset|market|close|open|volume|fund|portfolio|سهم|أصل|سوق|محفظة/.test(s)) return 'finance';
  if (/player|team|score|goal|match|win|loss|game|season|point|لاعب|فريق|هدف|مباراة/.test(s)) return 'sports';
  if (/employee|salary|department|hire|position|staff|bonus|موظف|راتب|قسم|توظيف/.test(s)) return 'hr';
  if (/patient|diagnosis|treatment|blood|health|hospital|drug|مريض|تشخيص|علاج|مستشفى/.test(s)) return 'health';
  if (/sensor|device|temperature|humidity|pressure|voltage|iot|حساس|جهاز|حرارة|رطوبة/.test(s)) return 'iot';
  return 'general';
}

export function applyDashboardFilters(
  rows: DataRow[],
  activeFilters: Record<string, string>,
  crossFilters: { column: string; value: string }[],
): DataRow[] {
  let result = rows;
  const active = Object.entries(activeFilters).filter(([, v]) => v && v !== 'all');
  if (active.length) {
    result = result.filter(row =>
      active.every(([col, val]) => String(row[col] ?? '') === val),
    );
  }
  if (crossFilters.length) {
    result = result.filter(row =>
      crossFilters.every(cf => String(row[cf.column] ?? '') === cf.value),
    );
  }
  return result;
}

/** Prefer categorical columns suitable for charts (not IDs, not near-unique). */
export function pickBestCategoryColumn(columns: ColumnLike[], rows: DataRow[]): string | null {
  const candidates = columns.filter(c => c.type !== 'numeric');
  if (!candidates.length) return null;

  const scored = candidates.map(col => {
    const name = col.name.toLowerCase();
    let penalty = 0;
    if (ID_LIKE.test(name.trim()) || ID_LIKE_PARTIAL.test(name)) penalty += 800;
    const values = rows.map(r => String(r[col.name] ?? ''));
    const uniq = new Set(values.filter(v => v !== '')).size;
    const n = rows.length || 1;
    if (uniq <= 1) penalty += 600;
    if (uniq > n * 0.85) penalty += 400;
    if (uniq >= 2 && uniq <= 40) penalty -= 120;
    return { name: col.name, score: penalty + uniq };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.name ?? candidates[0].name;
}

export function pickBestNumericColumn(columns: ColumnLike[]): string | null {
  const nums = columns.filter(c => c.type === 'numeric');
  if (!nums.length) return null;

  const scored = nums.map(col => {
    const name = col.name.toLowerCase();
    let penalty = 0;
    if (ID_LIKE.test(name.trim()) || /\b(id|index|year|سنة)\b/.test(name)) penalty += 500;
    if (/amount|total|revenue|sales|price|quantity|قيمة|مبلغ|إجمالي/.test(name)) penalty -= 200;
    return { name: col.name, score: penalty };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.name ?? nums[0].name;
}

export function pickDateColumn(columns: ColumnLike[]): string | null {
  return columns.find(c => /date|time|تاريخ|وقت|month|شهر|year|سنة/i.test(c.name))?.name ?? null;
}

/** Cap rows for heavy chart computations. */
export function sampleRowsForCharts(rows: DataRow[], max = 8000): DataRow[] {
  if (rows.length <= max) return rows;
  const step = Math.ceil(rows.length / max);
  return rows.filter((_, i) => i % step === 0);
}

export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function groupBySum(
  data: DataRow[],
  cat: string,
  num: string,
  n = 10,
): { l: string; v: number }[] {
  const m = new Map<string, number>();
  data.forEach(r => {
    const k = String(r[cat] ?? 'N/A');
    m.set(k, (m.get(k) ?? 0) + (Number(r[num]) || 0));
  });
  return [...m.entries()]
    .map(([l, v]) => ({ l, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n);
}

export function groupByCount(data: DataRow[], cat: string, n = 8): { l: string; v: number }[] {
  const m = new Map<string, number>();
  data.forEach(r => {
    const k = String(r[cat] ?? 'N/A');
    m.set(k, (m.get(k) ?? 0) + 1);
  });
  return [...m.entries()]
    .map(([l, v]) => ({ l, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n);
}
