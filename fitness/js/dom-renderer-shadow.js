// === /fitness/js/dom-renderer-shadow.js ===
// DOM Renderer for Shadow Breaker — PRODUCTION
// ✅ Creates targets as DOM elements inside #sb-target-layer
// ✅ Handles click/tap -> emits to engine via onTargetHit
// Pack C: grid spawn + jitter + recent memory (avoid same-row clustering)

'use strict';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.targets = new Map();

    // spawn grid to avoid targets clustering in same row
    this._grid = { cols: 4, rows: 4, recent: [] };

    this.diffKey = 'normal';

    this._onPointer = this._onPointer.bind(this);

    if (this.layer) {
      this.layer.addEventListener('pointerdown', this._onPointer, { passive: true });
    }
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  destroy() {
    if (this.layer) {
      this.layer.removeEventListener('pointerdown', this._onPointer);
    }
    for (const id of this.targets.keys()) {
      this.removeTarget(id, 'destroy');
    }
    this.targets.clear();
  }

  _pickSpawnPoint(rect, size) {
    const g = this._grid || (this._grid = { cols: 4, rows: 4, recent: [] });
    const cols = Math.max(3, Math.min(6, g.cols || 4));
    const rows = Math.max(3, Math.min(6, g.rows || 4));

    // keep some margin, and also account for the target size
    const pad = Math.max(16, Math.min(40, size * 0.30));
    const w = Math.max(10, rect.width  - pad * 2);
    const h = Math.max(10, rect.height - pad * 2);

    const total = cols * rows;
    const recent = Array.isArray(g.recent) ? g.recent : (g.recent = []);
    const recentSet = new Set(recent.slice(-Math.min(6, total - 1)));

    // pick a cell that is not in recent (best effort)
    let cell = Math.floor(Math.random() * total);
    for (let tries = 0; tries < 12; tries++) {
      const c = Math.floor(Math.random() * total);
      if (!recentSet.has(c)) { cell = c; break; }
    }

    recent.push(cell);
    if (recent.length > 10) recent.splice(0, recent.length - 10);

    const col = cell % cols;
    const row = Math.floor(cell / cols);

    const cx = pad + (col + 0.5) * (w / cols);
    const cy = pad + (row + 0.5) * (h / rows);

    // jitter inside the cell
    const jx = (Math.random() - 0.5) * (w / cols) * 0.55;
    const jy = (Math.random() - 0.5) * (h / rows) * 0.55;

    return { x: cx + jx, y: cy + jy };
  }

  // ===== public API =====
  spawnTarget(data) {
    if (!this.layer || !data) return;
    const rect = this.layer.getBoundingClientRect();

    const size = clamp(Number(data.sizePx) || 120, 80, 240);
    const pt = this._pickSpawnPoint(rect, size);
    const x = pt.x;
    const y = pt.y;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';
    el.dataset.id = String(data.id);

    // type styling
    const t = data.type || 'normal';
    el.dataset.type = t;
    if (data.isBossFace) el.dataset.bossface = '1';

    // visuals
    let label = '🎯';
    if (t === 'bomb') label = '💣';
    else if (t === 'decoy') label = '🫥';
    else if (t === 'heal') label = '🩹';
    else if (t === 'shield') label = '🛡️';
    else if (data.isBossFace) label = data.bossEmoji || '😈';

    el.textContent = label;

    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = (x - size / 2) + 'px';
    el.style.top  = (y - size / 2) + 'px';

    // accessibility
    el.setAttribute('aria-label', `target ${t}`);

    this.layer.appendChild(el);
    this.targets.set(data.id, el);
  }

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;
    el.remove();
    this.targets.delete(id);
  }

  playHitFx(id, info) {
    // lightweight feedback via class + small motion (CSS handles visuals)
    const el = this.targets.get(id);
    if (!el) return;

    const grade = info && info.grade ? info.grade : 'good';
    el.classList.add('hit');
    el.dataset.grade = grade;

    setTimeout(() => {
      if (el && el.parentNode) el.remove();
    }, 90);
  }

  // ===== input =====
  _onPointer(e) {
    const t = e.target;
    if (!t || !t.dataset || !t.dataset.id) return;
    const id = Number(t.dataset.id);
    if (!id) return;

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }
}