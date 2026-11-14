import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
const notice = "TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/";
const sections = [
  "THIRD-PARTY SOFTWARE NOTICES",
  "This file preserves notices and license texts found in installed production dependencies. Optional platform packages absent from this installation are listed by package and declared license. Package distributions remain the authoritative source for their full notices; refresh this file after dependency updates.",
  notice,
];
for (const [directory, metadata] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!directory || metadata.dev) continue;
  const name = directory.split("node_modules/").at(-1);
  const base = resolve(root, directory);
  sections.push(`\n${"=".repeat(72)}\n${name}@${metadata.version}\nDeclared license: ${metadata.license ?? "See package distribution"}\nhttps://www.npmjs.com/package/${name}/v/${metadata.version}`);
  if (!existsSync(base)) { sections.push("Optional package not installed on this platform; consult its distribution for notices."); continue; }
  const files = readdirSync(base).filter(name => /^(licen[cs]e|copying|notice)(\.(txt|md))?$/i.test(name));
  for (const filename of files) sections.push(`\n--- ${filename} ---\n${readFileSync(resolve(base, filename), "utf8")}`);
  if (!files.length) sections.push("No root-level license file in this installed package; consult its distribution.");
}
writeFileSync(resolve(root, "public/THIRD-PARTY-NOTICES.txt"), sections.join("\n\n").replace(/\r\n/g, "\n").split("\n").map(line => line.trimEnd()).join("\n").trimEnd() + "\n");
console.log("Updated public/THIRD-PARTY-NOTICES.txt from package-lock.json and installed dependencies.");
