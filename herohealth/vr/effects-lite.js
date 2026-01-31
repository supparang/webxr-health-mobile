// === /herohealth/vr/effects-lite.js ===
// HHA Effects Lite — PRODUCTION (Classic Script)
// ✅ Listens: hha:judge / hha:coach / quest:update / hha:end
// ✅ Uses window.Particles (if available) for popText/burst
// ✅ Safe: never crashes if Particles missing
// ✅ Mobile-friendly: rate-limit + small bursts
// Notes: purely cosmetic (no gameplay logic)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_EFFECTS_LITE_LOADED__) return;
  WIN.__HHA_EFFECTS_LITE_LOADED__ = true;

  const now = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function P(){
    return WIN.Particles || null;
  }

  function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function centerXY(){
    const r = DOC.documentElement.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  function rand(a,b){
    return a + Math.random()*(b-a);
  }

  // ---- rate-limit ----
  const RL = {
    lastJudgeAt: 0,
    lastCoachAt: 0,
    lastMiniAt: 0,
    lastEndAt: 0
  };
  const COOLDOWN = {
    judge: 90,     // fast but not spam
    coach: 600,    // coach tips slower
    mini: 600,
    end: 1200
  };

  function can(kind){
    const t = now();
    const key = 'last' + kind.charAt(0).toUpperCase() + kind.slice(1) + 'At';
    const cd = COOLDOWN[kind] || 120;
    if (t - (RL[key]||0) < cd) return false;
    RL[key] = t;
    return true;
  }

  // ---- visual helpers ----
  function popAt(x,y,text,cls){
    const fx = P();
    if (!fx || typeof fx.popText !== 'function') return;
    fx.popText(x,y,String(text||''),cls);
  }

  function burstAt(x,y,opts){
    const fx = P();
    if (!fx || typeof fx.burst !== 'function') return;
    fx.burst(x,y,opts||{});
  }

  function flashHUD(kind){
    // very light screen flash using a transient overlay div
    // (avoid depending on CSS IDs; create our own)
    try{
      const id = '__hha_fx_flash';
      let el = DOC.getElementById(id);
      if(!el){
        el = DOC.createElement('div');
        el.id = id;
        el.style.position = 'fixed';
        el.style.inset = '0';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '999999';
        el.style.opacity = '0';
        el.style.transition = 'opacity 120ms ease';
        DOC.body.appendChild(el);
      }
      // choose color by kind
      let bg = 'rgba(34,197,94,.18)'; // green default
      if(kind === 'bad' || kind === 'miss') bg = 'rgba(239,68,68,.18)';
      if(kind === 'perfect') bg = 'rgba(250,204,21,.18)';
      el.style.background = bg;
      el.style.opacity = '1';
      setTimeout(()=>{ try{ el.style.opacity = '0'; }catch(_){ } }, 90);
    }catch(_){}
  }

  // ---- event: hha:judge ----
  // detail example: { type:'good'|'bad'|'miss'|'perfect', label:'GOOD' }
  WIN.addEventListener('hha:judge', (ev)=>{
    if(!can('judge')) return;
    const d = (ev && ev.detail) || {};
    const type = String(d.type || '').toLowerCase();
    const label = String(d.label || '').trim();

    const c = centerXY();

    if(type === 'good'){
      flashHUD('good');
      popAt(c.x + rand(-18,18), c.y + rand(-22,10), label || '+', 'hha-good');
      burstAt(c.x, c.y, { count: 6, spread: 70, lifeMs: 420 });
    }else if(type === 'perfect'){
      flashHUD('perfect');
      popAt(c.x + rand(-18,18), c.y + rand(-22,10), label || 'PERFECT', 'hha-perfect');
      burstAt(c.x, c.y, { count: 10, spread: 110, lifeMs: 520 });
    }else if(type === 'bad'){
      flashHUD('bad');
      popAt(c.x + rand(-18,18), c.y + rand(-22,10), label || 'OOPS', 'hha-bad');
      burstAt(c.x, c.y, { count: 6, spread: 90, lifeMs: 420 });
    }else if(type === 'miss'){
      flashHUD('miss');
      popAt(c.x + rand(-18,18), c.y + rand(-22,10), label || 'MISS', 'hha-miss');
      burstAt(c.x, c.y, { count: 4, spread: 80, lifeMs: 380 });
    }else{
      // unknown type: still show label if present
      if(label) popAt(c.x, c.y, label, 'hha-note');
    }
  }, { passive:true });

  // ---- event: hha:coach ----
  // detail example: { msg:'...', tag:'Coach' }
  WIN.addEventListener('hha:coach', (ev)=>{
    if(!can('coach')) return;
    const d = (ev && ev.detail) || {};
    const msg = String(d.msg || '').trim();
    if(!msg) return;

    // show near lower center to avoid top HUD
    const r = DOC.documentElement.getBoundingClientRect();
    const x = r.left + r.width/2;
    const y = r.top + r.height*0.72;

    popAt(x + rand(-22,22), y + rand(-10,10), '💬 ' + msg, 'hha-coach');
  }, { passive:true });

  // ---- event: quest:update ----
  // when mini is done, give a tiny celebration
  WIN.addEventListener('quest:update', (ev)=>{
    const d = (ev && ev.detail) || {};
    const mini = d.mini || {};
    if(mini && mini.done === true){
      if(!can('mini')) return;
      const r = DOC.documentElement.getBoundingClientRect();
      const x = r.left + r.width*0.80;
      const y = r.top + r.height*0.18;
      popAt(x, y, '🎁 MINI ผ่าน!', 'hha-perfect');
      burstAt(x, y, { count: 8, spread: 120, lifeMs: 520 });
    }
  }, { passive:true });

  // ---- event: hha:end ----
  WIN.addEventListener('hha:end', (ev)=>{
    if(!can('end')) return;
    const s = (ev && ev.detail) || {};
    const grade = String(s.grade || '').trim();
    const score = (s.scoreFinal != null) ? String(s.scoreFinal) : '';

    const c = centerXY();
    if(grade){
      popAt(c.x, c.y - 40, `🏁 จบเกม! GRADE ${grade}`, 'hha-note');
    }else{
      popAt(c.x, c.y - 40, '🏁 จบเกม!', 'hha-note');
    }
    if(score){
      popAt(c.x, c.y - 10, `SCORE ${score}`, 'hha-good');
    }
    burstAt(c.x, c.y, { count: 14, spread: 140, lifeMs: 650 });
  }, { passive:true });

})();