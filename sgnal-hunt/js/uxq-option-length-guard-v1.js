/* UX Quest • Elite W1–B2 Question Upgrade v2
   Expands replay variants, makes B1/B2 true wave + final-boss runs,
   removes answer-length / answer-shape cues, and assigns every replay case a unique ID. */
(()=>{'use strict';
const IDS=new Set(['w1','w2','w3','b1','w4','w5','w6','b2']);
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const cut=(v,n=154)=>{v=txt(v);return v.length>n?v.slice(0,n-1)+'…':v};
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
const variants=[
 ['Deadline Rush','ใกล้เส้นตายและมีเวลาเพียงไม่กี่นาที','เงื่อนไขเวลาเพิ่มผลกระทบของการย้อนกลับ'],
 ['Mobile Constraint','ต้องทำงานบนมือถือขณะเดินทาง','พื้นที่หน้าจอและความต่อเนื่องของ task มีผลต่อการตัดสินใจ'],
 ['Interrupted Task','ต้องหยุดทำงานกลางทางแล้วกลับมาใหม่','ผู้ใช้ต้องรู้ state เดิมและจุดทำต่อ'],
 ['Shared Decision','ต้องตัดสินใจกับเพื่อนหรือผู้เกี่ยวข้อง','ข้อมูลที่ใช้เปรียบเทียบต้องมองเห็นร่วมกัน'],
 ['Low Connectivity','เครือข่ายไม่เสถียรและกลัวข้อมูลหาย','feedback และ recovery มีผลต่อความมั่นใจ'],
 ['Changed Plan','เงื่อนไขหรือกำหนดการเปลี่ยนระหว่างทำ task','ผู้ใช้ต้องเห็นข้อมูลล่าสุดและทางเลือกสำรอง'],
 ['First-time User','เป็นครั้งแรกที่ใช้บริการนี้','ภาษาระบบและลำดับ action ต้องไม่บังคับให้เดา'],
 ['High Stakes','หากทำผิดจะเสียเวลา โอกาส หรือพลาดกำหนดสำคัญ','จุดยืนยันและ next step ต้องตรวจสอบได้']
];
function makeCase(c,m,index,id){
 const stages={};
 Object.entries(c.stages||{}).forEach(([key,s])=>{
   const correct=(s.options||[]).find(x=>x.correct)||{};
   const wrong=BAD[family(key)]||BAD.test;
   const picks=[wrong[index%3],wrong[(index+1)%3],wrong[(index+2)%3]].map(x=>({...x,correct:false}));
   stages[key]={...s,hint:txt(`${s.hint||''} ${m[2]}`),options:[{...correct,correct:true},...picks]};
 });
 return {...c,id:`${id}-${c.id}-${index}`,title:`${c.title} • ${m[0]}`,user:txt(`${c.user} ${m[1]}`),symptom:txt(`${c.symptom} ${m[2]}`),stages};
}
function expand(bank,id){
 const src=Array.isArray(bank)?bank:[];
 return src.flatMap((c,i)=>variants.map((m,j)=>makeCase(c,m,(i+j)%3,`${id}-variant-${i}-${j}`)));
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
 let out={...c,bank:expand(c.bank,c.id),recentLimit:12};
 if(c.id==='w1')out={...out,caseCount:2,format:'24 replay case variants • 8 decisions • Reason Check ทุกจุด',duration:'12–15 นาที'};
 if(c.id==='w2')out={...out,caseCount:2,format:'24 Design Sprint variants • 10 decisions • Reason Check ทุกจุด',duration:'14–17 นาที'};
 if(c.id==='w3')out={...out,caseCount:2,format:'24 Cognitive Load variants • 8 decisions • Reason Check ทุกจุด',duration:'12–15 นาที'};
 if(c.id==='w4')out={...out,caseCount:2,bank:expand(c.bank,'w4'),bossBank:expand(c.bossBank||c.bank,'w4-boss'),recentLimit:14,format:'2 Casefiles + 1 Boss Signal • expanded replay variants • Reason Check ทุกจุด'};
 if(c.id==='w5')out={...out,caseCount:2,format:'24 Concept Forge variants • 10 decisions • Reason Check ทุกจุด',duration:'14–17 นาที'};
 if(c.id==='w6')out={...out,caseCount:2,format:'24 Flow Rescue variants • 10 decisions • Reason Check ทุกจุด',duration:'14–17 นาที'};
 if(c.id==='b1')out={...out,bank:expand(c.bank,'b1-wave'),bossBank:expand(c.bossBank||c.bank,'b1-final'),caseCount:1,bossStages:[...(c.stages||[])],recentLimit:12,format:'Storm Wave + Final Boss • 12 decisions • Reason Check',duration:'16–20 นาที',intro:'ผ่านหนึ่ง Storm Wave แล้วเข้าสู่ Final Boss ที่เปลี่ยนบริบทและเพิ่มแรงกดดันในการตัดสินใจ'};
 if(c.id==='b2')out={...out,bank:expand(c.bank,'b2-wave'),bossBank:expand(c.bossBank||c.bank,'b2-final'),caseCount:2,bossStages:[...(c.stages||[])],recentLimit:12,format:'2 Fortress Waves + Final Siege • 15 decisions • Reason Check',duration:'18–22 นาที',intro:'ฝ่าด่าน 2 Flow Waves ก่อนเข้าสู่ Final Siege ที่บังคับเชื่อม insight, IA, flow และ proof'};
 return neutralize(out);
}
function style(){
 if(document.getElementById('uxq-elite-card-style'))return;
 const s=document.createElement('style');s.id='uxq-elite-card-style';
 s.textContent='.uxq-option{min-height:132px!important;display:flex;flex-direction:column}.uxq-option b{font-size:.71rem!important;letter-spacing:.1em;text-transform:uppercase;color:var(--uxq-accent)!important}.uxq-option span{display:block;min-height:4.75em;max-height:4.75em;overflow:hidden;line-height:1.5!important}.uxq-options{align-items:stretch}';
 document.head.appendChild(s);
}
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
window.UXQEliteW1B2=Object.freeze({version:'v2',upgrade});
})();