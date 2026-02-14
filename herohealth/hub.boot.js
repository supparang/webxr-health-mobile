// === /herohealth/hub.boot.js ===
// HeroHealth HUB boot — 403-safe pack
// - patch pass-through params to all links
// - bind reset today + toast
// - init API probe/banner via /herohealth/api/index.js (degrade gracefully)

'use strict';

import { HHA_API } from './api/index.js';

(function(){
  // mark booted (so hub.html fallback won't run)
  try{ window.HHA_HUB_BOOTED = true; }catch(_){}

  // ===== helpers =====
  function qs(k, d=''){
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  }
  function clamp(v,min,max){
    v = Number(v);
    if(!Number.isFinite(v)) v = min;
    return Math.max(min, Math.min(max, v));
  }
  function nowSeed(){ return String(Date.now()); }

  // ===== params (pass-through) =====
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

  // show chips
  try{
    document.getElementById('cRun').textContent  = P.run;
    document.getElementById('cDiff').textContent = P.diff;
    document.getElementById('cTime').textContent = String(P.time);
    document.getElementById('cPid').textContent  = P.pid;
  }catch(_){}

  // ===== toast =====
  let toastT = 0;
  function toast(msg){
    let el = document.getElementById('toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.style.position='fixed';
      el.style.left='50%';
      el.style.bottom='calc(14px + var(--sab, 0px))';
      el.style.transform='translateX(-50%)';
      el.style.zIndex='9999';
      el.style.padding='10px 12px';
      el.style.border='1px solid rgba(148,163,184,.18)';
      el.style.borderRadius='14px';
      el.style.background='rgba(2,6,23,.78)';
      el.style.color='#e5e7eb';
      el.style.fontWeight='950';
      el.style.fontSize='13px';
      el.style.boxShadow='0 14px 44px rgba(0,0,0,.35)';
      el.style.opacity='0';
      el.style.transition='opacity .18s ease';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity='1';
    clearTimeout(toastT);
    toastT = setTimeout(()=>{ el.style.opacity='0'; }, 1200);
  }

  // ===== build hub url (self) =====
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

    // always include hub back-link
    sp.set('hub', buildHubUrl());

    // common params
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

  // patch all game links to include pass-through params
  const linkIds = [
    'goGoodJunk','goGroups','goHydration','goPlate',
    'goHandwash','goMaskCough',
    'goPlanner','goShadow','goRhythm'
  ];
  for(const id of linkIds){
    const a = document.getElementById(id);
    if(!a) continue;
    try{ a.href = withCommonParams(a.getAttribute('href')); }catch(_){}
  }

  // ===== Reset today (3 zones) =====
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

  const btnResetToday = document.getElementById('btnResetToday');
  if(btnResetToday){
    btnResetToday.addEventListener('click', (e)=>{
      e.preventDefault();
      resetToday();
      toast('Reset today ✅ (ล้าง 3 โซน)');
    });
  }

  // ===== API init (403-safe) =====
  const btnRetry = document.getElementById('btnRetry');

  // NOTE: endpoint default — เปลี่ยนทีหลังได้จาก query ?api=...
  const endpointFromQS = String(qs('api','')).trim();
  const API_ENDPOINT = endpointFromQS || 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/';

  // init banner + probe
  const api = HHA_API.initHub({
    endpoint: API_ENDPOINT,
    banner: {
      dotId: 'apiDot',
      titleId: 'apiTitle',
      msgId: 'apiMsg'
    }
  });

  // wire retry
  if(btnRetry){
    btnRetry.addEventListener('click', (e)=>{
      e.preventDefault();
      api.probe();
    });
  }
})();