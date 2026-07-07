/* CSAI2102 S2 Bootstrap v7.0.0 — event-driven safe layers */
(()=>{'use strict';
  if(window.__AQ_S2_BOOTSTRAP_700__)return;
  window.__AQ_S2_BOOTSTRAP_700__=true;
  const queue=[
    ['next-recovery','./js/aiquest-s2-next-recovery-v700.js?v=20260707-next700',()=>!!window.__AQ_S2_NEXT_RECOVERY_V700__],
    ['evidence','./js/aiquest-s2-evidence-v699.js?v=20260707-evidence699',()=>!!window.__AQ_S2_EVIDENCE_V699__],
    ['semantic-evidence','./js/aiquest-s2-semantic-evidence-v699.js?v=20260707-semanticevidence699',()=>!!window.__AQ_S2_SEMANTIC_EVIDENCE_V699__]
  ];
  const wait=(check,ms)=>new Promise(resolve=>{const end=Date.now()+ms;const tick=()=>{if(check()||Date.now()>=end)return resolve(check());setTimeout(tick,25);};tick();});
  async function load(name,src,check){
    if(check())return true;
    const id='aqS2Bootstrap700_'+name;let node=document.getElementById(id);
    if(!node){node=document.createElement('script');node.id=id;node.src=src;node.async=false;document.head.appendChild(node);}
    return wait(check,1600);
  }
  window.AIQuestS2DecoratorsReady=(async()=>{for(const [name,src,check] of queue){const ok=await load(name,src,check);if(!ok)console.warn('[AI Quest S2] safe layer unavailable:',name);}return true;})();
})();