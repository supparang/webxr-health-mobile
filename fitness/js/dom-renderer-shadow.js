// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-11-28) ===
'use strict';

export class DomRendererShadow {
  /**
   * host   = element พื้นที่เกม (เช่น #sb-play)
   * opts = { wrapEl?: element สำหรับวาด effect (เช่น document.body), flashEl?, feedbackEl? }
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.wrapEl = opts.wrapEl || document.body;
    this.flashEl = opts.flashEl || null;
    this.feedbackEl = opts.feedbackEl || null;
  }

  // ===== public API ที่ engine เรียกใช้ =====

  /** hit สำเร็จ */
  showHitFx({ x, y, scoreDelta = 0, lane = 0, judgment = 'good' }) {
    if (x == null || y == null) return;
    this.spawnHitParticle(x, y, judgment);
    this.spawnScoreText(x, y, scoreDelta, judgment);
  }

  /** miss */
  showMissFx({ x, y }) {
    if (x == null || y == null) return;
    this.spawnMissParticle(x, y);
    this.spawnScoreText(x, y, 0, 'miss');
  }

  /** ล้าง effect ทั้งหมด (เช่น ก่อนเริ่มเกมใหม่) */
  clear() {
    if (!this.wrapEl) return;
    const nodes = this.wrapEl.querySelectorAll('.sb-frag, .sb-score-fx');
    nodes.forEach(n => n.remove());
  }

  // ===== internal helpers =====

  /** คะแนนเด้งตรงจุดที่ตีเป้า */
  spawnScoreText(x, y, scoreDelta, judgment) {
    if (!this.wrapEl) return;

    const el = document.createElement('div');
    const j = judgment || 'good';

    el.className = `sb-score-fx sb-score-${j}`;
    // ถ้าเป็น miss ให้ขึ้นคำว่า MISS แทนคะแนน
    if (j === 'miss') {
      el.textContent = 'MISS';
    } else {
      const sign = scoreDelta > 0 ? '+' : '';
      el.textContent = `${sign}${scoreDelta || 0}`;
    }

    // ใช้ตำแหน่งหน้าจอโดยตรง
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    this.wrapEl.appendChild(el);

    // trigger animation
    requestAnimationFrame(() => {
      el.classList.add('is-live');
    });

    setTimeout(() => {
      el.remove();
    }, 700);
  }

  /** fragment แตกกระจายตอนตีโดน */
  spawnHitParticle(x, y, judgment) {
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

  /** particle ตอน miss (แตกลงด้านล่าง) */
  spawnMissParticle(x, y) {
    if (!this.wrapEl) return;

    const count = 10;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'sb-frag sb-frag-miss';

      const size = 5 + Math.random() * 6;
      const dist = 30 + Math.random() * 40;
      const ang = (Math.random() * Math.PI) + Math.PI / 2; // ทิศทางลงล่างครึ่งวง
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