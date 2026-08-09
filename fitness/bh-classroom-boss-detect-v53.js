(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;
const s=BH.state;
const RELEASE='20260809-BALANCE-CLASSROOM-BOSS-DETECT-V55-FAIR';
const baseEvaluate=BH.evaluatePose;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const visible=(p,min=.18)=>!!p&&Number(p.v??p.visibility??0)>=min;

const THRESHOLDS={
  confidence:43,
  directional:52,
  arms:50,
  pose:58,
  safe:54,
  stability:54,
  control:48
};

BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key);
  if(String(s.currentKey||'')!=='boss'||!Array.isArray(lm)||!s.calibration)return base;

  try{
    const ls=lm[11],rs=lm[12],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24],lk=lm[25],rk=lm[26];
    const upperTracked=[ls,rs,lh,rh].every(p=>visible(p,.22));
    const kneesTracked=visible(lk,.16)&&visible(rk,.16);
    if(!upperTracked){
      return {...base,valid:false,tracked:false,feedback:'ให้กล้องเห็นไหล่ สะโพก และเข่าทั้งสองให้ชัด'};
    }

    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const shoulderWidth=Math.max(.04,Math.hypot(ls.x-rs.x,ls.y-rs.y));
    const baselineX=Number(s.calibration.shoulderCenter?.x??s.calibration.center?.x??.5);
    const lean=(shoulderMid.x-baselineX)/shoulderWidth;
    const target=key==='left'?-1:1;
    const directional=target<0?clamp((-lean-.045)/.20*100):clamp((lean-.045)/.20*100);
    const armLevel=(Math.abs((lw?.y??ls.y)-ls.y)+Math.abs((rw?.y??rs.y)-rs.y))/2;
    const arms=clamp((1-armLevel/.30)*100);
    const torsoShift=clamp((1-Math.abs(hipMid.x-(s.calibration.center?.x??hipMid.x))/(shoulderWidth*.96))*100);
    const visibility=[ls,rs,lh,rh,lk,rk].filter(Boolean).reduce((sum,p)=>sum+Number(p.v??p.visibility??0),0)/6*100;
    const confidence=clamp((Number(base.confidence||0)*.65)+(visibility*.35));
    const pose=clamp(directional*.48+arms*.30+torsoShift*.22);
    const stability=clamp(Number(base.stability||0));
    const control=clamp(Number(base.control||0));
    const safe=clamp(Number(base.safe||0));
    const tracked=confidence>=THRESHOLDS.confidence;
    const valid=tracked&&kneesTracked&&directional>=THRESHOLDS.directional&&arms>=THRESHOLDS.arms&&pose>=THRESHOLDS.pose&&safe>=THRESHOLDS.safe&&stability>=THRESHOLDS.stability&&control>=THRESHOLDS.control;

    let feedback='ดีมาก • รักษาทิศทางและค้างให้นิ่ง';
    if(!tracked)feedback='ขยับเข้าแสงและให้เห็นไหล่–สะโพก–เข่าชัดขึ้น';
    else if(!kneesTracked)feedback='ให้เห็นเข่าทั้งสองก่อนเริ่มค้าง Boss';
    else if(directional<THRESHOLDS.directional)feedback=key==='left'?'เอียงช่วงไหล่ไปทางซ้ายเพิ่มอีกเล็กน้อย':'เอียงช่วงไหล่ไปทางขวาเพิ่มอีกเล็กน้อย';
    else if(arms<THRESHOLDS.arms)feedback='กางแขนให้ใกล้ระดับไหล่มากขึ้น';
    else if(safe<THRESHOLDS.safe)feedback='ขยับลำตัวกลับเข้า Safe Zone อีกนิด';
    else if(stability<THRESHOLDS.stability)feedback='ท่าถูกแล้ว • ค้างให้นิ่งอีกนิด';
    else if(control<THRESHOLDS.control)feedback='ควบคุมไหล่และสะโพกให้นิ่ง';

    s.bossDetectProfile='grade5-fair-direction-stability-v55';
    return {
      ...base,
      valid,tracked,confidence,pose,stability,control,safe,
      feetStable:kneesTracked&&safe>=THRESHOLDS.safe,
      feedback,
      threshold:THRESHOLDS.pose,
      safeThreshold:THRESHOLDS.safe,
      bossDirectionalScore:Math.round(directional),
      bossArmScore:Math.round(arms),
      bossKneesTracked:kneesTracked,
      bossRequiredDirectional:THRESHOLDS.directional,
      bossRequiredArms:THRESHOLDS.arms,
      bossRequiredStability:THRESHOLDS.stability,
      bossRequiredControl:THRESHOLDS.control,
      bossRequiredConfidence:THRESHOLDS.confidence
    };
  }catch(error){
    console.warn('[BalanceHold V55] boss evaluator fallback',error);
    return base;
  }
};

const baseSetPoseUI=BH.setPoseUI;
if(typeof baseSetPoseUI==='function'){
  BH.setPoseUI=()=>{
    const result=baseSetPoseUI();
    if(String(s.currentKey||'')==='boss'){
      const direction=typeof BH.currentPoseKey==='function'?BH.currentPoseKey():s.bossKey;
      if(BH.el.poseCue)BH.el.poseCue.textContent=direction==='left'
        ?'กางแขนระดับไหล่ เอียงไหล่ไปทางซ้ายเล็กน้อย แล้วค้างให้นิ่ง'
        :'กางแขนระดับไหล่ เอียงไหล่ไปทางขวาเล็กน้อย แล้วค้างให้นิ่ง';
      BH.setCoach?.('Boss: ถูกทิศ + แขนระดับไหล่ + ค้างให้นิ่ง','ให้เห็นเข่าทั้งสอง • ไม่ต้องเห็นข้อเท้า','💎','BOSS');
    }
    return result;
  };
}

const baseSummary=BH.calcSummary;
if(typeof baseSummary==='function'){
  BH.calcSummary=reason=>{
    const x=baseSummary(reason)||{};
    x.bossDetectVersion=RELEASE;
    x.bossDetectProfile=s.bossDetectProfile||'grade5-fair-direction-stability-v55';
    x.bossAnkleRequired=false;
    x.bossKneeRequired=true;
    x.bossPoseThreshold=THRESHOLDS.pose;
    x.bossSafeThreshold=THRESHOLDS.safe;
    x.bossStabilityThreshold=THRESHOLDS.stability;
    x.bossControlThreshold=THRESHOLDS.control;
    x.bossDirectionalThreshold=THRESHOLDS.directional;
    x.bossArmThreshold=THRESHOLDS.arms;
    return x;
  };
}

window.HH_BALANCE_BOSS_DETECT_V55={release:RELEASE,thresholds:{...THRESHOLDS}};
console.info('[BalanceHold] Grade 5 fair boss detection ready',window.HH_BALANCE_BOSS_DETECT_V55);
})();