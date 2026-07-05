/* CSAI2102 Teacher Reflection Audit v6.7.2
   Flags existing placeholder/template reflections once per data load.
   Does not touch score/history and never continuously rerenders the table. */
(()=>{'use strict';
  const KEY='Reflection ต้องเขียนใหม่';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').toLowerCase().replace(/[\s\n\r\t.,!?…:;()\[\]{}"'`~\-_\/\\|]+/g,'');
  const copiedSeeds=[
    'เลือก 1 case จากรอบนี้ แล้วอธิบายหลักฐานหรือหลักการที่ใช้ตัดสินใจ',
    'เลือก 1 case แล้วอธิบายหลักฐานหรือหลักการที่ใช้ตัดสินใจ',
    'ยกตัวอย่างการใช้ ai อย่างรับผิดชอบที่เชื่อมโยงกับ case ในรอบนี้',
    'ระบุจุดที่มนุษย์ควรตรวจทาน และเหตุผลว่าทำไม ai ไม่ควรตัดสินใจลำพัง',
    'ระบุจุดที่มนุษย์ควรตรวจทาน และเหตุผลว่าทำไมจึงไม่ควรปล่อยให้ ai ตัดสินใจลำพัง',
    'อย่างน้อย 45 ตัวอักษร อธิบายหลักการที่ใช้ตัดสินใจในหนึ่ง case'
  ].map(norm);
  const template=value=>{const v=norm(value);return !!v&&copiedSeeds.some(seed=>v===seed||(v.length>=30&&(v.includes(seed)||seed.includes(v))));};
  const duplicate=values=>{const usable=values.map(norm).filter(Boolean);return usable.length>=2&&new Set(usable).size<usable.length;};
  function auditStudent(student){
    const reflections=student&&student.latestReflection&&typeof student.latestReflection==='object'
      ? Object.keys(student.latestReflection).filter(key=>/^reflection/i.test(key)).map(key=>student.latestReflection[key]) : [];
    const invalid=reflections.some(template)||duplicate(reflections);
    const prior=String(student._reflectionAuditV672||'');
    const next=invalid?'template':'ok';
    student.risks=Array.isArray(student.risks)?student.risks:[];
    let changed=false;
    if(invalid&&!student.risks.includes(KEY)){student.risks.unshift(KEY);changed=true;}
    if(!invalid&&student.risks.includes(KEY)){student.risks=student.risks.filter(item=>item!==KEY);changed=true;}
    if(prior!==next){student._reflectionAuditV672=next;changed=true;}
    student.reflectionIntegrity=next;
    return changed;
  }
  function decorateModal(){
    const box=$('detailBox');if(!box||box.dataset.reflectionAudit==='1')return;
    const content=box.textContent||'';
    if(!copiedSeeds.some(seed=>norm(content).includes(seed)))return;
    const warning=document.createElement('div');warning.dataset.reflectionAudit='1';warning.style.cssText='margin-top:12px;padding:11px 12px;border:1px solid rgba(251,113,133,.48);border-radius:13px;background:rgba(251,113,133,.10);color:#fecdd3;line-height:1.55';warning.innerHTML='<b>⚠ Reflection ต้องเขียนใหม่</b><br>คำตอบล่าสุดมีข้อความคำสั่ง/placeholder ซ้ำ จึงยังไม่ควรใช้เป็นหลักฐานการสะท้อนคิด';
    const section=[...box.querySelectorAll('section')].find(el=>/Latest Reflection/.test(el.textContent||''));
    if(section)section.insertAdjacentElement('beforebegin',warning);else box.appendChild(warning);
  }
  let seenLoad='';
  function apply(){
    const api=window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532;
    const students=api&&api.state&&Array.isArray(api.state.students)?api.state.students:[];
    if(!students.length)return;
    const loadKey=String(api.state.lastLoaded||'')+'|'+students.length;
    if(loadKey===seenLoad)return;
    seenLoad=loadKey;
    let changed=false;students.forEach(student=>{if(auditStudent(student))changed=true;});
    if(changed){
      const search=$('studentSearch');
      if(search&&typeof search.oninput==='function')search.oninput();
    }
  }
  function schedule(){clearTimeout(schedule.t);schedule.t=setTimeout(apply,120);}
  function init(){
    const state=$('loadState'),modal=$('detailModal');
    if(state)new MutationObserver(schedule).observe(state,{childList:true,characterData:true,subtree:true});
    if(modal)new MutationObserver(decorateModal).observe(modal,{childList:true,subtree:true});
    document.addEventListener('click',event=>{const btn=event.target&&event.target.closest&&event.target.closest('.detailBtn');if(btn)setTimeout(decorateModal,40);});
    setTimeout(apply,1100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();