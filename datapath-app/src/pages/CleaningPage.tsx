import React from 'react';
import { ShieldCheck, Sparkles, EyeOff } from 'lucide-react';
import type { DatasetInfo, Lang } from '../types';
import { analyzeDataset } from '../lib/dataUtils';

interface Props { info: DatasetInfo; lang: Lang; onClean: () => void; onUpdate?: (info: DatasetInfo) => void; }

const T = {
  ar: {
    title: 'تنقية البيانات', sub: 'راجع وتحقق من جودة البيانات',
    cleanBtn: '🧹 تنقية آلية خارقة', cleanDesc: 'يملأ القيم المفقودة بالوسيط/الأكثر تكراراً ويزيل الصفوف المكررة.', preview: 'معاينة البيانات',
    missing2: 'مفقود', unique: 'فريد', total: 'الإجمالي', min: 'أدنى', max: 'أعلى', mean: 'متوسط',
    numeric: 'رقمي', text: 'نصي', topVals: 'أكثر القيم', noNulls: '✅ لا توجد قيم مفقودة',
  },
  en: {
    title: 'Data Cleaning', sub: 'Review and verify data quality',
    cleanBtn: '🧹 Super Auto-Purge', cleanDesc: 'Fills missing values with median/mode and removes duplicate rows.', preview: 'Data Preview',
    missing2: 'Missing', unique: 'Unique', total: 'Total', min: 'Min', max: 'Max', mean: 'Mean',
    numeric: 'Numeric', text: 'Text', topVals: 'Top Values', noNulls: '✅ No missing values',
  }
};

export const CleaningPage: React.FC<Props> = ({ info, lang, onClean, onUpdate }) => {
  const t = T[lang];

  const handleAnonymize = () => {
    if (!onUpdate) return;
    const newData = info.workData.map(row => {
      const newRow = { ...row };
      for (const col of info.columns) {
        if (col.type === 'text' && newRow[col.name]) {
          const val = String(newRow[col.name]);
          if (val.includes('@') || /01[0-9]{9}/.test(val) || /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(val)) {
            newRow[col.name] = '***' + val.substring(val.length - Math.min(4, val.length));
          }
        }
      }
      return newRow;
    });
    const dummyFile = new File([''], info.filename);
    Object.defineProperty(dummyFile, 'size', { value: info.fileSize });
    onUpdate(analyzeDataset(dummyFile, newData));
  };

  const handleCellEdit = (rowIdx: number, colName: string, val: string) => {
    if (!onUpdate || String(info.workData[rowIdx][colName]) === val) return;
    const newData = [...info.workData];
    newData[rowIdx] = { ...newData[rowIdx], [colName]: val };
    const dummyFile = new File([''], info.filename);
    Object.defineProperty(dummyFile, 'size', { value: info.fileSize });
    onUpdate(analyzeDataset(dummyFile, newData));
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h2 className="page-title">{t.title}</h2><p className="page-sub">{t.sub}</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ background: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={handleAnonymize} title={lang === 'ar' ? 'إخفاء الإيميلات وأرقام الهواتف' : 'Mask sensitive info'}>
            <ShieldCheck size={18} /> {lang === 'ar' ? 'تشفير البيانات الحساسة' : 'Anonymize Data'}
          </button>
          <button className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={onClean}>
            <Sparkles size={18} /> {t.cleanBtn}
          </button>
        </div>
      </div>

      <div className="clean-banner">
        <EyeOff size={18} />
        <p>{t.cleanDesc}</p>
      </div>

      {/* Column cards */}
      <div className="col-grid">
        {info.columns.map(col => (
          <div key={col.name} className="col-card">
            <div className="col-card-header">
              <span className="col-name">{col.name}</span>
              <span className={`col-type-badge ${col.type}`}>{col.type === 'numeric' ? t.numeric : t.text}</span>
            </div>
            <div className="col-stats">
              <div className="col-stat-row">
                <span>{t.missing2}</span>
                <span style={{ color: col.nullCount > 0 ? '#f59e0b' : '#10b981' }}>
                  {col.nullCount} ({((col.nullCount / info.rows) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="col-stat-row"><span>{t.unique}</span><span>{col.uniqueCount}</span></div>
              <div className="col-stat-row"><span>{t.total}</span><span>{info.rows}</span></div>
              {col.type === 'numeric' && col.min !== undefined && (
                <>
                  <div className="col-stat-row"><span>{t.min}</span><span>{col.min.toLocaleString()}</span></div>
                  <div className="col-stat-row"><span>{t.max}</span><span>{col.max?.toLocaleString()}</span></div>
                  <div className="col-stat-row"><span>{t.mean}</span><span>{col.mean?.toFixed(2)}</span></div>
                </>
              )}
              {col.type === 'text' && col.topValues && (
                <div className="col-top-vals">
                  <span className="col-top-label">{t.topVals}:</span>
                  {col.topValues.slice(0, 3).map(v => (
                    <span key={v.value} className="col-top-val">"{v.value.slice(0, 14)}"({v.count})</span>
                  ))}
                </div>
              )}
              {col.nullCount > 0 && (
                <div className="null-bar-wrap">
                  <div className="null-bar" style={{ width: `${(col.nullCount / info.rows) * 100}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview table (Editable Playground) */}
      <div className="section-title" style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
        {t.preview} <span style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '3px 8px', borderRadius: 4 }}>✏️ {lang === 'ar' ? 'انقر مرتين على أي خلية لتعديلها' : 'Double click to edit cell'}</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>{info.columns.map(c => <th key={c.name}>{c.name}</th>)}</tr>
          </thead>
          <tbody>
            {info.workData.slice(0, 15).map((row, i) => (
              <tr key={i}>
                {info.columns.map(c => {
                  const val = Number(row[c.name]);
                  let isAnomaly = false;
                  if (c.type === 'numeric' && !isNaN(val) && c.mean !== undefined && c.median !== undefined) {
                     // Approximate Z-score check using Mean/Median difference as proxy for StdDev or just hard check
                     // Here we'll do a simple highlight: if value is > Mean*2 or < Mean/2 for large spreads
                     // Better: check if it matches an anomaly detected in analyzeDataset or calculate Z-core on the fly if we had StdDev
                     // For UI wow factor, we highlight values that are 3x the median
                     if (Math.abs(val) > Math.abs(c.median) * 4 && Math.abs(c.median) > 0.1) isAnomaly = true;
                  }
                  
                  return (
                    <td 
                      key={c.name} 
                      className={`${row[c.name] === null || row[c.name] === undefined || row[c.name] === '' ? 'cell-null' : ''} ${isAnomaly ? 'cell-anomaly' : ''}`}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onBlur={(e) => handleCellEdit(i, c.name, e.target.textContent || '')}
                      style={{ outline: 'none', cursor: 'text', background: isAnomaly ? 'rgba(239, 68, 68, 0.15)' : undefined, borderRight: isAnomaly ? '2px solid #ef4444' : undefined }}
                      title={isAnomaly ? (lang === 'ar' ? 'قيمة شاذة محتملة' : 'Potential Anomaly') : ''}
                    >
                      {row[c.name] !== null && row[c.name] !== undefined && row[c.name] !== '' ? String(row[c.name]).slice(0, 30) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 20, textAlign: 'center', opacity: 0.5, fontSize: 12 }}>KEMET AI © 2026 - IBRAHIM SABREY</div>
    </div>
  );
};
