window.HH_CONFIG = {
  platformVersion: "2026.07-CLASSROOM60-TOOTHBRUSH-STABLE-V24",
  appName: "HeroHealth Learning Platform",
  deploymentState: "QA_TOOTHBRUSH_ADAPTIVE_HYSTERESIS_REACQUIRE",
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
    durationSec: 90,
    zones: 6,
    settingsVisible: false,
    progressionByCompletion: true,
    completionPolicy: "one-classroom-challenge-round-completes-no-forced-retry",
    retryRequired: false,
    skillThresholds: { coverageZones: 6, directionAccuracyPct: 45, trackingQualityPct: 60 },
    input: "index-finger-only",
    trackingProfile: "adaptive-hysteresis-reacquire-v24",
    cameraProfile: "320x240-24fps",
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
    trackingHysteresis: true,
    adaptiveReacquisitionResolution: true,
    transientLossDoesNotFlashGate: true,
    lowerZoneMobileSafeArea: true,
    timerPausesWhenTrackingLost: true,
    markerBrushSameCoordinate: true,
    touchFallbackEnabled: false,
    zonePositionAssist: false,
    renderInterpolation: "three-sample-fast-rAF-follow",
    detectionScheduler: "adaptive-throttled-independent-loop",
    architecture: "single-standalone-classroom-challenge-with-hysteresis"
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
      description: "แต่ละกลุ่มเริ่มคนละฐานและเล่นแต่ละเกมหนึ่งรอบ Toothbrush ใช้ Classroom Challenge โหมดเดียวสำหรับมือถือ V24 ไม่เปลี่ยนสถานะจากการพลาดเพียงไม่กี่เฟรม: วงและแปรงค้างแบบจางช่วงสั้นโดยไม่แสดงหน้าบังเกม หยุดการนับ Stroke เมื่อผลไม่สด และหยุดเวลาเมื่อ Tracking หลุดจริง ระบบใช้ภาพ 256×192 ระหว่างติดตามเพื่อลดภาระ และเพิ่มเป็น 320×240 ชั่วคราวเมื่อค้นหานิ้วใหม่ พร้อม Recovery Watchdog เล่นหนึ่งรอบถือว่าจบภารกิจโดยไม่บังคับ Retry ส่วน Coverage, Direction Accuracy, Tracking, Transient Miss, Reacquire Latency, Recovery Count, Detection FPS และ Render FPS เก็บเป็น Learning Analytics",
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
        { id:"handwash", title:"Handwash Realistic AR", thai:"Handwash AR", url:"./classroom-contract-wrapper.html?wrappedGame=handwash&v=20260727-complete7-r30", status:"qa-complete-7-rub-12-phase-r30", requiredReturnContract:true, qaClosed:true, progressionByCompletion:true },
        { id:"toothbrush", title:"Toothbrush Classroom Challenge", thai:"Toothbrush Challenge", url:"./toothbrush-classroom-challenge-v24.html?v=20260728-stable-v24", status:"qa-adaptive-hysteresis-reacquire-v24", requiredReturnContract:true, progressionByCompletion:true, settingsVisible:false, oneRoundCompletes:true, retryRequired:false },
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
        { id:"jumpduck", title:"JumpDuck Dash AR", thai:"JumpDuck Dash", url:"../fitness/jumpduck-classroom-v26-ar.html?v=20260725-production-v33-classroom-final", status:"classroom-core-production-v3.3-auto-submit-final", requiredReturnContract:true },
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