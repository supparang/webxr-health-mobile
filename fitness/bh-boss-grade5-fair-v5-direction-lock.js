(()=>{
'use strict';
if(window.HH_BALANCE_BOSS_GRADE5_FAIR_V5?.active){
  console.info('[BalanceHold] Boss Fair V5 direction lock already active');
  return;
}
const BH=window.BH;
if(!BH||!BH.state||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el||{};
const RELEASE='20260819-BALANCE-BOSS-GRADE5-FAIR-V5-DIRECTION-LOCK';
const baseEvaluate=BH.evaluatePose;
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const vis=(p,min=.14)=>!!p&&Number(p.v??p.visibility??0)>=min;
const FLOOR={confidence:28,directional:34,arms:30,safe:34,stability:34,control:32};
function isMirrored(){
  try{
    const node=e.camera||document.querySelector('video');
    const tr=node?getComputedStyle(node).transform:'';
    return /matrix\(-1[,\s]/.test(tr)||String(node?.style?.transform||'').includes('scaleX(-1)');
  }catch(_){return false}
}
BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key)||{};
  if(String(s.currentKey||'')!=='boss'||!Array.isArray(lm))return base;
  try{
    const ls=lm[11],rs=lm[12],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24];
    const upperTracked=[ls,rs,lh,rh].every(p=>vis(p,.14));
    if(!upperTracked)return {...base,valid:false,tracked:false,feedback:'ให้กล้องเห็นไหล่และสะโพกทั้งสองข้างให้ชัด',bossDirectionMatch:false};

    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const shoulderWidth=Math.max(.035,Math.hypot(ls.x-rs.x,ls.y-rs.y));
    const torsoLean=(shoulderMid.x-hipMid.x)/shoulderWidth;
    const dir=String(s.bossKey||key||'right').toLowerCase();
    const targetLeft=dir.includes('left');
    let expectedSign=targetLeft?-1:1;
    if(isMirrored())expectedSign*=-1;
    const signedLean=torsoLean*expectedSign;

    // Direction lock: only the instructed side can earn directional score.
    // Opposite-side lean always scores 0, even if the lean magnitude is large.
    const directionMatch=signedLean>0.005;
    const directional=directionMatch?clamp((signedLean-.005)/.095*100):0;

    const wristsVisible=vis(lw,.10)&&vis(rw,.10);
    const armErr=wristsVisible?(Math.abs(lw.y-ls.y)+Math.abs(rw.y-rs.y))/2:.12;
    const arms=clamp((1-armErr/.42)*100);
    const torsoCenter=Math.abs(hipMid.x-.5);
    const safeGeometry=clamp((1-torsoCenter/.42)*100);
    const visibility=[ls,rs,lh,rh,lw,rw].filter(Boolean).reduce((sum,p)=>sum+Number(p.v??p.visibility??0),0)/6*100;
    const confidence=clamp(Math.max(Number(base.confidence||0),visibility*.78));
    const stability=clamp(Math.max(Number(base.stability||0),Number(s.stabilityScore||0)));
    const control=clamp(Math.max(Number(base.control||0),Number(s.controlScore||0)));
    const safe=clamp(Math.max(Number(base.safe||0),safeGeometry));
    const pose=clamp(directional*.58+arms*.30+safeGeometry*.12);
    const tracked=confidence>=FLOOR.confidence;
    const valid=tracked&&directionMatch&&directional>=FLOOR.directional&&arms>=FLOOR.arms&&safe>=FLOOR.safe&&stability>=FLOOR.stability&&control>=FLOOR.control;

    let feedback='✅ ท่าถูกแล้ว • ค้างให้นิ่งจนวงกลมเต็ม';
    if(!tracked)feedback='ขยับเข้าแสงและให้เห็นไหล่–สะโพกชัดขึ้น';
    else if(!directionMatch||directional<FLOOR.directional)feedback=targetLeft?'เอียงช่วงลำตัวไปทางซ้ายตามคำสั่ง':'เอียงช่วงลำตัวไปทางขวาตามคำสั่ง';
    else if(arms<FLOOR.arms)feedback='กางแขนให้อยู่ใกล้ระดับไหล่มากขึ้น';
    else if(safe<FLOOR.safe)feedback='ขยับกลับเข้ากลางภาพอีกนิด';
    else if(stability<FLOOR.stability)feedback='ท่าถูกแล้ว • ค้างให้นิ่งอีกนิด';
    else if(control<FLOOR.control)feedback='ขยับช้าลง แล้วค้างให้นิ่ง';

    return {...base,valid,tracked,confidence,pose,stability,control,safe,feedback,
      threshold:FLOOR.directional,safeThreshold:FLOOR.safe,
      bossGrade5FairV5:true,bossGrade5FairV5Release:RELEASE,
      bossInstructionDirection:targetLeft?'left':'right',bossDirectionMatch:directionMatch,
      bossDirectionalScore:Math.round(directional),bossTorsoLean:Number(torsoLean.toFixed(3)),
      bossSignedLean:Number(signedLean.toFixed(3)),bossArmScore:Math.round(arms),bossKneeRequired:false,
      bossRequiredDirectional:FLOOR.directional,bossRequiredArms:FLOOR.arms,
      bossRequiredStability:FLOOR.stability,bossRequiredControl:FLOOR.control,
      bossRequiredConfidence:FLOOR.confidence};
  }catch(error){
    console.warn('[BalanceHold V5] boss direction-lock fallback',error);
    return {...base,valid:false,bossDirectionMatch:false};
  }
};
window.HH_BALANCE_BOSS_GRADE5_FAIR_V5={release:RELEASE,active:true,floors:{...FLOOR},completionPolicy:'strict-6of6',kneeRequired:false,geometry:'shoulder-vs-hip',directionPolicy:'must-match-spoken-instruction'};
console.info('[BalanceHold] Grade 5 Boss Fair V5 direction lock ready',window.HH_BALANCE_BOSS_GRADE5_FAIR_V5);
})();