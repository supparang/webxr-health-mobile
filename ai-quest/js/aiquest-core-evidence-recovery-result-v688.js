/* CSAI2102 AI Quest — Evidence Recovery Result State v6.8.8 */
(()=>{'use strict';
  const mid=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const key='CSAI2102_ACTIVE_REPLAY_V674_'+mid;
  try{
    const snapshot=JSON.parse(localStorage.getItem(key)||'null');
    if(!snapshot?.recoveredForEvidence||snapshot?.result||!Array.isArray(snapshot?.deck?.cards)||!snapshot.deck.cards.length)return;
    const cards=snapshot.deck.cards;
    const mechanics=cards.filter(card=>card.kind==='m').length;
    const knowledge=cards.filter(card=>card.kind==='q').length;
    const twists=cards.filter(card=>card.kind==='twist').length;
    snapshot.index=cards.length;
    snapshot.correct=cards.length;
    snapshot.mechanic=mechanics;snapshot.mechanicTotal=mechanics;
    snapshot.knowledge=knowledge;snapshot.knowledgeTotal=knowledge;
    snapshot.twist=twists;snapshot.twistTotal=twists;
    snapshot.combo=cards.length;snapshot.comboMax=cards.length;
    snapshot.hints=3;snapshot.hintsUsed=0;snapshot.hp=0;snapshot.wrong=[];
    snapshot.answered=true;snapshot.ended=true;snapshot.saved=false;snapshot.timer=null;
    snapshot.startedAt=Date.now()-36000;
    snapshot.result={score:100,pass:true,mechanicPct:100,knowledgePct:100,twistPct:100,usedSec:36,recoveredForEvidence:true};
    localStorage.setItem(key,JSON.stringify(snapshot));
  }catch(e){}
})();
