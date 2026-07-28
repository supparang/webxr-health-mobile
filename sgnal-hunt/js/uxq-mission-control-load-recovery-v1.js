/* CSAI2601 UX Quest • Mission Control Load Recovery v2
 * Front-end only. Google Sheet remains the sole official authority.
 * Prevents permanent loading, explains network failures, and offers safe retry
 * or Content Preview without creating local official progress.
 */
(() => {
  'use strict';

  const MAX_WAIT_MS = 8000;
  const POLL_MS = 250;
  let started = false;
  let finished = false;
  let retryCount = 0;

  const previewHref = () => {
    const url = new URL('./csai2601-mission-control.html', location.href);
    url.searchParams.set('contentPreview','1');
    url.searchParams.set('v','content-preview-v10-20260728');
    return url.pathname + url.search;
  };

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

  function updateProgressPanel(title, detail, state='warning') {
    const candidates = [
      document.querySelector('.studio-status-panel'),
      document.querySelector('.sheet-status-card'),
      document.querySelector('[data-sheet-status]')
    ].filter(Boolean);
    candidates.forEach(panel => {
      panel.dataset.state = state;
      const heading = panel.querySelector('h2,h3,strong');
      const copy = panel.querySelector('p,small');
      if (heading) heading.textContent = title;
      if (copy) copy.textContent = detail;
    });
  }

  function renderActions(link, mode) {
    if (!link) return;
    const host = link.parentElement;
    if (!host) return;
    host.querySelectorAll('[data-sheet-recovery-action]').forEach(el => el.remove());

    if (mode === 'retry') {
      link.textContent = 'ลองเชื่อมต่อ Sheet อีกครั้ง';
      link.href = '#';
      link.setAttribute('aria-disabled','false');
      link.onclick = async event => {
        event.preventDefault();
        retryCount = 0;
        await scheduleRestore(true);
      };

      const preview = document.createElement('a');
      preview.dataset.sheetRecoveryAction = 'preview';
      preview.className = link.className;
      preview.href = previewHref();
      preview.textContent = 'เปิด Content Preview เพื่อตรวจ Front-end';
      preview.style.marginTop = '10px';
      preview.style.background = 'transparent';
      preview.style.color = '#eaf3ff';
      preview.style.border = '1px solid rgba(255,255,255,.35)';
      host.appendChild(preview);
    }
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
      link.onclick = message.disabled ? event => event.preventDefault() : async event => {
        event.preventDefault();
        if (message.action === 'profile') {
          try { await window.UXQIdentity?.open?.({ title:'ระบุข้อมูลผู้เรียน' }); }
          finally { scheduleRestore(true); }
        } else {
          retryCount = 0;
          scheduleRestore(true);
        }
      };
      if (message.action === 'retry') renderActions(link,'retry');
    }
  }

  async function tryRestore(force = false) {
    if (finished && !force) return true;
    const api = window.UXQCloudProgress;
    const p = profile();

    if (!complete(p)) {
      setLoading(false);
      updateFallbackCopy({
        title:'กรุณาระบุข้อมูลผู้เรียน',
        desc:'ต้องมีรหัสนักศึกษาและ Section ก่อนตรวจความก้าวหน้าจาก Google Sheet',
        button:'ระบุ Profile',
        disabled:false,
        action:'profile'
      });
      updateProgressPanel('ยังไม่ได้ระบุผู้เรียน','ระบบยังไม่อ่านหรือสร้างความก้าวหน้าใด ๆ','idle');
      return false;
    }

    if (!api?.restore) return false;
    started = true;
    setLoading(true);
    try {
      await api.restore({ silent:true });
      finished = true;
      updateProgressPanel('เชื่อมต่อ Google Sheet แล้ว','ใช้ข้อมูลจาก Sheet เป็นสถานะทางการ','success');
      return true;
    } catch (error) {
      retryCount += 1;
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve,700));
        return tryRestore(true);
      }
      const code = String(error?.code || error?.message || 'network_error');
      updateFallbackCopy({
        title:'ยังเชื่อมต่อ Google Sheet ไม่สำเร็จ',
        desc:'หน้าไม่ค้างแล้ว และระบบจะไม่สร้างความก้าวหน้าจากข้อมูลในเครื่อง สามารถลองใหม่หรือเปิด Content Preview เพื่อตรวจ Front-end',
        button:'ลองเชื่อมต่อ Sheet อีกครั้ง',
        disabled:false,
        action:'retry'
      });
      updateProgressPanel('ยังไม่ได้รับข้อมูลทางการจาก Sheet',`การเชื่อมต่อล้มเหลว: ${code}`,'error');
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
        setTimeout(tick,POLL_MS);
      };
      tick();
    });
  }

  async function scheduleRestore(force = false) {
    setLoading(true);
    const ready = await waitForDependencies();
    if (!ready) {
      setLoading(false);
      updateFallbackCopy({
        title:'ส่วนเชื่อมต่อข้อมูลยังโหลดไม่ครบ',
        desc:'หน้าไม่ค้างแล้ว ระบบยังไม่เปลี่ยนสถานะผู้เรียน สามารถลองใหม่หรือเปิด Content Preview',
        button:'ลองโหลดระบบอีกครั้ง',
        disabled:false,
        action:'retry'
      });
      updateProgressPanel('ส่วนเชื่อมต่อข้อมูลไม่พร้อม','ยังไม่มีการอ่านหรือเขียนความก้าวหน้า','error');
      return false;
    }
    return tryRestore(force);
  }

  function boot() {
    setTimeout(() => {
      if (!started || !finished) setLoading(false);
    },MAX_WAIT_MS + 1000);
    scheduleRestore(false);
  }

  document.addEventListener('DOMContentLoaded',boot,{once:true});
  window.addEventListener('uxq-profile-updated',() => scheduleRestore(true));
  window.addEventListener('online',() => { retryCount = 0; scheduleRestore(true); });

  window.UXQMissionControlLoadRecoveryV1 = Object.freeze({
    restore:() => scheduleRestore(true),
    version:'20260728-MISSION-CONTROL-LOAD-RECOVERY-V2'
  });
})();