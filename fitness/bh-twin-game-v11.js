(()=>{
'use strict';
const BH=window.BH,s=BH.state,e=BH.el,C=BH.clamp;

BH.cancelCountdown=()=>{s.countdownToken++;e.countdown.classList.add('hidden')};

BH.beginCalibration=async()=>{
  BH.syncContext();BH.cancelCountdown();s.gameToken++;s.demo=false;s.roundId=BH.stableId('BHROUND');
  s.calValidMs=0;s.calLast=BH.now();s.calHistory=[];s.smooth=null;s.latest=null;s.latestAt=0;
  s.calibration=null;s.phase='camera';
  if(!await BH.startCamera())return;
  if(!BH.initPose())return;
  BH.poseLoop();e.startOverlay.classList.add('hidden');e.calibrationOverlay.classList.remove('hidden');
  s.phase='calibration';
  BH.setCoach('ถอยให้เห็นทั้งตัว แล้วกางแขนระดับไหล่','ค้างนิ่งประมาณ 2 วินาที','📐','CALIBRATE');
};

BH.restartCalibration=async()=>{
  if(s.phase==='play'||s.phase==='paused'){
    const ok=confirm('เริ่ม Calibration ใหม่และยกเลิกรอบปัจจุบันหรือไม่?');if(!ok)return;
  }
  e.resultOverlay.classList.add('hidden');e.startOverlay.classList.add('hidden');
  await BH.beginCalibration();
};

BH.startDemo=()=>{
  BH.syncContext();BH.cancelCountdown();s.gameToken++;s.demo=true;s.roundId=BH.stableId('BHDEMO');
  s.calibration={center:{x:.5,y:.58},shoulderCenter:{x:.5,y:.36},shoulderWidth:.18,bodyHeight:.70,
    ankleL:{x:.45,y:.90},ankleR:{x:.55,y:.90},ankleMid:{x:.5,y:.90},ankleSpread:.10};
  e.startOverlay.classList.add('hidden');s.phase='ready';BH.startCountdown();
};

BH.startCountdown=()=>{
  const token=++s.countdownToken;e.calibrationOverlay.classList.add('hidden');
  let n=3;e.countdown.textContent=n;e.countdown.classList.remove('hidden');
  const step=()=>{
    if(token!==s.countdownToken)return;
    n--;
    if(n<=0){
      e.countdown.textContent='GO';
      setTimeout(()=>{if(token===s.countdownToken)e.countdown.classList.add('hidden')},450);
      BH.startGame();
    }else{e.countdown.textContent=n;setTimeout(step,700)}
  };
  setTimeout(step,700);
};

BH.resetRoundState=()=>{
  const cfg=BH.CONFIG[e.difficulty.value]||BH.CONFIG.normal;
  s.sequence=[...cfg.sequence];s.index=0;s.currentKey=s.sequence[0];s.bossKey=Math.random()<.5?'left':'right';
  s.holdMs=0;s.gateMs=0;s.timeLimit=BH.num(e.duration.value,60);s.timeLeft=s.timeLimit;
  s.startedAt=BH.now();s.lastTick=s.startedAt;s.pausedAt=0;s.score=0;s.results=[];
  s.lostPoseCount=0;s.lossActive=false;s.invalidSince=0;s.centerHistory=[];s.lastCenter=null;
  s.lastValidAt=0;s.lastLostAt=0;s.transitionStart=BH.now();s.firstValidAt=0;s.currentLosses=0;
  s.assistLevel=0;s.maxAssistUsed=0;s.currentAccumulator=BH.emptyAccumulator();
  s.roundTrackedMs=0;s.roundDetectedMs=0;s.roundValidMs=0;s.roundConfidenceSum=0;s.roundSamples=0;
};

BH.startGame=()=>{
  s.phase='play';BH.resetRoundState();BH.setPoseUI();
  const token=++s.gameToken;requestAnimationFrame(ts=>BH.gameLoop(ts,token));
};

BH.currentPoseKey=()=>s.currentKey==='boss'?s.bossKey:s.currentKey;

BH.setPoseUI=()=>{
  const key=BH.currentPoseKey();
  e.poseName.textContent=s.currentKey==='boss'?`${BH.POSES.boss.name} • ${key.toUpperCase()}`:BH.POSES[key].name;
  e.poseCue.textContent=s.currentKey==='boss'?`ลมกำลังมา — ${BH.POSES[key].cue}`:BH.POSES[key].cue;
  e.ghost.className='poseGhost '+BH.POSES[key].ghost;s.holdMs=0;s.gateMs=0;
  s.transitionStart=BH.now();s.firstValidAt=0;s.centerHistory=[];s.lastCenter=null;
  s.currentLosses=0;s.lossActive=false;s.invalidSince=0;s.assistLevel=0;
  s.currentAccumulator=BH.emptyAccumulator();
  if(s.currentKey==='boss')BH.spawnWind();
  BH.setCoach(key==='center'?'กางแขนให้เสมอไหล่ แล้วค้าง':'เอื้อมช้า ๆ โดยไม่ยกเท้า',
    'ระบบจะเริ่มนับเมื่อท่าถูกต่อเนื่อง','💎',s.currentKey==='boss'?'BOSS':'POSE');
};

BH.spawnWind=()=>{
  for(let i=0;i<6;i++)setTimeout(()=>{
    if(s.phase!=='play')return;
    const w=document.createElement('div');w.className='wind';w.textContent=Math.random()<.5?'💨':'🌬️';
    w.style.left=(Math.random()*70+5)+'%';w.style.top=(Math.random()*45+20)+'%';
    w.style.setProperty('--dx',(Math.random()<.5?-1:1)*(100+Math.random()*160)+'px');
    e.stage.appendChild(w);setTimeout(()=>w.remove(),1300);
  },i*520);
};

BH.applyAdaptiveSupport=elapsed=>{
  const cfg=BH.CONFIG[e.difficulty.value]||BH.CONFIG.normal;
  const shouldAssist=(elapsed>cfg.assistAfterMs*(s.assistLevel+1))||(s.currentLosses>=2+s.assistLevel*2);
  if(shouldAssist&&s.assistLevel<cfg.maxAssist){
    s.assistLevel++;s.maxAssistUsed=Math.max(s.maxAssistUsed,s.assistLevel);
    BH.beep(420,70);
    BH.setCoach('เปิดตัวช่วยเล็กน้อย: ระบบยอมรับช่วงท่ากว้างขึ้น',
      'คะแนนยังบันทึก Assist เพื่อให้ครูแปลผลได้ถูกต้อง','💡',`ASSIST ${s.assistLevel}`);
  }
};

BH.accumulateEvaluation=(ev,dt,holding)=>{
  const a=s.currentAccumulator;
  a.trackedMs+=dt;s.roundTrackedMs+=dt;
  if(ev.tracked){s.roundDetectedMs+=dt;s.roundConfidenceSum+=ev.confidence;s.roundSamples++}
  if(ev.valid){
    a.validMs+=dt;s.roundValidMs+=dt;
    if(holding){
      a.samples++;a.poseSum+=ev.pose;a.stabilitySum+=ev.stability;
      a.controlSum+=ev.control;a.safeSum+=ev.safe;a.confidenceSum+=ev.confidence;
    }
  }
};

BH.gameLoop=(ts,token)=>{
  if(token!==s.gameToken||s.phase!=='play')return;
  const cfg=BH.CONFIG[e.difficulty.value]||BH.CONFIG.normal;
  const dt=Math.min(90,Math.max(0,ts-s.lastTick));s.lastTick=ts;
  s.timeLeft=Math.max(0,s.timeLimit-(ts-s.startedAt)/1000);
  const key=BH.currentPoseKey(),ev=s.demo?BH.demoEvaluation(key,ts):BH.evaluatePose(s.latest,key);
  s.poseScore=ev.pose;s.stabilityScore=ev.stability;s.controlScore=ev.control;s.safeScore=ev.safe;s.confidence=ev.confidence;
  const elapsed=ts-s.transitionStart;BH.applyAdaptiveSupport(elapsed);

  let holding=false;
  if(ev.valid){
    if(!s.firstValidAt)s.firstValidAt=ts;
    s.gateMs=Math.min(cfg.gateMs,s.gateMs+dt);
    if(s.gateMs>=cfg.gateMs){s.holdMs+=dt;holding=true}
    s.lastValidAt=ts;s.invalidSince=0;s.lossActive=false;
  }else{
    if(!s.invalidSince)s.invalidSince=ts;
    const invalidFor=ts-s.invalidSince,recentValid=ts-s.lastValidAt<cfg.graceMs;
    if(!recentValid){
      s.gateMs=Math.max(0,s.gateMs-dt*.80);
      if(invalidFor>cfg.lostDebounceMs&&!s.lossActive){
        s.lossActive=true;s.lostPoseCount++;s.currentLosses++;s.lastLostAt=ts;
      }
      if(invalidFor>cfg.graceMs)s.holdMs=Math.max(0,s.holdMs-dt*.08);
    }
  }

  BH.accumulateEvaluation(ev,dt,holding);
  const assistHoldFactor=1-s.assistLevel*.075;
  const required=(cfg.hold+(s.currentKey==='boss'?450:0))*assistHoldFactor;
  const progress=C(s.holdMs/required,0,1);
  if(progress>=1){BH.completePose(ev,required);if(s.phase!=='play')return}
  BH.updateGameUI(ev,progress);
  if(s.timeLeft<=0){BH.finish('timeup');return}
  requestAnimationFrame(next=>BH.gameLoop(next,token));
};

BH.completePose=(ev,required)=>{
  const key=BH.currentPoseKey(),a=s.currentAccumulator,n=Math.max(1,a.samples);
  const poseAccuracy=Math.round(a.poseSum/n)||Math.round(ev.pose);
  const stability=Math.round(a.stabilitySum/n)||Math.round(ev.stability);
  const holdControl=Math.round(a.controlSum/n)||Math.round(ev.control);
  const safeZone=Math.round(a.safeSum/n)||Math.round(ev.safe);
  const confidence=Math.round(a.confidenceSum/n)||Math.round(ev.confidence);
  const transitionMs=Math.max(0,(s.firstValidAt||BH.now())-s.transitionStart);
  const transitionEfficiency=C(100-Math.max(0,transitionMs-900)/38-s.currentLosses*7-s.assistLevel*4,35,100);
  const transitionControl=Math.round(holdControl*.45+transitionEfficiency*.55);
  const quality=C(Math.round(poseAccuracy*.35+stability*.30+transitionControl*.20+safeZone*.10+5),0,100);
  const points=Math.round(120+quality*2.25+(s.currentKey==='boss'?180:0)-s.assistLevel*18);
  s.score+=Math.max(80,points);
  s.results.push({
    index:s.index+1,key,title:BH.POSES[key].name,poseAccuracy,stability,transitionControl,
    holdControl,safeZone,confidence,quality,holdMs:Math.round(s.holdMs),
    validMs:Math.round(a.validMs),trackedMs:Math.round(a.trackedMs),requiredMs:Math.round(required),
    transitionMs:Math.round(transitionMs),losses:s.currentLosses,assistLevel:s.assistLevel,passed:true
  });
  e.crystal.classList.add('complete');setTimeout(()=>e.crystal.classList.remove('complete'),650);
  BH.beep(660,90);s.index++;
  if(s.index>=s.sequence.length){BH.finish('completed');return}
  s.currentKey=s.sequence[s.index];if(s.currentKey==='boss')s.bossKey=Math.random()<.5?'left':'right';
  BH.setPoseUI();
};

BH.updateGameUI=(ev,p)=>{
  const tracking=s.roundTrackedMs?C(s.roundDetectedMs/s.roundTrackedMs*100,0,100):0;
  e.hudTime.textContent=Math.ceil(s.timeLeft);e.hudScore.textContent=s.score;
  e.hudPose.textContent=`${Math.min(s.index+1,s.sequence.length)}/${s.sequence.length}`;
  e.hudConfidence.textContent=Math.round(ev.confidence)+'%';e.hudStability.textContent=Math.round(ev.stability)+'%';
  e.hudTracking.textContent=Math.round(tracking)+'%';
  e.timeBar.style.width=s.timeLeft/s.timeLimit*100+'%';e.scoreBar.style.width=C(s.score/2400*100,0,100)+'%';
  e.poseBar.style.width=s.index/s.sequence.length*100+'%';e.confidenceBar.style.width=C(ev.confidence,0,100)+'%';
  e.stabilityBar.style.width=C(ev.stability,0,100)+'%';e.trackingBar.style.width=tracking+'%';
  e.poseEnergy.style.width=C(ev.pose,0,100)+'%';e.stabilityEnergy.style.width=C(ev.stability,0,100)+'%';
  e.controlEnergy.style.width=C(ev.control,0,100)+'%';
  e.energyLabel.textContent=ev.valid?(s.assistLevel?`พลังเพิ่ม • Assist ${s.assistLevel}`:'พลังคริสตัลกำลังเพิ่ม'):'ปรับท่าอีกนิด';
  e.holdRing.style.setProperty('--hold',p*360+'deg');e.holdText.textContent=Math.round(p*100)+'%';
  e.safeZone.classList.toggle('warn',!ev.feetStable);e.crystal.classList.toggle('active',ev.valid);
  e.status.textContent=s.demo?'🖱️ Demo Mode':`📷 Pose ${Math.round(ev.confidence)}%`;
  BH.setCoach(ev.feedback,ev.valid?'ค้างต่อเนื่องเพื่อสะสมพลัง':'ระบบพักเวลา Hold ไว้ก่อน','🧘',ev.valid?'HOLD':'ADJUST');
  BH.updateQA?.();
};

BH.togglePause=()=>{
  if(s.phase==='play'){
    s.phase='paused';s.pausedAt=BH.now();s.gameToken++;
    e.pauseBtn.textContent='▶';BH.setCoach('พักเกมแล้ว','จัดท่าและพื้นที่ให้พร้อมก่อนเล่นต่อ','⏸️','PAUSED');
  }else if(s.phase==='paused'){
    const pausedFor=BH.now()-s.pausedAt;s.startedAt+=pausedFor;s.lastTick=BH.now();s.transitionStart+=pausedFor;
    s.phase='play';e.pauseBtn.textContent='Ⅱ';const token=++s.gameToken;
    BH.setCoach('เล่นต่อได้','ทำท่าตามเงาและค้างให้นิ่ง','▶️','RESUME');
    requestAnimationFrame(ts=>BH.gameLoop(ts,token));
  }
};

BH.average=f=>s.results.length?Math.round(s.results.reduce((z,r)=>z+BH.num(r[f]),0)/s.results.length):0;
BH.beep=(freq=520,ms=80)=>{
  if(!e.soundOn.checked)return;
  try{
    const ac=BH.beep.ac||(BH.beep.ac=new(window.AudioContext||window.webkitAudioContext)());
    if(ac.state==='suspended')ac.resume();
    const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;g.gain.value=.035;
    o.connect(g);g.connect(ac.destination);o.start();setTimeout(()=>o.stop(),ms);
  }catch(_){}
};
})();
