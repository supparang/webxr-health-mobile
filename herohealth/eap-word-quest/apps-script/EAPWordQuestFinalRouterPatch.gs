/* =========================================================
   EAP Word Quest • Shared Router Final Write Patch
   File: EAPWordQuestFinalRouterPatch.gs

   Requires EAPWordQuest.gs in the same Apps Script project.
   Router must call eapWordFinalDoGet_ / eapWordFinalDoPost_.
========================================================= */

function eapWordFinalDoGet_(e) {
  /* The read API in EAPWordQuest.gs is already complete and read-only. */
  return eapWordDoGet_(e);
}

function eapWordFinalDoPost_(e) {
  const payload = eapwqParse_(e);
  const action = String(payload.action || payload.type || '').toLowerCase();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(25000);
    eapwqSetup_();

    if (action === 'eap_word_attempt') {
      const record = eapwqNormalize_(payload.record || payload, payload);
      eapwqUpsertProfile_(record);

      if (record.isProfile) {
        return eapwqOut_({ ok:true, action:action, profileOnly:true, version:EAPWQ_VERSION, now:eapwqNow_() });
      }
      if (!eapwqIsLearningRecord_(record)) {
        return eapwqOut_({ ok:false, action:action, error:'Invalid EAP Word Quest session', sessionId:record.sessionId, version:EAPWQ_VERSION });
      }

      const write = eapwqAppendAttempts_([record]);
      const summary = write.count ? eapwqUpsertSummary_(record) : {
        studentId:record.studentId,
        sessionId:record.sessionId,
        skipped:true,
        reason:'duplicate_fingerprint'
      };

      return eapwqOut_({
        ok:true,
        action:action,
        appended:write.count,
        duplicate:write.duplicates,
        summary:summary,
        version:EAPWQ_VERSION,
        now:eapwqNow_()
      });
    }

    if (action === 'eap_word_batch') {
      const incoming = Array.isArray(payload.records) ? payload.records : [];
      let appended = 0;
      let duplicate = 0;
      let profiles = 0;
      let skipped = 0;
      const summaries = [];

      incoming.forEach(function(row) {
        const record = eapwqNormalize_(row, payload);
        eapwqUpsertProfile_(record);

        if (record.isProfile) {
          profiles += 1;
          return;
        }
        if (!eapwqIsLearningRecord_(record)) {
          skipped += 1;
          return;
        }

        /* A summary is updated only after this attempt was actually appended.
           Cloud retries therefore cannot inflate the attempt count. */
        const write = eapwqAppendAttempts_([record]);
        appended += write.count;
        duplicate += write.duplicates;
        if (write.count) summaries.push(eapwqUpsertSummary_(record));
      });

      return eapwqOut_({
        ok:true,
        action:action,
        received:incoming.length,
        appended:appended,
        duplicate:duplicate,
        profiles:profiles,
        skipped:skipped,
        summaries:summaries,
        version:EAPWQ_VERSION,
        now:eapwqNow_()
      });
    }

    return eapwqOut_({ ok:false, error:'Unknown EAP Word Quest action', action:action, version:EAPWQ_VERSION });
  } catch (error) {
    return eapwqOut_({ ok:false, error:String(error && error.message || error), version:EAPWQ_VERSION });
  } finally {
    try { lock.releaseLock(); } catch (error) {}
  }
}
