/* =========================================================
 * /english/js/lesson-ui-final-stabilize.js
 * PATCH v20260507-STABILIZE
 *
 * ✅ ล้าง Route/Voice/Student patch ที่ซ้อน
 * ✅ ไม่สร้างแถว S01–S15 ซ้ำในหน้า Home
 * ✅ ใช้ปุ่ม “เลือก S1–S15” เปิด modal แทน
 * ✅ กด session แล้วเข้า S นั้นได้จริงผ่าน URL ?s=...
 * ✅ กู้ student data โดยไม่สร้าง panel ซ้ำ
 * ✅ ใช้ voice picker เดียว ไม่ชนกับตัวเก่า
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-ui-final-stabilize-v20260507';
  const STUDENT_KEY = 'TECHPATH_STUDENT_INFO_V1';
  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';

  const ROUTE = [
    { id: 'S01', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S02', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S03', skill: 'WRITING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S04', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S05', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S06', skill: 'READING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S07', skill: 'WRITING',   icon: '⌨️', type: 'normal', label: 'PLAY' },
    { id: 'S08', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S09', skill: 'SPEAKING',  icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S10', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S11', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S12', skill: 'WRITING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S13', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S14', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S15', skill: 'LISTENING', icon: '🌐', type: 'final',  label: 'FINAL' }
  ];

  let originalFetch = null;
  let originalBeacon = null;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function txt(el) {
    return String(el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function qs(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (e) {
      return d;
    }
  }

  function setI(el, prop, value) {
    if (el && el.style) el.style.setProperty(prop, value, 'important');
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      html, body {
        overflow-x: hidden !important;
        max-width: 100% !important;
      }

      /* ซ่อน patch เก่าที่สร้างซ้ำ */
      #lessonRouteCarouselForce,
      #lessonRouteFloatNav,
      #lessonRouteRebuildShell,
      #lessonRouteHardControls,
      #lessonRouteRebuildControls,
      #lessonFinalRouteClean,
      #lessonFinalVoiceClean,
      #lessonUsVoiceDoctor,
      #lessonAiHelpVoicePicker,
      #lessonAiHelpVoiceBadge,
      #lessonAiHelpVoiceLockBadge,
      #lessonUsVoiceToast,
      #techPathStudentRestore {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      #techPathSessionPicker {
        position: fixed !important;
        inset: 0 !important;
        z-index: 999999 !important;
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 16px !important;
        background: rgba(2,8,18,.72) !important;
        backdrop-filter: blur(10px) !important;
      }

      #techPathSessionPicker.show {
        display: flex !important;
      }

      #techPathSessionPicker .picker-card {
        width: min(920px, calc(100vw - 24px)) !important;
        max-height: calc(100vh - 42px) !important;
        overflow: auto !important;
        border-radius: 26px !important;
        border: 1px solid rgba(120,230,255,.35) !important;
        background:
          radial-gradient(circle at 20% 10%, rgba(104,226,255,.15), transparent 34%),
          linear-gradient(180deg, rgba(18,34,54,.98), rgba(10,20,36,.98)) !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.52) !important;
        padding: 18px !important;
        color: #eaffff !important;
        font-family: system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #techPathSessionPicker .picker-head {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
        margin-bottom: 12px !important;
      }

      #techPathSessionPicker h2 {
        margin: 0 !important;
        font-size: 26px !important;
        line-height: 1.1 !important;
        font-weight: 1000 !important;
      }

      #techPathSessionPicker .close-btn {
        width: 42px !important;
        height: 42px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255,255,255,.18) !important;
        background: rgba(255,255,255,.10) !important;
        color: #eaffff !important;
        font-weight: 1000 !important;
        font-size: 20px !important;
      }

      #techPathSessionPicker .session-grid {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }

      #techPathSessionPicker .session-card {
        min-height: 138px !important;
        border-radius: 22px !important;
        border: 1px solid rgba(196,234,255,.24) !important;
        background:
          radial-gradient(circle at 50% 18%, rgba(121,232,255,.16), transparent 38%),
          linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.07)) !important;
        color: #f1fbff !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 7px !important;
        text-align: center !important;
        cursor: pointer !important;
        touch-action: manipulation !important;
        font-weight: 1000 !important;
      }

      #techPathSessionPicker .session-card.boss {
        border-color: rgba(255,100,145,.52) !important;
      }

      #techPathSessionPicker .session-card.final {
        border-color: rgba(255,215,98,.70) !important;
      }

      #techPathSessionPicker .session-card .icon {
        width: 48px !important;
        height: 48px !important;
        border-radius: 999px !important;
        display: grid !important;
        place-items: center !important;
        background: rgba(4,18,32,.30) !important;
        font-size: 25px !important;
      }

      #techPathSessionPicker .session-card .sid {
        font-size: 20px !important;
        line-height: 1 !important;
      }

      #techPathSessionPicker .session-card .skill {
        font-size: 12px !important;
        opacity: .86 !important;
      }

      #techPathSessionPicker .session-card .badge {
        padding: 5px 10px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.15) !important;
        font-size: 11px !important;
      }

      #techPathVoiceMini {
        position: fixed !important;
        right: 10px !important;
        bottom: 88px !important;
        z-index: 999998 !important;
        width: min(420px, calc(100vw - 20px)) !important;
        border-radius: 16px !important;
        border: 1px solid rgba(105,232,255,.38) !important;
        background: rgba(6,18,34,.96) !important;
        color: #eaffff !important;
        box-shadow: 0 18px 48px rgba(0,0,0,.36) !important;
        overflow: hidden !important;
        font: 800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #techPathVoiceMini summary {
        cursor: pointer !important;
        padding: 10px 12px !important;
        color: #75eeff !important;
        font-weight: 1000 !important;
      }

      #techPathVoiceMini .body {
        padding: 0 12px 12px !important;
      }

      #techPathVoiceMini select {
        width: 100% !important;
        height: 40px !important;
        border-radius: 12px !important;
        border: 1px solid rgba(105,232,255,.32) !important;
        background: #101f32 !important;
        color: #eaffff !important;
        padding: 0 10px !important;
        font-weight: 900 !important;
      }

      #techPathVoiceMini button {
        margin-top: 8px !important;
        width: 100% !important;
        height: 38px !important;
        border: 0 !important;
        border-radius: 999px !important;
        background: #65e8ff !important;
        color: #06202a !important;
        font-weight: 1000 !important;
      }

      @media (max-width: 820px) {
        #techPathSessionPicker .session-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        #techPathVoiceMini {
          left: 10px !important;
          right: 10px !important;
          bottom: 86px !important;
          width: auto !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function removeOldInjectedPanels() {
    const ids = [
      'lessonRouteCarouselForce',
      'lessonRouteFloatNav',
      'lessonRouteRebuildShell',
      'lessonRouteHardControls',
      'lessonRouteRebuildControls',
      'lessonFinalRouteClean',
      'lessonFinalVoiceClean',
      'lessonUsVoiceDoctor',
      'lessonAiHelpVoicePicker',
      'lessonAiHelpVoiceBadge',
      'lessonAiHelpVoiceLockBadge',
      'lessonUsVoiceToast',
      'techPathStudentRestore'
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.remove();
      }
    });

    // ซ่อนเฉพาะ route section ที่เป็นแถว S01-S15 เก่า แต่ห้ามซ่อนข้อมูลผู้เรียน
    Array.from(document.querySelectorAll('section, article, div')).forEach(el => {
      if (!el || el.id === 'techPathSessionPicker' || el.closest('#techPathSessionPicker')) return;

      const t = txt(el);
      const hasRoute = /Mission Route/i.test(t) && /\bS0?1\b/i.test(t) && /\bS0?3\b/i.test(t);
      const hasStudent = /ข้อมูลผู้เรียน|Student ID|Name \/ Nickname/i.test(t);

      if (hasRoute && !hasStudent) {
        setI(el, 'display', 'none');
        setI(el, 'visibility', 'hidden');
        setI(el, 'pointer-events', 'none');
      }
    });
  }

  function readStudentStore() {
    try {
      return JSON.parse(localStorage.getItem(STUDENT_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function writeStudentStore(data) {
    try {
      localStorage.setItem(STUDENT_KEY, JSON.stringify(data || {}));
    } catch (e) {}
  }

  function findInputValue(keys) {
    for (const key of keys) {
      const fromUrl = qs(key, '');
      if (fromUrl) return fromUrl;

      const selectors = [
        `#${key}`,
        `[name="${key}"]`,
        `[data-field="${key}"]`
      ];

      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el && 'value' in el && String(el.value || '').trim()) {
            return String(el.value || '').trim();
          }
        } catch (e) {}
      }
    }

    return '';
  }

  function getStudentData() {
    const saved = readStudentStore();

    const data = {
      studentId:
        findInputValue(['studentId', 'student_id', 'sid', 'pid', 'studentKey']) ||
        saved.studentId ||
        '',

      studentName:
        findInputValue(['studentName', 'student_name', 'name', 'nickName', 'nickname', 'displayName']) ||
        saved.studentName ||
        '',

      classSection:
        findInputValue(['classSection', 'class_section', 'section', 'classRoom', 'class']) ||
        saved.classSection ||
        '',

      sessionCode:
        findInputValue(['sessionCode', 'session_code', 'code', 'roomCode']) ||
        saved.sessionCode ||
        '',

      schoolCode:
        findInputValue(['schoolCode', 'school_code', 'school']) ||
        saved.schoolCode ||
        ''
    };

    return data;
  }

  function syncStudent() {
    const data = getStudentData();
    writeStudentStore(data);

    window.TECHPATH_STUDENT = data;
    window.LESSON_STUDENT = data;
    window.studentId = data.studentId;
    window.studentName = data.studentName;
    window.classSection = data.classSection;
    window.sessionCode = data.sessionCode;

    return data;
  }

  function studentAliases() {
    const d = syncStudent();

    return {
      studentId: d.studentId,
      student_id: d.studentId,
      studentKey: d.studentId,
      pid: d.studentId,

      studentName: d.studentName,
      student_name: d.studentName,
      nickName: d.studentName,
      name: d.studentName,
      displayName: d.studentName,

      classSection: d.classSection,
      class_section: d.classSection,
      section: d.classSection,
      classRoom: d.classSection,

      sessionCode: d.sessionCode,
      session_code: d.sessionCode,

      schoolCode: d.schoolCode,
      school_code: d.schoolCode
    };
  }

  function patchFetchAndBeacon() {
    if (window.fetch && !window.fetch.__techPathStudentPatched) {
      originalFetch = window.fetch.bind(window);

      const patchedFetch = function (input, init) {
        init = init || {};

        try {
          const url = typeof input === 'string' ? input : input && input.url ? input.url : '';
          const should = /script\.google\.com|\/exec|attendance|sheet|api=/i.test(String(url));

          if (!should) return originalFetch(input, init);

          const aliases = studentAliases();

          if (!init.method || String(init.method).toUpperCase() === 'GET') {
            const u = new URL(String(url), location.href);
            Object.entries(aliases).forEach(([k, v]) => {
              if (v && !u.searchParams.get(k)) u.searchParams.set(k, v);
            });

            if (typeof input === 'string') input = u.toString();
            else input = new Request(u.toString(), input);

            return originalFetch(input, init);
          }

          if (init.body instanceof FormData) {
            Object.entries(aliases).forEach(([k, v]) => {
              if (v && !init.body.has(k)) init.body.append(k, v);
            });
          } else if (init.body instanceof URLSearchParams) {
            Object.entries(aliases).forEach(([k, v]) => {
              if (v && !init.body.has(k)) init.body.set(k, v);
            });
          } else if (typeof init.body === 'string') {
            const raw = init.body.trim();

            if (raw.startsWith('{')) {
              const obj = JSON.parse(raw);
              Object.entries(aliases).forEach(([k, v]) => {
                if (v && (obj[k] == null || obj[k] === '')) obj[k] = v;
              });
              init.body = JSON.stringify(obj);
            } else {
              const p = new URLSearchParams(raw);
              Object.entries(aliases).forEach(([k, v]) => {
                if (v && !p.has(k)) p.set(k, v);
              });
              init.body = p.toString();
            }
          }

          return originalFetch(input, init);
        } catch (e) {
          return originalFetch(input, init);
        }
      };

      patchedFetch.__techPathStudentPatched = true;
      window.fetch = patchedFetch;
    }

    if (navigator.sendBeacon && !navigator.sendBeacon.__techPathStudentPatched) {
      originalBeacon = navigator.sendBeacon.bind(navigator);

      const patchedBeacon = function (url, data) {
        try {
          const should = /script\.google\.com|\/exec|attendance|sheet|api=/i.test(String(url));
          if (!should) return originalBeacon(url, data);

          const aliases = studentAliases();
          const u = new URL(String(url), location.href);

          Object.entries(aliases).forEach(([k, v]) => {
            if (v && !u.searchParams.get(k)) u.searchParams.set(k, v);
          });

          return originalBeacon(u.toString(), data);
        } catch (e) {
          return originalBeacon(url, data);
        }
      };

      patchedBeacon.__techPathStudentPatched = true;
      navigator.sendBeacon = patchedBeacon;
    }
  }

  function buildSessionPicker() {
    if (document.getElementById('techPathSessionPicker')) return;

    const modal = document.createElement('div');
    modal.id = 'techPathSessionPicker';

    modal.innerHTML = `
      <div class="picker-card">
        <div class="picker-head">
          <div>
            <h2>เลือก Session S1–S15</h2>
            <div style="opacity:.78;font-weight:900;font-size:13px;margin-top:4px;">
              แตะ Session เพื่อเข้าเรียน / Boss จะอยู่ทุก 3 ด่าน
            </div>
          </div>
          <button class="close-btn" type="button" id="techPathPickerClose">×</button>
        </div>

        <div class="session-grid">
          ${ROUTE.map(item => `
            <button class="session-card ${esc(item.type)}" type="button" data-session="${esc(item.id)}">
              <div class="icon">${esc(item.icon)}</div>
              <div class="sid">${esc(item.id)}</div>
              <div class="skill">${esc(item.skill)}</div>
              <div class="badge">${esc(item.label)}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('techPathPickerClose').addEventListener('click', closePicker);

    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) closePicker();
    });

    modal.querySelectorAll('.session-card').forEach(btn => {
      btn.addEventListener('click', function () {
        goSession(btn.dataset.session || 'S01');
      });
    });
  }

  function openPicker() {
    buildSessionPicker();
    document.getElementById('techPathSessionPicker').classList.add('show');
  }

  function closePicker() {
    const modal = document.getElementById('techPathSessionPicker');
    if (modal) modal.classList.remove('show');
  }

  function goSession(sid) {
    sid = String(sid || 'S01').toUpperCase();
    const n = Number(sid.replace('S', '')) || 1;

    syncStudent();

    const url = new URL(location.href);
    url.searchParams.set('s', String(n));
    url.searchParams.set('session', sid);
    url.searchParams.set('run', qs('run', 'play') || 'play');
    url.searchParams.set('autostart', '1');
    url.searchParams.set('_ts', String(Date.now()));

    location.href = url.toString();
  }

  function tryAutoStart() {
    if (qs('autostart') !== '1') return;

    let tries = 0;

    const timer = setInterval(function () {
      tries += 1;

      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      const startBtn = candidates.find(el => /เริ่ม Session|Start Session|เริ่ม/i.test(txt(el)));

      if (startBtn) {
        clearInterval(timer);

        try {
          const url = new URL(location.href);
          url.searchParams.delete('autostart');
          history.replaceState({}, '', url.toString());
        } catch (e) {}

        startBtn.click();
        return;
      }

      if (tries >= 20) clearInterval(timer);
    }, 300);
  }

  function bindExistingButtons() {
    Array.from(document.querySelectorAll('button, a, [role="button"]')).forEach(btn => {
      if (btn.dataset.techPathPickerBound === '1') return;

      const label = txt(btn);

      if (/เลือก S1|เลือก S1–S15|เลือก S1-S15|Sessions/i.test(label)) {
        btn.dataset.techPathPickerBound = '1';
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          openPicker();
        }, true);
      }
    });
  }

  function getVoices() {
    try {
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    } catch (e) {
      return [];
    }
  }

  function isEnglish(v) {
    return String(v.lang || '').toLowerCase().startsWith('en');
  }

  function isUS(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    return /en-us|united states|google us|us english|samantha|alex/i.test(s);
  }

  function sortVoices(voices) {
    return voices.filter(isEnglish).sort((a, b) => {
      const au = isUS(a) ? 0 : 1;
      const bu = isUS(b) ? 0 : 1;
      if (au !== bu) return au - bu;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function getSelectedVoice() {
    const selected = localStorage.getItem(VOICE_KEY) || localStorage.getItem(OLD_VOICE_KEY) || '';
    const voices = sortVoices(getVoices());

    if (selected) {
      const found = voices.find(v => v.voiceURI === selected || v.name === selected);
      if (found) return found;
    }

    return voices.find(isUS) || voices[0] || null;
  }

  function buildVoiceMini() {
    if (document.getElementById('techPathVoiceMini')) {
      populateVoiceMini();
      return;
    }

    const box = document.createElement('details');
    box.id = 'techPathVoiceMini';

    box.innerHTML = `
      <summary>🔊 เลือกเสียง AI Help</summary>
      <div class="body">
        <select id="techPathVoiceSelect">
          <option value="">Loading voices...</option>
        </select>
        <button type="button" id="techPathVoiceTest">Test Voice</button>
        <div id="techPathVoiceNote" style="font-size:12px;opacity:.78;margin-top:8px;"></div>
      </div>
    `;

    document.body.appendChild(box);

    document.getElementById('techPathVoiceSelect').addEventListener('change', function () {
      localStorage.setItem(VOICE_KEY, this.value);
      localStorage.setItem(OLD_VOICE_KEY, this.value);
      speakAIHelp('Voice selected. I will use this voice for AI Help.');
      populateVoiceMini();
    });

    document.getElementById('techPathVoiceTest').addEventListener('click', function () {
      speakAIHelp('Hello. This is the selected voice for AI Help.');
    });

    populateVoiceMini();
  }

  function populateVoiceMini() {
    const select = document.getElementById('techPathVoiceSelect');
    const note = document.getElementById('techPathVoiceNote');
    if (!select) return;

    const voices = sortVoices(getVoices());
    const selected = getSelectedVoice();

    if (!voices.length) {
      select.innerHTML = '<option value="">No English voice found</option>';
      if (note) note.textContent = 'ยังไม่พบ English voice';
      return;
    }

    select.innerHTML = voices.map(v => {
      const tag = isUS(v) ? '🇺🇸 US • ' : 'EN • ';
      const sel = selected && selected.voiceURI === v.voiceURI ? 'selected' : '';
      return `<option value="${esc(v.voiceURI)}" ${sel}>${esc(tag + v.name + ' (' + v.lang + ')')}</option>`;
    }).join('');

    if (selected) {
      localStorage.setItem(VOICE_KEY, selected.voiceURI);
      localStorage.setItem(OLD_VOICE_KEY, selected.voiceURI);
      if (note) note.innerHTML = `เสียงที่ใช้: <b>${esc(selected.name)}</b> (${esc(selected.lang)})`;
    }
  }

  function speakAIHelp(text, options = {}) {
    const msg = String(text || '').replace(/\s+/g, ' ').trim();
    if (!msg || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;

    const u = new SpeechSynthesisUtterance(msg);
    const voice = getSelectedVoice();

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    } else {
      u.lang = 'en-US';
    }

    u.rate = Number(options.rate || 0.86);
    u.pitch = Number(options.pitch || 1.02);
    u.volume = Number(options.volume || 1);

    try { window.speechSynthesis.cancel(); } catch (e) {}
    window.speechSynthesis.speak(u);

    return true;
  }

  function patchVoiceGlobals() {
    window.speakAIHelpUS = speakAIHelp;

    window.LessonUSVoice = window.LessonUSVoice || {};
    window.LessonUSVoice.speak = speakAIHelp;
    window.LessonUSVoice.getSelectedVoice = getSelectedVoice;

    window.TechPathVoice = {
      speak: speakAIHelp,
      getSelectedVoice,
      open: function () {
        buildVoiceMini();
        document.getElementById('techPathVoiceMini').open = true;
      },
      refresh: populateVoiceMini
    };
  }

  function exposeDebug() {
    window.TechPathStabilize = {
      openPicker,
      goSession,
      student: syncStudent,
      voice: getSelectedVoice,
      debug: function () {
        return {
          patch: PATCH_ID,
          picker: !!document.getElementById('techPathSessionPicker'),
          voice: getSelectedVoice() ? {
            name: getSelectedVoice().name,
            lang: getSelectedVoice().lang
          } : null,
          student: syncStudent(),
          fetchPatched: !!(window.fetch && window.fetch.__techPathStudentPatched),
          beaconPatched: !!(navigator.sendBeacon && navigator.sendBeacon.__techPathStudentPatched)
        };
      }
    };
  }

  function init() {
    injectStyle();
    removeOldInjectedPanels();
    buildSessionPicker();
    bindExistingButtons();
    syncStudent();
    patchFetchAndBeacon();
    buildVoiceMini();
    patchVoiceGlobals();
    exposeDebug();
    tryAutoStart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;
    removeOldInjectedPanels();
    bindExistingButtons();
    syncStudent();
    patchFetchAndBeacon();
    buildVoiceMini();
    patchVoiceGlobals();

    if (tries >= 20) clearInterval(timer);
  }, 500);

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      buildVoiceMini();
      populateVoiceMini();
      patchVoiceGlobals();
    };
  }
})();
