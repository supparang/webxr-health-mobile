/* =========================================================
   EAP Hero • Skill Result Truth Lock v145
   - Prevents Reading/Speaking status swapping.
   - Accepts a local result only when the result heading explicitly says
     "<Skill> Evidence Saved" and the Session is explicit in the result card
     or in the last skill launch context.
   - Removes conflicting bridge-generated records for the same result.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-SKILL-RESULT-TRUTH-LOCK-V145';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var CTX_KEY='EAP_SKILL_LAUNCH_CONTEXT_V145';
  var RECEIPT_KEY='EAP_SKILL_RESULT_RECEIPTS_V145';
  var SKILLS=['Reading','Writing','Listening','Speaking'];
  var timer=0,lastReceipt='';

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}}
  function skill(v){var t=clean(v).toLowerCase();return SKILLS.find(function(s){return t===s.toLowerCase()||t.indexOf(s.toLowerCase())>=0;})||'';}
  function sid(v){var t=clean(v).toUpperCase(),m=t.match(/(?:SESSION\s*:?[ ]*|\bS)(1[0-5]|[1-9])\b/);return m?'S'+Number(m[1]):'';}
  function scoreFrom(text){var m=String(text||'').match(/\b(\d{1,3})\s*\/\s*100\b/);if(!m)return 0;var n=Number(m[1]);return isFinite(n)?Math.max(0,Math.min(100,n)):0;}
  function activeSession(){
    var c=read(CTX_KEY,{}),s=sid(c.sessionId||'');
    if(s)return s;
    try{s=sid(localStorage.getItem('EAP_HERO_CURRENT_ROUTE')||localStorage.getItem('EAP_HERO_ACTIVE_ROUTE')||'');}catch(_){}
    if(s)return s;
    var st=read(STATE_KEY,{});return sid(st.currentSession||st.currentRoute||st.currentCloudRoute||st.activeSession||'');
  }
  function captureLaunch(e){
    var n=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!n)return;
    var sk=skill(clean(n.textContent));if(!sk)return;
    var app=document.getElementById('app'),session=sid(clean(app&&app.innerText||''))||activeSession();
    if(!session)return;
    write(CTX_KEY,{sessionId:session,skill:sk,at:Date.now(),source:'explicit_click'});
  }
  function resultContext(){
    var app=document.getElementById('app');if(!app)return null;
    var text=clean(app.innerText||'');
    var hm=text.match(/\b(Reading|Writing|Listening|Speaking)\s+Evidence\s+Saved\b/i);if(!hm)return null;
    var sk=skill(hm[1]);
    var session='';
    var sm=text.match(new RegExp('\\b'+sk+'\\s*[•·-]\\s*Session\\s*(1[0-5]|[1-9])\\b','i'))||text.match(/\bSession\s*(1[0-5]|[1-9])\b/i);
    if(sm)session='S'+Number(sm[1]);
    var ctx=read(CTX_KEY,{});
    if(!session&&skill(ctx.skill)===sk&&Date.now()-Number(ctx.at||0)<2*60*60*1000)session=sid(ctx.sessionId);
    if(!session)session=activeSession();
    var sc=scoreFrom(text);
    return session&&sk&&sc?{sessionId:session,skill:sk,score:sc}:null;
  }
  function normalizeRecord(r){return {sessionId:sid(r&&(r.sessionId||r.routeId||r.session)),skill:skill(r&&(r.skill||r.skillName)),score:Number(r&&(r.bestScore||r.latestScore||r.score)||0)};}
  function applyReceipt(ctx){
    var key=ctx.sessionId+'|'+ctx.skill+'|'+ctx.score;if(key===lastReceipt)return;
    var state=read(STATE_KEY,{}),list=Array.isArray(state.portfolio)?state.portfolio.slice():[],now=new Date().toISOString();
    list=list.filter(function(r){
      var n=normalizeRecord(r);
      if(n.sessionId!==ctx.sessionId)return true;
      if(r&&r.localResult===true&&r.pendingSheetSync===true&&n.skill!==ctx.skill)return false;
      return !(n.skill===ctx.skill&&r&&r.localResult===true&&r.pendingSheetSync===true);
    });
    list.push({routeId:ctx.sessionId,sessionId:ctx.sessionId,session:Number(ctx.sessionId.slice(1)),skill:ctx.skill,score:ctx.score,latestScore:ctx.score,bestScore:ctx.score,passed:ctx.score>=60,updatedAt:now,latestAt:now,output:ctx.skill+' evidence saved',localResult:true,pendingSheetSync:true,explicitResultReceipt:true,resultTruthVersion:VERSION});
    state.portfolio=list;
    state.sessionProgress=state.sessionProgress&&typeof state.sessionProgress==='object'?state.sessionProgress:{};
    [ctx.sessionId,String(Number(ctx.sessionId.slice(1)))].forEach(function(k){var row=state.sessionProgress[k]&&typeof state.sessionProgress[k]==='object'?state.sessionProgress[k]:{};row.scores=row.scores&&typeof row.scores==='object'?row.scores:{};row.scores[ctx.skill]=ctx.score;row.updatedAt=now;state.sessionProgress[k]=row;});
    state.lastLocalResult={sessionId:ctx.sessionId,skill:ctx.skill,score:ctx.score,updatedAt:now,explicit:true};
    write(STATE_KEY,state);
    var receipts=read(RECEIPT_KEY,{});receipts[ctx.sessionId+'|'+ctx.skill]={score:ctx.score,updatedAt:now};write(RECEIPT_KEY,receipts);
    write(CTX_KEY,{sessionId:ctx.sessionId,skill:ctx.skill,at:Date.now(),source:'explicit_result'});
    lastReceipt=key;
    try{window.dispatchEvent(new CustomEvent('eap:local-result-saved',{detail:state.lastLocalResult}));}catch(_){}
    try{window.EAPRequiredSkillUIV129&&window.EAPRequiredSkillUIV129.render&&window.EAPRequiredSkillUIV129.render();}catch(_){}
  }
  function scan(){var c=resultContext();if(c)applyReceipt(c);document.documentElement.dataset.eapSkillTruthVersion=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(scan,80);}
  document.addEventListener('click',captureLaunch,true);
  window.addEventListener('eap:phase-a-task-launch',function(e){var d=e&&e.detail||{},s=sid(d.sessionId),sk=skill(d.skill);if(s&&sk)write(CTX_KEY,{sessionId:s,skill:sk,at:Date.now(),source:'phase_a_event'});});
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('load',function(){scan();setTimeout(scan,500);setTimeout(scan,1500);});
  scan();
})();