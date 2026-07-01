/* AI Quest — Search & Knowledge Thai-first bridge v4.1.11
   Keeps verified question logic intact while presenting Thai-first phase labels
   and instructions for S3, S4, S5 and B2.
*/
(() => {
  'use strict';
  const VERSION='v4.1.11-search-knowledge-thai-first';
  const LABEL={
    'Cost Concept':'แนวคิดต้นทุนเส้นทาง (Cost Concept)',
    'UCS Trace':'ตามรอย UCS (UCS Trace)',
    'Optimal Path':'เส้นทางต้นทุนต่ำสุด (Optimal Path)',
    'Frontier Cost':'เลือกจากแนวหน้าตามต้นทุน (Frontier Cost)',
    'BFS vs UCS':'เปรียบเทียบ BFS กับ UCS',
    'Cost Boss':'บอสต้นทุนเส้นทาง (Cost Boss)',
    'A* Concept':'แนวคิด A* (A* Concept)',
    'A* Trace':'ตามรอย A* (A* Trace)',
    'Heuristic Check':'ตรวจค่า heuristic',
    'A* Boss':'บอส A*',
    'Search Concept':'แนวคิดการค้นหา (Search Concept)',
    'BFS Trace':'ตามรอย BFS (BFS Trace)',
    'DFS Trace':'ตามรอย DFS (DFS Trace)',
    'Search Boss':'บอสการค้นหา (Search Boss)',
    'Search Arena':'สนามประลองการค้นหา (Search Arena)'
  };
  function thaiPrompt(t){
    t=String(t||'');
    return t
      .replace(/^(Weighted Map[^:]*):\s*UCS expanded order คือข้อใด\?/,'$1: เมื่อใช้ Uniform Cost Search (UCS) ระบบจะขยายโหนดตามลำดับใด?')
      .replace(/^(Weighted Map[^:]*):\s*optimal path ตาม UCS คือข้อใด\?/,'$1: เมื่อใช้ UCS เส้นทางที่มีต้นทุนรวมต่ำสุดคือข้อใด?')
      .replace(/^(Weighted Map[^:]*):\s*หลักเลือก node ถัดไปใน UCS คืออะไร\?/,'$1: UCS ควรเลือกโหนดถัดไปตามหลักใด?')
      .replace(/^Cost Boss Claim:/,'คำกล่าวของบอสต้นทุน:')
      .replace(/^Boss Claim:/,'คำกล่าวของบอส:')
      .replace(/expanded order/g,'ลำดับการขยายโหนด')
      .replace(/optimal path/g,'เส้นทางต้นทุนต่ำสุด');
  }
  function localizeItem(x){
    if(!x||typeof x!=='object')return x;
    if(x.phase&&LABEL[x.phase])x.phase=LABEL[x.phase];
    if(x.prompt)x.prompt=thaiPrompt(x.prompt);
    if(x.title)x.title=String(x.title).replace(/^Weighted Map/,'แผนที่ถ่วงน้ำหนัก');
    return x;
  }
  function localizeRound(r){
    if(!r||typeof r!=='object')return r;
    Object.keys(r).forEach(k=>{
      if(Array.isArray(r[k]))r[k]=r[k].map(localizeItem);
    });
    if(Array.isArray(r.phases))r.phases=r.phases.map(p=>LABEL[p]||p);
    return r;
  }
  function wrap(name){
    const old=window[name];
    if(typeof old!=='function'||old.__thaiFirst411)return;
    const fn=function(diff){return localizeRound(old(diff));};
    fn.__thaiFirst411=true;
    window[name]=fn;
  }
  function ready(){
    ['buildSession3Round','buildSession4Round','buildSession5Round','buildBoss2Round'].forEach(wrap);
    window.AIQuestSearchKnowledgeGameplay={version:VERSION,coreReady:typeof window.startMission==='function',mode:'thai-first-stable'};
    console.log('[AIQuest] '+VERSION+' loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ready,250),{once:true});else setTimeout(ready,250);
})();