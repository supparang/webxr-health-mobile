// === /herohealth/hub.boot.js ===
// Hub controller: pass-through params, patch links, reset today, probe banner (403-safe)
// PATCH v20260216a (add brush/jumpduck/balancehold + germ detective coming soon)

'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

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
  if(API_ENDPOINT) sp.set('api', API_ENDPOINT);
  return u.toString();
}

// patch links (✅ updated ids)
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

// 403-safe probe (keep current behavior)
let probeLock = false;
async function probe(){
  if(probeLock) return;
  probeLock = true;
  setBanner({}, 'warn', 'กำลังตรวจสอบระบบ…', 'กำลัง ping API แบบสั้น ๆ (ถ้า 403 จะใช้โหมดออฟไลน์)');
  const r = await probeAPI(API_ENDPOINT, { ping:true }, 3200);
  if(r.status === 200){
    setBanner({}, 'ok', 'ออนไลน์ ✅', 'API ตอบกลับปกติ (Hub ใช้งานเต็มรูปแบบ)');
  }else if(r.status === 403){
    setBanner({}, 'bad', '403 Forbidden ⚠️', 'API ปฏิเสธสิทธิ์/Origin แต่ Hub ยังเข้าเกมได้ปกติ — แนะนำแก้ CORS/Authorizer');
  }else if(r.status){
    setBanner({}, 'warn', `API ตอบ ${r.status}`, 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจ route/headers');
  }else{
    setBanner({}, 'bad', 'ออฟไลน์/เชื่อมต่อไม่ได้', 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS');
  }
  probeLock = false;
}

attachRetry('btnRetry', probe);
probe();