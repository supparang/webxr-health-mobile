/* CSAI2102 S2 Semantic Runtime v6.9.9 — targeted, event-driven */
(()=>{'use strict';
  if(window.__AQ_S2_SEMANTIC_RUNTIME_699__)return;
  window.__AQ_S2_SEMANTIC_RUNTIME_699__=true;
  const ACTIVE='CSAI2102_ACTIVE_S2_V674',$=id=>document.getElementById(id);
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const deck=()=>read(ACTIVE,null)?.deck||null;
  const ready=()=>{const api=window.AIQuestS2AgentDeckV672;return !!(api&&api.semanticDeckReady===true&&api.semanticDiversity===true&&String(api.version||'')==='v6.9.6')};
  function status(){const node=$('entryGate');if(!node)return;const html=ready()?'ผ่าน S1 แล้ว • <b style="color:#bbf7d0">✓ S2 Semantic Deck พร้อมสร้าง</b><br><small>Context 15/15 • Concept 15/15 • Source 15/15 • Prompt pattern 15/15 • Answer slots 4/3/3/3</small>':'<b style="color:#fecaca">กำลังเตรียม S2 Semantic Deck…</b><br><small>ระบบจะไม่เริ่ม Deck เก่าที่ไม่ผ่าน integrity gate</small>';if(node.innerHTML!==html)node.innerHTML=html;}
  function applySlot(){
    const run=read(ACTIVE,null),card=run?.deck?.cards?.[Number(run?.index||0)];
    if(!run||run.answered||run.ended||card?.subtype!=='choice'||!Number.isInteger(Number(card.answerSlot)))return;
    const box=document.querySelector('#arena .choices');if(!box)return;
    const buttons=[...box.querySelectorAll('.choice')],correct=buttons.find(btn=>btn.textContent===String(card.correct||''));
    const slot=Math.max(0,Math.min(3,Number(card.answerSlot)));if(!correct||buttons.indexOf(correct)===slot)return;
    box.insertBefore(correct,box.children[slot]||null);
  }
  function subtitle(){const current=deck(),audit=current?.semanticAudit,node=$('gameSub');if(!audit?.ok||!node)return;const slots=(current.answerPositionAudit?.plannedSlots||audit.answerSlots||[]).join('/');const text='Deck #'+String(current.round||'—')+' • 15 เคส / 3 Phase • Context unique '+audit.contextUnique+'/15 • Concept '+audit.conceptUnique+'/15 • Source '+audit.sourceUnique+'/15 • Prompt pattern '+audit.promptPatternUnique+'/15 • Answer slots '+slots;if(node.textContent!==text)node.textContent=text;}
  function patchSubmit(){const sync=window.AIQuestSync;if(!sync||sync.__aqS2Runtime699||typeof sync.submitAttempt!=='function')return;sync.__aqS2Runtime699=true;const old=sync.submitAttempt.bind(sync);sync.submitAttempt=function(payload){if(String(payload?.sessionId||payload?.missionId||'').toLowerCase()==='s2'){const current=deck(),audit=current?.semanticAudit||{};payload.extraJson=Object.assign({},payload.extraJson||{},{semanticDeckVersion:'v6.9.6',semanticDeckIntegrity:audit,answerPositionAudit:current?.answerPositionAudit||null,semanticDeckReady:!!audit.ok,contextUniqueCount:Number(audit.contextUnique||0),conceptUniqueCount:Number(audit.conceptUnique||0),sourceUniqueCount:Number(audit.sourceUnique||0),promptPatternUniqueCount:Number(audit.promptPatternUnique||0),fingerprintUniqueCount:Number(audit.fingerprintUnique||0)});}return old(payload);};}
  document.addEventListener('click',event=>{const start=event.target?.closest?.('#start');if(!start||ready())return;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();status();const note=$('profileNote');if(note){note.className='notice bad';note.textContent='Semantic Deck ยังไม่พร้อม กรุณารอสักครู่แล้วกดเริ่มใหม่';}},true);
  document.addEventListener('DOMContentLoaded',()=>{status();patchSubmit();const arena=$('arena');if(arena){new MutationObserver(()=>{applySlot();subtitle();}).observe(arena,{childList:true,subtree:true});}applySlot();subtitle();});
  status();patchSubmit();
})();