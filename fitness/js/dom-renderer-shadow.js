// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets — PATCH E
// ✅ Safe spawn rect avoids HUD(top/bottom) + boss card area
// ✅ Anti-cluster spawn (rejection sampling + min distance)
// ✅ TTL hint supported (engine still enforces hard TTL)

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx + dy*dy; }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map();
    this._onPointer = this._onPointer.bind(this);

    // PATCH E: stage metrics (hud/card sizes) injected by engine each tick/start
    this.stageMetrics = {
      topHudH: 0,
      bottomHudH: 0,
      rightPanelW: 0,
      pad: 20
    };

    // keep some recent spawns to avoid clustering
    this._recent = []; // {x,y,r,ts}
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  // PATCH E: update stage constraints from engine
  setStageMetrics(m = {}){
    this.stageMetrics.topHudH = Math.max(0, Number(m.topHudH)||0);
    this.stageMetrics.bottomHudH = Math.max(0, Number(m.bottomHudH)||0);
    this.stageMetrics.rightPanelW = Math.max(0, Number(m.rightPanelW)||0);
    this.stageMetrics.pad = Math.max(10, Math.min(42, Number(m.pad)||20));
  }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();
    this._recent.length = 0;
  }

  _safeAreaRect(size){
    const r = this.layer.getBoundingClientRect();
    const pad = Math.min(42, Math.max(16, r.width * 0.03, this.stageMetrics.pad || 20));

    // HUD offsets (real measured by engine)
    const topHud = Math.min(r.height*0.45, Math.max(0, this.stageMetrics.topHudH || 0));
    const bottomHud = Math.min(r.height*0.45, Math.max(0, this.stageMetrics.bottomHudH || 0));

    // Boss card area on the right
    const rightPanel = Math.min(r.width*0.55, Math.max(0, this.stageMetrics.rightPanelW || 0));

    const left = pad + 8;
    const top = pad + 8 + topHud;
    const right = r.width - pad - 8 - rightPanel;
    const bottom = r.height - pad - 8 - bottomHud;

    // clamp usable area
    const minW = Math.max(120, size + 12);
    const minH = Math.max(140, size + 12);

    let L = left, T = top, R = right, B = bottom;

    if(R - L < minW){
      // if boss card eats too much, allow under it (still try keep a small gutter)
      R = r.width - pad - 8;
    }
    if(B - T < minH){
      // if HUD eats too much, relax it slightly
      T = pad + 8 + Math.max(0, topHud*0.55);
      B = r.height - pad - 8 - Math.max(0, bottomHud*0.55);
    }

    return { r, left:L, top:T, right:R, bottom:B };
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

  _pruneRecent(){
    const t = performance.now();
    // keep only last 1.8s of samples
    this._recent = this._recent.filter(p => (t - p.ts) < 1800);
  }

  _pickNonClusterPos(size){
    const { left, top, right, bottom } = this._safeAreaRect(size);
    const W = Math.max(left, right - size);
    const H = Math.max(top, bottom - size);

    const cx0 = (left + right)/2;
    const cy0 = (top + bottom)/2;

    // min distance between centers (depends on size)
    const minD = clamp(size * 0.78, 64, 148);
    const minD2 = minD * minD;

    this._pruneRecent();

    let best = null;
    let bestScore = -1;

    // rejection sampling with scoring (try 16 candidates, pick best)
    const tries = 16;
    for(let i=0;i<tries;i++){
      // bias toward center but still random
      const x = clamp(rand(left, W), left, W);
      const y = clamp(rand(top, H), top, H);

      const cx = x + size/2;
      const cy = y + size/2;

      // score: far from recent points + mild pull to center
      let ok = true;
      let nearest2 = 1e18;
      for(const p of this._recent){
        const d2 = dist2(cx,cy,p.x,p.y);
        nearest2 = Math.min(nearest2, d2);
        if(d2 < minD2){ ok = false; break; }
      }
      if(!ok) continue;

      const center2 = dist2(cx,cy,cx0,cy0);
      const score = nearest2 - center2*0.08; // prefer spaced out, slightly prefer not too far from center

      if(score > bestScore){
        bestScore = score;
        best = { x, y, cx, cy };
      }
    }

    // fallback: just random inside safe rect
    if(!best){
      const x = rand(left, W);
      const y = rand(top, H);
      best = { x, y, cx:x+size/2, cy:y+size/2 };
    }

    // record
    this._recent.push({ x: best.cx, y: best.cy, r: size/2, ts: performance.now() });
    return best;
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);

    const size = clamp(Number(data.sizePx) || 120, 68, 260); // PATCH E: cap max size
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // PATCH E: anti-cluster + safe spawn
    const pos = this._pickNonClusterPos(size);
    el.style.left = Math.round(pos.x) + 'px';
    el.style.top = Math.round(pos.y) + 'px';

    // content
    el.textContent = this._emojiForType(data.type, data.bossEmoji);

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(data.id, el);
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

  removeTarget(id, reason){
    const el = this.targets.get(id);
    if (!el) return;
    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}
    this.targets.delete(id);
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
