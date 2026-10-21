/* CSAI2601 UX Quest • Sheet-Authoritative Unlock Guard v3.2
 * Official student mode: previous node must be confirmed by Google Sheet.
 * Instructor content preview: ?contentPreview=1 bypasses Sheet unlock only for frontend QA.
 * v3.2: tolerate slow Apps Script/Sheet responses; do not false-lock after 12s.
 */
(() => {
  'use strict';
  const VERSION='20261021-SHEET-THREE-PART-UNLOCK-V4';
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
  function jsonp(url,action){return new Promise((resolve,reject)=>{
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
      action:action,
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
  function missionPassedSet(data){
    const list=data?.diagnostics?.canonicalPassedMissionIds;
    if(!Array.isArray(list))throw new Error('missing_canonical_mission_evidence');
    return new Set(list.map(x=>String(x||'').toLowerCase()));
  }
  function studioNode(data,id){
    return data?.nodes?.[id]||data?.nodes?.[id.toUpperCase()]||{};
  }
  function assess(missionData,studioData){
    const passed=missionPassedSet(missionData);
    for(let p=0;p<index;p++){
      const id=ORDER[p],row=studioNode(studioData,id);
      if(!passed.has(id))return {ok:false,blocked:id,missing:'Mission'};
      if(!(row.submitted===true&&row.artifactSubmitted===true&&row.studioSubmitted===true))
        return {ok:false,blocked:id,missing:'Studio Practice'};
      if(!(row.reflectionSubmitted===true&&row.reflectionEvidence==='explicit_artifact_field'))
        return {ok:false,blocked:id,missing:'Weekly Reflection'};
    }
    return {ok:true};
  }
  function checkIdentity(data,p,label){
    if(!data||data.ok!==true)throw new Error(label+'_progress_unavailable');
    if(String(data.studentId||'')!==p.studentId||
      String(data.section||data.canonicalSection||'')!==p.section||
      String(data.courseId||'')!==String(config.courseId||'UXQ-ACT1-2026'))
      throw new Error(label+'_identity_mismatch');
  }
  function contextUrl(path){
    const url=new URL(path,location.href);
    ['device','studentId','studentName','section','sid','name','courseId'].forEach(k=>{const v=params.get(k);if(v)url.searchParams.set(k,v)});
    url.searchParams.set('v','sheet-authoritative-unlock-v3-2-20260913');
    return `${url.pathname}${url.search}`;
  }
  function shield(){
    let el=document.getElementById('uxqThreePartEntryGate');
    if(el)return el;
    el=document.createElement('div');
    el.id='uxqThreePartEntryGate';
    el.setAttribute('role','alertdialog');
    el.setAttribute('aria-modal','true');
    el.style.cssText='position:fixed;inset:0;z-index:2147483600;background:#071124;color:#eef6ff;padding:28px;overflow:auto;font-family:system-ui,sans-serif';
    document.body.appendChild(el);
    return el;
  }
  function blockScreen(previous,missing,error){
    const target=String(previous||ORDER[index-1]).toLowerCase();
    const problem=String(missing||'ตรวจผลจาก Sheet').replace(/[<>&"]/g,'');
    const diagnostic=String(error||'').replace(/[<>&"]/g,'').slice(0,190);
    shield().innerHTML='<section style="max-width:820px;margin:40px auto;border:1px solid #e9b35f;border-radius:22px;padding:28px;background:#14233e">'+
      '<p style="color:#ffd166;font-weight:900">GOOGLE SHEET • 3/3 PROGRESS GATE</p>'+
      '<h1>'+node.toUpperCase()+' ยังล็อกอยู่</h1>'+
      '<p>ต้องทำ <strong>'+target.toUpperCase()+'</strong> ให้ครบ Mission + Studio Practice + Weekly Reflection ก่อน</p>'+
      '<p style="color:#ffd166">ยังขาดหลักฐาน: '+problem+'</p>'+
      (diagnostic?'<p>ตรวจสอบไม่ได้: '+diagnostic+'</p>':'')+
      '<a style="display:inline-block;background:#7bd9ed;color:#071124;padding:12px 16px;border-radius:12px" href="'+contextUrl('./csai2601-mission-control.html')+'">กลับ Mission Control</a> '+
      '<button style="padding:12px;margin-left:8px" type="button" id="uxqCheckAgain">ตรวจอีกครั้ง</button></section>';
    document.getElementById('uxqCheckAgain')?.addEventListener('click',()=>{void run()});
    document.body.dataset.uxqThreePartLocked='1';
  }
  function showChecking(){
    document.body.dataset.uxqThreePartLocked='1';
    shield().innerHTML='<section style="max-width:820px;margin:40px auto;padding:28px;border-radius:20px;background:#14233e"><h1>กำลังยืนยันการปลดล็อกจาก Google Sheets</h1><p>ตรวจครบ 3 ส่วนทุกด่านก่อนหน้า กรุณารอสักครู่</p></section>';
  }
  async function run(){
    if(index===0){document.body.dataset.uxqThreePartLocked='0';return true}
    const prev=ORDER[index-1],i=identity(),ep=endpoint();
    if(!i.studentId||!i.section||!ep){blockScreen(prev,'Student ID / Section / Receiver','ข้อมูลระบุตัวตนไม่ครบ');return false}
    showChecking();
    try{
      const results=await Promise.all([
        jsonp(ep,'uxq_student_progress'),
        jsonp(ep,'uxq_student_studio_progress')
      ]);
      if(identity().studentId!==i.studentId||identity().section!==i.section)
        throw new Error('identity_changed_during_unlock');
      checkIdentity(results[0],i,'mission');
      checkIdentity(results[1],i,'studio');
      const checked=assess(results[0],results[1]);
      if(checked.ok){
        document.body.dataset.uxqThreePartLocked='0';
        document.getElementById('uxqThreePartEntryGate')?.remove();
        window.dispatchEvent(new CustomEvent('uxq-sheet-unlock-confirmed',{
          detail:{node,previous:prev,threePart:true,policy:'contiguous_three_part',version:VERSION}
        }));
        return true;
      }
      blockScreen(checked.blocked,checked.missing);
      return false;
    }catch(e){
      blockScreen(prev,'กำลังรอตรวจสอบข้อมูล',e.message||String(e));
      return false;
    }
  }
  document.documentElement.style.visibility='hidden';
  const reveal=()=>{document.documentElement.style.visibility='visible'};
  Promise.resolve(run()).finally(reveal);
  setTimeout(reveal,2000);
  window.UXQThreePartUnlockGuard=Object.freeze({version:VERSION,preview:false,run});
})();