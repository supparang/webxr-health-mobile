/* CSAI2102 S2 Evidence Picker v6.9.9 — event-driven, no polling */
(()=>{'use strict';
  if(window.__AQ_S2_EVIDENCE_V699__)return;
  window.__AQ_S2_EVIDENCE_V699__=true;
  const $=id=>document.getElementById(id),ACTIVE='CSAI2102_ACTIVE_S2_V674',KEY='CSAI2102_S2_EVIDENCE_V699';
  const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||{}}catch(e){return {}}};
  const userKey=()=>KEY+'_'+String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const selectedKey=()=>userKey()+'_selected';
  const cardOf=(card,index)=>({id:clean(card?.id||'s2case_'+index),context:clean(card?.context||card?.prompt||'Case '+(index+1)),skill:clean(card?.skill||'Analysis Case'),policy:clean(card?.answerPolicy||'base'),phase:clean(card?.phase||''),fingerprint:clean(card?.answerFingerprint||card?.source||card?.id||index)});
  function auditFrom(deck){return deck&&Array.isArray(deck.cards)&&deck.cards.length?{version:'v6.9.9',deckId:clean(deck.id||'s2deck'),deckRound:Number(deck.round||0),cards:deck.cards.map(cardOf)}:null;}
  function audit(){
    const live=window.AIQuestS2ReplayAuditCurrent;
    if(live?.cards?.length)return live;
    const fromActive=auditFrom(read(ACTIVE,null)?.deck);
    if(fromActive){window.AIQuestS2ReplayAuditCurrent=fromActive;write(userKey(),fromActive);return fromActive;}
    const stored=read(userKey(),null);if(stored?.cards?.length){window.AIQuestS2ReplayAuditCurrent=stored;return stored;}return null;
  }
  function patchDeck(){
    const api=window.AIQuestS2AgentDeckV672;
    if(!api||api.__aqEvidenceV699||typeof api.buildDeck!=='function')return;
    api.__aqEvidenceV699=true;const old=api.buildDeck.bind(api);
    api.buildDeck=function(){const deck=old();const a=auditFrom(deck);if(a){window.AIQuestS2ReplayAuditCurrent=a;write(userKey(),a);}window.AIQuestS2ReflectionEvidenceCurrent=null;return deck;};
  }
  function selected(){const a=audit(),value=$('s2EvidenceCaseV699')?.value||'';return a?.cards?.find(card=>String(card.id)===String(value))||null;}
  function bind(card){if(!card){window.AIQuestS2ReflectionEvidenceCurrent=null;return null;}const a=audit();const out={version:'v6.9.9',deckId:a?.deckId||'',deckRound:Number(a?.deckRound||0),selectedCaseId:card.id,selectedCaseContext:card.context,selectedCaseSkill:card.skill,selectedCasePolicy:card.policy,selectedCaseFingerprint:card.fingerprint,integrity:{ok:true,errorCount:0,checks:{selectedFromCompletedDeck:true}}};window.AIQuestS2ReflectionEvidenceCurrent=out;return out;}
  function update(panel){
    const card=selected(),title=panel.querySelector('[data-title]'),meta=panel.querySelector('[data-meta]'),check=panel.querySelector('[data-check]');
    panel.querySelectorAll('[data-case]').forEach(btn=>btn.classList.toggle('selected',String(btn.dataset.case)===String(card?.id||'')));
    if(!card){title.textContent='เลือก Case ที่ใช้เป็นหลักฐาน';meta.textContent='เลือก 1 Case จาก 15 Case ใน Deck นี้';check.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case</span>';bind(null);return;}
    title.textContent=card.context;meta.textContent='ทักษะ: '+card.skill+' • policy: '+card.policy;check.innerHTML='<b>Evidence Check</b><br><span style="color:#bbf7d0">✓ เลือก Case แล้ว — เขียน Reflection ให้เชื่อมกับ Case นี้</span>';bind(card);write(selectedKey(),{deckId:audit()?.deckId||'',value:card.id});document.dispatchEvent(new CustomEvent('aiquest:s2-evidence-change'));
  }
  function mount(){
    patchDeck();const a=audit(),host=document.querySelector('#result .reflection');if(!a||!host)return;
    let panel=$('s2EvidenceBindingV699');if(panel&&panel.dataset.deckId===String(a.deckId)){update(panel);return;}
    panel?.remove();
    const prior=read(selectedKey(),null),value=prior?.deckId===a.deckId?String(prior.value||''):'';
    panel=document.createElement('section');panel.id='s2EvidenceBindingV699';panel.dataset.deckId=String(a.deckId||'');panel.style.cssText='padding:13px;border:1px solid rgba(56,189,248,.55);border-radius:15px;background:rgba(56,189,248,.08);margin-bottom:12px;line-height:1.58';
    const options='<option value="">— เลือก Case ที่ใช้เป็นหลักฐาน —</option>'+a.cards.map((card,i)=>'<option value="'+esc(card.id)+'">Case '+(i+1)+' • '+esc(card.context)+' — '+esc(card.skill)+'</option>').join('');
    const cards=a.cards.map((card,i)=>'<button type="button" data-case="'+esc(card.id)+'" style="min-height:74px;padding:9px;border:1px solid rgba(148,163,184,.32);border-radius:11px;background:#132238;color:#f8fbff;text-align:left;font:inherit;cursor:pointer"><b>Case '+(i+1)+'</b><br><span style="font-weight:800">'+esc(card.context)+'</span><br><small style="color:#b9d9f4">'+esc(card.phase)+' • '+esc(card.skill)+' • '+esc(card.policy)+'</small></button>').join('');
    panel.innerHTML='<b style="font-size:16px">🔗 Reflection Evidence • เลือก Case จาก Deck นี้</b><p style="margin:5px 0 10px;color:#cfe8ff;font-size:13px">เลือก 1 Case ที่เล่นจริง แล้วใช้ Case เดียวกันตอบ Reflection ทั้ง 3 ข้อ</p><select id="s2EvidenceCaseV699" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none">'+options+'</select><button type="button" data-open style="width:100%;padding:12px 13px;border:1px solid rgba(56,189,248,.74);border-radius:13px;background:#16253a;color:#f8fbff;text-align:left;font:700 15px system-ui;cursor:pointer"><span data-title>เลือก Case ที่ใช้เป็นหลักฐาน</span><small data-meta style="display:block;margin-top:3px;color:#b9d9f4">เลือก 1 Case จาก 15 Case ใน Deck นี้</small></button><div data-list style="display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:340px;overflow:auto;margin-top:8px;padding:9px;border:1px solid rgba(100,116,139,.55);border-radius:14px;background:#0c1727">'+cards+'</div><div data-check style="margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(15,23,42,.42)"></div>';
    host.insertBefore(panel,host.firstChild);const select=$('s2EvidenceCaseV699');select.value=value;
    const open=panel.querySelector('[data-open]'),list=panel.querySelector('[data-list]');open.onclick=()=>{const show=list.style.display!=='grid';list.style.display=show?'grid':'none';};
    panel.querySelectorAll('[data-case]').forEach(btn=>btn.onclick=()=>{select.value=btn.dataset.case;list.style.display='none';update(panel);});update(panel);document.dispatchEvent(new CustomEvent('aiquest:s2-evidence-mounted'));
  }
  function block(event){const save=event.target?.closest?.('#save');if(!save)return;if(selected())return;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();const note=$('saveNote');if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้</b><br>กรุณาเลือก 1 Case จากรายการก่อนส่ง Reflection';}$('s2EvidenceBindingV699')?.scrollIntoView({behavior:'smooth',block:'center'});}
  function patchSync(){const sync=window.AIQuestSync;if(!sync||sync.__aqEvidenceV699||typeof sync.submitAttempt!=='function')return;sync.__aqEvidenceV699=true;const old=sync.submitAttempt.bind(sync);sync.submitAttempt=function(payload){if(String(payload?.sessionId||payload?.missionId||'').toLowerCase()==='s2'){const a=audit(),b=window.AIQuestS2ReflectionEvidenceCurrent;payload.extraJson=Object.assign({},payload.extraJson||{},{replayAuditCaptured:!!a,replayAuditVersion:'v6.9.9',replayAudit:a||null,reflectionEvidenceCaptured:!!b,reflectionEvidenceBound:!!b,reflectionEvidence:b||null,selectedCaseId:b?.selectedCaseId||'',selectedCaseContext:b?.selectedCaseContext||'',selectedCaseSkill:b?.selectedCaseSkill||'',selectedCasePolicy:b?.selectedCasePolicy||''});}return old(payload);};}
  document.addEventListener('click',block,true);
  document.addEventListener('DOMContentLoaded',()=>{patchDeck();patchSync();const result=$('result');if(result){new MutationObserver(()=>{if(result.classList.contains('on'))mount();}).observe(result,{attributes:true,attributeFilter:['class']});}setTimeout(mount,50);});
  patchDeck();patchSync();window.AIQuestS2CaseEvidenceReady=Promise.resolve(true);
})();