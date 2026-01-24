// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + QUEST + MINI-QUIZ)
// Emits: hha:start, hha:time, hha:judge, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
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

// ------------------ Steps (emoji mapping) ------------------
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

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
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

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22 };
  })();

  // state
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0;
  let hitsInStep=0;
  let loopsDone=0;

  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];

  // QUEST state
  let quest = null; // {id, ...params}
  let questDone = 0;
  let questStartMs = 0;
  let cleanLoopOk = true;

  // QUIZ state
  let quizActive=false;
  let quizCorrectStep=-1;
  let quizEndsMs=0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;
  let spawnAcc=0;

  // helpers
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
    if(quizQ) quizQ.textContent = title || 'QUIZ';
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

  function getMissCount(){
    // hygiene miss = wrong step hits + hazard hits
    return (wrongStepHits + hazHits);
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);

    // quest pill
    if(pillQuest){
      if(!quest) pillQuest.textContent = `QUEST —`;
      else pillQuest.textContent = questText();
    }
  }

  function questText(){
    if(!quest) return 'QUEST —';
    if(quest.id==='streak') return `QUEST: คอมโบ ${questDone}/${quest.n}`;
    if(quest.id==='cleanloop') return `QUEST: รอบสะอาด ${questDone}/1`;
    if(quest.id==='speedstep') return `QUEST: ผ่านขั้นใน ${quest.sec}s (${questDone}/1)`;
    return `QUEST —`;
  }

  function newQuest(){
    const pick = QUEST_POOL[Math.floor(rng()*QUEST_POOL.length)];
    quest = Object.assign({ id: pick.id }, pick.pick(rng));
    questDone = 0;
    questStartMs = nowMs();
    if(quest.id==='cleanloop'){ cleanLoopOk = true; }
    showBanner(`🎯 QUEST: ${pick.label}!`);
    setHud();
  }

  function completeQuest(){
    if(!quest) return;
    showBanner(`🏆 QUEST สำเร็จ! +BONUS`);
    // bonus: ลด miss 1 (ไม่ติดลบ) หรือเพิ่มคอมโบ
    if(getMissCount() > 0){
      // ลดโดยลด haz ก่อน แล้วค่อย wrong (ให้แฟร์)
      if(hazHits>0) hazHits--;
      else if(wrongStepHits>0) wrongStepHits--;
    }else{
      combo += 2;
      comboMax = Math.max(comboMax, combo);
    }
    quest = null;
    questDone = 0;
    questStartMs = 0;
    // สุ่ม quest ใหม่อีกครั้งแบบเว้นจังหวะ
    setTimeout(()=>{ if(running && !paused) newQuest(); }, 1200);
    setHud();
  }

  function questOnGoodHit(){
    if(!quest) return;
    if(quest.id==='streak'){
      questDone = Math.min(quest.n, combo);
      if(questDone >= quest.n) completeQuest();
    }
    // speedstep: ต้องผ่าน “ขั้น” ภายในเวลา -> ตรวจตอน step_clear
  }

  function questOnMistake(){
    if(!quest) return;
    if(quest.id==='cleanloop'){
      cleanLoopOk = false;
    }
  }

  function questOnStepClear(stepClearTimeMs){
    if(!quest) return;
    if(quest.id==='speedstep'){
      if(stepClearTimeMs/1000 <= quest.sec){
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
    if(quizActive) return; // quiz mode: do not spawn normal
    const s = STEPS[stepIdx];

    const P = base;
    const r = rng();

    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
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

  // cVR shooting: aim from center; choose nearest target within lockPx
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
    // สุ่มไม่ถี่เกิน: โอกาส 22% ตอนผ่าน step
    if(quizActive) return;
    if(rng() > 0.22) return;

    quizActive = true;
    clearTargets();

    // ถาม: ขั้นถัดไปคืออะไร
    const next = (stepIdx >= STEPS.length) ? 0 : stepIdx;
    quizCorrectStep = next;
    quizEndsMs = nowMs() + 4500;

    showQuiz(true, '🧠 MINI QUIZ', 'ยิง/แตะ “ขั้นที่ถูกต้อง” ให้ทันเวลา!');

    // spawn 3 options: correct + 2 wrong
    const options = [quizCorrectStep];
    while(options.length < 3){
      const p = Math.floor(rng()*STEPS.length);
      if(!options.includes(p)) options.push(p);
    }

    // shuffle options
    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    options.forEach(si=>{
      createTarget('quiz', STEPS[si].icon, si);
    });

    showBanner('🧠 QUIZ! เลือกให้ถูก!');
  }

  function endMiniQuiz(success){
    quizActive = false;
    showQuiz(false);
    clearTargets();

    if(success){
      showBanner('✅ ตอบถูก! +คอมโบ');
      combo += 2;
      comboMax = Math.max(comboMax, combo);
    }else{
      showBanner('⏳ หมดเวลา! ไปต่อ…');
    }
    setHud();
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
        wrongStepHits++;
        combo = 0;
        questOnMistake();
        showBanner(`❌ ผิด! คำตอบคือ ${STEPS[quizCorrectStep].icon}`);
        // ยังให้โอกาสตอบใหม่ ถ้าเหลือเวลาและยังมีเป้า
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

      questOnGoodHit();

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        const clearTime = nowMs() - questStartMs;

        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;

          // clean loop quest
          if(quest && quest.id==='cleanloop'){
            if(cleanLoopOk){
              questDone = 1;
              completeQuest();
            }else{
              cleanLoopOk = true; // reset for next loop
              showBanner('🧼 รอบก่อนมีพลาด… รอบนี้เอาใหม่!');
            }
          }else{
            // เปิดโอกาสสุ่ม quest ใหม่ตอนครบ 1 รอบ
            if(!quest) newQuest();
          }

          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
        }else{
          // speedstep quest check
          questOnStepClear(clearTime);
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

          // สุ่ม MINI QUIZ หลังผ่านขั้น
          startMiniQuiz();
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

      questOnMistake();

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      questOnMistake();

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    // time
    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // quiz timeout
    if(quizActive && nowMs() >= quizEndsMs){
      endMiniQuiz(false);
    }

    // spawn (skip if quizActive)
    if(!quizActive){
      spawnAcc += (base.spawnPerSec * dt);
      while(spawnAcc >= 1){
        spawnAcc -= 1;
        spawnOne();

        // cap targets
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

    quest = null;
    questDone = 0;
    questStartMs = nowMs();
    cleanLoopOk = true;

    quizActive=false;
    showQuiz(false);

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    newQuest();
    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
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
      version:'1.1.0-prod',
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

      medianStepMs: rtMed
    };

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
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

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // initial
  setHud();
}