/**
 * HeroHealth Analytics Audit R32
 * Safe add-on for Receiver V9/R31: no doGet(e), no doPost(e), no global version override.
 *
 * Run HH_R32_auditAnalytics() after an R40.1 test round.
 * The function creates/refreshes HH_Analytics_Audit and returns a structured summary.
 */

function HH_R32_auditAnalytics() {
  var ss = getHHSpreadsheet_();
  var games = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.games));
  var summaries = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.gameSummary));
  var metrics = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.gameMetrics));
  var events = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.gameEvents));
  var catalog = ['handwash','toothbrush','groups','goodjunk','jumpduck','balance-hold'];
  var report = [];

  catalog.forEach(function(gameId) {
    var resultRows = games.filter(function(row) {
      return normalizeGameId_(HH_R32_pick_(row,['gameId','game','game_id'])) === gameId;
    });
    var summaryRows = summaries.filter(function(row) {
      return normalizeGameId_(HH_R32_pick_(row,['gameId','game','game_id'])) === gameId;
    });
    var metricRows = metrics.filter(function(row) {
      return normalizeGameId_(HH_R32_pick_(row,['gameId','game','game_id'])) === gameId;
    });
    var eventRows = events.filter(function(row) {
      return normalizeGameId_(HH_R32_pick_(row,['gameId','game','game_id'])) === gameId;
    });

    var attempts = {};
    var r40Rows = [];
    var duplicateRows = 0;
    var zeroDurationRows = 0;
    var coreOnlyRows = 0;
    var fullRows = 0;
    var completeness = [];
    var eventNames = {};

    resultRows.forEach(function(row) {
      var payload = HH_R32_payload_(row);
      var game = payload.game || {};
      var eventId = String(HH_R32_pick_(row,['eventId','event_id']) || payload.eventId || '').trim();
      var attemptId = String(game.attemptId || payload.attemptId || game.submissionKey || payload.submissionKey || eventId).trim();
      var key = String(HH_R32_pick_(row,['studentId','student_id']) || payload.studentId || '') + '|' + gameId + '|' + attemptId;
      if (attempts[key]) duplicateRows++;
      attempts[key] = (attempts[key] || 0) + 1;

      var duration = HH_R32_number_(game.durationSec, HH_R32_pick_(row,['durationSec','duration']));
      if (!(duration > 0)) zeroDurationRows++;
      if (game.coreResultOnly === true) coreOnlyRows++;
      if (game.fullAnalyticsSubmitted === true && game.coreResultOnly !== true) fullRows++;
      var complete = HH_R32_number_(game.metricCompletenessPct, '');
      if (complete !== '') completeness.push(Number(complete));
      if (String(game.transportVersion || '').indexOf('R40') >= 0 || String(game.analyticsTransport || '') === 'full-payload-single-submit') r40Rows.push(row);
    });

    eventRows.forEach(function(row) {
      var name = String(HH_R32_pick_(row,['eventName','event','type']) || '').trim();
      if (name) eventNames[name] = (eventNames[name] || 0) + 1;
    });

    var avgCompleteness = completeness.length
      ? Math.round(completeness.reduce(function(a,b){ return a+b; },0) * 100 / completeness.length) / 100
      : '';
    var latestR40 = r40Rows.length ? HH_R32_latest_(r40Rows) : null;
    var latestPayload = latestR40 ? HH_R32_payload_(latestR40) : {};
    var latestGame = latestPayload.game || {};
    var latestStatus = HH_R32_latestStatus_(gameId, latestGame, eventRows, metricRows);

    report.push({
      gameId: gameId,
      resultRows: resultRows.length,
      uniqueAttempts: Object.keys(attempts).length,
      duplicateRows: duplicateRows,
      zeroDurationRows: zeroDurationRows,
      coreOnlyRows: coreOnlyRows,
      fullAnalyticsRows: fullRows,
      summaryRows: summaryRows.length,
      metricRows: metricRows.length,
      eventRows: eventRows.length,
      uniqueEventNames: Object.keys(eventNames).length,
      avgMetricCompletenessPct: avgCompleteness,
      latestR40EventId: latestR40 ? String(HH_R32_pick_(latestR40,['eventId','event_id']) || '') : '',
      latestR40CompletenessPct: latestGame.metricCompletenessPct === undefined ? '' : latestGame.metricCompletenessPct,
      latestR40DurationSec: latestGame.durationSec === undefined ? '' : latestGame.durationSec,
      latestR40CoreOnly: latestGame.coreResultOnly === true,
      latestR40Status: latestStatus
    });
  });

  HH_R32_writeAudit_(ss, report);
  return {
    ok: true,
    version: '20260731-HH-ANALYTICS-AUDIT-R32',
    generatedAt: new Date().toISOString(),
    games: report
  };
}

function HH_R32_auditStudent(studentId) {
  var sid = cleanStudentId_(studentId);
  if (!sid) throw new Error('missing_studentId');
  var ss = getHHSpreadsheet_();
  var games = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.games)).filter(function(row) {
    return cleanStudentId_(HH_R32_pick_(row,['studentId','student_id'])) === sid;
  });
  var summaries = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.gameSummary)).filter(function(row) {
    return cleanStudentId_(HH_R32_pick_(row,['studentId','student_id'])) === sid;
  });
  var metrics = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.gameMetrics)).filter(function(row) {
    return cleanStudentId_(HH_R32_pick_(row,['studentId','student_id'])) === sid;
  });
  var events = HH_R32_rows_(ss.getSheetByName(HH_SHEETS.gameEvents)).filter(function(row) {
    return cleanStudentId_(HH_R32_pick_(row,['studentId','student_id'])) === sid;
  });

  return {
    ok: true,
    studentId: sid,
    resultRows: games.length,
    summaryRows: summaries.length,
    metricRows: metrics.length,
    eventRows: events.length,
    games: games.map(function(row) {
      var payload = HH_R32_payload_(row), game = payload.game || {};
      return {
        eventId: String(HH_R32_pick_(row,['eventId','event_id']) || payload.eventId || ''),
        gameId: normalizeGameId_(HH_R32_pick_(row,['gameId','game']) || game.gameId),
        score: HH_R32_pick_(row,['score']),
        accuracy: HH_R32_pick_(row,['accuracy']),
        completed: HH_R32_pick_(row,['completed']),
        passed: HH_R32_pick_(row,['passed']),
        attemptId: game.attemptId || payload.attemptId || '',
        submissionKey: game.submissionKey || payload.submissionKey || '',
        durationSec: game.durationSec === undefined ? '' : game.durationSec,
        metricCompletenessPct: game.metricCompletenessPct === undefined ? '' : game.metricCompletenessPct,
        coreResultOnly: game.coreResultOnly === true,
        fullAnalyticsSubmitted: game.fullAnalyticsSubmitted === true,
        transportVersion: game.transportVersion || ''
      };
    })
  };
}

function HH_R32_latestStatus_(gameId, game, eventRows, metricRows) {
  if (!game || !Object.keys(game).length) return 'NO_R40_TEST';
  var issues = [];
  if (game.coreResultOnly === true) issues.push('CORE_ONLY');
  if (game.fullAnalyticsSubmitted !== true) issues.push('FULL_NOT_MARKED');
  if (!(Number(game.durationSec) > 0)) issues.push('DURATION_MISSING');
  if (!(Number(game.metricCompletenessPct) >= 70)) issues.push('COMPLETENESS_LT_70');
  var eventRequired = ['handwash','toothbrush','groups','jumpduck','balance-hold'].indexOf(gameId) >= 0;
  if (eventRequired && !eventRows.length) issues.push('NO_EVENTS');
  if (!metricRows.length) issues.push('NO_METRICS');
  return issues.length ? 'CHECK:' + issues.join('|') : 'READY_R40';
}

function HH_R32_writeAudit_(ss, rows) {
  var name = 'HH_Analytics_Audit';
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  var headers = [
    'generatedAt','gameId','resultRows','uniqueAttempts','duplicateRows','zeroDurationRows','coreOnlyRows',
    'fullAnalyticsRows','summaryRows','metricRows','eventRows','uniqueEventNames','avgMetricCompletenessPct',
    'latestR40EventId','latestR40CompletenessPct','latestR40DurationSec','latestR40CoreOnly','latestR40Status'
  ];
  var generatedAt = new Date();
  var values = rows.map(function(row) {
    return [generatedAt,row.gameId,row.resultRows,row.uniqueAttempts,row.duplicateRows,row.zeroDurationRows,row.coreOnlyRows,
      row.fullAnalyticsRows,row.summaryRows,row.metricRows,row.eventRows,row.uniqueEventNames,row.avgMetricCompletenessPct,
      row.latestR40EventId,row.latestR40CompletenessPct,row.latestR40DurationSec,row.latestR40CoreOnly,row.latestR40Status];
  });
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#dff7ff');
  if (values.length) sh.getRange(2,1,values.length,headers.length).setValues(values);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1,headers.length);
}

function HH_R32_rows_(sh) {
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return [];
  var values = sh.getDataRange().getValues();
  var headers = values.shift().map(function(h,i){ return String(h || ('column' + (i+1))).trim(); });
  return values.filter(function(row){ return row.some(function(v){ return v !== '' && v != null; }); }).map(function(row,index) {
    var out = {__rowNumber:index+2};
    headers.forEach(function(h,i){ out[h] = row[i]; });
    return out;
  });
}

function HH_R32_pick_(row, aliases) {
  if (!row) return '';
  var map = {};
  Object.keys(row).forEach(function(key) { map[HH_R32_key_(key)] = row[key]; });
  for (var i=0;i<aliases.length;i++) {
    var key = HH_R32_key_(aliases[i]);
    if (Object.prototype.hasOwnProperty.call(map,key) && map[key] !== '' && map[key] != null) return map[key];
  }
  return '';
}

function HH_R32_key_(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/[\s_\-./\\()\[\]]+/g,'');
}

function HH_R32_payload_(row) {
  var value = HH_R32_pick_(row,['payloadJson','payload','json']);
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); }
  catch (_) { return {}; }
}

function HH_R32_number_(primary, fallback) {
  var value = primary;
  if (value === undefined || value === null || value === '') value = fallback;
  if (value === undefined || value === null || value === '') return '';
  var number = Number(value);
  return isFinite(number) ? number : '';
}

function HH_R32_latest_(rows) {
  if (!rows.length) return null;
  return rows.slice().sort(function(a,b) {
    var ad = new Date(HH_R32_pick_(a,['serverTs','finishedAt','clientTs']) || 0).getTime() || 0;
    var bd = new Date(HH_R32_pick_(b,['serverTs','finishedAt','clientTs']) || 0).getTime() || 0;
    return bd-ad;
  })[0];
}
