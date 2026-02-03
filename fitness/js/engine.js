// === /fitness/js/engine.js ===
// Shadow Breaker Engine — PRODUCTION (PATCHED)
// ✅ Menu/Play/Result view switching
// ✅ Spawns targets via DomRendererShadow
// ✅ FX restored: calls renderer.playHitFx(...) on every judged outcome
// ✅ CSV downloads: event + session
// ✅ Research lock: in research mode, AI assist OFF by default
// Requires:
//  - ./dom-renderer-shadow.js
//  - ./event-logger.js
//  - ./session-logger.js
//  - ./pattern-generator.js (optional; safe fallback)
//  - ./ai-features.js (optional; safe fallback)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { SessionLogger, downloadSessionCsv } from './session-logger.js';

// optional modules (safe)
let PatternGen = null;
let AiFeatures = null;

try {
  const m = await import('./pattern-generator.js');
  PatternGen = m?.PatternGenerator || m?.default || null;
} catch (_) { /* optional */ }

try {
  const m = await import('./ai-features.js');
  AiFeatures = m?.AiFeatures || m?.default || null;
} catch (_) { /* optional */ }

// ---------- helpers ----------
const DOC = document;
const WIN = window;

const qs = (s, el = DOC) => el.querySelector(s);
const qsa = (s, el = DOC) => Array.from(el.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const nowMs = () => performance.now();

function readQuery(k, d = null) {
  try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; }
}
function setQueryParam(url, key, value) {
  try {
    const u = new URL(url);
    if (value == null) u.searchParams.delete(key);
    else u.searchParams.set(key, String(value));
    return u.toString();
  } catch { return url; }
}

// ---------- AI bridge (global classic script) ----------
function getAiApi() {
  // prefer SB_AI, fallback RB_AI
  return WIN.SB_AI || WIN.RB_AI || null;
}
function getModeFromUiOrQuery(uiMode) {
  const qMode = (readQuery('mode', '') || '').toLowerCase();
  if (qMode === 'research') return 'research';
  if (qMode === 'normal') return 'normal';
  return uiMode || 'normal';
}

// ---------- game tuning ----------
const DIFF = {
  easy:   { spawnEveryMs: 820, ttlMs: 1500, sizePx: 150, score: { good: 10, perfect: 18 }, missPenalty: 0 },
  normal: { spawnEveryMs: 680, ttlMs: 1250, sizePx: 135, score: { good: 12, perfect: 22 }, missPenalty: 0 },
  hard:   { spawnEveryMs: 520, ttlMs: 1050, sizePx: 118, score: { good: 14, perfect: 26 }, missPenalty: 0 },
};

const BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣', desc: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', phases: 3 },
  { name: 'Neon Wasp',    emoji: '🐝', desc: 'มันไวขึ้น—อย่าตีรัว ให้ตี “ชัวร์”', phases: 3 },
  { name: 'Shadow Titan', emoji: '🦂', desc: 'เฟสท้ายจะหลอกเยอะ—เก็บคอมโบให้ดี', phases: 4 },
];

function gradeFromRt(rtMs, ttlMs) {
  // simple judgement: perfect if early enough
  const p = clamp(rtMs / ttlMs, 0, 1);
  if (p <= 0.33) return 'perfect';
  return 'good';
}

// ---------- state ----------
const S = {
  view: 'menu',          // menu | play | result
  uiMode: 'normal',      // normal | research
  mode: 'normal',        // resolved
  diff: 'normal',
  durationSec: 70,

  startTsMs: 0,
  endTsMs: 0,
  elapsedMs: 0,
  running: false,
  paused: false,

  // score
  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,
  judged: 0,
  hits: 0,

  // hp/fever/shield
  hpYou: 100,
  hpBoss: 100,
  shield: 0,
  fever: 0,              // 0..100
  feverOn: false,

  // boss
  bossIndex: 0,
  phase: 1,
  bossesCleared: 0,

  // target registry
  nextId: 1,
  live: new Map(), // id -> {id,type,spawnAtMs,ttlMs,expireAtMs,sizePx,bossEmoji}

  // logs
  evLogger: new EventLogger(),
  ssLogger: new SessionLogger(),

  // ai
  aiTipCooldownMs: 0,
  lastTip: '',

  // pattern generator
  pg: null,
};

// ---------- dom refs ----------
const E = {
  // views
  viewMenu: null,
  viewPlay: null,
  viewResult: null,

  // menu
  btnModeNormal: null,
  btnModeResearch: null,
  modeDesc: null,
  diffSel: null,
  timeSel: null,
  researchBox: null,
  partId: null,
  partGroup: null,
  partNote: null,
  btnPlay: null,
  btnResearch: null,
  btnHowto: null,
  howtoBox: null,

  // play HUD
  textTime: null,
  textScore: null,
  textCombo: null,
  textPhase: null,
  textMiss: null,
  textShield: null,
  bossName: null,

  hpYouTop: null,
  hpBossTop: null,
  hpYouBottom: null,
  hpBossBottom: null,

  feverBar: null,
  feverLabel: null,

  msgMain: null,

  metaEmoji: null,
  metaName: null,
  metaDesc: null,
  bossPhaseLabel: null,
  bossShieldLabel: null,

  targetLayer: null,

  // controls
  btnBackMenu: null,
  chkPause: null,

  // result
  resTime: null,
  resScore: null,
  resMaxCombo: null,
  resMiss: null,
  resPhase: null,
  resBossCleared: null,
  resAcc: null,
  resGrade: null,
  btnRetry: null,
  btnMenu: null,
  btnDlEvents: null,
  btnDlSession: null,
};

// renderer
let renderer = null;

// ---------- init ----------
boot();

function boot() {
  // views
  E.viewMenu = qs('#sb-view-menu');
  E.viewPlay = qs('#sb-view-play');
  E.viewResult = qs('#sb-view-result');

  // menu
  E.btnModeNormal = qs('#sb-mode-normal');
  E.btnModeResearch = qs('#sb-mode-research');
  E.modeDesc = qs('#sb-mode-desc');
  E.diffSel = qs('#sb-diff');
  E.timeSel = qs('#sb-time');
  E.researchBox = qs('#sb-research-box');
  E.partId = qs('#sb-part-id');
  E.partGroup = qs('#sb-part-group');
  E.partNote = qs('#sb-part-note');
  E.btnPlay = qs('#sb-btn-play');
  E.btnResearch = qs('#sb-btn-research');
  E.btnHowto = qs('#sb-btn-howto');
  E.howtoBox = qs('#sb-howto');

  // play hud
  E.textTime = qs('#sb-text-time');
  E.textScore = qs('#sb-text-score');
  E.textCombo = qs('#sb-text-combo');
  E.textPhase = qs('#sb-text-phase');
  E.textMiss = qs('#sb-text-miss');
  E.textShield = qs('#sb-text-shield');
  E.bossName = qs('#sb-current-boss-name');

  E.hpYouTop = qs('#sb-hp-you-top');
  E.hpBossTop = qs('#sb-hp-boss-top');
  E.hpYouBottom = qs('#sb-hp-you-bottom');
  E.hpBossBottom = qs('#sb-hp-boss-bottom');

  E.feverBar = qs('#sb-fever-bar');
  E.feverLabel = qs('#sb-label-fever');

  E.msgMain = qs('#sb-msg-main');

  E.metaEmoji = qs('#sb-meta-emoji');
  E.metaName = qs('#sb-meta-name');
  E.metaDesc = qs('#sb-meta-desc');
  E.bossPhaseLabel = qs('#sb-boss-phase-label');
  E.bossShieldLabel = qs('#sb-boss-shield-label');

  E.targetLayer = qs('#sb-target-layer');

  // controls
  E.btnBackMenu = qs('#sb-btn-back-menu');
  E.chkPause = qs('#sb-btn-pause');

  // result
  E.resTime = qs('#sb-res-time');
  E.resScore = qs('#sb-res-score');
  E.resMaxCombo = qs('#sb-res-max-combo');
  E.resMiss = qs('#sb-res-miss');
  E.resPhase = qs('#sb-res-phase');
  E.resBossCleared = qs('#sb-res-boss-cleared');
  E.resAcc = qs('#sb-res-acc');
  E.resGrade = qs('#sb-res-grade');
  E.btnRetry = qs('#sb-btn-result-retry');
  E.btnMenu = qs('#sb-btn-result-menu');
  E.btnDlEvents = qs('#sb-btn-download-events');
  E.btnDlSession = qs('#sb-btn-download-session');

  // renderer
  renderer = new DomRendererShadow(E.targetLayer, {
    wrapEl: qs('#sb-wrap'),
    feedbackEl: E.msgMain,
    onTargetHit: onTargetHit,
  });

  // pattern generator instance (optional)
  S.pg = PatternGen ? new PatternGen() : null;

  // bind UI
  E.btnModeNormal?.addEventListener('click', () => setModeUi('normal'));
  E.btnModeResearch?.addEventListener('click', () => setModeUi('research'));

  E.btnHowto?.addEventListener('click', () => {
    E.howtoBox?.classList.toggle('is-on');
  });

  E.btnPlay?.addEventListener('click', () => startFromMenu('normal'));
  E.btnResearch?.addEventListener('click', () => startFromMenu('research'));

  E.btnBackMenu?.addEventListener('click', () => backToMenu());
  E.chkPause?.addEventListener('change', () => {
    S.paused = !!E.chkPause?.checked;
    if (S.paused) showMsg('หยุดชั่วคราว', 'miss');
    else showMsg('ไปต่อ!', 'good');
  });

  E.btnRetry?.addEventListener('click', () => {
    // retry same mode/diff/time
    startGame(S.mode);
  });
  E.btnMenu?.addEventListener('click', () => backToMenu());

  E.btnDlEvents?.addEventListener('click', () => {
    downloadEventCsv(S.evLogger, filenameEvents());
  });
  E.btnDlSession?.addEventListener('click', () => {
    downloadSessionCsv(S.ssLogger, filenameSession());
  });

  // init defaults from selects
  S.diff = String(E.diffSel?.value || 'normal');
  S.durationSec = Number(E.timeSel?.value || 70);

  E.diffSel?.addEventListener('change', () => {
    S.diff = String(E.diffSel.value || 'normal');
    renderer.setDifficulty(S.diff);
  });
  E.timeSel?.addEventListener('change', () => {
    S.durationSec = Number(E.timeSel.value || 70);
  });

  // initial mode UI
  setModeUi('normal');

  // show menu
  setView('menu');
  updateBossUi();

  // render loop
  requestAnimationFrame(tick);
}

// ---------- filenames ----------
function filenameEvents(){
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  return `shadow-breaker-events_${S.mode}_${S.diff}_${ts}.csv`;
}
function filenameSession(){
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  return `shadow-breaker-session_${S.mode}_${S.diff}_${ts}.csv`;
}

// ---------- ui ----------
function setView(name){
  S.view = name;

  for (const el of [E.viewMenu, E.viewPlay, E.viewResult]) {
    if (!el) continue;
    el.classList.remove('is-active');
  }
  if (name === 'menu') E.viewMenu?.classList.add('is-active');
  if (name === 'play') E.viewPlay?.classList.add('is-active');
  if (name === 'result') E.viewResult?.classList.add('is-active');
}

function setModeUi(m){
  S.uiMode = m === 'research' ? 'research' : 'normal';

  E.btnModeNormal?.classList.toggle('is-active', S.uiMode === 'normal');
  E.btnModeResearch?.classList.toggle('is-active', S.uiMode === 'research');

  if (S.uiMode === 'research') {
    E.modeDesc.textContent = 'Research: เก็บข้อมูลแบบเป็นระบบ (จำลอง/วิจัย) — โหมดนี้ล็อก AI ช่วยเล่น';
    E.researchBox?.classList.add('is-on');
  } else {
    E.modeDesc.textContent = 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
    E.researchBox?.classList.remove('is-on');
  }
}

function showMsg(text, kind){
  if (!E.msgMain) return;
  E.msgMain.textContent = text || '';
  E.msgMain.classList.remove('good','bad','miss','perfect');
  if (kind) E.msgMain.classList.add(kind);
}

function setBar(el, pct){
  if (!el) return;
  const p = clamp(pct, 0, 100) / 100;
  el.style.transform = `scaleX(${p})`;
}

function updateHud(){
  if (E.textTime) E.textTime.textContent = (Math.max(0, (S.durationSec*1000 - S.elapsedMs))/1000).toFixed(1) + ' s';
  if (E.textScore) E.textScore.textContent = String(Math.round(S.score));
  if (E.textCombo) E.textCombo.textContent = String(Math.round(S.combo));
  if (E.textPhase) E.textPhase.textContent = String(S.phase);
  if (E.textMiss) E.textMiss.textContent = String(S.miss);
  if (E.textShield) E.textShield.textContent = String(S.shield);

  setBar(E.hpYouTop, S.hpYou);
  setBar(E.hpBossTop, S.hpBoss);
  setBar(E.hpYouBottom, S.hpYou);
  setBar(E.hpBossBottom, S.hpBoss);

  setBar(E.feverBar, S.fever);
  if (E.feverLabel){
    const ready = S.fever >= 100;
    E.feverLabel.textContent = ready ? (S.feverOn ? 'ON' : 'READY') : `${Math.round(S.fever)}%`;
    E.feverLabel.classList.toggle('on', ready || S.feverOn);
  }
}

function updateBossUi(){
  const boss = BOSSES[clamp(S.bossIndex, 0, BOSSES.length-1)];
  if (!boss) return;
  if (E.bossName) E.bossName.textContent = `${boss.name} ${boss.emoji}`;
  if (E.metaEmoji) E.metaEmoji.textContent = boss.emoji;
  if (E.metaName) E.metaName.textContent = boss.name;
  if (E.metaDesc) E.metaDesc.textContent = boss.desc;
  if (E.bossPhaseLabel) E.bossPhaseLabel.textContent = String(S.phase);
  if (E.bossShieldLabel) E.bossShieldLabel.textContent = String(S.shield);
}

// ---------- flow ----------
function startFromMenu(forceMode){
  // read selections
  S.diff = String(E.diffSel?.value || 'normal');
  S.durationSec = Number(E.timeSel?.value || 70);
  renderer.setDifficulty(S.diff);

  // resolve mode
  const mode = getModeFromUiOrQuery(forceMode || S.uiMode);
  startGame(mode);
}

function resetRun(mode){
  S.mode = mode === 'research' ? 'research' : 'normal';
  S.running = true;
  S.paused = false;
  if (E.chkPause) E.chkPause.checked = false;

  S.startTsMs = nowMs();
  S.endTsMs = 0;
  S.elapsedMs = 0;

  S.score = 0;
  S.combo = 0;
  S.maxCombo = 0;
  S.miss = 0;
  S.judged = 0;
  S.hits = 0;

  S.hpYou = 100;
  S.hpBoss = 100;
  S.shield = 0;
  S.fever = 0;
  S.feverOn = false;

  S.bossIndex = 0;
  S.phase = 1;
  S.bossesCleared = 0;

  // clear targets
  for (const [id] of S.live) {
    renderer.removeTarget(id, 'reset');
  }
  S.live.clear();
  S.nextId = 1;

  // logs
  S.evLogger.clear();
  S.ssLogger.clear();

  // seed/pattern generator
  if (S.pg && typeof S.pg.reset === 'function') {
    try { S.pg.reset(); } catch {}
  }

  // initial session row (will patch at end)
  const meta = readResearchMeta();
  S.ssLogger.add({
    ts_start_ms: Date.now(),
    mode: S.mode,
    diff: S.diff,
    duration_sec: S.durationSec,
    participant_id: meta.participant_id || '',
    group: meta.group || '',
    note: meta.note || '',
    seed: meta.seed || '',
    build: 'shadow-breaker-prod',
    device: navigator.userAgent || '',
  });

  updateBossUi();
  updateHud();
  showMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');
}

function readResearchMeta(){
  const meta = {
    participant_id: (E.partId?.value || '').trim(),
    group: (E.partGroup?.value || '').trim(),
    note: (E.partNote?.value || '').trim(),
    seed: readQuery('seed','') || '',
  };
  return meta;
}

function startGame(mode){
  resetRun(mode);
  setView('play');
}

function endGame(){
  if (!S.running) return;
  S.running = false;
  S.endTsMs = nowMs();

  // finalize session summary
  const durSec = clamp(S.elapsedMs/1000, 0, 9999);
  const acc = S.judged ? (S.hits / S.judged) * 100 : 0;

  const grade = computeGrade(acc, S.maxCombo, S.miss, S.bossesCleared);

  S.ssLogger.patchLast({
    ts_end_ms: Date.now(),
    duration_sec_played: Number(durSec.toFixed(2)),
    boss_index_end: S.bossIndex,
    phase_end: S.phase,
    bosses_cleared: S.bossesCleared,
    score: Math.round(S.score),
    max_combo: S.maxCombo,
    miss: S.miss,
    accuracy_pct: Number(acc.toFixed(1)),
    grade,
    hp_end: Math.round(S.hpYou),
    shield_end: S.shield,
    fever_end: Math.round(S.fever),
  });

  // fill result UI
  if (E.resTime) E.resTime.textContent = durSec.toFixed(1) + ' s';
  if (E.resScore) E.resScore.textContent = String(Math.round(S.score));
  if (E.resMaxCombo) E.resMaxCombo.textContent = String(S.maxCombo);
  if (E.resMiss) E.resMiss.textContent = String(S.miss);
  if (E.resPhase) E.resPhase.textContent = String(S.phase);
  if (E.resBossCleared) E.resBossCleared.textContent = String(S.bossesCleared);
  if (E.resAcc) E.resAcc.textContent = acc.toFixed(1) + ' %';
  if (E.resGrade) E.resGrade.textContent = grade;

  setView('result');
}

function backToMenu(){
  S.running = false;
  S.paused = false;

  // clear targets
  for (const [id] of S.live) renderer.removeTarget(id, 'menu');
  S.live.clear();

  setView('menu');
}

function computeGrade(accPct, maxCombo, miss, bossesCleared){
  const a = Number(accPct)||0;
  if (bossesCleared >= 2 && a >= 80 && miss <= 6) return 'SSS';
  if (bossesCleared >= 1 && a >= 72 && miss <= 10) return 'SS';
  if (a >= 64 && miss <= 14) return 'S';
  if (a >= 54) return 'A';
  if (a >= 44) return 'B';
  return 'C';
}

// ---------- spawning / judging ----------
function pickTargetType(){
  // weighted types depending on phase/diff
  const phase = S.phase;
  const d = S.diff;

  // base weights
  let wNormal = 62;
  let wDecoy = 16;
  let wBomb  = 12;
  let wHeal  = 6;
  let wShield= 4;
  let wBossFace = 0;

  // phase escalates decoy/bomb
  wDecoy += (phase-1) * 4;
  wBomb  += (phase-1) * 3;

  // difficulty shifts
  if (d === 'easy') { wNormal += 10; wBomb -= 4; wDecoy -= 3; wHeal += 3; }
  if (d === 'hard') { wNormal -= 6;  wBomb += 4; wDecoy += 4; }

  // sometimes bossface when boss hp low
  if (S.hpBoss <= 28 && S.hpBoss > 0) wBossFace = 6;

  const total = Math.max(1, wNormal+wDecoy+wBomb+wHeal+wShield+wBossFace);
  let r = Math.random() * total;

  const take = (w, t) => { if ((r -= w) <= 0) return t; return null; };

  return (
    take(wNormal,'normal') ||
    take(wDecoy,'decoy') ||
    take(wBomb,'bomb') ||
    take(wHeal,'heal') ||
    take(wShield,'shield') ||
    take(wBossFace,'bossface') ||
    'normal'
  );
}

function spawnOne(){
  const cfg = DIFF[S.diff] || DIFF.normal;
  const id = S.nextId++;

  const boss = BOSSES[clamp(S.bossIndex, 0, BOSSES.length-1)];
  const type = pickTargetType();
  const ttlMs = cfg.ttlMs;
  const sizePx = cfg.sizePx + (type === 'bossface' ? 22 : 0);

  const data = {
    id,
    type,
    ttlMs,
    sizePx,
    bossEmoji: boss?.emoji || '👊',
  };

  const t = nowMs();
  const rec = {
    id,
    type,
    spawnAtMs: t,
    ttlMs,
    expireAtMs: t + ttlMs,
    sizePx,
    bossEmoji: data.bossEmoji,
  };

  S.live.set(id, rec);
  renderer.spawnTarget(data);
}

function expireTargets(t){
  for (const [id, rec] of S.live.entries()) {
    if (t >= rec.expireAtMs) {
      // timeout miss only for "normal/bossface/heal/shield" (decoy/bomb disappearing isn't "miss" by itself)
      if (rec.type === 'normal' || rec.type === 'bossface') {
        judgeMiss(id, rec, 'timeout_miss');
      } else {
        // remove silently
        renderer.removeTarget(id, 'timeout');
        S.live.delete(id);
      }
    }
  }
}

// ---------- judgement + FX ----------
function onTargetHit(id, pt){
  if (!S.running || S.paused) return;
  const rec = S.live.get(id);
  if (!rec) return;

  const t = nowMs();
  const rtMs = t - rec.spawnAtMs;

  if (rec.type === 'bomb') {
    judgeBomb(id, rec, pt, rtMs);
    return;
  }
  if (rec.type === 'decoy') {
    judgeDecoy(id, rec, pt, rtMs);
    return;
  }
  if (rec.type === 'heal') {
    judgeHeal(id, rec, pt, rtMs);
    return;
  }
  if (rec.type === 'shield') {
    judgeShield(id, rec, pt, rtMs);
    return;
  }
  // normal / bossface
  judgeHit(id, rec, pt, rtMs);
}

function judgeHit(id, rec, pt, rtMs){
  const cfg = DIFF[S.diff] || DIFF.normal;

  const g = gradeFromRt(rtMs, rec.ttlMs);
  const base = (g === 'perfect') ? cfg.score.perfect : cfg.score.good;

  // fever bonus
  const feverMul = S.feverOn ? 1.35 : 1.0;
  const scoreDelta = Math.round(base * feverMul);

  S.score += scoreDelta;
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  S.hits += 1;
  S.judged += 1;

  // boss dmg
  const dmg = Math.round((g === 'perfect' ? 9 : 6) * feverMul);
  S.hpBoss = clamp(S.hpBoss - dmg, 0, 100);

  // fever build
  S.fever = clamp(S.fever + (g === 'perfect' ? 10 : 7), 0, 100);
  if (S.fever >= 100 && !S.feverOn) {
    // auto fire fever briefly (simple)
    S.feverOn = true;
    setTimeout(() => { S.feverOn = false; S.fever = clamp(S.fever - 50, 0, 100); }, 1800);
  }

  // FX ✅ (สำคัญมาก)
  renderer.playHitFx(id, { ...pt, grade: g, scoreDelta });

  // log
  S.evLogger.add({
    ts_ms: Date.now(),
    mode: S.mode,
    diff: S.diff,
    boss_index: S.bossIndex,
    boss_phase: S.phase,
    target_id: id,
    target_type: rec.type,
    is_boss_face: rec.type === 'bossface' ? 1 : 0,
    event_type: 'hit',
    rt_ms: Math.round(rtMs),
    grade: g,
    score_delta: scoreDelta,
    combo_after: S.combo,
    score_after: Math.round(S.score),
    player_hp: Math.round(S.hpYou),
    boss_hp: Math.round(S.hpBoss),
  });

  // remove target
  renderer.removeTarget(id, 'hit');
  S.live.delete(id);

  showMsg(g === 'perfect' ? 'PERFECT!' : 'HIT!', g === 'perfect' ? 'perfect' : 'good');

  // boss transition
  if (S.hpBoss <= 0) {
    bossCleared();
  }
}

function judgeMiss(id, rec, why){
  // combo break
  S.combo = 0;
  S.miss += 1;
  S.judged += 1;

  // damage to player
  const dmg = 8 + (S.diff === 'hard' ? 4 : 0);
  if (S.shield > 0) {
    S.shield = Math.max(0, S.shield - 1);
  } else {
    S.hpYou = clamp(S.hpYou - dmg, 0, 100);
  }

  // FX ✅ : miss style (even on timeout)
  renderer.playHitFx(id, { grade: 'bad', scoreDelta: 0 });

  // log
  S.evLogger.add({
    ts_ms: Date.now(),
    mode: S.mode,
    diff: S.diff,
    boss_index: S.bossIndex,
    boss_phase: S.phase,
    target_id: id,
    target_type: rec.type,
    is_boss_face: rec.type === 'bossface' ? 1 : 0,
    event_type: why || 'miss',
    rt_ms: '',
    grade: 'miss',
    score_delta: 0,
    combo_after: S.combo,
    score_after: Math.round(S.score),
    player_hp: Math.round(S.hpYou),
    boss_hp: Math.round(S.hpBoss),
  });

  renderer.removeTarget(id, 'miss');
  S.live.delete(id);

  showMsg('MISS!', 'miss');

  // die check
  if (S.hpYou <= 0) endGame();
}

function judgeBomb(id, rec, pt, rtMs){
  S.combo = 0;
  S.judged += 1;

  let scoreDelta = -12;
  // shield blocks bomb penalty partially
  if (S.shield > 0) {
    S.shield = Math.max(0, S.shield - 1);
    scoreDelta = -4;
  } else {
    S.hpYou = clamp(S.hpYou - 14, 0, 100);
  }
  S.score += scoreDelta;

  // FX ✅
  renderer.playHitFx(id, { ...pt, grade: 'bomb', scoreDelta });

  S.evLogger.add({
    ts_ms: Date.now(),
    mode: S.mode,
    diff: S.diff,
    boss_index: S.bossIndex,
    boss_phase: S.phase,
    target_id: id,
    target_type: rec.type,
    is_boss_face: 0,
    event_type: 'hit_bomb',
    rt_ms: Math.round(rtMs),
    grade: 'bomb',
    score_delta: scoreDelta,
    combo_after: S.combo,
    score_after: Math.round(S.score),
    player_hp: Math.round(S.hpYou),
    boss_hp: Math.round(S.hpBoss),
  });

  renderer.removeTarget(id, 'bomb');
  S.live.delete(id);

  showMsg('BOMB!', 'bad');

  if (S.hpYou <= 0) endGame();
}

function judgeDecoy(id, rec, pt, rtMs){
  S.combo = 0;
  S.judged += 1;

  const scoreDelta = -6;
  S.score += scoreDelta;

  // FX ✅
  renderer.playHitFx(id, { ...pt, grade: 'bad', scoreDelta });

  S.evLogger.add({
    ts_ms: Date.now(),
    mode: S.mode,
    diff: S.diff,
    boss_index: S.bossIndex,
    boss_phase: S.phase,
    target_id: id,
    target_type: rec.type,
    is_boss_face: 0,
    event_type: 'hit_decoy',
    rt_ms: Math.round(rtMs),
    grade: 'decoy',
    score_delta: scoreDelta,
    combo_after: S.combo,
    score_after: Math.round(S.score),
    player_hp: Math.round(S.hpYou),
    boss_hp: Math.round(S.hpBoss),
  });

  renderer.removeTarget(id, 'decoy');
  S.live.delete(id);

  showMsg('DECOY!', 'miss');
}

function judgeHeal(id, rec, pt, rtMs){
  S.judged += 1;
  S.hits += 1;
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);

  const scoreDelta = 8;
  S.score += scoreDelta;
  S.hpYou = clamp(S.hpYou + 14, 0, 100);

  // FX ✅
  renderer.playHitFx(id, { ...pt, grade: 'heal', scoreDelta });

  S.evLogger.add({
    ts_ms: Date.now(),
    mode: S.mode,
    diff: S.diff,
    boss_index: S.bossIndex,
    boss_phase: S.phase,
    target_id: id,
    target_type: rec.type,
    is_boss_face: 0,
    event_type: 'hit_heal',
    rt_ms: Math.round(rtMs),
    grade: 'heal',
    score_delta: scoreDelta,
    combo_after: S.combo,
    score_after: Math.round(S.score),
    player_hp: Math.round(S.hpYou),
    boss_hp: Math.round(S.hpBoss),
  });

  renderer.removeTarget(id, 'heal');
  S.live.delete(id);

  showMsg('+HP', 'good');
}

function judgeShield(id, rec, pt, rtMs){
  S.judged += 1;
  S.hits += 1;
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);

  const scoreDelta = 6;
  S.score += scoreDelta;
  S.shield = clamp(S.shield + 1, 0, 9);

  // FX ✅
  renderer.playHitFx(id, { ...pt, grade: 'shield', scoreDelta });

  S.evLogger.add({
    ts_ms: Date.now(),
    mode: S.mode,
    diff: S.diff,
    boss_index: S.bossIndex,
    boss_phase: S.phase,
    target_id: id,
    target_type: rec.type,
    is_boss_face: 0,
    event_type: 'hit_shield',
    rt_ms: Math.round(rtMs),
    grade: 'shield',
    score_delta: scoreDelta,
    combo_after: S.combo,
    score_after: Math.round(S.score),
    player_hp: Math.round(S.hpYou),
    boss_hp: Math.round(S.hpBoss),
  });

  renderer.removeTarget(id, 'shield');
  S.live.delete(id);

  showMsg('+SHIELD', 'good');
}

function bossCleared(){
  S.bossesCleared += 1;
  showMsg('BOSS CLEARED! 🔥', 'perfect');

  // clear remaining targets quickly
  for (const [id] of S.live) {
    renderer.removeTarget(id, 'boss_clear');
  }
  S.live.clear();

  // advance boss/phase
  const boss = BOSSES[clamp(S.bossIndex, 0, BOSSES.length-1)];
  const maxPhase = boss?.phases || 3;

  if (S.phase < maxPhase) {
    S.phase += 1;
  } else {
    S.bossIndex = clamp(S.bossIndex + 1, 0, BOSSES.length-1);
    S.phase = 1;
  }

  // reset boss hp (increase pressure a bit)
  S.hpBoss = 100;
  // small reward
  S.hpYou = clamp(S.hpYou + 10, 0, 100);
  S.fever = clamp(S.fever + 18, 0, 100);

  updateBossUi();
}

// ---------- loop ----------
let lastTickMs = nowMs();
let spawnAccMs = 0;

function tick(){
  const t = nowMs();
  const dt = t - lastTickMs;
  lastTickMs = t;

  if (S.running && !S.paused) {
    S.elapsedMs += dt;

    // time up
    if (S.elapsedMs >= S.durationSec * 1000) {
      endGame();
    } else {
      // spawn
      const cfg = DIFF[S.diff] || DIFF.normal;
      spawnAccMs += dt;

      // AI assist pacing (play mode only; optional)
      const aiApi = getAiApi();
      const locked = (S.mode === 'research') || (aiApi && aiApi.isLocked && aiApi.isLocked());
      const allowAi = !locked && (aiApi?.isAssistEnabled?.() || false);

      let spawnEvery = cfg.spawnEveryMs;

      if (allowAi) {
        // lightweight snapshot => adjust spawn slightly
        const snapshot = {
          accPct: S.judged ? (S.hits / S.judged) * 100 : 0,
          hitMiss: S.miss,
          combo: S.combo,
          hp: S.hpYou,
          durationSec: S.durationSec,
        };
        const pred = aiApi?.predict?.(snapshot);
        if (pred) {
          if (pred.suggestedDifficulty === 'easy') spawnEvery *= 1.15;
          else if (pred.suggestedDifficulty === 'hard') spawnEvery *= 0.90;

          // micro tip rate-limit
          S.aiTipCooldownMs = Math.max(0, S.aiTipCooldownMs - dt);
          if (pred.tip && S.aiTipCooldownMs <= 0 && pred.tip !== S.lastTip) {
            S.lastTip = pred.tip;
            S.aiTipCooldownMs = 2600;
            showMsg(pred.tip, 'good');
          }
        }
      }

      while (spawnAccMs >= spawnEvery) {
        spawnAccMs -= spawnEvery;
        spawnOne();
      }

      // expire
      expireTargets(t);

      // update HUD
      updateHud();

      // if player dead
      if (S.hpYou <= 0) endGame();
    }
  }

  requestAnimationFrame(tick);
}