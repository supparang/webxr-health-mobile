// === js/dom-renderer.js — Shadow Breaker DOM target renderer (2025-11-30b) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(field, opts = {}) {
    this.field = field || document.body;
    this.opts = opts;
    this.targets = new Map();
    this.diffKey = 'normal';
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  _ensureFieldRect() {
    if (!this.field) {
      return { width: 1, height: 1, left: 0, top: 0 };
    }
    const rect = this.field.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return {
        width: this.field.clientWidth || 1,
        height: this.field.clientHeight || 1,
        left: 0,
        top: 0
      };
    }
    return rect;
  }

  // ===================== SPAWN TARGET =====================
  // สุ่มเป้าให้อยู่ "ในกรอบสนามจริง" ไม่หลุดขอบ
  spawnTarget(t) {
    if (!this.field || !t) return;

    const rect = this._ensureFieldRect();
    const w = rect.width;
    const h = rect.height;

    const size = t.sizePx || 120;

    // buffer สำหรับขอบใน + ring (::before inset -6px) + shadow
    const padding = 12;      // ห่างขอบใน
    const ringPad = 8;       // พื้นที่ให้ ring/เงาไม่โดนตัด
    const pad = padding + ringPad;

    // x,y ที่นี่คือ "left/top" ของปุ่ม ไม่ใช่ center
    const minX = pad;
    const minY = pad;
    const maxX = Math.max(minX, w - size - pad);
    const maxY = Math.max(minY, h - size - pad);

    const left = minX + Math.random() * (maxX - minX || 1);
    const top  = minY + Math.random() * (maxY - minY || 1);

    // เก็บตำแหน่งศูนย์กลางแบบ 0..1 ไว้ให้ engine / CSV
    const cx = left + size / 2;
    const cy = top  + size / 2;
    t.x_norm = +(cx / w).toFixed(4);
    t.y_norm = +(cy / h).toFixed(4);

    const el = document.createElement('button');
    el.type = 'button';
    el.className =
      'sb-target ' +
      `sb-target--${t.type || 'normal'} ` +
      `sb-target--diff-${this.diffKey || 'normal'}`;
    el.style.position = 'absolute';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = left + 'px';
    el.style.top  = top + 'px';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = this._emojiFor(t);
    el.appendChild(inner);

    const handleHit = (ev) => {
      ev.stopPropagation();
      if (this.opts.onTargetHit) {
        this.opts.onTargetHit(t.id, {
          clientX: ev.clientX,
          clientY: ev.clientY
        });
      }
    };

    // รองรับ pointer / click (เมาส์, touch, VR pointer)
    el.addEventListener('pointerdown', handleHit);
    el.addEventListener('click', handleHit);

    this.field.appendChild(el);
    this.targets.set(t.id, el);
  }

  _emojiFor(t) {
    if (t.isBomb)     return '💣';
    if (t.isHeal)     return '💚';
    if (t.isShield)   return '🛡️';
    if (t.isBossFace) return '👑';
    if (t.isDecoy)    return '🎯';
    return '🎯';
  }

  removeTarget(id, reason = 'end') {
    const el = this.targets.get(id);
    if (!el) return;

    if (reason === 'hit') {
      el.classList.add('sb-target--hit');
      setTimeout(() => el.remove(), 160);
    } else if (reason === 'timeout') {
      el.classList.add('sb-target--fade-timeout');
      setTimeout(() => el.remove(), 200);
    } else {
      el.classList.add('sb-target--fade-soft');
      setTimeout(() => el.remove(), 160);
    }

    this.targets.delete(id);
  }

  // ===================== HIT FX =====================
  // เอฟเฟกต์คะแนน + เป้าแตก + particle ที่จุดเป้า
  playHitFx(id, info = {}) {
    if (!this.field) return;

    const hostRect = this._ensureFieldRect();
    let screenX = info.clientX ?? null;
    let screenY = info.clientY ?? null;

    const targetEl = this.targets.get(id);
    if ((screenX == null || screenY == null) && targetEl) {
      const r = targetEl.getBoundingClientRect();
      screenX = r.left + r.width / 2;
      screenY = r.top  + r.height / 2;
    }
    if (screenX == null || screenY == null) return;

    // แปลงเป็นพิกัดภายใน field
    const x = screenX - hostRect.left;
    const y = screenY - hostRect.top;

    const grade   = info.grade || 'good';
    const score   = info.scoreDelta ?? 0;
    const fxEmoji = info.fxEmoji || '⭐';

    const pop = document.createElement('div');
    pop.className = 'sb-pop';

    if (grade === 'perfect')      pop.classList.add('sb-pop--perfect');
    else if (grade === 'good')    pop.classList.add('sb-pop--good');
    else if (grade === 'bad')     pop.classList.add('sb-pop--bad');
    else if (grade === 'miss')    pop.classList.add('sb-pop--miss');
    else if (grade === 'bomb')    pop.classList.add('sb-pop--bomb');
    else if (grade === 'heal')    pop.classList.add('sb-pop--heal');
    else if (grade === 'shield')  pop.classList.add('sb-pop--shield');

    let label = '';
    if (grade === 'perfect')      label = `PERFECT +${score}`;
    else if (grade === 'good')    label = `GOOD +${score}`;
    else if (grade === 'bad')     label = `LATE +${score}`;
    else if (grade === 'bomb')    label = 'BOMB!';
    else if (grade === 'heal')    label = `HEAL +${score}`;
    else if (grade === 'shield')  label = `SHIELD +${score}`;
    else if (grade === 'miss')    label = 'MISS';
    else                          label = `+${score}`;

    pop.textContent = `${fxEmoji} ${label}`;
    pop.style.left = x + 'px';
    pop.style.top  = y + 'px';

    this.field.appendChild(pop);
    setTimeout(() => pop.remove(), 650);

    // ชิ้นเป้าแตกกระจาย
    for (let i = 0; i < 10; i++) {
      const shard = document.createElement('div');
      shard.className = 'sb-hit-shard';
      const angle = Math.random() * Math.PI * 2;
      const dist  = 32 + Math.random() * 28;
      shard.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      shard.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      shard.style.left = x + 'px';
      shard.style.top  = y + 'px';
      this.field.appendChild(shard);
      setTimeout(() => shard.remove(), 500);
    }

    // extra particle emoji
    spawnHitParticle(this.field, {
      x,
      y,
      emoji: fxEmoji === '💣' ? '💥' : '✨',
      count: grade === 'perfect' ? 8 : 5,
      spread: 48,
      lifeMs: 520,
      className: 'sb-hit-particle'
    });

    // เสียงตีเป้า
    if (window.SFX?.play) {
      const vol = grade === 'perfect' ? 1.0 : grade === 'good' ? 0.8 : 0.6;
      window.SFX.play('hit', {
        group: 'hit',
        intensity: vol,
        baseVolume: 0.9
      });
    }
  }
}
