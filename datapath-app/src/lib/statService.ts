import * as ss from 'simple-statistics';

export interface ForecastResult {
  nextValues: { x: string; y: number }[];
  equation: string;
}

export function forecastTimeSeries(data: { x: string | number; y: number }[], steps: number = 5): ForecastResult | null {
  if (data.length < 2) return null;

  // Attempt to parse X as chronological indices
  const points = data.map((d, i) => [i, d.y] as [number, number]);
  
  try {
    const lindealModel = ss.linearRegression(points);
    const line = ss.linearRegressionLine(lindealModel);

    const lastIdx = points.length - 1;
    const nextValues = [];

    for (let i = 1; i <= steps; i++) {
      const nextIdx = lastIdx + i;
      const nextY = Math.max(0, line(nextIdx));
      nextValues.push({
        x: `+${i}P`,
        y: Number(nextY.toFixed(2))
      });
    }

    return {
      nextValues,
      equation: `y = ${lindealModel.m.toFixed(2)}x + ${lindealModel.b.toFixed(2)}`
    };
  } catch (e) {
    console.error('Forecasting error:', e);
    return null;
  }
}
