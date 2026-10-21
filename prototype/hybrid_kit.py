#!/usr/bin/env python3
"""Hybrid 808-style kit: FreePats CC0 samples + original synthesis.

Why hybrid
----------
Samples give a believable body/transient quickly; synthesis gives continuous
control (Tone / Decay / Snappy / Tuning) and covers the voices the CC0 kit does
not have (cowbell, rimshot, conga, maracas). This is the "混合音源" route from
docs/sound-acquisition.zh-CN.md: no third-party sample licensing risk for the
synthesised parts, and only CC0 samples for the rest.

What this is NOT
----------------
Not a finished instrument, not calibrated against a real TR-808, and not
listening-tested. Sample voices only *approximate* the original parameter
behaviour (e.g. Tone is mapped to a low-pass filter / playback rate). The
manifest records exactly what was done so it can be replaced voice by voice.

Outputs (in prototype/):
  hybrid-kit-demo.wav          4 bars @ 120 BPM, 24-bit / 48 kHz stereo
  hybrid-kit-voices.wav        all 16 voices, one hit each, 1.2 s apart
  hybrid-kit-manifest.json     voice map, sources, licences, parameters
  hybrid-kit-spectrogram.png   waveform + spectrogram of the demo
  ../assets/provenance.csv     per-file source/licence/hash record

Run:
  python prototype/hybrid_kit.py
"""

from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import wave
from pathlib import Path

import numpy as np

SR = 48_000
BPM = 120.0
STEPS_PER_BAR = 16
BARS = 4
STEP_DUR = 60.0 / BPM / 4.0
TAIL = 3.0
N = int(round((BARS * STEPS_PER_BAR * STEP_DUR + TAIL) * SR))

HERE = Path(__file__).resolve().parent
KIT = HERE / "freepats-cc0-kit"
SAMPLES = KIT / "samples"
ASSETS = HERE.parent / "assets"
SAMPLE_PAGE = "https://freepats.zenvoid.org/Percussion/electric-percussion.html"
DOWNLOAD_DATE = "2026-10-20"


# --------------------------------------------------------------------------
# load the synthesis prototype as a module (its functions stay reusable)
# --------------------------------------------------------------------------

def _load_poc():
    spec = importlib.util.spec_from_file_location("poc808", HERE / "808_poc.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load 808_poc.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


poc = _load_poc()


# --------------------------------------------------------------------------
# sample loading
# --------------------------------------------------------------------------

def load_wav_mono(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as f:
        assert f.getframerate() == SR, f"{path.name}: expected 48 kHz"
        ch, width, n = f.getnchannels(), f.getsampwidth(), f.getnframes()
        raw = f.readframes(n)
    if width == 2:
        x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    elif width == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32)
             | (b[:, 1].astype(np.int32) << 8)
             | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v & 0x800000, v - 0x1000000, v)
        x = v.astype(np.float64) / 8388608.0
    else:
        raise ValueError(f"{path.name}: unsupported width {width}")
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    peak = float(np.max(np.abs(x))) or 1.0
    return x / peak * 0.95


_sample_cache: dict[str, np.ndarray] = {}


def sample(name: str) -> np.ndarray:
    if name not in _sample_cache:
        _sample_cache[name] = load_wav_mono(SAMPLES / name)
    return _sample_cache[name]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# --------------------------------------------------------------------------
# primitive DSP (sample-voice parameters)
# --------------------------------------------------------------------------

def lowpass(x: np.ndarray, cutoff_hz: float) -> np.ndarray:
    cutoff = float(np.clip(cutoff_hz, 300.0, 18_000.0))
    return poc.biquad(x, *poc.lp_coeffs(cutoff, 0.707))


def resample_linear(x: np.ndarray, rate: float) -> np.ndarray:
    """rate > 1 => shorter and higher pitch (like a sampler)."""
    if abs(rate - 1.0) < 1e-6:
        return x
    n = max(2, int(round(x.size / rate)))
    src = np.arange(x.size, dtype=np.float64)
    dst = np.linspace(0.0, x.size - 1.0, n)
    return np.interp(dst, src, x)


def decay_env(x: np.ndarray, tau_s: float) -> np.ndarray:
    n = x.size
    t = np.arange(n, dtype=np.float64) / SR
    env = np.exp(-t / max(0.02, tau_s))
    attack = max(2, int(0.001 * SR))
    env[:attack] *= np.linspace(0.0, 1.0, attack)
    return x * env


def semitone_rate(tuning: float, span: float = 12.0) -> float:
    """tuning 0..1 -> -span..+span semitones (default half an octave each way)."""
    semis = (float(tuning) - 0.5) * 2.0 * span
    return 2.0 ** (semis / 12.0)


# --------------------------------------------------------------------------
# 16 voices over the classic 11 channels (LT/LC, MT/MC, HT/HC, RS/CL,
# CP/MA are switchable pairs)
# --------------------------------------------------------------------------

VOICES: list[dict] = [
    dict(id="BD", label="Bass Drum", channel="BD", kind="hybrid",
         sample="Kick06.wav", params=("level", "tone", "decay"),
         defaults=dict(level=1.00, tone=0.50, decay=0.55), pan=0.0),
    dict(id="SD", label="Snare Drum", channel="SD", kind="hybrid",
         sample="Snare09.wav", params=("level", "tone", "snappy"),
         defaults=dict(level=0.72, tone=0.50, snappy=0.55), pan=0.0),
    dict(id="LT", label="Low Tom", channel="LT", kind="sample",
         sample="LowTom02-01.wav", params=("level", "tuning"),
         defaults=dict(level=0.52, tuning=0.50), pan=-0.25),
    dict(id="LC", label="Low Conga", channel="LT", kind="synth",
         synth="tom", params=("level", "tuning", "decay"),
         defaults=dict(level=0.50, tuning=0.40, decay=0.45), pan=-0.25),
    dict(id="MT", label="Mid Tom", channel="MT", kind="sample",
         sample="MidTom02-01.wav", params=("level", "tuning"),
         defaults=dict(level=0.52, tuning=0.50), pan=0.0),
    dict(id="MC", label="Mid Conga", channel="MT", kind="synth",
         synth="tom", params=("level", "tuning", "decay"),
         defaults=dict(level=0.50, tuning=0.55, decay=0.40), pan=0.0),
    dict(id="HT", label="High Tom", channel="HT", kind="sample",
         sample="HighTom02-01.wav", params=("level", "tuning"),
         defaults=dict(level=0.52, tuning=0.50), pan=0.25),
    dict(id="HC", label="High Conga", channel="HT", kind="synth",
         synth="tom", params=("level", "tuning", "decay"),
         defaults=dict(level=0.50, tuning=0.70, decay=0.35), pan=0.25),
    dict(id="RS", label="Rimshot", channel="RS", kind="synth",
         synth="rimshot", params=("level",), defaults=dict(level=0.42),
         pan=-0.15),
    dict(id="CL", label="Claves", channel="RS", kind="sample",
         sample="Claves01.wav", params=("level",), defaults=dict(level=0.40),
         pan=-0.15),
    dict(id="CP", label="Hand Clap", channel="CP", kind="sample",
         sample="Clap01.wav", params=("level",), defaults=dict(level=0.55),
         pan=0.0),
    dict(id="MA", label="Maracas", channel="CP", kind="synth",
         synth="maracas", params=("level",), defaults=dict(level=0.22),
         pan=-0.40),
    dict(id="CB", label="Cowbell", channel="CB", kind="synth",
         synth="cowbell", params=("level",), defaults=dict(level=0.38),
         pan=0.30),
    dict(id="CY", label="Cymbal", channel="CY", kind="sample",
         sample="Cymbal02.wav", params=("level", "tone", "decay"),
         defaults=dict(level=0.42, tone=0.50, decay=0.60), pan=0.35),
    dict(id="OH", label="Open Hat", channel="OH", kind="sample",
         sample="OpenHiHat02-01.wav", params=("level", "decay"),
         defaults=dict(level=0.34, decay=0.50), pan=0.30),
    dict(id="CH", label="Closed Hat", channel="CH", kind="sample",
         sample="ClosedHiHat01-01.wav", params=("level",),
         defaults=dict(level=0.30), pan=-0.30),
]
VOICE_BY_ID = {v["id"]: v for v in VOICES}


def _p(v: dict, params: dict | None) -> dict:
    out = dict(v["defaults"])
    if params:
        out.update({k: float(val) for k, val in params.items() if k in v["params"]})
    return out


# --------------------------------------------------------------------------
# voice rendering
# --------------------------------------------------------------------------

def render_voice(inst: str, params: dict | None = None) -> np.ndarray:
    v = VOICE_BY_ID[inst]
    p = _p(v, params)

    if inst == "BD":
        body = lowpass(sample("Kick06.wav"), 2500.0 + 9000.0 * p["tone"])
        sub = lowpass(poc.kick(False, tone=p["tone"], decay=p["decay"]), 300.0)
        n = max(body.size, sub.size)
        out = np.zeros(n)
        out[:body.size] += body * 0.95
        out[:sub.size] += sub * 0.75
        return out

    if inst == "SD":
        body = lowpass(sample("Snare09.wav"), 3500.0 + 9000.0 * p["tone"])
        n = int(0.30 * SR)
        noise = poc.rng(1201).standard_normal(n)
        noise = poc.biquad(noise, *poc.hp_coeffs(900.0, 0.7))
        noise = poc.biquad(noise, *poc.bp_coeffs(2600.0, 0.8))
        noise *= poc.exp_env(n, 0.045 + 0.11 * p["snappy"], 0.001)
        out = np.zeros(max(body.size, n))
        out[:body.size] += body * 0.95
        out[:n] += noise * (0.18 + 0.55 * p["snappy"])
        return out

    if inst in ("LT", "MT", "HT"):
        x = sample(v["sample"])
        x = resample_linear(x, semitone_rate(p["tuning"], span=5.0))
        return x

    if inst in ("LC", "MC", "HC"):
        base = {"LC": 200.0, "MC": 290.0, "HC": 410.0}[inst]
        base *= semitone_rate(p["tuning"], span=6.0)
        return poc.tom(False, base) * (0.55 + 0.45 * p["decay"])

    if inst == "RS":
        return poc.rimshot(False)

    if inst == "CL":
        return sample("Claves01.wav")

    if inst == "CP":
        return sample("Clap01.wav")

    if inst == "MA":
        return poc.maracas(False)

    if inst == "CB":
        return poc.cowbell(False)

    if inst == "CY":
        x = lowpass(sample("Cymbal02.wav"), 3000.0 + 12000.0 * p["tone"])
        return decay_env(x, 0.35 + 1.8 * p["decay"])

    if inst == "OH":
        return decay_env(sample("OpenHiHat02-01.wav"), 0.18 + 0.65 * p["decay"])

    if inst == "CH":
        return sample("ClosedHiHat01-01.wav")

    raise KeyError(inst)


# --------------------------------------------------------------------------
# patterns
# --------------------------------------------------------------------------

def pattern_bars() -> list[dict[str, list[tuple[int, bool]]]]:
    bar_a = {
        "BD": [(0, True), (4, False), (8, True), (12, False)],
        "SD": [(4, False), (12, True)],
        "CP": [(4, False), (12, True)],
        "CH": [(0, True), (4, False), (8, True), (12, False)],
        "OH": [(2, False), (6, False), (10, False), (14, False)],
        "RS": [(7, False), (15, False)],
        "CB": [(10, True)],
        "MA": [(1, False), (5, False), (9, False), (13, False)],
    }
    bar_fill = {
        **bar_a,
        "OH": [(2, False), (6, False), (10, False)],
        "LT": [(12, False), (13, False)],
        "MT": [(14, True)],
        "HT": [(15, True)],
        "CY": [(0, True)],
    }
    return [bar_a, bar_a, bar_a, bar_fill]


def build_events():
    events = []
    for bar, pat in enumerate(pattern_bars()):
        for inst, steps in pat.items():
            for step, accent in steps:
                gstep = bar * STEPS_PER_BAR + step
                events.append({
                    "inst": inst,
                    "bar": bar + 1,
                    "step": step + 1,
                    "accent": accent,
                    "sample_pos": int(round(gstep * STEP_DUR * SR)),
                })
    events.sort(key=lambda e: (e["sample_pos"], e["inst"]))
    return events


def pan_gains(p: float) -> tuple[float, float]:
    theta = (p + 1.0) * np.pi / 4.0
    return float(np.cos(theta)), float(np.sin(theta))


def render_demo() -> dict:
    events = build_events()
    ch_positions = [e["sample_pos"] for e in events if e["inst"] == "CH"]
    L = np.zeros(N)
    R = np.zeros(N)
    cache: dict[str, np.ndarray] = {}
    peak_by_voice = {v["id"]: 0.0 for v in VOICES}

    for e in events:
        inst = e["inst"]
        if inst not in cache:
            cache[inst] = render_voice(inst)
        x = cache[inst]
        if inst == "OH":
            nxt = [pos for pos in ch_positions if pos > e["sample_pos"]]
            if nxt:
                cut = nxt[0] - e["sample_pos"]
                if cut < x.size:
                    x = x[:cut].copy()
                    fade = min(int(0.004 * SR), x.size)
                    x[-fade:] *= np.linspace(1.0, 0.0, fade)
        gain = VOICE_BY_ID[inst]["defaults"]["level"] * (1.0 if e["accent"] else 0.72)
        gl, gr = pan_gains(VOICE_BY_ID[inst]["pan"])
        start = e["sample_pos"]
        end = min(N, start + x.size)
        seg = x[: end - start]
        L[start:end] += seg * gain * gl
        R[start:end] += seg * gain * gr
        peak_by_voice[inst] = max(peak_by_voice[inst], float(np.max(np.abs(seg))) * gain)

    raw_peak = max(float(np.max(np.abs(L))), float(np.max(np.abs(R)))) or 1.0
    L = L / raw_peak * 0.89
    R = R / raw_peak * 0.89
    poc.write_wav24(HERE / "hybrid-kit-demo.wav", L, R, SR)
    make_spectrogram(L, R, HERE / "hybrid-kit-spectrogram.png", bars=BARS, title="hybrid kit - FreePats CC0 samples + original synthesis")

    return {
        "file": "hybrid-kit-demo.wav",
        "bpm": BPM,
        "bars": BARS,
        "events": len(events),
        "duration_s": round(N / SR, 3),
        "peak_dbfs": round(20 * np.log10(float(np.max(np.abs(L))) + 1e-12), 2),
        "rms_dbfs": round(20 * np.log10(float(np.sqrt(np.mean((L ** 2 + R ** 2) / 2))) + 1e-12), 2),
        "clipped_samples": int(np.sum(np.abs(L) >= 0.999) + np.sum(np.abs(R) >= 0.999)),
        "voiced_peaks_dbfs": {k: round(20 * np.log10(v + 1e-12), 2) for k, v in peak_by_voice.items()},
    }


def render_voice_audition() -> dict:
    gap = 1.2
    total = int(len(VOICES) * gap * SR)
    out = np.zeros(total)
    order = []
    for i, v in enumerate(VOICES):
        x = render_voice(v["id"]) * v["defaults"]["level"]
        start = int(i * gap * SR)
        end = min(total, start + x.size)
        out[start:end] += x[: end - start]
        order.append({"id": v["id"], "label": v["label"], "start_s": round(start / SR, 3)})
    peak = float(np.max(np.abs(out))) or 1.0
    out = out / peak * 0.89
    poc.write_wav24(HERE / "hybrid-kit-voices.wav", out, out.copy(), SR)
    return {"file": "hybrid-kit-voices.wav", "gap_s": gap, "order": order}


def render_param_audition() -> dict:
    """A/B a few 808 parameters: decay / snappy / tuning."""
    items = [
        ("BD", "BD decay 0.10", {"decay": 0.10}),
        ("BD", "BD decay 0.90", {"decay": 0.90}),
        ("SD", "SD snappy 0.10", {"snappy": 0.10}),
        ("SD", "SD snappy 0.90", {"snappy": 0.90}),
        ("LT", "LT tuning 0.20", {"tuning": 0.20}),
        ("LT", "LT tuning 0.80", {"tuning": 0.80}),
        ("OH", "OH decay 0.10", {"decay": 0.10}),
        ("OH", "OH decay 0.90", {"decay": 0.90}),
        ("CY", "CY decay 0.10", {"decay": 0.10}),
        ("CY", "CY decay 0.90", {"decay": 0.90}),
    ]
    gap = 1.7
    total = int(len(items) * gap * SR)
    out = np.zeros(total)
    order = []
    for i, (inst, label, params) in enumerate(items):
        x = render_voice(inst, params) * VOICE_BY_ID[inst]["defaults"]["level"]
        start = int(i * gap * SR)
        end = min(total, start + x.size)
        out[start:end] += x[: end - start]
        order.append({"voice": inst, "label": label, "start_s": round(start / SR, 3)})
    peak = float(np.max(np.abs(out))) or 1.0
    out = out / peak * 0.89
    poc.write_wav24(HERE / "hybrid-kit-params.wav", out, out.copy(), SR)
    return {"file": "hybrid-kit-params.wav", "gap_s": gap, "order": order}


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(x)) + 1e-18))


def _peak_hz(x: np.ndarray, lo: float = 40.0, hi: float = 800.0) -> float:
    mag = np.abs(np.fft.rfft(x * np.hanning(x.size)))
    freqs = np.fft.rfftfreq(x.size, 1.0 / SR)
    band = (freqs >= lo) & (freqs <= hi)
    return round(float(freqs[band][np.argmax(mag[band])]), 1)


def _band_ratio(x: np.ndarray, lo: float, hi: float) -> float:
    mag = np.abs(np.fft.rfft(x)) ** 2
    freqs = np.fft.rfftfreq(x.size, 1.0 / SR)
    total = float(mag.sum()) or 1.0
    return round(float(mag[(freqs >= lo) & (freqs < hi)].sum() / total), 4)


def run_checks(events: list[dict]) -> dict:
    """Objective parameter-response checks; not a listening test."""
    bd_short = render_voice("BD", {"decay": 0.10})
    bd_long = render_voice("BD", {"decay": 0.90})
    sd_low = render_voice("SD", {"snappy": 0.10})
    sd_high = render_voice("SD", {"snappy": 0.90})
    lt_low = render_voice("LT", {"tuning": 0.20})
    lt_high = render_voice("LT", {"tuning": 0.80})
    oh_short = render_voice("OH", {"decay": 0.10})
    oh_long = render_voice("OH", {"decay": 0.90})
    a, b = int(0.65 * SR), int(1.00 * SR)
    bd_tail = _rms(bd_long[a:min(b, bd_long.size)]) / max(1e-9, _rms(bd_short[a:min(b, bd_short.size)]))
    sd_hf = _band_ratio(sd_high, 3000.0, 12000.0) / max(1e-9, _band_ratio(sd_low, 3000.0, 12000.0))
    oh_tail = _rms(oh_long[int(0.35 * SR):int(0.55 * SR)]) / max(
        1e-9, _rms(oh_short[int(0.35 * SR):int(0.55 * SR)]))

    oh_events = [e for e in events if e["inst"] == "OH"]
    ch_positions = [e["sample_pos"] for e in events if e["inst"] == "CH"]
    choked = sum(1 for e in oh_events if any(p > e["sample_pos"] for p in ch_positions))

    return {
        "all_finite": all(np.all(np.isfinite(x)) for x in
                          (bd_short, bd_long, sd_low, sd_high, lt_low, lt_high, oh_short, oh_long)),
        "bd_decay_tail_ratio": round(bd_tail, 3),
        "bd_decay_responds": bd_tail > 1.2,
        "sd_snappy_high_band_ratio": round(sd_hf, 3),
        "sd_snappy_responds": sd_hf > 1.1,
        "lt_tuning_low_peak_hz": _peak_hz(lt_low),
        "lt_tuning_high_peak_hz": _peak_hz(lt_high),
        "lt_tuning_responds": _peak_hz(lt_high) > 1.3 * _peak_hz(lt_low),
        "oh_decay_tail_ratio": round(oh_tail, 3),
        "oh_decay_responds": oh_tail > 1.2,
        "open_hat_events": len(oh_events),
        "open_hat_choked_by_closed_hat": f"{choked}/{len(oh_events)}",
        "note": "objective signal checks only; no listening test performed",
    }


# --------------------------------------------------------------------------
# manifest + provenance
# --------------------------------------------------------------------------

def build_manifest(demo: dict, audition: dict, param_audition: dict, checks: dict) -> dict:
    used = sorted({v["sample"] for v in VOICES if "sample" in v})
    voices = []
    for v in VOICES:
        item = {
            "id": v["id"],
            "label": v["label"],
            "channel": v["channel"],
            "kind": v["kind"],
            "params": list(v["params"]),
            "defaults": v["defaults"],
            "pan": v["pan"],
        }
        if "sample" in v:
            item["sample"] = v["sample"]
            item["sample_license"] = "CC0 1.0 (FreePats Synthesizer Percussion)"
        if v["kind"] == "hybrid":
            item["synth"] = "original synthesis layer (prototype/808_poc.py)"
        if "synth" in v:
            item["synth"] = f"original synthesis in prototype/808_poc.py ({v['synth']})"
        voices.append(item)

    return {
        "name": "808-style hybrid kit POC",
        "date": DOWNLOAD_DATE,
        "sample_source": {
            "name": "FreePats Synthesizer Percussion (2022-07-18)",
            "url": SAMPLE_PAGE,
            "license": "CC0 1.0 Universal",
            "local_dir": "prototype/freepats-cc0-kit/samples/",
            "used_files": used,
            "provenance": "prototype/freepats-cc0-kit/PROVENANCE.md",
        },
        "synth_source": "prototype/808_poc.py (original code, no third-party samples)",
        "channel_map": {
            "BD": ["BD"], "SD": ["SD"],
            "LT": ["LT", "LC"], "MT": ["MT", "MC"], "HT": ["HT", "HC"],
            "RS": ["RS", "CL"], "CP": ["CP", "MA"],
            "CB": ["CB"], "CY": ["CY"], "OH": ["OH"], "CH": ["CH"],
        },
        "voices": voices,
        "outputs": {"demo": demo, "audition": audition, "param_audition": param_audition},
        "checks": checks,
        "parameter_notes": [
            "BD: FreePats Kick06 body + synthesised low-passed sub; Tone moves sub pitch and body LPF, Decay only the synth tail.",
            "SD: FreePats Snare09 body + synthesised noise layer; Tone is approximated by a LPF, Snappy by noise level/decay.",
            "Toms: Tuning is sample playback rate; no Decay parameter in classic 808 toms.",
            "Congas / Rimshot / Cowbell / Maracas: original synthesis (not from the CC0 kit).",
            "Cymbal / open hat: Tone is approximated by a LPF; Decay by an exponential envelope over the sample.",
            "No listening test has been performed; all levels are provisional.",
        ],
        "licensing_status": "CC0 samples may be redistributed in the app; synth parts are original. See docs/sound-acquisition.zh-CN.md.",
    }


def write_provenance() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    used = {v["sample"] for v in VOICES if "sample" in v}
    rows = []
    for path in sorted(SAMPLES.glob("*.wav")):
        rows.append({
            "internal_id": f"freepats_{path.stem}",
            "file": f"prototype/freepats-cc0-kit/samples/{path.name}",
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "source": SAMPLE_PAGE,
            "author": "Roberto (FreePats project)",
            "license": "CC0 1.0",
            "downloaded": DOWNLOAD_DATE,
            "modified": "none",
            "used_by": "hybrid kit" if path.name in used else "(unused spare)",
            "attribution": "not required (CC0)",
        })
    for v in VOICES:
        if v["kind"] in ("synth", "hybrid"):
            rows.append({
                "internal_id": f"synth_{v['id'].lower()}",
                "file": "(generated at runtime)",
                "bytes": 0,
                "sha256": "",
                "source": "prototype/808_poc.py",
                "author": "this project",
                "license": "original work",
                "downloaded": DOWNLOAD_DATE,
                "modified": "n/a",
                "used_by": f"hybrid kit voice {v['id']}",
                "attribution": "not required",
            })
    fieldnames = list(rows[0].keys())
    with open(ASSETS / "provenance.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


# --------------------------------------------------------------------------
# plot
# --------------------------------------------------------------------------

def make_spectrogram(left: np.ndarray, right: np.ndarray, path: Path, bars: int, title: str) -> None:
    from PIL import Image, ImageDraw

    mono = 0.5 * (left + right)
    win, hop = 2048, 256
    frames = 1 + (mono.size - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
    spec = np.fft.rfft(mono[idx] * np.hanning(win), axis=1)
    mag = np.abs(spec) / (win / 2.0)
    db = 20.0 * np.log10(mag + 1e-9)
    mag01 = np.clip((db + 90.0) / 80.0, 0.0, 1.0) ** 0.8

    palette = np.array([
        [8, 10, 24], [35, 20, 70], [82, 28, 100], [140, 38, 92],
        [196, 62, 60], [232, 118, 34], [248, 190, 60], [252, 250, 210],
    ], dtype=np.uint8)
    pos = np.linspace(0, len(palette) - 1, 256)
    lut = np.stack([np.interp(pos, np.arange(len(palette)), palette[:, c])
                    for c in range(3)], axis=1).astype(np.uint8)
    img = Image.fromarray(lut[(mag01[:, ::-1] * 255).astype(np.uint8)])
    W, H = 1600, 620
    img = img.resize((W, H), Image.Resampling.BILINEAR)
    wave_h = 110
    canvas = Image.new("RGB", (W, H + wave_h), (10, 12, 20))
    canvas.paste(img, (0, 0))
    draw = ImageDraw.Draw(canvas)
    base = H + wave_h // 2
    step = max(1, mono.size // W)
    samples = mono[::step][:W]
    amp = (samples / max(1e-9, np.max(np.abs(samples)))) * (wave_h // 2 - 6)
    for x in range(len(amp) - 1):
        draw.line([(x, base - amp[x]), (x + 1, base - amp[x + 1])],
                  fill=(120, 220, 255), width=1)
    draw.text((10, 8), title, fill=(255, 255, 255))
    total_s = mono.size / SR
    for bar in range(bars + 1):
        x = int(bar * 4 * STEP_DUR / total_s * W)
        draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 90), width=1)
        draw.text((x + 4, H - 16), f"bar {bar}", fill=(230, 230, 230))
    for label, y in (("20 kHz", 6), ("1 kHz", int(H * 0.78)), ("50 Hz", H - 30)):
        draw.text((W - 60, y), label, fill=(230, 230, 230))
    canvas.save(path)


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

if __name__ == "__main__":
    demo = render_demo()
    audition = render_voice_audition()
    param_audition = render_param_audition()
    checks = run_checks(build_events())
    manifest = build_manifest(demo, audition, param_audition, checks)
    (HERE / "hybrid-kit-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    write_provenance()
    print(json.dumps({
        "demo": demo,
        "audition_file": audition["file"],
        "param_audition_file": param_audition["file"],
        "checks": checks,
        "manifest": "prototype/hybrid-kit-manifest.json",
        "provenance": "assets/provenance.csv",
    }, indent=2, ensure_ascii=False))
