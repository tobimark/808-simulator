/* Rhythm Composer 808 — web demo UI + sequencer.
 * Audio engine: web/audio.js. Samples: FreePats CC0 (web/samples.js).
 * This is a demo, not the shipping app.
 */
(function () {
  "use strict";

  var CHANNEL_DEFS = [
    { id: "ACCENT", label: "ACCENT", voices: null, knobs: ["level"], accent: true },
    { id: "BD", label: "BASS DRUM", voices: ["BD"], knobs: ["level", "tone", "decay"] },
    { id: "SD", label: "SNARE DRUM", voices: ["SD"], knobs: ["level", "tone", "snappy"] },
    { id: "LT", label: "LOW TOM", voices: ["LT", "LC"], pair: ["TOM", "CONGA"], knobs: ["level", "tuning"] },
    { id: "MT", label: "MID TOM", voices: ["MT", "MC"], pair: ["TOM", "CONGA"], knobs: ["level", "tuning"] },
    { id: "HT", label: "HI TOM", voices: ["HT", "HC"], pair: ["TOM", "CONGA"], knobs: ["level", "tuning"] },
    { id: "RS", label: "RIM SHOT", voices: ["RS", "CL"], pair: ["RIM", "CLAVES"], knobs: ["level"] },
    { id: "CP", label: "HAND CLAP", voices: ["CP", "MA"], pair: ["CLAP", "MARA"], knobs: ["level"] },
    { id: "CB", label: "COWBELL", voices: ["CB"], knobs: ["level"] },
    { id: "CY", label: "CYMBAL", voices: ["CY"], knobs: ["level", "tone", "decay"] },
    { id: "OH", label: "OPEN HAT", voices: ["OH"], knobs: ["level", "decay"] },
    { id: "CH", label: "CLOSED HAT", voices: ["CH"], knobs: ["level"] }
  ];
  var VOICE_CHANNELS = {};
  CHANNEL_DEFS.forEach(function (c) {
    if (c.voices) c.voices.forEach(function (v) { VOICE_CHANNELS[v] = c.id; });
  });

  var VOICE_LABELS = {
    BD: "BASS DRUM", SD: "SNARE DRUM",
    LT: "LOW TOM", LC: "LOW CONGA", MT: "MID TOM", MC: "MID CONGA",
    HT: "HI TOM", HC: "HI CONGA", RS: "RIM SHOT", CL: "CLAVES",
    CP: "HAND CLAP", MA: "MARACAS", CB: "COWBELL", CY: "CYMBAL",
    OH: "OPEN HAT", CH: "CLOSED HAT"
  };

  var VOICE_DEFAULTS = {
    BD: { level: 1.00, tone: 0.50, decay: 0.55 },
    SD: { level: 0.72, tone: 0.50, snappy: 0.55 },
    LT: { level: 0.52, tuning: 0.50 }, LC: { level: 0.50, tuning: 0.40, decay: 0.45 },
    MT: { level: 0.52, tuning: 0.50 }, MC: { level: 0.50, tuning: 0.55, decay: 0.40 },
    HT: { level: 0.52, tuning: 0.50 }, HC: { level: 0.50, tuning: 0.70, decay: 0.35 },
    RS: { level: 0.42 }, CL: { level: 0.40 },
    CP: { level: 0.55 }, MA: { level: 0.22 },
    CB: { level: 0.38 },
    CY: { level: 0.42, tone: 0.50, decay: 0.60 },
    OH: { level: 0.34, decay: 0.50 }, CH: { level: 0.30 }
  };

  var CHANNEL_IDS = ["BD", "SD", "LT", "MT", "HT", "RS", "CP", "CB", "CY", "OH", "CH"];

  function emptyPattern() {
    var p = { accent: new Array(16).fill(0) };
    CHANNEL_IDS.forEach(function (id) { p[id] = new Array(16).fill(0); });
    return p;
  }
  function defaultPatternA() {
    var p = emptyPattern();
    [0, 4, 8, 12].forEach(function (i) { p.BD[i] = 1; });
    [4, 12].forEach(function (i) { p.SD[i] = 1; p.CP[i] = 1; });
    [0, 4, 8, 12].forEach(function (i) { p.CH[i] = 1; });
    [2, 6, 10, 14].forEach(function (i) { p.OH[i] = 1; });
    [7, 15].forEach(function (i) { p.RS[i] = 1; });
    p.CB[10] = 1;
    p.CY[0] = 1;
    [0, 4, 8, 12].forEach(function (i) { p.accent[i] = 1; });
    return p;
  }
  function defaultPatternB() {
    var p = defaultPatternA();
    p.OH[14] = 0;
    p.LT[12] = 1; p.LT[13] = 1;
    p.MT[14] = 1; p.HT[15] = 1;
    p.CP[15] = 1;
    return p;
  }
  function defaultChain() { return ["A", "A", "A", "B"]; }

  // --------------------------------------------------------------------
  // style presets
  // --------------------------------------------------------------------
  function patternFromSpec(spec) {
    var p = emptyPattern();
    Object.keys(spec).forEach(function (key) {
      if (key === "accent") {
        p.accent = new Array(16).fill(0);
        spec.accent.forEach(function (i) { p.accent[i] = 1; });
        return;
      }
      (spec[key] || []).forEach(function (i) { p[key][i] = 1; });
    });
    return p;
  }
  function makePatterns(aSpec, bSpec) {
    return { A: patternFromSpec(aSpec), B: patternFromSpec(bSpec) };
  }
  function allSteps() {
    var a = [];
    for (var i = 0; i < 16; i++) a.push(i);
    return a;
  }
  function mergeStyleParams(overrides) {
    var p = JSON.parse(JSON.stringify(VOICE_DEFAULTS));
    Object.keys(overrides || {}).forEach(function (voice) {
      p[voice] = Object.assign({}, p[voice] || {}, overrides[voice]);
    });
    return p;
  }

  var STYLES = {
    house: {
      label: "HOUSE",
      bpm: 124,
      swing: 0.10,
      accent: 0.72,
      description: "Four-on-the-floor / jackin' 808",
      patterns: function () {
        return makePatterns({
          BD: [0, 4, 8, 12], SD: [4, 12], CP: [4, 12],
          CH: [0, 4, 8, 12], OH: [2, 6, 10, 14],
          RS: [7, 15], CB: [10], CY: [0],
          accent: [0, 4, 8, 12]
        }, {
          BD: [0, 4, 8, 12], SD: [4, 12], CP: [4, 12, 15],
          CH: [0, 4, 8, 12], OH: [2, 6, 10],
          RS: [7, 15], CB: [10], CY: [0],
          LT: [12, 13], MT: [14], HT: [15],
          accent: [0, 4, 8, 12]
        });
      },
      overrides: {}
    },
    trap: {
      label: "TRAP",
      bpm: 140,
      swing: 0.0,
      accent: 0.82,
      description: "Halftime 808 / rolling 16th hats",
      patterns: function () {
        return makePatterns({
          BD: [0, 6, 10, 14], SD: [8], CP: [8],
          CH: allSteps(), OH: [3, 11],
          RS: [5, 13],
          accent: [0, 6, 10, 14]
        }, {
          BD: [0, 6, 10, 14], SD: [8, 14, 15], CP: [8],
          CH: allSteps(), OH: [3, 11],
          RS: [5, 13],
          LT: [12], MT: [13], HT: [14, 15],
          accent: [0, 6, 10, 14]
        });
      },
      overrides: {
        BD: { decay: 0.85, tone: 0.35 },
        SD: { level: 0.64, tone: 0.42, snappy: 0.72 },
        CH: { level: 0.24 },
        OH: { decay: 0.28 },
        RS: { level: 0.36 },
        CY: { level: 0.30, decay: 0.50, tone: 0.45 },
        LT: { tuning: 0.35 }, MT: { tuning: 0.45 }, HT: { tuning: 0.55 },
        CB: { level: 0.30 }
      }
    },
    electro: {
      label: "ELECTRO",
      bpm: 96,
      swing: 0.22,
      accent: 0.68,
      description: "Swung electro / boom-bap 808",
      patterns: function () {
        return makePatterns({
          BD: [0, 4, 7, 10, 14], SD: [4, 12], CP: [12],
          CH: [0, 2, 4, 6, 8, 10, 12, 14], OH: [3, 11],
          RS: [6, 14], CB: [8], CY: [0],
          accent: [0, 4, 8, 12]
        }, {
          BD: [0, 4, 7, 10, 14], SD: [4, 12], CP: [12, 15],
          CH: [0, 2, 4, 6, 8, 10, 12, 14], OH: [3, 11],
          RS: [6, 14], CB: [8], CY: [0],
          LT: [13], MT: [14], HT: [15],
          accent: [0, 4, 8, 12]
        });
      },
      overrides: {
        BD: { decay: 0.40, tone: 0.62 },
        SD: { tone: 0.55, snappy: 0.70 },
        CH: { level: 0.30 },
        OH: { decay: 0.30 },
        CY: { level: 0.38, tone: 0.55, decay: 0.50 },
        RS: { level: 0.42 },
        CB: { level: 0.40 },
        LT: { tuning: 0.5 }, MT: { tuning: 0.5 }, HT: { tuning: 0.5 }
      }
    }
  };

  var state = {
    style: "house",
    patterns: STYLES.house.patterns(),
    params: JSON.parse(JSON.stringify(VOICE_DEFAULTS)),
    channelVoiceIndex: { LT: 0, MT: 0, HT: 0, RS: 0, CP: 0 },
    selectedChannel: "BD",
    selectedPattern: "A",
    chain: defaultChain(),
    loopStart: 0,
    loopEnd: 3,
    voiceModes: { hats: "metal", cymbals: "metal", toms: "synth" },
    bpm: 124,
    swing: 0.10,
    accentLevel: 0.72,
    volume: 0.8,
    playing: false,
    step: 0,
    bar: 0,
    nextTime: 0,
    timer: null,
    queue: [],
    audio: null,
    buffers: null,
    engine: null
  };

  var $ = function (id) { return document.getElementById(id); };
  var knobRefs = {};
  var lastPlayedStep = -1;
  var lastPlayedBar = -1;
  var rafId = 0;
  var tapTimes = [];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pct(v) { return Math.round(v * 100) + "%"; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // --------------------------------------------------------------------
  // audio boot
  // --------------------------------------------------------------------
  async function bootAudio() {
    var status = $("loadStatus");
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("Web Audio not supported in this browser");
      state.audio = new AC({ latencyHint: "interactive" });
      state.audio.suspend();
      status.textContent = "decoding CC0 samples…";
      state.buffers = await window.decodeSamples(state.audio, function (done, total) {
        status.textContent = "decoding CC0 samples… " + done + "/" + total;
      });
      state.engine = new window.HybridEngine(state.audio, state.buffers);
      state.engine.setVoiceModes(state.voiceModes);
      state.engine.setVolume(state.volume);
      $("loading").classList.add("hidden");
      setStatus("READY", "CLICK START");
      updateUI();
      if (new URLSearchParams(location.search).has("selftest")) {
        await runSelfTest();
      }
    } catch (err) {
      status.textContent = "Audio error: " + err.message;
      showDiag({ error: err.message, stack: err.stack || "" });
      console.error(err);
    }
  }

  // --------------------------------------------------------------------
  // knobs
  // --------------------------------------------------------------------
  function makeKnob(opts) {
    var unit = document.createElement("div");
    unit.className = "knob-unit " + (opts.size || "md");
    var knob = document.createElement("div");
    knob.className = "knob";
    knob.tabIndex = 0;
    knob.setAttribute("role", "slider");
    knob.setAttribute("aria-label", opts.aria || opts.label);
    var ring = document.createElement("div");
    ring.className = "knob-ring";
    var rot = document.createElement("div");
    rot.className = "knob-rot";
    var tick = document.createElement("span");
    tick.className = "knob-tick";
    rot.appendChild(tick);
    knob.appendChild(ring);
    knob.appendChild(rot);

    var label = document.createElement("div");
    label.className = "knob-label";
    label.textContent = opts.label;
    var valueEl = document.createElement("div");
    valueEl.className = "knob-value";

    unit.appendChild(knob);
    unit.appendChild(label);
    unit.appendChild(valueEl);

    var cur = clamp(opts.value == null ? 0.5 : opts.value, 0, 1);
    var dragging = false;
    var startY = 0;
    var startVal = 0;

    function render() {
      var angle = -135 + 270 * cur;
      rot.style.transform = "rotate(" + angle + "deg)";
      valueEl.textContent = opts.format ? opts.format(cur) : pct(cur);
      knob.setAttribute("aria-valuenow", String(Math.round(cur * 100)));
    }
    function set(v, silent) {
      cur = clamp(v, 0, 1);
      render();
      if (!silent && opts.onChange) opts.onChange(cur);
    }

    knob.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startY = e.clientY;
      startVal = cur;
      knob.classList.add("dragging");
      try { knob.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
    knob.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var delta = (startY - e.clientY) / 110;
      set(startVal + delta);
    });
    function endDrag() {
      dragging = false;
      knob.classList.remove("dragging");
    }
    knob.addEventListener("pointerup", endDrag);
    knob.addEventListener("pointercancel", endDrag);
    knob.addEventListener("dblclick", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var def = opts.defaultValue == null ? 0.5 : opts.defaultValue;
      set(def);
    });
    knob.addEventListener("wheel", function (e) {
      e.preventDefault();
      set(cur + (e.deltaY < 0 ? 0.02 : -0.02));
    }, { passive: false });

    render();
    return { el: unit, set: set, get: function () { return cur; } };
  }

  // --------------------------------------------------------------------
  // voice columns
  // --------------------------------------------------------------------
  function currentVoice(channelId) {
    var def = CHANNEL_DEFS.filter(function (c) { return c.id === channelId; })[0];
    if (!def || !def.voices) return null;
    return def.voices[state.channelVoiceIndex[channelId] || 0];
  }

  function channelVoiceLabel(channelId) {
    var v = currentVoice(channelId);
    return v ? VOICE_LABELS[v] : "ACCENT";
  }

  function knobValue(channelId, param) {
    if (channelId === "ACCENT") return state.accentLevel;
    var v = currentVoice(channelId);
    if (!v || !state.params[v]) return 0.5;
    return state.params[v][param] == null ? 0.5 : state.params[v][param];
  }

  function knobDefault(channelId, param) {
    if (channelId === "ACCENT") return 0.7;
    var v = currentVoice(channelId);
    if (!v || !VOICE_DEFAULTS[v]) return 0.5;
    return VOICE_DEFAULTS[v][param] == null ? 0.5 : VOICE_DEFAULTS[v][param];
  }

  function setKnobValue(channelId, param, value) {
    if (channelId === "ACCENT") {
      state.accentLevel = value;
      scheduleSave();
      return;
    }
    var v = currentVoice(channelId);
    if (!v) return;
    if (!state.params[v]) state.params[v] = JSON.parse(JSON.stringify(VOICE_DEFAULTS[v] || {}));
    state.params[v][param] = value;
    scheduleSave();
  }

  function renderVoiceColumns() {
    var host = $("voiceColumns");
    host.innerHTML = "";
    knobRefs = {};
    CHANNEL_DEFS.forEach(function (def) {
      var col = document.createElement("div");
      col.className = "voice-col" + (def.accent ? " accent-col" : "");
      col.dataset.channel = def.id;
      col.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".knob, .pair-switch")) return;
        selectChannel(def.id);
      });

      var knobs = document.createElement("div");
      knobs.className = "col-knobs";
      var levelSlot = document.createElement("div");
      levelSlot.className = "knob-level";
      var label = def.accent ? "ACCENT" : "LEVEL";
      var levelKnob = makeKnob({
        label: label,
        size: "lg",
        value: knobValue(def.id, "level"),
        defaultValue: knobDefault(def.id, "level"),
        aria: def.label + " level",
        format: pct,
        onChange: function (v) {
          setKnobValue(def.id, "level", v);
          if (state.engine && def.accent) state.engine.setVolume(state.volume);
        }
      });
      knobRefs[def.id + ":level"] = levelKnob;
      levelSlot.appendChild(levelKnob.el);
      knobs.appendChild(levelSlot);

      var secondary = def.knobs.filter(function (k) { return k !== "level"; });
      var paramRow = document.createElement("div");
      paramRow.className = "knob-params";
      secondary.forEach(function (param) {
        var k = makeKnob({
          label: param.toUpperCase(),
          size: "sm",
          value: knobValue(def.id, param),
          defaultValue: knobDefault(def.id, param),
          aria: def.label + " " + param,
          format: pct,
          onChange: function (v) { setKnobValue(def.id, param, v); }
        });
        knobRefs[def.id + ":" + param] = k;
        paramRow.appendChild(k.el);
      });
      if (secondary.length) knobs.appendChild(paramRow);
      col.appendChild(knobs);

      if (def.pair) {
        var sw = document.createElement("div");
        sw.className = "pair-switch";
        def.pair.forEach(function (txt, idx) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = txt;
          b.className = (state.channelVoiceIndex[def.id] || 0) === idx ? "on" : "";
          b.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            e.stopPropagation();
            state.channelVoiceIndex[def.id] = idx;
            renderVoiceColumns();
            updateUI();
            scheduleSave();
          });
          sw.appendChild(b);
        });
        col.appendChild(sw);
      }

      var name = document.createElement("div");
      name.className = "col-name";
      name.textContent = def.accent ? "ACCENT" : channelVoiceLabel(def.id);
      var led = document.createElement("span");
      led.className = "col-led";
      col.appendChild(led);
      col.appendChild(name);
      host.appendChild(col);
    });
  }

  function selectChannel(id) {
    state.selectedChannel = id;
    updateUI();
    scheduleSave();
  }

  // --------------------------------------------------------------------
  // step keys
  // --------------------------------------------------------------------
  function patternForEdit() { return state.patterns[state.selectedPattern]; }

  function channelAtStep(step) {
    var pattern = patternForEdit();
    if (state.selectedChannel === "ACCENT") return !!pattern.accent[step];
    var arr = pattern[state.selectedChannel];
    return !!(arr && arr[step]);
  }

  function toggleStep(step) {
    var pattern = patternForEdit();
    if (state.selectedChannel === "ACCENT") {
      pattern.accent[step] = pattern.accent[step] ? 0 : 1;
    } else {
      pattern[state.selectedChannel][step] = pattern[state.selectedChannel][step] ? 0 : 1;
      if (pattern[state.selectedChannel][step]) previewChannel(state.selectedChannel, !!pattern.accent[step]);
    }
    updateStepKeys();
    updateUI();
    pulseStep(step);
    scheduleSave();
  }

  function previewChannel(channelId, accent) {
    if (!state.engine || !state.audio) return;
    var v = currentVoice(channelId);
    if (!v) return;
    state.audio.resume().catch(function () {});
    var p = state.params[v] || VOICE_DEFAULTS[v];
    try {
      state.engine.trigger(v, state.audio.currentTime + 0.01, !!accent, p, state.accentLevel);
    } catch (err) { /* noop */ }
  }

  function renderStepKeys() {
    var host = $("stepKeys");
    host.innerHTML = "";
    for (var i = 0; i < 16; i++) {
      var key = document.createElement("div");
      key.className = "step-key group-" + (Math.floor(i / 4) + 1);
      key.dataset.step = i;
      key.tabIndex = 0;
      var led = document.createElement("span");
      led.className = "step-led";
      var face = document.createElement("div");
      face.className = "key-face";
      var num = document.createElement("span");
      num.className = "key-number";
      num.textContent = (i + 1);
      var dots = document.createElement("div");
      dots.className = "key-dots";
      for (var j = 0; j < CHANNEL_IDS.length; j++) {
        var d = document.createElement("span");
        d.dataset.ci = j;
        dots.appendChild(d);
      }
      face.appendChild(num);
      face.appendChild(dots);
      key.appendChild(led);
      key.appendChild(face);
      key.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        toggleStep(parseInt(this.dataset.step, 10));
      });
      key.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleStep(parseInt(this.dataset.step, 10));
        }
      });
      host.appendChild(key);
    }
    updateStepKeys();
  }

  function updateStepKeys() {
    var pattern = patternForEdit();
    var keys = $("stepKeys").children;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var active = channelAtStep(i);
      key.classList.toggle("active", active);
      key.classList.toggle("accent-hit", !!pattern.accent[i]);
      var dots = key.querySelectorAll(".key-dots span");
      for (var j = 0; j < CHANNEL_IDS.length; j++) {
        var id = CHANNEL_IDS[j];
        dots[j].classList.toggle("on", !!pattern[id][i]);
        dots[j].classList.toggle("sel", id === state.selectedChannel);
      }
    }
  }

  function pulseStep(step) {
    var keys = $("stepKeys").children;
    if (!keys[step]) return;
    keys[step].classList.add("hit");
    setTimeout(function () { keys[step].classList.remove("hit"); }, 120);
  }

  // --------------------------------------------------------------------
  // transport / scheduler
  // --------------------------------------------------------------------
  function ensureEngine() {
    if (!state.engine) return false;
    if (state.audio.state === "suspended") state.audio.resume().catch(function () {});
    return true;
  }

  function start() {
    if (state.playing) { stop(); return; }
    if (!ensureEngine()) { setStatus("LOADING", "SAMPLES NOT READY"); return; }
    clampLoopState();
    state.playing = true;
    state.step = 0;
    state.bar = state.loopStart;
    state.queue = [];
    state.nextTime = state.audio.currentTime + 0.08;
    state.timer = setInterval(scheduleAhead, 25);
    $("startBtn").classList.add("on");
    $("startBtn").innerHTML = "STOP<span>START</span>";
    $("playLed").classList.add("on");
    updateChainUI();
    setStatus("PLAYING", "BAR " + (state.loopStart + 1) + " · PATTERN " + state.chain[state.loopStart]);
    scheduleAhead();
    rafId = requestAnimationFrame(uiTick);
  }

  function stop() {
    state.playing = false;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.engine) state.engine.panic();
    state.queue = [];
    lastPlayedStep = -1;
    lastPlayedBar = -1;
    $("startBtn").classList.remove("on");
    $("startBtn").innerHTML = "START<span>STOP</span>";
    $("playLed").classList.remove("on");
    var keys = $("stepKeys").children;
    for (var i = 0; i < keys.length; i++) keys[i].classList.remove("playing");
    updateChainUI();
    setStatus("STOPPED", "PATTERN " + state.selectedPattern + " · READY");
    cancelAnimationFrame(rafId);
  }

  function scheduleAhead() {
    if (!state.playing) return;
    var horizon = state.audio.currentTime + 0.12;
    var guard = 0;
    var chainLen = state.chain.length || 4;
    while (state.nextTime < horizon && guard++ < 64) {
      scheduleStep(state.bar % chainLen, state.step, state.nextTime);
      state.queue.push({ bar: state.bar % chainLen, step: state.step, time: state.nextTime });
      var dur = 60 / state.bpm / 4;
      dur *= (state.step % 2 === 0) ? (1 + 0.5 * state.swing) : (1 - 0.5 * state.swing);
      state.nextTime += dur;
      state.step++;
      if (state.step >= 16) {
        state.step = 0;
        state.bar++;
        var loopEnd = Math.min(state.loopEnd, chainLen - 1);
        if (state.bar > loopEnd || state.bar < state.loopStart || state.bar >= chainLen) {
          state.bar = state.loopStart;
        }
      }
    }
  }

  function scheduleStep(barIndex, step, time) {
    var patName = state.chain[barIndex] || "A";
    var pattern = state.patterns[patName] || state.patterns.A;
    var accent = !!pattern.accent[step];
    CHANNEL_IDS.forEach(function (id) {
      if (!pattern[id][step]) return;
      var v = currentVoice(id);
      if (!v) return;
      state.engine.trigger(v, time, accent, state.params[v] || VOICE_DEFAULTS[v], state.accentLevel);
    });
  }

  function uiTick() {
    if (!state.playing) return;
    var now = state.audio.currentTime;
    var found = null;
    while (state.queue.length && state.queue[0].time <= now + 0.008) {
      found = state.queue.shift();
    }
    if (found && (found.step !== lastPlayedStep || found.bar !== lastPlayedBar)) {
      lastPlayedStep = found.step;
      lastPlayedBar = found.bar;
      var patName = state.chain[found.bar] || "A";
      var keys = $("stepKeys").children;
      for (var i = 0; i < keys.length; i++) keys[i].classList.toggle("playing", i === found.step);
      $("barText").textContent = "BAR " + (found.bar + 1) + "/" + state.chain.length +
        " · STEP " + (found.step + 1) + " · PATTERN " + patName +
        " · LOOP " + (state.loopStart + 1) + "–" + (state.loopEnd + 1);
      updateChainUI();

      var playingPattern = state.patterns[patName];
      CHANNEL_DEFS.forEach(function (def) {
        if (def.accent) return;
        if (!playingPattern[def.id] || !playingPattern[def.id][found.step]) return;
        var col = document.querySelector('.voice-col[data-channel="' + def.id + '"]');
        if (!col) return;
        col.classList.add("flash");
        setTimeout(function () { col.classList.remove("flash"); }, 110);
      });
      var accentCol = document.querySelector('.voice-col[data-channel="ACCENT"]');
      if (accentCol && playingPattern.accent[found.step]) {
        accentCol.classList.add("flash");
        setTimeout(function () { accentCol.classList.remove("flash"); }, 110);
      }
    }
    rafId = requestAnimationFrame(uiTick);
  }

  function setStatus(main, sub) {
    $("statusText").textContent = main;
    if (sub) $("barText").textContent = sub;
  }

  // --------------------------------------------------------------------
  // pattern / transport buttons
  // --------------------------------------------------------------------
  function renderPatternButtons() {
    var host = $("patternButtons");
    host.innerHTML = "";
    var labels = "ABCDEFGH".split("");
    labels.forEach(function (letter) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "pattern-btn";
      b.textContent = letter;
      if (letter === "A" || letter === "B") {
        b.classList.toggle("on", state.selectedPattern === letter);
        b.addEventListener("click", function () {
          state.selectedPattern = letter;
          renderPatternButtons();
          updateUI();
          scheduleSave();
        });
      } else {
        b.classList.add("disabled");
        b.title = "Demo only: patterns A/B are editable";
      }
      host.appendChild(b);
    });
  }

  function renderStyleButtons() {
    var host = $("styleButtons");
    if (!host) return;
    host.innerHTML = "";
    Object.keys(STYLES).forEach(function (id) {
      var s = STYLES[id];
      var b = document.createElement("button");
      b.type = "button";
      b.className = "style-btn" + (state.style === id ? " on" : "");
      b.textContent = s.label;
      b.title = s.description + " · " + s.bpm + " BPM";
      b.addEventListener("click", function (e) {
        e.preventDefault();
        applyStyle(id);
      });
      host.appendChild(b);
    });
  }

  // --------------------------------------------------------------------
  // voice engine A/B (sample vs synthesized 808)
  // --------------------------------------------------------------------
  var VOICE_MODE_GROUPS = [
    { key: "hats", label: "HATS", values: [["sample", "SAMPLE"], ["metal", "808 METAL"]] },
    { key: "cymbals", label: "CYMBAL", values: [["sample", "SAMPLE"], ["metal", "808 METAL"]] },
    { key: "toms", label: "TOMS", values: [["sample", "SAMPLE"], ["synth", "808 SYNTH"]] }
  ];

  function renderVoiceModeBar() {
    var host = $("voiceModeBar");
    if (!host) return;
    host.innerHTML = "";
    var label = document.createElement("span");
    label.textContent = "VOICE A/B";
    label.className = "vm-title";
    host.appendChild(label);
    VOICE_MODE_GROUPS.forEach(function (group) {
      var wrap = document.createElement("span");
      wrap.className = "vm-group";
      var name = document.createElement("span");
      name.textContent = group.label;
      wrap.appendChild(name);
      group.values.forEach(function (pair) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "vm-btn" + (state.voiceModes[group.key] === pair[0] ? " on" : "");
        b.textContent = pair[1];
        b.title = group.label + ": " + pair[1];
        b.addEventListener("click", function () {
          state.voiceModes[group.key] = pair[0];
          if (state.engine) state.engine.setVoiceModes(state.voiceModes);
          renderVoiceModeBar();
          scheduleSave();
          setStatus(state.playing ? "PLAYING" : "READY",
            group.label + " → " + pair[1]);
        });
        wrap.appendChild(b);
      });
      host.appendChild(wrap);
    });
  }

  // --------------------------------------------------------------------
  // song / chain (A/B arrangement, 4–32 bars, loop range)
  // --------------------------------------------------------------------
  var CHAIN_LENGTHS = [4, 8, 16, 32];
  var chainClipboard = null;

  function clampLoopState() {
    if (!Array.isArray(state.chain) || !state.chain.length) state.chain = defaultChain();
    state.loopStart = clamp(parseInt(state.loopStart, 10) || 0, 0, state.chain.length - 1);
    state.loopEnd = clamp(parseInt(state.loopEnd, 10) || state.chain.length - 1,
      state.loopStart, state.chain.length - 1);
  }

  function renderChain() {
    var host = $("chainRow");
    if (!host) return;
    host.innerHTML = "";
    state.chain.forEach(function (pat, idx) {
      var b = document.createElement("i");
      b.className = pat === "A" ? "a" : "b";
      b.title = "Bar " + (idx + 1) + ": " + pat + " — click to open Song Arranger";
      b.addEventListener("click", function (e) {
        e.preventDefault();
        openSongPanel();
      });
      host.appendChild(b);
    });
    updateChainUI();
  }

  function updateSongGridClasses() {
    var host = $("songGrid");
    if (!host) return;
    var children = host.children;
    for (var i = 0; i < children.length; i++) {
      var pat = state.chain[i] || "A";
      children[i].classList.toggle("a", pat === "A");
      children[i].classList.toggle("b", pat === "B");
      children[i].classList.toggle("loop", i >= state.loopStart && i <= state.loopEnd);
      children[i].classList.toggle("playing", !!state.playing && i === state.bar);
    }
  }

  function updateChainUI() {
    var host = $("chainRow");
    if (host) {
      var children = host.children;
      for (var i = 0; i < children.length; i++) {
        var pat = state.chain[i] || "A";
        children[i].classList.toggle("a", pat === "A");
        children[i].classList.toggle("b", pat === "B");
        children[i].classList.toggle("loop", i >= state.loopStart && i <= state.loopEnd);
        children[i].classList.toggle("playing", !!state.playing && i === state.bar);
      }
    }
    if ($("chainLength")) $("chainLength").textContent = state.chain.length;
    if ($("loopSummary")) {
      $("loopSummary").textContent = "LOOP " + (state.loopStart + 1) + "–" + (state.loopEnd + 1);
    }
    if ($("chainSummary")) {
      $("chainSummary").textContent = "SONG " + state.chain.length + " BARS · LOOP " +
        (state.loopStart + 1) + "–" + (state.loopEnd + 1);
    }
    if ($("songBarsLabel")) $("songBarsLabel").textContent = state.chain.length + " BARS";
    var lengths = $("songLengths");
    if (lengths) {
      for (var j = 0; j < lengths.children.length; j++) {
        lengths.children[j].classList.toggle("on",
          parseInt(lengths.children[j].dataset.bars, 10) === state.chain.length);
      }
    }
    ["loopStartInput", "loopEndInput"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.max = String(state.chain.length);
      if (document.activeElement !== el) {
        el.value = String((id === "loopStartInput" ? state.loopStart : state.loopEnd) + 1);
      }
    });
    if ($("songPanel") && !$("songPanel").classList.contains("hidden")) updateSongGridClasses();
  }

  function renderSongGrid() {
    var host = $("songGrid");
    if (!host) return;
    host.innerHTML = "";
    state.chain.forEach(function (pat, idx) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "song-bar " + (pat === "A" ? "a" : "b");
      b.innerHTML = '<span class="bar-no">' + (idx + 1) + '</span><span class="bar-pat">' + pat + '</span>';
      b.title = "Bar " + (idx + 1) + ": " + pat + " (click to toggle)";
      b.addEventListener("click", function () {
        state.chain[idx] = state.chain[idx] === "A" ? "B" : "A";
        renderSongGrid();
        updateUI();
        scheduleSave();
      });
      host.appendChild(b);
    });
    updateSongGridClasses();
  }

  function renderSongControls() {
    var host = $("songLengths");
    if (!host) return;
    host.innerHTML = "";
    CHAIN_LENGTHS.forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.bars = String(n);
      b.textContent = n;
      b.title = n + " bars";
      b.addEventListener("click", function () { setChainLength(n); });
      host.appendChild(b);
    });
    updateChainUI();
  }

  function setChainLength(n) {
    n = clamp(parseInt(n, 10) || 4, 1, 32);
    var old = state.chain.slice();
    if (!old.length) old = defaultChain();
    var out = [];
    for (var i = 0; i < n; i++) out.push(old[i % old.length] || "A");
    state.chain = out;
    state.loopStart = 0;
    state.loopEnd = n - 1;
    renderChain();
    renderSongGrid();
    updateUI();
    scheduleSave();
    if ($("songPanel") && !$("songPanel").classList.contains("hidden")) fit();
  }

  function setLoopRange(start, end) {
    var len = state.chain.length;
    state.loopStart = clamp(start, 0, len - 1);
    state.loopEnd = clamp(end, state.loopStart, len - 1);
    updateUI();
    scheduleSave();
  }

  function openSongPanel() {
    var panel = $("songPanel");
    if (!panel) return;
    panel.classList.remove("hidden");
    renderSongGrid();
    updateChainUI();
    fit();
  }

  function closeSongPanel() {
    var panel = $("songPanel");
    if (!panel) return;
    panel.classList.add("hidden");
    fit();
  }

  function copyChain() {
    chainClipboard = state.chain.slice();
    setStatus(state.playing ? "PLAYING" : "READY", "CHAIN COPIED · " + chainClipboard.length + " BARS");
  }

  function pasteChain() {
    if (!chainClipboard || !chainClipboard.length) {
      setStatus(state.playing ? "PLAYING" : "READY", "NOTHING TO PASTE");
      return;
    }
    state.chain = chainClipboard.slice(0, 32);
    state.loopStart = 0;
    state.loopEnd = state.chain.length - 1;
    renderChain();
    renderSongGrid();
    updateUI();
    scheduleSave();
    setStatus(state.playing ? "PLAYING" : "READY", "CHAIN PASTED · " + state.chain.length + " BARS");
    if ($("songPanel") && !$("songPanel").classList.contains("hidden")) fit();
  }

  function clearChain() {
    state.chain = state.chain.map(function () { return "A"; });
    renderChain();
    renderSongGrid();
    updateUI();
    scheduleSave();
    setStatus(state.playing ? "PLAYING" : "READY", "CHAIN CLEARED TO A");
  }

  function applyStyle(id) {
    var s = STYLES[id];
    if (!s) return;
    state.style = id;
    state.patterns = s.patterns();
    state.params = mergeStyleParams(s.overrides);
    state.channelVoiceIndex = { LT: 0, MT: 0, HT: 0, RS: 0, CP: 0 };
    state.selectedPattern = "A";
    state.selectedChannel = "BD";
    state.bpm = s.bpm;
    state.swing = s.swing;
    state.accentLevel = s.accent;
    $("bpmInput").value = String(s.bpm);
    $("swingInput").value = String(Math.round(s.swing * 100));
    renderVoiceColumns();
    renderPatternButtons();
    renderStyleButtons();
    renderChain();
    updateUI();
    setStatus(state.playing ? "PLAYING" : "READY", s.label + " · " + s.bpm + " BPM");
    scheduleSave();
  }

  function clearSelected() {
    var pattern = patternForEdit();
    if (state.selectedChannel === "ACCENT") {
      pattern.accent.fill(0);
    } else {
      pattern[state.selectedChannel].fill(0);
    }
    updateStepKeys();
    updateUI();
    scheduleSave();
  }

  function resetAll() {
    state.chain = defaultChain();
    state.loopStart = 0;
    state.loopEnd = state.chain.length - 1;
    state.voiceModes = { hats: "metal", cymbals: "metal", toms: "synth" };
    closeSongPanel();
    applyStyle(state.style);
    state.selectedChannel = "BD";
    renderVoiceModeBar();
    updateUI();
    saveProject();
  }

  function tapTempo() {
    var now = performance.now();
    tapTimes = tapTimes.filter(function (t) { return now - t < 2500; });
    tapTimes.push(now);
    if (tapTimes.length >= 2) {
      var sum = 0;
      for (var i = 1; i < tapTimes.length; i++) sum += tapTimes[i] - tapTimes[i - 1];
      var avg = sum / (tapTimes.length - 1);
      var bpm = clamp(Math.round(60000 / avg), 40, 300);
      state.bpm = bpm;
      $("bpmInput").value = String(bpm);
      setStatus(state.playing ? "PLAYING" : "READY", "BPM " + bpm);
      scheduleSave();
    }
    if (tapTimes.length > 6) tapTimes.shift();
  }

  // --------------------------------------------------------------------
  // UI refresh
  // --------------------------------------------------------------------
  function updateUI() {
    var cols = document.querySelectorAll(".voice-col");
    for (var i = 0; i < cols.length; i++) {
      cols[i].classList.toggle("selected", cols[i].dataset.channel === state.selectedChannel);
    }
    var curPattern = state.selectedPattern;
    $("lcdPattern").querySelector(".lcd-value").textContent = curPattern + " · " + STYLES[state.style].label;
    $("lcdKit").querySelector(".lcd-value").textContent = "HYBRID 808";
    if ($("lcdStyle")) $("lcdStyle").querySelector(".lcd-value").textContent = STYLES[state.style].label;
    $("editTarget").textContent = channelVoiceLabel(state.selectedChannel).toUpperCase();
    $("editPattern").textContent = curPattern;
    updateChainUI();
    var hint = $("selectionHint");
    if (hint) hint.textContent = channelVoiceLabel(state.selectedChannel);
    updateStepKeys();
    if (state.engine) state.engine.setVolume(state.volume);
    var inst = $("instrumentKnob");
    if (inst && inst._set) {
      var idx = CHANNEL_DEFS.findIndex(function (c) { return c.id === state.selectedChannel; });
      inst._set(idx / (CHANNEL_DEFS.length - 1), true);
    }
    var vol = $("volumeKnob");
    if (vol && vol._set) vol._set(state.volume, true);
    var keys = $("stepKeys").children;
    for (var k = 0; k < keys.length; k++) {
      if (keys[k].classList.contains("playing") && k !== lastPlayedStep) keys[k].classList.remove("playing");
    }
  }

  // --------------------------------------------------------------------
  // self test (OfflineAudioContext)
  // --------------------------------------------------------------------
  async function runSelfTest() {
    var result = { mode: "offline", sampleRate: 48000 };
    try {
      var offline = new OfflineAudioContext(2, 48000 * 8, 48000);
      var buffers = await window.decodeSamples(offline, null);
      var engine = new window.HybridEngine(offline, buffers);
      engine.setVoiceModes(state.voiceModes);
      var t = 0.05;
      var events = 0;
      var accents = 0;
      var bars = Math.min(state.chain.length || 4, 4);
      for (var bar = 0; bar < bars; bar++) {
        var pattern = state.patterns[state.chain[bar] || "A"] || state.patterns.A;
        for (var step = 0; step < 16; step++) {
          var accent = !!pattern.accent[step];
          if (accent) accents++;
          for (var i = 0; i < CHANNEL_IDS.length; i++) {
            var id = CHANNEL_IDS[i];
            if (!pattern[id][step]) continue;
            var v = currentVoice(id);
            engine.trigger(v, t, accent, state.params[v], state.accentLevel);
            events++;
          }
          t += 60 / state.bpm / 4;
        }
      }
      var rendered = await offline.startRendering();
      var L = rendered.getChannelData(0);
      var R = rendered.getChannelData(1);
      var peak = 0, sum = 0, clips = 0, bad = 0;
      for (var n = 0; n < L.length; n++) {
        var a = Math.abs(L[n]), b = Math.abs(R[n]);
        if (!isFinite(L[n]) || !isFinite(R[n])) bad++;
        if (a > peak) peak = a;
        if (b > peak) peak = b;
        if (a >= 0.999 || b >= 0.999) clips++;
        sum += L[n] * L[n] + R[n] * R[n];
      }
      var rms = Math.sqrt(sum / (L.length * 2));
      result.events = events;
      result.accentSteps = accents;
      result.debug = {
        style: state.style,
        bpm: state.bpm,
        accentLevel: state.accentLevel,
        volume: state.volume,
        accentsA: state.patterns.A.accent.filter(Boolean).length,
        accentsB: state.patterns.B.accent.filter(Boolean).length,
        bdLevel: state.params.BD.level,
        bdDecay: state.params.BD.decay
      };
      result.peakDb = Math.round(20 * Math.log10(peak + 1e-12) * 100) / 100;
      result.rmsDb = Math.round(20 * Math.log10(rms + 1e-12) * 100) / 100;
      result.clipped = clips;
      result.nonFinite = bad;
      result.ok = events > 40 && clips === 0 && bad === 0 && peak > 0.05;
    } catch (err) {
      result.error = err.message;
      result.stack = err.stack || "";
    }
    showDiag(result);
    window.__DIAG__ = result;
  }

  function showDiag(obj) {
    var el = $("diag");
    el.hidden = false;
    el.textContent = "AUDIO SELF TEST\n" + JSON.stringify(obj, null, 2);
  }

  // --------------------------------------------------------------------
  // project save / restore / export / import
  // --------------------------------------------------------------------
  var STORAGE_KEY = "rc808-project-v1";
  var saveTimer = null;
  var savedTimer = null;

  function normalizePattern(raw) {
    var p = emptyPattern();
    if (!raw) return p;
    CHANNEL_IDS.forEach(function (id) {
      var arr = raw[id];
      if (Array.isArray(arr)) {
        for (var i = 0; i < 16; i++) p[id][i] = arr[i] ? 1 : 0;
      }
    });
    if (Array.isArray(raw.accent)) {
      for (var j = 0; j < 16; j++) p.accent[j] = raw.accent[j] ? 1 : 0;
    }
    return p;
  }

  function normalizeParams(raw) {
    var out = JSON.parse(JSON.stringify(VOICE_DEFAULTS));
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (voice) {
      if (!out[voice] || !raw[voice]) return;
      Object.keys(raw[voice]).forEach(function (param) {
        var n = parseFloat(raw[voice][param]);
        if (isFinite(n)) out[voice][param] = clamp(n, 0, 1);
      });
    });
    return out;
  }

  function projectSnapshot() {
    return {
      version: 1,
      style: state.style,
      patterns: state.patterns,
      params: state.params,
      channelVoiceIndex: state.channelVoiceIndex,
      selectedChannel: state.selectedChannel,
      selectedPattern: state.selectedPattern,
      chain: state.chain,
      loopStart: state.loopStart,
      loopEnd: state.loopEnd,
      voiceModes: state.voiceModes,
      bpm: state.bpm,
      swing: state.swing,
      accentLevel: state.accentLevel,
      volume: state.volume
    };
  }

  function applyProject(p, opts) {
    if (!p || typeof p !== "object") return false;
    opts = opts || {};
    if (STYLES[p.style]) state.style = p.style;
    if (p.patterns) {
      state.patterns = {
        A: normalizePattern(p.patterns.A),
        B: normalizePattern(p.patterns.B)
      };
    }
    if (p.params) state.params = normalizeParams(p.params);
    if (p.channelVoiceIndex && typeof p.channelVoiceIndex === "object") {
      ["LT", "MT", "HT", "RS", "CP"].forEach(function (id) {
        var idx = parseInt(p.channelVoiceIndex[id], 10);
        state.channelVoiceIndex[id] = idx === 1 ? 1 : 0;
      });
    }
    state.selectedPattern = p.selectedPattern === "B" ? "B" : "A";
    var validChannel = CHANNEL_DEFS.some(function (c) { return c.id === p.selectedChannel; });
    state.selectedChannel = validChannel ? p.selectedChannel : "BD";
    if (Array.isArray(p.chain) && p.chain.length) {
      var chain = p.chain.filter(function (x) { return x === "A" || x === "B"; }).slice(0, 32);
      if (chain.length) state.chain = chain;
    }
    state.loopStart = parseInt(p.loopStart, 10);
    state.loopEnd = parseInt(p.loopEnd, 10);
    clampLoopState();
    if (p.voiceModes && typeof p.voiceModes === "object") {
      state.voiceModes = {
        hats: p.voiceModes.hats === "sample" ? "sample" : "metal",
        cymbals: p.voiceModes.cymbals === "sample" ? "sample" : "metal",
        toms: p.voiceModes.toms === "sample" ? "sample" : "synth"
      };
    }
    var bpm = parseInt(p.bpm, 10);
    if (isFinite(bpm)) state.bpm = clamp(bpm, 40, 300);
    var swing = parseFloat(p.swing);
    if (isFinite(swing)) state.swing = clamp(swing, 0, 0.8);
    var accent = parseFloat(p.accentLevel);
    if (isFinite(accent)) state.accentLevel = clamp(accent, 0, 1);
    var vol = parseFloat(p.volume);
    if (isFinite(vol)) state.volume = clamp(vol, 0, 1);

    if (opts.render !== false) {
      $("bpmInput").value = String(state.bpm);
      $("swingInput").value = String(Math.round(state.swing * 100));
      renderVoiceColumns();
      renderPatternButtons();
      renderStyleButtons();
      renderChain();
      renderVoiceModeBar();
      updateUI();
      if (state.engine) state.engine.setVoiceModes(state.voiceModes);
      setStatus(state.playing ? "PLAYING" : "READY",
        STYLES[state.style].label + " · " + state.bpm + " BPM");
    }
    return true;
  }

  function saveProject() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectSnapshot()));
      markSaved();
    } catch (e) { /* localStorage unavailable (private mode / file restrictions) */ }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, 280);
  }

  function markSaved() {
    var el = $("saveState");
    if (!el) return;
    el.textContent = "SAVED ✓";
    el.classList.add("flash");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () {
      el.textContent = "LOCAL SAVE · READY";
      el.classList.remove("flash");
    }, 900);
  }

  function loadProject() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var p = JSON.parse(raw);
      if (!applyProject(p, { render: false })) return false;
      var el = $("saveState");
      if (el) el.textContent = "LOCAL SAVE · LOADED";
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportProject() {
    try {
      var blob = new Blob([JSON.stringify(projectSnapshot(), null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "rhythm-composer-808-project.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 2000);
      setStatus(state.playing ? "PLAYING" : "READY", "PROJECT EXPORTED");
    } catch (e) {
      setStatus("EXPORT ERROR", e.message);
    }
  }

  function importProjectFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var p = JSON.parse(String(reader.result));
        if (state.playing) stop();
        if (!applyProject(p)) throw new Error("invalid project");
        saveProject();
        setStatus("READY", "PROJECT IMPORTED");
      } catch (e) {
        setStatus("IMPORT ERROR", e.message);
      }
    };
    reader.readAsText(file);
  }

  // --------------------------------------------------------------------
  // offline render / WAV export (same engine and patterns as live playback)
  // --------------------------------------------------------------------
  async function renderOfflineBuffer() {
    var stepDur = 60 / state.bpm / 4;
    var bars = state.chain.length || 4;
    var seconds = bars * 16 * stepDur + 3.0;
    var offline = new OfflineAudioContext(2, Math.ceil(seconds * 48000), 48000);
    var buffers = await window.decodeSamples(offline, null);
    var engine = new window.HybridEngine(offline, buffers);
    engine.setVoiceModes(state.voiceModes);
    engine.setVolume(state.volume);
    var t = 0.05;
    for (var bar = 0; bar < bars; bar++) {
      var pattern = state.patterns[state.chain[bar] || "A"] || state.patterns.A;
      for (var step = 0; step < 16; step++) {
        var accent = !!pattern.accent[step];
        for (var i = 0; i < CHANNEL_IDS.length; i++) {
          var id = CHANNEL_IDS[i];
          if (!pattern[id][step]) continue;
          var v = currentVoice(id);
          engine.trigger(v, t, accent, state.params[v] || VOICE_DEFAULTS[v], state.accentLevel);
        }
        t += stepDur;
      }
    }
    return await offline.startRendering();
  }

  function encodeWav16(buffer) {
    var ch = buffer.numberOfChannels;
    var len = buffer.length;
    var sr = buffer.sampleRate;
    var bytes = 44 + len * ch * 2;
    var ab = new ArrayBuffer(bytes);
    var dv = new DataView(ab);
    function ws(off, s) { for (var i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); }
    ws(0, "RIFF");
    dv.setUint32(4, bytes - 8, true);
    ws(8, "WAVE");
    ws(12, "fmt ");
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);
    dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * ch * 2, true);
    dv.setUint16(32, ch * 2, true);
    dv.setUint16(34, 16, true);
    ws(36, "data");
    dv.setUint32(40, len * ch * 2, true);
    var off = 44;
    var data = [];
    for (var c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
    for (var i = 0; i < len; i++) {
      for (var c2 = 0; c2 < ch; c2++) {
        var s = Math.max(-1, Math.min(1, data[c2][i]));
        dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return ab;
  }

  function arrayBufferToBase64(ab) {
    var bytes = new Uint8Array(ab);
    var chunk = 0x8000;
    var parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(""));
  }

  async function downloadRender() {
    if (!state.engine) { setStatus("LOADING", "SAMPLES NOT READY"); return; }
    var btn = $("renderBtn");
    btn.textContent = "…";
    btn.disabled = true;
    setStatus("RENDERING", "4 BARS · 48 kHz WAV");
    try {
      var rendered = await renderOfflineBuffer();
      var blob = new Blob([encodeWav16(rendered)], { type: "audio/wav" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "rhythm-composer-808-" + state.style + ".wav";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 3000);
      setStatus(state.playing ? "PLAYING" : "READY", "WAV RENDERED");
    } catch (err) {
      setStatus("RENDER ERROR", err.message);
    } finally {
      btn.textContent = "WAV";
      btn.disabled = false;
    }
  }

  // used by web/test_cdp.mjs to verify the browser engine offline
  window.__renderDemoWavBase64 = async function () {
    var rendered = await renderOfflineBuffer();
    return arrayBufferToBase64(encodeWav16(rendered));
  };
  window.__loadStyle = applyStyle;
  window.__styles = Object.keys(STYLES);
  window.__setVoiceModes = function (modes) {
    state.voiceModes = {
      hats: modes && modes.hats === "sample" ? "sample" : "metal",
      cymbals: modes && modes.cymbals === "sample" ? "sample" : "metal",
      toms: modes && modes.toms === "sample" ? "sample" : "synth"
    };
    if (state.engine) state.engine.setVoiceModes(state.voiceModes);
    renderVoiceModeBar();
    scheduleSave();
    return state.voiceModes;
  };
  window.__debugState = function () {
    return JSON.parse(JSON.stringify({
      style: state.style, bpm: state.bpm, swing: state.swing,
      accentLevel: state.accentLevel, volume: state.volume,
      selectedChannel: state.selectedChannel, selectedPattern: state.selectedPattern,
      chain: state.chain, loopStart: state.loopStart, loopEnd: state.loopEnd,
      voiceModes: state.voiceModes,
      params: state.params, patterns: state.patterns,
      channelVoiceIndex: state.channelVoiceIndex, playing: state.playing
    }));
  };
  window.__project = {
    snapshot: projectSnapshot,
    apply: function (p) { var ok = applyProject(p); if (ok) saveProject(); return ok; },
    save: saveProject,
    load: loadProject,
    storageKey: STORAGE_KEY
  };

  // --------------------------------------------------------------------
  // layout scaling
  // --------------------------------------------------------------------
  function fit() {
    var stage = $("stage");
    var machine = $("machine");
    machine.style.transform = "none";
    var w = machine.offsetWidth;
    var h = machine.offsetHeight;
    var scale = Math.min((window.innerWidth - 24) / w, (window.innerHeight - 24) / h, 1.15);
    machine.style.transform = "scale(" + Math.max(0.45, scale) + ")";
    stage.style.height = Math.ceil(h * Math.max(0.45, scale) + 24) + "px";
  }

  // --------------------------------------------------------------------
  // boot
  // --------------------------------------------------------------------
  function attachEvents() {
    $("startBtn").addEventListener("click", start);
    $("clearBtn").addEventListener("click", function (e) {
      if (e.shiftKey) {
        state.patterns = { A: emptyPattern(), B: emptyPattern() };
        renderPatternButtons();
        updateUI();
        scheduleSave();
      } else {
        clearSelected();
      }
    });
    $("resetBtn").addEventListener("click", resetAll);
    $("renderBtn").addEventListener("click", downloadRender);
    $("tapBtn").addEventListener("click", tapTempo);
    $("songBtn").addEventListener("click", openSongPanel);
    $("closeSongBtn").addEventListener("click", closeSongPanel);
    $("copyChainBtn").addEventListener("click", copyChain);
    $("pasteChainBtn").addEventListener("click", pasteChain);
    $("clearChainBtn").addEventListener("click", clearChain);
    $("loopStartInput").addEventListener("change", function () {
      setLoopRange(parseInt(this.value, 10) - 1, state.loopEnd);
    });
    $("loopEndInput").addEventListener("change", function () {
      setLoopRange(state.loopStart, parseInt(this.value, 10) - 1);
    });
    $("exportBtn").addEventListener("click", exportProject);
    $("importBtn").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function () {
      importProjectFile(this.files && this.files[0]);
      this.value = "";
    });
    $("bpmInput").addEventListener("input", function () {
      var v = parseInt(this.value, 10);
      if (!isNaN(v)) state.bpm = clamp(v, 40, 300);
      setStatus(state.playing ? "PLAYING" : "READY", "BPM " + state.bpm);
      scheduleSave();
    });
    $("swingInput").addEventListener("input", function () {
      state.swing = clamp(parseInt(this.value, 10) / 100, 0, 0.8);
      scheduleSave();
    });
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.code === "Space") {
        e.preventDefault();
        start();
      } else if (e.key === "Escape") {
        stop();
      }
    });
    window.addEventListener("resize", fit);
    window.addEventListener("error", function (e) {
      showDiag({ jsError: e.message, source: e.filename, line: e.lineno });
    });
  }

  function createLeftControls() {
    var volHost = $("volumeKnob");
    var vol = makeKnob({
      label: "VOLUME",
      size: "xl",
      value: state.volume,
      defaultValue: 0.8,
      aria: "Master volume",
      format: pct,
      onChange: function (v) {
        state.volume = v;
        if (state.engine) state.engine.setVolume(v);
        scheduleSave();
      }
    });
    volHost.appendChild(vol.el);
    volHost._set = vol.set;

    var instHost = $("instrumentKnob");
    var inst = makeKnob({
      label: "INSTRUMENT SELECT",
      size: "xl",
      value: 1 / (CHANNEL_DEFS.length - 1),
      defaultValue: 1 / (CHANNEL_DEFS.length - 1),
      aria: "Instrument select",
      format: function (v) {
        var idx = Math.round(v * (CHANNEL_DEFS.length - 1));
        return channelVoiceLabel(CHANNEL_DEFS[idx].id).split(" ")[0];
      },
      onChange: function (v) {
        var idx = Math.round(v * (CHANNEL_DEFS.length - 1));
        state.selectedChannel = CHANNEL_DEFS[idx].id;
        updateUI();
        scheduleSave();
      }
    });
    instHost.appendChild(inst.el);
    instHost._set = inst.set;
    vol.set(state.volume, true);
    var idx = CHANNEL_DEFS.findIndex(function (c) { return c.id === state.selectedChannel; });
    inst.set(idx / (CHANNEL_DEFS.length - 1), true);
  }

  function boot() {
    attachEvents();
    renderStepKeys();

    var loaded = loadProject();
    var query = new URLSearchParams(location.search);
    var startStyle = query.get("style");
    if (STYLES[startStyle]) {
      applyStyle(startStyle);
    } else if (!loaded) {
      applyStyle("house");
    } else {
      $("bpmInput").value = String(state.bpm);
      $("swingInput").value = String(Math.round(state.swing * 100));
      renderVoiceColumns();
      renderPatternButtons();
      renderStyleButtons();
      renderChain();
      updateUI();
      setStatus("READY", STYLES[state.style].label + " · " + state.bpm + " BPM");
    }

    renderSongControls();
    renderVoiceModeBar();
    createLeftControls();
    fit();
    setTimeout(fit, 60);
    bootAudio();
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
