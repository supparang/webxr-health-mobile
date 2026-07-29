(()=>{
'use strict';
const VERSION='20260729-HANDWASH-MOBILE-GRADE5-RESCUE-V2-UNBLOCKED';
const mobile=matchMedia('(max-width:760px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
if(!mobile)return;

document.documentElement.dataset.handwashMobileRescue='2';
const style=document.createElement('style');
style.id='handwashMobileGrade5Rescue';
style.textContent=`
@media(max-width:760px){
  .hud{inset:calc(6px + var(--sat)) 6px auto 6px!important;gap:4px!important}
  .row{gap:4px!important}.back{width:42px!important;height:42px!important}.title{padding:6px 9px!important}.title small{display:none!important}.title strong{font-size:15px!important}.detect{min-width:88px!important;min-height:42px!important;font-size:9px!important;padding:4px 6px!important}
  .stats{gap:3px!important}.stat{padding:4px 2px!important;border-radius:10px!important}.stat span{font-size:7px!important}.stat b{font-size:15px!important}
  .mission{padding:5px 8px!important;border-radius:12px!important}.mission .icon{width:30px!important;height:30px!important;font-size:18px!important}.mission h1{font-size:13px!important}.mission p{font-size:9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .who-strip{padding:4px!important;gap:3px!important;border-radius:11px!important}.phase-chip{font-size:8px!important;padding:5px 6px!important}

  #scrubZone{top:58%!important;left:50%!important;width:97vw!important;height:52vh!important;min-width:0!important;min-height:360px!important;max-height:620px!important;transform:translate(-50%,-50%)!important;border-width:3px!important;border-radius:30px!important}
  html[data-handwash-phase="calibrate"] #scrubZone{top:57%!important;width:98vw!important;height:55vh!important}
  #waterZone{top:31%!important;width:180px!important;height:220px!important}
  html[data-handwash-phase="wet"] #waterZone,html[data-handwash-phase="rinse"] #waterZone{height:290px!important}
  #soapZone{left:7px!important;bottom:112px!important;width:94px!important;height:92px!important}
  #towelZone{right:7px!important;bottom:112px!important;width:94px!important;height:92px!important}

  .coach{left:8px!important;right:8px!important;top:238px!important;bottom:auto!important;width:auto!important;max-height:74px!important;min-height:0!important;padding:6px 9px!important;border-radius:12px!important;overflow:hidden!important;display:flex!important;align-items:center!important;gap:7px!important}
  .coach strong{flex:0 0 auto!important;font-size:8px!important}.coach p{flex:1 1 auto!important;font-size:10px!important;line-height:1.2!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.chips{display:none!important}

  .bottom{bottom:calc(4px + var(--sab))!important;left:6px!important;right:6px!important;gap:4px!important;grid-template-columns:1fr!important}
  .meters{display:none!important}.controls{grid-template-columns:repeat(4,1fr)!important;gap:4px!important}.control{min-height:54px!important;border-radius:12px!important;font-size:8px!important}.control span{font-size:18px!important}

  .toast{position:fixed!important;left:50%!important;bottom:calc(68px + var(--sab))!important;width:min(88vw,430px)!important;max-height:56px!important;overflow:hidden!important;padding:8px 11px!important;border-radius:12px!important;font-size:11px!important;line-height:1.25!important;z-index:120!important;transform:translate(-50%,8px)!important}.toast.show{transform:translate(-50%,0)!important}

  .overlay{padding:10px!important}.card{padding:14px!important;border-radius:20px!important}.hero{font-size:38px!important}.card h2{font-size:24px!important}.card>p{font-size:12px!important;margin:6px auto 10px!important}.rules{gap:5px!important;margin:8px 0!important}.rule{padding:7px!important;font-size:10px!important}.bigbtn{min-height:46px!important}
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
function showHint(text){const t=document.getElementById('toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(showHint.timer);showHint.timer=setTimeout(()=>t.classList.remove('show'),1800)}
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
      showHint(motionPresent()?'ตรวจพบการถูต่อเนื่อง ✅ ชดเชยมือที่หลุดชั่วคราว':'เห็น 1 มือ • แยกมือเล็กน้อยให้กล้องเห็นอีกมือ');
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