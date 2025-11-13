// === /HeroHealth/vr/ui-coach.js (2025-11-13 VR COACH HUD) ===
(function(){
  'use strict';

  if (document.getElementById('hha-coach-root')) return;

  const root = document.createElement('div');
  root.id = 'hha-coach-root';
  root.innerHTML = `
    <div class="coach-bubble">
      <div class="label">COACH</div>
      <div class="msg" id="hhaCoachMsg">แตะของดี เลี่ยงของเสียให้ได้มากที่สุด</div>
    </div>
  `;
  document.body.appendChild(root);

  const css = document.createElement('style');
  css.id = 'hha-coach-css';
  css.textContent = `
    #hha-coach-root{
      position:fixed; left:50%; top:74px; transform:translateX(-50%);
      z-index:510; pointer-events:none;
    }
    #hha-coach-root .coach-bubble{
      max-width:min(420px,86vw);
      background:#020617dd;
      border-radius:14px;
      border:1px solid #1f2937;
      box-shadow:0 14px 32px rgba(0,0,0,.45);
      padding:6px 10px 8px 10px;
    }
    #hha-coach-root .label{
      font:900 10px system-ui;
      letter-spacing:.12em;
      color:#a5b4fc;
      opacity:.9;
      margin-bottom:2px;
    }
    #hha-coach-root .msg{
      font:800 13px system-ui;
      color:#e5e7eb;
      line-height:1.25;
    }
    #hha-coach-root.good .coach-bubble{
      border-color:#22c55e60;
      box-shadow:0 18px 40px rgba(34,197,94,.35);
    }
    #hha-coach-root.warn .coach-bubble{
      border-color:#fbbf2460;
      box-shadow:0 18px 40px rgba(251,191,36,.35);
    }
    #hha-coach-root.bad .coach-bubble{
      border-color:#ef444460;
      box-shadow:0 18px 40px rgba(239,68,68,.35);
    }
    @media (max-width:640px){
      #hha-coach-root{ top:78px; }
    }
  `;
  document.head.appendChild(css);

  const msgEl = root.querySelector('#hhaCoachMsg');

  let timer = null;
  function setTone(tone){
    root.classList.remove('good','warn','bad');
    if (tone==='good') root.classList.add('good');
    else if (tone==='warn') root.classList.add('warn');
    else if (tone==='bad') root.classList.add('bad');
  }

  function showMsg(text, tone){
    if (!text) return;
    msgEl.textContent = text;
    setTone(tone||'info');
    clearTimeout(timer);
    timer = setTimeout(()=>{ setTone('info'); }, 3500);
  }

  window.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    showMsg(d.msg || '', d.tone || 'info');
  });

})();