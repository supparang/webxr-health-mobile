// === /HeroHealth/vr/particles.js (2025-11-12 FIX: viewport-fixed scorePop) ===
export const Particles = {
  _layer: null,
  _styleInjected: false,

  _injectStyles(){
    if (this._styleInjected) return;
    this._styleInjected = true;
    const st = document.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = [
      '.hha-pop-layer{position:fixed;inset:0;pointer-events:none;z-index:10000;}',
      '.hha-pop{position:absolute;left:0;top:0;transform:translate(-50%,-50%) scale(1);',
      ' will-change:transform,opacity,filter; font:900 20px system-ui,Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif; }',
      '.hha-pop .txt{position:relative;z-index:2;white-space:nowrap;filter:drop-shadow(0 1px 0 rgba(0,0,0,.75));}',
      '.hha-pop .ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);',
      ' border-radius:999px; box-sizing:border-box; filter:blur(0);}',

      /* shards (DOM fallback) */
      '.hha-shard{position:absolute;left:0;top:0;transform:translate(-50%,-50%);',
      ' will-change:transform,opacity; pointer-events:none; font-size:24px; }'
    ].join('');
    document.head.appendChild(st);
  },

  _ensureLayer(){
    this._injectStyles();
    if (this._layer && document.body.contains(this._layer)) return this._layer;
    const layer = document.createElement('div');
    layer.className = 'hha-pop-layer';
    layer.id = 'hhaPopLayer';
    (document.querySelector('.game-wrap') || document.body).appendChild(layer);
    this._layer = layer;
    return layer;
  },

  // ---------- SCORE POP ----------
  /**
   * scorePop(x, y, text, positive, opts?)
   * opts: {
   *   rise=100, duration=900, startScale=0.9, endScale=1.25,
   *   blur=0.8, glow=true, ringColor?, ringWidth?, theme? ('goodjunk'|'groups'|'hydration'|'plate')
   * }
   */
  scorePop(x, y, text, positive, opts){
    const layer = this._ensureLayer();

    // Defaults
    opts = opts || {};
    const rise       = Number(opts.rise       != null ? opts.rise       : 100);
    const duration   = Number(opts.duration   != null ? opts.duration   : 900);
    const s0         = Number(opts.startScale != null ? opts.startScale : 0.9);
    const s1         = Number(opts.endScale   != null ? opts.endScale   : 1.25);
    const blur0      = Number(opts.blur       != null ? opts.blur       : 0.8);
    const glow       = (opts.glow !== false); // default true
    const theme      = String(opts.theme || 'goodjunk');

    // palette ต่อธีม (สุ่มหนึ่งสี)
    const PALETTES = {
      goodjunk: ['#86efac','#22c55e','#a7f3d0','#34d399'],
      groups:   ['#60a5fa','#3b82f6','#93c5fd','#38bdf8'],
      hydration:['#22d3ee','#06b6d4','#67e8f9','#7dd3fc'],
      plate:    ['#a78bfa','#8b5cf6','#c4b5fd','#f472b6']
    };
    const colors = PALETTES[theme] || PALETTES.goodjunk;
    const ringColor = opts.ringColor || colors[(Math.random()*colors.length)|0];
    const ringWidth = Number(opts.ringWidth != null ? opts.ringWidth : 4);

    // base color for text
    const txtColor = positive ? '#ffffff' : '#fca5a5';

    // DOM
    const host = document.createElement('div');
    host.className = 'hha-pop';
    host.style.left = (x|0) + 'px';
    host.style.top  = (y|0) + 'px';
    host.style.opacity = '0';
    host.style.filter = 'blur('+blur0+'px)';

    const ring = document.createElement('div');
    ring.className = 'ring';
    ring.style.width  = '64px';
    ring.style.height = '64px';
    ring.style.border = ringWidth+'px solid '+ringColor;
    if (glow) ring.style.boxShadow = '0 0 24px '+ringColor+', 0 0 42px '+ringColor+'88';

    const txtEl = document.createElement('div');
    txtEl.className = 'txt';
    txtEl.textContent = String(text!=null ? text : '');
    txtEl.style.color = txtColor;

    host.appendChild(ring);
    host.appendChild(txtEl);
    layer.appendChild(host);

    // Animate (CSS transitions via JS)
    const t0 = performance.now();
    const dur = Math.max(1, duration);
    const startY = 0;
    const endY   = -Math.abs(rise);

    // initial
    host.style.transform = 'translate(-50%,-50%) scale('+s0+')';
    // frame
    const step = ()=>{
      const t = performance.now();
      const k = Math.min(1, (t - t0)/dur);
      const ease = 1 - Math.pow(1-k, 3); // easeOutCubic

      const ty = startY + (endY - startY)*ease;
      const sc = s0 + (s1 - s0)*ease;
      const op = 0.05 + 0.95*ease;

      host.style.transform = 'translate(-50%,'+ty+'px) scale('+sc+')';
      host.style.opacity   = String(op);
      host.style.filter    = 'blur('+(blur0*(1-ease))+')';

      // shrink ring a bit
      const ringScale = 1 + 0.25*(1-ease);
      ring.style.transform = 'translate(-50%,-50%) scale('+ringScale+')';

      if (k < 1) {
        requestAnimationFrame(step);
      } else {
        // fade out quick
        host.style.transition = 'opacity .18s ease';
        host.style.opacity = '0';
        setTimeout(()=>{ try{ layer.removeChild(host); }catch(_){}; }, 200);
      }
    };
    requestAnimationFrame(step);
  },

  // ---------- SHARDS (safe DOM fallback used elsewhere) ----------
  /**
   * burstShards(host, pos, { screen:{x,y} } | { world:{...} }, theme?:string)
   * Here we only support screen coords (safe DOM).
   */
  burstShards(_host,_pos, opts){
    try{
      const layer = this._ensureLayer();
      const theme = (opts && opts.theme) || 'goodjunk';
      const x = opts && opts.screen && typeof opts.screen.x==='number' ? opts.screen.x : (window.innerWidth/2);
      const y = opts && opts.screen && typeof opts.screen.y==='number' ? opts.screen.y : (window.innerHeight/2);

      const emojis = {
        goodjunk: ['✨','✳️','🟢','💚','⭐'],
        groups:   ['✨','🔷','🔹','💙','⭐'],
        hydration:['✨','💧','🔹','🫧','⭐'],
        plate:    ['✨','🍽️','🟣','💜','⭐']
      }[theme] || ['✨','⭐','💠','✴️'];

      const N = 10 + ((Math.random()*6)|0);
      for (let i=0;i<N;i++){
        const el = document.createElement('div');
        el.className = 'hha-shard';
        el.textContent = emojis[(Math.random()*emojis.length)|0];
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
        el.style.opacity = '1';
        layer.appendChild(el);

        // random trajectory
        const ang = Math.random()*Math.PI*2;
        const dist = 30 + Math.random()*70;
        const dx = Math.cos(ang)*dist;
        const dy = Math.sin(ang)*dist - 20;
        const life = 420 + (Math.random()*260|0);

        const t0 = performance.now();
        const step = ()=>{
          const k = Math.min(1, (performance.now()-t0)/life);
          const ease = 1 - Math.pow(1-k, 2); // easeOutQuad
          el.style.transform = 'translate('+(-50+dx*ease)+'px,'+(-50+dy*ease)+'px) rotate('+(ang*30*ease)+'deg)';
          el.style.opacity = String(1-k);
          if (k<1) requestAnimationFrame(step);
          else { try{ layer.removeChild(el); }catch(_){ } }
        };
        requestAnimationFrame(step);
      }
    }catch(_){}
  }
};

export default { Particles };
