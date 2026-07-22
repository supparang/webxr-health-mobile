(()=>{
'use strict';
const q=new URLSearchParams(location.search);
const returnUrl=q.get('return');
if(!returnUrl)return;
const studentId=q.get('studentId')||'';
const zone=q.get('zone')||'hygiene';
const gameId=q.get('gameId')||'handwash';
let latest=null;
function makeEventId(){return `${gameId}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function goBack(){
 const result=latest||{};
 const u=new URL(returnUrl,location.href);
 u.searchParams.set('hhReturn','game');u.searchParams.set('studentId',studentId);u.searchParams.set('zone',zone);u.searchParams.set('gameId',gameId);
 u.searchParams.set('passed',String(result.passed===true||result.techniquePassed===true));u.searchParams.set('score',String(Number(result.score)||0));u.searchParams.set('accuracy',String(Number(result.accuracy)||0));u.searchParams.set('eventId',result.eventId||makeEventId());
 location.href=u.href;
}
function install(){
 const dialog=document.getElementById('handwashTopLayerSummaryR24');if(!dialog)return;
 const actions=dialog.querySelector('.hw24-actions');if(!actions||dialog.querySelector('#hhPlatformReturn'))return;
 const b=document.createElement('button');b.id='hhPlatformReturn';b.type='button';b.textContent='กลับ HeroHealth';b.style.background='#67eda9';b.style.color='#062519';b.addEventListener('click',goBack);actions.prepend(b);
}
addEventListener('herohealth:game-result',e=>{latest=e.detail||latest;install();},{capture:true});
new MutationObserver(install).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',install,{once:true});
})();