// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder + Layout Stabilizer (PRODUCTION)
// ✅ fixes: mobile vh jump / resize jitter (targets "blink" feel)
// ✅ adds: body classes (is-vr / is-mobile / is-desktop)
// ✅ listens: hha:score, quest:update, hha:coach, hha:judge, hha:end (optional cosmetics)
// ✅ hides A-Frame enter-vr UI (CSS already, but keep safe)
// ✅ keeps UI from blocking play area (touch-action hints)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const $ = (id) => doc.getElementById(id);

  // ---------------------- VH Stabilizer ----------------------
  function setVhVar() {
    try {
      const h = root.innerHeight || doc.documentElement.clientHeight || 640;
      doc.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
    } catch (e) {}
  }

  // Debounced resize to avoid jitter
  function debounce(fn, ms) {
    let t = 0;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }
  const setVhDebounced = debounce(setVhVar, 80);

  // ---------------------- Device / Mode ----------------------
  function isMobileUA() {
    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }

  function syncDeviceClass() {
    try {
      const b = doc.body;
      if (!b) return;
      b.classList.toggle('is-mobile', isMobileUA());
      b.classList.toggle('is-desktop', !isMobileUA());
    } catch (e) {}
  }

  function bindAFrameVrEvents() {
    // A-Frame emits enter-vr / exit-vr on scene
    const scene = doc.querySelector('a-scene');
    if (!scene) return;

    const b = doc.body;

    function onEnterVR() {
      try {
        if (b) b.classList.add('is-vr');
        // Some browsers resize viewport when entering VR; update vh after a short delay
        setTimeout(setVhVar, 50);
        setTimeout(setVhVar, 160);
      } catch (e) {}
    }

    function onExitVR() {
      try {
        if (b) b.classList.remove('is-vr');
        setTimeout(setVhVar, 50);
        setTimeout(setVhVar, 160);
      } catch (e) {}
    }

    scene.addEventListener('enter-vr', onEnterVR);
    scene.addEventListener('exit-vr', onExitVR);

    // Extra: if A-Frame VR UI sneaks in, hard-hide it (CSS already handles)
    try {
      const btn = doc.querySelector('.a-enter-vr, .a-enter-vr-button, .a-enter-ar');
      if (btn) btn.style.display = 'none';
    } catch (e) {}
  }

  // ---------------------- HUD cosmetics helpers ----------------------
  function gradeClass(grade) {
    grade = String(grade || '').toUpperCase();
    if (grade === 'SSS' || grade === 'SS' || grade === 'S' || grade === 'A') return 'good';
    if (grade === 'B') return 'warn';
    return 'bad';
  }

  function paintGrade(grade) {
    const chip = doc.querySelector('.gradeChip');
    if (!chip) return;
    chip.classList.remove('good', 'warn', 'bad');
    chip.classList.add(gradeClass(grade));
  }

  // Optional: lightweight "judge toast" (inject if missing)
  function ensureJudgeToast() {
    let el = doc.querySelector('.plate-judge');
    if (el) return el;

    el = doc.createElement('div');
    el.className = 'plate-judge';
    el.style.cssText = `
      position:fixed;
      left:50%;
      top:calc(84px + env(safe-area-inset-top,0px));
      transform:translateX(-50%);
      z-index:55;
      padding:10px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.72);
      color:rgba(229,231,235,.95);
      font: 1100 12px/1.2 system-ui, -apple-system, "Noto Sans Thai", sans-serif;
      box-shadow:0 18px 44px rgba(0,0,0,.30);
      backdrop-filter: blur(10px);
      opacity:0;
      pointer-events:none;
      transition: opacity .14s ease, transform .14s ease;
      white-space:nowrap;
      max-width: calc(100vw - 24px);
      overflow:hidden;
      text-overflow:ellipsis;
    `;
    doc.body.appendChild(el);
    return el;
  }

  function showJudge(text, kind) {
    const el = ensureJudgeToast();
    if (!el) return;

    el.textContent = String(text || '');
    el.style.borderColor =
      kind === 'bad' ? 'rgba(239,68,68,.28)' :
      kind === 'warn' ? 'rgba(250,204,21,.30)' :
      'rgba(34,197,94,.24)';

    el.style.background =
      kind === 'bad' ? 'rgba(239,68,68,.10)' :
      kind === 'warn' ? 'rgba(250,204,21,.10)' :
      'rgba(34,197,94,.10)';

    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(-2px)';

    clearTimeout(showJudge._t);
    showJudge._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(0px)';
    }, 750);
  }

  // ---------------------- Event bindings (non-invasive) ----------------------
  function bindEvents() {
    // score payload from plate.safe.js
    root.addEventListener('hha:score', (ev) => {
      try {
        const d = ev.detail || {};
        if (d.game && String(d.game) !== 'plate') return;
        if (d.grade) paintGrade(d.grade);
      } catch (e) {}
    }, { passive: true });

    // quest:update payload
    root.addEventListener('quest:update', (ev) => {
      try {
        const d = ev.detail || {};
        if (d.game && String(d.game) !== 'plate') return;
        // (Plate safe.js already updates DOM; here only a gentle hint if needed)
        const hint = $('uiHint');
        if (hint && d.mini && d.mini.title && d.mini.title.includes('Plate Rush')) {
          // keep a consistent hint line during rush
          hint.textContent = 'ทริค: เร่งเก็บหมู่ที่ยังขาด! ระวังขยะห้ามโดน!';
        }
      } catch (e) {}
    }, { passive: true });

    root.addEventListener('hha:coach', (ev) => {
      try {
        const d = ev.detail || {};
        if (d.game && String(d.game) !== 'plate') return;
        // plate.safe.js already sets coach msg/img; nothing required here
      } catch (e) {}
    }, { passive: true });

    root.addEventListener('hha:judge', (ev) => {
      try {
        const d = ev.detail || {};
        if (d.game && String(d.game) !== 'plate') return;
        showJudge(d.text || '', d.kind || 'info');
      } catch (e) {}
    }, { passive: true });

    root.addEventListener('hha:end', (ev) => {
      try {
        const d = ev.detail || {};
        if (d.game && String(d.game) !== 'plate') return;
        // Ensure grade chip painted at end
        const s = d.summary || {};
        if (s.grade) paintGrade(s.grade);
        // When result overlay shows, vh can jump on some devices
        setTimeout(setVhVar, 80);
      } catch (e) {}
    }, { passive: true });
  }

  // ---------------------- Touch hints (reduce UI stealing gestures) ----------------------
  function tuneTouch() {
    try {
      const layer = $('plate-layer');
      if (layer) {
        layer.style.touchAction = 'none';
      }
      // allow buttons to be "manipulation" only
      doc.querySelectorAll('button, .btn').forEach((b) => {
        b.style.touchAction = 'manipulation';
      });
    } catch (e) {}
  }

  // ---------------------- Init ----------------------
  (function init() {
    setVhVar();
    syncDeviceClass();
    tuneTouch();
    bindAFrameVrEvents();
    bindEvents();

    root.addEventListener('resize', setVhDebounced, { passive: true });
    root.addEventListener('orientationchange', () => {
      setTimeout(setVhVar, 60);
      setTimeout(setVhVar, 180);
    }, { passive: true });

    // initial paint if grade already exists
    try {
      const g = $('uiGrade');
      if (g && g.textContent) paintGrade(g.textContent);
    } catch (e) {}
  })();

})(window);