// === /herohealth/vr/ui-fever.js ===
// Global Fever UI (SAFE)
// Provides window.FeverUI + window.GAME_MODULES.FeverUI
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const S = { value:0, shield:0 };

  function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function ensurePills(n=9){
    const box = doc.getElementById('shieldPills');
    if (!box) return null;
    if (box._built) return box;
    box._built = true;
    box.innerHTML = '';
    for (let i=0;i<n;i++){
      const p = doc.createElement('div');
      p.className = 'pill';
      box.appendChild(p);
    }
    return box;
  }

  function render(){
    const bar = doc.getElementById('feverBar');
    const txt = doc.getElementById('feverText');
    if (bar) bar.style.width = clamp(S.value,0,100).toFixed(0) + '%';
    if (txt) txt.textContent = clamp(S.value,0,100).toFixed(0) + '%';

    const pills = ensurePills(9);
    if (pills){
      const kids = pills.children;
      for (let i=0;i<kids.length;i++){
        if (i < S.shield) kids[i].classList.add('on');
        else kids[i].classList.remove('on');
      }
    }
  }

  function set(payload){
    payload = payload || {};
    if (payload.value !== undefined) S.value = clamp(payload.value,0,100);
    if (payload.shield !== undefined) S.shield = clamp(payload.shield,0,9);
    render();
  }

  function setShield(v){
    S.shield = clamp(v,0,9);
    render();
  }

  function get(){
    return { value:S.value, shield:S.shield };
  }

  const api = { set, setShield, get };
  root.FeverUI = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = api;

  // init
  render();
})(typeof window !== 'undefined' ? window : globalThis);