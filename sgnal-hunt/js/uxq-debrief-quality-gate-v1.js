/* CSAI2601 UX Quest • Debrief Quality Gate v1
 * Prevents one-word chip-only debrief answers from being saved.
 * Students can still write short Thai/English sentences, but each field must include
 * a choice/idea plus a reason/evidence signal.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const value=e=>String(e?.value||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const connectors=/เพราะ|เนื่องจาก|จึง|ทำให้|เพื่อ|ช่วย|ลด|เพิ่ม|ป้องกัน|พิสูจน์|วัด|จากหลักฐาน|evidence|because|so|to |for |therefore|reduce|increase|measure|test|validate/i;
  const chipOnly=/^(priority แรก|ข้อมูลหลัก|status สำคัญ|ลดสิ่งรบกวน|card layout|stepper|sticky CTA|comparison|primary CTA|mobile-first|touch target|ลดการซูม)$/i;
  function debriefRoot(){
    const heads=$$('h1,h2,h3,b,strong,section,div').filter(el=>/debrief|sheet|สรุป|mission debrief|wireframe priority/i.test(text(el)));
    if(!heads.length)return null;
    let root=heads[0].closest('section,article,.card,.panel,.result,.summary,.artifact')||heads[0].parentElement;
    for(let i=0;i<4&&root&&root.querySelectorAll('textarea').length<3;i++)root=root.parentElement;
    return root&&root.querySelectorAll('textarea').length?root:null;
  }
  function fields(root){return $$('textarea',root).slice(0,3);}
  function score(v){
    const s=value({value:v});
    if(!s)return {ok:false,msg:'ยังไม่ได้เขียน'};
    if(chipOnly.test(s))return {ok:false,msg:'ยังเป็น keyword จากชิป ให้เติมเหตุผลสั้น ๆ'};
    const words=s.split(/[\s,，、]+/).filter(Boolean).length;
    const longEnough=s.length>=16 || words>=5;
    if(!longEnough)return {ok:false,msg:'สั้นเกินไป ให้เขียนเป็นประโยคสั้น ๆ'};
    if(!connectors.test(s))return {ok:false,msg:'ต้องมีเหตุผล/หลักฐาน เช่น เพราะ, ช่วย, ลด, เพื่อ, evidence'};
    return {ok:true,msg:'ผ่าน'};
  }
  function hintFor(i){
    if(node()==='W7'){
      return [
        'ตัวอย่าง: เลือกข้อมูลหลัก เพราะช่วยให้ผู้ใช้รู้เงื่อนไขก่อนกด CTA',
        'ตัวอย่าง: ใช้ card layout เพราะเทียบข้อมูลหลายรายการได้เร็วขึ้น',
        'ตัวอย่าง: ปรับ touch target เพราะลดการแตะผิดบนมือถือ'
      ][i]||'เติมเหตุผลสั้น ๆ จากหลักฐาน';
    }
    return 'เติมเป็นประโยคสั้น ๆ: สิ่งที่เลือก + เพราะ/ช่วย/ลด/เพื่อ + หลักฐาน';
  }
  function makeHint(ta,i){
    let h=ta.parentElement.querySelector('.uxqDebriefQualityHint');
    if(!h){h=document.createElement('div');h.className='uxqDebriefQualityHint';ta.insertAdjacentElement('afterend',h);}
    h.textContent=hintFor(i);
    return h;
  }
  function apply(){
    const root=debriefRoot(); if(!root||root.dataset.qualityGate==='1')return;
    root.dataset.qualityGate='1';
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
      const res=score(value(ta));
      ta.dataset.qualityOk=res.ok?'1':'0';
      const h=makeHint(ta,i);
      h.textContent=res.ok?'✅ ใช้ได้: มีสิ่งที่เลือกและเหตุผลแล้ว':`⚠ ${res.msg} — ${hintFor(i)}`;
      h.dataset.ok=res.ok?'1':'0';
      if(!res.ok){okAll=false;if(!first)first=ta;}
    });
    const buttons=$$('button',root).filter(b=>/บันทึก|save|ส่ง|submit/i.test(text(b)));
    buttons.forEach(b=>{b.disabled=!okAll;b.dataset.qualityBlocked=okAll?'0':'1';});
    if(!okAll&&focusFirst){first?.focus();toast('ต้องเขียนเป็นประโยคสั้น ๆ มีเหตุผล/หลักฐานก่อนบันทึก');}
    return okAll;
  }
  function toast(msg){
    let t=$('.uxqDebriefToast'); if(t)t.remove();
    t=document.createElement('div');t.className='uxqDebriefToast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600);
  }
  function style(){
    if($('#uxq-debrief-quality-style'))return;
    const s=document.createElement('style');s.id='uxq-debrief-quality-style';s.textContent=`
      .uxqDebriefQualityHint{margin:7px 0 0;color:#ffd98a;font-weight:800;font-size:.86rem;line-height:1.35}.uxqDebriefQualityHint[data-ok="1"]{color:#8ff5c2}.uxqDebriefQualityRoot textarea[data-quality-ok="0"]{border-color:rgba(255,209,102,.75)!important;box-shadow:0 0 0 2px rgba(255,209,102,.10)!important}.uxqDebriefQualityRoot button[data-quality-blocked="1"]{opacity:.48;cursor:not-allowed}.uxqDebriefToast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:rgba(8,18,45,.97);border:1px solid rgba(255,209,102,.5);border-radius:16px;color:#fff;padding:12px 14px;font-weight:900;max-width:min(92vw,560px);box-shadow:0 18px 60px rgba(0,0,0,.35)}`;
    document.head.appendChild(s);
  }
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(()=>{style();apply();},120);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
