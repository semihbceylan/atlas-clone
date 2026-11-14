import { TradingTerminal } from "@/components/terminal/trading-terminal";

/**
 * Server Component.
 *
 * The route holds no data fetching and no browser APIs: it simply renders the
 * terminal's single client boundary, which keeps the prerendered HTML stable
 * and lets `TradingTerminal` own every interactive concern.
 */
export default function Home() {
  return <TradingTerminal />;
}
