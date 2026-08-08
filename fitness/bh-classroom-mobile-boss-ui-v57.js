(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el;
const RELEASE='20260808-BALANCE-MOBILE-BOSS-UI-V57';

function installStyle(){
  if(document.getElementById('bhMobileBossUiV57Style'))return;
  const style=document.createElement('style');
  style.id='bhMobileBossUiV57Style';
  style.textContent=`
  body.bh-classroom-stable .poseBanner{pointer-events:none!important}
  body.bh-classroom-stable #bhBossProgressV57{display:none}
  @media(max-width:760px){
    body.bh-classroom-stable .hud{top:6px!important;left:6px!important;right:6px!important;gap:4px!important}
    body.bh-classroom-stable .hudCard{padding:5px 7px!important;border-radius:12px!important}
    body.bh-classroom-stable .hudCard small{font-size:9px!important}
    body.bh-classroom-stable .hudCard b{font-size:15px!important}
    body.bh-classroom-stable .poseBanner{top:67px!important;width:calc(100% - 12px)!important}
    body.bh-classroom-stable .poseName{max-width:100%!important;padding:6px 10px!important;border-radius:13px!important;font-size:14px!important;line-height:1.15!important;background:rgba(2,6,23,.72)!important;color:#fff!important;box-shadow:0 3px 14px rgba(0,0,0,.28)!important}
    body.bh-classroom-stable .poseCue{display:block!important;width:max-content!important;max-width:96%!important;margin:3px auto 0!important;padding:3px 7px!important;border-radius:9px!important;background:rgba(2,6,23,.52)!important;font-size:10.5px!important;line-height:1.2!important;white-space:normal!important;text-shadow:none!important}
    body.bh-classroom-stable .energy{display:none!important}
    body.bh-classroom-stable .coach{left:6px!important;right:6px!important;bottom:calc(5px + env(safe-area-inset-bottom,0px))!important;transform:none!important;width:auto!important;min-height:48px!important;padding:6px 8px!important;border-radius:14px!important;grid-template-columns:32px 1fr!important;gap:7px!important;background:rgba(255,255,255,.88)!important;backdrop-filter:blur(8px)!important}
    body.bh-classroom-stable .coachIcon{width:32px!important;height:32px!important;font-size:17px!important}
    body.bh-classroom-stable .coachText{font-size:11px!important;line-height:1.15!important;color:#0f172a!important}
    body.bh-classroom-stable .coachText small{display:none!important}
    body.bh-classroom-stable .coachBadge{display:none!important}
    body.bh-classroom-stable .holdRing{width:132px!important;height:132px!important}
    body.bh-classroom-stable .holdRing:after{width:104px!important;height:104px!important}
    body.bh-classroom-stable .holdText{font-size:20px!important}
    body.bh-classroom-stable #bhBossProgressV57{position:absolute;z-index:32;left:50%;top:calc(50% + 78px);transform:translateX(-50%);min-width:164px;max-width:82vw;padding:7px 10px;border-radius:14px;background:rgba(2,6,23,.82);border:2px solid rgba(250,204,21,.88);color:#fff;text-align:center;font-weight:1000;box-shadow:0 5px 20px rgba(0,0,0,.34);pointer-events:none}
    body.bh-classroom-stable #bhBossProgressV57 strong{display:block;font-size:19px;line-height:1;color:#fde047}
    body.bh-classroom-stable #bhBossProgressV57 span{display:block;margin-top:3px;font-size:10px;line-height:1.2;color:#e2e8f0}
    body.bh-classroom-stable.bh-boss-active #bhBossProgressV57{display:block}
    body.bh-classroom-stable.bh-boss-active .holdText{font-size:17px!important}
  }
  `;
  document.head.appendChild(style);
}

function bossKey(){
  try{return typeof BH.currentPoseKey==='function'?BH.currentPoseKey():s.bossKey}catch(_){return s.bossKey||'left'}
}
function directionThai(){return bossKey()==='right'?'ขวา':'ซ้าย'}
function requiredMs(){
  const cfg=BH.CONFIG?.[e.difficulty?.value]||BH.CONFIG?.easy||{};
  const assist=1-(Number(s.assistLevel)||0)*.075;
  return Math.max(1,(Number(cfg.hold)||2200)+450)*assist;
}
function bossPct(){return Math.max(0,Math.min(100,Math.round((Number(s.holdMs)||0)/requiredMs()*100)))}
function ensureBossBadge(){
  let node=document.getElementById('bhBossProgressV57');
  if(node)return node;
  node=document.createElement('div');
  node.id='bhBossProgressV57';
  node.innerHTML='<strong>BOSS 0%</strong><span>กางแขน • เอียงตามลูกศร • ค้างให้นิ่ง</span>';
  (e.stage||document.body).appendChild(node);
  return node;
}
function feedbackHint(ev){
  const d=directionThai();
  if(!ev?.tracked)return 'ให้กล้องเห็นไหล่ สะโพก และเข่าทั้งสอง';
  if(Number(ev.bossArmScore||0)<52)return 'กางแขนระดับไหล่ให้ชัดขึ้น';
  if(Number(ev.bossDirectionalScore||0)<52)return `เอียงช่วงไหล่ไปทาง${d}อีกเล็กน้อย`;
  if(Number(ev.stability||0)<58)return 'ท่าถูกแล้ว • ค้างให้นิ่งขึ้น';
  if(Number(ev.control||0)<50)return 'ลดการโยกของลำตัว แล้วค้างไว้';
  return 'ถูกต้อง • ค้างต่อเพื่อสะสมพลัง Boss';
}
function renderBoss(ev){
  const active=String(s.currentKey||'')==='boss'&&String(s.phase||'')==='play';
  document.body.classList.toggle('bh-boss-active',active);
  const badge=ensureBossBadge();
  if(!active)return;
  const d=directionThai(),arrow=d==='ซ้าย'?'⬅️':'➡️',pct=bossPct();
  if(e.poseName)e.poseName.textContent=`🌪️ BOSS ${arrow} เอียง${d}`;
  if(e.poseCue)e.poseCue.textContent=`กางแขนระดับไหล่ • เอียงช่วงไหล่ไปทาง${d}เล็กน้อย • เท้าติดพื้น`;
  if(e.holdText)e.holdText.textContent=`${pct}%`;
  badge.querySelector('strong').textContent=`${arrow} BOSS ${pct}%`;
  badge.querySelector('span').textContent=feedbackHint(ev);
}

installStyle();ensureBossBadge();
const baseSetPoseUI=BH.setPoseUI;
if(typeof baseSetPoseUI==='function'){
  BH.setPoseUI=()=>{
    const result=baseSetPoseUI();
    if(String(s.currentKey||'')==='boss')renderBoss(null);
    else document.body.classList.remove('bh-boss-active');
    return result;
  };
}
const baseUpdateGameUI=BH.updateGameUI;
if(typeof baseUpdateGameUI==='function'){
  BH.updateGameUI=(ev,p)=>{
    const result=baseUpdateGameUI(ev,p);
    renderBoss(ev);
    return result;
  };
}
const baseFinish=BH.finish;
if(typeof baseFinish==='function'){
  BH.finish=reason=>{
    document.body.classList.remove('bh-boss-active');
    return baseFinish(reason);
  };
}
window.BH_MOBILE_BOSS_UI_V57={release:RELEASE,bossPct,requiredMs,renderBoss};
document.documentElement.dataset.bhMobileBossUi='v57';
console.info('[BalanceHold] Mobile Boss UI V57 ready',RELEASE);
})();
