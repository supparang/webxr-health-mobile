// === /HeroHealth/vr/particles.js (2025-11-12 SCORE POP + SCREEN XY) ===
export const Particles = (() => {
  let styleAdded = false;
  function inject() {
    if (styleAdded) return;
    styleAdded = true;
    const st = document.createElement('style');
    st.textContent = `
    .fx-layer{position:fixed;inset:0;z-index:700;pointer-events:none}
    .fx-pop{position:fixed;transform:translate(-50%,-50%);font:900 16px system-ui;color:#e2e8f0;
      text-shadow:0 2px 8px rgba(0,0,0,.45);opacity:0;transition:transform .45s ease, opacity .45s ease}
    .fx-pop.on{opacity:1; transform:translate(-50%,-50%) translateY(-16px)}
    .fx-emo{position:fixed;transform:translate(-50%,-50%);filter:drop-shadow(0 8px 14px rgba(0,0,0,.5))}
    `;
    document.head.appendChild(st);
  }
  function layer() {
    let l = document.querySelector('.fx-layer');
    if (!l) {
      l = document.createElement('div');
      l.className = 'fx-layer';
      document.body.appendChild(l);
    }
    return l;
  }
  function scorePop(x, y, txt) {
    inject();
    const l = layer();
    const el = document.createElement('div');
    el.className = 'fx-pop';
    el.textContent = txt;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    l.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(() => el.remove(), 550);
  }
  function burstShards(_host, _pos, opts) {
    inject();
    const l = layer();
    const p = (opts && opts.screen) ? opts.screen : { x: window.innerWidth/2, y: window.innerHeight/2 };
    const el = document.createElement('div');
    el.className = 'fx-emo';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.style.fontSize = (opts && opts.size) ? opts.size + 'px' : '38px';
    el.textContent = (opts && opts.emoji) || '✨';
    l.appendChild(el);
    setTimeout(() => el.remove(), 400);
  }
  return { scorePop, burstShards };
})();
export default Particles;
