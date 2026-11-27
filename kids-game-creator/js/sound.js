// Sound FX Hybrid Engine: Combines Web Audio API with In-Memory PCM WAV Data URIs
// Guarantees audible sound across all browsers, mobile devices, and OS audio configurations

function createWavDataUri(notes, sampleRate = 22050) {
  let totalLen = 0;
  for (const n of notes) totalLen = Math.max(totalLen, (n.start || 0) + n.duration);
  const numSamples = Math.ceil(totalLen * sampleRate);
  const samples = new Float32Array(numSamples);

  for (const n of notes) {
    const startIdx = Math.floor((n.start || 0) * sampleRate);
    const durSamples = Math.floor(n.duration * sampleRate);
    const vol = n.vol ?? 0.8;
    for (let i = 0; i < durSamples; i++) {
      const idx = startIdx + i;
      if (idx >= numSamples) break;
      const t = i / sampleRate;
      const progress = i / durSamples;
      const env = Math.sin(Math.min(1, progress * 8) * Math.PI / 2) * Math.pow(1 - progress, 1.6);
      const freq = typeof n.freq === "function" ? n.freq(progress) : n.freq;
      const phase = 2 * Math.PI * freq * t;
      let wave = 0;
      if (n.type === "square") {
        wave = Math.sin(phase) >= 0 ? 0.7 : -0.7;
      } else if (n.type === "triangle") {
        wave = Math.asin(Math.sin(phase)) * (2 / Math.PI);
      } else if (n.type === "sawtooth") {
        wave = 2 * (t * freq - Math.floor(0.5 + t * freq));
      } else {
        wave = Math.sin(phase);
      }
      samples[idx] += wave * env * vol;
    }
  }

  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.wavCache = {};
  }

  init() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {}
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playAudioTag(name, notes) {
    if (!this.enabled || typeof window === "undefined" || typeof Audio === "undefined") return;
    try {
      if (!this.wavCache[name]) {
        this.wavCache[name] = createWavDataUri(notes);
      }
      const soundObj = new Audio(this.wavCache[name]);
      soundObj.volume = 1.0;
      soundObj.play().catch(() => {});
    } catch {}
  }

  playWebTone(freq, duration, type = "sine", vol = 0.6) {
    if (!this.enabled || typeof window === "undefined") return;
    const ctx = this.init();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = Math.max(ctx.currentTime, 0.005);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {}
  }

  playTestSound() {
    // Loud, clear 3-note chime (E5 -> G5 -> C6)
    this.playAudioTag("test", [
      { freq: 659.25, duration: 0.18, vol: 0.9, type: "triangle", start: 0 },
      { freq: 783.99, duration: 0.20, vol: 0.92, type: "triangle", start: 0.12 },
      { freq: 1046.5, duration: 0.42, vol: 0.98, type: "sine", start: 0.24 }
    ]);
    this.playWebTone(659.25, 0.2, "triangle", 0.7);
    setTimeout(() => this.playWebTone(783.99, 0.22, "triangle", 0.75), 120);
    setTimeout(() => this.playWebTone(1046.5, 0.42, "sine", 0.8), 240);
  }

  playJump() {
    this.playAudioTag("jump", [
      { freq: p => 180 + p * 420, duration: 0.18, vol: 0.85, type: "triangle", start: 0 }
    ]);
    this.playWebTone(320, 0.16, "triangle", 0.65);
  }

  playCollect() {
    this.playAudioTag("collect", [
      { freq: 523.25, duration: 0.10, vol: 0.8, type: "sine", start: 0 },
      { freq: 659.25, duration: 0.12, vol: 0.85, type: "sine", start: 0.05 },
      { freq: 783.99, duration: 0.18, vol: 0.9, type: "triangle", start: 0.10 }
    ]);
    this.playWebTone(659.25, 0.14, "sine", 0.65);
  }

  playHit() {
    this.playAudioTag("hit", [
      { freq: p => 200 - p * 130, duration: 0.22, vol: 0.9, type: "sawtooth", start: 0 }
    ]);
    this.playWebTone(110, 0.20, "sawtooth", 0.65);
  }

  playWin() {
    this.playAudioTag("win", [
      { freq: 523.25, duration: 0.16, vol: 0.85, type: "triangle", start: 0 },
      { freq: 659.25, duration: 0.16, vol: 0.85, type: "triangle", start: 0.12 },
      { freq: 783.99, duration: 0.20, vol: 0.9, type: "triangle", start: 0.24 },
      { freq: 1046.5, duration: 0.50, vol: 0.95, type: "sine", start: 0.36 }
    ]);
    this.playWebTone(1046.5, 0.45, "sine", 0.7);
  }

  playLose() {
    this.playAudioTag("lose", [
      { freq: 440, duration: 0.18, vol: 0.85, type: "sawtooth", start: 0 },
      { freq: 392, duration: 0.18, vol: 0.85, type: "sawtooth", start: 0.12 },
      { freq: 349.23, duration: 0.20, vol: 0.85, type: "sawtooth", start: 0.24 },
      { freq: 261.63, duration: 0.38, vol: 0.9, type: "sawtooth", start: 0.36 }
    ]);
    this.playWebTone(261.63, 0.35, "sawtooth", 0.65);
  }

  playClick() {
    this.playAudioTag("click", [
      { freq: 880, duration: 0.08, vol: 0.8, type: "sine", start: 0 }
    ]);
    this.playWebTone(880, 0.07, "sine", 0.55);
  }

  playCombo(streak = 1) {
    const base = 523.25 * Math.pow(1.06, Math.min(12, streak));
    this.playAudioTag(`combo_${Math.min(12, streak)}`, [
      { freq: base, duration: 0.11, vol: 0.85, type: "sine", start: 0 },
      { freq: base * 1.25, duration: 0.16, vol: 0.9, type: "triangle", start: 0.06 }
    ]);
    this.playWebTone(base * 1.25, 0.14, "triangle", 0.65);
  }

  playPowerUp() {
    this.playAudioTag("powerup", [
      { freq: 392, duration: 0.10, vol: 0.8, type: "triangle", start: 0 },
      { freq: 523.25, duration: 0.10, vol: 0.8, type: "triangle", start: 0.05 },
      { freq: 659.25, duration: 0.10, vol: 0.85, type: "triangle", start: 0.10 },
      { freq: 783.99, duration: 0.12, vol: 0.9, type: "triangle", start: 0.15 },
      { freq: 1046.5, duration: 0.28, vol: 0.95, type: "sine", start: 0.20 }
    ]);
    this.playWebTone(1046.5, 0.28, "triangle", 0.7);
  }

  playPortal() {
    this.playAudioTag("portal", [
      { freq: 330, duration: 0.14, vol: 0.8, type: "sine", start: 0 },
      { freq: 440, duration: 0.14, vol: 0.85, type: "sine", start: 0.05 },
      { freq: 659.25, duration: 0.16, vol: 0.85, type: "sine", start: 0.10 },
      { freq: 880, duration: 0.25, vol: 0.9, type: "sine", start: 0.15 }
    ]);
    this.playWebTone(880, 0.25, "sine", 0.65);
  }

  playNearMiss() {
    this.playAudioTag("nearmiss", [
      { freq: 880, duration: 0.08, vol: 0.8, type: "sine", start: 0 },
      { freq: 1174.66, duration: 0.12, vol: 0.85, type: "triangle", start: 0.05 }
    ]);
    this.playWebTone(1174.66, 0.12, "triangle", 0.65);
  }
}

// Global Singleton to ensure all ES modules share the exact same sound instance
const GLOBAL_KEY = "__KIDS_GAME_SOUND_INSTANCE__";
const sound = (typeof window !== "undefined" && window[GLOBAL_KEY]) || new SoundFX();
if (typeof window !== "undefined") {
  window[GLOBAL_KEY] = sound;

  const unlockAudio = () => {
    sound.init();
    if (sound.ctx && sound.ctx.state === "suspended") {
      sound.ctx.resume().catch(() => {});
    }
  };
  ["click", "pointerdown", "keydown", "touchstart"].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });
}

export { sound };
