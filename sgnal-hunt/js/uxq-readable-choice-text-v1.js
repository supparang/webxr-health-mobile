/* CSAI2601 UX Quest • Readable Choice Text v1
 * Final choice text layer that keeps choices meaningful but not answer-leaking.
 * Labels are neutral A/B/C/D. Titles are short UX actions. No P1/P2/TRAP/CHECK/debug words.
 * It rewrites visible text only; data-choice stays untouched for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const letters=['A','B','C','D'];
  const bad=/ตัวลวง|TRAP|trap|decoy|distractor|PRIORITY\s*[123]|P[123]\b|CHECK\b|แนวทาง\s+[A-D]|พิจารณาแนวทาง/i;
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  const bank={
    W1:{ok:['ชี้ friction ที่ทำให้ task สะดุด','โยงปัญหากับ user goal','เลือกหลักฐานที่วัด task ได้'],near:['ปรับ visual ให้เด่นขึ้นก่อน','เพิ่มคำอธิบายทุกจุดในหน้า','ลดข้อมูลโดยยังไม่ดู task'],sub:'ดูว่าอะไรทำให้ผู้ใช้ทำงานต่อไม่ได้'},
    W2:{ok:['เก็บ evidence ก่อนเริ่ม solution','แยก assumption ออกจากข้อมูลผู้ใช้','ทดสอบสมมติฐานด้วย task สั้น'],near:['ถามความชอบของ stakeholder ก่อน','เริ่ม prototype จากไอเดียทีม','ใช้ benchmark แทนผู้ใช้จริง'],sub:'ดูว่าคำตอบยืนบนหลักฐานผู้ใช้จริงไหม'},
    W3:{ok:['แก้ feedback ให้ตรง mental model','ลด cognitive load ระหว่างตัดสินใจ','ช่วยผู้ใช้รู้สถานะและ next step'],near:['เพิ่มไอคอนโดยไม่แก้ flow','ซ่อนข้อมูลยากไว้ในเมนูเพิ่ม','ทำ animation ให้เด่นขึ้นก่อน'],sub:'ดู mental model, load, feedback และ repair'},
    W4:{ok:['ถามคำถามไม่ชี้นำจากพฤติกรรม','สังเกต task แล้วจับ pain point','โยง clue กับ persona need'],near:['ถามว่าผู้ใช้ชอบแบบไหน','ให้ทีมเดา pain point ก่อน','สรุป persona จากคนเดียวทันที'],sub:'ดูว่าเป็น research evidence ไม่ใช่ preference ล้วน'},
    W5:{ok:['เขียน problem จาก root cause','ทำ HMW ที่ไม่ล็อก solution','ต่อ insight ไป concept ที่ทดสอบได้'],near:['เขียน HMW จาก solution ที่อยากทำ','ใช้ problem กว้างมากเพื่อครอบทุกเคส','ตั้ง concept ก่อนนิยามปัญหา'],sub:'ดู chain insight → root cause → HMW'},
    W6:{ok:['จัด flow ตาม goal ของผู้ใช้','ทำ happy path พร้อมทาง recovery','แสดง next step หลัง action สำคัญ'],near:['จัดเมนูตามโครงสร้างหน่วยงาน','ทำ path สั้นแต่ไม่มีทางแก้พลาด','ซ่อนขั้นตอนรองไว้หลังเมนูเพิ่ม'],sub:'ดูว่า flow ช่วยให้ผู้ใช้ไปต่อได้จริงไหม'},
    W7:{ok:['วางสถานะ เวลา และ CTA ให้เห็นก่อน','เน้น action หลักโดยไม่กลบเงื่อนไข','จัด hierarchy ตาม goal ของหน้านี้'],near:['ทำ CTA ใหญ่เท่ากันทุกหน้า','ย้ายข้อมูลรองทั้งหมดไปท้ายหน้า','ใช้ภาพใหญ่ก่อนข้อมูลสถานะ'],sub:'ดูว่า element ใดช่วยให้ผู้ใช้ตัดสินใจทำ task ก่อน'},
    W8:{ok:['แก้ mismatch ใน evidence chain','ปรับ persona-flow-wireframe ให้เชื่อมกัน','เลือก revision ที่กระทบ task มากสุด'],near:['แก้ wireframe ก่อนเพราะเห็นภาพชัด','ทำ revision ตาม comment ล่าสุดก่อน','เพิ่ม rationale หลังออกแบบเสร็จ'],sub:'ดู chain problem-persona-flow-wireframe'},
    W9:{ok:['กำหนด component state ให้ครบ','ตั้ง naming rule ที่ scale ได้','รวม pattern โดยดู role และ state'],near:['รวม component ตามสีที่เหมือนกัน','เพิ่ม variant ให้ทุกกรณี','ตั้งชื่อตามหน้าจอล่าสุด'],sub:'ดูระบบ component ไม่ใช่แค่หน้าตาเหมือนกัน'},
    W10:{ok:['แก้ mobile layout ตาม task จริง','เพิ่ม focus/touch target ที่ใช้งานได้','ตรวจ contrast และ label สำคัญ'],near:['ย่อ desktop ให้พอดีมือถือ','แก้ contrast เฉพาะปุ่มหลัก','ซ่อนคอลัมน์ที่ล้นจอ'],sub:'ดู responsive และ accessibility พร้อมกัน'},
    W11:{ok:['ใช้สีสื่อสถานะอย่างไม่สับสน','จัด typography hierarchy ให้อ่านเร็ว','คุม contrast ให้ผ่านการอ่านจริง'],near:['ใช้สี brand กับทุกสถานะ','เพิ่ม font size เฉพาะหัวข้อใหญ่','เพิ่ม spacing เท่ากันทุกส่วน'],sub:'ดู visual signal ที่ช่วยการตัดสินใจ'},
    W12:{ok:['เพิ่ม state ที่บอก status ชัด','เขียน microcopy ช่วย recovery','กันกดซ้ำและบอก next step'],near:['ใช้ spinner อย่างเดียวตอนรอ','เขียน error สั้นมากแต่แก้ไม่ได้','reload หน้าเมื่อเกิด error'],sub:'ดู state, feedback, microcopy, recovery'},
    W13:{ok:['เชื่อม prototype ให้ทดสอบ task ได้','เพิ่ม link/state ที่ขาดใน flow','ทำ error path ให้ validate ได้'],near:['เชื่อมเฉพาะ happy path','ทำภาพ prototype ให้เหมือนจริงก่อน','ใช้ slide แทน clickable flow'],sub:'ดูว่า prototype ทดสอบพฤติกรรมจริงได้ไหม'},
    W14:{ok:['จัด severity จาก task impact','เลือก fix ที่พิสูจน์ได้ด้วย retest','ใช้ evidence ก่อนตัดสิน finding'],near:['แก้จุดที่ผู้ใช้บ่นดังที่สุด','เลือก fix ที่ทำเร็วที่สุดก่อน','นับจำนวน comment แทน task impact'],sub:'ดู evidence → severity → fix → retest'},
    W15:{ok:['เล่า evidence ไปสู่ decision','แสดง proof จาก testing ก่อน final UI','ป้องกัน design ด้วย before-after'],near:['เริ่มด้วย final UI ที่สวยที่สุด','เล่า process ยาวทุกขั้น','ใช้คำชมแทน task evidence'],sub:'ดู portfolio story ที่มีหลักฐานป้องกัน'},
    B1:{ok:['เชื่อม UX friction กับ HCD evidence','ใช้ psychology อธิบายปัญหา UI','เสนอ fix พร้อม proof'],near:['วัดความชอบหลังปรับ UI','แก้ visual โดยไม่ทดสอบ task','ถามผู้ใช้แล้วเลือก solution ยอดนิยม'],sub:'บอสนี้ต้องเชื่อม UI/UX + HCD + Psychology'},
    B2:{ok:['ต่อ persona-problem-flow-wireframe ให้ครบ','ป้องกัน wireframe ด้วย evidence chain','แก้ flow พร้อม error path'],near:['ทำ wireframe ก่อนย้อนหา problem','ทำ flow สั้นแต่ไม่มี recovery','ใช้ HMW เดียวครอบทุก persona'],sub:'บอสนี้ดู chain ทั้งระบบ'},
    B3:{ok:['ตัดสินใจแบบ design system','รวม responsive กับ accessibility','คุม state, pattern และ visual meaning'],near:['ทำ component ให้เหมือนกันก่อนดู a11y','ใช้ token ใหม่โดยไม่ test task','เพิ่ม variant ใหม่ทุกปัญหา'],sub:'บอสนี้ดู interface system'},
    B4:{ok:['ใช้ evidence จัด severity','แก้ prototype แล้ว retest task เดิม','ป้องกัน iteration ด้วย before-after'],near:['คลิกครบ happy path ก่อนอย่างเดียว','จัด severity จากจำนวน comment','โชว์ before-after โดยไม่ retest'],sub:'บอสนี้ต้องพิสูจน์ด้วย validation'}
  };
  function cfg(){return bank[node()]||bank.W1;}
  function pick(list,seed,i,used){
    for(let k=0;k<list.length;k++){const s=list[(h(seed)+i+k)%list.length];const key=s.toLowerCase();if(!used.has(key)){used.add(key);return s;}}
    const s=list[i%list.length]||'อ่านสถานการณ์แล้วเลือกจากหลักฐาน';used.add(String(s).toLowerCase());return s;
  }
  function titleFor(el,i,used){
    const c=cfg(); const seed=[node(),text($('.top .pill')),text($('.hud .meter b')),el?.dataset?.choice||'',i].join('|');
    const list=isCorrect(el)?c.ok:c.near;
    return pick(list,seed,i,used);
  }
  function subFor(){return `${cfg().sub} • เลือกจากหลักฐานในสถานการณ์`;}
  function label(i){return letters[i]||String(i+1);}
  function applyOption(btn,i,used){
    btn.dataset.readableChoice='1';
    btn.setAttribute('data-mechanic-label',label(i));
    btn.setAttribute('data-choice-tag',label(i));
    const b=$('b',btn), span=$('span',btn);
    if(b)b.textContent=titleFor(btn,i,used);
    if(span)span.textContent=subFor();
  }
  function applyCard(card,i,source,used){
    card.dataset.readableChoice='1';
    const lane=$('.uxqMiniLane,.uxqDragLane',card), head=$('strong,b',card), small=$('small,span',card);
    if(lane)lane.textContent=label(i);
    if(head)head.textContent=titleFor(source||card,i,used);
    if(small)small.textContent=subFor();
  }
  function style(){
    if($('#uxq-readable-choice-style'))return;
    const s=document.createElement('style');s.id='uxq-readable-choice-style';s.textContent=`
      .question .option[data-readable-choice="1"],.uxqMiniCard[data-readable-choice="1"],.uxqDragCard[data-readable-choice="1"]{transform:none!important;will-change:auto!important;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease!important;min-height:142px!important;max-height:162px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important}
      .question .option[data-readable-choice="1"]:before{content:attr(data-choice-tag)!important;margin-bottom:0!important}.question .option[data-readable-choice="1"] b,.uxqMiniCard[data-readable-choice="1"] strong,.uxqDragCard[data-readable-choice="1"] b{font-size:1.03rem!important;line-height:1.3!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.7em!important;max-height:2.7em!important}.question .option[data-readable-choice="1"] span,.uxqMiniCard[data-readable-choice="1"] small,.uxqDragCard[data-readable-choice="1"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.8em!important;max-height:2.8em!important;line-height:1.35!important;color:#b9c8e4!important}.uxqReadableBadge{display:inline-flex;width:max-content;max-width:100%;border:1px solid rgba(110,231,255,.32);border-radius:999px;background:rgba(110,231,255,.07);color:#bff3ff;padding:6px 9px;font-weight:900;font-size:.78rem;margin:6px 0 8px}`;
    document.head.appendChild(s);
  }
  function mark(){return [node(),text($('.top .pill')),text($('.hud .meter b')),$$('.question > .options .option[data-choice]').map(x=>x.dataset.choice).join(',')].join('|');}
  let last='';
  function apply(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const opts=$$('.question > .options .option[data-choice]');
    const cards=$$('.uxqMiniCard,.uxqDragCard');
    if(opts.length+cards.length===0)return;
    const m=mark()+'|'+opts.length+'|'+cards.length;
    if(last===m && q.dataset.readableChoiceApplied==='1')return;
    style();
    const used=new Set();
    opts.forEach((btn,i)=>applyOption(btn,i,used));
    const usedCards=new Set();
    cards.forEach((card,i)=>applyCard(card,i,opts[i],usedCards));
    if(!q.querySelector('.uxqReadableBadge')){
      const badge=document.createElement('div'); badge.className='uxqReadableBadge'; badge.textContent='✅ ตัวเลือกอ่านรู้เรื่อง: A/B/C/D ไม่มีคำใบ้จาก label';
      const anchor=q.querySelector('.uxqChallengeHud,.uxqAdaptiveBar,.student-ready-note');
      if(anchor)anchor.insertAdjacentElement('afterend',badge);else q.insertBefore(badge,q.firstChild);
    }
    q.dataset.readableChoiceApplied='1'; last=m;
  }
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(apply,160);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(()=>{if(mark()!==last)schedule();}).observe(document.documentElement,{childList:true,subtree:true});
})();
