// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + SFX/VFX + Waves + Boss)
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

function copyText(text){
  return navigator.clipboard?.writeText(String(text)).catch(()=>{});
}

/* ------------------ Steps (emoji mapping) ------------------ */
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
const ICON_BOSS = '🧼';

/* ------------------ SFX (no asset required) ------------------ */
let _ac = null;
function audioInit(){
  if(_ac) return _ac;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    _ac = new AC();
    return _ac;
  }catch(_){ return null; }
}
function beep(freq=520, dur=0.06, type='sine', gain=0.04){
  const ac = audioInit();
  if(!ac) return;
  try{
    if(ac.state === 'suspended') ac.resume?.();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }catch(_){}
}
function thud(){
  // low short "boom"
  beep(130, 0.07, 'triangle', 0.06);
}
function tickSfx(){
  beep(880, 0.03, 'square', 0.025);
}

/* ------------------ VFX helpers ------------------ */
function popText(x,y,txt,kind='good'){
  // Prefer Particles if exists
  if(WIN.Particles && typeof WIN.Particles.popText === 'function'){
    try{ WIN.Particles.popText(x,y,txt,kind); return; }catch(_){}
  }
  // fallback DOM
  try{
    const el = DOC.createElement('div');
    el.textContent = txt;
    el.style.cssText = `
      position:fixed; left:${x}px; top:${y}px; transform:translate(-50%,-50%);
      z-index:9999; pointer-events:none;
      font: 1000 14px/1.1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      color: rgba(229,231,235,.98);
      text-shadow: 0 10px 40px rgba(0,0,0,.55);
      opacity:0; transition: opacity .08s ease, transform .35s ease;
    `;
    DOC.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-60%)';
    });
    setTimeout(()=>{ el.style.opacity='0'; }, 260);
    setTimeout(()=>{ el.remove(); }, 520);
  }catch(_){}
}

function flashStage(stage, kind='good'){
  if(!stage) return;
  try{
    stage.classList.remove('fx-good','fx-warn','fx-bad');
    void stage.offsetWidth;
    stage.classList.add(kind==='good'?'fx-good':(kind==='warn'?'fx-warn':'fx-bad'));
    clearTimeout(flashStage._t);
    flashStage._t = setTimeout(()=>stage.classList.remove('fx-good','fx-warn','fx-bad'), 220);
  }catch(_){}
}

function shakeHud(hud){
  if(!hud) return;
  try{
    hud.classList.remove('fx-shake');
    void hud.offsetWidth;
    hud.classList.add('fx-shake');
    clearTimeout(shakeHud._t);
    shakeHud._t = setTimeout(()=>hud.classList.remove('fx-shake'), 260);
  }catch(_){}
}

/* ------------------ Engine ------------------ */
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
  const hudTop   = DOC.querySelector('.hw-top');

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
  let totalStepHits=0; // correct + wrong (step targets only)
  const rtOk = []; // ms
  let spawnAcc=0;

  // Boss
  let bossActive = false;
  let bossHits = 0;
  const bossNeed = 8;     // ยิง/แตะให้ครบ
  const bossWindow = 15;  // วินาทีท้าย
  let bossSpawned = false;
  let bossCleared = false;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, hp?}
  let nextId=1;

  function nowMs(){ return performance.now ? performance.now() : Date.now(); }

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function setQuiz(show, q='', sub=''){
    if(!quizBox) return;
    quizBox.style.display = show ? 'block' : 'none';
    if(quizQ) quizQ.textContent = q || '';
    if(quizSub) quizSub.textContent = sub || '';
  }

  // spawn safe rect for engine (avoid HUD)
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 140;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;

    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    // hygiene: miss = wrong step hits + hazard hits (แฟร์และนับง่าย)
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

    // Quest/Boss pill
    if(pillQuest){
      if(timeLeft <= bossWindow){
        pillQuest.textContent = bossCleared
          ? `BOSS ✅ Cleared!`
          : `BOSS ${bossHits}/${bossNeed} ${ICON_BOSS}`;
      }else{
        pillQuest.textContent = `QUEST: ทำ 7 ขั้นตอนให้ครบ + คอมโบยาว`;
      }
    }

    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);
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

  function createTarget(kind, emoji, stepRef, extra={}){
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

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y, ...extra };
    targets.push(obj);

    // click/tap only for non-cVR strict
    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shooting: aim from center, lockPx = from vr-ui config, choose nearest target in lock radius
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
      // ยิงพลาด (ให้เสียงติ๊กเบา ๆ)
      tickSfx();
    }
  }

  /* -------- Waves + Boss parameters -------- */
  function waveParams(){
    // multiplier changes over time (survival feel)
    const e = elapsedSec();
    const t = timeLeft;
    let spawnMul = 1.0;
    let hazMul = 1.0;
    let decMul = 1.0;

    // wave rhythm: every ~18s alternates pressure
    const wave = 0.5 + 0.5*Math.sin((e/18)*Math.PI*2);
    // wave in [0..1] -> pressure: more spawn+hazard when wave high
    spawnMul *= (1.0 + wave*0.35);
    hazMul   *= (1.0 + wave*0.30);
    decMul   *= (1.0 + wave*0.25);

    // ramp by progress (after 35% time, ramp a bit)
    const prog = clamp(e / Math.max(1,timePlannedSec), 0, 1);
    spawnMul *= (1.0 + prog*0.22);
    hazMul   *= (1.0 + prog*0.18);
    decMul   *= (1.0 + prog*0.12);

    // boss window: crank but allow relief if boss cleared
    if(t <= bossWindow){
      bossActive = true;
      if(!bossCleared){
        spawnMul *= 1.15;
        hazMul   *= 1.20;
        decMul   *= 1.10;
      }else{
        // reward: safer ending
        hazMul   *= 0.65;
        decMul   *= 0.80;
        spawnMul *= 1.00;
      }
    }else{
      bossActive = false;
    }

    return { spawnMul, hazMul, decMul };
  }

  function effectiveParams(){
    const P0 = dd ? dd.getParams() : base;
    const w = waveParams();
    const P = {
      spawnPerSec: clamp(P0.spawnPerSec * w.spawnMul, bounds.spawnPerSec[0], bounds.spawnPerSec[1]),
      hazardRate : clamp(P0.hazardRate  * w.hazMul,   bounds.hazardRate[0],  bounds.hazardRate[1]),
      decoyRate  : clamp(P0.decoyRate   * w.decMul,   bounds.decoyRate[0],   bounds.decoyRate[1]),
    };
    // normalize probabilities (ensure hazard+decoy <= 0.78)
    const cap = 0.78;
    const sum = P.hazardRate + P.decoyRate;
    if(sum > cap){
      const k = cap / Math.max(1e-6, sum);
      P.hazardRate *= k;
      P.decoyRate  *= k;
    }
    return P;
  }

  function spawnBoss(){
    if(bossSpawned || bossCleared) return;
    bossSpawned = true;
    // boss target has hp
    createTarget('boss', ICON_BOSS, -2, { hp: bossNeed });
    showBanner(`👑 BOSS มาแล้ว! ยิง/แตะ ${ICON_BOSS} ให้ครบ ${bossNeed} ครั้ง!`);
    setQuiz(true, 'BOSS นาทีท้าย!', `ยิง/แตะ ${ICON_BOSS} ให้ครบ ${bossNeed} ครั้งเพื่อ “ล้างพื้นที่”`);
  }

  function spawnOne(){
    // ensure boss appears in last window
    if(timeLeft <= bossWindow) spawnBoss();

    // If boss is alive, keep it on stage (re-spawn if removed unexpectedly)
    if(timeLeft <= bossWindow && !bossCleared){
      const hasBoss = targets.some(t=>t.kind==='boss');
      if(!hasBoss){
        // respawn boss with remaining hp
        const hpLeft = Math.max(1, bossNeed - bossHits);
        createTarget('boss', ICON_BOSS, -2, { hp: hpLeft });
      }
    }

    const s = STEPS[stepIdx];
    const P = effectiveParams();

    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      // wrong step emoji (not current)
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

  function bossHitEffect(obj){
    // update boss hp on screen (emoji could pulse via pop text)
    try{
      const hp = Math.max(0, obj.hp|0);
      popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `BOSS ${bossHits}/${bossNeed}`, 'warn');
    }catch(_){}
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'boss'){
      // boss requires repeated hits
      bossHits++;
      obj.hp = Math.max(0, (obj.hp|0) - 1);

      beep(220,0.06,'sawtooth',0.05);
      flashStage(stage,'warn');

      emit('hha:judge', { kind:'boss', bossHits, bossNeed, rtMs: rt, source, extra });

      bossHitEffect(obj);

      if(obj.hp <= 0){
        bossCleared = true;
        removeTarget(obj);
        showBanner(`✅ เคลียร์ BOSS! ช่วงท้ายจะ “ปลอดภัยขึ้น”`);
        setQuiz(true, 'BOSS Cleared ✅', 'โบนัส: ลดโอกาสเจอเชื้อ/ล่อหลอกช่วงท้าย');
        beep(660,0.08,'triangle',0.06);
        beep(880,0.08,'triangle',0.06);
        flashStage(stage,'good');
      }else{
        // keep boss on stage
        setHud();
      }
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      beep(560, 0.05, 'sine', 0.04);
      flashStage(stage,'good');

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      popText(obj.x, obj.y, `+1 ${STEPS[stepIdx].icon}`, 'good');

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        beep(740,0.06,'triangle',0.05);

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          popText(WIN.innerWidth*0.5, WIN.innerHeight*0.18, `LOOP +1`, 'good');
          setQuiz(true, 'ครบ 7 ขั้นตอน ✅', `ทำต่อเพื่อคุมความเสี่ยง (loops ${loopsDone})`);
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

      thud();
      flashStage(stage,'warn');
      shakeHud(hudTop);

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      popText(obj.x, obj.y, `ผิด!`, 'warn');

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      thud();
      flashStage(stage,'bad');
      shakeHud(hudTop);

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      popText(obj.x, obj.y, `🦠`, 'bad');

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

    // spawn with waves
    const P = effectiveParams();

    spawnAcc += (P.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets to prevent clutter
      if(targets.length > 18){
        // remove oldest non-boss first
        const nonBoss = targets.filter(t=>t.kind!=='boss');
        const oldest = nonBoss.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
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

    // boss
    bossActive=false; bossHits=0; bossSpawned=false; bossCleared=false;

    spawnAcc=0;
    setQuiz(false);
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
    setQuiz(true, 'เริ่มภารกิจ!', 'ยิง/แตะไอคอนขั้นตอนที่ถูกเท่านั้น + หลบ 🦠');
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

    // grade (simple)
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    // boss bonus (if cleared)
    const bossBonus = bossCleared ? 1 : 0;

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

      // boss
      bossActiveAtEnd: bossActive,
      bossHits,
      bossNeed,
      bossCleared,
      bossBonus
    };

    if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle && (endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅');
    endSub && (endSub.textContent =
      `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • boss ${bossHits}/${bossNeed}${bossCleared?' ✅':''}`
    );
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';

    setQuiz(false);
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
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // badge/unlock popups
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    popText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // add tiny fx css hooks into stage/hud (no extra CSS file needed)
  (function injectFxCss(){
    try{
      const css = DOC.createElement('style');
      css.textContent = `
        .fx-good{ animation: hwFlashGood .22s ease; }
        .fx-warn{ animation: hwFlashWarn .22s ease; }
        .fx-bad{  animation: hwFlashBad  .22s ease; }
        @keyframes hwFlashGood{ 0%{filter:none} 40%{filter:drop-shadow(0 0 18px rgba(34,197,94,.35))} 100%{filter:none} }
        @keyframes hwFlashWarn{ 0%{filter:none} 40%{filter:drop-shadow(0 0 18px rgba(245,158,11,.35))} 100%{filter:none} }
        @keyframes hwFlashBad{  0%{filter:none} 40%{filter:drop-shadow(0 0 18px rgba(239,68,68,.35))} 100%{filter:none} }
        .fx-shake{ animation: hwShake .26s ease; }
        @keyframes hwShake{
          0%{transform:translateX(0)}
          25%{transform:translateX(-2px)}
          50%{transform:translateX(2px)}
          75%{transform:translateX(-1px)}
          100%{transform:translateX(0)}
        }
      `;
      DOC.head.appendChild(css);
    }catch(_){}
  })();

  // initial
  setHud();
  setQuiz(true, 'พร้อมแล้ว', 'กด Start เพื่อเริ่มเกม');
}