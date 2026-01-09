// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Engine — PRODUCTION (A+B+C BOSS HARD++ + FX FIX)
// ✅ DOM target spawner (L/R layers for cVR)
// ✅ Tap/click + VR crosshair shooting via hha:shoot
// ✅ Emits FX events with type + x/y + combo to BOTH window + document
// ✅ Boss: HP 10/12/14 (easy/normal/hard), Phase 2–6s, Storm<=30s, Rage miss>=5
// ✅ Goal + Mini quest auto rotate (kid-friendly)
// ✅ End summary via aria-hidden only
// ✅ Research: deterministic seed + adaptive OFF

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// ------------------------------------------------------------
// Utilities
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function byId(id){ return DOC.getElementById(id); }

function makeRng(seed){
  // xorshift32 (deterministic)
  let x = (seed>>>0) || 0x9E3779B9;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

// ------------------------------------------------------------
// Engine state
const state = {
  view: 'mobile',
  run: 'play',
  diff: 'normal',
  durationPlannedSec: 80,
  timeLeftSec: 80,
  playing: false,
  ended: false,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  fever: 0,        // 0..100
  shield: 0,       // integer

  // quest
  goal: null,
  mini: null,
  goalsCleared: 0,
  goalsTotal: 4,
  miniCleared: 0,
  miniTotal: 6,

  // targets
  targets: new Map(), // id -> {el, kind, bornAt, x,y, ttlMs, alive, layer}
  nextTargetId: 1,

  // boss
  boss: {
    active:false,
    rage:false,
    hp:0,
    hpMax:0,
    phase:0,
    phaseLeft:0,
    nextSpawnAt:0,
    lastPhaseAt:0,
  },

  // metrics
  nSpawnGood:0,
  nSpawnJunk:0,
  nHitGood:0,
  nHitJunk:0,
  nHitJunkGuard:0,
  nExpireGood:0,
  avgRtGoodMs: 0,
  rtCount: 0,

  // time
  tStartMs: 0,
  tLastTick: 0,
};

let rng = Math.random;
let tickHandle = 0;

// ------------------------------------------------------------
// Difficulty tuning (tweakable)
const DIFFS = {
  easy:   { spawnPerSec: 1.15, ttlGoodMs: 1550, ttlJunkMs: 1850, missLimit: 8, goodScore: 10, perfectBonus: 8, junkPenaltyScore: -10 },
  normal: { spawnPerSec: 1.35, ttlGoodMs: 1400, ttlJunkMs: 1750, missLimit: 7, goodScore: 12, perfectBonus:10, junkPenaltyScore: -12 },
  hard:   { spawnPerSec: 1.60, ttlGoodMs: 1250, ttlJunkMs: 1650, missLimit: 6, goodScore: 14, perfectBonus:12, junkPenaltyScore: -14 },
};

// ------------------------------------------------------------
// DOM refs (support both HTML variants)
const HUD = {
  score: byId('hud-score'),
  time:  byId('hud-time'),
  miss:  byId('hud-miss'),
  grade: byId('hud-grade'),

  goalTitle: byId('hud-goal'),
  goalDesc:  byId('goalDesc'),
  goalCur:   byId('hud-goal-cur'),
  goalTar:   byId('hud-goal-target'),

  miniTitle: byId('hud-mini'),
  miniTimer: byId('miniTimer'),

  feverFill: byId('feverFill'),
  feverText: byId('feverText'),
  shieldPills: byId('shieldPills'),

  peekGoal: byId('peekGoal'),
  peekMini: byId('peekMini'),

  lowTime: byId('lowTimeOverlay'),
  lowTimeNum: byId('gj-lowtime-num'),

  endOverlay: byId('endOverlay'),
  endTitle: byId('endTitle'),
  endSub: byId('endSub'),
  endGrade: byId('endGrade'),
  endScore: byId('endScore'),
  endMiss: byId('endMiss'),
  endTime: byId('endTime'),

  bossBar: byId('bossBar'),
  bossHpFill: byId('bossHpFill'),
  bossHpText: byId('bossHpText'),
};

const LAYER_L = byId('gj-layer');
const LAYER_R = byId('gj-layer-r');
const PLAYFIELD = byId('playfield') || byId('gjField') || DOC.body;

// ------------------------------------------------------------
// View helpers
function isMobileUA(){
  const ua = String(navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod/.test(ua);
}
function currentLayers(){
  // cVR uses both, others use left only
  const view = DOC.body.dataset.view || state.view;
  const isCVR = (view === 'cvr') || DOC.body.classList.contains('view-cvr');
  return { isCVR, L: LAYER_L, R: LAYER_R };
}

// ------------------------------------------------------------
// FX + pressure state
function fxState(){
  const storm = (state.timeLeftSec <= 30);
  const boss  = !!state.boss.active;
  const rage  = !!state.boss.rage;

  DOC.body.classList.toggle('gj-storm', storm);
  DOC.body.classList.toggle('gj-boss', boss);
  DOC.body.classList.toggle('gj-rage', rage);

  emit('hha:fx-state', { storm, boss, rage });
}

function bossHpByDiff(){
  if(state.diff === 'easy') return 10;
  if(state.diff === 'hard') return 14;
  return 12;
}
function nextBossPhase(){
  const b = state.boss;
  b.phase++;
  b.phaseLeft = 2 + rng()*4; // 2–6s
  b.lastPhaseAt = now();
}
function startBoss(){
  const b = state.boss;
  if(b.active) return;
  b.active = true;
  b.rage = false;
  b.hpMax = bossHpByDiff();
  b.hp = b.hpMax;
  b.phase = 0;
  nextBossPhase();
  b.nextSpawnAt = now();
  fxState();
  renderBoss();
  // “เข้าบอส” ให้ FX เตะเบา ๆ
  emit('hha:judge', { type:'bad', x: innerWidth/2, y: innerHeight*0.28, combo: state.combo });
}
function setRage(){
  const b = state.boss;
  if(!b.active || b.rage) return;
  b.rage = true;
  fxState();
  renderBoss();
}
function endBoss(success=true){
  const b = state.boss;
  b.active = false;
  b.rage = false;
  fxState();
  renderBoss();
  if(success){
    emit('hha:celebrate', { kind:'bossDown' });
  }
}
function damageBoss(dmg, x, y){
  const b = state.boss;
  if(!b.active) return;
  b.hp = Math.max(0, b.hp - (Number(dmg)||1));
  renderBoss();
  if(b.hp <= 0){
    endBoss(true);
    // reward: +score + shield
    addShield(2);
    setScore(state.score + 45, { x, y });
  }
}
function onPressure(){
  if(state.timeLeftSec <= 30) fxState();
  if(state.miss >= 4) startBoss();
  if(state.miss >= 5) setRage();
}

// ------------------------------------------------------------
// Rendering HUD
function setScore(v, meta={}){
  const prev = state.score;
  state.score = Math.max(0, Math.floor(v));
  if(HUD.score) HUD.score.textContent = String(state.score);

  const delta = state.score - prev;
  const x = meta.x ?? meta.clientX ?? innerWidth/2;
  const y = meta.y ?? meta.clientY ?? innerHeight/2;

  emit('hha:score', { score: state.score, delta, x, y });
}
function setMiss(v){
  state.miss = Math.max(0, Math.floor(v));
  if(HUD.miss) HUD.miss.textContent = String(state.miss);
}
function setTimeLeft(sec){
  state.timeLeftSec = Math.max(0, Math.ceil(sec));
  if(HUD.time) HUD.time.textContent = String(state.timeLeftSec);

  // low time overlay (t<=5)
  if(HUD.lowTime && HUD.lowTimeNum){
    if(state.timeLeftSec <= 5 && state.timeLeftSec > 0){
      HUD.lowTime.setAttribute('aria-hidden','false');
      HUD.lowTimeNum.textContent = String(state.timeLeftSec);
    } else {
      HUD.lowTime.setAttribute('aria-hidden','true');
    }
  }
}
function setCombo(v){
  state.combo = Math.max(0, Math.floor(v));
  state.comboMax = Math.max(state.comboMax, state.combo);
}
function setFever(v){
  state.fever = clamp(v, 0, 100);
  if(HUD.feverFill) HUD.feverFill.style.width = `${state.fever}%`;
  if(HUD.feverText) HUD.feverText.textContent = `${Math.round(state.fever)}%`;
}
function addShield(n){
  state.shield = Math.max(0, state.shield + (Number(n)||0));
  renderShield();
}
function consumeShield(){
  if(state.shield > 0){
    state.shield--;
    renderShield();
    return true;
  }
  return false;
}
function renderShield(){
  if(!HUD.shieldPills) return;
  if(state.shield <= 0) HUD.shieldPills.textContent = '—';
  else HUD.shieldPills.textContent = '🛡️'.repeat(Math.min(6, state.shield)) + (state.shield>6?`+${state.shield-6}`:'');
}
function gradeFromScore(){
  const s = state.score;
  if(s >= 320) return 'S';
  if(s >= 250) return 'A';
  if(s >= 190) return 'B';
  if(s >= 130) return 'C';
  if(s >= 80)  return 'D';
  return 'E';
}
function renderGrade(){
  if(HUD.grade) HUD.grade.textContent = gradeFromScore();
}
function renderBoss(){
  if(!HUD.bossBar || !HUD.bossHpFill || !HUD.bossHpText) return;
  HUD.bossBar.setAttribute('aria-hidden', state.boss.active ? 'false' : 'true');
  HUD.bossHpText.textContent = `HP ${state.boss.hp}/${state.boss.hpMax}`;
  const pct = state.boss.hpMax ? (state.boss.hp / state.boss.hpMax) * 100 : 0;
  HUD.bossHpFill.style.width = `${clamp(pct,0,100)}%`;
}

// ------------------------------------------------------------
// Quest system (kid-friendly)
function makeGoal(){
  // 4 goals rotate
  const pool = [
    { id:'g1', title:'กินของดี', desc:'แตะของดีให้ได้ 18 ครั้ง', type:'hit_good', target:18 },
    { id:'g2', title:'หลบขยะ', desc:'จบเกมด้วย MISS ≤ 5', type:'survive_miss', target:5 },
    { id:'g3', title:'คอมโบ!', desc:'ทำคอมโบให้ได้ 10', type:'combo_reach', target:10 },
    { id:'g4', title:'เร็ว+แม่น', desc:'ทำ PERFECT ให้ได้ 6', type:'perfect_hits', target:6 },
  ];
  // deterministic pick
  const idx = (state.goalsCleared % pool.length);
  const g = Object.assign({}, pool[idx], { cur:0, done:false });
  return g;
}

function makeMini(){
  // 6 minis rotate
  const pool = [
    { id:'m1', title:'เร็ว 3 ครั้ง', type:'fast_hits', thrMs: 380, target:3, cur:0, sec: 10 },
    { id:'m2', title:'ของดีติดกัน 5', type:'streak_good', target:5, cur:0, sec: 12 },
    { id:'m3', title:'ยิงพลาดน้อย', type:'no_miss', target:0, cur:0, sec: 12 }, // cur used as miss at start
    { id:'m4', title:'PERFECT 2', type:'perfect_hits', target:2, cur:0, sec: 10 },
    { id:'m5', title:'กันขยะ 1', type:'block_junk', target:1, cur:0, sec: 12 },
    { id:'m6', title:'คอมโบ 6', type:'combo_reach', target:6, cur:0, sec: 12 },
  ];
  const idx = (state.miniCleared % pool.length);
  const m = Object.assign({}, pool[idx], {
    tLeft: pool[idx].sec,
    done:false,
    startedAt: now(),
    baseMiss: state.miss,
    baseCombo: state.combo,
  });
  return m;
}

function setQuestUI(){
  const g = state.goal, m = state.mini;

  if(HUD.goalTitle) HUD.goalTitle.textContent = g?.title ?? '—';
  if(HUD.goalDesc)  HUD.goalDesc.textContent  = g?.desc ?? '—';
  if(HUD.goalCur)   HUD.goalCur.textContent   = String(g?.cur ?? 0);
  if(HUD.goalTar)   HUD.goalTar.textContent   = String(g?.target ?? 0);

  if(HUD.miniTitle) HUD.miniTitle.textContent = m?.title ?? '—';
  if(HUD.miniTimer) HUD.miniTimer.textContent = m ? `${Math.ceil(m.tLeft)}s` : '—';

  // peek overlay text (if exists)
  if(HUD.peekGoal){
    if(g) HUD.peekGoal.textContent = `GOAL: ${g.title} (${g.cur}/${g.target})`;
    else  HUD.peekGoal.textContent = 'GOAL: —';
  }
  if(HUD.peekMini){
    if(m){
      if(m.type === 'fast_hits') HUD.peekMini.textContent = `MINI: ${m.title} (${m.cur}/${m.target}) < ${m.thrMs}ms`;
      else HUD.peekMini.textContent = `MINI: ${m.title} (${m.cur}/${m.target})`;
    }else{
      HUD.peekMini.textContent = 'MINI: —';
    }
  }

  emit('quest:update', { goal:g, mini:m });
}

function completeGoal(){
  if(!state.goal || state.goal.done) return;
  state.goal.done = true;
  state.goalsCleared++;
  emit('hha:celebrate', { kind:'goal' });
  setScore(state.score + 35, { x: innerWidth/2, y: innerHeight*0.30 });
  addShield(1);
  state.goal = makeGoal();
  setQuestUI();
}
function completeMini(){
  if(!state.mini || state.mini.done) return;
  state.mini.done = true;
  state.miniCleared++;
  emit('hha:celebrate', { kind:'mini' });
  setScore(state.score + 20, { x: innerWidth/2, y: innerHeight*0.34 });
  // mini reward: fever + shield small
  setFever(state.fever + 12);
  if(rng() < 0.55) addShield(1);
  state.mini = makeMini();
  setQuestUI();
}

function updateQuestOnGood(rtMs, isPerfect){
  const g = state.goal, m = state.mini;
  if(!g || !m) return;

  // GOAL progress
  if(g.type === 'hit_good'){
    g.cur++;
    if(g.cur >= g.target) completeGoal();
  } else if(g.type === 'survive_miss'){
    // evaluated at end only; keep cur as current miss
    g.cur = state.miss;
  } else if(g.type === 'combo_reach'){
    g.cur = Math.max(g.cur, state.comboMax);
    if(g.cur >= g.target) completeGoal();
  } else if(g.type === 'perfect_hits'){
    if(isPerfect){ g.cur++; if(g.cur >= g.target) completeGoal(); }
  }

  // MINI progress
  if(m.type === 'fast_hits'){
    if(rtMs <= m.thrMs){ m.cur++; if(m.cur >= m.target) completeMini(); }
  } else if(m.type === 'streak_good'){
    m.cur = clamp(m.cur + 1, 0, m.target);
    if(m.cur >= m.target) completeMini();
  } else if(m.type === 'no_miss'){
    // if miss increased from base -> fail (reset by restarting mini)
    const missDelta = state.miss - (m.baseMiss||0);
    if(missDelta > 0){
      // reset mini quickly (kid-friendly: just rotate)
      state.mini = makeMini();
      setQuestUI();
      return;
    }
  } else if(m.type === 'perfect_hits'){
    if(isPerfect){ m.cur++; if(m.cur >= m.target) completeMini(); }
  } else if(m.type === 'block_junk'){
    // updated elsewhere
  } else if(m.type === 'combo_reach'){
    m.cur = Math.max(m.cur, state.comboMax);
    if(m.cur >= m.target) completeMini();
  }

  // sync UI counters
  if(HUD.goalCur) HUD.goalCur.textContent = String(g.cur ?? 0);
  if(HUD.goalTar) HUD.goalTar.textContent = String(g.target ?? 0);
  if(HUD.miniTimer) HUD.miniTimer.textContent = `${Math.ceil(m.tLeft)}s`;
  setQuestUI();
}

function updateQuestOnJunk(blocked){
  const m = state.mini;
  if(!m) return;
  if(m.type === 'block_junk' && blocked){
    m.cur++;
    if(m.cur >= m.target) completeMini();
    else setQuestUI();
  }
  // streak_good mini breaks on junk (fair)
  if(m.type === 'streak_good' && !blocked){
    m.cur = 0;
    setQuestUI();
  }
}

// ------------------------------------------------------------
// Spawn logic (A+B+C patterns)
function playRect(){
  // spawn in safe zone using CSS vars from boot: --gj-top-safe / --gj-bottom-safe
  const root = DOC.documentElement;
  const cs = getComputedStyle(root);
  const topSafe = parseFloat(cs.getPropertyValue('--gj-top-safe')) || 120;
  const botSafe = parseFloat(cs.getPropertyValue('--gj-bottom-safe')) || 120;

  const W = innerWidth;
  const H = innerHeight;

  const pad = 14;
  const x0 = pad;
  const x1 = W - pad;
  const y0 = topSafe + 10;
  const y1 = H - botSafe - 10;

  return {
    x0, y0, x1, y1,
    w: Math.max(40, x1-x0),
    h: Math.max(40, y1-y0),
  };
}

function spawnRate(){
  const D = DIFFS[state.diff] || DIFFS.normal;
  let r = D.spawnPerSec;

  const adaptiveOn = (state.run !== 'research' && state.run !== 'study');
  if(adaptiveOn){
    const struggle = clamp(state.miss / (D.missLimit||7), 0, 1);
    const comboBoost = clamp(state.combo / 18, 0, 1);
    r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
  }

  const storm = (state.timeLeftSec <= 30);
  const boss  = !!state.boss.active;
  const rage  = !!state.boss.rage;

  if(storm) r *= 1.18;
  if(boss)  r *= 1.28;
  if(rage)  r *= 1.42;

  return clamp(r, 0.85, rage ? 2.35 : 2.10);
}

function pickKind(){
  // Base probabilities
  const boss = state.boss.active;
  const rage = state.boss.rage;
  const storm = state.timeLeftSec <= 30;

  let pGood = 0.62;
  let pJunk = 0.34;
  let pStar = 0.04; // rare power

  if(storm){ pJunk += 0.05; pGood -= 0.05; }
  if(boss){  pJunk += 0.06; pGood -= 0.06; pStar = 0.06; }
  if(rage){  pJunk += 0.08; pGood -= 0.08; pStar = 0.07; }

  const u = rng();
  if(u < pStar) return 'star';
  if(u < pStar + pGood) return 'good';
  return 'junk';
}

function createTarget(kind, layerEl, x, y, ttlMs, scale){
  const id = state.nextTargetId++;
  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = `gj-target t-${kind}`;
  el.setAttribute('data-id', String(id));
  el.setAttribute('aria-label', kind);
  el.style.cssText = `
    position:absolute;
    left:${Math.round(x)}px; top:${Math.round(y)}px;
    transform: translate(-50%,-50%) scale(${scale});
    width: ${Math.round(64*scale)}px;
    height:${Math.round(64*scale)}px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.42);
    backdrop-filter: blur(8px);
    color:#fff;
    font: 900 ${Math.round(20*scale)}px/1 system-ui;
    box-shadow: 0 18px 50px rgba(0,0,0,.35);
    cursor:pointer;
    -webkit-tap-highlight-color: transparent;
  `;
  // emoji
  el.textContent =
    (kind === 'good') ? '🥦' :
    (kind === 'junk') ? '🍟' :
    '⭐';

  layerEl.appendChild(el);

  const t = { id, el, kind, bornAt: now(), x, y, ttlMs, alive:true, layer: layerEl };
  state.targets.set(id, t);
  return t;
}

function spawnOne(){
  const { isCVR, L, R } = currentLayers();
  if(!L) return;

  const D = DIFFS[state.diff] || DIFFS.normal;
  const rect = playRect();

  const kind = pickKind();
  const ttlMs = (kind === 'good') ? D.ttlGoodMs : (kind === 'junk' ? D.ttlJunkMs : 1400);
  // size: boss/rage makes targets slightly smaller (harder but fair)
  let scale = 1.0;
  if(state.boss.active) scale = 0.96;
  if(state.boss.rage)   scale = 0.92;

  // Pattern generator (A): phase-based placement changes when boss active
  let x = rect.x0 + rng()*rect.w;
  let y = rect.y0 + rng()*rect.h;

  if(state.boss.active){
    const b = state.boss;
    const phase = b.phase % 3; // 0,1,2 repeating
    const cx = rect.x0 + rect.w*0.5;
    const cy = rect.y0 + rect.h*0.42;

    if(phase === 0){
      // Ring-ish
      const ang = rng()*Math.PI*2;
      const rr = Math.min(rect.w, rect.h) * (0.22 + rng()*0.18);
      x = cx + Math.cos(ang)*rr;
      y = cy + Math.sin(ang)*rr;
    } else if(phase === 1){
      // Side lanes (left/right)
      const side = (rng() < 0.5) ? -1 : 1;
      x = cx + side * rect.w*(0.26 + rng()*0.14);
      y = rect.y0 + rng()*rect.h;
    } else {
      // Crosshair pressure zone (near center but not exactly)
      x = cx + (rng()*2-1)*rect.w*0.18;
      y = cy + (rng()*2-1)*rect.h*0.16;
    }

    // Boss spawns more junk but always leaves room (B: fairness)
    if(state.boss.rage && kind === 'junk' && rng() < 0.18){
      scale *= 0.92; // smaller junk in rage
    }
  }

  // pick layer(s)
  const layer = isCVR ? ((rng()<0.5) ? L : (R||L)) : L;

  const t = createTarget(kind, layer, x, y, ttlMs, scale);

  if(kind === 'good') state.nSpawnGood++;
  else if(kind === 'junk') state.nSpawnJunk++;

  // click handler
  elBind(t.el, (ev)=> onHitTarget(t.id, ev));

  return t;
}

function elBind(el, fn){
  el.addEventListener('click', fn, { passive:true });
  el.addEventListener('pointerdown', fn, { passive:true });
}

// ------------------------------------------------------------
// Hit logic
function hitXYFromEvent(ev, t){
  const px = ev?.clientX ?? ev?.x ?? t?.x ?? innerWidth/2;
  const py = ev?.clientY ?? ev?.y ?? t?.y ?? innerHeight/2;
  return { px, py };
}

function removeTarget(t){
  if(!t || !t.alive) return;
  t.alive = false;
  try{ t.el.remove(); }catch(_){}
  state.targets.delete(t.id);
}

function addFeverOnGood(isPerfect){
  const inc = isPerfect ? 12 : 8;
  setFever(state.fever + inc);
  if(state.fever >= 100){
    // fever -> reward shield and reset
    setFever(0);
    addShield(1);
    emit('hha:celebrate', { kind:'fever' });
  }
}

function onHitTarget(id, ev){
  if(!state.playing || state.ended) return;
  const t = state.targets.get(Number(id));
  if(!t || !t.alive) return;

  const { px, py } = hitXYFromEvent(ev, t);
  const rtMs = Math.max(0, Math.round(now() - t.bornAt));

  removeTarget(t);

  const D = DIFFS[state.diff] || DIFFS.normal;

  if(t.kind === 'good'){
    state.nHitGood++;

    // combo grows on good
    setCombo(state.combo + 1);

    const isPerfect = (rtMs <= 260);
    const add = D.goodScore + (isPerfect ? D.perfectBonus : 0);

    setScore(state.score + add, { x:px, y:py });

    // emit judge for FX
    emit('hha:judge', { type: isPerfect ? 'perfect' : 'good', x:px, y:py, combo: state.combo });

    // boss damage (C: reward loop)
    if(state.boss.active){
      const dmg = isPerfect ? 2 : 1;
      damageBoss(dmg, px, py);
    }

    // track RT
    state.rtCount++;
    state.avgRtGoodMs = state.avgRtGoodMs + (rtMs - state.avgRtGoodMs)/state.rtCount;

    addFeverOnGood(isPerfect);
    updateQuestOnGood(rtMs, isPerfect);

  } else if(t.kind === 'star'){
    // power: shield + score
    addShield(1);
    setScore(state.score + 18, { x:px, y:py });
    emit('hha:judge', { type:'good', x:px, y:py, combo: state.combo });
    emit('hha:celebrate', { kind:'star' });

  } else {
    // junk
    state.nHitJunk++;

    const blocked = consumeShield();
    if(blocked){
      state.nHitJunkGuard++;
      emit('hha:judge', { type:'block', x:px, y:py, combo: state.combo });
      updateQuestOnJunk(true);
      // small reward to keep it fun
      setScore(state.score + 4, { x:px, y:py });
      return;
    }

    // break combo
    setCombo(0);

    // penalty score (rage heavier but fair)
    const rage = !!state.boss.rage;
    const scorePen = rage ? (D.junkPenaltyScore - 6) : D.junkPenaltyScore;
    setScore(state.score + scorePen, { x:px, y:py });

    // miss++
    setMiss(state.miss + 1);

    emit('hha:judge', { type:'bad', x:px, y:py, combo: state.combo });

    updateQuestOnJunk(false);
    onPressure();

    // game over if missLimit
    if(state.miss >= (D.missLimit||7)){
      endGame('missLimit');
    }
  }

  renderGrade();
}

// ------------------------------------------------------------
// Crosshair shooting (VR/cVR)
// We select nearest target to center (lockPx from vr-ui), else nearest overall.
function onShoot(ev){
  if(!state.playing || state.ended) return;

  const d = ev?.detail || {};
  const lockPx = Number(d.lockPx ?? 28) || 28;

  const cx = innerWidth/2;
  const cy = innerHeight/2;

  let best = null;
  let bestDist = 1e9;

  for(const t of state.targets.values()){
    if(!t.alive) continue;
    const dx = (t.x - cx);
    const dy = (t.y - cy);
    const dist = Math.hypot(dx,dy);
    if(dist < bestDist){
      bestDist = dist;
      best = t;
    }
  }
  if(!best) return;

  // strict lock: only shoot if within lockPx*3 (keep it fair)
  if(bestDist > lockPx*3){
    // small miss feedback (no penalty)
    emit('hha:judge', { type:'miss', x: cx, y: cy, combo: state.combo });
    return;
  }

  onHitTarget(best.id, { clientX: best.x, clientY: best.y });
}

// ------------------------------------------------------------
// Expire handling
function expireTargets(dtMs){
  if(!state.playing || state.ended) return;

  const tNow = now();
  const D = DIFFS[state.diff] || DIFFS.normal;

  for(const t of Array.from(state.targets.values())){
    if(!t.alive) continue;
    if((tNow - t.bornAt) >= t.ttlMs){
      // expire
      removeTarget(t);
      if(t.kind === 'good'){
        state.nExpireGood++;
        setCombo(0);
        setMiss(state.miss + 1);
        emit('hha:judge', { type:'miss', x:t.x, y:t.y, combo: state.combo });
        onPressure();
        if(state.miss >= (D.missLimit||7)){
          endGame('missLimit');
          return;
        }
      }
    }
  }
}

// ------------------------------------------------------------
// Boss phase tick
function tickBoss(dtSec){
  const b = state.boss;
  if(!b.active) return;

  b.phaseLeft -= dtSec;
  if(b.phaseLeft <= 0){
    nextBossPhase();
  }

  // Boss attack pattern (B): “telegraph then junk burst” but fair
  const tNow = now();
  if(tNow >= b.nextSpawnAt){
    // During boss: spawn a small wave quickly
    const wave = b.rage ? 3 : 2;
    for(let i=0;i<wave;i++) spawnOne();
    // telegraph by emitting judge (screen kick) without penalty
    emit('hha:judge', { type:'bad', x: innerWidth/2, y: innerHeight*0.26, combo: state.combo });

    const baseGap = b.rage ? 240 : 320; // ms
    b.nextSpawnAt = tNow + baseGap + rng()*220;
  }

  renderBoss();
}

// ------------------------------------------------------------
// Mini countdown
function tickMini(dtSec){
  const m = state.mini;
  if(!m || m.done) return;
  m.tLeft -= dtSec;
  if(HUD.miniTimer) HUD.miniTimer.textContent = `${Math.ceil(m.tLeft)}s`;
  if(m.tLeft <= 0){
    // time up -> rotate mini (kid-friendly)
    state.mini = makeMini();
    setQuestUI();
  }
}

// ------------------------------------------------------------
// Game loop
function tick(){
  if(!state.playing || state.ended) return;

  const t = now();
  const dtMs = Math.min(80, Math.max(0, t - state.tLastTick));
  state.tLastTick = t;

  const dtSec = dtMs / 1000;

  // time
  state.timeLeftSec -= dtSec;
  if(state.timeLeftSec <= 0){
    setTimeLeft(0);
    endGame('timeUp');
    return;
  }
  setTimeLeft(state.timeLeftSec);
  fxState();

  // spawn
  const r = spawnRate(); // per sec
  // Poisson-like: spawn if rng < r*dt
  const p = r * dtSec;
  if(rng() < p) spawnOne();
  if(state.boss.active && rng() < (p*0.55)) spawnOne(); // extra during boss

  // expire
  expireTargets(dtMs);

  // boss
  tickBoss(dtSec);

  // mini
  tickMini(dtSec);

  // goal survive_miss update
  if(state.goal && state.goal.type === 'survive_miss'){
    state.goal.cur = state.miss;
    if(HUD.goalCur) HUD.goalCur.textContent = String(state.goal.cur);
  }
}

function startLoop(){
  state.tLastTick = now();
  tickHandle = ROOT.setInterval(tick, 60);
}

// ------------------------------------------------------------
// End game
function endGame(reason){
  if(state.ended) return;
  state.ended = true;
  state.playing = false;

  try{ if(tickHandle) clearInterval(tickHandle); }catch(_){}

  // clear targets
  for(const t of state.targets.values()){
    try{ t.el.remove(); }catch(_){}
  }
  state.targets.clear();

  // survive goal check
  if(state.goal && state.goal.type === 'survive_miss'){
    if(state.miss <= state.goal.target) completeGoal();
  }

  const durationPlayedSec = Math.round((now() - state.tStartMs) / 1000);

  // fill end overlay (aria-hidden only)
  const grade = gradeFromScore();
  if(HUD.endTitle) HUD.endTitle.textContent = (reason === 'missLimit') ? 'Game Over' : 'Completed';
  if(HUD.endSub) HUD.endSub.textContent = `reason=${reason} | mode=${state.run} | diff=${state.diff}`;
  if(HUD.endGrade) HUD.endGrade.textContent = grade;
  if(HUD.endScore) HUD.endScore.textContent = String(state.score);
  if(HUD.endMiss) HUD.endMiss.textContent = String(state.miss);
  if(HUD.endTime) HUD.endTime.textContent = String(durationPlayedSec);

  if(HUD.endOverlay){
    HUD.endOverlay.setAttribute('aria-hidden','false');
    HUD.endOverlay.style.display = 'flex';
  }

  emit('hha:end', {
    reason,
    runMode: state.run,
    diff: state.diff,
    device: (DOC.body.dataset.view || state.view),
    durationPlannedSec: state.durationPlannedSec,
    durationPlayedSec,
    scoreFinal: state.score,
    comboMax: state.comboMax,
    misses: state.miss,
    goalsCleared: state.goalsCleared,
    goalsTotal: state.goalsTotal,
    miniCleared: state.miniCleared,
    miniTotal: state.miniTotal,
    nTargetGoodSpawned: state.nSpawnGood,
    nTargetJunkSpawned: state.nSpawnJunk,
    nHitGood: state.nHitGood,
    nHitJunk: state.nHitJunk,
    nHitJunkGuard: state.nHitJunkGuard,
    nExpireGood: state.nExpireGood,
    avgRtGoodMs: Math.round(state.avgRtGoodMs || 0),
    grade,
  });

  emit('hha:flush', { reason:'end' });
}

// ------------------------------------------------------------
// Boot / init
export function boot(opts={}){
  // parse opts
  state.view = String(opts.view || (isMobileUA() ? 'mobile' : 'pc')).toLowerCase();
  state.run  = String(opts.run  || qs('run','play')).toLowerCase();
  state.diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  state.durationPlannedSec = Math.max(20, Math.round(Number(opts.time ?? qs('time','80')) || 80));
  state.timeLeftSec = state.durationPlannedSec;

  // RNG
  const seedParam = (opts.seed ?? qs('seed', null));
  let seed = seedParam ? (Number(seedParam) || 0) : 0;
  if(!seed){
    // play mode random seed; research/study should pass a seed
    seed = (Date.now() ^ (Math.random()*1e9)) >>> 0;
  }
  rng = makeRng(seed >>> 0);

  // Ensure boss classes reflect current
  fxState();

  // Init quests
  state.goal = makeGoal();
  state.mini = makeMini();
  setQuestUI();

  // Init HUD
  setScore(0);
  setMiss(0);
  setCombo(0);
  setFever(0);
  renderShield();
  renderGrade();
  setTimeLeft(state.timeLeftSec);

  // bind shooting
  ROOT.addEventListener('hha:shoot', onShoot, { passive:true });

  // mark start
  state.tStartMs = now();
  state.playing = true;
  state.ended = false;

  emit('hha:start', {
    game:'goodjunk',
    runMode: state.run,
    diff: state.diff,
    durationPlannedSec: state.durationPlannedSec,
    seed,
    view: state.view,
  });

  startLoop();
}