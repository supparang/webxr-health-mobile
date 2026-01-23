// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Coach + DD) PACK G
// NEW: Rhythm Wash Mode + Ghost Replay 10s + Explainable Coach
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

const ICON_HAZ = '🦠';

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
  const pillPerfect = DOC.getElementById('pillPerfect');
  const pillShield  = DOC.getElementById('pillShield');
  const pillMission = DOC.getElementById('pillMission');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const missionBar = DOC.getElementById('missionBar');
  const missionText= DOC.getElementById('missionText');
  const missionFill= DOC.getElementById('missionFill');

  const wheelRow = DOC.getElementById('wheelRow');
  const wheelSub = DOC.getElementById('wheelSub');

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

  // feature flags (PACK G)
  const rhythmOn = (qs('rhythm','1') !== '0');   // default ON (ดีมากกับเด็ก)
  const ghostOn  = (qs('ghost','1') !== '0');
  const explainOn= (qs('explain','1') !== '0');

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, bpm:96 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26, bpm:116 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, bpm:106 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    bpm:[84, 132]
  };

  // AI instances (optional)
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // Mission (optional module)
  let mission = null;
  async function loadMission(){
    try{
      const mod = await import('./hygiene.missions.js');
      const pick = mod?.pickMission;
      if(typeof pick === 'function'){
        mission = pick({ seed, runMode, diff });
      }
    }catch{}
    if(missionBar){
      missionBar.style.display = mission ? 'block' : 'none';
      if(mission && pillMission) pillMission.textContent = `🎯 ${mission.name}`;
      if(mission && missionText) missionText.textContent = `${mission.story}`;
    }
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

  // NEW: perfect streak + shield
  let perfect = 0;
  let shield = 0; // blocks haz once

  let correctHits=0;
  let totalStepHits=0; // correct + wrong (only step targets)
  const rtOk = []; // ms

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  // Ghost (last 10s)
  const ghostBuf = []; // {t,x,y,kind,ok,rtMs}
  let ghostLayer = null;

  // Rhythm
  let beatMs = 0;
  let nextBeatAt = 0;
  let beatCount = 0;

  // ---------- Helpers ----------
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  function explain(kind, obj){
    if(!explainOn) return '';
    const cur = STEPS[stepIdx];
    if(kind==='wrong'){
      const wrong = (obj && obj.stepIdx>=0) ? STEPS[obj.stepIdx] : null;
      return `ผิดขั้นตอน → ตอนนี้ต้อง ${cur.icon} ${cur.label}${wrong?` (ที่กดคือ ${wrong.icon})`:''}`;
    }
    if(kind==='haz'){
      return shield>0 ? `🛡 กันเชื้อไว้ 1 ครั้ง!` : `โดนเชื้อ 🦠 → เล็งหลบก่อนยิง`;
    }
    return '';
  }

  // spawn rect safe
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 130;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;
    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    // miss = wrong step + haz hits (blocked haz doesn't count)
    return (wrongStepHits + hazHits);
  }

  function setWheel(){
    if(!wheelRow) return;
    wheelRow.innerHTML = '';
    STEPS.forEach((s,i)=>{
      const d = DOC.createElement('div');
      d.className = 'hw-chip' + (i===stepIdx?' is-now':'') + (i<stepIdx?' is-done':'');
      d.textContent = s.icon;
      wheelRow.appendChild(d);
    });
    if(wheelSub){
      wheelSub.textContent = `ตอนนี้: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label} • รอบที่ทำแล้ว: ${loopsDone}`;
    }
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);
    pillPerfect && (pillPerfect.textContent = `PERFECT ${perfect}`);
    pillShield && (pillShield.textContent = `🛡 ${shield}`);

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);

    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    const P = dd ? dd.getParams() : base;
    const bpm = clamp(P.bpm ?? base.bpm, bounds.bpm[0], bounds.bpm[1]);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • ${rhythmOn?'rhythm':'flow'} bpm=${Math.round(bpm)}`);

    setWheel();
    updateMissionUI();
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
    const s = STEPS[stepIdx];
    const P = dd ? dd.getParams() : base;

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

  // cVR shooting: aim from center, lockPx from vr-ui
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
      // record "miss shot" for ghost (optional)
      recordGhost({ kind:'shot_miss', ok:false, x:cx, y:cy, rtMs:0 });
    }
  }

  function recordGhost({kind, ok, x, y, rtMs}){
    if(!ghostOn) return;
    const t = nowMs();
    ghostBuf.push({ t, kind, ok, x, y, rtMs });
    // keep last 10s
    const cut = t - 10000;
    while(ghostBuf.length && ghostBuf[0].t < cut) ghostBuf.shift();
    renderGhost();
  }

  function ensureGhostLayer(){
    if(!ghostOn) return;
    if(ghostLayer && ghostLayer.isConnected) return;
    ghostLayer = DOC.createElement('div');
    ghostLayer.className = 'hw-ghost';
    ghostLayer.setAttribute('aria-hidden','true');
    // put above stage but below HUD
    stage.appendChild(ghostLayer);
  }

  function renderGhost(){
    if(!ghostOn) return;
    ensureGhostLayer();
    if(!ghostLayer) return;

    const rect = getSpawnRect();
    const t = nowMs();
    const frag = DOC.createDocumentFragment();

    ghostLayer.innerHTML = '';
    for(const g of ghostBuf){
      const age = (t - g.t); // ms
      const a = clamp(1 - age/10000, 0, 1);
      const dot = DOC.createElement('div');
      dot.className = 'hw-dot' + (g.ok ? ' ok':' bad');
      dot.style.opacity = String(0.10 + a*0.55);
      dot.style.transform = `translate(-50%,-50%)`;
      // map px -> %
      dot.style.left = ((g.x/rect.w)*100).toFixed(3) + '%';
      dot.style.top  = ((g.y/rect.h)*100).toFixed(3) + '%';
      frag.appendChild(dot);
    }
    ghostLayer.appendChild(frag);
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  // mission progress
  function missionProgress(){
    if(!mission || !mission.rules) return { pct:0, done:false, text:'—' };
    const r = mission.rules;

    // compute a few known stats
    const stepAcc = getStepAcc();
    const bossClears = 0; // (PACK H จะใส่ boss จริง) ตอนนี้ 0 ไว้ก่อน

    // evaluate
    let pct = 0;
    let done = false;

    if(r.minLoops != null){
      pct = clamp(loopsDone / Math.max(1, r.minLoops), 0, 1);
      done = loopsDone >= r.minLoops;
      return { pct, done, text:`loops ${loopsDone}/${r.minLoops}` };
    }
    if(r.minComboMax != null){
      pct = clamp(comboMax / Math.max(1, r.minComboMax), 0, 1);
      done = comboMax >= r.minComboMax;
      return { pct, done, text:`comboMax ${comboMax}/${r.minComboMax}` };
    }
    if(r.maxHazHits != null){
      pct = clamp((r.maxHazHits - hazHits) / Math.max(1, r.maxHazHits), 0, 1);
      done = hazHits <= r.maxHazHits && timeLeft<=0;
      return { pct, done, text:`haz ${hazHits}/${r.maxHazHits}` };
    }
    if(r.minStepAcc != null){
      pct = clamp(stepAcc / Math.max(0.01, r.minStepAcc), 0, 1);
      done = stepAcc >= r.minStepAcc;
      return { pct, done, text:`acc ${(stepAcc*100).toFixed(0)}%/${Math.round(r.minStepAcc*100)}%` };
    }
    if(r.minBossClears != null){
      pct = clamp(bossClears / Math.max(1, r.minBossClears), 0, 1);
      done = bossClears >= r.minBossClears;
      return { pct, done, text:`boss ${bossClears}/${r.minBossClears}` };
    }

    return { pct:0, done:false, text:'—' };
  }

  let missionDoneFired = false;
  function updateMissionUI(){
    if(!missionBar || !missionFill || !missionText) return;
    if(!mission){ missionBar.style.display='none'; return; }

    const p = missionProgress();
    missionFill.style.width = (p.pct*100).toFixed(1) + '%';
    missionText.textContent = `${mission.name} • ${p.text}`;

    if(p.done && !missionDoneFired){
      missionDoneFired = true;
      showBanner(`🎯 Mission สำเร็จ! ${mission.name}`);
      emit('hha:mission', { id: mission.id, name: mission.name, done:true });
      // optional: badge unlock
      WIN.dispatchEvent(new CustomEvent('hha:badge',{detail:{icon:'🎯',title:'Mission Clear',id:'hw_mission'}}));
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;

      // PERFECT = hit good within 900ms
      const isPerfect = rt <= 900;
      if(isPerfect){
        perfect++;
        // every 4 perfect => +1 shield
        if(perfect % 4 === 0){
          shield++;
          showBanner(`🛡 ได้โล่! (Perfect x${perfect})`);
        }
      }

      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo, perfect:isPerfect });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra, perfect:isPerfect });
      recordGhost({ kind:'good', ok:true, x:obj.x, y:obj.y, rtMs:rt });

      showBanner(isPerfect ? `✨ PERFECT! ${STEPS[stepIdx].icon} +1` : `✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        coach?.onEvent('step_clear', { stepIdx, stepAcc: getStepAcc(), combo });
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
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
      perfect = 0;

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      recordGhost({ kind:'wrong', ok:false, x:obj.x, y:obj.y, rtMs:rt });

      const msg = explain('wrong', obj);
      showBanner(`⚠️ ${msg || 'ผิดขั้นตอน!'}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      combo = 0;
      perfect = 0;

      // shield blocks first haz hit
      if(shield > 0){
        shield--;
        emit('hha:judge', { kind:'haz_block', stepIdx, rtMs: rt, source, extra });
        recordGhost({ kind:'haz_block', ok:true, x:obj.x, y:obj.y, rtMs:rt });
        showBanner(`🛡 กันเชื้อไว้!`);
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      recordGhost({ kind:'haz', ok:false, x:obj.x, y:obj.y, rtMs:rt });

      const msg = explain('haz', obj);
      showBanner(`🦠 ${msg || 'โดนเชื้อ!'}`);

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

  // Rhythm: spawn per beat (kid-friendly)
  function setupRhythm(){
    const P = dd ? dd.getParams() : base;
    const bpm = clamp(P.bpm ?? base.bpm, bounds.bpm[0], bounds.bpm[1]);
    beatMs = 60000 / Math.max(40, bpm);
    nextBeatAt = nowMs() + beatMs;
    beatCount = 0;
  }

  function onBeat(){
    beatCount++;

    // 1-2-3-4 pattern:
    // beat 1: good
    // beat 2: good or decoy
    // beat 3: hazard chance
    // beat 4: “double” sometimes on hard
    const P = dd ? dd.getParams() : base;
    const b = (beatCount % 4) || 4;

    // keep target count sane
    if(targets.length > 18) return;

    if(b === 1){
      spawnOne(); // mostly good by rates
      return;
    }

    if(b === 2){
      // slightly favor good for learning
      if(rng() < 0.65) createTarget('good', STEPS[stepIdx].icon, stepIdx);
      else spawnOne();
      return;
    }

    if(b === 3){
      // danger beat
      if(rng() < clamp(P.hazardRate*1.35, 0, 0.5)) createTarget('haz', ICON_HAZ, -1);
      else spawnOne();
      return;
    }

    if(b === 4){
      spawnOne();
      if(diff==='hard' && rng() < 0.35){
        // double beat
        spawnOne();
      }
      return;
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

    // DD tick (still deterministic in study as your DD module decides)
    dd?.onEvent('tick', { elapsedSec: elapsedSec() });

    // Spawn logic
    if(rhythmOn){
      while(t >= nextBeatAt){
        nextBeatAt += beatMs;
        onBeat();
        // cleanup if too many
        if(targets.length > 18){
          const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
          if(oldest) removeTarget(oldest);
        }
      }
    }else{
      // flow mode (old style)
      const P = dd ? dd.getParams() : base;
      // accumulator spawn
      tick.spawnAcc = (tick.spawnAcc || 0) + (P.spawnPerSec * dt);
      while(tick.spawnAcc >= 1){
        tick.spawnAcc -= 1;
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

    perfect = 0;
    shield = 0;

    ghostBuf.length = 0;
    missionDoneFired = false;

    setupRhythm();
    setHud();
    renderGhost();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, rhythmOn, ghostOn, explainOn });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
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

    const mprog = missionProgress();

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

      // progress
      loopsDone,
      stepIdxEnd: stepIdx,
      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      // core metrics
      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      perfectCount: perfect,
      shieldEnd: shield,
      misses: getMissCount(),
      medianStepMs: rtMed,

      // feature flags
      rhythmOn, ghostOn, explainOn,

      // mission
      missionId: mission ? mission.id : null,
      missionName: mission ? mission.name : null,
      missionDone: !!mprog.done,
      missionPct: mprog.pct
    };

    if(coach) Object.assign(summary, coach.getSummaryExtras());
    if(dd) Object.assign(summary, dd.getSummaryExtras());

    // store ghost excerpt (last 10s)
    if(ghostOn){
      summary.ghost10s = ghostBuf.slice(-60); // cap
    }

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Grade ${grade} • acc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • mission ${mprog.done?'✅':'—'}`;
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

  // optional: particles pop
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

  // init UI + mission
  loadMission().finally(()=>{
    resetGame();
  });
}