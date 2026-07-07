/* CSAI2102 S2 Semantic Reflection Gate v6.9.9 — no MutationObserver loop */
(()=>{'use strict';
  if(window.__AQ_S2_SEMANTIC_EVIDENCE_V699__)return;
  window.__AQ_S2_SEMANTIC_EVIDENCE_V699__=true;
  const $=id=>document.getElementById(id),clean=v=>String(v==null?'':v).trim();
  const compact=v=>clean(v).toLowerCase().replace(/[\s\n\r\t.,!?…:;()\[\]{}"'`~\-_\/\\|]+/g,'');
  const count=v=>String(v||'').replace(/\s/g,'').length;
  const has=(text,term)=>{const raw=String(text||'').toLowerCase(),needle=String(term||'').toLowerCase(),a=compact(text),b=compact(term);return !!needle&&(raw.includes(needle)||(b.length>=3&&a.includes(b)));};
  const any=(text,list)=>(list||[]).some(term=>has(text,term));
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const safe=['รับผิดชอบ','ปลอดภัย','ความปลอดภัย','ความเสี่ยง','ผลกระทบ','ข้อจำกัด','ความเป็นธรรม','ตรวจสอบ'];
  const human=['มนุษย์','ผู้เชี่ยวชาญ','เจ้าหน้าที่','ผู้ตรวจ','วิศวกร','ผู้บริหาร','อาจารย์','ครู','ผู้รับผิดชอบ'];
  const review=['ตรวจ','ทบทวน','ยืนยัน','อนุมัติ','หยุด','กำกับ','ส่งต่อ','แก้ไข','อุทธรณ์','override'];
  const skills={
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
    'Scope boundary':['scope','ขอบเขต','ข้อจำกัด','ส่งต่อ','เกินขอบเขต'],
    'Case Twist: low confidence':['confidence','ไม่แน่ใจ','threshold','เกณฑ์','ความเสี่ยง'],
    'Case Twist: user rights':['สิทธิ์','ผู้ใช้','อุทธรณ์','อธิบาย','ทบทวน'],
    'Case Twist: safe fallback':['ไม่แน่ใจ','หยุด','ส่งต่อ','หลักฐาน','ความเสี่ยง']
  };
  const policies={verify:['ตรวจสอบ','ยืนยัน','หลักฐาน','ข้อมูล'],reversible:['ย้อนกลับ','จำกัด','ลดผลกระทบ','หยุด','ทางเลือกปลอดภัย'],threshold:['threshold','เกณฑ์','ความเสี่ยง','ส่งต่อ','หยุด'],rights:['สิทธิ์','ผู้ใช้','อุทธรณ์','อธิบาย','ทบทวน'],audit:['audit','log','บันทึก','ตรวจสอบ','หลักฐาน'],scope:['scope','ขอบเขต','ข้อจำกัด','ส่งต่อ','เกินขอบเขต'],base:['หลักฐาน','เหตุผล','ตรวจสอบ','ความเสี่ยง']};
  function selected(){return window.AIQuestS2ReflectionEvidenceCurrent||null;}
  function aliases(context){const words=clean(context).split(/\s+/).filter(Boolean);return [...new Set([clean(context),words.slice(0,2).join(' '),words.slice(-2).join(' ')])].filter(x=>compact(x).length>=4);}
  const mentions=(text,context)=>aliases(context).some(alias=>has(text,alias));
  function report(){
    const card=selected(),r1=$('r1')?.value||'',r2=$('r2')?.value||'',r3=$('r3')?.value||'',errors=[];
    if(!card)errors.push('เลือก Case ที่เล่นจริงจาก Deck นี้ก่อนส่งผล');
    [r1,r2,r3].forEach((value,index)=>{if(count(value)<55)errors.push('ข้อ '+(index+1)+' ต้องมีอย่างน้อย 55 ตัวอักษร');});
    if(card){const terms=skills[card.selectedCaseSkill]||['agent','ตัวแทน','หลักฐาน','เหตุผล','ความเสี่ยง'],policy=policies[String(card.selectedCasePolicy||'base').toLowerCase()]||policies.base,context=card.selectedCaseContext;
      if(!mentions(r1,context))errors.push('ข้อ 1 ต้องเชื่อมกับ Context ของ Case ที่เลือก');
      if(!any(r1,terms))errors.push('ข้อ 1 ต้องกล่าวถึงทักษะของ Case ที่เลือก: '+card.selectedCaseSkill);
      if(!mentions(r2,context))errors.push('ข้อ 2 ต้องเชื่อมความรับผิดชอบกับ Case ที่เลือก');
      if(!any(r2,safe))errors.push('ข้อ 2 ต้องกล่าวถึงความปลอดภัย ความเสี่ยง ผลกระทบ หรือข้อจำกัด');
      if(!any(r2,policy))errors.push('ข้อ 2 ต้องอธิบาย policy ของ Case ที่เลือก: '+card.selectedCasePolicy);
      if(!any(r3,human)||!any(r3,review))errors.push('ข้อ 3 ต้องระบุผู้ตรวจทานและสิ่งที่ต้องตรวจ/ทบทวน');
      if(!(mentions(r3,context)||any(r3,terms)))errors.push('ข้อ 3 ต้องเชื่อมการตรวจทานกับ Context หรือทักษะของ Case ที่เลือก');
    }
    return {ok:errors.length===0,errors,card,counts:[count(r1),count(r2),count(r3)]};
  }
  function persist(state){const card=state.card,prior=window.AIQuestS2ReflectionEvidenceCurrent||{};if(!card)return;window.AIQuestS2ReflectionEvidenceCurrent=Object.assign({},prior,{version:'v6.9.9',integrity:{ok:state.ok,errorCount:state.errors.length,checks:{contextR1:mentions($('r1')?.value||'',card.selectedCaseContext),contextR2:mentions($('r2')?.value||'',card.selectedCaseContext),humanReviewR3:any($('r3')?.value||'',human)&&any($('r3')?.value||'',review)}});}
  function render(){const state=report();persist(state);const check=document.querySelector('#s2EvidenceBindingV699 [data-check]');if(!check)return state;if(!state.card){check.innerHTML='<b>Evidence Check</b><br><span style="color:#fde68a">ยังไม่ได้เลือก Case</span>';return state;}const detail=state.errors.slice(0,4).map(e=>'<li>'+esc(e)+'</li>').join('');check.innerHTML='<b>Evidence Check</b><br><span style="color:'+(state.ok?'#bbf7d0':'#fde68a')+'">'+(state.ok?'✓ Reflection เชื่อมกับ Context, Skill และ Policy ครบ':'ต้องปรับ Reflection ให้เชื่อมกับ Case ที่เลือกก่อนส่งผล')+'</span>'+(state.ok?'':'<ul style="margin:6px 0 0;padding-left:18px">'+detail+'</ul>');return state;}
  function block(event){const save=event.target?.closest?.('#save');if(!save)return;const state=render();if(state.ok)return;event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();const note=$('saveNote');if(note){note.className='notice bad';note.innerHTML='<b>ยังส่งผลไม่ได้: Reflection ต้องเชื่อมกับ Case ที่เลือก</b><ul style="margin:7px 0 0;padding-left:20px">'+state.errors.slice(0,5).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>';}}
  document.addEventListener('click',block,true);
  document.addEventListener('input',event=>{if(['r1','r2','r3'].includes(event.target?.id))render();},true);
  document.addEventListener('change',event=>{if(event.target?.id==='s2EvidenceCaseV699')render();},true);
  document.addEventListener('aiquest:s2-evidence-mounted',render);
  document.addEventListener('aiquest:s2-evidence-change',render);
})();