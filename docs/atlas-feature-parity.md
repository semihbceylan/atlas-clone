# Atlas comparison and remaining gaps

This is an independent frontend study, not a complete implementation of Midas Atlas. The comparison used the connected Atlas dashboard and the local clone. An accessible control is evidence of a feature, not evidence that every workflow behind it has been audited.

## Implemented in this pass

| Observed Atlas feature | Local implementation | Limits |
| --- | --- | --- |
| Views | Name, save, update by name, load, and delete workspace snapshots | Stores panel geometry, enabled modules, and copies. Loading reloads the page and clears session-only trading state. Does not snapshot chart/view preferences. Up to 20 saved views. |
| Watchlist selection and management | Create, select, rename, delete, market filter, symbol/change sorting | Lists persist locally; duplicated watchlist panels share the active list. Up to 20 lists; final list cannot be deleted. |
| Alarms | Symbol/threshold/direction, active/history search, rearm, delete | Only the selected symbol is evaluated while the page is open. Uses the same demo or opt-in market feed as the chart. No server monitoring or system push. Up to 100 alarms. |
| Chart types | Candles, bars, hollow candles, Heikin Ashi, line, area, baseline, histogram | Drawings, OHLC readout, and simulated fills retain raw market prices even in transformed Heikin Ashi mode. Baseline uses the first available close. |
| Chart scales/settings | Normal, logarithmic, percentage; grid visibility | Settings are session-only. |
| Technical indicators | SMA/EMA with configurable period; existing volume and last-price toggles | Period 2–200; no invented values before sufficient history. Not Atlas's full indicator library. |
| Screener filters and saved screens | Market/text/price bounds, price column visibility, locally saved presets | Small local catalogue/reference prices only. Price bounds compare each instrument's native currency; select a market before comparing. No fundamentals or market-cap filters without a data source. |
| Order history | Direction/date filters, status/total columns, page size/pagination, existing search/CSV | Simulated immediate fills only. Date filter uses UTC. CSV exports all session orders, not just the current filtered page. |
| News | Search, symbol filter, safe HTTPS links, validated JSON import | No live feed, copied headlines, or fabricated articles. Imported articles are session-only. |

## Still missing or partial

Existing drawings now support direct selection, property editing, line/fill appearance, text/font size, exact anchors, object listing, per-object visibility and locking, duplication, layer order, deletion, and undo/redo. This is a local editing implementation, not a claim that every tool-specific Atlas setting is reproduced.

- True widget symbol-link groups and independent chart/data scopes. Color dots remain visual tags.
- Detached interactive windows. The existing `Dışarıya al` exports TXT instead.
- Scatter/trend chart types, full chart settings, date navigation, historical range shortcuts, the complete indicator library, and advanced drawing studies.
- Full per-panel column selection, reordering, resizing, sorting, and saved preferences.
- Screener sectors, indices, market capitalization, P/E, P/B, relative performance, volume filters, refresh scheduling, and full market coverage.
- Rich instrument profiles, financial statements, corporate actions, real statistics, staking information, and live news.
- Pending/limit/stop orders, cancellation/editing, full order tickets, fees, settlement, and real brokerage execution.
- Account/authentication, Midas support, cloud-synced views/preferences, server alarms, and push notifications.
- Full keyboard/focus trapping for the alarms drawer and complete visual parity across all reference screens.

Some remaining features can be implemented locally in a later pass; others require authorized data providers or brokerage services. This list deliberately avoids claiming complete parity.

## Persistence

Layouts, copies, enabled modules, named views, watchlists, screener presets, alarms, and per-symbol drawings use browser localStorage. Trading positions/orders, chart appearance, imported news, and module view/color preferences remain session-only. Browser storage is best-effort and is not an account-backed backup.
