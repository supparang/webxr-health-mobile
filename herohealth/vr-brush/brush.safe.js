// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — ABC + AI Prediction (NO adaptive) + Boss 2 Phase + cVR aim assist + Quiz + Badges
// PATCH v20260305-BRUSH-SAFE-FULL-ABC-AI-ML-BOSS2
// ✅ Stage A/B/C
// ✅ Evidence 3 types in B (🍬 🌙 🚫🪥)
// ✅ Quiz Analyze in C (must answer/skip before finish)
// ✅ Boss 2 Phase: Phase1 shield -> Phase2 weakspot
// ✅ AI Risk prediction-only: brush:ai events + HUD risk/tip (no adaptive difficulty)
// ✅ cVR: uses hha:shoot aim assist (dynamic lockPx) + no double-shot count
// ✅ Stable menu/end overlays + badges on summary
// ✅ Mobile: body.br-noscroll while playing/quiz
// ✅ Optional ML snapshot: if window.BrushML exists, calls snapshot() once per ~1s (prediction-only)

(function(){
  'use strict';

  const WIN = window, DOC = document;
  const $ = (s)=>DOC.querySelector(s);

  // -------------------------
  // helpers
  // -------------------------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const safeNum = (x,d=0)=>{ const n=Number(x); return Number.isFinite(n)?n:d; };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

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

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }

  // toast/fatal
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

  // -------------------------
  // DOM refs (must exist)
  // -------------------------
  const wrap = $('#br-wrap');
  const layer = $('#br-layer');
  const menu = $('#br-menu');
  const end  = $('#br-end');
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

  // -------------------------
  // context
  // -------------------------
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

  // -------------------------
  // fun boost (optional)
  // -------------------------
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

  // -------------------------
  // state
  // -------------------------
  const S = {
    running:false,
    paused:false,
    ended:false,
    t0:0,

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

    bossEveryPct: 28,
    nextBossAt: 28,
    bossActive:false,

    // Boss 2 phase
    bossPhase: 1,       // 1 shield, 2 weakspot
    bossShield: 0,
    bossShieldMax: 0,

    // ABC
    stage:'A',
    eviTotal:0,
    eviNeed:3,
    eviFlags:{ sugar:0, night:0, no_brush:0 },
    quizOpen:false,
    quizDone:false,
    quizCorrect:false,

    // ai prediction cache
    aiRisk:0,
    aiTip:'—',
    aiBand:'low',
    missStreak:0,
    lastAiEmit:0,

    // ml snapshot throttle
    mlLast:0,

    uid:0,
    targets:new Map(), // id -> target
    lastHud:0
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

  // -------------------------
  // AI prediction (NO adaptive)
  // -------------------------
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
    risk += (S.stage==='C' && !S.quizDone ? 0.06 : 0);
    risk = clamp(risk, 0, 1);

    let band='low';
    if(risk>=0.68) band='high';
    else if(risk>=0.45) band='mid';

    let tip='เล็งให้ชัวร์ก่อนยิง';
    if(S.stage==='A') tip='A: กวาดให้ไว แต่ห้ามพลาดติด ๆ';
    if(S.stage==='B') tip=`B: เก็บหลักฐานให้ครบ 3 แบบ (ตอนนี้ ${S.eviTotal}/3)`;
    if(S.stage==='C') tip='C: ตอบ Quiz “วิเคราะห์” เพื่อปิดเกม';

    if(risk>0.72) tip='ช้าลงนิด! เน้นยิงให้โดนก่อน แล้วค่อยเร่ง';
    else if(risk<0.35 && combo>=6) tip='กำลังดีมาก! รักษาคอมโบ แล้วเร่งสปีดได้';

    return { risk, band, tip, acc, missRate };
  }

  function aiEmit(type, detail){
    if(!ctx.ai) return;
    try{
      WIN.dispatchEvent(new CustomEvent('brush:ai', {
        detail: Object.assign({ type }, detail||{})
      }));
    }catch(_){}
  }

  function aiTick(force){
    if(!ctx.ai) return;
    const t = Date.now();
    if(!force && (t - S.lastAiEmit) < 520) return;
    S.lastAiEmit = t;

    const p = aiPredict();
    S.aiRisk = p.risk;
    S.aiBand = p.band;
    S.aiTip = p.tip;

    aiEmit('risk', {
      risk:p.risk, band:p.band, tip:p.tip,
      stage:S.stage, combo:S.combo, missStreak:S.missStreak
    });
  }

  function onMissStreak(){
    if(!ctx.ai) return;
    if(S.missStreak === 2) aiEmit('miss_streak', { n:2, band:S.aiBand });
    if(S.missStreak === 4) aiEmit('miss_streak', { n:4, band:'high' });
  }

  function onComboHot(){
    if(!ctx.ai) return;
    if(S.combo === 6) aiEmit('combo_hot', { combo:6 });
    if(S.combo === 10) aiEmit('combo_hot', { combo:10 });
  }

  // -------------------------
  // HUD render
  // -------------------------
  function renderHud(force){
    const t = now();
    if(!force && (t - S.lastHud) < 70) return;
    S.lastHud = t;

    const elapsed = S.running ? ((t - S.t0)/1000) : 0;
    const left = S.running ? Math.max(0, ctx.time - elapsed) : ctx.time;

    if(tStage) tStage.textContent = S.stage;
    if(tScore) tScore.textContent = String(S.score);
    if(tCombo) tCombo.textContent = String(S.combo);
    if(tMiss)  tMiss.textContent  = String(S.miss);
    if(tTime)  tTime.textContent  = left.toFixed(0);

    const clean = clamp(S.clean, 0, 100);
    if(tClean) tClean.textContent = `${Math.round(clean)}%`;
    if(bClean) bClean.style.width = `${clean}%`;

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pctF = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if(bFever) bFever.style.width = `${pctF}%`;

    const ePct = clamp((S.eviTotal / S.eviNeed) * 100, 0, 100);
    if(tEvi) tEvi.textContent = `${S.eviTotal}/${S.eviNeed}`;
    if(bEvi) bEvi.style.width = `${ePct}%`;

    const rPct = clamp(S.aiRisk * 100, 0, 100);
    if(tRisk) tRisk.textContent = `${Math.round(rPct)}%`;
    if(bRisk) bRisk.style.width = `${rPct}%`;
    if(tTip)  tTip.textContent = S.aiTip || '—';
  }

  function layerRect(){ return layer.getBoundingClientRect(); }
  function randomInLayer(pad=56){
    const r = layerRect();
    return {
      x: pad + rng() * Math.max(10, (r.width - pad*2)),
      y: pad + rng() * Math.max(10, (r.height - pad*2))
    };
  }

  // -------------------------
  // Targets
  // -------------------------
  function mkEvidenceType(){
    const pool = ['sugar','night','no_brush'];
    const missing = pool.filter(k => !S.eviFlags[k]);
    const pickFrom = missing.length ? missing : pool;
    return pickFrom[Math.floor(rng()*pickFrom.length)];
  }

  function eviEmoji(k){
    if(k==='sugar') return '🍬';
    if(k==='night') return '🌙';
    return '🚫🪥';
  }

  function updateBossWeakspotPos(t){
    if(!t || t.type !== 'boss' || !t.wsEl) return;
    const ang = rng() * Math.PI * 2;
    const rr = 14 + rng()*12;
    t.weakX = Math.cos(ang) * rr;
    t.weakY = Math.sin(ang) * rr;
    t.weakR = 14;
    t.wsEl.style.left = `calc(50% + ${t.weakX}px)`;
    t.wsEl.style.top  = `calc(50% + ${t.weakY}px)`;
  }

  function mkTarget({x,y,type,hpMax,eviType=null}){
    const id = String(++S.uid);
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'br-t' + (type==='boss' ? ' thick' : '') + (type==='evi' ? ' evi' : '');
    el.dataset.id = id;
    el.dataset.kind = type;
    if(eviType) el.dataset.evi = eviType;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent =
      (type==='boss') ? '💎' :
      (type==='evi')  ? eviEmoji(eviType) :
      '🦠';
    el.appendChild(emo);

    const hp = DOC.createElement('div');
    hp.className = 'hp';
    const fill = DOC.createElement('i');
    hp.appendChild(fill);
    el.appendChild(hp);

    let wsEl=null, weakX=0, weakY=0, weakR=14;
    if(type==='boss'){
      wsEl = DOC.createElement('div');
      wsEl.className = 'br-ws';
      el.appendChild(wsEl);
      // phase1: hide weakspot hint until phase2
      wsEl.style.opacity = '0';
    }

    const born = now();
    const ttl = S.ttlMs * (director.timeScale || 1);
    const die  = born + ttl;

    const t = { id, el, type, bornMs:born, dieMs:die, hpMax, hp:hpMax, fillEl:fill, wsEl, weakX, weakY, weakR, eviType };
    if(type==='boss'){
      // weakspot position will be used in phase2
      updateBossWeakspotPos(t);
    }

    S.targets.set(id, t);
    el.addEventListener('pointerdown', onTargetPointerDown, { passive:false });
    layer.appendChild(el);
    updateHpVis(t);
    return t;
  }

  function updateHpVis(t){
    if(!t || !t.fillEl) return;
    const pct = clamp((t.hp / t.hpMax) * 100, 0, 100);
    t.fillEl.style.width = pct + '%';
  }

  function removeTarget(id, popped){
    const t = S.targets.get(id);
    if(!t) return;
    S.targets.delete(id);
    const el = t.el;
    if(!el) return;
    if(popped) el.classList.add('pop');
    el.classList.add('fade');
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
  }

  function pointInBossWeakspot(t, x, y){
    if(!t || t.type !== 'boss' || !t.el) return false;
    const r = t.el.getBoundingClientRect();
    const cx = r.left + r.width*0.5 + (t.weakX||0);
    const cy = r.top  + r.height*0.5 + (t.weakY||0);
    const rr = Math.max(10, t.weakR || 14);
    const dx = x - cx, dy = y - cy;
    return (dx*dx + dy*dy) <= rr*rr;
  }

  // -------------------------
  // Stage rules (ABC)
  // -------------------------
  function stageFromProgress(){
    if(S.clean < 40) return 'A';
    if(S.clean < 80) return 'B';
    return 'C';
  }

  function advanceStageIfNeeded(){
    const want = stageFromProgress();
    if(want !== S.stage){
      S.stage = want;
      toast(`เข้าสู่ Stage ${S.stage}`);
      aiEmit('stage', { stage:S.stage, clean:S.clean, evi:S.eviTotal });
    }
  }

  function canFinishC(){
    if(S.stage !== 'C') return true;
    return !!S.quizDone;
  }

  function openQuiz(){
    if(!quiz){ S.quizDone = true; return; }
    if(S.quizOpen || S.quizDone) return;
    S.quizOpen = true;
    quiz.hidden = false;
    wrap.dataset.state = 'quiz';
    DOC.body.classList.add('br-noscroll');
    aiEmit('quiz', { state:'open' });
    toast('C: ตอบคำถามวิเคราะห์!');
  }

  function closeQuiz(){
    if(!quiz) return;
    S.quizOpen = false;
    quiz.hidden = true;
    wrap.dataset.state = 'play';
    DOC.body.classList.add('br-noscroll'); // still playing
    aiEmit('quiz', { state:'close', done:S.quizDone, correct:S.quizCorrect });
  }

  // -------------------------
  // scoring / rewards
  // -------------------------
  function onPerfect(){
    fun?.onAction?.({ type:'perfect' });
    S.score += 2;
    toast('✨ Perfect!');
  }

  function applyHitRewards(t, remainMs, weakHit){
    S.hits += 1;

    if(remainMs <= S.perfectWindowMs) onPerfect();
    else fun?.onAction?.({ type:'hit' });

    S.combo += 1;
    S.comboMax = Math.max(S.comboMax, S.combo);
    onComboHot();

    const comboMul = 1 + Math.min(0.6, S.combo * 0.02);

    let base = (t.type==='boss') ? 3 : (t.type==='evi' ? 2 : 1);
    if(weakHit) base += 2;

    // quiz bonus in C
    if(S.stage==='C' && S.quizDone && S.quizCorrect) base += 1;

    S.score += Math.round(base * comboMul * (director.feverOn ? 1.25 : 1.0));

    let gain = S.cleanGainPerHit * (t.type==='boss' ? 1.35 : 1.0) * (director.feverOn ? 1.18 : 1.0);
    if(t.type==='evi') gain *= 0.85;
    if(weakHit) gain *= 1.22;

    // Stage B gate: if not enough evidence, slow crossing 80
    if(S.stage==='B' && S.eviTotal < S.eviNeed && S.clean >= 79){
      gain *= 0.18;
    }

    S.clean = clamp(S.clean + gain, 0, 100);

    // evidence collect
    if(t.type==='evi' && t.eviType){
      if(!S.eviFlags[t.eviType]){
        S.eviFlags[t.eviType] = 1;
        S.eviTotal = clamp(S.eviTotal + 1, 0, S.eviNeed);
        toast(`หลักฐาน +1 (${S.eviTotal}/3)`);
        aiEmit('evidence', { eviType:t.eviType, total:S.eviTotal });
      }else{
        toast('หลักฐานซ้ำ (ไม่นับเพิ่ม)');
      }
    }

    // fever fantasy: sometimes auto-pop one plaque
    if(director.feverOn && rng() < 0.16){
      const arr = Array.from(S.targets.values()).filter(v => v.type==='plaque');
      if(arr.length){
        const pick = arr[Math.floor(rng()*arr.length)];
        if(pick && S.targets.has(pick.id)){
          // count as hit reward lightly
          S.hits += 1;
          S.combo += 1;
          S.comboMax = Math.max(S.comboMax, S.combo);
          S.score += 1;
          S.clean = clamp(S.clean + (S.cleanGainPerHit * 0.85), 0, 100);
          removeTarget(pick.id, true);
        }
      }
    }
  }

  function onMiss(kind){
    S.miss += 1;
    S.combo = 0;
    S.score = Math.max(0, S.score - (kind==='boss'? 2 : 1));
    S.clean = clamp(S.clean - S.cleanLosePerMiss, 0, 100);
    fun?.onAction?.({ type:'timeout' });

    S.missStreak += 1;
    onMissStreak();
  }

  function onHit(){
    S.missStreak = 0;
  }

  // -------------------------
  // Boss 2-phase logic
  // -------------------------
  function bossInitPhase1(){
    S.bossPhase = 1;
    S.bossShieldMax = (ctx.diff==='hard'? 4 : ctx.diff==='easy'? 3 : 3);
    S.bossShield = S.bossShieldMax;
  }

  function bossBreakShield(target){
    S.bossPhase = 2;
    if(target && target.wsEl){
      target.wsEl.style.opacity = '0.95';
    }
    toast('💥 เกราะแตก! ยิงจุดอ่อน 🎯');
    aiEmit('boss', { state:'phase', phase:2, msg:'shield_break' });
  }

  // -------------------------
  // spawning
  // -------------------------
  function spawnOne(){
    if(!S.running || S.paused || S.ended || S.quizOpen) return;

    director = fun ? fun.tick() : director;

    const {x,y} = randomInLayer(56);
    advanceStageIfNeeded();

    // boss trigger
    if(!S.bossActive && S.clean >= S.nextBossAt && S.clean < 100){
      S.bossActive = true;
      bossInitPhase1();

      const boss = mkTarget({
        x, y,
        type:'boss',
        hpMax: (ctx.diff==='hard'? 7 : ctx.diff==='easy'? 5 : 6)
      });

      toast('💎 BOSS PLAQUE!');
      aiEmit('boss', { state:'start', phase:1, shield:`${S.bossShield}/${S.bossShieldMax}` });

      // optional FX hook
      WIN.BrushFX?.laser?.();

      return;
    }

    // stage B: evidence spawn until complete
    if(S.stage==='B' && S.eviTotal < S.eviNeed){
      const chance = 0.28 + (S.aiRisk > 0.65 ? 0.06 : 0);
      if(rng() < chance){
        const eviType = mkEvidenceType();
        mkTarget({ x, y, type:'evi', hpMax:1, eviType });
        return;
      }
    }

    mkTarget({ x, y, type:'plaque', hpMax:1 });
  }

  // -------------------------
  // hit handling
  // -------------------------
  function handleHit(t, x, y, source){
    if(!t || !S.targets.has(t.id) || S.ended || S.quizOpen) return;

    const tm = now();
    const remain = t.dieMs - tm;

    // Boss phase 1: drain shield only (no weakspot / no boss HP damage)
    if(t.type === 'boss' && S.bossPhase === 1){
      S.bossShield = Math.max(0, S.bossShield - 1);
      aiEmit('boss', { state:'phase', phase:1, shield:`${S.bossShield}/${S.bossShieldMax}` });

      applyHitRewards(t, remain, false);
      onHit();

      if(S.bossShield <= 0){
        bossBreakShield(t);
        WIN.BrushFX?.flash?.(110);
      }

      aiTick(false);
      renderHud(true);
      emit('hha:score', { score:S.score, combo:S.combo, miss:S.miss, clean:S.clean, ts:Date.now(), source });

      // Stage C open quiz condition
      advanceStageIfNeeded();
      if(S.stage==='C' && !S.quizDone && S.clean >= 92) openQuiz();

      if(S.clean >= 100 && canFinishC()) endGame('clean');
      return;
    }

    // phase2 or non-boss: do damage
    const weakHit = (t.type==='boss' && S.bossPhase===2) ? pointInBossWeakspot(t, x, y) : false;
    const dmg = (t.type==='boss') ? (weakHit ? 2 : 1) : 1;

    t.hp = Math.max(0, t.hp - dmg);
    updateHpVis(t);

    if(weakHit && t.el){
      t.el.classList.add('ws-hit');
      setTimeout(()=> t.el && t.el.classList.remove('ws-hit'), 180);
      updateBossWeakspotPos(t);
      toast('🎯 Weakspot!');
      WIN.BrushFX?.flash?.(90);
    }

    applyHitRewards(t, remain, weakHit);
    onHit();

    if(t.hp <= 0){
      removeTarget(t.id, true);

      if(t.type==='boss'){
        S.bossActive = false;
        S.nextBossAt = Math.min(100, S.nextBossAt + S.bossEveryPct);
        toast('💥 Boss แตก!');
        aiEmit('boss', { state:'down', nextAt:S.nextBossAt });
        WIN.BrushFX?.laser?.();
      }
    }

    // Stage C: open quiz at 92+ if not done
    advanceStageIfNeeded();
    if(S.stage==='C' && !S.quizDone && S.clean >= 92){
      openQuiz();
    }

    aiTick(false);
    renderHud(true);
    emit('hha:score', { score:S.score, combo:S.combo, miss:S.miss, clean:S.clean, ts:Date.now(), source });

    if(S.clean >= 100 && canFinishC()){
      endGame('clean');
    }
  }

  function onTargetPointerDown(ev){
    if(!S.running || S.paused || S.ended || S.quizOpen) return;
    ev.preventDefault();

    const btn = ev.currentTarget;
    const id = btn && btn.dataset ? btn.dataset.id : null;
    const t = id ? S.targets.get(id) : null;
    if(!t) return;

    // ✅ count shot once at source
    S.shots++;
    handleHit(t, ev.clientX, ev.clientY, 'pointer');
  }

  // -------------------------
  // cVR aim assist (hha:shoot)
  // -------------------------
  function getTargetCenter(t){
    if(!t || !t.el) return null;
    const r = t.el.getBoundingClientRect();
    return { x:r.left + r.width*0.5, y:r.top + r.height*0.5, w:r.width, h:r.height };
  }

  function getBossWeakCenter(t){
    if(!t || t.type!=='boss' || !t.el) return null;
    const r = t.el.getBoundingClientRect();
    return {
      x: r.left + r.width*0.5 + (t.weakX||0),
      y: r.top  + r.height*0.5 + (t.weakY||0),
      r: Math.max(10, t.weakR||14)
    };
  }

  function dynLock(baseLock, t, isCVR){
    const c = getTargetCenter(t);
    if(!c) return baseLock;
    const size = Math.max(24, Math.min(c.w, c.h));
    let bonus = size * (isCVR ? 0.22 : 0.12);
    if(t.type==='boss') bonus += isCVR ? 10 : 6;
    if(t.type==='evi')  bonus += isCVR ? 6 : 3;
    return clamp(Math.round(baseLock + bonus), baseLock, isCVR ? 92 : 72);
  }

  function nearestPick(x, y, baseLock, isCVR){
    let best=null, bestScore=Infinity;

    for(const t of S.targets.values()){
      if(!t || !t.el) continue;

      const lock = dynLock(baseLock, t, isCVR);

      // Boss weakspot priority only in phase2
      if(t.type==='boss' && S.bossPhase===2){
        const ws = getBossWeakCenter(t);
        if(ws){
          const dx = x - ws.x, dy = y - ws.y;
          const d2 = dx*dx + dy*dy;
          const wsLock = Math.max(lock, ws.r + (isCVR?22:12));
          if(d2 <= wsLock*wsLock){
            const score = d2*0.55;
            if(score < bestScore){
              bestScore = score;
              best = { t, aimX: ws.x, aimY: ws.y };
            }
          }
        }
      }

      const c = getTargetCenter(t);
      if(!c) continue;

      const dx = x - c.x, dy = y - c.y;
      const d2 = dx*dx + dy*dy;
      if(d2 <= lock*lock){
        const score = d2 * (t.type==='boss' ? 0.92 : 1.0);
        if(score < bestScore){
          bestScore = score;
          best = { t, aimX: x, aimY: y };
        }
      }
    }
    return best;
  }

  function onShoot(ev){
    if(!S.running || S.paused || S.ended || S.quizOpen) return;

    const d = (ev && ev.detail) || {};
    const x = safeNum(d.x, WIN.innerWidth/2);
    const y = safeNum(d.y, WIN.innerHeight/2);
    const baseLock = clamp(safeNum(d.lockPx, 28), 6, 80);

    const isCVR = String(d.view||ctx.view||'').toLowerCase()==='cvr'
      || String(DOC.documentElement?.dataset?.view||'').toLowerCase()==='cvr';

    const pick = nearestPick(x, y, baseLock, isCVR);

    // ✅ count once
    S.shots++;

    if(pick && pick.t){
      handleHit(pick.t, pick.aimX, pick.aimY, d.source || 'hha:shoot');
      return;
    }

    // whiff
    S.miss++;
    S.combo = 0;
    S.missStreak += 1;
    onMissStreak();

    fun?.onNearMiss?.({ reason:'whiff' });
    toast('พลาด');

    aiTick(false);
    renderHud(true);
  }

  WIN.addEventListener('hha:shoot', onShoot);

  // -------------------------
  // timers
  // -------------------------
  let spawnTimer=null, tickTimer=null;

  function clearTimers(){
    clearTimeout(spawnTimer);
    clearInterval(tickTimer);
    spawnTimer=null;
    tickTimer=null;
  }

  function scheduleSpawn(){
    clearTimeout(spawnTimer);
    if(!S.running || S.paused || S.ended || S.quizOpen) return;

    const base = S.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;

    spawnTimer = setTimeout(()=>{
      spawnOne();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!S.running || S.paused || S.ended) return;

    director = fun ? fun.tick() : director;

    const t = now();

    // timeouts
    for(const [id,tt] of S.targets){
      if(t >= tt.dieMs){
        removeTarget(id, false);

        if(tt.type==='boss'){
          S.bossActive=false;
          toast('💎 Boss หลุด!');
          aiEmit('boss', { state:'escape' });
        }

        onMiss(tt.type);
      }
    }

    const elapsed = (t - S.t0)/1000;
    const left = ctx.time - elapsed;

    if(left <= 10.3 && left >= 9.7){
      aiEmit('time', { left:10 });
      WIN.BrushFX?.fin?.(true);
      setTimeout(()=> WIN.BrushFX?.fin?.(false), 900);
    }

    // optional ML snapshot (prediction-only)
    if(ctx.ai && WIN.BrushML && typeof WIN.BrushML.snapshot === 'function'){
      const n = Date.now();
      if(!S.mlLast || (n - S.mlLast) >= 1000){
        S.mlLast = n;
        try{
          WIN.BrushML.snapshot({
            shots: S.shots,
            hits: S.hits,
            miss: S.miss,
            combo: S.combo,
            clean: S.clean,
            eviTotal: S.eviTotal,
            stage: S.stage,
            quizDone: S.quizDone,
            quizCorrect: S.quizCorrect,
            feverOn: !!director.feverOn,
            diff: ctx.diff,
            timeLeftSec: Math.max(0, left)
          });
        }catch(_){}
      }
    }

    aiTick(false);
    renderHud(false);

    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });

    if(left <= 0){
      endGame('time');
    }
  }

  // -------------------------
  // quiz (C)
  // -------------------------
  function quizAnswer(){
    if(!quizChoices) return '';
    const checked = quizChoices.querySelector('input[name="quizA"]:checked');
    return checked ? String(checked.value||'') : '';
  }

  function applyQuizResult(ok){
    S.quizDone = true;
    S.quizCorrect = !!ok;

    aiEmit('quiz', { state:'done', correct:S.quizCorrect });
    toast(S.quizCorrect ? '✅ ถูกต้อง! ได้โบนัส' : '❌ ยังไม่ถูก แต่ไปต่อได้');

    closeQuiz();

    // bonus
    if(S.quizCorrect){
      S.score += 40;
      S.clean = clamp(S.clean + 6.5, 0, 100);
    }else{
      S.score += 10;
    }

    aiTick(true);
    renderHud(true);

    if(S.clean >= 100 && canFinishC()){
      endGame('clean');
    }else{
      scheduleSpawn();
    }
  }

  function bindQuiz(){
    if(!quiz) return;
    quiz.hidden = true;

    btnQuizSubmit?.addEventListener('click', ()=>{
      const a = quizAnswer();
      const ok = (a === 'b'); // correct answer value="b"
      applyQuizResult(ok);
    }, { passive:true });

    btnQuizSkip?.addEventListener('click', ()=>{
      applyQuizResult(false);
    }, { passive:true });
  }

  // -------------------------
  // badges (summary)
  // -------------------------
  function buildBadges(summary){
    // use external if present
    const ext = WIN.BrushMissions?.buildBadges;
    if(typeof ext === 'function'){
      try{ return ext(summary) || []; }catch(_){}
    }

    const b=[];
    const acc = Number(summary.accuracyPct)||0;
    const miss = Number(summary.miss)||0;
    const combo = Number(summary.comboMax)||0;
    const evi = summary?.evidence?.total ?? 0;
    const quizOk = !!summary?.quiz?.correct;
    const timePlayed = Number(summary.timePlayedSec)||0;

    if(acc >= 82) b.push({emo:'🎯', text:'แม่นมาก (ACC ≥ 82%)'});
    if(miss <= 10) b.push({emo:'🧼', text:'ระวังพลาด (MISS ≤ 10)'});
    if(combo >= 8) b.push({emo:'🔥', text:'คอมโบไฟลุก (COMBO ≥ 8)'});
    if(evi >= 3) b.push({emo:'🧩', text:'นักสืบหลักฐาน (B ครบ 3/3)'});
    if(quizOk) b.push({emo:'🧠', text:'ตอบวิเคราะห์ถูก (Quiz ✅)'});
    if(timePlayed > 0 && timePlayed <= 25) b.push({emo:'⚡', text:'สปีดดี (ชนะ ≤ 25s)'});

    if(!b.length) b.push({emo:'✅', text:'เริ่มต้นดี! ลองอีกครั้งจะดีกว่าเดิม'});
    return b.slice(0,8);
  }

  // -------------------------
  // start/end
  // -------------------------
  function gradeFromAcc(acc){
    if(acc >= 92) return 'S';
    if(acc >= 82) return 'A';
    if(acc >= 70) return 'B';
    if(acc >= 55) return 'C';
    return 'D';
  }

  function startGame(){
    S.running=true; S.paused=false; S.ended=false;
    S.t0=now();

    S.score=0; S.combo=0; S.comboMax=0;
    S.miss=0; S.shots=0; S.hits=0;
    S.clean=0;

    S.stage='A';
    S.eviTotal=0;
    S.eviFlags={ sugar:0, night:0, no_brush:0 };

    S.quizOpen=false; S.quizDone=false; S.quizCorrect=false;

    S.aiRisk=0; S.aiTip='—'; S.aiBand='low';
    S.missStreak=0; S.lastAiEmit=0;

    S.nextBossAt=S.bossEveryPct;
    S.bossActive=false;
    bossInitPhase1();

    // clear targets
    for(const [id] of S.targets) removeTarget(id, false);
    S.targets.clear();

    // UI
    if(menu) menu.style.display='none';
    if(end){ end.hidden=true; end.style.display='none'; }
    if(quiz){ quiz.hidden=true; }
    wrap.dataset.state='play';

    DOC.body.classList.add('br-noscroll');

    btnPause && (btnPause.textContent='Pause');

    toast('เริ่ม! แปรงคราบให้ทัน!');
    aiEmit('stage', { stage:S.stage, clean:S.clean });
    aiTick(true);
    renderHud(true);

    emit('hha:start', {
      game:'brush',
      category:'hygiene',
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,
      timePlannedSec: ctx.time,
      ts: Date.now()
    });

    clearTimers();
    scheduleSpawn();
    tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended=true;
    S.running=false;

    clearTimers();

    for(const [id] of S.targets) removeTarget(id, false);
    S.targets.clear();

    DOC.body.classList.remove('br-noscroll');

    const acc = (S.shots>0) ? (S.hits/S.shots)*100 : 0;
    const grade = gradeFromAcc(acc);
    const elapsed = Math.min(ctx.time, (now()-S.t0)/1000);

    const summary = {
      game:'brush',
      category:'hygiene',
      reason,
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,
      ai: ctx.ai ? 1 : 0,

      stage: S.stage,
      evidence: { total:S.eviTotal, flags: Object.assign({}, S.eviFlags) },
      quiz: { done:S.quizDone, correct:S.quizCorrect },

      score: S.score,
      comboMax: S.comboMax,
      miss: S.miss,
      shots: S.shots,
      hits: S.hits,
      accuracyPct: Math.round(acc*10)/10,
      grade,
      cleanPct: Math.round(clamp(S.clean,0,100)),
      timePlannedSec: ctx.time,
      timePlayedSec: Math.round(elapsed*10)/10,
      date: ymdLocal(),
      ts: Date.now()
    };

    summary.badges = buildBadges(summary);

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const k='HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-40)));
    }catch(_){}

    // zone gate
    try{ localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1'); }catch(_){}

    emit('hha:end', summary);

    if(sScore) sScore.textContent = String(summary.score);
    if(sAcc)   sAcc.textContent   = `${summary.accuracyPct}%`;
    if(sMiss)  sMiss.textContent  = String(summary.miss);
    if(sCombo) sCombo.textContent = String(summary.comboMax);
    if(sClean) sClean.textContent = `${summary.cleanPct}%`;
    if(sTime)  sTime.textContent  = `${summary.timePlayedSec}s`;
    if(endGrade) endGrade.textContent = summary.grade;

    if(endNote){
      endNote.textContent =
        `reason=${reason} | stage=${summary.stage} | evi=${summary.evidence.total}/3 | quiz=${summary.quiz.correct?'ok':'no'} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'}`;
    }

    // render badges
    const badgeBox = DOC.getElementById('br-badges');
    if(badgeBox){
      badgeBox.innerHTML = (summary.badges||[]).map(b=>(
        `<span class="br-badgeChip">${String(b.emo||'🏅')} ${String(b.text||'').replace(/</g,'&lt;')}</span>`
      )).join('');
    }

    if(end){
      end.hidden=false;
      end.style.display='grid';
    }
    if(menu) menu.style.display='none';
    if(quiz) quiz.hidden=true;

    wrap.dataset.state='end';
    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
  }

  function togglePause(){
    if(!S.running || S.ended || S.quizOpen) return;
    S.paused = !S.paused;
    btnPause && (btnPause.textContent = S.paused ? 'Resume' : 'Pause');
    toast(S.paused ? '⏸ Pause' : '▶ Resume');
    if(!S.paused) scheduleSpawn();
    else clearTimeout(spawnTimer);
  }

  // -------------------------
  // controls
  // -------------------------
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRetry?.addEventListener('click', startGame, { passive:true });
  btnPause?.addEventListener('click', togglePause, { passive:true });

  btnHow?.addEventListener('click', ()=>{
    toast('A: ยิงให้โดน • B: เก็บ 🍬🌙🚫🪥 ให้ครบ 3 • C: ตอบ Quiz เพื่อปิดเกม • บอส 2 เฟส!');
  }, { passive:true });

  btnRecenter?.addEventListener('click', ()=>{
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
  }, { passive:true });

  // layer fallback (pc/mobile) — avoid double count when clicking target
  layer?.addEventListener('pointerdown', (ev)=>{
    if(String(ctx.view||'')==='cvr') return;
    if(!S.running || S.paused || S.ended || S.quizOpen) return;

    const t = ev.target;
    if(t && t.closest && t.closest('.br-t')) return;

    // count as a shot
    S.shots++;

    // pick nearest within lock
    let best=null, bestD=1e9;
    for(const tt of S.targets.values()){
      const c = getTargetCenter(tt);
      if(!c) continue;
      const dx = ev.clientX - c.x, dy = ev.clientY - c.y;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD){ bestD=d2; best=tt; }
    }
    const lock = 26;
    if(best && bestD <= lock*lock){
      handleHit(best, ev.clientX, ev.clientY, 'layer');
    }else{
      S.miss++; S.combo=0;
      S.missStreak += 1;
      onMissStreak();
      toast('พลาด');
      aiTick(false);
      renderHud(true);
    }
  }, { passive:true });

  // bind quiz
  bindQuiz();

  // -------------------------
  // init UI (menu state)
  // -------------------------
  function initMenu(){
    renderHud(true);
    aiTick(true);
    if(end){ end.hidden=true; end.style.display='none'; }
    if(quiz){ quiz.hidden=true; }
    if(menu) menu.style.display='grid';
    wrap.dataset.state='menu';
    DOC.body.classList.remove('br-noscroll');
    toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');
  }

  initMenu();

})();