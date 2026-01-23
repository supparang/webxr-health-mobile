// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Coach + DD)
// Emits: hha:start, hha:time, hha:score, hha:judge, quest:update, hha:end
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

function copyText(text){
  return navigator.clipboard?.writeText(String(text)).catch(()=>{});
}

// ------------------ Steps (emoji mapping) ------------------
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6, tip:'ถูฝ่ามือให้ทั่ว' },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6, tip:'ถูหลังมือซ้าย/ขวา' },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6, tip:'สอดนิ้วถูซอก' },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6, tip:'ถูข้อนิ้ววน ๆ' },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6, tip:'จับถูหัวแม่มือ' },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6, tip:'ขัดปลายนิ้ว/เล็บ' },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6, tip:'ถูข้อมือทั้งสอง' },
];
const ICON_HAZ = '🦠';

// ------------------ Quest System (ป.5 อ่านแล้วทำได้เลย) ------------------
// ต่อขั้น: ทำ hit ถูกให้ครบ N ภายในเวลา T วินาที (นับตั้งแต่เริ่มขั้น)
// ถ้าช้า/พลาด จะ reset quest ของขั้นนั้น (แต่ไม่ reset ขั้น ถ้ายังไม่ fail)
function makeQuestForStep(stepIdx, diff){
  // ง่าย/ปกติ/ยาก: แคบเวลาและเพิ่มความเข้ม
  const base = (diff==='easy') ? { need: 4, sec: 7 }
             : (diff==='hard') ? { need: 6, sec: 6 }
             : { need: 5, sec: 7 };

  // บางขั้นให้รู้สึกต่าง: nails/wrist ให้ “แม่นขึ้น”
  const sKey = STEPS[stepIdx]?.key || '';
  let need = base.need;
  let sec  = base.sec;

  if(sKey === 'nails'){ need += 1; sec -= (diff==='easy'?0:1); }
  if(sKey === 'wrist'){ sec  -= (diff==='easy'?0:1); }

  need = clamp(need, 3, 8);
  sec  = clamp(sec, 4, 10);

  return {
    stepIdx,
    needHits: need,
    limitSec: sec,
    startedAtMs: 0,
    hitsNow: 0,
    passed: false,
    fails: 0
  };
}

function questText(q){
  if(!q) return '🎯 QUEST: —';
  const s = STEPS[q.stepIdx];
  const left = Math.max(0, Math.ceil(q.limitSec - ((q.startedAtMs? (nowMs()-q.startedAtMs)/1000 : 0))));
  const done = q.passed ? '✅' : '';
  return `🎯 QUEST: ${done} ตี ${s.icon} ${q.hitsNow}/${q.needHits} ภายใน ${left}s`;
}

function nowMs(){ return performance.now ? performance.now() : Date.now(); }

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

  // AI instances (optional)
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
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];

  let spawnAcc=0;

  // quest state
  let quest = null;
  let miniCleared=0;
  let miniTotal=0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 150;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 130;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;

    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    // miss = wrong step hits + hazard hits
    return (wrongStepHits + hazHits);
  }

  function missLeft(){
    return Math.max(0, missLimit - getMissCount());
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function setQuestPill(){
    if(!pillQuest) return;
    pillQuest.textContent = questText(quest);
  }

  function newQuestForCurrentStep(){
    quest = makeQuestForStep(stepIdx, diff);
    quest.startedAtMs = nowMs();
    quest.hitsNow = 0;
    quest.passed = false;
    miniTotal++;
    emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow:0, passed:false } });
    setQuestPill();
  }

  function resetQuestBecauseFail(){
    if(!quest || quest.passed) return;
    quest.fails++;
    quest.startedAtMs = nowMs();
    quest.hitsNow = 0;
    emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow:0, passed:false, fails: quest.fails } });
    showBanner(`🔁 QUEST รีเซ็ต! ลองใหม่: ตีให้ทัน ${quest.limitSec}s`);
    setQuestPill();
  }

  function passQuest(){
    if(!quest || quest.passed) return;
    quest.passed = true;
    miniCleared++;
    emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow: quest.hitsNow, passed:true } });
    showBanner(`🏅 QUEST ผ่าน! +คอมโบโบนัส`);
    combo += 2; // โบนัสให้รู้สึกสะใจ
    comboMax = Math.max(comboMax, combo);
    setQuestPill();
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS เหลือ ${missLeft()}`);

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    // สื่อสารแบบเด็กป.5: “ทำอะไรอยู่”
    hudSub && (hudSub.textContent = `ทำ: ${s.tip} • ${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);

    setQuestPill();
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
    el.style.setProperty('--s', (0.92 + rng()*0.22).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    // click/tap only for non-cVR strict
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
    const s = STEPS[stepIdx];
    const P = dd ? dd.getParams() : base;

    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      // wrong step emoji
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

  // cVR shooting
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

  function maybeWarnComboBreak(){
    // สำหรับเด็ก: “อีก 3 จะขาด” = ถ้าเพิ่งพลาด ให้เตือนชัด
    if(combo > 0 && combo <= 3){
      showBanner(`⚡ คอมโบใกล้ขาด! เหลือ ${combo} ก่อนรีเซ็ต`);
    }
  }

  function touchHitFx(obj){
    try{
      obj.el.classList.add('hit');
      setTimeout(()=>obj.el && obj.el.classList.remove('hit'), 140);
    }catch(_){}
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // ---- QUEST timeout check (ถ้าข้ามเวลา ให้รีเซ็ต quest)
    if(quest && !quest.passed){
      const dtQ = (nowMs() - quest.startedAtMs) / 1000;
      if(dtQ > quest.limitSec){
        resetQuestBecauseFail();
      }
    }

    if(obj.kind === 'good'){
      touchHitFx(obj);

      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      // quest progress
      if(quest && !quest.passed){
        if(quest.startedAtMs === 0) quest.startedAtMs = nowMs();
        quest.hitsNow++;
        emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow: quest.hitsNow, passed:false } });
        if(quest.hitsNow >= quest.needHits){
          passQuest();
        }else{
          setQuestPill();
        }
      }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ตี ${STEPS[stepIdx].icon} +1`);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        // ถ้าควสท์ยังไม่ผ่าน ให้ reset เพื่อความแฟร์ (เด็กจะได้ “มีเป้าหมาย”)
        if(quest && !quest.passed){
          resetQuestBecauseFail();
        }

        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
        }else{
          showBanner(`➡️ ขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }

        // new quest for new step
        newQuestForCurrentStep();
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      touchHitFx(obj);

      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้น! ตอนนี้ต้องตี ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      // quest reset on mistake (ทำให้เด็กโฟกัส “ถูกขั้น”)
      if(quest && !quest.passed) resetQuestBecauseFail();

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      touchHitFx(obj);

      hazHits++;
      combo = 0;

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! หลบให้ไว (MISS เหลือ ${missLeft()})`);

      // quest reset on hazard
      if(quest && !quest.passed) resetQuestBecauseFail();

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }else{
      // warning about miss remaining
      if(missLeft() === 1) showBanner(`🚨 ระวัง! เหลือ MISS อีก 1 ครั้ง`);
      if(missLeft() === 2) showBanner(`⚠️ เหลือ MISS อีก 2 ครั้ง`);
      maybeWarnComboBreak();
    }
  }

  function tick(){
    if(!running) return;
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

    // quest timeout update
    if(quest && !quest.passed){
      const dtQ = (nowMs() - quest.startedAtMs) / 1000;
      if(dtQ > quest.limitSec){
        resetQuestBecauseFail();
      }else{
        setQuestPill();
      }
    }

    // spawn
    const P = dd ? dd.getParams() : base;
    spawnAcc += (P.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });

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

    // quest
    quest = null;
    miniCleared = 0;
    miniTotal = 0;

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    // start quest for step 1
    newQuestForCurrentStep();

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    showBanner(`เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();

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

    // grade (simple + อ่านง่าย)
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

      medianStepMs: rtMed,

      // ✅ quest summary (ให้ HUB ตรวจได้)
      miniCleared,
      miniTotal,
      goalsCleared: loopsDone,              // ใช้ loops เป็น goal แบบง่าย
      goalsTotal: Math.max(1, loopsDone)    // (ถ้าจะปรับแบบอื่นค่อยทำต่อ)
    };

    if(coach) Object.assign(summary, coach.getSummaryExtras());
    if(dd) Object.assign(summary, dd.getSummaryExtras());

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (MISS เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • quest ${miniCleared}/${miniTotal}`;
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

  // optional popups
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
    }
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
    }
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // initial HUD
  setHud();
}