// === /HeroHealth/vr/ui-fever.js (fever under score-box + flame + shield counter) ===
let _wrap=null, _bar=null, _fill=null, _fire=null, _shieldRow=null, _shieldNow=null, _shieldSumEl=null;
let _fever=0, _active=false, _shield=0, _shieldSum=0;

function ensureCSS(){
  if (document.getElementById('hha-fever-style')) return;
  const st=document.createElement('style'); st.id='hha-fever-style';
  st.textContent = `
  .hha-fever-wrap{ position:relative; width:360px; max-width:70vw; margin:8px auto 0; pointer-events:none; }
  .hha-fever-bar{ position:relative; height:10px; border:1px solid #334155; border-radius:999px; background:#0b1220; overflow:hidden; }
  .hha-fever-fill{ position:absolute; inset:0; width:0%; background: linear-gradient(90deg,#22d3ee,#60a5fa,#a78bfa); box-shadow:0 0 10px rgba(96,165,250,.7) inset; transition:width .15s ease; }
  .hha-fever-fire{ position:absolute; left:-10px; right:-10px; top:-8px; height:26px; opacity:0; filter:blur(6px); pointer-events:none; mix-blend-mode:screen; }
  .hha-fever-fire::before{ content:''; position:absolute; inset:0;
    background: conic-gradient(from 0deg, rgba(255,170,0,.35), rgba(255,60,0,.28), rgba(255,170,0,.35));
    animation: hhaFlame .9s linear infinite; }
  @keyframes hhaFlame { 0%{ transform:translateY(2px) } 50%{ transform:translateY(-1px) } 100%{ transform:translateY(2px) } }
  .hha-shield-row{ display:flex; gap:8px; align-items:center; justify-content:center; margin-top:6px; pointer-events:none; }
  .hha-badge-mini{ background:#0f172acc; color:#e2e8f0; border:1px solid #334155; border-radius:999px; padding:2px 8px; font:700 12px system-ui,Segoe UI,Inter,sans-serif; }
  `;
  document.head.appendChild(st);
}

export function ensureFeverBar(){
  ensureCSS();
  if (_wrap && document.getElementById('feverWrap')) return _wrap;

  _wrap = document.createElement('div'); _wrap.className='hha-fever-wrap'; _wrap.id='feverWrap';
  _bar  = document.createElement('div'); _bar.className='hha-fever-bar'; _bar.id='feverBar';
  _fill = document.createElement('div'); _fill.className='hha-fever-fill'; _bar.appendChild(_fill);
  _fire = document.createElement('div'); _fire.className='hha-fever-fire'; _fire.id='feverFire';

  _shieldRow  = document.createElement('div'); _shieldRow.className='hha-shield-row';
  _shieldNow  = document.createElement('div'); _shieldNow.className='hha-badge-mini'; _shieldNow.id='shieldNow'; _shieldNow.textContent='🛡️ 0/3';
  _shieldSumEl= document.createElement('div'); _shieldSumEl.className='hha-badge-mini'; _shieldSumEl.id='shieldSum'; _shieldSumEl.textContent='🛡️ สะสม 0';
  _shieldRow.appendChild(_shieldNow); _shieldRow.appendChild(_shieldSumEl);

  _wrap.appendChild(_bar); _wrap.appendChild(_fire); _wrap.appendChild(_shieldRow);

  // ติดใต้คะแนน/คอมโบ ถ้ามี
  attachUnderScoreBox();
  // กัน HUD มาช้า
  setTimeout(attachUnderScoreBox,100);
  setTimeout(attachUnderScoreBox,250);
  window.addEventListener('hha:hud-ready', attachUnderScoreBox);
  return _wrap;
}

export function attachUnderScoreBox(){
  try{
    const anchor =
      document.querySelector('#hudTop .score-box') ||
      document.querySelector('.hud-top .score-box') ||
      document.querySelector('[data-hud="scorebox"]');
    if (!anchor) return false;
    if (!_wrap) ensureFeverBar();
    if (_wrap && anchor.parentNode){
      if (_wrap.parentNode !== anchor.parentNode || _wrap.previousElementSibling !== anchor){
        anchor.parentNode.insertBefore(_wrap, anchor.nextSibling);
      }
      return true;
    }
  }catch(_){}
  return false;
}

export function setFever(v){
  _fever = Math.max(0, Math.min(100, Number(v)||0));
  if (_fill) _fill.style.width = _fever + '%';
}
export function setFeverActive(on){
  _active = !!on;
  if (_fire) _fire.style.opacity = _active ? '1' : '0';
}
export function setShield(n){
  _shield = Math.max(0, Math.min(3, Number(n)||0));
  if (_shieldNow) _shieldNow.textContent = '🛡️ ' + _shield + '/3';
}
export function addShield(n){
  _shieldSum += Number(n)||0;
  if (_shieldSumEl) _shieldSumEl.textContent = '🛡️ สะสม ' + _shieldSum;
}

export default { ensureFeverBar, setFever, setFeverActive, setShield, addShield, attachUnderScoreBox };
