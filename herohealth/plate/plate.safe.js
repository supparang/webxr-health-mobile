// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PLAY MODE) — Production-ish, GoodJunk-style
// PATCH 1) Safe-zone กันทับ HUD (top/left/right/bottom) ด้วยการอ่าน rect จริง
// PATCH 2) Touch-look (drag to look) + inertia แบบ GoodJunk
// PATCH 3) Target skin = Emoji จริง + hitbox ตรง + FX/feedback ชัด
//
// Requires (optional, safe if missing):
// - /herohealth/vr/particles.js  => window.Particles (scorePop/burstAt/celebrate)
// - /herohealth/vr/hha-cloud-logger.js => window.HHACloudLogger (auto init)
// - A-Frame is OK but targets are DOM overlay (เหมือน GoodJunk)
//   (VR headset immersive อาจไม่โชว์ DOM overlay — โหมดนี้โฟกัส Mobile/PC ก่อน)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc  = ROOT.document;

const URLX = new URL(location.href);
const QS = (k, d='') => (URLX.searchParams.get(k) ?? d);

const RUN  = String(QS('run','play')).toLowerCase();   // play/research (เผื่อใช้)
const DIFF = String(QS('diff','easy')).toLowerCase();  // easy/normal/hard
const TOTAL_TIME = Math.max(20, parseInt(QS('time','80'),10) || 80);
const DEBUG = (QS('debug','0') === '1');

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

const CloudLogger = ROOT.HHACloudLogger || { init(){}, flushNow(){} };

// -----------------------------
// UI refs
// -----------------------------
const UI = {};
function $id(id){ return doc.getElementById(id); }

function bindUI(){
  UI.hudTime   = $id('hudTime');
  UI.hudScore  = $id('hudScore');
  UI.hudCombo  = $id('hudCombo');
  UI.hudMiss   = $id('hudMiss');
  UI.hudFever  = $id('hudFever');
  UI.hudFeverPct = $id('hudFeverPct');
  UI.hudGrade  = $id('hudGrade');
  UI.hudMode   = $id('hudMode');
  UI.hudDiff   = $id('hudDiff');
  UI.hudGroupsHave = $id('hudGroupsHave');
  UI.hudPerfectCount = $id('hudPerfectCount');

  UI.hudGoalLine = $id('hudGoalLine');
  UI.hudMiniLine = $id('hudMiniLine');
  UI.hudMiniHint = $id('hudMiniHint');

  UI.btnEnterVR = $id('btnEnterVR');
  UI.btnPause   = $id('btnPause');
  UI.btnRestart = $id('btnRestart');

  UI.resultBackdrop = $id('resultBackdrop');
  UI.btnPlayAgain   = $id('btnPlayAgain');

  // result fields
  UI.rMode = $id('rMode');
  UI.rGrade= $id('rGrade');
  UI.rScore= $id('rScore');
  UI.rMaxCombo = $id('rMaxCombo');
  UI.rMiss = $id('rMiss');
  UI.rPerfect = $id('rPerfect');
  UI.rGoals = $id('rGoals');
  UI.rMinis = $id('rMinis');
  UI.rG1 = $id('rG1'); UI.rG2 = $id('rG2'); UI.rG3 = $id('rG3'); UI.rG4 = $id('rG4'); UI.rG5 = $id('rG5');
  UI.rGTotal = $id('rGTotal');
}

function setText(el, v){ if(el) el.textContent = String(v); }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function rnd(a,b){ return a + Math.random()*(b-a); }
function now(){ return performance.now(); }

// -----------------------------
// Inject target styles (GoodJunk-style)
// -----------------------------
function ensureStyle(){
  if (doc.getElementById('plate-safe-style')) return;
  const st = doc.createElement('style');
  st.id = 'plate-safe-style';
  st.textContent = `
    .plate-layer{
      position:fixed; inset:0;
      z-index:880;
      pointer-events:none;
      overflow:hidden;
      transform: translate3d(0,0,0);
      touch-action:none;
    }
    .plate-target{
      position:absolute;
      width: var(--sz, 92px);
      height: var(--sz, 92px);
      margin-left: calc(var(--sz, 92px) * -0.5);
      margin-top:  calc(var(--sz, 92px) * -0.5);
      border-radius: 999px;
      pointer-events:auto;
      user-select:none;
      -webkit-user-select:none;
      display:grid;
      place-items:center;
      transform: translate3d(var(--x, 50vw), var(--y, 50vh), 0) scale(var(--sc, 1));
      will-change: transform, opacity, filter;
      filter: drop-shadow(0 12px 26px rgba(0,0,0,.35));
      opacity: 0;
      animation: pt-pop-in .12s ease-out forwards;
    }
    @keyframes pt-pop-in{
      from{ opacity:0; transform: translate3d(var(--x), var(--y), 0) scale(.65); }
      to  { opacity:1; transform: translate3d(var(--x), var(--y), 0) scale(var(--sc, 1)); }
    }
    .plate-target .ring{
      position:absolute; inset:0;
      border-radius:999px;
      border: 10px solid rgba(34,197,94,.0);
      box-shadow: 0 0 0 rgba(34,197,94,0);
      pointer-events:none;
      opacity:.92;
    }
    .plate-target.good .ring{
      border-color: rgba(34,197,94,.78);
      box-shadow: 0 0 34px rgba(34,197,94,.18), inset 0 0 26px rgba(34,197,94,.12);
    }
    .plate-target.junk .ring{
      border-color: rgba(251,113,133,.78);
      box-shadow: 0 0 34px rgba(251,113,133,.18), inset 0 0 26px rgba(251,113,133,.12);
    }
    .plate-target.gold .ring{
      border-color: rgba(250,204,21,.86);
      box-shadow: 0 0 38px rgba(250,204,21,.22), inset 0 0 28px rgba(250,204,21,.14);
    }
    .plate-target .emoji{
      font-size: calc(var(--sz, 92px) * .54);
      line-height: 1;
      transform: translateY(1px);
      text-shadow: 0 10px 22px rgba(0,0,0,.38);
      pointer-events:none;
    }
    .plate-target .badge{
      position:absolute;
      bottom:-10px; left:50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      border-radius: 999px;
      font-weight: 1000;
      font-size: 12px;
      letter-spacing:.04em;
      background: rgba(2,6,23,.72);
      border: 1px solid rgba(148,163,184,.25);
      color: #e5e7eb;
      pointer-events:none;
      opacity:.92;
      white-space:nowrap;
    }

    /* hit feedback */
    .plate-target.hit{
      animation: pt-hit .16s ease-out forwards;
    }
    @keyframes pt-hit{
      0%{ filter: drop-shadow(0 12px 26px rgba(0,0,0,.35)); }
      40%{ transform: translate3d(var(--x), var(--y), 0) scale(calc(var(--sc,1) * 1.18)); }
      100%{ opacity:0; transform: translate3d(var(--x), var(--y), 0) scale(calc(var(--sc,1) * .72)); }
    }
    .plate-target.miss{
      animation: pt-miss .22s ease-out forwards;
    }
    @keyframes pt-miss{
      0%{ opacity:1; }
      40%{ transform: translate3d(var(--x), var(--y), 0) scale(calc(var(--sc,1) * 1.10)); filter: blur(.2px); }
      100%{ opacity:0; transform: translate3d(var(--x), var(--y), 0) scale(calc(var(--sc,1) * .62)); }
    }

    /* screen edge warning (rush) */
    .plate-warn-edge{
      position:fixed; inset:0;
      z-index:940;
      pointer-events:none;
      box-shadow: inset 0 0 0 rgba(250,204,21,0);
      opacity:0;
      transition: opacity .12s ease;
    }
    .plate-warn-edge.on{
      opacity:1;
      box-shadow: inset 0 0 0 10px rgba(250,204,21,.08), inset 0 0 60px rgba(250,204,21,.12);
    }
  `;
  doc.head.appendChild(st);
}

// -----------------------------
// Difficulty tuning (เร็ว+ใหญ่แบบ easy)
// -----------------------------
const DIFF_TABLE = {
  easy:   { size: 104, rate: 0.92, ttl: 1150, junkP: 0.18, goldP: 0.08, feverGain: 7, feverLose: 10 },
  normal: { size:  92, rate: 0.78, ttl: 1050, junkP: 0.24, goldP: 0.10, feverGain: 6, feverLose: 12 },
  hard:   { size:  82, rate: 0.66, ttl:  960, junkP: 0.30, goldP: 0.12, feverGain: 5, feverLose: 14 }
};
const D = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// -----------------------------
// Game state
// -----------------------------
const S = {
  running: true,
  paused: false,

  t0: 0,
  timeLeft: TOTAL_TIME,

  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,
  perfect: 0,

  fever: 0, // 0..100
  grade: 'C',

  // plate groups
  have: {1:0,2:0,3:0,4:0,5:0},
  plateClears: 0,

  // quest progress
  goalsDone: 0,
  goalsTotal: 2,
  minisDone: 0,
  minisTotal: 7,

  // mini runtime
  mini: null,

  // spawn
  targets: new Map(),
  nextSpawnAt: 0,
  spawnId: 0,

  // view (touch-look)
  yaw: 0,
  pitch: 0,
  vyaw: 0,
  vpitch: 0,
  dragging: false,
  dragX: 0,
  dragY: 0,

  // warnings
  rushWarnOn: false,

  // logger
  sessionId: 'P-' + Math.random().toString(36).slice(2) + '-' + Date.now()
};

// -----------------------------
// Layer + warnings
// -----------------------------
let layer, warnEdge;

function ensureLayer(){
  layer = doc.querySelector('.plate-layer');
  if (!layer) {
    layer = doc.createElement('div');
    layer.className = 'plate-layer';
    doc.body.appendChild(layer);
  }
  warnEdge = doc.querySelector('.plate-warn-edge');
  if (!warnEdge) {
    warnEdge = doc.createElement('div');
    warnEdge.className = 'plate-warn-edge';
    doc.body.appendChild(warnEdge);
  }
}

// -----------------------------
// Safe-zone (อ่าน rect ของ HUD จริง ๆ)
// -----------------------------
function rectOf(el){
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x:r.left, y:r.top, w:r.width, h:r.height, r:r.right, b:r.bottom };
}
function intersect(a,b){
  return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);
}
function getBlockedRects(){
  const rects = [];
  // HUD containers
  const top = rectOf(doc.getElementById('hudTop'));
  const left = rectOf(doc.getElementById('hudLeft'));
  const right = rectOf(doc.getElementById('hudRight'));
  const bottom = rectOf(doc.getElementById('hudBottom'));
  if (top) rects.push(top);
  if (left) rects.push(left);
  if (right) rects.push(right);
  if (bottom) rects.push(bottom);
  return rects;
}
function pickSafeXY(sizePx){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const m = 14; // margin
  const half = sizePx * 0.5;

  const blocked = getBlockedRects();
  const tries = 40;

  for (let i=0;i<tries;i++){
    // base spawn inside viewport with margins
    let x = rnd(m+half, vw-m-half);
    let y = rnd(m+half+60, vh-m-half-60); // กันกลางบน/ล่างนิดหนึ่ง

    // apply view offset (touch-look) — ให้เป้า “อยู่ในโลก” แล้วเลื่อนไปตามมุมมอง
    const off = viewOffset();
    x += off.x;
    y += off.y;

    // convert to screen for safezone test (reverse offset)
    const sx = x - off.x;
    const sy = y - off.y;

    const tr = { x: sx-half, y: sy-half, w: sizePx, h: sizePx };

    let ok = true;
    for (const br of blocked){
      if (intersect(tr, br)) { ok = false; break; }
    }
    if (ok) return { x, y };
  }

  // fallback: center-ish safe
  const off = viewOffset();
  return { x: vw*0.55 + off.x, y: vh*0.55 + off.y };
}

// -----------------------------
// Touch-look (drag to look) + inertia
// -----------------------------
function viewOffset(){
  // yaw/pitch -> pixels offset
  // ปรับความไวให้คล้าย GoodJunk (ไม่เวียนหัว)
  const kx = 28; // px per deg-ish
  const ky = 22;
  const x = -S.yaw * kx;
  const y =  S.pitch * ky;
  return { x, y };
}

function applyView(){
  const off = viewOffset();
  layer.style.transform = `translate3d(${off.x}px, ${off.y}px, 0)`;
}

function bindTouchLook(){
  const el = doc.body;

  function onDown(ev){
    if (!S.running || S.paused) return;
    // ไม่จับลากบนปุ่ม
    const t = ev.target;
    if (t && (t.closest && (t.closest('button') || t.closest('#hudRight')))) return;

    S.dragging = true;
    const p = getPoint(ev);
    S.dragX = p.x; S.dragY = p.y;
  }
  function onMove(ev){
    if (!S.dragging) return;
    const p = getPoint(ev);
    const dx = (p.x - S.dragX);
    const dy = (p.y - S.dragY);
    S.dragX = p.x; S.dragY = p.y;

    // velocity
    S.vyaw   = clamp(S.vyaw   + (-dx * 0.012), -2.2, 2.2);
    S.vpitch = clamp(S.vpitch + ( dy * 0.010), -1.8, 1.8);

    // immediate
    S.yaw   = clamp(S.yaw   + (-dx * 0.020), -10, 10);
    S.pitch = clamp(S.pitch + ( dy * 0.016), -8, 8);

    applyView();
  }
  function onUp(){
    S.dragging = false;
  }

  el.addEventListener('pointerdown', onDown, { passive:true });
  el.addEventListener('pointermove', onMove, { passive:true });
  el.addEventListener('pointerup', onUp, { passive:true });
  el.addEventListener('pointercancel', onUp, { passive:true });
}

function stepInertia(dt){
  // friction
  const fr = Math.pow(0.001, dt); // ~strong friction
  S.vyaw *= fr;
  S.vpitch *= fr;

  if (!S.dragging){
    S.yaw   = clamp(S.yaw   + S.vyaw * (dt*60), -10, 10);
    S.pitch = clamp(S.pitch + S.vpitch * (dt*60), -8, 8);
    applyView();
  }
}

// -----------------------------
// Target content
// -----------------------------
const GROUP_EMOJI = {
  1: ['🍗','🥩','🐟','🍳','🥛','🧀','🥜'],
  2: ['🍚','🍞','🥔','🌽','🥨','🍜'],
  3: ['🥦','🥕','🥬','🥒','🌶️','🍅'],
  4: ['🍎','🍌','🍊','🍉','🍍','🍇'],
  5: ['🥑','🧈','🫒','🥥','🧀']
};
const JUNK_EMOJI = ['🍩','🍟','🍔','🍰','🧁','🍫','🥤','🍿'];
const GOLD_EMOJI = ['⭐','🌟','✨'];

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function computeTargetSize(){
  // adaptive-ish: combo สูง -> เล็กลงนิด, fever สูง -> เร็ว/เล็กลงอีกนิด
  const base = D.size;
  const comboN = clamp(S.combo/12, 0, 1);
  const feverN = clamp(S.fever/100, 0, 1);
  const sz = base * (1 - 0.12*comboN - 0.10*feverN);
  return clamp(sz, 64, 118);
}

function spawnOne(){
  const sz = computeTargetSize();

  const roll = Math.random();
  let kind = 'good';
  let group = (1 + ((Math.random()*5)|0));
  let emoji = pick(GROUP_EMOJI[group]);
  let badge = 'G' + group;

  if (roll < D.junkP) {
    kind = 'junk';
    group = 0;
    emoji = pick(JUNK_EMOJI);
    badge = 'JUNK';
  } else if (roll > 1 - D.goldP) {
    kind = 'gold';
    group = 0;
    emoji = pick(GOLD_EMOJI);
    badge = 'GOLD';
  }

  const pos = pickSafeXY(sz);

  const id = (++S.spawnId);
  const el = doc.createElement('div');
  el.className = `plate-target ${kind}`;
  el.dataset.id = String(id);
  el.dataset.kind = kind;
  el.dataset.group = String(group);
  el.dataset.emoji = emoji;
  el.style.setProperty('--sz', `${sz}px`);
  el.style.setProperty('--x', `${pos.x}px`);
  el.style.setProperty('--y', `${pos.y}px`);
  el.style.setProperty('--sc', `1`);

  el.innerHTML = `
    <div class="ring"></div>
    <div class="emoji">${emoji}</div>
    <div class="badge">${badge}</div>
  `;

  // click/tap to hit (แม้ tap-anywhere ก็จะหาใกล้ๆ crosshair ให้)
  el.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    onHit(el, 'tap');
  }, { passive:false });

  layer.appendChild(el);

  const ttl = D.ttl * (0.90 + Math.random()*0.25);
  const born = now();
  const t = { id, el, kind, group, emoji, born, ttl, dead:false };
  S.targets.set(id, t);

  // auto despawn
  setTimeout(() => {
    if (!t.dead) despawn(t, 'timeout');
  }, ttl);

  return t;
}

function despawn(t, reason){
  if (!t || t.dead) return;
  t.dead = true;
  S.targets.delete(t.id);
  if (t.el) {
    t.el.classList.add(reason === 'hit' ? 'hit' : 'miss');
    setTimeout(() => { try{ t.el.remove(); }catch(_){} }, 260);
  }
}

// -----------------------------
// Hit / scoring logic (MISS = โดนขยะเท่านั้น)
// -----------------------------
function addFever(delta){
  S.fever = clamp(S.fever + delta, 0, 100);
}
function addScore(v){
  S.score = Math.trunc(S.score + v);
}
function setGrade(){
  // ตัวอย่างเกรดแบบ GoodJunk-ish: based on score/time/miss/perfect
  // เรียบง่าย: ratio perfect+combo vs miss
  const perf = S.perfect;
  const m = S.miss;
  const c = S.maxCombo;

  let g = 'C';
  if (m === 0 && perf >= 10) g = 'SSS';
  else if (m <= 1 && perf >= 8) g = 'SS';
  else if (m <= 2 && (perf >= 6 || c >= 10)) g = 'S';
  else if (perf >= 4 || c >= 7) g = 'A';
  else if (perf >= 2 || c >= 4) g = 'B';
  else g = 'C';

  S.grade = g;
}

function isPerfectHit(t, hitX, hitY){
  // perfect ถ้าแตะใกล้กลางเป้า
  const r = t.el.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top + r.height/2;
  const dx = hitX - cx;
  const dy = hitY - cy;
  const dist = Math.hypot(dx,dy);
  const norm = dist / (r.width/2);
  return norm <= 0.35;
}

function onHit(el, via){
  if (!S.running || S.paused) return;
  if (!el || !el.dataset) return;

  const id = parseInt(el.dataset.id,10);
  const t = S.targets.get(id);
  if (!t || t.dead) return;

  // figure hit point for perfect test
  let hx = ROOT.innerWidth/2, hy = ROOT.innerHeight/2;
  // via tap on element -> use last pointer (approx)
  // fallback: center crosshair
  // (เราอ่าน event ไม่ได้จากที่นี่แล้ว แต่ให้กะจาก rect)
  const rr = el.getBoundingClientRect();
  hx = rr.left + rr.width/2;
  hy = rr.top + rr.height/2;

  const perfect = isPerfectHit(t, hx, hy);

  if (t.kind === 'junk'){
    // MISS++
    S.combo = 0;
    S.miss++;
    addScore(-60);
    addFever(-D.feverLose);
    Particles.scorePop('MISS', hx, hy);
    Particles.burstAt(hx, hy, { kind:'junk' });

    logEvent('hit_junk', { via, perfect:false });
    // mini fail conditions (plate rush: ห้ามโดนขยะ)
    if (S.mini && S.mini.onJunk) S.mini.onJunk();

    despawn(t, 'hit');
    shake(7);
    updateHUD();
    return;
  }

  // good/gold
  if (perfect){
    S.perfect++;
    addFever(+D.feverGain);
  } else {
    addFever(+Math.max(2, D.feverGain-2));
  }

  S.combo++;
  S.maxCombo = Math.max(S.maxCombo, S.combo);

  let gain = 40 + Math.min(60, S.combo*4);
  if (perfect) gain += 35;
  if (t.kind === 'gold') gain += 90;

  addScore(gain);

  // plate progress: good only with group
  if (t.kind === 'good' && t.group>=1 && t.group<=5){
    if (!S.have[t.group]) S.have[t.group] = 0;
    S.have[t.group]++;

    // if collected at least 1 of all 5 groups => plate clear
    const ok =
      S.have[1]>0 && S.have[2]>0 && S.have[3]>0 && S.have[4]>0 && S.have[5]>0;
    if (ok){
      S.plateClears++;
      // reset have (ให้ลุ้นทำจานสมดุลซ้ำ)
      S.have = {1:0,2:0,3:0,4:0,5:0};
      Particles.celebrate && Particles.celebrate('GOAL');
      logEvent('plate_clear', { clears:S.plateClears });
    }
  }

  // FX
  Particles.scorePop(perfect ? `PERFECT +${gain}` : `+${gain}`, hx, hy);
  Particles.burstAt(hx, hy, { kind:t.kind });

  // mini hooks
  if (S.mini && S.mini.onHit) S.mini.onHit({ t, perfect });

  logEvent('hit', { kind:t.kind, group:t.group, perfect, via, gain });

  despawn(t, 'hit');
  updateHUD();
  checkGoalsAndMini();
}

// Tap-anywhere ยิง: ถ้าแตะโดนเป้าอยู่แล้ว event จะเข้า onHit ผ่านตัวเป้าเอง
// ถ้าแตะว่าง ให้ “ช่วยล็อก” เป้าที่ใกล้ crosshair (กลางจอ) แบบ GoodJunk
function bindTapAnywhere(){
  doc.addEventListener('pointerdown', (ev) => {
    if (!S.running || S.paused) return;
    const t = ev.target;
    // ignore clicking UI buttons
    if (t && (t.closest && (t.closest('button') || t.closest('#hudRight')))) return;

    // ถ้ากดโดนเป้า ตัวเป้าจะ stopPropagation แล้ว
    // ถ้าไม่โดนเป้า -> aim assist หาเป้าใกล้กลางจอ
    const picked = pickNearCrosshair(72);
    if (picked) onHit(picked.el, 'crosshair');
  }, { passive:true });
}

function pickNearCrosshair(radiusPx){
  const cx = ROOT.innerWidth/2;
  const cy = ROOT.innerHeight/2;

  let best = null;
  let bestD = 1e9;

  for (const t of S.targets.values()){
    if (t.dead || !t.el) continue;
    const r = t.el.getBoundingClientRect();
    const x = r.left + r.width/2;
    const y = r.top + r.height/2;
    const d = Math.hypot(x-cx, y-cy);
    if (d < radiusPx && d < bestD){
      bestD = d;
      best = t;
    }
  }
  return best;
}

// -----------------------------
// Quests (Goals 2 + Minis 7 chain)
// -----------------------------
const GOALS = [
  { key:'plate2',  text: '🥗 เคลียร์ “จานสมดุล” ให้ได้ 2 ใบ', need:2, type:'plate' },
  { key:'perfect6',text: '⭐ ทำ PERFECT ให้ได้ 6 ครั้ง', need:6, type:'perfect' }
];

const MINIS = [
  {
    key:'plate_rush',
    title:'Plate Rush (8s)',
    hint:'ทำจานครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ ✅',
    secs: 8,
    start(){ this.progress = 0; this.bad=false; this.have={1:0,2:0,3:0,4:0,5:0}; },
    onHit({t}){
      if (t.kind==='junk') return;
      if (t.kind==='good' && t.group>=1 && t.group<=5) this.have[t.group]=1;
      this.progress = (this.have[1]+this.have[2]+this.have[3]+this.have[4]+this.have[5]);
    },
    onJunk(){ this.bad=true; },
    done(){ return !this.bad && this.progress>=5; }
  },
  {
    key:'perfect_streak',
    title:'Perfect Streak',
    hint:'ทำ Perfect ติดต่อกัน 5 ครั้ง (พลาดแล้วนับใหม่)!',
    secs: 12,
    start(){ this.progress=0; },
    onHit({perfect, t}){
      if (t.kind==='junk') { this.progress=0; return; }
      if (perfect) this.progress++; else this.progress = 0;
    },
    done(){ return this.progress>=5; }
  },
  {
    key:'gold_hunt',
    title:'Gold Hunt (12s)',
    hint:'เก็บ 🌟 Gold ให้ได้ 2 อันภายในเวลา!',
    secs: 12,
    start(){ this.progress=0; },
    onHit({t}){ if (t.kind==='gold') this.progress++; },
    done(){ return this.progress>=2; }
  },
  {
    key:'combo_sprint',
    title:'Combo Sprint (10s)',
    hint:'ทำคอมโบให้ได้ 8 ภายใน 10 วิ (อย่าโดนขยะ)!',
    secs: 10,
    start(){ this.startCombo = S.combo; this.progress=0; this.bad=false; },
    onHit({t}){
      if (t.kind==='junk') this.bad=true;
      this.progress = Math.max(this.progress, S.combo);
    },
    done(){ return !this.bad && this.progress>=8; }
  },
  {
    key:'no_junk',
    title:'No-Junk Shield (9s)',
    hint:'รอด 9 วิ โดย “ห้ามโดนขยะ”',
    secs: 9,
    start(){ this.bad=false; this.progress=0; },
    onJunk(){ this.bad=true; },
    tick(dt){ this.progress += dt; },
    done(){ return !this.bad && this.progress>=this.secs; }
  },
  {
    key:'fever_push',
    title:'Fever Push (10s)',
    hint:'ดัน Fever ให้เกิน 60% ภายใน 10 วิ!',
    secs: 10,
    start(){},
    done(){ return S.fever>=60; }
  },
  {
    key:'perfect_mix',
    title:'Perfect Mix (10s)',
    hint:'ทำ Perfect 3 ครั้ง + เก็บ 3 หมู่ให้ได้ในเวลา!',
    secs: 10,
    start(){ this.p=0; this.have={1:0,2:0,3:0,4:0,5:0}; },
    onHit({t, perfect}){
      if (perfect && t.kind!=='junk') this.p++;
      if (t.kind==='good' && t.group>=1 && t.group<=5) this.have[t.group]=1;
    },
    done(){
      const g = (this.have[1]+this.have[2]+this.have[3]+this.have[4]+this.have[5]);
      return this.p>=3 && g>=3;
    }
  }
];

let activeGoalIndex = 0;

function startMini(def){
  const m = Object.assign({}, def);
  m.tLeft = m.secs;
  m.progress = 0;
  if (m.start) m.start();
  S.mini = m;

  // warn FX near end
  S.rushWarnOn = false;
}

function finishMini(success){
  if (!S.mini) return;
  if (success){
    S.minisDone++;
    Particles.celebrate && Particles.celebrate('MINI');
    logEvent('mini_done', { key:S.mini.key });
    // fever bonus
    addFever(10);
    addScore(120);
  } else {
    logEvent('mini_fail', { key:S.mini.key });
    // slight penalty
    addScore(-30);
    addFever(-8);
  }
  S.mini = null;
}

function ensureMiniRunning(){
  if (S.mini) return;

  // pick next mini (cycle-ish)
  const idx = (S.minisDone % MINIS.length);
  startMini(MINIS[idx]);
}

function checkGoalsAndMini(){
  // goal update
  const g = GOALS[activeGoalIndex] || GOALS[0];

  let cur = 0;
  if (g.type==='plate') cur = S.plateClears;
  if (g.type==='perfect') cur = S.perfect;

  if (cur >= g.need){
    S.goalsDone = Math.max(S.goalsDone, activeGoalIndex+1);
    activeGoalIndex = Math.min(GOALS.length-1, activeGoalIndex+1);
    Particles.celebrate && Particles.celebrate('GOAL');
    addScore(220);
    addFever(18);
    logEvent('goal_done', { key:g.key });
  }

  // mini lifecycle (done check)
  if (S.mini && S.mini.done && S.mini.done()){
    finishMini(true);
  }

  // end condition: goals complete OR time out
  if (S.goalsDone >= S.goalsTotal){
    endGame('goals');
  }
}

function goalText(){
  const g = GOALS[activeGoalIndex] || GOALS[0];
  let cur = (g.type==='plate') ? S.plateClears : S.perfect;
  return `Goal ${Math.min(activeGoalIndex+1,2)}/2: ${g.text} (${cur}/${g.need})`;
}

function miniText(){
  if (!S.mini) return '…';
  const p = (typeof S.mini.progress === 'number') ? S.mini.progress : 0;
  const left = Math.max(0, S.mini.tLeft).toFixed(1);
  // special display for some minis
  if (S.mini.key==='gold_hunt') return `MINI: ${S.mini.title} • ${p}/2 • ${left}s`;
  if (S.mini.key==='perfect_streak') return `MINI: ${S.mini.title} • ${p}/5 • ${left}s`;
  if (S.mini.key==='plate_rush') return `MINI: ${S.mini.title} • ${p}/5 • ${left}s`;
  return `MINI: ${S.mini.title} • ${left}s`;
}

// -----------------------------
// FX helpers
// -----------------------------
let shakeUntil = 0;
let shakePower = 0;

function shake(p){
  shakePower = Math.max(shakePower, p||6);
  shakeUntil = now() + 220;
}

function applyShake(){
  const t = now();
  if (t > shakeUntil) {
    doc.documentElement.style.transform = '';
    shakePower = 0;
    return;
  }
  const k = (shakePower||6) * 0.6;
  const dx = (Math.random()*2-1)*k;
  const dy = (Math.random()*2-1)*k;
  doc.documentElement.style.transform = `translate3d(${dx}px,${dy}px,0)`;
}

// -----------------------------
// HUD updates
// -----------------------------
function updateHUD(){
  setText(UI.hudTime, Math.ceil(S.timeLeft));
  setText(UI.hudScore, S.score);
  setText(UI.hudCombo, S.combo);
  setText(UI.hudMiss, S.miss);

  const f = clamp(S.fever,0,100);
  if (UI.hudFever) UI.hudFever.style.width = `${f}%`;
  setText(UI.hudFeverPct, `${Math.round(f)}%`);

  setGrade();
  setText(UI.hudGrade, S.grade);

  setText(UI.hudMode, (RUN==='research') ? 'Research' : 'Play');
  setText(UI.hudDiff, DIFF[0].toUpperCase()+DIFF.slice(1));

  const haveCount = (S.have[1]>0)+(S.have[2]>0)+(S.have[3]>0)+(S.have[4]>0)+(S.have[5]>0);
  setText(UI.hudGroupsHave, `${haveCount}/5`);
  setText(UI.hudPerfectCount, S.perfect);

  if (UI.hudGoalLine) UI.hudGoalLine.textContent = goalText();
  if (UI.hudMiniLine) UI.hudMiniLine.textContent = miniText();
  if (UI.hudMiniHint) UI.hudMiniHint.textContent = (S.mini && S.mini.hint) ? S.mini.hint : '…';
}

// -----------------------------
// Main loop (timer + spawn + mini tick)
// -----------------------------
function spawnRate(){
  // base rate + fever multiplier
  const feverMul = 1 - 0.28*(S.fever/100);
  const comboMul = 1 - 0.18*clamp(S.combo/12,0,1);
  return clamp(D.rate * feverMul * comboMul, 0.38, 1.10);
}

function tick(dt){
  if (!S.running) return;

  if (!S.paused){
    S.timeLeft -= dt;
    if (S.timeLeft <= 0){
      S.timeLeft = 0;
      endGame('time');
      return;
    }

    // mini ticking
    ensureMiniRunning();
    if (S.mini){
      S.mini.tLeft -= dt;
      if (S.mini.tick) S.mini.tick(dt);
      // near end warning
      if (S.mini.tLeft <= 2.2 && !S.rushWarnOn){
        S.rushWarnOn = true;
        warnEdge.classList.add('on');
      }
      if (S.mini.tLeft <= 0){
        warnEdge.classList.remove('on');
        finishMini(false);
      }
    } else {
      warnEdge.classList.remove('on');
    }

    // spawn
    const t = now();
    if (t >= S.nextSpawnAt){
      spawnOne();
      const interval = spawnRate();
      S.nextSpawnAt = t + interval*1000;
    }
  }

  stepInertia(dt/1000);
  applyShake();
  updateHUD();
}

let lastT = 0;
function raf(t){
  if (!lastT) lastT = t;
  const dt = Math.min(0.05, (t-lastT)/1000); // seconds
  lastT = t;
  tick(dt);
  requestAnimationFrame(raf);
}

// -----------------------------
// Controls
// -----------------------------
function bindButtons(){
  if (UI.btnPause){
    UI.btnPause.addEventListener('click', () => {
      S.paused = !S.paused;
      const el = doc.getElementById('hudPaused');
      if (el) el.style.display = S.paused ? '' : 'none';
    });
  }
  if (UI.btnRestart){
    UI.btnRestart.addEventListener('click', () => location.reload());
  }
  if (UI.btnPlayAgain){
    UI.btnPlayAgain.addEventListener('click', () => location.reload());
  }
  if (UI.btnEnterVR){
    UI.btnEnterVR.addEventListener('click', async () => {
      // best-effort: enter webxr (scene exists)
      const scene = doc.querySelector('a-scene');
      try{
        if (scene && scene.enterVR) scene.enterVR();
      }catch(_){}
    });
  }
}

// -----------------------------
// Utils
// -----------------------------
function getPoint(ev){
  if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  return { x: ev.clientX ?? 0, y: ev.clientY ?? 0 };
}

// -----------------------------
// End game + result modal
// -----------------------------
function endGame(reason){
  if (!S.running) return;
  S.running = false;
  warnEdge.classList.remove('on');

  // clear targets
  for (const t of S.targets.values()){
    try{ t.el && t.el.remove(); }catch(_){}
  }
  S.targets.clear();

  setGrade();
  updateHUD();

  if (UI.resultBackdrop) UI.resultBackdrop.style.display = 'flex';

  if (UI.rMode) setText(UI.rMode, (RUN==='research') ? 'Research' : 'Play');
  if (UI.rGrade) setText(UI.rGrade, S.grade);
  if (UI.rScore) setText(UI.rScore, S.score);
  if (UI.rMaxCombo) setText(UI.rMaxCombo, S.maxCombo);
  if (UI.rMiss) setText(UI.rMiss, S.miss);
  if (UI.rPerfect) setText(UI.rPerfect, S.perfect);

  if (UI.rGoals) setText(UI.rGoals, `${S.goalsDone}/${S.goalsTotal}`);
  if (UI.rMinis) setText(UI.rMinis, `${S.minisDone}/${S.minisTotal}`);

  if (UI.rG1) setText(UI.rG1, S.have[1]||0);
  if (UI.rG2) setText(UI.rG2, S.have[2]||0);
  if (UI.rG3) setText(UI.rG3, S.have[3]||0);
  if (UI.rG4) setText(UI.rG4, S.have[4]||0);
  if (UI.rG5) setText(UI.rG5, S.have[5]||0);
  if (UI.rGTotal) {
    const total = (S.have[1]||0)+(S.have[2]||0)+(S.have[3]||0)+(S.have[4]||0)+(S.have[5]||0);
    setText(UI.rGTotal, total);
  }

  logSession(reason);
  try{ CloudLogger.flushNow && CloudLogger.flushNow(true); }catch(_){}
}

// -----------------------------
// Logger events (ใช้ IIFE cloud logger)
// -----------------------------
function logEvent(type, data){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:log_event', {
      detail: {
        sessionId: S.sessionId,
        game: 'PlateVR',
        type,
        t: Date.now(),
        diff: DIFF,
        run: RUN,
        score: S.score,
        combo: S.combo,
        miss: S.miss,
        perfect: S.perfect,
        fever: Math.round(S.fever),
        data: data || {}
      }
    }));
  }catch(_){}
}
function logSession(endReason){
  try{
    ROOT.dispatchEvent(new CustomEvent('hha:log_session', {
      detail: {
        sessionId: S.sessionId,
        game: 'PlateVR',
        startedAt: new Date(Date.now() - Math.round((TOTAL_TIME - S.timeLeft)*1000)).toISOString(),
        endedAt: new Date().toISOString(),
        endReason,
        run: RUN,
        diff: DIFF,
        timeTotal: TOTAL_TIME,
        score: S.score,
        maxCombo: S.maxCombo,
        miss: S.miss,
        perfect: S.perfect,
        feverMax: 100, // (simplified)
        goalsDone: S.goalsDone,
        minisDone: S.minisDone
      }
    }));
  }catch(_){}
}

// -----------------------------
// Boot
// -----------------------------
function boot(){
  if (!doc) return;

  ensureStyle();
  bindUI();
  ensureLayer();

  // init logger endpoint already auto-init in IIFE, but safe call (no-op if missing)
  try{ CloudLogger.init && CloudLogger.init({}); }catch(_){}

  bindTouchLook();
  bindTapAnywhere();
  bindButtons();

  // start state
  S.timeLeft = TOTAL_TIME;
  S.nextSpawnAt = now() + 350;

  // initial mini
  ensureMiniRunning();

  updateHUD();
  requestAnimationFrame(raf);

  if (DEBUG) console.log('[PlateVR] boot', { RUN, DIFF, TOTAL_TIME });
}

boot();