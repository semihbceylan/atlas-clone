"use client";

import { memo, useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import type { Candle, Timeframe } from "@/types/market";
import { formatClockTime, formatShortDate } from "@/lib/format-price";
import type { CandleEvent, LiveMarketApi } from "@/hooks/use-live-candles";

/**
 * Lightweight Charts v5 wrapper.
 *
 * The chart is an imperative canvas library, so it is driven through refs and
 * lifecycle effects rather than React state:
 *
 * - the instance is created exactly once per mount (`createChart`);
 * - symbol/timeframe changes call `series.setData(...)`, they never rebuild the
 *   chart;
 * - ticks call `series.update(...)` with a single candle, which is what keeps
 *   live updates allocation-free relative to re-rendering a dataset;
 * - a `ResizeObserver` forwards container size changes (including grid resizes)
 *   to `chart.resize(...)`;
 * - everything is torn down on unmount so switching symbols or navigating away
 *   cannot leak canvases or observers.
 */

const UP_COLOR = "#16c784";
const DOWN_COLOR = "#ef4453";
const AXIS_TEXT = "#9b9ca8";
const PANEL_BACKGROUND = "#121319";
const GRID_LINE = "rgba(255, 255, 255, 0.035)";
const CROSSHAIR_LINE = "rgba(139, 148, 170, 0.45)";
const CROSSHAIR_LABEL = "#2a303c";

/** Volume occupies the bottom band of the price pane. */
const PRICE_SCALE_MARGINS = { top: 0.08, bottom: 0.28 };
const VOLUME_SCALE_MARGINS = { top: 0.82, bottom: 0 };

/**
 * Lightweight Charts labels the time axis in UTC by default. BIST instruments
 * trade in Istanbul time, so both the axis and the crosshair label are formatted
 * with the browser's local timezone — the same formatter the OHLC row uses.
 */
function formatAxisTick(time: Time, tickMarkType: TickMarkType): string | null {
  if (typeof time !== "number") return null;

  return tickMarkType === TickMarkType.Time || tickMarkType === TickMarkType.TimeWithSeconds
    ? formatClockTime(time)
    : formatShortDate(time);
}

interface ChartHandles {
  chart: IChartApi;
  candleSeries: ISeriesApi<"Candlestick">;
  volumeSeries: ISeriesApi<"Histogram">;
}

interface CandlestickChartProps {
  api: LiveMarketApi;
  timeframe: Timeframe;
  showVolume: boolean;
  showLastPriceLine: boolean;
  /** `magnet` snaps the crosshair to the nearest OHLC value. */
  crosshairSnapped: boolean;
  /** Called with the hovered candle, or `null` when the crosshair leaves. */
  onCrosshairMove: (candle: Candle | null) => void;
  /** Bumping this re-fits the visible range without touching the data. */
  viewResetToken: number;
}

function toCandlestickData(candle: Candle): CandlestickData<Time> {
  return {
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function toVolumeData(candle: Candle): HistogramData<Time> {
  const rising = candle.close >= candle.open;
  return {
    time: candle.time as UTCTimestamp,
    value: candle.volume,
    // Translucent so volume reads as context, not as a second price series.
    color: rising ? "rgba(22, 199, 132, 0.42)" : "rgba(239, 68, 83, 0.42)",
  };
}

export const CandlestickChart = memo(function CandlestickChart({
  api,
  timeframe,
  showVolume,
  showLastPriceLine,
  crosshairSnapped,
  onCrosshairMove,
  viewResetToken,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<ChartHandles | null>(null);
  const volumeVisibleRef = useRef(showVolume);
  /**
   * Read once, for chart creation only. Subsequent timeframe changes are applied
   * with `applyOptions` by the effect below, so the creation effect can stay
   * dependency-free — which is what guarantees a single chart instance.
   */
  const creationTimeframeRef = useRef(timeframe);

  // The crosshair callback is read through a ref so that a new inline function
  // from the parent never re-creates the chart or re-subscribes the handler.
  const crosshairCallbackRef = useRef(onCrosshairMove);
  crosshairCallbackRef.current = onCrosshairMove;

  volumeVisibleRef.current = showVolume;

  // --- Chart lifecycle: create once, destroy on unmount -----------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      // Explicit resizing (see the ResizeObserver below) keeps the chart in sync
      // with the grid widget, which changes size without a window resize event.
      autoSize: false,
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
      layout: {
        background: { type: ColorType.Solid, color: PANEL_BACKGROUND },
        textColor: AXIS_TEXT,
        fontSize: 11,
        fontFamily: "Arial, sans-serif",
        // TradingView's licence requires the attribution notice; the built-in
        // logo satisfies it, so it stays enabled.
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: GRID_LINE },
        horzLines: { color: GRID_LINE },
      },
      rightPriceScale: {
        borderColor: "#1d212a",
        scaleMargins: PRICE_SCALE_MARGINS,
        minimumWidth: 62,
      },
      timeScale: {
        borderColor: "#1d212a",
        timeVisible: creationTimeframeRef.current !== "1D",
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 7,
        minBarSpacing: 0.5,
        tickMarkFormatter: formatAxisTick,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CROSSHAIR_LINE,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: CROSSHAIR_LABEL,
        },
        horzLine: {
          color: CROSSHAIR_LINE,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: CROSSHAIR_LABEL,
        },
      },
      localization: {
        locale: "tr-TR",
        // Crosshair axis labels, in the same timezone as the time axis.
        timeFormatter: (time: Time) =>
          typeof time === "number" ? formatClockTime(time) : "",
        priceFormatter: (price: number) =>
          new Intl.NumberFormat("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(price),
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      priceLineColor: "#7a7af8",
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    // `priceScaleId: ""` puts volume on its own overlay scale inside the same
    // pane — the standard recipe for a volume histogram under candles.
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
      visible: volumeVisibleRef.current,
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: VOLUME_SCALE_MARGINS,
      visible: false,
    });

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const callback = crosshairCallbackRef.current;

      if (!param.time || !param.point) {
        callback(null);
        return;
      }

      const bar = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      if (!bar || typeof bar.open !== "number") {
        callback(null);
        return;
      }

      const volumeBar = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;

      callback({
        time: param.time as number,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: volumeBar?.value ?? 0,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    handlesRef.current = { chart, candleSeries, volumeSeries };

    // The grid can resize a widget without the window changing size, so an
    // explicit observer is required for correct chart dimensions.
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      chart.resize(Math.floor(width), Math.floor(height));
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      handlesRef.current = null;
    };
    // Created exactly once: symbol/timeframe changes are handled by setData below.
  }, []);

  // --- Data: full reset on symbol/timeframe change, incremental on ticks ------
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;

    const { chart, candleSeries, volumeSeries } = handles;

    const applyReset = (candles: readonly Candle[]) => {
      candleSeries.setData(candles.map(toCandlestickData));
      volumeSeries.setData(candles.map(toVolumeData));
      // Fresh instrument or interval: frame all 100 bars.
      chart.timeScale().fitContent();
    };

    const applyUpdate = (candle: Candle) => {
      candleSeries.update(toCandlestickData(candle));
      if (volumeVisibleRef.current) volumeSeries.update(toVolumeData(candle));
    };

    const handleEvent = (event: CandleEvent) => {
      if (event.type === "reset") applyReset(event.candles);
      else applyUpdate(event.candle);
    };

    // Read the snapshot first: the shared market state is seeded during render
    // and may already contain data that predates this subscription.
    const snapshot = api.getSnapshot();
    applyReset(snapshot.candles);

    return api.subscribe(handleEvent);
  }, [api]);

  // --- Options that change without touching data -----------------------------
  useEffect(() => {
    handlesRef.current?.volumeSeries.applyOptions({ visible: showVolume });
  }, [showVolume]);

  useEffect(() => {
    handlesRef.current?.candleSeries.applyOptions({ priceLineVisible: showLastPriceLine });
  }, [showLastPriceLine]);

  useEffect(() => {
    const mode = crosshairSnapped ? CrosshairMode.Magnet : CrosshairMode.Normal;
    handlesRef.current?.chart.applyOptions({ crosshair: { mode } });
  }, [crosshairSnapped]);

  useEffect(() => {
    handlesRef.current?.chart.applyOptions({
      timeScale: { timeVisible: timeframe !== "1D" },
    });
  }, [timeframe]);

  // "Rescale" control: re-fit the visible bar range without reloading data.
  useEffect(() => {
    if (viewResetToken === 0) return;
    handlesRef.current?.chart.timeScale().fitContent();
  }, [viewResetToken]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
});
