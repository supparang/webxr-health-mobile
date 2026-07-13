/* CSAI2102 AI Quest — Challenge Replay Layer v7.1.3
   Case-answer diversity patch
   - fixes repeated correct answers across different cases
   - adds concept-specific reasoning for S1-S6, B1 and B2
   - preserves replay, balanced answer slots, reflection guard and Sheet schema
*/
(()=>{'use strict';
if(window.AIQuestChallengeLayerV713)return;
const VERSION='v7.1.3',RISK=['LOW','MEDIUM','HIGH','CRITICAL'];
const slots=[2,0,3,1,0,2,1,3,1,3,0,2,3,1,0];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const pick=(a,k)=>a[hash(k)%a.length];
const idOf=x=>String(x||'s1').toLowerCase().replace('mission','s').replace('boss','b').replace(/^m/,'s');
const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const ctx=c=>clean(c.context||'ระบบในมหาวิทยาลัย');
const risk=c=>clean(c.risk||((c.prompt||'').match(/พบว่า ([^\n]+?) ผู้เรียน/)||[])[1]||'ข้อมูลยังไม่แน่นอน');
const pol=c=>clean(c.policy||'human-review');
const focus=c=>clean(c.concept||'หลักการของด่าน');
function riskOf(i,c){let x=i>=13?3:i>=9?2:i>=5?1:0;const t=(c.prompt+' '+c.policy+' '+c.concept).toLowerCase();if(/rights|privacy|human|safe|critical/.test(t))x++;return RISK[Math.max(0,Math.min(3,x))]}
function balance(opts){const m=Math.max(...opts.map(x=>clean(x).length));return opts.map(x=>{let v=clean(x);if(v.length<m-22)v+=' โดยอิงข้อมูลของเคสนี้';return v})}
const BANK={
s1:{
 ok:[
  c=>`ตรวจว่า ${ctx(c)} มีข้อมูลเข้า โมเดลที่เรียนรู้ และผลทำนายจริงหรือไม่ ก่อนจัดว่าเป็น AI`,
  c=>`แยกขั้นตอนอัตโนมัติแบบกฎตายตัวออกจากส่วนที่เรียนรู้จากข้อมูลใน ${ctx(c)}`,
  c=>`ขอหลักฐาน data-model-output ของ ${ctx(c)} เพราะภาวะ ${risk(c)} ยังทำให้สรุปว่าเป็น AI ไม่ได้`,
  c=>`จัดระบบนี้เป็น decision support และให้มนุษย์ยืนยันผล เมื่อ ${risk(c)} กระทบผู้ใช้`,
  c=>`ตรวจ source ของคำตอบและขอบเขตงานก่อนเรียกว่า AI ไม่ใช้เพียงคำโฆษณาของระบบ`,
  c=>`ถ้ามีเพียง trigger และเงื่อนไข IF-THEN ให้จัดเป็น rule-based automation ไม่ใช่ learning AI`,
  c=>`เปรียบเทียบผลเดิมกับข้อมูลใหม่เพื่อดูว่าระบบปรับจากข้อมูลหรือทำตามคำสั่งเดิม`,
  c=>`ระบุสิ่งที่ระบบรับเข้า สิ่งที่คำนวณ และสิ่งที่ส่งออก แล้วค่อยตัดสินชนิดของระบบ`
 ],
 bad:[
  c=>`เรียกว่า AI เพราะ ${ctx(c)} ทำงานได้เร็วและดูซับซ้อน`,
  c=>`ถือว่าเป็น AI ทันทีเพราะระบบให้คะแนนหรือคำแนะนำอัตโนมัติ`,
  c=>`ดูเฉพาะหน้าจอและชื่อผลิตภัณฑ์โดยไม่ตรวจข้อมูลหรือโมเดล`,
  c=>`สรุปว่าไม่ใช่ AI เพราะยังมีมนุษย์กดอนุมัติ`,
  c=>`ใช้ความแม่นยำรอบเดียวเป็นหลักฐานว่าระบบเรียนรู้ได้`,
  c=>`เชื่อคำว่า smart หรือ intelligent ในชื่อระบบแทนการตรวจกลไก`
 ]},
s2:{
 ok:[
  c=>`กำหนด P เป็นความปลอดภัยและความถูกต้อง E คือ ${ctx(c)} A คือการแจ้งเตือนหรือปรับการทำงาน และ S คือข้อมูลที่ตรวจจับได้จริง`,
  c=>`แยก sensor ที่รับรู้ ${risk(c)} ออกจาก actuator ที่เปลี่ยนสภาพแวดล้อมหรือส่งคำสั่ง`,
  c=>`เลือก rational action จาก percept ปัจจุบัน เป้าหมาย และผลกระทบ ไม่ใช่เลือกคำตอบที่เร็วที่สุด`,
  c=>`จำกัด autonomy ของ agent และส่งให้มนุษย์ตรวจเมื่อ sensor confidence ต่ำหรือเกิน scope`,
  c=>`ออกแบบ performance measure ให้รวมความปลอดภัย ความเป็นธรรม และข้อผิดพลาด ไม่ใช่ความเร็วอย่างเดียว`,
  c=>`บันทึก percept เหตุผล action และผู้ override เพื่อให้ตรวจสอบย้อนหลังได้`,
  c=>`ใช้ safe fallback เมื่อ ${risk(c)} เช่นหยุด action อัตโนมัติและขอข้อมูลเพิ่ม`,
  c=>`กำหนด agent boundary ว่าส่วนใดรับรู้ ตัดสินใจ และกระทำ รวมถึงสิ่งที่ห้ามทำเอง`
 ],
 bad:[
  c=>`ให้ agent ทำทุกขั้นตอนเองเพราะมี sensor หลายตัว`,
  c=>`ใช้จำนวน action เป็น performance measure หลักของ ${ctx(c)}`,
  c=>`นับข้อมูลในฐานข้อมูลทั้งหมดเป็น sensor แม้ agent ไม่ได้รับรู้ข้อมูลนั้น`,
  c=>`เรียกข้อความบนหน้าจอทุกอย่างว่า actuator`,
  c=>`เพิ่ม autonomy เมื่อความมั่นใจต่ำเพื่อให้ระบบเรียนรู้เร็วขึ้น`,
  c=>`ไม่ต้องเก็บ log เพราะมนุษย์สามารถตรวจผลภายหลังได้`
 ]},
s3:{
 ok:[
  c=>`นิยาม state ปัจจุบันของ ${ctx(c)} goal ที่ต้องการ action ที่ทำได้ และ constraint จาก ${risk(c)} ให้ครบก่อนค้นทางแก้`,
  c=>`เลือก action ที่พา state เข้าใกล้ goal โดยไม่ละเมิดข้อจำกัดด้านสิทธิ์ เวลา หรือทรัพยากร`,
  c=>`สร้าง transition model ว่าแต่ละ action เปลี่ยน state อย่างไร แล้วตรวจ failure state`,
  c=>`แยก goal ออกจากวิธีทำ เพื่อไม่ผูกคำตอบกับ action เดียวตั้งแต่ต้น`,
  c=>`คำนวณ path cost รวม ไม่เลือกขั้นตอนแรกที่ดูดีแต่ทำให้ต้นทุนปลายทางสูง`,
  c=>`หยุดและขอข้อมูลเพิ่มเมื่อ state ไม่ครบจนประเมิน constraint ไม่ได้`,
  c=>`ตรวจว่า goal วัดผลได้และไม่ขัดกับ constraint ของผู้ใช้ใน ${ctx(c)}`,
  c=>`เปรียบเทียบทางเลือกจากผลลัพธ์ปลายทางและความเสี่ยง ไม่ใช่จำนวนขั้นตอนเพียงอย่างเดียว`
 ],
 bad:[
  c=>`เริ่มลงมือทันทีแล้วค่อยกำหนด goal หลังเห็นผล`,
  c=>`เลือก action ที่สั้นที่สุดแม้ละเมิด constraint ของ ${ctx(c)}`,
  c=>`ถือว่า state คือชื่อสถานที่เพียงอย่างเดียว`,
  c=>`เปลี่ยน goal ทุกครั้งที่ action แรกไม่สำเร็จ`,
  c=>`ละเว้น failure state เพราะระบบสามารถลองใหม่ได้`,
  c=>`ใช้ path ที่มีโหนดน้อยที่สุดแทนการดู cost จริง`
 ]},
b1:{
 ok:[
  c=>`ยืนยันก่อนว่าระบบส่วนใดเป็น AI จากหลักฐาน แล้วกำหนด PEAS และ state-goal-constraint ของ ${ctx(c)} ก่อนอนุมัติ action`,
  c=>`เชื่อม AI identity กับ agent boundary และหยุดระบบเมื่อ ${risk(c)} ทำให้ rational action ตรวจสอบไม่ได้`,
  c=>`ให้มนุษย์ตรวจ evidence ของโมเดล sensor และข้อจำกัดก่อนเปิดใช้ผลตัดสินใน ${ctx(c)}`,
  c=>`ใช้ fallback ที่ย้อนกลับได้ พร้อม audit trail ของ percept action และเหตุผลเมื่อความเสี่ยงสูง`,
  c=>`แยก automation, agent decision และ problem-solving step แล้วกำหนดเจ้าของความรับผิดชอบแต่ละส่วน`,
  c=>`อนุมัติเฉพาะ action ที่บรรลุ goal โดยไม่ละเมิดสิทธิ์และมีหลักฐานเพียงพอ`,
  c=>`ตรวจทั้งความถูกต้องของข้อมูล ขอบเขต autonomy และผลกระทบต่อผู้ใช้ก่อนผ่าน Boss Gate`,
  c=>`เมื่อหลักฐานขัดแย้ง ให้พักการตัดสิน ขอข้อมูลเพิ่ม และให้ reviewer เลือกทางเลือกที่ปลอดภัย`
 ],
 bad:[
  c=>`ผ่าน Boss Gate เพราะ S1-S3 แยกกันได้ แม้เคสนี้ยังไม่มี evidence`,
  c=>`เชื่อ output ของ agent เพราะคะแนนก่อนหน้าสูง`,
  c=>`เลือก action ที่ทำให้ goal สำเร็จเร็วที่สุดแม้ข้าม constraint`,
  c=>`ให้มนุษย์ตรวจเฉพาะเมื่อระบบล้มเหลวแล้ว`,
  c=>`ใช้ fallback เดียวกับทุกระดับความเสี่ยง`,
  c=>`เก็บเฉพาะผลสุดท้ายโดยไม่บันทึก percept หรือเหตุผล`
 ]},
s4:{
 ok:[
  c=>`ใช้ BFS เมื่อทุก step cost ใกล้กันและต้องการคำตอบตื้นที่สุด พร้อม visited set กันวนซ้ำ`,
  c=>`ใช้ DFS เมื่อพื้นที่ลึก หน่วยความจำจำกัด และยอมรับว่าอาจไม่ optimal`,
  c=>`ใช้ UCS เมื่อต้นทุนเส้นทางต่างกัน โดยขยายโหนดที่ cumulative cost ต่ำสุดก่อน`,
  c=>`ตรวจ frontier และ visited set ของ ${ctx(c)} เพื่อไม่ขยายสถานะเดิมซ้ำ`,
  c=>`เลือกวิธีค้นจาก completeness optimality memory และ cost ไม่เลือกจากชื่อ algorithm`,
  c=>`ถ้า ${risk(c)} ทำให้ edge cost เปลี่ยน ต้องอัปเดตต้นทุนก่อนยอมรับเส้นทาง`,
  c=>`เปรียบเทียบ goal depth กับ path cost ก่อนตัดสินว่า BFS หรือ UCS เหมาะกว่า`,
  c=>`หยุดเมื่อดึง goal ที่มี cost ต่ำสุดออกจาก priority queue ไม่หยุดแค่ตอนพบ goal ครั้งแรก`
 ],
 bad:[
  c=>`ใช้ DFS เสมอเพราะไปถึงปลายทางได้เร็วในบางรอบ`,
  c=>`ใช้ BFS แล้วถือว่าได้ต้นทุนต่ำสุดแม้ edge cost ไม่เท่ากัน`,
  c=>`ใช้ UCS แต่เรียง frontier ตามจำนวน step`,
  c=>`ไม่ต้องมี visited set เพราะเส้นทางซ้ำอาจให้คำตอบใหม่`,
  c=>`หยุดทันทีเมื่อสร้าง goal node แม้ยังมี frontier cost ต่ำกว่า`,
  c=>`เลือก algorithm จากจำนวนโหนดที่มองเห็นบนหน้าจอเท่านั้น`
 ]},
s5:{
 ok:[
  c=>`คำนวณ f(n)=g(n)+h(n) และเลือกโหนด f ต่ำสุด โดยตรวจว่า h ไม่ overestimate`,
  c=>`ใช้ Greedy เมื่อเน้น h(n) อย่างเดียวและยอมรับว่าอาจไม่ optimal`,
  c=>`ตรวจ admissibility ของ heuristic ด้วยการเทียบ h กับต้นทุนจริงที่เหลือในตัวอย่าง`,
  c=>`เมื่อ ${risk(c)} ทำให้ heuristic ไม่น่าเชื่อถือ ให้ลดน้ำหนัก h หรือกลับไปใช้ UCS`,
  c=>`แยกต้นทุนที่จ่ายแล้ว g(n) จากค่าประมาณที่เหลือ h(n) ก่อนตัดสิน`,
  c=>`ใช้ consistent heuristic เพื่อให้ f ไม่ลดผิดปกติตามเส้นทาง`,
  c=>`ทดสอบ heuristic กับหลายบริบทของ ${ctx(c)} ไม่สรุปจากเส้นทางเดียว`,
  c=>`ยอมรับ goal เมื่อถูกเลือกจาก frontier ภายใต้เงื่อนไขของ A* ไม่ใช่เพียงถูกสร้างขึ้น`
 ],
 bad:[
  c=>`เลือก h ต่ำสุดแล้วเรียกว่า A* แม้ไม่รวม g`,
  c=>`ทำให้ heuristic สูงไว้ก่อนเพื่อเร่งค้นหาโดยไม่สน optimality`,
  c=>`ใช้ g เป็นระยะเส้นตรงถึง goal`,
  c=>`เชื่อ heuristic เดิมแม้บริบทและ cost เปลี่ยน`,
  c=>`เลือก path จาก f ของโหนดแรกเพียงค่าเดียว`,
  c=>`ถือว่า heuristic ทุกแบบ admissible ถ้าค้นเจอ goal`
 ]},
s6:{
 ok:[
  c=>`กำหนด MAX ให้เลือก utility สูงสุดและ MIN ให้เลือกทางตอบโต้ที่ลด utility ของเรา`,
  c=>`เลือก action จากค่าที่คู่แข่งสามารถบังคับให้เกิดได้ ไม่เลือกแต้มทันทีสูงสุด`,
  c=>`ประเมิน terminal state หรือ cutoff evaluation ก่อนย้อนค่า minimax`,
  c=>`ใช้ alpha-beta ตัดกิ่งที่ไม่เปลี่ยนคำตอบ โดยไม่เปลี่ยนค่าผลลัพธ์ minimax`,
  c=>`เมื่อ opponent model ไม่แน่นอน ให้เลือก safe move ที่ลด worst-case loss`,
  c=>`ตรวจลำดับ MAX/MIN ของ ${ctx(c)} ก่อนคำนวณ ไม่สลับบทบาทระหว่างชั้น`,
  c=>`เปรียบเทียบ utility ระยะยาวกับผลตอบโต้ของคู่แข่งภายใต้ ${risk(c)}`,
  c=>`ถ้า depth limit สั้น ให้ระบุข้อจำกัดของ evaluation และไม่อ้างว่าเป็นคำตอบสมบูรณ์`
 ],
 bad:[
  c=>`เลือก action ที่ได้คะแนนทันทีสูงสุดโดยไม่ดูตาคู่แข่ง`,
  c=>`ให้ทั้ง MAX และ MIN เลือกค่ามากที่สุด`,
  c=>`ใช้ alpha-beta เพื่อเปลี่ยนคำตอบให้ดีกว่า minimax`,
  c=>`หยุดที่ non-terminal node แล้วใช้คะแนนปัจจุบันเป็นผลจริง`,
  c=>`สมมติว่าคู่แข่งเลือกแบบสุ่มเสมอ`,
  c=>`เลือกกิ่งที่มีจำนวนทางเลือกมากที่สุดแทน utility`
 ]},
b2:{
 ok:[
  c=>`เลือก UCS หรือ A* จาก cost และ heuristic แล้วใช้ minimax เฉพาะส่วนที่มีคู่แข่งตอบโต้`,
  c=>`ตรวจ frontier cost, heuristic admissibility และ opponent response ก่อนผ่าน ${ctx(c)}`,
  c=>`ไม่ใช้ strategy เดียวทั้งเคส: แยกช่วงค้นเส้นทาง ช่วงประมาณค่า และช่วงตัดสินกับคู่แข่ง`,
  c=>`เมื่อ heuristic เสี่ยงจาก ${risk(c)} ให้ fallback เป็น UCS และประเมิน worst-case response`,
  c=>`ยืนยัน optimality จากเงื่อนไขของ algorithm ไม่ใช่เพราะเส้นทางดูสั้น`,
  c=>`บันทึก g h f และ minimax utility เพื่อให้ reviewer ตรวจ reasoning trace ได้`,
  c=>`หยุดค้นเมื่อเกณฑ์ของ algorithm ครบ และหยุด game action เมื่อ worst-case เกินขอบเขต`,
  c=>`เปรียบเทียบ completeness memory cost และ adversarial risk ก่อนเลือกแผนสุดท้าย`
 ],
 bad:[
  c=>`ใช้ BFS ทุกช่วงเพราะเข้าใจง่ายและค้นครบ`,
  c=>`ใช้ Greedy ตลอดเพราะ h ต่ำสุดดูใกล้ goal`,
  c=>`ใช้ minimax กับปัญหาที่ไม่มีคู่แข่งทุกกรณี`,
  c=>`เลือก strategy จากคะแนนของรอบก่อนโดยไม่ดูโครงสร้างเคส`,
  c=>`หยุดเมื่อพบ goal ครั้งแรกและไม่ตรวจ cost`,
  c=>`ใช้ heuristic เดียวกับทุกบริบทแม้ข้อจำกัดต่างกัน`
 ]}
};
const genericOK=[
 c=>`เลือก action ที่สอดคล้องกับ ${focus(c)} และตรวจหลักฐานของ ${ctx(c)} ก่อนใช้งาน`,
 c=>`อธิบายเหตุผลจากข้อมูล ความเสี่ยง ${risk(c)} และขอบเขตที่มนุษย์ต้องตรวจ`,
 c=>`ใช้ผลที่ตรวจสอบย้อนกลับได้ พร้อม fallback และ owner เมื่อความมั่นใจไม่พอ`,
 c=>`เปรียบเทียบทางเลือกตาม concept ของด่าน ไม่ใช้คะแนนรวมเพียงค่าเดียว`,
 c=>`บันทึก evidence decision และผลกระทบต่อผู้ใช้ก่อนอนุมัติ action`
];
const genericBAD=[
 c=>`เลือกคำตอบที่เร็วที่สุดของ ${ctx(c)} โดยไม่ตรวจหลักฐาน`,
 c=>`เชื่อผลระบบทันทีเพราะคะแนนความมั่นใจสูง`,
 c=>`ใช้ค่า default เดียวกับทุกบริบท`,
 c=>`ซ่อนความไม่แน่ใจเพื่อให้ผู้ใช้ตัดสินใจง่าย`,
 c=>`ตรวจเฉพาะผลรวมโดยไม่ดูผู้ได้รับผลกระทบ`,
 c=>`รอให้เกิดปัญหาแล้วจึงให้มนุษย์ review`
];
function uniqueOptions(card,i,r,sid){
 const pack=BANK[sid]||{ok:genericOK,bad:genericBAD};
 const key=sid+'|'+(card.fingerprint||card.id)+'|'+i+'|'+r;
 const okFn=pack.ok[hash('ok|'+key)%pack.ok.length];
 const correct=clean(okFn(card));
 const start=hash('bad|'+key)%pack.bad.length,d=[];
 for(let k=0;k<pack.bad.length&&d.length<3;k++){
  const text=clean(pack.bad[(start+k)%pack.bad.length](card));
  if(text!==correct&&!d.includes(text))d.push(text);
 }
 while(d.length<3){const text=clean(genericBAD[(start+d.length)%genericBAD.length](card));if(!d.includes(text)&&text!==correct)d.push(text)}
 const all=balance([correct,...d]);
 return {correct:all[0],distractors:all.slice(1)};
}
function enhance(raw,id,r){
 const sid=idOf(id),out=[];
 (raw||[]).slice(0,15).forEach((card,i)=>{
  const opt=uniqueOptions(card,i,r,sid),level=riskOf(i,card);
  out.push({...card,correct:opt.correct,distractors:opt.distractors,answerSlot:slots[(i+r)%slots.length],riskLevel:level,prompt:'['+level+' RISK] '+ctx(card)+' • '+clean(card.prompt||focus(card))+'\nพิจารณาหลักฐาน เงื่อนไข และผลกระทบของเคสนี้',principle:(card.title||sid)+' • '+focus(card)+' • คำตอบต้องเฉพาะกับบริบทและหลักฐาน ไม่ใช่สูตรสำเร็จ',fingerprint:(card.fingerprint||card.id)+'|diverse713|'+i+'|'+r,challengeTrap:'case-specific reasoning',challengeVersion:VERSION});
 });
 out.challengeAudit={version:VERSION,noRepeatWindow:'last 4 decks / 60 fingerprints',antiGuessPolish:'all S1-B2 concept-specific answers and plausible distractors',uniqueCorrect:new Set(out.map(c=>c.correct)).size,uniqueDistractors:new Set(out.flatMap(c=>c.distractors)).size,slots:[0,1,2,3].map(s=>out.filter(c=>c.answerSlot===s).length),riskMix:RISK.map(x=>out.filter(c=>c.riskLevel===x).length)};
 return out;
}
function rank(score){return score>=95?'AI Master':score>=85?'AI Quest Specialist':score>=70?'Agent Designer':score>=60?'Junior AI Inspector':'Rookie Analyst'}
function comboTitle(n){return ['Insight Spark','Logic Chain','Agent Flow','Reasoning Surge','Boss Break','Perfect Deck'][Math.min(5,Math.floor(Number(n||0)/3))]}
function patch(){
 const C=window.AIQuestAllContentV702;
 if(!C||C.__challengeV713)return false;
 const base=C.deck.bind(C);
 C.deck=(id,r)=>{
  const sid=idOf(id),round=Number(r||1),histKey='CSAI2102_RECENT_FINGERPRINTS_V713_'+sid,hist=new Set(read(histKey,[])),raw=[];
  for(let b=0;b<10&&raw.length<15;b++)for(const c of base(sid,round+b)||[]){const fp=c.fingerprint||c.id;if(raw.length<15&&!hist.has(fp)&&!raw.some(x=>(x.fingerprint||x.id)===fp))raw.push(c)}
  if(raw.length<15)for(const c of base(sid,round+99)||[])if(raw.length<15&&!raw.some(x=>(x.fingerprint||x.id)===(c.fingerprint||c.id)))raw.push(c);
  const d=enhance(raw,sid,round);write(histKey,[...hist,...d.map(c=>c.fingerprint||c.id)].slice(-60));return d;
 };
 C.rank=rank;C.comboTitle=comboTitle;C.challengeLayerVersion=VERSION;C.version='v7.0.2+challenge713';C.__challengeV713=C.__challengeV7128=C.__challengeV706=true;return true;
}
function suspicious(t){t=String(t||'');return t.length>2500||(t.match(/\t/g)||[]).length>=8||/challenge711_[a-z0-9]+[\s\S]*schemaVersion/i.test(t)}
function guard(){const fs=['r1','r2','r3'].map(id=>document.getElementById(id)).filter(Boolean),note=document.getElementById('saveNote'),save=document.getElementById('save');fs.forEach(el=>el.addEventListener('paste',e=>{const t=(e.clipboardData||window.clipboardData)?.getData('text')||'';if(suspicious(t)){e.preventDefault();if(note){note.className='notice bad';note.textContent='⚠️ กรุณาวางเฉพาะคำตอบ Reflection ไม่ใช่ข้อมูลทั้งแถวหรือ JSON';}}}));if(save)save.addEventListener('click',e=>{const bad=fs.find(x=>suspicious(x.value));if(bad){e.preventDefault();e.stopImmediatePropagation();if(note){note.className='notice bad';note.textContent='⚠️ ยังส่งไม่ได้: Reflection มีข้อมูลทั้งแถว/JSON';}bad.focus()}},true)}
if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',guard,{once:true});else guard();
window.AIQuestChallengeLayerV706={version:VERSION,replayRules:['Case-specific correct answers','Concept-specific plausible distractors','15 unique correct-answer targets per deck','Balanced answer slots','No-repeat window','Reflection paste guard'],rank,comboTitle};window.AIQuestChallengeLayerV713=window.AIQuestChallengeLayerV706;
})();