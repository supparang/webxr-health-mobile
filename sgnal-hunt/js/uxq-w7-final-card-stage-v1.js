/* CSAI2601 UX Quest • W7 Final Card Stage v1
 * Last visual pass for W7 main choice cards only.
 * Fixes visible cards after all other layers: stage-specific titles + stage-specific subtitles.
 * Round 1 visual priority, Round 2 layout, Round 3 CTA, Round 4 mobile, Round 5 hierarchy trap.
 * Does not change data-choice or correctness.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||'W1').toUpperCase();
  if(node()!=='W7')return;
  const letters=['A','B','C','D'];
  function roundNo(){const m=text($('.hud .meter b')).match(/(\d+)\s*\/\s*\d+/);return m?Number(m[1]):1;}
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  const STAGE={
    1:{badge:'visual priority',ok:[['วางข้อมูลตัดสินใจก่อน CTA','ช่วยให้ผู้ใช้รู้สถานะก่อนกดเริ่ม'],['เน้นสถานะสำคัญเหนือข้อมูลรอง','ทำให้เห็นสิ่งที่ต้องจัดการก่อน'],['จัดลำดับตามผลต่อ task หลัก','priority มาจาก goal ไม่ใช่ความสวย']],near:[['ใช้ภาพนำสายตาก่อนรายละเอียด','ดึงดูดได้ แต่ข้อมูลตัดสินใจอาจช้าลง'],['ทำปุ่มทุกหน้าให้เด่นเท่ากัน','consistent แต่ priority ของหน้านี้จะหาย'],['แยกข้อมูลรองให้เด่นเท่าข้อมูลหลัก','ครบถ้วน แต่ทำให้ลำดับภาพสับสน']]},
    2:{badge:'layout decision',ok:[['จัด card ให้เทียบสถานะได้เร็ว','layout รองรับการเปรียบเทียบข้อมูลหลัก'],['วาง filter ใกล้รายการผลลัพธ์','ลดการย้อนกลับไปแก้เงื่อนไขค้นหา'],['ใช้ grid แสดงสถานะและ action พร้อมกัน','ผู้ใช้เลือกได้โดยไม่เปิดหลายหน้า']],near:[['จัดทุกอย่างเป็น list ยาวหน้าเดียว','ง่ายต่อการทำ แต่เทียบข้อมูลได้ช้าลง'],['แยก filter ไปหน้าตั้งค่าอีกหน้า','หน้าหลักโล่งขึ้น แต่ flow ค้นหาขาดช่วง'],['วางคำแนะนำยาวไว้เหนือรายการ','อธิบายครบ แต่เบียด content หลัก']]},
    3:{badge:'primary CTA',ok:[['วาง CTA หลังข้อมูลจำเป็น','ผู้ใช้มีหลักฐานก่อนตัดสินใจกด'],['ใช้ CTA เดียวที่ตรงกับ task ปัจจุบัน','ลดการลังเลระหว่างหลาย action'],['ให้ CTA อยู่ใกล้สถานะพร้อมใช้งาน','action เชื่อมกับ context บนหน้าจอ']],near:[['เพิ่มปุ่มรองหลายปุ่มข้าง CTA','มีทางเลือกมากขึ้น แต่ focus ลดลง'],['ให้ภาพใหญ่เป็นจุดนำก่อนปุ่ม','ดึงสายตา แต่ไม่บอก action หลัก'],['ย้ายข้อมูลเงื่อนไขไปท้ายหน้า','หน้าโล่งขึ้น แต่กดก่อนรู้ข้อมูลสำคัญ']]},
    4:{badge:'mobile layout',ok:[['จัด card mobile ให้เห็นสถานะกับ CTA พร้อมกัน','ลดการเลื่อนกลับไปกลับมาบนจอเล็ก'],['ทำ filter chips ก่อนรายการผลลัพธ์','ปรับเงื่อนไขได้เร็วโดยไม่ซูม'],['ขยาย touch target เฉพาะ action หลัก','แตะง่ายขึ้นโดยไม่ทำให้ hierarchy หาย']],near:[['ใช้ภาพใหญ่เต็มจอบนมือถือ','ดูเด่น แต่ดันข้อมูลตัดสินใจลงล่าง'],['ซ่อนรายละเอียดทั้งหมดหลังปุ่มเพิ่ม','หน้าโล่ง แต่ผู้ใช้ต้องแตะเพิ่มบ่อย'],['ทำปุ่มทุกใบให้สูงเท่ากัน','แตะง่ายขึ้นบางส่วน แต่ priority ยังไม่ชัด']]},
    5:{badge:'hierarchy trap',ok:[['อย่าให้ CTA ใหญ่กลบเงื่อนไขสำคัญ','สิ่งเด่นต้องช่วยตัดสินใจ ไม่ใช่แค่ดึงสายตา'],['รักษา context ที่จำเป็นไว้ใกล้ action','ผู้ใช้ไม่ควรกดก่อนเข้าใจเงื่อนไข'],['แยกความเด่นออกจากความสำคัญต่อ task','ใหญ่สุดไม่จำเป็นต้องสำคัญสุด']],near:[['ขยาย CTA ให้เด่นกว่าทุกอย่าง','เป็นกับดักถ้ากลบข้อมูลก่อนตัดสินใจ'],['ซ่อนข้อมูลรองทั้งหมดไว้ท้ายหน้า','ดูสะอาด แต่ทำให้หลักฐานก่อนกดหาย'],['ใช้ภาพใหญ่ก่อนข้อมูลเงื่อนไข','ดึงดูดได้ แต่ยังไม่ช่วยเลือก action']]} 
  };
  function stage(){return STAGE[Math.max(1,Math.min(5,roundNo()))]||STAGE[1];}
  function pick(arr,seed,i,used){
    for(let k=0;k<arr.length;k++){
      const p=arr[(h(seed)+i+k)%arr.length]; const key=(p[0]+'|'+p[1]).toLowerCase();
      if(!used.has(key)){used.add(key);return p;}
    }
    return arr[i%arr.length];
  }
  function pairFor(source,i,used){
    const st=stage(); const seed=[roundNo(),text($('.top .pill')),text($('.case h1')),text($('.case p:last-child')),source?.dataset?.choice||'',i].join('|');
    return pick(isCorrect(source)?st.ok:st.near,seed,i,used);
  }
  function optionTargets(){return $$('.question > .options .option[data-choice]');}
  function visibleCards(){return $$('.uxqMiniCard,.uxqDragCard');}
  function writeOption(btn,i,used){
    const p=pairFor(btn,i,used);
    btn.dataset.w7FinalCardStage='1';
    btn.setAttribute('data-choice-tag',letters[i]||String(i+1));
    btn.setAttribute('data-mechanic-label',letters[i]||String(i+1));
    const b=$('b',btn); const spans=$$('span',btn).filter(x=>!x.classList.contains('uxqMiniLane')&&!x.classList.contains('uxqDragLane'));
    if(b)b.textContent=p[0];
    if(spans.length)spans[spans.length-1].textContent=p[1];
  }
  function writeCard(card,i,source,used){
    const p=pairFor(source||card,i,used);
    card.dataset.w7FinalCardStage='1';
    const lane=$('.uxqMiniLane,.uxqDragLane',card); const head=$('strong,b',card); const small=$('small',card); const spans=$$('span',card).filter(x=>!x.classList.contains('uxqMiniLane')&&!x.classList.contains('uxqDragLane'));
    if(lane)lane.textContent=letters[i]||String(i+1);
    if(head)head.textContent=p[0];
    if(small)small.textContent=p[1];
    else if(spans.length)spans[spans.length-1].textContent=p[1];
  }
  function badge(q){
    let b=$('.uxqW7StageBadge',q);
    if(!b){b=document.createElement('div');b.className='uxqW7StageBadge'; const anchor=q.querySelector('.uxqReadableBadge,.student-ready-note,.uxqChallengeHud,.uxqAdaptiveBar'); if(anchor)anchor.insertAdjacentElement('afterend',b); else q.insertBefore(b,q.firstChild);}
    b.textContent=`✅ W7 ${stage().badge}: การ์ดและเหตุผลย่อยตรงกับรอบนี้`;
  }
  function style(){
    if($('#uxq-w7-final-card-style'))return;
    const s=document.createElement('style');s.id='uxq-w7-final-card-style';s.textContent=`
      .uxqW7StageBadge{display:inline-flex;width:max-content;max-width:100%;border:1px solid rgba(121,237,165,.38);border-radius:999px;background:rgba(121,237,165,.08);color:#afffd1;padding:6px 9px;font-weight:900;font-size:.78rem;margin:6px 0 8px}
      .question .option[data-w7-final-card-stage="1"],.uxqMiniCard[data-w7-final-card-stage="1"],.uxqDragCard[data-w7-final-card-stage="1"]{min-height:146px!important;max-height:168px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important;transform:none!important;will-change:auto!important}
      .question .option[data-w7-final-card-stage="1"]:before{content:attr(data-choice-tag)!important}.question .option[data-w7-final-card-stage="1"] b,.uxqMiniCard[data-w7-final-card-stage="1"] strong,.uxqDragCard[data-w7-final-card-stage="1"] b{font-size:1.03rem!important;line-height:1.3!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.7em!important;max-height:2.7em!important}.question .option[data-w7-final-card-stage="1"] span,.uxqMiniCard[data-w7-final-card-stage="1"] small,.uxqDragCard[data-w7-final-card-stage="1"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.8em!important;max-height:2.8em!important;line-height:1.35!important;color:#b9c8e4!important}`;
    document.head.appendChild(s);
  }
  function mark(){return [roundNo(),text($('.top .pill')),text($('.hud .meter b')),optionTargets().map(x=>x.dataset.choice).join(','),visibleCards().length].join('|');}
  let last='';
  function apply(){
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const opts=optionTargets(); const cards=visibleCards(); if(opts.length+cards.length===0)return;
    const m=mark(); if(last===m&&q.dataset.w7FinalStageApplied==='1')return;
    style(); const used=new Set(); opts.forEach((btn,i)=>writeOption(btn,i,used)); const usedCard=new Set(); cards.forEach((card,i)=>writeCard(card,i,opts[i],usedCard)); badge(q); q.dataset.w7FinalStageApplied='1'; last=m;
  }
  let t=0; function schedule(){clearTimeout(t); t=setTimeout(apply,180);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule(); new MutationObserver(()=>{if(mark()!==last)schedule();}).observe(document.documentElement,{childList:true,subtree:true});
})();
