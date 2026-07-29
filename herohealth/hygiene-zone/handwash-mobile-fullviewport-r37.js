(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-MOBILE-FULLVIEWPORT-R37';
const qs=new URLSearchParams(location.search);
const coarse=window.matchMedia?.('(pointer:coarse)')?.matches===true;
const touch=Number(navigator.maxTouchPoints||0)>0;
const requested=['mobile','phone'].includes(String(qs.get('view')||'').toLowerCase())||qs.get('classroom')==='1'||qs.get('qa')==='1'||qs.get('qaStandalone')==='1';
const smallScreen=Math.min(Number(screen.width||9999),Number(screen.height||9999))<=800;
const mobile=requested||(touch&&coarse&&smallScreen);
if(!mobile)return;

document.documentElement.classList.add('hh-handwash-mobile-r37');
document.documentElement.dataset.handwashMobileViewport=RELEASE;

const viewport=document.querySelector('meta[name="viewport"]')||document.head.appendChild(document.createElement('meta'));
viewport.name='viewport';
viewport.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';

const style=document.createElement('style');
style.id='hhHandwashMobileFullViewportR37';
style.textContent=`
html.hh-handwash-mobile-r37,
html.hh-handwash-mobile-r37 body{
 position:fixed!important;inset:0!important;width:100vw!important;min-width:100vw!important;max-width:100vw!important;
 height:100dvh!important;min-height:100dvh!important;max-height:100dvh!important;
 margin:0!important;padding:0!important;overflow:hidden!important;overscroll-behavior:none!important;
 transform:none!important;translate:none!important;zoom:1!important;background:#04101a!important;
}
html.hh-handwash-mobile-r37 #app,
html.hh-handwash-mobile-r37 .app{
 position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;
 width:100vw!important;min-width:100vw!important;max-width:100vw!important;
 height:100dvh!important;min-height:100dvh!important;max-height:100dvh!important;
 margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important;zoom:1!important;
}
html.hh-handwash-mobile-r37 .camera,
html.hh-handwash-mobile-r37 .camera video,
html.hh-handwash-mobile-r37 .camera canvas,
html.hh-handwash-mobile-r37 .camera .shade,
html.hh-handwash-mobile-r37 .zones{
 position:absolute!important;inset:0!important;width:100%!important;min-width:100%!important;max-width:100%!important;
 height:100%!important;min-height:100%!important;max-height:100%!important;margin:0!important;transform:none!important;
}
html.hh-handwash-mobile-r37 .camera video{object-fit:cover!important;transform:scaleX(-1)!important}
html.hh-handwash-mobile-r37 .hud{inset:calc(4px + var(--sat)) 6px auto 6px!important;width:auto!important;max-width:none!important;gap:4px!important;overflow:visible!important}
html.hh-handwash-mobile-r37 .hud .row{gap:5px!important;min-width:0!important;width:100%!important}
html.hh-handwash-mobile-r37 .title{min-width:0!important;padding:5px 8px!important;border-radius:13px!important}
html.hh-handwash-mobile-r37 .title small{display:none!important}
html.hh-handwash-mobile-r37 .title strong{font-size:14px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
html.hh-handwash-mobile-r37 .detect{flex:0 0 70px!important;min-width:70px!important;max-width:70px!important;min-height:34px!important;padding:4px!important;font-size:8px!important;border-radius:12px!important}
html.hh-handwash-mobile-r37 .stats{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important;width:100%!important;min-width:0!important}
html.hh-handwash-mobile-r37 .stats .stat:nth-child(4){display:none!important}
html.hh-handwash-mobile-r37 .stat{min-width:0!important;padding:4px 2px!important;border-radius:10px!important}
html.hh-handwash-mobile-r37 .stat span{font-size:7px!important;white-space:nowrap!important}
html.hh-handwash-mobile-r37 .stat b{font-size:14px!important;white-space:nowrap!important}
html.hh-handwash-mobile-r37 .mission{width:100%!important;min-width:0!important;padding:6px 8px!important;gap:6px!important;border-radius:12px!important}
html.hh-handwash-mobile-r37 .mission .icon{width:31px!important;height:31px!important;flex:0 0 31px!important;font-size:18px!important}
html.hh-handwash-mobile-r37 .mission>div:last-child{min-width:0!important}
html.hh-handwash-mobile-r37 .mission h1{font-size:13px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
html.hh-handwash-mobile-r37 .mission p{font-size:9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
html.hh-handwash-mobile-r37 .who-strip{display:flex!important;width:100%!important;min-width:0!important;min-height:42px!important;padding:4px!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important}
html.hh-handwash-mobile-r37 .phase-chip{flex:0 0 76px!important;min-width:76px!important;padding:5px 4px!important;font-size:8px!important;line-height:1.2!important}
html.hh-handwash-mobile-r37 #scrubZone{top:54%!important;left:50%!important;right:auto!important;bottom:auto!important;width:94vw!important;min-width:0!important;max-width:94vw!important;height:36vh!important;min-height:215px!important;max-height:43vh!important;transform:translate(-50%,-50%)!important;border-radius:25px!important}
html.hh-handwash-mobile-r37[data-handwash-phase="calibrate"] #scrubZone{width:94vw!important;max-width:94vw!important;height:42vh!important;max-height:46vh!important}
html.hh-handwash-mobile-r37 #waterZone{top:28%!important;left:50%!important;right:auto!important;width:145px!important;height:210px!important;transform:translateX(-50%)!important;border-radius:24px!important}
html.hh-handwash-mobile-r37[data-handwash-phase="wet"] #waterZone,
html.hh-handwash-mobile-r37[data-handwash-phase="rinse"] #waterZone{height:285px!important}
html.hh-handwash-mobile-r37 #soapZone{left:8px!important;right:auto!important;bottom:162px!important;width:88px!important;height:86px!important}
html.hh-handwash-mobile-r37 #towelZone{right:8px!important;left:auto!important;bottom:162px!important;width:88px!important;height:86px!important}
html.hh-handwash-mobile-r37 .zone{border-radius:18px!important}
html.hh-handwash-mobile-r37 .zone b{font-size:27px!important}
html.hh-handwash-mobile-r37 .zone span{font-size:7px!important}
html.hh-handwash-mobile-r37 .coach{left:8px!important;right:8px!important;top:auto!important;bottom:104px!important;width:auto!important;min-width:0!important;max-width:none!important;max-height:31vh!important;padding:7px!important;overflow:auto!important;border-radius:15px!important}
html.hh-handwash-mobile-r37 .coach>strong{display:none!important}
html.hh-handwash-mobile-r37 .coach p{font-size:12px!important;text-align:center!important}
html.hh-handwash-mobile-r37 .coach .chips{display:none!important}
html.hh-handwash-mobile-r37 .bottom{left:8px!important;right:8px!important;bottom:calc(6px + var(--sab))!important;width:auto!important;max-width:none!important;display:block!important}
html.hh-handwash-mobile-r37 .meters{display:none!important}
html.hh-handwash-mobile-r37 .controls{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;width:100%!important}
html.hh-handwash-mobile-r37 .control{display:none!important;min-width:0!important;min-height:58px!important;border-radius:14px!important}
html.hh-handwash-mobile-r37 #faucetBtn,
html.hh-handwash-mobile-r37 #stopBtn{display:block!important;width:100%!important}
html.hh-handwash-mobile-r37 .overlay{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;padding:10px!important;place-items:start center!important;overflow-y:auto!important;overflow-x:hidden!important}
html.hh-handwash-mobile-r37 .overlay .card{width:100%!important;max-width:640px!important;min-width:0!important;max-height:none!important;margin:auto 0!important;padding:16px 12px!important;overflow:visible!important}
html.hh-handwash-mobile-r37 .toast{left:8px!important;right:8px!important;bottom:82px!important;width:auto!important;max-width:none!important;transform:translateY(15px)!important}
html.hh-handwash-mobile-r37 .toast.show{transform:translateY(0)!important}
`;
document.head.appendChild(style);

function viewportWidth(){
 const values=[innerWidth,document.documentElement.clientWidth,window.visualViewport?.width||0];
 try{if(frameElement)values.push(frameElement.getBoundingClientRect().width)}catch(_){}
 return Math.max(1,...values.filter(Number.isFinite));
}
function viewportHeight(){
 const values=[innerHeight,document.documentElement.clientHeight,window.visualViewport?.height||0];
 try{if(frameElement)values.push(frameElement.getBoundingClientRect().height)}catch(_){}
 return Math.max(1,...values.filter(Number.isFinite));
}
function resizeCanvasDirect(canvas){
 if(!canvas)return;
 const rect=canvas.getBoundingClientRect();
 const d=Math.min(devicePixelRatio||1,2);
 const width=Math.max(1,Math.round(rect.width*d));
 const height=Math.max(1,Math.round(rect.height*d));
 if(canvas.width!==width)canvas.width=width;
 if(canvas.height!==height)canvas.height=height;
 const ctx=canvas.getContext('2d');ctx?.setTransform(d,0,0,d,0,0);
}
function apply(){
 const w=Math.round(viewportWidth()),h=Math.round(viewportHeight());
 document.documentElement.style.setProperty('--hh-mobile-vw',w+'px');
 document.documentElement.style.setProperty('--hh-mobile-vh',h+'px');
 document.documentElement.style.width='100vw';document.documentElement.style.height='100dvh';
 document.body.style.width='100vw';document.body.style.height='100dvh';
 const app=document.getElementById('app');if(app){app.style.width='100vw';app.style.height='100dvh';app.style.left='0';app.style.right='auto';}
 const video=document.getElementById('video');if(video){video.style.width='100%';video.style.height='100%';}
 const canvas=document.getElementById('arCanvas');if(canvas){canvas.style.width='100%';canvas.style.height='100%';resizeCanvasDirect(canvas);}
 scrollTo(0,0);
}
apply();requestAnimationFrame(apply);setTimeout(apply,120);setTimeout(apply,650);
addEventListener('resize',apply,{passive:true});addEventListener('orientationchange',()=>setTimeout(apply,180),{passive:true});
window.visualViewport?.addEventListener('resize',apply,{passive:true});
console.info('[Handwash Mobile R37] full viewport force installed',{innerWidth,screenWidth:screen.width,touch,coarse,requested});
})();