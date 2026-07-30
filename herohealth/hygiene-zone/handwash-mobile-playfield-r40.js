(()=>{
'use strict';
const RELEASE='20260730-HANDWASH-MOBILE-PLAYFIELD-R40';
const qs=new URLSearchParams(location.search);
const mobile=matchMedia('(max-width:760px)').matches||matchMedia('(pointer:coarse)').matches||Number(navigator.maxTouchPoints||0)>0||qs.get('classroom')==='1'||qs.get('qa')==='1'||qs.get('qaStandalone')==='1';
if(!mobile)return;

document.documentElement.classList.add('hh-handwash-playfield-r40');
document.documentElement.dataset.handwashMobilePlayfield=RELEASE;

const style=document.createElement('style');
style.id='hhHandwashMobilePlayfieldR40';
style.textContent=`
@media(max-width:760px),(pointer:coarse){
  html.hh-handwash-playfield-r40 .hud{
    inset:calc(4px + var(--sat)) 6px auto 6px!important;
    gap:3px!important;
    max-height:132px!important;
    overflow:visible!important;
  }
  html.hh-handwash-playfield-r40 .hud .row{min-height:36px!important;gap:4px!important}
  html.hh-handwash-playfield-r40 .back{width:36px!important;height:36px!important;border-radius:11px!important;font-size:18px!important}
  html.hh-handwash-playfield-r40 .title{min-height:36px!important;padding:4px 8px!important;border-radius:11px!important}
  html.hh-handwash-playfield-r40 .title strong{font-size:13px!important;line-height:1.15!important}
  html.hh-handwash-playfield-r40 .detect{flex:0 0 66px!important;min-width:66px!important;max-width:66px!important;min-height:36px!important;font-size:8px!important;border-radius:11px!important}

  html.hh-handwash-playfield-r40 .stats{height:38px!important;gap:3px!important}
  html.hh-handwash-playfield-r40 .stat{min-height:38px!important;padding:3px 2px!important;border-radius:9px!important}
  html.hh-handwash-playfield-r40 .stat span{font-size:6.5px!important;line-height:1!important}
  html.hh-handwash-playfield-r40 .stat b{margin-top:1px!important;font-size:13px!important;line-height:1!important}

  html.hh-handwash-playfield-r40 .mission,
  html.hh-handwash-playfield-r40 .who-strip{display:none!important}

  html.hh-handwash-playfield-r40 #hhMobileProgress{
    display:block!important;
    min-height:31px!important;
    padding:4px 7px!important;
    border-radius:10px!important;
    overflow:hidden!important;
  }
  html.hh-handwash-playfield-r40 #hhMobileProgressTop{font-size:9px!important;line-height:1!important}
  html.hh-handwash-playfield-r40 #hhMobileProgressPct{font-size:12px!important}
  html.hh-handwash-playfield-r40 #hhMobileStepRail{gap:2px!important;margin-top:3px!important}
  html.hh-handwash-playfield-r40 #hhMobileStepRail i{height:4px!important}

  html.hh-handwash-playfield-r40 #scrubZone{
    top:51%!important;
    width:96vw!important;
    max-width:96vw!important;
    height:54vh!important;
    min-height:300px!important;
    max-height:570px!important;
    border-radius:24px!important;
  }
  html.hh-handwash-playfield-r40[data-handwash-phase="calibrate"] #scrubZone{
    top:51%!important;
    width:96vw!important;
    height:56vh!important;
    max-height:590px!important;
  }
  html.hh-handwash-playfield-r40 #waterZone{top:21%!important;width:140px!important;height:190px!important}
  html.hh-handwash-playfield-r40 #soapZone,
  html.hh-handwash-playfield-r40 #towelZone{bottom:76px!important;width:78px!important;height:76px!important}

  html.hh-handwash-playfield-r40 .coach{
    position:absolute!important;
    left:7px!important;
    right:7px!important;
    top:auto!important;
    bottom:72px!important;
    width:auto!important;
    min-width:0!important;
    max-width:none!important;
    height:auto!important;
    max-height:118px!important;
    padding:6px 7px!important;
    border-radius:13px!important;
    overflow:hidden!important;
  }
  html.hh-handwash-playfield-r40 #hhStepCoachR33{gap:3px!important}
  html.hh-handwash-playfield-r40 .h33-head{grid-template-columns:30px minmax(0,1fr) auto!important;gap:5px!important}
  html.hh-handwash-playfield-r40 .h33-icon{width:30px!important;height:30px!important;border-radius:9px!important;font-size:18px!important}
  html.hh-handwash-playfield-r40 .h33-kicker{font-size:7px!important;line-height:1!important}
  html.hh-handwash-playfield-r40 .h33-title{font-size:12px!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html.hh-handwash-playfield-r40 .h33-progress{min-width:39px!important;padding:4px 5px!important;font-size:9px!important}
  html.hh-handwash-playfield-r40 .h33-motion{padding:4px 6px!important;font-size:9px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html.hh-handwash-playfield-r40 .h33-method{display:none!important}
  html.hh-handwash-playfield-r40 .h33-status{min-height:27px!important;max-height:31px!important;padding:4px 6px!important;border-width:1px!important;border-radius:9px!important;font-size:9px!important;line-height:1.2!important;overflow:hidden!important}
  html.hh-handwash-playfield-r40 .h33-bar{height:4px!important}

  html.hh-handwash-playfield-r40 .bottom{left:7px!important;right:7px!important;bottom:calc(5px + var(--sab))!important}
  html.hh-handwash-playfield-r40 .controls{gap:7px!important}
  html.hh-handwash-playfield-r40 .control{min-height:57px!important;max-height:57px!important;padding:4px!important;border-radius:13px!important;font-size:9px!important;line-height:1.1!important}
  html.hh-handwash-playfield-r40 .control span{font-size:18px!important;line-height:1!important;margin-bottom:2px!important}
  html.hh-handwash-playfield-r40 #stopBtn b{display:block!important;font-size:9px!important;line-height:1.15!important}
  html.hh-handwash-playfield-r40 .toast{bottom:196px!important;max-height:46px!important;font-size:10px!important}
}

@media(max-width:760px) and (max-height:700px){
  html.hh-handwash-playfield-r40 .hud{max-height:112px!important}
  html.hh-handwash-playfield-r40 .stats{height:34px!important}
  html.hh-handwash-playfield-r40 .stat{min-height:34px!important}
  html.hh-handwash-playfield-r40 #hhMobileProgress{min-height:27px!important;padding:3px 6px!important}
  html.hh-handwash-playfield-r40 .coach{max-height:104px!important;bottom:66px!important}
  html.hh-handwash-playfield-r40 .h33-status{min-height:24px!important;max-height:27px!important}
  html.hh-handwash-playfield-r40 .control{min-height:52px!important;max-height:52px!important}
  html.hh-handwash-playfield-r40 #scrubZone{height:52vh!important;min-height:250px!important}
}
`;
document.head.appendChild(style);

function apply(){
  const coach=document.querySelector('.coach');
  const method=document.querySelector('.h33-method');
  if(coach)coach.setAttribute('aria-label','คำแนะนำขั้นปัจจุบันแบบย่อ');
  if(method)method.setAttribute('aria-hidden','true');
  document.documentElement.style.setProperty('--hh-playfield-version',`"${RELEASE}"`);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true});
setTimeout(apply,120);setTimeout(apply,800);
console.info('[Handwash Mobile R40] clear playfield installed');
})();
