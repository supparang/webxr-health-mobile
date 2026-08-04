// HeroHealth Firebase Data Contract v1
// Sandbox-first contract. Production authority requires a trusted backend.

export const HH_FIREBASE_SCHEMA_VERSION = 'HH-FIREBASE-SCHEMA-V1';

export const HH_COLLECTIONS = Object.freeze({
  students: 'studentsSandbox',
  bindings: 'studentBindingsSandbox',
  progress: 'studentProgressSandbox',
  attempts: 'gameAttemptsSandbox',
  summaries: 'gameSummariesSandbox'
});

export const HH_TEST_STUDENT = Object.freeze({
  studentId: '990014',
  nickname: 'Firebase Test',
  fullName: 'HeroHealth Firebase Test Student',
  classId: 'herohealth-pilot-2026',
  rotationGroup: 'A',
  conditionGroup: 'sandbox',
  active: true
});

export function defaultProgress(studentId = HH_TEST_STUDENT.studentId) {
  return {
    studentId,
    currentZone: 'hygiene',
    pretestCompleted: false,
    posttestCompleted: false,
    certificateEligible: false,
    zones: {
      hygiene: { unlocked: true, completed: false },
      nutrition: { unlocked: false, completed: false },
      fitness: { unlocked: false, completed: false }
    },
    schemaVersion: HH_FIREBASE_SCHEMA_VERSION
  };
}
