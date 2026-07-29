/* =========================================================
   EAP Word Quest • Compact JSONP Submit + Receipt
   Version: 20260729-EAPWQ-V280-COMPACT-SUBMIT

   - Sends only essential scalar fields (no JSON payload blob)
   - Allows Apps Script cold starts up to 60 seconds
   - Retries once after a timeout/network failure
   - Keeps Next/Home locked until Player Resume confirms the row
   - No iframe, MutationObserver, or continuous polling
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-EAPWQ-V280-COMPACT-SUBMIT';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var GROUP = '122';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var pending = false;
  var confirmedFingerprint = '';
  var lastRecord = null;
  var lastReceipt = null;

  if (window.__EAP_WORD_V280_COMPACT_SUBMIT__) return;
  window.__EAP_WORD_V280_COMPACT_SUBMIT__ = true;
  window.__EAP_WORD_V279_JSONP_RECEIPT__ = true;
  window.__EAP_WORD_V277_SHEET_CONFIRMED_PROGRESS__ = true;
  window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function num(value,fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function truthy(value) {
    return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
  }

  function officialProfile() {
    var profile = null;
    try {
      if (typeof window.getEapWordOfficialProfileV278 === 'function') {
        profile = window.getEapWordOfficialProfileV278();
      }
    } catch (ignore) {}
    if (!profile || profile.official !== true || profile.authority !== 'google_sheet_roster') return null;
    if (!/^\d{10}$/.test(text(profile.studentId)) || !text(profile.studentName)) return null;
    return {
      studentId:text(profile.studentId),
      studentName:text(profile.studentName),
      section:GROUP
    };
  }

  function currentRecord() {
    var state = window.EAP_V172_SUMMARY_STATE;
    var result = state && state.result;
    var profile = officialProfile();
    var sessionId;
    var correct;
    var total;
    var accuracy;
    var threshold;
    var playedAt;
    var fingerprint;
    if (!result || !profile) return null;
    sessionId = text(result.id || result.sessionId).toUpperCase();
    if (FLOW.indexOf(sessionId) < 0) return null;
    correct = Math.max(0,Math.round(num(result.correct,0)));
    total = Math.max(1,Math.round(num(result.total || result.questions,correct || 1)));
    accuracy = Math.max(0,Math.min(100,Math.round(num(result.accuracy,(correct / total) * 100))));
    threshold = sessionId === 'BG5' ? 75 : (/^BG/.test(sessionId) ? 70 : 60);
    playedAt = text(state.renderedAt || result.playedAt || new Date().toISOString());
    fingerprint = [GROUP,profile.studentId,profile.studentName,sessionId,correct,total,accuracy,playedAt.slice(0,19)].join('|');
    return {
      studentId:profile.studentId,
      studentName:profile.studentName,
      section:GROUP,
      group:GROUP,
      sessionId:sessionId,
      sessionTitle:text(result.title || result.sessionTitle || sessionId),
      sessionType:text(result.sessionType || (/^BG/.test(sessionId) ? 'boss' : 'session')),
      correct:correct,
      total:total,
      accuracy:accuracy,
      xp:Math.max(0,Math.round(num(result.xp,result.score))),
      score:Math.max(0,Math.round(num(result.score,result.xp))),
      maxCombo:Math.max(0,Math.round(num(result.maxCombo || result.combo,0))),
      passed:truthy(result.passed) || accuracy >= threshold,
      passThreshold:threshold,
      playedAt:playedAt,
      fingerprint:fingerprint,
      weakWords:Array.isArray(result.weakWords) ? result.weakWords.slice(0,12).join('|') : text(result.weakWords || ''),
      source:'v280-compact-jsonp',
      schemaVersion:VERSION
    };
  }

  function summaryActive() {
    var node = document.getElementById('summaryScreen');
    return Boolean(node && node.classList.contains('active'));
  }

  function statusBox() {
    var node = document.getElementById('eapWordExactSummaryStatus');
    var card;
    var actions;
    if (node) return node;
    card = document.querySelector('#summaryScreen .summary-card');
    if (!card) return null;
    node = document.createElement('section');
    node.id = 'eapWordExactSummaryStatus';
    node.setAttribute('aria-live','polite');
    node.style.cssText = 'display:none;margin:12px 0;padding:13px 16px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#174ea6;font-weight:850;line-height:1.5';
    actions = card.querySelector('.summary-actions');
    if (actions) actions.before(node); else card.appendChild(node);
    return node;
  }

  function lockNavigation(locked) {
    ['nextMissionBtn','homeBtn'].forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) return;
      button.disabled = Boolean(locked);
      button.setAttribute('aria-disabled',locked ? 'true' : 'false');
      button.style.opacity = locked ? '.48' : '';
      button.style.cursor = locked ? 'not-allowed' : '';
    });
  }

  function show(message,mode,retry) {
    var node;
    var palette = {
      working:['#eff6ff','#174ea6','#bfdbfe'],
      success:['#ecfdf5','#047857','#86efac'],
      warning:['#fff7ed','#b45309','#fed7aa'],
      error:['#fff1f2','#b42318','#fecdd3']
    };
    var colors = palette[mode] || palette.working;
    var button;
    if (!summaryActive()) return;
    node = statusBox();
    if (!node) return;
    node.style.display = 'block';
    node.style.background = colors[0];
    node.style.color = colors[1];
    node.style.borderColor = colors[2];
    node.textContent = message;
    if (retry) {
      button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'ส่งผลและตรวจสอบอีกครั้ง';
      button.style.cssText = 'margin-left:10px;border:1px solid currentColor;border-radius:9px;background:transparent;color:inherit;padding:6px 10px;font-weight:900;cursor:pointer';
      button.addEventListener('click',function () { submitCurrent('manual_retry'); });
      node.appendChild(button);
    }
  }

  function jsonp(action,params,timeoutMs) {
    return new Promise(function (resolve,reject) {
      var callback = '__eapwq_v280_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
      var script = document.createElement('script');
      var query = new URLSearchParams();
      var settled = false;
      var timer;
      query.set('action',action);
      query.set('section',GROUP);
      query.set('callback',callback);
      query.set('_',String(Date.now()));
      Object.keys(params || {}).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null) query.set(key,String(params[key]));
      });
      function finish(error,payload) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore2) {}
        if (error) reject(error); else resolve(payload || {});
      }
      window[callback] = function (payload) { finish(null,payload); };
      script.onerror = function () { finish(new Error(action + '_network_error')); };
      script.src = ENDPOINT + '?' + query.toString();
      timer = setTimeout(function () { finish(new Error(action + '_timeout')); },timeoutMs || 60000);
      document.head.appendChild(script);
    });
  }

  async function submitWithRetry(record) {
    var error;
    try {
      return await jsonp('eap_word_submit_jsonp',record,60000);
    } catch (firstError) {
      error = firstError;
      await new Promise(function (resolve) { setTimeout(resolve,2200); });
      try {
        return await jsonp('eap_word_submit_jsonp',record,60000);
      } catch (secondError) {
        throw secondError || error;
      }
    }
  }

  function resumeMatches(record,resume) {
    var row = resume && resume.sessions && resume.sessions[record.sessionId];
    if (!resume || !resume.ok || !resume.official || !row || !row.played) return false;
    if (record.passed && !row.passed) return false;
    return num(row.bestAccuracy,0) >= record.accuracy;
  }

  async function confirmResume(record) {
    var delays = [600,1600,3200,6000];
    var i;
    var resume;
    for (i = 0; i < delays.length; i += 1) {
      await new Promise(function (resolve) { setTimeout(resolve,delays[i]); });
      resume = await jsonp('eap_word_player_resume',{studentId:record.studentId},30000);
      if (resumeMatches(record,resume)) return resume;
    }
    return null;
  }

  async function submitCurrent(reason) {
    var record;
    var receipt;
    var resume;
    if (pending || !summaryActive()) return;
    try {
      if (typeof window.syncEapWordOfficialProfileV278 === 'function') window.syncEapWordOfficialProfileV278();
    } catch (ignore) {}
    record = currentRecord();
    if (!record) {
      lockNavigation(true);
      show('ยังส่งผลไม่ได้: Official Profile หรือผลรอบล่าสุดไม่พร้อม','error',true);
      return;
    }
    if (record.fingerprint === confirmedFingerprint) return;
    pending = true;
    lastRecord = record;
    lockNavigation(true);
    show('กำลังส่ง ' + record.sessionId + ' ไป Google Sheet… อาจใช้เวลา 30–60 วินาทีในรอบแรก','working',false);
    try {
      receipt = await submitWithRetry(record);
      lastReceipt = receipt;
      if (!receipt || !receipt.ok) {
        show('Apps Script ปฏิเสธ: ' + text(receipt && (receipt.error || receipt.message) || 'unknown_error'),'error',true);
        return;
      }
      show('Apps Script รับ ' + record.sessionId + ' แล้ว (appended ' + num(receipt.appended,0) + ', duplicate ' + num(receipt.duplicate,0) + ') กำลังตรวจ Resume…','working',false);
      resume = await confirmResume(record);
      if (!resume) {
        show('Apps Script รับผลแล้ว แต่ Resume ยังไม่พบ ' + record.sessionId + ' กรุณากดตรวจสอบอีกครั้ง','warning',true);
        return;
      }
      confirmedFingerprint = record.fingerprint;
      lockNavigation(false);
      show(record.sessionId + ' บันทึกและยืนยันจาก Google Sheet แล้ว ✓ เล่นต่อที่ ' + (resume.currentSession || resume.nextMission || '-') + ' • ความก้าวหน้า ' + num(resume.progressPercent,0) + '%','success',false);
      try {
        if (typeof window.reloadEapWordAuthorityV275 === 'function') window.reloadEapWordAuthorityV275();
      } catch (ignore2) {}
    } catch (error) {
      show('ส่งผลไม่สำเร็จ: ' + text(error && error.message || error) + ' กรุณากดส่งอีกครั้งโดยไม่ต้องเล่นใหม่','error',true);
    } finally {
      pending = false;
    }
  }

  function schedule(reason) {
    [250,900,1800].forEach(function (delay) {
      setTimeout(function () { submitCurrent(reason); },delay);
    });
  }

  window.addEventListener('eap-core-run-finished',function () { schedule('core_finished'); });
  document.addEventListener('visibilitychange',function () {
    if (!document.hidden && summaryActive()) schedule('visible_again');
  });
  window.submitEapWordQuestExactSummaryToSheet = function () { submitCurrent('manual_retry'); };
  window.inspectEapWordQuestExactSummarySubmit = function () {
    return {version:VERSION,record:lastRecord,receipt:lastReceipt,pending:pending,confirmedFingerprint:confirmedFingerprint};
  };
  [700,1700,3200].forEach(function (delay) {
    setTimeout(function () { if (summaryActive()) submitCurrent('boot_summary'); },delay);
  });

  console.info('[EAP Word Quest] V280 compact submit ready',{version:VERSION});
})();
