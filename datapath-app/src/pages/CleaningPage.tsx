import React, { useState } from 'react';
import { ShieldCheck, Sparkles, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DatasetInfo, DataRow } from '../types';
import { analyzeDataset } from '../lib/dataUtils';
import { AdSpace } from '../components/AdSpace';
import { CreatorFooter } from '../components/CreatorFooter';
import { AD_PROVIDERS } from '../config/adConfig';
import './cleaning-redesign.css';

interface Props { info: DatasetInfo;  onClean: () => void; onUpdate?: (info: DatasetInfo) => void; }

const T = {
  en: {
    title: 'Data Cleaning', sub: 'Review and verify data quality',
    cleanBtn: 'Super Auto-Purge', cleanDesc: 'Fills missing values with median/mode and removes duplicate rows.', preview: 'Data Preview',
    missing2: 'Missing', unique: 'Unique', total: 'Total', min: 'Min', max: 'Max', mean: 'Mean',
    numeric: 'Numeric', text: 'Text', topVals: 'Top Values', noNulls: '✅ No missing values',
    missingCard: 'Missing Values', dupCard: 'Duplicate Rows', typeCard: 'Type Mismatch', sensitiveCard: 'Sensitive Data',
    fix: 'Fix', encrypt: 'Encrypt',
    editHint: 'Double click to edit cell',
  }
};

export const CleaningPage: React.FC<Props> = ({ info, onClean, onUpdate }) => {
  const t = T.en;
  const [currentPage, setCurrentPage] = useState(0);
  const rowsPerPage = 20;
  const totalPages = Math.ceil(info.workData.length / rowsPerPage);
  const pageData = info.workData.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  // Count type mismatches
  const typeMismatches = info.columns.reduce((acc, col) => {
    if (col.type === 'numeric') {
      const mismatched = info.workData.filter(row => {
        const val = row[col.name];
        return val !== null && val !== undefined && val !== '' && isNaN(Number(val));
      }).length;
      return acc + mismatched;
    }
    return acc;
  }, 0);

  // Count sensitive data fields
  const sensitiveCount = info.workData.reduce((acc, row) => {
    return acc + info.columns.filter(col => {
      if (col.type !== 'text') return false;
      const val = String(row[col.name] || '');
      return val.includes('@') || /01[0-9]{9}/.test(val) || /^[+]?[(]?[0-9]{3}[)]?/.test(val);
    }).length;
  }, 0);

  const triggerUpdate = (newData: DataRow[]) => {
    if (!onUpdate) return;
    const dummyFile = new File([''], info.filename);
    Object.defineProperty(dummyFile, 'size', { value: info.fileSize });
    onUpdate(analyzeDataset(dummyFile, newData));
  };

  const handleAnonymize = () => {
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
    triggerUpdate(newData);
  };

  const handleCellEdit = (rowIdx: number, colName: string, val: string) => {
    const actualIdx = currentPage * rowsPerPage + rowIdx;
    if (String(info.workData[actualIdx][colName]) === val) return;
    const newData = [...info.workData];
    newData[actualIdx] = { ...newData[actualIdx], [colName]: val };
    triggerUpdate(newData);
  };

  const cleaningAdProvider = AD_PROVIDERS.filter(p => p.id === 'adsterra_main');

  return (
    <div className="page clean-page clean2" dir="ltr">
      {/* Ad Banner */}
      <div className="cleaning-ad-top">
        <AdSpace type="responsive" providers={cleaningAdProvider} minHeight={90} />
      </div>

      {/* ─── Top Bar ─── */}
      <div className="clean-topbar">
        <div className="clean-topbar-actions">
          <button className="clean-action-btn primary" onClick={onClean}>
            <Sparkles size={16} /> ✦ {t.cleanBtn}
          </button>
          <button className="clean-action-btn secondary" onClick={handleAnonymize}>
            <ShieldCheck size={16} /> Anonymize Data ✓
          </button>
        </div>
        <div className="clean-topbar-title">
          <h2>{t.title}</h2>
          <p>{t.sub}</p>
        </div>
      </div>

      {/* ─── Description Banner ─── */}
      <div className="clean-desc-banner">
        <div className="clean-desc-icon"><EyeOff size={20} /></div>
        <p>{t.cleanDesc}</p>
      </div>

      {/* ─── Issues Summary Cards ─── */}
      <div className="clean-issues-grid">
        <div className="clean-issue-card issue-red">
          <div className="clean-issue-top-border red" />
          <div className="clean-issue-emoji">🔴</div>
          <div className="clean-issue-label">{t.missingCard}</div>
          <div className="clean-issue-count">{info.totalNulls.toLocaleString()}</div>
          <button className="clean-issue-btn" onClick={onClean}>{t.fix}</button>
        </div>
        <div className="clean-issue-card issue-yellow">
          <div className="clean-issue-top-border yellow" />
          <div className="clean-issue-emoji">🟡</div>
          <div className="clean-issue-label">{t.dupCard}</div>
          <div className="clean-issue-count">{info.duplicates.toLocaleString()}</div>
          <button className="clean-issue-btn" onClick={onClean}>{t.fix}</button>
        </div>
        <div className="clean-issue-card issue-orange">
          <div className="clean-issue-top-border orange" />
          <div className="clean-issue-emoji">🟠</div>
          <div className="clean-issue-label">{t.typeCard}</div>
          <div className="clean-issue-count">{typeMismatches.toLocaleString()}</div>
          <button className="clean-issue-btn" onClick={onClean}>{t.fix}</button>
        </div>
        <div className="clean-issue-card issue-blue">
          <div className="clean-issue-top-border blue" />
          <div className="clean-issue-emoji">🔵</div>
          <div className="clean-issue-label">{t.sensitiveCard}</div>
          <div className="clean-issue-count">{sensitiveCount.toLocaleString()}</div>
          <button className="clean-issue-btn" onClick={handleAnonymize}>{t.encrypt}</button>
        </div>
      </div>

      {/* ─── Column Stats Section ─── */}
      <div className="section-title">Column Statistics</div>
      <div className="clean-col-grid">
        {info.columns.map(col => (
          <div key={col.name} className={`clean-col-card ${col.nullCount > 0 ? 'has-issues' : ''}`}>
            <div className="clean-col-header">
              <span className="clean-col-name">{col.name}</span>
              <span className={`clean-col-type ${col.type}`}>
                {col.type === 'numeric' ? t.numeric : t.text}
              </span>
            </div>
            <div className="clean-col-stats">
              <div className="clean-stat-row">
                <span className="clean-stat-label">{t.missing2}</span>
                <span className={`clean-stat-value ${col.nullCount > 0 ? 'warn' : 'ok'}`}>
                  {col.nullCount} ({((col.nullCount / info.rows) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="clean-stat-pair">
                <div className="clean-stat-box">
                  <div className="clean-stat-box-label">{t.unique}</div>
                  <div className="clean-stat-box-val">{col.uniqueCount}</div>
                </div>
                <div className="clean-stat-box">
                  <div className="clean-stat-box-label">{t.total}</div>
                  <div className="clean-stat-box-val">{info.rows}</div>
                </div>
              </div>
              {col.type === 'numeric' && col.min !== undefined && (
                <div className="clean-num-stats">
                  <div className="clean-num-item">
                    <span className="clean-num-label">{t.min}</span>
                    <span className="clean-num-val">{col.min}</span>
                  </div>
                  <div className="clean-num-item center">
                    <span className="clean-num-label">{t.mean}</span>
                    <span className="clean-num-val">{col.mean?.toFixed(1)}</span>
                  </div>
                  <div className="clean-num-item">
                    <span className="clean-num-label">{t.max}</span>
                    <span className="clean-num-val">{col.max}</span>
                  </div>
                </div>
              )}
              {col.topValues && col.topValues.length > 0 && (
                <div className="clean-top-vals">
                  <div className="clean-top-vals-label">{t.topVals}</div>
                  <div className="clean-top-vals-list">
                    {col.topValues.slice(0, 5).map((v, idx) => (
                      <span key={idx} className="clean-top-val-tag">
                        {v.value} ({v.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Data Preview Table ─── */}
      <div className="section-title" style={{ marginTop: 32 }}>
        {t.preview}
        <span className="clean-edit-hint">✏️ {t.editHint}</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>{info.columns.map(c => <th key={c.name}>{c.name}</th>)}</tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i}>
                {info.columns.map(c => {
                  const val = Number(row[c.name]);
                  let isAnomaly = false;
                  if (c.type === 'numeric' && !isNaN(val) && c.mean !== undefined && c.median !== undefined) {
                    if (Math.abs(val) > Math.abs(c.median) * 4 && Math.abs(c.median) > 0.1) isAnomaly = true;
                  }
                  const isNull = row[c.name] === null || row[c.name] === undefined || row[c.name] === '';
                  return (
                    <td
                      key={c.name}
                      className={`${isNull ? 'cell-null' : ''} ${isAnomaly ? 'cell-anomaly' : ''}`}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onBlur={(e) => handleCellEdit(i, c.name, e.target.textContent || '')}
                      title={isAnomaly ? 'Potential Anomaly' : ''}
                    >
                      {!isNull ? String(row[c.name]).slice(0, 30) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div className="clean-pagination">
          <button
            className="clean-page-btn"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
          >
            <ChevronRight size={16} />
          </button>
          <span className="clean-page-info">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            className="clean-page-btn"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      <CreatorFooter />

      <style>{`
        /* ─── Cleaning Page Layout ─── */
        .clean-page { direction: ltr; }

        .clean-topbar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px; margin-bottom: 20px;
          background: var(--glass-bg); border: 1px solid var(--glass-border);
          border-radius: 20px; backdrop-filter: blur(16px);
          flex-wrap: wrap; gap: 16px;
        }
        .clean-topbar-title h2 {
          font-size: 22px; font-weight: 800; color: #fff; margin: 0;
          font-family: 'Syne', 'Cairo', sans-serif;
        }
        .clean-topbar-title p { font-size: 13px; color: var(--text-dim); margin: 4px 0 0; }
        .clean-topbar-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .clean-action-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 22px; border-radius: 14px;
          font-size: 13px; font-weight: 700; cursor: pointer;
          border: 1px solid transparent; transition: all 0.3s;
          font-family: inherit;
        }
        .clean-action-btn.primary {
          background: linear-gradient(135deg, #00e5ff, #00b8d4);
          color: #021a1e; border: none;
        }
        .clean-action-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,229,255,0.25); }
        .clean-action-btn.secondary {
          background: rgba(124,58,237,0.1);
          border: 1px solid rgba(124,58,237,0.25);
          color: #c4b5fd;
        }
        .clean-action-btn.secondary:hover { background: rgba(124,58,237,0.18); border-color: rgba(124,58,237,0.4); }

        .clean-desc-banner {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px; margin-bottom: 24px;
          background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.15);
          border-radius: 16px;
        }
        .clean-desc-icon {
          width: 40px; height: 40px; min-width: 40px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          background: rgba(245,158,11,0.12); color: #f59e0b;
        }
        .clean-desc-banner p { color: rgba(253,224,148,0.8); font-size: 13px; font-weight: 500; margin: 0; }

        /* ─── Issue Summary Cards ─── */
        .clean-issues-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px; margin-bottom: 32px;
        }
        .clean-issue-card {
          background: var(--glass-bg); border: 1px solid var(--glass-border);
          border-radius: 18px; padding: 20px; text-align: center;
          position: relative; overflow: hidden;
          backdrop-filter: blur(12px); transition: transform 0.3s, border-color 0.3s;
        }
        .clean-issue-card:hover { transform: translateY(-4px); }
        .clean-issue-top-border {
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
        }
        .clean-issue-top-border.red { background: linear-gradient(90deg, #ef4444, #f87171); }
        .clean-issue-top-border.yellow { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
        .clean-issue-top-border.orange { background: linear-gradient(90deg, #f97316, #fb923c); }
        .clean-issue-top-border.blue { background: linear-gradient(90deg, #00e5ff, #00b8d4); }
        .clean-issue-emoji { font-size: 28px; margin-bottom: 8px; }
        .clean-issue-label { font-size: 12px; color: var(--text-dim); font-weight: 600; margin-bottom: 6px; }
        .clean-issue-count {
          font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 12px;
          font-family: 'Space Mono', monospace;
        }
        .clean-issue-btn {
          padding: 6px 20px; border-radius: 10px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-dim); font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.3s; font-family: inherit;
        }
        .clean-issue-btn:hover { background: rgba(0,229,255,0.1); border-color: rgba(0,229,255,0.3); color: #00e5ff; }

        /* ─── Column Stats Grid ─── */
        .clean-col-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px; margin-bottom: 32px;
        }
        .clean-col-card {
          background: var(--glass-bg); border: 1px solid var(--glass-border);
          border-radius: 20px; padding: 20px;
          backdrop-filter: blur(12px); transition: all 0.3s;
        }
        .clean-col-card.has-issues { border-right: 3px solid rgba(245,158,11,0.5); }
        .clean-col-card:hover { border-color: rgba(0,229,255,0.2); }
        .clean-col-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .clean-col-name { font-size: 15px; font-weight: 800; color: rgba(255,255,255,0.9); }
        .clean-col-type {
          padding: 3px 10px; border-radius: 99px; font-size: 10px;
          font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
          font-family: 'Space Mono', monospace;
        }
        .clean-col-type.numeric { background: rgba(0,229,255,0.12); color: #00e5ff; }
        .clean-col-type.text { background: rgba(124,58,237,0.12); color: #c4b5fd; }
        .clean-col-stats { display: flex; flex-direction: column; gap: 12px; }
        .clean-stat-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 12px; background: rgba(255,255,255,0.03);
          border-radius: 12px; font-size: 13px;
        }
        .clean-stat-label { color: rgba(255,255,255,0.4); }
        .clean-stat-value { font-weight: 700; font-family: 'Space Mono', monospace; }
        .clean-stat-value.warn { color: #f59e0b; }
        .clean-stat-value.ok { color: #10b981; }
        .clean-stat-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .clean-stat-box {
          padding: 10px; background: rgba(255,255,255,0.03);
          border-radius: 12px; text-align: center;
        }
        .clean-stat-box-label { font-size: 10px; color: rgba(255,255,255,0.3); margin-bottom: 4px; }
        .clean-stat-box-val { font-size: 16px; font-weight: 800; color: #fff; font-family: 'Space Mono', monospace; }
        .clean-num-stats {
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
          padding: 14px; background: rgba(0,229,255,0.03);
          border: 1px solid rgba(0,229,255,0.08); border-radius: 14px;
        }
        .clean-num-item { text-align: center; }
        .clean-num-item.center { border-inline: 1px solid rgba(255,255,255,0.06); }
        .clean-num-label { display: block; font-size: 10px; color: rgba(255,255,255,0.25); margin-bottom: 4px; }
        .clean-num-val { font-size: 13px; font-weight: 800; color: #00e5ff; font-family: 'Space Mono', monospace; }
        .clean-top-vals { margin-top: 4px; }
        .clean-top-vals-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .clean-top-vals-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .clean-top-val-tag {
          padding: 4px 10px; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
          font-size: 11px; color: rgba(255,255,255,0.6);
        }

        .clean-edit-hint {
          font-size: 11px; background: rgba(0,229,255,0.1);
          color: #00e5ff; padding: 3px 10px; border-radius: 6px;
          margin-inline-start: 10px;
        }

        /* ─── Pagination ─── */
        .clean-pagination {
          display: flex; justify-content: center; align-items: center; gap: 16px;
          margin: 24px 0; padding: 12px;
        }
        .clean-page-btn {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-dim); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .clean-page-btn:hover:not(:disabled) { background: rgba(0,229,255,0.1); border-color: rgba(0,229,255,0.25); color: #00e5ff; }
        .clean-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .clean-page-info {
          font-size: 13px; color: var(--text-dim); font-weight: 700;
          font-family: 'Space Mono', monospace;
        }

        @media (max-width: 768px) {
          .clean-topbar { flex-direction: column; text-align: center; }
          .clean-topbar-actions { justify-content: center; }
          .clean-issues-grid { grid-template-columns: repeat(2, 1fr); }
          .clean-col-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .clean-issues-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};
