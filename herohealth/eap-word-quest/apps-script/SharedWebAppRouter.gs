/* =========================================================
   Shared Web App Router v152
   EAP Hero + EAP Word Quest + Teacher Dashboard
   Section 122

   PRODUCTION RESET
   - EAP_ProgressAuthority_v150.gs is the ONLY progression/resume authority.
   - EAP_ProgressSeed_v152_Bulk.gs provides a fast one-time seed for test ID 50.
   - Evidence/attempt/event sheets remain research logs only.
   - Successful evidence submissions mirror into EAP_Progress immediately.
   - Legacy v137/v145/v146 remain installed only for compatibility/reference.
   - Keep this as the ONLY file in the project containing doGet() / doPost().
========================================================= */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || params.api || 'health').toLowerCase();
  const module = String(params.module || '').toLowerCase();
  const callback = String(params.callback || '');

  try {
    if (action === 'router_health' || action === 'eap_router_health') {
      return eapRouterJson_({
        ok: true,
        service: 'shared-router-v152',
        progressAuthorityInstalled: typeof eapPlayerResumeV150_ === 'function' && typeof eapProgressUpsertV150_ === 'function',
        progressSeedV152Installed: typeof eapProgressSeedTest50V152_ === 'function',
        progressSeedV151Installed: typeof eapProgressSeedTest50V151_ === 'function',
        playerResumeV146Installed: typeof eapPlayerResumeV146_ === 'function',
        playerResumeV145Installed: typeof eapPlayerResumeV138_ === 'function',
        playerResumeV137Installed: typeof eapPlayerResumeV137_ === 'function',
        heroGetInstalled: typeof eapHeroDoGet_ === 'function',
        now: new Date().toISOString()
      }, callback);
    }

    if (action === 'progress_setup' || action === 'eap_progress_setup') {
      if (typeof eapProgressSetupV150_ !== 'function') throw new Error('EAP_ProgressAuthority_v150.gs is not installed');
      return eapRouterJson_(eapProgressSetupV150_(), callback);
    }

    if (action === 'progress_seed_test50' || action === 'eap_progress_seed_test50') {
      if (typeof eapProgressSeedTest50V152_ !== 'function') throw new Error('EAP_ProgressSeed_v152_Bulk.gs is not installed');
      return eapRouterJson_(eapProgressSeedTest50V152_(), callback);
    }

    if (action === 'progress_migrate_student' || action === 'eap_progress_migrate_student') {
      if (typeof eapProgressMigrateStudentV150_ !== 'function') throw new Error('EAP_ProgressAuthority_v150.gs is not installed');
      return eapRouterJson_(eapProgressMigrateStudentV150_(
        String(params.studentId || params.id || ''),
        String(params.section || '122'),
        String(params.sourceStudentId || params.studentId || params.id || '')
      ), callback);
    }

    if (
      action === 'eap_identity_lookup' ||
      action === 'eap_hero_profile_lookup' ||
      action === 'eap_word_profile_lookup'
    ) {
      if (typeof eapIdentityLookupV121_ !== 'function') throw new Error('EAP_Identity_v121.gs is not installed');
      return eapRouterJson_(eapIdentityLookupV121_(params), callback);
    }

    if (action === 'player_resume' || action === 'player_resume_fast' || action === 'progress_resume') {
      if (typeof eapPlayerResumeV150_ !== 'function') {
        return eapRouterJson_({
          ok:false,service:'shared-router-v152',action:action,
          error:'EAP_ProgressAuthority_v150.gs is not installed or not deployed',
          progressAuthorityInstalled:false
        }, callback);
      }
      return eapRouterJson_(eapPlayerResumeV150_(params), callback);
    }

    if (action === 'eap_teacher_dashboard') return eapTeacherDashboardPage_();
    if (action === 'eap_teacher_dashboard_data') return eapTeacherDashboardJson_(params);
    if (action === 'eap_word_submit_jsonp') return eapRouterJson_(eapWordSubmitJsonp_(params), callback);
    if (action === 'eap_word_name_lookup') return eapRouterJson_(eapWordNameLookup_(params), callback);

    const wordAuthorityActions = ['eap_word_authority_health','eap_word_roster_setup','eap_word_player_resume'];
    if (wordAuthorityActions.includes(action)) return eapRouterJson_(eapWordAuthorityDoGet_(params), callback);

    if (action === 'eap_sheet_v132_health' || action === 'sheet_v132_health') return eapRouterJson_(eapSheetV132Health_(), callback);
    if (action === 'eap_sheet_v132_headers' || action === 'sheet_v132_headers') return eapRouterJson_(eapSheetV132Headers_(), callback);
    if (action === 'eap_sheet_v132_setup' || action === 'setup_eap_sheet_v132' || action === 'setup_sheet_v132') return eapRouterJson_(eapSheetV132Setup_(), callback);

    const wordQuestActions = ['eap_word_health','eap_word_teacher','eap_word_summary','eap_word_setup'];
    if (wordQuestActions.includes(action) || (action === 'setup' && module === 'eap_word')) return eapWordFinalDoGet_(e);

    return eapHeroDoGet_(e);
  } catch (error) {
    return eapRouterJson_({
      ok:false,service:'shared-router-v152',action:action,
      error:String(error && error.stack ? error.stack : error)
    }, callback);
  }
}

function doPost(e) {
  const payload = eapRouterParsePost_(e);
  const action = String(payload.action || payload.type || payload.api || '').toLowerCase();

  try {
    if (typeof eapSheetV132ShouldMirror_ === 'function' && eapSheetV132ShouldMirror_(action, payload)) {
      eapSheetV132MirrorSafe_(payload);
    }

    if (action === 'submit_evidence') {
      const result = typeof eapSubmitEvidenceV137_ === 'function' ? eapSubmitEvidenceV137_(payload) : submitEvidence_(payload);
      if (result && result.ok && typeof eapProgressUpsertV150_ === 'function') {
        try { result.progress = eapProgressUpsertV150_(payload, result); }
        catch (progressError) { result.progress = {ok:false,error:String(progressError && progressError.stack ? progressError.stack : progressError)}; }
      }
      return eapRouterJson_(result);
    }

    if (action === 'submit_speaking_audio') {
      const result = submitSpeakingAudio_(payload);
      if (result && result.ok && typeof eapProgressUpsertV150_ === 'function') {
        try {
          const progressPayload = Object.assign({}, payload, {skill: payload.skill || 'Speaking'});
          result.progress = eapProgressUpsertV150_(progressPayload, result);
        } catch (progressError) {
          result.progress = {ok:false,error:String(progressError && progressError.stack ? progressError.stack : progressError)};
        }
      }
      return eapRouterJson_(result);
    }

    const wordQuestActions = ['eap_word_attempt','eap_word_batch','eap_word_profile'];
    if (wordQuestActions.includes(action)) return eapWordFinalDoPost_(e);
    return eapHeroDoPost_(eapRouterEventWithPayload_(e, payload));
  } catch (error) {
    return eapRouterJson_({ok:false,service:'shared-router-v152',action:action,error:String(error && error.stack ? error.stack : error)});
  }
}

function eapRouterParsePost_(e) {
  const params = (e && e.parameter) || {};
  let payload = {};
  const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (raw) {
    try { payload = JSON.parse(raw); }
    catch (error) { payload = eapRouterParseUrlEncoded_(raw); }
  }
  payload = payload && typeof payload === 'object' ? payload : {};
  Object.keys(params).forEach(function(key){ if (payload[key] === undefined || payload[key] === '') payload[key] = params[key]; });
  return payload;
}

function eapRouterParseUrlEncoded_(raw) {
  const out = {};
  const text = String(raw || '');
  if (text.indexOf('=') < 0) return out;
  text.split('&').forEach(function(pair){
    const parts = pair.split('=');
    const key = decodeURIComponent(String(parts.shift() || '').replace(/\+/g, ' '));
    const value = decodeURIComponent(String(parts.join('=') || '').replace(/\+/g, ' '));
    if (key) out[key] = value;
  });
  return out;
}

function eapRouterEventWithPayload_(e, payload) {
  const next = {};
  Object.keys(e || {}).forEach(function(key){ next[key] = e[key]; });
  next.parameter = Object.assign({}, (e && e.parameter) || {}, payload || {});
  next.parameters = {};
  Object.keys(next.parameter).forEach(function(key){ next.parameters[key] = [next.parameter[key]]; });
  next.postData = Object.assign({}, (e && e.postData) || {}, {contents:JSON.stringify(payload || {}),type:'application/json'});
  return next;
}

function eapRouterJson_(data, callback) {
  const json = JSON.stringify(data || {});
  const safeCallback = String(callback || '').trim();
  if (/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(safeCallback)) {
    return ContentService.createTextOutput(safeCallback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
