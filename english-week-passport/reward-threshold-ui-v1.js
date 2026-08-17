(()=>{
'use strict';
const VERSION='2026-08-17-REWARD-THRESHOLD-UI-V2-FIRST28';
const PASS=80;
const WINNERS=28;
function patchTeacher(){
  const panel=document.getElementById('rewardPanel');
  if(!panel)return;
  panel.querySelectorAll('.note').forEach(el=>{
    const t=el.textContent||'';
    if(t.includes('Eligible = Journey complete + Lens Hunt complete')){
      el.textContent=`Eligible = Journey complete + Lens Hunt ≥${PASS}%. Rank by qualifiedAt (the later of Journey finishedAt and qualifying Bonus firstCompletedAt).`;
    }
  });
  panel.querySelectorAll('strong').forEach(el=>{
    if((el.textContent||'').includes('First 20 Finishers + Bonus')){
      el.textContent=(el.textContent||'').replace('First 20 Finishers + Bonus',`First ${WINNERS} Finishers + Bonus`);
    }
  });
  panel.querySelectorAll('.status').forEach(el=>{
    let t=el.textContent||'';
    t=t.replace(/\/(?:20) eligible/g,`/${WINNERS} eligible`);
    t=t.replace('bonus timestamps','qualifying bonus timestamps');
    el.textContent=t;
  });
}
function patchPassport(){
  const screen=document.getElementById('screen');
  if(!screen)return;
  const walker=document.createTreeWalker(screen,NodeFilter.SHOW_ELEMENT);
  let node;
  while((node=walker.nextNode())){
    const t=node.textContent||'';
    if(!t.includes('Lexicon Lens Hunt'))continue;
    if(node.dataset?.rewardThresholdPatched==='2')continue;
    const leaves=[...node.querySelectorAll('*')].filter(el=>el.children.length===0);
    leaves.forEach(el=>{
      const txt=el.textContent||'';
      if(txt.includes('20 คนแรก/รอบ')){
        el.textContent=txt.replace('20 คนแรก/รอบ',`28 คนแรก/รอบ`);
      }
      if((el.textContent||'').includes('28 คนแรก/รอบ')&&!(el.textContent||'').includes('≥80%')){
        el.textContent=(el.textContent||'').replace('28 คนแรก/รอบ',`ผ่าน ≥${PASS}% + 28 คนแรก/รอบ`);
      }
    });
    node.dataset.rewardThresholdPatched='2';
  }
}
function patch(){patchTeacher();patchPassport();}
const obs=new MutationObserver(patch);
obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
addEventListener('DOMContentLoaded',patch,{once:true});
setTimeout(patch,250);setTimeout(patch,1000);
window.EW_REWARD_THRESHOLD_UI=Object.freeze({version:VERSION,threshold:PASS,winnerLimit:WINNERS,patch});
})();