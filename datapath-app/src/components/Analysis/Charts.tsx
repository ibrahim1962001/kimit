import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import type { DataRow, ChartConfig } from '../../types/index';

interface AnalysisChartProps {
  data: DataRow[];
  config: ChartConfig;
  onFilter?: (column: string, value: string) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── Typed Recharts event interfaces ──────────────────────────────────────────
interface ChartClickState {
  activeLabel?: string | number;
  activePayload?: Array<{ payload: Record<string, unknown> }>;
}

interface PieClickData {
  name?: string | number;
  value?: number;
}

interface DotProps {
  cx: number;
  cy: number;
  payload: Record<string, unknown>;
}

// ── Regression line calculator (OLS) ─────────────────────────────────────────
interface RegressionResult {
  slope: number;
  intercept: number;
}

function calcLinearRegression(ys: number[]): RegressionResult {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const xs = Array.from({ length: n }, (_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
  const den = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

// ── Chart Renderer ────────────────────────────────────────────────────────────
const ChartRenderer: React.FC<AnalysisChartProps> = ({ data, config, onFilter }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showRegression, setShowRegression] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // ── Chart data aggregation ────────────────────────────────
  const chartData = useMemo(() => {
    if (config.type === 'pie' || config.type === 'bar') {
      const agg: Record<string, number> = {};
      data.forEach(row => {
        const xVal = String(row[config.xAxisKey] ?? 'Unknown');
        const yVal = Number(row[config.yAxisKey]) || 0;
        agg[xVal] = (agg[xVal] || 0) + yVal;
      });
      return Object.entries(agg)
        .map(([name, value]) => ({ name, value }))
        .slice(0, isMobile ? 15 : 50);
    }
    return data.slice(0, isMobile ? 50 : 100);
  }, [data, config, isMobile]);

  // ── Regression line data & Forecasting (next 3 points) ────
  const regressionData = useMemo(() => {
    if (!showRegression || (config.type !== 'line' && config.type !== 'scatter')) return null;
    const ys = chartData.map(d => Number((d as Record<string, unknown>)[config.yAxisKey]) || 0);
    const { slope, intercept } = calcLinearRegression(ys);
    
    const extrapolated = [...chartData];
    for (let i = 0; i < 3; i++) {
      extrapolated.push({
        [config.xAxisKey]: `Forecast ${i+1}`,
        name: `Forecast ${i+1}`,
      });
    }

    return extrapolated.map((d, i) => ({
      ...d,
      _regression: parseFloat((slope * i + intercept).toFixed(3)),
    }));
  }, [showRegression, config, chartData]);

  // ── IQR Anomaly Thresholds ────────────────────────────────
  const anomalyBounds = useMemo(() => {
    const ys = chartData.map(d => Number((d as Record<string, unknown>)[config.yAxisKey]) || 0).sort((a,b) => a - b);
    if (ys.length < 4) return { lower: -Infinity, upper: Infinity };
    const q1 = ys[Math.floor(ys.length * 0.25)];
    const q3 = ys[Math.floor(ys.length * 0.75)];
    const iqr = q3 - q1;
    return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
  }, [chartData, config.yAxisKey]);

  if (!chartData || chartData.length === 0) {
    throw new Error('Insufficient data to render chart');
  }

  // ── Typed event handlers ──────────────────────────────────
  const handleChartClick = useCallback((state: ChartClickState) => {
    if (!onFilter || state?.activeLabel == null) return;
    onFilter(config.xAxisKey, String(state.activeLabel));
  }, [onFilter, config.xAxisKey]);

  const handlePieClick = useCallback((pieData: PieClickData) => {
    if (!onFilter || pieData == null || pieData.name == null) return;
    onFilter(config.xAxisKey, String(pieData.name));
  }, [onFilter, config.xAxisKey]);

  // ── Shared axis props ─────────────────────────────────────
  const commonXProps = {
    stroke: '#94a3b8',
    fontSize: isMobile ? 10 : 12,
    tickMargin: 8,
    minTickGap: isMobile ? 30 : 15,
  };
  const commonYProps = {
    stroke: '#94a3b8',
    fontSize: isMobile ? 10 : 12,
    tickMargin: 5,
  };
  const tooltipStyle = {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
  };

  // ── Regression toggle (only for time-series types) ────────
  const canShowRegression = config.type === 'line' || config.type === 'scatter';

  const renderChart = () => {
    const activeData = regressionData ?? chartData;

    switch (config.type) {
      case 'bar':
        return (
          <BarChart
            data={activeData}
            onClick={handleChartClick}
            style={{ cursor: onFilter ? 'pointer' : 'default' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" {...commonXProps} />
            <YAxis {...commonYProps} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={tooltipStyle} />
            <Legend verticalAlign="bottom" height={36} iconType="circle"
              wrapperStyle={{ paddingTop: 10, fontSize: isMobile ? '10px' : '12px' }} />
            <Bar dataKey="value" name={config.yAxisKey} fill={config.color || COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      case 'line':
        return (
          <LineChart
            data={activeData}
            onClick={handleChartClick}
            style={{ cursor: onFilter ? 'pointer' : 'default' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={config.xAxisKey} {...commonXProps} />
            <YAxis {...commonYProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend verticalAlign="bottom" height={36} iconType="circle"
              wrapperStyle={{ paddingTop: 10, fontSize: isMobile ? '10px' : '12px' }} />
            {/* Actual data line */}
            <Line
              type="monotone"
              dataKey={config.yAxisKey}
              stroke={config.color || COLORS[1]}
              strokeWidth={2}
              dot={(props: unknown) => {
                const p = props as DotProps;
                const val = Number(p.payload[config.yAxisKey]);
                const isAnomaly = val < anomalyBounds.lower || val > anomalyBounds.upper;
                if (isAnomaly) return <circle cx={p.cx} cy={p.cy} r={4} fill="#ef4444" stroke="none" />;
                return !isMobile ? <circle cx={p.cx} cy={p.cy} r={3} fill={config.color || COLORS[1]} stroke="none" /> : <></>;
              }}
            />
            {/* OLS Regression trend line */}
            {showRegression && (
              <Line
                type="monotone"
                dataKey="_regression"
                name="Trend (OLS)"
                stroke="#d4af37"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
              />
            )}
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              layout={isMobile ? 'horizontal' : 'vertical'}
              verticalAlign={isMobile ? 'bottom' : 'middle'}
              align={isMobile ? 'center' : 'right'}
              wrapperStyle={isMobile ? { paddingTop: 20 } : { paddingLeft: 20 }}
              iconType="circle"
            />
            <Pie
              data={chartData}
              cx={isMobile ? '50%' : '40%'}
              cy="50%"
              outerRadius={isMobile ? '60%' : '80%'}
              innerRadius={isMobile ? '30%' : '40%'}
              paddingAngle={4}
              dataKey="value"
              onClick={handlePieClick}
              style={{ cursor: onFilter ? 'pointer' : 'default' }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart
            onClick={handleChartClick}
            style={{ cursor: onFilter ? 'pointer' : 'default' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={config.xAxisKey} name={config.xAxisKey} {...commonXProps} />
            <YAxis dataKey={config.yAxisKey} name={config.yAxisKey} {...commonYProps} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
            <Scatter name="Data" data={activeData} fill={config.color || COLORS[3]}>
              {activeData.map((entry, index) => {
                const e = entry as Record<string, unknown>;
                const val = Number(e[config.yAxisKey]);
                const isAnomaly = val < anomalyBounds.lower || val > anomalyBounds.upper;
                return <Cell key={`cell-${index}`} fill={isAnomaly ? '#ef4444' : (config.color || COLORS[3])} />;
              })}
            </Scatter>
            {/* Horizontal reference line at mean */}
            {showRegression && (() => {
              const ys = chartData.map(d => Number((d as Record<string, unknown>)[config.yAxisKey]) || 0);
              const mean = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
              return (
                <ReferenceLine
                  y={parseFloat(mean.toFixed(2))}
                  stroke="#d4af37"
                  strokeDasharray="6 3"
                  label={{ value: 'Mean', fill: '#d4af37', fontSize: 11 }}
                />
              );
            })()}
          </ScatterChart>
        );

      default:
        return <div style={{ color: '#94a3b8' }}>Unsupported chart type</div>;
    }
  };

  const chartHeight = isMobile ? 250 : 350;
  const chartAspect = isMobile ? 1.2 : 2;

  return (
    <div style={{ width: '100%', minHeight: chartHeight }}>
      {/* Title + Regression toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {config.title && (
          <h3 style={{
            textAlign: 'left', fontSize: isMobile ? '12px' : '14px',
            color: '#e2e8f0', margin: 0, fontWeight: 600, flex: 1,
          }}>
            {config.title}
          </h3>
        )}
        {canShowRegression && (
          <button
            onClick={() => setShowRegression(v => !v)}
            title={showRegression ? 'Hide OLS Trend' : 'Show OLS Regression Line'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              background: showRegression ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showRegression ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: showRegression ? '#d4af37' : '#64748b',
            }}
          >
            <TrendingUp size={11} /> Trend
          </button>
        )}
      </div>

      <div style={{ width: '100%', height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%" aspect={chartAspect}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const AnalysisChart: React.FC<AnalysisChartProps> = (props) => (
  <ErrorBoundary moduleName="Chart Module">
    <ChartRenderer {...props} />
  </ErrorBoundary>
);
