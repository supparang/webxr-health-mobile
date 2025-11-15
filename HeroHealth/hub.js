// === Hero Health — hub.js (safe redirect version) ===
// หน้านี้มีหน้าที่แค่: เลือก mode/diff/time แล้วเด้งไป index.vr.html

'use strict';

const MODES = ['goodjunk', 'groups', 'hydration', 'plate'];

let currentMode = 'goodjunk';

function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return document.querySelectorAll(sel);
}

function selectMode(modeId) {
  if (!MODES.includes(modeId)) return;
  currentMode = modeId;

  // ลบ active จากทุกการ์ด
  $all('#modeRow .card').forEach(card => {
    card.classList.remove('active');
  });

  // ใส่ active ให้การ์ดที่เลือก
  const card = document.querySelector('#modeRow .card[data-mode="' + modeId + '"]');
  if (card) {
    card.classList.add('active');
  }
}

function initModeCards() {
  const cards = $all('#modeRow .card[data-mode]');
  if (!cards.length) return;

  cards.forEach(card => {
    const modeId = card.getAttribute('data-mode');
    card.addEventListener('click', () => {
      selectMode(modeId);
    });
  });

  // ตั้งค่าเริ่มต้นเป็น goodjunk
  selectMode(currentMode);
}

function clampTime(sec) {
  let n = parseInt(sec, 10);
  if (isNaN(n)) n = 60;
  if (n < 20) n = 20;
  if (n > 180) n = 180;
  return n;
}

function onStartClick() {
  const diffSel = $('#selDiff');
  const timeInp = $('#inpTime');

  const diff = diffSel ? (diffSel.value || 'normal') : 'normal';
  const time = clampTime(timeInp ? timeInp.value : 60);

  // อัปเดตช่องเวลาให้ตรงกับค่าที่ clamp แล้ว (กันเด็กพิมพ์ 9999 แล้วงง)
  if (timeInp) timeInp.value = String(time);

  const params = new URLSearchParams();
  params.set('mode', currentMode);
  params.set('diff', diff);
  params.set('time', String(time));

  const url = './index.vr.html?' + params.toString();
  console.log('[HERO-HUB] redirect to', url);

  // เด้งไปหน้าเล่นเกมจริง
  window.location.href = url;
}

function initStartButton() {
  const btn = $('#btnStart');
  if (!btn) return;
  btn.addEventListener('click', onStartClick);
}

function bootstrap() {
  initModeCards();
  initStartButton();
  console.log('[HERO-HUB] ready. default mode =', currentMode);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
