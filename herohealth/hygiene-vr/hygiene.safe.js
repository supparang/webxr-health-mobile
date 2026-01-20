/* === /herohealth/hygiene-vr/hygiene.safe.js ===
Handwash Survival — PRODUCTION-ish (Offline logging)
✅ A-Frame/WebXR compatible + vr-ui.js (hha:shoot)
✅ Survival 70s (configurable)
✅ Waves + Trap + Boss (simple but fun)
✅ Rank + End summary
✅ Logs queued in localStorage + Export CSV (sessions/events)
*/

export function boot(cfg){
  const DOC = document;
  const play = DOC.getElementById('play');
  const overlay = DOC.getElementById('overlay');
  const hpEl = DOC.getElementById('hp');
  const riskBar = DOC.getElementById('riskBar');
  const timeEl = DOC.getElementById('time');
  const scoreEl = DOC.getElementById('score');
  const goalPill = DOC.getElementById('goalPill');
  const miniPill = DOC.getElementById('miniPill');
  const hintEl = DOC.getElementById('hint');
  const subTitle = DOC.getElementById('subTitle');

  const btnStart = DOC.getElementById('btnStart');
  const btnPractice = DOC.getElementById('btnPractice');
  const btnBack = DOC.getElementById('btnBack');
  const btnExport = DOC.getElementById('btnExport');
  const btnRestart = DOC.getElementById('btnRestart');
  const ovTitle = DOC.getElementById('ovTitle');
  const ovDesc = DOC.getElementById('ovDesc');
  const ovMeta = DOC.getElementById('ovMeta');

  // ---------- helpers ----------
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const now=()=>Date.now();

  function mulberry32(a){
    let t = a >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; }
  }

  function goHub(){
    const hub = cfg.hub || '../hub.html';
    location.href = hub;
  }

  function formatTime(s){
    s = Math.max(0, Math.floor(s));
    return s < 10 ? `0${s}` : String(s);
  }

  // ---------- logging (offline) ----------
  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_SQ   = 'HHA_SESSIONS_QUEUE';
  const LS_EQ   = 'HHA_EVENTS_QUEUE';

  const sessionsQ = safeLoadArray(LS_SQ);
  const eventsQ   = safeLoadArray(LS_EQ);

  function safeLoadArray(k){
    try{
      const raw = localStorage.getItem(k);
      const v = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v : [];
    }catch{ return []; }
  }
  function safeSaveArray(k, arr){
    try{ localStorage.setItem(k, JSON.stringify(arr)); }catch{}
  }

  function logEvent(obj){
    eventsQ.push(obj);
    // keep bounded
    if (eventsQ.length > 5000) eventsQ.splice(0, eventsQ.length - 4500);
    safeSaveArray(LS_EQ, eventsQ);
  }

  function logSession(obj){
    sessionsQ.push(obj);
    if (sessionsQ.length > 1500) sessionsQ.splice(0, sessionsQ.length - 1200);
    safeSaveArray(LS_SQ, sessionsQ);
  }

  function saveLastSummary(obj){
    try{ localStorage.setItem(LS_LAST, JSON.stringify(obj)); }catch{}
  }

  function toCSV(rows, headers){
    const esc = (v)=>{
      if (v == null) return '';
      const s = String(v);
      if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const lines = [];
    lines.push(headers.map(esc).join(','));
    for (const r of rows){
      lines.push(headers.map(h=>esc(r[h])).join(','));
    }
    return lines.join('\n');
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 50);
  }

  function exportCSV(){
    const sHeaders = [
      'tsEnd','sessionId','studentId','studyId','game','mode','runMode','view','seed','phase','conditionGroup','playIndex',
      'result','timeTarget','timeSurvived','score','rank',
      'hpStart','hpEnd','riskMax','hitsGood','hitsBad','trapHit','accuracy','bossCleared','miniTotal','miniCleared','errorTop',
      'vrSymptomPostTotal','incidentFlag'
    ];
    const eHeaders = [
      'ts','sessionId','studentId','event','game','mode','runMode','view','wave',
      'targetId','zone','correct','rtMs','combo','x','y','size',
      'kind','hp','hpDelta','risk','riskDelta',
      'questType','questId','state','cur','target','timeLeft',
      'bossId','phase','cleared','tSpent','score','tLeft'
    ];
    downloadText('hha_sessions.csv', toCSV(sessionsQ, sHeaders));
    downloadText('hha_events.csv', toCSV(eventsQ, eHeaders));
  }

  // ---------- game config ----------
  const ZONES = [
    { id:'palm',   label:'ฝ่ามือ' },
    { id:'back',   label:'หลังมือ' },
    { id:'between',label:'ซอกนิ้ว' },
    { id:'knuckles',label:'หลังนิ้ว' },
    { id:'thumb',  label:'นิ้วโป้ง' },
    { id:'nails',  label:'ปลายนิ้ว/เล็บ' },
    { id:'wrist',  label:'ข้อมือ' },
  ];

  // boss sequence (ท้ายเกม)
  const BOSS_SEQ = ['between','thumb','nails'];

  // base difficulty by wave
  function waveFor(tLeft, tTotal){
    const elapsed = tTotal - tLeft;
    if (elapsed < 20) return 1;
    if (elapsed < 50) return 2;
    return 3;
  }

  function waveParams(w, adaptiveFactor=1){
    // adaptiveFactor: <1 easier, >1 harder (play mode only)
    const base = {
      1:{ ttl:[2800,3400], spawn:[820,1100], trapEvery:8000, fake:false },
      2:{ ttl:[2300,2900], spawn:[680,950],  trapEvery:5200, fake:true  },
      3:{ ttl:[1800,2400], spawn:[560,820],  trapEvery:3600, fake:true  }
    }[w];

    const scale = clamp(adaptiveFactor, 0.85, 1.15);
    return {
      ttlMin: Math.round(base.ttl[0] / scale),
      ttlMax: Math.round(base.ttl[1] / scale),
      spawnMin: Math.round(base.spawn[0] / scale),
      spawnMax: Math.round(base.spawn[1] / scale),
      trapEvery: Math.round(base.trapEvery / scale),
      fake: base.fake
    };
  }

  // ---------- runtime state ----------
  const rng = mulberry32(Number(cfg.seed)||123456);
  const sessionStartTs = now();
  const studentId = qs('studentId',''); // optional (you can pass later)
  const playIndex = qs('playIndex',''); // optional
  const sessionId = `hhw-${sessionStartTs}-${(studentId||'anon')}-${(playIndex||'01')}`;

  let runMode = cfg.runMode || 'play';
  let timeTarget = cfg.timeTarget || 70;

  let tLeft = timeTarget;
  let ticking = false;
  let timer = null;

  // score + stats
  const HP0 = 3;
  let hp = HP0;
  let risk = 0;
  let riskMax = 0;
  let score = 0;
  let combo = 0;
  let hitsGood = 0;
  let hitsBad  = 0;
  let trapHit  = 0;

  // telemetry RT
  let lastSpawnTsByTarget = new Map();

  // quests (simple set)
  let miniTotal = 0, miniCleared = 0;
  let mini = null;

  // boss
  let bossActive = false;
  let bossIdx = 0;
  let bossCleared = 0;

  // adaptive (play only)
  let adaptiveFactor = 1.0;
  let rolling = { good:0, bad:0 };

  // UI init
  subTitle.textContent = `view=${cfg.view} • run=${runMode} • seed=${cfg.seed}`;
  setOverlayIntro();

  // bind buttons
  btnBack.onclick = ()=>goHub();
  btnStart.onclick = ()=>startRun(false);
  btnPractice.onclick = ()=>startPractice();
  btnExport.onclick = ()=>exportCSV();
  btnRestart.onclick = ()=>restart();

  // pointer input
  play.addEventListener('pointerdown', (e)=>{
    if (!ticking) return;
    const rect = play.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handleShoot(x, y, 'pointer');
  }, { passive:true });

  // crosshair shoot input from vr-ui.js
  window.addEventListener('hha:shoot', (e)=>{
    if (!ticking) return;
    const det = e.detail || {};
    const rect = play.getBoundingClientRect();
    const x = clamp(Number(det.x)|| (rect.width/2), 0, rect.width);
    const y = clamp(Number(det.y)|| (rect.height/2), 0, rect.height);
    handleShoot(x, y, 'hha:shoot');
  });

  // flush on hide (offline save already, but keep)
  window.addEventListener('pagehide', ()=>flushHard(), { capture:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden') flushHard();
  });

  // start log
  logEvent({
    ts: sessionStartTs,
    sessionId, studentId,
    event:'hha:start',
    game:cfg.game, mode:cfg.mode,
    runMode, view:cfg.view,
    seed:cfg.seed, wave:0
  });

  // ---------- core ----------
  function startPractice(){
    runMode = 'practice';
    tLeft = 15;
    setOverlayHidden();
    beginTicking();
  }

  function startRun(skipTutorial){
    runMode = cfg.runMode || 'play';
    if (!skipTutorial){
      // micro tutorial 15s -> then real run
      tLeft = 15;
      setOverlayHidden();
      beginTicking(()=>{
        // after practice-like tutorial, restart real run
        stopTicking();
        resetStateForNewRun();
        tLeft = timeTarget;
        beginTicking();
      });
    } else {
      setOverlayHidden();
      beginTicking();
    }
  }

  function restart(){
    // keep same params/seed? For play: new seed; for research/practice: keep deterministic.
    const u = new URL(location.href);
    if (runMode === 'play'){
      u.searchParams.set('seed', String(Date.now()));
    }
    location.href = u.toString();
  }

  function resetStateForNewRun(){
    hp = HP0; risk = 0; riskMax = 0;
    score = 0; combo = 0;
    hitsGood = 0; hitsBad = 0; trapHit = 0;
    miniTotal = 0; miniCleared = 0; mini = null;
    bossActive = false; bossIdx = 0; bossCleared = 0;
    rolling.good = 0; rolling.bad = 0;
    adaptiveFactor = 1.0;
    clearTargets();
    updateHUD();
    pickNextMini();
  }

  function beginTicking(onDone=null){
    if (ticking) return;
    ticking = true;
    pickNextMini();
    updateHUD();

    let nextSpawn = now() + 450;
    let nextTrap  = now() + 1200;

    const tickMs = 120;
    timer = setInterval(()=>{
      tLeft -= tickMs/1000;
      if (tLeft <= 0){
        tLeft = 0;
        updateHUD();
        stopTicking();
        if (onDone) onDone();
        else endGame('time');
        return;
      }

      const w = waveFor(tLeft, (runMode==='practice'?15:timeTarget));
      const isBossWindow = (runMode!=='practice') && (timeTarget>=60) && (tLeft <= 18);
      if (isBossWindow && !bossActive){
        bossActive = true;
        bossIdx = 0;
        announceMini(`BOSS: ${zoneLabel(BOSS_SEQ[0])} → ${zoneLabel(BOSS_SEQ[1])} → ${zoneLabel(BOSS_SEQ[2])}`);
        logEvent({ ts:now(), sessionId, studentId, event:'boss:start', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:3, bossId:'germ-king', tLeft:Math.ceil(tLeft) });
      }

      // adaptive only in play
      if (runMode === 'play'){
        const total = rolling.good + rolling.bad;
        if (total >= 10){
          const acc = rolling.good / Math.max(1,total);
          // keep it fair: small nudges only
          adaptiveFactor = clamp(1 + (acc-0.75)*0.18, 0.9, 1.1);
          rolling.good = 0; rolling.bad = 0;
        }
      } else {
        adaptiveFactor = 1.0;
      }

      const P = waveParams(w, adaptiveFactor);

      const tNow = now();
      if (tNow >= nextSpawn){
        spawnTarget(w, P);
        nextSpawn = tNow + randRange(rng, P.spawnMin, P.spawnMax);
      }

      if (tNow >= nextTrap){
        spawnTrap(w);
        nextTrap = tNow + P.trapEvery;
      }

      // decay risk slightly when playing well
      if (combo >= 6) risk = clamp(risk - 0.9, 0, 100);

      // quest tick (mini timeout)
      if (mini && mini.deadlineTs && tNow > mini.deadlineTs && !mini.done){
        failMini('timeout');
      }

      updateHUD();

    }, tickMs);
  }

  function stopTicking(){
    ticking = false;
    if (timer){ clearInterval(timer); timer = null; }
  }

  function updateHUD(){
    // HP hearts
    let s = '';
    for (let i=0;i<HP0;i++) s += (i < hp ? '❤️' : '🖤');
    hpEl.textContent = s;

    riskBar.style.width = `${clamp(risk,0,100)}%`;

    timeEl.textContent = formatTime(tLeft);
    scoreEl.textContent = String(score);

    goalPill.textContent = `GOAL: อยู่รอดให้ครบเวลา (${formatTime(tLeft)})`;
    miniPill.textContent = mini ? `MINI: ${mini.text}` : 'MINI: --';
  }

  function setOverlayIntro(){
    overlay.style.display = 'flex';
    btnExport.style.display = 'none';
    btnRestart.style.display = 'none';
    ovTitle.textContent = 'พร้อมเล่นไหม?';
    ovDesc.textContent = 'Tutorial 15 วินาที แล้วเริ่ม Survival';
    ovMeta.textContent = `sessionId=${sessionId} | view=${cfg.view} | run=${cfg.runMode} | seed=${cfg.seed}`;
  }

  function setOverlayHidden(){
    overlay.style.display = 'none';
  }

  function setOverlayEnd(summaryText){
    overlay.style.display = 'flex';
    btnExport.style.display = 'inline-flex';
    btnRestart.style.display = 'inline-flex';
    ovDesc.textContent = summaryText;
  }

  function clearTargets(){
    play.innerHTML = '';
    lastSpawnTsByTarget.clear();
  }

  function randRange(rngFn, a, b){
    const lo = Math.min(a,b), hi = Math.max(a,b);
    return Math.round(lo + (hi-lo)*rngFn());
  }

  function zoneLabel(id){
    const z = ZONES.find(x=>x.id===id);
    return z ? z.label : id;
  }

  function currentNeedZone(w){
    if (bossActive){
      return BOSS_SEQ[bossIdx] || BOSS_SEQ[BOSS_SEQ.length-1];
    }
    // normal: rotate zones, but gently guided by wave
    if (w === 1) return pick(rng, ['palm','back','between']);
    if (w === 2) return pick(rng, ['between','knuckles','thumb','nails']);
    return pick(rng, ['thumb','nails','wrist','between']);
  }

  function spawnTarget(w, P){
    const rect = play.getBoundingClientRect();
    const pad = 26;
    const x = randRange(rng, pad, rect.width - pad);
    const y = randRange(rng, pad+8, rect.height - pad);
    const s = randRange(rng, 64, 96);

    const need = currentNeedZone(w);
    const allowFake = P.fake && !bossActive && (w >= 2) && (rng() < 0.18);
    const type = allowFake ? 'fake' : 'good';
    const zone = allowFake ? pick(rng, ZONES.map(z=>z.id).filter(z=>z!==need)) : need;

    const id = `t-${Math.floor(now()%1e9)}-${Math.floor(rng()*9999)}`;

    const el = DOC.createElement('div');
    el.className = `target ${type}`;
    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--s', s);
    el.dataset.id = id;
    el.dataset.zone = zone;
    el.dataset.type = type;
    el.dataset.wave = String(w);
    el.innerHTML = `<div class="ring"></div><div class="label">${zoneLabel(zone)}</div>`;
    play.appendChild(el);

    lastSpawnTsByTarget.set(id, now());

    // remove after ttl
    const ttl = randRange(rng, P.ttlMin, P.ttlMax);
    setTimeout(()=>{
      if (!el.isConnected) return;
      el.remove();
      lastSpawnTsByTarget.delete(id);
      // missing a correct target should raise risk a bit
      if (type === 'good' && ticking){
        risk = clamp(risk + (bossActive?10:6), 0, 100);
        if (risk >= 100){
          riskMax++;
          applyDamage('riskOver');
          risk = 55;
        }
      }
    }, ttl);

    logEvent({
      ts: now(), sessionId, studentId,
      event:'target:spawn',
      game:cfg.game, mode:cfg.mode, runMode, view:cfg.view,
      wave:w,
      targetId:id, zone, correct:'', rtMs:'', combo, x: +(x/rect.width).toFixed(3), y:+(y/rect.height).toFixed(3), size:s
    });
  }

  function spawnTrap(w){
    if (!ticking) return;
    const rect = play.getBoundingClientRect();
    const x = randRange(rng, 28, rect.width - 28);
    const y = randRange(rng, 28, rect.height - 28);
    const s = randRange(rng, 54, 78);
    const kind = (rng()<0.55) ? 'contam' : 'fake';

    const id = `p-${Math.floor(now()%1e9)}-${Math.floor(rng()*9999)}`;
    const el = DOC.createElement('div');
    el.className = `target trap`;
    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--s', s);
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.dataset.type = 'trap';
    el.dataset.wave = String(w);
    el.innerHTML = `<div class="ring"></div><div class="label">${kind==='contam'?'☣️ ปนเปื้อน':'⚠️ หลอก'}</div>`;
    play.appendChild(el);

    setTimeout(()=>{ if(el.isConnected) el.remove(); }, randRange(rng, 1400, 2100));

    logEvent({ ts:now(), sessionId, studentId, event:'trap:spawn', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:w, kind, x:+(x/rect.width).toFixed(3), y:+(y/rect.height).toFixed(3), size:s });
  }

  function handleShoot(px, py, source){
    // choose nearest target within radius
    const rect = play.getBoundingClientRect();
    const els = Array.from(play.querySelectorAll('.target'));
    if (!els.length) return;

    let best = null;
    let bestD = 1e9;
    for (const el of els){
      const cx = Number(el.style.getPropertyValue('--x')) || 0;
      const cy = Number(el.style.getPropertyValue('--y')) || 0;
      const s  = Number(el.style.getPropertyValue('--s')) || 70;
      const dx = cx - px, dy = cy - py;
      const d = Math.hypot(dx,dy);
      const hitR = Math.max(26, s*0.55);
      if (d <= hitR && d < bestD){
        best = el; bestD = d;
      }
    }
    if (!best) return;

    const w = Number(best.dataset.wave)||0;

    if (best.dataset.type === 'trap'){
      // trap hit
      best.remove();
      trapHit++;
      combo = 0;

      if (best.dataset.kind === 'contam'){
        applyDamage('trap');
        logEvent({ ts:now(), sessionId, studentId, event:'trap:hit', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:w, kind:'contam', hp, hpDelta:-1, risk, riskDelta:0 });
        if (mini && mini.id==='MQ2' && !mini.done) failMini('trap');
      } else {
        // fake trap: risk spike (fair)
        const before = risk;
        risk = clamp(risk + 25, 0, 100);
        logEvent({ ts:now(), sessionId, studentId, event:'trap:hit', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:w, kind:'fake', hp, hpDelta:0, risk, riskDelta:(risk-before) });
      }

      updateHUD();
      return;
    }

    // normal target hit
    const id = best.dataset.id;
    const zone = best.dataset.zone;
    const type = best.dataset.type; // good/fake
    best.remove();

    const spawned = lastSpawnTsByTarget.get(id) || now();
    const rtMs = clamp(now() - spawned, 120, 9999);

    const need = currentNeedZone(waveFor(tLeft, timeTarget));
    let correct = (type==='good'); // fake type is always wrong by design
    // extra correctness: must match boss sequence zone if boss active
    if (bossActive) correct = (zone === (BOSS_SEQ[bossIdx]||zone));

    if (correct){
      hitsGood++;
      rolling.good++;
      combo++;
      score += 10 + Math.min(20, combo);
      risk = clamp(risk - 9, 0, 100);

      // boss progress
      if (bossActive){
        if (zone === BOSS_SEQ[bossIdx]){
          bossIdx++;
          if (bossIdx >= BOSS_SEQ.length){
            bossCleared = 1;
            bossActive = false;
            announceMini('บอสแตก! +โบนัส');
            score += 60;
            logEvent({ ts:now(), sessionId, studentId, event:'boss:end', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:3, bossId:'germ-king', cleared:1, tSpent:'', hp, risk });
          }
        } else {
          // wrong in boss: penalty
          hitsBad++;
          rolling.bad++;
          combo = 0;
          risk = clamp(risk + 18, 0, 100);
        }
      }

      // mini quest progress
      if (mini && !mini.done) onMiniProgress('good');

    } else {
      hitsBad++;
      rolling.bad++;
      combo = 0;

      // fair: wrong hit = risk increase, not immediate HP loss (unless risk over)
      risk = clamp(risk + (type==='fake'?25:16), 0, 100);
      if (risk >= 100){
        riskMax++;
        applyDamage('wrong');
        risk = 55;
      }

      if (mini && !mini.done) onMiniProgress('bad');
    }

    logEvent({
      ts: now(), sessionId, studentId,
      event:'target:hit',
      game:cfg.game, mode:cfg.mode, runMode, view:cfg.view,
      wave:w,
      targetId:id, zone, correct: correct?1:0, rtMs,
      combo, x:+(px/rect.width).toFixed(3), y:+(py/rect.height).toFixed(3), size:Number(best.style.getPropertyValue('--s'))||''
    });

    updateHUD();
  }

  function applyDamage(reason){
    const before = hp;
    hp = clamp(hp - 1, 0, HP0);
    logEvent({ ts:now(), sessionId, studentId, event:'hha:hp', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:waveFor(tLeft, timeTarget), hp, hpDelta:(hp-before), kind:reason });
    if (hp <= 0){
      stopTicking();
      endGame('dead');
    }
  }

  function pickNextMini(){
    // keep it simple: 3 minis enough for vertical slice
    const pool = [
      { id:'MQ1', text:'ทำถูกติดกัน 5 ครั้งใน 12 วิ', kind:'streak', target:5, ttl:12000 },
      { id:'MQ2', text:'10 วิ ห้ามโดน ☣️ ปนเปื้อน', kind:'noTrap', target:1, ttl:10000 },
      { id:'MQ6', text:'ทำถูก 6 ครั้งใน 10 วิ', kind:'speed', target:6, ttl:10000 },
    ];
    mini = Object.assign({ done:false, cur:0 }, pick(rng, pool));
    mini.deadlineTs = now() + (mini.ttl||10000);
    miniTotal++;

    logEvent({ ts:now(), sessionId, studentId, event:'quest:update', questType:'mini', questId:mini.id, state:'start', cur:0, target:mini.target, timeLeft:Math.round((mini.deadlineTs-now())/1000), game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:waveFor(tLeft,timeTarget) });
  }

  function announceMini(text){
    hintEl.textContent = text;
    setTimeout(()=>{ if(ticking) hintEl.textContent = 'แตะ/คลิกเป้าให้ถูกจุด • ถ้าเป็น cVR ใช้ crosshair ยิง'; }, 2500);
  }

  function onMiniProgress(type){
    if (!mini || mini.done) return;
    const tNow = now();

    if (mini.kind === 'streak'){
      if (type==='good') mini.cur++; else mini.cur = 0;
      if (mini.cur >= mini.target) passMini();
    }
    else if (mini.kind === 'noTrap'){
      // pass when time elapsed without trap hit
      // (we handle fail in trap:hit)
      if (tNow >= mini.deadlineTs) passMini();
    }
    else if (mini.kind === 'speed'){
      if (type==='good') mini.cur++;
      if (mini.cur >= mini.target) passMini();
    }
  }

  function passMini(){
    if (!mini || mini.done) return;
    mini.done = true;
    miniCleared++;
    score += 40;
    risk = clamp(risk - 20, 0, 100);
    announceMini(`ผ่าน MINI! +40`);
    logEvent({ ts:now(), sessionId, studentId, event:'quest:update', questType:'mini', questId:mini.id, state:'pass', cur:mini.cur, target:mini.target, timeLeft:0, game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:waveFor(tLeft,timeTarget) });

    // next mini after short gap
    setTimeout(()=>{ if(ticking) pickNextMini(); }, 900);
  }

  function failMini(reason){
    if (!mini || mini.done) return;
    mini.done = true;
    combo = 0;
    risk = clamp(risk + 18, 0, 100);
    announceMini(`พลาด MINI (${reason})`);
    logEvent({ ts:now(), sessionId, studentId, event:'quest:update', questType:'mini', questId:mini.id, state:'fail', cur:mini.cur, target:mini.target, timeLeft:0, game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:waveFor(tLeft,timeTarget) });
    setTimeout(()=>{ if(ticking) pickNextMini(); }, 900);
  }

  function endGame(reason){
    clearTargets();

    const tSurvived = (reason==='time') ? timeTarget : Math.max(0, Math.round(timeTarget - tLeft));
    const result = (reason==='time') ? 'win' : 'lose';
    const accuracy = hitsGood / Math.max(1, hitsGood + hitsBad);
    const score1000 = computeScore1000({
      timeTarget, tSurvived, hpEnd:hp, hpStart:HP0,
      hitsGood, hitsBad, trapHit, bossCleared
    });
    const rank = computeRank(score1000, hp, bossCleared);

    const summary = {
      tsEnd: now(),
      sessionId, studentId,
      studyId: cfg.studyId || '',
      game: cfg.game,
      mode: cfg.mode,
      runMode, view: cfg.view,
      seed: cfg.seed,
      phase: cfg.phase || '',
      conditionGroup: cfg.conditionGroup || '',
      playIndex: playIndex || '',
      result,
      timeTarget,
      timeSurvived: tSurvived,
      score: score1000,
      rank,
      hpStart: HP0,
      hpEnd: hp,
      riskMax,
      hitsGood, hitsBad, trapHit,
      accuracy: +accuracy.toFixed(4),
      bossCleared,
      miniTotal, miniCleared,
      errorTop: topErrorZone(),   // from events of this session
      vrSymptomPostTotal: '',
      incidentFlag: 0
    };

    logSession(summary);
    saveLastSummary(summary);

    logEvent({
      ts: now(), sessionId, studentId,
      event:'hha:end',
      game:cfg.game, mode:cfg.mode, runMode, view:cfg.view,
      wave:0,
      score: score1000, tLeft: Math.ceil(tLeft),
      cleared: bossCleared
    });

    flushHard();

    ovTitle.textContent = (result==='win') ? 'ชนะ! อยู่รอดแล้ว 🎉' : 'จบเกม!';
    const line1 = `คะแนน ${score1000} • Rank ${rank} • HP ${hp}/${HP0}`;
    const line2 = `ถูก ${hitsGood} ผิด ${hitsBad} Trap ${trapHit} • acc ${(accuracy*100).toFixed(1)}%`;
    const line3 = `Mini ${miniCleared}/${miniTotal} • Boss ${bossCleared? 'ผ่าน' : 'ยัง'}`;
    setOverlayEnd([line1,line2,line3].join('\n'));
    ovMeta.textContent = `saved: ${LS_LAST} | queued: sessions=${sessionsQ.length} events=${eventsQ.length}`;
  }

  function computeScore1000(o){
    const S_survive = clamp((o.tSurvived/o.timeTarget)*400, 0, 400);
    const acc = o.hitsGood / Math.max(1, o.hitsGood + o.hitsBad);
    const S_acc = clamp(acc*300, 0, 300);
    const S_hp = clamp((o.hpEnd/o.hpStart)*200, 0, 200);
    let bonus = 0;
    if (o.bossCleared) bonus += 60;
    if (o.trapHit === 0) bonus += 20;
    bonus = clamp(bonus, 0, 100);
    return Math.round(S_survive + S_acc + S_hp + bonus);
  }

  function computeRank(score1000, hpEnd, bossCleared){
    if (score1000 >= 930 && hpEnd === 3 && bossCleared) return 'SSS';
    if (score1000 >= 860 && hpEnd >= 2) return 'SS';
    if (score1000 >= 780) return 'S';
    if (score1000 >= 680) return 'A';
    if (score1000 >= 560) return 'B';
    return 'C';
  }

  function topErrorZone(){
    // quick scan eventsQ for this session where target:hit correct=0
    const counts = Object.create(null);
    for (let i=eventsQ.length-1; i>=0; i--){
      const e = eventsQ[i];
      if (!e || e.sessionId !== sessionId) continue;
      if (e.event === 'target:hit' && Number(e.correct) === 0 && e.zone){
        counts[e.zone] = (counts[e.zone]||0) + 1;
      }
    }
    let best = '', bestN = 0;
    for (const k in counts){
      if (counts[k] > bestN){ bestN = counts[k]; best = k; }
    }
    return best || '';
  }

  function flushHard(){
    // offline queues already saved per push, but ensure final persistence
    safeSaveArray(LS_SQ, sessionsQ);
    safeSaveArray(LS_EQ, eventsQ);
  }
}