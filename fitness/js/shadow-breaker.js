// === js/shadow-breaker.js — Bootstrap + HUD + logging (2025-11-25) ===
'use strict';

import { GameEngine } from './engine.js';
import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

// ---------- Helper ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function showView(id) {
  $$('#view-menu, #view-research-form, #view-play, #view-result')
    .forEach(el => el.classList.add('hidden'));
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

// ---------- Global state ----------
let engine = null;
let renderer = null;
let mode = 'normal';
let diffKey = 'normal';

let eventLogger = null;
let sessionLogger = null;
let sessionId = null;
let runIndex = 0;
let menuOpenedAt = performance.now();

let lastCsvEvents = '';
let lastCsvSession = '';

const BUILD_VERSION = 'sb-v2025-11-25';

// HUD refs
const hud = {};
function cacheHudRefs() {
  hud.mode       = $('#stat-mode');
  hud.diff       = $('#stat-diff');
  hud.score      = $('#stat-score');
  hud.combo      = $('#stat-combo');
  hud.miss       = $('#stat-miss');
  hud.time       = $('#stat-time');
  hud.hpPlayer   = $('#stat-hp');
  hud.hpBossVal  = $('#hp-boss-val');
  hud.fillPlayer = $('#player-fill');
  hud.fillBoss   = $('#boss-fill');
  hud.feverFill  = $('#fever-fill');
  hud.feverStatus= $('#fever-status');
  hud.feedback   = $('#sb-feedback');
  hud.wrap       = $('#sb-wrap');
  hud.bossEmoji  = $('#boss-portrait-emoji');
  hud.bossName   = $('#boss-portrait-name');
  hud.bossHint   = $('#boss-portrait-hint');
}

// result refs
const res = {};
function cacheResultRefs() {
  res.mode        = $('#res-mode');
  res.diff        = $('#res-diff');
  res.endReason   = $('#res-endreason');
  res.score       = $('#res-score');
  res.grade       = $('#res-grade');
  res.maxCombo    = $('#res-maxcombo');
  res.miss        = $('#res-miss');
  res.accuracy    = $('#res-accuracy');
  res.totalHits   = $('#res-totalhits');
  res.rtNormal    = $('#res-rt-normal');
  res.rtDecoy     = $('#res-rt-decoy');
  res.participant = $('#res-participant');
}

// ---------- Boss meta (phase-based text) ----------
const BOSS_META = [
  {
    name: 'Bubble Glove',
    emoji: '🐣',
    hints: [
      'เป้าใหญ่ เด้งช้า วอร์มอัพก่อน',
      'เร็วขึ้นนิดหน่อย ลองตีให้จังหวะสม่ำเสมอ',
      'ระวังเป้าลวงสีแปลก ๆ',
      'โค้งสุดท้าย! อย่าพลาดบ่อยเกินไป'
    ]
  }
];

// ---------- UI setup ----------
function initUI() {
  cacheHudRefs();
  cacheResultRefs();

  // radio mode
  $$('input[name="mode"]').forEach(r => {
    r.addEventListener('change', () => {
      mode = r.value === 'research' ? 'research' : 'normal';
    });
  });

  // difficulty select
  $('#difficulty').addEventListener('change', (e) => {
    diffKey = e.target.value || 'normal';
    hud.wrap.dataset.diff = diffKey;
  });

  // start buttons
  $('[data-action="start-normal"]').addEventListener('click', () => {
    mode = 'normal';
    diffKey = $('#difficulty').value || 'normal';
    startSession();
  });

  $('[data-action="start-research"]').addEventListener('click', () => {
    mode = 'research';
    diffKey = $('#difficulty').value || 'normal';
    showView('#view-research-form');
  });

  $('[data-action="research-begin-play"]').addEventListener('click', () => {
    diffKey = $('#difficulty').value || 'normal';
    startSession();
  });

  $('[data-action="back-to-menu"]').addEventListener('click', () => {
    if (engine) engine.stop('back_to_menu');
    showView('#view-menu');
  });

  $('[data-action="stop-early"]').addEventListener('click', () => {
    if (engine) engine.stop('manual');
  });

  $('[data-action="play-again"]').addEventListener('click', () => {
    showView('#view-menu');
  });

  // CSV download buttons
  $('[data-action="download-csv-events"]').addEventListener('click', () => {
    if (!lastCsvEvents) {
      alert('ยังไม่มีข้อมูล Event CSV ลองเล่นเกมให้จบก่อนค่ะ');
      return;
    }
    downloadCsv(lastCsvEvents, 'shadow-breaker-events.csv');
  });

  $('[data-action="download-csv-session"]').addEventListener('click', () => {
    if (!lastCsvSession) {
      alert('ยังไม่มีข้อมูล Session CSV ลองเล่นเกมให้จบก่อนค่ะ');
      return;
    }
    downloadCsv(lastCsvSession, 'shadow-breaker-sessions.csv');
  });

  showView('#view-menu');
}

// ---------- Start a game session ----------
function startSession() {
  // สร้าง session id / logger
  sessionId = 'SB-' + Date.now();
  runIndex += 1;
  eventLogger = new EventLogger();
  sessionLogger = new SessionLogger();

  // meta ผู้เข้าร่วม
  const participant = mode === 'research'
    ? ($('#research-id').value || '').trim()
    : 'NORMAL-' + runIndex;

  const group = mode === 'research'
    ? ($('#research-group').value || '').trim()
    : '';

  const note = mode === 'research'
    ? ($('#research-note').value || '').trim()
    : '';

  const menuToPlayMs = performance.now() - menuOpenedAt;

  const host = $('#target-layer');
  host.innerHTML = '';

  // Renderer: ให้มันเรียก engine.handleHit เมื่อคลิกเป้า
  renderer = new DomRenderer(host, {
    onTargetHit: (id, pos) => {
      engine && engine.handleHit(id, pos);
    }
  });

  // สร้าง engine
  engine = new GameEngine({
    difficulty: diffKey,
    hooks: {
      onSpawn: (t) => renderer.spawnTarget(t),
      onDespawn: (t, reason) => renderer.removeTarget(t.id, reason),
      onHit: (ev) => handleHitEvent(ev, participant, group, note),
      onUpdate: (state) => updateHUD(state),
      onPhaseChange: (phase) => updateBossUI(phase),
      onEnd: (summary) => handleSessionEnd(summary, {
        participant, group, note, menuToPlayMs
      })
    }
  });

  // HUD static
  hud.mode.textContent = mode === 'research' ? 'Research' : 'Normal';
  hud.diff.textContent = diffKey;
  hud.feedback.textContent = 'โฟกัสเป้ากลางจอ แล้วลองตีดูนะ 🎯';
  updateBossUI(1);

  hud.wrap.dataset.diff = diffKey;
  hud.wrap.dataset.phase = '1';
  hud.wrap.dataset.boss = '0';

  showView('#view-play');
  engine.start();
}

// ---------- HUD update ----------
function updateHUD(state) {
  hud.score.textContent = state.score;
  hud.combo.textContent = state.combo;
  hud.miss.textContent = state.missCount;

  const sec = Math.max(0, state.remainingMs / 1000);
  hud.time.textContent = sec.toFixed(1);

  // HP
  hud.hpPlayer.textContent = state.playerHp;
  hud.hpBossVal.textContent = Math.round(
    (state.bossHp / state.bossHpMax) * 100
  ) + '%';

  const pFrac = Math.max(0, state.playerHp / state.playerHpMax);
  const bFrac = Math.max(0, state.bossHp / state.bossHpMax);

  hud.fillPlayer.style.transform = `scaleX(${pFrac})`;
  hud.fillBoss.style.transform = `scaleX(${bFrac})`;

  // FEVER
  const fFrac = Math.max(0, Math.min(1, state.feverGauge));
  hud.feverFill.style.transform = `scaleX(${fFrac})`;

  if (state.feverOn) {
    hud.feverStatus.classList.add('on');
    hud.feverStatus.textContent = 'FEVER ON';
  } else {
    hud.feverStatus.classList.remove('on');
    hud.feverStatus.textContent = 'FEVER';
  }

  // boss portrait shake เมื่อ HP ต่ำ
  const bossBox = $('#boss-portrait');
  if (bFrac <= 0.35) bossBox.classList.add('sb-shake');
  else bossBox.classList.remove('sb-shake');
}

function updateBossUI(phase) {
  const meta = BOSS_META[0];
  hud.bossEmoji.textContent = meta.emoji;
  hud.bossName.textContent = `${meta.name}`;
  const hint = meta.hints[phase - 1] || meta.hints[meta.hints.length - 1];
  hud.bossHint.textContent = hint;
  hud.wrap.dataset.phase = String(phase);
}

// ---------- Hit logging ----------
function handleHitEvent(ev, participant, group, note) {
  const { target } = ev;

  // feedback bubble
  let msg = '';
  if (ev.grade === 'perfect') msg = 'สุดยอด! PERFECT 🎯';
  else if (ev.grade === 'good') msg = 'จังหวะดีเลย ลุยต่อ! 💪';
  else if (ev.grade === 'bad') msg = 'ช้าไปนิด ลองโฟกัสจังหวะให้ตรงเส้นนะ 😅';
  else msg = 'พลาดจังหะ ลองรอให้ใกล้เส้นล่างแล้วค่อยตี 😅';

  hud.feedback.textContent = msg;

  // ให้ renderer ทำเอฟเฟกต์ที่เป้า
  renderer && renderer.playHitFx(target.id, ev);

  // สร้างแถว event สำหรับ CSV
  const row = {
    session_id: sessionId,
    run_index: runIndex,
    mode,
    difficulty: diffKey,
    participant,
    group,
    note,

    target_id: target.id,
    boss_id: target.bossId,
    boss_phase: target.bossPhase,
    is_decoy: target.isDecoy ? 1 : 0,
    is_bomb: target.isBomb ? 1 : 0,
    is_bossface: target.isBossFace ? 1 : 0,

    grade: ev.grade,
    age_ms: Math.round(ev.ageMs),
    fever_on: ev.feverOn ? 1 : 0,
    score_delta: ev.scoreDelta,
    score_total: ev.scoreTotal,
    combo_before: ev.comboBefore,
    combo_after: ev.comboAfter,
    player_hp_before: ev.playerHpBefore,
    player_hp_after: ev.playerHpAfter,
    boss_hp_before: ev.bossHpBefore,
    boss_hp_after: ev.bossHpAfter,
    fever_before: ev.feverBefore.toFixed(3),
    fever_after: ev.feverAfter.toFixed(3),

    target_size_px: target.sizePx,
    spawn_interval_ms: target.spawnIntervalMs,
    phase_at_spawn: target.bossPhase,
    phase_spawn_index: target.phaseSpawnIndex,
    x_norm: target.xNorm.toFixed(3),
    y_norm: target.yNorm.toFixed(3),
    zone_lr: target.zoneLR,
    zone_ud: target.zoneUD
  };

  eventLogger.add(row);
}

// ---------- Session end ----------
function handleSessionEnd(summary, meta) {
  showView('#view-result');

  res.mode.textContent = mode === 'research' ? 'โหมดวิจัย' : 'โหมดปกติ';
  res.diff.textContent = diffKey;
  res.endReason.textContent = summary.endReason;
  res.score.textContent = summary.score;
  res.grade.textContent = summary.grade;
  res.maxCombo.textContent = summary.maxCombo;
  res.miss.textContent = summary.missCount;
  res.accuracy.textContent = summary.accuracyPct.toFixed(1) + '%';
  res.totalHits.textContent = summary.totalHits;
  res.rtNormal.textContent = summary.avgRtNormalMs
    ? summary.avgRtNormalMs.toFixed(0) + ' ± ' + summary.stdRtNormalMs.toFixed(0)
    : '-';
  res.rtDecoy.textContent = summary.avgRtDecoyMs
    ? summary.avgRtDecoyMs.toFixed(0) + ' ± ' + summary.stdRtDecoyMs.toFixed(0)
    : '-';
  res.participant.textContent = meta.participant || '-';

  // session row
  const duration_s = summary.durationMs / 1000;
  const nowIso = new Date().toISOString();

  const envUa = navigator.userAgent || '';
  const envW = window.innerWidth;
  const envH = window.innerHeight;
  const envInput = ('ontouchstart' in window) ? 'touch' : 'mouse';

  const sessionRow = {
    session_id: sessionId,
    build_version: BUILD_VERSION,
    mode,
    difficulty: diffKey,
    training_phase: 'boss1_full',
    run_index: runIndex,
    start_ts: nowIso,   // ถ้าต้องการเวลาจริงเป๊ะ ๆ สามารถเก็บเพิ่มใน startSession()
    end_ts: nowIso,
    duration_s: duration_s.toFixed(2),
    end_reason: summary.endReason,
    final_score: summary.score,
    grade: summary.grade,
    total_targets: summary.totalTargets,
    total_hits: summary.totalHits,
    total_miss: summary.missCount,
    total_bombs_hit: summary.bombHitCount,
    accuracy_pct: summary.accuracyPct.toFixed(2),
    max_combo: summary.maxCombo,
    perfect_count: summary.perfectCount,
    good_count: summary.goodCount,
    bad_count: summary.badCount,
    avg_rt_normal_ms: summary.avgRtNormalMs.toFixed(1),
    std_rt_normal_ms: summary.stdRtNormalMs.toFixed(1),
    avg_rt_decoy_ms: summary.avgRtDecoyMs.toFixed(1),
    std_rt_decoy_ms: summary.stdRtDecoyMs.toFixed(1),
    fever_count: summary.feverCount,
    fever_total_time_s: (summary.feverTotalTimeMs / 1000).toFixed(2),
    low_hp_time_s: (summary.lowHpTimeMs / 1000).toFixed(2),
    bosses_cleared: summary.bossesCleared,
    menu_to_play_ms: meta.menuToPlayMs.toFixed(0),
    participant: meta.participant,
    group: meta.group,
    note: meta.note,
    env_ua: envUa,
    env_viewport_w: envW,
    env_viewport_h: envH,
    env_input_mode: envInput,
    error_count: 0,
    focus_events: 0
  };

  sessionLogger.add(sessionRow);

  // สร้าง CSV ไว้ให้ปุ่มดาวน์โหลดใช้ + auto-download 1 ครั้งก็ได้
  lastCsvEvents = eventLogger.toCsv();
  lastCsvSession = sessionLogger.toCsv();

  // ดาวน์โหลดอัตโนมัติแบบเบา ๆ (ไม่รบกวนมาก)
  if (lastCsvEvents) downloadCsv(lastCsvEvents, 'shadow-breaker-events.csv');
  if (lastCsvSession) downloadCsv(lastCsvSession, 'shadow-breaker-sessions.csv');
}

// ---------- CSV helper ----------
function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Boot ----------
function initShadowBreaker() {
  try {
    initUI();
    console.log('[ShadowBreaker] ready');
  } catch (err) {
    console.error('[ShadowBreaker] init error', err);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า');
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initShadowBreaker);
} else {
  initShadowBreaker();
}