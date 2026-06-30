/* EAP Hero sheet bridge v122.
   Sends only fresh non-legacy portfolio evidence through a POST beacon.
*/
(function(){
  'use strict';
  const WEB_APP_URL='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const SECTION='122';
  const STATE_KEY='EAP_HERO_PROGRESS_V3';
  const SENT_KEY='EAP_HERO_SHEET_SENT_V122';
  let baselineReady=false;
  let known={};

  function read(key,fallback){ try{return JSON.parse(localStorage.getItem(key)||'');}catch(_){return fallback;} }
  function write(key,value){ try{localStorage.setItem(key,JSON.stringify(value));}catch(_){} }
  function text(value){ return value==null?'':String(value); }
  function number(value,fallback){ const n=Number(value); return Number.isFinite(n)?n:(fallback==null?0:fallback); }
  function profile(state){
    const p=(state&& (state.profile||state.player))||{};
    return {studentId:text(p.studentId||p.id||(state&&state.studentId)||'guest'),studentName:text(p.studentName||p.name||(state&&state.studentName)||'Guest'),section:text(p.section||(state&&state.section)||SECTION)};
  }
  function stamp(entry,index){ return text(entry.latestAt||entry.at||entry.evidenceId||index); }
  function signature(entry,index){ return [text(entry.session||entry.sessionId),text(entry.skill).toLowerCase(),stamp(entry,index),text(entry.latestScore!==undefined?entry.latestScore:entry.score)].join('|'); }
  function accuracy(entry){
    for(const value of [entry.accuracy,entry.bestAccuracy,entry.accPct,entry.accuracyPct]){
      const n=Number(value); if(Number.isFinite(n)) return Math.max(0,Math.min(100,n));
    }
    return '';
  }
  function transmit(payload){
    const body=JSON.stringify(payload);
    try{
      if(navigator.sendBeacon){
        const blob=new Blob([body],{type:'text/plain;charset=UTF-8'});
        if(navigator.sendBeacon(WEB_APP_URL,blob)) return true;
      }
    }catch(_){}
    try{
      fetch(WEB_APP_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:body}).catch(function(){});
      return true;
    }catch(_){ return false; }
  }
  function entries(state){
    return Array.isArray(state&&state.portfolio)?state.portfolio.map((entry,index)=>({entry:entry||{},index:index})).filter(item=>text(item.entry.session||item.entry.sessionId)&&text(item.entry.skill)):[];
  }
  function baseline(){
    const state=read(STATE_KEY,null);
    entries(state).forEach(item=>{known[signature(item.entry,item.index)]=true;});
    baselineReady=true;
  }
  function sync(){
    if(!baselineReady){baseline();return;}
    const state=read(STATE_KEY,null);
    const p=profile(state);
    const sent=read(SENT_KEY,{});
    entries(state).forEach(item=>{
      const entry=item.entry;
      const sig=signature(entry,item.index);
      if(known[sig]) return;
      known[sig]=true;
      const legacy=entry.legacyCompletion===true||text(entry.legacyCompletion).toLowerCase()==='true';
      if(legacy) return;
      const sessionId=text(entry.session||entry.sessionId);
      const attemptId='eap-v122-'+p.studentId+'-'+sessionId+'-'+text(entry.skill).toLowerCase()+'-'+encodeURIComponent(stamp(entry,item.index));
      if(sent[attemptId]) return;
      const payload={
        action:'submit_attempt',attemptId:attemptId,studentId:p.studentId,studentName:p.studentName,section:p.section,
        sessionId:sessionId,sessionTitle:text(entry.sessionTitle),skill:text(entry.skill),
        score:number(entry.latestScore!==undefined?entry.latestScore:entry.score,0),accuracy:accuracy(entry),
        passMark:60,passed:number(entry.latestScore!==undefined?entry.latestScore:entry.score,0)>=60,
        legacyCompletion:false,hintUsed:number(entry.aiUses||entry.hintUsed,0),replay:entry.replay===true,
        clientTimestamp:stamp(entry,item.index),sourceUrl:location.href
      };
      if(transmit(payload)) sent[attemptId]=Date.now();
    });
    write(SENT_KEY,sent);
  }
  window.EAPSheetSyncV122={sync:sync,baseline:baseline};
  baseline();
  setInterval(sync,700);
})();