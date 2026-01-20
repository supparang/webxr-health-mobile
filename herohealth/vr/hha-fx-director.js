// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — FAIR PACK (Unified)
// ✅ Works with ../vr/particles.js if present
// ✅ Listens: hha:judge, hha:storm, hha:boss, hha:celebrate, hha:end
// ✅ Non-blocking overlay, rate-limited
// ✅ Same feel across all games (but each game can still keep its own identity)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const clamp=(v,a,b)=> v<a?a:(v>b?b:v);
  const now=()=> (performance?.now?.() ?? Date.now());

  function P(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }

  // rate limit (avoid spam)
  const RL = {
    judge: { t:0, gap: 80 },
    big:   { t:0, gap: 450 },
  };
  function allow(key){
    const r = RL[key] || RL.judge;
    const t = now();
    if(t - r.t < r.gap) return false;
    r.t = t;
    return true;
  }

  function vp(){
    const W = DOC.documentElement.clientWidth || innerWidth || 1;
    const H = DOC.documentElement.clientHeight || innerHeight || 1;
    return { W,H };
  }

  function pop(x,y,text,cls,opts){
    const p = P();
    if(!p) return;
    try{
      if(typeof p.popText === 'function') p.popText(x,y,text,cls,opts);
      else if(typeof p.scorePop === 'function') p.scorePop(x,y,text);
    }catch(_){}
  }

  function ring(x,y,kind,opts){
    const p = P();
    if(!p) return;
    try{ if(typeof p.ringPulse === 'function') p.ringPulse(x,y,kind,opts); }catch(_){}
  }

  function burst(x,y,kind,opts){
    const p = P();
    if(!p) return;
    try{ if(typeof p.burstAt === 'function') p.burstAt(x,y,kind,opts); }catch(_){}
  }

  function celebrate(kind, opts){
    const p = P();
    if(!p) return;
    try{ if(typeof p.celebrate === 'function') p.celebrate(kind, opts); }catch(_){}
  }

  function centerTopY(){
    const { H } = vp();
    return Math.floor(H * 0.22);
  }

  // ---- event handlers ----
  function onJudge(ev){
    if(!allow('judge')) return;
    const d = ev?.detail || {};
    const { W,H } = vp();
    const x = clamp(Number(d.x ?? (W/2)), 20, W-20);
    const y = clamp(Number(d.y ?? (H*0.32)), 20, H-20);
    const type = String(d.type||'').toLowerCase();
    const label = String(d.label||'').slice(0,24);

    if(!label) return;

    if(type === 'good' || type === 'perfect'){
      burst(x,y,'good');
      ring(x,y,'good',{ size: 120 });
      pop(x,y,label,'good',{ size: 16 });
    } else if(type === 'bad' || type === 'miss'){
      burst(x,y,'bad');
      ring(x,y,'bad',{ size: 150 });
      pop(x,y,label,'bad',{ size: 16 });
    } else if(type === 'block'){
      burst(x,y,'shield');
      ring(x,y,'shield',{ size: 150 });
      pop(x,y,label,'cyan',{ size: 16 });
    } else {
      pop(x,y,label,'warn',{ size: 14 });
    }
  }

  function onStorm(ev){
    if(!allow('big')) return;
    const d = ev?.detail || {};
    const on = !!d.on;
    if(!on) return;
    const { W } = vp();
    const x = Math.floor(W/2);
    const y = centerTopY();
    ring(x,y,'star',{ size: 240 });
    pop(x,y,'STORM!','warn',{ size: 22 });
  }

  function onBoss(ev){
    if(!allow('big')) return;
    const d = ev?.detail || {};
    if(!d.on) return;
    const { W } = vp();
    const x = Math.floor(W/2);
    const y = centerTopY();
    const hp = (d.hp!=null && d.hpMax!=null) ? `HP ${d.hp}/${d.hpMax}` : '';
    const phase = (d.phase===2) ? 'PHASE 2' : 'BOSS';
    ring(x,y,'violet',{ size: 280 });
    pop(x,y,phase,'violet',{ size: 22 });
    if(hp) pop(x,y+34,hp,'warn',{ size: 14 });
  }

  function onCelebrate(ev){
    if(!allow('big')) return;
    const d = ev?.detail || {};
    const kind = String(d.kind || 'win');
    celebrate(kind, { count: 18 });
  }

  function onEnd(ev){
    if(!allow('big')) return;
    const d = ev?.detail || {};
    const grade = String(d.grade||'').trim();
    if(!grade) return;
    const { W } = vp();
    pop(Math.floor(W/2), centerTopY(), `GRADE ${grade}`, 'good', { size: 22 });
  }

  WIN.addEventListener('hha:judge', onJudge, { passive:true });
  WIN.addEventListener('hha:storm', onStorm, { passive:true });
  WIN.addEventListener('hha:boss', onBoss, { passive:true });
  WIN.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  WIN.addEventListener('hha:end', onEnd, { passive:true });

})();