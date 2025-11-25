// === js/dom-renderer.js — DOM target renderer + FX (Shadow Breaker 2025-11-25) ===
'use strict';

export class DomRenderer {
  /**
   * host  : DOM element ที่จะวางเป้า (ปกติคือ #target-layer)
   * opts  : { onTargetHit(targetId, {screenX,screenY}) }
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.onTargetHit = opts.onTargetHit || (() => {});
    this.targets = new Map();   // id -> { el, data }
    this.lastHostRect = null;

    if (!this.host) {
      console.warn('[DomRenderer] host is null, renderer will be no-op');
    }

    // สำหรับ debounce การวัดขนาดจอ
    window.addEventListener('resize', () => {
      this.lastHostRect = null;
    }, { passive: true });
  }

  // ใช้ค่าจาก target.x_norm / y_norm แปลงเป็นตำแหน่ง %
  _place(el, t) {
    const xNorm = (t.xNorm != null) ? t.xNorm : (t.x_norm != null ? t.x_norm : Math.random());
    const yNorm = (t.yNorm != null) ? t.yNorm : (t.y_norm != null ? t.y_norm : Math.random());

    // clamp 0.08–0.92 กันเลยริม ๆ
    const xn = Math.min(0.92, Math.max(0.08, xNorm));
    const yn = Math.min(0.9,  Math.max(0.15, yNorm));

    el.style.left = (xn * 100) + '%';
    el.style.top  = (yn * 100) + '%';
  }

  // สร้าง DOM เป้า
  spawnTarget(t) {
    if (!this.host) return;
    // กันซ้ำ
    if (this.targets.has(t.id)) {
      this.removeTarget(t.id, 'dup');
    }

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = t.id;
    if (t.isDecoy)    el.dataset.type = 'decoy';
    if (t.isBomb)     el.dataset.type = 'bad';
    if (t.isBossFace) el.dataset.bossFace = '1';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';

    // เลือก emoji ตามชนิดเป้า
    let symbol = '🥊';
    if (t.isBomb)       symbol = '💣';
    else if (t.isHeal)  symbol = '💚';
    else if (t.isShield)symbol = '🛡️';
    else if (t.isDecoy) symbol = '🎯';
    if (t.emoji)        symbol = t.emoji;

    inner.textContent = symbol;
    el.appendChild(inner);

    // ขนาดเป้า ตาม sizePx หรือตาม difficulty
    const sizePx = t.sizePx || t.size || 120;
    el.style.width  = sizePx + 'px';
    el.style.height = sizePx + 'px';

    // วางตำแหน่ง
    this._place(el, t);

    // handler ตอนตีเป้า
    const handleHit = (ev) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = rect.left + rect.width / 2;
      const sy = rect.top  + rect.height / 2;
      this.onTargetHit(t.id, { screenX: sx, screenY: sy });
    };

    el.addEventListener('pointerdown', handleHit);
    el.addEventListener('touchstart', handleHit, { passive: false });

    this.host.appendChild(el);
    this.targets.set(t.id, { el, data: t });
  }

  // ลบเป้า
  removeTarget(id, reason = '') {
    const rec = this.targets.get(id);
    if (!rec) return;
    const el = rec.el;

    // ถ้าเป็น hit ให้เล่น animation หด-หาย
    if (reason === 'hit') {
      el.classList.add('sb-hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    } else {
      if (el.parentNode) el.parentNode.removeChild(el);
    }

    this.targets.delete(id);
  }

  // เอฟเฟกต์ตอนตีโดน
  playHitFx(targetId, ev) {
    const rec = this.targets.get(targetId);
    const base = rec?.el || this.host;
    if (!base) return;

    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    // score popup
    const popup = document.createElement('div');
    popup.className = 'sb-fx-score';

    let label = '';
    if (ev.grade === 'perfect') {
      label = '+ ' + ev.scoreDelta + ' (PERFECT)';
      popup.classList.add('sb-perfect');
    } else if (ev.grade === 'good') {
      label = '+ ' + ev.scoreDelta + ' (GOOD)';
      popup.classList.add('sb-good');
    } else if (ev.grade === 'bad') {
      label = '+0 (LATE)';
      popup.classList.add('sb-miss');
    } else {
      label = 'MISS';
      popup.classList.add('sb-miss');
    }

    popup.textContent = label;
    popup.style.left = cx + 'px';
    popup.style.top  = cy + 'px';
    document.body.appendChild(popup);

    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 600);

    // neon burst + shake เล็กน้อย
    const neon = document.createElement('div');
    neon.className = 'sb-neon-hit';
    neon.style.left = cx + 'px';
    neon.style.top  = cy + 'px';
    document.body.appendChild(neon);
    setTimeout(() => {
      neon.remove();
    }, 260);

    const field = this.host?.closest('.sb-field');
    if (field) {
      field.classList.add('sb-shake-field');
      setTimeout(() => field.classList.remove('sb-shake-field'), 160);
    }
  }
}