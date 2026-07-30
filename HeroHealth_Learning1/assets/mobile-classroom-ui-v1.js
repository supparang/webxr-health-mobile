(()=>{
'use strict';
const RELEASE='20260730-HH-CLASSROOM-UI-STANDARD-V5';
const q=new URLSearchParams(location.search);
const rawGameId=String(q.get('gameId')||q.get('wrappedGame')||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
const ALIASES={'jump-duck':'jumpduck','balance-hold':'balance','balancehold':'balance','groups-ar':'groups','goodjunk-ar':'goodjunk','handwash-ar':'handwash','toothbrush-ar':'toothbrush'};
const gameId=ALIASES[rawGameId]||rawGameId;
const GAME_COPY={
 handwash:{title:'Handwash AR',icon:'🫧',instruction:'ทำตามขั้นตอนล้างมือให้ครบและถูกลำดับ',result:'ล้างมือครบหนึ่งรอบแล้ว'},
 toothbrush:{title:'Toothbrush Challenge',icon:'🪥',instruction:'แปรงฟันให้ทั่วทุกบริเวณตามคำแนะนำ',result:'แปรงฟันครบหนึ่งรอบแล้ว'},
 groups:{title:'Groups AR',icon:'🥗',instruction:'ใช้นิ้วชี้จัดอาหารลงในหมู่ที่ถูกต้อง',result:'จัดหมู่อาหารครบหนึ่งรอบแล้ว'},
 goodjunk:{title:'GoodJunk Hand AR',icon:'🍎',instruction:'ใช้นิ้วชี้เลือกอาหารที่เหมาะสมตามโจทย์',result:'เล่น GoodJunk ครบหนึ่งรอบแล้ว'},
 jumpduck:{title:'JumpDuck AR',icon:'🦆',instruction:'ขยับร่างกายตามโจทย์ในพื้นที่ที่ปลอดภัย',result:'เล่น JumpDuck ครบหนึ่งรอบแล้ว'},
 balance:{title:'Balance Hold AR',icon:'⚖️',instruction:'ยืนทรงตัวตามท่าที่แสดงโดยไม่ต้องฝืน',result:'ฝึกทรงตัวครบหนึ่งรอบแล้ว'}
};
const COPY=GAME_COPY[gameId]||{title:'HeroHealth',icon:'🌟',instruction:'ทำภารกิจตามคำแนะนำบนหน้าจอ',result:'ทำภารกิจครบหนึ่งรอบแล้ว'};
function detectDevice(){
 const forced=String(q.get('device')||'').toLowerCase();
 if(['mobile','tablet','desktop'].includes(forced))return forced;
 const w=Math.min(innerWidth||9999,screen.width||9999),touch=navigator.maxTouchPoints>0;
 if(w<=767||/Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent))return'mobile';
 if(w<=1180||(touch&&/iPad|Android/i.test(navigator.userAgent)))return'tablet';
 return'desktop';
}
function detectView(){
 const forced=String(q.get('view')||'').toLowerCase();
 if(['portrait','landscape'].includes(forced))return forced;
 return innerWidth>innerHeight?'landscape':'portrait';
}
let device=detectDevice(),view=detectView(),childObserver=null,applyQueued=false;
function mark(root=document.documentElement){
 root.classList.remove('device-mobile','device-tablet','device-desktop','view-portrait','view-landscape');
 root.classList.add('device-'+device,'view-'+view);if(gameId)root.classList.add('game-'+gameId);
 root.dataset.device=device;root.dataset.view=view;root.dataset.classroom='1';root.dataset.gameId=gameId;root.dataset.uiStandard=RELEASE;
}
function compactShellLabels(){
 const back=document.getElementById('back');if(back)back.textContent='← กลับ Passport';
 const title=document.getElementById('title');if(title&&COPY.title)title.textContent=COPY.title;
}
mark();
const style=document.createElement('style');style.id='hh-responsive-shell-v5';style.textContent=`
:root{--hh-shell-h:56px;--hh-safe-b:env(safe-area-inset-bottom,0px)}html,body{height:100%;overflow:hidden}
.device-mobile{--hh-shell-h:44px}.device-tablet{--hh-shell-h:50px}.device-mobile.game-toothbrush,.device-mobile.game-groups{--hh-shell-h:38px}
.bar{height:var(--hh-shell-h)!important;padding:5px 8px!important;gap:7px!important;background:#0f766ef2!important}.bar b{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar button{touch-action:manipulation}.back{background:#ffffff20!important;border:1px solid #ffffff55!important;color:#fff!important}
iframe{top:var(--hh-shell-h)!important;height:calc(100dvh - var(--hh-shell-h))!important}.loading,.overlay{inset:var(--hh-shell-h) 0 0!important}
.device-mobile .bar b{font-size:15px!important}.device-mobile .bar .back{min-height:34px!important;height:34px!important;padding:4px 9px!important;font-size:13px!important}.device-mobile .bar .status{font-size:11px!important;max-width:72px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.device-mobile.game-toothbrush .bar,.device-mobile.game-groups .bar{padding:2px 6px!important}.device-mobile.game-toothbrush .bar b,.device-mobile.game-groups .bar b{font-size:13px!important}.device-mobile.game-toothbrush .bar .back,.device-mobile.game-groups .bar .back{min-height:30px!important;height:30px!important;padding:2px 8px!important;font-size:12px!important}.device-mobile.game-toothbrush .bar .status,.device-mobile.game-groups .bar .status{display:none!important}
.device-mobile .overlay{padding:6px!important;align-items:end!important}.device-mobile .overlay .card{width:100%!important;max-width:none!important;max-height:66dvh!important;overflow:auto!important;border-radius:22px 22px 0 0!important;padding:16px 14px calc(14px + var(--hh-safe-b))!important}.device-mobile .overlay h1{font-size:24px!important;margin:4px 0!important}.device-mobile .overlay .score{font-size:32px!important}.device-mobile .overlay p{font-size:14px!important;margin:6px 0!important}.device-mobile .overlay .btn{min-height:48px!important}
.device-tablet .overlay .card{width:min(620px,94vw)!important;max-height:78dvh!important;overflow:auto!important}.device-desktop .overlay .card{width:min(620px,92vw)!important}.view-landscape.device-mobile .bar .status{display:none!important}.view-landscape.device-mobile .overlay .card{max-height:82dvh!important;width:min(620px,94vw)!important;border-radius:18px!important}
`;document.head.appendChild(style);
function childCss(){return`
:root{--hh-vh:100dvh;--hh-gap:10px;--hh-touch:48px;--hh-font:16px;--hh-green:#16a34a;--hh-green-dark:#166534;--hh-blue:#2563eb;--hh-ink:#0f172a}html,body{width:100%!important;min-height:100%!important;max-width:100%!important;overflow-x:hidden!important}body{overscroll-behavior:none!important;-webkit-text-size-adjust:100%!important}button,input,select,textarea{font-size:16px!important;touch-action:manipulation}img,video,canvas{max-width:100%}
.modal,.card,.panel,.sheet,.dialog,.start-card,.launcher-card,.warmup-card,.cooldown-card,.result-card,.summary-card{max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 20px)!important;overflow:auto!important;margin:auto!important}.overlay,.modalOverlay,.startOverlay,.warmup-overlay,.cooldown-overlay,.result-overlay,.summary-overlay{padding:10px!important;overscroll-behavior:contain!important}
.actions,.button-row,.buttons,.cta-row,.footer-actions{gap:8px!important}.actions button,.button-row button,.buttons button,.cta-row button,.footer-actions button{min-height:var(--hh-touch)!important}.topbar,.header,.game-header{min-height:44px!important;max-height:54px!important;padding:5px 8px!important}.topbar .brandSub,.header .subtitle,.game-header .subtitle{display:none!important}.toast{max-width:calc(100vw - 24px)!important}.hud{pointer-events:none!important}
.device-mobile .actions,.device-mobile .button-row,.device-mobile .buttons,.device-mobile .cta-row,.device-mobile .footer-actions{display:grid!important;grid-template-columns:1fr!important}.device-mobile .actions button,.device-mobile .button-row button,.device-mobile .buttons button,.device-mobile .cta-row button,.device-mobile .footer-actions button{width:100%!important}.device-mobile.game-groups .actions{min-height:0!important}
.device-mobile .formGrid,.device-mobile .settings-grid,.device-mobile .option-grid,.device-mobile .mode-grid,.device-mobile .level-grid,.device-mobile .launcher-grid,.device-mobile .warmup-grid{grid-template-columns:1fr!important}.advanced-settings,.settings-advanced,.debug-panel,.qaPanel,.desktop-only,[data-debug],[data-qa]{display:none!important}.device-mobile.view-portrait .concept,.device-mobile.view-portrait .eightPoseLegend,.device-mobile.view-portrait .long-help,.device-mobile.view-portrait .secondary-info{display:none!important}.device-mobile.view-portrait .modal,.device-mobile.view-portrait .card,.device-mobile.view-portrait .panel{border-radius:20px!important}
.hh-classroom-note{margin:10px 0 2px;padding:10px 12px;border:2px solid #86efac;border-radius:14px;background:#ecfdf5;color:#166534;font-weight:900;font-size:.88rem;line-height:1.45;text-align:center}.hh-classroom-heading{color:#15803d!important}.hh-hidden-classroom{display:none!important}
.device-mobile.view-landscape .modal,.device-mobile.view-landscape .card,.device-mobile.view-landscape .panel,.device-mobile.view-landscape .sheet,.device-mobile.view-landscape .dialog{max-height:calc(100dvh - 10px)!important;max-width:min(760px,96vw)!important}.device-mobile.view-landscape .topbar,.device-mobile.view-landscape .header,.device-mobile.view-landscape .game-header{min-height:38px!important;max-height:44px!important}.device-mobile.view-landscape .actions,.device-mobile.view-landscape .button-row,.device-mobile.view-landscape .cta-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.device-tablet .formGrid,.device-tablet .settings-grid,.device-tablet .option-grid,.device-tablet .mode-grid,.device-tablet .level-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.device-tablet .modal,.device-tablet .card,.device-tablet .panel{max-width:min(760px,94vw)!important}.device-desktop .modal,.device-desktop .card,.device-desktop .panel{max-width:min(960px,92vw)!important}
`;}
function text(el,value){if(el&&el.textContent.trim()!==value)el.textContent=value}
function visibleText(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim()}
function resultRoots(doc){return [...new Set(['#result','#resultScreen','#summary','#summaryScreen','.result-screen','.resultScreen','.result-overlay','.resultOverlay','.summary-screen','.summaryScreen','.end-screen','.finish-screen'].flatMap(s=>[...doc.querySelectorAll(s)]))]}
function localizeCommon(doc){
 const map=[
  [/^Accuracy$/i,'ความแม่นยำ'],[/^Score$/i,'คะแนน'],[/^Total Score$/i,'คะแนนรวม'],[/^Best Combo$/i,'คอมโบสูงสุด'],[/^Reason$/i,'ตอบเหตุผล'],[/^Retry Transfer$/i,'ประยุกต์ใช้'],[/^Reflection$/i,'ทบทวนสิ่งที่เรียนรู้'],[/^Training$/i,'รอบฝึก'],[/^Challenge$/i,'รอบท้าทาย'],[/^Boss$/i,'ด่านเสริม'],[/^Level\s*(\d+)$/i,'ระดับ $1'],[/^Lv\.\s*(\d+)$/i,'ระดับ $1'],[/^Phase\s*(\d+)$/i,'รอบ $1'],[/^HP$/i,'พลัง']
 ];
 [...doc.querySelectorAll('h1,h2,h3,label,button,.label,.metric,.stat-title,.phaseBadge,.badge')].forEach(el=>{const raw=visibleText(el);for(const [re,to] of map){if(re.test(raw)){text(el,raw.replace(re,to));break}}});
}
function standardizeStart(doc){
 const roots=[...doc.querySelectorAll('#start,#startScreen,#startOverlay,.start-screen,.startScreen,.startOverlay,.launcher,.launcher-screen')];
 for(const root of roots){
  const heading=root.querySelector('h1,h2,.title');if(heading&&/production|final|herohealth|ar|challenge|hold|duck|groups|handwash|toothbrush|goodjunk/i.test(visibleText(heading))){heading.classList.add('hh-classroom-heading');text(heading,`${COPY.icon} ${COPY.title}`)}
  const lead=root.querySelector('.lead,.subtitle,.description,p');if(lead&&(/adaptive|research|production|boss|retry|analytics|mode|เลือก|ทำตาม|ขยับ|แปรง|ล้าง/i.test(visibleText(lead))||!visibleText(lead)))text(lead,COPY.instruction);
 }
 [...doc.querySelectorAll('button,a')].forEach(el=>{const t=visibleText(el);if(/touch mode|mouse mode|keyboard mode|demo|debug|qa mode/i.test(t))el.classList.add('hh-hidden-classroom')});
}
function standardizeResult(doc){
 for(const root of resultRoots(doc)){
  const heading=root.querySelector('h1,h2,.title,.result-title,.summary-title');if(heading){heading.classList.add('hh-classroom-heading');text(heading,`🎉 ${COPY.result}`)}
  [...root.querySelectorAll('button,a')].forEach(el=>{const t=visibleText(el);if(/เล่นใหม่|ฝึกเพิ่ม|ลองใหม่ทั้งหมด|ท้า.*boss|boss.*อีกครั้ง|retry|replay|restart|reset|คูลดาวน์|กลับโซน|กลับ fitness|กลับ hygiene|กลับ nutrition|back to zone/i.test(t))el.classList.add('hh-hidden-classroom');if(/passport/i.test(t)||/กลับ.*passport/i.test(t))text(el,'← กลับ Passport')});
  if(!root.querySelector('.hh-classroom-note')){const note=doc.createElement('div');note.className='hh-classroom-note';note.textContent='เล่นครบหนึ่งรอบแล้ว • ระบบจะบันทึกผลและกลับ Passport อัตโนมัติ • ไม่ต้องเล่นซ้ำ';const body=root.querySelector('.resultBody,.summaryBody,.content,.body')||root;body.appendChild(note)}
 }
}
function standardizeActions(doc){
 [...doc.querySelectorAll('button,a')].forEach(el=>{const t=visibleText(el);if(/กลับ.*passport|passport/i.test(t))text(el,'← กลับ Passport');if(/production final|research analytics|teacher dashboard|audit log|export csv/i.test(t))el.classList.add('hh-hidden-classroom')});
}
function applyStandard(doc){
 if(!doc?.documentElement)return;
 localizeCommon(doc);standardizeStart(doc);standardizeResult(doc);standardizeActions(doc);
}
function inject(doc){
 if(!doc?.documentElement)return;
 doc.documentElement.classList.remove('device-mobile','device-tablet','device-desktop','view-portrait','view-landscape');
 doc.documentElement.classList.add('device-'+device,'view-'+view);if(gameId)doc.documentElement.classList.add('game-'+gameId);doc.documentElement.dataset.device=device;doc.documentElement.dataset.view=view;doc.documentElement.dataset.classroom='1';doc.documentElement.dataset.gameId=gameId;doc.documentElement.dataset.uiStandard=RELEASE;
 let s=doc.getElementById('hh-responsive-child-v5');if(!s){s=doc.createElement('style');s.id='hh-responsive-child-v5';doc.head.appendChild(s)}s.textContent=childCss();
 const queue=()=>{if(applyQueued)return;applyQueued=true;requestAnimationFrame(()=>{applyQueued=false;try{applyStandard(doc)}catch(_){}})};queue();
 childObserver?.disconnect();childObserver=new MutationObserver(queue);childObserver.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
}
function bind(){const f=document.getElementById('game');if(!f)return;compactShellLabels();const run=()=>{try{inject(f.contentDocument)}catch(_){}};f.addEventListener('load',()=>{run();setTimeout(run,250);setTimeout(run,1000);setTimeout(run,2500)});run()}
function refresh(){const nd=detectDevice(),nv=detectView();if(nd===device&&nv===view)return;device=nd;view=nv;mark();compactShellLabels();bind()}
addEventListener('resize',()=>setTimeout(refresh,120));addEventListener('orientationchange',()=>setTimeout(refresh,250));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.HHResponsive={device:()=>device,view:()=>view,refresh,release:RELEASE};
})();