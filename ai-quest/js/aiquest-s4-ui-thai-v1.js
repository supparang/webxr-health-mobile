/* AI Quest S4 Thai-first visible UI v1 */
(()=>{
'use strict';
const V='v1-s4-route-cost-thai';
const s=v=>String(v==null?'':v).trim();
function mapText(t){let x=s(t);const exact={
  'Route Cost Challenge':'ภารกิจต้นทุนเส้นทาง (Route Cost Challenge)',
  'Cost Concept':'แนวคิดต้นทุนเส้นทาง (Cost Concept)',
  'UCS Trace':'ตามรอย UCS (UCS Trace)',
  'Optimal Path':'เส้นทางต้นทุนต่ำสุด (Optimal Path)',
  'Frontier Cost':'เลือกจากแนวหน้าตามต้นทุน (Frontier Cost)',
  'BFS vs UCS':'เปรียบเทียบ BFS กับ UCS',
  'Cost Boss':'บอสต้นทุนเส้นทาง (Cost Boss)',
  'Boss Claim':'คำกล่าวของบอส',
  'Concept Focus':'ประเด็นแนวคิด',
  'Phase score':'คะแนนช่วงการเรียน',
  'Review Wrong Items':'ทบทวนข้อที่ตอบผิด',
  'AI Coach Summary':'สรุปจาก AI Coach'
};
if(exact[x]) return exact[x];
return x
 .replace(/^S4 Route Cost Challenge\s*·\s*(.+)$/i,'S4 ภารกิจต้นทุนเส้นทาง (Route Cost Challenge) · $1')
 .replace(/^Route\s+(\d+)\/(\d+)$/i,'ข้อเส้นทางที่ $1 จาก $2')
 .replace(/^✅ Cost reasoning ถูกต้อง$/i,'✅ เหตุผลเรื่องต้นทุนถูกต้อง (Cost Reasoning)')
 .replace(/^⚠️ ยังสับสนเรื่อง cost$/i,'⚠️ ยังสับสนเรื่องต้นทุนเส้นทาง (Cost)')
 .replace(/cumulative cost/ig,'ต้นทุนสะสม (cumulative cost)')
 .replace(/path cost/ig,'ต้นทุนของเส้นทาง (path cost)')
 .replace(/priority queue/ig,'คิวลำดับความสำคัญ (priority queue)')
 .replace(/frontier/ig,'ชุดโหนดรอพิจารณา (frontier)')
 .replace(/expanded order/ig,'ลำดับการขยายโหนด (expanded order)')
 .replace(/expand(?:ed)? node/ig,'ขยายโหนด (expand node)')
 .replace(/parent node/ig,'โหนดแม่ (parent node)');
}
function isS4(area){const text=s(area?.innerText);return /Route Cost Challenge|UCS Trace|Optimal Path|Frontier Cost|Cost Boss|BFS vs UCS|cumulative cost|priority queue/i.test(text)}
function apply(){const area=document.getElementById('gameArea');if(!area||!isS4(area))return;area.querySelectorAll('.phasePill,.tagline,.learningFeedbackPanel h3,.learningFeedbackPanel h4,.learningFeedbackPanel b,.feedback b,.gamePanel p,.bigCard b,h3').forEach(el=>{const before=s(el.textContent),after=mapText(before);if(before!==after)el.textContent=after});}
function boot(){const area=document.getElementById('gameArea');if(area)new MutationObserver(()=>requestAnimationFrame(apply)).observe(area,{childList:true,subtree:true});setTimeout(apply,500);window.AIQuestS4ThaiUI={version:V,apply};console.log('[AIQuest] '+V+' loaded');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();