// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard)
// ✅ Emoji targets for 7 steps
// ✅ SCORE + QUEST + MINI QUIZ
// ✅ SFX + FX (flash/shake) + Particles popText (optional)
// Emits: hha:start, hha:time, hha:judge, hha:end
'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}
function loadJson(key, fb){ try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; } }
function saveJson(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{} }
function nowIso(){ try{return new Date().toISOString();}catch{ return ''; } }
function nowMs(){ return performance.now ? performance.now() : Date.now(); }

// ------------------ Steps ------------------
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6 },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6 },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6 },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6 },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6 },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6 },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6 },
];
const ICON_HAZ = '🦠';

// ------------------ QUESTS ------------------
const QUEST_POOL = [
  { id:'streak', label:'คอมโบติดกัน', pick:(rng)=> ({ n: rng()<0.5 ? 8 : 10 }) },
  { id:'cleanloop', label:'ครบ 1 รอบแบบสะอาด', pick:()=> ({}) },
  { id:'speedstep', label:'ผ่านขั้นภายในเวลา', pick:(rng)=> ({ sec: rng()<0.5 ? 8 : 10 }) },
];

// ------------------ SCORE RULES ------------------
const SCORE_RULES = {
  good: 10,
  stepClear: 30,
  loopClear: 80,
  quizCorrect: 40,
  questComplete: 60,

  wrong: -12,
  haz: -18,
  quizWrong: -10
};

function popText(x,y,text,kind){
  try{
    if(WIN.Particles && typeof WIN.Particles.popText === 'function'){
      WIN.Particles.popText(x,y,String(text), kind||'good');
    }
  }catch{}
}

function setFx(cls){
  try{
    DOC.body.classList.remove('fx-good','fx-warn','fx-bad');
    DOC.body.classList.add(cls);
    clearTimeout(setFx._t);
    setFx._t = setTimeout(()=> DOC.body.classList.remove('fx-good','fx-warn','fx-bad'), 160);
  }catch{}
}

// ------------------ SFX (WebAudio) ------------------
function makeSfx(enabled){
  let ctx=null;
  function ensure(){
    if(!enabled) return null;
    if(ctx) return ctx;
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      return ctx;
    }catch{ return null; }
  }
  async function unlock(){
    const c = ensure();
    if(!c) return;
    try{ if(c.state === 'suspended') await c.resume(); }catch{}
  }
  function tone(freq, ms, type='sine', gain=0.05){
    const c = ensure();
    if(!c) return;
    try{
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + (ms/1000));
    }catch{}
  }
  return {
    unlock,
    good(){ tone(740, 70, 'triangle', 0.06); },
    step(){ tone(880, 110, 'triangle', 0.07); },
    quest(){ tone(988, 140, 'sine', 0.08); },
    quizOk(){ tone(660, 90, 'square', 0.05); tone(880, 90, 'square', 0.05); },
    bad(){ tone(220, 110, 'sawtooth', 0.05); },
    haz(){ tone(160, 140, 'sawtooth', 0.06); },
  };
}

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillScore= DOC.getElementById('pillScore');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillQuest= DOC.getElementById('pillQuest');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const quizBox  = DOC.getElementById('quizBox');
  const quizQ    = DOC.getElementById('quizQ');
  const quizSub  = DOC.getElementById('quizSub');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart   = DOC.getElementById('btnStart');
  const btnRestart = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const sfxOn = (qs('sfx','1') !== '0');
  const SFX = makeSfx(sfxOn);

  // base difficulty
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22 };
  })();

  // state
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0, hitsInStep=0, loopsDone=0;
  let combo=0, comboMax=0;
  let wrongStepHits=0, hazHits=0;
  const missLimit = 3;

  let correctHits=0, totalStepHits=0;
  const rtOk = [];

  // SCORE
  let score=0;
  let scoreGain=0, scoreLose=0; // for summary

  // QUEST
  let quest=null;
  let questDone=0;
  let questStartMs=0;
  let cleanLoopOk=true;
  let questCompleted=0;

  // QUIZ
  let quizActive=false;
  let quizCorrectStep=-1;
  let quizEndsMs=0;
  let quizCorrect=0, quizWrong=0;

  // targets
  const targets = [];
  let nextId=1;
  let spawnAcc=0;

  function addScore(delta, label=''){
    const before = score;
    score = Math.max(0, (score + (delta|0)));
    if(delta>0) scoreGain += delta;
    if(delta<0) scoreLose += (-delta);

    // pop score near top-center
    popText(WIN.innerWidth*0.5, WIN.innerHeight*0.20, `${delta>0?'+':''}${delta} ${label}`.trim(), delta>=0?'good':'bad');
    if(before !== score) setHud();
  }

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1300);
  }

  function showQuiz(on, title='', sub=''){
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
    if(quizQ) quizQ.textContent = title || '🧠 MINI QUIZ';
    if(quizSub) quizSub.textContent = sub || '';
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const cs = getComputedStyle(DOC.documentElement);
    const topSafe = parseFloat(cs.getPropertyValue('--hw-top-safe')) || 130;
    const bottomSafe = parseFloat(cs.getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;
    return { x0:pad, x1:w-pad, y0:topSafe+pad, y1:h-bottomSafe-pad, w, h };
  }

  function getMissCount(){ return (wrongStepHits + hazHits); }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }

  function questText(){
    if(!quest) return 'QUEST —';
    if(quest.id==='streak') return `QUEST: คอมโบ ${questDone}/${quest.n}`;
    if(quest.id==='cleanloop') return `QUEST: รอบสะอาด ${questDone}/1`;
    if(quest.id==='speedstep') return `QUEST: ผ่านขั้นใน ${quest.sec}s (${questDone}/1)`;
    return `QUEST —`;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillScore && (pillScore.textContent = `SCORE ${score}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);
    pillQuest && (pillQuest.textContent = questText());
  }

  function newQuest(){
    const pick = QUEST_POOL[Math.floor(rng()*QUEST_POOL.length)];
    quest = Object.assign({ id: pick.id }, pick.pick(rng));
    questDone = 0;
    questStartMs = nowMs();
    if(quest.id==='cleanloop') cleanLoopOk = true;
    showBanner(`🎯 QUEST: ${pick.label}!`);
    setHud();
  }

  function completeQuest(){
    if(!quest) return;
    questCompleted++;
    SFX.quest();
    setFx('fx-good');
    addScore(SCORE_RULES.questComplete, 'QUEST');
    showBanner('🏆 QUEST สำเร็จ! +BONUS');
    quest = null;
    questDone = 0;
    questStartMs = 0;
    setTimeout(()=>{ if(running && !paused) newQuest(); }, 900);
    setHud();
  }

  function questOnGoodHit(){
    if(!quest) return;
    if(quest.id==='streak'){
      questDone = Math.min(quest.n, combo);
      if(questDone >= quest.n) completeQuest();
    }
  }
  function questOnMistake(){
    if(quest && quest.id==='cleanloop') cleanLoopOk = false;
  }
  function questOnStepClear(stepClearMs){
    if(!quest) return;
    if(quest.id==='speedstep'){
      if(stepClearMs/1000 <= quest.sec){
        questDone = 1;
        completeQuest();
      }
    }
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);
    stage.appendChild(el);

    const rect = getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function spawnOne(){
    if(quizActive) return;
    const s = STEPS[stepIdx];
    const r = rng();
    if(r < base.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < base.hazardRate + base.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', s.icon, stepIdx);
    }
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR: aim from center; pick nearest within lockPx
  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      const dx = (t.x - cx), dy = (t.y - cy);
      const dist = Math.hypot(dx, dy);
      if(dist < lockPx && dist < bestDist){
        best = t; bestDist = dist;
      }
    }
    if(best){
      judgeHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  function startMiniQuiz(){
    if(quizActive) return;
    if(rng() > 0.22) return;

    quizActive = true;
    clearTargets();

    quizCorrectStep = stepIdx; // “ตอนนี้ต้องทำขั้นไหน”
    quizEndsMs = nowMs() + 4500;

    showQuiz(true, '🧠 MINI QUIZ', 'ยิง/แตะ “ขั้นที่ถูกต้องตอนนี้” ให้ทันเวลา!');
    showBanner('🧠 QUIZ! เลือกให้ถูก!');

    const options = [quizCorrectStep];
    while(options.length < 3){
      const p = Math.floor(rng()*STEPS.length);
      if(!options.includes(p)) options.push(p);
    }
    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    options.forEach(si=> createTarget('quiz', STEPS[si].icon, si));
  }

  function endMiniQuiz(success){
    quizActive = false;
    showQuiz(false);
    clearTargets();

    if(success){
      quizCorrect++;
      SFX.quizOk();
      setFx('fx-good');
      addScore(SCORE_RULES.quizCorrect, 'QUIZ');
      showBanner('✅ ตอบถูก! +SCORE');
    }else{
      showBanner('⏳ หมดเวลา! ไปต่อ…');
    }
    setHud();
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // QUIZ mode
    if(quizActive){
      const picked = obj.stepIdx;
      removeTarget(obj);

      if(picked === quizCorrectStep){
        endMiniQuiz(true);
      }else{
        quizWrong++;
        wrongStepHits++;
        combo = 0;

        SFX.bad();
        setFx('fx-warn');
        addScore(SCORE_RULES.quizWrong, 'QUIZ');
        questOnMistake();
        showBanner(`❌ ผิด! ตอนนี้ต้อง ${STEPS[quizCorrectStep].icon} ${STEPS[quizCorrectStep].label}`);

        if(nowMs() >= quizEndsMs || targets.length === 0){
          endMiniQuiz(false);
        }
        setHud();
      }

      emit('hha:judge', { kind:'quiz', picked, correct: quizCorrectStep, rtMs: rt, source, extra });
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      SFX.good();
      setFx('fx-good');
      addScore(SCORE_RULES.good, 'HIT');
      questOnGoodHit();

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon}`);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        const stepClearMs = nowMs() - questStartMs;

        SFX.step();
        addScore(SCORE_RULES.stepClear, 'STEP');
        showBanner(`✨ ผ่านขั้น: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;

          addScore(SCORE_RULES.loopClear, 'LOOP');
          showBanner(`🏁 ครบ 7 ขั้นตอน! +LOOP (${loopsDone})`);

          if(quest && quest.id==='cleanloop'){
            if(cleanLoopOk){
              questDone = 1;
              completeQuest();
            }else{
              cleanLoopOk = true;
              showBanner('🧼 รอบก่อนมีพลาด… รอบนี้เอาใหม่!');
            }
          }else{
            if(!quest) newQuest();
          }

          questStartMs = nowMs();
        }else{
          questOnStepClear(stepClearMs);
          questStartMs = nowMs();
          showBanner(`➡️ ต่อไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

          startMiniQuiz(); // chance
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      SFX.bad();
      setFx('fx-warn');
      addScore(SCORE_RULES.wrong, 'WRONG');

      questOnMistake();

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้น! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      SFX.haz();
      setFx('fx-bad');
      addScore(SCORE_RULES.haz, 'HAZ');

      questOnMistake();

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner('🦠 โดนเชื้อ! ระวัง!');

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function tick(){
    if(!running) return;

    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    if(quizActive && nowMs() >= quizEndsMs){
      endMiniQuiz(false);
    }

    if(!quizActive){
      spawnAcc += (base.spawnPerSec * dt);
      while(spawnAcc >= 1){
        spawnAcc -= 1;
        spawnOne();

        if(targets.length > 18){
          const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
          if(oldest) removeTarget(oldest);
        }
      }
    }

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;
    spawnAcc=0;

    score=0; scoreGain=0; scoreLose=0;

    quest=null; questDone=0; questStartMs=nowMs(); cleanLoopOk=true; questCompleted=0;

    quizActive=false; quizCorrectStep=-1; quizEndsMs=0; quizCorrect=0; quizWrong=0;
    showQuiz(false);

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;

    // unlock audio on user gesture
    SFX.unlock();

    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    newQuest();
    showBanner(`เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    showQuiz(false);

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    const rtMed = (()=> {
      const a = rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 0;
      const m = (a.length-1)/2;
      return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
    })();

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.2.0-prod',
      game:'hygiene',
      gameMode:'hygiene',
      runMode,
      diff,
      view,
      seed,
      sessionId,
      timestampIso: nowIso(),

      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      loopsDone,
      stepIdxEnd: stepIdx,

      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),
      medianStepMs: rtMed,

      // score & extras
      score,
      scoreGain,
      scoreLose,
      questCompleted,
      quizCorrect,
      quizWrong,
    };

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Score ${score} • Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', async ()=>{
    try{ await navigator.clipboard.writeText(String(endJson.textContent||'')); }catch{}
  }, { passive:true });

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  WIN.addEventListener('hha:shoot', onShoot);

  // initial
  setHud();
}