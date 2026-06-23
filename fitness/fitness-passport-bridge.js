/* === /fitness/fitness-passport-bridge.js ===
   Fitness Passport Result Bridge
   ใช้ร่วมกับ:
   - shadow-breaker-ar.html
   - rhythm-boxer-ar.html
   - jumpduck-ar.html
   - balance-hold-ar2.html
*/
(function () {
  'use strict';

  const ROOT = window;
  const LAST_KEY = 'HHA_LAST_SUMMARY';
  const HISTORY_KEY = 'HHA_PASSPORT_HISTORY_V1';

  const GAME_ALIASES = {
    shadow: 'shadow-breaker',
    'shadow-breaker': 'shadow-breaker',
    shadowbreaker: 'shadow-breaker',

    rhythm: 'rhythm-boxer',
    'rhythm-boxer': 'rhythm-boxer',
    rhythmboxer: 'rhythm-boxer',

    jumpduck: 'jumpduck',
    'jump-duck': 'jumpduck',
    'jump-duck-ar': 'jumpduck',

    balance: 'balance-hold',
    balancehold: 'balance-hold',
    'balance-hold': 'balance-hold',
    'balance-hold-ar2': 'balance-hold'
  };

  function safeGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function queryValue(...names) {
    const params = new URLSearchParams(location.search);
    for (const name of names) {
      const value = params.get(name);
      if (value) return value.trim();
    }
    return '';
  }

  function canonicalGameId(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\.html$/i, '')
      .replace(/-ar2?$/i, '')
      .replace(/\s+/g, '-');

    return GAME_ALIASES[raw] || raw || 'unknown';
  }

  function playerIdentity(payload) {
    const playerId =
      String(
        payload.playerId ||
        payload.pid ||
        payload.studentId ||
        queryValue('pid', 'playerId', 'studentId', 'sid') ||
        'anon'
      ).trim() || 'anon';

    const playerName =
      String(
        payload.playerName ||
        payload.name ||
        queryValue('name', 'player', 'studentName') ||
        'Hero'
      ).trim() || 'Hero';

    const group =
      String(
        payload.group ||
        payload.groupName ||
        queryValue('group', 'classId', 'class', 'section') ||
        ''
      ).trim();

    return { playerId, playerName, group };
  }

  function accuracyOf(payload) {
    const candidates = [
      payload.accuracy,
      payload.accuracyPct,
      payload.accPct,
      payload.accuracyGoodPct,
      payload.hitAccuracy
    ];

    for (const value of candidates) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return clamp(parsed <= 1 ? parsed * 100 : parsed, 0, 100);
      }
    }

    const hit = Number(payload.hits ?? payload.correct ?? 0);
    const miss = Number(payload.miss ?? payload.misses ?? payload.wrong ?? 0);
    const total = hit + miss;

    return total > 0 ? clamp((hit / total) * 100, 0, 100) : 0;
  }

  function scoreOf(payload) {
    return Math.max(
      0,
      Number(payload.scoreFinal ?? payload.score ?? payload.finalScore ?? 0) || 0
    );
  }

  function comboOf(payload) {
    return Math.max(
      0,
      Number(payload.comboMax ?? payload.maxCombo ?? payload.bestCombo ?? 0) || 0
    );
  }

  function badgeOf(payload, accuracy, combo) {
    if (payload.badge) return String(payload.badge);
    if (accuracy >= 95 && combo >= 20) return '🏆 Elite Hero';
    if (accuracy >= 85) return '🎯 Accuracy Hero';
    if (combo >= 15) return '🔥 Combo Master';
    if (accuracy >= 65) return '🌱 Rising Hero';
    return '💪 Keep Moving';
  }

  function normalize(payload) {
    const source = payload || {};
    const gameId = canonicalGameId(source.gameId || source.game || source.id);
    const identity = playerIdentity(source);
    const accuracy = accuracyOf(source);
    const score = scoreOf(source);
    const combo = comboOf(source);

    return {
      version: 'fitness-passport-bridge-v1',
      savedAt: new Date().toISOString(),
      gameId,
      game: gameId,
      playerId: identity.playerId,
      pid: identity.playerId,
      playerName: identity.playerName,
      name: identity.playerName,
      group: identity.group,
      studyId: String(source.studyId || queryValue('studyId', 'study') || ''),
      diff: String(source.diff || source.difficulty || queryValue('diff', 'difficulty') || ''),
      duration: Number(source.duration || source.time || source.timeSec || queryValue('time', 'duration') || 0) || 0,

      score,
      scoreFinal: score,
      accuracy,
      accuracyPct: accuracy,
      comboMax: combo,
      maxCombo: combo,

      miss: Math.max(0, Number(source.miss ?? source.misses ?? source.wrong ?? 0) || 0),
      hits: Math.max(0, Number(source.hits ?? source.correct ?? 0) || 0),
      grade: String(source.grade || source.rank || ''),
      badge: badgeOf(source, accuracy, combo),

      metrics: source.metrics || {},
      raw: source
    };
  }

  function save(payload) {
    const summary = normalize(payload);
    const playerKey = `HHA_LAST_SUMMARY:${summary.gameId}:${summary.playerId}`;
    const anonKey = `HHA_LAST_SUMMARY:${summary.gameId}:anon`;

    safeSet(playerKey, JSON.stringify(summary));
    safeSet(anonKey, JSON.stringify(summary));
    safeSet(LAST_KEY, JSON.stringify(summary));

    let history = [];
    try {
      history = JSON.parse(safeGet(HISTORY_KEY, '[]')) || [];
      if (!Array.isArray(history)) history = [];
    } catch (_) {
      history = [];
    }

    history.unshift(summary);
    safeSet(HISTORY_KEY, JSON.stringify(history.slice(0, 80)));

    ROOT.dispatchEvent(
      new CustomEvent('fitness-passport-saved', {
        detail: summary
      })
    );

    console.log('[FitnessPassportBridge] saved', summary.gameId, summary.playerId);
    return summary;
  }

  function get(gameId, playerId) {
    const game = canonicalGameId(gameId);
    const pid = String(playerId || queryValue('pid', 'playerId', 'studentId') || 'anon');

    try {
      return JSON.parse(
        safeGet(`HHA_LAST_SUMMARY:${game}:${pid}`, '') ||
        safeGet(`HHA_LAST_SUMMARY:${game}:anon`, '') ||
        'null'
      );
    } catch (_) {
      return null;
    }
  }

  ROOT.FitnessPassportBridge = {
    version: 'v1',
    save,
    get,
    normalize,
    canonicalGameId
  };
})();
