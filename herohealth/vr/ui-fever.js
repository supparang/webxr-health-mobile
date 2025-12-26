// === /herohealth/vr/ui-fever.js ===
// Hero Health Academy — Fever + Shield UI (IIFE) — COMPAT+FIX
// ✅ Exposes: window.FeverUI + window.GAME_MODULES.FeverUI
// ✅ Methods: ensureFeverBar(), setFever(value), setFeverActive(on), setShield(n)
// ✅ Listens: hha:fever (accepts value|fever + on|active|stunActive), fallback hha:score (fever/shield)
// ✅ Safe before DOM ready, safe re-init, no double DOM.

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_FEVER_BOUND__) return;
  root.__HHA_FEVER_BOUND__ = true;

  let mounted = false;
  let feverVal = 0;   // 0..100
  let feverOn = false;
  let shield = 0;

  let wrap = null;
  let bar = null;
  let pct = null;

  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function int(v) { return Math.max(0, (Number(v) || 0) | 0); }

  function injectCSS() {
    if (doc.getElementById('hha-fever-css')) return;
    const style = doc.createElement('style');
    style.id = 'hha-fever-css';
    style.textContent = `
      .hha-fever-wrap{
        position:fixed;
        right:12px;
        top: calc(10px + 74px);
        z-index: 9999;
        pointer-events:none;
        display:flex;
        flex-direction:column;
        gap:8px;
        align-items:flex-end;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      }
      .hha-fever-card{
        pointer-events:none;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 16px;
        padding: 10px 12px;
        box-shadow: 0 18px 50px rgba(0,0,0,.42);
        backdrop-filter: blur(10px);
        min-width: 168px;
      }
      .hha-fever-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:8px;
      }
      .hha-fever-title{
        font-weight: 900;
        letter-spacing:.2px;
        font-size: 12px;
        opacity:.95;
      }
      .hha-fever-pct{
        font-weight: 950;
        font-size: 12px;
        opacity:.95;
      }
      .hha-fever-track{
        height: 10px;
        border-radius: 999px;
        overflow:hidden;
        background: rgba(255,255,255,.10);
        border: 1px solid rgba(255,255,255,.14);
      }
      .hha-fever-bar{
        height:100%;
        width:0%;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.92));
        transform: translateZ(0);
        transition: width .10s linear;
      }
      .hha-fever-wrap.on .hha-fever-card{
        box-shadow:
          0 18px 50px rgba(0,0,0,.42),
          0 0 28px rgba(239,68,68,.18),
          0 0 56px rgba(245,158,11,.10);
        border-color: rgba(245,158,11,.24);
      }
      .hha-shield-pill{
        pointer-events:none;
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.22);
        box-shadow: 0 18px 50px rgba(0,0,0,.42);
        backdrop-filter: blur(10px);
        font-weight: 950;
        font-size: 12px;
        opacity:.96;
      }
      .hha-shield-pill b{ font-size: 13px; }
      @media (max-height: 640px){
        .hha-fever-wrap{ top: calc(10px + 64px); }
      }
    `;
    doc.head.appendChild(style);
  }

  function mount() {
    if (mounted) return;
    injectCSS();

    wrap = doc.createElement('div');
    wrap.className = 'hha-fever-wrap';

    const card = doc.createElement('div');
    card.className = 'hha-fever-card';

    const head = doc.createElement('div');
    head.className = 'hha-fever-head';

    const title = doc.createElement('div');
    title.className = 'hha-fever-title';
    title.textContent = '🔥 FEVER';

    pct = doc.createElement('div');
    pct.className = 'hha-fever-pct';
    pct.textContent = '0%';

    head.appendChild(title);
    head.appendChild(pct);

    const track = doc.createElement('div');
    track.className = 'hha-fever-track';

    bar = doc.createElement('div');
    bar.className = 'hha-fever-bar';

    track.appendChild(bar);
    card.appendChild(head);
    card.appendChild(track);

    const sh = doc.createElement('div');
    sh.className = 'hha-shield-pill';
    sh.innerHTML = `🛡️ SHIELD <b id="hhaShieldNum">0</b>`;

    wrap.appendChild(card);
    wrap.appendChild(sh);

    (doc.body || doc.documentElement).appendChild(wrap);
    mounted = true;
    render();
  }

  function ensureFeverBar() {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
  }

  function render() {
    if (!mounted) return;

    const v = clamp(feverVal, 0, 100);
    if (bar) bar.style.width = Math.round(v) + '%';
    if (pct) pct.textContent = Math.round(v) + '%';

    if (wrap) {
      if (feverOn) wrap.classList.add('on');
      else wrap.classList.remove('on');
      const num = wrap.querySelector('#hhaShieldNum');
      if (num) num.textContent = String(int(shield));
    }
  }

  function setFever(value) { feverVal = clamp(value, 0, 100); ensureFeverBar(); setTimeout(render, 0); }
  function setFeverActive(on) { feverOn = !!on; ensureFeverBar(); setTimeout(render, 0); }
  function setShield(n) { shield = int(n); ensureFeverBar(); setTimeout(render, 0); }

  // hha:fever (COMPAT)
  root.addEventListener('hha:fever', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};

    // accept both "value" and "fever"
    const v = (d.value != null) ? d.value : (d.fever != null) ? d.fever : null;
    if (v != null) feverVal = clamp(v, 0, 100);

    // accept "on" / "active" / "stunActive" (engine sends stunActive)
    if (d.on != null) feverOn = !!d.on;
    else if (d.active != null) feverOn = !!d.active;
    else if (d.stunActive != null) feverOn = !!d.stunActive;
    else {
      // fallback: glow when high fever
      feverOn = (feverVal >= 70);
    }

    if (d.shield != null) shield = int(d.shield);

    ensureFeverBar();
    setTimeout(render, 0);
  });

  // fallback: hha:score
  root.addEventListener('hha:score', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.fever != null) feverVal = clamp(d.fever, 0, 100);
    if (d.shield != null) shield = int(d.shield);
    feverOn = (feverVal >= 70);
    ensureFeverBar();
    setTimeout(render, 0);
  });

  const api = { ensureFeverBar, setFever, setFeverActive, setShield };
  root.FeverUI = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = api;

  ensureFeverBar();
})(window);