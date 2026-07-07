/* CSAI2102 AI Quest — S2 Final Fingerprint Window v6.8.1
   Enforces no repeated final answer fingerprints across the latest four accepted decks.
   It wraps the post-rotation deck builder and rolls back rejected candidates so hidden
   generation attempts never pollute learner history or inflate replay round numbers.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_FINGERPRINT_WINDOW_V681__)return;
  window.__AIQUEST_S2_FINGERPRINT_WINDOW_V681__=true;
  const api=window.AIQuestS2AgentDeckV672;
  if(!api||typeof api.buildDeck!=='function')return;
  const WINDOW=4;
  const ROOT='CSAI2102_S2_FINGERPRINT_WINDOW_V681';
  const CORE='CSAI2102_S2_AGENT_BUILDER_REPLAY_V672';
  const ROTATION='CSAI2102_S2_ANSWER_ROTATION_V677';
  const profileId=()=>{try{return String((window.AIQuestStorage?.getProfile?.()||JSON.parse(localStorage.getItem('CSAI2102_AIQUEST_PROFILE_V421')||'{}')).studentId||'guest').replace(/[^a-z0-9_-]/gi,'_')}catch(e){return'guest'}};
  const key=root=>root+'_'+profileId();
  const read=(name,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key(name))||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(name,value)=>{try{localStorage.setItem(key(name),JSON.stringify(value))}catch(e){}};
  const raw=name=>{try{return localStorage.getItem(key(name))}catch(e){return null}};
  const restore=(name,value)=>{try{if(value==null)localStorage.removeItem(key(name));else localStorage.setItem(key(name),value)}catch(e){}};
  const fingerprint=card=>String(card?.answerFingerprint||[card?.context||'',card?.skill||'',card?.answerPolicy||card?.policy||'base'].join('|')).trim();
  const fingerprints=deck=>(deck?.cards||[]).map(fingerprint).filter(Boolean);
  const duplicateSet=(list,blocked)=>{const seen=new Set(blocked||[]),dupes=[];list.forEach(value=>{if(seen.has(value))dupes.push(value);seen.add(value)});return [...new Set(dupes)]};
  const original=api.buildDeck.bind(api);
  api.buildDeck=function(){
    const history=read(ROOT,{rounds:[]});history.rounds=Array.isArray(history.rounds)?history.rounds.slice(-WINDOW):[];
    const blocked=new Set(history.rounds.flatMap(round=>Array.isArray(round.fingerprints)?round.fingerprints:[]));
    const coreBefore=raw(CORE),rotationBefore=raw(ROTATION),auditBefore=raw('CSAI2102_S2_CASE_EVIDENCE_AUDIT_V675');
    let accepted=null,last=null,dupes=[];
    for(let attempt=0;attempt<20;attempt++){
      if(attempt){restore(CORE,coreBefore);restore(ROTATION,rotationBefore);restore('CSAI2102_S2_CASE_EVIDENCE_AUDIT_V675',auditBefore);}
      const candidate=original();
      const list=fingerprints(candidate);const conflicts=duplicateSet(list,blocked);
      last=candidate;dupes=conflicts;
      if(!conflicts.length){accepted=candidate;break}
    }
    const deck=accepted||last;
    const list=fingerprints(deck);
    const conflicts=duplicateSet(list,blocked);
    deck.answerFingerprintGuard={version:'v6.8.1',window:WINDOW,enforced:!conflicts.length,regenerated:accepted?true:false,retryCount:accepted?undefined:20,conflicts:conflicts.slice(0,8)};
    history.rounds.push({deckId:String(deck.id||''),round:Number(deck.round||0),at:Date.now(),fingerprints:list});
    history.rounds=history.rounds.slice(-WINDOW);write(ROOT,history);
    return deck;
  };
  console.log('[AIQuest] S2 final fingerprint window v6.8.1 active');
})();
