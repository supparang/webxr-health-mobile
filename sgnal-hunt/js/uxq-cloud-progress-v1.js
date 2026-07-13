/* UX Quest • Cloud Progress Client v2
 * Thin client only: profile UI + Sheet request transport.
 * Mission state is owned exclusively by uxq-cloud-progress-authority-v2.js.
 */
(() => {
  'use strict';

  const PROFILE_ROW_ID = 'uxqCloudProfileRow';
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const identity = () => window.UXQIdentity;

  function ensureStyle(){
    if (document.getElementById('uxq-cloud-progress-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-cloud-progress-style';
    style.textContent = `
      .uxq-cloud-profile{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 11px;border:1px solid rgba(155,205,255,.22);border-radius:13px;background:rgba(7,20,47,.56);color:#eaf3ff}
      .uxq-cloud-profile__info{display:grid;gap:2px;min-width:190px;flex:1}.uxq-cloud-profile__info b{font-size:.83rem}.uxq-cloud-profile__info small{color:#aebfe4;font-size:.72rem;line-height:1.35}
      .uxq-cloud-profile button{min-height:34px;border:1px solid rgba(123,232,255,.38);border-radius:10px;padding:7px 11px;background:rgba(55,154,210,.18);color:#eef8ff;font:inherit;font-size:.76rem;font-weight:900;cursor:pointer}
      .uxq-cloud-profile button:hover{background:rgba(76,194,238,.28)}
      .uxq-cloud-status{position:fixed;right:18px;bottom:18px;z-index:9998;max-width:min(430px,calc(100vw - 36px));padding:11px 14px;border:1px solid rgba(123,232,255,.36);border-radius:13px;background:#10274e;color:#eef8ff;box-shadow:0 18px 44px rgba(0,0,0,.35);font-size:.82rem;line-height:1.45;opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s ease}
      .uxq-cloud-status[data-show="1"]{opacity:1;transform:none}.uxq-cloud-status[data-tone="ok"]{border-color:rgba(84,235,174,.55)}.uxq-cloud-status[data-tone="error"]{border-color:rgba(255,137,159,.58)}
    `;
    document.head.appendChild(style);
  }

  function jsonp(url){
    return new Promise((resolve, reject) => {
      const callback = '__uxqCloudCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('หมดเวลารอข้อมูลจากระบบ')), 12000);
      function finish(error, value){
        clearTimeout(timer);
        try { delete window[callback]; } catch (e) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      }
      window[callback] = value => finish(null, value);
      const u = new URL(url);
      u.searchParams.set('callback', callback);
      script.src = u.href;
      script.onerror = () => finish(new Error('เชื่อมต่อระบบเรียกคืนข้อมูลไม่ได้'));
      document.head.appendChild(script);
    });
  }

  async function request(profile){
    const cfg = config();
    if (!cfg.receiverUrl) throw new Error('ยังไม่ได้ตั้งค่า receiverUrl');
    const url = new URL(cfg.receiverUrl);
    url.searchParams.set('action', 'uxq_student_progress');
    url.searchParams.set('studentId', String(profile.studentId || '').trim());
    url.searchParams.set('section', String(profile.section || '').trim());
    url.searchParams.set('courseId', String(cfg.courseId || 'UXQ-ACT1-2026').trim());
    url.searchParams.set('_', Date.now());
    try {
      const response = await fetch(url.href, { method:'GET', cache:'no-store', redirect:'follow' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      return jsonp(url.href);
    }
  }

  function profileText(){
    const id = identity();
    const p = id?.get?.() || {};
    return id?.isComplete?.(p)
      ? `${p.studentName} • ${p.studentId} • Section ${p.section}`
      : 'ยังไม่ได้ระบุผู้เรียน';
  }

  function renderProfile(){
    const el = document.getElementById('uxqCloudProfileText');
    if (el) el.textContent = profileText();
  }

  function mount(){
    ensureStyle();
    if (document.getElementById(PROFILE_ROW_ID)) return;
    const topbar = document.querySelector('.hub-topbar');
    if (!topbar) return;
    const row = document.createElement('div');
    row.id = PROFILE_ROW_ID;
    row.className = 'uxq-cloud-profile';
    row.innerHTML = `<div class="uxq-cloud-profile__info"><b>LEARNER CLOUD PROFILE</b><small id="uxqCloudProfileText"></small></div><button type="button" id="uxqEditProfileBtn">แก้ไข Profile</button><button type="button" id="uxqRestoreProgressBtn">ดึงความคืบหน้าจาก Sheet</button>`;
    topbar.insertAdjacentElement('afterend', row);
    row.querySelector('#uxqEditProfileBtn').addEventListener('click', async () => {
      const id = identity();
      const updated = await id?.open?.({ title:'แก้ไขข้อมูลผู้เรียน' });
      if (updated && !updated.guest) {
        renderProfile();
        window.dispatchEvent(new CustomEvent('uxq-profile-updated', { detail:updated }));
      }
    });
    renderProfile();
  }

  document.addEventListener('DOMContentLoaded', mount, { once:true });
  window.addEventListener('uxq-profile-updated', renderProfile);
  window.UXQCloudProgress = Object.freeze({ request });
})();