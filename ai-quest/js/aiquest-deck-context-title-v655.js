/* CSAI2102 Deck Context Title v6.5.5 */
(()=>{'use strict';
  if(window.__AIQUEST_DECK_CONTEXT_TITLE_V655__)return;
  window.__AIQUEST_DECK_CONTEXT_TITLE_V655__=true;
  const mid=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const coreKey='CSAI2102_ACTIVE_REPLAY_V674_'+mid;
  const s2Key='CSAI2102_ACTIVE_S2_V674';
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  function adjust(deck){
    if(!deck||!Array.isArray(deck.cards))return deck;
    deck.cards.forEach(card=>{
      if(!card?.scenarioFocus||!card?.contextBase||card.__contextTitleV655)return;
      const old=String(card.context||'');
      const next=String(card.scenarioFocus)+' • '+String(card.contextBase);
      card.context=next;
      if(old&&String(card.prompt||'').includes(old))card.prompt=String(card.prompt).split(old).join(next);
      card.__contextTitleV655=true;
    });
    return deck;
  }
  function stored(key){const snapshot=read(key,null);if(snapshot?.deck){adjust(snapshot.deck);write(key,snapshot);}}
  function wrap(api,method){
    if(!api||api.__contextTitleV655||typeof api[method]!=='function')return;
    api.__contextTitleV655=true;
    const original=api[method].bind(api);
    api[method]=function(){return adjust(original())};
  }
  function apply(){
    stored(coreKey);stored(s2Key);
    wrap(window.AIQuestReplayFactoryV650,'makeDeck');
    wrap(window.AIQuestS2AgentDeckV672,'buildDeck');
  }
  setInterval(apply,150);apply();
})();
