// vr-groups/logger-cloud.js
// ส่งข้อมูลเกม Food Groups VR ขึ้น Google Apps Script → Google Sheet
// ใช้คู่กับ doPost(e) ที่มีชีต Session / Events

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

  // ===== helper: สร้าง payload ของ session ให้ตรงกับ Apps Script =====
  function buildSessionPayload(rawSession, rawEvents) {
    rawSession = rawSession || {};
    rawEvents = rawEvents || [];

    // duration เป็นวินาที
    const durationMs = rawSession.durationMs || null;
    const gameDurationSec = durationMs ? Math.round(durationMs / 1000) : '';

    // คำนวณสถิติจาก events (hit/miss)
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
    const avgRT = rtN > 0 ? Math.round(sumRT / rtN) : 0;

    // ตีความ goodCount = จำนวน hit (ยิงโดน), badCount = miss ทั้งหมด
    const goodCount = hitCount;
    const badCount = totalShots - hitCount;

    return {
      // ❗ ชื่อฟิลด์ให้ตรงกับ Apps Script
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

      // เก็บเพิ่มใน rawSession ไว้ดูทีหลัง
      mode: rawSession.mode || 'groups-vr',
      startedAt: rawSession.startedAt || null,
      endedAt: rawSession.endedAt || null
    };
  }

  // ===== helper: แปลง rawEvents → payload สำหรับชีต Events =====
  function buildEventsPayload(rawSession, rawEvents) {
    const sid = rawSession.sessionId || rawSession.sid || '';
    const out = [];

    rawEvents.forEach(ev => {
      if (ev.type !== 'hit' && ev.type !== 'miss') return;

      out.push({
        // timestamp ให้ Apps Script ใส่เอง (new Date())
        sessionId: sid,
        groupId: ev.groupId || '',
        emoji: ev.emoji || '',          // ตอนนี้ยังไม่มี emoji ใน log ก็ปล่อยว่างได้
        isGood: ev.isGood,              // ยังไม่ได้ใช้ก็ได้
        isQuestTarget: !!ev.isQuestTarget,
        hitOrMiss: ev.type,             // 'hit' หรือ 'miss'
        rtMs: ev.rtMs != null ? ev.rtMs : null,
        scoreDelta: ev.scoreDelta != null ? ev.scoreDelta : 0,
        pos: ev.pos || null
      });
    });

    return out;
  }

  // ===== main: เรียกจาก GameEngine.endGame() =====
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
