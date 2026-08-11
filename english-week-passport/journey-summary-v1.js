(function(){
  'use strict';
  const VERSION='2026-08-11-JOURNEY-SUMMARY-EVENT-DAY-LIGHT-V3-BONUS-MOBILE-COPY';
  const cfg=window.EW_CONFIG||{};
  const journey=window.EW_JOURNEY;
  const content=document.getElementById('content');
  const status=document.getElementById('status');
  const certificateBtn=document.getElementById('certificateBtn');
  const backBtn=document.getElementById('backBtn');
  let identity=null;
  let loaded=null;

  const missionNames={word_match:'LexiMatch Navigator',category_forest:'Category Forest',sentence_city:'Sentence City',word_detective:'Conversation Quest',final_boss:'LEXICON Champion Arena',bonus_lens:'Lexicon Lens Hunt'};
  const helpedNames={vocabulary:'Vocabulary',context:'Context',speaking:'Speaking',movement:'Movement',strategy:'Strategy'};
  function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function readIdentity(){try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
  function show(message,type){status.textContent=message;status.className='status show '+(type||'')}
  function goPassport(){location.replace('./index.html?resume=passport&from=journey_summary&v=20260811-event-day-light-bonus')}
  function goReflection(){location.replace('./final-reflection.html?v=20260811-event-day-light&from=summary_recovery')}
  function goCertificate(){location.replace('./certificate-v1.html?from=journey_summary&v=20260811-event-day-light')}
  function signed(value){const n=Number(value||0);return `${n>0?'+':''}${n}%`}
  backBtn.addEventListener('click',goPassport);

  function render(data){
    const s=data.summary||{};
    const gain=Number(s.learningGain||0);
    const games=Array.isArray(s.games)?s.games:[];
    const reflection=s.reflection||{};
    const bonus=s.bonus||{played:false,score:0};
    const completed=games.filter(g=>g.passed||Number(g.bestAccuracy||0)>0).length;
    const gameAverage=Number(s.averageGameAccuracy||0);
    const coreScore=Number(s.coreScore||0);
    const bonusScore=bonus.played?Number(s.bonusScore||bonus.score||0):0;
    const passportTotal=Number(s.passportTotal||coreScore+bonusScore);
    document.getElementById('heroTitle').textContent=`${identity.nickname||identity.fullName||'ผู้เล่น'} • ${s.badge||'LEXICON X Explorer'}`;
    content.innerHTML=`
      <section class="metrics">
        <div class="metric"><strong>${completed}/5</strong><small>Games Completed</small></div>
        <div class="metric"><strong>${gameAverage}%</strong><small>Game Average</small></div>
        <div class="metric"><strong>${bonus.played?'+'+bonusScore:'—'}</strong><small>Bonus Points</small></div>
        <div class="metric"><strong>${passportTotal}</strong><small>Passport Total</small></div>
        <div class="metric"><strong>${signed(gain)}</strong><small>Learning Gain</small></div>
        <div class="metric"><strong>${Number(reflection.confidence||0)}/5</strong><small>Confidence</small></div>
      </section>
      <section class="card"><h2>📈 Learning Gain • Pre → Post</h2><div class="gain"><div class="scorebox"><small>Pre-Challenge</small><strong>${Number(s.pre?.accuracy||0)}%</strong></div><div class="arrow">→</div><div class="scorebox"><small>Post-Challenge</small><strong>${Number(s.post?.accuracy||0)}%</strong></div><div class="gain-badge">${signed(gain)}</div></div></section>
      <section class="card"><h2>🎮 สถานะภารกิจ Game 1–5</h2><div class="games">${games.map(game=>{const done=game.passed||Number(game.bestAccuracy||0)>0;return `<div class="game"><div><strong>${h(game.title||missionNames[game.stageId]||game.stageId)}</strong><small>${h(game.skill||'')} • ${done?'ทำภารกิจแล้ว':'ยังไม่พบการจบภารกิจ'}</small><div class="bar"><span style="width:${Math.max(0,Math.min(100,Number(game.bestAccuracy||0)))}%"></span></div></div><div class="pct">${done?`${Number(game.bestAccuracy||0)}% ✓`:'—'}</div></div>`}).join('')}</div></section>
      <section class="card bonus-card"><h2>📷 Bonus Mission • Lexicon Lens Hunt</h2>${bonus.played?`<div class="bonus-result"><div><strong>${bonusScore}% ✓</strong><small>Bonus Score</small></div><div><strong>+${bonusScore} pts</strong><small>Added to Passport Total</small></div><div><strong>${coreScore} + ${bonusScore} = ${passportTotal}</strong><small>Core + Bonus</small></div></div><p class="bonus-note">Bonus เพิ่ม Passport Total แต่ไม่กระทบ Game Average หรือสิทธิ์ Certificate</p>`:`<p class="bonus-note">ยังไม่ได้เล่น Bonus Mission • Bonus เป็นทางเลือกและไม่กระทบสิทธิ์ Certificate</p>`}</section>
      <section class="achievement"><div class="award"><small>🏅 Achievement</small><strong>${h(s.badge||'LEXICON X Explorer')}</strong><small>Achievement หลักอิง Game 1–5 เพื่อความเท่าเทียมของผู้เล่นทุกคน</small></div><div class="award"><small>📊 Event-Day Status</small><strong>${completed}/5 Games${bonus.played?' + Bonus':''}</strong><small>โหมดเบาสำหรับผู้ร่วมกิจกรรมจำนวนมาก</small></div></section>
      <section class="card"><h2>💭 Final Reflection</h2><div class="reflection"><div><span>Mission ที่มีประโยชน์ที่สุด</span><strong>${h(missionNames[reflection.mostUsefulMission]||reflection.mostUsefulMission||'—')}</strong></div><div><span>สิ่งที่ช่วยการเรียนรู้มากที่สุด</span><strong>${h(helpedNames[reflection.helpedMost]||reflection.helpedMost||'—')}</strong></div>${reflection.takeaway?`<div><span>Takeaway</span><strong>${h(reflection.takeaway)}</strong></div>`:''}</div></section>`;
    certificateBtn.disabled=false;
    certificateBtn.textContent=data.summaryViewed?'ดู Certificate':'ยืนยันสรุปเส้นทางและดู Certificate';
  }

  async function load(){
    identity=readIdentity();
    if(!identity?.playerId){content.innerHTML='<section class="card">ไม่พบรหัสผู้เล่น กรุณากลับ Passport แล้วเข้าสู่ระบบใหม่</section>';certificateBtn.textContent='กลับ Passport';certificateBtn.disabled=false;certificateBtn.onclick=goPassport;return}
    if(!journey?.endpointReady?.()){content.innerHTML='<section class="card">Firebase Journey Authority ยังไม่พร้อม</section>';certificateBtn.textContent='กลับ Passport';certificateBtn.disabled=false;certificateBtn.onclick=goPassport;return}
    try{loaded=await journey.summary(identity.playerId);if(!loaded?.ok||loaded.mode!=='firebase'||!loaded.summary)throw new Error('FIREBASE_JOURNEY_SUMMARY_REQUIRED');render(loaded)}catch(error){
      console.error(error);const message=String(error?.message||error);
      if(message.includes('FINAL_REFLECTION_REQUIRED')){content.innerHTML='<section class="card"><strong>ยังไม่พบ Final Reflection</strong><br>กรุณาบันทึก Reflection ให้ครบก่อนดู Journey Summary</section>';certificateBtn.textContent='ไป Final Reflection';certificateBtn.disabled=false;certificateBtn.onclick=goReflection;return}
      content.innerHTML=`<section class="card">โหลด Journey Summary ไม่สำเร็จ: <strong>${h(message)}</strong></section>`;certificateBtn.textContent='กลับ Passport';certificateBtn.disabled=false;certificateBtn.onclick=goPassport;
    }
  }

  certificateBtn.addEventListener('click',async()=>{
    if(!loaded?.summary)return;
    certificateBtn.disabled=true;certificateBtn.textContent='กำลังยืนยัน Summary…';
    try{const receipt=await journey.completeSummary(identity.playerId);if(!receipt?.ok||receipt.mode!=='firebase')throw new Error('FIREBASE_SUMMARY_CONFIRM_REQUIRED');show('Journey Summary ยืนยันแล้ว ✓ • กำลังเปิด Certificate','good');setTimeout(goCertificate,500)}catch(error){console.error(error);show('ยืนยัน Summary ไม่สำเร็จ: '+String(error?.message||error),'bad');certificateBtn.disabled=false;certificateBtn.textContent='ลองยืนยัน Summary อีกครั้ง'}
  });
  load();
}());