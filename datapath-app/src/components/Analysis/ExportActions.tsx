import React, { useState } from 'react';
import { Share2, Copy, Check, Camera } from 'lucide-react';
import { exportBrandedPDF, exportPowerBICSV } from '../../lib/exportUtils';
import type { DataRow } from '../../types/index';

interface ExportActionsProps {
  data: DataRow[];
  columns: string[];
  elementIdToCapture?: string;
}

export const ExportActions: React.FC<ExportActionsProps> = ({ 
  data, 
  columns, 
  elementIdToCapture = 'dashboard-main-area' 
}) => {
  const [daxCopied, setDaxCopied] = useState(false);
  const [selectedCol, setSelectedCol] = useState(columns.find(c => typeof data[0]?.[c] === 'number') || columns[0]);

  const handleCaptureDashboard = async () => {
    await exportBrandedPDF(elementIdToCapture, "Kimit_Full_Report.pdf");
  };

  const exportPowerBI = () => {
    exportPowerBICSV(data, "Kimit_PowerBI_ISO.csv");
  };

  const copyDAX = async () => {
    if (!selectedCol) return;
    const dax = [
      `// DAX Measure for ${selectedCol}`,
      `Total ${selectedCol} = SUM('KimitData'[${selectedCol}])`,
      `Average ${selectedCol} = AVERAGE('KimitData'[${selectedCol}])`,
      `YoY Growth ${selectedCol} = `,
      `  VAR _cur = SUM('KimitData'[${selectedCol}])`,
      `  VAR _prev = CALCULATE(SUM('KimitData'[${selectedCol}]), SAMEPERIODLASTYEAR('Calendar'[Date]))`,
      `  RETURN DIVIDE(_cur - _prev, _prev, 0)`
    ].join('\n');

    await navigator.clipboard.writeText(dax);
    setDaxCopied(true);
    setTimeout(() => setDaxCopied(false), 2000);
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '12px', 
      flexWrap: 'wrap',
      padding: '16px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      <button onClick={handleCaptureDashboard} className="export-btn" style={btnStyle('#fff', 'rgba(255,255,255,0.05)')}>
        <Camera size={16} /> Capture Report
      </button>

      <button onClick={exportPowerBI} className="export-btn" style={btnStyle('#d4af37', 'rgba(212,175,55,0.1)')}>
        <Share2 size={16} /> Power BI (ISO)
      </button>

      <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <select 
          value={selectedCol}
          onChange={(e) => setSelectedCol(e.target.value)}
          style={{
            background: '#0f172a',
            color: '#94a3b8',
            border: 'none',
            padding: '8px 12px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button 
          onClick={copyDAX} 
          style={{
            ...btnStyle(daxCopied ? '#10b981' : '#fff', daxCopied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.08)'),
            borderRadius: 0,
            border: 'none',
            borderLeft: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {daxCopied ? <Check size={14} /> : <Copy size={14} />}
          DAX
        </button>
      </div>

      <style>{`
        .export-btn {
          transition: all 0.2s ease;
        }
        .export-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.2);
        }
        @media (max-width: 600px) {
          .export-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
};

const btnStyle = (color: string, bg: string): React.CSSProperties => ({
  padding: '10px 18px',
  background: bg,
  border: `1px solid ${bg === 'transparent' ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
  borderRadius: '8px',
  color: color,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 600
});
