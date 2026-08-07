/* Sentence City • Single Submit Guard V1.2
 * Prevents repeated AR dwell/pinch submissions during the success delay.
 * Incomplete blueprints remain unsubmitted and receive no score/progress.
 * Normalizes the summary return action for Passport production and direct smoke tests.
 */
(function(){
  'use strict';

  const VERSION='2026-08-07-SC-SINGLE-SUBMIT-GUARD-V1-2-PASSPORT-RETURN';
  let observedFeedback=null;
  let feedbackObserver=null;
  let taskLocked=false;
  let taskSerial=0;
  let acceptedSubmissions=0;
  let incompleteSubmitAttempts=0;
  let lastIncompleteText='';

  function getFeedback(){return document.getElementById('feedback')}
  function getCheck(){return document.getElementById('check')}

  function lockAcceptedTask(){
    if(taskLocked)return;
    taskLocked=true;
    acceptedSubmissions++;

    document.querySelectorAll('#mission .ar-target').forEach((element)=>{
      element.classList.remove('ar-target','focus');
      element.setAttribute('aria-disabled','true');
    });

    const check=getCheck();
    if(check){
      check.disabled=true;
      check.dataset.submitLocked='1';
      check.textContent='บันทึกแล้ว • กำลังไปข้อถัดไป…';
    }

    const status=document.getElementById('status');
    if(status){
      status.innerHTML='ส่งคำตอบแล้ว ✓<small>ระบบกำลังเปิดภารกิจถัดไป</small>';
    }
  }

  function markIncomplete(feedback,text){
    if(text===lastIncompleteText)return;
    lastIncompleteText=text;
    incompleteSubmitAttempts++;
    feedback.textContent='ยังไม่ส่งคำตอบ • วางคำให้ครบทุกช่องก่อน';
    feedback.classList.add('bad');
    const check=getCheck();
    if(check){
      check.disabled=false;
      check.removeAttribute('aria-disabled');
      check.textContent='Build Sentence';
    }
  }

  function observeFeedback(feedback){
    if(!feedback||feedback===observedFeedback)return;
    feedbackObserver?.disconnect();
    observedFeedback=feedback;
    taskLocked=false;
    lastIncompleteText='';
    taskSerial++;

    feedbackObserver=new MutationObserver(()=>{
      const text=feedback.textContent.trim();
      if(feedback.classList.contains('good')||text.includes('Sentence complete')){
        lockAcceptedTask();
        return;
      }
      if(text.includes('ยังวางคำไม่ครบทุกช่อง')){
        markIncomplete(feedback,text);
      }
    });
    feedbackObserver.observe(feedback,{attributes:true,attributeFilter:['class'],childList:true,characterData:true,subtree:true});
  }

  function repairSummaryTruth(){
    const summary=document.querySelector('.summary');
    if(!summary)return;
    const stats=[...summary.querySelectorAll('.summary-grid .stat')];
    const firstStat=stats.find((node)=>node.querySelector('small')?.textContent.trim()==='FIRST-TRY');
    const firstValue=Number((firstStat?.querySelector('b')?.textContent||'').replace(/[^0-9.]/g,''));
    const banner=summary.querySelector('.banner.perfect');
    if(banner&&Number.isFinite(firstValue)&&firstValue<100){
      banner.classList.remove('perfect');
      banner.classList.add('rescue');
      banner.textContent='SKYLINE MASTERED';
      const learning=summary.querySelector('.learning');
      if(learning&&learning.textContent.includes('ไม่ต้องเรียกทีมซ่อม')){
        learning.innerHTML=learning.innerHTML.replace(/<br>ไม่ต้องเรียกทีมซ่อม[^<]*/,'<br>ทำครบทุกข้อแล้ว • ตรวจผลจาก First-Try และ Final Mastery');
      }
    }
  }

  function hasPassportShell(){
    try{return Boolean(window.top&&window.top!==window&&window.top.EW_PASSPORT_GAME_SHELL)}catch(_){return false}
  }

  function directReturnToPassport(){
    const params=new URLSearchParams(location.search);
    const q=new URLSearchParams({resume:'passport',fromGame:'sentence_city',v:'20260807-sc-return-v12'});
    const pid=params.get('pid')||params.get('playerId');
    if(pid)q.set('pid',pid);
    try{window.top.location.assign('./index.html?'+q.toString())}catch(_){location.assign('./index.html?'+q.toString())}
  }

  function repairPassportReturn(){
    const summary=document.querySelector('.summary');
    if(!summary)return;
    document.querySelectorAll('button,a').forEach((element)=>{
      const text=(element.textContent||'').trim();
      if(!/Back\s+to\s+Test\s+Hub|กลับ\s*Test\s*Hub/i.test(text))return;
      element.textContent='กลับ Passport';
      element.setAttribute('aria-label','กลับ Passport');
      element.setAttribute('data-passport-return','1');
      if(!hasPassportShell()&&element.dataset.directPassportFallback!=='1'){
        element.dataset.directPassportFallback='1';
        element.addEventListener('click',(event)=>{
          event.preventDefault();
          event.stopPropagation();
          directReturnToPassport();
        },true);
      }
    });
  }

  function scan(){
    observeFeedback(getFeedback());
    repairSummaryTruth();
    repairPassportReturn();
  }

  const rootObserver=new MutationObserver(scan);
  rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  scan();

  window.SENTENCE_CITY_SUBMIT_GUARD={
    version:VERSION,
    get taskLocked(){return taskLocked},
    get taskSerial(){return taskSerial},
    get acceptedSubmissions(){return acceptedSubmissions},
    get incompleteSubmitAttempts(){return incompleteSubmitAttempts},
    get passportShell(){return hasPassportShell()}
  };
})();
