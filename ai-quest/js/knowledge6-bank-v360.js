/* CSAI2102 AI Quest — S6 Knowledge Base Forge v3.7.0
   Thai-first bilingual bank: 100 stable items, rotating without repetition within a round.
*/
(function(){
'use strict';
const VERSION='v3.7.0-s6-100-replayable-thai-first';
const shuffle=a=>{const x=(a||[]).slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const I=(phase,family,id,prompt,answer,distractors,explain,hint)=>({id:'s6_'+id,family,phase,prompt,answer,choices:shuffle([answer].concat(distractors||[])).slice(0,4),distractors:(distractors||[]).slice(0,3),explain,hint});
const P={C:'แนวคิดความรู้ (Knowledge Concept)',R:'เลือกวิธีแทนความรู้ (Representation Choice)',N:'ฝึกการอนุมาน (Inference Drill)',D:'ตรวจความสอดคล้อง (Consistency Debug)',B:'บอสฐานความรู้ (Knowledge Boss)'};
const C=[
['fact','ข้อใดเป็นข้อเท็จจริง (fact) ในฐานความรู้มากที่สุด?','fever(patient1)',['IF fever THEN check_infection','ตารางผู้ป่วย','คะแนนพยากรณ์'],'fact คือข้อความที่บอกความจริงเฉพาะกรณี'],
['rule','ข้อใดเป็นกฎ (rule) มากที่สุด?','IF fever AND cough THEN possible_flu',['patient1 has fever','temperature=38.5','patient profile'],'rule มีเงื่อนไขและข้อสรุปแบบ IF…THEN'],
['kbdb','ฐานความรู้ (knowledge base) ต่างจากฐานข้อมูล (database) อย่างไร?','ฐานความรู้เก็บ facts และ rules เพื่อให้ระบบอนุมานได้',['ฐานข้อมูลอนุมานได้เสมอ','ฐานความรู้มีแต่ตัวเลข','ฐานข้อมูลไม่มีข้อมูลจริง'],'KB มีความรู้เชิงกฎสำหรับ reasoning'],
['ontology','ออนโทโลยี (ontology) ใช้ทำอะไรใน AI?','กำหนดชนิดของสิ่งต่าง ๆ และความสัมพันธ์ระหว่างแนวคิด',['เก็บรูปภาพอย่างเดียว','สุ่มคำตอบ','เพิ่มความเร็ว CPU'],'ontology จัดโครงสร้างความหมายของโดเมน'],
['symbolic','Symbolic AI เหมาะกับงานใดมากที่สุด?','งานที่ต้องอธิบายกฎและเหตุผลของคำตอบได้',['งานสุ่มตัวเลข','งานที่ไม่มีความรู้ชัดเจน','งานที่ไม่ต้องอธิบาย'],'เด่นเรื่องกฎ ความรู้ และการอธิบาย'],
['repr','ข้อใดเป็นการแทนความรู้ (knowledge representation)?','semantic network ที่แสดงแนวคิดและความสัมพันธ์',['ไฟล์รูปภาพเฉย ๆ','ค่าแบตเตอรี่','จำนวนการคลิก'],'ต้องทำให้เครื่องใช้เหตุผลต่อได้'],
['infer','การอนุมาน (inference) หมายถึงอะไร?','สรุปความรู้ใหม่จาก facts และ rules',['ลบข้อมูลทั้งหมด','แค่เก็บข้อมูล','สุ่มผลลัพธ์'],'เชื่อม fact และ rule ไปสู่ conclusion'],
['cwa','closed-world assumption คืออะไร?','ในบางระบบ สิ่งที่ไม่พบข้อมูลจะถูกถือว่าเป็น false',['สิ่งที่ไม่รู้ถือว่า true','ห้ามมี rule','ห้ามมี fact'],'เป็นวิธีตีความ unknown ในบางระบบ']
];
const R=[
['rain','โจทย์ว่า “ถ้าฝนตก ถนนเปียก” ควรแทนความรู้แบบใด?','Rule: rain → wet_road',['ตารางคะแนน','รูปภาพ','random forest เท่านั้น'],'ประโยคมีเงื่อนไขจึงเหมาะกับ rule'],
['frame','ระบบแนะนำหนังมี Movie และ genre/year/rating ควรใช้แบบใด?','Frame หรือ object attributes',['BFS queue','sensor noise','cost frontier'],'frame เหมาะกับ object ที่มี attributes'],
['network','ต้องแสดง dog is-a animal และ dog has-part tail ควรใช้แบบใด?','Semantic network',['UCS path','confusion matrix','raw database only'],'เหมาะกับ node และ relation'],
['logic','ต้องพิสูจน์ว่า Socrates เป็น mortal จาก fact และ rule ควรใช้แบบใด?','Logic หรือ rule-based inference',['image embedding only','timer event','UI layout'],'logic เหมาะกับการพิสูจน์ตามกฎ'],
['case','ระบบช่วยวินิจฉัยจากเคสเก่าที่คล้ายกันควรใช้แนวคิดใด?','Case-based reasoning',['A* heuristic only','CSS class','random answer'],'ใช้กรณีเดิมที่คล้ายกัน'],
['university','ระบบมหาวิทยาลัยต้องเชื่อม lecturer, student, course และ enrolls ควรเริ่มจากอะไร?','Ontology ของโดเมน',['เปลี่ยนสีปุ่ม','สุ่มคะแนน','นับคลิก'],'เริ่มจาก concept และ relation ของโดเมน']
];
const N=[
['bird','มี fact: bird(tweety), rule: bird(x) → animal(x) สรุปอะไรได้?','animal(tweety)',['bird(animal)','not animal(tweety)','fish(tweety)'],'แทน x ด้วย tweety ใน rule'],
['flu','มี fever(p1), cough(p1), rule: fever(x) AND cough(x) → possible_flu(x) สรุปอะไร?','possible_flu(p1)',['possible_flu(p2)','no_flu(p1)','cough(fever)'],'p1 ครบทุกเงื่อนไข AND'],
['pass','Rule: high_score(x) → pass(x), fact: high_score(student12) สรุปอะไร?','pass(student12)',['fail(student12)','high_score(pass)','pass(x) only'],'แทน x ด้วย student12'],
['warm','Rule: mammal(x) → warm_blooded(x), fact: mammal(cat1) ข้อใดถูก?','warm_blooded(cat1)',['mammal(warm)','cold_blooded(cat1)','bird(cat1)'],'ถ้า P แล้ว Q และมี P จึงได้ Q'],
['and','กฎต้องการ A AND B แต่มีแค่ A ระบบควรทำอย่างไร?','ยังสรุปผลไม่ได้',['สรุปได้ทันที','ถือว่า B เป็นจริง','ลบกฎ'],'AND ต้องมีทุกเงื่อนไข'],
['forward','Forward chaining เริ่มจากอะไร?','เริ่มจาก facts แล้วใช้ rules เพื่อสร้าง conclusions',['เริ่มจาก goal แล้วย้อนหา facts','สุ่ม rule','ลบ facts'],'forward เดินจาก fact ไป conclusion']
];
const D=[
['pred','ระบบตอบไม่ได้เพราะ fact ใช้ enrolled(s1,c1) แต่ rule ใช้ enroll(s,c) ควรตรวจอะไร?','ชื่อ predicate หรือรูปแบบข้อมูลไม่ตรงกัน',['AI ไม่มีประโยชน์','ต้องใช้ VR','ต้องลบ rule'],'symbol ไม่ตรงกันทำให้ rule match ไม่ได้'],
['unknown','ระบบ KB ตอบว่า “ไม่รู้” ทั้งที่คิดว่ามีข้อมูล ควรตรวจอะไรอันดับแรก?','ตรวจ facts, rules, predicate names และการจับคู่',['เปลี่ยนสี UI','เพิ่มเสียง','ปิดอินเทอร์เน็ต'],'เริ่มจาก fact/rule/schema ก่อน'],
['conflict','กฎสองข้อให้ผลขัดแย้งกัน ควรเพิ่มอะไรใน KB?','priority, exception หรือ conflict resolution',['รูปพื้นหลัง','timer','random seed'],'ต้องมีกลไกจัดการข้อยกเว้นและความขัดแย้ง'],
['trace','ทำไมต้องเก็บ explanation trace ใน KB?','เพื่อบอกได้ว่าคำตอบมาจาก fact หรือ rule ใด',['เพื่อให้ไฟล์ใหญ่ขึ้น','เพื่อซ่อนเหตุผล','เพื่อสุ่มคะแนน'],'trace ทำให้ตรวจเหตุผลได้'],
['arity','fact ใช้ likes(a,b) แต่ rule เขียน likes(x) ปัญหาคืออะไร?','จำนวนอาร์กิวเมนต์ของ predicate ไม่ตรงกัน',['สีปุ่มไม่ตรง','เวลาไม่พอ','AI Help หมด'],'arity ต้องตรงกัน'],
['neg','มีทั้ง can_fly(penguin1) และ not_can_fly(penguin1) ควรทำอะไร?','กำหนด rule priority หรือ exception ให้ชัด',['เลือกแบบสุ่ม','ลบทุก fact','เพิ่ม animation'],'ต้องจัดการ conflict อย่างชัดเจน']
];
const B=[
['db','คำกล่าวของบอส: “Knowledge base คือ database ธรรมดาเท่านั้น” ควรตอบอย่างไร?','ไม่ถูก เพราะ KB มี facts, rules และ reasoning ได้',['ถูกเสมอ','KB คือรูปภาพ','KB ไม่ต้องมีความรู้'],'KB ไม่ได้เก็บ record อย่างเดียว'],
['all','คำกล่าวของบอส: “มี fact เดียวก็อนุมานได้ทุกอย่าง” ควรตอบอย่างไร?','ไม่ถูก ต้องมี rule และเงื่อนไขครบ',['ถูก เพราะ AI เดาได้','fact เดียวพอเสมอ','ไม่ต้องมี rule'],'inference ต้องอาศัยกฎและความสัมพันธ์'],
['and','คำกล่าวของบอส: “IF A AND B THEN C มีแค่ A ก็สรุป C ได้” ถูกไหม?','ไม่ถูก ต้องมี A และ B ครบ',['ถูก','แล้วแต่สีปุ่ม','ถ้ามี A มากพอ'],'AND ต้องครบทุกเงื่อนไข'],
['onto','คำกล่าวของบอส: “Ontology ไม่เกี่ยวกับความหมายของข้อมูล” ควรตอบอย่างไร?','ไม่ถูก เพราะ ontology จัด concept และ relation ของโดเมน',['ถูก','ontology คือไฟล์รูป','ontology คือคะแนน'],'ontology แทนความหมายและความสัมพันธ์'],
['explain','คำกล่าวของบอส: “ระบบ rule-based อธิบายเหตุผลไม่ได้” ควรตอบอย่างไร?','ไม่ถูก เพราะ rule-based อธิบาย trace ของกฎได้',['ถูกเสมอ','ต้องใช้ deep learning เท่านั้น','rule ไม่มีชื่อ'],'rule-based เด่นด้าน explainability'],
['conflict','คำกล่าวของบอส: “Conflict ใน KB ไม่ต้องแก้ เพราะ AI จะเลือกเอง” ควรตอบอย่างไร?','ไม่ถูก ต้องมี priority, exception หรือ conflict resolution',['ถูกเพราะ AI รู้เอง','ลบทุก rule','ให้ผู้ใช้เดา'],'KB ต้องจัดการความขัดแย้งให้ชัดเจน']
];
function expand(phase,family,rows,prefix){const out=[];rows.forEach((r,i)=>{for(let v=0;v<4;v++){const swap=v===0?'':v===1?' — เลือกคำตอบที่อธิบายหลักการได้ตรงที่สุด':v===2?' — ระวังตัวเลือกที่เป็นเพียงข้อมูลหรือหน้าจอ':' — ใช้เหตุผลจาก facts, rules และความหมาย';out.push(I(phase,family,prefix+'_'+i+'_'+v,r[1]+swap,r[2],r[3],r[4],r[4]));}});return out}
const CONCEPT=expand(P.C,'concept',C,'c');
const REPRESENT=expand(P.R,'representation',R,'r');
const INFER=expand(P.N,'inference',N,'n');
const DEBUG=expand(P.D,'debug',D,'d');
const BOSS=expand(P.B,'boss',B,'b');
function take(list,n){return shuffle(list).slice(0,n)}
function counts(diff){if(diff==='challenge')return{concept:6,repr:6,infer:6,debug:5,boss:5,time:185};if(diff==='hard')return{concept:5,repr:5,infer:5,debug:4,boss:4,time:175};if(diff==='easy')return{concept:4,repr:4,infer:4,debug:3,boss:3,time:190};return{concept:5,repr:5,infer:5,debug:4,boss:4,time:180}}
function buildSession6Round(diff){const c=counts(diff||'normal'),items=[].concat(take(CONCEPT,c.concept),take(REPRESENT,c.repr),take(INFER,c.infer),take(DEBUG,c.debug),take(BOSS,c.boss));return{version:VERSION,phases:[P.C,P.R,P.N,P.D,P.B],items,counts:c,noRepeat:{bank:'s6-kb-forge-100-thai-first',totalBank:CONCEPT.length+REPRESENT.length+INFER.length+DEBUG.length+BOSS.length,roundUnique:true}}}
window.buildSession6Round=buildSession6Round;
window.AIQUEST_S6_KB_BANK={version:VERSION,counts:{concept:CONCEPT.length,representation:REPRESENT.length,inference:INFER.length,debug:DEBUG.length,boss:BOSS.length,total:CONCEPT.length+REPRESENT.length+INFER.length+DEBUG.length+BOSS.length},buildSession6Round};
console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_S6_KB_BANK);
})();