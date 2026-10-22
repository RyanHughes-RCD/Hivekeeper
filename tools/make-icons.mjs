// Renders the app icons from the game's own art: node tools/make-icons.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const server = await serve(8099);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8099/tools/icon.html');
await page.waitForFunction(() => window.ready);
const out = [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0], ['icon-maskable-512.png', 512, 0.1]];
for (const [name, size, pad] of out) {
  const url = await page.evaluate(([s, p]) => window.makeIcon(s, p), [size, pad]);
  fs.writeFileSync(new URL(`../icons/${name}`, import.meta.url), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
server.close();
