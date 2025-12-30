// === /herohealth/vr/particles.js ===
// Simple FX Layer — score pop + burst + celebrate
// + Badge toast + tiny SFX (safe, no external audio files)
// Provides window.Particles + window.GAME_MODULES.Particles

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:90;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------------- SFX (WebAudio) ----------------
  let _ac = null;
  function ac(){
    try{
      if (_ac) return _ac;
      const A = root.AudioContext || root.webkitAudioContext;
      if (!A) return null;
      _ac = new A();
      return _ac;
    }catch(_){ return null; }
  }

  function beep(freq=660, dur=0.08, type='sine', gain=0.05){
    const A = ac(); if (!A) return;
    try{
      const t0 = A.currentTime;
      const o = A.createOscillator();
      const g = A.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(A.destination);
      o.start(t0); o.stop(t0 + dur + 0.01);
    }catch(_){}
  }

  function sfx(kind){
    // keep it small (kid-friendly)
    if (kind === 'badge'){ beep(880, 0.06, 'triangle', 0.05); setTimeout(()=>beep(1175,0.06,'triangle',0.04), 70); }
    else if (kind === 'perfect'){ beep(988,0.07,'square',0.05); setTimeout(()=>beep(1319,0.09,'square',0.04), 80); }
    else if (kind === 'fail'){ beep(220,0.12,'sawtooth',0.05); }
    else if (kind === 'tick'){ beep(1200,0.03,'sine',0.03); }
  }

  // ---------------- Badge Toast ----------------
  function badgeToast(opts={}){
    const layer = ensureLayer();
    const title = String(opts.title || 'Badge!');
    const sub = String(opts.sub || '');
    const icon = String(opts.icon || '🏅');
    const ms = Math.max(900, Math.min(5000, Number(opts.ms || 2000)));

    const wrap = doc.createElement('div');
    wrap.style.cssText = `
      position:absolute;
      left: calc(env(safe-area-inset-left, 0px) + 14px);
      top:  calc(env(safe-area-inset-top, 0px) + 14px);
      padding:12px 14px;
      min-width: 220px;
      max-width: min(360px, calc(100vw - 28px));
      border-radius:16px;
      background: rgba(2,6,23,.86);
      border: 1px solid rgba(148,163,184,.18);
      box-shadow: 0 18px 60px rgba(0,0,0,.45);
      backdrop-filter: blur(8px);
      transform: translateY(-12px) scale(.98);
      opacity: 0;
      transition: transform .22s ease, opacity .22s ease;
      display:flex; gap:10px; align-items:flex-start;
      pointer-events:none;
    `;

    const ic = doc.createElement('div');
    ic.textContent = icon;
    ic.style.cssText = `font: 900 22px/1 system-ui; width:32px; text-align:center; margin-top:1px;`;

    const txt = doc.createElement('div');
    txt.style.cssText = `display:flex; flex-direction:column; gap:2px;`;
    const t = doc.createElement('div');
    t.textContent = title;
    t.style.cssText = `font: 900 14px/1.15 system-ui; color:#e5e7eb; letter-spacing:.2px;`;
    const s = doc.createElement('div');
    s.textContent = sub;
    s.style.cssText = `font: 700 12px/1.25 system-ui; color:#94a3b8;`;

    txt.appendChild(t);
    if (sub) txt.appendChild(s);

    wrap.appendChild(ic);
    wrap.appendChild(txt);
    layer.appendChild(wrap);

    // show
    requestAnimationFrame(()=>{
      wrap.style.opacity = '1';
      wrap.style.transform = 'translateY(0) scale(1)';
    });

    // hide
    setTimeout(()=>{
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(-10px) scale(.98)';
      setTimeout(()=>{ try{ wrap.remove(); }catch(_){ } }, 260);
    }, ms);

    // sound
    sfx('badge');
  }

  // ---------------- Existing helpers you already have (keep) ----------------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute;
      left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui;
      color:#fff;
      text-shadow: 0 2px 0 rgba(0,0,0,.25);
      opacity:0;
      transition: transform .28s ease, opacity .28s ease;
      pointer-events:none;
    `;
    layer.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-70%) scale(1.06)';
    });
    setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translate(-50%,-90%) scale(.98)';
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 260);
    }, 520);
  }

  root.Particles = root.Particles || {};
  root.Particles.badgeToast = badgeToast;
  root.Particles.popText = popText;
  root.Particles.sfx = sfx;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);