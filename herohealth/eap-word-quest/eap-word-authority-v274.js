/* =========================================================
   EAP Word Quest • Sheet Authority Client
   Phase 1: Official roster lookup
   Phase 2: Player resume from Google Sheet
   Version: 20260728-EAPWQ-AUTHORITY-CLIENT-V274-NO-DOM-OBSERVER

   Performance rule:
   - no MutationObserver
   - no continuous DOM scan
   - no automatic reload loop
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260728-EAPWQ-AUTHORITY-CLIENT-V274-NO-DOM-OBSERVER';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var GROUP = '122';
  var PROFILE_KEY = 'EAP_WORD_QUEST_PROFILE_V01';
  var STATS_KEY = 'EAP_WORD_QUEST_STATS_V160';
  var AUTH_KEY = 'EAP_WORD_QUEST_AUTHORITY_V274';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var BLOCK_IDS = ['quickStartBtn','weakStartBtn','dailyBtn','speedRunBtn','wordDeckBtn'];
  var state = {ready:false,busy:false,profile:null,resume:null,lastError:''};

  if (window.__EAP_WORD_AUTHORITY_V274__) return;
  window.__EAP_WORD_AUTHORITY_V274__ = true;
  /* Prevent the former observer-based client from starting on cached pages. */
  window.__EAP_WORD_AUTHORITY_V272__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function closest(target, selector) {
    return target && target.closest ? target.closest(selector) : null;
  }

  function jsonp(action, params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var callback = '__eapwqa274_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      var script = document.createElement('script');
      var settled = false;
      var timer;
      var query = new URLSearchParams();
      var values = params || {};

      query.set('action', action);
      query.set('section', GROUP);
      query.set('callback', callback);
      query.set('_', String(Date.now()));
      Object.keys(values).forEach(function (key) {
        query.set(key, values[key]);
      });

      function finish(error, payload) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore2) {}
        if (error) reject(error);
        else resolve(payload || {});
      }

      window[callback] = function (payload) { finish(null, payload); };
      script.onerror = function () { finish(new Error('authority_network_error')); };
      script.src = ENDPOINT + '?' + query.toString();
      timer = setTimeout(function () { finish(new Error('authority_timeout')); }, timeoutMs || 15000);
      document.head.appendChild(script);
    });
  }

  function injectStyle() {
    if (byId('eapWordAuthorityStyle274')) return;
    var style = document.createElement('style');
    style.id = 'eapWordAuthorityStyle274';
    style.textContent = [
      '#eapWordAuthorityPanel{margin-top:12px;padding:13px 15px;border:1px solid #cbd5e1;border-radius:15px;background:#f8fafc;color:#334155;line-height:1.45;font-weight:750}',
      '#eapWordAuthorityPanel.working{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}',
      '#eapWordAuthorityPanel.success{border-color:#bbf7d0;background:#ecfdf5;color:#047857}',
      '#eapWordAuthorityPanel.error{border-color:#fecaca;background:#fff1f2;color:#b42318}',
      '#eapWordAuthorityPanel.warning{border-color:#fed7aa;background:#fff7ed;color:#b45309}',
      'body.eap-word-authority-blocked #sessionGrid{opacity:.58;filter:saturate(.7)}',
      '.eap-authority-locked{opacity:.48!important;filter:grayscale(.35);pointer-events:none!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function panel() {
    var node = byId('eapWordAuthorityPanel');
    var status;
    var host;
    if (node) return node;
    node = document.createElement('div');
    node.id = 'eapWordAuthorityPanel';
    node.setAttribute('aria-live','polite');
    status = byId('profileStatus');
    if (status && status.parentNode) {
      status.parentNode.insertBefore(node,status.nextSibling);
    } else {
      host = closest(byId('saveProfileBtn'),'.panel') || byId('homeScreen') || document.body;
      host.appendChild(node);
    }
    return node;
  }

  function show(message, mode) {
    var node = panel();
    node.className = mode || 'working';
    node.textContent = message;
  }

  function configureProfileUi() {
    var name = byId('studentNameInput');
    var section = byId('sectionInput');
    var id = byId('studentIdInput');
    var save = byId('saveProfileBtn');
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

  function sessionIdFromNode(node) {
    var current = node;
    var names = ['session','sessionId','id','mission'];
    var i;
    var value;
    var match;
    while (current && current !== document.body) {
      if (current.dataset) {
        for (i = 0; i < names.length; i += 1) {
          value = text(current.dataset[names[i]]).toUpperCase();
          if (FLOW.indexOf(value) >= 0) return value;
        }
      }
      match = text(current.textContent).toUpperCase().match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
      if (match) return match[1];
      current = current.parentElement;
    }
    return '';
  }

  function applySessionLocks() {
    var grid = byId('sessionGrid');
    var unlocked;
    if (!grid) return;
    unlocked = (state.resume && state.resume.unlockedSessions) || [];
    Array.prototype.forEach.call(grid.querySelectorAll('button,[role="button"],a,.session-card'),function (node) {
      var id = sessionIdFromNode(node);
      var locked = !state.ready || (id && unlocked.indexOf(id) < 0);
      if (locked) {
        node.classList.add('eap-authority-locked');
        node.setAttribute('aria-disabled','true');
      } else {
        node.classList.remove('eap-authority-locked');
        node.removeAttribute('aria-disabled');
      }
    });
  }

  function setBlocked(blocked) {
    document.body.classList.toggle('eap-word-authority-blocked',blocked);
    BLOCK_IDS.forEach(function (id) {
      var node = byId(id);
      if (!node) return;
      node.disabled = blocked;
      node.setAttribute('aria-disabled',blocked ? 'true' : 'false');
    });
    applySessionLocks();
  }

  function boundedRefresh() {
    [0,250,900,2200].forEach(function (delay) {
      setTimeout(function () {
        configureProfileUi();
        applySessionLocks();
      },delay);
    });
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (ignore) { return {}; }
  }

  function writeOfficialProfile(profile) {
    var official = {
      studentId:text(profile.studentId),
      studentName:text(profile.studentName),
      section:GROUP,
      official:true,
      authority:'google_sheet_roster',
      verifiedAt:new Date().toISOString()
    };
    localStorage.setItem(PROFILE_KEY,JSON.stringify(official));
    if (byId('studentNameInput')) byId('studentNameInput').value = official.studentName;
    if (byId('studentIdInput')) byId('studentIdInput').value = official.studentId;
    if (byId('sectionInput')) byId('sectionInput').value = GROUP;
    state.profile = official;
    return official;
  }

  function writeResumeCache(resume) {
    var stats = readJson(STATS_KEY);
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
    FLOW.forEach(function (id) {
      var row = (resume.sessions && resume.sessions[id]) || {};
      var attempts = Math.max(0,Number(row.attempts || 0));
      var bestAccuracy = Math.max(0,Number(row.bestAccuracy || 0));
      stats.sessions[id] = {
        rounds:attempts,
        correct:Math.round(bestAccuracy),
        total:bestAccuracy > 0 ? 100 : 0,
        xp:Math.max(0,Number(row.bestScore || 0)),
        lastPlayed:row.lastPlayed || null,
        bestAccuracy:bestAccuracy,
        bestXp:Math.max(0,Number(row.bestScore || 0)),
        played:Boolean(row.played || attempts),
        passed:Boolean(row.passed),
        lastPassed:row.passed ? (row.lastPlayed || resume.generatedAt || new Date().toISOString()) : null
      };
    });
    localStorage.setItem(STATS_KEY,JSON.stringify(stats));
    localStorage.setItem(AUTH_KEY,JSON.stringify({version:VERSION,studentId:state.profile.studentId,resume:resume,cachedAt:new Date().toISOString()}));
  }

  async function verifyAndResume(studentId, reason) {
    var id = text(studentId).replace(/\s+/g,'');
    var lookup;
    var resume;
    var messages;
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
      lookup = await jsonp('eap_word_profile_lookup',{studentId:id});
      if (!lookup.ok || !lookup.official || !lookup.profile) throw new Error(lookup.error || 'student_not_found');
      writeOfficialProfile(lookup.profile);
      show('ยืนยันตัวตนแล้ว: ' + lookup.profile.studentName + ' • กำลังโหลดความก้าวหน้า…','working');
      resume = await jsonp('eap_word_player_resume',{studentId:id});
      if (!resume.ok || !resume.official) throw new Error(resume.error || 'resume_failed');
      state.resume = resume;
      writeResumeCache(resume);
      state.ready = true;
      setBlocked(false);
      boundedRefresh();
      show('เชื่อม Google Sheet แล้ว ✓ เล่นต่อที่ ' + (resume.currentSession === 'DONE' ? 'ครบทุกด่านแล้ว' : resume.currentSession) + ' • ความก้าวหน้า ' + Number(resume.progressPercent || 0) + '%','success');
      window.dispatchEvent(new CustomEvent('eap-word-authority-ready',{detail:{profile:state.profile,resume:resume,reason:reason || 'manual'}}));
    } catch (error) {
      state.lastError = String(error && error.message || error);
      state.ready = false;
      setBlocked(true);
      messages = {
        student_not_found:'ไม่พบรหัสนี้ในรายชื่อ Section 122 กรุณาตรวจสอบรหัสนักศึกษา',
        student_inactive:'รหัสนี้ไม่มีสถานะใช้งาน กรุณาติดต่อผู้สอน',
        roster_not_ready:'ยังไม่ได้ติดตั้งรายชื่อทางการใน Google Sheet',
        roster_empty:'Sheet รายชื่อทางการยังไม่มีข้อมูลนักศึกษา',
        authority_timeout:'Google Sheet ตอบกลับช้า กรุณากดลองอีกครั้ง',
        authority_network_error:'เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต'
      };
      show(messages[state.lastError] || ('ยังเข้าเล่นไม่ได้: ' + state.lastError),'error');
    } finally {
      state.busy = false;
    }
  }

  function resetAuthority() {
    [PROFILE_KEY,STATS_KEY,AUTH_KEY,'EAP_WORD_QUEST_AUTHORITY_V272','EAP_WORD_QUEST_RECENT_V01','EAP_WORD_QUEST_DAILY_V01'].forEach(function (key) {
      localStorage.removeItem(key);
    });
    state.ready = false;
    state.profile = null;
    state.resume = null;
    if (byId('studentIdInput')) byId('studentIdInput').value = '';
    if (byId('studentNameInput')) byId('studentNameInput').value = '';
    setBlocked(true);
    boundedRefresh();
    show('ออกจาก Profile แล้ว กรุณากรอกรหัสนักศึกษาเพื่อเริ่มใหม่','warning');
  }

  function captureClicks(event) {
    var save = closest(event.target,'#saveProfileBtn');
    var reset;
    var gameplay;
    var sessionId;
    var unlocked;
    if (save) {
      event.preventDefault();
      event.stopImmediatePropagation();
      verifyAndResume(byId('studentIdInput') ? byId('studentIdInput').value : '','save_button');
      return;
    }
    reset = closest(event.target,'#resetProfileBtn');
    if (reset) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resetAuthority();
      return;
    }
    gameplay = closest(event.target,'#quickStartBtn,#weakStartBtn,#dailyBtn,#speedRunBtn,#wordDeckBtn,#sessionGrid button,#sessionGrid [role="button"],#sessionGrid a,#sessionGrid .session-card');
    if (!gameplay) return;
    sessionId = sessionIdFromNode(gameplay);
    unlocked = (state.resume && state.resume.unlockedSessions) || [];
    if (!state.ready || (sessionId && unlocked.indexOf(sessionId) < 0)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      show(!state.ready ? 'กรุณาตรวจสอบรหัสและโหลดความก้าวหน้าจาก Google Sheet ก่อนเริ่มเล่น' : sessionId + ' ยังไม่ปลดล็อกจากข้อมูลใน Google Sheet','warning');
    }
  }

  function boot() {
    var cached;
    injectStyle();
    configureProfileUi();
    setBlocked(true);
    boundedRefresh();
    document.addEventListener('click',captureClicks,true);
    cached = readJson(PROFILE_KEY);
    if (cached.official && text(cached.studentId)) {
      if (byId('studentIdInput')) byId('studentIdInput').value = cached.studentId;
      if (byId('studentNameInput')) byId('studentNameInput').value = cached.studentName || '';
      verifyAndResume(cached.studentId,'automatic_resume');
    } else {
      show('กรอกรหัสนักศึกษา แล้วกด “ตรวจสอบรหัสและโหลดความก้าวหน้า” ก่อนเริ่มเล่น','warning');
    }
  }

  window.inspectEapWordAuthorityV274 = function () {
    return {version:VERSION,state:JSON.parse(JSON.stringify(state))};
  };
  window.reloadEapWordAuthorityV274 = function () {
    verifyAndResume(byId('studentIdInput') ? byId('studentIdInput').value : '','manual_reload');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();
