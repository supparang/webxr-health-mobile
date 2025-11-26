// === js/dom-renderer.js — Shadow Breaker DOM target renderer (2025-11-30b) ===
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
    el.style.transform = 'translate(-50%, -50%)';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';

    // 🔎 ขยาย emoji ตามขนาดเป้า (ใหญ่ขึ้นชัดเจน)
    // 0.6–0.7 ของเส้นผ่านศูนย์กลางจะดูเต็มแต่ไม่ล้น
    const emojiFontPx = Math.round(size * 0.65);
    inner.style.fontSize = emojiFontPx + 'px';

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

    // รองรับทั้ง pointer / click
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

  // เอฟเฟ็กต์คะแนน + ชิ้นเป้าแตก ที่ "จุดกลางของเป้า"
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

    // ชิ้นเป้าแตกกระจายเล็ก ๆ
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
