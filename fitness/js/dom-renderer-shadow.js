// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-04) ===
'use strict';

/**
 * เรนเดอร์เป้า / เอฟเฟ็กต์ทั้งหมดใน DOM สำหรับ Shadow Breaker
 * - host = element ของสนาม (เช่น #target-layer)
 * - onTargetHit(id, {clientX, clientY}) callback กลับไปที่ engine
 */
export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.wrapEl = opts.wrapEl || this.host;
    this.flashEl = opts.flashEl || null;
    this.feedbackEl = opts.feedbackEl || null;
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

    // random ตำแหน่งแบบ normalized เก็บลง target ด้วย
    const xNorm = Math.random();
    const yNorm = Math.random() * 0.84 + 0.08; // เลี่ยงชิดขอบบน/ล่างเกินไป
    target.x_norm = xNorm;
    target.y_norm = yNorm;

    const size = target.sizePx || 110;

    const el = document.createElement('button');
    el.type = 'button';

    const extraClasses = [];
    if (target.isBossFace) extraClasses.push('sb-target--bossface');
    if (target.isHeal) extraClasses.push('sb-target--heal');
    if (target.isShield) extraClasses.push('sb-target--shield');
    if (target.isBomb) extraClasses.push('sb-target--bomb');
    // decoy ใช้สี default

    el.className = [
      'sb-target',
      ...extraClasses,
      `sb-phase-${target.bossPhase || 1}`,
      `sb-diff-${this.diffKey}`
    ].join(' ');

    el.dataset.id = String(target.id);
    el.setAttribute('aria-label', 'target');

    // โครงสร้างให้ตรง CSS: .sb-target-inner + .sb-bubble-core + .sb-ring
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

    const emojiSpan = el.querySelector('.sb-target-emoji');
    if (emojiSpan) {
      Object.assign(emojiSpan.style, {
        position: 'absolute',
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.5) + 'px',
        textShadow: '0 0 8px rgba(15,23,42,0.9)',
        pointerEvents: 'none'
      });
    }

    this.host.appendChild(el);

    // ให้ CSS .sb-target--spawned ทำงาน (opacity 1 + scale 1)
    requestAnimationFrame(() => {
      el.classList.add('sb-target--spawned');
    });

    this.targets.set(target.id, { el, data: target });
  }

  /**
   * เอฟเฟ็กต์ตอนตีโดน (แต่ไม่ลบเป้าในนี้ ให้ engine เป็นคนสั่ง removeTarget)
   */
  playHitFx(id, info = {}) {
    const rec = this.targets.get(id);
    if (!rec) return;

    const { grade, scoreDelta, clientX, clientY } = info;

    let baseX = null;
    let baseY = null;

    if (typeof clientX === 'number' && typeof clientY === 'number') {
      baseX = clientX;
      baseY = clientY;
    } else {
      const rect = rec.el.getBoundingClientRect();
      baseX = rect.left + rect.width / 2;
      baseY = rect.top + rect.height / 2;
    }

    // เอฟเฟ็กต์แตกกระจาย
    this._spawnBurstAtScreen(baseX, baseY, grade);

    // คะแนนเด้ง (+ / -)
    if (typeof scoreDelta === 'number' && scoreDelta !== 0) {
      this._spawnScoreBubble(baseX, baseY - 8, scoreDelta, grade);
    }

    // scale เป้าขึ้นเล็กน้อย
    rec.el.style.transform = 'translate(-50%, -50%) scale(1.05)';
    setTimeout(() => {
      rec.el.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 120);
  }

  /**
   * ลบเป้าจากจอ เมื่อหมดเวลา / ตีโดน / เปลี่ยนบอส ฯลฯ
   */
  removeTarget(id, reason = 'timeout') {
    const rec = this.targets.get(id);
    if (!rec) return;

    const el = rec.el;
    if (reason === 'timeout') {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%) scale(0.6)';
    } else {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%) scale(0.7)';
    }

    setTimeout(() => {
      el.remove();
    }, 220);

    this.targets.delete(id);
  }

  // ---------- FX HELPERS ----------

  _spawnBurstAtScreen(x, y, grade) {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const frag = document.createElement('div');
      frag.className = 'sb-frag';

      const size = 6 + Math.random() * 6;
      const ang = (i / n) * Math.PI * 2;
      const dist = 34 + Math.random() * 26;

      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      const hueBase =
        grade === 'perfect' ? 150 :
        grade === 'good'    ? 200 :
        grade === 'bomb'    ? 5   :
        grade === 'heal'    ? 130 :
        grade === 'shield'  ? 230 : 45;

      Object.assign(frag.style, {
        position: 'fixed',
        left: x + 'px',
        top: y + 'px',
        width: size + 'px',
        height: size + 'px',
        transform: 'translate(-50%, -50%)',
        opacity: '1',
        zIndex: 998,
        background: `radial-gradient(circle at 30% 30%, hsl(${hueBase},100%,85%), hsl(${hueBase},90%,55%))`,
        boxShadow: `0 0 8px hsla(${hueBase},100%,70%,.9)`
      });

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
    el.className = `sb-score-fx ${grade || ''}`;

    const sign = scoreDelta > 0 ? '+' : '';
    el.textContent = sign + scoreDelta;

    Object.assign(el.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%, 0)',
      opacity: '0',
      zIndex: 999
    });

    document.body.appendChild(el);

    // ให้ CSS transition ทำงาน
    requestAnimationFrame(() => {
      el.classList.add('active');
      el.style.transform = 'translate(-50%, -28px)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -40px)';
    }, 450);

    setTimeout(() => el.remove(), 900);
  }
}