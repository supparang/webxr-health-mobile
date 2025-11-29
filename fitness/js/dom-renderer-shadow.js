// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-04 pretty bubble) ===
'use strict';

/**
 * DomRendererShadow
 * - สร้าง/จัดการเป้า emoji ใน field (#sb-target-layer)
 * - ยิง effect แตกกระจาย + คะแนนเด้ง "ตรงเป้า"
 * - ส่งต่อ event hit ย้อนกลับไปหา engine ผ่าน onTargetHit(id, hitInfo)
 */
export class DomRendererShadow {
  /**
   * @param {HTMLElement} host #sb-target-layer
   * @param {Object} opts
   *   - wrapEl      element ครอบเกม (ใช้วาด FX เพราะ .sb-frag / .sb-score-fx = position:fixed)
   *   - feedbackEl  element ข้อความ (ยังไม่ใช้มาก แต่เผื่ออนาคต)
   *   - onTargetHit function(id, {clientX, clientY})
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.wrapEl = opts.wrapEl || document.body;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    /** id -> { el, data, centerClientX, centerClientY, handler } */
    this.targets = new Map();
    this.diffKey = 'normal';

    if (this.host) {
      // ให้แน่ใจว่าเป็น relative เพื่อใช้ left/top ได้
      const style = getComputedStyle(this.host);
      if (style.position === 'static') {
        this.host.style.position = 'relative';
      }
    }
  }

  // ===== Public API (engine เรียก) ====================================

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
    if (this.wrapEl) this.wrapEl.dataset.diff = this.diffKey;
  }

  /**
   * สร้างเป้าใหม่ตาม data จาก engine
   *   data: { id, type, sizePx, isBossFace, bossEmoji, ... }
   */
  spawnTarget(data) {
    if (!this.host || !data) return;

    const rect = this.host.getBoundingClientRect();
    const size = data.sizePx || 120;
    const half = size / 2;

    // สุ่มตำแหน่งให้อยู่ "ในกรอบ" ทั้งก้อน (ไม่ชิดขอบเกินไป)
    const maxX = Math.max(1, rect.width  - size);
    const maxY = Math.max(1, rect.height - size);
    const localX = half + Math.random() * maxX;
    const localY = half + Math.random() * maxY;

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(data.id);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = localX + 'px';
    el.style.top = localY + 'px';

    // type-specific class
    if (data.isBossFace) {
      el.classList.add('sb-target--bossface');
    } else if (data.isHeal) {
      el.classList.add('sb-target--heal');
    } else if (data.isShield) {
      el.classList.add('sb-target--shield');
    } else if (data.isBomb) {
      el.classList.add('sb-target--bomb');
    }

    // === โครงสร้างภายในให้ match กับ CSS ที่มีอยู่ ===
    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';

    const core = document.createElement('div');
    core.className = 'sb-bubble-core';

    const ring = document.createElement('div');
    ring.className = 'sb-ring';

    const emoji = document.createElement('div');
    emoji.className = 'sb-target-emoji';
    emoji.textContent = this._pickEmojiForTarget(data);

    // emoji ให้ใหญ่ประมาณ 70% ของเป้า และไม่ต่ำกว่า 36px
    const emojiSize = Math.max(36, size * 0.7);
    emoji.style.fontSize = emojiSize + 'px';

    inner.appendChild(core);
    inner.appendChild(ring);
    inner.appendChild(emoji);
    el.appendChild(inner);

    // handler ตอนแตะ/ชกเป้า
    const handler = (ev) => {
      ev.preventDefault();
      if (!this.onTargetHit) return;
      this.onTargetHit(data.id, {
        clientX: ev.clientX,
        clientY: ev.clientY
      });
    };
    el.addEventListener('pointerdown', handler);
    el.addEventListener('click', handler);

    this.host.appendChild(el);

    // เก็บตำแหน่งแบบ "พิกัดจอ" ไว้ใช้ตอนเล่น FX (เพราะ .sb-frag / .sb-score-fx เป็น fixed)
    const centerClientX = rect.left + localX;
    const centerClientY = rect.top + localY;

    this.targets.set(data.id, {
      el,
      data,
      handler,
      centerClientX,
      centerClientY
    });

    // spawn animation
    requestAnimationFrame(() => {
      el.classList.add('sb-target--spawned');
    });
  }

  removeTarget(id /*, reason */) {
    const entry = this.targets.get(id);
    if (!entry) return;
    const { el, handler } = entry;

    if (el) {
      el.removeEventListener('pointerdown', handler);
      el.removeEventListener('click', handler);
      el.classList.add('sb-target-exit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 150);
    }
    this.targets.delete(id);
  }

  clear() {
    for (const { el, handler } of this.targets.values()) {
      if (!el) continue;
      el.removeEventListener('pointerdown', handler);
      el.removeEventListener('click', handler);
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();

    if (this.wrapEl) {
      const fxNodes = this.wrapEl.querySelectorAll('.sb-frag, .sb-score-fx');
      fxNodes.forEach((n) => n.remove());
    }
  }

  destroy() {
    this.clear();
    this.host = null;
    this.wrapEl = null;
    this.onTargetHit = null;
  }

  /**
   * engine เรียกตอนตีโดน ให้ renderer ยิง effect แตกกระจาย + คะแนน
   * info: { grade, scoreDelta, clientX?, clientY? }
   */
  playHitFx(id, info = {}) {
    let { clientX, clientY } = info;

    const entry = this.targets.get(id);
    // ถ้าไม่มีพิกัดจาก pointer ให้ใช้ center ของเป้า
    if ((clientX == null || clientY == null) && entry) {
      clientX = entry.centerClientX;
      clientY = entry.centerClientY;
    }

    if (clientX == null || clientY == null) return;

    const grade = info.grade || 'good';
    const scoreDelta = info.scoreDelta || 0;

    this.showHitFx({
      x: clientX,
      y: clientY,
      scoreDelta,
      judgment: grade
    });
  }

  /** miss จาก engine (ถ้าต้องใช้ภายหลัง) */
  showMissFx({ x, y }) {
    if (x == null || y == null) return;
    this._spawnMissParticle(x, y);
    this._spawnScoreText(x, y, 0, 'miss');
  }

  // ===== FX helpers =====================================================

  showHitFx({ x, y, scoreDelta = 0, judgment = 'good' }) {
    if (x == null || y == null) return;
    this._spawnHitParticle(x, y, judgment);
    this._spawnScoreText(x, y, scoreDelta, judgment);
  }

  _pickEmojiForTarget(data) {
    if (data.isBossFace && data.bossEmoji) return data.bossEmoji;
    switch (data.type) {
      case 'bomb':   return '💣';
      case 'heal':   return '💊';
      case 'shield': return '🛡️';
      case 'decoy':  return '🎭';
      default:       return '🥊';
    }
  }

  _spawnScoreText(x, y, scoreDelta, judgment) {
    if (!this.wrapEl) return;

    const el = document.createElement('div');
    const j = judgment || 'good';

    el.className = `sb-score-fx sb-score-${j}`;

    if (j === 'miss') {
      el.textContent = 'MISS';
    } else {
      const sign = scoreDelta > 0 ? '+' : '';
      el.textContent = `${sign}${scoreDelta || 0}`;
    }

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    this.wrapEl.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add('is-live');
    });

    setTimeout(() => {
      el.remove();
    }, 700);
  }

  _spawnHitParticle(x, y, judgment) {
    if (!this.wrapEl) return;

    const j = judgment || 'good';
    const count = j === 'perfect' ? 18 : 12;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = `sb-frag sb-frag-${j}`;

      const size = 6 + Math.random() * 8;
      const dist = 40 + Math.random() * 50;
      const ang = (i / count) * Math.PI * 2;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const life = 380 + Math.random() * 260;

      el.style.width = el.style.height = size + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--dy', dy.toFixed(1) + 'px');
      el.style.setProperty('--life', life + 'ms');

      this.wrapEl.appendChild(el);

      requestAnimationFrame(() => {
        el.classList.add('is-live');
      });

      setTimeout(() => {
        el.remove();
      }, life + 80);
    }
  }

  _spawnMissParticle(x, y) {
    if (!this.wrapEl) return;
    const count = 10;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'sb-frag sb-frag-miss';

      const size = 5 + Math.random() * 6;
      const dist = 30 + Math.random() * 40;
      const ang = (Math.random() * Math.PI) + Math.PI / 2;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const life = 420 + Math.random() * 260;

      el.style.width = el.style.height = size + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', dx.toFixed(1) + 'px');
      el.style.setProperty('--dy', dy.toFixed(1) + 'px');
      el.style.setProperty('--life', life + 'ms');

      this.wrapEl.appendChild(el);

      requestAnimationFrame(() => {
        el.classList.add('is-live');
      });

      setTimeout(() => {
        el.remove();
      }, life + 80);
    }
  }
}
