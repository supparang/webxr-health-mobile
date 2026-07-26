(()=>{
'use strict';
const MOBILE=matchMedia('(max-width:900px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
if(!MOBILE)return;
const style=document.createElement('style');
style.textContent=`
:root{--hh-shell-h:44px}
html,body{height:100%;overflow:hidden}
.bar{height:var(--hh-shell-h)!important;padding:4px 6px!important;gap:6px!important}
.bar b{font-size:15px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar .back{min-height:34px!important;height:34px!important;padding:4px 9px!important;border-radius:10px!important;font-size:13px!important}
.bar .status{font-size:11px!important;max-width:62px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
iframe{top:var(--hh-shell-h)!important;height:calc(100dvh - var(--hh-shell-h))!important}
.loading,.overlay{inset:var(--hh-shell-h) 0 0!important}
.overlay{padding:8px!important;align-items:end!important}
.overlay .card{width:100%!important;max-width:none!important;max-height:58dvh!important;overflow:auto!important;border-radius:22px 22px 0 0!important;padding:18px 16px calc(16px + env(safe-area-inset-bottom))!important}
.overlay .card>div:first-child{font-size:34px!important}
.overlay h1{font-size:25px!important;margin:4px 0!important}
.overlay .score{font-size:34px!important}
.overlay p{font-size:14px!important;margin:7px 0!important}
.overlay .btn{min-height:48px!important}
`;
document.head.appendChild(style);
function inject(doc){
 if(!doc||doc.getElementById('hh-mobile-classroom-global'))return;
 const s=doc.createElement('style');s.id='hh-mobile-classroom-global';s.textContent=`
 html,body{width:100%!important;min-height:100%!important;max-width:100%!important;overflow-x:hidden!important}
 body{overscroll-behavior:none!important;-webkit-text-size-adjust:100%!important}
 button,input,select,textarea{font-size:16px!important}
 .modal,.card,.panel,.sheet,.dialog,.start-card,.launcher-card{max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 20px)!important;overflow:auto!important;margin:auto!important}
 .overlay,.modalOverlay,.startOverlay,.warmup-overlay,.cooldown-overlay{padding:10px!important}
 .actions,.button-row,.buttons,.cta-row{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
 .actions button,.button-row button,.buttons button,.cta-row button{width:100%!important;min-height:48px!important}
 .topbar,.header,.game-header{min-height:44px!important;max-height:52px!important;padding:5px 8px!important}
 .topbar .brandSub,.header .subtitle,.game-header .subtitle{display:none!important}
 .hud{pointer-events:none!important}
 .toast{max-width:calc(100vw - 24px)!important}
 @media (orientation:portrait){
   .formGrid,.settings-grid,.option-grid,.mode-grid,.level-grid{grid-template-columns:1fr!important}
   .concept,.eightPoseLegend,.desktop-only,.advanced-settings,.qaPanel{display:none!important}
 }
 `;doc.head.appendChild(s);
 const qs=(sel)=>doc.querySelector(sel);
 const all=(sel)=>[...doc.querySelectorAll(sel)];
 all('.advanced-settings,.settings-advanced,.debug-panel,.qaPanel,.desktop-only').forEach(e=>e.style.display='none');
 const start=qs('#startOverlay,.startOverlay,.warmup-overlay,.launcher-overlay');
 if(start)start.style.alignItems='center';
}
function bind(){const f=document.getElementById('game');if(!f)return;const run=()=>{try{inject(f.contentDocument)}catch(_){}};f.addEventListener('load',()=>{run();setTimeout(run,300);setTimeout(run,1200)});run()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();