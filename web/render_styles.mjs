/* Render each style preset through the browser engine and save WAV + PNG.
 * No npm dependencies: uses Chrome DevTools Protocol via the built-in WebSocket.
 *
 * Usage: node web/render_styles.mjs [baseUrl]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.argv[2] || "http://127.0.0.1:8137/";
const PORT = 9334;
const userDataDir = mkdtempSync(join(tmpdir(), "dsh-808-styles-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-breakpad",
  "--disable-crash-reporter", "--disable-dev-shm-usage",
  "--remote-allow-origins=*", "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
  "--window-size=1600,1000", "about:blank"
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}
async function waitChrome() {
  for (let i = 0; i < 100; i++) {
    try { const v = await getJson("/json/version"); if (v.webSocketDebuggerUrl) return; } catch (e) { /* retry */ }
    await sleep(150);
  }
  throw new Error("Chrome did not start");
}
function waitWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error("WS timeout")), 10000);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("WS error")); };
  });
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression, awaitPromise = false) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "eval failed");
    return r.result ? r.result.value : undefined;
  }
}

const out = { styles: [] };
try {
  await waitChrome();
  const target = (await getJson("/json/list")).find((t) => t.type === "page");
  const ws = await waitWs(target.webSocketDebuggerUrl);
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: BASE });
  await sleep(1000);
  for (let i = 0; i < 100; i++) {
    const ready = await cdp.eval("!!(window.__loadStyle && window.__renderDemoWavBase64)", false).catch(() => false);
    if (ready) break;
    await sleep(200);
  }
  const styles = await cdp.eval("JSON.stringify(window.__styles)", false);
  out.stylesAvailable = JSON.parse(styles);
  for (const id of out.stylesAvailable) {
    await cdp.eval(`window.__loadStyle(${JSON.stringify(id)})`, false);
    await sleep(350);
    const meta = await cdp.eval(`JSON.stringify({
      id: ${JSON.stringify(id)},
      lcd: document.querySelector('#lcdStyle .lcd-value').textContent,
      pattern: document.querySelector('#lcdPattern .lcd-value').textContent,
      bpm: document.getElementById('bpmInput').value,
      status: document.getElementById('statusText').textContent,
      active: [...document.querySelectorAll('.step-key')].map((k,i)=>k.classList.contains('active')?i+1:null).filter(Boolean)
    })`, false);
    const row = JSON.parse(meta);
    const b64 = await cdp.eval("window.__renderDemoWavBase64()", true);
    const wavPath = join(process.cwd(), "web", `style-${id}.wav`);
    writeFileSync(wavPath, Buffer.from(b64, "base64"));
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const pngPath = join(process.cwd(), "web", `style-${id}.png`);
    writeFileSync(pngPath, Buffer.from(shot.data, "base64"));
    row.wavBytes = Buffer.from(b64, "base64").length;
    row.wav = `web/style-${id}.wav`;
    row.png = `web/style-${id}.png`;
    out.styles.push(row);
  }
  ws.close();
} catch (e) {
  out.fatal = e.message;
} finally {
  try { chrome.kill(); } catch (e) { /* noop */ }
}
console.log(JSON.stringify(out, null, 2));
