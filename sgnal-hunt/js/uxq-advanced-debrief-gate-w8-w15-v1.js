/* CSAI2601 UX Quest • Advanced Debrief Gate W8-W15 v1
 * Strict debrief quality gate for W8-W15 only.
 * Blocks chip-only, shallow, and non-evidence answers.
 * Requires: selected idea + reason connector + evidence/context/task language.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const val=e=>String(e?.value||'').replace(/\s+/g,' ').trim();
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W8').toUpperCase();
  if(!/^W(8|9|1[0-5])$/.test(node())) return;
  const conn=/เพราะ|เนื่องจาก|จึง|ทำให้|เพื่อ|ช่วย|ลด|เพิ่ม|ป้องกัน|พิสูจน์|วัด|ทดสอบ|retest|evidence|because|therefore|validate|measure/i;
  const ev=/ผู้ใช้|task|goal|context|case|หลักฐาน|evidence|สถานการณ์|เงื่อนไข|ข้อมูล|problem|finding|severity|prototype|wireframe|layout|component|state|accessibility|a11y|visual|portfolio|persona|flow/i;
  const RULES={
    W8:{name:'Blueprint evidence',idea:/blueprint|evidence|chain|critique|revision|mismatch|artifact|problem|หลักฐาน|ปรับ/i,min:50,hint:'ตัวอย่าง: เลือก revision นี้ เพราะแก้ mismatch ระหว่าง evidence กับ blueprint และพิสูจน์ผลต่อ task ได้'},
    W9:{name:'Design system',idea:/component|state|naming|system|pattern|reuse|consistent|rule|ชื่อ|สถานะ/i,min:50,hint:'ตัวอย่าง: เลือก state ของ component เพราะช่วยให้ pattern ใช้ซ้ำได้และลด inconsistency'},
    W10:{name:'Responsive/A11y',idea:/responsive|accessibility|a11y|contrast|label|breakpoint|touch|mobile|อ่าน|แตะ/i,min:50,hint:'ตัวอย่าง: เลือกแก้ breakpoint เพราะรักษา task หลักและ action สำคัญบนมือถือ'},
    W11:{name:'Visual system',idea:/visual|color|typography|contrast|spacing|hierarchy|สี|ฟอนต์|อ่าน|จัดกลุ่ม/i,min:50,hint:'ตัวอย่าง: เลือกปรับ contrast เพราะช่วยให้อ่านข้อมูลหลักได้ก่อนกด action'},
    W12:{name:'Interaction state',idea:/state|feedback|microcopy|error|recovery|prevention|สถานะ|แจ้งเตือน|แก้/i,min:50,hint:'ตัวอย่าง: เลือก microcopy นี้ เพราะช่วยผู้ใช้ recovery จาก error และรู้ next step'},
    W13:{name:'Prototype flow',idea:/prototype|link|interaction|path|flow|error path|task|dead end|ทดสอบ/i,min:50,hint:'ตัวอย่าง: เลือกเชื่อม error path เพราะทำให้ prototype ทดสอบ task จริงได้ครบ'},
    W14:{name:'Usability evidence',idea:/finding|severity|fix|retest|usability|evidence|impact|frequency|แก้|ทดสอบซ้ำ/i,min:50,hint:'ตัวอย่าง: เลือก severity นี้ เพราะกระทบ task completion และต้อง retest หลังแก้'},
    W15:{name:'Portfolio defense',idea:/portfolio|defense|story|evidence gap|decision|result|test|นำเสนอ|ป้องกัน/i,min:50,hint:'ตัวอย่าง: เลือก evidence gap นี้ เพราะเป็นจุดที่ต้องปิดก่อนป้องกัน design decision'}
  };
  const chip=/^(blueprint|evidence|chain|component|state|naming|responsive|a11y|visual|contrast|spacing|microcopy|prototype|link|severity|retest|portfolio|defense)$/i;
  function len(s){return s.replace(/[\s,，、.。•\-_/]+/g,'').length;}
  function rule(){return RULES[node()]||RULES.W8;}
  function root(){
    const heads=$$('h1,h2,h3,b,strong,section,div').filter(el=>/debrief|sheet|สรุป|ภารกิจหลังเล่น|artifact|portfolio|mission/i.test(text(el)));
    for(const h of heads){let r=h.closest('section,article,.card,.panel,.result,.summary,.artifact')||h.parentElement;for(let i=0;i<6&&r&&r.querySelectorAll('textarea').length<1;i++)r=r.parentElement;if(r&&r.querySelectorAll('textarea').length)return r;}
    return null;
  }
  function fields(r){return $$('textarea',r).slice(0,3);}
  function score(s){
    const r=rule();
    if(!s)return {ok:false,msg:'ยังไม่ได้เขียน'};
    if(chip.test(s))return {ok:false,msg:'ยังเป็น keyword จากชิป ต้องเขียนเป็นประโยค'};
    if(len(s)<r.min)return {ok:false,msg:`สั้นเกินไปสำหรับ ${r.name}: ต้องมีสิ่งที่เลือก + เหตุผล + หลักฐาน`};
    if(!r.idea.test(s))return {ok:false,msg:`ยังไม่บอกแนวคิดของ ${r.name} ชัดเจน`};
    if(!conn.test(s))return {ok:false,msg:'ต้องมีเหตุผล เช่น เพราะ/ช่วย/ลด/ทำให้/พิสูจน์'};
    if(!ev.test(s))return {ok:false,msg:'ต้องโยงกับ evidence, case, task, goal, user หรือ finding'};
    return {ok:true,msg:'ผ่าน'};
  }
  function hint(){return rule().hint;}
  function hintNode(ta){let h=ta.parentElement.querySelector('.uxqAdvancedDebriefHint');if(!h){h=document.createElement('div');h.className='uxqAdvancedDebriefHint';ta.insertAdjacentElement('afterend',h);}return h;}
  function validate(r,focus){let ok=true,first=null;fields(r).forEach(ta=>{const res=score(val(ta));ta.dataset.advancedDebriefOk=res.ok?'1':'0';const h=hintNode(ta);h.textContent=res.ok?'✅ ใช้ได้: มีแนวคิด + เหตุผล + หลักฐานแล้ว':`⚠ ${res.msg} — ${hint()}`;h.dataset.ok=res.ok?'1':'0';if(!res.ok){ok=false;if(!first)first=ta;}});$$('button',r).filter(b=>/บันทึก|save|ส่ง|submit/i.test(text(b))).forEach(b=>{b.disabled=!ok;b.dataset.advancedDebriefBlocked=ok?'0':'1';});if(!ok&&focus){first?.focus();toast('W8-W15 ต้องเขียนแนวคิด + เหตุผล + หลักฐานจาก case ก่อนบันทึก');}return ok;}
  function apply(){const r=root();if(!r||r.dataset.advancedDebriefGate==='v1')return;r.dataset.advancedDebriefGate='v1';fields(r).forEach(ta=>{ta.placeholder=hint();hintNode(ta).textContent=hint();ta.addEventListener('input',()=>validate(r,false));ta.addEventListener('blur',()=>validate(r,false));});r.addEventListener('click',e=>{const b=e.target.closest('button,a');if(!b||!/บันทึก|save|ส่ง|submit/i.test(text(b)))return;if(!validate(r,true)){e.preventDefault();e.stopImmediatePropagation();}},true);validate(r,false);}
  function toast(msg){let t=$('.uxqAdvancedDebriefToast');if(t)t.remove();t=document.createElement('div');t.className='uxqAdvancedDebriefToast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800);}
  function style(){if($('#uxq-advanced-debrief-style'))return;const s=document.createElement('style');s.id='uxq-advanced-debrief-style';s.textContent=`.uxqAdvancedDebriefHint{margin:7px 0 0;color:#ffd98a;font-weight:800;font-size:.86rem;line-height:1.35}.uxqAdvancedDebriefHint[data-ok="1"]{color:#8ff5c2}textarea[data-advanced-debrief-ok="0"]{border-color:rgba(255,209,102,.75)!important;box-shadow:0 0 0 2px rgba(255,209,102,.10)!important}button[data-advanced-debrief-blocked="1"]{opacity:.48;cursor:not-allowed}.uxqAdvancedDebriefToast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:rgba(8,18,45,.97);border:1px solid rgba(255,209,102,.5);border-radius:16px;color:#fff;padding:12px 14px;font-weight:900;max-width:min(92vw,660px);box-shadow:0 18px 60px rgba(0,0,0,.35)}`;document.head.appendChild(s);}
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();apply();},160);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
