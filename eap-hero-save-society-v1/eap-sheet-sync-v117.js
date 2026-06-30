/* EAP Hero sheet bridge v118: isolated from core engine. */
(function(){
  'use strict';
  const WEB_APP_URL='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const SECTION='122';
  const STATE='EAP_HERO_PROGRESS_V3';
  const TRACK='EAP_HERO_SHEET_TRACK_V117';
  const SUBMISSION_KIND='fresh_evidence_v118';
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')}catch(_){return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const text=v=>v==null?'':String(v);
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const usable=v=>v!==''&&v!=null&&Number.isFinite(Number(v));
  function accuracy(e){
    for(const v of [e.accuracy,e.bestAccuracy,e.accPct,e.accuracyPct]) if(usable(v)) return Math.max(0,Math.min(100,num(v)));
    const c=e.correct??e.correctCount,t=e.total??e.questionCount??e.questions;
    return usable(c)&&usable(t)&&num(t)>0?Math.round(num(c)/num(t)*100):null;
  }
  function person(s){const p=s.profile||s.player||{};return{studentId:text(p.studentId||p.id||s.studentId||'guest'),studentName:text(p.studentName||p.name||s.studentName||'Guest'),section:text(p.section||s.section||SECTION)}}
  function key(e,i){return [text(e.session||e.sessionId),text(e.skill).toLowerCase(),text(e.latestAt||e.at||e.evidenceId||i)].join('|')}
  function submit(payload){const u=new URL(WEB_APP_URL);Object.keys(payload).forEach(k=>u.searchParams.set(k,text(payload[k])));u.searchParams.set('_',Date.now());const img=document.createElement('img');img.width=img.height=1;img.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0';img.onload=img.onerror=()=>setTimeout(()=>img.remove(),100);img.src=u;document.body.appendChild(img)}
  function sync(){
    const s=read(STATE,null);if(!s||!Array.isArray(s.portfolio))return;
    const p=person(s),profileKey=p.studentId+'|'+p.section;
    const t=read(TRACK,{profileKey:'',ready:false,known:{},sent:{}});
    if(t.profileKey!==profileKey){t.profileKey=profileKey;t.ready=false;t.known={};t.sent={}}
    const list=s.portfolio.map((entry,index)=>({entry:entry||{},index})).filter(x=>text(x.entry.session||x.entry.sessionId)&&text(x.entry.skill));
    if(!t.ready){list.forEach(x=>t.known[key(x.entry,x.index)]=true);t.ready=true;write(TRACK,t);return}
    list.forEach(x=>{
      const e=x.entry,k=key(e,x.index);if(t.known[k])return;t.known[k]=true;
      const legacy=e.legacyCompletion===true||text(e.legacyCompletion).toLowerCase()==='true';if(legacy)return;
      const id='eap-'+p.studentId+'-'+k.replace(/[^A-Za-z0-9_-]/g,'');if(t.sent[id])return;
      const sid=text(e.session||e.sessionId),score=num(e.latestScore!==undefined?e.latestScore:e.score),acc=accuracy(e);
      submit({action:'submit_attempt',submissionKind:SUBMISSION_KIND,attemptId:id,studentId:p.studentId,studentName:p.studentName,section:p.section,sessionId:sid,sessionTitle:text(e.sessionTitle||(s.sessions&&s.sessions[sid]&&s.sessions[sid].title)),skill:text(e.skill),score:score,accuracy:acc===null?'':acc,passMark:60,passed:score>=60,legacyCompletion:false,hintUsed:num(e.aiUses||e.hintUsed),replay:e.replay===true,clientTimestamp:text(e.latestAt||e.at||e.evidenceId||new Date().toISOString()),sourceUrl:location.href});
      t.sent[id]=Date.now();
    });
    write(TRACK,t);
  }
  window.EAPSheetSyncV118={sync};
  window.addEventListener('load',()=>setTimeout(sync,900));
  setInterval(sync,1800);
})();
