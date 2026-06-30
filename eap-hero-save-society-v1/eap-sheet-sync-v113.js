/* EAP Hero sheet sync: new evidence only. */
(function(){
  'use strict';
  const CFG=window.EAP_SHEET_BRIDGE_CONFIG||window.EAP_SHEET_CONFIG||{};
  const STATE='EAP_HERO_PROGRESS_V3';
  const TRACK='EAP_HERO_SHEET_TRACK_V114';
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'')}catch(_){return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const text=v=>v==null?'':String(v);
  const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const present=v=>v!==''&&v!=null&&Number.isFinite(Number(v));
  function accuracy(e){
    for(const v of [e.accuracy,e.bestAccuracy,e.accPct,e.accuracyPct]) if(present(v)) return Math.max(0,Math.min(100,num(v)));
    const c=e.correct??e.correctCount, t=e.total??e.questionCount??e.questions;
    return present(c)&&present(t)&&num(t)>0?Math.round(num(c)/num(t)*100):null;
  }
  function profile(s){const p=s.profile||s.player||{};return{studentId:text(p.studentId||p.id||s.studentId||'guest'),studentName:text(p.studentName||p.name||s.studentName||'Guest'),section:text(p.section||s.section||CFG.section||'122')}}
  function key(e,i){return [text(e.session||e.sessionId),text(e.skill).toLowerCase(),text(e.latestAt||e.at||e.evidenceId||i)].join('|')}
  function transmit(payload){const u=new URL(CFG.webAppUrl);Object.keys(payload).forEach(k=>u.searchParams.set(k,text(payload[k])));u.searchParams.set('_',Date.now());const im=document.createElement('img');im.width=im.height=1;im.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0';im.onload=im.onerror=()=>setTimeout(()=>im.remove(),100);im.src=u;document.body.appendChild(im)}
  function sync(){
    if(!CFG.enabled||!CFG.webAppUrl)return;
    const s=read(STATE,null); if(!s||!Array.isArray(s.portfolio))return;
    const p=profile(s), pkey=p.studentId+'|'+p.section;
    const tr=read(TRACK,{profileKey:'',ready:false,known:{},sent:{}});
    if(tr.profileKey!==pkey){tr.profileKey=pkey;tr.ready=false;tr.known={};tr.sent={}}
    const list=s.portfolio.map((entry,index)=>({entry:entry||{},index})).filter(x=>text(x.entry.session||x.entry.sessionId)&&text(x.entry.skill));
    if(!tr.ready){list.forEach(x=>tr.known[key(x.entry,x.index)]=true);tr.ready=true;write(TRACK,tr);return}
    list.forEach(x=>{
      const e=x.entry,k=key(e,x.index); if(tr.known[k])return; tr.known[k]=true;
      const legacy=e.legacyCompletion===true||text(e.legacyCompletion).toLowerCase()==='true'; if(legacy)return;
      const id='eap-'+p.studentId+'-'+k.replace(/[^A-Za-z0-9_-]/g,''); if(tr.sent[id])return;
      const sid=text(e.session||e.sessionId), score=num(e.latestScore!==undefined?e.latestScore:e.score), acc=accuracy(e);
      transmit({action:'submit_attempt',attemptId:id,studentId:p.studentId,studentName:p.studentName,section:p.section,sessionId:sid,sessionTitle:text(e.sessionTitle||(s.sessions&&s.sessions[sid]&&s.sessions[sid].title)),skill:text(e.skill),score,accuracy:acc===null?'':acc,passMark:60,passed:score>=60,legacyCompletion:false,hintUsed:num(e.aiUses||e.hintUsed),replay:e.replay===true,clientTimestamp:text(e.latestAt||e.at||e.evidenceId||new Date().toISOString()),sourceUrl:location.href});
      tr.sent[id]=Date.now();
    });
    write(TRACK,tr);
  }
  window.EAPSheetSyncV114={sync};
  window.addEventListener('load',()=>setTimeout(sync,900));
  setInterval(sync,1800);
})();
