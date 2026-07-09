/* CSAI2601 UX Quest • Readable Choice Text v1.1
 * Final choice text layer that keeps choices meaningful but not answer-leaking.
 * W7 has varied, non-repeating, close-call alternatives so three cards do not look like the same distractor pattern.
 * Labels are neutral A/B/C/D. Visible text only; data-choice stays untouched for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const letters=['A','B','C','D'];
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  const bank={
    W1:{ok:[['ชี้ friction ที่ทำให้ task สะดุด','โยงปัญหากับ task หลัก'],['โยงปัญหากับ user goal','ดู goal ที่ผู้ใช้ทำไม่สำเร็จ'],['เลือกหลักฐานที่วัด task ได้','ใช้ proof ไม่ใช่ความรู้สึก']],near:[['ปรับ visual ให้เด่นขึ้นก่อน','ช่วยเห็นชัด แต่ยังไม่รู้ task impact'],['เพิ่มคำอธิบายทุกจุดในหน้า','ช่วยอ่าน แต่เสี่ยงเพิ่ม load'],['ลดข้อมูลโดยยังไม่ดู task','ลด clutter แต่หลักฐานอาจไม่พอ']]},
    W2:{ok:[['เก็บ evidence ก่อนเริ่ม solution','ใช้ข้อมูลผู้ใช้จริงก่อนออกแบบ'],['แยก assumption ออกจากข้อมูลผู้ใช้','กันทีมเดาจากมุมของตนเอง'],['ทดสอบสมมติฐานด้วย task สั้น','พิสูจน์ก่อนลงทุนทำใหญ่']],near:[['ถามความชอบของ stakeholder ก่อน','ได้ทิศเร็ว แต่ไม่ใช่ user evidence'],['เริ่ม prototype จากไอเดียทีม','เร็ว แต่ยังเสี่ยง solution-first'],['ใช้ benchmark แทนผู้ใช้จริง','เทียบได้ แต่ไม่ใช่บริบทของเรา']]},
    W3:{ok:[['แก้ feedback ให้ตรง mental model','ผู้ใช้เห็นสถานะและเข้าใจผลลัพธ์'],['ลด cognitive load ระหว่างตัดสินใจ','ไม่ให้ผู้ใช้จำหรือเดามากเกิน'],['ช่วยผู้ใช้รู้สถานะและ next step','ลดความลังเลหลัง action']],near:[['เพิ่มไอคอนโดยไม่แก้ flow','ช่วยจำ แต่ไม่แก้การตัดสินใจ'],['ซ่อนข้อมูลยากไว้ในเมนูเพิ่ม','ลดหน้าแรก แต่หาไม่เจอได้'],['ทำ animation ให้เด่นขึ้นก่อน','ดึงสายตา แต่ไม่ใช่ feedback เสมอ']]},
    W4:{ok:[['ถามคำถามไม่ชี้นำจากพฤติกรรม','ลด bias จากคำถาม'],['สังเกต task แล้วจับ pain point','เห็นพฤติกรรมจริง'],['โยง clue กับ persona need','แปลข้อมูลเป็น need ที่ใช้ต่อได้']],near:[['ถามว่าผู้ใช้ชอบแบบไหน','ได้ opinion แต่ยังไม่ใช่ behavior'],['ให้ทีมเดา pain point ก่อน','เร็ว แต่ไม่ใช่หลักฐานผู้ใช้'],['สรุป persona จากคนเดียวทันที','มีข้อมูล แต่ sample แคบ']]},
    W5:{ok:[['เขียน problem จาก root cause','ไม่แก้แค่ปลายเหตุ'],['ทำ HMW ที่ไม่ล็อก solution','เปิดทางเลือกการออกแบบ'],['ต่อ insight ไป concept ที่ทดสอบได้','โยงจากหลักฐานไป prototype']],near:[['เขียน HMW จาก solution ที่อยากทำ','เหมือนชัด แต่ล็อกคำตอบเร็ว'],['ใช้ problem กว้างมากเพื่อครอบทุกเคส','ยืดหยุ่น แต่ทดสอบยาก'],['ตั้ง concept ก่อนนิยามปัญหา','จับต้องได้ แต่ process กลับด้าน']]},
    W6:{ok:[['จัด flow ตาม goal ของผู้ใช้','ใช้ mental model เป็นแกน'],['ทำ happy path พร้อมทาง recovery','ไปต่อได้แม้ทำผิด'],['แสดง next step หลัง action สำคัญ','ลดการหยุด/เดาขั้นต่อไป']],near:[['จัดเมนูตามโครงสร้างหน่วยงาน','คุ้นกับทีม แต่ไม่ตรงผู้ใช้เสมอ'],['ทำ path สั้นแต่ไม่มีทางแก้พลาด','เร็ว แต่หลุดเมื่อเกิด error'],['ซ่อนขั้นตอนรองไว้หลังเมนูเพิ่ม','หน้าโล่ง แต่ task อาจหาย']]},
    W7:{ok:[['วาง CTA ใกล้สถานะและเวลา','ช่วยตัดสินใจก่อนเริ่ม task'],['เน้น action หลักโดยไม่กลบเงื่อนไข','เห็นสิ่งต้องทำและข้อจำกัดพร้อมกัน'],['จัด hierarchy ตาม goal ของหน้านี้','ให้สิ่งสำคัญมาก่อนโดยไม่ตัด context'],['วางข้อมูลจำเป็นก่อนปุ่มเริ่ม','ผู้ใช้ตรวจเงื่อนไขแล้วค่อย action'],['แยกข้อมูลรองให้เบาแต่ยังมองเห็น','ลด noise โดยไม่ซ่อนสิ่งจำเป็น']],near:[['ขยาย CTA ให้เด่นกว่าทุกอย่าง','เด่นขึ้น แต่เสี่ยงกลบสถานะสำคัญ'],['ใช้ภาพนำสายตาก่อนรายละเอียด','ช่วยดึงดูด แต่ task อาจช้าลง'],['ย้ายข้อมูลรองทั้งหมดไปท้ายหน้า','หน้าโล่ง แต่ context อาจหาย'],['ทำปุ่มทุกหน้าให้ขนาดเท่ากัน','consistent แต่ไม่ตอบ priority ของหน้านี้'],['วางคำแนะนำยาวไว้เหนือ CTA','อธิบายครบ แต่แย่ง focus จาก action']]},
    W8:{ok:[['แก้ mismatch ใน evidence chain','ทำให้เหตุผลของงานต่อกัน'],['ปรับ persona-flow-wireframe ให้เชื่อมกัน','ลดความหลุดระหว่าง artefact'],['เลือก revision ที่กระทบ task มากสุด','แก้จาก impact ไม่ใช่ความเห็นล่าสุด']],near:[['แก้ wireframe ก่อนเพราะเห็นภาพชัด','จับต้องได้ แต่ chain อาจยังผิด'],['ทำ revision ตาม comment ล่าสุดก่อน','เร็ว แต่อาจไม่ใช่ priority'],['เพิ่ม rationale หลังออกแบบเสร็จ','ช่วยอธิบาย แต่ไม่แก้ evidence gap']]},
    W9:{ok:[['กำหนด component state ให้ครบ','รองรับ default/error/disabled/focus'],['ตั้ง naming rule ที่ scale ได้','ทีมใช้ซ้ำโดยไม่สับสน'],['รวม pattern โดยดู role และ state','ระบบแน่นกว่าแค่หน้าตาเหมือนกัน']],near:[['รวม component ตามสีที่เหมือนกัน','ดู consistent แต่ role อาจต่าง'],['เพิ่ม variant ให้ทุกกรณี','ครอบคลุม แต่ system บวม'],['ตั้งชื่อตามหน้าจอล่าสุด','จำง่ายเฉพาะเคส แต่ scale ยาก']]},
    W10:{ok:[['แก้ mobile layout ตาม task จริง','เริ่มจาก content และ action'],['เพิ่ม focus/touch target ที่ใช้งานได้','แตะและใช้ keyboard ได้ดีขึ้น'],['ตรวจ contrast และ label สำคัญ','อ่านได้และใช้กับ assistive tech ได้']],near:[['ย่อ desktop ให้พอดีมือถือ','เห็นครบ แต่แตะ/อ่านยาก'],['แก้ contrast เฉพาะปุ่มหลัก','ดีบางส่วน แต่ a11y ยังไม่ครบ'],['ซ่อนคอลัมน์ที่ล้นจอ','พอดีจอ แต่ข้อมูลอาจหาย']]},
    W11:{ok:[['ใช้สีสื่อสถานะอย่างไม่สับสน','สีช่วยเข้าใจ ไม่ใช่แค่สวย'],['จัด typography hierarchy ให้อ่านเร็ว','ผู้ใช้สแกนลำดับได้'],['คุม contrast ให้ผ่านการอ่านจริง','อ่านง่ายในหลายสภาพแสง']],near:[['ใช้สี brand กับทุกสถานะ','สวย แต่ meaning อาจหาย'],['เพิ่ม font size เฉพาะหัวข้อใหญ่','เห็นหัวข้อ แต่ hierarchy ยังไม่ครบ'],['เพิ่ม spacing เท่ากันทุกส่วน','ดูโล่ง แต่ไม่แยกกลุ่มความหมาย']]},
    W12:{ok:[['เพิ่ม state ที่บอก status ชัด','ผู้ใช้รู้ว่าระบบกำลังทำอะไร'],['เขียน microcopy ช่วย recovery','รู้ว่าต้องแก้อย่างไร'],['กันกดซ้ำและบอก next step','ลด error หลัง action']],near:[['ใช้ spinner อย่างเดียวตอนรอ','รู้ว่ารอ แต่ไม่รู้ผล/ขั้นถัดไป'],['เขียน error สั้นมากแต่แก้ไม่ได้','ไม่รบกวน แต่ช่วยน้อย'],['reload หน้าเมื่อเกิด error','เริ่มใหม่ได้ แต่ข้อมูลอาจหาย']]},
    W13:{ok:[['เชื่อม prototype ให้ทดสอบ task ได้','ผู้ใช้ลอง flow จริง'],['เพิ่ม link/state ที่ขาดใน flow','ไม่หลุดระหว่างทดสอบ'],['ทำ error path ให้ validate ได้','เห็นพฤติกรรมเมื่อเกิดปัญหา']],near:[['เชื่อมเฉพาะ happy path','ลื่นบางส่วน แต่ไม่ครอบ error'],['ทำภาพ prototype ให้เหมือนจริงก่อน','ดูดี แต่ behavior อาจไม่ครบ'],['ใช้ slide แทน clickable flow','อธิบายได้ แต่ทดสอบยาก']]},
    W14:{ok:[['จัด severity จาก task impact','วัดจากผลต่อการทำงาน'],['เลือก fix ที่พิสูจน์ได้ด้วย retest','แก้แล้วต้องเห็นผล'],['ใช้ evidence ก่อนตัดสิน finding','ไม่เลือกจากเสียงบ่นอย่างเดียว']],near:[['แก้จุดที่ผู้ใช้บ่นดังที่สุด','มี signal แต่ severity อาจผิด'],['เลือก fix ที่ทำเร็วที่สุดก่อน','เร็ว แต่ไม่ใช่ impact สูงเสมอ'],['นับจำนวน comment แทน task impact','มีตัวเลข แต่ตีความไม่พอ']]},
    W15:{ok:[['เล่า evidence ไปสู่ decision','กรรมการเห็นเหตุผลของงาน'],['แสดง proof จาก testing ก่อน final UI','พิสูจน์ ไม่ใช่โชว์อย่างเดียว'],['ป้องกัน design ด้วย before-after','เห็นผลจาก iteration']],near:[['เริ่มด้วย final UI ที่สวยที่สุด','น่าสนใจ แต่ evidence อาจหาย'],['เล่า process ยาวทุกขั้น','ครบ แต่จุดตัดสินใจไม่เด่น'],['ใช้คำชมแทน task evidence','มีเสียงผู้ใช้ แต่ proof ยังอ่อน']]},
    B1:{ok:[['เชื่อม UX friction กับ HCD evidence','ตอบหลายชั้นในเคสเดียว'],['ใช้ psychology อธิบายปัญหา UI','โยง mental model/load/feedback'],['เสนอ fix พร้อม proof','แก้แล้ววัดผลได้']],near:[['วัดความชอบหลังปรับ UI','มีผู้ใช้ แต่ยังไม่ใช่ task proof'],['แก้ visual โดยไม่ทดสอบ task','สวยขึ้น แต่ไม่รู้ว่า UX ดีขึ้น'],['ถามผู้ใช้แล้วเลือก solution ยอดนิยม','ฟังผู้ใช้ แต่ยังเสี่ยง preference bias']]},
    B2:{ok:[['ต่อ persona-problem-flow-wireframe ให้ครบ','chain ไม่หลุด'],['ป้องกัน wireframe ด้วย evidence chain','ไม่ใช่แค่ layout สวย'],['แก้ flow พร้อม error path','รองรับสถานการณ์จริง']],near:[['ทำ wireframe ก่อนย้อนหา problem','จับต้องได้ แต่ chain กลับด้าน'],['ทำ flow สั้นแต่ไม่มี recovery','เร็ว แต่ไม่ทน error'],['ใช้ HMW เดียวครอบทุก persona','ง่าย แต่กว้างเกิน']]},
    B3:{ok:[['ตัดสินใจแบบ design system','มอง component เป็นระบบ'],['รวม responsive กับ accessibility','ใช้ได้จริงหลายอุปกรณ์'],['คุม state, pattern และ visual meaning','ครบทั้ง system และ usability']],near:[['ทำ component ให้เหมือนกันก่อนดู a11y','consistent แต่ยังไม่ครบ usability'],['ใช้ token ใหม่โดยไม่ test task','เป็นระบบ แต่ยังไม่มี proof'],['เพิ่ม variant ใหม่ทุกปัญหา','ครอบคลุม แต่ system บวม']]},
    B4:{ok:[['ใช้ evidence จัด severity','ตัดสินจากผลทดสอบ'],['แก้ prototype แล้ว retest task เดิม','พิสูจน์ iteration'],['ป้องกัน iteration ด้วย before-after','เห็นผลจากการแก้']],near:[['คลิกครบ happy path ก่อนอย่างเดียว','ใช้ได้บาง flow แต่ validation ไม่ครบ'],['จัด severity จากจำนวน comment','มีตัวเลข แต่ไม่ใช่ task impact'],['โชว์ before-after โดยไม่ retest','เห็นภาพ แต่ proof ยังไม่พอ']]}
  };
  function cfg(){return bank[node()]||bank.W1;}
  function pickPair(list,seed,i,used){
    for(let k=0;k<list.length;k++){
      const item=list[(h(seed)+i+k)%list.length];
      const key=(item[0]+'|'+item[1]).toLowerCase();
      if(!used.has(key)){used.add(key);return item;}
    }
    const item=list[i%list.length]||['อ่านสถานการณ์แล้วเลือกจากหลักฐาน','ตรวจหลักฐานก่อนเลือก'];
    used.add((item[0]+'|'+item[1]).toLowerCase());
    return item;
  }
  function pairFor(el,i,used){
    const c=cfg(); const seed=[node(),text($('.top .pill')),text($('.hud .meter b')),el?.dataset?.choice||'',i].join('|');
    return pickPair(isCorrect(el)?c.ok:c.near,seed,i,used);
  }
  function label(i){return letters[i]||String(i+1);}
  function applyOption(btn,i,used){
    btn.dataset.readableChoice='1';
    btn.setAttribute('data-mechanic-label',label(i));
    btn.setAttribute('data-choice-tag',label(i));
    const pair=pairFor(btn,i,used);
    const b=$('b',btn), span=$('span',btn);
    if(b)b.textContent=pair[0];
    if(span)span.textContent=pair[1];
  }
  function applyCard(card,i,source,used){
    card.dataset.readableChoice='1';
    const lane=$('.uxqMiniLane,.uxqDragLane',card), head=$('strong,b',card), small=$('small,span',card);
    const pair=pairFor(source||card,i,used);
    if(lane)lane.textContent=label(i);
    if(head)head.textContent=pair[0];
    if(small)small.textContent=pair[1];
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
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(apply,120);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(()=>{if(mark()!==last)schedule();}).observe(document.documentElement,{childList:true,subtree:true});
})();
