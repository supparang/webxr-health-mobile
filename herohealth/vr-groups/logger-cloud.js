// === /herohealth/vr-groups/logger-cloud.js ===
// ส่งข้อมูล Food Groups VR ไป Google Apps Script

(function (ns) {
  'use strict';

  let CONFIG = {
    endpoint: '',
    projectTag: 'HeroHealth-GroupsVR',
    debug: false
  };

  function init(opts) {
    opts = opts || {};
    CONFIG.endpoint   = (opts.endpoint || '').trim();
    CONFIG.projectTag = opts.projectTag || CONFIG.projectTag;
    CONFIG.debug      = !!opts.debug;

    if (!CONFIG.endpoint) {
      console.warn('[GroupsVR Logger] no endpoint configured');
    } else if (CONFIG.debug) {
      console.log('[GroupsVR Logger] init', CONFIG);
    }
  }

  function buildSessionPayload(rawSession, rawEvents) {
    rawSession = rawSession || {};
    rawEvents  = rawEvents  || [];

    const durationMs       = rawSession.durationMs || null;
    const gameDurationSec  = durationMs ? Math.round(durationMs / 1000) : '';

    let hitCount    = 0;
    let totalShots  = 0;
    let sumRT       = 0;
    let rtN         = 0;

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
      totalScore:   rawSession.score != null ? rawSession.score : 0,
      questCompleted: rawSession.questsCleared != null ? rawSession.questsCleared : 0,
      questList:      rawSession.questList || [],

      goodCount,
      badCount,
      hitRate,
      avgRT,

      mode:      rawSession.mode || 'groups-vr',
      version:   rawSession.version || '',
      startedAt: rawSession.startedAt || null,
      endedAt:   rawSession.endedAt   || null,
      groupStats: rawSession.groupStats || null
    };
  }

  function buildEventsPayload(rawSession, rawEvents) {
    rawSession = rawSession || {};
    rawEvents  = rawEvents  || [];

    const sid = rawSession.sessionId || rawSession.sid || '';
    const out = [];

    rawEvents.forEach(ev => {
      if (ev.type !== 'hit' && ev.type !== 'miss') return;

      out.push({
        sessionId: sid,
        groupId:   ev.groupId || '',
        emoji:     ev.emoji   || '',
        isGood:    ev.isGood,
        isQuestTarget: !!ev.isQuestTarget,
        hitOrMiss: ev.type,
        rtMs:      ev.rtMs != null ? ev.rtMs : null,
        scoreDelta: ev.scoreDelta != null ? ev.scoreDelta : 0,
        pos:        ev.pos || null
      });
    });

    return out;
  }

  function send(rawSession, rawEvents) {
    if (!CONFIG.endpoint) {
      if (CONFIG.debug) console.warn('[GroupsVR Logger] no endpoint, skip send');
      return;
    }

    rawEvents = rawEvents || [];

    const sessionPayload = buildSessionPayload(rawSession, rawEvents);
    const eventsPayload  = buildEventsPayload(rawSession, rawEvents);

    const payload = {
      projectTag: CONFIG.projectTag,
      sessions: [sessionPayload],
      events: eventsPayload
    };

    const body = JSON.stringify(payload);

    if (CONFIG.debug) {
      console.log('[GroupsVR Logger] send →', payload);
    }

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'text/plain' });
        const ok = navigator.sendBeacon(CONFIG.endpoint, blob);
        if (CONFIG.debug) console.log('[GroupsVR Logger] sendBeacon', ok);
        if (ok) return;
      } catch (e) {
        if (CONFIG.debug) console.warn('[GroupsVR Logger] sendBeacon error, fallback fetch', e);
      }
    }

    try {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body
      }).then(() => {
        if (CONFIG.debug) console.log('[GroupsVR Logger] sent via fetch no-cors');
      }).catch(err => {
        if (CONFIG.debug) console.warn('[GroupsVR Logger] fetch error', err);
      });
    } catch (err) {
      if (CONFIG.debug) console.warn('[GroupsVR Logger] outer error', err);
    }
  }

  ns.foodGroupsCloudLogger = { init, send };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));