/* AI Quest Thai-first labels v4.1.14 — safe runtime labels only */
(()=>{
'use strict';
const V='v4.1.14-safe-thai-first';
const L={
'Card Rush':'ตัดสินใจเร็ว: AI หรือไม่ (Card Rush)','Trick Check':'จับกับดักความเข้าใจ (Trick Check)','Explain Strike':'อธิบายเหตุผล (Explain Strike)','Rookie Boss':'บอสมือใหม่ AI (Rookie Boss)','Agent Check':'ตรวจระบบตัวแทน (Agent Check)','PEAS Builder':'สร้าง PEAS ของ Agent (PEAS Builder)','Environment Lab':'วิเคราะห์สภาพแวดล้อม (Environment Lab)','Rational Agent Boss':'บอสตัวแทนมีเหตุผล (Rational Agent Boss)','Search Concept':'แนวคิดการค้นหา (Search Concept)','BFS Trace':'ตามรอย BFS (BFS Trace)','DFS Trace':'ตามรอย DFS (DFS Trace)','Search Boss':'บอสการค้นหา (Search Boss)','Cost Concept':'แนวคิดต้นทุนเส้นทาง (Cost Concept)','UCS Trace':'ตามรอย UCS (UCS Trace)','Optimal Path':'เส้นทางต้นทุนต่ำสุด (Optimal Path)','Frontier Cost':'เลือกจากแนวหน้าตามต้นทุน (Frontier Cost)','BFS vs UCS':'เปรียบเทียบ BFS กับ UCS','Cost Boss':'บอสต้นทุนเส้นทาง (Cost Boss)','A* Concept':'แนวคิด A* (A* Concept)','A* Trace':'ตามรอย A* (A* Trace)','Heuristic Check':'ตรวจค่า heuristic','A* Boss':'บอส A*','Search Arena':'สนามประลองการค้นหา (Search Arena)'};
function fix(x){
  if(!x||typeof x!=='object')return x;
  if(L[x.phase])x.phase=L[x.phase];
  ['prompt','label','hint','why','feedback'].forEach(k=>{
    if(!x[k])return;
    x[k]=String(x[k])
      .replace('Rookie Boss Claim:','คำกล่าวของบอสมือใหม่:')
      .replace('Rational Agent Boss Claim:','คำกล่าวของบอสตัวแทนมีเหตุผล:')
      .replace('Boss Claim:','คำกล่าวของบอส:')
      .replace('Cost Boss Claim:','คำกล่าวของบอสต้นทุน:');
  });
  return x;
}
function round(r){
  if(!r)return r;
  Object.keys(r).forEach(k=>{if(Array.isArray(r[k]))r[k]=r[k].map(fix)});
  if(Array.isArray(r.phases))r.phases=r.phases.map(x=>L[x]||x);
  return r;
}
function wrap(n){
  const o=window[n];
  if(typeof o!=='function'||o.__thai414)return;
  const f=d=>round(o(d));
  f.__thai414=true;
  window[n]=f;
}
function run(){
  ['buildMission1Round','buildSession2Round','buildBoss1Round','buildSession3Round','buildSession4Round','buildSession5Round','buildBoss2Round'].forEach(wrap);
  window.AIQuestSearchKnowledgeGameplay={version:V,mode:'thai-first-safe'};
  console.log('[AIQuest] '+V+' loaded');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250),{once:true});else setTimeout(run,250);
})();