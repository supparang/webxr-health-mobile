(()=>{
'use strict';
const BH=window.BH=window.BH||{};
BH.VERSION='20260716-BALANCE-HOLD-TWIN-POSE-V11-CLASSROOM';
BH.qs=new URLSearchParams(location.search);
BH.$=id=>document.getElementById(id);
BH.clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
BH.lerp=(a,b,t)=>a+(b-a)*t;
BH.q=(k,d='')=>BH.qs.get(k)||d;
BH.num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
BH.now=()=>performance.now();
BH.ENDPOINT=BH.q('api',BH.q('sheet','https://script.google.com/macros/s/AKfycbwdwozSPj0QwEYkclrxAqjZcN2E_uSqAVqAV9ev2_0PWCW1k9riLE_LLMksschpFcNZ-A/exec'));
BH.KEY_BEST='fitness_balance_hold_twin_pose_best_v11';
BH.KEY_LAST='fitness_balance_hold_last';
BH.KEY_QUEUE='fitness_balance_hold_sheet_queue_v11';
BH.KEY_SENT='fitness_balance_hold_sent_v11_';
BH.QA=BH.q('qa','0')==='1';

const $=BH.$;
BH.el={
  stage:$('stage'),camera:$('camera'),canvas:$('poseCanvas'),status:$('statusPill'),
  safeZone:$('safeZone'),ghost:$('poseGhost'),crystal:$('crystal'),holdRing:$('holdRing'),holdText:$('holdText'),
  hudTime:$('hudTime'),hudScore:$('hudScore'),hudPose:$('hudPose'),hudConfidence:$('hudConfidence'),
  hudStability:$('hudStability'),hudTracking:$('hudTracking'),
  timeBar:$('timeBar'),scoreBar:$('scoreBar'),poseBar:$('poseBar'),confidenceBar:$('confidenceBar'),
  stabilityBar:$('stabilityBar'),trackingBar:$('trackingBar'),
  poseName:$('poseName'),poseCue:$('poseCue'),poseEnergy:$('poseEnergy'),
  stabilityEnergy:$('stabilityEnergy'),controlEnergy:$('controlEnergy'),energyLabel:$('energyLabel'),
  coachIcon:$('coachIcon'),coachMain:$('coachMain'),coachSub:$('coachSub'),coachBadge:$('coachBadge'),
  countdown:$('countdown'),startOverlay:$('startOverlay'),calibrationOverlay:$('calibrationOverlay'),
  resultOverlay:$('resultOverlay'),playerName:$('playerName'),studentId:$('studentId'),classId:$('classId'),
  section:$('section'),difficulty:$('difficulty'),duration:$('duration'),showSkeleton:$('showSkeleton'),
  soundOn:$('soundOn'),safeMode:$('safeMode'),calibrationText:$('calibrationText'),calBody:$('calBody'),
  calArms:$('calArms'),calStable:$('calStable'),calibrationBar:$('calibrationBar'),
  qaPanel:$('qaPanel'),qaFps:$('qaFps'),qaThreshold:$('qaThreshold'),qaLoss:$('qaLoss'),qaAssist:$('qaAssist')
};

BH.CONFIG={
  easy:{
    hold:2200,sequence:['center','left','center','right','center'],confidence:.46,
    poseThreshold:66,safeThreshold:50,gateMs:280,graceMs:650,lostDebounceMs:950,
    assistAfterMs:6500,maxAssist:2
  },
  normal:{
    hold:2800,sequence:['center','left','center','right','center','boss'],confidence:.53,
    poseThreshold:71,safeThreshold:55,gateMs:350,graceMs:600,lostDebounceMs:900,
    assistAfterMs:7500,maxAssist:2
  },
  hard:{
    hold:3300,sequence:['center','right','center','left','right','center','boss'],confidence:.59,
    poseThreshold:76,safeThreshold:60,gateMs:420,graceMs:520,lostDebounceMs:850,
    assistAfterMs:8500,maxAssist:1
  }
};

BH.POSES={
  center:{name:'🛡️ Sky Shield',cue:'ยืนสองเท้า กางแขนระดับไหล่ และมองตรง',ghost:'center'},
  left:{name:'⭐ Star Reach • LEFT',cue:'เอื้อมไปทางซ้ายอย่างนุ่มนวล สะโพกยังอยู่ใน Safe Zone',ghost:'left'},
  right:{name:'⭐ Star Reach • RIGHT',cue:'เอื้อมไปทางขวาอย่างนุ่มนวล สะโพกยังอยู่ใน Safe Zone',ghost:'right'},
  boss:{name:'🌪️ Crystal Wind Boss',cue:'ทำท่าที่สัญญาณกำหนดและค้างให้นิ่ง แม้มีลมรบกวน',ghost:'center'}
};

const emptyAccumulator=()=>({
  trackedMs:0,validMs:0,samples:0,poseSum:0,stabilitySum:0,controlSum:0,safeSum:0,confidenceSum:0
});

BH.state={
  phase:'setup',stream:null,pose:null,looping:false,lastFrame:0,latest:null,latestAt:0,
  smooth:null,calibration:null,calValidMs:0,calHistory:[],sequence:[],index:0,currentKey:'center',
  bossKey:'left',holdMs:0,gateMs:0,timeLimit:60,timeLeft:60,startedAt:0,lastTick:0,
  pausedAt:0,score:0,results:[],lostPoseCount:0,lossActive:false,invalidSince:0,
  confidence:0,poseScore:0,stabilityScore:0,controlScore:0,safeScore:0,
  centerHistory:[],lastCenter:null,lastValidAt:0,lastLostAt:0,transitionStart:0,firstValidAt:0,
  currentLosses:0,assistLevel:0,maxAssistUsed:0,currentAccumulator:emptyAccumulator(),
  roundTrackedMs:0,roundDetectedMs:0,roundValidMs:0,roundConfidenceSum:0,roundSamples:0,
  demo:false,roundId:'',sessionId:BH.q('session',BH.q('sessionId','')),
  gameToken:0,countdownToken:0,frameCount:0,fpsAt:0,fps:0,
  ctx:{studentName:'',studentId:'',classId:'',section:'',playerId:'',teacherId:BH.q('teacherId',BH.q('teacher',''))}
};
BH.emptyAccumulator=emptyAccumulator;

BH.toast=msg=>{
  const t=$('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(BH.toast.t);BH.toast.t=setTimeout(()=>t.classList.remove('show'),1800);
};
BH.setCoach=(main,sub='',icon='🧘',badge='COACH')=>{
  BH.el.coachMain.textContent=main;BH.el.coachSub.textContent=sub;
  BH.el.coachIcon.textContent=icon;BH.el.coachBadge.textContent=badge;
};
BH.stableId=prefix=>{
  try{return prefix+'-'+crypto.randomUUID()}
  catch(_){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)}
};
BH.bangkok=()=>{
  try{return new Date().toLocaleString('sv-SE',{timeZone:'Asia/Bangkok',hour12:false}).replace(' ','T')}
  catch(_){return new Date().toISOString()}
};
BH.bridgeContext=()=>{
  try{return window.FitnessStudentContext?.get?.()||{}}
  catch(_){return {}}
};
BH.syncContext=()=>{
  const b=BH.bridgeContext(),s=BH.state,e=BH.el;
  s.ctx.studentName=(e.playerName.value||BH.q('studentName',BH.q('name',b.studentName||'Hero'))).trim();
  s.ctx.studentId=(e.studentId.value||BH.q('studentId',BH.q('sid',b.studentId||''))).trim();
  s.ctx.classId=(e.classId.value||BH.q('classId',BH.q('group',b.classId||'ป.5'))).trim();
  s.ctx.section=(e.section.value||BH.q('section',b.section||'')).trim();
  s.ctx.playerId=BH.q('playerId',BH.q('pid',b.playerId||s.ctx.studentId));
  if(!s.sessionId)s.sessionId=BH.stableId('BHSESSION');
  try{window.FitnessStudentContext?.save?.({
    studentName:s.ctx.studentName,studentId:s.ctx.studentId,classId:s.ctx.classId,
    section:s.ctx.section,playerId:s.ctx.playerId
  })}catch(_){}
};
BH.initQuery=()=>{
  const b=BH.bridgeContext(),e=BH.el;
  e.playerName.value=BH.q('studentName',BH.q('name',b.studentName||'Hero'));
  e.studentId.value=BH.q('studentId',BH.q('sid',b.studentId||''));
  e.classId.value=BH.q('classId',BH.q('group',b.classId||'ป.5'));
  e.section.value=BH.q('section',b.section||'');
  const d=BH.q('diff','normal');if(BH.CONFIG[d])e.difficulty.value=d;
  const dur=String(BH.num(BH.q('time',BH.q('duration','60')),60));
  if([...e.duration.options].some(o=>o.value===dur))e.duration.value=dur;
  if(BH.QA)e.qaPanel.classList.remove('hidden');
  BH.syncContext();
};

BH.startCamera=async({restart=false}={})=>{
  const s=BH.state,e=BH.el;
  if(restart)BH.stopCamera();
  if(s.stream)return true;
  if(!navigator.mediaDevices?.getUserMedia){
    e.status.textContent='❌ Camera API unavailable';
    BH.toast('เบราว์เซอร์นี้ไม่รองรับกล้อง กรุณาใช้ Chrome ผ่าน HTTPS');
    return false;
  }
  try{
    s.stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,min:15}},
      audio:false
    });
    e.camera.srcObject=s.stream;
    await e.camera.play();
    BH.resizeCanvas();
    const track=s.stream.getVideoTracks()[0],settings=track?.getSettings?.()||{};
    e.status.textContent=`📷 Camera ${settings.width||''}×${settings.height||''}`.trim();
    return true;
  }catch(err){
    console.warn('[BalanceHold] camera failed',err);
    e.status.textContent='⚠️ Camera blocked';
    BH.toast('เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์กล้องและลองใหม่');
    return false;
  }
};
BH.stopCamera=()=>{
  BH.state.stream?.getTracks?.().forEach(t=>t.stop());
  BH.state.stream=null;
  if(BH.el.camera)BH.el.camera.srcObject=null;
};
BH.resizeCanvas=()=>{
  const r=BH.el.stage.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  BH.el.canvas.width=Math.round(r.width*dpr);BH.el.canvas.height=Math.round(r.height*dpr);
  BH.el.canvas.style.width=r.width+'px';BH.el.canvas.style.height=r.height+'px';
};
BH.initPose=()=>{
  const s=BH.state;if(s.pose)return true;
  if(!window.Pose){BH.toast('โหลดระบบ Pose ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต');return false}
  s.pose=new Pose({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`});
  s.pose.setOptions({
    modelComplexity:1,smoothLandmarks:true,enableSegmentation:false,
    minDetectionConfidence:.55,minTrackingConfidence:.55
  });
  s.pose.onResults(BH.onPoseResults);
  return true;
};
BH.poseLoop=async()=>{
  const s=BH.state,e=BH.el;if(s.looping)return;
  s.looping=true;
  const run=async()=>{
    if(!s.looping)return;
    const t=BH.now();
    if(e.camera.readyState>=2&&s.pose&&t-s.lastFrame>42){
      s.lastFrame=t;
      try{await s.pose.send({image:e.camera})}catch(err){console.warn('[BalanceHold] pose frame failed',err)}
    }
    requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
};
BH.stopPoseLoop=()=>{BH.state.looping=false};
BH.transformed=lm=>lm.map(p=>({x:1-p.x,y:p.y,z:p.z||0,v:p.visibility??1}));
BH.smoothLandmarks=lm=>{
  const s=BH.state;
  if(!s.smooth){s.smooth=lm.map(p=>({...p}));return s.smooth}
  const a=.30;
  s.smooth=lm.map((p,i)=>({
    x:BH.lerp(s.smooth[i].x,p.x,a),y:BH.lerp(s.smooth[i].y,p.y,a),
    z:BH.lerp(s.smooth[i].z,p.z,a),v:BH.lerp(s.smooth[i].v,p.v,.45)
  }));
  return s.smooth;
};
BH.mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
BH.dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
BH.angleLine=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
BH.keyConfidence=lm=>[0,11,12,15,16,23,24,25,26,27,28].reduce((sum,i)=>sum+(lm[i]?.v||0),0)/11;
BH.poseFresh=()=>!!(BH.state.latest&&BH.now()-BH.state.latestAt<420);

BH.onPoseResults=results=>{
  const s=BH.state,t=BH.now();
  s.frameCount++;
  if(!s.fpsAt)s.fpsAt=t;
  if(t-s.fpsAt>=1000){s.fps=Math.round(s.frameCount*1000/(t-s.fpsAt));s.frameCount=0;s.fpsAt=t}
  if(!results.poseLandmarks){
    s.confidence=0;BH.drawPose(null);BH.updateQA?.();return;
  }
  const lm=BH.smoothLandmarks(BH.transformed(results.poseLandmarks));
  s.latest=lm;s.latestAt=t;s.confidence=BH.keyConfidence(lm)*100;
  BH.drawPose(lm);
  if(s.phase==='calibration')BH.updateCalibration?.(lm);
  BH.updateQA?.();
};
BH.drawPose=lm=>{
  const e=BH.el,c=e.canvas.getContext('2d'),w=e.canvas.width,h=e.canvas.height,dpr=Math.min(2,devicePixelRatio||1);
  c.clearRect(0,0,w,h);if(!lm||!e.showSkeleton.checked)return;
  c.save();c.scale(dpr,dpr);c.lineWidth=4;c.lineCap='round';
  [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]].forEach(([a,b])=>{
    if((lm[a].v||0)<.35||(lm[b].v||0)<.35)return;
    c.strokeStyle='rgba(255,255,255,.92)';c.beginPath();
    c.moveTo(lm[a].x*w/dpr,lm[a].y*h/dpr);c.lineTo(lm[b].x*w/dpr,lm[b].y*h/dpr);c.stroke();
  });
  [0,11,12,15,16,23,24,25,26,27,28].forEach(i=>{
    if((lm[i].v||0)<.35)return;
    c.fillStyle=i===15||i===16?'#fde047':'#34d399';c.beginPath();
    c.arc(lm[i].x*w/dpr,lm[i].y*h/dpr,6,0,Math.PI*2);c.fill();
  });
  c.restore();
};
BH.updateQA=()=>{
  if(!BH.QA)return;
  const s=BH.state,cfg=BH.CONFIG[BH.el.difficulty.value]||BH.CONFIG.normal;
  BH.el.qaFps.textContent=`FPS ${s.fps||'-'}`;
  BH.el.qaThreshold.textContent=`Gate ${Math.max(55,cfg.poseThreshold-s.assistLevel*3)}`;
  BH.el.qaLoss.textContent=`Lost ${s.lostPoseCount}`;
  BH.el.qaAssist.textContent=`Assist ${s.assistLevel}`;
};
})();
