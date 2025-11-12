// === /HeroHealth/vr/ui-fever.js (2025-11-12 ANCHOR+OBSERVER FINAL) ===
let _wrap=null,_bar=null,_shield=null,_flameLayer=null,_obs=null;
let _val=0,_active=false,_shieldCount=0;

function _injectStyles(){
  if(document.getElementById('hha-fever-style'))return;
  const st=document.createElement('style'); st.id='hha-fever-style';
  st.textContent=[
    '.hha-fever-wrap{position:relative;margin-top:8px;display:flex;align-items:center;gap:10px;background:#0b1220cc;border:1px solid #334155;border-radius:14px;padding:8px 10px;box-shadow:0 8px 20px rgba(2,6,23,.35)}',
    '.hha-fever-label{font:800 12px system-ui,Segoe UI,Inter,sans-serif;color:#93c5fd;letter-spacing:.3px}',
    '.hha-fever-bar{position:relative;flex:1 1 auto;height:12px;background:#0f172a;border:1px solid #1f2a3a;border-radius:999px;overflow:hidden}',
    '.hha-fever-fill{position:absolute;left:0;top:0;bottom:0;width:0%;background:linear-gradient(90deg,#60a5fa,#22d3ee,#a78bfa);transition:width .18s ease}',
    '.hha-fever-wrap.active .hha-fever-fill{box-shadow:0 0 16px rgba(99,102,241,.7),0 0 26px rgba(34,211,238,.5)}',
    '.hha-fever-meta{min-width:48px;text-align:right;font:900 12px system-ui;color:#f8fafc}',
    '.hha-shield{min-width:60px;display:flex;align-items:center;justify-content:flex-end;gap:6px;font:800 12px system-ui;color:#fde68a}',
    '.hha-shield-badge{display:inline-flex;align-items:center;gap:4px;background:#7c2d12;border:1px solid #a16207;color:#fde68a;padding:4px 9px;border-radius:999px}',
    '.hha-shield-badge .ico{filter:drop-shadow(0 1px 0 rgba(0,0,0,.5))}',
    '.hha-fever-flame{pointer-events:none;position:absolute;left:0;right:0;bottom:0;top:-8px;overflow:hidden}',
    '.hha-fever-wrap:not(.active) .hha-fever-flame{display:none}',
    '.hha-fever-flame span{position:absolute;bottom:0;width:8px;height:14px;border-radius:6px 6px 2px 2px;background:radial-gradient(50% 60% at 50% 55%, #ffd166 0%, #fb923c 55%, #ef4444 100%);opacity:.85;transform-origin:50% 100%;will-change:transform,opacity;filter:blur(.4px)}',
    '@keyframes hhaFlameRise{0%{transform:translateY(4px) scale(.9) rotate(0);opacity:0}10%{opacity:.7}50%{transform:translateY(-10px) scale(1.05) rotate(var(--rot));opacity:1}100%{transform:translateY(-24px) scale(.9) rotate(var(--rot));opacity:0}}',
    '@keyframes hhaFlameFlick{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25)}}',
    '.hha-fever-flame span.fx{animation:hhaFlameRise var(--dur) linear var(--delay) infinite, hhaFlameFlick .6s ease-in-out infinite}',
    '.hha-heat{position:absolute;left:0;right:0;top:-12px;height:12px;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,0));opacity:0;transition:opacity .25s ease;filter:blur(6px)}',
    '.hha-fever-wrap.active .hha-heat{opacity:.55}',
  ].join('');
  document.head.appendChild(st);
}

function _build(){
  if(_wrap) return _wrap;
  _injectStyles();
  _wrap=document.createElement('div'); _wrap.className='hha-fever-wrap'; _wrap.id='feverBarWrap';

  const label=document.createElement('div'); label.className='hha-fever-label'; label.textContent='FEVER';
  const bar=document.createElement('div'); bar.className='hha-fever-bar';
  const fill=document.createElement('div'); fill.className='hha-fever-fill'; bar.appendChild(fill);
  const heat=document.createElement('div'); heat.className='hha-heat'; bar.appendChild(heat);
  const flame=document.createElement('div'); flame.className='hha-fever-flame'; bar.appendChild(flame);

  const meta=document.createElement('div'); meta.className='hha-fever-meta'; meta.textContent='0%';
  const sh=document.createElement('div'); sh.className='hha-shield';
  sh.innerHTML='<span class="hha-shield-badge"><span class="ico">🛡️</span><span class="n">0</span></span>';

  _wrap.appendChild(label); _wrap.appendChild(bar); _wrap.appendChild(meta); _wrap.appendChild(sh);

  _bar={fill,meta}; _shield=sh.querySelector('.n'); _flameLayer=flame;
  setFever(_val); setFeverActive(_active); setShield(_shieldCount); _seedFlames();
  return _wrap;
}

function _seedFlames(){
  if(!_flameLayer) return;
  while(_flameLayer.firstChild) _flameLayer.removeChild(_flameLayer.firstChild);
  const N=14+((Math.random()*3)|0);
  for(let i=0;i<N;i++){
    const s=document.createElement('span');
    const x=Math.random();
    s.style.left='calc('+(x*100)+'% - 4px)';
    s.style.setProperty('--rot',((Math.random()*12-6).toFixed(2))+'deg');
    s.style.setProperty('--dur',(0.9+Math.random()*0.6).toFixed(2)+'s');
    s.style.setProperty('--delay',(Math.random()*0.8).toFixed(2)+'s');
    s.className='fx'; _flameLayer.appendChild(s);
  }
}

const SCORE_SELECTORS=[
  '#hudTop .score-box','.hud-top .score-box','[data-hud="scorebox"]',
  '#scoreBox','.scorebox','.hud-score','#hudScore'
];
function _findAnchor(detail){
  for(let i=0;i<SCORE_SELECTORS.length;i++){ const el=document.querySelector(SCORE_SELECTORS[i]); if(el) return el; }
  if(detail&&detail.anchorId){ const id=document.getElementById(detail.anchorId); if(id) return id; }
  return document.querySelector('.game-wrap')||document.body;
}

function _attach(detail){
  const wrap=_build();
  const anchor=_findAnchor(detail||{});
  if(!anchor) return;
  try{
    if(anchor.classList && anchor.classList.contains('score-box')){
      anchor.insertAdjacentElement('afterend',wrap);
    }else{
      anchor.appendChild(wrap);
    }
  }catch(_){ (document.querySelector('.game-wrap')||document.body).appendChild(wrap); }
}

function _ensureObserver(){
  if(_obs) return;
  _obs=new MutationObserver(function(){
    const target=_findAnchor({});
    if(target && _wrap && _wrap.previousElementSibling!==target){ try{ target.insertAdjacentElement('afterend',_wrap);}catch(_){} }
  });
  _obs.observe(document.body,{childList:true,subtree:true});
}

export function ensureFeverBar(){
  if(!_wrap) _build();
  _attach({});
  _ensureObserver();
  try{
    window.addEventListener('hha:hud-ready',function(e){ try{ _attach(e&&e.detail?e.detail:{});}catch(_){}} );
  }catch(_){}
  return _wrap;
}

export function setFever(v){
  _val=Math.max(0,Math.min(100,Number(v)||0));
  if(_bar&&_bar.fill) _bar.fill.style.width=_val+'%';
  if(_bar&&_bar.meta) _bar.meta.textContent=_val+'%';
}
export function setFeverActive(on){
  _active=!!on;
  if(_wrap){ if(_active) _wrap.classList.add('active'); else _wrap.classList.remove('active'); }
  if(_active) _seedFlames();
}
export function setShield(n){
  _shieldCount=Math.max(0,Math.min(99,Number(n)||0));
  if(_shield) _shield.textContent=String(_shieldCount);
}
export default { ensureFeverBar,setFever,setFeverActive,setShield };
