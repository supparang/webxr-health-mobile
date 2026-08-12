/* Sentence City • Mobile Uniform Grid V6 + Speech Hard Gate
 * Fixed two-row Blueprint + two-row Word Depot for every task.
 * Also prevents showTask() from advancing while Teacher speech is still active.
 */
(function(){
  'use strict';

  const VERSION='2026-08-12-SC-MOBILE-GRID-V6-SPEECH-HARD-GATE';
  const style=document.createElement('style');
  style.id='scMobileGridStyle';
  style.textContent=`
@media (max-width:720px){
  #mission .board{
    display:grid!important;
    grid-template-rows:12px 94px 12px 94px 44px!important;
    gap:4px!important;
    min-height:272px!important;
    height:272px!important;
    max-height:272px!important;
    overflow:hidden!important;
    padding:0!important;
  }
  #mission .slots,#mission .depot{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-template-rows:repeat(2,44px)!important;
    grid-auto-flow:row!important;
    grid-auto-rows:44px!important;
    gap:6px!important;
    width:100%!important;
    max-width:100%!important;
    height:94px!important;
    min-height:94px!important;
    max-height:94px!important;
    padding:0 2px!important;
    overflow:hidden!important;
    justify-content:stretch!important;
    align-content:start!important;
    align-items:stretch!important;
  }
  #mission .slots > *,#mission .depot > *,#mission .slot,#mission .word,#mission .depot button,#mission .depot [draggable="true"]{
    box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;
    width:100%!important;min-width:0!important;max-width:none!important;height:44px!important;min-height:44px!important;max-height:44px!important;
    margin:0!important;padding:5px 7px!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    line-height:1.05!important;font-size:clamp(.58rem,2.55vw,.72rem)!important;
  }
  #mission .control{position:static!important;width:100%!important;min-height:44px!important;height:44px!important;max-height:44px!important;margin:0!important;align-self:stretch!important;z-index:1!important}
}
@media (max-width:390px){
  #mission .board{grid-template-rows:10px 89px 10px 89px 42px!important;gap:3px!important;min-height:252px!important;height:252px!important;max-height:252px!important}
  #mission .slots,#mission .depot{grid-template-rows:repeat(2,42px)!important;grid-auto-rows:42px!important;gap:5px!important;height:89px!important;min-height:89px!important;max-height:89px!important}
  #mission .slots > *,#mission .depot > *,#mission .slot,#mission .word,#mission .depot button,#mission .depot [draggable="true"]{height:42px!important;min-height:42px!important;max-height:42px!important;padding:4px 5px!important;font-size:.58rem!important}
  #mission .control{height:42px!important;min-height:42px!important;max-height:42px!important}
}
`;
  document.head.appendChild(style);

  function applyGrid(){
    const mission=document.getElementById('mission');
    const slots=document.getElementById('slots');
    const depot=document.getElementById('depot');
    if(!mission||!slots||!depot)return;
    mission.classList.add('sc-uniform-tokens','sc-grid-always-2col','sc-fixed-submit-lane');
    mission.classList.remove('sc-dynamic-token-rows');
    mission.dataset.slotCount=String(slots.children.length);
    mission.dataset.wordCount=String(depot.children.length);
    mission.dataset.slotRows='2';
    mission.dataset.wordRows='2';
  }

  let raf=0;
  const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;applyGrid();});};
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  applyGrid();

  /* Android Chrome can report speech idle/onend slightly before audible output
     is truly finished. Track a conservative minimum duration for every utterance,
     then gate showTask() on BOTH synth idle and the minimum audible window. */
  const synth=window.speechSynthesis;
  let speechMinUntil=0;
  if(synth&&typeof synth.speak==='function'&&!synth.__scSpeechHardGate){
    const nativeSpeak=synth.speak.bind(synth);
    synth.speak=function(utterance){
      try{
        const text=String(utterance?.text||'');
        const rate=Math.max(.55,Number(utterance?.rate)||1);
        const estimate=Math.min(15000,Math.max(4200,1200+(text.length*145/rate)));
        speechMinUntil=Math.max(speechMinUntil,Date.now()+estimate);
      }catch(_){}
      return nativeSpeak(utterance);
    };
    synth.__scSpeechHardGate=true;
  }

  function installTaskGate(){
    if(typeof window.showTask!=='function'){setTimeout(installTaskGate,80);return;}
    if(window.showTask.__scSpeechHardGate)return;
    const original=window.showTask;
    let waiting=false;
    function guardedShowTask(){
      const args=arguments;
      const now=Date.now();
      const active=Boolean(synth&&(synth.speaking||synth.pending));
      if(active||now<speechMinUntil){
        if(waiting)return;
        waiting=true;
        let idleSince=0;
        const wait=()=>{
          const t=Date.now();
          const busy=Boolean(synth&&(synth.speaking||synth.pending));
          if(busy)idleSince=0;else if(!idleSince)idleSince=t;
          if(!busy&&t>=speechMinUntil&&idleSince&&t-idleSince>=450){waiting=false;original.apply(window,args);return;}
          if(t-now>=18000){waiting=false;original.apply(window,args);return;}
          setTimeout(wait,90);
        };
        wait();
        return;
      }
      original.apply(window,args);
    }
    guardedShowTask.__scSpeechHardGate=true;
    window.showTask=guardedShowTask;
    console.info('[LEXICON X] Sentence City Speech Hard Gate ready',VERSION);
  }
  installTaskGate();

  window.SENTENCE_CITY_MOBILE_GRID={version:VERSION,apply:applyGrid};
})();
