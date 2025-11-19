// === fitness/js/main-shadow.js — Shadow Breaker main controller (2025-11-19) ===
'use strict';

import { GameEngine } from './engine.js';
import { DomRenderer } from './dom-renderer.js';
import { createCSVLogger } from './logger-csv.js';
import { pickShadowConfig } from './config-shadow.js';
import { recordSession } from './stats-store.js';

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showView(sel) {
  ['#view-menu', '#view-research-form', '#view-play', '#view-result']
    .forEach(s => {
      const el = $(s);
      if (el) el.classList.add('hidden');
    });
  const el = $(sel);
  if (el) el.classList.remove('hidden');
}

/* -------------------------------------------------
 * Global state
 * ------------------------------------------------- */

let currentMode    = 'normal';   // 'normal' | 'research'
let currentDiffKey = 'normal';

let engine   = null;
let renderer = null;
let logger   = null;

let lastState       = null;
let lastSessionMeta = null;

let coachTimer  = null;
let lastCoachAt = 0;

/* -------------------------------------------------
 * HUD elements
 * ------------------------------------------------- */

// top stats
const elScore   = $('#stat-score');
const elCombo   = $('#stat-combo');
const elMiss    = $('#stat-miss');
const elTime    = $('#stat-time');
const elMode    = $('#stat-mode');
const elDiff    = $('#stat-diff');
const elPerfect = $('#stat-perfect');
const elHP      = $('#stat-hp');

// FEVER
const elFeverFill   = $('#fever-fill');
const elFeverStatus = $('#fever-status');

// Boss
const elBossName = $('#boss-name');
const elBossFill = $('#boss-fill');

// Boss portrait
const elBossPortrait      = $('#boss-portrait');
const elBossPortraitEmoji = $('#boss-portrait-emoji');
const elBossPortraitName  = $('#boss-portrait-name');
const elBossPortraitHint  = $('#boss-portrait-hint');

// Coach bubble
const elCoachBubble = $('#coach-bubble');
const elCoachAvatar = $('#coach-avatar');
const elCoachRole   = $('#coach-role');
const elCoachText   = $('#coach-text');

// Result view
const elResMode        = $('#res-mode');
const elResDiff        = $('#res-diff');
const elResScore       = $('#res-score');
const elResMaxCombo    = $('#res-maxcombo');
const elResMiss        = $('#res-miss');
const elResParticipant = $('#res-participant');
const elResEndReason   = $('#res-endreason');
const elResAccuracy    = $('#res-accuracy');
const elResTotalHits   = $('#res-totalhits');
const elResRTNormal    = $('#res-rt-normal');
const elResRTDecoy     = $('#res-rt-decoy');

/* -------------------------------------------------
 * Coach system
 * ------------------------------------------------- */

const COACH_LINES = {
  kids: {
    welcome:    'พร้อมลุย Shadow Breaker แล้ว! ชกเป้าให้ทันนะ 🥊',
    feverReady: 'เกจ FEVER ใกล้เต็มแล้ว เตรียมชกให้รัวเลย ✨',
    feverOn:    'เข้าโหมด FEVER แล้ว! ตีให้แม่น คอมโบอย่าให้ตก 💥',
    hpLow:      'HP เหลือน้อยแล้ว หายใจลึก ๆ ตั้งตัวก่อนช็อตถัดไปนะ 💚',
    bossNext:   'บอสตัวต่อไปมาแล้ว! เก็บแรงแล้วลุยต่อ 😈',
    missSoft:   'พลาดไปนิดเดียว รอบหน้าเล็งกลาง ๆ เป้าให้เป๊ะกว่านี้หน่อย 👍'
  },
  research: {
    welcome:    'โหมดวิจัย: โฟกัส timing ของหมัดกับการหายใจให้สม่ำเสมอครับ 🧪',
    feverReady: 'ค่า FEVER ใกล้เต็มแล้ว ลองรักษาจังหวะหมัดให้ต่อเนื่องครับ ✨',
    feverOn:    'เข้าสู่ช่วง FEVER: สังเกตว่าความรู้สึกเร็วขึ้นแค่ไหนแต่ยังควบคุมได้หรือไม่ 💡',
    hpLow:      'HP ลดลงมาก แนะนำลดแรงแต่เน้นความแม่นยำแทนครับ 💚',
    bossNext:   'เริ่มบอสตัวใหม่แล้ว ลองเปรียบเทียบความล้ากับตัวก่อนหน้านี้ครับ 📊',
    missSoft:   'มี miss เพิ่มขึ้นเล็กน้อย ลองโฟกัสสายตาที่เป้าและการซิงค์มือ-ตาดูครับ 👀'
  }
};

const COACH_COOLDOWN_MS = 4500;

function getCoachPersona() {
  return currentMode === 'research' ? 'research' : 'kids';
}

function setCoachMessage(key) {
  if (!elCoachBubble || !elCoachText || !elCoachAvatar || !elCoachRole) return;

  const now = performance.now();
  if (now - lastCoachAt < COACH_COOLDOWN_MS) return;
  lastCoachAt = now;

  const persona = getCoachPersona();
  const lines   = COACH_LINES[persona];
  const text    = lines?.[key];
  if (!text) return;

  elCoachText.textContent = text;
  if (persona === 'research') {
    elCoachAvatar.textContent = '🧑‍🔬';
    elCoachRole.textContent   = 'Research Coach';
  } else {
    elCoachAvatar.textContent = '🥊';
    elCoachRole.textContent   = 'โค้ชพลังหมัด';
  }

  elCoachBubble.classList.add('visible');

  if (coachTimer) clearTimeout(coachTimer);
  coachTimer = setTimeout(() => {
    elCoachBubble.classList.remove('visible');
  }, 3800);
}

function updateCoach(state) {
  const prev = lastState;
  if (!prev) {
    setCoachMessage('welcome');
    return;
  }

  // FEVER ready
  if ((state.feverCharge >= 90) && (prev.feverCharge < 90)) {
    setCoachMessage('feverReady');
    return;
  }

  // FEVER active toggle
  if (!prev.feverActive && state.feverActive) {
    setCoachMessage('feverOn');
    return;
  }

  // HP low
  if ((state.playerHP <= 30) && (prev.playerHP > 30)) {
    setCoachMessage('hpLow');
    return;
  }

  // next boss
  if (state.bossIndex > prev.bossIndex) {
    setCoachMessage('bossNext');
    return;
  }

  // miss increased
  if (state.missCount > prev.missCount) {
    setCoachMessage('missSoft');
  }
}

/* -------------------------------------------------
 * Logger helper (ปิด CSV ในโหมดเล่นปกติ)
 * ------------------------------------------------- */

function buildLogger(meta) {
  if (meta.mode === 'research') {
    // ใช้ CSV logger เต็ม
    return createCSVLogger(meta);
  }
  // โหมด normal → ใช้ no-op logger (ไม่ดาวน์โหลด CSV)
  return {
    logSpawn() {},
    logHit() {},
    logExpire() {},
    finish() {}
  };
}

/* -------------------------------------------------
 * Start game
 * ------------------------------------------------- */

function startGameSession() {
  const cfg = pickShadowConfig(currentDiffKey);

  const participantId = currentMode === 'research'
    ? ($('#research-id')?.value || '').trim()
    : `NORMAL-${Date.now()}`;

  const groupName = currentMode === 'research'
    ? ($('#research-group')?.value || '').trim()
    : '';

  const phaseNote = currentMode === 'research'
    ? ($('#research-note')?.value || '').trim()
    : '';

  lastSessionMeta = {
    gameId:     'shadow-breaker',
    playerId:   participantId || 'anon',
    mode:       currentMode,
    difficulty: cfg.name || currentDiffKey,
    group:      groupName,
    phase:      phaseNote,
    filePrefix: 'vrfitness_shadowbreaker',
    uploadUrl:  window.VRFITNESS_UPLOAD_URL || window.SHADOWBREAKER_UPLOAD_URL || ''
  };

  logger = buildLogger(lastSessionMeta);

  const hooks = {
    onUpdate(state) {
      updateHUD(state);
    },
    onEnd(state) {
      onGameEnd(state);
    }
  };

  const host = $('#target-layer');
  renderer = new DomRenderer(null, host, {
    sizePx: cfg.targetSizePx || 96
  });

  engine = new GameEngine({
    config:   cfg,
    hooks,
    renderer,
    logger,
    mode: currentMode
  });

  lastState   = null;
  lastCoachAt = 0;
  if (elCoachBubble) elCoachBubble.classList.remove('visible');

  updateStaticHUD();
  showView('#view-play');
  engine.start();
}

function updateStaticHUD() {
  if (elMode) elMode.textContent = (currentMode === 'research') ? 'Research' : 'Normal';
  if (elDiff) elDiff.textContent = currentDiffKey;
}

/* -------------------------------------------------
 * HUD update
 * ------------------------------------------------- */

function updateFeverHUD(state) {
  if (!elFeverFill || !elFeverStatus) return;

  const charge = Math.max(0, Math.min(100, state.feverCharge || 0));
  elFeverFill.style.width = charge + '%';

  if (state.feverActive) {
    elFeverStatus.textContent = 'FEVER!!';
    elFeverStatus.classList.add('active');
  } else if (charge >= 90) {
    elFeverStatus.textContent = 'READY';
    elFeverStatus.classList.remove('active');
  } else {
    elFeverStatus.textContent = 'FEVER';
    elFeverStatus.classList.remove('active');
  }
}

function updateBossHUD(state) {
  if (!elBossName || !elBossFill) return;

  const idx   = (state.bossIndex ?? 0) + 1;
  const total = state.bossCount ?? 4;
  const hp    = state.bossHP ?? 0;
  const maxHP = state.bossMaxHP || 1;

  elBossName.textContent = `Boss ${idx}/${total}`;

  const pct = Math.max(0, Math.min(100, (hp / maxHP) * 100));
  elBossFill.style.width = pct + '%';

  // portrait info
  if (elBossPortraitEmoji) elBossPortraitEmoji.textContent = state.bossEmoji || '🥊';
  if (elBossPortraitName)  elBossPortraitName.textContent  = state.bossName || `Boss ${idx}`;

  if (!elBossPortrait) return;

  const ratio = hp / maxHP;
  if (ratio > 0 && ratio <= 0.3) {
    elBossPortrait.classList.add('visible');
    if (elBossPortraitHint) {
      elBossPortraitHint.textContent = 'HP ใกล้หมดแล้ว! ตีให้สุด! 💥';
    }
  } else {
    elBossPortrait.classList.remove('visible');
  }
}

function updateHUD(state) {
  if (elScore)   elScore.textContent   = state.score;
  if (elCombo)   elCombo.textContent   = state.combo;
  if (elMiss)    elMiss.textContent    = state.missCount;
  if (elPerfect) elPerfect.textContent = state.perfectHits ?? 0;
  if (elHP)      elHP.textContent      = state.playerHP ?? 0;

  const remainingSec = Math.max(0, (state.remainingMs || 0) / 1000);
  if (elTime) elTime.textContent = remainingSec.toFixed(1);

  updateFeverHUD(state);
  updateBossHUD(state);
  updateCoach(state);

  lastState = state;
}

/* -------------------------------------------------
 * Result
 * ------------------------------------------------- */

function mapEndReason(code) {
  switch (code) {
    case 'timeout':      return 'เล่นครบเวลา';
    case 'boss-cleared': return 'ชนะบอสครบทั้งหมด';
    case 'player-dead':  return 'HP ผู้เล่นหมด';
    case 'manual':       return 'หยุดเองจากปุ่ม';
    case 'back-to-menu': return 'ออกจากเกมกลับเมนู';
    default:             return code || '-';
  }
}

function formatMs(ms) {
  if (!ms || ms <= 0) return '-';
  return ms.toFixed(0) + ' ms';
}

function onGameEnd(state) {
  const analytics = state.analytics || {};
  const acc = analytics.accuracy != null ? analytics.accuracy : 0;

  if (elResMode)        elResMode.textContent        = (currentMode === 'research') ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  if (elResDiff)        elResDiff.textContent        = currentDiffKey;
  if (elResScore)       elResScore.textContent       = state.score;
  if (elResMaxCombo)    elResMaxCombo.textContent    = state.maxCombo;
  if (elResMiss)        elResMiss.textContent        = state.missCount;
  if (elResParticipant) elResParticipant.textContent = lastSessionMeta?.playerId || '-';
  if (elResEndReason)   elResEndReason.textContent   = mapEndReason(state.endedBy);

  if (elResAccuracy)  elResAccuracy.textContent  = (acc * 100).toFixed(1) + ' %';
  if (elResTotalHits) elResTotalHits.textContent = analytics.totalHits ?? 0;
  if (elResRTNormal)  elResRTNormal.textContent  = formatMs(analytics.avgReactionNormal || 0);
  if (elResRTDecoy)   elResRTDecoy.textContent   = formatMs(analytics.avgReactionDecoy || 0);

  if (elCoachBubble) elCoachBubble.classList.remove('visible');

  // สรุปไป dashboard รวม
  recordSession('shadow-breaker', {
    mode:       currentMode,
    difficulty: currentDiffKey,
    score:      state.score,
    maxCombo:   state.maxCombo,
    missCount:  state.missCount,
    totalHits:  analytics.totalHits ?? 0,
    accuracy:   acc,
    avgReactionMs: analytics.avgReactionNormal || 0
  });

  showView('#view-result');
}

/* -------------------------------------------------
 * Init & events
 * ------------------------------------------------- */

function init() {
  // เริ่มจากเมนู
  showView('#view-menu');

  // ---- Start buttons ----
  $('[data-action="start-research"]')?.addEventListener('click', () => {
    currentMode    = 'research';
    currentDiffKey = $('#difficulty')?.value || 'normal';
    showView('#view-research-form');
  });

  $('[data-action="start-normal"]')?.addEventListener('click', () => {
    currentMode    = 'normal';
    currentDiffKey = $('#difficulty')?.value || 'normal';
    startGameSession();
  });

  // เริ่มเล่นจากหน้า form วิจัย
  $('[data-action="research-begin-play"]')?.addEventListener('click', () => {
    currentMode    = 'research';
    currentDiffKey = $('#difficulty')?.value || 'normal';
    startGameSession();
  });

  // ---- Back to menu ----
  $$('[data-action="back-to-menu"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (engine) engine.stop('back-to-menu');
      showView('#view-menu');
    });
  });

  // ---- Stop early ----
  $('[data-action="stop-early"]')?.addEventListener('click', () => {
    if (engine) engine.stop('manual');
  });

  // ---- Download CSV button (อธิบายเฉย ๆ) ----
  $('[data-action="download-csv"]')?.addEventListener('click', () => {
    alert('ไฟล์ CSV จะถูกดาวน์โหลดอัตโนมัติเมื่อจบเกมในโหมดวิจัยค่ะ');
  });

  // ---- Play again ----
  $('[data-action="play-again"]')?.addEventListener('click', () => {
    if (!lastSessionMeta) {
      showView('#view-menu');
      return;
    }
    currentMode    = lastSessionMeta.mode || 'normal';
    currentDiffKey = lastSessionMeta.difficulty || 'normal';

    if (currentMode === 'research') {
      showView('#view-research-form');
    } else {
      startGameSession();
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
