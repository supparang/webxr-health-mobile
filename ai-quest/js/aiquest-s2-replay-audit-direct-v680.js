/* CSAI2102 S2 Replay Audit Direct v6.8.0
   Installs only after answer-policy rotation is ready, then:
   1) captures generated cards/context/policy/fingerprint at deck creation
   2) injects compact audit evidence directly into CloudLogger.sendAttempt
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_REPLAY_AUDIT_DIRECT_V680__)return;

  const KEY='CSAI2102_S2_REPLAY_AUDIT_CURRENT_V680';
  const clean=value=>String(value==null?'':value).trim();
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||JSON.parse(localStorage.getItem('CSAI2102_AIQUEST_PROFILE_V421')||'{}')}catch(e){return{}}};
  const storeKey=()=>KEY+'_'+clean(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const save=audit=>{try{const text=JSON.stringify(audit);sessionStorage.setItem(storeKey(),text);localStorage.setItem(storeKey(),text)}catch(e){}};
  const load=()=>{for(const box of [sessionStorage,localStorage]){try{const v=JSON.parse(box.getItem(storeKey())||'null');if(v)return v}catch(e){}}return null};
  const asCard=card=>({
    skill:clean(card.skill),
    context:clean(card.context),
    policy:clean(card.answerPolicy||'base'),
    fingerprint:clean(card.answerFingerprint||[card.context,card.skill,card.answerPolicy||'base'].join('|')),
    phase:clean(card.phase),
    type:clean(card.subtype||card.kind)
  });
  const isS2=payload=>clean(payload&&(payload.sessionId||payload.missionId)).toLowerCase()==='s2';
  let deckReady=false,sendReady=false;

  function patchDeck(){
    const api=window.AIQuestS2AgentDeckV672;
    if(!api||!window.__AIQUEST_S2_ANSWER_ROTATION_V677__||api.__replayAuditDirectV680||typeof api.buildDeck!=='function')return false;
    api.__replayAuditDirectV680=true;
    const original=api.buildDeck.bind(api);
    api.buildDeck=function(){
      const deck=original();
      const cards=(deck.cards||[]).map(asCard);
      const audit={
        version:'v6.8.0',
        deckId:clean(deck.id),
        deckRound:Number(deck.round||0),
        createdAt:new Date().toISOString(),
        noRepeatWindow:Number((deck.answerRotation&&deck.answerRotation.window)||deck.usedWindow||4),
        cardCount:cards.length,
        contexts:[...new Set(cards.map(card=>card.context).filter(Boolean))],
        policies:[...new Set(cards.map(card=>card.policy).filter(Boolean))],
        cards
      };
      window.AIQuestS2ReplayAuditCurrent=audit;
      save(audit);
      return deck;
    };
    return true;
  }

  function patchCloud(){
    const cloud=window.AIQuestCloudLogger;
    if(!cloud||cloud.__replayAuditDirectV680||typeof cloud.sendAttempt!=='function')return false;
    cloud.__replayAuditDirectV680=true;
    const original=cloud.sendAttempt.bind(cloud);
    cloud.sendAttempt=function(payload){
      if(isS2(payload)){
        const audit=window.AIQuestS2ReplayAuditCurrent||load();
        payload.extraJson=Object.assign({},payload.extraJson||{}, {
          replayAuditCaptured:!!audit,
          replayAuditVersion:'v6.8.0',
          replayAudit:audit||null
        });
        try{localStorage.setItem('CSAI2102_S2_REPLAY_AUDIT_LAST_SEND_V680',JSON.stringify({at:new Date().toISOString(),attemptId:payload.attemptId,captured:!!audit,deckId:audit&&audit.deckId,deckRound:audit&&audit.deckRound}))}catch(e){}
      }
      return original(payload);
    };
    return true;
  }

  function install(){
    deckReady=deckReady||patchDeck();
    sendReady=sendReady||patchCloud();
    if(deckReady&&sendReady){
      window.__AIQUEST_S2_REPLAY_AUDIT_DIRECT_V680__=true;
      clearInterval(timer);
      console.log('[AIQuest] S2 replay audit direct v6.8.0 ready');
    }
  }
  const timer=setInterval(install,60);
  install();
})();