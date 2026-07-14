/* CSAI2601 UX Quest • Production Sheet Trace Hotfix v1
 * Sends receiver-v4 compatible reason_retry_submitted records.
 */
(function(){
  'use strict';
  var q=new URLSearchParams(location.search||'');
  var nodeId=String(q.get('node')||q.get('id')||'').toUpperCase();
  if(!nodeId||nodeId==='W7')return;
  var cfg=function(){return window.UXQ_CLASSROOM_CONFIG||{};};
  var clean=function(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||900);};
  function profile(){var p={};try{p=window.UXQIdentity&&window.UXQIdentity.get?window.UXQIdentity.get():{};}catch(e){}return {studentId:clean(p.studentId,80),studentName:clean(p.studentName,120),section:clean(p.section||cfg().defaultSection,80)};}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
  function stage(){var t=clean((document.querySelector('.case .kicker')||document.querySelector('.case h1')||{}).textContent,160).toLowerCase();if(/goal|persona|empath|user/.test(t))return 'goal';if(/impact|diagnos|cognitive|load/.test(t))return 'diagnose';if(/proof|test|valid|evaluat|metric/.test(t))return 'test';if(/fix|decision|solution|prototype|layout/.test(t))return 'decision';return 'evidence';}
  function send(item){var url=clean(cfg().receiverUrl,700);if(!url)return;fetch(url,{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(item)}).catch(function(){});}
  function run(){
    var fb=document.querySelector('.feedback.bad');
    if(!fb||fb.dataset.sheetTraceV1==='1')return;
    fb.dataset.sheetTraceV1='1';
    var p=profile();if(!p.studentId||!p.studentName||!p.section)return;
    var now=new Date().toISOString(),attemptId=uid(nodeId.toLowerCase()+'-trace-attempt'),focus=stage();
    send({
      app:'ux-quest',schema:'uxq.reason-retry.v1',eventType:'reason_retry_submitted',
      eventId:uid(nodeId.toLowerCase()+'-reason-trace'),attemptId:attemptId,linkedAttemptId:attemptId,
      occurredAt:now,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Bangkok',pageUrl:clean(location.href,500),
      courseId:clean(cfg().courseId||'UXQ-ACT1-2026',120),courseLabel:clean(cfg().courseLabel||'CSAI2601 • UX Quest',160),
      studentId:p.studentId,studentName:p.studentName,section:p.section,missionId:nodeId.toLowerCase(),missionTitle:nodeId+' • UX Quest',
      reasonRetry:{response:clean(fb.textContent,420),verifiedAccuracy:0,focus:[{stageKey:focus,count:1,mainCorrect:false}],submittedAt:now}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  new MutationObserver(function(){setTimeout(run,25);}).observe(document.documentElement,{childList:true,subtree:true});
})();