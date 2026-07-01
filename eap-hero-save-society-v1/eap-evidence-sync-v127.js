/* EAP Hero Evidence Sync v127
   Captures new portfolio evidence and completed Boss Gate answer sets.
   Stores raw learning evidence separately from score summary.
*/
(function(){
  'use strict';
  const URL='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const STATE_KEY='EAP_HERO_PROGRESS_V3';
  const SENT_KEY='EAP_HERO_EVIDENCE_SENT_V127';
  const KIND='fresh_evidence_v118';
  let baseline={portfolio:{},boss:{}};

  const read=(k,f)=>{try{const x=localStorage.getItem(k);return x?JSON.parse(x):f;}catch(e){return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
  const text=v=>v==null?'':String(v);
  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const clean=(v,max)=>text(v).replace(/\s+/g,' ').trim().slice(0,max||3000);
  const state=()=>read(STATE_KEY,null);
  const profile=s=>{
    const p=(s&&(s.profile||s.player))||{};
    return {studentId:text(p.studentId||p.id||s?.studentId||'guest'),studentName:text(p.studentName||p.name||s?.studentName||'Guest'),section:text(p.section||s?.section||'122')};
  };
  const keyFor=e=>text(e.evidenceId||[e.session||e.sessionId,e.skill,e.at||e.latestAt,e.score].join('|'));
  const post=p=>{
    try{navigator.sendBeacon(URL,new Blob([JSON.stringify(p)],{type:'text/plain;charset=UTF-8'}));return true;}
    catch(e){try{fetch(URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(p)}).catch(()=>{});return true;}catch(x){return false;}}
  };
  const evidencePayload=(entry,s)=>{
    const p=profile(s), sessionId=text(entry.session||entry.sessionId);
    const evidenceId='ev-'+[p.studentId,sessionId,text(entry.skill),text(entry.evidenceId||entry.at||entry.latestAt)].join('-').replace(/[^a-zA-Z0-9_-]/g,'');
    return {
      action:'submit_evidence', submissionKind:KIND, evidenceId,
      section:p.section,studentId:p.studentId,studentName:p.studentName,
      sessionId,sessionTitle:text(entry.sessionTitle||''),skill:text(entry.skill||''),
      evidenceType:text(entry.evidenceType||'skill_evidence'),taskId:text(entry.taskId||entry.abilityTaskId||''),
      score:n(entry.latestScore!==undefined?entry.latestScore:entry.score),
      passed:n(entry.latestScore!==undefined?entry.latestScore:entry.score)>=60,
      prompt:clean(entry.prompt||entry.instruction||entry.passage||entry.question,4000),
      output:clean(entry.output||entry.answer||entry.studentAnswer||entry.transcript||'',5000),
      oralChecklist:entry.oralChecklist||{}, durationSec:n(entry.durationSec||entry.speakingSeconds),
      targetRange:text(entry.targetRange||''), teacherReviewRequired:!!entry.teacherReviewRequired,
      teacherReviewStatus:text(entry.teacherReviewStatus||''), misconceptionTags:Array.isArray(entry.misconceptionTags)?entry.misconceptionTags:[],
      attemptCount:n(entry.attemptCount||entry.attemptNo||1,1), occurredAt:text(entry.at||entry.latestAt||new Date().toISOString()), sourceUrl:location.href
    };
  };
  const bossPayload=(a,s)=>{
    const p=profile(s), sid=text(a.sessionId), stamp=text(a.startedAt||Date.now());
    return {action:'submit_evidence',submissionKind:KIND,evidenceId:('bg-'+p.studentId+'-'+sid+'-'+stamp).replace(/[^a-zA-Z0-9_-]/g,''),section:p.section,studentId:p.studentId,studentName:p.studentName,sessionId:sid,sessionTitle:'Boss Gate',skill:'Boss Gate',evidenceType:'boss_gate',taskId:'BG-'+sid,score:n(a.score),passed:n(a.bossHp)<=0,prompt:'Boss Gate: '+sid,output:'',boss:{contract:text(a.contract),startedAt:stamp,timeLeft:n(a.timeLeft),duration:n(a.duration),bossHp:n(a.bossHp),bossHpMax:n(a.bossHpMax),hearts:n(a.hearts),correct:n(a.correct),maxCombo:n(a.maxCombo),usedHints:n(a.usedHints),answers:Array.isArray(a.answers)?a.answers:[]},attemptCount:1,occurredAt:new Date(Number(a.startedAt)||Date.now()).toISOString(),sourceUrl:location.href};
  };
  const baselineNow=()=>{
    const s=state()||{};
    (Array.isArray(s.portfolio)?s.portfolio:[]).forEach(e=>baseline.portfolio[keyFor(e)]=true);
    const a=s.active;
    if(a&&a.mode==='boss') baseline.boss[text(a.sessionId)+'|'+text(a.startedAt)+'|'+(a.answers||[]).length]=true;
  };
  const sync=()=>{
    const s=state(); if(!s)return;
    const sent=read(SENT_KEY,{});
    (Array.isArray(s.portfolio)?s.portfolio:[]).forEach(e=>{
      const k=keyFor(e); if(baseline.portfolio[k])return; baseline.portfolio[k]=true;
      const payload=evidencePayload(e,s); if(sent[payload.evidenceId])return;
      if(post(payload))sent[payload.evidenceId]=Date.now();
    });
    const a=s.active;
    if(a&&a.mode==='boss'&&Array.isArray(a.answers)&&a.answers.length){
      const k=text(a.sessionId)+'|'+text(a.startedAt)+'|'+a.answers.length;
      if(!baseline.boss[k]){
        baseline.boss[k]=true;
        const payload=bossPayload(a,s);
        if(post(payload))sent[payload.evidenceId]=Date.now();
      }
    }
    write(SENT_KEY,sent);
  };
  baselineNow();
  setInterval(sync,900);
  window.EAPEvidenceSyncV127={sync:sync};
})();