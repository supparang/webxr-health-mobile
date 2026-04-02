const AudioCtx = window.AudioContext || window.webkitAudioContext;

export function createHhaSfx({ enabled = true } = {}) {
  let ctx = null;
  let unlocked = false;

  function init() {
    if (!ctx && AudioCtx) {
      try {
        ctx = new AudioCtx();
      } catch {}
    }
    return ctx;
  }

  async function unlock() {
    init();
    try {
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
      unlocked = !!ctx && ctx.state === 'running';
    } catch {}
    return unlocked;
  }

  function setEnabled(v) {
    enabled = !!v;
  }

  function playTone(freq = 440, dur = 0.08, type = 'sine', gain = 0.03, offset = 0) {
    if (!enabled) return;
    init();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(amp);
    amp.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function play(kind = 'good') {
    if (!enabled) return;

    if (kind === 'good') {
      playTone(620, 0.07, 'sine', 0.035, 0);
      playTone(780, 0.06, 'sine', 0.026, 0.05);
      return;
    }

    if (kind === 'perfect') {
      playTone(660, 0.07, 'triangle', 0.04, 0);
      playTone(880, 0.07, 'triangle', 0.03, 0.05);
      playTone(1120, 0.08, 'triangle', 0.024, 0.1);
      return;
    }

    if (kind === 'bad') {
      playTone(240, 0.12, 'sawtooth', 0.03, 0);
      playTone(180, 0.10, 'sawtooth', 0.022, 0.06);
      return;
    }

    if (kind === 'phase') {
      playTone(520, 0.06, 'square', 0.03, 0);
      playTone(780, 0.07, 'square', 0.026, 0.05);
      playTone(980, 0.07, 'square', 0.022, 0.1);
      return;
    }

    if (kind === 'boss') {
      playTone(420, 0.08, 'triangle', 0.03, 0);
      playTone(620, 0.08, 'triangle', 0.03, 0.06);
      playTone(920, 0.10, 'triangle', 0.028, 0.12);
      return;
    }

    if (kind === 'win') {
      playTone(523, 0.08, 'sine', 0.04, 0);
      playTone(659, 0.08, 'sine', 0.035, 0.06);
      playTone(784, 0.09, 'sine', 0.03, 0.12);
      playTone(1046, 0.11, 'sine', 0.026, 0.18);
    }
  }

  return {
    unlock,
    play,
    playTone,
    setEnabled,
    get isUnlocked() {
      return unlocked;
    }
  };
}