// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (HHA Standard)
// ✅ Reads URL params -> passes into goodjunk.safe.js boot()
// ✅ Sets body view classes (pc/mobile/vr/cvr)
// ✅ Sets VRUI lockPx per diff (optional)
// ✅ HUD bridge: score/time/miss/grade + quest/update + coach + end
// ✅ End summary + Back to HUB button support (if present in DOM)
// ✅ Flush hardened: pagehide + visibilitychange

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function qsn(k, def = 0){
  const v = qs(k, null);
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function qsb(k, def = false){
  const v = String(qs(k, '')).toLowerCase();
  if(v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if(v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return def;
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','view-cardboard','view-cvr-strict');

  const v = String(view || '').toLowerCase();
  if(v === 'pc') b.classList.add('view-pc');
  else if(v === 'vr') b.classList.add('view-vr','view-cardboard');
  else if(v === 'cvr') b.classList.add('view-cvr','view-cardboard');
  else b.classList.add('view-mobile');

  // strict mode: targets not clickable; must shoot via crosshair event
  if(v === 'cvr') b.classList.add('view-cvr-strict');
}

function wireHud(){
  const $ = (id)=>DOC.getElementById(id);

  const hud = {
    score: $('hud-score'),
    time:  $('hud-time'),
    miss:  $('hud-miss'),
    grade: $('hud-grade'),
    goal:  $('hud-goal'),
    goalCur: $('hud-goal-cur'),
    goalTarget: $('hud-goal-target'),
    mini:  $('hud-mini'),
  };

  function setText(el, v){ if(el) el.textContent = String(v); }

  // optional: show goal area if present
  function showGoalPanelIfNeeded(){
    const mid = DOC.querySelector('.hud-mid');
    if(!mid) return;
    // if any goal elements exist, allow it
    if(hud.goal || hud.goalCur || hud.goalTarget){
      mid.style.display = '';
    }
  }
  showGoalPanelIfNeeded();

  // listen from engine (goodjunk.safe.js emits)
  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    if(d.score != null) setText(hud.score, d.score);
    if(d.combo != null){
      // (optional) if you have hud-combo in CSS/HTML, update it too
      const hc = $('hud-combo');
      if(hc) setText(hc, d.combo);
    }
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    if(d.timeLeftSec != null) setText(hud.time, Math.ceil(d.timeLeftSec));
  });

  ROOT.addEventListener('hha:judge', (ev)=>{
    const d = ev?.detail || {};
    // optional toast via Particles handled in engine
    // could also set sub line
    if(d.label){
      // lightweight: show in mini line if present
      const sub = $('hud-mini');
      if(sub) sub.textContent = d.label;
    }
  });

  ROOT.addEventListener('quest:update', (ev)=>{
    const d = ev?.detail || {};
    if(d.goal){
      setText(hud.goal, d.goal.title || '—');
      setText(hud.goalCur, d.goal.cur ?? 0);
      setText(hud.goalTarget, d.goal.target ?? 0);
    }
    if(d.mini){
      const m = d.mini;
      const cur = (m.cur != null) ? Math.floor(m.cur) : 0;
      setText(hud.mini, `${m.title || 'Mini'} (${cur}/${m.target || 0})`);
    }
  });

  ROOT.addEventListener('hha:coach', (ev)=>{
    // your HTML currently hides coach panel; keep as hook for future
    // If you later enable coach UI, update it here.
  });

  ROOT.addEventListener('hha:end', (ev)=>{
    const s = ev?.detail || {};
    if(s.scoreFinal != null) setText(hud.score, s.scoreFinal);
    if(s.misses != null) setText(hud.miss, s.misses);
    if(s.grade) setText(hud.grade, s.grade);
    if(s.durationPlayedSec != null) setText(hud.time, 0);
  });
}

function wireHubBack(){
  // Optional: if you have a "Back HUB" button in this run page
  const btn = DOC.getElementById('btnBackHub') || DOC.querySelector('[data-act="back-hub"]');
  if(!btn) return;

  btn.addEventListener('click', ()=>{
    const hub = qs('hub','');
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ส่งพารามิเตอร์ hub=');
  });
}

function flushHardened(){
  // If you have cloud logger module that exposes flush
  const logger =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.CloudLogger) ||
    ROOT.CloudLogger ||
    null;

  let flushed = false;

  async function flush(reason){
    if(flushed) return;
    flushed = true;
    try{
      if(logger && typeof logger.flush === 'function'){
        await logger.flush({ reason });
      }
    }catch(_){}
  }

  // page lifecycle
  ROOT.addEventListener('pagehide', ()=>{ flush('pagehide'); }, { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') flush('hidden');
  }, { passive:true });

  // expose manual
  ROOT.addEventListener('hha:flush', (ev)=>{
    flush(ev?.detail?.reason || 'manual');
  }, { passive:true });
}

function attachEngine(){
  const view = String(qs('view','mobile')).toLowerCase();
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = qsn('time', 80);

  // seed: in research, if empty -> keep deterministic (engine handles default too)
  const seedParam = qs('seed', '');
  const seed = (seedParam === '' || seedParam == null) ? null : Number(seedParam);

  const hub = qs('hub', '') || null;

  const studyId = qs('studyId', null);
  const phase   = qs('phase', null);
  const conditionGroup = qs('conditionGroup', null) || qs('cond', null);

  // VRUI tuning (optional)
  // lockPx bigger = easier aim assist (จับเป้าใกล้ crosshair)
  ROOT.HHA_VRUI_CONFIG = ROOT.HHA_VRUI_CONFIG || {};
  ROOT.HHA_VRUI_CONFIG.lockPx = ROOT.HHA_VRUI_CONFIG.lockPx || 26;
  ROOT.HHA_VRUI_CONFIG.perDiffLockPx = ROOT.HHA_VRUI_CONFIG.perDiffLockPx || {
    easy: 30,
    normal: 26,
    hard: 22
  };
  // In cVR we want shoot even if target pointer-events disabled
  ROOT.HHA_VRUI_CONFIG.allowShootInCardboard = true;

  // Start when gate event arrives (your run html dispatches hha:start after overlay)
  let started = false;
  function startEngine(detail){
    if(started) return;
    started = true;

    setBodyView(detail?.view || view);

    engineBoot({
      view,
      run,
      diff,
      time,
      seed,
      hub,
      studyId,
      phase,
      conditionGroup,
    });
  }

  // If you keep overlay gate: wait for it
  ROOT.addEventListener('hha:start', (ev)=>{
    startEngine(ev?.detail || {});
  }, { passive:true });

  // fallback: if page has no gate overlay, auto-start after load
  // (keep false by default to avoid double start)
  const auto = qsb('auto', false);
  if(auto){
    ROOT.addEventListener('DOMContentLoaded', ()=>{
      startEngine({ view });
    }, { once:true });
  }
}

// ---- boot ----
(function main(){
  wireHud();
  wireHubBack();
  flushHardened();
  attachEngine();
})();