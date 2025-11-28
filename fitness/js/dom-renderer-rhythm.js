// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-03) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host;
    this.wrapEl = opts.wrapEl || document.body;  // container ของเกม
    this.flashEl = opts.flashEl || null;
    this.feedbackEl = opts.feedbackEl || null;
  }

  // แปลงตำแหน่งในเกม (x, y) → พิกเซลบนหน้าจอจริง
  _screenPos(x, y) {
    const rect = this.wrapEl.getBoundingClientRect();
    return {
      left: rect.left + x,
      top:  rect.top  + y
    };
  }

  showHitFx({ x, y, scoreDelta, judgment }) {
    this.spawnHitParticle(x, y, judgment);
    this.spawnScoreText(x, y, scoreDelta, judgment);
  }

  showMissFx({ x, y }) {
    this.spawnMissParticle(x, y);
  }

  // ===== คะแนนเด้งตรงเป้า =====
  spawnScoreText(x, y, scoreDelta, judgment) {
    if (!Number.isFinite(scoreDelta)) return;

    const el = document.createElement('div');
    el.className = `sb-score-fx sb-score-${judgment || 'good'}`;
    el.textContent = `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`;

    const pos = this._screenPos(x, y);
    el.style.left = pos.left + 'px';
    el.style.top  = pos.top  + 'px';

    document.body.appendChild(el);

    // force reflow เพื่อให้ transition ทำงาน
    void el.offsetWidth;
    el.classList.add('is-live');

    setTimeout(() => {
      el.classList.remove('is-live');
      el.remove();
    }, 450);
  }

  // ===== เป้าแตกกระจายรอบจุดที่ตี =====
  spawnHitParticle(x, y, judgment) {
    const n = 12;
    const pos = this._screenPos(x, y);

    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = `sb-frag sb-frag-${judgment || 'good'}`;

      const size = 6 + Math.random() * 6;
      const ang = (i / n) * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const life = 400 + Math.random() * 200;

      el.style.width  = size + 'px';
      el.style.height = size + 'px';
      el.style.left   = pos.left + 'px';
      el.style.top    = pos.top  + 'px';
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');
      el.style.setProperty('--life', life + 'ms');

      document.body.appendChild(el);
      void el.offsetWidth;
      el.classList.add('is-live');

      setTimeout(() => el.remove(), life);
    }
  }

  spawnMissParticle(x, y) {
    const pos = this._screenPos(x, y);
    const el = document.createElement('div');
    el.className = 'sb-frag sb-frag-miss';

    const size = 14;
    const life = 450;

    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left   = pos.left + 'px';
    el.style.top    = pos.top  + 'px';
    el.style.setProperty('--dx', '0px');
    el.style.setProperty('--dy', '24px');
    el.style.setProperty('--life', life + 'ms');

    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-live');

    setTimeout(() => el.remove(), life);
  }
}