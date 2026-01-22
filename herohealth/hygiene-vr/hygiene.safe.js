// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + A+B FUN PACK)
// A) Feel: WebAudio SFX + Vibration + ScreenShake + Particles pop
// B) Boss: 👑🦠 King Germ (3 phases) + Storm + Powerups (🛡 SoapShield, ⭐ Star)
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
function median(arr){
  const a = (arr||[]).map(Number).filter(x=>isFinite(x)).sort((x,y)=>x-y);
  if(!a.length) return 0;
  const m = (a.length-1)/2;
  return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
}

// ---------- Steps (emoji mapping) ----------
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6 },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6 },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6 },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6 },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6 },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6 },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6 },
];

const ICON_HAZ   = '🦠';
const ICON_BOSS  = '👑🦠';
const ICON_STAR  = '⭐';
const ICON_SHIELD= '🛡️';
const ICON_SOAP  = '🧼';
const ICON_HEART = '❤️';

// ---------- Tiny SFX (WebAudio) ----------
function createSfx(){
  const api = { ok:false };
  let ctx = null;

  function ensure(){
    if(ctx) return true;
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return false;
      ctx = new AC();
      api.ok = true;
      return true;
    }catch(_){ return false; }
  }

  function beep(freq=440, dur=0.06, type='sine', gain=0.06){
    if(!ensure()) return;
    try{
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0+dur+0.01);
    }catch(_){}
  }

  function hitGood(){ beep(660,0.06,'triangle',0.07); }
  function hitWrong(){ beep(220,0.09,'square',0.06); }
  function hitHaz(){ beep(140,0.12,'sawtooth',0.07); }
  function pickup(){ beep(880,0.07,'sine',0.07); }
  function bossHit(){ beep(520,0.06,'square',0.07); }
  function bossDown(){ beep(200,0.16,'sawtooth',0.08); beep(120,0.18,'sawtooth',0.07); }

  function unlockAudio(){
    if(!ensure()) return;
    try{ if(ctx.state === 'suspended') ctx.resume(); }catch(_){}
  }

  return { unlockAudio, hitGood, hitWrong, hitHaz, pickup, bossHit, bossDown };
}

function vibrate(ms){
  try{
    if(navigator.vibrate) navigator.vibrate(ms);
  }catch(_){}
}

function screenShake(px=6, ms=140){
  const root = DOC.getElementById('gameRoot') || DOC.body;
  if(!root) return;
  root.classList.add('hw-shake');
  root.style.setProperty('--shake-px', String(px));
  clearTimeout(screenShake._t);
  screenShake._t = setTimeout(()=>{
    root.classList.remove('hw-shake');
    root.style.removeProperty('--shake-px');
  }, ms);
}

// ---------- Engine ----------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillPower= DOC.getElementById('pillPower');
  const pillTime = DOC.getElementById('pillTime');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const bossBar  = DOC.getElementById('bossBar');
  const bossTitle= DOC.getElementById('bossTitle');
  const bossMeta = DOC.getElementById('bossMeta');
  const bossFill = DOC.getElementById('bossFill');

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

  const sfx = createSfx();

  // params
  const runMode = (qs('run','play')||'play').toLowerCase(); // play / research / study
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);

  // deterministic rules
  const seedDefault = (runMode==='play') ? Date.now() : 1767274590784;
  const seed = Number(qs('seed', seedDefault));
  const rng = makeRNG(seed);

  // AI toggles
  let coachOn = (qs('coach','1') !== '0');
  let ddOn    = (qs('dd','1') !== '0');
  // in research/study -> disable adaptive by default (fair compare)
  if(runMode !== 'play') ddOn = false;

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, powerRate:0.06 };
    if(diff==='hard') return { spawnPerSec:2.7, hazardRate:0.15, decoyRate:0.26, powerRate:0.05 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, powerRate:0.055 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    powerRate:[0.03, 0.09]
  };

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

  // Powerups
  let shieldOn = false;      // blocks next haz
  let stars = 0;             // can reduce miss by 1 when gained
  let hearts = missLimit;    // visual only

  let correctHits=0;
  let totalStepHits=0; // correct + wrong (only step targets)
  const rtOk = []; // ms
  let spawnAcc=0;

  // Boss pack
  let bossActive=false;
  let bossHp=0, bossHpMax=0;
  let bossPhase=1;
  let bossHits=0;
  let bossSpawnAcc=0;
  let stormOn=false;
  let nextBossAtSec = 18; // first boss time
  let bossCount=0;

  // scoring
  let score=0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, hp?}
  let nextId=1;

  // banner helper
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  // particles helper
  function fxText(x,y,text,cls='good'){
    try{
      if(WIN.Particles && WIN.Particles.popText) WIN.Particles.popText(x,y,text,cls);
    }catch(_){}
  }

  function copyText(text){
    return navigator.clipboard?.writeText(String(text)).catch(()=>{});
  }

  function baseHubUrl(){
    return hub || '../hub.html';
  }

  // safe rect for spawn
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const cs = getComputedStyle(DOC.documentElement);
    const topSafe = parseFloat(cs.getPropertyValue('--hw-top-safe')) || 160;
    const bottomSafe = parseFloat(cs.getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;

    return { x0, x1, y0, y1, w, h };
  }

  function setBossUI(show){
    if(!bossBar) return;
    bossBar.style.display = show ? 'block' : 'none';
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    // hearts display idea in text
    hearts = Math.max(0, missLimit - getMissCount());
    const heartTxt = ICON_HEART.repeat(Math.max(0, hearts));
    const shieldTxt = shieldOn ? `${ICON_SHIELD}` : '';
    const starTxt = stars ? `${ICON_STAR}x${stars}` : '';
    pillPower && (pillPower.textContent = `POWER ${shieldTxt} ${starTxt} ${heartTxt}`.trim() || 'POWER —');

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);

    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);

    // boss UI
    if(bossActive){
      setBossUI(true);
      bossTitle && (bossTitle.textContent = `👑🦠 King Germ (x${bossCount})`);
      bossMeta && (bossMeta.textContent = `HP ${bossHp}/${bossHpMax} • PHASE ${bossPhase}`);
      if(bossFill){
        const pct = bossHpMax ? clamp(bossHp/bossHpMax,0,1) : 0;
        bossFill.style.width = `${(pct*100).toFixed(1)}%`;
      }
    }else{
      setBossUI(false);
    }
  }

  function getMissCount(){
    // Base miss = wrong step hits + hazard hits
    return (wrongStepHits + hazHits);
  }

  function setStorm(on){
    stormOn = !!on;
    stage.classList.toggle('storm', stormOn);
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function createTarget(kind, emoji, stepRef, extra={}){
    const el = DOC.createElement('button');
    el.type='button reflect';
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

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  // --- Spawning rules ---
  function currentParams(){
    return dd ? dd.getParams() : base;
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = currentParams();

    // during boss: spawn mostly minions + hazards
    if(bossActive){
      const r = rng();
      if(r < 0.48) return createTarget('haz', ICON_HAZ, -1);
      if(r < 0.78){
        // wrong step
        let j = stepIdx;
        for(let k=0;k<6;k++){
          const pick = Math.floor(rng()*STEPS.length);
          if(pick !== stepIdx){ j = pick; break; }
        }
        return createTarget('wrong', STEPS[j].icon, j);
      }
      // helpful power more often in boss
      if(r < 0.90) return createTarget('power', ICON_SOAP, -1, { power:'shield' });
      return createTarget('power', ICON_STAR, -1, { power:'star' });
    }

    // normal run
    const r = rng();
    if(r < (P.powerRate||0)){
      // power drop
      return createTarget('power', (rng()<0.6 ? ICON_SOAP : ICON_STAR), -1, { power: (rng()<0.6 ? 'shield':'star') });
    }
    if(r < (P.powerRate||0) + P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }
    if(r < (P.powerRate||0) + P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }
    return createTarget('good', s.icon, stepIdx);
  }

  function spawnBoss(){
    bossActive = true;
    bossCount++;
    bossPhase = 1;
    bossHits = 0;
    setStorm(true);

    // HP scales with diff
    bossHpMax = (diff==='easy') ? 10 : (diff==='hard' ? 14 : 12);
    // also scale with loops done
    bossHpMax += Math.min(6, loopsDone*1);
    bossHp = bossHpMax;

    // spawn a boss target (bigger feel: use power class + boss icon)
    createTarget('power', ICON_BOSS, -1, { isBoss:true, hp: bossHpMax });

    showBanner(`🚨 BOSS มาแล้ว! 👑🦠 กำจัดเชื้อราชา!`);
    fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `👑🦠 BOSS!`, 'warn');
    sfx.pickup();
    vibrate(60);
    screenShake(8, 180);

    emit('hha:judge', { kind:'boss_spawn', boss:true, phase: bossPhase });
  }

  function bossTakeHit(obj){
    if(!bossActive) return;

    bossHits++;
    bossHp = Math.max(0, bossHp - 1);

    sfx.bossHit();
    vibrate(25);
    screenShake(6, 120);
    fxText(obj.x, obj.y, `-1`, 'warn');

    // phase changes
    const pct = bossHpMax ? (bossHp/bossHpMax) : 0;
    if(pct <= 0.66 && bossPhase === 1){
      bossPhase = 2;
      showBanner(`⚡ BOSS PHASE 2: พายุแรงขึ้น!`);
      emit('hha:judge', { kind:'boss_phase', phase: bossPhase });
    }else if(pct <= 0.33 && bossPhase === 2){
      bossPhase = 3;
      showBanner(`🔥 BOSS PHASE 3: ระวังเชื้อถี่มาก!`);
      emit('hha:judge', { kind:'boss_phase', phase: bossPhase });
    }

    // boss down
    if(bossHp <= 0){
      bossActive = false;
      setStorm(false);
      sfx.bossDown();
      vibrate(90);
      fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.25, `🏆 BOSS DOWN!`, 'good');
      showBanner(`🏆 ชนะ BOSS! รับรางวัล +🛡 +⭐`);
      // reward
      shieldOn = true;
      stars = Math.min(9, stars + 1);
      score += 250;

      emit('hha:score', { delta: +250, score });

      // clear boss targets
      targets.slice().forEach(t=>{
        if(t.isBoss) removeTarget(t);
      });

      // schedule next boss
      nextBossAtSec = elapsedSec() + 22 + Math.floor(rng()*10);
      emit('hha:judge', { kind:'boss_clear', boss:true, bossCount, timeSec: elapsedSec() });
    }
  }

  // --- HIT logic ---
  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shooting: aim from center, choose nearest in lock radius
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

  function gainStar(){
    // ⭐ reduces miss by 1 (floor 0) — like GoodJunk feel
    const before = getMissCount();
    if(before > 0){
      // reduce wrongStep first then haz (fair)
      if(wrongStepHits > 0) wrongStepHits--;
      else if(hazHits > 0) hazHits--;
    }
    stars = Math.min(9, stars + 1);
    score += 80;
    emit('hha:score', { delta:+80, score });
    showBanner(`⭐ ได้ดาว! Miss -1 และ +80`);
    sfx.pickup();
    vibrate(40);
    fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.26, `⭐ Miss -1`, 'good');
  }

  function gainShield(){
    shieldOn = true;
    score += 60;
    emit('hha:score', { delta:+60, score });
    showBanner(`🛡 ได้เกราะสบู่! กันเชื้อได้ 1 ครั้ง`);
    sfx.pickup();
    vibrate(35);
    fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `🛡 Shield`, 'warn');
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // unlock audio on first interaction
    try{ sfx.unlockAudio(); }catch(_){}

    // power target
    if(obj.kind === 'power' && obj.power){
      if(obj.power === 'star') gainStar();
      else gainShield();

      emit('hha:judge', { kind:'power', power: obj.power, rtMs: rt, source, extra });
      removeTarget(obj);
      setHud();
      return;
    }

    // boss target
    if(obj.isBoss){
      emit('hha:judge', { kind:'boss_hit', rtMs: rt, source, extra, phase: bossPhase });
      bossTakeHit(obj);
      score += 25;
      emit('hha:score', { delta:+25, score });
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

      // scoring
      const add = 10 + Math.min(20, combo);
      score += add;
      emit('hha:score', { delta:+add, score });

      coach?.onEvent?.('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      sfx.hitGood();
      vibrate(18);

      // micro FX
      fxText(obj.x, obj.y, `+${add}`, 'good');

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        coach?.onEvent?.('step_clear', { stepIdx, stepAcc: getStepAcc(), combo });
        // bonus clear
        score += 35;
        emit('hha:score', { delta:+35, score });
        fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `✅ STEP CLEAR +35`, 'good');

        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          sfx.pickup();

          // chance to spawn a boss after each loop
          if(!bossActive && elapsedSec() >= nextBossAtSec){
            spawnBoss();
          }
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }
      }else{
        showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      // penalty
      score = Math.max(0, score - 15);
      emit('hha:score', { delta:-15, score });

      coach?.onEvent?.('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      sfx.hitWrong();
      vibrate(60);
      screenShake(8, 140);
      fxText(obj.x, obj.y, `-15`, 'bad');

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      // shield blocks haz hit (no miss)
      if(shieldOn){
        shieldOn = false;
        score += 15;
        emit('hha:score', { delta:+15, score });
        emit('hha:judge', { kind:'block', stepIdx, rtMs: rt, source, extra });
        sfx.pickup();
        vibrate(30);
        fxText(obj.x, obj.y, `🛡 BLOCK`, 'warn');
        showBanner(`🛡 กันเชื้อได้!`);
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      combo = 0;

      // penalty
      score = Math.max(0, score - 25);
      emit('hha:score', { delta:-25, score });

      coach?.onEvent?.('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      sfx.hitHaz();
      vibrate(90);
      screenShake(10, 170);
      fxText(obj.x, obj.y, `-25`, 'bad');

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  // --- Main loop ---
  function tick(){
    if(!running) return;

    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    // time
    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // boss schedule by time (even if kid is slow)
    if(!bossActive && elapsedSec() >= nextBossAtSec){
      spawnBoss();
    }

    // spawn rate adjusts during boss phases
    let P = currentParams();
    let spawnRate = P.spawnPerSec;

    if(bossActive){
      // phase intensifies
      spawnRate += (bossPhase===2 ? 0.8 : (bossPhase===3 ? 1.4 : 0.4));
      // extra hazard in storm
      if(stormOn) spawnRate += 0.35;
    }

    spawnAcc += (spawnRate * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets
      if(targets.length > 18){
        // remove oldest non-boss first
        const sorted = targets.slice().sort((a,b)=>a.bornMs-b.bornMs);
        const pick = sorted.find(x=>!x.isBoss) || sorted[0];
        if(pick) removeTarget(pick);
      }
    }

    // DD tick
    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });

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

    // power
    shieldOn=false;
    stars=0;
    hearts=missLimit;

    // boss
    bossActive=false;
    bossHp=0; bossHpMax=0; bossPhase=1; bossHits=0;
    setStorm(false);
    bossCount=0;
    nextBossAtSec = 18 + Math.floor(rng()*6);

    // score
    score=0;

    spawnAcc=0;
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
    emit('hha:score', { delta:0, score });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    setStorm(false);

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    const rtMed = median(rtOk);

    // grade
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.2.0-funpack',
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

      // boss
      bossCount,
      bossHits,

      // core metrics
      scoreFinal: score,
      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),
      medianStepMs: rtMed
    };

    // attach AI extras
    try{ if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {}); }catch(_){}
    try{ if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {}); }catch(_){}

    // badges/unlocks (optional)
    try{
      if(WIN.HHA_Badges){
        WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
      }
    }catch(_){}

    // save last + history
    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    // show end UI
    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `SCORE ${score} • Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • boss ${bossCount}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';

    // end FX
    try{
      fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `🏁 SCORE ${score}`, 'good');
      if(reason!=='fail') sfx.pickup();
      vibrate(60);
    }catch(_){}
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{
    resetGame();
    showBanner('รีเซ็ตแล้ว');
    sfx.pickup();
    vibrate(30);
  }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson.textContent||''), { passive:true });

  function goHub(){
    try{ location.href = baseHubUrl(); }
    catch(_){ location.assign(baseHubUrl()); }
  }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
    vibrate(20);
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // optional: show badge/unlock popups via Particles if available
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    fxText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // add shake CSS helper (inject once)
  (function ensureShakeStyle(){
    if(DOC.getElementById('hwShakeStyle')) return;
    const st = DOC.createElement('style');
    st.id = 'hwShakeStyle';
    st.textContent = `
      .hw-shake{ animation: hwShake .14s linear 1; }
      @keyframes hwShake{
        0%{ transform: translate(0,0); }
        25%{ transform: translate(calc(var(--shake-px,6)*1px), 0); }
        50%{ transform: translate(0, calc(var(--shake-px,6)*1px)); }
        75%{ transform: translate(calc(var(--shake-px,6)*-1px), 0); }
        100%{ transform: translate(0,0); }
      }
    `;
    DOC.head.appendChild(st);
  })();

  // initial
  setHud();
}