// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (Pack A Latest) ===
'use strict';

const EMOJI_BY_TYPE = {
  normal:  '🥊',
  bomb:    '💣',
  decoy:   '🎭',
  heal:    '❤️',
  shield:  '🛡️',
  bossface:'👑'
};

const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host        = host;
    this.wrapEl      = opts.wrapEl || document.body;
    this.feedbackEl  = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    // grid-spawn memory to avoid "rowเดียว"
    this._cells = [];
    this._cellIdx = 0;
    this._recentCells = [];
    this._recentMax = 6;

    this._handleClick = this._handleClick.bind(this);
    if (this.host) this.host.addEventListener('click', this._handleClick);

    this._rebuildGrid();
    window.addEventListener('resize', () => this._rebuildGrid(), { passive: true });
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
    this._rebuildGrid();
  }

  destroy() {
    if (this.host) this.host.removeEventListener('click', this._handleClick);
    this.clearTargets();
  }

  clearTargets() {
    for (const el of this.targets.values()) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
    this._recentCells.length = 0;
  }

  // ===== grid spawn =====
  _rebuildGrid() {
    // ใช้จำนวนคอลัมน์/แถวตาม diff เพื่อกระจายเป้า
    // easy: ช่องใหญ่ (น้อยช่อง) / hard: ช่องเยอะ (กระจายมาก)
    const diff = (this.diffKey || 'normal').toLowerCase();
    const cols = diff === 'easy' ? 4 : diff === 'hard' ? 6 : 5;
    const rows = diff === 'easy' ? 3 : diff === 'hard' ? 4 : 4;

    // safe margins (กันชิดขอบ/ทับ HUD)
    const xMin = 16, xMax = 84;
    const yMin = 16, yMax = 84;

    this._cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = xMin + (xMax - xMin) * ((c + 0.5) / cols);
        const y = yMin + (yMax - yMin) * ((r + 0.5) / rows);
        this._cells.push({ x, y, r, c });
      }
    }
    // shuffle
    for (let i = this._cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this._cells[i];
      this._cells[i] = this._cells[j];
      this._cells[j] = tmp;
    }
    this._cellIdx = 0;
  }

  _pickCell() {
    if (!this._cells.length) this._rebuildGrid();

    // หา cell ที่ไม่อยู่ใน recent
    let tries = 0;
    while (tries++ < 12) {
      const cell = this._cells[this._cellIdx++ % this._cells.length];
      const key = `${cell.r}:${cell.c}`;
      if (!this._recentCells.includes(key)) {
        this._recentCells.unshift(key);
        this._recentCells.length = Math.min(this._recentMax, this._recentCells.length);
        return cell;
      }
    }
    // fallback
    const cell = this._cells[this._cellIdx++ % this._cells.length];
    const key = `${cell.r}:${cell.c}`;
    this._recentCells.unshift(key);
    this._recentCells.length = Math.min(this._recentMax, this._recentCells.length);
    return cell;
  }

  // ===== public API used by engine =====
  spawnTarget(data) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';

    const type = data.isBossFace ? 'bossface' : (data.type || 'normal');
    el.classList.add(`sb-target--${type}`);

    const emoji = data.isBossFace && data.bossEmoji
      ? data.bossEmoji
      : (EMOJI_BY_TYPE[type] || EMOJI_BY_TYPE.normal);

    el.dataset.id = String(data.id);
    el.dataset.type = type;

    const size = data.sizePx || 120;
    el.style.setProperty('--sb-target-size', `${size}px`);

    // === grid position + jitter (แก้ row เดียว + ลด overlap) ===
    const cell = this._pickCell();

    // jitter ตามขนาด (กันซ้อน)
    const jx = (Math.random() * 10 - 5);
    const jy = (Math.random() * 10 - 5);

    const x = clamp(cell.x + jx, 12, 88);
    const y = clamp(cell.y + jy, 12, 88);

    el.style.left = x + '%';
    el.style.top  = y + '%';

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

  // ===== internal helpers =====
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

  _spawnScoreText(x, y, { grade, scoreDelta }) {
    if (!this.wrapEl) return;
    const el = document.createElement('div');
    el.className = `sb-fx-score sb-fx-${grade || 'good'}`;
    el.textContent = (scoreDelta > 0 ? '+' : '') + scoreDelta;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-live'));
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
  }

  _spawnBurst(x, y, { grade }) {
    if (!this.wrapEl) return;
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

      document.body.appendChild(dot);
      requestAnimationFrame(() => dot.classList.add('is-live'));
      setTimeout(() => { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 550);
    }
  }
}