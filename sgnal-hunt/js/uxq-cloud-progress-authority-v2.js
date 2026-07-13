/* UX Quest • Cloud Progress Authority v3
 * Mission Control progress is authoritative from Google Sheet.
 * - Every load/profile change replaces local progress with Sheet results.
 * - localStorage is cache only and never decides passed/locked status.
 * - No browser-only Start Over state; the former button reloads from Sheet.
 */
(() => {
  'use strict';

  const STATUS_ID = 'uxqCloudProgressStatus';
  let restoring = null;

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

  function replaceWithSheet(result) {
    const store = window.UXQProgress;
    if (!store) throw new Error('UXQProgress ยังไม่พร้อม');

    const progress = blank();
    const missions = {};

    Object.keys(result?.missions || {}).forEach((rawId) => {
      const id = String(rawId || '').trim().toLowerCase();
      if (!store.MISSION_IDS.includes(id)) return;
      const remote = result.missions[rawId] || {};
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
        badge: String(remote.badge || 'sheet restore')
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

  function removeBrowserResetState() {
    try {
      localStorage.removeItem('uxq.cloud.progress.startOver.v1');
      localStorage.removeItem('uxq.cloud.progress.lastSync.v1');
    } catch (error) {}
  }

  function relabelControls() {
    const start = document.getElementById('uxqStartOverBtn');
    if (start) {
      start.textContent = 'ดึงใหม่จาก Sheet';
      start.dataset.action = 'sheet-refresh';
      start.title = 'โหลดสถานะผ่านและภารกิจถัดไปจาก Google Sheet';
    }
    const restore = document.getElementById('uxqRestoreProgressBtn');
    if (restore) restore.textContent = 'เรียกคืนจาก Sheet';
  }

  async function authoritativeRestore(options = {}) {
    if (restoring) return restoring;
    restoring = (async () => {
      const cloud = window.UXQCloudProgress;
      const identity = window.UXQIdentity;
      if (!cloud?.request || !identity) throw new Error('ระบบเรียกคืนข้อมูลยังไม่พร้อม');
      const profile = identity.get();
      if (!identity.isComplete(profile)) throw new Error('กรุณาระบุข้อมูลผู้เรียนให้ครบ');

      if (!options.silent) show('กำลังดึงความก้าวหน้าจาก Google Sheet ของ ' + profile.studentName + '…');
      const result = await cloud.request(profile);
      if (!result || !result.ok) throw new Error(result?.error || 'ไม่พบคำตอบจากระบบ');

      removeBrowserResetState();
      const saved = replaceWithSheet(result);
      const completed = Number(saved?.quest?.completedNodes || 0);
      const next = String(result.nextMission || 'w1').toUpperCase();
      show(result.found
        ? `ดึงจาก Sheet แล้ว ${completed}/19 ด่าน • ด่านถัดไป ${next}`
        : 'Sheet ยังไม่มีประวัติของโปรไฟล์นี้ • 0/19 • เริ่มจาก W1', 'ok');
      return result;
    })();

    try { return await restoring; }
    finally { restoring = null; }
  }

  function intercept(event) {
    const restore = event.target.closest?.('#uxqRestoreProgressBtn');
    const refresh = event.target.closest?.('#uxqStartOverBtn');
    if (!restore && !refresh) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    authoritativeRestore().catch(error => show(error.message || String(error), 'error'));
  }

  function autoRestore() {
    relabelControls();
    const identity = window.UXQIdentity;
    if (!identity?.isComplete?.(identity.get?.())) return;
    authoritativeRestore({ silent:true }).catch(error => show('ดึงข้อมูลจาก Sheet ไม่สำเร็จ: ' + (error.message || error), 'error'));
  }

  document.addEventListener('click', intercept, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(autoRestore, 500));
  window.addEventListener('uxq-profile-updated', () => setTimeout(autoRestore, 80));
  window.UXQCloudProgressAuthority = Object.freeze({ authoritativeRestore, replaceWithSheet });
})();