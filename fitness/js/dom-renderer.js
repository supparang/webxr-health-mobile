// js/dom-renderer.js
'use strict';

/**
 * DomRenderer:
 * - แสดง .target ใน host
 * - ปรับขนาดเป้าตาม config.targetSizePx
 * - มีเอฟเฟกต์ตัวเลขคะแนนลอยเมื่อชกโดน
 */

export class DomRenderer {
  /**
   * @param {GameEngine|null} engine
   * @param {HTMLElement} host
   * @param {object} options { sizePx?: number }
   */
  constructor(engine, host, options = {}) {
    this.engine = engine;
    this.host   = host;
    this._nodes = new Map();
    this.sizePx = options.sizePx || 70;
  }

  reset() {
    if (this.host) this.host.innerHTML = '';
    this._nodes.clear();
  }

  spawn(target) {
    const el = document.createElement('div');
    el.className = 'target spawn';
    if (target.type === 'decoy') {
      el.classList.add('decoy');
      el.textContent = '✖';
    } else {
      el.textContent = '●';
    }

    const size = this.sizePx;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    el.style.left = target.x + '%';
    el.style.top  = target.y + '%';
    el.dataset.id = String(target.id);

    const onHit = (ev) => {
      ev.preventDefault();
      if (this.engine && this.engine.hitTarget) {
        this.engine.hitTarget(target.id, { source: 'dom' });
      }
    };
    el.addEventListener('pointerdown', onHit, { passive: false });

    this.host.appendChild(el);
    this._nodes.set(target.id, { el, onHit });
  }

  // สร้างตัวเลขคะแนนลอย ๆ บริเวณที่เป้าถูกชก
  _spawnScoreFloat(xPct, yPct, text, isPenalty) {
    if (!this.host) return;
    const node = document.createElement('div');
    node.textContent = text;
    node.style.position = 'absolute';
    node.style.left = xPct + '%';
    node.style.top  = yPct + '%';
    node.style.transform = 'translate(-50%, -50%)';
    node.style.fontSize = '0.9rem';
    node.style.fontWeight = '600';
    node.style.pointerEvents = 'none';
    node.style.transition = 'transform .35s ease-out, opacity .35s ease-out';
    node.style.opacity = '1';
    node.style.textShadow = '0 2px 6px rgba(0,0,0,0.6)';

    if (isPenalty) {
      node.style.color = '#fecaca';
    } else {
      node.style.color = '#bbf7d0';
    }

    this.host.appendChild(node);

    // ทำให้ลอยขึ้นเล็กน้อยแล้วจางหาย
    requestAnimationFrame(() => {
      node.style.transform = 'translate(-50%, -80%)';
      node.style.opacity = '0';
      setTimeout(() => {
        if (node.parentElement) node.parentElement.removeChild(node);
      }, 380);
    });
  }

  hit(id, meta) {
    const record = this._nodes.get(id);
    if (!record) return;
    const { el, onHit } = record;
    el.removeEventListener('pointerdown', onHit);
    el.classList.add('hit');
    el.classList.remove('spawn');

    // เอฟเฟกต์คะแนนลอย
    const rect = this.host.getBoundingClientRect();
    const r    = el.getBoundingClientRect();
    const xPct = ((r.left + r.width / 2) - rect.left) / rect.width  * 100;
    const yPct = ((r.top  + r.height / 2) - rect.top)  / rect.height * 100;

    if (meta && meta.type === 'decoy') {
      this._spawnScoreFloat(xPct, yPct, '-pts', true);
    } else {
      this._spawnScoreFloat(xPct, yPct, '+pts', false);
    }

    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
      this._nodes.delete(id);
    }, 220);
  }

  expire(id) {
    const record = this._nodes.get(id);
    if (!record) return;
    const { el, onHit } = record;
    el.removeEventListener('pointerdown', onHit);
    el.classList.add('miss');
    el.style.opacity = '0.3';
    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
      this._nodes.delete(id);
    }, 180);
  }
}
