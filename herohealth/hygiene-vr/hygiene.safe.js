// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Quiz)
// Emits: hha:start, hha:time, hha:score, hha:judge, hha:end
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
function nowIso(){ try{return new Date().toISOString();}catch{ return ''; } }
function nowMs(){ return performance.now ? performance.now() : Date.now(); }

function loadJson(key, fb){
  try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}
function copyText(text){
  return navigator.clipboard?.writeText(String(text)).catch(()=>{});
}

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

// ------------------ Quiz bank (ตามภาพ 3 ตัวเลือก) ------------------
const QUIZ_BANK = [
  {
    q: 'ขั้นตอน “ซอกนิ้ว” ใช้ทำไหน?',
    sub: 'เลือกคำตอบที่สื่อความถูกต้องที่สุด',
    opts: [
      { t:'🧩 ถูซอกนิ้วแบบประสานนิ้ว', ok:true },
      { t:'👍 ถูหัวแม่มืออย่างเดียว', ok:false },
      { t:'💅 ถูปลายนิ้ว/เล็บก่อน', ok:false },
    ]
  },
  {
    q: 'ขั้นตอน “ปลายนิ้ว/เล็บ” ทำเพื่ออะไร?',
    sub: 'เลือกคำตอบที่ถูกต้องที่สุด',
    opts: [
      { t:'💅 ขจัดเชื้อใต้เล็บและปลายนิ้ว', ok:true },
      { t:'🤚 ให้มือแห้งเร็วขึ้น', ok:false },
      { t:'⌚ ทำเฉพาะข้อมือ', ok:false },
    ]
  },
  {
    q: 'ลำดับคำท่อง 7 ขั้นตอน ข้อไหนถูก?',
    sub: 'เลือกคำตอบที่ถูกต้องที่สุด',
    opts: [
      { t:'ฝ่า-หลัง-ซอก-ข้อ-โป้ง-เล็บ-ข้อมือ', ok:true },
      { t:'ฝ่า-ซอก-หลัง-เล็บ-ข้อ-โป้ง-ข้อมือ', ok:false },
      { t:'หลัง-ฝ่า-เล็บ-ซอก-โป้ง-ข้อ-ข้อมือ', ok:false },
    ]
  },
];

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage){
    console.warn('[HygieneVR] stage not found.');
    return;
  }

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

  // base difficulty
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.7, hazardRate:0.08, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.11, decoyRate:0.22 };
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
  let totalStepHits=0; // correct + wrong (only step targets)
  const rtOk = []; // ms
  let spawnAcc=0;

  // score + quest
  let score=0;
  let quest = null; // {need, got, type}
  let quizActive = null; // {bankIndex, answered}

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs}
  let nextId=1;

  // banner helper
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  // ✅ spawn rect from stage real bounds
  function getSpawnRect(){
    const R = stage.getBoundingClientRect();
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 132;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;

    const x0 = R.left + pad;
    const x1 = R.right - pad;
    const y0 = R.top + topSafe + pad;
    const y1 = R.bottom - bottomSafe - pad;

    return {
      x0, x1, y0, y1,
      w: Math.max(1, R.width),
      h: Math.max(1, R.height),
      left: R.left,
      top: R.top
    };
  }

  function getMissCount(){
    // hygiene: miss = wrong step hits + hazard hits
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

    if(pillQuest){
      if(!quest) pillQuest.textContent = `QUEST —`;
      else pillQuest.textContent = `QUEST ${quest.icon} ${quest.got}/${quest.need}`;
    }

    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • loops=${loopsDone}`);
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
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

    // convert to percent inside stage box
    const px = (x - rect.left);
    const py = (y - rect.top);
    const xp = clamp((px / rect.w) * 100, 2, 98);
    const yp = clamp((py / rect.h) * 100, 2, 98);

    el.style.setProperty('--x', xp.toFixed(3));
    el.style.setProperty('--y', yp.toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs() };
    targets.push(obj);

    // click/tap only for non-cVR strict
    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function spawnOne(){
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

  // ✅ cVR shooting: use element real rect (แม่นกว่าเก็บ x/y)
  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      const r = t.el?.getBoundingClientRect?.();
      if(!r) continue;
      const tx = (r.left + r.right) / 2;
      const ty = (r.top + r.bottom) / 2;
      const dist = Math.hypot(tx - cx, ty - cy);
      if(dist < lockPx && dist < bestDist){
        best = t; bestDist = dist;
      }
    }
    if(best){
      judgeHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  function awardScore(kind){
    // สนุกขึ้น: คอมโบให้แต้มพุ่ง
    if(kind === 'good'){
      const bonus = 1 + Math.min(6, Math.floor(combo/5));
      score += bonus;
      emit('hha:score', { score, delta: bonus, combo });
    }
    if(kind === 'wrong'){ score = Math.max(0, score-1); emit('hha:score', { score, delta:-1, combo }); }
    if(kind === 'haz'){ score = Math.max(0, score-2); emit('hha:score', { score, delta:-2, combo }); }
  }

  // Quest (ง่าย-ชัดแบบ ป.5)
  function newQuest(){
    const pool = [
      { type:'combo', need: 25, icon:'🧿', label:'คอมโบ' },
      { type:'good',  need: 18, icon:'✅', label:'ถูก' },
      { type:'quiz',  need: 1,  icon:'❓', label:'ตอบคำถาม' },
    ];
    const pick = pool[Math.floor(rng()*pool.length)];
    quest = { ...pick, got:0 };
    setHud();
  }

  function questOnEvent(evt){
    if(!quest) return;
    if(quest.type === 'combo'){
      quest.got = Math.max(quest.got, combo);
    }else if(quest.type === 'good'){
      if(evt === 'good') quest.got++;
    }else if(quest.type === 'quiz'){
      if(evt === 'quiz_ok') quest.got = 1;
    }
    if(quest.got >= quest.need){
      showBanner(`🎯 QUEST สำเร็จ! +5 แต้ม`);
      score += 5;
      emit('hha:score', { score, delta:+5, combo });
      newQuest();
    }
    setHud();
  }

  // Quiz
  function hideQuiz(){
    quizActive = null;
    if(quizBox) quizBox.style.display = 'none';
  }

  function showQuiz(){
    if(!quizBox || quizActive) return;
    const idx = Math.floor(rng()*QUIZ_BANK.length);
    const q = QUIZ_BANK[idx];
    quizActive = { bankIndex: idx, answered:false };

    quizQ.textContent = `❓ ${q.q}`;
    quizSub.textContent = q.sub;

    // build buttons
    let opts = quizBox.querySelector('.hw-quiz-opts');
    if(!opts){
      opts = DOC.createElement('div');
      opts.className = 'hw-quiz-opts';
      quizBox.appendChild(opts);
    }
    opts.innerHTML = '';

    q.opts.forEach((o)=>{
      const b = DOC.createElement('button');
      b.type='button';
      b.className = 'hw-opt';
      b.textContent = o.t;
      b.addEventListener('click', ()=>{
        if(!quizActive || quizActive.answered) return;
        quizActive.answered = true;

        if(o.ok){
          b.classList.add('good');
          showBanner('✅ ตอบถูก! +3');
          score += 3;
          emit('hha:score', { score, delta:+3, combo });
          questOnEvent('quiz_ok');
        }else{
          b.classList.add('bad');
          showBanner('❌ ยังไม่ถูก (ลองจำคำท่อง 7 ขั้นตอน)');
          score = Math.max(0, score-1);
          emit('hha:score', { score, delta:-1, combo });
        }
        setTimeout(hideQuiz, 900);
      }, { passive:true });
      opts.appendChild(b);
    });

    quizBox.style.display = 'block';
    setHud();
  }

  function maybeQuiz(){
    // โผล่เป็นระยะ ๆ ไม่รบกวนเกินไป
    if(quizActive) return;
    if(elapsedSec() < 10) return;
    const chance = (diff==='easy') ? 0.06 : (diff==='hard'?0.10:0.08);
    if(rng() < chance) showQuiz();
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      awardScore('good');
      questOnEvent('good');

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          // ให้รางวัลเล็ก ๆ กันค้างความรู้สึก
          score += 2; emit('hha:score', { score, delta:+2, combo });
          // โอกาสให้ quiz ตอนจบรอบ
          showQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
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

      awardScore('wrong');

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

      awardScore('haz');

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // spawn
    spawnAcc += (base.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets to prevent clutter
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    // occasionally show quiz
    maybeQuiz();

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    hideQuiz();

    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    spawnAcc=0;
    score=0;

    newQuest();
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

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    hideQuiz();

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

    // grade (simple but fair)
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
      runMode, diff, view, seed,
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

      score
    };

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Grade ${grade} • score ${score} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson.textContent||''), { passive:true });

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