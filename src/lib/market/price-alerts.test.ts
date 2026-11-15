import { describe, expect, it } from "vitest";
import { evaluateAlerts, parseAlerts, type PriceAlert } from "./price-alerts";
const alert: PriceAlert = { id: "one", symbol: "BTC", target: 100, direction: "above", triggeredAt: null };
describe("local price alerts", () => {
  it("triggers once at the inclusive threshold", () => {
    const triggered = evaluateAlerts([alert], "BTC", 100, "now");
    expect(triggered[0].triggeredAt).toBe("now");
    expect(evaluateAlerts(triggered, "BTC", 120, "later")).toBe(triggered);
  });
  it("ignores other symbols and invalid quotes", () => {
    const alerts = [alert];
    expect(evaluateAlerts(alerts, "ETH", 120, "now")).toBe(alerts);
    expect(evaluateAlerts(alerts, "BTC", NaN, "now")).toBe(alerts);
    expect(evaluateAlerts(alerts, "BTC", 0, "now")).toBe(alerts);
  });
  it("supports below-price alerts", () => {
    expect(evaluateAlerts([{ ...alert, direction: "below" }], "BTC", 99, "now")[0].triggeredAt).toBe("now");
  });
  it("validates saved data", () => {
    expect(parseAlerts([alert, { ...alert, target: -1 }, null])).toEqual([alert]);
    expect(parseAlerts({})).toEqual([]);
  });
});
