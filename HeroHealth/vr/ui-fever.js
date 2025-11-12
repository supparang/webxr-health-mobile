// === /HeroHealth/vr/ui-fever.js (2025-11-12 FINAL) ===
// - Self-styled fever bar (attach under HUD score-box)
// - Robust re-parenting on `hha:hud-ready`
// - Public API: ensureFeverBar, setFever, setFeverActive, setShield

let _wrap = null, _bar = null, _shield = null;
let _val = 0, _active = false, _shieldCount = 0;

function _injectStyles(){
  if (document.getElementById('hha-fever-style')) return;
  const st = document.createElement('style');
  st.id = 'hha-fever-style';
  st.textContent = [
    '.hha-fever-wrap{position:relative;margin-top:6px;display:flex;align-items:center;gap:8px;',
    ' background:#0b1220cc;border:1px solid #334155;border-radius:12px;padding:6px 8px;}',
    '.hha-fever-label{font:700 12px system-ui,Segoe UI,Inter,sans-serif;color:#93c5fd;letter-spacing:.3px;}',
    '.hha-fever-bar{position:relative;flex:1 1 auto;height:10px;background:#111827;border:1px solid #1f2937;border-radius:999px;overflow:hidden;}',
    '.hha-fever-fill{position:absolute;left:0;top:0;bottom:0;width:0%;background:linear-gradient(90deg,#60a5fa,#22d3ee,#a78bfa);',
    ' transition:width .18s ease; box-shadow:0 0 0 rgba(255,255,255,0)}',
    '.hha-fever-wrap.active .hha-fever-fill{box-shadow:0 0 18px rgba(99,102,241,.75),0 0 32px rgba(34,211,238,.55)}',
    '.hha-fever-meta{min-width:44px;text-align:right;font:800 12px system-ui;color:#e5e7eb;}',
    '.hha-shield{min-width:58px;display:flex;align-items:center;justify-content:flex-end;gap:4px;font:800 12px system-ui;color:#fef3c7;}',
    '.hha-shield-badge{display:inline-flex;align-items:center;gap:4px;background:#78350f;border:1px solid #a16207;color:#fde68a;',
    ' padding:3px 8px;border-radius:999px;}',
    '.hha-shield-badge .ico{filter:drop-shadow(0 1px 0 rgba(0,0,0,.5))}',
  ].join('');
  document.head.appendChild(st);
}

function _build(){
  if (_wrap) return _wrap;
  _injectStyles();

  _wrap = document.createElement('div');
  _wrap.className = 'hha-fever-wrap';
  _wrap.id = 'feverBarWrap';

  const label = document.createElement('div');
  label.className = 'hha-fever-label';
  label.textContent = 'FEVER';

  const bar = document.createElement('div');
  bar.className = 'hha-fever-bar';
  const fill = document.createElement('div');
  fill.className = 'hha-fever-fill';
  bar.appendChild(fill);

  const meta = document.createElement('div');
  meta.className = 'hha-fever-meta';
  meta.textContent = '0%';

  const sh = document.createElement('div');
  sh.className = 'hha-shield';
  sh.innerHTML = '<span class="hha-shield-badge"><span class="ico">🛡️</span><span class="n">0</span></span>';

  _wrap.appendChild(label);
  _wrap.appendChild(bar);
  _wrap.appendChild(meta);
  _wrap.appendChild(sh);

  _bar = { fill, meta };
  _shield = sh.querySelector('.n');

  // init value
  setFever(_val);
  setFeverActive(_active);
  setShield(_shieldCount);

  return _wrap;
}

function _findAnchor(detail){
  // Try the score-box inside HUD first
  let anchor = null;

  // If detail specifies scoreBox, try likely selectors
  const sels = [
    '#hudTop .score-box',
    '.hud-top .score-box',
    '[data-hud="scorebox"]',
    '#hudTop',
    '.hud-top'
  ];
  for (let i=0;i<sels.length;i++){
    const el = document.querySelector(sels[i]);
    if (el){ anchor = el; break; }
  }
  // Fallback to any HUD root the hub hinted
  if (!anchor && detail && detail.anchorId){
    const byId = document.getElementById(detail.anchorId);
    if (byId) anchor = byId;
  }
  // Last resort: .game-wrap or body
  if (!anchor) anchor = document.querySelector('.game-wrap') || document.body;
  return anchor;
}

function _attach(detail){
  const wrap = _build();
  const anchor = _findAnchor(detail||{});
  if (!anchor) return;

  // Prefer “after score-box”; otherwise append inside HUD root
  try{
    if (anchor.classList && anchor.classList.contains('score-box')){
      anchor.insertAdjacentElement('afterend', wrap);
    } else {
      anchor.appendChild(wrap);
    }
  }catch(_){
    // ultimate fallback
    (document.querySelector('.game-wrap') || document.body).appendChild(wrap);
  }
}

export function ensureFeverBar(){
  if (!_wrap) _build();
  // also (re)attach right away to wherever is available now
  _attach({});
  // listen for HUD readiness/bursts from hub.js
  try{
    window.addEventListener('hha:hud-ready', (e)=>{
      try{ _attach(e && e.detail ? e.detail : {}); }catch(_){}
    });
  }catch(_){}
  return _wrap;
}

export function setFever(v){
  _val = Math.max(0, Math.min(100, Number(v)||0));
  if (_bar && _bar.fill){
    _bar.fill.style.width = _val + '%';
  }
  if (_bar && _bar.meta){
    _bar.meta.textContent = _val + '%';
  }
}

export function setFeverActive(on){
  _active = !!on;
  if (_wrap){
    if (_active) _wrap.classList.add('active');
    else _wrap.classList.remove('active');
  }
}

export function setShield(n){
  _shieldCount = Math.max(0, Math.min(99, Number(n)||0));
  if (_shield) _shield.textContent = String(_shieldCount);
}

export default { ensureFeverBar, setFever, setFeverActive, setShield };
