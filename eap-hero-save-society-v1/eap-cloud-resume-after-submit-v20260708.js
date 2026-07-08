/* =========================================================
   EAP Hero Cloud Resume After Submit v20260708
   - After a local portfolio/evidence change, poll player_resume.
   - Unlock only updates after Cloud/Sheet returns verified records.
   - Does not send new payloads itself; Sheet sync/evidence sync still do that.
========================================================= */
(function(){
'use strict';

const VERSION='v20260708-EAP-CLOUD-RESUME-AFTER-SUBMIT-V1';
const STATE_KEY='EAP_HERO_PROGRESS_V3';
let lastSignature='';
let timer=null;

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(e){return {}}}
function signature(){
  const s=readState();
  const parts=[];
  ['portfolio','evidence','attempts'].forEach(k=>{
    const arr=Array.isArray(s[k])?s[k]:[];
    parts.push(k+':'+arr.length);
    const last=arr[arr.length-1]||{};
    parts.push([last.sessionId||last.session||last.routeId||'',last.skill||'',last.score||last.latestScore||'',last.at||last.latestAt||last.evidenceId||''].join('|'));
  });
  return parts.join('::');
}
function pollResume(delay){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    if(window.EAPPlayerResume&&typeof window.EAPPlayerResume.sync==='function'){
      window.EAPPlayerResume.sync({silent:true});
    }
  },delay||1800);
}
function check(){
  const sig=signature();
  if(sig&&lastSignature&&sig!==lastSignature){
    pollResume(1800);
    setTimeout(()=>pollResume(4200),4200);
    setTimeout(()=>pollResume(9000),9000);
  }
  lastSignature=sig;
}
function start(){
  lastSignature=signature();
  window.addEventListener('storage',check);
  window.addEventListener('eap:resume-synced',()=>{lastSignature=signature();});
  new MutationObserver(check).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setInterval(check,1600);
}
window.EAPCloudResumeAfterSubmit={version:VERSION,refresh:()=>pollResume(500)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();