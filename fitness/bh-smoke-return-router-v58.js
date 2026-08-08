(()=>{
'use strict';
if(window.__BH_SMOKE_RETURN_ROUTER_V58__)return;
window.__BH_SMOKE_RETURN_ROUTER_V58__=true;
const RELEASE='20260808-BALANCE-SMOKE-RETURN-ROUTER-V58';
const q=new URLSearchParams(location.search);
const testMode=q.get('gameTestMode')==='1'||q.get('isTestAttempt')==='true'||q.get('mode')==='game-test'||q.get('smoke')==='1';
if(!testMode)return;
let routed=false,timer=0;
const clean=v=>String(v||'').trim();
function testReturnUrl(){
  const raw=q.get('return')||q.get('back')||'../HeroHealth_Learning1/game-test-mode.html';
  try{
    const u=new URL(raw,location.href);
    const sid=clean(q.get('studentId')||q.get('sid')||q.get('pid'));
    if(sid){u.searchParams.set('studentId',sid);u.searchParams.set('sid',sid)}
    u.searchParams.set('smoke','1');u.searchParams.set('view','mobile');
    u.searchParams.set('returnedGame','balance-hold');u.searchParams.set('testReturn','1');
    u.searchParams.set('v',RELEASE);return u.href;
  }catch(_){return raw}
}
function routeNow(){
  if(routed)return;routed=true;clearTimeout(timer);
  const url=testReturnUrl();
  try{window.top.location.replace(url)}catch(_){location.replace(url)}
}
function summaryCounts(){
  const s=window.BH?.state||{};
  const total=Array.isArray(s.sequence)?s.sequence.length:6;
  const done=Array.isArray(s.results)?s.results.length:0;
  return{done,total,complete:total===6&&done>=6&&Number(s.index||0)>=6};
}
function patchSummary(){
  const overlay=document.getElementById('resultOverlay');
  if(!overlay||overlay.classList.contains('hidden')||!overlay.textContent.trim())return false;
  const {done,total,complete}=summaryCounts();
  const sync=document.getElementById('bhResultSync')||document.getElementById('balanceReceiptText');
  if(sync){sync.textContent=complete?'✅ Smoke Test จบครบ 6/6 • กำลังกลับหน้าทดสอบเกม…':`🧪 Smoke Test จบรอบ ${done}/${total} • ไม่กระทบ Progress • กำลังกลับหน้าทดสอบเกม…`;sync.classList?.add('ok')}
  const btn=document.getElementById('bhPassportBtn')||document.getElementById('balancePassportBtn');
  if(btn){btn.disabled=false;btn.textContent='← กลับหน้าทดสอบเกม';btn.onclick=null;btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();routeNow()},{capture:true,once:true})}
  const head=overlay.querySelector('.bh-result-head p');
  if(head&&!complete)head.textContent=`จบรอบทดสอบ • ทำได้ ${done}/${total} ท่า`;
  clearTimeout(timer);timer=setTimeout(routeNow,2800);
  overlay.dataset.smokeReturn='v58';
  return true;
}
const observer=new MutationObserver(()=>patchSummary());
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
const poll=setInterval(()=>{if(routed){clearInterval(poll);observer.disconnect();return}patchSummary()},250);
addEventListener('pagehide',()=>{clearInterval(poll);clearTimeout(timer);observer.disconnect()},{once:true});
window.BH_SMOKE_RETURN_ROUTER_V58={release:RELEASE,testMode,testReturnUrl,routeNow,summaryCounts};
console.info('[BalanceHold] Smoke return router ready',RELEASE);
})();