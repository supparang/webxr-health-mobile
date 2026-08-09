(()=>{
'use strict';
const VERSION='2026-08-09-LEXICON-CHAMPION-V474-PASS-RECEIPT-GUARD';
const params=new URLSearchParams(location.search);
const PROD=params.get('from')==='passport'&&params.get('authority')==='firebase'&&params.get('qa')!=='1'&&params.get('submit')!=='0';
const MOBILE=params.get('view')==='mobile';
let mobileReturnTimer=0,applyQueued=false;

function numberFrom(id){
  const text=String(document.getElementById(id)?.textContent||'');
  const n=Number((text.match(/-?\d+(?:\.\d+)?/)||[])[0]);
  return Number.isFinite(n)?n:0;
}
function bodyComplete(){
  const text=String(document.getElementById('bodyResult')?.textContent||'');
  const m=text.match(/(\d+)\s*\/\s*(\d+)/);
  return Boolean(m&&Number(m[1])>=Number(m[2])&&Number(m[2])>0);
}
function computeRank(){
  const mastery=numberFrom('masteryResult');
  const voice=numberFrom('voiceResult');
  const bodyOk=bodyComplete();
  const fallback=Boolean(window.LEXICON_CHAMPION_V47?.state?.fallback);
  if(mastery>=90&&voice>=75&&bodyOk&&!fallback)return 'S';
  if(mastery>=80&&voice>=60&&bodyOk)return 'A';
  if(mastery>=65)return 'B';
  return 'C';
}
function applyRankPolicy(){
  const summary=document.getElementById('summary');
  const rank=document.getElementById('rank');
  if(!summary||summary.classList.contains('hidden')||!rank)return;
  const next=computeRank();
  if(rank.textContent!==next)rank.textContent=next;
  const policy='mastery90-voice75-body2-noFallback-for-S';
  if(rank.dataset.rankPolicy!==policy)rank.dataset.rankPolicy=policy;
}
function hideProductionMetadata(){
  if(!PROD)return;
  const root=document.documentElement;
  if(!root.classList.contains('lca-production'))root.classList.add('lca-production');
  document.querySelectorAll('.ew-rotation-badge,.qaOnly').forEach(el=>{
    if(!el.classList.contains('hidden'))el.classList.add('hidden');
  });
  const subtitle=document.getElementById('subtitle');
  const wanted='GAME 5 • FINAL CHALLENGE';
  if(subtitle&&subtitle.textContent!==wanted)subtitle.textContent=wanted;
}
function receiptRecord(){
  const api=window.LEXICON_CHAMPION_V47;
  const playerId=String(api?.PID||params.get('pid')||params.get('playerId')||'').trim();
  let saved=null;
  try{
    if(playerId) saved=JSON.parse(sessionStorage.getItem(`ew_passport_receipt::${playerId}::final_boss`)||'null');
  }catch(_){saved=null}
  const receipt=String(api?.state?.receipt||saved?.receipt||'').trim();
  const passed=saved?.passed===true;
  const accuracy=Number(saved?.accuracy??numberFrom('masteryResult'));
  return {playerId,receipt,passed,accuracy:Number.isFinite(accuracy)?accuracy:0};
}
function passportUrl(record){
  const p=new URLSearchParams({resume:'passport',fromGame:'final_boss',v:'20260809-champion-receipt-guard1'});
  p.set('receipt',record.receipt);
  if(MOBILE)p.set('view','mobile');
  return './index.html?'+p.toString();
}
function ensureReplayButton(record){
  const actions=document.querySelector('#summary .summaryActions');
  if(!actions)return;
  let replay=document.getElementById('productionReplay');
  if(record.passed&&record.receipt){
    replay?.remove();
    return;
  }
  if(!replay){
    replay=document.createElement('button');
    replay.id='productionReplay';
    replay.className='primary productionOnly';
    replay.type='button';
    replay.textContent='Play Again';
    replay.addEventListener('click',()=>{
      const nextRun=Number(params.get('run')||1)+1;
      const q=new URLSearchParams(location.search);
      q.set('run',String(nextRun));
      q.set('v','20260809-champion-retry1');
      location.replace('./lexicon-champion-arena-v47.html?'+q.toString());
    });
    actions.prepend(replay);
  }
}
function enforceReceiptContract(){
  if(!PROD)return;
  const summary=document.getElementById('summary');
  if(!summary||summary.classList.contains('hidden'))return;
  const box=document.getElementById('saveBox');
  const ret=document.getElementById('returnPassport');
  const title=document.getElementById('saveTitle');
  const detail=document.getElementById('saveDetail');
  const record=receiptRecord();
  const saved=Boolean(box?.classList.contains('saved'));

  if(saved&&record.receipt){
    if(title) title.textContent=record.passed?'Firebase Saved ✓ • PASS':'Firebase Saved ✓ • NOT PASS';
    if(detail) detail.textContent=`Mastery ${record.accuracy}% • Receipt ${record.receipt}`;
  }

  if(ret){
    const canReturn=saved&&record.passed&&Boolean(record.receipt);
    ret.disabled=!canReturn;
    ret.textContent=canReturn?'Return to Passport':saved?'ยังไม่ผ่าน • เล่นใหม่':'กำลังบันทึก Firebase…';
    if(ret.dataset.receiptGuard!=='1'){
      ret.dataset.receiptGuard='1';
      ret.addEventListener('click',event=>{
        const current=receiptRecord();
        const boxNow=document.getElementById('saveBox');
        const canGo=Boolean(boxNow?.classList.contains('saved')&&current.passed&&current.receipt);
        if(!canGo){
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        location.replace(passportUrl(current));
      },true);
    }
  }

  ensureReplayButton(record);

  if(saved&&record.passed&&record.receipt&&!mobileReturnTimer){
    mobileReturnTimer=setTimeout(()=>{
      const current=receiptRecord();
      if(current.passed&&current.receipt)location.replace(passportUrl(current));
    },2600);
  }
  if((!saved||!record.passed||!record.receipt)&&mobileReturnTimer){
    clearTimeout(mobileReturnTimer);
    mobileReturnTimer=0;
  }
}
const style=document.createElement('style');
style.textContent='.lca-production .ew-rotation-badge,.lca-production .qaOnly{display:none!important}';
document.head.appendChild(style);
function apply(){hideProductionMetadata();applyRankPolicy();enforceReceiptContract()}
function scheduleApply(){
  if(applyQueued)return;
  applyQueued=true;
  queueMicrotask(()=>{applyQueued=false;apply()});
}
apply();
const observer=new MutationObserver(scheduleApply);
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
window.addEventListener('pagehide',()=>{clearTimeout(mobileReturnTimer);observer.disconnect()},{once:true});
window.LEXICON_CHAMPION_V47_POLISH=Object.freeze({version:VERSION,production:PROD,mobileView:MOBILE,computeRank,receiptRecord});
})();
