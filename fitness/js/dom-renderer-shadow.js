// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-03) ===
'use strict';

/**
 * DomRendererShadow
 * - สร้าง/จัดการเป้า emoji ใน field (host = #target-layer)
 * - ยิง effect แตกกระจาย + คะแนนเด้งตรงจุดที่ตี
 * - ส่งต่อ event hit กลับไปให้ engine ผ่าน onTargetHit(id, hitInfo)
 */
export class DomRendererShadow {
  /**
   * @param {HTMLElement} host  พื้นที่เกม (#target-layer)
   * @param {Object} opts
   *   - wrapEl    พื้นที่ใช้วาด FX (เช่น #sb-wrap)
   *   - feedbackEl element ข้อความ feedback (ยังไม่ใช้ใน renderer นี้)
   *   - onTargetHit(id, {clientX, clientY})
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.wrapEl = opts.wrapEl || document.body;
    this.flashEl = opts.flashEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.diffKey = 'normal';
    this.targets = new Map(); // id → {el, data, handler}
  }

  // ===== API ให้ engine เรียก =====

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  /**
   * สร้างเป้าใหม่ตาม data จาก engine
   * data ต้องมีอย่างน้อย: { id, type, sizePx, isBossFace?, bossEmoji? ... }
   */
  spawnTarget(data) {
    if (!this.host || !data) return;

    const rect = this.host.getBoundingClientRect();

    // กันไม่ให้ไปชิดขอบเกินไป
    const paddingX = Math.max(32, data.sizePx * 0.5);
    const paddingY = Math.max(40, data.sizePx * 0.5);

    const x = paddingX + Math.random() * Math.max(10, rect.width - paddingX * 2);
    const y = paddingY + Math.random() * Math.max(10, rect.height - paddingY * 2);

    const size = data.sizePx || 120;

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(data.id);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

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

    // inner structure ให้เข้ากับ shadow-breaker.css
    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';

    const core = document.createElement('div');
    core.className = 'sb-bubble-core';

    const ring = document.createElement('div');
    ring.className = 'sb-ring';

    const emoji = document.createElement('div');
    emoji.className = 'sb-target-emoji';
    emoji.textContent = this.pickEmojiForTarget(data);

    inner.appendChild(core);
    inner.appendChild(ring);
    inner.appendChild(emoji);
    el.appendChild(inner);

    // handler ตอนแตะ/ชกเป้า
    const handler = (ev) => {
      ev.preventDefault();
      if (this.onTargetHit) {
        this.onTargetHit(data.id, {
          clientX: ev.clientX,
          clientY: ev.clientY
        });
      }
    };
    el.addEventListener('pointerdown', handler);
    el.addEventListener('click', handler);

    this.host.appendChild(el);

    // animate spawn
    requestAnimationFrame(() => {
      el.classList.add('sb-target--spawned');
    });

    this.targets.set(data.id, { el, data, handler });
  }

  /**
   * ลบเป้าออก (ตอน timeout หรือ endGame)
   */
  removeTarget(id /*, reason */) {
    const entry = this.targets.get(id);
    if (!entry) return;

    const { el, handler } = entry;
    el.removeEventListener('pointerdown', handler);
    el.removeEventListener('click', handler);
    el.remove();

    this.targets.delete(id);
  }

  /**
   * engine เรียกตอนตีโดน ให้ renderer ยิง effect แตกกระจาย + คะแนน
   * info: { grade, scoreDelta, clientX?, clientY? }
   */
  playHitFx(id, info = {}) {
    // ถ้า engine ส่งพิกัดมาแล้ว ใช้อันนั้นเลย
    let { clientX: x, clientY: y } = info;

    // ถ้ายังไม่มี ให้หาจากตำแหน่งกลางของเป้า
    if ((x == null || y == null) && this.targets.has(id)) {
      const entry = this.targets.get(id);
      if (entry && entry.el) {
        const r = entry.el.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
    }

    const grade = info.grade || 'good';
    const scoreDelta = info.scoreDelta || 0;

    if (x != null && y != null) {
      this.showHitFx({
        x,
        y,
        scoreDelta,
        judgment: grade
      });
    }
  }

  /**
   * ล้างทุกอย่าง (เป้า + FX) ก่อนเริ่มเกมใหม่ หรือ destroy
   */
  clear() {
    // ลบเป้าทั้งหมด
    for (const { el, handler } of this.targets.values()) {
      el.removeEventListener('pointerdown', handler);
      el.removeEventListener('click', handler);
      el.remove();
    }
    this.targets.clear();

    // ลบ FX ทั้งหมด
    if (this.wrapEl) {
      const nodes = this.wrapEl.querySelectorAll('.sb-frag, .sb-score-fx');
      nodes.forEach((n) => n.remove());
    }
  }

  destroy() {
    this.clear();
    this.host = null;
    this.wrapEl = null;
    this.onTargetHit = null;
  }

  // ===== public FX API (ใช้ภายใน engine อื่น ๆ ได้ด้วย) =====

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

  // ===== internal helpers =====

  pickEmojiForTarget(data) {
    if (data.isBossFace && data.bossEmoji) return data.bossEmoji;
    switch (data.type) {
      case 'bomb':   return '💣';
      case 'heal':   return '💊';
      case 'shield': return '🛡️';
      case 'decoy':  return '🎭';
      default:       return '🥊';
    }
  }

  /** คะแนนเด้งตรงจุดที่ตีเป้า */
  spawnScoreText(x, y, scoreDelta, judgment) {
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
      const ang = (Math.random() * Math.PI) + Math.PI / 2; // ลงล่างครึ่งวง
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