// === /fitness/js/dom-renderer-shadow.js — Shadow Breaker Renderer (LATEST, anti-row + anti-overlap) ===
'use strict';

const EMOJI_BY_TYPE = {
  normal:  '🥊',
  bomb:    '💣',
  decoy:   '🎭',
  heal:    '❤️',
  shield:  '🛡️',
  bossface:'👑'
};

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host        = host;
    this.wrapEl      = opts.wrapEl || document.body;
    this.feedbackEl  = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    // ตำแหน่งล่าสุด (กันชนกัน)
    this._placed = [];
    this._maxKeepPlaced = 24;

    this._handleClick = this._handleClick.bind(this);
    if (this.host) this.host.addEventListener('click', this._handleClick);

    this._syncRect = this._syncRect.bind(this);
    window.addEventListener('resize', this._syncRect, { passive:true });
    this._syncRect();
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  destroy() {
    if (this.host) this.host.removeEventListener('click', this._handleClick);
    window.removeEventListener('resize', this._syncRect);
    this.clearTargets();
  }

  clearTargets() {
    for (const el of this.targets.values()) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
    this._placed.length = 0;
  }

  _syncRect(){
    if (!this.host) return;
    this._rect = this.host.getBoundingClientRect();
  }

  // ===== public API =====
  spawnTarget(data) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';

    const type = data.isBossFace ? 'bossface' : (data.type || 'normal');
    el.classList.add(`sb-target--${type}`);

    const emoji = (data.isBossFace && data.bossEmoji)
      ? data.bossEmoji
      : (EMOJI_BY_TYPE[type] || EMOJI_BY_TYPE.normal);

    el.dataset.id = String(data.id);
    el.dataset.type = type;

    const size = data.sizePx || 120;
    el.style.setProperty('--sb-target-size', `${size}px`);

    // ---- position: grid-based + random jitter + avoid overlap ----
    const pos = this._pickPosition(size);
    el.style.left = pos.xPct + '%';
    el.style.top  = pos.yPct + '%';

    const core = document.createElement('span');
    core.className = 'sb-target-core';
    core.textContent = emoji;

    el.appendChild(core);
    this.host.appendChild(el);

    this.targets.set(data.id, el);
  }

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;
    this.targets.delete(id);

    el.classList.add('sb-target--gone');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, reason === 'hit' ? 250 : 150);
  }

  playHitFx(id, opts) {
    const el = this.targets.get(id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    this._spawnScoreText(cx, cy, opts);
    this._spawnBurst(cx, cy, opts);
  }

  // ===== internal: positioning =====
  _pickPosition(sizePx){
    // อ่านขนาดเลเยอร์จริง (px) เพื่อกันชนกันให้ได้
    const r = this._rect || (this.host ? this.host.getBoundingClientRect() : null);
    const W = r ? Math.max(1, r.width) : 1000;
    const H = r ? Math.max(1, r.height) : 600;

    // safe margins (กันชน UI ขอบ)
    const pad = Math.max(18, Math.min(42, sizePx * 0.35));
    const minX = pad;
    const maxX = W - pad;
    const minY = pad;
    const maxY = H - pad;

    // grid columns/rows ตามสัดส่วน + อย่างน้อย 3x3
    const cols = Math.max(3, Math.floor(W / (sizePx * 1.2)));
    const rows = Math.max(3, Math.floor(H / (sizePx * 1.15)));

    const attempts = 28;
    let best = null;
    let bestScore = -1;

    for (let i=0;i<attempts;i++){
      const gx = Math.floor(Math.random() * cols);
      const gy = Math.floor(Math.random() * rows);

      const cellW = (maxX - minX) / cols;
      const cellH = (maxY - minY) / rows;

      // center of cell + jitter
      let x = minX + (gx + 0.5) * cellW;
      let y = minY + (gy + 0.5) * cellH;

      const jx = (Math.random() - 0.5) * cellW * 0.55;
      const jy = (Math.random() - 0.5) * cellH * 0.55;

      x = Math.min(maxX, Math.max(minX, x + jx));
      y = Math.min(maxY, Math.max(minY, y + jy));

      // score: distance from nearest placed (maximize)
      const d = this._minDist(x, y);
      if (d > bestScore){
        bestScore = d;
        best = { x, y };
      }

      // ถ้าห่างพอ ไม่ต้องหาเพิ่ม
      const want = sizePx * 0.95;
      if (d >= want) { best = {x,y}; break; }
    }

    const final = best || { x: (minX+maxX)/2, y: (minY+maxY)/2 };

    // store placed
    this._placed.unshift({ x: final.x, y: final.y, r: sizePx * 0.55 });
    if (this._placed.length > this._maxKeepPlaced) this._placed.length = this._maxKeepPlaced;

    // to percent (absolute within host)
    const xPct = (final.x / W) * 100;
    const yPct = (final.y / H) * 100;
    return { xPct, yPct };
  }

  _minDist(x,y){
    if (!this._placed.length) return 9999;
    let m = 9999;
    for (const p of this._placed){
      const dx = x - p.x;
      const dy = y - p.y;
      const d = Math.hypot(dx,dy) - p.r;
      if (d < m) m = d;
    }
    return m;
  }

  // ===== click handling =====
  _handleClick(ev) {
    const target = ev.target.closest('.sb-target');
    if (!target) return;

    const id = parseInt(target.dataset.id, 10);
    if (!this.targets.has(id)) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: cx, clientY: cy });
    }
  }

  // ===== FX =====
  _spawnScoreText(x, y, { grade, scoreDelta }) {
    const root = this.wrapEl || document.body;
    const el = document.createElement('div');
    el.className = `sb-fx-score sb-fx-${grade || 'good'}`;
    el.textContent = (scoreDelta > 0 ? '+' : '') + scoreDelta;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-live'));
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
  }

  _spawnBurst(x, y, { grade }) {
    const root = this.wrapEl || document.body;
    const n = grade === 'perfect' ? 20 : 12;
    for (let i = 0; i < n; i++) {
      const dot = document.createElement('div');
      dot.className = `sb-fx-dot sb-fx-${grade || 'good'}`;
      dot.style.left = `${x}px`;
      dot.style.top  = `${y}px`;

      const ang = (Math.PI * 2 * i) / n;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const scale = 0.6 + Math.random() * 0.6;

      dot.style.setProperty('--sb-fx-dx', `${dx}px`);
      dot.style.setProperty('--sb-fx-dy', `${dy}px`);
      dot.style.setProperty('--sb-fx-scale', scale.toString());

      root.appendChild(dot);
      requestAnimationFrame(() => dot.classList.add('is-live'));
      setTimeout(() => { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 550);
    }
  }
}
