// === /herohealth/vr/battle-ui.js ===
// Battle UI overlay for HeroHealth games
// PATCH v20260304-BATTLE-UI
'use strict';

function $(id){ return document.getElementById(id); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }

export function attachBattleUI({ room, pid, gameKey }){
  const hud = $('battleHud');
  const bhRoom = $('bhRoom');
  const bhMe = $('bhMe');
  const bhPeer = $('bhPeer');

  const bhMyScore = $('bhMyScore');
  const bhMyAcc = $('bhMyAcc');
  const bhMyMiss = $('bhMyMiss');

  const bhPeerScore = $('bhPeerScore');
  const bhPeerAcc = $('bhPeerAcc');
  const bhPeerMiss = $('bhPeerMiss');

  const br = $('battleResult');
  const brTitle = $('brTitle');
  const brSub = $('brSub');

  if(hud) hud.setAttribute('aria-hidden','false');
  if(bhRoom) bhRoom.textContent = String(room||'—');
  if(bhMe) bhMe.textContent = String(pid||'—');

  let my = { score:0, accPct:0, miss:0, medianRtGoodMs:0 };
  let peer = { score:0, accPct:0, miss:0, medianRtGoodMs:0 };

  function render(){
    if(bhMyScore) bhMyScore.textContent = String(my.score|0);
    if(bhMyAcc)   bhMyAcc.textContent = String(clamp(my.accPct||0,0,100));
    if(bhMyMiss)  bhMyMiss.textContent = String(my.miss|0);

    if(bhPeerScore) bhPeerScore.textContent = String(peer.score|0);
    if(bhPeerAcc)   bhPeerAcc.textContent = String(clamp(peer.accPct||0,0,100));
    if(bhPeerMiss)  bhPeerMiss.textContent = String(peer.miss|0);
  }

  // Listen local scores
  window.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    my = {
      score: d.score|0,
      accPct: Number(d.accPct||0),
      miss: d.miss|0,
      medianRtGoodMs: d.medianRtGoodMs|0
    };
    render();
  });

  // Poll peer score via exposed battle instance
  function pollPeer(){
    const b = window.__HHA_BATTLE__ || null;
    if(b && typeof b.getPeerScore === 'function'){
      const p = b.getPeerScore();
      if(p){
        peer = {
          score: p.score|0,
          accPct: Number(p.accPct||0),
          miss: p.miss|0,
          medianRtGoodMs: p.medianRtGoodMs|0
        };
        if(bhPeer) bhPeer.textContent = String(p.pid || 'peer');
        render();
      }
    }
    requestAnimationFrame(pollPeer);
  }
  requestAnimationFrame(pollPeer);

  // Show winner on end
  window.addEventListener('hha:game-ended', ()=>{
    const b = window.__HHA_BATTLE__ || null;
    if(!b || typeof b.getWinner !== 'function') return;

    const w = b.getWinner();
    if(!w) return;

    if(br) br.setAttribute('aria-hidden','false');

    const me = String(pid||'me');
    const peerName = (bhPeer && bhPeer.textContent) ? bhPeer.textContent : 'peer';

    if(w.winnerPid === 'draw'){
      if(brTitle) brTitle.textContent = '🤝 เสมอ!';
      if(brSub) brSub.textContent = `คะแนนใกล้กันมาก — tie-break: score→acc→miss→medianRT`;
    }else if(w.winnerPid === pid){
      if(brTitle) brTitle.textContent = '🏆 YOU WIN!';
      if(brSub) brSub.textContent = `${me} ชนะ ${peerName} (ตัดสิน: score→acc→miss→medianRT)`;
    }else{
      if(brTitle) brTitle.textContent = '😵 YOU LOSE';
      if(brSub) brSub.textContent = `${peerName} ชนะ ${me} (ตัดสิน: score→acc→miss→medianRT)`;
    }
  });
}