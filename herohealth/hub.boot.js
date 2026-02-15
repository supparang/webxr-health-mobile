// === /herohealth/hub.boot.js ===
// Hub controller: pass-through params, patch links, reset today, probe banner (401/403-safe)
// PATCH v20260215f
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

// ✅ health endpoint (avoid POST to root). Adjust to your real path if needed.
const HEALTH_PATH = qs('health', '/prod/health'); // you can override with ?health=/your/path

const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed','') || nowSeed()),
  pid:  String(qs('pid','')).trim() || 'anon',
  view: String(qs('view','')).toLowerCase(),
  log:  String(qs('log','')),
  studyId: String(qs('studyId','')),
  phase: String(qs('phase','')),
  conditionGroup: String(qs('conditionGroup',''))
};

// chips
const $ = (id)=>document.getElementById(id);
if($('cRun')) $('cRun').textContent = P.run;
if($('cDiff')) $('cDiff').textContent = P.diff;
if($('cTime')) $('cTime').textContent = String(P.time);
if($('cPid')) $('cPid').textContent = P.pid;

function buildHubUrl(){
  const u = new URL(location.href);
  u.search = '';
  const sp = u.searchParams;
  sp.set('run', P.run);
  sp.set('diff', P.diff);
  sp.set('time', String(P.time));
  sp.set('seed', P.seed);
  sp.set('pid', P.pid);
  if(P.view) sp.set('view', P.view);
  if(P.log) sp.set('log', P.log);
  if(P.studyId) sp.set('studyId', P.studyId);
  if(P.phase) sp.set('phase', P.phase);
  if(P.conditionGroup) sp.set('conditionGroup', P.conditionGroup);
  if(API_ENDPOINT) sp.set('api', API_ENDPOINT);
  if(HEALTH_PATH) sp.set('health', HEALTH_PATH);
  return u.toString();
}

function withCommonParams(url){
  const u = new URL(url, location.href);
  const sp = u.searchParams;
  sp.set('hub', buildHubUrl());
  sp.set('run', P.run);
  sp.set('diff', P.diff);
  sp.set('time', String(P.time));
  sp.set('seed', P.seed);
  sp.set('pid', P.pid);
  if(P.view) sp.set('view', P.view);
  if(P.log) sp.set('log', P.log);
  if(P.studyId) sp.set('studyId', P.studyId);
  if(P.phase) sp.set('phase', P.phase);
  if(P.conditionGroup) sp.set('conditionGroup', P.conditionGroup);
  // ✅ forward api to all games
  if(API_ENDPOINT) sp.set('api', API_ENDPOINT);
  if(HEALTH_PATH) sp.set('health', HEALTH_PATH);
  return u.toString();
}

// patch links (✅ updated for your current hub buttons)
const linkIds = [
  'goGoodJunk','goGroups','goHydration','goPlate',
  'goHandwash','goBrush','goMaskCough',
  'goPlanner','goShadow','goRhythm','goJumpDuck','goBalanceHold'
];

for(const id of linkIds){
  const a = $(id);
  if(!a) continue;
  const href = a.getAttribute('href');
  if(!href || href === '#') continue;
  a.href = withCommonParams(href);
}

// coming soon (avoid 404)
function wireComingSoon(id, msg){
  const a = $(id);
  if(!a) return;
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    toast(msg || 'Coming soon ✨');
  });
}
wireComingSoon('goGermDetective', 'Germ Detective: กำลังพัฒนา 🦠🔎');

// reset today
function getLocalDayKey(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function zoneDoneKey(zone){ return `HHA_ZONE_DONE::${zone}::${getLocalDayKey()}`; }

function resetToday(){
  try{
    localStorage.removeItem(zoneDoneKey('nutrition'));
    localStorage.removeItem(zoneDoneKey('hygiene'));
    localStorage.removeItem(zoneDoneKey('fitness'));
  }catch(_){}
}

const btnResetToday = $('btnResetToday');
if(btnResetToday){
  btnResetToday.addEventListener('click', (e)=>{
    e.preventDefault();
    resetToday();
    toast('Reset today ✅ (ล้าง 3 โซน)');
  });
}

// build health URL: base + HEALTH_PATH (avoid POST to root)
function buildHealthUrl(){
  const base = String(API_ENDPOINT || '').trim();
  const hp = String(HEALTH_PATH || '').trim() || '/prod/health';
  if(!base) return '';
  try{
    const u = new URL(base);
    u.pathname = hp.startsWith('/') ? hp : ('/' + hp);
    u.search = '';
    return u.toString();
  }catch{
    const slash = base.endsWith('/') ? '' : '/';
    const p = hp.startsWith('/') ? hp.slice(1) : hp;
    return base + slash + p;
  }
}

// safe probe (GET health)
let probeLock = false;
async function probe(){
  if(probeLock) return;
  probeLock = true;

  if(!API_ENDPOINT){
    setBanner({}, 'warn', 'ไม่มี API URI', 'ทำงานแบบ Offline (เข้าเกมได้ปกติ)');
    probeLock = false;
    return;
  }

  const url = buildHealthUrl();
  setBanner({}, 'warn', 'กำลังตรวจสอบระบบ…', `กำลังตรวจสอบ API (GET ${HEALTH_PATH})`);

  // ✅ GET (ping:false) so no POST root => avoids 401/403 spam
  const r = await probeAPI(url, { ping:false, disableOnAuth:false }, 3200);

  if(r.status === 200){
    setBanner({}, 'ok', 'Online ✅', 'API พร้อมใช้งาน • logging/research ใช้งานได้');
  }else if(r.status === 401 || r.status === 403){
    setBanner({}, 'warn', `Auth/CORS (API ${r.status})`, 'API ต้องยืนยันตัวตนหรือ CORS • Hub/เกมยังเล่นได้ปกติ');
  }else if(r.status){
    setBanner({}, 'warn', `API ตอบ ${r.status}`, 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจ route/headers');
  }else{
    setBanner({}, 'bad', 'Offline/เชื่อมต่อไม่ได้', 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS/health endpoint');
  }

  probeLock = false;
}

attachRetry('btnRetry', probe);
probe();