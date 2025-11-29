// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-04) ===
'use strict';

/**
 * หน้าที่:
 * - สร้าง / ลบเป้าบน DOM
 * - จัดตำแหน่งเป้าแบบสุ่มภายใน layer
 * - ส่ง callback กลับไปให้ engine เมื่อตีโดนเป้า
 * - แสดง effect ตอนตีโดน (แตกกระจาย + ตัวเลขคะแนน) "ตรงกลางเป้า"
 */
export class DomRendererShadow {
  /**
   * @param {HTMLElement} host   ชั้นที่ใช้วางเป้า (เช่น #sb-target-layer)
   * @param {Object} opts
   *   - wrapEl      : element ครอบทั้งเกม (ใช้ set data-diff อะไรพวกนี้)
   *   - feedbackEl  : element ข้อความ (ถ้าจะเอามาใช้ทีหลัง)
   *   - onTargetHit : function(id, hitInfo) เรียกเมื่อผู้เล่นตีโดนเป้า
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.wrapEl = opts.wrapEl || document.body;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function'
      ? opts.onTargetHit
      : null;

    // เก็บข้อมูลของแต่ละเป้า { id => { el, x, y, data } }
    this.targets = new Map();

    this.diffKey = 'normal';

    if (this.host) {
      this.host.classList.add('sb-target-layer');
      const style = getComputedStyle(this.host);
      if (style.position === 'static') {
        // กันเคสลืมใส่ position:relative; ใน CSS
        this.host.style.position = 'relative';
      }
    }
  }

  // --- Config / lifecycle -----------------------------------

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
    if (this.wrapEl) this.wrapEl.dataset.diff = this.diffKey;
  }

  destroy() {
    for (const { el } of this.targets.values()) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
  }

  // --- Target management -------------------------------------

  /**
   * สร้างเป้าตัวใหม่บนจอ
   * @param {Object} data ต้องมี id, sizePx อย่างน้อย
   */
  spawnTarget(data) {
    if (!this.host || !data) return;
    const id = data.id;
    const size = data.sizePx || 120;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = `sb-target sb-target-${data.type || 'normal'}`;
    el.setAttribute('data-id', String(id));
    el.setAttribute('data-type', data.type || 'normal');
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // icon ในเป้า (ใช้ emoji ตามประเภท)
    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent =
      data.isBossFace
        ? (data.bossEmoji || '😈')
        : data.isBomb
        ? '💣'
        : data.isShield
        ? '🛡️'
        : data.isHeal
        ? '✨'
        : data.isDecoy
        ? '🎭'
        : '🥊';
    el.appendChild(inner);

    // วางตำแหน่งแบบสุ่มภายใน host
    const { x, y } = this._pickPosition(size);
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    // เก็บข้อมูลไว้ใช้ตอนแสดง effect
    this.targets.set(id, { el, x, y, data });

    // ตีโดนเป้า
    el.addEventListener('pointerup', (ev) => {
      ev.preventDefault();
      if (!this.targets.has(id)) return; // ถูกลบแล้ว
      if (this.onTargetHit) {
        this.onTargetHit(id, {
          clientX: ev.clientX,
          clientY: ev.clientY
        });
      }
    });

    this.host.appendChild(el);
  }

  /**
   * ลบเป้าออกจากจอ
   */
  removeTarget(id /*, reason */) {
    const entry = this.targets.get(id);
    if (!entry) return;
    const { el } = entry;
    if (el && el.parentNode) {
      el.classList.add('sb-target-exit');
      // ให้ animation เล่นนิดหน่อยแล้วค่อยลบ
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 180);
    }
    this.targets.delete(id);
  }

  /**
   * เล่น effect ตอนตีโดนเป้า:
   * - แตกกระจายรอบ ๆ เป้า
   * - เด้งตัวเลขคะแนนตรงกลางเป้า
   */
  playHitFx(id, info = {}) {
    const entry = this.targets.get(id);
    // ถ้าใน map ไม่มี (engine ลบไปแล้ว) ให้ใช้ตำแหน่งจาก pointer แทน
    let x, y;
    if (entry) {
      x = entry.x;
      y = entry.y;
    } else if (this.host && info.clientX != null && info.clientY != null) {
      const rect = this.host.getBoundingClientRect();
      x = info.clientX - rect.left;
      y = info.clientY - rect.top;
    } else {
      // fallback กลางจอ
      const rect = this.host.getBoundingClientRect();
      x = rect.width / 2;
      y = rect.height / 2;
    }

    const grade = info.grade || 'good';
    const scoreDelta = info.scoreDelta ?? 0;

    this._spawnHitParticle(x, y, grade);
    this._spawnScoreText(x, y, scoreDelta, grade);
  }

  // --- Internal helpers --------------------------------------

  _pickPosition(size) {
    const rect = this.host.getBoundingClientRect();
    const margin = Math.max(40, size * 0.7); // กันไม่ให้ชิดขอบเกิน
    const maxX = Math.max(margin, rect.width - margin);
    const maxY = Math.max(margin, rect.height - margin);

    const x = margin + Math.random() * (maxX - margin);
    const y = margin + Math.random() * (maxY - margin);

    return { x, y };
  }

  _spawnHitParticle(x, y, grade) {
    if (!this.host) return;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = `sb-frag sb-frag-${grade}`;
      const sz = 6 + Math.random() * 6;
      const ang = (i / n) * Math.PI * 2;
      const dist = 40 + Math.random() * 36;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      el.style.width = sz + 'px';
      el.style.height = sz + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');

      this.host.appendChild(el);

      // ลบหลัง animation จบ
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 420);
    }
  }

  _spawnScoreText(x, y, scoreDelta, grade) {
    if (!this.host) return;
    const el = document.createElement('div');
    el.className = `sb-score-fx sb-score-${grade}`;
    const v = Number(scoreDelta) || 0;
    const prefix = v > 0 ? '+' : '';
    el.textContent = `${prefix}${v}`;

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    this.host.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 600);
  }
}
