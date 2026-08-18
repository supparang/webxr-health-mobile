(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||typeof BH.evaluatePose!=='function')return;
const s=BH.state;
const RELEASE='20260818-BALANCE-BOSS-GRADE5-FAIR-V3-GEOMETRY';
const baseEvaluate=BH.evaluatePose;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const vis=(p,min=.16)=>!!p&&Number(p.v??p.visibility??0)>=min;
const FLOOR={confidence:30,directional:40,arms:35,safe:38,stability:38,control:35};

BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key)||{};
  if(String(s.currentKey||'')!=='boss'||!Array.isArray(lm))return base;
  try{
    const ls=lm[11],rs=lm[12],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24];
    const upperTracked=[ls,rs,lh,rh].every(p=>vis(p,.18));
    if(!upperTracked){
      return {...base,valid:false,tracked:false,feedback:'ให้กล้องเห็นไหล่และสะโพกทั้งสองข้างให้ชัด'};
    }
    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const shoulderWidth=Math.max(.035,Math.hypot(ls.x-rs.x,ls.y-rs.y));
    const baselineX=Number(s.calibration?.shoulderCenter?.x??s.calibration?.center?.x??.5);
    const lean=(shoulderMid.x-baselineX)/shoulderWidth;
    const dir=String(s.bossKey||key||'right').toLowerCase();
    const targetLeft=dir.includes('left');
    const signed=targetLeft?-lean:lean;
    // Grade-5 mobile rule: a small but clear lean in the requested direction is enough.
    const directional=clamp((signed-.015)/.12*100);
    const armErr=(Math.abs((lw?.y??ls.y)-ls.y)+Math.abs((rw?.y??rs.y)-rs.y))/2;
    const arms=clamp((1-armErr/.38)*100);
    const torsoAlignment=clamp((1-Math.abs(shoulderMid.x-hipMid.x)/(shoulderWidth*.95))*100);
    const visibility=[ls,rs,lh,rh,lw,rw].filter(Boolean).reduce((sum,p)=>sum+Number(p.v??p.visibility??0),0)/6*100;
    const confidence=clamp(Math.max(Number(base.confidence||0),visibility*.72));
    const stability=clamp(Number(base.stability??s.stabilityScore??0));
    const control=clamp(Number(base.control??s.controlScore??0));
    const safe=clamp(Math.max(Number(base.safe||0),torsoAlignment*.78));
    const pose=clamp(directional*.55+arms*.30+torsoAlignment*.15);
    const tracked=confidence>=FLOOR.confidence;
    const valid=tracked&&directional>=FLOOR.directional&&arms>=FLOOR.arms&&safe>=FLOOR.safe&&stability>=FLOOR.stability&&control>=FLOOR.control;

    let feedback='✅ ท่าถูกแล้ว • ค้างให้นิ่งจนวงกลมเต็ม';
    if(!tracked)feedback='ขยับเข้าแสงและให้เห็นไหล่–สะโพกชัดขึ้น';
    else if(directional<FLOOR.directional)feedback=targetLeft?'เอียงช่วงไหล่ไปทางซ้ายอีกเล็กน้อย':'เอียงช่วงไหล่ไปทางขวาอีกเล็กน้อย';
    else if(arms<FLOOR.arms)feedback='กางแขนให้อยู่ใกล้ระดับไหล่มากขึ้น';
    else if(safe<FLOOR.safe)feedback='ขยับลำตัวกลับเข้ากลางภาพอีกนิด';
    else if(stability<FLOOR.stability)feedback='ท่าถูกแล้ว • ค้างให้นิ่งอีกนิด';
    else if(control<FLOOR.control)feedback='ขยับช้าลง แล้วค้างไหล่กับสะโพกให้นิ่ง';

    return {...base,valid,tracked,confidence,pose,stability,control,safe,
      feedback,threshold:FLOOR.directional,safeThreshold:FLOOR.safe,
      bossGrade5FairV3:true,bossGrade5FairV3Release:RELEASE,
      bossDirectionalScore:Math.round(directional),bossArmScore:Math.round(arms),
      bossTorsoAlignment:Math.round(torsoAlignment),bossKneeRequired:false,
      bossRequiredDirectional:FLOOR.directional,bossRequiredArms:FLOOR.arms,
      bossRequiredStability:FLOOR.stability,bossRequiredControl:FLOOR.control,
      bossRequiredConfidence:FLOOR.confidence};
  }catch(error){
    console.warn('[BalanceHold V3] boss geometry fallback',error);
    return base;
  }
};
window.HH_BALANCE_BOSS_GRADE5_FAIR_V3={release:RELEASE,floors:{...FLOOR},completionPolicy:'strict-6of6',kneeRequired:false};
console.info('[BalanceHold] Grade 5 Boss Fair V3 geometry ready',window.HH_BALANCE_BOSS_GRADE5_FAIR_V3);
})();