(function(){
  'use strict';
  const VERSION='2026-08-11-CERTIFICATE-ENGLISH-V4-PROGRAM-COORDINATOR';
  const cfg=window.EW_CONFIG||{};
  const journey=window.EW_JOURNEY;
  const screen=document.getElementById('screen');
  const actions=document.getElementById('actions');
  function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function readIdentity(){try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
  function goPassport(){location.replace('./index.html?resume=passport&from=certificate&v=20260811-certificate-program-v4')}
  function goSummary(){location.replace('./journey-summary.html?v=20260811-core-achievement-v3')}
  function formatEnglishDate(date){try{return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(date)}catch(_){return date.toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})}}
  document.getElementById('passportBtn').addEventListener('click',goPassport);
  document.getElementById('printBtn').addEventListener('click',()=>window.print());

  async function load(){
    const identity=readIdentity();
    if(!identity?.playerId){screen.textContent='Player ID not found. Please return to Passport and sign in again.';actions.hidden=false;return}
    try{
      const j=await journey.status(identity.playerId);
      if(!j?.ok||j.mode!=='firebase')throw new Error('FIREBASE_JOURNEY_STATUS_REQUIRED');
      if(!j.summaryViewed){goSummary();return}
      const authority=window.EW_AUTHORITY;
      if(!authority?.resume)throw new Error('FIRESTORE_DIRECT_AUTHORITY_NOT_READY');
      const [result,summaryResult]=await Promise.all([
        authority.resume(identity.playerId,identity.nickname||identity.fullName||''),
        journey.summary(identity.playerId)
      ]);
      if(!result?.ok||result.mode!=='firebase')throw new Error(result?.firebaseError||'FIREBASE_AUTHORITY_REQUIRED');
      if(!summaryResult?.ok||!summaryResult.summary)throw new Error('FIREBASE_JOURNEY_SUMMARY_REQUIRED');
      const p=result.profile||{};
      const pr=result.progress||{};
      const cert=pr.certificate||{};
      const summary=summaryResult.summary||{};
      if(!pr.certificateEligible||!cert.certificateId)throw new Error('CERTIFICATE_NOT_READY');
      const award=summary.badge||'Challenge Finisher';
      const coreScore=Number(summary.coreScore||0);
      const bonusScore=Number(summary.bonusScore||0);
      const passportTotal=Number.isFinite(Number(summary.passportTotal))?Number(summary.passportTotal):coreScore+bonusScore;
      const issued=cert.issuedAt?new Date(cert.issuedAt):new Date();
      screen.className='cert';
      screen.innerHTML=`<div class="eyebrow">CERTIFICATE OF ACHIEVEMENT</div><h1>LEXICON X Challenge</h1><p class="lead">English Week Passport</p><div class="program"><strong>English Language Development Program for Students</strong><span>Faculty of Science</span><span>Semester 1, Academic Year 2026 • 18–20 August 2026</span></div><p class="presented">This certificate is proudly presented to</p><div class="name">${h(p.fullName||p.nickname||identity.fullName||identity.nickname)}</div><p>for successfully completing the LEXICON X English learning journey and earning the level</p><div class="award">${h(award)}</div><div class="meta"><span>Total Passport Score: <strong>${passportTotal}</strong></span><span>Date: <strong>${h(formatEnglishDate(issued))}</strong></span></div><div class="id">Certificate ID: ${h(cert.certificateId)}</div><div class="coordinator"><strong>Asst. Prof. Dr. Suparang Ruangvanich</strong><span>Activity Coordinator • LEXICON X Challenge</span></div>`;
      actions.hidden=false;
    }catch(error){console.error(error);screen.textContent='Unable to open Certificate: '+String(error?.message||error);actions.hidden=false}
  }
  console.info('[LEXICON X] Certificate English V4 Program Coordinator ready',VERSION);
  load();
}());