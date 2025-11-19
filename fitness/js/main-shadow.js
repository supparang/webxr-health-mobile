// === fitness/js/main-shadow.js (2025-11-19 — boss phase, FEVER, coach, result) ===
'use strict';

import { GameEngine } from './engine.js';
import { DomRenderer } from './dom-renderer.js';
import { createCSVLogger } from './logger-csv.js';
import { pickConfig } from './config.js';
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

// ---------- Global state ----------

let currentMode    = 'normal';  // 'normal' | 'research'
let currentDiffKey = 'normal';

let engine   = null;
let renderer = null;
let logger   = null;

let lastState       = null;
let lastSessionMeta = null;

let coachTimer  = null;
let lastCoachAt = 0;

// HUD refs
const elScore   = $('#stat-score');
const elCombo   = $('#stat-combo');
const elMiss    = $('#stat-miss');
const elTime    = $('#stat-time');
const elMode    = $('#stat-mode');
const elDiff    = $('#stat-diff');
const elPerfect = $('#stat-perfect');
const elHP      = $('#stat-hp');

// FEVER HUD
const elFeverFill   = $('#fever-fill');
const elFeverStatus = $('#fever-status');

// Boss HUD
const elBossName = $('#boss-name');
const elBossFill = $('#boss-fill');

// Boss portrait
const elBossPortrait      = $('#boss-portrait');
const elBossPortraitEmoji = $('#boss-portrait-emoji');
const elBossPortraitName  = $('#boss-portrait-name');
const elBossPortraitHint  = $('#boss-portrait-hint');

// Play area (ใช้เปลี่ยน background + FEVER effect)
const elPlayArea = document.querySelector('.play-area');

// Coach HUD
const elCoachBubble = $('#coach-bubble');
const elCoachAvatar = $('#coach-avatar');
const elCoachRole   = $('#coach-role');
const elCoachText   = $('#coach-text');

// Result
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

// ---------- Coach system ----------

const COACH_LINES = {
  kids: {
    welcome:    'พร้อมลุย Shadow Breaker แล้ว! ชกเป้าให้ทันนะ 🥊',
    feverReady: 'เกจใกล้เต็มแล้ว เตรียมเข้าโหมด FEVER! ✨',
    feverOn:    'FEVER แล้ว! ชกให้รัว แต่ยังต้องเล็งดี ๆ นะ 💥',
    hpLow:      'HP เหลือน้อยแล้ว หายใจลึก ๆ ตั้งสติแล้วค่อยชก ✨',
    bossNext:   'บอสตัวต่อไปมาแล้ว! ยากขึ้นอีกนิด แต่สู้ไหวแน่ 😈',
    missSoft:   'พลาดไปนิด ไม่เป็นไร รอบหน้าเอาใหม่! 👍'
  },
  research: {
    welcome:    'โหมดวิจัย: โฟกัสจังหวะหมัดกับการหายใจให้สม่ำเสมอครับ 🧪',
    feverReady: 'ค่า FEVER ใกล้เต็มแล้ว ลองรักษาจังหวะให้ต่อเนื่องครับ ✨',
    feverOn:    'เข้าสู่ช่วง FEVER: สังเกตว่ารู้สึกเร็วขึ้นแต่ยังควบคุมได้หรือไม่ 💡',
    hpLow:      'HP ลดลงมาก แนะนำผ่อนแรงเล็กน้อยแต่รักษาความแม่นยำครับ 💚',
    bossNext:   'เริ่มบอสตัวใหม่แล้ว ลองเปรียบเทียบความล้ากับตัวก่อนดูครับ 📊',
    missSoft:   'มี miss เพิ่มขึ้นเล็กน้อย ลองโฟกัสการมองเป้าและการซิงค์มือสายตาครับ 👀'
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
  const text    = lines[key];
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

// ---------- Game start / stop ----------

function startGameSession() {
  const diffConfig = pickConfig(currentDiffKey);

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
    difficulty: diffConfig.name,
    group:      groupName,
    phase:      phaseNote,
    filePrefix: 'vrfitness_shadowbreaker'
  };

  logger = createCSVLogger(lastSessionMeta);

  const hooks = {
    onUpdate(state) {
      updateHUD(state);
    },
    onEnd(state) {
      onGameEnd(state);
    }
  };

  const host = $('#target-layer');
  renderer = new DomRenderer(null, host, { sizePx: diffConfig.targetSizePx });
  renderer.setEngine?.(null); // เคลียร์ของเดิมเผื่อมี
  engine = new GameEngine({
    config:   diffConfig,
    hooks,
    renderer,
    logger,
    mode: currentMode
  });
  renderer.setEngine?.(engine);

  lastState   = null;
  lastCoachAt = 0;
  if (elCoachBubble) elCoachBubble.classList.remove('visible');

  showView('#view-play');
  updateStaticHUD();
  engine.start();
}

function updateStaticHUD() {
  if (elMode) elMode.textContent = (currentMode === 'research') ? 'Research' : 'Normal';
  if (elDiff) elDiff.textContent = currentDiffKey;
}

// ---------- HUD updates ----------

function updateFeverHUD(state) {
  if (!elFeverFill || !elFeverStatus) return;
  const charge = Math.max(0, Math.min(100, state.feverCharge || 0));
  elFeverFill.style.width = charge + '%';

  if (state.feverActive) {
    elFeverStatus.textContent = 'FEVER!!';
    elFeverStatus.classList.add('active');
    if (elPlayArea) elPlayArea.classList.add('fever-hot');
  } else if (charge >= 90) {
    elFeverStatus.textContent = 'READY';
    elFeverStatus.classList.remove('active');
    if (elPlayArea) elPlayArea.classList.remove('fever-hot');
  } else {
    elFeverStatus.textContent = 'FEVER';
    elFeverStatus.classList.remove('active');
    if (elPlayArea) elPlayArea.classList.remove('fever-hot');
  }
}

function updateBossHUD(state) {
  if (!elBossName || !elBossFill) return;

  const idx   = (state.bossIndex ?? 0) + 1;
  const total = state.bossCount ?? 4;
  const hp    = state.bossHP ?? 0;
  const maxHP = state.bossMaxHP || 1;

  // ชื่อบอส + ลำดับ
  const bossLabel = state.bossName
    ? `${state.bossName} (${idx}/${total})`
    : `Boss ${idx}/${total}`;
  elBossName.textContent = bossLabel;

  // แถบ HP
  const pct = Math.max(0, Math.min(100, (hp / maxHP) * 100));
  elBossFill.style.width = pct + '%';

  // เปลี่ยนพื้นหลังตามบอส
  if (elPlayArea) {
    const allBossClasses = ['boss-1','boss-2','boss-3','boss-4','final-boss'];
    elPlayArea.classList.remove(...allBossClasses);

    const bossClass = state.bossBgClass || `boss-${idx}`;
    elPlayArea.classList.add(bossClass);

    if (idx === total) {
      // บอสตัวสุดท้าย → ใส่ animation
      elPlayArea.classList.add('final-boss');
    } else {
      elPlayArea.classList.remove('final-boss');
    }
  }

  // portrait
  if (elBossPortraitEmoji && state.bossEmoji) {
    elBossPortraitEmoji.textContent = state.bossEmoji;
  }
  if (elBossPortraitName && state.bossName) {
    elBossPortraitName.textContent = state.bossName;
  }

  if (!elBossPortrait) return;

  const ratio = hp / maxHP;
  const isLow = ratio > 0 && ratio <= 0.3;

  if (isLow) {
    elBossPortrait.classList.add('visible');
    if (elBossPortraitHint) {
      elBossPortraitHint.textContent =
        ratio <= 0.15
          ? 'เกือบแตกแล้ว! รัวหมัดชุดสุดท้ายเลย 💥'
          : 'HP ใกล้หมดแล้ว! ตีให้สุด! 💥';
    }

    // HP ต่ำมาก → portrait สั่น
    if (ratio <= 0.15) {
      elBossPortrait.classList.add('shake');
    } else {
      elBossPortrait.classList.remove('shake');
    }
  } else {
    elBossPortrait.classList.remove('visible');
    elBossPortrait.classList.remove('shake');
  }
}

function updateHUD(state) {
  if (elScore)   elScore.textContent   = state.score;
  if (elCombo)   elCombo.textContent   = state.combo;
  if (elMiss)    elMiss.textContent    = state.missCount;
  if (elPerfect) elPerfect.textContent = state.perfectHits ?? 0;
  if (elHP)      elHP.textContent      = state.playerHP ?? 0;

  const remainingSec = Math.max(0, state.remainingMs / 1000);
  if (elTime) elTime.textContent = remainingSec.toFixed(1);

  updateFeverHUD(state);
  updateBossHUD(state);
  updateCoach(state);

  lastState = state;
}

// ---------- Result view ----------

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

  if (elResMode)        elResMode.textContent        = (currentMode === 'research') ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  if (elResDiff)        elResDiff.textContent        = currentDiffKey;
  if (elResScore)       elResScore.textContent       = state.score;
  if (elResMaxCombo)    elResMaxCombo.textContent    = state.maxCombo;
  if (elResMiss)        elResMiss.textContent        = state.missCount;
  if (elResParticipant) elResParticipant.textContent = lastSessionMeta?.playerId || '-';
  if (elResEndReason)   elResEndReason.textContent   = mapEndReason(state.endedBy);

  const acc = analytics.accuracy != null ? analytics.accuracy : 0;
  if (elResAccuracy)  elResAccuracy.textContent  = (acc * 100).toFixed(1) + ' %';
  if (elResTotalHits) elResTotalHits.textContent = analytics.totalHits ?? 0;
  if (elResRTNormal)  elResRTNormal.textContent  = formatMs(analytics.avgReactionNormal || 0);
  if (elResRTDecoy)   elResRTDecoy.textContent   = formatMs(analytics.avgReactionDecoy || 0);

  if (elCoachBubble) elCoachBubble.classList.remove('visible');

  // ---- Save summary to dashboard ----
  recordSession('shadow-breaker', {
    mode: currentMode,
    difficulty: currentDiffKey,
    score: state.score,
    maxCombo: state.maxCombo,
    missCount: state.missCount,
    totalHits: analytics.totalHits ?? 0,
    accuracy: acc,
    avgReactionMs: analytics.avgReactionNormal || 0
  });

  showView('#view-result');
}

// ---------- Init & event wiring ----------

function init() {
  // Start buttons
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

  // ปุ่ม "กลับเมนูเกม" ทุกปุ่ม (ทั้งในหน้าโหมดวิจัยและหน้า Result)
  $$('[data-action="back-to-menu"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (engine) engine.stop('back-to-menu');
      showView('#view-menu');
    });
  });

  // ปุ่มเริ่มจากหน้าโหมดวิจัย
  $('[data-action="research-begin-play"]')?.addEventListener('click', () => {
    currentDiffKey = $('#difficulty')?.value || 'normal';
    startGameSession();
  });

  // ปุ่มหยุดก่อนเวลา
  $('[data-action="stop-early"]')?.addEventListener('click', () => {
    if (engine) engine.stop('manual');
  });

  // ปุ่ม Download CSV (ปัจจุบันไฟล์จะโหลดอัตโนมัติตอนจบเกม)
  $('[data-action="download-csv"]')?.addEventListener('click', () => {
    alert('ไฟล์ CSV จะถูกดาวน์โหลดอัตโนมัติเมื่อจบเกม (โหมดวิจัย) หากต้องการอัปโหลดขึ้น cloud ให้กำหนด VRFITNESS_UPLOAD_URL ที่หน้า HTML');
  });

  // ปุ่มเล่นอีกครั้ง (ใช้การตั้งค่าเดิม)
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

  showView('#view-menu');
}

window.addEventListener('DOMContentLoaded', init);
