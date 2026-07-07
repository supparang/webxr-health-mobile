/* CSAI2102 S2 Next Recovery v7.0.0
   Normal engine navigation remains primary. If a Next click is swallowed after
   a marked answer, restoreRun uses the saved answered state to advance safely.
   No polling and no DOM observer.
*/
(()=>{'use strict';
  if(window.__AQ_S2_NEXT_RECOVERY_V700__)return;
  window.__AQ_S2_NEXT_RECOVERY_V700__=true;
  const ACTIVE='CSAI2102_ACTIVE_S2_V674';
  const read=()=>{try{return JSON.parse(localStorage.getItem(ACTIVE)||'null')}catch(e){return null}};
  const toast=text=>{const node=document.getElementById('toast');if(!node)return;node.textContent=text;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2200);};
  document.addEventListener('click',event=>{
    const next=event.target?.closest?.('#next');
    if(!next||next.disabled)return;
    const before=read();
    if(!before||!before.answered)return;
    const beforeIndex=Number(before.index||0),last=Array.isArray(before.deck?.cards)?before.deck.cards.length-1:-1;
    window.setTimeout(()=>{
      const after=read();
      if(!after||Number(after.index||0)!==beforeIndex||after.answered!==true)return;
      toast(beforeIndex>=last?'กำลังกู้หน้าสรุปผล…':'กำลังกู้การไปเคสถัดไป…');
      window.setTimeout(()=>location.reload(),120);
    },320);
  },false);
})();