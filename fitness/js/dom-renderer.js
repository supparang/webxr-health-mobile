// fitness/js/dom-renderer.js
'use strict';

const NORMAL_EMOJI = ['⭐️','💎','✨','🌀','🎯','🔆'];
const DECOY_EMOJI  = ['💣','☠️','⚠️','🧨'];

function pickEmoji(type){
  if(type === 'decoy'){
    return DECOY_EMOJI[Math.floor(Math.random() * DECOY_EMOJI.length)];
  }
  return NORMAL_EMOJI[Math.floor(Math.random() * NORMAL_EMOJI.length)];
}

export class DomRenderer {
  constructor(engine, host, options = {}) {
    this.engine = engine;
    this.host   = host;
    this._nodes = new Map();
    this.sizePx = options.sizePx || 70;

    this.playArea = this.host ? this.host.closest('.play-area') : null;

    // เตรียม SFX (optional)
    try {
      this.sfxHit   = new Audio('./sfx/hit.mp3');
      this.sfxDecoy = new Audio('./sfx/decoy.mp3');
      this.sfxMiss  = new Audio('./sfx/miss.mp3');
    } catch(e) {
      this.sfxHit = this.sfxDecoy = this.sfxMiss = null;
    }
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

      shard.style.background = isDecoy ? '#fecaca' : '#bbf7d0';

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

  _playSfx(kind){
    let src = null;
    if (kind === 'decoy' && this.sfxDecoy) src = this.sfxDecoy;
    else if (kind === 'miss' && this.sfxMiss) src = this.sfxMiss;
    else if (this.sfxHit) src = this.sfxHit;

    if (!src) return;
    try{
      const a = src.cloneNode();
      a.volume = 0.9;
      a.play();
    }catch(e){}
  }

  _shakePlayArea(){
    if(!this.playArea) return;
    const el = this.playArea;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(()=>el.classList.remove('shake'), 220);
  }

  _flashBossBar(){
    const bar = document.querySelector('.boss-bar');
    if(!bar) return;
    bar.classList.add('hit-flash');
    setTimeout(()=>bar.classList.remove('hit-flash'), 180);
  }

  _vibrate(kind){
    if (!('vibrate' in navigator)) return;
    try{
      if (kind === 'decoy'){
        navigator.vibrate([40,40,40]);
      } else if (kind === 'miss'){
        navigator.vibrate([30,60,30]);
      } else {
        navigator.vibrate(30);
      }
    }catch(e){}
  }

  _feedbackOnHit(meta, isDecoy){
    this._shakePlayArea();
    this._flashBossBar();
    this._vibrate(isDecoy ? 'decoy' : 'hit');
    this._playSfx(isDecoy ? 'decoy' : 'hit');
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

    const isDecoy = meta && meta.type === 'decoy';

    this._spawnBurst(xPct, yPct, isDecoy);

    const delta = (meta && typeof meta.deltaScore === 'number')
      ? meta.deltaScore
      : (isDecoy ? -5 : 10);

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

    this._feedbackOnHit(meta, isDecoy);

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

    this._vibrate('miss');
    this._playSfx('miss');

    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
      this._nodes.delete(id);
    }, 180);
  }
}
