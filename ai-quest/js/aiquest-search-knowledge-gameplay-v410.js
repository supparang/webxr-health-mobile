/* AI Quest Thai-first labels v4.1.15 — S2 feedback guarantee */
(()=>{
'use strict';
const V='v4.1.15-s2-feedback-guarantee';
const L={
'Card Rush':'ตัดสินใจเร็ว: AI หรือไม่ (Card Rush)','Trick Check':'จับกับดักความเข้าใจ (Trick Check)','Explain Strike':'อธิบายเหตุผล (Explain Strike)','Rookie Boss':'บอสมือใหม่ AI (Rookie Boss)','Agent Check':'ตรวจระบบตัวแทน (Agent Check)','PEAS Builder':'สร้าง PEAS ของ Agent (PEAS Builder)','Environment Lab':'วิเคราะห์สภาพแวดล้อม (Environment Lab)','Rational Agent Boss':'บอสตัวแทนมีเหตุผล (Rational Agent Boss)','Search Concept':'แนวคิดการค้นหา (Search Concept)','BFS Trace':'ตามรอย BFS (BFS Trace)','DFS Trace':'ตามรอย DFS (DFS Trace)','Search Boss':'บอสการค้นหา (Search Boss)','Cost Concept':'แนวคิดต้นทุนเส้นทาง (Cost Concept)','UCS Trace':'ตามรอย UCS (UCS Trace)','Optimal Path':'เส้นทางต้นทุนต่ำสุด (Optimal Path)','Frontier Cost':'เลือกจากแนวหน้าตามต้นทุน (Frontier Cost)','BFS vs UCS':'เปรียบเทียบ BFS กับ UCS','Cost Boss':'บอสต้นทุนเส้นทาง (Cost Boss)','A* Concept':'แนวคิด A* (A* Concept)','A* Trace':'ตามรอย A* (A* Trace)','Heuristic Check':'ตรวจค่า heuristic','A* Boss':'บอส A*','Search Arena':'สนามประลองการค้นหา (Search Arena)'};
function s(v){return String(v==null?'':v).trim()}
function s2Feedback(x){
  const a=s(x.answer||x.counter);
  const phase=s(x.phase).toLowerCase();
  const label=s(x.label||x.prompt);
  if(!s(x.hint)){
    if(/peas/.test(phase)) x.hint='พิจารณาว่าสิ่งนี้เป็น Performance, Environment, Actuator หรือ Sensor';
    else if(/environment/.test(phase)) x.hint='ดูว่าข้อมูลครบหรือไม่, ผลลัพธ์แน่นอนหรือไม่, และมี agent กี่ตัว';
    else if(/boss/.test(phase)) x.hint='อ่านเงื่อนไขของโจทย์ แล้วเชื่อมกับ percept, goal และ action';
    else x.hint='ถามตัวเองว่า ระบบรับข้อมูลจากสภาพแวดล้อม แล้วเลือกการกระทำเพื่อเป้าหมายหรือไม่';
  }
  if(!s(x.why)&&!s(x.feedback)){
    if(a==='Agent') x.why='ระบบนี้รับข้อมูลจากสภาพแวดล้อมและเลือกการกระทำเพื่อบรรลุเป้าหมาย จึงเข้าลักษณะของ agent';
    else if(a==='Not Agent') x.why='ระบบนี้ทำงานตามคำสั่งหรือกฎตายตัวเป็นหลัก โดยไม่ได้เลือกการกระทำตามสภาพแวดล้อมเพื่อเป้าหมาย';
    else if(a==='Maybe Agent') x.why='ข้อมูลในโจทย์ยังไม่พอ ต้องดูเพิ่มว่าระบบมีการรับรู้บริบทและเลือกการกระทำตามเป้าหมายหรือไม่';
    else if(/peas/.test(phase)) x.why='คำตอบที่ถูกต้องต้องจับคู่หน้าที่ในกรอบ PEAS ให้สอดคล้องกับบทบาทของระบบ';
    else if(/environment/.test(phase)) x.why='คำตอบที่ถูกต้องพิจารณาคุณลักษณะของสภาพแวดล้อมตามข้อมูลที่โจทย์ระบุ';
    else if(/boss/.test(phase)) x.why='คำกล่าวนี้ต้องตรวจด้วยหลัก agent, PEAS และ rational action ไม่ใช่ดูจากคำว่า smart หรือ automated';
    else x.why='พิจารณาจากข้อมูลในโจทย์และหลักการของ intelligent agent';
  }
  if(!s(x.feedback)) x.feedback=s(x.why);
  return x;
}
function fix(x){
  if(!x||typeof x!=='object')return x;
  const rawPhase=s(x.phase);
  if(L[rawPhase])x.phase=L[rawPhase];
  ['prompt','label','hint','why','feedback'].forEach(k=>{if(x[k])x[k]=s(x[k]).replace('Rookie Boss Claim:','คำกล่าวของบอสมือใหม่:').replace('Rational Agent Boss Claim:','คำกล่าวของบอสตัวแทนมีเหตุผล:').replace('Boss Claim:','คำกล่าวของบอส:').replace('Cost Boss Claim:','คำกล่าวของบอสต้นทุน:')});
  if(/^s2_|agent|peas|environment|rational/i.test(s(x.id)+' '+rawPhase+' '+s(x.type)))s2Feedback(x);
  return x;
}
function round(r){if(!r)return r;Object.keys(r).forEach(k=>{if(Array.isArray(r[k]))r[k]=r[k].map(fix)});if(Array.isArray(r.phases))r.phases=r.phases.map(x=>L[x]||x);return r}
function wrap(n){const o=window[n];if(typeof o!=='function'||o.__thai415)return;const f=d=>round(o(d));f.__thai415=true;window[n]=f}
function run(){['buildMission1Round','buildSession2Round','buildBoss1Round','buildSession3Round','buildSession4Round','buildSession5Round','buildBoss2Round'].forEach(wrap);window.AIQuestSearchKnowledgeGameplay={version:V,mode:'thai-first-s2-feedback-ready'};console.log('[AIQuest] '+V+' loaded')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250),{once:true});else setTimeout(run,250);
})();