// js/main-shadow.js
'use strict';

import { GameEngine } from './engine.js';
import { DomRenderer } from './dom-renderer.js';
import { createCSVLogger } from './logger-csv.js';
import { pickConfigShadow } from './config-shadow.js';

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showView(id) {
  $$('#view-menu, #view-research-form, #view-play, #view-result')
    .forEach(el => el.classList.add('hidden'));
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

// ---- State ----
let currentMode    = 'normal'; // 'normal' | 'research'
let currentDiffKey = 'normal';
let lastSessionMeta = null;
let engine   = null;
let renderer = null;
let logger   = null;

// HUD refs
const elScore = $('#stat-score');
const elCombo = $('#stat-combo');
const elMiss  = $('#stat-miss');
const elTime  = $('#stat-time');
const elMode  = $('#stat-mode');
const elDiff  = $('#stat-diff');

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

function startGameSession() {
  const diffConfig = pickConfigShadow(currentDiffKey);

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
  renderer = new DomRenderer(null, host);

  engine = new GameEngine({
    config:   diffConfig,
    hooks,
    renderer,
    logger
  });
  renderer.engine = engine;

  showView('#view-play');
  updateStaticHUD();
  engine.start();
}

function updateStaticHUD() {
  elMode.textContent = (currentMode === 'research') ? 'Research' : 'Normal';
  elDiff.textContent = currentDiffKey;
}

function updateHUD(state) {
  elScore.textContent = state.score;
  elCombo.textContent = state.combo;
  elMiss.textContent  = state.missCount;

  const remainingSec = Math.max(0, state.remainingMs / 1000);
  elTime.textContent = remainingSec.toFixed(1);
}

function onGameEnd(state) {
  elResMode.textContent        = (currentMode === 'research') ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  elResDiff.textContent        = currentDiffKey;
  elResScore.textContent       = state.score;
  elResMaxCombo.textContent    = state.maxCombo;
  elResMiss.textContent        = state.missCount;
  elResParticipant.textContent = lastSessionMeta?.playerId || '-';

  showView('#view-result');
}

window.addEventListener('DOMContentLoaded', init);
