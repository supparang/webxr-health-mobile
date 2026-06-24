/* === /fitness/fitness-passport-bridge.js ===
   Fitness Passport Result Bridge v1
*/
(function () {
  'use strict';
  const ROOT = window;
  const LAST_KEY = 'HHA_LAST_SUMMARY';
  const HISTORY_KEY = 'HHA_PASSPORT_HISTORY_V1';
  const ALIAS = {
    shadow:'shadow-breaker','shadow-breaker':'shadow-breaker',shadowbreaker:'shadow-breaker',
    rhythm:'rhythm-boxer','rhythm-boxer':'rhythm-boxer',rhythmboxer:'rhythm-boxer',
    jumpduck:'jumpduck','jump-duck':'jumpduck',
    balance:'balance-hold',balancehold:'balance-hold','balance-hold':'balance-hold'
  };
  const getQ = (...keys) => { try { const q=new URLSearchParams(location.search); for(const k of keys){ const v=q.get(k); if(v) return String(v).trim(); } } catch(_){} return ''; };
  const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch (_) {
    try {
      sessionStorage.setItem(k, v);
      return true;
    } catch (_) {
      return false;
    }
  }
};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const canon=(v)=>{ const k=String(v||'').trim().toLowerCase().replace(/\.html$/,'').replace(/-ar2?$/,'').replace(/\s+/g,'-'); return ALIAS[k]||k||'unknown'; };
  const pct=(p)=>{ for(const v of [p.accuracy,p.accuracyPct,p.accPct,p.accuracyGoodPct,p.hitAccuracy]){const n=Number(v);if(Number.isFinite(n))return clamp(n<=1?n*100:n,0,100);} const h=Number(p.hits??p.correct??0),m=Number(p.miss??p.misses??p.wrong??0);return h+m?clamp(h/(h+m)*100,0,100):0; };
  function save(payload){
    const p=payload||{};
    const gameId=canon(p.gameId||p.game||p.id);
    const playerId=String(p.playerId||p.pid||p.studentId||getQ('pid','playerId','studentId','sid')||'anon').trim()||'anon';
    const playerName=String(p.playerName||p.name||p.studentName||getQ('name','player','studentName')||'Hero').trim()||'Hero';
    const accuracy=pct(p);
    const score=Math.max(0,Number(p.scoreFinal??p.score??p.finalScore??0)||0);
    const combo=Math.max(0,Number(p.comboMax??p.maxCombo??p.bestCombo??0)||0);
    const summary={
      version:'fitness-passport-bridge-v1',savedAt:new Date().toISOString(),
      gameId,game:gameId,playerId,pid:playerId,playerName,name:playerName,
      group:String(p.group||p.groupName||p.classId||getQ('group','classId','class','section')||''),
      studyId:String(p.studyId||getQ('studyId','study')||''),diff:String(p.diff||p.difficulty||getQ('diff','difficulty')||''),
      duration:Number(p.duration||p.time||p.timeSec||getQ('time','duration')||0)||0,
      score,scoreFinal:score,accuracy,accuracyPct:accuracy,comboMax:combo,maxCombo:combo,
      miss:Math.max(0,Number(p.miss??p.misses??p.wrong??0)||0),hits:Math.max(0,Number(p.hits??p.correct??0)||0),
      grade:String(p.grade||p.rank||''),badge:String(p.badge|| (accuracy>=95&&combo>=20?'🏆 Elite Hero':accuracy>=85?'🎯 Accuracy Hero':combo>=15?'🔥 Combo Master':accuracy>=65?'🌱 Rising Hero':'💪 Keep Moving')),
      metrics:p.metrics||{},raw:p
    };
    safeSet(`${LAST_KEY}:${gameId}:${playerId}`,JSON.stringify(summary));

if (playerId === 'anon') {
  safeSet(`${LAST_KEY}:${gameId}:anon`,JSON.stringify(summary));
}

safeSet(LAST_KEY,JSON.stringify(summary));
    try{const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');history.unshift(summary);safeSet(HISTORY_KEY,JSON.stringify(history.slice(0,80)));}catch(_){}
    ROOT.dispatchEvent(new CustomEvent('fitness-passport-saved',{detail:summary}));
    return summary;
  }
  ROOT.FitnessPassportBridge={version:'v1',save,canonicalGameId:canon};
})();
