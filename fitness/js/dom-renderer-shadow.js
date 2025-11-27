// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-02) ===
'use strict';

export class DomRendererShadow {
  /**
   * host  = element เขต gameplay (เช่น #target-layer)
   * opts.wrapEl    = element ครอบทั้งเกม (ใช้ใส่ class effect)
   * opts.onTargetHit(id, info) = callback จาก engine เวลาเป้าถูกตี
   */
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.wrapEl = opts.wrapEl || document.body;
    this.onTargetHit = typeof opts.onTargetHit === 'function'
      ? opts.onTargetHit
      : null;

    this.targets = new Map();
    this.diffKey = 'normal';
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  /**
   * สร้าง DOM เป้า 1 อัน
   * target: {
   *   id, type, bossIndex, bossPhase, sizePx, zone_lr, zone_ud, ...
   * }
   */
  spawnTarget(target) {
    if (!this.host) return;

    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const size = target.sizePx || 96;
    const margin = size * 0.6;

    // สุ่มตำแหน่งภายใน host (absolute ภายใน host)
    const xLocal = margin + Math.random() * Math.max(1, rect.width - margin * 2);
    const yLocal = margin + Math.random() * Math.max(1, rect.height - margin * 2);

    // normalize ลงตัวแปรสำหรับ CSV
    const xNorm = rect.width > 0 ? xLocal / rect.width : 0.5;
    const yNorm = rect.height > 0 ? yLocal / rect.height : 0.5;
    target.x_norm = +xNorm.toFixed(4);
    target.y_norm = +yNorm.toFixed(4);

    // === DOM structure ===
    // <button class="sb-target sb-target-phase-1" data-id="..." ...>
    //   <span class="sb-target-ring"></span>
    //   <span class="sb-target-emoji">🎯</span>
    // </button>

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sb-target';
    btn.dataset.id = String(target.id);
    btn.dataset.type = target.type;
    btn.dataset.phase = String(target.bossPhase);
    btn.dataset.boss = String(target.bossIndex);
    btn.dataset.diff = this.diffKey;

    // phase class สำหรับ ring color cycle
    btn.classList.add(`sb-target-phase-${target.bossPhase || 1}`);

    // ขนาด + ตำแหน่ง (absolute ภายใน host)
    Object.assign(btn.style, {
      position: 'absolute',
      width: size + 'px',
      height: size + 'px',
      left: xLocal + 'px',
      top: yLocal + 'px',
      transform: 'translate(-50%, -50%) scale(0.85)',
      border: 'none',
      background: 'transparent',
      padding: '0',
      cursor: 'pointer'
    });

    // ===== ring =====
    const ring = document.createElement('span');
    ring.className = 'sb-target-ring';
    btn.appendChild(ring);

    // ===== emoji =====
    const emoSpan = document.createElement('span');
    emoSpan.className = 'sb-target-emoji';
    emoSpan.textContent = this._pickEmoji(target);
    btn.appendChild(emoSpan);

    // pop-in animation
    requestAnimationFrame(() => {
      btn.classList.add('sb-target-enter');
    });

    // event hit
    const hitHandler = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const bounds = btn.getBoundingClientRect();
      const cx = bounds.left + bounds.width / 2;
      const cy = bounds.top + bounds.height / 2;

      if (this.onTargetHit) {
        this.onTargetHit(target.id, {
          clientX: cx,
          clientY: cy,
          rawEvent: ev
        });
      }
    };

    btn.addEventListener('click', hitHandler);
    btn.addEventListener('touchstart', hitHandler, { passive: false });

    // เก็บ reference ไว้ลบ / ทำ effect ตอน hit
    this.targets.set(target.id, {
      el: btn,
      target,
      hitHandler
    });

    // host ต้องเป็น position: relative ใน CSS
    this.host.appendChild(btn);
  }

  /**
   * ลบเป้าออกจาก DOM
   * reason: 'hit' | 'timeout' | 'boss-change' | 'end'
   */
  removeTarget(id, reason) {
    const entry = this.targets.get(id);
    if (!entry) return;

    const { el, hitHandler } = entry;
    el.removeEventListener('click', hitHandler);
    el.removeEventListener('touchstart', hitHandler);

    // ให้มี exit animation เล็กน้อย
    el.classList.add('sb-target-exit');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 140);

    this.targets.delete(id);
  }

  /**
   * effect ตอนตีโดน
   * info: { grade, scoreDelta, fxEmoji, clientX, clientY }
   */
  playHitFx(id, info = {}) {
    const entry = this.targets.get(id);
    if (!entry) return;
    const { el } = entry;

    // ให้เป้าดีดนิดนึง
    el.classList.add('sb-target-hit');

    // แสดง emoji ระเบิด/ดาวเล็ก ๆ
    if (info.fxEmoji) {
      this._spawnFxEmoji(el, info.fxEmoji);
    }

    // คะแนนเด้งตรงเป้า (แต่แยกจาก PERFECT/GOOD ที่ engine ทำ)
    if (typeof info.scoreDelta === 'number' && info.scoreDelta > 0) {
      this._spawnScoreFx(el, info.scoreDelta);
    }
  }

  // ---------- internal helpers ----------

  _pickEmoji(t) {
    if (t.isBossFace || t.type === 'bossface') {
      // boss ตาม index
      const bossEmo = ['🐣', '🌀', '🤖', '💀'];
      return bossEmo[t.bossIndex] || '💀';
    }
    if (t.isBomb || t.type === 'bomb')   return '💣';
    if (t.isHeal || t.type === 'heal')   return '💚';
    if (t.isShield || t.type === 'shield') return '🛡️';
    if (t.isDecoy || t.type === 'decoy') return '👻';
    // normal
    return '🎯';
  }

  _spawnFxEmoji(el, emo) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const fx = document.createElement('div');
    fx.textContent = emo;
    Object.assign(fx.style, {
      position: 'fixed',
      left: cx + 'px',
      top: cy + 'px',
      transform: 'translate(-50%, -50%) scale(1)',
      fontSize: '28px',
      pointerEvents: 'none',
      zIndex: 1000,
      opacity: 1,
      textShadow: '0 0 10px rgba(0,0,0,.8)',
      transition: 'transform .45s ease-out, opacity .45s ease-out'
    });

    document.body.appendChild(fx);
    requestAnimationFrame(() => {
      fx.style.transform = 'translate(-50%, -120%) scale(1.1)';
      fx.style.opacity = '0';
    });
    setTimeout(() => fx.remove(), 480);
  }

  _spawnScoreFx(el, delta) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2 + 18; // ให้ต่ำกว่า PERFECT นิดนึง

    const scoreEl = document.createElement('div');
    scoreEl.textContent = '+' + delta;
    Object.assign(scoreEl.style, {
      position: 'fixed',
      left: cx + 'px',
      top: cy + 'px',
      transform: 'translate(-50%, -50%) scale(1)',
      fontSize: '16px',
      fontWeight: '700',
      color: '#facc15',
      pointerEvents: 'none',
      zIndex: 1000,
      textShadow: '0 0 8px rgba(0,0,0,.85)',
      opacity: 1,
      transition: 'transform .55s ease-out, opacity .55s ease-out'
    });

    document.body.appendChild(scoreEl);
    requestAnimationFrame(() => {
      // ให้เด้งเฉียงขึ้นไปข้างขวา เพื่อลดการทับ PERFECT/GOOD
      scoreEl.style.transform = 'translate(-10%, -140%) scale(1.05)';
      scoreEl.style.opacity = '0';
    });
    setTimeout(() => scoreEl.remove(), 600);
  }
}
