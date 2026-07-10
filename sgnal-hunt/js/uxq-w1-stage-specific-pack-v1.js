/* CSAI2601 UX Quest • W1 Stage-Specific Pack v1
 * Fixes W1 repeated questions/options by forcing stage-specific visible wording.
 * Scope: W1 only, 5 stages only.
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
  const letters=['A','B','C','D'];
  const STAGES=[
    {
      name:'Friction Hunt', key:'friction', title:'ข้อ 1: จุดติดขัดหลักของผู้ใช้คืออะไร',
      prompt:'เลือกหลักฐานที่ชี้ friction หลัก ไม่ใช่ความสวยหรือความชอบ',
      ask:'ทำไมสิ่งนี้จึงเป็น friction หลักของผู้ใช้',
      correct:['ผู้ใช้เลือกอาจารย์ไม่ได้เพราะสถานะไม่บอกว่าพร้อมหรือไม่','ผู้ใช้หยุดที่จุดเลือกอาจารย์เพราะระบบไม่บอกตัวเลือกที่ใช้งานได้','สถานะว่าง/ไม่ว่างไม่ชัด ทำให้ผู้ใช้ตัดสินใจต่อไม่ได้','ผู้ใช้ทำ task หลักสะดุดตรงจุดเลือกอาจารย์'],
      trap:['เพิ่มภาพให้หน้าดูสวยขึ้น','เพิ่มคำอธิบายยาวบนหน้าแรก','เปลี่ยนสีปุ่มทั้งหมดให้สดขึ้น','ถามผู้ใช้ว่าชอบหน้าจอไหม'],
      reasonOk:['เพราะหลักฐานชี้ว่าผู้ใช้ไปต่อไม่ได้ที่ task เลือกอาจารย์','เพราะ friction เกิดที่ decision point ไม่ใช่ความสวยของหน้า','เพราะสถานะของตัวเลือกกระทบ user goal โดยตรง','เพราะวัดได้จาก task success และเวลาที่ผู้ใช้ค้าง'],
      reasonTrap:['เพราะหน้าสวยขึ้นอาจทำให้คนชอบมากขึ้น','เพราะทีมแก้ส่วนนี้ได้เร็วที่สุด','เพราะเพิ่มเนื้อหาแล้วดูครบกว่าเดิม','เพราะผู้ใช้บางคนอาจอยากเห็นสีชัดขึ้น']
    },
    {
      name:'User Goal Match', key:'goal', title:'ข้อ 2: เป้าหมายจริงของผู้ใช้ในเคสนี้คืออะไร',
      prompt:'เลือก goal ที่ผู้ใช้ต้องทำให้สำเร็จ ไม่ใช่สิ่งที่ทีมอยากโชว์',
      ask:'ทำไม goal นี้จึงเป็น goal หลักของผู้ใช้',
      correct:['ผู้ใช้ต้องรู้ว่าเลือกอาจารย์คนใดได้จริงในเวลานั้น','ผู้ใช้ต้องการตัดสินใจเลือกอาจารย์โดยไม่เดาสถานะ','ผู้ใช้ต้องทำรายการปรึกษาให้สำเร็จ ไม่ใช่อ่านข้อมูลทุกอย่าง','ผู้ใช้ต้องเห็นตัวเลือกที่พร้อมใช้งานก่อนเลือก'],
      trap:['ผู้ใช้ต้องอ่านข้อมูลอาจารย์ทั้งหมดก่อน','ผู้ใช้ต้องเห็นทุกเมนูเด่นเท่ากัน','ผู้ใช้ต้องดูภาพหน้าจอที่สวยที่สุด','ผู้ใช้ต้องกรอกข้อมูลเยอะเพื่อให้ระบบครบ'],
      reasonOk:['เพราะ goal ต้องโยงกับ task completion ของผู้ใช้','เพราะผู้ใช้ต้องตัดสินใจจากสถานะที่เชื่อถือได้','เพราะการเลือกอาจารย์สำเร็จคือผลลัพธ์หลักของเคสนี้','เพราะ goal ไม่ใช่จำนวนข้อมูลที่แสดง แต่คือการทำ task ให้จบ'],
      reasonTrap:['เพราะข้อมูลเยอะทำให้ระบบดูน่าเชื่อถือ','เพราะทีมอยากโชว์ฟีเจอร์ให้ครบ','เพราะหน้าที่สวยกว่าจะทำให้คนอยากใช้','เพราะให้ผู้ใช้อ่านเองแล้วค่อยตัดสินใจ']
    },
    {
      name:'Impact Lens', key:'impact', title:'ข้อ 3: ปัญหานี้ควรจัดเข้ากรอบ UI, UX หรือ feedback อย่างไร',
      prompt:'แยกอาการหน้าจอออกจากผลกระทบต่อ task และ feedback ของระบบ',
      ask:'ทำไมการแยก UI, UX และ feedback จึงสำคัญต่อการแก้ปัญหา',
      correct:['เป็น UX problem เพราะผู้ใช้ทำ task สำคัญไม่สำเร็จ','เป็น feedback problem เพราะระบบไม่บอกสถานะหลังผู้ใช้ตัดสินใจ','เป็น UI + UX issue เพราะหน้าจอไม่สื่อสถานะจนกระทบ task','ต้องแยก visual issue ออกจาก task failure ก่อนเลือก fix'],
      trap:['เป็น UI ทั้งหมดเพราะอยู่บนหน้าจอ','เป็นปัญหาความสวยเพราะสีไม่เด่น','เป็น content issue เพราะข้อความน้อยไปเท่านั้น','เป็นปัญหาผู้ใช้ไม่อ่านเอง'],
      reasonOk:['เพราะการแยกประเภทปัญหาทำให้เลือก fix ตรงสาเหตุ','เพราะ UX วัดจาก task success ไม่ใช่ความสวยอย่างเดียว','เพราะ feedback ที่ไม่ชัดทำให้ผู้ใช้ไม่รู้ next step','เพราะถ้าแยกผิดจะไปแก้ visual แต่ไม่ลด friction'],
      reasonTrap:['เพราะหน้าจอดูไม่สวยจึงต้องเป็น UI เท่านั้น','เพราะเพิ่มข้อความยาวขึ้นน่าจะช่วยทุกปัญหา','เพราะผู้ใช้ควรลองอ่านให้ละเอียดก่อน','เพราะถ้าทีมชอบก็ถือว่าใช้งานได้']
    },
    {
      name:'Fix Decision', key:'fix', title:'ข้อ 4: ควรเลือกแนวทางแก้เบื้องต้นแบบใด',
      prompt:'เลือก fix ที่ลด friction โดยตรงและยังวัดผลได้',
      ask:'ทำไมแนวทางแก้นี้จึงสัมพันธ์กับ friction หลัก',
      correct:['แสดงสถานะอาจารย์ให้ชัดก่อนผู้ใช้เลือก','จัดลำดับข้อมูลให้ status และ action อยู่ใกล้กัน','เพิ่ม feedback หลังเลือกว่าทำรายการต่อได้หรือไม่','ทำปุ่มเลือกให้สอดคล้องกับสถานะพร้อมใช้งาน'],
      trap:['เพิ่ม animation ให้ปุ่มเด่นขึ้นก่อน','เพิ่ม FAQ ใหญ่ไว้ด้านบนเพื่ออธิบายทุกอย่าง','เปลี่ยนธีมสีทั้งหน้าให้สดขึ้น','ซ่อนข้อมูลรองทั้งหมดไว้ท้ายหน้า'],
      reasonOk:['เพราะ fix นี้แก้ decision point ที่ทำให้ผู้ใช้ค้าง','เพราะสถานะและ action ที่ชัดช่วยลดการเดาของผู้ใช้','เพราะ feedback หลังเลือกพิสูจน์ได้จาก task success','เพราะแก้จุดที่กระทบ user goal โดยตรง'],
      reasonTrap:['เพราะ animation ทำให้หน้าดูน่าสนใจขึ้น','เพราะ FAQ เยอะจะทำให้ผู้ใช้รู้ทุกอย่าง','เพราะสีสดขึ้นทำให้ระบบดูทันสมัย','เพราะซ่อนข้อมูลแล้วหน้าจะดูโล่ง']
    },
    {
      name:'Proof Plan', key:'proof', title:'ข้อ 5: จะทดสอบอย่างไรว่า UX ดีขึ้นจริง',
      prompt:'เลือก proof ที่วัดผลจากพฤติกรรม ไม่ใช่ความชอบอย่างเดียว',
      ask:'ทำไมวิธีทดสอบนี้จึงพิสูจน์ผลได้จริง',
      correct:['ให้ผู้ใช้ทำ task เดิม แล้ววัด task success เวลา error และคำถาม next step','เปรียบเทียบ before/after จากเวลาที่ใช้และจำนวนคนที่เลือกถูก','เก็บหลักฐานว่าผู้ใช้เห็นสถานะก่อนกดเลือกจริงหรือไม่','วัดว่าหลังแก้แล้วผู้ใช้ทำรายการปรึกษาสำเร็จมากขึ้นไหม'],
      trap:['ถามทีมออกแบบว่าหน้าใหม่ดูดีกว่าเดิมหรือไม่','ให้ผู้ใช้ดู mockup แล้วเลือกภาพที่ชอบมากกว่า','วัดจำนวนคนกดเข้าหน้าแรกหลังเปลี่ยนสีไอคอน','นับจำนวนข้อความบนหน้าแทนการทดสอบ task'],
      reasonOk:['เพราะ proof ต้องวัด behavior และ task outcome หลังปรับ','เพราะ before/after ช่วยพิสูจน์ว่า fix ลด friction จริง','เพราะ task success เวลา และ error สะท้อน UX ดีกว่าความชอบ','เพราะหลักฐานต้องชี้ว่าผู้ใช้เข้าใจสถานะและทำต่อได้'],
      reasonTrap:['เพราะทีมรู้ดีที่สุดว่าหน้าไหนสวยกว่า','เพราะความชอบของผู้ใช้พอแทน task success ได้','เพราะยอดกดหน้าแรกบอกว่า UX ดีขึ้นเสมอ','เพราะมีข้อความเยอะขึ้นจึงน่าจะเข้าใจมากขึ้น']
    }
  ];
  function hash(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function round(){const m=tx($('.hud .meter b')).match(/(\d+)\s*\/\s*\d+/);return m?Math.max(1,Math.min(5,Number(m[1]))):1;}
  function stage(){return STAGES[round()-1]||STAGES[0];}
  function isCorrect(el){return /^c\d+/i.test(String(el?.dataset?.choice||''));}
  function ridx(el){const m=String(el?.dataset?.reason||'').match(/-(\d+)$/);return m?Number(m[1]):-1;}
  function pick(list,seed,i,used){for(let k=0;k<list.length;k++){const v=list[(hash(seed)+i+k)%list.length];if(!used.has(v)){used.add(v);return v;}}return list[i%list.length];}
  function title(card){return $('b,strong',card);}
  function ensure(card,name){let sm=$(`small[data-${name}]`,card);if(!sm){sm=document.createElement('small');sm.setAttribute(`data-${name}`,'1');card.appendChild(sm);}return sm;}
  function hideOld(card){$$('small,span',card).forEach(el=>{if(el.matches('[data-w1-stage-sub],[data-w1-stage-reason-sub]'))return;if(/uxqMiniLane|uxqDragLane/.test(el.className||''))return;el.hidden=true;el.style.display='none';});}
  function setHeader(){const s=stage();const h1=$('.question h1,.question h2');if(h1)h1.textContent=s.title;const p=$('.question .prompt,.question .instruction');if(p)p.textContent=s.prompt;const mechanic=$('.uxqMechanicPanel strong,.uxqMechanicPanel h3');if(mechanic)mechanic.textContent=s.name;const pill=$('.uxqMechanicPanel .pill,.uxqMechanicBadge');if(pill)pill.textContent=`Round ${round()}/5`;}
  function applyChoices(){const qn=$('.question');if(!qn||$('.verify')||$('.feedback'))return;const s=stage();const cards=$$('.question > .options .option[data-choice],.uxqMiniCard,.uxqDragCard');if(!cards.length)return;const seed=[s.key,round(),tx($('.case h1')),tx($('.case p:last-child')),cards.map(c=>c.dataset.choice||tx(c)).join('|')].join('|');if(qn.dataset.w1StageSpecificMark===seed)return;const used=new Set();cards.forEach((c,i)=>{const b=title(c);if(!b)return;const t=pick(isCorrect(c)?s.correct:s.trap,seed,i,used);b.textContent=t;c.dataset.w1StageSpecific='1';c.setAttribute('data-choice-tag',letters[i]||String(i+1));c.setAttribute('data-mechanic-label',letters[i]||String(i+1));hideOld(c);ensure(c,'w1-stage-sub').textContent=isCorrect(c)?'หลักฐานตรงกับหน้าที่ของรอบนี้':'ดูใกล้เคียง แต่ไม่ตอบหน้าที่ของรอบนี้';});let badge=$('.uxqW1StageSpecificBadge',qn);if(!badge){badge=document.createElement('div');badge.className='uxqW1StageSpecificBadge';const a=qn.querySelector('.uxqUltimateCleanupBadge,.uxqUltimateGuardBadge,.uxqFoundationQualityBadge');if(a)a.insertAdjacentElement('afterend',badge);else qn.insertBefore(badge,qn.firstChild);}badge.textContent=`✅ W1 ${s.name} • stage-specific`;qn.dataset.w1StageSpecificMark=seed;}
  function applyReason(){const box=$('.verify');if(!box)return;const s=stage();const opts=$$('.verify .option',box);if(!opts.length)return;const seed=[s.key,round(),opts.map(o=>o.dataset.reason||tx(o)).join('|')].join('|');if(box.dataset.w1StageReasonMark===seed)return;const used=new Set();opts.forEach((o,i)=>{const b=$('b',o);if(!b)return;const ok=ridx(o)===0;b.textContent=pick(ok?s.reasonOk:s.reasonTrap,seed,i,used);o.dataset.w1StageReason='1';hideOld(o);ensure(o,'w1-stage-reason-sub').textContent=ok?'โยงกับ evidence และหน้าที่ของรอบนี้':'ยังไม่พอ เพราะไม่พิสูจน์ stage นี้โดยตรง';});const h=$('h3',box);if(h)h.textContent=`ตรวจเหตุผล • W1 • ${s.name}`;const p=$('p',box);if(p)p.textContent=s.ask;box.dataset.w1StageReasonMark=seed;}
  function style(){if($('#uxq-w1-stage-specific-style'))return;const st=document.createElement('style');st.id='uxq-w1-stage-specific-style';st.textContent=`.uxqW1StageSpecificBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:4px 0 12px;border-radius:999px;background:rgba(92,235,255,.10);border:1px solid rgba(92,235,255,.35);color:#c8f7ff;font-weight:900;font-size:.73rem}.question .option[data-w1-stage-specific="1"],.uxqMiniCard[data-w1-stage-specific="1"],.uxqDragCard[data-w1-stage-specific="1"]{min-height:142px!important;max-height:none!important;height:auto!important;overflow:visible!important;padding:14px 15px!important;border-radius:18px!important;display:flex!important;flex-direction:column!important;gap:10px!important}.question .option[data-w1-stage-specific="1"]:before{content:attr(data-choice-tag)!important}.question .option[data-w1-stage-specific="1"] b,.question .option[data-w1-stage-specific="1"] strong{font-size:1.02rem!important;line-height:1.34!important;white-space:normal!important;overflow-wrap:break-word!important}.question small[data-w1-stage-sub],.verify small[data-w1-stage-reason-sub]{font-size:.86rem!important;line-height:1.38!important;color:#b8cbed!important;margin-top:auto!important}.verify .option[data-w1-stage-reason="1"]{min-height:136px!important;display:flex!important;flex-direction:column!important;gap:10px!important}.question [hidden],.verify [hidden]{display:none!important}@media(min-width:960px){.question .options{grid-template-columns:repeat(4,minmax(0,1fr))!important}}@media(max-width:679px){.question .options{grid-template-columns:1fr!important}.question .option[data-w1-stage-specific="1"]{min-height:0!important}}`;document.head.appendChild(st);}
  let timer=0;function run(){clearTimeout(timer);timer=setTimeout(()=>{style();setHeader();applyChoices();applyReason();},130);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
