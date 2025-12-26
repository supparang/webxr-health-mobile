// === /herohealth/vr/hha-packd-driver.js ===
// HeroHealth PACK D Driver (No engine changes)
// - Emits hha:tick / hha:finalPulse / hha:bossAtk
// - Sources:
//   1) hha:time events (remaining sec)
//   2) MutationObserver on #atk-ring + #atk-laser classes (show/warn/fire)

(function (root) {
  'use strict';

  const win = root;
  const doc = win.document;
  if (!doc) return;

  const now = () => (win.performance && performance.now) ? performance.now() : Date.now();

  function emit(name, detail) {
    try { win.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  // ---------------------------
  // 1) TIME -> finalPulse/tick
  // ---------------------------
  let lastLeft = null;
  let lastPulseAt = 0;

  function pickLeftSec(detail) {
    if (!detail || typeof detail !== 'object') return null;

    // common keys across HeroHealth games
    const candidates = [
      detail.tLeftSec, detail.timeLeftSec, detail.timeLeft, detail.leftSec, detail.left,
      detail.remainingSec, detail.remaining, detail.secLeft, detail.secRemain,
      detail.t, detail.time
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function onTime(ev) {
    const left = pickLeftSec(ev && ev.detail);
    if (left == null) return;

    const s = Math.max(0, Math.floor(left));

    // emit only when integer second changes
    if (lastLeft === s) return;
    lastLeft = s;

    // General countdown tick (last 10 sec = soft, last 5 sec = hard)
    if (s <= 10 && s > 5) {
      emit('hha:tick', { kind: 'warn', intensity: 1.1, secLeft: s });
    }
    if (s <= 5 && s >= 1) {
      emit('hha:tick', { kind: 'final', intensity: 1.9, secLeft: s });
    }

    // Strong pulse effect (last 6 sec including 0->end)
    if (s <= 6) {
      const t = now();
      // guard: avoid double pulse in same frame
      if (t - lastPulseAt > 120) {
        lastPulseAt = t;
        emit('hha:finalPulse', { secLeft: s });
      }
    }
  }

  win.addEventListener('hha:time', onTime, { passive: true });

  // ----------------------------------------
  // 2) Observe Ring/Laser -> bossAtk/tick
  // ----------------------------------------
  function observeEl(el, cb) {
    if (!el) return null;
    const mo = new MutationObserver(cb);
    mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    return mo;
  }

  const ring = doc.getElementById('atk-ring');
  const laser = doc.getElementById('atk-laser');

  let ringShown = false;
  let laserState = 'off'; // off|warn|fire

  function readLaserState(el) {
    const c = el.classList;
    if (c.contains('fire')) return 'fire';
    if (c.contains('warn')) return 'warn';
    return 'off';
  }

  observeEl(ring, () => {
    const shown = ring.classList.contains('show');
    if (shown && !ringShown) {
      ringShown = true;
      emit('hha:bossAtk', { name: 'ring' });
      emit('hha:tick', { kind: 'ring', intensity: 1.7 });
    } else if (!shown && ringShown) {
      ringShown = false;
      // optional: emit end state if you want
    }
  });

  observeEl(laser, () => {
    const st = readLaserState(laser);
    if (st === laserState) return;

    laserState = st;

    if (st === 'warn') {
      emit('hha:bossAtk', { name: 'laser' });
      emit('hha:tick', { kind: 'laser-warn', intensity: 2.0 });
    } else if (st === 'fire') {
      emit('hha:tick', { kind: 'laser-fire', intensity: 2.4 });
      // ถ้าอยากให้ “โดนเลเซอร์” แล้วสั่นหนักขึ้นแบบแน่ ๆ (แม้ engine ไม่ยิง badHit)
      // emit('quest:badHit', { kind: 'laser' });
    }
  });

  // ---------------------------
  // 3) Extra: stun/impact hooks
  // ---------------------------
  // ถ้า engine ยิง event เหล่านี้อยู่แล้ว PACK D HTML จะตอบสนองทันที
  // (ไม่บังคับ) แต่เราช่วย map บาง event ให้ “มีแรง” แบบ default
  win.addEventListener('hha:judge', (ev) => {
    const t = String(ev?.detail?.text || ev?.detail?.judge || '').toLowerCase();
    if (!t) return;
    if (t.includes('stun') || t.includes('shock') || t.includes('hit')) {
      emit('hha:tick', { kind: 'warn', intensity: 1.4 });
    }
  }, { passive: true });

})(typeof window !== 'undefined' ? window : globalThis);