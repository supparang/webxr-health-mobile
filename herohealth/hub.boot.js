// === /herohealth/hub.boot.js ===
// HeroHealth HUB Controller — PRODUCTION (PATCH v20260218-warmupGatePick5)
// ✅ Adds Warmup/Cooldown Gate routing with: cat(zone) + theme(game) + pick(play=rand, research=day)
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
  // NOTE: warmup-gate and run pages will receive these
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

  // nutrition (your 4)
  if(gameKey==='goodjunk') return { cat:'nutrition', theme:'goodjunk' };
  if(gameKey==='groups')   return { cat:'nutrition', theme:'groups' };
  if(gameKey==='hydration')return { cat:'nutrition', theme:'hydration' };
  if(gameKey==='plate')    return { cat:'nutrition', theme:'plate' };

  // hygiene (examples)
  if(gameKey==='handwash') return { cat:'hygiene', theme:'handwash' };
  if(gameKey==='brush')    return { cat:'hygiene', theme:'brush' };
  if(gameKey==='maskcough')return { cat:'hygiene', theme:'maskcough' };
  if(gameKey==='germ')     return { cat:'hygiene', theme:'germ' };

  // exercise (examples)
  if(gameKey==='shadow')   return { cat:'exercise', theme:'shadow' };
  if(gameKey==='rhythm')   return { cat:'exercise', theme:'rhythm' };
  if(gameKey==='jumpduck') return { cat:'exercise', theme:'jumpduck' };
  if(gameKey==='balance')  return { cat:'exercise', theme:'balance' };
  if(gameKey==='planner')  return { cat:'exercise', theme:'planner' };

  // fallback
  return { cat:'nutrition', theme:'goodjunk' };
}

function warmupGateUrlFor(nextUrl, gameKey, phase){
  const gate = abs('./warmup-gate.html');   // /herohealth/warmup-gate.html (same folder)
  const hub  = abs('./hub.html');

  const { cat, theme } = mapGameToCatTheme(gameKey);
  const pick = decidePickMode();

  const params = {};
  params.hub = hub;
  params.next = abs(nextUrl || hub);
  params.phase = String(phase||'warmup'); // warmup|cooldown
  params.cat = cat;
  params.theme = theme;
  params.pick = pick;

  // optional forced variant
  if(P.variant) params.variant = P.variant;

  // pass common research/play context
  // (we pass these via query too, so gate can forward to run page)
  Object.assign(params, {
    run: P.run, diff: P.diff, time: P.time, seed: P.seed,
    studyId: P.studyId, phase: P.phase, conditionGroup: P.conditionGroup,
    pid: P.pid, view: P.view, log: P.log
  });

  // separate durations if you want:
  // params.dur = 20;
  // params.cdur = 18;

  return buildUrl(gate, params);
}

// ---------- UI wiring (minimal generic) ----------
function setupGameCards(){
  // Expect cards/links with data-game + data-run-href
  // Example in hub.html:
  // <a class="game-card" data-game="goodjunk" data-run-href="./vr-goodjunk/goodjunk-vr.html">Play</a>
  $$('.game-card,[data-game][data-run-href]').forEach(el=>{
    const game = el.getAttribute('data-game');
    const runHref = el.getAttribute('data-run-href');

    el.addEventListener('click', (e)=>{
      // route via warmup gate always (warmup)
      e.preventDefault();

      const gate = warmupGateUrlFor(runHref, game, 'warmup');
      location.href = gate;
    });
  });

  // Optional cooldown button example:
  // <button id="btnCooldown" data-next="./hub.html" data-cat="nutrition">Cooldown</button>
  const cd = $('#btnCooldown');
  if(cd){
    cd.addEventListener('click', (e)=>{
      e.preventDefault();
      const cat = String(cd.getAttribute('data-cat')||'nutrition').toLowerCase();
      const next = String(cd.getAttribute('data-next')||'./hub.html');
      const gate = buildUrl(abs('./warmup-gate.html'), {
        hub: abs('./hub.html'),
        next: abs(next),
        phase: 'cooldown',
        cat,
        theme: 'calm',
        pick: decidePickMode(),
        run: P.run, pid: P.pid, diff: P.diff, time: P.time, seed: P.seed,
        studyId: P.studyId, phase: P.phase, conditionGroup: P.conditionGroup,
        view: P.view, log: P.log
      });
      location.href = gate;
    });
  }
}

// ---------- API banner + retry (kept compatible with your old hub) ----------
async function boot(){
  try{
    setBanner('info', 'กำลังตรวจสอบระบบ…');
    attachRetry();

    // Probe API (403-safe)
    await probeAPI(API_ENDPOINT);
    setBanner('ok', 'พร้อมใช้งาน');
  }catch(err){
    // probeAPI in your code likely already handles disable latch; still show text
    setBanner('warn', 'โหมดออฟไลน์/จำกัดการเชื่อมต่อ (ยังเล่นได้)');
  }

  setupGameCards();

  // small hint: show pick policy
  try{
    const pick = decidePickMode();
    const tip = $('#hubPickTip');
    if(tip) tip.textContent = `Pick: ${pick.toUpperCase()} (run=${P.run})`;
  }catch(e){}
}

boot();