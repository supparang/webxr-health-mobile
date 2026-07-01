/* AI Quest Profile Save Hard Fix v4.1.8
   Runs in capture phase before legacy listeners. Persists identity into the
   exact main state key, then reloads so inline state/render uses the saved profile.
*/
(() => {
  'use strict';
  const STATE_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const BACKUP_KEY = 'AIQUEST_PROFILE_BACKUP_V418';

  const get = (id) => document.getElementById(id);
  const clean = (v) => String(v || '').trim();
  function read(key){ try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) { return {}; } }
  function write(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function persistAndReload(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('#btnSaveProfile') : null;
    if(!btn) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    const studentId = clean(get('studentIdInput')?.value);
    const studentName = clean(get('studentNameInput')?.value);
    const status = get('profileStatus');

    if(!studentId || !studentName){
      if(status) status.textContent = 'กรอก Student ID และ Name ให้ครบก่อนบันทึก';
      return;
    }

    const profile = { studentId, studentName, section:'101', savedAt:new Date().toISOString() };
    const state = read(STATE_KEY);
    state.studentId = studentId;
    state.studentName = studentName;
    state.section = '101';
    state.profile = profile;
    write(STATE_KEY, state);
    write(BACKUP_KEY, profile);

    // Common profile keys used by legacy patch modules.
    write('AIQUEST_PROFILE', profile);
    write('CSAI2102_AIQUEST_PROFILE', profile);

    if(get('sectionInput')) get('sectionInput').value = '101';
    if(status) status.textContent = 'บันทึก Profile แล้ว: ' + studentId + ' • ' + studentName + ' — กำลังอัปเดตหน้า';

    btn.disabled = true;
    btn.textContent = 'Saved ✓';
    setTimeout(() => location.reload(), 220);
  }

  function restoreFields(){
    const p = read(BACKUP_KEY);
    if(!p.studentId) return;
    const id = get('studentIdInput'), name = get('studentNameInput'), section = get('sectionInput');
    if(id && !clean(id.value)) id.value = p.studentId;
    if(name && !clean(name.value)) name.value = p.studentName;
    if(section) section.value = '101';
  }

  function boot(){
    restoreFields();
    document.addEventListener('click', persistAndReload, true);
    console.log('[AIQuest] profile save hardfix v4.1.8 loaded');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();