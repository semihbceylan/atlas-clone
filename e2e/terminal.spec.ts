import { expect, test } from "@playwright/test";

test("named watchlists persist independently and chart modes switch without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const list = page.getByRole("region", { name: "Takip Ettiklerim", exact: true });
  await list.focus();
  await list.getByRole("textbox", { name: "Takip listesi adı", exact: true }).fill("Kripto listem");
  await list.getByRole("button", { name: "Yeni liste", exact: true }).click();
  await expect(list.getByLabel("Takip listesi seç", { exact: true })).not.toHaveValue("default");
  await list.getByRole("button", { name: "Sembol ekle", exact: true }).first().click();
  await page.getByRole("menuitem").filter({ hasText: "BTC" }).click();
  await list.getByLabel("Takip listesi seç", { exact: true }).selectOption("default");
  await expect(list.getByText("Henüz varlık eklenmedi")).toBeVisible();
  await page.reload();
  await list.focus();
  await list.getByLabel("Takip listesi seç", { exact: true }).selectOption({ label: "Kripto listem" });
  await expect(list.locator('[data-search-symbol^="BTC"]')).toBeVisible();
  const chart = page.getByRole("region", { name: "Fiyat grafiği", exact: true });
  await chart.focus();
  for (const type of ["line", "area", "bars", "hollow", "heikin", "baseline", "histogram", "candles"]) await chart.getByLabel("Grafik tipi", { exact: true }).selectOption(type);
  await chart.getByLabel("Fiyat ölçeği", { exact: true }).selectOption("log");
  await chart.getByLabel("Hareketli ortalama", { exact: true }).selectOption("ema");
  await chart.getByLabel("Ortalama periyodu", { exact: true }).fill("10");
  await expect(chart.locator("canvas").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("local alarms trigger, retain history and persist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Alarmlar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Alarmlar", exact: true });
  await dialog.getByLabel("Alarm varlığı", { exact: true }).selectOption("BTC");
  await dialog.getByLabel("Alarm fiyatı", { exact: true }).fill("1");
  await dialog.getByRole("button", { name: "Alarm ekle", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Demo alarmı: BTC" })).toBeVisible();
  await dialog.getByRole("button", { name: "Geçmiş", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Yeniden kur", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Alarmlar", exact: true }).click();
  await dialog.getByRole("button", { name: "Geçmiş", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Yeniden kur", exact: true })).toBeVisible();
});

test("saved views restore modules and news accepts safe imported articles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Modül ekle", exact: true }).click();
  await page.getByRole("button", { name: "Haberler Ekle", exact: true }).click();
  await page.keyboard.press("Escape");
  const news = page.getByRole("region", { name: "Haberler", exact: true });
  await news.focus();
  await news.getByLabel("Haber dosyası", { exact: true }).setInputFiles({ name: "news.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify([{ title: "Imported article", source: "Local test", url: "https://example.com/article", publishedAt: "2026-11-15T12:00:00Z", symbols: ["BTC"] }])) });
  await expect(news.getByRole("link", { name: "Imported article ↗" })).toBeVisible();
  await news.getByLabel("Haber dosyası", { exact: true }).setInputFiles({ name: "unsafe.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify([{ title: "Unsafe", source: "Local test", url: "javascript:alert(1)", publishedAt: "2026-11-15T12:00:00Z", symbols: [] }])) });
  await expect(news.getByRole("alert")).toHaveText("Haber bağlantıları HTTPS olmalı.");
  await expect(news.getByRole("link", { name: "Unsafe ↗" })).toHaveCount(0);
  await page.getByRole("button", { name: "1 İlk görünüm", exact: true }).click();
  await page.getByRole("textbox", { name: "Görünüm adı", exact: true }).fill("Haber görünümü");
  await page.getByRole("button", { name: "Görünümü kaydet", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Modül ekle", exact: true }).click();
  await page.getByRole("button", { name: "Haberler Kaldır", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(news).toHaveCount(0);
  await page.getByRole("button", { name: "1 Haber görünümü", exact: true }).click();
  await page.getByRole("button", { name: "Haber görünümü", exact: true }).click();
  await expect(news).toBeVisible();
});

test("public demo renders charts, notices, and simulated data without live sockets", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", socket => {
    // An existing local dev server uses Next.js HMR; it is not a market feed.
    const url = new URL(socket.url());
    if (url.hostname === new URL(page.url()).hostname && url.pathname === "/_next/hmr") return;
    sockets.push(socket.url());
  });
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

test("mobile workspace stays fixed within the viewport without scrolling", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Simüle veri", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const chart = await page.getByRole("region", { name: "Fiyat grafiği" }).boundingBox();
    const positions = await page.getByRole("region", { name: "Pozisyonlar" }).boundingBox();
    return Boolean(chart && positions && chart.width <= 390 && positions.x >= chart.x + chart.width - 3 && positions.y + positions.height <= 844);
  }, { message: "mobile panels should stay inside the fixed canvas" }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const workspace = page.getByTestId("workspace");
  await workspace.hover();
  await page.mouse.wheel(0, 600);
  expect(await workspace.evaluate(el => el.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
});

test("drawing properties, locking, duplication, visibility, coordinates and deletion persist", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Şekiller seçenekleri", exact: true }).click();
  await page.getByRole("button", { name: "Dikdörtgen", exact: true }).click();
  const canvas = page.getByTestId("drawing-canvas");
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * 0.25, y = box.y + box.height * 0.3;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 110, y + 70, { steps: 8 }); await page.mouse.up();
  const properties = page.getByRole("dialog", { name: "Çizim özellikleri", exact: true });
  await properties.getByLabel("Seçili çizimin rengi", { exact: true }).fill("#ff0000");
  await properties.getByLabel("Çizgi kalınlığı", { exact: true }).selectOption("4");
  await properties.getByLabel("Çizgi stili", { exact: true }).selectOption("dashed");
  await properties.getByLabel("Dolgu rengi", { exact: true }).fill("#00ff00");
  await properties.getByRole("button", { name: "Kapat", exact: true }).click();
  // Normal cursor selects a shape by clicking its interior, with no edit-tool prerequisite.
  await page.mouse.click(x + 45, y + 35);
  await expect(properties).toBeVisible();
  await properties.getByRole("button", { name: "Kilitle", exact: true }).click();
  await expect(properties.getByRole("button", { name: "Seçileni sil", exact: true })).toBeDisabled();
  await expect(properties.getByLabel("Seçili çizimin rengi", { exact: true })).toBeDisabled();
  await properties.getByRole("button", { name: "Kilidi aç", exact: true }).click();
  await properties.getByRole("tab", { name: "Koordinatlar", exact: true }).click();
  await properties.getByLabel("Nokta 1 fiyatı", { exact: true }).fill("12345");
  await properties.getByRole("button", { name: "Nokta 1 uygula", exact: true }).click();
  await properties.getByRole("button", { name: "Çizimi çoğalt", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 çizim");
  await properties.getByRole("button", { name: "Çizimi gizle", exact: true }).click();
  await expect(properties.getByRole("button", { name: "Çizimi göster", exact: true })).toBeVisible();
  await properties.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Çizim nesneleri (2)", exact: true }).click();
  await page.getByRole("region", { name: "Çizim nesneleri", exact: true }).getByRole("button", { name: /2\. Dikdörtgen/ }).click();
  await expect(properties.getByLabel("Seçili çizimin rengi", { exact: true })).toHaveValue("#ff0000");
  await expect(properties.getByLabel("Çizgi kalınlığı", { exact: true })).toHaveValue("4");
  await expect(properties.getByLabel("Çizgi stili", { exact: true })).toHaveValue("dashed");
  await expect(properties.getByLabel("Dolgu rengi", { exact: true })).toHaveValue("#00ff00");
  await properties.getByRole("button", { name: "Seçileni sil", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 çizim");
  await page.getByRole("button", { name: "Çizimi geri al", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 çizim");
});

test("drawings persist, undo/redo, edit, and isolate by symbol", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Çizgiler seçenekleri", exact: true }).click();
  await page.getByRole("button", { name: "Trend çizgisi", exact: true }).click();
  const canvas = page.getByTestId("drawing-canvas");
  await expect(page.locator(".drawing-rail")).toHaveCSS("width", "44px");
  await expect(page.getByRole("button", { name: "Çizgiler", exact: true })).toHaveCSS("width", "24px");
  await expect(page.getByRole("button", { name: "Çizim modu", exact: true })).toHaveCSS("height", "24px");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.3, y = box!.y + box!.height * 0.3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 140, y + 60, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText("1 çizim");
  await page.getByRole("button", { name: "Çizimi geri al", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("0 çizim");
  await page.getByRole("button", { name: "Çizimi yinele", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 çizim");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("1 çizim");
  await page.getByRole("button", { name: "Çizimleri gizle", exact: true }).click();
  await expect(page.getByRole("button", { name: "Çizimleri göster", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Çizimleri göster", exact: true }).click();
  await page.getByRole("button", { name: "Çizimleri düzenle", exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Seçileni sil", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Arama", exact: true }).click();
  await page.getByRole("dialog", { name: "Sembol ara" }).getByRole("button", { name: /ETH.*Ethereum/ }).click();
  await expect(page.getByRole("status")).toContainText("0 çizim");
});

test("local modules add/remove, filter, track symbols and display simulated fills", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Modül ekle", exact: true }).click();
  for (const name of ["Hisse tarayıcı Ekle", "Portföy Ekle", "Emir geçmişi Ekle", "Varlık detayı Ekle"]) await page.getByRole("button", { name, exact: true }).click();
  await page.keyboard.press("Escape");
  const screener = page.getByRole("region", { name: "Hisse tarayıcı", exact: true });
  await screener.focus();
  await screener.getByRole("textbox", { name: "Tarayıcıda ara" }).fill("ASTOR");
  await expect(screener.getByRole("row")).toHaveCount(2);
  await screener.getByRole("button", { name: "ASTOR Astor Enerji" }).click();
  await screener.getByRole("button", { name: "+ Ekle", exact: true }).click();
  await expect(screener.getByRole("button", { name: "Eklendi", exact: true })).toBeDisabled();
  await screener.getByRole("button", { name: "Hisse tarayıcı görünüm", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: /Şirket adlarını göster/ }).click();
  await expect(screener.locator("[data-company-name]")).toBeHidden();
  await page.keyboard.press("Escape");
  const chart = page.getByRole("region", { name: "Fiyat grafiği", exact: true });
  await chart.focus();
  await chart.getByRole("button", { name: "Al", exact: true }).click();
  await page.getByRole("region", { name: "Emir geçmişi", exact: true }).focus();
  await expect(page.getByRole("region", { name: "Emir geçmişi", exact: true }).getByRole("cell", { name: "Alış", exact: true })).toBeVisible();
  const orders = page.getByRole("region", { name: "Emir geçmişi", exact: true });
  await orders.getByRole("button", { name: "Emir geçmişi ara", exact: true }).click();
  await orders.getByRole("textbox", { name: "Emir geçmişi içinde ara" }).fill("BTC");
  await expect(orders.locator("tbody tr")).toBeHidden();
  await orders.getByRole("button", { name: "Emir geçmişi ara", exact: true }).click();
  await expect(orders.locator("tbody tr")).toBeVisible();
  await orders.getByRole("button", { name: "Emir geçmişi görünüm", exact: true }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: /Şirket adlarını göster/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Portföy", exact: true })).toContainText("TRY · 1 pozisyon");
  await expect(page.getByRole("region", { name: "Varlık detayı", exact: true })).toContainText("Astor Enerji");
  await page.reload();
  await expect(screener).toBeVisible();
  await page.getByRole("button", { name: "Modül ekle", exact: true }).click();
  await page.getByRole("button", { name: "Hisse tarayıcı Kaldır", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(screener).toHaveCount(0);
});

test("widgets overlap without pushing neighbors, raise on interaction, persist, and stay bounded", async ({ page }) => {
  await page.goto("/");
  // Measure snapped positions, not intermediate CSS transition frames.
  await page.addStyleTag({ content: ".react-grid-item { transition: none !important; }" });
  const positions = page.locator('[data-widget-id="positions"]');
  const chart = page.locator('[data-widget-id="chart"]');
  const before = await chart.boundingBox();
  const box = await positions.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 50, box!.y + 20);
  await page.mouse.down();
  await page.mouse.move(box!.x - 300, box!.y + 100, { steps: 15 });
  await expect(page.locator(".react-grid-placeholder")).toHaveCSS("opacity", "0");
  await expect(positions.locator(".widget-frame")).toHaveCSS("box-shadow", "none");
  await page.mouse.up();
  await expect.poll(async () => (await positions.boundingBox())!.x).toBeLessThan(box!.x - 150);
  const after = await chart.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  expect(await positions.evaluate(el => +getComputedStyle(el).zIndex)).toBeGreaterThan(await chart.evaluate(el => +getComputedStyle(el).zIndex));
  await page.getByRole("region", { name: "Fiyat grafiği" }).click({ position: { x: 65, y: 250 } });
  expect(await chart.evaluate(el => +getComputedStyle(el).zIndex)).toBeGreaterThan(await positions.evaluate(el => +getComputedStyle(el).zIndex));
  const moved = await positions.boundingBox();
  await page.reload();
  await expect.poll(async () => Math.abs((await positions.boundingBox())!.x - moved!.x)).toBeLessThan(2);
  await page.getByRole("region", { name: "Pozisyonlar", exact: true }).focus();
  const current = await positions.boundingBox();
  await page.mouse.move(current!.x + 40, current!.y + 20);
  await page.mouse.down();
  await page.mouse.move(1800, 1600, { steps: 15 });
  await page.mouse.up();
  const workspace = await page.getByTestId("workspace").boundingBox();
  await expect.poll(async () => {
    const rect = await positions.boundingBox();
    return rect!.y + rect!.height <= workspace!.y + workspace!.height + 2 && rect!.x + rect!.width <= workspace!.x + workspace!.width + 2;
  }).toBe(true);
  expect(await page.getByTestId("workspace").evaluate(el => el.scrollTop)).toBe(0);
});

for (const direction of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
  test(`widget resizes from ${direction} and respects its minimum grid size`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("terminal-lab.modules.v1", JSON.stringify(["positions"]));
      localStorage.setItem("atlas-terminal.layout.v2", JSON.stringify([{ i: "positions", x: 12, y: 6, w: 24, h: 12 }]));
    });
    await page.goto("/");
    await page.addStyleTag({ content: ".react-grid-item { transition: none !important; }" });
    const widget = page.locator('[data-widget-id="positions"]');
    const handle = widget.locator(`.react-resizable-handle-${direction}`);
    await expect(widget.locator(".react-resizable-handle")).toHaveCount(8);
    const before = (await widget.boundingBox())!;
    const grip = (await handle.boundingBox())!;
    const x = grip.x + grip.width / 2, y = grip.y + grip.height / 2;
    const dx = direction.includes("w") ? 800 : direction.includes("e") ? -800 : 0;
    const dy = direction.includes("n") ? 800 : direction.includes("s") ? -800 : 0;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 15 });
    await page.mouse.up();
    await expect.poll(async () => {
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("atlas-terminal.layout.v2") ?? "[]"));
      return saved[0] && (!dx || saved[0].w === 10) && (!dy || saved[0].h === 6);
    }).toBeTruthy();
    const after = (await widget.boundingBox())!;
    if (dx) expect(after.width).toBeLessThan(before.width);
    if (dy) expect(after.height).toBeLessThan(before.height);
    if (direction.includes("w")) expect(Math.abs(after.x + after.width - before.x - before.width)).toBeLessThan(2);
    if (direction.includes("n")) expect(Math.abs(after.y + after.height - before.y - before.height)).toBeLessThan(2);
  });
}

test("every module has a working options menu with duplicate, expand, reset, export, and remove", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Modül ekle", exact: true }).click();
  for (const name of ["Hisse tarayıcı Ekle", "Portföy Ekle", "Emir geçmişi Ekle", "Varlık detayı Ekle"]) await page.getByRole("button", { name, exact: true }).click();
  await page.keyboard.press("Escape");
  for (const label of ["Grafik", "Pozisyonlar", "Takip Ettiklerim", "Hisse tarayıcı", "Portföy", "Emir geçmişi", "Varlık detayı"]) {
    const trigger = page.getByRole("button", { name: `${label} seçenekleri`, exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: `${label} seçenekleri`, exact: true });
    await expect(menu.getByRole("menuitem")).toHaveCount(5);
    await page.keyboard.press("Escape");
  }
  const positions = page.locator('[data-widget-id="positions"]');
  const options = async () => { await positions.getByRole("button", { name: "Pozisyonlar seçenekleri", exact: true }).focus(); await page.keyboard.press("Enter"); };
  await options();
  await page.getByRole("menuitem", { name: "Çoğalt", exact: true }).click();
  const copy = page.locator('[data-widget-id^="positions:"]');
  await expect(copy).toHaveCount(1);
  await page.reload();
  await expect(copy).toHaveCount(1);
  await copy.getByRole("button", { name: "Pozisyonlar seçenekleri", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Modülü kaldır", exact: true }).click();
  await expect(copy).toHaveCount(0);
  await options();
  await page.getByRole("menuitem", { name: "Tüm alana yay", exact: true }).click();
  await expect.poll(async () => {
    const widget = await positions.boundingBox(); const workspace = await page.getByTestId("workspace").boundingBox();
    return Math.abs(widget!.width - workspace!.width) < 4 && Math.abs(widget!.height - workspace!.height) < 4;
  }).toBe(true);
  await options();
  await page.getByRole("menuitem", { name: "Varsayılan boyut", exact: true }).click();
  await options();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Dışarıya al/ }).click();
  expect((await download).suggestedFilename()).toBe("positions-demo.txt");
  await positions.getByRole("button", { name: "Pozisyonlar görünüm", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: /Kompakt görünüm/ }).click();
  await expect(positions.locator("section")).toHaveAttribute("data-compact", "true");
});
