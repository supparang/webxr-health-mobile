// === /herohealth/vr/ui-fever.js ===
// Fever gauge + Shield (ล่างซ้าย) ใช้ร่วม GoodJunk / Groups / Hydration
// สร้าง UI แบบ global FeverUI ให้ GameEngine เรียกใช้

'use strict';

(function (global) {
  let feverRoot = null;
  let barEl = null;
  let pctEl = null;
  let stateEl = null;
  let shieldWrapEl = null;
  let shieldCountEl = null;

  function ensureStyle() {
    if (document.getElementById('hha-fever-style')) return;
    const st = document.createElement('style');
    st.id = 'hha-fever-style';
    st.textContent = `
      .hha-fever-wrap{
        position:fixed;
        left:10px;
        bottom:10px;
        z-index:640;
        pointer-events:none;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
      }
      .hha-fever-card{
        pointer-events:auto;
        background:radial-gradient(circle at top left,rgba(56,189,248,.18),transparent 55%),
                   rgba(15,23,42,.96);
        border-radius:14px;
        padding:6px 10px 8px;
        border:1px solid rgba(148,163,184,.45);
        box-shadow:0 14px 30px rgba(15,23,42,.8);
        min-width:160px;
        max-width:220px;
      }
      .hha-fever-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:6px;
        margin-bottom:4px;
      }
      .hha-fever-icon{
        font-size:16px;
      }
      .hha-fever-label{
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.12em;
        color:#9ca3af;
      }
      .hha-fever-pct{
        font-size:13px;
        font-weight:700;
        color:#facc15;
      }
      .hha-fever-bar{
        position:relative;
        width:100%;
        height:6px;
        border-radius:999px;
        background:rgba(15,23,42,.9);
        overflow:hidden;
        margin-bottom:4px;
      }
      .hha-fever-bar-fill{
        position:absolute;
        inset:0;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#facc15);
        transition:width .15s ease-out;
      }
      .hha-fever-meta{
        display:flex;
        align-items:center;
        justify-content:space-between;
        font-size:11px;
        color:#9ca3af;
      }
      .hha-fever-state{
        font-size:11px;
      }
      .hha-fever-shield{
        display:inline-flex;
        align-items:center;
        gap:4px;
        opacity:.4;
      }
      .hha-fever-shield-icon{
        font-size:16px;
      }
      .hha-fever-shield-count{
        font-size:11px;
        font-weight:600;
      }

      /* เวลา Fever active ให้เรืองแสงมากขึ้น */
      .hha-fever-wrap.hha-fever-active .hha-fever-card{
        border-color:rgba(250,204,21,.85);
        box-shadow:0 0 0 1px rgba(250,204,21,.45),
                   0 18px 42px rgba(234,179,8,.9);
      }
    `;
    document.head.appendChild(st);
  }

  // สร้าง Fever bar ล่างซ้าย
  function ensureFeverBar() {
    if (feverRoot) return feverRoot;
    ensureStyle();

    feverRoot = document.createElement('div');
    feverRoot.id = 'hha-fever-wrap';
    feverRoot.className = 'hha-fever-wrap';
    feverRoot.setAttribute('data-hha-ui','');

    feverRoot.innerHTML = `
      <div class="hha-fever-card">
        <div class="hha-fever-row">
          <span class="hha-fever-icon">🔥</span>
          <span class="hha-fever-label">Fever gauge</span>
          <span class="hha-fever-pct" id="hha-fever-pct">0%</span>
        </div>
        <div class="hha-fever-bar">
          <div class="hha-fever-bar-fill" id="hha-fever-bar"></div>
        </div>
        <div class="hha-fever-meta">
          <span class="hha-fever-state" id="hha-fever-state">Normal</span>
          <span class="hha-fever-shield" id="hha-fever-shield-wrap">
            <span class="hha-fever-shield-icon">🛡️</span>
            <span class="hha-fever-shield-count" id="hha-fever-shield-count">x0</span>
          </span>
        </div>
      </div>
    `;

    document.body.appendChild(feverRoot);

    barEl        = feverRoot.querySelector('#hha-fever-bar');
    pctEl        = feverRoot.querySelector('#hha-fever-pct');
    stateEl      = feverRoot.querySelector('#hha-fever-state');
    shieldWrapEl = feverRoot.querySelector('#hha-fever-shield-wrap');
    shieldCountEl= feverRoot.querySelector('#hha-fever-shield-count');

    return feverRoot;
  }

  // อัปเดตค่า Fever (0–100)
  function setFever(value) {
    ensureFeverBar();
    let v = Number(value) || 0;
    if (v < 0) v = 0;
    if (v > 100) v = 100;

    if (barEl) {
      barEl.style.width = v + '%';
    }
    if (pctEl) {
      pctEl.textContent = v + '%';
    }
    if (stateEl) {
      if (v <= 0) stateEl.textContent = 'Normal';
      else if (v < 80) stateEl.textContent = 'Charge';
      else stateEl.textContent = 'Ready';
    }
  }

  // เปิด/ปิดสถานะ Fever active
  function setFeverActive(active) {
    ensureFeverBar();
    const on = !!active;
    if (!feverRoot) return;
    if (on) {
      feverRoot.classList.add('hha-fever-active');
      if (stateEl) stateEl.textContent = 'FEVER!!';
    } else {
      feverRoot.classList.remove('hha-fever-active');
      if (stateEl) {
        // ไม่เปลี่ยน state ถ้า FeverUI.setFever เพิ่งอัปเดต
        if (pctEl && pctEl.textContent === '0%') stateEl.textContent = 'Normal';
      }
    }
  }

  // อัปเดตจำนวน Shield (0–3) แสดงข้าง Fever gauge
  function setShield(count) {
    ensureFeverBar();
    let c = Number(count) || 0;
    if (c < 0) c = 0;
    if (c > 3) c = 3;

    if (shieldCountEl) {
      shieldCountEl.textContent = 'x' + c;
    }
    if (shieldWrapEl) {
      shieldWrapEl.style.opacity = c > 0 ? '1' : '0.4';
    }
  }

  // expose เป็น FeverUI global
  const FeverUI = {
    ensureFeverBar,
    setFever,
    setFeverActive,
    setShield
  };

  global.GAME_MODULES = global.GAME_MODULES || {};
  global.GAME_MODULES.FeverUI = FeverUI;
  global.FeverUI = FeverUI;

})(window);
