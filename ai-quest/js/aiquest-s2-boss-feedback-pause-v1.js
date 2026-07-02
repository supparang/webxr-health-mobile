/* CSAI2102 AI Quest — S2 Boss feedback pause v2 */
(()=>{
  'use strict';
  const VERSION='v2-s2-boss-feedback-visible-pause';
  let lastBossSnapshot=null, awaitingAdvance=false, heldNextNodes=null, observer=null;
  const area=()=>document.getElementById('gameArea');
  const isBossText=t=>/Rational Agent Boss|บอสตัวแทนมีเหตุผล|Boss Claim|คำกล่าวของบอส/i.test(String(t||''));
  function snapshotBoss(){const a=area(),p=a&&a.querySelector('.bossPanel');if(!p||!isBossText(p.innerText))return;lastBossSnapshot=p.cloneNode(true);lastBossSnapshot.querySelectorAll('button').forEach(b=>b.disabled=true);}
  function explain(){return 'เหตุผล: อย่าตัดสินว่าเป็น Intelligent Agent เพียงเพราะระบบดูฉลาด ทำงานอัตโนมัติ หรือมี sensor. ให้ตรวจว่า ระบบรับรู้ข้อมูลจากสภาพแวดล้อม (percept) แล้วเลือกการกระทำ (action) เพื่อเป้าหมายและผลการทำงานที่เหมาะสมหรือไม่';}
  function showHeld(){
    const a=area(); if(!a||!heldNextNodes||!lastBossSnapshot)return;
    a.replaceChildren();
    const wrap=document.createElement('div');wrap.className='gamePanel bossPanel aq-s2-boss-feedback-hold';
    wrap.appendChild(lastBossSnapshot);
    const box=document.createElement('div');box.className='feedback';box.style.cssText='display:block;margin-top:16px;padding:16px;border:1px solid rgba(56,189,248,.55);border-radius:16px;background:rgba(56,189,248,.12);line-height:1.65';
    box.innerHTML='<b>🧠 Feedback จาก Rational Agent Boss</b><br>'+explain()+'<div class="row" style="margin-top:14px"><button type="button" class="btn good" id="aqS2BossContinue">อ่านแล้ว ไปข้อถัดไป</button></div>';
    wrap.appendChild(box);a.appendChild(wrap);
    document.getElementById('aqS2BossContinue').onclick=()=>{const target=area();if(!target||!heldNextNodes)return;target.replaceChildren(...heldNextNodes);heldNextNodes=null;lastBossSnapshot=null;awaitingAdvance=false;};
  }
  function maybeHold(){
    const a=area();if(!a||!awaitingAdvance||!lastBossSnapshot||!a.querySelector('.bossPanel')||!isBossText(a.innerText))return;
    heldNextNodes=Array.from(a.childNodes);setTimeout(showHeld,0);
  }
  function boot(){const a=area();if(!a||observer)return;observer=new MutationObserver(()=>{if(awaitingAdvance)maybeHold();});observer.observe(a,{childList:true,subtree:false});}
  document.addEventListener('click',ev=>{const btn=ev.target.closest('.bossPanel .choiceBtn');if(!btn)return;const p=btn.closest('.bossPanel');if(!p||!isBossText(p.innerText))return;snapshotBoss();awaitingAdvance=true;},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,100),{once:true});else setTimeout(boot,100);
  window.AIQuestS2BossFeedbackPause={version:VERSION};console.log('[AIQuest] '+VERSION+' loaded');
})();