// === /herohealth/vr/ui-fever.js ===
// Global Fever UI for Hero Health VR (non-module)
// 2025-12-06 — no "export", attached to window.GAME_MODULES.FeverUI

(function (root) {
  'use strict';

  const doc = root.document;

  function ensureBaseStyle() {
    if (doc.getElementById('hha-fever-style')) return;

    const css = `
    .hha-fever-wrap{
      position:fixed;
      left:50%;
      top:8px;
      transform:translateX(-50%);
      z-index:640;
      pointer-events:none;
      min-width:220px;
      max-width:340px;
      padding:6px 10px 8px;
      border-radius:999px;
      background:rgba(15,23,42,0.96);
      border:1px solid rgba(52,211,153,0.8);
      box-shadow:0 18px 40px rgba(15,23,42,0.7);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    .hha-fever-inner{
      display:flex;
      align-items:center;
      gap:8px;
    }
    .hha-fever-label{
      font-size:11px;
      letter-spacing:.16em;
      text-transform:uppercase;
      color:#6ee7b7;
      font-weight:600;
      white-space:nowrap;
    }
    .hha-fever-bar{
      position:relative;
      flex:1;
      height:8px;
      border-radius:999px;
      background:rgba(15,23,42,0.9);
      overflow:hidden;
    }
    .hha-fever-fill{
      position:absolute;
      left:0;top:0;bottom:0;
      width:0%;
      border-radius:999px;
      background:linear-gradient(90deg,#22c55e,#a3e635,#facc15);
      transition:width .18s ease-out, filter .18s ease-out;
    }
    .hha-fever-shield{
      position:absolute;
      left:0;top:0;bottom:0;
      width:0%;
      border-radius:999px;
      background:linear-gradient(90deg,rgba(59,130,246,0.7),rgba(56,189,248,0.9));
      mix-blend-mode:screen;
      opacity:.85;
      pointer-events:none;
      transition:width .18s ease-out;
    }
    .hha-fever-wrap.is-active .hha-fever-fill{
      filter:drop-shadow(0 0 8px rgba(250,204,21,0.9));
    }
    .hha-fever-wrap.is-active .hha-fever-label::after{
      content:"• FEVER!";
      margin-left:6px;
      color:#fde68a;
    }
    @media (max-width:640px){
      .hha-fever-wrap{
        top:6px;
        padding:4px 8px 6px;
      }
      .hha-fever-label{
        font-size:10px;
        letter-spacing:.12em;
      }
    }
    `;

    const style = doc.createElement('style');
    style.id = 'hha-fever-style';
    style.textContent = css;
    doc.head.appendChild(style);
  }

  let feverWrap  = null;
  let feverFill  = null;
  let shieldFill = null;

  function ensureFeverBar() {
    ensureBaseStyle();

    if (feverWrap && feverFill && shieldFill) return;

    feverWrap = doc.querySelector('.hha-fever-wrap');
    if (!feverWrap) {
      feverWrap = doc.createElement('div');
      feverWrap.className = 'hha-fever-wrap';

      const inner = doc.createElement('div');
      inner.className = 'hha-fever-inner';

      const label = doc.createElement('div');
      label.className = 'hha-fever-label';
      label.textContent = 'FEVER GAUGE';

      const bar = doc.createElement('div');
      bar.className = 'hha-fever-bar';

      feverFill = doc.createElement('div');
      feverFill.className = 'hha-fever-fill';

      shieldFill = doc.createElement('div');
      shieldFill.className = 'hha-fever-shield';

      bar.appendChild(feverFill);
      bar.appendChild(shieldFill);
      inner.appendChild(label);
      inner.appendChild(bar);
      feverWrap.appendChild(inner);

      doc.body.appendChild(feverWrap);
    } else {
      const bar = feverWrap.querySelector('.hha-fever-bar') ||
                  (function () {
                    const b = doc.createElement('div');
                    b.className = 'hha-fever-bar';
                    feverWrap.appendChild(b);
                    return b;
                  })();

      feverFill = feverWrap.querySelector('.hha-fever-fill');
      if (!feverFill) {
        feverFill = doc.createElement('div');
        feverFill.className = 'hha-fever-fill';
        bar.appendChild(feverFill);
      }

      shieldFill = feverWrap.querySelector('.hha-fever-shield');
      if (!shieldFill) {
        shieldFill = doc.createElement('div');
        shieldFill.className = 'hha-fever-shield';
        bar.appendChild(shieldFill);
      }
    }
  }

  function setFever(percent) {
    ensureFeverBar();
    if (!feverFill) return;
    let p = Number(percent) || 0;
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    feverFill.style.width = p + '%';
  }

  function setFeverActive(active) {
    ensureFeverBar();
    if (!feverWrap) return;
    if (active) feverWrap.classList.add('is-active');
    else        feverWrap.classList.remove('is-active');
  }

  // shieldValue: 0–1
  function setShield(value) {
    ensureFeverBar();
    if (!shieldFill) return;
    let v = Number(value) || 0;
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    shieldFill.style.width = (v * 100) + '%';
  }

  const FeverUI = {
    ensureFeverBar,
    setFever,
    setFeverActive,
    setShield
  };

  // ผูกเข้า global
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.FeverUI = FeverUI;
  root.FeverUI = FeverUI;

})(window);
