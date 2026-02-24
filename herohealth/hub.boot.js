// === /herohealth/hub.boot.js ===
// Hub controller: pass-through params, patch links, reset today, probe banner (403-safe)
// PATCH v20260224: Bloom Gate wrapper (Bloom -> Warmup -> Game) + keep planSeq everywhere
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed','')) || nowSeed(),
  hub:  String(qs('hub','./hub.html')) || './hub.html',

  pid: String(qs('pid','')).trim(),
  studyId: String(qs('studyId','')).trim(),
  phase: String(qs('phase','')).trim(),
  conditionGroup: String(qs('conditionGroup','')).trim(),
  view: String(qs('view','')).trim(),
  log: String(qs('log','')).trim(),

  // warmup/cooldown policies (you already use these in hub)
  warmup: String(qs('warmup','1')),
  cooldown: String(qs('cooldown','1')),
  dur: clamp(qs('dur','20'), 5, 60),
  cdur: clamp(qs('cdur','15'), 5, 60),
  pick: String(qs('pick','')).toLowerCase().trim(), // rand|day|''

  // plan sequence passthrough
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

  // ✅ BLOOM: a|b|c (default c)
  bloom: String(qs('bloom','c')).toLowerCase().trim(),
};

function absUrlMaybe(url){
  if(!url) return '';
  try{ return new URL(url, location.href).toString(); }catch{ return String(url||''); }
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

  // warmup/cooldown policy passthrough
  set('warmup', P.warmup);
  set('cooldown', P.cooldown);
  set('dur', P.dur);
  set('cdur', P.cdur);
  if(P.pick) set('pick', P.pick);

  // plan sequence passthrough
  [
    'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
    'plannedGame','finalGame','zone'
  ].forEach(k=> set(k, P[k]) );

  return u;
}

function gameRunPathByKey(gameKey){
  const k = String(gameKey||'').toLowerCase();
  // คุณมี mapping จริงอยู่แล้วใน hub (อันนี้คือ stub ให้ครบ)
  // ปรับได้ตามโครงจริงของคุณ
  if(k==='goodjunk') return './vr-goodjunk/goodjunk-vr.html';
  if(k==='groups')   return './vr-groups/groups-vr.html';
  if(k==='hydration')return './hydration/hydration-vr.html';
  if(k==='plate')    return './plate/plate-vr.html';

  if(k==='handwash') return './hygiene-vr/handwash-vr.html';
  if(k==='brush')    return './hygiene-vr/brush-vr.html';
  if(k==='maskcough')return './mask-cough/mask-cough.html';
  if(k==='germdetective') return './germ-detective/germ-detective.html';
  if(k==='bath')     return './vr-bath/bath-vr.html';
  if(k==='clean')    return './home-clean/clean-objects.html';

  if(k==='shadow')   return '../fitness/shadow-breaker.html';
  if(k==='rhythm')   return '../fitness/rhythm-boxer.html';
  if(k==='jumpduck') return '../fitness/jump-duck.html';
  if(k==='balance')  return '../fitness/balance-hold.html';
  if(k==='planner')  return '../fitness/fitness-planner/index.html';

  return './vr-goodjunk/goodjunk-vr.html';
}

function buildGameRunUrlFromGameKey(gameKey){
  const base = absUrlMaybe(gameRunPathByKey(gameKey));
  const u = new URL(base, location.href);

  addCommonParams(u);

  // ✅ set zone if missing (helps cooldown cat)
  if(!u.searchParams.get('zone')){
    // infer minimal
    const k = String(gameKey||'').toLowerCase();
    const z =
      (['goodjunk','groups','hydration','plate'].includes(k)) ? 'nutrition' :
      (['handwash','brush','maskcough','germdetective','bath','clean'].includes(k)) ? 'hygiene' :
      'exercise';
    u.searchParams.set('zone', z);
  }

  // ✅ cdnext chain: ถ้ามี plan sequence ให้ hub ทำ url slot ถัดไปเอง (ตามโค้ดจริงของคุณ)
  // ตรงนี้คุณมี logic เดิมอยู่แล้ว: ส่ง cdnext=... ไปเกม
  // ถ้ายังไม่มี ให้คงว่างไว้ก่อน (เกมจะกลับ hub)
  // ตัวอย่าง:
  // const cdnext = computeNextSlotUrl(); if(cdnext) u.searchParams.set('cdnext', cdnext);

  return u.toString();
}

function warmupGateUrlFor(gameUrl, gameKey, phase){
  const gate = absUrlMaybe('./warmup-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  u.searchParams.set('gatePhase', String(phase||'warmup'));
  u.searchParams.set('next', absUrlMaybe(gameUrl));
  u.searchParams.set('cat', String(P.zone || u.searchParams.get('zone') || 'nutrition'));

  // ช่วยให้ theme detect แม่น
  u.searchParams.set('theme', String(gameKey||'').toLowerCase());

  return u.toString();
}

// ✅ NEW: Bloom gate url
function bloomGateUrlFor(nextUrl, gameKey, bloomLevel){
  const gate = absUrlMaybe('./bloom-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  u.searchParams.set('bloom', String(bloomLevel||P.bloom||'c'));
  u.searchParams.set('next', absUrlMaybe(nextUrl));
  u.searchParams.set('cat', String(P.zone || 'nutrition'));
  u.searchParams.set('theme', String(gameKey||'').toLowerCase());

  // bloom สั้นกว่า warmup
  if(!u.searchParams.get('dur')) u.searchParams.set('dur', '18');

  return u.toString();
}

// ✅ NEW: wrapper: Bloom -> Warmup -> Game
function wrapBloomWarmup(gameUrl, gameKey){
  const warmUrl = warmupGateUrlFor(gameUrl, gameKey, 'warmup');

  const b = String(P.bloom || 'c').toLowerCase();
  const useBloom = (b === 'a' || b === 'b' || b === 'c');

  if(!useBloom) return warmUrl;

  // next ของ bloom = warmup gate
  return bloomGateUrlFor(warmUrl, gameKey, b);
}

function setupHubButtons(){
  // ปุ่มแต่ละเกมใน HUB ของคุณ (ตัวจริงคุณมี querySelector ที่เจาะปุ่ม)
  // ตรงนี้ทำให้เป็นตัวอย่างที่ “แปะทับ” ได้โดยไม่พัง:
  const btns = document.querySelectorAll('[data-game]');
  btns.forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const gameKey = String(btn.getAttribute('data-game')||'goodjunk').toLowerCase();
      const gameUrl = buildGameRunUrlFromGameKey(gameKey);

      // ✅ PATCH: go Bloom -> Warmup -> Game
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