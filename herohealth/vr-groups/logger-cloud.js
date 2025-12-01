// vr-groups/logger-cloud.js
// ส่งข้อมูล Groups VR ไป Google Apps Script แบบเลี่ยง CORS (สไตล์ GoodJunk)

(function (ns) {
  'use strict';

  let CONFIG = {
    endpoint: '',
    projectTag: 'HeroHealth-GroupsVR',
    debug: false
  };

  // ---------- public: init ----------
  function init(opts) {
    opts = opts || {};
    CONFIG.endpoint  = (opts.endpoint || '').trim();
    CONFIG.projectTag = opts.projectTag || 'HeroHealth-GroupsVR';
    CONFIG.debug      = !!opts.debug;

    if (!CONFIG.endpoint) {
      console.warn('[GroupsVR Logger] no endpoint configured');
    } else if (CONFIG.debug) {
      console.log('[GroupsVR Logger] init', CONFIG);
    }
  }

  // ---------- helper: สร้าง payload SESSION ----------
  function buildSessionPayload(rawSession, rawEvents) {
    rawSession = rawSession || {};
    rawEvents  = rawEvents  || [];

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
      totalScore:   rawSession.score != null ? rawSession.score : 0,
      questCompleted: rawSession.questsCleared != null ? rawSession.questsCleared : 0,
      questList:    rawSession.questList || [],

      goodCount,
      badCount,
      hitRate,
      avgRT,

      mode:       rawSession.mode || 'groups-vr',
      version:    rawSession.version || 'GroupsVR_v1.0',
      startedAt:  rawSession.startedAt || null,
      endedAt:    rawSession.endedAt || null,
      groupStats: rawSession.groupStats || null
    };
  }

  // ---------- helper: สร้าง payload EVENTS ----------
  function buildEventsPayload(rawSession, rawEvents) {
    rawSession = rawSession || {};
    rawEvents  = rawEvents  || [];

    const sid = rawSession.sessionId || rawSession.sid || '';

    return rawEvents
      .filter(ev => ev.type === 'hit' || ev.type === 'miss')
      .map(ev => ({
        sessionId: sid,
        groupId:   ev.groupId || '',
        emoji:     ev.emoji || '',
        isGood:    ev.isGood,
        isQuestTarget: !!ev.isQuestTarget,
        hitOrMiss: ev.type,            // 'hit' / 'miss'
        rtMs:      ev.rtMs != null ? ev.rtMs : null,
        scoreDelta: ev.scoreDelta != null ? ev.scoreDelta : 0,
        pos:       ev.pos || null
      }));
  }

  // ---------- core sender: เลี่ยง CORS ----------
  function sendPayload(payload) {
    if (!CONFIG.endpoint) return;

    const body = JSON.stringify(payload);

    // 1) พยายามใช้ sendBeacon ก่อน (เหมาะกับตอนปิดหน้า/เน็ตช้า)
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'text/plain' });
        const ok = navigator.sendBeacon(CONFIG.endpoint, blob);
        if (CONFIG.debug) console.log('[GroupsVR Logger] sendBeacon', ok, payload);
        if (ok) return;      // ถ้า ok แล้วก็ไม่ต้องทำ fetch ซ้ำ
      } catch (err) {
        if (CONFIG.debug) console.warn('[GroupsVR Logger] sendBeacon error → fallback fetch', err);
      }
    }

    // 2) fallback: fetch แบบ no-cors + text/plain (จะไม่โดน preflight → ไม่ติด CORS)
    try {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body
      })
        .then(() => {
          if (CONFIG.debug) {
            console.log('[GroupsVR Logger] sent via fetch no-cors');
          }
        })
        .catch(err => {
          if (CONFIG.debug) {
            console.error('[GroupsVR Logger] send error', err);
          }
        });
    } catch (err) {
      if (CONFIG.debug) {
        console.error('[GroupsVR Logger] outer error', err);
      }
    }
  }

  // ---------- public: send (เรียกจาก GameEngine.endGame) ----------
  function send(rawSession, rawEvents) {
    const sessionPayload = buildSessionPayload(rawSession, rawEvents || []);
    const eventsPayload  = buildEventsPayload(rawSession, rawEvents || []);

    const payload = {
      projectTag: CONFIG.projectTag,
      sessions: [sessionPayload],
      events: eventsPayload
    };

    sendPayload(payload);
  }

  // export ไปไว้ใน namespace กลาง
  ns.foodGroupsCloudLogger = {
    init,
    send
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
