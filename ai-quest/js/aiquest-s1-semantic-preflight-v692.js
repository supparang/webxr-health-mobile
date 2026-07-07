/* CSAI2102 AI Quest — S1 Semantic Preflight v6.9.2
   Prevents a learner from starting the legacy replay factory when the semantic deck
   factory is not active. This turns silent fallback into a visible, recoverable state.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S1_SEMANTIC_PREFLIGHT_V692__)return;
  window.__AIQUEST_S1_SEMANTIC_PREFLIGHT_V692__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  if(MID!=='s1'&&MID!=='m1')return;
  const $=id=>document.getElementById(id);
  const active=()=>{
    const api=window.AIQuestReplayFactoryV650;
    return !!(api&&api.semanticDiversity===true&&String(api.version||'')==='v6.9.0'&&typeof api.makeDeck==='function');
  };
  function status(){
    const box=$('deckInfo');
    if(!box)return;
    if(active()){
      box.innerHTML='<b>✓ S1 Semantic Deck พร้อมสร้าง</b><br><span class="mini">15 แนวคิด • 15 แหล่งโจทย์ • 15 รูปแบบคำถาม • 15 บริบท</span>';
      box.dataset.semanticReady='true';
    }else{
      box.innerHTML='<b style="color:#fecaca">กำลังเตรียม Semantic Deck…</b><br><span class="mini">ยังไม่อนุญาตให้เริ่มจนกว่า generator รุ่นใหม่พร้อม</span>';
      box.dataset.semanticReady='false';
    }
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#start');
    if(!button||active())return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    status();
    const note=$('profileNote');
    if(note){note.className='notice bad';note.textContent='กำลังโหลด Semantic Deck ใหม่ กรุณารอสักครู่แล้วกดเริ่มอีกครั้ง';}
  },true);
  setInterval(status,100);status();
})();