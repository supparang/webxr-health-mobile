/* CSAI2102 Teacher Inspector Polish v7.0.2
   - honest Wrong-only state when no per-card wrong log exists
   - previous/next session navigation without opening a long native select
   - leaves reliable pointerdown View opening untouched
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_INSPECTOR_POLISH_V702__)return;
  window.__AIQUEST_TEACHER_INSPECTOR_POLISH_V702__=true;
  const MODAL='aqInspectorV701';

  function moveSession(delta){
    const sel=document.getElementById('aq701Session');
    if(!sel||!sel.options.length)return;
    const next=Math.max(0,Math.min(sel.options.length-1,sel.selectedIndex+delta));
    if(next===sel.selectedIndex)return;
    sel.selectedIndex=next;
    sel.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function polish(){
    const modal=document.getElementById(MODAL);
    if(!modal)return;

    const selectors=modal.querySelector('.selectors');
    const session=modal.querySelector('#aq701Session');
    if(selectors&&session&&!modal.querySelector('.aq702-session-nav')){
      const wrap=document.createElement('div');
      wrap.className='aq702-session-nav';
      wrap.innerHTML='<button type="button" class="aq702-prev" title="Session ก่อนหน้า">← ก่อนหน้า</button><button type="button" class="aq702-next" title="Session ถัดไป">ถัดไป →</button>';
      selectors.appendChild(wrap);
      wrap.querySelector('.aq702-prev').onclick=()=>moveSession(-1);
      wrap.querySelector('.aq702-next').onclick=()=>moveSession(1);
    }

    const wrong=modal.querySelector('[data-filter="wrong"]');
    if(wrong&&/ไม่มีรายการ|ไม่มี log/i.test(wrong.textContent||'')){
      wrong.disabled=true;
      wrong.setAttribute('aria-disabled','true');
      wrong.title='Attempt นี้ไม่ได้บันทึก wrongItems รายข้อ จึงระบุข้อที่ตอบผิดอย่างแม่นยำไม่ได้';
      wrong.textContent='Wrong only • ไม่มี log รายข้อ';
      const tools=wrong.closest('.aq701-tools');
      if(tools&&!tools.nextElementSibling?.classList?.contains('aq702-note')){
        const note=document.createElement('div');
        note.className='aq702-note';
        note.textContent='หมายเหตุ: คะแนนรวมบอกจำนวนข้อผิดได้ แต่ Sheet รอบนี้ไม่มีรหัสข้อผิดรายข้อ จึงไม่เดาว่าข้อใดผิด ใช้ Review Focus และ High–Critical เพื่อช่วยทบทวนแทน';
        tools.insertAdjacentElement('afterend',note);
      }
    }

    if(!modal.querySelector('#aq702Style')){
      const style=document.createElement('style');
      style.id='aq702Style';
      style.textContent=`
        #${MODAL} .selectors{grid-template-columns:minmax(0,1fr) 360px auto!important;align-items:center}
        #${MODAL} .aq702-session-nav{display:flex;gap:7px;white-space:nowrap}
        #${MODAL} .aq702-session-nav button{padding:9px 10px}
        #${MODAL} [data-filter="wrong"]:disabled{opacity:.52;cursor:not-allowed;border-style:dashed}
        #${MODAL} .aq702-note{margin:0 0 10px;padding:10px 12px;border:1px solid rgba(245,158,11,.35);border-radius:12px;background:rgba(245,158,11,.08);color:#fde68a;font-size:13px;line-height:1.5}
        @media(max-width:880px){#${MODAL} .selectors{grid-template-columns:1fr!important}#${MODAL} .aq702-session-nav button{flex:1}}
        @media print{#${MODAL} .aq702-session-nav,#${MODAL} .aq702-note{display:none!important}}
      `;
      modal.appendChild(style);
    }
  }

  const observer=new MutationObserver(polish);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',polish,{once:true});
  setTimeout(polish,0);
  window.AIQUEST_TEACHER_INSPECTOR_POLISH_V702={version:'v7.0.2',polish};
  console.log('[AIQuest] Teacher Inspector Polish active v7.0.2');
})();