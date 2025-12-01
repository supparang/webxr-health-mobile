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

  // แปลง rawSession จากเกม -> ฟอร์แมตที่ Apps Script ต้องการ
  function adaptSession(raw) {
    raw = raw || {};

    const durationMs =
      raw.durationMs != null ? raw.durationMs :
      (raw.gameDurationMs != null ? raw.gameDurationMs : null);

    // นับสถิติพื้นฐานจาก events ใน window.HHA_FOODGROUPS_LOG ถ้ามี
    const evLog = (window.HHA_FOODGROUPS_LOG || []).filter(ev =>
      ev.type === 'hit' || ev.type === 'miss'
    );

    let goodCount = 0, badCount = 0, hitCount = 0, totalShots = 0;
    let sumRT = 0, rtN = 0;

    evLog.forEach(ev => {
      if (ev.isGood === true) goodCount++;
      if (ev.isGood === false) badCount++;

      if (ev.type === 'hit' || ev.type === 'miss') {
        totalShots++;
        if (ev.type === 'hit') hitCount++;
      }
      if (typeof ev.rtMs === 'number') {
        sumRT += ev.rtMs;
        rtN++;
      }
    });

    const hitRate = totalShots > 0 ? hitCount / totalShots : 0;
    const avgRT = rtN > 0 ? Math.round(sumRT / rtN) : 0;

    return {
      // ❗ ชื่อฟิลด์ให้ตรงกับ Apps Script
      sessionId: raw.sessionId || raw.sid || '',
      playerId: raw.playerId || raw.playerName || '',
      deviceType: raw.deviceType || '',
      difficulty: raw.difficulty || raw.diff || '',
      gameDuration: raw.gameDuration || (durationMs ? Math.round(durationMs / 1000) : ''),
      totalScore: raw.totalScore != null ? raw.totalScore : (raw.score || 0),
      questCompleted: raw.questCompleted != null ? raw.questCompleted : (raw.questsCleared || 0),
      questList: raw.questList || raw.quests || [],
      goodCount: goodCount,
      badCount: badCount,
      hitRate: hitRate,
      avgRT: avgRT,

      // เก็บข้อมูลดิบอื่น ๆ เพิ่มได้
      mode: raw.mode || 'groups-vr',
      startedAt: raw.startedAt || null,
      endedAt: raw.endedAt || null
    };
  }

  // แปลง event log ในเกม -> ฟอร์แมตที่ Apps Script ต้องการ
  function adaptEvents(sessionId) {
    const rawEvents = window.HHA_FOODGROUPS_LOG || [];
    const list = [];

    rawEvents.forEach(ev => {
      if (ev.type !== 'hit' && ev.type !== 'miss') return;

      list.push({
        sessionId: sessionId,
        groupId: ev.groupId || '',
        emoji: ev.emoji || '',          // ถ้ามี emoji ใน log
        isGood: ev.isGood,              // true / false / undefined
        isQuestTarget: !!ev.isQuestTarget,
        hitOrMiss: ev.type,             // 'hit' หรือ 'miss'
        rtMs: ev.rtMs != null ? ev.rtMs : null,
        scoreDelta: ev.scoreDelta != null ? ev.scoreDelta : 0,
        pos: ev.pos || null
      });
    });

    return list;
  }

  async function send(rawSession) {
    if (!CONFIG.endpoint) return;

    const sess = adaptSession(rawSession || {});
    const events = adaptEvents(sess.sessionId);

    const payload = {
      projectTag: CONFIG.projectTag,
      session: sess,
      events: events
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
