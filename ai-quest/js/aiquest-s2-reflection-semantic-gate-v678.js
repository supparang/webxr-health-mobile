/* CSAI2102 AI Quest — S2 Reflection Semantic Evidence Gate v6.7.8
   A selected Case is not sufficient: all three reflections must substantively connect
   to that Case's context, skill and policy before submission.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_REFLECTION_SEMANTIC_GATE_V678__)return;
  window.__AIQUEST_S2_REFLECTION_SEMANTIC_GATE_V678__=true;
  const $=id=>document.getElementById(id);
  const clean=value=>String(value==null?'':value).trim();
  const normal=value=>clean(value).toLowerCase().replace(/[\s\n\r\t.,!?…:;()\[\]{}"'`~\-_\/\\|]+/g,'');
  const count=value=>String(value||'').replace(/\s/g,'').length;
  const has=(text,term)=>{const raw=String(text||'').toLowerCase(),needle=String(term||'').toLowerCase(),compact=normal(text),target=normal(term);return !!needle&&(raw.includes(needle)||(target.length>=3&&compact.includes(target)));};
  const any=(text,terms)=>(terms||[]).some(term=>has(text,term));
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const safeTerms=['รับผิดชอบ','ปลอดภัย','ความปลอดภัย','ความเสี่ยง','ผลกระทบ','ข้อจำกัด','ความเป็นธรรม','ตรวจสอบ'];
  const humanTerms=['มนุษย์','ผู้เชี่ยวชาญ','เจ้าหน้าที่','ผู้ตรวจ','วิศวกร','ผู้บริหาร','อาจารย์','ครู','ผู้รับผิดชอบ'];
  const reviewTerms=['ตรวจ','ทบทวน','ยืนยัน','อนุมัติ','หยุด','กำกับ','ส่งต่อ','แก้ไข','อุทธรณ์','override'];
  const skillTerms={
    'PEAS ครบองค์ประกอบ':['peas','performance','environment','actuator','sensor','เป้าหมาย','สภาพแวดล้อม','ตัวกระทำ','เซนเซอร์'],
    'Sensor / Actuator':['sensor','actuator','เซนเซอร์','ตัวกระทำ','ข้อมูลเข้า','สั่งการ','รับรู้'],
    'Performance measure':['performance','measure','เกณฑ์','ตัวชี้วัด','ผลสำเร็จ','ความถูกต้อง','ความปลอดภัย'],
    'Rational action':['rational','action','การตัดสินใจ','ทางเลือก','หลักฐาน','เงื่อนไข','ความเสี่ยง'],
    'Human oversight':['oversight','มนุษย์','ผู้เชี่ยวชาญ','กำกับ','ตรวจทาน','ส่งต่อ','override'],
    'Agent concept':['agent','ตัวแทน','percept','action','รับรู้','กระทำ'],
    'Sensor reliability':['sensor','เซนเซอร์','ข้อมูล','คุณภาพ','ขัดกัน','คลาดเคลื่อน','ตรวจสอบ'],
    'Environment':['environment','สภาพแวดล้อม','บริบท','ผู้ใช้','พื้นที่'],
    'Why PEAS':['peas','เป้าหมาย','สภาพแวดล้อม','เซนเซอร์','ตัวกระทำ'],
    'Trade-off':['trade-off','tradeoff','ความเร็ว','ความปลอดภัย','ความเสี่ยง','ข้อจำกัด'],
    'Rationality':['rational','เหตุผล','เงื่อนไข','เป้าหมาย','ความเสี่ยง'],
    'Audit trail':['audit','log','บันทึก','ตรวจสอบ','หลักฐาน','ย้อนหลัง'],
    'Human override':['override','มนุษย์','ผู้เชี่ยวชาญ','หยุด','ส่งต่อ','กำกับ'],
    'Scope boundary':['scope','ขอบเขต','ข้อจำกัด','ส่งต่อ','เกินขอบเขต'],
    'Agent test':['test','ทดสอบ','edge case','กรณีผิดปกติ','ตรวจสอบ'],
    'Case Twist: low confidence':['confidence','ไม่แน่ใจ','threshold','เกณฑ์','ความเสี่ยง'],
    'Case Twist: user rights':['สิทธิ์','ผู้ใช้','อุทธรณ์','อธิบาย','ทบทวน'],
    'Case Twist: changed context':['context','บริบท','สภาพแวดล้อม','drift','เปลี่ยนแปลง'],
    'Case Twist: conflicting goals':['ความเร็ว','ความปลอดภัย','ข้อจำกัด','trade-off','เป้าหมายขัดกัน']
  };
  const policyTerms={
    verify:['ตรวจสอบ','ยืนยัน','หลักฐาน','ข้อมูล','ข้ามแหล่ง'],
    reversible:['ย้อนกลับ','จำกัด','ลดผลกระทบ','หยุด','ทางเลือกปลอดภัย'],
    threshold:['threshold','เกณฑ์','ความเสี่ยง','ส่งต่อ','หยุด'],
    rights:['สิทธิ์','ผู้ใช้','อุทธรณ์','อธิบาย','ทบทวน'],
    audit:['audit','log','บันทึก','ตรวจสอบ','หลักฐาน','ย้อนหลัง'],
    scope:['scope','ขอบเขต','ข้อจำกัด','ส่งต่อ','เกินขอบเขต'],
    base:['หลักฐาน','เหตุผล','ตรวจสอบ','ความเสี่ยง']
  };
  function audit(){const value=window.AIQuestS2ReplayAuditCurrent;return value&&Array.isArray(value.cards)&&value.cards.length?value:null;}
  function card(){const a=audit(),select=$('s2EvidenceCase');return a?.cards?.find(item=>String(item.id)===String(select?.value||''))||null;}
  function aliases(context){const source=clean(context),words=source.split(/\s+/).filter(Boolean);return [...new Set([source,source.replace(/^ระบบ/,'').trim(),words.slice(0,2).join(' '),words.slice(-2).join(' ')])].filter(value=>normal(value).length>=4);}
  function mentionsContext(text,context){return aliases(context).some(alias=>has(text,alias));}
  function report(){
    const selected=card(),r1=$('r1')?.value||'',r2=$('r2')?.value||'',r3=$('r3')?.value||'',errors=[];
    if(!selected)errors.push('เลือก Case ที่เล่นจริงจาก Deck นี้ก่อนส่งผล');
    [r1,r2,r3].forEach((text,index)=>{if(count(text)<65)errors.push('ข้อ '+(index+1)+' ต้องมีอย่างน้อย 65 ตัวอักษร')});
    if(selected){
      const terms=skillTerms[selected.skill]||['agent','ตัวแทน','หลักฐาน','เหตุผล','ความเสี่ยง'];
      const policy=policyTerms[String(selected.policy||'base').toLowerCase()]||policyTerms.base;
      if(!mentionsContext(r1,selected.context))errors.push('ข้อ 1 ต้องระบุ Context ของ Case ที่เลือก: '+selected.context);
      if(!any(r1,terms))errors.push('ข้อ 1 ต้องเชื่อมหลักการ/ทักษะของ Case ที่เลือก: '+selected.skill);
      if(!mentionsContext(r2,selected.context))errors.push('ข้อ 2 ต้องอธิบายความรับผิดชอบกับ Case ที่เลือก ไม่ใช่ Case อื่น');
      if(!any(r2,safeTerms))errors.push('ข้อ 2 ต้องกล่าวถึงความปลอดภัย ความเสี่ยง ผลกระทบ หรือข้อจำกัด');
      if(!any(r2,policy))errors.push('ข้อ 2 ต้องอธิบาย policy ของ Case ที่เลือก: '+String(selected.policy||'base'));
      if(!any(r3,humanTerms)||!any(r3,reviewTerms))errors.push('ข้อ 3 ต้องระบุผู้ตรวจทานและสิ่งที่ต้องตรวจ/ทบทวน');
      if(!(mentionsContext(r3,selected.context)||any(r3,terms)))errors.push('ข้อ 3 ต้องเชื่อมการตรวจทานกับ Context หรือทักษะของ Case ที่เลือก');
    }
    return {ok:errors.length===0,errors,selected,counts:[count(r1),count(r2),count(r3)]};
  }
  function persist(state){
    const prior=window.AIQuestS2ReflectionEvidenceCurrent||{},selected=state.selected;
    window.AIQuestS2ReflectionEvidenceCurrent=selected?Object.assign({},prior,{version:'v6.7.8',deckId:clean(audit()?.deckId),deckRound:Number(audit()?.deckRound||0),selectedCaseId:clean(selected.id),selectedCaseContext:clean(selected.context),selectedCaseSkill:clean(selected.skill),selectedCasePolicy:clean(selected.policy||'base'),selectedCaseFingerprint:clean(selected.fingerprint),checkedAt:new Date().toISOString(),integrity:{ok:state.ok,errorCount:state.errors.length,checks:{contextR1:mentionsContext($('r1')?.value||'',selected.context),skillR1:any($('r1')?.value||'',skillTerms[selected.skill]||[]),contextR2:mentionsContext($('r2')?.value||'',selected.context),policyR2:any($('r2')?.value||'',policyTerms[String(selected.policy||'base').toLowerCase()]||policyTerms.base),humanReviewR3:any($('r3')?.value||'',humanTerms)&&any($('r3')?.value||'',reviewTerms)}}):null;
  }
  function render(){
    const state=report();persist(state);
    const check=$('s2EvidenceCheckV675');if(!check)return state;
    if(!state.selected){check.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case</span>';return state;}
    const details=state.errors.slice(0,4).map(error=>'<li>'+esc(error)+'</li>').join('');
    check.innerHTML='<b>Evidence Check</b><br><span style="color:'+(state.ok?'#bbf7d0':'#fde68a')+'">'+(state.ok?'✓ Reflection ผูกกับ Context, Skill และ Policy ของ Case ที่เลือกครบ':'ต้องปรับ Reflection ให้ตรงกับ Case ที่เลือกก่อนส่งผล')+'</span>'+(!state.ok?'<ul style="margin:6px 0 0;padding-left:18px">'+details+'</ul>':'');
    return state;
  }
  function block(event){
    const target=event.target?.closest?.('#save');if(!target)return;
    const state=render();if(state.ok)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const note=$('saveNote');if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้: Reflection ต้องเชื่อมกับ Case ที่เลือก</b><ul style="margin:7px 0 0;padding-left:20px">'+state.errors.slice(0,5).map(error=>'<li>'+esc(error)+'</li>').join('')+'</ul>';}
    if(!state.selected)$('s2EvidenceBindingV675')?.scrollIntoView({behavior:'smooth',block:'center'});else $('r1')?.focus();
  }
  document.addEventListener('click',block,true);
  document.addEventListener('input',event=>{if(['r1','r2','r3'].includes(event.target?.id))render();},true);
  document.addEventListener('change',event=>{if(event.target?.id==='s2EvidenceCase')render();},true);
  new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(render,230);render();
})();
