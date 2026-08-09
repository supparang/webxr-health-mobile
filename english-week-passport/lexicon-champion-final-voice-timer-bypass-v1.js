(()=>{
'use strict';
const VERSION='2026-08-09-LCA47-FINAL-VOICE-TIMER-BYPASS-V1';
if(window.__LCA_FINAL_VOICE_TIMER_BYPASS__?.version===VERSION)return;
const previousSetTimeout=window.setTimeout.bind(window);
window.setTimeout=function(fn,delay,...args){
  const st=window.LEXICON_CHAMPION_V47?.state;
  const finalVoiceReady=Number(delay)===350 && Number(st?.bossAttack||0)>=3 && Number(st?.voiceScore||0)>=52;
  if(finalVoiceReady){
    try{
      const fb=document.getElementById('feedback');
      if(fb){fb.className='feedback good';fb.textContent='Final Voice Cleared!';}
    }catch(_){}
    return previousSetTimeout(fn,0,...args);
  }
  return previousSetTimeout(fn,delay,...args);
};
window.__LCA_FINAL_VOICE_TIMER_BYPASS__={version:VERSION};
try{document.documentElement.dataset.lcaFinalVoiceBypass='v1'}catch(_){}
console.info('[LEXICON Champion] Final Voice Timer Bypass V1 ready');
})();