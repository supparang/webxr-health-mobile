// === /herohealth/vr/ui-fever.js ===
// Fever gauge + Shield (ใช้ร่วมกันทุกโหมด GoodJunk / Groups / Hydration)
// non-module version — ไม่มี export / import

(function (root) {
  'use strict';

  const doc = root.document;

  let feverRoot = null;
  let barEl     = null;
  let pctEl     = null;
  let shieldEl  = null;

  // สร้าง Fever bar มุมล่างซ้าย (mobile-first)
  function ensureFeverBar() {
    if (feverRoot) return feverRoot;

    feverRoot = doc.createElement('div');
    feverRoot.id = 'hha-fever-wrap';
    feverRoot.className = 'hha-fever-wrap';

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
        <div class="hha-fever-shield">
          <span>🛡️ Shield: </span>
          <span id="hha-fever-shield">0</span>
        </div>
      </div>
    `;

    // fallback เผื่อ CSS ยังไม่โหลด → ให้อยู่ "ล่างซ้าย" แน่นอน
    Object.assign(feverRoot.style, {
      position: 'fixed',
      left: '10px',
      bottom: '10px',
      zIndex: '40'
    });

    doc.body.appendChild(feverRoot);

    barEl    = feverRoot.querySelector('#hha-fever-bar');
    pctEl    = feverRoot.querySelector('#hha-fever-pct');
    shieldEl = feverRoot.querySelector('#hha-fever-shield');

    setFever(0);
    setShield(0);
    setFeverActive(false);

    return feverRoot;
  }

  function setFever(v) {
    if (!feverRoot) ensureFeverBar();
    const pct = Math.max(0, Math.min(100, Number(v) || 0));
    if (barEl) barEl.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  }

  function setFeverActive(active) {
    if (!feverRoot) ensureFeverBar();
    if (active) feverRoot.classList.add('hha-fever-active');
    else        feverRoot.classList.remove('hha-fever-active');
  }

  function setShield(n) {
    if (!feverRoot) ensureFeverBar();
    const val = Math.max(0, Math.min(3, Number(n) || 0));
    if (shieldEl) shieldEl.textContent = val;
  }

  const FeverUI = {
    ensureFeverBar,
    setFever,
    setFeverActive,
    setShield
  };

  // ให้โค้ดเก่าเรียกผ่าน window.HHA_Fever ได้
  root.HHA_Fever = FeverUI;

  // ให้ GameEngine.js ฝั่ง VR Groups เรียกผ่าน GAME_MODULES.FeverUI ได้
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = FeverUI;

})(window);
