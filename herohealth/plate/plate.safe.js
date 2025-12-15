// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — A + B (camera-follow targets + group stats + Rush + Combo + Boss)
// 2025-12-15
'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// FX (ถ้ามี /herohealth/vr/particles.js)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { floatScore(){}, burstAt(){}, scorePop(){} };

// -------- URL params --------
const url = new URL(location.href);
const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();
const MODE = (url.searchParams.get('mode') || 'play').toLowerCase();      // play / research
const TIME = clampInt(url.searchParams.get('time'), 60, 20, 180);
const RUSH = (url.searchParams.get('rush') || '1') !== '0';              // Plate Rush mini quest
const BOSS = (url.searchParams.get('boss') || '1') !== '0';              // Boss plate at end

// -------- Difficulty tuning --------
const DIFF_TABLE = {
  easy:   { spawnMs: 1050, maxActive: 4, targetScale: 1.15, badRate: 0.14, baseScore: 80, feverGain: 10 },
  normal: { spawnMs: 820,  maxActive: 5, targetScale: 1.00, badRate: 0.18, baseScore: 100, feverGain: 12 },
  hard:   { spawnMs: 620,  maxActive: 6, targetScale: 0.92, badRate: 0.24, baseScore: 120, feverGain: 14 }
};
const DI = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// -------- Food pool (ครบ 5 หมู่ + junk) --------
const GROUPS = [
  { g:1, label:'หมู่ 1', emoji:['🥚','🥛','🐟','🍗','🫘'], w:1.00 },
  { g:2, label:'หมู่ 2', emoji:['🍚','🍞','🥔','🌽','🍜'], w:1.00 },
  { g:3, label:'หมู่ 3', emoji:['🥦','🥬','🥒','🥕','🫑'], w:1.00 },
  { g:4, label:'หมู่ 4', emoji:['🍎','🍌','🍊','🍉','🍇'], w:1.00 },
  { g:5, label:'หมู่ 5', emoji:['🥑','🧈','🫒','🥜','🧀'], w:0.95 }
];

const JUNK = [
  { kind:'junk', emoji:['🍟','🍔','🍩','🥤','🍫','🧁','🍕'], w:1.00 }
];

// -------- Scene refs --------
const scene = document.querySelector('a-scene');
const rig = document.getElementById('rig');
const cam = document.getElementById('cam');
const targetRoot = document.getElementById('targetRoot');

// HUD refs
const $ = (id)=>document.getElementById(id);
const hudTime = $('hudTime');
const hudScore = $('hudScore');
const hudCombo = $('hudCombo');
const hudMiss  = $('hudMiss');
const hudFever = $('hudFever');
const hudFeverPct = $('hudFeverPct');
const hudMode = $('hudMode');
const hudDiff = $('hudDiff');
const hudGoalLine = $('hudGoalLine');
const hudMiniLine = $('hudMiniLine');
const hudGroupsHave = $('hudGroupsHave');
const hudPerfectCount = $('hudPerfectCount');

const btnEnterVR = $('btnEnterVR');
const btnRestart = $('btnRestart');
const resultBackdrop = $('resultBackdrop');
const btnPlayAgain = $('btnPlayAgain');

// Result refs
const rMode = $('rMode');
const rGrade = $('rGrade');
const rScore = $('rScore');
const rMaxCombo = $('rMaxCombo');
const rMiss = $('rMiss');
const rPerfect = $('rPerfect');
const rGoals = $('rGoals');
const rMinis = $('rMinis');
const rG1 = $('rG1'); const rG2 = $('rG2'); const rG3 = $('rG3'); const rG4 = $('rG4'); const rG5 = $('rG5'); const rGTotal = $('rGTotal');

// -------- Game state --------
let running = false;
let tLeft = TIME;
let timer = null;
let spawnTimer = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

let fever = 0;          // 0..100
let feverActive = false;

let activeTargets = new Set();

// plate tracking (รอบ “จานนี้”)
let plateHave = new Set();         // groups collected in current plate (1..5)
let plateBadHit = 0;               // junk hits in current plate
let perfectPlates = 0;

// group counters (ทั้งเกม)
let groupCount = { 1:0, 2:0, 3:0, 4:0, 5:0 };

// goals & minis
const GOAL_TARGET_PERFECT = 2;      // เหมือนที่โชว์ใน hub
let goalsCleared = 0;

const MINI_TOTAL = 3;
let miniDone = 0;
let miniIndex = 0;
let currentMini = null;

// Boss
let bossActive = false;
let bossHP = 0;
let bossMaxHP = 0;

// -------- Init HUD --------
hudTime.textContent = String(tLeft);
hudMode.textContent = (MODE === 'research') ? 'Research' : 'Play';
hudDiff.textContent = DIFF.charAt(0).toUpperCase() + DIFF.slice(1);

hudGoalLine.innerHTML = `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${GOAL_TARGET_PERFECT} จาน`;
hudMiniLine.textContent = RUSH ? 'Mini: Plate Rush — ทำ Perfect ให้ติดกันเร็ว ๆ' : 'Mini: (ปิด)';

btnRestart?.addEventListener('click', ()=>location.reload());
btnPlayAgain?.addEventListener('click', ()=>location.reload());

btnEnterVR?.addEventListener('click', async ()=>{
  try {
    if (scene && scene.enterVR) scene.enterVR();
  } catch (e) {}
});

// Start when scene loaded
if (scene) {
  scene.addEventListener('loaded', () => start());
} else {
  start();
}

// -------- Core loop --------
function start(){
  if (running) return;
  running = true;

  // Make sure we can “click” targets on mobile (tap)
  ensureTouchClickBridge();

  // init minis
  if (RUSH) {
    currentMini = nextMini();
    renderMiniLine();
  } else {
    currentMini = null;
    renderMiniLine();
  }

  timer = setInterval(()=>{
    if (!running) return;
    tLeft -= 1;
    if (tLeft < 0) tLeft = 0;
    hudTime.textContent = String(tLeft);
    if (tLeft <= 0) endGame();
    // Boss trigger near end
    if (BOSS && !bossActive && tLeft === 10) startBoss();
  }, 1000);

  spawnTimer = setInterval(()=>{
    if (!running) return;
    if (bossActive) return; // boss phase uses own spawn style
    if (activeTargets.size >= DI.maxActive) return;
    spawnTarget();
  }, DI.spawnMs);

  updateHUD();
}

function endGame(){
  running = false;
  clearInterval(timer); timer = null;
  clearInterval(spawnTimer); spawnTimer = null;

  // cleanup active
  for (const el of activeTargets) {
    try { el.parentNode && el.parentNode.removeChild(el); } catch(e){}
  }
  activeTargets.clear();

  // grading
  const grade = calcGrade(score, miss, perfectPlates, maxCombo);
  showResult(grade);
}

// -------- Spawn: camera-relative (เลื่อนจอแล้วเป้าเลื่อนตาม) --------
function spawnTarget(opts = {}){
  const isJunk = (Math.random() < DI.badRate) && !opts.forceGood;
  let item;

  if (opts.forceBossHit) {
    item = { kind:'boss', emoji:'🍽️', g:0 };
  } else if (isJunk && !opts.forceGood) {
    item = pickJunk();
  } else {
    item = pickGroup();
  }

  const emoji = Array.isArray(item.emoji)
    ? item.emoji[(Math.random() * item.emoji.length) | 0]
    : item.emoji;

  const el = document.createElement('a-entity');
  el.classList.add('plateTarget');

  // geometry as billboard plane with text (emoji)
  el.setAttribute('geometry', `primitive:plane; height:${0.35 * DI.targetScale}; width:${0.35 * DI.targetScale}`);
  el.setAttribute('material', 'shader:flat; transparent:true; opacity:0.98; color:#111827');
  el.setAttribute('text', `value:${emoji}; align:center; width:2.5; color:#ffffff; font:https://cdn.aframe.io/fonts/DejaVu-sdf.fnt`);

  // data
  el.dataset.kind = item.kind || 'good';
  el.dataset.group = String(item.g || 0);

  // position in front of camera, with slight random offset
  placeInFrontOfCamera(el, opts.distance ?? rand(1.6, 2.35), rand(-0.65, 0.65), rand(-0.35, 0.35));

  // face camera (billboard)
  el.setAttribute('look-at', '#cam');

  // interaction
  el.addEventListener('click', (ev)=> onHit(el, ev));

  // auto vanish
  const lifeMs = bossActive ? 1200 : 1400;
  const born = performance.now();

  // tick follow: keep relative to camera yaw so “เลื่อนจอ เป้าเลื่อนตาม”
  const follow = () => {
    if (!activeTargets.has(el)) return;
    if (!running) return;

    // keep it in front; small drift for “alive feeling”
    placeInFrontOfCamera(el, opts.distance ?? 2.0, el._sx || 0, el._sy || 0);

    // vanish by time
    const age = performance.now() - born;
    if (age > lifeMs) {
      // miss only if good target (junk disappearing ไม่ต้องนับ miss)
      if (el.dataset.kind === 'good' && !bossActive) addMiss();
      destroyTarget(el);
      return;
    }
    requestAnimationFrame(follow);
  };

  // store offsets so follow uses same spot
  el._sx = rand(-0.65, 0.65);
  el._sy = rand(-0.35, 0.35);

  activeTargets.add(el);
  targetRoot.appendChild(el);
  requestAnimationFrame(follow);
}

function destroyTarget(el){
  if (!el) return;
  activeTargets.delete(el);
  try { el.parentNode && el.parentNode.removeChild(el); } catch(e){}
}

// Put entity at camera-forward + right*side + up*up
function placeInFrontOfCamera(el, dist, side, up){
  if (!cam || !cam.object3D) return;

  const camObj = cam.object3D;
  const pos = new THREE.Vector3();
  camObj.getWorldPosition(pos);

  const forward = new THREE.Vector3();
  camObj.getWorldDirection(forward); // points forward

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize().multiplyScalar(side);
  const upV = new THREE.Vector3(0,1,0).multiplyScalar(up);

  const p = pos.clone().add(forward.multiplyScalar(dist)).add(right).add(upV);
  el.setAttribute('position', `${p.x} ${p.y} ${p.z}`);
}

// -------- Hit logic (A + B) --------
function onHit(el, ev){
  if (!running) return;
  if (!el) return;

  const kind = el.dataset.kind || 'good';
  const g = parseInt(el.dataset.group || '0', 10);

  // burst FX
  const p = el.getAttribute('position');
  try { Particles.burstAt(p?.x || 0, p?.y || 1.6, p?.z || -2, { strong:true }); } catch(e){}

  if (kind === 'junk') {
    // MISS เฉพาะ "กดของไม่ดี"
    addMiss();
    combo = 0;
    plateBadHit += 1;
    score = Math.max(0, score - 120);
    Particles.floatScore && Particles.floatScore('MISS', p, { kind:'miss' });
    destroyTarget(el);
    updateHUD();
    return;
  }

  if (kind === 'boss') {
    // boss hit
    const delta = feverActive ? 220 : 160;
    score += delta;
    combo += 1; maxCombo = Math.max(maxCombo, combo);
    bossHP -= 1;
    Particles.floatScore && Particles.floatScore('HIT +' + delta, p, { kind:'good' });
    destroyTarget(el);
    if (bossHP <= 0) endBossWin();
    updateHUD();
    return;
  }

  // good group
  groupCount[g] = (groupCount[g] || 0) + 1;
  plateHave.add(g);

  // combo system
  combo += 1;
  maxCombo = Math.max(maxCombo, combo);

  // score: base + combo + fever
  const base = DI.baseScore;
  const comboBonus = Math.min(220, combo * 6);
  const feverMul = feverActive ? 1.6 : 1.0;
  const gain = Math.round((base + comboBonus) * feverMul);
  score += gain;

  // fever
  addFever(DI.feverGain);

  Particles.floatScore && Particles.floatScore('+' + gain, p, { kind:'good' });
  destroyTarget(el);

  // check Perfect Plate (ครบ 5 หมู่ + ไม่มี junk hit ใน plate นี้)
  if (plateHave.size === 5) {
    if (plateBadHit === 0) {
      perfectPlates += 1;
      goalsCleared = Math.min(GOAL_TARGET_PERFECT, perfectPlates);
      // celebration
      Particles.scorePop && Particles.scorePop('PERFECT PLATE! 🎉');
      // mini quest
      if (RUSH && currentMini) handleMiniOnPerfect();
    } else {
      Particles.scorePop && Particles.scorePop('เกือบได้! (มีของไม่ดี) 😅');
    }

    // reset “จานนี้”
    plateHave.clear();
    plateBadHit = 0;
  }

  updateHUD();
}

// -------- Mini quests (Plate Rush) --------
function nextMini(){
  miniIndex += 1;
  const round = Math.min(MINI_TOTAL, miniIndex);
  // Mini design: ต้องทำ perfect ในเวลาจำกัด (window)
  const windowSec = (DIFF === 'hard') ? 12 : (DIFF === 'easy' ? 18 : 15);
  return {
    title: `Plate Rush ${round}/${MINI_TOTAL}`,
    needPerfect: 1,
    windowSec,
    startedAt: performance.now(),
    done: false
  };
}

function renderMiniLine(){
  if (!RUSH) {
    hudMiniLine.textContent = 'Mini: (ปิด)';
    return;
  }
  if (!currentMini) {
    hudMiniLine.textContent = 'Mini: จบทั้งหมดแล้ว ✅';
    return;
  }
  hudMiniLine.textContent = `Mini: ${currentMini.title} — ทำ Perfect ภายใน ${currentMini.windowSec}s`;
}

function handleMiniOnPerfect(){
  if (!currentMini || currentMini.done) return;
  const ageSec = (performance.now() - currentMini.startedAt) / 1000;
  if (ageSec <= currentMini.windowSec) {
    currentMini.done = true;
    miniDone += 1;
    Particles.scorePop && Particles.scorePop(`Mini Clear! ✨ (${miniDone}/${MINI_TOTAL})`);
    // chain next mini
    currentMini = (miniDone < MINI_TOTAL) ? nextMini() : null;
    renderMiniLine();
  } else {
    // fail -> restart same mini window
    currentMini.startedAt = performance.now();
    Particles.scorePop && Particles.scorePop('Mini รีเซ็ต! ลองใหม่ 💨');
    renderMiniLine();
  }
}

// -------- Boss phase (B) --------
function startBoss(){
  bossActive = true;
  bossMaxHP = (DIFF === 'hard') ? 16 : (DIFF === 'easy' ? 10 : 13);
  bossHP = bossMaxHP;
  Particles.scorePop && Particles.scorePop('BOSS PLATE 등장! 🍽️⚡');
  // spam boss targets
  const bossInterval = setInterval(()=>{
    if (!running) { clearInterval(bossInterval); return; }
    if (!bossActive) { clearInterval(bossInterval); return; }
    if (activeTargets.size >= DI.maxActive + 1) return;
    spawnTarget({ forceBossHit:true, distance: rand(1.6, 2.1) });
  }, Math.max(260, DI.spawnMs * 0.45));
}

function endBossWin(){
  bossActive = false;
  Particles.scorePop && Particles.scorePop('BOSS CLEAR! 🏆');
  // fever reward
  fever = 100;
  feverActive = true;
  setTimeout(()=>{ feverActive = false; }, 3500);
}

// -------- Fever --------
function addFever(v){
  fever = clamp(fever + v, 0, 100);
  if (fever >= 100 && !feverActive) {
    feverActive = true;
    Particles.scorePop && Particles.scorePop('FEVER! 🔥');
    // auto drop after duration
    setTimeout(()=>{
      feverActive = false;
      fever = 0;
      updateHUD();
    }, 5200);
  }
  updateHUD();
}

// -------- Miss rules --------
function addMiss(){
  miss += 1;
  hudMiss.textContent = String(miss);
}

// -------- HUD + Result --------
function updateHUD(){
  hudScore.textContent = String(score | 0);
  hudCombo.textContent = String(combo | 0);
  hudMiss.textContent  = String(miss | 0);

  const pct = Math.round(clamp(fever, 0, 100));
  hudFever.style.width = pct + '%';
  hudFeverPct.textContent = pct + '%';

  hudGroupsHave.textContent = `${plateHave.size}/5`;
  hudPerfectCount.textContent = String(perfectPlates);

  // goals/mini progress in quest panel
  const goalText = `ทำ PERFECT PLATE ให้ได้อย่างน้อย ${GOAL_TARGET_PERFECT} จาน (ตอนนี้ ${perfectPlates}/${GOAL_TARGET_PERFECT})`;
  hudGoalLine.innerHTML = `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${GOAL_TARGET_PERFECT} จาน <span class="muted">(ตอนนี้ ${perfectPlates}/${GOAL_TARGET_PERFECT})</span>`;

  if (RUSH && currentMini) renderMiniLine();
}

function showResult(grade){
  // fill modal
  rMode.textContent = (MODE === 'research') ? 'Research' : 'Play';
  rGrade.textContent = grade;
  rScore.textContent = String(score | 0);
  rMaxCombo.textContent = String(maxCombo | 0);
  rMiss.textContent = String(miss | 0);
  rPerfect.textContent = String(perfectPlates | 0);

  rGoals.textContent = `${Math.min(perfectPlates, GOAL_TARGET_PERFECT)}/${GOAL_TARGET_PERFECT}`;
  rMinis.textContent = `${miniDone}/${MINI_TOTAL}`;

  rG1.textContent = String(groupCount[1] || 0);
  rG2.textContent = String(groupCount[2] || 0);
  rG3.textContent = String(groupCount[3] || 0);
  rG4.textContent = String(groupCount[4] || 0);
  rG5.textContent = String(groupCount[5] || 0);
  rGTotal.textContent = String(
    (groupCount[1]||0)+(groupCount[2]||0)+(groupCount[3]||0)+(groupCount[4]||0)+(groupCount[5]||0)
  );

  resultBackdrop.style.display = 'flex';
}

// -------- Picks (ensure 5 groups appear) --------
let antiStarve = [1,2,3,4,5]; // force cycle
function pickGroup(){
  // prevent starvation: keep cycling until all groups show, then random
  let g;
  if (antiStarve.length) {
    g = antiStarve.shift();
  } else {
    g = weightedPick(GROUPS).g;
    // sometimes re-prime cycle for balanced learning
    if (Math.random() < 0.06) antiStarve = shuffle([1,2,3,4,5]);
  }
  const pool = GROUPS.find(x=>x.g===g) || GROUPS[0];
  return { kind:'good', g: pool.g, emoji: pool.emoji };
}
function pickJunk(){
  return { kind:'junk', g:0, emoji: JUNK[0].emoji };
}

// -------- Mobile tap reliability --------
function ensureTouchClickBridge(){
  // A-Frame sometimes needs pointer events on mobile; cursor will emit click when raycaster intersects.
  // This bridge helps if the browser delays taps.
  document.body.addEventListener('touchstart', ()=>{}, { passive:true });
}

// -------- Utils --------
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function rand(a, b){ return a + Math.random() * (b - a); }
function clampInt(v, def, min, max){
  const n = parseInt(v, 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return def;
}
function weightedPick(arr){
  let sum = 0;
  for (const it of arr) sum += (it.w || 1);
  let r = Math.random() * sum;
  for (const it of arr) {
    r -= (it.w || 1);
    if (r <= 0) return it;
  }
  return arr[arr.length-1];
}
function shuffle(a){
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--){
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function calcGrade(score, miss, perfect, maxCombo){
  // ปรับตามสไตล์เดิมได้ แต่ให้ “รู้สึกยุติธรรม”
  const s = score;
  const p = perfect;
  const m = miss;

  // SSS / SS / S / A / B / C
  if (p >= 3 && m <= 2 && maxCombo >= 18) return 'SSS';
  if (p >= 2 && m <= 4 && maxCombo >= 14) return 'SS';
  if (p >= 2 && m <= 6) return 'S';
  if (p >= 1 && m <= 8) return 'A';
  if (p >= 1) return 'B';
  return 'C';
}

// THREE should exist via A-Frame
function ensureThree(){
  if (!ROOT.THREE) throw new Error('THREE not found (A-Frame not loaded?)');
}
ensureThree();