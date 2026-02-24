// === /herohealth/hub.boot.js ===
// Hub controller: pass-through params, patch links, reset today, probe banner (403-safe)
// PATCH v20260224e: FIX hub root lock + first-cooldown-of-day policy (per pid+zone) + cdkey passthrough
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

function absUrlMaybe(url){
  if(!url) return '';
  try{ return new URL(url, location.href).toString(); }catch{ return String(url||''); }
}

/** ✅ HARD LOCK: hub ต้องเป็น root เท่านั้น (ป้องกันหลุดไป /vr-goodjunk/hub.html) */
function rootHubUrl(){
  return absUrlMaybe('./hub.html');
}

/** YYYY-MM-DD (ใช้ local timezone ของเครื่อง ซึ่งคุณอยู่ไทยก็จะเป็นวันไทย) */
function todayYMD(){
  try{
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da= String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }catch(_){
    return '0000-00-00';
  }
}

/** โซนจาก gameKey */
function inferZoneByGameKey(gameKey){
  const k = String(gameKey||'').toLowerCase();
  if(['goodjunk','groups','hydration','plate'].includes(k)) return 'nutrition';
  if(['handwash','brush','maskcough','germdetective','bath','clean'].includes(k)) return 'hygiene';
  return 'exercise';
}

/** key สำหรับ cooldown ครั้งแรกของวัน (per pid+zone+day) */
function cooldownDoneKey(pid, zone){
  const p = (String(pid||'').trim() || 'anon').toLowerCase();
  const z = (String(zone||'').trim() || 'nutrition').toLowerCase();
  return `HHA_CD_DONE_V1:${p}:${z}:${todayYMD()}`;
}

/** ตรวจว่าควรบังคับ cooldown ไหม (ครั้งแรกของวัน) */
function shouldCooldownFirstOfDay(pid, zone){
  try{
    const key = cooldownDoneKey(pid, zone);
    return !localStorage.getItem(key);
  }catch(_){
    // ถ้าอ่าน localStorage ไม่ได้ ให้ “บังคับ cooldown” เพื่อความปลอดภัยของ flow งานวิจัย
    return true;
  }
}

const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed','')) || nowSeed(),

  // ✅ force hub root always
  hub:  rootHubUrl(),

  pid: String(qs('pid','')).trim(),
  studyId: String(qs('studyId','')).trim(),
  phase: String(qs('phase','')).trim(),
  conditionGroup: String(qs('conditionGroup','')).trim(),
  view: String(qs('view','')).trim(),
  log: String(qs('log','')).trim(),

  // warmup/cooldown policies base (จะ override ต่อเกมอีกที)
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

function addCommonParams(u){
  const set = (k,v)=>{ if(v!==undefined && v!==null && v!=='') u.searchParams.set(k, String(v)); };

  // ✅ always root hub
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

  // warmup/cooldown base passthrough (note: per-game override later)
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

  // bloom passthrough (ช่วยให้ bloom gate รู้ระดับ)
  set('bloom', P.bloom || 'c');

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
  if(k==='clean')    return './home-clean/clean-objects.html';

  if(k==='shadow')   return '../fitness/shadow-breaker.html';
  if(k==='rhythm')   return '../fitness/rhythm-boxer.html';
  if(k==='jumpduck') return '../fitness/jump-duck.html';
  if(k==='balance')  return '../fitness/balance-hold.html';
  if(k==='planner')  return '../fitness/fitness-planner/index.html';

  return './vr-goodjunk/goodjunk-vr.html';
}

/**
 * ✅ per-game cooldown policy:
 * - ถ้า cooldown policy เปิดอยู่ (P.cooldown != '0')
 * - และเป็น "ครั้งแรกของวัน" ของ zone นั้น (per pid)
 * => ส่ง cooldown=1 พร้อม cdkey ให้ warmup-gate ทำเครื่องหมายว่า done แล้ว
 * ไม่งั้น cooldown=0
 */
function applyCooldownPolicyToUrl(u, gameKey){
  const zone = inferZoneByGameKey(gameKey);
  const baseEnable = String(P.cooldown||'1') !== '0';

  let needCd = false;
  if(baseEnable){
    needCd = shouldCooldownFirstOfDay(P.pid, zone);
  }

  u.searchParams.set('zone', zone);
  u.searchParams.set('cooldown', needCd ? '1' : '0');
  u.searchParams.set('cdur', String(P.cdur || 15));

  // ✅ ส่ง key ให้ gate ใช้ mark done
  // warmup-gate.html: ถ้า gatePhase=cooldown และเล่นจบ ให้ localStorage.setItem(cdkey,'1')
  const cdkey = cooldownDoneKey(P.pid, zone);
  u.searchParams.set('cdkey', cdkey);

  return u;
}

function buildGameRunUrlFromGameKey(gameKey){
  const base = absUrlMaybe(gameRunPathByKey(gameKey));
  const u = new URL(base, location.href);

  addCommonParams(u);

  // ✅ ensure zone
  if(!u.searchParams.get('zone')){
    u.searchParams.set('zone', inferZoneByGameKey(gameKey));
  }

  // ✅ override hub root (กันหลุดอีกชั้น)
  u.searchParams.set('hub', P.hub);

  // ✅ apply cooldown policy
  applyCooldownPolicyToUrl(u, gameKey);

  // ✅ cdnext chain (ถ้าคุณมี logic จริงอยู่แล้ว ให้เสียบตรงนี้)
  // const cdnext = computeNextSlotUrl(); if(cdnext) u.searchParams.set('cdnext', cdnext);

  return u.toString();
}

function warmupGateUrlFor(gameUrl, gameKey, phase){
  const gate = absUrlMaybe('./warmup-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  // ✅ hub root always
  u.searchParams.set('hub', P.hub);

  // ✅ gate chaining
  u.searchParams.set('gatePhase', String(phase||'warmup'));
  u.searchParams.set('next', absUrlMaybe(gameUrl));

  const zone = inferZoneByGameKey(gameKey);
  u.searchParams.set('zone', zone);

  // warmup-gate ใช้ cat (zone) เป็นตัวจัดหมวด
  u.searchParams.set('cat', zone);

  // ช่วยให้ theme detect แม่น
  u.searchParams.set('theme', String(gameKey||'').toLowerCase());

  // ✅ ส่ง cdkey ต่อไปด้วย (สำคัญตอน cooldown)
  u.searchParams.set('cdkey', cooldownDoneKey(P.pid, zone));

  return u.toString();
}

// ✅ Bloom gate url
function bloomGateUrlFor(nextUrl, gameKey, bloomLevel){
  const gate = absUrlMaybe('./bloom-gate.html');
  const u = new URL(gate, location.href);

  addCommonParams(u);

  u.searchParams.set('hub', P.hub);

  u.searchParams.set('bloom', String(bloomLevel||P.bloom||'c'));
  u.searchParams.set('next', absUrlMaybe(nextUrl));

  const zone = inferZoneByGameKey(gameKey);
  u.searchParams.set('zone', zone);
  u.searchParams.set('cat', zone);

  u.searchParams.set('theme', String(gameKey||'').toLowerCase());

  // bloom สั้นกว่า warmup
  if(!u.searchParams.get('dur')) u.searchParams.set('dur', '18');

  // pass cdkey
  u.searchParams.set('cdkey', cooldownDoneKey(P.pid, zone));

  return u.toString();
}

// ✅ wrapper: Bloom -> Warmup -> Game
function wrapBloomWarmup(gameUrl, gameKey){
  const warmUrl = warmupGateUrlFor(gameUrl, gameKey, 'warmup');

  const b = String(P.bloom || 'c').toLowerCase();
  const useBloom = (b === 'a' || b === 'b' || b === 'c');

  if(!useBloom) return warmUrl;

  // next ของ bloom = warmup gate
  return bloomGateUrlFor(warmUrl, gameKey, b);
}

function setupHubButtons(){
  const btns = document.querySelectorAll('[data-game]');
  btns.forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();

      const gameKey = String(btn.getAttribute('data-game')||'goodjunk').toLowerCase();

      // ✅ build game url with per-game cooldown policy + hub root lock
      const gameUrl = buildGameRunUrlFromGameKey(gameKey);

      // ✅ go Bloom -> Warmup -> Game
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