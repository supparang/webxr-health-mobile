/* CSAI2601 UX Quest • Near-Miss Distractors v3
 * Plausible, unique distractors with no student-visible debug wording.
 * Runs once per round after question render. It never touches data-choice.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const bad=/ตัวลวง|trap|decoy|distractor/i;
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function norm(s){return text(s).toLowerCase().replace(/[\s•:;,.!?()\-–—]+/g,'');}
  function isCorrect(btn){return /^c\d+/i.test(String(btn?.dataset?.choice||''));}
  function round(){const m=text($('.hud .meter b')).match(/^(\d+)\s*\/\s*\d+/);return m?Number(m[1]):1;}
  const base={
    W7:[['ทำ CTA ให้เด่นขึ้นตาม goal ของหน้านี้','ใกล้เคียง แต่ต้องดูว่าตรงกับ context ไหม'],['จัดข้อมูลรองให้ไม่บัง task หลัก','ดีบางส่วน แต่ต้องดู hierarchy ทั้งหน้า'],['เน้นปุ่มเริ่มต้นให้ชัดก่อนกราฟรวม','อาจถูกถ้า task หลักคือเริ่มฝึก'],['ย้ายคำแนะนำไปใกล้จุดตัดสินใจ','ช่วย context แต่ต้องไม่แย่ง priority'],['ลด visual noise รอบ action หลัก','ช่วย focus แต่ต้องวัดจาก task']],
    W6:[['ทำเส้นทางหลักให้สั้นและมีสถานะชัด','ใกล้เคียง แต่ต้องดู recovery ด้วย'],['เพิ่มทางย้อนกลับเฉพาะจุดที่ผู้ใช้พลาด','ดีถ้าหลักฐานชี้ว่า error path สำคัญ'],['จัดกลุ่มเมนูตาม goal ของผู้ใช้','ถูกทางถ้า mental model ตรง'],['แสดงขั้นตอนถัดไปหลัง action สำคัญ','ช่วยไม่ให้หลุด flow'],['ลดจำนวนทางเลือกในจุดตัดสินใจ','ช่วยลด load แต่ต้องไม่ซ่อน task สำคัญ']],
    W14:[['จัดลำดับจากผลต่อ task completion','ใกล้เคียงถ้า evidence ชี้ failure'],['แก้ finding ที่ทำให้ผู้ใช้ไปต่อไม่ได้ก่อน','เหมาะเมื่อเป็น blocker'],['เลือก fix ที่ retest ได้ใน task เดิม','ดีถ้าต้องพิสูจน์ผลเร็ว'],['แยก severity จากเสียงบ่นและ task impact','ช่วยตัดสินใจแม่นขึ้น'],['ใช้ before/after metric ยืนยันผลแก้','ดีแต่ต้องมี task เดิมเทียบ']],
    DEFAULT:[['เลือกแนวทางที่โยงกับหลักฐานใน case','ใกล้เคียง แต่ต้องตรวจผลต่อ task'],['ดูผลต่อ user goal ก่อนความสวยงาม','ดีถ้า goal เป็นแกนหลักของโจทย์'],['ใช้คำตอบที่พิสูจน์ได้ด้วย task test','แข็งแรงเมื่อมี metric รองรับ'],['ลดภาระคิดโดยไม่ซ่อนข้อมูลสำคัญ','ดีถ้าผู้ใช้ยังทำ task ต่อได้'],['เลือกสิ่งที่ช่วย next step ของผู้ใช้','เหมาะเมื่อหลักฐานชี้ว่าผู้ใช้ไปต่อไม่ได้'],['ปรับเฉพาะจุดที่กระทบ decision หลัก','ช่วย focus แต่ต้องดู evidence'],['เชื่อม problem กับ solution ให้ชัด','ดีเมื่อ chain ยังหลวม'],['ตรวจว่าแนวทางนี้ validate ได้จริง','ใช้ได้เมื่อมีแผนทดสอบต่อ']]
  };
  function pool(){return (base[node()]||[]).concat(base.DEFAULT);}
  function pick(used,seed,i){const p=pool(); for(let k=0;k<p.length;k++){const item=p[(h(seed)+i+k)%p.length]; if(bad.test(item[0]))continue; const key=norm(item[0]); if(!used.has(key)){used.add(key); return item;}} const fallback=[`พิจารณาแนวทาง ${['A','B','C','D'][i]||i+1}`,'ตรวจหลักฐานในสถานการณ์ก่อนเลือก']; used.add(norm(fallback[0])); return fallback;}
  function run(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const buttons=$$('.question > .options .option[data-choice]'); if(buttons.length<4)return;
    const seed=[node(),round(),text($('.top .pill')),text($('.case h1'))].join('|');
    const mark=`${seed}|${buttons.map(b=>b.dataset.choice).join(',')}`;
    if(q.dataset.nearMissV3Mark===mark)return;
    const used=new Set(); buttons.forEach(btn=>{if(isCorrect(btn))used.add(norm($('b',btn)?.textContent||btn.textContent));});
    buttons.forEach((btn,i)=>{if(isCorrect(btn))return; const item=pick(used,seed,i); const b=$('b',btn), span=$('span',btn); if(b)b.textContent=item[0]; if(span)span.textContent=item[1]; btn.dataset.nearMissV3='1';});
    q.dataset.nearMissV3Mark=mark;
  }
  let t=0; function schedule(){clearTimeout(t);t=setTimeout(run,45);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
