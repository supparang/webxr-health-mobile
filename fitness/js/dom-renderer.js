// js/dom-renderer.js
'use strict';

/**
 * DomRenderer:
 * - เป้าเป็น emoji (เป้าจริง / เป้าลวง)
 * - มีเอฟเฟกต์แตก + คะแนนลอยตรงเป้า
 */

const NORMAL_EMOJI = ['⭐️','💎','✨','🌀','🎯','🔆'];
const DECOY_EMOJI  = ['💣','☠️','⚠️','🧨'];

function pickEmoji(type){
  if(type === 'decoy'){
    return DECOY_EMOJI[Math.floor(Math.random() * DECOY_EMOJI.length)];
  }
  return NORMAL_EMOJI[Math.floor(Math.random() * NORMAL_EMOJI.length)];
}

export class DomRenderer {
  /**
   * @param {GameEngine|null} engine
   * @param {HTMLElement} host
   * @param {object} options { sizePx?: number }
   */
  constructor(engine, host, options = {}) {
    this.engine = engine;
    this.host   = host;
    this._nodes = new Map();
    this.sizePx = options.sizePx || 70;
  }

  reset() {
    if (this.host) this.host.innerHTML = '';
    this._nodes.clear();
  }

  spawn(target) {
    const el = document.createElement('div');
    el.className = 'target spawn';
    if (target.type === 'decoy') {
      el.classList.add('decoy');
    }

    const size = this.sizePx;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    el.style.left = target.x + '%';
    el.style.top  = target.y + '%';
    el.dataset.id = String(target.id);

    // emoji ตรงกลาง
    const inner = document.createElement('div');
    inner.textContent = pickEmoji(target.type);
    inner.style.fontSize = Math.round(size * 0.6) + 'px';
    inner.style.display = 'flex';
    inner.style.alignItems = 'center';
    inner.style.justifyContent = 'center';
    inner.style.width = '100%';
    inner.style.height = '100%';
    el.appendChild(inner);

    const onHit = (ev) => {
      ev.preventDefault();
      if (this.engine && this.engine.hitTarget) {
        this.engine.hitTarget(target.id, { source: 'dom' });
      }
    };
    el.addEventListener('pointerdown', onHit, { passive: false });

    this.host.appendChild(el);
    this._nodes.set(target.id, { el, onHit });
  }

  // คะแนนลอย
  _spawnScoreFloat(xPct, yPct, text, color){
    if (!this.host) return;
    const node = document.createElement('div');
    node.textContent = text;
    node.style.position = 'absolute';
    node.style.left = xPct + '%';
    node.style.top  = yPct + '%';
    node.style.transform = 'translate(-50%, -50%)';
    node.style.fontSize = '0.9rem';
    node.style.fontWeight = '700';
    node.style.pointerEvents = 'none';
    node.style.transition = 'transform .35s ease-out, opacity .35s ease-out';
    node.style.opacity = '1';
    node.style.textShadow = '0 2px 8px rgba(0,0,0,0.7)';
    node.style.color = color || '#bbf7d0';

    this.host.appendChild(node);
    requestAnimationFrame(() => {
      node.style.transform = 'translate(-50%, -85%)';
      node.style.opacity = '0';
      setTimeout(() => {
        if (node.parentElement) node.parentElement.removeChild(node);
      }, 380);
    });
  }

  // เศษแตกกระจาย (เอฟเฟกต์ง่าย ๆ)
  _spawnBurst(xPct, yPct, isDecoy){
    if (!this.host) return;
    const N = 8;
    for(let i=0;i<N;i++){
      const shard = document.createElement('div');
      shard.style.position = 'absolute';
      shard.style.left = xPct + '%';
      shard.style.top  = yPct + '%';
      shard.style.width = '6px';
      shard.style.height = '6px';
      shard.style.borderRadius = '999px';
      shard.style.pointerEvents = 'none';
      shard.style.opacity = '1';
      shard.style.transition = 'transform .35s ease-out, opacity .35s ease-out';

      if(isDecoy){
        shard.style.background = '#fecaca';
      }else{
        shard.style.background = '#bbf7d0';
      }

      const angle = (Math.PI * 2 * i) / N;
      const dist  = 24 + Math.random() * 10;

      this.host.appendChild(shard);
      requestAnimationFrame(() => {
        shard.style.transform =
          `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px))`;
        shard.style.opacity = '0';
        setTimeout(() => {
          if(shard.parentElement) shard.parentElement.removeChild(shard);
        }, 380);
      });
    }
  }

  hit(id, meta) {
    const record = this._nodes.get(id);
    if (!record) return;
    const { el, onHit } = record;
    el.removeEventListener('pointerdown', onHit);

    const rectHost = this.host.getBoundingClientRect();
    const rect     = el.getBoundingClientRect();
    const xPct = ((rect.left + rect.width / 2) - rectHost.left) / rectHost.width * 100;
    const yPct = ((rect.top  + rect.height/ 2) - rectHost.top)  / rectHost.height * 100;

    // shard แตกกระจาย
    this._spawnBurst(xPct, yPct, meta && meta.type === 'decoy');

    // คะแนนลอย
    const delta = (meta && typeof meta.deltaScore === 'number')
      ? meta.deltaScore
      : (meta && meta.type === 'decoy' ? -5 : 10);

    if (delta !== 0){
      if (delta > 0){
        let label = '+' + delta;
        if (meta && meta.quality === 'perfect'){
          label = 'Perfect +' + delta;
        }
        this._spawnScoreFloat(xPct, yPct, label, '#bbf7d0');
      } else {
        this._spawnScoreFloat(xPct, yPct, String(delta), '#fecaca');
      }
    }

    // ลบเป้า
    el.classList.add('hit');
    el.classList.remove('spawn');
    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
      this._nodes.delete(id);
    }, 180);
  }

  expire(id) {
    const record = this._nodes.get(id);
    if (!record) return;
    const { el, onHit } = record;
    el.removeEventListener('pointerdown', onHit);
    el.classList.add('miss');
    el.style.opacity = '0.3';
    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
      this._nodes.delete(id);
    }, 180);
  }
}
