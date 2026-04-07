/* === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
   PATCH: debug-friendly Apps Script logger for GoodJunk
   - force endpoint from window.HHA_APPS_SCRIPT_URL
   - disable sendBeacon during debug
   - verbose console logs
   - guard against duplicate flush
*/
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

  function log(){
    console.log('[HHA LOGGER]', ...arguments);
  }

  function warn(){
    console.warn('[HHA LOGGER]', ...arguments);
  }

  function errlog(){
    console.error('[HHA LOGGER]', ...arguments);
  }

  // DEBUG: do not allow ?api= override for now
  const API = String(root.HHA_APPS_SCRIPT_URL || '').trim();

  const DEFAULT_GAME_VERSION = 'goodjunk-duet-r12';
  const DEFAULT_SCHEMA_VERSION = 'v20260403-HHA-RECEIVER-V4';

  let lastPayload = null;
  let lastResponse = null;
  let flushPromise = null;
  let flushedSessionId = '';

  function buildEnvelope(summary){
    summary = summary || {};

    const startMs = Number(summary.startAt || summary.startedAt || Date.now());
    const endMs = Number(summary.endAt || summary.endedAt || Date.now());
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    const startLocal = localDateTimeParts(startDate);
    const endLocal = localDateTimeParts(endDate);

    const sessionId =
      String(summary.session_id || summary.sessionId || '').trim() ||
      uid('sess');

    const pid =
      String(summary.pid || 'anon').trim() || 'anon';

    const roomId =
      String(summary.roomId || summary.room_id || '').trim();

    const matchId =
      String(summary.matchId || summary.match_id || roomId || '').trim();

    const game =
      String(summary.game || 'goodjunk').trim();

    const zone =
      String(summary.zone || 'nutrition').trim();

    const mode =
      String(summary.mode || 'duet').trim();

    const diff =
      String(summary.diff || summary.difficulty || 'normal').trim();

    const actualDurationSec =
      Number(summary.durationSec || Math.max(0, Math.round((endMs - startMs) / 1000)));

    const score = Number(summary.score || 0);
    const hits = Number(summary.goodHit || summary.hits || 0);
    const miss = Number(summary.miss || 0);
    const junkHit = Number(summary.junkHit || 0);
    const goodMiss = Number(summary.goodMiss || 0);
    const bestStreak = Number(summary.bestStreak || summary.comboMax || 0);
    const partnerScore = Number(summary.peerScore || summary.partner_score || 0);
    const pairScore = Number(summary.pairScore || summary.team_score || (score + partnerScore));
    const pairGoal = Number(summary.pairGoal || 0);

    const totalAttempts = hits + junkHit + goodMiss;
    const accuracyPct = totalAttempts > 0
      ? Math.round((hits / totalAttempts) * 10000) / 100
      : Number(summary.accuracy_pct || 0);

    const sessionRow = {
      session_id: sessionId,
      start_ts: new Date(startMs).toISOString(),
      end_ts: new Date(endMs).toISOString(),
      date_local: startLocal.date,
      time_local: startLocal.time,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
      pid: pid,
      player_name: String(summary.name || summary.player_name || 'Player'),
      student_code: String(summary.student_code || ''),
      grade: String(summary.grade || ''),
      class_room: String(summary.class_room || ''),
      school: String(summary.school || ''),
      campus: String(summary.campus || ''),
      age: Number.isFinite(Number(summary.age)) ? Number(summary.age) : '',
      sex: String(summary.sex || ''),
      hero_name: String(summary.hero_name || ''),
      hero_avatar: String(summary.hero_avatar || ''),
      hero_soft: String(summary.hero_soft || ''),
      hero_border: String(summary.hero_border || ''),
      hero_text: String(summary.hero_text || ''),
      hero_display: String(summary.hero_display || ''),
      game: game,
      game_title: String(summary.game_title || 'GoodJunk'),
      zone: zone,
      mode: mode,
      run: String(summary.run || qs('run', 'play')),
      research_phase: String(summary.research_phase || qs('phase', '')),
      study_id: String(summary.study_id || qs('studyId', '')),
      condition_group: String(summary.condition_group || qs('conditionGroup', '')),
      variant: String(summary.variant || ''),
      pick_mode: String(summary.pick_mode || ''),
      difficulty: diff,
      session_time_sec_setting: Number(summary.timeSec || qs('time', 90)),
      actual_duration_sec: actualDurationSec,
      view_mode: String(summary.view || summary.view_mode || qs('view', 'mobile')),
      device_type: String(summary.device_type || ''),
      platform: 'web',
      user_agent: navigator.userAgent || '',
      seed: String(summary.seed || qs('seed', '')),
      deterministic_flag: '1',
      warmup_used: String(summary.warmup_used || ''),
      warmup_type: String(summary.warmup_type || ''),
      warmup_pct: Number.isFinite(Number(summary.warmup_pct)) ? Number(summary.warmup_pct) : '',
      warmup_rank: String(summary.warmup_rank || ''),
      cooldown_used: String(summary.cooldown_used || ''),
      completed: '1',
      quit_reason: String(summary.reason || summary.quit_reason || ''),
      score: score,
      hits: hits,
      miss: miss,
      accuracy_pct: accuracyPct,
      combo_max: bestStreak,
      level_reached: Number.isFinite(Number(summary.level_reached)) ? Number(summary.level_reached) : '',
      boss_phase_reached: Number.isFinite(Number(summary.boss_phase_reached)) ? Number(summary.boss_phase_reached) : '',
      team_score: pairScore,
      partner_score: partnerScore,
      opponent_score: Number.isFinite(Number(summary.opponent_score)) ? Number(summary.opponent_score) : '',
      rank: String(summary.rank || ''),
      hints_used: Number.isFinite(Number(summary.hints_used)) ? Number(summary.hints_used) : '',
      coach_tips_shown: Number.isFinite(Number(summary.coach_tips_shown)) ? Number(summary.coach_tips_shown) : '',
      coach_tips_used: Number.isFinite(Number(summary.coach_tips_used)) ? Number(summary.coach_tips_used) : '',
      safety_flags: String(summary.safety_flags || ''),
      summary_json: JSON.stringify(summary || {}),
      api_log_enabled: API ? '1' : '0',
      log_endpoint: API,
      sync_status: 'pending',
      offline_cached: '0',
      retry_count: 0,
      room_id: roomId,
      match_id: matchId,
      partner_pid: String(summary.partner_pid || ''),
      opponent_pid: String(summary.opponent_pid || ''),
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
      variant: String(summary.variant || ''),
      difficulty: diff,
      view_mode: String(summary.view || summary.view_mode || qs('view', 'mobile')),
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

    const studentRows = [];
    if (summary.student_code || summary.pid || summary.name || summary.player_name) {
      studentRows.push({
        pid: pid,
        student_code: String(summary.student_code || ''),
        prefix: String(summary.prefix || ''),
        first_name: String(summary.first_name || ''),
        last_name: String(summary.last_name || ''),
        display_name: String(summary.name || summary.player_name || 'Player'),
        grade: String(summary.grade || ''),
        class_room: String(summary.class_room || ''),
        school: String(summary.school || ''),
        campus: String(summary.campus || ''),
        age: Number.isFinite(Number(summary.age)) ? Number(summary.age) : '',
        sex: String(summary.sex || ''),
        group_assignment: String(summary.group_assignment || ''),
        condition_group: String(summary.condition_group || qs('conditionGroup', '')),
        consent_flag: String(summary.consent_flag || ''),
        assent_flag: String(summary.assent_flag || ''),
        parent_consent_flag: String(summary.parent_consent_flag || ''),
        notes: String(summary.notes || ''),
        active_flag: String(summary.active_flag || '1')
      });
    }

    return {
      source: 'herohealth',
      schema_version: String(summary.schema_version || DEFAULT_SCHEMA_VERSION),
      action: 'append_rows',
      dry_run: String(qs('dry_run', '0')) === '1',
      room_id: roomId,
      sheets: {
        sessions: [sessionRow],
        events: [startEvent, endEvent],
        'students-profile': studentRows
      }
    };
  }

  async function postSummary(summary){
    if (!API) {
      warn('missing api endpoint', {
        HHA_APPS_SCRIPT_URL: root.HHA_APPS_SCRIPT_URL || '',
        location: location.href
      });
      return { ok:false, error:'missing-endpoint' };
    }

    const payload = buildEnvelope(summary);
    lastPayload = payload;

    log('postSummary begin', {
      api: API,
      dry_run: payload.dry_run,
      session_id: payload?.sheets?.sessions?.[0]?.session_id || '',
      mode: payload?.sheets?.sessions?.[0]?.mode || '',
      payload
    });

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors'
      });

      const text = await res.text().catch(() => '');
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (_) {}

      lastResponse = {
        ok: res.ok,
        status: res.status,
        text,
        json
      };

      log('fetch done', {
        status: res.status,
        ok: res.ok,
        text,
        json
      });

      return lastResponse;
    } catch (err) {
      lastResponse = { ok:false, error:String(err) };
      errlog('post failed', err);
      return lastResponse;
    }
  }

  async function flushFromSummary(summary){
    summary = summary || {};
    const sessionId = String(summary.session_id || summary.sessionId || '').trim();

    if (flushPromise) {
      log('flush already in progress');
      return flushPromise;
    }

    if (sessionId && flushedSessionId && flushedSessionId === sessionId) {
      log('skip duplicate flush', sessionId);
      return { ok:true, skipped:true, reason:'duplicate-session' };
    }

    flushPromise = postSummary(summary)
      .then((res) => {
        if (sessionId) flushedSessionId = sessionId;
        return res;
      })
      .finally(() => {
        flushPromise = null;
      });

    return flushPromise;
  }

  function onEnd(e){
    try{
      const summary = e?.detail || {};
      log('hha:end received', summary);
      flushFromSummary(summary);
    }catch(err){
      errlog('onEnd failed', err);
    }
  }

  function onPageHide(){
    try {
      const summary = root.__HHA_LAST_SUMMARY__ || null;
      if (!summary) return;
      log('pagehide with cached summary');
      flushFromSummary(summary);
    } catch (err) {
      errlog('onPageHide failed', err);
    }
  }

  root.HHACloudLogger = {
    postSummary,
    buildEnvelope,
    flushFromSummary,
    getLastPayload: function(){ return lastPayload; },
    getLastResponse: function(){ return lastResponse; },
    getApi: function(){ return API; }
  };

  root.addEventListener('hha:end', onEnd);
  root.addEventListener('pagehide', onPageHide);

  log('ready', {
    api: API || '(missing)',
    time: nowIso(),
    location: location.href
  });
})(window);