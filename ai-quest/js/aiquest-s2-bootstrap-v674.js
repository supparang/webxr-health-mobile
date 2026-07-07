/* CSAI2102 S2 Agent Builder Bootstrap v6.8.8
   Decorative deck layers improve replay quality but must never prevent a learner from starting.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_BOOTSTRAP_V688__)return;
  window.__AIQUEST_S2_BOOTSTRAP_V688__=true;
  const plan=[
    ['rotation','./js/aiquest-s2-answer-rotation-v677.js?v=20260706-answer677',()=>!!window.__AIQUEST_S2_ANSWER_ROTATION_V677__],
    ['audit','./js/aiquest-s2-replay-audit-direct-v680.js?v=20260706-audit681',()=>!!window.__AIQUEST_S2_REPLAY_AUDIT_DIRECT_V681__],
    ['map-order','./js/aiquest-s2-map-order-v682.js?v=20260706-maporder682',()=>!!window.__AIQUEST_S2_MAP_ORDER_V682__],
    ['parity','./js/aiquest-s2-choice-parity-v683.js?v=20260706-parity683',()=>!!window.__AIQUEST_S2_CHOICE_PARITY_V683__],
    ['near-miss','./js/aiquest-s2-distractor-depth-v684.js?v=20260706-depth684',()=>!!window.__AIQUEST_S2_DISTRACTOR_DEPTH_V684__],
    ['authorship','./js/aiquest-s2-choice-authorship-v685.js?v=20260706-authorship685',()=>!!window.__AIQUEST_S2_CHOICE_AUTHORSHIP_V685__],
    ['reflection-evidence','./js/aiquest-s2-reflection-evidence-v681.js?v=20260706-evidence681',()=>!!window.__AIQUEST_S2_REFLECTION_EVIDENCE_V681__],
    ['evidence-dropdown','./js/aiquest-s2-evidence-dropdown-v686.js?v=20260706-dropdown686',()=>!!window.__AIQUEST_S2_EVIDENCE_DROPDOWN_V686__],
    ['case-picker','./js/aiquest-s2-evidence-case-picker-v687.js?v=20260706-picker687',()=>!!window.__AIQUEST_S2_EVIDENCE_CASE_PICKER_V687__]
  ];
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function waitFlag(check,ms=2600){const until=Date.now()+ms;while(Date.now()<until){if(check())return true;await sleep(35)}return check()}
  async function load(name,src,check){
    if(check())return true;
    const id='aiquestS2Bootstrap_'+name.replace(/[^a-z0-9]/gi,'_');
    let script=document.getElementById(id);
    if(!script){
      script=document.createElement('script');script.id=id;script.src=src;script.async=false;
      const loaded=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject});
      document.head.appendChild(script);
      try{await loaded}catch(e){console.warn('[AI Quest S2] optional layer failed:',name);return false}
    }
    return waitFlag(check);
  }
  async function prepare(){
    for(const [name,src,check] of plan){
      const ok=await load(name,src,check);
      if(!ok)console.warn('[AI Quest S2] optional layer unavailable:',name);
    }
    return true;
  }
  window.AIQuestS2DecoratorsReady=prepare();
})();
