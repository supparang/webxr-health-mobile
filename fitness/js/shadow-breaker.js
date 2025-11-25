// === js/shadow-breaker.js — Bootstrap + HUD + logging (safe) ===
'use strict';

import { initShadowBreaker } from './engine.js';
import { DomRenderer } from './dom-renderer.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    initShadowBreaker();   // ผูกปุ่ม "เริ่มเล่นเลย" + spawn เป้า
  } catch (e) {
    console.error('ShadowBreaker init failed', e);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า');
  }
});
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

// HUD refs (บางตัวอาจไม่มี ให้เช็กก่อนใช้)
const hud = {};
function cacheHudRefs() {
  hud.mode        = $('#stat-mode');
  hud.diff        = $('#stat-diff');
  hud.score       = $('#stat-score');
  hud.combo       = $('#stat-combo');
  hud.miss        = $('#stat-miss');
  hud.time        = $('#stat-time');
  hud.hpPlayer    = $('#stat-hp');
  hud.hpBossVal   = $('#hp-boss-val');
  hud.fillPlayer  = $('#player-fill');
  hud.fillBoss    = $('#boss-fill');
  hud.feverFill   = $('#fever-fill');
  hud.feverStatus = $('#fever-status');
  hud.feedback    = $('#sb-feedback');
  hud.wrap        = $('#sb-wrap');
  hud.bossEmoji   = $('#boss-portrait-emoji');
  hud.bossName    = $('#boss-portrait-name');
  hud.bossHint    = $('#boss-portrait-hint');
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

// ---------- Boss meta ----------
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

  const diffSel = $('#difficulty');
  if (diffSel) {
    diffSel.addEventListener('change', (e) => {
      diffKey = e.target.value || 'normal';
      if (hud.wrap) hud.wrap.dataset.diff = diffKey;
    });
    diffKey = diffSel.value || 'normal';
  }

  // start buttons
  const btnStartNormal = $('[data-action="start-normal"]');
  btnStartNormal && btnStartNormal.addEventListener('click', () => {
    mode = 'normal';
    diffKey = diffSel ? (diffSel.value || 'normal') : 'normal';
    startSession();
  });

  const btnStartResearch = $('[data-action="start-research"]');
  btnStartResearch && btnStartResearch.addEventListener('click', () => {
    mode = 'research';
    diffKey = diffSel ? (diffSel.value || 'normal') : 'normal';
    showView('#view-research-form');
  });

  const btnBeginPlay = $('[data-action="research-begin-play"]');
  btnBeginPlay && btnBeginPlay.addEventListener('click', () => {
    diffKey = diffSel ? (diffSel.value || 'normal') : 'normal';
    startSession();
  });

  const btnBackMenu = $('[data-action="back-to-menu"]');
  btnBackMenu && btnBackMenu.addEventListener('click', () => {
    if (engine) engine.stop('back_to_menu');
    showView('#view-menu');
    menuOpenedAt = performance.now();
  });

  const btnStop = $('[data-action="stop-early"]');
  btnStop && btnStop.addEventListener('click', () => {
    if (engine) engine.stop('manual');
  });

  const btnPlayAgain = $('[data-action="play-again"]');
  btnPlayAgain && btnPlayAgain.addEventListener('click', () => {
    showView('#view-menu');
    menuOpenedAt = performance.now();
  });

  const btnCsvEvents = $('[data-action="download-csv-events"]');
  btnCsvEvents && btnCsvEvents.addEventListener('click', () => {
    if (!lastCsvEvents) {
      alert('ยังไม่มีข้อมูล Event CSV ลองเล่นเกมให้จบก่อนค่ะ');
      return;
    }
    downloadCsv(lastCsvEvents, 'shadow-breaker-events.csv');
  });

  const btnCsvSession = $('[data-action="download-csv-session"]');
  btnCsvSession && btnCsvSession.addEventListener('click', () => {
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
  try {
    sessionId = 'SB-' + Date.now();
    runIndex += 1;
    eventLogger = new EventLogger();
    sessionLogger = new SessionLogger();

    const participant = mode === 'research'
      ? ($('#research-id')?.value || '').trim()
      : 'NORMAL-' + runIndex;

    const group = mode === 'research'
      ? ($('#research-group')?.value || '').trim()
      : '';

    const note = mode === 'research'
      ? ($('#research-note')?.value || '').trim()
      : '';

    const menuToPlayMs = performance.now() - menuOpenedAt;

    const host = $('#target-layer');
    if (host) host.innerHTML = '';

    // --- สร้าง renderer (รองรับได้ 2 แบบ) ---
    renderer = null;
    const hitHandler = (id, pos) => {
      if (engine) engine.handleHit(id, pos);
    };

    try {
      // เวอร์ชันใหม่: DomRenderer(host, { onTargetHit })
      renderer = new DomRenderer(host, { onTargetHit: hitHandler });
    } catch (e1) {
      console.warn('[ShadowBreaker] DomRenderer(host, opts) ไม่ได้ ลองแบบเดิม', e1);
      try {
        // เวอร์ชันเก่า: DomRenderer(game, host, opts)
        renderer = new DomRenderer(null, host, { onTargetHit: hitHandler });
      } catch (e2) {
        console.error('[ShadowBreaker] DomRenderer init fail, ใช้ dummy renderer', e2);
        renderer = {
          spawnTarget() {},
          removeTarget() {},
          playHitFx() {}
        };
      }
    }

    // --- สร้าง engine ---
    engine = new GameEngine({
      difficulty: diffKey,
      hooks: {
        onSpawn: (t) => renderer && renderer.spawnTarget && renderer.spawnTarget(t),
        onDespawn: (t, reason) => renderer && renderer.removeTarget && renderer.removeTarget(t.id, reason),
        onHit: (ev) => handleHitEvent(ev, participant, group, note),
        onUpdate: (state) => updateHUD(state),
        onPhaseChange: (phase) => updateBossUI(phase),
        onEnd: (summary) => handleSessionEnd(summary, {
          participant, group, note, menuToPlayMs
        })
      }
    });

    // ถ้า DomRenderer รองรับ setEngine / engine property
    if (renderer) {
      if (typeof renderer.setEngine === 'function') {
        renderer.setEngine(engine);
      } else {
        renderer.engine = engine;
      }
    }

    // HUD static text
    if (hud.mode) hud.mode.textContent = mode === 'research' ? 'Research' : 'Normal';
    if (hud.diff) hud.diff.textContent = diffKey;
    if (hud.feedback) {
      hud.feedback.textContent = 'ตีเป้าให้ทันก่อนหายไป แล้วดูว่าคอมโบจะยาวแค่ไหน!';
    }

    updateBossUI(1);

    if (hud.wrap) {
      hud.wrap.dataset.diff = diffKey;
      hud.wrap.dataset.phase = '1';
      hud.wrap.dataset.boss = '0';
    }

    showView('#view-play');
    engine.start();
  } catch (err) {
    console.error('[ShadowBreaker] startSession error', err);
    alert('ไม่สามารถเริ่มเกม Shadow Breaker ได้ กรุณารีเฟรชหน้า');
  }
}

// ---------- HUD update ----------
function updateHUD(state) {
  if (hud.score) hud.score.textContent = state.score;
  if (hud.combo) hud.combo.textContent = state.combo;
  if (hud.miss)  hud.miss.textContent  = state.missCount;

  const sec = Math.max(0, state.remainingMs / 1000);
  if (hud.time) hud.time.textContent = sec.toFixed(1);

  if (hud.hpPlayer) hud.hpPlayer.textContent = state.playerHp;
  if (hud.hpBossVal) {
    hud.hpBossVal.textContent = Math.round(
      (state.bossHp / state.bossHpMax) * 100
    ) + '%';
  }

  const pFrac = Math.max(0, state.playerHp / state.playerHpMax);
  const bFrac = Math.max(0, state.bossHp / state.bossHpMax);

  if (hud.fillPlayer) hud.fillPlayer.style.transform = `scaleX(${pFrac})`;
  if (hud.fillBoss)   hud.fillBoss.style.transform   = `scaleX(${bFrac})`;

  const fFrac = Math.max(0, Math.min(1, state.feverGauge));
  if (hud.feverFill) hud.feverFill.style.transform = `scaleX(${fFrac})`;

  if (hud.feverStatus) {
    if (state.feverOn) {
      hud.feverStatus.classList.add('on');
      hud.feverStatus.textContent = 'FEVER ON';
    } else {
      hud.feverStatus.classList.remove('on');
      hud.feverStatus.textContent = 'FEVER';
    }
  }

  const bossBox = $('#boss-portrait');
  if (bossBox) {
    if (bFrac <= 0.35) bossBox.classList.add('sb-shake');
    else bossBox.classList.remove('sb-shake');
  }
}

function updateBossUI(phase) {
  const meta = BOSS_META[0];
  if (hud.bossEmoji) hud.bossEmoji.textContent = meta.emoji;
  if (hud.bossName)  hud.bossName.textContent  = meta.name;
  const hint = meta.hints[phase - 1] || meta.hints[meta.hints.length - 1];
  if (hud.bossHint)  hud.bossHint.textContent  = hint;
  if (hud.wrap) hud.wrap.dataset.phase = String(phase);
}

// ---------- Hit logging ----------
function handleHitEvent(ev, participant, group, note) {
  const { target } = ev;

  if (hud.feedback) {
    let msg = '';
    if (ev.grade === 'perfect') msg = 'สุดยอด! PERFECT 🎯';
    else if (ev.grade === 'good') msg = 'จังหวะดีเลย ลุยต่อ! 💪';
    else if (ev.grade === 'bad') msg = 'ช้าไปนิด ลองโฟกัสจังหวะให้ตรงเส้นนะ 😅';
    else msg = 'พลาดจังหะ ลองรอให้ใกล้เส้นล่างแล้วค่อยตี 😅';
    hud.feedback.textContent = msg;
  }

  renderer && renderer.playHitFx && renderer.playHitFx(target.id, ev);

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
    fever_before: ev.feverBefore,
    fever_after: ev.feverAfter,

    target_size_px: target.sizePx,
    spawn_interval_ms: target.spawnIntervalMs,
    phase_at_spawn: target.bossPhase,
    phase_spawn_index: target.phaseSpawnIndex,
    x_norm: target.xNorm,
    y_norm: target.yNorm,
    zone_lr: target.zoneLR,
    zone_ud: target.zoneUD
  };

  eventLogger.add(row);
}

// ---------- Session end ----------
function handleSessionEnd(summary, meta) {
  showView('#view-result');

  if (res.mode)      res.mode.textContent      = mode === 'research' ? 'โหมดวิจัย' : 'โหมดปกติ';
  if (res.diff)      res.diff.textContent      = diffKey;
  if (res.endReason) res.endReason.textContent = summary.endReason;
  if (res.score)     res.score.textContent     = summary.score;
  if (res.grade)     res.grade.textContent     = summary.grade;
  if (res.maxCombo)  res.maxCombo.textContent  = summary.maxCombo;
  if (res.miss)      res.miss.textContent      = summary.missCount;
  if (res.accuracy)  res.accuracy.textContent  = summary.accuracyPct.toFixed(1) + '%';
  if (res.totalHits) res.totalHits.textContent = summary.totalHits;

  if (res.rtNormal) {
    res.rtNormal.textContent = summary.avgRtNormalMs
      ? summary.avgRtNormalMs.toFixed(0) + ' ± ' + summary.stdRtNormalMs.toFixed(0)
      : '-';
  }
  if (res.rtDecoy) {
    res.rtDecoy.textContent = summary.avgRtDecoyMs
      ? summary.avgRtDecoyMs.toFixed(0) + ' ± ' + summary.stdRtDecoyMs.toFixed(0)
      : '-';
  }
  if (res.participant) res.participant.textContent = meta.participant || '-';

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
    start_ts: nowIso,
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

  lastCsvEvents  = eventLogger.toCsv();
  lastCsvSession = sessionLogger.toCsv();

  if (lastCsvEvents)  downloadCsv(lastCsvEvents,  'shadow-breaker-events.csv');
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
