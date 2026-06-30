/* EAP Hero Sheet Bridge v6 — precise result-card parsing, one send only.
   Avoids duplicate polling and reads "Writing • Session 14" exactly.
*/
(function(){'use strict';
  var CFG=window.EAP_SHEET_CONFIG||{};
  var KEY='EAP_HERO_PROGRESS_V3',SENT='EAP_HERO_SHEET_SENT_V6',BUSY=false;
  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')}catch(e){return d}}
  function num(v){var n=Number(v);return isFinite(n)?n:0}
  function truth(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'}
  function state(){return read(KEY,{})}
  function person(s){var q=new URLSearchParams(location.search),p=(s.profile||s.player||{});return{studentId:String(q.get('studentId')||q.get('pid')||p.studentId||p.id||s.studentId||'guest'),studentName:String(q.get('name')||p.studentName||p.name||s.studentName||'Guest'),section:String(q.get('section')||p.section||s.section||CFG.section||'122')}}
  function result(){
    var t=(document.body&&document.body.innerText)||'';
    if(t.indexOf('Evidence Saved')<0)return null;
    var meta=t.match(/\b(Reading|Writing|Listening|Speaking)\s*•\s*Session\s*(\d+)/i);
    if(!meta)return null;
    var scoreBlock=t.slice(Math.max(0,t.indexOf('Evidence Saved')-80),t.indexOf('Mission Task Score')+80);
    var score=scoreBlock.match(/(\d{1,3})\s*\/\s*100/);
    if(!score)score=t.match(/(\d{1,3})\s*\/\s*100/);
    if(!score)return null;
    var s=state(),p=person(s),legacy=/Completed legacy evidence|Legacy completion/i.test(t);
    return{action:'submit_attempt',attemptId:'eap-'+p.studentId+'-s'+meta[2]+'-'+meta[1].toLowerCase()+'-'+score[1]+'-'+(legacy?'legacy':'real'),studentId:p.studentId,studentName:p.studentName,section:p.section,sessionId:String(meta[2]),sessionTitle:(s.sessions&&s.sessions[meta[2]]&&s.sessions[meta[2]].title)||'',skill:meta[1].charAt(0).toUpperCase()+meta[1].slice(1).toLowerCase(),score:num(score[1]),accuracy:0,passMark:60,passed:num(score[1])>=60,legacyCompletion:legacy,hintUsed:0,replay:false,clientTimestamp:new Date().toISOString(),sourceUrl:location.href};
  }
  function key(r){return [r.studentId,r.sessionId,r.skill,r.score,r.legacyCompletion?'L':'R'].join('|')}
  function setStatus(text,color){var e=document.getElementById('eap-sheet-status-v6');if(!e){e=document.createElement('div');e.id='eap-sheet-status-v6';e.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99999;padding:9px 12px;border-radius:999px;font:700 12px system-ui;color:#fff;box-shadow:0 6px 22px rgba(0,0,0,.24);cursor:pointer';e.onclick=function(){send(true)};document.body.appendChild(e)}e.textContent=text;e.style.background=color}
  function link(r){var u=new URL(CFG.webAppUrl);Object.keys(r).forEach(function(k){u.searchParams.set(k,String(r[k]))});u.searchParams.set('_ts',String(Date.now()));return u.toString()}
  function request(r){return new Promise(function(done){var f=document.createElement('iframe'),closed=false;function finish(ok){if(closed)return;closed=true;try{f.remove()}catch(e){}done(ok)}f.width='1';f.height='1';f.style.cssText='position:fixed;left:-9999px;top:-9999px;border:0';f.onload=function(){setTimeout(function(){finish(true)},250)};f.onerror=function(){finish(false)};f.src=link(r);document.body.appendChild(f);setTimeout(function(){finish(false)},7000)})}
  async function send(force){
    if(BUSY)return;if(!CFG.enabled||!CFG.webAppUrl){setStatus('☁ ยังไม่ได้ตั้งค่า Sheet','#9a3412');return}
    var r=result();if(!r){setStatus('☁ รอผล Mission…','#9a3412');return}
    var sent=read(SENT,{}),k=key(r);if(sent[k]&&!force){setStatus('✓ ส่งผลแล้ว','#047857');return}
    BUSY=true;setStatus('☁ กำลังส่งผล…','#9a3412');var ok=await request(r);BUSY=false;
    if(ok){sent[k]=Date.now();localStorage.setItem(SENT,JSON.stringify(sent));setStatus('✓ ส่งผลเข้า Sheet แล้ว','#047857')}else setStatus('⚠ ส่งไม่สำเร็จ • กดซ้ำ','#b45309');
  }
  window.EAPSheetBridge={sync:function(){send(true)},result:result};
  setTimeout(function(){send(false)},1200);
  setTimeout(function(){send(false)},3200);
})();
