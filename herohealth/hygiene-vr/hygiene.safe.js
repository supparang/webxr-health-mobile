// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest+Boss + Quiz + Coach+DD)
// Emits: hha:start, hha:time, hha:score, hha:judge, hha:end, quest:update, storm_enter, boss:* , quiz:*
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
function loadJson(key, fb){
  try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}
function nowIso(){ try{return new Date().toISOString();}catch{ return ''; } }
function nowMs(){ return performance.now ? performance.now() : Date.now(); }

function copyText(text){
  try{ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }catch{ return Promise.resolve(); }
}
function vib(ms){
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(_){}
}
function beep(freq=880, durMs=70, vol=0.08){
  try{
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return;
    const ac = beep._ac || (beep._ac = new AC());
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ac.destination);
    const t0 = ac.currentTime;
    o.start(t0);
    o.stop(t0 + (durMs/1000));
  }catch(_){}
}

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
const MNEMONIC = 'ฝ่า-หลัง-ซอก-ข้อ-โป้ง-เล็บ-ข้อมือ';

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

  const quizBox = DOC.getElementById('quizBox');
  const quizQ   = DOC.getElementById('quizQ');
  const quizSub = DOC.getElementById('quizSub');

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

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40]
  };

  // AI instances (optional if you have these libs)
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

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
  let perfectHits=0;
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;
  let spawnAcc=0;

  // ===== PACK CC: Quests + Storm + Boss =====
  const QUESTS = [
    { id:'q1', title:'เริ่มล้างมือให้ถูก!', desc:'ยิงถูกให้ได้ 12 ครั้ง', targetCorrect:12 },
    { id:'q2', title:'คอมโบไฟลุก!', desc:'ทำ COMBO ถึง 10', targetCombo:10 },
    { id:'q3', title:'โหมดปลอดเชื้อ!', desc:'ช่วง Storm 8s ห้ามโดน 🦠', targetStormSec:8 },
  ];
  let questIdx = 0;
  let questsCleared = 0;
  let qProgress = 0;

  let stormActive = false;
  let stormLeft = 0;
  let stormSafeOk = true;

  let bossActive = false;
  let bossHp = 0;
  let bossHpMax = 0;
  let bossCleared = false;
  let bossTarget = null;

  // ===== PACK CD: Quiz Mode =====
  let quizActive = false;
  let quizLeft = 0;
  let quizTotal = 0;
  let quizCorrect = 0;
  let quizNeedNext = true;
  let quizPromptStepIdx = 0;
  let quizAnswerStepIdx = 0;

  // banner helper
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function showMnemonic(){
    showBanner(`🎵 ท่อง: ${MNEMONIC}`);
  }

  function setQuestText(text){
    if(pillQuest) pillQuest.textContent = text;
    else showBanner(text);
  }
  function questNow(){ return QUESTS[questIdx] || null; }

  function showQuizUI(on){
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
  }

  function getMissCount(){
    // hygiene: miss = wrong step hits + hazard hits
    return (wrongStepHits + hazHits);
  }

  // safe spawn rect
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 130;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;
    return { x0:pad, x1:w-pad, y0:topSafe+pad, y1:h-bottomSafe-pad, w, h };
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);

    // quest pill fallback
    if(!pillQuest){
      const q = questNow();
      if(q) setQuestText(`QUEST ${questIdx+1}/3 • ${q.title}`);
    }
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el?.remove(); }catch(_){}
    }
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    try{ obj.el?.remove(); }catch(_){}
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';

    // boss uses a stronger class + keep visible
    el.className = `hw-tgt ${kind}` + (kind==='boss' ? ' good' : '');

    let badge = '';
    if(kind === 'wrong') badge = `<span class="badge">WRONG</span>`;
    if(kind === 'haz')   badge = `<span class="badge">HAZ</span>`;
    if(kind === 'boss')  badge = `<span class="badge">BOSS</span>`;
    if(kind === 'quiz_ok') badge = `<span class="badge">QUIZ</span>`;
    if(kind === 'quiz_ng') badge = `<span class="badge">NO</span>`;

    el.innerHTML = `<span class="emoji">${emoji}</span>${badge}`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    const rect = getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (kind==='boss' ? 1.35 : (0.90 + rng()*0.25)).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function startQuest(i){
    questIdx = clamp(i, 0, QUESTS.length);
    qProgress = 0;
    stormActive = false;
    stormLeft = 0;
    stormSafeOk = true;

    const q = questNow();
    if(!q){
      setQuestText('QUEST ✅ ครบทุกด่าน! เตรียมบอส…');
      return;
    }
    setQuestText(`QUEST ${questIdx+1}/3 • ${q.title} — ${q.desc}`);
    emit('quest:update', { questIdx, questId:q.id, title:q.title, desc:q.desc, progress:qProgress });
  }

  function completeQuest(){
    const q = questNow();
    if(!q) return;

    questsCleared++;
    emit('quest:update', { questIdx, questId:q.id, done:true });

    try{ beep(1046, 90, 0.10); vib(22); }catch(_){}
    showBanner(`🏆 ผ่าน QUEST ${questIdx+1}! (${q.title})`);

    startQuest(questIdx+1);
  }

  function maybeStartStorm(){
    stormActive = true;
    stormLeft = questNow()?.targetStormSec || 8;
    stormSafeOk = true;
    showBanner('🌀 STORM! 8 วินาทีนี้ “ห้ามโดน 🦠”');
    emit('storm_enter', { stormLeft });
  }

  function startBoss(){
    if(bossActive || bossCleared) return;
    bossActive = true;
    bossHpMax = 12;
    bossHp = bossHpMax;
    showBanner('👑 BOSS: ฟองสบู่ยักษ์! ยิงให้แตก (ถูกขั้นตอนเท่านั้น)');
    emit('boss:start', { hp: bossHp, hpMax: bossHpMax });

    // boss shows current step icon target (start with bubble)
    bossTarget = createTarget('boss', '🫧', stepIdx);
    try{ bossTarget.el.classList.add('boss'); }catch(_){}
  }

  function hitBoss(){
    if(!bossActive || !bossTarget) return;
    bossHp = Math.max(0, bossHp - 1);
    emit('boss:hit', { hp: bossHp, hpMax: bossHpMax });

    try{ beep(740 + (bossHp*8), 35, 0.08); vib(10); }catch(_){}
    showBanner(`👑 BOSS HP ${bossHp}/${bossHpMax}`);

    if(bossHp <= 0){
      bossCleared = true;
      bossActive = false;
      try{ removeTarget(bossTarget); }catch(_){}
      bossTarget = null;

      showBanner('🎉 ชนะบอส! มือสะอาดสุดยอด!');
      try{ beep(1319, 120, 0.12); vib(28); }catch(_){}
      emit('boss:clear', { ok:true });
    }
  }

  function startQuiz(sec=30){
    if(quizActive) return;
    quizActive = true;
    quizLeft = sec;
    quizTotal = 0;
    quizCorrect = 0;
    quizNeedNext = true;

    clearTargets();
    showQuizUI(true);
    showBanner('🧠 QUIZ MODE! 30 วิท้าย—ตอบให้ถูก!');
    emit('quiz:start', { sec });
  }

  function endQuiz(){
    if(!quizActive) return;
    quizActive = false;
    showQuizUI(false);
    emit('quiz:end', { quizTotal, quizCorrect });
  }

  function pick3Choices(correctIdx){
    const set = new Set([correctIdx]);
    while(set.size < 3) set.add(Math.floor(rng()*STEPS.length));
    const arr = Array.from(set);
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function spawnQuizQuestion(){
    quizPromptStepIdx = stepIdx;
    quizAnswerStepIdx = (stepIdx + 1) % STEPS.length;

    const choices = pick3Choices(quizAnswerStepIdx);
    choices.forEach((idx)=>{
      const kind = (idx === quizAnswerStepIdx) ? 'quiz_ok' : 'quiz_ng';
      createTarget(kind, STEPS[idx].icon, idx);
    });

    quizTotal++;
    quizNeedNext = false;

    if(quizQ) quizQ.textContent = `QUIZ ${quizCorrect}/${quizTotal} • “ขั้นถัดไปคือ?”`;
    if(quizSub){
      quizSub.textContent =
        `ตอนนี้: ${STEPS[quizPromptStepIdx].icon} ${STEPS[quizPromptStepIdx].label} → เลือก “ขั้นถัดไป”`;
    }
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shooting: aim from center, lockPx from vr-ui config
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

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // ===== PACK CD: Quiz judge =====
    if(obj.kind === 'quiz_ok' || obj.kind === 'quiz_ng'){
      if(!quizActive){ removeTarget(obj); return; }

      const ok = (obj.kind === 'quiz_ok');
      if(ok){
        quizCorrect++;
        combo++;
        comboMax = Math.max(comboMax, combo);
        showBanner(`✅ ถูก! ถัดไปคือ ${STEPS[obj.stepIdx].icon} ${STEPS[obj.stepIdx].label}`);
        try{ beep(988, 70, 0.10); vib(16); }catch(_){}
      }else{
        combo = 0;
        showBanner(`❌ ยังไม่ใช่! จำไว้: ${MNEMONIC}`);
        try{ beep(220, 60, 0.10); vib(10); }catch(_){}
      }

      clearTargets();
      quizNeedNext = true;

      if(quizQ) quizQ.textContent = `QUIZ ${quizCorrect}/${quizTotal}`;
      setHud();
      return;
    }

    // boss
    if(obj.kind === 'boss'){
      hitBoss();
      setHud();
      return;
    }

    // normal hits
    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;

      // perfect if fast
      const perfect = (rt <= 520);
      if(perfect) perfectHits++;

      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      coach?.onEvent?.('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo, perfect });
      dd?.onEvent?.('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra, perfect });
      showBanner(perfect ? `🌟 PERFECT! ${STEPS[stepIdx].icon} +1` : `✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      // quest progress Q1/Q2
      const q = questNow();
      if(q && q.id==='q1'){
        qProgress = correctHits;
        setQuestText(`QUEST 1/3 • ${q.title} — ${qProgress}/${q.targetCorrect}`);
        if(qProgress >= q.targetCorrect) completeQuest();
      }
      if(q && q.id==='q2'){
        setQuestText(`QUEST 2/3 • ${q.title} — COMBO ${Math.min(combo, q.targetCombo)}/${q.targetCombo}`);
        if(combo >= q.targetCombo) completeQuest();
      }

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
        }else{
          showBanner(`➡️ ขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }

        // mnemonic every 2 steps
        if(stepIdx % 2 === 0) showMnemonic();
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      coach?.onEvent?.('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

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

      if(stormActive) stormSafeOk = false;

      coach?.onEvent?.('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = dd?.getParams?.() || base;

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

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0; perfectHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    spawnAcc=0;

    // quests/boss/quiz
    questsCleared=0; questIdx=0; qProgress=0;
    stormActive=false; stormLeft=0; stormSafeOk=true;

    bossActive=false; bossHp=0; bossHpMax=0; bossCleared=false; bossTarget=null;

    quizActive=false; quizLeft=0; quizTotal=0; quizCorrect=0; quizNeedNext=true;
    showQuizUI(false);

    startQuest(0);
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
    showBanner(`เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    showMnemonic();
    setHud();

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    endQuiz();

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
      storyTag:'Handwash Survival',
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
      perfectHits,

      questsCleared,
      questsTotal: QUESTS.length,
      bossCleared,
      bossHpMax,

      quizTotal,
      quizCorrect,
      quizRecallPct: quizTotal ? (100*quizCorrect/quizTotal) : 0,

      medianStepMs: rtMed
    };

    if(coach?.getSummaryExtras) Object.assign(summary, coach.getSummaryExtras());
    if(dd?.getSummaryExtras) Object.assign(summary, dd.getSummaryExtras());

    if(WIN.HHA_Badges?.evaluateBadges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent =
      `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • quiz ${quizCorrect}/${quizTotal}`;

    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  function tick(){
    if(!running) return;
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

    // ===== PACK CD: Auto-enter quiz at last 30s (no boss running) =====
    if(!quizActive && timeLeft <= 30 && !bossActive){
      startQuiz(30);
    }

    // quiz loop
    if(quizActive){
      quizLeft -= dt;
      spawnAcc = 0;

      if(quizNeedNext && targets.length === 0){
        spawnQuizQuestion();
      }
      if(quizSub){
        // append remaining time
        const baseTxt = `ตอนนี้: ${STEPS[quizPromptStepIdx].icon} ${STEPS[quizPromptStepIdx].label} → เลือก “ขั้นถัดไป”`;
        quizSub.textContent = `${baseTxt} • เหลือ ${Math.max(0, quizLeft).toFixed(0)}s`;
      }
      if(quizLeft <= 0){
        endQuiz();
        showBanner(`🧠 จบ QUIZ! ได้ ${quizCorrect}/${quizTotal}`);
      }

      setHud();
      requestAnimationFrame(tick);
      return;
    }

    // ===== PACK CC: Quest3 Storm (เมื่อถึง q3) =====
    const q = questNow();
    if(q && q.id==='q3'){
      if(!stormActive && stormLeft<=0){
        maybeStartStorm();
      }
      if(stormActive){
        stormLeft -= dt;
        setQuestText(`QUEST 3/3 • ${q.title} — เหลือ ${Math.max(0, stormLeft).toFixed(0)}s`);
        if(stormLeft <= 0){
          stormActive = false;
          if(stormSafeOk){
            showBanner('✅ ผ่าน STORM! (ไม่โดน 🦠)');
            completeQuest();
          }else{
            showBanner('⚠️ STORM ไม่ผ่าน (โดน 🦠) — ลองใหม่ได้!');
            stormLeft = 0;
            stormSafeOk = true;
          }
        }
      }
    }

    // ===== PACK CC: Boss trigger (ท้ายเกม) =====
    if(!bossCleared && !bossActive){
      const ready = (questsCleared >= 3);
      if(ready && timeLeft <= 14){
        startBoss();
      }
    }

    // spawn normal
    const P = dd?.getParams?.() || base;
    spawnAcc += (P.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });

    setHud();
    requestAnimationFrame(tick);
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

  // optional badges/coach
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles?.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
    }
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    if(WIN.Particles?.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
    }
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // init
  resetGame();
}