import type { Metadata } from "next";
import { ReduxProvider } from "@/components/providers/redux-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terminal Lab — Independent Portfolio Demo",
  description:
    "Independent trading-terminal portfolio study inspired by Midas Atlas. Simulated orders and data by default, with an optional local WebSocket adapter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className="h-full"
    >
      {/*
        The terminal is a single fixed-height surface: the document itself never
        scrolls, only individual widget bodies do.
      */}
      <body className="h-full overflow-hidden">
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
