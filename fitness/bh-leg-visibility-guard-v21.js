(()=>{
'use strict';
const BH=window.BH;if(!BH||typeof BH.evaluatePose!=='function')return;
const s=BH.state||{};
const RELEASE='20260717-BALANCE-HOLD-TEMPORAL-LEG-PROOF-V27';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inFrame=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=.01&&p.x<=.99&&p.y>=.01&&p.y<=.99;
const seen=(p,min)=>inFrame(p)&&(p.v??0)>=min;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function angle(a,b,c){
  if(!a||!b||!c)return 180;
  const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
  const den=Math.max(.0001,Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y));
  return Math.acos(clamp((ab.x*cb.x+ab.y*cb.y)/den,-1,1))*180/Math.PI;
}
function resetProof(key){
  if(s.legProofKey===key)return;
  s.legProofKey=key;s.legProofMs=0;s.legProofLast=performance.now();
}
function legEvidence(lm,key){
  const targetLeft=key==='treeRight'||key==='airplaneRight';
  const hip=lm[targetLeft?23:24],knee=lm[targetLeft?25:26],ankle=lm[targetLeft?27:28];
  const supportHip=lm[targetLeft?24:23],supportKnee=lm[targetLeft?26:25],supportAnkle=lm[targetLeft?28:27];
  const cal=s.calibration||{};
  const baseAnkle=targetLeft?cal.ankleL:cal.ankleR;
  const bodyH=Math.max(.30,cal.bodyHeight||.58);
  const shoulderW=Math.max(.10,cal.shoulderWidth||.18);
  const targetKneeAngle=angle(hip,knee,ankle);
  const supportKneeAngle=angle(supportHip,supportKnee,supportAnkle);
  const ankleRise=baseAnkle?(baseAnkle.y-ankle.y)/bodyH:0;
  const kneeRise=(supportKnee.y-knee.y)/bodyH;
  const lateralKnee=Math.abs(knee.x-supportKnee.x)/shoulderW;
  const lateralAnkle=Math.abs(ankle.x-supportAnkle.x)/shoulderW;
  const trueLift=ankleRise>=.035||kneeRise>=.045;
  const safeToeTouch=targetKneeAngle<=150&&lateralKnee>=.28&&lateralAnkle>=.16&&ankleRise>=-.025;
  const supportStable=supportKneeAngle>=148;
  return{targetLeft,trueLift,safeToeTouch,supportStable,targetKneeAngle,supportKneeAngle,ankleRise,kneeRise,lateralKnee,lateralAnkle,
    proof:(trueLift||safeToeTouch)&&supportStable};
}
const base=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=base(lm,key)||{};
  const legPose=['treeLeft','treeRight','airplaneLeft','airplaneRight'].includes(key);
  if(!legPose||!lm){s.legProofKey='';s.legProofMs=0;return r}
  resetProof(key);
  const now=performance.now(),dt=Math.min(100,Math.max(0,now-(s.legProofLast||now)));s.legProofLast=now;
  const kneesSeen=seen(lm[25],.45)&&seen(lm[26],.45);
  const targetLeft=key==='treeRight'||key==='airplaneRight';
  const targetAnkleSeen=seen(lm[targetLeft?27:28],.38);
  const supportAnkleSeen=seen(lm[targetLeft?28:27],.34);
  if(!kneesSeen){
    s.legProofMs=0;r.valid=false;r.signatureBlocked=true;r.legVisibilityBlocked=true;
    r.feedback='📷 ถอยห่างหรือปรับกล้องให้เห็นเข่าทั้งสองก่อน';
  }else if(!targetAnkleSeen||!supportAnkleSeen){
    s.legProofMs=0;r.valid=false;r.signatureBlocked=true;r.legVisibilityBlocked=true;
    r.feedback=`📷 ให้กล้องเห็นข้อเท้าทั้งสอง โดยเฉพาะข้อเท้า${targetLeft?'ซ้าย':'ขวา'}`;
  }else{
    const ev=legEvidence(lm,key);
    if(ev.proof)s.legProofMs=Math.min(900,s.legProofMs+dt);
    else s.legProofMs=Math.max(0,s.legProofMs-dt*1.8);
    const required=key.startsWith('tree')?350:420;
    if(s.legProofMs<required){
      r.valid=false;r.signatureBlocked=true;r.legProofBlocked=true;
      const side=targetLeft?'ซ้าย':'ขวา';
      if(!ev.supportStable)r.feedback=`🦵 ยืดขาข้างที่รับน้ำหนักให้มั่นคง แล้วค่อยยกขา${side}`;
      else if(!ev.trueLift&&!ev.safeToeTouch)r.feedback=`🦵 ยกเท้า${side}ให้พ้นตำแหน่งเดิม หรือแตะปลายเท้าพร้อมงอเข่าออกด้านข้าง`;
      else r.feedback=`👍 เห็นการยกขา${side}แล้ว • ค้างอีกนิดก่อนเริ่มนับ`;
    }
    r.legProofMs=Math.round(s.legProofMs);r.legEvidence=ev;
  }
  r.legVisibilityVersion=RELEASE;
  return r;
};
if(typeof BH.calcSummary==='function'){
  const baseCalc=BH.calcSummary;
  BH.calcSummary=reason=>{const x=baseCalc(reason)||{};x.legVisibilityGuardVersion=RELEASE;return x};
}
console.info('[BalanceHold] Temporal leg proof v27 ready',RELEASE);
})();