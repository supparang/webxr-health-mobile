/* CSAI2102 AI Quest — Core Case Picker Recovery v6.8.4
   Fail-safe renderer for S1/S3–S9/Boss results. The reflection Case picker must
   always appear before the three reflection questions while an unsent replay deck exists.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_CASE_PICKER_RECOVERY_V684__)return;
  window.__AIQUEST_CORE_CASE_PICKER_RECOVERY_V684__=true;

  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const $=id=>document.getElementById(id);
  const tidy=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const count=value=>String(value||'').replace(/\s/g,'').length;
  const activeKeys=[
    'CSAI2102_ACTIVE_REPLAY_V674_'+MID,
    'CSAI2102_ACTIVE_REPLAY_V674_s1',
    'CSAI2102_ACTIVE_REPLAY_V674_m1'
  ];
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const storeKey=()=>('CSAI2102_CORE_CASE_PICKER_RECOVERY_V684_'+MID+'_'+String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_'));
  const focus=card=>card?.kind==='twist'?'Case Twist':card?.kind==='m'?'กลไกภารกิจ':'ความรู้เชิงวิเคราะห์';
  const expected=card=>tidy(card?.correct||'');
  function snapshot(){
    for(const key of activeKeys){
      const candidate=read(key,null);
      if(candidate?.deck?.cards?.length)return {key,snapshot:candidate,deck:candidate.deck};
    }
    return null;
  }
  function deckCards(){
    const current=snapshot();
    if(!current)return null;
    return {deckId:tidy(current.deck.id||'coredeck'),round:Number(current.deck.round||0),cards:current.deck.cards.map((card,index)=>({
      id:tidy(card?.id||'case_'+index),no:index+1,context:tidy(card?.context||'Case '+(index+1)),phase:tidy(card?.phase||'Replay Deck'),kind:tidy(card?.kind||'q'),focus:focus(card),prompt:tidy(card?.prompt||''),correct:expected(card)
    }))};
  }
  function selected(data){
    const select=$('coreEvidenceCase');
    return data?.cards.find(card=>String(card.id)===String(select?.value||''))||null;
  }
  function saveSelection(data,card){
    if(data&&card)write(storeKey(),{deckId:data.deckId,caseId:card.id});
  }
  function restoreSelection(data){
    const stored=read(storeKey(),null);
    return stored&&String(stored.deckId)===String(data?.deckId)?String(stored.caseId||''):'';
  }
  function evidence(data,card){
    return card?{
      version:'v6.8.4',missionId:MID,deckId:data.deckId,deckRound:data.round,
      selectedCaseId:card.id,selectedCaseContext:card.context,selectedCasePhase:card.phase,
      selectedCaseFocus:card.focus,selectedCasePrompt:card.prompt,selectedCaseExpectedConcept:card.correct,
      checkedAt:new Date().toISOString(),integrity:{ok:true,errorCount:0,checks:{selectedCase:true}}
    }:null;
  }
  function setCurrent(data,card){window.AIQuestCoreReflectionEvidenceCurrent=evidence(data,card);}
  function update(panel){
    const data=deckCards();
    if(!panel||!data)return;
    const select=$('coreEvidenceCase');
    const card=selected(data);
    const title=panel.querySelector('.cev-title'),meta=panel.querySelector('.cev-meta'),info=panel.querySelector('.cev-info'),status=panel.querySelector('.cev-status'),brief=panel.querySelector('.cev-brief');
    panel.querySelectorAll('.cev-case').forEach(button=>{const on=String(button.dataset.value||'')===String(select?.value||'');button.classList.toggle('selected',on);button.setAttribute('aria-pressed',on?'true':'false');const action=button.querySelector('.cev-action');if(action)action.textContent=on?'✓ เลือก Case นี้แล้ว':'กดเพื่อเลือก Case นี้';});
    if(!card){
      title.textContent='เลือก Case ที่ใช้เป็นหลักฐาน';
      meta.textContent='เลือก 1 Case จาก Replay Deck ที่เล่นจริงในรอบนี้';
      info.innerHTML='อ่านโจทย์ย่อ แล้วเลือก <b>1 Case</b> ที่จะใช้เป็นฐานเดียวกันสำหรับ Reflection ทั้ง 3 ข้อ';
      brief.innerHTML='';
      status.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case — ส่งผลไม่ได้จนกว่าจะเลือก</span>';
      setCurrent(data,null);
      return;
    }
    title.textContent=card.context;
    meta.textContent=card.phase+' • '+card.focus;
    info.innerHTML='<b>Case ที่เลือก:</b> '+esc(card.context)+'<br><span style="color:#b9d9f4">'+esc(card.phase)+' • '+esc(card.focus)+'</span>';
    brief.innerHTML='<b>📌 โจทย์ Case ที่เลือก</b><br><span>'+esc(card.prompt)+'</span><small>ตอบ Reflection ทั้ง 3 ข้อโดยยึด Case นี้เพียง Case เดียว</small>';
    status.innerHTML='<b>Evidence Check</b><br><span style="color:#bbf7d0">✓ เลือก Case ที่เล่นจริงแล้ว พร้อมเขียน Reflection</span>';
    saveSelection(data,card);setCurrent(data,card);
  }
  function mount(){
    const data=deckCards();
    const host=document.querySelector('#result .reflection');
    if(!data||!host)return;
    let panel=$('coreEvidenceBindingV675');
    if(panel&&panel.dataset.recovery==='v684'){update(panel);return;}
    if(panel)return; // Existing primary picker is already mounted.
    const select=document.createElement('select');
    select.id='coreEvidenceCase';select.setAttribute('aria-hidden','true');
    select.innerHTML='<option value="">— เลือก Case ที่ใช้เป็นหลักฐาน —</option>'+data.cards.map(card=>'<option value="'+esc(card.id)+'">Case '+card.no+' • '+esc(card.context)+'</option>').join('');
    select.value=restoreSelection(data);
    panel=document.createElement('section');
    panel.id='coreEvidenceBindingV675';panel.dataset.deckId=data.deckId;panel.dataset.recovery='v684';
    panel.innerHTML='<div class="cev-heading">🔗 Reflection Evidence • เลือก Case จาก Deck นี้</div><div class="cev-desc"><b>จำเป็นต้องเลือก 1 Case</b> ที่เล่นจริงก่อนส่ง Reflection เพื่อให้ครูตรวจความเชื่อมโยงกับโจทย์ได้</div><button type="button" class="cev-open" aria-expanded="false"><span><b class="cev-title">เลือก Case ที่ใช้เป็นหลักฐาน</b><small class="cev-meta">เลือก 1 Case จาก Deck ที่เล่นจริงในรอบนี้</small></span><span class="cev-arrow">⌄</span></button><div class="cev-list">'+data.cards.map(card=>'<button type="button" class="cev-case" data-value="'+esc(card.id)+'" aria-pressed="false"><span class="cev-num">Case '+card.no+'</span><span class="cev-context">'+esc(card.context)+'</span><span class="cev-cardmeta">'+esc(card.phase)+' • '+esc(card.focus)+'</span><span class="cev-prompt"><b>โจทย์:</b> '+esc(card.prompt.slice(0,150))+(card.prompt.length>150?'…':'')+'</span><span class="cev-action">กดเพื่อเลือก Case นี้</span></button>').join('')+'</div><div class="cev-info"></div><div class="cev-brief"></div><div class="cev-status"></div>';
    host.insertBefore(panel,host.firstChild);panel.insertBefore(select,panel.firstChild);
    const open=panel.querySelector('.cev-open');
    open.onclick=()=>{const show=!panel.classList.contains('open');panel.classList.toggle('open',show);open.setAttribute('aria-expanded',show?'true':'false');};
    panel.querySelectorAll('.cev-case').forEach(button=>button.onclick=()=>{select.value=button.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));panel.classList.remove('open');open.setAttribute('aria-expanded','false');update(panel);});
    select.addEventListener('change',()=>update(panel));
    update(panel);
  }
  function guardSave(event){
    const button=event.target?.closest?.('#save');
    if(!button)return;
    const data=deckCards(),card=selected(data);
    if(card)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const note=$('saveNote');
    if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้:</b> เลือก Case ที่เล่นจริงจาก Replay Deck ก่อน แล้วจึงเขียน Reflection ทั้ง 3 ข้อ';}
    $('coreEvidenceBindingV675')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function patchSync(){
    const sync=window.AIQuestSync;
    if(!sync||sync.__coreCasePickerRecoveryV684||typeof sync.submitAttempt!=='function')return;
    sync.__coreCasePickerRecoveryV684=true;
    const original=sync.submitAttempt.bind(sync);
    sync.submitAttempt=function(payload){
      const mission=String(payload?.sessionId||payload?.missionId||'').toLowerCase();
      if(mission===MID&&mission!=='s2'){
        const data=deckCards(),card=selected(data),current=evidence(data,card);
        payload.extraJson=Object.assign({},payload.extraJson||{},{coreReflectionEvidenceCaptured:!!current,coreReflectionEvidenceBound:!!current,coreReflectionEvidence:current,selectedCaseId:current?.selectedCaseId||'',selectedCaseContext:current?.selectedCaseContext||'',selectedCasePhase:current?.selectedCasePhase||'',selectedCaseFocus:current?.selectedCaseFocus||''});
      }
      return original(payload);
    };
  }
  function style(){
    if($('aiquestCoreCasePickerRecoveryStyleV684'))return;
    const node=document.createElement('style');node.id='aiquestCoreCasePickerRecoveryStyleV684';node.textContent=`
      #coreEvidenceCase{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}
      #coreEvidenceBindingV675{padding:13px;border:1px solid rgba(56,189,248,.60);border-radius:15px;background:rgba(56,189,248,.08);margin-bottom:12px;line-height:1.58}
      #coreEvidenceBindingV675 .cev-heading{font-size:16px;font-weight:900;color:#f0f9ff}#coreEvidenceBindingV675 .cev-desc{margin:5px 0 10px;color:#cfe8ff;font-size:13px}
      #coreEvidenceBindingV675 .cev-open{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;padding:12px 13px;border:1px solid rgba(56,189,248,.74);border-radius:13px;background:#16253a;color:#f8fbff;font:700 15px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
      #coreEvidenceBindingV675 .cev-open small{display:block;margin-top:3px;color:#b9d9f4;font-weight:600;font-size:12px;line-height:1.35}#coreEvidenceBindingV675 .cev-arrow{font-size:18px;transition:transform .18s ease}#coreEvidenceBindingV675.open .cev-arrow{transform:rotate(180deg)}
      #coreEvidenceBindingV675 .cev-list{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:360px;overflow:auto;margin-top:8px;padding:9px;border:1px solid rgba(100,116,139,.55);border-radius:14px;background:#0c1727}#coreEvidenceBindingV675.open .cev-list{display:grid}
      #coreEvidenceBindingV675 .cev-case{min-height:132px;padding:10px;border:1px solid rgba(148,163,184,.30);border-radius:11px;background:#132238;color:#f8fbff;text-align:left;font:inherit;cursor:pointer;line-height:1.35}#coreEvidenceBindingV675 .cev-case:hover{border-color:#60a5fa;background:#19304a}#coreEvidenceBindingV675 .cev-case.selected{border-color:#34d399;background:rgba(6,78,59,.48);box-shadow:inset 0 0 0 1px rgba(52,211,153,.28)}
      #coreEvidenceBindingV675 .cev-num{display:inline-flex;padding:2px 6px;border-radius:999px;background:rgba(96,165,250,.18);color:#bfdbfe;font-size:11px;font-weight:800}#coreEvidenceBindingV675 .cev-context{display:block;margin-top:5px;color:#fff;font-weight:800}#coreEvidenceBindingV675 .cev-cardmeta{display:block;margin-top:3px;color:#b9d9f4;font-size:11px;font-weight:650}#coreEvidenceBindingV675 .cev-prompt{display:block;margin-top:6px;color:#dbeafe;font-size:12px;line-height:1.42;font-weight:600}#coreEvidenceBindingV675 .cev-prompt b{color:#7dd3fc}#coreEvidenceBindingV675 .cev-action{display:inline-flex;margin-top:8px;padding:3px 7px;border:1px solid rgba(96,165,250,.38);border-radius:999px;color:#bfdbfe;background:rgba(30,64,175,.18);font-size:11px;font-weight:850}#coreEvidenceBindingV675 .cev-case.selected .cev-action{border-color:rgba(52,211,153,.7);color:#bbf7d0;background:rgba(6,78,59,.55)}
      #coreEvidenceBindingV675 .cev-info{margin-top:9px;color:#dbeafe}#coreEvidenceBindingV675 .cev-brief{margin-top:9px;color:#e0f2fe;line-height:1.55}#coreEvidenceBindingV675 .cev-brief:not(:empty){padding:10px 11px;border:1px solid rgba(125,211,252,.48);border-radius:12px;background:rgba(14,116,144,.12)}#coreEvidenceBindingV675 .cev-brief b{color:#bae6fd}#coreEvidenceBindingV675 .cev-brief small{display:block;margin-top:6px;color:#bfdbfe;font-size:12px}#coreEvidenceBindingV675 .cev-status{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(15,23,42,.42)}
      @media(max-width:700px){#coreEvidenceBindingV675 .cev-list{grid-template-columns:1fr;max-height:310px}}
    `;document.head.appendChild(node);
  }
  function boot(){style();document.addEventListener('click',guardSave,true);document.addEventListener('change',event=>{if(event.target?.id==='coreEvidenceCase')update($('coreEvidenceBindingV675'));},true);new MutationObserver(()=>setTimeout(mount,0)).observe(document.body,{childList:true,subtree:true});setInterval(()=>{mount();patchSync()},180);mount();patchSync();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
