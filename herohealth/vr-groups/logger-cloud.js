// vr-groups/logger-cloud.js
// ส่งข้อมูลเกม Food Groups VR ขึ้น Google Apps Script แบบ "GoodJunk style"
// payload:
// {
//   projectTag: 'HeroHealth-GroupsVR',
//   sessions: [ { ... } ],
//   events:   [ { ... } ]
// }

(function (ns) {
  'use strict';

  ns = ns || (window.GAME_MODULES = window.GAME_MODULES || {});

  let CONFIG = {
    endpoint: '',                     // ★ ให้กำหนดผ่าน init() เท่านั้น
    projectTag: 'HeroHealth-GroupsVR',
    debug: false
  };

  function init(opts) {
    opts = opts || {};
    CONFIG.endpoint  = (opts.endpoint || '').trim();
    CONFIG.projectTag = opts.projectTag || CONFIG.projectTag;
    CONFIG.debug      = !!opts.debug;

    if (!CONFIG.endpoint) {
      console.warn('[GroupsVR Logger] NO endpoint configured');
    } else if (CONFIG.debug) {
      console.log('[GroupsVR Logger] init', CONFIG);
    }
  }

  // ===== helper: สร้าง payload ของ session =====
  function buildSessionPayload(rawSession, rawEvents) {
    rawSession = rawSession || {};
    rawEvents  = rawEvents || [];

    const durationMs = rawSession.durationMs || null;
    const gameDurationSec = durationMs ? Math.round(durationMs / 1000) : '';

    let hitCount = 0;
    let totalShots = 0;
    let sumRT = 0;
    let rtN = 0;

    rawEvents.forEach(ev => {
      if (ev.type === 'hit' || ev.type === 'miss') {
        totalShots++;
        if (ev.type === 'hit') hitCount++;
        if (typeof ev.rtMs === 'number') {
          sumRT += ev.rtMs;
          rtN++;
        }
      }
    });

    const hitRate = totalShots > 0 ? hitCount / totalShots : 0;
    const avgRT   = rtN > 0 ? Math.round(sumRT / rtN) : 0;

    const goodCount = hitCount;
    const badCount  = totalShots - hitCount;

    return {
      sessionId:   rawSession.sessionId || rawSession.sid || '',
      playerId:    rawSession.playerName || rawSession.playerClass || '',
      deviceType:  rawSession.deviceType || '',
      difficulty:  rawSession.diff || rawSession.difficulty || '',
      gameDuration: gameDurationSec,
      totalScore:  rawSession.score != null ? rawSession.score : 0,
      questCompleted: rawSession.questsCleared != null ? rawSession.questsCleared : 0,
      questList:   rawSession.questList || [],

      goodCount,
      badCount,
      hitRate,
      avgRT,

      mode:       rawSession.mode || 'groups-vr',
      startedAt:  rawSession.startedAt || null,
      endedAt:    rawSession.endedAt || null,
      groupStats: rawSession.groupStats || null
    };
  }

  // ===== helper: แปลง events → payload =====
  function buildEventsPayload(rawSession, rawEvents) {
    const sid = rawSession.sessionId || rawSession.sid || '';
    const out = [];

    (rawEvents || []).forEach(ev => {
      if (ev.type !== 'hit' && ev.type !== 'miss') return;
      out.push({
        sessionId:    sid,
        groupId:      ev.groupId || '',
        emoji:        ev.emoji || '',
        isGood:       ev.isGood,
        isQuestTarget: !!ev.isQuestTarget,
        hitOrMiss:    ev.type,                  // 'hit' / 'miss'
        rtMs:         ev.rtMs != null ? ev.rtMs : null,
        scoreDelta:   ev.scoreDelta != null ? ev.scoreDelta : 0,
        pos:          ev.pos || null
      });
    });

    return out;
  }

  async function send(rawSession, rawEvents) {
    if (!CONFIG.endpoint) {
      if (CONFIG.debug) console.warn('[GroupsVR Logger] no endpoint, skip send');
      return;
    }

    const sessionPayload = buildSessionPayload(rawSession, rawEvents);
    const eventsPayload  = buildEventsPayload(rawSession, rawEvents);

    const payload = {
      projectTag: CONFIG.projectTag,
      sessions: [sessionPayload],
      events:   eventsPayload
    };

    if (CONFIG.debug) {
      console.log('[GroupsVR Logger] send →', payload);
    }

    try {
      await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      if (CONFIG.debug) console.warn('[GroupsVR Logger] send error', err);
    }
  }

  ns.foodGroupsCloudLogger = { init, send };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
