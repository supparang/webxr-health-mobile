// === /fitness/hub-research.js ===
// Research Launcher Form (Hub) — v20260211c
// PACK 1-3:
// 1) Auto PID increment (P001 -> P002)
// 2) Seed tools (random / lock / regenerate)
// 3) One-click next phase (pre->post) + quick start buttons

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
  const btnGoNext = $('#hr-go-next');     // start next phase quickly
  const btnIncPid  = $('#hr-incpid');     // manual next pid
  const btnSeedRnd = $('#hr-seed-rnd');   // random seed
  const btnSeedNew = $('#hr-seed-new');   // regenerate seed
  const btnCopy = $('#hr-copy');
  const btnStats= $('#hr-stats');
  const msg     = $('#hr-msg');

  const STORE_KEY = 'HHA_FITNESS_RESEARCH_CTX_V2';

  function setMsg(t){ if(msg) msg.textContent = t || ''; }

  function pad3(n){ return String(n).padStart(3,'0'); }

  function parsePid(pid){
    // Accept P001 / p001 / 001 / P-001
    const s = String(pid||'').trim();
    const m = s.match(/([A-Za-z]*)(\d+)/);
    if(!m) return { prefix:'P', num:0, raw:s };
    const prefix = (m[1] || 'P').toUpperCase();
    const num = Number(m[2] || 0) || 0;
    return { prefix, num, raw:s };
  }

  function formatPid(prefix, num){
    // default 3 digits for <=999 else plain
    if(num <= 999) return `${prefix}${pad3(num)}`;
    return `${prefix}${num}`;
  }

  function randSeed(){
    return Math.floor(Math.random()*90000 + 10000); // 10000-99999
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

    // defaults
    if(elStudy && !elStudy.value) elStudy.value = 'FIT01';
    if(elPhase && !elPhase.value) elPhase.value = 'pre';
    if(elCond && !elCond.value) elCond.value = 'A';
    if(elSeed && !elSeed.value) elSeed.value = String(randSeed());
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
  }

  function setSeed(seed){
    if(elSeed) elSeed.value = String(seed >>> 0);
  }

  function nextPid(){
    const cur = parsePid(elPid?.value || '');
    const base = Math.max(0, cur.num || 0);
    const nxt = base + 1;
    const pid = formatPid(cur.prefix || 'P', nxt);
    if(elPid) elPid.value = pid;
    setMsg(`PID ถัดไป: ${pid}`);
    return pid;
  }

  function nextPhaseValue(phase){
    const p = String(phase||'').toLowerCase();
    if(p === 'pre') return 'post';
    if(p === 'post') return 'post'; // stay
    if(p === 'mid') return 'post';
    return 'post';
  }

  function makePlannerURL(ctx){
    const params = new URLSearchParams();
    params.set('mode','research');
    params.set('seed', String(ctx.seed >>> 0));
    if(ctx.pid) params.set('pid', ctx.pid);
    params.set('studyId', ctx.studyId);
    params.set('phase', ctx.phase);
    params.set('conditionGroup', ctx.conditionGroup);

    params.set('hub','../fitness/hub.html');
    params.set('stats','../fitness/stats.html');

    // tell games it comes from planner
    params.set('from','planner');

    return `../herohealth/fitness-planner/planner.html?${params.toString()}`;
  }

  function go(startMode){
    const ctx = read();
    if(!ctx.pid){
      setMsg('ใส่ PID ก่อนนะ (เช่น P001)');
      elPid?.focus?.();
      return;
    }

    // seed behavior
    // - if lockSeed unchecked, refresh seed every "start"
    if(!ctx.lockSeed){
      ctx.seed = randSeed();
      setSeed(ctx.seed);
    }

    // phase switching: if startMode = 'nextphase' force pre->post
    if(startMode === 'nextphase'){
      ctx.phase = nextPhaseValue(ctx.phase);
      if(elPhase) elPhase.value = ctx.phase;
    }

    save(ctx);

    const url = makePlannerURL(ctx);
    setMsg('กำลังไป Planner…');
    location.href = url;
  }

  // buttons
  btnGo?.addEventListener('click', ()=>go('normal'));

  btnGoNext?.addEventListener('click', ()=>go('nextphase'));

  btnIncPid?.addEventListener('click', ()=>{
    nextPid();
    save(read());
  });

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
    const ctx = read();
    save(ctx);
    setMsg(ctx.lockSeed ? 'ล็อก seed แล้ว (seed คงที่)' : 'ปลดล็อก seed (เริ่มครั้งหน้า seed จะเปลี่ยน)');
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

  // smart defaults: if pid empty -> set P001
  load();
  if(elPid && !String(elPid.value||'').trim()){
    elPid.value = 'P001';
  }

  // show short hint
  setMsg('พร้อมเริ่ม: กด “เริ่มวิจัย → ไป Planner”');
})();