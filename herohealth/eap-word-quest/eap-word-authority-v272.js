/* =========================================================
   EAP Word Quest • Sheet Authority Client
   Phase 1: Official roster lookup
   Phase 2: Player resume from Google Sheet
   Version: 20260728-EAPWQ-AUTHORITY-CLIENT-V272
========================================================= */
(() => {
  'use strict';

  const VERSION = '20260728-EAPWQ-AUTHORITY-CLIENT-V272';
  const ENDPOINT_FALLBACK = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const GROUP = '122';
  const PROFILE_KEY = 'EAP_WORD_QUEST_PROFILE_V01';
  const STATS_KEY = 'EAP_WORD_QUEST_STATS_V160';
  const AUTH_KEY = 'EAP_WORD_QUEST_AUTHORITY_V272';
  const FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  const BLOCK_IDS = ['quickStartBtn','weakStartBtn','dailyBtn','speedRunBtn','wordDeckBtn'];

  if (window.__EAP_WORD_AUTHORITY_V272__) return;
  window.__EAP_WORD_AUTHORITY_V272__ = true;

  const state = {ready:false,busy:false,profile:null,resume:null,lastError:''};
  const norm = (value) => String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  const el = (id) => document.getElementById(id);
  const endpoint = () => {
    const config = window.EAP_WORD_SHEET_CONFIG || {};
    return norm(config.endpoint || config.url || ENDPOINT_FALLBACK);
  };

  function jsonp(action, params = {}, timeoutMs = 12000) {
    return new Promise((resolve,reject) => {
      const callback = `__eapwqa_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const script = document.createElement('script');
      let settled = false;
      const finish = (error,payload) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        try { script.remove(); } catch (_) {}
        error ? reject(error) : resolve(payload || {});
      };
      const timer = setTimeout(() => finish(new Error('authority_timeout')),timeoutMs);
      window[callback] = (payload) => finish(null,payload);
      script.onerror = () => finish(new Error('authority_network_error'));
      const query = new URLSearchParams({action,section:GROUP,callback,_:String(Date.now()),...params});
      script.src = `${endpoint()}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  function injectStyle() {
    if (document.getElementById('eapWordAuthorityStyle')) return;
    const style = document.createElement('style');
    style.id = 'eapWordAuthorityStyle';
    style.textContent = `
      #eapWordAuthorityPanel{margin-top:12px;padding:13px 15px;border:1px solid #cbd5e1;border-radius:15px;background:#f8fafc;color:#334155;line-height:1.45;font-weight:750}
      #eapWordAuthorityPanel.working{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}
      #eapWordAuthorityPanel.success{border-color:#bbf7d0;background:#ecfdf5;color:#047857}
      #eapWordAuthorityPanel.error{border-color:#fecaca;background:#fff1f2;color:#b42318}
      #eapWordAuthorityPanel.warning{border-color:#fed7aa;background:#fff7ed;color:#b45309}
      body.eap-word-authority-blocked #sessionGrid{opacity:.58;filter:saturate(.7)}
      body.eap-word-authority-blocked #sessionGrid button,body.eap-word-authority-blocked #sessionGrid [role="button"]{cursor:not-allowed!important}
      .eap-authority-locked{opacity:.48!important;filter:grayscale(.35);pointer-events:none!important}
    `;
    document.head.appendChild(style);
  }

  function authorityPanel() {
    let panel = el('eapWordAuthorityPanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'eapWordAuthorityPanel';
    panel.setAttribute('aria-live','polite');
    const status = el('profileStatus');
    if (status) status.after(panel);
    else (el('saveProfileBtn')?.closest('.panel') || el('homeScreen') || document.body).appendChild(panel);
    return panel;
  }

  function show(message,mode = 'working') {
    const panel = authorityPanel();
    panel.className = mode;
    panel.textContent = message;
  }

  function configureProfileUi() {
    const name = el('studentNameInput');
    const section = el('sectionInput');
    const id = el('studentIdInput');
    const save = el('saveProfileBtn');
    if (name) {
      name.readOnly = true;
      name.placeholder = 'ระบบจะดึงชื่อจากรายชื่อทางการ';
    }
    if (section) {
      section.value = GROUP;
      section.readOnly = true;
    }
    if (id) {
      id.inputMode = 'numeric';
      id.autocomplete = 'off';
      id.placeholder = 'กรอกรหัสนักศึกษา';
    }
    if (save) save.textContent = 'ตรวจสอบรหัสและโหลดความก้าวหน้า';
  }

  function setBlocked(blocked) {
    document.body.classList.toggle('eap-word-authority-blocked',blocked);
    BLOCK_IDS.forEach((id) => {
      const node = el(id);
      if (!node) return;
      node.disabled = blocked;
      node.setAttribute('aria-disabled',blocked ? 'true' : 'false');
    });
    applySessionLocks();
  }

  function sessionIdFromNode(node) {
    let current = node;
    while (current && current !== document.body) {
      for (const name of ['session','sessionId','id','mission']) {
        const value = current.dataset && current.dataset[name];
        if (FLOW.includes(norm(value).toUpperCase())) return norm(value).toUpperCase();
      }
      const text = norm(current.textContent).toUpperCase();
      const match = text.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
      if (match) return match[1];
      current = current.parentElement;
    }
    return '';
  }

  function applySessionLocks() {
    const grid = el('sessionGrid');
    if (!grid) return;
    const unlocked = new Set((state.resume && state.resume.unlockedSessions) || []);
    grid.querySelectorAll('button,[role="button"],a,.session-card').forEach((node) => {
      const id = sessionIdFromNode(node);
      const locked = !state.ready || (id && !unlocked.has(id));
      node.classList.toggle('eap-authority-locked',Boolean(locked));
      if (locked) node.setAttribute('aria-disabled','true');
      else node.removeAttribute('aria-disabled');
    });
  }

  function readProfileCache() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function writeOfficialProfile(profile) {
    const official = {
      studentId:norm(profile.studentId),
      studentName:norm(profile.studentName),
      section:GROUP,
      official:true,
      authority:'google_sheet_roster',
      verifiedAt:new Date().toISOString()
    };
    localStorage.setItem(PROFILE_KEY,JSON.stringify(official));
    if (el('studentNameInput')) el('studentNameInput').value = official.studentName;
    if (el('studentIdInput')) el('studentIdInput').value = official.studentId;
    if (el('sectionInput')) el('sectionInput').value = GROUP;
    state.profile = official;
    return official;
  }

  function statsFromResume(resume) {
    let stats = {};
    try { stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}') || {}; }
    catch (_) { stats = {}; }
    stats.version = stats.version || VERSION;
    stats.createdAt = stats.createdAt || new Date().toISOString();
    stats.updatedAt = new Date().toISOString();
    stats.sessions = {};
    stats.words = stats.words && typeof stats.words === 'object' ? stats.words : {};
    stats.history = Array.isArray(stats.history) ? stats.history.slice(0,80) : [];
    stats.profileSnapshot = state.profile;
    stats.sheetAuthority = {
      version:resume.version || VERSION,
      generatedAt:resume.generatedAt || new Date().toISOString(),
      currentSession:resume.currentSession,
      progressPercent:Number(resume.progressPercent || 0)
    };
    FLOW.forEach((id) => {
      const row = (resume.sessions && resume.sessions[id]) || {};
      const attempts = Math.max(0,Number(row.attempts || 0));
      const bestAccuracy = Math.max(0,Number(row.bestAccuracy || 0));
      stats.sessions[id] = {
        rounds:attempts,
        correct:Math.round(bestAccuracy),
        total:bestAccuracy > 0 ? 100 : 0,
        xp:Math.max(0,Number(row.bestScore || 0)),
        lastPlayed:row.lastPlayed || null,
        bestAccuracy,
        bestXp:Math.max(0,Number(row.bestScore || 0)),
        played:Boolean(row.played || attempts),
        passed:Boolean(row.passed),
        lastPassed:row.passed ? (row.lastPlayed || resume.generatedAt || new Date().toISOString()) : null
      };
    });
    return stats;
  }

  function resumeFingerprint(resume) {
    return FLOW.map((id) => {
      const row = (resume.sessions && resume.sessions[id]) || {};
      return `${id}:${row.passed ? 1 : 0}:${Number(row.attempts || 0)}:${Number(row.bestAccuracy || 0)}`;
    }).join('|');
  }

  function applyResume(resume) {
    state.resume = resume;
    const fingerprint = resumeFingerprint(resume);
    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}') || {}; }
    catch (_) { previous = {}; }
    localStorage.setItem(STATS_KEY,JSON.stringify(statsFromResume(resume)));
    localStorage.setItem(AUTH_KEY,JSON.stringify({version:VERSION,studentId:state.profile.studentId,fingerprint,resume,cachedAt:new Date().toISOString()}));
    const reloadKey = `EAPWQ_AUTH_RELOADED_${state.profile.studentId}`;
    if (previous.fingerprint !== fingerprint && sessionStorage.getItem(reloadKey) !== fingerprint) {
      sessionStorage.setItem(reloadKey,fingerprint);
      location.reload();
      return false;
    }
    return true;
  }

  async function verifyAndResume(studentId,reason = 'manual') {
    const id = norm(studentId).replace(/\s+/g,'');
    if (!id) {
      show('กรุณากรอกรหัสนักศึกษาก่อน','error');
      return;
    }
    if (state.busy) return;
    state.busy = true;
    state.ready = false;
    setBlocked(true);
    show('กำลังตรวจสอบรหัสนักศึกษาจากรายชื่อทางการ…','working');
    try {
      const lookup = await jsonp('eap_word_profile_lookup',{studentId:id});
      if (!lookup.ok || !lookup.official || !lookup.profile) throw new Error(lookup.error || 'student_not_found');
      writeOfficialProfile(lookup.profile);
      show(`ยืนยันตัวตนแล้ว: ${lookup.profile.studentName} • กำลังโหลดความก้าวหน้า…`,'working');
      const resume = await jsonp('eap_word_player_resume',{studentId:id});
      if (!resume.ok || !resume.official) throw new Error(resume.error || 'resume_failed');
      const stable = applyResume(resume);
      if (!stable) return;
      state.ready = true;
      setBlocked(false);
      applySessionLocks();
      show(`เชื่อม Google Sheet แล้ว ✓ เล่นต่อที่ ${resume.currentSession === 'DONE' ? 'ครบทุกด่านแล้ว' : resume.currentSession} • ความก้าวหน้า ${Number(resume.progressPercent || 0)}%`,'success');
      window.dispatchEvent(new CustomEvent('eap-word-authority-ready',{detail:{profile:state.profile,resume,reason}}));
    } catch (error) {
      state.lastError = String(error && error.message || error);
      state.ready = false;
      setBlocked(true);
      const messages = {
        student_not_found:'ไม่พบรหัสนี้ในรายชื่อ Section 122 กรุณาตรวจสอบรหัสนักศึกษา',
        student_inactive:'รหัสนี้ไม่มีสถานะใช้งาน กรุณาติดต่อผู้สอน',
        roster_not_ready:'ยังไม่ได้ติดตั้งรายชื่อทางการใน Google Sheet',
        roster_empty:'Sheet รายชื่อทางการยังไม่มีข้อมูลนักศึกษา',
        authority_timeout:'Google Sheet ตอบกลับช้า กรุณากดลองอีกครั้ง',
        authority_network_error:'เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต'
      };
      show(messages[state.lastError] || `ยังเข้าเล่นไม่ได้: ${state.lastError}`,'error');
    } finally {
      state.busy = false;
    }
  }

  function resetAuthority() {
    [PROFILE_KEY,STATS_KEY,AUTH_KEY,'EAP_WORD_QUEST_RECENT_V01','EAP_WORD_QUEST_DAILY_V01'].forEach((key) => localStorage.removeItem(key));
    Object.keys(sessionStorage).filter((key) => key.startsWith('EAPWQ_AUTH_RELOADED_')).forEach((key) => sessionStorage.removeItem(key));
    state.ready = false;
    state.profile = null;
    state.resume = null;
    if (el('studentIdInput')) el('studentIdInput').value = '';
    if (el('studentNameInput')) el('studentNameInput').value = '';
    setBlocked(true);
    show('ออกจาก Profile แล้ว กรุณากรอกรหัสนักศึกษาเพื่อเริ่มใหม่','warning');
  }

  function captureClicks(event) {
    const save = event.target.closest && event.target.closest('#saveProfileBtn');
    if (save) {
      event.preventDefault();
      event.stopImmediatePropagation();
      verifyAndResume(el('studentIdInput')?.value || '','save_button');
      return;
    }
    const reset = event.target.closest && event.target.closest('#resetProfileBtn');
    if (reset) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resetAuthority();
      return;
    }
    const gameplay = event.target.closest && event.target.closest('#quickStartBtn,#weakStartBtn,#dailyBtn,#speedRunBtn,#wordDeckBtn,#sessionGrid button,#sessionGrid [role="button"],#sessionGrid a,#sessionGrid .session-card');
    if (!gameplay) return;
    const sessionId = sessionIdFromNode(gameplay);
    const unlocked = new Set((state.resume && state.resume.unlockedSessions) || []);
    if (!state.ready || (sessionId && !unlocked.has(sessionId))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      show(!state.ready ? 'กรุณาตรวจสอบรหัสและโหลดความก้าวหน้าจาก Google Sheet ก่อนเริ่มเล่น' : `${sessionId} ยังไม่ปลดล็อกจากข้อมูลใน Google Sheet`,'warning');
    }
  }

  function boot() {
    injectStyle();
    configureProfileUi();
    setBlocked(true);
    document.addEventListener('click',captureClicks,true);
    const observer = new MutationObserver(() => {
      configureProfileUi();
      applySessionLocks();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    const cached = readProfileCache();
    if (cached.official && norm(cached.studentId)) {
      if (el('studentIdInput')) el('studentIdInput').value = cached.studentId;
      if (el('studentNameInput')) el('studentNameInput').value = cached.studentName || '';
      verifyAndResume(cached.studentId,'automatic_resume');
    } else {
      show('กรอกรหัสนักศึกษา แล้วกด “ตรวจสอบรหัสและโหลดความก้าวหน้า” ก่อนเริ่มเล่น','warning');
    }
  }

  window.inspectEapWordAuthorityV272 = () => ({version:VERSION,state:JSON.parse(JSON.stringify(state))});
  window.reloadEapWordAuthorityV272 = () => verifyAndResume(el('studentIdInput')?.value || '','manual_reload');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
