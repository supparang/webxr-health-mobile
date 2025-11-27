// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-03) ===
'use strict';

/**
 * เรนเดอร์เป้า / เอฟเฟ็กต์ทั้งหมดใน DOM สำหรับ Shadow Breaker
 * - host = element สนาม (เช่น #target-layer)
 * - onTargetHit(id, {clientX, clientY}) callback กลับไปที่ engine
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

    /** mapping targetId -> { el, data } */
    this.targets = new Map();
    this.diffKey = 'normal';

    // ให้สนามเป็น relative ป้องกันตำแหน่งเพี้ยน
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
    if (t.type === 'bomb') return '💣';
    if (t.type === 'heal') return '💚';
    if (t.type === 'shield') return '🛡️';
    if (t.type === 'decoy') return '🎯';
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
   * engine จะส่ง object target เข้ามา
   * - มี id, sizePx, bossPhase, type ฯลฯ
   */
  spawnTarget(target) {
    if (!this.host) return;

    // สุ่มตำแหน่งแบบ normalized (0–1) แล้วเก็บกลับไปใช้ใน CSV ได้
    const xNorm = Math.random();           // ทั้งแนวกว้าง
    const yNorm = Math.random() * 0.82 + 0.09; // เว้นขอบบนล่างเล็กน้อย

    target.x_norm = xNorm;
    target.y_norm = yNorm;

    const size = target.sizePx || 110;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = [
      'sb-target',
      `sb-phase-${target.bossPhase || 1}`,
      `sb-diff-${this.diffKey}`
    ].join(' ');
    el.dataset.id = String(target.id);
    el.setAttribute('aria-label', 'target');

    // โครงสร้างตรงกับ shadow-breaker.css
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
      left: (xNorm * 100) + '%',
      top: (yNorm * 100) + '%',
      transform: 'translate(-50%, -50%) scale(0.8)',
      opacity: '0',
      pointerEvents: 'auto'
    });

    // สไตล์ emoji ให้ลอยอยู่กลางฟอง
    const emo = el.querySelector('.sb-target-emoji');
    if (emo) {
      Object.assign(emo.style, {
        position: 'absolute',
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
        pointerEvents: 'none'
      });
    }

    this.host.appendChild(el);

    // spawn animation (ใช้ class เดียวกับใน CSS: .sb-target--spawned)
    requestAnimationFrame(() => {
      el.classList.add('sb-target--spawned');
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    this.targets.set(target.id, { el, data: target });
  }

  /**
   * เอฟเฟ็กต์ตอนตีโดน (engine เป็นคนลบเป้าโดยเรียก removeTarget)
   */
  playHitFx(id, info = {}) {
    const rec = this.targets.get(id);
    if (!rec) return;

    const { grade, scoreDelta, fxEmoji, clientX, clientY } = info;

    let cx = clientX;
    let cy = clientY;

    if (typeof cx !== 'number' || typeof cy !== 'number') {
      const rect = rec.el.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    }

    // แตกกระจาย
    this._spawnBurstAtScreen(cx, cy, grade, fxEmoji);

    // คะแนนเด้งตรงเป้า
    if (scoreDelta && scoreDelta !== 0) {
      this._spawnScoreBubble(cx, cy - 12, scoreDelta, grade);
    }

    // scale เล็กน้อยตอนโดน
    rec.el.classList.add('sb-target-hit');
    setTimeout(() => rec.el.classList.remove('sb-target-hit'), 160);
  }

  /**
   * ลบเป้าออกจากจอ
   */
  removeTarget(id, reason = 'timeout') {
    const rec = this.targets.get(id);
    if (!rec) return;

    const el = rec.el;

    if (reason === 'timeout') {
      el.classList.remove('sb-target--spawned');
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%) scale(0.9)';
    } else {
      el.classList.remove('sb-target--spawned');
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%) scale(0.7)';
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
      const dist = 32 + Math.random() * 24;
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
        grade === 'perfect' ? 145 :
        grade === 'good'    ? 200 :
        grade === 'bomb'    ? 8   :
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
    // ใช้คลาสเดียวกับ CSS: .sb-score-fx + .good/.perfect/.bad/.miss
    const g = grade || (scoreDelta > 0 ? 'good' : 'miss');
    el.className = `sb-score-fx ${g}`;

    const sign = scoreDelta > 0 ? '+' : '';
    el.textContent = sign + scoreDelta;

    Object.assign(el.style, {
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, 0)'
    });

    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add('active');
      el.style.transform = 'translate(-50%, -40px)';
    });

    setTimeout(() => {
      el.classList.remove('active');
      el.style.opacity = '0';
    }, 450);

    setTimeout(() => el.remove(), 900);
  }
}
