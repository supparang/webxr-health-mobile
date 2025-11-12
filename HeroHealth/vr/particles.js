// === /HeroHealth/vr/particles.js
// DOM effects (safe) + scorePop (pretty), with pooling, auto CSS injection
// NEW: ringColor/ringWidth options + random ringColor per theme (goodjunk/plate/hydration/groups)

export const Particles = (function(){
  var layer = null;
  var cssInjected = false;
  var pool = [];           // pooled <span> nodes for scorePop
  var maxPool = 32;
  var zIndexBase = 9999;

  // -------- Theme Palettes (used for ringColor + shards) --------
  var THEME_COLORS = {
    goodjunk : ['#19c37d','#22d3ee','#a3e635','#34d399','#06b6d4','#4ade80'],
    plate    : ['#f59e0b','#f97316','#ef4444','#fb923c','#fbbf24','#f87171'],
    hydration: ['#3b82f6','#0ea5e9','#22d3ee','#60a5fa','#38bdf8','#93c5fd'],
    groups   : ['#a78bfa','#22c55e','#f43f5e','#e879f9','#10b981','#f472b6'],
    "default": ['#ffffff','#e5e7eb','#cbd5e1']
  };

  function themeColor(theme){
    var arr = THEME_COLORS[theme] || THEME_COLORS["default"];
    var i = Math.floor(Math.random()*arr.length);
    return arr[i];
  }

  // ---------- Utils ----------
  function ensureLayer(){
    if (!layer) {
      layer = document.getElementById('fx-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'fx-layer';
        layer.setAttribute('aria-hidden','true');
        document.body.appendChild(layer);
      }
    }
    if (!cssInjected) injectCSS();
    return layer;
  }

  function injectCSS(){
    cssInjected = true;
    var style = document.createElement('style');
    style.id = 'fx-style';
    style.textContent = [
      '#fx-layer{position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:'+zIndexBase+';}',
      '.fx-pop{position:absolute;will-change:transform,opacity,filter;transform:translate(-50%,-50%) scale(1);',
      ' font-family: ui-rounded, system-ui, "Segoe UI", "Noto Color Emoji", "Apple Color Emoji", sans-serif;',
      ' font-weight:800; text-shadow:0 1px 0 rgba(0,0,0,.1);',
      ' filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));}',
      '.fx-pop.pos{color:#19c37d;} /* positive (green) */',
      '.fx-pop.neg{color:#ff5a5f;} /* negative (red)   */',
      '.fx-pop.neu{color:#f5c518;} /* neutral (amber)  */',
      '.fx-ring{position:absolute;left:50%;top:50%;width:10px;height:10px;transform:translate(-50%,-50%) scale(0.75);',
      ' border-radius:999px;opacity:0.55;pointer-events:none;}'
    ].join('');
    document.head.appendChild(style);
  }

  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function clamp(n,a,b){ return n<a?a:(n>b?b:n); }

  function acquireSpan(){
    for (var i=0;i<pool.length;i++){
      var it = pool[i];
      if (!it.busy) { it.busy = true; it.el.style.display='block'; it.el.style.opacity='1'; return it; }
    }
    if (pool.length < maxPool){
      var el = document.createElement('span');
      el.className = 'fx-pop neu';
      el.style.display='block';
      ensureLayer().appendChild(el);
      var rec = { el: el, busy: true };
      pool.push(rec);
      return rec;
    }
    var r = pool[0];
    r.busy = true; r.el.style.display='block'; r.el.style.opacity='1';
    return r;
  }

  function releaseSpan(rec){
    if (!rec) return;
    rec.busy = false;
    var el = rec.el;
    el.style.display='none';
  }

  // ---------- Public: scorePop ----------
  /**
   * scorePop(x, y, text, isPositive, opts?)
   * x,y: screen coords (px), text: string/number, isPositive: true/false/null
   * opts:
   *  - theme: 'goodjunk'|'plate'|'hydration'|'groups' (for random ringColor)
   *  - glow: true/false (enable ring)
   *  - ringColor: override color (defaults to random by theme if glow)
   *  - ringWidth: px (default 2)
   *  - duration (ms), rise (px), startScale, endScale, blur (px)
   *  - color: override text color (CSS color string)
   */
  function scorePop(x, y, text, isPositive, opts){
    try {
      ensureLayer();
      var o = opts || {};
      var duration   = Number(o.duration || 750);
      var rise       = Number(o.rise || 80);
      var startScale = Number(o.startScale || 0.9);
      var endScale   = Number(o.endScale || 1.25);
      var blurMax    = Number(o.blur || 0);
      var glow       = !!o.glow;
      var theTheme   = o.theme || null;

      // acquire DOM node
      var rec = acquireSpan();
      var el  = rec.el;

      el.textContent = String(text);
      var cls = 'fx-pop ';
      if (isPositive===true) cls += 'pos';
      else if (isPositive===false) cls += 'neg';
      else cls += 'neu';
      el.className = cls;
      if (o.color){ el.style.color = o.color; } else { el.style.color = ''; }

      var startX = clamp(x, 8, window.innerWidth  - 8);
      var startY = clamp(y, 8, window.innerHeight - 8);

      // --- ring (glow) with theme-based random color ---
      if (glow){
        var ring = el.querySelector('.fx-ring');
        if (!ring){
          ring = document.createElement('i');
          ring.className='fx-ring';
          el.appendChild(ring);
        }
        var rc = (typeof o.ringColor === 'string') ? o.ringColor : themeColor(theTheme||'default');
        var rw = Number(o.ringWidth || 2);
        ring.style.border = rw+'px solid '+rc;
        ring.style.transform='translate(-50%,-50%) scale(0.75)';
        ring.style.opacity='0.55';
      } else {
        var oldRing = el.querySelector('.fx-ring');
        if (oldRing) oldRing.remove();
      }

      // animation via rAF
      var t0 = performance.now();
      function step(now){
        if (!rec.busy) return;
        var dt = now - t0;
        var k  = clamp(dt / duration, 0, 1);
        var e  = easeOutCubic(k);
        var curY = startY - (rise * e);
        var sc   = startScale + (endScale - startScale) * e;
        var op   = 1 - k;
        var blur = blurMax ? (blurMax * (1 - e)) : 0;

        el.style.transform = 'translate(-50%,-50%) translate('+startX+'px,'+curY+'px) scale('+sc+')';
        el.style.opacity   = String(op);
        el.style.filter    = (blur>0 ? ('blur('+blur.toFixed(1)+'px) drop-shadow(0 2px 4px rgba(0,0,0,.35))') : 'drop-shadow(0 2px 4px rgba(0,0,0,.35))');

        if (glow){
          var ringEl = el.querySelector('.fx-ring');
          if (ringEl){
            var rSc = 0.75 + 0.75*e;
            var rOp = 0.55 * (1 - e);
            ringEl.style.transform = 'translate(-50%,-50%) scale('+rSc+')';
            ringEl.style.opacity   = String(rOp);
          }
        }
        if (k < 1) requestAnimationFrame(step);
        else releaseSpan(rec);
      }

      el.style.left = startX+'px';
      el.style.top  = startY+'px';
      el.style.zIndex = String(zIndexBase + 1);
      requestAnimationFrame(step);

      // subtle haptic (positive only)
      try { if (isPositive && navigator && navigator.vibrate) navigator.vibrate(8); } catch(_){}

    } catch(e) { /* silent fail-safe */ }
  }

  // ---------- Public: burstShards (theme-colored DOM confetti) ----------
  /**
   * burstShards(host, pos, opts)
   * opts.screen = {x,y}, opts.theme selects color palette
   */
  function burstShards(host, pos, opts){
    try{
      ensureLayer();
      var s = (opts && opts.screen) ? opts.screen : {x: (window.innerWidth/2|0), y:(window.innerHeight/2|0)};
      var th = (opts && opts.theme) ? String(opts.theme) : 'default';
      var palette = THEME_COLORS[th] || THEME_COLORS["default"];
      var n = 12;
      for (var i=0;i<n;i++){
        var dot = document.createElement('b');
        dot.style.position='absolute';
        dot.style.left = s.x+'px';
        dot.style.top  = s.y+'px';
        var clr = palette[(Math.random()*palette.length)|0];
        dot.style.background = clr;
        dot.style.width='6px'; dot.style.height='6px';
        dot.style.borderRadius='999px';
        dot.style.filter='drop-shadow(0 2px 4px rgba(0,0,0,.35))';
        dot.style.zIndex = String(zIndexBase);
        ensureLayer().appendChild(dot);

        (function(dot){
          var a = Math.random()*Math.PI*2;
          var v = 70 + Math.random()*140;
          var life = 350 + Math.random()*300;
          var grav = 60 + Math.random()*40;
          var t0 = performance.now();
          (function step(now){
            var k = (now - t0)/life;
            if (k>=1){ dot.remove(); return; }
            var e = easeOutCubic(k);
            var x = s.x + Math.cos(a)*v*e;
            var y = s.y + Math.sin(a)*v*e + grav*e; // gravity curve
            dot.style.left = x+'px';
            dot.style.top  = y+'px';
            dot.style.opacity = String(1-k);
            requestAnimationFrame(step);
          })(t0);
        })(dot);
      }
    }catch(_){}
  }

  // ---------- Convenience Presets ----------
  function scorePopNice(x,y,text,positive,theme){
    return scorePop(x,y,String(text),!!positive,{
      glow:true, theme: theme||'default',
      rise:120, duration:1000, startScale:0.85, endScale:1.35, blur:1.5,
      // ringColor omitted → random by theme
      ringWidth:3
    });
  }

  // Clean up when page hidden (optional)
  document.addEventListener('visibilitychange', function(){
    if (document.hidden){
      for (var i=0;i<pool.length;i++){
        if (pool[i] && pool[i].el){ pool[i].el.remove(); }
      }
      pool.length = 0;
      layer = null;
      cssInjected = false;
    }
  });

  return { scorePop, scorePopNice, burstShards };
})();
