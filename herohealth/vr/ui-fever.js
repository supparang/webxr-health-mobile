// === /herohealth/vr/ui-fever.js ===
// Shared Fever Gauge + Shield HUD (bottom-left)
// ใช้ร่วมทุกโหมด: GoodJunk / Groups / Hydration

'use strict';

(function (global) {
  const NS = global.GAME_MODULES = global.GAME_MODULES || {};

  let root = null;
  let barEl = null;
  let pctEl = null;
  let shieldEl = null;

  // ---------- style ใส่ครั้งเดียว ----------
  function ensureStyle() {
    if (document.getElementById('hha-fever-style')) return;
    const st = document.createElement('style');
    st.id = 'hha-fever-style';
    st.textContent = `
      .hha-fever-wrap{
        position:fixed;
        left:10px;
        bottom:12px;
        z-index:900;
        pointer-events:none;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      .hha-fever-card{
        background:rgba(15,23,42,.96);
        border-radius:18px;
        border:1px solid rgba(250,204,21,.55);
        box-shadow:0 16px 40px rgba(15,23,42,.8);
        padding:8px 10px 9px;
        min-width:190px;
        max-width:260px;
      }
      .hha-fever-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }
      .hha-fever-top{
        margin-bottom:4px;
      }
      .hha-fever-icon{
        font-size:18px;
      }
      .hha-fever-label{
        font-size:11px;
        letter-spacing:.16em;
        text-transform:uppercase;
        color:#e5e7eb;
        flex:1;
      }
      .hha-fever-pct{
        font-size:12px;
        font-weight:700;
        color:#facc15;
        min-width:38px;
        text-align:right;
      }
      .hha-fever-bar{
        position:relative;
        width:100%;
        height:5px;
        border-radius:999px;
        background:rgba(30,64,175,.7);
        overflow:hidden;
        margin-bottom:4px;
      }
      .hha-fever-bar-fill{
        position:absolute;
        inset:0;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#22c55e,#f97316,#facc15);
        transition:width .18s ease-out;
      }
      .hha-fever-bottom{
        font-size:11px;
      }
      .hha-fever-tag{
        padding:2px 8px;
        border-radius:999px;
        border:1px solid rgba(34,197,94,.7);
        background:rgba(22,163,74,.15);
        color:#bbf7d0;
        font-weight:600;
        text-transform:uppercase;
        letter-spacing:.12em;
      }
      .hha-fever-shield{
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-left:auto;
        color:#e5e7eb;
      }
      .hha-fever-shield span{
        font-size:12px;
        font-weight:600;
      }
      .hha-fever-card.is-active{
        box-shadow:0 0 0 1px rgba(251,191,36,.6),
                   0 18px 45px rgba(251,191,36,.55);
      }
    `;
    document.head.appendChild(st);
  }

  // ---------- สร้าง / reuse fever card ----------
  function ensureFeverBar() {
    ensureStyle();

    if (root && document.body.contains(root)) return root;

    // ถ้ามีอยู่แล้ว (จากหน้าอื่น) ให้ reuse ไม่สร้างซ้ำ
    root = document.getElementById('hha-fever-wrap');
    if (!root) {
      root = document.createElement('div');
      root.id = 'hha-fever-wrap';
      root.className = 'hha-fever-wrap';
      root.innerHTML = `
        <div class="hha-fever-card" id="hha-fever-card">
          <div class="hha-fever-row hha-fever-top">
            <span class="hha-fever-icon">🔥</span>
            <span class="hha-fever-label">FEVER GAUGE</span>
            <span class="hha-fever-pct" id="hha-fever-pct">0%</span>
          </div>
          <div class="hha-fever-bar">
            <div class="hha-fever-bar-fill" id="hha-fever-bar"></div>
          </div>
          <div class="hha-fever-row hha-fever-bottom">
            <span class="hha-fever-tag">FEVER</span>
            <span class="hha-fever-shield">
              🛡️ <span id="hha-fever-shield">x0</span>
            </span>
          </div>
        </div>
      `;
      document.body.appendChild(root);
    }

    barEl    = root.querySelector('#hha-fever-bar');
    pctEl    = root.querySelector('#hha-fever-pct');
    shieldEl = root.querySelector('#hha-fever-shield');
    return root;
  }

  // ---------- อัปเดตค่า ----------
  function setFever(val) {
    ensureFeverBar();
    const v = Math.max(0, Math.min(100, val | 0));
    if (barEl)  barEl.style.width = v + '%';
    if (pctEl)  pctEl.textContent = v + '%';
  }

  function setFeverActive(active) {
    ensureFeverBar();
    const card = document.getElementById('hha-fever-card');
    if (!card) return;
    if (active) card.classList.add('is-active');
    else card.classList.remove('is-active');
  }

  function setShield(count) {
    ensureFeverBar();
    const n = Math.max(0, count | 0);
    if (shieldEl) shieldEl.textContent = 'x' + n;
  }

  // export
  NS.FeverUI = {
    ensureFeverBar,
    setFever,
    setFeverActive,
    setShield
  };
})(window);
