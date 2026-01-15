// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE ENGINE (PRODUCTION)
// HHA Standard (adaptable)
// ------------------------------------------------
// ✅ Play / Research modes
//   - play: adaptive ON
//   - research/study: deterministic seed + adaptive OFF
// ✅ Miss definition:
//   miss = good expired + junk hit (BUT junk hit guarded by shield => NOT miss)
// ✅ Quests:
//   - Goal + Mini (mini clears -> rotate immediately; kid-friendly)
// ✅ Input:
//   - Click/tap on target (pc/mobile)
//   - Crosshair shoot event: window 'hha:shoot' (cVR/VR) -> aim assist lockPx
// ✅ Emits:
//   hha:start, hha:judge, hha:score, hha:time, quest:update, hha:end, hha:log, hha:coach
// ✅ End summary + Back HUB + persist last summary
// ------------------------------------------------

'use strict';

const WIN = window;
const DOC = document;

// ---------- utils ----------
const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
const nowMs = ()=> (performance?.now?.() ?? Date.now());
const isoNow = ()=> new Date().toISOString();

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
}

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

// ---------- seeded rng ----------
function xmur3(str){
  let h = 1779033703 ^ (str.length);
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
  };
}
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seedAny){
  const s = String(seedAny ?? Date.now());
  const seed = xmur3(s)();
  return { seedStr:s, rnd: mulberry32(seed) };
}
function rint(rnd, a, b){ return Math.floor(rnd()*(b-a+1))+a; }

// ---------- DOM refs ----------
const el = {
  layerL: null,
  layerR: null,
  hudScore: null,
  hudTime: null,
  hudMiss: null,
  hudGrade: null,
  hudGoal: null,
  goalDesc: null,
  goalCur: null,
  goalTarget: null,
  hudMini: null,
  miniTimer: null,
  feverFill: null,
  feverText: null,
  shieldPills: null,
  lowOverlay: null,
  lowNum: null,
  btnBackHub: null,
};

function bindDom(){
  el.layerL = DOC.getElementById('gj-layer');
  el.layerR = DOC.getElementById('gj-layer-r');

  el.hudScore = DOC.getElementById('hud-score');
  el.hudTime  = DOC.getElementById('hud-time');
  el.hudMiss  = DOC.getElementById('hud-miss');
  el.hudGrade = DOC.getElementById('hud-grade');

  el.hudGoal = DOC.getElementById('hud-goal');
  el.goalDesc = DOC.getElementById('goalDesc');
  el.goalCur  = DOC.getElementById('hud-goal-cur');
  el.goalTarget = DOC.getElementById('hud-goal-target');

  el.hudMini = DOC.getElementById('hud-mini');
  el.miniTimer = DOC.getElementById('miniTimer');

  el.feverFill = DOC.getElementById('feverFill');
  el.feverText = DOC.getElementById('feverText');

  el.shieldPills = DOC.getElementById('shieldPills');

  el.lowOverlay = DOC.getElementById('lowTimeOverlay');
  el.lowNum = DOC.getElementById('gj-lowtime-num');

  el.btnBackHub = DOC.getElementById('btnBackHub');
}

// ---------- playfield rect (safe spawn) ----------
function readSafeVarsPx(){
  const cs = getComputedStyle(DOC.documentElement);
  const top = cs.getPropertyValue('--gj-top-safe').trim();
  const bot = cs.getPropertyValue('--gj-bottom-safe').trim();

  function toPx(v, fallback){
    if(!v) return fallback;
    const tmp = DOC.createElement('div');
    tmp.style.position='fixed';
    tmp.style.left='0';
    tmp.style.top='0';
    tmp.style.width='0';
    tmp.style.height = v;
    DOC.body.appendChild(tmp);
    const px = tmp.getBoundingClientRect().height;
    tmp.remove();
    if(!isFinite(px) || px<=0) return fallback;
    return px;
  }
  return { topPx: toPx(top, 140), bottomPx: toPx(bot, 140) };
}

function computePlayRect(){
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);

  const safe = readSafeVarsPx();
  const pad = 8;

  const top = clamp(safe.topPx + pad, 0, h-60);
  const bottom = clamp(h - safe.bottomPx - pad, 60, h);

  let y0 = top, y1 = bottom;
  if (y1 - y0 < 180){
    const mid = (y0+y1)/2;
    y0 = clamp(mid-110, 0, h-60);
    y1 = clamp(mid+110, 60, h);
  }

  const x0 = 10;
  const x1 = w - 10;

  return { x0, y0, x1, y1, w, h };
}

// ---------- game state ----------
const S = {
  started:false,
  ended:false,

  view:'mobile',
  run:'play',
  diff:'normal',
  timePlanSec: 80,
  tLeftSec: 0,

  seedStr: null,
  rng: Math.random,

  hub: null,
  studyId: null,
  phase: null,
  conditionGroup: null,

  score: 0,
  combo: 0,
  comboMax: 0,

  miss_goodExpired: 0,
  miss_junkHit: 0,
  miss_total: 0,

  nHitGood:0,
  nHitJunk:0,
  nHitJunkGuard:0,
  nExpireGood:0,

  fever: 0,
  feverUp: 6,
  feverDown: 9,

  shield: 0,

  targets: new Map(),
  nextId: 1,

  spawnEveryMs: 820,
  maxOnScreen: 4,

  goalIndex: 0,
  miniIndex: 0,
  goalCur: 0,
  goalTarget: 0,
  goalText: '—',
  goalDesc: '—',
  miniText: '—',
  miniEndsAtMs: 0,
  miniDurationMs: 12000,
  goalsCleared: 0,
  goalsTotal: 5,
  miniCleared: 0,
  miniTotal: 6,

  grade: '—',

  tStartIso: null,
  tEndIso: null,
  lastTickMs: 0,
  lastSpawnMs: 0,

  lowShown: false,
};

// ---------- difficulty tables ----------
function applyDifficulty(){
  const d = (S.diff||'normal').toLowerCase();

  if (d==='easy'){
    S.spawnEveryMs = 980;
    S.maxOnScreen = 3;
    S.feverUp = 5;
    S.feverDown = 11;
    S.miniDurationMs = 13000;
  } else if (d==='hard'){
    S.spawnEveryMs = 680;
    S.maxOnScreen = 6;
    S.feverUp = 7;
    S.feverDown = 7;
    S.miniDurationMs = 10000;
  } else {
    S.spawnEveryMs = 820;
    S.maxOnScreen = 4;
    S.feverUp = 6;
    S.feverDown = 9;
    S.miniDurationMs = 12000;
  }
}

// ---------- quest pools ----------
const GOALS = [
  { text:'เก็บอาหารดีให้ได้ 8 ชิ้น', desc:'เลือกอาหารดี (✅) ให้ไว', target:8, type:'goodHits' },
  { text:'เก็บอาหารดีให้ได้ 10 ชิ้น', desc:'อย่าโดนขยะนะ', target:10, type:'goodHits' },
  { text:'ทำคอมโบให้ได้ 6', desc:'ยิงติดกันแบบไม่พลาด', target:6, type:'combo' },
  { text:'รอดให้ได้ (MISS ไม่เกิน 4)', desc:'ระวังขยะ + ของดีหมดอายุ', target:4, type:'surviveMiss' },
  { text:'เก็บดาวให้ได้ 3', desc:'ดาวช่วยคะแนนพิเศษ', target:3, type:'stars' },
];

const MINIS = [
  { text:'10 วินาทีนี้ “ห้ามโดนขยะ”', kind:'noJunk', forbidJunk:true },
  { text:'10 วินาทีนี้ “เก็บของดีให้เร็ว”', kind:'rushGood', needGood:5 },
  { text:'10 วินาทีนี้ “คอมโบ 4”', kind:'combo4', needCombo:4 },
  { text:'10 วินาทีนี้ “เก็บดาว 2”', kind:'star2', needStars:2 },
  { text:'10 วินาทีนี้ “อย่าให้ของดีหมดอายุ”', kind:'noExpire', forbidExpire:true },
  { text:'10 วินาทีนี้ “เก็บโล่ 1”', kind:'shield1', needShield:1 },
];

// ---------- UI updates ----------
function setText(node, v){
  if(!node) return;
  node.textContent = String(v);
}
function setLowOverlay(show, num){
  if(!el.lowOverlay) return;
  el.lowOverlay.setAttribute('aria-hidden', show ? 'false' : 'true');
  if(show && el.lowNum) el.lowNum.textContent = String(num);
  DOC.body.classList.toggle('gj-lowtime', show);
}
function setFever(pct){
  S.fever = clamp(pct, 0, 100);
  if(el.feverFill) el.feverFill.style.width = `${S.fever.toFixed(0)}%`;
  setText(el.feverText, `${S.fever.toFixed(0)}%`);
}
function bumpBody(cls, ms=240){
  DOC.body.classList.add(cls);
  setTimeout(()=>DOC.body.classList.remove(cls), ms);
}
function updateHud(){
  setText(el.hudScore, S.score);
  setText(el.hudTime, Math.max(0, Math.ceil(S.tLeftSec)));
  setText(el.hudMiss, S.miss_total);
  setText(el.hudGrade, S.grade);

  setText(el.hudGoal, S.goalText);
  setText(el.goalDesc, S.goalDesc);
  setText(el.goalCur, S.goalCur);
  setText(el.goalTarget, S.goalTarget);

  setText(el.hudMini, S.miniText);

  if(el.miniTimer){
    if(S.miniEndsAtMs){
      const left = Math.max(0, Math.ceil((S.miniEndsAtMs - nowMs())/1000));
      el.miniTimer.textContent = left ? `${left}s` : '0s';
    }else{
      el.miniTimer.textContent = '—';
    }
  }

  setText(el.shieldPills, S.shield ? `x${S.shield}` : '—');
}

function pushQuestUpdate(reason){
  emit('quest:update', {
    reason,
    goalText: S.goalText,
    goalCur: S.goalCur,
    goalTarget: S.goalTarget,
    miniText: S.miniText,
    miniEndsAtMs: S.miniEndsAtMs,
    goalsCleared: S.goalsCleared,
    goalsTotal: S.goalsTotal,
    miniCleared: S.miniCleared,
    miniTotal: S.miniTotal,
  });
}

// ---------- quest logic ----------
function startGoal(){
  const g = GOALS[S.goalIndex % GOALS.length];
  S.goalText = g.text;
  S.goalDesc = g.desc;
  S.goalCur = 0;
  S.goalTarget = g.target;
  pushQuestUpdate('goal-start');
}
function completeGoal(){
  S.goalsCleared++;
  bumpBody('gj-mini-clear', 220);
  pushQuestUpdate('goal-complete');
  S.goalIndex++;
  startGoal();
}
function startMini(){
  const m = MINIS[S.miniIndex % MINIS.length];
  S.miniText = m.text;
  S.miniEndsAtMs = nowMs() + S.miniDurationMs;
  S.__mini = {
    kind: m.kind,
    forbidJunk: !!m.forbidJunk,
    forbidExpire: !!m.forbidExpire,
    needGood: m.needGood || 0,
    needCombo: m.needCombo || 0,
    needStars: m.needStars || 0,
    needShield: m.needShield || 0,
    gotGood: 0,
    gotStars: 0,
    gotShield: 0,
    maxComboDuring: 0,
    failed: false,
    failReason: null,
    done: false
  };
  pushQuestUpdate('mini-start');
}
function failMini(reason){
  if(!S.__mini || S.__mini.done) return;
  S.__mini.failed = true;
  S.__mini.failReason = reason;
  S.__mini.done = true;
  bumpBody('gj-miss-shot', 140);
  emit('hha:judge', { type:'mini-fail', reason });
  S.miniIndex++;
  startMini();
}
function completeMini(){
  if(!S.__mini || S.__mini.done) return;
  S.__mini.done = true;
  S.miniCleared++;
  bumpBody('gj-mini-clear', 240);
  emit('hha:judge', { type:'mini-clear' });
  pushQuestUpdate('mini-complete');
  S.miniIndex++;
  startMini();
}
function tickMiniProgress(){
  if(!S.__mini) return;
  if(S.__mini.done) return;

  S.__mini.maxComboDuring = Math.max(S.__mini.maxComboDuring, S.combo);

  if(nowMs() >= S.miniEndsAtMs){
    const m = S.__mini;
    let ok = true;
    if(m.needGood) ok = ok && (m.gotGood >= m.needGood);
    if(m.needStars) ok = ok && (m.gotStars >= m.needStars);
    if(m.needShield) ok = ok && (m.gotShield >= m.needShield);
    if(m.needCombo) ok = ok && (m.maxComboDuring >= m.needCombo);
    if(m.forbidJunk) ok = ok && !m.failed;
    if(m.forbidExpire) ok = ok && !m.failed;

    if(ok) completeMini();
    else failMini(m.failReason || 'timeup');
  }
}

// ---------- scoring / grade ----------
function recomputeMiss(){
  S.miss_total = (S.miss_goodExpired|0) + (S.miss_junkHit|0);
}
function computeGrade(){
  const score = S.score;
  const miss = S.miss_total;
  let g = 'C';
  if(score >= 180 && miss <= 3) g = 'A';
  else if(score >= 120 && miss <= 5) g = 'B';
  else if(score >= 70) g = 'C';
  else g = 'D';
  S.grade = g;
}

// ---------- target spawn ----------
function createTarget(kind, x, y, sizePx, ttlMs){
  const id = S.nextId++;
  const node = DOC.createElement('div');
  node.className = 'gj-target spawn';
  node.dataset.id = String(id);
  node.dataset.kind = kind;

  let emoji = '🍎';
  if(kind==='junk') emoji = '🍟';
  if(kind==='star') emoji = '⭐';
  if(kind==='shield') emoji = '🛡️';

  node.textContent = emoji;
  node.style.left = `${x}px`;
  node.style.top  = `${y}px`;
  node.style.fontSize = `${sizePx}px`;

  node.addEventListener('pointerdown', (ev)=>{
    ev.preventDefault?.();
    onHitTarget(id, 'tap', ev.clientX, ev.clientY);
  }, { passive:false });

  if(el.layerL) el.layerL.appendChild(node);
  if(el.layerR){
    const clone = node.cloneNode(true);
    clone.classList.remove('spawn');
    clone.dataset.mirror = '1';
    clone.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      onHitTarget(id, 'tap', ev.clientX, ev.clientY);
    }, { passive:false });
    el.layerR.appendChild(clone);
  }

  const t = {
    id, kind, born: nowMs(),
    ttlMs,
    node,
    mirror: null,
    x,y,sizePx,
    alive:true
  };
  if(el.layerR){
    t.mirror = el.layerR.querySelector(`[data-id="${id}"][data-mirror="1"]`);
  }

  S.targets.set(id, t);

  setTimeout(()=>{
    node.classList.remove('spawn');
    t.mirror?.classList.remove('spawn');
  }, 260);

  return t;
}

function removeTarget(t){
  if(!t || !t.alive) return;
  t.alive = false;

  try{
    t.node.classList.add('gone');
    t.mirror?.classList.add('gone');
  }catch(_){}
  setTimeout(()=>{
    try{ t.node?.remove(); }catch(_){}
    try{ t.mirror?.remove(); }catch(_){}
  }, 220);

  S.targets.delete(t.id);
}

function spawnOne(){
  if(S.targets.size >= S.maxOnScreen) return;

  const R = computePlayRect();
  const x = rint(S.rng, R.x0+20, R.x1-20);
  const y = rint(S.rng, R.y0+20, R.y1-20);

  const roll = S.rng();
  let kind = 'good';
  if(roll < 0.18) kind = 'junk';
  else if(roll < 0.23) kind = 'star';
  else if(roll < 0.28) kind = 'shield';

  let base = 58;
  if(S.diff==='easy') base = 62;
  if(S.diff==='hard') base = 52;
  const size = clamp(base + rint(S.rng, -8, 10), 38, 78);

  let ttl = 1800;
  if(kind==='good') ttl = (S.diff==='hard') ? 1650 : (S.diff==='easy'? 2100 : 1900);
  if(kind==='junk') ttl = (S.diff==='hard') ? 1750 : 2000;
  if(kind==='star') ttl = 1300;
  if(kind==='shield') ttl = 1500;

  const t = createTarget(kind, x, y, size, ttl);

  setTimeout(()=>{
    if(!S.started || S.ended) return;
    const cur = S.targets.get(t.id);
    if(!cur || !cur.alive) return;
    onExpireTarget(cur);
  }, ttl);
}

function onExpireTarget(t){
  if(!t || !t.alive) return;

  if(t.kind === 'good'){
    S.nExpireGood++;
    S.miss_goodExpired++;
    recomputeMiss();

    if(S.__mini && !S.__mini.done && S.__mini.forbidExpire){
      S.__mini.failed = true;
      S.__mini.failReason = 'expire-good';
    }

    bumpBody('gj-good-expire', 160);
    emit('hha:judge', { type:'expire', kind:'good' });
  }

  removeTarget(t);
  updateDynamicsAfterEvent();
  updateHud();
}

// ---------- hit / shoot ----------
function aimAssistPick(x,y,lockPx){
  let best = null;
  let bestD2 = (lockPx*lockPx);

  for(const t of S.targets.values()){
    if(!t.alive) continue;
    const dx = (t.x - x);
    const dy = (t.y - y);
    const d2 = dx*dx + dy*dy;
    if(d2 <= bestD2){
      bestD2 = d2;
      best = t;
    }
  }
  return best;
}

function onHitTarget(id, source, px, py){
  if(!S.started || S.ended) return;
  const t = S.targets.get(id);
  if(!t || !t.alive) return;

  if(t.kind === 'good'){
    S.nHitGood++;
    S.score += (10 + Math.min(10, S.combo));
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);

    setFever(S.fever - S.feverDown);

    onProgress('goodHit');

    if(S.__mini && !S.__mini.done){
      S.__mini.gotGood++;
    }

    bumpBody('gj-mini-clear', 110);
    WIN.Particles?.popText?.(px, py, '+GOOD', 'score');
    WIN.Particles?.burstAt?.(px, py, 'star');

    emit('hha:judge', { type:'hit', kind:'good', source });
  }
  else if(t.kind === 'junk'){
    if(S.shield > 0){
      S.shield--;
      S.nHitJunkGuard++;
      setFever(S.fever + Math.max(3, S.feverUp-2));
      S.combo = 0;

      WIN.Particles?.popText?.(px, py, 'BLOCK', 'big');
      bumpBody('gj-miss-shot', 140);
      emit('hha:judge', { type:'junk-guard', source });
    }else{
      S.nHitJunk++;
      S.miss_junkHit++;
      recomputeMiss();

      setFever(S.fever + S.feverUp);
      S.combo = 0;

      if(S.__mini && !S.__mini.done && S.__mini.forbidJunk){
        S.__mini.failed = true;
        S.__mini.failReason = 'hit-junk';
      }

      bumpBody('gj-junk-hit', 220);
      WIN.Particles?.popText?.(px, py, 'JUNK!', 'big');
      WIN.Particles?.burstAt?.(px, py, 'bad');

      emit('hha:judge', { type:'hit', kind:'junk', source });
    }
  }
  else if(t.kind === 'star'){
    S.score += 25;
    setFever(S.fever - Math.max(6, S.feverDown));
    if(S.__mini && !S.__mini.done) S.__mini.gotStars++;
    onProgress('star');
    WIN.Particles?.popText?.(px, py, '+STAR', 'score');
    WIN.Particles?.burstAt?.(px, py, 'star');
    emit('hha:judge', { type:'hit', kind:'star', source });
  }
  else if(t.kind === 'shield'){
    S.shield = clamp(S.shield + 1, 0, 9);
    if(S.__mini && !S.__mini.done) S.__mini.gotShield++;
    onProgress('shield');
    WIN.Particles?.popText?.(px, py, '+SHIELD', 'score');
    emit('hha:judge', { type:'hit', kind:'shield', source });
  }

  removeTarget(t);
  updateDynamicsAfterEvent();
  computeGrade();
  updateHud();
}

function onShoot(detail){
  if(!S.started || S.ended) return;
  const x = detail?.x ?? (WIN.innerWidth/2);
  const y = detail?.y ?? (WIN.innerHeight/2);
  const lockPx = Number(detail?.lockPx ?? 28);

  const pick = aimAssistPick(x,y,lockPx);
  if(pick){
    onHitTarget(pick.id, detail?.source || 'shoot', x, y);
  }else{
    bumpBody('gj-miss-shot', 120);
    setFever(S.fever + 1);
    emit('hha:judge', { type:'shot-miss', source: detail?.source || 'shoot' });
    updateHud();
  }
}

// ---------- goal progress ----------
function onProgress(ev){
  const g = GOALS[S.goalIndex % GOALS.length];
  if(!g) return;

  if(g.type === 'goodHits' && ev === 'goodHit') S.goalCur++;
  if(g.type === 'combo' && ev === 'goodHit') S.goalCur = Math.max(S.goalCur, S.combo);
  if(g.type === 'surviveMiss'){
    S.goalCur = S.miss_total;
    S.goalTarget = g.target;
    if(S.miss_total > g.target) setFever(S.fever + 10);
  }
  if(g.type === 'stars' && ev === 'star') S.goalCur++;

  if(g.type !== 'surviveMiss'){
    if(S.goalCur >= S.goalTarget){
      completeGoal();
      return;
    }
  }

  pushQuestUpdate('goal-progress');
}

function finalizeSurviveGoalIfNeeded(){
  const g = GOALS[S.goalIndex % GOALS.length];
  if(!g) return;
  if(g.type !== 'surviveMiss') return;

  S.goalCur = S.miss_total;
  S.goalTarget = g.target;
  if(S.miss_total <= g.target){
    S.goalsCleared++;
  }
}

// ---------- adaptive dynamics (play only) ----------
function updateDynamicsAfterEvent(){
  if((S.run||'play') !== 'play') return;

  const pressure = (S.fever/100) + (S.miss_total/10);
  const base = (S.diff==='hard') ? 680 : (S.diff==='easy'? 980 : 820);
  const add = clamp(Math.floor(pressure*180), 0, 240);
  S.spawnEveryMs = clamp(base + add, 540, 1180);

  const baseMax = (S.diff==='hard') ? 6 : (S.diff==='easy'? 3 : 4);
  const reduce = (S.fever > 75) ? 1 : 0;
  S.maxOnScreen = clamp(baseMax - reduce, 2, 7);
}

// ---------- lifecycle ----------
function clearAllTargets(){
  for(const t of Array.from(S.targets.values())){
    removeTarget(t);
  }
  S.targets.clear();
}

function endGame(reason='timeup'){
  if(S.ended) return;
  S.ended = true;
  S.tEndIso = isoNow();

  finalizeSurviveGoalIfNeeded();
  computeGrade();
  updateHud();
  clearAllTargets();
  setLowOverlay(false, 0);

  const summary = makeSummary(reason);
  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

  emit('hha:end', summary);
  DOC.body.classList.remove('show-missions');
  bumpBody('gj-end', 520);
}

function makeSummary(reason){
  return {
    timestampIso: isoNow(),
    projectTag: 'HeroHealth-GoodJunkVR',
    runMode: S.run,
    studyId: S.studyId,
    phase: S.phase,
    conditionGroup: S.conditionGroup,

    gameMode: 'goodjunk',
    diff: S.diff,
    durationPlannedSec: S.timePlanSec,
    durationPlayedSec: Math.max(0, Math.round(S.timePlanSec - S.tLeftSec)),
    scoreFinal: S.score,
    comboMax: S.comboMax,

    misses: S.miss_total,
    miss_goodExpired: S.miss_goodExpired,
    miss_junkHit: S.miss_junkHit,

    goalsCleared: S.goalsCleared,
    goalsTotal: S.goalsTotal,
    miniCleared: S.miniCleared,
    miniTotal: S.miniTotal,

    nHitGood: S.nHitGood,
    nHitJunk: S.nHitJunk,
    nHitJunkGuard: S.nHitJunkGuard,
    nExpireGood: S.nExpireGood,

    grade: S.grade,
    feverEnd: S.fever,
    shieldEnd: S.shield,

    device: S.view,
    gameVersion: 'gj-safe-2026-01-14a',
    reason,
    startTimeIso: S.tStartIso,
    endTimeIso: S.tEndIso,
    seed: S.seedStr,
  };
}

function tick(){
  if(!S.started || S.ended) return;
  const t = nowMs();
  const dt = Math.min(0.25, Math.max(0.0, (t - S.lastTickMs)/1000));
  S.lastTickMs = t;

  S.tLeftSec = Math.max(0, S.tLeftSec - dt);

  const secLeft = Math.ceil(S.tLeftSec);
  if(secLeft <= 5 && secLeft >= 1){
    setLowOverlay(true, secLeft);
    if(!S.lowShown){
      S.lowShown = true;
      emit('hha:coach', { type:'low-time', secLeft });
    }
  }else{
    setLowOverlay(false, 0);
  }

  if(t - S.lastSpawnMs >= S.spawnEveryMs){
    S.lastSpawnMs = t;
    spawnOne();
  }

  tickMiniProgress();

  setText(el.hudTime, Math.max(0, secLeft));
  emit('hha:time', { tLeftSec: S.tLeftSec });

  if(S.tLeftSec <= 0){
    endGame('timeup');
    return;
  }

  requestAnimationFrame(tick);
}

// ---------- entry boot ----------
export function boot(opts = {}){
  bindDom();

  S.view = String(opts.view || qs('view','mobile') || 'mobile').toLowerCase();
  S.run  = String(opts.run  || qs('run','play') || 'play').toLowerCase();
  S.diff = String(opts.diff || qs('diff','normal') || 'normal').toLowerCase();
  S.timePlanSec = Number(opts.time ?? qs('time','80') ?? 80) || 80;
  S.tLeftSec = S.timePlanSec;

  S.hub = opts.hub ?? qs('hub', null);
  S.studyId = opts.studyId ?? qs('studyId', qs('study', null));
  S.phase = opts.phase ?? qs('phase', null);
  S.conditionGroup = opts.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const seedQ = opts.seed ?? qs('seed', null);
  if((S.run !== 'play') && !seedQ){
    S.seedStr = `${S.studyId || 'study'}-${S.timePlanSec}-${S.diff}`;
  }else{
    S.seedStr = String(seedQ ?? Date.now());
  }
  const rngObj = makeRng(S.seedStr);
  S.rng = rngObj.rnd;
  S.seedStr = rngObj.seedStr;

  applyDifficulty();

  S.goalIndex = 0;
  S.miniIndex = 0;
  S.goalsCleared = 0;
  S.miniCleared = 0;
  startGoal();
  startMini();

  setFever(18);
  S.shield = 0;

  if(el.btnBackHub){
    el.btnBackHub.addEventListener('click', ()=>{
      if(S.hub) location.href = S.hub;
      else alert('ยังไม่ได้ใส่ hub url');
    });
  }

  WIN.addEventListener('hha:shoot', (e)=> onShoot(e.detail), { passive:true });
  DOC.addEventListener('touchmove', (e)=>{ if(S.view==='cvr') e.preventDefault(); }, { passive:false });

  S.started = true;
  S.ended = false;
  S.tStartIso = isoNow();
  S.lastTickMs = nowMs();
  S.lastSpawnMs = nowMs();

  updateHud();
  pushQuestUpdate('boot');

  emit('hha:start', {
    view:S.view, run:S.run, diff:S.diff, time:S.timePlanSec,
    seed:S.seedStr, hub:S.hub, studyId:S.studyId, phase:S.phase, conditionGroup:S.conditionGroup,
    gameVersion:'gj-safe-2026-01-14a'
  });

  requestAnimationFrame(tick);
}