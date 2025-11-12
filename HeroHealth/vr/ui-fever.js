// === /HeroHealth/vr/ui-fever.js
// Fever/Shield UI — auto-mount under score+combo, with retries & CSS injection.

let feverEl = null, feverFill = null, feverGlow = null, shieldEl = null;
let cssInjected = false;
let mountTries = 0, mountedInto = null;

function injectCSS(){
  if (cssInjected) return;
  cssInjected = true;
  const css = `
  .hha-fever-wrap{
    position:absolute; left:0; right:0; top:100%;
    margin-top:8px; padding:0 4px; height:14px;
    display:flex; align-items:center; gap:8px;
    pointer-events:none; z-index: 50;
  }
  .hha-fever-bar{
    position:relative; flex:1; height:10px; border-radius:999px;
    background:linear-gradient(180deg,#1f2937,#111827);
    box-shadow: inset 0 1px 2px rgba(0,0,0,.6);
    overflow:hidden;
  }
  .hha-fever-fill{
    position:absolute; left:0; top:0; bottom:0; width:0%;
    background:linear-gradient(90deg,#60a5fa,#22d3ee,#34d399);
    transition:width .18s ease-out, filter .2s ease-out, opacity .2s ease-out;
  }
  .hha-fever-glow{
    position:absolute; left:0; top:-2px; height:14px; width:0%;
    filter:blur(6px); opacity:.0; pointer-events:none;
    background:linear-gradient(90deg,rgba(96,165,250,.8),rgba(34,211,238,.8),rgba(52,211,153,.8));
    transition:opacity .2s ease-out, width .18s ease-out;
  }
  .hha-shield{
    min-width:42px; height:14px; border-radius:999px;
    background:#0ea5e9; color:#00131a; font-weight:900; font-size:11px;
    display:flex; align-items:center; justify-content:center;
    box-shadow: inset 0 -1px 0 rgba(0,0,0,.25), 0 1px 2px rgba(0,0,0,.35);
    letter-spacing:.2px; transform:translateZ(0);
  }
  /* fixed fallback if we cannot mount into HUD */
  .hha-fever-fixed{
    position:fixed; left:12px; right:12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
    z-index: 9990; pointer-events:none;
  }
  @media (max-width: 480px){
    .hha-fever-fixed{ left:10px; right:10px; }
  }
  `;
  const style = document.createElement('style');
  style.id = 'hha-fever-style';
  style.textContent = css;
  document.head.appendChild(style);
}

function build(){
  injectCSS();
  const wrap = document.createElement('div');
  wrap.className = 'hha-fever-wrap';
  wrap.setAttribute('aria-hidden','true');

  const bar  = document.createElement('div');  bar.className = 'hha-fever-bar';
  const fill = document.createElement('div');  fill.className = 'hha-fever-fill';
  const glow = document.createElement('div');  glow.className = 'hha-fever-glow';
  bar.appendChild(fill); bar.appendChild(glow);

  const sh   = document.createElement('div');  sh.className   = 'hha-shield';
  sh.textContent = '🛡️ x0';

  wrap.appendChild(bar);
  wrap.appendChild(sh);

  feverEl   = wrap;
  feverFill = fill;
  feverGlow = glow;
  shieldEl  = sh;
  return wrap;
}

// Try to find a HUD container under score+combo to attach after.
// Accepted anchors (first found wins):
//  - #hudTop .score-box
//  - .hud-top .score-box
//  - [data-hud="scorebox"]
//  - #hudTop
function findAnchor(){
  const a =
    document.querySelector('#hudTop .score-box') ||
    document.querySelector('.hud-top .score-box') ||
    document.querySelector('[data-hud="scorebox"]') ||
    document.querySelector('#hudTop');
  return a || null;
}

function mountUnderScore(){
  if (!feverEl) build();
  const anchor = findAnchor();
  if (anchor){
    // Place the fever wrap absolutely under the anchor box
    const host = anchor.closest('#hudTop, .hud-top') || anchor.parentElement || document.body;
    if (host && getComputedStyle(host).position === 'static'){
      host.style.position = 'relative';
    }
    // If anchor is not relatively positioned, we still append to host and rely on absolute in .hha-fever-wrap (top:100%)
    if (anchor && getComputedStyle(anchor).position === 'static'){
      anchor.style.position = 'relative';
    }
    anchor.appendChild(feverEl);
    feverEl.classList.remove('hha-fever-fixed');
    mountedInto = 'hud';
    return true;
  }
  return false;
}

function mountFallbackFixed(){
  if (!feverEl) build();
  if (!feverEl.parentNode){
    document.body.appendChild(feverEl);
  }
  feverEl.classList.add('hha-fever-fixed');
  mountedInto = 'fixed';
}

function tryMountLoop(){
  if (mountUnderScore()) return;
  // retry a few frames for late HUD
  if (mountTries < 30){
    mountTries++;
    requestAnimationFrame(tryMountLoop);
  } else {
    // fallback to fixed
    mountFallbackFixed();
  }
}

// ---- Public API ----
export function ensureFeverBar(){
  if (feverEl && feverEl.parentNode) return;
  build();
  mountTries = 0; mountedInto = null;
  tryMountLoop();
}

export function setFever(v){
  if (!feverEl) ensureFeverBar();
  const val = Math.max(0, Math.min(100, Number(v)||0));
  if (feverFill) feverFill.style.width = val + '%';
  if (feverGlow) feverGlow.style.width = val + '%';
}

export function setFeverActive(active){
  if (!feverEl) ensureFeverBar();
  const on = !!active;
  if (feverGlow) feverGlow.style.opacity = on ? 0.9 : 0.0;
  if (feverFill) feverFill.style.filter  = on ? 'saturate(1.3) brightness(1.15)' : 'none';
}

export function setShield(n){
  if (!feverEl) ensureFeverBar();
  const val = Math.max(0, Number(n)||0);
  if (shieldEl) shieldEl.textContent = '🛡️ x' + val;
}

// Optional: if HUD announces it's ready, remount into it
window.addEventListener('hha:hud-ready', ()=>{
  if (!feverEl) return;
  mountUnderScore() || mountFallbackFixed();
});

// Safety: if DOM becomes visible later
document.addEventListener('visibilitychange', ()=>{
  if (!document.hidden && feverEl && !feverEl.parentNode){
    ensureFeverBar();
  }
});
