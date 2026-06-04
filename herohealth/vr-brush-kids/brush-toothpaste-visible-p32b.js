// === /herohealth/vr-brush-kids/brush-toothpaste-visible-p32b.js ===
// PATCH v20260604-P32B
// Purpose:
// - Make toothpaste visibly appear after tapping "บีบยาสีฟัน"
// - Add clear squeeze animation for children
// - Delay start slightly so kids can see toothpaste before gameplay

(function () {
  'use strict';

  const PATCH = 'BRUSH_TOOTHPASTE_VISIBLE_P32B';

  if (window.__BRUSH_TOOTHPASTE_VISIBLE_P32B__) return;
  window.__BRUSH_TOOTHPASTE_VISIBLE_P32B__ = true;

  const path = String(location.pathname || '');
  const isBrush =
    /\/herohealth\/vr-brush-kids\/brush\.html/i.test(path) ||
    /\/vr-brush-kids\/brush\.html/i.test(path);

  if (!isBrush) return;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function injectStyle() {
    if (document.getElementById('brushP32bVisiblePasteStyle')) return;

    const style = document.createElement('style');
    style.id = 'brushP32bVisiblePasteStyle';
    style.textContent = `
      .brush-p32-visual {
        overflow: hidden;
      }

      .brush-p32-paste-blob {
        position: absolute;
        left: 50%;
        top: 56px;
        width: 0;
        height: 0;
        transform: translateX(-50%) rotate(-10deg);
        border-radius: 999px 999px 14px 14px;
        background:
          radial-gradient(circle at 30% 30%, #ffffff 0 18%, transparent 19%),
          linear-gradient(180deg, #fff7ed 0%, #fde68a 28%, #f9a8d4 72%, #f472b6 100%);
        box-shadow:
          0 8px 16px rgba(244, 114, 182, .28),
          inset 0 3px 5px rgba(255,255,255,.8);
        opacity: 0;
        z-index: 6;
        pointer-events: none;
      }

      body.brush-p32-paste-on .brush-p32-paste-blob {
        animation: brushP32bPastePop 1.15s cubic-bezier(.2,1.4,.25,1) forwards;
      }

      @keyframes brushP32bPastePop {
        0% {
          width: 0;
          height: 0;
          opacity: 0;
          top: 58px;
        }
        22% {
          width: 42px;
          height: 18px;
          opacity: 1;
          top: 50px;
        }
        48% {
          width: 76px;
          height: 28px;
          opacity: 1;
          top: 44px;
        }
        100% {
          width: 92px;
          height: 34px;
          opacity: 1;
          top: 42px;
        }
      }

      .brush-p32-paste-label {
        position: absolute;
        left: 50%;
        top: 18px;
        transform: translateX(-50%);
        z-index: 7;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.92);
        color: #be185d;
        font-size: 15px;
        font-weight: 1000;
        box-shadow: 0 8px 18px rgba(15,23,42,.12);
        opacity: 0;
        pointer-events: none;
      }

      body.brush-p32-paste-on .brush-p32-paste-label {
        animation: brushP32bLabelPop 1.15s ease forwards;
      }

      @keyframes brushP32bLabelPop {
        0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(.92); }
        30% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.03); }
        100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }

      body.brush-p32-paste-on .brush-p32-brush {
        animation: brushP32bBrushSqueeze .72s ease-in-out;
      }

      @keyframes brushP32bBrushSqueeze {
        0%, 100% { transform: rotate(-14deg) translateX(0); }
        35% { transform: rotate(-14deg) translateX(14px); }
        65% { transform: rotate(-14deg) translateX(-5px); }
      }

      body.brush-p32-paste-on #brushP32PasteBtn {
        background: linear-gradient(180deg, #86efac, #22c55e) !important;
        color: #064e3b !important;
      }
    `;

    document.head.appendChild(style);
  }

  function addPasteElements() {
    const visual = document.querySelector('.brush-p32-visual');
    if (!visual) return;

    if (!document.getElementById('brushP32PasteBlob')) {
      const blob = document.createElement('div');
      blob.id = 'brushP32PasteBlob';
      blob.className = 'brush-p32-paste-blob';
      visual.appendChild(blob);
    }

    if (!document.getElementById('brushP32PasteLabel')) {
      const label = document.createElement('div');
      label.id = 'brushP32PasteLabel';
      label.className = 'brush-p32-paste-label';
      label.textContent = 'ยาสีฟันพร้อมแล้ว!';
      visual.appendChild(label);
    }
  }

  function enhancePasteButton() {
    const btn = document.getElementById('brushP32PasteBtn');
    if (!btn || btn.dataset.p32bEnhanced === '1') return;

    btn.dataset.p32bEnhanced = '1';

    btn.addEventListener('click', function () {
      addPasteElements();

      document.body.classList.add('brush-p32-paste-on');

      btn.textContent = '✅ ยาสีฟันพร้อมแล้ว!';
      btn.disabled = true;
      btn.style.opacity = '1';

      const skip = document.getElementById('brushP32SkipBtn');
      if (skip) {
        skip.textContent = 'กำลังเข้าเกม...';
        skip.disabled = true;
        skip.style.opacity = '.55';
      }

      try {
        window.dispatchEvent(new CustomEvent('hha:brush:paste-visible', {
          detail: { patch: PATCH }
        }));
      } catch (_) {}
    }, true);
  }

  function watchOverlay() {
    addPasteElements();
    enhancePasteButton();

    const mo = new MutationObserver(function () {
      addPasteElements();
      enhancePasteButton();
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(function () {
      try { mo.disconnect(); } catch (_) {}
    }, 15000);
  }

  ready(function () {
    injectStyle();
    watchOverlay();

    console.info('[' + PATCH + '] loaded');
  });
})();