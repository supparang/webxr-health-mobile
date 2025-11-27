// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-04) ===
'use strict';

/**
 * เรนเดอร์เป้า / เอฟเฟ็กต์ทั้งหมดใน DOM สำหรับ Shadow Breaker
 * - host = element ของสนาม (เช่น #target-layer)
 * - this.onTargetHit(id, {clientX, clientY}) callback กลับไปที่ engine
 */
export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host || document.getElementById('target-layer') || document.body;
    this.wrapEl = opts.wrapEl || document.getElementById('sb-wrap') || this.host;
    this.flashEl = opts.flashEl || null;
    this.feedbackEl = opts.feedbackEl || document.getElementById('sb-feedback') || null;

    this.onTargetHit =
      typeof opts.onTargetHit === 'function' ? opts.onTargetHit : () => {};

    /** เก็บ mapping targetId -> { el, data } */
    this.targets = new Map();
    this.diffKey = 'normal';

    // ให้สนามเป็น relative เสมอ ป้องกันตำแหน่งเพี้ยน
    if (this.host && getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }

    this._boundPointerHandler = this._handlePointer.bind(this);
    this.host.addEventListener('pointerdown', this._boundPointerHandler, {
      passive: false
    });
  }

  destroy() {
    this.host.removeEventListener('pointerdown', this._boundPointerHandler);
    this.targets.forEach(({ el }) => el.remove());
    this.targets.clear();
  }

  setDifficulty(key) {
    this.diffKey = key || 'normal';
  }

  // ---------- INTERNAL HELPERS ----------

  _emojiForTarget(t) {
    if (t.isBossFace) return t.bossEmoji || '💥';
    if (t.isBomb) return '💣';
    if (t.isHeal) return '💚';
    if (t.isShield) return '🛡️';
    if (t.isDecoy) return '🎯';
    return '🥊';
  }

  _handlePointer(ev) {
    const btn = ev.target.closest('.sb-target');
    if (!btn) return;

    ev.preventDefault();

    const id = Number(btn.dataset.id);
    if (!this.targets.has(id)) return;

    this.onTargetHit(id, {
      clientX: ev.clientX,
      clientY: ev.clientY
    });
  }

  // ---------- TARGET LIFECYCLE ----------

  /**
   * สร้างเป้าขึ้นมาบนสนาม
   * engine จะส่ง target object เข้ามา (มี sizePx, bossPhase ฯลฯ)
   */
  spawnTarget(target) {
    if (!this.host) return;

    const xNorm = Math.random();
    const yNorm = Math.random() * 0.84 + 0.08; // เลี่ยงชิดขอบบน/ล่างเกินไป

    // เก็บใส่ target เพื่อส่งลง CSV ได้
    target.x_norm = xNorm;
    target.y_norm = yNorm;

    let size = target.sizePx || 110;

// ถ้าเป็น boss-face ให้บังคับอย่างน้อย ~180px
if (target.isBossFace && size < 180) {
  size = 180;
}


    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.id = String(target.id);
    el.setAttribute('aria-label', 'target');

    const cls = ['sb-target', `sb-diff-${this.diffKey}`];

    if (target.isBossFace) cls.push('sb-target--bossface');
    if (target.isHeal) cls.push('sb-target--heal');
    if (target.isShield) cls.push('sb-target--shield');
    if (target.isBomb) cls.push('sb-target--bomb');

    el.className = cls.join(' ');

    // โครงสร้างตรงกับ shadow-breaker.css เดิม
    el.innerHTML = `
      <div class="sb-target-inner">
        <div class="sb-bubble-core"></div>
        <div class="sb-ring"></div>
        <div class="sb-target-emoji">${this._emojiForTarget(target)}</div>
      </div>
    `;

    Object.assign(el.style, {
      position: 'absolute',
      width: size + 'px',
      height: size + 'px',
      left: xNorm * 100 + '%',
      top: yNorm * 100 + '%',
      transform: 'translate(-50%, -50%) scale(0.8)',
      opacity: '0',
      pointerEvents: 'auto'
    });

    this.host.appendChild(el);

    // animate in (ใช้ class sb-target--spawned ตาม CSS)
    requestAnimationFrame(() => {
      el.classList.add('sb-target--spawned');
    });

    this.targets.set(target.id, { el, data: target });
  }

  /**
   * เอฟเฟ็กต์ตอนตีโดน (engine จะเป็นคนลบเป้าเองผ่าน removeTarget)
   */
  playHitFx(id, info = {}) {
    const rec = this.targets.get(id);
    if (!rec) return;

    const { grade, scoreDelta, fxEmoji, clientX, clientY } = info;

    let sx = clientX;
    let sy = clientY;
    if (typeof sx !== 'number' || typeof sy !== 'number') {
      const rect = rec.el.getBoundingClientRect();
      sx = rect.left + rect.width / 2;
      sy = rect.top + rect.height / 2;
    }

    this._spawnBurstAtScreen(sx, sy, grade, fxEmoji);
    if (scoreDelta && scoreDelta !== 0) {
      this._spawnScoreFx(sx, sy - 10, scoreDelta, grade);
    }

    rec.el.classList.add('sb-target-hit');
    setTimeout(() => rec.el.classList.remove('sb-target-hit'), 180);
  }

  /**
   * ลบเป้าจากจอ เมื่อหมดเวลา / ตีโดน / เปลี่ยนบอส ฯลฯ
   */
  removeTarget(id, reason = 'timeout') {
    const rec = this.targets.get(id);
    if (!rec) return;

    const el = rec.el;
    if (reason === 'timeout') {
      el.classList.add('sb-target-timeout');
    } else {
      el.classList.add('sb-target-hide');
    }

    setTimeout(() => el.remove(), 220);
    this.targets.delete(id);
  }

  // ---------- FX HELPERS ----------

  _spawnBurstAtScreen(x, y, grade, fxEmoji) {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const frag = document.createElement('div');
      frag.className = 'sb-frag';

      const size = 6 + Math.random() * 6;
      const ang = (i / n) * Math.PI * 2;
      const dist = 34 + Math.random() * 26;

      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      Object.assign(frag.style, {
        position: 'fixed',
        left: x + 'px',
        top: y + 'px',
        width: size + 'px',
        height: size + 'px',
        transform: 'translate(-50%, -50%)',
        opacity: '1'
      });

      const hueBase =
        grade === 'perfect'
          ? 150
          : grade === 'good'
          ? 200
          : grade === 'bomb'
          ? 5
          : grade === 'heal'
          ? 130
          : grade === 'shield'
          ? 230
          : 45;

      frag.style.background = `radial-gradient(circle at 30% 30%, hsl(${hueBase},100%,85%), hsl(${hueBase},90%,55%))`;
      frag.style.boxShadow = `0 0 8px hsla(${hueBase},100%,70%,.9)`;

      document.body.appendChild(frag);

      requestAnimationFrame(() => {
        frag.style.transform =
          `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`;
        frag.style.opacity = '0';
      });

      setTimeout(() => frag.remove(), 260);
    }

    // flash เล็ก ๆ ตอนโดน bomb
    if (grade === 'bomb' && this.flashEl) {
      this.flashEl.classList.add('sb-flash-on');
      setTimeout(() => this.flashEl.classList.remove('sb-flash-on'), 140);
    }
  }

  _spawnScoreFx(x, y, scoreDelta, grade) {
    const el = document.createElement('div');
    el.className = `sb-score-fx ${grade || ''}`;

    const sign = scoreDelta > 0 ? '+' : '';
    el.textContent = sign + scoreDelta;

    Object.assign(el.style, {
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, 0)'
    });

    document.body.appendChild(el);

    // ให้ transition ทำงาน
    requestAnimationFrame(() => {
      el.classList.add('active');
      el.style.transform = 'translate(-50%, -24px)';
      el.style.opacity = '1';
    });

    setTimeout(() => {
      el.style.opacity = '0';
    }, 450);

    setTimeout(() => el.remove(), 900);
  }
}
