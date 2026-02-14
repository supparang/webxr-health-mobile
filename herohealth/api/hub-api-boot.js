// === /herohealth/api/hub-api-boot.js ===
// Hub Boot (403-safe) — split from hub.html
// ✅ Pass-through params to game links
// ✅ Reset today
// ✅ Bind API banner + probe
'use strict';

import './api-status.js';
import { probe, bindHubBanner, getConfig } from './index.js';

function qs(k, d=''){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}
function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

// ====== params (pass-through) ======
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

// ====== show chips ======
const el = (id)=>document.getElementById(id);
if(el('cRun')) el('cRun').textContent = P.run;
if(el('cDiff')) el('cDiff').textContent = P.diff;
if(el('cTime')) el('cTime').textContent = String(P.time);
if(el('cPid')) el('cPid').textContent = P.pid;

// ====== build hub url (self) ======
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
  return u.toString();
}

// ====== patch game links ======
const linkIds = [
  'goGoodJunk','goGroups','goHydration','goPlate',
  'goHandwash','goMaskCough',
  'goPlanner','goShadow','goRhythm'
];
for(const id of linkIds){
  const a = el(id);
  if(!a) continue;
  a.href = withCommonParams(a.getAttribute('href'));
}

// ====== Reset today ======
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

// toast
let toastT = 0;
function toast(msg){
  let t = el('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.style.position='fixed';
    t.style.left='50%';
    t.style.bottom='calc(14px + env(safe-area-inset-bottom, 0px))';
    t.style.transform='translateX(-50%)';
    t.style.zIndex='9999';
    t.style.padding='10px 12px';
    t.style.border='1px solid rgba(148,163,184,.18)';
    t.style.borderRadius='14px';
    t.style.background='rgba(2,6,23,.78)';
    t.style.color='#e5e7eb';
    t.style.fontWeight='950';
    t.style.fontSize='13px';
    t.style.boxShadow='0 14px 44px rgba(0,0,0,.35)';
    t.style.opacity='0';
    t.style.transition='opacity .18s ease';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity='1';
  clearTimeout(toastT);
  toastT = setTimeout(()=>{ t.style.opacity='0'; }, 1200);
}

const btnResetToday = el('btnResetToday');
if(btnResetToday){
  btnResetToday.addEventListener('click', (e)=>{
    e.preventDefault();
    resetToday();
    toast('Reset today ✅ (ล้าง 3 โซน)');
  });
}

// ====== Bind banner + probe ======
const apiDot = el('apiDot');
const apiTitle = el('apiTitle');
const apiMsg = el('apiMsg');
const apiDetail = el('apiDetail'); // optional (ถ้ามี)
const btnRetry = el('btnRetry');

function doProbe(){
  // ถ้า endpoint จริงคือ /graphql ให้ใส่ path:'/graphql'
  return probe({}); 
}

// bind UI updates
bindHubBanner({
  dotEl: apiDot,
  titleEl: apiTitle,
  msgEl: apiMsg,
  detailEl: apiDetail,
  retryEl: btnRetry,
  onRetry: doProbe
});

// start probe
doProbe();

// small debug in console
try{
  const cfg = getConfig();
  console.log('[HeroHealth Hub] API endpoint =', cfg.endpoint);
}catch(_){}