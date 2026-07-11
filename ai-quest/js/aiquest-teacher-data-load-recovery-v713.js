/* CSAI2102 Teacher Console — Data Load Recovery v7.1.3.1
   Independent 45-second Google Sheets loader.
   Bypasses the legacy 15-second closure loader, restores cache, retries,
   and refreshes Data v698 / Unified v699 / Analytics v710 together.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_DATA_LOAD_RECOVERY_V7131__)return;
  window.__AIQUEST_TEACHER_DATA_LOAD_RECOVERY_V7131__=true;

  const VERSION='v7.1.3.1';
  const ENDPOINT='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
  const SECTION='101';
  const CACHE_KEY='aiquest.teacher101.cache.v7131';
  const MAX_AGE=12*60*60*1000;
  const TIMEOUT_MS=45000;
  const MAX_AUTO_RETRIES=2;

  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const stamp=a=>Date.parse(String(a?.serverTs||a?.clientTs||a?.timestamp||''))||0;
  const modules=()=>[
    window.AIQUEST_TEACHER_DATA_ACCURACY_V698,
    window.AIQUEST_TEACHER_UNIFIED_ANALYTICS_V699,
    window.AIQUEST_TEACHER_LEARNING_ANALYTICS_V710
  ].filter(Boolean);

  let loading=false;
  let retryCount=0;
  let requestSeq=0;

  function normalizeStudent(row){
    const r=obj(row);
    const attempts=arr(r.attempts).filter(a=>a&&typeof a==='object');
    const latest=attempts.slice().sort((a,b)=>stamp(b)-stamp(a))[0]||{};
    const best=attempts.reduce((m,a)=>Math.max(m,num(a.score)),0);
    return {
      studentId:String(r.studentId||r.student_id||r.id||'-'),
      studentName:String(r.studentName||r.name||''),
      section:String(r.section||SECTION),
      attempts,
      attemptCount:num(r.attemptCount,attempts.length),
      bestScore:Math.max(num(r.bestScore),best),
      latestScore:num(r.latestScore,num(latest.score)),
      mastered:r.mastered===true||attempts.some(a=>a?.mastered===true),
      risks:arr(r.risks).map(String).filter(Boolean),
      misconceptions:arr(r.misconceptions),
      latestReflection:obj(r.latestReflection),
      isTest:r.isTest===true
    };
  }

  function extractStudents(payload){
    const data=obj(payload?.data||payload);
    const found=[data.allStudents,data.students,payload?.allStudents,payload?.students].find(Array.isArray)||[];
    return found.map(normalizeStudent)
      .filter(s=>!s.section||String(s.section)===SECTION)
      .sort((a,b)=>`${a.studentName}|${a.studentId}`.localeCompare(`${b.studentName}|${b.studentId}`));
  }

  function state(){return runtime()?.state||null;}
  function students(){return arr(state()?.students);}

  function status(message,kind='loading'){
    const ready=document.getElementById('aqSystemReadyV712');
    if(ready){
      ready.textContent=kind==='ready'?'✓ System Ready':kind==='error'?'⚠ Data Error':'⏳ Loading Sheets';
      ready.className='pill '+(kind==='ready'?'good':kind==='error'?'warn':'blue');
    }
    const load=document.getElementById('loadState');
    if(load&&message)load.textContent=message;
  }

  function placeholders(){
    if(students().length)return;
    ['mProfilesV698','mActiveV698','mAvgV698','mAttemptsV698'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.textContent='—';
    });
    const summary=document.getElementById('aqDataSummaryV698');
    if(summary)summary.textContent='กำลังอ่านข้อมูลล่าสุดจาก Google Sheets…';
    const box=document.getElementById('studentsBox');
    if(box)box.innerHTML='<div class="loading">กำลังโหลดข้อมูลนักศึกษา… อาจใช้เวลาสูงสุด 45 วินาที</div>';
    const suite=document.getElementById('aqLearningAnalyticsV710');
    if(suite){
      suite.classList.add('aq713-waiting');
      if(!document.getElementById('aq713AnalyticsWait')){
        const banner=document.createElement('div');
        banner.id='aq713AnalyticsWait';banner.className='loading';
        banner.textContent='กำลังรอข้อมูล Google Sheets ก่อนคำนวณ Analytics 1–10…';
        suite.prepend(banner);
      }
    }
  }

  function clearWaiting(){
    document.getElementById('aqLearningAnalyticsV710')?.classList.remove('aq713-waiting');
    document.getElementById('aq713AnalyticsWait')?.remove();
  }

  function refreshModules(){
    modules().forEach(m=>{try{(m.renderAll||m.render)?.call(m);}catch(e){console.warn('[AIQuest v713.1] module refresh',e);}});
    window.dispatchEvent(new CustomEvent('aiquest:cohort-change'));
  }

  function saveCache(payload,rows){
    if(!rows.length)return;
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),payload,students:rows}));}catch(e){}
  }

  function restoreCache(){
    if(students().length)return false;
    try{
      const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(!c||!arr(c.students).length||Date.now()-num(c.ts)>MAX_AGE)return false;
      const app=runtime();if(!app?.state)return false;
      app.state.payload=c.payload||null;
      app.state.data=obj(c.payload?.data||c.payload);
      app.state.students=c.students;
      app.state.lastLoaded='ข้อมูลสำรอง '+new Date(c.ts).toLocaleString();
      clearWaiting();refreshModules();
      status(`แสดงข้อมูลสำรองล่าสุด • ${new Date(c.ts).toLocaleString()} • กำลังตรวจข้อมูลใหม่…`,'loading');
      return true;
    }catch(e){return false;}
  }

  async function fetchJson(url){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal,redirect:'follow'});
      const text=await response.text();
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      let value;
      try{value=JSON.parse(text);}catch(e){throw new Error(`ข้อมูลตอบกลับไม่ใช่ JSON (${text.slice(0,80).replace(/\s+/g,' ')})`);}
      return value;
    }finally{clearTimeout(timer);}
  }

  function showRetry(message){
    status(message,'error');
    const box=document.getElementById('studentsBox');
    if(box&&!students().length){
      box.innerHTML='<div class="loading warnBox"><b>ยังโหลดข้อมูลไม่สำเร็จ</b><br><span id="aq713ErrorText"></span><br><button id="aq713Retry" class="btn" style="margin-top:10px">ลองโหลดอีกครั้ง</button></div>';
      const t=document.getElementById('aq713ErrorText');if(t)t.textContent=message;
      const b=document.getElementById('aq713Retry');if(b)b.onclick=()=>loadFresh(true);
    }
  }

  async function loadFresh(manual=false){
    if(loading)return;
    const app=runtime();if(!app?.state){setTimeout(()=>loadFresh(manual),300);return;}
    loading=true;requestSeq++;const seq=requestSeq;
    if(manual)retryCount=0;
    app.state.loading=true;
    status(`กำลังอ่าน Google Sheets${retryCount?` • รอบที่ ${retryCount+1}`:''}…`,'loading');
    placeholders();
    const button=document.getElementById('refreshBtn');if(button)button.disabled=true;
    try{
      const url=`${ENDPOINT}?action=teacherConsole&section=${SECTION}&sessionId=all&includeTest=1&t=${Date.now()}&loader=v7131`;
      const payload=await fetchJson(url);
      if(seq!==requestSeq)return;
      const rows=extractStudents(payload);
      if(!rows.length)throw new Error('ปลายทางตอบกลับสำเร็จแต่ไม่พบรายชื่อนักศึกษา');
      app.state.payload=payload;
      app.state.data=obj(payload.data||payload);
      app.state.students=rows;
      app.state.lastLoaded=new Date().toLocaleString();
      retryCount=0;
      saveCache(payload,rows);
      clearWaiting();refreshModules();
      status(`โหลดข้อมูลแล้ว • ${app.state.lastLoaded} • ${rows.length} profiles`,'ready');
    }catch(error){
      if(seq!==requestSeq)return;
      const message=error?.name==='AbortError'?'หมดเวลารอ Google Sheets 45 วินาที':`อ่านข้อมูลไม่สำเร็จ: ${error?.message||error}`;
      if(!manual&&retryCount<MAX_AUTO_RETRIES){
        retryCount++;
        status(`${message} • จะลองใหม่อัตโนมัติ…`,'loading');
        setTimeout(()=>{loading=false;loadFresh(false);},1200*retryCount);
        return;
      }
      showRetry(message);
    }finally{
      if(seq===requestSeq){loading=false;app.state.loading=false;if(button)button.disabled=false;}
    }
  }

  function boot(){
    const style=document.createElement('style');style.id='aq713Style';style.textContent='.aq713-waiting .aq710-grid{opacity:.38;pointer-events:none}#aq713AnalyticsWait{margin:10px 0 14px}.warnBox .btn{width:auto}';document.head.appendChild(style);
    restoreCache();placeholders();
    const refresh=document.getElementById('refreshBtn');
    if(refresh){refresh.onclick=e=>{e.preventDefault();loadFresh(true);};refresh.disabled=false;}
    // Start our independent loader after all dashboard modules have mounted.
    setTimeout(()=>loadFresh(false),250);
    console.log('[AIQuest] Independent data loader active',VERSION);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_DATA_LOAD_RECOVERY_V713={VERSION,loadFresh,restoreCache};
})();