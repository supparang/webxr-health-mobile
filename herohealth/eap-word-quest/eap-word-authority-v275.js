/* =========================================================
   EAP Word Quest • Google Sheet Authority Client
   Version: 20260728-EAPWQ-AUTHORITY-V275-VERIFICATION-PROOF

   Design rules
   - Google Sheet is the official authority.
   - localStorage is cache only.
   - no MutationObserver.
   - no continuous DOM scan.
   - no automatic reload loop.
   - unverified legacy profile values are removed from the UI.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260728-EAPWQ-AUTHORITY-V275-VERIFICATION-PROOF';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var GROUP = '122';
  var PROFILE_KEY = 'EAP_WORD_QUEST_PROFILE_V01';
  var STATS_KEY = 'EAP_WORD_QUEST_STATS_V160';
  var AUTH_KEY = 'EAP_WORD_QUEST_AUTHORITY_V275';
  var LEGACY_AUTH_KEYS = ['EAP_WORD_QUEST_AUTHORITY_V272','EAP_WORD_QUEST_AUTHORITY_V274'];
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var BLOCK_IDS = ['quickStartBtn','weakStartBtn','dailyBtn','speedRunBtn','wordDeckBtn'];
  var state = {
    phase:'unverified',
    ready:false,
    busy:false,
    profile:null,
    resume:null,
    lastError:'',
    verifiedAt:''
  };

  if (window.__EAP_WORD_AUTHORITY_V275__) return;
  window.__EAP_WORD_AUTHORITY_V275__ = true;
  window.__EAP_WORD_AUTHORITY_V274__ = true;
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

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (ignore) {
      return {};
    }
  }

  function nowLabel() {
    try {
      return new Intl.DateTimeFormat('th-TH', {
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }).format(new Date());
    } catch (ignore) {
      return new Date().toLocaleString();
    }
  }

  function jsonp(action, params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var callback = '__eapwqa275_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      var script = document.createElement('script');
      var query = new URLSearchParams();
      var values = params || {};
      var settled = false;
      var timer;

      query.set('action',action);
      query.set('section',GROUP);
      query.set('callback',callback);
      query.set('_',String(Date.now()));
      Object.keys(values).forEach(function (key) {
        query.set(key,values[key]);
      });

      function finish(error,payload) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore2) {}
        if (error) reject(error);
        else resolve(payload || {});
      }

      window[callback] = function (payload) { finish(null,payload); };
      script.onerror = function () { finish(new Error('authority_network_error')); };
      script.src = ENDPOINT + '?' + query.toString();
      timer = setTimeout(function () { finish(new Error('authority_timeout')); },timeoutMs || 15000);
      document.head.appendChild(script);
    });
  }

  function injectStyle() {
    if (byId('eapWordAuthorityStyle275')) return;
    var style = document.createElement('style');
    style.id = 'eapWordAuthorityStyle275';
    style.textContent = [
      '#eapWordAuthorityPanel{margin-top:12px;padding:14px 16px;border:1px solid #cbd5e1;border-radius:15px;background:#f8fafc;color:#334155;line-height:1.5;font-weight:700}',
      '#eapWordAuthorityPanel .eap-auth-title{font-size:16px;font-weight:900;margin-bottom:4px}',
      '#eapWordAuthorityPanel .eap-auth-detail{font-size:14px;font-weight:650;opacity:.96}',
      '#eapWordAuthorityPanel .eap-auth-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:6px 14px;margin-top:8px}',
      '#eapWordAuthorityPanel.unverified{border-color:#fed7aa;background:#fff7ed;color:#9a3412}',
      '#eapWordAuthorityPanel.working{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}',
      '#eapWordAuthorityPanel.verified{border-color:#86efac;background:#ecfdf5;color:#047857;box-shadow:0 6px 18px rgba(4,120,87,.08)}',
      '#eapWordAuthorityPanel.error{border-color:#fecaca;background:#fff1f2;color:#b42318}',
      '#profileStatus.eap-sheet-unverified{color:#9a3412!important;font-weight:800!important}',
      '#profileStatus.eap-sheet-verified{color:#047857!important;font-weight:850!important}',
      'body.eap-word-authority-blocked #sessionGrid{opacity:.58;filter:saturate(.7)}',
      '.eap-authority-locked{opacity:.48!important;filter:grayscale(.35);pointer-events:none!important}',
      '#studentNameInput[readonly],#sectionInput[readonly]{background:#f8fafc!important;color:#475569!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function authorityPanel() {
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

  function setPanel(mode,title,details) {
    var node = authorityPanel();
    var titleNode = document.createElement('div');
    var detailNode = document.createElement('div');
    node.className = mode;
    node.setAttribute('data-authority-state',mode);
    node.innerHTML = '';
    titleNode.className = 'eap-auth-title';
    titleNode.textContent = title;
    detailNode.className = 'eap-auth-detail';
    detailNode.textContent = details || '';
    node.appendChild(titleNode);
    node.appendChild(detailNode);
  }

  function showUnverified(message) {
    state.phase = 'unverified';
    setPanel(
      'unverified',
      'ยังไม่ยืนยันจาก Google Sheet',
      message || 'กรอกรหัสนักศึกษา 10 หลัก แล้วกด “ตรวจสอบรหัสและโหลดความก้าวหน้า” ก่อนเริ่มเล่น'
    );
  }

  function showWorking(message) {
    state.phase = 'working';
    setPanel('working','กำลังตรวจสอบ Google Sheet',message || 'กรุณารอสักครู่');
  }

  function showError(message) {
    state.phase = 'error';
    setPanel('error','ยังยืนยันข้อมูลไม่ได้',message || 'กรุณาลองใหม่');
  }

  function showVerified(resume) {
    var node = authorityPanel();
    var titleNode = document.createElement('div');
    var grid = document.createElement('div');
    var items = [
      ['ชื่อ',state.profile.studentName],
      ['รหัสนักศึกษา',state.profile.studentId],
      ['กลุ่ม',GROUP],
      ['เล่นต่อที่',resume.currentSession === 'DONE' ? 'ผ่านครบทุกด่านแล้ว' : resume.currentSession],
      ['ความก้าวหน้า',Number(resume.progressPercent || 0) + '%'],
      ['โหลดล่าสุด',state.verifiedAt]
    ];

    state.phase = 'verified';
    node.className = 'verified';
    node.setAttribute('data-authority-state','verified');
    node.innerHTML = '';
    titleNode.className = 'eap-auth-title';
    titleNode.textContent = 'ยืนยันจาก Google Sheet แล้ว ✓';
    grid.className = 'eap-auth-grid';
    items.forEach(function (item) {
      var cell = document.createElement('div');
      var strong = document.createElement('strong');
      strong.textContent = item[0] + ': ';
      cell.appendChild(strong);
      cell.appendChild(document.createTextNode(text(item[1])));
      grid.appendChild(cell);
    });
    node.appendChild(titleNode);
    node.appendChild(grid);
  }

  function setLegacyStatus(message,verified) {
    var status = byId('profileStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('eap-sheet-unverified','eap-sheet-verified');
    status.classList.add(verified ? 'eap-sheet-verified' : 'eap-sheet-unverified');
  }

  function configureProfileUi() {
    var name = byId('studentNameInput');
    var section = byId('sectionInput');
    var id = byId('studentIdInput');
    var save = byId('saveProfileBtn');
    var reset = byId('resetProfileBtn');

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
      id.maxLength = 10;
      id.placeholder = 'กรอกรหัสนักศึกษา 10 หลัก';
    }
    if (save) {
      save.textContent = state.ready ? 'โหลดข้อมูลจาก Google Sheet ใหม่' : 'ตรวจสอบรหัสและโหลดความก้าวหน้า';
    }
    if (reset) reset.textContent = 'ออกจากโปรไฟล์';
  }

  function clearUnverifiedLegacyUi() {
    var name = byId('studentNameInput');
    var id = byId('studentIdInput');
    var section = byId('sectionInput');
    if (state.ready || state.busy || state.profile) return;
    if (name) name.value = '';
    if (id && !/^\d{10}$/.test(text(id.value))) id.value = '';
    if (section) section.value = GROUP;
    setLegacyStatus('สถานะ: ยังไม่ยืนยันจาก Google Sheet',false);
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
    [0,250,900,2200,5000,9000].forEach(function (delay) {
      setTimeout(function () {
        configureProfileUi();
        if (!state.ready && !state.busy && !state.profile) clearUnverifiedLegacyUi();
        if (state.ready && state.profile) {
          if (byId('studentNameInput')) byId('studentNameInput').value = state.profile.studentName;
          if (byId('studentIdInput')) byId('studentIdInput').value = state.profile.studentId;
          setLegacyStatus('ยืนยันจาก Google Sheet: ' + state.profile.studentName + ' / ' + state.profile.studentId + ' / Group ' + GROUP,true);
        }
        applySessionLocks();
      },delay);
    });
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
    state.profile = official;
    if (byId('studentNameInput')) byId('studentNameInput').value = official.studentName;
    if (byId('studentIdInput')) byId('studentIdInput').value = official.studentId;
    if (byId('sectionInput')) byId('sectionInput').value = GROUP;
    setLegacyStatus('ยืนยันจาก Google Sheet: ' + official.studentName + ' / ' + official.studentId + ' / Group ' + GROUP,true);
    return official;
  }

  function writeResumeCache(resume) {
    var stats = readJson(STATS_KEY);
    stats.version = VERSION;
    stats.createdAt = stats.createdAt || new Date().toISOString();
    stats.updatedAt = new Date().toISOString();
    stats.sessions = {};
    stats.words = stats.words && typeof stats.words === 'object' ? stats.words : {};
    stats.history = Array.isArray(stats.history) ? stats.history.slice(0,80) : [];
    stats.profileSnapshot = state.profile;
    stats.sheetAuthority = {
      verified:true,
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
    localStorage.setItem(AUTH_KEY,JSON.stringify({
      verified:true,
      version:VERSION,
      studentId:state.profile.studentId,
      resume:resume,
      cachedAt:new Date().toISOString()
    }));
  }

  async function verifyAndResume(studentId,reason) {
    var id = text(studentId).replace(/\s+/g,'');
    var lookup;
    var resume;
    var messages;

    if (!/^\d{10}$/.test(id)) {
      state.ready = false;
      state.profile = null;
      setBlocked(true);
      setLegacyStatus('สถานะ: รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก',false);
      showError('กรุณากรอกรหัสนักศึกษา 10 หลัก ตัวอย่าง 6811500542');
      return;
    }
    if (state.busy) return;

    state.busy = true;
    state.ready = false;
    state.profile = null;
    state.resume = null;
    setBlocked(true);
    configureProfileUi();
    setLegacyStatus('สถานะ: กำลังตรวจสอบกับ Google Sheet…',false);
    showWorking('กำลังค้นหารหัส ' + id + ' ในรายชื่อทางการ Section 122');

    try {
      lookup = await jsonp('eap_word_profile_lookup',{studentId:id});
      if (!lookup.ok || !lookup.official || !lookup.profile) throw new Error(lookup.error || 'student_not_found');
      writeOfficialProfile(lookup.profile);
      showWorking('พบชื่อ ' + lookup.profile.studentName + ' แล้ว กำลังโหลดความก้าวหน้าจาก Sheet');

      resume = await jsonp('eap_word_player_resume',{studentId:id});
      if (!resume.ok || !resume.official) throw new Error(resume.error || 'resume_failed');

      state.resume = resume;
      state.ready = true;
      state.phase = 'verified';
      state.verifiedAt = nowLabel();
      writeResumeCache(resume);
      setBlocked(false);
      configureProfileUi();
      boundedRefresh();
      showVerified(resume);
      window.dispatchEvent(new CustomEvent('eap-word-authority-ready',{
        detail:{profile:state.profile,resume:resume,reason:reason || 'manual',verified:true}
      }));
    } catch (error) {
      state.lastError = String(error && error.message || error);
      state.ready = false;
      state.profile = null;
      state.resume = null;
      localStorage.removeItem(PROFILE_KEY);
      setBlocked(true);
      clearUnverifiedLegacyUi();
      messages = {
        student_not_found:'ไม่พบรหัสนี้ในรายชื่อทางการ Section 122 กรุณาตรวจสอบรหัสนักศึกษา',
        student_inactive:'รหัสนี้ไม่มีสถานะใช้งาน กรุณาติดต่อผู้สอน',
        roster_not_ready:'ยังไม่ได้ติดตั้งรายชื่อทางการใน Google Sheet',
        roster_empty:'Sheet รายชื่อทางการยังไม่มีข้อมูลนักศึกษา',
        authority_timeout:'Google Sheet ตอบกลับช้า กรุณากดลองอีกครั้ง',
        authority_network_error:'เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต'
      };
      showError(messages[state.lastError] || ('ยังเข้าเล่นไม่ได้: ' + state.lastError));
    } finally {
      state.busy = false;
      configureProfileUi();
    }
  }

  function resetAuthority() {
    [PROFILE_KEY,STATS_KEY,AUTH_KEY,'EAP_WORD_QUEST_RECENT_V01','EAP_WORD_QUEST_DAILY_V01'].concat(LEGACY_AUTH_KEYS).forEach(function (key) {
      localStorage.removeItem(key);
    });
    state.phase = 'unverified';
    state.ready = false;
    state.busy = false;
    state.profile = null;
    state.resume = null;
    state.lastError = '';
    state.verifiedAt = '';
    if (byId('studentIdInput')) byId('studentIdInput').value = '';
    if (byId('studentNameInput')) byId('studentNameInput').value = '';
    setBlocked(true);
    clearUnverifiedLegacyUi();
    configureProfileUi();
    boundedRefresh();
    showUnverified('ออกจากโปรไฟล์แล้ว กรุณากรอกรหัสนักศึกษา 10 หลักเพื่อยืนยันใหม่');
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
      if (!state.ready) showUnverified('ต้องเห็นข้อความ “ยืนยันจาก Google Sheet แล้ว ✓” ก่อนจึงจะเริ่มเล่นได้');
      else showError(sessionId + ' ยังไม่ปลดล็อกจากข้อมูลใน Google Sheet');
    }
  }

  function boot() {
    var cached = readJson(PROFILE_KEY);
    injectStyle();
    document.addEventListener('click',captureClicks,true);
    setBlocked(true);

    if (cached.official && cached.authority === 'google_sheet_roster' && /^\d{10}$/.test(text(cached.studentId))) {
      state.profile = cached;
      if (byId('studentIdInput')) byId('studentIdInput').value = cached.studentId;
      if (byId('studentNameInput')) byId('studentNameInput').value = cached.studentName || '';
      configureProfileUi();
      showWorking('กำลังตรวจสอบข้อมูลล่าสุดของ ' + cached.studentName + ' จาก Google Sheet');
      verifyAndResume(cached.studentId,'automatic_resume');
    } else {
      localStorage.removeItem(PROFILE_KEY);
      LEGACY_AUTH_KEYS.forEach(function (key) { localStorage.removeItem(key); });
      clearUnverifiedLegacyUi();
      configureProfileUi();
      boundedRefresh();
      showUnverified();
    }
  }

  window.inspectEapWordAuthorityV275 = function () {
    return {version:VERSION,state:JSON.parse(JSON.stringify(state))};
  };
  window.reloadEapWordAuthorityV275 = function () {
    verifyAndResume(byId('studentIdInput') ? byId('studentIdInput').value : '','manual_reload');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();
