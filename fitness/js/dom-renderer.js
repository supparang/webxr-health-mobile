// js/dom-renderer.js
'use strict';

import { GameEngine } from './engine.js';

/**
 * DomRenderer:
 * - แสดง .target ใน #target-layer
 * - ยิง event hitTarget ไปที่ engine เมื่อคลิก
 */

export class DomRenderer {
  /**
   * @param {GameEngine} engine
   * @param {HTMLElement} host
   */
  constructor(engine, host) {
    this.engine = engine;
    this.host = host;
    this._nodes = new Map();
  }

  reset() {
    this.host.innerHTML = '';
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

    // Target position: x,y เป็นเปอร์เซ็นต์ในพื้นที่ host
    el.style.left = target.x + '%';
    el.style.top = target.y + '%';
    el.dataset.id = String(target.id);

    const onHit = (ev) => {
      ev.preventDefault();
      this.engine.hitTarget(target.id, { source: 'dom' });
    };
    el.addEventListener('pointerdown', onHit, { passive: false });

    this.host.appendChild(el);
    this._nodes.set(target.id, { el, onHit });
  }

  hit(id, meta) {
    const record = this._nodes.get(id);
    if (!record) return;
    const { el, onHit } = record;
    el.removeEventListener('pointerdown', onHit);
    el.classList.add('hit');
    el.classList.remove('spawn');

    // ทำให้หายไปหลัง effect
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
