// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (UNIFIED)
// ✅ Uses window.Particles or window.GAME_MODULES.Particles (if present)
// ✅ Listens: hha:judge, hha:score, hha:miss, hha:storm, hha:boss, hha:celebrate, hha:end, hha:coach
// ✅ Adds global "feel": screen pulse, ring pulses, score pop, boss/storm banners
// ✅ Safe: no hard dependency on specific HUD ids
// ✅ Rate-limited to avoid spam (kid-friendly + mobile friendly)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  if(WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // -------------------- helpers --------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();

  function getParticles(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }

  function centerXY(){
    const W = DOC.documentElement.clientWidth || innerWidth || 360;
    const H = DOC.documentElement.clientHeight || innerHeight || 640;
    return { x: Math.floor(W/2), y: Math.floor(H*0.32), W, H };
  }

  function pulseBody(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms||200);
    }catch(_){}
  }

  // floating banner layer
  function ensureBanner(){
    let el = DOC.querySelector('.hha-fx-banner');
    if(el) return el;
    el = DOC.createElement('div');
    el.className = 'hha-fx-banner';
    el.style.cssText = `
      position:fixed;
      left:0; right:0;
      top: calc(8px + env(safe-area-inset-top, 0px));
      z-index: 210;
      display:flex;
      align-items:flex-start;
      justify-content:center;
      pointer-events:none;
    `;
    const card = DOC.createElement('div');
    card.className = 'hha-fx-banner-card';
    card.style.cssText = `
      max-width:min(720px, 94vw);
      background: rgba(2,6,23,.72);
      border:1px solid rgba(148,163,184,.22);
      border-radius: 999px;
      padding: 10px 14px;
      font: 1000 13px/1.1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      color:#e5e7eb;
      box-shadow: 0 18px 50px rgba(0,0,0,.45);
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity .16s ease, transform .16s ease;
      backdrop-filter: blur(10px);
      display:flex;
      gap:10px;
      align-items:center;
    `;
    const dot = DOC.createElement('span');
    dot.className = 'hha-fx-dot';
    dot.style.cssText = `
      width:10px;height:10px;border-radius:999px;
      background:#22c55e;
      box-shadow: 0 0 0 4px rgba(34,197,94,.18);
      flex:0 0 auto;
    `;
    const txt = DOC.createElement('span');
    txt.className = 'hha-fx-text';
    txt.textContent = '—';

    card.appendChild(dot);
    card.appendChild(txt);
    el.appendChild(card);
    DOC.body.appendChild(el);
    return el;
  }

  let bannerTimer = 0;
  function showBanner(text, tone){
    try{
      const root = ensureBanner();
      const card = root.querySelector('.hha-fx-banner-card');
      const dot  = root.querySelector('.hha-fx-dot');
      const txt  = root.querySelector('.hha-fx-text');
      if(!card || !txt || !dot) return;

      txt.textContent = String(text || '—');

      const t = String(tone||'good');
      const styles = {
        good:  { dot:'#22c55e', ring:'rgba(34,197,94,.18)' },
        warn:  { dot:'#f59e0b', ring:'rgba(245,158,11,.18)' },
        bad:   { dot:'#ef4444', ring:'rgba(239,68,68,.18)' },
        cyan:  { dot:'#22d3ee', ring:'rgba(34,211,238,.18)' },
        violet:{ dot:'#a78bfa', ring:'rgba(167,139,250,.18)' }
      };
      const s = styles[t] || styles.good;
      dot.style.background = s.dot;
      dot.style.boxShadow  = `0 0 0 4px ${s.ring}`;

      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';

      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(()=>{
        card.style.opacity = '0';
        card.style.transform = 'translateY(-10px)';
      }, 1200);
    }catch(_){}
  }

  // rate limits
  const RL = {
    pop:  { t:0, ms: 70 },
    ring: { t:0, ms: 90 },
    banner:{ t:0, ms: 350 },
    coach:{ t:0, ms: 900 }
  };
  function allow(key){
    const r = RL[key];
    if(!r) return true;
    const t = now();
    if(t - r.t < r.ms) return false;
    r.t = t;
    return true;
  }

  // wrappers
  function pop(x,y,text,cls,opts){
    const P = getParticles();
    if(!P) return;
    if(!allow('pop')) return;
    try{
      if(typeof P.popText === 'function') P.popText(x,y,String(text||''),cls||null,opts||null);
      else if(typeof P.scorePop === 'function') P.scorePop(x,y,String(text||''));
    }catch(_){}
  }
  function ring(x,y,kind,opts){
    const P = getParticles();
    if(!P) return;
    if(!allow('ring')) return;
    try{
      if(typeof P.ringPulse === 'function') P.ringPulse(x,y,kind||'good',opts||null);
    }catch(_){}
  }
  function burst(x,y,kind,opts){
    const P = getParticles();
    if(!P) return;
    try{
      if(typeof P.burstAt === 'function') P.burstAt(x,y,kind||'good',opts||null);
    }catch(_){}
  }
  function celebrate(kind,opts){
    const P = getParticles();
    if(!P) return;
    try{
      if(typeof P.celebrate === 'function') P.celebrate(kind||'win',opts||null);
    }catch(_){}
  }

  // normalize coords from events
  function coordsFromDetail(d){
    const c = centerXY();
    const x = Number(d?.x);
    const y = Number(d?.y);
    if(Number.isFinite(x) && Number.isFinite(y)) return { x: Math.floor(x), y: Math.floor(y), W:c.W, H:c.H };
    return c;
  }

  // -------------------- event handlers --------------------

  // judge: primary moment-to-moment feedback
  function onJudge(ev){
    const d = ev?.detail || {};
    const type = String(d.type || '').toLowerCase(); // good/bad/perfect/miss/block
    const label = d.label || '';

    const { x,y,W,H } = coordsFromDetail(d);

    if(type === 'good'){
      burst(x,y,'good');
      ring(x,y,'good',{ size: 120 });
      pop(x,y, label || '+', 'good', { size: 16 });
      pulseBody('gj-hit-good', 140);
      return;
    }

    if(type === 'perfect'){
      burst(x,y,'star');
      ring(x,y,'star',{ size: 150 });
      pop(x,y, label || 'PERFECT!', 'warn', { size: 18 });
      pulseBody('gj-hit-perfect', 180);
      if(allow('banner')) showBanner(label || 'Perfect!', 'warn');
      return;
    }

    if(type === 'block'){
      burst(x,y,'shield');
      ring(x,y,'shield',{ size: 150 });
      pop(x,y, label || 'BLOCK', 'cyan', { size: 16 });
      pulseBody('gj-hit-block', 160);
      return;
    }

    if(type === 'miss'){
      burst(x,y,'bad');
      ring(x,y,'bad',{ size: 170 });
      pop(x,y, label || 'MISS', 'bad', { size: 16 });
      pulseBody('gj-hit-miss', 180);
      return;
    }

    if(type === 'bad'){
      burst(x,y,'bad');
      ring(x,y,'bad',{ size: 160 });
      pop(x,y, label || 'OOPS!', 'bad', { size: 16 });
      pulseBody('gj-hit-bad', 190);
      return;
    }

    // fallback
    if(label){
      pop(W/2, H*0.28, label, 'warn', { size: 16 });
    }
  }

  // score/miss for subtle pops (not spamming)
  function onScore(ev){
    const d = ev?.detail || {};
    const delta = Number(d.delta);
    if(!Number.isFinite(delta)) return;
    const { x,y } = coordsFromDetail(d);
    if(delta > 0){
      pop(x,y, `+${Math.floor(delta)}`, 'good', { size: 14 });
    }else if(delta < 0){
      pop(x,y, `${Math.floor(delta)}`, 'bad', { size: 14 });
    }
  }
  function onMiss(ev){
    const d = ev?.detail || {};
    const deltaMiss = Number(d.deltaMiss);
    if(!Number.isFinite(deltaMiss)) return;
    const { x,y } = coordsFromDetail(d);
    if(deltaMiss > 0) pop(x,y, `MISS +${Math.floor(deltaMiss)}`, 'bad', { size: 13 });
    if(deltaMiss < 0) pop(x,y, `MISS ${Math.floor(deltaMiss)}`, 'warn', { size: 13 });
  }

  // storm / boss banners + body classes (match your GoodJunk css hooks)
  function onStorm(ev){
    const d = ev?.detail || {};
    const on = !!d.on;
    if(on){
      pulseBody('gj-storm', 420);
      if(allow('banner')) showBanner('🌪️ STORM! เป้าจะวุ่นขึ้น', 'warn');
      const c = centerXY();
      ring(c.x, c.y, 'star', { size: 220 });
      pop(c.x, c.y, 'STORM!', 'warn', { size: 20 });
    }else{
      if(allow('banner')) showBanner('✅ STORM CLEAR', 'good');
    }
  }

  function onBoss(ev){
    const d = ev?.detail || {};
    const on = !!d.on;
    const phase = Number(d.phase)||0;
    const hp = Number(d.hp);
    const hpMax = Number(d.hpMax);

    if(on){
      pulseBody('gj-boss', 520);
      if(phase === 2) pulseBody('gj-phase2', 520);

      const msg = (Number.isFinite(hp) && Number.isFinite(hpMax))
        ? `👾 BOSS! HP ${hp}/${hpMax}${phase===2?' (P2)':''}`
        : `👾 BOSS!${phase===2?' (P2)':''}`;

      if(allow('banner')) showBanner(msg, phase===2?'bad':'violet');

      const c = centerXY();
      ring(c.x, c.y, phase===2?'bad':'violet', { size: phase===2 ? 300 : 260 });
      pop(c.x, c.y, phase===2 ? 'PHASE 2!' : 'BOSS!', phase===2?'bad':'violet', { size: 20 });
    }else{
      if(allow('banner')) showBanner('🏆 BOSS DOWN!', 'good');
      celebrate('boss', { count: 16 });
    }
  }

  // celebrate: big win moments
  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind || d?.grade || 'win').toLowerCase();
    if(kind.includes('mini')){
      celebrate('mini', { count: 10 });
      return;
    }
    if(kind.includes('boss')){
      celebrate('boss', { count: 18 });
      return;
    }
    celebrate('win', { count: 14 });
  }

  // end: one last flourish (don’t conflict with game's own end overlay)
  function onEnd(ev){
    const d = ev?.detail || {};
    const grade = d.grade || '';
    if(grade){
      if(allow('banner')) showBanner(`จบเกม! GRADE ${grade}`, 'good');
    }
    celebrate('end', { count: 16 });
  }

  // coach: show small banner tip (rate-limited)
  function onCoach(ev){
    if(!allow('coach')) return;
    const d = ev?.detail || {};
    const msg = d.msg || d.text || '';
    if(!msg) return;
    if(allow('banner')) showBanner(String(msg).slice(0, 90), 'cyan');
  }

  // -------------------- attach listeners --------------------
  function on(name, fn){
    try{ WIN.addEventListener(name, fn, { passive:true }); }catch(_){}
    try{ DOC.addEventListener(name, fn, { passive:true }); }catch(_){}
  }

  on('hha:judge', onJudge);
  on('hha:score', onScore);
  on('hha:miss',  onMiss);
  on('hha:storm', onStorm);
  on('hha:boss',  onBoss);
  on('hha:celebrate', onCelebrate);
  on('hha:end', onEnd);
  on('hha:coach', onCoach);

  // tiny boot banner (once)
  setTimeout(()=>{
    if(allow('banner')) showBanner('✨ FX Director พร้อมใช้งาน', 'good');
  }, 120);
})();