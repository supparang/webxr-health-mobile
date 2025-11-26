// === js/dom-renderer.js — Shadow Breaker DOM Target Renderer + FX (2025-11-29b) ===
'use strict';

const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));

export class DomRenderer {
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.opts = opts;
    this.targets = new Map(); // id → { el, cx, cy, size }

    if (getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }
  }

  // ---------- SPAWN ----------

  spawnTarget(target) {
    if (!this.host || !target) return;

    const fieldRect = this.host.getBoundingClientRect();
    const w = fieldRect.width  || this.host.clientWidth  || 320;
    const h = fieldRect.height || this.host.clientHeight || 320;

    const size   = target.sizePx || 96;
    const radius = size / 2;
    const margin = radius + 10;

    if (w < margin * 2 || h < margin * 2) {
      console.warn('[DomRenderer] playfield too small for targets');
      return;
    }

    // zone L/C/R × U/M/D → fraction
    const zoneLR = target.zone_lr || 'C';
    const zoneUD = target.zone_ud || 'M';

    let xMinF = 0.33, xMaxF = 0.67;
    let yMinF = 0.33, yMaxF = 0.67;

    if (zoneLR === 'L')      { xMinF = 0.05; xMaxF = 0.35; }
    else if (zoneLR === 'C'){ xMinF = 0.33; xMaxF = 0.67; }
    else if (zoneLR === 'R'){ xMinF = 0.65; xMaxF = 0.95; }

    if (zoneUD === 'U')      { yMinF = 0.05; yMaxF = 0.38; }
    else if (zoneUD === 'M'){ yMinF = 0.30; yMaxF = 0.72; }
    else if (zoneUD === 'D'){ yMinF = 0.60; yMaxF = 0.95; }

    const zoneXMin = w * xMinF;
    const zoneXMax = w * xMaxF;
    const zoneYMin = h * yMinF;
    const zoneYMax = h * xMaxF ? h * yMaxF : h * yMaxF; // safe

    const safeXMin = clamp(zoneXMin, margin, w - margin);
    const safeXMax = clamp(zoneXMax, margin, w - margin);
    const safeYMin = clamp(zoneYMin, margin, h - margin);
    const safeYMax = clamp(zoneYMax, margin, h - margin);

    let cx = 0;
    let cy = 0;

    const isTooClose = (x, y) => {
      for (const { cx: ox, cy: oy, size: os } of this.targets.values()) {
        const dx = x - ox;
        const dy = y - oy;
        const dist2 = dx * dx + dy * dy;
        const minDist = (size + os) * 0.55;
        if (dist2 < minDist * minDist) return true;
      }
      return false;
    };

    const maxTry = 8;
    for (let i = 0; i < maxTry; i++) {
      const x = safeXMin + Math.random() * Math.max(40, (safeXMax - safeXMin));
      const y = safeYMin + Math.random() * Math.max(40, (safeYMax - safeYMin));
      if (!isTooClose(x, y) || i === maxTry - 1) {
        cx = clamp(x, margin, w - margin);
        cy = clamp(y, margin, h - margin);
        break;
      }
    }

    const xNorm = w > 0 ? cx / w : 0.5;
    const yNorm = h > 0 ? cy / h : 0.5;
    target.x_norm = +xNorm.toFixed(4);
    target.y_norm = +yNorm.toFixed(4);

    const type    = target.type || 'normal';
    const diffKey = target.diffKey || 'normal';

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target sb-target--' + type;
    el.classList.add('sb-target--diff-' + diffKey);
    el.dataset.id = String(target.id);
    el.dataset.type = type;

    el.style.position = 'absolute';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left   = cx + 'px';
    el.style.top    = cy + 'px';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner sb-target-inner--' + type;
    inner.textContent = this._iconForType(type, target);

    el.appendChild(inner);

    const handler = (ev) => {
      ev.preventDefault();
      this._emitHit(target.id, ev);
    };
    el.addEventListener('pointerdown', handler);
    el.addEventListener('click', handler);

    this.host.appendChild(el);
    this.targets.set(target.id, { el, cx, cy, size });
  }

  _iconForType(type, target) {
    if (type === 'bomb')     return '💣';
    if (type === 'decoy')    return '👻';
    if (type === 'heal')     return '💚';
    if (type === 'shield')   return '🛡️';
    if (type === 'bossface') return '😈';
    return '🎯';
  }

  // ---------- REMOVE ----------

  removeTarget(id, reason = '') {
    const rec = this.targets.get(id);
    if (!rec) return;
    const el = rec.el;

    if (reason === 'timeout') {
      el.classList.add('sb-target--fade-timeout');
      setTimeout(() => el.remove(), 180);
    } else if (reason === 'boss-change' || reason === 'end') {
      el.classList.add('sb-target--fade-soft');
      setTimeout(() => el.remove(), 140);
    } else if (reason === 'hit') {
      el.classList.add('sb-target--hit');
      setTimeout(() => el.remove(), 140);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  // ---------- FX ----------

  playHitFx(id, opts = {}) {
    const rec  = this.targets.get(id);
    const host = this.host || document.body;
    if (!host) return;

    const { grade, scoreDelta, fxEmoji, clientX, clientY } = opts;

    const hostRect = host.getBoundingClientRect();
    let x = clientX;
    let y = clientY;

    if (rec && rec.el) {
      const r = rec.el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top  + r.height / 2;
    } else {
      if (x == null || y == null) {
        x = hostRect.left + hostRect.width  / 2;
        y = hostRect.top  + hostRect.height / 2;
      }
    }

    const xLocal = x - hostRect.left;
    const yLocal = y - hostRect.top;

    // Popup PERFECT / GOOD / MISS
    const pop = document.createElement('div');
    pop.className = 'sb-pop';

    const emoDefault =
      fxEmoji ||
      (grade === 'perfect' ? '💥' :
       grade === 'good'    ? '⭐' :
       grade === 'heal'    ? '💚' :
       grade === 'shield'  ? '🛡️' :
       grade === 'bomb'    ? '💣' : '💫');

    let label = '';
    if (grade === 'perfect') label = 'PERFECT';
    else if (grade === 'good') label = 'GOOD';
    else if (grade === 'bad') label = 'LATE';
    else if (grade === 'bomb') label = 'BOMB!';
    else if (grade === 'heal') label = 'HEAL';
    else if (grade === 'shield') label = 'SHIELD';
    else label = 'MISS';

    if (typeof scoreDelta === 'number' && scoreDelta > 0) {
      pop.textContent = `+${scoreDelta}`;
    } else {
      pop.textContent = label || emoDefault;
    }

    if (grade) pop.classList.add('sb-pop--' + grade);

    pop.style.left = xLocal + 'px';
    pop.style.top  = yLocal + 'px';

    host.appendChild(pop);
    setTimeout(() => pop.remove(), 650);

    // shards แตกกระจาย
    const shardCount = 7;
    for (let i = 0; i < shardCount; i++) {
      const shard = document.createElement('div');
      shard.className = 'sb-hit-shard';
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      shard.style.left = xLocal + 'px';
      shard.style.top  = yLocal + 'px';
      shard.style.setProperty('--dx', dx.toFixed(1) + 'px');
      shard.style.setProperty('--dy', dy.toFixed(1) + 'px');

      host.appendChild(shard);
      setTimeout(() => shard.remove(), 500);
    }
  }

  // ---------- INTERNAL ----------

  _emitHit(id, ev) {
    if (!this.opts || typeof this.opts.onTargetHit !== 'function') return;
    this.opts.onTargetHit(id, {
      clientX: ev.clientX,
      clientY: ev.clientY
    });
  }
}
