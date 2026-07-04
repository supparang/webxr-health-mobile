/* =========================================================
   EAP Hero Player Resume v1
   - Restores the current learner's verified Sheet progress at entry.
   - Primary identity: studentId + section. Name is display only.
   - Uses a cached snapshot first, then reconciles via Apps Script JSONP.
   - Merges best verified scores; it never lowers newer local work.
   - Keeps different learners on the same browser in separate local stores.
========================================================= */
(function(){
  'use strict';

  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAPSHOT_PREFIX='EAP_HERO_PLAYER_STATE_V1_';
  var CACHE_PREFIX='EAP_HERO_SERVER_RESUME_CACHE_V1_';
  var RELOAD_PREFIX='EAP_HERO_SERVER_RESUME_RELOAD_V1_';
  var ENDPOINT=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
  var SECTION=String((window.EAP_SHEET_CONFIG||{}).section||'122');
  var REQUIRED={
    1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],
    4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],
    7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],
    10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],
    13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']
  };

  function clean(value){ return String(value==null?'':value).replace(/\s+/g,' ').trim(); }
  function read(key,fallback){ try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;} }
  function write(key,value){ try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;} }
  function valid(p){ return !!(p&&p.studentId&&p.studentName&&String(p.studentId).toLowerCase()!=='guest'); }
  function normalize(raw){ raw=raw||{};return {studentId:clean(raw.studentId||raw.id||''),studentName:clean(raw.studentName||raw.name||''),section:clean(raw.section||SECTION)||SECTION}; }
  function key(p){ p=normalize(p);return encodeURIComponent(p.section+'__'+p.studentId); }
  function scopedKey(p){ return SNAPSHOT_PREFIX+key(p); }
  function cacheKey(p){ return CACHE_PREFIX+key(p); }
  function stateProfile(state){
    state=state||{};
    return normalize(Object.assign({},state.profile||{},state.player||{},state.user||{}, {id:state.id||'',name:state.name||state.playerName||'',studentId:state.studentId||'',studentName:state.studentName||'',section:state.section||''}));
  }
  function aliases(p){ p=normalize(p);return {id:p.studentId,name:p.studentName,studentId:p.studentId,studentName:p.studentName,section:p.section}; }
  function blankState(p){
    var a=aliases(p);
    return {profile:a,player:a,user:a,id:a.id,name:a.name,playerName:a.name,studentId:a.studentId,studentName:a.studentName,section:a.section,portfolio:[],evidence:[],attempts:[],completedSessions:{},sessionProgress:{},unlockedSessions:{},playerScopedState:true};
  }
  function mirror(state,p){
    var a=aliases(p);
    state=state&&typeof state==='object'?state:{};
    state.profile=Object.assign({},state.profile||{},a);
    state.player=Object.assign({},state.player||{},a);
    state.user=Object.assign({},state.user||{},a);
    state.id=a.id;state.name=a.name;state.playerName=a.name;state.studentId=a.studentId;state.studentName=a.studentName;state.section=a.section;
    state.__activePlayer={studentId:a.studentId,section:a.section,at:new Date().toISOString()};
    return state;
  }
  function profile(){
    var direct=normalize(read(PROFILE_KEY,{}));
    if(valid(direct)) return direct;
    return stateProfile(read(STATE_KEY,{}));
  }
  function ensureScope(p){
    p=normalize(p);
    if(!valid(p)) return read(STATE_KEY,{});
    var active=normalize(read(ACTIVE_KEY,{}));
    var state=read(STATE_KEY,{});
    var existing=valid(active)?active:stateProfile(state);
    if(valid(existing)&&key(existing)!==key(p)){
      write(scopedKey(existing),mirror(state,existing));
      state=read(scopedKey(p),null)||blankState(p);
    } else if(!state||!Object.keys(state).length){
      state=read(scopedKey(p),null)||blankState(p);
    }
    state=mirror(state,p);
    write(STATE_KEY,state);write(scopedKey(p),state);write(ACTIVE_KEY,aliases(p));
    return state;
  }
  function sessionId(value){
    var raw=clean(value).toUpperCase();
    if(/^\d+$/.test(raw)) return 'S'+raw;
    if(/^S(?:ESSION)?\s*\d+$/.test(raw)) return 'S'+(raw.match(/\d+/)||[''])[0];
    if(/^B(?:OSS)?\s*\d+$/.test(raw)) return 'B'+(raw.match(/\d+/)||[''])[0];
    return raw;
  }
  function sessionNumber(value){ var m=sessionId(value).match(/^S(\d+)$/); return m?Number(m[1]):0; }
  function skill(value){ var v=clean(value).toLowerCase(); return v? v.charAt(0).toUpperCase()+v.slice(1):''; }
  function score(value){ var n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0; }
  function recordKey(row){ return sessionId(row.sessionId)+'|'+skill(row.skill).toLowerCase(); }
  function stamp(value){ var t=new Date(value||'').getTime();return Number.isFinite(t)?t:0; }
  function show(message,kind){
    var old=document.getElementById('eap-resume-status-v1');if(old)old.remove();
    var node=document.createElement('div');node.id='eap-resume-status-v1';node.textContent=message;
    node.style.cssText='position:fixed;z-index:100120;right:18px;bottom:18px;max-width:min(420px,calc(100vw - 36px));padding:11px 14px;border-radius:12px;background:'+(kind==='warn'?'#9a3412':'#17375e')+';color:#fff;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';
    document.body.appendChild(node);setTimeout(function(){if(node.parentNode)node.remove();},kind==='loading'?7000:3600);
  }
  function restoredEntry(row){
    var sid=sessionId(row.sessionId);
    var sc=score(row.bestScore!==undefined?row.bestScore:row.score);
    return {
      session:sessionNumber(sid)||sid,
      sessionId:sid,
      sessionTitle:clean(row.sessionTitle||''),
      skill:skill(row.skill),
      score:sc,
      latestScore:sc,
      bestScore:sc,
      accuracy:score(row.bestAccuracy!==undefined?row.bestAccuracy:row.accuracy),
      bestAccuracy:score(row.bestAccuracy!==undefined?row.bestAccuracy:row.accuracy),
      passed:row.passed===true||String(row.passed).toUpperCase()==='TRUE'||sc>=60,
      at:clean(row.updatedAt||row.latestAt||new Date().toISOString()),
      latestAt:clean(row.updatedAt||row.latestAt||new Date().toISOString()),
      output:'ความคืบหน้าที่ยืนยันแล้วจาก Sheet',
      restoredFromSheet:true,
      resumeSource:'server_summary',
      legacyCompletion:false,
      replay:false
    };
  }
  function applyProgress(state,rows,response,p){
    var changed=false;
    var portfolio=Array.isArray(state.portfolio)?state.portfolio.slice():[];
    var lookup={};
    portfolio.forEach(function(item,index){
      var k=recordKey(item||{});if(!k)return;
      if(lookup[k]===undefined)lookup[k]=index;
      else {
        var old=portfolio[lookup[k]]||{};
        var now=item||{};
        if(score(now.latestScore!==undefined?now.latestScore:now.score)>score(old.latestScore!==undefined?old.latestScore:old.score)||stamp(now.latestAt||now.at)>stamp(old.latestAt||old.at))lookup[k]=index;
      }
    });

    (Array.isArray(rows)?rows:[]).forEach(function(row){
      if(!row||String(row.legacyCompletion).toUpperCase()==='TRUE')return;
      var incoming=restoredEntry(row);var k=recordKey(incoming);var idx=lookup[k];var local=idx===undefined?null:portfolio[idx];
      var localScore=score(local&&(local.latestScore!==undefined?local.latestScore:local.score));
      if(!local){portfolio.push(incoming);lookup[k]=portfolio.length-1;changed=true;return;}
      if(incoming.latestScore>localScore){
        var preserved=Object.assign({},local,incoming);
        if(local.output&&!local.restoredFromSheet) preserved.output=local.output;
        portfolio[idx]=preserved;changed=true;
      }
    });

    state.portfolio=portfolio;
    state.evidence=Array.isArray(state.evidence)?state.evidence:[];
    state.attempts=Array.isArray(state.attempts)?state.attempts:[];
    state.sessionProgress=state.sessionProgress&&typeof state.sessionProgress==='object'?state.sessionProgress:{};
    state.completedSessions=state.completedSessions&&typeof state.completedSessions==='object'?state.completedSessions:{};
    state.unlockedSessions=state.unlockedSessions&&typeof state.unlockedSessions==='object'?state.unlockedSessions:{};

    var scores={};
    portfolio.forEach(function(item){
      var sid=sessionId(item&& (item.sessionId||item.session));var sk=skill(item&&item.skill);if(!/^S\d+$/.test(sid)||!sk)return;
      scores[sid]=scores[sid]||{};scores[sid][sk]=Math.max(Number(scores[sid][sk]||0),score(item.latestScore!==undefined?item.latestScore:item.score));
    });
    Object.keys(scores).forEach(function(sid){
      var n=sessionNumber(sid),required=REQUIRED[n]||[];var complete=required.length>0&&required.every(function(sk){return Number(scores[sid][sk]||0)>=60;});
      state.sessionProgress[sid]=Object.assign({},state.sessionProgress[sid]||{},{scores:scores[sid],completed:complete,restoredFromSheet:true,updatedAt:response.serverRevision||new Date().toISOString()});
      state.sessionProgress[n]=state.sessionProgress[sid];
      if(complete){state.completedSessions[sid]=true;state.completedSessions[n]=true;state.unlockedSessions[n]=true;if(n<15)state.unlockedSessions[n+1]=true;}
    });

    state.serverResume=Object.assign({},state.serverResume||{}, {resumeKey:key(p),serverRevision:clean(response.serverRevision||response.generatedAt||''),syncedAt:new Date().toISOString(),recordCount:(Array.isArray(rows)?rows.length:0),latestActivity:response.latestActivity||null});
    mirror(state,p);
    write(STATE_KEY,state);write(scopedKey(p),state);return changed;
  }
  function cachedResume(p){return read(cacheKey(p),null);}
  function cacheResume(p,data){write(cacheKey(p),data);}
  function jsonp(p){
    if(!ENDPOINT||!valid(p))return;
    var cb='__eapResume_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
    var done=false;var timer=null;var script=document.createElement('script');
    function cleanup(){if(done)return;done=true;clearTimeout(timer);try{delete window[cb];}catch(_){window[cb]=undefined;}if(script.parentNode)script.parentNode.removeChild(script);}
    window[cb]=function(data){
      cleanup();
      if(!data||data.ok!==true){show('ยังเชื่อม Sheet ไม่สำเร็จ จึงใช้ความคืบหน้าในเครื่องนี้ก่อน','warn');return;}
      cacheResume(p,data);
      var state=ensureScope(p);var previous=clean(state.serverResume&&state.serverResume.serverRevision);var changed=applyProgress(state,data.records||[],data,p);var revision=clean(data.serverRevision||data.generatedAt||'');
      if(changed&&revision&&previous!==revision){
        var reloadKey=RELOAD_PREFIX+key(p)+'_'+revision;
        if(!sessionStorage.getItem(reloadKey)){
          sessionStorage.setItem(reloadKey,'1');show('พบความคืบหน้าที่บันทึกไว้แล้ว กำลังเปิดต่อจากจุดเดิม…','loading');setTimeout(function(){location.reload();},450);return;
        }
      }
      if((data.records||[]).length){show('ซิงก์ความคืบหน้าจาก Sheet แล้ว · '+(data.continueLabel||'พร้อมเรียนต่อ'));}
    };
    script.onerror=function(){cleanup();show('เชื่อม Sheet ไม่สำเร็จ จึงใช้ความคืบหน้าในเครื่องนี้ก่อน','warn');};
    timer=setTimeout(function(){cleanup();show('กำลังใช้ความคืบหน้าในเครื่องนี้ก่อน','warn');},5000);
    var u=new URL(ENDPOINT,location.href);u.searchParams.set('action','player_resume');u.searchParams.set('studentId',p.studentId);u.searchParams.set('studentName',p.studentName);u.searchParams.set('section',p.section);u.searchParams.set('callback',cb);u.searchParams.set('_',String(Date.now()));script.src=u.toString();document.head.appendChild(script);
  }
  function sync(){
    var p=profile();if(!valid(p))return false;ensureScope(p);
    var cached=cachedResume(p);if(cached&&cached.ok){applyProgress(ensureScope(p),cached.records||[],cached,p);}
    show('กำลังตรวจสอบความคืบหน้าที่บันทึกไว้…','loading');jsonp(p);return true;
  }

  /* Cache restores synchronously before the core app draws. Fresh Sheet data
     arrives in the background and reloads once only when it changes progress. */
  var p=profile();
  if(valid(p)){
    ensureScope(p);
    var cache=cachedResume(p);if(cache&&cache.ok)applyProgress(ensureScope(p),cache.records||[],cache,p);
    setTimeout(sync,30);
  }
  window.EAPPlayerResume={sync:sync,profile:profile,cache:function(){var p=profile();return valid(p)?cachedResume(p):null;}};
})();
