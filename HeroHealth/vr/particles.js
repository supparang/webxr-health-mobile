// === /HeroHealth/vr/particles.js
// DOM effects (safe) + scorePop (pretty), with pooling & auto CSS injection

export const Particles = (function(){
  var layer = null;
  var cssInjected = false;
  var pool = [];          // pooled <span> nodes for scorePop
  var maxPool = 32;       // reasonable upper bound
  var zIndexBase = 9999;

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
      // subtle glow rings
      '.fx-pop::after{content:"";position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%);',
      ' border-radius:999px;pointer-events:none;}',
    ].join('');
    document.head.appendChild(style);
  }

  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function clamp(n,a,b){ return n<a?a:(n>b?b:n); }

  function acquireSpan(){
    // find free one
    for (var i=0;i<pool.length;i++){
      var it = pool[i];
      if (!it.busy) { it.busy = true; it.el.style.display='block'; it.el.style.opacity='1'; return it; }
    }
    // create new if under cap
    if (pool.length < maxPool){
      var el = document.createElement('span');
      el.className = 'fx-pop neu';
      el.style.display='block';
      ensureLayer().appendChild(el);
      var rec = { el: el, busy: true };
      pool.push(rec);
      return rec;
    }
    // recycle the oldest
    var r = pool[0];
    r.busy = true; r.el.style.display='block'; r.el.style.opacity='1';
    return r;
  }

  function releaseSpan(rec){
    if (!rec) return;
    rec.busy = false;
    var el = rec.el;
    // hide but keep for reuse
    el.style.display='none';
  }

  // ---------- Public: scorePop ----------
  /**
   * scorePop(x, y, text, isPositive, opts?)
   * x,y: screen coords (pixels)
   * text: string/number (e.g., '+40', '-15', '0')
   * isPositive: true/false determines color; if null -> neutral
   * opts: { duration, rise, startScale, endScale, blur, glow }
   */
  function scorePop(x, y, text, isPositive, opts){
    try {
      ensureLayer();
      var o = opts || {};
      var duration   = Number(o.duration || 750);   // ms
      var rise       = Number(o.rise || 80);        // px up
      var startScale = Number(o.startScale || 0.9);
      var endScale   = Number(o.endScale || 1.25);
      var blurMax    = Number(o.blur || 0);         // px (0 = none)
      var glow       = !!o.glow;                    // add expanding ring

      // acquire DOM node
      var rec = acquireSpan();
      var el  = rec.el;

      // content + class
      el.textContent = String(text);
      var cls = 'fx-pop ';
      if (isPositive===true) cls += 'pos';
      else if (isPositive===false) cls += 'neg';
      else cls += 'neu';
      el.className = cls;

      // place at start
      var startX = clamp(x, 8, window.innerWidth  - 8);
      var startY = clamp(y, 8, window.innerHeight - 8);

      // optional glow ring (pseudo-element alt)
      if (glow){
        // use a real child for predictable perf on older webviews
        var ring = document.createElement('i');
        ring.style.position='absolute';
        ring.style.left='50%'; ring.style.top='50%';
        ring.style.width='10px'; ring.style.height='10px';
        ring.style.border='2px solid currentColor';
        ring.style.borderRadius='999px';
        ring.style.opacity='0.55';
        ring.style.transform='translate(-50%,-50%) scale(0.75)';
        ring.style.pointerEvents='none';
        ring.className='fx-ring';
        // clear previous ring
        var old = el.querySelector('.fx-ring');
        if (old) old.remove();
        el.appendChild(ring);
      } else {
        var oldRing = el.querySelector('.fx-ring');
        if (oldRing) oldRing.remove();
      }

      // animation via rAF
      var t0 = performance.now();
      var last = t0;

      function step(now){
        if (!rec.busy) return; // aborted/recycled
        var dt = now - t0;
        var k  = clamp(dt / duration, 0, 1);
        var e  = easeOutCubic(k);

        var curY = startY - (rise * e);
        var sc   = startScale + (endScale - startScale) * e;
        var op   = 1 - k; // fade out

        var blur = blurMax ? (blurMax * (1 - e)) : 0;
        el.style.transform = 'translate(-50%,-50%) translate('+startX+'px,'+curY+'px) scale('+sc+')';
        el.style.opacity   = String(op);
        el.style.filter    = (blur>0 ? ('blur('+blur.toFixed(1)+'px) drop-shadow(0 2px 4px rgba(0,0,0,.35))') : 'drop-shadow(0 2px 4px rgba(0,0,0,.35))');

        // ring anim
        if (glow){
          var ringEl = el.querySelector('.fx-ring');
          if (ringEl){
            var rSc = 0.75 + 0.75*e;
            var rOp = 0.55 * (1 - e);
            ringEl.style.transform = 'translate(-50%,-50%) scale('+rSc+')';
            ringEl.style.opacity   = String(rOp);
          }
        }

        if (k < 1){
          requestAnimationFrame(step);
        } else {
          releaseSpan(rec);
        }
        last = now;
      }
      // place before first frame
      el.style.left = startX+'px';
      el.style.top  = startY+'px';
      el.style.zIndex = String(zIndexBase + 1);
      requestAnimationFrame(step);

      // subtle haptic (if allowed)
      try { if (isPositive && navigator && navigator.vibrate) navigator.vibrate(8); } catch(_){}

    } catch(e) { /* fail-safe: no throw */ }
  }

  // ---------- Public: burstShards (stub/simple DOM confetti) ----------
  // คุณมีเวอร์ชันใช้งานจริงอยู่แล้วได้ — ด้านล่างเป็นสั้น ๆ ปลอดภัย
  function burstShards(host, pos, opts){
    // Minimal safe placeholder to avoid runtime error if not provided
    // If you already implemented real shards, keep yours — this will be ignored.
    // opts.screen = {x,y}
    try{
      ensureLayer();
      var s = (opts && opts.screen) ? opts.screen : {x: (window.innerWidth/2|0), y:(window.innerHeight/2|0)};
      // tiny spark
      for (var i=0;i<10;i++){
        var dot = document.createElement('b');
        dot.style.position='absolute';
        dot.style.left = s.x+'px';
        dot.style.top  = s.y+'px';
        dot.style.width='6px'; dot.style.height='6px';
        dot.style.borderRadius='999px';
        dot.style.background='rgba(255,255,255,.85)';
        dot.style.filter='drop-shadow(0 2px 4px rgba(0,0,0,.35))';
        dot.style.zIndex = String(zIndexBase);
        ensureLayer().appendChild(dot);

        (function(dot){
          var a = Math.random()*Math.PI*2;
          var v = 50 + Math.random()*120;
          var life = 350 + Math.random()*300;
          var t0 = performance.now();
          (function step(now){
            var k = (now - t0)/life;
            if (k>=1){ dot.remove(); return; }
            var e = easeOutCubic(k);
            var x = s.x + Math.cos(a)*v*e;
            var y = s.y + Math.sin(a)*v*e + 40*e; // little gravity
            dot.style.left = x+'px';
            dot.style.top  = y+'px';
            dot.style.opacity = String(1-k);
            requestAnimationFrame(step);
          })(t0);
        })(dot);
      }
    }catch(_){}
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

  return { scorePop, burstShards };
})();
