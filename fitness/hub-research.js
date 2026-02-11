// === /fitness/hub-research.js ===
// Research Launcher Form (Hub) — v20260211b
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(!DOC) return;

  const $ = (s)=>DOC.querySelector(s);

  const form = $('#hr-form');
  if(!form) return;

  const elPid   = $('#hr-pid');
  const elStudy = $('#hr-study');
  const elPhase = $('#hr-phase');
  const elCond  = $('#hr-cond');
  const elSeed  = $('#hr-seed');

  const btnGo   = $('#hr-go');
  const btnCopy = $('#hr-copy');
  const btnStats= $('#hr-stats');
  const msg     = $('#hr-msg');

  const STORE_KEY = 'HHA_FITNESS_RESEARCH_CTX_V1';

  function setMsg(t){ if(msg) msg.textContent = t || ''; }

  function load(){
    try{
      const o = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if(o && typeof o==='object'){
        if(elPid) elPid.value = o.pid || '';
        if(elStudy) elStudy.value = o.studyId || 'FIT01';
        if(elPhase) elPhase.value = o.phase || 'pre';
        if(elCond) elCond.value = o.conditionGroup || 'A';
        if(elSeed) elSeed.value = String(o.seed ?? '');
      }
    }catch(_){}
    // defaults if empty
    if(elStudy && !elStudy.value) elStudy.value = 'FIT01';
    if(elPhase && !elPhase.value) elPhase.value = 'pre';
    if(elCond && !elCond.value) elCond.value = 'A';
    if(elSeed && !elSeed.value) elSeed.value = String(Math.floor(Math.random()*90000 + 10000));
  }

  function read(){
    const pid = (elPid?.value || '').trim();
    const studyId = (elStudy?.value || 'FIT01').trim();
    const phase = (elPhase?.value || 'pre').trim();
    const conditionGroup = (elCond?.value || 'A').trim().toUpperCase();
    let seed = Number(elSeed?.value || 0);
    if(!Number.isFinite(seed) || seed <= 0) seed = Math.floor(Math.random()*90000 + 10000);

    return { pid, studyId, phase, conditionGroup, seed };
  }

  function save(ctx){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(ctx)); }catch(_){}
  }

  function makePlannerURL(ctx){
    // NOTE: hub uses relative path; planner is in /herohealth/fitness-planner/
    const params = new URLSearchParams();
    params.set('mode','research');
    params.set('seed', String(ctx.seed));
    if(ctx.pid) params.set('pid', ctx.pid);
    params.set('studyId', ctx.studyId);
    params.set('phase', ctx.phase);
    params.set('conditionGroup', ctx.conditionGroup);

    // send hub back (for your standard)
    params.set('hub','../fitness/hub.html');

    // optional: tell planner where stats is
    params.set('stats','../fitness/stats.html');

    return `../herohealth/fitness-planner/planner.html?${params.toString()}`;
  }

  btnGo?.addEventListener('click', ()=>{
    const ctx = read();
    if(!ctx.pid){
      setMsg('ใส่ PID ก่อนนะ (เช่น P001)');
      elPid?.focus?.();
      return;
    }
    save(ctx);
    const url = makePlannerURL(ctx);
    setMsg('กำลังไป Planner…');
    location.href = url;
  });

  btnCopy?.addEventListener('click', async ()=>{
    const ctx = read();
    save(ctx);
    const txt = JSON.stringify(ctx, null, 2);
    try{
      await navigator.clipboard.writeText(txt);
      setMsg('📋 คัดลอก Research ctx แล้ว');
    }catch(e){
      try{ WIN.prompt('Research ctx:', txt); }catch(_){}
      setMsg('เปิดกล่องให้คัดลอกแล้ว');
    }
  });

  btnStats?.addEventListener('click', ()=>{
    location.href = 'stats.html';
  });

  load();
})();