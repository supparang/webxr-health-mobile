// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (UPDATED 2026-01-25) ===
'use strict';

const EMOJI_BY_TYPE = {
  normal:  '🥊',
  bomb:    '💣',
  decoy:   '🎭',  // เป้าลวง
  heal:    '❤️',
  shield:  '🛡️',
  bossface:'👑'   // จะถูกแทนด้วย bossEmoji จริงตอน spawn
};

function numCssVar(el, name, def = 0){
  try{
    const v = getComputedStyle(el).getPropertyValue(name);
    const n = parseFloat(String(v || '').trim());
    return Number.isFinite(n) ? n : def;
  } catch {
    return def;
  }
}

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host        = host;
    this.wrapEl      = opts.wrapEl || document.body;
    this.feedbackEl  = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

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
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
  }

  // ===== public API used by engine =====

  spawnTarget(data) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';

    const type = data && data.isBossFace ? 'bossface' : ((data && data.type) || 'normal');
    el.classList.add(`sb-target--${type}`);

    const emoji = (data && data.isBossFace && data.bossEmoji)
      ? data.bossEmoji
      : (EMOJI_BY_TYPE[type] || EMOJI_BY_TYPE.normal);

    el.dataset.id = String(data.id);
    el.dataset.type = type;

    // ขนาดเป้า: ควบคุมผ่าน CSS variable
    const size = (data && data.sizePx) || 120;
    el.style.setProperty('--sb-target-size', `${size}px`);

    // ✅ NEW: คำนวณตำแหน่งด้วย px จากขนาดจริงของ host + safe zones
    const rect = this.host.getBoundingClientRect();

    // กันชนขอบตามขนาดเป้า
    const pad = Math.max(18, Math.round(size * 0.55));

    // safe zones (หน่วย px) — ตั้งได้ใน CSS: --sb-top-safe, --sb-bottom-safe, --sb-left-safe, --sb-right-safe
    const topSafe    = numCssVar(this.host, '--sb-top-safe', 0);
    const bottomSafe = numCssVar(this.host, '--sb-bottom-safe', 0);
    const leftSafe   = numCssVar(this.host, '--sb-left-safe', 0);
    const rightSafe  = numCssVar(this.host, '--sb-right-safe', 0);

    const minX = pad + leftSafe;
    const maxX = Math.max(minX, rect.width  - pad - rightSafe);

    const minY = pad + topSafe;
    const maxY = Math.max(minY, rect.height - pad - bottomSafe);

    const xPx = minX + Math.random() * (maxX - minX);
    const yPx = minY + Math.random() * (maxY - minY);

    // ให้ host เป็น position:relative/absolute เพื่อให้ left/top (px) อ้างอิงถูก
    el.style.left = `${xPx}px`;
    el.style.top  = `${yPx}px`;

    // โครงสร้างภายใน
    const core = document.createElement('span');
    core.className = 'sb-target-core';
    core.textContent = emoji;

    el.appendChild(core);
    this.host.appendChild(el);

    this.targets.set(data.id, el);
  }

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;
    this.targets.delete(id);

    el.classList.add('sb-target--gone');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, reason === 'hit' ? 250 : 150);
  }

  playHitFx(id, opts) {
    const el = this.targets.get(id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    this._spawnScoreText(cx, cy, opts || {});
    this._spawnBurst(cx, cy, opts || {});
  }

  // ===== internal helpers =====

  _handleClick(ev) {
    const target = ev.target && ev.target.closest ? ev.target.closest('.sb-target') : null;
    if (!target) return;

    const id = parseInt(target.dataset.id, 10);
    if (!this.targets.has(id)) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: cx, clientY: cy });
    }
  }

  _spawnScoreText(x, y, { grade, scoreDelta }) {
    if (!this.wrapEl) return;

    const el = document.createElement('div');
    el.className = `sb-fx-score sb-fx-${grade || 'good'}`;
    el.textContent = (scoreDelta > 0 ? '+' : '') + (scoreDelta ?? 0);

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-live'));
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 700);
  }

  _spawnBurst(x, y, { grade }) {
    if (!this.wrapEl) return;

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
      dot.style.setProperty('--sb-fx-scale', scale.toString());

      document.body.appendChild(dot);
      requestAnimationFrame(() => dot.classList.add('is-live'));
      setTimeout(() => {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 550);
    }
  }
}
