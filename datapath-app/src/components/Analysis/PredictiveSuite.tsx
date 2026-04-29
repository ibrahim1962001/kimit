/**
 * PredictiveSuite.tsx — Advanced Scenario Analysis (What-If Sliders)
 *
 * Allows users to simulate percentage adjustments on numeric columns and
 * applies the scenario view to the DataContext so the Dashboard and DataGrid
 * reflect it in real-time. The original data is never mutated; a "scenario
 * shadow" overlay is used via the DataContext's setDataset with a flag.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders, TrendingUp, TrendingDown, RotateCcw,
  ChevronDown, ChevronUp, Sparkles, Play, Zap,
} from 'lucide-react';
import { useKimitData } from '../../hooks/useKimitData';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnScenario {
  column: string;
  /** Adjustment percentage: -100 to +200 */
  pct: number;
  /** Whether this slider is active (contributing to simulation) */
  active: boolean;
}

interface SimulationResult {
  column: string;
  original: number;
  simulated: number;
  delta: number;
  pct: number;
}

// ── Slider Component ──────────────────────────────────────────────────────────

const ScenarioSlider: React.FC<{
  scenario: ColumnScenario;
  originalMean: number;
  onChange: (col: string, pct: number) => void;
  onToggle: (col: string) => void;
}> = ({ scenario, originalMean, onChange, onToggle }) => {
  const simulated = originalMean * (1 + scenario.pct / 100);
  const isUp = scenario.pct > 0;
  const isFlat = scenario.pct === 0;

  const trackGradient = isFlat
    ? 'rgba(100,116,139,0.3)'
    : isUp
    ? 'linear-gradient(90deg, rgba(16,185,129,0.15), rgba(16,185,129,0.4))'
    : 'linear-gradient(90deg, rgba(239,68,68,0.4), rgba(239,68,68,0.15))';

  return (
    <motion.div
      layout
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        background: scenario.active
          ? 'rgba(212,175,55,0.04)'
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${scenario.active ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.05)'}`,
        transition: 'border-color 0.2s, background 0.2s',
        opacity: scenario.active ? 1 : 0.55,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Active toggle */}
          <button
            onClick={() => onToggle(scenario.column)}
            title={scenario.active ? 'Deactivate' : 'Activate'}
            style={{
              width: 28, height: 16, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: scenario.active ? '#d4af37' : 'rgba(255,255,255,0.1)',
              transition: 'background 0.25s',
              display: 'flex', alignItems: 'center',
              padding: '2px',
            }}
          >
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: scenario.active ? '#000' : '#475569',
              transform: scenario.active ? 'translateX(12px)' : 'translateX(0)',
              transition: 'transform 0.25s',
            }} />
          </button>

          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', maxWidth: 140,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scenario.column}
          </span>
        </div>

        {/* Delta badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
          color: isFlat ? '#64748b' : isUp ? '#10b981' : '#ef4444',
          background: isFlat ? 'rgba(100,116,139,0.1)' : isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${isFlat ? 'rgba(100,116,139,0.2)' : isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          {!isFlat && (isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />)}
          {isFlat ? 'No Change' : `${isUp ? '+' : ''}${scenario.pct.toFixed(0)}%`}
        </span>
      </div>

      {/* Track background + input */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: 4,
          borderRadius: 4, transform: 'translateY(-50%)',
          background: trackGradient,
        }} />
        <input
          type="range"
          min={-80}
          max={200}
          step={1}
          value={scenario.pct}
          onChange={e => onChange(scenario.column, Number(e.target.value))}
          disabled={!scenario.active}
          style={{
            width: '100%', appearance: 'none', background: 'transparent',
            height: 20, cursor: scenario.active ? 'pointer' : 'not-allowed',
            position: 'relative', zIndex: 2,
          }}
        />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
        <span>Original avg: <b style={{ color: '#94a3b8' }}>{originalMean.toFixed(2)}</b></span>
        <span style={{ color: isUp ? '#10b981' : isFlat ? '#64748b' : '#ef4444' }}>
          Simulated: <b>{simulated.toFixed(2)}</b>
        </span>
      </div>
    </motion.div>
  );
};

// ── Impact Summary ────────────────────────────────────────────────────────────

const ImpactSummary: React.FC<{ results: SimulationResult[] }> = ({ results }) => {
  const active = results.filter(r => r.pct !== 0);
  if (active.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontSize: 12 }}>
        Adjust sliders to see impact projection
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {active.map(r => (
        <motion.div
          key={r.column}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', borderRadius: 8,
            background: r.pct > 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
            border: `1px solid ${r.pct > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`,
          }}
        >
          <span style={{ fontSize: 11, color: '#94a3b8', maxWidth: '55%',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.column}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#475569' }}>{r.original.toFixed(1)} →</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: r.pct > 0 ? '#10b981' : '#ef4444' }}>
              {r.simulated.toFixed(1)}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
              color: r.pct > 0 ? '#10b981' : '#ef4444',
              background: r.pct > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            }}>
              {r.pct > 0 ? '+' : ''}{r.pct.toFixed(0)}%
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface PredictiveSuiteProps {
  /** Called when scenario data is applied — parent can re-render charts */
  onScenarioApply?: (scenarioData: Record<string, number>[] | null) => void;
}

export const PredictiveSuite: React.FC<PredictiveSuiteProps> = ({ onScenarioApply }) => {
  const { info, setDataset } = useKimitData();
  const [isExpanded, setIsExpanded] = useState(true);
  const [scenarios, setScenarios] = useState<ColumnScenario[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [scenarioApplied, setScenarioApplied] = useState(false);

  // Initialize scenarios when the loaded dataset changes (keyed by filename)
  const infoFilename = info?.filename;
  React.useEffect(() => {
    if (!info) { setScenarios([]); return; }
    const numericCols = info.columns.filter(c => c.type === 'numeric').slice(0, 8);
    setScenarios(numericCols.map(c => ({
      column: c.name,
      pct: 0,
      active: true,
    })));
    setScenarioApplied(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoFilename]);

  // Column means for display
  const columnMeans = useMemo(() => {
    const means: Record<string, number> = {};
    if (!info) return means;
    info.columns.filter(c => c.type === 'numeric').forEach(c => {
      means[c.name] = c.mean ?? 0;
    });
    return means;
  }, [info]);

  // Impact preview (does NOT mutate data)
  const simulationResults = useMemo<SimulationResult[]>(() =>
    scenarios
      .filter(s => s.active)
      .map(s => {
        const orig = columnMeans[s.column] ?? 0;
        return {
          column: s.column,
          original: orig,
          simulated: orig * (1 + s.pct / 100),
          delta: orig * (s.pct / 100),
          pct: s.pct,
        };
      }),
  [scenarios, columnMeans]);

  // Slider change handler
  const handleChange = useCallback((col: string, pct: number) => {
    setScenarios(prev => prev.map(s => s.column === col ? { ...s, pct } : s));
  }, []);

  const handleToggle = useCallback((col: string) => {
    setScenarios(prev => prev.map(s => s.column === col ? { ...s, active: !s.active } : s));
  }, []);

  // Apply scenario globally — overrides workData with simulated values
  const handleApplyScenario = useCallback(async () => {
    if (!info) return;
    setIsSimulating(true);
    await new Promise(r => setTimeout(r, 700)); // UX delay

    const activeScenarios = scenarios.filter(s => s.active && s.pct !== 0);
    if (activeScenarios.length === 0) {
      setIsSimulating(false);
      return;
    }

    // Build scenario overlay — multiply each active column by (1 + pct/100)
    const newWorkData = info.workData.map(row => {
      const newRow = { ...row };
      activeScenarios.forEach(sc => {
        const v = Number(newRow[sc.column]);
        if (!isNaN(v)) newRow[sc.column] = parseFloat((v * (1 + sc.pct / 100)).toFixed(4));
      });
      return newRow;
    });

    setDataset({ ...info, workData: newWorkData });
    setScenarioApplied(true);
    setIsSimulating(false);

    if (onScenarioApply) {
      onScenarioApply(newWorkData as Record<string, number>[]);
    }
  }, [info, scenarios, setDataset, onScenarioApply]);

  // Reset scenario — restore original rawData
  const handleReset = useCallback(() => {
    if (!info) return;
    setDataset({ ...info, workData: JSON.parse(JSON.stringify(info.rawData)) });
    setScenarios(prev => prev.map(s => ({ ...s, pct: 0 })));
    setScenarioApplied(false);
    if (onScenarioApply) onScenarioApply(null);
  }, [info, setDataset, onScenarioApply]);

  if (!info || scenarios.length === 0) {
    return (
      <div style={{
        padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', color: '#475569', fontSize: 12,
      }}>
        <Sliders size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
        <p>Upload a dataset with numeric columns to enable scenario analysis</p>
      </div>
    );
  }

  return (
    <motion.div
      layout
      style={{
        borderRadius: 16, overflow: 'hidden',
        background: 'rgba(10,15,29,0.95)',
        border: `1px solid ${scenarioApplied ? 'rgba(212,175,55,0.35)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: scenarioApplied ? '0 0 30px rgba(212,175,55,0.08)' : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* ── Panel Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', cursor: 'pointer',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(212,175,55,0.03)',
        }}
        onClick={() => setIsExpanded(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'rgba(212,175,55,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sliders size={15} color="#d4af37" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              Scenario Analysis
              {scenarioApplied && (
                <span style={{ marginLeft: 8, fontSize: 9, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(212,175,55,0.15)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.3)' }}>
                  LIVE
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>What-If Simulator</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {scenarioApplied && (
            <span style={{ fontSize: 10, color: '#d4af37', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Zap size={10} /> Scenario Active
            </span>
          )}
          {isExpanded ? <ChevronUp size={15} color="#64748b" /> : <ChevronDown size={15} color="#64748b" />}
        </div>
      </div>

      {/* ── Collapsible Body ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Instruction */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                borderRadius: 10, background: 'rgba(56,189,248,0.05)',
                border: '1px solid rgba(56,189,248,0.1)',
              }}>
                <Sparkles size={13} color="#38bdf8" />
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                  Adjust sliders to simulate growth or decline in numeric columns. Hit{' '}
                  <b style={{ color: '#d4af37' }}>Apply</b> to reflect the scenario across all charts and the data grid.
                </p>
              </div>

              {/* Sliders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {scenarios.map(sc => (
                  <ScenarioSlider
                    key={sc.column}
                    scenario={sc}
                    originalMean={columnMeans[sc.column] ?? 0}
                    onChange={handleChange}
                    onToggle={handleToggle}
                  />
                ))}
              </div>

              {/* Impact Preview */}
              <div style={{
                padding: '14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Projected Impact
                </div>
                <ImpactSummary results={simulationResults} />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleApplyScenario}
                  disabled={isSimulating || !scenarios.some(s => s.active && s.pct !== 0)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    border: 'none',
                    background: isSimulating
                      ? 'rgba(212,175,55,0.2)'
                      : 'linear-gradient(135deg, #d4af37, #a3820a)',
                    color: isSimulating ? '#d4af37' : '#000',
                    transition: 'all 0.2s',
                    opacity: !scenarios.some(s => s.active && s.pct !== 0) ? 0.4 : 1,
                  }}
                >
                  {isSimulating ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        style={{ width: 14, height: 14, border: '2px solid #d4af37',
                          borderTopColor: 'transparent', borderRadius: '50%' }}
                      />
                      Simulating…
                    </>
                  ) : (
                    <><Play size={13} /> Apply Scenario</>
                  )}
                </button>

                {scenarioApplied && (
                  <button
                    onClick={handleReset}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '11px 18px', borderRadius: 10, fontWeight: 700, fontSize: 12,
                      cursor: 'pointer', border: '1px solid rgba(239,68,68,0.25)',
                      background: 'rgba(239,68,68,0.08)', color: '#ef4444', transition: 'all 0.2s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global slider styles */}
      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #d4af37;
          border: 2px solid #0a0f1d;
          box-shadow: 0 0 0 2px rgba(212,175,55,0.3);
          cursor: pointer;
          transition: box-shadow 0.2s;
        }
        input[type='range']::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 4px rgba(212,175,55,0.25);
        }
        input[type='range']:disabled::-webkit-slider-thumb {
          background: #475569;
          box-shadow: none;
        }
        input[type='range']::-moz-range-thumb {
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #d4af37;
          border: 2px solid #0a0f1d;
          cursor: pointer;
        }
      `}</style>
    </motion.div>
  );
};
