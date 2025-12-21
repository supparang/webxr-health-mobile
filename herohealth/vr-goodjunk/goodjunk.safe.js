// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR (PRODUCTION) — Step F
// ✅ Real combo multiplier scoring
// ✅ Final Sprint: 8s last = every second "LOCK 1s" + vortex ring shrink (via class)
// ✅ Boss: Phase 2 + Shield Break (in boss challenge)
// ✅ Fever decays + STUN activates + junk breaks near vortex (aim point)
// ✅ Emits events used by goodjunk-vr.boot.js & quest-director:
//    hha:score, hha:time, hha:judge, hha:fever, hha:end
//    quest:goodHit, quest:badHit, quest:gold, quest:power, quest:block, quest:stunBreak, quest:bossClear

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt(){}, scorePop(){}, celebrate(){}, toast(){} };

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }
function randi(a,b){ return (a + Math.floor(Math.random()*(b-a+1))); }
function now(){ return performance.now ? performance.now() : Date.now(); }

function safeDispatch(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function getAimPoint(){
  const ap = ROOT.__GJ_AIM_POINT__;
  if (ap && Number.isFinite(ap.x) && Number.isFinite(ap.y)) return { x: ap.x|0, y: ap.y|0 };
  return { x: (innerWidth*0.5)|0, y: (innerHeight*0.62)|0 };
}

// Difficulty table (DOM targets)
const DIFF = {
  easy:   { spawnMs: 880, maxActive: 6,  ttlMs: 2100, scale: 1.08, junkRatio: 0.34, goldRatio: 0.08, powerRatio: 0.09, bossHp: 6 },
  normal: { spawnMs: 760, maxActive: 7,  ttlMs: 1900, scale: 1.00, junkRatio: 0.40, goldRatio: 0.07, powerRatio: 0.08, bossHp: 8 },
  hard:   { spawnMs: 640, maxActive: 8,  ttlMs: 1700, scale: 0.92, junkRatio: 0.46, goldRatio: 0.06, powerRatio: 0.07, bossHp: 10 }
};

function pickDiff(key){
  key = String(key||'normal').toLowerCase();
  return DIFF[key] ? { ...DIFF[key] } : { ...DIFF.normal };
}

// Emoji pools
const POOL_GOOD = ['🥦','🥕','🍎','🍌','🥬','🍇','🍊','🍉','🥜','🐟','🥛'];
const POOL_JUNK = ['🍟','🍕','🍔','🍩','🍭','🥤','🍰','🍫','🧁'];
const POOL_FAKE = ['😈','🧨','🪤','☠️']; // fake/junk-like traps
const EMO_GOLD  = '🟡';
const EMO_MAG   = '🧲';
const EMO_TIME  = '⏳';
const EMO_SHLD  = '🛡️';
const EMO_BOSS1 = '👑';
const EMO_BOSS2 = '👹'; // phase 2 vibe

function createEl(layer, x, y, emoji, cls){
  const el = document.createElement('div');
  el.className = `gj-target gj-sticker ${cls||''}`;
  el.textContent = emoji;
  el.style.left = (x|0) + 'px';
  el.style.top  = (y|0) + 'px';
  el.style.setProperty('--tScale', String(1));
  el.style.setProperty('--tRot', (randi(-10,10))+'deg');
  layer.appendChild(el);
  // fade-in
  requestAnimationFrame(()=> el.classList.add('spawn'));
  return el;
}

function killEl(el){
  try{
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
  }catch(_){}
}

function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return dx*dx + dy*dy;
}

// Combo multiplier (Step F)
function comboMultiplier(combo){
  // smooth + capped, feels "arcade"
  // 0=>1.00, 5=>1.25, 10=>1.55, 15=>1.85, 20=>2.15 (cap 2.35)
  const c = Math.max(0, combo|0);
  const m = 1 + Math.min(1.35, c * 0.07);
  return Math.round(m*100)/100;
}

function scoreGain(base, combo){
  const mul = comboMultiplier(combo);
  return Math.round(base * mul);
}

function judgeLabel(kind){
  if (kind === 'perfect') return 'PERFECT!';
  if (kind === 'good') return 'GOOD!';
  if (kind === 'gold') return 'GOLD!';
  if (kind === 'power') return 'POWER!';
  if (kind === 'boss') return 'BOSS HIT!';
  if (kind === 'boss2') return 'PHASE 2!';
  if (kind === 'block') return 'BLOCK!';
  if (kind === 'break') return 'STUN BREAK!';
  if (kind === 'miss') return 'MISS!';
  if (kind === 'shieldbreak') return 'SHIELD BREAK!';
  return 'OK';
}

function popFX(x,y,pts,label){
  try{
    if (label) safeDispatch('hha:judge', { label });
    Particles.scorePop && Particles.scorePop(x, y, String(pts||''), label||'');
    Particles.burstAt && Particles.burstAt(x, y, 'good');
  }catch(_){}
}

function burstFX(x,y,mode){
  try{ Particles.burstAt && Particles.burstAt(x, y, mode||'good'); }catch(_){}
}

function celebrate(kind,intensity){
  try{ Particles.celebrate && Particles.celebrate({ kind, intensity }); }catch(_){}
}

export function boot(opts = {}){
  const diffKey = String(opts.diff || 'normal').toLowerCase();
  const runMode = String(opts.run || 'play').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time || 60, 20, 180) | 0;

  const D = pickDiff(diffKey);

  const layer = opts.layerEl || document.getElementById('gj-layer');
  if (!layer) throw new Error('[GoodJunk] layerEl missing');

  // --------- STATE ----------
  const S = {
    running: true,
    startedAt: now(),
    endAt: now() + durationSec*1000,

    timeLeft: durationSec,

    score: 0,
    goodHits: 0,
    misses: 0,

    combo: 0,
    comboMax: 0,

    fever: 0,            // 0..100
    feverDecayPerSec: 8, // ✅ fever ลดจริง
    stunActive: false,
    stunEndsAt: 0,
    slow: 1.0,           // time slow factor during STUN

    shield: 0,

    magnetActive: false,
    magnetEndsAt: 0,

    // Final Sprint locks
    finalLock: false,
    finalLockEndsAt: 0,
    lastFinalPulseSec: null,

    // boss
    bossSpawned: false,
    bossAlive: false,
    bossPhase: 1,
    bossHp: 0,
    bossHpMax: 0,
    bossEl: null,
    bossDecoyCooldownAt: 0,

    // spawn
    lastSpawnAt: 0,
    targets: new Map(),
    nextId: 1
  };

  // Helpers
  function emitScore(){
    safeDispatch('hha:score', {
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      multiplier: comboMultiplier(S.combo|0)
    });
  }
  function emitTime(){
    safeDispatch('hha:time', { sec: S.timeLeft|0 });
  }
  function emitFever(){
    safeDispatch('hha:fever', {
      fever: clamp(S.fever,0,100),
      shield: S.shield|0,
      stunActive: !!S.stunActive,
      slow: Number(S.slow)||1
    });
  }

  function setCombo(v){
    S.combo = Math.max(0, v|0);
    if (S.combo > S.comboMax) S.comboMax = S.combo;
  }

  function addFever(delta){
    S.fever = clamp((S.fever||0) + (delta||0), 0, 100);
  }

  function startStun(){
    // STUN: slow whole game + fire overlay (UI driven by boot.js)
    S.stunActive = true;
    S.slow = 0.62; // feels like "slow-mo"
    const dur = 6200; // ms
    S.stunEndsAt = now() + dur;

    // after trigger, reduce fever so it can climb again
    S.fever = 65;

    celebrate('STUN', 1.2);
    safeDispatch('hha:judge', { label: 'STUN!' });
    emitFever();
  }

  function stopStun(){
    S.stunActive = false;
    S.slow = 1.0;
    // drop fever a bit after stun ends (so it doesn’t feel “stuck full”)
    S.fever = Math.min(S.fever, 45);
    emitFever();
  }

  function activateMagnet(){
    S.magnetActive = true;
    S.magnetEndsAt = now() + 5200;
    safeDispatch('quest:power', { power:'magnet' });
    safeDispatch('hha:judge', { label: 'MAGNET!' });
    burstFX(innerWidth*0.5, innerHeight*0.62, 'power');
  }

  function addTime(){
    // extend endAt by +3s (but not beyond +12s total feel)
    S.endAt += 3000;
    safeDispatch('quest:power', { power:'time' });
    safeDispatch('hha:judge', { label: '+TIME!' });
    burstFX(innerWidth*0.5, innerHeight*0.62, 'power');
  }

  function addShield(){
    S.shield = clamp((S.shield|0) + 1, 0, 5);
    safeDispatch('quest:power', { power:'shield' });
    safeDispatch('hha:judge', { label: '+SHIELD!' });
    emitFever();
  }

  function isFinalSprint(){
    return (S.timeLeft|0) <= 8;
  }

  function triggerFinalPulse(secLeft){
    // LOCK 1s effect (Step F)
    if (S.finalLock) return;
    S.finalLock = true;
    S.finalLockEndsAt = now() + 1000;

    // tell boot/UI to flash+tick+ring shrink
    safeDispatch('hha:finalPulse', { secLeft: secLeft|0 });
  }

  function endGame(){
    if (!S.running) return;
    S.running = false;

    // cleanup
    for (const t of S.targets.values()){
      try{ killEl(t.el); }catch(_){}
    }
    S.targets.clear();

    safeDispatch('hha:end', {
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      durationSec: durationSec|0,
      diff: diffKey,
      challenge,
      runMode
    });
  }

  // ---------- Target spawn ----------
  function spawnTarget(kind){
    if (!S.running) return;
    if (S.targets.size >= D.maxActive) return;

    const margin = 28;
    const topSafe = 96;
    const botSafe = 140;
    const leftSafe = 16;
    const rightSafe = 16;

    const x = randi(leftSafe + margin, Math.max(leftSafe + margin + 10, innerWidth - rightSafe - margin));
    const y = randi(topSafe + margin, Math.max(topSafe + margin + 10, innerHeight - botSafe - margin));

    let emoji = '❓';
    let cls = '';
    let base = 0;
    let ttl = D.ttlMs;

    if (kind === 'good'){
      emoji = POOL_GOOD[randi(0, POOL_GOOD.length-1)];
      cls = '';
      base = 20;
    } else if (kind === 'junk'){
      emoji = POOL_JUNK[randi(0, POOL_JUNK.length-1)];
      cls = 'gj-junk';
      base = -1;
    } else if (kind === 'fake'){
      emoji = POOL_FAKE[randi(0, POOL_FAKE.length-1)];
      cls = 'gj-fake';
      base = -1;
      ttl = Math.round(ttl * 0.92);
    } else if (kind === 'gold'){
      emoji = EMO_GOLD;
      cls = 'gj-gold';
      base = 90;
      ttl = Math.round(ttl * 0.95);
    } else if (kind === 'power'){
      const p = randi(1,3);
      emoji = (p===1) ? EMO_MAG : (p===2) ? EMO_TIME : EMO_SHLD;
      cls = 'gj-power';
      base = 0;
      ttl = Math.round(ttl * 0.92);
    } else if (kind === 'boss'){
      emoji = (S.bossPhase === 2) ? EMO_BOSS2 : EMO_BOSS1;
      cls = 'gj-boss';
      base = 0;
      ttl = 999999; // boss doesn't expire normally
    } else if (kind === 'decoy'){
      emoji = POOL_JUNK[randi(0, POOL_JUNK.length-1)];
      cls = 'gj-junk';
      base = -1;
      ttl = Math.round(ttl * 0.72);
    }

    const el = createEl(layer, x, y, emoji, cls);
    // per-target scale feel
    const sc = (kind === 'boss')
      ? (1.28 * D.scale)
      : (0.98 + Math.random()*0.22) * D.scale;
    el.style.setProperty('--tScale', String(sc.toFixed(3)));

    const id = S.nextId++;
    const t = {
      id,
      kind,
      base,
      el,
      x, y,
      bornAt: now(),
      expiresAt: now() + ttl,
      hp: (kind === 'boss') ? S.bossHp : 1,
      phase: (kind === 'boss') ? S.bossPhase : 1
    };
    S.targets.set(id, t);

    // input handler
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      onHit(t, ev);
    }, { passive:false });
  }

  function spawnWave(){
    // spawn logic with ratios
    // During STUN, spawn slightly fewer (player already strong)
    const slowAdj = S.stunActive ? 0.90 : 1.0;

    const p = Math.random();
    const pGold = D.goldRatio * slowAdj;
    const pPower= D.powerRatio * slowAdj;
    const pFake = 0.12 * slowAdj;
    const pJunk = D.junkRatio;

    if (challenge === 'boss'){
      // in boss mode, allow more junk pressure
      if (p < pGold) return spawnTarget('gold');
      if (p < pGold + pPower) return spawnTarget('power');
      if (p < pGold + pPower + pFake) return spawnTarget('fake');
      if (p < pGold + pPower + pFake + (pJunk+0.08)) return spawnTarget('junk');
      return spawnTarget('good');
    }

    // rush/survival
    if (p < pGold) return spawnTarget('gold');
    if (p < pGold + pPower) return spawnTarget('power');
    if (p < pGold + pPower + pFake) return spawnTarget('fake');
    if (p < pGold + pPower + pFake + pJunk) return spawnTarget('junk');
    return spawnTarget('good');
  }

  // ---------- Boss logic (Step F) ----------
  function maybeSpawnBoss(){
    if (challenge !== 'boss') return;
    if (S.bossSpawned) return;

    // Spawn when <= 22s left (feel like late-game)
    if ((S.timeLeft|0) > 22) return;

    S.bossSpawned = true;
    S.bossAlive = true;
    S.bossPhase = 1;

    const hp = D.bossHp|0;
    S.bossHpMax = hp;
    S.bossHp = hp;

    spawnTarget('boss');
    // locate boss element reference
    // (last created boss)
    for (const t of S.targets.values()){
      if (t.kind === 'boss'){ S.bossEl = t.el; break; }
    }

    celebrate('BOSS_SPAWN', 1.4);
    safeDispatch('hha:judge', { label: 'BOSS!' });
  }

  function bossToPhase2(){
    if (!S.bossAlive) return;
    if (S.bossPhase >= 2) return;

    S.bossPhase = 2;

    // “phase 2” = faster pressure + decoys + shield break danger
    celebrate('BOSS_PHASE2', 1.6);
    safeDispatch('hha:judge', { label: 'PHASE 2!' });

    // update boss visual
    for (const t of S.targets.values()){
      if (t.kind === 'boss'){
        t.phase = 2;
        t.el.textContent = EMO_BOSS2;
        t.el.style.filter = 'drop-shadow(0 20px 36px rgba(56,189,248,0.25)) drop-shadow(0 0 18px rgba(56,189,248,0.22))';
        break;
      }
    }
  }

  function bossClear(){
    if (!S.bossAlive) return;
    S.bossAlive = false;

    // remove boss target(s)
    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss'){
        killEl(t.el);
        S.targets.delete(t.id);
      }
    }

    celebrate('BOSS_CLEAR', 2.0);
    safeDispatch('quest:bossClear', {});
    safeDispatch('hha:judge', { label: 'BOSS CLEARED!' });
  }

  // ---------- Hit / Miss ----------
  function onHit(t, ev){
    if (!S.running) return;

    // Final lock blocks input (Step F)
    if (S.finalLock) {
      // give feedback for “locked”
      safeDispatch('hha:judge', { label: 'LOCK!' });
      return;
    }

    const rect = t.el.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    // magnet active: pull good -> auto-hit feel
    // (we keep input required, but score feels faster due to multiplier)
    if (t.kind === 'good'){
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(8);

      const pts = scoreGain(20, S.combo);
      S.score += pts;

      popFX(cx, cy, `+${pts}`, judgeLabel((S.combo>=10) ? 'perfect' : 'good'));
      safeDispatch('quest:goodHit', { kind:'good' });

      killEl(t.el);
      S.targets.delete(t.id);

    } else if (t.kind === 'gold'){
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(12);

      const pts = scoreGain(90, S.combo);
      S.score += pts;

      popFX(cx, cy, `+${pts}`, judgeLabel('gold'));
      safeDispatch('quest:gold', {});
      safeDispatch('quest:goodHit', { kind:'gold' });
      safeDispatch('quest:power', { power:'gold' });

      killEl(t.el);
      S.targets.delete(t.id);

    } else if (t.kind === 'power'){
      // power doesn't break combo but doesn't add combo
      addFever(6);

      const emo = t.el.textContent;
      if (emo === EMO_MAG) activateMagnet();
      else if (emo === EMO_TIME) addTime();
      else addShield();

      popFX(cx, cy, '', judgeLabel('power'));
      safeDispatch('quest:goodHit', { kind:'power' });

      killEl(t.el);
      S.targets.delete(t.id);

    } else if (t.kind === 'boss'){
      // Boss hit
      setCombo(S.combo + 1);
      addFever(10);

      // decrease boss hp
      S.bossHp = Math.max(0, (S.bossHp|0) - 1);

      const pts = scoreGain(35, S.combo);
      S.score += pts;

      popFX(cx, cy, `+${pts}`, judgeLabel(S.bossPhase===2 ? 'boss2' : 'boss'));
      safeDispatch('quest:goodHit', { kind:'boss' });

      // phase switch
      const half = Math.ceil((S.bossHpMax|0) * 0.5);
      if (S.bossPhase === 1 && (S.bossHp|0) <= (S.bossHpMax - half)){
        bossToPhase2();
      }

      // add decoys pressure in phase 2
      if (S.bossPhase === 2 && now() >= S.bossDecoyCooldownAt){
        S.bossDecoyCooldownAt = now() + 650; // decoys burst
        for (let i=0;i<2;i++) spawnTarget('decoy');
      }

      // update boss emoji “rage” flash
      try{
        t.el.style.transform = `translate(-50%,-50%) scale(${(1.28*D.scale*1.06).toFixed(3)}) rotate(${randi(-8,8)}deg)`;
        setTimeout(()=>{ try{ t.el.style.transform = ''; }catch(_){} }, 90);
      }catch(_){}

      if ((S.bossHp|0) <= 0){
        bossClear();
      }

    } else {
      // junk/fake/decoy
      // Shield behavior:
      // - normal: blocks and NO miss
      // - boss phase 2: "SHIELD BREAK" -> shield to 0 + counts miss (เกมจริงโหด)
      if ((S.shield|0) > 0){
        if (challenge === 'boss' && S.bossPhase === 2){
          // Shield break
          S.shield = 0;
          emitFever();

          S.misses++;
          setCombo(0);

          popFX(cx, cy, '💥', judgeLabel('shieldbreak'));
          safeDispatch('quest:badHit', { kind:'shieldbreak' });
          safeDispatch('quest:stunBreak', {});
          burstFX(cx, cy, 'trap');
        } else {
          // normal block
          S.shield = Math.max(0, (S.shield|0) - 1);
          emitFever();

          popFX(cx, cy, '🛡️', judgeLabel('block'));
          safeDispatch('quest:block', {});
          burstFX(cx, cy, 'power');
        }
      } else {
        S.misses++;
        setCombo(0);
        addFever(-12);

        popFX(cx, cy, '', judgeLabel('miss'));
        safeDispatch('quest:badHit', { kind:t.kind });
        burstFX(cx, cy, 'trap');
      }

      killEl(t.el);
      S.targets.delete(t.id);
    }

    // Fever trigger (Step F fixed)
    if (!S.stunActive && (S.fever|0) >= 100){
      startStun();
    }

    emitScore();
    emitFever();
  }

  function expireTick(){
    const tnow = now();
    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss') continue; // boss won't expire
      if (tnow >= t.expiresAt){
        // expire: if good/gold/power expires -> break combo lightly (but not a miss)
        if (t.kind === 'good' || t.kind === 'gold'){
          setCombo(Math.max(0, (S.combo|0) - 2));
        }
        killEl(t.el);
        S.targets.delete(t.id);
      }
    }
  }

  // STUN field: junk breaks near vortex center
  function stunFieldTick(){
    if (!S.stunActive) return;

    const ap = getAimPoint();
    const R = 140; // px radius
    const R2 = R*R;

    for (const t of Array.from(S.targets.values())){
      if (t.kind !== 'junk' && t.kind !== 'fake' && t.kind !== 'decoy') continue;

      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;

      if (dist2(cx,cy, ap.x,ap.y) <= R2){
        // break it (no miss)
        safeDispatch('quest:stunBreak', {});
        safeDispatch('hha:judge', { label: judgeLabel('break') });
        burstFX(cx,cy,'ice');
        killEl(t.el);
        S.targets.delete(t.id);
      }
    }
  }

  function finalSprintTick(){
    if (!isFinalSprint()) return;

    // Every second pulse
    const sec = S.timeLeft|0;
    if (S.lastFinalPulseSec !== sec){
      S.lastFinalPulseSec = sec;

      // lock each second for 1s (Step F)
      triggerFinalPulse(sec);

      // extra pressure: spawn 1-2 junk in final sprint
      spawnTarget('junk');
      if (sec <= 5) spawnTarget('fake');
    }
  }

  // main loop
  function loop(){
    if (!S.running) return;

    // time update (slow effect)
    const tnow = now();
    const remainMs = Math.max(0, S.endAt - tnow);
    const remainSec = Math.ceil(remainMs / 1000);

    if (remainSec !== (S.timeLeft|0)){
      S.timeLeft = remainSec|0;
      emitTime();
      // final sprint pulses
      finalSprintTick();
    }

    if (remainMs <= 0){
      endGame();
      return;
    }

    // Fever decay (true decay)
    // decay more if not in stun
    if (!S.stunActive){
      const decay = S.feverDecayPerSec / 60;
      S.fever = Math.max(0, (S.fever||0) - decay);
    }

    // STUN duration
    if (S.stunActive && tnow >= S.stunEndsAt){
      stopStun();
    }

    // magnet duration
    if (S.magnetActive && tnow >= S.magnetEndsAt){
      S.magnetActive = false;
    }

    // final lock duration
    if (S.finalLock && tnow >= S.finalLockEndsAt){
      S.finalLock = false;
    }

    // boss spawn
    maybeSpawnBoss();

    // spawning
    const spawnGap = Math.round(D.spawnMs * (S.stunActive ? 1.15 : 1.0));
    if (tnow - S.lastSpawnAt >= spawnGap){
      S.lastSpawnAt = tnow;

      // boss alive: increase pressure, but still spawn goods
      if (S.bossAlive){
        if (S.bossPhase === 2){
          // phase2 = more trash
          const roll = Math.random();
          if (roll < 0.55) spawnTarget('junk');
          else if (roll < 0.70) spawnTarget('fake');
          else if (roll < 0.80) spawnTarget('good');
          else if (roll < 0.88) spawnTarget('gold');
          else spawnTarget('power');
        } else {
          // phase1
          const roll = Math.random();
          if (roll < 0.46) spawnTarget('junk');
          else if (roll < 0.60) spawnTarget('good');
          else if (roll < 0.70) spawnTarget('fake');
          else if (roll < 0.80) spawnTarget('gold');
          else spawnTarget('power');
        }
      } else {
        spawnWave();
      }
    }

    // expire targets
    expireTick();

    // stun field break
    stunFieldTick();

    // emit fever occasionally
    // (cheap, but keeps UI in sync)
    if ((Math.random() < 0.05)) emitFever();

    requestAnimationFrame(loop);
  }

  // initial dispatch
  emitScore();
  emitTime();
  emitFever();

  // kick
  requestAnimationFrame(loop);

  // Public API (optional)
  return {
    stop(){ endGame(); },
    getState(){
      return {
        score:S.score|0, goodHits:S.goodHits|0, misses:S.misses|0,
        comboMax:S.comboMax|0, timeLeft:S.timeLeft|0,
        fever:Math.round(S.fever), stunActive:!!S.stunActive, shield:S.shield|0,
        bossAlive:!!S.bossAlive, bossPhase:S.bossPhase|0, bossHp:S.bossHp|0
      };
    }
  };
}