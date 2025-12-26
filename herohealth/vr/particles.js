// === /herohealth/vr/particles.js ===
// HeroHealth — Simple FX layer: score pop + judgment text + target burst (แรงขึ้น)
// + Celebration FX สำหรับ Quest (Goal / Mini / All Complete)
// ✅ รองรับ hha:celebrate + กัน bind ซ้ำ

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // Guard: prevent double bind
  if (root.__HHA_PARTICLES_BOUND__) return;
  root.__HHA_PARTICLES_BOUND__ = true;

  // ----- create FX layer -----
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden'
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  const layer = ensureLayer();

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function rnd(a,b){ return a + Math.random()*(b-a); }

  // ----- score pop -----
  function scorePop(text, x, y, opts){
    opts = opts || {};
    const el = doc.createElement('div');
    el.className = 'hha-score-pop';
    el.textContent = String(text || '');
    const sz = clamp(opts.size || 18, 12, 44);

    Object.assign(el.style, {
      position: 'absolute',
      left: (x|0) + 'px',
      top: (y|0) + 'px',
      transform: 'translate(-50%,-50%)',
      fontSize: sz + 'px',
      fontWeight: '900',
      letterSpacing: '.2px',
      color: 'rgba(229,231,235,.96)',
      textShadow: '0 10px 30px rgba(0,0,0,.55)',
      opacity: '0',
      willChange: 'transform, opacity',
      filter: 'drop-shadow(0 10px 24px rgba(0,0,0,.45))'
    });

    layer.appendChild(el);

    const dy = opts.dy != null ? opts.dy : -50;
    const sx = opts.sx != null ? opts.sx : 1.08;

    // animate
    requestAnimationFrame(()=>{
      el.style.transition = 'transform .42s ease-out, opacity .42s ease-out';
      el.style.opacity = '1';
      el.style.transform = `translate(-50%,-50%) translate3d(0, ${dy}px, 0) scale(${sx})`;
    });

    setTimeout(()=>{
      el.style.transition = 'transform .26s ease-in, opacity .26s ease-in';
      el.style.opacity = '0';
      el.style.transform = `translate(-50%,-50%) translate3d(0, ${dy-16}px, 0) scale(${sx*1.02})`;
    }, 380);

    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 700);
  }

  // ----- judgment -----
  function judgeText(text, kind){
    const el = doc.createElement('div');
    el.className = 'hha-judge';
    el.textContent = String(text || '');
    const k = String(kind || 'ok');

    const top = 0.62 * (root.innerHeight || 640);
    Object.assign(el.style, {
      position: 'absolute',
      left: '50%',
      top: top + 'px',
      transform: 'translate(-50%,-50%) scale(.96)',
      padding: '10px 14px',
      borderRadius: '16px',
      fontWeight: '1000',
      letterSpacing: '.8px',
      fontSize: '18px',
      color: '#e5e7eb',
      background: 'rgba(2,6,23,.55)',
      border: '1px solid rgba(148,163,184,.18)',
      textShadow: '0 10px 30px rgba(0,0,0,.55)',
      opacity: '0',
      willChange: 'transform, opacity'
    });

    if (k === 'bad' || k === 'warn'){
      el.style.borderColor = 'rgba(239,68,68,.24)';
      el.style.boxShadow = '0 18px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(239,68,68,.08)';
    } else {
      el.style.borderColor = 'rgba(34,211,238,.22)';
      el.style.boxShadow = '0 18px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(34,211,238,.10)';
    }

    layer.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    setTimeout(()=>{
      el.style.transition = 'transform .26s ease-in, opacity .26s ease-in';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(1.03)';
    }, 520);

    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 900);
  }

  // ----- burst particles at (x,y) -----
  function burstAt(x, y, opts){
    opts = opts || {};
    const n = clamp(opts.n || 14, 6, 40);
    for (let i=0;i<n;i++){
      const p = doc.createElement('div');
      p.className = 'hha-burst';
      const size = rnd(6, 14);
      const ang  = rnd(0, Math.PI*2);
      const spd  = rnd(120, 340);
      const vx   = Math.cos(ang) * spd;
      const vy   = Math.sin(ang) * spd;
      const rot  = rnd(-120, 120);

      Object.assign(p.style, {
        position: 'absolute',
        left: (x|0) + 'px',
        top: (y|0) + 'px',
        width: size + 'px',
        height: size + 'px',
        borderRadius: '999px',
        background: 'rgba(34,211,238,.92)',
        opacity: '0.0',
        transform: 'translate(-50%,-50%)',
        willChange: 'transform, opacity, filter'
      });

      layer.appendChild(p);

      requestAnimationFrame(()=>{
        p.style.transition = 'transform .55s ease-out, opacity .10s ease-out';
        p.style.opacity = '1';
        p.style.transform = `translate(-50%,-50%) translate3d(${vx}px, ${vy}px, 0) rotate(${rot}deg)`;
      });

      setTimeout(()=>{
        p.style.transition = 'opacity .22s ease-in, filter .22s ease-in';
        p.style.opacity = '0';
        p.style.filter = 'blur(1px)';
      }, 320);

      setTimeout(()=>{ try{ p.remove(); }catch(_){} }, 720);
    }
  }

  // ----- celebration big -----
  function celebrate(kind, text){
    const k = String(kind||'goal');
    const msg = String(text || (k === 'mini' ? 'MINI CLEAR!' : 'GOAL CLEAR!'));

    const el = doc.createElement('div');
    el.className = 'hha-celebrate';

    Object.assign(el.style, {
      position: 'absolute',
      left: '50%',
      top: '32%',
      transform: 'translate(-50%,-50%) scale(.92)',
      padding: '14px 18px',
      borderRadius: '22px',
      fontWeight: '1000',
      letterSpacing: '.8px',
      fontSize: '26px',
      color: '#081019',
      opacity: '0',
      willChange: 'transform, opacity',
      boxShadow: '0 24px 90px rgba(0,0,0,.55)',
      background: (k === 'mini')
        ? 'linear-gradient(90deg, rgba(167,139,250,.95), rgba(34,211,238,.92))'
        : 'linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.92))'
    });

    el.textContent = msg;
    layer.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    // confetti burst around center
    const cx = (root.innerWidth||360)/2;
    const cy = (root.innerHeight||640)*0.32;
    burstAt(cx, cy, { n: 26 });

    setTimeout(()=>{
      el.style.transition = 'transform .26s ease-in, opacity .26s ease-in';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(1.04)';
    }, 720);

    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 1100);
  }

  // ----- event listeners -----
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    judgeText(d.text || 'OK', d.kind || 'ok');
  }, { passive:true });

  root.addEventListener('hha:celebrate', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    celebrate(d.kind || 'goal', d.text || '');
  }, { passive:true });

  // Expose for engines
  root.Particles = root.Particles || {};
  root.Particles.scorePop = function(text, x, y, opts){ scorePop(text, x, y, opts); };
  root.Particles.burstAt  = function(x, y, opts){ burstAt(x, y, opts); };
  root.Particles.celebrate = function(kind, text){ celebrate(kind, text); };

})(window);