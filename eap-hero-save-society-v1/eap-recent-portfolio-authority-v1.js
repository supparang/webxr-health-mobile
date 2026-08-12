/* =========================================================
   EAP Hero • Recent Portfolio Authority Renderer v2
   VERSION: 20260812-EAP-RECENT-PORTFOLIO-AUTHORITY-V2-4COL

   Rules
   1. Read only from EAPAuthorityRuntime.records().
   2. Never request the network.
   3. Force the student table schema to exactly 4 columns:
      Session | Skill | Score | Output.
   4. Render only when server-record signature or table schema changes.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_RECENT_PORTFOLIO_AUTHORITY_V2__) return;
  window.__EAP_RECENT_PORTFOLIO_AUTHORITY_V2__=true;

  var VERSION='20260812-EAP-RECENT-PORTFOLIO-AUTHORITY-V2-4COL';
  var lastSignature='';
  var timer=0;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function normalizeRoute(v){
    var raw=text(v&&v.routeId||v).toUpperCase(),m;
    m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i); if(m)return 'S'+Number(m[1]);
    m=raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i); if(m)return 'B'+Number(m[1]);
    return raw;
  }
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
      var skill=text(r.skill);
      if(!/^S\d+$/.test(route)||!skill||scoreOf(r)<=0)return;
      var key=route+'|'+skill.toLowerCase(),cur=best[key];
      var passed=r.passed===true||String(r.passed).toLowerCase()==='true';
      var curPassed=cur&&(cur.passed===true||String(cur.passed).toLowerCase()==='true');
      if(!cur||(passed&&!curPassed)||(passed===curPassed&&scoreOf(r)>scoreOf(cur))||
         (passed===curPassed&&scoreOf(r)===scoreOf(cur)&&text(r.updatedAt)>text(cur.updatedAt)))best[key]=r;
    });
    return Object.keys(best).map(function(k){return best[k];}).sort(function(a,b){
      return text(b.updatedAt).localeCompare(text(a.updatedAt));
    });
  }
  function signature(rows){
    return rows.map(function(r){return [normalizeRoute(r.sessionId||r.routeId),text(r.skill),Math.round(scoreOf(r)),r.passed===true,text(r.updatedAt)].join('|');}).join(';;');
  }
  function render(){
    timer=0;
    var table=findTable();
    if(!table)return false;
    var schemaChanged=ensureFourColumnHeader(table);
    var rows=bestRecords(runtimeRecords()).slice(0,12);
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
        return '<tr data-eap-authority="sheet"><td><strong>'+route+'</strong></td><td>'+text(r.skill)+'</td><td><strong>'+score+'/100</strong></td><td>'+(passed?'ผ่านแล้ว · Google Sheet':'บันทึกแล้ว · Google Sheet')+'</td></tr>';
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