// === /fitness/js/engine.js ===
// Shadow Breaker — Engine (ESM)
// ✅ FIX: import { SessionLogger } from './session-logger.js'
// ✅ PATCH: renderer.playHitFx(...) (แก้เอฟเฟกต์หายเกลี้ยง)
// ✅ Works with: dom-renderer-shadow.js, fx-burst.js, event-logger.js, session-logger.js
// ✅ View switching: menu / play / result
// ✅ Normal/Research mode (research shows participant meta)
// ✅ CSV download buttons (event + session)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { SessionLogger, downloadSessionCsv } from './session-logger.js';

// ---------------- helpers ----------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const nowMs = () => performance.now();
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const qs = (sel) => document.querySelector(sel);

function setText(id, t) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(t);
}

function setView(which) {
  const menu = document.getElementById('sb-view-menu');
  const play = document.getElementById('sb-view-play');
  const result = document.getElementById('sb-view-result');
  if (!menu || !play || !result) return;

  menu.classList.toggle('is-active', which === 'menu');
  play.classList.toggle('is-active', which === 'play');
  result.classList.toggle('is-active', which === 'result');
}

// ---------------- DOM refs ----------------
const wrapEl = document.getElementById('sb-wrap');

const btnModeNormal = document.getElementById('sb-mode-normal');
const btnModeResearch = document.getElementById('sb-mode-research');
const modeDesc = document.getElementById('sb-mode-desc');
const researchBox = document.getElementById('sb-research-box');

const selDiff = document.getElementById('sb-diff');
const selTime = document.getElementById('sb-time');

const inpPid = document.getElementById('sb-part-id');
const inpGroup = document.getElementById('sb-part-group');
const inpNote = document.getElementById('sb-part-note');

const btnPlay = document.getElementById('sb-btn-play');
const btnResearch = document.getElementById('sb-btn-research');
const btnHowto = document.getElementById('sb-btn-howto');
const howtoBox = document.getElementById('sb-howto');

const btnBackMenu = document.getElementById('sb-btn-back-menu');
const chkStop = document.getElementById('sb-btn-pause');

const btnRetry = document.getElementById('sb-btn-result-retry');
const btnMenuFromResult = document.getElementById('sb-btn-result-menu');
const btnDlEvents = document.getElementById('sb-btn-download-events');
const btnDlSession = document.getElementById('sb-btn-download-session');

const targetLayer = document.getElementById('sb-target-layer');
const msgMain = document.getElementById('sb-msg-main');

// boss meta panel
const metaEmoji = document.getElementById('sb-meta-emoji');
const metaName = document.getElementById('sb-meta-name');
const metaDesc = document.getElementById('sb-meta-desc');
const bossPhaseLabel = document.getElementById('sb-boss-phase-label');
const bossShieldLabel = document.getElementById('sb-boss-shield-label');
const bossNameTop = document.getElementById('sb-current-boss-name');

// bars
const hpYouTop = document.getElementById('sb-hp-you-top');
const hpBossTop = document.getElementById('sb-hp-boss-top');
const hpYouBottom = document.getElementById('sb-hp-you-bottom');
const hpBossBottom = document.getElementById('sb-hp-boss-bottom');
const feverBar = document.getElementById('sb-fever-bar');
const feverLabel = document.getElementById('sb-label-fever');

// hud numbers
const tTime = document.getElementById('sb-text-time');
const tScore = document.getElementById('sb-text-score');
const tCombo = document.getElementById('sb-text-combo');
const tPhase = document.getElementById('sb-text-phase');
const tMiss = document.getElementById('sb-text-miss');
const tShield = document.getElementById('sb-text-shield');

// result fields
const rTime = document.getElementById('sb-res-time');
const rScore = document.getElementById('sb-res-score');
const rMaxCombo = document.getElementById('sb-res-max-combo');
const rMiss = document.getElementById('sb-res-miss');
const rPhase = document.getElementById('sb-res-phase');
const rBossCleared = document.getElementById('sb-res-boss-cleared');
const rAcc = document.getElementById('sb-res-acc');
const rGrade = document.getElementById('sb-res-grade');

// ---------------- game config ----------------
const BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣', desc: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน' },
  { name: 'Neon Hydra', emoji: '🐉', desc: 'สลับเป้าไวขึ้น—อย่าหลงกับ decoy' },
  { name: 'Inferno Core', emoji: '🔥', desc: 'หลบ bomb และเก็บ shield ให้พอ' },
  { name: 'Violet Titan', emoji: '🟣', desc: 'ช่วงท้ายจะหลอกหนัก—ต้องคมและนิ่ง' }
];

const DIFF = {
  easy:   { spawnMs:[520, 760], ttlMs:[1100, 1450], size:[140, 220], bomb:0.06, decoy:0.10, heal:0.08, shield:0.07, bossHp: 105 },
  normal: { spawnMs:[430, 680], ttlMs:[920, 1250],  size:[120, 200], bomb:0.10, decoy:0.14, heal:0.06, shield:0.06, bossHp: 120 },
  hard:   { spawnMs:[360, 560], ttlMs:[820, 1100],  size:[110, 190], bomb:0.14, decoy:0.18, heal:0.05, shield:0.05, bossHp: 140 }
};

// ---------------- runtime state ----------------
let mode = 'normal'; // 'normal' | 'research'
let diff = 'normal';
let durationSec = 70;

let running = false;
let stopped = false;

let startT = 0;
let lastSpawnAt = 0;
let nextSpawnIn = 520;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

let fever = 0;             // 0..100
let feverOnUntil = 0;      // perf.now ms
let shield = 0;            // count

let playerHp = 100;        // 0..100
let bossHp = 100;          // 0..100 (normalized for bar)
let bossHpMax = 120;

let bossIndex = 0;
let phase = 1;
let bossesCleared = 0;

let targetSeq = 1;
let targets = new Map(); // id -> { id, type, bornMs, ttlMs, sizePx, timeoutId }

const eventLogger = new EventLogger();
const sessionLogger = new SessionLogger();

let renderer = null;

// ---------------- UI / mode ----------------
function setMode(m) {
  mode = (m === 'research') ? 'research' : 'normal';

  btnModeNormal?.classList.toggle('is-active', mode === 'normal');
  btnModeResearch?.classList.toggle('is-active', mode === 'research');

  researchBox?.classList.toggle('is-on', mode === 'research');

  if (modeDesc) {
    modeDesc.textContent =
      (mode === 'research')
        ? 'Research: เก็บข้อมูลแบบ Session/Event (ดาวน์โหลด CSV ได้ที่หน้า Result)'
        : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
  }

  // start buttons
  if (btnPlay) btnPlay.style.display = (mode === 'normal') ? '' : 'none';
  if (btnResearch) btnResearch.style.display = (mode === 'research') ? '' : 'none';
}

function readSettings() {
  diff = (selDiff?.value || 'normal').toLowerCase();
  if (!DIFF[diff]) diff = 'normal';

  durationSec = Number(selTime?.value) || 70;
  durationSec = clamp(durationSec, 30, 180);

  if (wrapEl) wrapEl.dataset.diff = diff;
}

// ---------------- boss / HUD update ----------------
function setBoss(idx) {
  bossIndex = clamp(idx, 0, BOSSES.length - 1);
  const b = BOSSES[bossIndex];

  if (bossNameTop) bossNameTop.textContent = `${b.name} ${b.emoji}`;
  if (metaEmoji) metaEmoji.textContent = b.emoji;
  if (metaName) metaName.textContent = b.name;
  if (metaDesc) metaDesc.textContent = b.desc;

  // reset boss hp
  bossHpMax = DIFF[diff].bossHp;
  bossHp = bossHpMax;
}

function setMsg(cls, text) {
  if (!msgMain) return;
  msgMain.classList.remove('good','bad','miss','perfect');
  if (cls) msgMain.classList.add(cls);
  msgMain.textContent = text || '';
}

function setBarFill(el, pct, isBoss) {
  if (!el) return;
  const p = clamp(pct, 0, 100) / 100;
  el.style.transform = `scaleX(${p})`;
  if (isBoss) el.classList.add('boss');
}

function updateHUD(elapsedSec, leftSec) {
  if (tTime) tTime.textContent = `${leftSec.toFixed(1)} s`;
  if (tScore) tScore.textContent = String(score);
  if (tCombo) tCombo.textContent = String(combo);
  if (tPhase) tPhase.textContent = String(phase);
  if (tMiss) tMiss.textContent = String(miss);
  if (tShield) tShield.textContent = String(shield);

  const youPct = clamp(playerHp, 0, 100);
  const bossPct = bossHpMax > 0 ? clamp((bossHp / bossHpMax) * 100, 0, 100) : 0;

  setBarFill(hpYouTop, youPct, false);
  setBarFill(hpYouBottom, youPct, false);
  setBarFill(hpBossTop, bossPct, true);
  setBarFill(hpBossBottom, bossPct, true);

  const fPct = clamp(fever, 0, 100);
  if (feverBar) feverBar.style.transform = `scaleX(${fPct / 100})`;

  const feverOn = nowMs() < feverOnUntil;
  if (feverLabel) {
    feverLabel.textContent = feverOn ? 'ON' : (fPct >= 100 ? 'READY' : `${Math.round(fPct)}%`);
    feverLabel.classList.toggle('on', feverOn);
  }

  if (bossPhaseLabel) bossPhaseLabel.textContent = String(phase);
  if (bossShieldLabel) bossShieldLabel.textContent = String(shield);
}

// ---------------- target type / scoring ----------------
function rollTargetType() {
  const cfg = DIFF[diff];
  const r = Math.random();
  const pBomb = cfg.bomb;
  const pDecoy = cfg.decoy;
  const pHeal = cfg.heal;
  const pShield = cfg.shield;

  // normalize by order
  if (r < pBomb) return 'bomb';
  if (r < pBomb + pDecoy) return 'decoy';
  if (r < pBomb + pDecoy + pHeal) return 'heal';
  if (r < pBomb + pDecoy + pHeal + pShield) return 'shield';

  // bossface cameo sometimes when boss low
  if (bossHpMax > 0 && bossHp / bossHpMax < 0.25 && Math.random() < 0.18) return 'bossface';

  return 'normal';
}

function calcSizePx() {
  const [a, b] = DIFF[diff].size;
  // ปรับไซซ์ตามจอ: ไม่ให้ใหญ่เกินไปบนมือถือ
  const vw = Math.max(320, window.innerWidth || 800);
  const base = rand(a, b);
  const scale = clamp(vw / 980, 0.75, 1.05);
  return Math.round(base * scale);
}

function calcTtlMs() {
  const [a, b] = DIFF[diff].ttlMs;
  // ปรับตาม phase: phase สูง => สั้นลงนิด
  const k = clamp(1 - (phase - 1) * 0.07, 0.78, 1);
  return Math.round(rand(a, b) * k);
}

function gradeFromRt(rtMs) {
  if (rtMs <= 220) return 'perfect';
  if (rtMs <= 460) return 'good';
  return 'bad';
}

// ---------------- FX-safe (PATCH) ----------------
function playFxOnHit(targetId, info) {
  try {
    renderer?.playHitFx?.(targetId, info);
  } catch (e) {
    // fail-safe: never break game loop due to FX
    console.warn('[SB] FX fail', e);
  }
}

// ---------------- spawn / expire ----------------
function spawnOne() {
  if (!running || stopped) return;
  if (!renderer || !targetLayer) return;

  const id = targetSeq++;
  const type = rollTargetType();
  const ttlMs = calcTtlMs();
  const sizePx = calcSizePx();

  const born = nowMs();
  const b = BOSSES[bossIndex];

  const data = {
    id,
    type,
    bornMs: born,
    ttlMs,
    sizePx,
    bossEmoji: b?.emoji || '👊'
  };

  // schedule expire
  const timeoutId = window.setTimeout(() => {
    // already removed?
    if (!targets.has(id)) return;

    // expire miss logic
    targets.delete(id);
    renderer.removeTarget(id, 'timeout');

    // count miss for normal/bossface/heal/shield/decoy/bomb => only if "judged" as missed target
    miss += 1;
    combo = 0;

    sessionLogger.onMiss();
    eventLogger.add({
      ts_ms: Date.now(),
      mode,
      diff,
      boss_index: bossIndex,
      boss_phase: phase,
      target_id: id,
      target_type: type,
      is_boss_face: type === 'bossface',
      event_type: 'timeout_miss',
      rt_ms: '',
      grade: 'miss',
      score_delta: 0,
      combo_after: combo,
      score_after: score,
      player_hp: playerHp,
      boss_hp: bossHp
    });

    setMsg('miss', 'ช้าไป! เป้าหายแล้ว');
  }, ttlMs);

  targets.set(id, { id, type, bornMs: born, ttlMs, sizePx, timeoutId });
  renderer.spawnTarget(data);
}

function clearAllTargets() {
  for (const t of targets.values()) {
    try { clearTimeout(t.timeoutId); } catch {}
    try { renderer?.removeTarget?.(t.id, 'clear'); } catch {}
  }
  targets.clear();
}

// ---------------- core hit handler ----------------
function onTargetHit(id, posInfo) {
  if (!running || stopped) return;
  const t = targets.get(id);
  if (!t) return;

  // stop expiry
  try { clearTimeout(t.timeoutId); } catch {}
  targets.delete(id);

  const rt = Math.max(1, Math.round(nowMs() - t.bornMs));
  let scoreDelta = 0;

  const feverOn = nowMs() < feverOnUntil;
  const mult = feverOn ? 1.35 : 1.0;

  let eventType = 'hit';
  let grade = 'good';

  if (t.type === 'normal' || t.type === 'bossface') {
    grade = gradeFromRt(rt);
    if (grade === 'perfect') scoreDelta = Math.round(20 * mult);
    else if (grade === 'good') scoreDelta = Math.round(12 * mult);
    else scoreDelta = Math.round(6 * mult);

    // damage boss
    const dmg = (t.type === 'bossface')
      ? Math.round(18 * mult)
      : Math.round((grade === 'perfect' ? 10 : grade === 'good' ? 7 : 4) * mult);

    bossHp = Math.max(0, bossHp - dmg);

    // combo
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);

    // fever
    fever = clamp(fever + (grade === 'perfect' ? 10 : 6), 0, 100);
    if (fever >= 100 && !feverOn) {
      feverOnUntil = nowMs() + 5200;
      fever = 100;
      setMsg('perfect', 'FEVER ON! 🔥 ตีให้เดือด!');
    } else {
      setMsg(grade === 'perfect' ? 'perfect' : 'good',
        grade === 'perfect' ? 'PERFECT!' : 'GOOD!');
    }

    // log
    sessionLogger.onHit(true, rt);

  } else if (t.type === 'decoy') {
    eventType = 'hit_decoy';
    grade = 'bad';
    scoreDelta = -8;

    // punish: reduce hp unless shield
    if (shield > 0) {
      shield -= 1;
      scoreDelta = -2;
      setMsg('bad', 'Decoy! แต่ Shield กันไว้ได้ 🛡️');
    } else {
      playerHp = Math.max(0, playerHp - 10);
      setMsg('bad', 'Decoy! เสียจังหวะ 😵');
    }

    combo = 0;
    fever = clamp(fever - 10, 0, 100);

    sessionLogger.onJudged(false);

  } else if (t.type === 'bomb') {
    eventType = 'hit_bomb';
    grade = 'bomb';
    scoreDelta = -15;

    if (shield > 0) {
      shield -= 1;
      scoreDelta = -4;
      setMsg('miss', 'BOMB! แต่ Shield กันไว้ได้ 🛡️');
    } else {
      playerHp = Math.max(0, playerHp - 18);
      setMsg('miss', 'BOMB! โดนเต็ม 💥');
    }

    combo = 0;
    fever = clamp(fever - 14, 0, 100);

    sessionLogger.onJudged(false);

  } else if (t.type === 'heal') {
    eventType = 'hit_heal';
    grade = 'heal';
    scoreDelta = 6;

    playerHp = Math.min(100, playerHp + 14);
    setMsg('good', 'HEAL +HP 🩹');

    // heal counts as judged hit
    sessionLogger.onHit(true, rt);

  } else if (t.type === 'shield') {
    eventType = 'hit_shield';
    grade = 'shield';
    scoreDelta = 6;

    shield = clamp(shield + 1, 0, 9);
    setMsg('good', 'SHIELD +1 🛡️');

    sessionLogger.onHit(true, rt);
  }

  // apply score and miss counters
  score = Math.max(0, score + scoreDelta);

  // remove element
  renderer.removeTarget(id, 'hit');

  // ✅ PATCH: play FX at hit position
  playFxOnHit(id, { clientX: posInfo?.clientX, clientY: posInfo?.clientY, grade, scoreDelta });

  // event log
  eventLogger.add({
    ts_ms: Date.now(),
    mode,
    diff,
    boss_index: bossIndex,
    boss_phase: phase,
    target_id: id,
    target_type: t.type,
    is_boss_face: t.type === 'bossface',
    event_type: eventType,
    rt_ms: rt,
    grade,
    score_delta: scoreDelta,
    combo_after: combo,
    score_after: score,
    player_hp: playerHp,
    boss_hp: bossHp
  });

  // boss defeated?
  if (bossHp <= 0) {
    bossesCleared += 1;
    // next boss or next phase
    if (bossIndex < BOSSES.length - 1) {
      bossIndex += 1;
      phase += 1;
      setBoss(bossIndex);
      setMsg('perfect', 'BOSS BREAK! ไปต่อ!');
    } else {
      // loop final boss with higher hp each phase
      phase += 1;
      bossHpMax = Math.round(bossHpMax * 1.08);
      bossHp = bossHpMax;
      setMsg('perfect', 'FINAL LOOP! โหดขึ้นอีก 🔥');
    }
  }

  // player dead?
  if (playerHp <= 0) {
    endGame('lose');
  }
}

// ---------------- game loop ----------------
function scheduleNextSpawn() {
  const [a, b] = DIFF[diff].spawnMs;
  // phase up -> spawn faster
  const k = clamp(1 - (phase - 1) * 0.06, 0.72, 1);
  nextSpawnIn = Math.round(rand(a, b) * k);
}

function tick() {
  if (!running) return;

  if (stopped) {
    // while stopped, keep ticking so UI not freeze
    requestAnimationFrame(tick);
    return;
  }

  const t = nowMs();
  const elapsed = (t - startT) / 1000;
  const left = Math.max(0, durationSec - elapsed);

  updateHUD(elapsed, left);

  // spawns
  if (t - lastSpawnAt >= nextSpawnIn) {
    lastSpawnAt = t;
    spawnOne();
    scheduleNextSpawn();
  }

  // time end
  if (left <= 0) {
    endGame('time');
    return;
  }

  requestAnimationFrame(tick);
}

// ---------------- start / end ----------------
function startGame(runMode) {
  readSettings();
  setMode(runMode);

  // init state
  running = true;
  stopped = false;
  chkStop && (chkStop.checked = false);

  score = 0;
  combo = 0;
  maxCombo = 0;
  miss = 0;

  fever = 0;
  feverOnUntil = 0;

  shield = 0;
  playerHp = 100;

  phase = 1;
  bossesCleared = 0;
  targetSeq = 1;
  targets.clear();

  // boss
  setBoss(0);

  // renderer
  if (!targetLayer) {
    alert('ไม่พบ sb-target-layer');
    return;
  }
  try {
    renderer?.destroy?.();
  } catch {}
  renderer = new DomRendererShadow(targetLayer, {
    wrapEl,
    feedbackEl: msgMain,
    onTargetHit
  });
  renderer.setDifficulty(diff);

  // loggers begin
  const sessionId = `SB_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  eventLogger.clear();
  sessionLogger.begin({
    session_id: sessionId,
    mode,
    diff,
    duration_sec: durationSec,
    participant_id: inpPid?.value || '',
    group: inpGroup?.value || '',
    note: inpNote?.value || ''
  });

  // view
  setView('play');
  setMsg('', 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');

  // loop
  startT = nowMs();
  lastSpawnAt = startT;
  scheduleNextSpawn();
  requestAnimationFrame(tick);
}

function computeGrade(accPct) {
  if (accPct >= 90) return 'SSS';
  if (accPct >= 82) return 'SS';
  if (accPct >= 74) return 'S';
  if (accPct >= 62) return 'A';
  if (accPct >= 50) return 'B';
  return 'C';
}

function endGame(reason) {
  if (!running) return;
  running = false;

  clearAllTargets();

  const elapsed = clamp((nowMs() - startT) / 1000, 0, durationSec);
  const judged = sessionLogger.totalJudged || 0;
  const hit = sessionLogger.totalHit || 0;
  const accPct = judged > 0 ? (hit / judged) * 100 : 0;

  const grade = computeGrade(accPct);

  // finalize session row
  sessionLogger.end({
    time_sec: Number(elapsed.toFixed(1)),
    score,
    max_combo: maxCombo,
    miss,
    bosses_cleared: bossesCleared,
    phase,
    accuracy_pct: Number(accPct.toFixed(1)),
    grade
  });

  // result UI
  if (rTime) rTime.textContent = `${elapsed.toFixed(1)} s`;
  if (rScore) rScore.textContent = String(score);
  if (rMaxCombo) rMaxCombo.textContent = String(maxCombo);
  if (rMiss) rMiss.textContent = String(miss);
  if (rPhase) rPhase.textContent = String(phase);
  if (rBossCleared) rBossCleared.textContent = String(bossesCleared);
  if (rAcc) rAcc.textContent = `${accPct.toFixed(1)} %`;
  if (rGrade) rGrade.textContent = grade;

  setView('result');
}

// ---------------- wiring ----------------
btnModeNormal?.addEventListener('click', () => setMode('normal'));
btnModeResearch?.addEventListener('click', () => setMode('research'));

btnHowto?.addEventListener('click', () => {
  howtoBox?.classList.toggle('is-on');
});

btnPlay?.addEventListener('click', () => startGame('normal'));
btnResearch?.addEventListener('click', () => {
  // optional: require participant id in research
  startGame('research');
});

btnBackMenu?.addEventListener('click', () => {
  running = false;
  clearAllTargets();
  setView('menu');
});

chkStop?.addEventListener('change', () => {
  stopped = !!chkStop.checked;
  if (stopped) setMsg('miss', 'STOP — กดปิดเพื่อเล่นต่อ');
  else setMsg('', 'ไปต่อ!');
});

btnRetry?.addEventListener('click', () => startGame(mode));
btnMenuFromResult?.addEventListener('click', () => setView('menu'));

btnDlEvents?.addEventListener('click', () => {
  const fn = sessionLogger.makeEventFilename('shadow-breaker-events');
  downloadEventCsv(eventLogger, fn);
});

btnDlSession?.addEventListener('click', () => {
  const fn = sessionLogger.makeSessionFilename('shadow-breaker-session');
  downloadSessionCsv(sessionLogger, fn);
});

// init
setMode('normal');
setView('menu');

// sync settings on change
selDiff?.addEventListener('change', readSettings);
selTime?.addEventListener('change', readSettings);
readSettings();