// === /herohealth/vr/ui-fever.js ===
// Fever gauge + Shield (shared UI: GoodJunk / Groups / Hydration)
// เวอร์ชันตัดซ้อน เหลือ Fever แถวเดียว + Shield counter

'use strict';

let feverRoot   = null;
let barEl       = null;
let pctEl       = null;
let shieldEl    = null;
let cardEl      = null;

/**
 * สร้าง Fever bar มุมล่างซ้าย (mobile-first)
 * จะสร้างครั้งเดียว ถ้ามีอยู่แล้วจะ return ตัวเดิม
 */
function ensureFeverBar() {
  if (feverRoot) return feverRoot;

  feverRoot = document.createElement('div');
  feverRoot.id = 'hha-fever-wrap';
  feverRoot.className = 'hha-fever-wrap';

  // ★ เหลือ Fever แถวเดียว ไม่ทำ pill "FEVER" แยกแล้ว
  feverRoot.innerHTML = `
    <div class="hha-fever-card">
      <div class="hha-fever-row-main">
        <div class="hha-fever-left">
          <span class="hha-fever-icon">🔥</span>
          <span class="hha-fever-label">FEVER GAUGE</span>
        </div>
        <div class="hha-fever-right">
          <span class="hha-fever-shield">
            <span class="hha-fever-shield-icon">🛡️</span>
            <span class="hha-fever-shield-count" id="hha-fever-shield">0</span>
          </span>
          <span class="hha-fever-pct" id="hha-fever-pct">0%</span>
        </div>
      </div>
      <div class="hha-fever-bar">
        <div class="hha-fever-bar-fill" id="hha-fever-bar"></div>
      </div>
    </div>
  `;

  document.body.appendChild(feverRoot);

  cardEl   = feverRoot.querySelector('.hha-fever-card');
  barEl    = document.getElementById('hha-fever-bar');
  pctEl    = document.getElementById('hha-fever-pct');
  shieldEl = document.getElementById('hha-fever-shield');

  return feverRoot;
}

/**
 * อัปเดตค่า Fever 0–100
 */
function setFever(pct) {
  if (!feverRoot) ensureFeverBar();
  const v = Math.max(0, Math.min(100, Number(pct) || 0));

  if (barEl) {
    barEl.style.width = v + '%';
  }
  if (pctEl) {
    pctEl.textContent = v.toFixed(0) + '%';
  }
}

/**
 * เปิด/ปิดโหมด Fever (ให้การ์ดเรืองแสง)
 */
function setFeverActive(active) {
  if (!feverRoot) ensureFeverBar();
  if (!cardEl) return;

  if (active) {
    cardEl.classList.add('hha-fever-active');
  } else {
    cardEl.classList.remove('hha-fever-active');
  }
}

/**
 * อัปเดตจำนวน Shield ใต้ Fever
 */
function setShield(count) {
  if (!feverRoot) ensureFeverBar();
  if (!shieldEl) return;

  const n = Math.max(0, Number(count) || 0);
  shieldEl.textContent = n.toString();
}

// ----- export แบบ ES module -----
export { ensureFeverBar, setFever, setFeverActive, setShield };

// ----- ผูกให้ GameEngine แบบ global ด้วย -----
const FeverUI = { ensureFeverBar, setFever, setFeverActive, setShield };

if (!window.GAME_MODULES) window.GAME_MODULES = {};
window.GAME_MODULES.FeverUI = FeverUI;
window.FeverUI = FeverUI;
