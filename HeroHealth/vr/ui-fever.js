// === /HeroHealth/vr/ui-fever.js (2025-11-12 glow+shield counter) ===
let feverWrap, feverBar, feverFire, shieldSumEl;
let feverVal = 0, shieldSum = 0, active = false;

export function ensureFeverBar(){
  if(document.getElementById('feverWrap')) return;
  feverWrap = document.createElement('div');
  feverWrap.id = 'feverWrap';
  feverWrap.innerHTML = `
    <div id="feverBar"><div id="feverFill"></div></div>
    <div id="feverFire"></div>
    <div id="shieldSum" class="mini-badge">🛡️ 0</div>
  `;
  document.body.appendChild(feverWrap);
  attachUnderScoreBox();
}
function attachUnderScoreBox(){
  const anchor = document.querySelector('#hudTop .score-box, .hud-top .score-box');
  if(anchor && feverWrap && anchor.parentNode)
    anchor.parentNode.insertBefore(feverWrap, anchor.nextSibling);
}
window.addEventListener('hha:hud-ready', attachUnderScoreBox);

export function setFever(v){
  feverVal = Math.max(0,Math.min(100,v));
  const fill=document.getElementById('feverFill');
  if(fill) fill.style.width = feverVal+'%';
}
export function setFeverActive(on){
  active=!!on;
  if(!feverFire) feverFire=document.getElementById('feverFire');
  if(feverFire) feverFire.style.opacity = active?1:0;
}
export function setShield(n){
  const el=document.getElementById('shieldSum');
  if(el) el.textContent='🛡️ '+(n||0);
}
export function addShield(n){
  shieldSum += n||0;
  const el=document.getElementById('shieldSum');
  if(el) el.textContent='🛡️ '+shieldSum;
}

// === Style ===
const css = document.createElement('style');
css.textContent = `
#feverWrap{position:absolute;left:50%;top:calc(100% + 6px);transform:translateX(-50%);
 width:240px;height:16px;z-index:40;display:flex;flex-direction:column;align-items:center;gap:2px;}
#feverBar{width:100%;height:8px;background:#111;border-radius:6px;overflow:hidden;box-shadow:0 0 4px #000 inset;}
#feverFill{width:0%;height:100%;background:linear-gradient(90deg,#3b82f6,#ec4899);transition:width .2s ease;}
#feverFire{position:absolute;inset:-8px -12px 4px -12px;pointer-events:none;opacity:0;filter:blur(6px);}
#feverFire::before{content:'';position:absolute;inset:0;
 background:conic-gradient(from 0deg,rgba(255,180,0,.35),rgba(255,0,0,.25),rgba(255,180,0,.35));
 animation:flame .9s linear infinite;mix-blend-mode:screen;}
@keyframes flame{0%{transform:translateY(2px)}50%{transform:translateY(-1px)}100%{transform:translateY(2px)}}
#shieldSum{font-size:12px;color:#fef3c7;text-shadow:0 0 3px #000;}
`;
document.head.appendChild(css);
