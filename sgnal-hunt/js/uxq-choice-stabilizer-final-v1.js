/* CSAI2601 UX Quest • Choice Stabilizer Final v1 patched
 * Backward-compatible patch for cached pages that still load this old filename.
 * Keeps choices meaningful, not generic, and prevents answer-leaking labels.
 * data-choice stays untouched for scoring, reason, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const letters=['A','B','C','D'];
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  const bank={
    W7:{ok:['วางสถานะ เวลา และ CTA ให้เห็นก่อน','เน้น action หลักโดยไม่กลบเงื่อนไข','จัด hierarchy ตาม goal ของหน้านี้'],near:['ทำ CTA ใหญ่เท่ากันทุกหน้า','ย้ายข้อมูลรองทั้งหมดไปท้ายหน้า','ใช้ภาพใหญ่ก่อนข้อมูลสถานะ'],sub:'ดูว่า element ใดช่วยให้ผู้ใช้ตัดสินใจทำ task ก่อน'},
    W6:{ok:['จัด flow ตาม goal ของผู้ใช้','ทำ happy path พร้อมทาง recovery','แสดง next step หลัง action สำคัญ'],near:['จัดเมนูตามโครงสร้างหน่วยงาน','ทำ path สั้นแต่ไม่มีทางแก้พลาด','ซ่อนขั้นตอนรองไว้หลังเมนูเพิ่ม'],sub:'ดูว่า flow ช่วยให้ผู้ใช้ไปต่อได้จริงไหม'},
    W14:{ok:['จัด severity จาก task impact','เลือก fix ที่พิสูจน์ได้ด้วย retest','ใช้ evidence ก่อนตัดสิน finding'],near:['แก้จุดที่ผู้ใช้บ่นดังที่สุด','เลือก fix ที่ทำเร็วที่สุดก่อน','นับจำนวน comment แทน task impact'],sub:'ดู evidence → severity → fix → retest'},
    DEFAULT:{ok:['เลือกแนวทางที่โยงกับหลักฐานใน case','ดูผลต่อ user goal ก่อนความสวยงาม','ใช้คำตอบที่พิสูจน์ได้ด้วย task test'],near:['ปรับ visual ให้เด่นขึ้นก่อน','เพิ่มคำอธิบายทุกจุดในหน้า','เลือกวิธีที่ทีมทำได้เร็วที่สุด'],sub:'อ่านสถานการณ์แล้วเลือกจากหลักฐานใน case'}
  };
  function cfg(){return bank[node()]||bank.DEFAULT;}
  function pick(list,seed,i,used){for(let k=0;k<list.length;k++){const s=list[(h(seed)+i+k)%list.length];const key=s.toLowerCase();if(!used.has(key)){used.add(key);return s;}}return list[i%list.length];}
  function titleFor(el,i,used){const c=cfg();const seed=[node(),text($('.top .pill')),text($('.hud .meter b')),el?.dataset?.choice||'',i].join('|');return pick(isCorrect(el)?c.ok:c.near,seed,i,used);}
  function subFor(){return `${cfg().sub} • เลือกจากหลักฐานในสถานการณ์`;}
  function label(i){return letters[i]||String(i+1);}
  function setOption(btn,i,used){btn.dataset.choiceStableFinal='patched';btn.setAttribute('data-mechanic-label',label(i));btn.setAttribute('data-choice-tag',label(i));const b=$('b',btn),span=$('span',btn);if(b)b.textContent=titleFor(btn,i,used);if(span)span.textContent=subFor();}
  function setCard(card,i,source,used){card.dataset.choiceStableFinal='patched';const lane=$('.uxqMiniLane,.uxqDragLane',card),head=$('strong,b',card),small=$('small,span',card);if(lane)lane.textContent=label(i);if(head)head.textContent=titleFor(source||card,i,used);if(small)small.textContent=subFor();}
  function style(){if($('#uxq-choice-stabilizer-final-style'))return;const s=document.createElement('style');s.id='uxq-choice-stabilizer-final-style';s.textContent=`.question .option[data-choice-stable-final="patched"],.uxqMiniCard[data-choice-stable-final="patched"],.uxqDragCard[data-choice-stable-final="patched"]{transform:none!important;will-change:auto!important;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease!important;min-height:142px!important;max-height:162px!important;overflow:hidden!important;display:grid!important;align-content:start!important;gap:8px!important}.question .option[data-choice-stable-final="patched"]:before{content:attr(data-choice-tag)!important;margin-bottom:0!important}.question .option[data-choice-stable-final="patched"] b,.uxqMiniCard[data-choice-stable-final="patched"] strong,.uxqDragCard[data-choice-stable-final="patched"] b{font-size:1.03rem!important;line-height:1.3!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.7em!important;max-height:2.7em!important}.question .option[data-choice-stable-final="patched"] span,.uxqMiniCard[data-choice-stable-final="patched"] small,.uxqDragCard[data-choice-stable-final="patched"] small{display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:2.8em!important;max-height:2.8em!important;line-height:1.35!important;color:#b9c8e4!important}`;document.head.appendChild(s);}
  function mark(){return [node(),text($('.top .pill')),text($('.hud .meter b')),$$('.question > .options .option[data-choice]').map(x=>x.dataset.choice).join(',')].join('|');}
  let last='';
  function apply(){const q=$('.question');if(!q||$('.verify')||$('.feedback'))return;const opts=$$('.question > .options .option[data-choice]');const cards=$$('.uxqMiniCard,.uxqDragCard');if(opts.length+cards.length===0)return;const m=mark()+'|'+opts.length+'|'+cards.length;if(last===m&&q.dataset.choiceStableFinalPatched==='1')return;style();const used=new Set();opts.forEach((btn,i)=>setOption(btn,i,used));const usedCards=new Set();cards.forEach((card,i)=>setCard(card,i,opts[i],usedCards));q.dataset.choiceStableFinalPatched='1';last=m;}
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(apply,120);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();new MutationObserver(()=>{if(mark()!==last)schedule();}).observe(document.documentElement,{childList:true,subtree:true});
})();
