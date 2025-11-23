// === js/dom-renderer.js — DOM renderer for Shadow Breaker (2025-11-24) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts) {
    this.game = game;
    this.host = host;
    this.sizePx = (opts && opts.sizePx) || 100;

    this.targets = new Map(); // id -> { el, x, y }

    this._rect = null;
    this._resizeHandler = this.updateRect.bind(this);
    window.addEventListener('resize', this._resizeHandler);
    this.updateRect();
  }

  updateRect() {
    if (!this.host) return;
    var r = this.host.getBoundingClientRect();
    this._rect = {
      left: r.left,
      top: r.top,
      width: r.width || (this.host.clientWidth || 1),
      height: r.height || (this.host.clientHeight || 1)
    };
  }

  clear() {
    if (!this.host) return;
    this.targets.clear();
    while (this.host.firstChild) {
      this.host.removeChild(this.host.firstChild);
    }
  }

  // สุ่มตำแหน่งเป้า (เว้นขอบนิดหน่อย)
  _randomPos(sizePx) {
    this.updateRect();
    var w = (this._rect && this._rect.width) || 1;
    var h = (this._rect && this._rect.height) || 1;

    var marginX = sizePx * 0.6;
    var marginY = sizePx * 0.6;

    var x = marginX + Math.random() * (w - marginX * 2);
    var y = marginY + Math.random() * (h - marginY * 2);

    return { x: x, y: y, x_norm: x / w, y_norm: y / h };
  }

  spawnTarget(t) {
    if (!this.host) return;

    var size = t.size_px || this.sizePx;

    var pos = this._randomPos(size);
    t.x_norm = pos.x_norm;
    t.y_norm = pos.y_norm;

    // สร้าง DOM
    var outer = document.createElement('div');
    outer.className = 'sb-target';
    outer.style.width = size + 'px';
    outer.style.height = size + 'px';
    outer.style.left = pos.x + 'px';
    outer.style.top = pos.y + 'px';
    outer.dataset.id = String(t.id);
    if (t.decoy) outer.dataset.type = 'bad';
    if (t.bossFace) outer.setAttribute('data-boss-face', '1');

    var inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🥊';
    outer.appendChild(inner);

    // handler เมื่อแตะ/คลิกเป้า
    var self = this;
    var onPtr = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      // แปลงเป็นพิกัดภายใน field (px)
      self.updateRect();
      var rect = self._rect;
      var clientX = ev.clientX;
      var clientY = ev.clientY;
      if (ev.touches && ev.touches.length) {
        clientX = ev.touches[0].clientX;
        clientY = ev.touches[0].clientY;
      }
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      self.game.registerTouch(x, y, t.id);
    };

    outer.addEventListener('pointerdown', onPtr);
    outer.addEventListener('touchstart', onPtr);

    this.host.appendChild(outer);
    this.targets.set(t.id, {
      el: outer,
      x: pos.x,
      y: pos.y
    });
  }

  removeTarget(t) {
    var entry = this.targets.get(t.id);
    if (!entry || !entry.el) return;

    var el = entry.el;
    this.targets.delete(t.id);

    // ทำอนิเมชันหดแล้วค่อยลบ
    el.classList.add('sb-hit');
    setTimeout(function () {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 230);
  }

  // เอฟเฟกต์ตอนโดน / miss / bomb
  spawnHitEffect(t, info) {
    if (!this.host) return;
    info = info || {};

    this.updateRect();
    var rect = this._rect || { width: this.host.clientWidth, height: this.host.clientHeight };

    var entry = this.targets.get(t.id);
    var x = entry ? entry.x : null;
    var y = entry ? entry.y : null;

    // ถ้า target ถูกลบไปแล้ว ให้ใช้ค่า normalized ที่เก็บไว้
    if (x == null || y == null) {
      if (typeof t.x_norm === 'number' && typeof t.y_norm === 'number') {
        x = t.x_norm * rect.width;
        y = t.y_norm * rect.height;
      } else {
        x = rect.width / 2;
        y = rect.height / 2;
      }
    }

    // popup คะแนน / ข้อความ
    var scoreEl = document.createElement('div');
    scoreEl.className = 'sb-fx-score';

    var grade = info.grade || '';
    var txt = '';

    if (info.decoy) {
      txt = (info.score != null ? info.score : -60) + ' (Bomb!)';
      scoreEl.classList.add('sb-decoy');
    } else if (info.miss) {
      txt = 'MISS';
      scoreEl.classList.add('sb-miss');
    } else if (grade === 'perfect') {
      txt = '+' + (info.score != null ? info.score : 0) + ' PERFECT';
      scoreEl.classList.add('sb-perfect');
    } else if (grade === 'good') {
      txt = '+' + (info.score != null ? info.score : 0) + ' GOOD';
      scoreEl.classList.add('sb-good');
    } else {
      txt = (info.score != null && info.score !== 0)
        ? (info.score > 0 ? '+' + info.score : String(info.score))
        : 'HIT';
    }

    scoreEl.textContent = txt;
    scoreEl.style.left = x + 'px';
    scoreEl.style.top = y + 'px';
    this.host.appendChild(scoreEl);

    setTimeout(function () {
      if (scoreEl.parentNode) scoreEl.parentNode.removeChild(scoreEl);
    }, 650);

    // particle emoji
    var particleEmoji = '💥';
    if (info.decoy) particleEmoji = '💣';
    else if (info.miss) particleEmoji = '💢';

    spawnHitParticle(this.host, x, y, particleEmoji);
  }
}
