/**
 * Takes the README screenshots from the demo page: `npm run screenshots`.
 * Needs a local Chrome or Chromium; set CHROME to its path if it is not in the usual place.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".svg": "image/svg+xml" };

const CHROME = process.env.CHROME || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].find(existsSync);
if (!CHROME) throw new Error("No Chrome found: set CHROME=/path/to/chrome");

/** The demo imports the card and @mdi/js as ES modules, which file:// URLs do not allow. */
export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(ROOT)) return res.writeHead(403).end();
    const file = path.endsWith("/") ? join(path, "index.html") : path;
    let body;
    try {
      body = await readFile(file);
    } catch {
      return res.writeHead(404).end();
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

const SHOTS = [
  { file: "screenshot.jpg", query: "theme=dark&layout=hero&width=1040", viewport: { width: 1072, height: 900 }, card: true },
  { file: "grid.jpg", query: "theme=light&layout=grid&width=1040", viewport: { width: 1072, height: 900 }, card: true },
  { file: "mobile.jpg", query: "theme=dark&layout=hero&width=420", viewport: { width: 390, height: 844, isMobile: true, hasTouch: true }, scale: 2 },
  {
    file: "lightbox.jpg",
    query: "theme=dark&layout=hero&width=420",
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
    scale: 2,
    // The first alarm, zoomed on the person by the window.
    after: "window.__box = window.__card._open(0, 0); await new Promise(r => setTimeout(r, 400)); window.__box.zoom(2.2, { x: 10, y: 40 });"
  },
  { file: "italian.jpg", query: "theme=light&layout=hero&width=1040&lang=it", viewport: { width: 1072, height: 900 }, card: true }
];

const run = async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/demo/`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
  try {
    for (const s of SHOTS) {
      const page = await browser.newPage();
      await page.setViewport({ deviceScaleFactor: s.scale || 1.5, ...s.viewport });
      page.on("pageerror", (e) => console.error(`[${s.file}]`, e.message));
      await page.goto(`${base}?${s.query}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => window.__card?.shadowRoot?.querySelectorAll("img").length > 0);
      await page.evaluate(() => Promise.all([...window.__card.shadowRoot.querySelectorAll("img")].map((i) => i.decode().catch(() => {}))));
      if (s.after) await page.evaluate(`(async () => { ${s.after} })()`);
      await new Promise((r) => setTimeout(r, 500));
      const out = join(ROOT, "docs", s.file);
      if (s.card) await (await page.$("alarm-board-card")).screenshot({ path: out, type: "jpeg", quality: 86 });
      else await page.screenshot({ path: out, type: "jpeg", quality: 86 });
      console.log("wrote", out);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
