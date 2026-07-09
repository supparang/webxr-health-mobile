/* CSAI2601 UX Quest • Ultimate Cleanup v2
 * Scope: W1-W15 + B1-B4.
 * Last visual cleanup after Ultimate Guard v1.
 * Fixes old subtitles leaking, repetitive W1 wording, and heavy reason-card text.
 * Visual-text only: does not alter data-choice, data-reason, score, strict gate, or sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const q=()=>new URLSearchParams(location.search||'');
  const node=()=>String(q().get('node')||q().get('id')||'W1').toUpperCase();
  const n=node();
  if(!/^(W([1-9]|1[0-5])|B[1-4])$/.test(n))return;
  const A=['A','B','C','D'];
  const ok={
    W1:['หลักฐานชี้ว่า task หลักสะดุด','friction กระทบ user goal โดยตรง','พฤติกรรมผู้ใช้พิสูจน์ปัญหาได้','จุดติดขัดทำให้ไปต่อไม่ได้','ปัญหานี้วัดผลจาก task success ได้','สัญญาณนี้โยงกับการตัดสินใจของผู้ใช้'],
    W2:['เริ่มจาก evidence ก่อนออกแบบ','แยก assumption ออกจาก user data','ทดสอบสมมติฐานก่อนเลือก solution','ใช้พฤติกรรมผู้ใช้ยืนยันปัญหา','เก็บข้อมูลที่ตอบคำถามวิจัยได้','ตรวจ need ก่อนสร้าง prototype'],
    W3:['ลดภาระจำของผู้ใช้','feedback บอกสถานะหลัง action','หน้าจอตรงกับ mental model','ลดความกำกวมของ next step','ช่วยให้ตัดสินใจโดยไม่ต้องเดา','ลด cognitive load ตอนทำ task'],
    W4:['คำถามไม่ชี้นำและวัดพฤติกรรม','สังเกต pain point ระหว่าง task','เชื่อม clue กับ persona need','แยก opinion ออกจาก behavior','เก็บหลักฐานจากบริบทจริง','ตรวจ bias ก่อนสรุป insight'],
    W5:['problem statement โยง root cause','HMW เปิดหลายแนวทางทดสอบ','concept ต่อจาก insight ที่วัดได้','ไม่ล็อก solution เร็วเกินไป','นิยามปัญหาให้พิสูจน์ได้','เลือกกรอบที่นำไปทดลองได้'],
    W6:['flow เดินตาม goal ของผู้ใช้','มี recovery path เมื่อทำผิด','next step ชัดหลัง action','ลดทางตันระหว่าง task','ลำดับขั้นไม่ขัด mental model','ผู้ใช้กลับเข้าสู่ flow ได้'],
    W7:['priority ตอบ task สำคัญก่อน','ข้อมูลหลักอยู่ใกล้ CTA','hierarchy ช่วยตัดสินใจก่อนกด','mobile touch target ลดการแตะผิด','layout รองรับ content hierarchy','ลดสิ่งรบกวนก่อน action'],
    W8:['evidence chain ไม่หลุด','mismatch ถูกแยกให้แก้ตรงจุด','revision พิสูจน์ผลได้','critique จัดตาม task impact','blueprint โยง problem กับ artifact','แก้ gap ใน rationale ก่อน'],
    W9:['state ของ component ครบ','naming ใช้ pattern เดียวกัน','rule reuse ได้หลายหน้า','ลด inconsistency ของระบบ','component รองรับ error/empty state','system rule ช่วยทีมขยายงานได้'],
    W10:['breakpoint รักษา task หลัก','label และ contrast เข้าถึงได้','touch target กดได้บนมือถือ','responsive ไม่ซ่อน action สำคัญ','a11y ช่วยอ่านและนำทาง','mobile flow ลดการซูมและแตะผิด'],
    W11:['visual hierarchy นำ task','contrast รองรับการอ่าน','spacing แยกกลุ่มข้อมูล','typography ช่วยสแกนเนื้อหา','สีบอกสถานะโดยไม่หลอกตา','ลด visual noise รอบ action'],
    W12:['feedback ชี้ next step','prevention ลด error ก่อนเกิด','microcopy ช่วย recovery','state บอกว่าระบบกำลังทำอะไร','error message มีทางแก้','interaction ลดความลังเล'],
    W13:['prototype เดิน task ได้ครบ','link ไม่เกิด dead end','error path ทดสอบได้','interaction เชื่อมตาม flow จริง','happy path และ recovery พร้อม','จุดทดสอบตอบคำถามวิจัย'],
    W14:['severity อิง task impact','fix ต้อง retest ได้','finding มาจาก evidence','จัดลำดับตาม impact/frequency','วัด before-after หลังแก้','แยก opinion ออกจาก usability issue'],
    W15:['story ต่อจาก problem ถึง result','evidence gap ถูกปิดก่อน defense','decision ป้องกันด้วย test result','portfolio เรียงตาม argument','แสดง limitation และ iteration','หลักฐานรองรับ design choice'],
    B1:['เชื่อม friction กับ HCD evidence','ใช้ psychology ป้องกันคำตอบ','fix พิสูจน์ task ได้','ตอบครบ problem-evidence-proof'],
    B2:['chain persona → problem → flow ชัด','wireframe ป้องกันด้วย evidence','flow มี recovery path','layout ไม่หลุดจาก user goal'],
    B3:['component state ครบทั้งระบบ','responsive และ a11y ไปด้วยกัน','visual rule reuse ได้','interface system ลด inconsistency'],
    B4:['severity มาจาก usability evidence','fix มี retest plan','iteration พิสูจน์ด้วย result','prototype รองรับ finding และ recovery']
  };
  const bad={
    W1:['เพิ่มความสวยโดยไม่แตะ task','เพิ่มคำอธิบายแต่ไม่แก้ root cause','แก้หลายจุดพร้อมกันจนวัดไม่ได้','ถามความชอบแทนดูพฤติกรรม','เลือกเรื่องที่ทีมทำง่ายก่อน','มอง UI เป็นปัญหาทั้งหมด'],
    W2:['เริ่ม solution ก่อน evidence','ใช้ความเห็นทีมแทน user data','สรุป assumption เป็น fact','ถามว่าชอบไหมก่อนดู task','เลือก benchmark โดยไม่ดู context','prototype ก่อนรู้ need จริง'],
    W3:['animation สวยแต่ feedback ไม่ชัด','ซ่อนข้อมูลจนผู้ใช้เดาเพิ่ม','ใช้ icon แทนข้อความทั้งหมด','หน้าโล่งขึ้นแต่ task ยังสับสน','เพิ่มสีโดยไม่ลด cognitive load','บอกสถานะช้าเกินหลัง action'],
    W4:['ถามนำให้ตอบตามทีมคิด','ใช้ sample แคบเกินสรุป persona','เน้น preference มากกว่า behavior','ดูคำตอบเดียวแล้วสรุปทั้งหมด','เก็บข้อมูลไม่โยงคำถามวิจัย','ข้ามการสังเกต task จริง'],
    W5:['HMW ซ่อน solution ที่เลือกไว้','problem กว้างจนวัดไม่ได้','concept มาก่อน root cause','แก้ปลายเหตุแทน insight','ใช้คำสวยแต่ทดสอบไม่ได้','เลือกกรอบที่พิสูจน์ยาก'],
    W6:['จัด flow ตามโครงสร้างทีม','path สั้นแต่ไม่มี recovery','ซ่อนขั้นตอนจนผู้ใช้หลง','ลดคลิกแต่เพิ่มความเสี่ยง','ไม่มี next step หลัง action','ออกแบบ happy path อย่างเดียว'],
    W7:['CTA ใหญ่สุดเสมอ','ภาพใหญ่กลบข้อมูลตัดสินใจ','ซ่อนข้อมูลรองจน context หาย','ทุกอย่างเด่นเท่ากัน','layout สวยแต่ไม่ช่วย task','mobile ต้องซูมหรือแตะยาก'],
    W8:['เพิ่ม section แต่ chain ยังหลุด','revision ไม่ตอบ mismatch','critique รวมกันจน priority หาย','เลือกแบบที่ทีมเล่าง่าย','rationale ขาด evidence','blueprint สวยแต่ไม่ตอบ problem'],
    W9:['เปลี่ยนสีแต่ state ไม่ครบ','component เฉพาะหน้า reuse ไม่ได้','ตั้งชื่อจากภาษาทีมเท่านั้น','pattern แตกเมื่อเพิ่มหน้า','ไม่มี rule สำหรับ error state','system สวยแต่ไม่ consistent'],
    W10:['ย่อทุกอย่างให้พอดีจอ','ซ่อนข้อมูลสำคัญบนมือถือ','ใช้สีแทน label','contrast อ่านยาก','touch target เล็กเกิน','responsive ตัด action สำคัญ'],
    W11:['ใช้สีเยอะจน priority หาย','ฟอนต์หลายแบบเกินจำเป็น','ทุกหัวข้อเด่นเท่ากัน','spacing สวยแต่กลุ่มไม่ชัด','contrast ต่ำแต่ภาพดูดี','ตกแต่งมากกว่าช่วยอ่าน'],
    W12:['แจ้ง error แต่ไม่บอกวิธีแก้','คำเตือนยาวจนไม่อ่าน','animation แทน feedback ที่มีความหมาย','ไม่มี recovery action','state ไม่บอก next step','ป้องกัน error หลังเกิดแล้ว'],
    W13:['เพิ่มหน้าจอแต่ link ขาด','demo เฉพาะ happy path','ตัด error path เพื่อเร็ว','prototype ดูครบแต่ task เดินไม่ได้','มี dead end ใน flow','interaction ไม่ตอบคำถาม test'],
    W14:['แก้ที่ง่ายก่อนแม้ impact ต่ำ','นับคนบ่นโดยไม่ดู task','fix มาจากความชอบทีม','ไม่มี retest หลังแก้','finding เป็น opinion ลอย ๆ','severity ไม่อิง impact'],
    W15:['โชว์ final เยอะแต่ evidence หาย','เล่าแต่ success ไม่พูด limitation','เรียงตามไฟล์ไม่ใช่ argument','defense ด้วยความสวย','ไม่ปิด evidence gap','ผล test ไม่โยง decision'],
    B1:['สวยขึ้นแต่ไม่พิสูจน์ UX','preference ไม่แทน task evidence','ทำง่ายแต่ไม่แก้ friction','ขาด psychology ในเหตุผล'],
    B2:['wireframe-first แล้วหาเหตุผลทีหลัง','short flow แต่ไม่มี recovery','HMW กว้างจน layout ไม่ชัด','persona-problem chain หลุด'],
    B3:['component สวยแต่ state ไม่ครบ','responsive โดยตัด context','a11y ใช้สีแทน label','system rule reuse ไม่ได้'],
    B4:['severity ไม่อิง task impact','fix ไม่มี retest','prototype ไม่รองรับ error path','iteration ไม่มี evidence']
  };
  function hash(s){let x=0;String(s).split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function round(){const m=tx($('.hud .meter b')).match(/(\d+)/);return m?Number(m[1]):1;}
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  function pick(list,seed,i,used){for(let k=0;k<list.length;k++){const v=list[(hash(seed)+i+k)%list.length];if(!used.has(v)){used.add(v);return v;}}return list[i%list.length];}
  function cards(){return $$('.question > .options .option[data-choice],.uxqMiniCard,.uxqDragCard');}
  function title(card){return $('b,strong',card);}
  function cleanOld(card){
    $$('small,span',card).forEach(el=>{
      if(el.matches('[data-uxq-ultimate-choice],[data-uxq-ultimate-reason],[data-uxq-clean-sub]'))return;
      if(/uxqMiniLane|uxqDragLane/.test(el.className||''))return;
      el.hidden=true; el.style.display='none';
    });
  }
  function ensure(card){let sm=$('small[data-uxq-clean-sub]',card);if(!sm){sm=document.createElement('small');sm.dataset.uxqCleanSub='1';card.appendChild(sm);}return sm;}
  function applyChoices(){const qn=$('.question');if(!qn||$('.verify')||$('.feedback'))return;const cs=cards();if(!cs.length)return;const seed=[n,round(),tx($('.case h1')),tx($('.case p:last-child')),cs.map(c=>c.dataset.choice||tx(c)).join('|')].join('|');if(qn.dataset.ultimateCleanupMark===seed)return;const used=new Set();cs.forEach((c,i)=>{const b=title(c);if(!b)return;const list=isCorrect(c)?(ok[n]||ok.W1):(bad[n]||bad.W1);b.textContent=pick(list,seed,i,used);c.dataset.ultimateCleanup='1';c.setAttribute('data-choice-tag',A[i]||String(i+1));cleanOld(c);ensure(c).textContent=isCorrect(c)?'หลักฐานของรอบนี้รองรับคำตอบนี้':'ยังใกล้เคียง แต่หลักฐานของรอบนี้ไม่พอ';});let badge=$('.uxqUltimateCleanupBadge',qn);if(!badge){badge=document.createElement('div');badge.className='uxqUltimateCleanupBadge';const a=qn.querySelector('.uxqUltimateGuardBadge,.uxqAdvancedQualityBadge,.uxqFoundationQualityBadge');if(a)a.insertAdjacentElement('afterend',badge);else qn.insertBefore(badge,qn.firstChild);}badge.textContent=`✅ ${n} clean v2 • varied cards`;qn.dataset.ultimateCleanupMark=seed;}
  function style(){if($('#uxq-ultimate-cleanup-style'))return;const s=document.createElement('style');s.id='uxq-ultimate-cleanup-style';s.textContent=`.uxqUltimateCleanupBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 12px;border-radius:999px;background:rgba(113,245,194,.10);border:1px solid rgba(113,245,194,.35);color:#baffdf;font-weight:900;font-size:.73rem}.question .option[data-ultimate-cleanup="1"],.uxqMiniCard[data-ultimate-cleanup="1"],.uxqDragCard[data-ultimate-cleanup="1"]{min-height:142px!important;max-height:none!important;height:auto!important;overflow:visible!important;padding:14px 15px!important;border-radius:18px!important;display:flex!important;flex-direction:column!important;gap:10px!important}.question .option[data-ultimate-cleanup="1"]:before{content:attr(data-choice-tag)!important}.question .option[data-ultimate-cleanup="1"] b,.question .option[data-ultimate-cleanup="1"] strong,.uxqMiniCard[data-ultimate-cleanup="1"] strong,.uxqDragCard[data-ultimate-cleanup="1"] b{font-size:1.02rem!important;line-height:1.34!important;white-space:normal!important;overflow-wrap:break-word!important}.question small[data-uxq-clean-sub]{font-size:.86rem!important;line-height:1.38!important;color:#b8cbed!important;margin-top:auto!important}.question [hidden]{display:none!important}@media(min-width:960px){.question .options{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@media(max-width:679px){.question .options{grid-template-columns:1fr!important}.question .option[data-ultimate-cleanup="1"]{min-height:0!important}}`;document.head.appendChild(s);}
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();applyChoices();},120);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
