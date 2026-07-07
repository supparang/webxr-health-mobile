/* CSAI2102 S2 Evidence Picker metadata repair v6.8.2
   Also backfills integrity guards and case-card prompt previews for cached player shells.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_CASE_EVIDENCE_SKILLFIX_V682__)return;
  window.__AIQUEST_S2_CASE_EVIDENCE_SKILLFIX_V682__=true;
  window.__AIQUEST_S2_CASE_EVIDENCE_SKILLFIX_V676__=true;
  const ACTIVE='CSAI2102_ACTIVE_S2_V674';
  const KEY='CSAI2102_S2_CASE_EVIDENCE_AUDIT_V675';
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||JSON.parse(localStorage.getItem('CSAI2102_AIQUEST_PROFILE_V421')||'{}')}catch(e){return {}}};
  const userKey=()=>KEY+'_'+clean(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const actualSkill=card=>clean(card?.skill||(card?.kind==='twist'?'Case Twist':card?.kind==='m'?'Agent Mechanic':'Analysis Case'));
  function repair(deck){
    const audit=window.AIQuestS2ReplayAuditCurrent;
    if(!audit||!Array.isArray(audit.cards)||!deck||!Array.isArray(deck.cards))return false;
    let changed=false;
    deck.cards.forEach((card,index)=>{if(!audit.cards[index])return;const skill=actualSkill(card);if(audit.cards[index].skill!==skill){audit.cards[index].skill=skill;changed=true}});
    if(changed){window.AIQuestS2ReplayAuditCurrent=audit;write(userKey(),audit);document.getElementById('s2EvidenceBindingV675')?.remove();}
    return changed;
  }
  function repairActive(){const snapshot=read(ACTIVE,null);return repair(snapshot?.deck)}
  function patch(){
    const api=window.AIQuestS2AgentDeckV672;
    if(!api||api.__caseEvidenceSkillFixV682||typeof api.buildDeck!=='function')return false;
    api.__caseEvidenceSkillFixV682=true;
    const original=api.buildDeck.bind(api);
    api.buildDeck=function(){const deck=original();repair(deck);return deck};
    return true;
  }
  function add(id,src){if(document.getElementById(id))return;const script=document.createElement('script');script.id=id;script.src=src;script.async=false;document.head.appendChild(script);}
  function rescue(){
    if(!window.__AIQUEST_S2_REFLECTION_SEMANTIC_GATE_V678__)add('aiquestS2SemanticGateV678','./js/aiquest-s2-reflection-semantic-gate-v678.js?v=20260707-semantic678');
    if(window.__AIQUEST_S2_ANSWER_ROTATION_V677__&&!window.__AIQUEST_S2_FINGERPRINT_WINDOW_V681__)add('aiquestS2FingerprintWindowV681','./js/aiquest-s2-fingerprint-window-v681.js?v=20260707-fingerprint681');
    if(!window.__AIQUEST_REFLECTION_CASE_CARD_DETAIL_V676__)add('aiquestReflectionCaseCardDetailV676','./js/aiquest-reflection-case-card-detail-v676.js?v=20260707-casedetail676');
  }
  const timer=setInterval(()=>{patch();repairActive();rescue()},140);
  patch();repairActive();rescue();
})();
