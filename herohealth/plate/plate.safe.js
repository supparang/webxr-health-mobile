// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PRODUCTION, single-file, no imports)
// ✅ Works with your /herohealth/plate-vr.html (IDs match)
// ✅ FIX: tap-on-target like GoodJunk (raycast at touch point + VR cursor click)
// ✅ FIX: NO import initCloudLogger (uses window.HHACloudLogger IIFE)
// ✅ Targets are world entities (.plateTarget) so VR gaze/cursor works
// ✅ Goals(2) + Minis(chain) + Fever + Shield + Grade SSS/SS/S/A/B/C + Result modal
// ✅ Mobile: enable drag look (touchEnabled:true) + magicWindow
// ✅ Safer spawning (not giant full-screen): distance + scale clamp

'use strict';

const ROOT = window;
const DOC = document;

const AFRAME = ROOT.AFRAME;
const THREE = ROOT.THREE;

if (!AFRAME || !THREE) {
  console.error('[PlateVR] AFRAME/THREE missing');
  throw new Error('AFRAME/THREE missing');
}

// ---------- helpers ----------
const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const nowMs = () => performance.now();
const qs = new URL(location.href).searchParams;

function $(id){ return DOC.getElementById(id); }

function safeText(el, txt){ if (el) el.textContent = String(txt ?? ''); }
function safeShow(el, on){ if (el) el.style.display = on ? '' : 'none'; }

function isUiClickTarget(t){
  if (!t) return false;
  if (t.closest && t.closest('#hudTop, #hudLeft, #hudRight, #hudBottom, #resultBackdrop')) return true;
  return false;
}

function vib(ms=15){
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch(_) {}
}

// Particles (IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

// ---------- HUD refs ----------
const HUD = {
  time: $('hudTime'),
  score: $('hudScore'),
  combo: $('hudCombo'),
  miss: $('hudMiss'),
  feverBar: $('hudFever'),
  feverPct: $('hudFeverPct'),
  grade: $('hudGrade'),
  mode: $('hudMode'),
  diff: $('hudDiff'),
  groupsHave: $('hudGroupsHave'),
  perfect: $('hudPerfectCount'),
  goalLine: $('hudGoalLine'),
  miniLine: $('hudMiniLine'),
  miniHint: $('hudMiniHint'),
  paused: $('hudPaused'),

  btnEnterVR: $('btnEnterVR'),
  btnPause: $('btnPause'),
  btnRestart: $('btnRestart'),

  resultBackdrop: $('resultBackdrop'),
  btnPlayAgain: $('btnPlayAgain'),

  rMode: $('rMode'),
  rGrade: $('rGrade'),
  rScore: $('rScore'),
  rMaxCombo: $('rMaxCombo'),
  rMiss: $('rMiss'),
  rPerfect: $('rPerfect'),
  rGoals: $('rGoals'),
  rMinis: $('rMinis'),
  rG1: $('rG1'),
  rG2: $('rG2'),
  rG3: $('rG3'),
  rG4: $('rG4'),
  rG5: $('rG5'),
  rGTotal: $('rGTotal'),
};

// ---------- scene refs ----------
const scene = DOC.querySelector('a-scene');
const worldTargets = DOC.getElementById('worldTargets');
const rig = DOC.getElementById('rig');
const cam = DOC.getElementById('cam');
const cursor = DOC.getElementById('cursor');

const raycaster = new THREE.Raycaster();
raycaster.far = 50;

// ---------- logger (IIFE) ----------
function logSession(detail){
  try { ROOT.dispatchEvent(new CustomEvent('hha:log_session', { detail })); } catch(_) {}
}
function logEvent(detail){
  try { ROOT.dispatchEvent(new CustomEvent('hha:log_event', { detail })); } catch(_) {}
}
function loggerInitFromPage(){
  // hha-cloud-logger.js auto-init already, but keep safe
  try {
    const L = ROOT.HHACloudLogger;
    if (L && typeof L.init === 'function') L.init({ endpoint: L.endpoint || (qs.get('log')||''), debug: (qs.get('debug')==='1') });
  } catch(_) {}
}

// ---------- configs ----------
const GROUPS = [
  { id:'g1', name:'โปรตีน', emoji:'🍗' }, // หมู่ 1
  { id:'g2', name:'คาร์บ',   emoji:'🍚' }, // หมู่ 2
  { id:'g3', name:'ผัก',     emoji:'🥦' }, // หมู่ 3
  { id:'g4', name:'ผลไม้',   emoji:'🍎' }, // หมู่ 4
  { id:'g5', name:'ไขมัน',   emoji:'🥑' }, // หมู่ 5
];

const JUNK = ['🍟','🍭','🍩','🧁','🍔','🥤'];
const GOLD = '⭐';
const SLOW = '🐢';
const TIMEPLUS = '⏱️';
const BOMB = '💣';

const DIFF_TABLE = {
  easy:   { spawnMs: 1200, lifeMs: 2200, maxActive: 2, scale: 1.05, junkRate: 0.18, goldRate: 0.10, slowRate: 0.06, timeRate: 0.07, bombRate: 0.05, aimAssist: 0.35 },
  normal: { spawnMs:  980, lifeMs: 1900, maxActive: 3, scale: 0.92, junkRate: 0.24, goldRate: 0.10, slowRate: 0.06, timeRate: 0.06, bombRate: 0.07, aimAssist: 0.25 },
  hard:   { spawnMs:  820, lifeMs: 1650, maxActive: 4, scale: 0.80, junkRate: 0.32, goldRate: 0.09, slowRate: 0.06, timeRate: 0.05, bombRate: 0.10, aimAssist: 0.18 },
};

const FEVER_MAX = 100;

// ---------- state ----------
const S = {
  started: false,
  paused: false,
  ended: false,

  runMode: 'play',
  diffKey: 'normal',
  diff: DIFF_TABLE.normal,

  tStart: 0,
  tLeft: 70,
  baseTime: 70,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  perfect: 0,

  fever: 0,
  shield: 0, // seconds remaining
  shieldUntil: 0,

  platesCleared: 0,
  haveSet: new Set(), // group ids collected in current plate

  // goals/minis
  goals: [],
  goalIndex: 0,
  goalsCleared: 0,

  minis: [],
  miniCount: 0,
  miniActive: null,

  // active targets
  targets: [], // {ent, born, dieAt, kind, groupId}
  lastSpawnAt: 0,

  slowUntil: 0,

  // stats
  gCount: { g1:0,g2:0,g3:0,g4:0,g5:0 },
  gold: 0,
  junkHit: 0,
  bombHit: 0,

  // loop
  raf: 0,
};

// ---------- difficulty / mode ----------
function readRunContext(){
  // hub may set these
  const ss = sessionStorage;
  const fromSSMode = (ss.getItem('HHA_RUNMODE') || '').toLowerCase();
  const fromSSDiff = (ss.getItem('HHA_DIFF') || '').toLowerCase();

  const qMode = (qs.get('mode') || '').toLowerCase();
  const qDiff = (qs.get('diff') || '').toLowerCase();
  const qTime = Number(qs.get('time') || 0);

  S.runMode = (qMode || fromSSMode || 'play');
  if (S.runMode !== 'research') S.runMode = 'play';

  S.diffKey = (qDiff || fromSSDiff || 'normal');
  if (!DIFF_TABLE[S.diffKey]) S.diffKey = 'normal';
  S.diff = DIFF_TABLE[S.diffKey];

  S.baseTime = (qTime > 10 ? qTime : (S.runMode === 'research' ? 70 : 70));
  S.tLeft = S.baseTime;

  safeText(HUD.mode, S.runMode === 'research' ? 'Research' : 'Play');
  safeText(HUD.diff, S.diffKey[0].toUpperCase() + S.diffKey.slice(1));
}

function enableLookControls(){
  try {
    if (!cam) return;
    // override HTML (was touchEnabled:false)
    cam.setAttribute('look-controls',
      'touchEnabled:true; mouseEnabled:true; pointerLockEnabled:false; magicWindowTrackingEnabled:true');
  } catch(_) {}
}

// ---------- grade ----------
function calcGrade(){
  // simple + stable
  const s = S.score;
  const m = S.miss;
  const pc = S.perfect;
  const pl = S.platesCleared;

  // score baseline per 70s run ~ 1200-2500
  let tier = 0;
  if (s >= 2600) tier = 5;
  else if (s >= 2100) tier = 4;
  else if (s >= 1600) tier = 3;
  else if (s >= 1100) tier = 2;
  else if (s >= 700) tier = 1;
  else tier = 0;

  // penalties / bonuses
  tier += Math.min(2, (pl >= 2 ? 1 : 0) + (pl >= 3 ? 1 : 0));
  tier += (pc >= 8 ? 1 : 0);
  tier -= Math.min(3, Math.floor(m / 3));

  tier = clamp(tier, 0, 5);

  return ['C','B','A','S','SS','SSS'][tier];
}

// ---------- fever/shield ----------
function isShieldOn(){
  return (S.shield > 0) && (nowMs() < S.shieldUntil);
}
function setShield(sec){
  S.shield = Math.max(0, sec|0);
  S.shieldUntil = nowMs() + S.shield * 1000;
  // (HUD shield not in your HTML; keep internal only)
}
function addFever(d){
  S.fever = clamp(S.fever + (Number(d)||0), 0, FEVER_MAX);

  if (S.fever >= FEVER_MAX) {
    // auto reward
    S.fever = FEVER_MAX;
    // short shield + celebrate
    if (!isShieldOn()) setShield(6);
    try { Particles.celebrate && Particles.celebrate('FEVER'); } catch(_) {}
    // keep fever from staying full forever: drain a bit after reward
    S.fever = 70;
  }
}

// ---------- perfect detection ----------
function computePerfectFromUV(intersection){
  // center zone on plane
  const uv = intersection && intersection.uv;
  if (!uv) return false;
  const dx = uv.x - 0.5;
  const dy = uv.y - 0.5;
  const r = Math.sqrt(dx*dx + dy*dy);
  return r <= 0.18; // inner "sweet spot"
}

// ---------- world to screen ----------
function worldToScreen(v3){
  const v = v3.clone();
  const cam3 = scene && scene.camera;
  if (!cam3) return { x: innerWidth/2, y: innerHeight/2 };
  v.project(cam3);
  return {
    x: (v.x * 0.5 + 0.5) * innerWidth,
    y: (-v.y * 0.5 + 0.5) * innerHeight
  };
}

// ---------- raycast ----------
function raycastAtScreen(clientX, clientY){
  if (!raycaster || !scene || !scene.camera) return null;

  const W = Math.max(1, ROOT.innerWidth);
  const H = Math.max(1, ROOT.innerHeight);

  const ndc = {
    x: (clientX / W) * 2 - 1,
    y: -((clientY / H) * 2 - 1)
  };

  raycaster.setFromCamera(ndc, scene.camera);

  const meshes = [];
  for (const t of S.targets) {
    const m = t.ent && t.ent.getObject3D && t.ent.getObject3D('mesh');
    if (m) meshes.push(m);
  }
  if (!meshes.length) return null;

  const hits = raycaster.intersectObjects(meshes, true);
  return (hits && hits.length) ? hits[0] : null;
}

function centerRaycast(){
  return raycastAtScreen(innerWidth/2, innerHeight/2);
}

// ---------- scoring / fx ----------
function addScore(delta, tag){
  delta = (delta|0);
  S.score += delta;
  if (tag) {
    try {
      Particles.scorePop && Particles.scorePop(String(delta), tag);
    } catch(_) {}
  }
}
function setCombo(v){
  S.combo = Math.max(0, v|0);
  if (S.combo > S.comboMax) S.comboMax = S.combo;
}
function incMiss(){
  S.miss++;
  setCombo(0);
  addFever(-10);
}

// ---------- target entity ----------
function stampEntityOnMesh(ent){
  try {
    ent.object3D.traverse((o) => {
      if (!o.userData) o.userData = {};
      o.userData._plateEntity = ent;
    });
  } catch(_) {}
}

function makeTargetEntity(spec){
  // spec: {kind, emoji, groupId, label, scale}
  const ent = DOC.createElement('a-entity');
  ent.classList.add('plateTarget');

  // billboard face camera
  ent.setAttribute('billboard', '');
  // visual: plane bg + border + emoji text
  ent.setAttribute('geometry', 'primitive:plane; width:0.85; height:0.85');
  ent.setAttribute('material', 'shader:flat; transparent:true; opacity:0.92; color:#0b1120');
  ent.setAttribute('class', 'plateTarget');

  // slight rounded illusion using extra ring (optional)
  const ring = DOC.createElement('a-ring');
  ring.setAttribute('radius-inner', '0.32');
  ring.setAttribute('radius-outer', '0.41');
  ring.setAttribute('material', 'shader:flat; transparent:true; opacity:0.55; color:#ffffff');
  ring.setAttribute('position', '0 0 0.01');
  ent.appendChild(ring);

  const text = DOC.createElement('a-text');
  text.setAttribute('value', spec.emoji || '🍽️');
  text.setAttribute('align', 'center');
  text.setAttribute('baseline', 'center');
  text.setAttribute('color', '#ffffff');
  text.setAttribute('shader', 'msdf');
  text.setAttribute('negate', 'false');
  text.setAttribute('width', '2.6');
  text.setAttribute('position', '0 0 0.02');
  ent.appendChild(text);

  // data
  ent.dataset.kind = spec.kind || 'group';
  ent.dataset.groupId = spec.groupId || '';
  ent.dataset.label = spec.label || '';

  // click from A-Frame cursor (VR/gaze)
  ent.addEventListener('click', (evt) => {
    if (!S.started || S.paused || S.ended) return;
    const inter = evt && evt.detail && evt.detail.intersection;
    if (inter) handleHit(inter);
  });

  // pulse
  ent.setAttribute('animation__pulse', 'property:scale; dur:520; dir:alternate; loop:true; to:1.06 1.06 1.06; easing:easeInOutSine');

  // scale clamp (avoid giant full-screen)
  const base = spec.scale || 1.0;
  const finalScale = clamp(base, 0.55, 1.25);
  ent.setAttribute('scale', `${finalScale} ${finalScale} ${finalScale}`);

  // after loaded, stamp userData
  ent.addEventListener('loaded', () => stampEntityOnMesh(ent));
  // for immediate (A-Frame often creates mesh later, so also retry)
  setTimeout(() => stampEntityOnMesh(ent), 0);
  setTimeout(() => stampEntityOnMesh(ent), 120);

  return ent;
}

// Billboard component (simple)
AFRAME.registerComponent('billboard', {
  tick: function () {
    const cam3 = this.el.sceneEl && this.el.sceneEl.camera;
    if (!cam3) return;
    this.el.object3D.lookAt(cam3.position);
  }
});

// ---------- spawn / despawn ----------
function clearAllTargets(){
  for (const t of S.targets) {
    try { t.ent.parentNode && t.ent.parentNode.removeChild(t.ent); } catch(_) {}
  }
  S.targets.length = 0;
}

function spawnOne(){
  if (!worldTargets) return;
  if (S.targets.length >= S.diff.maxActive) return;

  const tNow = nowMs();
  const slowOn = tNow < S.slowUntil;

  // choose kind
  const r = Math.random();
  let kind = 'group';
  if (r < S.diff.bombRate) kind = 'bomb';
  else if (r < S.diff.bombRate + S.diff.junkRate) kind = 'junk';
  else if (r < S.diff.bombRate + S.diff.junkRate + S.diff.goldRate) kind = 'gold';
  else if (r < S.diff.bombRate + S.diff.junkRate + S.diff.goldRate + S.diff.slowRate) kind = 'slow';
  else if (r < S.diff.bombRate + S.diff.junkRate + S.diff.goldRate + S.diff.slowRate + S.diff.timeRate) kind = 'time';
  else kind = 'group';

  let emoji = '🍽️';
  let groupId = '';
  let label = '';

  if (kind === 'group') {
    // encourage missing groups first
    const missing = GROUPS.filter(g => !S.haveSet.has(g.id));
    const g = missing.length ? pick(missing) : pick(GROUPS);
    groupId = g.id;
    emoji = g.emoji;
    label = g.name;
  } else if (kind === 'junk') {
    emoji = pick(JUNK);
    label = 'junk';
  } else if (kind === 'gold') {
    emoji = GOLD;
    label = 'gold';
  } else if (kind === 'slow') {
    emoji = SLOW;
    label = 'slow';
  } else if (kind === 'time') {
    emoji = TIMEPLUS;
    label = 'time+';
  } else if (kind === 'bomb') {
    emoji = BOMB;
    label = 'bomb';
  }

  // distance + spherical placement (avoid too close)
  const R = 2.35; // ✅ not giant
  const yaw = rnd(-55, 55) * Math.PI/180;
  const pitch = rnd(-20, 26) * Math.PI/180;

  const x = Math.sin(yaw) * R;
  const y = 1.55 + Math.sin(pitch) * 0.9;
  const z = -Math.cos(yaw) * R;

  const scale = (S.diff.scale * (kind === 'gold' ? 0.86 : 1.0) * (kind === 'bomb' ? 0.92 : 1.0));
  const ent = makeTargetEntity({ kind, emoji, groupId, label, scale });

  ent.setAttribute('position', `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);

  // add
  worldTargets.appendChild(ent);

  // lifetime (slow extends)
  const life = (slowOn ? (S.diff.lifeMs * 1.35) : S.diff.lifeMs);
  const born = tNow;
  const dieAt = tNow + life;

  S.targets.push({ ent, born, dieAt, kind, groupId });

  // appear pop
  ent.setAttribute('scale', `0.01 0.01 0.01`);
  setTimeout(() => {
    const s = clamp(scale, 0.55, 1.25);
    ent.setAttribute('scale', `${s} ${s} ${s}`);
  }, 0);
}

function despawnTarget(t, reason){
  try {
    // fade + shrink
    t.ent.setAttribute('animation__bye', 'property:scale; dur:130; to:0.01 0.01 0.01; easing:easeInQuad');
    setTimeout(() => { try { t.ent.remove(); } catch(_) {} }, 150);
  } catch(_) {
    try { t.ent.remove(); } catch(_) {}
  }

  // remove from list
  const idx = S.targets.indexOf(t);
  if (idx >= 0) S.targets.splice(idx, 1);

  if (reason === 'expired') {
    // miss only if it was a "good group" (align GoodJunk-ish: good expired counts)
    if (t.kind === 'group' || t.kind === 'gold' || t.kind === 'time' || t.kind === 'slow') {
      incMiss();
      logEvent({ type:'miss', why:'expired', kind:t.kind, groupId:t.groupId || '', t:Date.now() });
    }
  }
}

// ---------- goals / minis ----------
function buildGoals(){
  // 2 goals/run (GoodJunk style)
  // g1: clear balanced plates N
  // g2: reach score target
  const nPlates = (S.diffKey === 'easy') ? 2 : (S.diffKey === 'normal' ? 2 : 3);
  const scoreT  = (S.diffKey === 'easy') ? 1100 : (S.diffKey === 'normal' ? 1600 : 2100);

  S.goals = [
    {
      id:'g1', label:`🍽️ เคลียร์ “จานสมดุล” ให้ได้ ${nPlates} ใบ`,
      hint:'เก็บให้ครบ 5 หมู่ (1–5) เพื่อปิดจาน',
      eval: ()=> S.platesCleared,
      tgt: nPlates
    },
    {
      id:'g2', label:`⭐ ทำคะแนนให้ถึง ${scoreT}`,
      hint:'Perfect + Combo ช่วยดันคะแนนแรง!',
      eval: ()=> S.score,
      tgt: scoreT
    }
  ];
  S.goalIndex = 0;
  S.goalsCleared = 0;
}

function goalText(){
  const g = S.goals[S.goalIndex];
  if (!g) return '…';
  const v = g.eval();
  return `Goal ${S.goalIndex+1}/${S.goals.length}: ${g.label} (${Math.min(v,g.tgt)}/${g.tgt})`;
}
function checkGoalProgress(){
  const g = S.goals[S.goalIndex];
  if (!g) return;
  const v = g.eval();
  if (v >= g.tgt) {
    S.goalsCleared++;
    try { Particles.celebrate && Particles.celebrate('GOAL'); } catch(_) {}
    logEvent({ type:'goal_pass', goalId:g.id, t:Date.now() });

    S.goalIndex++;
    if (S.goalIndex >= S.goals.length) {
      // all goals done (but keep playing until time ends)
      S.goalIndex = S.goals.length - 1;
    }
  }
}

function buildMiniPool(){
  // chain minis (GoodJunk vibe)
  S.minis = [
    {
      id:'m1', name:'Plate Rush (8s)',
      hint:'ทำจานนี้ให้ครบ 5 หมู่ใน 8 วิ • ห้ามโดนขยะระหว่างทำ ✅',
      dur: 8000,
      start: ()=> ({ startPlates: S.platesCleared, startMiss: S.miss, ok:true }),
      tick: (st)=> {
        st.ok = (S.miss === st.startMiss);
        const clearedNow = (S.platesCleared - st.startPlates);
        return { done: clearedNow >= 1, pass: clearedNow >= 1 && st.ok, prog: `${clearedNow}/1`, left: miniLeftMs() };
      },
      rewardPass: ()=> { addScore(260,'MINI'); addFever(18); setShield(4); },
      rewardFail: ()=> { addScore(-60,'FAIL'); addFever(-8); },
    },
    {
      id:'m2', name:'Perfect Streak',
      hint:'ทำ Perfect ติดกัน 5 ครั้ง (พลาดแล้วนับใหม่)!',
      dur: 11000,
      start: ()=> ({ need: 5, streak: 0 }),
      onPerfect: (st)=> { st.streak++; },
      onNotPerfect: (st)=> { st.streak = 0; },
      tick: (st)=> ({ done: st.streak >= st.need, pass: st.streak >= st.need, prog: `${st.streak}/${st.need}`, left: miniLeftMs() }),
      rewardPass: ()=> { addScore(300,'PERFECT'); addFever(22); },
      rewardFail: ()=> { addScore(-40,'FAIL'); },
    },
    {
      id:'m3', name:'Gold Hunt (12s)',
      hint:'เก็บ ⭐ Gold ให้ได้ 2 อันภายในเวลา!',
      dur: 12000,
      start: ()=> ({ got: 0, need: 2 }),
      onGold: (st)=> { st.got++; },
      tick: (st)=> ({ done: st.got >= st.need, pass: st.got >= st.need, prog: `${st.got}/${st.need}`, left: miniLeftMs() }),
      rewardPass: ()=> { addScore(280,'GOLD'); addFever(16); },
      rewardFail: ()=> { addScore(-50,'FAIL'); },
    },
  ];
}

function startMini(){
  // do not overlap; start every ~18s if possible
  if (S.miniActive) return;
  const def = pick(S.minis);
  const st = def.start ? def.start() : {};
  S.miniActive = {
    def,
    st,
    t0: nowMs(),
    tEnd: nowMs() + def.dur
  };
  logEvent({ type:'mini_start', miniId:def.id, t:Date.now() });
}

function miniLeftMs(){
  if (!S.miniActive) return 0;
  return Math.max(0, (S.miniActive.tEnd - nowMs())|0);
}

function finishMini(pass){
  const m = S.miniActive;
  if (!m) return;

  S.miniCount++;

  if (pass) {
    try { m.def.rewardPass && m.def.rewardPass(); } catch(_) {}
    try { Particles.celebrate && Particles.celebrate('MINI'); } catch(_) {}
    logEvent({ type:'mini_pass', miniId:m.def.id, t:Date.now() });
  } else {
    try { m.def.rewardFail && m.def.rewardFail(); } catch(_) {}
    logEvent({ type:'mini_fail', miniId:m.def.id, t:Date.now() });
  }

  S.miniActive = null;
}

function miniOnPerfect(isPerfect){
  const m = S.miniActive;
  if (!m) return;
  if (m.def.id === 'm2') {
    if (isPerfect) m.def.onPerfect(m.st);
    else m.def.onNotPerfect(m.st);
  }
}

// ---------- hit handling (GOODJUNK style tap) ----------
function handleHit(intersection){
  const ent = intersection?.object?.userData?._plateEntity;
  if (!ent) return;

  // find target record
  let rec = null;
  for (const t of S.targets) {
    if (t.ent === ent) { rec = t; break; }
  }
  if (!rec) return;

  const kind = rec.kind;
  const groupId = rec.groupId || '';
  const isPerfect = computePerfectFromUV(intersection);

  // screen position for FX
  const posWorld = intersection?.point ? intersection.point.clone() : ent.object3D.position.clone();
  const sp = worldToScreen(posWorld);

  // burst
  try { Particles.burstAt(sp.x, sp.y, (kind==='junk'||kind==='bomb') ? 'BAD' : 'GOOD'); } catch(_) {}

  // time effects
  if (kind === 'time') {
    S.tLeft += 3;
    addScore(70,'TIME');
    addFever(8);
  } else if (kind === 'slow') {
    S.slowUntil = nowMs() + 6000;
    addScore(60,'SLOW');
    addFever(8);
  } else if (kind === 'gold') {
    S.gold++;
    addScore(150,'GOLD');
    addFever(10);
    if (S.miniActive && S.miniActive.def.id === 'm3') {
      try { S.miniActive.def.onGold(S.miniActive.st); } catch(_) {}
    }
  } else if (kind === 'bomb') {
    if (isShieldOn()) {
      addScore(20,'BLOCK');
      addFever(6);
      // no miss
    } else {
      S.bombHit++;
      addScore(-120,'BAD');
      incMiss();
      vib(30);
    }
  } else if (kind === 'junk') {
    if (isShieldOn()) {
      addScore(15,'BLOCK');
      addFever(6);
      // no miss
    } else {
      S.junkHit++;
      addScore(-60,'BAD');
      incMiss();
      vib(20);
    }
  } else if (kind === 'group') {
    // good hit
    const base = 55;
    const comboBonus = Math.min(150, S.combo * 8);
    const perfectBonus = isPerfect ? 40 : 0;

    addScore(base + comboBonus + perfectBonus, isPerfect ? 'PERFECT' : 'GOOD');

    if (isPerfect) {
      S.perfect++;
      addFever(10);
    } else {
      addFever(6);
    }

    setCombo(S.combo + 1);
    miniOnPerfect(isPerfect);

    // collect group
    if (groupId && !S.haveSet.has(groupId)) {
      S.haveSet.add(groupId);
      S.gCount[groupId] = (S.gCount[groupId]||0) + 1;
    }

    // plate cleared?
    if (S.haveSet.size >= 5) {
      S.platesCleared++;
      // celebrate
      try { Particles.celebrate && Particles.celebrate('PLATE'); } catch(_) {}
      addScore(220,'PLATE');
      addFever(14);

      // reset set
      S.haveSet.clear();
    }
  }

  // despawn
  despawnTarget(rec, 'hit');

  // update goal, mini status
  checkGoalProgress();
}

function shoot(){ // crosshair shoot
  if (!S.started || S.paused || S.ended) return;
  const hit = centerRaycast();
  if (!hit) return;
  handleHit(hit);
}

function shootAt(x, y){ // ✅ tap-on-target like GoodJunk
  if (!S.started || S.paused || S.ended) return;

  const hit = raycastAtScreen(x, y);
  if (hit) return handleHit(hit);

  // aim assist fallback (feel "magnet" a bit)
  if (Math.random() < S.diff.aimAssist) {
    const mid = centerRaycast();
    if (mid) handleHit(mid);
  }
}

// ---------- loop ----------
function updateHUD(){
  safeText(HUD.time, Math.max(0, Math.ceil(S.tLeft)));
  safeText(HUD.score, S.score|0);
  safeText(HUD.combo, S.combo|0);
  safeText(HUD.miss, S.miss|0);
  safeText(HUD.perfect, S.perfect|0);

  const pct = clamp(Math.round((S.fever/FEVER_MAX)*100), 0, 100);
  if (HUD.feverBar) HUD.feverBar.style.width = pct + '%';
  safeText(HUD.feverPct, pct + '%');

  const g = calcGrade();
  safeText(HUD.grade, g);

  safeText(HUD.groupsHave, `${S.haveSet.size}/5`);

  safeText(HUD.goalLine, goalText());

  // mini
  if (!S.miniActive) {
    safeText(HUD.miniLine, '…');
    safeText(HUD.miniHint, '…');
  } else {
    const def = S.miniActive.def;
    const st = S.miniActive.st;
    let prog = '';
    try {
      const r = def.tick ? def.tick(st) : null;
      if (r && r.prog != null) prog = r.prog;
    } catch(_) {}

    const left = (miniLeftMs()/1000);
    safeText(HUD.miniLine, `MINI: ${def.name} • ${prog} • ${left.toFixed(1)}s`);
    safeText(HUD.miniHint, def.hint || '');
  }

  // paused
  safeShow(HUD.paused, !!S.paused);
}

function tickMinis(){
  // start minis periodically
  if (!S.miniActive) {
    // start after 7s from game start, then every ~18-22s chance
    const t = nowMs() - S.tStart;
    if (t > 7000) {
      // gate by time slice
      const slice = Math.floor(t / 18000);
      // start at most once per slice
      if (!S._miniSliceStarted) S._miniSliceStarted = new Set();
      if (!S._miniSliceStarted.has(slice)) {
        S._miniSliceStarted.add(slice);
        startMini();
      }
    }
  }

  if (S.miniActive) {
    const def = S.miniActive.def;
    const st = S.miniActive.st;

    // timeout / pass check
    let r = null;
    try { r = def.tick ? def.tick(st) : null; } catch(_) {}

    const timeUp = nowMs() >= S.miniActive.tEnd;
    const done = !!(r && r.done);
    if (done) return finishMini(!!r.pass);
    if (timeUp) return finishMini(false);
  }
}

function tickSpawns(){
  const t = nowMs();
  const slowOn = t < S.slowUntil;

  const spawnMs = slowOn ? (S.diff.spawnMs * 1.25) : S.diff.spawnMs;

  if (!S.lastSpawnAt) S.lastSpawnAt = t;
  if (t - S.lastSpawnAt >= spawnMs) {
    S.lastSpawnAt = t;
    spawnOne();
  }

  // expire
  for (let i = S.targets.length - 1; i >= 0; i--) {
    const tar = S.targets[i];
    if (t >= tar.dieAt) despawnTarget(tar, 'expired');
  }
}

function loop(){
  if (S.ended) return;

  if (!S.paused && S.started) {
    // time
    S.tLeft -= (1/60);
    if (S.tLeft <= 0) {
      S.tLeft = 0;
      endGame();
      return;
    }

    tickSpawns();
    tickMinis();
  }

  updateHUD();
  S.raf = requestAnimationFrame(loop);
}

// ---------- start / end ----------
function resetState(){
  S.started = false;
  S.paused = false;
  S.ended = false;

  S.tLeft = S.baseTime;

  S.score = 0;
  S.combo = 0;
  S.comboMax = 0;
  S.miss = 0;
  S.perfect = 0;

  S.fever = 0;
  S.shield = 0;
  S.shieldUntil = 0;

  S.platesCleared = 0;
  S.haveSet.clear();

  S.goals = [];
  S.goalIndex = 0;
  S.goalsCleared = 0;

  S.miniCount = 0;
  S.miniActive = null;
  S._miniSliceStarted = new Set();

  S.targets.length = 0;
  S.lastSpawnAt = 0;
  S.slowUntil = 0;

  S.gCount = { g1:0,g2:0,g3:0,g4:0,g5:0 };
  S.gold = 0;
  S.junkHit = 0;
  S.bombHit = 0;

  clearAllTargets();
  safeShow(HUD.resultBackdrop, false);
}

function startGame(){
  if (S.started) return;
  S.started = true;
  S.tStart = nowMs();

  buildGoals();
  buildMiniPool();

  // initial spawn burst
  for (let i=0; i<Math.min(2, S.diff.maxActive); i++) spawnOne();

  logSession({
    game: 'PlateVR',
    mode: S.runMode,
    diff: S.diffKey,
    baseTime: S.baseTime,
    startedAtIso: new Date().toISOString(),
    ua: navigator.userAgent
  });

  logEvent({ type:'start', t:Date.now(), mode:S.runMode, diff:S.diffKey });

  try { Particles.celebrate && Particles.celebrate('START'); } catch(_) {}
}

function endGame(){
  if (S.ended) return;
  S.ended = true;
  S.paused = true;

  clearAllTargets();
  updateHUD();

  const grade = calcGrade();

  safeText(HUD.rMode, S.runMode === 'research' ? 'Research' : 'Play');
  safeText(HUD.rGrade, grade);
  safeText(HUD.rScore, S.score|0);
  safeText(HUD.rMaxCombo, S.comboMax|0);
  safeText(HUD.rMiss, S.miss|0);
  safeText(HUD.rPerfect, S.perfect|0);

  safeText(HUD.rGoals, `${S.goalsCleared}/${S.goals.length}`);
  safeText(HUD.rMinis, `${S.miniCount}/${999}`);

  safeText(HUD.rG1, S.gCount.g1|0);
  safeText(HUD.rG2, S.gCount.g2|0);
  safeText(HUD.rG3, S.gCount.g3|0);
  safeText(HUD.rG4, S.gCount.g4|0);
  safeText(HUD.rG5, S.gCount.g5|0);
  safeText(HUD.rGTotal, (S.gCount.g1+S.gCount.g2+S.gCount.g3+S.gCount.g4+S.gCount.g5)|0);

  safeShow(HUD.resultBackdrop, true);

  logEvent({
    type:'end',
    t:Date.now(),
    score:S.score|0,
    miss:S.miss|0,
    perfect:S.perfect|0,
    comboMax:S.comboMax|0,
    goalsCleared:S.goalsCleared|0,
    minisCleared:S.miniCount|0,
    platesCleared:S.platesCleared|0,
    grade
  });

  // final flush
  try { ROOT.HHACloudLogger && ROOT.HHACloudLogger.flushNow && ROOT.HHACloudLogger.flushNow(true); } catch(_) {}
}

function togglePause(){
  if (!S.started || S.ended) return;
  S.paused = !S.paused;
  safeShow(HUD.paused, !!S.paused);
  logEvent({ type: S.paused ? 'pause' : 'resume', t:Date.now() });
}

function restartGame(){
  resetState();
  updateHUD();
  // start on next tap
}

// ---------- bindings ----------
function bindUI(){
  if (HUD.btnEnterVR) {
    HUD.btnEnterVR.addEventListener('click', async () => {
      try {
        if (!S.started) startGame();
        if (scene && scene.enterVR) await scene.enterVR();
      } catch(e){ console.warn(e); }
    });
  }
  if (HUD.btnPause) HUD.btnPause.addEventListener('click', () => togglePause());
  if (HUD.btnRestart) HUD.btnRestart.addEventListener('click', () => restartGame());
  if (HUD.btnPlayAgain) HUD.btnPlayAgain.addEventListener('click', () => restartGame());

  // Pointer = shootAt (GoodJunk feel)
  DOC.addEventListener('pointerdown', async (e) => {
    if (isUiClickTarget(e.target)) return;
    // first interaction unlock audio if you add later
    if (!S.started) startGame();
    if (!S.paused && !S.ended) shootAt(e.clientX, e.clientY);
  }, { passive:true });

  // keyboard (desktop)
  DOC.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); shoot(); }
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.key.toLowerCase() === 'r') restartGame();
  });
}

function ensureCursorRaycaster(){
  try {
    if (cursor) cursor.setAttribute('raycaster', 'objects:.plateTarget');
  } catch(_) {}
}

// ---------- init ----------
async function boot(){
  readRunContext();
  enableLookControls();
  ensureCursorRaycaster();
  loggerInitFromPage();
  bindUI();
  resetState();
  updateHUD();

  // wait scene ready
  if (scene.hasLoaded) {
    S.raf = requestAnimationFrame(loop);
  } else {
    scene.addEventListener('loaded', () => {
      S.raf = requestAnimationFrame(loop);
    }, { once:true });
  }
}

boot();