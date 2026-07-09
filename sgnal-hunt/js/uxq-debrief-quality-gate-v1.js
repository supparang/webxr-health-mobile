/* CSAI2601 UX Quest • Debrief Quality Gate v2
 * Blocks chip-only and shallow keyword+connector debrief answers.
 * W7 is strict and stage-aware: each field must include a selected idea, a reason connector,
 * and evidence/context/task language. Short keyword fragments no longer pass.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const value=e=>String(e?.value||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const connectors=/เพราะ|เนื่องจาก|จึง|ทำให้|เพื่อ|ช่วย|ลด|เพิ่ม|ป้องกัน|พิสูจน์|วัด|จากหลักฐาน|evidence|because|therefore|reduce|increase|measure|test|validate/i;
  const evidence=/ผู้ใช้|task|goal|context|หลักฐาน|สถานการณ์|case|เงื่อนไข|สถานะ|ข้อมูล|ปัญหา|friction|flow|layout|CTA|mobile|context|evidence|user/i;
  const chipOnly=/^(priority แรก|ข้อมูลหลัก|status สำคัญ|ลดสิ่งรบกวน|card layout|stepper|sticky CTA|comparison|primary CTA|mobile-first|touch target|ลดการซูม)$/i;
  const shallowFragments=/^(status สำคัญ,? priority แรก ลดภาระการมอง|sticky CTA ลดช่องว่าง white space|touch target ทำให้ CTA มี แค่ 1 ในแต่หน้า)$/i;
  const W7_RULES=[
    {name:'Visual priority', idea:/priority|visual|status|ข้อมูลหลัก|สถานะ|ลำดับ|สำคัญ|เด่น|ลดสิ่งรบกวน/i, evidence:/ผู้ใช้|task|goal|context|สถานการณ์|สถานะ|ข้อมูล|เงื่อนไข|ตัดสินใจ|มอง|อ่าน/i, min:42, hint:'ตัวอย่าง: เลือก status สำคัญ เพราะช่วยให้ผู้ใช้เห็นเงื่อนไขก่อนกด CTA ตาม goal ของหน้า'},
    {name:'Layout decision', idea:/layout|card|grid|filter|stepper|sticky|comparison|รายการ|โครงสร้าง|เปรียบเทียบ|white space|ช่องว่าง/i, evidence:/goal|content|hierarchy|ผู้ใช้|task|ข้อมูล|รายการ|เปรียบเทียบ|ค้นหา|เงื่อนไข|อ่าน|เลือก/i, min:42, hint:'ตัวอย่าง: ใช้ card layout เพราะช่วยเทียบสถานะและข้อมูลหลักได้เร็วตาม content hierarchy'},
    {name:'CTA / Mobile adjustment', idea:/CTA|primary|mobile|touch|target|ปุ่ม|แตะ|ซูม|mobile-first|action/i, evidence:/ผู้ใช้|task|goal|context|มือถือ|แตะ|ซูม|กด|action|friction|เงื่อนไข|ตัดสินใจ/i, min:42, hint:'ตัวอย่าง: ปรับ touch target เพราะลดการแตะผิดบนมือถือและช่วยให้กด CTA หลังอ่านเงื่อนไขแล้ว'}
  ];
  function debriefRoot(){
    const heads=$$('h1,h2,h3,b,strong,section,div').filter(el=>/debrief|sheet|สรุป|mission debrief|wireframe priority/i.test(text(el)));
    if(!heads.length)return null;
    let root=heads[0].closest('section,article,.card,.panel,.result,.summary,.artifact')||heads[0].parentElement;
    for(let i=0;i<5&&root&&root.querySelectorAll('textarea').length<3;i++)root=root.parentElement;
    return root&&root.querySelectorAll('textarea').length?root:null;
  }
  function fields(root){return $$('textarea',root).slice(0,3);}
  function normalizedLen(s){return s.replace(/[\s,，、.。•\-_/]+/g,'').length;}
  function hasTwoParts(s){
    const hit=(s.match(connectors)||[]).length;
    return hit>=1 && /.+(เพราะ|เนื่องจาก|จึง|ทำให้|เพื่อ|ช่วย|ลด|เพิ่ม|ป้องกัน|evidence|because|therefore).+/i.test(s);
  }
  function scoreGeneric(s){
    if(!s)return {ok:false,msg:'ยังไม่ได้เขียน'};
    if(chipOnly.test(s))return {ok:false,msg:'ยังเป็น keyword จากชิป ให้เติมเหตุผลและหลักฐาน'};
    if(normalizedLen(s)<28)return {ok:false,msg:'สั้นเกินไป ให้เขียนเป็นประโยคที่มีเหตุผล'};
    if(!connectors.test(s))return {ok:false,msg:'ต้องมีเหตุผล เช่น เพราะ, ช่วย, ลด, ทำให้'};
    if(!evidence.test(s))return {ok:false,msg:'ต้องโยงกับ goal/context/task/ผู้ใช้/หลักฐาน'};
    return {ok:true,msg:'ผ่าน'};
  }
  function scoreW7(s,i){
    const rule=W7_RULES[i]||W7_RULES[0];
    if(!s)return {ok:false,msg:'ยังไม่ได้เขียน'};
    if(chipOnly.test(s)||shallowFragments.test(s))return {ok:false,msg:'ยังเป็น keyword/ประโยคสั้นเกินไป ต้องอธิบายจากหลักฐาน'};
    if(normalizedLen(s)<rule.min)return {ok:false,msg:`สั้นเกินไปสำหรับ ${rule.name} ต้องมีสิ่งที่เลือก + เหตุผล + หลักฐาน`};
    if(!rule.idea.test(s))return {ok:false,msg:`ยังไม่บอกสิ่งที่เลือกของ ${rule.name} ชัดเจน`};
    if(!connectors.test(s)||!hasTwoParts(s))return {ok:false,msg:'ต้องมีเหตุผลเชื่อม เช่น เพราะ/ช่วย/ลด/ทำให้'};
    if(!rule.evidence.test(s))return {ok:false,msg:'ต้องโยงกับหลักฐาน เช่น goal, context, task, ผู้ใช้ หรือสถานการณ์'};
    return {ok:true,msg:'ผ่าน'};
  }
  function score(v,i){
    const s=value({value:v});
    return node()==='W7'?scoreW7(s,i):scoreGeneric(s);
  }
  function hintFor(i){
    if(node()==='W7')return (W7_RULES[i]||W7_RULES[0]).hint;
    return 'เติมเป็นประโยคสั้น ๆ: สิ่งที่เลือก + เพราะ/ช่วย/ลด/ทำให้ + หลักฐานจาก case';
  }
  function makeHint(ta,i){
    let h=ta.parentElement.querySelector('.uxqDebriefQualityHint');
    if(!h){h=document.createElement('div');h.className='uxqDebriefQualityHint';ta.insertAdjacentElement('afterend',h);}
    h.textContent=hintFor(i);
    return h;
  }
  function apply(){
    const root=debriefRoot(); if(!root||root.dataset.qualityGate==='v2')return;
    root.dataset.qualityGate='v2';
    root.classList.add('uxqDebriefQualityRoot');
    const tas=fields(root); if(tas.length<3)return;
    tas.forEach((ta,i)=>{
      ta.dataset.qualityField=String(i+1);
      ta.placeholder=hintFor(i);
      makeHint(ta,i);
      ta.addEventListener('input',()=>validate(root,false));
      ta.addEventListener('blur',()=>validate(root,false));
    });
    root.addEventListener('click',(e)=>{
      const btn=e.target.closest('button,a');
      if(!btn)return;
      const label=text(btn);
      if(!/บันทึก|save|ส่ง|submit/i.test(label))return;
      if(!validate(root,true)){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },true);
    validate(root,false);
  }
  function validate(root,focusFirst){
    const tas=fields(root); let okAll=true; let first=null;
    tas.forEach((ta,i)=>{
      const res=score(value(ta),i);
      ta.dataset.qualityOk=res.ok?'1':'0';
      const h=makeHint(ta,i);
      h.textContent=res.ok?'✅ ใช้ได้: มีสิ่งที่เลือก + เหตุผล + หลักฐานแล้ว':`⚠ ${res.msg} — ${hintFor(i)}`;
      h.dataset.ok=res.ok?'1':'0';
      if(!res.ok){okAll=false;if(!first)first=ta;}
    });
    const buttons=$$('button',root).filter(b=>/บันทึก|save|ส่ง|submit/i.test(text(b)));
    buttons.forEach(b=>{b.disabled=!okAll;b.dataset.qualityBlocked=okAll?'0':'1';});
    if(!okAll&&focusFirst){first?.focus();toast('ต้องเขียนสิ่งที่เลือก + เหตุผล + หลักฐานจาก case ก่อนบันทึก');}
    return okAll;
  }
  function toast(msg){
    let t=$('.uxqDebriefToast'); if(t)t.remove();
    t=document.createElement('div');t.className='uxqDebriefToast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800);
  }
  function style(){
    if($('#uxq-debrief-quality-style'))return;
    const s=document.createElement('style');s.id='uxq-debrief-quality-style';s.textContent=`
      .uxqDebriefQualityHint{margin:7px 0 0;color:#ffd98a;font-weight:800;font-size:.86rem;line-height:1.35}.uxqDebriefQualityHint[data-ok="1"]{color:#8ff5c2}.uxqDebriefQualityRoot textarea[data-quality-ok="0"]{border-color:rgba(255,209,102,.75)!important;box-shadow:0 0 0 2px rgba(255,209,102,.10)!important}.uxqDebriefQualityRoot button[data-quality-blocked="1"]{opacity:.48;cursor:not-allowed}.uxqDebriefToast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:rgba(8,18,45,.97);border:1px solid rgba(255,209,102,.5);border-radius:16px;color:#fff;padding:12px 14px;font-weight:900;max-width:min(92vw,620px);box-shadow:0 18px 60px rgba(0,0,0,.35)}`;
    document.head.appendChild(s);
  }
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(()=>{style();apply();},120);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
