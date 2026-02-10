// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ pointer hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ TTL auto-expire (fix: targets not disappearing)
// ✅ Telegraph ring (.sb-telegraph) before spawn (optional)
// ✅ FX via FxBurst

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
    this.onTargetExpire = typeof opts.onTargetExpire === 'function' ? opts.onTargetExpire : null;

    this.diffKey = 'normal';

    // keep existing public map used by engine
    this.targets = new Map(); // id -> element

    // internal meta
    this._meta = new Map();   // id -> { type, bornAt, ttlMs, timer, teleEl }

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();

    for (const [id, m] of this._meta.entries()) {
      try { if (m.timer) clearTimeout(m.timer); } catch {}
      try { if (m.teleEl) m.teleEl.remove(); } catch {}
    }
    this._meta.clear();
  }

  getType(id){
    const m = this._meta.get(id);
    return (m && m.type) ? m.type : 'normal';
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // keep margins away from HUD/meta (CSS also helps, but keep robust here)
    const pad = Math.min(40, Math.max(18, r.width * 0.035));
    const top = pad + 8;
    const left = pad + 8;

    // reserve area for boss meta panel (right top) a bit
    const reserveRight = Math.min(260, Math.max(190, r.width * 0.26));
    const reserveTopH  = Math.min(210, Math.max(140, r.height * 0.22));

    const right = r.width - pad - 8;
    const bottom = r.height - pad - 8;

    return { r, left, top, right, bottom, reserveRight, reserveTopH };
  }

  _emojiForType(t, bossEmoji){
    if (t === 'normal') return '🎯';
    if (t === 'decoy') return '👀';
    if (t === 'bomb') return '💣';
    if (t === 'heal') return '🩹';
    if (t === 'shield') return '🛡️';
    if (t === 'bossface') return bossEmoji || '👊';
    return '🎯';
  }

  _pickXY(size){
    const { r, left, top, right, bottom, reserveRight, reserveTopH } = this._safeAreaRect();

    // Try several times to avoid reserved top-right meta area
    for (let i=0; i<14; i++){
      const x = rand(left, Math.max(left, right - size));
      const y = rand(top, Math.max(top, bottom - size));

      const inReserved =
        (x > (r.width - reserveRight)) &&
        (y < (reserveTopH));

      if (!inReserved) return { x, y };
    }

    // fallback (even if overlaps)
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    return { x, y };
  }

  _addTelegraph(x, y, size, isBoss=false, ms=120){
    if (!this.layer) return null;

    const tele = document.createElement('div');
    tele.className = 'sb-telegraph' + (isBoss ? ' boss' : '');
    tele.style.width = Math.round(size) + 'px';
    tele.style.height = Math.round(size) + 'px';
    tele.style.left = Math.round(x) + 'px';
    tele.style.top = Math.round(y) + 'px';

    // IMPORTANT: telegraph must be inside target layer so it matches coordinates
    this.layer.appendChild(tele);

    // auto-remove
    setTimeout(()=>{ try{ tele.remove(); }catch{} }, clamp(ms, 60, 260));
    return tele;
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const id = Number(data.id);
    if (!Number.isFinite(id)) return;

    // ensure unique id (if reused, remove old)
    if (this.targets.has(id)) this.removeTarget(id, 'respawn');

    const type = String(data.type || 'normal');
    const ttlMs = clamp(Number(data.ttlMs) || 1200, 350, 4000);

    const size = clamp(Number(data.sizePx) || 110, 66, 260);
    const { x, y } = this._pickXY(size);

    // Optional telegraph (quick ring before real spawn)
    const teleMs = clamp(Number(data.teleMs) || 110, 60, 260);
    const doTele = (data.telegraph === 1 || data.telegraph === true);
    let teleEl = null;
    if (doTele) {
      teleEl = this._addTelegraph(x, y, size, type === 'bossface', teleMs);
    }

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + type;
    el.dataset.id = String(id);

    el.style.width = Math.round(size) + 'px';
    el.style.height = Math.round(size) + 'px';

    // NOTE: targets are positioned within layer rect
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // content
    const emoji = this._emojiForType(type, data.bossEmoji);
    el.textContent = emoji;

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(id, el);

    // TTL auto-expire
    const bornAt = performance.now();
    const timer = setTimeout(() => {
      // already removed by hit?
      if (!this.targets.has(id)) return;

      const t = this.getType(id);
      this.removeTarget(id, 'ttl');

      // notify engine
      if (this.onTargetExpire) {
        try { this.onTargetExpire(id, { type: t }); } catch {}
      }
    }, ttlMs);

    this._meta.set(id, { type, bornAt, ttlMs, timer, teleEl });
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

  removeTarget(id, reason='remove'){
    const el = this.targets.get(id);
    const m = this._meta.get(id);

    if (m && m.timer) {
      try { clearTimeout(m.timer); } catch {}
    }
    if (m && m.teleEl) {
      try { m.teleEl.remove(); } catch {}
    }

    if (el) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }

    this.targets.delete(id);
    this._meta.delete(id);
  }

  playHitFx(id, info = {}){
    const el = this.targets.get(id);
    const rect = el ? el.getBoundingClientRect() : null;
    const x = info.clientX ?? (rect ? rect.left + rect.width/2 : window.innerWidth/2);
    const y = info.clientY ?? (rect ? rect.top + rect.height/2 : window.innerHeight/2);

    const grade = info.grade || 'good';
    const scoreDelta = Number(info.scoreDelta) || 0;

    if (grade === 'perfect') {
      FxBurst.burst(x, y, { n: 14, spread: 68, ttlMs: 640, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0,scoreDelta)}`, 'sb-fx-fever');
    } else if (grade === 'good') {
      FxBurst.burst(x, y, { n: 10, spread: 48, ttlMs: 540, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-hit');
    } else if (grade === 'bad') {
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 16, spread: 86, ttlMs: 700, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}