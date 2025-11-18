// js/dom-renderer.js
'use strict';

/**
 * DomRenderer:
 * - แสดง .target ใน host (เช่น #target-layer)
 * - ส่ง event กลับไปหา engine.hitTarget เมื่อคลิก
 */

export class DomRenderer {
  constructor(engine, host) {
    this.engine = engine;
    this.host   = host;
    this._nodes = new Map();
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

  hit(id) {
    const record = this._nodes.get(id);
    if (!record) return;
    const { el, onHit } = record;
    el.removeEventListener('pointerdown', onHit);
    el.classList.add('hit');
    el.classList.remove('spawn');
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
