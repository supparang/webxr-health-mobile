/* CSAI2601 UX Quest • Near-Miss Distractors v1
 * Makes wrong choices plausible and challenge-like so students cannot guess from obviously bad distractors.
 * Runs after anti-length bias and keeps data-choice correctness IDs untouched.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const nodeId=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function round(){const m=text($('.hud .meter b')).match(/^(\d+)\s*\/\s*\d+/);return m?Number(m[1]):1;}
  function isCorrect(btn){return /^c\d+/i.test(String(btn?.dataset?.choice||''));}
  function choose(list,seed,i){return list[(h(seed)+i)%list.length];}
  function set(btn,label,sub){const b=$('b',btn);const span=$('span',btn);if(b)b.textContent=label;if(span)span.textContent=sub||'ใกล้เคียง แต่ต้องตรวจว่าหลักฐานพอไหม';}

  const pools={
    W1:[['แก้จุดที่เห็นชัดก่อน แล้วค่อยวัด task','ใกล้เคียงแต่ยังอาจไม่ใช่ friction หลัก'],['เพิ่มคำอธิบายตรงจุด action แล้วดูผล','ดูดีแต่ต้องระวังว่าอาจเพิ่มภาระอ่าน'],['ปรับปุ่มและสถานะพร้อมกันในรอบเดียว','เหมือนครบแต่ยังไม่แยกว่าอะไรคือสาเหตุหลัก']],
    W2:[['สัมภาษณ์ stakeholder แล้วเริ่ม prototype รอบเร็ว','ใกล้เคียง แต่ยังเสี่ยงขาดผู้ใช้จริง'],['เก็บ log การใช้งานก่อนถามเหตุผลผู้ใช้','มีหลักฐานบางส่วนแต่ยังไม่รู้ motivation'],['ทดสอบ prototype กับผู้ใช้หลังทีมเลือก solution','มี test แต่เริ่มช้าเกิน evidence-first']],
    W3:[['ลดจำนวนข้อมูลบนหน้าโดยยังไม่แก้ feedback','เหมือนลด load แต่ยังไม่แก้ signal หลัก'],['ใช้คำง่ายขึ้นแต่ไม่เปลี่ยน flow','ช่วย mental model บางส่วน แต่ task อาจยังติด'],['เพิ่มไอคอนช่วยจำโดยไม่เพิ่มข้อความสถานะ','ใกล้เคียง แต่ feedback อาจยังไม่พอ']],
    W4:[['ถามผู้ใช้ว่าชอบขั้นตอนไหนที่สุด','มีเสียงผู้ใช้แต่ยังเป็น preference'],['สังเกต task สั้น ๆ โดยไม่ถามเหตุผลหลังทำ','มี evidence แต่ยังตีความไม่ครบ'],['ถามผู้ใช้กลุ่มเดียวแล้วสรุป persona ทันที','เริ่มถูกทางแต่ sample ยังแคบ']],
    W5:[['เขียน HMW จาก solution ที่ทีมอยากทำ','ดูเป็น HMW แต่ล็อกคำตอบเร็วไป'],['ใช้ insight เดียวแล้วข้าม root cause','เร็วแต่ chain ยังไม่แน่น'],['เขียน problem กว้างเพื่อให้ใช้ได้หลาย case','ยืดหยุ่นแต่ไม่เฉพาะเจาะจง']],
    W6:[['จัดเมนูตามหน่วยงานแต่เพิ่ม search ให้ช่วย','ใกล้เคียง แต่ IA ยังไม่ตรง mental model'],['ทำ happy path ให้สั้นที่สุดแต่ไม่มี recovery','เร็วแต่หลุดเมื่อผู้ใช้ทำผิด'],['รวม error path ไว้ท้าย flow ทั้งหมด','มี error handling แต่ช่วยไม่ทันจุดติด']],
    W7:[['ทำ CTA ใหญ่สุดทุกหน้าเหมือนกัน','เด่นแต่ไม่สัมพันธ์กับ context เสมอไป'],['ใช้ card layout ทั้งหมดเพื่อลดความซับซ้อน','เป็นระบบแต่ hierarchy อาจแบนเกินไป'],['ย้ายข้อมูลรองไปท้ายหน้าโดยไม่บอกสถานะ','ลด clutter แต่ผู้ใช้อาจขาด context']],
    W8:[['แก้ wireframe ก่อนเพราะเห็นภาพชัดสุด','จับต้องได้แต่ chain อาจยังผิด'],['แก้ persona และ flow พร้อมกันโดยไม่ระบุ evidence','เหมือนครบแต่ตรวจผลยาก'],['ทำ revision ตาม comment ล่าสุดก่อน','เร็วแต่ priority อาจไม่ตรง task impact']],
    W9:[['รวม component ตามสีที่เหมือนกัน','ดูเป็นระบบแต่ไม่ตรง role/state'],['เพิ่ม variant เพื่อรองรับทุกกรณี','ยืดหยุ่นแต่ทำให้ system บวม'],['ตั้งชื่อ component ตามหน้าที่ใช้ล่าสุด','จำง่ายเฉพาะทีม แต่ scale ยาก']],
    W10:[['ย่อ desktop ให้พอดีมือถือก่อน','เห็นครบแต่ใช้งาน/แตะยาก'],['แก้ contrast เฉพาะปุ่มหลัก','ดีบางส่วนแต่ a11y ยังไม่ครบ'],['ใช้ breakpoint ตามรุ่นมือถือยอดนิยม','เริ่มได้แต่ไม่ตอบ content จริง']],
    W11:[['ใช้สีสถานะให้สวยและเข้ากับ brand','ดีด้านภาพ แต่ meaning อาจสับสน'],['เพิ่ม font size เฉพาะหัวข้อใหญ่','ช่วยบางส่วนแต่ hierarchy ยังไม่ครบ'],['เพิ่ม spacing ทุกส่วนเท่ากัน','ดูโล่งแต่ไม่แบ่งกลุ่มความหมาย']],
    W12:[['เพิ่ม toast สำเร็จหลัง action ทุกครั้ง','มี feedback แต่ไม่พอสำหรับ error/recovery'],['disabled ปุ่มตอนส่งแต่ไม่บอกเหตุผล','กันกดซ้ำได้ แต่ผู้ใช้อาจกังวล'],['เขียน error สั้นมากเพื่อไม่รบกวน','กระชับแต่แก้ปัญหาไม่ได้']],
    W13:[['เชื่อมเฉพาะ happy path ให้ลื่นก่อน','ทดสอบได้บางส่วนแต่ error path หาย'],['ทำ prototype เหมือนจริงด้วยภาพละเอียด','ดูดีแต่ click path อาจไม่ครบ'],['ให้ผู้ทดสอบอธิบายสิ่งที่คิดว่าจะเกิด','มี insight แต่ยังไม่ใช่ interactive proof']],
    W14:[['แก้ finding ที่ผู้ใช้บ่นเสียงดังที่สุด','ฟังผู้ใช้ แต่ severity ต้องดู task impact'],['เลือก fix ที่ทำได้เร็วเพื่อ retest ทันที','เร็วแต่ไม่แน่ว่าแก้ root cause'],['ใช้ค่าเฉลี่ยเวลาอย่างเดียวจัด severity','มี metric แต่ยังไม่ครอบ task failure']],
    W15:[['เริ่ม portfolio ด้วย final UI ที่ดีที่สุด','น่าสนใจ แต่ evidence chain อาจหาย'],['เล่า process ครบทุกขั้นแบบยาว','ละเอียดแต่กรรมการอาจไม่เห็น decision หลัก'],['ใช้คำชมผู้ใช้เป็น proof หลัก','มีเสียงผู้ใช้ แต่ไม่เท่า task evidence']],
    B1:[['แก้ UI และวัดความชอบหลังปรับ','ใกล้เคียงแต่ยังไม่ครบ HCD/Psychology'],['ใช้ feedback หลายจุดเพื่อแก้ friction','ดีบางส่วนแต่ต้องโยง task proof'],['ถามผู้ใช้แล้วเลือก solution ที่นิยมสุด','มีผู้ใช้แต่ยังเสี่ยง preference bias']],
    B2:[['ทำ wireframe ใหม่ก่อนย้อนแก้ problem','จับต้องได้แต่ chain กลับด้าน'],['จัด flow ให้สั้นโดยไม่ระบุ error path','เร็วแต่ไม่ทนต่อสถานการณ์ติดขัด'],['ใช้ HMW เดียวครอบทุก persona','ง่ายแต่ problem อาจกว้างเกิน']],
    B3:[['ทำ component ให้เหมือนกันก่อนค่อยดู a11y','ดีด้าน consistency แต่ยังไม่ครบระบบ'],['แก้ mobile layout โดยคง component เดิม','เร็วแต่ touch/focus อาจยังติด'],['ใช้ design token ใหม่โดยไม่ทดสอบ task','เป็นระบบแต่ยังไม่มี evidence']],
    B4:[['ทำ prototype ให้คลิกครบ happy path ก่อน','ดีแต่ validation ยังไม่ครบ error/recovery'],['จัด severity จากจำนวน comment ของผู้ใช้','มี signal แต่ต้องดู task impact'],['fix แล้วโชว์ before/after โดยไม่ retest','เห็นภาพ แต่ proof ยังไม่แข็งแรง']]
  };

  function run(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const buttons=$$('.question > .options .option[data-choice]'); if(buttons.length<4)return;
    const seed=[nodeId(),round(),text($('.top .pill')),text($('.case h1'))].join('|');
    const mark=`${seed}|${buttons.map(b=>b.dataset.choice).join(',')}`;
    if(q.dataset.nearMissMark===mark)return;
    const list=pools[nodeId()]||pools.W1;
    buttons.forEach((btn,i)=>{
      if(isCorrect(btn))return;
      const item=choose(list,seed,i);
      set(btn,item[0],item[1]);
      btn.dataset.nearMiss='1';
    });
    q.dataset.nearMissMark=mark;
  }
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(run,45);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
