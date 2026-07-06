/* CSAI2102 S2 Map Order Anti-Memorization v6.8.2
   Shuffles the visible row order for PEAS Board and Sensor/Actuator mechanics.
   Avoids reusing the same row sequence for each mechanic across the latest 4 decks.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_MAP_ORDER_V682__)return;

  const api=window.AIQuestS2AgentDeckV672;
  if(!api||typeof api.buildDeck!=='function')return;
  const ROOT='CSAI2102_S2_MAP_ORDER_V682';
  const WINDOW=4;
  const clean=value=>String(value==null?'':value).trim();
  const profileId=()=>{try{return clean((window.AIQuestStorage?.getProfile?.()||JSON.parse(localStorage.getItem('CSAI2102_AIQUEST_PROFILE_V421')||'{}')).studentId||'guest').replace(/[^a-z0-9_-]/gi,'_')}catch(e){return'guest'}};
  const key=()=>ROOT+'_'+profileId();
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(key())||'{"rounds":[]}');return value&&Array.isArray(value.rounds)?value:{rounds:[]}}catch(e){return{rounds:[]}}};
  const write=value=>{try{localStorage.setItem(key(),JSON.stringify(value))}catch(e){}};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const shuffle=value=>{const out=[...(value||[])];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out};
  const rowKey=row=>[clean(row.answer),clean(row.text)].join('¦');
  const signature=rows=>(rows||[]).map(rowKey).join(' → ');
  const skillKey=card=>clean(card.skill||'map');

  function chooseOrder(card,blocked){
    const source=(card.cards||[]).map(copy);
    if(source.length<2)return source;
    let chosen=source;
    for(let attempt=0;attempt<36;attempt++){
      const candidate=shuffle(source);
      const order=signature(candidate);
      if(!blocked.has(order)){chosen=candidate;break}
    }
    return chosen;
  }

  const original=api.buildDeck.bind(api);
  api.buildDeck=function(){
    const deck=original();
    const memory=read();
    const recent=memory.rounds.slice(-WINDOW);
    const usedBySkill={};
    recent.forEach(round=>(round.maps||[]).forEach(item=>{
      const skill=clean(item.skill);
      if(!skill)return;
      (usedBySkill[skill]||(usedBySkill[skill]=new Set())).add(clean(item.signature));
    }));

    const maps=[];
    (deck.cards||[]).forEach(card=>{
      if(card.subtype!=='map'||!Array.isArray(card.cards))return;
      const skill=skillKey(card),blocked=usedBySkill[skill]||new Set();
      const ordered=chooseOrder(card,blocked);
      card.cards=ordered;
      const order=signature(ordered);
      maps.push({skill,context:clean(card.context),signature:order,answers:ordered.map(item=>clean(item.answer))});
      blocked.add(order);usedBySkill[skill]=blocked;
    });

    memory.rounds.push({deckId:clean(deck.id),round:Number(deck.round||0),at:Date.now(),maps});
    memory.rounds=memory.rounds.slice(-WINDOW);write(memory);

    deck.mapOrderAudit={version:'v6.8.2',window:WINDOW,maps};
    const audit=window.AIQuestS2ReplayAuditCurrent;
    if(audit&&clean(audit.deckId)===clean(deck.id)){
      audit.mapOrderAudit=deck.mapOrderAudit;
      audit.presentationOrderVersion='v6.8.2';
    }
    return deck;
  };

  window.__AIQUEST_S2_MAP_ORDER_V682__=true;
  console.log('[AIQuest] S2 map row order anti-memorization v6.8.2 ready');
})();