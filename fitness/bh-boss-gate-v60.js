(()=>{
'use strict';
const BH=window.BH;if(!BH?.state||!BH?.el||typeof BH.evaluatePose!=='function')return;
const s=BH.state;
const RELEASE='20260808-BALANCE-BOSS-GATE-V63-MOBILE-CROP-AWARE';
const baseEvaluate=BH.evaluatePose;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const vis=(p,min=.16)=>!!p&&Number(p.v??p.visibility??0)>=min;
const visibility=p=>clamp(Number(p?.v??p?.visibility??0)*100);

BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key)||{};
  if(String(s.currentKey||'')!=='boss'||!Array.isArray(lm)||!s.calibration)return base;
  try{
    const ls=lm[11],rs=lm[12],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24],lk=lm[25],rk=lm[26];
    const upperTracked=[ls,rs,lh,rh].every(p=>vis(p,.20));
    const kneeVis=Math.max(visibility(lk),visibility(rk));
    const lowerAnchor=kneeVis>=16;
    if(!upperTracked)return {...base,valid:false,tracked:false,feedback:'ให้กล้องเห็นไหล่และสะโพกให้ชัด',bossGateVersion:RELEASE};
    if(!lowerAnchor)return {...base,valid:false,tracked:true,feedback:'ถอยออกอีกนิด ให้เห็นเข่าอย่างน้อยหนึ่งข้าง',bossGateVersion:RELEASE};

    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const shoulderWidth=Math.max(.04,Math.hypot(ls.x-rs.x,ls.y-rs.y));
    const baselineX=Number(s.calibration.shoulderCenter?.x??s.calibration.center?.x??.5);
    const centerX=Number(s.calibration.center?.x??hipMid.x);
    const lean=(shoulderMid.x-baselineX)/shoulderWidth;
    const target=key==='left'?-1:1;
    const directional=target<0?clamp((-lean-.035)/.18*100):clamp((lean-.035)/.18*100);

    // Wrists are useful when visible, but are not required in a portrait/mobile crop.
    const leftArmVisible=vis(lw,.12),rightArmVisible=vis(rw,.12);
    const armParts=[];
    if(leftArmVisible)armParts.push(clamp((1-Math.abs(lw.y-ls.y)/.30)*100));
    if(rightArmVisible)armParts.push(clamp((1-Math.abs(rw.y-rs.y)/.30)*100));
    const arms=armParts.length?armParts.reduce((a,b)=>a+b,0)/armParts.length:58;

    const hipShift=Math.abs(hipMid.x-centerX)/shoulderWidth;
    const bossSafe=clamp(100-hipShift*62);
    const torso=clamp(100-hipShift*48);
    const requiredLandmarkConfidence=(visibility(ls)+visibility(rs)+visibility(lh)+visibility(rh)+kneeVis)/5;
    const confidence=clamp(requiredLandmarkConfidence);
    const stability=clamp(Number(base.stability||s.stabilityScore||0));
    const control=clamp(Number(base.control||s.controlScore||0));
    const pose=clamp(directional*.55+arms*.25+torso*.20);

    const tracked=confidence>=36;
    const valid=tracked&&directional>=48&&arms>=42&&pose>=54&&bossSafe>=48&&stability>=48&&control>=42;
    let feedback='✅ ท่าถูกแล้ว • ค้างนิ่งต่อเพื่อเพิ่ม BOSS %';
    if(!tracked)feedback='ขยับเข้าแสงให้เห็นไหล่–สะโพก–เข่าชัดขึ้น';
    else if(directional<48)feedback=key==='left'?'⬅️ เอียงช่วงไหล่ไปทางซ้ายอีกนิด':'➡️ เอียงช่วงไหล่ไปทางขวาอีกนิด';
    else if(arms<42)feedback='กางแขนที่มองเห็นให้อยู่ใกล้ระดับไหล่';
    else if(pose<54)feedback='ปรับลำตัวให้ใกล้ท่า Boss มากขึ้น';
    else if(bossSafe<48)feedback='ประคองสะโพกให้อยู่ใกล้กึ่งกลาง';
    else if(stability<48)feedback='ทิศถูกแล้ว • ลดการแกว่งและค้างให้นิ่ง';
    else if(control<42)feedback='คุมไหล่และสะโพกให้นิ่งอีกนิด';

    return {...base,valid,tracked,confidence,pose,stability,control,safe:bossSafe,
      feetStable:lowerAnchor&&bossSafe>=48,feedback,threshold:54,safeThreshold:48,
      bossDirectionalScore:Math.round(directional),bossArmScore:Math.round(arms),bossLowerAnchor:lowerAnchor,
      bossRequiredLandmarkConfidence:Math.round(requiredLandmarkConfidence),bossSafeScore:Math.round(bossSafe),
      bossRequiredStability:48,bossRequiredControl:42,bossGateVersion:RELEASE};
  }catch(err){console.warn('[Balance V63] boss gate fallback',err);return base}
};
if(typeof BH.calcSummary==='function'){const baseSummary=BH.calcSummary;BH.calcSummary=reason=>{const x=baseSummary(reason)||{};x.bossGateVersion=RELEASE;x.bossGateProfile='grade5-mobile-crop-required-landmarks-only';return x}}
window.BH_BOSS_GATE_V60={release:RELEASE,profile:'mobile-crop-aware'};
document.documentElement.dataset.bhBossGate='v63';
console.info('[BalanceHold] Boss Gate V63 ready',RELEASE);
})();