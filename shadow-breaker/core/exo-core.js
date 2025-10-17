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

// Start screen overlay (auto-create if missing)
function startOverlay(onStart) {
  let overlay = document.getElementById('overlay');
  let panel   = document.getElementById('panel');

  // ถ้าไม่มี element ให้สร้างใหม่ (กันพลาดทุกหน้า)
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'overlay';
    // เผื่อ CSS ไม่โหลด ให้ใส่ style สำคัญไว้เลย
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(9,14,23,0.85)';
    overlay.style.zIndex = '9999';
    document.body.appendChild(overlay);
  } else {
    overlay.style.display = 'flex';
  }

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'panel';
    panel.className = 'panel';
    panel.style.minWidth = '260px';
    panel.style.textAlign = 'center';
    overlay.appendChild(panel);
  }

  panel.innerHTML = `
    <div class="title">EXO TRAINING PROTOCOL</div>
    <p>Tap / Click to start</p>
    <button id="btnStart" class="btn">▶ Start</button>
  `;

  const btn = document.getElementById('btnStart');
  btn.onclick = () => {
    overlay.style.display = 'none';
    try { AC.ensure && AC.ensure(); } catch(e){}
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
