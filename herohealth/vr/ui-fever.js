// === /herohealth/vr/ui-fever.js ===
// Shared Fever gauge + Shield + Fire Overlay (GoodJunk / Hydration / Groups)
// 2025-12-06 — non-module (ไม่มี export, ใช้ window.GAME_MODULES.FeverUI)

'use strict';

(function (global) {
  let feverRoot   = null;
  let barEl       = null;
  let pctEl       = null;
  let shieldEl    = null;
  let cardEl      = null;
  let flamesEl    = null;
  let styleInjected = false;

  // ----- inject CSS ครั้งเดียว -----
  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;

    const css = global.document.createElement('style');
    css.id = 'hha-fever-style';
    css.textContent = `
      .hha-fever-wrap{
        position:fixed;
        left:10px;
        bottom:12px;
        z-index:900;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
      }
      .hha-fever-card{
        min-width:210px;
        max-width:260px;
        padding:8px 10px 6px;
        border-radius:999px;
        background:linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.90));
        border:1px solid rgba(148,163,184,0.35);
        box-shadow:0 14px 30px rgba(15,23,42,0.85);
        color:#e5e7eb;
        backdrop-filter:blur(8px);
      }
      .hha-fever-row-main{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-bottom:4px;
        font-size:11px;
      }
      .hha-fever-left{
        display:flex;
        align-items:center;
        gap:6px;
      }
      .hha-fever-icon{
        font-size:16px;
        line-height:1;
      }
      .hha-fever-label{
        letter-spacing:.14em;
        text-transform:uppercase;
        color:#cbd5f5;
        font-weight:600;
        font-size:10px;
      }
      .hha-fever-right{
        display:flex;
        align-items:center;
        gap:6px;
      }
      .hha-fever-pct{
        font-weight:700;
        font-size:11px;
        color:#facc15;
        min-width:32px;
        text-align:right;
      }
      .hha-fever-shield{
        display:inline-flex;
        align-items:center;
        gap:3px;
        padding:1px 6px;
        border-radius:999px;
        background:rgba(15,23,42,0.9);
        border:1px solid rgba(59,130,246,0.7);
        font-size:10px;
        color:#bfdbfe;
      }
      .hha-fever-shield-icon{
        font-size:13px;
        line-height:1;
      }
      .hha-fever-bar{
        position:relative;
        width:100%;
        height:4px;
        border-radius:999px;
        background:rgba(30,64,175,0.7);
        overflow:hidden;
      }
      .hha-fever-bar-fill{
        position:absolute;
        inset:0;
        width:0%;
        border-radius:inherit;
        background:linear-gradient(90deg,#22c55e,#f97316,#ef4444);
        transition:width .20s ease-out;
      }
      .hha-fever-active{
        border-color:rgba(251,191,36,0.9);
        box-shadow:0 0 0 1px rgba(251,191,36,0.6),
                   0 18px 40px rgba(248,250,252,0.15);
      }

      /* ไฟลุกท่วมจอตอน fever */
      .hha-fever-flames{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:640; /* ใต้ HUD แต่เหนือฉาก */
        opacity:0;
        transition:opacity .35s ease-out;
        background:
          radial-gradient(circle at 50% 120%, rgba(0,0,0,0.0), rgba(0,0,0,0.65) 70%),
          radial-gradient(circle at 20% 0%, rgba(251,191,36,0.6), transparent 55%),
          radial-gradient(circle at 80% 10%, rgba(248,113,113,0.55), transparent 60%);
        mix-blend-mode:screen;
      }
      .hha-fever-flames::before{
        content:'';
        position:absolute;
        inset:10% 5% 20%;
        background:
          radial-gradient(circle at 30% 80%, rgba(248,250,252,0.3), transparent 55%),
          radial-gradient(circle at 70% 40%, rgba(254,202,202,0.4), transparent 60%);
        opacity:.9;
        animation:hhaFlameWave 1.4s infinite alternate ease-out;
      }
      .hha-fever-flames.on{
        opacity:0.65;
      }
      @keyframes hhaFlameWave{
        0%  { transform:translate3d(0,6px,0) scale(1.02); }
        50% { transform:translate3d(0,-4px,0) scale(1.06); }
        100%{ transform:translate3d(0,4px,0) scale(1.08); }
      }
    `;
    global.document.head.appendChild(css);
  }

  /**
   * สร้าง Fever bar + flames overlay
   * ใช้ร่วมกันทุกเกม (GoodJunk / Hydration / Groups)
   */
  function ensureFeverBar() {
    if (feverRoot) return feverRoot;

    ensureStyle();

    const doc = global.document;

    // การ์ด Fever มุมล่างซ้าย
    feverRoot = doc.createElement('div');
    feverRoot.id = 'hha-fever-wrap';
    feverRoot.className = 'hha-fever-wrap';
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
    doc.body.appendChild(feverRoot);

    cardEl   = feverRoot.querySelector('.hha-fever-card');
    barEl    = feverRoot.querySelector('#hha-fever-bar');
    pctEl    = feverRoot.querySelector('#hha-fever-pct');
    shieldEl = feverRoot.querySelector('#hha-fever-shield');

    // overlay ไฟลุกทั้งจอ (สร้างแยก)
    if (!flamesEl) {
      flamesEl = doc.createElement('div');
      flamesEl.id = 'hha-fever-flames';
      flamesEl.className = 'hha-fever-flames';
      doc.body.appendChild(flamesEl);
    }

    return feverRoot;
  }

  /**
   * อัปเดตค่าความร้อนของ Fever (0–100)
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
   * เปิด/ปิดโหมด Fever
   * - การ์ด Glow
   * - ไฟลุกท่วมจอ (overlay)
   */
  function setFeverActive(active) {
    if (!feverRoot) ensureFeverBar();
    if (cardEl) {
      cardEl.classList.toggle('hha-fever-active', !!active);
    }
    if (flamesEl) {
      flamesEl.classList.toggle('on', !!active);
    }
  }

  /**
   * อัปเดตจำนวน Shield (จำนวนเกราะ)
   * ทุกเกมเรียกได้เหมือนกัน
   */
  function setShield(count) {
    if (!feverRoot) ensureFeverBar();
    if (!shieldEl) return;
    const n = Math.max(0, Number(count) || 0);
    shieldEl.textContent = n.toString();
  }

  // ----- ผูกเข้า global ให้ GameEngine เรียกใช้ผ่าน FeverUI -----
  const FeverUI = { ensureFeverBar, setFever, setFeverActive, setShield };

  global.GAME_MODULES = global.GAME_MODULES || {};
  global.GAME_MODULES.FeverUI = FeverUI;
  global.FeverUI = FeverUI;

})(window);
