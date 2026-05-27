import { fmtCompact as fmt } from './smartDashboardUtils';

export type ChartThemeMode = 'light' | 'dark';

/** Base palette (shared across themes) */
export const CHART = {
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  pink: '#EC4899',
  indigo: '#6366F1',
  palette: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#6366F1', '#14B8A6'],
  text: '#64748B',
  textDark: '#1E293B',
  axis: '#E2E8F0',
  split: '#F1F5F9',
  font: 'Plus Jakarta Sans, Noto Sans Arabic, system-ui, sans-serif',
};

type ChartSkin = typeof CHART & {
  text: string;
  textDark: string;
  axis: string;
  split: string;
  surface: string;
  tooltipBg: string;
  tooltipFg: string;
  radarBands: string[];
};

function skin(theme: ChartThemeMode): ChartSkin {
  if (theme === 'dark') {
    return {
      ...CHART,
      text: '#94a3b8',
      textDark: '#e2e8f0',
      axis: '#334155',
      split: '#1e293b',
      surface: '#1e293b',
      tooltipBg: '#0f172a',
      tooltipFg: '#f8fafc',
      radarBands: ['#1e293b', '#0f172a', '#1e293b', '#0f172a'],
    };
  }
  return {
    ...CHART,
    text: '#64748B',
    textDark: '#1E293B',
    axis: '#E2E8F0',
    split: '#F1F5F9',
    surface: '#ffffff',
    tooltipBg: '#1E293B',
    tooltipFg: '#F8FAFC',
    radarBands: ['#F8FAFC', '#fff', '#F8FAFC', '#fff'],
  };
}

function tip(c: ChartSkin, extra?: object) {
  return {
    backgroundColor: c.tooltipBg,
    borderWidth: 0,
    padding: [10, 14],
    textStyle: { color: c.tooltipFg, fontSize: 12, fontFamily: c.font },
    extraCssText: 'border-radius:10px;box-shadow:0 10px 28px rgba(15,23,42,0.18);',
    ...extra,
  };
}

function valueAxis(c: ChartSkin) {
  return {
    type: 'value' as const,
    axisLabel: { color: c.text, fontSize: 11, fontFamily: c.font, formatter: (v: number) => fmt(v) },
    splitLine: { lineStyle: { color: c.split, type: 'dashed' as const } },
    axisLine: { show: false },
  };
}

function categoryAxis(c: ChartSkin, data: string[], rotate = false) {
  const longLabels = data.some(label => String(label).length > 8);
  const shouldRotate = rotate || longLabels;
  return {
    type: 'category' as const,
    data,
    axisLabel: {
      color: c.text,
      fontSize: 11,
      fontFamily: c.font,
      rotate: shouldRotate ? 28 : 0,
      hideOverlap: true,
      interval: Math.max(0, Math.floor(data.length / 8)),
    },
    axisLine: { lineStyle: { color: c.axis } },
    axisTick: { show: false },
  };
}

export function lineOpt(labels: string[], values: number[], color = CHART.blue, theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    tooltip: { trigger: 'axis', ...tip(c) },
    grid: { left: 48, right: 20, top: 24, bottom: 32, containLabel: false },
    xAxis: categoryAxis(c, labels, labels.length > 8),
    yAxis: valueAxis(c),
    series: [{
      type: 'line',
      data: values,
      smooth: 0.35,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: labels.length <= 24,
      lineStyle: { color, width: 3, cap: 'round' },
      itemStyle: { color, borderColor: c.surface, borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: color + '35' }, { offset: 1, color: color + '05' }],
        },
      },
    }],
  };
}

export function barOpt(labels: string[], values: number[], color = CHART.blue, theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'axis', ...tip(c) },
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: valueAxis(c),
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: c.textDark, fontSize: 11, fontFamily: c.font },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: values,
      barMaxWidth: 18,
      itemStyle: { color, borderRadius: [0, 8, 8, 0] },
    }],
  };
}

/** Mirrored horizontal bars — pyramid-style breakdown */
export function pyramidOpt(labels: string[], values: number[], theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  const max = Math.max(...values, 1);
  const norm = values.map(v => Math.round((v / max) * 100));
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'axis', ...tip(c) },
    grid: { left: 52, right: 52, top: 16, bottom: 24, containLabel: true },
    xAxis: {
      type: 'value',
      min: -100,
      max: 100,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: c.split } },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: c.text, fontSize: 11, fontFamily: c.font },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Share',
        type: 'bar',
        stack: 'total',
        data: norm.map(v => -v),
        itemStyle: { color: CHART.blue, borderRadius: [8, 0, 0, 8] },
        barMaxWidth: 14,
      },
      {
        name: 'Share',
        type: 'bar',
        stack: 'total',
        data: norm,
        itemStyle: { color: CHART.green, borderRadius: [0, 8, 8, 0] },
        barMaxWidth: 14,
      },
    ],
  };
}

export function donutOpt(items: { l: string; v: number }[], colors = CHART.palette, theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'item', ...tip(c), formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      textStyle: { color: c.text, fontSize: 11, fontFamily: c.font },
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
    },
    series: [{
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['38%', '50%'],
      padAngle: 2,
      itemStyle: { borderRadius: 6, borderColor: c.surface, borderWidth: 2 },
      data: items.map((it, i) => ({
        name: it.l,
        value: it.v,
        itemStyle: { color: colors[i % colors.length] },
      })),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6 },
    }],
  };
}

export function histOpt(vals: number[], _label: string, color = CHART.blue, theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  if (vals.length === 0) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const bins = Math.min(16, Math.ceil(Math.sqrt(vals.length)));
  const binSize = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);
  vals.forEach(v => {
    const i = Math.min(Math.floor((v - min) / binSize), bins - 1);
    counts[i]++;
  });
  const labels = counts.map((_, i) => fmt(min + i * binSize));
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'axis', ...tip(c) },
    grid: { left: 40, right: 12, top: 16, bottom: 36 },
    xAxis: categoryAxis(c, labels, true),
    yAxis: valueAxis(c),
    series: [{
      type: 'bar',
      data: counts,
      barMaxWidth: 28,
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color }, { offset: 1, color: color + '55' }],
        },
        borderRadius: [6, 6, 0, 0],
      },
    }],
  };
}

export function multiBarOpt(labels: string[], series: { name: string; data: number[]; color: string }[], theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'axis', ...tip(c) },
    legend: {
      top: 0,
      right: 8,
      textStyle: { color: c.text, fontSize: 11, fontFamily: c.font },
      itemWidth: 12,
      itemHeight: 8,
      icon: 'roundRect',
    },
    grid: { left: 44, right: 16, top: 36, bottom: 40 },
    xAxis: categoryAxis(c, labels, labels.some(l => l.length > 6)),
    yAxis: valueAxis(c),
    series: series.map(s => ({
      type: 'bar',
      name: s.name,
      data: s.data,
      barMaxWidth: 20,
      itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] },
    })),
  };
}

export function radarOpt(
  indicators: { name: string; max: number }[],
  series: { name: string; value: number[] }[],
  palette = CHART.palette,
  theme: ChartThemeMode = 'light',
) {
  const c = skin(theme);
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: tip(c),
    legend: {
      bottom: 0,
      textStyle: { color: c.text, fontSize: 11, fontFamily: c.font },
      itemWidth: 10,
      itemHeight: 10,
    },
    radar: {
      indicator: indicators,
      radius: '62%',
      splitNumber: 4,
      splitArea: { areaStyle: { color: c.radarBands } },
      splitLine: { lineStyle: { color: c.axis } },
      axisName: { color: c.text, fontSize: 11, fontFamily: c.font },
      axisLine: { lineStyle: { color: c.axis } },
    },
    series: [{
      type: 'radar',
      data: series.map((s, i) => ({
        name: s.name,
        value: s.value,
        lineStyle: { color: palette[i % palette.length], width: 2 },
        itemStyle: { color: palette[i % palette.length] },
        areaStyle: { color: palette[i % palette.length] + '28' },
      })),
    }],
  };
}

export function gaugeOpt(val: number, label: string, color = CHART.blue) {
  return {
    backgroundColor: 'transparent',
    animation: true,
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 5,
      axisLine: { lineStyle: { width: 14, color: [[val / 100, color], [1, '#E2E8F0']] } },
      pointer: { width: 5, length: '55%', itemStyle: { color } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { color: CHART.text, fontSize: 11, fontFamily: CHART.font, offsetCenter: [0, '78%'] },
      detail: {
        valueAnimation: true,
        fontSize: 26,
        fontWeight: 700,
        color: CHART.textDark,
        formatter: '{value}%',
        offsetCenter: [0, '38%'],
        fontFamily: CHART.font,
      },
      data: [{ value: val, name: label }],
    }],
  };
}

export function funnelOpt(items: { l: string; v: number }[], color = CHART.blue) {
  const max = items[0]?.v || 1;
  const shades = [color, CHART.cyan, CHART.green, CHART.amber, CHART.purple];
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'item', ...tip(skin('light')), formatter: '{b}: {c}' },
    series: [{
      type: 'funnel',
      left: '12%',
      top: 12,
      bottom: 12,
      width: '76%',
      min: 0,
      max,
      minSize: '12%',
      maxSize: '100%',
      sort: 'descending',
      gap: 4,
      label: { position: 'inside', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: CHART.font },
      data: items.map((it, i) => ({
        name: it.l.length > 16 ? it.l.slice(0, 15) + '…' : it.l,
        value: Math.round(it.v),
        itemStyle: { color: shades[i % shades.length] },
      })),
    }],
  };
}

export function waterfallOpt(labels: string[], vals: number[], color = CHART.blue) {
  let cum = 0;
  const bases: number[] = [];
  const changes: number[] = [];
  vals.forEach(v => { bases.push(cum); changes.push(Math.round(v)); cum += v; });
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'axis', ...tip(skin('light')) },
    grid: { left: 44, right: 12, top: 16, bottom: 40 },
    xAxis: categoryAxis(skin('light'), labels, true),
    yAxis: valueAxis(skin('light')),
    series: [
      { type: 'bar', stack: 'w', data: bases, itemStyle: { color: 'transparent' } },
      { type: 'bar', stack: 'w', data: changes, barMaxWidth: 28, itemStyle: { color, borderRadius: [6, 6, 0, 0] } },
    ],
  };
}

export function bubbleOpt(pts: [number, number, number][], xL: string, yL: string, zL: string, color = CHART.blue) {
  const maxZ = Math.max(...pts.map(p => p[2])) || 1;
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      trigger: 'item',
      ...tip(skin('light')),
      formatter: (p: { data: number[] }) => `${xL}: ${fmt(p.data[0])}<br/>${yL}: ${fmt(p.data[1])}<br/>${zL}: ${fmt(p.data[2])}`,
    },
    grid: { left: 52, right: 16, top: 20, bottom: 36 },
    xAxis: { ...valueAxis(skin('light')), name: xL.slice(0, 12), nameTextStyle: { color: CHART.text, fontSize: 10 } },
    yAxis: { ...valueAxis(skin('light')), name: yL.slice(0, 12), nameTextStyle: { color: CHART.text, fontSize: 10 } },
    series: [{
      type: 'scatter',
      data: pts,
      symbolSize: (d: number[]) => Math.max(8, (d[2] / maxZ) * 36),
      itemStyle: { color: color + '99', borderColor: color, borderWidth: 1.5 },
    }],
  };
}

export function stackedAreaOpt(labels: string[], series: { name: string; data: number[]; color: string }[]) {
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'axis', ...tip(skin('light')) },
    legend: {
      top: 0,
      right: 8,
      textStyle: { color: CHART.text, fontSize: 11, fontFamily: CHART.font },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: 44, right: 16, top: 32, bottom: 32 },
    xAxis: categoryAxis(skin('light'), labels, false),
    yAxis: valueAxis(skin('light')),
    series: series.map(s => ({
      type: 'line',
      name: s.name,
      data: s.data,
      stack: 'total',
      smooth: 0.3,
      symbol: 'none',
      lineStyle: { color: s.color, width: 2 },
      areaStyle: { color: s.color + '40' },
    })),
  };
}

export function scatterOpt(pts: [number, number][], xL: string, yL: string, color = CHART.blue) {
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      trigger: 'item',
      ...tip(skin('light')),
      formatter: (p: { data: number[] }) => `${xL}: ${fmt(p.data[0])}<br/>${yL}: ${fmt(p.data[1])}`,
    },
    grid: { left: 52, right: 16, top: 20, bottom: 36 },
    xAxis: valueAxis(skin('light')),
    yAxis: valueAxis(skin('light')),
    series: [{
      type: 'scatter',
      data: pts,
      symbolSize: 8,
      itemStyle: { color: color + 'BB', borderColor: color, borderWidth: 1.5 },
    }],
  };
}

export function boxOpt(series: { name: string; vals: number[] }[], color = CHART.blue) {
  const boxData = series.map(s => {
    const v = [...s.vals].sort((a, b) => a - b);
    const n = v.length;
    if (!n) return [0, 0, 0, 0, 0];
    return [v[0], v[Math.floor(n * 0.25)], n % 2 === 0 ? (v[n / 2 - 1] + v[n / 2]) / 2 : v[Math.floor(n / 2)], v[Math.floor(n * 0.75)], v[n - 1]];
  });
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      trigger: 'item',
      ...tip(skin('light')),
      formatter: (p: { name: string; data: number[] }) =>
        `${p.name}<br/>Min: ${fmt(p.data[1])}<br/>Q1: ${fmt(p.data[2])}<br/>Median: ${fmt(p.data[3])}<br/>Q3: ${fmt(p.data[4])}<br/>Max: ${fmt(p.data[5])}`,
    },
    grid: { left: 8, right: 20, top: 8, bottom: 8, containLabel: true },
    xAxis: valueAxis(skin('light')),
    yAxis: {
      type: 'category',
      data: series.map(s => (s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name)),
      axisLabel: { color: CHART.textDark, fontSize: 11, fontFamily: CHART.font },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'boxplot',
      data: boxData,
      itemStyle: { color: color + '30', borderColor: color, borderWidth: 2 },
    }],
  };
}

export function paretoOpt(labels: string[], vals: number[], color = CHART.blue, theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  const total = vals.reduce((a, b) => a + b, 0);
  let cum = 0;
  const cumPcts = vals.map(v => { cum += (v / total) * 100; return Math.round(cum * 10) / 10; });
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: { trigger: 'axis', ...tip(c) },
    legend: {
      data: ['Value', 'Cumulative %'],
      top: 0,
      right: 8,
      textStyle: { color: c.text, fontSize: 11, fontFamily: c.font },
      itemWidth: 10,
      itemHeight: 8,
    },
    grid: { left: 44, right: 48, top: 32, bottom: 44 },
    xAxis: categoryAxis(c, labels, true),
    yAxis: [
      valueAxis(c),
      {
        type: 'value',
        max: 100,
        axisLabel: { color: c.text, fontSize: 10, formatter: (v: number) => v + '%' },
        splitLine: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
      { name: 'Value', type: 'bar', data: vals, barMaxWidth: 28, itemStyle: { color, borderRadius: [6, 6, 0, 0] } },
      {
        name: 'Cumulative %',
        type: 'line',
        yAxisIndex: 1,
        data: cumPcts,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: CHART.amber, width: 2 },
        itemStyle: { color: CHART.amber },
        markLine: {
          silent: true,
          data: [{
            yAxis: 80,
            lineStyle: { color: '#EF444488', type: 'dashed' },
            label: { color: '#EF4444', fontSize: 10, formatter: '80%' },
          }],
        },
      },
    ],
  };
}

export function heatmapOpt(cols: string[], matrix: number[][], theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  const data: [number, number, number][] = [];
  matrix.forEach((row, i) => row.forEach((v, j) => data.push([j, i, Math.round(v * 100) / 100])));
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      position: 'top',
      ...tip(c),
      formatter: (p: { data: number[] }) => `${cols[p.data[1]]} × ${cols[p.data[0]]}<br/>r = <b>${p.data[2]}</b>`,
    },
    grid: { left: 72, right: 12, top: 12, bottom: 72 },
    xAxis: { type: 'category', data: cols, axisLabel: { color: c.text, fontSize: 10, rotate: 28 }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'category', data: cols, axisLabel: { color: c.text, fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: {
      min: -1,
      max: 1,
      calculable: false,
      orient: 'horizontal',
      bottom: 0,
      left: 'center',
      textStyle: { color: c.text, fontSize: 10 },
      inRange: { color: ['#EF4444', theme === 'dark' ? '#1e293b' : '#F8FAFC', '#10B981'] },
    },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 10, color: c.textDark, fontFamily: c.font } }],
  };
}

export function treemapOpt(data: { name: string; value: number }[], color = CHART.blue, theme: ChartThemeMode = 'light') {
  const c = skin(theme);
  return {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      ...tip(c),
      formatter: (p: { name: string; value: number; percent?: number }) =>
        `${p.name}<br/>${fmt(p.value)} (${p.percent?.toFixed(1) ?? '0'}%)`,
    },
    series: [{
      type: 'treemap',
      data,
      roam: false,
      label: { show: true, fontSize: 11, color: '#fff', fontWeight: 600, fontFamily: CHART.font },
      breadcrumb: { show: false },
      itemStyle: { borderColor: c.surface, borderWidth: 2, gapWidth: 3 },
      levels: [{
        itemStyle: { borderColor: color, borderWidth: 2, gapWidth: 4 },
        color: [color, CHART.cyan, CHART.green, CHART.amber, CHART.purple, CHART.indigo],
      }],
    }],
  };
}
