import React, { useMemo } from 'react';

interface Props {
  columnName: string;
  data: any[];
}

export const SmartProfiler: React.FC<Props> = ({ columnName, data }) => {
  const profile = useMemo(() => {
    if (!data || data.length === 0) return { nullPct: 0, unique: 0 };
    const values = data.map(r => r[columnName]);
    const nulls = values.filter(v => v == null || v === '').length;
    const unique = new Set(values).size;
    const nullPct = ((nulls / data.length) * 100).toFixed(1);

    return { nullPct: parseFloat(nullPct), unique };
  }, [columnName, data]);

  return (
    <div style={{ marginTop: 6, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: 3, fontFamily: 'Inter, sans-serif' }}>
        <span style={{ opacity: 0.8 }}>Unique: <b style={{ color: '#f1f5f9' }}>{profile.unique}</b></span>
        <span style={{ color: profile.nullPct > 0 ? '#f87171' : '#10b981', fontWeight: 600 }}>
          {profile.nullPct > 0 ? `Nulls: ${profile.nullPct}%` : 'Clean'}
        </span>
      </div>
      <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <div 
          style={{ 
            width: `${Math.max(0, 100 - profile.nullPct)}%`, 
            height: '100%', 
            background: profile.nullPct > 10 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #10b981, #34d399)',
            borderRadius: 2,
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
      </div>
    </div>
  );
};
