// === /fitness/js/engine.js ===
// Shadow Breaker Engine — PRODUCTION (PATCH)
// ✅ No dependency on session-logger.js (avoids export errors)
// ✅ Works with: dom-renderer-shadow.js + event-logger.js + ai-predictor.js(RB_AI)
// ✅ View switching: Menu / Play / Result
// ✅ FX restored via DomRendererShadow -> FxBurst
// ✅ Safe spawn area (renderer handles) + boss phases + basic AI tips (optional via ?ai=1)
// ✅ Query passthrough: pid, diff, time, mode, hub
// ✅ Downloads: Events CSV (via event-logger.js), Session CSV (built-in)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { RB_AI } from './ai-predictor.js';

const WIN = window;
const DOC = document;

// -------------------- tiny utils --------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(Number(v) || 0, 0, 1);

function qs(sel) { return DOC.querySelector(sel); }
function qsa(sel) { return Array.from(DOC.querySelectorAll(sel)); }

function nowMs() { return performance.now(); }

function readQuery() {
  try {
    return new URL(location.href).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function getQueryStr(k, def = '') {
  try {
    const v = readQuery().get(k);
    return v == null ? def : String(v);
  } catch { return def; }
}
function getQueryNum(k, def = 0) {
  const v = Number(getQueryStr(k, ''));
  return Number.isFinite(v) ? v : def;
}
function getQueryMode() {
  const m = (getQueryStr('mode', '') || '').toLowerCase();
  return m === 'research' ? 'research' : 'normal';
}
function setUrlParam(key, val) {
  try {
    const u = new URL(location.href);
    if (val == null || val === '') u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
    history.replaceState(null, '', u.toString());
  } catch {}
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = DOC.createElement('a');
  a.href = url;
  a.download = filename;
  DOC.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// -------------------- DOM refs --------------------
const el = {
  // views
  vMenu: qs('#sb-view-menu'),
  vPlay: qs('#sb-view-play'),
  vResult: qs('#sb-view-result'),

  // menu controls
  modeNormal: qs('#sb-mode-normal'),
  modeResearch: qs('#sb-mode-research'),
  modeDesc: qs('#sb-mode-desc'),
  researchBox: qs('#sb-research-box'),
  partId: qs('#sb-part-id'),
  partGroup: qs('#sb-part-group'),
  partNote: qs('#sb-part-note'),

  diffSel: qs('#sb-diff'),
  timeSel: qs('#sb-time'),
  btnPlay: qs('#sb-btn-play'),
  btnResearch: qs('#sb-btn-research'),
  btnHowto: qs('#sb-btn-howto'),
  howtoBox: qs('#sb-howto'),

  // play
  wrap: qs('#sb-wrap'),
  layer: qs('#sb-target-layer'),
  msgMain: qs('#sb-msg-main'),
  bossName: qs('#sb-current-boss-name'),

  textTime: qs('#sb-text-time'),
  textScore: qs('#sb-text-score'),
  textCombo: qs('#sb-text-combo'),
  textPhase: qs('#sb-text-phase'),
  textMiss: qs('#sb-text-miss'),
  textShield: qs('#sb-text-shield'),

  hpYouTop: qs('#sb-hp-you-top'),
  hpBossTop: qs('#sb-hp-boss-top'),
  hpYouBottom: qs('#sb-hp-you-bottom'),
  hpBossBottom: qs('#sb-hp-boss-bottom'),

  feverBar: qs('#sb-fever-bar'),
  feverLabel: qs('#sb-label-fever'),

  metaEmoji: qs('#sb-meta-emoji'),
  metaName: qs('#sb-meta-name'),
  metaDesc: qs('#sb-meta-desc'),
  metaPhase: qs('#sb-boss-phase-label'),
  metaShield: qs('#sb-boss-shield-label'),

  btnBackMenu: qs('#sb-btn-back-menu'),
  chkStop: qs('#sb-btn-pause'),

  // result
  resTime: qs('#sb-res-time'),
  resScore: qs('#sb-res-score'),
  resMaxCombo: qs('#sb-res-max-combo'),
  resMiss: qs('#sb-res-miss'),
  resPhase: qs('#sb-res-phase'),
  resBossCleared: qs('#sb-res-boss-cleared'),
  resAcc: qs('#sb-res-acc'),
  resGrade: qs('#sb-res-grade'),

  btnRetry: qs('#sb-btn-result-retry'),
  btnResMenu: qs('#sb-btn-result-menu'),
  btnDlEvents: qs('#sb-btn-download-events'),
  btnDlSession: qs('#sb-btn-download-session')
};

function showView(which) {
  const map = { menu: el.vMenu, play: el.vPlay, result: el.vResult };
  for (const k of Object.keys(map)) {
    map[k].classList.toggle('is-active', k === which);
  }
}

// -------------------- Boss config --------------------
const BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣', desc: 'โฟกัสเป้าปกติ ตีให้ไว อย่าเผลอโดนกับดัก' },
  { name: 'Fire Dummy',  emoji: '🔥', desc: 'จะมี Bomb/Decoy มากขึ้น—อย่ารีบกดมั่ว' },
  { name: 'Violet King', emoji: '👑', desc: 'โหมดเดือด! ทำคอมโบให้ติดเพื่อชนะเร็ว' }
];

function diffParams(diffKey) {
  // tune hereให้ “สนุก ท้าทาย” แต่ยังเล่นได้สำหรับเด็ก
  if (diffKey === 'easy') {
    return {
      spawnEveryMs: 900,
      lifeMs: 1500,
      sizeBase: 150,
      hpLoseOnMiss: 6,
      bossHp: 120,
      scoreHit: 10,
      scorePerfect: 16,
      scoreBad: 2
    };
  }
  if (diffKey === 'hard') {
    return {
      spawnEveryMs: 560,
      lifeMs: 980,
      sizeBase: 120,
      hpLoseOnMiss: 10,
      bossHp: 180,
      scoreHit: 14,
      scorePerfect: 22,
      scoreBad: 3
    };
  }
  return {
    spawnEveryMs: 720,
    lifeMs: 1200,
    sizeBase: 135,
    hpLoseOnMiss: 8,
    bossHp: 150,
    scoreHit: 12,
    scorePerfect: 19,
    scoreBad: 2
  };
}

function computeTargetSizePx(diffKey, phase, type) {
  const p = diffParams(diffKey);
  let s = p.sizeBase;

  // phase 1..3 smaller slightly
  s -= (phase - 1) * 8;

  // type adjustments
  if (type === 'bossface') s += 28;
  if (type === 'bomb') s += 8;
  if (type === 'decoy') s += 6;
  if (type === 'heal' || type === 'shield') s += 10;

  return clamp(s, 90, 220);
}

// -------------------- Game state --------------------
const state = {
  running: false,
  mode: 'normal',           // normal | research
  pid: '',
  group: '',
  note: '',
  diff: 'normal',
  timeLimitSec: 70,

  tStartMs: 0,
  tNowMs: 0,
  elapsedSec: 0,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  hits: 0,
  hitsPerfect: 0,
  hitsGood: 0,
  hitsBad: 0,

  youHp: 100,
  shield: 0,               // blocks one penalty hit
  fever: 0,                // 0..100
  feverOn: false,

  bossIndex: 0,
  bossPhase: 1,
  bossCleared: 0,
  bossHp: 0,
  bossHpMax: 0,

  nextTargetId: 1,
  liveTargets: new Map(),  // id -> meta

  // logger
  evLogger: new EventLogger(),

  // internal
  _raf: null,
  _spawnTimer: null,
  _stopRequested: false
};

let renderer = null;

// -------------------- UI helpers --------------------
function setMsg(text, cls = '') {
  if (!el.msgMain) return;
  el.msgMain.textContent = text || '';
  el.msgMain.classList.remove('good','bad','miss','perfect');
  if (cls) el.msgMain.classList.add(cls);
}

function setBarFill(barEl, pct) {
  if (!barEl) return;
  const p = clamp01(pct / 100);
  barEl.style.transform = `scaleX(${p})`;
}

function setFever(pct) {
  state.fever = clamp(pct, 0, 100);
  el.feverBar.style.transform = `scaleX(${state.fever / 100})`;
  if (state.fever >= 100) {
    el.feverLabel.textContent = 'READY';
    el.feverLabel.classList.add('on');
  } else {
    el.feverLabel.textContent = `${Math.round(state.fever)}%`;
    el.feverLabel.classList.remove('on');
  }
}

function refreshHud() {
  el.textTime.textContent = `${state.elapsedSec.toFixed(1)} s`;
  el.textScore.textContent = String(state.score);
  el.textCombo.textContent = String(state.combo);
  el.textPhase.textContent = String(state.bossPhase);
  el.textMiss.textContent = String(state.miss);
  el.textShield.textContent = String(state.shield);

  setBarFill(el.hpYouTop, state.youHp);
  setBarFill(el.hpYouBottom, state.youHp);
  setBarFill(el.hpBossTop, (state.bossHp / Math.max(1, state.bossHpMax)) * 100);
  setBarFill(el.hpBossBottom, (state.bossHp / Math.max(1, state.bossHpMax)) * 100);

  const boss = BOSSES[state.bossIndex] || BOSSES[0];
  el.bossName.textContent = `${boss.name} ${boss.emoji}`;
  el.metaEmoji.textContent = boss.emoji;
  el.metaName.textContent = boss.name;
  el.metaDesc.textContent = boss.desc;
  el.metaPhase.textContent = String(state.bossPhase);
  el.metaShield.textContent = String(state.shield);

  if (el.wrap) {
    el.wrap.dataset.phase = String(state.bossPhase);
    el.wrap.dataset.boss = String(state.bossIndex);
    el.wrap.dataset.diff = state.diff;
  }
}

function setModeUI(mode) {
  state.mode = mode;
  const isRes = mode === 'research';

  el.modeNormal.classList.toggle('is-active', !isRes);
  el.modeResearch.classList.toggle('is-active', isRes);

  el.researchBox.classList.toggle('is-on', isRes);
  el.btnResearch.style.display = isRes ? 'inline-flex' : 'none';

  el.modeDesc.textContent = isRes
    ? 'Research: บันทึกผลพร้อมรหัสผู้เข้าร่วม (ล็อกการปรับความยาก/AI)'
    : 'Normal: สำหรับเล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
}

// -------------------- Spawn logic --------------------
function pickTargetType() {
  // weights by phase & diff
  const phase = state.bossPhase;
  const diff = state.diff;

  // base weights
  let wNormal = 62;
  let wDecoy  = 12;
  let wBomb   = 10;
  let wHeal   = 8;
  let wShield = 8;

  if (phase >= 2) { wDecoy += 6; wBomb += 6; wNormal -= 6; }
  if (phase >= 3) { wBomb += 6; wDecoy += 4; wNormal -= 6; }

  if (diff === 'hard') { wBomb += 4; wDecoy += 3; wNormal -= 3; }
  if (diff === 'easy') { wBomb -= 3; wDecoy -= 2; wNormal += 5; }

  // if hp low => more heal/shield
  if (state.youHp < 35) { wHeal += 8; wShield += 5; wNormal -= 6; }

  // fever ready => push normal (reward combo)
  if (state.fever >= 100) { wNormal += 8; wDecoy -= 2; wBomb -= 2; }

  const bag = [
    ['normal', wNormal],
    ['decoy', wDecoy],
    ['bomb', wBomb],
    ['heal', wHeal],
    ['shield', wShield]
  ];

  const total = bag.reduce((s, x) => s + Math.max(0, x[1]), 0);
  let r = Math.random() * total;
  for (const [k, w] of bag) {
    r -= Math.max(0, w);
    if (r <= 0) return k;
  }
  return 'normal';
}

function maybeBossFace() {
  // bossface appears once when boss hp low, per phase
  // simplistic: when boss hp < 18% and no bossface currently alive
  const low = state.bossHp / Math.max(1, state.bossHpMax) < 0.18;
  if (!low) return false;
  for (const m of state.liveTargets.values()) {
    if (m.type === 'bossface') return false;
  }
  // 45% chance
  return Math.random() < 0.45;
}

function spawnOne() {
  if (!state.running) return;
  if (!renderer) return;

  const boss = BOSSES[state.bossIndex] || BOSSES[0];
  const id = state.nextTargetId++;
  const type = maybeBossFace() ? 'bossface' : pickTargetType();
  const sizePx = computeTargetSizePx(state.diff, state.bossPhase, type);

  const p = diffParams(state.diff);
  const lifeMs = Math.max(520, p.lifeMs - (state.bossPhase - 1) * 60);

  const meta = {
    id,
    type,
    sizePx,
    bossEmoji: boss.emoji,
    spawnMs: nowMs(),
    lifeMs,
    killed: false,
    timer: null
  };

  state.liveTargets.set(id, meta);

  renderer.spawnTarget({
    id,
    type,
    sizePx,
    bossEmoji: boss.emoji
  });

  // auto timeout
  meta.timer = setTimeout(() => {
    if (!state.running) return;
    if (meta.killed) return;
    meta.killed = true;
    state.liveTargets.delete(id);
    renderer.removeTarget(id, 'timeout');

    onTargetTimeout(meta);
  }, lifeMs);
}

function startSpawning() {
  stopSpawning();
  const p = diffParams(state.diff);
  state._spawnTimer = setInterval(() => {
    // keep at most N targets to avoid clutter
    const cap = state.diff === 'hard' ? 6 : (state.diff === 'easy' ? 4 : 5);
    if (state.liveTargets.size >= cap) return;
    spawnOne();
  }, p.spawnEveryMs);
}

function stopSpawning() {
  if (state._spawnTimer) {
    clearInterval(state._spawnTimer);
    state._spawnTimer = null;
  }
}

// -------------------- Hit / Timeout rules --------------------
function consumeShield() {
  if (state.shield > 0) {
    state.shield = Math.max(0, state.shield - 1);
    setMsg('SHIELD BLOCK!', 'good');
    return true;
  }
  return false;
}

function addFever(delta) {
  setFever(state.fever + delta);
}

function judgeByRt(rtMs, lifeMs) {
  // tighter judgement on hard
  const tight = state.diff === 'hard' ? 0.92 : (state.diff === 'easy' ? 1.15 : 1.0);
  const perfectMs = 260 * tight;
  const goodMs = 460 * tight;

  if (rtMs <= perfectMs) return 'perfect';
  if (rtMs <= goodMs) return 'good';
  // late => bad (still counts as hit)
  return 'bad';
}

function scoreFor(type, grade) {
  const p = diffParams(state.diff);
  if (type === 'bomb') return -Math.max(8, Math.round(p.scoreHit * 0.9));
  if (type === 'decoy') return Math.max(1, p.scoreBad);

  if (type === 'heal' || type === 'shield') return Math.max(4, Math.round(p.scoreHit * 0.7));
  if (type === 'bossface') {
    if (grade === 'perfect') return p.scorePerfect + 10;
    if (grade === 'good') return p.scoreHit + 8;
    return p.scoreHit + 4;
  }

  if (grade === 'perfect') return p.scorePerfect;
  if (grade === 'good') return p.scoreHit;
  return p.scoreBad;
}

function damageBoss(type, grade) {
  // boss damage is mainly from normal/bossface; decoy/bomb doesn't help
  let d = 0;
  if (type === 'normal') d = (grade === 'perfect') ? 10 : (grade === 'good' ? 7 : 4);
  if (type === 'bossface') d = (grade === 'perfect') ? 20 : (grade === 'good' ? 14 : 10);
  if (state.fever >= 100) d = Math.round(d * 1.25); // fever bonus (simple)
  return d;
}

function applyHit(meta, clickXY) {
  const tHit = nowMs();
  const rt = tHit - meta.spawnMs;
  const grade = (meta.type === 'bomb') ? 'bomb'
              : (meta.type === 'heal') ? 'heal'
              : (meta.type === 'shield') ? 'shield'
              : judgeByRt(rt, meta.lifeMs);

  // stats
  state.hits++;
  if (grade === 'perfect') state.hitsPerfect++;
  else if (grade === 'good') state.hitsGood++;
  else if (grade === 'bad') state.hitsBad++;

  // combo
  if (meta.type === 'bomb' || meta.type === 'decoy') {
    state.combo = 0;
  } else {
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);
  }

  // score
  const sDelta = scoreFor(meta.type, grade);
  state.score += sDelta;

  // fever
  if (meta.type === 'normal' || meta.type === 'bossface') {
    addFever(grade === 'perfect' ? 10 : (grade === 'good' ? 7 : 4));
  } else if (meta.type === 'decoy') {
    addFever(-6);
  } else if (meta.type === 'bomb') {
    addFever(-12);
  } else {
    addFever(6);
  }

  // hp effects
  if (meta.type === 'bomb') {
    if (!consumeShield()) state.youHp = Math.max(0, state.youHp - 12);
    state.combo = 0;
  } else if (meta.type === 'decoy') {
    if (!consumeShield()) state.youHp = Math.max(0, state.youHp - 5);
    state.combo = 0;
  } else if (meta.type === 'heal') {
    state.youHp = Math.min(100, state.youHp + 12);
  } else if (meta.type === 'shield') {
    state.shield = Math.min(5, state.shield + 1);
  }

  // boss damage
  const dmg = damageBoss(meta.type, grade);
  if (dmg > 0) {
    state.bossHp = Math.max(0, state.bossHp - dmg);
  }

  // renderer FX
  renderer.playHitFx(meta.id, { clientX: clickXY.clientX, clientY: clickXY.clientY, grade, scoreDelta: sDelta });

  // feedback msg
  if (meta.type === 'bomb') setMsg('BOOM!', 'bad');
  else if (meta.type === 'decoy') setMsg('DECOY!', 'miss');
  else if (meta.type === 'heal') setMsg('+HP', 'good');
  else if (meta.type === 'shield') setMsg('+SHIELD', 'good');
  else if (grade === 'perfect') setMsg('PERFECT!', 'perfect');
  else if (grade === 'good') setMsg('GOOD!', 'good');
  else setMsg('OK', 'miss');

  // log event
  state.evLogger.add({
    ts_ms: Date.now(),
    mode: state.mode,
    diff: state.diff,
    pid: state.pid || '',
    boss_index: state.bossIndex,
    boss_phase: state.bossPhase,
    target_id: meta.id,
    target_type: meta.type,
    is_boss_face: meta.type === 'bossface' ? 1 : 0,
    event_type: 'hit',
    rt_ms: Math.round(rt),
    grade,
    score_delta: sDelta,
    combo_after: state.combo,
    score_after: state.score,
    player_hp: state.youHp,
    boss_hp: state.bossHp
  });

  // boss cleared?
  if (state.bossHp <= 0) {
    onBossCleared();
  }
}

function onTargetTimeout(meta) {
  state.miss++;
  state.combo = 0;

  // timeout penalty (shield can block)
  const p = diffParams(state.diff);
  if (!consumeShield()) {
    state.youHp = Math.max(0, state.youHp - p.hpLoseOnMiss);
  }

  addFever(-8);
  setMsg('MISS', 'miss');

  // log
  state.evLogger.add({
    ts_ms: Date.now(),
    mode: state.mode,
    diff: state.diff,
    pid: state.pid || '',
    boss_index: state.bossIndex,
    boss_phase: state.bossPhase,
    target_id: meta.id,
    target_type: meta.type,
    is_boss_face: meta.type === 'bossface' ? 1 : 0,
    event_type: 'timeout_miss',
    rt_ms: '',
    grade: 'miss',
    score_delta: 0,
    combo_after: state.combo,
    score_after: state.score,
    player_hp: state.youHp,
    boss_hp: state.bossHp
  });

  if (state.youHp <= 0) finish('player_dead');
}

function onBossCleared() {
  state.bossCleared++;
  state.bossPhase++;

  setMsg('BOSS DOWN! 🔥', 'good');

  // next boss or next phase
  if (state.bossPhase > 3) {
    // move to next boss
    state.bossIndex = Math.min(BOSSES.length - 1, state.bossIndex + 1);
    state.bossPhase = 1;
  }

  // reset boss hp
  const p = diffParams(state.diff);
  state.bossHpMax = p.bossHp + (state.bossIndex * 18) + ((state.bossPhase - 1) * 16);
  state.bossHp = state.bossHpMax;

  // small reward
  state.shield = Math.min(5, state.shield + 1);
  state.youHp = Math.min(100, state.youHp + 6);
  addFever(10);

  refreshHud();
}

// -------------------- Main loop --------------------
function tick() {
  if (!state.running) return;

  state.tNowMs = nowMs();
  state.elapsedSec = (state.tNowMs - state.tStartMs) / 1000;

  // stop requested
  if (state._stopRequested) {
    finish('stop');
    return;
  }

  // time end
  if (state.elapsedSec >= state.timeLimitSec) {
    finish('time');
    return;
  }

  // update hud + maybe AI tip
  refreshHud();

  // optional AI micro-tip (play only, and only if enabled)
  if (RB_AI && RB_AI.isAssistEnabled && RB_AI.isAssistEnabled()) {
    if ((Math.floor(state.elapsedSec) % 10) === 0) {
      // snapshot for RB_AI (best effort)
      const accPct = (state.hits + state.miss) > 0 ? (state.hits / (state.hits + state.miss)) * 100 : 0;
      const pred = RB_AI.predict({
        accPct,
        hp: state.youHp,
        hitMiss: state.miss,
        hitPerfect: state.hitsPerfect,
        hitGreat: 0,
        hitGood: state.hitsGood,
        offsetAbsMean: 0.08 // (ShadowBreaker doesn't use music offset; keep placeholder)
      });

      // show tip lightly only if helpful
      if (pred && pred.tip && (state.youHp < 45 || state.miss >= 6)) {
        setMsg(pred.tip, 'miss');
      }
    }
  }

  state._raf = requestAnimationFrame(tick);
}

// -------------------- Start/Stop/Finish --------------------
function resetRun() {
  state.running = false;
  state._stopRequested = false;
  state.tStartMs = 0;
  state.tNowMs = 0;
  state.elapsedSec = 0;

  state.score = 0;
  state.combo = 0;
  state.comboMax = 0;
  state.miss = 0;
  state.hits = 0;
  state.hitsPerfect = 0;
  state.hitsGood = 0;
  state.hitsBad = 0;

  state.youHp = 100;
  state.shield = 0;
  state.fever = 0;

  state.bossIndex = 0;
  state.bossPhase = 1;
  state.bossCleared = 0;

  const p = diffParams(state.diff);
  state.bossHpMax = p.bossHp;
  state.bossHp = state.bossHpMax;

  state.nextTargetId = 1;

  // clear targets
  for (const meta of state.liveTargets.values()) {
    try { clearTimeout(meta.timer); } catch {}
  }
  state.liveTargets.clear();

  // clear logs
  state.evLogger.clear();

  // renderer
  if (renderer) renderer.destroy();
  renderer = new DomRendererShadow(el.layer, {
    wrapEl: el.wrap,
    feedbackEl: el.msgMain,
    onTargetHit: (id, xy) => {
      const meta = state.liveTargets.get(id);
      if (!meta || meta.killed) return;
      meta.killed = true;
      state.liveTargets.delete(id);
      try { clearTimeout(meta.timer); } catch {}
      renderer.removeTarget(id, 'hit');
      applyHit(meta, xy || {});
    }
  });
  renderer.setDifficulty(state.diff);

  setFever(0);
  setMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');
  refreshHud();
}

function startRun() {
  // lock rules:
  // - research mode => lock AI adjustments; still playable
  // - normal mode => ai assist only if ?ai=1 (RB_AI handles)
  state.running = true;
  state._stopRequested = false;
  el.chkStop.checked = false;

  // mount renderer already in resetRun()
  showView('play');

  state.tStartMs = nowMs();
  startSpawning();
  refreshHud();

  if (state._raf) cancelAnimationFrame(state._raf);
  state._raf = requestAnimationFrame(tick);
}

function finish(reason) {
  if (!state.running) return;

  state.running = false;
  stopSpawning();

  if (state._raf) {
    cancelAnimationFrame(state._raf);
    state._raf = null;
  }

  // remove remaining targets
  for (const meta of state.liveTargets.values()) {
    try { clearTimeout(meta.timer); } catch {}
    try { renderer.removeTarget(meta.id, 'end'); } catch {}
  }
  state.liveTargets.clear();

  // build session summary
  const totalJudged = state.hits + state.miss;
  const accPct = totalJudged ? (state.hits / totalJudged) * 100 : 0;

  // grade
  let grade = 'C';
  if (accPct >= 92 && state.miss <= 3) grade = 'SSS';
  else if (accPct >= 86 && state.miss <= 6) grade = 'SS';
  else if (accPct >= 78) grade = 'S';
  else if (accPct >= 68) grade = 'A';
  else if (accPct >= 56) grade = 'B';
  else grade = 'C';

  // result UI
  el.resTime.textContent = `${Math.min(state.elapsedSec, state.timeLimitSec).toFixed(1)} s`;
  el.resScore.textContent = String(state.score);
  el.resMaxCombo.textContent = String(state.comboMax);
  el.resMiss.textContent = String(state.miss);
  el.resPhase.textContent = String(state.bossPhase);
  el.resBossCleared.textContent = String(state.bossCleared);
  el.resAcc.textContent = `${accPct.toFixed(1)} %`;
  el.resGrade.textContent = grade;

  // store session summary for download
  state._lastSessionSummary = {
    ts_ms: Date.now(),
    reason,
    mode: state.mode,
    diff: state.diff,
    pid: state.pid || '',
    group: state.group || '',
    note: state.note || '',
    time_planned_sec: state.timeLimitSec,
    time_played_sec: Math.min(state.elapsedSec, state.timeLimitSec).toFixed(2),
    score: state.score,
    hits: state.hits,
    miss: state.miss,
    acc_pct: accPct.toFixed(2),
    combo_max: state.comboMax,
    boss_cleared: state.bossCleared,
    last_boss_index: state.bossIndex,
    last_phase: state.bossPhase
  };

  showView('result');
}

// -------------------- Session CSV (built-in) --------------------
function sessionCsvText(summary) {
  const s = summary || {};
  const cols = Object.keys(s);
  const head = cols.join(',');
  const row = cols.map(k => csvEscape(s[k])).join(',');
  return head + '\n' + row + '\n';
}

// -------------------- Menu init / URL bootstrap --------------------
function bootstrapFromUrl() {
  const mode = getQueryMode();
  const diff = (getQueryStr('diff', 'normal') || 'normal').toLowerCase();
  const time = getQueryNum('time', 70);

  state.pid = getQueryStr('pid', '');
  state.diff = (diff === 'easy' || diff === 'hard' || diff === 'normal') ? diff : 'normal';
  state.timeLimitSec = clamp(time, 30, 180);
  state.mode = mode;

  // apply to UI
  if (el.diffSel) el.diffSel.value = state.diff;
  if (el.timeSel) el.timeSel.value = String(state.timeLimitSec);

  if (state.pid) {
    // if pid provided, prefill research ID for convenience
    if (el.partId) el.partId.value = state.pid;
  }

  setModeUI(state.mode);

  // if mode in URL, reflect in URL state
  setUrlParam('mode', state.mode);
  setUrlParam('diff', state.diff);
  setUrlParam('time', state.timeLimitSec);
  if (state.pid) setUrlParam('pid', state.pid);
}

// -------------------- Wire events --------------------
function wireUi() {
  // mode toggles
  el.modeNormal.addEventListener('click', () => {
    setModeUI('normal');
    setUrlParam('mode', 'normal');
  });
  el.modeResearch.addEventListener('click', () => {
    setModeUI('research');
    setUrlParam('mode', 'research');
  });

  // settings
  el.diffSel.addEventListener('change', () => {
    const v = (el.diffSel.value || 'normal').toLowerCase();
    state.diff = (v === 'easy' || v === 'hard') ? v : 'normal';
    setUrlParam('diff', state.diff);
  });

  el.timeSel.addEventListener('change', () => {
    const t = Number(el.timeSel.value);
    state.timeLimitSec = clamp(Number.isFinite(t) ? t : 70, 30, 180);
    setUrlParam('time', state.timeLimitSec);
  });

  // howto
  el.btnHowto.addEventListener('click', () => {
    el.howtoBox.classList.toggle('is-on');
  });

  // start buttons
  el.btnPlay.addEventListener('click', () => {
    // normal play: do not require research meta
    state.mode = 'normal';
    setModeUI('normal');
    setUrlParam('mode', 'normal');

    state.pid = getQueryStr('pid', '') || '';
    state.group = '';
    state.note = '';

    resetRun();
    startRun();
  });

  el.btnResearch.addEventListener('click', () => {
    // research: collect fields (still optional but recommended)
    state.mode = 'research';
    setModeUI('research');
    setUrlParam('mode', 'research');

    state.pid = (el.partId.value || '').trim() || getQueryStr('pid', '') || '';
    state.group = (el.partGroup.value || '').trim();
    state.note = (el.partNote.value || '').trim();

    if (state.pid) setUrlParam('pid', state.pid);

    resetRun();
    startRun();
  });

  // back to menu
  el.btnBackMenu.addEventListener('click', () => {
    finish('menu');
    showView('menu');
  });

  // stop toggle
  el.chkStop.addEventListener('change', () => {
    state._stopRequested = !!el.chkStop.checked;
  });

  // result actions
  el.btnRetry.addEventListener('click', () => {
    resetRun();
    startRun();
  });

  el.btnResMenu.addEventListener('click', () => {
    showView('menu');
  });

  el.btnDlEvents.addEventListener('click', () => {
    downloadEventCsv(state.evLogger, `shadow-breaker-events_${state.pid || 'anon'}.csv`);
  });

  el.btnDlSession.addEventListener('click', () => {
    const txt = sessionCsvText(state._lastSessionSummary || {});
    downloadText(`shadow-breaker-session_${state.pid || 'anon'}.csv`, txt);
  });
}

// -------------------- Boot --------------------
(function boot() {
  // basic sanity
  if (!el.vMenu || !el.vPlay || !el.vResult || !el.layer) {
    console.error('[ShadowBreaker] Missing required DOM elements');
    alert('โครงสร้างหน้าไม่ครบ (missing elements) — กรุณาเช็ค shadow-breaker.html');
    return;
  }

  bootstrapFromUrl();
  wireUi();

  showView('menu');

  // extra: if URL says autostart=1 => start immediately (optional)
  const autostart = (getQueryStr('autostart','') || '').toLowerCase();
  if (autostart === '1' || autostart === 'true') {
    resetRun();
    startRun();
  }
})();