/* =========================================================
   Shared Web App Router v137
   EAP Hero + EAP Word Quest + Teacher Dashboard
   Section 122

   IMPORTANT
   - Keep this as the ONLY file in the project containing doGet() / doPost().
   - EAPHero.gs owns eapHeroDoGet_ / eapHeroDoPost_.
   - EAPWordQuest.gs owns eapWordFinalDoGet_ / eapWordFinalDoPost_.
   - EAPWordQuestAuthority.gs owns official roster lookup / Word Quest resume.
   - EAPWordQuestNameLookup.gs owns official roster name search.
   - EAPWordQuestSubmitJsonp.gs owns JSONP attempt submit + receipt.
   - EAP_TeacherDashboard.gs owns the Teacher Dashboard.
   - EAP_PlayerResume.gs owns the legacy eapPlayerResume_ fallback.
   - EAP_EvidenceReview.gs owns legacy submitEvidence_ / submitSpeakingAudio_.
   - EAP_SheetV132.gs owns health/setup/mirror compatibility helpers.
   - EAP_SessionAuthority_v137.gs owns official EAP Session resume/progression
     and the resume-readable submit_evidence handler.
========================================================= */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || params.api || 'health').toLowerCase();
  const module = String(params.module || '').toLowerCase();
  const callback = String(params.callback || '');

  try {
    /* ---------------------------------------------------------
       EAP Session resume: Google Sheet is sole authority
    --------------------------------------------------------- */
    if (action === 'player_resume') {
      const resume = typeof eapPlayerResumeV137_ === 'function'
        ? eapPlayerResumeV137_(params)
        : eapPlayerResume_(params);
      return eapRouterJson_(resume, callback);
    }

    if (action === 'eap_teacher_dashboard') {
      return eapTeacherDashboardPage_();
    }

    if (action === 'eap_teacher_dashboard_data') {
      return eapTeacherDashboardJson_(params);
    }

    /* ---------------------------------------------------------
       Word Quest JSONP / roster services
    --------------------------------------------------------- */
    if (action === 'eap_word_submit_jsonp') {
      return eapRouterJson_(eapWordSubmitJsonp_(params), callback);
    }

    if (action === 'eap_word_name_lookup') {
      return eapRouterJson_(eapWordNameLookup_(params), callback);
    }

    const wordAuthorityActions = [
      'eap_word_authority_health',
      'eap_word_roster_setup',
      'eap_word_profile_lookup',
      'eap_word_player_resume'
    ];

    if (wordAuthorityActions.includes(action)) {
      return eapRouterJson_(eapWordAuthorityDoGet_(params), callback);
    }

    /* ---------------------------------------------------------
       Sheet v132 compatibility routes
       Do not run setup during a normal v137 deployment.
    --------------------------------------------------------- */
    if (action === 'eap_sheet_v132_health' || action === 'sheet_v132_health') {
      return eapRouterJson_(eapSheetV132Health_(), callback);
    }

    if (action === 'eap_sheet_v132_headers' || action === 'sheet_v132_headers') {
      return eapRouterJson_(eapSheetV132Headers_(), callback);
    }

    if (
      action === 'eap_sheet_v132_setup' ||
      action === 'setup_eap_sheet_v132' ||
      action === 'setup_sheet_v132'
    ) {
      return eapRouterJson_(eapSheetV132Setup_(), callback);
    }

    const wordQuestActions = [
      'eap_word_health',
      'eap_word_teacher',
      'eap_word_summary',
      'eap_word_setup'
    ];

    if (
      wordQuestActions.includes(action) ||
      (action === 'setup' && module === 'eap_word')
    ) {
      return eapWordFinalDoGet_(e);
    }

    return eapHeroDoGet_(e);
  } catch (error) {
    return eapRouterJson_({
      ok: false,
      service: 'shared-router-v137',
      action: action,
      error: String(error && error.stack ? error.stack : error)
    }, callback);
  }
}

function doPost(e) {
  const payload = eapRouterParsePost_(e);
  const action = String(
    payload.action ||
    payload.type ||
    payload.api ||
    ''
  ).toLowerCase();

  try {
    /* ---------------------------------------------------------
       Preserve the v132 metadata mirror for legacy receivers.
    --------------------------------------------------------- */
    if (
      typeof eapSheetV132ShouldMirror_ === 'function' &&
      eapSheetV132ShouldMirror_(action, payload)
    ) {
      eapSheetV132MirrorSafe_(payload);
    }

    if (action === 'submit_evidence') {
      const result = typeof eapSubmitEvidenceV137_ === 'function'
        ? eapSubmitEvidenceV137_(payload)
        : submitEvidence_(payload);
      return eapRouterJson_(result);
    }

    if (action === 'submit_speaking_audio') {
      return eapRouterJson_(submitSpeakingAudio_(payload));
    }

    const wordQuestActions = [
      'eap_word_attempt',
      'eap_word_batch',
      'eap_word_profile'
    ];

    if (wordQuestActions.includes(action)) {
      return eapWordFinalDoPost_(e);
    }

    return eapHeroDoPost_(eapRouterEventWithPayload_(e, payload));
  } catch (error) {
    return eapRouterJson_({
      ok: false,
      service: 'shared-router-v137',
      action: action,
      error: String(error && error.stack ? error.stack : error)
    });
  }
}

/* =========================================================
   Robust POST parser
   Supports JSON text/plain, form post, URL encoded and e.parameter.
========================================================= */
function eapRouterParsePost_(e) {
  const params = (e && e.parameter) || {};
  let payload = {};

  const raw = e && e.postData && e.postData.contents
    ? String(e.postData.contents)
    : '';

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      payload = eapRouterParseUrlEncoded_(raw);
    }
  }

  payload = payload && typeof payload === 'object'
    ? payload
    : {};

  Object.keys(params).forEach(function(key) {
    if (payload[key] === undefined || payload[key] === '') {
      payload[key] = params[key];
    }
  });

  return payload;
}

function eapRouterParseUrlEncoded_(raw) {
  const out = {};
  const text = String(raw || '');

  if (text.indexOf('=') < 0) {
    return out;
  }

  text.split('&').forEach(function(pair) {
    const parts = pair.split('=');
    const key = decodeURIComponent(
      String(parts.shift() || '').replace(/\+/g, ' ')
    );
    const value = decodeURIComponent(
      String(parts.join('=') || '').replace(/\+/g, ' ')
    );

    if (key) {
      out[key] = value;
    }
  });

  return out;
}

/* =========================================================
   Forward the normalized payload to the legacy receiver.
========================================================= */
function eapRouterEventWithPayload_(e, payload) {
  const next = {};

  Object.keys(e || {}).forEach(function(key) {
    next[key] = e[key];
  });

  next.parameter = Object.assign(
    {},
    (e && e.parameter) || {},
    payload || {}
  );

  next.parameters = {};

  Object.keys(next.parameter).forEach(function(key) {
    next.parameters[key] = [next.parameter[key]];
  });

  next.postData = Object.assign(
    {},
    (e && e.postData) || {},
    {
      contents: JSON.stringify(payload || {}),
      type: 'application/json'
    }
  );

  return next;
}

/* =========================================================
   Shared JSON / JSONP response helper.
========================================================= */
function eapRouterJson_(data, callback) {
  const json = JSON.stringify(data || {});
  const safeCallback = String(callback || '').trim();

  if (/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(safeCallback)) {
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
