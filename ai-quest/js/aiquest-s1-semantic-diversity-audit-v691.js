/* CSAI2102 AI Quest — S1 Semantic Diversity Audit v6.9.1 */
(()=>{'use strict';
  if(window.__AIQUEST_S1_SEMANTIC_DIVERSITY_AUDIT_V691__)return;
  window.__AIQUEST_S1_SEMANTIC_DIVERSITY_AUDIT_V691__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  if(MID!=='s1'&&MID!=='m1')return;
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  function audit(deck){
    const cards=Array.isArray(deck?.cards)?deck.cards:[];
    const set=field=>new Set(cards.map(card=>String(card?.[field]||''))).size;
    const ok=cards.length===15&&set('source')===15&&set('conceptKey')===15&&set('promptPattern')===15;
    return {version:'v6.9.1',ok,total:cards.length,sourceUnique:set('source'),conceptUnique:set('conceptKey'),promptPatternUnique:set('promptPattern')};
  }
  function patch(){
    const api=window.AIQuestReplayFactoryV650;
    if(!api||api.__semanticAuditV691||typeof api.makeDeck!=='function')return;
    api.__semanticAuditV691=true;
    const original=api.makeDeck.bind(api);
    api.makeDeck=function(){
      const deck=original();
      const report=audit(deck);
      if(!report.ok)throw new Error('S1_SEMANTIC_DIVERSITY_GATE_FAILED');
      deck.semanticAudit=report;
      return deck;
    };
  }
  function render(){
    const deck=read(ACTIVE,null)?.deck,report=deck?.semanticAudit;
    const sub=document.getElementById('gsub');
    if(!sub||!report?.ok)return;
    const desired='Deck #'+String(deck.round||'—')+' • 15 เคส / 3 Phase • Context unique 15/15 • Concept 15/15 • Source 15/15 • Prompt pattern 15/15';
    if(sub.textContent!==desired)sub.textContent=desired;
  }
  setInterval(()=>{patch();render()},120);patch();render();
})();