// === /herohealth/vr/ui-fever.js ===
// FEVER Gauge + Shield (Quest-ready)
// ✅ Provides: ensureFeverBar(), setFever(), setFeverActive(), setShield()
// ✅ Also keeps legacy API: add/reset/isActive/getValue

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const FEVER_MAX = 100;

  let fever = 0;
  let active = false;
  let shield = 0;

  function clamp(v){ v = Number(v) || 0; return Math.max(0, Math.min(FEVER_MAX, v)); }

  function findFeverFill(){
    return (
      doc.getElementById('hha-fever-fill') ||
      doc.getElementById('fever-fill') ||
      doc.querySelector('.hha-fever-bar-inner') ||
      doc.querySelector('.fever-bar-fill') ||
      null
    );
  }

  function findFeverPct(){
    return doc.getElementById('hha-fever-percent') || doc.getElementById('fever-percent') || null;
  }

  function findShieldEl(){
    return doc.getElementById('hha-shield-count') || doc.getElementById('shield-count') || null;
  }

  function render(){
    const bar = findFeverFill();
    if (bar) bar.style.width = clamp(fever) + '%';

    const pct = findFeverPct();
    if (pct) pct.textContent = clamp(fever).toFixed(0) + '%';

    const sh = findShieldEl();
    if (sh) sh.textContent = String(shield | 0);

    // (optional) ส่งสถานะให้ HUD อื่น ๆ ฟังได้
    try{
      root.dispatchEvent(new CustomEvent('hha:fever', { detail:{ state: active ? 'start' : 'change', value: fever, active, shield } }));
    }catch{}
  }

  function ensureFeverBar(){
    // แค่ “เช็คว่ามี element” + render หนึ่งที
    render();
    return findFeverFill();
  }

  function setFever(v){
    fever = clamp(v);
    render();
  }

  function setFeverActive(on){
    active = !!on;
    render();
  }

  function setShield(n){
    shield = Math.max(0, Math.min(9, (n|0)));
    render();
  }

  // ===== Public API =====
  root.FeverUI = {
    // ✅ new API (hydration.safe.js ใช้)
    ensureFeverBar,
    setFever,
    setFeverActive,
    setShield,

    // legacy API (กันพังเกมเก่า)
    add(v){
      if (active) return;
      fever = clamp(fever + (Number(v)||0));
      if (fever >= FEVER_MAX) { active = true; fever = FEVER_MAX; }
      render();
    },
    reset(){
      fever = 0; active = false; shield = 0;
      render();
    },
    isActive(){ return !!active; },
    getValue(){ return clamp(fever); },
    getShield(){ return shield|0; }
  };

  // ✅ also expose into GAME_MODULES (hydration.safe.js ใช้ได้ทั้ง 2 แบบ)
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = root.FeverUI;

})(window);
