/* EAP Hero Sheet Bridge v5 — explicit iframe GET transport + visible manual sync.
   Uses the verified Apps Script doGet(action=submit_attempt) receiver.
*/
(function(){'use strict';
  var CFG=window.EAP_SHEET_CONFIG||{};
  var KEY='EAP_HERO_PROGRESS_V3', SENT='EAP_HERO_SHEET_SENT_V5';
  function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'')}catch(e){return d}}
  function truth(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1'}
  function num(v){var n=Number(v);return isFinite(n)?n:0}
  function profile(s){var p=(s&& (s.profile||s.player))||{};return{studentId:String(p.studentId||p.id||s.studentId||'guest'),studentName:String(p.studentName||p.name||s.studentName||'Guest'),section:String(p.section||s.section||CFG.section||'122')}}
  function state(){return read(KEY,{})}
  function result(){
    var t=(document.body&&document.body.innerText)||'';
    if(t.indexOf('Evidence Saved')<0)return null;
    var sid=t.match(/Session\s*(\d+)/i), skill=t.match(/\b(Reading|Writing|Listening|Speaking)\s+Evidence Saved/i), score=t.match(/(\d{1,3})\s*\/\s*100/);
    if(!sid||!skill||!score)return null;
    var s=state(),p=profile(s),v=num(score[1]), legacy=/legacy evidence|legacy completion/i.test(t);
    return{action:'submit_attempt',attemptId:'eap-'+p.studentId+'-'+sid[1]+'-'+skill[1]+'-'+v,studentId:p.studentId,studentName:p.studentName,section:p.section,sessionId:sid[1],sessionTitle:(s.sessions&&s.sessions[sid[1]]&&s.sessions[sid[1]].title)||'',skill:skill[1],score:v,accuracy:0,passMark:60,passed:v>=60,legacyCompletion:legacy,hintUsed:0,replay:false,clientTimestamp:new Date().toISOString(),sourceUrl:location.href};
  }
  function key(r){return [r.studentId,r.sessionId,r.skill,r.score,r.legacyCompletion?'L':'R'].join('|')}
  function url(r){var q=[];for(var k in r)if(Object.prototype.hasOwnProperty.call(r,k))q.push(encodeURIComponent(k)+'='+encodeURIComponent(String(r[k])));q.push('_ts='+Date.now());return CFG.webAppUrl+(CFG.webAppUrl.indexOf('?')>=0?'&':'?')+q.join('&')}
  function label(msg,ok){var el=document.getElementById('eap-sheet-status-v5');if(!el){el=document.createElement('div');el.id='eap-sheet-status-v5';el.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99999;padding:9px 12px;border-radius:999px;font:700 12px system-ui;color:#fff;background:#334155;box-shadow:0 6px 22px rgba(0,0,0,.24);cursor:pointer';el.onclick=function(){sync(true)};document.body.appendChild(el)}el.textContent=msg;el.style.background=ok?'#047857':'#9a3412'}
  function transport(r){return new Promise(function(resolve){var f=document.createElement('iframe');f.width='1';f.height='1';f.style.cssText='position:fixed;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';f.onload=function(){setTimeout(function(){try{f.remove()}catch(e){}resolve(true)},400)};f.onerror=function(){try{f.remove()}catch(e){}resolve(false)};f.src=url(r);document.body.appendChild(f);setTimeout(function(){try{f.remove()}catch(e){}resolve(true)},6500)})}
  async function sync(force){
    if(!CFG.enabled||!CFG.webAppUrl){label('☁ ยังไม่ได้ตั้งค่า Sheet',false);return}
    var r=result();if(!r){label('☁ รอผล Mission…',false);return}
    var sent=read(SENT,{}),k=key(r);if(sent[k]&&!force){label('☁ ส่งผลแล้ว',true);return}
    label('☁ กำลังส่งผล…',false);var ok=await transport(r);if(ok){sent[k]=Date.now();localStorage.setItem(SENT,JSON.stringify(sent));label('✓ ส่งผลเข้า Sheet แล้ว',true)}else label('⚠ ส่งไม่สำเร็จ กดอีกครั้ง',false);
  }
  window.EAPSheetBridge={sync:sync,result:result,status:function(){return{configured:!!(CFG.enabled&&CFG.webAppUrl),result:result()}}};
  function poll(){if(result())sync(false)}
  setTimeout(poll,1000);setTimeout(poll,3000);setInterval(poll,3000);
})();
