// Sound FX module using Web Audio API (graceful no-op in headless/non-browser environments)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      try {
        this.ctx = new AudioCtx();
      } catch {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playTone(freq, duration, type = 'sine', decay = true, startDelay = 0) {
    if (!this.enabled || typeof window === 'undefined') return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime + startDelay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      if (decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      } else {
        gain.gain.setValueAtTime(0.18, now + duration * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      }

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }

  playJump() {
    if (!this.enabled || typeof window === 'undefined') return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.14);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  playCollect() {
    this.playTone(523.25, 0.08, 'sine', true, 0);
    this.playTone(659.25, 0.10, 'sine', true, 0.05);
    this.playTone(783.99, 0.14, 'sine', true, 0.10);
  }

  playHit() {
    this.playTone(180, 0.18, 'sawtooth', true, 0);
  }

  playWin() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.22, 'triangle', true, idx * 0.11);
    });
  }

  playLose() {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.22, 'sawtooth', true, idx * 0.12);
    });
  }

  playClick() {
    this.playTone(750, 0.03, 'square', true, 0);
  }

  playCombo(streak = 1) {
    const base = 523.25 * Math.pow(1.06, Math.min(12, streak));
    this.playTone(base, 0.07, 'sine', true, 0);
    this.playTone(base * 1.25, 0.12, 'triangle', true, 0.05);
  }

  playPowerUp() {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.1, 'triangle', true, idx * 0.045);
    });
  }

  playPortal() {
    const notes = [330, 440, 659.25, 880];
    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.12, 'sine', true, idx * 0.05);
    });
  }

  playNearMiss() {
    this.playTone(880, 0.05, 'sine', true, 0);
    this.playTone(1174.66, 0.08, 'triangle', true, 0.04);
  }
}

export const sound = new SoundFX();
