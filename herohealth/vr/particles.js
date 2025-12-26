// === /herohealth/vr/particles.js ===
// HeroHealth — Global FX layer (PRODUCTION)
// ✅ score pop + judgment text + target burst
// ✅ celebration FX: goal / mini / all
// ✅ Idempotent bind (กัน bind ซ้ำ)
// Events:
// - hha:judge {text, kind}
// - hha:celebrate {kind:'goal'|'mini'|'all'|'gold'|'boss'|'streak', text}
// - (optional) direct calls: Particles.scorePop(), Particles.burstAt()

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // prevent double bind
  root.GAME_MODULES = root.GAME_MODULES || {};
  if (root.GAME_MODULES.Particles && root.GAME_MODULES.Particles.__bound) return;

  // ---------- layer ----------
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: 999
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  const layer = ensureLayer();

  // ---------- helpers ----------
  function el(tag, styles){
    const n = doc.createElement(tag);
    if (styles) Object.assign(n.style, styles);
    return n;
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function popText(text, x, y, opts){
    opts = opts || {};
    const n = el('div', {
      position:'fixed',
      left: (x|0)+'px',
      top: (y|0)+'px',
      transform:'translate(-50%,-50%) scale(.95)',
      fontWeight:'900',
      fontSize: (opts.size || 18) + 'px',
      letterSpacing: '.2px',
      opacity: '0',
      filter: 'drop-shadow(0 10px 24px rgba(0,0,0,.45))'
    });
    n.textContent = String(text || '');
    layer.appendChild(n);

    // animate
    requestAnimationFrame(()=>{
      n.style.transition = 'transform .22s ease-out, opacity .22s ease-out';
      n.style.opacity = '1';
      n.style.transform = 'translate(-50%,-70%) scale(1.05)';
    });

    setTimeout(()=>{
      n.style.transition = 'transform .22s ease-in, opacity .22s ease-in, filter .22s ease-in';
      n.style.opacity = '0';
      n.style.transform = 'translate(-50%,-95%) scale(1.10)';
      n.style.filter = 'blur(1px)';
    }, opts.hold || 220);

    setTimeout(()=>{ try{ n.remove(); }catch(_){} }, (opts.hold||220) + 320);
  }

  function burstAt(x, y, emoji){
    const count = 10;
    for (let i=0;i<count;i++){
      const p = el('div', {
        position:'fixed',
        left:(x|0)+'px',
        top:(y|0)+'px',
        transform:'translate(-50%,-50%)',
        opacity:'0',
        fontSize: (14 + ((Math.random()*10)|0)) + 'px',
        willChange:'transform, opacity'
      });
      p.textContent = emoji || '✨';
      layer.appendChild(p);

      const a = Math.random()*Math.PI*2;
      const r = 24 + Math.random()*46;
      const dx = Math.cos(a)*r;
      const dy = Math.sin(a)*r;

      requestAnimationFrame(()=>{
        p.style.transition = 'transform .38s ease-out, opacity .16s ease-out';
        p.style.opacity = '1';
        p.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      setTimeout(()=>{
        p.style.transition = 'transform .28s ease-in, opacity .28s ease-in';
        p.style.opacity = '0';
        p.style.transform = `translate(${dx*1.2}px, ${dy*1.2}px)`;
      }, 240);

      setTimeout(()=>{ try{ p.remove(); }catch(_){} }, 620);
    }
  }

  // ---------- public API ----------
  const Particles = {
    __bound: true,

    scorePop(scoreDelta, x, y){
      const t = (scoreDelta >= 0 ? `+${scoreDelta|0}` : `${scoreDelta|0}`);
      popText(t, x||window.innerWidth/2, y||window.innerHeight/2, { size: 18, hold: 220 });
      burstAt(x||window.innerWidth/2, y||window.innerHeight/2, scoreDelta>=0?'✨':'💥');
    },

    judge(text, kind){
      const cx = window.innerWidth/2;
      const cy = Math.round(window.innerHeight*0.28);
      const label = String(text || '');
      const s = (kind === 'bad' || kind === 'warn') ? 22 : 20;
      popText(label, cx, cy, { size: s, hold: 420 });
    },

    celebrate(kind, text){
      const cx = window.innerWidth/2;
      const cy = Math.round(window.innerHeight*0.22);
      const k = String(kind||'').toLowerCase();
      const msg = text || (k==='goal'?'GOAL CLEAR!':(k==='mini'?'MINI CLEAR!':'NICE!'));

      popText(msg, cx, cy, { size: 26, hold: 520 });

      const icon =
        (k==='goal') ? '🎉' :
        (k==='mini') ? '✨' :
        (k==='all')  ? '🏆' :
        (k==='gold') ? '🟡' :
        (k==='boss') ? '💥' :
        (k==='streak') ? '🔥' : '🎊';

      // multi bursts
      for (let i=0;i<4;i++){
        const x = cx + (Math.random()*220 - 110);
        const y = cy + (Math.random()*180 - 60);
        setTimeout(()=>burstAt(x, y, icon), i*80);
      }
    },

    burstAt
  };

  // expose
  root.GAME_MODULES.Particles = Particles;
  root.Particles = Particles;

  // ---------- event bindings ----------
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    Particles.judge(d.text || 'OK', d.kind || '');
  }, { passive:true });

  root.addEventListener('hha:celebrate', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    Particles.celebrate(d.kind || '', d.text || '');
  }, { passive:true });

})(window);