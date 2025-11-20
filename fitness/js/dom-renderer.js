// === Shadow Breaker — DOM Renderer v2025-11-20 ===
// รองรับ: emoji target, multi-size, HP tint, FEVER tint, burst effect
// ใช้ renderer แบบ DOM ปลอดภัยทุก browser/mobile/iframe

'use strict';

export const DomRenderer = {
  host   : null,
  fever  : false,
  bossPhase: 1,

  init(host){
    this.host = (typeof host === 'string') ? document.querySelector(host) : host;
    if(!this.host){
      console.warn('[DomRenderer] host missing, auto-inject');
      this.host = document.createElement('div');
      this.host.id = 'sb-spawn-host';
      this.host.style.position = 'absolute';
      this.host.style.left = '0';
      this.host.style.top = '0';
      this.host.style.width = '100%';
      this.host.style.height = '100%';
      this.host.style.overflow = 'hidden';
      document.body.appendChild(this.host);
    }
  },

  setFever(flag){
    this.fever = !!flag;
  },

  setBossPhase(p){
    this.bossPhase = p;
  },

  /** สร้าง emoji เป้า
   * opts = { emoji, size, speed, onHit, hpTint, bossTint }
   */
  spawn(opts){
    if(!this.host) return;
    const emo  = opts.emoji || '🥊';
    const size = opts.size || 120;
    const speed = opts.speed || 1200;

    const node = document.createElement('div');
    node.className = 'sb-target';
    node.textContent = emo;

    node.style.width  = size + 'px';
    node.style.height = size + 'px';
    node.style.fontSize = (size * 0.68) + 'px';
    node.style.lineHeight = size + 'px';
    node.style.position = 'absolute';
    node.style.display = 'flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.userSelect = 'none';
    node.style.cursor = 'pointer';
    node.style.borderRadius = '50%';
    node.style.boxShadow = '0 0 20px rgba(0,0,0,0.35)';
    node.style.transition = 'transform .15s, opacity .2s';

    // FEVER tone
    if(this.fever){
      node.style.filter = 'drop-shadow(0 0 10px #facc15)';
    }

    // Boss tint (phase)
    if(opts.bossTint){
      node.style.boxShadow = `0 0 25px ${opts.bossTint}`;
      node.style.border = `3px solid ${opts.bossTint}`;
    }

    // Random position
    const rect = this.host.getBoundingClientRect();
    const px = Math.random() * (rect.width - size);
    const py = Math.random() * (rect.height - size);
    node.style.left = px + 'px';
    node.style.top = py + 'px';

    this.host.appendChild(node);

    // Pointer hit
    node.addEventListener('pointerdown', (ev)=>{
      ev.stopPropagation();
      ev.preventDefault();
      if(node.dataset.dead) return;

      node.dataset.dead = '1';
      this.hitEffect(node);
      if(opts.onHit) opts.onHit();
      setTimeout(()=> node.remove(), 80);
    }, {passive:false});

    // Auto fade-out
    setTimeout(()=>{
      if(!node.dataset.dead){
        node.style.opacity = '0';
        setTimeout(()=>{ if(node.parentNode) node.remove(); }, 200);
      }
    }, speed);
  },

  /** เอฟเฟกต์แตกกระจาย */
  hitEffect(node){
    const host = this.host;
    const rect = node.getBoundingClientRect();

    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    for(let i=0;i<10;i++){
      const shard = document.createElement('div');
      shard.className = 'sb-burst';
      shard.style.left = cx + 'px';
      shard.style.top  = cy + 'px';

      const ang = Math.random()*Math.PI*2;
      const dist = 40 + Math.random()*40;

      const tx = Math.cos(ang)*dist;
      const ty = Math.sin(ang)*dist;

      shard.style.transform = `translate(${tx}px,${ty}px) scale(${0.5+Math.random()*1.3})`;
      shard.style.opacity = '0';

      host.appendChild(shard);
      setTimeout(()=> shard.remove(), 240);
    }

    // scale pop ของเป้า
    node.style.transform = 'scale(.3)';
    node.style.opacity = '0';
  }
};