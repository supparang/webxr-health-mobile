// === /fitness/js/dom-renderer-shadow.js ===
// PACK G+ : raise targets upward + true safe-rect from HUD/BARS/META + grid slots + jitter
'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map(); // id -> { el, type, slotKey }
    this._onPointer = this._onPointer.bind(this);

    // cache refs for true safe rect
    this._hudEl = document.querySelector('.sb-hud');
    this._barsTopEl = document.querySelector('.sb-bars-top');
    this._barsBottomEl = document.querySelector('.sb-bars-bottom');
    this._metaEl = document.getElementById('sb-meta');

    // slot occupancy
    this._occupied = new Map(); // slotKey -> targetId
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, obj] of this.targets.entries()) {
      const el = obj?.el;
      try { el?.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el?.remove(); } catch {}
    }
    this.targets.clear();
    this._occupied.clear();
  }

  // --- helpers ---
  _emojiForType(t, bossEmoji){
    if (t === 'normal') return '🎯';
    if (t === 'decoy') return '👀';
    if (t === 'bomb') return '💣';
    if (t === 'heal') return '🩹';
    if (t === 'shield') return '🛡️';
    if (t === 'bossface') return bossEmoji || '👊';
    return '🎯';
  }

  _readCssSafeVars(){
    const cs = getComputedStyle(document.documentElement);
    const n = (k, d)=> {
      const v = Number.parseFloat(cs.getPropertyValue(k));
      return Number.isFinite(v) ? v : d;
    };
    return {
      padBase: n('--sb-safe-pad', 16),
      padTop:  n('--sb-safe-top', 12),
      padSide: n('--sb-safe-side', 12),
      padBot:  n('--sb-safe-bot', 14),
    };
  }

  // ✅ ยกพื้นที่ spawn ขึ้นบน: ลดความรู้สึกว่าเป้าไปกองล่าง
  _safeRectViewport(){
    const layerR = this.layer.getBoundingClientRect();
    const { padBase, padTop, padSide, padBot } = this._readCssSafeVars();

    // baseline padding (inside the stage)
    const pad = Math.min(44, Math.max(padBase, layerR.width * 0.03));

    // measure overlays (viewport coords)
    const hudR = this._hudEl?.getBoundingClientRect?.();
    const topBarsR = this._barsTopEl?.getBoundingClientRect?.();
    const botBarsR = this._barsBottomEl?.getBoundingClientRect?.();
    const metaR = this._metaEl?.getBoundingClientRect?.();

    // compute forbidden bands relative to stage
    const topBlock = Math.max(
      0,
      Math.max(
        (hudR ? (hudR.bottom - layerR.top) : 0),
        (topBarsR ? (topBarsR.bottom - layerR.top) : 0)
      )
    );

    const bottomBlock = Math.max(
      0,
      (botBarsR ? (layerR.bottom - botBarsR.top) : 0)
    );

    // meta blocks right side area (only if visible and overlaps stage)
    let rightBlock = 0;
    if (
      metaR &&
      metaR.right > layerR.left &&
      metaR.left < layerR.right &&
      metaR.bottom > layerR.top &&
      metaR.top < layerR.bottom
    ){
      rightBlock = Math.max(0, layerR.right - metaR.left);
      rightBlock = Math.min(rightBlock, layerR.width * 0.55);
    }

    const left = layerR.left + pad + padSide;
    const right = layerR.right - pad - padSide - rightBlock;

    // ✅ bias ขึ้นบน + กันพื้นที่ล่างเพิ่ม
    const topBias = Math.min(42, Math.max(12, topBlock * 0.18));
    const bottomExtra = Math.min(56, Math.max(20, (bottomBlock * 0.35) + 26));

    const top = layerR.top + pad + padTop + topBlock - topBias;
    const bottom = layerR.bottom - pad - padBot - bottomBlock - bottomExtra;

    return {
      left: Math.min(left, right - 80),
      right: Math.max(right, left + 80),
      top: Math.min(top, bottom - 80),
      bottom: Math.max(bottom, top + 80),
      layerR
    };
  }

  // ✅ 3 rows x 2 cols, แต่ยก center ของ row ขึ้นเล็กน้อย
  _pickSlot(size){
    const { left, right, top, bottom } = this._safeRectViewport();
    const w = Math.max(1, right - left);
    const h = Math.max(1, bottom - top);

    const cols = 2;
    const rows = 3;

    const cellW = w / cols;
    const cellH = h / rows;

    const slots = [];
    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        const key = `${r}-${c}`;
        if(this._occupied.has(key)) continue;

        const cx = left + c * cellW + cellW * 0.5;

        // ✅ เดิม 0.50 ทำให้แถวค่อนไปล่างไปหน่อย
        const cy = top + r * cellH + cellH * 0.42;

        const minX = left + c * cellW + 8;
        const maxX = left + (c + 1) * cellW - size - 8;

        const minY = top + r * cellH + 8;
        const maxY = top + (r + 1) * cellH - size - 8;

        const x = clamp(
          rand(cx - cellW * 0.18, cx + cellW * 0.18),
          minX,
          maxX
        );

        // ✅ ลด jitter แนวตั้ง เพื่อไม่ให้หล่นลงล่างเกิน
        const y = clamp(
          rand(cy - cellH * 0.12, cy + cellH * 0.10),
          minY,
          maxY
        );

        slots.push({ key, x, y });
      }
    }

    if(!slots.length){
      const keys = Array.from(this._occupied.keys());
      const k = keys[Math.floor(Math.random() * keys.length)];
      this._occupied.delete(k);
      return this._pickSlot(size);
    }

    return slots[Math.floor(Math.random() * slots.length)];
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const el = document.createElement('div');
    const type = (data.type || 'normal');
    el.className = 'sb-target sb-target--' + type;
    el.dataset.id = String(data.id);

    const size = clamp(Number(data.sizePx) || 110, 64, 240);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const slot = this._pickSlot(size);
    el.style.left = Math.round(slot.x) + 'px';
    el.style.top = Math.round(slot.y) + 'px';

    el.textContent = this._emojiForType(type, data.bossEmoji);
    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(Number(data.id), { el, type, slotKey: slot.key });
    this._occupied.set(slot.key, Number(data.id));
  }

  _onPointer(e){
    const el = e.currentTarget;
    if (!el) return;
    const id = Number(el.dataset.id);
    if (!Number.isFinite(id)) return;

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  removeTarget(id){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}

    if(obj?.slotKey) this._occupied.delete(obj.slotKey);
    this.targets.delete(id);
  }

  expireTarget(id){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;
    try{
      el.classList.add('is-expiring');
      el.style.pointerEvents = 'none';
      setTimeout(()=> this.removeTarget(id), 180);
    }catch{
      this.removeTarget(id);
    }
  }

  playHitFx(id, info = {}){
    const obj = this.targets.get(id);
    const el = obj?.el;

    const rect = el ? el.getBoundingClientRect() : null;
    const x = info.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = info.clientY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

    const grade = info.grade || 'good';
    const scoreDelta = Number(info.scoreDelta) || 0;

    if (grade === 'perfect') {
      FxBurst.burst(x, y, { n: 14, spread: 68, ttlMs: 640, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0, scoreDelta)}`, 'sb-fx-fever');
    } else if (grade === 'good') {
      FxBurst.burst(x, y, { n: 10, spread: 48, ttlMs: 540, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0, scoreDelta)}`, 'sb-fx-hit');
    } else if (grade === 'bad') {
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `+${Math.max(0, scoreDelta)}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 16, spread: 86, ttlMs: 700, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else if (grade === 'expire') {
      FxBurst.burst(x, y, { n: 6, spread: 36, ttlMs: 420, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-miss');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}