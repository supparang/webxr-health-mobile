/* =========================================================
   EAP Word Quest • Mobile Name Lookup Retry Patch
   Version: 20260729-EAPWQ-NAME-MOBILE-RETRY-V282

   Purpose
   - Make official roster name search reliable on mobile networks.
   - Retry once on timeout/network failure.
   - Distinguish transport failure from a true "no roster match".
   - Preserve Student ID as the primary identity path.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-EAPWQ-NAME-MOBILE-RETRY-V282';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var GROUP = '122';
  var MIN_QUERY = 3;
  var busy = false;

  if (window.__EAP_WORD_NAME_MOBILE_RETRY_V282__) return;
  window.__EAP_WORD_NAME_MOBILE_RETRY_V282__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setMessage(message, mode) {
    var node = byId('eapNameLookupMessage');
    if (!node) return;
    node.className = mode || '';
    node.textContent = message || '';
  }

  function clearResults() {
    var node = byId('eapNameLookupResults');
    if (node) node.innerHTML = '';
  }

  function setHelp(message, mode) {
    var panel = byId('eapNameLookupPanel');
    var help = panel && panel.querySelector('.eap-name-help');
    if (!help) return;
    help.textContent = message || '';
    help.dataset.mode = mode || '';
    help.style.color = mode === 'error' ? '#b42318' : '#64748b';
  }

  function jsonpOnce(action, params, timeoutMs, attempt) {
    return new Promise(function (resolve, reject) {
      var callback = '__eapwqn282_' + Date.now() + '_' + attempt + '_' + Math.random().toString(36).slice(2, 8);
      var script = document.createElement('script');
      var query = new URLSearchParams();
      var settled = false;
      var timer;
      var values = params || {};

      query.set('action', action);
      query.set('section', GROUP);
      query.set('callback', callback);
      query.set('_', String(Date.now()));
      query.set('attempt', String(attempt));
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
      script.onerror = function () { finish(new Error('name_lookup_network_error')); };
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = ENDPOINT + '?' + query.toString();
      timer = setTimeout(function () { finish(new Error('name_lookup_timeout')); }, timeoutMs || 30000);
      document.head.appendChild(script);
    });
  }

  async function jsonpWithRetry(action, params) {
    var lastError;
    var attempt;
    for (attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await jsonpOnce(action, params, attempt === 1 ? 30000 : 45000, attempt);
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          setMessage('การเชื่อมต่อรอบแรกช้า กำลังลองค้นหาอีกครั้ง…', 'working');
          await new Promise(function (resolve) { setTimeout(resolve, 1200); });
        }
      }
    }
    throw lastError || new Error('name_lookup_failed');
  }

  function selectMatch(match) {
    var idInput = byId('studentIdInput');
    var nameInput = byId('studentNameInput');
    if (!match || !text(match.studentId)) return;
    if (idInput) idInput.value = text(match.studentId);
    if (nameInput) nameInput.value = text(match.studentName);
    setMessage('เลือกรายชื่อแล้ว กำลังยืนยันรหัสและโหลดความก้าวหน้าจาก Google Sheet…', 'success');
    var panel = byId('eapNameLookupPanel');
    if (panel) panel.hidden = true;
    setTimeout(function () {
      if (typeof window.reloadEapWordAuthorityV275 === 'function') window.reloadEapWordAuthorityV275();
      else {
        var save = byId('saveProfileBtn');
        if (save) save.click();
      }
    }, 100);
  }

  function renderMatches(matches) {
    var host = byId('eapNameLookupResults');
    if (!host) return;
    host.innerHTML = '';
    (matches || []).forEach(function (match) {
      var button = document.createElement('button');
      var left = document.createElement('div');
      var name = document.createElement('strong');
      var meta = document.createElement('span');
      var action = document.createElement('em');
      button.type = 'button';
      button.className = 'eap-name-result';
      name.textContent = text(match.studentName);
      meta.textContent = 'รหัส ' + text(match.maskedStudentId || match.studentId) + ' • Group ' + GROUP;
      action.textContent = 'เลือกชื่อนี้';
      left.appendChild(name);
      left.appendChild(meta);
      button.appendChild(left);
      button.appendChild(action);
      button.addEventListener('click', function () { selectMatch(match); });
      host.appendChild(button);
    });
  }

  async function searchName(event) {
    var input = byId('eapNameLookupInput');
    var query = text(input ? input.value : '');
    var response;
    var code;

    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (busy) return;
    if (query.replace(/\s+/g, '').length < MIN_QUERY) {
      clearResults();
      setMessage('กรุณาพิมพ์ชื่อหรือนามสกุลอย่างน้อย 3 ตัวอักษร', 'error');
      setHelp('ยังไม่ได้ส่งคำค้นไป Google Sheet', '');
      return;
    }

    busy = true;
    clearResults();
    setHelp('กำลังตรวจสอบกับ eap_word_roster • Section 122', '');
    setMessage('กำลังค้นหา “' + query + '” จาก Official Roster…', 'working');

    try {
      response = await jsonpWithRetry('eap_word_name_lookup', { name: query });
      if (!response.ok) throw new Error(response.error || 'name_lookup_failed');
      if (!response.matches || !response.matches.length) {
        setMessage('ไม่พบชื่อที่ตรงกันในรายชื่อทางการ กรุณาตรวจการสะกดหรือติดต่อผู้สอน', 'error');
        setHelp('Google Sheet ตอบกลับแล้ว แต่ไม่พบชื่อที่ตรงกับคำค้นนี้', 'error');
        return;
      }
      renderMatches(response.matches);
      setMessage('พบ ' + response.matches.length + ' รายการ กรุณาเลือกชื่อของตนเอง', 'success');
      setHelp('ผลลัพธ์นี้มาจากรายชื่อทางการใน Google Sheet', '');
    } catch (error) {
      code = text(error && error.message || error);
      if (code === 'name_lookup_timeout') {
        setMessage('Google Sheet ตอบกลับช้าบนเครือข่ายมือถือ กรุณากดค้นหาอีกครั้ง หรือใช้รหัสนักศึกษา', 'error');
      } else if (code === 'name_lookup_network_error') {
        setMessage('ยังเชื่อมต่อระบบค้นหาชื่อไม่ได้ กรุณาสลับ Wi‑Fi/5G แล้วกดค้นหาอีกครั้ง หรือใช้รหัสนักศึกษา', 'error');
      } else if (code === 'roster_not_ready') {
        setMessage('ยังไม่พบชีต eap_word_roster กรุณาแจ้งผู้สอน', 'error');
      } else if (code === 'roster_empty') {
        setMessage('ชีต eap_word_roster ยังไม่มีรายชื่อ กรุณาแจ้งผู้สอน', 'error');
      } else {
        setMessage('ค้นหาชื่อไม่สำเร็จ: ' + code, 'error');
      }
      setHelp('ยังไม่ได้รับผลยืนยันจาก Google Sheet จึงยังสรุปไม่ได้ว่า “ไม่พบชื่อ”', 'error');
    } finally {
      busy = false;
    }
  }

  function bindCapture() {
    document.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('#eapNameLookupSearchBtn')) searchName(event);
    }, true);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && event.target && event.target.id === 'eapNameLookupInput') searchName(event);
    }, true);
  }

  bindCapture();
  window.inspectEapWordNameMobileRetryV282 = function () {
    return { version: VERSION, busy: busy, online: navigator.onLine };
  };
  console.info('[EAP Word Quest] mobile name lookup retry ready', { version: VERSION });
})();
