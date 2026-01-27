// === /fitness/js/dom-renderer-shadow.js ===
'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class DomRendererShadow {
  /**
   * @param {HTMLElement} layerEl
   * @param {Object} opts
   * @param {HTMLElement} opts.wrapEl
   * @param {HTMLElement} opts.feedbackEl
   * @param {(id:number, hitInfo?:Object)=>void} opts.onTargetHit
   */
  constructor(layerEl, opts = {}) {
    this.layerEl = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || (()=>{});
    this.targets = new Map();
    this.diffKey = 'normal';

    this._onPointerDown = this._onPointerDown.bind(this);

    if (this.layerEl) {
      this.layerEl.addEventListener('pointerdown', this._onPointerDown, { passive:false });
    }
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  destroy() {
    if (this.layerEl) {
      this.layerEl.removeEventListener('pointerdown', this._onPointerDown);
    }
    for (const t of this.targets.values()) {
      if (t && t.el && t.el.remove) t.el.remove();
    }
    this.targets.clear();
  }

  _layerRect() {
    if (!this.layerEl) return { left:0, top:0, width:0, height:0 };
    return this.layerEl.getBoundingClientRect();
  }

  _spawnPosPx(sizePx) {
    const rect = this._layerRect();
    const pad = Math.max(10, Math.round(sizePx * 0.15));
    const w = Math.max(0, rect.width - sizePx - pad * 2);
    const h = Math.max(0, rect.height - sizePx - pad * 2);
    const x = pad + Math.random() * w;
    const y = pad + Math.random() * h;
    return { x, y };
  }

  spawnTarget(data) {
    if (!this.layerEl || !data) return;

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(data.id);
    el.dataset.type = data.type;

    const size = Math.max(44, Math.round(data.sizePx || 120));
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const { x, y } = this._spawnPosPx(size);
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    const inner = document.createElement('div');
    inner.className = 'sb-txt';

    // emoji logic
    if (data.type === 'bomb') inner.textContent = '💣';
    else if (data.type === 'decoy') inner.textContent = '😵';
    else if (data.type === 'heal') inner.textContent = '🩹';
    else if (data.type === 'shield') inner.textContent = '🛡️';
    else if (data.isBossFace) inner.textContent = data.bossEmoji || '👊';
    else inner.textContent = '🎯';

    el.appendChild(inner);
    this.layerEl.appendChild(el);

    this.targets.set(data.id, { el, data, size });
  }

  removeTarget(id) {
    const t = this.targets.get(id);
    if (!t) return;
    if (t.el && t.el.remove) t.el.remove();
    this.targets.delete(id);
  }

  playHitFx(id, fx) {
    // lightweight feedback: add class then remove
    const t = this.targets.get(id);
    if (!t || !t.el) return;
    const cls =
      fx && fx.grade === 'perfect' ? 'perfect' :
      fx && fx.grade === 'good' ? 'good' :
      fx && fx.grade === 'bad' ? 'bad' :
      'good';

    t.el.classList.add('hit');
    t.el.classList.add('hit-' + cls);
    setTimeout(() => {
      if (t.el) {
        t.el.classList.remove('hit');
        t.el.classList.remove('hit-' + cls);
      }
    }, 260);
  }

  _onPointerDown(e) {
    const target = e.target && e.target.closest ? e.target.closest('.sb-target') : null;
    if (!target) return;
    e.preventDefault();

    const id = parseInt(target.dataset.id || '0', 10);
    if (!id) return;

    const rect = target.getBoundingClientRect();
    const hitInfo = {
      clientX: e.clientX,
      clientY: e.clientY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };
    this.onTargetHit(id, hitInfo);
  }
}