(()=>{
'use strict';
const VERSION='2026-08-08-LEXICON-CHAMPION-V472-MOBILE-SMOKE-RETURN';
const params=new URLSearchParams(location.search);
const PROD=params.get('from')==='passport'&&params.get('authority')==='firebase'&&params.get('qa')!=='1'&&params.get('submit')!=='0';
const MOBILE=params.get('view')==='mobile';
let mobileReturnTimer=0;

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
  rank.dataset.rankPolicy='mastery90-voice75-body2-noFallback-for-S';
}
function hideProductionMetadata(){
  if(!PROD)return;
  document.documentElement.classList.add('lca-production');
  document.querySelectorAll('.ew-rotation-badge,.qaOnly').forEach(el=>el.classList.add('hidden'));
  const subtitle=document.getElementById('subtitle');
  if(subtitle)subtitle.textContent='GAME 5 • FINAL CHALLENGE';
}
function mobilePassportUrl(){
  const p=new URLSearchParams({resume:'passport',fromGame:'final_boss',v:'20260808-mobile-smoke1'});
  const receipt=window.LEXICON_CHAMPION_V47?.state?.receipt;
  if(receipt)p.set('receipt',receipt);
  if(MOBILE)p.set('view','mobile');
  return './index.html?'+p.toString();
}
function installMobileReturn(){
  if(!PROD||!MOBILE)return;
  const ret=document.getElementById('returnPassport');
  if(ret&&ret.dataset.mobileReturn!=='1'){
    ret.dataset.mobileReturn='1';
    ret.addEventListener('click',event=>{
      if(ret.disabled)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      location.replace(mobilePassportUrl());
    },true);
  }
  const box=document.getElementById('saveBox');
  if(box?.classList.contains('saved')&&!mobileReturnTimer){
    mobileReturnTimer=setTimeout(()=>location.replace(mobilePassportUrl()),2200);
  }
}
const style=document.createElement('style');
style.textContent='.lca-production .ew-rotation-badge,.lca-production .qaOnly{display:none!important}';
document.head.appendChild(style);
function apply(){hideProductionMetadata();applyRankPolicy();installMobileReturn()}
apply();
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
window.addEventListener('pagehide',()=>clearTimeout(mobileReturnTimer));
window.LEXICON_CHAMPION_V47_POLISH=Object.freeze({version:VERSION,production:PROD,mobileView:MOBILE,computeRank});
})();
