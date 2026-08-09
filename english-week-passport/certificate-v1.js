(function(){
  'use strict';
  const cfg=window.EW_CONFIG||{};
  const authority=window.EW_AUTHORITY;
  const journey=window.EW_JOURNEY;
  const screen=document.getElementById('screen');
  const actions=document.getElementById('actions');
  function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function readIdentity(){try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
  function goPassport(){location.replace('./index.html?resume=passport&from=certificate&v=20260809-journey-resume2')}
  function goSummary(){location.replace('./journey-summary.html?v=20260809-journey2')}
  document.getElementById('passportBtn').addEventListener('click',goPassport);
  document.getElementById('printBtn').addEventListener('click',()=>window.print());

  async function load(){
    const identity=readIdentity();
    if(!identity?.playerId){screen.textContent='ไม่พบรหัสผู้เล่น กรุณากลับ Passport แล้วเข้าสู่ระบบใหม่';actions.hidden=false;return}
    try{
      const j=await journey.status(identity.playerId);
      if(!j?.ok||j.mode!=='firebase')throw new Error('FIREBASE_JOURNEY_STATUS_REQUIRED');
      if(!j.summaryViewed){goSummary();return}
      const result=await authority.resume(identity.playerId,identity.nickname||identity.fullName||'');
      if(!result?.ok||result.mode!=='firebase')throw new Error(result?.firebaseError||'FIREBASE_AUTHORITY_REQUIRED');
      const p=result.profile||{};const pr=result.progress||{};const cert=pr.certificate||{};
      if(!pr.certificateEligible||!cert.certificateId)throw new Error('CERTIFICATE_NOT_READY');
      const award=cert.awardLevel||'LEXICON X Explorer';
      const issued=cert.issuedAt?new Date(cert.issuedAt):new Date();
      screen.className='cert';
      screen.innerHTML=`<div class="eyebrow">CERTIFICATE OF ACHIEVEMENT</div><h1>LEXICON X Challenge</h1><p class="lead">English Week Passport</p><p class="lead">This certificate is proudly presented to</p><div class="name">${h(p.fullName||p.nickname||identity.fullName||identity.nickname)}</div><p>for successfully completing the LEXICON X English learning journey and earning the level</p><div class="award">${h(award)}</div><div class="meta"><span>Total Passport Score: <strong>${Number(pr.totalScore||0)}</strong></span><span>Date: <strong>${h(issued.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}))}</strong></span></div><div class="id">Certificate ID: ${h(cert.certificateId)}</div>`;
      actions.hidden=false;
    }catch(error){console.error(error);screen.textContent='เปิด Certificate ไม่สำเร็จ: '+String(error?.message||error);actions.hidden=false}
  }
  load();
}());
