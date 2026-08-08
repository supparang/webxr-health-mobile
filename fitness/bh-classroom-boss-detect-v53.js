(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;
const s=BH.state;
const RELEASE='20260808-BALANCE-CLASSROOM-BOSS-DETECT-V54-BALANCED';
const baseEvaluate=BH.evaluatePose;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const visible=(p,min=.18)=>!!p&&Number(p.v??p.visibility??0)>=min;

BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key);
  if(String(s.currentKey||'')!=='boss'||!Array.isArray(lm)||!s.calibration)return base;

  try{
    const ls=lm[11],rs=lm[12],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24],lk=lm[25],rk=lm[26];
    const upperTracked=[ls,rs,lh,rh].every(p=>visible(p,.24));
    const kneesTracked=visible(lk,.18)&&visible(rk,.18);
    if(!upperTracked){
      return {...base,valid:false,tracked:false,feedback:'ให้กล้องเห็นไหล่ สะโพก และเข่าทั้งสองให้ชัด'};
    }

    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const shoulderWidth=Math.max(.04,Math.hypot(ls.x-rs.x,ls.y-rs.y));
    const baselineX=Number(s.calibration.shoulderCenter?.x??s.calibration.center?.x??.5);
    const lean=(shoulderMid.x-baselineX)/shoulderWidth;
    const target=key==='left'?-1:1;
    const directional=target<0?clamp((-lean-.055)/.20*100):clamp((lean-.055)/.20*100);
    const armLevel=(Math.abs((lw?.y??ls.y)-ls.y)+Math.abs((rw?.y??rs.y)-rs.y))/2;
    const arms=clamp((1-armLevel/.27)*100);
    const torsoShift=clamp((1-Math.abs(hipMid.x-(s.calibration.center?.x??hipMid.x))/(shoulderWidth*.90))*100);
    const visibility=[ls,rs,lh,rh,lk,rk].filter(Boolean).reduce((sum,p)=>sum+Number(p.v??p.visibility??0),0)/6*100;
    const confidence=clamp((Number(base.confidence||0)*.65)+(visibility*.35));
    const pose=clamp(directional*.50+arms*.28+torsoShift*.22);
    const stability=clamp(Number(base.stability||0));
    const control=clamp(Number(base.control||0));
    const safe=clamp(Number(base.safe||0));
    const tracked=confidence>=45;
    const valid=tracked&&kneesTracked&&directional>=58&&arms>=54&&pose>=62&&safe>=58&&stability>=58&&control>=50;

    let feedback='ดีมาก • รักษาทิศทางและค้างให้นิ่ง';
    if(!tracked)feedback='ขยับเข้าแสงและให้เห็นไหล่–สะโพก–เข่าชัดขึ้น';
    else if(!kneesTracked)feedback='ให้เห็นเข่าทั้งสองก่อนเริ่มค้าง Boss';
    else if(directional<58)feedback=key==='left'?'เอียงช่วงไหล่ไปทางซ้ายเพิ่มอีกเล็กน้อย':'เอียงช่วงไหล่ไปทางขวาเพิ่มอีกเล็กน้อย';
    else if(arms<54)feedback='กางแขนให้ใกล้ระดับไหล่มากขึ้น';
    else if(stability<58)feedback='ท่าถูกแล้ว แต่ยังแกว่ง • ค้างให้นิ่งขึ้น';
    else if(control<50)feedback='ควบคุมไหล่และสะโพกให้นิ่ง';

    s.bossDetectProfile='grade5-balanced-direction-stability-v54';
    return {
      ...base,
      valid,tracked,confidence,pose,stability,control,safe,
      feetStable:kneesTracked&&safe>=58,
      feedback,
      threshold:62,
      safeThreshold:58,
      bossDirectionalScore:Math.round(directional),
      bossArmScore:Math.round(arms),
      bossKneesTracked:kneesTracked,
      bossRequiredStability:58,
      bossRequiredControl:50
    };
  }catch(error){
    console.warn('[BalanceHold V54] boss evaluator fallback',error);
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
        ?'กางแขนระดับไหล่ เอียงช่วงไหล่ไปทางซ้าย และค้างให้นิ่ง'
        :'กางแขนระดับไหล่ เอียงช่วงไหล่ไปทางขวา และค้างให้นิ่ง';
      BH.setCoach?.('Boss ต้องถูกทิศและนิ่งต่อเนื่อง','ให้เห็นเข่าทั้งสอง • ไม่ต้องเห็นข้อเท้า','💎','BOSS BALANCED');
    }
    return result;
  };
}

const baseSummary=BH.calcSummary;
if(typeof baseSummary==='function'){
  BH.calcSummary=reason=>{
    const x=baseSummary(reason)||{};
    x.bossDetectVersion=RELEASE;
    x.bossDetectProfile=s.bossDetectProfile||'grade5-balanced-direction-stability-v54';
    x.bossAnkleRequired=false;
    x.bossKneeRequired=true;
    x.bossPoseThreshold=62;
    x.bossStabilityThreshold=58;
    x.bossControlThreshold=50;
    return x;
  };
}

console.info('[BalanceHold] Grade 5 balanced boss detection ready',RELEASE);
})();