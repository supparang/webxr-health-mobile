// js/main-shadow.js
'use strict';

import { GameEngine } from './engine.js';
import { DomRenderer } from './dom-renderer.js';
import { createCSVLogger } from './logger-csv.js';
import { pickConfig } from './config.js';

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showView(id) {
  $$('#view-menu, #view-research-form, #view-play, #view-result')
    .forEach(el => el.classList.add('hidden'));
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

// ---- State ----
let currentMode    = 'normal';
let currentDiffKey = 'normal';
let lastSessionMeta = null;
let engine   = null;
let renderer = null;
let logger   = null;
let lastState = null;
let coachTimer = null;

// HUD refs
const elScore   = $('#stat-score');
const elCombo   = $('#stat-combo');
const elMiss    = $('#stat-miss');
const elTime    = $('#stat-time');
const elMode    = $('#stat-mode');
const elDiff    = $('#stat-diff');
const elPerfect = $('#stat-perfect');
const elHP      = $('#stat-hp');

// Fever HUD
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

// Coach HUD
const elCoachBubble  = $('#coach-bubble');
const elCoachAvatar  = $('#coach-avatar');
const elCoachRole    = $('#coach-role');
const elCoachText    = $('#coach-text');

// Result refs
const elResMode        = $('#res-mode');
const elResDiff        = $('#res-diff');
const elResScore       = $('#res-score');
const elResMaxCombo    = $('#res-maxcombo');
const elResMiss        = $('#res-miss');
const elResParticipant = $('#res-participant');

function init() {
  $('[data-action="start-research"]')?.addEventListener('click', () => {
    currentMode    = 'research';
    currentDiffKey = $('#difficulty').value || 'normal';
    showView('#view-research-form');
  });

  $('[data-action="start-normal"]')?.addEventListener('click', () => {
    currentMode    = 'normal';
    currentDiffKey = $('#difficulty').value || 'normal';
    startGameSession();
  });

  $('[data-action="back-to-menu"]')?.addEventListener('click', () => {
    if (engine) engine.stop('back-to-menu');
    showView('#view-menu');
  });

  $('[data-action="research-begin-play"]')?.addEventListener('click', () => {
    currentDiffKey = $('#difficulty').value || 'normal';
    startGameSession();
  });

  $('[data-action="stop-early"]')?.addEventListener('click', () => {
    if (engine) engine.stop('manual');
  });

  $('[data-action="download-csv"]')?.addEventListener('click', () => {
    alert('ไฟล์ CSV ถูกดาวน์โหลดอัตโนมัติเมื่อจบเกมแล้ว ถ้าต้องการดาวน์โหลดซ้ำให้ปรับ logger เพิ่มเติมภายหลังได้');
  });

  $('[data-action="play-again"]')?.addEventListener('click', () => {
    if (!lastSessionMeta) {
      showView('#view-menu');
      return;
    }
    currentMode    = lastSessionMeta.mode;
    currentDiffKey = lastSessionMeta.difficulty;
    if (currentMode === 'research') {
      showView('#view-research-form');
    } else {
      startGameSession();
    }
  });

  showView('#view-menu');
}

// --------- Coach logic ---------

const COACH_LINES = {
  kids: {
    welcome: 'พร้อมลุย Shadow Breaker แล้ว! ชกเป้าให้ทันนะ 🥊',
    feverReady: 'เกจใกล้เต็มแล้ว เตรียมเข้าโหมด FEVER! ✨',
    feverOn: 'FEVER แล้ว! ชกให้รัว แต่ยังต้องเล็งดี ๆ นะ 💥',
    hpLow: 'HP เหลือน้อยแล้ว หายใจลึก ๆ ตั้งสติแล้วค่อยชก ✨',
    bossNext: 'บอสตัวต่อไปมาแล้ว! ยากขึ้นอีกนิด แต่สู้ไหวแน่ 😈',
    missSoft: 'พลาดไปนิด ไม่เป็นไร รอบหน้าลองใหม่ได้ 👍'
  },
  research: {
    welcome: 'โหมดวิจัย: โฟกัสจังหวะการชกให้สม่ำเสมอ และสังเกตการหายใจของตัวเองครับ 🧪',
    feverReady: 'ค่า FEVER ใกล้เต็มแล้ว ลองรักษาจังหวะให้ต่อเนื่องครับ ✨',
    feverOn: 'เข้าสู่ช่วง FEVER: สังเกตว่าการเคลื่อนไหวเร็วขึ้นแต่ยังควบคุมได้หรือไม่ 💡',
    hpLow: 'HP ลดลงมาก แนะนำให้ผ่อนแรงเล็กน้อยแต่รักษาความแม่นยำครับ 💚',
    bossNext: 'เริ่มบอสตัวใหม่แล้ว ลองเทียบความล้าระหว่างตัวก่อนกับตัวนี้ดูครับ 📊',
    missSoft: 'มี miss เพิ่มขึ้นเล็กน้อย ลองโฟกัสที่การมองเป้าและ coordination อีกครั้งครับ 👀'
  }
};

function getCoachPersona(){
  return currentMode === 'research' ? 'research' : 'kids';
}

function setCoachMessage(key){
  if (!elCoachBubble || !elCoachText || !elCoachAvatar || !elCoachRole) return;
  const persona = getCoachPersona();
  const lines = COACH_LINES[persona];
  const text = lines[key];
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
  coachTimer = setTimeout(()=>{
    elCoachBubble.classList.remove('visible');
  }, 4200);
}

function updateCoach(state){
  const prev = lastState;

  if (!prev) {
    // first frame after start
    setCoachMessage('welcome');
    return;
  }

  // FEVER ready
  if ((state.feverCharge >= 90) && (prev.feverCharge < 90)) {
    setCoachMessage('feverReady');
    return;
  }

  // FEVER active toggled
  if (!prev.feverActive && state.feverActive) {
    setCoachMessage('feverOn');
    return;
  }

  // HP ต่ำกว่า 30 เป็นครั้งแรก
  if ((state.playerHP <= 30) && (prev.playerHP > 30)) {
    setCoachMessage('hpLow');
    return;
  }

  // เปลี่ยนบอส
  if ((state.bossIndex > prev.bossIndex)) {
    setCoachMessage('bossNext');
    return;
  }

  // miss เพิ่มขึ้น
  if (state.missCount > prev.missCount) {
    setCoachMessage('missSoft');
    return;
  }
}

// --------- Game session ---------

function startGameSession() {
  const diffConfig = pickConfig(currentDiffKey);

  const participantId = currentMode === 'research'
    ? ($('#research-id').value || '').trim()
    : 'NORMAL-' + Date.now();

  const groupName = currentMode === 'research'
    ? ($('#research-group').value || '').trim()
    : '';

  const note = currentMode === 'research'
    ? ($('#research-note').value || '').trim()
    : '';

  lastSessionMeta = {
    playerId:   participantId,
    mode:       currentMode,
    difficulty: diffConfig.name,
    group:      groupName,
    note,
    phase:      note || '',
    filePrefix: 'vrfitness_shadowbreaker'
  };

  logger = createCSVLogger(lastSessionMeta);

  const hooks = {
    onUpdate: (state) => {
      updateHUD(state);
    },
    onEnd: (state) => {
      onGameEnd(state);
    }
  };

  const host = $('#target-layer');
  renderer = new DomRenderer(null, host, { sizePx: diffConfig.targetSizePx });

  engine = new GameEngine({
    config:   diffConfig,
    hooks,
    renderer,
    logger,
    mode: currentMode
  });
  renderer.engine = engine;

  lastState = null;
  showView('#view-play');
  updateStaticHUD();
  engine.start();
}

function updateStaticHUD() {
  elMode.textContent = (currentMode === 'research') ? 'Research' : 'Normal';
  elDiff.textContent = currentDiffKey;
}

function updateFeverHUD(state){
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

function updateBossHUD(state){
  if (!elBossName || !elBossFill) return;

  const idx   = (state.bossIndex ?? 0) + 1;
  const total = state.bossCount ?? 4;
  const hp    = state.bossHP ?? 0;
  const maxHP = state.bossMaxHP || 1;

  const bossLabel = state.bossName
    ? `${state.bossName} (${idx}/${total})`
    : `Boss ${idx}/${total}`;
  elBossName.textContent = bossLabel;

  const pct = Math.max(0, Math.min(100, (hp / maxHP) * 100));
  elBossFill.style.width = pct + '%';

  // portrait: set emoji+name every frame
  if (elBossPortraitEmoji && state.bossEmoji) {
    elBossPortraitEmoji.textContent = state.bossEmoji;
  }
  if (elBossPortraitName && state.bossName) {
    elBossPortraitName.textContent = state.bossName;
  }

  // show portrait only when HP is low (finish phase)
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
  elScore.textContent   = state.score;
  elCombo.textContent   = state.combo;
  elMiss.textContent    = state.missCount;
  elPerfect.textContent = state.perfectHits ?? 0;
  if (elHP) elHP.textContent = state.playerHP ?? 0;

  const remainingSec = Math.max(0, state.remainingMs / 1000);
  elTime.textContent = remainingSec.toFixed(1);

  updateFeverHUD(state);
  updateBossHUD(state);

  // Coach
  updateCoach(state);
  lastState = state;
}

function onGameEnd(state) {
  elResMode.textContent        = (currentMode === 'research') ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  elResDiff.textContent        = currentDiffKey;
  elResScore.textContent       = state.score;
  elResMaxCombo.textContent    = state.maxCombo;
  elResMiss.textContent        = state.missCount;
  elResParticipant.textContent = lastSessionMeta?.playerId || '-';

  // ปิดโค้ชหลังจบรอบ
  if (elCoachBubble) elCoachBubble.classList.remove('visible');

  showView('#view-result');
}

window.addEventListener('DOMContentLoaded', init);
