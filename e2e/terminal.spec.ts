import { expect, test } from "@playwright/test";

test("public demo renders charts, notices, and simulated data without live sockets", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", socket => sockets.push(socket.url()));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Terminal Lab — Independent Portfolio Demo");
  await expect(page.getByText("Simüle veri", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fiyat grafiği" }).locator("canvas").first()).toBeVisible();
  await expect(page.getByText(/Not affiliated with Midas/)).toBeVisible();
  await expect(page.getByRole("link", { name: /TradingView Lightweight Charts/ })).toHaveAttribute("href", "https://www.tradingview.com/");
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true });
  expect(errors).toEqual([]);
  expect(sockets).toEqual([]);
});

test("simulated orders close and symbol selection updates the chart", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Simüle veri", { exact: true })).toBeVisible();
  const chart = page.getByRole("region", { name: "Fiyat grafiği" });
  const positions = page.getByRole("region", { name: "Pozisyonlar" });
  await chart.getByRole("button", { name: "Al", exact: true }).click();
  await expect(positions.getByText("1 pozisyon · Demo")).toBeVisible();
  await positions.getByRole("button", { name: "BTC pozisyonunu kapat" }).click();
  await expect(positions.getByText("Yatırım pozisyonun bulunmuyor")).toBeVisible();
  await page.getByRole("button", { name: "Arama", exact: true }).click();
  await page.getByRole("dialog", { name: "Sembol ara" }).getByRole("button", { name: /ETH.*Ethereum/ }).click();
  await expect(chart.getByRole("button", { name: /ETH/ }).first()).toBeVisible();
  await chart.getByRole("button", { name: "15dk", exact: true }).click();
  await expect(chart.getByRole("button", { name: "15dk", exact: true })).toHaveAttribute("aria-pressed", "true");
  await chart.getByRole("button", { name: "İndikatörler", exact: true }).click();
  await chart.getByRole("checkbox", { name: "Hacim", exact: true }).uncheck();
  await expect(chart.getByRole("checkbox", { name: "Hacim", exact: true })).not.toBeChecked();
});

test("mobile layout stacks panels and stays within the viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Simüle veri", { exact: true })).toBeVisible();
  // Grid panels animate from their initial measured layout after hydration.
  await expect.poll(async () => {
    const chart = await page.getByRole("region", { name: "Fiyat grafiği" }).boundingBox();
    const positions = await page.getByRole("region", { name: "Pozisyonlar" }).boundingBox();
    return Boolean(chart && positions && chart.width <= 390 && Math.abs(chart.x - positions.x) < 2 && positions.y >= chart.y + chart.height);
  }, { message: "mobile panels should settle into full-width stacked rows" }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
});
