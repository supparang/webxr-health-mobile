(()=>{
'use strict';
const VERSION='20260730-MOBILE-PASSPORT-PRODUCTION-V1.1';
const KEY='herohealth_learning_platform_rc2';
const C=window.HH_CONFIG||{};
const R=window.HHRotation;
if(!R)return;

function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}}
function gameMeta(step){
  if(!step||step.type!=='game')return null;
  return C.zones?.find(z=>z.id===step.zoneId)?.games?.find(g=>g.id===step.gameId)||null;
}
function syncStatus(s){
  if(s?.sheetAuthority===true&&s?.offlineAuthority!==true)return{key:'ok',text:'✓ ซิงก์กับ Google Sheet แล้ว'};
  if(s?.offlineAuthority===true)return{key:'offline',text:'ข้อมูลล่าสุดจาก Sheet • ออฟไลน์'};
  return{key:'pending',text:'กำลังตรวจสอบ Google Sheet…'};
}
function actionFor(s){
  const st=R.status(s),next=st.nextStep;
  if(next==='pretest')return{label:'เริ่ม Pre-test',run:()=>window.HH?.openRoute?.('pretest')};
  const step=st.route.find(x=>x.id===next);
  if(step?.type==='game'){
    const meta=gameMeta(step),name=meta?.title||meta?.thai||step.label||'เกมถัดไป';
    return{label:`เริ่ม ${name}`,run:()=>window.HH?.openNextGame?.(step.zoneId)};
  }
  if(next==='posttest')return{label:'เริ่ม Post-test',run:()=>window.HH?.openRoute?.('posttest')};
  if(next==='reflection')return{label:'ทำ Reflection',run:()=>window.HH?.openRoute?.('reflection')};
  return{label:'ดูผลสำเร็จ',run:()=>window.HH?.openRoute?.('certificate')};
}
function ensureSyncIndicator(s){
  const passport=document.querySelector('.hero-card .passport>div:last-child');
  if(!passport)return;
  let el=document.getElementById('hh-sheet-sync-indicator');
  if(!el){el=document.createElement('div');el.id='hh-sheet-sync-indicator';passport.appendChild(el)}
  const sync=syncStatus(s);
  if(el.dataset.status!==sync.key)el.dataset.status=sync.key;
  if(el.textContent!==sync.text)el.textContent=sync.text;
}
function ensureMobileCta(s){
  let bar=document.getElementById('hh-mobile-next-cta');
  if(!s?.profile||s?.view!=='student'){
    if(bar)bar.remove();
    return;
  }
  if(!bar){
    bar=document.createElement('div');bar.id='hh-mobile-next-cta';
    bar.innerHTML='<span class="hh-mobile-sync-dot" aria-hidden="true"></span><button type="button"></button>';
    document.body.appendChild(bar);
  }
  const sync=syncStatus(s),action=actionFor(s),button=bar.querySelector('button'),label=action.label+' ›';
  if(bar.dataset.sync!==sync.key)bar.dataset.sync=sync.key;
  if(button.dataset.busy!=='1'&&button.textContent!==label)button.textContent=label;
  if(button.getAttribute('aria-label')!==action.label)button.setAttribute('aria-label',action.label);
  button.onclick=()=>{
    if(button.dataset.busy==='1')return;
    button.dataset.busy='1';button.disabled=true;const original=label;button.textContent='กำลังเปิด…';
    try{action.run()}catch(err){console.error('[HeroHealth mobile CTA]',err)}
    setTimeout(()=>{button.dataset.busy='0';button.disabled=false;button.textContent=original},2200);
  };
}
function patch(){
  const s=read();
  if(!s?.profile||s?.view!=='student'){
    document.getElementById('hh-sheet-sync-indicator')?.remove();
    document.getElementById('hh-mobile-next-cta')?.remove();
    return;
  }
  ensureSyncIndicator(s);ensureMobileCta(s);
  document.documentElement.dataset.hhMobilePassport='V1';
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch()})}
addEventListener('DOMContentLoaded',()=>{
  patch();
  const app=document.getElementById('app');
  if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
});
addEventListener('storage',e=>{if(e.key===KEY)schedule()});
addEventListener('online',schedule);addEventListener('offline',schedule);
window.HHMobilePassportProduction={patch,version:VERSION};
})();
