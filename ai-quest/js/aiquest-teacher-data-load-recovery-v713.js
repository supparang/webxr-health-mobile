/* CSAI2102 Teacher Console — Data Load Recovery v7.1.3
   - prevents false zero/empty analytics while Google Sheets is loading
   - restores recent cached cohort while fresh data is fetched
   - retries bounded teacherConsole load automatically
   - refreshes Data v698, Unified v699 and Analytics v710 together
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_DATA_LOAD_RECOVERY_V713__)return;
  window.__AIQUEST_TEACHER_DATA_LOAD_RECOVERY_V713__=true;
  const VERSION='v7.1.3',CACHE_KEY='aiquest.teacher101.cache.v713',MAX_AGE=6*60*60*1000;
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const modules=()=>[window.AIQUEST_TEACHER_DATA_ACCURACY_V698,window.AIQUEST_TEACHER_UNIFIED_ANALYTICS_V699,window.AIQUEST_TEACHER_LEARNING_ANALYTICS_V710].filter(Boolean);
  let retries=0,lastCount=-1,restored=false,started=Date.now(),retryTimer=0;
  function students(){const s=runtime()?.state?.students;return Array.isArray(s)?s:[];}
  function refreshModules(){modules().forEach(m=>{try{(m.renderAll||m.render)?.call(m);}catch(e){console.warn('[AIQuest v713] module refresh',e);}});window.dispatchEvent(new CustomEvent('aiquest:cohort-change'));}
  function saveCache(){const rows=students();if(!rows.length)return;try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),students:rows}));}catch(e){}}
  function restoreCache(){if(students().length)return false;try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!c||!Array.isArray(c.students)||!c.students.length||Date.now()-Number(c.ts||0)>MAX_AGE)return false;runtime().state.students=c.students;restored=true;refreshModules();return true;}catch(e){return false;}}
  function status(label,kind='loading'){
    const ready=document.getElementById('aqSystemReadyV712');if(ready){ready.textContent=kind==='ready'?'✓ System Ready':kind==='error'?'⚠ Data Retry':'⏳ Loading Sheets';ready.className='pill '+(kind==='ready'?'good':kind==='error'?'warn':'blue');}
    const load=document.getElementById('loadState');if(load&&label)load.textContent=label;
  }
  function loadingPlaceholders(){
    if(students().length)return;
    ['mProfilesV698','mActiveV698','mAvgV698','mAttemptsV698'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
    const summary=document.getElementById('aqDataSummaryV698');if(summary)summary.textContent='กำลังอ่านข้อมูลล่าสุดจาก Google Sheets…';
    const box=document.getElementById('studentsBox');if(box&&!/กำลังโหลดข้อมูลนักศึกษา/.test(box.textContent||''))box.innerHTML='<div class="loading">กำลังโหลดข้อมูลนักศึกษา… กรุณารอสักครู่</div>';
    const suite=document.getElementById('aqLearningAnalyticsV710');if(suite){suite.classList.add('aq713-waiting');let banner=document.getElementById('aq713AnalyticsWait');if(!banner){banner=document.createElement('div');banner.id='aq713AnalyticsWait';banner.className='loading';banner.textContent='กำลังรอข้อมูล Google Sheets ก่อนคำนวณ Analytics 1–10…';suite.prepend(banner);}}
  }
  function clearWaiting(){document.getElementById('aqLearningAnalyticsV710')?.classList.remove('aq713-waiting');document.getElementById('aq713AnalyticsWait')?.remove();}
  function showRetry(message){
    status(message,'error');const box=document.getElementById('studentsBox');if(box&&!students().length)box.innerHTML='<div class="loading warnBox"><b>ยังโหลดข้อมูลไม่สำเร็จ</b><br><span>Google Sheets อาจตอบช้า</span><br><button id="aq713Retry" class="btn" style="margin-top:10px">ลองโหลดอีกครั้ง</button></div>';
    const b=document.getElementById('aq713Retry');if(b)b.onclick=()=>retry(true);
  }
  function retry(manual=false){const app=runtime();if(!app||app.state?.loading)return;if(!manual&&retries>=2){showRetry('หมดเวลารอ Google Sheets — กดลองโหลดอีกครั้ง');return;}retries++;started=Date.now();status(`กำลังลองโหลด Google Sheets${retries>1?' รอบที่ '+retries:''}…`,'loading');loadingPlaceholders();try{app.load();}catch(e){showRetry('เริ่มโหลดข้อมูลไม่สำเร็จ');}}
  function tick(){
    const app=runtime();if(!app?.state)return;
    const rows=students();
    if(rows.length){if(rows.length!==lastCount){lastCount=rows.length;saveCache();clearWaiting();refreshModules();}status(`โหลดข้อมูลแล้ว • ${app.state.lastLoaded||new Date().toLocaleString()}`,'ready');return;}
    loadingPlaceholders();
    if(app.state.loading){status(restored?'กำลังอัปเดตข้อมูลใหม่จาก Google Sheets… แสดงข้อมูลสำรองล่าสุดอยู่':'กำลังอ่านข้อมูลจาก Google Sheets…','loading');return;}
    if(Date.now()-started>17000){clearTimeout(retryTimer);retryTimer=setTimeout(()=>retry(false),300);}
  }
  function boot(){
    const style=document.createElement('style');style.id='aq713Style';style.textContent='.aq713-waiting .aq710-grid{opacity:.42;pointer-events:none}#aq713AnalyticsWait{margin:10px 0 14px}.warnBox .btn{width:auto}';document.head.appendChild(style);
    restoreCache();loadingPlaceholders();
    document.getElementById('refreshBtn')?.addEventListener('click',()=>{retries=0;started=Date.now();status('กำลังอ่านข้อมูลจาก Google Sheets…','loading');loadingPlaceholders();});
    setInterval(tick,700);tick();console.log('[AIQuest] Data load recovery active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_DATA_LOAD_RECOVERY_V713={VERSION,retry,restoreCache};
})();