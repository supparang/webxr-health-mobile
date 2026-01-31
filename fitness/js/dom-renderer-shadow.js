// === fitness/js/dom-renderer-shadow.js ===
// Shadow Breaker — DOM Renderer (Pack D)
// ✅ Supports deterministic spawn via xPct/yPct (0..1)
// ✅ Keeps previous safe clamp
'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class DomRendererShadow {
  constructor(layerEl) {
    this.layer = layerEl;
    this.targets = new Map(); // id -> el
    this.onHit = null; // fn(id, clientX, clientY)
  }

  clear() {
    for (const el of this.targets.values()) el.remove();
    this.targets.clear();
  }

  setOnHit(fn) {
    this.onHit = fn;
  }

  _pickSpawnPoint(rect, size) {
    const margin = clamp(size * 0.65, 42, 120);
    const x = margin + Math.random() * Math.max(10, rect.width - margin * 2);
    const y = margin + Math.random() * Math.max(10, rect.height - margin * 2);
    return { x, y };
  }

  spawnTarget(data) {
    if (!data || !data.id) return;

    const rect = this.layer.getBoundingClientRect();

    const size = clamp(Number(data.sizePx) || 120, 80, 240);
    let x = 0;
    let y = 0;
    // If engine provides xPct/yPct (0..1), use it for deterministic patterns.
    if (Number.isFinite(data.xPct) && Number.isFinite(data.yPct) && rect.width > 10 && rect.height > 10) {
      const xp = clamp(Number(data.xPct), 0.06, 0.94);
      const yp = clamp(Number(data.yPct), 0.12, 0.88);
      x = xp * rect.width;
      y = yp * rect.height;
    } else {
      const pt = this._pickSpawnPoint(rect, size);
      x = pt.x;
      y = pt.y;
    }

    const el = document.createElement('div');
    el.className = 'sb-target';

    if (data.type === 'decoy') el.classList.add('sb-target--decoy');
    if (data.isBossFace) el.classList.add('sb-target--bossface');

    el.dataset.id = data.id;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.fontSize = clamp(size * 0.52, 26, 56) + 'px';
    el.textContent = data.emoji || '🎯';

    const hit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = el.dataset.id;
      const cx = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
      const cy = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
      if (this.onHit) this.onHit(id, cx, cy);
    };

    el.addEventListener('click', hit, { passive: false });
    el.addEventListener('touchstart', hit, { passive: false });

    this.layer.appendChild(el);
    this.targets.set(data.id, el);
  }

  despawn(id) {
    const el = this.targets.get(id);
    if (!el) return;
    el.remove();
    this.targets.delete(id);
  }

  playHitFx(x, y, grade) {
    // Visual handled in engine (FxBurst) for Pack D
    // This stays for compatibility if you want to add extra renderer-only FX later.
  }
}