// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR (PRODUCTION) — H+ (EXTREME PACK)
// ✅ H+1 LASER: must dodge (aim point in beam at fire time => penalty)
// ✅ H+2 RING: single safe gap (aim in danger ring => penalty)
// ✅ H+3 STORM: fake good target (looks good but counts bad)
// ✅ EXTREME: storm speeds up spawn cadence + ring/laser tick + panic events
// ✅ MAGNET: actually pulls targets (real effect)
// ✅ Aim point supports DOM camera drag-look via window.__GJ_AIM_POINT__

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

  // Attack overlays
  const elRing  = document.getElementById('atk-ring');
  const elLaser = document.getElementById('atk-laser');

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

    // HERO BURST (from pulse success)
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

    // Boss Pulse Wave (move center)
    pulseActive: false,
    pulseX: 0,
    pulseY: 0,
    pulseDeadlineAt: 0,
    pulseNextAt: 0,
    pulseRadiusPx: 74,

    // Boss attacks (H+)
    bossAtkNextAt: 0,
    bossAtkLast: '',

    ringActive: false,
    ringX: 0, ringY: 0,
    ringR: 210,
    ringTh: 34,
    ringGapA: 0,
    ringGapW: 0,
    ringEndsAt: 0,

    laserActive: false,
    laserY: 0,
    laserWarnEndsAt: 0,
    laserFireAt: 0,
    laserEndsAt: 0,

    hazardLockUntil: 0,

    lastSpawnAt: 0,
    targets: new Map(),
    nextId: 1,

    // ===== EXTREME PACK =====
    stormActive: false,
    stormEndsAt: 0,
    stormMul: 1.0,

    panicLevel: 0,          // 0-1
    panicEndsAt: 0,

    ringTickNextAt: 0,
    ringTickRateMs: 0,
    laserTickNextAt: 0,
    laserTickRateMs: 0,
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

  function fxKick(intensity=1){ safeDispatch('hha:fx', { type:'kick', intensity: Number(intensity||1) }); }
  function fxChroma(ms=180){ safeDispatch('hha:fx', { type:'chroma', ms: ms|0 }); }
  function fxHero(ms=220){ safeDispatch('hha:fx', { type:'hero', ms: ms|0 }); }

  // ===== EXTREME helpers =====
  function setStorm(ms = 1600, mul = 0.62){
    S.stormActive = true;
    S.stormEndsAt = now() + Math.max(400, ms|0);
    S.stormMul = clamp(Number(mul)||0.62, 0.40, 1.0);
    safeDispatch('hha:storm', { active:true, ms: ms|0, mul: S.stormMul });
  }
  function clearStorm(){
    if (!S.stormActive) return;
    S.stormActive = false;
    S.stormMul = 1.0;
    safeDispatch('hha:storm', { active:false });
  }
  function setPanic(level = 0.6, ms = 900){
    const t = now();
    const L = clamp(level, 0, 1);
    S.panicLevel = Math.max(S.panicLevel||0, L);
    S.panicEndsAt = Math.max(S.panicEndsAt||0, t + Math.max(200, ms|0));
    safeDispatch('hha:panic', { level: S.panicLevel, ms: ms|0 });
  }
  function tick(kind='tick', intensity=1){
    safeDispatch('hha:tick', { kind, intensity: clamp(intensity, 0.2, 3) });
  }

  function setCombo(v){
    S.combo = Math.max(0, v|0);
    if (S.combo > S.comboMax) S.comboMax = S.combo;
  }
  function addFever(delta){ S.fever = clamp((S.fever||0) + (delta||0), 0, 100); }

  function applyPenalty(kind='hazard'){
    const tnow = now();
    if (tnow < (S.hazardLockUntil||0)) return;
    S.hazardLockUntil = tnow + 420;

    fxChroma(170);
    fxKick(1.25);
    setPanic(0.75, 650);

    if ((S.shield|0) > 0){
      // H+ โหด: hazard ทำให้แตกโล่หมดทันที
      S.shield = 0;
      safeDispatch('quest:badHit', { kind: kind + ':shieldbreak' });
      setJudge('SHIELD BREAK!');
      burstFX(innerWidth*0.5, innerHeight*0.62, 'trap');
      addFever(-14);
    } else {
      S.misses++;
      setCombo(0);
      safeDispatch('quest:badHit', { kind });
      setJudge('HIT!');
      burstFX(innerWidth*0.5, innerHeight*0.62, 'trap');
      addFever(-18);
    }
    emitScore();
    emitFever();
  }

  function startStun(){
    S.stunActive = true;
    S.slow = 0.62;
    S.stunEndsAt = now() + 6200;
    S.fever = 65;
    setJudge('STUN!');
    setPanic(0.85, 900);
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
    setPanic(0.55, 520);
    try{ Particles.celebrate && Particles.celebrate({ kind:'HERO', intensity:1.2 }); }catch(_){}
  }

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

    // cleanup overlays
    try{ if (elRing) elRing.classList.remove('show'); }catch(_){}
    try{ if (elLaser) elLaser.classList.remove('warn','fire'); }catch(_){}

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
    } else if (kind === 'goodfake'){
      // ✅ H+3 fake good: looks good but is bad
      emoji = POOL_GOOD[randi(0, POOL_GOOD.length-1)];
      cls = 'gj-fake';
      ttl = Math.round(ttl * 0.86);
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
      onHit(t);
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
    setPanic(0.65, 650);
    emitScore();
  }

  function bossToPhase2(){
    if (!S.bossAlive || S.bossPhase >= 2) return;
    S.bossPhase = 2;
    setJudge('PHASE 2!');
    setPanic(0.85, 900);
    try{ Particles.celebrate && Particles.celebrate({ kind:'BOSS_PHASE2', intensity:1.6 }); }catch(_){}
    S.pulseNextAt = now() + 900;

    // Attack schedule
    S.bossAtkNextAt = now() + 900;
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
    setPanic(0.2, 220);
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
      setJudge('PULSE OK!');
      const pts = 35;
      S.score += pts;
      S.goodHits++;
      setCombo(S.combo + 1);
      addFever(8);
      scorePop(S.pulseX, S.pulseY, `+${pts}`, 'PULSE!');
      burstFX(S.pulseX, S.pulseY, 'gold');
      safeDispatch('quest:goodHit', { kind:'pulse' });

      // hero burst
      startHeroBurst();

    } else {
      setJudge('PULSE HIT!');
      burstFX(S.pulseX, S.pulseY, 'trap');
      applyPenalty('pulse');
    }

    S.pulseActive = false;
    emitScore();
    emitFever();
  }

  // ===== H+ ATTACK OVERLAYS =====
  function showRingAt(x,y,gapStartDeg,gapSizeDeg,ms=1200){
    if (!elRing) return;
    elRing.style.left = (x|0)+'px';
    elRing.style.top  = (y|0)+'px';
    elRing.style.transform = 'translate(-50%,-50%)';
    document.documentElement.style.setProperty('--ringGapStart', gapStartDeg.toFixed(0)+'deg');
    document.documentElement.style.setProperty('--ringGapSize',  gapSizeDeg.toFixed(0)+'deg');
    elRing.classList.add('show');
    setTimeout(()=>{ try{ elRing.classList.remove('show'); }catch(_){ } }, Math.max(300, ms|0));
  }
  function laserWarnAt(y, warnMs=420, fireMs=260){
    if (!elLaser) return;
    elLaser.style.top = (y|0)+'px';
    elLaser.classList.remove('fire');
    elLaser.classList.add('warn');
    setTimeout(()=>{
      try{
        elLaser.classList.remove('warn');
        elLaser.classList.add('fire');
        setTimeout(()=>{ try{ elLaser.classList.remove('fire'); }catch(_){ } }, Math.max(120, fireMs|0));
      }catch(_){}
    }, Math.max(120, warnMs|0));
  }

  // ------- H+ Boss attack patterns (phase2) -------
  function bossAttackPattern(){
    const patterns = ['ring','laser','storm'];
    let pick = patterns[randi(0, patterns.length-1)];
    if (pick === S.bossAtkLast) pick = patterns[(patterns.indexOf(pick)+1) % patterns.length];
    S.bossAtkLast = pick;

    const ap = getAimPoint();
    const center = { x: ap.x|0, y: ap.y|0 };

    // send timing details for SFX/FX in HTML
    const detail = { name: pick };
    if (pick === 'ring')  detail.ttlMs = (diffKey==='hard' ? 1200 : 1350);
    if (pick === 'laser'){ detail.warnMs = 420; detail.fireMs = 260; }
    if (pick === 'storm') detail.ttlMs = (diffKey==='hard' ? 1900 : 1600);
    safeDispatch('hha:bossAtk', detail);

    if (pick === 'ring'){
      // ✅ H+2: single safe gap
      setJudge('BOSS: RING!');
      fxChroma(140);
      setPanic(diffKey==='hard' ? 0.75 : 0.55, 900);

      // ring state
      S.ringActive = true;
      S.ringX = center.x|0;
      S.ringY = center.y|0;
      S.ringR = Math.round(210 + (diffKey==='hard'? 28 : diffKey==='easy'? -10 : 0));
      S.ringTh= Math.round(34 + (diffKey==='hard'? 8 : 0));
      S.ringGapW = (Math.PI / (diffKey==='hard'? 4.2 : 3.2)); // ~43° hard, ~56° normal
      S.ringGapA = (Math.random()*Math.PI*2);

      S.ringEndsAt = now() + (diffKey==='hard' ? 1200 : 1350);

      // EXTREME: ring ticking countdown
      S.ringTickRateMs = (diffKey==='hard' ? 90 : 115);
      S.ringTickNextAt = now() + 60;

      // visual (deg)
      const gapSizeDeg = (S.ringGapW * 180/Math.PI);
      const gapStartDeg = (S.ringGapA * 180/Math.PI);
      showRingAt(S.ringX, S.ringY, gapStartDeg, gapSizeDeg, (S.ringEndsAt-now())|0);

      // spawn junk ring w/ 1 gap (visual targets)
      const n = 8;
      const gapIndex = randi(0, n-1);
      for (let i=0;i<n;i++){
        if (i === gapIndex) continue; // one safe gap
        const ang = (Math.PI*2) * (i/n);
        const x = clamp(center.x + Math.cos(ang)*S.ringR, 40, innerWidth-40);
        const y = clamp(center.y + Math.sin(ang)*S.ringR, 150, innerHeight-190);
        spawnTarget('junk', { x, y });
      }

    } else if (pick === 'laser'){
      // ✅ H+1: must dodge - hazard checks aim at fire time
      setJudge('BOSS: LASER!');
      fxChroma(160);
      setPanic(diffKey==='hard' ? 0.95 : 0.75, 950);

      const y = clamp(center.y + randi(-90,90), 150, innerHeight-190);
      S.laserActive = true;
      S.laserY = y|0;
      S.laserWarnEndsAt = now() + 420;
      S.laserFireAt = now() + 420;
      S.laserEndsAt = S.laserFireAt + 260;

      // EXTREME: laser ticking
      S.laserTickRateMs = (diffKey==='hard' ? 70 : 90);
      S.laserTickNextAt = now() + 40;

      laserWarnAt(S.laserY, 420, 260);

      // tiny decoy pressure
      for (let i=0;i<3;i++) spawnTarget('decoy');

    } else { // storm
      // ✅ H+3: fake good among storm
      setJudge('BOSS: STORM!');
      fxChroma(150);

      // EXTREME: storm speeds up spawns for a short burst
      setStorm(diffKey==='hard' ? 1900 : 1600, diffKey==='hard' ? 0.52 : 0.62);
      setPanic(diffKey==='hard' ? 0.85 : 0.65, 1000);

      for (let i=0;i<5;i++) spawnTarget('decoy');

      // one gold reward, one real good, one fake good
      spawnTarget('gold', { x: clamp(center.x + randi(-120,120), 50, innerWidth-50), y: clamp(center.y + randi(-90,90), 150, innerHeight-190) });
      spawnTarget('good', { x: clamp(center.x + randi(-140,140), 50, innerWidth-50), y: clamp(center.y + randi(-90,90), 150, innerHeight-190) });
      spawnTarget('goodfake', { x: clamp(center.x + randi(-140,140), 50, innerWidth-50), y: clamp(center.y + randi(-90,90), 150, innerHeight-190) });
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

    const isBad =
      (t.kind === 'junk' || t.kind === 'fake' || t.kind === 'decoy' || t.kind === 'goodfake');

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
      // penalty
      if ((S.shield|0) > 0){
        // boss phase2: break shield fully if hit bad
        if (challenge === 'boss' && S.bossPhase === 2){
          S.shield = 0;
          S.misses++;
          setCombo(0);
          scorePop(cx, cy, '💥', 'SHIELD BREAK!');
          burstFX(cx, cy, 'trap');
          safeDispatch('quest:badHit', { kind:'shieldbreak' });
          fxKick(1.1); fxChroma(170);
          setPanic(0.95, 800);
        } else {
          S.shield = Math.max(0, (S.shield|0) - 1);
          scorePop(cx, cy, '🛡️', 'BLOCK!');
          burstFX(cx, cy, 'power');
          safeDispatch('quest:block', {});
          fxKick(0.65);
          setPanic(0.35, 420);
        }
      } else {
        S.misses++;
        setCombo(0);
        addFever(-12);
        scorePop(cx, cy, '', 'MISS!');
        burstFX(cx, cy, 'trap');
        safeDispatch('quest:badHit', { kind:t.kind });
        fxKick(1.15); fxChroma(170);
        setPanic(0.85, 850);
      }

      killEl(t.el); S.targets.delete(t.id);
    }

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

  // STUN field: junk breaks itself near aim center
  function stunFieldTick(){
    if (!S.stunActive) return;
    const ap = getAimPoint();
    const R = 140, R2 = R*R;

    for (const t of Array.from(S.targets.values())){
      if (t.kind !== 'junk' && t.kind !== 'fake' && t.kind !== 'decoy' && t.kind !== 'goodfake') continue;
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

  // HERO BURST pull: ONLY good/gold/power
  function heroBurstTick(){
    if (!S.heroBurstActive) return;
    const tnow = now();
    if (tnow >= S.heroBurstEndsAt){
      S.heroBurstActive = false;
      return;
    }
    const ap = getAimPoint();
    const strength = 0.18;
    const swirl = 0.08;

    for (const t of S.targets.values()){
      if (t.kind !== 'good' && t.kind !== 'gold' && t.kind !== 'power') continue;

      const dx = ap.x - t.x;
      const dy = ap.y - t.y;

      t.x = lerp(t.x, ap.x, strength);
      t.y = lerp(t.y, ap.y, strength);

      t.x += (-dy) * swirl * 0.002;
      t.y += ( dx) * swirl * 0.002;

      t.el.style.left = (t.x|0) + 'px';
      t.el.style.top  = (t.y|0) + 'px';
      t.el.style.setProperty('--tRot', (randi(-6,6))+'deg');
    }
  }

  // MAGNET pull: ONLY good/gold/power (gentle but real)
  function magnetTick(){
    if (!S.magnetActive) return;
    const tnow = now();
    if (tnow >= S.magnetEndsAt){
      S.magnetActive = false;
      return;
    }

    const ap = getAimPoint();
    const strength = (diffKey==='hard' ? 0.11 : diffKey==='easy' ? 0.08 : 0.095);
    const swirl = 0.035;

    for (const t of S.targets.values()){
      if (t.kind !== 'good' && t.kind !== 'gold' && t.kind !== 'power') continue;

      const dx = ap.x - t.x;
      const dy = ap.y - t.y;

      // pull
      t.x = lerp(t.x, ap.x, strength);
      t.y = lerp(t.y, ap.y, strength);

      // tiny swirl (feel “ดูด”)
      t.x += (-dy) * swirl * 0.002;
      t.y += ( dx) * swirl * 0.002;

      t.el.style.left = (t.x|0) + 'px';
      t.el.style.top  = (t.y|0) + 'px';
      t.el.style.setProperty('--tRot', (randi(-7,7))+'deg');
    }
  }

  // H+ hazards tick (ring + laser)
  function hazardsTick(){
    const tnow = now();
    const ap = getAimPoint();

    // RING: aim must be in the safe gap (otherwise hit)
    if (S.ringActive){
      if (tnow >= S.ringEndsAt){
        S.ringActive = false;
      } else {
        const dx = ap.x - S.ringX;
        const dy = ap.y - S.ringY;
        const d = Math.sqrt(dx*dx + dy*dy);

        // only punish if aim is inside the ring band (danger donut)
        const inBand = (d >= (S.ringR - S.ringTh)) && (d <= (S.ringR + S.ringTh));
        if (inBand){
          // compute angle [0,2pi)
          let a = Math.atan2(dy, dx);
          if (a < 0) a += Math.PI*2;

          // safe gap centered at ringGapA, width ringGapW
          const ga = S.ringGapA;
          const gw = S.ringGapW;
          const diff = Math.atan2(Math.sin(a-ga), Math.cos(a-ga)); // shortest signed
          const inGap = Math.abs(diff) <= (gw*0.5);

          if (!inGap){
            applyPenalty('ring');
          }
        }
      }
    }

    // LASER: at fire time, if aim y close to beam => hit
    if (S.laserActive){
      if (tnow >= S.laserEndsAt){
        S.laserActive = false;
        try{ if (elLaser) elLaser.classList.remove('warn','fire'); }catch(_){}
      } else if (tnow >= S.laserFireAt && tnow <= S.laserEndsAt){
        const tol = (diffKey==='hard') ? 26 : 30; // harder: smaller safe area
        if (Math.abs((ap.y|0) - (S.laserY|0)) <= tol){
          applyPenalty('laser');
        }
      }
    }

    // ===== EXTREME: countdown ticks =====
    // ring tick while active
    if (S.ringActive){
      if (tnow >= (S.ringTickNextAt||0)){
        const left = (S.ringEndsAt||0) - tnow;
        const fast = (left < 420);
        tick('ring', fast ? 1.6 : 1.0);
        if (fast) setPanic(0.9, 250);
        S.ringTickNextAt = tnow + Math.max(45, (S.ringTickRateMs||110) - (fast ? 20 : 0));
      }
      // near end: micro-kick
      if (((S.ringEndsAt||0) - tnow) < 260) safeDispatch('hha:fx', { type:'kick', intensity: 0.85 });
    }

    // laser tick during warn window
    if (S.laserActive && tnow < (S.laserFireAt||0)){
      if (tnow >= (S.laserTickNextAt||0)){
        const left = (S.laserFireAt||0) - tnow;
        const fast = (left < 220);
        tick('laser-warn', fast ? 2.0 : 1.2);
        if (fast) setPanic(1.0, 220);
        S.laserTickNextAt = tnow + Math.max(40, (S.laserTickRateMs||90) - (fast ? 20 : 0));
      }
    }

    // laser fire moment: big kick once
    if (S.laserActive && tnow >= (S.laserFireAt||0) && tnow <= (S.laserFireAt||0) + 80){
      safeDispatch('hha:fx', { type:'kick', intensity: 1.55 });
      safeDispatch('hha:fx', { type:'chroma', ms: 150 });
    }
  }

  // final sprint
  function finalSprintTick(){
    if ((S.timeLeft|0) > 8) return;

    // EXTREME: escalating panic edge at final seconds
    if ((S.timeLeft|0) <= 8){
      const lv = clamp((8 - (S.timeLeft|0)) / 8, 0, 1);
      setPanic(0.35 + lv*0.65, 650);
      if ((S.timeLeft|0) <= 5) tick('final', 1.7);
    }

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

      // H+ attacks
      if (tnow >= (S.bossAtkNextAt||0)){
        bossAttackPattern();
        S.bossAtkNextAt = tnow + (diffKey==='hard' ? 3000 : 3300);
      }
    }

    // spawn cadence (EXTREME)
    const stormMul = (S.stormActive ? (S.stormMul||0.62) : 1.0);
    const panicMul = (S.panicLevel > 0 ? (1.0 - 0.18*S.panicLevel) : 1.0); // up to -18%
    const slowMul  = (S.stunActive ? 1.15 : 1.0);
    const spawnGap = Math.round(D.spawnMs * slowMul * stormMul * panicMul);

    if (tnow - S.lastSpawnAt >= spawnGap){
      S.lastSpawnAt = tnow;

      if (S.bossAlive){
        if (S.bossPhase === 2){
          const roll = Math.random();
          if (roll < 0.55) spawnTarget('junk');
          else if (roll < 0.68) spawnTarget('fake');
          else if (roll < 0.80) spawnTarget('good');
          else if (roll < 0.90) spawnTarget('gold');
          else spawnTarget('power');

          // H+3: occasionally inject fake good
          if (Math.random() < (diffKey==='hard' ? 0.22 : 0.16)){
            spawnTarget('goodfake');
          }
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

    hazardsTick();
    heroBurstTick();
    magnetTick();
    expireTick();
    stunFieldTick();

    // storm/panic expiry
    if (S.stormActive && now() >= S.stormEndsAt) clearStorm();
    if ((S.panicEndsAt||0) > 0 && now() >= S.panicEndsAt){
      S.panicLevel = 0;
      safeDispatch('hha:panic', { level: 0, ms: 0 });
      S.panicEndsAt = 0;
    }

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