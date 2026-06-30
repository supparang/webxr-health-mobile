/* EAP Hero sheet bridge v123.
   Automatic POST sync plus an explicit one-click latest-result sender for verification.
*/
(function(){
  'use strict';
  const WEB_APP_URL='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const SECTION='122';
  const STATE_KEY='EAP_HERO_PROGRESS_V3';
  const SENT_KEY='EAP_HERO_SHEET_SENT_V123';
  let baselineReady=false, known={};

  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'');}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}}
  function text(value){return value==null?'':String(value);}
  function num(value,fallback){const n=Number(value);return Number.isFinite(n)?n:(fallback==null?0:fallback);}
  function profile(state){const p=(state&&(state.profile||state.player))||{};return{studentId:text(p.studentId||p.id||(state&&state.studentId)||'guest'),studentName:text(p.studentName||p.name||(state&&state.studentName)||'Guest'),section:text(p.section||(state&&state.section)||SECTION)};}
  function stamp(entry,index){return text(entry.latestAt||entry.at||entry.evidenceId||index);}
  function sig(entry,index){return [text(entry.session||entry.sessionId),text(entry.skill).toLowerCase(),stamp(entry,index),text(entry.latestScore!==undefined?entry.latestScore:entry.score)].join('|');}
  function getAccuracy(entry){for(const v of [entry.accuracy,entry.bestAccuracy,entry.accPct,entry.accuracyPct]){const n=Number(v);if(Number.isFinite(n))return Math.max(0,Math.min(100,n));}return '';}
  function items(state){return Array.isArray(state&&state.portfolio)?state.portfolio.map((entry,index)=>({entry:entry||{},index:index})).filter(x=>text(x.entry.session||x.entry.sessionId)&&text(x.entry.skill)):[];}
  function payloadFor(item,state){
    const entry=item.entry, p=profile(state), sessionId=text(entry.session||entry.sessionId), score=num(entry.latestScore!==undefined?entry.latestScore:entry.score,0);
    return {action:'submit_attempt',attemptId:'eap-v123-'+p.studentId+'-'+sessionId+'-'+text(entry.skill).toLowerCase()+'-'+encodeURIComponent(stamp(entry,item.index)),studentId:p.studentId,studentName:p.studentName,section:p.section,sessionId:sessionId,sessionTitle:text(entry.sessionTitle),skill:text(entry.skill),score:score,accuracy:getAccuracy(entry),passMark:60,passed:score>=60,legacyCompletion:false,hintUsed:num(entry.aiUses||entry.hintUsed,0),replay:entry.replay===true,clientTimestamp:stamp(entry,item.index),sourceUrl:location.href};
  }
  function autoTransmit(payload){
    const body=JSON.stringify(payload);
    try{if(navigator.sendBeacon&&navigator.sendBeacon(WEB_APP_URL,new Blob([body],{type:'text/plain;charset=UTF-8'})))return true;}catch(_){}
    try{fetch(WEB_APP_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:body}).catch(function(){});return true;}catch(_){return false;}
  }
  function postVisible(payload){
    const popup=window.open('','eap_sheet_result','width=620,height=460');
    if(!popup){alert('เบราว์เซอร์บล็อกหน้าต่างยืนยัน กรุณาอนุญาต pop-up ชั่วคราว');return;}
    const form=document.createElement('form');
    form.method='POST'; form.action=WEB_APP_URL; form.target='eap_sheet_result'; form.style.display='none';
    Object.keys(payload).forEach(function(key){const input=document.createElement('input');input.type='hidden';input.name=key;input.value=text(payload[key]);form.appendChild(input);});
    document.body.appendChild(form); form.submit(); form.remove();
  }
  function latestFresh(){
    const state=read(STATE_KEY,null);
    const list=items(state).filter(x=>!(x.entry.legacyCompletion===true||text(x.entry.legacyCompletion).toLowerCase()==='true'));
    return list.length?{state:state,item:list[list.length-1]}:null;
  }
  function baseline(){const state=read(STATE_KEY,null);items(state).forEach(x=>{known[sig(x.entry,x.index)]=true;});baselineReady=true;}
  function sync(){
    if(!baselineReady){baseline();return;}
    const state=read(STATE_KEY,null), sent=read(SENT_KEY,{});
    items(state).forEach(function(item){
      const entry=item.entry, key=sig(entry,item.index);
      if(known[key])return; known[key]=true;
      if(entry.legacyCompletion===true||text(entry.legacyCompletion).toLowerCase()==='true')return;
      const payload=payloadFor(item,state);
      if(sent[payload.attemptId])return;
      if(autoTransmit(payload))sent[payload.attemptId]=Date.now();
    });
    write(SENT_KEY,sent);
  }
  function addButton(){
    if(document.getElementById('eap-sheet-manual-send'))return;
    const b=document.createElement('button');b.id='eap-sheet-manual-send';b.type='button';b.textContent='📤 ส่งผลล่าสุดเข้า Sheet';
    b.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;border:0;border-radius:999px;padding:12px 16px;background:#17375e;color:#fff;font:700 14px Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer';
    b.onclick=function(){const latest=latestFresh();if(!latest){alert('ยังไม่พบผลกิจกรรมใหม่สำหรับส่ง');return;}const payload=payloadFor(latest.item,latest.state);postVisible(payload);};
    document.body.appendChild(b);
  }
  window.EAPSheetSyncV123={sync:sync,sendLatest:function(){const latest=latestFresh();if(latest)postVisible(payloadFor(latest.item,latest.state));}};
  baseline();setInterval(sync,700);setTimeout(addButton,1200);
})();