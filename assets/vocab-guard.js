export function installVocabGuards(options = {}) {
  const engineName = options.engineName || 'engine.js';
  const strict = options.strict !== false;
  const muteConsole = options.muteConsole !== false;
  const doc = document;
  const win = window;

  const isEditable = (target) => {
    if (!target) return false;
    const tag = String(target.tagName || '').toUpperCase();
    return !!target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  const blockEvent = (ev) => {
    if (isEditable(ev.target)) return;
    try { ev.preventDefault(); } catch (_) {}
    try { ev.stopPropagation(); } catch (_) {}
    try { ev.stopImmediatePropagation?.(); } catch (_) {}
  };

  const blockedKeys = new Set(['f12']);
  const blockedCtrl = new Set(['u','s','p']);
  const blockedCtrlShift = new Set(['i','j','c','k']);

  doc.addEventListener('contextmenu', blockEvent, { capture: true });
  doc.addEventListener('dragstart', blockEvent, { capture: true });
  doc.addEventListener('copy', blockEvent, { capture: true });
  doc.addEventListener('cut', blockEvent, { capture: true });
  doc.addEventListener('selectstart', (ev) => {
    if (isEditable(ev.target)) return;
    ev.preventDefault();
  }, { capture: true });

  doc.addEventListener('keydown', (ev) => {
    const key = String(ev.key || '').toLowerCase();
    const ctrl = ev.ctrlKey || ev.metaKey;
    const shift = ev.shiftKey;

    if (blockedKeys.has(key)) return blockEvent(ev);
    if (ctrl && blockedCtrl.has(key)) return blockEvent(ev);
    if (ctrl && shift && blockedCtrlShift.has(key)) return blockEvent(ev);
    if (ctrl && key === 'c' && !isEditable(ev.target)) return blockEvent(ev);
  }, { capture: true });

  if (muteConsole) {
    try {
      const noop = () => {};
      ['log','debug','dir','dirxml','table','trace','group','groupCollapsed','groupEnd','info'].forEach((name) => {
        try { console[name] = noop; } catch (_) {}
      });
    } catch (_) {}
  }

  const styleId = 'vocab-guard-style';
  const installStyle = () => {
    if (doc.getElementById(styleId)) return;
    const style = doc.createElement('style');
    style.id = styleId;
    style.textContent = `
      html[data-vocab-protected="1"] {
        -webkit-touch-callout: none;
      }
      body:not(.allow-select), body:not(.allow-select) *:not(input):not(textarea):not(select) {
        -webkit-user-select: none;
        user-select: none;
      }
      #vocab-devtools-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        text-align: center;
        background: rgba(2, 6, 23, 0.94);
        color: #fff;
        font: 800 18px/1.5 Inter, system-ui, sans-serif;
      }
      html[data-vocab-tampered="1"] #vocab-devtools-overlay { display: flex; }
      html[data-vocab-tampered="1"] #app {
        filter: blur(10px) grayscale(1);
        pointer-events: none;
      }
    `;
    doc.head.appendChild(style);
  };
  installStyle();

  const ensureOverlay = () => {
    let overlay = doc.getElementById('vocab-devtools-overlay');
    if (!overlay) {
      overlay = doc.createElement('div');
      overlay.id = 'vocab-devtools-overlay';
      overlay.textContent = 'Protected mode: ปิดเครื่องมือ inspect / devtools เพื่อใช้งานต่อ';
      doc.body.appendChild(overlay);
    }
    return overlay;
  };

  const flagTamper = (reason = 'tamper') => {
    if (doc.documentElement.getAttribute('data-vocab-tampered') === '1') return;
    doc.documentElement.setAttribute('data-vocab-tampered', '1');
    ensureOverlay().setAttribute('data-reason', reason);
    try {
      win.__VOCAB_ENGINE_LOCK__.tamperedAt = Date.now();
      win.__VOCAB_ENGINE_LOCK__.tamperReason = reason;
    } catch (_) {}
  };

  if (strict) {
    let devtoolsHits = 0;
    const checkDevtools = () => {
      if (doc.hidden) return;
      const widthGap = Math.abs((win.outerWidth || 0) - (win.innerWidth || 0));
      const heightGap = Math.abs((win.outerHeight || 0) - (win.innerHeight || 0));
      const suspicious = widthGap > 180 || heightGap > 180;
      devtoolsHits = suspicious ? devtoolsHits + 1 : 0;
      if (devtoolsHits >= 2) flagTamper('devtools-size');
    };
    setInterval(checkDevtools, 1200);

    let pauseHits = 0;
    setInterval(() => {
      if (doc.hidden) return;
      const started = performance.now();
      debugger;
      const drift = performance.now() - started;
      if (drift > 180) pauseHits += 1;
      else pauseHits = 0;
      if (pauseHits >= 2) flagTamper('debugger-pause');
    }, 2500);
  }

  try {
    const observer = new MutationObserver(() => {
      installStyle();
      ensureOverlay();
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  doc.documentElement.setAttribute('data-vocab-protected', '1');
  try {
    Object.defineProperty(win, '__VOCAB_ENGINE_LOCK__', {
      value: {
        engineName,
        loadedAt: Date.now(),
        strict,
        note: 'Client-side protection raises difficulty only.'
      },
      configurable: false,
      enumerable: false,
      writable: false
    });
  } catch (_) {}
}
