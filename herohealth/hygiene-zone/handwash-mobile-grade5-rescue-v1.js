(()=>{
'use strict';
const VERSION='20260729-HANDWASH-MOBILE-GRADE5-RESCUE-V1';
const mobile=matchMedia('(max-width:760px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
if(!mobile)return;

document.documentElement.dataset.handwashMobileRescue='1';
const style=document.createElement('style');
style.id='handwashMobileGrade5Rescue';
style.textContent=`
@media(max-width:760px){
  #scrubZone{top:56%!important;left:50%!important;width:96vw!important;height:43vh!important;min-width:0!important;min-height:285px!important;max-height:470px!important;transform:translate(-50%,-50%)!important;border-width:3px!important;border-radius:34px!important}
  html[data-handwash-phase="calibrate"] #scrubZone{width:97vw!important;height:47vh!important}
  .coach{left:8px!important;right:8px!important;top:auto!important;bottom:150px!important;width:auto!important;max-height:19vh!important;padding:8px 10px!important;overflow:auto!important}
  .coach p{font-size:12px!important;line-height:1.35!important;margin-top:2px!important}
  .chips{margin-top:4px!important;gap:3px!important}.chip{font-size:7px!important;padding:3px 6px!important}
  .bottom{bottom:calc(5px + var(--sab))!important;left:6px!important;right:6px!important;gap:5px!important}
  .meters{padding:6px!important}.controls{gap:4px!important}.control{min-height:48px!important}
  #waterZone{top:28%!important;width:190px!important;height:260px!important}
  html[data-handwash-phase="wet"] #waterZone,html[data-handwash-phase="rinse"] #waterZone{height:335px!important}
  #soapZone{left:7px!important;bottom:154px!important;width:105px!important;height:104px!important}
  #towelZone{right:7px!important;bottom:154px!important;width:105px!important;height:104px!important}
  .mission{padding:7px 9px!important}.mission .icon{width:34px!important;height:34px!important}.mission p{font-size:10px!important}
  .stats{gap:3px!important}.stat{padding:5px 3px!important}.stat span{font-size:8px!important}
}
`;
document.head.appendChild(style);

let lastEvidence=0,lastChange=Date.now(),oneHandSince=0,lastAssist=0,assistCount=0;
const MAX_ASSISTS=18;
function numberFrom(text){const m=String(text||'').match(/([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):0}
function handCount(){const text=document.getElementById('chipHands')?.textContent||'';return numberFrom(text)}
function evidence(){return numberFrom(document.getElementById('evidenceText')?.textContent||'0')}
function phase(){return document.documentElement.dataset.handwashPhase||''}
function running(){return !document.getElementById('startOverlay')?.classList.contains('show')&&!document.getElementById('summaryOverlay')?.classList.contains('show')}
function motionPresent(){return document.getElementById('chipMotion')?.classList.contains('good')||document.getElementById('chipContact')?.classList.contains('good')}
function showHint(text){const t=document.getElementById('toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(showHint.timer);showHint.timer=setTimeout(()=>t.classList.remove('show'),2200)}
function tick(){
  if(!running())return;
  const now=Date.now(),ev=evidence(),hands=handCount(),p=phase();
  if(ev>lastEvidence+.2){lastEvidence=ev;lastChange=now;oneHandSince=0;return}
  if(hands>=2){oneHandSince=0;return}
  if(hands===1){if(!oneHandSince)oneHandSince=now}else{oneHandSince=0;return}
  const stalled=now-lastChange>5000;
  const heldOneHand=oneHandSince&&now-oneHandSince>1800;
  const scrubPhase=!['','calibrate','wet','soap','rinse','dry','towelFaucet'].includes(p);
  if(stalled&&heldOneHand&&scrubPhase&&assistCount<MAX_ASSISTS&&now-lastAssist>4200){
    const tap=document.getElementById('tapBtn');
    if(tap&&!tap.disabled){
      tap.click();lastAssist=now;assistCount++;lastChange=now;
      showHint(motionPresent()?'ตรวจพบการถูต่อเนื่อง ✅ ระบบช่วยชดเชยมือที่หลุดชั่วคราว':'เห็น 1 มือแล้ว • แยกมือออกจากกันเล็กน้อยให้กล้องเห็นอีกมือ');
    }
  }
}
setInterval(tick,700);

const observer=new MutationObserver(()=>{
  const status=document.getElementById('detectStatus');
  if(status&&/พร้อม|ตรวจ|มือ/.test(status.textContent||''))status.title='Grade 5 Mobile Rescue '+VERSION;
});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
window.HHHandwashMobileGrade5Rescue={version:VERSION,get assistCount(){return assistCount}};
})();