/**
 * Скриншот сторінки локального дев-сервера через CDP.
 *
 * node scripts/screenshot.mjs <файл.png> <ширина> <висота> <url> [mobile]
 *
 * Чому не `chrome --headless --screenshot`: там ширина вікна НЕ стає layout
 * viewport — сторінка рендериться ширшою (~700px) і знімок обрізається
 * праворуч, тож мобільний вигляд перевірити неможливо. Плюс Chrome після
 * запису файлу не виходить і висить, аж поки його не вбити.
 *
 * Тут ширину задає Emulation.setDeviceMetricsOverride, а captureBeyondViewport
 * знімає сторінку на всю висоту. Знімок виходить у 2× (deviceScaleFactor), тож
 * перед читанням його варто зменшити — інакше не пройде ліміт API.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [,, out, wArg, hArg, url, mobileArg] = process.argv;
const width = +wArg, height = +hArg, mobile = mobileArg === 'mobile';
const profile = `${process.env.TMPDIR || '/tmp'}/dityam-cdp-profile`;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9222', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  try {
    const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
    target = list.find((t) => t.type === 'page');
    if (target) break;
  } catch {}
}
if (!target) { chrome.kill(); throw new Error('no CDP target'); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const myId = ++id;
  pending.set(myId, res);
  ws.send(JSON.stringify({ id: myId, method, params }));
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: 2, mobile,
  screenWidth: width, screenHeight: height,
});
await send('Page.navigate', { url });
await sleep(4500);
const { result } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync(out, Buffer.from(result.data, 'base64'));
console.log('saved', out);
ws.close();
chrome.kill();
process.exit(0);
