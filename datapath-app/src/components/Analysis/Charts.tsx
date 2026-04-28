import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ErrorBoundary } from './ErrorBoundary';
import type { DataRow, ChartConfig } from '../../types/index';

interface AnalysisChartProps {
  data: DataRow[];
  config: ChartConfig;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ChartRenderer: React.FC<AnalysisChartProps> = ({ data, config }) => {
  // Aggregate data if needed (simple aggregation for demo)
  const chartData = useMemo(() => {
    // If pie or bar, aggregate by xAxisKey
    if (config.type === 'pie' || config.type === 'bar') {
      const agg: Record<string, number> = {};
      data.forEach(row => {
        const xVal = String(row[config.xAxisKey] || 'Unknown');
        const yVal = Number(row[config.yAxisKey]) || 0;
        agg[xVal] = (agg[xVal] || 0) + yVal;
      });
      return Object.entries(agg).map(([name, value]) => ({ name, value })).slice(0, 50); // Limit to 50 items for perf
    }
    return data.slice(0, 100); // Limit scatter/line to 100 points
  }, [data, config]);

  if (!chartData || chartData.length === 0) {
    throw new Error("Insufficient data to render chart");
  }

  const renderChart = () => {
    switch (config.type) {
      case 'bar':
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#cbd5e1" fontSize={12} />
            <YAxis stroke="#cbd5e1" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Legend verticalAlign="bottom" height={36} />
            <Bar dataKey="value" name={config.yAxisKey} fill={config.color || COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={config.xAxisKey} stroke="#cbd5e1" fontSize={12} />
            <YAxis stroke="#cbd5e1" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Legend verticalAlign="bottom" height={36} />
            <Line type="monotone" dataKey={config.yAxisKey} stroke={config.color || COLORS[1]} strokeWidth={2} dot={false} />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ paddingLeft: '20px' }} />
            <Pie
              data={chartData}
              cx="40%"
              cy="50%"
              outerRadius="75%"
              startAngle={0}
              endAngle={360}
              paddingAngle={2}
              dataKey="value"
              label={false}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );
      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey={config.xAxisKey} name={config.xAxisKey} stroke="#cbd5e1" fontSize={12} />
            <YAxis dataKey={config.yAxisKey} name={config.yAxisKey} stroke="#cbd5e1" fontSize={12} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Legend verticalAlign="bottom" height={36} />
            <Scatter name="Data" data={chartData} fill={config.color || COLORS[3]} />
          </ScatterChart>
        );
      default:
        return <div style={{ color: '#94a3b8' }}>Unsupported chart type</div>;
    }
  };

  return (
    <div style={{ width: '100%', height: '300px' }}>
      {config.title && <h3 style={{ textAlign: 'center', fontSize: '14px', color: '#e2e8f0', marginBottom: '15px' }}>{config.title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

export const AnalysisChart: React.FC<AnalysisChartProps> = (props) => {
  return (
    <ErrorBoundary moduleName="Chart Module">
      <ChartRenderer {...props} />
    </ErrorBoundary>
  );
};
