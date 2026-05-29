import React, { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { AdSpace } from '../components/AdSpace';
import { useKimitData } from '../hooks/useKimitData';
import { useUser } from '../contexts/UserContext';
import { exportSmartDashboardBundle } from '../lib/smartDashboardHtmlExport';
import {
  openExportedDashboardPreview,
  readExportedDashboardPreview,
} from '../lib/smartDashboardExportPreview';
import { ExportedDashboardOverlay } from '../components/ExportedDashboardOverlay';
import { navigateToTab } from '../lib/appNavigation';
import type { SmartDashboardBundlePayload } from '../lib/smartDashboardHtmlExport';
import { datasetsApi } from '../api/datasets.api';
import {
  barOpt,
  CHART,
  type ChartThemeMode,
  donutOpt,
  heatmapOpt,
  histOpt,
  lineOpt,
  paretoOpt,
  pyramidOpt,
  radarOpt,
  treemapOpt,
} from '../lib/smartDashboardCharts';
import {
  applyDashboardFilters,
  detectSmartCategory,
  fmtCompact as fmt,
  getSmartDashboardLayout,
  groupByCount,
  groupBySum,
  pickBestCategoryColumn,
  pickBestNumericColumn,
  pickDateColumn,
  sampleRowsForCharts,
  SMART_CAT_META,
  type SmartDashboardLayout,
} from '../lib/smartDashboardUtils';
import { ArrowLeft, Download, RefreshCw, LayoutDashboard, Filter, X, Sun, Moon, BarChart2, Share2, Copy } from 'lucide-react';
import { createSharedDashboard } from '../lib/dashboardShare';
import './smart-dashboard-redesign.css';

interface Props { onBack: () => void; }
function calcStats(vals: number[]) {
  const s = vals.filter(v => !isNaN(v) && v !== null).sort((a, b) => a - b);
  const n = s.length; if (n === 0) return null;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0 ? (s[n/2-1] + s[n/2]) / 2 : s[Math.floor(n/2)];
  const std = Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  const q1 = s[Math.floor(n * 0.25)]; const q3 = s[Math.floor(n * 0.75)]; const iqr = q3 - q1;
  const outliers = s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
  return { mean, median, std, min: s[0], max: s[n-1], q1, q3, outliers, n };
}
// ── Statistical Helpers ──────────────────────────────────────────
function calcSkew(vals: number[], mean: number, std: number): number {
  const n = vals.length; if (n < 3 || !std) return 0;
  return (vals.reduce((a, v) => a + Math.pow((v - mean) / std, 3), 0) / n);
}
function calcKurt(vals: number[], mean: number, std: number): number {
  const n = vals.length; if (n < 4 || !std) return 0;
  return (vals.reduce((a, v) => a + Math.pow((v - mean) / std, 4), 0) / n) - 3;
}
function calcMode(vals: number[]): number {
  const freq = new Map<number, number>();
  vals.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx); const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  cell?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, cell, children, className = '' }) => (
  <div className={`sd2-card sd-chart-card${cell ? ` sd2-cell sd2-cell--${cell}` : ''} ${className}`.trim()}>
    <div className="sd2-card-head">
      <div className="sd2-card-title">{title}</div>
      {subtitle ? <div className="sd2-card-sub">{subtitle}</div> : null}
    </div>
    {children}
  </div>
);

// ── Main Page ────────────────────────────────────────────────────
export const SmartDashboardPage: React.FC<Props> = ({ onBack }) => {
  const {
    info,
    activeFilters,
    crossFilters,
    isCrossFiltered,
    clearCrossFilters,
    clearFilters,
    setFilter,
    setCrossFilter,
  } = useKimitData();
  const { user } = useUser();
  const [refreshKey, setRefreshKey] = useState(0);
  const [pbiExporting, setPbiExporting] = useState(false);
  const [pbiHint, setPbiHint] = useState<string | null>(null);
  const [exportHint, setExportHint] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportPreview, setExportPreview] = useState<SmartDashboardBundlePayload | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pbiModalOpen, setPbiModalOpen] = useState(false);
  const [pbiStep, setPbiStep] = useState<'idle' | 'checking' | 'publishing' | 'opening' | 'done' | 'error'>('idle');
  const [brandLogoDataUrl, setBrandLogoDataUrl] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('kimit_brand_logo') || '';
  });
  const [chartTheme, setChartTheme] = useState<ChartThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'light';
    return localStorage.getItem('kimit_sd_theme') === 'dark' ? 'dark' : 'light';
  });

  const toggleChartTheme = () => {
    setChartTheme(prev => {
      const next: ChartThemeMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('kimit_sd_theme', next);
      return next;
    });
  };

  const lang = (typeof localStorage !== 'undefined' ? localStorage.getItem('kimit_lang') : null) || 'en';
  const isAr = lang === 'ar';
  const userDisplayName =
    user?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    (isAr ? 'مستخدم' : 'User');
  const userEmail = user?.email || (isAr ? 'زائر' : 'Guest');
  const userInitial = (userDisplayName[0] || 'U').toUpperCase();
  const [manualMap, setManualMap] = useState<{
    country: string;
    name: string;
    followers: string;
    age: string;
    gender: string;
  }>(() => {
    if (typeof localStorage === 'undefined') return { country: '', name: '', followers: '', age: '', gender: '' };
    try {
      const raw = localStorage.getItem('kimit_dashboard_manual_map');
      if (!raw) return { country: '', name: '', followers: '', age: '', gender: '' };
      const parsed = JSON.parse(raw) as Partial<{ country: string; name: string; followers: string; age: string; gender: string }>;
      return {
        country: parsed.country ?? '',
        name: parsed.name ?? '',
        followers: parsed.followers ?? '',
        age: parsed.age ?? '',
        gender: parsed.gender ?? '',
      };
    } catch {
      return { country: '', name: '', followers: '', age: '', gender: '' };
    }
  });
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const [whatIfPct, setWhatIfPct] = useState(0);
  const [goalTarget, setGoalTarget] = useState(100);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presetBootstrapped, setPresetBootstrapped] = useState(false);
  const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; data: unknown }>>(() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('kimit_saved_views') || '[]');
    } catch {
      return [];
    }
  });

  const handleBrandLogoUpload: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setBrandLogoDataUrl(dataUrl);
      if (typeof localStorage !== 'undefined') localStorage.setItem('kimit_brand_logo', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearBrandLogo = () => {
    setBrandLogoDataUrl('');
    if (typeof localStorage !== 'undefined') localStorage.removeItem('kimit_brand_logo');
  };

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('kimit_saved_views', JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    const openFromStorage = () => {
      const p = readExportedDashboardPreview();
      if (p) setExportPreview(p);
    };
    if (window.location.pathname.replace(/\/+$/, '') === '/dashboard-preview') {
      openFromStorage();
      navigateToTab('smart-dashboard', true);
    }
    window.addEventListener('kimit:open-export-preview', openFromStorage);
    return () => window.removeEventListener('kimit:open-export-preview', openFromStorage);
  }, []);

  const publishToPowerBI = async () => {
    if (!info) return;
    setPbiExporting(true);
    setPbiHint(null);
    setPbiStep('checking');
    try {
      const st = await datasetsApi.powerBIStatus();
      if (!st.enabled || !st.configured) {
        setPbiStep('error');
        setPbiHint(
          isAr
            ? 'Power BI غير مفعّل على السيرفر. تواصل مع الإدارة لتفعيل الربط.'
            : 'Power BI is not configured on the server yet. Ask admin to enable integration.',
        );
        return;
      }
      setPbiStep('publishing');
      const res = await datasetsApi.publishPowerBI({
        datasetName: info.filename.replace(/\.[^.]+$/, '') || info.filename,
        rows: rawData.map(r => ({ ...r })),
        columns: info.columns.map(c => ({ name: c.name, type: c.type })),
      });
      setPbiStep('opening');
      setPbiHint(
        st.needsTemplate
          ? (isAr
              ? 'تم النشر. افتح الرابط وأنشئ التقرير مرة واحدة، وبعدها أضف Template للتجهيز التلقائي.'
              : 'Published successfully. Create your report once, then set a template ID for auto-ready reports.')
          : (isAr ? 'تم النشر وفتح التقرير التفاعلي.' : 'Published and opened interactive report.'),
      );
      window.open(res.reportUrl, '_blank', 'noopener,noreferrer');
      setPbiStep('done');
      window.setTimeout(() => setPbiModalOpen(false), 900);
    } catch (e: unknown) {
      console.error(e);
      setPbiStep('error');
      const message = e instanceof Error ? e.message : String(e);
      if (message.toLowerCase().includes('401') || message.toLowerCase().includes('not synced')) {
        setPbiHint(isAr ? 'سجّل دخولك أولًا ثم جرّب Publish مرة أخرى.' : 'Please sign in first, then try Publish again.');
      } else {
        setPbiHint(
          isAr
            ? `فشل النشر: ${message}`
            : `Publish failed: ${message}`,
        );
      }
    } finally {
      setPbiExporting(false);
    }
  };

  const rawData = useMemo(() => {
    if (!info) return [];
    return applyDashboardFilters(info.workData, activeFilters, crossFilters);
  }, [info, activeFilters, crossFilters]);

  const data = useMemo(() => sampleRowsForCharts(rawData), [rawData]);
  const isSampled = rawData.length > data.length;
  const allCols = useMemo(() => (info?.columns ?? []).map(c => c.name), [info]);

  const numCols = useMemo(
    () => (info?.columns ?? []).filter(c => c.type === 'numeric').map(c => c.name),
    [info],
  );

  const primaryCat = useMemo(
    () => (info ? pickBestCategoryColumn(info.columns, rawData) : null),
    [info, rawData],
  );
  const primaryNum = useMemo(
    () => (info ? pickBestNumericColumn(info.columns) : null),
    [info],
  );
  const dateCol = useMemo(
    () => (info ? pickDateColumn(info.columns) : null),
    [info],
  );

  const catCols = useMemo(() => {
    const rest = (info?.columns ?? []).filter(c => c.type !== 'numeric').map(c => c.name);
    if (primaryCat && !rest.includes(primaryCat)) return [primaryCat, ...rest];
    if (primaryCat) return [primaryCat, ...rest.filter(c => c !== primaryCat)];
    return rest;
  }, [info, primaryCat]);

  const orderedNumCols = useMemo(() => {
    if (!primaryNum || !numCols.includes(primaryNum)) return numCols;
    return [primaryNum, ...numCols.filter(c => c !== primaryNum)];
  }, [numCols, primaryNum]);

  const cat = useMemo(
    () => detectSmartCategory((info?.columns ?? []).map(c => c.name)),
    [info],
  );
  const meta = SMART_CAT_META[cat];
  const dashLayout: SmartDashboardLayout = useMemo(() => getSmartDashboardLayout(cat), [cat]);
  const columnByName = useMemo(
    () => new Map((info?.columns ?? []).map(c => [c.name, c])),
    [info],
  );

  const palette = useMemo(() => CHART.palette, []);

  // KPI values
  const kpis = useMemo(() => {
    const result = [];
    const n = orderedNumCols[0];
    if (n) {
      const vals = data.map(r => Number(r[n]) || 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const avg   = total / (vals.length || 1);
      const max   = Math.max(...vals);
      const sparkVals = vals.slice(0, 30);
      result.push({ title: `Total ${n}`,   value: fmt(total), sub: `across ${data.length} rows`, color: meta.p, sparkVals, icon: '📈' });
      result.push({ title: `Avg ${n}`,     value: fmt(Math.round(avg)), sub: 'per record', color: meta.s, sparkVals: sparkVals.map((_, i) => i % 2 === 0 ? avg * 0.9 : avg * 1.1), icon: '⚡' });
      result.push({ title: `Max ${n}`,     value: fmt(max), sub: 'highest value', color: '#f59e0b', sparkVals: sparkVals.map(v => v === max ? max : max * 0.6), icon: '🏆' });
    }
    result.push({ title: 'Total Records', value: fmt(data.length), sub: `${catCols.length} categories`, color: '#6366f1', sparkVals: Array.from({ length: 20 }, (_, i) => i + 1), icon: '📋' });
    return result.slice(0, 4);
  }, [data, orderedNumCols, catCols, meta]);

  // Trend (line) chart — date column when available, else row index
  const trendOpts = useMemo(() => {
    const col = orderedNumCols[0];
    if (!col) return null;

    let rows = [...data];
    if (dateCol) {
      rows.sort((a, b) => String(a[dateCol] ?? '').localeCompare(String(b[dateCol] ?? '')));
    }
    const step = Math.max(1, Math.floor(rows.length / 60));
    const sliced = rows.filter((_, i) => i % step === 0).slice(0, 60);
    const labels = dateCol
      ? sliced.map(r => String(r[dateCol] ?? '').slice(0, 12))
      : sliced.map((_, i) => String(i + 1));
    const values = sliced.map(r => Number(r[col]) || 0);
    return lineOpt(labels, values, meta.p, chartTheme);
  }, [data, orderedNumCols, dateCol, meta, chartTheme]);

  // Bar chart — top categories by first numeric
  const barOpts = useMemo(() => {
    if (!catCols[0] || !orderedNumCols[0]) return null;
    const rows = groupBySum(data, catCols[0], orderedNumCols[0], 10).reverse();
    return barOpt(rows.map(r => r.l.length > 16 ? r.l.slice(0, 14) + '…' : r.l), rows.map(r => r.v), meta.s, chartTheme);
  }, [data, catCols, orderedNumCols, meta, chartTheme]);

  // Donut chart — category distribution
  const donutOpts = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 7);
    return donutOpt(rows, palette, chartTheme);
  }, [data, catCols, palette, chartTheme]);

  // Descriptive statistics per numeric column
  const statsData = useMemo(() =>
    orderedNumCols.slice(0, 6).map(col => {
      const vals = data.map(r => Number(r[col]));
      const st = calcStats(vals);
      return st ? { col, ...st } : null;
    }).filter(Boolean) as ({ col: string; mean: number; median: number; std: number; min: number; max: number; q1: number; q3: number; outliers: number; n: number })[],
  [data, orderedNumCols]);

  // Auto-generated decision insights
  const insights = useMemo(() => {
    const result: { icon: string; title: string; desc: string; color: string }[] = [];
    if (isCrossFiltered) {
      result.push({
        icon: '🔎',
        title: isAr ? 'فلتر نشط' : 'Active Filter',
        desc: isAr
          ? `يعرض ${rawData.length.toLocaleString()} صفاً من أصل ${(info?.workData.length ?? 0).toLocaleString()}`
          : `Showing ${rawData.length.toLocaleString()} of ${(info?.workData.length ?? 0).toLocaleString()} rows`,
        color: '#3b82f6',
      });
    }
    if (catCols[0] && orderedNumCols[0]) {
      const top = groupBySum(data, catCols[0], orderedNumCols[0], 1)[0];
      if (top) {
        result.push({
          icon: '🏆',
          title: isAr ? 'الأعلى أداءً' : 'Top Performer',
          desc: isAr
            ? `"${top.l.slice(0, 20)}" يتصدر بـ ${fmt(top.v)} في ${orderedNumCols[0]}`
            : `"${top.l.slice(0, 20)}" leads with ${fmt(top.v)} in ${orderedNumCols[0]}`,
          color: '#10b981',
        });
      }
    }
    const s0 = statsData[0];
    if (s0 && s0.outliers > 0) {
      const pct = Math.round((s0.outliers / s0.n) * 100);
      result.push({ icon: '⚠️', title: 'Outliers Detected', desc: `${s0.outliers} values (${pct}%) are outliers in "${s0.col}"`, color: '#f59e0b' });
    }
    const missing = data.reduce((a, r) => a + Object.values(r).filter(v => v === null || v === undefined || v === '').length, 0);
    if (missing > 0) result.push({ icon: '🔍', title: 'Missing Data Alert', desc: `${missing.toLocaleString()} empty cells — run Cleaning to fix`, color: '#ef4444' });
    else result.push({ icon: '✅', title: 'Clean Dataset', desc: 'No missing values detected across all columns', color: '#10b981' });
    if (s0) result.push({ icon: '📊', title: 'Value Range', desc: `"${s0.col}" spans ${fmt(s0.min)} → ${fmt(s0.max)}, avg ${fmt(Math.round(s0.mean))}`, color: '#6366f1' });
    if (catCols[0]) {
      const unique = new Set(data.map(r => String(r[catCols[0]]))).size;
      result.push({ icon: '🎯', title: 'Category Diversity', desc: `"${catCols[0]}" contains ${unique} unique values`, color: '#3b82f6' });
    }
    return result.slice(0, 5);
  }, [data, orderedNumCols, catCols, statsData, isCrossFiltered, rawData.length, info?.workData.length, isAr]);

  // Top 5 & Bottom 5 by primary metric
  const topBottom = useMemo(() => {
    if (!orderedNumCols[0]) return { top: [], bottom: [] };
    const col = orderedNumCols[0];
    const sorted = [...data].sort((a, b) => (Number(b[col]) || 0) - (Number(a[col]) || 0));
    return { top: sorted.slice(0, 5), bottom: [...sorted.slice(-5)].reverse() };
  }, [data, orderedNumCols]);

  const audienceCards = useMemo(() => {
    const cols = info?.columns ?? [];
    const autoName =
      cols.find(c => /name|influencer|customer|client|user|person|اسم/i.test(c.name))?.name ?? catCols[0] ?? null;
    const autoFollowers =
      cols.find(c => c.type === 'numeric' && /follower|fan|audience|reach|sales|amount|value/i.test(c.name))?.name
      ?? orderedNumCols[0]
      ?? null;
    const autoCountry = cols.find(c => /country|region|nation|state|city|بلد|دولة/i.test(c.name))?.name ?? null;
    const autoAge = cols.find(c => c.type === 'numeric' && /age|عمر/i.test(c.name))?.name ?? null;
    const autoGender = cols.find(c => /gender|sex|نوع/i.test(c.name))?.name ?? null;

    const pick = (manual: string, fallback: string | null): string | null =>
      manual && cols.some(c => c.name === manual) ? manual : fallback;

    const nameCol = pick(manualMap.name, autoName);
    const followersCol = pick(manualMap.followers, autoFollowers);
    const countryCol = pick(manualMap.country, autoCountry);
    const ageCol = pick(manualMap.age, autoAge);
    const genderCol = pick(manualMap.gender, autoGender);

    const reachTop = countryCol ? groupByCount(data, countryCol, 5) : [];
    const influencerRows = nameCol && followersCol
      ? [...data]
          .map(r => ({
            name: String(r[nameCol] ?? '—'),
            followers: Number(r[followersCol]) || 0,
          }))
          .filter(r => r.name && r.name !== '—')
          .sort((a, b) => b.followers - a.followers)
          .slice(0, 6)
      : [];

    let ageGenderOpt: object | null = null;
    if (ageCol && genderCol) {
      const bins = ['15-24', '25-34', '35-44', '45-54', '55+'];
      const male = new Array(bins.length).fill(0);
      const female = new Array(bins.length).fill(0);
      const idx = (age: number) => (age < 25 ? 0 : age < 35 ? 1 : age < 45 ? 2 : age < 55 ? 3 : 4);
      for (const row of data) {
        const age = Number(row[ageCol]);
        if (!Number.isFinite(age)) continue;
        const g = String(row[genderCol] ?? '').toLowerCase();
        const i = idx(age);
        if (g.includes('f')) female[i] += 1;
        else male[i] += 1;
      }
      ageGenderOpt = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
        grid: { left: 28, right: 18, top: 30, bottom: 20, containLabel: true },
        xAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#334155' } } },
        yAxis: { type: 'category', data: bins, axisLabel: { color: '#94a3b8' } },
        series: [
          { name: isAr ? 'ذكور' : 'Male', type: 'bar', stack: 'g', data: male.map(v => -v), itemStyle: { color: '#3b82f6' } },
          { name: isAr ? 'إناث' : 'Female', type: 'bar', stack: 'g', data: female, itemStyle: { color: '#10b981' } },
        ],
      };
    }

    let interestOpt: object | null = null;
    const interestCols = orderedNumCols.slice(0, 6);
    if (interestCols.length >= 3 && catCols[0]) {
      const topCats = groupByCount(data, catCols[0], 3).map(g => g.l);
      if (topCats.length) {
        const indicators = interestCols.map(col => ({
          name: col.length > 10 ? `${col.slice(0, 9)}…` : col,
          max: Math.max(1, ...data.map(r => Number(r[col]) || 0)),
        }));
        const series = topCats.map((catName) => {
          const rows = data.filter(r => String(r[catCols[0]]) === catName);
          return {
            value: interestCols.map(col => Math.round(rows.reduce((s, r) => s + (Number(r[col]) || 0), 0) / (rows.length || 1))),
            name: catName.length > 12 ? `${catName.slice(0, 11)}…` : catName,
            lineStyle: { width: 2 },
          };
        });
        interestOpt = {
          tooltip: {},
          legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 10 } },
          radar: {
            indicator: indicators,
            splitLine: { lineStyle: { color: '#334155' } },
            splitArea: { areaStyle: { color: ['rgba(148,163,184,0.03)'] } },
            axisName: { color: '#94a3b8', fontSize: 10 },
          },
          series: [{ type: 'radar', data: series }],
        };
      }
    }

    return { reachTop, countryCol, followersCol, influencerRows, ageGenderOpt, interestOpt };
  }, [info, data, catCols, orderedNumCols, isAr, manualMap]);

  const mappingWarnings = useMemo(() => {
    const warnings: string[] = [];
    const typeOf = (name: string) => columnByName.get(name)?.type;
    if (manualMap.age && typeOf(manualMap.age) !== 'numeric') {
      warnings.push(isAr ? 'عمود Age يجب أن يكون رقمي.' : 'Age column should be numeric.');
    }
    if (manualMap.followers && typeOf(manualMap.followers) !== 'numeric') {
      warnings.push(isAr ? 'عمود Followers/Metric يجب أن يكون رقمي.' : 'Followers/Metric column should be numeric.');
    }
    if (manualMap.gender && typeOf(manualMap.gender) === 'numeric') {
      warnings.push(isAr ? 'عمود Gender لا يُفضل أن يكون رقمي.' : 'Gender column should usually be text.');
    }
    if (manualMap.country && typeOf(manualMap.country) === 'numeric') {
      warnings.push(isAr ? 'عمود Country/Region لا يُفضل أن يكون رقمي.' : 'Country/Region column should usually be text.');
    }
    return warnings;
  }, [manualMap, columnByName, isAr]);

  const drillLevels = useMemo(() => catCols.slice(0, 3), [catCols]);
  const drillData = useMemo(() => {
    if (!drillLevels.length) return data;
    return data.filter(row =>
      drillPath.every((val, i) => String(row[drillLevels[i]] ?? '') === val),
    );
  }, [data, drillLevels, drillPath]);
  const drillOptions = useMemo(() => {
    const nextCol = drillLevels[drillPath.length];
    if (!nextCol) return [];
    return groupByCount(drillData, nextCol, 12);
  }, [drillLevels, drillPath, drillData]);

  const primaryMetric = orderedNumCols[0] ?? null;
  const actualTotal = useMemo(
    () => (primaryMetric ? rawData.reduce((s, r) => s + (Number(r[primaryMetric]) || 0), 0) : 0),
    [rawData, primaryMetric],
  );
  const scenarioTotal = Math.round(actualTotal * (1 + whatIfPct / 100));
  const varianceToGoal = scenarioTotal - goalTarget;
  const goalProgress = goalTarget > 0 ? Math.max(0, Math.min(140, Math.round((scenarioTotal / goalTarget) * 100))) : 0;

  const compareStats = useMemo(() => {
    if (!dateCol || !primaryMetric) return null;
    const rows = [...rawData]
      .map(r => ({ d: String(r[dateCol] ?? '').slice(0, 10), v: Number(r[primaryMetric]) || 0 }))
      .filter(r => !!r.d)
      .sort((a, b) => a.d.localeCompare(b.d));
    if (rows.length < 4) return null;
    const split = Math.floor(rows.length / 2);
    const prev = rows.slice(0, split).reduce((s, r) => s + r.v, 0);
    const curr = rows.slice(split).reduce((s, r) => s + r.v, 0);
    const deltaPct = prev ? Math.round(((curr - prev) / prev) * 1000) / 10 : 0;
    return { prev, curr, deltaPct };
  }, [rawData, dateCol, primaryMetric]);

  const forecastOpt = useMemo(() => {
    if (!dateCol || !primaryMetric) return null;
    const points = [...rawData]
      .map(r => ({ x: String(r[dateCol] ?? '').slice(0, 10), y: Number(r[primaryMetric]) || 0 }))
      .filter(p => p.x)
      .sort((a, b) => a.x.localeCompare(b.x))
      .slice(-24);
    if (points.length < 6) return null;
    const y = points.map(p => p.y);
    const x = y.map((_, i) => i + 1);
    const n = x.length;
    const sx = x.reduce((a, b) => a + b, 0);
    const sy = y.reduce((a, b) => a + b, 0);
    const sxy = x.reduce((a, v, i) => a + v * y[i], 0);
    const sx2 = x.reduce((a, v) => a + v * v, 0);
    const slope = (n * sxy - sx * sy) / Math.max(1, n * sx2 - sx * sx);
    const intercept = sy / n - slope * (sx / n);
    const resid = y.map((v, i) => v - (intercept + slope * (i + 1)));
    const std = Math.sqrt(resid.reduce((a, v) => a + v * v, 0) / Math.max(1, resid.length));
    const forecast = Array.from({ length: 6 }, (_, i) => {
      const idx = n + i + 1;
      const pred = intercept + slope * idx;
      return { m: `+${i + 1}m`, p: Math.round(pred), low: Math.round(pred - 1.28 * std), high: Math.round(pred + 1.28 * std) };
    });
    return {
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: '#94a3b8', fontSize: 10 } },
      xAxis: { type: 'category', data: [...points.slice(-6).map(p => p.x), ...forecast.map(f => f.m)], axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
      series: [
        { name: isAr ? 'Actual' : 'Actual', type: 'line', data: [...points.slice(-6).map(p => Math.round(p.y)), ...Array(6).fill(null)], smooth: true },
        { name: isAr ? 'Forecast' : 'Forecast', type: 'line', data: [...Array(6).fill(null), ...forecast.map(f => f.p)], smooth: true, lineStyle: { type: 'dashed' } },
        { name: 'Low', type: 'line', data: [...Array(6).fill(null), ...forecast.map(f => f.low)], lineStyle: { opacity: 0 }, stack: 'ci', areaStyle: { color: 'rgba(59,130,246,0.08)' } },
        { name: 'High', type: 'line', data: [...Array(6).fill(null), ...forecast.map(f => f.high - f.low)], lineStyle: { opacity: 0 }, stack: 'ci', areaStyle: { color: 'rgba(59,130,246,0.12)' } },
      ],
    };
  }, [rawData, dateCol, primaryMetric, isAr]);

  const smartAlerts = useMemo(() => {
    const alerts: Array<{ level: 'warn' | 'ok'; text: string }> = [];
    if (compareStats && compareStats.deltaPct < -12) alerts.push({ level: 'warn', text: isAr ? `انخفاض ${Math.abs(compareStats.deltaPct)}% مقارنة بالفترة السابقة` : `Drop of ${Math.abs(compareStats.deltaPct)}% vs previous period` });
    if (compareStats && compareStats.deltaPct > 20) alerts.push({ level: 'warn', text: isAr ? `Spike مرتفع +${compareStats.deltaPct}%` : `High spike +${compareStats.deltaPct}%` });
    if (goalProgress < 85) alerts.push({ level: 'warn', text: isAr ? 'أقل من الهدف الحالي' : 'Below current goal target' });
    if (alerts.length === 0) alerts.push({ level: 'ok', text: isAr ? 'لا توجد تنبيهات حرجة' : 'No critical alerts detected' });
    return alerts.slice(0, 3);
  }, [compareStats, goalProgress, isAr]);

  const topDrivers = useMemo(() => {
    if (!primaryMetric) return [];
    const y = data.map(r => Number(r[primaryMetric]) || 0);
    const corr = (a: number[], b: number[]) => {
      const n = a.length || 1;
      const ma = a.reduce((s, v) => s + v, 0) / n;
      const mb = b.reduce((s, v) => s + v, 0) / n;
      const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
      const da = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0));
      const db = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
      return da && db ? num / (da * db) : 0;
    };
    return numCols
      .filter(c => c !== primaryMetric)
      .map(c => ({ col: c, score: Math.abs(corr(data.map(r => Number(r[c]) || 0), y)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [data, numCols, primaryMetric]);

  const segmentMatrix = useMemo(() => {
    if (!catCols[0] || !catCols[1] || !primaryMetric) return null;
    const rVals = [...new Set(data.map(r => String(r[catCols[0]] ?? '—')))].slice(0, 6);
    const cVals = [...new Set(data.map(r => String(r[catCols[1]] ?? '—')))].slice(0, 6);
    const grid = rVals.map(rn =>
      cVals.map(cn =>
        Math.round(
          data
            .filter(r => String(r[catCols[0]] ?? '—') === rn && String(r[catCols[1]] ?? '—') === cn)
            .reduce((s, r) => s + (Number(r[primaryMetric]) || 0), 0),
        ),
      ),
    );
    return { rows: rVals, cols: cVals, grid };
  }, [data, catCols, primaryMetric]);

  const autoNarrative = useMemo(() => {
    const bullets: string[] = [];
    if (compareStats) bullets.push(compareStats.deltaPct >= 0 ? `${isAr ? 'نمو' : 'Growth'} +${compareStats.deltaPct}%` : `${isAr ? 'انخفاض' : 'Decline'} ${compareStats.deltaPct}%`);
    if (topDrivers[0]) bullets.push(`${isAr ? 'أقوى مؤثر' : 'Top driver'}: ${topDrivers[0].col} (${Math.round(topDrivers[0].score * 100)}%)`);
    if (audienceCards.reachTop[0]) bullets.push(`${isAr ? 'أعلى منطقة' : 'Top region'}: ${audienceCards.reachTop[0].l}`);
    if (goalProgress) bullets.push(`${isAr ? 'تقدم الهدف' : 'Goal progress'}: ${goalProgress}%`);
    if (smartAlerts[0]) bullets.push(smartAlerts[0].text);
    return bullets.slice(0, 5);
  }, [compareStats, topDrivers, audienceCards.reachTop, goalProgress, smartAlerts, isAr]);

  // Missing data per column
  const missingCols = useMemo(() =>
    (info?.columns ?? []).map(c => ({
      col: c.name,
      pct: Math.round((data.filter(r => r[c.name] === null || r[c.name] === undefined || r[c.name] === '').length / (data.length || 1)) * 100),
    })).filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 8),
  [data, info]);

  // Histogram of first numeric column
  const histChart = useMemo(() => {
    if (!orderedNumCols[0]) return null;
    const vals = data.map(r => Number(r[orderedNumCols[0]])).filter(v => !isNaN(v));
    return histOpt(vals, orderedNumCols[0], meta.s, chartTheme);
  }, [data, orderedNumCols, meta, chartTheme]);

  // Radar chart — top 5 categories across all numeric cols
  const radarChart = useMemo(() => {
    if (numCols.length < 2 || !catCols[0]) return null;
    const topCats = groupByCount(data, catCols[0], 5).map(g => g.l);
    if (topCats.length < 3) return null;
    const numSlice = numCols.slice(0, 5);
    const indicators = numSlice.map(col => {
      const max = Math.max(...data.map(r => Number(r[col]) || 0));
      return { name: col.length > 10 ? col.slice(0, 9) + '…' : col, max: max || 1 };
    });
    const series = topCats.slice(0, 4).map(cat => {
      const rows = data.filter(r => String(r[catCols[0]]) === cat);
      const value = numSlice.map(col => Math.round(rows.reduce((s, r) => s + (Number(r[col]) || 0), 0) / (rows.length || 1)));
      return { name: cat.length > 12 ? cat.slice(0, 11) + '…' : cat, value };
    });
    return radarOpt(indicators, series, palette, chartTheme);
  }, [data, numCols, catCols, palette, chartTheme]);



  // Column profiling — per column detail
  const columnProfile = useMemo(() =>
    (info?.columns ?? []).map(col => {
      const vals = data.map(r => r[col.name]);
      const filled = vals.filter(v => v !== null && v !== undefined && v !== '').length;
      const fillRate = Math.round((filled / (data.length || 1)) * 100);
      const strVals = vals.map(v => String(v ?? '')).filter(v => v && v !== 'null' && v !== 'undefined');
      const uniqCount = new Set(strVals).size;
      const uniqRate = Math.round((uniqCount / (filled || 1)) * 100);
      const freq = new Map<string, number>();
      strVals.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
      const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
      const zeros = String(col.type) === 'numeric' ? vals.filter(v => Number(v) === 0).length : 0;
      return { name: col.name, type: String(col.type), fillRate, uniqCount, uniqRate, topVal: top?.[0]?.slice(0, 20) ?? '—', topCount: top?.[1] ?? 0, zeros };
    }), [data, info]);

  // Dataset summary totals
  const summaryStats = useMemo(() => {
    const cols = info?.columns ?? [];
    const totalCells = data.length * cols.length;
    const emptyCells = data.reduce((a, r) => a + Object.values(r).filter(v => v === null || v === undefined || v === '').length, 0);
    const seen = new Set<string>(); let dupRows = 0;
    data.forEach(r => { const k = JSON.stringify(r); if (seen.has(k)) dupRows++; else seen.add(k); });
    return {
      totalCells, emptyCells, dupRows,
      numColsCount: numCols.length,
      catColsCount: cols.filter(c => String(c.type) !== 'numeric').length,
      dateColsCount: cols.filter(c => String(c.type) === 'date').length,
      fillRate: Math.round(((totalCells - emptyCells) / (totalCells || 1)) * 100),
      uniqRows: data.length - dupRows,
      colRowRatio: (cols.length / (data.length || 1)).toFixed(4),
      density: Math.round(((totalCells - emptyCells) / (totalCells || 1)) * 100),
    };
  }, [data, info, numCols]);

  // Pareto chart (80/20 rule)
  const paretoChart = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 15);
    return paretoOpt(rows.map(r => r.l.length > 10 ? r.l.slice(0, 9) + '…' : r.l), rows.map(r => r.v), meta.p, chartTheme);
  }, [data, catCols, numCols, meta, chartTheme]);

  // Correlation Heatmap
  const correlationChart = useMemo(() => {
    if (numCols.length < 3) return null;
    const cols = numCols.slice(0, 7);
    const getVals = (col: string) => data.map(r => Number(r[col]) || 0);
    const corr = (a: number[], b: number[]) => {
      const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
      const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
      const da = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0));
      const db = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
      return da && db ? Math.round((num / (da * db)) * 100) / 100 : 0;
    };
    const matrix = cols.map(ca => cols.map(cb => corr(getVals(ca), getVals(cb))));
    return heatmapOpt(cols.map(c => c.length > 8 ? c.slice(0, 7) + '…' : c), matrix, chartTheme);
  }, [data, numCols, chartTheme]);

  // Treemap
  const treemapChart = useMemo(() => {
    if (!catCols[0] || !numCols[0]) return null;
    const rows = groupBySum(data, catCols[0], numCols[0], 25);
    return treemapOpt(rows.map(r => ({ name: r.l.length > 20 ? r.l.slice(0, 19) + '…' : r.l, value: Math.max(1, Math.round(r.v)) })), meta.p, chartTheme);
  }, [data, catCols, numCols, meta, chartTheme]);

  // Advanced stats per numeric column (skewness, kurtosis, mode, CV, percentiles, IQR, sum, variance)
  const advStats = useMemo(() =>
    numCols.slice(0, 6).map(col => {
      const vals = data.map(r => Number(r[col])).filter(v => !isNaN(v));
      const sorted = [...vals].sort((a, b) => a - b);
      const n = sorted.length; if (!n) return null;
      const mean = vals.reduce((a, b) => a + b, 0) / n;
      const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
      const std = Math.sqrt(variance);
      const q1 = percentile(sorted, 25); const q3 = percentile(sorted, 75);
      const p5 = percentile(sorted, 5);  const p95 = percentile(sorted, 95);
      const skew = calcSkew(vals, mean, std);
      const kurt = calcKurt(vals, mean, std);
      const mode = calcMode(vals);
      const cv = std / (mean || 1) * 100;
      const sum = vals.reduce((a, b) => a + b, 0);
      const iqr = q3 - q1;
      const neg = vals.filter(v => v < 0).length;
      const pos = vals.filter(v => v > 0).length;
      const skewLabel = Math.abs(skew) < 0.5 ? 'Symmetric' : skew > 0 ? 'Right Skewed' : 'Left Skewed';
      const kurtLabel = Math.abs(kurt) < 1 ? 'Normal' : kurt > 0 ? 'Leptokurtic' : 'Platykurtic';
      return { col, mean, variance, std, q1, q3, p5, p95, skew, kurt, mode, cv, sum, iqr, neg, pos, skewLabel, kurtLabel };
    }).filter(Boolean) as { col: string; mean: number; variance: number; std: number; q1: number; q3: number; p5: number; p95: number; skew: number; kurt: number; mode: number; cv: number; sum: number; iqr: number; neg: number; pos: number; skewLabel: string; kurtLabel: string }[],
  [data, numCols]);

  // Category Intelligence (15 metrics)
  const catIntelligence = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 999);
    const total = rows.reduce((a, r) => a + r.v, 0);
    const n = rows.length;
    const top1Pct = n ? Math.round((rows[0].v / total) * 100) : 0;
    const top3Sum = rows.slice(0, 3).reduce((a, r) => a + r.v, 0);
    const top3Pct = Math.round((top3Sum / total) * 100);
    const avgPerCat = Math.round(total / (n || 1));
    const singletons = rows.filter(r => r.v === 1).length;
    // Entropy (Shannon)
    const entropy = -rows.reduce((a, r) => { const p = r.v / total; return a + (p > 0 ? p * Math.log2(p) : 0); }, 0);
    const maxEntropy = Math.log2(n || 1);
    const balance = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
    // How many cats = 80% of total
    let cum = 0; let cats80 = 0;
    for (const r of rows) { cum += r.v; cats80++; if (cum / total >= 0.8) break; }
    // Long tail: categories with < 1% share
    const longTail = rows.filter(r => r.v / total < 0.01).length;
    const rarest = rows[rows.length - 1];
    // Concentration index (Herfindahl)
    const hhi = Math.round(rows.reduce((a, r) => a + Math.pow(r.v / total, 2), 0) * 10000);
    return { n, top1Pct, top3Pct, avgPerCat, singletons, entropy: Math.round(entropy * 100) / 100, balance, cats80, longTail, hhi, rarest: rarest?.l ?? '—', rarestV: rarest?.v ?? 0, top1: rows[0]?.l ?? '—', top1V: rows[0]?.v ?? 0, total };
  }, [data, catCols]);

  // Quality Grade (A-F)
  const qualityGrade = useMemo(() => {
    const cols = info?.columns ?? [];
    const totalCells = data.length * cols.length;
    const emptyCells = data.reduce((a, r) => a + Object.values(r).filter(v => v === null || v === undefined || v === '').length, 0);
    const fillRate = totalCells > 0 ? ((totalCells - emptyCells) / totalCells) * 100 : 100;
    const seen = new Set<string>(); let dups = 0;
    data.forEach(r => { const k = JSON.stringify(r); if (seen.has(k)) dups++; else seen.add(k); });
    const dupRate = data.length > 0 ? (dups / data.length) * 100 : 0;
    const outlierPct = statsData.length
      ? statsData.reduce((a, s) => a + (s.outliers / (s.n || 1)) * 100, 0) / statsData.length
      : 0;
    const score = Math.round(fillRate * 0.5 + Math.max(0, 100 - dupRate * 5) * 0.3 + Math.max(0, 100 - outlierPct * 2) * 0.2);
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    const gradeColor = score >= 90 ? '#10b981' : score >= 80 ? '#3b82f6' : score >= 70 ? '#f59e0b' : score >= 60 ? '#f97316' : '#ef4444';
    return { score, grade, gradeColor, fillRate: Math.round(fillRate), dupRate: Math.round(dupRate * 10) / 10, outlierPct: Math.round(outlierPct * 10) / 10 };
  }, [data, info, statsData]);

  const pyramidChart = useMemo(() => {
    if (!catCols[0]) return null;
    const rows = groupByCount(data, catCols[0], 7);
    const labels = rows.map(r => (r.l.length > 10 ? r.l.slice(0, 9) + '…' : r.l)).reverse();
    const values = rows.map(r => r.v).reverse();
    return pyramidOpt(labels, values, chartTheme);
  }, [data, catCols, chartTheme]);

  /** Up to 6 priority charts — no duplicate types */
  const coreCharts = useMemo(() => {
    type Slot = { id: string; title: string; subtitle: string; option: object; tall?: boolean };
    const slots: Slot[] = [];
    const used = new Set<string>();

    const push = (id: string, title: string, subtitle: string, option: object | null, tall = false) => {
      if (!option || slots.length >= 6 || used.has(id)) return;
      used.add(id);
      slots.push({ id, title, subtitle, option, tall });
    };

    const overviewOpt = treemapChart ?? trendOpts ?? donutOpts;
    const overviewId = treemapChart ? 'treemap' : trendOpts ? 'trend' : 'donut';
    if (overviewOpt) {
      push(
        overviewId,
        isAr ? 'نظرة عامة على البيانات' : 'Data Overview',
        isAr ? 'توزيع الحجم والقيمة' : 'Size and value distribution',
        overviewOpt,
        true,
      );
    }

    if (trendOpts && overviewId !== 'trend') {
      push(
        'trend',
        `📈 ${orderedNumCols[0] ?? ''} — ${isAr ? 'الاتجاه' : 'Trend'}`,
        isAr ? 'حركة القيم عبر الزمن' : 'Value movement over time',
        trendOpts,
      );
    }

    if (barOpts && catCols[0]) {
      push(
        'breakdown',
        `🏅 ${isAr ? 'أفضل' : 'Top'} ${catCols[0]}`,
        isAr ? 'ترتيب الفئات حسب المقياس' : 'Category ranking by metric',
        barOpts,
      );
    }

    if (donutOpts && catCols[0] && overviewId !== 'donut') {
      push(
        'composition',
        `🍩 ${catCols[0]} — ${isAr ? 'التوزيع' : 'Distribution'}`,
        isAr ? 'حصة كل فئة' : 'Share per category',
        donutOpts,
      );
    }

    const distOpt = pyramidChart ?? histChart;
    if (distOpt) {
      push(
        pyramidChart ? 'pyramid' : 'histogram',
        pyramidChart ? (isAr ? 'توزيع الفئات' : 'Category Split') : (isAr ? 'توزيع القيم' : 'Value Distribution'),
        catCols[0] ?? orderedNumCols[0] ?? '',
        distOpt,
      );
    }

    const sixth = radarChart ?? paretoChart ?? correlationChart;
    if (sixth) {
      push(
        radarChart ? 'radar' : paretoChart ? 'pareto' : 'heatmap',
        radarChart
          ? (isAr ? 'مقارنة الأبعاد' : 'Multi-Metric Radar')
          : paretoChart
            ? (isAr ? 'قاعدة 80/20' : 'Pareto 80/20')
            : (isAr ? 'مصفوفة الارتباط' : 'Correlation Matrix'),
        isAr ? 'تحليل متقدم' : 'Advanced analysis',
        sixth,
      );
    }

    return slots;
  }, [
    treemapChart, trendOpts, donutOpts, barOpts, pyramidChart, histChart,
    radarChart, paretoChart, correlationChart,
    orderedNumCols, catCols, isAr,
  ]);

  const extraCharts = useMemo(() => {
    type Slot = { id: string; title: string; subtitle: string; option: object; tall?: boolean };
    const slots: Slot[] = [];
    const push = (id: string, title: string, subtitle: string, option: object | null, tall = false) => {
      if (!option || slots.length >= 6) return;
      slots.push({ id, title, subtitle, option, tall });
    };

    const c0 = catCols[0];
    const c1 = catCols[1];
    const n0 = numCols[0];
    const n1 = numCols[1];
    const n2 = numCols[2];

    // 1) Scatter: first two numeric columns
    const scatterOpt = n0 && n1 ? {
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
      series: [{
        type: 'scatter',
        symbolSize: 9,
        data: data.slice(0, 300).map(r => [Number(r[n0]) || 0, Number(r[n1]) || 0]),
      }],
    } : null;
    push('scatter', `🟣 ${isAr ? 'علاقة' : 'Relationship'} ${n0 ?? ''} × ${n1 ?? ''}`, isAr ? 'نقاط الارتباط' : 'Correlation scatter', scatterOpt);

    // 2) Stacked bars by two categories
    const stackedOpt = c0 && c1 ? (() => {
      const rows = data.slice(0, 1200);
      const x = [...new Set(rows.map(r => String(r[c0] ?? '—')))].slice(0, 8);
      const legends = [...new Set(rows.map(r => String(r[c1] ?? '—')))].slice(0, 4);
      const series = legends.map(g => ({
        name: g,
        type: 'bar',
        stack: 'total',
        data: x.map(xx => rows.filter(r => String(r[c0] ?? '—') === xx && String(r[c1] ?? '—') === g).length),
      }));
      return {
        tooltip: { trigger: 'axis' },
        legend: { textStyle: { color: '#94a3b8', fontSize: 10 } },
        xAxis: { type: 'category', data: x, axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
        series,
      };
    })() : null;
    push('stacked', `📚 ${isAr ? 'تقسيم تراكمي' : 'Stacked Segments'}`, isAr ? 'حسب فئتين' : 'By two categories', stackedOpt);

    // 3) Moving average line (simple smoothing)
    const movingAvgOpt = n0 ? (() => {
      const vals = data.map(r => Number(r[n0]) || 0);
      const ma = vals.map((_, i) => {
        const s = vals.slice(Math.max(0, i - 4), i + 1);
        return Math.round(s.reduce((a, b) => a + b, 0) / (s.length || 1));
      });
      return {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: vals.map((_, i) => i + 1), axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
        series: [
          { name: isAr ? 'القيمة' : 'Value', type: 'line', data: vals.slice(0, 220), smooth: true, lineStyle: { opacity: 0.35 } },
          { name: isAr ? 'المتوسط المتحرك' : 'Moving Avg', type: 'line', data: ma.slice(0, 220), smooth: true },
        ],
      };
    })() : null;
    push('moving-average', `〰️ ${isAr ? 'المتوسط المتحرك' : 'Moving Average'}`, n0 ?? '', movingAvgOpt);

    // 4) Waterfall-style variation using top categories
    const waterfallOpt = c0 && n0 ? (() => {
      const rows = groupBySum(data, c0, n0, 8);
      const vals = rows.map(r => Math.round(r.v));
      return {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: rows.map(r => r.l), axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
        series: [{ type: 'bar', data: vals }],
      };
    })() : null;
    push('waterfall-like', `🧱 ${isAr ? 'تباين الفئات' : 'Category Variance'}`, isAr ? 'أفضل 8 فئات' : 'Top 8 categories', waterfallOpt);

    // 5) Multi-line trend of first 3 numeric metrics
    const multiLineOpt = (n0 && n1) ? {
      tooltip: { trigger: 'axis' },
      legend: { textStyle: { color: '#94a3b8', fontSize: 10 } },
      xAxis: { type: 'category', data: data.slice(0, 140).map((_, i) => i + 1), axisLabel: { color: '#94a3b8' } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
      series: [n0, n1, n2].filter(Boolean).map(col => ({
        name: col,
        type: 'line',
        smooth: true,
        data: data.slice(0, 140).map(r => Number(r[col as string]) || 0),
      })),
    } : null;
    push('multi-line', `📉 ${isAr ? 'اتجاهات متعددة' : 'Multi Trends'}`, isAr ? 'حتى 3 مقاييس' : 'Up to 3 metrics', multiLineOpt);

    // 6) Category frequency bars
    const frequencyOpt = c0 ? (() => {
      const rows = groupByCount(data, c0, 12);
      return {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: rows.map(r => r.l), axisLabel: { color: '#94a3b8', rotate: 20 } },
        yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
        series: [{ type: 'bar', data: rows.map(r => r.v) }],
      };
    })() : null;
    push('frequency', `📊 ${isAr ? 'تكرار الفئات' : 'Category Frequency'}`, c0 ?? '', frequencyOpt);

    return slots;
  }, [data, catCols, numCols, isAr]);

  const saveCurrentView = () => {
    const name = (typeof window !== 'undefined' ? window.prompt(isAr ? 'اسم الـ Preset' : 'Preset name') : null) || '';
    if (!name.trim()) return;
    const payload = {
      activeFilters,
      crossFilters,
      manualMap,
      drillPath,
      whatIfPct,
      goalTarget,
    };
    const id = `${Date.now()}`;
    setSavedViews(prev => [{ id, name: name.trim(), data: payload }, ...prev].slice(0, 12));
    setSelectedPreset(id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('kimit_last_view_id', id);
    }
  };

  const applySavedView = (id: string) => {
    const found = savedViews.find(v => v.id === id);
    if (!found) return;
    const payload = found.data as {
      activeFilters?: Record<string, string>;
      crossFilters?: Record<string, string>;
      manualMap?: typeof manualMap;
      drillPath?: string[];
      whatIfPct?: number;
      goalTarget?: number;
    };
    Object.entries(payload.activeFilters || {}).forEach(([k, v]) => setFilter(k, v));
    Object.entries(payload.crossFilters || {}).forEach(([k, v]) => setCrossFilter(k, v));
    if (payload.manualMap) setManualMap(payload.manualMap);
    setDrillPath(payload.drillPath || []);
    setWhatIfPct(payload.whatIfPct || 0);
    setGoalTarget(payload.goalTarget || 100);
    setSelectedPreset(id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('kimit_last_view_id', id);
    }
  };

  const deleteSavedView = () => {
    if (!selectedPreset) return;
    setSavedViews(prev => prev.filter(v => v.id !== selectedPreset));
    if (typeof localStorage !== 'undefined') {
      const lastId = localStorage.getItem('kimit_last_view_id');
      if (lastId === selectedPreset) {
        localStorage.removeItem('kimit_last_view_id');
      }
    }
    setSelectedPreset('');
  };

  useEffect(() => {
    if (presetBootstrapped) return;
    setPresetBootstrapped(true);
    if (typeof localStorage === 'undefined') return;
    const lastId = localStorage.getItem('kimit_last_view_id');
    if (lastId && savedViews.some(v => v.id === lastId)) {
      applySavedView(lastId);
    }
  }, [savedViews, presetBootstrapped]);

  const handleChartDrill = (params: { name?: string; value?: unknown }) => {
    const nextCol = drillLevels[drillPath.length];
    if (!nextCol || drillPath.length >= drillLevels.length) return;
    const byName = typeof params?.name === 'string' ? params.name.trim() : '';
    const byValueArray = Array.isArray(params?.value) ? String(params.value[0] ?? '').trim() : '';
    const byValue = typeof params?.value === 'string' || typeof params?.value === 'number' ? String(params.value).trim() : '';
    const nextValue = byName || byValueArray || byValue;
    if (!nextValue) return;
    const exists = drillData.some(r => String(r[nextCol] ?? '') === nextValue);
    if (!exists) return;
    setDrillPath(prev => [...prev, nextValue]);
  };

  const chartEvents = useMemo(
    () => ({
      click: (params: { name?: string; value?: unknown }) => handleChartDrill(params),
    }),
    [drillLevels, drillPath, drillData],
  );

  if (!info || rawData.length === 0) {
    return (
      <div className="sd2-page sd2-empty" data-cat="general">
        <LayoutDashboard size={48} color="#334155" />
        <h2>{isAr ? 'السمارت داشبورد' : 'Smart Dashboard'}</h2>
        <p>
          {isAr
            ? 'ارفع ملف بيانات أولاً لعرض لوحة تحليل ذكية تلقائية حسب نوع البيانات.'
            : 'Upload a dataset first to unlock an auto-detected analytics dashboard.'}
        </p>
        <div className="sd2-empty-actions">
          <button type="button" className="sd2-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('kimit:navigate', { detail: 'home' }))}>
            {isAr ? 'رفع ملف' : 'Upload File'}
          </button>
          <button type="button" className="sd2-btn-ghost" onClick={onBack}>
            {isAr ? 'رجوع' : 'Back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sd2-page sd-page" data-cat={cat} data-theme={chartTheme}>

      <header className="sd2-header">
        <div className="sd2-header-brand">
          <button type="button" className="sd2-back-btn" onClick={onBack}>
            <ArrowLeft size={15} /> {isAr ? 'رجوع' : 'Back'}
          </button>
          <div className="sd2-header-icon">{meta.icon}</div>
          <div>
            <div className="sd2-header-title">
              {isAr ? 'السمارت داشبورد' : 'Smart Dashboard'}
              <span className="sd2-cat-badge">{isAr ? meta.labelAr : meta.label}</span>
            </div>
            <div className="sd2-header-sub">
              {info.filename} • {rawData.length.toLocaleString()}{isSampled ? ` (${isAr ? 'عينة' : 'sampled'})` : ''} {isAr ? 'صف' : 'rows'}
            </div>
          </div>
        </div>
        <div className="sd2-header-actions">
          <div className="sd2-user-card" title={user?.email ?? userDisplayName}>
            <div className="sd2-user-avatar-wrap">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={userDisplayName} className="sd2-user-avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="sd2-user-fallback">{userInitial}</span>
              )}
              <span className="sd2-user-status-dot" />
            </div>
            <div className="sd2-user-meta">
              <div className="sd2-user-name">{userDisplayName}</div>
              <div className="sd2-user-email">{userEmail}</div>
            </div>
          </div>
          <button
            type="button"
            className="sd2-icon-btn sd2-theme-btn"
            onClick={toggleChartTheme}
            aria-label={chartTheme === 'light' ? (isAr ? 'وضع داكن' : 'Dark mode') : (isAr ? 'وضع فاتح' : 'Light mode')}
            title={chartTheme === 'light' ? (isAr ? 'وضع داكن' : 'Dark mode') : (isAr ? 'وضع فاتح' : 'Light mode')}
          >
            {chartTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span className="sd2-theme-label">{chartTheme === 'light' ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light')}</span>
          </button>
          <button type="button" className="sd2-icon-btn" onClick={() => setRefreshKey(k => k + 1)} aria-label="Refresh">
            <RefreshCw size={14} />
          </button>
          <label className="sd2-icon-btn sd2-brand-upload-btn" title={isAr ? 'رفع شعار البراند' : 'Upload brand logo'}>
            {isAr ? 'شعار البراند' : 'Brand Logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleBrandLogoUpload} hidden />
          </label>
          {brandLogoDataUrl && (
            <button type="button" className="sd2-icon-btn" onClick={clearBrandLogo}>
              {isAr ? 'حذف الشعار' : 'Remove Logo'}
            </button>
          )}
          <button
            type="button"
            className="sd2-export-btn sd2-export-btn--pbi"
            disabled={pbiExporting}
            title={
              isAr
                ? 'نشر مباشر إلى Power BI مع تقرير تفاعلي'
                : 'Direct publish to Power BI with interactive report'
            }
            onClick={() => {
              setPbiStep('idle');
              setPbiHint(null);
              setPbiModalOpen(true);
            }}
          >
            <BarChart2 size={14} />
            {pbiExporting
              ? isAr
                ? 'جاري النشر…'
                : 'Publishing…'
              : isAr
                ? 'نشر إلى Power BI'
                : 'Publish to Power BI'}
          </button>
          {pbiHint && <div className="sd2-pbi-hint">{pbiHint}</div>}
          <button
            type="button"
            className="sd2-export-btn"
            disabled={exporting}
            title={
              isAr
                ? 'فتح معاينة الداشبورد + تنزيل Excel/HTML'
                : 'Open dashboard preview + download Excel/HTML'
            }
            onClick={() => {
              const bundlePayload = {
                filename: `Smart_Dashboard_${info.filename.replace(/\.[^.]+$/, '')}.xlsx`,
                datasetName: info.filename.replace(/\.[^.]+$/, '') || info.filename,
                data: rawData,
                categoryColumn: catCols[0] ?? null,
                metricColumn: orderedNumCols[0] ?? null,
                dateColumn: dateCol ?? null,
                kpis: kpis.map(k => ({ title: k.title, value: k.value, sub: k.sub })),
                insights: insights.slice(0, 6).map(i => ({ title: i.title, desc: i.desc })),
                topRows: topBottom.top.slice(0, 10),
                quality: {
                  score: qualityGrade.score,
                  grade: qualityGrade.grade,
                  fillRate: qualityGrade.fillRate,
                  dupRate: qualityGrade.dupRate,
                  outlierPct: qualityGrade.outlierPct,
                },
                charts: [...coreCharts, ...extraCharts].map(c => ({
                  title: c.title,
                  subtitle: c.subtitle,
                  option: c.option,
                })),
                theme: chartTheme,
                isAr,
                sheetTypeLabel: isAr ? meta.labelAr : meta.label,
                brandLogoDataUrl,
                user: {
                  name: userDisplayName,
                  email: user?.email ?? '',
                  photoURL: user?.photoURL ?? '',
                },
              };
              openExportedDashboardPreview(bundlePayload);
              setExporting(true);
              setExportHint(isAr ? 'تم فتح المعاينة — جاري التنزيل…' : 'Preview opened — downloading…');
              void (async () => {
                try {
                  const result = await exportSmartDashboardBundle(bundlePayload, {
                    openPreview: false,
                  });
                  setExportHint(
                    result.mode === 'zip'
                      ? isAr
                        ? 'تم تنزيل ZIP في الخلفية'
                        : 'ZIP downloaded in background'
                      : isAr
                        ? 'تم تنزيل Excel و HTML في الخلفية'
                        : 'Excel + HTML downloaded in background',
                  );
                } catch {
                  setExportHint(isAr ? 'فشل التنزيل. المعاينة مفتوحة.' : 'Download failed. Preview is still open.');
                } finally {
                  setExporting(false);
                  window.setTimeout(() => setExportHint(null), 10_000);
                }
              })();
            }}
          >
            <Download size={14} />
            {exporting
              ? isAr
                ? 'جاري التصدير…'
                : 'Exporting…'
              : isAr
                ? 'تصدير Excel + داشبورد'
                : 'Export Excel + Dashboard'}
          </button>
          {exportHint && <div className="sd2-pbi-hint">{exportHint}</div>}
          <button
            type="button"
            className="sd2-export-btn"
            disabled={sharing}
            title={isAr ? 'إنشاء رابط مشاركة عام للوحة' : 'Create a public share link for this dashboard'}
            onClick={async () => {
              setSharing(true);
              setShareError(null);
              setShareUrl(null);
              try {
                const result = await createSharedDashboard({
                  datasetName: info.filename.replace(/\.[^.]+$/, '') || info.filename,
                  theme: chartTheme,
                  isAr,
                  sheetTypeLabel: isAr ? meta.labelAr : meta.label,
                  brandLogoDataUrl: brandLogoDataUrl || undefined,
                  ownerName: userDisplayName,
                  kpis: kpis.map(k => ({ title: k.title, value: k.value, sub: k.sub })),
                  charts: [...coreCharts, ...extraCharts].map(c => ({
                    title: c.title,
                    subtitle: c.subtitle,
                    option: c.option,
                  })),
                });
                setShareUrl(result.url);
                try { await navigator.clipboard.writeText(result.url); } catch { /* clipboard optional */ }
              } catch (e) {
                const code = (e as { code?: string })?.code;
                const msg = e instanceof Error ? e.message : String(e);
                setShareError(
                  (isAr ? 'تعذّر إنشاء الرابط: ' : 'Could not create link: ') + (code ? `[${code}] ` : '') + msg,
                );
                console.error('share error', e);
              } finally {
                setSharing(false);
              }
            }}
          >
            <Share2 size={14} />
            {sharing ? (isAr ? 'جاري الإنشاء…' : 'Creating…') : isAr ? 'مشاركة برابط' : 'Share link'}
          </button>
          {shareUrl && (
            <div className="sd2-share-box">
              <input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} />
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(shareUrl); }}
                title={isAr ? 'نسخ' : 'Copy'}
              >
                <Copy size={14} /> {isAr ? 'نسخ' : 'Copy'}
              </button>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">{isAr ? 'فتح' : 'Open'}</a>
            </div>
          )}
          {shareError && <div className="sd2-pbi-hint" style={{ color: '#ef4444' }}>{shareError}</div>}
        </div>
      </header>

      {pbiModalOpen && (
        <div className="sd2-pbi-modal-backdrop" onClick={() => !pbiExporting && setPbiModalOpen(false)}>
          <div className="sd2-pbi-modal" onClick={e => e.stopPropagation()}>
            <div className="sd2-pbi-modal-head">
              <h3>{isAr ? 'نشر إلى Power BI' : 'Publish to Power BI'}</h3>
              <button
                type="button"
                className="sd2-pbi-close"
                onClick={() => !pbiExporting && setPbiModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="sd2-pbi-steps">
              <span className={pbiStep === 'checking' || pbiStep === 'publishing' || pbiStep === 'opening' || pbiStep === 'done' ? 'on' : ''}>1. {isAr ? 'Checking' : 'Checking'}</span>
              <span className={pbiStep === 'publishing' || pbiStep === 'opening' || pbiStep === 'done' ? 'on' : ''}>2. {isAr ? 'Publishing' : 'Publishing'}</span>
              <span className={pbiStep === 'opening' || pbiStep === 'done' ? 'on' : ''}>3. {isAr ? 'Opening report' : 'Opening report'}</span>
            </div>

            <div className="sd2-pbi-progress">
              <div
                className="sd2-pbi-progress-bar"
                style={{
                  width:
                    pbiStep === 'idle' ? '0%' :
                      pbiStep === 'checking' ? '24%' :
                        pbiStep === 'publishing' ? '66%' :
                          pbiStep === 'opening' ? '90%' : '100%',
                }}
              />
            </div>

            {!user && (
              <div className="sd2-pbi-login-note">
                {isAr ? 'يجب تسجيل الدخول أولًا قبل النشر إلى Power BI.' : 'You need to sign in before publishing to Power BI.'}
              </div>
            )}

            {pbiHint && <div className="sd2-pbi-hint sd2-pbi-hint--modal">{pbiHint}</div>}

            <div className="sd2-pbi-modal-actions">
              {!user ? (
                <button
                  type="button"
                  className="sd2-export-btn sd2-export-btn--pbi"
                  onClick={() => window.dispatchEvent(new CustomEvent('kimit:open-login'))}
                >
                  {isAr ? 'Sign in' : 'Sign in'}
                </button>
              ) : (
                <button
                  type="button"
                  className="sd2-export-btn sd2-export-btn--pbi"
                  disabled={pbiExporting}
                  onClick={publishToPowerBI}
                >
                  {pbiExporting ? (isAr ? 'جاري النشر…' : 'Publishing…') : (isAr ? 'Publish now' : 'Publish now')}
                </button>
              )}
              <button
                type="button"
                className="sd2-icon-btn"
                onClick={() => !pbiExporting && setPbiModalOpen(false)}
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sd2-body">

        {(isCrossFiltered || Object.keys(activeFilters).some(k => activeFilters[k] && activeFilters[k] !== 'all')) && (
          <div className="sd2-filter-banner">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} />
              {isAr
                ? `فلتر نشط — ${rawData.length.toLocaleString()} من ${info.workData.length.toLocaleString()} صف`
                : `Filtered view — ${rawData.length.toLocaleString()} of ${info.workData.length.toLocaleString()} rows`}
            </span>
            <button type="button" className="sd2-filter-clear" onClick={() => { clearCrossFilters(); clearFilters(); }}>
              <X size={14} />
              {isAr ? 'إزالة الفلاتر' : 'Clear filters'}
            </button>
          </div>
        )}

        <div className="sd2-campaign-head">
          <div className="sd2-campaign-left">
            <div className="sd2-campaign-avatar">{meta.icon}</div>
            <div>
              <h1 className="sd2-campaign-title">{info.filename.replace(/\.[^.]+$/, '') || info.filename}</h1>
              <p className="sd2-campaign-sub">{isAr ? meta.labelAr : meta.label} · {isAr ? dashLayout.taglineAr : dashLayout.taglineEn}</p>
            </div>
          </div>
          <span className="sd2-status-pill">{isAr ? 'نشط' : 'Active'}</span>
        </div>

        <div className="sd2-card sd2-metrics-panel sd2-metrics-full">
          {kpis.map((k, i) => (
            <div key={i} className="sd2-metric-item">
              <div className="sd2-metric-icon-wrap">{k.icon}</div>
              <div className="sd2-metric-body">
                <div className="sd2-metric-label">{k.title}</div>
                <div className="sd2-metric-value">{k.value}</div>
                <div className="sd2-metric-sub">{k.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sd2-card sd2-mapping-card">
          <div className="sd2-card-head">
            <div className="sd2-card-title">{isAr ? 'تخصيص مطابقة الأعمدة' : 'Manual Column Mapping'}</div>
            <div className="sd2-card-sub">
              {isAr ? 'اختر الأعمدة يدويًا بدل الاكتشاف التلقائي.' : 'Pick columns manually instead of auto-detection.'}
            </div>
          </div>
          <div className="sd2-mapping-grid">
            {[
              { key: 'country', label: isAr ? 'Country/Region' : 'Country/Region' },
              { key: 'name', label: isAr ? 'Name' : 'Name' },
              { key: 'followers', label: isAr ? 'Followers/Metric' : 'Followers/Metric' },
              { key: 'age', label: isAr ? 'Age' : 'Age' },
              { key: 'gender', label: isAr ? 'Gender' : 'Gender' },
            ].map(item => (
              <label key={item.key} className="sd2-mapping-field">
                <span>{item.label}</span>
                <select
                  value={manualMap[item.key as keyof typeof manualMap]}
                  onChange={e => {
                    const next = { ...manualMap, [item.key]: e.target.value };
                    setManualMap(next);
                    if (typeof localStorage !== 'undefined') {
                      localStorage.setItem('kimit_dashboard_manual_map', JSON.stringify(next));
                    }
                  }}
                >
                  <option value="">{isAr ? 'Auto' : 'Auto'}</option>
                  {allCols.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              className="sd2-icon-btn"
              onClick={() => {
                const cleared = { country: '', name: '', followers: '', age: '', gender: '' };
                setManualMap(cleared);
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('kimit_dashboard_manual_map', JSON.stringify(cleared));
                }
              }}
            >
              {isAr ? 'إعادة للوضع التلقائي' : 'Reset to Auto'}
            </button>
          </div>
          {mappingWarnings.length > 0 && (
            <div className="sd2-mapping-warnings">
              {mappingWarnings.map((w, i) => (
                <div key={i} className="sd2-mapping-warning">⚠ {w}</div>
              ))}
            </div>
          )}
        </div>

        <div className="sd2-advanced-grid">
          <div className="sd2-card">
            <div className="sd2-card-head">
              <div className="sd2-card-title">Drill-down hierarchy</div>
              <div className="sd2-card-sub">{drillLevels.join(' → ') || (isAr ? 'لا توجد أعمدة فئات كافية' : 'No enough category columns')}</div>
            </div>
            <div className="sd2-breadcrumbs">
              {drillPath.map((p, i) => (
                <button key={`${p}-${i}`} type="button" className="sd2-chip" onClick={() => setDrillPath(drillPath.slice(0, i + 1))}>{p}</button>
              ))}
              {drillPath.length > 0 && <button type="button" className="sd2-chip" onClick={() => setDrillPath([])}>{isAr ? 'إعادة' : 'Reset'}</button>}
            </div>
            <div className="sd2-mini-list">
              {drillOptions.map((row, idx) => (
                <button
                  key={`${row.l}-${idx}`}
                  type="button"
                  className="sd2-mini-row sd2-mini-row-btn"
                  onClick={() => drillPath.length < drillLevels.length - 1 && setDrillPath([...drillPath, row.l])}
                >
                  <span>{row.l}</span><strong>{fmt(row.v)}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head">
              <div className="sd2-card-title">What-if slider</div>
              <div className="sd2-card-sub">{isAr ? 'تأثير السعر/الخصم/الميزانية' : 'Price/discount/budget impact'}</div>
            </div>
            <input type="range" min={-30} max={30} value={whatIfPct} onChange={e => setWhatIfPct(Number(e.target.value))} />
            <div className="sd2-kv"><span>{isAr ? 'التغيير' : 'Change'}</span><strong>{whatIfPct > 0 ? '+' : ''}{whatIfPct}%</strong></div>
            <div className="sd2-kv"><span>{isAr ? 'الحالي' : 'Current'}</span><strong>{fmt(actualTotal)}</strong></div>
            <div className="sd2-kv"><span>{isAr ? 'السيناريو' : 'Scenario'}</span><strong>{fmt(scenarioTotal)}</strong></div>
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head">
              <div className="sd2-card-title">Goal tracking cards</div>
            </div>
            <div className="sd2-kv"><span>Target</span><input type="number" value={goalTarget} onChange={e => setGoalTarget(Number(e.target.value) || 0)} /></div>
            <div className="sd2-kv"><span>Actual</span><strong>{fmt(scenarioTotal)}</strong></div>
            <div className="sd2-kv"><span>Variance</span><strong>{varianceToGoal >= 0 ? '+' : ''}{fmt(varianceToGoal)}</strong></div>
            <div className="sd2-progress"><div style={{ width: `${Math.min(100, goalProgress)}%` }} /></div>
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head">
              <div className="sd2-card-title">Compare mode</div>
            </div>
            {compareStats ? (
              <>
                <div className="sd2-kv"><span>This period</span><strong>{fmt(compareStats.curr)}</strong></div>
                <div className="sd2-kv"><span>Previous</span><strong>{fmt(compareStats.prev)}</strong></div>
                <div className="sd2-kv"><span>Delta</span><strong>{compareStats.deltaPct > 0 ? '+' : ''}{compareStats.deltaPct}%</strong></div>
              </>
            ) : <div className="sd2-empty-mini">{isAr ? 'يتطلب عمود تاريخ + KPI' : 'Needs date + KPI column'}</div>}
          </div>
        </div>

        <div className="sd2-advanced-grid">
          <div className="sd2-card">
            <div className="sd2-card-head"><div className="sd2-card-title">Forecast panel (3-6M)</div></div>
            {forecastOpt ? <ReactECharts option={forecastOpt} style={{ height: 250 }} /> : <div className="sd2-empty-mini">{isAr ? 'بيانات التاريخ غير كافية للتوقع' : 'Not enough time series data'}</div>}
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head"><div className="sd2-card-title">Smart alerts</div></div>
            <div className="sd2-mini-list">
              {smartAlerts.map((a, i) => <div key={i} className={`sd2-alert ${a.level}`}>{a.text}</div>)}
            </div>
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head"><div className="sd2-card-title">Top drivers (Explain KPI)</div></div>
            <div className="sd2-mini-list">
              {topDrivers.map((d, i) => (
                <div key={`${d.col}-${i}`} className="sd2-mini-row"><span>{d.col}</span><strong>{Math.round(d.score * 100)}%</strong></div>
              ))}
            </div>
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head"><div className="sd2-card-title">Saved views</div></div>
            <div className="sd2-kv">
              <select value={selectedPreset} onChange={e => applySavedView(e.target.value)}>
                <option value="">{isAr ? 'اختر Preset' : 'Pick preset'}</option>
                {savedViews.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button type="button" className="sd2-icon-btn" onClick={saveCurrentView}>{isAr ? 'حفظ' : 'Save'}</button>
              <button type="button" className="sd2-icon-btn" onClick={deleteSavedView} disabled={!selectedPreset}>
                {isAr ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>

        <div className="sd2-advanced-grid">
          <div className="sd2-card">
            <div className="sd2-card-head"><div className="sd2-card-title">Segment matrix</div></div>
            {segmentMatrix ? (
              <div className="sd2-segment-grid">
                <div className="sd2-segment-row sd2-segment-head">
                  <span />
                  {segmentMatrix.cols.map(c => <span key={c}>{c}</span>)}
                </div>
                {segmentMatrix.rows.map((r, ri) => (
                  <div key={r} className="sd2-segment-row">
                    <span>{r}</span>
                    {segmentMatrix.grid[ri].map((v, ci) => (
                      <span key={`${ri}-${ci}`} style={{ background: `rgba(59,130,246,${Math.min(0.9, Math.max(0.08, v / Math.max(1, scenarioTotal)))})` }}>{fmt(v)}</span>
                    ))}
                  </div>
                ))}
              </div>
            ) : <div className="sd2-empty-mini">{isAr ? 'يتطلب عمودين فئات + KPI' : 'Needs 2 category cols + KPI'}</div>}
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head"><div className="sd2-card-title">Auto narrative</div></div>
            <ul className="sd2-narrative">
              {autoNarrative.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        </div>

        <div className="sd2-showcase-grid">
          <div className="sd2-card">
            <div className="sd2-card-head">
              <div className="sd2-card-title">{isAr ? 'Campaign Reach' : 'Campaign Reach'}</div>
              <div className="sd2-card-sub">
                {audienceCards.countryCol
                  ? `${audienceCards.reachTop.length} ${isAr ? 'مناطق' : 'regions'}`
                  : (isAr ? 'غير متاح' : 'Not available')}
              </div>
            </div>
            {audienceCards.reachTop.length > 0 ? (
              <div className="sd2-mini-list">
                {audienceCards.reachTop.map((r, i) => (
                  <div key={`${r.l}-${i}`} className="sd2-mini-row">
                    <span>{r.l}</span>
                    <strong>{r.v.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sd2-empty-mini">{isAr ? 'أضف عمود بلد/منطقة لعرض Reach' : 'Add a country/region column to show reach.'}</div>
            )}
          </div>

          <div className="sd2-card sd2-table-card">
            <div className="sd2-card-head-row">
              <div className="sd2-card-title">{isAr ? 'Influencer' : 'Influencer'}</div>
            </div>
            {audienceCards.influencerRows.length > 0 ? (
              <table className="sd2-rank-table">
                <thead>
                  <tr>
                    <th>{isAr ? 'الاسم' : 'Name'}</th>
                    <th className="sd2-rank-val">{audienceCards.followersCol ?? (isAr ? 'المتابعون' : 'Followers')}</th>
                  </tr>
                </thead>
                <tbody>
                  {audienceCards.influencerRows.map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td>{r.name}</td>
                      <td className="sd2-rank-val">{fmt(r.followers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="sd2-empty-mini">{isAr ? 'لا توجد بيانات أسماء/متابعين كافية' : 'No enough name/follower fields detected.'}</div>
            )}
          </div>

          <div className="sd2-card">
            <div className="sd2-card-head">
              <div className="sd2-card-title">{isAr ? 'Audience Age & Gender' : 'Audience Age & Gender'}</div>
            </div>
            {audienceCards.ageGenderOpt ? (
              <ReactECharts option={audienceCards.ageGenderOpt} style={{ height: 250 }} />
            ) : audienceCards.interestOpt ? (
              <ReactECharts option={audienceCards.interestOpt} style={{ height: 250 }} />
            ) : (
              <div className="sd2-empty-mini">{isAr ? 'بيانات العمر/النوع غير متاحة' : 'Age/Gender data is not available.'}</div>
            )}
          </div>
        </div>

        {coreCharts.length > 0 && (
          <div className="sd2-charts-grid">
            {coreCharts.map(slot => (
              <ChartCard
                key={slot.id}
                title={slot.title}
                subtitle={slot.subtitle}
                className={slot.tall ? 'sd2-chart-card--tall' : ''}
              >
                <ReactECharts
                  key={`${slot.id}-${refreshKey}-${chartTheme}`}
                  option={slot.option}
                  onEvents={chartEvents}
                  style={{ height: slot.tall ? 300 : 260 }}
                />
              </ChartCard>
            ))}
          </div>
        )}

        {extraCharts.length > 0 && (
          <div className="sd2-charts-grid">
            {extraCharts.map(slot => (
              <ChartCard
                key={slot.id}
                title={slot.title}
                subtitle={slot.subtitle}
                className={slot.tall ? 'sd2-chart-card--tall' : ''}
              >
                <ReactECharts
                  key={`${slot.id}-${refreshKey}-${chartTheme}`}
                  option={slot.option}
                  onEvents={chartEvents}
                  style={{ height: slot.tall ? 300 : 260 }}
                />
              </ChartCard>
            ))}
          </div>
        )}

        {insights.length > 0 && (
          <div className="sd2-insights">
            {insights.slice(0, 4).map((ins, i) => (
              <div key={i} className="sd2-insight" style={{ ['--sd-insight-color' as string]: ins.color }}>
                <span className="sd2-insight-icon">{ins.icon}</span>
                <div>
                  <div className="sd2-insight-title">{ins.title}</div>
                  <div className="sd2-insight-desc">{ins.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {catCols[0] && orderedNumCols[0] && (
          <div className="sd2-card sd2-table-card sd2-table-standalone">
            <div className="sd2-card-head sd2-card-head-row">
              <div className="sd2-card-title">{isAr ? 'أفضل القيم' : 'Top Records'}</div>
              <span className="sd2-card-link">{isAr ? 'حسب' : 'by'} {orderedNumCols[0]}</span>
            </div>
            <table className="sd2-rank-table">
              <thead>
                <tr>
                  <th>{catCols[0]}</th>
                  <th>{orderedNumCols[0]}</th>
                </tr>
              </thead>
              <tbody>
                {topBottom.top.map((row, i) => (
                  <tr key={i}>
                    <td>{String(row[catCols[0]] ?? '—').slice(0, 24)}</td>
                    <td className="sd2-rank-val">{fmt(Number(row[orderedNumCols[0]]) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="sd2-section sd2-quality" style={{ borderColor: `${qualityGrade.gradeColor}33` }}>
          <div>
            <div className="sd2-grade" style={{ color: qualityGrade.gradeColor }}>{qualityGrade.grade}</div>
            <div className="sd2-grade-label">{isAr ? 'درجة الجودة' : 'Quality Grade'}</div>
          </div>
          <div className="sd2-mini-grid" style={{ flex: 1, minWidth: 240 }}>
            {[
              { label: isAr ? 'نقاط الجودة' : 'Quality Score', val: qualityGrade.score + '/100', color: qualityGrade.gradeColor },
              { label: isAr ? 'نسبة الامتلاء' : 'Fill Rate', val: qualityGrade.fillRate + '%', color: qualityGrade.fillRate > 95 ? '#10b981' : '#f59e0b' },
              { label: isAr ? 'التكرار' : 'Duplicate Rate', val: qualityGrade.dupRate + '%', color: qualityGrade.dupRate > 5 ? '#ef4444' : '#10b981' },
            ].map(item => (
              <div key={item.label} className="sd2-mini" style={{ borderColor: `${item.color}22` }}>
                <div className="sd2-mini-val" style={{ color: item.color }}>{item.val}</div>
                <div className="sd2-mini-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Category Intelligence Panel (15 metrics) ── */}
        {catIntelligence && (
          <div className="sd2-analytics-panel">
            <div className="sd2-panel-title">🧠 Category Intelligence — "{catCols[0]}"</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: 'Total Categories', val: catIntelligence.n.toLocaleString(), icon: '📂', color: meta.p },
                { label: 'Total Records', val: catIntelligence.total.toLocaleString(), icon: '📊', color: '#3b82f6' },
                { label: 'Top Category', val: catIntelligence.top1.slice(0, 16), icon: '🥇', color: '#10b981' },
                { label: 'Top Cat Share', val: catIntelligence.top1Pct + '%', icon: '👑', color: '#f59e0b' },
                { label: 'Top 3 Share', val: catIntelligence.top3Pct + '%', icon: '🏅', color: '#6366f1' },
                { label: 'Avg per Category', val: catIntelligence.avgPerCat.toLocaleString(), icon: '📐', color: '#06b6d4' },
                { label: 'Cats for 80%', val: catIntelligence.cats80.toString(), icon: '📐', color: '#8b5cf6' },
                { label: 'Long Tail Cats', val: catIntelligence.longTail.toString(), icon: '🦀', color: '#94a3b8' },
                { label: 'Singletons', val: catIntelligence.singletons.toString(), icon: '🔂', color: '#64748b' },
                { label: 'Balance Score', val: catIntelligence.balance + '%', icon: '⚖️', color: catIntelligence.balance > 70 ? '#10b981' : '#f59e0b' },
                { label: 'Shannon Entropy', val: catIntelligence.entropy.toFixed(2), icon: '🌊', color: '#3b82f6' },
                { label: 'HHI (Concentration)', val: catIntelligence.hhi.toString(), icon: '🎯', color: catIntelligence.hhi > 2500 ? '#ef4444' : '#10b981' },
                { label: 'Rarest Category', val: catIntelligence.rarest.slice(0, 14), icon: '💎', color: '#f43f5e' },
                { label: 'Rarest Count', val: catIntelligence.rarestV.toString(), icon: '🔬', color: '#64748b' },
                { label: 'Dominant?', val: catIntelligence.top1Pct > 50 ? 'Yes' : 'Distributed', icon: '📡', color: catIntelligence.top1Pct > 50 ? '#f59e0b' : '#10b981' },
              ].map(item => (
                <div key={item.label} style={{ background: `${item.color}0d`, border: `1px solid ${item.color}22`, borderRadius: 10, padding: '9px 11px' }}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{item.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: item.color, lineHeight: 1.1 }}>{item.val}</div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Advanced Statistical Analysis Table ── */}
        {advStats.length > 0 && (
          <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🔭 Advanced Statistical Analysis</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['Column','Sum','Variance','Skewness','Shape','Kurtosis','Type','Mode','CV%','P5','P95','IQR','Neg#','Pos#'].map(h => (
                      <th key={h} style={{ padding: '8px 11px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(advStats as unknown as {col:string;sum:number;variance:number;skew:number;skewLabel:string;kurt:number;kurtLabel:string;mode:number;cv:number;p5:number;p95:number;iqr:number;neg:number;pos:number}[]).map((s, i) => (
                    <tr key={s.col} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '7px 11px', color: meta.p, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.col}</td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.sum)}</td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.variance))}</td>
                      <td style={{ padding: '7px 11px', color: Math.abs(s.skew) > 1 ? '#f59e0b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{s.skew.toFixed(2)}</td>
                      <td style={{ padding: '7px 11px' }}><span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', whiteSpace: 'nowrap' }}>{s.skewLabel}</span></td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{s.kurt.toFixed(2)}</td>
                      <td style={{ padding: '7px 11px' }}><span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: '#94a3b8', whiteSpace: 'nowrap' }}>{s.kurtLabel}</span></td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.mode)}</td>
                      <td style={{ padding: '7px 11px', color: s.cv > 100 ? '#f59e0b' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{s.cv.toFixed(1)}%</td>
                      <td style={{ padding: '7px 11px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.p5))}</td>
                      <td style={{ padding: '7px 11px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.p95))}</td>
                      <td style={{ padding: '7px 11px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.iqr))}</td>
                      <td style={{ padding: '7px 11px', color: s.neg > 0 ? '#ef4444' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>{s.neg}</td>
                      <td style={{ padding: '7px 11px', color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{s.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Dataset Summary Cards (10 mini details) ── */}
        <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>🗂️ Dataset Overview — Full Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {[
              { label: 'Total Cells', val: fmt(summaryStats.totalCells), icon: '📦', color: meta.p },
              { label: 'Filled Cells', val: fmt(summaryStats.totalCells - summaryStats.emptyCells), icon: '✅', color: '#10b981' },
              { label: 'Empty Cells', val: fmt(summaryStats.emptyCells), icon: '⬜', color: '#ef4444' },
              { label: 'Data Density', val: summaryStats.density + '%', icon: '💧', color: meta.s },
              { label: 'Unique Rows', val: fmt(summaryStats.uniqRows), icon: '🔑', color: '#6366f1' },
              { label: 'Duplicate Rows', val: fmt(summaryStats.dupRows), icon: '📋', color: summaryStats.dupRows > 0 ? '#f59e0b' : '#10b981' },
              { label: 'Numeric Cols', val: summaryStats.numColsCount.toString(), icon: '#️⃣', color: '#3b82f6' },
              { label: 'Text Cols', val: summaryStats.catColsCount.toString(), icon: '🔤', color: '#8b5cf6' },
              { label: 'Date Cols', val: summaryStats.dateColsCount.toString(), icon: '📅', color: '#f59e0b' },
              { label: 'Col/Row Ratio', val: summaryStats.colRowRatio, icon: '⚖️', color: '#06b6d4' },
            ].map(item => (
              <div key={item.label} style={{ background: `${item.color}0e`, border: `1px solid ${item.color}22`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{item.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Column Profiling Table ── */}
        <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>🔬 Column Profiling — Detailed Field Analysis</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Column', 'Type', 'Fill Rate', 'Fill Bar', 'Unique #', 'Unique %', 'Top Value', 'Top Freq', 'Zeros'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columnProfile.map((col, i) => (
                  <tr key={col.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '8px 12px', color: meta.p, fontWeight: 700, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.type === 'numeric' ? 'rgba(59,130,246,0.12)' : col.type === 'date' ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)', color: col.type === 'numeric' ? '#3b82f6' : col.type === 'date' ? '#8b5cf6' : '#10b981' }}>
                        {col.type === 'numeric' ? '#' : col.type === 'date' ? '📅' : 'A'} {col.type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: col.fillRate < 80 ? '#ef4444' : col.fillRate < 95 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>{col.fillRate}%</td>
                    <td style={{ padding: '8px 12px', minWidth: 80 }}>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${col.fillRate}%`, background: col.fillRate < 80 ? '#ef4444' : col.fillRate < 95 ? '#f59e0b' : '#10b981' }} />
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{col.uniqCount.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{col.uniqRate}%</td>
                    <td style={{ padding: '8px 12px', color: '#e2e8f0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.topVal}>{col.topVal}</td>
                    <td style={{ padding: '8px 12px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{col.topCount.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: col.zeros > 0 ? '#f59e0b' : '#10b981' }}>{col.type === 'numeric' ? col.zeros : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Descriptive Statistics Table ── */}

        {statsData.length > 0 && (
          <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>📐 Descriptive Statistics</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['Column','Min','Max','Mean','Median','Std Dev','Outliers'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statsData.map((s, i) => (
                    <tr key={s.col} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '9px 14px', color: meta.p, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.col}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.min)}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.max)}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.mean))}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.median))}</td>
                      <td style={{ padding: '9px 14px', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{fmt(Math.round(s.std))}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: s.outliers > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)', color: s.outliers > 0 ? '#f59e0b' : '#10b981' }}>
                          {s.outliers > 0 ? `⚠️ ${s.outliers}` : '✅ 0'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Missing Data Alert ── */}
        {missingCols.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>🔍 Missing Data by Column</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {missingCols.map(mc => (
                <div key={mc.col} style={{ flex: '1 1 180px', minWidth: 160 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{mc.col}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: mc.pct > 30 ? '#ef4444' : '#f59e0b' }}>{mc.pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${mc.pct}%`, background: mc.pct > 30 ? '#ef4444' : '#f59e0b', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Data Preview Table ── */}
        <div style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>📋 Data Preview — Top 8 Rows</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{info.rows.toLocaleString()} total rows</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {(info.columns ?? []).slice(0, 8).map(c => (
                    <th key={c.name} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: String(c.type) === 'numeric' ? meta.p : String(c.type) === 'date' ? '#8b5cf6' : '#94a3b8' }}>
                        {String(c.type) === 'numeric' ? '# ' : String(c.type) === 'date' ? '📅 ' : 'A '}
                      </span>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 8).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    {(info.columns ?? []).slice(0, 8).map(c => (
                      <td key={c.name} style={{ padding: '9px 14px', color: String(c.type) === 'numeric' ? meta.p : '#e2e8f0', fontWeight: String(c.type) === 'numeric' ? 600 : 400, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(row[c.name] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sd2-card sd2-ad-footer">
          <span className="home-ad-label">{isAr ? 'إعلان' : 'Sponsored'}</span>
          <AdSpace type="horizontal" slotId="smart-dashboard-footer" minHeight={90} lazyLoad />
        </div>
        <div className="sd2-footer-bar" />
      </div>

      {exportPreview && (
        <ExportedDashboardOverlay
          payload={exportPreview}
          onClose={() => setExportPreview(null)}
        />
      )}
    </div>
  );
};
