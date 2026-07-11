/* CSAI2102 Teacher Console — Dashboard UX Polish v7.1.2
   - compact system status
   - remove duplicate/version badge clutter
   - quick jump to Learning Analytics
   - preserve Inspector and analytics logic
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_DASHBOARD_POLISH_V712__)return;
  window.__AIQUEST_TEACHER_DASHBOARD_POLISH_V712__=true;
  const VERSION='v7.1.2';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const STATUS=[
    ['Challenge','v711–v712.8'],
    ['Teacher Inspector','v701'],
    ['Inspector Polish','v702'],
    ['Data Accuracy','v698'],
    ['Unified Analytics','v699'],
    ['Learning Analytics','v710'],
    ['Dashboard Polish','v712']
  ];
  function cleanBadges(){
    const row=document.querySelector('.brand .row');if(!row)return;
    [...row.querySelectorAll('.pill')].forEach(el=>{
      const t=(el.textContent||'').trim().toLowerCase();
      if(/challenge v|teacher inspector|inspector polish|data accuracy|unified analytics|learning analytics|dashboard polish/.test(t))el.remove();
    });
    if(!document.getElementById('aqSystemReadyV712'))row.insertAdjacentHTML('beforeend','<span id="aqSystemReadyV712" class="pill good">✓ System Ready</span>');
    if(!document.getElementById('aqSystemStatusBtnV712'))row.insertAdjacentHTML('beforeend','<button id="aqSystemStatusBtnV712" type="button" class="pill blue aq712-status-btn">System Status</button>');
  }
  function ensurePanel(){
    if(document.getElementById('aqSystemStatusPanelV712'))return;
    const p=document.createElement('div');p.id='aqSystemStatusPanelV712';p.className='aq712-status-panel';p.innerHTML=`<div class="aq712-status-head"><div><b>CSAI2102 System Status</b><small>Teacher Console runtime components</small></div><button type="button" id="aqSystemStatusCloseV712">ปิด</button></div><div class="aq712-status-grid">${STATUS.map(x=>`<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('')}</div>`;document.body.appendChild(p);
    document.getElementById('aqSystemStatusCloseV712').onclick=()=>p.classList.remove('open');
  }
  function addQuickJump(){
    const top=document.querySelector('header.top');if(!top)return;
    let actions=top.querySelector(':scope > .row');if(!actions)return;
    if(!document.getElementById('aqJumpAnalyticsV712'))actions.insertAdjacentHTML('beforeend','<button id="aqJumpAnalyticsV712" type="button" class="btn secondary">Learning Analytics ↓</button>');
    const b=document.getElementById('aqJumpAnalyticsV712');if(b)b.onclick=()=>{const t=document.getElementById('aqLearningAnalyticsV710');if(t){t.scrollIntoView({behavior:'smooth',block:'start'});t.classList.add('aq712-flash');setTimeout(()=>t.classList.remove('aq712-flash'),1400);}};
  }
  function moveAnalytics(){
    const suite=document.getElementById('aqLearningAnalyticsV710');const studentCard=document.getElementById('studentsBox')?.closest('.card');if(suite&&studentCard&&suite.previousElementSibling!==studentCard){studentCard.insertAdjacentElement('afterend',suite);}if(suite)suite.style.scrollMarginTop='16px';
  }
  function bind(){
    cleanBadges();ensurePanel();addQuickJump();moveAnalytics();
    const btn=document.getElementById('aqSystemStatusBtnV712'),p=document.getElementById('aqSystemStatusPanelV712');if(btn&&p)btn.onclick=()=>p.classList.toggle('open');
  }
  function boot(){
    const style=document.createElement('style');style.textContent=`
      .aq712-status-btn{cursor:pointer;color:#bae6fd}.aq712-status-panel{position:fixed;right:18px;top:86px;z-index:10050;width:min(420px,calc(100vw - 28px));padding:14px;border:1px solid rgba(56,189,248,.35);border-radius:18px;background:#0f1d33;box-shadow:0 24px 70px rgba(0,0,0,.48);display:none}.aq712-status-panel.open{display:block}.aq712-status-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.aq712-status-head b,.aq712-status-head small{display:block}.aq712-status-head small{color:#9fb2cc;margin-top:3px}.aq712-status-head button{border:1px solid rgba(148,163,184,.25);border-radius:10px;padding:7px 10px;background:rgba(255,255,255,.06);color:#e8f1ff;cursor:pointer}.aq712-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.aq712-status-grid div{padding:9px 10px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(255,255,255,.035)}.aq712-status-grid span,.aq712-status-grid b{display:block}.aq712-status-grid span{font-size:11px;color:#9fb2cc}.aq712-status-grid b{margin-top:3px}.aq712-flash{outline:2px solid rgba(56,189,248,.9);box-shadow:0 0 0 8px rgba(56,189,248,.12)}@media(max-width:680px){.aq712-status-panel{top:70px;right:14px}.aq712-status-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
    bind();let n=0;const t=setInterval(()=>{n++;bind();if(n>40)clearInterval(t);},500);
    new MutationObserver(()=>bind()).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('aqSystemStatusPanelV712')?.classList.remove('open');});
    console.log('[AIQuest] Dashboard polish active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_DASHBOARD_POLISH_V712={VERSION,bind};
})();