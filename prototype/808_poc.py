#!/usr/bin/env python3
"""808 simulator - sound & timing proof-of-concept (not a product).

Goal: prove two of the highest-risk engineering claims from
docs/ios-808-research.zh-CN.md before committing to a platform:

1. 808-style voices can be synthesised from scratch (no uncleared samples).
2. 16th-note sequencing can be sample-accurate, including fractional BPM.

Outputs (next to this file):
  808-poc.wav                 4 bars @ 120 BPM, 24-bit / 48 kHz stereo
  808-poc-analysis.json      level / timing / event statistics
  808-poc-spectrogram.png    waveform + spectrogram overview

This is a deliberately small, deterministic test harness. Each voice is a
separate function so it can later be ported to Web Audio / C++ / AVAudioEngine
without pulling UI code along.
"""

from __future__ import annotations

import json
import struct
import wave
from pathlib import Path

import numpy as np

SR = 48_000
BPM = 120.0
BARS = 4
STEPS_PER_BAR = 16
STEP_DUR = 60.0 / BPM / 4.0          # 16th note, 0.125 s @ 120 BPM
TAIL = 2.0
DUR = BARS * STEPS_PER_BAR * STEP_DUR + TAIL
N = int(round(DUR * SR))

OUT = Path(__file__).resolve().parent

# 808-style metallic oscillator bank (six detuned square waves).
METAL_HZ = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)


# --------------------------------------------------------------------------
# tiny DSP helpers (numpy only; no scipy in this environment)
# --------------------------------------------------------------------------

def biquad(x: np.ndarray, b, a) -> np.ndarray:
    """Direct-form-I biquad. Signals here are one-shots, so a loop is fine."""
    x = np.asarray(x, dtype=np.float64)
    y = np.empty_like(x)
    b0, b1, b2 = b[0] / a[0], b[1] / a[0], b[2] / a[0]
    a1, a2 = a[1] / a[0], a[2] / a[0]
    x1 = x2 = y1 = y2 = 0.0
    for i in range(x.size):
        xi = x[i]
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, xi
        y2, y1 = y1, yi
        y[i] = yi
    return y


def hp_coeffs(f0: float, q: float = 0.707):
    w0 = 2.0 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2.0 * q)
    return [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2], [1 + alpha, -2 * cw, 1 - alpha]


def bp_coeffs(f0: float, q: float = 1.0):
    w0 = 2.0 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2.0 * q)
    return [alpha, 0.0, -alpha], [1 + alpha, -2 * cw, 1 - alpha]


def lp_coeffs(f0: float, q: float = 0.707):
    w0 = 2.0 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2.0 * q)
    return [(1 - cw) / 2, 1 - cw, (1 - cw) / 2], [1 + alpha, -2 * cw, 1 - alpha]


def t_axis(n: int) -> np.ndarray:
    return np.arange(n, dtype=np.float64) / SR


def exp_env(n: int, tau: float, attack: float = 0.0015) -> np.ndarray:
    t = t_axis(n)
    env = np.exp(-t / tau)
    a = max(2, int(attack * SR))
    env[:a] *= np.linspace(0.0, 1.0, a)
    return env


def metal_bank(t: np.ndarray, detune: float = 1.0) -> np.ndarray:
    out = np.zeros_like(t)
    for k, f in enumerate(METAL_HZ):
        out += np.sign(np.sin(2.0 * np.pi * f * detune * t + 0.7 * k))
    return out / len(METAL_HZ)


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


# --------------------------------------------------------------------------
# voices -- each returns a mono float64 one-shot
# --------------------------------------------------------------------------

def kick(accent: bool, tone: float = 0.5, decay: float = 0.55) -> np.ndarray:
    n = int(1.4 * SR)
    t = t_axis(n)
    f_end = 47.0 + 18.0 * tone            # 47..65 Hz
    f_start = f_end * 3.4
    freq = f_end + (f_start - f_end) * np.exp(-t / 0.020)
    phase = 2.0 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * exp_env(n, 0.18 + 1.1 * decay, attack=0.002)

    click_n = int(0.006 * SR)
    click = rng(11).standard_normal(click_n) * exp_env(click_n, 0.0007, attack=2 / SR)
    click = biquad(click, *hp_coeffs(900.0, 0.7))
    click = np.pad(click, (0, n - click_n)) * (0.35 if accent else 0.22)

    out = np.tanh(1.6 * (0.9 * body + click))
    return out


def snare(accent: bool, tone: float = 0.5, snappy: float = 0.55) -> np.ndarray:
    n = int(0.55 * SR)
    t = t_axis(n)
    tune = 0.75 + 0.5 * tone
    body = (np.sin(2 * np.pi * 180.0 * tune * t)
            + 0.8 * np.sin(2 * np.pi * 330.0 * tune * t)) * exp_env(n, 0.10, 0.001)
    noise = rng(12).standard_normal(n)
    noise = biquad(biquad(noise, *hp_coeffs(700.0, 0.6)), *bp_coeffs(2100.0, 0.7))
    snappy_env = exp_env(n, 0.07 + 0.10 * snappy, 0.001)
    out = 0.55 * body + 0.9 * (0.25 + 0.65 * snappy) * noise * snappy_env
    return np.tanh(out * 1.2)


def clap(accent: bool, level: float = 0.7) -> np.ndarray:
    n = int(0.5 * SR)
    t = t_axis(n)
    noise = rng(13).standard_normal(n)
    band = biquad(noise, *bp_coeffs(1150.0, 1.35))
    env = np.zeros(n)
    for delay, amp in ((0.0, 1.0), (0.010, 0.85), (0.021, 0.75), (0.032, 0.68)):
        i = int(delay * SR)
        env[i:] += amp * np.exp(-t[: n - i] / 0.008)
    env += 0.38 * np.exp(-t / 0.14)
    return np.tanh(band * env * (1.1 + 0.25 * level) * 1.2)


def _metal_voice(accent: bool, tau: float, cutoff: float, dur: float,
                 seed: int, noise_mix: float = 0.0) -> np.ndarray:
    n = int(dur * SR)
    t = t_axis(n)
    x = metal_bank(t, detune=1.0)
    x = biquad(x, *hp_coeffs(cutoff, 0.8))
    if noise_mix:
        nz = biquad(rng(seed).standard_normal(n), *hp_coeffs(cutoff * 0.8, 0.7))
        x = (1.0 - noise_mix) * x + noise_mix * nz
    x = x * exp_env(n, tau, 0.001)
    if accent:
        x = np.tanh(x * 1.4)
    return x


def closed_hat(accent: bool, tone: float = 0.5) -> np.ndarray:
    return _metal_voice(accent, 0.030 + 0.015 * tone, 7400.0 + 600.0 * tone,
                        0.18, 21)


def open_hat(accent: bool, decay: float = 0.5) -> np.ndarray:
    return _metal_voice(accent, 0.24 + 0.35 * decay, 6900.0, 1.2, 22)


def cymbal(accent: bool, tone: float = 0.5, decay: float = 0.6) -> np.ndarray:
    return _metal_voice(accent, 0.9 + 0.9 * decay, 5200.0 + 500.0 * tone,
                        2.0, 23, noise_mix=0.18)


def rimshot(accent: bool) -> np.ndarray:
    n = int(0.15 * SR)
    t = t_axis(n)
    osc = np.sin(2 * np.pi * 1700.0 * t) * exp_env(n, 0.018, 0.0005)
    click = biquad(rng(24).standard_normal(n), *bp_coeffs(4000.0, 0.8))
    click *= exp_env(n, 0.008, 0.0005)
    return np.tanh(0.8 * osc + 0.5 * click)


def bl_square(freq: float, t: np.ndarray, max_hz: float = 10_000.0) -> np.ndarray:
    """Band-limited square (additive odd harmonics) instead of sign(sin())
    which aliases near Nyquist. Closer to an analogue 808 tone generator."""
    out = np.zeros_like(t)
    kmax = max(1, int(max_hz / freq))
    for k in range(1, kmax + 1, 2):
        out += np.sin(2.0 * np.pi * freq * k * t) / k
    return out * (4.0 / np.pi)


def cowbell(accent: bool) -> np.ndarray:
    n = int(0.7 * SR)
    t = t_axis(n)
    raw = bl_square(540.0, t) + bl_square(800.0, t)
    raw = biquad(raw, *lp_coeffs(6000.0, 0.7))
    band = biquad(raw, *bp_coeffs(2600.0, 1.2))
    out = 0.55 * raw + 0.85 * band
    out *= exp_env(n, 0.28, 0.001)
    return np.tanh(out * 0.8)


def maracas(accent: bool) -> np.ndarray:
    n = int(0.14 * SR)
    x = biquad(rng(25).standard_normal(n), *hp_coeffs(6500.0, 0.7))
    return x * exp_env(n, 0.025, 0.001) * 1.4


def claves(accent: bool) -> np.ndarray:
    n = int(0.10 * SR)
    t = t_axis(n)
    return np.sin(2 * np.pi * 2500.0 * t) * exp_env(n, 0.018, 0.0005)


def tom(accent: bool, base_hz: float) -> np.ndarray:
    n = int(0.7 * SR)
    t = t_axis(n)
    freq = base_hz * (1.0 + 0.55 * np.exp(-t / 0.02))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * exp_env(n, 0.32, 0.002)
    click = biquad(rng(26).standard_normal(n), *bp_coeffs(1800.0, 0.9))
    click *= exp_env(n, 0.004, 0.0005)
    return np.tanh(0.95 * body + 0.25 * click)


VOICES = {
    "BD": lambda accent: kick(accent),
    "SD": lambda accent: snare(accent),
    "CP": lambda accent: clap(accent),
    "CH": lambda accent: closed_hat(accent),
    "OH": lambda accent: open_hat(accent),
    "CY": lambda accent: cymbal(accent),
    "RS": lambda accent: rimshot(accent),
    "CB": lambda accent: cowbell(accent),
    "MA": lambda accent: maracas(accent),
    "CLV": lambda accent: claves(accent),
    "LT": lambda accent: tom(accent, 100.0),
    "MT": lambda accent: tom(accent, 145.0),
    "HT": lambda accent: tom(accent, 205.0),
}

LEVELS = {  # peak-ish mix gain per voice (dB reference handled by ear later)
    "BD": 0.62, "SD": 0.46, "CP": 0.38, "CH": 0.22, "OH": 0.20, "CY": 0.22,
    "RS": 0.30, "CB": 0.24, "MA": 0.14, "CLV": 0.18, "LT": 0.34, "MT": 0.34,
    "HT": 0.34,
}

PAN = {  # -1 left .. +1 right
    "BD": 0.0, "SD": 0.0, "CP": 0.0, "CH": -0.30, "OH": 0.30, "CY": 0.35,
    "RS": -0.15, "CB": 0.30, "MA": -0.40, "CLV": 0.20,
    "LT": -0.25, "MT": 0.0, "HT": 0.25,
}


# --------------------------------------------------------------------------
# pattern: 4 bars, A A A B, accents included
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
    bars = pattern_bars()
    events = []
    for bar, pat in enumerate(bars):
        for inst, steps in pat.items():
            for step, accent in steps:
                gstep = bar * STEPS_PER_BAR + step
                events.append({
                    "inst": inst,
                    "bar": bar + 1,
                    "step": step + 1,
                    "gstep": gstep,
                    "accent": accent,
                    "t": gstep * STEP_DUR,
                    "sample": int(round(gstep * STEP_DUR * SR)),
                })
    events.sort(key=lambda e: (e["t"], e["inst"]))
    return events


def choke_open_hats(events):
    """Open and closed hats share a circuit: a closed hat cuts the open hat."""
    ch_times = [e["t"] for e in events if e["inst"] == "CH"]
    for e in events:
        if e["inst"] != "OH":
            continue
        nxt = [t for t in ch_times if t > e["t"] + 1e-9]
        if nxt:
            e["cut"] = min(1.2, nxt[0] - e["t"])
    return events


# --------------------------------------------------------------------------
# render
# --------------------------------------------------------------------------

def pan_gains(p: float) -> tuple[float, float]:
    theta = (p + 1.0) * np.pi / 4.0
    return float(np.cos(theta)), float(np.sin(theta))


def render() -> dict:
    events = choke_open_hats(build_events())
    mix_l = np.zeros(N)
    mix_r = np.zeros(N)
    per_voice_peak = {k: 0.0 for k in VOICES}
    scheduled = []

    for i, e in enumerate(events):
        inst = e["inst"]
        voice = VOICES[inst](e["accent"])
        if inst == "OH" and "cut" in e:
            cut_n = int(e["cut"] * SR)
            if cut_n < voice.size:
                fade = min(int(0.004 * SR), cut_n)
                voice = voice[:cut_n].copy()
                voice[-fade:] *= np.linspace(1.0, 0.0, fade)
        gain = LEVELS[inst] * (1.0 if e["accent"] else 0.70)
        voice = voice * gain
        gl, gr = pan_gains(PAN[inst])
        start = e["sample"]
        end = min(N, start + voice.size)
        seg = voice[: end - start]
        mix_l[start:end] += seg * gl
        mix_r[start:end] += seg * gr
        per_voice_peak[inst] = max(per_voice_peak[inst], float(np.max(np.abs(seg))))
        scheduled.append({
            "inst": inst,
            "bar": e["bar"],
            "step": e["step"],
            "accent": e["accent"],
            "t": round(e["t"], 9),
            "sample": start,
        })

    raw_peak = float(max(np.max(np.abs(mix_l)), np.max(np.abs(mix_r))))
    target = 0.89
    norm = target / raw_peak if raw_peak > 0 else 1.0
    mix_l *= norm
    mix_r *= norm

    # master soft clip safety (should be nearly transparent at 0.89)
    mix_l = np.tanh(mix_l * 1.05) / np.tanh(1.05)
    mix_r = np.tanh(mix_r * 1.05) / np.tanh(1.05)

    write_wav24(OUT / "808-poc.wav", mix_l, mix_r, SR)
    write_voice_audition()

    stats = {
        "sample_rate": SR,
        "bpm": BPM,
        "bars": BARS,
        "duration_s": round(N / SR, 6),
        "step_s": round(STEP_DUR, 9),
        "events": len(scheduled),
        "scheduled_events": scheduled,
        "raw_peak_dbfs": round(20 * np.log10(raw_peak + 1e-12), 2),
        "normalisation_gain_db": round(20 * np.log10(norm + 1e-12), 2),
        "rendered_peak_dbfs": round(20 * np.log10(float(np.max(np.abs(mix_l))) + 1e-12), 2),
        "rendered_rms_dbfs": round(20 * np.log10(float(np.sqrt(np.mean((mix_l ** 2 + mix_r ** 2) / 2))) + 1e-12), 2),
        "clipped_samples": int(np.sum(np.abs(mix_l) >= 0.999) + np.sum(np.abs(mix_r) >= 0.999)),
        "all_finite": bool(np.all(np.isfinite(mix_l)) and np.all(np.isfinite(mix_r))),
        "voiced_peaks_dbfs": {k: round(20 * np.log10(v + 1e-12), 2) for k, v in per_voice_peak.items()},
        "timing_checks": timing_checks(),
        "sound_checks": sound_checks(),
        "hat_choke": hat_choke_check(events),
    }
    (OUT / "808-poc-analysis.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    make_spectrogram(mix_l, mix_r)
    return stats


def hat_choke_check(events) -> dict:
    oh = [e for e in events if e["inst"] == "OH"]
    return {
        "open_hat_events": len(oh),
        "all_choked_by_closed_hat": all("cut" in e for e in oh),
        "choke_gaps_s": sorted({round(e.get("cut", -1), 3) for e in oh}),
        "note": "closed hat truncates the ringing open hat, as on the shared 808 circuit",
    }


def zero_cross_hz(x: np.ndarray) -> float:
    if x.size < 3:
        return 0.0
    zc = np.count_nonzero(np.diff(np.signbit(x)))
    return zc / 2.0 / (x.size / SR)


def spectral_centroid_hz(x: np.ndarray) -> float:
    if x.size < 64:
        return 0.0
    mag = np.abs(np.fft.rfft(x * np.hanning(x.size)))
    freqs = np.fft.rfftfreq(x.size, 1.0 / SR)
    total = mag.sum()
    return float((freqs * mag).sum() / total) if total > 0 else 0.0


def band_energy_ratio(x: np.ndarray, lo: float, hi: float) -> float:
    if x.size < 64:
        return 0.0
    mag = np.abs(np.fft.rfft(x)) ** 2
    freqs = np.fft.rfftfreq(x.size, 1.0 / SR)
    band = mag[(freqs >= lo) & (freqs < hi)].sum()
    total = mag.sum()
    return float(band / total) if total > 0 else 0.0


def sound_checks() -> dict:
    """Objective sanity checks; they do NOT replace listening tests."""
    k = kick(False)
    k_low = biquad(k, *lp_coeffs(300.0, 0.707))
    k_late = k_low[int(0.30 * SR): int(0.50 * SR)]
    sd = snare(False)
    hh = closed_hat(False)
    cc = clap(False)
    cym = cymbal(False)
    cb = cowbell(False)

    # clap should contain >=3 distinct transient bursts in the first 70 ms.
    env = np.abs(cc[: int(0.07 * SR)])
    win = int(0.003 * SR)
    peaks = 0
    ref = float(np.max(env)) if env.size else 0.0
    last = -win
    for i in range(0, max(1, env.size - win), win):
        if ref > 0 and float(np.max(env[i:i + win])) > 0.30 * ref and i - last > win * 2:
            peaks += 1
            last = i

    # dominant body frequency of the snare (below 1 kHz)
    spec = np.abs(np.fft.rfft(sd[: int(0.20 * SR)] * np.hanning(int(0.20 * SR))))
    freqs = np.fft.rfftfreq(int(0.20 * SR), 1.0 / SR)
    body_band = (freqs > 100.0) & (freqs < 1000.0)
    body_peak = float(freqs[body_band][np.argmax(spec[body_band])])

    return {
        "kick_start_hz_lowpassed": round(zero_cross_hz(k_low[: int(0.012 * SR)]), 1),
        "kick_late_hz_lowpassed": round(zero_cross_hz(k_late), 1),
        "kick_pitch_drops": zero_cross_hz(k_low[: int(0.012 * SR)]) > 1.8 * zero_cross_hz(k_late),
        "snare_body_peak_hz": round(body_peak, 1),
        "snare_noise_band_1k_8k": round(band_energy_ratio(sd, 1000.0, 8000.0), 3),
        "closed_hat_centroid_hz": round(spectral_centroid_hz(hh), 1),
        "closed_hat_energy_above_6k": round(band_energy_ratio(hh, 6000.0, 24000.0), 3),
        "cymbal_energy_above_5k": round(band_energy_ratio(cym, 5000.0, 24000.0), 3),
        "cowbell_centroid_hz": round(spectral_centroid_hz(cb), 1),
        "clap_transient_bursts": peaks,
        "notes": "objective signal checks only; no listening test was performed",
    }


def write_voice_audition() -> None:
    """One-shots in a fixed order, 1.2 s apart, for human listening tests."""
    order = ["BD", "SD", "CP", "CH", "OH", "CY", "RS", "CB", "MA", "CLV",
             "LT", "MT", "HT"]
    gap = 1.2
    total = int(len(order) * gap * SR)
    out = np.zeros(total)
    names = []
    for i, inst in enumerate(order):
        v = VOICES[inst](True) * LEVELS[inst]
        start = int(i * gap * SR)
        out[start: start + v.size] += v
        names.append((inst, round(start / SR, 3)))
    peak = float(np.max(np.abs(out))) or 1.0
    out = out / peak * 0.89
    write_wav24(OUT / "808-poc-voices.wav", out, out.copy(), SR)
    (OUT / "808-poc-voices.json").write_text(
        json.dumps({"order": names, "gap_s": gap}, indent=2), encoding="utf-8")


def timing_checks() -> list[dict]:
    """Ideal 16th-note grid vs. nearest sample position, incl. fractional BPM."""
    checks = []
    for bpm in (120.0, 137.0, 96.3, 300.0):
        step = 60.0 / bpm / 4.0
        for bars in (4, 64):
            steps = bars * 16
            err_samples = []
            for k in range(steps):
                ideal = k * step * SR
                err_samples.append(abs(ideal - round(ideal)))
            checks.append({
                "bpm": bpm,
                "bars": bars,
                "steps": steps,
                "max_rounding_error_samples": round(max(err_samples), 6),
                "loop_samples": round(steps * step * SR, 3),
                "loop_duration_s": round(steps * step, 6),
                "sample_accurate": max(err_samples) <= 0.5 + 1e-9,
            })
    return checks


# --------------------------------------------------------------------------
# output helpers
# --------------------------------------------------------------------------

def write_wav24(path: Path, left: np.ndarray, right: np.ndarray, sr: int) -> None:
    inter = np.empty(left.size * 2, dtype=np.float64)
    inter[0::2] = left
    inter[1::2] = right
    ints = np.clip(np.round(inter * 8_388_607.0), -8_388_608, 8_388_607).astype(np.int32)
    u = (ints.astype(np.uint32) & 0x00FFFFFF)
    raw = np.empty(u.size * 3, dtype=np.uint8)
    raw[0::3] = (u & 0xFF).astype(np.uint8)
    raw[1::3] = ((u >> 8) & 0xFF).astype(np.uint8)
    raw[2::3] = ((u >> 16) & 0xFF).astype(np.uint8)
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(3)
        f.setframerate(sr)
        f.writeframes(raw.tobytes())


def make_spectrogram(left: np.ndarray, right: np.ndarray) -> None:
    from PIL import Image, ImageDraw

    mono = 0.5 * (left + right)
    win, hop = 2048, 256
    frames = 1 + (mono.size - win) // hop
    idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
    spec = np.fft.rfft(mono[idx] * np.hanning(win), axis=1)
    mag = np.abs(spec) / (win / 2.0)          # 0 dB == full-scale sinusoid
    db = 20.0 * np.log10(mag + 1e-9)
    mag01 = np.clip((db + 90.0) / 80.0, 0.0, 1.0)  # -90..-10 dB -> 0..1
    mag01 = mag01 ** 0.8

    palette = np.array([
        [8, 10, 24], [35, 20, 70], [82, 28, 100], [140, 38, 92],
        [196, 62, 60], [232, 118, 34], [248, 190, 60], [252, 250, 210],
    ], dtype=np.uint8)
    pos = np.linspace(0, len(palette) - 1, 256)
    lut = np.stack([np.interp(pos, np.arange(len(palette)), palette[:, c])
                    for c in range(3)], axis=1).astype(np.uint8)
    # flip so low frequencies sit at the bottom
    spec_img = Image.fromarray(lut[(mag01[:, ::-1] * 255).astype(np.uint8)])
    W, H = 1600, 620
    spec_img = spec_img.resize((W, H), Image.Resampling.BILINEAR)

    wave_h = 110
    canvas = Image.new("RGB", (W, H + wave_h), (10, 12, 20))
    canvas.paste(spec_img, (0, 0))

    draw = ImageDraw.Draw(canvas)
    base = H + wave_h // 2
    step = max(1, mono.size // W)
    samples = mono[::step][:W]
    amp = (samples / max(1e-9, np.max(np.abs(samples)))) * (wave_h // 2 - 6)
    for x in range(len(amp) - 1):
        draw.line([(x, base - amp[x]), (x + 1, base - amp[x + 1])],
                  fill=(120, 220, 255), width=1)
    draw.text((10, 8), "808 POC - 4 bars @ 120 BPM - waveform + spectrogram (-90..-10 dB)",
              fill=(255, 255, 255))
    for bar in range(BARS + 1):
        x = int(bar * 4 * STEP_DUR / (N / SR) * W)
        draw.line([(x, 0), (x, H)], fill=(255, 255, 255, 90), width=1)
        draw.text((x + 4, H - 16), f"bar {bar}", fill=(230, 230, 230))
    for label, y in (("20 kHz", 6), ("1 kHz", int(H * 0.78)), ("50 Hz", H - 30)):
        draw.text((W - 60, y), label, fill=(230, 230, 230))
    canvas.save(OUT / "808-poc-spectrogram.png")


if __name__ == "__main__":
    import time
    t0 = time.time()
    stats = render()
    print(json.dumps({k: stats[k] for k in (
        "sample_rate", "bpm", "bars", "duration_s", "events", "raw_peak_dbfs",
        "rendered_peak_dbfs", "rendered_rms_dbfs", "clipped_samples")}, indent=2))
    print("timing:", json.dumps(stats["timing_checks"], indent=2))
    print(f"done in {time.time() - t0:.2f}s -> {OUT}")
