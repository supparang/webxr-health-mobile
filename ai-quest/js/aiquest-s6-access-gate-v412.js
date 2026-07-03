/*
  CSAI2102 AI Quest — Canonical S6 Minimax Access Gate v5.0.0
  S6 opens after S5. B2 opens after S4, S5, and S6.
*/
(function(){
  'use strict';
  const STORAGE_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const S5='m5',S6='m6',B2='b2';
  function readState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch(_){return {}}}
  function passed(st,id){return !!((st.completed&&st.completed[id])||Number(st.stars&&st.stars[id]||0)>0||Number(st.bestScore&&st.bestScore[id]||0)>=60)}
  function notify(message){if(typeof window.showToast==='function')window.showToast(message);else console.log('[AIQuest]',message)}
  function canOpenS6(){return passed(readState(),S5)}
  function canOpenB2(){const st=readState();return ['m4','m5','m6'].every(id=>passed(st,id))}
  function startS6(){if(!canOpenS6()){notify('S6 Minimax Arena จะเปิดหลังผ่าน S5 A* Rescue Mission อย่างน้อย 1 ดาว');return}if(typeof window.startMission==='function'){window.startMission(S6);return}notify('ยังโหลด S6 engine ไม่ครบ กรุณารีเฟรชหน้าอีกครั้ง')}
  function tuneCard(card){
    if(!card)return;const open=canOpenS6();card.classList.toggle('locked',!open);card.classList.toggle('open',open);if(open)card.removeAttribute('aria-disabled');
    const status=card.querySelector('.roadmapStatus');if(status){status.textContent=open?'Open':'Locked';status.className='roadmapStatus '+(open?'open':'locked')}
    const hint=card.querySelector('.roadmapClickHint');if(hint)hint.textContent=open?'กดเพื่อเริ่ม S6 Minimax Arena':'ผ่าน S5 A* Rescue Mission ก่อน';
    const detail=card.querySelectorAll('.roadmapTopic');if(detail.length>1)detail[1].textContent=open?'เปิดตามเกณฑ์: ผ่าน S5 A* Rescue Mission':'เงื่อนไข: ผ่าน S5 A* Rescue Mission';
  }
  function tuneRoadmap(){
    document.querySelectorAll('[data-roadmap-id="m6"]').forEach(tuneCard);
    document.querySelectorAll('.pill, .subtitle, .tagline, p, div').forEach(el=>{if(el.dataset&&el.dataset.s6MinimaxLabel==='1')return;const t=String(el.textContent||'').trim();if(t==='Phase 1 Ready: S1–S5 + B1–B2 พร้อมใช้งาน'||t==='Phase 1 Complete • S6 เปิดตามเกณฑ์ B2'){el.dataset.s6MinimaxLabel='1';el.textContent='Core Flow • S6 Minimax หลัง S5 → B2 หลัง S4–S6';}});
  }
  document.addEventListener('click',ev=>{const card=ev.target&&ev.target.closest?ev.target.closest('[data-roadmap-id="m6"]'):null;if(!card)return;ev.preventDefault();ev.stopImmediatePropagation();startS6();},true);
  function boot(){tuneRoadmap();const observer=new MutationObserver(tuneRoadmap);observer.observe(document.documentElement,{childList:true,subtree:true});setInterval(tuneRoadmap,1200);window.AIQuestS6AccessGateV500={canOpenS6,canOpenB2,startS6,tuneRoadmap};console.log('[AIQuest] S6 Minimax access gate v5.0.0 loaded')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
