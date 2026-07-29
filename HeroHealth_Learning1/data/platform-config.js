window.HH_CONFIG = {
  platformVersion: "2026.07-CLASSROOM60-HANDWASH-R40-TOOTHBRUSH-V27-PASSPORT-R2-JUMPDUCK-V39-BALANCE-ADAPTIVE-V34",
  appName: "HeroHealth Learning Platform",
  deploymentState: "QA_HANDWASH_GRADE5_ADAPTIVE_R40_TOOTHBRUSH_JUMPDUCK_RETURN_STANDARD_R2_JUMPDUCK_OUTCOME_WORDING_V39_BALANCE_WIDE_CAMERA_KNEE_CALIBRATION_V34",
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
  handwashContract: {
    requiredRubSteps: 7,
    requiredProcessSteps: 5,
    requiredTotalSteps: 12,
    requireWrists: true,
    requireAnalyticsReceipt: true,
    progressionByCompletion: true,
    completionPolicy: "grade5-adaptive-complete-12-steps-skill-separate",
    durationSec: 120,
    difficulty: "easy",
    adaptiveAssistAfterSec: { calibration: 7, rub: 7.5, process: 8 },
    skillOutcomeSeparateFromCompletion: true,
    forcedReplay: false
  },
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
    studentRetryVisible: false,
    resultPrimaryAction: "return-to-passport",
    returnContract: "jumpduck-compatible-passport-return-v1",
    returnQuerySupport: ["return", "back"],
    returnIdentityCarry: ["studentId", "sid", "pid", "fullName", "studentName", "name", "section", "group"],
    authorityRefreshOnReturn: true,
    skillThresholds: { coverageZones: 6, directionAccuracyPct: 55, precisionAccuracyPct: 70, trackingQualityPct: 60 },
    input: "index-finger-only",
    trackingProfile: "adaptive-hysteresis-reacquire-v24",
    motionProfile: "multi-plaque-spatial-coverage-v27-passport-return-r2",
    cameraProfile: "mobile-three-stage-constraints-fallback-release-v1",
    plaqueVariantCount: 4,
    plaqueVariantPolicy: "four-balanced-visuals-equal-hitbox",
    plaqueVariantRandomization: false,
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
    architecture: "standalone-classroom-challenge-multi-plaque-camera-recovery-balanced-visual-variety-jumpduck-return-standard"
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
      description: "แต่ละกลุ่มเริ่มคนละฐานและเล่นแต่ละเกมหนึ่งรอบ Handwash R40 ใช้ Grade 5 Adaptive Easy ระยะเวลา 120 วินาที แยกการจบภารกิจออกจากผลทักษะ ระบบช่วยเลื่อนไปขั้นถัดไปเมื่อเด็กติดอยู่กับท่าเดิมนานเกินไป แต่ยังเก็บ Accuracy, Pass Mode, Auto Assist, Tracking และหลักฐานรายขั้นไว้ครบสำหรับการวิเคราะห์ โดยไม่บังคับเล่นซ้ำ Toothbrush ใช้ Classroom Challenge สำหรับมือถือ แบ่งช่องปากเป็น 6 โซนและมีคราบพลัค 26 จุด ใช้คราบ 4 รูปแบบที่มี Hit Area และเกณฑ์ผ่านเท่ากัน ระบบวัด Direction Accuracy และ Spatial Plaque Coverage พร้อม Camera Recovery และ Tracking Analytics รุ่น Passport Return R2 ยกเลิกปุ่มฝึกเพิ่มใน Student Classroom Mode เหลือปุ่มกลับ Passport เพียงปุ่มเดียว และใช้ Return Contract มาตรฐานเดียวกับ JumpDuck ได้แก่เรียกปุ่มของ Wrapper ก่อน รองรับ return/back URL ส่งต่อข้อมูลนักเรียน กำหนด fromGame และสั่ง authorityRefresh เพื่อโหลดสถานะล่าสุดจาก Google Sheet",
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
        { id:"handwash", title:"Handwash Grade 5 Adaptive", thai:"Handwash AR", url:"./classroom-contract-wrapper.html?wrappedGame=handwash&diff=easy&time=120&roundMode=standard&v=20260729-handwash-grade5-adaptive-r40", status:"qa-grade5-adaptive-r40-completion-skill-separate", requiredReturnContract:true, qaClosed:false, progressionByCompletion:true, oneRoundCompletes:true, retryRequired:false },
        { id:"toothbrush", title:"Toothbrush Classroom Challenge", thai:"Toothbrush Challenge", url:"./toothbrush-classroom-challenge-v27.html?v=20260729-passport-return-r2", status:"qa-multi-plaque-jumpduck-compatible-passport-return-v27-r2", requiredReturnContract:true, progressionByCompletion:true, settingsVisible:false, oneRoundCompletes:true, retryRequired:false, studentRetryVisible:false },
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
        { id:"jumpduck", title:"JumpDuck Dash AR", thai:"JumpDuck Dash", url:"../fitness/jumpduck-classroom-v26-ar.html?v=20260729-outcome-wording-v39", status:"classroom-core-direct-body-v3.9-round-complete-mission-outcome-separated", requiredReturnContract:true },
        { id:"rhythm-boxer", title:"Rhythm Boxer AR", thai:"ชกตามจังหวะ", url:"../fitness/rhythm-boxer-ar.html", status:"catalog-only", requiredReturnContract:true },
        { id:"balance-hold", title:"Balance Hold AR", thai:"Balance Hold AR", url:"../fitness/balance-hold-ar2.html?classroom=1&mode=classroom&source=herohealth&v=20260729-balance-adaptive-v34", status:"classroom-core-autostart-v34-wide-4x3-knee-calibration", requiredReturnContract:true },
        { id:"shadow-breaker", title:"Shadow Breaker AR", thai:"ตอบสนองและเคลื่อนไหว", url:"../fitness/shadow-breaker-ar.html", status:"catalog-only", requiredReturnContract:true }
      ]
    }
  ],
  rotation: {
    A:["hygiene","nutrition","fitness"], B:["nutrition","fitness","hygiene"], C:["fitness","hygiene","nutrition"], D:["hygiene","fitness","nutrition"], E:["nutrition","hygiene","fitness"], F:["fitness","nutrition","hygiene"], G:["hygiene","nutrition","fitness"], H:["nutrition","fitness","hygiene"], I:["fitness","hygiene","nutrition"], J:["hygiene","fitness","nutrition"]
  }
};
