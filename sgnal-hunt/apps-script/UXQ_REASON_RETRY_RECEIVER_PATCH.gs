/* =========================================================
 * UX Quest • Explain Why Retry Receiver Compatibility v1
 *
 * Add this helper to the PUBLIC Student Receiver Apps Script project.
 * It lets the existing receiver accept `reason_retry_submitted` as a normal
 * append-only learning evidence event. It does not replace doPost().
 * ========================================================= */

function uxqIsReasonRetryEvent_(payload) {
  return String(payload && payload.eventType || '') === 'reason_retry_submitted';
}

function uxqNormalizeReasonRetryEvent_(payload) {
  payload = payload || {};
  const retry = payload.reasonRetry || {};
  return {
    app: 'ux-quest',
    schema: String(payload.schema || 'uxq.reason-retry.v1'),
    eventType: 'reason_retry_submitted',
    eventId: String(payload.eventId || ''),
    attemptId: String(payload.attemptId || ''),
    linkedAttemptId: String(payload.linkedAttemptId || ''),
    occurredAt: String(payload.occurredAt || new Date().toISOString()),
    timezone: String(payload.timezone || 'Asia/Bangkok'),
    pageUrl: String(payload.pageUrl || ''),
    courseId: String(payload.courseId || ''),
    courseLabel: String(payload.courseLabel || ''),
    studentId: String(payload.studentId || ''),
    studentName: String(payload.studentName || ''),
    section: String(payload.section || ''),
    missionId: String(payload.missionId || ''),
    missionTitle: String(payload.missionTitle || ''),
    reasonRetry: {
      response: String(retry.response || '').slice(0, 420),
      verifiedAccuracy: Number(retry.verifiedAccuracy || 0),
      focus: Array.isArray(retry.focus) ? retry.focus : [],
      submittedAt: String(retry.submittedAt || payload.occurredAt || new Date().toISOString())
    }
  };
}

/*
 * INTEGRATION POINT — place this early inside the existing doPost(e),
 * immediately after parsing `payload` and before any mission_completed-only
 * validation. Reuse the receiver's existing append function and headers.
 *
 * if (uxqIsReasonRetryEvent_(payload)) {
 *   const event = uxqNormalizeReasonRetryEvent_(payload);
 *   // Example only: call the existing generic append routine in your receiver.
 *   // uxqAppendPayload_(event);
 *   return uxqJson_({ ok:true, eventType:event.eventType, eventId:event.eventId });
 * }
 *
 * IMPORTANT: Store the entire normalized event JSON in the same payload/details
 * column already used for mission_completed. The Teacher Review Queue reads that
 * payload and links it through `linkedAttemptId`.
 */
