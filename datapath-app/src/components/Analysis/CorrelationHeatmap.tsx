import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { CorrelationMatrix } from '../../hooks/useKimitEngine';

interface Props {
  data: CorrelationMatrix;
}

// ── Color scale: strong negative (crimson) → zero (dark) → strong positive (gold/teal) ──
function corrToColor(r: number): string {
  // r in [-1, 1]
  if (r >= 0) {
    // 0 → #1e293b (dark slate)  →  1 → #d4af37 (Kimit gold)
    const t = r;
    const R = Math.round(30  + t * (212 - 30));
    const G = Math.round(41  + t * (175 - 41));
    const B = Math.round(59  + t * (55  - 59));
    return `rgb(${R},${G},${B})`;
  } else {
    // 0 → #1e293b  →  -1 → #dc2626 (crimson)
    const t = -r;
    const R = Math.round(30  + t * (220 - 30));
    const G = Math.round(41  + t * (38  - 41));
    const B = Math.round(59  + t * (38  - 59));
    return `rgb(${R},${G},${B})`;
  }
}

function corrLabel(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.9) return 'Very Strong';
  if (abs >= 0.7) return 'Strong';
  if (abs >= 0.5) return 'Moderate';
  if (abs >= 0.3) return 'Weak';
  return 'None';
}

export const CorrelationHeatmap: React.FC<Props> = ({ data }) => {
  const { columns, matrix } = data;
  const n = columns.length;

  const [tooltip, setTooltip] = useState<{
    col1: string; col2: string; value: number; x: number; y: number;
  } | null>(null);

  // Shorten labels to keep cells compact
  const shortLabels = useMemo(
    () => columns.map(c => c.length > 10 ? c.slice(0, 9) + '…' : c),
    [columns],
  );

  const cellSize = n <= 6 ? 64 : n <= 10 ? 52 : n <= 15 ? 40 : 32;
  const labelWidth = 88;
  const totalWidth = labelWidth + n * cellSize;

  return (
    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: totalWidth, userSelect: 'none', position: 'relative' }}>

        {/* Column headers */}
        <div style={{ display: 'flex', marginLeft: labelWidth }}>
          {shortLabels.map((label, j) => (
            <div
              key={j}
              title={columns[j]}
              style={{
                width: cellSize,
                fontSize: 10,
                color: '#94a3b8',
                textAlign: 'center',
                padding: '0 2px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                writingMode: 'vertical-lr',
                transform: 'rotate(180deg)',
                height: 72,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {matrix.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Row label */}
            <div
              title={columns[i]}
              style={{
                width: labelWidth,
                fontSize: 11,
                color: '#94a3b8',
                paddingRight: 8,
                textAlign: 'right',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                flexShrink: 0,
              }}
            >
              {shortLabels[i]}
            </div>

            {/* Cells */}
            {row.map((r, j) => {
              const isDiag = i === j;
              const bg = isDiag ? 'rgba(212,175,55,0.15)' : corrToColor(r);
              const textColor = isDiag
                ? '#d4af37'
                : Math.abs(r) > 0.45
                  ? '#fff'
                  : '#94a3b8';

              return (
                <motion.div
                  key={j}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (i * n + j) * 0.003, duration: 0.2 }}
                  onMouseEnter={e => {
                    if (!isDiag) {
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({ col1: columns[i], col2: columns[j], value: r, x: rect.left, y: rect.top });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: bg,
                    border: isDiag
                      ? '1px solid rgba(212,175,55,0.3)'
                      : '1px solid rgba(255,255,255,0.04)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: cellSize >= 52 ? 11 : 9,
                    fontWeight: 700,
                    color: textColor,
                    cursor: isDiag ? 'default' : 'pointer',
                    transition: 'filter 0.15s',
                    flexShrink: 0,
                    margin: 1,
                  }}
                  whileHover={isDiag ? {} : { filter: 'brightness(1.25)', zIndex: 10 }}
                >
                  {isDiag ? '—' : r.toFixed(2)}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y - 80,
            left: tooltip.x,
            background: '#0f172a',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            color: '#f1f5f9',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            minWidth: 160,
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: 4 }}>
            <b style={{ color: '#d4af37' }}>{tooltip.col1}</b> ↔ <b style={{ color: '#d4af37' }}>{tooltip.col2}</b>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: tooltip.value >= 0 ? '#d4af37' : '#ef4444' }}>
            r = {tooltip.value.toFixed(4)}
          </div>
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
            {corrLabel(tooltip.value)} {tooltip.value >= 0 ? 'Positive' : 'Negative'} Correlation
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, padding: '0 4px' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>-1</span>
        <div style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          background: 'linear-gradient(to right, #dc2626, #1e293b, #d4af37)',
          maxWidth: 200,
        }} />
        <span style={{ fontSize: 11, color: '#64748b' }}>+1</span>
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 8 }}>
          Pearson r correlation
        </span>
      </div>
    </div>
  );
};
