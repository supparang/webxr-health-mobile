/* CSAI2601 UX Quest • Near-Miss Distractors v2
 * Makes distractors plausible AND unique inside the same round.
 * It never overwrites the correct option and avoids duplicate visible labels.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function round(){const m=text($('.hud .meter b')).match(/^(\d+)\s*\/\s*\d+/);return m?Number(m[1]):1;}
  function isCorrect(btn){return /^c\d+/i.test(String(btn?.dataset?.choice||''));}
  function norm(s){return text(s).toLowerCase().replace(/[\s•:;,.!?()\-–—]+/g,'');}
  const generic=[
    ['แก้ส่วนที่เห็นง่ายก่อน แล้วค่อยเก็บผล','ใกล้เคียง แต่ยังไม่ยืนยัน root cause'],
    ['เพิ่มคำอธิบายให้ผู้ใช้ทุกจุด','ดูปลอดภัย แต่อาจเพิ่ม cognitive load'],
    ['เลือกวิธีที่ทีมทำได้เร็วที่สุด','เร็ว แต่ evidence อาจยังไม่พอ'],
    ['ใช้ความเห็นส่วนใหญ่ตัดสินแนวทาง','มีเสียงผู้ใช้ แต่เสี่ยง preference bias'],
    ['ทำหน้าจอให้สวยและเป็นระบบขึ้น','ดีด้านภาพ แต่ยังไม่พิสูจน์ task success'],
    ['ลดขั้นตอนทั้งหมดให้สั้นที่สุด','เร็วขึ้น แต่ recovery อาจหาย'],
    ['ย้ายข้อมูลรองไปท้ายหน้าเสมอ','ลด clutter แต่ context อาจหาย'],
    ['ใช้ pattern เดิมซ้ำเพื่อความสม่ำเสมอ','consistent แต่ไม่แน่ว่าตอบ context']
  ];
  const pools={
    W1:[['แก้จุดที่เห็นชัดก่อน แล้วค่อยวัด task','ใกล้เคียงแต่ยังอาจไม่ใช่ friction หลัก'],['เพิ่มคำอธิบายตรงจุด action แล้วดูผล','ดูดีแต่ต้องระวังว่าอาจเพิ่มภาระอ่าน'],['ปรับปุ่มและสถานะพร้อมกันในรอบเดียว','เหมือนครบแต่ยังไม่แยกว่าอะไรคือสาเหตุหลัก'],['เปลี่ยนสีปุ่มให้เด่นขึ้นก่อน','แก้ visual แต่ยังไม่รู้ว่าช่วย task จริงไหม'],['เพิ่ม tutorial ก่อนเริ่มใช้งาน','ช่วยบางคน แต่ไม่แก้ปัญหาใน flow']],
    W2:[['สัมภาษณ์ stakeholder แล้วเริ่ม prototype รอบเร็ว','ใกล้เคียง แต่ยังเสี่ยงขาดผู้ใช้จริง'],['เก็บ log การใช้งานก่อนถามเหตุผลผู้ใช้','มีหลักฐานบางส่วนแต่ยังไม่รู้ motivation'],['ทดสอบ prototype กับผู้ใช้หลังทีมเลือก solution','มี test แต่เริ่มช้าเกิน evidence-first'],['ใช้แบบสอบถามถามความชอบหน้าจอ','ได้ข้อมูลเร็ว แต่ไม่ใช่ behavior evidence'],['สรุปจากเคสตัวอย่างของระบบอื่น','เป็น benchmark แต่ไม่ใช่ผู้ใช้ของเรา']],
    W3:[['ลดจำนวนข้อมูลบนหน้าโดยยังไม่แก้ feedback','เหมือนลด load แต่ยังไม่แก้ signal หลัก'],['ใช้คำง่ายขึ้นแต่ไม่เปลี่ยน flow','ช่วย mental model บางส่วน แต่ task อาจยังติด'],['เพิ่มไอคอนช่วยจำโดยไม่เพิ่มข้อความสถานะ','ใกล้เคียง แต่ feedback อาจยังไม่พอ'],['ทำ animation ให้เห็นชัดขึ้น','ดึง attention ได้ แต่ไม่แก้ decision หลัก'],['ซ่อนตัวเลือกยากไว้หลังเมนูเพิ่ม','ลดสิ่งรบกวน แต่อาจทำให้หาไม่เจอ']],
    W4:[['ถามผู้ใช้ว่าชอบขั้นตอนไหนที่สุด','มีเสียงผู้ใช้แต่ยังเป็น preference'],['สังเกต task สั้น ๆ โดยไม่ถามเหตุผลหลังทำ','มี evidence แต่ยังตีความไม่ครบ'],['ถามผู้ใช้กลุ่มเดียวแล้วสรุป persona ทันที','เริ่มถูกทางแต่ sample ยังแคบ'],['ให้ทีมเดา pain point จากประสบการณ์','เร็ว แต่ไม่ใช่ user evidence'],['ถามคำถามนำเพื่อยืนยันสมมติฐาน','ได้คำตอบไว แต่ bias สูง']],
    W5:[['เขียน HMW จาก solution ที่ทีมอยากทำ','ดูเป็น HMW แต่ล็อกคำตอบเร็วไป'],['ใช้ insight เดียวแล้วข้าม root cause','เร็วแต่ chain ยังไม่แน่น'],['เขียน problem กว้างเพื่อให้ใช้ได้หลาย case','ยืดหยุ่นแต่ไม่เฉพาะเจาะจง'],['ตั้ง concept ก่อนนิยาม problem','จับต้องได้ แต่กลับด้าน design process'],['ใช้คำว่า improve experience แบบกว้าง ๆ','ฟังดูดีแต่ทดสอบยาก']],
    W6:[['จัดเมนูตามหน่วยงานแต่เพิ่ม search ให้ช่วย','ใกล้เคียง แต่ IA ยังไม่ตรง mental model'],['ทำ happy path ให้สั้นที่สุดแต่ไม่มี recovery','เร็วแต่หลุดเมื่อผู้ใช้ทำผิด'],['รวม error path ไว้ท้าย flow ทั้งหมด','มี error handling แต่ช่วยไม่ทันจุดติด'],['เพิ่มปุ่มย้อนกลับทุกหน้าแทนแก้ flow','ช่วยกลับได้ แต่ไม่ลด bottleneck'],['ซ่อนขั้นตอนรองไว้หลังเมนูเพิ่มเติม','ดูสะอาด แต่ task อาจหาย']],
    W7:[['ทำ CTA ใหญ่สุดทุกหน้าเหมือนกัน','เด่นแต่ไม่สัมพันธ์กับ context เสมอไป'],['ใช้ card layout ทั้งหมดเพื่อลดความซับซ้อน','เป็นระบบแต่ hierarchy อาจแบนเกินไป'],['ย้ายข้อมูลรองไปท้ายหน้าโดยไม่บอกสถานะ','ลด clutter แต่ผู้ใช้อาจขาด context'],['ทำทุกปุ่มสีเดียวกันเพื่อความเรียบร้อย','consistent แต่ priority หาย'],['ใช้ภาพใหญ่ช่วยนำสายตาก่อน CTA','ดึงสายตา แต่อาจแย่ง task หลัก']],
    W8:[['แก้ wireframe ก่อนเพราะเห็นภาพชัดสุด','จับต้องได้แต่ chain อาจยังผิด'],['แก้ persona และ flow พร้อมกันโดยไม่ระบุ evidence','เหมือนครบแต่ตรวจผลยาก'],['ทำ revision ตาม comment ล่าสุดก่อน','เร็วแต่ priority อาจไม่ตรง task impact'],['เพิ่ม rationale หลังออกแบบเสร็จ','มีคำอธิบาย แต่ evidence chain ยังย้อนกลับ'],['เลือกแก้ส่วนที่ทำง่ายที่สุดก่อน','คืบหน้าไวแต่ไม่จำเป็นต้องสำคัญที่สุด']],
    W9:[['รวม component ตามสีที่เหมือนกัน','ดูเป็นระบบแต่ไม่ตรง role/state'],['เพิ่ม variant เพื่อรองรับทุกกรณี','ยืดหยุ่นแต่ทำให้ system บวม'],['ตั้งชื่อ component ตามหน้าที่ใช้ล่าสุด','จำง่ายเฉพาะทีม แต่ scale ยาก'],['ใช้ screenshot เป็น style guide','เห็นภาพแต่ reuse ยาก'],['แยก component ทุกหน้าจอ','ลดการชนกันแต่เสีย consistency']],
    W10:[['ย่อ desktop ให้พอดีมือถือก่อน','เห็นครบแต่ใช้งาน/แตะยาก'],['แก้ contrast เฉพาะปุ่มหลัก','ดีบางส่วนแต่ a11y ยังไม่ครบ'],['ใช้ breakpoint ตามรุ่นมือถือยอดนิยม','เริ่มได้แต่ไม่ตอบ content จริง'],['ซ่อนคอลัมน์ที่ล้นโดยไม่บอกผู้ใช้','พอดีจอแต่ข้อมูลหาย'],['เพิ่ม zoom instruction ให้ผู้ใช้','แก้ปลายทาง ไม่ใช่ responsive design']],
    W11:[['ใช้สีสถานะให้สวยและเข้ากับ brand','ดีด้านภาพ แต่ meaning อาจสับสน'],['เพิ่ม font size เฉพาะหัวข้อใหญ่','ช่วยบางส่วนแต่ hierarchy ยังไม่ครบ'],['เพิ่ม spacing ทุกส่วนเท่ากัน','ดูโล่งแต่ไม่แบ่งกลุ่มความหมาย'],['ใช้สีแดงกับทุกสิ่งที่ต้องการเน้น','เด่นแต่ทำให้สถานะ error สับสน'],['ใช้ฟอนต์หลายแบบเพื่อแยกส่วน','แยกได้แต่ consistency ลดลง']],
    W12:[['เพิ่ม toast สำเร็จหลัง action ทุกครั้ง','มี feedback แต่ไม่พอสำหรับ error/recovery'],['disabled ปุ่มตอนส่งแต่ไม่บอกเหตุผล','กันกดซ้ำได้ แต่ผู้ใช้อาจกังวล'],['เขียน error สั้นมากเพื่อไม่รบกวน','กระชับแต่แก้ปัญหาไม่ได้'],['รีโหลดหน้าเมื่อเกิด error','เริ่มใหม่ได้ แต่ข้อมูลผู้ใช้อาจหาย'],['ใช้ spinner อย่างเดียวตอนรอผล','เห็นว่ารอ แต่ไม่รู้สถานะ/next step']],
    W13:[['เชื่อมเฉพาะ happy path ให้ลื่นก่อน','ทดสอบได้บางส่วนแต่ error path หาย'],['ทำ prototype เหมือนจริงด้วยภาพละเอียด','ดูดีแต่ click path อาจไม่ครบ'],['ให้ผู้ทดสอบอธิบายสิ่งที่คิดว่าจะเกิด','มี insight แต่ยังไม่ใช่ interactive proof'],['ข้าม empty/error state เพื่อประหยัดเวลา','เร็วแต่ validation ไม่ครอบ'],['ใช้ slide แทน prototype clickable','อธิบายได้แต่ทดสอบ behavior ยาก']],
    W14:[['แก้ finding ที่ผู้ใช้บ่นเสียงดังที่สุด','ฟังผู้ใช้ แต่ severity ต้องดู task impact'],['เลือก fix ที่ทำได้เร็วเพื่อ retest ทันที','เร็วแต่ไม่แน่ว่าแก้ root cause'],['ใช้ค่าเฉลี่ยเวลาอย่างเดียวจัด severity','มี metric แต่ยังไม่ครอบ task failure'],['แก้จุดที่ทีมเห็นว่าสวยน้อยที่สุด','ปรับภาพแต่ไม่อิง evidence'],['นับจำนวน comment แทนผลต่อ task','มี signal แต่ severity อาจผิด']],
    W15:[['เริ่ม portfolio ด้วย final UI ที่ดีที่สุด','น่าสนใจ แต่ evidence chain อาจหาย'],['เล่า process ครบทุกขั้นแบบยาว','ละเอียดแต่กรรมการอาจไม่เห็น decision หลัก'],['ใช้คำชมผู้ใช้เป็น proof หลัก','มีเสียงผู้ใช้ แต่ไม่เท่า task evidence'],['โชว์หน้าจอเยอะที่สุดเพื่อให้ดูครบ','เยอะแต่ story อาจกระจัดกระจาย'],['สรุปผลแบบ general reflection','ดีแต่ไม่ป้องกัน design decision']],
    B1:[['แก้ UI และวัดความชอบหลังปรับ','ใกล้เคียงแต่ยังไม่ครบ HCD/Psychology'],['ใช้ feedback หลายจุดเพื่อแก้ friction','ดีบางส่วนแต่ต้องโยง task proof'],['ถามผู้ใช้แล้วเลือก solution ที่นิยมสุด','มีผู้ใช้แต่ยังเสี่ยง preference bias'],['ทำให้หน้าจอสวยขึ้นก่อนวัดผล','ดูดีแต่ไม่ใช่ UX proof'],['ตอบเฉพาะ HCD โดยไม่ดู psychology','มีผู้ใช้แต่ chain ยังไม่ครบ']],
    B2:[['ทำ wireframe ใหม่ก่อนย้อนแก้ problem','จับต้องได้แต่ chain กลับด้าน'],['จัด flow ให้สั้นโดยไม่ระบุ error path','เร็วแต่ไม่ทนต่อสถานการณ์ติดขัด'],['ใช้ HMW เดียวครอบทุก persona','ง่ายแต่ problem อาจกว้างเกิน'],['ปรับ CTA โดยไม่เชื่อมกับ persona','ดีบางจุดแต่ chain หลวม'],['แก้ navigation ตามเมนูเดิมขององค์กร','คุ้นทีมแต่ไม่ใช่ user mental model']],
    B3:[['ทำ component ให้เหมือนกันก่อนค่อยดู a11y','ดีด้าน consistency แต่ยังไม่ครบระบบ'],['แก้ mobile layout โดยคง component เดิม','เร็วแต่ touch/focus อาจยังติด'],['ใช้ design token ใหม่โดยไม่ทดสอบ task','เป็นระบบแต่ยังไม่มี evidence'],['ใช้สี brand ทุก state เท่ากัน','สวยแต่ status meaning หาย'],['เพิ่ม variant ใหม่ทุกปัญหา','ครอบคลุมแต่ system บวม']],
    B4:[['ทำ prototype ให้คลิกครบ happy path ก่อน','ดีแต่ validation ยังไม่ครบ error/recovery'],['จัด severity จากจำนวน comment ของผู้ใช้','มี signal แต่ต้องดู task impact'],['fix แล้วโชว์ before/after โดยไม่ retest','เห็นภาพ แต่ proof ยังไม่แข็งแรง'],['แก้ทุก finding พร้อมกันก่อนทดสอบ','ดูครบแต่ไม่รู้ fix ใดได้ผล'],['ใช้ความพึงพอใจเป็นตัววัดหลัก','มีมุมมองผู้ใช้แต่ task proof ยังไม่พอ']]
  };
  function candidates(){return (pools[node()]||[]).concat(generic);}
  function chooseUnique(used,seed,offset){const list=candidates(); for(let k=0;k<list.length;k++){const item=list[(h(seed)+offset+k)%list.length]; const key=norm(item[0]); if(!used.has(key)){used.add(key); return item;}} const fallback=[`ตัวลวงเฉพาะรอบ ${offset+1}`,'ยังใกล้เคียง แต่หลักฐานไม่ครบ']; used.add(norm(fallback[0])); return fallback;}
  function run(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const buttons=$$('.question > .options .option[data-choice]'); if(buttons.length<4)return;
    const seed=[node(),round(),text($('.top .pill')),text($('.case h1'))].join('|');
    const mark=`${seed}|${buttons.map(b=>b.dataset.choice).join(',')}`;
    if(q.dataset.nearMissV2Mark===mark)return;
    const used=new Set();
    buttons.forEach(btn=>{ if(isCorrect(btn)) used.add(norm($('b',btn)?.textContent||btn.textContent)); });
    buttons.forEach((btn,i)=>{
      if(isCorrect(btn))return;
      const item=chooseUnique(used,seed,i);
      const b=$('b',btn); const span=$('span',btn);
      if(b)b.textContent=item[0];
      if(span)span.textContent=item[1];
      btn.dataset.nearMissV2='1';
    });
    q.dataset.nearMissV2Mark=mark;
  }
  let t=0; function schedule(){clearTimeout(t); t=setTimeout(run,45);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
