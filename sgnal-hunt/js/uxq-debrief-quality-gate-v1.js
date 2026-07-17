/* CSAI2601 UX Quest • Debrief Quality Gate v3.2
 * Scope-aware gate for W1-W7 + B1-B2.
 * W2 uses explicit field-level validation for Assumption, Evidence and Small Test.
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
  const chipOnly=/^(priority แรก|ข้อมูลหลัก|status สำคัญ|ลดสิ่งรบกวน|card layout|stepper|sticky CTA|comparison|primary CTA|mobile-first|touch target|ลดการซูม|HCD|persona|flow|wireframe|feedback|mental model|cognitive load|ทีมเดา solution|ฟัง stakeholder เดียว|เริ่ม prototype เร็วไป|เข้าใจผู้ใช้ไม่ครบ|สัมภาษณ์ผู้ใช้|สังเกต task|card sorting|tree test|ลองทำ task จริง|ถามเหตุผลหลังทำ|เทียบก่อน-หลัง|เก็บ pain point)$/i;
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

  const W2_FIELDS=[
    {
      name:'Assumption / Risk',
      idea:/assumption|สมมติฐาน|เดา|เสี่ยง|ยังไม่รู้|ไม่แน่ใจ|เข้าใจผู้ใช้ไม่ครบ|stakeholder|solution|prototype/i,
      evidence:/ผู้ใช้|กลุ่มเป้าหมาย|พฤติกรรม|task|บริบท|ข้อมูล|หลักฐาน|สัมภาษณ์|สังเกต|case/i,
      min:46,
      pass:'ระบุสมมติฐานหรือความเสี่ยง และโยงกับผู้ใช้แล้ว',
      hint:'เขียนว่าสิ่งใดที่ทีมยัง “คิดเอาเอง” และต้องหาหลักฐานจากผู้ใช้เรื่องใด'
    },
    {
      name:'Evidence ที่ควรเก็บ',
      idea:/evidence|หลักฐาน|สัมภาษณ์|สังเกต|tree test|card sorting|ทดสอบ|ข้อมูล|พฤติกรรม|task/i,
      evidence:/ผู้ใช้|กลุ่มเป้าหมาย|task|พฤติกรรม|ข้อมูล|เมนู|โครงสร้าง|นำทาง|case|บริบท/i,
      min:46,
      pass:'ระบุหลักฐานที่ต้องเก็บและแหล่งข้อมูลแล้ว',
      hint:'ระบุว่าจะเก็บหลักฐานอะไร จากใคร หรือจากพฤติกรรมใด ไม่ใช่เพียงชื่อวิธีวิจัย'
    },
    {
      name:'Small Test ถัดไป',
      idea:/test|ทดสอบ|ลอง|prototype|task|ก่อน-หลัง|วัด|จับเวลา|error|success|completion|pain point|feedback/i,
      evidence:/ผู้ใช้|กลุ่มเป้าหมาย|task|เวลา|ความสำเร็จ|ข้อผิดพลาด|สังเกต|วัด|เกณฑ์|ผลลัพธ์/i,
      min:46,
      pass:'ระบุวิธีทดสอบและสิ่งที่จะใช้ตัดสินผลแล้ว',
      hint:'บอกว่าจะให้ผู้ใช้ทำอะไร และจะวัดหรือสังเกตอะไรเพื่อรู้ว่าดีขึ้น'
    }
  ];

  const W7_FIELDS=[
    {name:'Visual priority',idea:/priority|visual|status|ข้อมูลหลัก|สถานะ|ลำดับ|สำคัญ|เด่น|ลดสิ่งรบกวน/i,evidence:/ผู้ใช้|task|goal|context|สถานการณ์|สถานะ|ข้อมูล|เงื่อนไข|ตัดสินใจ|มอง|อ่าน/i,min:46,hint:'ตัวอย่าง: เลือก status สำคัญ เพราะช่วยให้ผู้ใช้เห็นเงื่อนไขก่อนกด CTA ตาม goal ของหน้า'},
    {name:'Layout decision',idea:/layout|card|grid|filter|stepper|sticky|comparison|รายการ|โครงสร้าง|เปรียบเทียบ|white space|ช่องว่าง/i,evidence:/goal|content|hierarchy|ผู้ใช้|task|ข้อมูล|รายการ|เปรียบเทียบ|ค้นหา|เงื่อนไข|อ่าน|เลือก/i,min:46,hint:'ตัวอย่าง: ใช้ card layout เพราะช่วยเทียบสถานะและข้อมูลหลักได้เร็วตาม content hierarchy'},
    {name:'CTA / Mobile adjustment',idea:/CTA|primary|mobile|touch|target|ปุ่ม|แตะ|ซูม|mobile-first|action/i,evidence:/ผู้ใช้|task|goal|context|มือถือ|แตะ|ซูม|กด|action|friction|เงื่อนไข|ตัดสินใจ/i,min:46,hint:'ตัวอย่าง: ปรับ touch target เพราะลดการแตะผิดบนมือถือและช่วยให้กด CTA หลังอ่านเงื่อนไขแล้ว'}
  ];

  function len(s){return s.replace(/[\s,，、.。•\-_/]+/g,'').length;}
  function twoParts(s){return connectors.test(s)&&/.+(เพราะ|เนื่องจาก|จึง|ทำให้|เพื่อ|ช่วย|ลด|เพิ่ม|ป้องกัน|พิสูจน์|วัด|ทดสอบ|evidence|because|therefore).+/i.test(s);}
  function root(){
    const heads=$$('h1,h2,h3,b,strong,section,div').filter(el=>/debrief|sheet|สรุป|mission debrief|priority|wireframe|artifact|ภารกิจหลังเล่น/i.test(text(el)));
    for(const h of heads){
      let r=h.closest('section,article,.card,.panel,.result,.summary,.artifact')||h.parentElement;
      for(let i=0;i<6&&r&&r.querySelectorAll('textarea').length<1;i++)r=r.parentElement;
      if(r&&r.querySelectorAll('textarea').length)return r;
    }
    return null;
  }
  function fields(r){return $$('textarea',r).slice(0,3);}
  function ruleFor(i){
    if(node()==='W2')return W2_FIELDS[i]||W2_FIELDS[0];
    if(node()==='W7')return W7_FIELDS[i]||W7_FIELDS[0];
    return RULES[node()]||RULES.W1;
  }
  function score(s,i){
    const rule=ruleFor(i);
    if(!s)return {ok:false,msg:'ยังไม่ได้เขียน'};
    if(chipOnly.test(s)||shallow.test(s))return {ok:false,msg:'ยังเป็นเพียงคำเลือกหรือประโยคสั้น ต้องอธิบายต่อ'};
    if(len(s)<rule.min)return {ok:false,msg:`คำตอบยังสั้น ควรอธิบาย ${rule.name} พร้อมเหตุผลและหลักฐาน`};
    if(!rule.idea.test(s))return {ok:false,msg:`ยังไม่ระบุ ${rule.name} ให้ชัดเจน`};
    if(!twoParts(s))return {ok:false,msg:'ควรเชื่อมเหตุผลด้วย เพราะ/ช่วย/ลด/ทำให้/เพื่อ'};
    const ev=rule.evidence||evidence;
    if(!ev.test(s))return {ok:false,msg:'ยังไม่โยงกับผู้ใช้ พฤติกรรม task บริบท หรือวิธีวัดผล'};
    return {ok:true,msg:rule.pass||'หลักฐานครบแล้ว พร้อมส่งผลงาน'};
  }
  function hint(i){return ruleFor(i).hint;}
  function hintNode(ta){
    let h=ta.parentElement.querySelector('.uxqDebriefQualityHint');
    if(!h){h=document.createElement('div');h.className='uxqDebriefQualityHint';ta.insertAdjacentElement('afterend',h);}
    return h;
  }
  function summaryNode(r){
    let box=r.querySelector('.uxqDebriefValidationSummary');
    if(!box){
      box=document.createElement('div');
      box.className='uxqDebriefValidationSummary';
      const first=fields(r)[0];
      if(first){
        const anchor=first.closest('label,.field,.form-group')||first.parentElement;
        anchor?.parentElement?.insertBefore(box,anchor);
      } else r.prepend(box);
    }
    return box;
  }
  function updateSummary(r,results){
    if(node()!=='W2')return;
    const passed=results.filter(x=>x.ok).length;
    const box=summaryNode(r);
    box.dataset.complete=passed===3?'1':'0';
    const title=passed===3?'✅ ผ่านครบ 3/3 เกณฑ์ พร้อมส่ง':'ตรวจคำตอบแล้ว: ผ่าน '+passed+'/3 เกณฑ์';
    const items=results.map((res,i)=>`<li data-ok="${res.ok?'1':'0'}"><strong>${i+1}. ${W2_FIELDS[i].name}</strong> — ${res.ok?'ผ่าน':'ควรแก้'}: ${escapeHtml(res.msg)}</li>`).join('');
    box.innerHTML=`<div class="uxqDebriefValidationTitle">${title}</div><ul>${items}</ul>`;
  }
  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function validate(r,focusFirst){
    let okAll=true,first=null;
    const results=[];
    fields(r).forEach((ta,i)=>{
      const res=score(value(ta),i);
      results.push(res);
      ta.dataset.qualityOk=res.ok?'1':'0';
      const h=hintNode(ta);
      const wanted=res.ok?`✅ ผ่าน: ${res.msg}`:`⚠ ควรแก้: ${res.msg} — ${hint(i)}`;
      if(h.textContent!==wanted)h.textContent=wanted;
      h.dataset.ok=res.ok?'1':'0';
      if(!res.ok){okAll=false;if(!first)first=ta;}
    });
    updateSummary(r,results);
    $$('button',r).filter(b=>/บันทึก|save|ส่ง|submit/i.test(text(b))).forEach(b=>{
      b.disabled=!okAll;
      b.dataset.qualityBlocked=okAll?'0':'1';
      b.setAttribute('aria-disabled',okAll?'false':'true');
    });
    if(!okAll&&focusFirst){first?.focus();toast(node()==='W2'?'ยังผ่านไม่ครบ 3 เกณฑ์ ตรวจข้อความแนะนำใต้แต่ละช่อง':'ต้องเขียนสิ่งที่เลือก + เหตุผล + หลักฐานจาก case ก่อนบันทึก');}
    return okAll;
  }
  function apply(){
    if(!SCOPE.test(node()))return;
    const r=root();
    if(!r||r.dataset.qualityGate==='v3.2')return;
    r.dataset.qualityGate='v3.2';
    r.classList.add('uxqDebriefQualityRoot');
    fields(r).forEach((ta,i)=>{
      ta.placeholder=hint(i);
      hintNode(ta);
      ta.addEventListener('input',()=>validate(r,false));
      ta.addEventListener('blur',()=>validate(r,false));
    });
    r.addEventListener('click',e=>{
      const btn=e.target.closest('button,a');
      if(!btn||!/บันทึก|save|ส่ง|submit/i.test(text(btn)))return;
      if(!validate(r,true)){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    validate(r,false);
  }
  function toast(msg){
    let t=$('.uxqDebriefToast');if(t)t.remove();
    t=document.createElement('div');t.className='uxqDebriefToast';t.textContent=msg;document.body.appendChild(t);
    setTimeout(()=>t.remove(),2800);
  }
  function style(){
    if($('#uxq-debrief-quality-style'))return;
    const s=document.createElement('style');s.id='uxq-debrief-quality-style';
    s.textContent=`
      .uxqDebriefQualityHint{margin:7px 0 10px;padding:9px 11px;border-radius:10px;background:rgba(255,209,102,.08);color:#ffd98a;font-weight:800;font-size:.86rem;line-height:1.45}
      .uxqDebriefQualityHint[data-ok="1"]{background:rgba(76,226,159,.09);color:#8ff5c2}
      .uxqDebriefQualityRoot textarea[data-quality-ok="0"]{border-color:rgba(255,209,102,.75)!important;box-shadow:0 0 0 2px rgba(255,209,102,.10)!important}
      .uxqDebriefQualityRoot textarea[data-quality-ok="1"]{border-color:rgba(76,226,159,.7)!important;box-shadow:0 0 0 2px rgba(76,226,159,.08)!important}
      .uxqDebriefQualityRoot button[data-quality-blocked="1"]{opacity:.48;cursor:not-allowed}
      .uxqDebriefValidationSummary{margin:12px 0 16px;padding:13px 15px;border:1px solid rgba(255,209,102,.45);border-radius:14px;background:rgba(255,209,102,.07);color:#eef4ff}
      .uxqDebriefValidationSummary[data-complete="1"]{border-color:rgba(76,226,159,.55);background:rgba(76,226,159,.08)}
      .uxqDebriefValidationTitle{font-weight:950;font-size:1rem;margin-bottom:7px;color:#ffd98a}
      .uxqDebriefValidationSummary[data-complete="1"] .uxqDebriefValidationTitle{color:#8ff5c2}
      .uxqDebriefValidationSummary ul{margin:0;padding-left:20px;display:grid;gap:4px;font-size:.88rem;line-height:1.4}
      .uxqDebriefValidationSummary li[data-ok="1"]{color:#b9f8d8}
      .uxqDebriefValidationSummary li[data-ok="0"]{color:#ffe4a8}
      .uxqDebriefToast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;background:rgba(8,18,45,.97);border:1px solid rgba(255,209,102,.5);border-radius:16px;color:#fff;padding:12px 14px;font-weight:900;max-width:min(92vw,640px);box-shadow:0 18px 60px rgba(0,0,0,.35)}
    `;
    document.head.appendChild(s);
  }
  let t=0;
  function schedule(){clearTimeout(t);t=setTimeout(()=>{style();apply();},160);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();