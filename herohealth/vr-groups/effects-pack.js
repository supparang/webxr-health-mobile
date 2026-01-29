// === /herohealth/vr-groups/effects-pack.js ===
// Groups Effects Pack — PRODUCTION (DOM FX)
// ✅ Depends: /herohealth/vr/particles.js (window.Particles.*)
// ✅ Hooks common events:
//    - hha:shoot
//    - groups:hit (from engine) {ok, x, y, groupKey, groupName, points}
//    - groups:miss (from engine) {x, y, reason}
//    - groups:progress {kind:...}
//    - quest:update (for group change banner accent)
// ✅ Safe caps + no-throw + reduced motion friendly
// Notes:
// - Engine should emit groups:hit/miss with screen coords if possible.
// - If no coords, we fallback to center of playLayer.
// - Keeps effects lightweight on mobile.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  WIN.GroupsVR = WIN.GroupsVR || {};

  if (WIN.GroupsVR.Effects && WIN.GroupsVR.Effects.__loaded) return;
  WIN.GroupsVR.Effects = WIN.GroupsVR.Effects || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  const prefersReduced = (()=> {
    try { return !!matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  })();

  const CFG = {
    // overall safety caps
    maxFxPerSec: 18,
    minGapMs: prefersReduced ? 140 : 55,

    // mild screen shake
    shakeMs: prefersReduced ? 0 : 90,
    shakePx: prefersReduced ? 0 : 5,

    // flash
    flashMs: prefersReduced ? 0 : 95,

    // pop text
    popGoodClass: 'fx-good',
    popBadClass: 'fx-bad',
    popWarnClass: 'fx-warn',

    // sound (optional)
    sound: true
  };

  const S = {
    lastFxAt: 0,
    fxCountWinStart: 0,
    fxCount: 0,

    // audio
    aOk: null,
    aBad: null,
    aTick: null
  };

  function canFx(){
    const t = nowMs();
    if ((t - S.lastFxAt) < CFG.minGapMs) return false;

    // windowed cap 1s
    if ((t - S.fxCountWinStart) > 1000){
      S.fxCountWinStart = t;
      S.fxCount = 0;
    }
    if (S.fxCount >= CFG.maxFxPerSec) return false;

    S.lastFxAt = t;
    S.fxCount++;
    return true;
  }

  function qsPlayLayer(){
    return DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }

  function centerOf(el){
    try{
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }catch{
      return { x: innerWidth/2, y: innerHeight/2 };
    }
  }

  function posFromDetail(d){
    const x = Number(d && d.x);
    const y = Number(d && d.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    return centerOf(qsPlayLayer());
  }

  // -------------------------
  // DOM helpers: flash + shake
  // -------------------------
  function ensureFxLayer(){
    let el = DOC.getElementById('hhaFxLayer');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'hhaFxLayer';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9998';
    DOC.body.appendChild(el);

    // flash element
    let f = DOC.getElementById('hhaFxFlash');
    if (!f){
      f = DOC.createElement('div');
      f.id = 'hhaFxFlash';
      f.style.position = 'fixed';
      f.style.inset = '0';
      f.style.background = 'rgba(255,255,255,.10)';
      f.style.opacity = '0';
      f.style.pointerEvents = 'none';
      f.style.transition = 'opacity 90ms ease';
      f.style.zIndex = '9999';
      DOC.body.appendChild(f);
    }
    return el;
  }

  function flash(kind){
    if (CFG.flashMs <= 0) return;
    const f = DOC.getElementById('hhaFxFlash');
    if (!f) return;

    const op =
      (kind === 'good') ? 0.18 :
      (kind === 'bad')  ? 0.14 :
      (kind === 'warn') ? 0.12 :
                          0.10;

    f.style.opacity = String(op);
    setTimeout(()=>{ try{ f.style.opacity = '0'; }catch(_){} }, CFG.flashMs);
  }

  function shake(){
    if (CFG.shakeMs <= 0 || CFG.shakePx <= 0) return;
    const host = DOC.body;
    const px = CFG.shakePx;
    host.style.willChange = 'transform';
    host.style.transform = `translate(${(Math.random()*2-1)*px}px, ${(Math.random()*2-1)*px}px)`;
    setTimeout(()=>{
      try{
        host.style.transform = '';
        host.style.willChange = '';
      }catch(_){}
    }, CFG.shakeMs);
  }

  // -------------------------
  // Particles wrappers
  // -------------------------
  function popText(x,y,text, cls){
    if (!WIN.Particles || !WIN.Particles.popText) return;
    try{ WIN.Particles.popText(x,y,String(text||''), cls||''); }catch(_){}
  }

  function burst(x,y, opts){
    if (!WIN.Particles || !WIN.Particles.burst) return;
    try{ WIN.Particles.burst(x,y, opts||{}); }catch(_){}
  }

  // -------------------------
  // Audio (optional)
  // -------------------------
  function mkOscBeep(freq, ms, gain){
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if (!AC) return null;
      const ctx = mkOscBeep._ctx || (mkOscBeep._ctx = new AC());
      if (ctx.state === 'suspended') { ctx.resume().catch(()=>{}); }

      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = gain;

      o.connect(g);
      g.connect(ctx.destination);

      o.start();
      o.stop(ctx.currentTime + (ms/1000));

      return true;
    }catch{
      return null;
    }
  }

  function beepOk(){ if (!CFG.sound) return; mkOscBeep(740, 70, 0.05); }
  function beepBad(){ if (!CFG.sound) return; mkOscBeep(220, 85, 0.06); }
  function beepTick(){ if (!CFG.sound) return; mkOscBeep(520, 55, 0.03); }

  // -------------------------
  // Main FX handlers
  // -------------------------
  function fxHit(d){
    if (!canFx()) return;
    ensureFxLayer();

    const p = posFromDetail(d);
    const pts = Number(d && d.points);
    const groupName = String(d && (d.groupName || d.group)) || '';

    flash('good');
    // a tiny burst
    burst(p.x, p.y, { count: prefersReduced ? 6 : 12, spread: 22, drift: 0.75 });

    // score pop
    const label = Number.isFinite(pts) ? `+${pts|0}` : '+';
    popText(p.x, p.y, label, CFG.popGoodClass);

    // occasional group name pop (lighter)
    if (groupName && (Math.random() < 0.20) && !prefersReduced){
      popText(p.x, p.y - 26, groupName, 'fx-neutral');
    }

    beepOk();
  }

  function fxMiss(d){
    if (!canFx()) return;
    ensureFxLayer();

    const p = posFromDetail(d);
    flash('bad');
    shake();

    burst(p.x, p.y, { count: prefersReduced ? 4 : 10, spread: 28, drift: 1.0 });

    const reason = String(d && d.reason) || 'MISS';
    popText(p.x, p.y, reason, CFG.popBadClass);

    beepBad();
  }

  function fxShoot(d){
    // very light feedback for tap-to-shoot / crosshair
    if (!canFx()) return;
    const p = posFromDetail(d || {});
    if (!prefersReduced && Math.random() < 0.30){
      popText(p.x, p.y, '•', 'fx-dot');
    }
    beepTick();
  }

  function fxProgress(d){
    if (!d) return;
    const k = String(d.kind||'');
    if (!k) return;

    if (k === 'storm_on'){
      if (!canFx()) return;
      flash('warn');
      burst(innerWidth*0.5, innerHeight*0.25, { count: prefersReduced ? 10 : 22, spread: 70, drift: 1.0 });
      popText(innerWidth*0.5, innerHeight*0.25, 'STORM!', CFG.popWarnClass);
      return;
    }
    if (k === 'storm_off'){
      if (!canFx()) return;
      flash('good');
      burst(innerWidth*0.5, innerHeight*0.25, { count: prefersReduced ? 10 : 24, spread: 76, drift: 0.9 });
      popText(innerWidth*0.5, innerHeight*0.25, 'CLEAR!', CFG.popGoodClass);
      return;
    }
    if (k === 'boss_spawn'){
      if (!canFx()) return;
      flash('warn');
      shake();
      popText(innerWidth*0.5, innerHeight*0.22, 'BOSS!', CFG.popWarnClass);
      return;
    }
    if (k === 'boss_down'){
      if (!canFx()) return;
      flash('good');
      burst(innerWidth*0.5, innerHeight*0.22, { count: prefersReduced ? 16 : 34, spread: 88, drift: 0.95 });
      popText(innerWidth*0.5, innerHeight*0.22, 'NICE!', CFG.popGoodClass);
      return;
    }
    if (k === 'perfect_switch'){
      if (!canFx()) return;
      flash('neutral');
      const name = String(d.groupName||'');
      burst(innerWidth*0.5, innerHeight*0.22, { count: prefersReduced ? 12 : 26, spread: 78, drift: 0.9 });
      popText(innerWidth*0.5, innerHeight*0.22, name ? ('→ ' + name) : 'SWITCH!', 'fx-neutral');
      return;
    }
  }

  // -------------------------
  // CSS injection for text classes
  // -------------------------
  function injectCss(){
    if (DOC.getElementById('groupsFxCss')) return;
    const st = DOC.createElement('style');
    st.id = 'groupsFxCss';
    st.textContent = `
      .fx-good{ color: rgba(34,197,94,1); font-weight: 1000; text-shadow: 0 4px 18px rgba(34,197,94,.22); }
      .fx-bad{ color: rgba(239,68,68,1); font-weight: 1100; text-shadow: 0 4px 18px rgba(239,68,68,.22); }
      .fx-warn{ color: rgba(245,158,11,1); font-weight: 1050; text-shadow: 0 4px 18px rgba(245,158,11,.22); }
      .fx-neutral{ color: rgba(229,231,235,.95); font-weight: 980; text-shadow: 0 4px 16px rgba(0,0,0,.35); }
      .fx-dot{ color: rgba(229,231,235,.75); font-weight: 900; }
    `;
    DOC.head.appendChild(st);
  }

  // -------------------------
  // Init / bind
  // -------------------------
  function bind(){
    injectCss();
    ensureFxLayer();

    WIN.addEventListener('hha:shoot', (ev)=> fxShoot(ev.detail||{}), { passive:true });
    WIN.addEventListener('groups:hit', (ev)=> fxHit(ev.detail||{}), { passive:true });
    WIN.addEventListener('groups:miss', (ev)=> fxMiss(ev.detail||{}), { passive:true });
    WIN.addEventListener('groups:progress', (ev)=> fxProgress(ev.detail||{}), { passive:true });

    // subtle tick when quest updates (group change already handled by big banner, but add micro FX)
    WIN.addEventListener('quest:update', (ev)=>{
      const d = ev.detail||{};
      if (!d.groupKey) return;
      if (!canFx()) return;
      if (prefersReduced) return;
      // tiny sparkle at top
      burst(innerWidth*0.5, innerHeight*0.14, { count: 10, spread: 52, drift: 0.8 });
    }, { passive:true });
  }

  // Some pages load Particles with defer; wait a bit but still bind.
  function start(){
    bind();
    WIN.GroupsVR.Effects.__loaded = true;
    WIN.GroupsVR.Effects.ping = ()=>{ try{ popText(innerWidth*0.5, innerHeight*0.5, 'FX OK', 'fx-neutral'); }catch(_){} };
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }

})();