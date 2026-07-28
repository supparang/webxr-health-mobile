/* =========================================================
   EAP Word Quest • Name Search Fallback
   Version: 20260728-EAPWQ-NAME-FALLBACK-V276

   Primary identity path: Student ID -> official roster lookup.
   Fallback path: search official name -> select roster record ->
   use the official Student ID to run the existing V275 resume flow.

   No free-form profile creation is permitted.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260728-EAPWQ-NAME-FALLBACK-V276';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var GROUP = '122';
  var MIN_QUERY = 3;
  var mounted = false;
  var busy = false;

  if (window.__EAP_WORD_NAME_FALLBACK_V276__) return;
  window.__EAP_WORD_NAME_FALLBACK_V276__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function jsonp(action,params,timeoutMs) {
    return new Promise(function (resolve,reject) {
      var callback = '__eapwqn276_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      var script = document.createElement('script');
      var query = new URLSearchParams();
      var settled = false;
      var timer;
      var values = params || {};

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
      script.onerror = function () { finish(new Error('name_lookup_network_error')); };
      script.src = ENDPOINT + '?' + query.toString();
      timer = setTimeout(function () { finish(new Error('name_lookup_timeout')); },timeoutMs || 15000);
      document.head.appendChild(script);
    });
  }

  function injectStyle() {
    if (byId('eapWordNameFallbackStyle276')) return;
    var style = document.createElement('style');
    style.id = 'eapWordNameFallbackStyle276';
    style.textContent = [
      '#profileStatus{display:none!important}',
      '#eapNameLookupBtn{white-space:nowrap}',
      '#eapNameLookupPanel{margin-top:12px;padding:14px;border:1px solid #c7d2fe;border-radius:15px;background:#f8faff;color:#27324a}',
      '#eapNameLookupPanel[hidden]{display:none!important}',
      '#eapNameLookupPanel h4{margin:0 0 5px;font-size:16px;font-weight:900}',
      '#eapNameLookupPanel p{margin:0 0 10px;color:#596780;line-height:1.45}',
      '.eap-name-search-row{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:8px;align-items:center}',
      '.eap-name-search-row input{min-width:0;width:100%;padding:12px 13px;border:1px solid #cbd5e1;border-radius:12px;font:inherit;background:#fff}',
      '.eap-name-search-row button{padding:11px 14px;border-radius:12px;border:1px solid #c7d2fe;background:#fff;color:#3730a3;font:inherit;font-weight:850;cursor:pointer}',
      '.eap-name-search-row button.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}',
      '#eapNameLookupMessage{margin-top:10px;font-weight:750}',
      '#eapNameLookupMessage.error{color:#b42318}',
      '#eapNameLookupMessage.working{color:#1d4ed8}',
      '#eapNameLookupMessage.success{color:#047857}',
      '#eapNameLookupResults{display:grid;gap:8px;margin-top:10px}',
      '.eap-name-result{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:12px 13px;border:1px solid #dbe4ff;border-radius:13px;background:#fff;text-align:left;cursor:pointer;color:#1e293b}',
      '.eap-name-result:hover,.eap-name-result:focus{border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.13);outline:none}',
      '.eap-name-result strong{display:block;font-size:15px}',
      '.eap-name-result span{color:#64748b;font-size:13px}',
      '.eap-name-result em{font-style:normal;color:#3730a3;font-weight:850;white-space:nowrap}',
      '.eap-name-help{margin-top:8px;font-size:13px;color:#64748b}',
      '@media(max-width:680px){.eap-name-search-row{grid-template-columns:1fr}.eap-name-search-row button{width:100%}.eap-name-result{align-items:flex-start;flex-direction:column}}'
    ].join('');
    document.head.appendChild(style);
  }

  function createButton(actions) {
    var button = byId('eapNameLookupBtn');
    if (button) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'eapNameLookupBtn';
    button.className = 'btn secondary';
    button.textContent = 'จำรหัสไม่ได้? ค้นหาด้วยชื่อ';
    actions.appendChild(button);
    return button;
  }

  function createPanel(host) {
    var panel = byId('eapNameLookupPanel');
    var title;
    var description;
    var row;
    var input;
    var search;
    var close;
    var message;
    var results;
    var help;

    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'eapNameLookupPanel';
    panel.hidden = true;

    title = document.createElement('h4');
    title.textContent = 'ค้นหาชื่อจากรายชื่อทางการ';
    description = document.createElement('p');
    description.textContent = 'พิมพ์ชื่อจริง นามสกุล หรือบางส่วนอย่างน้อย 3 ตัวอักษร แล้วเลือกรายการของตนเอง ระบบจะใช้รหัสนักศึกษาจาก Google Sheet โดยอัตโนมัติ';

    row = document.createElement('div');
    row.className = 'eap-name-search-row';
    input = document.createElement('input');
    input.id = 'eapNameLookupInput';
    input.type = 'search';
    input.autocomplete = 'off';
    input.placeholder = 'ตัวอย่าง รณชัย หรือ ตู้โภค';
    input.setAttribute('aria-label','ค้นหาชื่อนักศึกษาในรายชื่อทางการ');

    search = document.createElement('button');
    search.id = 'eapNameLookupSearchBtn';
    search.type = 'button';
    search.className = 'primary';
    search.textContent = 'ค้นหา';

    close = document.createElement('button');
    close.id = 'eapNameLookupCloseBtn';
    close.type = 'button';
    close.textContent = 'ปิด';

    row.appendChild(input);
    row.appendChild(search);
    row.appendChild(close);

    message = document.createElement('div');
    message.id = 'eapNameLookupMessage';
    message.setAttribute('aria-live','polite');

    results = document.createElement('div');
    results.id = 'eapNameLookupResults';

    help = document.createElement('div');
    help.className = 'eap-name-help';
    help.textContent = 'ไม่พบชื่อในรายการ = ยังไม่สามารถสร้างโปรไฟล์เองได้ กรุณาติดต่อผู้สอนเพื่อตรวจสอบ roster';

    panel.appendChild(title);
    panel.appendChild(description);
    panel.appendChild(row);
    panel.appendChild(message);
    panel.appendChild(results);
    panel.appendChild(help);
    host.appendChild(panel);
    return panel;
  }

  function setMessage(message,mode) {
    var node = byId('eapNameLookupMessage');
    if (!node) return;
    node.className = mode || '';
    node.textContent = message || '';
  }

  function clearResults() {
    var node = byId('eapNameLookupResults');
    if (node) node.innerHTML = '';
  }

  function togglePanel(open) {
    var panel = byId('eapNameLookupPanel');
    var input = byId('eapNameLookupInput');
    if (!panel) return;
    panel.hidden = !open;
    if (open) {
      setMessage('ค้นจาก eap_word_roster • Section 122 เท่านั้น','');
      clearResults();
      setTimeout(function () { if (input) input.focus(); },0);
    }
  }

  function selectMatch(match) {
    var idInput = byId('studentIdInput');
    var nameInput = byId('studentNameInput');
    if (!match || !text(match.studentId)) return;

    if (idInput) idInput.value = text(match.studentId);
    if (nameInput) nameInput.value = text(match.studentName);
    setMessage('เลือกรายชื่อแล้ว กำลังยืนยันรหัสและโหลดความก้าวหน้าจาก Google Sheet…','success');
    togglePanel(false);

    setTimeout(function () {
      if (typeof window.reloadEapWordAuthorityV275 === 'function') {
        window.reloadEapWordAuthorityV275();
      } else {
        var save = byId('saveProfileBtn');
        if (save) save.click();
      }
    },80);
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
      button.addEventListener('click',function () { selectMatch(match); });
      host.appendChild(button);
    });
  }

  async function searchName() {
    var input = byId('eapNameLookupInput');
    var query = text(input ? input.value : '');
    var response;

    if (busy) return;
    if (query.replace(/\s+/g,'').length < MIN_QUERY) {
      clearResults();
      setMessage('กรุณาพิมพ์ชื่อหรือนามสกุลอย่างน้อย 3 ตัวอักษร','error');
      return;
    }

    busy = true;
    clearResults();
    setMessage('กำลังค้นหา “' + query + '” จาก Official Roster…','working');

    try {
      response = await jsonp('eap_word_name_lookup',{name:query});
      if (!response.ok) throw new Error(response.error || 'name_lookup_failed');
      if (!response.matches || !response.matches.length) {
        setMessage('ไม่พบชื่อที่ตรงกันใน eap_word_roster กรุณาตรวจการสะกดหรือติดต่อผู้สอน','error');
        return;
      }
      renderMatches(response.matches);
      setMessage('พบ ' + response.matches.length + ' รายการ กรุณาเลือกชื่อของตนเอง','success');
    } catch (error) {
      var code = text(error && error.message || error);
      var messages = {
        name_query_too_short:'กรุณาพิมพ์ชื่ออย่างน้อย 3 ตัวอักษร',
        roster_not_ready:'ยังไม่พบชีต eap_word_roster',
        roster_empty:'ชีต eap_word_roster ยังไม่มีรายชื่อ',
        name_lookup_timeout:'Google Sheet ตอบกลับช้า กรุณาลองใหม่',
        name_lookup_network_error:'เชื่อมต่อระบบค้นหาชื่อไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต'
      };
      setMessage(messages[code] || ('ค้นหาชื่อไม่สำเร็จ: ' + code),'error');
    } finally {
      busy = false;
    }
  }

  function bindEvents() {
    var toggle = byId('eapNameLookupBtn');
    var search = byId('eapNameLookupSearchBtn');
    var close = byId('eapNameLookupCloseBtn');
    var input = byId('eapNameLookupInput');

    if (toggle && !toggle.dataset.bound276) {
      toggle.dataset.bound276 = '1';
      toggle.addEventListener('click',function () {
        var panel = byId('eapNameLookupPanel');
        togglePanel(!panel || panel.hidden);
      });
    }
    if (search && !search.dataset.bound276) {
      search.dataset.bound276 = '1';
      search.addEventListener('click',searchName);
    }
    if (close && !close.dataset.bound276) {
      close.dataset.bound276 = '1';
      close.addEventListener('click',function () { togglePanel(false); });
    }
    if (input && !input.dataset.bound276) {
      input.dataset.bound276 = '1';
      input.addEventListener('keydown',function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          searchName();
        }
      });
    }
  }

  function mount() {
    var actions = document.querySelector('.profile-actions');
    var host;
    if (!actions) return false;
    injectStyle();
    createButton(actions);
    host = actions.parentElement || actions;
    createPanel(host);
    bindEvents();
    mounted = true;
    return true;
  }

  function boot() {
    [0,200,700,1800,4000,8000].forEach(function (delay) {
      setTimeout(function () {
        if (!mounted) mount();
        else bindEvents();
      },delay);
    });
  }

  window.inspectEapWordNameFallbackV276 = function () {
    return {version:VERSION,mounted:mounted,busy:busy};
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else setTimeout(boot,0);
})();
