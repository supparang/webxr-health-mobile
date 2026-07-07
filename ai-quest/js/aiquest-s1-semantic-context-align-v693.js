/* CSAI2102 AI Quest — S1 Semantic Context Alignment v6.9.3
   The runtime context gate rewrites the visible Case identity. Semantic S1 cards
   therefore enter the gate with their bare place name, allowing the gate to
   replace that exact place inside the prompt before the copy-polish layer renders it.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S1_SEMANTIC_CONTEXT_ALIGN_V693__)return;
  window.__AIQUEST_S1_SEMANTIC_CONTEXT_ALIGN_V693__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  if(MID!=='s1'&&MID!=='m1')return;
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  function patch(){
    const api=window.AIQuestReplayFactoryV650;
    if(!api||api.__semanticContextAlignV693||typeof api.makeDeck!=='function')return;
    api.__semanticContextAlignV693=true;
    const original=api.makeDeck.bind(api);
    api.makeDeck=function(){
      const deck=original();
      if(!deck?.semanticAudit?.ok||!Array.isArray(deck.cards))return deck;
      deck.cards.forEach(card=>{
        const place=clean(card.contextBase||String(card.context||'').split('•').slice(-1).join('•'));
        if(!place)return;
        card.semanticFocus=clean(card.scenarioFocus||String(card.context||'').split('•')[0]);
        card.semanticPlace=place;
        /* v674's context gate uses card.context as its replacement needle. */
        card.context=place;
        card.contextSignature=place;
      });
      deck.semanticContextAlignment={version:'v6.9.3',ready:true};
      return deck;
    };
  }
  setInterval(patch,80);patch();
})();