(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-GRADE5-SUMMARY-R40';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const done=row=>row?.completed===true||['strict','grace','assist','pass','passed'].includes(String(row?.passMode||'').toLowerCase());

function installStyle(){
 if(document.getElementById('handwashGrade5SummaryStyleR40'))return;
 const style=document.createElement('style');style.id='handwashGrade5SummaryStyleR40';style.textContent=`
 #handwashGrade5SummaryR40{display:grid;gap:9px;margin:12px 0;padding:13px;border:2px solid rgba(132,226,255,.42);border-radius:16px;background:linear-gradient(145deg,rgba(4,44,62,.92),rgba(6,27,43,.94));text-align:left;color:#effbff}
 #handwashGrade5SummaryR40 .g40-title{font-size:16px;font-weight:1000;line-height:1.3}
 #handwashGrade5SummaryR40 .g40-note{font-size:12px;line-height:1.55;color:#cceaf2}
 #handwashGrade5SummaryR40 .g40-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 #handwashGrade5SummaryR40 .g40-stat{min-width:0;padding:9px 6px;border-radius:12px;background:rgba(255,255,255,.07);text-align:center}
 #handwashGrade5SummaryR40 .g40-stat b{display:block;font-size:20px;color:#fff}
 #handwashGrade5SummaryR40 .g40-stat span{display:block;margin-top:2px;font-size:8px;color:#b9dbe7}
 #handwashGrade5SummaryR40 .g40-group{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.055);font-size:12px;line-height:1.5}
 #handwashGrade5SummaryR40 .g40-group strong{display:block;margin-bottom:3px;color:#ffe27b}
 #handwashGrade5SummaryR40.completed{border-color:#67eda9;background:linear-gradient(145deg,rgba(5,91,59,.90),rgba(3,52,43,.94))}
 #handwashGrade5SummaryR40.skill{border-color:#ffe27b;background:linear-gradient(145deg,rgba(72,70,13,.92),rgba(4,65,53,.94))}
 #handwashResultToggleR40{width:100%;min-height:48px;margin:9px 0;border:1px solid rgba(132,226,255,.38);border-radius:13px;background:rgba(11,45,61,.92);color:#effbff;font:1000 14px/1.25 system-ui,sans-serif}
 #summaryOverlay .result-list.g40-collapsed{display:none!important}
 #summaryOverlay .result-row[data-grade5-status="assist"]{border-color:rgba(255,226,123,.52)!important;background:rgba(87,68,8,.34)!important}
 #summaryOverlay .result-row[data-grade5-status="coach"]{border-color:rgba(132,226,255,.44)!important;background:rgba(3,55,76,.32)!important}
 #summaryOverlay .result-row[data-grade5-status="strict"]{border-color:rgba(103,237,169,.40)!important;background:rgba(5,91,59,.24)!important}
 #summaryOverlay .result-row[data-grade5-status="pending"]{border-color:rgba(185,219,231,.30)!important;background:rgba(43,55,65,.38)!important}
 #summaryOverlay .result-row[data-grade5-status="pending"] span:first-child::first-letter{color:#ffe27b}
 @media(max-width:430px){#handwashGrade5SummaryR40 .g40-stats{grid-template-columns:repeat(3,minmax(0,1fr))}#handwashGrade5SummaryR40 .g40-stat b{font-size:18px}}
 `;document.head.appendChild(style);
}

function ensurePanel(){
 let panel=document.getElementById('handwashGrade5SummaryR40');if(panel)return panel;
 panel=document.createElement('section');panel.id='handwashGrade5SummaryR40';
 const grid=document.getElementById('summaryGrid');grid?.parentNode?.insertBefore(panel,grid);
 return panel;
}

function labels(rows){return rows.map(row=>esc(row.label||row.id||'ขั้นฝึก')).join(' • ')}

function render(result){
 installStyle();
 const rows=Array.isArray(result?.steps)?result.steps:[];
 const completedRows=rows.filter(done);
 const strictRows=rows.filter(row=>String(row.passMode||'')==='strict');
 const coachRows=rows.filter(row=>String(row.passMode||'')==='grace');
 const assistRows=rows.filter(row=>String(row.passMode||'')==='assist');
 const pendingRows=rows.filter(row=>!done(row));
 const completed=result?.completed===true||completedRows.length>=12;
 const skill=result?.skillCriteriaMet===true||result?.passed===true;
 const panel=ensurePanel();
 panel.className=skill?'skill':completed?'completed':'';
 const headline=skill?'🌟 ทำครบและผ่านเกณฑ์ทักษะ':completed?'🎉 ทำครบทุกขั้นแล้ว':'💪 ทำได้ดีแล้ว มาฝึกต่ออีกนิด';
 const note=skill
  ?'ระบบยืนยันว่าทำครบด้วยตนเองและมีความแม่นยำตามเกณฑ์'
  :completed
   ?'ภารกิจจบแล้ว ระบบเก็บความแม่นยำจริงและขั้นที่ใช้ Adaptive Assist ไว้สำหรับการวิเคราะห์ โดยไม่บังคับให้เล่นซ้ำ'
   :'ผลนี้ใช้เพื่อบอกว่าควรฝึกขั้นใดต่อ ไม่ได้หมายความว่าทำผิดทั้งหมด';
 panel.innerHTML=`<div class="g40-title">${headline}</div><div class="g40-note">${note}</div><div class="g40-stats"><div class="g40-stat"><b>${completedRows.length}/${rows.length||12}</b><span>ขั้นที่ทดลองครบ</span></div><div class="g40-stat"><b>${strictRows.length}</b><span>ทำได้ด้วยตนเอง</span></div><div class="g40-stat"><b>${coachRows.length+assistRows.length}</b><span>ผ่านด้วยคำแนะนำ</span></div></div>${strictRows.length?`<div class="g40-group"><strong>ทำได้ดี</strong>${labels(strictRows)}</div>`:''}${coachRows.length+assistRows.length?`<div class="g40-group"><strong>ระบบช่วยในขั้นต่อไปนี้</strong>${labels([...coachRows,...assistRows])}</div>`:''}${pendingRows.length?`<div class="g40-group"><strong>ขั้นที่ยังไม่ได้ทดลองครบ</strong>${labels(pendingRows)}</div>`:''}`;

 const title=document.getElementById('summaryTitle');
 const sub=document.getElementById('summarySub');
 const hero=document.getElementById('summaryHero');
 if(hero)hero.textContent=skill?'🌟':completed?'🎉':'🧼';
 if(title)title.textContent=skill?'ทำครบและผ่านเกณฑ์ทักษะ':completed?'จบภารกิจ Handwash แล้ว':'ฝึกได้ดีแล้ว • ยังมีบางขั้นให้ลองต่อ';
 if(sub)sub.textContent=completed
  ?`ทำครบ ${completedRows.length}/${rows.length||12} ขั้น • ด้วยตนเอง ${strictRows.length} • Coach/Assist ${coachRows.length+assistRows.length} • ความแม่นยำ ${Number(result?.accuracy||0)}%`
  :`ทำครบ ${completedRows.length}/${rows.length||12} ขั้น • ยังเหลือ ${pendingRows.length} ขั้น • ความแม่นยำ ${Number(result?.accuracy||0)}%`;

 const list=document.getElementById('resultList');
 if(list){
  [...list.querySelectorAll('.result-row')].forEach((node,index)=>{
   const row=rows[index]||{};const mode=String(row.passMode||'');
   node.dataset.grade5Status=!done(row)?'pending':mode==='assist'?'assist':mode==='grace'?'coach':'strict';
   const status=node.querySelector('span:last-child');
   if(status)status.textContent=!done(row)?'ยังไม่ได้ลองครบ':mode==='assist'?'ผ่านด้วย Adaptive Assist':mode==='grace'?'ผ่านด้วย Coach':'ทำได้ด้วยตนเอง';
  });
  let toggle=document.getElementById('handwashResultToggleR40');
  if(!toggle){toggle=document.createElement('button');toggle.id='handwashResultToggleR40';toggle.type='button';list.parentNode?.insertBefore(toggle,list);}
  list.classList.add('g40-collapsed');
  toggle.textContent=`ดูผลรายขั้นทั้งหมด (${rows.length||12})`;
  toggle.onclick=()=>{const hidden=list.classList.toggle('g40-collapsed');toggle.textContent=hidden?`ดูผลรายขั้นทั้งหมด (${rows.length||12})`:'ซ่อนผลรายขั้น';if(!hidden)setTimeout(()=>toggle.scrollIntoView({behavior:'smooth',block:'start'}),40)};
 }

 const delivery=document.getElementById('deliveryText');
 if(delivery)delivery.textContent=completed?'บันทึกผลภารกิจและข้อมูลทักษะแยกกันแล้ว • ไม่จำเป็นต้องเล่นซ้ำ':'กดเล่นใหม่เมื่อพร้อม เพื่อทดลองขั้นที่ยังเหลือ';
 const zone=document.getElementById('summaryZoneBtn');
 const replay=document.getElementById('replayBtn');
 if(zone)zone.textContent=completed?'จบภารกิจและกลับ Passport':'กลับโดยยังไม่จบภารกิจ';
 if(replay)replay.textContent=completed?'ฝึกเพิ่มอีกครั้ง':'เล่นใหม่พร้อม Step Guide';
 document.documentElement.dataset.handwashGrade5Summary=RELEASE;
}

window.addEventListener('herohealth:game-result',event=>setTimeout(()=>render(event.detail||{}),20));
document.addEventListener('DOMContentLoaded',installStyle,{once:true});
console.info('[Handwash Grade 5 Summary R40] installed');
})();