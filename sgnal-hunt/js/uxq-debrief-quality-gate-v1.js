/* CSAI2601 UX Quest • Debrief Quality Gate v3
 * Scope-aware gate for W1-W7 + B1-B2, with strict W7 field rules.
 * Blocks chip-only, shallow keyword+connector answers, and debrief text that lacks evidence/context/task language.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const value=e=>String(e?.value||'').replace(/\s+/g,' ').trim();
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W1').toUpperCase();
  const SCOPE=/^(W[1-7]|B[12])$/;
  const connectors=/เพราะ|เนื่องจาก|จึง|ทำให้|เพื่อ|ช่วย|ลด|เพิ่ม|ป้องกัน|พิสูจน์|วัด|จากหลักฐาน|evidence|because|therefore|reduce|increase|measure|test|validate/i;
  const evidence=/ผู้ใช้|task|goal|context|หลักฐาน|สถานการณ์|case|เงื่อนไข|สถานะ|ข้อมูล|ปัญหา|friction|flow|layout|CTA|mobile|persona|prototype|wireframe|evidence|user/i;
  const chipOnly=/^(priority แรก|ข้อมูลหลัก|status สำคัญ|ลดสิ่งรบกวน|card layout|stepper|sticky CTA|comparison|primary CTA|mobile-first|touch target|ลดการซูม|HCD|persona|flow|wireframe|feedback|mental model|cognitive load)$/i;
  const shallow=/^(status สำคัญ,? priority แรก ลดภาระการมอง|sticky CTA ลดช่องว่าง white space|touch target ทำให้ CTA มี แค่ 1 ในแต่หน้า)$/i;
  const RULES={
    W1:{name:'UX Problem',idea:/friction|ปัญหา|task|goal|ผู้ใช้|สะดุด|ไปต่อไม่ได้|ข้อมูล|สถานะ|หลักฐาน/i,min:42,hint:'ตัวอย่าง: เลือก friction นี้ เพราะทำให้ผู้ใช้ทำ task ไม่สำเร็จตาม goal ของสถานการณ์'},
    W2:{name:'HCD Evidence',idea:/HCD|evidence|หลักฐาน|ผู้ใช้|assumption|research|test|สมมติฐาน|ข้อมูล/i,min:42,hint:'ตัวอย่าง: เลือกเก็บ evidence ก่อน เพราะช่วยลด assumption และโยงกับผู้ใช้ใน case'},
    W3:{name:'Psychology Signal',idea:/mental|cognitive|load|feedback|psychology|สถานะ|เข้าใจ|จำ|เดา|next step|ผู้ใช้/i,min:42,hint:'ตัวอย่าง: เลือกลด cognitive load เพราะช่วยให้ผู้ใช้ตัดสินใจจากข้อมูลในหน้าจอได้เร็วขึ้น'},
    W4:{name:'Research Evidence',idea:/research|สัมภาษณ์|สังเกต|คำถาม|ผู้ใช้|pain point|persona|ข้อมูล|หลักฐาน|bias/i,min:42,hint:'ตัวอย่าง: เลือกคำถามไม่ชี้นำ เพราะช่วยให้ได้หลักฐานพฤติกรรมของผู้ใช้ใน task จริง'},
    W5:{name:'Problem/HMW',idea:/problem|HMW|root cause|insight|concept|solution|ปัญหา|สาเหตุ|พิสูจน์/i,min:42,hint:'ตัวอย่าง: เลือก HMW แบบไม่ล็อก solution เพราะเปิดหลายแนวทางและทดสอบกับผู้ใช้ได้'},
    W6:{name:'User Flow',idea:/flow|path|step|recovery|error|next step|goal|ผู้ใช้|ทางเลือก|ย้อนกลับ/i,min:42,hint:'ตัวอย่าง: เลือก recovery path เพราะช่วยให้ผู้ใช้ไปต่อได้เมื่อทำผิดใน flow ของ task'},
    W7:{name:'Wireframe Priority',idea:/priority|visual|status|ข้อมูลหลัก|layout|card|grid|CTA|mobile|touch|target|ปุ่ม|hierarchy|context/i,min:46,hint:'ตัวอย่าง: เลือก status สำคัญ เพราะช่วยให้ผู้ใช้เห็นเงื่อนไขก่อนกด CTA ตาม goal ของหน้า'},
    B1:{name:'Boss B1 Foundation',idea:/friction|HCD|evidence|psychology|mental|feedback|task|goal|ผู้ใช้|proof|พิสูจน์/i,min:52,hint:'ตัวอย่าง: เลือกคำตอบนี้ เพราะเชื่อม friction กับ HCD evidence และพิสูจน์ผลต่อ task ได้'},
    B2:{name:'Boss B2 Flow/Wireframe',idea:/persona|problem|flow|wireframe|HMW|layout|recovery|chain|evidence|task/i,min:52,hint:'ตัวอย่าง: เลือกคำตอบนี้ เพราะ chain จาก persona → problem → flow → wireframe ไม่หลุดจากหลักฐาน'}
  };
  const W7_FIELDS=[
    {name:'Visual priority',idea:/priority|visual|status|ข้อมูลหลัก|สถานะ|ลำดับ|สำคัญ|เด่น|ลดสิ่งรบกวน/i,evidence:/ผู้ใช้|task|goal|context|สถานการณ์|สถานะ|ข้อมูล|เงื่อนไข|ตัดสินใจ|มอง|อ่าน/i,min:46,hint:'ตัวอย่าง: เลือก status สำคัญ เพราะช่วยให้ผู้ใช้เห็นเงื่อนไขก่อนกด CTA ตาม goal ของหน้า'},
    {name:'Layout decision',idea:/layout|card|grid|filter|stepper|sticky|comparison|รายการ|โครงสร้าง|เปรียบเทียบ|white space|ช่องว่าง/i,evidence:/goal|content|hierarchy|ผู้ใช้|task|ข้อมูล|รายการ|เปรียบเทียบ|ค้นหา|เงื่อนไข|อ่าน|เลือก/i,min:46,hint:'ตัวอย่าง: ใช้ card layout เพราะช่วยเทียบสถานะและข้อมูลหลักได้เร็วตาม content hierarchy'},
    {name:'CTA / Mobile adjustment',idea:/CTA|primary|mobile|touch|target|ปุ่ม|แตะ|ซูม|mobile-first|action/i,evidence:/ผู้ใช้|task|goal|context|มือถือ|แตะ|ซูม|กด|action|friction|เงื่อนไข|ตัดสินใจ/i,min:46,hint:'ตัวอย่าง: ปรับ touch target เพราะลดการแตะผิดบนมือถือและช่วยให้กด CTA หลังอ่านเงื่อนไขแล้ว'}
  ];
  function len(s){return s.replace(/[\s,，、.。•\-_/]+/g,'').length;}
  function twoParts(s){return connectors.test(s)&&/.+(เพราะ|เนื่องจาก|จึง|ทำให้|เพื่อ|ช่วย|ลด|เพิ่ม|ป้องกัน|evidence|because|therefore).+/i.test(s);}
  function root(){
    const heads=$$('h1,h2,h3,b,strong,section,div').filter(el=>/debrief|sheet|สรุป|mission debrief|priority|wireframe|artifact|ภารกิจหลังเล่น/i.test(text(el)));
    for(const h of heads){let r=h.closest('section,article,.card,.panel,.result,.summary,.artifact')||h.parentElement;for(let i=0;i<6&&r&&r.querySelectorAll('textarea').length<1;i++)r=r.parentElement;if(r&&r.querySelectorAll('textarea').length)return r;}
    return null;
  }
  function fields(r){return $$('textarea',r).slice(0,3);}
  function ruleFor(i){return node()==='W7'?(W7_FIELDS[i]||W7_FIELDS[0]):(RULES[node()]||RULES.W1);}
  function score(s,i){
    const rule=ruleFor(i);
    if(!s)return {ok:false,msg:'ยังไม่ได้เขียน'};
    if(chipOnly.test(s)||shallow.test(s))return {ok:false,msg:'ยังเป็น keyword/ประโยคสั้น ต้องอธิบายจากหลักฐาน'};
    if(len(s)<rule.min)return {ok:false,msg:`สั้นเกินไปสำหรับ ${rule.name}: ต้องมีสิ่งที่เลือก + เหตุผล + หลักฐาน`};
    if(!rule.idea.test(s))return {ok:false,msg:`ยังไม่บอกสิ่งที่เลือกของ ${rule.name} ชัดเจน`};
    if(!twoParts(s))return {ok:false,msg:'ต้องมีเหตุผลเชื่อม เช่น เพราะ/ช่วย/ลด/ทำให้'};
    const ev=rule.evidence||evidence;
    if(!ev.test(s))return {ok:false,msg:'ต้องโยงกับหลักฐาน เช่น goal, context, task, ผู้ใช้, สถานการณ์ หรือเงื่อนไข'};
    return {ok:true,msg:'ผ่าน'};
  }
  function hint(i){return ruleFor(i).hint;}
  function hintNode(ta,i){let h=ta.parentElement.querySelector('.uxqDebriefQualityHint');if(!h){h=document.createElement('div');h.className='uxqDebriefQualityHint';ta.insertAdjacentElement('afterend',h);}return h;}
  function validate(r,focusFirst){let okAll=true,first=null;fields(r).forEach((ta,i)=>{const res=score(value(ta),i);ta.dataset.qualityOk=res.ok?'1':'0';const h=hintNode(ta,i);h.textContent=res.ok?'✅ ใช้ได้: มีสิ่งที่เลือก + เหตุผล + หลักฐานแล้ว':`⚠ ${res.msg} — ${hint(i)}`;h.dataset.ok=res.ok?'1':'0';if(!res.ok){okAll=false;if(!first)first=ta;}});$$('button',r).filter(b=>/บันทึก|save|ส่ง|submit/i.test(text(b))).forEach(b=>{b.disabled=!okAll;b.dataset.qualityBlocked=okAll?'0':'1';});if(!okAll&&focusFirst){first?.focus();toast('ต้องเขียนสิ่งที่เลือก + เหตุผล + หลักฐานจาก case ก่อนบันทึก');}return okAll;}
  function apply(){if(!SCOPE.test(node()))return;const r=root();if(!r||r.dataset.qualityGate==='v3')return;r.dataset.qualityGate='v3';r.classList.add('uxqDebriefQualityRoot');fields(r).forEach((ta,i)=>{ta.placeholder=hint(i);hintNode(ta,i).textContent=hint(i);ta.addEventListener('input',()=>validate(r,false));ta.addEventListener('blur',()=>validate(r,false));});r.addEventListener('click',e=>{const btn=e.target.closest('button,a');if(!btn||!/บันทึก|save|ส่ง|submit/i.test(text(btn)))return;if(!validate(r,true)){e.preventDefault();e.stopImmediatePropagation();}},true);validate(r,false);}
  function toast(msg){let t=$('.uxqDebriefToast');if(t)t.remove();t=document.createElement('div');t.className='uxqDebriefToast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800);}
  function style(){if($('#uxq-debrief-quality-style'))return;const s=document.createElement('style');s.id='uxq-debrief-quality-style';s.textContent=`.uxqDebriefQualityHint{margin:7px 0 0;color:#ffd98a;font-weight:800;font-size:.86rem;line-height:1.35}.uxqDebriefQualityHint[data-ok="1"]{color:#8ff5c2}.uxqDebriefQualityRoot textarea[data-quality-ok="0"]{border-color:rgba(255,209,102,.75)!important;box-shadow:0 0 0 2px rgba(255,209,102,.10)!important}.uxqDebriefQualityRoot button[data-quality-blocked="1"]{opacity:.48;cursor:not-allowed}.uxqDebriefToast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:rgba(8,18,45,.97);border:1px solid rgba(255,209,102,.5);border-radius:16px;color:#fff;padding:12px 14px;font-weight:900;max-width:min(92vw,640px);box-shadow:0 18px 60px rgba(0,0,0,.35)}`;document.head.appendChild(s);}
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(()=>{style();apply();},160);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
