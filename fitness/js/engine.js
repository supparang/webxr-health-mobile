// === /fitness/js/engine.js ===
// Rhythm Boxer — Engine (ESM) + RB_AI predictor bridge
// ✅ calls window.RB_AI.predict(snapshot)
// ✅ research lock: mode=research -> NO assist (still can show tip if you want; here we keep read-only)
// ✅ normal assist: only when ?ai=1 (RB_AI.isAssistEnabled() === true)

'use strict';

// -------------------- DOM --------------------
const $ = (id) => document.getElementById(id);

const elWrap = $('rb-wrap');
const elStart = $('rb-btn-start');
const elPause = $('rb-btn-pause');
const elBack = $('rb-btn-back');
const elDiff = $('rb-diff');
const elTime = $('rb-time');

const elTimeText = $('rb-text-time');
const elScoreText = $('rb-text-score');
const elComboText = $('rb-text-combo');
const elAccText = $('rb-text-acc');

const elHitP = $('rb-hit-perfect');
const elHitG = $('rb-hit-great');
const elHitGood = $('rb-hit-good');
const elHitMiss = $('rb-hit-miss');

const elHpBar = $('rb-hp-bar');
const elMsg = $('rb-msg');

// AI UI (optional in layout; engine will not crash if missing)
const elAiBadge = $('rb-ai-badge');     // e.g. "AI ON" / "AI LOCKED"
const elAiTip = $('rb-ai-tip');         // micro tip text
const elAiSuggest = $('rb-ai-suggest'); // suggested diff text

// -------------------- AI bridge --------------------
function getAI() {
  // ai-predictor.js exposes window.RB_AI
  return window.RB_AI || null;
}
function aiMode() {
  return getAI()?.getMode?.() || 'normal';
}
function aiAssistEnabled() {
  return !!getAI()?.isAssistEnabled?.();
}
function aiLocked() {
  return !!getAI()?.isLocked?.();
}
function aiPredict(snapshot) {
  const ai = getAI();
  if (!ai || typeof ai.predict !== 'function') return null;
  return ai.predict(snapshot);
}

// -------------------- helpers --------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const clamp01 = (v) => clamp(v, 0, 1);
const nowMs = () => performance.now();

function setMsg(text, tone) {
  if (!elMsg) return;
  elMsg.textContent = text || '';
  elMsg.className = 'rb-msg';
  if (tone) elMsg.classList.add(tone);
}

function setAiBadge() {
  if (!elAiBadge) return;
  const mode = aiMode();
  if (mode === 'research') {
    elAiBadge.textContent = 'AI LOCKED (research)';
    elAiBadge.className = 'rb-ai-badge locked';
  } else if (aiAssistEnabled()) {
    elAiBadge.textContent = 'AI ON';
    elAiBadge.className = 'rb-ai-badge on';
  } else {
    elAiBadge.textContent = 'AI OFF';
    elAiBadge.className = 'rb-ai-badge off';
  }
}

// -------------------- difficulty presets --------------------
const DIFF = {
  easy:   { label:'Easy',   noteSpeed: 1.00, hitWindowMs: 140 }, // กว้างขึ้น
  normal: { label:'Normal', noteSpeed: 1.15, hitWindowMs: 115 },
  hard:   { label:'Hard',   noteSpeed: 1.30, hitWindowMs:  95 }  // แคบลง
};

// -------------------- state --------------------
let S = null;
let rafId = null;
let tickPrev = 0;

function resetUI() {
  if (elTimeText) elTimeText.textContent = '0.0 s';
  if (elScoreText) elScoreText.textContent = '0';
  if (elComboText) elComboText.textContent = '0';
  if (elAccText) elAccText.textContent = '0.0 %';

  if (elHitP) elHitP.textContent = '0';
  if (elHitG) elHitG.textContent = '0';
  if (elHitGood) elHitGood.textContent = '0';
  if (elHitMiss) elHitMiss.textContent = '0';

  if (elHpBar) elHpBar.style.transform = 'scaleX(1)';

  if (elAiTip) elAiTip.textContent = '';
  if (elAiSuggest) elAiSuggest.textContent = '';
  setMsg('กด Start แล้วชกตามจังหวะ!', 'hint');

  setAiBadge();
}

function startGame() {
  const diffKey = (elDiff?.value || 'normal').toLowerCase();
  const durationSec = parseInt(elTime?.value || '60', 10) || 60;
  const base = DIFF[diffKey] || DIFF.normal;

  S = {
    running: true,
    paused: false,
    diffKey,
    durationSec,
    timeLeftMs: durationSec * 1000,

    // scoring
    score: 0,
    combo: 0,
    maxCombo: 0,

    // judgement counts
    hitPerfect: 0,
    hitGreat: 0,
    hitGood: 0,
    hitMiss: 0,

    // timing stats (offset in seconds)
    offAbsSum: 0,
    offAbsCount: 0,

    // hp 0..100
    hp: 100,

    // pacing parameters (may be adjusted by AI assist)
    noteSpeed: base.noteSpeed,
    hitWindowMs: base.hitWindowMs,

    // AI loop
    aiLastAt: 0,
    aiEveryMs: 900,        // ประเมินทุก ~0.9s
    aiLastSuggested: diffKey,

    startedAt: nowMs()
  };

  setAiBadge();
  resetUI();
  showRunMeta();

  tickPrev = nowMs();
  rafId = requestAnimationFrame(loop);

  // TODO: start your note scheduler here using S.noteSpeed
  // e.g., NoteEngine.start({ speed: S.noteSpeed, hitWindowMs: S.hitWindowMs, onJudge: onJudge })
  setMsg('เริ่มแล้ว! ชกให้ตรงเส้น 🎵🥊', 'good');
}

function stopGame(reason) {
  if (!S) return;
  S.running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  // TODO: stop note engine
  // NoteEngine.stop();

  setMsg(reason === 'timeup' ? 'หมดเวลา!' : 'หยุดเกม', 'hint');
}

function togglePause() {
  if (!S || !S.running) return;
  S.paused = !S.paused;
  if (S.paused) {
    setMsg('พักเกม (Pause)', 'hint');
  } else {
    setMsg('ลุยต่อ!', 'good');
    tickPrev = nowMs();
  }
}

function showRunMeta() {
  if (!elWrap || !S) return;
  elWrap.dataset.diff = S.diffKey;
  elWrap.dataset.mode = aiMode(); // normal | research
  elWrap.dataset.ai = aiAssistEnabled() ? '1' : '0';
}

// -------------------- snapshot -> AI --------------------
function makeSnapshot() {
  if (!S) return {};
  const judged = S.hitPerfect + S.hitGreat + S.hitGood + S.hitMiss;
  const hits = S.hitPerfect + S.hitGreat + S.hitGood;
  const accPct = judged > 0 ? (hits / judged) * 100 : 0;

  const offsetAbsMean = S.offAbsCount > 0 ? (S.offAbsSum / S.offAbsCount) : NaN; // seconds
  return {
    accPct: +accPct.toFixed(2),

    hitPerfect: S.hitPerfect,
    hitGreat: S.hitGreat,
    hitGood: S.hitGood,
    hitMiss: S.hitMiss,

    combo: S.combo,
    hp: +S.hp.toFixed(0),

    offsetAbsMean: Number.isFinite(offsetAbsMean) ? +offsetAbsMean.toFixed(4) : '',

    songTime: ((S.durationSec * 1000 - S.timeLeftMs) / 1000), // seconds elapsed
    durationSec: S.durationSec
  };
}

function applyAIAssist(out) {
  // ✅ ต้องไม่ใช่ research และต้องเปิด ?ai=1 เท่านั้น
  if (!S || !S.running) return;
  if (aiLocked() || !aiAssistEnabled()) return;
  if (!out) return;

  // นิ่ม ๆ: ถ้า fatigue สูง -> ผ่อน (เพิ่ม hit window + ลด speed)
  // ถ้า skill สูง + fatigue ต่ำ -> เร่ง (ลด hit window + เพิ่ม speed)
  const fr = clamp01(out.fatigueRisk);
  const sk = clamp01(out.skillScore);

  // step เล็กมาก กันเด้ง
  const wStep = 1.2;  // ms
  const sStep = 0.01; // speed

  if (fr > 0.68) {
    S.hitWindowMs = clamp(S.hitWindowMs + wStep, 85, 170);
    S.noteSpeed = clamp(S.noteSpeed - sStep, 0.90, 1.45);
  } else if (sk > 0.78 && fr < 0.35) {
    S.hitWindowMs = clamp(S.hitWindowMs - wStep, 85, 170);
    S.noteSpeed = clamp(S.noteSpeed + sStep, 0.90, 1.45);
  }

  // suggested difficulty text (ไม่ auto เปลี่ยน diff dropdown ให้กระชาก)
  if (elAiSuggest && out.suggestedDifficulty) {
    elAiSuggest.textContent = `AI Suggest: ${out.suggestedDifficulty.toUpperCase()}`;
  }
}

// -------------------- core loop --------------------
function loop(t) {
  if (!S || !S.running) return;

  if (S.paused) {
    rafId = requestAnimationFrame(loop);
    return;
  }

  const dt = t - tickPrev;
  tickPrev = t;

  S.timeLeftMs -= dt;
  if (S.timeLeftMs <= 0) {
    S.timeLeftMs = 0;
    renderHUD();
    stopGame('timeup');
    return;
  }

  // AI evaluate
  if (t - S.aiLastAt >= S.aiEveryMs) {
    S.aiLastAt = t;
    const snap = makeSnapshot();
    const out = aiPredict(snap);

    if (out) {
      // tip (read-only ใน research ก็ยังโชว์ได้—ถ้าอยากล็อกก็เช็ค aiLocked() แล้วค่อยไม่โชว์)
      if (elAiTip && out.tip) elAiTip.textContent = out.tip;

      // assist (only normal + ?ai=1)
      applyAIAssist(out);
    }
  }

  renderHUD();
  rafId = requestAnimationFrame(loop);
}

// -------------------- render HUD --------------------
function renderHUD() {
  if (!S) return;

  if (elTimeText) elTimeText.textContent = (S.timeLeftMs / 1000).toFixed(1) + ' s';
  if (elScoreText) elScoreText.textContent = String(S.score);
  if (elComboText) elComboText.textContent = String(S.combo);

  const judged = S.hitPerfect + S.hitGreat + S.hitGood + S.hitMiss;
  const hits = S.hitPerfect + S.hitGreat + S.hitGood;
  const accPct = judged > 0 ? (hits / judged) * 100 : 0;
  if (elAccText) elAccText.textContent = accPct.toFixed(1) + ' %';

  if (elHitP) elHitP.textContent = String(S.hitPerfect);
  if (elHitG) elHitG.textContent = String(S.hitGreat);
  if (elHitGood) elHitGood.textContent = String(S.hitGood);
  if (elHitMiss) elHitMiss.textContent = String(S.hitMiss);

  if (elHpBar) elHpBar.style.transform = `scaleX(${clamp01(S.hp / 100)})`;
}

// -------------------- judgement API (to be called by note engine) --------------------
// offsetSec: + = late, - = early (seconds)
export function onJudge(result, offsetSec) {
  if (!S || !S.running || S.paused) return;

  const offAbs = Math.abs(Number(offsetSec) || 0);
  if (Number.isFinite(offAbs)) {
    S.offAbsSum += offAbs;
    S.offAbsCount += 1;
  }

  // result: 'perfect' | 'great' | 'good' | 'miss'
  if (result === 'perfect') {
    S.hitPerfect++;
    S.score += 160;
    S.combo++;
  } else if (result === 'great') {
    S.hitGreat++;
    S.score += 120;
    S.combo++;
  } else if (result === 'good') {
    S.hitGood++;
    S.score += 80;
    S.combo++;
  } else {
    S.hitMiss++;
    S.score = Math.max(0, S.score - 90);
    S.combo = 0;

    // HP drop on miss (tunable)
    S.hp = clamp(S.hp - 7, 0, 100);
    if (S.hp <= 0) {
      stopGame('dead');
      return;
    }
  }

  if (S.combo > S.maxCombo) S.maxCombo = S.combo;
}

// -------------------- boot / wire --------------------
function wireUI() {
  if (elStart) elStart.addEventListener('click', startGame);
  if (elPause) elPause.addEventListener('click', togglePause);
  if (elBack) elBack.addEventListener('click', () => stopGame('back'));

  // reflect AI mode badge
  setAiBadge();
}

function init() {
  wireUI();
  resetUI();

  // In case AI script loads after engine:
  window.addEventListener('load', () => {
    setAiBadge();
  });

  console.log('[RhythmBoxer] engine init complete');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}