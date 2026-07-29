(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-ACTIVE-TARGET-R38';
const qs=new URLSearchParams(location.search);
const mobile=qs.get('view')==='mobile'||qs.get('classroom')==='1'||qs.get('qa')==='1'||Number(navigator.maxTouchPoints||0)>0;
if(!mobile)return;
document.documentElement.classList.add('hh-handwash-target-r38');
document.documentElement.dataset.handwashActiveTarget=RELEASE;
const style=document.createElement('style');
style.id='hhHandwashActiveTargetR38';
style.textContent=`
html.hh-handwash-target-r38 .zone{
 opacity:0!important;visibility:hidden!important;transition:opacity .18s ease,transform .18s ease,box-shadow .18s ease!important;
}
html.hh-handwash-target-r38 .zone.active{
 opacity:1!important;visibility:visible!important;
}
html.hh-handwash-target-r38 #soapZone,
html.hh-handwash-target-r38 #towelZone,
html.hh-handwash-target-r38 #waterZone{
 right:auto!important;bottom:auto!important;left:50%!important;top:49%!important;
 width:142px!important;height:122px!important;min-width:142px!important;min-height:122px!important;
 transform:translate(-50%,-50%)!important;border:4px solid var(--yellow)!important;border-radius:25px!important;
 background:rgba(9,37,53,.78)!important;box-shadow:0 0 0 7px rgba(255,226,123,.12),0 18px 45px rgba(0,0,0,.40)!important;
}
html.hh-handwash-target-r38 #waterZone{height:158px!important;min-height:158px!important;top:47%!important}
html.hh-handwash-target-r38 #soapZone b,
html.hh-handwash-target-r38 #towelZone b,
html.hh-handwash-target-r38 #waterZone b{font-size:50px!important;line-height:1!important}
html.hh-handwash-target-r38 #soapZone span,
html.hh-handwash-target-r38 #towelZone span,
html.hh-handwash-target-r38 #waterZone span{margin-top:7px!important;font-size:12px!important;color:#fff!important;letter-spacing:.04em!important}
html.hh-handwash-target-r38 #soapZone.active,
html.hh-handwash-target-r38 #towelZone.active,
html.hh-handwash-target-r38 #waterZone.active{animation:hhTargetPulseR38 1.15s ease-in-out infinite alternate!important}
html.hh-handwash-target-r38 #soapZone::after,
html.hh-handwash-target-r38 #towelZone::after,
html.hh-handwash-target-r38 #waterZone::after{
 position:absolute;left:50%;bottom:-42px;transform:translateX(-50%);width:max-content;max-width:88vw;
 padding:7px 12px;border-radius:999px;background:rgba(4,21,33,.94);border:1px solid rgba(132,226,255,.42);
 color:#effbff;font-size:11px;font-weight:1000;text-align:center;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.35)
}
html.hh-handwash-target-r38 #soapZone::after{content:'นำมือเข้ากรอบสบู่'}
html.hh-handwash-target-r38 #towelZone::after{content:'นำมือเข้ากรอบกระดาษ'}
html.hh-handwash-target-r38 #waterZone::after{content:'นำมือเข้ากรอบน้ำ'}
html.hh-handwash-target-r38[data-handwash-phase="towelFaucet"] #waterZone::after{content:'ถือกระดาษแล้วนำมือมาที่ก๊อก'}
html.hh-handwash-target-r38 #scrubZone.active{opacity:1!important;visibility:visible!important}
html.hh-handwash-target-r38[data-handwash-phase="soap"] .coach,
html.hh-handwash-target-r38[data-handwash-phase="dry"] .coach,
html.hh-handwash-target-r38[data-handwash-phase="wet"] .coach,
html.hh-handwash-target-r38[data-handwash-phase="rinse"] .coach,
html.hh-handwash-target-r38[data-handwash-phase="towelFaucet"] .coach{
 bottom:104px!important;max-height:27vh!important;
}
@keyframes hhTargetPulseR38{
 from{box-shadow:0 0 0 5px rgba(255,226,123,.10),0 14px 36px rgba(0,0,0,.32);filter:brightness(1)}
 to{box-shadow:0 0 0 12px rgba(255,226,123,.24),0 20px 48px rgba(0,0,0,.48);filter:brightness(1.14)}
}
@media(max-height:700px){
 html.hh-handwash-target-r38 #soapZone,
 html.hh-handwash-target-r38 #towelZone,
 html.hh-handwash-target-r38 #waterZone{top:45%!important;width:124px!important;min-width:124px!important;height:104px!important;min-height:104px!important}
 html.hh-handwash-target-r38 #waterZone{height:132px!important;min-height:132px!important}
 html.hh-handwash-target-r38 #soapZone b,
 html.hh-handwash-target-r38 #towelZone b,
 html.hh-handwash-target-r38 #waterZone b{font-size:42px!important}
}
`;
document.head.appendChild(style);
function enhanceLabels(){
 const soap=document.getElementById('soapZone')?.querySelector('span');
 const towel=document.getElementById('towelZone')?.querySelector('span');
 const water=document.getElementById('waterZone')?.querySelector('span');
 if(soap)soap.textContent='SOAP • สบู่';
 if(towel)towel.textContent='TOWEL • กระดาษ';
 if(water)water.textContent='FAUCET • น้ำ';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceLabels,{once:true});else enhanceLabels();
console.info('[Handwash Target R38] active target visibility installed');
})();