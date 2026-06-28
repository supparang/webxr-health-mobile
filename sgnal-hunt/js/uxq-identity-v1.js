/* UX Quest • Learner Identity v1
   Stores the minimum classroom profile locally: student ID, name, and section.
   It does not contact any server by itself.
*/
(() => {
  'use strict';

  const KEY = 'uxq.classroom.profile.v1';
  const memory = new Map();
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};

  function safeGet(area, key){
    try { return area.getItem(key); } catch (error) { return null; }
  }
  function safeSet(area, key, value){
    try { area.setItem(key, value); return true; } catch (error) { return false; }
  }
  function readRaw(){
    return safeGet(window.localStorage, KEY)
      || safeGet(window.sessionStorage, KEY)
      || memory.get(KEY)
      || '';
  }
  function clean(input){
    const value = input && typeof input === 'object' ? input : {};
    return {
      studentId: String(value.studentId || '').trim().slice(0, 80),
      studentName: String(value.studentName || '').trim().slice(0, 120),
      section: String(value.section || config().defaultSection || '').trim().slice(0, 80),
      updatedAt: value.updatedAt || null
    };
  }
  function get(){
    try { return clean(JSON.parse(readRaw())); }
    catch (error) { return clean({}); }
  }
  function isComplete(profile){
    const p = clean(profile);
    return Boolean(p.studentId && p.studentName && p.section);
  }
  function save(profile){
    const next = clean(profile);
    next.updatedAt = new Date().toISOString();
    const text = JSON.stringify(next);
    if (!safeSet(window.localStorage, KEY, text)) {
      if (!safeSet(window.sessionStorage, KEY, text)) memory.set(KEY, text);
    }
    window.dispatchEvent(new CustomEvent('uxq-profile-updated', { detail: next }));
    return next;
  }
  function clear(){
    try { window.localStorage.removeItem(KEY); } catch (error) {}
    try { window.sessionStorage.removeItem(KEY); } catch (error) {}
    memory.delete(KEY);
    window.dispatchEvent(new CustomEvent('uxq-profile-updated', { detail: clean({}) }));
  }
  function esc(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function ensureStyle(){
    if (document.getElementById('uxq-identity-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-identity-style';
    style.textContent = `
      .uxq-profile-row{display:grid;gap:5px;margin:9px 0 2px;padding:9px;border:1px solid rgba(189,211,255,.16);border-radius:10px;background:rgba(0,0,0,.11)}
      .uxq-profile-row b{font-size:11px;color:#edf3ff}.uxq-profile-row small{font-size:10px;color:#aebcdf;line-height:1.42}.uxq-profile-row button{min-height:32px;border:1px solid rgba(139,184,255,.45);border-radius:9px;background:rgba(99,130,255,.17);color:#eef4ff;cursor:pointer;font:inherit;font-size:11px;font-weight:800}
      .uxq-profile-layer{position:fixed;z-index:9999;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,8,22,.76);backdrop-filter:blur(6px)}
      .uxq-profile-dialog{width:min(520px,100%);padding:22px;border:1px solid rgba(173,210,255,.32);border-radius:20px;background:linear-gradient(150deg,#182c58,#0d1937);color:#f4f7ff;box-shadow:0 28px 70px rgba(0,0,0,.48)}
      .uxq-profile-dialog h2{margin:0;font-size:clamp(1.35rem,3vw,1.9rem);letter-spacing:-.03em}.uxq-profile-dialog p{margin:9px 0 0;color:#c3d0ef;line-height:1.58;font-size:.92rem}.uxq-profile-fields{display:grid;gap:11px;margin-top:18px}.uxq-profile-fields label{display:grid;gap:6px;color:#d9e5ff;font-size:.82rem;font-weight:800}.uxq-profile-fields input{width:100%;min-height:42px;border:1px solid rgba(194,216,255,.28);border-radius:11px;background:#07142f;color:#f5f8ff;padding:10px 11px;font:inherit}.uxq-profile-fields input:focus{outline:3px solid rgba(110,231,255,.3);border-color:#7be8ff}.uxq-profile-error{min-height:18px;margin:12px 0 0;color:#ffb4c1;font-size:.82rem}.uxq-profile-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:8px}.uxq-profile-actions button{border:0;border-radius:11px;padding:11px 13px;font:inherit;font-weight:900;cursor:pointer}.uxq-profile-save{background:#73e7ff;color:#042033}.uxq-profile-guest{background:transparent;color:#e8efff;border:1px solid rgba(209,225,255,.32)!important}.uxq-profile-cancel{background:transparent;color:#aebedf}
    `;
    document.head.appendChild(style);
  }
  function open(options){
    ensureStyle();
    const opt = Object.assign({ allowGuest: Boolean(config().allowGuestPractice), title: 'ตั้งค่าข้อมูลผู้เรียน' }, options || {});
    const previous = get();
    return new Promise((resolve) => {
      const layer = document.createElement('div');
      layer.className = 'uxq-profile-layer';
      layer.setAttribute('role', 'dialog');
      layer.setAttribute('aria-modal', 'true');
      layer.innerHTML = `
        <section class="uxq-profile-dialog" aria-labelledby="uxqProfileTitle">
          <h2 id="uxqProfileTitle">${esc(opt.title)}</h2>
          <p>ใช้เพื่อบันทึกผลการเรียนเฉพาะในชั้นเรียน ข้อมูลนี้เก็บในเบราว์เซอร์ก่อน และจะส่งเมื่อผู้สอนเปิดระบบรับผลแล้วเท่านั้น</p>
          <form id="uxqProfileForm" novalidate>
            <div class="uxq-profile-fields">
              <label>รหัสนักศึกษา<input id="uxqProfileId" autocomplete="off" inputmode="numeric" maxlength="80" required></label>
              <label>ชื่อ–นามสกุล<input id="uxqProfileName" autocomplete="name" maxlength="120" required></label>
              <label>กลุ่ม / Section<input id="uxqProfileSection" autocomplete="off" maxlength="80" required></label>
            </div>
            <div id="uxqProfileError" class="uxq-profile-error" aria-live="polite"></div>
            <div class="uxq-profile-actions">
              <button class="uxq-profile-save" type="submit">บันทึกและเริ่มภารกิจ</button>
              ${opt.allowGuest ? '<button id="uxqProfileGuest" class="uxq-profile-guest" type="button">เล่นแบบทดลอง</button>' : ''}
              <button id="uxqProfileCancel" class="uxq-profile-cancel" type="button">ยกเลิก</button>
            </div>
          </form>
        </section>`;
      document.body.appendChild(layer);
      const idEl = layer.querySelector('#uxqProfileId');
      const nameEl = layer.querySelector('#uxqProfileName');
      const sectionEl = layer.querySelector('#uxqProfileSection');
      const errorEl = layer.querySelector('#uxqProfileError');
      idEl.value = previous.studentId;
      nameEl.value = previous.studentName;
      sectionEl.value = previous.section || config().defaultSection || '';
      window.setTimeout(() => (idEl.value ? nameEl : idEl).focus(), 0);
      function close(value){ layer.remove(); resolve(value); }
      layer.querySelector('#uxqProfileForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const profile = clean({ studentId: idEl.value, studentName: nameEl.value, section: sectionEl.value });
        if (!isComplete(profile)) {
          errorEl.textContent = 'กรุณากรอกรหัสนักศึกษา ชื่อ–นามสกุล และกลุ่ม / Section ให้ครบ';
          return;
        }
        close(save(profile));
      });
      layer.querySelector('#uxqProfileGuest')?.addEventListener('click', () => close({ guest: true }));
      layer.querySelector('#uxqProfileCancel').addEventListener('click', () => close(null));
      layer.addEventListener('click', (event) => { if (event.target === layer) close(null); });
    });
  }
  function ensureForMission(){
    const profile = get();
    return isComplete(profile) ? Promise.resolve(profile) : open({ title: 'ก่อนเริ่มภารกิจ' });
  }
  function profileLabel(profile){
    const p = clean(profile);
    return isComplete(p) ? `${p.studentName} • ${p.section}` : 'ยังไม่ได้ระบุผู้เรียน';
  }
  function mountHubProfile(){
    ensureStyle();
    const panel = document.querySelector('#progressMenu .hub-menu__panel');
    if (!panel || document.getElementById('uxqProfileRow')) return;
    const row = document.createElement('div');
    row.id = 'uxqProfileRow';
    row.className = 'uxq-profile-row';
    const title = document.createElement('b');
    title.textContent = 'LEARNER PROFILE';
    const detail = document.createElement('small');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'ตั้งค่าผู้เรียน';
    const render = () => { detail.textContent = profileLabel(get()); };
    button.addEventListener('click', () => open({ title: 'ตั้งค่าข้อมูลผู้เรียน' }).then(render));
    row.append(title, detail, button);
    const reset = panel.querySelector('#resetProgressBtn');
    panel.insertBefore(row, reset || null);
    render();
    window.addEventListener('uxq-profile-updated', render);
  }
  document.addEventListener('DOMContentLoaded', mountHubProfile);

  window.UXQIdentity = Object.freeze({ KEY, get, save, clear, isComplete, open, ensureForMission, profileLabel });
})();
