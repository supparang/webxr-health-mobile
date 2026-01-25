// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (2026-01-25 A) ===
'use strict';

const EMOJI_BY_TYPE = {
  normal:  '🥊',
  bomb:    '💣',
  decoy:   '🎭',
  heal:    '❤️',
  shield:  '🛡️',
  bossface:'👑'
};

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host        = host;
    this.wrapEl      = opts.wrapEl || document.body;
    this.feedbackEl  = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    this._handleClick = this._handleClick.bind(this);
    if (this.host) this.host.addEventListener('click', this._handleClick);
  }

  setDifficulty(diffKey) { this.diffKey = diffKey || 'normal'; }

  destroy() {
    if (this.host) this.host.removeEventListener('click', this._handleClick);
    this.clearTargets();
  }

  clearTargets() {
    for (const el of this.targets.values()) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
  }

  // ===== public API =====
  spawnTarget(data) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';

    const type = data.isBossFace ? 'bossface' : (data.type || 'normal');
    el.classList.add(`sb-target--${type}`);

    const emoji = (data.isBossFace && data.bossEmoji)
      ? data.bossEmoji
      : (EMOJI_BY_TYPE[type] || EMOJI_BY_TYPE.normal);

    el.dataset.id = String(data.id);
    el.dataset.type = type;

    const size = data.sizePx || 120;
    el.style.setProperty('--sb-target-size', `${size}px`);

    // ✅ A: กระจายตำแหน่งโดยคำนึงถึงขนาด (กันหลุดขอบ)
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const pad = Math.min(0.18, Math.max(0.10, (size / Math.min(w,h)) * 0.75)); // 10–18%
    const x = (pad + Math.random() * (1 - pad * 2)) * 100;
    const y = (pad + Math.random() * (1 - pad * 2)) * 100;

    el.style.left = x.toFixed(2) + '%';
    el.style.top  = y.toFixed(2) + '%';

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

    this._spawnScoreText(cx, cy, opts);
    this._spawnBurst(cx, cy, opts);
  }

  // ===== internal =====
  _handleClick(ev) {
    const target = ev.target.closest('.sb-target');
    if (!target) return;

    const id = parseInt(target.dataset.id, 10);
    if (!this.targets.has(id)) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    if (this.onTargetHit) this.onTargetHit(id, { clientX: cx, clientY: cy });
  }

  _spawnScoreText(x, y, { grade, scoreDelta }) {
    if (!this.wrapEl) return;
    const el = document.createElement('div');
    el.className = `sb-fx-score sb-fx-${grade || 'good'}`;
    el.textContent = (scoreDelta > 0 ? '+' : '') + scoreDelta;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-live'));
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
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
      setTimeout(() => { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 550);
    }
  }
}
