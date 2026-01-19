// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — S (PACK-FAIR)
// ✅ Parse query: view/run/diff/time/seed/hub/studyId/phase/conditionGroup/style/ts/log
// ✅ Set body view classes: view-pc | view-mobile | view-vr | view-cvr
// ✅ Does NOT override if ?view= provided (already handled by launcher; still respects here)
// ✅ Ensures particles + vr-ui + cloud logger are present (loaded via html as defer scripts)
// ✅ Measures HUD safe zone vars used by goodjunk.safe.js getSafeRect()
// ✅ Calls boot() from ./goodjunk.safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function px(n){ return `${Math.max(0, Math.floor(Number(n)||0))}px`; }

function updateSafeVars(){
  // ✅ measure HUD => set safe spawn vars used by goodjunk.safe.js getSafeRect()
  try{
    const sat = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat')) || 0;

    const topbarH = DOC.getElementById('gjTopbar')?.getBoundingClientRect().height || 0;
    const hudTopH = DOC.getElementById('gjHudTop')?.getBoundingClientRect().height || 0;
    const hudBotH = DOC.getElementById('gjHudBot')?.getBoundingClientRect().height || 0;

    // if HUD hidden => heights collapse automatically (good)
    const topSafe = topbarH + hudTopH + 16 + sat;
    const botSafe = Math.max(110, hudBotH + 18);

    DOC.documentElement.style.setProperty('--gj-top-safe', px(topSafe));
    DOC.documentElement.style.setProperty('--gj-bottom-safe', px(botSafe));
  }catch(_){}
}

function wireHudButtons(){
  const btnBack = DOC.getElementById('btnBackHub');
  const btnHide = DOC.getElementById('btnHideHud');
  const btnMis  = DOC.getElementById('btnMissions');

  const peek = DOC.getElementById('missionsPeek');
  const peekGoal = DOC.getElementById('peekGoal');
  const peekMini = DOC.getElementById('peekMini');

  const hub = qs('hub', null);

  btnBack?.addEventListener('click', ()=>{
    try{
      if(hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    }catch(_){}
  });

  btnHide?.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
    setTimeout(updateSafeVars, 0);
    setTimeout(updateSafeVars, 120);
  });

  function toggleMissions(){
    DOC.body.classList.toggle('show-missions');
    const shown = DOC.body.classList.contains('show-missions');
    peek?.setAttribute('aria-hidden', shown ? 'false' : 'true');
    if(shown){
      if(peekGoal) peekGoal.textContent = (DOC.getElementById('hud-goal')?.textContent || '—');
      if(peekMini) peekMini.textContent = (DOC.getElementById('hud-mini')?.textContent || '—');
    }
    setTimeout(updateSafeVars, 0);
  }
  btnMis?.addEventListener('click', toggleMissions);
  peek?.addEventListener('click', toggleMissions);
}

function patchChipMeta(){
  const chipMeta = DOC.getElementById('gjChipMeta');
  if(!chipMeta) return;

  const v = qs('view','auto');
  const run = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  chipMeta.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

function ensureMinimalFxStyles(){
  // optional: just in case some page missed particles.js; do not break if already there
  // (we don't inject heavy CSS here)
  try{
    if(DOC.getElementById('hhaFxBootStyles')) return;
    const st = DOC.createElement('style');
    st.id = 'hhaFxBootStyles';
    st.textContent = `
      body.gj.gj-storm { }
      body.gj.gj-boss { }
      body.gj.gj-rage { }
      body.gj.hud-hidden .gj-hud-top,
      body.gj.hud-hidden .gj-hud-bot { display:none !important; }
      body.gj.hud-hidden .gj-topbar { opacity:.92; }
      body.gj.show-missions .gj-peek { opacity:1; transform: translateY(0); }
    `;
    DOC.head.appendChild(st);
  }catch(_){}
}

function bootOnce(){
  // Prevent double-boot
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  // view
  const view = normalizeView(qs('view', 'mobile'));
  setBodyView(view);

  // wire UI (already exists in html, but safe to do)
  try{ wireHudButtons(); }catch(_){}
  try{ patchChipMeta(); }catch(_){}
  try{ ensureMinimalFxStyles(); }catch(_){}

  // safe vars
  updateSafeVars();
  setTimeout(updateSafeVars, 0);
  setTimeout(updateSafeVars, 120);
  setTimeout(updateSafeVars, 360);

  WIN.addEventListener('resize', updateSafeVars, { passive:true });
  WIN.addEventListener('orientationchange', updateSafeVars, { passive:true });

  // build payload for engine
  const payload = {
    view,
    run: String(qs('run','play')||'play').toLowerCase(),
    diff: String(qs('diff','normal')||'normal').toLowerCase(),
    time: clamp(qs('time','80'), 20, 300),
    seed: qs('seed', null) ?? qs('ts', null) ?? String(Date.now()),
    hub: qs('hub', null),

    // research pass-through
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),

    // optional style / logger endpoint is handled by the other modules (cloud-logger reads ?log=)
    style: qs('style', null)
  };

  // Start engine
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR Boot] engine boot failed', err);
    // As last resort, show a small on-screen error
    try{
      const ov = DOC.createElement('div');
      ov.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        display:flex; align-items:center; justify-content:center;
        background: rgba(2,6,23,.92);
        color:#e5e7eb; padding:16px; font: 900 14px/1.4 system-ui;
      `;
      ov.textContent = 'GoodJunkVR: boot error (ดู console)';
      DOC.body.appendChild(ov);
    }catch(_){}
  }
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', bootOnce, { once:true });
} else {
  bootOnce();
}