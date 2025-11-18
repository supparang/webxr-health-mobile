// js/main.js
'use strict';

import { GameEngine } from './engine.js';
import { DomRenderer } from './dom-renderer.js';
import { createCSVLogger } from './logger-csv.js';
import { pickConfig } from './config.js';

// ---- Helper DOM ----
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showView(id) {
  $$('#view-menu, #view-research-form, #view-play, #view-result')
    .forEach(el => el.classList.add('hidden'));
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

// ---- State ----
let currentMode = 'normal'; // 'normal' | 'research'
let currentDiffKey = 'normal';
let lastSessionMeta = null;
let engine = null;
let renderer = null;
let logger = null;

// HTML refs (play)
const elScore = $('#stat-score');
const elCombo = $('#stat-combo');
const elMiss = $('#stat-miss');
const elTime = $('#stat-time');
const elMode = $('#stat-mode');
const elDiff = $('#stat-diff');

// Result refs
const elResMode = $('#res-mode');
const elResDiff = $('#res-diff');
const elResScore = $('#res-score');
const elResMaxCombo = $('#res-maxcombo');
const elResMiss = $('#res-miss');
const elResParticipant = $('#res-participant');

// ---- Init ----
function init() {
  // menu buttons
  $('[data-action="start-research"]')?.addEventListener('click', () => {
    currentMode = 'research';
    currentDiffKey = $('#difficulty').value || 'normal';
    showView('#view-research-form');
  });

  $('[data-action="start-normal"]')?.addEventListener('click', () => {
    currentMode = 'normal';
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
    // การเรียก finish() ไปแล้วใน onEnd จะ trigger download อยู่แล้ว
    // ถ้าอยากกดซ้ำดาวน์โหลดอีกครั้ง ต้องเก็บ rows ไว้แยกอีกชุด (version 2)
    alert('ไฟล์ CSV ได้ถูกดาวน์โหลดอัตโนมัติเมื่อจบเกมแล้ว ถ้าต้องการรูปแบบอื่นให้ปรับ logger เพิ่มเติม');
  });

  $('[data-action="play-again"]')?.addEventListener('click', () => {
    if (!lastSessionMeta) {
      showView('#view-menu');
      return;
    }
    currentMode = lastSessionMeta.mode;
    currentDiffKey = lastSessionMeta.difficulty;
    // ถ้าเป็น research mode ให้กลับไปกรอกแบบฟอร์มใหม่
    if (currentMode === 'research') {
      showView('#view-research-form');
    } else {
      startGameSession();
    }
  });

  // default view
  showView('#view-menu');
}

// ---- Start Session ----
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
    playerId: participantId,
    mode: currentMode,
    difficulty: diffConfig.name,
    group: groupName,
    note: note,
    phase: note || '',
    filePrefix: 'vrfitness_shadowbreaker'
  };

  // CSV logger
  logger = createCSVLogger(lastSessionMeta);

  // Engine hooks
  const hooks = {
    onUpdate: (state) => {
      updateHUD(state, diffConfig);
    },
    onEnd: (state) => {
      onGameEnd(state);
    }
  };

  // Renderer
  const host = $('#target-layer');
  renderer = new DomRenderer(null, host); // ใส่ engine ภายหลัง

  engine = new GameEngine({
    config: diffConfig,
    hooks,
    renderer,
    logger
  });

  // wire two-way
  renderer.engine = engine;

  // เริ่มเกม
  showView('#view-play');
  updateStaticHUD();
  engine.start();
}

// ---- HUD Update ----
function updateStaticHUD() {
  elMode.textContent = (currentMode === 'research') ? 'Research' : 'Normal';
  elDiff.textContent = currentDiffKey;
}

function updateHUD(state, config) {
  elScore.textContent = state.score;
  elCombo.textContent = state.combo;
  elMiss.textContent = state.missCount;

  const remainingSec = Math.max(0, state.remainingMs / 1000);
  elTime.textContent = remainingSec.toFixed(1);

  // (ถ้าจะมี FEVER/HP bar หรืออื่น ๆ เพิ่มได้ในอนาคต)
}

// ---- Game End ----
function onGameEnd(state) {
  // แสดงใน result view
  elResMode.textContent = (currentMode === 'research') ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  elResDiff.textContent = currentDiffKey;
  elResScore.textContent = state.score;
  elResMaxCombo.textContent = state.maxCombo;
  elResMiss.textContent = state.missCount;
  elResParticipant.textContent = lastSessionMeta?.playerId || '-';

  // ให้ logger สร้าง CSV download ไปแล้วใน logger.finish()
  showView('#view-result');
}

// ---- Boot ----
window.addEventListener('DOMContentLoaded', init);
