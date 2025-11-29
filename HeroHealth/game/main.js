// === /HeroHealth/game/main.js (Multiverse + Quest + Research HUD – 2025-11-29) ===
'use strict';

import { createGameEngine } from './engine.js';

// ---------- URL params ----------
const url  = new URL(window.location.href);
const MODE = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();   // goodjunk | hydration | plate | groups
const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();

let timeParam = parseInt(url.searchParams.get('time'), 10);
if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
if (timeParam < 20)  timeParam = 20;
if (timeParam > 180) timeParam = 180;
const GAME_DURATION = timeParam;

// ---------- Helpers ----------
const $    = sel => document.querySelector(sel);
const $all = sel => document.querySelectorAll(sel);

function hideLoadingScene() {
  const scene = $('.scene-wrap');
  if (scene) scene.style.display = 'none';
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------- Mode labels (TH/EN mix) ----------
const MODE_NAME = {
  goodjunk : 'GOODJUNK',
  hydration: 'HYDRATION',
  plate    : 'BALANCED PLATE',
  groups   : 'FOOD GROUPS'
};

const MODE_DESC = {
  goodjunk : 'เลือกอาหารดี • เลี่ยงขนม/น้ำหวาน',
  hydration: 'รักษาระดับน้ำในร่างกายให้อยู่ในโซนสมดุล (GREEN)',
  plate    : 'จัดจานให้ครบอาหาร 5 หมู่',
  groups   : 'เลือกอาหารตามหมู่เป้าหมายที่กำหนด'
};

// ---------- DOM refs (ยืดหยุ่น: ถ้าไม่มี id นั้นก็จะข้ามไปเอง) ----------
const elScore      = $('#hudScore')      || $('#scoreVal');
const elCombo      = $('#hudCombo')      || $('#comboVal');
const elTime       = $('#hudTime')       || $('#timeVal');
const elTimeChip   = $('#hudTimeChip')   || $('#timeChip');
const elModeChip   = $('#hudMode')       || $('#hudModeChip');
const elModeTitle  = $('#hudModeTitle')  || $('#modeTitle');
const elModeDesc   = $('#hudModeDesc')   || $('#modeDesc');

// quest HUD
const elQuestGoal  = $('#hudQuestGoal');
const elQuestMini  = $('#hudQuestMini');
const elQuestHint  = $('#hudQuestHint');

// coach bubble
const elCoachBox   = $('#hudCoach');

// meta summary (หลังจบเกม)
const elMetaWrap   = $('#metaWrap');
const elMetaScore  = $('#metaScore');
const elMetaCombo  = $('#metaCombo');
const elMetaMiss   = $('#metaMiss');
const elMetaQuests = $('#metaQuests');

// buttons
const btnStart  = $('#btnStartGame') || $('#btnStart') || $('[data-role="start"]');
const btnPause  = $('#btnPause')     || $('#btnTogglePause');
const btnBack   = $('#btnBackHub')   || $('[data-role="back-hub"]');
const btnReplay = $('#btnReplay');

// ---------- Game runtime state ----------
let engine     = null;
let playing    = false;
let paused     = false;
let timeLeft   = GAME_DURATION;

// ---------- Initial HUD setup ----------
function initHUD() {
  const modeLabel = MODE_NAME[MODE] || 'GOODJUNK';
  const modeDesc  = MODE_DESC[MODE] || '';

  if (elModeChip)  elModeChip.textContent  = `${modeLabel.toUpperCase()} • ${DIFF.toUpperCase()} • ${GAME_DURATION}s`;
  if (elModeTitle) elModeTitle.textContent = modeLabel;
  if (elModeDesc)  elModeDesc.textContent  = modeDesc;

  const startLabel = $('#startModeLabel');
  if (startLabel) {
    startLabel.textContent = `เริ่ม: ${modeLabel}`;
  }

  if (elScore) elScore.textContent = '0';
  if (elCombo) elCombo.textContent = '0';
  if (elTime)  elTime.textContent  = '0';
  if (elTimeChip) elTimeChip.textContent = `TIME ${GAME_DURATION}s`;

  if (elQuestGoal) elQuestGoal.textContent = '';
  if (elQuestMini) elQuestMini.textContent = '';
  if (elQuestHint) elQuestHint.textContent = '';

  if (elCoachBox) {
    elCoachBox.textContent = '';
    elCoachBox.classList.remove('show');
  }

  if (elMetaWrap) {
    elMetaWrap.classList.add('hidden');
  }
}

// ---------- Event listeners from engine / modes ----------
function setupEventBridges() {
  // คะแนน + คอมโบ
  window.addEventListener('hha:score', ev => {
    const d = ev.detail || {};
    if (elScore && typeof d.total === 'number') elScore.textContent = String(d.total);
    if (elCombo && typeof d.combo === 'number') elCombo.textContent = String(d.combo);
  });

  // เวลา (จาก factory clock กลาง)
  window.addEventListener('hha:time', ev => {
    const sec = (ev.detail && typeof ev.detail.sec === 'number') ? ev.detail.sec : null;
    if (sec === null) return;
    timeLeft = clamp(sec, 0, GAME_DURATION);

    if (elTime)     elTime.textContent = String(timeLeft);
    if (elTimeChip) elTimeChip.textContent = `TIME ${timeLeft}s`;
  });

  // Quest HUD (โหมดที่ใช้ MissionDeck)
  window.addEventListener('quest:update', ev => {
    const d = ev.detail || {};
    if (elQuestGoal) {
      elQuestGoal.textContent = d.goal && d.goal.label
        ? `Goal: ${d.goal.label}`
        : '';
    }
    if (elQuestMini) {
      elQuestMini.textContent = d.mini && d.mini.label
        ? `Mini: ${d.mini.label}`
        : '';
    }
    if (elQuestHint) {
      elQuestHint.textContent = d.hint || '';
    }
  });

  // โค้ช (ข้อความสั้น ๆ)
  window.addEventListener('hha:coach', ev => {
    if (!elCoachBox) return;
    const txt = ev.detail && ev.detail.text ? String(ev.detail.text) : '';
    if (!txt) return;
    elCoachBox.textContent = txt;
    elCoachBox.classList.add('show');

    // auto fade
    clearTimeout(elCoachBox._timer);
    elCoachBox._timer = setTimeout(() => {
      elCoachBox.classList.remove('show');
    }, 4200);
  });

  // จบเกม – สรุปผล
  window.addEventListener('hha:end', ev => {
    const d = ev.detail || {};
    playing = false;
    paused  = false;

    if (btnStart) {
      btnStart.disabled = false;
      btnStart.textContent = 'เล่นอีกครั้ง';
    }

    if (elMetaWrap) {
      elMetaWrap.classList.remove('hidden');
      if (elMetaScore)  elMetaScore.textContent  = String(d.score ?? 0);
      if (elMetaCombo)  elMetaCombo.textContent  = String(d.comboMax ?? 0);
      if (elMetaMiss)   elMetaMiss.textContent   = String(d.misses ?? 0);
      if (elMetaQuests) {
        const g = d.goalsCleared, gt = d.goalsTotal;
        const m = d.questsCleared, mt = d.questsTotal;
        if (typeof g === 'number' && typeof gt === 'number' &&
            typeof m === 'number' && typeof mt === 'number') {
          elMetaQuests.textContent = `Goal ${g}/${gt} • Mini ${m}/${mt}`;
        }
      }
    }
  });
}

// ---------- Game control ----------
async function startGame() {
  if (playing) return;

  hideLoadingScene();
  initHUD();

  // ซ่อน summary เก่า
  if (elMetaWrap) elMetaWrap.classList.add('hidden');

  // สร้าง engine ครั้งแรกเท่านั้น
  if (!engine) {
    engine = await createGameEngine({
      mode      : MODE,
      difficulty: DIFF,
      duration  : GAME_DURATION
    });
  }

  playing  = true;
  paused   = false;
  timeLeft = GAME_DURATION;

  if (btnStart) {
    btnStart.disabled = true; // กัน double click ระหว่างเริ่ม
    setTimeout(() => { if (btnStart) btnStart.disabled = false; }, 800);
    btnStart.textContent = 'กำลังเล่น...';
  }

  engine.start();
}

function togglePause() {
  if (!engine || !playing) return;
  if (!engine.pause || !engine.resume) return;

  paused = !paused;
  if (paused) {
    engine.pause();
    if (btnPause) btnPause.textContent = 'เล่นต่อ ▶';
  } else {
    engine.resume();
    if (btnPause) btnPause.textContent = 'หยุดพัก ⏸';
  }
}

function goBackHub() {
  const next = url.searchParams.get('next');
  if (next) {
    window.location.href = next;
  } else {
    window.history.back();
  }
}

// ---------- Wire buttons ----------
function bindButtons() {
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      startGame().catch(err => console.error('startGame error', err));
    });
  }

  if (btnPause) {
    btnPause.addEventListener('click', () => togglePause());
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => goBackHub());
  }

  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      // reload หน้าเดิม พร้อมพารามิเตอร์เดิม
      window.location.reload();
    });
  }
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', () => {
  initHUD();
  setupEventBridges();
  bindButtons();
});