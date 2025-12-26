// === /herohealth/vr-groups/groups-fx.js ===
// Food Groups VR — FX Layer (IIFE) — FULL LATEST
// ✅ scorePop / judgeText / burstAt (spark/confetti)
// ✅ afterimage (target ghost)
// ✅ celebrate listener (hha:celebrate -> GOAL/MINI/ALL)
// ✅ groups:stun / groups:group_change optional helpers
// ✅ Safe: idempotent bind, no hard dependency on other modules

(function (root) {
  'use strict';

  const W = root;
  const DOC = W.document;
  if (!DOC) return;

  const NS = (W.GroupsFX = W.GroupsFX || {});
  if (NS.__bound) return;
  NS.__bound = true;

  // ---------------- helpers ----------------
  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function el(tag, cls){
    const e = DOC.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function px(n){ return (Math.round(Number(n)||0)) + 'px'; }

  // ---------------- ensure FX root layer ----------------
  function ensureLayer(){
    let layer = DOC.querySelector('.fg-fx-layer');
    if (layer) return layer;

    layer = el('div','fg-fx-layer');
    Object.assign(layer.style, {
      position:'fixed',
      inset:'0',
      zIndex: 40,
      pointerEvents:'none',
      overflow:'hidden'
    });
    DOC.body.appendChild(layer);
    return layer;
  }

  // ---------------- floating text ----------------
  function popText(text, x, y, kind){
    const layer = ensureLayer();
    const node = el('div', 'fg-fx-pop');
    node.textContent = String(text || '');
    const k = String(kind || '').toLowerCase();

    Object.assign(node.style, {
      position:'fixed',
      left: px(x),
      top: px(y),
      transform:'translate(-50%,-50%)',
      fontWeight:'900',
      letterSpacing:'.3px',
      fontSize: '18px',
      opacity:'0',
      filter:'drop-shadow(0 10px 26px rgba(0,0,0,.45))',
      willChange:'transform, opacity',
      transition:'transform .30s ease, opacity .30s ease'
    });

    // color by kind
    let color = 'rgba(229,231,235,.96)';
    if (k === 'good' || k === 'score' || k === 'ok') color = 'rgba(34,197,94,.98)';
    if (k === 'warn') color = 'rgba(245,158,11,.98)';
    if (k === 'bad' || k === 'miss') color = 'rgba(239,68,68,.98)';
    if (k === 'mini') color = 'rgba(167,139,250,.98)';
    if (k === 'goal') color = 'rgba(34,211,238,.98)';
    node.style.color = color;

    layer.appendChild(node);

    // animate in/out
    requestAnimationFrame(()=>{
      node.style.opacity = '1';
      node.style.transform = 'translate(-50%,-68%) scale(1.06)';
    });
    setTimeout(()=>{
      node.style.opacity = '0';
      node.style.transform = 'translate(-50%,-96%) scale(.98)';
    }, 420);

    setTimeout(()=>{
      try{ node.remove(); }catch(_){}
    }, 900);
  }

  // ---------------- burst particles ----------------
  function burstAt(x, y, opts){
    const layer = ensureLayer();
    opts = opts || {};
    const n = clamp(opts.n != null ? opts.n : 14, 6, 28);
    const spread = clamp(opts.spread != null ? opts.spread : 86, 40, 150);
    const life = clamp(opts.life != null ? opts.life : 520, 280, 900);
    const kind = String(opts.kind || '').toLowerCase();

    for (let i=0;i<n;i++){
      const p = el('div', 'fg-fx-dot');
      const ang = Math.random()*Math.PI*2;
      const r = spread * (0.35 + Math.random()*0.75);
      const dx = Math.cos(ang)*r;
      const dy = Math.sin(ang)*r;

      const size = (kind === 'confetti') ? (4 + Math.random()*6) : (3 + Math.random()*5);
      Object.assign(p.style, {
        position:'fixed',
        left:px(x),
        top:px(y),
        width:px(size),
        height:px(size),
        borderRadius: (kind === 'confetti') ? '4px' : '999px',
        opacity:'0',
        transform:'translate(-50%,-50%)',
        willChange:'transform, opacity'
      });

      // color palette
      let bg = 'rgba(229,231,235,.95)';
      if (kind === 'good') bg = 'rgba(34,197,94,.95)';
      if (kind === 'bad') bg = 'rgba(239,68,68,.95)';
      if (kind === 'warn') bg = 'rgba(245,158,11,.95)';
      if (kind === 'mini') bg = 'rgba(167,139,250,.95)';
      if (kind === 'goal') bg = 'rgba(34,211,238,.95)';
      if (kind === 'confetti'){
        const cands = [
          'rgba(34,197,94,.95)',
          'rgba(34,211,238,.95)',
          'rgba(167,139,250,.95)',
          'rgba(245,158,11,.95)',
          'rgba(239,68,68,.95)',
          'rgba(229,231,235,.95)'
        ];
        bg = cands[(Math.random()*cands.length)|0];
      }
      p.style.background = bg;
      p.style.boxShadow = '0 10px 24px rgba(0,0,0,.35)';

      layer.appendChild(p);

      const rot = (Math.random()*260 - 130);
      const s0 = 0.8 + Math.random()*0.4;
      const s1 = 0.6 + Math.random()*0.5;

      // animate
      requestAnimationFrame(()=>{
        p.style.opacity = '1';
        p.style.transform = `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${s0})`;
        p.style.transition = `transform ${life}ms ease-out, opacity ${life}ms ease-out`;
      });

      setTimeout(()=>{
        p.style.opacity = '0';
        p.style.transform = `translate(-50%,-50%) translate(${dx*1.15}px,${dy*1.15}px) rotate(${rot*1.6}deg) scale(${s1})`;
      }, 30);

      setTimeout(()=>{
        try{ p.remove(); }catch(_){}
      }, life + 80);
    }
  }

  // ---------------- afterimage (ghost) ----------------
  function afterimage(emoji, x, y, variant){
    const layer = ensureLayer();
    const wrap = el('div', 'fg-afterimage ' + (variant || 'a1'));
    wrap.style.setProperty('--x', px(x));
    wrap.style.setProperty('--y', px(y));
    Object.assign(wrap.style, {
      left:'0', top:'0'
    });

    const inner = el('div','fg-afterimage-inner');
    inner.textContent = String(emoji || '✨');

    wrap.appendChild(inner);
    layer.appendChild(wrap);

    setTimeout(()=>{ try{ wrap.remove(); }catch(_){ } }, 280);
  }

  // ---------------- public API ----------------
  function scorePop(amount, x, y){
    const t = (amount >= 0 ? `+${amount}` : `${amount}`);
    popText(t, x, y, amount >= 0 ? 'good' : 'bad');
    burstAt(x, y, { kind: amount >= 0 ? 'good' : 'bad', n: 10 });
  }

  function judgeText(text, x, y, kind){
    popText(text, x, y, kind || 'score');
    burstAt(x, y, { kind: kind || 'score', n: 12 });
  }

  // ---------------- event bindings ----------------
  // 1) celebrate (Goal/Mini/All)
  W.addEventListener('hha:celebrate', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind || 'goal').toLowerCase();
    const text = d.text || (kind === 'mini' ? 'MINI CLEAR!' : 'GOAL CLEAR!');

    const cx = (window.innerWidth||360)/2;
    const cy = Math.min((window.innerHeight||640)*0.34, 220);

    popText(text, cx, cy, kind);
    burstAt(cx, cy, { kind:'confetti', n: 20, spread: 120, life: 650 });

    // small screen shake (soft) for celebrate
    DOC.documentElement.classList.add('swapflash');
    setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 180);
  }, { passive:true });

  // 2) stun feedback helper
  W.addEventListener('groups:stun', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d && d.on){
      const cx = (window.innerWidth||360)/2;
      const cy = (window.innerHeight||640)/2;
      popText('STUN!', cx, cy, 'bad');
      burstAt(cx, cy, { kind:'bad', n: 14, spread: 95, life: 520 });
    }
  }, { passive:true });

  // 3) optional: group change banner pop (ถ้า HTML มี .group-banner ก็ให้เด้ง)
  W.addEventListener('groups:group_change', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const label = d.label ? String(d.label) : '';
    const banner = DOC.querySelector('.group-banner');
    const txt = DOC.querySelector('.group-banner-text');
    if (txt && label) txt.textContent = `เปลี่ยนเป็น ${label}`;
    if (banner){
      banner.classList.remove('pop');
      // force reflow
      void banner.offsetWidth;
      banner.classList.add('pop');
    } else if (label){
      const cx = (window.innerWidth||360)/2;
      const cy = Math.min((window.innerHeight||640)*0.22, 150);
      popText(`🔁 ${label}`, cx, cy, 'goal');
    }
  }, { passive:true });

  // 4) lock ring visuals (moves ring to target center)
  // expects your HTML has .lock-ring + children .lock-prog .lock-charge
  W.addEventListener('groups:lock', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const ring = DOC.querySelector('.lock-ring');
    if (!ring) return;

    if (!d.on){
      ring.style.opacity = '0';
      return;
    }

    ring.style.opacity = '1';
    ring.style.left = px(d.x || (window.innerWidth/2));
    ring.style.top  = px(d.y || (window.innerHeight/2));

    ring.style.setProperty('--p', clamp(d.prog,0,1));
    ring.style.setProperty('--c', clamp(d.charge,0,1));

    // afterimage on lock progress peaks (tiny)
    if ((d.prog||0) > 0.85 && (d.prog||0) < 0.92){
      // try read emoji from target under ring
      const under = DOC.elementFromPoint(d.x||0, d.y||0);
      const emoji = under && under.textContent ? under.textContent.trim().slice(0,2) : '✨';
      afterimage(emoji, d.x||0, d.y||0, 'a2');
    }
  }, { passive:true });

  // expose API
  NS.ensureLayer = ensureLayer;
  NS.scorePop = scorePop;
  NS.judgeText = judgeText;
  NS.burstAt = burstAt;
  NS.afterimage = afterimage;

})(window);