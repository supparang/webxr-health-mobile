/* EAP Hero sheet bridge v121.
   Baselines saved portfolio before game engine starts, then sends only brand-new evidence.
*/
(function(){
  'use strict';
  const WEB_APP_URL='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const SECTION='122';
  const STATE_KEY='EAP_HERO_PROGRESS_V3';
  const SENT_KEY='EAP_HERO_SHEET_SENT_V121';
  let baselineReady=false;
  let known={};
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'')}catch(_){return fallback}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}}
  function text(value){return value==null?'':String(value)}
  function number(value,fallback){const n=Number(value);return Number.isFinite(n)?n:(fallback==null?0:fallback)}
  function profile(state){const p=state.profile||state.player||{};return{studentId:text(p.studentId||p.id||state.studentId||'guest'),studentName:text(p.studentName||p.name||state.studentName||'Guest'),section:text(p.section||state.section||SECTION)}}
  function stamp(entry,index){return text(entry.latestAt||entry.at||entry.evidenceId||index)}
  function signature(entry,index){return [text(entry.session||entry.sessionId),text(entry.skill).toLowerCase(),stamp(entry,index),text(entry.latestScore!==undefined?entry.latestScore:entry.score)].join('|')}
  function validAccuracy(entry){for(const value of [entry.accuracy,entry.bestAccuracy,entry.accPct,entry.accuracyPct]){const n=Number(value);if(Number.isFinite(n))return Math.max(0,Math.min(100,n))}return ''}
  function send(payload){const url=new URL(WEB_APP_URL);Object.keys(payload).forEach(key=>url.searchParams.set(key,text(payload[key])));url.searchParams.set('_cache',String(Date.now()));const frame=document.createElement('iframe');frame.width='1';frame.height='1';frame.style.cssText='position:fixed;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';frame.onload=()=>setTimeout(()=>frame.remove(),2500);frame.src=url.toString();(document.body||document.documentElement).appendChild(frame)}
  function entries(state){return Array.isArray(state&&state.portfolio)?state.portfolio.map((entry,index)=>({entry:entry||{},index:index})).filter(item=>text(item.entry.session||item.entry.sessionId)&&text(item.entry.skill)):[]}
  function baseline(){const state=read(STATE_KEY,null);entries(state).forEach(item=>{known[signature(item.entry,item.index)]=true});baselineReady=true}
  function sync(){
    if(!baselineReady){baseline();return}
    const state=read(STATE_KEY,null); const p=profile(state); const sent=read(SENT_KEY,{});
    entries(state).forEach(item=>{
      const entry=item.entry, sig=signature(entry,item.index);
      if(known[sig])return;
      known[sig]=true;
      const legacy=entry.legacyCompletion===true||text(entry.legacyCompletion).toLowerCase()==='true';
      if(legacy)return;
      const sessionId=text(entry.session||entry.sessionId);
      const id='eap-v121-'+p.studentId+'-'+sessionId+'-'+text(entry.skill).toLowerCase()+'-'+encodeURIComponent(stamp(entry,item.index));
      if(sent[id])return;
      const score=number(entry.latestScore!==undefined?entry.latestScore:entry.score,0);
      send({action:'submit_attempt',attemptId:id,studentId:p.studentId,studentName:p.studentName,section:p.section,sessionId:sessionId,sessionTitle:text(entry.sessionTitle),skill:text(entry.skill),score:score,accuracy:validAccuracy(entry),passMark:60,passed:score>=60,legacyCompletion:false,hintUsed:number(entry.aiUses||entry.hintUsed,0),replay:entry.replay===true,clientTimestamp:stamp(entry,item.index),sourceUrl:location.href});
      sent[id]=Date.now();
    });
    write(SENT_KEY,sent);
  }
  baseline();
  window.EAPSheetSyncV121={sync:sync,baseline:baseline};
  setInterval(sync,900);
})();