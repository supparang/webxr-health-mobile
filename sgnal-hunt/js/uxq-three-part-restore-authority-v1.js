/* CSAI2601 UX Quest • Three-Part Restore Authority v1.4
 * Google Sheet remains the sole official authority.
 * Mission completion is authoritative ONLY from diagnostics.canonicalPassedMissionIds.
 * Prevents stale progress from a previous learner being shown while a new learner is loading.
 * v1.4: large-Sheet tolerant Studio/Reflection JSONP (single 60s request).
 */
(() => {
  'use strict';

  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const VERSION = '20260910-THREE-PART-RESTORE-AUTHORITY-V1.4-SLOW-SHEET-TOLERANT';
  let missionSnapshot = window.UXQMissionSheetSnapshot || null;
  let running = false;
  let lastIdentityKey = '';

  const text = (value, max = 500) => String(value == null ? '' : value).trim().slice(0, max);
  const profile = () => {
    let value = {};
    try { value = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return { studentId:text(value.studentId,80), studentName:text(value.studentName,120), section:text(value.section,80) };
  };
  const identityKey = p => `${text(p?.studentId,80)}|${text(p?.section,80)}`;
  const receiverUrl = () => text(window.UXQ_CLASSROOM_CONFIG?.receiverUrl || '',900);

  function overview(){
    let box=document.getElementById('uxqStudioOverview');
    if(box) return box;
    const anchor=document.querySelector('.overview-grid');
    if(!anchor) return null;
    box=document.createElement('section'); box.id='uxqStudioOverview'; box.className='studio-overview';
    anchor.insertAdjacentElement('afterend',box); return box;
  }

  function setHero(title,description,buttonLabel,disabled=true){
    const titleEl=document.getElementById('nextTitle');
    const descEl=document.getElementById('nextDesc');
    const link=document.getElementById('nextLink');
    if(titleEl) titleEl.textContent=title;
    if(descEl) descEl.textContent=description;
    if(link){ link.textContent=buttonLabel; link.setAttribute('aria-disabled',disabled?'true':'false'); if(disabled) link.href='#'; }
  }

  function clearStaleUI(p){
    const box=overview();
    if(box){
      box.dataset.identityKey=identityKey(p);
      box.innerHTML=`<h2>กำลังตรวจความก้าวหน้ารายวิชา</h2><p>กำลังโหลด Mission, Studio Practice และ Weekly Reflection ของผู้เรียนปัจจุบันจาก Google Sheet…</p><div class="studio-summary"><span>Mission<b>—/19</b></span><span>Studio<b>—/19</b></span><span>Reflection<b>—/19</b></span><span>Course Complete<b>—/19</b></span></div>`;
    }
    const progress=document.getElementById('progress'); if(progress) progress.textContent='กำลังตรวจข้อมูลผู้เรียนปัจจุบัน…';
    setHero('กำลังตรวจข้อมูลผู้เรียนปัจจุบัน','ยังไม่แสดงผลเดิมจนกว่า Google Sheet จะยืนยันตัวตนและความก้าวหน้าของผู้เรียนนี้','กำลังตรวจ…',true);
    window.UXQStudioProgress=null;
    window.UXQCombinedCourseProgress=null;
  }

  async function requestStudio(p){
    const base=receiverUrl(); if(!base) throw new Error('receiver_url_missing');
    const url=new URL(base);
    url.searchParams.set('action','uxq_student_studio_progress');
    url.searchParams.set('studentId',p.studentId);
    url.searchParams.set('section',p.section);
    url.searchParams.set('courseId',window.UXQ_CLASSROOM_CONFIG?.courseId || 'UXQ-ACT1-2026');
    url.searchParams.set('_',String(Date.now()));
    const callbackName=`__uxqThreePart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    url.searchParams.set('callback',callbackName);
    return await new Promise((resolve,reject)=>{
      const script=document.createElement('script'); let settled=false;
      const timer=setTimeout(()=>done(new Error('studio_progress_timeout_60s')),60000);
      function done(error,data){ if(settled)return; settled=true; clearTimeout(timer); try{delete window[callbackName]}catch(_){window[callbackName]=undefined} script.remove(); error?reject(error):resolve(data); }
      window[callbackName]=data=>done(null,data);
      script.onerror=()=>done(new Error('studio_progress_network'));
      script.async=true; script.src=url.href; document.head.appendChild(script);
    });
  }

  function canonicalPassedSet(){
    const list=missionSnapshot?.diagnostics?.canonicalPassedMissionIds;
    return new Set(Array.isArray(list)?list.map(v=>String(v||'').trim().toLowerCase()).filter(id=>ORDER.includes(id)):[]);
  }
  const missionPassed=id=>canonicalPassedSet().has(String(id||'').trim().toLowerCase());
  function studioRow(snapshot,id){ const nodes=snapshot?.nodes||{}; return nodes[id]||nodes[id.toUpperCase()]||{}; }
  function stateFor(snapshot,id){
    const row=studioRow(snapshot,id); const mission=missionPassed(id);
    const studio=Boolean(row.submitted||row.artifactSubmitted||row.studioSubmitted||['submitted','approved','need_revision','reviewing'].includes(text(row.reviewStatus||row.status,40).toLowerCase()));
    const reflection=Boolean(row.reflectionSubmitted||row.hasReflection||text(row.reflection,5000));
    return {id,mission,studio,reflection,complete:mission&&studio&&reflection};
  }
  function nodeHref(state){
    const url=new URL('./csai2601-canonical-node-clean-v1.html',location.href); url.searchParams.set('node',state.id.toUpperCase()); url.searchParams.set('v','three-part-authority-v1-4-20260910');
    const p=profile(); if(p.studentId)url.searchParams.set('studentId',p.studentId); if(p.studentName)url.searchParams.set('studentName',p.studentName); if(p.section)url.searchParams.set('section',p.section);
    if(state.mission&&!state.complete)url.searchParams.set('phase','studio'); return url.pathname+url.search;
  }
  function decorateCards(states,firstIncomplete){
    states.forEach((state,index)=>{
      const card=document.querySelector(`[data-node-id="${state.id}"]`)||document.querySelector(`[data-node="${state.id.toUpperCase()}"]`); if(!card)return;
      const locked=index>firstIncomplete, badge=card.querySelector('.stage-state'), launch=card.querySelector('.campaign-launch');
      if(badge) badge.textContent=state.complete?'✅ Complete 3/3':state.mission?`Mission ผ่านแล้ว • เหลือ ${2-Number(state.studio)-Number(state.reflection)} ส่วน`:locked?'🔒 รอ Node ก่อนหน้าครบ 3/3':'พร้อมเริ่ม Mission';
      if(launch){ launch.href=locked?'#':nodeHref(state); launch.textContent=locked?'ล็อกตามลำดับ':!state.mission?'เริ่ม Mission':!state.studio?'ทำ Studio Practice':!state.reflection?'ทำ Weekly Reflection':'ดู Studio & Reflection'; launch.setAttribute('aria-disabled',locked?'true':'false'); launch.onclick=locked?event=>event.preventDefault():null; }
    });
  }

  function assertSnapshotIdentity(snapshot,p,label){
    const sid=text(snapshot?.studentId,80), sec=text(snapshot?.section||snapshot?.canonicalSection,80);
    if(sid&&sid!==p.studentId) throw new Error(`${label}_student_mismatch`);
    if(sec&&sec!==p.section) throw new Error(`${label}_section_mismatch`);
  }

  function render(snapshot,p){
    assertSnapshotIdentity(snapshot,p,'studio');
    assertSnapshotIdentity(missionSnapshot,p,'mission');
    const states=ORDER.map(id=>stateFor(snapshot,id)); const firstIncomplete=states.findIndex(s=>!s.complete); const contiguous=firstIncomplete<0?ORDER.length:firstIncomplete;
    const missionCount=states.filter(s=>s.mission).length, studioCount=states.filter(s=>s.studio).length, reflectionCount=states.filter(s=>s.reflection).length, completeCount=states.filter(s=>s.complete).length;
    const current=states[contiguous]||null, box=overview();
    if(box){
      box.dataset.identityKey=identityKey(p);
      box.innerHTML=`<h2>ความก้าวหน้ารายวิชา</h2><p><strong>Course Complete</strong> นับเฉพาะ Node ที่ครบ Mission + Studio Practice + Weekly Reflection ต่อเนื่องตามลำดับรายวิชา</p><div class="studio-summary"><span>Mission canonical จาก Sheet<b>${missionCount}/${ORDER.length}</b></span><span>มี Studio ใน Sheet<b>${studioCount}/${ORDER.length}</b></span><span>มี Reflection ใน Sheet<b>${reflectionCount}/${ORDER.length}</b></span><span class="good">Course Complete ตามลำดับ<b>${contiguous}/${ORDER.length}</b></span></div><p>${current?`งานที่ต้องทำต่อเพื่อปลดล็อกตามลำดับ: <strong>${current.id.toUpperCase()}</strong> • ${!current.mission?'Mission':!current.studio?'Studio Practice':'Weekly Reflection'}`:'ครบทั้งหลักสูตร 19/19 Nodes แล้ว'}</p>${completeCount>contiguous?`<p class="uxq-progress-note">มีข้อมูลครบ 3/3 ใน Sheet รวม ${completeCount} Node แต่ระบบปลดล็อกอย่างเป็นทางการถึง ${contiguous} Node เพราะต้องครบต่อเนื่องตามเส้นทางรายวิชา</p>`:''}`;
    }
    const progress=document.getElementById('progress'); if(progress)progress.textContent=`Course Complete ${contiguous}/${ORDER.length}`;
    if(!current) setHero('ครบทั้งหลักสูตร 19/19 Nodes','Mission, Studio Practice และ Weekly Reflection ครบต่อเนื่องทุก Node','Portfolio พร้อมตรวจ',true);
    else { const next=!current.mission?'Mission':!current.studio?'Studio Practice':'Weekly Reflection'; setHero(`${current.id.toUpperCase()} • ${next}`,`ปลดล็อกตามลำดับแล้ว ${contiguous}/19 • Mission canonical ${missionCount}/19 • Studio ${studioCount}/19 • Reflection ${reflectionCount}/19`,`เปิด ${next}`,false); const link=document.getElementById('nextLink'); if(link)link.href=nodeHref(current); }
    decorateCards(states,contiguous); window.UXQStudioProgress=snapshot; window.UXQCombinedCourseProgress={version:VERSION,identityKey:identityKey(p),states,missionCount,studioCount,reflectionCount,completeCount,contiguous,canonicalPassedMissionIds:Array.from(canonicalPassedSet())};
    window.dispatchEvent(new CustomEvent('uxq-three-part-course-progress',{detail:window.UXQCombinedCourseProgress}));
  }

  function renderError(error,p){
    const box=overview(), message=text(error?.message||error||'studio_progress_failed',300);
    if(box){ box.dataset.identityKey=identityKey(p); box.innerHTML=`<h2>ยังตรวจ Studio/Reflection ไม่สำเร็จ</h2><p>การอ่าน Google Sheet ใช้เวลานานหรือการเชื่อมต่อสะดุด กรุณาลองอีกครั้ง</p><button type="button" id="uxqThreePartRetry">ตรวจสถานะอีกครั้ง</button>`; box.querySelector('#uxqThreePartRetry')?.addEventListener('click',()=>boot(true)); }
    setHero('กำลังเชื่อมต่อข้อมูลการเรียน','ยังไม่สามารถยืนยัน Mission, Studio และ Reflection ของผู้เรียนปัจจุบันจาก Google Sheet','ตรวจสถานะอีกครั้ง',false);
    const link=document.getElementById('nextLink'); if(link){link.href='#';link.onclick=event=>{event.preventDefault();boot(true)}};
    console.error('[UXQ three-part restore]',message);
  }

  async function waitReady(expectedKey){
    const start=Date.now();
    while(Date.now()-start<12000){
      const p=profile();
      if(identityKey(p)!==expectedKey) throw new Error('identity_changed_while_loading');
      const missionKey=identityKey({studentId:missionSnapshot?.studentId,section:missionSnapshot?.section||missionSnapshot?.canonicalSection});
      if(p.studentId&&p.section&&receiverUrl()&&missionSnapshot&&(!missionKey||missionKey===expectedKey)) return p;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw new Error('three_part_dependencies_not_ready');
  }

  async function boot(force=false){
    if(running)return;
    const initial=profile(), key=identityKey(initial); if(!initial.studentId||!initial.section)return;
    if(!force&&key===lastIdentityKey&&window.UXQStudioProgress?.ok&&window.UXQCombinedCourseProgress?.identityKey===key){ render(window.UXQStudioProgress,initial); return; }
    running=true; clearStaleUI(initial);
    try{
      const readyProfile=await waitReady(key); const data=await requestStudio(readyProfile);
      if(identityKey(profile())!==key) throw new Error('identity_changed_after_request');
      if(!data||!data.ok) throw new Error(data?.error||'studio_progress_failed');
      assertSnapshotIdentity(data,readyProfile,'studio'); lastIdentityKey=key; render(data,readyProfile);
    }catch(error){ if(identityKey(profile())===key) renderError(error,initial); }
    finally{ running=false; }
  }

  window.addEventListener('uxq-sheet-progress-restored',event=>{ missionSnapshot=event.detail||null; lastIdentityKey=''; boot(true); });
  window.addEventListener('uxq-mission-control-sheet-snapshot',event=>{ missionSnapshot=event.detail?.snapshot||null; lastIdentityKey=''; boot(true); });
  window.addEventListener('uxq-profile-updated',()=>{ missionSnapshot=null; lastIdentityKey=''; clearStaleUI(profile()); setTimeout(()=>boot(true),50); });
  window.addEventListener('online',()=>boot(true));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>boot(false),900),{once:true}); else setTimeout(()=>boot(false),900);
  window.UXQThreePartRestoreAuthority=Object.freeze({boot:()=>boot(true),version:VERSION});
})();