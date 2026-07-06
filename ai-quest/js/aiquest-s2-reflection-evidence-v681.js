/* CSAI2102 S2 Reflection Evidence Gate v6.8.1
   Requires students to select an actual card from the completed S2 deck.
   Checks that reflections cite its context, skill/policy, safety reasoning,
   and human review; stores compact selected-case evidence for teacher audit.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_REFLECTION_EVIDENCE_V681__)return;
  window.__AIQUEST_S2_REFLECTION_EVIDENCE_V681__=true;

  const $=id=>document.getElementById(id);
  const clean=value=>String(value==null?'':value).trim();
  const normal=value=>clean(value).toLowerCase().replace(/[\s\n\r\t.,!?…:;()\[\]{}"'`~\-_\/\\|]+/g,'');
  const count=value=>String(value||'').replace(/\s/g,'').length;
  const has=(text,term)=>{const raw=String(text||'').toLowerCase(),needle=String(term||'').toLowerCase(),n=normal(text),tn=normal(term);return !!needle&&(raw.includes(needle)||(tn.length>=3&&n.includes(tn)))};
  const any=(text,terms)=>(terms||[]).some(term=>has(text,term));
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const safeTerms=['รับผิดชอบ','ปลอดภัย','ความปลอดภัย','ความเสี่ยง','ผลกระทบ','ข้อจำกัด','ความเป็นธรรม','ตรวจสอบ'];
  const humanTerms=['มนุษย์','ผู้เชี่ยวชาญ','เจ้าหน้าที่','ผู้ตรวจ','แพทย์','อาจารย์','ครู','ผู้รับผิดชอบ'];
  const reviewTerms=['ตรวจ','ทบทวน','ยืนยัน','อนุมัติ','หยุด','กำกับ','ส่งต่อ','แก้ไข','อุทธรณ์'];
  const skillTerms={
    'PEAS ครบองค์ประกอบ':['peas','performance','environment','actuator','sensor','เป้าหมาย','สภาพแวดล้อม','ตัวกระทำ','เซนเซอร์'],
    'Sensor / Actuator':['sensor','actuator','เซนเซอร์','ตัวกระทำ','ข้อมูลเข้า','สั่งการ','รับรู้'],
    'Performance measure':['performance','measure','เกณฑ์','ตัวชี้วัด','ผลสำเร็จ','ความถูกต้อง','ความปลอดภัย'],
    'Rational action':['rational','action','การตัดสินใจ','ทางเลือก','หลักฐาน','เงื่อนไข','ความเสี่ยง'],
    'Human oversight':['oversight','มนุษย์','ผู้เชี่ยวชาญ','กำกับ','ตรวจทาน','ส่งต่อ'],
    'Agent concept':['agent','ตัวแทน','percept','action','รับรู้','กระทำ'],
    'Sensor reliability':['sensor','เซนเซอร์','ข้อมูล','คุณภาพ','ขัดกัน','ตรวจสอบ'],
    'Environment':['environment','สภาพแวดล้อม','บริบท','ผู้ใช้','พื้นที่'],
    'Why PEAS':['peas','เป้าหมาย','สภาพแวดล้อม','เซนเซอร์','ตัวกระทำ'],
    'Trade-off':['trade-off','tradeoff','ความเร็ว','ความปลอดภัย','ความเสี่ยง','ข้อจำกัด'],
    'Rationality':['rational','เหตุผล','เงื่อนไข','เป้าหมาย','ความเสี่ยง'],
    'Audit trail':['audit','log','บันทึก','ตรวจสอบ','หลักฐาน'],
    'Human override':['override','มนุษย์','ผู้เชี่ยวชาญ','หยุด','ส่งต่อ'],
    'Scope boundary':['scope','ขอบเขต','ข้อจำกัด','ส่งต่อ','เกินขอบเขต'],
    'Agent test':['test','ทดสอบ','edge case','กรณีผิดปกติ','ตรวจสอบ'],
    'Case Twist: low confidence':['confidence','ไม่แน่ใจ','threshold','เกณฑ์','ความเสี่ยง'],
    'Case Twist: user rights':['สิทธิ์','ผู้ใช้','อุทธรณ์','อธิบาย','ทบทวน'],
    'Case Twist: changed context':['context','บริบท','สภาพแวดล้อม','drift','เปลี่ยนแปลง'],
    'Case Twist: conflicting goals':['ความเร็ว','ความปลอดภัย','ข้อจำกัด','trade-off']
  };
  const policyTerms={
    verify:['ตรวจสอบ','ยืนยัน','หลักฐาน','ข้อมูล','ข้ามแหล่ง'],
    reversible:['ย้อนกลับ','จำกัด','ลดผลกระทบ','หยุด','ทางเลือกปลอดภัย'],
    threshold:['threshold','เกณฑ์','ความเสี่ยง','ส่งต่อ','หยุด'],
    rights:['สิทธิ์','ผู้ใช้','อุทธรณ์','อธิบาย','ทบทวน'],
    audit:['audit','log','บันทึก','ตรวจสอบ','หลักฐาน'],
    scope:['scope','ขอบเขต','ข้อจำกัด','ส่งต่อ','เกินขอบเขต'],
    base:['หลักฐาน','เหตุผล','ตรวจสอบ','ความเสี่ยง']
  };

  function audit(){
    const raw=window.AIQuestS2ReplayAuditCurrent;
    return raw&&Array.isArray(raw.cards)&&raw.cards.length?raw:null;
  }
  function cards(auditData){
    return (auditData?.cards||[]).map((card,index)=>Object.assign({},card,{id:clean(card.id)||'s2case_'+index}));
  }
  function aliases(context){
    const source=clean(context),words=source.split(/\s+/).filter(Boolean);
    const set=new Set([source,source.replace(/^ระบบ/,'').trim(),words.slice(0,2).join(' '),words.slice(-2).join(' ')]);
    return [...set].filter(value=>normal(value).length>=4);
  }
  function mentionsContext(text,context){return aliases(context).some(alias=>has(text,alias));}
  function selectedCard(){
    const a=audit(),select=$('s2EvidenceCase');
    if(!a||!select)return null;
    return cards(a).find(card=>String(card.id)===String(select.value))||null;
  }
  function report(){
    const card=selectedCard();
    const r1=$('r1')?.value||'',r2=$('r2')?.value||'',r3=$('r3')?.value||'';
    const errors=[];
    if(!card)errors.push('เลือก Case ที่เล่นจริงจาก Deck นี้ก่อนส่งผล');
    [r1,r2,r3].forEach((text,index)=>{if(count(text)<65)errors.push('ข้อ '+(index+1)+' ต้องมีอย่างน้อย 65 ตัวอักษร')});
    if(card){
      const terms=skillTerms[card.skill]||['agent','ตัวแทน','หลักฐาน','เหตุผล','ความเสี่ยง'];
      const policy=policyTerms[String(card.policy||'base').toLowerCase()]||policyTerms.base;
      if(!mentionsContext(r1,card.context))errors.push('ข้อ 1 ต้องระบุ Context ของ Case ที่เลือก: '+card.context);
      if(!any(r1,terms))errors.push('ข้อ 1 ต้องเชื่อมหลักการ/ทักษะของ Case: '+card.skill);
      if(!mentionsContext(r2,card.context))errors.push('ข้อ 2 ต้องอธิบายความรับผิดชอบกับ Case ที่เลือก ไม่ใช่ Case อื่น');
      if(!any(r2,safeTerms))errors.push('ข้อ 2 ต้องกล่าวถึงความปลอดภัย ความเสี่ยง ผลกระทบ หรือข้อจำกัด');
      if(!any(r2,policy))errors.push('ข้อ 2 ต้องอธิบาย policy ของ Case เช่น '+policy.slice(0,3).join(' / '));
      if(!any(r3,humanTerms)||!any(r3,reviewTerms))errors.push('ข้อ 3 ต้องระบุผู้ตรวจทานและสิ่งที่ต้องตรวจ/ทบทวน');
      if(!(mentionsContext(r3,card.context)||any(r3,terms)))errors.push('ข้อ 3 ต้องเชื่อมการตรวจทานกับ Context หรือทักษะของ Case ที่เลือก');
    }
    return {ok:errors.length===0,errors,card,counts:[count(r1),count(r2),count(r3)]};
  }
  function persist(){
    const a=audit(),state=report(),card=state.card;
    window.AIQuestS2ReflectionEvidenceCurrent=card?{
      version:'v6.8.1',deckId:clean(a?.deckId),deckRound:Number(a?.deckRound||0),selectedCaseId:clean(card.id),selectedCaseContext:clean(card.context),selectedCaseSkill:clean(card.skill),selectedCasePolicy:clean(card.policy||'base'),selectedCaseFingerprint:clean(card.fingerprint),checkedAt:new Date().toISOString(),integrity:{ok:state.ok,errorCount:state.errors.length,checks:{contextR1:mentionsContext($('r1')?.value||'',card.context),contextR2:mentionsContext($('r2')?.value||'',card.context),skillR1:any($('r1')?.value||'',skillTerms[card.skill]||[]),policyR2:any($('r2')?.value||'',policyTerms[String(card.policy||'base').toLowerCase()]||policyTerms.base),humanReviewR3:any($('r3')?.value||'',humanTerms)&&any($('r3')?.value||'',reviewTerms)}}
    }:null;
    return state;
  }
  function update(){
    const state=persist(),info=$('s2EvidenceInfo'),check=$('s2EvidenceCheck');
    if(!info||!check)return;
    if(!state.card){
      info.innerHTML='เลือก <b>1 Case ที่ปรากฏใน Deck นี้จริง</b> แล้วใช้ Case เดียวกันตอบ Reflection ทั้ง 3 ข้อ';
      check.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case</span>';return;
    }
    const card=state.card;
    info.innerHTML='<b>Case ที่เลือก:</b> '+esc(card.context)+'<br><span style="color:#9fb2cc">ทักษะ: '+esc(card.skill)+' • policy: '+esc(card.policy||'base')+'</span>';
    const errors=state.errors.slice(0,4).map(error=>'<li>'+esc(error)+'</li>').join('');
    check.innerHTML='<b>Evidence Check</b><br><span style="color:'+(state.ok?'#bbf7d0':'#fde68a')+'">'+(state.ok?'✓ Reflection ผูกกับ Case นี้ครบ พร้อมส่งผล':'ต้องแก้อีกเล็กน้อยก่อนส่งผล')+'</span>'+(!state.ok?'<ul style="margin:6px 0 0;padding-left:18px">'+errors+'</ul>':'');
  }
  function mount(){
    const a=audit(),host=document.querySelector('#result .reflection');
    if(!a||!host)return;
    const old=$('s2EvidenceBindingV681');
    if(old&&old.dataset.deckId===String(a.deckId)){update();return;}
    old?.remove();
    const options=cards(a).map((card,index)=>'<option value="'+esc(card.id)+'">Case '+(index+1)+' • '+esc(card.context)+' — '+esc(card.skill)+' ('+esc(card.policy||'base')+')</option>').join('');
    const panel=document.createElement('div');
    panel.id='s2EvidenceBindingV681';panel.dataset.deckId=String(a.deckId||'');
    panel.style.cssText='padding:13px;border:1px solid rgba(56,189,248,.45);border-radius:15px;background:rgba(56,189,248,.08);margin-bottom:12px;line-height:1.58';
    panel.innerHTML='<b style="font-size:16px">🔗 Reflection Evidence • Case จาก Deck นี้</b><p style="margin:5px 0;color:#cfe8ff">เลือก Case ที่เล่นจริง 1 Case ระบบจะส่ง Context / Skill / Policy นี้ให้ครูตรวจพร้อม Reflection</p><select id="s2EvidenceCase" class="input"><option value="">— เลือก Case ที่ใช้เป็นหลักฐาน —</option>'+options+'</select><div id="s2EvidenceInfo" style="margin-top:9px;color:#dbeafe"></div><div id="s2EvidenceCheck" style="margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(15,23,42,.42)"></div>';
    host.insertBefore(panel,host.firstChild);
    $('s2EvidenceCase').addEventListener('change',update);
    ['r1','r2','r3'].forEach(id=>$(id)?.addEventListener('input',update));
    update();
  }
  function note(html){const node=$('saveNote');if(node){node.className='notice bad';node.innerHTML=html}}
  function block(event){
    const target=event.target;
    if(!target||target.id!=='save')return;
    const state=persist();
    if(state.ok)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const list=state.errors.slice(0,5).map(error=>'<li>'+esc(error)+'</li>').join('');
    note('<b>ยังส่งผลไม่ได้: Reflection ต้องผูกกับ Case ที่เลือกใน Deck นี้</b><ul style="margin:7px 0 0;padding-left:20px">'+list+'</ul>');
    if(!state.card)$('s2EvidenceCase')?.focus();else $('r1')?.focus();
  }
  function boot(){
    document.addEventListener('click',block,true);
    new MutationObserver(()=>setTimeout(mount,0)).observe(document.body,{childList:true,subtree:true});
    setInterval(mount,350);mount();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();