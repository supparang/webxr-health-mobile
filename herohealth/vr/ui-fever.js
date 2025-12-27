// === /herohealth/vr/ui-fever.js ===
// Fever UI (IIFE) — provides window.FeverUI { setFever, setShield }

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function $(id){ return doc.getElementById(id); }

  function ensure(){
    // If fever elements exist, OK
    if ($('feverBar') && $('feverText') && $('shieldPills')) return;

    // Create minimal fallback if missing
    let wrap = $('hhaFever');
    if (!wrap){
      wrap = doc.createElement('div');
      wrap.id = 'hhaFever';
      wrap.className = 'hha-fever';
      wrap.innerHTML = `
        <div class="fever-row">
          <div class="fever-label">FEVER</div>
          <div class="fever-bar"><div class="fever-fill" id="feverBar"></div></div>
          <div class="fever-text" id="feverText">0%</div>
        </div>
        <div class="shield-row">
          <div class="shield-label">SHIELD</div>
          <div class="shield-pills" id="shieldPills"></div>
        </div>`;
      doc.body.appendChild(wrap);
    }
  }

  function setFever(v){
    ensure();
    v = Math.max(0, Math.min(100, Number(v)||0));
    const bar = $('feverBar');
    const txt = $('feverText');
    if (bar) bar.style.width = `${v.toFixed(0)}%`;
    if (txt) txt.textContent = `${v.toFixed(0)}%`;
  }

  function setShield(sec){
    ensure();
    sec = Math.max(0, Number(sec)||0);
    const pills = $('shieldPills');
    if (!pills) return;

    const n = Math.max(0, Math.min(10, Math.ceil(sec)));
    const old = pills.querySelectorAll('.shield-pill').length;

    if (old !== 10){
      pills.innerHTML = '';
      for (let i=0;i<10;i++){
        const p = doc.createElement('div');
        p.className = 'shield-pill';
        pills.appendChild(p);
      }
    }
    const all = pills.querySelectorAll('.shield-pill');
    all.forEach((p,i) => p.classList.toggle('on', i < n));
  }

  const FeverUI = { setFever, setShield };
  root.FeverUI = FeverUI;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = FeverUI;

})(window);