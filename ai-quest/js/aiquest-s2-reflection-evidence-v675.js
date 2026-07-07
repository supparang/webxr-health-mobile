/* CSAI2102 AI Quest — S2 Reflection Case Evidence v6.7.5
   Always shows the 15 real cases from the completed Deck before reflections.
   Independent from optional S2 decorators so refresh recovery cannot remove the picker.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_CASE_EVIDENCE_V675__)return;
  window.__AIQUEST_S2_CASE_EVIDENCE_V675__=true;

  /* Prevent legacy optional layers from adding a duplicate picker or re-locking Start. */
  window.__AIQUEST_S2_REFLECTION_EVIDENCE_V681__=true;
  window.__AIQUEST_S2_EVIDENCE_CASE_PICKER_V687__=true;
  window.__AIQUEST_S2_EVIDENCE_DROPDOWN_V686__=true;

  const $=id=>document.getElementById(id);
  const ACTIVE='CSAI2102_ACTIVE_S2_V674';
  const KEY='CSAI2102_S2_CASE_EVIDENCE_AUDIT_V675';
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||JSON.parse(localStorage.getItem('CSAI2102_AIQUEST_PROFILE_V421')||'{}')}catch(e){return {}}};
  const userKey=()=>KEY+'_'+clean(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const selectedKey=()=>userKey()+'_selected';
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};

  function toCard(card,index){
    const context=clean(card?.context||card?.prompt||'Case '+(index+1));
    return {
      id:clean(card?.id||'s2case_'+index),
      context,
      skill:clean(card?.skill||card?.kind==='twist'?'Case Twist':card?.kind==='m'?'Agent Mechanic':'Analysis Case'),
      policy:clean(card?.answerPolicy||card?.policy||'base'),
      phase:clean(card?.phase||''),
      type:clean(card?.subtype||card?.kind||''),
      fingerprint:clean(card?.answerFingerprint||[context,card?.skill||'',card?.answerPolicy||'base'].join('|'))
    };
  }
  function auditFromDeck(deck){
    if(!deck||!Array.isArray(deck.cards)||!deck.cards.length)return null;
    return {version:'v6.7.5',deckId:clean(deck.id||'s2deck'),deckRound:Number(deck.round||0),createdAt:new Date().toISOString(),cardCount:deck.cards.length,cards:deck.cards.map(toCard)};
  }
  function saveAudit(audit){
    if(!audit)return null;
    window.AIQuestS2ReplayAuditCurrent=audit;
    write(userKey(),audit);
    return audit;
  }
  function ensureAudit(){
    const live=window.AIQuestS2ReplayAuditCurrent;
    if(live&&Array.isArray(live.cards)&&live.cards.length)return live;
    const snapshot=read(ACTIVE,null);
    const fromSnapshot=auditFromDeck(snapshot?.deck);
    if(fromSnapshot)return saveAudit(fromSnapshot);
    const stored=read(userKey(),null);
    if(stored&&Array.isArray(stored.cards)&&stored.cards.length){window.AIQuestS2ReplayAuditCurrent=stored;return stored}
    return null;
  }
  function patchDeck(){
    const api=window.AIQuestS2AgentDeckV672;
    if(!api||api.__caseEvidenceV675||typeof api.buildDeck!=='function')return false;
    api.__caseEvidenceV675=true;
    const original=api.buildDeck.bind(api);
    api.buildDeck=function(){const deck=original();saveAudit(auditFromDeck(deck));window.AIQuestS2ReflectionEvidenceCurrent=null;return deck};
    return true;
  }

  const style=document.createElement('style');
  style.id='aiquestS2CaseEvidenceStyleV675';
  style.textContent=`
    #s2EvidenceCase{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}
    #s2EvidenceBindingV675{padding:13px;border:1px solid rgba(56,189,248,.55);border-radius:15px;background:rgba(56,189,248,.08);margin-bottom:12px;line-height:1.58}
    #s2EvidenceBindingV675 .s2ev-title{font-size:16px;font-weight:900;color:#f0f9ff}
    #s2EvidenceBindingV675 .s2ev-desc{margin:5px 0 10px;color:#cfe8ff;font-size:13px}
    #s2EvidenceBindingV675 .s2ev-open{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;padding:12px 13px;border:1px solid rgba(56,189,248,.74);border-radius:13px;background:#16253a;color:#f8fbff;font:700 15px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
    #s2EvidenceBindingV675 .s2ev-open:hover{border-color:#67e8f9;background:#19304a}
    #s2EvidenceBindingV675 .s2ev-open small{display:block;margin-top:3px;color:#b9d9f4;font-weight:600;font-size:12px;line-height:1.35}
    #s2EvidenceBindingV675 .s2ev-arrow{font-size:18px;transition:transform .18s ease}
    #s2EvidenceBindingV675.open .s2ev-arrow{transform:rotate(180deg)}
    #s2EvidenceBindingV675 .s2ev-list{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:340px;overflow:auto;margin-top:8px;padding:9px;border:1px solid rgba(100,116,139,.55);border-radius:14px;background:#0c1727}
    #s2EvidenceBindingV675.open .s2ev-list{display:grid}
    #s2EvidenceBindingV675 .s2ev-case{min-height:76px;padding:10px;border:1px solid rgba(148,163,184,.30);border-radius:11px;background:#132238;color:#f8fbff;text-align:left;font:inherit;cursor:pointer;line-height:1.35}
    #s2EvidenceBindingV675 .s2ev-case:hover{border-color:#60a5fa;background:#19304a}
    #s2EvidenceBindingV675 .s2ev-case.selected{border-color:#34d399;background:rgba(6,78,59,.48);box-shadow:inset 0 0 0 1px rgba(52,211,153,.28)}
    #s2EvidenceBindingV675 .s2ev-num{display:inline-flex;padding:2px 6px;border-radius:999px;background:rgba(96,165,250,.18);color:#bfdbfe;font-size:11px;font-weight:800}
    #s2EvidenceBindingV675 .s2ev-context{display:block;margin-top:5px;color:#fff;font-weight:800}
    #s2EvidenceBindingV675 .s2ev-meta{display:block;margin-top:3px;color:#b9d9f4;font-size:11px;font-weight:650}
    #s2EvidenceInfoV675{margin-top:9px;color:#dbeafe}#s2EvidenceCheckV675{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(15,23,42,.42)}
    @media(max-width:700px){#s2EvidenceBindingV675 .s2ev-list{grid-template-columns:1fr;max-height:310px}}
  `;
  document.head.appendChild(style);

  function cardFor(select){const audit=ensureAudit();return audit?.cards?.find(card=>String(card.id)===String(select?.value||''))||null}
  function buildEvidence(card){
    const audit=ensureAudit();
    if(!card)return null;
    return {version:'v6.7.5',deckId:clean(audit?.deckId),deckRound:Number(audit?.deckRound||0),selectedCaseId:clean(card.id),selectedCaseContext:clean(card.context),selectedCaseSkill:clean(card.skill),selectedCasePolicy:clean(card.policy||'base'),selectedCaseFingerprint:clean(card.fingerprint),checkedAt:new Date().toISOString(),integrity:{ok:true,errorCount:0,checks:{selectedFromCompletedDeck:true}}};
  }
  function update(panel){
    const select=$('s2EvidenceCase');if(!select||!panel)return;
    const card=cardFor(select),open=panel.querySelector('.s2ev-open'),title=panel.querySelector('.s2ev-selected-title'),meta=panel.querySelector('.s2ev-selected-meta'),info=panel.querySelector('#s2EvidenceInfoV675'),check=panel.querySelector('#s2EvidenceCheckV675');
    panel.querySelectorAll('.s2ev-case').forEach(button=>{const chosen=String(button.dataset.value)===String(select.value||'');button.classList.toggle('selected',chosen);button.setAttribute('aria-pressed',chosen?'true':'false')});
    if(!card){title.textContent='เลือก Case ที่ใช้เป็นหลักฐาน';meta.textContent='เลือก 1 Case จาก 15 Case ใน Deck นี้';info.innerHTML='เลือก <b>1 Case ที่เล่นจริงจาก Deck นี้</b> แล้วใช้ Case เดียวกันตอบ Reflection ทั้ง 3 ข้อ';check.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case</span>';window.AIQuestS2ReflectionEvidenceCurrent=null;return}
    title.textContent=card.context;meta.textContent='ทักษะ: '+card.skill+' • policy: '+card.policy;info.innerHTML='<b>Case ที่เลือก:</b> '+esc(card.context)+'<br><span style="color:#9fb2cc">ทักษะ: '+esc(card.skill)+' • policy: '+esc(card.policy)+'</span>';check.innerHTML='<b>Evidence Check</b><br><span style="color:#bbf7d0">✓ Case นี้ถูกผูกกับ Reflection และผลที่จะส่งให้ครู</span>';window.AIQuestS2ReflectionEvidenceCurrent=buildEvidence(card);write(selectedKey(),{deckId:ensureAudit()?.deckId,value:select.value});
  }
  function mount(){
    patchDeck();
    const audit=ensureAudit(),host=document.querySelector('#result .reflection');
    if(!audit||!Array.isArray(audit.cards)||!audit.cards.length||!host)return;
    let panel=$('s2EvidenceBindingV675');
    if(panel&&panel.dataset.deckId===String(audit.deckId)){update(panel);return}
    panel?.remove();$('s2EvidenceBindingV681')?.remove();$('s2EvidencePickerV687')?.remove();
    const selected=read(selectedKey(),null),prior=selected&&selected.deckId===audit.deckId?String(selected.value||''):'';
    const select=document.createElement('select');select.id='s2EvidenceCase';select.setAttribute('aria-hidden','true');select.innerHTML='<option value="">— เลือก Case ที่ใช้เป็นหลักฐาน —</option>'+audit.cards.map((card,index)=>'<option value="'+esc(card.id)+'">Case '+(index+1)+' • '+esc(card.context)+' — '+esc(card.skill)+' ('+esc(card.policy)+')</option>').join('');select.value=prior;
    panel=document.createElement('section');panel.id='s2EvidenceBindingV675';panel.dataset.deckId=String(audit.deckId||'');
    panel.innerHTML='<div class="s2ev-title">🔗 Reflection Evidence • เลือก Case จาก Deck นี้</div><div class="s2ev-desc">ต้องเลือก 1 Case ที่ผู้เรียนเล่นจริง ระบบจะส่ง Context, Skill และ Policy ของ Case นี้พร้อม Reflection ให้ครูตรวจ</div><button type="button" class="s2ev-open" aria-expanded="false"><span><b class="s2ev-selected-title">เลือก Case ที่ใช้เป็นหลักฐาน</b><small class="s2ev-selected-meta">เลือก 1 Case จาก 15 Case ใน Deck นี้</small></span><span class="s2ev-arrow">⌄</span></button><div class="s2ev-list">'+audit.cards.map((card,index)=>'<button type="button" class="s2ev-case" data-value="'+esc(card.id)+'" aria-pressed="false"><span class="s2ev-num">Case '+(index+1)+'</span><span class="s2ev-context">'+esc(card.context)+'</span><span class="s2ev-meta">'+esc(card.phase||'Deck')+' • '+esc(card.skill)+' • '+esc(card.policy)+'</span></button>').join('')+'</div><div id="s2EvidenceInfoV675"></div><div id="s2EvidenceCheckV675"></div>';
    host.insertBefore(panel,host.firstChild);panel.insertBefore(select,panel.firstChild);
    const opener=panel.querySelector('.s2ev-open');
    opener.onclick=()=>{const active=!panel.classList.contains('open');panel.classList.toggle('open',active);opener.setAttribute('aria-expanded',active?'true':'false')};
    panel.querySelectorAll('.s2ev-case').forEach(button=>button.onclick=()=>{select.value=button.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));panel.classList.remove('open');opener.setAttribute('aria-expanded','false');update(panel)});
    select.addEventListener('change',()=>update(panel));update(panel);
  }
  function blockSave(event){
    const target=event.target?.closest?.('#save');if(!target)return;
    const select=$('s2EvidenceCase');
    if(select&&select.value)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const note=$('saveNote');if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้</b><br>กรุณาเลือก 1 Case จากรายการก่อนเขียนและส่ง Reflection'}
    $('s2EvidenceBindingV675')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function patchSync(){
    const sync=window.AIQuestSync;
    if(!sync||sync.__caseEvidenceV675||typeof sync.submitAttempt!=='function')return false;
    sync.__caseEvidenceV675=true;
    const original=sync.submitAttempt.bind(sync);
    sync.submitAttempt=function(payload){
      if(String(payload?.sessionId||payload?.missionId||'').toLowerCase()==='s2'){
        const audit=ensureAudit(),bound=window.AIQuestS2ReflectionEvidenceCurrent;
        payload.extraJson=Object.assign({},payload.extraJson||{},{replayAuditCaptured:!!audit,replayAuditVersion:'v6.7.5',replayAudit:audit||null,reflectionEvidenceCaptured:!!bound,reflectionEvidenceBound:!!bound,reflectionEvidence:bound,selectedCaseId:bound?.selectedCaseId||'',selectedCaseContext:bound?.selectedCaseContext||'',selectedCaseSkill:bound?.selectedCaseSkill||'',selectedCasePolicy:bound?.selectedCasePolicy||''});
      }
      return original(payload);
    };
    return true;
  }
  document.addEventListener('click',blockSave,true);
  const timer=setInterval(()=>{patchDeck();patchSync();mount()},180);
  patchDeck();patchSync();mount();
  window.AIQuestS2CaseEvidenceReady=Promise.resolve(true);
})();
