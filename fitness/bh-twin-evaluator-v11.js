(()=>{
'use strict';
const BH=window.BH,s=BH.state,e=BH.el,C=BH.clamp;

BH.calibrationQuality=lm=>{
  const conf=BH.keyConfidence(lm),sh=BH.dist(lm[11],lm[12]);
  const arms=(BH.dist(lm[11],lm[15])+BH.dist(lm[12],lm[16]))/(Math.max(.01,sh)*2);
  const armsLevel=(Math.abs(lm[15].y-lm[11].y)+Math.abs(lm[16].y-lm[12].y))/2;
  const ankleConfidence=(lm[27].v+lm[28].v)/2;
  const bounds={
    left:Math.min(...[0,11,12,15,16,23,24,27,28].map(i=>lm[i].x)),
    right:Math.max(...[0,11,12,15,16,23,24,27,28].map(i=>lm[i].x)),
    top:lm[0].y,bottom:Math.max(lm[27].y,lm[28].y)
  };
  const inFrame=bounds.left>.015&&bounds.right<.985&&bounds.top>.01&&bounds.bottom<.995;
  const bodyOk=conf>.50&&ankleConfidence>.35&&sh>.055&&inFrame;
  const armsOk=arms>.82&&armsLevel<.17;
  const center=BH.mid(lm[23],lm[24]);
  s.calHistory.push({x:center.x,y:center.y,t:BH.now()});
  if(s.calHistory.length>22)s.calHistory.shift();
  let jitter=1;
  if(s.calHistory.length>=8){
    const mean=s.calHistory.reduce((o,p)=>({x:o.x+p.x,y:o.y+p.y}),{x:0,y:0});
    mean.x/=s.calHistory.length;mean.y/=s.calHistory.length;
    jitter=Math.sqrt(s.calHistory.reduce((z,p)=>z+(p.x-mean.x)**2+(p.y-mean.y)**2,0)/s.calHistory.length);
  }
  const stable=jitter<.010;
  return{bodyOk,armsOk,stable,center,sh,conf,jitter,bounds};
};

BH.updateCalibration=lm=>{
  const q=BH.calibrationQuality(lm),cfg=BH.CONFIG[e.difficulty.value];
  const t=BH.now(),dt=Math.min(100,t-(s.calLast||t));s.calLast=t;
  e.calBody.className='calStep '+(q.bodyOk?'ok':'warn');
  e.calBody.textContent=q.bodyOk?'✅ 1. เห็นทั้งตัว':'⚠️ 1. ถอยให้เห็นศีรษะ–ข้อเท้า';
  e.calArms.className='calStep '+(q.armsOk?'ok':'warn');
  e.calArms.textContent=q.armsOk?'✅ 2. กางแขนแล้ว':'⚠️ 2. กางแขนระดับไหล่';
  e.calStable.className='calStep '+(q.stable?'ok':'warn');
  if(q.bodyOk&&q.armsOk&&q.stable&&q.conf>=cfg.confidence)s.calValidMs+=dt;
  else s.calValidMs=Math.max(0,s.calValidMs-dt*.65);
  const pct=C(s.calValidMs/1800*100,0,100);
  e.calibrationBar.style.width=pct+'%';
  e.calStable.textContent=pct>=100?'✅ 3. Calibration สำเร็จ':q.stable?`3. ค้างนิ่ง ${Math.round(pct)}%`:'⚠️ 3. ลดการขยับและค้างนิ่ง';
  e.calibrationText.textContent=!q.bodyOk?'ถอยออกเล็กน้อยและจัดให้เห็นข้อเท้าทั้งสอง':
    !q.armsOk?'กางแขนให้ใกล้ระดับไหล่':
    !q.stable?'ค้างนิ่งและมองตรง':'ดีมาก ค้างต่ออีกเล็กน้อย';
  if(pct>=100){
    const shoulderMid=BH.mid(lm[11],lm[12]),ankleMid=BH.mid(lm[27],lm[28]);
    s.calibration={
      center:q.center,shoulderCenter:shoulderMid,shoulderWidth:q.sh,
      bodyHeight:Math.max(.2,ankleMid.y-lm[0].y),
      ankleL:{...lm[27]},ankleR:{...lm[28]},
      ankleMid,ankleSpread:BH.dist(lm[27],lm[28]),ts:Date.now()
    };
    s.phase='ready';BH.startCountdown();
  }
};

BH.evaluatePose=(lm,key)=>{
  const cfg=BH.CONFIG[e.difficulty.value]||BH.CONFIG.normal;
  if(!lm||!s.calibration||!BH.poseFresh()){
    return{valid:false,tracked:false,confidence:0,pose:0,stability:0,control:0,safe:0,
      feedback:'ยังไม่เห็นทั้งตัว',feetStable:false,movementSpeed:0};
  }
  const conf=BH.keyConfidence(lm),shoulders=BH.mid(lm[11],lm[12]),hips=BH.mid(lm[23],lm[24]),
    ankles=BH.mid(lm[27],lm[28]),shW=Math.max(.04,BH.dist(lm[11],lm[12]));
  const torsoAngle=BH.angleLine(shoulders,hips),torsoTilt=Math.abs(torsoAngle-90);
  const shoulderLevel=Math.abs(lm[11].y-lm[12].y);
  const armLevel=(Math.abs(lm[15].y-lm[11].y)+Math.abs(lm[16].y-lm[12].y))/2;
  const leftExt=(lm[11].x-lm[15].x)/shW,rightExt=(lm[16].x-lm[12].x)/shW;
  const hipShift=(hips.x-s.calibration.center.x)/Math.max(.05,s.calibration.shoulderWidth);
  const shoulderShift=(shoulders.x-s.calibration.shoulderCenter.x)/Math.max(.05,s.calibration.shoulderWidth);
  const ankleShift=BH.dist(ankles,s.calibration.ankleMid)/Math.max(.05,s.calibration.shoulderWidth);
  const feetSpread=BH.dist(lm[27],lm[28]),baseSpread=Math.max(.05,s.calibration.ankleSpread);
  const feetStable=ankleShift<.58&&feetSpread<baseSpread*1.85&&feetSpread>baseSpread*.38&&lm[27].v>.32&&lm[28].v>.32;
  const tracked=conf>=Math.max(.35,cfg.confidence-.12);

  let c=[];
  if(key==='center'){
    c=[
      C(1-armLevel/.18,0,1),C((leftExt-.52)/.48,0,1),C((rightExt-.52)/.48,0,1),
      C(1-torsoTilt/18,0,1),C(1-shoulderLevel/.10,0,1),C(1-Math.abs(shoulderShift)/.48,0,1)
    ];
  }else if(key==='left'){
    c=[
      C((leftExt-.74)/.58,0,1),C((-.10-shoulderShift)/.82,0,1),
      C(1-Math.abs(hipShift)/.78,0,1),C(1-armLevel/.30,0,1),
      C(1-torsoTilt/29,0,1),C(1-shoulderLevel/.15,0,1)
    ];
  }else{
    c=[
      C((rightExt-.74)/.58,0,1),C((shoulderShift-.10)/.82,0,1),
      C(1-Math.abs(hipShift)/.78,0,1),C(1-armLevel/.30,0,1),
      C(1-torsoTilt/29,0,1),C(1-shoulderLevel/.15,0,1)
    ];
  }

  const pose=c.reduce((a,b)=>a+b,0)/c.length*100,center={x:shoulders.x,y:shoulders.y};
  s.centerHistory.push({x:center.x,y:center.y,t:BH.now()});
  if(s.centerHistory.length>20)s.centerHistory.shift();
  let jitter=.05;
  if(s.centerHistory.length>4){
    const mean=s.centerHistory.reduce((o,p)=>({x:o.x+p.x,y:o.y+p.y}),{x:0,y:0});
    mean.x/=s.centerHistory.length;mean.y/=s.centerHistory.length;
    jitter=Math.sqrt(s.centerHistory.reduce((z,p)=>z+(p.x-mean.x)**2+(p.y-mean.y)**2,0)/s.centerHistory.length);
  }
  const stability=C(100-jitter*1650,0,100);
  let speed=0;
  if(s.lastCenter)speed=BH.dist(center,s.lastCenter)/Math.max(.016,(BH.now()-s.lastCenter.t)/1000);
  s.lastCenter={...center,t:BH.now()};
  const control=C(100-speed*155,0,100);
  const safe=feetStable?C(100-Math.abs(hipShift)*48-ankleShift*28,0,100):22;
  const threshold=Math.max(58,cfg.poseThreshold-s.assistLevel*3);
  const safeThreshold=Math.max(48,cfg.safeThreshold-s.assistLevel*2);
  const valid=tracked&&conf>=cfg.confidence&&pose>=threshold&&safe>=safeThreshold;

  let feedback='ยอดเยี่ยม ค้างไว้';
  if(!tracked||conf<cfg.confidence)feedback='ถอยให้กล้องเห็นทั้งตัวและเพิ่มแสงด้านหน้า';
  else if(!feetStable)feedback='วางเท้าทั้งสองให้อยู่ใน Safe Zone';
  else if(armLevel>.24)feedback='ยกแขนให้อยู่ระดับไหล่มากขึ้น';
  else if(key==='center'&&Math.abs(shoulderShift)>.32)feedback='กลับเข้ากึ่งกลางอีกนิด';
  else if(key==='left'&&shoulderShift>-.10)feedback='เอื้อมไปทางซ้ายอีกนิด';
  else if(key==='right'&&shoulderShift<.10)feedback='เอื้อมไปทางขวาอีกนิด';
  else if(stability<60)feedback='ขยับช้าลงและหายใจนิ่ง ๆ';
  else if(pose<threshold)feedback='ปรับแขนและลำตัวให้ใกล้เงาท่ามากขึ้น';

  return{valid,tracked,confidence:conf*100,pose,stability,control,safe,feedback,feetStable,movementSpeed:speed,threshold,safeThreshold};
};

BH.demoEvaluation=(key,t)=>{
  const x=(Math.sin(t/700)+1)/2;
  return{valid:x>.16,tracked:true,confidence:100,pose:76+x*24,stability:74+x*24,
    control:80+x*18,safe:100,feedback:'Demo Mode • ทำท่าตามเงา',feetStable:true,movementSpeed:.02,
    threshold:60,safeThreshold:50};
};
})();
