import { describe, expect, it } from "vitest";
import { movingAverage, heikinAshi } from "./indicators";
const candles = [1, 2, 3, 4, 5].map(value => ({ time: value, open: value, high: value, low: value, close: value, volume: 1 }));
describe("moving averages", () => {
  it("derives Heikin Ashi candles without changing source data", () => {
    const source = [{ time: 1, open: 2, high: 8, low: 1, close: 5, volume: 1 }, { time: 2, open: 5, high: 9, low: 4, close: 8, volume: 2 }];
    const result = heikinAshi(source);
    expect(result[0]).toMatchObject({ open: 3.5, close: 4, high: 8, low: 1 });
    expect(result[1].open).toBe(3.75);
    expect(source[0].open).toBe(2);
  });
  it("calculates SMA after the warm-up period", () => {
    expect(movingAverage(candles, 3)).toEqual([{ time: 3, value: 2 }, { time: 4, value: 3 }, { time: 5, value: 4 }]);
  });
  it("seeds EMA with SMA and applies smoothing", () => {
    const result = movingAverage([...candles, { ...candles[4], time: 6, close: 10 }], 3, true);
    expect(result.at(-1)?.value).toBe(7);
  });
  it("rejects invalid periods and insufficient data", () => {
    expect(movingAverage(candles, 0)).toEqual([]);
    expect(movingAverage(candles, 10)).toEqual([]);
  });
});
