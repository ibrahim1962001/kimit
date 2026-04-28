import React, { useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { Download, Info, TrendingUp } from 'lucide-react';
import type { ChartInfo } from '../types';
import { forecastTimeSeries } from '../lib/statService';
import type { ForecastResult } from '../lib/statService';
import { useState } from 'react';
import { useMediaQuery } from 'react-responsive';

interface Props { chart: ChartInfo; }

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#3b82f6'];

export const DataChart: React.FC<Props> = ({ chart }) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const chartRef = useRef<ReactECharts>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);

  const handleForecast = () => {
    if (forecast) { setForecast(null); return; }
    const res = forecastTimeSeries(chart.data, 5);
    setForecast(res);
  };

  const download = useCallback(() => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    if (!echartsInstance) return;
    const url = echartsInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0f172a' });
    const link = document.createElement('a');
    link.download = `${chart.title.replace(/\s+/g, '_')}.png`;
    link.href = url;
    link.click();
  }, [chart.title]);

  const xData = [...chart.data.map(d => String(d.x || '')), ...(forecast ? forecast.nextValues.map(d => d.x) : [])];
  const yData = [...chart.data.map(d => Number(d.y)), ...(forecast ? forecast.nextValues.map(d => d.y) : [])];

  const formatNum = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    if (num <= -1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num <= -1000) return (num / 1000).toFixed(1) + 'K';
    return Number.isInteger(num) ? num : Number(num.toFixed(2));
  };

  const getOption = () => {
    const isPie = chart.type === 'pie';
    
    // ECharts Configuration (Power BI Style interaction)
    const baseOption = {
      legend: undefined as Record<string, unknown> | undefined,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: isPie ? 'item' : 'axis',
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f8fafc', fontSize: 13, fontFamily: 'system-ui' },
        axisPointer: { type: 'cross', label: { backgroundColor: '#6366f1' } },
        valueFormatter: (val: string | number) => typeof val === 'number' ? formatNum(val) : val
      },
      grid: {
        top: 30, right: 20, left: 10,
        bottom: chart.data.length > 20 && !isPie ? 45 : 15, // Space for slider if data is huge
        containLabel: true
      },
      xAxis: isPie ? undefined : {
        type: 'category',
        data: xData,
        axisLabel: { color: '#94a3b8', fontSize: 11, hideOverlap: true, width: 80, overflow: 'truncate' },
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false }
      },
      yAxis: isPie ? undefined : {
        type: 'value',
        axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (val: number) => formatNum(val) },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
      },
      // Data Zoom enables Power BI style scrolling/zooming for dense data
      dataZoom: isPie ? [] : [
        { type: 'inside', start: 0, end: chart.data.length > 100 ? 30 : 100 },
        { 
          type: 'slider', show: chart.data.length > 20, bottom: 5, height: 12, 
          borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.02)', 
          fillerColor: 'rgba(99,102,241,0.15)', textStyle: { color: 'transparent' },
          handleStyle: { color: '#6366f1' }
        }
      ],
      series: [] as Record<string, unknown>[]
    };

    if (isPie) {
      baseOption.legend = {
        type: 'scroll',
        orient: 'vertical',
        right: '5%',
        top: 'middle',
        textStyle: { color: '#cbd5e1', fontSize: 12 },
        pageIconColor: '#38bdf8',
        pageTextStyle: { color: '#fff' }
      };

      baseOption.series.push({
        name: chart.title,
        type: 'pie',
        // Responsive full circle
        radius: '70%',
        center: ['40%', '50%'],
        itemStyle: { borderRadius: 5, borderColor: '#0f172a', borderWidth: 2 },
        label: { show: false }, // Use Tooltip instead of inside labels for cleaner look
        emphasis: { label: { show: false } },
        data: chart.data.map((d, i) => ({
          name: String(d.x).slice(0, 20),
          value: Number(d.y),
          itemStyle: { color: COLORS[i % COLORS.length] }
        }))
      });
    } else {
      let seriesType = chart.type;
      let areaStyle = undefined;
      let smooth = false;
      let color = '#10b981';

      if (chart.type === 'area') {
        seriesType = 'line';
        smooth = true;
        color = '#6366f1';
        areaStyle = {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.5)' }, { offset: 1, color: 'rgba(99,102,241,0.01)' }]
          }
        };
      } else if (chart.type === 'line') {
        smooth = true;
      } else if (chart.type === 'bar') {
        color = '#f59e0b';
      }

      baseOption.series.push({
        data: yData,
        type: seriesType,
        smooth,
        areaStyle,
        name: 'Value',
        itemStyle: { color },
        lineStyle: { width: 3 },
        barBorderRadius: [4, 4, 0, 0],
        symbolSize: chart.data.length > 80 ? 0 : 6, // Auto-hide dots if too many points to avoid clashing
      });

      if (forecast) {
        baseOption.series.push({
          data: [ ...Array(chart.data.length - 1).fill(null), chart.data[chart.data.length - 1].y, ...forecast.nextValues.map(v => v.y)],
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbolSize: 8,
          lineStyle: { type: 'dashed', color: '#f59e0b', width: 4 },
          itemStyle: { color: '#f59e0b' },
          name: 'Forecast'
        });
      }
    }

    return baseOption;
  };

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div className="chart-info-box">
          <span className="chart-card-title">{chart.title}</span>
          <div className="chart-hint-trigger">
            <Info size={12} className="muted-icon" />
            <div className="chart-hint-popover">أسحب وأفلت على الرسم لعمل Zoom (تكبير)</div>
          </div>
        </div>
        <div className="chart-actions">
           <span className="chart-type-badge">{chart.type.toUpperCase()}</span>
           {chart.type !== 'pie' && (
             <button className={`chart-download-btn ${forecast ? 'active' : ''}`} onClick={handleForecast} title={forecast ? 'إخفاء التوقع' : 'توقع المستقبّل'}>
               <TrendingUp size={14} color={forecast ? '#f59e0b' : undefined} />
             </button>
           )}
           <button className="chart-download-btn" onClick={(e) => { e.stopPropagation(); download(); }} title="تحميل كصورة">
             <Download size={14} />
           </button>
        </div>
      </div>
      <div
        className="chart-body"
        style={{
          width: '100%',
          height: chart.type === 'pie' ? '300px' : (isMobile ? '220px' : '300px'),
          padding: '0 5px',
          overflow: 'visible',
          position: 'relative'
        }}
      >
        <ReactECharts
          ref={chartRef}
          option={getOption()}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </div>
  );
};
