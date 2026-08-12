(function(){
  'use strict';
  const VERSION='2026-08-12-CERTIFICATE-READONLY-AUTHORITY-V5';
  const cfg=window.EW_CONFIG||{};
  const screen=document.getElementById('screen');
  const actions=document.getElementById('actions');
  const GAME_IDS=['word_match','category_forest','sentence_city','word_detective','final_boss'];

  function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function readIdentity(){try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
  function goPassport(){location.replace('./index.html?resume=passport&from=certificate&v=20260812-certificate-readonly-v5')}
  function formatEnglishDate(date){try{return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(date)}catch(_){return date.toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})}}
  function achievementLevel(avg){const n=Number(avg||0);if(n>=90)return'English Week Champion';if(n>=80)return'Word Master';if(n>=70)return'Word Explorer';return'Challenge Finisher';}
  function waitForAuth(){
    return new Promise((resolve,reject)=>{
      if(!window.firebase?.auth){reject(new Error('FIREBASE_AUTH_NOT_READY'));return;}
      const auth=firebase.auth();
      if(auth.currentUser){resolve(auth.currentUser);return;}
      let settled=false;
      const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('FIREBASE_AUTH_TIMEOUT'));}},5000);
      const unsub=auth.onAuthStateChanged(user=>{
        if(settled||!user)return;
        settled=true;clearTimeout(timer);try{unsub();}catch(_){}resolve(user);
      },error=>{if(!settled){settled=true;clearTimeout(timer);reject(error);}});
    });
  }
  function renderCertificate(identity,profile,progress,gameSummary,cert){
    const bestScores={...(gameSummary?.bestScores||{}),...(progress?.bestScores||{})};
    const scores=GAME_IDS.map(id=>Math.max(0,Number(bestScores[id]||0)));
    const gameAverage=Math.round(scores.reduce((a,b)=>a+b,0)/GAME_IDS.length);
    const coreScore=Math.round(scores.reduce((a,b)=>a+b,0));
    const rawBonus=gameSummary?.bonusBest;
    const bonusScore=rawBonus&&Number.isFinite(Number(rawBonus.score))?Math.max(0,Math.round(Number(rawBonus.score))):0;
    const passportTotal=coreScore+bonusScore;
    const award=achievementLevel(gameAverage);
    const issued=cert.issuedAt?new Date(cert.issuedAt):new Date();
    const name=profile?.fullName||profile?.nickname||identity.fullName||identity.nickname||identity.playerId;
    screen.className='cert';
    screen.innerHTML=`<div class="eyebrow">CERTIFICATE OF ACHIEVEMENT</div><h1>LEXICON X Challenge</h1><p class="lead">English Week Passport</p><div class="program"><strong>English Language Development Program for Students</strong><span>Faculty of Science</span><span>Semester 1, Academic Year 2026 • 18–20 August 2026</span></div><p class="presented">This certificate is proudly presented to</p><div class="name">${h(name)}</div><p>for successfully completing the LEXICON X English learning journey and earning the level</p><div class="award">${h(award)}</div><div class="meta"><span>Total Passport Score: <strong>${passportTotal}</strong></span><span>Date: <strong>${h(formatEnglishDate(issued))}</strong></span></div><div class="id">Certificate ID: ${h(cert.certificateId)}</div><div class="coordinator"><strong>Asst. Prof. Dr. Suparang Ruangvanich</strong><span>Activity Coordinator • LEXICON X Challenge</span></div>`;
    actions.hidden=false;
  }

  document.getElementById('passportBtn').addEventListener('click',goPassport);
  document.getElementById('printBtn').addEventListener('click',()=>window.print());

  async function load(){
    const identity=readIdentity();
    if(!identity?.playerId){screen.textContent='Player ID not found. Please return to Passport and sign in again.';actions.hidden=false;return}
    try{
      await waitForAuth();
      if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
      const db=firebase.firestore();
      const playerId=identity.playerId;
      // Existing certificate document is authoritative. This path is read-only:
      // no resume(), no session claim, no lastSeen write, and no summaryViewed redirect.
      const certSnap=await db.collection('ewp_certificates').doc(playerId).get();
      if(!certSnap.exists)throw new Error('CERTIFICATE_NOT_READY');
      const cert=certSnap.data()||{};
      if(!cert.certificateId)throw new Error('CERTIFICATE_NOT_READY');
      const [profileSnap,progressSnap,gameSummarySnap]=await Promise.all([
        db.collection('ewp_profiles').doc(playerId).get(),
        db.collection('ewp_progress').doc(playerId).get(),
        db.collection('ewp_game_summary').doc(playerId).get()
      ]);
      const profile=profileSnap.exists?profileSnap.data()||{}:{};
      const progress=progressSnap.exists?progressSnap.data()||{}:{};
      const gameSummary=gameSummarySnap.exists?gameSummarySnap.data()||{}:{};
      renderCertificate(identity,profile,progress,gameSummary,cert);
    }catch(error){
      console.error('[LEXICON X] Certificate read-only load failed',error);
      screen.textContent='Unable to open Certificate: '+String(error?.message||error);
      actions.hidden=false;
    }
  }
  console.info('[LEXICON X] Certificate Read-only Authority ready',VERSION);
  load();
}());