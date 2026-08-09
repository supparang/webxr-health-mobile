(function(){
  'use strict';
  const VERSION='2026-08-09-JOURNEY-SUMMARY-V3-REFLECTION-RECOVERY';
  const cfg=window.EW_CONFIG||{};
  const journey=window.EW_JOURNEY;
  const content=document.getElementById('content');
  const status=document.getElementById('status');
  const certificateBtn=document.getElementById('certificateBtn');
  const backBtn=document.getElementById('backBtn');
  let identity=null;
  let loaded=null;

  const missionNames={word_match:'LexiMatch Navigator',category_forest:'Category Forest',sentence_city:'Sentence City',word_detective:'Conversation Quest AR',final_boss:'Champion Command Arena',bonus_lens:'Lexicon Lens Hunt'};
  const helpedNames={vocabulary:'Vocabulary',context:'Context',speaking:'Speaking',movement:'Movement',strategy:'Strategy'};
  function h(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
  function readIdentity(){try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
  function show(message,type){status.textContent=message;status.className='status show '+(type||'')}
  function goPassport(){location.replace('./index.html?resume=passport&from=journey_summary&v=20260809-journey-direct5')}
  function goReflection(){location.replace('./final-reflection.html?v=20260809-journey-direct5&from=summary_recovery')}
  function goCertificate(){location.replace('./certificate-v1.html?from=journey_summary&v=20260809-journey-direct5')}
  function duration(ms){const total=Math.max(0,Math.round(Number(ms||0)/1000));const min=Math.floor(total/60);const sec=total%60;return min?`${min}m ${sec}s`:`${sec}s`}
  function signed(value){const n=Number(value||0);return `${n>0?'+':''}${n}%`}
  backBtn.addEventListener('click',goPassport);

  function render(data){
    const s=data.summary||{};
    const gain=Number(s.learningGain||0);
    const games=Array.isArray(s.games)?s.games:[];
    const bonus=s.bonus||{};
    const reflection=s.reflection||{};
    document.getElementById('heroTitle').textContent=`${identity.nickname||identity.fullName||'ผู้เล่น'} • ${s.badge||'LEXICON X Explorer'}`;
    content.innerHTML=`
      <section class="metrics">
        <div class="metric"><strong>${Number(s.averageGameAccuracy||0)}%</strong><small>Game Average</small></div>
        <div class="metric"><strong>${Number(s.totalAttempts||0)}</strong><small>Total Attempts</small></div>
        <div class="metric"><strong>${duration(s.totalDurationMs)}</strong><small>Total Time</small></div>
        <div class="metric"><strong>${Number(reflection.confidence||0)}/5</strong><small>Confidence</small></div>
      </section>
      <section class="card"><h2>📈 Learning Gain • Pre → Post</h2><div class="gain"><div class="scorebox"><small>Pre-Challenge</small><strong>${Number(s.pre?.accuracy||0)}%</strong></div><div class="arrow">→</div><div class="scorebox"><small>Post-Challenge</small><strong>${Number(s.post?.accuracy||0)}%</strong></div><div class="gain-badge">${signed(gain)}</div></div></section>
      <section class="card"><h2>🎮 ผลการเล่น Game 1–5</h2><div class="games">${games.map(game=>`<div class="game"><div><strong>${h(game.title||game.stageId)}</strong><small>${h(game.skill||'')} • ${Number(game.attempts||0)} attempt${Number(game.attempts||0)===1?'':'s'} • ${duration(game.durationMs)}</small><div class="bar"><span style="width:${Math.max(0,Math.min(100,Number(game.bestAccuracy||0)))}%"></span></div></div><div class="pct">${Number(game.bestAccuracy||0)}%</div></div>`).join('')}</div></section>
      <section class="achievement"><div class="award"><small>🏅 Achievement</small><strong>${h(s.badge||'LEXICON X Explorer')}</strong><small>จาก Learning Gain และผลเกมที่ Firebase รับรอง</small></div><div class="award"><small>⭐ Strongest Skill</small><strong>${h(s.strongestSkill?.skill||'—')}</strong><small>${s.strongestSkill?`${Number(s.strongestSkill.accuracy||0)}% • ${h(missionNames[s.strongestSkill.stageId]||s.strongestSkill.stageId)}`:'ยังไม่มีข้อมูล'}</small></div></section>
      <section class="card"><h2>📷 Bonus Mission</h2>${bonus.played?`<div class="metrics" style="margin:0"><div class="metric"><strong>${Number(bonus.score||0)}</strong><small>Lens Score</small></div><div class="metric"><strong>${Number(bonus.correctContexts||0)}/5</strong><small>Context</small></div><div class="metric"><strong>${Number(bonus.totalScans||0)}</strong><small>QR Scans</small></div><div class="metric"><strong>${duration(bonus.durationMs)}</strong><small>เวลา</small></div></div>`:'<div style="color:var(--muted)">ไม่ได้เล่น Lexicon Lens Hunt • Bonus ไม่กระทบ Certificate</div>'}</section>
      <section class="card"><h2>💭 Final Reflection</h2><div class="reflection"><div><span>Mission ที่มีประโยชน์ที่สุด</span><strong>${h(missionNames[reflection.mostUsefulMission]||reflection.mostUsefulMission||'—')}</strong></div><div><span>สิ่งที่ช่วยการเรียนรู้มากที่สุด</span><strong>${h(helpedNames[reflection.helpedMost]||reflection.helpedMost||'—')}</strong></div>${reflection.takeaway?`<div><span>Takeaway</span><strong>${h(reflection.takeaway)}</strong></div>`:''}</div></section>`;
    certificateBtn.disabled=false;
    certificateBtn.textContent=data.summaryViewed?'ดู Certificate':'ยืนยันสรุปเส้นทางและดู Certificate';
  }

  async function load(){
    identity=readIdentity();
    if(!identity?.playerId){content.innerHTML='<section class="card">ไม่พบรหัสผู้เล่น กรุณากลับ Passport แล้วเข้าสู่ระบบใหม่</section>';certificateBtn.textContent='กลับ Passport';certificateBtn.disabled=false;certificateBtn.onclick=goPassport;return}
    if(!journey?.endpointReady?.()){content.innerHTML='<section class="card">Firebase Journey Authority ยังไม่พร้อม จึงยังโหลด Journey Summary ไม่ได้</section>';certificateBtn.textContent='กลับ Passport';certificateBtn.disabled=false;certificateBtn.onclick=goPassport;return}
    try{
      loaded=await journey.summary(identity.playerId);
      if(!loaded?.ok||loaded.mode!=='firebase'||!loaded.summary)throw new Error('FIREBASE_JOURNEY_SUMMARY_REQUIRED');
      render(loaded);
    }catch(error){
      console.error(error);
      const message=String(error?.message||error);
      if(message.includes('FINAL_REFLECTION_REQUIRED')){
        content.innerHTML='<section class="card"><strong>ยังไม่พบ Final Reflection ใน Firebase</strong><br>ระบบจะพากลับไปบันทึก Reflection ให้ครบก่อนดู Journey Summary</section>';
        certificateBtn.textContent='ไป Final Reflection';
        certificateBtn.disabled=false;
        certificateBtn.onclick=goReflection;
        return;
      }
      content.innerHTML=`<section class="card">โหลด Journey Summary ไม่สำเร็จ: <strong>${h(message)}</strong></section>`;
      certificateBtn.textContent='กลับ Passport';certificateBtn.disabled=false;certificateBtn.onclick=goPassport;
    }
  }

  certificateBtn.addEventListener('click',async()=>{
    if(!loaded?.summary)return;
    certificateBtn.disabled=true;certificateBtn.textContent='กำลังยืนยัน Summary กับ Firebase…';
    try{
      const receipt=await journey.completeSummary(identity.playerId);
      if(!receipt?.ok||receipt.mode!=='firebase'||!receipt.receiptId)throw new Error('FIREBASE_SUMMARY_RECEIPT_REQUIRED');
      show(`Journey Summary ยืนยันแล้ว ✓ • ${receipt.receiptId} • กำลังเปิด Certificate`,'good');
      setTimeout(goCertificate,900);
    }catch(error){console.error(error);show('ยืนยัน Journey Summary ไม่สำเร็จ: '+String(error?.message||error),'bad');certificateBtn.disabled=false;certificateBtn.textContent='ลองยืนยัน Summary อีกครั้ง'}
  });

  load();
}());