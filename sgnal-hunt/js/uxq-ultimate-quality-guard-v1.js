/* CSAI2601 UX Quest • Ultimate Quality Guard v1
 * Scope: W1-W15 + B1-B4.
 * Last-mile anti-repeat / anti-longest / UI stability guard.
 * Visual-text only: never changes data-choice, data-reason, score, strict gate, or sheet sync.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const txt=e=>clean(e?.textContent);
  const node=()=>String(new URLSearchParams(location.search||'').get('node')||new URLSearchParams(location.search||'').get('id')||'W1').toUpperCase();
  const n=node();
  if(!/^(W([1-9]|1[0-5])|B[1-4])$/.test(n))return;
  const L=['A','B','C','D'];
  const pools={
    W1:['ชี้ friction ที่ขวาง task','แยกปัญหาจากความสวย','เลือกหลักฐานจากพฤติกรรม','จับจุดที่ผู้ใช้ไปต่อไม่ได้'],
    W2:['เก็บ evidence ก่อน solution','แยก assumption ออกจาก data','ทดสอบสมมติฐานสั้น ๆ','ใช้เสียงผู้ใช้จริง'],
    W3:['ลด cognitive load','ให้ feedback ชัดหลัง action','ตรง mental model ผู้ใช้','ลดการเดาขั้นถัดไป'],
    W4:['ถามแบบไม่ชี้นำ','สังเกต task จริง','โยง clue กับ persona need','แยก opinion จาก behavior'],
    W5:['เขียน problem จาก root cause','ทำ HMW ไม่ล็อก solution','ต่อ insight ไป concept','ทำให้วัดผลได้'],
    W6:['จัด flow ตาม goal','มี recovery path','บอก next step หลัง action','ลดทางตันใน task'],
    W7:['จัด priority ตาม task','วางข้อมูลใกล้ CTA','คุม hierarchy ไม่ให้หลอกตา','ปรับ mobile/touch target'],
    W8:['เช็ก evidence chain','จับ mismatch ใน blueprint','เลือก revision ที่พิสูจน์ได้','จัด critique ตาม task impact'],
    W9:['กำหนด component state','ใช้ naming ให้ consistent','สร้าง rule ที่ reuse ได้','ลด pattern แตกหลายหน้า'],
    W10:['แก้ breakpoint ที่ task หาย','เพิ่ม label และ contrast','จัด touch target ให้กดได้','รักษา action สำคัญบนมือถือ'],
    W11:['ใช้ visual hierarchy นำ task','คุม contrast ให้อ่านได้','จัด spacing แยกกลุ่มข้อมูล','ลด visual noise'],
    W12:['ให้ feedback หลัง action','ป้องกัน error ก่อนเกิด','เขียน microcopy ชี้ recovery','บอกสถานะและ next step'],
    W13:['เชื่อม prototype ตาม task','เพิ่ม error path ที่ test ได้','แก้ dead end ก่อนทดสอบ','ตรวจ interaction ที่ link ขาด'],
    W14:['จัด severity ตาม task impact','เลือก fix ที่ retest ได้','แยก finding จาก opinion','วัดผลหลังแก้จริง'],
    W15:['เล่า story จาก problem ถึง result','ปิด evidence gap ก่อน defense','ป้องกัน decision ด้วย test','เรียง portfolio ตาม argument'],
    B1:['เชื่อม UX problem กับ evidence','ใช้ psychology ป้องกันคำตอบ','เสนอ fix ที่พิสูจน์ task ได้','ตอบครบ problem-evidence-proof'],
    B2:['ต่อ persona → problem → flow','ป้องกัน wireframe ด้วย evidence','มี recovery path ใน flow','chain ไม่หลุดจากหลักฐาน'],
    B3:['คุม interface system ทั้ง state','ตอบ responsive + a11y พร้อมกัน','รักษา visual rule ให้ reuse ได้','พิสูจน์ component ด้วย pattern'],
    B4:['จัด severity จาก usability evidence','เลือก fix แล้วต้อง retest','ต่อ prototype กับ finding','ป้องกัน iteration ด้วยผล test']
  };
  const trap={
    W1:['เพิ่มความสวยแต่ไม่แตะ friction','แก้ทุกจุดพร้อมกันจนวัดไม่ได้','ถามว่าชอบไหมแทนดู task','เติมคำอธิบายจน cognitive load เพิ่ม'],
    W2:['เริ่ม solution ก่อน evidence','ใช้ stakeholder แทน user data','อ้าง benchmark โดยไม่ดูบริบท','สรุป assumption เป็น fact'],
    W3:['ใช้ animation แทน feedback','ซ่อนข้อมูลจน mental model ขาด','ใช้ icon โดยไม่ลด ambiguity','ทำให้หน้าโล่งแต่ task ยังงง'],
    W4:['ถามนำให้ตอบตามทีมคิด','เลือก sample แคบเกินไป','สรุป persona จาก opinion เดียว','ดู preference แทน behavior'],
    W5:['ล็อก solution ใน HMW','ตั้ง problem กว้างจนวัดไม่ได้','ทำ concept ก่อนรู้ root cause','แก้ปลายเหตุแต่ไม่แตะ insight'],
    W6:['จัดตามโครงสร้างทีม','ทำ path สั้นแต่ไม่มี recovery','ซ่อนขั้นตอนจนผู้ใช้หลง','ลดคลิกแต่เพิ่มความเสี่ยง'],
    W7:['ทำ CTA ใหญ่สุดเสมอ','ใช้ภาพใหญ่กลบ context','ซ่อนข้อมูลรองจนตัดสินใจไม่ได้','ให้ทุกอย่างเด่นเท่ากัน'],
    W8:['เพิ่ม section แต่ไม่แก้ mismatch','เลือกแบบที่ทีมเล่าง่าย','รวม critique จน priority หาย','revision ไม่โยง evidence'],
    W9:['เปลี่ยนสีแทนสร้าง state','ทำ component เฉพาะหน้าเดียว','ตั้งชื่อจากภาษาทีมเท่านั้น','reuse ไม่ได้เมื่อขยายระบบ'],
    W10:['ย่อทุกอย่างให้พอดีจอ','ซ่อนข้อมูลสำคัญบนมือถือ','ใช้สีแทน label','ลืม focus และ contrast'],
    W11:['ใช้สีเยอะจน hierarchy แตก','ใช้ฟอนต์หลายแบบเกินจำเป็น','ทำทุกหัวข้อเด่นเท่ากัน','spacing สวยแต่กลุ่มข้อมูลไม่ชัด'],
    W12:['แจ้ง error หลังผิดเท่านั้น','คำเตือนยาวแต่ไม่บอก next step','animation สวยแต่ความหมายไม่ชัด','ไม่มี recovery action'],
    W13:['เพิ่มหน้าจอแต่ link ยังขาด','demo happy path อย่างเดียว','ตัด error path เพื่อ test เร็ว','prototype ดูครบแต่ task เดินไม่ได้'],
    W14:['แก้ที่ง่ายก่อนแต่ impact ต่ำ','นับคนบ่นโดยไม่ดู task','เลือก fix จากความชอบทีม','ไม่วาง retest หลังแก้'],
    W15:['โชว์ final เยอะแต่ evidence หาย','เล่าแต่ success ไม่พูด limitation','จัดตามไฟล์แทน argument','defense ด้วยความสวยแทนผล test'],
    B1:['สวยขึ้นแต่ไม่พิสูจน์ UX','preference ไม่แทน task evidence','ทำง่ายแต่ไม่แก้ friction','ขาด psychology ในเหตุผล'],
    B2:['wireframe-first แล้วหาเหตุผลทีหลัง','short flow แต่เปราะเมื่อผิด','HMW กว้างจน layout ไม่ชัด','chain persona-problem หลุด'],
    B3:['component สวยแต่ state ไม่ครบ','responsive โดยตัด context สำคัญ','a11y ใช้สีแทน label','system rule reuse ไม่ได้'],
    B4:['severity ไม่อิง task impact','fix ไม่มี retest','prototype ไม่รองรับ error path','iteration ไม่มี evidence ป้องกัน']
  };
  function hash(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function round(){const m=txt($('.hud .meter b')).match(/(\d+)/);return m?Number(m[1]):1;}
  function correct(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  function ridx(el){const m=String(el?.dataset?.reason||'').match(/-(\d+)$/);return m?Number(m[1]):-1;}
  function pick(list,seed,i,used){for(let k=0;k<list.length;k++){const v=list[(hash(seed)+i+k)%list.length];const key=v.toLowerCase();if(!used.has(key)){used.add(key);return v;}}return list[i%list.length];}
  function choiceEls(){return $$('.question > .options .option[data-choice],.uxqMiniCard,.uxqDragCard');}
  function titleEl(card){return $('b,strong',card);}
  function ensureSmall(card,type){let sm=$(`small[data-uxq-ultimate-${type}]`,card);if(!sm){sm=document.createElement('small');sm.setAttribute(`data-uxq-ultimate-${type}`,'1');card.appendChild(sm);}return sm;}
  function fixChoices(){const q=$('.question');if(!q||$('.verify')||$('.feedback'))return;const cards=choiceEls();if(!cards.length)return;const mark=[n,round(),cards.map(c=>c.dataset.choice||txt(c)).join('|')].join('|');if(q.dataset.ultimateGuardMark===mark)return;const used=new Set();cards.forEach((c,i)=>{const b=titleEl(c);if(!b)return;const list=correct(c)?(pools[n]||pools.W1):(trap[n]||trap.W1);let t=txt(b);const duplicate=used.has(t.toLowerCase());const generic=/พิจารณาแนวทาง|ตัวเลือก|อ่านสถานการณ์|ทำให้เด่นขึ้นก่อน|แก้ทุกอย่าง/i.test(t);const tooLong=t.length>58;const tooShort=t.length<8;if(duplicate||generic||tooLong||tooShort){t=pick(list,mark,i,used);b.textContent=t;}else used.add(t.toLowerCase());c.dataset.ultimateGuard='1';c.setAttribute('data-choice-tag',L[i]||String(i+1));const sm=ensureSmall(c,'choice');if(!txt(sm)||/อ่านสถานการณ์|generic|เลือกคำตอบ/i.test(txt(sm)))sm.textContent=correct(c)?'โยงกับหลักฐานของ case และ task หลัก':'ดูใกล้เคียง แต่หลักฐานยังไม่พอ';$$('span',c).forEach(sp=>{if(!/uxqMiniLane|uxqDragLane/.test(sp.className||'')){sp.hidden=true;sp.style.display='none';}});});let badge=$('.uxqUltimateGuardBadge',q);if(!badge){badge=document.createElement('div');badge.className='uxqUltimateGuardBadge';const a=q.querySelector('.uxqAdvancedQualityBadge,.uxqFoundationQualityBadge,.student-ready-note,.uxqChallengeHud');if(a)a.insertAdjacentElement('afterend',badge);else q.insertBefore(badge,q.firstChild);}badge.textContent=`✅ ${n} Ultimate Guard • no-repeat / no-longest / evidence-first`;q.dataset.ultimateGuardMark=mark;}
  function fixReasons(){const box=$('.verify');if(!box)return;const opts=$$('.verify .option',box);if(!opts.length)return;const mark=[n,round(),opts.map(o=>o.dataset.reason||txt(o)).join('|')].join('|');if(box.dataset.ultimateReasonMark===mark)return;const used=new Set();opts.forEach((o,i)=>{const b=$('b',o);if(!b)return;let t=txt(b);const ok=ridx(o)===0;const list=ok?(pools[n]||pools.W1):(trap[n]||trap.W1);if(used.has(t.toLowerCase())||t.length>72||/เลือกเหตุผล|อ่านสถานการณ์|คำตอบที่มีเหตุผล/i.test(t)){t=pick(list,mark,i+9,used);b.textContent=t;}else used.add(t.toLowerCase());o.dataset.ultimateReason='1';const sm=ensureSmall(o,'reason');sm.textContent=ok?'เหตุผลนี้เชื่อม evidence → decision → task impact':'ยังขาดหลักฐานบางส่วนหรือ chain ยังไม่แน่น';$$('span',o).forEach(sp=>{sp.hidden=true;sp.style.display='none';});});box.dataset.ultimateReasonMark=mark;}
  function style(){if($('#uxq-ultimate-guard-style'))return;const s=document.createElement('style');s.id='uxq-ultimate-guard-style';s.textContent=`.uxqUltimateGuardBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 12px;border-radius:999px;background:rgba(255,215,110,.10);border:1px solid rgba(255,215,110,.32);color:#ffe8a6;font-weight:900;font-size:.73rem}.question .option[data-ultimate-guard="1"],.uxqMiniCard[data-ultimate-guard="1"],.uxqDragCard[data-ultimate-guard="1"]{min-height:150px!important;max-height:none!important;height:auto!important;overflow:visible!important;padding:14px 15px!important;border-radius:18px!important;display:flex!important;flex-direction:column!important;gap:10px!important}.question .option[data-ultimate-guard="1"]:before{content:attr(data-choice-tag)!important}.question .option[data-ultimate-guard="1"] b,.question .option[data-ultimate-guard="1"] strong,.uxqMiniCard[data-ultimate-guard="1"] strong,.uxqDragCard[data-ultimate-guard="1"] b{font-size:1.02rem!important;line-height:1.34!important;white-space:normal!important;overflow-wrap:break-word!important}.question small[data-uxq-ultimate-choice],.verify small[data-uxq-ultimate-reason]{font-size:.86rem!important;line-height:1.38!important;color:#b8cbed!important;margin-top:auto!important}.verify .option[data-ultimate-reason="1"]{min-height:140px!important;max-height:none!important;height:auto!important;overflow:visible!important;display:flex!important;flex-direction:column!important;gap:10px!important}.verify .option[data-ultimate-reason="1"] b{line-height:1.36!important}.question [hidden],.verify [hidden]{display:none!important}@media(min-width:960px){.question .options{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@media(max-width:679px){.question .options{grid-template-columns:1fr!important}.question .option[data-ultimate-guard="1"]{min-height:0!important}}`;document.head.appendChild(s);}
  let t=0;function run(){clearTimeout(t);t=setTimeout(()=>{style();fixChoices();fixReasons();},190);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
