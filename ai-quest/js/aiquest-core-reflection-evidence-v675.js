/* CSAI2102 AI Quest — Core Reflection Evidence v6.7.5
   Adds the required Case selector to S1/S3–S9/Boss core results.
   The selector is derived only from the completed replay deck currently in local storage,
   so reflections can be audited against a real case rather than written generically.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_REFLECTION_EVIDENCE_V675__)return;
  window.__AIQUEST_CORE_REFLECTION_EVIDENCE_V675__=true;

  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const MID=String(params.get('mission')||'s1').toLowerCase();
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const STORE='CSAI2102_CORE_REFLECTION_EVIDENCE_V675_'+MID;
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const count=value=>String(value||'').replace(/\s/g,'').length;
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const normal=value=>clean(value).toLowerCase().replace(/[\s\n\r\t.,!?…:;()\[\]{}"'`~\-_\/\\|]+/g,'');
  const has=(text,term)=>{const source=String(text||'').toLowerCase(),needle=String(term||'').toLowerCase(),compact=normal(text),target=normal(term);return !!needle&&(source.includes(needle)||(target.length>=3&&compact.includes(target)));};
  const any=(text,terms)=>(terms||[]).some(term=>has(text,term));
  const safeTerms=['รับผิดชอบ','ปลอดภัย','ความปลอดภัย','ความเสี่ยง','ผลกระทบ','ข้อจำกัด','ตรวจสอบ','ความเป็นธรรม','ไม่แน่ใจ'];
  const humanTerms=['มนุษย์','ผู้เชี่ยวชาญ','เจ้าหน้าที่','ครู','อาจารย์','ผู้ดูแล','ผู้รับผิดชอบ','ผู้ตรวจ'];
  const reviewTerms=['ตรวจ','ทบทวน','ยืนยัน','หยุด','ส่งต่อ','แก้ไข','กำกับ','อนุมัติ','override'];

  function profile(){try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}}
  function userKey(){return STORE+'_'+clean(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_')}
  function snapshot(){return read(ACTIVE,null)}
  function focus(card){
    if(card.kind==='twist')return 'Case Twist';
    if(card.kind==='m')return 'กลไกภารกิจ';
    return 'ความรู้เชิงวิเคราะห์';
  }
  function conceptTerms(card){
    const correct=clean(card?.correct||''),prompt=clean(card?.prompt||'');
    const raw=[correct];
    const known=[
      ['ปัญญาประดิษฐ์',['ai','ปัญญาประดิษฐ์','เรียนรู้','ข้อมูล']],
      ['ระบบอัตโนมัติ',['ระบบอัตโนมัติ','กฎ','ตั้งเวลา']],
      ['การเรียนรู้ของเครื่อง',['machine learning','การเรียนรู้ของเครื่อง','เรียนรู้','โมเดล']],
      ['มนุษย์',['มนุษย์','ตรวจทาน','เจ้าหน้าที่','กำกับ']],
      ['ข้อจำกัด',['ข้อจำกัด','ความเสี่ยง','ผลกระทบ','ขอบเขต']],
      ['ค้นหา',['ค้นหา','เป้าหมาย','สถานะ','เส้นทาง']],
      ['audit',['audit','บันทึก','ตรวจสอบ','หลักฐาน']],
      ['ความไม่แน่นอน',['ความไม่แน่นอน','ไม่แน่ใจ','ความมั่นใจ','ความเสี่ยง']]
    ];
    known.forEach(([needle,terms])=>{if(correct.toLowerCase().includes(needle)||prompt.toLowerCase().includes(needle))raw.push(...terms)});
    return [...new Set(raw.filter(value=>normal(value).length>=2))].slice(0,6);
  }
  function asCard(card,index){
    return {id:clean(card?.id||'corecase_'+index),index:index+1,context:clean(card?.context||'สถานการณ์ของ Case '+(index+1)),phase:clean(card?.phase||'Replay Deck'),kind:clean(card?.kind||'q'),focus:focus(card),prompt:clean(card?.prompt||''),correct:clean(card?.correct||''),concepts:conceptTerms(card)};
  }
  function audit(){
    const saved=snapshot();
    if(!saved?.deck||!Array.isArray(saved.deck.cards)||!saved.deck.cards.length)return null;
    return {version:'v6.7.5',missionId:MID,deckId:clean(saved.deck.id||'coredeck'),deckRound:Number(saved.deck.round||0),cards:saved.deck.cards.map(asCard)};
  }
  function storedSelection(a){const value=read(userKey(),null);return value&&value.deckId===a?.deckId?String(value.caseId||''):''}
  function selected(a){const select=$('coreEvidenceCase');return a?.cards?.find(card=>String(card.id)===String(select?.value||''))||null}
  function check(){
    const a=audit(),card=selected(a),r1=$('r1')?.value||'',r2=$('r2')?.value||'',r3=$('r3')?.value||'',errors=[];
    if(!card)errors.push('เลือก 1 Case ที่เล่นจริงจาก Replay Deck นี้ก่อนส่งผล');
    [r1,r2,r3].forEach((text,index)=>{if(count(text)<45)errors.push('ข้อ '+(index+1)+' ต้องมีอย่างน้อย 45 ตัวอักษร')});
    if(card){
      const contextTerms=[card.context,card.context.replace(/^(สถานการณ์:|คณะทำงานของ|ก่อนนำระบบของ|จากรายงานของ)/,'').trim()].filter(Boolean);
      if(!any(r1,contextTerms))errors.push('ข้อ 1 ต้องระบุสถานการณ์ของ Case ที่เลือก: '+card.context);
      if(!any(r1,card.concepts))errors.push('ข้อ 1 ต้องอธิบายหลักการที่สอดคล้องกับ Case ที่เลือก');
      if(!any(r2,contextTerms))errors.push('ข้อ 2 ต้องเชื่อมการใช้ AI อย่างรับผิดชอบกับ Case ที่เลือก');
      if(!any(r2,safeTerms))errors.push('ข้อ 2 ต้องกล่าวถึงความปลอดภัย ความเสี่ยง ผลกระทบ หรือข้อจำกัด');
      if(!any(r3,humanTerms)||!any(r3,reviewTerms))errors.push('ข้อ 3 ต้องระบุผู้ตรวจทานและสิ่งที่ต้องตรวจ/ทบทวน');
      if(!(any(r3,contextTerms)||any(r3,card.concepts)))errors.push('ข้อ 3 ต้องเชื่อมการตรวจทานกับ Case หรือหลักการที่เลือก');
    }
    return {ok:errors.length===0,errors,a,card,counts:[count(r1),count(r2),count(r3)]};
  }
  function persist(result){
    const card=result.card;
    window.AIQuestCoreReflectionEvidenceCurrent=card?{version:'v6.7.5',missionId:MID,deckId:result.a.deckId,deckRound:result.a.deckRound,selectedCaseId:card.id,selectedCaseContext:card.context,selectedCasePhase:card.phase,selectedCaseFocus:card.focus,selectedCasePrompt:card.prompt,selectedCaseExpectedConcept:card.correct,checkedAt:new Date().toISOString(),integrity:{ok:result.ok,errorCount:result.errors.length}}:null;
  }
  function update(panel){
    const result=check();persist(result);
    const select=$('coreEvidenceCase');if(!select||!panel)return result;
    const card=result.card,title=panel.querySelector('.cev-title'),meta=panel.querySelector('.cev-meta'),info=panel.querySelector('.cev-info'),status=panel.querySelector('.cev-status');
    panel.querySelectorAll('.cev-case').forEach(button=>{const on=String(button.dataset.value)===String(select.value||'');button.classList.toggle('selected',on);button.setAttribute('aria-pressed',on?'true':'false')});
    if(!card){title.textContent='เลือก Case ที่ใช้เป็นหลักฐาน';meta.textContent='เลือก 1 Case จาก Deck ที่เล่นจริงในรอบนี้';info.innerHTML='เลือก <b>1 Case จาก Replay Deck นี้</b> แล้วใช้ Case เดียวกันตอบ Reflection ทั้ง 3 ข้อ';status.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case</span>';return result}
    title.textContent=card.context;meta.textContent=card.phase+' • '+card.focus;info.innerHTML='<b>Case ที่เลือก:</b> '+esc(card.context)+'<br><span style="color:#b9d9f4">'+esc(card.phase)+' • '+esc(card.focus)+'</span>';status.innerHTML='<b>Evidence Check</b><br><span style="color:'+(result.ok?'#bbf7d0':'#fde68a')+'">'+(result.ok?'✓ Reflection เชื่อมกับ Case ที่เลือกครบ':'ต้องปรับ Reflection ให้ตรงกับ Case ที่เลือกก่อนส่งผล')+'</span>'+(!result.ok?'<ul style="margin:6px 0 0;padding-left:18px">'+result.errors.slice(0,4).map(error=>'<li>'+esc(error)+'</li>').join('')+'</ul>':'');write(userKey(),{deckId:result.a.deckId,caseId:card.id});return result;
  }
  function mount(){
    const a=audit(),host=document.querySelector('#result .reflection');
    if(!a||!host)return;
    let panel=$('coreEvidenceBindingV675');
    if(panel&&panel.dataset.deckId===a.deckId){update(panel);return}
    panel?.remove();
    const select=document.createElement('select');select.id='coreEvidenceCase';select.setAttribute('aria-hidden','true');select.innerHTML='<option value="">— เลือก Case ที่ใช้เป็นหลักฐาน —</option>'+a.cards.map(card=>'<option value="'+esc(card.id)+'">Case '+card.index+' • '+esc(card.context)+' — '+esc(card.phase)+' / '+esc(card.focus)+'</option>').join('');select.value=storedSelection(a);
    panel=document.createElement('section');panel.id='coreEvidenceBindingV675';panel.dataset.deckId=a.deckId;
    panel.innerHTML='<div class="cev-heading">🔗 Reflection Evidence • เลือก Case จาก Deck นี้</div><div class="cev-desc">ต้องเลือก 1 Case ที่ผู้เรียนเล่นจริง ระบบจะส่งรายละเอียด Case นี้พร้อม Reflection ให้ครูตรวจ</div><button type="button" class="cev-open" aria-expanded="false"><span><b class="cev-title">เลือก Case ที่ใช้เป็นหลักฐาน</b><small class="cev-meta">เลือก 1 Case จาก Deck ที่เล่นจริงในรอบนี้</small></span><span class="cev-arrow">⌄</span></button><div class="cev-list">'+a.cards.map(card=>'<button type="button" class="cev-case" data-value="'+esc(card.id)+'" aria-pressed="false"><span class="cev-num">Case '+card.index+'</span><span class="cev-context">'+esc(card.context)+'</span><span class="cev-cardmeta">'+esc(card.phase)+' • '+esc(card.focus)+'</span></button>').join('')+'</div><div class="cev-info"></div><div class="cev-status"></div>';
    host.insertBefore(panel,host.firstChild);panel.insertBefore(select,panel.firstChild);
    const open=panel.querySelector('.cev-open');open.onclick=()=>{const show=!panel.classList.contains('open');panel.classList.toggle('open',show);open.setAttribute('aria-expanded',show?'true':'false')};
    panel.querySelectorAll('.cev-case').forEach(button=>button.onclick=()=>{select.value=button.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));panel.classList.remove('open');open.setAttribute('aria-expanded','false');update(panel)});
    select.addEventListener('change',()=>update(panel));update(panel);
  }
  function block(event){
    const button=event.target?.closest?.('#save');if(!button)return;
    const result=update($('coreEvidenceBindingV675'));if(result.ok)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const note=$('saveNote');if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้: ต้องเลือก Case และเขียน Reflection ให้เชื่อมกับ Case นั้น</b><ul style="margin:7px 0 0;padding-left:20px">'+result.errors.slice(0,5).map(error=>'<li>'+esc(error)+'</li>').join('')+'</ul>'}
    if(!result.card)$('coreEvidenceBindingV675')?.scrollIntoView({behavior:'smooth',block:'center'});else $('r1')?.focus();
  }
  function patchSync(){
    const sync=window.AIQuestSync;if(!sync||sync.__coreEvidenceV675||typeof sync.submitAttempt!=='function')return false;
    sync.__coreEvidenceV675=true;
    const original=sync.submitAttempt.bind(sync);
    sync.submitAttempt=function(payload){
      const mission=String(payload?.sessionId||payload?.missionId||'').toLowerCase();
      if(mission&&mission===MID&&mission!=='s2'){
        const evidence=window.AIQuestCoreReflectionEvidenceCurrent;
        payload.extraJson=Object.assign({},payload.extraJson||{},{coreReflectionEvidenceCaptured:!!evidence,coreReflectionEvidenceBound:!!(evidence?.integrity?.ok),coreReflectionEvidence:evidence,selectedCaseId:evidence?.selectedCaseId||'',selectedCaseContext:evidence?.selectedCaseContext||'',selectedCasePhase:evidence?.selectedCasePhase||'',selectedCaseFocus:evidence?.selectedCaseFocus||''});
      }
      return original(payload);
    };
    return true;
  }
  const style=document.createElement('style');style.id='aiquestCoreEvidenceStyleV675';style.textContent=`
    #coreEvidenceCase{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}
    #coreEvidenceBindingV675{padding:13px;border:1px solid rgba(56,189,248,.55);border-radius:15px;background:rgba(56,189,248,.08);margin-bottom:12px;line-height:1.58}
    #coreEvidenceBindingV675 .cev-heading{font-size:16px;font-weight:900;color:#f0f9ff}#coreEvidenceBindingV675 .cev-desc{margin:5px 0 10px;color:#cfe8ff;font-size:13px}
    #coreEvidenceBindingV675 .cev-open{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;padding:12px 13px;border:1px solid rgba(56,189,248,.74);border-radius:13px;background:#16253a;color:#f8fbff;font:700 15px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer}
    #coreEvidenceBindingV675 .cev-open small{display:block;margin-top:3px;color:#b9d9f4;font-weight:600;font-size:12px;line-height:1.35}#coreEvidenceBindingV675 .cev-arrow{font-size:18px;transition:transform .18s ease}#coreEvidenceBindingV675.open .cev-arrow{transform:rotate(180deg)}
    #coreEvidenceBindingV675 .cev-list{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:340px;overflow:auto;margin-top:8px;padding:9px;border:1px solid rgba(100,116,139,.55);border-radius:14px;background:#0c1727}#coreEvidenceBindingV675.open .cev-list{display:grid}
    #coreEvidenceBindingV675 .cev-case{min-height:76px;padding:10px;border:1px solid rgba(148,163,184,.30);border-radius:11px;background:#132238;color:#f8fbff;text-align:left;font:inherit;cursor:pointer;line-height:1.35}#coreEvidenceBindingV675 .cev-case:hover{border-color:#60a5fa;background:#19304a}#coreEvidenceBindingV675 .cev-case.selected{border-color:#34d399;background:rgba(6,78,59,.48);box-shadow:inset 0 0 0 1px rgba(52,211,153,.28)}
    #coreEvidenceBindingV675 .cev-num{display:inline-flex;padding:2px 6px;border-radius:999px;background:rgba(96,165,250,.18);color:#bfdbfe;font-size:11px;font-weight:800}#coreEvidenceBindingV675 .cev-context{display:block;margin-top:5px;color:#fff;font-weight:800}#coreEvidenceBindingV675 .cev-cardmeta{display:block;margin-top:3px;color:#b9d9f4;font-size:11px;font-weight:650}#coreEvidenceBindingV675 .cev-info{margin-top:9px;color:#dbeafe}#coreEvidenceBindingV675 .cev-status{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(15,23,42,.42)}
    @media(max-width:700px){#coreEvidenceBindingV675 .cev-list{grid-template-columns:1fr;max-height:310px}}
  `;document.head.appendChild(style);
  document.addEventListener('click',block,true);
  document.addEventListener('input',event=>{if(['r1','r2','r3'].includes(event.target?.id))update($('coreEvidenceBindingV675'));},true);
  document.addEventListener('change',event=>{if(event.target?.id==='coreEvidenceCase')update($('coreEvidenceBindingV675'));},true);
  new MutationObserver(()=>setTimeout(mount,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{patchSync();mount()},250);patchSync();mount();
})();
