/**
 * ONE-TIME DATA REPAIR
 * Student 990011 • Toothbrush AR
 * Replaces the accidental zero-score completion by appending a corrected authoritative row.
 * Safe to run more than once because eventId is fixed and duplicate-guarded.
 */
function HH_repair990011ToothbrushScore() {
  return acceptPayload_({
    eventType: 'game',
    eventId: 'HH-REPAIR-990011-TOOTHBRUSH-254-V1',
    studentId: '990011',
    profile: {
      fullName: 'นักเรียนทดสอบ Assessment 11',
      section: 'QA-P5-ASSESSMENT',
      group: 'A'
    },
    clientTs: new Date().toISOString(),
    currentStep: 'hygiene:toothbrush',
    status: 'แก้ไขผล Toothbrush จาก wrapper zero-result',
    game: {
      zone: 'hygiene',
      gameId: 'toothbrush',
      score: 254,
      accuracy: 0,
      passed: true,
      completed: true,
      finishedAt: new Date().toISOString(),
      sessionId: 'HH-DATA-REPAIR-990011-TOOTHBRUSH',
      inputMode: 'classroom-ar',
      gameVersion: 'TOOTHBRUSH-REPAIR-V1',
      repairReason: 'Accidental wrapper completion stored score 0 after a real 254-point run',
      originalRecordedScore: 0,
      correctedScore: 254,
      singleAttemptPolicy: true
    }
  });
}
