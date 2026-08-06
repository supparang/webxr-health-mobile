window.EW_CONFIG = Object.freeze({
  appId: "ENGLISH-WEEK-PASSPORT-2026",
  version: "2026-08-06-PASSPORT-FIREBASE-AUTHORITY-V1",
  authorityMode: "firebase-first",
  firebaseProjectId: "english-d4bfa",
  firebaseRegion: "asia-southeast1",
  firebaseAuthorityUrl: "https://asia-southeast1-english-d4bfa.cloudfunctions.net/englishWeekAuthority",
  firebaseNamespace: "englishWeekPassport/v1",
  webAppUrl: "",
  defaultGroup: "English Week",
  allowDemoWhenEndpointMissing: true,
  allowDemoWhenFirebaseUnavailable: true,
  requestTimeoutMs: 12000,
  assessmentItems: 10,
  leaderboardLimit: 10,
  cacheKeys: Object.freeze({
    identity: "ew_passport_identity_v1",
    demoDb: "ew_passport_demo_db_v1",
    assignmentPrefix: "ew_passport_assignment_v2::"
  })
});
