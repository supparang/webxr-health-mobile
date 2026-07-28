/* =========================================================
   EAP Word Quest • JSONP Attempt Submit + Receipt
   Version: 20260728-EAPWQ-SUBMIT-JSONP-V1

   Requires in the same Apps Script project:
   - EAPWordQuest.gs
   - EAPWordQuestFinalRouterPatch.gs
   - EAPWordQuestAuthority.gs
   - SharedWebAppRouter.gs

   This module has no doGet()/doPost().
========================================================= */

const EAPWQ_JSONP_SUBMIT_VERSION = '20260728-EAPWQ-SUBMIT-JSONP-V1';

function eapWordSubmitJsonp_(params) {
  const p = params || {};
  let envelope = {};
  let input = {};
  let lock = null;

  try {
    if (p.payload) {
      envelope = JSON.parse(String(p.payload));
    } else {
      envelope = p;
    }
    input = envelope && envelope.record ? envelope.record : envelope;

    const studentId = eapwqaStudentId_(input.studentId || p.studentId);
    const section = eapwqaSection_(input.section || input.group || p.section || p.group);
    if (!studentId) return eapwqJsonpSubmitFail_('student_id_required');
    if (section !== EAPWQA_GROUP) return eapwqJsonpSubmitFail_('section_not_allowed');

    const lookup = eapwqaProfileLookup_({studentId:studentId,section:section});
    if (!lookup || !lookup.ok || !lookup.official || !lookup.profile) {
      return eapwqJsonpSubmitFail_(lookup && lookup.error ? lookup.error : 'official_profile_required');
    }

    const official = lookup.profile;
    const requestedName = eapwqaText_(input.studentName);
    const officialName = eapwqaText_(official.studentName);
    if (requestedName && requestedName !== officialName) {
      return eapwqJsonpSubmitFail_('profile_name_mismatch',{
        studentId:studentId,
        requestedName:requestedName,
        officialName:officialName
      });
    }

    input.studentId = studentId;
    input.studentName = officialName;
    input.group = EAPWQA_GROUP;
    input.section = EAPWQA_GROUP;

    const normalizedEnvelope = {
      clientTs:eapwqaText_(envelope.clientTs || input.clientTs),
      pageUrl:eapwqaText_(envelope.pageUrl || input.pageUrl),
      userAgent:eapwqaText_(envelope.userAgent || input.userAgent),
      schemaVersion:eapwqaText_(envelope.schemaVersion || input.schemaVersion || EAPWQ_JSONP_SUBMIT_VERSION)
    };

    lock = LockService.getScriptLock();
    lock.waitLock(25000);
    eapwqSetup_();

    const record = eapwqNormalize_(input,normalizedEnvelope);
    record.studentId = studentId;
    record.studentName = officialName;
    record.group = EAPWQA_GROUP;
    record.section = EAPWQA_GROUP;
    record.source = eapwqaText_(input.source || 'v279-jsonp-receipt');

    if (!eapwqIsLearningRecord_(record)) {
      return eapwqJsonpSubmitFail_('invalid_session',{sessionId:record.sessionId});
    }

    eapwqUpsertProfile_(record);
    const write = eapwqAppendAttempts_([record]);
    const summary = write.count ? eapwqUpsertSummary_(record) : null;

    return {
      ok:true,
      action:'eap_word_submit_jsonp',
      official:true,
      authority:'google_sheet',
      version:EAPWQ_JSONP_SUBMIT_VERSION,
      appended:write.count,
      duplicate:write.duplicates,
      receipt:{
        studentId:record.studentId,
        studentName:record.studentName,
        section:record.section,
        sessionId:record.sessionId,
        passed:Boolean(record.passed),
        accuracy:Number(record.accuracy || 0),
        score:Number(record.score || 0),
        fingerprint:record.fingerprint,
        playedAt:record.playedAt,
        serverTs:record.serverTs
      },
      summary:summary,
      generatedAt:eapwqNow_()
    };
  } catch (error) {
    return eapwqJsonpSubmitFail_('submit_exception',{
      message:String(error && error.message || error)
    });
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

function eapwqJsonpSubmitFail_(error,extra) {
  const out = {
    ok:false,
    action:'eap_word_submit_jsonp',
    official:false,
    error:String(error || 'submit_failed'),
    version:EAPWQ_JSONP_SUBMIT_VERSION,
    generatedAt:eapwqNow_()
  };
  Object.keys(extra || {}).forEach(function(key) { out[key] = extra[key]; });
  return out;
}
