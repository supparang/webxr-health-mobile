// ./js/shadow-breaker.js
'use strict';

// --- DOM helper ---
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// views
const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

// buttons
const btnModeResearch = $('#btn-mode-research');
const btnModeNormal   = $('#btn-mode-normal');
const btnStart        = $('#btn-start');
const btnStopEarly    = $('#btn-stop-early');
const btnPlayAgain    = $('#btn-play-again');
const btnBackMenu     = $('#btn-back-menu');

// inputs
const selDiff    = $('#difficulty');
const selDur     = $('#duration');
const inputPID   = $('#participant-id');
const inputGroup = $('#participant-group');

// play HUD
const statMode   = $('#stat-mode');
const statDiff   = $('#stat-diff');
const statTime   = $('#stat-time');
const statScore  = $('#stat-score');
const statHit    = $('#stat-hit');
const statMiss   = $('#stat-miss');
const statBoss   = $('#stat-boss');
const statPhase  = $('#stat-phase');

// HP
const hpPlayerFill = $('#hp-player-fill');
const hpBossFill   = $('#hp-boss-fill');
const hpPlayerVal  = $('#hp-player-val');
const hpBossVal    = $('#hp-boss-val');
const bossName     = $('#boss-name');
const bossPortrait = $('#boss-portrait');

// result fields
const resMode   = $('#res-mode');
const resDiff   = $('#res-diff');
const resTime   = $('#res-time');
const resScore  = $('#res-score');
const resHit    = $('#res-hit');
const resMiss   = $('#res-miss');
const resBoss   = $('#res-boss');
const resPID    = $('#res-participant');
const resGroup  = $('#res-group');

// audio
const bgmShadow  = $('#bgm-shadow');
const sfxHit     = $('#sfx-hit');
const sfxPerfect = $('#sfx-perfect');
const sfxMiss    = $('#sfx-miss');
const sfxBoss    = $('#sfx-bossdown');

// internal state
let currentMode = 'normal';   // 'normal' | 'research'
let diffKey     = 'normal';   // 'easy' | 'normal' | 'hard'
let durationSec = 60;

let running = false;
let timerId = null;
let remain  = 0;
let score   = 0;
let hitCnt  = 0;
let missCnt = 0;
let bossIdx = 1;
let maxBoss = 4;

// TODO: ตรงนี้คุณสามารถ import engine จริงของ Shadow Breaker มาผูกได้
// import { ShadowEngine } from './shadow-engine.js';
// let engine = null;

// ---------- view helpers ----------
function showView(name) {
  viewMenu.classList.add('hidden');
  viewPlay.classList.add('hidden');
  viewResult.classList.add('hidden');

  if (name === 'menu')   viewMenu.classList.remove('hidden');
  if (name === 'play')   viewPlay.classList.remove('hidden');
  if (name === 'result') viewResult.classList.remove('hidden');
}

// ---------- HUD update ----------
function updateHUD() {
  statMode.textContent  = currentMode === 'research' ? 'Research' : 'Normal';
  statDiff.textContent  = diffKey.toUpperCase();
  statTime.textContent  = remain.toFixed(0) + 's';
  statScore.textContent = score;
  statHit.textContent   = hitCnt;
  statMiss.textContent  = missCnt;
  statBoss.textContent  = bossIdx + ' / ' + maxBoss;
  // phase ให้ engine ตั้งค่าเองผ่าน statPhase.textContent = ...
}

// ตัวอย่าง function สำหรับ engine เรียกกลับเข้ามาเวลาโดนเป้า/พลาด
export function onHit(isPerfect) {
  hitCnt++;
  const gain = isPerfect ? 15 : 10;
  score += gain;
  updateHUD();
  try { (isPerfect ? sfxPerfect : sfxHit).play(); } catch {}
}
export function onMiss() {
  missCnt++;
  updateHUD();
  try { sfxMiss.play(); } catch {}
}

// ---------- game flow ----------
function startGame() {
  running  = true;
  score    = 0;
  hitCnt   = 0;
  missCnt  = 0;
  bossIdx  = 1;
  remain   = durationSec;

  updateHUD();
  showView('play');

  // bgm
  try { bgmShadow.currentTime = 0; bgmShadow.play(); } catch {}

  // start timer
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    if (!running) return;
    remain -= 1;
    if (remain < 0) remain = 0;
    updateHUD();
    if (remain <= 0) {
      finishGame();
    }
  }, 1000);

  // start engine จริง
  // engine = new ShadowEngine({ diff: diffKey, onHit, onMiss, onBossDown });
  // engine.start();
}

function finishGame() {
  running = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  try { bgmShadow.pause(); } catch {}

  // engine && engine.stop();

  // เติม result
  resMode.textContent  = currentMode === 'research' ? 'โหมดวิจัย' : 'โหมดเล่นปกติ';
  resDiff.textContent  = diffKey.toUpperCase();
  resTime.textContent  = durationSec + ' วินาที';
  resScore.textContent = score;
  resHit.textContent   = hitCnt;
  resMiss.textContent  = missCnt;
  resBoss.textContent  = bossIdx + ' / ' + maxBoss;
  resPID.textContent   = inputPID.value || '-';
  resGroup.textContent = inputGroup.value || '-';

  showView('result');

  try { sfxBoss.play(); } catch {}
}

function stopEarly() {
  if (!running) {
    showView('menu');
    return;
  }
  finishGame();
}

// ---------- wire UI ----------
btnModeResearch?.addEventListener('click', () => {
  currentMode = 'research';
  btnModeResearch.classList.add('primary');
  btnModeNormal.classList.remove('primary');
});

btnModeNormal?.addEventListener('click', () => {
  currentMode = 'normal';
  btnModeNormal.classList.add('primary');
  btnModeResearch.classList.remove('primary');
});

btnStart?.addEventListener('click', () => {
  diffKey     = selDiff.value;
  durationSec = parseInt(selDur.value, 10) || 60;
  startGame();
});

btnStopEarly?.addEventListener('click', stopEarly);
btnBackMenu?.addEventListener('click', () => showView('menu'));
btnPlayAgain?.addEventListener('click', () => {
  showView('menu');
});

// เริ่มต้นที่หน้าเมนู
showView('menu');
updateHUD();