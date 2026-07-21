/* CSAI2601 UX Quest • Mission Control Load Recovery v1
 * Fixes identity/bootstrap race and guarantees that the hub never remains
 * permanently blocked by data-uxq-cloud-loading="1".
 * Front-end only: no Sheet schema or Apps Script changes.
 */
(() => {
  'use strict';

  const MAX_WAIT_MS = 9000;
  const POLL_MS = 250;
  let started = false;
  let finished = false;
  let retryCount = 0;

  function setLoading(value) {
    if (!document.body) return;
    document.body.dataset.uxqCloudLoading = value ? '1' : '0';
  }

  function profile() {
    try { return window.UXQIdentity?.get?.() || {}; }
    catch (_) { return {}; }
  }

  function complete(p) {
    try {
      if (window.UXQIdentity?.isComplete) return Boolean(window.UXQIdentity.isComplete(p));
    } catch (_) {}
    return Boolean(String(p?.studentId || '').trim() && String(p?.section || '').trim());
  }

  function updateFallbackCopy(message) {
    const title = document.getElementById('nextTitle');
    const desc = document.getElementById('nextDesc');
    const link = document.getElementById('nextLink');
    if (title) title.textContent = message.title;
    if (desc) desc.textContent = message.desc;
    if (link) {
      link.textContent = message.button;
      link.href = '#';
      link.setAttribute('aria-disabled', message.disabled ? 'true' : 'false');
      link.onclick = message.disabled ? e => e.preventDefault() : async e => {
        e.preventDefault();
        try { await window.UXQIdentity?.open?.({ title:'ระบุข้อมูลผู้เรียน' }); }
        finally { scheduleRestore(true); }
      };
    }
  }

  async function tryRestore(force = false) {
    if (finished && !force) return;
    const api = window.UXQCloudProgress;
    const p = profile();

    if (!complete(p)) {
      setLoading(false);
      updateFallbackCopy({
        title:'กรุณาระบุข้อมูลผู้เรียน',
        desc:'ต้องมีรหัสนักศึกษาและ Section ก่อนดึงความก้าวหน้าจาก Google Sheet',
        button:'ระบุ Profile',
        disabled:false
      });
      return;
    }

    if (!api?.restore) return false;
    started = true;
    setLoading(true);
    try {
      await api.restore({ silent:true });
      finished = true;
      return true;
    } catch (error) {
      retryCount += 1;
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 900));
        return tryRestore(true);
      }
      updateFallbackCopy({
        title:'เชื่อมต่อ Google Sheet ไม่สำเร็จ',
        desc:'ระบบปลดหน้าค้างแล้ว กรุณากด “ดึงความคืบหน้าจาก Sheet” อีกครั้งเมื่อเครือข่ายพร้อม',
        button:'รอตรวจจาก Sheet',
        disabled:true
      });
      return false;
    } finally {
      setLoading(false);
    }
  }

  function waitForDependencies() {
    const began = Date.now();
    return new Promise(resolve => {
      const tick = () => {
        if (window.UXQIdentity && window.UXQCloudProgress) return resolve(true);
        if (Date.now() - began >= MAX_WAIT_MS) return resolve(false);
        setTimeout(tick, POLL_MS);
      };
      tick();
    });
  }

  async function scheduleRestore(force = false) {
    const ready = await waitForDependencies();
    if (!ready) {
      setLoading(false);
      updateFallbackCopy({
        title:'ระบบโหลดข้อมูลผู้เรียนไม่ครบ',
        desc:'หน้าใช้งานถูกปลดล็อกแล้ว ลองรีเฟรชหรือกดดึงความคืบหน้าอีกครั้ง',
        button:'ลองใหม่',
        disabled:false
      });
      return;
    }
    await tryRestore(force);
  }

  function boot() {
    // Safety release even if another script exits early.
    setTimeout(() => {
      if (!started || !finished) setLoading(false);
    }, MAX_WAIT_MS + 1500);
    scheduleRestore(false);
  }

  document.addEventListener('DOMContentLoaded', boot, { once:true });
  window.addEventListener('uxq-profile-updated', () => scheduleRestore(true));
  window.addEventListener('online', () => scheduleRestore(true));

  window.UXQMissionControlLoadRecoveryV1 = Object.freeze({
    restore:() => scheduleRestore(true),
    version:'20260721-MISSION-CONTROL-LOAD-RECOVERY-V1'
  });
})();