// === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
(function(root){
  'use strict';

  function qs(k, d=''){
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_) { return d; }
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function localDateTimeParts(d){
    const x = d || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return {
      date: `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`,
      time: `${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`
    };
  }

  function uid(prefix){
    return [
      prefix,
      Date.now(),
      Math.random().toString(36).slice(2, 8)
    ].join('_');
  }

  const API = qs(
    'api',
    root.HHA_APPS_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbwQbRZrtLpNrAmr3_0al1u6qjdsDKg-oG2JkQsMN-R0KWJrPdqnx-QPftl1i473YWh3Zw/exec'
  );

  const DEFAULT_GAME_VERSION = 'goodjunk-duet-r12';
  const DEFAULT_SCHEMA_VERSION = 'v20260403-HHA-RECEIVER-V4';

  function buildEnvelope(summary){
    const startMs = Number(summary.startAt || Date.now());
    const endMs = Number(summary.endAt || Date.now());
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    const startLocal = localDateTimeParts(startDate);
    const endLocal = localDateTimeParts(endDate);

    const sessionId =
      String(summary.session_id || '').trim() ||
      uid('sess');

    const pid =
      String(summary.pid || 'anon').trim() || 'anon';

    const roomId =
      String(summary.roomId || summary.room_id || '').trim();

    const matchId =
      String(summary.match_id || roomId || '').trim();

    const game =
      String(summary.game || 'goodjunk').trim();

    const zone =
      String(summary.zone || 'nutrition').trim();

    const mode =
      String(summary.mode || 'duet').trim();

    const diff =
      String(summary.diff || 'normal').trim();

    const actualDurationSec =
      Number(summary.durationSec || Math.max(0, Math.round((endMs - startMs) / 1000)));

    const score = Number(summary.score || 0);
    const hits = Number(summary.goodHit || 0);
    const miss = Number(summary.miss || 0);
    const junkHit = Number(summary.junkHit || 0);
    const goodMiss = Number(summary.goodMiss || 0);
    const bestStreak = Number(summary.bestStreak || 0);
    const partnerScore = Number(summary.peerScore || 0);
    const pairScore = Number(summary.pairScore || (score + partnerScore));
    const pairGoal = Number(summary.pairGoal || 0);

    const totalAttempts = hits + junkHit + goodMiss;
    const accuracyPct = totalAttempts > 0
      ? Math.round((hits / totalAttempts) * 10000) / 100
      : 0;

    const sessionRow = {
      session_id: sessionId,
      start_ts: new Date(startMs).toISOString(),
      end_ts: new Date(endMs).toISOString(),
      date_local: startLocal.date,
      time_local: startLocal.time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      pid: pid,
      player_name: String(summary.name || 'Player'),
      game: game,
      game_title: String(summary.game_title || 'GoodJunk Duet'),
      zone: zone,
      mode: mode,
      run: String(summary.run || qs('run', 'play')),
      research_phase: String(summary.research_phase || qs('phase', '')),
      study_id: String(summary.study_id || qs('studyId', '')),
      condition_group: String(summary.condition_group || qs('conditionGroup', '')),
      difficulty: diff,
      session_time_sec_setting: Number(summary.timeSec || qs('time', 90)),
      actual_duration_sec: actualDurationSec,
      view_mode: String(summary.view || qs('view', 'mobile')),
      platform: 'web',
      user_agent: navigator.userAgent || '',
      seed: String(summary.seed || qs('seed', '')),
      deterministic_flag: '1',
      completed: '1',
      quit_reason: String(summary.reason || ''),
      score: score,
      hits: hits,
      miss: miss,
      accuracy_pct: accuracyPct,
      combo_max: bestStreak,
      team_score: pairScore,
      partner_score: partnerScore,
      summary_json: JSON.stringify(summary || {}),
      api_log_enabled: API ? '1' : '0',
      log_endpoint: API,
      sync_status: 'pending',
      offline_cached: '0',
      retry_count: 0,
      room_id: roomId,
      match_id: matchId,
      partner_pid: String(summary.partner_pid || ''),
      app_version: String(summary.app_version || 'herohealth'),
      game_version: String(summary.game_version || DEFAULT_GAME_VERSION),
      schema_version: String(summary.schema_version || DEFAULT_SCHEMA_VERSION)
    };

    const eventBase = {
      session_id: sessionId,
      pid: pid,
      game: game,
      zone: zone,
      mode: mode,
      run: String(summary.run || qs('run', 'play')),
      research_phase: String(summary.research_phase || qs('phase', '')),
      study_id: String(summary.study_id || qs('studyId', '')),
      condition_group: String(summary.condition_group || qs('conditionGroup', '')),
      difficulty: diff,
      view_mode: String(summary.view || qs('view', 'mobile')),
      seed: String(summary.seed || qs('seed', '')),
      room_id: roomId,
      match_id: matchId,
      sync_status: 'pending'
    };

    const startEvent = {
      ...eventBase,
      event_id: uid('evt'),
      event_seq: 1,
      ts_ms: startMs,
      ts_iso: new Date(startMs).toISOString(),
      date_local: startLocal.date,
      time_local: startLocal.time,
      phase: 'session',
      event_type: 'session',
      event_name: 'session_start',
      action: 'start',
      value_num: Number(summary.timeSec || qs('time', 90))
    };

    const endEvent = {
      ...eventBase,
      event_id: uid('evt'),
      event_seq: 2,
      ts_ms: endMs,
      ts_iso: new Date(endMs).toISOString(),
      date_local: endLocal.date,
      time_local: endLocal.time,
      phase: 'session',
      event_type: 'session',
      event_name: 'session_end',
      action: String(summary.reason || 'end'),
      score_delta: score,
      combo: bestStreak,
      value_num: score,
      value_num2: partnerScore,
      meta_json: JSON.stringify({
        goodHit: hits,
        junkHit: junkHit,
        goodMiss: goodMiss,
        miss: miss,
        pairGoal: pairGoal,
        pairScore: pairScore
      })
    };

    return {
      source: 'herohealth',
      schema_version: String(summary.schema_version || DEFAULT_SCHEMA_VERSION),
      action: 'append_rows',
      dry_run: String(qs('dry_run', '0')) === '1',
      room_id: roomId,
      sheets: {
        sessions: [sessionRow],
        events: [startEvent, endEvent]
      }
    };
  }

  async function postSummary(summary){
    if (!API) {
      console.warn('[HHA LOGGER] missing api endpoint');
      return;
    }

    const payload = buildEnvelope(summary);

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const ok = navigator.sendBeacon(API, blob);
        console.log('[HHA LOGGER] sendBeacon', ok, payload);
        if (ok) return;
      }

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors'
      });

      const text = await res.text().catch(() => '');
      console.log('[HHA LOGGER] fetch done', res.status, text);
    } catch (err) {
      console.error('[HHA LOGGER] post failed', err);
    }
  }

  function onEnd(e){
    try{
      const summary = e?.detail || {};
      console.log('[HHA LOGGER] hha:end', summary);
      postSummary(summary);
    }catch(err){
      console.error('[HHA LOGGER] onEnd failed', err);
    }
  }

  root.HHACloudLogger = { postSummary, buildEnvelope };
  root.addEventListener('hha:end', onEnd);
})(window);