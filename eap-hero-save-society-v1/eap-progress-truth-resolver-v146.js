/* =========================================================
   EAP Hero • Progress Truth Resolver v146
   - One local truth for Skill Hub, Map cards, Portfolio and Result page.
   - Excludes migrated legacy placeholders, zero-score rows and malformed rows.
   - Rebuilds sessionProgress from canonical portfolio evidence only.
   - Official Sheet records remain authoritative when cloud/server verified.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-PROGRESS-TRUTH-RESOLVER-V146';
  var KEY='EAP_HERO_PROGRESS_V3';
  var PASS=60;
  var SKILLS=['Reading','Writing','Listening','Speaking'];
  var REQUIRED={
    S1:['Reading','Speaking'],S2:['Reading','Writing'],S3:['Reading','Writing'],
    S4:['Reading','Listening'],S5:['Reading','Speaking'],S6:['Listening','Writing'],
    S7:['Reading','Writing'],S8:['Reading','Speaking'],S9:['Writing','Speaking'],
    S10:['Reading','Writing'],S11:['Writing','Speaking'],S12:['Reading','Listening'],
    S13:['Listening','Writing'],S14:['Writing','Speaking'],S15:['Reading','Speaking']
  };
  var busy=false,timer=0,lastHash='';

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}}
  function write(v){try{localStorage.setItem(KEY,JSON.stringify(v));return true;}catch(_){return false;}}
  function sid(v){var t=clean(v).toUpperCase(),m=t.match(/(?:SESSION\s*:?[ ]*|\bS)(1[0-5]|[1-9])\b/);if(m)return'S'+Number(m[1]);if(/^\d{1,2}$/.test(t)&&Number(t)>=1&&Number(t)<=15)return'S'+Number(t);return'';}
  function skill(v){var t=clean(v).toLowerCase();return SKILLS.find(function(s){return t.indexOf(s.toLowerCase())>=0;})||'';}
  function score(r){var vals=[r&&r.bestScore,r&&r.latestScore,r&&r.score,r&&r.autoScore,r&&r.missionTaskScore];for(var i=0;i<vals.length;i++){var n=Number(vals[i]);if(Number.isFinite(n)&&n>=0&&n<=100)return n;}return 0;}
  function stamp(r){var vals=[r&&r.updatedAt,r&&r.latestAt,r&&r.completedAt,r&&r.createdAt,r&&r.clientTimestamp,r&&r.timestamp];for(var i=0;i<vals.length;i++){var d=new Date(vals[i]);if(vals[i]&&!isNaN(d.getTime()))return d.toISOString();}return'';}
  function isLegacy(r){
    var text=clean([r&&r.output,r&&r.note,r&&r.source,r&&r.resumeSource].join(' '));
    return !!(r&&(r.legacyCompletion===true||String(r.legacyCompletion).toUpperCase()==='TRUE'||r.legacy===true||/legacy evidence retained|browser-storage migration|completed legacy evidence/i.test(text)));
  }
  function isTrusted(r){
    if(!r)return false;
    if(r.cloudVerified===true||r.serverVerified===true||r.restoredFromSheet===true)return true;
    if(r.localResult===true||r.pendingSheetSync===true||/^local_/i.test(clean(r.evidenceId)))return true;
    return false;
  }
  function canonical(rows){
    var map={};
    (Array.isArray(rows)?rows:[]).forEach(function(r){
      var session=sid(r&&(r.sessionId||r.routeId||r.session||r.taskId));
      var sk=skill(r&&(r.skill||r.skillName||r.evidenceType||r.taskId));
      var sc=score(r);
      if(!session||!sk||sc<=0||isLegacy(r)||!isTrusted(r))return;
      var key=session+'|'+sk;
      var rec=Object.assign({},r,{sessionId:session,routeId:session,session:Number(session.slice(1)),skill:sk,score:sc,latestScore:sc,bestScore:sc,passed:sc>=PASS});
      var ts=stamp(rec);if(ts){rec.updatedAt=ts;rec.latestAt=ts;}
      var old=map[key];
      if(!old||sc>score(old)||(sc===score(old)&&stamp(rec)>stamp(old)))map[key]=rec;
    });
    return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){var d=Number(a.sessionId.slice(1))-Number(b.sessionId.slice(1));return d||SKILLS.indexOf(a.skill)-SKILLS.indexOf(b.skill);});
  }
  function rebuildProgress(state,rows){
    var progress={};
    for(var i=1;i<=15;i++){
      var id='S'+i,scores={Reading:0,Writing:0,Listening:0,Speaking:0};
      rows.forEach(function(r){if(r.sessionId===id)scores[r.skill]=Math.max(scores[r.skill]||0,score(r));});
      var req=REQUIRED[id]||[];
      var passed=req.length>0&&req.every(function(sk){return Number(scores[sk]||0)>=PASS;});
      progress[id]={sessionId:id,scores:scores,requiredSkills:req.slice(),passed:passed,complete:passed,truthVersion:VERSION};
      progress[String(i)]=progress[id];
    }
    state.sessionProgress=progress;
    state.completedSessions=Object.keys(REQUIRED).filter(function(id){return progress[id].passed;}).map(function(id){return Number(id.slice(1));});
    state.progressTruthVersion=VERSION;
  }
  function resultContext(){
    var app=document.getElementById('app');if(!app)return null;
    var text=clean(app.innerText||'');
    var m=text.match(/(Reading|Writing|Listening|Speaking)\s+Evidence\s+Saved/i);
    if(!m)return null;
    var sk=skill(m[1]),session='';
    var x=text.match(new RegExp(sk+'\\s*[•|·-]\\s*Session\\s*(1[0-5]|[1-9])','i'));
    if(x)session='S'+Number(x[1]);
    var scoreMatch=text.match(/(\d{1,3})\s*\/\s*100\s*Auto Score/i)||text.match(/Auto Score\s*(\d{1,3})/i);
    return {skill:sk,sessionId:session,score:scoreMatch?Number(scoreMatch[1]):0};
  }
  function repairResultPanels(ctx){
    if(!ctx)return;
    [...document.querySelectorAll('#app section,#app article,#app div')].forEach(function(n){
      var t=clean(n.textContent);if(t.length>1200)return;
      var m=t.match(/(Reading|Writing|Listening|Speaking)\s*[•|·-]\s*Session\s*(1[0-5]|[1-9])/i);
      if(!m)return;
      var sameSkill=skill(m[1])===ctx.skill;
      var sameSession=!ctx.sessionId||('S'+Number(m[2])===ctx.sessionId);
      if(!sameSkill||!sameSession){n.style.setProperty('display','none','important');n.setAttribute('data-eap-truth-hidden','mismatch');}
    });
  }
  function refreshApis(){
    try{window.EAPRequiredSkillUIV129&&window.EAPRequiredSkillUIV129.render&&window.EAPRequiredSkillUIV129.render();}catch(_){ }
    try{window.EAPStrictSkillScoreTruth&&window.EAPStrictSkillScoreTruth.refresh&&window.EAPStrictSkillScoreTruth.refresh();}catch(_){ }
    try{window.EAPFourSkillProgress&&window.EAPFourSkillProgress.refresh&&window.EAPFourSkillProgress.refresh();}catch(_){ }
  }
  function reconcile(){
    if(busy)return;busy=true;
    try{
      var state=read(),rows=canonical(state.portfolio),ctx=resultContext();
      if(ctx&&ctx.sessionId&&ctx.skill&&ctx.score>0){
        var key=ctx.sessionId+'|'+ctx.skill,found=false;
        rows=rows.filter(function(r){
          var same=r.sessionId===ctx.sessionId&&r.skill===ctx.skill;
          if(same){found=true;r.score=Math.max(score(r),ctx.score);r.latestScore=r.score;r.bestScore=r.score;r.passed=r.score>=PASS;}
          return true;
        });
        if(!found)rows.push({sessionId:ctx.sessionId,routeId:ctx.sessionId,session:Number(ctx.sessionId.slice(1)),skill:ctx.skill,score:ctx.score,latestScore:ctx.score,bestScore:ctx.score,passed:ctx.score>=PASS,localResult:true,pendingSheetSync:true,evidenceId:'truth_'+Date.now(),updatedAt:new Date().toISOString()});
      }
      rows=canonical(rows);
      state.portfolio=rows;
      rebuildProgress(state,rows);
      var hash=JSON.stringify(rows.map(function(r){return[r.sessionId,r.skill,score(r),stamp(r)];}));
      if(hash!==lastHash){write(state);lastHash=hash;try{window.dispatchEvent(new CustomEvent('eap:progress-truth-updated',{detail:{version:VERSION,records:rows}}));}catch(_){ }}
      repairResultPanels(ctx);refreshApis();
      window.EAPProgressTruthResolver={version:VERSION,records:rows,required:REQUIRED,diagnostics:function(){return{version:VERSION,records:rows,sessionProgress:state.sessionProgress};},refresh:reconcile};
      document.documentElement.dataset.eapProgressTruthVersion=VERSION;
    }finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,120);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:local-result-saved','eap:resume-synced','eap:progress-truth-updated'].forEach(function(e){window.addEventListener(e,schedule);});
  setTimeout(reconcile,50);setTimeout(reconcile,700);setTimeout(reconcile,1800);
})();