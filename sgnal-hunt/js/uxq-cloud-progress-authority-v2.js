/* UX Quest • Cloud Progress Authority v2.1
 * Final guard for Mission Control.
 * Sheet is authoritative; local progress is only a rendered cache.
 */
(() => {
  'use strict';

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

  function clearStartOverMark() {
    try { localStorage.removeItem('uxq.cloud.progress.startOver.v1'); } catch (e) {}
  }

  async function authoritativeRestore() {
    const cloud = window.UXQCloudProgress;
    const identity = window.UXQIdentity;
    if (!cloud?.request || !identity) throw new Error('ระบบเรียกคืนข้อมูลยังไม่พร้อม');
    const profile = identity.get();
    if (!identity.isComplete(profile)) throw new Error('กรุณาระบุข้อมูลผู้เรียนให้ครบ');

    show('กำลังตรวจประวัติจาก Google Sheet ของ ' + profile.studentName + '…');
    const result = await cloud.request(profile);
    if (!result || !result.ok) throw new Error(result?.error || 'ไม่พบคำตอบจากระบบ');

    clearStartOverMark();
    const saved = replaceWithCloud(result);
    const completed = Number(saved?.quest?.completedNodes || 0);
    const next = String(result.nextMission || 'w1').toUpperCase();
    show(result.found
      ? `ดึงจาก Sheet แล้ว ${completed}/19 ด่าน • ด่านถัดไป ${next}`
      : 'Google Sheet ไม่มีประวัติของโปรไฟล์นี้ • 0/19 • เริ่มจาก W1', 'ok');
    return result;
  }

  function intercept(event) {
    const restore = event.target.closest?.('#uxqRestoreProgressBtn');
    if (!restore) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    authoritativeRestore().catch(error => show(error.message || String(error), 'error'));
  }

  function suppressStaleNoHistoryToast() {
    const box = document.getElementById(STATUS_ID);
    if (!box) return;
    const text = String(box.textContent || '');
    const completed = Number(window.UXQProgress?.get?.()?.quest?.completedNodes || 0);
    if (completed > 0 && /ยังไม่พบประวัติเดิม|เริ่มเล่นจาก W1/i.test(text)) {
      box.dataset.show = '0';
      box.textContent = '';
    }
  }

  function observeStatus() {
    const observer = new MutationObserver(suppressStaleNoHistoryToast);
    observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    window.addEventListener('uxq-progress-updated', () => setTimeout(suppressStaleNoHistoryToast, 0));
  }

  async function boot() {
    observeStatus();
    const identity = window.UXQIdentity;
    if (!identity?.isComplete?.(identity.get?.())) return;
    try { await authoritativeRestore(); }
    catch (error) { show('ดึงจาก Sheet ไม่สำเร็จ: ' + (error.message || error), 'error'); }
  }

  document.addEventListener('click', intercept, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 350), { once:true });
  else setTimeout(boot, 350);

  window.UXQCloudProgressAuthority = Object.freeze({ authoritativeRestore, replaceWithCloud });
})();