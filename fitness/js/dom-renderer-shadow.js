// === /fitness/js/dom-renderer-shadow.js — Shadow Breaker Renderer (PATCH 2026-01-27) ===
'use strict';

const EMOJI_BY_TYPE = {
  normal:   '🥊',
  bomb:     '💣',
  decoy:    '🎭',
  heal:     '❤️',
  shield:   '🛡️',
  bossface: '👑' // จะถูกแทนด้วย bossEmoji จริงตอน spawn
};

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host        = host;
    this.wrapEl      = opts.wrapEl || document.body;
    this.feedbackEl  = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    // สำหรับกันซ้อน: เก็บ bounding box ล่าสุด
    this._placed = [];

    this._handleClick = this._handleClick.bind(this);
    if (this.host) {
      this.host.addEventListener('click', this._handleClick);
    }
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  destroy() {
    if (this.host) {
      this.host.removeEventListener('click', this._handleClick);
    }
    this.clearTargets();
  }

  clearTargets() {
    for (const el of this.targets.values()) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
    this._placed.length = 0;
  }

  // ===== public API used by engine =====

  spawnTarget(data) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';

    const type = data.isBossFace ? 'bossface' : (data.type || 'normal');
    el.classList.add(`sb-target--${type}`);

    const emoji = data.isBossFace && data.bossEmoji
      ? data.bossEmoji
      : (EMOJI_BY_TYPE[type] || EMOJI_BY_TYPE.normal);

    el.dataset.id = String(data.id);
    el.dataset.type = type;

    // ขนาดเป้า: ควบคุมผ่าน CSS variable
    const size = Math.max(64, data.sizePx || 120);
    el.style.setProperty('--sb-target-size', `${size}px`);

    // โครงสร้างภายใน
    const core = document.createElement('span');
    core.className = 'sb-target-core';
    core.textContent = emoji;
    el.appendChild(core);

    // ใส่เข้าก่อน เพื่อให้คำนวณได้ (ถ้าต้องการ)
    this.host.appendChild(el);

    // ===== PATCH: ตำแหน่งแบบ px clamp + กันซ้อน =====
    // ใช้ขนาด host จริงในการวาง เพื่อไม่ให้เป้าไปกองแถวเดียว
    const hostRect = this.host.getBoundingClientRect();
    const w = Math.max(1, hostRect.width);
    const h = Math.max(1, hostRect.height);

    // margin กันชนขอบ + กันไม่ให้เป้าทับ HUD/ขอบ
    const margin = Math.max(10, Math.round(size * 0.15));
    const minX = margin + size * 0.5;
    const maxX = Math.max(minX + 1, w - margin - size * 0.5);
    const minY = margin + size * 0.5;
    const maxY = Math.max(minY + 1, h - margin - size * 0.5);

    // ระยะห่างขั้นต่ำกันซ้อน (ปรับตามขนาด)
    const minDist = Math.max(26, Math.round(size * 0.55));

    let px = (minX + Math.random() * (maxX - minX));
    let py = (minY + Math.random() * (maxY - minY));

    // ลองหาตำแหน่งใหม่หลายครั้งเพื่อลดการซ้อน
    let ok = false;
    for (let attempt = 0; attempt < 14; attempt++) {
      ok = true;
      for (const p of this._placed) {
        const dx = px - p.x;
        const dy = py - p.y;
        if ((dx * dx + dy * dy) < (minDist * minDist)) {
          ok = false;
          break;
        }
      }
      if (ok) break;
      px = (minX + Math.random() * (maxX - minX));
      py = (minY + Math.random() * (maxY - minY));
    }

    // วางด้วย px เพื่อแม่นสุด
    el.style.left = `${px}px`;
    el.style.top  = `${py}px`;

    // บันทึกตำแหน่งที่วางไว้
    this._placed.push({ id: data.id, x: px, y: py, size });

    this.targets.set(data.id, el);
  }

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;

    this.targets.delete(id);
    this._placed = this._placed.filter(p => p.id !== id);

    el.classList.add('sb-target--gone');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, reason === 'hit' ? 250 : 150);
  }

  playHitFx(id, opts = {}) {
    const el = this.targets.get(id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    this._spawnScoreText(cx, cy, opts);
    this._spawnBurst(cx, cy, opts);
  }

  // ===== internal helpers =====

  _handleClick(ev) {
    const btn = ev.target.closest('.sb-target');
    if (!btn) return;

    const id = parseInt(btn.dataset.id, 10);
    if (!this.targets.has(id)) return;

    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: cx, clientY: cy });
    }
  }

  _spawnScoreText(x, y, { grade, scoreDelta }) {
    const root = this.wrapEl || document.body;

    const el = document.createElement('div');
    el.className = `sb-fx-score sb-fx-${grade || 'good'}`;
    el.textContent = (scoreDelta > 0 ? '+' : '') + scoreDelta;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-live'));
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 700);
  }

  _spawnBurst(x, y, { grade }) {
    const root = this.wrapEl || document.body;

    const n = grade === 'perfect' ? 20 : 12;
    for (let i = 0; i < n; i++) {
      const dot = document.createElement('div');
      dot.className = `sb-fx-dot sb-fx-${grade || 'good'}`;
      dot.style.left = `${x}px`;
      dot.style.top  = `${y}px`;

      const ang = (Math.PI * 2 * i) / n;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const scale = 0.6 + Math.random() * 0.6;

      dot.style.setProperty('--sb-fx-dx', `${dx}px`);
      dot.style.setProperty('--sb-fx-dy', `${dy}px`);
      dot.style.setProperty('--sb-fx-scale', String(scale));

      root.appendChild(dot);
      requestAnimationFrame(() => dot.classList.add('is-live'));
      setTimeout(() => {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 550);
    }
  }
}