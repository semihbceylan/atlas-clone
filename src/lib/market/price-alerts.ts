export interface PriceAlert {
  id: string;
  symbol: string;
  target: number;
  direction: "above" | "below";
  triggeredAt: string | null;
}
export function parseAlerts(value: unknown): PriceAlert[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PriceAlert => !!item && typeof item.id === "string" && typeof item.symbol === "string" && Number.isFinite(item.target) && item.target > 0 && ["above", "below"].includes(item.direction) && (item.triggeredAt === null || typeof item.triggeredAt === "string")).slice(0, 100);
}
export function evaluateAlerts(alerts: PriceAlert[], symbol: string, price: number, now: string): PriceAlert[] {
  if (!Number.isFinite(price) || price <= 0) return alerts;
  let changed = false;
  const next = alerts.map(alert => {
    if (alert.triggeredAt || alert.symbol !== symbol || !(alert.direction === "above" ? price >= alert.target : price <= alert.target)) return alert;
    changed = true;
    return { ...alert, triggeredAt: now };
  });
  return changed ? next : alerts;
}
