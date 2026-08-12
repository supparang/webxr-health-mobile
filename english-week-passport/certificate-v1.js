(function(){
  'use strict';
  const VERSION='2026-08-12-CERTIFICATE-AUTH-BOOTSTRAP-V7';
  const cfg=window.EW_CONFIG||{};
  const screen=document.getElementById('screen');
  const actions=document.getElementById('actions');
  const GAME_IDS=['word_match','category_forest','sentence_city','word_detective','final_boss'];

  function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function readIdentity(){try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
  function readResumeCache(playerId){
    try{
      const row=JSON.parse(localStorage.getItem('ew_eventday_resume_cache_v1')||'null');
      if(!row||String(row.playerId||'').trim()!==String(playerId||'').trim())return null;
      if(!row.profile||!row.progress)return null;
      return row;
    }catch(_){return null}
  }
  function readBonusBest(playerId){try{return JSON.parse(localStorage.getItem(`ew_bonus_lens_best::${playerId}`)||'null')}catch(_){return null}}
  function goPassport(){location.replace('./index.html?resume=passport&from=certificate&v=20260812-certificate-auth-v7')}
  function formatEnglishDate(date){try{return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(date)}catch(_){return date.toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})}}
  function achievementLevel(avg){const n=Number(avg||0);if(n>=90)return'English Week Champion';if(n>=80)return'Word Master';if(n>=70)return'Word Explorer';return'Challenge Finisher';}
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function waitForFirebaseSdk(maxWaitMs=15000){
    const started=Date.now();
    while(Date.now()-started<maxWaitMs){
      if(window.firebase?.auth&&window.firebase?.firestore)return true;
      await sleep(80);
    }
    throw new Error('FIREBASE_SDK_TIMEOUT');
  }

  async function ensureAuthReady(){
    await waitForFirebaseSdk();
    const auth=firebase.auth();
    if(auth.currentUser)return auth.currentUser;

    try{
      const credential=await auth.signInAnonymously();
      if(credential?.user)return credential.user;
    }catch(error){
      console.warn('[LEXICON X] Certificate anonymous sign-in initial attempt failed',error);
    }

    if(auth.currentUser)return auth.currentUser;
    return new Promise((resolve,reject)=>{
      let settled=false;
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;
        try{unsub();}catch(_){}
        reject(new Error('FIREBASE_AUTH_TIMEOUT'));
      },10000);
      const unsub=auth.onAuthStateChanged(user=>{
        if(settled||!user)return;
        settled=true;
        clearTimeout(timer);
        try{unsub();}catch(_){}
        resolve(user);
      },error=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        reject(error);
      });
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
      screen.textContent='Connecting to Firebase and preparing your Certificate…';
      await ensureAuthReady();
      const db=firebase.firestore();
      const playerId=identity.playerId;

      const certSnap=await db.collection('ewp_certificates').doc(playerId).get();
      if(!certSnap.exists)throw new Error('CERTIFICATE_NOT_READY');
      const cert=certSnap.data()||{};
      if(!cert.certificateId)throw new Error('CERTIFICATE_NOT_READY');

      const cached=readResumeCache(playerId);
      if(cached?.profile&&cached?.progress){
        const bonusBest=readBonusBest(playerId);
        renderCertificate(identity,cached.profile,cached.progress,{bonusBest},cert);
        return;
      }

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
      console.error('[LEXICON X] Certificate load failed',error);
      screen.textContent='Unable to open Certificate: '+String(error?.message||error);
      actions.hidden=false;
    }
  }
  console.info('[LEXICON X] Certificate Auth Bootstrap ready',VERSION);
  load();
}());