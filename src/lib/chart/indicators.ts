import type { Candle } from "@/types/market";

export function heikinAshi(candles: readonly Candle[]): Candle[] {
  let previous: Candle | undefined;
  return candles.map(candle => {
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open = previous ? (previous.open + previous.close) / 2 : (candle.open + candle.close) / 2;
    previous = { ...candle, open, close, high: Math.max(candle.high, open, close), low: Math.min(candle.low, open, close) };
    return previous;
  });
}
export type ChartType = "candles" | "line" | "area" | "bars" | "hollow" | "heikin" | "baseline" | "histogram";

export function movingAverage(candles: readonly Candle[], period: number, exponential = false): { time: number; value: number }[] {
  if (!Number.isInteger(period) || period < 1 || candles.length < period) return [];
  const result: { time: number; value: number }[] = [];
  let sum = 0;
  let previous = 0;
  candles.forEach((candle, index) => {
    sum += candle.close;
    if (index >= period) sum -= candles[index - period].close;
    if (index < period - 1) return;
    const value = exponential && index >= period ? candle.close * (2 / (period + 1)) + previous * (1 - 2 / (period + 1)) : sum / period;
    previous = value;
    result.push({ time: candle.time, value });
  });
  return result;
}
