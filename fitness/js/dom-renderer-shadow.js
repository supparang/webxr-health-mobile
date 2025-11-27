// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-03-b) ===
'use strict';

/**
 * Renderer สำหรับ Shadow Breaker
 * - สร้าง / ลบเป้าใน #target-layer
 * - ยิง callback onTargetHit(id, {clientX, clientY})
 */
export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.wrapEl = opts.wrapEl || this.host;
    this.flashEl = opts.flashEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function'
      ? opts.onTargetHit
      : () => {};

    this.targets = new Map();
    this.diffKey = 'normal';

    // ให้ field เป็น relative ถ้ายังไม่ได้ตั้ง
    if (this.host && getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }

    this._boundPointerHandler = this._handlePointer.bind(this);
    this.host.addEventListener('pointerdown', this._boundPointerHandler, { passive: false });
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
    if (t.isBossFace) return t.bossEmoji || '🥊';
    if (t.isBomb)     return '💣';
    if (t.isHeal)     return '💚';
    if (t.isShield)   return '🛡️';
    if (t.isDecoy)    return '🎯';
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
   * spawnTarget(target)
   * target: { id, sizePx, bossPhase, type, ... }
   */
  spawnTarget(target) {
    if (!this.host) return;

    // random position (เก็บ x_norm / y_norm ไว้ให้ engine ลง CSV)
    const xNorm = Math.random();
    const yNorm = Math.random() * 0.84 + 0.08; // เว้นขอบบนล่าง
    target.x_norm = xNorm;
    target.y_norm = yNorm;

    const size = target.sizePx || 110;

    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.id = String(target.id);
    el.setAttribute('aria-label', 'target');

    el.className = 'sb-target';

    // คลาสพิเศษตรงกับ CSS (.sb-target--heal / --shield / --bomb / --bossface)
    if (target.isHeal)     el.classList.add('sb-target--heal');
    if (target.isShield)   el.classList.add('sb-target--shield');
    if (target.isBomb)     el.classList.add('sb-target--bomb');
    if (target.isBossFace) el.classList.add('sb-target--bossface');

    // phase / diff เผื่ออยากใช้ใน CSS ภายหลัง
    el.classList.add(`sb-phase-${target.bossPhase || 1}`);
    el.classList.add(`sb-diff-${this.diffKey}`);

    // โครงสร้างภายในให้ match กับ shadow-breaker.css
    el.innerHTML = `
      <div class="sb-target-inner">
        <div class="sb-ring"></div>
        <div class="sb-bubble-core"></div>
        <div class="sb-target-emoji">${this._emojiForTarget(target)}</div>
      </div>
    `;

    Object.assign(el.style, {
      position: 'absolute',
      width: size + 'px',
      height: size + 'px',
      left: (xNorm * 100) + '%',
      top: (yNorm * 100) + '%',
      transform: 'translate(-50%, -50%) scale(0.8)',
      opacity: '0',
      pointerEvents: 'auto'
    });

    this.host.appendChild(el);

    // ให้ CSS .sb-target--spawned จัดการ transition (opacity / scale)
    requestAnimationFrame(() => {
      el.classList.add('sb-target--spawned');
    });

    this.targets.set(target.id, { el, data: target });
  }

  /**
   * เอฟเฟ็กต์ตอนตีโดน (engine จะเรียก)
   */
  playHitFx(id, info = {}) {
    const rec = this.targets.get(id);
    if (!rec) return;

    const { grade, scoreDelta, fxEmoji, clientX, clientY } = info;

    let x = clientX;
    let y = clientY;

    if (typeof x !== 'number' || typeof y !== 'number') {
      const rect = rec.el.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    // particle แตกกระจาย
    this._spawnBurstAtScreen(x, y, grade, fxEmoji);

    // คะแนนเด้ง (ไม่ทับ PERFECT / GOOD เพราะอันนั้น engine สร้างอีกตัว)
    if (scoreDelta && scoreDelta > 0) {
      this._spawnScoreBubble(x + 6, y - 12, scoreDelta, grade);
    }

    // scale นิดหน่อยให้รู้ว่าตีโดน
    rec.el.classList.add('sb-target-hit');
    setTimeout(() => rec.el.classList.remove('sb-target-hit'), 180);
  }

  /**
   * removeTarget(id, reason)
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
        grade === 'perfect' ? 150 :
        grade === 'good'    ? 200 :
        grade === 'bomb'    ? 5   :
        grade === 'heal'    ? 130 :
        grade === 'shield'  ? 230 : 45;

      frag.style.background =
        `radial-gradient(circle at 30% 30%, hsl(${hueBase},100%,85%), hsl(${hueBase},90%,55%))`;
      frag.style.boxShadow =
        `0 0 8px hsla(${hueBase},100%,70%,.9)`;

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

  _spawnScoreBubble(x, y, scoreDelta, grade) {
    const el = document.createElement('div');
    el.className = 'sb-score-fx';

    const sign = scoreDelta > 0 ? '+' : '';
    el.textContent = sign + scoreDelta;

    if (grade === 'perfect') el.classList.add('perfect');
    else if (grade === 'good') el.classList.add('good');
    else if (grade === 'bad') el.classList.add('bad');
    else if (grade === 'miss' || grade === 'bomb') el.classList.add('miss');

    Object.assign(el.style, {
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, -40%)',
    });

    document.body.appendChild(el);

    // trigger animation (.active ใช้คู่กับ transition ที่กำหนดใน CSS)
    requestAnimationFrame(() => {
      el.classList.add('active');
      el.style.transform = 'translate(-50%, -80%)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -110%)';
    }, 350);

    setTimeout(() => el.remove(), 800);
  }
}
