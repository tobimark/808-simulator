#!/usr/bin/env python3
"""Demo: sequence the FreePats CC0 synthesizer-percussion kit.

Purpose
-------
Show that a legally clean, zero-cost sound source exists for the 808 project:
FreePats "Synthesizer Percussion" (CC0 1.0), created by Roberto with Yoshimi /
Geonkick and released as CC0. No attribution is required, no samples from
commercial packs are used.

What this is NOT
----------------
Not a substitute for a real TR-808, and not a final sound design. The kit is
an "approximation to drum kit sounds commonly used on vintage electronic music
made with analog synthesizers". A human still has to listen and judge it.

Run:
    python prototype/freepats_kit_demo.py
Outputs:
    prototype/freepats-cc0-demo.wav       4 bars @ 120 BPM, 24-bit / 48 kHz
    prototype/freepats-cc0-demo.json      event + level statistics
"""

from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np

SR = 48_000
BPM = 120.0
BARS = 4
STEP_DUR = 60.0 / BPM / 4.0
TAIL = 3.0
N = int(round((BARS * 16 * STEP_DUR + TAIL) * SR))

HERE = Path(__file__).resolve().parent
KIT = HERE / "freepats-cc0-kit" / "samples"

# voice -> (sample file, gain, pan)
VOICES = {
    "BD": ("Kick06.wav", 0.95, 0.0),
    "SD": ("Snare09.wav", 0.62, 0.0),
    "CP": ("Clap01.wav", 0.45, 0.0),
    "CH": ("ClosedHiHat01-01.wav", 0.30, -0.30),
    "OH": ("OpenHiHat02-01.wav", 0.26, 0.30),
    "CY": ("Cymbal02.wav", 0.28, 0.35),
    "RS": ("Claves01.wav", 0.25, -0.15),
    "MA": ("Shaker04.wav", 0.16, -0.40),
    "LT": ("LowTom02-01.wav", 0.40, -0.25),
    "MT": ("MidTom02-01.wav", 0.40, 0.0),
    "HT": ("HighTom02-01.wav", 0.40, 0.25),
}

_sound_cache: dict[str, np.ndarray] = {}


def load_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as f:
        assert f.getframerate() == SR, f"{path} is not 48 kHz"
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
        raise ValueError(f"unsupported sample width: {width}")
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x


def voice(inst: str) -> np.ndarray:
    if inst not in _sound_cache:
        fname, _, _ = VOICES[inst]
        _sound_cache[inst] = load_wav(KIT / fname)
    return _sound_cache[inst]


def pattern_bars():
    bar_a = {
        "BD": [(0, True), (4, False), (8, True), (12, False)],
        "SD": [(4, False), (12, True)],
        "CP": [(4, False), (12, True)],
        "CH": [(0, True), (4, False), (8, True), (12, False)],
        "OH": [(2, False), (6, False), (10, False), (14, False)],
        "RS": [(7, False), (15, False)],
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


def pan_gains(p):
    theta = (p + 1.0) * np.pi / 4.0
    return float(np.cos(theta)), float(np.sin(theta))


def write_wav24(path: Path, left, right):
    inter = np.empty(left.size * 2)
    inter[0::2], inter[1::2] = left, right
    ints = np.clip(np.round(inter * 8388607.0), -8388608, 8388607).astype(np.int32)
    u = (ints.astype(np.uint32) & 0x00FFFFFF)
    raw = np.empty(u.size * 3, dtype=np.uint8)
    raw[0::3] = (u & 0xFF).astype(np.uint8)
    raw[1::3] = ((u >> 8) & 0xFF).astype(np.uint8)
    raw[2::3] = ((u >> 16) & 0xFF).astype(np.uint8)
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(3)
        f.setframerate(SR)
        f.writeframes(raw.tobytes())


def main():
    events = []
    for bar, pat in enumerate(pattern_bars()):
        for inst, steps in pat.items():
            for step, accent in steps:
                gstep = bar * 16 + step
                events.append({
                    "inst": inst,
                    "step": step + 1,
                    "bar": bar + 1,
                    "accent": accent,
                    "sample": int(round(gstep * STEP_DUR * SR)),
                })
    events.sort(key=lambda e: (e["sample"], e["inst"]))

    # closed hat chokes the open hat (shared-circuit behaviour)
    ch_times = [e["sample"] for e in events if e["inst"] == "CH"]
    for e in events:
        if e["inst"] == "OH":
            nxt = [t for t in ch_times if t > e["sample"]]
            if nxt:
                e["max_len"] = min(nxt[0] - e["sample"], int(1.5 * SR))

    L = np.zeros(N)
    R = np.zeros(N)
    for e in events:
        x = voice(e["inst"]).copy()
        fname, gain, pan = VOICES[e["inst"]]
        if "max_len" in e and e["max_len"] < x.size:
            x = x[: e["max_len"]].copy()
            fade = min(int(0.003 * SR), x.size)
            x[-fade:] *= np.linspace(1.0, 0.0, fade)
        x *= gain * (1.0 if e["accent"] else 0.72)
        gl, gr = pan_gains(pan)
        start = e["sample"]
        end = min(N, start + x.size)
        L[start:end] += x[: end - start] * gl
        R[start:end] += x[: end - start] * gr

    peak = max(float(np.max(np.abs(L))), float(np.max(np.abs(R)))) or 1.0
    L = L / peak * 0.89
    R = R / peak * 0.89
    write_wav24(HERE / "freepats-cc0-demo.wav", L, R)
    stats = {
        "source": "FreePats Synthesizer Percussion (CC0 1.0), 2022-07-18",
        "source_url": "https://freepats.zenvoid.org/Percussion/electric-percussion.html",
        "sample_rate": SR,
        "bpm": BPM,
        "bars": BARS,
        "events": len(events),
        "duration_s": round(N / SR, 3),
        "peak_dbfs": round(20 * np.log10(float(np.max(np.abs(L))) + 1e-12), 2),
        "rms_dbfs": round(20 * np.log10(float(np.sqrt(np.mean((L ** 2 + R ** 2) / 2))) + 1e-12), 2),
        "limitations": [
            "kit is a synthesised approximation, not a TR-808 recording",
            "no cowbell / rimshot / conga / maracas in the FreePats kit",
            "no Tone/Decay/Snappy/Accent parameter modelling yet",
        ],
    }
    (HERE / "freepats-cc0-demo.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
