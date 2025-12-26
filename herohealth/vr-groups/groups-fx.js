// === /herohealth/vr-groups/groups-fx.js ===
// Groups FX — score pop + burst + afterimage trail (PRODUCTION)
// Emits are optional; Engine can call window.GroupsFX.scorePop / burstAt / trailAt

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const FX = (root.GroupsFX = root.GroupsFX || {});

  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: 50
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  function makeDiv(cls, styleObj) {
    const el = doc.createElement('div');
    el.className = cls;
    if (styleObj) Object.assign(el.style, styleObj);
    return el;
  }

  function rmLater(el, ms) {
    setTimeout(() => { try { el.remove(); } catch (_) {} }, ms || 700);
  }

  FX.scorePop = function scorePop(x, y, text, kind) {
    const layer = ensureLayer();
    const el = makeDiv('fx-pop ' + (kind || ''));
    el.textContent = String(text || '');
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    layer.appendChild(el);
    rmLater(el, 900);
  };

  FX.burstAt = function burstAt(x, y, kind) {
    const layer = ensureLayer();
    const el = makeDiv('fx-burst ' + (kind || ''));
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    layer.appendChild(el);

    // 10 shards
    for (let i=0;i<10;i++){
      const s = makeDiv('fx-shard ' + (kind || ''));
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random()*22;
      s.style.setProperty('--dx', (Math.cos(a)*r).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(a)*r).toFixed(1) + 'px');
      el.appendChild(s);
    }
    rmLater(el, 650);
  };

  // afterimage trail (lightweight) – Engine calls with emoji + rect center
  FX.trailAt = function trailAt(x, y, emoji, kind, scale) {
    const layer = ensureLayer();
    const el = makeDiv('fx-trail ' + (kind || ''));
    el.textContent = emoji || '';
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    el.style.transform = `translate(-50%,-50%) scale(${Number(scale)||1})`;
    layer.appendChild(el);
    rmLater(el, 420);
  };

})(window);