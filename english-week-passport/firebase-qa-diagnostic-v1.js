(function(){
  'use strict';
  const VERSION='2026-08-07-FIREBASE-QA-DIAGNOSTIC-V1';
  const authority=window.EW_AUTHORITY;
  const screen=document.getElementById('screen');
  if(!screen||!authority)return;

  function isQa(){
    const p=new URLSearchParams(location.search);
    if(p.get('qa')==='1'||p.get('debug')==='1')return true;
    try{
      const raw=localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1');
      const id=String(JSON.parse(raw||'null')?.playerId||'').toUpperCase();
      return /^(QA-|TEST-|99)/.test(id);
    }catch(_){return false}
  }

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function status(){return authority.getRuntimeStatus?.()||{mode:'unknown',lastError:'',endpoint:'',endpointReady:false,lastSuccessAt:''}}

  function render(){
    if(!isQa())return;
    const card=screen.querySelector('.summary-card');
    if(!card)return;
    const title=card.querySelector('h2')?.textContent||'';
    if(!/ยืนยันผลไม่ได้/.test(title))return;
    let box=card.querySelector('#ewFirebaseQaDiag');
    if(!box){
      box=document.createElement('section');
      box.id='ewFirebaseQaDiag';
      box.style.cssText='margin:14px 0 0;padding:12px;border:1.5px dashed #d89b42;border-radius:14px;background:#fff8e8;text-align:left;color:#5b421b;font-size:.78rem;line-height:1.4;overflow-wrap:anywhere';
      const retry=card.querySelector('#retrySubmitBtn');
      (retry?.parentElement||card).insertAdjacentElement('beforebegin',box);
    }
    const s=status();
    box.innerHTML=`<strong style="display:block;font-size:.9rem;margin-bottom:6px">🧪 Firebase QA Diagnostic</strong>
      <div><b>Mode:</b> ${esc(s.mode||'unknown')}</div>
      <div><b>Endpoint ready:</b> ${s.endpointReady?'YES':'NO'}</div>
      <div><b>Last error:</b> ${esc(s.lastError||'-')}</div>
      <div><b>Last success:</b> ${esc(s.lastSuccessAt||'-')}</div>
      <details style="margin-top:5px"><summary>Endpoint</summary><code>${esc(s.endpoint||'-')}</code></details>
      <button id="ewFirebaseHealthBtn" type="button" style="width:100%;margin-top:9px;min-height:38px;border:1px solid #b9812d;border-radius:10px;background:#fff;color:#5b421b;font-weight:800">ตรวจ Firebase อีกครั้ง</button>`;
    box.querySelector('#ewFirebaseHealthBtn')?.addEventListener('click',async e=>{
      const btn=e.currentTarget;btn.disabled=true;btn.textContent='กำลังตรวจ Firebase…';
      try{await authority.health?.()}catch(_){}
      finally{setTimeout(()=>{render()},120)}
    },{once:true});
  }

  new MutationObserver(render).observe(screen,{childList:true,subtree:true});
  window.addEventListener('ew-authority-status',render);
  render();
  window.EW_FIREBASE_QA_DIAGNOSTIC=Object.freeze({version:VERSION});
}());
