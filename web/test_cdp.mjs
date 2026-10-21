/* Minimal Chrome DevTools Protocol test harness (no npm dependencies).
 * Launches headless Chrome, opens the demo, waits for the offline audio
 * self-test, checks DOM counts, takes screenshots, and reports page errors.
 *
 * Usage:
 *   node web/test_cdp.mjs [url]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.argv[2] || "http://127.0.0.1:8137/";
const PORT = 9333;
const userDataDir = mkdtempSync(join(tmpdir(), "dsh-808-cdp-"));

const chrome = spawn(CHROME, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-breakpad",
  "--disable-crash-reporter",
  "--disable-dev-shm-usage",
  "--remote-allow-origins=*",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`,
  "--window-size=1600,1000",
  "about:blank",
], { stdio: "ignore", detached: false });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function waitForChrome() {
  for (let i = 0; i < 100; i++) {
    try {
      const v = await getJson("/json/version");
      if (v.webSocketDebuggerUrl) return v;
    } catch (e) { /* retry */ }
    await sleep(150);
  }
  throw new Error("Chrome remote debugging did not start");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
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
  async evaluate(expression, awaitPromise = false) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "evaluate failed");
    return r.result ? r.result.value : undefined;
  }
}

function waitWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error("WS timeout")), 10000);
    ws.onopen = () => { clearTimeout(timer); resolve(ws); };
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error("WS error")); };
  });
}

async function main() {
  const out = { url: BASE, errors: [], console: [], checks: {} };
  try {
    await waitForChrome();
    const page = (await getJson("/json/list")).find((t) => t.type === "page");
    if (!page) throw new Error("no page target");
    const ws = await waitWs(page.webSocketDebuggerUrl);
    const cdp = new CDP(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable").catch(() => {});
    await cdp.send("Page.navigate", { url: BASE });
    await sleep(2500);

    // collect console/errors
    for (const ev of cdp.events) {
      if (ev.method === "Runtime.exceptionThrown") {
        out.errors.push(ev.params.exceptionDetails.text + " " + (ev.params.exceptionDetails.exception?.description || ""));
      }
      if (ev.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(ev.params.type)) {
        out.console.push(ev.params.args.map((a) => a.value || a.description || "").join(" "));
      }
    }

    // wait for samples + selftest
    out.checks.loadingHidden = await cdp.evaluate(
      "document.getElementById('loading').classList.contains('hidden')", false);
    out.checks.diag = await cdp.evaluate(
      "new Promise(resolve => { const t0=Date.now(); const t=setInterval(()=>{ if(window.__DIAG__){clearInterval(t);resolve(JSON.stringify(window.__DIAG__));} else if(Date.now()-t0>45000){clearInterval(t);resolve('TIMEOUT');} },200); })",
      true);
    out.checks.counts = await cdp.evaluate(`JSON.stringify({
      voices: document.querySelectorAll('.voice-col').length,
      keys: document.querySelectorAll('.step-key').length,
      knobs: document.querySelectorAll('.knob').length,
      activeKeys: document.querySelectorAll('.step-key.active').length,
      lcd: document.querySelector('#lcdPattern .lcd-value').textContent,
      status: document.getElementById('statusText').textContent
    })`, false);
    out.checks.activeStepsInitial = await cdp.evaluate(
      "JSON.stringify([...document.querySelectorAll('.step-key')].map((k,i)=>k.classList.contains('active')?i+1:null).filter(Boolean))", false);
    out.checks.debugState = await cdp.evaluate(
      "JSON.stringify(window.__debugState ? window.__debugState() : null)", false);

    // song arranger open/close + screenshot
    await cdp.evaluate("document.getElementById('songBtn').click()", true);
    await sleep(350);
    out.checks.songPanel = await cdp.evaluate(
      "JSON.stringify({open: !document.getElementById('songPanel').classList.contains('hidden'), bars: document.querySelectorAll('#songGrid .song-bar').length})", false);
    await cdp.evaluate("document.querySelector('#songLengths button[data-bars=\"16\"]').click()", true);
    await sleep(300);
    out.checks.song16 = await cdp.evaluate(
      "JSON.stringify({length: window.__debugState().chain.length, grid: document.querySelectorAll('#songGrid .song-bar').length})", false);
    let songShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(process.cwd(), "web", "screenshot-song.png"), Buffer.from(songShot.data, "base64"));
    await cdp.evaluate("document.querySelector('#songLengths button[data-bars=\"32\"]').click()", true);
    await sleep(300);
    out.checks.song32 = await cdp.evaluate(
      "JSON.stringify({length: window.__debugState().chain.length, grid: document.querySelectorAll('#songGrid .song-bar').length})", false);
    songShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(process.cwd(), "web", "screenshot-song32.png"), Buffer.from(songShot.data, "base64"));
    await cdp.evaluate("document.querySelector('#songLengths button[data-bars=\"4\"]').click()", true);
    await sleep(250);
    await cdp.evaluate("document.getElementById('closeSongBtn').click()", true);
    await sleep(250);

    // voice A/B toggle
    out.checks.voiceModeToggle = await cdp.evaluate(
      "(()=>{const before=window.__debugState().voiceModes.hats;const btn=[...document.querySelectorAll('#voiceModeBar .vm-btn')].find(b=>b.textContent==='SAMPLE');btn.click();const after=window.__debugState().voiceModes.hats;window.__setVoiceModes({hats:'metal',cymbals:'metal',toms:'synth'});return before+'->'+after;})()", false);

    // start transport (headless uses autoplay-policy flag)
    await cdp.evaluate("document.getElementById('startBtn').click()", true);
    await sleep(1800);
    out.checks.playState = await cdp.evaluate(`JSON.stringify({
      status: document.getElementById('statusText').textContent,
      bar: document.getElementById('barText').textContent,
      playingKeys: document.querySelectorAll('.step-key.playing').length,
      startOn: document.getElementById('startBtn').classList.contains('on')
    })`, false);

    let shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(process.cwd(), "web", "screenshot-playing.png"), Buffer.from(shot.data, "base64"));

    // toggle a step, read pattern state via active class
    await cdp.evaluate("document.querySelectorAll('.step-key')[5].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))", true);
    await sleep(200);
    out.checks.editAfterToggle = await cdp.evaluate(
      "document.querySelectorAll('.step-key')[5].classList.contains('active')", false);

    await cdp.evaluate("document.getElementById('startBtn').click()", true);
    await sleep(300);
    await cdp.evaluate("document.getElementById('resetBtn').click()", true);
    await sleep(250);
    out.checks.activeStepsAfterReset = await cdp.evaluate(
      "JSON.stringify([...document.querySelectorAll('.step-key')].map((k,i)=>k.classList.contains('active')?i+1:null).filter(Boolean))", false);

    // project persistence + song arrangement + loop range
    await cdp.evaluate("document.querySelectorAll('.step-key')[5].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))", true);
    await cdp.evaluate("document.getElementById('songBtn').click()", true);
    await sleep(200);
    await cdp.evaluate("document.querySelector('#songGrid .song-bar:nth-child(2)').click()", true);
    await cdp.evaluate("document.querySelector('#songLengths button[data-bars=\"16\"]').click()", true);
    await sleep(200);
    await cdp.evaluate("const a=document.getElementById('loopStartInput'); a.value='2'; a.dispatchEvent(new Event('change',{bubbles:true}));", true);
    await cdp.evaluate("const b=document.getElementById('loopEndInput'); b.value='8'; b.dispatchEvent(new Event('change',{bubbles:true}));", true);
    await sleep(650);
    out.checks.localSave = await cdp.evaluate(
      "JSON.stringify({key: !!localStorage.getItem(window.__project.storageKey), chain: window.__debugState().chain, loopStart: window.__debugState().loopStart, loopEnd: window.__debugState().loopEnd, active: [...document.querySelectorAll('.step-key')].map((k,i)=>k.classList.contains('active')?i+1:null).filter(Boolean)})", false);
    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(3000);
    await cdp.evaluate("new Promise(r=>{const t=setInterval(()=>{if(document.getElementById('loading').classList.contains('hidden')&&window.__debugState){clearInterval(t);r(true);}},200);setTimeout(()=>r(false),12000);})", true);
    out.checks.afterReload = await cdp.evaluate(
      "JSON.stringify({style: window.__debugState().style, chain: window.__debugState().chain, loopStart: window.__debugState().loopStart, loopEnd: window.__debugState().loopEnd, active: [...document.querySelectorAll('.step-key')].map((k,i)=>k.classList.contains('active')?i+1:null).filter(Boolean)})", false);
    await cdp.evaluate("document.getElementById('resetBtn').click()", true);
    await sleep(350);

    // render the chain through the browser engine and save it for analysis
    try {
      const wavB64 = await cdp.evaluate(
        "window.__renderDemoWavBase64 ? window.__renderDemoWavBase64() : null", true);
      if (wavB64) {
        writeFileSync(join(process.cwd(), "web", "browser-render.wav"),
          Buffer.from(wavB64, "base64"));
        out.checks.browserRenderBytes = Buffer.from(wavB64, "base64").length;
      } else {
        out.checks.browserRenderBytes = 0;
      }
    } catch (e) {
      out.checks.browserRenderError = e.message;
    }

    shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(process.cwd(), "web", "screenshot.png"), Buffer.from(shot.data, "base64"));

    ws.close();
  } catch (err) {
    out.fatal = err.message;
  } finally {
    try { chrome.kill(); } catch (e) { /* noop */ }
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
