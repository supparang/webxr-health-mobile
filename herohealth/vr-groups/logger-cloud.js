// vr-groups/logger-cloud.js
(function (ns) {
  'use strict';

  let CONFIG = {
    endpoint: '',
    projectTag: 'HeroHealth-GroupsVR'
  };

  function init(opts) {
    opts = opts || {};
    CONFIG.endpoint = (opts.endpoint || '').trim();
    if (opts.projectTag) CONFIG.projectTag = opts.projectTag;
  }

  // สร้าง session object ให้ตรงกับ Apps Script
  function buildSessionPayload(rawSession, rawEvents) {
    rawSession = rawSession || {};
    rawEvents = rawEvents || [];

    // ดึง duration เป็นวินาที
    const durationMs = rawSession.durationMs || null;
    const gameDurationSec = durationMs ? Math.round(durationMs / 1000) : '';

    // คำนวณสถิติจาก events (hit/miss) ถ้ามี
    let hitCount = 0;
    let totalShots = 0;
    let sumRT = 0;
    let rtN = 0;
    let goodCount = 0;
    let badCount = 0;

    rawEvents.forEach(ev => {
      if (ev.type === 'hit' || ev.type === 'miss') {
        totalShots++;
        if (ev.type === 'hit') hitCount++;

        if (typeof ev.rtMs === 'number') {
          sumRT += ev.rtMs;
          rtN++;
        }

        // ถ้ามี isGood ใน log ก็เก็บ ไม่มีก็จะเป็น 0 ทั้งคู่ (ไปแมปจาก groupId ทีหลังได้)
        if (ev.isGood === true) goodCount++;
        if (ev.isGood === false) badCount++;
      }
    });

    const hitRate = totalShots > 0 ? hitCount / totalShots : 0;
    const avgRT = rtN > 0 ? Math.round(sumRT / rtN) : 0;

    return {
      // ❗ชื่อฟิลด์ให้ตรงกับ Apps Script
      sessionId: rawSession.sessionId || rawSession.sid || '',
      playerId: rawSession.playerName || rawSession.playerClass || '',
      deviceType: rawSession.deviceType || '',
      difficulty: rawSession.diff || rawSession.difficulty || '',
      gameDuration: gameDurationSec,
      totalScore: rawSession.score != null ? rawSession.score : 0,
      questCompleted: rawSession.questsCleared != null ? rawSession.questsCleared : 0,
      questList: rawSession.questList || [],

      goodCount: goodCount,
      badCount: badCount,
      hitRate: hitRate,
      avgRT: avgRT,

      // เก็บเพิ่มไว้ใน rawSession เผื่อใช้ทีหลัง
      mode: rawSession.mode || 'groups-vr',
      startedAt: rawSession.startedAt || null,
      endedAt: rawSession.endedAt || null
    };
  }

  // สร้าง events list ให้ตรง Apps Script
  function buildEventsPayload(rawSession, rawEvents) {
    const sid = rawSession.sessionId || rawSession.sid || '';
    const out = [];

    rawEvents.forEach(ev => {
      if (ev.type !== 'hit' && ev.type !== 'miss') return;

      out.push({
        // timestamp จะให้ Apps Script เติมเอง (new Date())
        sessionId: sid,
        groupId: ev.groupId || '',
        emoji: ev.emoji || '',          // ตอนนี้ยังไม่มีใน log, ปล่อยว่างไว้ได้
        isGood: ev.isGood,              // ตอนนี้อาจเป็น undefined ทั้งหมด
        isQuestTarget: !!ev.isQuestTarget,
        hitOrMiss: ev.type,             // 'hit' | 'miss'
        rtMs: ev.rtMs != null ? ev.rtMs : null,
        scoreDelta: ev.scoreDelta != null ? ev.scoreDelta : 0,
        pos: ev.pos || null
      });
    });

    return out;
  }

  async function send(rawSession, rawEvents) {
    if (!CONFIG.endpoint) return;

    rawEvents = rawEvents || [];

    const sessionPayload = buildSessionPayload(rawSession, rawEvents);
    const eventsPayload = buildEventsPayload(rawSession, rawEvents);

    const payload = {
      projectTag: CONFIG.projectTag,
      session: sessionPayload,
      events: eventsPayload
    };

    try {
      await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('[GroupsVR CloudLogger] send error', err);
    }
  }

  ns.foodGroupsCloudLogger = {
    init,
    send
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
