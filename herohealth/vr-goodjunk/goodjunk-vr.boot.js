// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (v2026-01-31)
// ✅ Starts goodjunk.safe.js boot()
// ✅ view auto -> best effort (pc/mobile/cvr/vr) (only if user didn't specify ?view=)
// ✅ Restores EFFECTS (Particles) via event wiring: hha:judge / hha:coach / hha:end
// ✅ Safe: never crashes if Particles / Logger / VRUI missing

import { boot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

function detectView(){
  const forced = (qs('view','')||'').toLowerCase();
  if(forced && forced !== 'auto') return forced;

  const ua = (navigator.userAgent||'').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua);

  // user explicitly wants cvr (strict) sometimes
  const isCardboard = (forced === 'cvr');
  if(isCardboard) return 'cvr';

  const isXRUA = /oculus|quest|vive|pico|webkitxr/.test(ua);
  if(isXRUA) return 'vr';

  return isMobile ? 'mobile' : 'pc';
}

function setBodyViewClass(view){
  try{
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    if(view === 'pc') DOC.body.classList.add('view-pc');
    else if(view === 'vr') DOC.body.classList.add('view-vr');
    else if(view === 'cvr') DOC.body.classList.add('view-cvr');
    else DOC.body.classList.add('view-mobile');
  }catch(_){}
}

// ---- Effects wiring (Particles) ----
function px(n){ return Math.max(0, Math.floor(Number(n)||0)); }
function centerXY(){
  const r = DOC.documentElement.getBoundingClientRect();
  return { x: px(r.left + r.width/2), y: px(r.top + r.height/2) };
}
function safePop(text, cls){
  try{
    if(WIN.Particles && typeof WIN.Particles.popText === 'function'){
      const c = centerXY();
      WIN.Particles.popText(c.x, c.y, text, cls || '');
      return true;
    }
  }catch(_){}
  return false;
}
function safeBurst(){
  try{
    if(WIN.Particles && typeof WIN.Particles.burst === 'function'){
      const c = centerXY();
      WIN.Particles.burst(c.x, c.y, { count: 14 });
      return true;
    }
  }catch(_){}
  return false;
}

// Map judge types -> effect
function wireEffects(){
  // GOOD / OOPS / MISS / PERFECT / BOSS CLEAR
  WIN.addEventListener('hha:judge', (ev)=>{
    try{
      const d = ev.detail || {};
      const type = String(d.type || '').toLowerCase();
      const label = String(d.label || '').slice(0, 40);

      if(type === 'good'){
        safePop(label || 'GOOD', 'good');
      }else if(type === 'bad'){
        safePop(label || 'OOPS', 'bad');
      }else if(type === 'miss'){
        safePop(label || 'MISS', 'miss');
      }else if(type === 'perfect'){
        safePop(label || 'NICE!', 'perfect');
        safeBurst();
      }else{
        // fallback
        if(label) safePop(label, 'info');
      }
    }catch(_){}
  }, { passive:true });

  // Coach micro tips
  WIN.addEventListener('hha:coach', (ev)=>{
    try{
      const d = ev.detail || {};
      const msg = String(d.msg || '').trim();
      if(!msg) return;
      // show a subtle pop (no spam: safe.js already rate-limits tip)
      safePop('💡', 'tip');
    }catch(_){}
  }, { passive:true });

  // End summary fireworks
  WIN.addEventListener('hha:end', (ev)=>{
    try{
      const s = ev.detail || {};
      const grade = String(s.grade || '');
      if(grade === 'A'){
        safePop('🏆 A!', 'perfect'); safeBurst();
        setTimeout(safeBurst, 220);
      }else if(grade === 'B'){
        safePop('✨ B', 'good'); safeBurst();
      }else if(grade){
        safePop(`จบเกม ${grade}`, 'info');
      }else{
        safePop('จบเกม', 'info');
      }
    }catch(_){}
  }, { passive:true });
}

// ---- (Optional) logger handshake (if you use hha-cloud-logger.js) ----
function wireLogger(){
  // If your logger listens to these events, just emitting is enough.
  // goodjunk.safe.js already emits: hha:start, hha:time, hha:score, quest:update, hha:end
  // Here we only ensure page identifies itself.
  try{
    WIN.dispatchEvent(new CustomEvent('hha:page', { detail:{ game:'GoodJunkVR', role:'run' } }));
  }catch(_){}
}

function start(){
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;

  const seed = qs('seed', null) || String(Date.now());
  const view = detectView();

  setBodyViewClass(view);

  // update chip meta text if exists
  try{
    const chipMeta = DOC.getElementById('gjChipMeta');
    if(chipMeta){
      const v = qs('view','auto');
      chipMeta.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
    }
  }catch(_){}

  // Ensure initial safe-zone measure happens after layout
  try{
    setTimeout(()=> WIN.dispatchEvent(new CustomEvent('gj:measureSafe', {detail:{ reason:'boot' }})), 50);
    setTimeout(()=> WIN.dispatchEvent(new CustomEvent('gj:measureSafe', {detail:{ reason:'boot2' }})), 250);
  }catch(_){}

  boot({ view, run, diff, time, seed });
}

(function(){
  // global trap
  WIN.addEventListener('error', (e)=>{
    try{ console.error('[GoodJunkVR] error', e?.error || e?.message || e); }catch(_){}
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    try{ console.error('[GoodJunkVR] unhandled', e?.reason || e); }catch(_){}
  });

  // EFFECTS + Logger wiring (safe)
  wireEffects();
  wireLogger();

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }
})();