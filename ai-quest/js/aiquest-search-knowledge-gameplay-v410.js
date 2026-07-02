/* AI Quest Thai-first labels v4.1.16 — S2 boss feedback aliases */
(()=>{
'use strict';
const V='v4.1.16-s2-boss-feedback-aliases';
const L={'Card Rush':'ตัดสินใจเร็ว: AI หรือไม่ (Card Rush)','Trick Check':'จับกับดักความเข้าใจ (Trick Check)','Explain Strike':'อธิบายเหตุผล (Explain Strike)','Rookie Boss':'บอสมือใหม่ AI (Rookie Boss)','Agent Check':'ตรวจระบบตัวแทน (Agent Check)','PEAS Builder':'สร้าง PEAS ของ Agent (PEAS Builder)','Environment Lab':'วิเคราะห์สภาพแวดล้อม (Environment Lab)','Rational Agent Boss':'บอสตัวแทนมีเหตุผล (Rational Agent Boss)','Search Concept':'แนวคิดการค้นหา (Search Concept)','BFS Trace':'ตามรอย BFS (BFS Trace)','DFS Trace':'ตามรอย DFS (DFS Trace)','Search Boss':'บอสการค้นหา (Search Boss)','Cost Concept':'แนวคิดต้นทุนเส้นทาง (Cost Concept)','UCS Trace':'ตามรอย UCS (UCS Trace)','Optimal Path':'เส้นทางต้นทุนต่ำสุด (Optimal Path)','Frontier Cost':'เลือกจากแนวหน้าตามต้นทุน (Frontier Cost)','BFS vs UCS':'เปรียบเทียบ BFS กับ UCS','Cost Boss':'บอสต้นทุนเส้นทาง (Cost Boss)','A* Concept':'แนวคิด A* (A* Concept)','A* Trace':'ตามรอย A* (A* Trace)','Heuristic Check':'ตรวจค่า heuristic','A* Boss':'บอส A*','Search Arena':'สนามประลองการค้นหา (Search Arena)'};
const s=v=>String(v==null?'':v).trim();
function bossWhy(x){
  const claim=s(x.claim||x.prompt||x.label);
  const counter=s(x.counter||x.answer);
  return 'เหตุผล: '+(counter||'ให้ตรวจจาก percept, goal และ action')+' — อย่าตัดสินจากคำว่า smart, automatic หรือมี sensor เพียงอย่างเดียว';
}
function s2Feedback(x){
  const raw=s(x.phase).toLowerCase(), id=s(x.id), type=s(x.type);
  const isBoss=/boss|rational/.test(raw+' '+id+' '+type);
  if(!s(x.hint)) x.hint=isBoss?'อ่านคำกล่าวของบอส แล้วตรวจว่าระบบมี percept, goal และการเลือก action จริงหรือไม่':'พิจารณาว่าระบบรับรู้สภาพแวดล้อมและเลือก action เพื่อเป้าหมายหรือไม่';
  let why=s(x.why||x.feedback||x.explain||x.explanation||x.coach);
  if(!why){
    if(isBoss) why=bossWhy(x);
    else if(s(x.answer||x.counter)==='Agent') why='ระบบนี้รับข้อมูลจากสภาพแวดล้อมและเลือกการกระทำเพื่อบรรลุเป้าหมาย จึงเข้าลักษณะของ agent';
    else if(s(x.answer||x.counter)==='Not Agent') why='ระบบนี้ทำงานตามคำสั่งหรือกฎตายตัวเป็นหลัก โดยไม่ได้เลือกการกระทำตามสภาพแวดล้อมเพื่อเป้าหมาย';
    else if(s(x.answer||x.counter)==='Maybe Agent') why='ข้อมูลในโจทย์ยังไม่พอ ต้องดูเพิ่มว่าระบบมีการรับรู้บริบทและเลือกการกระทำตามเป้าหมายหรือไม่';
    else why='พิจารณาจากบทบาทของ percept, goal, action และสภาพแวดล้อมของระบบ';
  }
  x.why=why;x.feedback=why;x.explain=why;x.explanation=why;x.coach=why;
  return x;
}
function fix(x){
  if(!x||typeof x!=='object')return x;
  const raw=s(x.phase);
  if(L[raw])x.phase=L[raw];
  ['prompt','label','claim','hint','why','feedback','explain','explanation','coach','counter'].forEach(k=>{if(x[k])x[k]=s(x[k]).replace('Rookie Boss Claim:','คำกล่าวของบอสมือใหม่:').replace('Rational Agent Boss Claim:','คำกล่าวของบอสตัวแทนมีเหตุผล:').replace('Boss Claim:','คำกล่าวของบอส:').replace('Cost Boss Claim:','คำกล่าวของบอสต้นทุน:')});
  if(/^s2_|agent|peas|environment|rational/i.test(s(x.id)+' '+raw+' '+s(x.type)))s2Feedback(x);
  return x;
}
function round(r){if(!r)return r;Object.keys(r).forEach(k=>{if(Array.isArray(r[k]))r[k]=r[k].map(fix)});if(Array.isArray(r.phases))r.phases=r.phases.map(x=>L[x]||x);return r}
function wrap(n){const o=window[n];if(typeof o!=='function'||o.__thai416)return;const f=d=>round(o(d));f.__thai416=true;window[n]=f}
function run(){['buildMission1Round','buildSession2Round','buildBoss1Round','buildSession3Round','buildSession4Round','buildSession5Round','buildBoss2Round'].forEach(wrap);window.AIQuestSearchKnowledgeGameplay={version:V,mode:'thai-first-s2-boss-feedback-ready'};console.log('[AIQuest] '+V+' loaded')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250),{once:true});else setTimeout(run,250);
})();