// === /herohealth/js/hha-cloud-post.js ===
// Drop-in helper for posting HeroHealth rows to Apps Script Web App
// FULL PATCH v20260327-HHA-CLOUD-POST

(function (global) {
  'use strict';

  const WIN = global;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function toArray(value) {
    return Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && !Array.isArray(v)) : [];
  }

  function normalizeEndpoint(url) {
    return String(url || WIN.HHA_CLOUD_ENDPOINT || '').trim();
  }

  function buildObjectRowsPayload(input = {}) {
    return {
      schema: 'hha-cloud-logger-v1',
      mode: 'object_rows',
      client: 'herohealth-web',
      sent_at: nowIso(),
      rows: {
        students_profile: toArray(input.students_profile || input.studentsProfile),
        sessions: toArray(input.sessions),
        events: toArray(input.events)
      }
    };
  }

  async function postObjectRows(input = {}) {
    const endpoint = normalizeEndpoint(input.endpoint);
    if (!endpoint) {
      throw new Error('Missing Apps Script endpoint');
    }

    const payload = buildObjectRowsPayload(input);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: !!input.keepalive,
      credentials: 'omit',
      cache: 'no-store'
    });

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { ok: false, raw: text };
    }

    if (!response.ok || !json || json.ok === false) {
      const msg =
        (json && (json.error || json.message)) ||
        `HTTP ${response.status}`;
      throw new Error(msg);
    }

    return json;
  }

  function withSessionDefaults(row = {}, ctx = {}) {
    const d = new Date();
    const dateLocal = d.toLocaleDateString('sv-SE');
    const timeLocal = d.toLocaleTimeString('sv-SE', { hour12: false });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    return {
      session_id: row.session_id || ctx.session_id || '',
      start_ts: row.start_ts ?? '',
      end_ts: row.end_ts ?? '',
      date_local: row.date_local || dateLocal,
      time_local: row.time_local || timeLocal,
      timezone: row.timezone || timezone,

      pid: row.pid || ctx.pid || 'anon',
      player_name: row.player_name || ctx.player_name || ctx.name || '',
      student_code: row.student_code || ctx.student_code || '',
      grade: row.grade || ctx.grade || '',
      class_room: row.class_room || ctx.class_room || '',
      school: row.school || ctx.school || '',

      hero_name: row.hero_name || ctx.hero_name || ctx.name || '',
      hero_avatar: row.hero_avatar || ctx.hero_avatar || '',
      hero_soft: row.hero_soft || ctx.hero_soft || '',
      hero_border: row.hero_border || ctx.hero_border || '',
      hero_text: row.hero_text || ctx.hero_text || '',
      hero_display: row.hero_display || ctx.hero_display || '',

      game: row.game || ctx.game || '',
      game_title: row.game_title || ctx.game_title || '',
      zone: row.zone || ctx.zone || '',
      mode: row.mode || ctx.mode || '',
      run: row.run || ctx.run || 'play',
      research_phase: row.research_phase || ctx.research_phase || '',
      study_id: row.study_id || ctx.study_id || '',
      condition_group: row.condition_group || ctx.condition_group || '',
      variant: row.variant || ctx.variant || '',
      difficulty: row.difficulty || ctx.difficulty || '',
      view_mode: row.view_mode || ctx.view_mode || '',
      seed: row.seed || ctx.seed || '',

      ...safeClone(row)
    };
  }

  function withEventDefaults(row = {}, ctx = {}) {
    const d = new Date();
    const dateLocal = d.toLocaleDateString('sv-SE');
    const timeLocal = d.toLocaleTimeString('sv-SE', { hour12: false });

    return {
      event_id: row.event_id || '',
      session_id: row.session_id || ctx.session_id || '',
      event_seq: row.event_seq ?? '',
      ts_ms: row.ts_ms ?? Date.now(),
      ts_iso: row.ts_iso || nowIso(),
      date_local: row.date_local || dateLocal,
      time_local: row.time_local || timeLocal,

      pid: row.pid || ctx.pid || 'anon',
      game: row.game || ctx.game || '',
      zone: row.zone || ctx.zone || '',
      mode: row.mode || ctx.mode || '',
      run: row.run || ctx.run || 'play',
      research_phase: row.research_phase || ctx.research_phase || '',
      study_id: row.study_id || ctx.study_id || '',
      condition_group: row.condition_group || ctx.condition_group || '',
      variant: row.variant || ctx.variant || '',
      difficulty: row.difficulty || ctx.difficulty || '',
      view_mode: row.view_mode || ctx.view_mode || '',
      seed: row.seed || ctx.seed || '',

      hero_name: row.hero_name || ctx.hero_name || ctx.name || '',
      hero_avatar: row.hero_avatar || ctx.hero_avatar || '',
      hero_soft: row.hero_soft || ctx.hero_soft || '',
      hero_border: row.hero_border || ctx.hero_border || '',
      hero_text: row.hero_text || ctx.hero_text || '',
      hero_display: row.hero_display || ctx.hero_display || '',

      event_type: row.event_type || 'event',
      event_name: row.event_name || '',
      action: row.action || '',

      ...safeClone(row)
    };
  }

  function withStudentDefaults(row = {}, ctx = {}) {
    return {
      pid: row.pid || ctx.pid || 'anon',
      display_name: row.display_name || ctx.name || '',
      grade: row.grade || ctx.grade || '',
      class_room: row.class_room || ctx.class_room || '',
      school: row.school || ctx.school || '',
      condition_group: row.condition_group || ctx.condition_group || '',
      ...safeClone(row)
    };
  }

  async function sendBundle(bundle = {}) {
    const ctx = bundle.ctx || {};

    const students_profile = toArray(bundle.students_profile || bundle.studentsProfile)
      .map(row => withStudentDefaults(row, ctx));

    const sessions = toArray(bundle.sessions)
      .map(row => withSessionDefaults(row, ctx));

    const events = toArray(bundle.events)
      .map(row => withEventDefaults(row, ctx));

    return postObjectRows({
      endpoint: bundle.endpoint,
      keepalive: !!bundle.keepalive,
      students_profile,
      sessions,
      events
    });
  }

  WIN.HHACloudPost = {
    nowIso,
    buildObjectRowsPayload,
    postObjectRows,
    sendBundle,
    withSessionDefaults,
    withEventDefaults,
    withStudentDefaults
  };
})(window);