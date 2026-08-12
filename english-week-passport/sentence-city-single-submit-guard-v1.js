/* Sentence City • Single Submit Guard V1.5
 * Prevents repeated AR dwell/pinch submissions during the success delay.
 * Publishes the canonical Passport result contract so the Firestore Game Shell
 * can save once, receive a receipt, unlock the next stage, and auto-return.
 * V1.5 also hard-gates task transitions until Teacher speech is audibly done.
 */
(function(){
  'use strict';

  const VERSION='2026-08-12-SC-SINGLE-SUBMIT-GUARD-V1-5-SPEECH-HARD-GATE';
  const sessionStartedAt=Date.now();
  let observedFeedback=null;
  let feedbackObserver=null;
  let taskLocked=false;
  let taskSerial=0;
  let acceptedSubmissions=0;
  let incompleteSubmitAttempts=0;
  let lastIncompleteText='';
  let resultPublished=false;

  /* Android Chrome can report speechSynthesis idle/onend before the audible
     tail has actually finished. Track a conservative audible window and
     delay the core 900 ms `state.index += 1; showTask()` transition. */
  const synth=window.speechSynthesis;
  let minAudibleUntil=0;
  function estimateMs(utterance){
    const text=String(utterance?.text||'');
    const words=text.trim()?text.trim().split(/\s+/).length:0;
    const rate=Math.max(.55,Number(utterance?.rate)||1);
    return Math.min(18000,Math.max(1800,850+(words*440/rate)+(text.length*24/rate)));
  }
  function installSpeechTracker(){
    if(!synth||synth.__sentenceCityAudibleTailV15)return;
    const nativeSpeak=synth.speak.bind(synth);
    synth.speak=function(utterance){
      minAudibleUntil=Math.max(minAudibleUntil,Date.now()+estimateMs(utterance));
      return nativeSpeak(utterance);
    };
    synth.__sentenceCityAudibleTailV15=true;
  }
  function waitTeacherDone(callback,maxWait=20000){
    const started=Date.now();let idleSince=0;
    const tick=()=>{
      const now=Date.now();
      const engineBusy=Boolean(synth&&(synth.speaking||synth.pending));
      if(engineBusy||now<minAudibleUntil)idleSince=0;else if(!idleSince)idleSince=now;
      if(!engineBusy&&now>=minAudibleUntil&&idleSince&&now-idleSince>=480){callback();return;}
      if(now-started>=maxWait){callback();return;}
      nativeSetTimeout(tick,80);
    };
    tick();
  }
  const nativeSetTimeout=window.setTimeout.bind(window);
  function installTransitionTimerGate(){
    if(window.__SC_TRANSITION_TIMER_GATE_V15)return;
    window.__SC_TRANSITION_TIMER_GATE_V15=true;
    window.setTimeout=function(callback,delay,...args){
      const source=typeof callback==='function'?Function.prototype.toString.call(callback):'';
      const isTaskAdvance=/state\.index\s*\+=\s*1/.test(source)&&/showTask\s*\(/.test(source);
      if(isTaskAdvance){
        return nativeSetTimeout(()=>waitTeacherDone(()=>callback(...args)),Math.max(0,Number(delay)||0));
      }
      return nativeSetTimeout(callback,delay,...args);
    };
  }
  installSpeechTracker();
  installTransitionTimerGate();

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
      check.textContent='บันทึกแล้ว • ฟัง Teacher ให้จบก่อนข้อถัดไป…';
    }
    const status=document.getElementById('status');
    if(status)status.innerHTML='ส่งคำตอบแล้ว ✓<small>ระบบจะเปิดภารกิจถัดไปเมื่อ Teacher พูดจบ</small>';
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
      if(feedback.classList.contains('good')||text.includes('Sentence complete')){lockAcceptedTask();return;}
      if(text.includes('ยังวางคำไม่ครบทุกช่อง'))markIncomplete(feedback,text);
    });
    feedbackObserver.observe(feedback,{attributes:true,attributeFilter:['class'],childList:true,characterData:true,subtree:true});
  }

  function findStat(summary,label){
    const wanted=String(label||'').trim().toUpperCase();
    const stat=[...summary.querySelectorAll('.summary-grid .stat')].find((node)=>(node.querySelector('small')?.textContent||'').trim().toUpperCase()===wanted);
    if(!stat)return NaN;
    return Number((stat.querySelector('b')?.textContent||'').replace(/[^0-9.\-]/g,''));
  }

  function summaryVisible(summary){
    if(!summary||summary.classList.contains('hidden'))return false;
    const panel=summary.closest('.panel');
    if(panel?.classList.contains('hidden'))return false;
    const style=getComputedStyle(summary);
    return style.display!=='none'&&style.visibility!=='hidden';
  }

  function repairSummaryTruth(){
    const summary=document.querySelector('.summary');
    if(!summary)return;
    const firstValue=findStat(summary,'FIRST-TRY');
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

  function publishPassportResult(){
    if(resultPublished&&window.SENTENCE_CITY_LAST_RESULT)return;
    const summary=document.querySelector('.summary');
    if(!summaryVisible(summary))return;

    const firstTryAccuracy=findStat(summary,'FIRST-TRY');
    const finalMastery=findStat(summary,'FINAL MASTERY');
    const score=findStat(summary,'SCORE');
    const bestCombo=findStat(summary,'BEST COMBO');
    if(!Number.isFinite(firstTryAccuracy)||!Number.isFinite(finalMastery)||!Number.isFinite(score))return;

    const params=new URLSearchParams(location.search);
    const result=Object.freeze({
      gameId:'sentence_city',
      stageId:'sentence_city',
      firstTryAccuracy:Math.max(0,Math.min(100,Math.round(firstTryAccuracy))),
      finalMastery:Math.max(0,Math.min(100,Math.round(finalMastery))),
      score:Math.max(0,Math.round(score)),
      bestCombo:Number.isFinite(bestCombo)?Math.max(0,Math.round(bestCombo)):0,
      durationSec:Math.max(1,Math.round((Date.now()-sessionStartedAt)/1000)),
      completed:true,
      passed:firstTryAccuracy>=70,
      missionSet:params.get('passportRotation')||params.get('missionSet')||'',
      passportRotation:params.get('passportRotation')||'',
      randomSeed:Number(params.get('randomSeed')||0)||0,
      playerId:params.get('pid')||params.get('playerId')||'',
      sourceVersion:VERSION,
      completedAt:new Date().toISOString()
    });

    window.SENTENCE_CITY_LAST_RESULT=result;
    resultPublished=true;
    document.documentElement.dataset.passportResultReady='1';
    try{window.dispatchEvent(new CustomEvent('sentence-city-complete',{detail:result}))}catch(_){}
    try{window.parent?.postMessage({type:'LEXICON_GAME_RESULT_READY',stageId:'sentence_city',sourceVersion:VERSION,result},location.origin)}catch(_){}
  }

  function hasPassportShell(){
    try{return Boolean(window.top&&window.top!==window&&window.top.EW_PASSPORT_GAME_SHELL)}catch(_){return false}
  }

  function directReturnToPassport(){
    const params=new URLSearchParams(location.search);
    const q=new URLSearchParams({resume:'passport',fromGame:'sentence_city',v:'20260812-sc-speech-hard-gate-v15'});
    const pid=params.get('pid')||params.get('playerId');
    if(pid)q.set('pid',pid);
    if(params.get('view')==='mobile')q.set('view','mobile');
    try{window.top.location.assign('./index.html?'+q.toString())}catch(_){location.assign('./index.html?'+q.toString())}
  }

  function repairPassportReturn(){
    const summary=document.querySelector('.summary');
    if(!summary)return;
    document.querySelectorAll('button,a').forEach((element)=>{
      const text=(element.textContent||'').trim();
      if(!/Back\s+to\s+Test\s+Hub|กลับ\s*Test\s*Hub|Back\s+to\s+Passport/i.test(text))return;
      element.textContent='กลับ Passport';
      element.setAttribute('aria-label','กลับ Passport');
      element.setAttribute('data-passport-return','1');
      if(!hasPassportShell()&&element.dataset.directPassportFallback!=='1'){
        element.dataset.directPassportFallback='1';
        element.addEventListener('click',(event)=>{
          event.preventDefault();event.stopPropagation();directReturnToPassport();
        },true);
      }
    });
  }

  function scan(){
    observeFeedback(getFeedback());
    repairSummaryTruth();
    publishPassportResult();
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
    get passportShell(){return hasPassportShell()},
    get resultPublished(){return resultPublished},
    publishPassportResult,
    waitTeacherDone
  };
})();
