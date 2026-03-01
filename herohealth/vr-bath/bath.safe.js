// === /herohealth/vr-bath/bath.safe.js ===
// BathVR SAFE — PRODUCTION (HHA Standard-lite)
// FULL v20260301-BATH-RUN-HHA
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const $ = (id)=> DOC.getElementById(id);

  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const clamp01=(x)=>clamp(x,0,1);
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  function qs(k, d=''){
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  }

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------- context ----------------
  const hub = (qs('hub','../hub.html')||'../hub.html').trim();
  const pid = (qs('pid','anon')||'anon').trim() || 'anon';
  const run = (qs('run', qs('mode','play'))||'play').trim().toLowerCase(); // play|study|research
  const diff = (qs('diff','normal')||'normal').trim().toLowerCase();
  const timeLimit = Math.max(20, parseInt(qs('time','70'),10) || 70);
  const seedParam = (qs('seed', pid)||pid).trim();
  const view = (qs('view','')||'').trim().toLowerCase() || (
    (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches) ? 'mobile' : 'pc'
  );

  const logEndpoint = (qs('log','')||'').trim();
  const studyId = (qs('studyId','')||'').trim();
  const phase = (qs('phase','')||'').trim();
  const conditionGroup = (qs('conditionGroup','')||'').trim();

  const seed = ((Number(seedParam)||Date.now())>>>0);
  const rng = seededRng(seed);

  const wrap = $('wrap');
  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = run;
  }

  // ---------------- UI refs ----------------
  const layer = $('layer');

  const tScore=$('tScore'), tClean=$('tClean'), tMistake=$('tMistake'), tCombo=$('tCombo'), tTime=$('tTime');
  const tMeter=$('tMeter'), bMeter=$('bMeter');
  const tRisk=$('tRisk'), bRisk=$('bRisk');

  const endEl=$('end');
  const tReason=$('tReason');
  const sScore=$('sScore'), sClean=$('sClean'), sMistake=$('sMistake'), sMaxCombo=$('sMaxCombo'), sAcc=$('sAcc'), sRiskAvg=$('sRiskAvg');
  const endNote=$('endNote');

  const btnStart=$('btnStart'), btnRetry=$('btnRetry'), btnPause=$('btnPause'), btnBack=$('btnBack'), btnEndRetry=$('btnEndRetry'), btnEndBack=$('btnEndBack');

  // back link
  function applyHubLink(a){
    if(!a) return;
    try{
      const u = new URL(hub, location.href);
      u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      a.href = u.toString();
    }catch(_){
      a.href = hub || '../hub.html';
    }
  }
  applyHubLink(btnEndBack);

  // ---------------- toast ----------------
  const toastEl = $('toast');
  function toast(msg){
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> toastEl.classList.remove('show'), 1100);
  }

  // ---------------- logger (NDJSON, flush-hardened) ----------------
  function createLogger(ctx){
    const q = [];
    let seq = 0;
    const sessionId = 'bath_' + (Date.now().toString(36)) + '_' + Math.random().toString(36).slice(2,8);

    function base(type){
      return {
        v: 1,
        game: 'bath',
        type,
        sessionId,
        seq: ++seq,
        ts: Date.now(),
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        runMode: ctx.runMode || '',
        diff: ctx.diff || '',
        view: ctx.view || '',
        seed: ctx.seed || 0,
        timePlannedSec: ctx.timePlannedSec || 0,
        href: location.href.split('#')[0]
      };
    }

    function push(type, data){
      q.push({ ...base(type), ...(data||{}) });
      if(q.length > 1400) q.splice(0, q.length - 1000);
    }

    async function flush(reason){
      if(!ctx.log || !q.length) return;
      const payload = q.splice(0, q.length);
      const body = payload.map(x=>JSON.stringify(x)).join('\n');

      try{
        if(reason === 'unload' && navigator.sendBeacon){
          navigator.sendBeacon(ctx.log, new Blob([body], {type:'text/plain'}));
          return;
        }
        await fetch(ctx.log, {
          method:'POST',
          headers:{'content-type':'text/plain'},
          body,
          keepalive:true
        });
      }catch(_){}
    }

    return { sessionId, push, flush };
  }

  const logger = createLogger({
    pid, studyId, phase, conditionGroup,
    runMode: run, diff, view, seed, timePlannedSec: timeLimit,
    log: logEndpoint
  });

  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') logger.flush('unload');
  });
  WIN.addEventListener('beforeunload', ()=> logger.flush('unload'));

  // ---------------- game state ----------------
  const st = {
    running:false, paused:false, over:false,
    t0:0, elapsed:0,

    score:0,
    clean:0,
    mistake:0,
    combo:0,
    maxCombo:0,

    cleanMeter:0,      // 0..100
    germRisk:0,        // 0..100
    riskSum:0, riskN:0,

    // counts
    spawnedGood:0,
    spawnedBad:0,
    hitGood:0,
    hitBad:0,
    missGood:0,

    // timing
    spawnMs: (diff==='hard' ? 620 : diff==='easy' ? 820 : 720),
    ttlMs:   (diff==='hard' ? 1300 : diff==='easy' ? 1750 : 1500),

    targets: new Map(),
    uid:0
  };

  function layerRect(){
    return layer.getBoundingClientRect();
  }

  function setHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tClean) tClean.textContent = String(st.clean);
    if(tMistake) tMistake.textContent = String(st.mistake);
    if(tCombo) tCombo.textContent = String(st.combo);
    if(tTime) tTime.textContent = String(Math.max(0, Math.ceil(timeLimit - st.elapsed)));

    if(tMeter) tMeter.textContent = `${Math.round(st.cleanMeter)}%`;
    if(bMeter) bMeter.style.width = `${clamp(st.cleanMeter,0,100)}%`;

    if(tRisk) tRisk.textContent = `${Math.round(st.germRisk)}%`;
    if(bRisk) bRisk.style.width = `${clamp(st.germRisk,0,100)}%`;
  }

  function makeTarget(kind, x, y, ttl){
    const id = String(++st.uid);
    const el = DOC.createElement('div');

    const big = (kind==='good' && rng()<0.18);
    const small = (kind==='bad' && rng()<0.24);

    el.className = 'dirt ' + (kind==='good' ? 'good' : 'bad') + (big ? ' big' : small ? ' small' : '');
    el.textContent = (kind==='good') ? '🟤' : '🦠';
    el.style.left = x+'px';
    el.style.top = y+'px';
    el.dataset.id = id;
    el.dataset.kind = kind;

    const born = nowMs();
    const die = born + ttl;

    st.targets.set(id, { id, el, kind, born, die, x, y });

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(id);
    }, {passive:false});

    layer.appendChild(el);
    return id;
  }

  function removeTarget(id, popped){
    const it = st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);
    const el = it.el;
    if(!el) return;
    if(popped) el.classList.add('pop');
    setTimeout(()=>{ try{el.remove();}catch(_){ } }, 160);
  }

  function spawn(){
    if(!st.running || st.paused || st.over) return;

    const r = layerRect();
    const pad = 58;
    const x = pad + rng() * Math.max(10, r.width - pad*2);
    const y = pad + rng() * Math.max(10, r.height - pad*2);

    // bias by state (more germs if risk high; more dirt if meter low)
    let wGood = 0.72;
    let wBad  = 0.28;

    wBad += clamp01(st.germRisk/100) * 0.18;
    wGood += clamp01((100-st.cleanMeter)/100) * 0.10;

    const sum = wGood + wBad;
    wGood /= sum; wBad /= sum;

    const kind = (rng() < wGood) ? 'good' : 'bad';

    const ttl = Math.round(st.ttlMs * (diff==='hard' ? 0.92 : diff==='easy' ? 1.08 : 1.0));
    makeTarget(kind, x, y, ttl);

    if(kind==='good') st.spawnedGood++;
    else st.spawnedBad++;

    logger.push('spawn', { kind, x:Math.round(x), y:Math.round(y), ttlMs: ttl });
  }

  function hit(id){
    if(!st.running || st.paused || st.over) return;
    const it = st.targets.get(id);
    if(!it) return;

    removeTarget(id, true);

    if(it.kind === 'good'){
      st.hitGood++;
      st.clean++;
      st.combo++;
      st.maxCombo = Math.max(st.maxCombo, st.combo);

      // points
      st.score += 1;
      if(st.combo >= 6) st.score += 1;

      // meter changes
      st.cleanMeter = clamp(st.cleanMeter + (st.combo>=6 ? 2.2 : 1.6), 0, 100);
      st.germRisk = clamp(st.germRisk - 1.8, 0, 100);

      toast(st.combo>=6 ? '✨ CLEAN COMBO!' : '✅ ดีมาก!');
      logger.push('judge', { judge:'hit', kind:'good', combo: st.combo, score: st.score });

    }else{
      st.hitBad++;
      st.mistake++;
      st.combo = 0;

      st.score = Math.max(0, st.score - 2);
      st.germRisk = clamp(st.germRisk + 6.5, 0, 100);
      st.cleanMeter = clamp(st.cleanMeter - 3.2, 0, 100);

      toast('🦠 โดนเชื้อ!');
      logger.push('judge', { judge:'bad_hit', kind:'bad', score: st.score });
    }

    setHud();

    // lose condition (optional): risk too high
    if(st.germRisk >= 100){
      endGame('risk');
    }
  }

  function timeoutTarget(id){
    const it = st.targets.get(id);
    if(!it) return;

    removeTarget(id, false);

    if(it.kind === 'good'){
      st.missGood++;
      st.mistake++;
      st.combo = 0;

      st.score = Math.max(0, st.score - 1);
      st.germRisk = clamp(st.germRisk + 3.5, 0, 100);
      st.cleanMeter = clamp(st.cleanMeter - 1.6, 0, 100);

      logger.push('judge', { judge:'timeout', kind:'good', score: st.score });
    }else{
      // good avoid: germs expired without touching
      st.germRisk = clamp(st.germRisk - 0.8, 0, 100);
      logger.push('judge', { judge:'avoid', kind:'bad', score: st.score });
    }

    setHud();

    if(st.germRisk >= 100){
      endGame('risk');
    }
  }

  // timers
  let spawnTimer = 0;
  let tickTimer = 0;

  function scheduleSpawn(){
    clearTimeout(spawnTimer);
    if(!st.running || st.paused || st.over) return;

    // mild adaptive spawn (play only)
    let every = st.spawnMs;
    if(run === 'play'){
      const pressure = clamp01(st.germRisk/100);
      every = clamp(every - pressure*120, 260, 1200);
    }
    spawnTimer = setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!st.running || st.paused || st.over) return;

    const t = nowMs();
    st.elapsed = (t - st.t0)/1000;

    // expire targets
    for(const [id, it] of st.targets){
      if(t >= it.die) timeoutTarget(id);
    }

    // risk avg for summary
    st.riskSum += st.germRisk;
    st.riskN += 1;

    // heartbeat (1s)
    if(((t - st.t0) % 1000) < 90){
      logger.push('time', {
        t: +st.elapsed.toFixed(2),
        score: st.score,
        clean: st.clean,
        mistake: st.mistake,
        combo: st.combo,
        cleanMeter: +st.cleanMeter.toFixed(1),
        germRisk: +st.germRisk.toFixed(1)
      });
    }

    setHud();

    if(st.elapsed >= timeLimit){
      endGame('time');
    }
  }

  // localStorage summary standard-ish
  const LS_LAST='HHA_LAST_SUMMARY';
  const LS_HIST='HHA_SUMMARY_HISTORY';

  function saveSummary(sum){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(sum));
      const arr = JSON.parse(localStorage.getItem(LS_HIST)||'[]');
      arr.push(sum);
      while(arr.length>60) arr.shift();
      localStorage.setItem(LS_HIST, JSON.stringify(arr));
    }catch(_){}
  }

  function renderEnd(reason){
    if(tReason) tReason.textContent = reason;

    const acc = (st.hitGood + st.hitBad) ? (st.hitGood / (st.hitGood + st.hitBad)) : 0;
    const riskAvg = st.riskN ? (st.riskSum / st.riskN) : st.germRisk;

    if(sScore) sScore.textContent = String(st.score);
    if(sClean) sClean.textContent = String(st.clean);
    if(sMistake) sMistake.textContent = String(st.mistake);
    if(sMaxCombo) sMaxCombo.textContent = String(st.maxCombo);
    if(sAcc) sAcc.textContent = `${Math.round(acc*100)}%`;
    if(sRiskAvg) sRiskAvg.textContent = `${Math.round(riskAvg)}%`;

    if(endNote){
      endNote.textContent =
`pid=${pid} | run=${run} | diff=${diff} | view=${view} | time=${timeLimit}s | seed=${seed}
log=${logEndpoint||'—'} | studyId=${studyId||'—'} | phase=${phase||'—'} | conditionGroup=${conditionGroup||'—'}`;
    }

    applyHubLink(btnEndBack);
    if(endEl) endEl.hidden = false;
  }

  async function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;
    st.paused = false;

    clearTimeout(spawnTimer);
    clearInterval(tickTimer);

    // clear targets
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    const acc = (st.hitGood + st.hitBad) ? (st.hitGood / (st.hitGood + st.hitBad)) : 0;
    const riskAvg = st.riskN ? (st.riskSum / st.riskN) : st.germRisk;

    const sum = {
      game: 'bath',
      ts: Date.now(),
      pid, studyId, phase, conditionGroup,
      hub, runMode: run, diff, view, seed,
      timePlannedSec: timeLimit,
      timePlayedSec: Math.round(st.elapsed*10)/10,
      score: st.score,
      cleaned: st.clean,
      mistakes: st.mistake,
      comboMax: st.maxCombo,
      accuracyPct: Math.round(acc*100),
      riskAvgPct: Math.round(riskAvg),
      spawnedGood: st.spawnedGood,
      spawnedBad: st.spawnedBad,
      hitGood: st.hitGood,
      hitBad: st.hitBad,
      missGood: st.missGood,
      reason
    };

    saveSummary(sum);
    logger.push('end', sum);
    await logger.flush('end');

    toast(reason==='time' ? 'ครบเวลา!' : 'จบเกม!');
    renderEnd(reason);
  }

  function startGame(){
    // hard-hide end
    if(endEl) endEl.hidden = true;

    st.running = true;
    st.paused = false;
    st.over = false;

    st.t0 = nowMs();
    st.elapsed = 0;

    st.score=0; st.clean=0; st.mistake=0; st.combo=0; st.maxCombo=0;
    st.cleanMeter = 0;
    st.germRisk = 15;
    st.riskSum = 0; st.riskN = 0;

    st.spawnedGood=0; st.spawnedBad=0; st.hitGood=0; st.hitBad=0; st.missGood=0;

    // clear targets
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    setHud();
    toast('เริ่ม! ทำความสะอาดให้ทัน');
    logger.push('start', { seed, diff, runMode: run, view, timePlannedSec: timeLimit });

    scheduleSpawn();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 80);
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if(st.paused){
      toast('⏸ Pause');
      logger.push('pause', { on:true });
    }else{
      toast('▶ Resume');
      logger.push('pause', { on:false });
      scheduleSpawn();
    }
  }

  // buttons
  if(btnStart) btnStart.addEventListener('click', startGame, {passive:true});
  if(btnRetry) btnRetry.addEventListener('click', startGame, {passive:true});
  if(btnEndRetry) btnEndRetry.addEventListener('click', startGame, {passive:true});
  if(btnPause) btnPause.addEventListener('click', togglePause, {passive:true});

  if(btnBack) btnBack.addEventListener('click', ()=>{
    try{
      const u = new URL(hub||'../hub.html', location.href);
      u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      location.href = u.toString();
    }catch(_){
      location.href = hub || '../hub.html';
    }
  }, {passive:true});

  // init
  if(endEl) endEl.hidden = true;
  setHud();
  toast('พร้อมแล้ว! กด “เริ่มเกม”');
})();