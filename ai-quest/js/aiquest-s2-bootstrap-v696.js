/* CSAI2102 S2 Bootstrap v6.9.8 */
(()=>{'use strict';
  if(window.__AIQUEST_S2_BOOTSTRAP_V698__)return;
  window.__AIQUEST_S2_BOOTSTRAP_V698__=true;
  const layers=[
    ['view-guard','./js/aiquest-s2-view-guard-v698.js?v=20260707-view698',()=>!!window.__AQ_S2_VIEW_GUARD_698__],
    ['case-evidence','./js/aiquest-s2-reflection-evidence-v675.js?v=20260707-case675',()=>!!window.__AIQUEST_S2_CASE_EVIDENCE_V675__],
    ['semantic-evidence','./js/aiquest-s2-reflection-semantic-gate-v678.js?v=20260707-semantic678',()=>!!window.__AIQUEST_S2_REFLECTION_SEMANTIC_GATE_V678__],
    ['case-skillfix','./js/aiquest-s2-case-evidence-skillfix-v676.js?v=20260707-case676',()=>!!window.__AIQUEST_S2_CASE_EVIDENCE_SKILLFIX_V676__]
  ];
  const wait=(check,ms)=>new Promise(resolve=>{const end=Date.now()+ms;const tick=()=>{if(check()||Date.now()>=end)return resolve(check());setTimeout(tick,25)};tick()});
  async function load(name,src,check){
    if(check())return true;
    const id='aqS2Boot698_'+name;let node=document.getElementById(id);
    if(!node){node=document.createElement('script');node.id=id;node.src=src;node.async=false;document.head.appendChild(node);}
    return wait(check,1800);
  }
  window.AIQuestS2DecoratorsReady=(async()=>{for(const [name,src,check] of layers){const ok=await load(name,src,check);if(!ok)console.warn('[AI Quest S2] required layer unavailable:',name);}return true;})();
})();