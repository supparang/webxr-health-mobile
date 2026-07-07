/* CSAI2102 AI Quest — Core Reflection Semantic Evidence v6.7.6
   Strengthens core-session reflection validation. A response must address the selected
   Case's specific concept, not merely repeat the context name or use generic AI language.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_REFLECTION_SEMANTIC_EVIDENCE_V676__)return;
  window.__AIQUEST_CORE_REFLECTION_SEMANTIC_EVIDENCE_V676__=true;

  const $=id=>document.getElementById(id);
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const normal=value=>clean(value).toLowerCase().replace(/[\s\n\r\t.,!?…:;()\[\]{}"'`~\-_\/\\|]+/g,'');
  const count=value=>String(value||'').replace(/\s/g,'').length;
  const has=(text,term)=>{const source=String(text||'').toLowerCase(),needle=String(term||'').toLowerCase(),compact=normal(text),target=normal(term);return !!needle&&(source.includes(needle)||(target.length>=3&&compact.includes(target)));};
  const any=(text,terms)=>(terms||[]).some(term=>has(text,term));
  const safeTerms=['รับผิดชอบ','ปลอดภัย','ความปลอดภัย','ความเสี่ยง','ผลกระทบ','ข้อจำกัด','ตรวจสอบ','ความเป็นธรรม','ไม่แน่ใจ','โปร่งใส'];
  const humanTerms=['มนุษย์','ผู้เชี่ยวชาญ','เจ้าหน้าที่','ครู','อาจารย์','ผู้ดูแล','ผู้รับผิดชอบ','ผู้ตรวจ'];
  const reviewTerms=['ตรวจ','ทบทวน','ยืนยัน','หยุด','ส่งต่อ','แก้ไข','กำกับ','อนุมัติ','override'];

  function deck(){return read(ACTIVE,null)?.deck||null}
  function selected(){
    const id=String($('coreEvidenceCase')?.value||'');
    return (deck()?.cards||[]).find(card=>String(card?.id||'')===id)||null;
  }
  function contextTerms(card){
    const context=clean(card?.context||'');
    const pieces=context.split(/\s+/).filter(Boolean);
    return [...new Set([context,context.replace(/^(สถานการณ์:|คณะทำงานของ|ก่อนนำระบบของ|จากรายงานของ)/,'').trim(),pieces.slice(0,2).join(' '),pieces.slice(-2).join(' ')])].filter(term=>normal(term).length>=4);
  }
  function concept(card){
    const answer=clean(card?.correct||''),prompt=clean(card?.prompt||'');
    const source=(answer+' '+prompt).toLowerCase();
    if(source.includes('ปัญญาประดิษฐ์')||/(^|[^a-z])ai([^a-z]|$)/.test(source)){
      return {label:'AI เรียนรู้รูปแบบจากข้อมูล',cue:'อธิบายว่าระบบใช้การเรียนรู้จากข้อมูลหรือแบบแผนเพื่อทำนาย/ตัดสินใจ ไม่ใช่เพียงทำตามกฎตายตัว',terms:['ปัญญาประดิษฐ์','ai','เรียนรู้','โมเดล','ทำนาย','รูปแบบจากข้อมูล','ข้อมูลฝึก','ข้อมูลตัวอย่าง']};
    }
    if(source.includes('ระบบอัตโนมัติ')||source.includes('ตั้งเวลา')||source.includes('กฎคงที่')){
      return {label:'Automation ตามกฎที่ตั้งไว้',cue:'อธิบายว่าระบบทำงานตามกฎหรือเวลาที่ตั้งไว้ล่วงหน้า และยังไม่ได้เรียนรู้จากข้อมูล',terms:['ระบบอัตโนมัติ','ตั้งเวลา','กฎ','กฎคงที่','ตั้งไว้ล่วงหน้า','ไม่เรียนรู้']};
    }
    if(source.includes('มนุษย์')||source.includes('ตรวจทาน')||source.includes('เจ้าหน้าที่')){
      return {label:'Human review เมื่อผลกระทบสำคัญ',cue:'อธิบายจุดที่ระบบต้องส่งต่อให้มนุษย์ตรวจทานก่อนตัดสินใจที่กระทบผู้ใช้',terms:['มนุษย์','ตรวจทาน','เจ้าหน้าที่','ส่งต่อ','กำกับ','ผลกระทบ']};
    }
    if(source.includes('ไม่แน่ใจ')||source.includes('ข้อจำกัด')||source.includes('ความมั่นใจ')){
      return {label:'ข้อจำกัดและความไม่แน่นอนของระบบ',cue:'อธิบายความเสี่ยงเมื่อข้อมูลไม่ครบหรือไม่คุ้นเคย และแนวทางตรวจสอบ/ส่งต่อที่เหมาะสม',terms:['ข้อจำกัด','ไม่แน่ใจ','ความไม่แน่นอน','ความมั่นใจ','ข้อมูลไม่ครบ','ตรวจสอบ','ส่งต่อ']};
    }
    if(source.includes('ค้นหา')||source.includes('เส้นทาง')||source.includes('สถานะ')){
      return {label:'การกำหนดสถานะ เป้าหมาย และเงื่อนไขการค้นหา',cue:'อธิบายหลักการที่ใช้กำหนดเป้าหมาย สถานะ หรือทางเลือกของ Case นี้ให้ตรงกับโจทย์',terms:['ค้นหา','เป้าหมาย','สถานะ','เส้นทาง','เงื่อนไข','การกระทำ']};
    }
    if(source.includes('audit')||source.includes('บันทึก')||source.includes('หลักฐาน')){
      return {label:'การเก็บหลักฐานเพื่อการตรวจสอบย้อนหลัง',cue:'อธิบายว่าต้องบันทึกข้อมูล กฎ การตัดสินใจ หรือเวลาอย่างไรให้ตรวจสอบย้อนหลังได้',terms:['audit','บันทึก','หลักฐาน','ตรวจสอบย้อนหลัง','กฎ','การตัดสินใจ']};
    }
    return {label:answer||'หลักการของ Case ที่เลือก',cue:'อธิบายหลักการเฉพาะของ Case นี้ โดยเชื่อมเหตุผลกับโจทย์ ไม่ใช้คำตอบทั่วไป',terms:[answer].filter(term=>normal(term).length>=2)};
  }
  function evaluation(){
    const card=selected(),r1=$('r1')?.value||'',r2=$('r2')?.value||'',r3=$('r3')?.value||'',errors=[];
    if(!card)errors.push('เลือก 1 Case ที่เล่นจริงจาก Deck นี้ก่อนส่งผล');
    [r1,r2,r3].forEach((text,index)=>{if(count(text)<45)errors.push('ข้อ '+(index+1)+' ต้องมีอย่างน้อย 45 ตัวอักษร')});
    const c=card?concept(card):null,ctx=card?contextTerms(card):[];
    if(card){
      if(!any(r1,ctx))errors.push('ข้อ 1 ต้องระบุบริบทของ Case ที่เลือก: '+clean(card.context));
      if(!any(r1,c.terms))errors.push('ข้อ 1 ต้องอธิบายแนวคิดเฉพาะของ Case: '+c.label);
      if(!any(r2,ctx))errors.push('ข้อ 2 ต้องอธิบายการใช้ AI อย่างรับผิดชอบกับ Case ที่เลือก');
      if(!any(r2,safeTerms))errors.push('ข้อ 2 ต้องกล่าวถึงความปลอดภัย ความเสี่ยง ผลกระทบ ข้อจำกัด หรือความโปร่งใส');
      if(!any(r2,c.terms))errors.push('ข้อ 2 ต้องเชื่อมเหตุผลกับแนวคิดของ Case: '+c.label);
      if(!any(r3,humanTerms)||!any(r3,reviewTerms))errors.push('ข้อ 3 ต้องระบุผู้ตรวจทานและสิ่งที่ต้องตรวจ/ทบทวน');
      if(!(any(r3,ctx)||any(r3,c.terms)))errors.push('ข้อ 3 ต้องเชื่อมการตรวจทานกับบริบทหรือแนวคิดของ Case ที่เลือก');
    }
    return {ok:errors.length===0,errors,card,concept:c,counts:[count(r1),count(r2),count(r3)]};
  }
  function persist(state){
    const previous=window.AIQuestCoreReflectionEvidenceCurrent||{},card=state.card;
    if(!card)return;
    window.AIQuestCoreReflectionEvidenceCurrent=Object.assign({},previous,{version:'v6.7.6',selectedCaseId:String(card.id||''),selectedCaseContext:clean(card.context),selectedCasePhase:clean(card.phase),selectedCaseFocus:card.kind==='twist'?'Case Twist':card.kind==='m'?'กลไกภารกิจ':'ความรู้เชิงวิเคราะห์',checkedAt:new Date().toISOString(),integrity:{ok:state.ok,errorCount:state.errors.length,checks:{contextR1:any($('r1')?.value||'',contextTerms(card)),conceptR1:any($('r1')?.value||'',state.concept?.terms||[]),contextR2:any($('r2')?.value||'',contextTerms(card)),conceptR2:any($('r2')?.value||'',state.concept?.terms||[]),humanReviewR3:any($('r3')?.value||'',humanTerms)&&any($('r3')?.value||'',reviewTerms)}}});
  }
  function render(){
    const state=evaluation();persist(state);
    const panel=$('coreEvidenceBindingV675');if(!panel)return state;
    const status=panel.querySelector('.cev-status');if(!status)return state;
    let cue=panel.querySelector('.core-semantic-cue-v676');
    if(!cue){cue=document.createElement('div');cue.className='core-semantic-cue-v676';status.parentNode.insertBefore(cue,status);}
    if(!state.card){cue.innerHTML='';status.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case</span>';return state;}
    cue.innerHTML='<b>Reflection cue สำหรับ Case นี้</b><br><span>'+esc(state.concept.cue)+'</span>';
    status.innerHTML='<b>Evidence Check</b><br><span style="color:'+(state.ok?'#bbf7d0':'#fde68a')+'">'+(state.ok?'✓ Reflection เชื่อมทั้งบริบทและแนวคิดของ Case ที่เลือก':'ต้องปรับ Reflection ให้ตอบ “โจทย์และแนวคิดของ Case นี้” ให้ชัดก่อนส่งผล')+'</span>'+(!state.ok?'<ul style="margin:6px 0 0;padding-left:18px">'+state.errors.slice(0,4).map(error=>'<li>'+esc(error)+'</li>').join('')+'</ul>':'');
    return state;
  }
  function block(event){
    const button=event.target?.closest?.('#save');if(!button)return;
    const state=render();if(state.ok)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const note=$('saveNote');if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้: Reflection ต้องตอบตรงกับ Case ที่เลือก</b><ul style="margin:7px 0 0;padding-left:20px">'+state.errors.slice(0,5).map(error=>'<li>'+esc(error)+'</li>').join('')+'</ul>';}
    if(!state.card)$('coreEvidenceBindingV675')?.scrollIntoView({behavior:'smooth',block:'center'});else $('r1')?.focus();
  }
  function style(){
    if($('aiquestCoreReflectionSemanticStyleV676'))return;
    const node=document.createElement('style');node.id='aiquestCoreReflectionSemanticStyleV676';node.textContent=`
      #coreEvidenceBindingV675 .core-semantic-cue-v676{margin-top:10px;padding:10px 11px;border:1px solid rgba(167,139,250,.48);border-radius:12px;background:rgba(88,28,135,.17);color:#f3e8ff;line-height:1.52}
      #coreEvidenceBindingV675 .core-semantic-cue-v676 b{color:#ddd6fe}
    `;document.head.appendChild(node);
  }
  style();document.addEventListener('click',block,true);
  document.addEventListener('input',event=>{if(['r1','r2','r3'].includes(event.target?.id))render();},true);
  document.addEventListener('change',event=>{if(event.target?.id==='coreEvidenceCase')render();},true);
  new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(render,130);render();
})();
