// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji Engine (PLAY/RESEARCH-ready)
// - spawn targets into #hvr-playfield (scroll/resize safe)
// - water gauge (LOW/GREEN/HIGH) + quest(goal/mini) + grade + progress to S
// - fever gauge + shield (uses global FeverUI from /vr/ui-fever.js)
// - “aim pan” ให้เป้าเลื่อนตามตอนลากนิ้ว/หมุนเครื่อง (crosshair อยู่กับที่)
// - MISS (PLAY): good expired = MISS, junk hit = MISS (shield block = NO miss)
//
// Usage (hydration-vr.html):
//   import { boot } from './hydration-vr/hydration.safe.js';
//   boot({ difficulty:'easy', duration:90 });

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, min, max) {
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function $(sel) { return document.querySelector(sel); }

function safeText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(txt);
}
function safeHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function dispatch(name, detail) {
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

function nowMs() { return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

// ---------- FX (optional; from /vr/particles.js IIFE) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, floatScore(){}, celebrate(){}, setShardMode(){} };

// ---------- FeverUI (from /vr/ui-fever.js IIFE) ----------
function getFeverUI() {
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

// ============================================================
//  Grade + Progress-to-S
// ============================================================
function computeGrade(score, miss, greenPct) {
  // เด็ก ป.5: ให้เข้าใจง่าย → คะแนน + ความนิ่ง (อยู่ GREEN) + ความผิดพลาด
  // greenPct = 0..100 (% ของเวลาที่อยู่ GREEN)
  const s = Number(score) || 0;
  const m = Number(miss) || 0;
  const g = clamp(greenPct, 0, 100);

  // base points
  let pts = 0;
  pts += clamp(s / 12, 0, 120);      // score contribution
  pts += clamp(g * 0.9, 0, 90);      // green stability
  pts -= clamp(m * 8, 0, 120);       // mistakes penalty

  pts = clamp(pts, 0, 200);

  // mapping
  if (pts >= 185) return { grade: 'SSS', pts, toS: 100 };
  if (pts >= 165) return { grade: 'SS',  pts, toS: 100 };
  if (pts >= 145) return { grade: 'S',   pts, toS: 100 };
  if (pts >= 120) return { grade: 'A',   pts, toS: clamp(((pts - 120) / (145 - 120)) * 100, 0, 100) };
  if (pts >= 95)  return { grade: 'B',   pts, toS: clamp(((pts - 95)  / (145 - 95))  * 100, 0, 100) };
  return           { grade: 'C',   pts, toS: clamp((pts / 145) * 100, 0, 100) };
}

// ============================================================
//  Aim-pan (ลากนิ้ว/หมุนเครื่อง) ให้ “เป้าเลื่อนตาม”
//  - Crosshair fixed
//  - เรา translate #hvr-playfield เพื่อให้เป้าขยับทั้งก้อน
// ============================================================
function createAimPanController(playfield) {
  if (!playfield) return { stop(){}, getOffset(){ return {x:0,y:0}; } };

  // offset -1..1
  let aimX = 0, aimY = 0;

  // drag
  let dragging = false;
  let lastX = 0, lastY = 0;

  // device tilt
  let tiltX = 0, tiltY = 0;
  let tiltEnabled = true;

  // apply strength (px)
  const RANGE_X = 130;
  const RANGE_Y = 95;

  // smooth
  let curX = 0, curY = 0;

  function setTransform(px, py) {
    // translate เฉพาะ playfield (เป้าเป็น absolute ใน playfield)
    playfield.style.transform = `translate(${px}px, ${py}px)`;
    playfield.style.willChange = 'transform';
  }

  function clamp01(v){ return clamp(v, -1, 1); }

  function onPointerDown(e) {
    // ไม่ลากบน UI/ปุ่ม/เป้า
    const t = e.target;
    if (t && t.closest && t.closest('.hvr-target, a, button, .hha-btn-vr, .hha-card, .hha-water-bar, .hha-bottom-row')) return;

    dragging = true;
    lastX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    lastY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const x = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    const y = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;

    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x; lastY = y;

    const w = Math.max(320, ROOT.innerWidth || 360);
    const h = Math.max(560, ROOT.innerHeight || 640);

    // sensitivity
    aimX = clamp01(aimX + (dx / (w * 0.33)));
    aimY = clamp01(aimY + (dy / (h * 0.33)));
  }

  function onPointerUp() { dragging = false; }

  function onDeviceOrientation(ev) {
    if (!tiltEnabled) return;
    // gamma: left/right (-90..90)
    // beta: front/back (-180..180)
    const g = Number(ev.gamma);
    const b = Number(ev.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    // normalize
    tiltX = clamp01(g / 28);
    tiltY = clamp01((b - 10) / 28);
  }

  function tick() {
    // combine drag + tilt (tilt นุ่ม ๆ)
    const tx = clamp01(aimX + tiltX * 0.65);
    const ty = clamp01(aimY + tiltY * 0.55);

    // smooth lerp
    curX = curX + (tx - curX) * 0.18;
    curY = curY + (ty - curY) * 0.18;

    setTransform(curX * RANGE_X, curY * RANGE_Y);

    rafId = ROOT.requestAnimationFrame(tick);
  }

  let rafId = ROOT.requestAnimationFrame(tick);

  // listeners
  document.addEventListener('pointerdown', onPointerDown, { passive:true });
  document.addEventListener('pointermove', onPointerMove, { passive:true });
  document.addEventListener('pointerup',   onPointerUp,   { passive:true });
  document.addEventListener('pointercancel', onPointerUp, { passive:true });

  // device tilt (ต้อง allow permission ใน iOS บางรุ่น แต่ Android ส่วนใหญ่ได้)
  ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });

  // reset gesture (ดับเบิลแตะกลางจอ)
  let lastTap = 0;
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (t && t.closest && t.closest('.hvr-target, a, button, .hha-btn-vr')) return;

    const n = Date.now();
    if (n - lastTap < 280) {
      aimX = 0; aimY = 0;
      tiltX = 0; tiltY = 0;
    }
    lastTap = n;
  }, { passive:true });

  return {
    stop() {
      try { ROOT.cancelAnimationFrame(rafId); } catch {}
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      ROOT.removeEventListener('deviceorientation', onDeviceOrientation);
      // reset
      try { playfield.style.transform = ''; } catch {}
    },
    getOffset() { return { x: curX, y: curY }; }
  };
}

// ============================================================
//  Main boot()
// ============================================================
export async function boot(opts = {}) {
  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  const playfield = document.getElementById('hvr-playfield') || document.body;
  ensureWaterGauge();

  // Fever UI wiring
  const FeverUI = getFeverUI() || {
    ensureFeverBar(){},
    setFever(){},
    setFeverActive(){},
    setShield(){}
  };
  try { FeverUI.ensureFeverBar(); } catch {}

  // --------- Core state ----------
  let stopped = false;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let miss = 0;

  // water 0..100
  let water = clamp(opts.initialWater ?? 55, 0, 100);
  let zone  = zoneFrom(water);

  // time bookkeeping
  let secLeft = duration;
  let totalSec = duration;

  // green time for grade
  let greenSec = 0;

  // shield + fever
  let shield = 0;
  let fever = 0;           // 0..100 (fill)
  let feverActive = false; // boost mode
  let feverEndAt = 0;

  function renderFever() {
    try { FeverUI.setFever(fever); } catch {}
    try { FeverUI.setFeverActive(feverActive); } catch {}
    try { FeverUI.setShield(shield); } catch {}
  }

  // --------- Quest ----------
  const quest = createHydrationQuest(difficulty);

  // UI totals (ถ้า HTML มี)
  safeText('hha-goal-total', quest.goals.length);
  safeText('hha-mini-total', quest.minis.length);

  // --------- Coach ----------
  function coachSay(text, mood = 'neutral') {
    safeText('hha-coach-text', text);
    dispatch('hha:coach', { text, mood });
  }

  // --------- Water apply ----------
  function applyWater(delta) {
    water = clamp(water + (Number(delta) || 0), 0, 100);
    const z = zoneFrom(water);
    zone = z;
    setWaterGauge(water);

    // sync quest zone (ให้ quest คิด badZoneSec ได้)
    quest.stats.zone = z;

    // UI in left card
    safeText('hha-water-zone-text', z);

    return { water, zone: z };
  }

  // init
  applyWater(0);

  // --------- Score helpers ----------
  function addScore(delta, label = '') {
    score = Math.max(0, (score + (Number(delta) || 0)));
    quest.updateScore(score);
    dispatch('hha:stat', { score });
    if (label) dispatch('hha:judge', { label });
  }

  function resetCombo() {
    combo = 0;
    quest.updateCombo(combo);
  }

  function addCombo() {
    combo += 1;
    if (combo > comboMax) comboMax = combo;
    quest.updateCombo(combo);
  }

  function addMiss(n = 1) {
    miss += Math.max(0, n|0);
    resetCombo();
  }

  // --------- Grade render ----------
  function renderScoreUI() {
    safeText('hha-score-main', score);
    safeText('hha-combo-max', comboMax);
    safeText('hha-miss', miss);

    // grade
    const greenPct = (totalSec > 0) ? (greenSec / totalSec) * 100 : 0;
    const g = computeGrade(score, miss, greenPct);

    safeText('hha-grade-badge', g.grade);

    // “Progress to S” (ถ้า HTML มี element)
    // รองรับทั้ง id: hha-grade-progress หรือ hha-grade-progress-fill
    const pTxt = document.getElementById('hha-grade-progress-text');
    if (pTxt) pTxt.textContent = `Progress to S: ${Math.round(g.toS)}%`;

    const pFill =
      document.getElementById('hha-grade-progress-fill') ||
      document.getElementById('hha-grade-progress-inner') ||
      null;

    if (pFill) pFill.style.width = clamp(g.toS, 0, 100) + '%';

    dispatch('hha:score', {
      score,
      combo,
      comboMax,
      miss,
      water,
      zone,
      grade: g.grade,
      progressToS: g.toS
    });
  }

  // --------- Quest render ----------
  function renderQuestUI() {
    // counts
    const goalDone = quest.goals.filter(x => !!x._done).length;
    const miniDone = quest.minis.filter(x => !!x._done).length;

    safeText('hha-goal-done', goalDone);
    safeText('hha-mini-done', miniDone);
    safeText('hha-goal-total', quest.goals.length);
    safeText('hha-mini-total', quest.minis.length);

    // main goal = first not done
    const gNow = quest.goals.find(x => !x._done) || quest.goals[quest.goals.length - 1];
    const mNow = quest.minis.find(x => !x._done) || quest.minis[quest.minis.length - 1];

    let goalLine = 'Goal: -';
    let miniLine = 'Mini: -';

    if (gNow && gNow.id && typeof quest.getGoalProgressInfo === 'function') {
      const gi = quest.getGoalProgressInfo(gNow.id);
      // แสดง “โซน…” ตามรูปที่คุณส่ง
      goalLine = `Goal: ${gNow.label} • ${gi.text}`;
    } else if (gNow) {
      goalLine = `Goal: ${gNow.text || gNow.label || '-'}`;
    }

    if (mNow && mNow.id && typeof quest.getMiniProgressInfo === 'function') {
      const mi = quest.getMiniProgressInfo(mNow.id);
      miniLine = `Mini: ${mNow.label} • ${mi.text}`;
    } else if (mNow) {
      miniLine = `Mini: ${mNow.text || mNow.label || '-'}`;
    }

    safeText('hha-quest-goal', goalLine);
    safeText('hha-quest-mini', miniLine);

    dispatch('quest:update', {
      goal: goalLine,
      mini: miniLine,
      goalDone, goalTotal: quest.goals.length,
      miniDone, miniTotal: quest.minis.length
    });
  }

  // --------- Fever logic ----------
  function addFever(v) {
    if (feverActive) return;
    fever = clamp(fever + (Number(v) || 0), 0, 100);
    if (fever >= 100) startFever();
    renderFever();
  }

  function startFever() {
    if (feverActive) return;
    feverActive = true;
    fever = 100;
    feverEndAt = nowMs() + 6000;

    coachSay('🔥 FEVER! โหมดพลัง! คะแนน x2 ชั่วคราว! ไปเลยยย!', 'happy');
    dispatch('hha:fever', { state: 'start', active: true, value: fever });

    renderFever();
  }

  function endFeverIfNeeded() {
    if (!feverActive) return;
    if (nowMs() < feverEndAt) return;

    feverActive = false;
    fever = 0;
    feverEndAt = 0;

    coachSay('หมด FEVER แล้วนะ 💧 รักษาโซน GREEN ต่อ!', 'neutral');
    dispatch('hha:fever', { state: 'end', active: false, value: fever });

    renderFever();
  }

  // --------- Hit effects (DOM blink layer ถ้ามี) ----------
  function screenBlink(kind) {
    const el = document.getElementById('hvr-screen-blink');
    if (!el) return;
    el.classList.remove('good','bad','block','on');
    el.classList.add(kind || 'good');
    // retrigger
    void el.offsetWidth;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 95);
  }

  function vibrate(pattern) {
    try { if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(pattern); } catch {}
  }

  // --------- Judge (called by mode-factory when hit) ----------
  function judge(ch, ctx = {}) {
    if (stopped) return { scoreDelta: 0, good: true, label: 'OK' };

    // normalize
    const s = String(ch || '');
    const isPower = !!ctx.isPower;

    // type buckets
    const isShield = (s === '🛡️');
    const isFire   = (s === '🔥');
    const isGoodDrink = (s === '💧' || s === '🥛' || s === '🍉' || s === '🍊' || s === '🍎' || s === '🍓' || s === '🥥');
    const isJunk   = (s === '🥤' || s === '🧋' || s === '🍭' || s === '🍩' || s === '🧁');

    // fever active = x2 score
    const mul = feverActive ? 2 : 1;

    // shield power-up
    if (isShield || (isPower && s === '🛡️')) {
      shield = clamp(shield + 1, 0, 9);
      renderFever();

      addCombo();
      addScore(40 * mul, 'POWER');
      applyWater(+3);

      screenBlink('block');
      vibrate(18);

      coachSay('ได้ 🛡️ เกราะแล้ว! กันน้ำหวานได้ 1 ครั้ง!', 'happy');

      return { scoreDelta: 40 * mul, good: true, label: 'POWER' };
    }

    // fire power-up
    if (isFire || (isPower && s === '🔥')) {
      startFever();
      addCombo();
      addScore(35, 'POWER');
      applyWater(+2);

      screenBlink('good');
      vibrate([16, 30, 16]);

      return { scoreDelta: 35, good: true, label: 'POWER' };
    }

    // good hit
    if (isGoodDrink || (!isJunk && ctx.isGood)) {
      quest.onGood();

      // water adjustment: ถ้า LOW ให้ดันแรงขึ้น, ถ้า HIGH ให้ดันลงนิด ๆ
      const z = zoneFrom(water);
      let wDelta = 0;

      if (z === 'LOW')  wDelta = +10;
      else if (z === 'GREEN') wDelta = +6;
      else wDelta = +3; // HIGH: ดื่มแล้วมันยิ่งสูง แต่เราคุมให้น้อย

      applyWater(wDelta);

      addCombo();
      addFever(6);

      // scoring: เน้น “รักษา GREEN” ให้คะแนนเพิ่ม
      const zoneNow = zoneFrom(water);
      const zoneBonus = (zoneNow === 'GREEN') ? 14 : (zoneNow === 'LOW' ? 8 : 6);

      addScore((10 + zoneBonus) * mul, 'GOOD');

      screenBlink('good');
      vibrate(12);

      return { scoreDelta: (10 + zoneBonus) * mul, good: true, label: 'GOOD' };
    }

    // junk hit
    if (isJunk || (!ctx.isGood && !ctx.isPower)) {
      quest.onJunk();

      // shield block
      if (shield > 0) {
        shield -= 1;
        renderFever();

        resetCombo();
        // น้ำหวานยังทำให้น้ำแกว่ง แต่เบาลง
        applyWater(+6);
        addFever(10);

        addScore(0, 'BLOCK');
        screenBlink('block');
        vibrate([14, 24, 14]);

        coachSay('🛡️ กันน้ำหวานไว้ได้! ระวังอย่าให้หลุด GREEN นะ', 'neutral');

        return { scoreDelta: 0, good: true, label: 'BLOCK' };
      }

      // no shield → miss
      addMiss(1);

      // น้ำหวานดัน HIGH ไว
      applyWater(+14);
      addFever(18);

      addScore(-14, 'MISS');
      screenBlink('bad');
      vibrate([22, 40, 22]);

      coachSay('โอ๊ย! น้ำหวาน 🥤 ระวังหลุดโซน GREEN นะ!', 'sad');

      return { scoreDelta: -14, good: false, label: 'MISS' };
    }

    // fallback
    addScore(0, 'OK');
    return { scoreDelta: 0, good: true, label: 'OK' };
  }

  // --------- Expire (called by mode-factory when a target times out) ----------
  function onExpire({ ch, isGood, isPower }) {
    if (stopped) return;

    const s = String(ch || '');

    // PLAY concept:
    // - good expired => MISS (เพราะไม่ยอมดื่ม)
    // - junk expired => ดี! (ไม่ต้องโดน)
    // - power expired => ไม่ลงโทษ
    const isJunk =
      (s === '🥤' || s === '🧋' || s === '🍭' || s === '🍩' || s === '🧁') || (!isGood && !isPower);

    if (isPower) return;

    if (isJunk) {
      // reward tiny: ไม่โดน junk
      addScore(2, 'SAFE');
      return;
    }

    // good missed
    addMiss(1);
    addScore(-8, 'MISS');
    coachSay('พลาดน้ำดีไป! รีบเก็บ 💧 แล้วรักษา GREEN นะ', 'neutral');
  }

  // --------- Second tick (drift + quest counting) ----------
  function tickSecond() {
    if (stopped) return;

    endFeverIfNeeded();

    // natural drift: ค่อย ๆ แห้ง (dehydration)
    // ถ้า HIGH ให้แห้งแรงขึ้นนิด (ช่วยดึงกลับ GREEN)
    const drift = (zone === 'HIGH') ? -1.05 : -0.65;
    applyWater(drift);

    // quest second
    quest.second();

    // ✅ IMPORTANT FIX: นับ GREEN ให้จริง
    if (String(zone).toUpperCase() === 'GREEN') {
      quest.stats.greenTick = (quest.stats.greenTick | 0) + 1;
      greenSec += 1;
    }

    renderQuestUI();
    renderScoreUI();
  }

  // --------- Time listener (sync with mode-factory clock) ----------
  function onTime(e) {
    const sec = e && e.detail ? (e.detail.sec|0) : 0;

    // mode-factory จะส่ง secLeft นับถอยหลัง
    if (sec === secLeft) return;

    secLeft = clamp(sec, 0, totalSec);

    // tickSecond ทุกครั้งที่เวลาเปลี่ยนลง 1 วินาที
    // (ป้องกันกรณี dt ข้ามหลายวินาที)
    // ถ้าเวลา “กระโดด” ให้เรียกหลายครั้ง
    // ตัวอย่าง: background tab กลับมา
    const expected = (typeof onTime._lastSec === 'number') ? onTime._lastSec : (secLeft + 1);
    const diff = (expected - secLeft);
    const steps = clamp(diff, 0, 5);

    for (let i = 0; i < steps; i++) tickSecond();

    onTime._lastSec = secLeft;

    if (secLeft <= 0) finishGame();
  }

  // --------- Finish ----------
  function finishGame() {
    if (stopped) return;
    stopped = true;

    try { ROOT.removeEventListener('hha:time', onTime); } catch {}
    try { panCtrl.stop(); } catch {}

    // final grade
    const greenPct = (totalSec > 0) ? (greenSec / totalSec) * 100 : 0;
    const g = computeGrade(score, miss, greenPct);

    dispatch('hha:end', {
      score,
      miss,
      comboMax,
      water,
      zone,
      greenSec,
      greenPct,
      grade: g.grade
    });

    coachSay(`จบเกม! เกรด ${g.grade} 🎉 รักษา GREEN ได้ ${Math.round(greenPct)}%`, 'happy');

    // stop spawner
    try { instSpawner && instSpawner.stop && instSpawner.stop(); } catch {}
  }

  // --------- Setup pan controller (targets “เลื่อนตาม”) ----------
  const panCtrl = createAimPanController(playfield);

  // --------- Spawn config ----------
  const pools = {
    good: ['💧', '🥛', '🍉', '🍊', '🍎'],
    bad:  ['🥤', '🧋', '🍭', '🍩', '🧁']
  };

  // power-ups (สนุก ท้าทาย เร้าใจ)
  const powerups = ['🛡️', '🔥'];

  // difficulty tuning (เล่นให้มันส์)
  // NOTE: mode-factory จะอ่าน HHA_DIFF_TABLE ถ้ามี; ถ้าไม่มีใช้ DEFAULT_DIFF
  // เราส่ง extra goodRate/powerRate ให้เด็กยิงแล้วรู้สึก “คุมได้”
  const goodRate = (difficulty === 'easy') ? 0.72 : (difficulty === 'hard' ? 0.56 : 0.63);
  const powerRate = (difficulty === 'easy') ? 0.12 : (difficulty === 'hard' ? 0.09 : 0.10);
  const powerEvery = (difficulty === 'easy') ? 8 : (difficulty === 'hard' ? 6 : 7);

  // --------- Start engine (mode-factory) ----------
  let instSpawner = null;

  // init UI at start
  renderQuestUI();
  renderScoreUI();
  renderFever();

  coachSay('แตะ/ยิงที่วงเล็ง ○ เก็บน้ำดี 💧 แล้วเลี่ยงน้ำหวาน 🥤 รักษา GREEN!', 'neutral');

  ROOT.addEventListener('hha:time', onTime);

  instSpawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    // ✅ IMPORTANT: spawn ลง playfield (ไม่ใช่ overlay fixed)
    spawnHost: '#hvr-playfield',

    pools,
    goodRate,
    powerups,
    powerRate,
    powerEvery,

    spawnStyle: 'pop',
    judge,
    onExpire
  });

  // expose active instance (เผื่อ html อยากเรียก)
  const api = {
    stop() { finishGame(); },
    getState() {
      const greenPct = (totalSec > 0) ? (greenSec / totalSec) * 100 : 0;
      return { score, miss, combo, comboMax, water, zone, secLeft, totalSec, greenSec, greenPct, fever, feverActive, shield };
    }
  };

  try { ROOT.HHA_ACTIVE_INST = api; } catch {}

  return api;
}

export default { boot };
