import type { Metadata } from "next";
import localFont from "next/font/local";
import { ReduxProvider } from "@/components/providers/redux-provider";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/inter-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/inter-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/inter-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/inter-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Terminal Lab — Independent Portfolio Demo",
  description:
    "Independent trading-terminal portfolio study inspired by Midas Atlas. Simulated orders and data by default, with an optional local WebSocket adapter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`h-full ${inter.variable}`}
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
