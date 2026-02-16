// === /herohealth/hub.boot.js ===
// Hub controller: pass-through params, patch links, reset today, probe banner (401/403-safe)
// PACK v20260216c (ALL-IN)
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

const $ = (id)=>document.getElementById(id);

// chips
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

// patch links (ALL)
const linkIds = [
  // zones
  'goGoodJunk','goGroups','goHydration','goPlate',
  'goHandwash','goBrush','goMaskCough',
  'goPlanner','goShadow','goRhythm','goJumpDuck','goBalanceHold',
  // hub utilities
  'goBadges','goCheckin'
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

// ===== Done today pills =====
function getLocalDayKey(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function zoneDoneKey(zone){ return `HHA_ZONE_DONE::${zone}::${getLocalDayKey()}`; }

function readZoneDone(zone){
  try{
    const raw = localStorage.getItem(zoneDoneKey(zone));
    if(!raw) return null;
    if(raw === '1' || raw === 'true' || raw === 'done') return { ok:true, raw };
    try{ return { ok:true, raw, json: JSON.parse(raw) }; }catch{ return { ok:true, raw }; }
  }catch(_){
    return null;
  }
}

function setPill(id, done){
  const el = $(id);
  if(!el) return;
  el.classList.remove('ok','warn','bad');
  if(done){
    el.classList.add('ok');
    el.textContent = 'Today: Done ✅';
  }else{
    el.classList.add('warn');
    el.textContent = 'Today: Not yet';
  }
}

function refreshZonePills(){
  setPill('zNutrition', !!readZoneDone('nutrition'));
  setPill('zHygiene',  !!readZoneDone('hygiene'));
  setPill('zFitness',  !!readZoneDone('fitness'));
}

// ===== Last summary (HHA_LAST_SUMMARY) =====
function safeJson(raw){ try{ return JSON.parse(raw); }catch{ return null; } }
function prettyTime(ts){
  try{
    const d = new Date(Number(ts)||Date.now());
    if(!Number.isFinite(d.getTime())) return '';
    return d.toLocaleString();
  }catch{ return ''; }
}
function showLastSummary(){
  const box = $('lastSummary');
  const t = $('lsTitle');
  const b = $('lsBody');
  if(!box || !t || !b) return;

  let raw = null;
  try{ raw = localStorage.getItem('HHA_LAST_SUMMARY'); }catch(_){}
  if(!raw){ box.style.display = 'none'; return; }

  const j = safeJson(raw) || {};
  const game = String(j.game || j.mode || j.name || 'เกมล่าสุด');
  const score = (j.score!=null) ? `score ${j.score}` : '';
  const acc = (j.acc!=null) ? `acc ${j.acc}` : (j.accuracy!=null ? `acc ${j.accuracy}` : '');
  const miss = (j.miss!=null) ? `miss ${j.miss}` : '';
  const dur = (j.time!=null) ? `${j.time}s` : (j.duration!=null ? `${j.duration}s` : '');
  const when = prettyTime(j.ts || j.endedAt || j.timeEnd || j.date || 0);

  t.textContent = `สรุปล่าสุด: ${game}`;
  const parts = [score, acc, miss, dur].filter(Boolean).join(' • ');
  b.textContent = (parts ? `${parts}${when ? ' • ' : ''}` : '') + (when || '');

  box.style.display = 'block';
}

const btnClearSummary = $('btnClearSummary');
if(btnClearSummary){
  btnClearSummary.addEventListener('click', (e)=>{
    e.preventDefault();
    try{ localStorage.removeItem('HHA_LAST_SUMMARY'); }catch(_){}
    toast('Clear summary ✅');
    showLastSummary();
  });
}

// reset today
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
    refreshZonePills();
    toast('Reset today ✅ (ล้าง 3 โซน)');
  });
}

// ===== 401/403-safe API probe =====
let probeLock = false;
async function probe(){
  if(probeLock) return;
  probeLock = true;

  setBanner({}, 'warn', 'กำลังตรวจสอบระบบ…', 'กำลัง ping API แบบสั้น ๆ (ถ้า 401/403 จะใช้โหมดออฟไลน์)');
  const r = await probeAPI(API_ENDPOINT, { ping:true }, 3200);

  if(r.status === 200){
    setBanner({}, 'ok', 'ออนไลน์ ✅', 'API ตอบกลับปกติ (Hub ใช้งานเต็มรูปแบบ)');
  }else if(r.status === 401){
    setBanner({}, 'bad', '401 Unauthorized ⚠️', 'API ต้องมีสิทธิ์/Token • Hub ยังเข้าเกมได้ปกติ — logging ถูกปิด');
  }else if(r.status === 403){
    setBanner({}, 'bad', '403 Forbidden ⚠️', 'API ปฏิเสธสิทธิ์/Origin • Hub ยังเข้าเกมได้ปกติ — แนะนำแก้ CORS/Authorizer');
  }else if(r.status){
    setBanner({}, 'warn', `API ตอบ ${r.status}`, 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจ route/headers');
  }else{
    setBanner({}, 'bad', 'ออฟไลน์/เชื่อมต่อไม่ได้', 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS');
  }

  probeLock = false;
}

attachRetry('btnRetry', probe);
probe();

// init UI
refreshZonePills();
showLastSummary();