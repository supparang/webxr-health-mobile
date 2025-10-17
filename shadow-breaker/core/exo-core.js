// EXO Core System
window.EXO = (function () {

  // Audio context for beep effects
  const AC = {
    ctx: null,
    ensure() {
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { }
    }
  };

  // short beep
  function beep(freq = 520, dur = 0.05, vol = 0.12) {
    AC.ensure();
    if (!AC.ctx) return;
    const c = AC.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  // time helper
  function now() {
    return performance.now() / 1000;
  }

  // Start screen overlay
  function startOverlay(onStart) {
    const overlay = document.getElementById('overlay');
    const panel = document.getElementById('panel');

    overlay.style.display = 'flex';
    panel.innerHTML = `
      <div class="title">EXO TRAINING PROTOCOL</div>
      <p>Tap to Start</p>
      <button id="btnStart" class="btn">▶ Start</button>
    `;

    document.getElementById('btnStart').onclick = () => {
      overlay.style.display = 'none';
      AC.ensure();
      if (onStart) onStart();
    };
  }

  // Input system
  function attachBasicInput({ onLeft, onRight, onPause }) {
    const leftArea = document.getElementById('touchL');
    const rightArea = document.getElementById('touchR');

    // Touch click
    leftArea.addEventListener('click', () => onLeft && onLeft());
    rightArea.addEventListener('click', () => onRight && onRight());

    // Keyboard
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'a') onLeft && onLeft();
      if (e.key === 'ArrowRight' || e.key === 'd') onRight && onRight();
      if (e.key === 'Escape') onPause && onPause();
    });
  }

  return {
    now,
    beep,
    startOverlay,
    attachBasicInput
  };
})();
