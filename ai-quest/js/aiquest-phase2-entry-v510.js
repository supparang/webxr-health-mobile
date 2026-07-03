/* CSAI2102 AI Quest — Phase 2 Module 3 entry v5.2.0 */
(function(){
  'use strict';
  const CORE='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const URL='./phase2.html';
  function read(){try{return JSON.parse(localStorage.getItem(CORE)||'{}')||{};}catch(error){return {};}}
  function passed(state,id){return !!((state.completed&&state.completed[id])||(state.stars&&Number(state.stars[id]||0)>0)||(state.mastered&&state.mastered[id])||(state.bestScore&&Number(state.bestScore[id]||0)>=60));}
  function hasB2(){return passed(read(),'b2');}
  function style(){
    if(document.getElementById('aiquestPhase2EntryStyle'))return;
    const s=document.createElement('style');s.id='aiquestPhase2EntryStyle';
    s.textContent='.aiqPhase2Entry{margin:14px 0;padding:14px;border:1px solid rgba(52,211,153,.34);border-radius:18px;background:linear-gradient(135deg,rgba(5,150,105,.14),rgba(14,116,144,.12));line-height:1.55;color:#d1fae5}.aiqPhase2Entry b{color:#ecfdf5}.aiqPhase2Entry a{display:inline-block;margin-top:9px;padding:9px 12px;border-radius:12px;background:linear-gradient(135deg,#059669,#22c55e);color:#fff;text-decoration:none;font-weight:900}';document.head.appendChild(s);
  }
  function injectMap(){
    const map=document.getElementById('missionMap');
    if(!map||document.getElementById('aiquestPhase2EntryMap'))return;
    const box=document.createElement('div');box.id='aiquestPhase2EntryMap';box.className='aiqPhase2Entry';
    box.innerHTML=hasB2()?'<b>Module 3 เปิดแล้ว: Reasoning, Uncertainty & Knowledge</b><br>เริ่ม S7 Knowledge Base Forge ก่อน Midterm แล้วต่อ S8 Uncertainty, S9 Expert System และ B3.<br><a href="'+URL+'">เปิด Phase 2 Mission Map →</a>':'<b>Module 3: Reasoning, Uncertainty & Knowledge</b><br>จะเปิดหลังผ่าน B2 Search & Game AI Boss Gate';
    map.parentNode&&map.parentNode.insertBefore(box,map.nextSibling);
  }
  function injectResult(){
    const result=document.getElementById('resultScreen');
    const heading=String(document.getElementById('resultHeading')?.textContent||'').toLowerCase();
    if(!result||!hasB2()||!/b2|search & game|search arena|applied ai/.test(heading)||document.getElementById('aiquestPhase2EntryResult'))return;
    const box=document.createElement('div');box.id='aiquestPhase2EntryResult';box.className='aiqPhase2Entry';box.innerHTML='<b>ปลดล็อก Module 3 แล้ว</b><br>ไป S7 Knowledge Base Forge → Week 8 Midterm/Review → S8/S9 → B3 Reasoning & Knowledge Boss.<br><a href="'+URL+'">เปิด Phase 2 Mission Map →</a>';
    const target=document.getElementById('saveStatusBox')||result.querySelector('.resultBox')||result;target.parentNode&&target.parentNode.insertBefore(box,target.nextSibling);
  }
  function apply(){style();injectMap();injectResult();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  window.AIQuestPhase2EntryV520={apply,hasB2};
})();
