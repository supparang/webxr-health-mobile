/* UX Quest • Elite W1–B2 Challenge Upgrade v3
   Replay variety, anti-guess cards, pressure gates, boss waves, and mission pulse. */
(()=>{'use strict';
const IDS=new Set(['w1','w2','w3','b1','w4','w5','w6','b2']);
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const cut=(v,n=164)=>{v=txt(v);return v.length>n?v.slice(0,n-1)+'…':v};
const O=(label,description,rationale,correct=false)=>({label,description,rationale,correct});
const BAD={
 research:[O('ดูเพียงยอดเข้าหน้าและเวลาบนหน้า','มีข้อมูลปริมาณ แต่ไม่เห็นจุดตัดสินใจ','ตัวเลขรวมไม่บอกว่าผู้ใช้ติดตรงไหน'),O('ถามเจ้าหน้าที่แทนการดูผู้ใช้','ได้มุมมองผู้ให้บริการเป็นหลัก','ไม่แทนพฤติกรรมผู้ใช้ใน task จริง'),O('เลือกจุดที่ทีมคิดว่าไม่สวยที่สุด','ใช้รสนิยมภายในเป็นตัวตั้ง','ยังไม่ใช่หลักฐานของ task failure')],
 framing:[O('สรุปว่าผู้ใช้ไม่เก่งเทคโนโลยี','ตีตราผู้ใช้จากข้อมูลจำกัด','เป็น assumption ไม่ใช่คำอธิบายจากพฤติกรรม'),O('เพิ่มฟีเจอร์หรือเมนูให้ครบก่อน','รีบขยาย solution','ฟีเจอร์มากไม่เท่ากับช่วย task หลัก'),O('เริ่มจากหน้าจอที่อยากทำให้ทันสมัย','ล็อก solution ก่อนเห็น need','ยังไม่ระบุผู้ใช้ เป้าหมาย และอุปสรรค')],
 idea:[O('ทำตามรูปแบบของแอปดังทันที','ยืม solution จากบริบทอื่น','อาจไม่ตอบ need ของคดีนี้'),O('เพิ่ม chatbot เต็มหน้าจอ','เพิ่มเทคโนโลยีครอบจักรวาล','ไม่จำเป็นต้องแก้ state หรือ decision point'),O('เลือกไอเดียที่ทีมทำเร็วสุด','ใช้ความสะดวกทีมเป็นเกณฑ์','อาจไม่ลด friction หลัก')],
 flow:[O('ทำทุก action ให้เด่นเท่ากัน','ลดลำดับความสำคัญ','ผู้ใช้ยังต้องหาเองว่าอะไรต้องทำตอนนี้'),O('ซ่อนข้อมูลสำคัญไว้ในเมนูย่อย','ย้ายภาระไปที่การค้นหา','ข้อมูลจำเป็นควรอยู่ในจังหวะตัดสินใจ'),O('ยืนยันก่อนแล้วค่อยแสดงเงื่อนไข','เผยข้อมูลสำคัญช้าเกินไป','ผู้ใช้อาจต้องย้อนกลับ')],
 prototype:[O('ทำ high-fi ทุกหน้าพร้อมระบบสีครบ','ลงทุนรายละเอียดก่อนพิสูจน์ flow','ช้าเกินไปเมื่อยังไม่รู้ว่าแนวคิดช่วยจริง'),O('อธิบายด้วยสไลด์แล้วถามว่าชอบไหม','ทดสอบจากการบอกเล่า','ผู้ใช้ไม่ได้ทำ task จริง'),O('พัฒนาระบบเต็มก่อนค่อยเก็บ feedback','เรียนรู้หลังลงทุนสูง','เสี่ยงสร้างสิ่งผิดครบชุด')],
 test:[O('ถามทีมว่าหน้าจอสวยขึ้นหรือไม่','วัดความชอบภายในทีม','ไม่พิสูจน์ task success'),O('นับคลิกและยอดเข้าหน้าเท่านั้น','วัด traffic แทน outcome','ไม่บอกความเข้าใจหรือความผิดพลาด'),O('เปิดใช้จริงแล้วรอคำร้องเรียน','เรียนรู้หลังเกิดผลกระทบ','ผู้ใช้ที่เลิกใช้มักไม่ร้องเรียน')]
};
const family=k=>['evidence','empathize','listen','signal'].includes(k)?'research':['hypothesis','define','problem','hmw','insight','separate','diagnose'].includes(k)?'framing':['ideate','fix'].includes(k)?'idea':['prototype','process'].includes(k)?'prototype':['test','validate','prove'].includes(k)?'test':'flow';
const twists=[
 {key:'deadline',name:'DEADLINE RUSH',user:'ใกล้เส้นตายและมีเวลาเพียงไม่กี่นาที',impact:'หากตัดสินใจผิดอาจพลาดกำหนดสำคัญ',prompt:'ภายใต้เวลาจำกัด ทีมควรออกแบบ guardrail ใดก่อน?',correct:O('ทำเป้าหมาย กำหนด และ action ถัดไปเด่น พร้อมเตือนจุดผิดพลาดที่แก้ไม่ทัน','ลดการค้นหาและยืนยันสิ่งที่มีผลต่อ deadline','ช่วยผู้ใช้ตัดสินใจเร็วโดยไม่ปิดบังข้อมูลสำคัญ',true),wrong:[O('ทำทุกข้อมูลและทุก action เด่นเท่ากัน','ให้ผู้ใช้เลือกเองระหว่างทุกสิ่ง','ยิ่งเพิ่มภาระสแกนในเวลาจำกัด'),O('บังคับให้อ่านรายละเอียดทั้งหมดก่อนเริ่ม','ป้องกันการพลาดด้วยข้อความยาว','ข้อมูลสำคัญควรปรากฏตามจังหวะตัดสินใจ'),O('ให้ยืนยันเร็วแล้วค่อยบอกเงื่อนไขหลังจบ','ลดเวลาในขั้นแรก','ผู้ใช้อาจตัดสินใจผิดก่อนเห็นข้อจำกัด')]},
 {key:'mobile',name:'MOBILE CONSTRAINT',user:'ต้องทำงานบนมือถือขณะเดินทาง',impact:'พื้นที่จอและการพิมพ์ทำให้การค้นหาซ้ำมีต้นทุนสูง',prompt:'บนจอเล็ก วิธีใดรักษา task success ได้ดีที่สุด?',correct:O('รวมข้อมูลตัดสินใจและ action หลักไว้ในจอเดียว ใช้ label ชัด และไม่พึ่ง hover','ให้ผู้ใช้เห็นสิ่งจำเป็นโดยไม่ต้องไล่ค้นหา','เหมาะกับข้อจำกัดพื้นที่และการใช้งานด้วยนิ้ว',true),wrong:[O('ซ่อน action สำคัญไว้ในเมนูหลายชั้น','ทำให้หน้าแรกดูโล่ง','ย้ายภาระไปที่การจำตำแหน่ง'),O('ใช้ไอคอนแทนคำอธิบายทั้งหมด','ลดจำนวนตัวอักษรบนจอ','ผู้ใช้ใหม่อาจต้องเดาความหมาย'),O('ให้เปิดคอมพิวเตอร์ก่อนจึงทำ task นี้ได้','ย้ายปัญหาออกจาก interface','ไม่ตอบบริบทที่ผู้ใช้ต้องใช้งานตอนนี้')]},
 {key:'resume',name:'INTERRUPTED TASK',user:'ต้องหยุดทำงานกลางทางแล้วกลับมาใหม่',impact:'ผู้ใช้เสี่ยงเริ่มซ้ำหรือไม่มั่นใจว่าสิ่งใดถูกบันทึกแล้ว',prompt:'เมื่อ task ถูกขัดจังหวะ ระบบควรปกป้องผู้ใช้อย่างไร?',correct:O('บันทึก state อัตโนมัติ บอกความคืบหน้า และพากลับสู่จุดทำต่อพร้อมงานค้าง','ทำให้ผู้ใช้กลับมาทำต่อได้อย่างมั่นใจ','ลดการเริ่มใหม่และลดความกลัวข้อมูลหาย',true),wrong:[O('เริ่มฟอร์มใหม่ทุกครั้งเพื่อให้ข้อมูลสด','ลดปัญหาข้อมูลค้าง','ทำให้ผู้ใช้เสียงานที่ทำไปแล้ว'),O('เก็บทุกอย่างไว้แต่ไม่บอกสถานะ','รักษาข้อมูลในระบบหลังบ้าน','ผู้ใช้ยังไม่รู้ว่าทำอะไรเสร็จแล้ว'),O('ส่งคู่มือยาวให้ผู้ใช้จำขั้นตอนเดิม','เพิ่มข้อมูลอธิบาย','ย้ายภาระจำกลับไปที่ผู้ใช้')]},
 {key:'shared',name:'SHARED DECISION',user:'ต้องตัดสินใจกับเพื่อนหรือผู้เกี่ยวข้อง',impact:'ทุกคนต้องเห็นเงื่อนไขเดียวกันก่อนยืนยัน',prompt:'เมื่อเป็นการตัดสินใจร่วมกัน ข้อมูลใดควรอยู่ในจุดเดียว?',correct:O('ตัวเลือกที่เปรียบเทียบได้ สถานะล่าสุด เงื่อนไขสำคัญ และเหตุผลก่อนยืนยัน','ให้ทุกคนอ้างอิงข้อมูลชุดเดียวกัน','ลดการสลับหน้าและการเข้าใจไม่ตรงกัน',true),wrong:[O('ให้คนแรกที่เข้าระบบเลือกแทนทุกคน','ลดเวลาการหารือ','ไม่รองรับเงื่อนไขของผู้เกี่ยวข้องคนอื่น'),O('ส่งภาพหน้าจอหลายหน้าให้แต่ละคนตีความเอง','กระจายข้อมูลไปหลายช่องทาง','เพิ่มความเสี่ยงใช้ข้อมูลคนละเวอร์ชัน'),O('แสดงเฉพาะชื่อทางเลือกเพื่อให้ตัดสินใจเร็ว','ลดรายละเอียดก่อนเลือก','ผู้ใช้ยังต้องค้นหาเงื่อนไขสำคัญเอง')]},
 {key:'network',name:'LOW CONNECTIVITY',user:'เครือข่ายไม่เสถียรและกลัวข้อมูลหาย',impact:'ผู้ใช้ต้องรู้ว่าสิ่งใดบันทึกแล้วและควรทำอย่างไรเมื่อส่งไม่สำเร็จ',prompt:'เมื่อเครือข่ายไม่แน่นอน feedback แบบใดช่วยผู้ใช้มากที่สุด?',correct:O('บอกสถานะบันทึกชัดเจน เก็บสิ่งที่ส่งแล้ว และให้ retry หรือทางออกเมื่อส่งไม่สำเร็จ','เปลี่ยนความไม่แน่นอนให้ตรวจสอบได้','ลดการกดซ้ำและลดความเสี่ยงข้อมูลสูญหาย',true),wrong:[O('ซ่อนข้อความผิดพลาดเพื่อไม่ให้ผู้ใช้กังวล','ทำให้หน้าจอดูสงบ','ผู้ใช้ไม่รู้ว่าต้องแก้หรือรอ'),O('ปิดปุ่มทันทีโดยไม่บอกว่าอะไรเกิดขึ้น','ป้องกันการกดซ้ำ','ยังไม่สร้างความมั่นใจเรื่อง state'),O('บังคับเริ่ม task ใหม่เมื่อการเชื่อมต่อหลุด','ทำให้ flow กลับสู่ค่าเริ่มต้น','เพิ่มความเสียหายจากเครือข่ายที่ควบคุมไม่ได้')]},
 {key:'change',name:'CHANGED PLAN',user:'เงื่อนไขหรือกำหนดการเปลี่ยนระหว่างทำ task',impact:'ผู้ใช้ต้องแยกข้อมูลล่าสุดจากข้อมูลเก่าและเห็นทางเลือกสำรอง',prompt:'เมื่อแผนเปลี่ยนระหว่างทาง ระบบควรช่วยการตัดสินใจอย่างไร?',correct:O('ทำข้อมูลล่าสุดเด่น บอกสิ่งที่เปลี่ยน และเสนอทางเลือกสำรองที่ทำต่อได้ทันที','ป้องกันการใช้ข้อมูลเก่าหรือหยุดตัดสินใจ','ช่วยผู้ใช้ฟื้นแผนโดยไม่ต้องค้นหาหลายแหล่ง',true),wrong:[O('เก็บประกาศทุกฉบับไว้เด่นเท่ากัน','ให้ข้อมูลครบโดยไม่จัดเวลา','ผู้ใช้ยังต้องเดาเองว่าอะไรใช้ได้ตอนนี้'),O('ลบข้อมูลเก่าทั้งหมดโดยไม่บอกว่าอะไรเปลี่ยน','ทำให้หน้าดูสะอาด','ผู้ใช้ขาดบริบทและไม่มั่นใจผลกระทบ'),O('ให้ผู้ใช้โทรถามเจ้าหน้าที่ก่อนทุกครั้ง','ย้าย decision ออกจากระบบ','ไม่ช่วยในจังหวะที่ต้องตัดสินใจเอง')]},
 {key:'first',name:'FIRST-TIME USER',user:'เป็นครั้งแรกที่ใช้บริการนี้',impact:'คำศัพท์ภายในและโครงสร้างที่ไม่ชัดทำให้ผู้ใช้ต้องเดาเส้นทาง',prompt:'สำหรับผู้ใช้ใหม่ ระบบควรลดการเดาอย่างไร?',correct:O('ใช้ภาษาตามเป้าหมายผู้ใช้ แสดงลำดับสั้น ๆ และบอกผลลัพธ์หรือ next step ทุกจุดสำคัญ','ทำให้ mental model เริ่มต้นตรงกับระบบ','ช่วยเริ่ม task ได้โดยไม่ต้องมีผู้ช่วยข้างตัว',true),wrong:[O('ใช้รหัสและคำย่อของหน่วยงานให้ครบ','รักษาภาษาของระบบเดิม','ผู้ใช้ใหม่ยังไม่รู้ความหมายหรือที่อยู่ของข้อมูล'),O('แสดงทุกฟีเจอร์ในหน้าแรกทันที','ให้รู้ความสามารถทั้งหมด','เพิ่ม cognitive load ก่อนเริ่มงานหลัก'),O('ให้ผู้ใช้ดูคู่มือยาวก่อนใช้บริการ','สอนทุกสิ่งก่อนลงมือ','ไม่เหมาะกับการเรียนรู้ตาม task จริง')]},
 {key:'stakes',name:'HIGH STAKES',user:'หากทำผิดจะเสียเวลา โอกาส หรือพลาดกำหนดสำคัญ',impact:'การยืนยันและ recovery ต้องเชื่อถือได้ ไม่ใช่แค่หน้าจอดูสวย',prompt:'เมื่อผลของความผิดพลาดสูง ขั้นใดต้องแข็งแรงที่สุด?',correct:O('จุดตรวจทานที่เห็นผลกระทบจริง การยืนยันที่ตรวจสอบได้ และทางกู้คืนเมื่อเกิดข้อผิดพลาด','ช่วยให้ผู้ใช้ตัดสินใจอย่างมั่นใจ','ป้องกันความเสียหายโดยไม่เพิ่มขั้นตอนที่ไร้ความหมาย',true),wrong:[O('เพิ่ม animation เพื่อให้ผู้ใช้รู้สึกมั่นใจ','เพิ่มความน่าสนใจของหน้าจอ','ไม่พิสูจน์ว่าเลือกหรือส่งข้อมูลถูกต้อง'),O('เพิ่มการยืนยันหลายครั้งโดยไม่บอกความต่าง','ทำให้ดูปลอดภัยขึ้น','ผู้ใช้มักกดผ่านโดยไม่เข้าใจสิ่งที่ยืนยัน'),O('ให้ระบบเลือกแทนผู้ใช้ทุกครั้ง','ลดการตัดสินใจของผู้ใช้','อาจสร้างผลลัพธ์ผิดบริบทและแก้ไขยาก')]}
];
function makeCase(c,tw,index,id){
 const stages={};
 Object.entries(c.stages||{}).forEach(([key,s])=>{
   const correct=(s.options||[]).find(x=>x.correct)||{};
   const wrong=BAD[family(key)]||BAD.test;
   const picks=[wrong[index%3],wrong[(index+1)%3],wrong[(index+2)%3]].map(x=>({...x,correct:false}));
   stages[key]={...s,hint:txt(`${s.hint||''} ${tw.impact}`),options:[{...correct,correct:true},...picks]};
 });
 stages.pressure={prompt:`Pressure Gate • ${tw.name}: ${tw.prompt}`,hint:'เลือกแนวทางที่ปกป้อง task success ภายใต้เงื่อนไขนี้ ไม่ใช่เพียงทำหน้าจอให้ดูเรียบหรือเร็วขึ้น',options:[tw.correct,...tw.wrong]};
 return {...c,id:`${id}-${c.id}-${tw.key}`,title:`${c.title} • ${tw.name}`,user:txt(`${c.user} ${tw.user}`),symptom:txt(`${c.symptom} ${tw.impact}`),stages};
}
function expand(bank,id){
 const src=Array.isArray(bank)?bank:[];
 return src.flatMap((c,i)=>twists.map((tw,j)=>makeCase(c,tw,(i+j)%3,`${id}-variant-${i}-${j}`)));
}
function neutralize(c){
 const mapStages=st=>Object.fromEntries(Object.entries(st||{}).map(([k,s])=>[k,{...s,options:(s.options||[]).map(o=>{
   const visible=cut(`${o.label||''}${o.description?` — ${o.description}`:''}`);
   return {...o,rawLabel:o.label,label:'ทางเลือก',description:visible};
 })}]));
 const clone=x=>({...x,stages:mapStages(x.stages)});
 return {...c,bank:(c.bank||[]).map(clone),bossBank:Array.isArray(c.bossBank)?c.bossBank.map(clone):c.bossBank};
}
function upgrade(c){
 if(!c||!IDS.has(c.id))return c;
 const stages=[...(c.stages||[]),'pressure'];
 let out={...c,stages,stageMeta:{...(c.stageMeta||{}),pressure:{label:'PRESSURE GATE',instruction:'ตัดสินใจภายใต้เงื่อนไขจริง: เวลา มือถือ งานสะดุด แผนเปลี่ยน หรือความเสี่ยงสูง'}},bank:expand(c.bank,c.id),recentLimit:12};
 if(Array.isArray(c.bossBank)&&c.bossBank.length)out.bossStages=[...(c.bossStages||c.stages||[]),'pressure'];
 if(c.id==='w1')out={...out,caseCount:2,format:'24 replay case variants • 10 decisions • Pressure Gate + Reason Check',duration:'14–17 นาที'};
 if(c.id==='w2')out={...out,caseCount:2,format:'24 Design Sprint variants • 12 decisions • Pressure Gate + Reason Check',duration:'16–19 นาที'};
 if(c.id==='w3')out={...out,caseCount:2,format:'24 Cognitive Load variants • 10 decisions • Pressure Gate + Reason Check',duration:'14–17 นาที'};
 if(c.id==='w4')out={...out,caseCount:2,bank:expand(c.bank,'w4'),bossBank:expand(c.bossBank||c.bank,'w4-boss'),recentLimit:14,format:'2 Casefiles + 1 Boss Signal • 15 decisions • Pressure Gate + Reason Check',duration:'17–21 นาที'};
 if(c.id==='w5')out={...out,caseCount:2,format:'24 Concept Forge variants • 12 decisions • Pressure Gate + Reason Check',duration:'16–19 นาที'};
 if(c.id==='w6')out={...out,caseCount:2,format:'24 Flow Rescue variants • 12 decisions • Pressure Gate + Reason Check',duration:'16–19 นาที'};
 if(c.id==='b1')out={...out,bank:expand(c.bank,'b1-wave'),bossBank:expand(c.bossBank||c.bank,'b1-final'),caseCount:1,bossStages:[...stages],recentLimit:12,format:'Storm Wave + Final Boss • 14 decisions • Pressure Gate + Reason Check',duration:'18–22 นาที',intro:'ผ่าน Storm Wave แล้วเข้าสู่ Final Boss ที่บังคับเชื่อม evidence, user need, flow และ proof ภายใต้แรงกดดัน'};
 if(c.id==='b2')out={...out,bank:expand(c.bank,'b2-wave'),bossBank:expand(c.bossBank||c.bank,'b2-final'),caseCount:2,bossStages:[...stages],recentLimit:12,format:'2 Fortress Waves + Final Siege • 18 decisions • Pressure Gate + Reason Check',duration:'20–25 นาที',intro:'ฝ่า 2 Flow Waves ก่อน Final Siege: ทุก choice ต้องเชื่อม insight, IA, flow, state และ proof ภายใต้แรงกดดัน'};
 return neutralize(out);
}
function style(){
 if(document.getElementById('uxq-elite-card-style'))return;
 const s=document.createElement('style');s.id='uxq-elite-card-style';
 s.textContent='.uxq-option{min-height:136px!important;display:flex;flex-direction:column}.uxq-option b{font-size:.71rem!important;letter-spacing:.1em;text-transform:uppercase;color:var(--uxq-accent)!important}.uxq-option span{display:block;min-height:4.85em;max-height:4.85em;overflow:hidden;line-height:1.5!important}.uxq-options{align-items:stretch}.uxq-elite-pulse{margin:0 0 12px;padding:9px 12px;border:1px solid rgba(110,231,255,.42);border-left:3px solid #6ee7ff;border-radius:10px;background:rgba(110,231,255,.08);font-size:.78rem;font-weight:850;letter-spacing:.05em;color:#dffbff}.uxq-elite-pulse--pressure{border-color:rgba(255,189,89,.6);border-left-color:#ffbd59;background:rgba(255,189,89,.1);color:#fff2cf}';
 document.head.appendChild(s);
}
function mountPulse(){
 const game=document.querySelector('.uxq-game');if(!game)return;
 const bar=game.querySelector('.uxq-casebar');if(!bar||bar.querySelector('.uxq-elite-pulse'))return;
 const pressure=/PRESSURE GATE/i.test(bar.textContent||'');
 const el=document.createElement('div');el.className='uxq-elite-pulse'+(pressure?' uxq-elite-pulse--pressure':'');
 el.textContent=pressure?'⚠ PRESSURE GATE — ปกป้อง task success ก่อนความสวยหรือความเร็ว':'⚡ ELITE RUN — รักษา Verified Combo ด้วยหลักฐานและเหตุผล';
 bar.insertAdjacentElement('afterend',el);
}
const observer=new MutationObserver(()=>mountPulse());
if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
const prior=Object.getOwnPropertyDescriptor(window,'UXQMissionEngine');let current;
Object.defineProperty(window,'UXQMissionEngine',{
 configurable:true,
 get(){return current||(prior&&prior.get?prior.get.call(window):undefined)},
 set(engine){
   if(prior&&prior.set){prior.set.call(window,engine);engine=prior.get?prior.get.call(window):engine;}
   if(!engine||typeof engine.init!=='function'){current=engine;return;}
   const init=engine.init.bind(engine);
   current=Object.freeze({...engine,init(config){style();return init(upgrade(config));}});
 }
});
window.UXQEliteW1B2=Object.freeze({version:'v3',upgrade});
})();