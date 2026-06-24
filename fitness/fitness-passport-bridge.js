/* === /fitness/fitness-passport-bridge.js ===
   Fitness Passport Result Bridge v2
   Compact storage-safe edition
*/
(function () {
  'use strict';
  const ROOT = window;
  const LAST_KEY = 'HHA_LAST_SUMMARY';
  const HISTORY_KEY = 'HHA_PASSPORT_HISTORY_V1';
  const HISTORY_LIMIT = 20;
  const ALIAS = {
    shadow:'shadow-breaker','shadow-breaker':'shadow-breaker',shadowbreaker:'shadow-breaker',
    rhythm:'rhythm-boxer','rhythm-boxer':'rhythm-boxer',rhythmboxer:'rhythm-boxer',
    jumpduck:'jumpduck','jump-duck':'jumpduck',
    balance:'balance-hold',balancehold:'balance-hold','balance-hold':'balance-hold'
  };
  const getQ = (...keys) => {
    try {
      const q = new URLSearchParams(location.search);
      for (const key of keys) {
        const value = q.get(key);
        if (value) return String(value).trim();
      }
    } catch (_) {}
    return '';
  };
  const safeGet = (key) => {
    try {
      const localValue = localStorage.getItem(key);
      if (localValue !== null) return localValue;
    } catch (_) {}
    try {
      const sessionValue = sessionStorage.getItem(key);
      if (sessionValue !== null) return sessionValue;
    } catch (_) {}
    return null;
  };
  const safeSet = (key, value) => {
    try {
      localStorage.setItem(key, value);
      return 'localStorage';
    } catch (_) {
      try {
        sessionStorage.setItem(key, value);
        return 'sessionStorage';
      } catch (_) {
        return false;
      }
    }
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const canon = (value) => {
    const key = String(value || '').trim().toLowerCase().replace(/\.html$/, '').replace(/-ar2?$/, '').replace(/\s+/g, '-');
    return ALIAS[key] || key || 'unknown';
  };
  const pct = (payload) => {
    for (const value of [payload.accuracy,payload.accuracyPct,payload.accPct,payload.accuracyGoodPct,payload.hitAccuracy]) {
      const number = Number(value);
      if (Number.isFinite(number)) return clamp(number <= 1 ? number * 100 : number, 0, 100);
    }
    const hits = Number(payload.hits ?? payload.correct ?? 0);
    const miss = Number(payload.miss ?? payload.misses ?? payload.wrong ?? 0);
    return hits + miss ? clamp((hits / (hits + miss)) * 100, 0, 100) : 0;
  };
  function compactMetrics(metrics) {
    const source = metrics && typeof metrics === 'object' ? metrics : {};
    const allowed = ['dodges','bestCombo','avgReaction','verticalMoves','sideMoves','fatigueDelta','poseQualityAvg','calibrationQuality','movementBalance','bossesCleared','perfect','good','okay','rushHits','shieldHits','feverCount','missionBadges','noBomb','playerHp','sideSwitches','avgRtMs','hitRatePerMin','scorePerMin','bodyReadiness','fatigueIndex'];
    return allowed.reduce((result, key) => {
      const value = source[key];
      if (value !== undefined && value !== null && typeof value !== 'object' && typeof value !== 'function') result[key] = value;
      return result;
    }, {});
  }
  function parseHistory() {
    try {
      const raw = safeGet(HISTORY_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  function save(payload) {
    const p = payload || {};
    const gameId = canon(p.gameId || p.game || p.id);
    const playerId = String(p.playerId || p.pid || p.studentId || getQ('pid','playerId','studentId','sid') || 'anon').trim() || 'anon';
    const playerName = String(p.playerName || p.name || p.studentName || getQ('name','player','studentName') || 'Hero').trim() || 'Hero';
    const accuracy = pct(p);
    const score = Math.max(0, Number(p.scoreFinal ?? p.score ?? p.finalScore ?? 0) || 0);
    const combo = Math.max(0, Number(p.comboMax ?? p.maxCombo ?? p.bestCombo ?? 0) || 0);
    const summary = {
      version:'fitness-passport-bridge-v2', savedAt:new Date().toISOString(),
      gameId, game:gameId,
      playerId, pid:playerId,
      playerName, name:playerName, studentName:String(p.studentName || playerName),
      studentId:String(p.studentId || playerId),
      classId:String(p.classId || ''),
      classGroup:String(p.classGroup || p.group || p.groupName || p.classId || ''),
      section:String(p.section || ''),
      group:String(p.group || p.groupName || p.classId || getQ('group','classId','class','section') || ''),
      studyId:String(p.studyId || getQ('studyId','study') || ''),
      diff:String(p.diff || p.difficulty || getQ('diff','difficulty') || ''),
      duration:Number(p.duration || p.time || p.timeSec || getQ('time','duration') || 0) || 0,
      score, scoreFinal:score,
      accuracy, accuracyPct:accuracy,
      comboMax:combo, maxCombo:combo,
      miss:Math.max(0, Number(p.miss ?? p.misses ?? p.wrong ?? 0) || 0),
      misses:Math.max(0, Number(p.miss ?? p.misses ?? p.wrong ?? 0) || 0),
      hits:Math.max(0, Number(p.hits ?? p.correct ?? p.dodges ?? 0) || 0),
      grade:String(p.grade || p.rank || ''),
      rank:String(p.rank || p.grade || ''),
      badge:String(p.badge || p.badges || (accuracy >= 95 && combo >= 20 ? '🏆 Elite Hero' : accuracy >= 85 ? '🎯 Accuracy Hero' : combo >= 15 ? '🔥 Combo Master' : accuracy >= 65 ? '🌱 Rising Hero' : '💪 Keep Moving')),
      metrics:compactMetrics(p.metrics)
    };
    const encoded = JSON.stringify(summary);
    safeSet(`${LAST_KEY}:${gameId}:${playerId}`, encoded);
    safeSet(LAST_KEY, encoded);
    let history = parseHistory();
    history = history.filter((item) => {
      const sameGame = canon(item.gameId || item.game) === gameId;
      const samePlayer = String(item.playerId || item.pid || '') === playerId;
      return !(sameGame && samePlayer);
    });
    history.unshift(summary);
    safeSet(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    ROOT.dispatchEvent(new CustomEvent('fitness-passport-saved', {detail:summary}));
    return summary;
  }
  ROOT.FitnessPassportBridge = {
    version:'v2-storage-safe',
    save,
    canonicalGameId:canon
  };
})();