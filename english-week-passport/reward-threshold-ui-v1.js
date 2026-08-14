(()=>{
'use strict';
const VERSION='2026-08-14-REWARD-THRESHOLD-UI-V1';
const PASS=80;
function patchTeacher(){
  const panel=document.getElementById('rewardPanel');
  if(!panel)return;
  panel.querySelectorAll('.note').forEach(el=>{
    const t=el.textContent||'';
    if(t.includes('Eligible = Journey complete + Lens Hunt complete')){
      el.textContent=`Eligible = Journey complete + Lens Hunt ≥${PASS}%. Rank by qualifiedAt (the later of Journey finishedAt and qualifying Bonus firstCompletedAt).`;
    }
  });
  panel.querySelectorAll('.status').forEach(el=>{
    if((el.textContent||'').includes('bonus timestamps'))el.textContent=el.textContent.replace('bonus timestamps','qualifying bonus timestamps');
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
    if(node.dataset?.rewardThresholdPatched==='1')continue;
    const compact=t.replace(/\s+/g,' ');
    if(compact.includes('20 คนแรก/รอบ')&&!compact.includes('≥80%')){
      const leaves=[...node.querySelectorAll('*')].filter(el=>el.children.length===0);
      const target=leaves.find(el=>(el.textContent||'').includes('20 คนแรก/รอบ'));
      if(target)target.textContent=(target.textContent||'').replace('20 คนแรก/รอบ',`ผ่าน ≥${PASS}% + 20 คนแรก/รอบ`);
    }
    node.dataset.rewardThresholdPatched='1';
  }
}
function patch(){patchTeacher();patchPassport();}
const obs=new MutationObserver(patch);
obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
addEventListener('DOMContentLoaded',patch,{once:true});
setTimeout(patch,250);setTimeout(patch,1000);
window.EW_REWARD_THRESHOLD_UI=Object.freeze({version:VERSION,threshold:PASS,patch});
})();