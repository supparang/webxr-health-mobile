/* CSAI2102 AI Quest — S2 visible UI Thai-first labels v1 */
(()=>{
  'use strict';
  const VERSION='v1-s2-visible-ui-thai';
  const mapExact={
    'Agent or Not':'Agent หรือไม่? (Agent or Not)',
    'PEAS Builder':'สร้าง PEAS ของ Agent (PEAS Builder)',
    'Environment Classifier':'วิเคราะห์สภาพแวดล้อม (Environment Classifier)',
    'Rational Agent Boss':'บอสตัวแทนมีเหตุผล (Rational Agent Boss)',
    'Boss Claim':'คำกล่าวของบอส'
  };
  function thaiText(t){
    let s=String(t||'').trim();
    if(mapExact[s]) return mapExact[s];
    s=s.replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*Agent or Not$/i,'ช่วงที่ $1 จาก $2 · Agent หรือไม่? (Agent or Not)');
    s=s.replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*PEAS Builder$/i,'ช่วงที่ $1 จาก $2 · สร้าง PEAS ของ Agent (PEAS Builder)');
    s=s.replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*Environment Classifier$/i,'ช่วงที่ $1 จาก $2 · วิเคราะห์สภาพแวดล้อม (Environment Classifier)');
    s=s.replace(/^Phase\s+(\d+)\/(\d+)\s*·\s*Rational Agent Boss$/i,'ช่วงที่ $1 จาก $2 · บอสตัวแทนมีเหตุผล (Rational Agent Boss)');
    s=s.replace(/^ถูกต้อง\s*·\s*Agent or Not$/i,'✅ ตอบถูก · Agent หรือไม่? (Agent or Not)');
    s=s.replace(/^ไม่ถูกต้อง\s*·\s*Agent or Not$/i,'❌ ยังไม่ถูก · Agent หรือไม่? (Agent or Not)');
    return s;
  }
  function apply(){
    const a=document.getElementById('gameArea');
    if(!a) return;
    const inS2=/Session 2|Agent or Not|PEAS Builder|Environment Classifier|Rational Agent Boss|Agent Builder/i.test(a.innerText||'');
    if(!inS2) return;
    a.querySelectorAll('.phasePill,.tagline,.feedback b,h3').forEach(el=>{
      const old=String(el.textContent||'').trim();
      const next=thaiText(old);
      if(next!==old) el.textContent=next;
    });
  }
  let scheduled=false;
  function queue(){ if(scheduled) return; scheduled=true; requestAnimationFrame(()=>{scheduled=false;apply();}); }
  function boot(){
    const a=document.getElementById('gameArea');
    if(!a) return setTimeout(boot,150);
    new MutationObserver(queue).observe(a,{childList:true,subtree:true});
    apply();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.AIQuestS2VisibleThai={version:VERSION};
  console.log('[AIQuest] '+VERSION+' loaded');
})();