/* =========================================================
   EAP Word Quest • Sheet-Confirmed Progress Bridge
   Version: 20260728-EAPWQ-V277-SHEET-CONFIRMED-PROGRESS

   Critical rules
   - Google Sheet is the sole authority for official progress.
   - The next/home actions stay locked until Player Resume confirms
     that the just-finished session exists in Google Sheet.
   - No MutationObserver, no continuous polling, no reload loop.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260728-EAPWQ-V277-SHEET-CONFIRMED-PROGRESS';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var GROUP = '122';
  var PROFILE_KEY = 'EAP_WORD_QUEST_PROFILE_V01';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var NAV_IDS = ['nextMissionBtn','homeBtn'];
  var pending = new Set();
  var confirmed = new Set();
  var lastToken = '';

  if (window.__EAP_WORD_V277_SHEET_CONFIRMED_PROGRESS__) return;
  window.__EAP_WORD_V277_SHEET_CONFIRMED_PROGRESS__ = true;
  window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function numberValue(value,fallback) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : (fallback == null ? 0 : fallback);
  }

  function truthy(value) {
    return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
  }

  function asList(value) {
    if (Array.isArray(value)) return value.map(text).filter(Boolean);
    if (typeof value === 'string') return value.split(/[|,;]/).map(text).filter(Boolean);
    return [];
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (ignore) { return {}; }
  }

  function readOfficialProfile() {
    var saved = readJson(PROFILE_KEY);
    var nameInput = document.getElementById('studentNameInput');
    var idInput = document.getElementById('studentIdInput');
    var id = text((idInput && idInput.value) || saved.studentId || saved.id || '');
    var name = text((nameInput && nameInput.value) || saved.studentName || saved.name || '');
    var official = saved.official === true && saved.authority === 'google_sheet_roster';

    if (!official || !/^\d{10}$/.test(id) || !name) return null;
    return {
      studentId:id,
      studentName:name,
      section:GROUP,
      official:true,
      authority:'google_sheet_roster'
    };
  }

  function passThreshold(sessionId) {
    if (sessionId === 'BG5') return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function exactSummaryRecord() {
    var state = window.EAP_V172_SUMMARY_STATE;
    var result = state && state.result;
    var profile;
    var sessionId;
    var correct;
    var total;
    var accuracy;
    var playedAt;
    var threshold;
    var record;

    if (!result) return null;
    sessionId = text(result.id || result.sessionId).toUpperCase();
    if (FLOW.indexOf(sessionId) < 0) return null;

    profile = readOfficialProfile();
    if (!profile) return {error:'official_profile_required'};

    correct = Math.max(0,Math.round(numberValue(result.correct,0)));
    total = Math.max(1,Math.round(numberValue(result.total || result.questions,correct || 1)));
    accuracy = Math.max(0,Math.min(100,Math.round(numberValue(result.accuracy,(correct / total) * 100))));
    playedAt = text(state.renderedAt || result.playedAt || new Date().toISOString());
    threshold = passThreshold(sessionId);

    record = {
      source:'v277-sheet-confirmed-summary',
      course:'EAP',
      game:'EAP Word Quest',
      group:GROUP,
      section:GROUP,
      studentName:profile.studentName,
      studentId:profile.studentId,
      arcId:text(result.arcId),
      arc:text(result.arc),
      sessionId:sessionId,
      sessionTitle:text(result.title || result.sessionTitle || sessionId),
      sessionType:text(result.sessionType || (/^BG/.test(sessionId) ? 'boss' : 'session')),
      correct:correct,
      total:total,
      accuracy:accuracy,
      xp:Math.max(0,Math.round(numberValue(result.xp,result.score))),
      score:Math.max(0,Math.round(numberValue(result.score,result.xp))),
      maxCombo:Math.max(0,Math.round(numberValue(result.maxCombo || result.combo,0))),
      passed:truthy(result.passed) || accuracy >= threshold,
      passThreshold:threshold,
      passStatus:text(result.passStatus),
      cefrLevel:text(result.cefrLevel || result.level),
      aiDifficulty:text(result.aiDifficulty),
      aiPrediction:text(result.aiPrediction),
      hintUsed:Math.max(0,Math.round(numberValue(result.hintUsed || result.hintsUsed,0))),
      weakWords:asList(result.weakWords || result.weak || result.weakWord),
      itemTypeWeak:asList(result.itemTypeWeak),
      levelWeak:asList(result.levelWeak),
      responseTimeAvg:Math.max(0,numberValue(result.responseTimeAvg,0)),
      attempt:Math.max(1,Math.round(numberValue(result.attempt,1))),
      bossHp:Math.max(0,Math.round(numberValue(result.boss && result.boss.hp,0))),
      bossMaxHp:Math.max(0,Math.round(numberValue(result.boss && result.boss.max,0))),
      isBoss:truthy(result.isBoss) || /^BG/.test(sessionId),
      playedAt:playedAt
    };

    record.fingerprint = [
      GROUP,
      record.studentId,
      record.studentName,
      record.sessionId,
      record.correct,
      record.total,
      record.accuracy,
      String(record.playedAt).slice(0,19)
    ].join('|');

    return record;
  }

  function summaryActive() {
    var summary = document.getElementById('summaryScreen');
    return Boolean(summary && summary.classList.contains('active'));
  }

  function statusBox() {
    var node = document.getElementById('eapWordExactSummaryStatus');
    var summary;
    var card;
    var actions;

    if (node) return node;
    summary = document.getElementById('summaryScreen');
    card = summary && summary.querySelector('.summary-card');
    if (!card) return null;

    node = document.createElement('section');
    node.id = 'eapWordExactSummaryStatus';
    node.setAttribute('aria-live','polite');
    node.style.cssText = 'display:none;margin:12px 0;padding:13px 16px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#174ea6;font-weight:850;line-height:1.5';
    actions = card.querySelector('.summary-actions');
    if (actions) actions.before(node); else card.appendChild(node);
    return node;
  }

  function setNavigationLocked(locked) {
    NAV_IDS.forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) return;
      button.disabled = Boolean(locked);
      button.setAttribute('aria-disabled',locked ? 'true' : 'false');
      button.style.opacity = locked ? '.48' : '';
      button.style.cursor = locked ? 'not-allowed' : '';
      if (locked) button.dataset.sheetPending277 = '1';
      else delete button.dataset.sheetPending277;
    });
  }

  function show(message,mode,allowRetry) {
    var node;
    var palette;
    var colors;
    var label;
    var retry;

    if (!summaryActive()) return;
    node = statusBox();
    if (!node) return;
    palette = {
      working:['#eff6ff','#174ea6','#bfdbfe'],
      success:['#ecfdf5','#047857','#86efac'],
      warning:['#fff7ed','#b45309','#fed7aa'],
      error:['#fff1f2','#b42318','#fecdd3']
    };
    colors = palette[mode] || palette.working;
    node.style.display = 'block';
    node.style.background = colors[0];
    node.style.color = colors[1];
    node.style.borderColor = colors[2];
    node.innerHTML = '';

    label = document.createElement('span');
    label.textContent = message;
    node.appendChild(label);

    if (allowRetry) {
      retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'ส่งผลและตรวจสอบอีกครั้ง';
      retry.style.cssText = 'margin-left:10px;border:1px solid currentColor;border-radius:9px;background:transparent;color:inherit;padding:6px 10px;font-weight:900;cursor:pointer';
      retry.addEventListener('click',function () { submitExactSummary('manual_retry'); });
      node.appendChild(retry);
    }
  }

  function post(record) {
    return new Promise(function (resolve) {
      var frameName = 'eapWordV277Post_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      var frame = document.createElement('iframe');
      var form = document.createElement('form');
      var payload = {
        action:'eap_word_attempt',
        schemaVersion:VERSION,
        clientTs:new Date().toISOString(),
        pageUrl:location.href,
        userAgent:navigator.userAgent || '',
        record:record
      };

      frame.name = frameName;
      frame.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:0';
      form.method = 'POST';
      form.action = ENDPOINT;
      form.target = frameName;
      form.style.display = 'none';

      [['action','eap_word_attempt'],['payload',JSON.stringify(payload)]].forEach(function (pair) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = pair[0];
        input.value = pair[1];
        form.appendChild(input);
      });

      document.body.appendChild(frame);
      document.body.appendChild(form);
      try {
        form.submit();
        setTimeout(function () {
          try { form.remove(); frame.remove(); } catch (ignore) {}
          resolve(true);
        },1100);
      } catch (error) {
        try { form.remove(); frame.remove(); } catch (ignore2) {}
        resolve(false);
      }
    });
  }

  function jsonpResume(studentId,timeoutMs) {
    return new Promise(function (resolve,reject) {
      var callback = '__eapwq_v277_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      var script = document.createElement('script');
      var query = new URLSearchParams();
      var settled = false;
      var timer;

      query.set('action','eap_word_player_resume');
      query.set('studentId',studentId);
      query.set('section',GROUP);
      query.set('callback',callback);
      query.set('_',String(Date.now()));

      function finish(error,payload) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore2) {}
        if (error) reject(error); else resolve(payload || {});
      }

      window[callback] = function (payload) { finish(null,payload); };
      script.onerror = function () { finish(new Error('resume_network_error')); };
      script.src = ENDPOINT + '?' + query.toString();
      timer = setTimeout(function () { finish(new Error('resume_timeout')); },timeoutMs || 14000);
      document.head.appendChild(script);
    });
  }

  function timeValue(value) {
    var parsed = new Date(value || 0).getTime();
    return isFinite(parsed) ? parsed : 0;
  }

  function receiptMatches(record,resume) {
    var session = resume && resume.sessions && resume.sessions[record.sessionId];
    var recordTime = timeValue(record.playedAt);
    var sheetTime = timeValue(session && session.lastPlayed);

    if (!resume || !resume.ok || !resume.official || !session || !session.played) return false;
    if (record.passed && !session.passed) return false;
    if (numberValue(session.bestAccuracy,0) < record.accuracy) return false;
    if (recordTime && sheetTime && sheetTime < recordTime - 10000) return false;
    return true;
  }

  async function confirmReceipt(record) {
    var resume = await jsonpResume(record.studentId);
    return receiptMatches(record,resume) ? resume : null;
  }

  function refreshAuthority() {
    try {
      if (typeof window.reloadEapWordAuthorityV275 === 'function') {
        window.reloadEapWordAuthorityV275();
      }
    } catch (error) {
      console.warn('[EAP Word Quest] Authority refresh after receipt failed',error);
    }
  }

  async function submit(record,reason) {
    var key;
    var resume = null;
    var delays = [1300,2600,4500];
    var i;

    if (!record || record.error === 'official_profile_required') {
      setNavigationLocked(true);
      show('ยังส่งผลไม่ได้ เพราะยังไม่ได้ยืนยัน Official Profile จาก Google Sheet','error',false);
      return;
    }

    key = text(record.fingerprint);
    if (!key || confirmed.has(key) || pending.has(key)) return;
    pending.add(key);
    setNavigationLocked(true);
    show('กำลังส่ง ' + record.sessionId + ' และรอ Google Sheet ยืนยันผล…','working',false);

    try {
      if (!(await post(record))) {
        show('ส่งผลรอบล่าสุดไม่สำเร็จ ปุ่มไปต่อยังถูกล็อก','warning',true);
        return;
      }

      for (i = 0; i < delays.length; i += 1) {
        await new Promise(function (resolve) { setTimeout(resolve,delays[i]); });
        try {
          resume = await confirmReceipt(record);
        } catch (error) {
          console.warn('[EAP Word Quest] V277 receipt check failed',error);
          resume = null;
        }
        if (resume) break;
      }

      if (!resume) {
        show('ส่ง ' + record.sessionId + ' แล้ว แต่ Player Resume ยังไม่พบผลใน Google Sheet ปุ่มไปต่อยังถูกล็อก','warning',true);
        return;
      }

      confirmed.add(key);
      setNavigationLocked(false);
      show(record.sessionId + ' บันทึกและยืนยันจาก Google Sheet แล้ว ✓ กำลังอัปเดตความก้าวหน้า…','success',false);
      refreshAuthority();
      window.dispatchEvent(new CustomEvent('eap-word-sheet-confirmed',{
        detail:{version:VERSION,record:record,resume:resume,reason:reason || 'summary_ready'}
      }));
      console.info('[EAP Word Quest] V277 Sheet receipt confirmed',{
        version:VERSION,
        sessionId:record.sessionId,
        studentId:record.studentId,
        currentSession:resume.currentSession,
        progressPercent:resume.progressPercent
      });
    } finally {
      pending.delete(key);
    }
  }

  function submitExactSummary(reason) {
    var record = exactSummaryRecord();
    var token;
    if (!record) return;
    if (record.error) {
      submit(record,reason);
      return;
    }
    token = [record.sessionId,record.playedAt,record.fingerprint].join('|');
    if (reason !== 'manual_retry' && token === lastToken) return;
    lastToken = token;
    submit(record,reason || 'summary_ready');
  }

  function scheduleSubmit(reason) {
    [250,850,1700].forEach(function (delay) {
      setTimeout(function () {
        if (summaryActive()) submitExactSummary(reason);
      },delay);
    });
  }

  window.addEventListener('eap-core-run-finished',function () {
    scheduleSubmit('core_finished');
  });

  document.addEventListener('click',function (event) {
    if (!summaryActive()) return;
    if (event.target && event.target.closest && event.target.closest('#eapWordExactSummaryStatus button')) return;
    setTimeout(function () { submitExactSummary('summary_interaction'); },180);
  },true);

  document.addEventListener('visibilitychange',function () {
    if (!document.hidden && summaryActive()) scheduleSubmit('summary_visible_again');
  });

  window.submitEapWordQuestExactSummaryToSheet = function () { submitExactSummary('manual_retry'); };
  window.inspectEapWordQuestExactSummarySubmit = function () {
    return {
      version:VERSION,
      endpoint:ENDPOINT,
      profile:readOfficialProfile(),
      currentSummaryRecord:exactSummaryRecord(),
      pending:Array.from(pending),
      confirmed:Array.from(confirmed)
    };
  };

  [500,1400,3000].forEach(function (delay) {
    setTimeout(function () {
      if (summaryActive()) submitExactSummary('boot_summary');
    },delay);
  });

  console.info('[EAP Word Quest] V277 Sheet-confirmed progress ready',{version:VERSION});
})();
