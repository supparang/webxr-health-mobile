// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — ABC + AI Prediction Events (NO adaptive)
// PATCH v20260303-brush-ABC-AI-PRED-EVENTS
// ✅ Stage A/B/C
// ✅ Evidence 3 types (B)
// ✅ Quiz Analyze (C)
// ✅ AI Risk (prediction-only): emits brush:ai signals (risk/miss_streak/combo_hot/stage/quiz/boss/time)
// ✅ cVR aim assist + no double-shot + stable menu/end

(function(){
  'use strict';

  const WIN = window, DOC = document;
  const $ = (s)=>DOC.querySelector(s);

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1200);
  }

  function fatal(msg){
    const el = $('#fatal');
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('br-hidden');
  }
  WIN.addEventListener('error', (e)=>{
    fatal('JS ERROR:\n' + (e?.message||e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

  function getQS(){ try{ return new URL(location.href).searchParams; }catch(_){ return new URLSearchParams(); } }
  function ymdLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function getViewAuto(){
    const qs = getQS();
    const v = (qs.get('view')||'').toLowerCase();
    if(v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
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

  // ---------- DOM ----------
  const wrap = $('#br-wrap');
  const layer = $('#br-layer');
  const menu = $('#br-menu');
  const end = $('#br-end');
  const quiz = $('#br-quiz');

  const btnStart = $('#btnStart');
  const btnRetry = $('#btnRetry');
  const btnPause = $('#btnPause');
  const btnHow = $('#btnHow');
  const btnRecenter = $('#btnRecenter');

  const btnQuizSubmit = $('#btnQuizSubmit');
  const btnQuizSkip = $('#btnQuizSkip');
  const quizChoices = $('#quizChoices');

  const tStage = $('#tStage');
  const tScore = $('#tScore');
  const tCombo = $('#tCombo');
  const tMiss  = $('#tMiss');
  const tTime  = $('#tTime');

  const tClean = $('#tClean');
  const bClean = $('#bClean');
  const tFever = $('#tFever');
  const bFever = $('#bFever');

  const tEvi = $('#tEvi');
  const bEvi = $('#bEvi');

  const tRisk = $('#tRisk');
  const bRisk = $('#bRisk');
  const tTip  = $('#tTip');

  const ctxView = $('#br-ctx-view');
  const ctxSeed = $('#br-ctx-seed');
  const ctxTime = $('#br-ctx-time');
  const diffTag = $('#br-diffTag');
  const aiTag   = $('#br-aiTag');

  const mDiff = $('#mDiff');
  const mTime = $('#mTime');

  const sScore = $('#sScore');
  const sAcc   = $('#sAcc');
  const sMiss  = $('#sMiss');
  const sCombo = $('#sCombo');
  const sClean = $('#sClean');
  const sTime  = $('#sTime');
  const endGrade = $('#endGrade');
  const endNote  = $('#endNote');

  if(!wrap || !layer) throw new Error('BrushVR DOM missing (#br-wrap / #br-layer)');

  // ---------- ctx ----------
  const qs = getQS();
  const ctx = {
    hub: qs.get('hub') || '../hub.html',
    run: (qs.get('run')||qs.get('mode')||'play').toLowerCase(),
    view: getViewAuto(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    time: safeNum(qs.get('time'), 80),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: (qs.get('pid') || '').trim(),
    studyId: (qs.get('studyId') || '').trim(),
    phase: (qs.get('phase') || '').trim(),
    conditionGroup: (qs.get('conditionGroup') || '').trim(),
    ai: String(qs.get('ai','1')) !== '0',
    debug: safeNum(qs.get('debug'), 0) === 1
  };
  ctx.time = clamp(ctx.time, 30, 120);
  if(!['easy','normal','hard'].includes(ctx.diff)) ctx.diff = 'normal';

  wrap.dataset.view = ctx.view;
  wrap.dataset.state = 'menu';
  if(ctxView) ctxView.textContent = ctx.view;
  if(ctxSeed) ctxSeed.textContent = String((ctx.seed >>> 0));
  if(ctxTime) ctxTime.textContent = `${ctx.time}s`;
  if(diffTag) diffTag.textContent = ctx.diff;
  if(aiTag) aiTag.textContent = ctx.ai ? '1' : '0';
  if(mDiff) mDiff.textContent = ctx.diff;
  if(mTime) mTime.textContent = `${ctx.time}s`;

  const rng = seededRng(ctx.seed);

  // ---------- fun boost (optional) ----------
  const fun = WIN.HHA?.createFunBoost?.({
    seed: (qs.get('seed') || ctx.pid || 'brush'),
    baseSpawnMul: 1.0,
    waveCycleMs: 20000,
    feverThreshold: 18,
    feverDurationMs: 6800,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });
  let director = fun ? fun.tick() : { spawnMul:1, timeScale:1, wave:'calm', intensity:0, feverOn:false };

  // ---------- state ----------
  const S = {
    running:false,
    paused:false,
    ended:false,
    t0:0,

    // core
    score:0,
    combo:0,
    comboMax:0,
    miss:0,
    shots:0,
    hits:0,

    clean:0,
    cleanGainPerHit: 1.2,
    cleanLosePerMiss: 0.6,

    baseSpawnMs: 760,
    ttlMs: 1650,
    perfectWindowMs: 220,

    // boss
    bossEveryPct: 28,
    nextBossAt: 28,
    bossActive:false,

    // ABC
    stage:'A', // A/B/C
    eviTotal:0,
    eviNeed:3,
    eviFlags:{ sugar:0, night:0, no_brush:0 },
    quizDone:false,
    quizCorrect:false,

    // ai prediction cache
    aiRisk:0,
    aiTip:'—',
    aiRiskBand:'low',
    missStreak:0,
    lastAiEmit:0,

    // targets
    uid:0,
    targets:new Map()
  };

  // diff tuning
  (function tune(){
    if(ctx.diff==='easy'){
      S.baseSpawnMs = 900; S.ttlMs = 1950; S.perfectWindowMs = 260;
      S.cleanGainPerHit = 1.35; S.cleanLosePerMiss = 0.45;
    }else if(ctx.diff==='hard'){
      S.baseSpawnMs = 650; S.ttlMs = 1450; S.perfectWindowMs = 200;
      S.cleanGainPerHit = 1.05; S.cleanLosePerMiss = 0.75;
    }
  })();

  // ---------- ai predict (prediction-only) ----------
  function aiPredict(){
    const acc = (S.shots>0) ? (S.hits/S.shots) : 0;
    const missRate = (S.shots>0) ? (S.miss/S.shots) : 0;
    const combo = S.combo;
    const clean = S.clean/100;
    const evi = S.eviTotal/3;

    let risk = 0.33;
    risk += missRate * 0.58;
    risk += (acc<0.55 ? 0.18 : (acc>0.80 ? -0.08 : 0));
    risk += (combo===0 ? 0.10 : (combo>=6 ? -0.06 : -0.02));
    risk += (clean<0.35 ? 0.06 : (clean>0.75 ? -0.04 : 0));
    risk += (S.stage==='B' && evi<0.67 ? 0.06 : 0);

    risk = clamp(risk, 0, 1);

    let tip = 'เล็งให้ชัวร์ก่อนยิง';
    if(S.stage==='A') tip = 'A: กวาดให้ไว แต่ห้ามพลาดติด ๆ';
    if(S.stage==='B') tip = `B: เก็บหลักฐานให้ครบ 3 แบบ (ตอนนี้ ${S.eviTotal}/3)`;
    if(S.stage==='C') tip = 'C: ตอบ “วิเคราะห์” เพื่อรับโบนัส แล้วปิดเกม';

    if(risk>0.72) tip = 'ช้าลงนิด! เน้นยิงให้โดนก่อน แล้วค่อยเร่ง';
    else if(risk<0.35 && combo>=6) tip = 'กำลังดีมาก! รักษาคอมโบ แล้วเร่งสปีดได้';

    return