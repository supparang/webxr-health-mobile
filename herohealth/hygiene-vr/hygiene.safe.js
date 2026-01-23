// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Shield + Fever + Boss Wave)
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
function nowMs(){ return performance.now ? performance.now() : Date.now(); }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

// ------------------ Steps ------------------
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6, tip:'ถูฝ่ามือให้ทั่ว' },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6, tip:'ถูหลังมือซ้าย/ขวา' },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6, tip:'สอดนิ้วถูซอก' },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6, tip:'ถูข้อนิ้ววน ๆ' },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6, tip:'จับถูหัวแม่มือ' },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6, tip:'ขัดปลายนิ้ว/เล็บ' },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6, tip:'ถูข้อมือทั้งสอง' },
];

const ICON_HAZ    = '🦠';
const ICON_SHIELD = '🧼';
const ICON_FEVER  = '🔥';

// ------------------ Quest ------------------
function makeQuestForStep(stepIdx, diff){
  const base = (diff==='easy') ? { need: 4, sec: 7 }
             : (diff==='hard') ? { need: 6, sec: 6 }
             : { need: 5, sec: 7 };

  const k = STEPS[stepIdx]?.key || '';
  let need = base.need, sec = base.sec;
  if(k === 'nails'){ need += 1; sec -= (diff==='easy'?0:1); }
  if(k === 'wrist'){ sec  -= (diff==='easy'?0:1); }

  need = clamp(need, 3, 8);
  sec  = clamp(sec, 4, 10);

  return { stepIdx, needHits: need, limitSec: sec, startedAtMs: 0, hitsNow: 0, passed: false, fails: 0 };
}
function questText(q){
  if(!q) return '🎯 QUEST: —';
  const s = STEPS[q.stepIdx];
  const left = Math.max(0, Math.ceil(q.limitSec - ((q.startedAtMs? (nowMs()-q.startedAtMs)/1000 : 0))));
  const done = q.passed ? '✅' : '';
  return `🎯 QUEST: ${done} ตี ${s.icon} ${q.hitsNow}/${q.needHits} ภายใน ${left}s`;
}

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep   = DOC.getElementById('pillStep');
  const pillHits   = DOC.getElementById('pillHits');
  const pillCombo  = DOC.getElementById('pillCombo');
  const pillMiss   = DOC.getElementById('pillMiss');
  const pillRisk   = DOC.getElementById('pillRisk');
  const pillTime   = DOC.getElementById('pillTime');
  const pillQuest  = DOC.getElementById('pillQuest');
  const pillFever  = DOC.getElementById('pillFever');
  const pillShield = DOC.getElementById('pillShield');
  const hudSub     = DOC.getElementById('hudSub');
  const banner     = DOC.getElementById('banner');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

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
  const hub     = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng  = makeRNG(seed);

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // difficulty base
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, shieldRate:0.045 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26, shieldRate:0.030 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, shieldRate:0.038 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    shieldRate:[0.015, 0.08],
  };

  // Optional AI packs
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd    = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // ---------------- State ----------------
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0, hitsInStep=0, loopsDone=0;

  let combo=0, comboMax=0;
  let wrongStepHits=0, hazHits=0;
  const missLimit = 3;

  let correctHits=0, totalStepHits=0;
  const rtOk = [];

  let spawnAcc=0;

  // Quest
  let quest = null;
  let miniCleared=0, miniTotal=0;

  // Powerups
  let shield = 0;               // 0..1
  let fever = 0;                // 0..100
  let feverOn = false;
  let feverLeftMs = 0;

  // Score
  let score = 0;
  let scoreMult = 1;

  // Boss Wave (Storm)
  let stormOn = false;
  let stormLeftMs = 0;
  let nextStormAtSec = 22; // start around 22s then periodic
  let stormCount = 0;

  // targets
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
    return { x0:pad, x1:w-pad, y0:topSafe+pad, y1:h-bottomSafe-pad, w, h };
  }

  function getMissCount(){ return wrongStepHits + hazHits; }
  function missLeft(){ return Math.max(0, missLimit - getMissCount()); }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs()-tStartMs)/1000) : 0; }

  function setQuestPill(){
    if(pillQuest) pillQuest.textContent = questText(quest);
  }
  function setPowerPills(){
    if(pillShield) pillShield.textContent = `🧼 SHIELD ${shield}`;
    if(pillFever) pillFever.textContent = `${ICON_FEVER} FEVER ${Math.round(fever)}%${feverOn ? ' (x2)' : ''}`;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    if(pillStep)  pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`;
    if(pillHits)  pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`;
    if(pillCombo) pillCombo.textContent = `COMBO ${combo}`;
    if(pillMiss)  pillMiss.textContent = `MISS เหลือ ${missLeft()}`;

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1-stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1,(loopsDone+1)*2), 0, 1);

    if(pillRisk) pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`;
    if(pillTime) pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`;

    if(hudSub) hudSub.textContent = `ทำ: ${s.tip} • SCORE ${score} • ${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}${stormOn?' • 🌪 STORM!':''}`;

    setQuestPill();
    setPowerPills();
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
    showBanner(`🔁 QUEST รีเซ็ต! ทำให้ทัน ${quest.limitSec}s`);
    setQuestPill();
  }

  function passQuest(){
    if(!quest || quest.passed) return;
    quest.passed = true;
    miniCleared++;
    emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow: quest.hitsNow, passed:true } });

    // reward: fever boost + score bonus
    addFever(18);
    addScore(40, 'quest');

    combo += 2;
    comboMax = Math.max(comboMax, combo);

    showBanner(`🏅 QUEST ผ่าน! +โบนัส +FEVER`);
    setQuestPill();
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function touchHitFx(obj){
    try{
      obj.el.classList.add('hit');
      setTimeout(()=>obj.el && obj.el.classList.remove('hit'), 140);
    }catch(_){}
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type = 'button';
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

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function addScore(basePts, reason){
    const pts = Math.round(basePts * scoreMult);
    score += pts;
    emit('hha:score', { score, pts, reason, mult: scoreMult, feverOn });
  }

  function addFever(d){
    fever = clamp(fever + d, 0, 100);
    if(!feverOn && fever >= 100){
      startFever();
    }
  }

  function decayFever(d){
    fever = clamp(fever - d, 0, 100);
  }

  function startFever(){
    feverOn = true;
    feverLeftMs = 8000;
    scoreMult = 2;
    DOC.body.classList.add('fever-on');
    showBanner(`${ICON_FEVER} FEVER ON! คะแนน x2`);
  }

  function endFever(){
    feverOn = false;
    feverLeftMs = 0;
    scoreMult = 1;
    DOC.body.classList.remove('fever-on');
    showBanner(`✅ FEVER จบแล้ว`);
  }

  function startStorm(){
    stormOn = true;
    stormLeftMs = 6000;
    stormCount++;
    showBanner(`🌪 STORM WAVE! หลบเชื้อให้ดี`);
  }

  function endStorm(){
    stormOn = false;
    stormLeftMs = 0;
    showBanner(`✅ STORM ผ่าน!`);
  }

  function currentSpawnParams(){
    // base from DD or preset
    const P0 = dd ? dd.getParams() : base;
    let P = { ...P0 };

    // Storm makes it harder
    if(stormOn){
      P.spawnPerSec = clamp(P.spawnPerSec * 1.25, bounds.spawnPerSec[0], bounds.spawnPerSec[1]);
      P.hazardRate  = clamp(P.hazardRate + 0.06, bounds.hazardRate[0], bounds.hazardRate[1]);
      P.decoyRate   = clamp(P.decoyRate + 0.04, bounds.decoyRate[0], bounds.decoyRate[1]);
      // ให้แฟร์: storm เพิ่มโอกาส shield นิดนึง
      P.shieldRate  = clamp(P.shieldRate + 0.020, bounds.shieldRate[0], bounds.shieldRate[1]);
    }

    // Fever makes it “มันส์แต่แฟร์”: ลด hazard เล็กน้อย ให้เด็กโกยคะแนน
    if(feverOn){
      P.spawnPerSec = clamp(P.spawnPerSec * 1.15, bounds.spawnPerSec[0], bounds.spawnPerSec[1]);
      P.hazardRate  = clamp(P.hazardRate - 0.02, bounds.hazardRate[0], bounds.hazardRate[1]);
    }

    return P;
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = currentSpawnParams();

    const r = rng();

    // Shield drop (ถ้าไม่มี shield อยู่แล้ว จะมีโอกาสเกิด)
    if(shield < 1 && r < P.shieldRate){
      return createTarget('good', ICON_SHIELD, -2); // kind=good แต่ stepRef -2 => shield
    }

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
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
      return true;
    }
    if(missLeft() === 1) showBanner(`🚨 เหลือ MISS อีก 1 ครั้ง`);
    if(missLeft() === 2) showBanner(`⚠️ เหลือ MISS อีก 2 ครั้ง`);
    return false;
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // quest timeout check
    if(quest && !quest.passed){
      const dtQ = (nowMs() - quest.startedAtMs) / 1000;
      if(dtQ > quest.limitSec) resetQuestBecauseFail();
    }

    // ---- SHIELD pickup (emoji 🧼)
    if(obj.kind === 'good' && obj.stepIdx === -2){
      touchHitFx(obj);
      shield = 1;
      addScore(25, 'shield_pickup');
      addFever(10);
      showBanner(`🧼 ได้ SHIELD! กันเชื้อได้ 1 ครั้ง`);
      removeTarget(obj);
      setHud();
      return;
    }

    // ---- GOOD step
    if(obj.kind === 'good'){
      touchHitFx(obj);

      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      addScore(10, 'hit_good');
      addFever(feverOn ? 3 : 6);

      // quest progress
      if(quest && !quest.passed){
        if(quest.startedAtMs === 0) quest.startedAtMs = nowMs();
        quest.hitsNow++;
        emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow: quest.hitsNow, passed:false } });
        if(quest.hitsNow >= quest.needHits) passQuest();
        else setQuestPill();
      }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        if(quest && !quest.passed) resetQuestBecauseFail();

        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          addScore(60, 'loop_clear');
          addFever(12);
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
        }else{
          showBanner(`➡️ ขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }

        newQuestForCurrentStep();
      }else{
        showBanner(`✅ ถูกต้อง! ตี ${STEPS[stepIdx].icon} +1`);
      }

      removeTarget(obj);
      setHud();
      return;
    }

    // ---- WRONG step
    if(obj.kind === 'wrong'){
      touchHitFx(obj);

      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      decayFever(18);

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้น! ตอนนี้ต้องตี ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      if(quest && !quest.passed) resetQuestBecauseFail();

      removeTarget(obj);
      if(checkFail()) return;
      setHud();
      return;
    }

    // ---- HAZARD
    if(obj.kind === 'haz'){
      touchHitFx(obj);

      // ✅ Shield blocks hazard
      if(shield > 0){
        shield = 0;
        addScore(15, 'shield_block');
        addFever(8);
        showBanner(`🧼 SHIELD บล็อกเชื้อ! รอดแล้ว`);
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      combo = 0;
      decayFever(24);

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! MISS เหลือ ${missLeft()}`);
      if(quest && !quest.passed) resetQuestBecauseFail();

      removeTarget(obj);
      if(checkFail()) return;
      setHud();
      return;
    }
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
    if(timeLeft <= 0){ endGame('time'); return; }

    // boss wave scheduling
    const es = elapsedSec();
    if(!stormOn && es >= nextStormAtSec){
      startStorm();
      // next storm later: 22..28 sec spacing (seeded-ish using rng)
      nextStormAtSec = es + 22 + Math.floor(rng()*7);
    }

    if(stormOn){
      stormLeftMs -= dt*1000;
      if(stormLeftMs <= 0) endStorm();
    }

    // fever timer
    if(feverOn){
      feverLeftMs -= dt*1000;
      if(feverLeftMs <= 0){
        endFever();
        fever = 40; // หลังจบยังเหลือบางส่วน ไม่ตกเหว
      }
    }

    // quest timeout update
    if(quest && !quest.passed){
      const dtQ = (nowMs() - quest.startedAtMs) / 1000;
      if(dtQ > quest.limitSec) resetQuestBecauseFail();
      else setQuestPill();
    }

    // spawn
    const P = currentSpawnParams();
    spawnAcc += (P.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec: es });
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

    quest=null; miniCleared=0; miniTotal=0;

    shield=0; fever=0; feverOn=false; feverLeftMs=0;
    score=0; scoreMult=1;

    stormOn=false; stormLeftMs=0; nextStormAtSec=22; stormCount=0;
    DOC.body.classList.remove('fever-on');

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display='none';
    endOverlay.style.display='none';

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
    DOC.body.classList.remove('fever-on');

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1-stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1,(loopsDone+1)*2), 0, 1);

    const rtMed = (()=> {
      const a = rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 0;
      const m = (a.length-1)/2;
      return (a.length%2) ? a[m|0] : (a[m|0]+a[(m|0)+1])/2;
    })();

    // grade (รวม score)
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1 && score>=900) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2 && score>=700) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3 && score>=520) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.2.0-prod',
      game:'hygiene',
      gameMode:'hygiene',
      runMode, diff, view, seed, sessionId,
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

      score,
      stormCount,
      miniCleared,
      miniTotal,

      medianStepMs: rtMed
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
    saveJson(LS_HIST, arr.slice(0,200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (MISS เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Grade ${grade} • SCORE ${score} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • quest ${miniCleared}/${miniTotal}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display='grid';
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

  // cVR shoot
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

  setHud();
}