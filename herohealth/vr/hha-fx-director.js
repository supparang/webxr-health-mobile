// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (shared across games)
// ✅ Normalizes FX API across Particles versions
// ✅ Reacts to events: hha:judge, hha:celebrate, hha:coach
// ✅ Adds safe screen pulse / shake (CSS-independent)
// ✅ Works even if some game CSS is missing

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const now = ()=> (root.performance ? performance.now() : Date.now());

  // -------------------- FX layer helpers --------------------
  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index: 200;
      overflow:hidden;
    `;
    DOC.body.appendChild(layer);
    return layer;
  }

  function ensureStyles(){
    if(DOC.getElementById('hha-fx-director-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-fx-director-style';
    st.textContent = `
      @keyframes hhaFxPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.95; }
        65%{ transform:translate(-50%,-72%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-90%) scale(1.05); opacity:0; }
      }
      @keyframes hhaFxBurst{
        0%{ transform:translate(-50%,-50%) scale(.7); opacity:.8; }
        60%{ transform:translate(-50%,-50%) scale(1.25); opacity:.35; }
        100%{ transform:translate(-50%,-50%) scale(1.45); opacity:0; }
      }
      @keyframes hhaFxPulse{
        0%{ opacity:0; }
        35%{ opacity:1; }
        100%{ opacity:0; }
      }
      @keyframes hhaFxShake{
        0%{ transform:translate3d(0,0,0); }
        25%{ transform:translate3d(-1px,0,0); }
        55%{ transform:translate3d(1px,0,0); }
        75%{ transform:translate3d(-1px,0,0); }
        100%{ transform:translate3d(0,0,0); }
      }
      .hha-fx-pop{
        position:absolute;
        left: var(--x, 50%);
        top: var(--y, 50%);
        transform: translate(-50%,-50%);
        font: 1000 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        letter-spacing: .2px;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        will-change: transform, opacity;
        animation: hhaFxPop 560ms ease-out forwards;
        padding: 8px 10px;
        border-radius: 14px;
        background: rgba(2,6,23,.35);
        border: 1px solid rgba(148,163,184,.20);
        backdrop-filter: blur(6px);
        white-space:nowrap;
      }
      .hha-fx-burst{
        position:absolute;
        left: var(--x, 50%);
        top: var(--y, 50%);
        width: 86px; height: 86px;
        transform: translate(-50%,-50%);
        border-radius: 999px;
        background: radial-gradient(circle, rgba(34,197,94,.18), transparent 60%);
        border: 1px solid rgba(34,197,94,.25);
        will-change: transform, opacity;
        animation: hhaFxBurst 520ms ease-out forwards;
      }
      .hha-fx-burst.bad{
        background: radial-gradient(circle, rgba(239,68,68,.18), transparent 60%);
        border-color: rgba(239,68,68,.25);
      }
      .hha-fx-burst.star{
        background: radial-gradient(circle, rgba(245,158,11,.18), transparent 60%);
        border-color: rgba(245,158,11,.25);
      }
      .hha-fx-burst.shield{
        background: radial-gradient(circle, rgba(59,130,246,.18), transparent 60%);
        border-color: rgba(59,130,246,.25);
      }
      .hha-fx-burst.diamond{
        background: radial-gradient(circle, rgba(168,85,247,.20), transparent 60%);
        border-color: rgba(168,85,247,.25);
      }
      .hha-fx-pulse{
        position:fixed; inset:0;
        pointer-events:none;
        z-index: 210;
        background: radial-gradient(circle at 50% 35%, rgba(34,197,94,.14), transparent 60%);
        animation: hhaFxPulse 260ms ease-out forwards;
      }
      .hha-fx-pulse.bad{
        background: radial-gradient(circle at 50% 35%, rgba(239,68,68,.16), transparent 60%);
      }
      .hha-fx-pulse.warn{
        background: radial-gradient(circle at 50% 35%, rgba(245,158,11,.14), transparent 60%);
      }
      .hha-fx-shake{
        animation: hhaFxShake 220ms ease-out 1;
      }
    `;
    DOC.head.appendChild(st);
  }

  ensureStyles();

  // -------------------- Particles adapter --------------------
  function getParticles(){
    // support both global shapes:
    // - window.Particles.popText / burstAt / scorePop / celebrate
    // - window.GAME_MODULES.Particles...
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function popText(x, y, text, tone){
    const P = getParticles();
    // if game provides its own, prefer it
    try{
      if(P){
        if(typeof P.scorePop === 'function') return P.scorePop(x,y,text);
        if(typeof P.popText  === 'function') return P.popText(x,y,text);
      }
    }catch(_){}

    // fallback DOM FX
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'hha-fx-pop';
    el.textContent = String(text ?? '');
    el.style.setProperty('--x', `${Math.floor(x)}px`);
    el.style.setProperty('--y', `${Math.floor(y)}px`);

    if(tone === 'bad'){
      el.style.borderColor = 'rgba(239,68,68,.25)';
      el.style.background  = 'rgba(127,29,29,.25)';
    } else if(tone === 'warn'){
      el.style.borderColor = 'rgba(245,158,11,.25)';
      el.style.background  = 'rgba(120,53,15,.22)';
    }

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 900);
  }

  function burstAt(x,y,kind){
    const P = getParticles();
    try{
      if(P && typeof P.burstAt === 'function') return P.burstAt(x,y,kind);
    }catch(_){}

    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'hha-fx-burst ' + (kind || '');
    el.style.setProperty('--x', `${Math.floor(x)}px`);
    el.style.setProperty('--y', `${Math.floor(y)}px`);
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function pulse(kind){
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'hha-fx-pulse ' + (kind || '');
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 420);
  }

  function shakeOnce(){
    try{
      DOC.body.classList.add('hha-fx-shake');
      setTimeout(()=>DOC.body.classList.remove('hha-fx-shake'), 260);
    }catch(_){}
  }

  // -------------------- event routing --------------------
  function centerXY(){
    const W = DOC.documentElement.clientWidth || 360;
    const H = DOC.documentElement.clientHeight || 640;
    return { x: Math.floor(W/2), y: Math.floor(H*0.32) };
  }

  function onJudge(ev){
    const d = ev?.detail || {};
    const label = String(d.label || '').trim();
    if(!label) return;

    const c = centerXY();
    // tone mapping
    let tone = '';
    if(/MISS|OOPS|BAD|RAGE|BOSS/i.test(label)) tone = 'bad';
    else if(/STORM|WARN/i.test(label)) tone = 'warn';

    popText(c.x, c.y, label, tone);

    if(tone === 'bad') { pulse('bad'); shakeOnce(); }
    else if(tone === 'warn') pulse('warn');
    else pulse('');
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind || '').toLowerCase();
    const c = centerXY();

    if(kind === 'storm'){
      burstAt(c.x, c.y, 'star'); // ใช้โทนเหลือง/ส้ม
      pulse('warn');
      popText(c.x, c.y, 'STORM!', 'warn');
      return;
    }
    if(kind === 'boss'){
      burstAt(c.x, c.y, 'bad');
      pulse('bad');
      popText(c.x, c.y, 'BOSS!', 'bad');
      shakeOnce();
      return;
    }
    if(kind === 'end'){
      burstAt(c.x, c.y, 'diamond');
      pulse('');
      return;
    }
    // generic
    burstAt(c.x, c.y, kind || 'good');
  }

  function onCoach(ev){
    const d = ev?.detail || {};
    const msg = String(d.msg || '').trim();
    if(!msg) return;
    const c = centerXY();
    popText(c.x, Math.floor(c.y + 34), msg, '');
  }

  // bind
  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  root.addEventListener('hha:coach', onCoach, { passive:true });

  // expose tiny API (optional)
  root.HHA_FX = {
    popText, burstAt, pulse, shakeOnce,
    t0: now()
  };

})(window);