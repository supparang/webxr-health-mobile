// === fitness/js/dom-renderer.js — Shadow Breaker DOM Renderer (2025-11-19) ===
'use strict';

/**
 * ใช้ร่วมกับ GameEngine (engine.js)
 *
 *   const host = document.getElementById('target-layer');
 *   const renderer = new DomRenderer(null, host, { sizePx: 110 });
 *   renderer.engine = engine;
 *
 * engine จะเรียก:
 *   renderer.clear()
 *   renderer.spawnTarget(target)
 *   renderer.markHit(target, quality)
 *   renderer.markMiss(target)
 *
 * target:
 *   {
 *     id,
 *     type: 'main' | 'decoy' | 'heal',
 *     nx, ny (0–1),
 *     spawnAt
 *   }
 */

const EMOJI_MAIN = ['🟢','🔵','🟣','⭐','⚡','💥'];
const EMOJI_DECOY = ['❌','💣','🧊','☢️','🕳️'];
const EMOJI_HEAL  = ['💚','❤️','➕','💊'];

export class DomRenderer {
  /**
   * @param {HTMLElement|null} rootEl  กล่องใหญ่ (เช่น .play-area) ถ้าไม่ส่งจะหาเอง
   * @param {HTMLElement|null} hostEl  ชั้นวาดเป้า (#target-layer) ถ้าไม่ส่งจะสร้าง
   * @param {Object} opts
   *   - sizePx: ขนาดเป้าคร่าว ๆ (px) ใช้เป็น base สำหรับ scale
   */
  constructor(rootEl, hostEl, opts = {}) {
    this.root = rootEl || document.querySelector('.play-area') || document.body;
    this.host = hostEl || document.getElementById('target-layer');
    this.sizePx = opts.sizePx || 110;
    this.engine = null; // main-shadow.js จะ set ให้

    /** @type {Map<number,{el:HTMLElement,target:Object}>} */
    this.targets = new Map();

    if (!this.host) {
      this.host = document.createElement('div');
      this.host.id = 'target-layer';
      this.host.style.position = 'absolute';
      this.host.style.inset = '0';
      this.root.appendChild(this.host);
    }

    this._bindPointerEvents();
  }

  // ล้างเป้าทั้งหมด
  clear() {
    this.targets.clear();
    if (this.host) {
      this.host.innerHTML = '';
    }
  }

  // สร้าง DOM สำหรับเป้าใหม่
  spawnTarget(target) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'target spawn';
    el.setAttribute('data-target-id', String(target.id));
    el.setAttribute('data-type', target.type || 'main');
    el.style.position = 'absolute';

    // ใช้เปอร์เซ็นต์ + safe clamp กันหลุดขอบ
    const nx = this._clamp(target.nx != null ? target.nx : Math.random(), 0.12, 0.88);
    const ny = this._clamp(target.ny != null ? target.ny : Math.random(), 0.18, 0.82);

    el.style.left = (nx * 100).toFixed(2) + '%';
    el.style.top  = (ny * 100).toFixed(2) + '%';

    // emoji ตามประเภท
    el.textContent = this._pickEmoji(target.type);

    // ปรับฐานขนาดคร่าว ๆ (แต่ยังให้ CSS หลักควบคุม)
    const base = this.sizePx;
    el.style.width  = base + 'px';
    el.style.height = base + 'px';
    el.style.fontSize = Math.round(base * 0.5) + 'px';

    if (target.type === 'decoy') {
      el.classList.add('decoy');
    } else if (target.type === 'heal') {
      el.classList.add('heal');
    }

    this.host.appendChild(el);
    this.targets.set(target.id, { el, target });
  }

  // แสดง hit effect
  markHit(target, quality) {
    const info = this.targets.get(target.id);
    if (!info) return;
    const el = info.el;
    if (!el) return;

    el.classList.remove('spawn');
    el.classList.add('hit');
    if (quality) {
      el.classList.add('hit-' + quality);
    }

    // score popup เล็ก ๆ ใกล้เป้า
    this._spawnScorePopup(el, quality, target.type);

    // ลบเป้าออกหลัง animation
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      this.targets.delete(target.id);
    }, 220);
  }

  // แสดง miss effect (จางแล้วหาย)
  markMiss(target) {
    const info = this.targets.get(target.id);
    if (!info) return;
    const el = info.el;
    if (!el) return;

    el.classList.remove('spawn');
    el.classList.add('miss');
    el.style.opacity = '0.35';

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      this.targets.delete(target.id);
    }, 200);
  }

  // ---------- internal: pointer / hit detection ----------

  _bindPointerEvents() {
    if (!this.host) return;

    this.host.addEventListener(
      'pointerdown',
      (ev) => {
        if (!this.engine) return;
        // ป้องกัน scroll / select บนมือถือ
        ev.preventDefault();

        const hit = this._pickTargetElement(ev.clientX, ev.clientY);
        if (!hit) return;

        const idStr = hit.getAttribute('data-target-id');
        if (!idStr) return;
        const id = Number(idStr);
        const info = this.targets.get(id);
        if (!info || !info.target) return;

        // ส่งให้ engine ตัดสิน PERFECT / GOOD / LATE
        this.engine.handleHit({
          id,
          screenX: ev.clientX,
          screenY: ev.clientY
        });
      },
      { passive: false }
    );
  }

  /**
   * หา element เป้าจากตำแหน่ง pointer (ใช้ elementFromPoint)
   */
  _pickTargetElement(x, y) {
    // ใช้ elementFromPoint เพื่อหาเป้าที่อยู่บนสุด
    let el = document.elementFromPoint(x, y);
    while (el && el !== this.host && el !== document.body && el !== document.documentElement) {
      if (el.hasAttribute && el.hasAttribute('data-target-id')) {
        return el;
      }
      el = el.parentNode;
    }
    return null;
  }

  // ---------- helpers ----------

  _pickEmoji(type) {
    if (type === 'decoy') {
      return EMOJI_DECOY[Math.floor(Math.random() * EMOJI_DECOY.length)];
    }
    if (type === 'heal') {
      return EMOJI_HEAL[Math.floor(Math.random() * EMOJI_HEAL.length)];
    }
    return EMOJI_MAIN[Math.floor(Math.random() * EMOJI_MAIN.length)];
  }

  _clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  _spawnScorePopup(targetEl, quality, type) {
    if (!this.host) return;
    const rectHost = this.host.getBoundingClientRect();
    const rect = targetEl.getBoundingClientRect();

    const pop = document.createElement('div');
    pop.textContent = this._scoreText(quality, type);
    pop.style.position = 'absolute';
    pop.style.left = (rect.left - rectHost.left + rect.width / 2) + 'px';
    pop.style.top  = (rect.top - rectHost.top - rect.height * 0.1) + 'px';
    pop.style.transform = 'translate(-50%,-50%)';
    pop.style.pointerEvents = 'none';
    pop.style.fontSize = '0.85rem';
    pop.style.fontWeight = '600';
    pop.style.padding = '2px 6px';
    pop.style.borderRadius = '999px';
    pop.style.background = 'rgba(15,23,42,0.95)';
    pop.style.border = '1px solid rgba(250,250,250,0.8)';
    pop.style.color = '#fefce8';
    pop.style.boxShadow = '0 6px 18px rgba(0,0,0,0.8)';
    pop.style.opacity = '1';
    pop.style.transition = 'opacity .22s ease-out, transform .22s ease-out';

    this.host.appendChild(pop);

    requestAnimationFrame(() => {
      pop.style.transform = 'translate(-50%,-120%)';
      pop.style.opacity = '0';
    });

    setTimeout(() => {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 260);
  }

  _scoreText(quality, type) {
    if (quality === 'perfect') return type === 'decoy' ? '😅' : '+PERFECT';
    if (quality === 'good')    return type === 'decoy' ? '!? ❌' : '+GOOD';
    if (quality === 'late')    return '+LATE';
    return 'MISS';
  }
}