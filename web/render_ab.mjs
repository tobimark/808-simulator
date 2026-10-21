/* Render A/B comparisons for hats, cymbal and toms through the browser engine.
 * No npm dependencies: uses Chrome DevTools Protocol via Node's built-in WebSocket.
 *
 * Usage: node web/render_ab.mjs [baseUrl]
 * Outputs: web/ab-*.wav
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.argv[2] || "http://127.0.0.1:8137/";
const PORT = 9335;
const userDataDir = mkdtempSync(join(tmpdir(), "dsh-808-ab-"));
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

const CHANNELS = ["BD", "SD", "LT", "MT", "HT", "RS", "CP", "CB", "CY", "OH", "CH"];
function emptyPattern() {
  const p = { accent: new Array(16).fill(0) };
  CHANNELS.forEach((id) => { p[id] = new Array(16).fill(0); });
  return p;
}
function patternFromSpec(spec) {
  const p = emptyPattern();
  Object.keys(spec).forEach((key) => {
    if (key === "accent") {
      spec.accent.forEach((i) => { p.accent[i] = 1; });
    } else {
      (spec[key] || []).forEach((i) => { p[key][i] = 1; });
    }
  });
  return p;
}

const sets = [
  {
    name: "hats-sample", modes: { hats: "sample", cymbals: "sample", toms: "sample" },
    pattern: { CH: [0, 4, 8, 12], OH: [2, 6, 10, 14], accent: [0, 4, 8, 12] },
    chain: ["A", "A"], label: "closed+open hats only", listen: "hi-hat timbre / metallic vs sample"
  },
  {
    name: "hats-808", modes: { hats: "metal", cymbals: "sample", toms: "sample" },
    pattern: { CH: [0, 4, 8, 12], OH: [2, 6, 10, 14], accent: [0, 4, 8, 12] },
    chain: ["A", "A"], label: "closed+open hats only", listen: "hi-hat timbre / metallic vs sample"
  },
  {
    name: "cymbal-sample", modes: { hats: "sample", cymbals: "sample", toms: "sample" },
    pattern: { CY: [0], accent: [0] }, chain: ["A", "A"],
    label: "cymbal only", listen: "cymbal decay / metallic texture"
  },
  {
    name: "cymbal-808", modes: { hats: "sample", cymbals: "metal", toms: "sample" },
    pattern: { CY: [0], accent: [0] }, chain: ["A", "A"],
    label: "cymbal only", listen: "cymbal decay / metallic texture"
  },
  {
    name: "toms-sample", modes: { hats: "sample", cymbals: "sample", toms: "sample" },
    pattern: { LT: [0, 8], MT: [4, 12], HT: [2, 10], accent: [0, 4, 8, 12] },
    chain: ["A", "A"], label: "low/mid/high toms only", listen: "pitch drop / body vs synth toms"
  },
  {
    name: "toms-808", modes: { hats: "sample", cymbals: "sample", toms: "synth" },
    pattern: { LT: [0, 8], MT: [4, 12], HT: [2, 10], accent: [0, 4, 8, 12] },
    chain: ["A", "A"], label: "low/mid/high toms only", listen: "pitch drop / body vs synth toms"
  },
  {
    name: "all-sample", modes: { hats: "sample", cymbals: "sample", toms: "sample" },
    pattern: null, chain: ["A", "A", "A", "B"], label: "full house pattern", listen: "whole groove A/B"
  },
  {
    name: "all-808", modes: { hats: "metal", cymbals: "metal", toms: "synth" },
    pattern: null, chain: ["A", "A", "A", "B"], label: "full house pattern", listen: "whole groove A/B"
  }
];

const report = { baseUrl: BASE, files: [], error: null };
try {
  await waitChrome();
  const target = (await getJson("/json/list")).find((t) => t.type === "page");
  const ws = await waitWs(target.webSocketDebuggerUrl);
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: BASE });
  await sleep(1200);
  await cdp.eval("new Promise(r=>{const t=setInterval(()=>{if(document.getElementById('loading').classList.contains('hidden')&&window.__renderDemoWavBase64){clearInterval(t);r(true);}},200);setTimeout(()=>r(false),20000);})", true);
  const base = await cdp.eval("window.__project.snapshot()", false);
  for (const item of sets) {
    const project = JSON.parse(JSON.stringify(base));
    project.voiceModes = item.modes;
    project.chain = item.chain;
    project.loopStart = 0;
    project.loopEnd = item.chain.length - 1;
    if (item.pattern) {
      project.patterns = {
        A: patternFromSpec(item.pattern),
        B: patternFromSpec(item.pattern)
      };
    }
    await cdp.eval(`window.__project.apply(${JSON.stringify(project)})`, true);
    await sleep(200);
    const b64 = await cdp.eval("window.__renderDemoWavBase64()", true);
    const buf = Buffer.from(b64, "base64");
    const rel = `web/ab-${item.name}.wav`;
    writeFileSync(join(process.cwd(), rel), buf);
    report.files.push({
      name: item.name, path: rel, bytes: buf.length, modes: item.modes,
      pattern: item.label || "house", listen: item.listen || ""
    });
    console.log(`${rel} ${buf.length} bytes`);
  }
  ws.close();
} catch (err) {
  report.error = err.message;
  console.error(err);
} finally {
  try { chrome.kill(); } catch (e) { /* noop */ }
}
writeFileSync(join(process.cwd(), "web", "ab-report.json"), JSON.stringify(report, null, 2));
