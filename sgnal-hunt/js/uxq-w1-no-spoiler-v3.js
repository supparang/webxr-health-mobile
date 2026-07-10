/* CSAI2601 UX Quest • W1 No-Spoiler v3
 * Scope: W1 only.
 * Removes correctness-leaking helper text from option and reason cards.
 * Makes all visible microcopy neutral, so students must decide from scenario evidence.
 * Visual-text only: preserves data-choice, data-reason, score, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'').toUpperCase();
  if(node()!=='W1')return;
  const round=()=>{const m=tx($('.hud .meter b')).match(/(\d+)\s*\/\s*\d+/);return m?Math.max(1,Math.min(5,Number(m[1]))):1};
  const stageNames=['Friction Hunt','User Goal Match','Impact Lens','Fix Decision','Proof Plan'];
  const banks=[
    {
      h:'เลือกหลักฐานที่ชี้ friction หลัก ไม่ใช่แค่ความเห็นหรือความชอบ',
      hint:'อ่านสถานการณ์ แล้วเลือกหลักฐานที่อธิบายจุดสะดุดของผู้ใช้ได้ดีที่สุด',
      ok:['สถานะสำคัญไม่ชัดในจุดที่ผู้ใช้ต้องตัดสินใจต่อ','ข้อมูลที่ใช้ตัดสินใจกระจัดกระจายจน task หลักสะดุด','ผู้ใช้หยุดอยู่ที่ขั้นเลือก เพราะไม่เห็นสัญญาณว่าควรไปทางไหน','ข้อความบนหน้าจอไม่ตอบคำถามหลักก่อนผู้ใช้กด action'],
      bad:['ข้อมูลเยอะขึ้นแต่ยังไม่ช่วยให้ผู้ใช้ตัดสินใจในขั้นนั้น','หน้าดูเด่นขึ้นแต่ยังไม่ตอบว่าทำไมผู้ใช้ไปต่อไม่ได้','คำอธิบายเพิ่มขึ้นแต่ยังไม่โยงกับจุดที่ task สะดุด','เมนูครบขึ้นแต่ยังไม่บอกสถานะที่ใช้ตัดสินใจจริง']
    },
    {
      h:'เลือก goal ที่ผู้ใช้ต้องทำให้สำเร็จ ไม่ใช่สิ่งที่ทีมอยากโชว์',
      hint:'goal ที่ดีต้องเป็นผลลัพธ์ของผู้ใช้ในสถานการณ์นี้ ไม่ใช่รายการฟีเจอร์',
      ok:['ผู้ใช้ต้องเลือกทางที่ใช้ได้จริงโดยไม่ต้องเดาสถานะ','ผู้ใช้ต้องทำรายการหลักให้จบด้วยข้อมูลที่จำเป็นพอดี','ผู้ใช้ต้องเห็นเงื่อนไขสำคัญก่อนเลือก action ถัดไป','ผู้ใช้ต้องเข้าใจว่าควรเริ่มจากตัวเลือกใดในบริบทนี้'],
      bad:['ผู้ใช้ต้องเห็นข้อมูลครบทุกหมวดก่อนจึงค่อยตัดสินใจ','ผู้ใช้ต้องอ่านรายละเอียดทั้งหมดเพื่อให้มั่นใจทุกจุด','ผู้ใช้ต้องเห็นหน้าที่ดูครบถ้วนก่อนเริ่มทำรายการ','ผู้ใช้ต้องเลือกตามลำดับที่ทีมจัดไว้ในหน้าแรก']
    },
    {
      h:'แยก UI, UX และ feedback จากผลกระทบต่อ task ให้ชัด',
      hint:'ตอบจากผลต่อการทำ task ไม่ใช่ดูจากตำแหน่งหรือความสวยของหน้าอย่างเดียว',
      ok:['ปัญหาอยู่ที่ task สะดุด เพราะหน้าจอไม่ช่วยให้ตัดสินใจต่อ','feedback ไม่พอ ทำให้ผู้ใช้ไม่รู้สถานะหรือขั้นถัดไปหลังเลือก','การจัดวางทำให้ข้อมูลสำคัญไม่ถูกมองเห็นในจังหวะที่ต้องใช้','ต้องแยกอาการบนหน้าออกจากผลลัพธ์ที่ผู้ใช้ทำไม่สำเร็จ'],
      bad:['จัดเป็น UI ทั้งหมดเพราะทุกอย่างเกิดบนหน้าจอที่ผู้ใช้เห็น','จัดเป็น UX ทั้งหมดโดยไม่ต้องแยกสาเหตุย่อยของปัญหา','เพิ่มข้อความก่อน เพราะข้อมูลอาจยังไม่ละเอียดพอสำหรับทุกคน','ถือว่าเป็นปัญหาผู้ใช้ไม่อ่านเองถ้ายังทำรายการไม่จบ']
    },
    {
      h:'เลือก fix ที่ลด friction โดยตรง และยังพิสูจน์ผลได้',
      hint:'fix ที่ดีต้องผูกกับจุดติดขัดของรอบนี้ และทดสอบผลได้หลังปรับ',
      ok:['วางสถานะสำคัญให้อยู่ใกล้ action ที่ผู้ใช้ต้องเลือก','แสดงผลหลังเลือกให้ชัดว่าทำต่อได้หรือควรแก้จุดใด','ลดข้อมูลรองในจังหวะตัดสินใจ แต่ยังคงข้อมูลจำเป็นไว้','จัดลำดับข้อมูลใหม่ให้คำตอบสำคัญมาก่อนปุ่มหลัก'],
      bad:['เพิ่มคำอธิบายยาวขึ้นก่อน เพื่อให้ผู้ใช้อ่านครบทุกเงื่อนไข','ทำปุ่มให้เด่นขึ้นโดยยังไม่เปลี่ยนสถานะหรือ feedback','เปลี่ยนภาพและไอคอนให้ดูชัดขึ้นก่อนทดสอบ flow เดิม','ซ่อนข้อมูลหลายส่วนให้หน้าโล่งขึ้น แม้ยังไม่รู้ว่าข้อมูลใดจำเป็น']
    },
    {
      h:'เลือก proof ที่วัดจากพฤติกรรม ไม่ใช่ความชอบอย่างเดียว',
      hint:'proof ที่ดีต้องบอกได้ว่าหลังแก้แล้วผู้ใช้ทำ task สำเร็จขึ้นจริงหรือไม่',
      ok:['ให้ผู้ใช้ทำ task เดิม แล้ววัด success เวลา error และ next step','เปรียบเทียบก่อน/หลังจากพฤติกรรมจริงในสถานการณ์เดียวกัน','ตรวจว่าผู้ใช้เห็นข้อมูลสำคัญก่อนกด และเลือก action ได้ถูกขึ้น','เก็บหลักฐานว่าผู้ใช้ทำรายการจบโดยไม่ต้องขอความช่วยเหลือ'],
      bad:['ถามว่าชอบ mockup ใหม่มากกว่าเดิมหรือไม่หลังดูหน้าจอ','ให้ทีมประเมินว่าหน้าใหม่ชัดขึ้นพอสำหรับผู้ใช้หรือยัง','นับจำนวนคนเข้าใช้งานหน้าแรกหลังปรับสีและ icon','ดูว่าหน้าใหม่มีข้อมูลครบขึ้นหรือไม่ โดยไม่ให้ทำ task']
    }
  ];
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  function reasonOk(el){return /-0$/.test(String(el?.dataset?.reason||''));}
  function hash(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function pick(arr,seed,i,used){for(let k=0;k<arr.length;k++){const v=arr[(hash(seed)+i+k)%arr.length];if(!used.has(v)){used.add(v);return v;}}return arr[i%arr.length];}
  function title(el){return $('b,strong',el);}
  function neutralSub(el){let s=$('small[data-w1-neutral-sub]',el);if(!s){s=document.createElement('small');s.setAttribute('data-w1-neutral-sub','1');el.appendChild(s);}s.textContent='ตรวจจาก scenario, user goal และผลต่อ task ก่อนเลือก';return s;}
  function neutralReasonSub(el){let s=$('small[data-w1-neutral-reason-sub]',el);if(!s){s=document.createElement('small');s.setAttribute('data-w1-neutral-reason-sub','1');el.appendChild(s);}s.textContent='พิจารณาว่าเหตุผลโยง evidence → decision → outcome ได้หรือไม่';return s;}
  function cleanSubs(el){$$('small,span,p',el).forEach(x=>{if(x.matches('[data-w1-neutral-sub],[data-w1-neutral-reason-sub]'))return;if(/uxqMiniLane|uxqDragLane/.test(x.className||''))return;x.hidden=true;x.style.display='none';});}
  function applyQ(){const q=$('.question');if(!q||$('.verify')||$('.feedback'))return;const r=round();const bank=banks[r-1]||banks[0];const cards=$$('.question > .options .option[data-choice],.uxqMiniCard,.uxqDragCard');if(!cards.length)return;const seed=[r,tx($('.case h1')),tx($('.case p:last-child')),cards.map(c=>c.dataset.choice||tx(c)).join('|')].join('|');if(q.dataset.w1NoSpoilerMark===seed)return;const h=$('.question h1,.question h2');if(h)h.textContent=`ข้อ ${r}: ${bank.h}`;const p=$('.question .prompt,.question .instruction');if(p)p.textContent=bank.hint;const used=new Set();cards.forEach((c,i)=>{const b=title(c);if(!b)return;b.textContent=pick(isCorrect(c)?bank.ok:bank.bad,seed,i,used);c.dataset.w1NoSpoiler='1';cleanSubs(c);neutralSub(c);});let badge=$('.uxqW1NoSpoilerBadge',q);if(!badge){badge=document.createElement('div');badge.className='uxqW1NoSpoilerBadge';const a=q.querySelector('.uxqW1ContentBalanceBadge,.uxqTwoColumnHardLockBadge,.uxqW1StageSpecificBadge');if(a)a.insertAdjacentElement('afterend',badge);else q.insertBefore(badge,q.firstChild);}badge.textContent=`✅ W1 no-spoiler • ${stageNames[r-1]}`;q.dataset.w1NoSpoilerMark=seed;}
  function applyR(){const v=$('.verify');if(!v)return;const r=round();const opts=$$('.verify .option',v);if(!opts.length)return;const seed=[r,opts.map(o=>o.dataset.reason||tx(o)).join('|')].join('|');if(v.dataset.w1NoSpoilerReasonMark===seed)return;const okText=['เหตุผลนี้เชื่อมหลักฐานกับผลต่อ task ได้ตรงประเด็น','เหตุผลนี้อธิบาย decision point จากสถานการณ์ได้ชัด','เหตุผลนี้ใช้ evidence มากกว่าความเห็นส่วนตัว','เหตุผลนี้บอกผลลัพธ์ที่ควรวัดหลังตัดสินใจได้'];const trapText=['เหตุผลนี้ยังเน้นภาพรวม แต่ไม่ชี้ผลต่อ task ให้ชัด','เหตุผลนี้ยังเป็นข้อสันนิษฐานที่ต้องมี evidence เพิ่ม','เหตุผลนี้ยังตอบจากความชอบ มากกว่าพฤติกรรมผู้ใช้','เหตุผลนี้ยังไม่แยกสาเหตุจากอาการบนหน้าจอ'];const used=new Set();opts.forEach((o,i)=>{const b=title(o);if(!b)return;b.textContent=pick(reasonOk(o)?okText:trapText,seed,i,used);o.dataset.w1NoSpoilerReason='1';cleanSubs(o);neutralReasonSub(o);});const h=$('h3',v);if(h)h.textContent=`ตรวจเหตุผล • W1 • ${stageNames[r-1]}`;const p=$('p',v);if(p)p.textContent='เลือกเหตุผลที่อธิบายคำตอบจากหลักฐานของสถานการณ์ได้ดีที่สุด';v.dataset.w1NoSpoilerReasonMark=seed;}
  function style(){if($('#uxq-w1-no-spoiler-style'))return;const s=document.createElement('style');s.id='uxq-w1-no-spoiler-style';s.textContent=`.uxqW1ContentBalanceBadge{display:none!important}.uxqW1NoSpoilerBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(255,190,105,.12);border:1px solid rgba(255,190,105,.5);color:#ffe4b8;font-weight:900;font-size:.72rem}.question .option[data-w1-no-spoiler="1"] small[data-w1-neutral-sub],.verify .option[data-w1-no-spoiler-reason="1"] small[data-w1-neutral-reason-sub]{display:block!important;color:#aebed8!important;font-size:.82rem!important;line-height:1.35!important;margin-top:auto!important}.question .option[data-w1-no-spoiler="1"] b,.question .option[data-w1-no-spoiler="1"] strong{font-size:1rem!important;line-height:1.34!important}`;document.head.appendChild(s);}
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();applyQ();applyR();},45)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
