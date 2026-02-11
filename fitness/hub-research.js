// === /fitness/hub-research.js ===
// Research Launcher Form (Hub) — v20260211d
// PACK 1-6:
// 1) Auto PID increment
// 2) Seed tools
// 3) One-click next phase
// 4) PID validation + error UI
// 5) Reset all
// 6) Research Banner (live ctx display)

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
  const cbLockSeed = $('#hr-lock-seed');

  const btnGo   = $('#hr-go');
  const btnGoNext = $('#hr-go-next');
  const btnIncPid  = $('#hr-incpid');
  const btnSeedRnd = $('#hr-seed-rnd');
  const btnSeedNew = $('#hr-seed-new');
  const btnCopy = $('#hr-copy');
  const btnStats= $('#hr-stats');
  const btnReset= $('#hr-reset');
  const msg     = $('#hr-msg');

  const banner  = $('#hr-banner');

  const STORE_KEY = 'HHA_FITNESS_RESEARCH_CTX_V3';

  function setMsg(t){ if(msg) msg.textContent = t || ''; }

  function pad3(n){ return String(n).padStart(3,'0'); }

  function parsePid(pid){
    const s = String(pid||'').trim();
    const m = s.match(/^([Pp])(\d{1,6})$/);
    if(!m) return null;
    return { prefix:'P', num:Number(m[2]||0) };
  }

  function formatPid(prefix, num){
    if(num <= 999) return `${prefix}${pad3(num)}`;
    return `${prefix}${num}`;
  }

  function randSeed(){
    return Math.floor(Math.random()*90000 + 10000);
  }

  function validatePid(showMsg=true){
    const raw = (elPid?.value || '').trim();
    const parsed = parsePid(raw);
    if(!parsed){
      elPid?.classList.add('hr-err');
      if(showMsg) setMsg('PID ต้องเป็นรูปแบบ P001, P002 ...');
      return false;
    }
    elPid?.classList.remove('hr-err');
    return true;
  }

  function load(){
    try{
      const o = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if(o && typeof o==='object'){
        if(elPid) elPid.value = o.pid || '';
        if(elStudy) elStudy.value = o.studyId || 'FIT01';
        if(elPhase) elPhase.value = o.phase || 'pre';
        if(elCond) elCond.value = o.conditionGroup || 'A';
        if(elSeed) elSeed.value = String(o.seed ?? '');
        if(cbLockSeed) cbLockSeed.checked = !!o.lockSeed;
      }
    }catch(_){}

    if(elStudy && !elStudy.value) elStudy.value = 'FIT01';
    if(elPhase && !elPhase.value) elPhase.value = 'pre';
    if(elCond && !elCond.value) elCond.value = 'A';
    if(elSeed && !elSeed.value) elSeed.value = String(randSeed());
    if(elPid && !elPid.value) elPid.value = 'P001';

    updateBanner();
  }

  function read(){
    const pid = (elPid?.value || '').trim();
    const studyId = (elStudy?.value || 'FIT01').trim();
    const phase = (elPhase?.value || 'pre').trim();
    const conditionGroup = (elCond?.value || 'A').trim().toUpperCase();
    let seed = Number(elSeed?.value || 0);
    if(!Number.isFinite(seed) || seed <= 0) seed = randSeed();
    const lockSeed = !!cbLockSeed?.checked;
    return { pid, studyId, phase, conditionGroup, seed, lockSeed };
  }

  function save(ctx){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(ctx)); }catch(_){}
    updateBanner();
  }

  function setSeed(seed){
    if(elSeed) elSeed.value = String(seed >>> 0);
  }

  function nextPid(){
    const parsed = parsePid(elPid?.value || '');
    if(!parsed){
      setMsg('แก้ PID ให้ถูกก่อน');
      return;
    }
    const nxt = parsed.num + 1;
    const pid = formatPid(parsed.prefix, nxt);
    elPid.value = pid;
    setMsg(`PID ถัดไป: ${pid}`);
    save(read());
  }

  function nextPhaseValue(phase){
    const p = String(phase||'').toLowerCase();
    if(p === 'pre') return 'post';
    return 'post';
  }

  function makePlannerURL(ctx){
    const params = new URLSearchParams();
    params.set('mode','research');
    params.set('seed', String(ctx.seed >>> 0));
    params.set('pid', ctx.pid);
    params.set('studyId', ctx.studyId);
    params.set('phase', ctx.phase);
    params.set('conditionGroup', ctx.conditionGroup);
    params.set('hub','../fitness/hub.html');
    params.set('stats','../fitness/stats.html');
    params.set('from','planner');
    return `../herohealth/fitness-planner/planner.html?${params.toString()}`;
  }

  function go(nextPhase=false){
    if(!validatePid()) return;
    const ctx = read();

    if(!ctx.lockSeed){
      ctx.seed = randSeed();
      setSeed(ctx.seed);
    }

    if(nextPhase){
      ctx.phase = nextPhaseValue(ctx.phase);
      if(elPhase) elPhase.value = ctx.phase;
    }

    save(ctx);
    const url = makePlannerURL(ctx);
    location.href = url;
  }

  function resetAll(){
    localStorage.removeItem(STORE_KEY);
    if(elPid) elPid.value = 'P001';
    if(elStudy) elStudy.value = 'FIT01';
    if(elPhase) elPhase.value = 'pre';
    if(elCond) elCond.value = 'A';
    if(elSeed) elSeed.value = String(randSeed());
    if(cbLockSeed) cbLockSeed.checked = false;
    elPid?.classList.remove('hr-err');
    setMsg('รีเซ็ตค่าแล้ว');
    updateBanner();
  }

  function updateBanner(){
    if(!banner) return;
    const ctx = read();
    banner.textContent =
      `RESEARCH MODE | PID: ${ctx.pid || '-'} | Study: ${ctx.studyId} | Phase: ${ctx.phase} | Group: ${ctx.conditionGroup} | Seed: ${ctx.seed}`;
  }

  // listeners
  elPid?.addEventListener('blur', ()=>validatePid(false));
  btnGo?.addEventListener('click', ()=>go(false));
  btnGoNext?.addEventListener('click', ()=>go(true));
  btnIncPid?.addEventListener('click', nextPid);
  btnSeedRnd?.addEventListener('click', ()=>{
    const s = randSeed();
    setSeed(s);
    setMsg(`สุ่ม seed: ${s}`);
    save(read());
  });
  btnSeedNew?.addEventListener('click', ()=>{
    const s = randSeed();
    setSeed(s);
    setMsg(`seed ใหม่: ${s}`);
    save(read());
  });
  cbLockSeed?.addEventListener('change', ()=>{
    save(read());
    setMsg(cbLockSeed.checked ? 'ล็อก seed แล้ว' : 'ปลดล็อก seed แล้ว');
  });
  btnCopy?.addEventListener('click', async ()=>{
    const ctx = read();
    save(ctx);
    const txt = JSON.stringify(ctx, null, 2);
    try{
      await navigator.clipboard.writeText(txt);
      setMsg('คัดลอก ctx แล้ว');
    }catch(e){
      alert(txt);
    }
  });
  btnStats?.addEventListener('click', ()=>location.href='stats.html');
  btnReset?.addEventListener('click', resetAll);

  load();
})();