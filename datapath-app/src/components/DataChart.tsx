import React, { useRef, useCallback, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Camera, Info, TrendingUp } from 'lucide-react';
import type { ChartInfo } from '../types';
import { forecastTimeSeries } from '../lib/statService';
import type { ForecastResult } from '../lib/statService';
import { useMediaQuery } from 'react-responsive';

interface Props { chart: ChartInfo; onFilterClick?: (column: string, value: string) => void; }

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#3b82f6'];

export const DataChart: React.FC<Props> = ({ chart, onFilterClick }) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const chartRef = useRef<ReactECharts>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);

  const handleForecast = () => {
    if (forecast) { setForecast(null); return; }
    const res = forecastTimeSeries(chart.data, 5);
    setForecast(res);
  };

  const onChartClick = (e: { name?: string }) => {
    if (onFilterClick && e.name) {
      onFilterClick(chart.title, e.name);
    }
  };

  const download = useCallback(() => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    if (!echartsInstance) return;
    // 3× pixelRatio = true high-res PNG
    const url = echartsInstance.getDataURL({ type: 'png', pixelRatio: 3, backgroundColor: '#0a0f1d' });
    const link = document.createElement('a');
    link.download = `${chart.title.replace(/\s+/g, '_')}_hires.png`;
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
      // Group small slices into "Other" for clarity
      const totalVal = chart.data.reduce((s, d) => s + Number(d.y), 0);
      const threshold = totalVal * 0.02; // < 2% → group into "Other"
      const mainSlices: { name: string; value: number; itemStyle: { color: string } }[] = [];
      let otherVal = 0;

      chart.data.forEach((d, i) => {
        const val = Number(d.y);
        if (val >= threshold) {
          mainSlices.push({
            name: String(d.x).slice(0, 25),
            value: val,
            itemStyle: { color: COLORS[i % COLORS.length] }
          });
        } else {
          otherVal += val;
        }
      });

      if (otherVal > 0) {
        mainSlices.push({ name: 'Other', value: otherVal, itemStyle: { color: '#475569' } });
      }

      baseOption.legend = {
        type: 'scroll',
        orient: isMobile ? 'horizontal' : 'vertical',
        ...(isMobile
          ? { bottom: 0, left: 'center', right: '5%' }
          : { right: '2%', top: 'middle' }),
        textStyle: { color: '#94a3b8', fontSize: isMobile ? 10 : 12 },
        itemWidth: 10,
        itemHeight: 10,
        icon: 'circle',
        pageIconColor: '#38bdf8',
        pageTextStyle: { color: '#fff' },
        formatter: (name: string) => name.length > 18 ? name.slice(0, 18) + '…' : name,
      };

      baseOption.series.push({
        name: chart.title,
        type: 'pie',
        radius: isMobile ? ['38%', '65%'] : ['42%', '72%'],
        center: isMobile ? ['50%', '42%'] : ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#050810',
          borderWidth: 3,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: '700', color: '#fff', formatter: '{b}\n{d}%' },
          itemStyle: { shadowBlur: 20, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)', borderWidth: 0 },
          scale: true,
          scaleSize: 8,
        },
        data: mainSlices
      });

      (baseOption as any).graphic = [
        {
          type: 'text',
          left: isMobile ? '50%' : '38%',
          top: isMobile ? '40%' : 'middle',
          style: {
            text: `${mainSlices.length} values`,
            textAlign: 'center',
            fill: '#475569',
            font: 'bold 11px system-ui',
            lineHeight: 18,
          }
        }
      ];
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
             <Camera size={14} />
           </button>
        </div>
      </div>
      <div
        className="chart-body"
        style={{
          width: '100%',
          height: chart.type === 'pie'
            ? (isMobile ? '320px' : '360px')
            : (isMobile ? '240px' : '300px'),
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
          onEvents={{ click: onChartClick }}
        />
      </div>
    </div>
  );
};
