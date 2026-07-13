/* UX Quest • Cloud Progress Authority v2
 * Final guard for Mission Control.
 * - Sheet restore replaces local progress instead of merging stale learner data.
 * - A no-history response produces a true 0/19 state.
 * - Start Over immediately redraws W1 as the first mission.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const STATUS_ID = 'uxqCloudProgressStatus';

  function show(message, tone = 'ok') {
    let box = document.getElementById(STATUS_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = STATUS_ID;
      box.className = 'uxq-cloud-status';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.dataset.tone = tone;
    box.dataset.show = '1';
    clearTimeout(show.timer);
    show.timer = setTimeout(() => { box.dataset.show = '0'; }, tone === 'error' ? 7000 : 4200);
  }

  function blank() {
    const store = window.UXQProgress;
    if (!store) throw new Error('UXQProgress ยังไม่พร้อม');
    store.resetQuest();
    return store.get();
  }

  function replaceWithCloud(cloud) {
    const store = window.UXQProgress;
    if (!store) throw new Error('UXQProgress ยังไม่พร้อม');

    const progress = blank();
    const missions = {};

    Object.keys(cloud?.missions || {}).forEach((rawId) => {
      const id = String(rawId || '').trim().toLowerCase();
      if (!store.MISSION_IDS.includes(id)) return;
      const remote = cloud.missions[rawId] || {};
      const attempt = {
        completedAt: remote.lastCompletedAt || remote.completedAt || new Date().toISOString(),
        score: Number(remote.bestScore || remote.score || 0),
        stars: Number(remote.bestStars || remote.stars || 0),
        accuracy: Number(remote.bestAccuracy || remote.accuracy || 0),
        correct: Number(remote.bestCorrect || remote.correct || 0),
        total: Number(remote.total || 0),
        hints: Number(remote.hints || 0),
        durationSec: Number(remote.durationSec || 0),
        passed: Boolean(remote.completed || remote.passed || Number(remote.bestStars || remote.stars || 0) >= 2),
        badge: String(remote.badge || 'cloud restore')
      };
      missions[id] = {
        id,
        attempts: Math.max(1, Number(remote.attempts || 1)),
        completed: attempt.passed,
        bestScore: attempt.score,
        bestStars: attempt.stars,
        bestAccuracy: attempt.accuracy,
        bestCorrect: attempt.correct,
        lastResult: attempt,
        lastCompletedAt: attempt.completedAt,
        history: [attempt]
      };
    });

    progress.missions = missions;
    return store.save(progress);
  }

  function clearStartOverMark() {
    try { localStorage.removeItem('uxq.cloud.progress.startOver.v1'); } catch (e) {}
  }

  async function authoritativeRestore() {
    const cloud = window.UXQCloudProgress;
    const identity = window.UXQIdentity;
    if (!cloud?.request || !identity) throw new Error('ระบบเรียกคืนข้อมูลยังไม่พร้อม');
    const profile = identity.get();
    if (!identity.isComplete(profile)) throw new Error('กรุณาระบุข้อมูลผู้เรียนให้ครบ');

    show('กำลังตรวจประวัติของ ' + profile.studentName + '…');
    const result = await cloud.request(profile);
    if (!result || !result.ok) throw new Error(result?.error || 'ไม่พบคำตอบจากระบบ');

    clearStartOverMark();
    const saved = replaceWithCloud(result);
    const completed = Number(saved?.quest?.completedNodes || 0);
    const next = String(result.nextMission || 'w1').toUpperCase();
    show(result.found
      ? `เรียกคืนแล้ว ${completed}/19 ด่าน • ด่านถัดไป ${next}`
      : 'ยังไม่พบประวัติเดิม • รีเซ็ตเป็น 0/19 • เริ่มจาก W1', 'ok');
    return result;
  }

  function authoritativeStartOver() {
    const identity = window.UXQIdentity;
    const profile = identity?.get?.() || {};
    if (!identity?.isComplete?.(profile)) return;
    const ok = window.confirm(`เริ่มใหม่สำหรับ ${profile.studentName} • ${profile.studentId} • Section ${profile.section} ใช่หรือไม่?\n\nข้อมูลใน Google Sheet จะไม่ถูกลบ`);
    if (!ok) return;
    try {
      localStorage.setItem('uxq.cloud.progress.startOver.v1', JSON.stringify({
        active: true,
        profileKey: [profile.studentId, profile.section, window.UXQ_CLASSROOM_CONFIG?.courseId || 'UXQ-ACT1-2026'].join('|'),
        startedAt: new Date().toISOString()
      }));
    } catch (e) {}
    blank();
    show('เริ่มใหม่แล้ว • 0/19 ด่าน • เริ่มจาก W1', 'ok');
  }

  function intercept(event) {
    const restore = event.target.closest?.('#uxqRestoreProgressBtn');
    const start = event.target.closest?.('#uxqStartOverBtn');
    if (!restore && !start) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (start) authoritativeStartOver();
    else authoritativeRestore().catch(error => show(error.message || String(error), 'error'));
  }

  document.addEventListener('click', intercept, true);
  window.UXQCloudProgressAuthority = Object.freeze({ authoritativeRestore, authoritativeStartOver, replaceWithCloud });
})();