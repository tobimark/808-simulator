/* 808-style hybrid audio engine — browser version.
 *
 * Samples: FreePats Synthesizer Percussion (CC0 1.0), embedded as base64 in
 * samples.js. Synth layers are original code ported from prototype/808_poc.py.
 * No Roland samples or logos are used.
 */
(function () {
  "use strict";

  var PAN = {
    BD: 0.0, SD: 0.0,
    LT: -0.30, LC: -0.30, MT: 0.0, MC: 0.0, HT: 0.30, HC: 0.30,
    RS: -0.15, CL: -0.15, CP: 0.0, MA: -0.40,
    CB: 0.30, CY: 0.35, OH: 0.30, CH: -0.30
  };

  var VOICE_GAIN = {
    BD: 1.0, SD: 0.9, LT: 0.8, LC: 0.8, MT: 0.8, MC: 0.8, HT: 0.8, HC: 0.8,
    RS: 0.9, CL: 0.8, CP: 0.9, MA: 0.8, CB: 0.9, CY: 0.9, OH: 0.85, CH: 0.85
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function base64ToArrayBuffer(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function decodeSamples(ctx, onProgress) {
    var names = Object.keys(window.HYBRID_SAMPLES_B64);
    var out = {};
    var done = 0;
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var buf = base64ToArrayBuffer(window.HYBRID_SAMPLES_B64[name]);
      out[name] = await new Promise(function (resolve, reject) {
        ctx.decodeAudioData(buf.slice(0), resolve, reject);
      });
      done++;
      if (onProgress) onProgress(done, names.length);
    }
    return out;
  }

  function HybridEngine(ctx, buffers) {
    this.ctx = ctx;
    this.buffers = buffers;
    this.master = ctx.createGain();
    this.master.gain.value = 0.56;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    // soft limiter: keeps the summed drums below full scale while adding a
    // gentle analogue-ish saturation on peaks (no samples > 1.0)
    this.limiter = ctx.createWaveShaper();
    var n = 4096;
    var curve = new Float32Array(n);
    var k = 1.7;
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / (n - 1) - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    this.limiter.curve = curve;
    this.limiter.oversample = "2x";

    this.master.connect(comp);
    comp.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.activeOH = [];
    this.noise = this._makeNoise(3.0);
    this.volume = 0.8;
    this.modes = { hats: "sample", cymbals: "sample", toms: "sample" };
  }

  HybridEngine.prototype.setVoiceModes = function (modes) {
    this.modes = {
      hats: modes && modes.hats === "metal" ? "metal" : "sample",
      cymbals: modes && modes.cymbals === "metal" ? "metal" : "sample",
      toms: modes && modes.toms === "synth" ? "synth" : "sample"
    };
  };

  HybridEngine.prototype._makeNoise = function (seconds) {
    var n = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    var buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    var seed = 0x1234567;
    for (var i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
    return buf;
  };

  HybridEngine.prototype.setVolume = function (v) {
    this.volume = clamp(v, 0, 1);
    var target = 0.73 * Math.pow(this.volume, 1.15);
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  };

  HybridEngine.prototype._out = function (voice, level, accent, accentLevel) {
    var ctx = this.ctx;
    var g = ctx.createGain();
    var acc = accent
      ? (0.85 + 0.30 * accentLevel)
      : (0.58 + 0.12 * accentLevel);
    g.gain.value = level * VOICE_GAIN[voice] * acc;
    var pan = ctx.createStereoPanner();
    pan.pan.value = PAN[voice] || 0;
    g.connect(pan);
    pan.connect(this.master);
    return g;
  };

  HybridEngine.prototype._sample = function (name, time, out, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = opts.rate || 1;
    var node = src;

    if (opts.lp) {
      var f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = clamp(opts.lp, 200, 18000);
      f.Q.value = 0.707;
      node.connect(f);
      node = f;
    }
    var g = ctx.createGain();
    var gain = opts.gain == null ? 1 : opts.gain;
    if (opts.tau) {
      g.gain.setValueAtTime(Math.max(0.0001, gain), time);
      var end = time + Math.max(0.06, Math.min(4.0, opts.tau * 6));
      g.gain.exponentialRampToValueAtTime(0.0001, end);
    } else {
      g.gain.setValueAtTime(gain, time);
    }
    node.connect(g);
    g.connect(out);
    src.start(time);
    src.stop(time + Math.min(8, src.buffer.duration / (opts.rate || 1)) + 0.05);
    return { src: src, gain: g };
  };

  HybridEngine.prototype._osc = function (type, hz, time, out, env) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, time);
    var g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, env.peak), time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.02, env.tau * 5));
    osc.connect(g);
    g.connect(out);
    osc.start(time);
    osc.stop(time + Math.max(0.05, env.tau * 5) + 0.02);
    return osc;
  };

  HybridEngine.prototype._noise = function (time, out, env, filter) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    var node = src;
    if (filter) {
      var f = ctx.createBiquadFilter();
      f.type = filter.type || "highpass";
      f.frequency.value = filter.freq || 1000;
      f.Q.value = filter.q || 0.707;
      node.connect(f);
      node = f;
      if (filter.bp) {
        var f2 = ctx.createBiquadFilter();
        f2.type = "bandpass";
        f2.frequency.value = filter.bp;
        f2.Q.value = filter.q2 || 0.8;
        node.connect(f2);
        node = f2;
      }
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, env.peak), time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.02, env.tau * 5));
    node.connect(g);
    g.connect(out);
    src.start(time);
    src.stop(time + Math.max(0.05, env.tau * 5) + 0.02);
    return src;
  };

  HybridEngine.prototype._metalHit = function (time, out, opts) {
    var ctx = this.ctx;
    var freqs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
    var mix = ctx.createGain();
    mix.gain.value = 0.14;
    var sources = [];
    for (var i = 0; i < freqs.length; i++) {
      var o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = freqs[i] * (opts.detune || 1.0);
      o.connect(mix);
      o.start(time);
      o.stop(time + opts.duration);
      sources.push(o);
    }
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = clamp(opts.cutoff, 1000, 18000);
    hp.Q.value = 0.8;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(opts.peak, time + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.05, opts.tau * 5));
    mix.connect(hp);
    hp.connect(env);
    env.connect(out);

    if (opts.noise) {
      var nz = ctx.createBufferSource();
      nz.buffer = this.noise;
      nz.loop = true;
      var nf = ctx.createBiquadFilter();
      nf.type = "highpass";
      nf.frequency.value = opts.noiseCutoff || 5000;
      var ng = ctx.createGain();
      ng.gain.value = opts.noise;
      nz.connect(nf); nf.connect(ng); ng.connect(env);
      nz.start(time);
      nz.stop(time + opts.duration);
      sources.push(nz);
    }
    return { gain: env, sources: sources };
  };

  HybridEngine.prototype._synthTom = function (voice, time, out, params) {
    var ctx = this.ctx;
    var p = params || {};
    var base = voice === "LT" ? 100 : (voice === "MT" ? 145 : 205);
    var tun = p.tuning == null ? 0.5 : p.tuning;
    base *= Math.pow(2, ((tun - 0.5) * 2 * 6) / 12);
    var dec = p.decay == null ? 0.5 : p.decay;
    var osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base * 1.55, time);
    osc.frequency.exponentialRampToValueAtTime(base, time + 0.025);
    var g = ctx.createGain();
    var tau = 0.22 + 0.35 * dec;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.50, time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.002 + tau * 5);
    osc.connect(g); g.connect(out);
    osc.start(time); osc.stop(time + 0.05 + tau * 5);
    this._noise(time, out, { peak: 0.12, tau: 0.006 },
      { type: "highpass", freq: 1800, q: 0.7 });
  };

  HybridEngine.prototype._chokeOpenHats = function (now) {
    for (var i = 0; i < this.activeOH.length; i++) {
      var h = this.activeOH[i];
      if (h.until <= now) continue;
      try {
        h.gain.gain.cancelScheduledValues(now);
        h.gain.gain.setTargetAtTime(0.0001, now, 0.003);
      } catch (e) { /* ignore */ }
      var sources = h.sources || (h.src ? [h.src] : []);
      for (var j = 0; j < sources.length; j++) {
        try { sources[j].stop(now + 0.03); } catch (e2) { /* already stopped */ }
      }
    }
    this.activeOH = [];
  };

  HybridEngine.prototype.trigger = function (voice, time, accent, params, accentLevel) {
    var ctx = this.ctx;
    var p = params || {};
    var level = p.level == null ? 0.7 : p.level;
    var out = this._out(voice, level, accent, accentLevel == null ? 0.7 : accentLevel);

    switch (voice) {
      case "BD": {
        var tone = p.tone == null ? 0.5 : p.tone;
        var decay = p.decay == null ? 0.55 : p.decay;
        var body = this._sample("bd_808.flac", time, out, {
          lp: 2500 + 9000 * tone, gain: 1.0
        });
        var fEnd = 47 + 18 * tone;
        var fStart = fEnd * 3.4;
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(fStart, time);
        osc.frequency.exponentialRampToValueAtTime(fEnd, time + 0.06);
        var lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 300;
        var sg = ctx.createGain();
        var tau = 0.18 + 1.1 * decay;
        sg.gain.setValueAtTime(0.0001, time);
        sg.gain.linearRampToValueAtTime(0.78, time + 0.002);
        sg.gain.exponentialRampToValueAtTime(0.0001, time + 0.002 + tau * 5);
        osc.connect(lp); lp.connect(sg); sg.connect(out);
        osc.start(time); osc.stop(time + 0.12 + tau * 5);
        break;
      }
      case "SD": {
        var toneS = p.tone == null ? 0.5 : p.tone;
        var snappy = p.snappy == null ? 0.55 : p.snappy;
        this._sample("Snare09.wav", time, out, {
          lp: 3500 + 9000 * toneS, gain: 0.95
        });
        this._noise(time, out, {
          peak: 0.18 + 0.55 * snappy, tau: 0.045 + 0.11 * snappy
        }, { type: "highpass", freq: 900, q: 0.7, bp: 2600, q2: 0.8 });
        break;
      }
      case "LT":
      case "MT":
      case "HT": {
        if (this.modes.toms === "synth") {
          this._synthTom(voice, time, out, p);
          break;
        }
        var name = voice === "LT" ? "LowTom02-01.wav"
          : (voice === "MT" ? "MidTom02-01.wav" : "HighTom02-01.wav");
        var tun = p.tuning == null ? 0.5 : p.tuning;
        var rate = Math.pow(2, ((tun - 0.5) * 2 * 5) / 12);
        this._sample(name, time, out, { gain: 0.85, rate: rate });
        break;
      }
      case "LC":
      case "MC":
      case "HC": {
        var base = voice === "LC" ? 200 : (voice === "MC" ? 290 : 410);
        var tunC = p.tuning == null ? 0.5 : p.tuning;
        var rateC = Math.pow(2, ((tunC - 0.5) * 2 * 6) / 12);
        base *= rateC;
        var decC = p.decay == null ? 0.45 : p.decay;
        var oscC = ctx.createOscillator();
        oscC.type = "sine";
        oscC.frequency.setValueAtTime(base * 1.55, time);
        oscC.frequency.exponentialRampToValueAtTime(base, time + 0.02);
        var gC = ctx.createGain();
        var tauC = 0.25 + 0.25 * decC;
        gC.gain.setValueAtTime(0.0001, time);
        gC.gain.linearRampToValueAtTime(0.8, time + 0.002);
        gC.gain.exponentialRampToValueAtTime(0.0001, time + 0.002 + tauC * 5);
        oscC.connect(gC); gC.connect(out);
        oscC.start(time); oscC.stop(time + 0.05 + tauC * 5);
        break;
      }
      case "RS": {
        this._osc("sine", 1700, time, out, { peak: 0.7, tau: 0.018 });
        this._noise(time, out, { peak: 0.45, tau: 0.008 },
          { type: "highpass", freq: 4000, q: 0.8 });
        break;
      }
      case "CL":
        this._sample("Claves01.wav", time, out, { gain: 0.75 });
        break;
      case "CP":
        this._sample("Clap01.wav", time, out, { gain: 0.9 });
        break;
      case "MA":
        this._noise(time, out, { peak: 0.7, tau: 0.025 },
          { type: "highpass", freq: 6500, q: 0.7 });
        break;
      case "CB": {
        var o1 = ctx.createOscillator(); o1.type = "square"; o1.frequency.value = 540;
        var o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = 800;
        var mix = ctx.createGain(); mix.gain.value = 0.22;
        o1.connect(mix); o2.connect(mix);
        var dry = ctx.createGain(); dry.gain.value = 0.30;
        var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = 2600; bp.Q.value = 1.2;
        var bpGain = ctx.createGain(); bpGain.gain.value = 0.85;
        mix.connect(dry); mix.connect(bp); bp.connect(bpGain);
        var env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(0.9, time + 0.002);
        env.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);
        dry.connect(env); bpGain.connect(env); env.connect(out);
        o1.start(time); o2.start(time); o1.stop(time + 1.45); o2.stop(time + 1.45);
        break;
      }
      case "CY": {
        var toneC = p.tone == null ? 0.5 : p.tone;
        var decayC = p.decay == null ? 0.6 : p.decay;
        if (this.modes.cymbals === "metal") {
          this._metalHit(time, out, {
            cutoff: 4200 + 4200 * toneC,
            peak: 1.1,
            tau: 0.75 + 1.1 * decayC,
            duration: 2.8,
            noise: 0.22,
            noiseCutoff: 4500
          });
          break;
        }
        this._sample("Cymbal02.wav", time, out, {
          lp: 3000 + 12000 * toneC, gain: 0.9, tau: 0.35 + 1.8 * decayC
        });
        break;
      }
      case "OH": {
        var decayO = p.decay == null ? 0.5 : p.decay;
        var toneO = p.tone == null ? 0.5 : p.tone;
        if (this.modes.hats === "metal") {
          var ohM = this._metalHit(time, out, {
            cutoff: 6200 + 2200 * toneO,
            peak: 2.0,
            tau: 0.19 + 0.42 * decayO,
            duration: 1.3,
            noise: 0.10,
            noiseCutoff: 6500
          });
          this.activeOH.push({ gain: ohM.gain, sources: ohM.sources, until: time + 2.0 });
          break;
        }
        var oh = this._sample("OpenHiHat02-01.wav", time, out, {
          gain: 0.85, tau: 0.18 + 0.65 * decayO
        });
        this.activeOH.push({ gain: oh.gain, sources: [oh.src], until: time + 2.0 });
        break;
      }
      case "CH": {
        var toneH = p.tone == null ? 0.5 : p.tone;
        if (this.modes.hats === "metal") {
          this._metalHit(time, out, {
            cutoff: 7000 + 2400 * toneH,
            peak: 2.6,
            tau: 0.026 + 0.022 * toneH,
            duration: 0.22,
            noise: 0.05,
            noiseCutoff: 8000
          });
          this._chokeOpenHats(time);
          break;
        }
        this._sample("ClosedHiHat01-01.wav", time, out, { gain: 0.85 });
        this._chokeOpenHats(time);
        break;
      }
      default:
        break;
    }
  };

  HybridEngine.prototype.panic = function () {
    var now = this.ctx.currentTime;
    for (var i = 0; i < this.activeOH.length; i++) {
      var h = this.activeOH[i];
      try {
        h.gain.gain.cancelScheduledValues(now);
        h.gain.gain.setTargetAtTime(0.0001, now, 0.01);
      } catch (e) { /* ignore */ }
      var sources = h.sources || (h.src ? [h.src] : []);
      for (var j = 0; j < sources.length; j++) {
        try { sources[j].stop(now + 0.05); } catch (e2) { /* ignore */ }
      }
    }
    this.activeOH = [];
  };

  window.HybridEngine = HybridEngine;
  window.decodeSamples = decodeSamples;
  window.HYBRID_PAN = PAN;
})();
