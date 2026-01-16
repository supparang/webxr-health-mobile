// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Unified FX for all games)
// ✅ Listens: hha:judge, hha:storm, hha:boss, hha:celebrate, hha:end
// ✅ Uses Particles (minimal or ultra): window.Particles or window.GAME_MODULES.Particles
// ✅ Safe: no crash if Particles missing
// ✅ Rate-limit: prevents spam
// ✅ Theme hooks: per-game flavor via detail.game / detail.theme

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  /* ---------------- utils ---------------- */
  const now = ()=> (root.performance ? root.performance.now() : Date.now());
  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const W = ()=> DOC.documentElement.clientWidth || root.innerWidth || 0;
  const H = ()=> DOC.documentElement.clientHeight || root.innerHeight || 0;

  function P(){
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function has(fn){
    const p = P();
    return !!(p && typeof p[fn] === 'function');
  }

  function pop(x,y,text,cls=null,opts=null){
    const p = P();
    try{
      if(p && typeof p.popText === 'function') return p.popText(x,y,text,cls,opts);
      if(p && typeof p.scorePop === 'function') return p.scorePop(x,y,text);
    }catch(_){}
  }
  function ring(x,y,kind='good',opts=null){
    const p = P();
    try{
      if(p && typeof p.ringPulse === 'function') return p.ringPulse(x,y,kind,opts);
    }catch(_){}
  }
  function burst(x,y,kind='good',opts=null){
    const p = P();
    try{
      if(p && typeof p.burstAt === 'function') return p.burstAt(x,y,kind,opts);
    }catch(_){}
  }
  function celebrate(kind='win',opts=null){
    const p = P();
    try{
      if(p && typeof p.celebrate === 'function') return p.celebrate(kind,opts);
    }catch(_){}
  }

  function pulseBody(cls, ms=200){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){ } }, ms);
    }catch(_){}
  }

  /* ---------------- soft styles (optional) ---------------- */
  const st = DOC.createElement('style');
  st.textContent = `
    /* FX Director body pulses (safe, non-breaking) */
    .hha-pulse-good { animation: hhaPulseGood 180ms ease-out 1; }
    .hha-pulse-bad  { animation: hhaPulseBad  200ms ease-out 1; }
    .hha-pulse-wow  { animation: hhaPulseWow  260ms ease-out 1; }
    .hha-pulse-storm{ animation: hhaPulseStorm 520ms ease-out 1; }
    .hha-pulse-boss { animation: hhaPulseBoss  620ms ease-out 1; }
    .hha-pulse-rage { animation: hhaPulseRage  680ms ease-out 1; }

    @keyframes hhaPulseGood{
      0%{ filter:saturate(1) brightness(1); }
      60%{ filter:saturate(1.25) brightness(1.06); }
      100%{ filter:saturate(1) brightness(1); }
    }
    @keyframes hhaPulseBad{
      0%{ filter:brightness(1); }
      40%{ filter:brightness(0.92) contrast(1.06); }
      100%{ filter:brightness(1); }
    }
    @keyframes hhaPulseWow{
      0%{ transform:translateZ(0); }
      55%{ transform:translateZ(0) scale(1.01); }
      100%{ transform:translateZ(0); }
    }
    @keyframes hhaPulseStorm{
      0%{ filter:contrast(1); }
      55%{ filter:contrast(1.08) saturate(1.15); }
      100%{ filter:contrast(1); }
    }
    @keyframes hhaPulseBoss{
      0%{ filter:saturate(1); }
      55%{ filter:saturate(1.22) contrast(1.06); }
      100%{ filter:saturate(1); }
    }
    @keyframes hhaPulseRage{
      0%{ filter:contrast(1); }
      50%{ filter:contrast(1.10) saturate(1.18); }
      100%{ filter:contrast(1); }
    }
  `;
  try{ DOC.head.appendChild(st); }catch(_){}

  /* ---------------- rate limit ---------------- */
  const last = new Map();
  function allow(key, ms){
    const t = now();
    const prev = last.get(key) || 0;
    if(t - prev < ms) return false;
    last.set(key, t);
    return true;
  }

  /* ---------------- theme mapping ---------------- */
  function centerXY(){
    return { x: Math.floor(W()/2), y: Math.floor(H()*0.28) };
  }

  function labelForJudge(d){
    // d: { type, label, game?, kind? }
    const t = String(d?.type||'').toLowerCase();
    if(d?.label) return String(d.label);

    if(t === 'good') return 'GOOD!';
    if(t === 'perfect') return 'PERFECT!';
    if(t === 'bad') return 'OOPS!';
    if(t === 'miss') return 'MISS';
    if(t === 'block') return 'BLOCK!';
    return 'OK';
  }

  function kindForJudge(d){
    const t = String(d?.type||'').toLowerCase();
    if(t === 'good') return 'good';
    if(t === 'perfect') return 'star';
    if(t === 'block') return 'shield';
    if(t === 'bad') return 'bad';
    if(t === 'miss') return 'bad';
    return 'good';
  }

  /* ---------------- handlers ---------------- */
  function onJudge(ev){
    if(!allow('judge', 55)) return; // keeps it snappy but not spammy
    const d = ev?.detail || {};
    const x = Number(d.x); const y = Number(d.y);
    const hasXY = Number.isFinite(x) && Number.isFinite(y);

    const pos = hasXY ? {x,y} : centerXY();
    const text = labelForJudge(d);
    const kind = kindForJudge(d);

    // core hits
    if(kind === 'good'){
      pulseBody('hha-pulse-good', 180);
      burst(pos.x, pos.y, 'good');
      ring(pos.x, pos.y, 'good', { size: 120 });
      pop(pos.x, pos.y, text, 'good', { size: 18 });
      return;
    }
    if(kind === 'star'){
      pulseBody('hha-pulse-wow', 240);
      burst(pos.x, pos.y, 'star');
      ring(pos.x, pos.y, 'star', { size: 150 });
      pop(pos.x, pos.y, text, 'warn', { size: 18 });
      return;
    }
    if(kind === 'shield'){
      pulseBody('hha-pulse-wow', 220);
      burst(pos.x, pos.y, 'shield');
      ring(pos.x, pos.y, 'shield', { size: 160 });
      pop(pos.x, pos.y, text, 'cyan', { size: 16 });
      return;
    }
    if(kind === 'bad'){
      pulseBody('hha-pulse-bad', 220);
      burst(pos.x, pos.y, 'bad');
      ring(pos.x, pos.y, 'bad', { size: 170 });
      pop(pos.x, pos.y, text, 'bad', { size: 16 });
      return;
    }
  }

  function onStorm(ev){
    const d = ev?.detail || {};
    const on = !!d.on;
    if(on){
      if(!allow('storm_on', 900)) return;
      pulseBody('hha-pulse-storm', 520);
      const c = centerXY();
      ring(c.x, c.y, 'star', { size: 260 });
      pop(c.x, c.y, 'STORM!', 'warn', { size: 22 });
    }else{
      if(!allow('storm_off', 800)) return;
      const c = centerXY();
      pop(c.x, c.y, 'STORM CLEAR', 'good', { size: 16 });
    }
  }

  function onBoss(ev){
    const d = ev?.detail || {};
    const on = !!d.on;
    const phase = Number(d.phase||0);
    const rage = !!d.rage;
    const hp = Number(d.hp);
    const hpMax = Number(d.hpMax);

    // Boss enter
    if(on && phase === 1 && allow('boss_on', 900)){
      pulseBody('hha-pulse-boss', 620);
      const c = centerXY();
      ring(c.x, c.y, 'violet', { size: 300 });
      pop(c.x, c.y, `BOSS! HP ${hpMax||'?'}`, 'violet', { size: 22 });
      if(rage) pop(c.x, c.y + 34, 'RAGE!', 'bad', { size: 18 });
      return;
    }

    // Phase2 cue
    if(on && phase === 2 && allow('boss_p2', 900)){
      pulseBody('hha-pulse-rage', 680);
      const c = centerXY();
      ring(c.x, c.y, 'bad', { size: 320 });
      pop(c.x, c.y, 'PHASE 2!', 'bad', { size: 22 });
      return;
    }

    // HP tick (throttle)
    if(on && Number.isFinite(hp) && Number.isFinite(hpMax) && allow('boss_hp', 220)){
      const c = centerXY();
      pop(c.x, c.y + 38, `HP ${hp}/${hpMax}`, (hp/hpMax <= 0.35) ? 'bad' : 'warn', { size: 14 });
      return;
    }

    // Boss cleared
    if(!on && allow('boss_off', 900)){
      const c = centerXY();
      pop(c.x, c.y, 'BOSS DOWN!', 'good', { size: 22 });
      celebrate('boss', { count: 20 });
      return;
    }
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind || 'win').toLowerCase();

    if(kind === 'mini'){
      if(!allow('cele_mini', 900)) return;
      celebrate('mini', { count: 12 });
      const c = centerXY();
      pop(c.x, c.y, 'MINI CLEAR!', 'warn', { size: 20 });
      return;
    }

    if(kind === 'boss'){
      if(!allow('cele_boss', 900)) return;
      celebrate('boss', { count: 22 });
      return;
    }

    if(kind === 'end'){
      if(!allow('cele_end', 900)) return;
      celebrate('win', { count: 16 });
      return;
    }

    // default
    if(!allow('cele_any', 900)) return;
    celebrate(kind, { count: 14 });
  }

  function onEnd(ev){
    // End FX (small, not spammy)
    if(!allow('end', 1200)) return;
    const d = ev?.detail || {};
    const grade = String(d.grade || '').toUpperCase();
    const c = centerXY();

    if(grade === 'S'){
      celebrate('win', { count: 22 });
      pop(c.x, c.y, 'S RANK!', 'good', { size: 22 });
      return;
    }
    if(grade === 'A'){
      celebrate('win', { count: 18 });
      pop(c.x, c.y, 'A RANK!', 'warn', { size: 20 });
      return;
    }
    if(grade){
      celebrate('win', { count: 14 });
      pop(c.x, c.y, `${grade} RANK`, 'warn', { size: 18 });
      return;
    }

    celebrate('win', { count: 12 });
    pop(c.x, c.y, 'DONE!', 'good', { size: 18 });
  }

  /* ---------------- attach listeners ---------------- */
  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:storm', onStorm, { passive:true });
  root.addEventListener('hha:boss', onBoss, { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  root.addEventListener('hha:end', onEnd, { passive:true });

})(window);