/* =========================================================
   EAP Word Quest • Final Analytics Payload Enricher
   Version: 20260801-EAPWQ-V297-ANALYTICS-PAYLOAD

   Loaded immediately before V280. It preserves the proven V280
   submit/receipt/resume flow and enriches only the JSONP request
   sent to Apps Script.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260801-EAPWQ-V297-ANALYTICS-PAYLOAD';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var roundBaseline = null;
  var lastPayload = null;
  var originalAppendChild;

  if (window.__EAP_WORD_V297_ANALYTICS_PAYLOAD__) return;
  window.__EAP_WORD_V297_ANALYTICS_PAYLOAD__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function num(value,fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function has(object,key) {
    return Boolean(object && Object.prototype.hasOwnProperty.call(object,key));
  }

  function array(value) {
    var parsed;
    if (Array.isArray(value)) return value.map(text).filter(Boolean);
    if (typeof value !== 'string') return [];
    try {
      parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
    } catch (ignore) {}
    return value.split(/[|,;]/).map(text).filter(Boolean);
  }

  function unique(values,limit) {
    var seen = {};
    var out = [];
    (values || []).forEach(function (value) {
      var label = text(value);
      var key = label.toLowerCase();
      if (!label || seen[key]) return;
      seen[key] = true;
      out.push(label);
    });
    return out.slice(0,limit || 12);
  }

  function average(values) {
    var clean = (values || []).map(function (value) { return num(value,NaN); }).filter(function (value) { return isFinite(value) && value > 0; });
    if (!clean.length) return 0;
    return Math.round((clean.reduce(function (sum,value) { return sum + value; },0) / clean.length) * 10) / 10;
  }

  function sessionIdOf(value) {
    return text(value && (value.sessionId || value.session || value.id)).toUpperCase();
  }

  function currentResult() {
    var state = window.EAP_V172_SUMMARY_STATE || {};
    return state.result || window.EAP_V203_LAST_RESULT || window.EAP_V196_LAST_RESULT || window.EAP_V195_LAST_RESULT || null;
  }

  function detectGameSession() {
    var ids = ['gameModeText','gameTitle','questionTags','progressText'];
    var values = [];
    var match;
    ids.forEach(function (id) {
      var node = document.getElementById(id);
      if (node) values.push(node.textContent || '');
    });
    match = values.join(' ').match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/i);
    return match ? match[1].toUpperCase() : '';
  }

  function aiSnapshot() {
    var snapshot = null;
    try {
      if (typeof window.getEapCoreAiState === 'function') snapshot = window.getEapCoreAiState();
    } catch (ignore) {}
    return snapshot && typeof snapshot === 'object' ? snapshot : {};
  }

  function aiMetrics() {
    var snapshot = aiSnapshot();
    return snapshot.metrics && typeof snapshot.metrics === 'object' ? snapshot.metrics : {};
  }

  function captureBaseline(reason) {
    var game = document.getElementById('gameScreen');
    var sessionId;
    var metrics;
    if (!game || !game.classList.contains('active')) return;
    sessionId = detectGameSession();
    if (FLOW.indexOf(sessionId) < 0) return;
    if (roundBaseline && roundBaseline.sessionId === sessionId) return;
    metrics = aiMetrics();
    roundBaseline = {
      sessionId:sessionId,
      hints:Math.max(0,Math.round(num(metrics.hints,0))),
      answers:Math.max(0,Math.round(num(metrics.answers,0))),
      capturedAt:new Date().toISOString(),
      reason:text(reason || 'game_start')
    };
  }

  function resetBaseline() {
    roundBaseline = null;
  }

  function candidates(sessionId,studentId) {
    var list = [
      currentResult(),
      window.EAP_V203_LAST_RESULT,
      window.EAP_V196_LAST_RESULT,
      window.EAP_V195_LAST_RESULT,
      window.EAP_V192_LAST_RESULT,
      window.EAP_LAST_LEARNING_LOG,
      window.EAP_CORE_AI_EVENT
    ];
    var logs = [];
    try {
      if (typeof window.readEapWordQuestLogs === 'function') logs = window.readEapWordQuestLogs() || [];
    } catch (ignore) {}
    logs.filter(function (row) {
      if (sessionIdOf(row) !== sessionId) return false;
      return !studentId || !text(row.studentId) || text(row.studentId) === studentId;
    }).sort(function (a,b) {
      return new Date(b.playedAt || b.updatedAt || b.at || 0).getTime() - new Date(a.playedAt || a.updatedAt || a.at || 0).getTime();
    }).slice(0,5).forEach(function (row) { list.push(row); });
    return list.filter(function (row) {
      return row && typeof row === 'object' && sessionIdOf(row) === sessionId;
    });
  }

  function firstText(rows,keys) {
    var found = '';
    rows.some(function (row) {
      return keys.some(function (key) {
        var value = text(row && row[key]);
        if (!value) return false;
        found = value;
        return true;
      });
    });
    return found;
  }

  function explicitNumber(rows,keys) {
    var result = {found:false,value:0};
    rows.some(function (row) {
      return keys.some(function (key) {
        if (!has(row,key)) return false;
        result = {found:true,value:Math.max(0,num(row[key],0))};
        return true;
      });
    });
    return result;
  }

  function mergedArrays(rows,keys,limit) {
    var out = [];
    rows.forEach(function (row) {
      keys.forEach(function (key) { out = out.concat(array(row && row[key])); });
    });
    return unique(out,limit);
  }

  function fallbackDifficulty(accuracy) {
    if (accuracy >= 90) return 'B1+';
    if (accuracy >= 75) return 'B1';
    if (accuracy >= 60) return 'A2+';
    return 'A2';
  }

  function fallbackPrediction(accuracy) {
    if (accuracy >= 90) return 'Ready for Challenge Mode';
    if (accuracy >= 75) return 'Ready for Main Mission';
    if (accuracy >= 60) return 'Ready, but review recommended';
    return 'At Risk — replay with AI Help';
  }

  function arcInfo(sessionId) {
    var index = FLOW.indexOf(sessionId);
    var arc = index < 0 ? 0 : Math.floor(index / 4) + 1;
    return {arcId:arc ? 'ARC' + arc : '',arc:arc ? 'Arc ' + arc : ''};
  }

  function attemptCount(rows,sessionId) {
    var fingerprints = {};
    var count = 0;
    rows.forEach(function (row) {
      if (sessionIdOf(row) !== sessionId) return;
      var key = text(row.fingerprint) || [sessionId,text(row.correct),text(row.total),text(row.accuracy),text(row.playedAt || row.at)].join('|');
      if (fingerprints[key]) return;
      fingerprints[key] = true;
      count += 1;
    });
    return Math.max(1,count);
  }

  function buildAnalytics(url) {
    var sessionId = text(url.searchParams.get('sessionId')).toUpperCase();
    var studentId = text(url.searchParams.get('studentId'));
    var total = Math.max(1,Math.round(num(url.searchParams.get('total'),1)));
    var accuracy = Math.max(0,Math.min(100,Math.round(num(url.searchParams.get('accuracy'),0))));
    var rows = candidates(sessionId,studentId);
    var snapshot = aiSnapshot();
    var metrics = snapshot.metrics && typeof snapshot.metrics === 'object' ? snapshot.metrics : {};
    var hints = explicitNumber(rows,['hintUsed','hintsUsed']);
    var response = explicitNumber(rows,['responseTimeAvg','averageResponseSeconds','avgResponseTime']);
    var responseTimes = Array.isArray(metrics.responseTimes) ? metrics.responseTimes.slice(-Math.min(total,20)) : [];
    var baselineValid = Boolean(roundBaseline && roundBaseline.sessionId === sessionId);
    var itemTypeWeak = mergedArrays(rows,['itemTypeWeak','itemTypeWeakJson'],12);
    var levelWeak = mergedArrays(rows,['levelWeak','levelWeakJson'],8);
    var difficulty = firstText(rows,['aiDifficulty','difficulty']) || text(snapshot.difficulty) || fallbackDifficulty(accuracy);
    var prediction = firstText(rows,['aiPrediction','prediction']) || text(snapshot.prediction) || fallbackPrediction(accuracy);
    var hintUsed = hints.value;
    var responseTimeAvg = response.value > 0 ? Math.round(response.value * 10) / 10 : average(responseTimes);
    var arc = arcInfo(sessionId);
    var allLogs = [];

    try {
      if (typeof window.readEapWordQuestLogs === 'function') allLogs = window.readEapWordQuestLogs() || [];
    } catch (ignore) {}

    if (!hints.found && baselineValid) hintUsed = Math.max(0,Math.round(num(metrics.hints,0)) - roundBaseline.hints);
    if (!levelWeak.length) {
      if (accuracy < 60) levelWeak = ['A2'];
      else if (accuracy < 75) levelWeak = ['A2+–B1'];
    }

    return {
      aiDifficulty:difficulty,
      aiPrediction:prediction,
      cefrLevel:difficulty,
      hintUsed:Math.max(0,Math.round(hintUsed)),
      itemTypeWeak:itemTypeWeak.join('|'),
      levelWeak:levelWeak.join('|'),
      responseTimeAvg:responseTimeAvg,
      attempt:attemptCount(allLogs,sessionId),
      arcId:arc.arcId,
      arc:arc.arc,
      isBoss:/^BG/.test(sessionId),
      passStatus:accuracy >= num(url.searchParams.get('passThreshold'),60) ? 'Passed' : 'Practice',
      clientTs:new Date().toISOString(),
      pageUrl:location.href,
      userAgent:navigator.userAgent,
      source:'v297-analytics-jsonp',
      schemaVersion:VERSION,
      extraJson:JSON.stringify({
        analyticsVersion:VERSION,
        responseTimeSamples:responseTimes.length,
        responseTimeCoveragePct:Math.round(Math.min(total,responseTimes.length) / total * 100),
        baselineCaptured:baselineValid,
        hintSource:hints.found ? 'result_or_log' : (baselineValid ? 'round_delta' : 'unavailable'),
        responseTimeSource:response.value > 0 ? 'result_or_log' : (responseTimes.length ? 'core_ai_recent' : 'unavailable'),
        itemTypeCoverage:itemTypeWeak.length ? 'observed' : 'not_available'
      })
    };
  }

  function enrichSubmitScript(node) {
    var url;
    var analytics;
    if (!node || String(node.tagName).toUpperCase() !== 'SCRIPT' || !node.src) return;
    try {
      url = new URL(node.src,location.href);
    } catch (ignore) {
      return;
    }
    if (url.searchParams.get('action') !== 'eap_word_submit_jsonp') return;
    if (FLOW.indexOf(text(url.searchParams.get('sessionId')).toUpperCase()) < 0) return;
    analytics = buildAnalytics(url);
    Object.keys(analytics).forEach(function (key) {
      url.searchParams.set(key,String(analytics[key] == null ? '' : analytics[key]));
    });
    node.src = url.toString();
    lastPayload = analytics;
  }

  originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    if (this === document.head) enrichSubmitScript(node);
    return originalAppendChild.call(this,node);
  };

  document.addEventListener('pointerdown',function (event) {
    var target = event.target && event.target.closest ? event.target.closest('#choicesEl button,#choicesEl .choice,#choicesEl [role="button"],#aiHelpBtn') : null;
    if (target) captureBaseline('first_pointer_interaction');
  },true);

  document.addEventListener('keydown',function (event) {
    if (event.key === 'Enter' || event.key === ' ') captureBaseline('first_keyboard_interaction');
  },true);

  document.addEventListener('click',function (event) {
    var target = event.target && event.target.closest ? event.target.closest('#replayBtn,#nextMissionBtn,#quickStartBtn,#weakStartBtn,.session-card button') : null;
    if (target) resetBaseline();
  },true);

  window.inspectEapWordAnalyticsPayloadV297 = function () {
    return {version:VERSION,lastPayload:lastPayload,roundBaseline:roundBaseline};
  };

  console.info('[EAP Word Quest] V297 analytics payload enricher ready',{version:VERSION});
})();