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

- The user icon opens the Atlas-style account drawer with persistent light-theme and amount-visibility switches, a shortcut to simulated order history, and downloadable local feedback. Funding, transfers, exchange, and logout show explicit demo explanations; no account or money operation is performed. Amount hiding is visual blurring, not a security boundary, and exports still contain their original values.

- Save/load named workspace views from the view selector. Create, rename, switch, and delete persistent watchlists; filter by market and sort by symbol or change.
- Open **Alarmlar** to add local price thresholds and inspect triggered history. Only the selected chart is monitored while the page remains open; these are not brokerage/server alarms.
- Switch between eight chart types, normal/log/percentage scales, grid visibility, and configurable SMA/EMA overlays.
- Save screener presets, set reference-price bounds, toggle the price column, and filter/paginate simulated order history.
- Add **Haberler** to import your own article JSON, search it, and filter by the selected symbol. No live news provider is connected.

See [Atlas feature comparison and remaining gaps](docs/atlas-feature-parity.md) for the precise scope and limitations. This project does **not** implement every Atlas feature.

### Edit existing chart drawings

Click a line or shape (including a shape's interior), or right-click it, to show the compact floating drawing toolbar. Its grip moves the bar; the swatch opens a color palette, the line icon opens thickness/style controls, and the remaining icons open **Çizim özellikleri**, lock/unlock, or delete. Drag in edit mode to move the object or its endpoint handles. Click an empty area or close the properties panel to return to chart navigation.

- Change line color, thickness, solid/dashed/dotted style, and opacity.
- Change shape fill color/opacity and annotation text/font size.
- Use **Koordinatlar** to apply exact Unix-time/price anchors.
- Duplicate, bring forward/send backward, hide/show, lock/unlock, or delete an individual drawing.
- Use **Çizim nesneleri** to select hidden or off-screen objects. Locked objects cannot be dragged, edited, erased, or deleted until unlocked; bulk clear preserves them.
- Delete/Backspace removes an unlocked selection when focus is on the chart. Escape cancels/deselects. Undo/redo covers drawing edits. Appearance and object state persist per symbol alongside the geometry.

- Search instruments with **⌘K / Ctrl+K**, then select a symbol.
- Switch candle intervals and toggle volume or the last-price line.
- Add symbols to the watchlist and select them to update the chart.
- Use **Al / Sat** to create simulated positions; close them from the positions panel.
- Drag panels by their headers on the fine grid, overlap them freely, and resize them from their edges. Clicking or focusing a widget brings it to the front. Layout changes persist locally.
- Resize from any of the four edges or four corners. Each module has its own minimum grid width/height, enforced for both resizing and restored layouts. Dragging has no colored placeholder or shadow.
- Open the workspace menu to restore the default arrangement.
- The workspace stays within the viewport with no canvas/page scrolling, including on narrow screens. Individual widget contents can scroll. Use chart or workspace fullscreen controls for more room.
- Use **Modül ekle** to add/remove the screener, portfolio, simulated order history, and instrument details. New panels appear as overlapping windows inside the workspace.
- Every module has a three-dot menu: export panel text as TXT, restore default size, fill the workspace, duplicate, or remove. Duplicates have independent placement/size and share demo data and symbol selection. Copies persist across reloads (up to 30 total panels).
- Header controls include module icons, local visual color tags, symbol search for watchlist/positions/orders, and compact view. Company-name visibility is available on the watchlist, screener, and details panels. View and color preferences are session-only; colors do not change symbol linking.
- Click a drawing icon to arm its last-used tool; the small arrow shown on hover/focus opens its tool menu. Draw by dragging (click for horizontal/vertical lines and text). The compact lower editing bar contains **Çizimleri düzenle**, the pointer, eraser, undo/redo, and color. Esc returns to chart navigation.
- Try Fibonacci retracements/projections/fans/time zones, a simplified Gann grid/fan, ranges, arrows, shapes, text, and freehand drawing. Toggle repeat-drawing mode, OHLC magnet snapping, visibility, favorites, or color; undo/redo and erase annotations.

Watchlists, positions, and simulated order history reset on reload. Workspace layout, visible modules, and per-symbol drawings are persisted in this browser. Drawing undo/redo history and toolbar preferences are session-only.

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

Only the active instrument streams; unselected crypto watchlist rows show a dash. The screener uses a small local catalogue and explicitly labeled reference prices, not live screening data. Portfolio totals are separated by currency, with inactive positions valued at cost. Simulated position accounting omits fees, slippage, and currency conversion. Order history supports CSV export. The common “Dışarıya al” action exports text rather than opening a detached Atlas window; it does not export chart canvas imagery. Drawing anchors use time/price coordinates and reproject with the chart; trend channels and Gann/Fibonacci tools are simplified two-anchor studies, not a full professional charting engine. Curves/arcs, spirals, pitchforks, Elliott waves, real news, fundamentals, options/derivatives chains, login, real execution, and backend storage are not implemented.

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
npm run test:e2e  # builds and starts an isolated production server on port 3100
# Check the public deployment without starting a local server:
PLAYWRIGHT_BASE_URL=https://atlas-clone-flax.vercel.app npm run test:e2e
```

Development uses `.next-local` while production uses `.next`, keeping test builds separate from the running development server. Generated output is excluded from lint.

GitHub Actions runs typechecking, lint, unit tests, and the production build. Playwright checks are available through the separate browser-test command above. The unit suite contains 43 tests covering market feeds, drawing validation/measurements, module state, simulated fills, layout minimums, watchlists, alerts, and indicators. Eighteen Playwright checks cover public-demo notices and socket behavior, simulated trading and chart controls, fixed mobile layout, drawing persistence/editing/undo, module search/view controls, shared menus, duplicate persistence, all eight resize directions, overlapping placement/stacking/bounds/persistence, saved views, named watchlists, chart types, alarms, and safe news import. Toolbar dimensions are checked against the reference measurements.

## Copyright, attribution, and data rights

Original implementation © 2026 Semih Ceylan. All rights reserved; no project-wide open-source reuse license is granted. Third-party software retains its own licenses. This project claims no rights to Midas designs or trademarks, Coinbase market data, or other third-party material.

TradingView Lightweight Charts™ — Copyright (с) 2025 TradingView, Inc. [TradingView](https://www.tradingview.com/). The chart attribution remains enabled, and the app includes a visible attribution notice and link. Lucide icons and other production dependencies are acknowledged in [third-party notices](public/THIRD-PARTY-NOTICES.txt). Refresh those notices after dependency updates with `node scripts/generate-third-party-notices.mjs`.

See [COPYRIGHT.md](COPYRIGHT.md) for scope and publication precautions. These precautions reduce risk; attribution and disclaimers do not themselves establish permission or guarantee legal clearance.
