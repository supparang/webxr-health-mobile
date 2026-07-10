/* CSAI2601 UX Quest • W1 Content Balance v2
 * Scope: W1 only.
 * Rewrites W1 visible options/reasons with balanced-length, plausible, evidence-based choices.
 * Goal: reduce guessing from obvious traps, short/long answer bias, or repeated weak distractors.
 * Visual-text only: preserves data-choice, data-reason, score, strict gate, and sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'').toUpperCase();
  if(node()!=='W1')return;
  const letters=['A','B','C','D'];
  const packs=[
    {
      key:'friction', label:'Friction Hunt',
      h:'เลือกหลักฐานที่ชี้ friction หลัก ไม่ใช่แค่ความเห็นหรือความชอบ',
      hint:'มองหาหลักฐานที่ทำให้ผู้ใช้หยุด ตัดสินใจไม่ได้ หรือทำ task ไม่จบ',
      ok:['สถานะของตัวเลือกไม่ชัด จนผู้ใช้ไม่รู้ว่าจะกดต่อได้หรือไม่','ผู้ใช้หยุดที่จุดตัดสินใจ เพราะระบบไม่บอกว่าทางเลือกใดพร้อมใช้งาน','ข้อมูลที่ต้องใช้ตัดสินใจอยู่ไกลจากปุ่ม ทำให้ task หลักสะดุด','สัญญาณบนหน้าจอไม่ตอบคำถามสำคัญก่อนผู้ใช้เลือก action'],
      bad:['เพิ่มคำอธิบายทั่วไปก่อน โดยยังไม่รู้ว่าผู้ใช้ติดตรงจุดใด','เปลี่ยนสีและไอคอนให้เด่นขึ้น แม้ยังไม่รู้ว่าปุ่มใดคือปัญหา','ถามความชอบของผู้ใช้ก่อน โดยยังไม่ดูพฤติกรรมระหว่างทำ task','เพิ่มภาพประกอบบนหน้าแรก แม้หลักฐานไม่ได้ชี้ว่าภาพทำให้ task สะดุด'],
      ro:['เพราะหลักฐานชี้จุดที่ผู้ใช้ตัดสินใจไม่ได้และกระทบ task หลัก','เพราะ friction ต้องอธิบายจาก behavior ไม่ใช่ความชอบของผู้ใช้','เพราะจุดนี้โยงกับ user goal, context และ task success โดยตรง','เพราะถ้าแก้จุดนี้ จะวัดผลจากเวลาที่ค้างและอัตราทำสำเร็จได้'],
      rt:['ยังไม่พอ เพราะเน้นความรู้สึกหรือความสวยมากกว่าพฤติกรรมจริง','ยังไม่พอ เพราะยังไม่ชี้ว่าผู้ใช้ติดที่ขั้นตอนไหนของ task','ยังไม่พอ เพราะเป็นแนวทางแก้ก่อนระบุ friction หลัก','ยังไม่พอ เพราะไม่มีหลักฐานว่าเรื่องนี้ทำให้ task สะดุด']
    },
    {
      key:'goal', label:'User Goal Match',
      h:'เลือก goal ที่ผู้ใช้ต้องทำให้สำเร็จ ไม่ใช่สิ่งที่ทีมอยากแสดง',
      hint:'goal ที่ดีต้องบอกผลลัพธ์ที่ผู้ใช้ต้องได้จาก task นี้',
      ok:['ผู้ใช้ต้องรู้ทางเลือกที่พร้อมใช้งาน เพื่อเลือกต่อได้โดยไม่ต้องเดา','ผู้ใช้ต้องทำรายการหลักให้จบ โดยเห็นข้อมูลสำคัญก่อนกด action','ผู้ใช้ต้องแยกตัวเลือกที่ใช้ได้กับใช้ไม่ได้ ก่อนตัดสินใจในหน้าจอนี้','ผู้ใช้ต้องเข้าใจสถานะปัจจุบันของระบบ ก่อนเลือกขั้นตอนถัดไป'],
      bad:['ผู้ใช้ต้องเห็นทุกเมนูบนหน้าเดียวกัน แม้ไม่เกี่ยวกับการตัดสินใจตอนนี้','ผู้ใช้ต้องอ่านข้อมูลทั้งหมดก่อน แม้บางส่วนไม่ช่วยให้ทำ task จบ','ผู้ใช้ต้องเห็นหน้าที่ดูครบถ้วนก่อน แม้ action หลักยังไม่ชัด','ผู้ใช้ต้องเลือกจากสิ่งที่ทีมจัดไว้ก่อน แม้ยังไม่ตรงกับบริบทของเขา'],
      ro:['เพราะ goal หลักต้องโยงกับผลลัพธ์ที่ผู้ใช้ต้องทำให้สำเร็จ','เพราะ goal ไม่ใช่จำนวนข้อมูลบนหน้า แต่คือการตัดสินใจได้ถูกจังหวะ','เพราะคำตอบนี้ช่วยแยก task need ออกจากสิ่งที่ทีมอยากโชว์','เพราะวัดได้จากการทำรายการสำเร็จและลดการย้อนกลับของผู้ใช้'],
      rt:['ยังไม่พอ เพราะพูดถึงเนื้อหาบนหน้า แต่ไม่ใช่ผลลัพธ์ของผู้ใช้','ยังไม่พอ เพราะเป็นมุมของทีมมากกว่ามุมของผู้ใช้ใน task นี้','ยังไม่พอ เพราะไม่อธิบายว่าผู้ใช้ต้องตัดสินใจอะไรให้สำเร็จ','ยังไม่พอ เพราะ goal ยังไม่เชื่อมกับ context และ action หลัก']
    },
    {
      key:'impact', label:'Impact Lens',
      h:'แยก UI, UX และ feedback จากผลกระทบต่อ task ให้ชัด',
      hint:'อย่าตอบจากหน้าตาอย่างเดียว ให้ดูว่าผู้ใช้ทำ task สำเร็จหรือไม่',
      ok:['เป็น UX issue เพราะสัญญาณบนหน้าไม่ช่วยให้ผู้ใช้ทำ task หลักสำเร็จ','เป็น feedback issue เมื่อระบบไม่บอกสถานะหรือผลลัพธ์หลังผู้ใช้เลือก','เป็น UI issue เฉพาะเมื่อการจัดวางทำให้ผู้ใช้มองไม่เห็นสิ่งที่ต้องใช้','ต้องแยก visual symptom ออกจาก task failure ก่อนเลือกวิธีแก้'],
      bad:['จัดเป็น UI ทั้งหมด เพราะปัญหาปรากฏอยู่บนหน้าจอที่ผู้ใช้เห็น','จัดเป็น UX ทั้งหมด โดยไม่ต้องดูว่า feedback หรือ layout ทำงานผิดตรงไหน','จัดเป็น content issue ทันที เพราะข้อความบนหน้าอาจยังไม่ละเอียดพอ','จัดเป็นปัญหาผู้ใช้ไม่อ่านเอง แม้หลักฐานยังชี้ไปที่ระบบไม่ชัด'],
      ro:['เพราะการแยกประเภทช่วยให้เลือก fix ตรงสาเหตุ ไม่แก้แค่หน้าตา','เพราะ UX วัดจาก task success ส่วน UI/feedback เป็นสาเหตุที่ต้องพิสูจน์','เพราะ feedback ที่ไม่ชัดทำให้ผู้ใช้ไม่รู้สถานะและ next step','เพราะแยกผิดจะทำให้แก้ visual แต่ friction หลักยังอยู่'],
      rt:['ยังไม่พอ เพราะเหมารวมปัญหาโดยไม่แยกสาเหตุจากผลกระทบ','ยังไม่พอ เพราะตอบจากตำแหน่งบนหน้าจอ ไม่ใช่ผลต่อ task','ยังไม่พอ เพราะไม่ได้บอกว่าหลักฐานชี้ UI, UX หรือ feedback อย่างไร','ยังไม่พอ เพราะโยนปัญหาให้ผู้ใช้โดยยังไม่พิสูจน์ระบบ']
    },
    {
      key:'fix', label:'Fix Decision',
      h:'เลือก fix ที่ลด friction โดยตรง และยังพิสูจน์ผลได้',
      hint:'fix ที่ดีต้องจับกับจุดติดขัด ไม่ใช่ทำให้หน้าดูเยอะขึ้นหรือสวยขึ้น',
      ok:['จัดสถานะสำคัญให้อยู่ใกล้ปุ่มหลัก เพื่อให้ผู้ใช้ตัดสินใจก่อนกดได้','แสดง feedback หลังเลือกทันที เพื่อบอกว่าทำต่อได้หรือควรแก้อะไร','แยกตัวเลือกที่พร้อมใช้กับไม่พร้อมใช้ โดยไม่เพิ่มภาระอ่านข้อมูลใหม่','ปรับลำดับข้อมูลให้คำตอบของผู้ใช้อยู่ก่อน action ที่ต้องเลือก'],
      bad:['เพิ่มกล่องคำอธิบายขนาดใหญ่ก่อนปุ่ม แม้ยังไม่ลดขั้นตอนตัดสินใจ','เพิ่ม animation ให้ปุ่มเด่นขึ้น แม้ flow และ feedback ยังเหมือนเดิม','ซ่อนข้อมูลรองทั้งหมดไว้ท้ายหน้า แม้บางข้อมูลจำเป็นต่อการเลือก','เปลี่ยนธีมและ icon ให้ดูใหม่ขึ้น ก่อนพิสูจน์ว่าช่วยลด friction'],
      ro:['เพราะ fix นี้จับกับจุด decision point ที่ทำให้ผู้ใช้ค้าง','เพราะสถานะและ feedback ที่ชัดช่วยให้ผู้ใช้เลือก action ต่อได้','เพราะไม่เพิ่มภาระใหม่ แต่ทำให้ task หลักเดินต่อได้ง่ายขึ้น','เพราะผลของ fix วัดได้จาก task success, error และเวลา'],
      rt:['ยังไม่พอ เพราะทำให้หน้าเด่นขึ้น แต่ยังไม่ลด friction หลัก','ยังไม่พอ เพราะเพิ่มสิ่งใหม่โดยไม่ตอบว่าผู้ใช้ติดตรงไหน','ยังไม่พอ เพราะอาจทำให้ดูโล่งขึ้น แต่ไม่พิสูจน์ว่า task สำเร็จขึ้น','ยังไม่พอ เพราะเป็น redesign กว้างเกินกว่าจะรู้ว่าอะไรทำให้ดีขึ้น']
    },
    {
      key:'proof', label:'Proof Plan',
      h:'เลือก proof ที่วัดจากพฤติกรรม ไม่ใช่ความชอบอย่างเดียว',
      hint:'proof ที่ดีต้องบอกได้ว่าแก้แล้ว task สำเร็จขึ้นจริงหรือไม่',
      ok:['ให้ผู้ใช้ทำ task เดิม แล้ววัด task success, เวลา, error และ next step','เปรียบเทียบก่อนและหลังแก้ด้วยพฤติกรรมที่เห็นได้ระหว่างทำ task','ตรวจว่าผู้ใช้เห็นสถานะสำคัญก่อนกด และเลือก action ได้ถูกต้องขึ้นไหม','เก็บหลักฐานว่าผู้ใช้ทำรายการจบมากขึ้น โดยไม่ต้องขอความช่วยเหลือ'],
      bad:['ถามว่าผู้ใช้ชอบ mockup ใหม่มากกว่าเดิมหรือไม่ โดยไม่ให้ทำ task','ถามทีมออกแบบว่าหน้าใหม่ดูชัดขึ้นหรือไม่ แล้วสรุปว่า UX ดีขึ้น','นับจำนวนคนเข้าหน้าแรกหลังเปลี่ยนสี โดยไม่วัดว่าทำรายการสำเร็จไหม','ดูว่าหน้าใหม่มีข้อมูลครบขึ้นหรือไม่ โดยไม่ทดสอบพฤติกรรมจริง'],
      ro:['เพราะ proof ต้องวัด behavior และ outcome หลังผู้ใช้ทำ task จริง','เพราะ before/after ช่วยพิสูจน์ว่า fix ลด friction ไม่ใช่แค่ดูดีขึ้น','เพราะ task success, เวลา และ error สะท้อน UX มากกว่าความชอบ','เพราะหลักฐานต้องบอกว่าผู้ใช้เข้าใจสถานะและทำต่อได้จริง'],
      rt:['ยังไม่พอ เพราะใช้ opinion แทนพฤติกรรมระหว่างทำ task','ยังไม่พอ เพราะวัดความนิยมของหน้า แต่ไม่วัด task outcome','ยังไม่พอ เพราะทีมประเมินแทนผู้ใช้จริงใน context นี้','ยังไม่พอ เพราะข้อมูลครบขึ้นไม่ได้แปลว่า friction ลดลงเสมอ']
    }
  ];
  function round(){const m=tx($('.hud .meter b')).match(/(\d+)\s*\/\s*\d+/);return m?Math.max(1,Math.min(5,Number(m[1]))):1;}
  function pack(){return packs[round()-1]||packs[0];}
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  function reasonOk(el){return /-0$/.test(String(el?.dataset?.reason||''));}
  function hash(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function pick(arr,seed,i,used){for(let k=0;k<arr.length;k++){const v=arr[(hash(seed)+i+k)%arr.length];if(!used.has(v)){used.add(v);return v;}}return arr[i%arr.length];}
  function title(card){return $('b,strong',card);}
  function sub(card,key){let s=$(`small[data-${key}]`,card);if(!s){s=document.createElement('small');s.setAttribute(`data-${key}`,'1');card.appendChild(s);}return s;}
  function hideNoise(card){$$('small,span',card).forEach(el=>{if(el.matches('[data-w1-balance-sub],[data-w1-balance-reason-sub]'))return;if(/uxqMiniLane|uxqDragLane/.test(el.className||''))return;el.hidden=true;el.style.display='none';});}
  function choices(){return $$('.question > .options .option[data-choice],.uxqMiniCard,.uxqDragCard');}
  function applyQuestion(){const q=$('.question');if(!q||$('.verify')||$('.feedback'))return;const p=pack();const cs=choices();if(!cs.length)return;const seed=[p.key,round(),tx($('.case h1')),tx($('.case p:last-child')),cs.map(c=>c.dataset.choice||tx(c)).join('|')].join('|');if(q.dataset.w1ContentBalanceMark===seed)return;const h=$('.question h1,.question h2'); if(h)h.textContent=`ข้อ ${round()}: ${p.h}`;const pr=$('.question .prompt,.question .instruction'); if(pr)pr.textContent=p.hint;const used=new Set();cs.forEach((c,i)=>{const b=title(c);if(!b)return;b.textContent=pick(isCorrect(c)?p.ok:p.bad,seed,i,used);c.dataset.w1ContentBalance='1';c.setAttribute('data-choice-tag',letters[i]||String(i+1));hideNoise(c);sub(c,'w1-balance-sub').textContent=isCorrect(c)?'หลักฐานของรอบนี้รองรับคำตอบนี้':'ใกล้เคียง แต่ยังไม่ตอบหลักฐานหลักของรอบนี้';});let badge=$('.uxqW1ContentBalanceBadge',q);if(!badge){badge=document.createElement('div');badge.className='uxqW1ContentBalanceBadge';const a=q.querySelector('.uxqTwoColumnHardLockBadge,.uxqW1StageSpecificBadge,.uxqUltimateCleanupBadge,.uxqUltimateGuardBadge');if(a)a.insertAdjacentElement('afterend',badge);else q.insertBefore(badge,q.firstChild);}badge.textContent=`✅ W1 content balance • ${p.label}`;q.dataset.w1ContentBalanceMark=seed;}
  function applyReason(){const v=$('.verify');if(!v)return;const p=pack();const opts=$$('.verify .option',v);if(!opts.length)return;const seed=[p.key,round(),opts.map(o=>o.dataset.reason||tx(o)).join('|')].join('|');if(v.dataset.w1ContentBalanceReasonMark===seed)return;const used=new Set();opts.forEach((o,i)=>{const b=title(o);if(!b)return;b.textContent=pick(reasonOk(o)?p.ro:p.rt,seed,i,used);o.dataset.w1ContentBalanceReason='1';hideNoise(o);sub(o,'w1-balance-reason-sub').textContent=reasonOk(o)?'โยง evidence → decision → task outcome':'ยังไม่พิสูจน์หน้าที่ของรอบนี้โดยตรง';});const h=$('h3',v);if(h)h.textContent=`ตรวจเหตุผล • W1 • ${p.label}`;const pr=$('p',v);if(pr)pr.textContent=`เหตุผลใดอธิบาย ${p.label} จากหลักฐานได้ดีที่สุด`;v.dataset.w1ContentBalanceReasonMark=seed;}
  function style(){if($('#uxq-w1-content-balance-style'))return;const st=document.createElement('style');st.id='uxq-w1-content-balance-style';st.textContent=`.uxqW1ContentBalanceBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 10px;border-radius:999px;background:rgba(255,214,112,.12);border:1px solid rgba(255,214,112,.5);color:#ffe7aa;font-weight:900;font-size:.72rem}.question .option[data-w1-content-balance="1"] b,.question .option[data-w1-content-balance="1"] strong{font-size:1rem!important;line-height:1.35!important}.question small[data-w1-balance-sub],.verify small[data-w1-balance-reason-sub]{font-size:.84rem!important;line-height:1.36!important;color:#b8cbed!important;margin-top:auto!important}.question .option[data-w1-content-balance="1"],.verify .option[data-w1-content-balance-reason="1"]{overflow:visible!important;max-height:none!important;height:auto!important}`;document.head.appendChild(st);}
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();applyQuestion();applyReason();},50)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
