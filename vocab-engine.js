export function installVocabGuards(options = {}) {
  const engineName = options.engineName || 'engine.js';
  const isEditable = (target) => {
    if (!target) return false;
    const tag = (target.tagName || '').toUpperCase();
    return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  const blockEvent = (ev) => {
    if (isEditable(ev.target)) return;
    ev.preventDefault();
    ev.stopPropagation();
  };

  document.addEventListener('contextmenu', blockEvent, { capture: true });
  document.addEventListener('dragstart', blockEvent, { capture: true });
  document.addEventListener('copy', blockEvent, { capture: true });
  document.addEventListener('cut', blockEvent, { capture: true });
  document.addEventListener('selectstart', (ev) => {
    if (isEditable(ev.target)) return;
    ev.preventDefault();
  }, { capture: true });

  document.addEventListener('keydown', (ev) => {
    const key = String(ev.key || '').toLowerCase();
    const ctrl = ev.ctrlKey || ev.metaKey;
    const shift = ev.shiftKey;

    if (key === 'f12') return blockEvent(ev);
    if (ctrl && ['u', 's', 'p'].includes(key)) return blockEvent(ev);
    if (ctrl && shift && ['i', 'j', 'c'].includes(key)) return blockEvent(ev);
    if (ctrl && key === 'c' && !isEditable(ev.target)) return blockEvent(ev);
  }, { capture: true });

  // Lightweight tamper friction only. Client-side code cannot be fully protected.
  Object.defineProperty(window, '__VOCAB_ENGINE_LOCK__', {
    value: Object.freeze({
      engineName,
      loadedAt: Date.now(),
      note: 'Client-side protection is deterrence only.'
    }),
    configurable: false,
    enumerable: false,
    writable: false
  });

  try {
    const style = document.createElement('style');
    style.textContent = `
      body:not(.allow-select), body:not(.allow-select) *:not(input):not(textarea):not(select) {
        -webkit-user-select: none;
        user-select: none;
      }
      html[data-vocab-protected="1"] {
        -webkit-touch-callout: none;
      }
    `;
    document.head.appendChild(style);
  } catch (_) {}

  document.documentElement.setAttribute('data-vocab-protected', '1');
}