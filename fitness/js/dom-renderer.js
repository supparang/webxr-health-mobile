// === js/dom-renderer.js — DOM target renderer + clamp inside playfield (2025-11-28d) ===
'use strict';

import { spawnHitParticle } from './particle.js';

const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export class DomRenderer {
  /**
   * host = element ที่ใช้เป็นกรอบ gameplay (เช่น #target-layer)
   * opts.onTargetHit(id, hitInfo) จะถูกเรียกเมื่อผู้เล่นคลิกเป้า
   */
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.onTargetHit = typeof opts.onTargetHit === 'function'
      ? opts.onTargetHit
      : () => {};

    this.targets = new Map(); // id → { target, el }

    // ให้แน่ใจว่า host เป็น relative + ตัดของที่ล้น
    const cs = getComputedStyle(this.host);
    if (cs.position === 'static') {
      this.host.style.position = 'relative';
    }
    if (cs.overflow === 'visible') {
      this.host.style.overflow = 'hidden';
    }
  }

  _measureHost() {
    const rect = this.host.getBoundingClientRect();
    return {
      width: rect.width || this.host.clientWidth || 1,
      height: rect.height || this.host.clientHeight || 1
    };
  }

  /**
   * engine จะส่งอ็อบเจ็กต์ target เข้ามา (ดูใน engine.js)
   * เราต้องวางเป้าใน host โดย:
   *  - คำนึงถึง target.sizePx
   *  - ใช้ zone_lr / zone_ud เพื่อสุ่มโซน
   *  - หนีบไม่ให้หลุดขอบกรอบ gameplay
   */
  spawnTarget(target) {
    if (!this.host || !target) return;

    const { width, height } = this._measureHost();

    const size = target.sizePx || 100;
    const radiusX = size / 2;
    const radiusY = size / 2;
    const marginX = radiusX + 8; // กัน glow / stroke
    const marginY = radiusY + 8;

    // แบ่งจอเป็น 3x3 โซน ตาม zone_lr / zone_ud
    const cols = 3;
    const rows = 3;

    const usableW = Math.max(width  - marginX * 2, 10);
    const usableH = Math.max(height - marginY * 2, 10);

    const cellW = usableW / cols;
    const cellH = usableH / rows;

    let colIndex = 1; // center
    let rowIndex = 1; // middle

    if (target.zone_lr === 'L') colIndex = 0;
    else if (target.zone_lr === 'R') colIndex = 2;

    if (target.zone_ud === 'U') rowIndex = 0;
    else if (target.zone_ud === 'D') rowIndex = 2;

    const xMin = marginX + colIndex * cellW;
    const xMax = xMin + cellW;
    const yMin = marginY + rowIndex * cellH;
    const yMax = yMin + cellH;

    let x = randRange(xMin, xMax);
    let y = randRange(yMin, yMax);

    // หนีบอีกชั้นกันหลุดเผื่อ rounding
    x = clamp(x, marginX, width  - marginX);
    y = clamp(y, marginY, height - marginY);

    // เก็บ normalized pos ไว้ใช้ใน CSV
    target.x_norm = clamp(x / width,  0, 1);
    target.y_norm = clamp(y / height, 0, 1);

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target sb-target--' + (target.type || 'normal');
    el.dataset.id = String(target.id);
    el.dataset.type = target.type || 'normal';

    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left   = x + 'px';
    el.style.top    = y + 'px';

    // ข้อความ/emoji ในเป้า (แล้วแต่ type)
    let label = '●';
    if (target.isBomb)      label = '💣';
    else if (target.isHeal) label = '💚';
    else if (target.isShield) label = '🛡️';
    else if (target.isBossFace) label = '👑';
    el.textContent = label;

    const handleClick = (ev) => {
      ev.preventDefault();
      const info = {
        clientX: ev.clientX,
        clientY: ev.clientY
      };
      this.onTargetHit(target.id, info);
    };