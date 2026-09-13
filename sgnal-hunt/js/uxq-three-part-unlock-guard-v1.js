/* CSAI2601 UX Quest • Sheet-Authoritative Unlock Guard v3.2
 * Official student mode: previous node must be confirmed by Google Sheet.
 * Instructor content preview: ?contentPreview=1 bypasses Sheet unlock only for frontend QA.
 * v3.2: tolerate slow Apps Script/Sheet responses; do not false-lock after 12s.
 */
(() => {
  'use strict';
  const VERSION='20260913-SHEET-AUTHORITATIVE-UNLOCK-V3.2-SLOW-SHEET';
  const ORDER=['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const params=new URLSearchParams(location.search||'');
  const node=String(params.get('node')||params.get('id')||'w1').trim().toLowerCase();
  const index=ORDER.indexOf(node);
  if(index<0)return;
  const preview=params.get('contentPreview')==='1';
  const root=document.getElementById('uxqCanonicalNode')||document.body;
  const config=window.UXQ_CLASSROOM_CONFIG||{};
  const clean=(v,m=500)=>String(v==null?'':v).trim().slice(0,m);
  const number=v=>Number.isFinite(Number(v))?Number(v):0;

  if(preview){
    document.body.dataset.uxqThreePartLocked='0';
    document.body.dataset.uxqContentPreview='1';
    document.documentElement.style.visibility='visible';
    window.dispatchEvent(new CustomEvent('uxq-content-preview-active',{detail:{node,version:VERSION}}));
    window.UXQThreePartUnlockGuard=Object.freeze({version:VERSION,preview:true,run:async()=>true});
    return;
  }

  function identity(){
    let p={};try{p=window.UXQIdentity?.get?.()||{}}catch(_){}
    return{
      studentId:clean(p.studentId||params.get('studentId')||params.get('sid'),80),
      section:clean(p.section||params.get('section')||config.defaultSection,80)
    };
  }
  function endpoint(){return clean(config.receiverUrl||config.progressUrl||'',800)}
  function jsonp(url){return new Promise((resolve,reject)=>{
    const cb=`uxqUnlock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const s=document.createElement('script');
    let settled=false;
    const t=setTimeout(()=>done(new Error('unlock_timeout_60s')),60000);
    function done(err,data){
      if(settled)return;
      settled=true;
      clearTimeout(t);
      try{delete window[cb]}catch(_){window[cb]=undefined}
      s.remove();
      err?reject(err):resolve(data);
    }
    window[cb]=d=>done(null,d);
    s.onerror=()=>done(new Error('unlock_network'));
    const i=identity();
    const q=new URLSearchParams({
      action:'uxq_student_progress',
      studentId:i.studentId,
      section:i.section,
      courseId:clean(config.courseId||'UXQ-ACT1-2026',120),
      callback:cb,
      _:Date.now()
    });
    s.async=true;
    s.src=`${url}${url.includes('?')?'&':'?'}${q}`;
    document.head.appendChild(s);
  })}
  function missionRow(data,id){
    return data?.missions?.[id]||data?.missions?.[id.toUpperCase()]||data?.items?.find?.(x=>String(x.nodeId||x.missionId||'').toLowerCase()===id)||{};
  }
  function missionDone(row){
    const stars=Math.max(number(row.bestStars),number(row.stars),number(row.missionStars));
    return Boolean(row.completed||row.passed||row.missionCompleted||row.eventType==='mission_completed'||stars>=2);
  }
  function contextUrl(path){
    const url=new URL(path,location.href);
    ['device','studentId','studentName','section','sid','name','courseId'].forEach(k=>{const v=params.get(k);if(v)url.searchParams.set(k,v)});
    url.searchParams.set('v','sheet-authoritative-unlock-v3-2-20260913');
    return `${url.pathname}${url.search}`;
  }
  function showLocked(previous,error,data){
    const diagnostic=clean(data?.diagnostics?.policy||data?.error||'',180);
    root.innerHTML=`<div style="min-height:100vh;background:#071124;color:#eef6ff;font-family:system-ui;padding:28px"><section style="max-width:820px;margin:40px auto;border:1px solid rgba(255,209,102,.5);border-radius:22px;padding:28px;background:linear-gradient(150deg,#18233f,#09152e)"><p style="color:#ffd166;font-weight:900;letter-spacing:.08em">SHEET-AUTHORITATIVE UNLOCK</p><h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.2em 0">${node.toUpperCase()} ยังล็อกอยู่</h1><p style="color:#c7d5ee;line-height:1.7">Google Sheet ยังไม่ยืนยันว่า ${previous.toUpperCase()} ผ่าน Mission แล้ว ต้องได้อย่างน้อย 2/3 ดาวและมีรายการ mission_completed ก่อน</p><div style="padding:14px;border-radius:14px;border:1px solid #f87171;margin:20px 0">Mission ${previous.toUpperCase()} • ยังไม่ยืนยันจาก Sheet</div><p style="color:#ffd6a0">${error?`ตรวจสถานะจาก Sheet ไม่สำเร็จ: ${clean(error,180)}`:'ระบบตรวจจาก Official Student Progress แล้ว แต่ยังไม่พบผลผ่านของด่านก่อนหน้า'}${diagnostic?`<br><small>${diagnostic}</small>`:''}</p><a href="${contextUrl(`./csai2601-canonical-node-clean-v1.html?node=${previous.toUpperCase()}&replay=1`)}" style="display:inline-block;margin-top:12px;padding:12px 16px;border-radius:12px;background:#6ee7ff;color:#071124;text-decoration:none;font-weight:900">กลับไปตรวจ/ฝึก ${previous.toUpperCase()} →</a></section></div>`;
    document.body.dataset.uxqThreePartLocked='1';
  }
  function showChecking(previous){
    root.innerHTML=`<div style="min-height:100vh;background:#071124;color:#eef6ff;font-family:system-ui;padding:28px"><section style="max-width:820px;margin:40px auto;border:1px solid rgba(110,231,255,.4);border-radius:22px;padding:28px;background:linear-gradient(150deg,#18233f,#09152e)"><p style="color:#6ee7ff;font-weight:900;letter-spacing:.08em">กำลังตรวจสอบจาก Google Sheet</p><h1 style="font-size:clamp(1.8rem,5vw,3rem);margin:.2em 0">กำลังตรวจสิทธิ์เข้า ${node.toUpperCase()}</h1><p style="color:#c7d5ee;line-height:1.7">กำลังยืนยันผล ${previous.toUpperCase()} จากข้อมูลทางการ กรุณารอสักครู่ ไม่ต้องกดย้อนกลับหรือรีเฟรชหน้า</p></section></div>`;
  }
  async function run(){
    if(index===0){document.body.dataset.uxqThreePartLocked='0';return}
    const prev=ORDER[index-1],i=identity(),ep=endpoint();
    if(!i.studentId||!i.section||!ep){showLocked(prev,'ยังไม่มี Identity หรือ Receiver endpoint');return}
    showChecking(prev);
    try{
      const data=await jsonp(ep);
      if(!data||data.ok===false){showLocked(prev,clean(data?.error||'progress_response_invalid',180),data);return}
      const row=missionRow(data,prev);
      if(missionDone(row)){
        document.body.dataset.uxqThreePartLocked='0';
        window.dispatchEvent(new CustomEvent('uxq-sheet-unlock-confirmed',{detail:{node,previous:prev,mission:true,row,data}}));
        return;
      }
      showLocked(prev,'',data);
    }catch(e){showLocked(prev,e.message||e)}
  }
  document.documentElement.style.visibility='hidden';
  const reveal=()=>{document.documentElement.style.visibility='visible'};
  Promise.resolve(run()).finally(reveal);
  setTimeout(reveal,2000);
  window.UXQThreePartUnlockGuard=Object.freeze({version:VERSION,preview:false,run});
})();