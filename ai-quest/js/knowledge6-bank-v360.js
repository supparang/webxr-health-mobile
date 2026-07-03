/* CSAI2102 AI Quest — S6 Knowledge Base Forge v3.8.0
   100 distinct Thai-first contextual questions: 20 real contexts x 5 reasoning skills.
*/
(function(){
'use strict';
const VERSION='v3.8.0-s6-100-real-contexts';
const sh=a=>{const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const P={c:'แนวคิดความรู้ (Knowledge Concept)',r:'เลือกวิธีแทนความรู้ (Representation Choice)',i:'ฝึกการอนุมาน (Inference Drill)',d:'ตรวจความสอดคล้อง (Consistency Debug)',b:'บอสฐานความรู้ (Knowledge Boss)'};
const C=[
['โรงพยาบาล','ผู้ป่วย','fever(p1)','IF fever(x) THEN needs_check(x)','needs_check(p1)','ผู้ป่วยมีไข้จึงควรตรวจเพิ่ม','patient','has_symptom'],
['มหาวิทยาลัย','นักศึกษา','paid_fee(s12)','IF paid_fee(x) THEN can_register(x)','can_register(s12)','ชำระค่าธรรมเนียมแล้วจึงลงทะเบียนได้','student','enrolls'],
['ห้องสมุด','สมาชิก','overdue(m4)','IF overdue(x) THEN cannot_borrow(x)','cannot_borrow(m4)','คืนหนังสือเกินกำหนดจึงยืมต่อไม่ได้','member','borrows'],
['Smart Home','ห้องนอน','dark(room1)','IF dark(x) THEN turn_on_light(x)','turn_on_light(room1)','ห้องมืดจึงเปิดไฟ','room','has_device'],
['รถส่งของ','พัสดุ','fragile(box7)','IF fragile(x) THEN handle_carefully(x)','handle_carefully(box7)','พัสดุเปราะบางจึงต้องจัดการอย่างระวัง','package','delivered_to'],
['ร้านอาหาร','โต๊ะ','reserved(t9)','IF reserved(x) THEN hold_table(x)','hold_table(t9)','โต๊ะถูกจองจึงกันโต๊ะไว้','table','ordered_by'],
['ระบบทุนการศึกษา','ผู้สมัคร','gpa_high(a2)','IF gpa_high(x) THEN eligible_review(x)','eligible_review(a2)','เกรดถึงเกณฑ์จึงเข้าสู่การพิจารณา','applicant','applies_for'],
['สวนสัตว์','สัตว์','injured(z3)','IF injured(x) THEN needs_vet(x)','needs_vet(z3)','สัตว์บาดเจ็บจึงต้องพบสัตวแพทย์','animal','lives_in'],
['สนามบิน','เที่ยวบิน','delayed(f8)','IF delayed(x) THEN notify_passengers(x)','notify_passengers(f8)','เที่ยวบินล่าช้าจึงแจ้งผู้โดยสาร','flight','departs_from'],
['โรงแรม','ห้องพัก','dirty(r12)','IF dirty(x) THEN schedule_cleaning(x)','schedule_cleaning(r12)','ห้องยังไม่สะอาดจึงต้องจัดตารางทำความสะอาด','room','booked_by'],
['ฟาร์มอัจฉริยะ','แปลงผัก','dry(plot3)','IF dry(x) THEN start_irrigation(x)','start_irrigation(plot3)','ดินแห้งจึงเริ่มรดน้ำ','plot','has_sensor'],
['โรงงาน','เครื่องจักร','overheat(m2)','IF overheat(x) THEN stop_machine(x)','stop_machine(m2)','เครื่องร้อนเกินจึงหยุดเครื่อง','machine','located_in'],
['คลินิกทันตกรรม','ผู้รับบริการ','appointment_today(p5)','IF appointment_today(x) THEN send_reminder(x)','send_reminder(p5)','มีนัดวันนี้จึงส่งข้อความเตือน','patient','has_appointment'],
['แพลตฟอร์มเรียนออนไลน์','รายวิชา','completed_quiz(u4)','IF completed_quiz(x) THEN unlock_video(x)','unlock_video(u4)','ทำแบบทดสอบครบจึงปลดล็อกวิดีโอ','learner','studies'],
['ธนาคาร','บัญชี','suspicious_tx(a9)','IF suspicious_tx(x) THEN require_verify(x)','require_verify(a9)','ธุรกรรมน่าสงสัยจึงยืนยันตัวตน','account','owned_by'],
['พิพิธภัณฑ์','วัตถุจัดแสดง','fragile_art(o6)','IF fragile_art(x) THEN use_glass_case(x)','use_glass_case(o6)','วัตถุเปราะบางจึงใช้ตู้กระจก','artifact','belongs_to'],
['โรงเรียน','นักเรียน','absent_three_days(k7)','IF absent_three_days(x) THEN contact_guardian(x)','contact_guardian(k7)','ขาดเรียนต่อเนื่องจึงติดต่อผู้ปกครอง','student','in_class'],
['สถานีชาร์จ EV','หัวชาร์จ','occupied(ch2)','IF occupied(x) THEN show_unavailable(x)','show_unavailable(ch2)','หัวชาร์จกำลังใช้งานจึงแสดงว่าไม่ว่าง','charger','in_station'],
['ศูนย์รับแจ้งเหตุ','เหตุการณ์','high_risk(e3)','IF high_risk(x) THEN dispatch_team(x)','dispatch_team(e3)','เหตุการณ์ความเสี่ยงสูงจึงส่งทีม','incident','reported_by'],
['ระบบคัดแยกขยะ','ถังขยะ','full(bin5)','IF full(x) THEN schedule_collection(x)','schedule_collection(bin5)','ถังเต็มจึงจัดตารางเก็บขยะ','bin','located_at']
];
function q(phase,family,id,prompt,answer,wrong,explain,hint){return{id:'s6_'+id,phase,family,prompt,answer,choices:sh([answer].concat(wrong)).slice(0,4),explain,hint}}
const bank={c:[],r:[],i:[],d:[],b:[]};
C.forEach((x,n)=>{const [domain,thing,fact,rule,goal,why,cls,rel]=x;const id=String(n+1).padStart(2,'0');
bank.c.push(q(P.c,'concept','c'+id,`ในระบบ${domain} ข้อใดควรเป็น fact ที่บันทึกในฐานความรู้?`,fact,[rule,`${cls}(${thing})`,`${rel}(${thing},x)`],`fact คือความจริงเฉพาะกรณีของ ${thing}`,`มองหาประโยคที่ยืนยันข้อมูลหนึ่งกรณี`));
bank.r.push(q(P.r,'representation','r'+id,`ระบบ${domain} ต้องเก็บว่า ${thing} เป็น ${cls} และมีความสัมพันธ์ ${rel} ควรเริ่มแทนความรู้แบบใด?`,'Ontology หรือ semantic network',[`BFS queue`,`ภาพถ่ายอย่างเดียว`,`ค่าคะแนนสุ่ม`],`โจทย์มีชนิดของสิ่งและความสัมพันธ์ จึงเหมาะกับ ontology/semantic network`,`สังเกตคำว่า “เป็นชนิด” และ “มีความสัมพันธ์”`));
bank.i.push(q(P.i,'inference','i'+id,`มี fact: ${fact} และ rule: ${rule} ระบบ${domain} ควรสรุปอะไร?`,goal,[`not_${goal}`,`${goal.replace(/\(.+\)/,'(x)')}`,`unknown(${thing})`],why,`แทนตัวแปร x ด้วย ${thing}`));
bank.d.push(q(P.d,'debug','d'+id,`ระบบ${domain} มี fact เป็น ${fact} แต่ rule เขียนชื่อ predicate คนละคำ เช่น ${fact.split('(')[0]}_status(x) ปัญหาน่าจะอยู่ที่ใด?`,'ชื่อ predicate ไม่ตรงกัน',[`สีของปุ่มไม่ตรง`,`เวลาในเกมน้อยไป`,`ต้องเพิ่มรูปภาพ`],`ชื่อ predicate ต่างกันทำให้ rule จับคู่กับ fact ไม่ได้`,`เทียบชื่อสัญลักษณ์ใน fact และ rule ทีละตัว`));
bank.b.push(q(P.b,'boss','b'+id,`บอสกล่าวว่า “ระบบ${domain} มีข้อมูล ${fact} แล้วไม่ต้องมี rule ก็สรุป ${goal} ได้แน่นอน” ควรโต้แย้งอย่างไร?`,'ไม่ถูก ต้องมี rule ที่เชื่อม fact ไปสู่ conclusion',[`ถูก เพราะ AI เดาเองได้`,`ถูก เพราะ fact หนึ่งข้อพอเสมอ`,`ไม่ต้องมีฐานความรู้`],`การอนุมานต้องมีความสัมพันธ์หรือกฎรองรับ ไม่ใช่เดาจาก fact เดียว`,`คิดเป็น fact + rule → conclusion`));
});
function take(a,n){return sh(a).slice(0,n)}
function counts(d){if(d==='challenge')return{c:6,r:6,i:6,d:6,b:6,time:200};if(d==='hard')return{c:5,r:5,i:5,d:5,b:5,time:185};if(d==='easy')return{c:4,r:4,i:4,d:4,b:4,time:200};return{c:5,r:5,i:5,d:5,b:5,time:190}}
function buildSession6Round(diff){const n=counts(diff||'normal'),items=[].concat(take(bank.c,n.c),take(bank.r,n.r),take(bank.i,n.i),take(bank.d,n.d),take(bank.b,n.b));return{version:VERSION,phases:[P.c,P.r,P.i,P.d,P.b],items:sh(items),counts:n,noRepeat:{bank:'s6-real-contexts-100',totalBank:100,roundUnique:true}}}
window.buildSession6Round=buildSession6Round;window.AIQUEST_S6_KB_BANK={version:VERSION,counts:{concept:20,representation:20,inference:20,debug:20,boss:20,total:100},buildSession6Round};console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_S6_KB_BANK);
})();