// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + A+B Win + QUEST + BOSS + FX)
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
async function copyText(text){
  try{ await navigator.clipboard.writeText(String(text||'')); }catch(_){}
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
const ICON_SOAP = '🧼'; // boss helper

// ------------------ Main ------------------
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
  const hub     = qs('hub', '');
  const winMode = (qs('win','both')||'both').toLowerCase(); // A+B default

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng  = makeRNG(seed);

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

  // AI instances (optional, safe)
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd    = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // ------------------ state ------------------
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0;
  let hitsInStep=0;
  let loopsDone=0;
  let bCleared=false;
  let aCleared=false;

  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];

  let spawnAcc=0;

  // QUEST (เดิม)
  let quest = null;
  let questBonus = 0;

  // -------- BOSS (ใหม่) --------
  const bossLenSec = 15;
  let bossActive = false;
  let bossCleared = false;
  let bossHits = 0;
  let bossHitsNeed = (diff==='easy') ? 10 : (diff==='hard' ? 14 : 12);
  let bossStartLeft = 0; // timeLeft ตอนเริ่ม
  let soapShieldUntilMs = 0; // ชิลด์สั้น ๆ จากเป้า 🧼
  let bossBonus = 0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 138;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 124;
    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;
    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    return (wrongStepHits + hazHits);
  }
  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }
  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  // ------------------ FX (ใหม่) ------------------
  function fxBurst(x, y, kind, text=null){
    // ถ้ามี particles.js ใช้มันก่อน
    if(WIN.Particles?.popText && text){
      try{ WIN.Particles.popText(x, y, text, kind); }catch(_){}
    }
    if(WIN.Particles?.burst){
      try{ WIN.Particles.burst(x, y, kind); }catch(_){}
      return;
    }
    // fallback DOM FX (ไม่ง้อ lib)
    try{
      const fx = DOC.createElement('div');
      fx.className = `hw-fx ${kind||'good'}`;
      fx.style.left = `${x}px`;
      fx.style.top  = `${y}px`;
      fx.textContent = text || (kind==='bad' ? '!' : '✦');
      stage.appendChild(fx);
      setTimeout(()=>fx.remove(), 520);
    }catch(_){}
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep  && (pillStep.textContent  = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits  && (pillHits.textContent  = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss  && (pillMiss.textContent  = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    // Boss bar ใช้ pillQuest
    if(pillQuest){
      if(bossActive && !bossCleared){
        const left = Math.max(0, Math.ceil(timeLeft));
        pillQuest.textContent = `BOSS 🧼 ${bossHits}/${bossHitsNeed} • ${left}s`;
      }else if(bossActive && bossCleared){
        pillQuest.textContent = `BOSS ✅ โบนัส +${bossBonus}`;
      }else if(!quest) pillQuest.textContent = 'QUEST —';
      else pillQuest.textContent = quest.done ? `QUEST ✅ ${quest.title}` : `QUEST 🎯 ${quest.title}`;
    }

    if(getMissCount() === missLimit-1) showBanner('⚠️ เหลือพลาดได้อีก 1 ครั้ง!');
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • win=${winMode} • seed=${seed} • view=${view}`);
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
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    const rect = getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.92 + rng()*0.28).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = dd ? dd.getParams() : base;

    // BOSS: โอกาส soap ช่วย + spawn หนาแน่นขึ้น
    if(bossActive && !bossCleared){
      const rb = rng();
      // 10% soap helper
      if(rb < 0.10) return createTarget('soap', ICON_SOAP, -2);
      // hazard หน่อย ๆ ให้ลุ้น
      if(rb < 0.10 + clamp(P.hazardRate*0.90, 0.06, 0.26)) return createTarget('haz', ICON_HAZ, -1);
      // ที่เหลือ: good ของ step ปัจจุบัน (ช่วยให้ “โฟกัส”)
      return createTarget('good', s.icon, stepIdx);
    }

    // ปกติ
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

  // ------------------ QUEST (เดิมย่อไว้) ------------------
  function questPick(){
    const roll = Math.floor(rng()*3);
    const q = { id:`Q-${Date.now()}-${Math.floor(rng()*1e6)}`, startMs: nowMs(), done:false, reward: 50 };
    if(roll===0){ q.type='combo'; q.need=5; q.title=`ทำคอมโบให้ถึง ${q.need}`; }
    else if(roll===1){ q.type='no_miss'; q.windowSec=10; q.baseMiss=getMissCount(); q.title=`10 วิห้ามพลาด`; }
    else { q.type='step_fast'; q.baseStep=stepIdx; q.windowSec=12; q.title=`เคลียร์ STEP นี้ใน 12 วิ`; }
    return q;
  }
  function questUpdate(){
    if(!quest || quest.done) return;
    if(quest.type==='combo'){
      if(combo >= quest.need){ quest.done=true; questBonus += quest.reward; showBanner(`🎉 QUEST สำเร็จ! +${quest.reward}`); }
      return;
    }
    if(quest.type==='no_miss'){
      const t = (nowMs()-quest.startMs)/1000;
      if(getMissCount() > quest.baseMiss){ quest.done=true; showBanner('❌ QUEST พลาดแล้ว'); return; }
      if(t >= quest.windowSec){ quest.done=true; questBonus += quest.reward; showBanner(`🎉 QUEST สำเร็จ! +${quest.reward}`); }
      return;
    }
    if(quest.type==='step_fast'){
      const t = (nowMs()-quest.startMs)/1000;
      if(stepIdx !== quest.baseStep){ quest.done=true; questBonus += quest.reward; showBanner(`🎉 QUEST สำเร็จ! +${quest.reward}`); return; }
      if(t >= quest.windowSec){ quest.done=true; showBanner('⌛ QUEST หมดเวลา'); }
      return;
    }
  }
  function questMaybeNew(){
    if(bossActive) return; // ช่วง boss ไม่รบกวนด้วย quest
    if(!quest){ quest = questPick(); return; }
    const age = (nowMs()-quest.startMs)/1000;
    if(quest.done && age > 3) quest = questPick();
    else if(!quest.done && age > 18){ quest.done=true; showBanner('⌛ QUEST เปลี่ยนใหม่'); }
  }

  // ------------------ SCORE ------------------
  function scoreNow(){
    const miss = getMissCount();
    const baseScore =
      correctHits*10 +
      loopsDone*90 +
      comboMax*6 +
      questBonus +
      bossBonus;

    const penalty = miss*18 + hazHits*12;
    const bBonus = bCleared ? 60 : 0;
    return Math.max(0, Math.round(baseScore - penalty + bBonus));
  }

  // ------------------ JUDGE ------------------
  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // SOAP target (boss helper)
    if(obj.kind === 'soap'){
      soapShieldUntilMs = nowMs() + 3000; // 3s shield
      showBanner('🧼 โล่ฟอง 3 วิ! (กันเชื้อ)');
      fxBurst(obj.x, obj.y, 'good', '🫧');
      try{ obj.el?.classList.add('hit'); }catch(_){}
      removeTarget(obj);
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      // Boss progress: นับเฉพาะตอน bossActive
      if(bossActive && !bossCleared){
        bossHits++;
        fxBurst(obj.x, obj.y, 'good', '✨');
        try{ obj.el?.classList.add('hit'); }catch(_){}
        if(bossHits >= bossHitsNeed){
          bossCleared = true;
          bossBonus = 120;
          showBanner(`🏆 BOSS CLEARED! +${bossBonus}`);
        }
      }else{
        fxBurst(obj.x, obj.y, 'good', '🫧');
        try{ obj.el?.classList.add('hit'); }catch(_){}
      }

      coach?.onEvent?.('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          if(!bCleared){
            bCleared = true;
            showBanner('🏁 ผ่านเงื่อนไข B แล้ว! เล่นต่อเก็บแต้ม ✨');
          }else{
            showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          }

          if(winMode === 'loop'){
            endGame('win_loop');
            return;
          }
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }
      }

      removeTarget(obj);
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      fxBurst(obj.x, obj.y, 'warn', '⚠️');
      try{ obj.el?.classList.add('hit'); }catch(_){}

      coach?.onEvent?.('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      return;
    }

    if(obj.kind === 'haz'){
      // SHIELD: กัน hazard ไม่ให้นับ miss
      const shieldOn = nowMs() < soapShieldUntilMs;
      if(shieldOn){
        showBanner('🛡️ โล่ฟองกันเชื้อ!');
        fxBurst(obj.x, obj.y, 'good', '🛡️');
        removeTarget(obj);
        return;
      }

      hazHits++;
      combo = 0;

      fxBurst(obj.x, obj.y, 'bad', '🦠');
      try{ obj.el?.classList.add('hit'); }catch(_){}

      coach?.onEvent?.('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      return;
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function maybeStartBoss(){
    if(bossActive) return;
    // เริ่มเมื่อเหลือ <= 15 วิ
    if(timeLeft <= bossLenSec){
      bossActive = true;
      bossStartLeft = timeLeft;
      bossHits = 0;
      bossCleared = false;
      soapShieldUntilMs = 0;
      showBanner(`🚨 BOSS TIME! ยิงให้ได้ ${bossHitsNeed} ใน ${bossLenSec} วิ`);
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

    // Boss trigger
    maybeStartBoss();

    // QUEST (หยุดตอน boss)
    questMaybeNew();
    questUpdate();

    // spawn
    const P0 = dd ? dd.getParams() : base;

    // หลังผ่าน B แล้ว boost นิดหน่อย
    const bBoost = bCleared ? 1.12 : 1.0;

    // Boss: เพิ่มความหนาแน่นอีก + ลด decoy เพื่อไม่ให้สับสน
    const bossBoost = bossActive ? 1.35 : 1.0;

    const spawnPerSec = clamp(P0.spawnPerSec * bBoost * bossBoost, 0.8, 6.0);

    spawnAcc += (spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });

    // end
    if(timeLeft <= 0){
      aCleared = true;
      endGame('time');
      return;
    }

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    bCleared=false; aCleared=false;

    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    spawnAcc=0;

    quest=null; questBonus=0;

    bossActive=false; bossCleared=false; bossHits=0; bossStartLeft=0;
    soapShieldUntilMs=0; bossBonus=0;

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay   && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, winMode });

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
      runMode, diff, view, seed, winMode,
      sessionId,
      timestampIso: nowIso(),

      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      passA: (reason === 'time' || aCleared),
      passB: !!bCleared,

      // boss
      bossActive,
      bossCleared,
      bossHits,
      bossHitsNeed,

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
      questBonus,
      bossBonus,
      scoreFinal: scoreNow(),

      medianStepMs: rtMed,
      grade
    };

    if(coach?.getSummaryExtras) Object.assign(summary, coach.getSummaryExtras());
    if(dd?.getSummaryExtras)    Object.assign(summary, dd.getSummaryExtras());

    if(WIN.HHA_Badges?.evaluateBadges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    const passTxt = `A:${summary.passA?'✅':'❌'}  B:${summary.passB?'✅':'❌'}`;
    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : (reason==='win_loop' ? 'ผ่าน B ✅ (ครบ 7 ขั้นตอน)' : 'จบเกม ✅');
    endSub.textContent = `Grade ${grade} • ${passTxt} • score ${summary.scoreFinal} • boss ${bossCleared?'✅':'❌'} (${bossHits}/${bossHitsNeed}) • miss ${getMissCount()} • loops ${loopsDone}`;
    endJson.textContent = JSON.stringify(summary, null, 2);
    endOverlay && (endOverlay.style.display = 'grid');
  }

  // UI binds
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
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  WIN.addEventListener('hha:shoot', onShoot);

  // optional coach/badge popups
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
    if(d?.text) showBanner(`🤖 ${d.text}`);
  });

  // init
  setHud();
}