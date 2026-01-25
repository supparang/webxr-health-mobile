// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (v1.6.0-prod)
// ✅ 7 steps emoji targets
// ✅ Mini-Quiz 3 questions (pause spawn)
// ✅ Soap Shield bonus (blocks 1 hazard)
// ✅ Quest 3 milestones + pillQuest
// ✅ cVR shoot via hha:shoot center lockPx
// ✅ End summary -> HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY

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

const ICON_HAZ  = '🦠';
const ICON_SOAP = '🧼';

// ------------------ QUIZ (3 items) ------------------
const QUIZ = [
  {
    id:'q1',
    q:'ขั้นตอน “ซอกนิ้ว” ใช้ท่าไหน?',
    sub:'เลือกคำตอบที่สื่อความถูกต้องที่สุด',
    choices:[
      { t:'🧩 ถูซอกนิ้วแบบประสานนิ้ว', ok:true },
      { t:'👍 ถูหัวแม่มืออย่างเดียว', ok:false },
      { t:'💅 ถูปลายนิ้ว/เล็บก่อน', ok:false },
    ]
  },
  {
    id:'q2',
    q:'ทำไมต้องถู “ปลายนิ้ว/เล็บ” ?',
    sub:'เลือกข้อที่ถูก',
    choices:[
      { t:'💅 เพราะสิ่งสกปรกสะสมใต้เล็บได้', ok:true },
      { t:'🫧 เพราะทำให้ฟองเยอะขึ้น', ok:false },
      { t:'⌚ เพราะถูข้อมือก่อนเสมอ', ok:false },
    ]
  },
  {
    id:'q3',
    q:'คำท่อง 7 ขั้นตอนที่ถูกต้องคือ?',
    sub:'เลือกชุดคำที่ถูก',
    choices:[
      { t:'ฝ่า-หลัง-ซอก-ข้อ-โป้ง-เล็บ-ข้อมือ', ok:true },
      { t:'ฝ่า-ซอก-หลัง-ข้อ-เล็บ-โป้ง-ข้อมือ', ok:false },
      { t:'หลัง-ฝ่า-ข้อ-ซอก-โป้ง-เล็บ-ข้อมือ', ok:false },
    ]
  },
];

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep  = DOC.getElementById('pillStep');
  const pillHits  = DOC.getElementById('pillHits');
  const pillCombo = DOC.getElementById('pillCombo');
  const pillMiss  = DOC.getElementById('pillMiss');
  const pillRisk  = DOC.getElementById('pillRisk');
  const pillTime  = DOC.getElementById('pillTime');
  const pillQuest = DOC.getElementById('pillQuest');
  const hudSub    = DOC.getElementById('hudSub');
  const banner    = DOC.getElementById('banner');

  // Boss UI (optional)
  const bossBar   = DOC.getElementById('bossBar');
  const bossFill  = DOC.getElementById('bossFill');
  const bossTitle = DOC.getElementById('bossTitle');
  const bossSub   = DOC.getElementById('bossSub');

  // Quiz UI
  const quizBox   = DOC.getElementById('quizBox');
  const quizQ     = DOC.getElementById('quizQ');
  const quizSub   = DOC.getElementById('quizSub');
  const quizAns   = DOC.getElementById('quizAns');
  const quizHint  = DOC.getElementById('quizHint');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart     = DOC.getElementById('btnStart');
  const btnRestart   = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff    = (qs('diff','normal')||'normal').toLowerCase();
  const view    = (qs('view','pc')||'pc').toLowerCase();
  const hub     = qs('hub','');
  const kids    = (qs('kids','0') === '1');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng  = makeRNG(seed);

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec: kids?1.55:1.8, hazardRate:0.085, decoyRate:0.18, soapRate:0.07 };
    if(diff==='hard') return { spawnPerSec: kids?2.15:2.6, hazardRate:0.14,  decoyRate:0.26, soapRate:0.06 };
    return { spawnPerSec: kids?1.85:2.2, hazardRate:0.12,  decoyRate:0.22, soapRate:0.065 };
  })();

  // state
  let running=false, paused=false, quizMode=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0;
  let hitsInStep=0;
  let loopsDone=0;

  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;         // only when not blocked
  let hazBlocked=0;      // how many blocked by shield
  const missLimit = 3;

  let shield=0;          // ✅ soap bonus

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = []; // ms
  let spawnAcc=0;

  // quiz tracking
  let quizIndex=0;
  const quizShown = new Set();

  // quests (3)
  const quest = {
    q1:false, // loop 1 done with acc >=0.80
    q2:false, // reach combo >=12 anytime
    q3:false, // finish with miss <=1 (evaluated end)
  };

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1300);
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 150;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 130;
    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad + (parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat'))||0);
    const y1 = h - bottomSafe - pad;
    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    // miss = wrong step hits + hazard hits (blocked does NOT count)
    return (wrongStepHits + hazHits);
  }

  function stepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function setQuestText(){
    if(!pillQuest) return;
    const parts = [];
    parts.push(`🛡 ${shield}`);
    parts.push(`🎯 Q${(quest.q1?1:0)+(quest.q2?1:0)+0}/2`); // show first 2 live
    // show quiz progress
    parts.push(`❓ ${Math.min(quizIndex,3)}/3`);
    pillQuest.textContent = `QUEST ${parts.join(' • ')}`;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const acc = stepAcc();
    const riskIncomplete = clamp(1 - acc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    if(pillTime){
      const t = Math.max(0, Math.ceil(timeLeft));
      pillTime.textContent = `TIME ${t}`;
      pillTime.classList.toggle('urgent', t <= 10);
      DOC.body.classList.toggle('last3', t <= 3);
    }

    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • loops=${loopsDone}`);
    setQuestText();
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

    // click/tap only for non-cVR strict
    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHit(obj, 'tap', null), { passive:true });
    }
    return obj;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    // soap appears occasionally (more helpful when miss high)
    const miss = getMissCount();
    const soapRate = clamp(base.soapRate + miss*0.02, 0.05, 0.18);

    const r = rng();
    if(r < base.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < base.hazardRate + soapRate){
      return createTarget('soap', ICON_SOAP, -2);
    }else if(r < base.hazardRate + soapRate + base.decoyRate){
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

  function onHit(obj, source, extra){
    if(!running || paused || quizMode) return;

    const rt = computeRt(obj);

    // ✅ SOAP = shield + combo bonus
    if(obj.kind === 'soap'){
      shield = clamp(shield + 1, 0, 3);
      combo = combo + 2;            // tiny reward
      comboMax = Math.max(comboMax, combo);
      showBanner(`🧼 ได้โล่! 🛡 +1 (ตอนนี้ ${shield})`);
      emit('hha:judge', { kind:'soap', rtMs:rt, source, extra, shield });
      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      // quest2: combo 12+
      if(!quest.q2 && comboMax >= 12){
        quest.q2 = true;
        showBanner('🏅 QUEST: คอมโบ 12 สำเร็จ!');
      }

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);

          // quest1: first loop with acc >= 0.80
          if(!quest.q1 && loopsDone >= 1 && stepAcc() >= 0.80){
            quest.q1 = true;
            showBanner('🏅 QUEST: รอบแรกแม่น ≥ 80% สำเร็จ!');
          }

          // trigger quiz after loop 1,2,3 (max 3)
          maybeStartQuiz();
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
      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      // ✅ shield blocks hazard
      if(shield > 0){
        shield--;
        hazBlocked++;
        combo = Math.max(0, combo - 1); // soft penalty but not miss
        emit('hha:judge', { kind:'block', stepIdx, rtMs: rt, source, extra, shield });
        showBanner(`🛡 BLOCK! โล่เหลือ ${shield}`);
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      combo = 0;
      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function onShoot(e){
    if(!running || paused || quizMode) return;
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
      onHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  // ------------------ QUIZ FLOW ------------------
  function maybeStartQuiz(){
    if(quizIndex >= 3) return;
    const item = QUIZ[quizIndex];
    if(!item || quizShown.has(item.id)) return;
    // start quiz
    quizShown.add(item.id);
    quizIndex++;
    startQuiz(item);
  }

  function startQuiz(item){
    quizMode = true;
    // pause gameplay spawn
    clearTargets();

    if(!quizBox || !quizQ || !quizSub || !quizAns) {
      // if HTML doesn't have quiz, just end quizMode safely
      quizMode = false;
      return;
    }

    quizBox.style.display = 'block';
    quizQ.textContent = `❓ ${item.q}`;
    quizSub.textContent = item.sub || 'เลือกคำตอบ';

    quizAns.innerHTML = '';
    (item.choices||[]).forEach((c, idx)=>{
      const b = DOC.createElement('button');
      b.type = 'button';
      b.className = 'hw-ans';
      b.textContent = c.t;
      b.addEventListener('click', ()=>{
        resolveQuiz(!!c.ok, idx, item);
      }, { passive:true });
      quizAns.appendChild(b);
    });

    if(quizHint) quizHint.textContent = 'ตอบให้ถูกเพื่อรับโบนัส 🛡 +1 และคอมโบ +3';

    showBanner('🧠 MINI QUIZ! ตอบให้ไว');
    setHud();
  }

  function resolveQuiz(ok, choiceIndex, item){
    if(!quizBox || !quizAns) return;

    // lock buttons
    const btns = Array.from(quizAns.querySelectorAll('button'));
    btns.forEach((b, i)=>{
      const isPicked = (i === choiceIndex);
      if(isPicked) b.classList.add(ok?'good':'bad');
      b.disabled = true;
      b.style.opacity = isPicked ? '1' : '.55';
    });

    if(ok){
      shield = clamp(shield + 1, 0, 3);
      combo += 3;
      comboMax = Math.max(comboMax, combo);
      showBanner(`✅ ถูก! รับ 🛡 +1 (โล่ ${shield})`);
      emit('hha:judge', { kind:'quiz_ok', quizId:item.id, shield, combo });
    }else{
      combo = 0;
      showBanner('❌ ยังไม่ถูก! ระวังลืมขั้นตอน');
      emit('hha:judge', { kind:'quiz_bad', quizId:item.id });
    }

    // close quiz after short delay
    setTimeout(()=>{
      quizBox.style.display = 'none';
      quizAns.innerHTML = '';
      quizMode = false;
      setHud();
    }, 900);
  }

  // ------------------ LOOP ------------------
  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }
    if(quizMode){ requestAnimationFrame(tick); return; }

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
      if(targets.length > (kids?14:18)){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false; quizMode=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0; hazBlocked=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;
    spawnAcc=0;
    shield=0;

    quizIndex=0;
    quizShown.clear();
    quest.q1=false; quest.q2=false; quest.q3=false;

    // hide quiz
    if(quizBox){ quizBox.style.display='none'; }
    if(quizAns){ quizAns.innerHTML=''; }

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    clearTargets();

    // quest3 at end: miss <= 1
    if(getMissCount() <= 1) quest.q3 = true;

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const acc = stepAcc();
    const riskIncomplete = clamp(1 - acc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    const rtMed = (()=> {
      const a = rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 0;
      const m = (a.length-1)/2;
      return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
    })();

    // grade (simple)
    let grade='C';
    if(acc>=0.90 && hazHits<=1) grade='SSS';
    else if(acc>=0.82 && hazHits<=2) grade='SS';
    else if(acc>=0.75 && hazHits<=3) grade='S';
    else if(acc>=0.68) grade='A';
    else if(acc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.6.0-prod',
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
      hazBlocked,
      shieldEnd: shield,

      stepAcc: acc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),
      medianStepMs: rtMed,

      quizDone: quizIndex,
      questQ1: quest.q1,
      questQ2: quest.q2,
      questQ3: quest.q3,
    };

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle && (endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅');
    endSub && (endSub.textContent =
      `Grade ${grade} • acc ${(acc*100).toFixed(1)}% • miss ${getMissCount()} • blocks ${hazBlocked} • quiz ${quizIndex}/3 • loops ${loopsDone}`
    );

    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay && (endOverlay.style.display = 'grid');
  }

  // ------------------ UI binds ------------------
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // initial
  setHud();
}