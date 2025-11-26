// === js/dom-renderer.js — Shadow Breaker DOM target renderer (2025-11-30a) ===
'use strict';

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

  // สุ่มตำแหน่งเป้าในสนาม + ไม่หลุดขอบ
  spawnTarget(t) {
    if (!this.field || !t) return;

    const rect = this._ensureFieldRect();
    const size = t.sizePx || 120;
    const margin = size * 0.5 + 8;

    const w = rect.width;
    const h = rect.height;

    const minX = margin;
    const maxX = Math.max(margin, w - margin);
    const minY = margin;
    const maxY = Math.max(margin, h - margin);

    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);

    // เก็บค่าปกติ 0..1 ไว้ให้ engine log ลง CSV
    t.x_norm = +(x / w).toFixed(4);
    t.y_norm = +(y / h).toFixed(4);

    const el = document.createElement('button');
    el.type = 'button';
    el.className =
      'sb-target ' +
      `sb-target--${t.type || 'normal'} ` +
      `sb-target--diff-${this.diffKey || 'normal'}`;
    el.style.position = 'absolute';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = this._emojiFor(t);

    // ทำให้ emoji ใหญ่ตามขนาดเป้า (แก้ “ตัวเล็กมาก”)
    const fontSize = Math.max(26, size * 0.42);
    inner.style.fontSize = fontSize + 'px';

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

    // รองรับทั้ง click / touch / mouse / VR pointer
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

  // เอฟเฟ็กต์คะแนน + ชิ้นเป้าแตกที่ "จุดกลางของเป้า"
  playHitFx(id, info = {}) {
    if (!this.field) return;
    const hostRect = this._ensureFieldRect();

    let screenX = info.clientX ?? null;
    let screenY = info.clientY ?? null;

    // fallback: เอาจุดกลางของ DOM เป้า
    const targetEl = this.targets.get(id);
    if ((screenX == null || screenY == null) && targetEl) {
      const r = targetEl.getBoundingClientRect();
      screenX = r.left + r.width / 2;
      screenY = r.top + r.height / 2;
    }

    if (screenX == null || screenY == null) return;

    const x = screenX - hostRect.left;
    const y = screenY - hostRect.top;

    const grade     = info.grade || 'good';
    const score     = info.scoreDelta ?? 0;
    const fxEmoji   = info.fxEmoji || '⭐';

    // ===== POPUP คะแนนตรงเป้า =====
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

    // ===== ชิ้นเป้าแตกกระจายรอบจุดกลาง =====
    for (let i = 0; i < 10; i++) {
      const shard = document.createElement('div');
      shard.className = 'sb-hit-shard';
      const angle = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 28;
      shard.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      shard.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      shard.style.left = x + 'px';
      shard.style.top  = y + 'px';
      this.field.appendChild(shard);
      setTimeout(() => shard.remove(), 500);
    }

    // ===== particle emoji เพิ่มเติม (ใช้ฟังก์ชันด้านล่าง) =====
    spawnHitParticle(this.field, {
      x,
      y,
      emoji: fxEmoji,
      count: 6,
      spread: 46,
      lifeMs: 520,
      className: 'sb-hit-particle'
    });

    // เสียงตีเป้า (ใช้ SFX เดิม)
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

/* === js/particle.js — DOM hit particle FX (ฝังรวมในไฟล์นี้) === */

export function spawnHitParticle(host, options = {}) {
  if (!host) return;

  const {
    x,
    y,
    pos,
    emoji = '✨',
    count = 5,
    spread = 36,
    lifeMs = 480,
    className = ''
  } = options;

  const rect = host.getBoundingClientRect();
  const baseX = (x != null ? x : (pos && pos.x != null ? pos.x : rect.width / 2));
  const baseY = (y != null ? y : (pos && pos.y != null ? pos.y : rect.height / 2));

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'hitParticle';
    if (className) el.classList.add(className);

    // random offset รอบจุดกลาง
    const dx = (Math.random() - 0.5) * spread;
    const dy = (Math.random() - 0.5) * spread;

    el.style.left = (baseX + dx) + 'px';
    el.style.top  = (baseY + dy) + 'px';
    el.textContent = emoji;

    host.appendChild(el);

    // cleanup ตามอายุอนิเมชัน
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, lifeMs);
  }
}

export const Particles = {
  burstHit(host, pos, opts = {}) {
    spawnHitParticle(host, {
      pos,
      emoji: opts.emoji || '✨',
      count: opts.count || 5,
      spread: opts.spread || 40,
      lifeMs: opts.lifeMs || 480,
      className: opts.className || ''
    });
  }
};
