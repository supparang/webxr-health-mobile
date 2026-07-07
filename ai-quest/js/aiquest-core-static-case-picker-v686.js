/* CSAI2102 Core Static Case Picker v6.8.6
   The Case-picker container is part of the HTML. This script only fills it from
   the exact completed replay deck; it cannot disappear because of a mount race.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_STATIC_CASE_PICKER_V686__)return;
  window.__AIQUEST_CORE_STATIC_CASE_PICKER_V686__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const $=id=>document.getElementById(id);
  const tidy=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const storeKey=()=>('CSAI2102_CORE_SELECTED_CASE_V686_'+MID+'_'+String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_'));
  const focus=card=>card?.kind==='twist'?'Case Twist':card?.kind==='m'?'กลไกภารกิจ':'ความรู้เชิงวิเคราะห์';
  const deck=()=>read(ACTIVE,null)?.deck||null;
  const items=()=>((deck()?.cards)||[]).map((card,index)=>({id:tidy(card?.id||'case_'+index),no:index+1,context:tidy(card?.context||'Case '+(index+1)),phase:tidy(card?.phase||'Replay Deck'),focus:focus(card),prompt:tidy(card?.prompt||''),correct:tidy(card?.correct||'')}));
  const panel=$('coreEvidenceBindingV675'),select=$('coreEvidenceCase'),open=$('coreEvidenceOpenV686'),title=$('coreEvidenceTitleV686'),meta=$('coreEvidenceMetaV686'),list=$('coreEvidenceListV686'),brief=$('coreEvidenceBriefV686'),status=$('coreEvidenceStatusV686');
  function selected(){return items().find(item=>String(item.id)===String(select?.value||''))||null}
  function evidence(card){const current=deck();return card?{version:'v6.8.6',missionId:MID,deckId:tidy(current?.id||''),deckRound:Number(current?.round||0),selectedCaseId:card.id,selectedCaseContext:card.context,selectedCasePhase:card.phase,selectedCaseFocus:card.focus,selectedCasePrompt:card.prompt,selectedCaseExpectedConcept:card.correct,checkedAt:new Date().toISOString(),integrity:{ok:true,errorCount:0,checks:{selectedCase:true}}}:null}
  function update(){
    if(!panel||!select)return;
    const current=deck(),cards=items();
    if(!current||!cards.length){status.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">กำลังรอ Deck ของรอบนี้…</span>';return}
    if(panel.dataset.deckId!==String(current.id||'')){
      panel.dataset.deckId=String(current.id||'');
      const saved=read(storeKey(),null);
      select.innerHTML='<option value="">— เลือก Case ที่ใช้เป็นหลักฐาน —</option>'+cards.map(card=>'<option value="'+esc(card.id)+'">Case '+card.no+' • '+esc(card.context)+'</option>').join('');
      select.value=saved&&String(saved.deckId)===String(current.id)?String(saved.caseId||''):'';
      list.innerHTML=cards.map(card=>'<button type="button" class="cevi-card" data-case="'+esc(card.id)+'"><span class="cevi-num">Case '+card.no+'</span><span class="cevi-context">'+esc(card.context)+'</span><span class="cevi-meta">'+esc(card.phase)+' • '+esc(card.focus)+'</span><span class="cevi-prompt"><b>โจทย์:</b> '+esc(card.prompt.slice(0,150))+(card.prompt.length>150?'…':'')+'</span><span class="cevi-action">กดเพื่อเลือก Case นี้</span></button>').join('');
    }
    const card=selected();
    list.querySelectorAll('.cevi-card').forEach(button=>{const on=String(button.dataset.case)===String(select.value||'');button.classList.toggle('selected',on);const action=button.querySelector('.cevi-action');if(action)action.textContent=on?'✓ เลือก Case นี้แล้ว':'กดเพื่อเลือก Case นี้'});
    if(!card){title.textContent='เลือก Case ที่ใช้เป็นหลักฐาน';meta.textContent='เลือก 1 Case จาก Deck ที่เล่นจริงในรอบนี้';brief.innerHTML='';status.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case — ส่งผลไม่ได้จนกว่าจะเลือก</span>';window.AIQuestCoreReflectionEvidenceCurrent=null;return}
    title.textContent=card.context;meta.textContent=card.phase+' • '+card.focus;brief.innerHTML='<b>📌 โจทย์ Case ที่เลือก</b><br><span>'+esc(card.prompt)+'</span><small>ใช้ Case นี้เป็นฐานเดียวกันในการตอบ Reflection ทั้ง 3 ข้อ</small>';status.innerHTML='<b>Evidence Check</b><br><span style="color:#bbf7d0">✓ เลือก Case ที่เล่นจริงแล้ว พร้อมเขียน Reflection</span>';write(storeKey(),{deckId:String(current.id),caseId:card.id});window.AIQuestCoreReflectionEvidenceCurrent=evidence(card);
  }
  function protectSave(event){if(!event.target?.closest?.('#save'))return;if(selected())return;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();const note=$('saveNote');if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้:</b> เลือก 1 Case จาก Deck ที่เล่นจริงก่อน แล้วจึงเขียน Reflection ทั้ง 3 ข้อ'}panel?.scrollIntoView({behavior:'smooth',block:'center'})}
  function patchSubmit(){const sync=window.AIQuestSync;if(!sync||sync.__coreStaticCasePickerV686||typeof sync.submitAttempt!=='function')return;sync.__coreStaticCasePickerV686=true;const original=sync.submitAttempt.bind(sync);sync.submitAttempt=function(payload){const card=selected();payload.extraJson=Object.assign({},payload.extraJson||{},{coreReflectionEvidenceCaptured:!!card,coreReflectionEvidenceBound:!!card,coreReflectionEvidence:evidence(card),selectedCaseId:card?.id||'',selectedCaseContext:card?.context||'',selectedCasePhase:card?.phase||'',selectedCaseFocus:card?.focus||'',selectedCasePrompt:card?.prompt||''});return original(payload)}}
  open?.addEventListener('click',()=>{const show=!panel.classList.contains('open');panel.classList.toggle('open',show);open.setAttribute('aria-expanded',show?'true':'false')});
  list?.addEventListener('click',event=>{const button=event.target.closest('.cevi-card');if(!button)return;select.value=button.dataset.case;panel.classList.remove('open');open?.setAttribute('aria-expanded','false');select.dispatchEvent(new Event('change',{bubbles:true}));update()});
  select?.addEventListener('change',update);document.addEventListener('click',protectSave,true);setInterval(()=>{update();patchSubmit()},150);update();patchSubmit();
})();
