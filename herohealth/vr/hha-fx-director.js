// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (SAFE)
// ✅ Unified FX mapping for all games (Good/Junk/Miss/Goal/Mini/Fever/Shield/Boss/Storm/Rage)
// ✅ Works with either window.HHA_FX (preferred) or window.Particles (back-compat)
// ✅ Safe: never throws; rate-limited; respects reduced-motion
// ✅ Listens to:
//    - hha:judge {label, kind, x,y, clientX,clientY}
//    - hha:celebrate {kind, grade, x,y}
//    - hha:coach {msg, kind, x,y}
//    - quest:update {goal, mini}
//    - optional custom hooks: hha:storm / hha:boss / hha:rage
// ✅ Public helper: window.HHA_FX_DIRECTOR.ping(kind, payload)

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  // ---------- helpers ----------
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }

  function reducedMotion(){
    try{
      return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }catch(_){ return false; }
  }

  function getFX(){
    return root.HHA_FX || root.Particles || null;
  }

  function toXY(p){
    // Accept: {x,y}, {clientX,clientY}, or direct numbers
    try{
      if(!p) return null;
      if(typeof p === 'object'){
        if(Number.isFinite(p.x) && Number.isFinite(p.y)) return {x:p.x,y:p.y};
        if(Number.isFinite(p.clientX) && Number.isFinite(p.clientY)) return {x:p.clientX,y:p.clientY};
      }
    }catch(_){}
    return null;
  }

  function centerXY(){
    try{
      const W = DOC.documentElement.clientWidth || innerWidth || 360;
      const H = DOC.documentElement.clientHeight || innerHeight || 640;
      return { x: Math.round(W/2), y: Math.round(H/2) };
    }catch(_){ return {x:180,y:320}; }
  }

  function safeCall(fn, ...args){
    try{
      const FX = getFX();
      if(!FX) return false;
      const f = FX[fn];
      if(typeof f !== 'function') return false;
      f.apply(FX, args);
      return true;
    }catch(_){ return false; }
  }

  // ---------- rate limit ----------
  const lastAt = Object.create(null);
  function allow(key, gapMs){
    const t = now();
    const prev = lastAt[key] || 0;
    if(t - prev < gapMs) return false;
    lastAt[key] = t;
    return true;
  }

  // ---------- tuning ----------
  // intensity: 0..2 (0 = subtle, 1 = normal, 2 = brutal)
  const intensity = clamp(Number(qs('fx', null) ?? 1), 0, 2);

  // allow global override via window.HHA_FX_CONFIG
  const CFG = Object.assign({
    intensity,
    // gaps
    gapPopMs: 60,
    gapBurstMs: 90,
    gapConfettiMs: 260,
    // base sizes
    popSize: 18,
    emojiSize: 30,
    // if reduced-motion => fewer effects
    respectReducedMotion: true,
  }, root.HHA_FX_CONFIG || {});

  function iScale(a,b,c){
    // map intensity {0,1,2} => {a,b,c}
    const k = clamp(CFG.intensity, 0, 2);
    return (k < 0.5) ? a : (k < 1.5) ? b : c;
  }

  // ---------- theme mapping ----------
  // hue choices: used only if underlying FX supports hue in options
  const HUE = {
    good: 120,
    junk: 10,
    miss: 0,
    star: 55,
    shield: 200,
    diamond: 270,
    goal: 150,
    mini: 190,
    feverUp: 330,
    feverDown: 190,
    boss: 295,
    storm: 210,
    rage: 0
  };

  function fxGood(x,y, extra){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('good', CFG.gapBurstMs)) return;
    safeCall('flash', x,y, { size: iScale(18, 26, 34) });
    safeCall('ring',  x,y, { size: iScale(18, 22, 28), hue:HUE.good });
    safeCall('burst', x,y, {
      count: iScale(8, 10, 14),
      speed: iScale(420, 520, 680),
      size:  iScale(8, 10, 12),
      lifeMs:iScale(420, 520, 650),
      hue: HUE.good
    });
    if(extra?.text && allow('goodText', CFG.gapPopMs)){
      safeCall('popText', x,y, extra.text, { size: iScale(16, 18, 22), hue:HUE.good });
    }
  }

  function fxJunk(x,y, extra){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('junk', CFG.gapBurstMs)) return;
    safeCall('flash', x,y, { size: iScale(18, 26, 34) });
    safeCall('ring',  x,y, { size: iScale(20, 26, 34), hue:HUE.junk });
    safeCall('burst', x,y, {
      count: iScale(9, 12, 18),
      speed: iScale(520, 700, 900),
      size:  iScale(10, 12, 14),
      lifeMs:iScale(520, 650, 820),
      hue: HUE.junk
    });
    if(extra?.text && allow('junkText', CFG.gapPopMs)){
      safeCall('popText', x,y, extra.text, { size: iScale(16, 18, 22), hue:HUE.junk });
    }
  }

  function fxBlock(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('block', CFG.gapBurstMs)) return;
    safeCall('ring', x,y, { size: iScale(22, 30, 36), hue:HUE.shield });
    safeCall('burst', x,y, {
      count: iScale(7, 9, 12),
      speed: iScale(420, 520, 680),
      size:  iScale(8, 10, 12),
      lifeMs:iScale(420, 520, 650),
      hue:HUE.shield
    });
    if(allow('blockEmoji', 120)) safeCall('popEmoji', x,y, '🛡️', { size: iScale(26, 30, 36) });
  }

  function fxMiss(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('miss', CFG.gapBurstMs)) return;
    safeCall('ring', x,y, { size: iScale(20, 26, 34), hue:HUE.miss });
    safeCall('burst', x,y, {
      count: iScale(6, 9, 14),
      speed: iScale(380, 520, 720),
      size:  iScale(9, 11, 13),
      lifeMs:iScale(420, 520, 680),
      hue:HUE.miss
    });
    if(allow('missText', 120)) safeCall('popText', x,y, 'MISS!', { size: iScale(16, 18, 22), hue:HUE.miss });
  }

  function fxStar(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('star', CFG.gapBurstMs)) return;
    safeCall('ring', x,y, { size: iScale(20, 26, 30), hue:HUE.star });
    safeCall('burst', x,y, {
      count: iScale(10, 14, 18),
      speed: iScale(520, 650, 820),
      size:  iScale(8, 10, 11),
      lifeMs:iScale(520, 650, 820),
      hue:HUE.star
    });
    safeCall('popEmoji', x,y, '⭐', { size: iScale(28, 34, 40) });
    if(allow('starText', 180)) safeCall('popText', x,y, 'MISS -1', { size: iScale(14, 16, 18), hue:HUE.star });
  }

  function fxShield(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('shield', CFG.gapBurstMs)) return;
    safeCall('ring', x,y, { size: iScale(22, 28, 34), hue:HUE.shield });
    safeCall('burst', x,y, {
      count: iScale(9, 12, 16),
      speed: iScale(520, 650, 820),
      size:  iScale(8, 10, 12),
      lifeMs:iScale(520, 650, 820),
      hue:HUE.shield
    });
    safeCall('popEmoji', x,y, '🛡️', { size: iScale(28, 34, 42) });
  }

  function fxDiamond(x,y, extra){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('diamond', CFG.gapConfettiMs)) return;
    safeCall('confetti', x,y, { count: iScale(14, 18, 24), lifeMs: iScale(800, 1000, 1300), hue:HUE.diamond });
    safeCall('ring', x,y, { size: iScale(26, 34, 42), hue:HUE.diamond });
    safeCall('popEmoji', x,y, '💎', { size: iScale(32, 40, 52) });
    if(extra?.text) safeCall('popText', x,y, extra.text, { size: iScale(16, 18, 22), hue:HUE.diamond });
  }

  function fxMiniClear(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('mini', CFG.gapConfettiMs)) return;
    safeCall('confetti', x,y, { count: iScale(12, 16, 22), lifeMs:iScale(780, 980, 1200), hue:HUE.mini });
    safeCall('ring', x,y, { size: iScale(24, 30, 38), hue:HUE.mini });
    safeCall('popText', x,y, 'MINI CLEAR!', { size: iScale(16, 18, 22), hue:HUE.mini });
  }

  function fxGoal(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('goal', CFG.gapConfettiMs)) return;
    safeCall('confetti', x,y, { count: iScale(12, 18, 26), lifeMs:iScale(850, 1050, 1350), hue:HUE.goal });
    safeCall('ring', x,y, { size: iScale(26, 34, 44), hue:HUE.goal });
    safeCall('popText', x,y, 'GOAL!', { size: iScale(18, 22, 28), hue:HUE.goal });
  }

  function fxEnd(x,y, grade){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('end', 800)) return;
    const hue = grade==='S' ? 140 : grade==='A' ? 180 : grade==='B' ? 210 : grade==='C' ? 40 : 0;
    safeCall('confetti', x,y, { count: iScale(18, 24, 32), lifeMs:iScale(1000, 1400, 1700), hue });
    safeCall('ring', x,y, { size: iScale(34, 46, 60), hue });
    safeCall('popText', x,y, `GRADE ${grade||'-'}`, { size: iScale(20, 26, 34), hue });
  }

  function fxStorm(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('storm', 520)) return;
    safeCall('ring', x,y, { size: iScale(30, 44, 56), hue:HUE.storm });
    safeCall('burst', x,y, { count:iScale(16, 22, 30), speed:iScale(720, 920, 1200), size:iScale(8, 10, 12), lifeMs:iScale(650, 850, 1000), hue:HUE.storm });
    safeCall('popText', x,y, 'STORM!', { size:iScale(18, 22, 28), hue:HUE.storm });
  }

  function fxBoss(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('boss', 520)) return;
    safeCall('ring', x,y, { size: iScale(34, 48, 62), hue:HUE.boss });
    safeCall('burst', x,y, { count:iScale(18, 26, 34), speed:iScale(780, 980, 1280), size:iScale(10, 12, 14), lifeMs:iScale(720, 900, 1100), hue:HUE.boss });
    safeCall('popText', x,y, 'BOSS!', { size:iScale(18, 22, 30), hue:HUE.boss });
  }

  function fxRage(x,y){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('rage', 520)) return;
    safeCall('ring', x,y, { size: iScale(36, 52, 66), hue:HUE.rage });
    safeCall('burst', x,y, { count:iScale(20, 28, 40), speed:iScale(900, 1150, 1450), size:iScale(10, 12, 14), lifeMs:iScale(720, 950, 1250), hue:HUE.rage });
    safeCall('popText', x,y, 'RAGE!', { size:iScale(18, 24, 32), hue:HUE.rage });
  }

  // ---------- event router ----------
  function handleJudge(ev){
    const d = ev && ev.detail ? ev.detail : null;
    if(!d) return;

    // locate position: d.x/y or clientX/Y or fallback center
    const p = toXY(d) || centerXY();
    const x = p.x, y = p.y;

    const label = String(d.label || '').toUpperCase();
    const kind  = String(d.kind  || '').toLowerCase();

    // Kind-first mapping (recommended)
    switch(kind){
      case 'good':    fxGood(x,y, { text: d.text }); return;
      case 'junk':    fxJunk(x,y, { text: d.text }); return;
      case 'block':   fxBlock(x,y); return;
      case 'miss':    fxMiss(x,y); return;
      case 'star':    fxStar(x,y); return;
      case 'shield':  fxShield(x,y); return;
      case 'diamond': fxDiamond(x,y, { text: d.text }); return;
      case 'goal':    fxGoal(x,y); return;
      case 'mini':    fxMiniClear(x,y); return;
      case 'boss':    fxBoss(x,y); return;
      case 'storm':   fxStorm(x,y); return;
      case 'rage':    fxRage(x,y); return;
      default: break;
    }

    // Label fallback mapping (back-compat with current safe.js that emits label only)
    if(label.includes('GOOD'))   return fxGood(x,y, { text: d.text || '+', });
    if(label.includes('OOPS'))   return fxJunk(x,y, { text: d.text || '-', });
    if(label.includes('BLOCK'))  return fxBlock(x,y);
    if(label.includes('MISS'))   return fxMiss(x,y);
    if(label.includes('STAR'))   return fxStar(x,y);
    if(label.includes('SHIELD')) return fxShield(x,y);
    if(label.includes('DIAMOND'))return fxDiamond(x,y, { text: d.text || '+', });
    if(label.includes('GOAL'))   return fxGoal(x,y);
    if(label.includes('MINI'))   return fxMiniClear(x,y);

    // do nothing
  }

  function handleCelebrate(ev){
    const d = ev && ev.detail ? ev.detail : null;
    const p = toXY(d) || centerXY();
    const x = p.x, y = p.y;

    const kind = String(d?.kind || '').toLowerCase();
    if(kind === 'mini') return fxMiniClear(x,y);
    if(kind === 'end')  return fxEnd(x,y, d?.grade);
    if(kind === 'goal') return fxGoal(x,y);

    // generic celebration
    if(!allow('celebrate', 420)) return;
    safeCall('confetti', x,y, { count:iScale(10, 14, 20), lifeMs:iScale(800, 1000, 1200), hue: rndHue() });
    safeCall('ring', x,y, { size:iScale(26, 34, 42), hue: rndHue() });
  }

  function rndHue(){
    return Math.floor(Math.random()*360);
  }

  // optional: react to coach tips (very light)
  function handleCoach(ev){
    if(CFG.respectReducedMotion && reducedMotion()) return;
    if(!allow('coach', 900)) return;
    const d = ev && ev.detail ? ev.detail : null;
    if(!d) return;

    const p = toXY(d) || centerXY();
    const x = p.x, y = p.y;

    const k = String(d.kind||'').toLowerCase();
    const emoji = k==='warn' ? '⚠️' : k==='tip' ? '💡' : '✨';
    safeCall('popEmoji', x, y, emoji, { size:iScale(22, 26, 30) });
  }

  // Optional custom hooks
  function handleStorm(){ fxStorm(centerXY().x, centerXY().y); }
  function handleBoss(){  fxBoss(centerXY().x, centerXY().y); }
  function handleRage(){  fxRage(centerXY().x, centerXY().y); }

  // ---------- bind listeners ----------
  root.addEventListener('hha:judge', handleJudge, { passive:true });
  root.addEventListener('hha:celebrate', handleCelebrate, { passive:true });
  root.addEventListener('hha:coach', handleCoach, { passive:true });

  // Custom optional events
  root.addEventListener('hha:storm', handleStorm, { passive:true });
  root.addEventListener('hha:boss',  handleBoss,  { passive:true });
  root.addEventListener('hha:rage',  handleRage,  { passive:true });

  // Expose API for manual pings
  root.HHA_FX_DIRECTOR = {
    config: CFG,
    ping: function(kind, payload){
      try{
        const p = toXY(payload) || centerXY();
        const x = p.x, y = p.y;
        const k = String(kind||'').toLowerCase();
        if(k==='good') return fxGood(x,y,payload);
        if(k==='junk') return fxJunk(x,y,payload);
        if(k==='block')return fxBlock(x,y);
        if(k==='miss') return fxMiss(x,y);
        if(k==='star') return fxStar(x,y);
        if(k==='shield') return fxShield(x,y);
        if(k==='diamond')return fxDiamond(x,y,payload);
        if(k==='goal') return fxGoal(x,y);
        if(k==='mini') return fxMiniClear(x,y);
        if(k==='end')  return fxEnd(x,y, payload?.grade);
        if(k==='storm')return fxStorm(x,y);
        if(k==='boss') return fxBoss(x,y);
        if(k==='rage') return fxRage(x,y);
        // fallback: confetti burst
        if(allow('pingAny', 220)){
          safeCall('confetti', x,y, { count:iScale(10, 14, 20), lifeMs:iScale(800, 1000, 1300), hue:rndHue() });
          safeCall('ring', x,y, { size:iScale(26, 34, 42), hue:rndHue() });
        }
      }catch(_){}
    }
  };

})(window);