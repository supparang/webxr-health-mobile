// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR Engine — SAFE PATCH FULL (v20260223p5)
// ✅ FUN PACK P5:
//   (1) Boss Fake-out: Phase2 -> teleport + shield; must "break shield" before weakspot crit works
//   (2) Daily Mini-Missions (deterministic by local-day + pid): 3 missions + progress + end summary
//   (3) Optional HHA logger: ?log=1&api=... POST {kind:"events"| "sessions", rows:[...]}
// ✅ Public API: window.BrushVR { start, reset, showHow, togglePause }
// ✅ Boot integration: brush:prestart-reset, brush:gate-handshake, emits brush:start/brush:end/brush:ui
// ✅ Mobile/PC/cVR support (hha:shoot lock)
// ✅ Shots not double-counted (pointer vs hha:shoot)
// ✅ Summary/menu hardened

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__BRUSH_SAFE_LOADED__) return;
  WIN.__BRUSH_SAFE_LOADED__ = true;

  /* ---------------- util ---------------- */
  const $ = (s)=>DOC.querySelector(s);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b, Number(v)||a));
  const nowMs = ()=> (typeof performance!=='undefined' && performance.now ? performance.now() : Date.now());
  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }
  function safeNum(v, d=0){ v=Number(v); return Number.isFinite(v)?v:d; }
  function pct(n){ return Math.round(Number(n)||0) + '%'; }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  function isoDayLocal(){
    // deterministic per local day for Bangkok timezone (device local)
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da= String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  function hash32(str){
    // FNV-1a-ish fast hash (deterministic)
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function makeRng(seed){
    let s = (Number(seed)||Date.now()) >>> 0;
    return function(){
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ---------------- state ---------------- */
  let cfg = null, rng = Math.random;

  let root, layer, fxLayer, menu, end, tapStart;
  let btnStart, btnRetry, btnPause, btnHow, btnRecenter, tapBtn, btnBack, btnBackHub2;
  let toastEl, fatalEl;

  let tScore, tCombo, tMiss, tTime, tClean, tFever, bClean, bFever;
  let mDiff, mTime, ctxView, ctxSeed, ctxTime, diffTag;
  let sScore, sAcc, sMiss, sCombo, sClean, sTime, endGrade, endNote;

  let state = null;

  let rafId = 0;
  let tickTimer = 0;
  let spawnTimer = 0;
  let feverTimer = 0;

  let bootOnce = false;
  let boundOnce = false;
  let endLock = false;
  let lastShootAt = 0;

  const TARGETS = new Map();
  let targetSeq = 1;

  // Warmup Gate handshake (optional)
  let gate = { has:false, speed:1.0, assist:'off', tier:'', diffHint:0 };

  // Aim lock radius for hha:shoot selection
  let lockPxBase = 28;

  // Dynamic spawn interval
  let spawnMsCurrent = 850;

  // Combo streak boost
  let streak = { on:false, untilMs:0, level:0 };

  // Golden schedule + rush window
  let nextGoldAtMs = 0;
  let goldRushUntilMs = 0;

  // AI Coach (deterministic + rate-limited)
  const coach = { nextAtMs:0, minGapMs:2200, lastKey:'' };

  // Daily missions (deterministic)
  const missions = {
    day: '',
    list: [],
    progress: { goldHits:0, maxCombo:0, clean:0, bossCrit:0, miss:0 },
    done: [false,false,false],
    allDone:false,
    textLine:''
  };

  // Optional logger
  const logger = {
    enabled: false,
    endpoint: '',
    queueKey: 'HHA_BRUSH_QUEUE',
    sid: '',
    startedAt: 0,
    sentStart:false,
    allowRemote:true,
  };

  /* ---------------- config ---------------- */
  function readConfig(){
    const view = String(qs('view','mobile')).toLowerCase();
    const run  = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(qs('time','80'), 20, 300);
    const pid  = String(qs('pid','anon') || 'anon');
    const seed = safeNum(qs('seed', String(Date.now())), Date.now());
    const hub  = String(qs('hub','../hub.html') || '../hub.html');

    const base = ({
      easy:   { spawnMs: 1050, ttlMs: 2200, bossEvery: 9,  bossHp: 4, cleanGain: 8,  missClean: 1, maxTargets: 3 },
      normal: { spawnMs: 850,  ttlMs: 1800, bossEvery: 7,  bossHp: 5, cleanGain: 7,  missClean: 1, maxTargets: 4 },
      hard:   { spawnMs: 700,  ttlMs: 1500, bossEvery: 6,  bossHp: 6, cleanGain: 6,  missClean: 2, maxTargets: 5 },
    }[diff]) || { spawnMs: 850, ttlMs: 1800, bossEvery: 7, bossHp: 5, cleanGain: 7, missClean: 1, maxTargets: 4 };

    // logger (optional)
    const api = String(qs('api','') || '').trim();
    const log = String(qs('log','0') || '0').toLowerCase();
    const logOn = (log === '1' || log === 'true' || log === 'yes') && !!api;

    return { view, run, diff, time, pid, seed, hub, api, logOn, ...base };
  }

  /* ---------------- dom ---------------- */
  function cacheDom(){
    root      = $('#br-wrap');
    layer     = $('#br-layer');
    fxLayer   = $('#br-fx');
    menu      = $('#br-menu');
    end       = $('#br-end');
    tapStart  = $('#tapStart');
    toastEl   = $('#toast');
    fatalEl   = $('#fatal');

    btnStart    = $('#btnStart');
    btnRetry    = $('#btnRetry');
    btnPause    = $('#btnPause');
    btnHow      = $('#btnHow');
    btnRecenter = $('#btnRecenter');
    tapBtn      = $('#tapBtn');
    btnBack     = $('#btnBack');
    btnBackHub2 = $('#btnBackHub2');

    tScore = $('#tScore'); tCombo = $('#tCombo'); tMiss = $('#tMiss'); tTime = $('#tTime');
    tClean = $('#tClean'); tFever = $('#tFever'); bClean = $('#bClean'); bFever = $('#bFever');

    mDiff = $('#mDiff'); mTime = $('#mTime');
    ctxView = $('#br-ctx-view'); ctxSeed = $('#br-ctx-seed'); ctxTime = $('#br-ctx-time'); diffTag = $('#br-diffTag');

    sScore = $('#sScore'); sAcc = $('#sAcc'); sMiss = $('#sMiss'); sCombo = $('#sCombo');
    sClean = $('#sClean'); sTime = $('#sTime'); endGrade = $('#endGrade'); endNote = $('#endNote');
  }

  function setFatal(msg){
    try{
      if(!fatalEl) return;
      fatalEl.classList.remove('br-hidden');
      fatalEl.textContent = String(msg || 'Unknown error');
    }catch(_){}
  }

  function setUiMode(mode){
    try{ DOC.documentElement.dataset.brUi = mode; }catch(_){}
    try{ root && (root.dataset.state = mode); }catch(_){}

    if(menu){
      if(mode === 'menu'){
        menu.setAttribute('aria-hidden','false');
        menu.style.display = '';
      }else{
        menu.setAttribute('aria-hidden','true');
        menu.style.display = 'none';
      }
    }
    if(end){
      end.hidden = (mode !== 'end');
      end.style.display = (mode === 'end') ? '' : 'none';
    }

    emit('brush:ui', { mode });
  }

  function showToast(msg){
    if(!toastEl) return;
    toastEl.textContent = String(msg || '');
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toastEl && toastEl.classList.remove('show'), 1200);
  }

  /* ---------------- coach tips ---------------- */
  function coachTip(key, text, detail){
    try{
      if(!text) return;
      const t = nowMs();
      if(t < coach.nextAtMs) return;
      if(key && key === coach.lastKey) return;
      coach.lastKey = String(key || '');
      coach.nextAtMs = t + coach.minGapMs;

      const payload = {
        kind: 'coach',
        game: 'brush',
        ts: Date.now(),
        seed: cfg && cfg.seed,
        diff: cfg && cfg.diff,
        view: cfg && cfg.view,
        pid: cfg && cfg.pid,
        key: String(key || ''),
        msg: String(text || ''),
        ...(detail || {})
      };

      emit('hha:coach', payload);
      emit('brush:coach', payload);

      if(logger.enabled) logEvent('coach', { key: payload.key, msg: payload.msg });
    }catch(_){}
  }

  /* ---------------- logger ---------------- */
  function loggerInit(){
    logger.enabled = !!(cfg && cfg.logOn && cfg.api);
    logger.endpoint = (cfg && cfg.api) ? String(cfg.api) : '';
    logger.sid = `brush_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    logger.startedAt = Date.now();
    logger.sentStart = false;

    // allow remote latch (optional)
    logger.allowRemote = true;
  }

  function loadQueue(){
    try{
      const raw = localStorage.getItem(logger.queueKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }

  function saveQueue(arr){
    try{ localStorage.setItem(logger.queueKey, JSON.stringify(arr || [])); }catch(_){}
  }

  function enqueue(kind, row){
    if(!logger.enabled) return;
    const q = loadQueue();
    q.push({ kind:String(kind||'events'), row: row || {}, ts: Date.now() });
    if(q.length > 250) q.splice(0, q.length-250);
    saveQueue(q);
  }

  async function flushQueue(){
    if(!logger.enabled || !logger.allowRemote) return;
    const q = loadQueue();
    if(!q.length) return;

    // group by kind
    const groups = {};
    q.forEach(it=>{
      const k = String(it.kind || 'events');
      if(!groups[k]) groups[k] = [];
      groups[k].push(it.row);
    });

    // try post each group
    const remain = [];
    for(const k of Object.keys(groups)){
      const rows = groups[k];
      const ok = await postJson({ kind: k, rows });
      if(!ok){
        // keep unsent
        rows.forEach(r=> remain.push({ kind:k, row:r, ts:Date.now() }));
        // stop early to avoid spam
        break;
      }
    }
    saveQueue(remain);
  }

  async function postJson(body){
    try{
      const res = await fetch(logger.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if(res.status === 401 || res.status === 403){
        logger.allowRemote = false;
        return false;
      }
      if(!res.ok) return false;
      return true;
    }catch(_){
      return false;
    }
  }

  function logEvent(type, data){
    if(!logger.enabled) return;
    enqueue('events', {
      ts: new Date().toISOString(),
      game: 'brush',
      type: String(type||'event'),
      sid: logger.sid,
      pid: cfg.pid,
      diff: cfg.diff,
      view: cfg.view,
      seed: cfg.seed,
      data: data || {}
    });
  }

  function logSessionEnd(summary){
    if(!logger.enabled) return;
    enqueue('sessions', {
      ts: new Date().toISOString(),
      game: 'brush',
      sid: logger.sid,
      pid: cfg.pid,
      diff: cfg.diff,
      view: cfg.view,
      seed: cfg.seed,
      dur_s: safeNum(summary && summary.timeSpent, 0),
      score: safeNum(summary && summary.score, 0),
      miss: safeNum(summary && summary.miss, 0),
      acc: safeNum(summary && summary.accPct, 0),
      clean: safeNum(summary && summary.cleanPct, 0),
      maxCombo: safeNum(summary && summary.maxCombo, 0),
      grade: String(summary && summary.grade || ''),
      missionsDone: String(summary && summary.missionsDone || '')
    });
  }

  /* ---------------- game state ---------------- */
  function freshState(){
    return {
      started:false, ended:false, paused:false,
      timeTotal:Number(cfg.time),
      timeLeft:Number(cfg.time),

      score:0,
      combo:0,
      maxCombo:0,
      miss:0,
      hits:0,
      shots:0,
      cleanPct:0,

      feverOn:false,
      feverGauge:0,
      spawned:0,
      bossSpawned:0,

      startAtMs:0,
      endAtMs:0,
      lastTickAt:0,
    };
  }

  function resetAllRuntime(){
    stopLoops();
    TARGETS.forEach(t => { try{ t.el.remove(); }catch(_){} });
    TARGETS.clear();
    targetSeq = 1;
    if(layer){
      layer.innerHTML = '';
      layer.style.pointerEvents = '';
    }
    if(fxLayer){
      fxLayer.innerHTML = '';
    }
  }

  function stopLoops(){
    try{ if(rafId){ cancelAnimationFrame(rafId); rafId = 0; } }catch(_){}
    try{ if(tickTimer){ clearInterval(tickTimer); tickTimer = 0; } }catch(_){}
    try{ if(spawnTimer){ clearInterval(spawnTimer); spawnTimer = 0; } }catch(_){}
    try{ if(feverTimer){ clearTimeout(feverTimer); feverTimer = 0; } }catch(_){}
  }

  /* ---------------- ctx/hud ---------------- */
  function renderCtx(){
    if(!cfg) return;
    if(ctxView) ctxView.textContent = cfg.view;
    if(ctxSeed) ctxSeed.textContent = String(cfg.seed);
    if(ctxTime) ctxTime.textContent = String(cfg.time);
    if(diffTag) diffTag.textContent = cfg.diff;
    if(mDiff)   mDiff.textContent = cfg.diff;
    if(mTime)   mTime.textContent = String(cfg.time);

    try{ DOC.body.dataset.view = cfg.view; }catch(_){}
    try{ root && (root.dataset.view = cfg.view); }catch(_){}

    if(btnBack) btnBack.href = cfg.hub || '../hub.html';
    if(btnBackHub2) btnBackHub2.href = cfg.hub || '../hub.html';
  }

  function missionsText(){
    if(!missions.list.length) return '';
    const c = missions.done.map(d=> d ? '✅' : '⬜');
    return `M:${c[0]}${c[1]}${c[2]}`;
  }

  function renderHud(){
    if(!state) return;
    if(tScore) tScore.textContent = String(Math.round(state.score));
    if(tCombo) tCombo.textContent = String(Math.round(state.combo));
    if(tMiss)  tMiss.textContent  = String(Math.round(state.miss));
    if(tTime)  tTime.textContent  = String(Math.max(0, Math.ceil(state.timeLeft)));
    if(tClean) tClean.textContent = pct(state.cleanPct);

    if(tFever){
      const fever = state.feverOn ? 'ON' : 'OFF';
      const stk = streak.on ? ` | STREAK ${streak.level}` : '';
      const rush = (goldRushUntilMs > nowMs()) ? ' | GOLD RUSH' : '';
      const mis = missionsText();
      tFever.textContent = fever + stk + rush + (mis ? ` | ${mis}` : '');
    }

    if(bClean) bClean.style.width = clamp(state.cleanPct,0,100) + '%';
    if(bFever) bFever.style.width = clamp(state.feverGauge,0,100) + '%';

    // keep mission progress updated
    missions.progress.maxCombo = Math.max(missions.progress.maxCombo, state.maxCombo);
    missions.progress.clean = Math.max(missions.progress.clean, Math.round(state.cleanPct));
    missions.progress.miss = Math.round(state.miss);
    checkMissions();
  }

  /* ---------------- Warmup Gate apply ---------------- */
  function applyGateToCfg(){
    if(!cfg) return;
    const run = String(cfg.run || 'play').toLowerCase();
    const gateApply = String(qs('gateApply','') || '').trim();
    const shouldApply = (run === 'play') || (gateApply === '1' || gateApply.toLowerCase() === 'true');
    if(!gate.has || !shouldApply) return;

    const sp = clamp(gate.speed, 0.85, 1.25);
    cfg.spawnMs = Math.round(clamp(cfg.spawnMs / sp, 420, 1800));
    cfg.ttlMs   = Math.round(clamp(cfg.ttlMs / (0.92*sp + 0.08), 900, 4200));

    const a = String(gate.assist || 'off').toLowerCase();
    const add =
      (a === 'high') ? 34 :
      (a === 'med'  || a === 'mid') ? 22 :
      (a === 'low') ? 12 : 0;
    lockPxBase = clamp(28 + add, 22, 78);

    const dh = clamp(gate.diffHint, -1, 1);
    if(dh < 0){
      cfg.maxTargets = clamp(cfg.maxTargets - 1, 2, 6);
      cfg.bossEvery  = clamp(cfg.bossEvery + 1, 5, 14);
    }else if(dh > 0){
      cfg.maxTargets = clamp(cfg.maxTargets + 1, 2, 7);
      cfg.bossEvery  = clamp(cfg.bossEvery - 1, 4, 12);
    }
  }

  function bindGateEventsOnce(){
    if(bindGateEventsOnce._done) return;
    bindGateEventsOnce._done = true;

    WIN.addEventListener('brush:prestart-reset', ()=>{
      endLock = false;
      if(end){
        end.hidden = true;
        end.style.display = 'none';
      }
      setUiMode('menu');
    }, { passive:true });

    WIN.addEventListener('brush:gate-handshake', (ev)=>{
      const d = (ev && ev.detail) || {};
      gate.has = true;
      gate.speed = safeNum(d.gateSpeed, 1.0);
      gate.assist = String(d.gateAssist || d.gateAssistLevel || 'off');
      gate.tier = String(d.gateTier || '');
      gate.diffHint = safeNum(d.gateDiffHint, 0);

      applyGateToCfg();
      showToast(`Warmup Buff: speed×${gate.speed.toFixed(2)} assist=${gate.assist}`);
      coachTip('gate', `โหมดวอร์มอัป: speed×${gate.speed.toFixed(2)} assist=${gate.assist}`, { gate:{...gate} });
      logEvent('gate', { gate:{...gate} });
    }, { passive:true });
  }

  /* ---------------- missions (deterministic) ---------------- */
  function buildDailyMissions(){
    missions.day = isoDayLocal();
    missions.list = [];
    missions.done = [false,false,false];
    missions.allDone = false;
    missions.textLine = '';

    // deterministic RNG: day + pid
    const h = hash32(`${missions.day}|${cfg.pid}|brush`);
    const r = makeRng(h);

    // pick 3 missions from pool (deterministically)
    const pool = [
      { id:'gold2',   text:'ยิง ⭐ ให้ได้ 2 ครั้ง',               check:()=> missions.progress.goldHits >= 2 },
      { id:'combo12', text:'ทำคอมโบสูงสุดให้ถึง 12',              check:()=> missions.progress.maxCombo >= 12 },
      { id:'clean90', text:'ทำความสะอาดให้ถึง 90%',               check:()=> missions.progress.clean >= 90 },
      { id:'bosscrit2',text:'ยิงจุดอ่อนบอส (CRIT) ให้ได้ 2 ครั้ง',check:()=> missions.progress.bossCrit >= 2 },
      { id:'miss<=6', text:'พลาด (MISS) ไม่เกิน 6 ครั้ง',         check:()=> missions.progress.miss <= 6 && state && state.ended },
    ];

    // choose 3 unique
    const chosen = [];
    while(chosen.length < 3){
      const idx = Math.floor(r() * pool.length);
      const pick = pool[idx];
      if(!chosen.find(x=>x.id===pick.id)) chosen.push(pick);
    }

    missions.list = chosen;
    missions.textLine = `DAILY (${missions.day}): 1) ${chosen[0].text} | 2) ${chosen[1].text} | 3) ${chosen[2].text}`;
    coachTip('daily', 'ภารกิจวันนี้มาแล้ว! ดูที่มุม FEVER: M:⬜⬜⬜', { missions: chosen.map(x=>x.id) });
    logEvent('missions', { day: missions.day, ids: chosen.map(x=>x.id), texts: chosen.map(x=>x.text) });
  }

  function checkMissions(){
    if(!missions.list.length) return;
    for(let i=0;i<3;i++){
      if(missions.done[i]) continue;
      const ok = !!(missions.list[i] && missions.list[i].check && missions.list[i].check());
      if(ok){
        missions.done[i] = true;
        showToast(`MISSION ${i+1} สำเร็จ ✅`);
        coachTip('mission_done', `ภารกิจ ${i+1} สำเร็จ!`, { idx:i+1, id: missions.list[i].id });
        logEvent('mission_done', { idx:i+1, id: missions.list[i].id });
      }
    }
    missions.allDone = missions.done.every(Boolean);
    if(missions.allDone){
      coachTip('mission_all', 'ครบทุกภารกิจแล้ว! เก่งมาก 🔥', { all:true });
    }
  }

  /* ---------------- scoring & streak ---------------- */
  function scoreMult(){
    let m = 1.0;
    if(streak.on) m += 0.15 * clamp(streak.level, 1, 3);
    if(state && state.feverOn) m += 0.20;
    if(goldRushUntilMs > nowMs()) m += 0.15;
    return m;
  }

  function addScore(base, perfect, crit, gold){
    let s = Number(base)||0;
    if(perfect) s += 3;
    if(crit) s += 6;
    if(gold) s += 8;
    if(state.combo >= 5) s += 2;
    s = Math.round(s * scoreMult());
    state.score += s;
  }

  function addClean(n){
    state.cleanPct = clamp(state.cleanPct + n, 0, 100);
  }

  function decayCleanOnMiss(){
    state.cleanPct = clamp(state.cleanPct - cfg.missClean, 0, 100);
  }

  function setStreak(on, level){
    const was = streak.on;
    streak.on = !!on;
    streak.level = on ? clamp(level || streak.level || 1, 1, 3) : 0;
    streak.untilMs = on ? (nowMs() + 4200) : 0;

    if(streak.on !== was){
      if(streak.on){
        flashFx('flash');
        showToast(`STREAK x${streak.level} ⚡`);
        coachTip('streak', `คอมโบดีมาก! เข้า STREAK x${streak.level} แล้ว`, { streakLevel: streak.level });
        const f = 1 + 0.22 * streak.level;
        rescheduleSpawn(Math.round(cfg.spawnMs / f));
      }else{
        rescheduleSpawn(cfg.spawnMs);
      }
    }
  }

  function tryEnterStreak(){
    if(!state || !state.started || state.ended) return;
    if(state.combo >= 10 && !streak.on){
      const r = rng();
      const lvl = (r < 0.20) ? 3 : (r < 0.60 ? 2 : 1);
      setStreak(true, lvl);
    }
    if(streak.on) streak.untilMs = nowMs() + 3600;
  }

  function breakStreak(){
    if(streak.on) setStreak(false, 0);
  }

  function startGoldRush(){
    goldRushUntilMs = nowMs() + 3000;
    showToast('GOLD RUSH ✨');
    coachTip('goldrush', 'GOLD RUSH! ช่วงนี้รีบยิงให้ไว คะแนน/clean จะพุ่ง', { goldRush:true });
    logEvent('goldrush', { on:true });
  }

  /* ---------------- target logic ---------------- */
  function layerRect(){
    return layer ? layer.getBoundingClientRect() : {left:0,top:0,width:320,height:240};
  }

  function pickSpawnPos(size){
    const r = layerRect();
    const pad = Math.max(44, size * 0.7);
    const x = pad + (r.width - pad*2) * rng();
    const y = 70 + (r.height - (70 + pad) - pad) * rng();
    return { x, y };
  }

  function teleportTarget(t){
    if(!t || !t.el) return;
    const p = pickSpawnPos(t.isBoss ? 92 : 78);
    try{
      t.el.classList.add('teleport');
      t.el.style.left = p.x + 'px';
      t.el.style.top  = p.y + 'px';
      setTimeout(()=>{ try{ t.el.classList.remove('teleport'); }catch(_){} }, 220);
    }catch(_){}
  }

  function jitterWeakspot(el, intensity){
    try{
      const ws = el && el.querySelector && el.querySelector('.br-ws');
      if(!ws) return;
      const dx = (rng()*2 - 1) * intensity;
      const dy = (rng()*2 - 1) * intensity;
      ws.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }catch(_){}
  }

  function bossWeakspotHit(t, clientX, clientY){
    if(!t || !t.isBoss || !t.el) return false;
    const ws = t.el.querySelector('.br-ws');
    if(!ws) return false;
    const a = ws.getBoundingClientRect();
    return (clientX >= a.left && clientX <= a.right && clientY >= a.top && clientY <= a.bottom);
  }

  function makeTarget(kind){
    if(!layer || !state || !state.started || state.ended) return null;

    kind = kind || 'normal';
    const id = 't' + (targetSeq++);
    const isBoss = (kind === 'boss');
    const isGold = (kind === 'gold');
    const isRushGold = (kind === 'rushgold');

    const hpMax = isBoss ? cfg.bossHp : 1;
    const size = isBoss ? 92 : (isGold || isRushGold ? 74 : 78);

    const ttlBase = isBoss ? Math.round(cfg.ttlMs * 1.65) : cfg.ttlMs;
    const ttl = (isGold || isRushGold) ? Math.round(ttlBase * 0.78) : ttlBase;

    const p = pickSpawnPos(size);

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className =
      'br-t' +
      (isBoss ? ' thick' : '') +
      ((isGold || isRushGold) ? ' gold' : '') +
      (isRushGold ? ' rush' : '') +
      ' pop';

    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.dataset.hp = String(hpMax);
    el.dataset.hpMax = String(hpMax);
    el.dataset.spawnAt = String(nowMs());
    el.dataset.expireAt = String(nowMs() + ttl);

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = isBoss ? '💎' : ((isGold || isRushGold) ? '⭐' : '🦠');
    el.appendChild(emo);

    if(isBoss){
      const ws = DOC.createElement('div');
      ws.className = 'br-ws';
      const dx = (rng()*16 - 8);
      const dy = (rng()*16 - 8);
      ws.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      el.appendChild(ws);
    }

    if(hpMax > 1){
      const hp = DOC.createElement('div');
      hp.className = 'hp';
      hp.innerHTML = '<i></i>';
      el.appendChild(hp);
    }

    const t = {
      id, el, kind,
      isBoss, isGold, isRushGold,
      hp: hpMax, hpMax,
      bornAt: nowMs(),
      expireAt: nowMs() + ttl,
      removed: false,
      ttl,
      phase2: false,
      didTeleport: false,
      shieldOn: false,      // ✅ fake-out shield (phase2)
      shieldBroke: false,   // ✅ must break first
    };

    // ✅ pointer path counts shot once here
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      state.shots++;
      hitTargetCore(t, ev.clientX, ev.clientY);
    }, {passive:false});

    TARGETS.set(id, t);
    layer.appendChild(el);

    state.spawned++;
    if(isBoss) state.bossSpawned++;
    return t;
  }

  function updateTargetHpUI(t){
    if(!t || !t.el) return;
    t.el.dataset.hp = String(t.hp);
    const hpFill = t.el.querySelector('.hp i');
    if(hpFill){
      const w = clamp((t.hp / t.hpMax) * 100, 0, 100);
      hpFill.style.width = w + '%';
    }
    try{
      if(t.isBoss){
        t.el.classList.toggle('shield', !!t.shieldOn && !t.shieldBroke);
      }
    }catch(_){}
  }

  function removeTarget(t){
    if(!t || t.removed) return;
    t.removed = true;
    TARGETS.delete(t.id);
    try{
      t.el.classList.add('fade');
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 180);
    }catch(_){}
  }

  /* ---------------- fever ---------------- */
  function gainFever(n){
    state.feverGauge = clamp(state.feverGauge + n, 0, 100);
    if(!state.feverOn && state.feverGauge >= 100){
      state.feverOn = true;
      state.feverGauge = 100;
      showToast('FEVER ON 🔥');
      coachTip('fever', 'โหมด FEVER แล้ว! เน้น PERFECT ช่วงท้ายเป้า', { fever:true });
      logEvent('fever_on', {});
      clearTimeout(feverTimer);
      feverTimer = setTimeout(()=>{
        if(!state) return;
        state.feverOn = false;
        state.feverGauge = 0;
        renderHud();
        logEvent('fever_off', {});
      }, 7000);
    }
  }

  /* ---------------- hit logic ---------------- */
  function hitTargetCore(t, hitX, hitY){
    if(!state || !state.started || state.ended || state.paused) return;
    if(!t || t.removed) return;

    const rem = Math.max(0, t.expireAt - nowMs());
    const perfect = rem <= Math.min(420, t.ttl * 0.22);

    // GOLD / RUSH GOLD
    if(t.isGold || t.isRushGold){
      state.hits++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      missions.progress.goldHits += 1;

      const big = t.isGold;
      addScore(big ? 10 : 7, perfect, false, true);
      addClean(cfg.cleanGain + (big ? 16 : 10));
      gainFever(big ? 22 : 14);

      removeTarget(t);
      flashFx('shock');
      showToast(big ? 'GOLD! ⭐ +CLEAN' : 'RUSH ⭐');

      if(big) startGoldRush();
      tryEnterStreak();

      logEvent('hit_gold', { big, perfect });
      renderHud();
      checkEndConditions();
      return;
    }

    // BOSS
    if(t.isBoss){
      const critRaw = bossWeakspotHit(t, hitX, hitY);

      // Phase2 detection
      const phase2Now = (t.hp > 0 && t.hp <= Math.ceil(t.hpMax * 0.5));
      if(phase2Now && !t.phase2){
        t.phase2 = true;

        // ✅ fake-out: teleport + shield on
        t.shieldOn = true;
        t.shieldBroke = false;
        try{ t.el.classList.add('phase2'); }catch(_){}
        showToast('BOSS PHASE 2 ⚠');
        coachTip('boss_p2', 'บอสเข้า PHASE 2 แล้ว! ระวังวาร์ปหลอก + โล่หลอก', { bossPhase:2 });
        logEvent('boss_phase2', { hp:t.hp, hpMax:t.hpMax });

        if(!t.didTeleport){
          t.didTeleport = true;
          teleportTarget(t);
          coachTip('boss_tp', 'บอสวาร์ปหลอก! หาจังหวะยิงให้โล่แตกก่อน', { bossTeleport:true });
          logEvent('boss_teleport', {});
        }
      }

      // ✅ fake-out shield behavior:
      // - while shieldOn && !shieldBroke: CRIT does NOT give dmg=2; treat as normal 1 (or even 0 extra)
      // - first ANY hit breaks shield (visual hint)
      let crit = critRaw;
      let dmg = 1;

      if(t.shieldOn && !t.shieldBroke){
        // break shield on first hit
        t.shieldBroke = true;
        showToast('โล่บอสแตก! 🎯');
        coachTip('boss_shield_break', 'โล่แตกแล้ว! ตอนนี้ CRIT จะแรง', {});
        logEvent('boss_shield_break', {});
        // damage this hit is small
        crit = false;
        dmg = 1;
      }else{
        dmg = crit ? 2 : 1;
      }

      t.hp = Math.max(0, t.hp - dmg);

      if(crit){
        missions.progress.bossCrit += 1;
        try{
          t.el.classList.add('ws-hit');
          setTimeout(()=>{ try{ t.el.classList.remove('ws-hit'); }catch(_){ } }, 160);
        }catch(_){}
      }

      // phase2 weakspot jitter harder
      if(t.phase2){
        jitterWeakspot(t.el, crit ? 26 : 20);
      }

      updateTargetHpUI(t);

      if(t.hp <= 0){
        state.hits++;
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);

        addScore(12, perfect, crit, false);
        addClean(cfg.cleanGain + 8);
        gainFever(18);

        removeTarget(t);
        flashFx('shock');
        showToast(crit ? 'CRIT! 💎' : 'Boss แตก! 💎');

        logEvent('boss_kill', { crit, perfect });
      }else{
        addScore(2, false, crit, false);
        gainFever(6 + (crit?4:0));
        flashFx(crit ? 'flash' : 'laser');

        logEvent('boss_hit', { crit, dmg, hp:t.hp, shield: t.shieldOn && !t.shieldBroke });
      }

      tryEnterStreak();
      renderHud();
      checkEndConditions();
      return;
    }

    // NORMAL
    state.hits++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    addScore(5, perfect, false, false);
    addClean(cfg.cleanGain);
    gainFever(8);
    removeTarget(t);
    flashFx(perfect ? 'flash' : 'laser');

    logEvent('hit', { kind:'normal', perfect });

    tryEnterStreak();
    renderHud();
    checkEndConditions();
  }

  function hitByScreenPoint(clientX, clientY){
    if(!state || !state.started || state.ended || state.paused) return;

    // ✅ screen shoot counts shot once here
    state.shots++;

    const lockPx = lockPxBase;
    let best = null, bestD = 1e9;

    TARGETS.forEach((t)=>{
      if(!t || t.removed) return;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = cx - clientX, dy = cy - clientY;
      const d = Math.hypot(dx, dy);
      if(d < bestD){
        bestD = d; best = t;
      }
    });

    if(best && bestD <= lockPx + (best.isBoss ? 18 : 8)){
      hitTargetCore(best, clientX, clientY);
      return;
    }

    // miss
    state.miss++;
    state.combo = 0;
    decayCleanOnMiss();
    breakStreak();

    logEvent('miss', {});

    if(state.miss === 1 || (state.miss % 4 === 0)){
      coachTip('miss', 'พลาดแล้ว! ลองยิงใกล้กึ่งกลางเป้ามากขึ้น หรือรอให้เป้าเข้าใกล้กากบาท', { miss: state.miss });
    }

    renderHud();
  }

  function expireTargets(){
    const tNow = nowMs();
    TARGETS.forEach((t)=>{
      if(t.removed) return;
      if(tNow >= t.expireAt){
        state.miss++;
        state.combo = 0;
        decayCleanOnMiss();
        breakStreak();

        logEvent('expire', { kind: t.kind });

        if(state.miss % 5 === 0){
          coachTip('expire', 'เป้าหมดเวลา! พยายามจัดลำดับ: ยิงเป้าที่ใกล้หมดเวลาก่อน', { miss: state.miss });
        }
        removeTarget(t);
      }
    });
  }

  function scheduleNextGold(){
    const base = 9800;
    const jitter = 2600 * rng();
    nextGoldAtMs = nowMs() + base + jitter;
  }

  function maybeSpawnGold(){
    if(!state || !state.started || state.ended || state.paused) return;
    if(TARGETS.size >= cfg.maxTargets) return;

    const tNow = nowMs();
    if(!nextGoldAtMs) scheduleNextGold();
    if(tNow >= nextGoldAtMs){
      makeTarget('gold');
      scheduleNextGold();
      logEvent('spawn_gold', {});
    }
  }

  function maybeSpawnRushGold(){
    if(!state || !state.started || state.ended || state.paused) return false;
    if(TARGETS.size >= cfg.maxTargets) return false;

    if(goldRushUntilMs > nowMs()){
      const p = 0.38;
      if(rng() < p){
        makeTarget('rushgold');
        logEvent('spawn_rushgold', {});
        return true;
      }
    }
    return false;
  }

  function maybeSpawn(){
    if(!state || !state.started || state.ended || state.paused) return;

    maybeSpawnGold();

    if(TARGETS.size >= cfg.maxTargets) return;

    if(maybeSpawnRushGold()) return;

    const shouldBoss = (state.spawned > 0 && state.spawned % cfg.bossEvery === 0);
    makeTarget(shouldBoss ? 'boss' : 'normal');
    logEvent('spawn', { kind: shouldBoss ? 'boss' : 'normal' });
  }

  /* ---------------- fx ---------------- */
  function ensureFx(kind){
    if(!fxLayer) return null;
    let el = fxLayer.querySelector('.fx-' + kind);
    if(el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-' + kind;
    fxLayer.appendChild(el);
    return el;
  }
  function flashFx(kind){
    const k = (kind === 'shock' || kind === 'flash' || kind === 'laser' || kind === 'fin') ? kind : 'flash';
    const el = ensureFx(k);
    if(!el) return;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    const dur = (k === 'laser') ? 1300 : (k === 'shock' ? 400 : 180);
    setTimeout(()=>{ try{ el.classList.remove('on'); }catch(_){ } }, dur);
  }

  /* ---------------- loop ---------------- */
  function tick(){
    if(!state || !state.started || state.ended || state.paused) return;

    const t = Date.now();
    if(!state.lastTickAt) state.lastTickAt = t;
    const dt = Math.max(0, (t - state.lastTickAt) / 1000);
    state.lastTickAt = t;

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    expireTargets();

    if(!state.feverOn && state.feverGauge > 0){
      state.feverGauge = Math.max(0, state.feverGauge - dt * 3.5);
    }

    if(streak.on && nowMs() >= streak.untilMs){
      setStreak(false, 0);
    }

    // late-game tip
    if(state.timeLeft <= 10 && state.timeLeft >= 9.5){
      const acc = state.shots > 0 ? (state.hits/state.shots) : 0;
      if(state.cleanPct < 85){
        coachTip('late', 'ใกล้หมดเวลา! เล็งเป้าที่ใกล้หมดเวลาก่อน + อย่าพลาด miss จะกิน clean', { timeLeft: state.timeLeft, clean: state.cleanPct, acc: Math.round(acc*100) });
      }
    }

    renderHud();
    checkEndConditions();

    // try flush queue occasionally
    if(logger.enabled && (Math.floor(Date.now()/3000) % 2 === 0)){
      flushQueue();
    }
  }

  function frame(){
    if(!state || !state.started || state.ended) return;
    rafId = requestAnimationFrame(frame);
  }

  function rescheduleSpawn(ms){
    const next = Math.round(clamp(ms, 380, 1800));
    if(next === spawnMsCurrent) return;
    spawnMsCurrent = next;
    try{ if(spawnTimer){ clearInterval(spawnTimer); spawnTimer = 0; } }catch(_){}
    spawnTimer = setInterval(maybeSpawn, spawnMsCurrent);
  }

  function startLoops(){
    stopLoops();
    state.lastTickAt = Date.now();
    tickTimer = setInterval(tick, 100);

    spawnMsCurrent = cfg.spawnMs;
    spawnTimer = setInterval(maybeSpawn, spawnMsCurrent);

    rafId = requestAnimationFrame(frame);
  }

  /* ---------------- end/summary ---------------- */
  function gradeFromScore(acc, clean, timeSpent){
    if(clean >= 100 && acc >= 75 && timeSpent <= cfg.time * 0.8) return 'A';
    if(clean >= 100 && acc >= 55) return 'B';
    if(clean >= 80) return 'C';
    return 'D';
  }

  function buildSummary(reason){
    const timeSpent = Math.max(0, cfg.time - state.timeLeft);
    const acc = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;
    const grade = gradeFromScore(acc, state.cleanPct, timeSpent);
    const timeText = timeSpent.toFixed(1) + 's';

    let msg = '-';
    if(reason === 'clean') msg = 'ALMOST!';
    if(reason === 'timeout' && state.cleanPct >= 70) msg = 'เกือบผ่านแล้ว!';
    if(reason === 'timeout' && state.cleanPct < 70) msg = 'ลองจัดลำดับเป้าหมายให้แม่นขึ้น 💪';

    const meta = `reason=${reason} | seed=${cfg.seed} | diff=${cfg.diff} | view=${cfg.view} | pid=${cfg.pid}`;
    const missionLine = missions.textLine ? `\n${missions.textLine}\nDONE: ${missions.done.map(d=>d?'1':'0').join('')}` : '';
    const note = `${msg}\n${meta}${missionLine}`;

    return {
      reason: String(reason || 'timeout'),
      score: Math.round(state.score),
      miss: Math.round(state.miss),
      hits: Math.round(state.hits),
      shots: Math.round(state.shots),
      maxCombo: Math.round(state.maxCombo),
      cleanPct: Math.round(state.cleanPct),
      accPct: acc,
      timeText,
      timeSpent,
      grade,
      note,
      missionsDone: missions.done.map(d=>d?'1':'0').join('')
    };
  }

  function fillSummaryUI(sum){
    if(!sum) return;
    sScore && (sScore.textContent = String(sum.score));
    sAcc && (sAcc.textContent = sum.accPct + '%');
    sMiss && (sMiss.textContent = String(sum.miss));
    sCombo && (sCombo.textContent = String(sum.maxCombo));
    sClean && (sClean.textContent = pct(sum.cleanPct));
    sTime && (sTime.textContent = sum.timeText);
    endGrade && (endGrade.textContent = sum.grade);
    endNote && (endNote.textContent = sum.note);
  }

  function endGame(reason){
    if(!state || !state.started) return;
    if(state.ended || endLock) return;

    endLock = true;
    state.ended = true;
    state.endAtMs = Date.now();

    stopLoops();
    TARGETS.forEach(t => { try{ t.el.style.pointerEvents='none'; }catch(_){ } });

    // mission final checks
    renderHud();
    checkMissions();

    const sum = buildSummary(reason || 'timeout');
    fillSummaryUI(sum);

    setUiMode('end');

    emit('brush:end', sum);

    logEvent('end', { reason: sum.reason, score: sum.score, clean: sum.cleanPct, acc: sum.accPct, miss: sum.miss, missions: sum.missionsDone });
    logSessionEnd(sum);
    flushQueue();

    setTimeout(()=>{ endLock = false; }, 80);
  }

  function checkEndConditions(){
    if(!state || !state.started || state.ended) return;
    if(state.cleanPct >= 100){
      endGame('clean');
      return;
    }
    if(state.timeLeft <= 0){
      endGame('timeout');
      return;
    }
  }

  /* ---------------- controls ---------------- */
  function startGame(){
    applyGateToCfg();
    resetAllRuntime();

    state = freshState();
    state.started = true;
    state.startAtMs = Date.now();

    streak.on = false; streak.level = 0; streak.untilMs = 0;
    nextGoldAtMs = 0;
    goldRushUntilMs = 0;
    scheduleNextGold();

    coach.nextAtMs = 0;
    coach.lastKey = '';

    // missions per day+pid
    buildDailyMissions();

    renderHud();
    setUiMode('play');

    if(tapStart) tapStart.style.display = 'none';
    if(btnPause) btnPause.textContent = 'Pause';

    // logger session start
    loggerInit();
    if(logger.enabled){
      logEvent('start', { day: missions.day, missions: missions.list.map(x=>x.id) });
      flushQueue();
    }

    startLoops();
    maybeSpawn();
    showToast('เริ่มแปรง! 🪥');

    emit('brush:start', { ts: Date.now(), seed: cfg.seed, diff: cfg.diff, view: cfg.view, pid: cfg.pid });
    coachTip('start', 'เริ่มแล้ว! ยิงให้ไว + อย่าพลาด miss (มันกิน clean)', {});
  }

  function retryGame(){
    if(end){ end.hidden = true; end.style.display='none'; }
    startGame();
  }

  function resetGame(){
    endLock = false;
    stopLoops();
    resetAllRuntime();
    state = freshState();

    streak.on = false; streak.level = 0; streak.untilMs = 0;
    nextGoldAtMs = 0;
    goldRushUntilMs = 0;

    missions.day = '';
    missions.list = [];
    missions.done = [false,false,false];
    missions.allDone = false;
    missions.textLine = '';

    renderHud();
    setUiMode('menu');
    showToast('พร้อมเริ่มใหม่');
  }

  function togglePause(){
    if(!state || !state.started || state.ended) return;
    state.paused = !state.paused;
    if(btnPause) btnPause.textContent = state.paused ? 'Resume' : 'Pause';
    showToast(state.paused ? 'พักเกม ⏸' : 'เล่นต่อ ▶');
    if(!state.paused) state.lastTickAt = Date.now();
    logEvent('pause', { paused: state.paused });
  }

  function showHow(){
    const lines = [
      'วิธีเล่น BrushVR',
      '• แตะ/ยิง 🦠 ให้ทัน (อย่าพลาด MISS)',
      '• ⭐ GOLD = clean+score พุ่ง + เปิด GOLD RUSH 3 วิ',
      '• 💎 BOSS เข้า PHASE2: วาร์ปหลอก + โล่หลอก (ต้องยิงให้โล่แตกก่อน)',
      `• Daily Missions: ดูที่ FEVER -> ${missionsText() || 'M:⬜⬜⬜'}`
    ];
    showToast(lines[1]);
    alert(lines.join('\n'));
  }

  function doRecenter(){
    emit('hha:recenter', { source:'brush' });
    showToast('Recenter 🎯');
  }

  function maybeRequireTapStart(){
    const isMobileLike = /android|iphone|ipad|mobile/i.test(navigator.userAgent) || cfg.view === 'mobile' || cfg.view === 'cvr';
    if(tapStart && isMobileLike){
      tapStart.style.display = '';
      return true;
    }
    return false;
  }

  function onTapUnlock(){
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(AC){
        if(!WIN.__brAudioCtx) WIN.__brAudioCtx = new AC();
        if(WIN.__brAudioCtx && WIN.__brAudioCtx.state === 'suspended'){
          WIN.__brAudioCtx.resume().catch(()=>{});
        }
      }
    }catch(_){}
    if(tapStart) tapStart.style.display = 'none';
    startGame();
  }

  /* ---------------- bind ---------------- */
  function bindOnce(el, evt, fn, opts){
    if(!el) return;
    const key = '__b_' + evt;
    if(el[key]) return;
    el[key] = true;
    el.addEventListener(evt, fn, opts || false);
  }

  function bindAll(){
    if(boundOnce) return;
    boundOnce = true;

    bindOnce(btnStart, 'click', ()=>{
      if(tapStart && tapStart.style.display !== 'none') return;
      startGame();
    });

    bindOnce(btnRetry, 'click', ()=> retryGame());
    bindOnce(btnPause, 'click', ()=> togglePause());
    bindOnce(btnHow, 'click', ()=> showHow());
    bindOnce(btnRecenter, 'click', ()=> doRecenter());
    bindOnce(tapBtn, 'click', ()=> onTapUnlock());

    // receive shoot from vr-ui
    bindOnce(WIN, 'hha:shoot', (ev)=>{
      if(!state || !state.started || state.ended || state.paused) return;

      const d = (ev && ev.detail) || {};
      const tNow = nowMs();
      const cooldownMs = clamp(d.cooldownMs ?? 90, 20, 500);
      if(tNow - lastShootAt < cooldownMs) return;
      lastShootAt = tNow;

      const x = safeNum(d.x, WIN.innerWidth/2);
      const y = safeNum(d.y, WIN.innerHeight/2);
      hitByScreenPoint(x, y);
    });

    bindOnce(DOC, 'keydown', (ev)=>{
      if(ev.code === 'Escape'){
        togglePause();
      }
    });

    bindGateEventsOnce();

    // flush on pagehide
    bindOnce(WIN, 'pagehide', ()=>{ try{ flushQueue(); }catch(_){} }, {passive:true});
  }

  /* ---------------- init/export ---------------- */
  function initBrushGame(){
    if(bootOnce) return;
    bootOnce = true;

    try{
      cfg = readConfig();
      rng = makeRng(cfg.seed);
      cacheDom();
      if(!root || !layer || !menu || !end){
        throw new Error('BrushVR DOM missing (#br-wrap/#br-layer/#br-menu/#br-end)');
      }

      // optional: gate from QS
      const gateSpeedQS = safeNum(qs('gateSpeed',''), NaN);
      const gateAssistQS = String(qs('gateAssist','') || '').trim();
      const gateDiffHintQS = safeNum(qs('gateDiffHint',''), NaN);
      if(Number.isFinite(gateSpeedQS) || gateAssistQS || Number.isFinite(gateDiffHintQS)){
        gate.has = true;
        if(Number.isFinite(gateSpeedQS)) gate.speed = gateSpeedQS;
        if(gateAssistQS) gate.assist = gateAssistQS;
        if(Number.isFinite(gateDiffHintQS)) gate.diffHint = gateDiffHintQS;
      }

      applyGateToCfg();
      renderCtx();

      state = freshState();
      renderHud();
      resetAllRuntime();
      setUiMode('menu');
      bindAll();

      maybeRequireTapStart();

      // debug
      WIN.__BRUSH_STATE__ = ()=> state;
      WIN.__BRUSH_CFG__ = cfg;

    }catch(err){
      console.error('[BrushVR] init error', err);
      setFatal('JS ERROR:\n' + (err.stack || err.message || String(err)));
    }
  }

  // Public API for boot.js
  WIN.BrushVR = WIN.BrushVR || {};
  WIN.BrushVR.start = function(){ try{ initBrushGame(); startGame(); return true; }catch(_){ return false; } };
  WIN.BrushVR.reset = function(){ try{ initBrushGame(); resetGame(); return true; }catch(_){ return false; } };
  WIN.BrushVR.showHow = function(){ try{ showHow(); return true; }catch(_){ return false; } };
  WIN.BrushVR.togglePause = function(){ try{ togglePause(); return true; }catch(_){ return false; } };

  // compat exports
  WIN.initBrushGame = initBrushGame;
  WIN.__brushInit = initBrushGame;

  // auto init on DOM ready
  function autoInit(){ try{ initBrushGame(); }catch(_){ } }
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', autoInit, { once:true });
  }else{
    autoInit();
  }

})();