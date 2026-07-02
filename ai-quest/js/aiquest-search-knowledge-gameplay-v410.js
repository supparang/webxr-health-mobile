/* AI Quest Thai-first labels v4.1.18 — clean S2 scenario labels */
(()=>{
'use strict';
const V='v4.1.18-s2-scenario-label-clean';
const L={'Card Rush':'ตัดสินใจเร็ว: AI หรือไม่ (Card Rush)','Trick Check':'จับกับดักความเข้าใจ (Trick Check)','Explain Strike':'อธิบายเหตุผล (Explain Strike)','Rookie Boss':'บอสมือใหม่ AI (Rookie Boss)','Agent Check':'ตรวจระบบตัวแทน (Agent Check)','PEAS Builder':'สร้าง PEAS ของ Agent (PEAS Builder)','Environment Lab':'วิเคราะห์สภาพแวดล้อม (Environment Lab)','Rational Agent Boss':'บอสตัวแทนมีเหตุผล (Rational Agent Boss)','Search Concept':'แนวคิดการค้นหา (Search Concept)','BFS Trace':'ตามรอย BFS (BFS Trace)','DFS Trace':'ตามรอย DFS (DFS Trace)','Search Boss':'บอสการค้นหา (Search Boss)','Cost Concept':'แนวคิดต้นทุนเส้นทาง (Cost Concept)','UCS Trace':'ตามรอย UCS (UCS Trace)','Optimal Path':'เส้นทางต้นทุนต่ำสุด (Optimal Path)','Frontier Cost':'เลือกจากแนวหน้าตามต้นทุน (Frontier Cost)','BFS vs UCS':'เปรียบเทียบ BFS กับ UCS','Cost Boss':'บอสต้นทุนเส้นทาง (Cost Boss)','A* Concept':'แนวคิด A* (A* Concept)','A* Trace':'ตามรอย A* (A* Trace)','Heuristic Check':'ตรวจค่า heuristic','A* Boss':'บอส A*','Search Arena':'สนามประลองการค้นหา (Search Arena)'};
const s=v=>String(v==null?'':v).trim();
function thaiScenario(v){return s(v).replace(/agent\s*scenario\s*(\d+)/ig,'สถานการณ์ที่ $1').replace(/scenario\s*(\d+)/ig,'สถานการณ์ที่ $1');}
function fix(x){
  if(!x||typeof x!=='object')return x;
  const raw=s(x.phase);if(L[raw])x.phase=L[raw];
  if(x.label)x.label=thaiScenario(x.label);
  if(x.prompt)x.prompt=thaiScenario(x.prompt);
  if(x.scenario)x.scenario=thaiScenario(x.scenario);
  return x;
}
function round(r){if(!r)return r;Object.keys(r).forEach(k=>{if(Array.isArray(r[k]))r[k]=r[k].map(fix)});if(Array.isArray(r.phases))r.phases=r.phases.map(x=>L[x]||x);return r}
function wrap(n){const o=window[n];if(typeof o!=='function'||o.__thai418)return;const f=d=>round(o(d));f.__thai418=true;window[n]=f}
function isS2Boss(btn){const shell=btn.closest('.gamePanel,.missionPanel,.questionCard,.panel,.card,section,div')||document.body;const near=(shell.innerText||'').slice(0,1600);const page=(document.body.innerText||'').slice(0,5000);return /Rational Agent Boss|บอสตัวแทนมีเหตุผล|Agent Boss|คำกล่าวของบอส/i.test(near)||/Session 2|Agent Builder|S2/i.test(page)&&/Boss|บอส/i.test(near)}
function getBox(btn){let p=btn.parentElement;for(let i=0;i<6&&p;i++,p=p.parentElement){if(p.querySelectorAll('button').length>=2)return p;}return btn.parentElement||document.body}
function showBossFeedback(btn){if(!isS2Boss(btn))return;const box=getBox(btn);const old=box.querySelector('.aq-s2-boss-feedback');if(old)old.remove();const correct=btn.dataset.ok==='true'||btn.classList.contains('correct')||/ไม่ถูก|ไม่จริง|ไม่เสมอ|ต้องดู/.test(btn.textContent||'');const text=correct?'✅ ตอบถูก — ให้ตัดสินจากว่า ระบบรับรู้ข้อมูล (percept) เลือกการกระทำ (action) เพื่อเป้าหมาย (goal) หรือไม่ ไม่ใช่ดูเพียงว่าดูฉลาด ทำงานอัตโนมัติ หรือมี sensor.':'❌ ยังไม่ถูก — กลับไปตรวจ 3 จุด: ระบบรับรู้อะไร, ต้องการบรรลุเป้าหมายใด, และเลือก action ตามข้อมูลนั้นหรือไม่. คำว่า smart หรือ automatic อย่างเดียวไม่พอจะยืนยันว่าเป็น intelligent agent.';const d=document.createElement('div');d.className='aq-s2-boss-feedback';d.style.cssText='margin-top:12px;padding:12px 14px;border-radius:14px;line-height:1.55;background:'+(correct?'rgba(52,211,153,.12)':'rgba(251,113,133,.12)')+';border:1px solid '+(correct?'rgba(52,211,153,.45)':'rgba(251,113,133,.45)')+';font-weight:800;text-align:left';d.textContent=text;box.appendChild(d)}
function listen(){document.addEventListener('click',ev=>{const b=ev.target.closest('button,.choiceBtn,.choice');if(!b)return;setTimeout(()=>showBossFeedback(b),60)},true)}
function run(){['buildMission1Round','buildSession2Round','buildBoss1Round','buildSession3Round','buildSession4Round','buildSession5Round','buildBoss2Round'].forEach(wrap);listen();window.AIQuestSearchKnowledgeGameplay={version:V,mode:'thai-first-s2-scenario-clean'};console.log('[AIQuest] '+V+' loaded')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,250),{once:true});else setTimeout(run,250);
})();