// === /fitness/js/dom-renderer-shadow.js — Shadow Breaker Renderer (A-10) ===
'use strict';

import { pickClosestTarget, makeAssistMessenger } from './aim-assist.js';

const EMOJI_BY_TYPE = {
  normal:  '🥊',
  bomb:    '💣',
  decoy:   '🎭',
  heal:    '❤️',
  shield:  '🛡️',
  bossface:'👑'
};

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host        = host;
    this.wrapEl      = opts.wrapEl || document.body;
    this.feedbackEl  = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    // Aim Assist config
    this.lockPx = (opts.lockPx != null) ? Number(opts.lockPx) : (matchMedia('(pointer:coarse)').matches ? 44 : 28);
    this.assistTell = makeAssistMessenger({ cooldownMs: 1100 });

    this._handleClick = this._handleClick.bind(this);
    if (this.host) this.host.addEventListener('click', this._handleClick);
  }

  setDifficulty(diffKey) { this.diffKey = diffKey || 'normal'; }
  setLockPx(px){ this.lockPx = clamp(px, 8, 120); }

  destroy() {
    if (this.host) this.host.removeEventListener('click', this._handleClick);
    this.clearTargets();
  }

  clearTargets() {
    for (const el of this.targets.values()) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
  }

  _zoneFromXY(clientX, clientY, rect){
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top,  0, rect.height);
    const col = clamp(Math.floor((x / rect.width) * 3), 0, 2);
    const row = clamp(Math.floor((y / rect.height) * 2), 0, 1);
    return row * 3 + col; // 0..5
  }

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

    const size = Number(data.sizePx || 120);
    el.style.setProperty('--sb-target-size', `${size}px`);

    const rect = this.host.getBoundingClientRect();
    const pad = 18;
    const half = size / 2;

    const minXAll = pad + half;
    const maxXAll = Math.max(minXAll + 1, rect.width  - pad - half);
    const minYAll = pad + half;
    const maxYAll = Math.max(minYAll + 1, rect.height - pad - half);

    let xMin = minXAll, xMax = maxXAll, yMin = minYAll, yMax = maxYAll;

    if (data.preferZone != null) {
      const z = clamp(data.preferZone, 0, 5);
      const col = z % 3;
      const row = (z / 3) | 0;

      const colW = (maxXAll - minXAll) / 3;
      const rowH = (maxYAll - minYAll) / 2;

      xMin = minXAll + col * colW;
      xMax = minXAll + (col + 1) * colW;
      yMin = minYAll + row * rowH;
      yMax = minYAll + (row + 1) * rowH;

      const inset = 10;
      xMin += inset; xMax -= inset;
      yMin += inset; yMax -= inset;

      if (xMax <= xMin + 6) { xMin = minXAll; xMax = maxXAll; }
      if (yMax <= yMin + 6) { yMin = minYAll; yMax = maxYAll; }
    }

    const x = xMin + Math.random() * (xMax - xMin);
    const y = yMin + Math.random() * (yMax - yMin);

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    const zoneId = this._zoneFromXY(rect.left + x, rect.top + y, rect);
    el.dataset.zone = String(zoneId);

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

  _handleClick(ev) {
    if (!this.onTargetHit) return;

    // 1) direct hit?
    let target = ev.target.closest('.sb-target');

    // 2) if miss click, try Aim Assist (snap)
    if (!target) {
      const best = pickClosestTarget(this.targets, ev.clientX, ev.clientY, this.lockPx);
      if (best) {
        target = this.targets.get(best.id);
        // explainable message (rate-limited)
        this.assistTell((msg, tone)=>{
          try{ window.dispatchEvent(new CustomEvent('sb:assist',{ detail:{ msg, tone } })); }catch{}
        });
      }
    }

    if (!target) return;

    const id = parseInt(target.dataset.id, 10);
    if (!this.targets.has(id)) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    this.onTargetHit(id, {
      clientX: cx,
      clientY: cy,
      zoneId: parseInt(target.dataset.zone || '0', 10)
    });
  }

  _spawnScoreText(x, y, { grade, scoreDelta }) {
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