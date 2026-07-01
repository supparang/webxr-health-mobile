/* CSAI2102 AI Quest — S6 Knowledge Base Forge v3.6.1
   Thai-first bilingual question bank. Thai leads instruction; English terms
   remain in parentheses or notation for disciplinary literacy.
*/
(function(){
  'use strict';
  const VERSION='v3.6.1-s6-thai-first-bilingual';
  const shuffle=a=>{const x=(a||[]).slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
  function item(phase,family,prompt,answer,choices,explain,hint){return {id:`s6_${phase.toLowerCase().replace(/\W+/g,'_')}_${family}_${Math.random().toString(36).slice(2,7)}`,family,phase,prompt,answer,choices:shuffle([answer].concat(choices||[]).filter(Boolean)).slice(0,4),explain,hint};}

  const CONCEPT=[
    item('แนวคิดความรู้ (Knowledge Concept)','fact_1','ข้อใดเป็นข้อเท็จจริง (fact) ในฐานความรู้มากที่สุด?','fever(patient1)','IF fever THEN check_infection / ตารางผู้ป่วย / คะแนนพยากรณ์','fact คือข้อความที่บอกความจริงเฉพาะกรณี','มองหาข้อความที่ยืนยันว่าใครหรือสิ่งใดมีคุณสมบัติอะไร'),
    item('แนวคิดความรู้ (Knowledge Concept)','rule_1','ข้อใดเป็นกฎ (rule) มากที่สุด?','IF fever AND cough THEN possible_flu','patient1 has fever / temperature=38.5 / patient profile','rule มีเงื่อนไขและข้อสรุปในรูปแบบ IF…THEN','มองหาข้อความที่บอกว่าเมื่อเงื่อนไขครบแล้วระบบสรุปอะไร'),
    item('แนวคิดความรู้ (Knowledge Concept)','kb_db','ฐานความรู้ (knowledge base) ต่างจากฐานข้อมูล (database) อย่างไร?','ฐานความรู้เก็บ facts และ rules เพื่อให้ระบบอนุมานได้','ฐานข้อมูลอนุมานได้เสมอ / ฐานความรู้มีแต่ตัวเลข / ฐานข้อมูลไม่มีข้อมูลจริง','ฐานความรู้ไม่ได้เก็บข้อมูลอย่างเดียว แต่มีความรู้เชิงกฎสำหรับ reasoning','คิดถึงระบบที่ตอบคำถามหรือสรุปผลใหม่จากกฎได้'),
    item('แนวคิดความรู้ (Knowledge Concept)','ontology','ออนโทโลยี (ontology) ใช้ทำอะไรใน AI?','กำหนดชนิดของสิ่งต่าง ๆ และความสัมพันธ์ระหว่างแนวคิด','เก็บรูปภาพอย่างเดียว / สุ่มคำตอบ / เพิ่มความเร็ว CPU','ontology ช่วยจัดโครงสร้างความหมาย เช่น class และ relation','มองหาคำตอบที่พูดถึงชนิด ความหมาย และความสัมพันธ์'),
    item('แนวคิดความรู้ (Knowledge Concept)','symbolic','Symbolic AI เหมาะกับงานใดมากที่สุด?','งานที่ต้องอธิบายกฎและเหตุผลของคำตอบได้','งานที่มีภาพล้านภาพแต่ไม่ต้องอธิบาย / งานสุ่มตัวเลข / งานที่ไม่มีความรู้ชัดเจน','Symbolic AI เด่นเรื่องกฎ ความรู้ และการอธิบายเหตุผล','มองหางานที่ผู้ใช้หรือครูต้องตรวจเส้นทางการตัดสินใจได้'),
    item('แนวคิดความรู้ (Knowledge Concept)','repr','ข้อใดเป็นการแทนความรู้ (knowledge representation)?','semantic network ที่แสดงแนวคิดและความสัมพันธ์','ไฟล์รูปภาพเฉย ๆ / ค่าแบตเตอรี่ / จำนวนการคลิก','การแทนความรู้ต้องทำให้เครื่องใช้เหตุผลต่อได้','มองหาการแสดง concept และ relation'),
    item('แนวคิดความรู้ (Knowledge Concept)','infer','การอนุมาน (inference) หมายถึงอะไร?','สรุปความรู้ใหม่จาก facts และ rules','ลบข้อมูลทั้งหมด / แค่เก็บข้อมูล / สุ่มผลลัพธ์','inference คือการได้ข้อสรุปจากความรู้ที่มีอยู่','มองหาคำตอบที่เชื่อม fact และ rule ไปสู่ conclusion'),
    item('แนวคิดความรู้ (Knowledge Concept)','cwa','แนวคิด closed-world assumption คืออะไร?','ในบางระบบ สิ่งที่ไม่พบข้อมูลจะถูกถือว่าเป็น false','สิ่งที่ไม่รู้ถือว่า true เสมอ / ห้ามมี rule / ห้ามมี fact','CWA เป็นวิธีตีความข้อมูลที่ไม่รู้ในบางระบบตรรกะและฐานข้อมูล','ถามตัวเองว่า unknown ถูกตีความว่าอย่างไร')
  ];

  const REPRESENT=[
    item('เลือกวิธีแทนความรู้ (Representation Choice)','r1','โจทย์บอกว่า “ถ้าฝนตก ถนนเปียก” ควรแทนความรู้แบบใด?','Rule: rain → wet_road','ตารางคะแนน / รูปภาพ / random forest เท่านั้น','ประโยคมีเงื่อนไข จึงเหมาะกับ rule','สังเกตคำว่า ถ้า…แล้ว…'),
    item('เลือกวิธีแทนความรู้ (Representation Choice)','r2','ระบบแนะนำหนังมีวัตถุ Movie และคุณลักษณะ genre/year/rating ควรใช้แบบใด?','Frame หรือ object attributes','BFS queue / sensor noise / cost frontier','frame เหมาะกับสิ่งที่มี attributes หลายช่อง','มองหา object พร้อมคุณลักษณะ'),
    item('เลือกวิธีแทนความรู้ (Representation Choice)','r3','ต้องแสดงว่า dog is-a animal และ dog has-part tail ควรใช้แบบใด?','Semantic network','UCS path / confusion matrix / raw database only','semantic network เหมาะกับ node และ relation','สังเกตความสัมพันธ์ is-a และ has-part'),
    item('เลือกวิธีแทนความรู้ (Representation Choice)','r4','ต้องพิสูจน์ว่า Socrates เป็น mortal จาก fact และ rule ควรใช้แบบใด?','Logic หรือ rule-based inference','image embedding only / timer event / UI layout','logic เหมาะกับการพิสูจน์ตามกฎ','มีโจทย์แบบพิสูจน์จาก fact และ rule'),
    item('เลือกวิธีแทนความรู้ (Representation Choice)','r5','ระบบช่วยวินิจฉัยจากเคสเก่าที่คล้ายกันควรใช้แนวคิดใด?','Case-based reasoning','A* heuristic only / CSS class / random answer','case-based reasoning ใช้กรณีเดิมที่คล้ายกัน','มองหาคำว่าเคสเก่าและความคล้าย'),
    item('เลือกวิธีแทนความรู้ (Representation Choice)','r6','ระบบมหาวิทยาลัยต้องเชื่อม lecturer, student, course และ enrolls ควรเริ่มจากอะไร?','Ontology ของโดเมน','เปลี่ยนสีปุ่ม / สุ่มคะแนน / นับคลิก','ontology ช่วยกำหนด concept และ relation ของโดเมน','เริ่มจากสิ่งสำคัญในโดเมนและความสัมพันธ์ของสิ่งเหล่านั้น')
  ];

  const INFER=[
    item('ฝึกการอนุมาน (Inference Drill)','i1','ในฐานความรู้มี fact: bird(tweety) และ rule: bird(x) → animal(x) ระบบควรอนุมานข้อใดได้?','animal(tweety)','bird(animal) / not animal(tweety) / fish(tweety)','แทน x ด้วย tweety ใน rule จึงได้ animal(tweety)','ดูว่าข้อเท็จจริงข้อใดทำให้เงื่อนไขของ rule เป็นจริง'),
    item('ฝึกการอนุมาน (Inference Drill)','i2','มี fact: fever(p1), cough(p1) และ rule: fever(x) AND cough(x) → possible_flu(x) ระบบควรสรุปอะไร?','possible_flu(p1)','possible_flu(p2) / no_flu(p1) / cough(fever)','p1 มีทั้ง fever และ cough จึงครบเงื่อนไข AND','ตรวจว่าทุกเงื่อนไขของกฎครบสำหรับคนเดียวกันหรือไม่'),
    item('ฝึกการอนุมาน (Inference Drill)','i3','Rule: high_score(x) → pass(x) และ fact: high_score(student12) ระบบควรสรุปอะไร?','pass(student12)','fail(student12) / high_score(pass) / pass(x) only','แทน x ด้วย student12 แล้วใช้กฎได้โดยตรง','กฎหนึ่งข้อกับ fact หนึ่งข้อพอสำหรับการสรุปนี้'),
    item('ฝึกการอนุมาน (Inference Drill)','i4','Rule: mammal(x) → warm_blooded(x) และ fact: mammal(cat1) ข้อสรุปใดถูก?','warm_blooded(cat1)','mammal(warm) / cold_blooded(cat1) / bird(cat1)','ใช้หลัก ถ้า P แล้ว Q และมี P จึงได้ Q','อ่านทิศทางของลูกศรจากซ้ายไปขวา'),
    item('ฝึกการอนุมาน (Inference Drill)','i5','กฎต้องการ A AND B แต่ในฐานความรู้มีแค่ A ระบบควรทำอย่างไร?','ยังสรุปผลไม่ได้','สรุปได้ทันที / ถือว่า B เป็นจริงอัตโนมัติ / ลบกฎ','AND ต้องมีทุกเงื่อนไขจึงใช้กฎได้','เช็กว่ากฎมีคำว่า AND หรือไม่'),
    item('ฝึกการอนุมาน (Inference Drill)','i6','Forward chaining เริ่มทำงานจากอะไร?','เริ่มจาก facts แล้วใช้ rules เพื่อสร้าง conclusions','เริ่มจาก goal แล้วย้อนหา facts เท่านั้น / สุ่ม rule / ลบ facts','forward chaining เดินจาก fact ไปสู่ conclusion','คำว่า forward หมายถึงเดินหน้า')
  ];

  const DEBUG=[
    item('ตรวจความสอดคล้อง (Consistency Debug)','d1','KB มี bird(tweety), penguin(tweety), rule penguin(x) → not fly(x) และ rule bird(x) → fly(x) ปัญหาคืออะไร?','เกิดข้อขัดแย้งเรื่อง fly(tweety)','ไม่มี fact / ไม่มี rule / เป็น database เท่านั้น','กฎสองชุดสรุปผลตรงข้ามกัน','หนึ่งกฎบอก fly แต่อีกกฎบอก not fly'),
    item('ตรวจความสอดคล้อง (Consistency Debug)','d2','ถ้า KB มี fact ซ้ำ เช่น fever(p1) ซ้ำ 5 แถว ควรทำอย่างไร?','ลบข้อมูลซ้ำ และเก็บแหล่งที่มา/เวลาเมื่อจำเป็น','ปล่อยซ้ำเพื่อให้ฉลาดขึ้นเสมอ / ลบทุก fact / เปลี่ยนเป็นภาพ','ข้อมูลซ้ำทำให้รายงานและ reasoning เพี้ยนได้','คล้ายกับการกันคำถามซ้ำในเกม'),
    item('ตรวจความสอดคล้อง (Consistency Debug)','d3','Rule: student(x) → can_enroll(x), fact: student(12) แต่ระบบตอบไม่ได้ สาเหตุที่เป็นไปได้คืออะไร?','ชื่อ predicate หรือรูปแบบข้อมูลไม่ตรงกัน','AI ไม่มีประโยชน์ / ต้องใช้ VR / ต้องลบ rule','symbol ที่ไม่ตรงกันทำให้ rule match ไม่ได้','ตรวจชื่อ predicate และรูปแบบ id'),
    item('ตรวจความสอดคล้อง (Consistency Debug)','d4','ระบบ KB ตอบว่า “ไม่รู้” ทั้งที่คิดว่ามีข้อมูล ควรตรวจอะไรอันดับแรก?','ตรวจ facts, rules, predicate names และการจับคู่','เปลี่ยนสี UI / เพิ่มเสียง / ปิดอินเทอร์เน็ต','ปัญหา reasoning มักเริ่มจากข้อมูล กฎ หรือชื่อไม่ตรง','เริ่มจาก fact/rule/schema ก่อน'),
    item('ตรวจความสอดคล้อง (Consistency Debug)','d5','กฎสองข้อให้ผลขัดแย้งกัน ควรเพิ่มอะไรใน KB?','priority, exception หรือ conflict resolution','รูปพื้นหลัง / timer / random seed เท่านั้น','ต้องมีกลไกจัดการข้อยกเว้นและความขัดแย้ง','นึกถึง penguin ที่เป็นข้อยกเว้นของ bird fly'),
    item('ตรวจความสอดคล้อง (Consistency Debug)','d6','ทำไมต้องเก็บ explanation trace ใน KB?','เพื่อบอกได้ว่าคำตอบมาจาก fact หรือ rule ใด','เพื่อให้ไฟล์ใหญ่ขึ้น / เพื่อซ่อนเหตุผล / เพื่อสุ่มคะแนน','trace ทำให้ผู้ใช้และครูตรวจเหตุผลได้','เกี่ยวข้องกับ explainable AI')
  ];

  const BOSS=[
    item('บอสฐานความรู้ (Knowledge Boss)','b1','คำกล่าวของบอส: “Knowledge base คือ database ธรรมดาเท่านั้น” ควรตอบอย่างไร?','ไม่ถูก เพราะ KB มี facts, rules และ reasoning ได้','ถูกเสมอ / KB คือรูปภาพ / KB ไม่ต้องมีความรู้','KB เน้นการแทนความรู้และการอนุมาน ไม่ใช่เก็บ record อย่างเดียว','แยกหน้าที่ของ DB กับ KB'),
    item('บอสฐานความรู้ (Knowledge Boss)','b2','คำกล่าวของบอส: “มี fact เดียวก็อนุมานได้ทุกอย่าง” ควรตอบอย่างไร?','ไม่ถูก ต้องมี rule และเงื่อนไขครบ','ถูก เพราะ AI เดาได้ / fact เดียวพอเสมอ / ไม่ต้องมี rule','inference ต้องอาศัยกฎและความสัมพันธ์','คิดเป็น fact + rule → conclusion'),
    item('บอสฐานความรู้ (Knowledge Boss)','b3','คำกล่าวของบอส: “IF A AND B THEN C มีแค่ A ก็สรุป C ได้” ถูกไหม?','ไม่ถูก ต้องมี A และ B ครบ','ถูก / แล้วแต่สีปุ่ม / ถ้ามี A มากพอ','AND ต้องครบทุกเงื่อนไข','คำว่า AND คือกุญแจสำคัญ'),
    item('บอสฐานความรู้ (Knowledge Boss)','b4','คำกล่าวของบอส: “Ontology ไม่เกี่ยวกับความหมายของข้อมูล” ควรตอบอย่างไร?','ไม่ถูก เพราะ ontology จัด concept และ relation ของโดเมน','ถูก / ontology คือไฟล์รูป / ontology คือคะแนน','ontology ใช้แทนความหมายและความสัมพันธ์','นึกถึง class, relation และ domain'),
    item('บอสฐานความรู้ (Knowledge Boss)','b5','คำกล่าวของบอส: “ระบบ rule-based อธิบายเหตุผลไม่ได้” ควรตอบอย่างไร?','ไม่ถูก เพราะ rule-based มักอธิบาย trace ของกฎได้','ถูกเสมอ / ต้องใช้ deep learning เท่านั้น / rule ไม่มีชื่อ','rule-based เด่นด้าน explainability','ดูเส้นทางจาก fact ผ่าน rule ไปยัง conclusion'),
    item('บอสฐานความรู้ (Knowledge Boss)','b6','คำกล่าวของบอส: “Conflict ใน KB ไม่ต้องแก้ เพราะ AI จะเลือกเอง” ควรตอบอย่างไร?','ไม่ถูก ต้องมี priority, exception หรือ conflict resolution','ถูกเพราะ AI รู้เอง / ลบทุก rule / ให้ผู้ใช้เดา','KB ต้องจัดการความขัดแย้งอย่างชัดเจน','คิดถึง priority และ exception')
  ];

  function take(list,n){const pool=shuffle(list),out=[];for(let i=0;i<n;i++)out.push(pool[i%pool.length]);return out;}
  function counts(diff){if(diff==='challenge')return{concept:5,repr:5,infer:5,debug:4,boss:4,time:155};if(diff==='hard')return{concept:4,repr:4,infer:4,debug:4,boss:3,time:165};if(diff==='easy')return{concept:3,repr:3,infer:3,debug:2,boss:2,time:180};return{concept:4,repr:4,infer:4,debug:3,boss:3,time:170};}
  function buildSession6Round(diff){const c=counts(diff||'normal');const items=[].concat(take(CONCEPT,c.concept),take(REPRESENT,c.repr),take(INFER,c.infer),take(DEBUG,c.debug),take(BOSS,c.boss));return{version:VERSION,phases:['แนวคิดความรู้ (Knowledge Concept)','เลือกวิธีแทนความรู้ (Representation Choice)','ฝึกการอนุมาน (Inference Drill)','ตรวจความสอดคล้อง (Consistency Debug)','บอสฐานความรู้ (Knowledge Boss)'],items,counts:c,noRepeat:{bank:'s6-kb-forge-thai-first',totalBank:CONCEPT.length+REPRESENT.length+INFER.length+DEBUG.length+BOSS.length}};}
  window.buildSession6Round=buildSession6Round;
  window.AIQUEST_S6_KB_BANK={version:VERSION,counts:{concept:CONCEPT.length,representation:REPRESENT.length,inference:INFER.length,debug:DEBUG.length,boss:BOSS.length,total:CONCEPT.length+REPRESENT.length+INFER.length+DEBUG.length+BOSS.length},buildSession6Round};
  console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_S6_KB_BANK);
})();