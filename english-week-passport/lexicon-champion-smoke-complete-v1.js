(()=>{
'use strict';
const RELEASE='2026-08-08-LEXICON-CHAMPION-SMOKE-COMPLETE-V1';
const q=new URLSearchParams(location.search);
const SMOKE=q.get('smoke')==='1'||q.get('gameTestMode')==='1'||q.get('qa')==='1';
if(!SMOKE)return;
let sent=false;
function buildResult(){
  try{
    const api=window.LEXICON_CHAMPION_V47;
    const evidence=api?.getReceipt?.()||{};
    return {
      completed:true,
      gameId:'final_boss',
      playerId:api?.PID||q.get('pid')||'',
      score:Number(evidence.score??api?.state?.score??0),
      bodyPassed:Number(evidence.bodyPassed??api?.state?.bodyPassed??0),
      voiceScore:Number(evidence.voiceScore??api?.state?.voiceScore??0),
      mastery:Number(evidence.mastery??api?.state?.mastery??0),
      missionSet:api?.SET||'',
      release:RELEASE,
      at:new Date().toISOString(),
      evidence
    };
  }catch(e){
    return {completed:true,gameId:'final_boss',release:RELEASE,at:new Date().toISOString(),bridgeError:String(e?.message||e)};
  }
}
function emit(){
  if(sent)return;
  const summary=document.getElementById('summary');
  if(!summary||summary.classList.contains('hidden'))return;
  sent=true;
  const result=buildResult();
  window.LEXICON_CHAMPION_LAST_RESULT=result;
  try{parent.postMessage({type:'LEXICON_GAME_RESULT_READY',gameId:'final_boss',result},location.origin)}catch(_){}
  try{parent.postMessage({type:'LEXICON_SMOKE_COMPLETE',gameId:'final_boss',result},location.origin)}catch(_){}
}
const obs=new MutationObserver(emit);
const summary=document.getElementById('summary');
if(summary)obs.observe(summary,{attributes:true,attributeFilter:['class']});
setInterval(emit,300);
window.LEXICON_CHAMPION_SMOKE_COMPLETE={version:RELEASE,emit};
})();
