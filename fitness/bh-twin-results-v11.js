(()=>{
'use strict';
const BH=window.BH,s=BH.state,e=BH.el,$=BH.$,C=BH.clamp;

BH.calcSummary=reason=>{
  const total=s.sequence.length,completed=s.results.length;
  const poseAccuracy=BH.average('poseAccuracy'),stabilityScore=BH.average('stability');
  const transitionScore=BH.average('transitionControl'),safeZoneScore=BH.average('safeZone');
  const completion=Math.round(completed/Math.max(1,total)*100);
  const validHoldRatio=Math.round(C(s.roundValidMs/Math.max(1,s.roundTrackedMs)*100,0,100));
  const trackingCoverage=Math.round(C(s.roundDetectedMs/Math.max(1,s.roundTrackedMs)*100,0,100));
  const trackingConfidence=s.roundSamples?Math.round(s.roundConfidenceSum/s.roundSamples):0;
  const assessmentScore=C(Math.round(
    poseAccuracy*.35+stabilityScore*.30+transitionScore*.20+safeZoneScore*.10+completion*.05
  ),0,100);
  const passed=completion>=80&&assessmentScore>=60;
  let best=0;try{best=BH.num(localStorage.getItem(BH.KEY_BEST),0)}catch(_){}
  const official=!s.demo;
  return{
    version:BH.VERSION,ts:new Date().toISOString(),timestampLocal:BH.bangkok(),
    sessionId:s.sessionId,roundId:s.roundId,attemptId:s.roundId,
    game:'balancehold',gameId:'balancehold',routeName:'balancehold',
    studentName:s.ctx.studentName,studentId:s.ctx.studentId,classId:s.ctx.classId,section:s.ctx.section,
    playerId:s.ctx.playerId,teacherId:s.ctx.teacherId,difficulty:e.difficulty.value,duration:s.timeLimit,
    mode:s.demo?'demo':'fullbody-pose',official,poseTypes:['sky_shield','star_reach'],
    poseSequence:[...s.sequence],completedPoses:completed,totalPoses:total,
    poseAccuracy,stabilityScore,transitionScore,safeZoneScore,validHoldRatio,trackingConfidence,
    trackingCoverage,completionRate:completion,lostPoseCount:s.lostPoseCount,
    assistLevelMax:s.maxAssistUsed,assistUsed:s.maxAssistUsed>0,calibrationStatus:s.calibration?'passed':'not_run',
    score:s.score,assessmentScore,passed,reason,
    rank:assessmentScore>=90?'Crystal Master':assessmentScore>=78?'Balance Guardian':
      assessmentScore>=65?'Stable Explorer':'Balance Trainee',
    previousBest:best,isNewBest:official&&s.score>best,poseResults:s.results,
    advice:stabilityScore<65?'ฝึก Sky Shield โดยหายใจช้าและลดการสั่นของลำตัว':
      transitionScore<65?'ฝึกเปลี่ยนจาก Center ไป Star Reach ให้ช้าลงและนุ่มนวล':
      safeZoneScore<70?'รักษาเท้าทั้งสองให้อยู่ใน Safe Zone และไม่โยกสะโพกมากเกินไป':
      validHoldRatio<65?'ปรับระยะกล้องและแสง เพื่อให้ระบบติดตามท่าได้ต่อเนื่องขึ้น':
      'พร้อมเพิ่มระดับหรือเพิ่มเวลาเล่น'
  };
};

BH.payload=x=>{
  let p={
    api:'fitness',type:'balance_hold_summary',action:'save_balance_hold_summary',
    routeName:'balancehold',game:'balancehold',gameId:'balancehold',version:BH.VERSION,sourceUrl:location.href,
    timestamp:x.ts,timestampLocal:x.timestampLocal,sessionId:x.sessionId,roundId:x.roundId,
    attemptId:x.attemptId,submissionKey:`balancehold:${x.roundId}`,
    studentName:x.studentName,studentId:x.studentId,classId:x.classId,section:x.section,
    playerId:x.playerId,teacherId:x.teacherId,player:x.studentName,group:x.classId,
    mode:'PC/Mobile AR Pose',inputMode:'fullbody-pose',difficulty:x.difficulty,duration:x.duration,
    timeLimit:x.duration,endReason:x.reason,score:x.score,accuracy:x.poseAccuracy,
    completionRate:x.completionRate,bestCombo:x.completedPoses,hit:x.completedPoses,
    miss:x.totalPoses-x.completedPoses,misses:x.totalPoses-x.completedPoses,
    focusScore:x.assessmentScore,controlScore:x.transitionScore,coordinationScore:x.poseAccuracy,
    intensityLevel:'low-moderate',rank:x.rank,grade:x.passed?'PASS':'PRACTICE',
    advice:x.advice,notes:`Stability ${x.stabilityScore} • Safe ${x.safeZoneScore} • Assist ${x.assistLevelMax}`,
    poseAccuracy:x.poseAccuracy,stabilityScore:x.stabilityScore,transitionScore:x.transitionScore,
    safeZoneScore:x.safeZoneScore,validHoldRatio:x.validHoldRatio,trackingConfidence:x.trackingConfidence,
    trackingCoverage:x.trackingCoverage,completedPoses:x.completedPoses,totalPoses:x.totalPoses,
    lostPoseCount:x.lostPoseCount,assistUsed:x.assistUsed,assistLevelMax:x.assistLevelMax,
    calibrationStatus:x.calibrationStatus,poseSequence:JSON.stringify(x.poseSequence),
    rawJson:JSON.stringify(x),deviceType:/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)?'mobile':'pc',
    userAgent:navigator.userAgent,screenWidth:screen.width,screenHeight:screen.height
  };
  try{return window.FitnessStudentContext?.apply?.(p)||p}catch(_){return p}
};

BH.safeJson=(key,fallback=[])=>{
  try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch(_){return fallback}
};
BH.queuePayload=p=>{
  try{
    const q=BH.safeJson(BH.KEY_QUEUE,[]);q.push(p);
    localStorage.setItem(BH.KEY_QUEUE,JSON.stringify(q.slice(-12)));
  }catch(_){}
};
BH.isSent=id=>{try{return localStorage.getItem(BH.KEY_SENT+id)==='1'}catch(_){return false}};
BH.markSent=id=>{try{localStorage.setItem(BH.KEY_SENT+id,'1')}catch(_){}};

BH.postPayload=async p=>{
  await fetch(BH.ENDPOINT,{
    method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,
    headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p)
  });
};

BH.flushQueue=async()=>{
  if(!BH.ENDPOINT||!navigator.onLine)return;
  const q=BH.safeJson(BH.KEY_QUEUE,[]);if(!q.length)return;
  const remain=[];
  for(const p of q){
    try{await BH.postPayload(p);BH.markSent(p.roundId||p.attemptId||'')}
    catch(_){remain.push(p)}
  }
  try{localStorage.setItem(BH.KEY_QUEUE,JSON.stringify(remain.slice(-12)))}catch(_){}
};

BH.submitSummary=async x=>{
  const n=$('sheetStatus');
  if(s.demo){n.textContent='🖱️ Demo Mode — ไม่ส่งข้อมูลเข้า Sheet และไม่เปลี่ยน Personal Best';n.className='sheetStatus warn';return}
  if(!BH.ENDPOINT){n.textContent='⚠️ ยังไม่ได้ตั้งค่า Sheet endpoint';n.className='sheetStatus warn';return}
  if(BH.isSent(x.roundId)){n.textContent='✅ รอบนี้เคยส่งคำขอแล้ว — ป้องกันข้อมูลซ้ำ';n.className='sheetStatus ok';return}
  try{
    await BH.postPayload(BH.payload(x));BH.markSent(x.roundId);
    n.textContent='✅ ส่งคำขอเข้า Google Sheets แล้ว • ตรวจยืนยันผลใน Teacher Dashboard';
    n.className='sheetStatus ok';
  }catch(err){
    console.warn('[BalanceHold] submit failed',err);BH.queuePayload(BH.payload(x));
    n.textContent='⚠️ เครือข่ายขัดข้อง จึงเก็บคิวบนเครื่องไว้ก่อน';n.className='sheetStatus warn';
  }
};

BH.finish=reason=>{
  if(s.phase==='summary')return;
  s.phase='summary';s.gameToken++;e.pauseBtn.textContent='Ⅱ';
  const x=BH.calcSummary(reason);
  try{
    localStorage.setItem(BH.KEY_LAST,JSON.stringify(x));
    if(x.isNewBest)localStorage.setItem(BH.KEY_BEST,String(x.score));
  }catch(_){}
  BH.renderSummary(x);BH.submitSummary(x);
};

BH.renderSummary=x=>{
  const stars=x.assessmentScore>=88?3:x.assessmentScore>=70?2:1;
  const rows=x.poseResults.map(r=>`<div class="poseRow">
    <div>${r.title}<small>Assist ${r.assistLevel} • Lost ${r.losses}</small></div>
    <div>Pose ${r.poseAccuracy}</div><div>นิ่ง ${r.stability}</div><div>คุม ${r.transitionControl}</div>
  </div>`).join('')||'<div class="poseRow"><div>ยังไม่ผ่าน Pose</div><div>-</div><div>-</div><div>-</div></div>';
  e.resultOverlay.innerHTML=`<section class="modal">
    <div class="modalHead"><div class="modalIcon">🏆</div><div>
      <h2>Balance Hold Summary</h2>
      <p class="lead">${x.passed?'เยี่ยมมาก ผู้พิทักษ์คริสตัลทำภารกิจสำเร็จ!':'เริ่มต้นได้ดี รอบหน้าลองทำท่าให้ต่อเนื่องและนิ่งขึ้น'}</p>
    </div></div>
    <div class="summaryGrid">
      <div class="resultCard bigScore"><div><div class="scoreNum">${x.score}</div>
        <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
        <b>${x.rank} • Assessment ${x.assessmentScore}/100</b>
        <p>${x.official?(x.isNewBest?'🏅 New Personal Best!':`PB เดิม ${x.previousBest}`):'Demo • ไม่บันทึก PB'}</p>
      </div></div>
      <div class="metrics">
        <div class="metricRow"><span>Pose Accuracy</span><b>${x.poseAccuracy}%</b></div>
        <div class="metricRow"><span>Hold Stability</span><b>${x.stabilityScore}%</b></div>
        <div class="metricRow"><span>Transition Control</span><b>${x.transitionScore}%</b></div>
        <div class="metricRow"><span>Safe Zone Control</span><b>${x.safeZoneScore}%</b></div>
        <div class="metricRow"><span>Tracking Coverage</span><b>${x.trackingCoverage}%</b></div>
        <div class="metricRow"><span>Completion</span><b>${x.completedPoses}/${x.totalPoses}</b></div>
        <div class="metricRow"><span>Lost Pose / Assist</span><b>${x.lostPoseCount} / ${x.assistLevelMax}</b></div>
      </div>
    </div>
    <div class="resultCard adviceCard"><b>คำแนะนำ:</b> ${x.advice}</div>
    <div class="sheetStatus" id="sheetStatus">📤 กำลังเตรียมส่งผล...</div>
    <div class="poseResults">${rows}</div>
    <div class="actions">
      <button class="btn primary" id="replayBtn">🔁 เล่นอีกครั้ง</button>
      <button class="btn blue" id="backBtn">🏠 กลับ Fitness</button>
      <button class="btn" id="csvBtn">📄 Export CSV</button>
    </div>
  </section>`;
  e.resultOverlay.classList.remove('hidden');
  $('replayBtn').onclick=()=>{
    e.resultOverlay.classList.add('hidden');e.startOverlay.classList.remove('hidden');s.phase='setup';
    s.calibration=null;s.demo=false;
  };
  $('backBtn').onclick=()=>BH.plannerReturn(x);
  $('csvBtn').onclick=()=>BH.downloadCsv(x);
};

BH.plannerReturn=x=>{
  const raw=BH.q('hub','./hub.html');
  try{
    const u=new URL(raw,location.href);
    u.searchParams.set('plannerReturn','1');u.searchParams.set('completedGame','balancehold');
    u.searchParams.set('game','balancehold');u.searchParams.set('gameId','balancehold');u.searchParams.set('zone','fitness');
    u.searchParams.set('score',String(x.score));u.searchParams.set('rank',x.rank);
    u.searchParams.set('acc',String(x.poseAccuracy));u.searchParams.set('stability',String(x.stabilityScore));
    u.searchParams.set('control',String(x.transitionScore));u.searchParams.set('tracking',String(x.trackingCoverage));
    u.searchParams.set('result',x.reason);
    [['studentId',x.studentId],['studentName',x.studentName],['classId',x.classId],
      ['section',x.section],['session',x.sessionId]].forEach(([k,v])=>{if(v)u.searchParams.set(k,v)});
    location.href=u.toString();
  }catch(_){location.href=raw}
};

BH.downloadCsv=x=>{
  const cols=['timestampLocal','studentName','studentId','classId','section','difficulty','duration','score',
    'assessmentScore','poseAccuracy','stabilityScore','transitionScore','safeZoneScore','trackingCoverage',
    'completionRate','lostPoseCount','assistLevelMax','rank'];
  const line=cols.map(k=>`"${String(x[k]??'').replaceAll('"','""')}"`).join(',');
  const blob=new Blob([cols.join(',')+'\n'+line],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`balance-hold-twin-pose-${x.studentId||'player'}-${Date.now()}.csv`;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
};

BH.home=()=>{
  if(['play','paused','calibration'].includes(s.phase)&&!confirm('ออกจากเกม Balance Hold ตอนนี้หรือไม่?'))return;
  location.href=BH.q('hub','./hub.html');
};

$('startBtn').onclick=BH.beginCalibration;
$('cameraTestBtn').onclick=async()=>{
  const ok=await BH.startCamera();if(ok){BH.initPose();BH.poseLoop();BH.toast('กล้องพร้อม ยืนให้เห็นทั้งตัว')}
};
$('retryCameraBtn').onclick=async()=>{await BH.startCamera({restart:true});BH.initPose();BH.poseLoop()};
$('demoBtn').onclick=BH.startDemo;
$('cancelCalibrationBtn').onclick=()=>{
  BH.cancelCountdown();e.calibrationOverlay.classList.add('hidden');e.startOverlay.classList.remove('hidden');s.phase='setup'
};
$('pauseBtn').onclick=BH.togglePause;
$('recalibrateBtn').onclick=BH.restartCalibration;
$('homeBtn').onclick=BH.home;
window.addEventListener('resize',BH.resizeCanvas);
window.addEventListener('online',BH.flushQueue);
window.addEventListener('beforeunload',BH.stopCamera);
BH.initQuery();BH.resizeCanvas();BH.flushQueue();
console.info('[BalanceHoldTwinPose]',BH.VERSION);
})();
