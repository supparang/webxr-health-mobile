/* =========================================================
   EAP Hero • Recent Portfolio Authority Renderer v4
   VERSION: 20260812-EAP-RECENT-PORTFOLIO-AUTHORITY-V4-ROUTE-FIRST

   Rules
   1. Read only from EAPAuthorityRuntime.records().
   2. Never request the network.
   3. Force the student table schema to exactly 4 columns:
      Session | Skill | Score | Output.
   4. Include both normal sessions S1-S15 and boss gates B1-B5.
   5. Order by learning-route recency, not inconsistent row timestamps.
      Example after S4: S4 -> B1 -> S3 -> S2 -> S1.
   6. Within each route: Reading -> Listening -> Writing -> Speaking.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_RECENT_PORTFOLIO_AUTHORITY_V4__) return;
  window.__EAP_RECENT_PORTFOLIO_AUTHORITY_V4__=true;

  var VERSION='20260812-EAP-RECENT-PORTFOLIO-AUTHORITY-V4-ROUTE-FIRST';
  var ORDER=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  var SKILL_ORDER={Reading:0,Listening:1,Writing:2,Speaking:3};
  var lastSignature='';
  var timer=0;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function normalizeRoute(v){
    var raw=text(v&&v.routeId||v).toUpperCase(),m;
    m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i); if(m)return 'S'+Number(m[1]);
    m=raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i); if(m)return 'B'+Number(m[1]);
    return raw;
  }
  function normalizeSkill(v){
    var raw=text(v).toLowerCase();
    if(raw==='reading'||raw==='read')return 'Reading';
    if(raw==='listening'||raw==='listen')return 'Listening';
    if(raw==='writing'||raw==='write')return 'Writing';
    if(raw==='speaking'||raw==='speak')return 'Speaking';
    return text(v);
  }
  function validRoute(route){return /^S(?:1[0-5]|[1-9])$/.test(route)||/^B[1-5]$/.test(route);}
  function routeRank(route){var i=ORDER.indexOf(route);return i<0?-1:i;}
  function scoreOf(r){
    var vals=[r&&r.bestScore,r&&r.latestScore,r&&r.score];
    for(var i=0;i<vals.length;i++){var n=Number(vals[i]);if(Number.isFinite(n))return n;}
    return 0;
  }
  function runtimeRecords(){
    var a=window.EAPAuthorityRuntime;
    try{return a&&typeof a.records==='function'?a.records():[];}catch(_){return [];}
  }
  function findTable(){
    var tables=document.querySelectorAll('#app table,table');
    for(var i=0;i<tables.length;i++){
      var labels=text(tables[i].textContent).toLowerCase();
      if(labels.indexOf('session')>=0&&labels.indexOf('skill')>=0&&labels.indexOf('score')>=0&&labels.indexOf('output')>=0)return tables[i];
    }
    return null;
  }
  function ensureFourColumnHeader(table){
    if(!table)return false;
    var thead=table.tHead;
    if(!thead){thead=document.createElement('thead');table.insertBefore(thead,table.firstChild);}
    var row=thead.rows&&thead.rows[0];
    if(!row){row=thead.insertRow(0);}
    var wanted=['Session','Skill','Score','Output'];
    var current=Array.prototype.slice.call(row.cells||[]).map(function(c){return text(c.textContent);});
    var same=current.length===4&&wanted.every(function(v,i){return current[i]===v;});
    if(!same){
      while(row.firstChild)row.removeChild(row.firstChild);
      wanted.forEach(function(label){var th=document.createElement('th');th.textContent=label;row.appendChild(th);});
    }
    table.dataset.eapPortfolioSchema='4col';
    return !same;
  }
  function bestRecords(rows){
    var best={};
    (rows||[]).forEach(function(r){
      var route=normalizeRoute(r.sessionId||r.routeId||r.session);
      var skill=normalizeSkill(r.skill);
      if(!validRoute(route)||!skill||scoreOf(r)<=0)return;
      var key=route+'|'+skill.toLowerCase(),cur=best[key];
      var passed=r.passed===true||String(r.passed).toLowerCase()==='true';
      var curPassed=cur&&(cur.passed===true||String(cur.passed).toLowerCase()==='true');
      if(!cur||(passed&&!curPassed)||(passed===curPassed&&scoreOf(r)>scoreOf(cur))||
         (passed===curPassed&&scoreOf(r)===scoreOf(cur)&&text(r.updatedAt)>text(cur.updatedAt))){
        var copy={};Object.keys(r||{}).forEach(function(k){copy[k]=r[k];});copy.skill=skill;best[key]=copy;
      }
    });
    return Object.keys(best).map(function(k){return best[k];}).sort(function(a,b){
      var ar=normalizeRoute(a.sessionId||a.routeId),br=normalizeRoute(b.sessionId||b.routeId);
      var routeDiff=routeRank(br)-routeRank(ar);
      if(routeDiff)return routeDiff;
      var as=SKILL_ORDER[normalizeSkill(a.skill)]; if(as===undefined)as=99;
      var bs=SKILL_ORDER[normalizeSkill(b.skill)]; if(bs===undefined)bs=99;
      if(as!==bs)return as-bs;
      return text(b.updatedAt).localeCompare(text(a.updatedAt));
    });
  }
  function signature(rows){
    return rows.map(function(r){return [normalizeRoute(r.sessionId||r.routeId),normalizeSkill(r.skill),Math.round(scoreOf(r)),r.passed===true,text(r.updatedAt)].join('|');}).join(';;');
  }
  function render(){
    timer=0;
    var table=findTable();
    if(!table)return false;
    var schemaChanged=ensureFourColumnHeader(table);
    var rows=bestRecords(runtimeRecords()).slice(0,16);
    var sig=signature(rows);
    if(!schemaChanged&&table.dataset.eapPortfolioSignature===sig&&lastSignature===sig)return true;

    var tbody=table.tBodies&&table.tBodies[0];
    if(!tbody){tbody=document.createElement('tbody');table.appendChild(tbody);}
    var html='';
    if(!rows.length){
      html='<tr data-eap-authority="sheet"><td colspan="4" style="text-align:center;padding:14px">ยังไม่มีผลงานรายทักษะที่ยืนยันจาก Google Sheet</td></tr>';
    }else{
      html=rows.map(function(r){
        var route=normalizeRoute(r.sessionId||r.routeId),score=Math.round(scoreOf(r));
        var passed=r.passed===true||String(r.passed).toLowerCase()==='true';
        return '<tr data-eap-authority="sheet"><td><strong>'+route+'</strong></td><td>'+normalizeSkill(r.skill)+'</td><td><strong>'+score+'/100</strong></td><td>'+(passed?'ผ่านแล้ว · Google Sheet':'บันทึกแล้ว · Google Sheet')+'</td></tr>';
      }).join('');
    }
    if(tbody.innerHTML!==html)tbody.innerHTML=html;
    lastSignature=sig;
    table.dataset.eapPortfolioSignature=sig;
    table.dataset.eapPortfolioOwner=VERSION;
    table.dataset.eapPortfolioRecordCount=String(rows.length);
    return true;
  }
  function schedule(){if(timer)return;timer=setTimeout(render,120);}

  window.addEventListener('eap:single-authority-applied',schedule);
  window.addEventListener('eap:resume-synced',schedule);
  window.addEventListener('eap:profile-changed',function(){lastSignature='';schedule();});
  document.addEventListener('click',function(){setTimeout(schedule,120);},true);

  var observer=new MutationObserver(function(mutations){
    for(var i=0;i<mutations.length;i++){
      var nodes=mutations[i].addedNodes||[];
      for(var j=0;j<nodes.length;j++){
        var n=nodes[j];
        if(n&&n.nodeType===1&&((n.matches&&n.matches('table,thead,tbody,tr'))||(n.querySelector&&n.querySelector('table')))){schedule();return;}
      }
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  setTimeout(schedule,250);
  setTimeout(schedule,900);
  window.EAPRecentPortfolioAuthority={version:VERSION,render:render,diagnostics:function(){var t=findTable();return{version:VERSION,recordCount:bestRecords(runtimeRecords()).length,tableFound:!!t,schema:t&&t.dataset.eapPortfolioSchema,lastSignature:lastSignature};}};
})();