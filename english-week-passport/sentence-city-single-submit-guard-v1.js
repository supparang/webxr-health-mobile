/* Sentence City • Single Submit Guard V1
 * Prevents repeated AR dwell/pinch submissions during the success delay.
 * Incomplete blueprints remain unsubmitted and receive no score/progress.
 */
(function(){
  'use strict';

  const VERSION='2026-08-06-SC-SINGLE-SUBMIT-GUARD-V1';
  let observedFeedback=null;
  let feedbackObserver=null;
  let taskLocked=false;
  let taskSerial=0;
  let acceptedSubmissions=0;

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

  function observeFeedback(feedback){
    if(!feedback||feedback===observedFeedback)return;
    feedbackObserver?.disconnect();
    observedFeedback=feedback;
    taskLocked=false;
    taskSerial++;

    feedbackObserver=new MutationObserver(()=>{
      const text=feedback.textContent.trim();
      if(feedback.classList.contains('good')||text.includes('Sentence complete')){
        lockAcceptedTask();
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

  function scan(){
    observeFeedback(getFeedback());
    repairSummaryTruth();
  }

  const rootObserver=new MutationObserver(scan);
  rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  scan();

  window.SENTENCE_CITY_SUBMIT_GUARD={
    version:VERSION,
    get taskLocked(){return taskLocked},
    get taskSerial(){return taskSerial},
    get acceptedSubmissions(){return acceptedSubmissions}
  };
})();
