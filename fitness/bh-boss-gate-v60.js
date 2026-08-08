(()=>{
'use strict';
const BH=window.BH;if(!BH?.state||!BH?.el||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el;
const RELEASE='20260808-BALANCE-BOSS-GATE-V60-HARMONIZED';
const baseEvaluate=BH.evaluatePose;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const vis=(p,min=.18)=>!!p&&Number(p.v??p.visibility??0)>=min;

BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key)||{};
  if(String(s.currentKey||'')!=='boss'||!Array.isArray(lm)||!s.calibration)return base;
  try{
    const ls=lm[11],rs=lm[12],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24],lk=lm[25],rk=lm[26];
    const upperTracked=[ls,rs,lh,rh].every(p=>vis(p,.22));
    const lowerAnchor=vis(lk,.16)||vis(rk,.16);
    if(!upperTracked)return {...base,valid:false,tracked:false,feedback:'ให้กล้องเห็นไหล่และสะโพกให้ชัด'};
    if(!lowerAnchor)return {...base,valid:false,tracked:true,feedback:'ถอยออกอีกนิด ให้เห็นเข่าอย่างน้อยหนึ่งข้าง'};

    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const shoulderWidth=Math.max(.04,Math.hypot(ls.x-rs.x,ls.y-rs.y));
    const baselineX=Number(s.calibration.shoulderCenter?.x??s.calibration.center?.x??.5);
    const lean=(shoulderMid.x-baselineX)/shoulderWidth;
    const target=key==='left'?-1:1;
    const directional=target<0?clamp((-lean-.04)/.18*100):clamp((lean-.04)/.18*100);
    const armLevel=(Math.abs((lw?.y??ls.y)-ls.y)+Math.abs((rw?.y??rs.y)-rs.y))/2;
    const arms=clamp((1-armLevel/.30)*100);
    const torso=clamp((1-Math.abs(hipMid.x-(s.calibration.center?.x??hipMid.x))/(shoulderWidth*1.05))*100);
    const confidence=clamp(Number(base.confidence||0));
    const stability=clamp(Number(base.stability||0));
    const control=clamp(Number(base.control||0));
    const safe=clamp(Number(base.safe||0));
    const pose=clamp(directional*.52+arms*.28+torso*.20);

    // One coherent Grade-5 boss gate: challenging but achievable in a mobile camera crop.
    const tracked=confidence>=40;
    const valid=tracked&&directional>=50&&arms>=48&&pose>=56&&safe>=50&&stability>=52&&control>=46;
    let feedback='✅ ท่าถูกแล้ว • ค้างนิ่งต่อเพื่อเพิ่ม BOSS %';
    if(!tracked)feedback='ขยับเข้าแสงให้ระบบเห็นตัวชัดขึ้น';
    else if(directional<50)feedback=key==='left'?'⬅️ เอียงช่วงไหล่ไปทางซ้ายอีกนิด':'➡️ เอียงช่วงไหล่ไปทางขวาอีกนิด';
    else if(arms<48)feedback='กางแขนใกล้ระดับไหล่อีกนิด';
    else if(pose<56)feedback='ปรับลำตัวให้ใกล้ท่า Boss มากขึ้น';
    else if(safe<50)feedback='ประคองลำตัวให้อยู่กลาง Safe Zone';
    else if(stability<52)feedback='ทิศถูกแล้ว • ลดการแกว่งและค้างให้นิ่ง';
    else if(control<46)feedback='คุมไหล่และสะโพกให้นิ่งอีกนิด';

    return {...base,valid,tracked,confidence,pose,stability,control,safe,
      feetStable:lowerAnchor&&safe>=50,feedback,threshold:56,safeThreshold:50,
      bossDirectionalScore:Math.round(directional),bossArmScore:Math.round(arms),bossLowerAnchor:lowerAnchor,
      bossRequiredStability:52,bossRequiredControl:46,bossGateVersion:RELEASE};
  }catch(err){console.warn('[Balance V60] boss gate fallback',err);return base}
};

const baseSummary=BH.calcSummary;
if(typeof baseSummary==='function')BH.calcSummary=reason=>{const x=baseSummary(reason)||{};x.bossGateVersion=RELEASE;x.bossGateProfile='grade5-harmonized-mobile';return x};
window.BH_BOSS_GATE_V60={release:RELEASE};
console.info('[BalanceHold] Boss Gate V60 ready',RELEASE);
})();