// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR (PRODUCTION) — Step H
// ✅ H1: Pulse success → HERO BURST 1.5s (attract ONLY good/gold/power)
// ✅ H2: Penalty → Camera Kick + Chromatic Flash (hha:fx)
// ✅ H3: Boss Phase2 → 3 Attack Patterns (Ring / Laser / Storm)

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
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function lerp(a,b,t){ return a + (b-a)*t; }

function getAimPoint(){
  const ap = ROOT.__GJ_AIM_POINT__;
  if (ap && Number.isFinite(ap.x) && Number.isFinite(ap.y)) return { x: ap.x|0, y: ap.y|0 };
  return { x: (innerWidth*0.5)|0, y: (innerHeight*0.62)|0 };
}

const DIFF = {
  easy:   { spawnMs: 880, maxActive: 6,  ttlMs: 2100, scale: 1.08, junkRatio: 0.34, goldRatio: 0.08, powerRatio: 0.09, bossHp: 6 },
  normal: { spawnMs: 760, maxActive: 7,  ttlMs: 1900, scale: 1.00, junkRatio: 0.40, goldRatio: 0.07, powerRatio: 0.08, bossHp: 8 },
  hard:   { spawnMs: 640, maxActive: 8,  ttlMs: 1700, scale: 0.92, junkRatio: 0.46, goldRatio: 0.06, powerRatio: 0.07, bossHp: 10 }
};
function pickDiff(key){
  key = String(key||'normal').toLowerCase();
  return DIFF[key] ? { ...DIFF[key] } : { ...DIFF.normal };
}

const POOL_GOOD = ['🥦','🥕','🍎','🍌','🥬','🍇','🍊','🍉','🥜','🐟','🥛'];
const POOL_JUNK = ['🍟','🍕','🍔','🍩','🍭','🥤','🍰','🍫','🧁'];
const POOL_FAKE = ['😈','🧨','🪤','☠️'];
const EMO_GOLD  = '🟡';
const EMO_MAG   = '🧲';
const EMO_TIME  = '⏳';
const EMO_SHLD  = '🛡️';
const EMO_BOSS1 = '👑';
const EMO_BOSS2 = '👹';

function createEl(layer, x, y, emoji, cls){
  const el = document.createElement('div');
  el.className = `gj-target ${cls||''}`;
  el.textContent = emoji;
  el.style.left = (x|0) + 'px';
  el.style.top  = (y|0) + 'px';
  el.style.setProperty('--tScale', String(1));
  el.style.setProperty('--tRot', (randi(-10,10))+'deg');
  layer.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('spawn'));
  return el;
}
function killEl(el){
  try{
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
  }catch(_){}
}
function burstFX(x,y,mode){
  try{ Particles.burstAt && Particles.burstAt(x, y, mode||'good'); }catch(_){}
}
function scorePop(x,y,txt,label){
  try{ Particles.scorePop && Particles.scorePop(x, y, txt, label||''); }catch(_){}
}

function comboMultiplier(combo){
  const c = Math.max(0, combo|0);
  const m = 1 + Math.min(1.35, c * 0.07);
  return Math.round(m*100)/100;
}
function scoreGain(base, combo){
  const mul = comboMultiplier(combo);
  return Math.round(base * mul);
}

export function boot(opts = {}){
  const diffKey = String(opts.diff || 'normal').toLowerCase();
  const runMode = String(opts.run || 'play').toLowerCase();
  const challenge = String(opts.challenge || 'rush').toLowerCase();
  const durationSec = clamp(opts.time || 60, 20, 180) | 0;

  const D = pickDiff(diffKey);
  const layer = opts.layerEl || document.getElementById('gj-layer');
  if (!layer) throw new Error('[GoodJunk] layerEl missing');

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

    fever: 0,
    feverDecayPerSec: 9.5,
    stunActive: false,
    stunEndsAt: 0,
    slow: 1.0,

    shield: 0,

    magnetActive: false,
    magnetEndsAt: 0,

    // H1 Hero Burst (good-only pull)
    heroBurstActive: false,
    heroBurstEndsAt: 0,

    finalLock: false,
    finalLockEndsAt: 0,
    lastFinalPulseSec: null,

    bossSpawned: false,
    bossAlive: false,
    bossPhase: 1,
    bossHp: 0,
    bossHpMax: 0,
    bossDecoyCooldownAt: 0,

    // Boss Pulse Wave
    pulseActive: false,
    pulseX: 0,
    pulseY: 0,
    pulseDeadlineAt: 0,
    pulseNextAt: 0,
    pulseRadiusPx: 74,

    // H3 Boss attacks
    bossAtkNextAt: 0,
    bossAtkLast: '',

    lastSpawnAt: 0,
    targets: new Map(),
    nextId: 1
  };

  function emitScore(){
    safeDispatch('hha:score', {
      score: S.score|0,
      goodHits: S.goodHits|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      multiplier: comboMultiplier(S.combo|0),

      bossAlive: !!S.bossAlive,
      bossPhase: S.bossPhase|0,
      bossHp: S.bossHp|0,
      bossHpMax: S.bossHpMax|0
    });
  }
  function emitTime(){ safeDispatch('hha:time', { sec: S.timeLeft|0 }); }
  function emitFever(){
    safeDispatch('hha:fever', {
      fever: clamp(S.fever,0,100),
      shield: S.shield|0,
      stunActive: !!S.stunActive,
      slow: Number(S.slow)||1
    });
  }
  function setJudge(label){ safeDispatch('hha:judge', { label: String(label||'') }); }

  function fxKick(intensity=1){
    safeDispatch('hha:fx', { type:'kick', intensity: Number(intensity||1) });
  }
  function fxChroma(ms=180){
    safeDispatch('hha:fx', { type:'chroma', ms: ms|0 });
  }
  function fxHero(ms=220){
    safeDispatch('hha:fx', { type:'hero', ms: ms|0 });
  }

  function setCombo(v){
    S.combo = Math.max(0, v|0);
    if (S.combo > S.comboMax) S.comboMax = S.combo;
  }
  function addFever(delta){ S.fever = clamp((S.fever||0) + (delta||0), 0, 100); }

  function startStun(){
    S.stunActive = true;
    S.slow = 0.62;
    S.stunEndsAt = now() + 6200;
    S.fever = 65;
    setJudge('STUN!');
    emitFever();
    try{ Particles.celebrate && Particles.celebrate({ kind:'STUN', intensity:1.2 }); }catch(_){}
  }
  function stopStun(){
    S.stunActive = false;
    S.slow = 1.0;
    S.fever = Math.min(S.fever, 45);
    emitFever();
  }

  function activateMagnet(){
    S.magnetActive = true;
    S.magnetEndsAt = now() + 5200;
    safeDispatch('quest:power', { power:'magnet' });
    setJudge('MAGNET!');
    burstFX(innerWidth*0.5, innerHeight*0.62, 'power');
  }
  function addTime(){
    S.endAt += 3000;
    safeDispatch('quest:power', { power:'time' });
    setJudge('+TIME!');
    burstFX(innerWidth*0.5, innerHeight*0.62, 'power');
  }
  function addShield(){
    S.shield = clamp((S.shield|0) + 1, 0, 5);
    safeDispatch('quest:power', { power:'shield' });
    setJudge('+SHIELD!');
    emitFever();
  }

  function startHeroBurst(){
    S.heroBurstActive = true;
    S.heroBurstEndsAt = now() + 1500;
    fxHero(240);
    setJudge('HERO BURST!');
    try{ Particles.celebrate && Particles.celebrate({ kind:'HERO', intensity:1.2 }); }catch(_){}
  }

  function isFinalSprint(){ return (S.timeLeft|0) <= 8; }
  function triggerFinalPulse(secLeft){
    if (S.finalLock) return;
    S.finalLock = true;
    S.finalLockEndsAt = now() + 1000;
    safeDispatch('hha:finalPulse', { secLeft: secLeft|0 });
  }

  function endGame(){
    if (!S.running) return;
    S.running = false;

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

  // ------- spawn helpers -------
  function spawnTarget(kind, pos=null){
    if (!S.running) return null;
    if (S.targets.size >= D.maxActive && kind !== 'boss') return null;

    const margin = 28;
    const topSafe = 110;
    const botSafe = 165;

    const x = pos ? (pos.x|0) : randi(margin, Math.max(margin+10, innerWidth - margin));
    const y = pos ? (pos.y|0) : randi(topSafe, Math.max(topSafe+10, innerHeight - botSafe));

    let emoji = '❓', cls = '', ttl = D.ttlMs;

    if (kind === 'good'){
      emoji = POOL_GOOD[randi(0, POOL_GOOD.length-1)];
    } else if (kind === 'junk'){
      emoji = POOL_JUNK[randi(0, POOL_JUNK.length-1)];
      cls = 'gj-junk';
    } else if (kind === 'fake'){
      emoji = POOL_FAKE[randi(0, POOL_FAKE.length-1)];
      cls = 'gj-fake';
      ttl = Math.round(ttl * 0.92);
    } else if (kind === 'gold'){
      emoji = EMO_GOLD;
      cls = 'gj-gold';
      ttl = Math.round(ttl * 0.95);
    } else if (kind === 'power'){
      const p = randi(1,3);
      emoji = (p===1) ? EMO_MAG : (p===2) ? EMO_TIME : EMO_SHLD;
      cls = 'gj-power';
      ttl = Math.round(ttl * 0.92);
    } else if (kind === 'boss'){
      emoji = (S.bossPhase === 2) ? EMO_BOSS2 : EMO_BOSS1;
      cls = 'gj-boss';
      ttl = 999999;
    } else if (kind === 'decoy'){
      emoji = POOL_JUNK[randi(0, POOL_JUNK.length-1)];
      cls = 'gj-junk';
      ttl = Math.round(ttl * 0.72);
    } else if (kind === 'laser'){
      emoji = '⚡';
      cls = 'gj-fake';
      ttl = Math.round(ttl * 0.62);
    }

    const el = createEl(layer, x, y, emoji, cls);

    const sc = (kind === 'boss')
      ? (1.28 * D.scale)
      : (0.98 + Math.random()*0.22) * D.scale;
    el.style.setProperty('--tScale', String(sc.toFixed(3)));

    const id = S.nextId++;
    const t = {
      id, kind, el,
      x, y,
      bornAt: now(),
      expiresAt: now() + ttl
    };
    S.targets.set(id, t);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.(); ev.stopPropagation?.();
      onHit(t, ev);
    }, { passive:false });

    return t;
  }

  function spawnWave(){
    const p = Math.random();
    const pGold = D.goldRatio;
    const pPower= D.powerRatio;
    const pFake = 0.12;
    const pJunk = D.junkRatio + (challenge==='survival' ? 0.06 : 0);

    if (challenge === 'boss'){
      if (p < pGold) return spawnTarget('gold');
      if (p < pGold + pPower) return spawnTarget('power');
      if (p < pGold + pPower + pFake) return spawnTarget('fake');
      if (p < pGold + pPower + pFake + (pJunk+0.08)) return spawnTarget('junk');
      return spawnTarget('good');
    }

    if (p < pGold) return spawnTarget('gold');
    if (p < pGold + pPower) return spawnTarget('power');
    if (p < pGold + pPower + pFake) return spawnTarget('fake');
    if (p < pGold + pPower + pFake + pJunk) return spawnTarget('junk');
    return spawnTarget('good');
  }

  // ------- boss -------
  function maybeSpawnBoss(){
    if (challenge !== 'boss') return;
    if (S.bossSpawned) return;
    if ((S.timeLeft|0) > 22) return;

    S.bossSpawned = true;
    S.bossAlive = true;
    S.bossPhase = 1;
    S.bossHpMax = D.bossHp|0;
    S.bossHp = S.bossHpMax;

    spawnTarget('boss');

    try{ Particles.celebrate && Particles.celebrate({ kind:'BOSS_SPAWN', intensity:1.4 }); }catch(_){}
    setJudge('BOSS!');
    emitScore();
  }

  function bossToPhase2(){
    if (!S.bossAlive || S.bossPhase >= 2) return;
    S.bossPhase = 2;
    setJudge('PHASE 2!');
    try{ Particles.celebrate && Particles.celebrate({ kind:'BOSS_PHASE2', intensity:1.6 }); }catch(_){}
    S.pulseNextAt = now() + 900;

    // Attack schedule
    S.bossAtkNextAt = now() + 950;
    S.bossAtkLast = '';
    emitScore();
  }

  function bossClear(){
    if (!S.bossAlive) return;
    S.bossAlive = false;

    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss'){ killEl(t.el); S.targets.delete(t.id); }
    }

    try{ Particles.celebrate && Particles.celebrate({ kind:'BOSS_CLEAR', intensity:2.0 }); }catch(_){}
    safeDispatch('quest:bossClear', {});
    setJudge('BOSS CLEARED!');
    emitScore();
  }

  // ------- boss pulse (move center) -------
  function pickPulsePoint(){
    const pad = 70;
    const top = 150;
    const bottom = innerHeight - 190;
    const cur = getAimPoint();

    for (let i=0;i<30;i++){
      const x = randi(pad, Math.max(pad+10, innerWidth-pad));
      const y = randi(top, Math.max(top+10, bottom));
      if (dist2(x,y, cur.x,cur.y) >= (260*260)) return { x, y };
    }
    return { x: (innerWidth*0.5)|0, y: (innerHeight*0.62)|0 };
  }

  function startBossPulse(){
    const p = pickPulsePoint();
    S.pulseActive = true;
    S.pulseX = p.x|0;
    S.pulseY = p.y|0;
    S.pulseDeadlineAt = now() + 1200;
    safeDispatch('hha:bossPulse', { x:S.pulseX, y:S.pulseY, ttlMs:1200 });
  }

  function resolveBossPulse(){
    if (!S.pulseActive) return;

    const ap = getAimPoint();
    const ok = dist2(ap.x, ap.y, S.pulseX, S.pulseY) <= (S.pulseRadiusPx * S.pulseRadiusPx);

    if (ok){
      // ✅ H1: Success -> hero burst 1.5s (good-only pull)
      setJudge('PULSE OK!');
      const pts = 35;
      S.score += pts;
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(8);
      scorePop(S.pulseX, S.pulseY, `+${pts}`, 'PULSE!');
      burstFX(S.pulseX, S.pulseY, 'gold');
      safeDispatch('quest:goodHit', { kind:'pulse' });

      startHeroBurst();

    } else {
      // ✅ H2: Fail -> kick + chroma + punish
      setJudge('PULSE HIT!');
      burstFX(S.pulseX, S.pulseY, 'trap');
      fxChroma(180);
      fxKick(1.25);

      if ((S.shield|0) > 0){
        S.shield = 0;
        safeDispatch('quest:badHit', { kind:'pulseShieldBreak' });
      } else {
        S.misses++;
        setCombo(0);
        safeDispatch('quest:badHit', { kind:'pulse' });
      }
      addFever(-16);
    }

    S.pulseActive = false;
    emitScore();
    emitFever();
  }

  // ------- H3: Boss attack patterns (phase2) -------
  function bossAttackPattern(){
    // pick 1 of 3 patterns, avoid immediate repeat
    const patterns = ['ring','laser','storm'];
    let pick = patterns[randi(0, patterns.length-1)];
    if (pick === S.bossAtkLast) pick = patterns[(patterns.indexOf(pick)+1) % patterns.length];
    S.bossAtkLast = pick;

    const ap = getAimPoint();
    const center = { x: ap.x|0, y: ap.y|0 };

    if (pick === 'ring'){
      setJudge('BOSS: RING!');
      fxChroma(140);
      // spawn junk ring around aimpoint
      const n = 7;
      const R = 180;
      for (let i=0;i<n;i++){
        const ang = (Math.PI*2) * (i/n) + (Math.random()*0.22);
        const x = clamp(center.x + Math.cos(ang)*R, 40, innerWidth-40);
        const y = clamp(center.y + Math.sin(ang)*R, 150, innerHeight-190);
        spawnTarget('junk', { x, y });
      }
      // one good bait
      spawnTarget('good', { x: clamp(center.x, 40, innerWidth-40), y: clamp(center.y-60, 150, innerHeight-190) });

    } else if (pick === 'laser'){
      setJudge('BOSS: LASER!');
      fxChroma(160);
      fxKick(0.7);
      // laser sweep line: spawn several ⚡ in a line (as fake)
      const y = clamp(center.y + randi(-80,80), 150, innerHeight-190);
      const steps = 6;
      for (let i=0;i<steps;i++){
        const x = lerp(60, innerWidth-60, i/(steps-1));
        spawnTarget('laser', { x, y });
      }

    } else { // storm
      setJudge('BOSS: STORM!');
      fxChroma(150);
      // decoy storm + gold target
      for (let i=0;i<6;i++){
        spawnTarget('decoy');
      }
      spawnTarget('gold', { x: clamp(center.x + randi(-120,120), 50, innerWidth-50), y: clamp(center.y + randi(-90,90), 150, innerHeight-190) });
    }
  }

  // ------- hits -------
  function onHit(t){
    if (!S.running) return;

    if (S.finalLock){
      setJudge('LOCK!');
      return;
    }

    const rect = t.el.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    const isBad = (t.kind === 'junk' || t.kind === 'fake' || t.kind === 'decoy' || t.kind === 'laser');

    if (t.kind === 'good'){
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(8);

      const pts = scoreGain(20, S.combo);
      S.score += pts;

      scorePop(cx, cy, `+${pts}`, (S.combo>=10 ? 'PERFECT!' : 'GOOD!'));
      burstFX(cx, cy, 'good');
      safeDispatch('quest:goodHit', { kind:'good' });

      killEl(t.el); S.targets.delete(t.id);

    } else if (t.kind === 'gold'){
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(12);

      const pts = scoreGain(90, S.combo);
      S.score += pts;

      scorePop(cx, cy, `+${pts}`, 'GOLD!');
      burstFX(cx, cy, 'gold');
      safeDispatch('quest:power', { power:'gold' });
      safeDispatch('quest:goodHit', { kind:'gold' });

      killEl(t.el); S.targets.delete(t.id);

    } else if (t.kind === 'power'){
      addFever(6);
      const emo = t.el.textContent;
      if (emo === EMO_MAG) activateMagnet();
      else if (emo === EMO_TIME) addTime();
      else addShield();

      scorePop(cx, cy, '', 'POWER!');
      burstFX(cx, cy, 'power');
      safeDispatch('quest:goodHit', { kind:'power' });

      killEl(t.el); S.targets.delete(t.id);

    } else if (t.kind === 'boss'){
      setCombo(S.combo + 1);
      addFever(10);

      S.bossHp = Math.max(0, (S.bossHp|0) - 1);

      const pts = scoreGain(35, S.combo);
      S.score += pts;

      scorePop(cx, cy, `+${pts}`, (S.bossPhase===2 ? 'PHASE 2!' : 'BOSS HIT!'));
      burstFX(cx, cy, 'gold');
      safeDispatch('quest:goodHit', { kind:'boss' });

      const half = Math.ceil((S.bossHpMax|0) * 0.5);
      if (S.bossPhase === 1 && (S.bossHp|0) <= (S.bossHpMax - half)){
        bossToPhase2();
      }
      if (S.bossPhase === 2 && now() >= S.bossDecoyCooldownAt){
        S.bossDecoyCooldownAt = now() + 650;
        for (let i=0;i<2;i++) spawnTarget('decoy');
      }

      if ((S.bossHp|0) <= 0) bossClear();
      emitScore();

    } else if (isBad){
      // ✅ penalty feel (H2)
      if ((S.shield|0) > 0){
        if (challenge === 'boss' && S.bossPhase === 2){
          S.shield = 0;
          S.misses++;
          setCombo(0);
          scorePop(cx, cy, '💥', 'SHIELD BREAK!');
          burstFX(cx, cy, 'trap');
          safeDispatch('quest:badHit', { kind:'shieldbreak' });
          fxKick(1.0);
          fxChroma(160);
        } else {
          S.shield = Math.max(0, (S.shield|0) - 1);
          scorePop(cx, cy, '🛡️', 'BLOCK!');
          burstFX(cx, cy, 'power');
          safeDispatch('quest:block', {});
          fxKick(0.65);
        }
      } else {
        S.misses++;
        setCombo(0);
        addFever(-12);
        scorePop(cx, cy, '', 'MISS!');
        burstFX(cx, cy, 'trap');
        safeDispatch('quest:badHit', { kind:t.kind });
        fxKick(1.15);
        fxChroma(170);
      }

      killEl(t.el); S.targets.delete(t.id);
    }

    // fever -> stun
    if (!S.stunActive && (S.fever|0) >= 100){
      startStun();
    }

    emitScore();
    emitFever();
  }

  // expire
  function expireTick(){
    const tnow = now();
    for (const t of Array.from(S.targets.values())){
      if (t.kind === 'boss') continue;
      if (tnow >= t.expiresAt){
        if (t.kind === 'good' || t.kind === 'gold'){
          setCombo(Math.max(0, (S.combo|0) - 2));
        }
        killEl(t.el);
        S.targets.delete(t.id);
      }
    }
  }

  // STUN field
  function stunFieldTick(){
    if (!S.stunActive) return;
    const ap = getAimPoint();
    const R = 140, R2 = R*R;

    for (const t of Array.from(S.targets.values())){
      if (t.kind !== 'junk' && t.kind !== 'fake' && t.kind !== 'decoy' && t.kind !== 'laser') continue;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      if (dist2(cx,cy, ap.x,ap.y) <= R2){
        setJudge('STUN BREAK!');
        burstFX(cx,cy,'ice');
        safeDispatch('quest:stunBreak', {});
        killEl(t.el);
        S.targets.delete(t.id);
      }
    }
  }

  // H1 hero burst pull: ONLY good/gold/power
  function heroBurstTick(){
    if (!S.heroBurstActive) return;
    const tnow = now();
    if (tnow >= S.heroBurstEndsAt){
      S.heroBurstActive = false;
      return;
    }

    const ap = getAimPoint();
    const strength = 0.18; // pull speed
    const swirl = 0.08;

    for (const t of S.targets.values()){
      if (t.kind !== 'good' && t.kind !== 'gold' && t.kind !== 'power') continue;

      const dx = ap.x - t.x;
      const dy = ap.y - t.y;

      // pull
      t.x = lerp(t.x, ap.x, strength);
      t.y = lerp(t.y, ap.y, strength);

      // small swirl
      t.x += (-dy) * swirl * 0.002;
      t.y += ( dx) * swirl * 0.002;

      t.el.style.left = (t.x|0) + 'px';
      t.el.style.top  = (t.y|0) + 'px';
      t.el.style.setProperty('--tRot', (randi(-6,6))+'deg');
    }
  }

  // final sprint
  function finalSprintTick(){
    if ((S.timeLeft|0) > 8) return;
    const sec = S.timeLeft|0;
    if (S.lastFinalPulseSec !== sec){
      S.lastFinalPulseSec = sec;
      triggerFinalPulse(sec);
      spawnTarget('junk');
      if (sec <= 5) spawnTarget('fake');
    }
  }

  // loop
  function loop(){
    if (!S.running) return;

    const tnow = now();
    const remainMs = Math.max(0, S.endAt - tnow);
    const remainSec = Math.ceil(remainMs / 1000);

    if (remainSec !== (S.timeLeft|0)){
      S.timeLeft = remainSec|0;
      emitTime();
      finalSprintTick();
    }
    if (remainMs <= 0){
      endGame();
      return;
    }

    // fever decay
    if (!S.stunActive){
      const decay = S.feverDecayPerSec / 60;
      S.fever = Math.max(0, (S.fever||0) - decay);
    }

    // stun duration
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

    // Boss Pulse Wave (phase2)
    if (S.bossAlive && S.bossPhase === 2){
      if (!S.pulseActive && tnow >= (S.pulseNextAt||0)){
        startBossPulse();
        S.pulseNextAt = tnow + 2150;
      }
      if (S.pulseActive && tnow >= S.pulseDeadlineAt){
        resolveBossPulse();
      }

      // ✅ H3 attacks
      if (tnow >= (S.bossAtkNextAt||0)){
        bossAttackPattern();
        S.bossAtkNextAt = tnow + 3200; // cadence
      }
    }

    // spawn cadence
    const spawnGap = Math.round(D.spawnMs * (S.stunActive ? 1.15 : 1.0));
    if (tnow - S.lastSpawnAt >= spawnGap){
      S.lastSpawnAt = tnow;

      if (S.bossAlive){
        if (S.bossPhase === 2){
          const roll = Math.random();
          if (roll < 0.58) spawnTarget('junk');
          else if (roll < 0.72) spawnTarget('fake');
          else if (roll < 0.84) spawnTarget('good');
          else if (roll < 0.92) spawnTarget('gold');
          else spawnTarget('power');
        } else {
          const roll = Math.random();
          if (roll < 0.48) spawnTarget('junk');
          else if (roll < 0.63) spawnTarget('good');
          else if (roll < 0.76) spawnTarget('fake');
          else if (roll < 0.86) spawnTarget('gold');
          else spawnTarget('power');
        }
      } else {
        spawnWave();
      }
    }

    heroBurstTick();
    expireTick();
    stunFieldTick();

    if ((Math.random() < 0.06)) emitFever();
    requestAnimationFrame(loop);
  }

  // init
  emitScore();
  emitTime();
  emitFever();
  requestAnimationFrame(loop);

  return {
    stop(){ endGame(); },
    getState(){
      return {
        score:S.score|0, goodHits:S.goodHits|0, misses:S.misses|0,
        comboMax:S.comboMax|0, timeLeft:S.timeLeft|0,
        fever:Math.round(S.fever), stunActive:!!S.stunActive, shield:S.shield|0,
        bossAlive:!!S.bossAlive, bossPhase:S.bossPhase|0, bossHp:S.bossHp|0, bossHpMax:S.bossHpMax|0,
        pulseActive:!!S.pulseActive, heroBurstActive:!!S.heroBurstActive
      };
    }
  };
}