/* === /herohealth/vr-groups/groups-fx.js ===
Candy FX Pack (Hardcore+FeelGood)
- sparkle stars spawn/hit
- GOOD: trail glitter
- JUNK: cute smoke + slime splat
- POWERUP: bigger burst
- listens hha:celebrate => big candy fireworks
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const layer = DOC.getElementById('fg-layer') || DOC.querySelector('.fg-layer');
  if (!layer) return;

  const STYLE_ID = 'groupsCandyFxStyleV2';
  if (!DOC.getElementById(STYLE_ID)) {
    const st = DOC.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
.fg-fx-layer{ position:fixed; inset:0; pointer-events:none; z-index:70; }

.fg-spark{ position:fixed; left:0; top:0; transform:translate(-50%,-50%); width:1px; height:1px; }
.fg-star{
  position:absolute; left:0; top:0; transform:translate(-50%,-50%);
  font-size:14px; opacity:0;
  filter: drop-shadow(0 10px 16px rgba(0,0,0,.30));
  animation: starPop .55s ease-out forwards;
}
@keyframes starPop{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.55) rotate(0deg); }
  25%{ opacity:1; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.15) rotate(18deg); }
  100%{ opacity:0; transform:translate(calc(-50% + var(--dx2)), calc(-50% + var(--dy2))) scale(.90) rotate(52deg); }
}

.fg-trail{
  position:absolute; left:50%; top:50%;
  transform: translate(-50%, -50%);
  width:125%; height:125%;
  border-radius:32px;
  pointer-events:none;
  opacity:.9;
  mix-blend-mode: screen;
  background:
    radial-gradient(circle at 30% 35%, rgba(255,255,255,.22), rgba(255,255,255,0) 45%),
    radial-gradient(circle at 75% 70%, rgba(255,255,255,.18), rgba(255,255,255,0) 48%),
    radial-gradient(circle at 55% 20%, rgba(34,211,238,.20), rgba(34,211,238,0) 50%),
    radial-gradient(circle at 25% 75%, rgba(244,114,182,.18), rgba(244,114,182,0) 55%);
  animation: trailWink .95s ease-in-out infinite;
}
@keyframes trailWink{
  0%,100%{ opacity:.62; transform: translate(-50%,-50%) scale(1.00); }
  50%{ opacity:.98; transform: translate(-50%,-50%) scale(1.08); }
}

.fg-puff{
  position:fixed; transform: translate(-50%,-50%);
  pointer-events:none;
  width:24px; height:24px; border-radius:999px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.24), rgba(244,114,182,.20));
  filter: drop-shadow(0 10px 16px rgba(0,0,0,.25));
  opacity:0;
  animation: puff .72s ease-out forwards;
}
@keyframes puff{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.55); }
  25%{ opacity:1; transform:translate(-50%,-50%) scale(1.00); }
  100%{ opacity:0; transform:translate(-50%, calc(-50% - 18px)) scale(1.28); }
}

.fg-splat{
  position:fixed; transform: translate(-50%,-50%);
  pointer-events:none;
  width:88px; height:60px; border-radius:999px;
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
  30%{ opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(6deg); }
  100%{ opacity:0; transform:translate(-50%, calc(-50% + 10px)) scale(.95) rotate(12deg); }
}
`;
    DOC.head.appendChild(st);
  }

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

    const n = Math.max(7, Math.min(18, (power|0)));
    const stars = ['✨','⭐','💫','🌟','🍬'];
    for (let i=0;i<n;i++){
      const s = DOC.createElement('div');
      s.className = 'fg-star';
      s.textContent = stars[(Math.random()*stars.length)|0];

      const a = Math.random()*Math.PI*2;
      const r1 = 18 + Math.random()*26;
      const r2 = 40 + Math.random()*44;
      s.style.setProperty('--dx',  (Math.cos(a)*r1).toFixed(1)+'px');
      s.style.setProperty('--dy',  (Math.sin(a)*r1).toFixed(1)+'px');
      s.style.setProperty('--dx2', (Math.cos(a)*r2).toFixed(1)+'px');
      s.style.setProperty('--dy2', (Math.sin(a)*r2).toFixed(1)+'px');
      s.style.animationDelay = (Math.random()*0.06).toFixed(3)+'s';
      s.style.fontSize = (12 + Math.random()*12).toFixed(0) + 'px';
      host.appendChild(s);
    }
    fx.appendChild(host);
    setTimeout(()=> host.remove(), 680);
  }

  function puff(x,y, n){
    const k = Math.max(3, Math.min(8, n|0));
    for (let i=0;i<k;i++){
      const p = DOC.createElement('div');
      p.className = 'fg-puff';
      p.style.left = (x + (Math.random()*22-11)).toFixed(1) + 'px';
      p.style.top  = (y + (Math.random()*16-8)).toFixed(1) + 'px';
      p.style.animationDelay = (Math.random()*0.06).toFixed(3)+'s';
      fx.appendChild(p);
      setTimeout(()=> p.remove(), 780);
    }
  }

  function splat(x,y){
    const sp = DOC.createElement('div');
    sp.className = 'fg-splat';
    sp.style.left = x + 'px';
    sp.style.top  = y + 'px';
    fx.appendChild(sp);
    setTimeout(()=> sp.remove(), 620);
  }

  function typeOfTarget(t){
    if (!t || !t.classList) return 'other';
    if (t.classList.contains('fg-boss')) return 'boss';
    if (t.classList.contains('fg-star')) return 'star';
    if (t.classList.contains('fg-ice'))  return 'ice';
    if (t.classList.contains('fg-good')) return 'good';
    if (t.classList.contains('fg-junk')) return 'junk';
    if (t.classList.contains('fg-wrong'))return 'wrong';
    if (t.classList.contains('fg-decoy'))return 'decoy';
    return 'other';
  }

  function attachGoodTrail(t){
    if (!t || t.querySelector('.fg-trail')) return;
    const tr = DOC.createElement('div');
    tr.className = 'fg-trail';
    t.appendChild(tr);
  }

  const obs = new MutationObserver((muts)=>{
    for (const m of muts){
      for (const node of m.addedNodes){
        if (!(node instanceof HTMLElement)) continue;
        const t = node.classList && node.classList.contains('fg-target') ? node : null;
        if (!t) continue;
        const {x,y} = centerOf(t);
        const tp = typeOfTarget(t);

        // spawn sparkle
        sparkle(x,y, tp==='boss'?16 : (tp==='star'||tp==='ice'?18:10));
        if (tp === 'good') attachGoodTrail(t);
        if (tp === 'junk') puff(x,y, 5);
      }
    }
  });
  obs.observe(layer, { childList:true, subtree:true });

  layer.addEventListener('pointerdown', (ev)=>{
    const t = ev.target && ev.target.closest ? ev.target.closest('.fg-target') : null;
    if (!t) return;
    const {x,y} = centerOf(t);
    const tp = typeOfTarget(t);

    if (tp === 'junk'){ puff(x,y, 7); splat(x,y); sparkle(x,y, 10); return; }
    if (tp === 'star' || tp === 'ice'){ sparkle(x,y, 22); return; }
    if (tp === 'boss'){ sparkle(x,y, 18); return; }
    if (tp === 'good'){ sparkle(x,y, 14); return; }
    sparkle(x,y, 12);
  }, { passive:true, capture:true });

  // celebrate from quest / engine
  root.addEventListener('hha:celebrate', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    const k = String(d.kind||'').toLowerCase();
    const cx = (root.innerWidth||360) * 0.5;
    const cy = (root.innerHeight||640) * 0.35;
    sparkle(cx, cy, (k==='all')?26 : (k==='goal'?22:18));
  }, { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);
