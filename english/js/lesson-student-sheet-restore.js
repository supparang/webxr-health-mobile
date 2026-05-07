/* =========================================================
 * /english/js/lesson-student-sheet-restore.js
 * PATCH v20260507-STUDENT-SHEET-RESTORE
 *
 * ✅ กู้ panel ข้อมูลผู้เรียนถ้าถูกซ่อน
 * ✅ ถ้าหา panel เดิมไม่เจอ จะสร้าง panel ใหม่ให้กรอก
 * ✅ เก็บ studentId / name / section / sessionCode ใน localStorage
 * ✅ sync ค่าไปยัง input เดิมของ engine ถ้ามี
 * ✅ patch fetch/sendBeacon ให้แนบข้อมูลผู้เรียนเข้า Google Sheet payload
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-student-sheet-restore-v20260507';
  const STORE_KEY = 'TECHPATH_STUDENT_INFO_V1';

  const FIELD_ALIASES = {
    studentId: [
      'studentId', 'student_id', 'studentID', 'sid', 'Student ID',
      'pid', 'studentKey'
    ],
    studentName: [
      'studentName', 'student_name', 'name', 'nickName', 'nickname',
      'displayName', 'display_name', 'Name / Nickname'
    ],
    classSection: [
      'classSection', 'class_section', 'section', 'classRoom',
      'class', 'room'
    ],
    sessionCode: [
      'sessionCode', 'session_code', 'code', 'roomCode'
    ],
    schoolCode: [
      'schoolCode', 'school_code', 'school'
    ]
  };

  let originalFetch = null;
  let originalSendBeacon = null;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function setI(el, prop, value) {
    if (el && el.style) el.style.setProperty(prop, value, 'important');
  }

  function qs(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (e) {
      return d;
    }
  }

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function writeStore(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data || {}));
    } catch (e) {}
  }

  function firstValue(keys) {
    for (const k of keys) {
      const v = qs(k, '');
      if (v) return v;
    }
    return '';
  }

  function getStudentData() {
    const saved = readStore();

    const data = {
      studentId:
        saved.studentId ||
        firstValue(['studentId', 'student_id', 'sid', 'pid', 'studentKey']) ||
        getInputValue(FIELD_ALIASES.studentId) ||
        '',

      studentName:
        saved.studentName ||
        firstValue(['studentName', 'student_name', 'name', 'nickName', 'displayName']) ||
        getInputValue(FIELD_ALIASES.studentName) ||
        '',

      classSection:
        saved.classSection ||
        firstValue(['classSection', 'class_section', 'section', 'classRoom', 'class']) ||
        getInputValue(FIELD_ALIASES.classSection) ||
        '',

      sessionCode:
        saved.sessionCode ||
        firstValue(['sessionCode', 'session_code', 'code', 'roomCode']) ||
        getInputValue(FIELD_ALIASES.sessionCode) ||
        '',

      schoolCode:
        saved.schoolCode ||
        firstValue(['schoolCode', 'school_code', 'school']) ||
        getInputValue(FIELD_ALIASES.schoolCode) ||
        ''
    };

    // fallback ให้ pid/name เดิมของหน้า
    if (!data.studentId && qs('pid')) data.studentId = qs('pid');
    if (!data.studentName && qs('name')) data.studentName = qs('name');

    return data;
  }

  function toPayloadAliases(data) {
    return {
      studentId: data.studentId,
      student_id: data.studentId,
      studentID: data.studentId,
      studentKey: data.studentId,
      pid: data.studentId,

      studentName: data.studentName,
      student_name: data.studentName,
      nickName: data.studentName,
      displayName: data.studentName,
      display_name: data.studentName,
      name: data.studentName,

      classSection: data.classSection,
      class_section: data.classSection,
      section: data.classSection,
      classRoom: data.classSection,

      sessionCode: data.sessionCode,
      session_code: data.sessionCode,

      schoolCode: data.schoolCode,
      school_code: data.schoolCode
    };
  }

  function getInputValue(names) {
    for (const name of names) {
      const selectors = [
        `#${cssEscape(name)}`,
        `[name="${cssEscape(name)}"]`,
        `[data-field="${cssEscape(name)}"]`
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

  function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(s));
    }
    return String(s).replace(/["\\]/g, '\\$&');
  }

  function setInputValue(names, value) {
    if (value == null || value === '') return;

    names.forEach(function (name) {
      const selectors = [
        `#${cssEscape(name)}`,
        `[name="${cssEscape(name)}"]`,
        `[data-field="${cssEscape(name)}"]`
      ];

      selectors.forEach(function (sel) {
        try {
          const el = document.querySelector(sel);
          if (el && 'value' in el) {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } catch (e) {}
      });
    });
  }

  function saveFromPanel() {
    const data = {
      studentId: document.getElementById('tpsrStudentId')?.value.trim() || '',
      studentName: document.getElementById('tpsrStudentName')?.value.trim() || '',
      classSection: document.getElementById('tpsrClassSection')?.value.trim() || '',
      sessionCode: document.getElementById('tpsrSessionCode')?.value.trim() || '',
      schoolCode: document.getElementById('tpsrSchoolCode')?.value.trim() || ''
    };

    writeStore(data);
    syncToEngineInputs(data);
    updateStatus();

    window.dispatchEvent(new CustomEvent('techpath:student-info-updated', {
      detail: data
    }));

    return data;
  }

  function syncToEngineInputs(data) {
    setInputValue(FIELD_ALIASES.studentId, data.studentId);
    setInputValue(FIELD_ALIASES.studentName, data.studentName);
    setInputValue(FIELD_ALIASES.classSection, data.classSection);
    setInputValue(FIELD_ALIASES.sessionCode, data.sessionCode);
    setInputValue(FIELD_ALIASES.schoolCode, data.schoolCode);

    window.TECHPATH_STUDENT = data;
    window.LESSON_STUDENT = data;

    window.studentId = data.studentId;
    window.studentName = data.studentName;
    window.classSection = data.classSection;
    window.sessionCode = data.sessionCode;
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      #techPathStudentRestore {
        width: 100% !important;
        max-width: 100% !important;
        margin: 18px 0 92px !important;
        padding: 18px !important;
        box-sizing: border-box !important;
        border-radius: 28px !important;
        border: 1px solid rgba(180,224,255,.22) !important;
        background:
          radial-gradient(circle at 10% 10%, rgba(104,226,255,.14), transparent 34%),
          linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06)) !important;
        color: #f0fbff !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 18px 52px rgba(0,0,0,.22) !important;
        position: relative !important;
        z-index: 8800 !important;
      }

      #techPathStudentRestore h2 {
        margin: 0 0 6px !important;
        font: 1000 26px/1.15 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #techPathStudentRestore .sub {
        margin: 0 0 14px !important;
        color: rgba(220,238,255,.82) !important;
        font: 900 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #techPathStudentRestore .grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 12px !important;
      }

      #techPathStudentRestore label {
        display: block !important;
        color: rgba(224,242,255,.86) !important;
        font: 900 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif !important;
        margin-bottom: 6px !important;
      }

      #techPathStudentRestore input {
        width: 100% !important;
        min-height: 46px !important;
        box-sizing: border-box !important;
        border-radius: 14px !important;
        border: 1px solid rgba(180,224,255,.28) !important;
        background: rgba(255,255,255,.10) !important;
        color: #f4fbff !important;
        padding: 0 12px !important;
        font: 900 15px/1 system-ui,-apple-system,Segoe UI,sans-serif !important;
        outline: none !important;
      }

      #techPathStudentRestore input::placeholder {
        color: rgba(220,238,255,.45) !important;
      }

      #techPathStudentRestore .actions {
        display: flex !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
        margin-top: 14px !important;
        align-items: center !important;
      }

      #techPathStudentRestore button {
        min-height: 42px !important;
        border: 0 !important;
        border-radius: 999px !important;
        padding: 0 18px !important;
        background: #65e8ff !important;
        color: #06202a !important;
        font: 1000 14px/1 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #techPathStudentRestore .ghost {
        background: rgba(255,255,255,.12) !important;
        color: #eaffff !important;
        border: 1px solid rgba(105,232,255,.34) !important;
      }

      #techPathStudentRestore .status {
        color: rgba(220,238,255,.82) !important;
        font: 900 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      @media (max-width: 820px) {
        #techPathStudentRestore {
          width: calc(100vw - 20px) !important;
          max-width: calc(100vw - 20px) !important;
          margin-left: auto !important;
          margin-right: auto !important;
          padding: 14px !important;
        }

        #techPathStudentRestore .grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function revealExistingStudentPanel() {
    const candidates = Array.from(document.querySelectorAll('section, article, div, form'))
      .filter(function (el) {
        const t = String(el.textContent || '');
        return (
          /ข้อมูลผู้เรียน/i.test(t) ||
          /Student ID/i.test(t) ||
          /Name \/ Nickname/i.test(t)
        );
      });

    candidates.forEach(function (el) {
      if (el.id === 'techPathStudentRestore') return;
      if (el.closest && el.closest('#techPathStudentRestore')) return;

      // เฉพาะส่วนที่ไม่ใช่ route/carousel
      const t = String(el.textContent || '');
      if (/Mission Route/i.test(t) && /S01/i.test(t) && /S15/i.test(t)) return;

      setI(el, 'display', '');
      setI(el, 'visibility', 'visible');
      setI(el, 'opacity', '1');
      setI(el, 'pointer-events', 'auto');

      let p = el.parentElement;
      let guard = 0;

      while (p && p !== document.body && guard < 5) {
        guard += 1;
        setI(p, 'display', '');
        setI(p, 'visibility', 'visible');
        setI(p, 'opacity', '1');
        p = p.parentElement;
      }
    });

    return candidates.length > 0;
  }

  function buildRestorePanel() {
    if (document.getElementById('techPathStudentRestore')) {
      fillPanelFromData();
      return;
    }

    const data = getStudentData();

    const panel = document.createElement('section');
    panel.id = 'techPathStudentRestore';

    panel.innerHTML = `
      <h2>ข้อมูลผู้เรียน</h2>
      <p class="sub">ใส่ข้อมูลก่อนเริ่ม เพื่อให้บันทึกลง Google Sheet ได้ครบ</p>

      <div class="grid">
        <div>
          <label for="tpsrStudentId">Student ID</label>
          <input id="tpsrStudentId" autocomplete="off" placeholder="เช่น 12" value="${esc(data.studentId)}">
        </div>

        <div>
          <label for="tpsrStudentName">Name / Nickname</label>
          <input id="tpsrStudentName" autocomplete="off" placeholder="เช่น KS" value="${esc(data.studentName)}">
        </div>

        <div>
          <label for="tpsrClassSection">Class / Section</label>
          <input id="tpsrClassSection" autocomplete="off" placeholder="เช่น IT-2 / Section A" value="${esc(data.classSection)}">
        </div>

        <div>
          <label for="tpsrSessionCode">Session Code</label>
          <input id="tpsrSessionCode" autocomplete="off" placeholder="รหัสรอบเรียน ถ้ามี" value="${esc(data.sessionCode)}">
        </div>

        <div>
          <label for="tpsrSchoolCode">School Code</label>
          <input id="tpsrSchoolCode" autocomplete="off" placeholder="ถ้ามี" value="${esc(data.schoolCode)}">
        </div>
      </div>

      <div class="actions">
        <button id="tpsrSave" type="button">บันทึกข้อมูลผู้เรียน</button>
        <button id="tpsrFillUrl" class="ghost" type="button">ดึงจาก URL</button>
        <span id="tpsrStatus" class="status"></span>
      </div>
    `;

    const route = document.getElementById('lessonFinalRouteClean');
    const hero = findHero();

    if (route && route.parentElement) {
      route.insertAdjacentElement('afterend', panel);
    } else if (hero && hero.parentElement) {
      hero.insertAdjacentElement('afterend', panel);
    } else {
      document.body.appendChild(panel);
    }

    ['tpsrStudentId', 'tpsrStudentName', 'tpsrClassSection', 'tpsrSessionCode', 'tpsrSchoolCode'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('input', saveFromPanel);
      el.addEventListener('change', saveFromPanel);
    });

    document.getElementById('tpsrSave').addEventListener('click', function () {
      saveFromPanel();
      updateStatus('บันทึกแล้ว และจะส่งเข้า Sheet พร้อม session/event');
    });

    document.getElementById('tpsrFillUrl').addEventListener('click', function () {
      const urlData = {
        studentId: firstValue(['studentId', 'student_id', 'sid', 'pid', 'studentKey']),
        studentName: firstValue(['studentName', 'student_name', 'name', 'nickName', 'displayName']),
        classSection: firstValue(['classSection', 'class_section', 'section', 'classRoom', 'class']),
        sessionCode: firstValue(['sessionCode', 'session_code', 'code', 'roomCode']),
        schoolCode: firstValue(['schoolCode', 'school_code', 'school'])
      };

      setPanelValues(urlData);
      saveFromPanel();
      updateStatus('ดึงข้อมูลจาก URL แล้ว');
    });

    saveFromPanel();
    updateStatus();
  }

  function findHero() {
    const all = Array.from(document.querySelectorAll('section, article, main > div, .card, .panel, .glass, .hero, div'));

    let best = null;
    let bestArea = 0;

    all.forEach(function (el) {
      const t = String(el.textContent || '');
      if (!/future career|CS and AI|problem solving|Hybrid 3D/i.test(t)) return;

      const r = el.getBoundingClientRect();
      const area = r.width * r.height;

      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    });

    return best;
  }

  function setPanelValues(data) {
    if (data.studentId) document.getElementById('tpsrStudentId').value = data.studentId;
    if (data.studentName) document.getElementById('tpsrStudentName').value = data.studentName;
    if (data.classSection) document.getElementById('tpsrClassSection').value = data.classSection;
    if (data.sessionCode) document.getElementById('tpsrSessionCode').value = data.sessionCode;
    if (data.schoolCode) document.getElementById('tpsrSchoolCode').value = data.schoolCode;
  }

  function fillPanelFromData() {
    const data = getStudentData();

    const ids = {
      tpsrStudentId: data.studentId,
      tpsrStudentName: data.studentName,
      tpsrClassSection: data.classSection,
      tpsrSessionCode: data.sessionCode,
      tpsrSchoolCode: data.schoolCode
    };

    Object.entries(ids).forEach(function ([id, value]) {
      const el = document.getElementById(id);
      if (el && !el.value && value) el.value = value;
    });

    updateStatus();
  }

  function updateStatus(msg) {
    const el = document.getElementById('tpsrStatus');
    if (!el) return;

    const data = getStudentData();
    const ok = !!(data.studentId && data.studentName);

    el.innerHTML = msg
      ? esc(msg)
      : ok
        ? 'พร้อมส่งเข้า Google Sheet'
        : 'กรุณาใส่ Student ID และ Name / Nickname';
  }

  function appendStudentToObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const data = getStudentData();
    const aliases = toPayloadAliases(data);

    Object.entries(aliases).forEach(function ([k, v]) {
      if (v && (obj[k] == null || obj[k] === '')) {
        obj[k] = v;
      }
    });

    return obj;
  }

  function shouldPatchUrl(url) {
    const s = String(url || '');
    return (
      /script\.google\.com/i.test(s) ||
      /\/exec/i.test(s) ||
      /api=attendance/i.test(s) ||
      /api=vocab/i.test(s) ||
      /attendance/i.test(s) ||
      /sheet/i.test(s)
    );
  }

  function patchUrlWithStudent(url) {
    try {
      const u = new URL(String(url), location.href);
      const aliases = toPayloadAliases(getStudentData());

      Object.entries(aliases).forEach(function ([k, v]) {
        if (v && !u.searchParams.get(k)) {
          u.searchParams.set(k, v);
        }
      });

      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function patchFetch() {
    if (!window.fetch || window.fetch.__studentRestorePatched) return;

    originalFetch = window.fetch.bind(window);

    const patched = function (input, init) {
      try {
        init = init || {};

        const url = typeof input === 'string'
          ? input
          : input && input.url
            ? input.url
            : '';

        if (!shouldPatchUrl(url)) {
          return originalFetch(input, init);
        }

        const method = String(init.method || '').toUpperCase();

        if (!method || method === 'GET') {
          if (typeof input === 'string') {
            input = patchUrlWithStudent(input);
          } else if (input && input.url) {
            input = new Request(patchUrlWithStudent(input.url), input);
          }

          return originalFetch(input, init);
        }

        if (init.body instanceof FormData) {
          const aliases = toPayloadAliases(getStudentData());

          Object.entries(aliases).forEach(function ([k, v]) {
            if (v && !init.body.has(k)) init.body.append(k, v);
          });

          return originalFetch(input, init);
        }

        if (init.body instanceof URLSearchParams) {
          const aliases = toPayloadAliases(getStudentData());

          Object.entries(aliases).forEach(function ([k, v]) {
            if (v && !init.body.has(k)) init.body.set(k, v);
          });

          return originalFetch(input, init);
        }

        if (typeof init.body === 'string') {
          const raw = init.body.trim();

          if (raw.startsWith('{')) {
            try {
              const obj = JSON.parse(raw);
              appendStudentToObject(obj);
              init.body = JSON.stringify(obj);
            } catch (e) {}
          } else {
            const params = new URLSearchParams(raw);
            const aliases = toPayloadAliases(getStudentData());

            Object.entries(aliases).forEach(function ([k, v]) {
              if (v && !params.has(k)) params.set(k, v);
            });

            init.body = params.toString();
          }
        }

        return originalFetch(input, init);
      } catch (e) {
        return originalFetch(input, init);
      }
    };

    patched.__studentRestorePatched = true;
    window.fetch = patched;
  }

  function patchSendBeacon() {
    if (!navigator.sendBeacon || navigator.sendBeacon.__studentRestorePatched) return;

    originalSendBeacon = navigator.sendBeacon.bind(navigator);

    const patched = function (url, data) {
      try {
        if (!shouldPatchUrl(url)) {
          return originalSendBeacon(url, data);
        }

        url = patchUrlWithStudent(url);

        if (data instanceof FormData) {
          const aliases = toPayloadAliases(getStudentData());

          Object.entries(aliases).forEach(function ([k, v]) {
            if (v && !data.has(k)) data.append(k, v);
          });

          return originalSendBeacon(url, data);
        }

        if (data instanceof URLSearchParams) {
          const aliases = toPayloadAliases(getStudentData());

          Object.entries(aliases).forEach(function ([k, v]) {
            if (v && !data.has(k)) data.set(k, v);
          });

          return originalSendBeacon(url, data);
        }

        if (typeof data === 'string') {
          const raw = data.trim();

          if (raw.startsWith('{')) {
            try {
              const obj = JSON.parse(raw);
              appendStudentToObject(obj);
              data = JSON.stringify(obj);
            } catch (e) {}
          } else {
            const params = new URLSearchParams(raw);
            const aliases = toPayloadAliases(getStudentData());

            Object.entries(aliases).forEach(function ([k, v]) {
              if (v && !params.has(k)) params.set(k, v);
            });

            data = params.toString();
          }
        }

        return originalSendBeacon(url, data);
      } catch (e) {
        return originalSendBeacon(url, data);
      }
    };

    patched.__studentRestorePatched = true;
    navigator.sendBeacon = patched;
  }

  function exposeApi() {
    window.TechPathStudentRestore = {
      get: getStudentData,
      save: function (data) {
        data = Object.assign(getStudentData(), data || {});
        writeStore(data);
        syncToEngineInputs(data);
        fillPanelFromData();
        return data;
      },
      sync: function () {
        const data = getStudentData();
        syncToEngineInputs(data);
        return data;
      },
      clear: function () {
        localStorage.removeItem(STORE_KEY);
        ['tpsrStudentId', 'tpsrStudentName', 'tpsrClassSection', 'tpsrSessionCode', 'tpsrSchoolCode'].forEach(function (id) {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        updateStatus();
      },
      debug: function () {
        const data = getStudentData();
        console.log('[TechPathStudentRestore]', data);
        return {
          patch: PATCH_ID,
          data,
          panel: !!document.getElementById('techPathStudentRestore'),
          fetchPatched: !!(window.fetch && window.fetch.__studentRestorePatched),
          beaconPatched: !!(navigator.sendBeacon && navigator.sendBeacon.__studentRestorePatched)
        };
      }
    };
  }

  function init() {
    injectStyle();
    revealExistingStudentPanel();
    buildRestorePanel();

    const data = getStudentData();
    writeStore(data);
    syncToEngineInputs(data);

    patchFetch();
    patchSendBeacon();
    exposeApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;
    revealExistingStudentPanel();
    buildRestorePanel();
    syncToEngineInputs(getStudentData());
    patchFetch();
    patchSendBeacon();
    exposeApi();

    if (tries >= 20) clearInterval(timer);
  }, 500);
})();
