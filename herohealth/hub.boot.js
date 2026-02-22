// === /herohealth/hub.boot.js ===
// HeroHealth HUB Controller — PRODUCTION (PATCH v20260218-warmupGatePick5 + hub-buttons)
// ✅ Warmup/Cooldown Gate routing for real Hub buttons (#goGoodJunk, #goHandwash, ...)
// ✅ Supports hygiene additions: germ-detective, bath, cleanobjects(run=home-clean.html)
// ✅ Supports overrides: ?pick=rand|day and ?variant=1..5
// ✅ Safe pass-through of study/research params + hub back-link
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

// ---- base endpoint (your existing)
const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

// ---- Hub params (pass-through)
const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',        // play|research
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed', nowSeed())),

  // research context
  studyId: String(qs('studyId','')).trim(),
  phase: String(qs('phase','')).trim(),
  conditionGroup: String(qs('conditionGroup','')).trim(),
  pid: String(qs('pid','')).trim() || 'anon',

  // view/log passthrough
  view: String(qs('view','')).trim(),
  log: String(qs('log','')).trim(),

  // overrides for warmup-gate
  pick: String(qs('pick','')).toLowerCase().trim(),         // rand|day (optional)
  variant: String(qs('variant','')).trim(),                 // 1..5 (optional)
};

// ---- DOM helpers
const DOC = document;
const $$ = (sel)=>Array.from(DOC.querySelectorAll(sel));
const $  = (sel)=>DOC.querySelector(sel);

function abs(url){
  if(!url) return '';
  try{ return new URL(url, location.href).toString(); }catch(e){ return url; }
}

function buildUrl(base, params){
  const u = new URL(base, location.href);
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v===undefined || v===null || v==='') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

function passCommon(u){
  const keys = ['run','diff','time','seed','studyId','phase','conditionGroup','pid','view','log','pick','variant'];
  keys.forEach(k=>{
    const v = P[k];
    if(v!==undefined && v!==null && String(v).trim()!=='') u.searchParams.set(k, String(v));
  });
}

function decidePickMode(){
  // user override wins
  if(P.pick==='rand' || P.pick==='day') return P.pick;
  // default policy: play=rand, research=day
  return (P.run==='research') ? 'day' : 'rand';
}

// Map each game to (cat, theme) for gate
function mapGameToCatTheme(gameKey){
  gameKey = String(gameKey||'').toLowerCase().trim();

  // nutrition
  if(gameKey==='goodjunk')      return { cat:'nutrition', theme:'goodjunk' };
  if(gameKey==='groups')        return { cat:'nutrition', theme:'groups' };
  if(gameKey==='hydration')     return { cat:'nutrition', theme:'hydration' };
  if(gameKey==='plate')         return { cat:'nutrition', theme:'plate' };

  // hygiene (UPDATED)
  if(gameKey==='handwash')      return { cat:'hygiene', theme:'handwash' };
  if(gameKey==='brush')         return { cat:'hygiene', theme:'brush' };
  if(gameKey==='maskcough')     return { cat:'hygiene', theme:'maskcough' };
  if(gameKey==='germdetective') return { cat:'hygiene', theme:'germdetective' };
  if(gameKey==='germ')          return { cat:'hygiene', theme:'germdetective' }; // alias
  if(gameKey==='bath')          return { cat:'hygiene', theme:'bath' };
  if(gameKey==='cleanobjects')  return { cat:'hygiene', theme:'clean' };
  if(gameKey==='clean')         return { cat:'hygiene', theme:'clean' };          // alias

  // fitness / exercise (use cat='exercise' for warmup-gate compatibility)
  if(gameKey==='shadow')        return { cat:'exercise', theme:'shadow' };
  if(gameKey==='rhythm')        return { cat:'exercise', theme:'rhythm' };
  if(gameKey==='jumpduck')      return { cat:'exercise', theme:'jumpduck' };
  if(gameKey==='balancehold')   return { cat:'exercise', theme:'balance' };
  if(gameKey==='balance')       return { cat:'exercise', theme:'balance' };        // alias
  if(gameKey==='planner')       return { cat:'exercise', theme:'planner' };

  // fallback
  return { cat:'nutrition', theme:'goodjunk' };
}

function warmupGateUrlFor(nextUrl, gameKey, gatePhase){
  const gate = abs('./warmup-gate.html'); // /herohealth/warmup-gate.html
  const hub  = abs('./hub.html');

  const { cat, theme } = mapGameToCatTheme(gameKey);
  const pick = decidePickMode();

  // IMPORTANT: preserve research "phase" separately from gate phase
  const params = {
    hub,
    next: abs(nextUrl || hub),

    // gate phase (warmup/cooldown)
    gatePhase: String(gatePhase || 'warmup'),
    phase: String(gatePhase || 'warmup'), // keep backward compatibility if gate expects "phase"

    cat,
    theme,
    pick,

    // pass common context
    run: P.run, diff: P.diff, time: P.time, seed: P.seed,
    studyId: P.studyId,
    pid: P.pid,
    view: P.view, log: P.log
  };

  // keep research phase under a dedicated key to avoid collision
  if (P.phase) params.researchPhase = P.phase;
  if (P.conditionGroup) params.conditionGroup = P.conditionGroup;

  // optional forced variant
  if (P.variant) params.variant = P.variant;

  return buildUrl(gate, params);
}

// ---------- Helpers to patch plain hub links (add pass-through when opened directly) ----------
function patchLink(id){
  const el = DOC.getElementById(id);
  if(!el) return;
  const href = el.getAttribute('href');
  if(!href || href === '#' || el.getAttribute('aria-disabled') === 'true') return;

  try{
    const u = new URL(href, location.href);
    passCommon(u);
    // ensure back-link to hub exists for run pages that support ?hub=
    u.searchParams.set('hub', abs('./hub.html'));
    el.setAttribute('href', u.toString());
  }catch(e){}
}

// ---------- Real hub button routing via warmup-gate ----------
function setupHubButtons(){
  // Map hub button IDs -> gameKey used by warmup mapping
  const BTN_GAME_MAP = {
    // Nutrition
    goGoodJunk: 'goodjunk',
    goGroups: 'groups',
    goHydration: 'hydration',
    goPlate: 'plate',

    // Hygiene
    goHandwash: 'handwash',
    goBrush: 'brush',
    goMaskCough: 'maskcough',
    goGermDetective: 'germdetective',
    goBath: 'bath',
    goCleanObjects: 'cleanobjects',

    // Fitness
    goPlanner: 'planner',
    goShadow: 'shadow',
    goRhythm: 'rhythm',
    goJumpDuck: 'jumpduck',
    goBalanceHold: 'balancehold',
  };

  Object.entries(BTN_GAME_MAP).forEach(([id, gameKey])=>{
    const el = DOC.getElementById(id);
    if(!el) return;

    const href = el.getAttribute('href') || '';
    const disabled = el.classList.contains('btn--disabled') || el.getAttribute('aria-disabled') === 'true' || href === '#';
    if(disabled) return;

    // first patch href with passthrough (useful for open-in-new-tab / long press)
    patchLink(id);

    el.addEventListener('click', (e)=>{
      // modifier/middle click => allow normal behavior
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;

      e.preventDefault();

      const currentHref = el.getAttribute('href') || href;
      const gateUrl = warmupGateUrlFor(currentHref, gameKey, 'warmup');
      location.href = gateUrl;
    });
  });
}

// ---------- Legacy generic card wiring (kept for compatibility if other hub pages use it) ----------
function setupGameCards(){
  $$('.game-card,[data-game][data-run-href]').forEach(el=>{
    const game = el.getAttribute('data-game');
    const runHref = el.getAttribute('data-run-href');
    if(!game || !runHref) return;

    el.addEventListener('click', (e)=>{
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      const gate = warmupGateUrlFor(runHref, game, 'warmup');
      location.href = gate;
    });
  });

  // Optional cooldown button
  const cd = $('#btnCooldown');
  if(cd){
    cd.addEventListener('click', (e)=>{
      e.preventDefault();
      const cat = String(cd.getAttribute('data-cat')||'nutrition').toLowerCase();
      const next = String(cd.getAttribute('data-next')||'./hub.html');
      const gate = buildUrl(abs('./warmup-gate.html'), {
        hub: abs('./hub.html'),
        next: abs(next),
        gatePhase: 'cooldown',
        phase: 'cooldown', // backward compatibility
        cat,
        theme: 'calm',
        pick: decidePickMode(),
        run: P.run, pid: P.pid, diff: P.diff, time: P.time, seed: P.seed,
        studyId: P.studyId,
        researchPhase: P.phase || '',
        conditionGroup: P.conditionGroup || '',
        view: P.view, log: P.log
      });
      location.href = gate;
    });
  }
}

// ---------- API banner + retry ----------
async function boot(){
  try{
    setBanner('info', 'กำลังตรวจสอบระบบ…');
    attachRetry();

    await probeAPI(API_ENDPOINT);
    setBanner('ok', 'พร้อมใช้งาน');
  }catch(err){
    setBanner('warn', 'โหมดออฟไลน์/จำกัดการเชื่อมต่อ (ยังเล่นได้)');
  }

  // ✅ real hub buttons
  setupHubButtons();

  // ✅ legacy generic cards (if any)
  setupGameCards();

  // small hint: show pick policy
  try{
    const pick = decidePickMode();
    const tip = $('#hubPickTip');
    if(tip) tip.textContent = `Pick: ${pick.toUpperCase()} (run=${P.run})`;
  }catch(e){}

  // optional toast hint
  try{
    if (typeof toast === 'function') {
      toast(`Warmup routing: ${decidePickMode().toUpperCase()} • run=${P.run}`, { kind:'info', ttl: 1800 });
    }
  }catch(e){}
}

boot();