// === /herohealth/vr/ui-fever.js ===
// HeroHealth Fever UI (IIFE) — FIX-ALL
// Exposes: window.FeverUI + window.GAME_MODULES.FeverUI
// - ensureFeverBar(): create UI if missing
// - setFever(value0to100)
// - setFeverActive(on)
// - setShield(count)
// Also listens to events: hha:fever, hha:score

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const NS = (root.FeverUI = root.FeverUI || {});
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = NS;

  // prevent duplicate style injection
  if (!root.__HHA_FEVER_STYLE__) {
    root.__HHA_FEVER_STYLE__ = true;

    const style = doc.createElement('style');
    style.id = 'hha-fever-style';
    style.textContent = `
      .hha-fever-wrap{
        position: fixed;
        right: 12px;
        top: 84px; /* avoid top HUD; tuned for your layouts */
        z-index: 9999;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        transform: translateZ(0);
      }
      @media (max-width: 480px){
        .hha-fever-wrap{ right: 10px; top: 78px; }
      }

      .hha-fever-card{
        width: 168px;
        border-radius: 16px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.72);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 12px 30px rgba(0,0,0,.35);
        overflow: hidden;
      }

      .hha-fever-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 10px 12px 8px 12px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", Arial;
        letter-spacing:.2px;
        color: rgba(226,232,240,.92);
        font-weight: 800;
        font-size: 13px;
      }
      .hha-fever-head .tag{
        font-weight: 900;
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.60);
        color: rgba(226,232,240,.88);
      }

      .hha-fever-bar{
        height: 10px;
        margin: 0 12px 10px 12px;
        border-radius: 999px;
        background: rgba(148,163,184,.12);
        overflow: hidden;
        position: relative;
      }
      .hha-fever-fill{
        height: 100%;
        width: 0%;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,197,94,.65));
        box-shadow: 0 0 0 rgba(34,197,94,0);
        transition: width 120ms linear, filter 120ms linear;
      }
      .hha-fever-sheen{
        position:absolute;
        inset:0;
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.20) 45%, rgba(255,255,255,0) 70%);
        transform: translateX(-120%);
        opacity: .0;
      }

      .hha-fever-meta{
        padding: 0 12px 12px 12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Thai", Arial;
        color: rgba(226,232,240,.92);
      }
      .hha-fever-meta .left{
        display:flex;
        align-items:center;
        gap: 6px;
        font-weight: 900;
      }
      .hha-fever-meta .pct{
        font-weight: 900;
        font-size: 14px;
        opacity: .95;
      }

      .hha-shield{
        display:flex;
        align-items:center;
        gap: 6px;
        font-weight: 900;
        font-size: 13px;
      }
      .hha-shield .icons{
        display:flex;
        gap: 2px;
        align-items:center;
      }
      .hha-shield .i{
        width: 18px;
        height: 18px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border-radius: 8px;
        border: 1px solid rgba(148,163,184,.16);
        background: rgba(15,23,42,.55);
        box-shadow: 0 10px 18px rgba(0,0,0,.20);
        font-size: 12px;
      }

      /* FEVER ON state */
      .hha-fever-wrap.fever-on .hha-fever-card{
        border-color: rgba(250,204,21,.35);
        box-shadow: 0 14px 34px rgba(250,204,21,.12), 0 12px 30px rgba(0,0,0,.35);
      }
      .hha-fever-wrap.fever-on .hha-fever-fill{
        background: linear-gradient(90deg, rgba(250,204,21,.98), rgba(249,115,22,.92));
        filter: saturate(1.15);
        box-shadow: 0 0 18px rgba(250,204,21,.22);
      }
      .hha-fever-wrap.fever-on .hha-fever-sheen{
        opacity: .65;
        animation: hhaSheen 950ms linear infinite;
      }
      .hha-fever-wrap.fever-on{
        animation: hhaPulse 720ms ease-in-out infinite;
      }

      /* shake on big drop / hit */
      .hha-fever-wrap.shake{
        animation: hhaShake 240ms ease-in-out 1;
      }

      @keyframes hhaPulse{
        0%{ transform: translateZ(0) scale(1.00); }
        50%{ transform: translateZ(0) scale(1.015); }
        100%{ transform: translateZ(0) scale(1.00); }
      }
      @keyframes hhaSheen{
        0%{ transform: translateX(-120%); }
        100%{ transform: translateX(140%); }
      }
      @keyframes hhaShake{
        0%{ transform: translateZ(0) translateX(0); }
        25%{ transform: translateZ(0) translateX(-3px); }
        50%{ transform: translateZ(0) translateX(3px); }
        75%{ transform: translateZ(0) translateX(-2px); }
        100%{ transform: translateZ(0) translateX(0); }
      }
    `;
    doc.head.appendChild(style);
  }

  // ---------- internal refs ----------
  let wrap = null;
  let fill = null;
  let pctEl = null;
  let tagEl = null;
  let shieldIcons = null;

  let feverVal = 0;
  let feverOn = false;
  let shield = 0;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function build(){
    if (wrap) return wrap;

    wrap = doc.querySelector('.hha-fever-wrap');
    if (wrap) {
      fill = wrap.querySelector('.hha-fever-fill');
      pctEl = wrap.querySelector('.hha-fever-pct');
      tagEl = wrap.querySelector('.hha-fever-tag');
      shieldIcons = wrap.querySelector('.hha-shield-icons');
      return wrap;
    }

    wrap = doc.createElement('div');
    wrap.className = 'hha-fever-wrap';

    const card = doc.createElement('div');
    card.className = 'hha-fever-card';

    const head = doc.createElement('div');
    head.className = 'hha-fever-head';

    const left = doc.createElement('div');
    left.textContent = 'FEVER';

    const tag = doc.createElement('div');
    tag.className = 'tag hha-fever-tag';
    tag.textContent = 'READY';

    head.appendChild(left);
    head.appendChild(tag);

    const bar = doc.createElement('div');
    bar.className = 'hha-fever-bar';

    const f = doc.createElement('div');
    f.className = 'hha-fever-fill';

    const sheen = doc.createElement('div');
    sheen.className = 'hha-fever-sheen';

    bar.appendChild(f);
    bar.appendChild(sheen);

    const meta = doc.createElement('div');
    meta.className = 'hha-fever-meta';

    const metaLeft = doc.createElement('div');
    metaLeft.className = 'left';
    metaLeft.innerHTML = `<span class="pct hha-fever-pct">0%</span>`;

    const sh = doc.createElement('div');
    sh.className = 'hha-shield';
    sh.innerHTML = `
      <span>🛡️</span>
      <span class="icons hha-shield-icons"></span>
    `;

    meta.appendChild(metaLeft);
    meta.appendChild(sh);

    card.appendChild(head);
    card.appendChild(bar);
    card.appendChild(meta);

    wrap.appendChild(card);
    doc.body.appendChild(wrap);

    fill = f;
    pctEl = wrap.querySelector('.hha-fever-pct');
    tagEl = wrap.querySelector('.hha-fever-tag');
    shieldIcons = wrap.querySelector('.hha-shield-icons');

    return wrap;
  }

  function renderShieldIcons(){
    if (!wrap) return;
    if (!shieldIcons) return;

    // limit icons for UI cleanliness
    const n = clamp(shield, 0, 8);
    shieldIcons.innerHTML = '';
    for (let i=0;i<n;i++){
      const b = doc.createElement('span');
      b.className = 'i';
      b.textContent = '🛡️';
      shieldIcons.appendChild(b);
    }
    if (n === 0){
      const b = doc.createElement('span');
      b.className = 'i';
      b.textContent = '—';
      shieldIcons.appendChild(b);
    }
  }

  function shake(){
    if (!wrap) return;
    try{
      wrap.classList.remove('shake');
      // force reflow
      void wrap.offsetWidth;
      wrap.classList.add('shake');
      setTimeout(()=>{ try{ wrap && wrap.classList.remove('shake'); }catch{} }, 260);
    }catch{}
  }

  function setTag(text){
    if (!tagEl) return;
    tagEl.textContent = String(text || '');
  }

  // ---------- public API ----------
  NS.ensureFeverBar = function ensureFeverBar(){
    build();
    // initial render
    NS.setFever(feverVal);
    NS.setFeverActive(feverOn);
    NS.setShield(shield);
    return wrap;
  };

  NS.setFever = function setFever(v){
    build();
    const next = clamp(v, 0, 100);
    const prev = feverVal;
    feverVal = next;

    if (fill) fill.style.width = Math.round(next) + '%';
    if (pctEl) pctEl.textContent = Math.round(next) + '%';

    // shake on sharp drop
    if (prev - next >= 18) shake();

    if (!feverOn){
      // READY state hints
      if (next >= 95) setTag('FULL');
      else if (next >= 70) setTag('HOT');
      else if (next >= 35) setTag('BUILD');
      else setTag('READY');
    }
  };

  NS.setFeverActive = function setFeverActive(on){
    build();
    feverOn = !!on;
    if (!wrap) return;

    if (feverOn){
      wrap.classList.add('fever-on');
      setTag('FEVER!');
    } else {
      wrap.classList.remove('fever-on');
      // tag based on current value
      if (feverVal >= 95) setTag('FULL');
      else if (feverVal >= 70) setTag('HOT');
      else if (feverVal >= 35) setTag('BUILD');
      else setTag('READY');
    }
  };

  NS.setShield = function setShield(v){
    build();
    const prev = shield|0;
    shield = Math.max(0, v|0);
    renderShieldIcons();
    if (shield < prev) shake();
  };

  // ---------- event bridge ----------
  function onScore(ev){
    const d = ev && ev.detail ? ev.detail : {};
    // Some engines only emit via hha:score
    if (d.fever != null) NS.setFever(d.fever);
    if (d.shield != null) NS.setShield(d.shield);
  }

  function onFever(ev){
    const d = ev && ev.detail ? ev.detail : {};
    if (d.value != null) NS.setFever(d.value);
    if (d.on != null) NS.setFeverActive(!!d.on);
    if (d.shield != null) NS.setShield(d.shield);
  }

  root.addEventListener('hha:score', onScore);
  root.addEventListener('hha:fever', onFever);

  // create immediately (safe)
  try{ NS.ensureFeverBar(); }catch{}

})(window);