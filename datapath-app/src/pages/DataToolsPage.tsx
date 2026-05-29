import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Calculator, Table2, GitMerge, TrendingUp, Layers, Wrench, Plus, Check, AlertTriangle, Upload,
} from 'lucide-react';
import { useKimitData } from '../hooks/useKimitData';
import { isArabic } from '../lib/i18n';
import { parseFile } from '../lib/dataUtils';
import { rebuildDatasetInfo } from '../lib/datasetRebuild';
import { compileFormula, addCalculatedColumn, FormulaError } from '../lib/formulaEngine';
import { computePivot, pivotToRows, AGG_LABELS, type AggFn } from '../lib/pivotEngine';
import { joinDatasets, type JoinType } from '../lib/joinEngine';
import { linearRegression, kMeans } from '../lib/modelingEngine';
import type { DataRow } from '../types';
import './data-tools.css';

type ToolId = 'calc' | 'pivot' | 'join' | 'regression' | 'cluster';

export const DataToolsPage: React.FC = () => {
  const isAr = isArabic();
  const { info, setDataset } = useKimitData();
  const [tool, setTool] = useState<ToolId>('calc');
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
