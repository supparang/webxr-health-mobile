// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (HUD-safe spawn + PC/Mobile/VR/cVR + Storm/Boss/Rage + AI hooks)
// ✅ HUD-safe spawn uses CSS vars: --gj-top-safe / --gj-bottom-safe
// ✅ miss = goodExpired + junkHit (junk blocked by Shield does NOT count as miss)
// ✅ time<=30 => storm, miss>=4 => boss, miss>=5 => rage
// ✅ Emits: hha:start, hha:time, hha:score, hha:judge, quest:update, hha:coach, hha:end, hha:flush
// ✅ Research: deterministic seed + adaptive OFF
// ✅ Play: adaptive ON (simple Difficulty Director)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return performance?.now ? performance.now() : Date.now(); }

function hashSeedToU32(seed){
  const s = String(seed ?? '');
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function qsFromLocation(){
  try{ return new URL(ROOT.location.href).searchParams; }catch{ return new URLSearchParams(); }
}

function cssPxVar(name, fallbackPx){
  try{
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallbackPx;
  }catch{ return fallbackPx; }
}

function addBodyPulse(cls, ms=180){
  try{
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms);
  }catch(_){}
}

function emit(type, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
}

function byId(id){ return DOC.getElementById(id); }

function setText(id, txt){
  const el = byId(id);
  if(el) el.textContent = String(txt);
}

function boot(opts={}){
  const sp = qsFromLocation();

  const view = String(opts.view ?? sp.get('view') ?? 'mobile').toLowerCase();
  const run  = String(opts.run  ?? sp.get('run')  ?? 'play').toLowerCase();      // play|research
  const diff = String(opts.diff ?? sp.get('diff') ?? 'normal').toLowerCase();   // easy|normal|hard
  const timePlannedSec = clamp(Number(opts.time ?? sp.get('time') ?? 80), 20, 300);

  const hub  = (opts.hub ?? sp.get('hub') ?? null);
  const seedRaw = (opts.seed ?? sp.get('seed') ?? null);
  const research = (run === 'research');

  // deterministic seed for research, or time-based for play
  const seedU32 = research
    ? hashSeedToU32(seedRaw ?? `R-${timePlannedSec}-${diff}`)
    : hashSeedToU32(sp.get('ts') ?? String(Date.now()));

  const rng = mulberry32(seedU32);

  // ---------- DOM ----------
  const layerL = byId('gj-layer');
  const layerR = byId('gj-layer-r');

  if(!layerL){
    console.warn('[GoodJunkVR] missing #gj-layer');
    return;
  }

  // ---------- Config ----------
  const DIFF = {
    easy:   { spawnMs: 860, ttlGood: 1400, ttlJunk: 1400, junkP: 0.22, shieldP: 0.06, missLimit: 7 },
    normal: { spawnMs: 720, ttlGood: 1250, ttlJunk: 1300, junkP: 0.28, shieldP: 0.06, missLimit: 6 },
    hard:   { spawnMs: 600, ttlGood: 1120, ttlJunk: 1200, junkP: 0.34, shieldP: 0.07, missLimit: 5 },
  }[diff] || { spawnMs: 720, ttlGood: 1250, ttlJunk: 1300, junkP: 0.28, shieldP: 0.06, missLimit: 6 };

  const GOOD = ['🍎','🥦','🥕','🍊','🍇','🍉','🥬','🍅'];
  const JUNK = ['🍩','🍟','🍔','🍭','🧁','🥤','🍫','🍿'];
  const SHIELD_EMOJI = '🛡️';
  const STAR = '⭐';

  // ---------- State ----------
  let playing = false;
  let t0 = 0;
  let lastTick = 0;
  let timeLeft = timePlannedSec;

  let score = 0;
  let misses = 0;               // ✅ miss = goodExpired + junkHit (blocked junk not counted)
  let comboMax = 0;
  let combo = 0;

  let nSpawnGood = 0, nSpawnJunk = 0, nSpawnShield = 0, nSpawnStar = 0;
  let nHitGood = 0, nHitJunk = 0, nHitJunkGuard = 0, nExpireGood = 0;

  let fever = 0;                // 0..100
  let shield = 0;               // integer charges

  let stormOn = false;
  let bossOn  = false;
  let rageOn  = false;

  // simple reaction time tracking (for adaptive)
  let lastGoodSpawnAt = 0;
  const rtSamples = [];

  // quests (simple, self-contained)
  const GOALS = [
    { key:'collectGood', title:'เก็บของดีให้ครบ', targetEasy: 16, targetNormal: 18, targetHard: 20 },
    { key:'noJunk', title:'หลบขยะให้ดี', targetEasy: 2, targetNormal: 1, targetHard: 0 }, // max junk hits allowed in goal window
    { key:'survive', title:'อยู่รอดจนหมดเวลา', target: 1 },
  ];
  const MINIS = [
    { key:'fast3', title:'ยิงให้ไว 3 ครั้ง', need:3, limitMs:520, sec:12 },
    { key:'combo5', title:'ทำคอมโบ 5', need:5, sec:14 },
    { key:'noMiss8', title:'ห้ามพลาด 8 วิ', need:1, sec:8 },
  ];

  let goalIndex = 0;
  let goalCur = 0, goalTarget = 0;

  let miniIndex = 0;
  let miniRemain = 0;
  let miniDone = false;

  let fastCount = 0;
  let noMissUntil = 0;

  // active targets
  const active = new Map(); // id -> { el, type, born, ttl, hp, host:'L'|'R' }
  let uid = 0;

  // ---------- Helpers ----------
  function setFever(v){
    fever = clamp(v, 0, 100);
    const fill = byId('feverFill');
    if(fill) fill.style.width = fever + '%';
    setText('feverText', `${Math.round(fever)}%`);
  }

  function setShield(v){
    shield = Math.max(0, Math.floor(v||0));
    setText('shieldPills', shield ? (SHIELD_EMOJI + '×' + shield) : '—');
  }

  function gradeFrom(){
    // accuracy over good targets (rough)
    const goodTotal = Math.max(1, nHitGood + nExpireGood);
    const accGood = nHitGood / goodTotal; // 0..1
    if(misses <= 1 && accGood >= 0.85) return 'A';
    if(misses <= 3 && accGood >= 0.75) return 'B';
    if(misses <= 5 && accGood >= 0.60) return 'C';
    return 'D';
  }

  function updateHUD(){
    setText('hud-score', score);
    setText('hud-miss', misses);
    setText('hud-time', Math.max(0, Math.ceil(timeLeft)));
    setText('hud-grade', gradeFrom());

    setText('hud-goal-cur', goalCur);
    setText('hud-goal-target', goalTarget);
    setText('miniTimer', miniRemain ? `${miniRemain}s` : '—');

    // emit quest:update for global UI/listeners
    emit('quest:update', {
      goalTitle: byId('hud-goal')?.textContent || '',
      goalCur, goalTarget,
      miniText: byId('hud-mini')?.textContent || '',
      miniRemainSec: miniRemain,
    });
  }

  function setGoalText(title, desc){
    setText('hud-goal', title);
    setText('goalDesc', desc);
  }

  function setMiniText(txt){
    setText('hud-mini', txt);
  }

  function pickGoal(){
    const g = GOALS[goalIndex % GOALS.length];
    if(g.key === 'collectGood'){
      goalTarget = (diff==='easy') ? g.targetEasy : (diff==='hard') ? g.targetHard : g.targetNormal;
      goalCur = 0;
      setGoalText(`GOAL ${goalIndex+1}: ${g.title}`, `เก็บ “ของดี” ให้ครบ ${goalTarget} ชิ้น`);
    } else if(g.key === 'noJunk'){
      goalTarget = (diff==='easy') ? g.targetEasy : (diff==='hard') ? g.targetHard : g.targetNormal;
      goalCur = 0;
      setGoalText(`GOAL ${goalIndex+1}: ${g.title}`, `ระหว่างทำ GOAL นี้ โดนขยะได้ไม่เกิน ${goalTarget} ครั้ง`);
    } else {
      goalTarget = 1; goalCur = 0;
      setGoalText(`GOAL ${goalIndex+1}: ${g.title}`, `อยู่รอดจนหมดเวลา (อย่า MISS เกินลิมิต)`);
    }
  }

  function pickMini(){
    const m = MINIS[miniIndex % MINIS.length];
    miniRemain = m.sec;
    miniDone = false;
    fastCount = 0;
    noMissUntil = now() + (m.key==='noMiss8' ? (m.sec*1000) : 0);

    if(m.key === 'fast3') setMiniText(`${m.title} (0/${m.need})`);
    else if(m.key === 'combo5') setMiniText(`${m.title} (0/${m.need})`);
    else setMiniText(`${m.title}`);
  }

  function completeGoal(){
    goalIndex++;
    emit('hha:judge', { kind:'goal', msg:'GOAL COMPLETE' });
    pickGoal();
  }

  function completeMini(){
    if(miniDone) return;
    miniDone = true;
    addBodyPulse('gj-mini-clear', 220);
    emit('hha:judge', { kind:'mini', msg:'MINI CLEAR' });
    emit('hha:coach', { kind:'cheer', msg:'เก่งมาก! ผ่าน MINI แล้ว 🎉' });
    miniIndex++;
    setTimeout(pickMini, 350);
  }

  function tickMini(){
    if(miniDone) return;
    if(miniRemain > 0){
      miniRemain -= 1;
      if(miniRemain <= 0){
        // mini fails silently => rotate
        miniIndex++;
        pickMini();
      }
    }
  }

  function inNoMissWindow(){
    return (noMissUntil && now() <= noMissUntil);
  }

  // ---------- HUD-safe play rect ----------
  function getPlayRectForHost(hostEl){
    const r = hostEl.getBoundingClientRect();
    const topSafe = cssPxVar('--gj-top-safe', 150);
    const botSafe = cssPxVar('--gj-bottom-safe', 120);

    const pad = 14;
    const x0 = pad;
    const x1 = Math.max(pad+40, r.width - pad);
    const y0 = Math.max(pad, topSafe);
    const y1 = Math.max(y0+60, r.height - botSafe);

    return { x0, x1, y0, y1, w:r.width, h:r.height };
  }

  function randRange(a,b){ return a + (b-a) * rng(); }

  function spawnOne(hostEl, hostKey){
    const rect = getPlayRectForHost(hostEl);

    // storm/rage changes
    let junkP = DIFF.junkP;
    let shieldP = DIFF.shieldP;

    if(stormOn) junkP += 0.06;
    if(rageOn)  junkP += 0.10;

    let type = 'good';
    const roll = rng();
    if(roll < shieldP) type = 'shield';
    else if(roll < shieldP + 0.06) type = 'star';
    else if(roll < shieldP + 0.06 + junkP) type = 'junk';

    const el = DOC.createElement('div');
    el.className = 'gj-target spawn';
    const id = (++uid) + '-' + hostKey;
    el.dataset.id = id;
    el.dataset.type = type;

    let emoji = '🍎';
    let ttl = DIFF.ttlGood;
    let hp = 1;

    if(type === 'good'){
      emoji = GOOD[(GOOD.length * rng())|0];
      ttl = stormOn ? (DIFF.ttlGood - 80) : DIFF.ttlGood;
      nSpawnGood++;
      lastGoodSpawnAt = now();
    } else if(type === 'junk'){
      emoji = JUNK[(JUNK.length * rng())|0];
      ttl = stormOn ? (DIFF.ttlJunk - 50) : DIFF.ttlJunk;
      nSpawnJunk++;
    } else if(type === 'shield'){
      emoji = SHIELD_EMOJI;
      ttl = 1500;
      nSpawnShield++;
    } else {
      emoji = STAR;
      ttl = 1500;
      nSpawnStar++;
    }

    // boss inject
    if(bossOn && !activeBossExists()){
      // spawn boss occasionally
      if(rng() < 0.16){
        type = 'boss';
        el.dataset.type = 'boss';
        emoji = '💀';
        ttl = 2200;
        hp = rageOn ? 5 : 4;
        el.style.fontSize = '72px';
        el.style.filter = 'drop-shadow(0 18px 26px rgba(239,68,68,.22))';
      }
    }

    el.textContent = emoji;

    // position in host
    const x = randRange(rect.x0, rect.x1);
    const y = randRange(rect.y0, rect.y1);
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // hit by tap/click
    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      hitTarget(id);
    }, { passive:false });

    hostEl.appendChild(el);
    active.set(id, { el, type, born: now(), ttl, hp, host: hostKey });

    // expire
    setTimeout(()=>expireTarget(id), ttl);
  }

  function activeBossExists(){
    for(const v of active.values()){
      if(v.type === 'boss') return true;
    }
    return false;
  }

  function removeTarget(id){
    const t = active.get(id);
    if(!t) return;
    active.delete(id);
    try{
      t.el.classList.add('gone');
      setTimeout(()=>t.el.remove(), 140);
    }catch(_){}
  }

  function expireTarget(id){
    const t = active.get(id);
    if(!t || !playing) return;
    if(t.type === 'good'){
      nExpireGood++;
      // ✅ miss += goodExpired
      misses++;
      combo = 0;
      addBodyPulse('gj-good-expire', 180);
      emit('hha:judge', { kind:'miss', reason:'goodExpired' });
      if(inNoMissWindow()){ noMissUntil = 0; } // fail no-miss mini
      setFever(fever + 6);
      updatePhases();
      updateHUD();
    }
    removeTarget(id);
  }

  function hitTarget(id){
    const t = active.get(id);
    if(!t || !playing) return;

    // boss needs multi-hit
    if(t.type === 'boss'){
      t.hp = Math.max(0, (t.hp||1) - 1);
      emit('hha:judge', { kind:'boss', msg:`BOSS HIT (${t.hp})` });
      addBodyPulse('gj-mini-clear', 120);
      score += 12;
      setFever(fever + 2);
      if(t.hp <= 0){
        score += rageOn ? 90 : 70;
        emit('hha:coach', { kind:'cheer', msg:'โค่นบอสได้! 🔥' });
        removeTarget(id);
      }
      updateHUD();
      return;
    }

    if(t.type === 'good'){
      nHitGood++;
      score += stormOn ? 12 : 10;
      combo++;
      comboMax = Math.max(comboMax, combo);

      // reaction time sample
      if(lastGoodSpawnAt){
        const rt = now() - lastGoodSpawnAt;
        if(rt > 0 && rt < 5000){
          rtSamples.push(rt);
          if(rtSamples.length > 20) rtSamples.shift();
        }
      }

      // goal progress
      const g = GOALS[goalIndex % GOALS.length];
      if(g.key === 'collectGood'){
        goalCur = Math.min(goalTarget, goalCur + 1);
        if(goalCur >= goalTarget) completeGoal();
      } else if(g.key === 'noJunk'){
        // goalCur = junkHits during this goal; updated elsewhere
      } else {
        // survive goal uses time end
      }

      // mini progress
      const m = MINIS[miniIndex % MINIS.length];
      if(!miniDone && m.key === 'fast3'){
        const rt = rtSamples[rtSamples.length-1] || 9999;
        if(rt <= m.limitMs){
          fastCount++;
          setMiniText(`${m.title} (${fastCount}/${m.need})`);
          if(fastCount >= m.need) completeMini();
        }
      }
      if(!miniDone && m.key === 'combo5'){
        setMiniText(`${m.title} (${Math.min(m.need, combo)}/${m.need})`);
        if(combo >= m.need) completeMini();
      }

      // fever (good reduces a bit)
      setFever(fever - 2);

      emit('hha:score', { delta:10, score });
      emit('hha:judge', { kind: (combo>=8 ? 'combo' : 'good') });

      updatePhases();
      updateHUD();
      removeTarget(id);
      return;
    }

    if(t.type === 'junk'){
      nHitJunk++;

      if(shield > 0){
        // ✅ blocked => not miss
        setShield(shield - 1);
        nHitJunkGuard++;
        emit('hha:judge', { kind:'block', reason:'shield' });
        emit('hha:coach', { kind:'tip', msg:'โล่ช่วยบล็อกขยะ! ดีมาก 🛡️' });
        score += 2;
      }else{
        // ✅ miss += junkHit
        misses++;
        combo = 0;
        addBodyPulse('gj-junk-hit', 220);
        emit('hha:judge', { kind:'bad', reason:'junkHit' });

        // update "noJunk" goal progress
        const g = GOALS[goalIndex % GOALS.length];
        if(g.key === 'noJunk'){
          goalCur = Math.min(goalTarget+99, goalCur + 1); // count junk hits in this goal
          setGoalText(`GOAL ${goalIndex+1}: หลบขยะให้ดี`, `โดนขยะไปแล้ว ${goalCur}/${goalTarget} ครั้ง`);
          if(goalCur > goalTarget){
            // failed this goal => move on (pressure)
            emit('hha:coach', { kind:'warn', msg:'โดนขยะเกินแล้ว! ไป GOAL ถัดไปนะ' });
            completeGoal();
          }
        }

        if(inNoMissWindow()){ noMissUntil = 0; } // fail no-miss mini
        setFever(fever + 12);
        score = Math.max(0, score - 6);
      }

      updatePhases();
      updateHUD();
      removeTarget(id);
      return;
    }

    if(t.type === 'shield'){
      setShield(shield + 1);
      score += 6;
      emit('hha:judge', { kind:'good', msg:'SHIELD +' });
      updateHUD();
      removeTarget(id);
      return;
    }

    if(t.type === 'star'){
      score += 25;
      setFever(fever - 6);
      emit('hha:judge', { kind:'perfect', msg:'STAR!' });
      emit('hha:coach', { kind:'cheer', msg:'สุดยอด! ได้โบนัส ⭐' });
      updateHUD();
      removeTarget(id);
      return;
    }
  }

  // crosshair shoot: hit test center
  function shootAtCenter(detail){
    if(!playing) return;

    const isCVR = (view === 'cvr');
    const host = layerL;
    const r = host.getBoundingClientRect();
    const cx = r.width/2;
    const cy = r.height/2;

    // find topmost target whose box contains center (host L only; for cVR we mirror by spawning both)
    let bestId = null;
    for(const [id, t] of active.entries()){
      if(t.host !== 'L') continue;
      const el = t.el;
      if(!el || !el.isConnected) continue;
      const br = el.getBoundingClientRect();
      // translate viewport to host local
      const x = (br.left - r.left);
      const y = (br.top  - r.top);
      const w = br.width, h = br.height;
      if(cx >= x && cx <= x+w && cy >= y && cy <= y+h){
        bestId = id;
        break;
      }
    }

    if(bestId){
      hitTarget(bestId);
      if(isCVR){
        // also hit mirrored target on R if exists
        const rid = bestId.replace('-L','-R');
        if(active.has(rid)) hitTarget(rid);
      }
    }else{
      // optional miss-shot feedback (ไม่รวมใน miss หลัก เพื่อไม่ทำโหดเกินสำหรับ ป.5)
      addBodyPulse('gj-miss-shot', 120);
      emit('hha:judge', { kind:'miss', reason:'missShot', src: detail?.source || 'shoot' });
    }
  }

  // ---------- Phase logic: storm/boss/rage ----------
  function updatePhases(){
    if(timeLeft <= 30 && !stormOn){
      stormOn = true;
      DOC.body.classList.add('gj-lowtime');
      emit('hha:judge', { kind:'storm' });
      emit('hha:coach', { kind:'warn', msg:'⚡ Storm! เวลาเหลือน้อยแล้ว ยิงให้ไว!' });
    }
    if(misses >= 4 && !bossOn){
      bossOn = true;
      emit('hha:judge', { kind:'boss' });
      emit('hha:coach', { kind:'warn', msg:'👹 Boss มาแล้ว! ระวังขยะ!' });
    }
    if(misses >= 5 && !rageOn){
      rageOn = true;
      emit('hha:judge', { kind:'rage' });
      emit('hha:coach', { kind:'warn', msg:'🔥 Rage! เกมโหดขึ้นแล้ว!' });
      DOC.body.classList.add('gj-lowtime5'); // ใช้ ring แดงให้ดูเดือดขึ้น
    }
  }

  // ---------- Adaptive Difficulty (simple AI Director) ----------
  let spawnMs = DIFF.spawnMs;
  function adaptiveStep(){
    if(research) return; // OFF in research
    // every ~6s adjust spawn speed by performance
    const goodTotal = Math.max(1, nHitGood + nExpireGood);
    const accGood = nHitGood / goodTotal;
    const rtAvg = rtSamples.length ? (rtSamples.reduce((a,b)=>a+b,0)/rtSamples.length) : 9999;

    let target = DIFF.spawnMs;

    if(accGood > 0.86 && misses <= 2 && rtAvg < 720) target -= 120;
    if(accGood < 0.65 || misses >= 4) target += 120;
    if(stormOn) target -= 80;
    if(rageOn)  target -= 90;

    spawnMs = clamp(target, 420, 1100);
  }

  // ---------- Main loop ----------
  let spawnTimer = null;
  let secondTimer = null;
  let adaptiveTimer = null;

  function start(){
    playing = true;
    t0 = now();
    lastTick = t0;

    // init UI
    setFever(0);
    setShield(0);

    pickGoal();
    pickMini();
    updateHUD();

    emit('hha:start', {
      projectTag:'GoodJunkVR',
      runMode: run,
      diff,
      device: view,
      durationPlannedSec: timePlannedSec,
      seed: research ? String(seedRaw ?? seedU32) : null,
    });

    // shoot event
    ROOT.addEventListener('hha:shoot', (e)=>shootAtCenter(e?.detail || null));

    // spawn loop
    spawnTimer = setInterval(()=>{
      if(!playing) return;

      // in cVR => spawn BOTH (L and R) so crosshair hit can mirror
      spawnOne(layerL, 'L');
      if(view === 'cvr' && layerR) spawnOne(layerR, 'R');

    }, spawnMs);

    // second tick
    secondTimer = setInterval(()=>{
      if(!playing) return;

      const t = now();
      const dt = (t - lastTick) / 1000;
      lastTick = t;

      timeLeft = Math.max(0, timeLeft - 1);

      // lowtime visual tick
      if(timeLeft <= 5){
        DOC.body.classList.add('gj-lowtime5');
        const num = byId('gj-lowtime-num');
        if(num) num.textContent = String(Math.max(0, Math.ceil(timeLeft)));
        DOC.body.classList.toggle('gj-tick');
        setTimeout(()=>DOC.body.classList.toggle('gj-tick'), 90);
      }

      tickMini();
      updatePhases();
      updateHUD();
      emit('hha:time', { timeLeftSec: timeLeft });

      if(timeLeft <= 0){
        end('time');
      }

      // miss limit end
      if(misses >= DIFF.missLimit){
        end('missLimit');
      }

    }, 1000);

    // adaptive step
    adaptiveTimer = setInterval(()=>{
      adaptiveStep();

      // update spawn interval if changed (restart timer)
      if(!research && spawnTimer){
        clearInterval(spawnTimer);
        spawnTimer = setInterval(()=>{
          if(!playing) return;
          spawnOne(layerL, 'L');
          if(view === 'cvr' && layerR) spawnOne(layerR, 'R');
        }, spawnMs);
      }
    }, 6000);
  }

  function end(reason){
    if(!playing) return;
    playing = false;

    try{
      clearInterval(spawnTimer); clearInterval(secondTimer); clearInterval(adaptiveTimer);
    }catch(_){}

    // cleanup targets
    for(const id of Array.from(active.keys())) removeTarget(id);

    const grade = gradeFrom();
    const durationPlayedSec = Math.max(0, Math.round(timePlannedSec - timeLeft));

    const summary = {
      projectTag:'GoodJunkVR',
      reason,
      runMode: run,
      diff,
      device: view,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,
      scoreFinal: score,
      comboMax,
      misses,
      goalsCleared: goalIndex,
      goalsTotal: GOALS.length,
      miniCleared: miniIndex,
      miniTotal: MINIS.length,
      nTargetGoodSpawned: nSpawnGood,
      nTargetJunkSpawned: nSpawnJunk,
      nTargetShieldSpawned: nSpawnShield,
      nTargetStarSpawned: nSpawnStar,
      nHitGood,
      nHitJunk,
      nHitJunkGuard,
      nExpireGood,
      grade,
      seed: research ? String(seedRaw ?? seedU32) : null,
      endTimeIso: new Date().toISOString(),
    };

    // store latest summary (HHA standard)
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch(_){}

    emit('hha:end', summary);
    emit('hha:flush', { reason:'end' });

    // friendly coach message
    emit('hha:coach', {
      kind:'end',
      msg: (reason==='missLimit')
        ? `จบเกม! MISS เยอะไปนิดนะ 😅 เกรด ${grade}`
        : `จบเกม! เกรด ${grade} 🎉`,
    });
  }

  // expose minimal API for debugging
  ROOT.GoodJunkVR = { end };

  // start now
  start();
}

export { boot };