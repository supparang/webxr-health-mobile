(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;
const s=BH.state;
const RELEASE='20260731-BALANCE-CLASSROOM-BOSS-DETECT-V53';
const baseEvaluate=BH.evaluatePose;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const visible=(p,min=.18)=>!!p&&Number(p.v??p.visibility??0)>=min;

BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key);
  if(String(s.currentKey||'')!=='boss'||!Array.isArray(lm)||!s.calibration)return base;

  try{
    const ls=lm[11],rs=lm[12],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24],lk=lm[25],rk=lm[26];
    const upperTracked=[ls,rs,lh,rh].every(p=>visible(p,.18));
    const kneesTracked=visible(lk,.12)&&visible(rk,.12);
    if(!upperTracked){
      return {...base,valid:false,tracked:false,feedback:'ให้กล้องเห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง'};
    }

    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const shoulderWidth=Math.max(.04,Math.hypot(ls.x-rs.x,ls.y-rs.y));
    const baselineX=Number(s.calibration.shoulderCenter?.x??s.calibration.center?.x??.5);
    const lean=(shoulderMid.x-baselineX)/shoulderWidth;
    const target=key==='left'?-1:1;
    const directional=target<0?clamp((-lean-.035)/.22*100):clamp((lean-.035)/.22*100);
    const armLevel=(Math.abs((lw?.y??ls.y)-ls.y)+Math.abs((rw?.y??rs.y)-rs.y))/2;
    const arms=clamp((1-armLevel/.34)*100);
    const torsoShift=clamp((1-Math.abs(hipMid.x-(s.calibration.center?.x??hipMid.x))/(shoulderWidth*1.05))*100);
    const confidence=clamp(Math.max(Number(base.confidence||0),[ls,rs,lh,rh,lk,rk].filter(Boolean).reduce((sum,p)=>sum+Number(p.v??p.visibility??0),0)/6*100));
    const pose=clamp(directional*.48+arms*.27+torsoShift*.25);
    const stability=clamp(Math.max(Number(base.stability||0),58));
    const control=clamp(Math.max(Number(base.control||0),58));
    const safe=kneesTracked?clamp(Math.max(Number(base.safe||0),72)):clamp(Math.max(Number(base.safe||0),55));
    const tracked=confidence>=32;
    const valid=tracked&&directional>=42&&arms>=42&&pose>=50&&safe>=50;

    let feedback='ดีมาก ค้างไว้อีกนิด';
    if(!tracked)feedback='ขยับเข้าแสงและให้เห็นไหล่–สะโพก–เข่า';
    else if(directional<42)feedback=key==='left'?'เอียงช่วงไหล่ไปทางซ้ายเพียงเล็กน้อย':'เอียงช่วงไหล่ไปทางขวาเพียงเล็กน้อย';
    else if(arms<42)feedback='กางแขนพอสบาย ไม่ต้องยกสูงมาก';
    else if(!kneesTracked)feedback='ให้เห็นเข่าทั้งสองบางส่วนก็พอ ไม่ต้องเห็นข้อเท้า';

    s.bossDetectProfile='close-range-upper-body-knee-v53';
    return {
      ...base,
      valid,tracked,confidence,pose,stability,control,safe,
      feetStable:true,
      feedback,
      threshold:50,
      safeThreshold:50,
      bossDirectionalScore:Math.round(directional),
      bossArmScore:Math.round(arms),
      bossKneesTracked:kneesTracked
    };
  }catch(error){
    console.warn('[BalanceHold V53] boss evaluator fallback',error);
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
        ?'กางแขน แล้วเอียงช่วงไหล่ไปทางซ้ายเล็กน้อย ไม่ต้องยกเท้า'
        :'กางแขน แล้วเอียงช่วงไหล่ไปทางขวาเล็กน้อย ไม่ต้องยกเท้า';
      BH.setCoach?.('เอียงเพียงเล็กน้อยและค้างให้นิ่ง','ใช้ไหล่–สะโพก–เข่า ไม่บังคับเห็นข้อเท้า','💎','BOSS EASY');
    }
    return result;
  };
}

const baseSummary=BH.calcSummary;
if(typeof baseSummary==='function'){
  BH.calcSummary=reason=>{
    const x=baseSummary(reason)||{};
    x.bossDetectVersion=RELEASE;
    x.bossDetectProfile=s.bossDetectProfile||'close-range-upper-body-knee-v53';
    x.bossAnkleRequired=false;
    x.bossPoseThreshold=50;
    return x;
  };
}

console.info('[BalanceHold] Easier close-range boss detection ready',RELEASE);
})();