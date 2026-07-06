/* CSAI2102 S2 Agent Builder — Replay Audit Capture v6.7.8
   Captures the actual generated cards/policies for the current S2 deck
   and attaches them to the submitted attempt for teacher-side audit.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_REPLAY_AUDIT_CAPTURE_V678__)return;
  window.__AIQUEST_S2_REPLAY_AUDIT_CAPTURE_V678__=true;

  const KEY='CSAI2102_S2_REPLAY_AUDIT_CURRENT_V678';
  const clean=value=>String(value==null?'':value).trim();
  const profileId=()=>{try{return clean((window.AIQuestStorage?.getProfile?.()||JSON.parse(localStorage.getItem('CSAI2102_AIQUEST_PROFILE_V421')||'{}')).studentId)||'guest'}catch(e){return'guest'}};
  const storeKey=()=>KEY+'_'+profileId().replace(/[^a-z0-9_-]/gi,'_');
  const write=value=>{try{sessionStorage.setItem(storeKey(),JSON.stringify(value));localStorage.setItem(storeKey(),JSON.stringify(value))}catch(e){}};
  const read=()=>{for(const box of [sessionStorage,localStorage]){try{const value=JSON.parse(box.getItem(storeKey())||'null');if(value)return value}catch(e){}}return null};
  const normalizeCard=card=>({
    id:clean(card.id),
    phase:clean(card.phase),
    kind:clean(card.kind),
    subtype:clean(card.subtype),
    skill:clean(card.skill),
    context:clean(card.context),
    policy:clean(card.answerPolicy||'base'),
    fingerprint:clean(card.answerFingerprint||[card.context,card.skill,card.answerPolicy||'base'].join('|'))
  });

  function wrapDeck(){
    const api=window.AIQuestS2AgentDeckV672;
    if(!api||api.__replayAuditCaptureV678||typeof api.buildDeck!=='function')return false;
    api.__replayAuditCaptureV678=true;
    const original=api.buildDeck.bind(api);
    api.buildDeck=function(){
      const deck=original();
      const cards=(deck.cards||[]).map(normalizeCard);
      const audit={
        version:'v6.7.8',
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
      write(audit);
      return deck;
    };
    return true;
  }

  function wrapSubmit(){
    const sync=window.AIQuestSync;
    if(!sync||sync.__replayAuditCaptureV678||typeof sync.submitAttempt!=='function')return false;
    sync.__replayAuditCaptureV678=true;
    const original=sync.submitAttempt.bind(sync);
    sync.submitAttempt=function(payload){
      const mission=clean(payload&& (payload.sessionId||payload.missionId)).toLowerCase();
      if(mission==='s2'){
        const audit=window.AIQuestS2ReplayAuditCurrent||read();
        if(audit){
          payload.extraJson=Object.assign({},payload.extraJson||{}, {
            replayAudit:audit,
            replayAuditVersion:'v6.7.8',
            replayAuditCaptured:true
          });
        }
      }
      return original(payload);
    };
    return true;
  }

  function init(){
    const deck=wrapDeck(),submit=wrapSubmit();
    if(!deck||!submit)setTimeout(init,180);
  }
  init();
})();