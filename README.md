# atlas-clone · Terminal Lab

An independent frontend portfolio study inspired by [Midas Atlas](https://atlas.getmidas.com/), built by [Semih Ceylan](https://github.com/semihbceylan). The project explores streaming chart architecture, trading-terminal interaction design, and responsive widget layouts.

**This is not an official Midas product. It is not affiliated with, endorsed by, or sponsored by Midas.** The app uses neutral Terminal Lab branding. Midas and Atlas are referenced only to acknowledge the design inspiration. No Midas application source, logos, reference screenshots, proprietary fonts, account information, or customer data are included.

[Live portfolio demo](https://atlas-clone-flax.vercel.app/) · [GitHub repository](https://github.com/semihbceylan/atlas-clone)

All orders are simulated. The default demo generates its prices locally and does not connect to a brokerage or require credentials.

## Run locally

Requires Node.js 22 or later and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. The default mode works without an API key or environment configuration.

## What to try

- Search instruments with **⌘K / Ctrl+K**, then select a symbol.
- Switch candle intervals and toggle volume or the last-price line.
- Add symbols to the watchlist and select them to update the chart.
- Use **Al / Sat** to create simulated positions; close them from the positions panel.
- Drag desktop panels by their headers and resize them from their edges. Layout changes persist locally.
- Open the workspace menu to restore the default arrangement.
- Narrow the window to stack the panels; use chart or workspace fullscreen controls.

Watchlists and positions reset on reload. Only the workspace layout is persisted.

## WebSocket integration

The repository includes a real Coinbase Exchange WebSocket adapter for BTC/USD, ETH/USD, and SOL/USD. It was exercised against live market messages during development. It is **disabled by default** for the public portfolio demo because public API access does not by itself grant permission to redistribute market data.

For personal/local evaluation, review [Coinbase's Market Data Terms](https://www.coinbase.com/legal/market_data), then opt in:

```bash
cp .env.example .env.local
# Change NEXT_PUBLIC_ENABLE_COINBASE_LIVE_DATA to true in .env.local.
npm run dev
```

Restart the dev server after changing the setting. `NEXT_PUBLIC_` values are embedded at build time; rebuild production output after changing them. Do not enable live data on a public deployment without the necessary data rights. The flag is configuration, not a secret.

The adapter uses public `ticker` and `heartbeat` channels, validates and deduplicates messages, loads completed REST candles before flushing buffered ticks, detects stalled sockets, and reconnects with exponential backoff and jitter. Switching instruments or intervals closes sockets, aborts requests, and clears timers. A failed history request leaves the chart building from real incoming trades; the live path does not fabricate a fallback price series.

Live mode is visibly labeled **Coinbase · Canlı**. Connection failures and reconnects have separate states. BIST symbols always use simulated data. The ticker channel batches matches, so the open candle's observed volume is indicative; completed candles use exchange OHLCV. The active candle starts from ticks observed after connection.

## Architecture and tradeoffs

| Concern | Implementation |
| --- | --- |
| App | Next.js 16 App Router, React 19, strict TypeScript |
| Styling | Tailwind CSS v4, shared theme tokens, system fonts |
| Charts | TradingView Lightweight Charts v5, incremental canvas updates |
| Workspace | React Grid Layout v2, validated localStorage layout persistence |
| UI state | Redux Toolkit for instruments, intervals, positions, watchlist, and preferences |
| Market state | An imperative candle controller with frame-coalesced updates and throttled price subscriptions |
| Tests | Vitest for aggregation, message validation, buffering, retries, and cleanup |

High-frequency market ticks bypass Redux. A shared controller aggregates them into candles, updates chart subscribers, and exposes price snapshots through `useSyncExternalStore`. Symbol and interval changes own separate subscription lifecycles. Crypto history starts empty in live mode, so generated candles cannot be mistaken for exchange data.

Key implementation files:

- [WebSocket adapter](src/lib/market/create-coinbase-feed.ts)
- [Candle aggregation](src/lib/market/candle-aggregator.ts)
- [Market lifecycle and subscriptions](src/hooks/use-live-candles.ts)
- [Responsive, persistent dashboard](src/components/terminal/dashboard-grid.tsx)
- [WebSocket tests](src/lib/market/create-coinbase-feed.test.ts)

Drawing-tool selection is demonstrated, but annotation drawing is not implemented. Only the active instrument streams; unselected crypto watchlist rows show a dash. Simulated position accounting omits fees, slippage, and currency conversion. There is no login, real order execution, or backend account storage. The module menu lists the three implemented modules rather than creating additional widget instances.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Browser checks with Playwright (Chromium):

```bash
npx playwright install chromium
npm run test:e2e  # starts a local production build when no server is running
# Check the public deployment without starting a local server:
PLAYWRIGHT_BASE_URL=https://atlas-clone-flax.vercel.app npm run test:e2e
```

GitHub Actions runs typechecking, lint, market tests, and the production build. Playwright checks are available through the separate browser-test command above. The market suite contains 20 tests. Three Playwright checks cover public-demo notices and socket behavior, simulated trading and chart controls, and mobile layout. Browser checks covered simulated orders, symbol changes, interval changes, indicators, connection status, and viewport overflow.

## Copyright, attribution, and data rights

Original implementation © 2026 Semih Ceylan. All rights reserved; no project-wide open-source reuse license is granted. Third-party software retains its own licenses. This project claims no rights to Midas designs or trademarks, Coinbase market data, or other third-party material.

TradingView Lightweight Charts™ — Copyright (с) 2025 TradingView, Inc. [TradingView](https://www.tradingview.com/). The chart attribution remains enabled, and the app includes a visible attribution notice and link. Lucide icons and other production dependencies are acknowledged in [third-party notices](public/THIRD-PARTY-NOTICES.txt). Refresh those notices after dependency updates with `node scripts/generate-third-party-notices.mjs`.

See [COPYRIGHT.md](COPYRIGHT.md) for scope and publication precautions. These precautions reduce risk; attribution and disclaimers do not themselves establish permission or guarantee legal clearance.
