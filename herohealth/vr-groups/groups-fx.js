/* === /herohealth/vr-groups/groups-fx.js ===
Candy FX Pack (Grade 5)
- sparkle stars spawn/hit
- GOOD: trail glitter (attached element)
- JUNK: cute smoke/slime (non-scary)
- Works via MutationObserver + pointer capture (no engine changes required)
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const layer = DOC.getElementById('fg-layer') || DOC.querySelector('.fg-layer');
  if (!layer) return;

  // ---------- inject CSS for FX ----------
  const STYLE_ID = 'groupsCandyFxStyle';
  if (!DOC.getElementById(STYLE_ID)) {
    const st = DOC.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
/* Candy FX overlay */
.fg-fx-layer{
  position:fixed; inset:0; pointer-events:none; z-index:60;
}
.fg-spark{
  position:fixed;
  left:0; top:0;
  transform: translate(-50%,-50%);
  pointer-events:none;
  width:1px; height:1px;
}
.fg-star{
  position:absolute;
  left:0; top:0;
  transform: translate(-50%,-50%);
  font-size: 14px;
  filter: drop-shadow(0 10px 16px rgba(0,0,0,.30));
  opacity:0;
  animation: starPop .55s ease-out forwards;
}
@keyframes starPop{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.55) rotate(0deg); }
  25%{ opacity:1; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.15) rotate(18deg); }
  100%{ opacity:0; transform:translate(calc(-50% + var(--dx2)), calc(-50% + var(--dy2))) scale(.90) rotate(52deg); }
}

/* GOOD trail glitter */
.fg-trail{
  position:absolute;
  left:50%; top:50%;
  transform: translate(-50%, -50%);
  width: 120%;
  height: 120%;
  border-radius: 30px;
  pointer-events:none;
  opacity:.85;
  mix-blend-mode: screen;
  filter: blur(.2px);
  background:
    radial-gradient(circle at 30% 35%, rgba(255,255,255,.22), rgba(255,255,255,0) 45%),
    radial-gradient(circle at 75% 70%, rgba(255,255,255,.18), rgba(255,255,255,0) 48%),
    radial-gradient(circle at 55% 20%, rgba(34,211,238,.20), rgba(34,211,238,0) 50%),
    radial-gradient(circle at 25% 75%, rgba(244,114,182,.18), rgba(244,114,182,0) 55%);
  animation: trailWink 1.05s ease-in-out infinite;
}
@keyframes trailWink{
  0%,100%{ opacity:.62; transform: translate(-50%,-50%) scale(1.00); }
  50%{ opacity:.95; transform: translate(-50%,-50%) scale(1.06); }
}

/* JUNK smoke (cute puff) */
.fg-puff{
  position:fixed;
  transform: translate(-50%,-50%);
  pointer-events:none;
  width: 24px; height: 24px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.24), rgba(244,114,182,.20));
  filter: drop-shadow(0 10px 16px rgba(0,0,0,.25));
  opacity:0;
  animation: puff .7s ease-out forwards;
}
@keyframes puff{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.55); }
  25%{ opacity:1; transform:translate(-50%,-50%) scale(1.00); }
  100%{ opacity:0; transform:translate(-50%, calc(-50% - 18px)) scale(1.25); }
}

/* JUNK slime splat (cute) */
.fg-splat{
  position:fixed;
  transform: translate(-50%,-50%);
  pointer-events:none;
  width: 86px; height: 58px;
  border-radius: 999px;
  opacity:0;
  background:
    radial-gradient(circle at 25% 50%, rgba(34,197,94,.28), rgba(34,197,94,0) 55%),
    radial-gradient(circle at 65% 45%, rgba(34,211,238,.20), rgba(34,211,238,0) 60%),
    radial-gradient(circle at 45% 65%, rgba(255,255,255,.18), rgba(255,255,255,0) 55%);
  filter: drop-shadow(0 14px 18px rgba(0,0,0,.25));
  animation: splat .55s ease-out forwards;
}
@keyframes splat{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.55) rotate(-6deg); }
  30%{ opacity:1; transform:translate(-50%,-50%) scale(1.05) rotate(6deg); }
  100%{ opacity:0; transform:translate(-50%, calc(-50% + 10px)) scale(.95) rotate(12deg); }
}
`;
    DOC.head.appendChild(st);
  }

  // ---------- FX layer ----------
  let fx = DOC.querySelector('.fg-fx-layer');
  if (!fx) {
    fx = DOC.createElement('div');
    fx.className = 'fg-fx-layer';
    DOC.body.appendChild(fx);
  }

  function centerOf(el){
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  function sparkle(x, y, power){
    const host = DOC.createElement('div');
    host.className = 'fg-spark';
    host.style.left = x + 'px';
    host.style.top  = y + 'px';

    const n = Math.max(6, Math.min(14, (power|0)));
    const stars = ['✨','⭐','💫','🌟'];
    for (let i=0;i<n;i++){
      const s = DOC.createElement('div');
      s.className = 'fg-star';
      s.textContent = stars[(Math.random()*stars.length)|0];

      const a = Math.random()*Math.PI*2;
      const r1 = 16 + Math.random()*22;
      const r2 = 34 + Math.random()*36;
      const dx = Math.cos(a)*r1;
      const dy = Math.sin(a)*r1;
      const dx2= Math.cos(a)*r2;
      const dy2= Math.sin(a)*r2;
      s.style.setProperty('--dx',  dx.toFixed(1)+'px');
      s.style.setProperty('--dy',  dy.toFixed(1)+'px');
      s.style.setProperty('--dx2', dx2.toFixed(1)+'px');
      s.style.setProperty('--dy2', dy2.toFixed(1)+'px');
      s.style.animationDelay = (Math.random()*0.06).toFixed(3)+'s';
      s.style.fontSize = (12 + Math.random()*10).toFixed(0) + 'px';
      host.appendChild(s);
    }
    fx.appendChild(host);
    setTimeout(()=> host.remove(), 650);
  }

  function puff(x,y, n){
    const k = Math.max(3, Math.min(7, n|0));
    for (let i=0;i<k;i++){
      const p = DOC.createElement('div');
      p.className = 'fg-puff';
      p.style.left = (x + (Math.random()*18-9)).toFixed(1) + 'px';
      p.style.top  = (y + (Math.random()*14-7)).toFixed(1) + 'px';
      p.style.animationDelay = (Math.random()*0.06).toFixed(3)+'s';
      fx.appendChild(p);
      setTimeout(()=> p.remove(), 750);
    }
  }

  function splat(x,y){
    const sp = DOC.createElement('div');
    sp.className = 'fg-splat';
    sp.style.left = x + 'px';
    sp.style.top  = y + 'px';
    fx.appendChild(sp);
    setTimeout(()=> sp.remove(), 600);
  }

  function typeOfTarget(t){
    if (!t || !t.classList) return 'other';
    if (t.classList.contains('fg-good')) return 'good';
    if (t.classList.contains('fg-junk')) return 'junk';
    if (t.classList.contains('fg-wrong')) return 'wrong';
    if (t.classList.contains('fg-decoy')) return 'decoy';
    if (t.classList.contains('fg-boss')) return 'boss';
    return 'other';
  }

  function attachGoodTrail(t){
    if (!t || t.querySelector('.fg-trail')) return;
    const tr = DOC.createElement('div');
    tr.className = 'fg-trail';
    t.appendChild(tr);
  }

  // ---------- observe spawn ----------
  const obs = new MutationObserver((muts)=>{
    for (const m of muts){
      for (const node of m.addedNodes){
        if (!(node instanceof HTMLElement)) continue;
        const t = node.classList && node.classList.contains('fg-target') ? node : null;
        if (!t) continue;

        const {x,y} = centerOf(t);
        const tp = typeOfTarget(t);

        // sparkle on spawn
        sparkle(x,y, tp==='boss' ? 14 : 9);

        // good trail glitter
        if (tp === 'good') attachGoodTrail(t);

        // junk cute smoke
        if (tp === 'junk') puff(x,y, 5);
      }
    }
  });
  obs.observe(layer, { childList:true, subtree:true });

  // ---------- hit FX (capture click/touch) ----------
  layer.addEventListener('pointerdown', (ev)=>{
    const t = ev.target && ev.target.closest ? ev.target.closest('.fg-target') : null;
    if (!t) return;

    const {x,y} = centerOf(t);
    const tp = typeOfTarget(t);

    if (tp === 'good'){
      sparkle(x,y, 12);
    } else if (tp === 'boss'){
      sparkle(x,y, 14);
    } else if (tp === 'junk'){
      puff(x,y, 6);
      splat(x,y);
      sparkle(x,y, 8);
    } else {
      sparkle(x,y, 9);
    }
  }, { passive:true, capture:true });

})(typeof window !== 'undefined' ? window : globalThis);
