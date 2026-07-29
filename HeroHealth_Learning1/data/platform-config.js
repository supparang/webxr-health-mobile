window.HH_CONFIG = {
  platformVersion: "2026.07-CLASSROOM60-HANDWASH-R37-TOOTHBRUSH-V27-JUMPDUCK-V35",
  appName: "HeroHealth Learning Platform",
  deploymentState: "QA_HANDWASH_MOBILE_FULLVIEWPORT_R37_TOOTHBRUSH_CAMERA_RECOVERY_V27_JUMPDUCK_KID_EASY_V35",
  sourceOfTruthMode: "google-sheet-authority-with-complete-game-contract",
  allowUnknownStudent: false,
  allowStudentGroupSelection: false,
  allowPrototypeCompletion: true,
  classroomMinutes: 60,
  stationMinutes: 10,
  transitionMinutes: 2,
  passingScore: 70,
  mobileOnly: true,
  oneRoundPerGame: true,
  requireGamePassToContinue: false,
  strictGamePass: { handwash: false, toothbrush: false },
  handwashContract: { requiredRubSteps: 7, requiredProcessSteps: 5, requiredTotalSteps: 12, requireWrists: true, requireAnalyticsReceipt: true, progressionByCompletion: true },
  toothbrushContract: {
    mode: "classroom_challenge",
    durationSec: 120,
    zones: 6,
    plaqueTargetsPerZone: { tl: 4, tm: 5, tr: 4, bl: 4, bm: 5, br: 4 },
    requiredPlaqueTargetsTotal: 26,
    requiredStrokesTotal: 26,
    dwellMsPerZone: 600,
    strokeMinDistancePx: 13,
    strokeResetDistancePx: 10,
    strokeCooldownMs: 240,
    targetHitRadiusPct: 32,
    strokePolicy: "multi-plaque-spatial-coverage-with-deliberate-directional-return-reset",
    settingsVisible: false,
    progressionByCompletion: true,
    completionPolicy: "one-classroom-challenge-round-completes-no-forced-retry",
    retryRequired: false,
    skillThresholds: { coverageZones: 6, directionAccuracyPct: 55, precisionAccuracyPct: 70, trackingQualityPct: 60 },
    input: "index-finger-only",
    trackingProfile: "adaptive-hysteresis-reacquire-v24",
    motionProfile: "multi-plaque-spatial-coverage-v27-camera-recovery",
    cameraProfile: "mobile-three-stage-constraints-fallback-release-v1",
    inferenceInput: "256x192-tracking-320x240-reacquire",
    coordinateMapping: "video-rect-cover-mirrored",
    handDetectionConfidence: 0.22,
    handPresenceConfidence: 0.20,
    handTrackingConfidence: 0.20,
    trackingDetectIntervalMs: 76,
    searchDetectIntervalMs: 56,
    visualGraceMs: 650,
    inputGraceMs: 320,
    timerPausesAfterLossMs: 1000,
    pointerHidesAfterLossMs: 2200,
    stableFramesInitial: 2,
    stableFramesReacquire: 2,
    detectorWatchdogNoAttemptMs: 2000,
    detectorWatchdogNoSuccessMs: 6500,
    detectorRecoveryCooldownMs: 3000,
    automaticDetectorRecovery: true,
    automaticCameraConstraintFallback: true,
    cameraReleasedOnPageExit: true,
    trackingHysteresis: true,
    adaptiveReacquisitionResolution: true,
    transientLossDoesNotFlashGate: true,
    repeatedMotionGuard: true,
    returnMovementRequiredBetweenStrokes: true,
    plaqueTargetsRequireSpatialHit: true,
    plaqueReducesPerValidStroke: true,
    lowerZoneMobileSafeArea: true,
    timerPausesWhenTrackingLost: true,
    markerBrushSameCoordinate: true,
    touchFallbackEnabled: false,
    zonePositionAssist: false,
    renderInterpolation: "three-sample-fast-rAF-follow",
    detectionScheduler: "adaptive-throttled-independent-loop",
    architecture: "standalone-classroom-challenge-multi-plaque-with-camera-recovery-entry"
  },
  teacherPin: "",
  routes: {
    pretest: "./assessment/pretest.html",
    posttest: "./assessment/posttest.html",
    reflection: "./assessment/reflection.html",
    certificate: "./assessment/certificate.html"
  },
  missionProfiles: {
    CLASS_60: {
      label: "Classroom Mission 60 นาที • Mobile Only",
      description: "แต่ละกลุ่มเริ่มคนละฐานและเล่นแต่ละเกมหนึ่งรอบ Toothbrush ใช้ Classroom Challenge สำหรับมือถือ โดยแบ่งช่องปากเป็น 6 โซน โซนด้านข้างมีคราบพลัค 4 จุด และโซนกลางมี 5 จุด รวม 26 จุด ผู้เล่นต้องปัดผ่านคราบให้ถูกทิศทางและเลื่อนแปรงกลับอย่างน้อย 10 px ก่อนเริ่มครั้งถัดไป ระบบจึงวัดทั้ง Direction Accuracy และ Spatial Plaque Coverage ไม่สามารถปัดอยู่ตำแหน่งเดียวเพื่อผ่านทั้งโซนได้ รุ่น V27 เพิ่มการเปิดกล้องแบบสามระดับ constraints fallback การคืนกล้องเมื่อออกจากหน้า และข้อความแนะนำเฉพาะกรณีกล้องถูกแท็บหรือแอปอื่นใช้งาน ระบบยังใช้ Tracking Hysteresis, Adaptive Reacquisition และ Recovery Watchdog เล่นหนึ่งรอบถือว่าจบภารกิจโดยไม่บังคับ Retry พร้อมเก็บ Plaque Target, Precision, Direction, Tracking, Reacquire และ Recovery เป็น Learning Analytics",
      games: { hygiene: ["handwash", "toothbrush"], nutrition: ["groups", "goodjunk"], fitness: ["jumpduck", "balance-hold"] }
    },
    FULL_PLATFORM: {
      label: "HeroHealth Full Platform",
      description: "คลังเกมทั้งหมดสำหรับการพัฒนาในอนาคต ไม่ใช้ใน Classroom Mode v1",
      games: { hygiene: ["handwash", "toothbrush", "bath", "maskcough", "clean-objects", "germ-detective"], nutrition: ["groups", "goodjunk", "hydration", "balanced-plate"], fitness: ["jumpduck", "rhythm-boxer", "balance-hold", "shadow-breaker"] }
    }
  },
  activeMissionProfile: "CLASS_60",
  zones: [
    {
      id: "hygiene", label: "Hygiene Hero", thai: "ฐานสุขอนามัย", emoji: "🧼", accent: "#0ea5e9", description: "ฝึกสุขอนามัยที่จำเป็นในชีวิตประจำวัน",
      games: [
        { id:"handwash", title:"Handwash Realistic AR", thai:"Handwash AR", url:"./classroom-contract-wrapper.html?wrappedGame=handwash&v=20260729-handwash-mobile-fullviewport-r37", status:"qa-mobile-fullviewport-r37-camera-r36-step-guide-r33-summary-r34", requiredReturnContract:true, qaClosed:false, progressionByCompletion:true },
        { id:"toothbrush", title:"Toothbrush Classroom Challenge", thai:"Toothbrush Challenge", url:"./toothbrush-classroom-challenge-v27.html?v=20260729-camera-recovery-v27", status:"qa-multi-plaque-camera-recovery-v27", requiredReturnContract:true, progressionByCompletion:true, settingsVisible:false, oneRoundCompletes:true, retryRequired:false },
        { id:"bath", title:"Bath AR", thai:"ภารกิจอาบน้ำ", url:"../herohealth/hygiene-zone/bath-ar-v5.html", status:"catalog-only", requiredReturnContract:true },
        { id:"maskcough", title:"Mask & Cough", thai:"ภารกิจป้องกันไอจาม", url:"../herohealth/maskcough-v2.html", status:"catalog-only", requiredReturnContract:true },
        { id:"clean-objects", title:"Clean Objects", thai:"ภารกิจทำความสะอาดสิ่งของ", url:"../herohealth/clean-objects-v3/clean-objects.html", status:"catalog-only", requiredReturnContract:true },
        { id:"germ-detective", title:"Germ Detective", thai:"นักสืบเชื้อโรค", url:"../herohealth/germ-detective.html", status:"catalog-only", requiredReturnContract:true }
      ]
    },
    {
      id: "nutrition", label: "Nutrition Hero", thai: "ฐานโภชนาการ", emoji: "🥗", accent: "#22c55e", description: "จำแนกอาหารและเลือกอาหารที่เหมาะสม",
      games: [
        { id:"groups", title:"Food Groups AR", thai:"Groups AR", url:"./classroom-contract-wrapper.html?wrappedGame=groups&v=20260725-wrapper2", status:"classroom-core-wrapper-v2", requiredReturnContract:true },
        { id:"goodjunk", title:"GoodJunk AR", thai:"GoodJunk AR", url:"./classroom-contract-wrapper.html?wrappedGame=goodjunk&v=20260725-wrapper2", status:"classroom-core-wrapper-v2", requiredReturnContract:true },
        { id:"hydration", title:"Hydration", thai:"ภารกิจพิทักษ์น้ำ", url:"../herohealth/hydration-v2.html", status:"catalog-only", requiredReturnContract:true },
        { id:"balanced-plate", title:"Balanced Plate", thai:"ภารกิจจานสุขภาพ", url:"../herohealth/plate/plate-launcher.html", status:"catalog-only", requiredReturnContract:true }
      ]
    },
    {
      id: "fitness", label: "Fitness Hero", thai: "ฐานการเคลื่อนไหว", emoji: "🏃", accent: "#f97316", description: "ฝึกการตอบสนองและการทรงตัวอย่างปลอดภัย",
      games: [
        { id:"jumpduck", title:"JumpDuck Dash AR", thai:"JumpDuck Dash", url:"../fitness/jumpduck-classroom-v26-ar.html?v=20260729-kid-easy-v35", status:"classroom-core-kid-easy-v3.5-sticky-step-lane", requiredReturnContract:true },
        { id:"rhythm-boxer", title:"Rhythm Boxer AR", thai:"ชกตามจังหวะ", url:"../fitness/rhythm-boxer-ar.html", status:"catalog-only", requiredReturnContract:true },
        { id:"balance-hold", title:"Balance Hold AR", thai:"Balance Hold AR", url:"../fitness/balance-hold-ar2.html?classroom=1&mode=classroom&source=herohealth&v=20260725-classroom-autostart-v30", status:"classroom-core-autostart-v30-auto-submit", requiredReturnContract:true },
        { id:"shadow-breaker", title:"Shadow Breaker AR", thai:"ตอบสนองและเคลื่อนไหว", url:"../fitness/shadow-breaker-ar.html", status:"catalog-only", requiredReturnContract:true }
      ]
    }
  ],
  rotation: {
    A:["hygiene","nutrition","fitness"], B:["nutrition","fitness","hygiene"], C:["fitness","hygiene","nutrition"], D:["hygiene","fitness","nutrition"], E:["nutrition","hygiene","fitness"], F:["fitness","nutrition","hygiene"], G:["hygiene","nutrition","fitness"], H:["nutrition","fitness","hygiene"], I:["fitness","hygiene","nutrition"], J:["hygiene","fitness","nutrition"]
  }
};