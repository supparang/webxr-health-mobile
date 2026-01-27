// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Random Quiz + FX)
// ✅ Exports: boot()
// ✅ FX: Particles.popText / burst (optional)
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
function loadJson(key, fb){
  try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}
function nowIso(){ try{return new Date().toISOString();}catch{ return ''; } }
function nowMs(){ return performance.now ? performance.now() : Date.now(); }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

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

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage){
    console.error('[Hygiene] stage not found');
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
  const fxOn = (qs('fx','1') !== '0');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.08, decoyRate:0.16 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.11, decoyRate:0.22 };
  })();

  // AI instances (optional)
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({
    seed, runMode,
    base,
    bounds:{ spawnPerSec:[1.2, 4.2], hazardRate:[0.05, 0.26], decoyRate:[0.10, 0.40] }
  }) : null;

  // FX helpers (optional)
  const P = WIN.Particles || null;
  function fxText(x,y,text,cls){
    if(!fxOn) return;
    if(P && typeof P.popText === 'function') P.popText(x,y,text,cls||'');
  }
  function fxBurst(x,y,cls){
    if(!fxOn) return;
    if(P && typeof P.burst === 'function') P.burst(x,y,{ count: 12, spread: 44, upBias: 0.78, className: cls||'' });
  }
  function fxAtTarget(obj, text, cls, burstCls){
    if(!obj) return;
    if(text) fxText(obj.x, obj.y, text, cls);
    if(burstCls) fxBurst(obj.x, obj.y, burstCls);
  }
  function fxBannerTop(text, cls){
    if(!fxOn) return;
    fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.18, text, cls||'cyan');
  }

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
  const rtOk = []; // ms
  let spawnAcc=0;

  // quest/quiz
  let questText = 'ทำ STEP ให้ถูก!';
  let questDone = 0;
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

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

  function setQuizVisible(on){
    quizOpen = !!on;
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
  }

  function pickQuiz(){
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    const q = bank[Math.floor(rng()*bank.length)];
    return q || null;
  }

  function openRandomQuiz(){
    const q = pickQuiz();
    if(!q || !quizQ || !quizSub) return;

    setQuizVisible(true);
    quizQ.textContent = `🧠 Quiz: ${q.q}`;

    const options = [q.a].concat((q.wrong||[]).slice(0,3));
    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i],options[j]] = [options[j],options[i]];
    }
    quizSub.textContent = 'ตัวเลือก: ' + options.map((x,i)=>`${i+1}) ${x}`).join('  •  ')
      + '  (ตอบโดย “ทำถูกต่อเนื่อง 2 ครั้ง” เพื่อยืนยัน)';

    quizOpen._armed = true;
    quizOpen._t0 = nowMs();
    quizOpen._needStreak = 2;
    quizOpen._streak = 0;

    fxBannerTop('🧠 QUIZ!', 'cyan');
  }

  function closeQuiz(msg){
    if(quizOpen){
      setQuizVisible(false);
      quizOpen = false;
      quizOpen._armed = false;
      if(msg) showBanner(msg);
    }
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 170;
    const bottomSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 170;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafe - pad;

    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    return (wrongStepHits + hazHits);
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

    pillQuest && (pillQuest.textContent = `QUEST ${questText}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • fx=${fxOn?1:0}`);
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

  function spawnOne(){
    const Pp = dd ? dd.getParams() : base;
    const r = rng();
    if(r < Pp.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < Pp.hazardRate + Pp.decoyRate){
      let j = stepIdx;
      for(let k=0;k<7;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', STEPS[stepIdx].icon, stepIdx);
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
    }else{
      // ยิงพลาดใน cVR (ให้รู้สึกมี feedback)
      fxText(cx, cy, '…', 'warn');
    }
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function bumpQuestOnGoodHit(){
    const t = elapsedSec();
    if(t < 2) return;

    if(!bumpQuestOnGoodHit._nextAt){
      bumpQuestOnGoodHit._nextAt = 10 + rng()*10;
      return;
    }
    if(t < bumpQuestOnGoodHit._nextAt) return;

    bumpQuestOnGoodHit._nextAt = t + (12 + rng()*10);

    const roll = rng();
    if(roll < 0.34){
      questText = 'คอมโบถึง 8!';
      questDone = (combo >= 8) ? 1 : 0;
    }else if(roll < 0.67){
      questText = 'อย่าโดน 🦠 10 วิ!';
      questDone = 0;
      bumpQuestOnGoodHit._noHazUntil = t + 10;
    }else{
      questText = 'ผ่าน STEP นี้ไว!';
      questDone = 0;
      bumpQuestOnGoodHit._fastStepT0 = nowMs();
      bumpQuestOnGoodHit._fastStepIdx = stepIdx;
    }

    showBanner(`🎯 QUEST: ${questText}`);
    fxBannerTop(`🎯 QUEST!`, 'cyan');
  }

  function updateQuestTick(){
    const t = elapsedSec();
    if(bumpQuestOnGoodHit._noHazUntil){
      if(t >= bumpQuestOnGoodHit._noHazUntil){
        questDone = 1;
        bumpQuestOnGoodHit._noHazUntil = 0;
        showBanner('🏅 QUEST ผ่าน!');
        fxBannerTop('🏅 QUEST ผ่าน!', 'good');
      }
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

      // FX: hit good
      fxAtTarget(obj, `✅ +1`, 'good', 'good');
      if(combo === 5) fxBannerTop('🔥 COMBO 5!', 'cyan');
      if(combo === 8) fxBannerTop('⚡ COMBO 8!', 'cyan');

      // quiz armed streak
      if(quizOpen && quizOpen._armed){
        const within = (nowMs() - quizOpen._t0) <= 4000;
        if(within){
          quizOpen._streak++;
          if(quizOpen._streak >= (quizOpen._needStreak||2)){
            quizRight++;
            closeQuiz('✅ Quiz ผ่าน!');
            fxBannerTop('✅ QUIZ ผ่าน!', 'good');
          }
        }else{
          closeQuiz(null);
        }
      }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });
      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      bumpQuestOnGoodHit();
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        const prevStep = stepIdx;

        stepIdx++;
        hitsInStep=0;

        // fast step quest check
        if(bumpQuestOnGoodHit._fastStepIdx === prevStep){
          const dt = nowMs() - (bumpQuestOnGoodHit._fastStepT0||nowMs());
          if(dt <= 6500){
            questDone = 1;
            showBanner('🏅 QUEST ผ่าน! (ไวมาก)');
            fxBannerTop('🏅 ไวมาก!', 'good');
          }
        }

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          fxBannerTop(`🏁 ครบ 7! x${loopsDone}`, 'cyan');

          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          fxBannerTop(`➡️ STEP ${stepIdx+1}`, 'cyan');

          if(!quizOpen && rng() < 0.25) openRandomQuiz();
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    // wrong step
    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      fxAtTarget(obj, '⚠️ ผิด!', 'warn', 'warn');

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
        fxBannerTop('❌ QUIZ พลาด', 'bad');
      }

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    // hazard
    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      fxAtTarget(obj, '🦠 โดน!', 'bad', 'bad');

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
        fxBannerTop('❌ QUIZ พลาด', 'bad');
      }

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      if(getMissCount() >= missLimit) endGame('fail');
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
    const Pp = dd ? dd.getParams() : base;
    spawnAcc += (Pp.spawnPerSec * dt);

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });
    updateQuestTick();
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

    questText = 'ทำ STEP ให้ถูก!';
    questDone = 0;
    quizRight = 0;
    quizWrong = 0;
    setQuizVisible(false);
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
    fxBannerTop('🧼 START!', 'cyan');
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    clearTargets();
    setQuizVisible(false);

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
      version:'1.0.1-prod',
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

      quizRight,
      quizWrong,
      questText,
      questDone,

      medianStepMs: rtMed,
      fxOn
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

    // end FX
    if(reason==='fail') fxBannerTop('❌ FAIL', 'bad');
    else fxBannerTop(`🏁 END ${grade}`, 'cyan');

    // show end UI
    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); fxBannerTop('↻ RESET', 'warn'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
    fxBannerTop(paused ? '⏸ PAUSE' : '▶ RESUME', paused ? 'warn' : 'cyan');
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // optional: badge -> FX
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    fxBannerTop(`${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // initial
  setHud();

  // tiny diagnostics (helps when user says "effect หาย")
  if(fxOn && !P) console.warn('[Hygiene] FX ON but window.Particles is missing (particles.js not loaded?)');
  if(!Array.isArray(WIN.HHA_HYGIENE_QUIZ_BANK)) console.warn('[Hygiene] Quiz bank missing: window.HHA_HYGIENE_QUIZ_BANK');
}