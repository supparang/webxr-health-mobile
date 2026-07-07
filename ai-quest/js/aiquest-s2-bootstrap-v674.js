/* CSAI2102 S2 Agent Builder Bootstrap v6.8.9
   The reflection case selector is essential. All other replay decorators are optional.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_BOOTSTRAP_V689__)return;
  window.__AIQUEST_S2_BOOTSTRAP_V689__=true;
  const essential=[
    ['case-evidence','./js/aiquest-s2-reflection-evidence-v675.js?v=20260707-case675',()=>!!window.__AIQUEST_S2_CASE_EVIDENCE_V675__],
    ['case-skillfix','./js/aiquest-s2-case-evidence-skillfix-v676.js?v=20260707-case676',()=>!!window.__AIQUEST_S2_CASE_EVIDENCE_SKILLFIX_V676__]
  ];
  const optional=[
    ['rotation','./js/aiquest-s2-answer-rotation-v677.js?v=20260706-answer677',()=>!!window.__AIQUEST_S2_ANSWER_ROTATION_V677__],
    ['audit','./js/aiquest-s2-replay-audit-direct-v680.js?v=20260706-audit681',()=>!!window.__AIQUEST_S2_REPLAY_AUDIT_DIRECT_V681__],
    ['map-order','./js/aiquest-s2-map-order-v682.js?v=20260706-maporder682',()=>!!window.__AIQUEST_S2_MAP_ORDER_V682__],
    ['parity','./js/aiquest-s2-choice-parity-v683.js?v=20260706-parity683',()=>!!window.__AIQUEST_S2_CHOICE_PARITY_V683__],
    ['near-miss','./js/aiquest-s2-distractor-depth-v684.js?v=20260706-depth684',()=>!!window.__AIQUEST_S2_DISTRACTOR_DEPTH_V684__],
    ['authorship','./js/aiquest-s2-choice-authorship-v685.js?v=20260706-authorship685',()=>!!window.__AIQUEST_S2_CHOICE_AUTHORSHIP_V685__]
  ];
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function waitFlag(check,ms=1800){const until=Date.now()+ms;while(Date.now()<until){if(check())return true;await sleep(30)}return check()}
  async function load(name,src,check){
    if(check())return true;
    const id='aiquestS2Bootstrap_'+name.replace(/[^a-z0-9]/gi,'_');
    let script=document.getElementById(id);
    if(!script){
      script=document.createElement('script');script.id=id;script.src=src;script.async=false;
      const loaded=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject});
      document.head.appendChild(script);
      try{await loaded}catch(e){console.warn('[AI Quest S2] layer failed:',name);return false}
    }
    return waitFlag(check);
  }
  async function run(items,required){
    for(const [name,src,check] of items){
      const ok=await load(name,src,check);
      if(!ok)console.warn('[AI Quest S2] '+(required?'required':'optional')+' layer unavailable:',name);
    }
    return true;
  }
  window.AIQuestS2DecoratorsReady=run(essential,true);
  window.AIQuestS2DecoratorsReady.then(()=>run(optional,false));
})();
