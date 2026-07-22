/* =========================================================
   EAP Hero • Portfolio Integrity v142
   - Canonicalizes local portfolio records by Session + Skill.
   - Keeps the best score, latest valid timestamp, and useful output.
   - Removes malformed zero/one-point legacy rows when a valid result exists.
   - Rebuilds Recent Portfolio as a compact mobile-friendly summary.
   - Local cleanup only; does not alter Sheet authority or unlock rules.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-PORTFOLIO-INTEGRITY-V142';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var STYLE_ID='eap-portfolio-integrity-v142-style';
  var timer=0,lastDataKey='';
  var SKILLS=['Reading','Writing','Listening','Speaking'];

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function write(v){try{localStorage.setItem(STATE_KEY,JSON.stringify(v));return true;}catch(_){return false;}}
  function skill(v){var t=clean(v).toLowerCase();return SKILLS.find(function(s){return t.indexOf(s.toLowerCase())>=0;})||'';}
  function sid(v){var t=clean(v).toUpperCase(),m=t.match(/(?:SESSION\s*:?[ ]*|\bS)(1[0-5]|[1-9])\b/);if(m)return'S'+Number(m[1]);if(/^\d{1,2}$/.test(t)&&Number(t)>=1&&Number(t)<=15)return'S'+Number(t);return'';}
  function score(r){
    var vals=[r&&r.bestScore,r&&r.latestScore,r&&r.score,r&&r.autoScore,r&&r.missionTaskScore,r&&r.accuracy];
    for(var i=0;i<vals.length;i++){var n=Number(vals[i]);if(Number.isFinite(n)&&n>=0&&n<=100)return n;}
    return 0;
  }
  function timestamp(r){
    var vals=[r&&r.updatedAt,r&&r.latestAt,r&&r.completedAt,r&&r.createdAt,r&&r.clientTimestamp,r&&r.timestamp,r&&r.date];
    for(var i=0;i<vals.length;i++){var d=new Date(vals[i]);if(vals[i]&&!isNaN(d.getTime()))return d.toISOString();}
    return '';
  }
  function output(r){
    var vals=[r&&r.studentOutput,r&&r.output,r&&r.answer,r&&r.response,r&&r.text,r&&r.reflection,r&&r.summary];
    for(var i=0;i<vals.length;i++){var t=clean(vals[i]);if(t&&!/pending sheet sync|legacy|cloud|system|migration/i.test(t))return t;}
    return 'ทำภารกิจสำเร็จแล้ว';
  }
  function quality(r){
    var q=0,s=score(r),ts=timestamp(r),o=output(r);
    if(s>=60)q+=1000;if(s>1)q+=100;if(ts)q+=20;if(o&&o!=='ทำภารกิจสำเร็จแล้ว')q+=10;
    if(r&&r.cloudVerified)q+=5;if(r&&r.serverVerified)q+=5;if(r&&r.pendingSheetSync)q+=2;
    return q+s;
  }
  function canonicalize(){
    var state=read(),list=Array.isArray(state.portfolio)?state.portfolio:[],map={},changed=false;
    list.forEach(function(r){
      var session=sid(r&&(r.sessionId||r.routeId||r.session||r.sessionCode||r.taskId));
      var sk=skill(r&&(r.skill||r.skillName||r.evidenceType||r.taskId||r.type));
      if(!session||!sk){changed=true;return;}
      var key=session+'|'+sk,rec=Object.assign({},r,{sessionId:session,routeId:session,session:Number(session.slice(1)),skill:sk});
      rec.score=score(rec);rec.latestScore=rec.score;rec.bestScore=rec.score;
      var ts=timestamp(rec);if(ts){rec.updatedAt=ts;rec.latestAt=ts;}
      rec.output=output(rec);
      var old=map[key];
      if(!old){map[key]=rec;return;}
      changed=true;
      var oldScore=score(old),newScore=score(rec);
      var winner=(newScore>oldScore||(newScore===oldScore&&quality(rec)>quality(old)))?rec:old;
      var loser=winner===rec?old:rec;
      winner.bestScore=Math.max(oldScore,newScore);winner.score=winner.bestScore;winner.latestScore=winner.bestScore;
      var a=timestamp(winner),b=timestamp(loser);if(b&&(!a||b>a)){winner.updatedAt=b;winner.latestAt=b;}
      if(output(winner)==='ทำภารกิจสำเร็จแล้ว'&&output(loser)!=='ทำภารกิจสำเร็จแล้ว')winner.output=output(loser);
      map[key]=winner;
    });
    var cleaned=Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){
      var na=Number(a.sessionId.slice(1)),nb=Number(b.sessionId.slice(1));if(na!==nb)return na-nb;return SKILLS.indexOf(a.skill)-SKILLS.indexOf(b.skill);
    });
    if(cleaned.length!==list.length)changed=true;
    if(changed){state.portfolio=cleaned;state.portfolioIntegrityVersion=VERSION;write(state);}
    return cleaned;
  }
  function formatDate(v){var d=new Date(v);if(!v||isNaN(d.getTime()))return 'ล่าสุด';return new Intl.DateTimeFormat('th-TH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(d);}
  function esc(v){return clean(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function inject(){
    if(document.getElementById(STYLE_ID))return;var s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .eap142-summary{display:grid;gap:9px;margin-top:12px}.eap142-row{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid rgba(148,163,184,.24);border-radius:14px;background:#213a53;color:#f8fafc}.eap142-session{font-weight:950;color:#a7f3d0}.eap142-main b{display:block;font-size:14px}.eap142-main small{display:block;margin-top:3px;color:#cbd5e1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.eap142-score{font-weight:950;font-size:16px;color:#a7f3d0}.eap142-empty{padding:16px;border-radius:14px;background:#213a53;color:#cbd5e1;text-align:center}.eap142-original{display:none!important}@media(max-width:760px){.eap142-row{grid-template-columns:52px 1fr auto;padding:10px}.eap142-main b{font-size:13px}.eap142-score{font-size:15px}}
    `;document.head.appendChild(s);
  }
  function findPortfolioTable(){return [...document.querySelectorAll('#app table')].find(function(t){var x=clean(t.innerText).toLowerCase();return x.indexOf('session')>=0&&x.indexOf('skill')>=0&&x.indexOf('score')>=0;})||null;}
  function render(){
    inject();var data=canonicalize(),key=JSON.stringify(data.map(function(r){return[r.sessionId,r.skill,score(r),timestamp(r),output(r)];}));
    var table=findPortfolioTable();if(!table)return;
    var host=table.parentElement||table;table.classList.add('eap142-original');
    var old=host.querySelector('.eap142-summary');if(old&&key===lastDataKey)return;if(old)old.remove();
    var box=document.createElement('div');box.className='eap142-summary';
    if(!data.length)box.innerHTML='<div class="eap142-empty">ยังไม่มีหลักฐานการทำภารกิจ</div>';
    else box.innerHTML=data.slice().sort(function(a,b){return String(timestamp(b)).localeCompare(String(timestamp(a)));}).slice(0,15).map(function(r){return '<div class="eap142-row"><div class="eap142-session">'+esc(r.sessionId)+'</div><div class="eap142-main"><b>'+esc(r.skill)+'</b><small>'+esc(formatDate(timestamp(r)))+' · '+esc(output(r))+'</small></div><div class="eap142-score">'+score(r)+'/100</div></div>';}).join('');
    host.appendChild(box);lastDataKey=key;document.documentElement.dataset.eapPortfolioIntegrityVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,100);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:local-result-saved','eap:resume-synced'].forEach(function(e){window.addEventListener(e,schedule);});
  schedule();
})();