// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION
// Listens: hha:judge, hha:storm, hha:boss, hha:celebrate, hha:end
// Emits: none (visual only)
// ✅ Safe: works even if Particles missing
// ✅ Rate-limit: prevent spam FX (kids-friendly)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  if(WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const clamp=(v,a,b)=> (v<a?a:(v>b?b:v));
  const now=()=> (performance?.now?.() ?? Date.now());

  function P(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }

  // ---- rate limits ----
  const last = {
    judge: 0,
    storm: 0,
    boss: 0,
    celebrate: 0,
    end: 0
  };

  function can(key, gapMs){
    const t = now();
    if(t - (last[key]||0) >= gapMs){
      last[key] = t;
      return true;
    }
    return false;
  }

  function center(){
    const W = DOC.documentElement.clientWidth || 360;
    const H = DOC.documentElement.clientHeight || 640;
    return { x: Math.floor(W/2), y: Math.floor(H*0.28), W, H };
  }

  // ---- helpers ----
  function pop(x,y,text,cls,opts){
    const p = P();
    try{ p?.popText?.(x,y,text,cls,opts); }catch(_){}
  }
  function ring(x,y,kind,opts){
    const p = P();
    try{ p?.ringPulse?.(x,y,kind,opts); }catch(_){}
  }
  function burst(x,y,kind,opts){
    const p = P();
    try{ p?.burstAt?.(x,y,kind,opts); }catch(_){}
  }
  function celebrate(kind,opts){
    const p = P();
    try{ p?.celebrate?.(kind,opts); }catch(_){}
  }

  // ---- event handlers ----
  function onJudge(ev){
    const d = ev?.detail || {};
    const type = String(d.type || '').toLowerCase();
    const label = String(d.label || '');
    const x = Number(d.x);
    const y = Number(d.y);

    // prevent spam when many hits/sec
    if(!can('judge', 45)) return;

    const { x:cx, y:cy } = center();
    const px = Number.isFinite(x) ? x : cx;
    const py = Number.isFinite(y) ? y : cy;

    if(type === 'good'){
      burst(px,py,'good',{ count: 10, spread: 90, lifeMs: 520 });
      ring(px,py,'good',{ size: 150, lifeMs: 520, thick: 10 });
      if(label) pop(px,py-42,label,'good',{ size: 14, lifeMs: 520, risePx: 34 });
      return;
    }

    if(type === 'perfect'){
      burst(px,py,'star',{ count: 14, spread: 110, lifeMs: 620 });
      ring(px,py,'star',{ size: 190, lifeMs: 650, thick: 10 });
      if(label) pop(px,py-48,label,'warn',{ size: 16, lifeMs: 650, risePx: 40 });
      return;
    }

    if(type === 'bad'){
      burst(px,py,'bad',{ count: 12, spread: 100, lifeMs: 560 });
      ring(px,py,'bad',{ size: 180, lifeMs: 560, thick: 10 });
      if(label) pop(px,py-48,label,'bad',{ size: 16, lifeMs: 560, risePx: 40 });
      return;
    }

    if(type === 'block'){
      burst(px,py,'shield',{ count: 12, spread: 100, lifeMs: 560 });
      ring(px,py,'shield',{ size: 190, lifeMs: 560, thick: 10 });
      pop(px,py-44,'BLOCK!','cyan',{ size: 16, lifeMs: 560, risePx: 36 });
      return;
    }

    if(type === 'miss'){
      ring(px,py,'bad',{ size: 170, lifeMs: 520, thick: 10 });
      if(label) pop(px,py-44,label,'bad',{ size: 14, lifeMs: 520, risePx: 34 });
      return;
    }
  }

  function onStorm(ev){
    const d = ev?.detail || {};
    const on = !!d.on;
    if(!can('storm', on ? 450 : 300)) return;

    const { x, y, H } = center();
    if(on){
      DOC.body.classList.add('gj-storm');
      ring(x, Math.floor(H*0.30), 'warn', { size: 320, lifeMs: 900, thick: 12 });
      pop(x, Math.floor(H*0.22), 'STORM!', 'warn', { size: 22, lifeMs: 900, risePx: 50 });
    }else{
      DOC.body.classList.remove('gj-storm');
      pop(x, y, 'STORM CLEAR', 'good', { size: 14, lifeMs: 520, risePx: 34 });
    }
  }

  function onBoss(ev){
    const d = ev?.detail || {};
    const on = !!d.on;
    const phase = Number(d.phase || 0);
    const hp = Number(d.hp ?? 0);
    const hpMax = Number(d.hpMax ?? 0);
    const rage = !!d.rage;

    // don't overfire: boss updates frequently (hp changes)
    const gap = on ? (phase === 2 ? 160 : 220) : 420;
    if(!can('boss', gap)) return;

    const { x, y, H } = center();

    if(on){
      DOC.body.classList.add('gj-boss');
      if(rage) DOC.body.classList.add('gj-rage'); // keep if rage
      const tag = (phase === 2) ? 'PHASE 2' : 'BOSS';
      ring(x, Math.floor(H*0.32), phase === 2 ? 'bad' : 'violet', { size: phase === 2 ? 360 : 320, lifeMs: 750, thick: 12 });
      pop(x, Math.floor(H*0.24), `${tag}  HP ${hp}/${hpMax}`, phase === 2 ? 'bad' : 'violet', { size: 18, lifeMs: 650, risePx: 44 });
      if(phase === 2) DOC.body.classList.add('gj-phase2'); else DOC.body.classList.remove('gj-phase2');
    }else{
      DOC.body.classList.remove('gj-boss');
      DOC.body.classList.remove('gj-phase2');
      // don't remove rage here; rage ends at end of game in your design
      pop(x, y, 'BOSS DOWN!', 'good', { size: 18, lifeMs: 820, risePx: 48 });
      celebrate('boss', { count: 22 });
    }
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind || 'win');
    if(!can('celebrate', 360)) return;

    if(kind === 'boss'){
      celebrate('boss', { count: 24 });
      return;
    }
    if(kind === 'mini'){
      celebrate('mini', { count: 14 });
      return;
    }
    celebrate('win', { count: 18 });
  }

  function onEnd(ev){
    if(!can('end', 1200)) return;
    const d = ev?.detail || {};
    const reason = String(d.reason || '');
    const grade = String(d.grade || '');
    const { x, y, H } = center();

    // final flash
    if(reason === 'missLimit'){
      pop(x, Math.floor(H*0.22), 'GAME OVER', 'bad', { size: 26, lifeMs: 900, risePx: 54 });
      ring(x, Math.floor(H*0.32), 'bad', { size: 420, lifeMs: 900, thick: 12 });
      return;
    }

    pop(x, Math.floor(H*0.22), `COMPLETED  ${grade ? ('['+grade+']') : ''}`, 'good', { size: 22, lifeMs: 900, risePx: 54 });
    ring(x, Math.floor(H*0.32), 'good', { size: 420, lifeMs: 900, thick: 12 });
    celebrate('win', { count: 18 });
  }

  // ---- bind ----
  WIN.addEventListener('hha:judge', onJudge, { passive:true });
  WIN.addEventListener('hha:storm', onStorm, { passive:true });
  WIN.addEventListener('hha:boss', onBoss, { passive:true });
  WIN.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  WIN.addEventListener('hha:end', onEnd, { passive:true });

})();