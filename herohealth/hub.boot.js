// === /herohealth/hub.boot.js ===
// Hub controller: pass-through params, patch links, reset today, probe banner (403-safe)
// PATCH v20260225: Bloom per-zone per-day (pid+zone+day) + Bloom -> Warmup -> Game wrapper
// PATCH v20260226: Canonical HUB URL (GitHub Pages safe)
// PATCH v20260303: FIX clean path to root launcher ./clean-objects.html
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';
import { resolveHub, hhaHub } from './js/hha-path.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed','')) || nowSeed(),
  hub:  String(qs('hub','')) || '',

  pid: String(qs('pid','')).trim(),
  studyId: String(qs('studyId','')).trim(),
  phase: String(qs('phase','')).trim(),
  conditionGroup: String(qs('conditionGroup','')).trim(),
  view: String(qs('view','')).trim(),
  log: String(qs('log','')).trim(),

  warmup: String(qs('warmup','1')),
  cooldown: String(qs('cooldown','1')),
  dur: clamp(qs('dur','20'), 5, 60),
  cdur: clamp(qs('cdur','15'), 5, 60),
  pick: String(qs('pick','')).toLowerCase().trim(),

  planSeq: String(qs('planSeq','')).trim(),
  planDay: String(qs('planDay','')).trim(),
  planSlot: String(qs('planSlot','')).trim(),
  planMode: String(qs('planMode','')).trim(),
  planSlots: String(qs('planSlots','')).trim(),
  planIndex: String(qs('planIndex','')).trim(),
  autoNext: String(qs('autoNext','')).trim(),
  plannedGame: String(qs('plannedGame','')).trim(),
  finalGame: String(qs('finalGame','')).trim(),
  zone: String(qs('zone','')).trim(),

  bloom: String(qs('bloom','c')).toLowerCase().trim(),
};

// canonical hub
try{
  P.hub = resolveHub(P.hub) || hhaHub();
}catch(e){
  P.hub = hhaHub();
}

function absUrlMaybe(url){
  if(!url) return '';
  try{ return new URL(url, location.href).toString(); }catch{ return String(url||''); }
}

/* Bloom daily (per zone) */
function localDayKey(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function bloomDailyKey(zone, pid){
  const z = String(zone||'').toLowerCase().trim() || 'nutrition';
  const p = String(pid||'').trim() || 'anon';
  return `HHA_BLOOM_DONE:${z}:${p}:${localDayKey()}`;
}
function isBloomDone(zone, pid){
  try{ return localStorage.getItem(bloomDailyKey(zone,pid)) === '1'; }catch(_){ return false; }
}

function addCommonParams(u){
  const set = (k,v)=>{ if(v!==undefined && v!==null && v!=='') u.searchParams.set(k, String(v)); };

  set('hub', P.hub);
  set('api', API_ENDPOINT);

  set('run', P.run);
  set('diff', P.diff);
  set('time', P.time);
  set('seed', P.seed);

  set('pid', P.pid);
  set('studyId', P.studyId);
  set('phase', P.phase);
  set('conditionGroup', P.conditionGroup);
  set('view', P.view);
  set('log', P.log);

  set('warmup', P.warmup);
  set('cooldown', P.cooldown);
  set('dur', P.dur);
  set('cdur', P.cdur);
  if(P.pick) set('pick', P.pick);

  [
    'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
    'plannedGame','finalGame','zone'
  ].forEach(k=> set(k, P[k]) );

  if(P.bloom) set('bloom', P.bloom);

  // passthrough optional UX/debug flags
  set('tutorial', qs('tutorial',''));
  set('practiceOn', qs('practiceOn',''));
  set('practice', qs('practice',''));
  set('direct', qs('direct',''));
  set('fast', qs('fast',''));
  set('skipBW', qs('skipBW',''));

  return u;
}

function gameRunPathByKey(gameKey){
  const k = String(gameKey||'').toLowerCase();

  if(k==='goodjunk') return './vr-goodjunk/goodjunk-vr.html';
  if(k==='groups')   return './vr-groups/groups-vr.html';
  if(k==='hydration')return './hydration/hydration-vr.html';
  if(k==='plate')    return './plate/plate-vr.html';

  if(k==='handwash') return './hygiene-vr/handwash-vr.html';
  if(k==='brush')    return './hygiene-vr/brush-vr.html';
  if(k==='maskcough')return './mask-cough/mask-cough.html';
  if(k==='germdetective') return './germ-detective/germ-detective.html';
  if(k==='bath')     return './vr-bath/bath-vr.html';

  // ✅ FIX: Clean Objects root launcher
  if(k==='clean')    return './clean-objects.html';

  if(k==='shadow')   return '../fitness/shadow-breaker.html';
  if(k==='rhythm')   return '../fitness/rhythm-boxer.html';
  if(k==='jumpduck') return '../fitness/jump-duck.html';
  if(k==='balance')  return '../fitness/balance-hold.html';
  if(k==='planner')  return '../fitness/fitness-planner/index.html';

  return './vr-goodjunk/goodjunk-vr.html';
}

function inferZoneByGameKey(gameKey){
  const k = String(gameKey||'').toLowerCase();
  if(['goodjunk','groups','hydration','plate'].includes(k)) return 'nutrition';
  if(['handwash','brush','maskcough','germdetective','bath','clean'].includes(k)) return 'hygiene';
  return 'exercise';
}

function buildGameRunUrlFromGameKey(gameKey){
  const base = absUrlMaybe(gameRunPathByKey(gameKey));
  const u = new URL(base, location.href);
  addCommonParams(u);
  if(!u.searchParams.get('zone')){
    u.searchParams.set('zone', inferZoneByGameKey(gameKey));
  }
  return u.toString();
}

function warmupGateUrlFor(gameUrl, gameKey, phase){
  const gate = absUrlMaybe('./warmup-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  const z = inferZoneByGameKey(gameKey);
  u.searchParams.set('gatePhase', String(phase||'warmup'));
  u.searchParams.set('next', absUrlMaybe(gameUrl));
  u.searchParams.set('cat', String(P.zone || z || 'nutrition'));
  u.searchParams.set('theme', String(gameKey||'').toLowerCase());

  return u.toString();
}

function bloomGateUrlFor(nextUrl, gameKey, bloomLevel){
  const gate = absUrlMaybe('./bloom-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  const z = inferZoneByGameKey(gameKey);

  u.searchParams.set('bloom', String(bloomLevel||P.bloom||'c'));
  u.searchParams.set('next', absUrlMaybe(nextUrl));
  u.searchParams.set('cat', String(P.zone || z || 'nutrition'));
  u.searchParams.set('theme', String(gameKey||'').toLowerCase());
  u.searchParams.set('zone', String(P.zone || z || 'nutrition'));
  u.searchParams.set('day', localDayKey());

  if(!u.searchParams.get('dur')) u.searchParams.set('dur', '18');
  return u.toString();
}

function wrapBloomWarmup(gameUrl, gameKey){
  const warmUrl = warmupGateUrlFor(gameUrl, gameKey, 'warmup');

  const b = String(P.bloom || 'c').toLowerCase();
  const useBloom = (b === 'a' || b === 'b' || b === 'c');
  if(!useBloom) return warmUrl;

  const z = inferZoneByGameKey(gameKey);
  const pid = P.pid || 'anon';
  if(isBloomDone(z, pid)){
    return warmUrl;
  }
  return bloomGateUrlFor(warmUrl, gameKey, b);
}

function setupHubButtons(){
  const btns = document.querySelectorAll('[data-game]');
  btns.forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const gameKey = String(btn.getAttribute('data-game')||'goodjunk').toLowerCase();
      const gameUrl = buildGameRunUrlFromGameKey(gameKey);
      const finalUrl = wrapBloomWarmup(gameUrl, gameKey);
      location.href = finalUrl;
    }, {passive:false});
  });
}

async function boot(){
  try{
    setBanner('API', 'checking…');
    const ok = await probeAPI(API_ENDPOINT);
    setBanner('API', ok ? 'OK' : 'offline');
    attachRetry(API_ENDPOINT);
  }catch(e){
    setBanner('API', 'offline');
  }

  setupHubButtons();
}

boot();