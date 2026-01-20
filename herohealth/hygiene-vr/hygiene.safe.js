/* === /herohealth/hygiene-vr/hygiene.safe.js ===
Handwash Survival — PRODUCTION-ish (Offline logging)
✅ A-Frame/WebXR compatible + vr-ui.js (hha:shoot)
✅ Play: cVR auto practice 15s -> real run
✅ Survival + Waves + Traps + Boss 3 phases
✅ Mini quests 8 types
✅ Spawn grid9 + anti-repeat + safe margins
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
  function randRange(rngFn, a, b){
    const lo = Math.min(a,b), hi = Math.max(a,b);
    return Math.round(lo + (hi-lo)*rngFn());
  }
  function formatTime(s){
    s = Math.max(0, Math.floor(s));
    return s < 10 ? `0${s}` : String(s);
  }
  function goHub(){
    const hub = cfg.hub || '../hub.html';
    location.href = hub;
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
    if (eventsQ.length > 6000) eventsQ.splice(0, eventsQ.length - 5200);
    safeSaveArray(LS_EQ, eventsQ);
  }
  function logSession(obj){
    sessionsQ.push(obj);
    if (sessionsQ.length > 1600) sessionsQ.splice(0, sessionsQ.length - 1300);
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
      'hpStart','hpEnd','riskMax','hitsGood','hitsBad','trapHit','accuracy','bossCleared',
      'miniTotal','miniCleared','errorTop','rtMedianMs',
      'vrSymptomPostTotal','incidentFlag'
    ];
    const eHeaders = [
      'ts','sessionId','studentId','event','game','mode','runMode','view','wave',
      'targetId','zone','correct','rtMs','combo','x','y','size',
      'kind','hp','hpDelta','risk','riskDelta',
      'questType','questId','state','cur','target','timeLeft',
      'bossId','phase','cleared','tSpent','score','tLeft','src'
    ];
    downloadText('hha_sessions.csv', toCSV(sessionsQ, sHeaders));
    downloadText('hha_events.csv', toCSV(eventsQ, eHeaders));
  }

  // ---------- game content ----------
  const ZONES = [
    { id:'palm',    label:'ฝ่ามือ' },
    { id:'back',    label:'หลังมือ' },
    { id:'between', label:'ซอกนิ้ว' },
    { id:'knuckles',label:'หลังนิ้ว' },
    { id:'thumb',   label:'นิ้วโป้ง' },
    { id:'nails',   label:'ปลายนิ้ว/เล็บ' },
    { id:'wrist',   label:'ข้อมือ' },
  ];
  function zoneLabel(id){
    const z = ZONES.find(x=>x.id===id);
    return z ? z.label : id;
  }

  // Boss 3 phases (clear each phase -> bonus)
  const BOSS_PHASES = [
    { id:'boss-1', name:'เชื้อจอมซ่อน', seq:['between','thumb'] },
    { id:'boss-2', name:'เชื้อจอมไว',   seq:['nails','thumb','between'] },
    { id:'boss-3', name:'เชื้อราชา',    seq:['thumb','nails','between','wrist'] }
  ];

  // ---------- runtime state ----------
  const rng = mulberry32(Number(cfg.seed)||123456);
  const sessionStartTs = now();
  const studentId = (cfg.studentId || '');
  const playIndex = (cfg.playIndex || '');
  const sessionId = `hhw-${sessionStartTs}-${(studentId||'anon')}-${(playIndex||'01')}`;

  let runMode = cfg.runMode || 'play';
  const timeTarget = cfg.timeTarget || 70;

  const HP0 = 3;
  let hp = HP0;
  let risk = 0;
  let riskMax = 0;

  let tLeft = timeTarget;
  let ticking = false;
  let timer = null;

  let score = 0;
  let combo = 0;
  let hitsGood = 0;
  let hitsBad  = 0;
  let trapHit  = 0;

  // RT tracking (per correct hit)
  const rtList = [];

  // quests
  let miniTotal = 0, miniCleared = 0;
  let mini = null;

  // boss
  let bossActive = false;
  let bossPhaseIdx = -1;
  let bossSeqIdx = 0;
  let bossCleared = 0;

  // adaptive (play only)
  let adaptiveFactor = 1.0;
  let rolling = { good:0, bad:0 };

  // spawn anti-repeat
  let lastCell = -1;
  let lastCell2 = -1;

  // target spawn ts
  let lastSpawnTsByTarget = new Map();

  // UI
  subTitle.textContent = `view=${cfg.view} • run=${runMode} • seed=${cfg.seed}`;
  setOverlayIntro();

  // bind buttons
  btnBack.onclick = ()=>goHub();
  btnExport.onclick = ()=>exportCSV();
  btnRestart.onclick = ()=>restart();

  btnPractice.onclick = ()=>startPractice();
  btnStart.onclick = ()=>{
    // play mode: cVR auto practice 15s -> real
    if (cfg.autoPractice) startPractice(true);
    else startRun(true);
  };

  // pointer input
  play.addEventListener('pointerdown', (e)=>{
    if (!ticking) return;
    const rect = play.getBoundingClientRect();
    handleShoot(e.clientX - rect.left, e.clientY - rect.top, 'pointer');
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

  // flush on hide
  window.addEventListener('pagehide', ()=>flushHard(), { capture:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden') flushHard();
  });

  // start log
  logEvent({
    ts: sessionStartTs, sessionId, studentId,
    event:'hha:start',
    game:cfg.game, mode:cfg.mode,
    runMode, view:cfg.view, wave:0,
    seed:cfg.seed, tLeft:timeTarget
  });

  // ---------- start behavior ----------
  // overlay text depending on view
  if (cfg.autoPractice){
    DOC.getElementById('ovDesc').textContent = 'cVR: ฝึก 15 วินาที แล้วเข้าเกมจริงอัตโนมัติ';
  } else {
    DOC.getElementById('ovDesc').textContent = 'เริ่มเกม Survival ได้ทันที (70 วินาที)';
  }

  // hide practice button for non-cVR
  if (cfg.view !== 'cvr') btnPractice.style.display = 'none';

  // ---------- core ----------
  function restart(){
    const u = new URL(location.href);
    if (runMode === 'play'){
      u.searchParams.set('seed', String(Date.now()));
    }
    location.href = u.toString();
  }

  function setOverlayIntro(){
    overlay.style.display = 'flex';
    btnExport.style.display = 'none';
    btnRestart.style.display = 'none';
    ovTitle.textContent = 'ภารกิจ: ช่วยฮีโร่กำจัดเชื้อโรค!';
    ovMeta.textContent = `sessionId=${sessionId} | view=${cfg.view} | run=${cfg.runMode} | seed=${cfg.seed}`;
  }
  function setOverlayHidden(){ overlay.style.display = 'none'; }
  function setOverlayEnd(summaryText){
    overlay.style.display = 'flex';
    btnExport.style.display = 'inline-flex';
    btnRestart.style.display = 'inline-flex';
    ovDesc.textContent = summaryText;
  }

  function updateHUD(){
    let s = '';
    for (let i=0;i<HP0;i++) s += (i < hp ? '❤️' : '🖤');
    hpEl.textContent = s;
    riskBar.style.width = `${clamp(risk,0,100)}%`;
    timeEl.textContent = formatTime(tLeft);
    scoreEl.textContent = String(score);

    goalPill.textContent = `GOAL: อยู่รอดให้ครบเวลา (${formatTime(tLeft)})`;
    miniPill.textContent = mini ? `MINI: ${mini.text}` : 'MINI: --';
  }

  function clearTargets(){
    play.innerHTML = '';
    lastSpawnTsByTarget.clear();
  }

  function announce(text, ms=2200){
    hintEl.textContent = text;
    setTimeout(()=>{ if(ticking) hintEl.textContent = 'แตะ/คลิกเป้าให้ถูกจุด • cVR ยิงจาก crosshair'; }, ms);
  }

  function flushHard(){
    safeSaveArray(LS_SQ, sessionsQ);
    safeSaveArray(LS_EQ, eventsQ);
  }

  function computeScore1000(o){
    const S_survive = clamp((o.timeSurvived/o.timeTarget)*420, 0, 420);
    const acc = o.hitsGood / Math.max(1, o.hitsGood + o.hitsBad);
    const S_acc = clamp(acc*320, 0, 320);
    const S_hp = clamp((o.hpEnd/o.hpStart)*200, 0, 200);
    let bonus = 0;
    bonus += (o.bossCleared?80:0);
    bonus += (o.trapHit===0?20:0);
    bonus += clamp(o.miniCleared*12, 0, 60);
    return Math.round(S_survive + S_acc + S_hp + clamp(bonus,0,120));
  }

  function computeRank(score1000, hpEnd, bossCleared){
    if (score1000 >= 940 && hpEnd === 3 && bossCleared) return 'SSS';
    if (score1000 >= 870 && hpEnd >= 2) return 'SS';
    if (score1000 >= 790) return 'S';
    if (score1000 >= 690) return 'A';
    if (score1000 >= 570) return 'B';
    return 'C';
  }

  function topErrorZone(){
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

  function median(arr){
    if (!arr.length) return '';
    const a = arr.slice().sort((x,y)=>x-y);
    const mid = Math.floor(a.length/2);
    return (a.length%2) ? a[mid] : Math.round((a[mid-1]+a[mid])/2);
  }

  // ---------- timing / wave ----------
  function waveFor(tLeft, tTotal){
    const elapsed = tTotal - tLeft;
    if (elapsed < 18) return 1;
    if (elapsed < 45) return 2;
    return 3;
  }
  function waveParams(w, adaptiveFactor=1){
    const base = {
      1:{ ttl:[2900,3600], spawn:[820,1100], trapEvery:9000, fake:false },
      2:{ ttl:[2400,3100], spawn:[700,980],  trapEvery:5600, fake:true  },
      3:{ ttl:[1900,2600], spawn:[580,860],  trapEvery:3800, fake:true  }
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

  // ---------- spawn bounds: grid9 anti-repeat ----------
  function getSpawnRect(){
    const rect = play.getBoundingClientRect();
    const pad = (cfg.view==='cvr' || cfg.view==='vr') ? 28 : 22;
    return {
      w: rect.width,
      h: rect.height,
      left: pad,
      top: pad,
      right: Math.max(pad, rect.width - pad),
      bottom: Math.max(pad, rect.height - pad),
    };
  }

  function pickGridCell(){
    // 0..8
    let cell = Math.floor(rng()*9);
    let guard = 0;
    while ((cell === lastCell || cell === lastCell2) && guard < 9){
      cell = (cell + 1 + Math.floor(rng()*3)) % 9;
      guard++;
    }
    lastCell2 = lastCell;
    lastCell = cell;
    return cell;
  }

  function cellCenter(cell, R){
    const col = cell % 3;
    const row = Math.floor(cell / 3);
    const x0 = R.left + (R.right - R.left) * ((col + 0.5)/3);
    const y0 = R.top  + (R.bottom- R.top ) * ((row + 0.5)/3);
    return { x0, y0 };
  }

  function jitterAround(x0,y0, R, jx=0.22, jy=0.22){
    const rx = (R.right - R.left);
    const ry = (R.bottom - R.top);
    const x = x0 + (rng()-0.5) * rx * jx;
    const y = y0 + (rng()-0.5) * ry * jy;
    return {
      x: clamp(x, R.left, R.right),
      y: clamp(y, R.top, R.bottom)
    };
  }

  // ---------- boss control ----------
  function bossWindow(tLeft, tTotal){
    // open boss in last ~20s, but only if total >= 60
    if (tTotal < 60) return false;
    return tLeft <= 20;
  }

  function startBoss(){
    bossActive = true;
    bossPhaseIdx = 0;
    bossSeqIdx = 0;
    const ph = BOSS_PHASES[bossPhaseIdx];
    announce(`👑 BOSS เฟส 1: ${ph.name} — ยิงลำดับ: ${ph.seq.map(zoneLabel).join(' → ')}`, 3200);
    logEvent({ ts:now(), sessionId, studentId, event:'boss:start', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:3, bossId:ph.id, phase:1, tLeft:Math.ceil(tLeft) });
  }

  function bossNeedZone(){
    if (!bossActive) return null;
    const ph = BOSS_PHASES[bossPhaseIdx];
    return ph.seq[bossSeqIdx] || ph.seq[ph.seq.length-1];
  }

  function advanceBoss(){
    const ph = BOSS_PHASES[bossPhaseIdx];
    bossSeqIdx++;
    if (bossSeqIdx >= ph.seq.length){
      // phase cleared
      logEvent({ ts:now(), sessionId, studentId, event:'boss:phase', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:3, bossId:ph.id, phase:(bossPhaseIdx+1), cleared:1, tLeft:Math.ceil(tLeft) });
      score += 55;
      announce(`ผ่านเฟส ${bossPhaseIdx+1}! +55`, 1800);

      bossPhaseIdx++;
      bossSeqIdx = 0;
      if (bossPhaseIdx >= BOSS_PHASES.length){
        bossActive = false;
        bossCleared = 1;
        score += 90;
        announce(`บอสพ่าย! +90`, 2200);
        logEvent({ ts:now(), sessionId, studentId, event:'boss:end', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:3, bossId:'boss-final', cleared:1, tLeft:Math.ceil(tLeft) });
      } else {
        const next = BOSS_PHASES[bossPhaseIdx];
        announce(`👑 เฟส ${bossPhaseIdx+1}: ${next.name} — ${next.seq.map(zoneLabel).join(' → ')}`, 2800);
      }
    }
  }

  // ---------- mini quests (8 types) ----------
  function makeMini(){
    const pool = [
      { id:'MQ1', kind:'streak',   text:'ทำถูกติดกัน 6 ครั้งใน 14 วิ', target:6, ttl:14000 },
      { id:'MQ2', kind:'noTrap',   text:'12 วิ ห้ามโดน ☣️ ปนเปื้อน',    target:1, ttl:12000 },
      { id:'MQ3', kind:'speed',    text:'ทำถูก 7 ครั้งใน 11 วิ',        target:7, ttl:11000 },
      { id:'MQ4', kind:'zone',     text:'โฟกัส “นิ้วโป้ง” ให้ถูก 3 ครั้ง', target:3, ttl:12000, zone:'thumb' },
      { id:'MQ5', kind:'switch',   text:'สลับ “ฝ่ามือ→หลังมือ” ให้ถูก',  target:4, ttl:13000, seq:['palm','back','palm','back'] },
      { id:'MQ6', kind:'perfect',  text:'10 วิ ห้ามพลาดเลย',             target:1, ttl:10000 },
      { id:'MQ7', kind:'calm',     text:'ลด RISK ลงต่ำกว่า 25 ภายใน 10 วิ', target:25, ttl:10000 },
      { id:'MQ8', kind:'bossWarm', text:'ทำ “ซอกนิ้ว” ถูก 2 ครั้งก่อนบอสมา', target:2, ttl:15000, zone:'between' },
    ];
    return Object.assign({ done:false, cur:0, bad:0 }, pick(rng, pool));
  }

  function startMini(){
    mini = makeMini();
    mini.deadlineTs = now() + (mini.ttl||10000);
    miniTotal++;
    logEvent({ ts:now(), sessionId, studentId, event:'quest:update', questType:'mini', questId:mini.id, state:'start', cur:0, target:mini.target, timeLeft:Math.round((mini.deadlineTs-now())/1000), game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:waveFor(tLeft,timeTarget) });
  }

  function passMini(){
    if (!mini || mini.done) return;
    mini.done = true;
    miniCleared++;
    score += 45;
    risk = clamp(risk - 18, 0, 100);
    announce(`ผ่าน MINI! +45`, 1600);
    logEvent({ ts:now(), sessionId, studentId, event:'quest:update', questType:'mini', questId:mini.id, state:'pass', cur:mini.cur, target:mini.target, timeLeft:0, game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:waveFor(tLeft,timeTarget) });
    setTimeout(()=>{ if(ticking) startMini(); }, 900);
  }

  function failMini(reason){
    if (!mini || mini.done) return;
    mini.done = true;
    combo = 0;
    risk = clamp(risk + 16, 0, 100);
    announce(`พลาด MINI (${reason})`, 1700);
    logEvent({ ts:now(), sessionId, studentId, event:'quest:update', questType:'mini', questId:mini.id, state:'fail', cur:mini.cur, target:mini.target, timeLeft:0, game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:waveFor(tLeft,timeTarget) });
    setTimeout(()=>{ if(ticking) startMini(); }, 900);
  }

  function onMiniProgress(hit){
    if (!mini || mini.done) return;
    const tNow = now();

    if (mini.kind === 'streak'){
      if (hit.good) mini.cur++; else mini.cur = 0;
      if (mini.cur >= mini.target) passMini();
    }
    else if (mini.kind === 'noTrap'){
      // pass if time up without contam trap hit
      if (tNow >= mini.deadlineTs) passMini();
    }
    else if (mini.kind === 'speed'){
      if (hit.good) mini.cur++;
      if (mini.cur >= mini.target) passMini();
    }
    else if (mini.kind === 'zone'){
      if (hit.good && hit.zone === mini.zone) mini.cur++;
      if (mini.cur >= mini.target) passMini();
    }
    else if (mini.kind === 'switch'){
      if (hit.good){
        const need = mini.seq[mini.cur] || mini.seq[mini.seq.length-1];
        if (hit.zone === need) mini.cur++; else { mini.bad++; mini.cur = 0; }
      } else { mini.bad++; mini.cur = 0; }
      if (mini.cur >= mini.target) passMini();
    }
    else if (mini.kind === 'perfect'){
      if (!hit.good) return failMini('พลาด');
      if (tNow >= mini.deadlineTs) passMini();
    }
    else if (mini.kind === 'calm'){
      if (risk <= mini.target) passMini();
      if (tNow >= mini.deadlineTs && risk > mini.target) failMini('ยังเสี่ยงสูง');
    }
    else if (mini.kind === 'bossWarm'){
      if (hit.good && hit.zone === mini.zone) mini.cur++;
      if (mini.cur >= mini.target) passMini();
    }
  }

  // ---------- spawning targets ----------
  function currentNeedZone(w){
    if (bossActive){
      return bossNeedZone();
    }
    if (w === 1) return pick(rng, ['palm','back','between']);
    if (w === 2) return pick(rng, ['between','knuckles','thumb','nails']);
    return pick(rng, ['thumb','nails','wrist','between']);
  }

  function spawnTarget(w, P){
    const R = getSpawnRect();
    const cell = pickGridCell();
    const c = cellCenter(cell, R);
    const pos = jitterAround(c.x0, c.y0, R);

    const s = randRange(rng, (cfg.view==='cvr'?76:68), (cfg.view==='cvr'?104:96));
    const need = currentNeedZone(w);

    const allowFake = P.fake && !bossActive && (w >= 2) && (rng() < 0.22);
    const type = allowFake ? 'fake' : 'good';
    const zone = allowFake ? pick(rng, ZONES.map(z=>z.id).filter(z=>z!==need)) : need;

    const id = `t-${Math.floor(now()%1e9)}-${Math.floor(rng()*9999)}`;

    const el = DOC.createElement('div');
    el.className = `target ${type}`;
    el.style.setProperty('--x', pos.x);
    el.style.setProperty('--y', pos.y);
    el.style.setProperty('--s', s);
    el.dataset.id = id;
    el.dataset.zone = zone;
    el.dataset.type = type;
    el.dataset.wave = String(w);
    el.innerHTML = `<div class="ring"></div><div class="label">${zoneLabel(zone)}</div>`;
    play.appendChild(el);

    lastSpawnTsByTarget.set(id, now());

    const ttl = randRange(rng, P.ttlMin, P.ttlMax);
    setTimeout(()=>{
      if (!el.isConnected) return;
      el.remove();
      lastSpawnTsByTarget.delete(id);
      // miss good target -> risk up
      if (type === 'good' && ticking){
        risk = clamp(risk + (bossActive?11:6), 0, 100);
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
      wave:w, targetId:id, zone, combo,
      x:+(pos.x/Math.max(1,R.w)).toFixed(3), y:+(pos.y/Math.max(1,R.h)).toFixed(3), size:s
    });
  }

  function spawnTrap(w){
    if (!ticking) return;
    const R = getSpawnRect();
    const cell = pickGridCell();
    const c = cellCenter(cell, R);
    const pos = jitterAround(c.x0, c.y0, R, 0.18, 0.18);

    const s = randRange(rng, 56, 80);
    const kind = (rng()<0.6) ? 'contam' : 'fake';
    const id = `p-${Math.floor(now()%1e9)}-${Math.floor(rng()*9999)}`;

    const el = DOC.createElement('div');
    el.className = `target trap`;
    el.style.setProperty('--x', pos.x);
    el.style.setProperty('--y', pos.y);
    el.style.setProperty('--s', s);
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.dataset.type = 'trap';
    el.dataset.wave = String(w);
    el.innerHTML = `<div class="ring"></div><div class="label">${kind==='contam'?'☣️ ปนเปื้อน':'⚠️ หลอก'}</div>`;
    play.appendChild(el);

    setTimeout(()=>{ if(el.isConnected) el.remove(); }, randRange(rng, 1400, 2200));

    logEvent({ ts:now(), sessionId, studentId, event:'trap:spawn', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:w, kind,
      x:+(pos.x/Math.max(1,R.w)).toFixed(3), y:+(pos.y/Math.max(1,R.h)).toFixed(3), size:s
    });
  }

  function handleShoot(px, py, src){
    const rect = play.getBoundingClientRect();
    const els = Array.from(play.querySelectorAll('.target'));
    if (!els.length) return;

    let best = null, bestD = 1e9;
    for (const el of els){
      const cx = Number(el.style.getPropertyValue('--x')) || 0;
      const cy = Number(el.style.getPropertyValue('--y')) || 0;
      const s  = Number(el.style.getPropertyValue('--s')) || 70;
      const d = Math.hypot(cx-px, cy-py);
      const hitR = Math.max(28, s*0.56);
      if (d <= hitR && d < bestD){ best = el; bestD = d; }
    }
    if (!best) return;

    const w = Number(best.dataset.wave)||0;

    if (best.dataset.type === 'trap'){
      best.remove();
      trapHit++;
      combo = 0;

      if (best.dataset.kind === 'contam'){
        applyDamage('trap');
        logEvent({ ts:now(), sessionId, studentId, event:'trap:hit', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:w, kind:'contam', hp, hpDelta:-1, risk, riskDelta:0, src });
        if (mini && mini.id==='MQ2' && !mini.done) failMini('โดนปนเปื้อน');
      } else {
        const before = risk;
        risk = clamp(risk + 26, 0, 100);
        logEvent({ ts:now(), sessionId, studentId, event:'trap:hit', game:cfg.game, mode:cfg.mode, runMode, view:cfg.view, wave:w, kind:'fake', hp, hpDelta:0, risk, riskDelta:(risk-before), src });
      }
      updateHUD();
      return;
    }

    // target hit
    const id = best.dataset.id;
    const zone = best.dataset.zone;
    const type = best.dataset.type;
    best.remove();

    const spawned = lastSpawnTsByTarget.get(id) || now();
    const rtMs = clamp(now() - spawned, 120, 9999);

    let correct = (type==='good');
    const needBoss = bossNeedZone();
    if (bossActive) correct = (zone === needBoss);

    if (correct){
      hitsGood++; rolling.good++; combo++;
      score += 10 + Math.min(22, combo);
      risk = clamp(risk - 9, 0, 100);
      rtList.push(rtMs);

      if (bossActive){
        advanceBoss();
      }
    } else {
      hitsBad++; rolling.bad++; combo = 0;
      risk = clamp(risk + (type==='fake'?26:16), 0, 100);
      if (risk >= 100){
        riskMax++;
        applyDamage('wrong');
        risk = 55;
      }
    }

    logEvent({
      ts: now(), sessionId, studentId,
      event:'target:hit',
      game:cfg.game, mode:cfg.mode, runMode, view:cfg.view,
      wave:w, targetId:id, zone, correct: correct?1:0, rtMs,
      combo, x:+(px/Math.max(1,rect.width)).toFixed(3), y:+(py/Math.max(1,rect.height)).toFixed(3),
      size:Number(best.style.getPropertyValue('--s'))||'', src
    });

    // mini progress
    onMiniProgress({ good:correct, zone });

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

  // ---------- ticking ----------
  function resetForRun(){
    hp = HP0; risk = 0; riskMax = 0;
    score = 0; combo = 0;
    hitsGood = 0; hitsBad = 0; trapHit = 0;
    miniTotal = 0; miniCleared = 0; mini = null;
    bossActive = false; bossPhaseIdx = -1; bossSeqIdx = 0; bossCleared = 0;
    rolling.good=0; rolling.bad=0; adaptiveFactor=1.0;
    lastCell=-1; lastCell2=-1;
    rtList.length = 0;
    clearTargets();
    updateHUD();
    startMini();
  }

  function beginTicking(totalSeconds, onDone=null){
    if (ticking) return;
    ticking = true;

    let nextSpawn = now() + 350;
    let nextTrap  = now() + 1300;

    const tickMs = 120;
    timer = setInterval(()=>{
      tLeft -= tickMs/1000;
      if (tLeft <= 0){
        tLeft = 0; updateHUD();
        stopTicking();
        if (onDone) onDone();
        else endGame('time');
        return;
      }

      const w = waveFor(tLeft, totalSeconds);

      // boss window
      if (!bossActive && bossWindow(tLeft, totalSeconds) && (runMode !== 'practice')){
        startBoss();
      }

      // adaptive only in play
      if (runMode === 'play'){
        const total = rolling.good + rolling.bad;
        if (total >= 10){
          const acc = rolling.good / Math.max(1,total);
          adaptiveFactor = clamp(1 + (acc-0.75)*0.18, 0.9, 1.1);
          rolling.good=0; rolling.bad=0;
        }
      } else adaptiveFactor = 1.0;

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

      // mini timeout
      if (mini && mini.deadlineTs && tNow > mini.deadlineTs && !mini.done){
        // special: MQ2 noTrap passes if timeout
        if (mini.kind === 'noTrap') passMini();
        else failMini('หมดเวลา');
      }

      // calm mini auto check
      if (mini && mini.kind === 'calm' && !mini.done){
        onMiniProgress({ good:true, zone:'' });
      }

      updateHUD();
    }, tickMs);
  }

  function stopTicking(){
    ticking = false;
    if (timer){ clearInterval(timer); timer = null; }
  }

  function startPractice(chainToReal=false){
    runMode = 'practice';
    resetForRun();
    tLeft = 15;
    setOverlayHidden();
    announce('ฝึก 15 วิ: ยิงให้ถูกจุด (ไม่ต้องกลัวแพ้)', 2200);
    beginTicking(15, ()=>{
      if (!chainToReal) return;
      // chain into real play
      stopTicking();
      runMode = cfg.runMode || 'play';
      resetForRun();
      tLeft = timeTarget;
      announce('เริ่มจริง! อยู่รอดให้ครบเวลา!', 2000);
      beginTicking(timeTarget);
    });
  }

  function startRun(immediate=true){
    runMode = cfg.runMode || 'play';
    resetForRun();
    tLeft = timeTarget;
    setOverlayHidden();
    if (!immediate){
      startPractice(true);
    } else {
      announce('เริ่ม! ทำให้ถูก • หลบปนเปื้อน • เตรียมเจอบอสท้ายเกม', 2600);
      beginTicking(timeTarget);
    }
  }

  // auto-start rule:
  // - if autoPractice (cVR play): startPractice(chainToReal)
  // - else: startRun(immediate)
  // We still keep overlay; user taps Start.
  // (buttons already wired)

  function endGame(reason){
    clearTargets();

    const timeSurvived = (reason==='time') ? timeTarget : Math.max(0, Math.round(timeTarget - tLeft));
    const result = (reason==='time') ? 'win' : 'lose';
    const accuracy = hitsGood / Math.max(1, hitsGood + hitsBad);

    const score1000 = computeScore1000({
      timeTarget, timeSurvived, hpEnd:hp, hpStart:HP0,
      hitsGood, hitsBad, trapHit, bossCleared, miniCleared
    });

    const rank = computeRank(score1000, hp, bossCleared);
    const rtMedianMs = median(rtList);
    const errTop = topErrorZone();

    const summary = {
      tsEnd: now(),
      sessionId, studentId,
      studyId: cfg.studyId || '',
      game: cfg.game, mode: cfg.mode,
      runMode, view: cfg.view,
      seed: cfg.seed,
      phase: cfg.phase || '',
      conditionGroup: cfg.conditionGroup || '',
      playIndex: playIndex || '',
      result,
      timeTarget,
      timeSurvived,
      score: score1000,
      rank,
      hpStart: HP0,
      hpEnd: hp,
      riskMax,
      hitsGood, hitsBad, trapHit,
      accuracy: +accuracy.toFixed(4),
      bossCleared,
      miniTotal, miniCleared,
      errorTop: errTop,
      rtMedianMs,
      vrSymptomPostTotal: '',
      incidentFlag: 0
    };

    logSession(summary);
    saveLastSummary(summary);

    logEvent({
      ts: now(), sessionId, studentId,
      event:'hha:end',
      game:cfg.game, mode:cfg.mode, runMode, view:cfg.view,
      wave:0, score: score1000, tLeft: Math.ceil(tLeft),
      cleared: bossCleared
    });

    flushHard();

    ovTitle.textContent = (result==='win') ? 'ชนะ! อยู่รอดแล้ว 🎉' : 'จบเกม!';
    const line1 = `คะแนน ${score1000} • Rank ${rank} • HP ${hp}/${HP0}`;
    const line2 = `ถูก ${hitsGood} ผิด ${hitsBad} Trap ${trapHit} • acc ${(accuracy*100).toFixed(1)}% • RT~ ${rtMedianMs||'-'}ms`;
    const line3 = `Mini ${miniCleared}/${miniTotal} • Boss ${bossCleared? 'ผ่าน' : 'ยัง'} • พลาดบ่อย: ${errTop?zoneLabel(errTop):'-'}`;
    setOverlayEnd([line1,line2,line3].join('\n'));
    ovMeta.textContent = `saved: ${LS_LAST} | queued: sessions=${sessionsQ.length} events=${eventsQ.length}`;
  }

  // ---------- boot overlay defaults ----------
  // show/hide practice button already done above
  updateHUD();
  // (wait for user tap)
}