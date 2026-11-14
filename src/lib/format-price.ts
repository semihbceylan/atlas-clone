/**
 * Turkish-locale number formatting helpers.
 *
 * The terminal trades BIST instruments, so prices use `tr-TR` conventions:
 * comma as the decimal separator and a dot as the thousands separator.
 */

const priceFormatters = new Map<number, Intl.NumberFormat>();

/** Cached `Intl.NumberFormat` instances — constructing them is comparatively expensive. */
function priceFormatter(fractionDigits: number): Intl.NumberFormat {
  const cached = priceFormatters.get(fractionDigits);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  priceFormatters.set(fractionDigits, formatter);
  return formatter;
}

export interface FormatPriceOptions {
  /** Number of decimals. Defaults to 2, the BIST equity convention. */
  fractionDigits?: number;
  /** Appended after the number, e.g. `" ₺"`. */
  suffix?: string;
}

/** Formats a price for display, e.g. `157,42 ₺`. */
export function formatPrice(value: number, options: FormatPriceOptions = {}): string {
  if (!Number.isFinite(value)) return "—";

  const { fractionDigits = 2, suffix = " ₺" } = options;
  return `${priceFormatter(fractionDigits).format(value)}${suffix}`;
}

const compactVolumeFormatter = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formats a share volume, e.g. `1,2 Mn`. */
export function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 1) return new Intl.NumberFormat("tr-TR", { maximumSignificantDigits: 3 }).format(value);
  return compactVolumeFormatter.format(value);
}

/** Formats a signed percentage change, e.g. `+1,42%`. */
export function formatPercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";

  const sign = value > 0 ? "+" : "";
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

  return `${sign}${formatted}%`;
}

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Formats a UTC-seconds timestamp as `HH:mm` in the user's local timezone. */
export function formatClockTime(utcSeconds: number): string {
  if (!Number.isFinite(utcSeconds)) return "—";
  return timeFormatter.format(new Date(utcSeconds * 1000));
}

/** Formats a UTC-seconds timestamp as a short date, used for daily candles. */
export function formatShortDate(utcSeconds: number): string {
  if (!Number.isFinite(utcSeconds)) return "—";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(
    new Date(utcSeconds * 1000),
  );
}

/**
 * Chooses a sensible axis label formatter for a timeframe: intraday intervals
 * show the clock, daily interval shows the date.
 */
export function axisFormatterForTimeframe(isIntraday: boolean) {
  return (utcSeconds: number) =>
    isIntraday ? formatClockTime(utcSeconds) : formatShortDate(utcSeconds);
}
