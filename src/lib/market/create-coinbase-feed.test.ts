import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCoinbaseLiveEnabled, parseCoinbaseCandles, parseCoinbaseTrade, subscribeCoinbase } from "./create-coinbase-feed";

class TestSocket {
  static instances: TestSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => this.onclose?.());
  constructor(readonly url: string) { TestSocket.instances.push(this); }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const trade = (id = 1) => ({ type: "ticker", product_id: "BTC-USD", price: "65000.12", last_size: "0.05", trade_id: id, time: new Date().toISOString() });
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers(); TestSocket.instances = [];
  vi.stubGlobal("WebSocket", TestSocket);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [[Math.floor(Date.now() / 300000) * 300 - 300, 64000, 66000, 64500, 65000, 1]] }));
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const start = () => {
  const callbacks = { onTick: vi.fn(), onHistory: vi.fn(), onStatus: vi.fn() };
  stop = subscribeCoinbase({ symbol: "BTC", timeframe: "5m", ...callbacks });
  return { ...callbacks, socket: TestSocket.instances[0] };
};

describe("Coinbase public feed", () => {
  it("does not enable market data by default or with ambiguous configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_COINBASE_LIVE_DATA", undefined);
    expect(isCoinbaseLiveEnabled("BTC")).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_COINBASE_LIVE_DATA", "false");
    expect(isCoinbaseLiveEnabled("BTC")).toBe(false);
  });
  it("requires explicit opt-in and a supported crypto instrument", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_COINBASE_LIVE_DATA", "true");
    expect(isCoinbaseLiveEnabled("BTC")).toBe(true);
    expect(isCoinbaseLiveEnabled("ASTOR")).toBe(false);
  });
  it("validates trade messages and ignores unrelated or malformed payloads", () => {
    expect(parseCoinbaseTrade(trade(), "BTC")).toMatchObject({ price: 65000.12, size: 0.05, symbol: "BTC" });
    for (const payload of [null, {}, { ...trade(), product_id: "ETH-USD" }, { ...trade(), price: "NaN" }, { ...trade(), last_size: "-1" }, { ...trade(), time: "bad" }]) expect(parseCoinbaseTrade(payload, "BTC")).toBeNull();
  });
  it("sorts, deduplicates and validates REST candle history", () => {
    expect(parseCoinbaseCandles([[600, 10, 20, 12, 15, 2], [300, 10, 20, 11, 14, 1], [600, 10, 20, 12, 16, 3], [900, 20, 10, 15, 15, 1]])).toEqual([
      { time: 300, low: 10, high: 20, open: 11, close: 14, volume: 1 },
      { time: 600, low: 10, high: 20, open: 12, close: 16, volume: 3 },
    ]);
  });
  it("subscribes without credentials, installs history before buffered ticks, and deduplicates trades", async () => {
    const { socket, onTick, onHistory, onStatus } = start();
    socket.onopen?.(); socket.message(trade());
    expect(onTick).not.toHaveBeenCalled();
    await settle();
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker", "heartbeat"] });
    expect(onHistory).toHaveBeenCalledOnce(); expect(onTick).toHaveBeenCalledOnce();
    expect(onHistory.mock.invocationCallOrder[0]).toBeLessThan(onTick.mock.invocationCallOrder[0]);
    socket.message(trade()); socket.message(trade(2));
    expect(onTick).toHaveBeenCalledTimes(2); expect(onStatus).toHaveBeenLastCalledWith("live");
  });
  it("continues real trade aggregation if history fails, without generating synthetic prices", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const { socket, onTick, onHistory } = start(); socket.onopen?.(); socket.message(trade()); await settle();
    expect(onHistory).not.toHaveBeenCalled(); expect(onTick).toHaveBeenCalledOnce();
  });
  it("reconnects after disconnect and cancels retries on unsubscribe", async () => {
    const { socket, onStatus } = start(); socket.close();
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    await vi.advanceTimersByTimeAsync(1400); expect(TestSocket.instances).toHaveLength(2);
    TestSocket.instances[1].close(); stop?.();
    await vi.advanceTimersByTimeAsync(60_000); expect(TestSocket.instances).toHaveLength(2);
  });
  it("reconnects stale sockets and releases timers and socket handlers", async () => {
    const { socket } = start();
    await vi.advanceTimersByTimeAsync(35_000); expect(socket.close).toHaveBeenCalled();
    stop?.(); expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores a late history response after switching away", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise(done => { resolve = done; }) as Promise<Response>);
    const { socket, onHistory, onTick } = start(); socket.onopen?.(); socket.message(trade()); stop?.();
    resolve({ ok: true, json: async () => [[300, 1, 3, 2, 2, 1]] } as Response); await settle();
    expect(onHistory).not.toHaveBeenCalled(); expect(onTick).not.toHaveBeenCalled();
  });
});
