// Usage: node scripts/screenshot.mjs <out.png> [url] [--dark|--light] [--width=1400] [--height=900] [--do="js;;js"] [--hover=<selector>]
// Opens the dev server in headless Chromium, runs optional JS steps (";;"-separated, each may return a promise), and saves a screenshot.
import { chromium } from "playwright";

const args = process.argv.slice(2);
const out = args[0] ?? "screenshot.png";
const url = args.find((a) => a.startsWith("http")) ?? "http://localhost:2174";
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const width = Number(flag("width", 1400));
const height = Number(flag("height", 900));
const colorScheme = args.includes("--light") ? "light" : "dark";
const steps = flag("do", "").split(";;").filter(Boolean);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, colorScheme });
page.on("dialog", (d) => d.accept("chapter.ink"));
await page.goto(url, { waitUntil: "networkidle" });
for (const step of steps) {
  const result = await page.evaluate(step);
  if (result !== undefined) console.log(result);
  await page.waitForTimeout(500);
}
const hover = flag("hover", "");
if (hover) { await page.hover(hover); await page.waitForTimeout(300); }
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
