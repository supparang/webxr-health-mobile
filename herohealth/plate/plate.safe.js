// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — A+B + Cloud Logger + AdaptiveStats
// 2025-12-16
'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// FX layer (optional)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { floatScore(){}, burstAt(){}, scorePop(){} };

// -------- URL params --------
const url = new URL(location.href);
const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();
const MODE = (url.searchParams.get('mode') || 'play').toLowerCase(); // play / research
const TIME = clampInt(url.searchParams.get('time'), 60, 20, 180);
const RUSH = (url.searchParams.get('rush') || '1') !== '0';
const BOSS = (url.searchParams.get('boss') || '1') !== '0';

// -------- Logger meta --------
const GAME_MODE = 'PlateVR';
const GAME_VERSION = 'PlateVR-2025.12.16';

// endpoint: อ่านจาก sessionStorage (แนะนำให้ hub set ไว้) หรือใส่เอง
const LOG_ENDPOINT = safeSS('HHA_LOG_ENDPOINT', '');

// ✅ INIT LOGGER (ข้อ 1)
if (typeof window !== 'undefined' && typeof window.initCloudLogger === 'function') {
  window.initCloudLogger({
    endpoint: LOG_ENDPOINT,
    projectTag: 'HeroHealth-PlateVR',
    mode: GAME_MODE,
    runMode: MODE,      // play | research
    diff: DIFF,
    durationSec: TIME,
    debug: false
  });
}

// -------- Difficulty tuning --------
// (adaptive fields are emitted via hha:stat in play mode only)
const DIFF_TABLE = {
  easy:   { spawnMs: 1050, maxActive: 4, targetScale: 1.15, badRate: 0.14, baseScore: 80,  feverGain: 10 },
  normal: { spawnMs: 820,  maxActive: 5, targetScale: 1.00, badRate: 0.18, baseScore: 100, feverGain: 12 },
  hard:   { spawnMs: 620,  maxActive: 6, targetScale: 0.92, badRate: 0.24, baseScore: 120, feverGain: 14 }
};
const DI = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// -------- Food pool (ครบ 5 หมู่ + junk) --------
const GROUPS = [
  { g:1, emoji:['🥚','🥛','🐟','🍗','🫘'], w:1.00 },
  { g:2, emoji:['🍚','🍞','🥔','🌽','🍜'], w:1.00 },
  { g:3, emoji:['🥦','🥬','🥒','🥕','🫑'], w:1.00 },
  { g:4, emoji:['🍎','🍌','🍊','🍉','🍇'], w:1.00 },
  { g:5, emoji:['🥑','🧈','🫒','🥜','🧀'], w:0.95 }
];
const JUNK = { emoji:['🍟','🍔','🍩','🥤','🍫','🧁','🍕'] };

// -------- Scene refs --------
const scene = document.querySelector('a-scene');
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

// spawn/hit counters (sessions sheet summary fields)
let nTargetGoodSpawned = 0;
let nTargetJunkSpawned = 0;
let nHitGood = 0;
let nHitJunk = 0;
let nExpireGood = 0;

// goals & minis
const GOAL_TARGET_PERFECT = 2;
let goalsCleared = 0;

const MINI_TOTAL = 3;
let miniDone = 0;
let miniIndex = 0;
let currentMini = null;

// Boss
let bossActive = false;
let bossHP = 0;
let bossMaxHP = 0;

// session identity
const sessionId = safeUUID();
const sessionStartIso = new Date().toISOString();

// anti-starve cycle
let antiStarve = shuffle([1,2,3,4,5]);

// -------- Init HUD --------
hudTime.textContent = String(tLeft);
hudMode.textContent = (MODE === 'research') ? 'Research' : 'Play';
hudDiff.textContent = DIFF.charAt(0).toUpperCase() + DIFF.slice(1);

hudGoalLine.innerHTML = `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${GOAL_TARGET_PERFECT} จาน`;
hudMiniLine.textContent = RUSH ? 'Mini: Plate Rush — ทำ Perfect ให้ติดกันเร็ว ๆ' : 'Mini: (ปิด)';

btnRestart?.addEventListener('click', ()=>location.reload());
btnPlayAgain?.addEventListener('click', ()=>location.reload());

btnEnterVR?.addEventListener('click', async ()=>{
  try { scene && scene.enterVR && scene.enterVR(); } catch (_) {}
});

// Start when scene loaded
if (scene) scene.addEventListener('loaded', () => start());
else start();

// -------- Core loop --------
function start(){
  if (running) return;
  running = true;

  ensureTouchClickBridge();

  // MINI init
  if (RUSH) {
    currentMini = nextMini();
    renderMiniLine();
  } else {
    currentMini = null;
    renderMiniLine();
  }

  // ✅ EVENT: SESSION_START
  emitEvent('SESSION_START', {
    startTimeIso: sessionStartIso
  });

  // ✅ Adaptive stat snapshot at start (play only)
  emitAdaptiveStat('START');

  timer = setInterval(()=>{
    if (!running) return;
    tLeft -= 1;
    if (tLeft < 0) tLeft = 0;
    hudTime.textContent = String(tLeft);

    // boss trigger near end
    if (BOSS && !bossActive && tLeft === 10) startBoss();

    // adaptive snapshot every 5 sec (play only)
    if (MODE === 'play' && (tLeft % 5 === 0)) emitAdaptiveStat('TICK');

    if (tLeft <= 0) endGame('timeout');
  }, 1000);

  spawnTimer = setInterval(()=>{
    if (!running) return;
    if (bossActive) return;
    if (activeTargets.size >= DI.maxActive) return;
    spawnTarget();
  }, DI.spawnMs);

  updateHUD();
}

function endGame(reason='end'){
  if (!running) return;
  running = false;

  clearInterval(timer); timer = null;
  clearInterval(spawnTimer); spawnTimer = null;

  // cleanup active targets
  for (const el of activeTargets) {
    try { el.parentNode && el.parentNode.removeChild(el); } catch(_){}
  }
  activeTargets.clear();

  // grade
  const grade = calcGrade(score, miss, perfectPlates, maxCombo);

  // ✅ SESSION summary → hha:session
  const sessionEndIso = new Date().toISOString();
  const goodHitsTotal = sumCounts(groupCount);
  const totalActions = goodHitsTotal + nHitJunk;
  const accuracyGoodPct = totalActions ? Math.round((goodHitsTotal / totalActions) * 100) : '';
  const junkErrorPct = totalActions ? Math.round((nHitJunk / totalActions) * 100) : '';

  window.dispatchEvent(new CustomEvent('hha:session', {
    detail: {
      sessionId,
      mode: GAME_MODE,
      difficulty: DIFF,

      durationSecPlayed: TIME - tLeft,
      scoreFinal: score,
      comboMax: maxCombo,
      misses: miss,

      goalsCleared,
      goalsTotal: GOAL_TARGET_PERFECT,
      miniCleared: miniDone,
      miniTotal: MINI_TOTAL,

      nTargetGoodSpawned,
      nTargetJunkSpawned,

      nHitGood: goodHitsTotal,
      nHitJunk: nHitJunk,
      nExpireGood: nExpireGood,

      accuracyGoodPct,
      junkErrorPct,

      startTimeIso: sessionStartIso,
      endTimeIso: sessionEndIso,
      gameVersion: GAME_VERSION,
      reason,

      // ใส่ breakdown ไว้ใน extra (sheet sessions ไม่ต้องเพิ่มคอลัมน์ก็ join ได้)
      extra: JSON.stringify({
        group1: groupCount[1]||0,
        group2: groupCount[2]||0,
        group3: groupCount[3]||0,
        group4: groupCount[4]||0,
        group5: groupCount[5]||0,
        groupTotal: goodHitsTotal,
        perfectPlates
      })
    }
  }));

  // adaptive stat at end (play only)
  emitAdaptiveStat('END', { score, misses: miss });

  showResult(grade);
}

// -------- Spawn: camera-relative (เลื่อนจอแล้วเป้าเลื่อนตาม) --------
function spawnTarget(opts = {}){
  const isJunk = (Math.random() < DI.badRate) && !opts.forceGood;
  let kind = 'good';
  let g = 0;
  let emoji = '🍽️';

  if (opts.forceBossHit) {
    kind = 'boss';
    emoji = '🍽️';
  } else if (isJunk && !opts.forceGood) {
    kind = 'junk';
    emoji = JUNK.emoji[(Math.random() * JUNK.emoji.length) | 0];
  } else {
    const it = pickGroup();
    kind = 'good';
    g = it.g;
    emoji = it.emoji[(Math.random() * it.emoji.length) | 0];
  }

  if (kind === 'good') nTargetGoodSpawned += 1;
  if (kind === 'junk') nTargetJunkSpawned += 1;

  const el = document.createElement('a-entity');
  el.classList.add('plateTarget');

  el.setAttribute('geometry', `primitive:plane; height:${0.35 * DI.targetScale}; width:${0.35 * DI.targetScale}`);
  el.setAttribute('material', 'shader:flat; transparent:true; opacity:0.98; color:#111827');
  el.setAttribute('text', `value:${emoji}; align:center; width:2.5; color:#ffffff; font:https://cdn.aframe.io/fonts/DejaVu-sdf.fnt`);

  el.dataset.kind = kind;
  el.dataset.group = String(g);
  el.dataset.emoji = emoji;

  // position in front of camera (store offsets)
  el._dist = opts.distance ?? rand(1.6, 2.35);
  el._sx = rand(-0.65, 0.65);
  el._sy = rand(-0.35, 0.35);

  placeInFrontOfCamera(el, el._dist, el._sx, el._sy);
  el.setAttribute('look-at', '#cam');

  el.addEventListener('click', (ev)=> onHit(el, ev));

  // auto vanish
  const lifeMs = bossActive ? 1200 : 1400;
  const born = performance.now();

  const follow = () => {
    if (!activeTargets.has(el)) return;
    if (!running) return;

    placeInFrontOfCamera(el, el._dist, el._sx, el._sy);

    const age = performance.now() - born;
    if (age > lifeMs) {
      // expire good = nExpireGood, และนับ miss เฉพาะ good
      if (el.dataset.kind === 'good' && !bossActive) {
        nExpireGood += 1;
        addMiss('EXPIRE_GOOD');
      }
      destroyTarget(el);
      return;
    }
    requestAnimationFrame(follow);
  };

  activeTargets.add(el);
  targetRoot.appendChild(el);
  requestAnimationFrame(follow);
}

function destroyTarget(el){
  if (!el) return;
  activeTargets.delete(el);
  try { el.parentNode && el.parentNode.removeChild(el); } catch(_){}
}

function placeInFrontOfCamera(el, dist, side, up){
  if (!cam || !cam.object3D || !ROOT.THREE) return;

  const camObj = cam.object3D;
  const pos = new ROOT.THREE.Vector3();
  camObj.getWorldPosition(pos);

  const forward = new ROOT.THREE.Vector3();
  camObj.getWorldDirection(forward);

  const right = new ROOT.THREE.Vector3().crossVectors(forward, new ROOT.THREE.Vector3(0,1,0)).normalize().multiplyScalar(side);
  const upV = new ROOT.THREE.Vector3(0,1,0).multiplyScalar(up);

  const p = pos.clone().add(forward.multiplyScalar(dist)).add(right).add(upV);
  el.setAttribute('position', `${p.x} ${p.y} ${p.z}`);
}

// -------- Hit logic --------
function onHit(el, ev){
  if (!running || !el) return;

  const kind = el.dataset.kind || 'good';
  const g = parseInt(el.dataset.group || '0', 10);
  const emoji = el.dataset.emoji || '';
  const pos = el.getAttribute('position') || { x:0, y:0, z:0 };

  try { Particles.burstAt(pos.x, pos.y, pos.z, { strong:true }); } catch(_){}

  if (kind === 'junk') {
    nHitJunk += 1;
    addMiss('HIT_JUNK');
    combo = 0;
    plateBadHit += 1;
    score = Math.max(0, score - 120);

    emitEvent('HIT', {
      emoji,
      itemType: 'junk',
      isGood: false,
      judgment: 'MISS',
      totalScore: score,
      combo,
      feverState: feverActive ? 'ON' : 'OFF',
      feverValue: fever,
      extra: JSON.stringify({ group:0, plateHave: Array.from(plateHave), plateBadHit })
    });

    Particles.floatScore && Particles.floatScore('MISS', pos, { kind:'miss' });
    destroyTarget(el);
    updateHUD();
    return;
  }

  if (kind === 'boss') {
    const delta = feverActive ? 220 : 160;
    score += delta;
    combo += 1; maxCombo = Math.max(maxCombo, combo);

    bossHP -= 1;

    emitEvent('BOSS_HIT', {
      emoji,
      itemType: 'boss',
      isGood: true,
      judgment: 'HIT',
      totalScore: score,
      combo,
      feverState: feverActive ? 'ON' : 'OFF',
      feverValue: fever,
      extra: JSON.stringify({ bossHP, bossMaxHP })
    });

    Particles.floatScore && Particles.floatScore('HIT +' + delta, pos, { kind:'good' });
    destroyTarget(el);
    if (bossHP <= 0) endBossWin();
    updateHUD();
    return;
  }

  // good group hit
  nHitGood += 1;
  groupCount[g] = (groupCount[g] || 0) + 1;
  plateHave.add(g);

  combo += 1;
  maxCombo = Math.max(maxCombo, combo);

  const base = DI.baseScore;
  const comboBonus = Math.min(220, combo * 6);
  const feverMul = feverActive ? 1.6 : 1.0;
  const gain = Math.round((base + comboBonus) * feverMul);
  score += gain;

  addFever(DI.feverGain);

  emitEvent('HIT', {
    emoji,
    itemType: 'good',
    isGood: true,
    judgment: 'HIT',
    totalScore: score,
    combo,
    feverState: feverActive ? 'ON' : 'OFF',
    feverValue: fever,
    extra: JSON.stringify({ group: g, plateHave: Array.from(plateHave), plateBadHit })
  });

  Particles.floatScore && Particles.floatScore('+' + gain, pos, { kind:'good' });
  destroyTarget(el);

  // check plate completion
  if (plateHave.size === 5) {
    if (plateBadHit === 0) {
      perfectPlates += 1;
      goalsCleared = Math.min(GOAL_TARGET_PERFECT, perfectPlates);

      emitEvent('PERFECT_PLATE', {
        emoji: '🥗',
        itemType: 'plate',
        isGood: true,
        judgment: 'PERFECT',
        totalScore: score,
        combo,
        feverState: feverActive ? 'ON' : 'OFF',
        feverValue: fever,
        extra: JSON.stringify({
          groups: Array.from(plateHave),
          perfectPlates,
          miniIndex,
          diff: DIFF
        })
      });

      Particles.scorePop && Particles.scorePop('PERFECT PLATE! 🎉');

      if (RUSH && currentMini) handleMiniOnPerfect();
    } else {
      emitEvent('PLATE_COMPLETE_NOT_PERFECT', {
        emoji: '🍽️',
        itemType: 'plate',
        isGood: true,
        judgment: 'COMPLETE',
        totalScore: score,
        combo,
        feverState: feverActive ? 'ON' : 'OFF',
        feverValue: fever,
        extra: JSON.stringify({ reason:'HAS_JUNK', plateBadHit })
      });

      Particles.scorePop && Particles.scorePop('เกือบได้! (มีของไม่ดี) 😅');
    }

    // reset plate
    plateHave.clear();
    plateBadHit = 0;
  }

  updateHUD();
}

// -------- Mini quests --------
function nextMini(){
  miniIndex += 1;
  const round = Math.min(MINI_TOTAL, miniIndex);
  const windowSec = (DIFF === 'hard') ? 12 : (DIFF === 'easy' ? 18 : 15);
  return {
    title: `Plate Rush ${round}/${MINI_TOTAL}`,
    windowSec,
    startedAt: performance.now(),
    done: false
  };
}

function renderMiniLine(){
  if (!RUSH) { hudMiniLine.textContent = 'Mini: (ปิด)'; return; }
  if (!currentMini) { hudMiniLine.textContent = 'Mini: จบทั้งหมดแล้ว ✅'; return; }
  hudMiniLine.textContent = `Mini: ${currentMini.title} — ทำ Perfect ภายใน ${currentMini.windowSec}s`;
}

function handleMiniOnPerfect(){
  if (!currentMini || currentMini.done) return;
  const ageSec = (performance.now() - currentMini.startedAt) / 1000;

  if (ageSec <= currentMini.windowSec) {
    currentMini.done = true;
    miniDone += 1;

    emitEvent('MINI_CLEAR', {
      emoji: '✨',
      itemType: 'mini',
      isGood: true,
      judgment: 'CLEAR',
      miniProgress: `${miniDone}/${MINI_TOTAL}`,
      totalScore: score,
      combo,
      extra: JSON.stringify({ title: currentMini.title, ageSec: Math.round(ageSec*100)/100 })
    });

    Particles.scorePop && Particles.scorePop(`Mini Clear! ✨ (${miniDone}/${MINI_TOTAL})`);

    currentMini = (miniDone < MINI_TOTAL) ? nextMini() : null;
    renderMiniLine();
  } else {
    emitEvent('MINI_FAIL', {
      emoji: '💨',
      itemType: 'mini',
      isGood: false,
      judgment: 'FAIL',
      miniProgress: `${miniDone}/${MINI_TOTAL}`,
      totalScore: score,
      combo,
      extra: JSON.stringify({ title: currentMini.title, ageSec: Math.round(ageSec*100)/100 })
    });

    currentMini.startedAt = performance.now();
    Particles.scorePop && Particles.scorePop('Mini รีเซ็ต! ลองใหม่ 💨');
    renderMiniLine();
  }
}

// -------- Boss --------
function startBoss(){
  bossActive = true;
  bossMaxHP = (DIFF === 'hard') ? 16 : (DIFF === 'easy' ? 10 : 13);
  bossHP = bossMaxHP;

  emitEvent('BOSS_START', {
    emoji: '🍽️',
    itemType: 'boss',
    isGood: true,
    judgment: 'START',
    totalScore: score,
    combo,
    extra: JSON.stringify({ bossHP, bossMaxHP })
  });

  Particles.scorePop && Particles.scorePop('BOSS PLATE 등장! 🍽️⚡');

  const bossInterval = setInterval(()=>{
    if (!running) { clearInterval(bossInterval); return; }
    if (!bossActive) { clearInterval(bossInterval); return; }
    if (activeTargets.size >= DI.maxActive + 1) return;
    spawnTarget({ forceBossHit:true, distance: rand(1.6, 2.1) });
  }, Math.max(260, DI.spawnMs * 0.45));
}

function endBossWin(){
  bossActive = false;

  emitEvent('BOSS_CLEAR', {
    emoji: '🏆',
    itemType: 'boss',
    isGood: true,
    judgment: 'CLEAR',
    totalScore: score,
    combo,
    extra: JSON.stringify({ bossHP:0, bossMaxHP })
  });

  Particles.scorePop && Particles.scorePop('BOSS CLEAR! 🏆');

  fever = 100;
  feverActive = true;
  setTimeout(()=>{ feverActive = false; }, 3500);
}

// -------- Fever --------
function addFever(v){
  fever = clamp(fever + v, 0, 100);

  if (fever >= 100 && !feverActive) {
    feverActive = true;

    emitEvent('FEVER_ON', {
      emoji: '🔥',
      itemType: 'fever',
      isGood: true,
      judgment: 'ON',
      totalScore: score,
      combo,
      feverState: 'ON',
      feverValue: fever
    });

    Particles.scorePop && Particles.scorePop('FEVER! 🔥');

    setTimeout(()=>{
      feverActive = false;
      fever = 0;

      emitEvent('FEVER_OFF', {
        emoji: '🧊',
        itemType: 'fever',
        isGood: true,
        judgment: 'OFF',
        totalScore: score,
        combo,
        feverState: 'OFF',
        feverValue: 0
      });

      updateHUD();
    }, 5200);
  }

  updateHUD();
}

// -------- Miss rules --------
function addMiss(reason='MISS'){
  miss += 1;
  hudMiss.textContent = String(miss);

  emitEvent('MISS', {
    emoji: '❌',
    itemType: 'miss',
    isGood: false,
    judgment: 'MISS',
    totalScore: score,
    combo,
    extra: JSON.stringify({ reason })
  });
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

  hudGoalLine.innerHTML =
    `ทำ <b>PERFECT PLATE</b> ให้ได้อย่างน้อย ${GOAL_TARGET_PERFECT} จาน <span class="muted">(ตอนนี้ ${perfectPlates}/${GOAL_TARGET_PERFECT})</span>`;

  if (RUSH) renderMiniLine();
}

function showResult(grade){
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

  rGTotal.textContent = String(sumCounts(groupCount));

  resultBackdrop.style.display = 'flex';
}

// -------- Picks (anti-starve) --------
function pickGroup(){
  let g;
  if (antiStarve.length) {
    g = antiStarve.shift();
  } else {
    g = weightedPick(GROUPS).g;
    if (Math.random() < 0.06) antiStarve = shuffle([1,2,3,4,5]);
  }
  return GROUPS.find(x=>x.g===g) || GROUPS[0];
}

// -------- Emit helpers (logger contract) --------
function emitEvent(type, detail = {}){
  // hha:event is for EVENTS sheet
  window.dispatchEvent(new CustomEvent('hha:event', {
    detail: {
      type,
      mode: GAME_MODE,
      difficulty: DIFF,
      sessionId,
      timeFromStartMs: Math.round(performance.now()),
      ...detail
    }
  }));
}

function emitAdaptiveStat(tag='TICK', extra = {}){
  // logger ใหม่ของคุณรับ hha:stat → adaptiveStats sheet (play only)
  if (MODE !== 'play') return;

  const adaptiveScale = DI.targetScale;
  const adaptiveSpawn = DI.spawnMs;
  const adaptiveMaxActive = DI.maxActive;

  window.dispatchEvent(new CustomEvent('hha:stat', {
    detail: {
      mode: GAME_MODE,
      difficulty: DIFF,
      sessionId,
      adaptiveScale,
      adaptiveSpawn,
      adaptiveMaxActive,
      combo,
      misses: miss,
      score,
      extra: JSON.stringify({ tag, ...extra })
    }
  }));
}

// -------- Mobile tap reliability --------
function ensureTouchClickBridge(){
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
  return arr[arr.length - 1];
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
  if (perfect >= 3 && miss <= 2 && maxCombo >= 18) return 'SSS';
  if (perfect >= 2 && miss <= 4 && maxCombo >= 14) return 'SS';
  if (perfect >= 2 && miss <= 6) return 'S';
  if (perfect >= 1 && miss <= 8) return 'A';
  if (perfect >= 1) return 'B';
  return 'C';
}
function sumCounts(gc){
  return (gc[1]||0)+(gc[2]||0)+(gc[3]||0)+(gc[4]||0)+(gc[5]||0);
}
function safeUUID(){
  try { return crypto.randomUUID(); } catch (_) { return 'sess_' + Math.random().toString(16).slice(2) + '_' + Date.now(); }
}
function safeSS(key, fallback=''){
  try {
    if (typeof sessionStorage === 'undefined') return fallback;
    const v = sessionStorage.getItem(key);
    return v != null ? v : fallback;
  } catch (_) { return fallback; }
}