/* === /herohealth/vr-groups/groups-hud-quest.js ===
Goal/Mini HUD binder — Always visible
- listens: quest:update
- creates #questBars automatically if missing
*/

(function(){
  'use strict';
  const DOC = document;

  function ensureBars(){
    let host = DOC.getElementById('questBars');
    if (host) return host;

    host = DOC.createElement('div');
    host.id = 'questBars';
    host.className = 'questBars';
    host.setAttribute('aria-label','Quest Bars');

    host.innerHTML = `
      <div class="qrow">
        <div class="qtag">GOAL</div>
        <div class="qtitle" id="uiGoalTitle">-</div>
        <div class="qprog" id="uiGoalProg">0/0</div>
      </div>
      <div class="qbar"><i id="uiGoalBar"></i></div>

      <div class="qrow" style="margin-top:10px">
        <div class="qtag qmini">MINI</div>
        <div class="qtitle" id="uiMiniTitle">-</div>
        <div class="qprog"><span id="uiMiniProg">0/0</span> • <span id="uiMiniTimer">0s</span></div>
      </div>
      <div class="qbar qmini"><i id="uiMiniBar"></i></div>
    `;
    DOC.body.appendChild(host);

    // inject CSS once
    if (!DOC.getElementById('questbars-css')){
      const st = DOC.createElement('style');
      st.id = 'questbars-css';
      st.textContent = `
        .questBars{
          position:fixed; left:12px; right:12px;
          top: calc(62px + env(safe-area-inset-top,0px));
          z-index:58; pointer-events:none;
          background:rgba(2,6,23,.62);
          border:1px solid rgba(148,163,184,.14);
          border-radius:18px;
          padding:10px 12px;
          box-shadow:0 16px 40px rgba(0,0,0,.35);
        }
        .qrow{display:flex;align-items:center;gap:10px}
        .qtag{
          font-size:11px;font-weight:900;
          padding:4px 10px;border-radius:999px;
          border:1px solid rgba(148,163,184,.16);
          background:rgba(15,23,42,.60);
          color:#e5e7eb;
        }
        .qtag.qmini{background:rgba(34,211,238,.10);border-color:rgba(34,211,238,.20)}
        .qtitle{flex:1;font-size:12px;color:#e5e7eb;opacity:.95}
        .qprog{font-size:12px;color:#94a3b8}
        .qbar{height:10px;margin-top:8px;border-radius:999px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.55)}
        .qbar>i{display:block;height:100%;width:0%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.90))}
        .qbar.qmini>i{background:linear-gradient(90deg, rgba(34,211,238,.92), rgba(167,139,250,.90))}
      `;
      DOC.head.appendChild(st);
    }
    return host;
  }

  function $(id){ return DOC.getElementById(id); }
  function pct(a,b){
    a = Number(a)||0; b = Math.max(1, Number(b)||1);
    return Math.max(0, Math.min(1, a/b));
  }

  ensureBars();

  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    ensureBars();

    const gTitle = d.goalTitle || '-';
    const gNow   = Number(d.goalNow||0);
    const gTot   = Number(d.goalTotal||0);

    const mTitle = d.miniTitle || '-';
    const mNow   = Number(d.miniNow||0);
    const mTot   = Number(d.miniTotal||0);
    const mLeft  = Number(d.miniTimeLeftSec||0);

    const elGT = $('uiGoalTitle'); if (elGT) elGT.textContent = gTitle;
    const elGP = $('uiGoalProg');  if (elGP) elGP.textContent = `${gNow}/${gTot}`;
    const elGB = $('uiGoalBar');   if (elGB) elGB.style.width = (pct(gNow,gTot)*100).toFixed(1)+'%';

    const elMT = $('uiMiniTitle'); if (elMT) elMT.textContent = mTitle;
    const elMP = $('uiMiniProg');  if (elMP) elMP.textContent = `${mNow}/${mTot}`;
    const elMB = $('uiMiniBar');   if (elMB) elMB.style.width = (pct(mNow,mTot)*100).toFixed(1)+'%';

    const elTm = $('uiMiniTimer'); if (elTm) elTm.textContent = `${Math.max(0, mLeft|0)}s`;
  }, { passive:true });
})();