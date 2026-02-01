/* === /fitness/js/engine.js ===
   Shadow Breaker Engine (Production)
   ✅ PC/Mobile friendly DOM targets
   ✅ Session CSV + Event CSV (local download)
   ✅ AI hooks (play only): director/coach/pattern/DL-lite predictor
   ✅ Boss phases + FEVER + Shield
   ✅ PACK A: Boss Skills events (phase-based) — play only
*/
'use strict';

import { SessionLogger, downloadSessionCsv } from './session-logger.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { StatsStore } from './stats-store.js';

import { AIDirector } from './ai-director.js';
import { AICoach } from './ai-coach.js';
import { AIPattern } from './ai-pattern.js';
import { AIFeatures } from './ai-features.js';
import { BossSkills } from './boss-skills.js';

/* -----------------------------
  DOM helpers
----------------------------- */
const $ = (sel) => document.querySelector(sel);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a = 1, b = 0) => Math.random() * (a - b) + b;
const randInt = (a, b) => Math.floor(rnd(b + 1, a));
const nowMs = () => Math.round(performance.now());

function qs(key, def = null) {
  try {
    const v = new URL(location.href).searchParams.get(key);
    return v == null ? def : v;
  } catch (_) { return def; }
}
function qnum(key, def = 0) {
  const v = Number(qs(key, def));
  return Number.isFinite(v) ? v : def;
}
function qbool(key, def = false) {
  const v = (qs(key, def ? '1' : '0') || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
function modeFromUrl() {
  const m = (qs('mode', 'play') || '').toLowerCase();
  return (m === 'research') ? 'research' : 'play';
}
function diffFromUrl() {
  const d = (qs('diff', 'normal') || '').toLowerCase();
  if (d === 'easy' || d === 'hard' || d === 'normal') return d;
  return 'normal';
}
function timeFromUrl() {
  const t = qnum('time', 70);
  return clamp(t, 30, 240);
}

/* -----------------------------
  Views & UI
----------------------------- */
const view = {
  launcher: $('#view-launcher'),
  play: $('#view-play'),
  result: $('#view-result')
};

const ui = {
  // launcher
  btnStart: $('#btn-start'),
  btnHow: $('#btn-how'),
  modeNormal: $('#btn-mode-normal'),
  modeResearch: $('#btn-mode-research'),
  modeDesc: $('#mode-desc'),
  selectDiff: $('#select-diff'),
  inputTime: $('#input-time'),
  // play HUD
  hudScore: $('#hud-score'),
  hudCombo: $('#hud-combo'),
  hudHp: $('#hud-hp'),
  hudBossHp: $('#hud-boss-hp'),
  hudBossPhase: $('#hud-boss-phase'),
  hudTimer: $('#hud-timer'),
  hudFever: $('#hud-fever'),
  hudShield: $('#hud-shield'),
  hudRank: $('#hud-rank'),
  hudTips: $('#hud-tips'),
  hudProgress: $('#hud-progress'),
  // result
  resTitle: $('#res-title'),
  resScore: $('#res-score'),
  resAcc: $('#res-acc'),
  resRt: $('#res-rt'),
  resRank: $('#res-rank'),
  resBtnRestart: $('#res-restart'),
  resBtnHub: $('#res-hub'),
  resBtnDownloadSession: $('#res-download-session'),
  resBtnDownloadEvents: $('#res-download-events')
};

function showView(name) {
  Object.values(view).forEach(el => { if (el) el.style.display = 'none'; });
  if (view[name]) view[name].style.display = '';
}

/* -----------------------------
  Game config
----------------------------- */
const DIFF = {
  easy: {
    label: 'Easy',
    playerHpMax: 6,
    bossHpMax: 110,
    bossPhaseHp: [45, 35, 30], // total 110
    spawnIntervalMin: 520,
    spawnIntervalMax: 900,
    baseSize: 1.14,
    missPenalty: 1,
    hitScore: 10,
    perfectBonus: 6,
    feverGain: 0.18,
    feverDrain: 0.12
  },
  normal: {
    label: 'Normal',
    playerHpMax: 5,
    bossHpMax: 120,
    bossPhaseHp: [45, 40, 35], // total 120
    spawnIntervalMin: 470,
    spawnIntervalMax: 860,
    baseSize: 1.05,
    missPenalty: 1,
    hitScore: 12,
    perfectBonus: 8,
    feverGain: 0.19,
    feverDrain: 0.14
  },
  hard: {
    label: 'Hard',
    playerHpMax: 4,
    bossHpMax: 140,
    bossPhaseHp: [50, 45, 45], // total 140
    spawnIntervalMin: 420,
    spawnIntervalMax: 780,
    baseSize: 0.98,
    missPenalty: 1,
    hitScore: 14,
    perfectBonus: 10,
    feverGain: 0.20,
    feverDrain: 0.16
  }
};

/* -----------------------------
  Render layer (DOM targets)
----------------------------- */
const layer = $('#play-layer');
const wrap = $('#sb-wrap');

function clearLayer() {
  if (!layer) return;
  layer.innerHTML = '';
}

function px(n) { return `${Math.round(n)}px`; }

function getLayerRect() {
  if (!layer) return { w: 360, h: 640, left: 0, top: 0 };
  const r = layer.getBoundingClientRect();
  return { w: r.width, h: r.height, left: r.left, top: r.top };
}

/* -----------------------------
  Target spawning
----------------------------- */
let targetSeq = 0;

function createTargetEl(kind, size = 1.0) {
  const el = document.createElement('button');
  el.className = `sb-target sb-${kind}`;
  el.type = 'button';
  el.dataset.kind = kind;
  el.dataset.id = String(++targetSeq);

  const icon = document.createElement('div');
  icon.className = 'sb-target-icon';

  // Emoji per kind
  icon.textContent =
    kind === 'bomb' ? '💣' :
    kind === 'heal' ? '💚' :
    kind === 'shield' ? '🛡️' :
    kind === 'decoy' ? '👤' :
    '🥊';

  el.appendChild(icon);

  // scale
  el.style.transform = `translate(-50%,-50%) scale(${size})`;
  return el;
}

function pickWeighted(items) {
  let sum = 0;
  for (const it of items) sum += Math.max(0, Number(it.w) || 0);
  if (sum <= 0) return items[0].v;
  let r = Math.random() * sum;
  for (const it of items) {
    r -= Math.max(0, Number(it.w) || 0);
    if (r <= 0) return it.v;
  }
  return items[items.length - 1].v;
}

function spawnTargetOfType(kind, opts = {}) {
  const cfg = DIFF[state.diffKey];
  const sz = Number(opts.size || cfg.baseSize || 1.0);

  const el = createTargetEl(kind, sz);
  el.dataset.spawnMs = String(nowMs());

  // place random inside safe bounds
  const r = getLayerRect();
  const margin = Math.max(24, Math.round(0.12 * Math.min(r.w, r.h)));
  const x = randInt(margin, Math.max(margin + 1, Math.round(r.w - margin)));
  const y = randInt(margin, Math.max(margin + 1, Math.round(r.h - margin)));
  el.style.left = px(x);
  el.style.top = px(y);

  // lifespan varies by kind/diff
  let life = 950;
  if (state.diffKey === 'easy') life = 1120;
  if (state.diffKey === 'hard') life = 860;
  if (kind === 'decoy') life = Math.round(life * 0.92);
  if (kind === 'bomb') life = Math.round(life * 0.90);
  if (kind === 'shield') life = Math.round(life * 1.08);

  el.dataset.expireMs = String(nowMs() + life);

  el.addEventListener('click', (ev) => onHitTarget(ev, el), { passive: true });

  layer.appendChild(el);

  // session/event logs: spawn
  if (state.eventLogger) {
    state.eventLogger.add({
      ts_ms: Date.now(),
      mode: state.mode,
      diff: state.diffKey,
      boss_index: 1,
      boss_phase: state.bossPhase,
      target_id: el.dataset.id,
      target_type: kind,
      is_boss_face: 0,
      event_type: 'spawn',
      rt_ms: '',
      grade: '',
      score_delta: 0,
      combo_after: state.combo,
      score_after: state.score,
      player_hp: state.playerHp,
      boss_hp: state.bossHp,
      fever: state.fever,
      shield: state.shieldOn ? 1 : 0
    });
  }

  return el;
}

function spawnBossFaceTarget() {
  // Boss "face" target: spawns as normal target but counts as boss hit.
  const el = spawnTargetOfType('normal', { size: 1.22 });
  el.classList.add('sb-boss-face');
  el.dataset.bossFace = '1';
  return el;
}

/* -----------------------------
  AI wiring (play-only)
----------------------------- */
function createAiSuite() {
  // play only
  if (state.mode === 'research') return null;

  const director = new AIDirector();
  const coach = new AICoach();
  const pattern = new AIPattern();
  const feats = new AIFeatures();

  return { director, coach, pattern, feats };
}

/* -----------------------------
  Runtime state
----------------------------- */
let state = null;
let spawnTimer = null;
let gameLoopId = null;
let bossSkills = null;

function initQuests() {
  // 2 active quests: simple & kid-friendly
  const pool = [
    { id: 'q_combo8', title: 'คอมโบให้ถึง 8', goal: 8, type: 'combo' },
    { id: 'q_perfect5', title: 'Perfect 5 ครั้ง', goal: 5, type: 'perfect' },
    { id: 'q_shield1', title: 'เก็บ Shield 1 ครั้ง', goal: 1, type: 'shield' },
    { id: 'q_boss12', title: 'ตีบอส 12 ครั้ง', goal: 12, type: 'bossHit' },
    { id: 'q_score220', title: 'ทำคะแนน 220', goal: 220, type: 'score' }
  ];

  // pick 2 unique
  const pick = [];
  while (pick.length < 2) {
    const it = pool[randInt(0, pool.length - 1)];
    if (!pick.some(x => x.id === it.id)) pick.push({ ...it, prog: 0, done: false });
  }
  state.quests = pick;
  state.questDoneCount = 0;
  emitQuestUpdate();
}

function emitQuestUpdate() {
  try {
    const detail = {
      quests: state.quests || [],
      doneCount: state.questDoneCount || 0
    };
    window.dispatchEvent(new CustomEvent('quest:update', { detail }));
  } catch (_) {}
}

function updateQuestProgress(kind, amount = 1) {
  if (!state.quests) return;

  for (const q of state.quests) {
    if (q.done) continue;

    if (q.type === 'combo' && kind === 'combo') {
      q.prog = Math.max(q.prog, amount); // amount is current combo
    } else if (q.type === 'perfect' && kind === 'perfect') {
      q.prog += 1;
    } else if (q.type === 'shield' && kind === 'shield') {
      q.prog += 1;
    } else if (q.type === 'bossHit' && kind === 'bossHit') {
      q.prog += 1;
    } else if (q.type === 'score' && kind === 'score') {
      q.prog = Math.max(q.prog, amount); // amount is score
    }

    if (q.prog >= q.goal) {
      q.done = true;
      state.questDoneCount += 1;
      // small reward: +score
      state.score += 40;
      setFeedback(`เควสต์สำเร็จ: ${q.title} 🎉 +40`, 'good');
    }
  }
  emitQuestUpdate();
}

/* -----------------------------
  HUD
----------------------------- */
function setText(el, txt) { if (el) el.textContent = String(txt); }

function updateHud() {
  setText(ui.hudScore, state.score);
  setText(ui.hudCombo, state.combo);
  setText(ui.hudHp, `${state.playerHp}/${state.playerHpMax}`);
  setText(ui.hudBossHp, `${state.bossHp}/${state.bossHpMax}`);
  setText(ui.hudBossPhase, `Phase ${state.bossPhase}/3`);
  setText(ui.hudShield, state.shieldOn ? 'ON' : 'OFF');
  setText(ui.hudRank, state.rank);
  setText(ui.hudProgress, `${state.progress}%`);
}

function updateTimerUi() {
  const left = Math.max(0, Math.ceil((state.endAt - performance.now()) / 1000));
  setText(ui.hudTimer, `${left}s`);
}

function updateBossUi() {
  if (!wrap) return;
  wrap.dataset.phase = String(state.bossPhase || 1);
}

/* -----------------------------
  Fever
----------------------------- */
function setFever(v) {
  state.fever = clamp(v, 0, 1);
  if (ui.hudFever) ui.hudFever.style.width = `${Math.round(state.fever * 100)}%`;

  const on = state.fever >= 1;
  if (on && !state.feverOn) {
    state.feverOn = true;
    state.feverUntil = performance.now() + 5200;
    setFeedback('FEVER! ยิงรัวได้เลย 🔥', 'good');
  }
}

function updateFeverUi(now) {
  if (state.mode === 'research') return; // no assist features in research
  if (state.feverOn && now >= state.feverUntil) {
    state.feverOn = false;
    setFever(0.35);
    setFeedback('FEVER จบแล้ว 😤', 'neutral');
  }
}

/* -----------------------------
  Feedback / tips
----------------------------- */
let feedbackTimer = null;

function setFeedback(msg, tone = 'neutral') {
  if (!ui.hudTips) return;
  ui.hudTips.textContent = msg;
  ui.hudTips.dataset.tone = tone;
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    if (ui.hudTips) ui.hudTips.textContent = '';
  }, 1600);
}

/* -----------------------------
  Ranking
----------------------------- */
function computeRank() {
  const acc = state.totalShots > 0 ? (state.hits / state.totalShots) : 0;
  const score = state.score;
  const rt = state.avgRtMs || 9999;

  // rough buckets
  let r = 'C';
  if (acc > 0.55 && score > 220) r = 'B';
  if (acc > 0.70 && score > 320) r = 'A';
  if (acc > 0.83 && score > 420 && rt < 520) r = 'S';
  if (acc > 0.90 && score > 520 && rt < 450) r = 'SS';
  if (acc > 0.93 && score > 650 && rt < 420) r = 'SSS';
  state.rank = r;
}

function updateProgress(now) {
  const total = Math.max(1, state.durationSec * 1000);
  const elapsed = clamp(now - state.startAt, 0, total);
  state.progress = Math.round((elapsed / total) * 100);
}

/* -----------------------------
  Spawning loop
----------------------------- */
function stopSpawning() {
  if (spawnTimer) clearTimeout(spawnTimer);
  spawnTimer = null;
}

function randRange(a, b) {
  return Math.round(rnd(b, a));
}

function scheduleNextSpawn() {
  if (!state.running) return;

  const cfg = DIFF[state.diffKey];

  const baseDelay = randRange(cfg.spawnIntervalMin, cfg.spawnIntervalMax);
  const mult = (bossSkills && bossSkills.getPacingMult(performance.now(), state)) || 1;
  const delay = Math.max(180, Math.round(baseDelay * mult));

  spawnTimer = setTimeout(() => {
    spawnOneTarget();
    scheduleNextSpawn();
  }, delay);
}

function spawnOneTarget() {
  if (!state.running) return;

  // Boss face spawns periodically
  if (state.mode !== 'research') {
    const chance = state.bossPhase === 1 ? 0.18 : state.bossPhase === 2 ? 0.24 : 0.28;
    if (Math.random() < chance) {
      spawnBossFaceTarget();
      return;
    }
  }

  const cfg = DIFF[state.diffKey];

  const baseWeights = [
    { v: 'normal', w: 64 },
    { v: 'decoy',  w: 10 },
    { v: 'bomb',   w: 8 },
    { v: 'heal',   w: 9 },
    { v: 'shield', w: 9 }
  ];

  const now = performance.now();
  const weights = (bossSkills && bossSkills.getSpawnWeights(now, state, baseWeights)) || baseWeights;
  const kind = pickWeighted(weights);

  spawnTargetOfType(kind, { size: cfg.baseSize });
}

/* -----------------------------
  Hits / scoring
----------------------------- */
function gradeByRt(rtMs) {
  if (rtMs <= 210) return 'Perfect';
  if (rtMs <= 330) return 'Great';
  if (rtMs <= 470) return 'Good';
  return 'Late';
}

function scoreDelta(grade, cfg) {
  if (grade === 'Perfect') return cfg.hitScore + cfg.perfectBonus;
  if (grade === 'Great') return cfg.hitScore + Math.round(cfg.perfectBonus * 0.5);
  if (grade === 'Good') return cfg.hitScore;
  return Math.round(cfg.hitScore * 0.6);
}

function applyHitToBoss() {
  const prevPhase = state.bossPhase;

  // boss hp down
  const dmg = state.feverOn ? 2 : 1;
  state.bossHp = Math.max(0, state.bossHp - dmg);

  // phase calc by thresholds
  const max = state.bossHpMax;
  const p1 = max - DIFF[state.diffKey].bossPhaseHp[0];
  const p2 = p1 - DIFF[state.diffKey].bossPhaseHp[1];

  if (state.bossHp <= p2) state.bossPhase = 3;
  else if (state.bossHp <= p1) state.bossPhase = 2;
  else state.bossPhase = 1;

  if (state.bossPhase !== prevPhase) {
    updateBossUi();
    if (bossSkills) bossSkills.onPhase(performance.now(), state);
  }

  if (state.bossHp <= 0) {
    endGame('win');
  }
}

function onHitTarget(ev, el) {
  if (!state.running) return;
  if (!el || !el.isConnected) return;

  const cfg = DIFF[state.diffKey];

  const kind = el.dataset.kind || 'normal';
  const spawnAt = Number(el.dataset.spawnMs || '0');
  const rt = clamp(nowMs() - spawnAt, 0, 9999);
  const grade = gradeByRt(rt);

  // shot accounting
  state.totalShots += 1;

  // bomb hit
  if (kind === 'bomb') {
    if (!state.shieldOn) {
      state.playerHp = Math.max(0, state.playerHp - 1);
      setFeedback('โดนระเบิด! 💥 -HP', 'bad');
    } else {
      setFeedback('Shield กันระเบิด! 🛡️', 'good');
      // shield blocks bomb and then off
      state.shieldOn = false;
    }
    state.combo = 0;
    el.remove();

    if (state.eventLogger) {
      state.eventLogger.add({
        ts_ms: Date.now(),
        mode: state.mode,
        diff: state.diffKey,
        boss_index: 1,
        boss_phase: state.bossPhase,
        target_id: el.dataset.id,
        target_type: kind,
        is_boss_face: el.dataset.bossFace ? 1 : 0,
        event_type: 'hit',
        rt_ms: rt,
        grade,
        score_delta: 0,
        combo_after: state.combo,
        score_after: state.score,
        player_hp: state.playerHp,
        boss_hp: state.bossHp,
        fever: state.fever,
        shield: state.shieldOn ? 1 : 0
      });
    }

    updateHud();
    if (state.playerHp <= 0) endGame('lose');
    return;
  }

  // heal
  if (kind === 'heal') {
    state.playerHp = Math.min(state.playerHpMax, state.playerHp + 1);
    state.score += 6;
    state.combo = Math.max(0, state.combo - 1);
    setFeedback('HP +1 💚', 'good');
    el.remove();

    if (state.eventLogger) {
      state.eventLogger.add({
        ts_ms: Date.now(),
        mode: state.mode,
        diff: state.diffKey,
        boss_index: 1,
        boss_phase: state.bossPhase,
        target_id: el.dataset.id,
        target_type: kind,
        is_boss_face: 0,
        event_type: 'hit',
        rt_ms: rt,
        grade,
        score_delta: 6,
        combo_after: state.combo,
        score_after: state.score,
        player_hp: state.playerHp,
        boss_hp: state.bossHp,
        fever: state.fever,
        shield: state.shieldOn ? 1 : 0
      });
    }

    updateQuestProgress('score', state.score);
    updateHud();
    return;
  }

  // shield
  if (kind === 'shield') {
    state.shieldOn = true;
    state.score += 8;
    setFeedback('Shield ON 🛡️', 'good');
    el.remove();
    updateQuestProgress('shield', 1);

    if (state.eventLogger) {
      state.eventLogger.add({
        ts_ms: Date.now(),
        mode: state.mode,
        diff: state.diffKey,
        boss_index: 1,
        boss_phase: state.bossPhase,
        target_id: el.dataset.id,
        target_type: kind,
        is_boss_face: 0,
        event_type: 'hit',
        rt_ms: rt,
        grade,
        score_delta: 8,
        combo_after: state.combo,
        score_after: state.score,
        player_hp: state.playerHp,
        boss_hp: state.bossHp,
        fever: state.fever,
        shield: state.shieldOn ? 1 : 0
      });
    }

    updateQuestProgress('score', state.score);
    updateHud();
    return;
  }

  // decoy: penalty
  if (kind === 'decoy') {
    state.combo = 0;
    if (!state.shieldOn) {
      state.playerHp = Math.max(0, state.playerHp - cfg.missPenalty);
      setFeedback('โดนหลอก! 👤 -HP', 'bad');
    } else {
      // shield blocks decoy penalty too
      state.shieldOn = false;
      setFeedback('Shield กันหลอกได้ 🛡️', 'good');
    }
    el.remove();

    if (state.eventLogger) {
      state.eventLogger.add({
        ts_ms: Date.now(),
        mode: state.mode,
        diff: state.diffKey,
        boss_index: 1,
        boss_phase: state.bossPhase,
        target_id: el.dataset.id,
        target_type: kind,
        is_boss_face: 0,
        event_type: 'hit',
        rt_ms: rt,
        grade,
        score_delta: 0,
        combo_after: state.combo,
        score_after: state.score,
        player_hp: state.playerHp,
        boss_hp: state.bossHp,
        fever: state.fever,
        shield: state.shieldOn ? 1 : 0
      });
    }

    updateHud();
    if (state.playerHp <= 0) endGame('lose');
    return;
  }

  // normal target (incl boss face)
  state.hits += 1;
  state.combo += 1;

  // fever gain
  if (state.mode !== 'research') {
    setFever(state.fever + cfg.feverGain * (grade === 'Perfect' ? 1.25 : grade === 'Great' ? 1.05 : 0.9));
  }

  const delta = scoreDelta(grade, cfg);
  state.score += delta;

  // track RT stats
  state.rtSum += rt;
  state.rtCount += 1;
  state.avgRtMs = Math.round(state.rtSum / Math.max(1, state.rtCount));

  // quests
  updateQuestProgress('combo', state.combo);
  if (grade === 'Perfect') updateQuestProgress('perfect', 1);
  updateQuestProgress('score', state.score);

  // boss hit?
  const isBossFace = !!el.dataset.bossFace;
  if (isBossFace) {
    applyHitToBoss();
    updateQuestProgress('bossHit', 1);
  }

  el.remove();

  if (state.eventLogger) {
    state.eventLogger.add({
      ts_ms: Date.now(),
      mode: state.mode,
      diff: state.diffKey,
      boss_index: 1,
      boss_phase: state.bossPhase,
      target_id: el.dataset.id,
      target_type: 'normal',
      is_boss_face: isBossFace ? 1 : 0,
      event_type: 'hit',
      rt_ms: rt,
      grade,
      score_delta: delta,
      combo_after: state.combo,
      score_after: state.score,
      player_hp: state.playerHp,
      boss_hp: state.bossHp,
      fever: state.fever,
      shield: state.shieldOn ? 1 : 0
    });
  }

  // feedback
  if (grade === 'Perfect') setFeedback('Perfect! ✨', 'good');
  else if (grade === 'Great') setFeedback('Great!', 'neutral');
  else if (grade === 'Good') setFeedback('Good', 'neutral');
  else setFeedback('ช้าไปนิด!', 'bad');

  updateHud();
}

/* -----------------------------
  Miss handling (expired targets)
----------------------------- */
function handleExpiredTargets(now) {
  if (!layer) return;
  const kids = Array.from(layer.children);
  for (const el of kids) {
    const ex = Number(el.dataset.expireMs || '0');
    if (ex && now >= ex) {
      // miss counts as shot
      state.totalShots += 1;

      // penalty (unless shield blocks? for normal misses we don't block)
      state.combo = 0;
      if (state.shieldOn && el.dataset.kind === 'bomb') {
        // bomb would have been blocked on click; on miss do nothing special
      } else if (el.dataset.kind === 'decoy') {
        // missing a decoy is fine (no penalty)
      } else {
        state.playerHp = Math.max(0, state.playerHp - 1);
      }

      if (state.eventLogger) {
        state.eventLogger.add({
          ts_ms: Date.now(),
          mode: state.mode,
          diff: state.diffKey,
          boss_index: 1,
          boss_phase: state.bossPhase,
          target_id: el.dataset.id,
          target_type: el.dataset.kind || 'normal',
          is_boss_face: el.dataset.bossFace ? 1 : 0,
          event_type: 'miss',
          rt_ms: '',
          grade: 'Miss',
          score_delta: 0,
          combo_after: state.combo,
          score_after: state.score,
          player_hp: state.playerHp,
          boss_hp: state.bossHp,
          fever: state.fever,
          shield: state.shieldOn ? 1 : 0
        });
      }

      el.remove();
      if (state.playerHp <= 0) {
        endGame('lose');
        return;
      }
    }
  }
}

/* -----------------------------
  Main loop
----------------------------- */
function gameLoop() {
  if (!state.running) return;

  const now = performance.now();

  updateProgress(now);
  updateTimerUi();
  updateHud();

  handleExpiredTargets(now);

  // drain fever
  if (state.mode !== 'research' && !state.feverOn) {
    const cfg = DIFF[state.diffKey];
    setFever(state.fever - cfg.feverDrain * 0.012);
  }

  updateFeverUi(now);
  if (bossSkills) bossSkills.tick(now, state);

  // end by time
  if (now >= state.endAt) {
    endGame('timeout');
    return;
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

/* -----------------------------
  End game & result
----------------------------- */
function endGame(reason = 'timeout') {
  if (!state.running) return;
  state.running = false;

  stopSpawning();
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoopId = null;

  clearLayer();

  computeRank();

  // finalize session row
  const acc = state.totalShots > 0 ? Math.round((state.hits / state.totalShots) * 100) : 0;

  if (state.sessionLogger) {
    state.sessionLogger.add({
      ts_ms: Date.now(),
      mode: state.mode,
      diff: state.diffKey,
      duration_sec: state.durationSec,
      reason,
      score: state.score,
      hits: state.hits,
      shots: state.totalShots,
      acc_pct: acc,
      avg_rt_ms: state.avgRtMs || '',
      rank: state.rank,
      boss_phase_end: state.bossPhase,
      boss_hp_end: state.bossHp,
      player_hp_end: state.playerHp,
      quest_done: state.questDoneCount || 0
    });
  }

  // UI result
  setText(ui.resTitle, reason === 'win' ? 'ชนะแล้ว! 🎉' : reason === 'lose' ? 'แพ้แล้ว 😵' : 'หมดเวลา ⏳');
  setText(ui.resScore, state.score);
  setText(ui.resAcc, `${acc}%`);
  setText(ui.resRt, state.avgRtMs ? `${state.avgRtMs} ms` : '-');
  setText(ui.resRank, state.rank);

  // hook downloads
  if (ui.resBtnDownloadSession) {
    ui.resBtnDownloadSession.onclick = () => downloadSessionCsv(state.sessionLogger, 'shadow-breaker-session.csv');
  }
  if (ui.resBtnDownloadEvents) {
    ui.resBtnDownloadEvents.onclick = () => downloadEventCsv(state.eventLogger, 'shadow-breaker-events.csv');
  }

  if (bossSkills) bossSkills.stop(performance.now());
  showView('result');
}

/* -----------------------------
  Start / Launcher controls
----------------------------- */
function startGame() {
  const mode = modeFromUrl();
  const diffKey = diffFromUrl();
  const durationSec = timeFromUrl();

  const cfg = DIFF[diffKey];

  // init state
  state = {
    mode,
    diffKey,
    durationSec,

    running: true,
    startAt: performance.now(),
    endAt: performance.now() + durationSec * 1000,

    // score
    score: 0,
    combo: 0,
    hits: 0,
    totalShots: 0,

    // RT stats
    rtSum: 0,
    rtCount: 0,
    avgRtMs: 0,

    // hp
    playerHpMax: cfg.playerHpMax,
    playerHp: cfg.playerHpMax,

    // boss
    bossHpMax: cfg.bossHpMax,
    bossHp: cfg.bossHpMax,
    bossPhase: 1,

    // fever/shield
    fever: 0.35,
    feverOn: false,
    feverUntil: 0,
    shieldOn: false,

    // progress
    progress: 0,

    // quests
    quests: [],
    questDoneCount: 0,

    // logs
    sessionLogger: new SessionLogger(),
    eventLogger: new EventLogger(),

    // stats store (local)
    stats: new StatsStore('sb_stats'),

    // AI suite
    ai: null,

    rank: 'C'
  };

  // init quests (2 active quests per session)
  initQuests();

  // Boss Skills (play mode only): adds "events" that change spawn mix/pacing per phase.
  bossSkills = new BossSkills({ wrapEl: wrap, setFeedback, spawnTargetOfType });
  bossSkills.reset(performance.now(), state);

  if (wrap) {
    wrap.dataset.diff = diffKey;
    wrap.dataset.mode = mode;
    wrap.dataset.phase = '1';
  }

  // AI suite only in play
  state.ai = createAiSuite();

  // init UI
  showView('play');
  updateBossUi();
  updateHud();
  updateTimerUi();

  // start loops
  stopSpawning();
  scheduleNextSpawn();

  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoopId = requestAnimationFrame(gameLoop);
}

/* -----------------------------
  Launcher page behavior
----------------------------- */
function setupLauncher() {
  // set defaults
  if (ui.selectDiff) ui.selectDiff.value = diffFromUrl();
  if (ui.inputTime) ui.inputTime.value = String(timeFromUrl());

  // mode toggle
  let mode = modeFromUrl();

  function updateModeUi() {
    const isResearch = mode === 'research';
    ui.modeNormal?.classList.toggle('active', !isResearch);
    ui.modeResearch?.classList.toggle('active', isResearch);
    if (ui.modeDesc) {
      ui.modeDesc.textContent = isResearch
        ? 'Research: สำหรับวิจัย (โหมดนิ่ง/บันทึกข้อมูล) — ปิด AI และ adaptive เพื่อความเที่ยง'
        : 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
    }
  }

  ui.modeNormal?.addEventListener('click', () => {
    mode = 'play';
    updateModeUi();
  });
  ui.modeResearch?.addEventListener('click', () => {
    mode = 'research';
    updateModeUi();
  });

  updateModeUi();

  // Start
  ui.btnStart?.addEventListener('click', () => {
    // push params
    const diff = ui.selectDiff?.value || 'normal';
    const t = clamp(Number(ui.inputTime?.value || 70), 30, 240);

    const u = new URL(location.href);
    u.searchParams.set('diff', diff);
    u.searchParams.set('time', String(t));
    u.searchParams.set('mode', mode === 'research' ? 'research' : 'play');

    // keep hub
    location.href = u.toString();
  });

  // How to play
  ui.btnHow?.addEventListener('click', () => {
    alert(
      'วิธีเล่น Shadow Breaker\\n\\n' +
      '1) แตะ/คลิกเป้าปกติ 🥊 เพื่อทำคะแนนและคอมโบ\\n' +
      '2) ระวังเป้าหลอก 👤 และระเบิด 💣\\n' +
      '3) เก็บ 🛡️ เพื่อกันความเสียหาย 1 ครั้ง\\n' +
      '4) เก็บ 💚 เพื่อเพิ่ม HP\\n' +
      '5) ยิงบอส (เป้าใหญ่/หน้า) เพื่อเปลี่ยน Phase และชนะเมื่อ HP บอสหมด\\n' +
      '6) FEVER 🔥 จะช่วยตีบอสแรงขึ้น'
    );
  });
}

/* -----------------------------
  Result controls
----------------------------- */
function setupResult() {
  ui.resBtnRestart?.addEventListener('click', () => {
    // restart with same params (but mode/diff/time already in URL)
    startGame();
  });

  ui.resBtnHub?.addEventListener('click', () => {
    // return hub if provided
    const hub = qs('hub', '');
    if (hub) location.href = hub;
    else location.href = './hub.html';
  });
}

/* -----------------------------
  Boot
----------------------------- */
function boot() {
  // If query contains from=hub or mode/diff/time already => start game view
  const from = (qs('from', '') || '').toLowerCase();

  const hasMode = qs('mode', null) != null;
  const hasDiff = qs('diff', null) != null;
  const hasTime = qs('time', null) != null;

  setupLauncher();
  setupResult();

  if (from === 'hub' || (hasMode && hasDiff && hasTime)) {
    startGame();
  } else {
    showView('launcher');
  }
}

boot();