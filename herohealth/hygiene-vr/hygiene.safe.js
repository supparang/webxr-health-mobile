// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL FUN PACK (HHA Standard + Emoji 7 Steps + Mini-Quest + Boss Storm + Powerups)
// ✅ Views: pc/mobile/vr/cvr (via body class)
// ✅ Supports: tap/click OR cVR crosshair shoot (hha:shoot)
// ✅ Mini-quests: combo / no-hazard / quick-step / perfect-step
// ✅ Boss Storm: germ-storm burst windows
// ✅ Powerups: 🧴 soap (-1 miss) / 🛡 shield (block hazard) / ⭐ star (combo-save)
// ✅ Emits: hha:start, hha:time, hha:score, hha:judge, hha:coach, hha:end
// ✅ Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY

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

// powerups
const PWR_SOAP   = '🧴'; // reduce miss by 1 (floor 0)
const PWR_SHIELD = '🛡️'; // blocks next hazard hit (not count miss)
const PWR_STAR   = '⭐'; // prevents next combo reset

// --------------- Engine ---------------
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
  const runMode = (qs('run','play')||'play').toLowerCase();  // play / research
  const diff = (qs('diff','normal')||'normal').toLowerCase(); // easy/normal/hard
  const view = (qs('view','pc')||'pc').toLowerCase(); // pc/mobile/vr/cvr
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // research rules: keep deterministic & no adaptive difficulty (DD OFF)
  const ddAllowed = (runMode !== 'research');

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.85, hazardRate:0.085, decoyRate:0.18, powerRate:0.045, ttlMs:3200 };
    if(diff==='hard') return { spawnPerSec:2.75, hazardRate:0.145, decoyRate:0.28, powerRate:0.030, ttlMs:2600 };
    return { spawnPerSec:2.30, hazardRate:0.120, decoyRate:0.23, powerRate:0.038, ttlMs:2900 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.3],
    hazardRate:[0.06, 0.27],
    decoyRate:[0.10, 0.42],
    powerRate:[0.02, 0.09],
    ttlMs:[1800, 4600]
  };

  // AI instances (optional)
  const coach = (coachOn && WIN.HHA_AICoach)
    ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' })
    : null;

  const dd = (ddOn && ddAllowed && WIN.HHA_DD)
    ? WIN.HHA_DD.create({ seed, runMode, base, bounds })
    : null;

  // ---------------- State ----------------
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

  // power states
  let shield=0;       // blocks hazard
  let star=0;         // prevents next combo reset
  let soap=0;         // collected soaps count (for summary)

  let correctHits=0;
  let totalStepHits=0; // correct + wrong step
  const rtOk = [];     // ms list

  // score + goals/minis
  let score=0;
  let goalsCleared=0, goalsTotal=2; // 1) survive to end (not fail) 2) complete at least 1 full 7-step loop
  let miniCleared=0, miniTotal=0;

  // boss storm
  let stormActive=false;
  let stormEndsMs=0;
  let nextStormAtMs=0;
  let stormsSeen=0;
  let stormsCleared=0;

  // step timing for mini
  let stepStartMs=0;
  let wrongInThisStep=0;
  let hazInThisStep=0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, ttlMs, expireMs, pwrType?}
  let nextId=1;

  // mini quest
  const MINI_POOL = ['combo','nohaz','quickstep','perfectstep'];
  let mini = null; // {type, title, startMs, deadlineMs, target, done, fail}
  let nextMiniAtMs=0;

  // banner helper
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function popText(x,y,text,cls){
    try{
      if(WIN.Particles && WIN.Particles.popText){
        WIN.Particles.popText(x,y,text,cls||'good');
      }
    }catch{}
  }

  function burst(x,y,cls){
    try{
      if(WIN.Particles && WIN.Particles.burst){
        WIN.Particles.burst(x,y,cls||'good');
      }
    }catch{}
  }

  // spawn rect for targets (avoid HUD)
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
    // miss = wrong step hits + hazard hits (powerups may reduce via soap)
    return Math.max(0, (wrongStepHits + hazHits));
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
    pillCombo && (pillCombo.textContent = `COMBO ${combo}${star? ' ⭐':''}${shield? ' 🛡️':''}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    let miniTxt = '';
    if(mini && !mini.done && !mini.fail){
      const left = Math.max(0, Math.ceil((mini.deadlineMs - nowMs())/1000));
      miniTxt = ` • MINI: ${mini.title} (${left}s)`;
    }
    let stormTxt = stormActive ? ` • BOSS: 🌀 Germ Storm!` : '';

    pillRisk && (pillRisk.textContent =
      `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%${stormTxt}${miniTxt}`
    );

    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    if(hudSub){
      hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • score=${score} • seed=${seed} • view=${view}`;
    }
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

  function createTarget(kind, emoji, stepRef, ttlMs, pwrType=null){
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

    const born = nowMs();
    const obj = {
      id: nextId++,
      el,
      kind,
      stepIdx: stepRef,
      bornMs: born,
      ttlMs,
      expireMs: born + ttlMs,
      x, y,
      pwrType
    };
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

  function addScore(delta, reason){
    score = Math.max(0, Math.round(score + (Number(delta)||0)));
    emit('hha:score', { score, delta, reason });
  }

  // ------------ Mini Quest ------------
  function pickMiniType(){
    // bias: easy -> more combo/nohaz, hard -> more quick/perfect
    const r = rng();
    if(diff==='easy'){
      return (r < 0.55) ? 'combo' : (r < 0.85 ? 'nohaz' : 'quickstep');
    }
    if(diff==='hard'){
      return (r < 0.35) ? 'quickstep' : (r < 0.70 ? 'perfectstep' : 'combo');
    }
    return MINI_POOL[Math.floor(rng()*MINI_POOL.length)];
  }

  function startMini(){
    const t = nowMs();
    const type = pickMiniType();

    // duration
    const durSec = diff==='easy' ? 14 : (diff==='hard' ? 10 : 12);
    const deadlineMs = t + durSec*1000;

    miniTotal++;
    if(type==='combo'){
      const target = diff==='easy' ? 6 : (diff==='hard' ? 9 : 7);
      mini = { type, title:`คอมโบให้ถึง ${target}`, startMs:t, deadlineMs, target, done:false, fail:false };
      showBanner(`🎯 MINI QUEST: ${mini.title}!`);
    }else if(type==='nohaz'){
      const target = diff==='easy' ? 10 : (diff==='hard' ? 8 : 9);
      mini = { type, title:`อย่าโดนเชื้อ ${target}s`, startMs:t, deadlineMs, target, done:false, fail:false };
      showBanner(`🛡️ MINI QUEST: ${mini.title}!`);
    }else if(type==='quickstep'){
      const target = diff==='easy' ? 7 : (diff==='hard' ? 5 : 6);
      mini = { type, title:`เคลียร์ขั้นนี้ใน ${target}s`, startMs:t, deadlineMs, target, done:false, fail:false, stepIdxAtStart: stepIdx };
      showBanner(`⚡ MINI QUEST: ${mini.title}!`);
    }else{ // perfectstep
      mini = { type, title:`ขั้นนี้ห้ามพลาด!`, startMs:t, deadlineMs, target:1, done:false, fail:false, stepIdxAtStart: stepIdx };
      showBanner(`💎 MINI QUEST: ${mini.title}!`);
    }

    coach?.onEvent('mini_start', { type, diff, elapsedSec: elapsedSec() });
  }

  function passMini(){
    if(!mini || mini.done || mini.fail) return;
    mini.done = true;
    miniCleared++;
    addScore(80, 'mini_pass');
    showBanner(`🎉 MINI ผ่าน! +80`);
    popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, 'MINI +80', 'good');
    coach?.onEvent('mini_pass', { type: mini.type, elapsedSec: elapsedSec() });
    emit('hha:judge', { kind:'mini_pass', type: mini.type });
    // schedule next mini
    nextMiniAtMs = nowMs() + (diff==='easy' ? 9000 : 11000);
  }

  function failMini(){
    if(!mini || mini.done || mini.fail) return;
    mini.fail = true;
    showBanner(`⏱️ MINI ไม่ทัน!`);
    coach?.onEvent('mini_fail', { type: mini.type, elapsedSec: elapsedSec() });
    emit('hha:judge', { kind:'mini_fail', type: mini.type });
    nextMiniAtMs = nowMs() + (diff==='easy' ? 7000 : 9000);
  }

  // ------------ Boss Storm ------------
  function scheduleStorm(){
    const t = nowMs();
    // every ~18–26s
    const gap = diff==='easy' ? (18000 + rng()*7000) : (diff==='hard' ? (15000 + rng()*6000) : (17000 + rng()*6500));
    nextStormAtMs = t + gap;
  }

  function startStorm(){
    stormActive = true;
    stormsSeen++;
    const durMs = diff==='easy' ? 9000 : (diff==='hard' ? 7000 : 8000);
    stormEndsMs = nowMs() + durMs;
    stage.classList.add('storm');
    showBanner(`🌀 BOSS: Germ Storm! หลบเชื้อให้ได้!`);
    popText(WIN.innerWidth*0.5, WIN.innerHeight*0.18, 'GERM STORM!', 'warn');
    emit('hha:judge', { kind:'storm_enter' });
    coach?.onEvent('storm_enter', { durMs, elapsedSec: elapsedSec() });
  }

  function endStorm(success){
    stormActive = false;
    stage.classList.remove('storm');
    if(success){
      stormsCleared++;
      addScore(120, 'storm_clear');
      showBanner(`🏆 รอดพายุเชื้อ! +120`);
      burst(WIN.innerWidth*0.5, WIN.innerHeight*0.20, 'good');
      emit('hha:judge', { kind:'storm_clear' });
      coach?.onEvent('storm_clear', { elapsedSec: elapsedSec() });
    }else{
      emit('hha:judge', { kind:'storm_fail' });
      coach?.onEvent('storm_fail', { elapsedSec: elapsedSec() });
    }
    scheduleStorm();
  }

  // ------------- Spawn -------------
  function spawnOne(){
    const s = STEPS[stepIdx];
    const P0 = dd ? dd.getParams() : base;
    const P = Object.assign({}, P0);

    // Storm modifies params temporarily
    if(stormActive){
      P.hazardRate = clamp(P.hazardRate + 0.12, 0, 0.95);
      P.decoyRate  = clamp(P.decoyRate  + 0.10, 0, 0.95);
      P.spawnPerSec= clamp(P.spawnPerSec + 0.80, 0, 9);
      P.powerRate  = clamp(P.powerRate - 0.015, 0, 0.50);
      P.ttlMs      = clamp(P.ttlMs - 400, 900, 99999);
    }

    // powerups chance
    const r0 = rng();
    if(r0 < P.powerRate){
      const r1 = rng();
      const pwr = (r1 < 0.45) ? 'soap' : (r1 < 0.75 ? 'shield' : 'star');
      const em = (pwr==='soap') ? PWR_SOAP : (pwr==='shield' ? PWR_SHIELD : PWR_STAR);
      return createTarget('power', em, -2, Math.round(P.ttlMs*1.05), pwr);
    }

    // decide type
    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1, P.ttlMs);
    }else if(r < P.hazardRate + P.decoyRate){
      // wrong step emoji (not current)
      let j = stepIdx;
      for(let k=0;k<5;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j, P.ttlMs);
    }else{
      return createTarget('good', s.icon, stepIdx, P.ttlMs);
    }
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shoot: aim center, choose nearest target within lockPx
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

  function comboReset(){
    if(star>0){
      star = 0;
      showBanner(`⭐ กันคอมโบแตก!`);
      popText(WIN.innerWidth*0.5, WIN.innerHeight*0.24, 'COMBO SAVE!', 'warn');
      emit('hha:judge', { kind:'star_save' });
      return;
    }
    combo = 0;
  }

  function applySoap(){
    // reduce miss by 1: prefer reduce wrongStepHits first, else hazHits
    if(wrongStepHits > 0) wrongStepHits--;
    else if(hazHits > 0) hazHits--;
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // powerups
    if(obj.kind === 'power'){
      if(obj.pwrType === 'soap'){
        soap++;
        applySoap();
        addScore(18, 'soap');
        showBanner(`🧴 สบู่! ลด MISS -1`);
        popText(obj.x, obj.y, 'SOAP -1', 'good');
        emit('hha:judge', { kind:'power', type:'soap', source, extra });
      }else if(obj.pwrType === 'shield'){
        shield = 1;
        addScore(16, 'shield');
        showBanner(`🛡️ โล่พร้อม! กันเชื้อ 1 ครั้ง`);
        popText(obj.x, obj.y, 'SHIELD!', 'warn');
        emit('hha:judge', { kind:'power', type:'shield', source, extra });
      }else{
        star = 1;
        addScore(14, 'star');
        showBanner(`⭐ ดาว! กันคอมโบแตก 1 ครั้ง`);
        popText(obj.x, obj.y, 'STAR!', 'warn');
        emit('hha:judge', { kind:'power', type:'star', source, extra });
      }
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

      addScore(10 + (stormActive?2:0), 'hit_good');

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      // mini checks
      if(mini && !mini.done && !mini.fail){
        if(mini.type==='combo' && combo >= mini.target) passMini();
      }

      burst(obj.x, obj.y, 'good');

      // step clear?
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        addScore(25, 'step_clear');

        // mini: quickstep/perfectstep check on step clear
        if(mini && !mini.done && !mini.fail){
          if(mini.type==='quickstep' && mini.stepIdxAtStart === stepIdx){
            const took = (nowMs() - stepStartMs)/1000;
            if(took <= mini.target) passMini(); else failMini();
          }
          if(mini.type==='perfectstep' && mini.stepIdxAtStart === stepIdx){
            if(wrongInThisStep===0 && hazInThisStep===0) passMini(); else failMini();
          }
        }

        // advance step
        stepIdx++;
        hitsInStep=0;
        stepStartMs = nowMs();
        wrongInThisStep = 0;
        hazInThisStep = 0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          addScore(60, 'loop_clear');
          showBanner(`🏁 ครบ 7 ขั้นตอน! loops ${loopsDone} (+60)`);
          popText(WIN.innerWidth*0.5, WIN.innerHeight*0.26, `LOOP ${loopsDone}!`, 'good');
          emit('hha:judge', { kind:'loop_clear', loopsDone });
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }

        // if no mini active, schedule soon after step clear
        if(!mini || mini.done || mini.fail){
          if(nowMs() > nextMiniAtMs){
            nextMiniAtMs = nowMs() + (diff==='easy'?4500:5500);
          }
        }
      }else{
        // little feedback
        if(combo>0 && combo%5===0){
          showBanner(`🔥 คอมโบ ${combo}!`);
        }else{
          showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      wrongInThisStep++;

      addScore(-5, 'hit_wrong');

      comboReset();

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      popText(obj.x, obj.y, 'WRONG!', 'bad');

      // mini fails immediately for perfectstep
      if(mini && !mini.done && !mini.fail && mini.type==='perfectstep'){
        failMini();
      }

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      // shield blocks hazard (blocked hazard DOES NOT count as miss)
      if(shield>0){
        shield=0;
        addScore(6, 'shield_block');
        emit('hha:judge', { kind:'block', stepIdx, rtMs: rt, source, extra });
        showBanner(`🛡️ กันเชื้อได้!`);
        popText(obj.x, obj.y, 'BLOCK!', 'good');
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      hazInThisStep++;

      addScore(-10, 'hit_haz');

      comboReset();

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      popText(obj.x, obj.y, 'GERM!', 'bad');

      // mini nohaz fails instantly
      if(mini && !mini.done && !mini.fail && mini.type==='nohaz'){
        failMini();
      }
      // perfectstep fails instantly
      if(mini && !mini.done && !mini.fail && mini.type==='perfectstep'){
        failMini();
      }

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

  function expireTargets(){
    const t = nowMs();
    // remove expired; if good expired => combo reset? (kids-friendly: no miss, but combo break)
    for(let i=targets.length-1;i>=0;i--){
      const obj = targets[i];
      if(t >= obj.expireMs){
        targets.splice(i,1);
        obj.el?.remove();

        if(!running) continue;

        // if you miss the correct icon: combo breaks lightly (no miss count)
        if(obj.kind === 'good'){
          comboReset();
          emit('hha:judge', { kind:'expire_good', stepIdx });
        }
      }
    }
  }

  let spawnAcc=0;

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

    // storm schedule/resolve
    if(!stormActive && t >= nextStormAtMs){
      startStorm();
    }
    if(stormActive && t >= stormEndsMs){
      // success if not failed during storm (we're still running)
      endStorm(true);
    }

    // mini schedule
    if((!mini || mini.done || mini.fail) && t >= nextMiniAtMs){
      startMini();
    }
    // mini deadline check
    if(mini && !mini.done && !mini.fail && t >= mini.deadlineMs){
      failMini();
    }
    // special: nohaz mini passes if survives until deadline without failing
    if(mini && !mini.done && !mini.fail && mini.type==='nohaz'){
      const sec = (t - mini.startMs)/1000;
      if(sec >= mini.target) passMini();
    }

    // spawn
    const P = dd ? dd.getParams() : base;

    // accumulator spawn
    spawnAcc += (P.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets to prevent clutter
      if(targets.length > 18){
        // remove oldest non-good first
        const copy = targets.slice().sort((a,b)=>a.bornMs-b.bornMs);
        const pick = copy.find(x=>x.kind!=='good') || copy[0];
        if(pick) removeTarget(pick);
      }
    }

    // expirations
    expireTargets();

    // allow DD update
    dd?.onEvent('tick', { elapsedSec: elapsedSec() });

    // HUD update
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

    shield=0; star=0; soap=0;

    score=0;
    goalsCleared=0; goalsTotal=2;
    miniCleared=0; miniTotal=0;
    mini=null;
    nextMiniAtMs=0;

    stormActive=false;
    stage.classList.remove('storm');
    stormsSeen=0;
    stormsCleared=0;
    stormEndsMs=0;
    nextStormAtMs=0;

    spawnAcc=0;

    stepStartMs = nowMs();
    wrongInThisStep = 0;
    hazInThisStep = 0;

    scheduleStorm();
    nextMiniAtMs = nowMs() + (diff==='easy' ? 6500 : 7500);

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
    stage.classList.remove('storm');

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

    // Goals
    // goal1: survive to end (not fail)
    // goal2: loop >= 1
    goalsCleared = 0;
    if(reason !== 'fail') goalsCleared++;
    if(loopsDone >= 1) goalsCleared++;

    // grade (score + safety)
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1 && getMissCount()<=1) grade='SSS';
    else if(stepAcc>=0.84 && hazHits<=2 && getMissCount()<=2) grade='SS';
    else if(stepAcc>=0.78 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.1.0-fun',
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

      // scoring + completion
      scoreFinal: score,
      grade,

      goalsTotal,
      goalsCleared,
      miniTotal,
      miniCleared,

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
      misses: getMissCount(),

      medianRtGoodMs: rtMed,

      // fun extras
      stormsSeen,
      stormsCleared,
      powerSoap: soap,
      powerShieldUsed: (shield?0:0), // kept minimal; you can expand later
      powerStarUsed: (star?0:0)
    };

    // attach AI extras
    if(coach && coach.getSummaryExtras) Object.assign(summary, coach.getSummaryExtras());
    if(dd && dd.getSummaryExtras) Object.assign(summary, dd.getSummaryExtras());

    // badges/unlocks
    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    // save last + history
    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    // show end UI
    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    if(endSub) endSub.textContent =
      `Grade ${grade} • score ${score} • goals ${goalsCleared}/${goalsTotal} • mini ${miniCleared}/${miniTotal} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;

    if(endJson) endJson.textContent = JSON.stringify(summary, null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });

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

  // init
  resetGame();
}