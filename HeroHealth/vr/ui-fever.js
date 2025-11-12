// === /HeroHealth/vr/ui-fever.js (2025-11-12 FEVER+SHIELD UNDER BAR w/ TOTAL) ===
let _wrap=null,_bar=null,_meta=null,_flameLayer=null,_obs=null,_followTimer=null;
let _val=0,_active=false;
let _anchor=null;

let _shieldCur=0;    // เกราะที่ถืออยู่ตอนนี้
let _shieldTotal=0;  // เกราะที่เก็บสะสมในรอบนี้

const SCORE_SELECTORS=[
  '#hudTop .score-box','.hud-top .score-box','[data-hud="scorebox"]',
  '#scoreBox','.scorebox','.hud-score','#hudScore','[data-role="scorebox"]','[data-ui="score"]'
];

function _injectStyles(){
  if(document.getElementById('hha-fever-style'))return;
  const st=document.createElement('style'); st.id='hha-fever-style';
  st.textContent=[
    '.hha-fever-wrap{position:fixed;z-index:10000;display:flex;flex-direction:column;gap:6px;',
      'background:#0b1220cc;border:1px solid #334155;border-radius:14px;padding:8px 10px;',
      'box-shadow:0 8px 20px rgba(2,6,23,.35);pointer-events:none}',
    '.hha-fever-top{display:flex;align-items:center;gap:10px}',
    '.hha-fever-label{font:800 12px system-ui,Segoe UI,Inter,sans-serif;color:#93c5fd;letter-spacing:.3px}',
    '.hha-fever-bar{position:relative;flex:1 1 auto;height:12px;background:#0f172a;border:1px solid #1f2a3a;border-radius:999px;overflow:hidden}',
    '.hha-fever-fill{position:absolute;left:0;top:0;bottom:0;width:0%;background:linear-gradient(90deg,#60a5fa,#22d3ee,#a78bfa);transition:width .18s ease}',
    '.hha-fever-wrap.active .hha-fever-fill{box-shadow:0 0 16px rgba(99,102,241,.7),0 0 26px rgba(34,211,238,.5)}',
    '.hha-fever-meta{min-width:48px;text-align:right;font:900 12px system-ui;color:#f8fafc}',
    '.hha-fever-bottom{display:flex;justify-content:space-between;gap:10px}',
    '.hha-shield-row{display:flex;gap:8px;font:800 12px system-ui;color:#e2e8f0}',
    '.hha-pill{display:inline-flex;align-items:center;gap:6px;background:#0f172acc;border:1px solid #263244;',
      'color:#e2e8f0;padding:4px 9px;border-radius:999px}',
    '.hha-pill .ico{filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}',
    '.hha-fever-flame{pointer-events:none;position:absolute;left:0;right:0;bottom:0;top:-8px;overflow:hidden}',
    '.hha-fever-wrap:not(.active) .hha-fever-flame{display:none}',
    '.hha-fever-flame span{position:absolute;bottom:0;width:8px;height:14px;border-radius:6px 6px 2px 2px;',
      'background:radial-gradient(50% 60% at 50% 55%, #ffd166 0%, #fb923c 55%, #ef4444 100%);opacity:.85;',
      'transform-origin:50% 100%;will-change:transform,opacity;filter:blur(.4px)}',
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

  const top=document.createElement('div'); top.className='hha-fever-top';
  const label=document.createElement('div'); label.className='hha-fever-label'; label.textContent='FEVER';
  const bar=document.createElement('div'); bar.className='hha-fever-bar';
  const fill=document.createElement('div'); fill.className='hha-fever-fill'; bar.appendChild(fill);
  const heat=document.createElement('div'); heat.className='hha-heat'; bar.appendChild(heat);
  const flame=document.createElement('div'); flame.className='hha-fever-flame'; bar.appendChild(flame);
  const meta=document.createElement('div'); meta.className='hha-fever-meta'; meta.textContent='0%';
  top.appendChild(label); top.appendChild(bar); top.appendChild(meta);

  const bottom=document.createElement('div'); bottom.className='hha-fever-bottom';
  const shieldRow=document.createElement('div'); shieldRow.className='hha-shield-row';
  shieldRow.innerHTML=[
    '<span class="hha-pill"><span class="ico">🛡️</span><span>Current:</span> <b id="hhaShieldCur">0</b></span>',
    '<span class="hha-pill"><span class="ico">📦</span><span>Total:</span> <b id="hhaShieldTotal">0</b></span>',
  ].join(' ');
  bottom.appendChild(shieldRow);

  _wrap.appendChild(top);
  _wrap.appendChild(bottom);

  _bar={fill}; _meta=meta; _flameLayer=flame;
  setFever(_val); setFeverActive(_active); _updateShieldLabels(); _seedFlames();

  document.body.appendChild(_wrap);
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

function _findAnchor(detail){
  if(detail && detail.scoreEl && detail.scoreEl.getBoundingClientRect) return detail.scoreEl;
  for(let i=0;i<SCORE_SELECTORS.length;i++){ const el=document.querySelector(SCORE_SELECTORS[i]); if(el) return el; }
  const candidates=[...document.querySelectorAll('*')].filter(el=>{
    const id=(el.id||'').toLowerCase(), cls=(el.className||'').toString().toLowerCase();
    return /score|combo/.test(id)||/score|combo/.test(cls);
  });
  return candidates[0]||null;
}

function _follow(){
  if(!_anchor||!_wrap) return;
  try{
    const r=_anchor.getBoundingClientRect();
    const gap=8;
    const width=Math.max(240, Math.min(window.innerWidth-24, r.width));
    _wrap.style.left=(Math.round(r.left))+'px';
    _wrap.style.top =(Math.round(r.bottom+gap))+'px';
    _wrap.style.width=(Math.round(width))+'px';
  }catch(_){}
}
function _startFollowLoop(){
  if(_followTimer) cancelAnimationFrame(_followTimer);
  const loop=()=>{ _follow(); _followTimer=requestAnimationFrame(loop); };
  _followTimer=requestAnimationFrame(loop);
}
function _ensureObserver(){
  if(_obs) return;
  _obs=new MutationObserver(()=>{ const a=_findAnchor({}); if(a && a!==_anchor){ _anchor=a; _follow(); } });
  _obs.observe(document.body,{childList:true,subtree:true,attributes:true});
  window.addEventListener('resize',_follow);
  window.addEventListener('scroll',_follow,{passive:true});
}

function _updateShieldLabels(){
  const cur=document.getElementById('hhaShieldCur');
  const tot=document.getElementById('hhaShieldTotal');
  if(cur) cur.textContent=String(_shieldCur);
  if(tot) tot.textContent=String(_shieldTotal);
}

// ---- Public API ----
export function ensureFeverBar(){
  if(!_wrap) _build();
  _anchor=_findAnchor({});
  _follow(); _startFollowLoop(); _ensureObserver();
  try{
    window.addEventListener('hha:hud-ready',function(e){
      const d=e&&e.detail?e.detail:{};
      if(d && d.scoreEl && d.scoreEl.getBoundingClientRect){ _anchor=d.scoreEl; }
      else { _anchor=_findAnchor(d); }
      _follow();
    });
  }catch(_){}
  return _wrap;
}

export function setFever(v){
  _val=Math.max(0,Math.min(100,Number(v)||0));
  if(_bar&&_bar.fill) _bar.fill.style.width=_val+'%';
  if(_meta) _meta.textContent=_val+'%';
}
export function setFeverActive(on){
  _active=!!on;
  if(_wrap){ if(_active) _wrap.classList.add('active'); else _wrap.classList.remove('active'); }
  if(_active) _seedFlames();
}
export function setShield(n){
  _shieldCur=Math.max(0,Math.min(99,Number(n)||0));
  _updateShieldLabels();
}
export function addShield(n){
  const k=Math.max(0,Number(n)||0);
  _shieldTotal=Math.max(0, Math.min(999, _shieldTotal+k));
  _updateShieldLabels();
}
export function setShieldTotal(n){
  _shieldTotal=Math.max(0,Math.min(999,Number(n)||0));
  _updateShieldLabels();
}
export default { ensureFeverBar,setFever,setFeverActive,setShield,addShield,setShieldTotal };
