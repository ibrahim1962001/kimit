import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Calculator, Table2, GitMerge, TrendingUp, Layers, Wrench, Plus, Check, AlertTriangle, Upload,
  Wand2, CalendarClock, CopyCheck, Filter, Scissors, Replace, Boxes, PackagePlus,
} from 'lucide-react';
import { useKimitData } from '../hooks/useKimitData';
import { isArabic } from '../lib/i18n';
import { parseFile } from '../lib/dataUtils';
import { rebuildDatasetInfo } from '../lib/datasetRebuild';
import { compileFormula, addCalculatedColumn, FormulaError } from '../lib/formulaEngine';
import { computePivot, pivotToRows, AGG_LABELS, type AggFn } from '../lib/pivotEngine';
import { joinDatasets, type JoinType } from '../lib/joinEngine';
import { linearRegression, kMeans } from '../lib/modelingEngine';
import {
  analyzeNumericColumn, normalizeNumericColumn, standardizeTextColumn,
  type NumericNormalizeOptions, type TextCase,
} from '../lib/columnCleaning';
import {
  dateParseRatio, convertColumnToDate, splitDateTimeColumn, extractDatePartColumn,
  DATE_PART_LABELS, type DatePart,
} from '../lib/dateTransforms';
import { findFuzzyDuplicates, removeFuzzyDuplicates } from '../lib/fuzzyDedupe';
import {
  filterRows, countFilter, splitColumn, findReplace, binColumn,
  fillMissing, countMissing, FILTER_OP_LABELS, FILL_LABELS,
  type FilterOp, type FillStrategy,
} from '../lib/transformExtra';
import type { DataRow } from '../types';
import './data-tools.css';

type ToolId =
  | 'clean' | 'date' | 'dedupe' | 'fill' | 'filter' | 'split' | 'replace' | 'bin'
  | 'calc' | 'pivot' | 'join' | 'regression' | 'cluster';

export const DataToolsPage: React.FC = () => {
  const isAr = isArabic();
  const { info, setDataset } = useKimitData();
  const [tool, setTool] = useState<ToolId>('clean');
  const [flash, setFlash] = useState<string | null>(null);

  const columns = useMemo(() => info?.columns.map(c => c.name) ?? [], [info]);
  const numericColumns = useMemo(
    () => info?.columns.filter(c => c.type === 'numeric').map(c => c.name) ?? [],
    [info],
  );
  const data = info?.workData ?? [];

  const notify = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 4000);
  };

  const applyNewData = (newData: DataRow[], filename?: string) => {
    if (!info) return;
    setDataset(rebuildDatasetInfo(info, newData, filename));
  };

  if (!info) return null;

  const TOOLS: { id: ToolId; icon: React.ElementType; en: string; ar: string }[] = [
    { id: 'clean', icon: Wand2, en: 'Clean Column', ar: 'تنظيف عمود' },
    { id: 'fill', icon: PackagePlus, en: 'Fill Missing', ar: 'ملء الناقص' },
    { id: 'date', icon: CalendarClock, en: 'Date Tools', ar: 'أدوات التاريخ' },
    { id: 'dedupe', icon: CopyCheck, en: 'Smart Dedupe', ar: 'إزالة التكرار الذكي' },
    { id: 'filter', icon: Filter, en: 'Filter Rows', ar: 'تصفية الصفوف' },
    { id: 'split', icon: Scissors, en: 'Split Column', ar: 'تقسيم عمود' },
    { id: 'replace', icon: Replace, en: 'Find & Replace', ar: 'بحث واستبدال' },
    { id: 'bin', icon: Boxes, en: 'Bin Numbers', ar: 'تجميع نطاقات' },
    { id: 'calc', icon: Calculator, en: 'Calculated Column', ar: 'عمود محسوب' },
    { id: 'pivot', icon: Table2, en: 'Pivot Table', ar: 'جدول محوري' },
    { id: 'join', icon: GitMerge, en: 'Join / Merge', ar: 'دمج ملفين' },
    { id: 'regression', icon: TrendingUp, en: 'Regression', ar: 'انحدار' },
    { id: 'cluster', icon: Layers, en: 'Clustering', ar: 'تكتيل' },
  ];

  return (
    <div className="dtools" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="dtools-head">
        <div className="dtools-title">
          <Wrench size={22} />
          <div>
            <h1>{isAr ? 'أدوات البيانات' : 'Data Tools'}</h1>
            <p>{isAr ? `${info.filename} — ${data.length.toLocaleString()} صف` : `${info.filename} — ${data.length.toLocaleString()} rows`}</p>
          </div>
        </div>
        <nav className="dtools-tabs">
          {TOOLS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`dtools-tab${tool === t.id ? ' is-active' : ''}`}
                onClick={() => setTool(t.id)}
              >
                <Icon size={15} />
                {isAr ? t.ar : t.en}
              </button>
            );
          })}
        </nav>
      </header>

      {flash && <div className="dtools-flash"><Check size={15} /> {flash}</div>}

      <div className="dtools-body">
        {tool === 'clean' && (
          <CleanColumnTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'date' && (
          <DateTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'dedupe' && (
          <DedupeTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'fill' && (
          <FillTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'filter' && (
          <FilterTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'split' && (
          <SplitTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'replace' && (
          <ReplaceTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'bin' && (
          <BinTool isAr={isAr} columns={columns} numericColumns={numericColumns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'calc' && (
          <CalcTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'pivot' && (
          <PivotTool isAr={isAr} columns={columns} numericColumns={numericColumns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'join' && (
          <JoinTool isAr={isAr} columns={columns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'regression' && (
          <RegressionTool isAr={isAr} numericColumns={numericColumns} data={data} onApply={applyNewData} notify={notify} />
        )}
        {tool === 'cluster' && (
          <ClusterTool isAr={isAr} numericColumns={numericColumns} data={data} onApply={applyNewData} notify={notify} />
        )}
      </div>
    </div>
  );
};

interface ToolProps {
  isAr: boolean;
  columns: string[];
  data: DataRow[];
  onApply: (data: DataRow[], filename?: string) => void;
  notify: (msg: string) => void;
}

// ── Tool 1: Calculated Column ─────────────────────────────────────────
const CalcTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<(string | number | null)[] | null>(null);

  const runPreview = () => {
    setError(null);
    try {
      const compiled = compileFormula(formula, columns);
      setPreview(data.slice(0, 5).map(r => compiled.evaluate(r)));
    } catch (e) {
      setPreview(null);
      setError(e instanceof FormulaError ? e.message : String(e));
    }
  };

  const apply = () => {
    setError(null);
    if (!name.trim()) { setError(isAr ? 'أدخل اسم العمود' : 'Enter a column name'); return; }
    try {
      const newData = addCalculatedColumn(data, name.trim(), formula, columns);
      onApply(newData);
      notify(isAr ? `تمت إضافة العمود "${name}"` : `Column "${name}" added`);
      setName(''); setFormula(''); setPreview(null);
    } catch (e) {
      setError(e instanceof FormulaError ? e.message : String(e));
    }
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">
        {isAr
          ? 'أنشئ عموداً جديداً بمعادلة. اكتب اسم العمود بين أقواس مربعة، مثل: [السعر] * [الكمية]'
          : 'Create a new column with a formula. Reference columns in brackets, e.g. [Price] * [Qty]'}
      </p>
      <div className="dtool-row">
        <label>{isAr ? 'اسم العمود الجديد' : 'New column name'}</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={isAr ? 'مثال: الإجمالي' : 'e.g. Total'} />
      </div>
      <div className="dtool-row">
        <label>{isAr ? 'المعادلة' : 'Formula'}</label>
        <textarea value={formula} onChange={e => setFormula(e.target.value)} rows={2} placeholder="[Price] * [Qty] * (1 - [Discount])" />
      </div>
      <div className="dtool-chips">
        {columns.slice(0, 12).map(c => (
          <button key={c} type="button" className="dtool-chip" onClick={() => setFormula(f => `${f}[${c}]`)}>{c}</button>
        ))}
      </div>
      <div className="dtool-funcs">
        {['+', '-', '*', '/', '(', ')', 'IF(', 'ROUND(', 'CONCAT(', 'ABS(', 'SQRT('].map(fn => (
          <button key={fn} type="button" className="dtool-fn" onClick={() => setFormula(f => f + fn)}>{fn}</button>
        ))}
      </div>
      {error && <div className="dtool-error"><AlertTriangle size={14} /> {error}</div>}
      {preview && (
        <div className="dtool-preview">
          <strong>{isAr ? 'معاينة (أول 5):' : 'Preview (first 5):'}</strong>
          <div className="dtool-preview-vals">
            {preview.map((v, i) => <span key={i}>{v === null ? '—' : String(v)}</span>)}
          </div>
        </div>
      )}
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-ghost" onClick={runPreview}>{isAr ? 'معاينة' : 'Preview'}</button>
        <button type="button" className="dtool-btn-primary" onClick={apply}><Plus size={15} /> {isAr ? 'إضافة العمود' : 'Add column'}</button>
      </div>
    </div>
  );
};

// ── Tool: Clean Column (smart numeric / text normalization) ───────────
const CleanColumnTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [column, setColumn] = useState(columns[0] ?? '');
  const [textToZero, setTextToZero] = useState(true);
  const [percentAsFraction, setPercentAsFraction] = useState(false);
  const [textCase, setTextCase] = useState<TextCase>('trim');

  const opts: NumericNormalizeOptions = { textToZero, percentAsFraction };
  const report = useMemo(
    () => (column ? analyzeNumericColumn(data, column, opts) : null),
    [data, column, textToZero, percentAsFraction],
  );

  const applyNumeric = () => {
    const { data: out, changed } = normalizeNumericColumn(data, column, opts);
    onApply(out);
    notify(isAr ? `تم توحيد ${changed} قيمة في "${column}"` : `Normalized ${changed} values in "${column}"`);
  };

  const applyText = () => {
    const { data: out, changed } = standardizeTextColumn(data, column, textCase);
    onApply(out);
    notify(isAr ? `تم تنظيف ${changed} قيمة نصية في "${column}"` : `Cleaned ${changed} text values in "${column}"`);
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">
        {isAr
          ? 'يكتشف ويصلح القيم المختلطة في العمود تلقائياً: 12k → 12000، $99.99 → 99.99، 1,234 → 1234، Free → 0، والنِسَب المئوية.'
          : 'Auto-detect and fix mixed values: 12k → 12000, $99.99 → 99.99, 1,234 → 1234, Free → 0, and percentages.'}
      </p>
      <div className="dtool-row">
        <label>{isAr ? 'العمود' : 'Column'}</label>
        <select value={column} onChange={e => setColumn(e.target.value)}>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="dtool-subhead">{isAr ? 'تنظيف أرقام' : 'Numeric cleanup'}</div>
      <label className="dtool-check">
        <input type="checkbox" checked={textToZero} onChange={e => setTextToZero(e.target.checked)} />
        {isAr ? 'حوّل Free / N/A إلى صفر (بدل فراغ)' : 'Convert Free / N/A to 0 (else blank)'}
      </label>
      <label className="dtool-check">
        <input type="checkbox" checked={percentAsFraction} onChange={e => setPercentAsFraction(e.target.checked)} />
        {isAr ? 'اعتبر 45% = 0.45 (بدل 45)' : 'Treat 45% as 0.45 (else 45)'}
      </label>

      {report && (
        <div className="dtool-report">
          <div className="dtool-metrics">
            <div className="dtool-metric"><span>{isAr ? 'سليمة' : 'Clean'}</span><b>{report.cleanNumeric}</b></div>
            <div className="dtool-metric"><span>{isAr ? 'قابلة للإصلاح' : 'Fixable'}</span><b style={{ color: '#0d9488' }}>{report.fixable}</b></div>
            <div className="dtool-metric"><span>{isAr ? 'غير رقمية' : 'Non-numeric'}</span><b style={{ color: report.unparseable ? '#ef4444' : 'inherit' }}>{report.unparseable}</b></div>
          </div>
          {report.samples.length > 0 && (
            <div className="dtool-samples">
              <strong>{isAr ? 'معاينة الإصلاح:' : 'Fix preview:'}</strong>
              <div className="dtool-samples-list">
                {report.samples.map((s, i) => (
                  <span key={i} className="dtool-sample"><code>{s.from}</code> → <code>{s.to}</code></span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" onClick={applyNumeric}>
          <Wand2 size={15} /> {isAr ? 'توحيد كأرقام' : 'Normalize as numbers'}
        </button>
      </div>

      <div className="dtool-divider" />
      <div className="dtool-subhead">{isAr ? 'تنظيف نصوص' : 'Text cleanup'}</div>
      <div className="dtool-row">
        <label>{isAr ? 'التنسيق' : 'Format'}</label>
        <select value={textCase} onChange={e => setTextCase(e.target.value as TextCase)}>
          <option value="trim">{isAr ? 'إزالة الفراغات الزائدة فقط' : 'Trim spaces only'}</option>
          <option value="lower">{isAr ? 'أحرف صغيرة' : 'lowercase'}</option>
          <option value="upper">{isAr ? 'أحرف كبيرة' : 'UPPERCASE'}</option>
          <option value="title">{isAr ? 'أول حرف كبير' : 'Title Case'}</option>
        </select>
      </div>
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-ghost" onClick={applyText}>
          {isAr ? 'تطبيق على النص' : 'Apply to text'}
        </button>
      </div>
    </div>
  );
};

// ── Tool: Date Tools ──────────────────────────────────────────────────
const DateTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const dateCandidates = useMemo(
    () => columns.filter(c => dateParseRatio(data, c) >= 0.6),
    [columns, data],
  );
  const [column, setColumn] = useState(dateCandidates[0] ?? columns[0] ?? '');
  const [withTime, setWithTime] = useState(false);
  const [part, setPart] = useState<DatePart>('year');

  const ratio = useMemo(() => (column ? dateParseRatio(data, column) : 0), [data, column]);

  const convert = () => {
    const { data: out, converted, failed } = convertColumnToDate(data, column, withTime);
    onApply(out);
    notify(isAr ? `تم تحويل ${converted} تاريخ (${failed} فشل)` : `Converted ${converted} dates (${failed} failed)`);
  };
  const split = () => {
    const { data: out, converted } = splitDateTimeColumn(data, column);
    onApply(out);
    notify(isAr ? `تم فصل ${converted} صف إلى تاريخ + وقت` : `Split ${converted} rows into date + time`);
  };
  const extract = () => {
    const { data: out, newColumn, converted } = extractDatePartColumn(data, column, part);
    onApply(out);
    notify(isAr ? `تمت إضافة العمود ${newColumn} (${converted})` : `Added ${newColumn} (${converted})`);
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">
        {isAr
          ? 'حوّل أعمدة التاريخ/الوقت: توحيد كتاريخ، فصل التاريخ عن الوقت، أو استخراج السنة/الشهر/اليوم في عمود جديد.'
          : 'Transform date/time columns: normalize to date, split date from time, or extract year/month/day into a new column.'}
      </p>
      <div className="dtool-row">
        <label>{isAr ? 'عمود التاريخ' : 'Date column'}</label>
        <select value={column} onChange={e => setColumn(e.target.value)}>
          {columns.map(c => (
            <option key={c} value={c}>{c}{dateCandidates.includes(c) ? ' 🗓️' : ''}</option>
          ))}
        </select>
      </div>
      <p className="dtool-note">
        {isAr
          ? `${Math.round(ratio * 100)}% من القيم تُقرأ كتاريخ صالح.`
          : `${Math.round(ratio * 100)}% of values parse as valid dates.`}
      </p>

      <div className="dtool-divider" />
      <div className="dtool-subhead">{isAr ? '1) توحيد كتاريخ' : '1) Normalize to date'}</div>
      <label className="dtool-check">
        <input type="checkbox" checked={withTime} onChange={e => setWithTime(e.target.checked)} />
        {isAr ? 'احتفظ بالوقت أيضاً' : 'Keep time too'}
      </label>
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" onClick={convert}>
          <CalendarClock size={15} /> {isAr ? 'توحيد التاريخ' : 'Normalize date'}
        </button>
      </div>

      <div className="dtool-divider" />
      <div className="dtool-subhead">{isAr ? '2) فصل التاريخ والوقت' : '2) Split date & time'}</div>
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-ghost" onClick={split}>
          {isAr ? `أنشئ ${column}_date و ${column}_time` : `Create ${column}_date & ${column}_time`}
        </button>
      </div>

      <div className="dtool-divider" />
      <div className="dtool-subhead">{isAr ? '3) استخراج مكوّن' : '3) Extract a part'}</div>
      <div className="dtool-row">
        <label>{isAr ? 'المكوّن' : 'Part'}</label>
        <select value={part} onChange={e => setPart(e.target.value as DatePart)}>
          {(Object.keys(DATE_PART_LABELS) as DatePart[]).map(p => (
            <option key={p} value={p}>{isAr ? DATE_PART_LABELS[p].ar : DATE_PART_LABELS[p].en}</option>
          ))}
        </select>
      </div>
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-ghost" onClick={extract}>
          {isAr ? `أضف ${column}_${part}` : `Add ${column}_${part}`}
        </button>
      </div>
    </div>
  );
};

// ── Tool: Smart Dedupe (fuzzy duplicate detection) ────────────────────
const DedupeTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [keyCols, setKeyCols] = useState<string[]>(columns.slice(0, 1));
  const [threshold, setThreshold] = useState(0.85);
  const [result, setResult] = useState<ReturnType<typeof findFuzzyDuplicates> | null>(null);
  const [scanning, setScanning] = useState(false);

  const toggleCol = (c: string) => {
    setKeyCols(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    setResult(null);
  };

  const scan = () => {
    if (keyCols.length === 0) return;
    setScanning(true);
    setTimeout(() => {
      setResult(findFuzzyDuplicates(data, keyCols, threshold));
      setScanning(false);
    }, 30);
  };

  const remove = () => {
    const { data: out, removed } = removeFuzzyDuplicates(data, keyCols, threshold);
    onApply(out);
    notify(isAr ? `تم حذف ${removed} صف مكرر متشابه` : `Removed ${removed} near-duplicate rows`);
    setResult(null);
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">
        {isAr
          ? 'يكتشف الصفوف المكررة حتى لو فيها اختلاف بسيط في الكتابة (مسافات، حالة الأحرف، أخطاء إملائية). اختر العمود/الأعمدة المميِّزة.'
          : 'Detects duplicate rows even with minor differences (spacing, casing, typos). Pick the identifying column(s).'}
      </p>
      <div className="dtool-row">
        <label>{isAr ? 'أعمدة المطابقة' : 'Match columns'}</label>
        <div className="dtool-chips">
          {columns.map(c => (
            <button key={c} type="button" className={`dtool-chip${keyCols.includes(c) ? ' is-on' : ''}`} onClick={() => toggleCol(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="dtool-row dtool-row--inline">
        <label>{isAr ? `حساسية التشابه: ${Math.round(threshold * 100)}%` : `Similarity: ${Math.round(threshold * 100)}%`}</label>
        <input
          type="range" min={0.6} max={1} step={0.05} value={threshold}
          onChange={e => { setThreshold(Number(e.target.value)); setResult(null); }}
          style={{ flex: 1 }}
        />
      </div>
      <p className="dtool-note">
        {isAr ? '100% = تطابق تام بعد التوحيد، أقل = يقبل اختلافات أكبر.' : '100% = exact after normalization, lower = allows bigger differences.'}
      </p>

      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" disabled={scanning || keyCols.length === 0} onClick={scan}>
          <CopyCheck size={15} /> {scanning ? (isAr ? 'جاري الفحص…' : 'Scanning…') : isAr ? 'افحص التكرارات' : 'Scan duplicates'}
        </button>
      </div>

      {result && (
        <div className="dtool-result">
          <div className="dtool-metrics">
            <div className="dtool-metric"><span>{isAr ? 'مجموعات' : 'Groups'}</span><b>{result.groups.length}</b></div>
            <div className="dtool-metric"><span>{isAr ? 'صفوف زائدة' : 'Removable'}</span><b style={{ color: result.duplicateRows ? '#ef4444' : '#10b981' }}>{result.duplicateRows}</b></div>
          </div>
          {result.groups.length > 0 ? (
            <>
              <div className="dtool-dupe-groups">
                {result.groups.slice(0, 8).map((g, i) => (
                  <div key={i} className="dtool-dupe-group">
                    <span className="dtool-dupe-count">×{g.rowIndices.length}</span>
                    <div className="dtool-dupe-vals">
                      {g.values.map((v, j) => <span key={j}>{v}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="dtool-actions">
                <button type="button" className="dtool-btn-primary" onClick={remove}>
                  {isAr ? `احذف ${result.duplicateRows} مكرر (احتفظ بالأول)` : `Remove ${result.duplicateRows} duplicates (keep first)`}
                </button>
              </div>
            </>
          ) : (
            <p className="dtool-note">{isAr ? '✅ لا توجد تكرارات متشابهة بهذه الحساسية.' : '✅ No near-duplicates at this similarity.'}</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Tool: Fill Missing ────────────────────────────────────────────────
const FillTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [column, setColumn] = useState(columns[0] ?? '');
  const [strategy, setStrategy] = useState<FillStrategy>('mean');
  const [constant, setConstant] = useState('');
  const missing = useMemo(() => (column ? countMissing(data, column) : 0), [data, column]);

  const apply = () => {
    const { data: out, filled } = fillMissing(data, column, strategy, constant);
    onApply(out);
    notify(isAr ? `تم ملء ${filled} قيمة ناقصة في "${column}"` : `Filled ${filled} missing values in "${column}"`);
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'يملأ الخلايا الفارغة بإستراتيجية تختارها لكل عمود.' : 'Fill empty cells with a strategy you choose per column.'}</p>
      <div className="dtool-grid4">
        <div className="dtool-row">
          <label>{isAr ? 'العمود' : 'Column'}</label>
          <select value={column} onChange={e => setColumn(e.target.value)}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'الإستراتيجية' : 'Strategy'}</label>
          <select value={strategy} onChange={e => setStrategy(e.target.value as FillStrategy)}>
            {(Object.keys(FILL_LABELS) as FillStrategy[]).map(s => (
              <option key={s} value={s}>{isAr ? FILL_LABELS[s].ar : FILL_LABELS[s].en}</option>
            ))}
          </select>
        </div>
        {strategy === 'constant' && (
          <div className="dtool-row">
            <label>{isAr ? 'القيمة' : 'Value'}</label>
            <input value={constant} onChange={e => setConstant(e.target.value)} />
          </div>
        )}
      </div>
      <p className="dtool-note">{isAr ? `${missing} قيمة ناقصة في هذا العمود.` : `${missing} missing values in this column.`}</p>
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" disabled={missing === 0} onClick={apply}>
          <PackagePlus size={15} /> {isAr ? 'ملء الناقص' : 'Fill missing'}
        </button>
      </div>
    </div>
  );
};

// ── Tool: Filter Rows ─────────────────────────────────────────────────
const FilterTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [column, setColumn] = useState(columns[0] ?? '');
  const [op, setOp] = useState<FilterOp>('contains');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [mode, setMode] = useState<'keep' | 'drop'>('keep');

  const noValue = op === 'empty' || op === 'notEmpty';
  const matched = useMemo(
    () => (column ? countFilter(data, column, op, value, value2) : 0),
    [data, column, op, value, value2],
  );

  const apply = () => {
    const { data: out } = filterRows(data, column, op, value, value2, mode);
    onApply(out);
    notify(isAr ? `النتيجة: ${out.length} صف` : `Result: ${out.length} rows`);
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'احتفظ أو احذف الصفوف حسب شرط على عمود.' : 'Keep or drop rows by a condition on a column.'}</p>
      <div className="dtool-grid4">
        <div className="dtool-row">
          <label>{isAr ? 'العمود' : 'Column'}</label>
          <select value={column} onChange={e => setColumn(e.target.value)}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'الشرط' : 'Condition'}</label>
          <select value={op} onChange={e => setOp(e.target.value as FilterOp)}>
            {(Object.keys(FILTER_OP_LABELS) as FilterOp[]).map(o => (
              <option key={o} value={o}>{isAr ? FILTER_OP_LABELS[o].ar : FILTER_OP_LABELS[o].en}</option>
            ))}
          </select>
        </div>
        {!noValue && (
          <div className="dtool-row">
            <label>{isAr ? 'القيمة' : 'Value'}</label>
            <input value={value} onChange={e => setValue(e.target.value)} />
          </div>
        )}
        {op === 'between' && (
          <div className="dtool-row">
            <label>{isAr ? 'إلى' : 'and'}</label>
            <input value={value2} onChange={e => setValue2(e.target.value)} />
          </div>
        )}
        <div className="dtool-row">
          <label>{isAr ? 'الإجراء' : 'Action'}</label>
          <select value={mode} onChange={e => setMode(e.target.value as 'keep' | 'drop')}>
            <option value="keep">{isAr ? 'احتفظ بالمطابق' : 'Keep matching'}</option>
            <option value="drop">{isAr ? 'احذف المطابق' : 'Drop matching'}</option>
          </select>
        </div>
      </div>
      <p className="dtool-note">
        {isAr ? `${matched} صف يطابق الشرط من ${data.length}.` : `${matched} of ${data.length} rows match.`}
      </p>
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" onClick={apply}>
          <Filter size={15} /> {isAr ? 'طبّق التصفية' : 'Apply filter'}
        </button>
      </div>
    </div>
  );
};

// ── Tool: Split Column ────────────────────────────────────────────────
const SplitTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [column, setColumn] = useState(columns[0] ?? '');
  const [delimiter, setDelimiter] = useState(',');
  const [maxParts, setMaxParts] = useState(0);

  const preview = useMemo(() => {
    const d = delimiter === '\\t' ? '\t' : delimiter;
    const sample = data.find(r => String(r[column] ?? '').includes(d));
    return sample ? String(sample[column]).split(d).map(s => s.trim()) : [];
  }, [data, column, delimiter]);

  const apply = () => {
    const { data: out, newColumns } = splitColumn(data, column, delimiter, maxParts);
    onApply(out);
    notify(isAr ? `تم إنشاء ${newColumns.length} عمود` : `Created ${newColumns.length} columns`);
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'قسّم عموداً نصياً إلى عدة أعمدة حسب فاصل (فاصلة، مسافة، شرطة...).' : 'Split a text column into multiple columns by a delimiter (comma, space, dash...).'}</p>
      <div className="dtool-grid4">
        <div className="dtool-row">
          <label>{isAr ? 'العمود' : 'Column'}</label>
          <select value={column} onChange={e => setColumn(e.target.value)}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'الفاصل' : 'Delimiter'}</label>
          <input value={delimiter} onChange={e => setDelimiter(e.target.value)} placeholder=", or | or - or \t" />
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'أقصى أعمدة (0=تلقائي)' : 'Max parts (0=auto)'}</label>
          <input type="number" min={0} value={maxParts} onChange={e => setMaxParts(Number(e.target.value))} />
        </div>
      </div>
      <div className="dtool-quick">
        {[',', ';', '|', ' ', '-', '/', '\\t'].map(d => (
          <button key={d} type="button" className="dtool-fn" onClick={() => setDelimiter(d)}>{d === ' ' ? '␣' : d}</button>
        ))}
      </div>
      {preview.length > 0 && (
        <div className="dtool-preview">
          <strong>{isAr ? 'معاينة:' : 'Preview:'}</strong>
          <div className="dtool-preview-vals">{preview.map((p, i) => <span key={i}>{p || '—'}</span>)}</div>
        </div>
      )}
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" onClick={apply}>
          <Scissors size={15} /> {isAr ? 'قسّم العمود' : 'Split column'}
        </button>
      </div>
    </div>
  );
};

// ── Tool: Find & Replace ──────────────────────────────────────────────
const ReplaceTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [column, setColumn] = useState(columns[0] ?? '');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);

  const apply = () => {
    const { data: out, changed } = findReplace(data, column, find, replace, { regex, caseSensitive, wholeCell });
    onApply(out);
    notify(isAr ? `تم تغيير ${changed} خلية` : `Changed ${changed} cells`);
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'ابحث واستبدل نصاً داخل عمود (يدعم Regex والتطابق الكامل).' : 'Find and replace text within a column (supports Regex and whole-cell match).'}</p>
      <div className="dtool-grid4">
        <div className="dtool-row">
          <label>{isAr ? 'العمود' : 'Column'}</label>
          <select value={column} onChange={e => setColumn(e.target.value)}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'بحث عن' : 'Find'}</label>
          <input value={find} onChange={e => setFind(e.target.value)} />
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'استبدل بـ' : 'Replace with'}</label>
          <input value={replace} onChange={e => setReplace(e.target.value)} />
        </div>
      </div>
      <label className="dtool-check"><input type="checkbox" checked={regex} onChange={e => setRegex(e.target.checked)} /> {isAr ? 'تعبير نمطي (Regex)' : 'Regular expression'}</label>
      <label className="dtool-check"><input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} /> {isAr ? 'حساس لحالة الأحرف' : 'Case sensitive'}</label>
      <label className="dtool-check"><input type="checkbox" checked={wholeCell} onChange={e => setWholeCell(e.target.checked)} /> {isAr ? 'مطابقة الخلية كاملة' : 'Match whole cell'}</label>
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" disabled={!find} onClick={apply}>
          <Replace size={15} /> {isAr ? 'استبدل' : 'Replace'}
        </button>
      </div>
    </div>
  );
};

// ── Tool: Bin Numbers ─────────────────────────────────────────────────
interface BinProps extends ToolProps { numericColumns: string[]; }
const BinTool: React.FC<BinProps> = ({ isAr, numericColumns, data, onApply, notify }) => {
  const [column, setColumn] = useState(numericColumns[0] ?? '');
  const [bins, setBins] = useState(4);

  const preview = useMemo(() => {
    if (!column) return null;
    return binColumn(data, column, bins).edges;
  }, [data, column, bins]);

  const apply = () => {
    const { data: out, newColumn } = binColumn(data, column, bins);
    onApply(out);
    notify(isAr ? `تمت إضافة العمود ${newColumn}` : `Added ${newColumn}`);
  };

  if (numericColumns.length === 0) {
    return <div className="dtool-panel"><p className="dtool-note">{isAr ? 'لا توجد أعمدة رقمية.' : 'No numeric columns available.'}</p></div>;
  }

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'حوّل عموداً رقمياً إلى فئات (نطاقات) متساوية، مثل الأعمار أو الأسعار.' : 'Convert a numeric column into equal-width category ranges (e.g. ages, prices).'}</p>
      <div className="dtool-grid4">
        <div className="dtool-row">
          <label>{isAr ? 'العمود الرقمي' : 'Numeric column'}</label>
          <select value={column} onChange={e => setColumn(e.target.value)}>
            {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row dtool-row--inline">
          <label>{isAr ? 'عدد النطاقات' : 'Bins'}</label>
          <input type="number" min={2} max={12} value={bins} onChange={e => setBins(Math.max(2, Math.min(12, Number(e.target.value))))} />
        </div>
      </div>
      {preview && preview.length > 0 && (
        <div className="dtool-preview">
          <strong>{isAr ? 'الحدود:' : 'Edges:'}</strong>
          <div className="dtool-preview-vals">{preview.map((e, i) => <span key={i}>{e}</span>)}</div>
        </div>
      )}
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" onClick={apply}>
          <Boxes size={15} /> {isAr ? 'أنشئ النطاقات' : 'Create bins'}
        </button>
      </div>
    </div>
  );
};

// ── Tool 2: Pivot Table ───────────────────────────────────────────────
interface PivotProps extends ToolProps { numericColumns: string[]; }
const PivotTool: React.FC<PivotProps> = ({ isAr, columns, numericColumns, data, onApply, notify }) => {
  const [rowField, setRowField] = useState(columns[0] ?? '');
  const [colField, setColField] = useState('');
  const [valueField, setValueField] = useState(numericColumns[0] ?? columns[0] ?? '');
  const [agg, setAgg] = useState<AggFn>('sum');

  const result = useMemo(() => {
    if (!rowField || !valueField) return null;
    try {
      return computePivot(data, { rowField, colField: colField || null, valueField, agg });
    } catch { return null; }
  }, [data, rowField, colField, valueField, agg]);

  const promote = () => {
    if (!result) return;
    const rows = pivotToRows(result, { rowField, colField: colField || null, valueField, agg });
    onApply(rows, `Pivot_${rowField}`);
    notify(isAr ? 'تم تحويل الجدول المحوري إلى مجموعة بيانات' : 'Pivot promoted to dataset');
  };

  return (
    <div className="dtool-panel">
      <div className="dtool-grid4">
        <div className="dtool-row">
          <label>{isAr ? 'الصفوف' : 'Rows'}</label>
          <select value={rowField} onChange={e => setRowField(e.target.value)}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'الأعمدة (اختياري)' : 'Columns (optional)'}</label>
          <select value={colField} onChange={e => setColField(e.target.value)}>
            <option value="">{isAr ? '— بدون —' : '— none —'}</option>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'القيمة' : 'Value'}</label>
          <select value={valueField} onChange={e => setValueField(e.target.value)}>
            {columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="dtool-row">
          <label>{isAr ? 'التجميع' : 'Aggregation'}</label>
          <select value={agg} onChange={e => setAgg(e.target.value as AggFn)}>
            {(Object.keys(AGG_LABELS) as AggFn[]).map(a => (
              <option key={a} value={a}>{isAr ? AGG_LABELS[a].ar : AGG_LABELS[a].en}</option>
            ))}
          </select>
        </div>
      </div>

      {result && (
        <>
          <div className="dtool-pivot-wrap">
            <table className="dtool-pivot">
              <thead>
                <tr>
                  <th>{rowField}</th>
                  {colField
                    ? result.colKeys.map(ck => <th key={ck}>{ck}</th>)
                    : <th>{isAr ? AGG_LABELS[agg].ar : AGG_LABELS[agg].en}</th>}
                  {colField && <th className="dtool-pivot-total">{isAr ? 'الإجمالي' : 'Total'}</th>}
                </tr>
              </thead>
              <tbody>
                {result.rowKeys.slice(0, 200).map(rk => (
                  <tr key={rk}>
                    <td className="dtool-pivot-rk">{rk}</td>
                    {result.colKeys.map(ck => (
                      <td key={ck}>{(result.matrix[rk][ck] ?? 0).toLocaleString()}</td>
                    ))}
                    {colField && <td className="dtool-pivot-total">{result.rowTotals[rk].toLocaleString()}</td>}
                  </tr>
                ))}
              </tbody>
              {colField && (
                <tfoot>
                  <tr>
                    <td className="dtool-pivot-rk">{isAr ? 'الإجمالي' : 'Total'}</td>
                    {result.colKeys.map(ck => <td key={ck}>{result.colTotals[ck].toLocaleString()}</td>)}
                    <td className="dtool-pivot-total">{result.grandTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {result.rowKeys.length > 200 && (
            <p className="dtool-note">{isAr ? `عرض أول 200 من ${result.rowKeys.length} صف` : `Showing first 200 of ${result.rowKeys.length} rows`}</p>
          )}
          <div className="dtool-actions">
            <button type="button" className="dtool-btn-primary" onClick={promote}>
              {isAr ? 'تحويل إلى مجموعة بيانات' : 'Promote to dataset'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Tool 3: Join / Merge ──────────────────────────────────────────────
const JoinTool: React.FC<ToolProps> = ({ isAr, columns, data, onApply, notify }) => {
  const [right, setRight] = useState<DataRow[] | null>(null);
  const [rightName, setRightName] = useState('');
  const [rightCols, setRightCols] = useState<string[]>([]);
  const [leftKey, setLeftKey] = useState(columns[0] ?? '');
  const [rightKey, setRightKey] = useState('');
  const [type, setType] = useState<JoinType>('inner');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const rows = await parseFile(file);
      setRight(rows);
      setRightName(file.name);
      const rc = Object.keys(rows[0] ?? {});
      setRightCols(rc);
      setRightKey(rc[0] ?? '');
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!right) return;
    setError(null);
    try {
      const res = joinDatasets(data, right, { leftKey, rightKey, type });
      if (!res.data.length) { setError(isAr ? 'لا توجد صفوف ناتجة عن الدمج' : 'Join produced no rows'); return; }
      onApply(res.data, `Joined_${rightName.replace(/\.[^.]+$/, '')}`);
      notify(isAr
        ? `تم الدمج: ${res.matched} متطابق، ${res.leftOnly} يسار فقط، ${res.rightOnly} يمين فقط`
        : `Joined: ${res.matched} matched, ${res.leftOnly} left-only, ${res.rightOnly} right-only`);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  };

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'ارفع ملفاً ثانياً واربطه بالحالي عبر مفتاح مشترك.' : 'Upload a second file and join it on a shared key.'}</p>
      <label className="dtool-upload">
        <Upload size={16} />
        {right ? rightName : (isAr ? 'اختر ملف CSV / Excel الثاني' : 'Choose second CSV / Excel file')}
        <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} hidden />
      </label>
      {loading && <p className="dtool-note">{isAr ? 'جاري القراءة…' : 'Reading…'}</p>}

      {right && (
        <>
          <div className="dtool-grid4">
            <div className="dtool-row">
              <label>{isAr ? 'مفتاح الملف الحالي' : 'Left key'}</label>
              <select value={leftKey} onChange={e => setLeftKey(e.target.value)}>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="dtool-row">
              <label>{isAr ? 'مفتاح الملف الثاني' : 'Right key'}</label>
              <select value={rightKey} onChange={e => setRightKey(e.target.value)}>
                {rightCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="dtool-row">
              <label>{isAr ? 'نوع الدمج' : 'Join type'}</label>
              <select value={type} onChange={e => setType(e.target.value as JoinType)}>
                <option value="inner">Inner</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="outer">Outer (Full)</option>
              </select>
            </div>
          </div>
          {error && <div className="dtool-error"><AlertTriangle size={14} /> {error}</div>}
          <div className="dtool-actions">
            <button type="button" className="dtool-btn-primary" onClick={apply}><GitMerge size={15} /> {isAr ? 'دمج' : 'Join'}</button>
          </div>
        </>
      )}
      {!right && error && <div className="dtool-error"><AlertTriangle size={14} /> {error}</div>}
    </div>
  );
};

// ── Tool 4: Regression ────────────────────────────────────────────────
interface ModelProps { isAr: boolean; numericColumns: string[]; data: DataRow[]; onApply: (d: DataRow[], f?: string) => void; notify: (m: string) => void; }
const RegressionTool: React.FC<ModelProps> = ({ isAr, numericColumns, data, onApply, notify }) => {
  const [target, setTarget] = useState(numericColumns[numericColumns.length - 1] ?? '');
  const [features, setFeatures] = useState<string[]>(numericColumns.slice(0, 1));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof linearRegression> | null>(null);

  const toggleFeature = (c: string) => {
    setFeatures(prev => prev.includes(c) ? prev.filter(f => f !== c) : [...prev, c]);
  };

  const run = () => {
    setError(null); setResult(null);
    const feats = features.filter(f => f !== target);
    if (!target || feats.length === 0) { setError(isAr ? 'اختر الهدف ومتغيراً واحداً على الأقل' : 'Select target and at least one feature'); return; }
    try {
      setResult(linearRegression(data, feats, target));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const addPredictions = () => {
    if (!result) return;
    const feats = result.features;
    const newData = data.map(r => {
      const x = feats.map(f => Number(r[f]));
      if (x.some(v => !Number.isFinite(v))) return { ...r, [`${target}_predicted`]: null };
      const pred = result.intercept + x.reduce((s, xi, i) => s + xi * result.coefficients[i], 0);
      return { ...r, [`${target}_predicted`]: Math.round(pred * 1000) / 1000 };
    });
    onApply(newData);
    notify(isAr ? `تمت إضافة عمود التوقع ${target}_predicted` : `Added ${target}_predicted column`);
  };

  const scatterOpt = useMemo(() => {
    if (!result) return null;
    const actual: number[] = [];
    let idx = 0;
    for (const r of data) {
      const y = Number(r[target]);
      const x = result.features.map(f => Number(r[f]));
      if (Number.isFinite(y) && !x.some(v => !Number.isFinite(v))) {
        actual.push(y);
        idx++;
      }
      if (idx >= result.predictions.length) break;
    }
    const pts = result.predictions.map((p, i) => [p, actual[i]]);
    const lo = Math.min(...actual, ...result.predictions);
    const hi = Math.max(...actual, ...result.predictions);
    return {
      tooltip: { trigger: 'item' },
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      xAxis: { name: isAr ? 'المتوقع' : 'Predicted', type: 'value' },
      yAxis: { name: isAr ? 'الفعلي' : 'Actual', type: 'value' },
      series: [
        { type: 'scatter', data: pts, symbolSize: 6, itemStyle: { color: '#0d9488', opacity: 0.6 } },
        { type: 'line', data: [[lo, lo], [hi, hi]], showSymbol: false, lineStyle: { color: '#ef4444', type: 'dashed' } },
      ],
    };
  }, [result, data, target, isAr]);

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'انحدار خطي متعدد: توقع متغير رقمي من متغيرات أخرى.' : 'Multiple linear regression: predict a numeric target from features.'}</p>
      <div className="dtool-row">
        <label>{isAr ? 'المتغير الهدف (Y)' : 'Target (Y)'}</label>
        <select value={target} onChange={e => setTarget(e.target.value)}>
          {numericColumns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="dtool-row">
        <label>{isAr ? 'المتغيرات المستقلة (X)' : 'Features (X)'}</label>
        <div className="dtool-chips">
          {numericColumns.filter(c => c !== target).map(c => (
            <button key={c} type="button" className={`dtool-chip${features.includes(c) ? ' is-on' : ''}`} onClick={() => toggleFeature(c)}>{c}</button>
          ))}
        </div>
      </div>
      {error && <div className="dtool-error"><AlertTriangle size={14} /> {error}</div>}
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" onClick={run}><TrendingUp size={15} /> {isAr ? 'احسب الانحدار' : 'Run regression'}</button>
      </div>

      {result && (
        <div className="dtool-result">
          <div className="dtool-metrics">
            <div className="dtool-metric"><span>R²</span><b>{result.r2.toFixed(4)}</b></div>
            <div className="dtool-metric"><span>{isAr ? 'R² المعدّل' : 'Adj. R²'}</span><b>{result.adjustedR2.toFixed(4)}</b></div>
            <div className="dtool-metric"><span>RMSE</span><b>{result.rmse.toFixed(3)}</b></div>
            <div className="dtool-metric"><span>n</span><b>{result.n}</b></div>
          </div>
          <table className="dtool-coef">
            <thead><tr><th>{isAr ? 'المتغير' : 'Term'}</th><th>{isAr ? 'المعامل' : 'Coefficient'}</th><th>{isAr ? 'خطأ معياري' : 'Std. Error'}</th><th>t</th></tr></thead>
            <tbody>
              <tr><td>{isAr ? 'الثابت' : 'Intercept'}</td><td>{result.intercept.toFixed(4)}</td><td>{result.stdErrors[0].toFixed(4)}</td><td>{result.tStats[0].toFixed(2)}</td></tr>
              {result.features.map((f, i) => (
                <tr key={f}><td>{f}</td><td>{result.coefficients[i].toFixed(4)}</td><td>{result.stdErrors[i + 1].toFixed(4)}</td><td>{result.tStats[i + 1].toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          {scatterOpt && <ReactECharts option={scatterOpt} style={{ height: 280 }} />}
          <div className="dtool-actions">
            <button type="button" className="dtool-btn-ghost" onClick={addPredictions}>{isAr ? 'أضف عمود التوقع' : 'Add prediction column'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tool 5: Clustering ────────────────────────────────────────────────
const ClusterTool: React.FC<ModelProps> = ({ isAr, numericColumns, data, onApply, notify }) => {
  const [features, setFeatures] = useState<string[]>(numericColumns.slice(0, 2));
  const [k, setK] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof kMeans> | null>(null);

  const toggleFeature = (c: string) => {
    setFeatures(prev => prev.includes(c) ? prev.filter(f => f !== c) : [...prev, c]);
  };

  const run = () => {
    setError(null); setResult(null);
    if (features.length < 1) { setError(isAr ? 'اختر متغيراً واحداً على الأقل' : 'Select at least one feature'); return; }
    try {
      setResult(kMeans(data, features, k));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  };

  const apply = () => {
    if (!result) return;
    const labelByRow = new Map<number, number>();
    result.validRowIndices.forEach((origIdx, i) => labelByRow.set(origIdx, result.assignments[i]));
    const newData = data.map((r, idx) => ({ ...r, cluster: labelByRow.has(idx) ? `C${labelByRow.get(idx)! + 1}` : null }));
    onApply(newData);
    notify(isAr ? 'تمت إضافة عمود المجموعة (cluster)' : 'Added "cluster" column');
  };

  const scatterOpt = useMemo(() => {
    if (!result || features.length < 2) return null;
    const palette = ['#0d9488', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
    const series = Array.from({ length: result.k }, (_, c) => ({
      name: `C${c + 1}`,
      type: 'scatter' as const,
      symbolSize: 7,
      itemStyle: { color: palette[c % palette.length], opacity: 0.65 },
      data: [] as number[][],
    }));
    result.validRowIndices.forEach((origIdx, i) => {
      const row = data[origIdx];
      const x = Number(row[features[0]]);
      const y = Number(row[features[1]]);
      if (Number.isFinite(x) && Number.isFinite(y)) series[result.assignments[i]].data.push([x, y]);
    });
    return {
      tooltip: { trigger: 'item' },
      legend: { top: 0 },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: { name: features[0], type: 'value' },
      yAxis: { name: features[1], type: 'value' },
      series,
    };
  }, [result, data, features]);

  return (
    <div className="dtool-panel">
      <p className="dtool-hint">{isAr ? 'تقسيم الصفوف إلى مجموعات متشابهة (K-Means) بناءً على متغيرات رقمية.' : 'Group rows into similar segments (K-Means) on numeric features.'}</p>
      <div className="dtool-row">
        <label>{isAr ? 'المتغيرات' : 'Features'}</label>
        <div className="dtool-chips">
          {numericColumns.map(c => (
            <button key={c} type="button" className={`dtool-chip${features.includes(c) ? ' is-on' : ''}`} onClick={() => toggleFeature(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="dtool-row dtool-row--inline">
        <label>{isAr ? 'عدد المجموعات (K)' : 'Clusters (K)'}</label>
        <input type="number" min={2} max={8} value={k} onChange={e => setK(Math.max(2, Math.min(8, Number(e.target.value))))} />
      </div>
      {error && <div className="dtool-error"><AlertTriangle size={14} /> {error}</div>}
      <div className="dtool-actions">
        <button type="button" className="dtool-btn-primary" onClick={run}><Layers size={15} /> {isAr ? 'كوّن المجموعات' : 'Run clustering'}</button>
      </div>

      {result && (
        <div className="dtool-result">
          <div className="dtool-metrics">
            {result.sizes.map((s, i) => (
              <div key={i} className="dtool-metric"><span>C{i + 1}</span><b>{s}</b></div>
            ))}
            <div className="dtool-metric"><span>{isAr ? 'تكرارات' : 'Iters'}</span><b>{result.iterations}</b></div>
          </div>
          {scatterOpt
            ? <ReactECharts option={scatterOpt} style={{ height: 300 }} />
            : <p className="dtool-note">{isAr ? 'اختر متغيرين لعرض المخطط.' : 'Select two features to see the scatter plot.'}</p>}
          <div className="dtool-actions">
            <button type="button" className="dtool-btn-ghost" onClick={apply}>{isAr ? 'أضف عمود المجموعة' : 'Add cluster column'}</button>
          </div>
        </div>
      )}
    </div>
  );
};
