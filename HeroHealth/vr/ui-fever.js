// === /HeroHealth/vr/ui-fever.js (2025-11-13 EPIC FEVER) ===
let state = { value:0, active:false, shield:0 };

export function ensureFeverBar(dock){
  if (document.getElementById('hha-fever-css')) return _mount(dock);
  const css = document.createElement('style'); css.id='hha-fever-css';
  css.textContent = `
  .fever-wrap{ position:relative; width:min(480px, 64vw); }
  .fever-track{
    position:relative; height:14px; border-radius:999px; overflow:hidden;
    background:#0f172a; border:1px solid #334155;
    box-shadow:inset 0 0 16px rgba(0,0,0,.35);
  }
  .fever-fill{
    height:100%; width:0%;
    background:linear-gradient(90deg,#60a5fa,#22c55e,#f59e0b,#ef4444);
    background-size:300% 100%;
    animation: feverFlow 2.2s linear infinite;
    transition: width .25s ease;
    filter: drop-shadow(0 2px 8px rgba(255,120,40,.35));
  }
  @keyframes feverFlow{
    0%{background-position:0% 50%}
    100%{background-position:100% 50%}
  }
  /* Flame overlay shown when fever active */
  .fever-flame{
    position:absolute; inset:-6px -10px; pointer-events:none; opacity:0; transition:opacity .25s ease;
    background:
      radial-gradient(120px 24px at 10% 100%, rgba(255,120,40,.35), transparent 70%),
      radial-gradient(180px 26px at 35% 100%, rgba(255,80,20,.30), transparent 70%),
      radial-gradient(140px 20px at 60% 100%, rgba(255,160,40,.28), transparent 70%),
      radial-gradient(200px 28px at 85% 100%, rgba(255,90,10,.32), transparent 70%);
    mix-blend-mode: screen;
    animation: flamePulse 1.1s ease-in-out infinite;
  }
  .fever-active .fever-flame{ opacity:1; }
  @keyframes flamePulse{
    0%,100%{ transform:translateY(0) }
    50%    { transform:translateY(-6px) }
  }
  .shield-pill{
    margin-top:6px; display:inline-flex; gap:4px; align-items:center; font:800 11px system-ui; color:#93c5fd;
  }
  .shield-pill .dot{
    width:10px; height:10px; border-radius:999px; border:1px solid #334155; background:#1f2937;
  }
  .shield-pill .dot.on{ background:#60a5fa; box-shadow:0 0 10px #60a5fa88; }
  `;
  document.head.appendChild(css);
  _mount(dock);
}

function _mount(dock){
  const mount = dock || document.getElementById('feverBarDock') || document.body;
  if (document.getElementById('hha-fever-root')) return;
  const root = document.createElement('div'); root.id='hha-fever-root';
  root.className='fever-wrap';
  root.innerHTML = `
    <div class="fever-track">
      <div class="fever-fill" id="feverFill"></div>
      <div class="fever-flame" id="feverFlame"></div>
    </div>
    <div class="shield-pill" id="shieldPill">
      เกราะ:
      <span class="dot" data-i="0"></span>
      <span class="dot" data-i="1"></span>
      <span class="dot" data-i="2"></span>
    </div>
  `;
  mount?.appendChild(root);
  _sync();
}

function _sync(){
  const root  = document.getElementById('hha-fever-root');
  const fill  = document.getElementById('feverFill');
  const pill  = document.getElementById('shieldPill');
  if (!root || !fill) return;
  fill.style.width = Math.max(0, Math.min(100, state.value)) + '%';
  root.classList.toggle('fever-active', !!state.active);

  if (pill){
    const dots = pill.querySelectorAll('.dot');
    dots.forEach((d,i)=> d.classList.toggle('on', i < Math.max(0, Math.min(3, state.shield|0))));
  }
}

export function setFever(v){
  state.value = +v||0;
  _sync();
}
export function setFeverActive(on){
  state.active = !!on;
  _sync();
}
export function setShield(n){
  state.shield = +n||0;
  _sync();
}
