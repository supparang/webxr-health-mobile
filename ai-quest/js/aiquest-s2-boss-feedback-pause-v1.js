/* CSAI2102 AI Quest — S2 Boss feedback pause v1 */
(()=>{
  'use strict';
  const VERSION='v1-s2-boss-feedback-pause';
  const nativeSetTimeout=window.setTimeout.bind(window);
  let lastChoice='';

  function bossPanel(){ return document.querySelector('.bossPanel'); }
  function feedbackText(){
    return 'เหตุผล: การเป็น Intelligent Agent ไม่ได้ดูจากคำว่า “ฉลาด”, “ทำงานอัตโนมัติ” หรือ “มี sensor” เพียงอย่างเดียว ต้องพิจารณาว่าระบบรับรู้ข้อมูลจากสภาพแวดล้อม (percept) แล้วเลือกการกระทำ (action) เพื่อเป้าหมายและผลการทำงานที่เหมาะสมหรือไม่';
  }
  function showPause(next){
    const panel=bossPanel();
    if(!panel || panel.querySelector('.aq-s2-boss-pause')) return false;
    const box=document.createElement('div');
    box.className='aq-s2-boss-pause feedback';
    box.style.cssText='display:block;margin-top:16px;padding:14px;border-radius:16px;border:1px solid rgba(56,189,248,.55);background:rgba(56,189,248,.12);line-height:1.65';
    box.innerHTML='<b>🧠 Feedback จาก Rational Agent Boss</b><br>'+feedbackText()+'<div style="margin-top:12px"><button type="button" class="btn good" id="aqS2BossNext">อ่านแล้ว ไปข้อถัดไป</button></div>';
    panel.appendChild(box);
    panel.querySelectorAll('button').forEach(b=>{ if(b.id!=='aqS2BossNext') b.disabled=true; });
    const nextBtn=box.querySelector('#aqS2BossNext');
    nextBtn.onclick=()=>{
      nextBtn.disabled=true;
      nativeSetTimeout(next,0);
    };
    return true;
  }

  document.addEventListener('click',ev=>{
    const btn=ev.target.closest('.bossPanel .choiceBtn');
    if(btn) lastChoice=String(btn.textContent||'').trim();
  },true);

  window.setTimeout=function(fn,delay,...args){
    const isBossAdvance=typeof fn==='function' && fn.name==='renderBoss' && Number(delay)===500 && !!bossPanel();
    if(isBossAdvance){
      nativeSetTimeout(()=>{ showPause(()=>fn(...args)); },0);
      return 0;
    }
    return nativeSetTimeout(fn,delay,...args);
  };

  window.AIQuestS2BossFeedbackPause={version:VERSION};
  console.log('[AIQuest] '+VERSION+' loaded');
})();