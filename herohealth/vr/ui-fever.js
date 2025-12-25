// === /herohealth/vr/ui-fever.js ===
// Hero Health Academy — Fever + Shield UI (IIFE) — NO-DUP + COMPAT
// ✅ Prefers existing FEVER markup if found: #fever-pct #fever-fill #shield-count
// ✅ Otherwise injects .hha-fever-wrap (single instance)
// ✅ Listens: hha:fever (preferred), fallback hha:score (fever/shield fields)
// ✅ Exposes: window.FeverUI + window.GAME_MODULES.FeverUI
// ✅ No double DOM + safe before DOM ready

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // prevent double-attach (script loaded twice)
  if (root.__HHA_FEVER_BOUND__) return;
  root.__HHA_FEVER_BOUND__ = true;

  // ---------- internal state ----------
  let mounted = false;
  let feverVal = 0;         // 0..100
  let feverOn = false;      // active glow
  let shield = 0;           // integer
  let endsAt = 0;           // optional timestamp

  // ---------- DOM refs ----------
  // (A) existing markup refs (legacy/old HUD)
  let extPct = null;
  let extFill = null;
  let extShield = null;
  let extWrap = null; // optional wrapper to toggle .on

  // (B) injected markup refs (this module)
  let wrap = null;
  let bar = null;
  let pct = null;
  let shNum = null;

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

  // Try bind to existing FEVER UI (legacy HUD) to avoid duplicates
  function bindExistingIfAny(){
    // common ids from older HUDs
    const p = doc.querySelector('#fever-pct');
    const f = doc.querySelector('#fever-fill');
    const s = doc.querySelector('#shield-count');

    if (p || f || s){
      extPct = p;
      extFill = f;
      extShield = s;
      // best-effort wrapper: nearest card/container
      extWrap = (p && p.closest('.fever, .card, .hud-right, .hha-fever-wrap')) || null;
      mounted = true;
      return true;
    }
    return false;
  }

  function mountInjected() {
    // If already injected exists, reuse it
    const exists = doc.querySelector('.hha-fever-wrap[data-hha-fever="1"]');
    if (exists){
      wrap = exists;
      bar = wrap.querySelector('.hha-fever-bar');
      pct = wrap.querySelector('.hha-fever-pct');
      shNum = wrap.querySelector('#hhaShieldNum');
      mounted = true;
      render();
      return;
    }

    injectCSS();

    wrap = doc.createElement('div');
    wrap.className = 'hha-fever-wrap';
    wrap.setAttribute('data-hha-fever', '1');

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

    shNum = wrap.querySelector('#hhaShieldNum');

    mounted = true;
    render();
  }

  function ensureFeverBar() {
    if (mounted) return;

    const doMount = () => {
      // 1) Prefer existing markup (prevents duplicates)
      if (bindExistingIfAny()){
        render();
        return;
      }
      // 2) Otherwise inject our own (single)
      mountInjected();
    };

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', doMount, { once: true });
    } else {
      doMount();
    }
  }

  function render() {
    if (!mounted) return;

    const v = clamp(feverVal, 0, 100);
    const shv = String(int(shield));

    // if using existing markup
    if (extPct || extFill || extShield){
      if (extFill) extFill.style.width = Math.round(v) + '%';
      if (extPct) extPct.textContent = Math.round(v) + '%';
      if (extShield) extShield.textContent = shv;

      if (extWrap && extWrap.classList){
        if (feverOn) extWrap.classList.add('on');
        else extWrap.classList.remove('on');
      }
      return;
    }

    // injected markup
    if (bar) bar.style.width = Math.round(v) + '%';
    if (pct) pct.textContent = Math.round(v) + '%';

    if (wrap && wrap.classList){
      if (feverOn) wrap.classList.add('on');
      else wrap.classList.remove('on');
    }
    if (shNum) shNum.textContent = shv;
  }

  function setFever(value) {
    feverVal = clamp(value, 0, 100);
    ensureFeverBar();
    setTimeout(render, 0);
  }

  function setFeverActive(on) {
    feverOn = !!on;
    ensureFeverBar();
    setTimeout(render, 0);
  }

  function setShield(n) {
    shield = int(n);
    ensureFeverBar();
    setTimeout(render, 0);
  }

  // ---------- Event listeners ----------
  root.addEventListener('hha:fever', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    // accept both {value} and {fever}
    if (d.value != null) feverVal = clamp(d.value, 0, 100);
    if (d.fever != null) feverVal = clamp(d.fever, 0, 100);
    if (d.on != null) feverOn = !!d.on;
    if (d.active != null) feverOn = !!d.active;
    if (d.shield != null) shield = int(d.shield);
    if (d.endsAt != null) endsAt = Number(d.endsAt) || 0;

    ensureFeverBar();
    setTimeout(render, 0);
  });

  root.addEventListener('hha:score', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.fever != null) feverVal = clamp(d.fever, 0, 100);
    if (d.shield != null) shield = int(d.shield);
    ensureFeverBar();
    setTimeout(render, 0);
  });

  // ---------- expose API ----------
  const api = { ensureFeverBar, setFever, setFeverActive, setShield };
  root.FeverUI = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = api;

  // auto mount
  ensureFeverBar();

})(window);