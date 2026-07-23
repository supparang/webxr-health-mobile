window.HH_CONFIG = {
  platformVersion: "2026.07-CLASSROOM60-PRODUCTION-CANONICAL-FLOW-V1",
  appName: "HeroHealth Learning Platform",
  deploymentState: "QA_TEST_OPEN",
  sourceOfTruthMode: "qa-roster-guarded-frontend",
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
      description: "ทุกกลุ่มใช้ลำดับเดียวกัน เกมละหนึ่งรอบ ไม่บังคับผ่าน ไม่มี Retry และไม่มี Boss",
      games: {
        hygiene: ["handwash", "toothbrush"],
        nutrition: ["groups", "goodjunk"],
        fitness: ["jumpduck", "balance-hold"]
      }
    },
    FULL_PLATFORM: {
      label: "HeroHealth Full Platform",
      description: "คลังเกมทั้งหมดสำหรับการพัฒนาในอนาคต ไม่ใช้ใน Classroom Mode v1",
      games: {
        hygiene: ["handwash", "toothbrush", "bath", "maskcough", "clean-objects", "germ-detective"],
        nutrition: ["groups", "goodjunk", "hydration", "balanced-plate"],
        fitness: ["jumpduck", "rhythm-boxer", "balance-hold", "shadow-breaker"]
      }
    }
  },
  activeMissionProfile: "CLASS_60",
  zones: [
    {
      id: "hygiene", label: "Hygiene Hero", thai: "ฐานสุขอนามัย", emoji: "🧼", accent: "#0ea5e9",
      description: "ฝึกสุขอนามัยที่จำเป็นในชีวิตประจำวัน",
      games: [
        { id:"handwash", title:"Handwash Realistic AR", thai:"Handwash AR", url:"../herohealth/hygiene-zone/handwash-realistic-v3.html", status:"classroom-core", requiredReturnContract:true },
        { id:"toothbrush", title:"Toothbrush Hero AR", thai:"Toothbrush AR", url:"../herohealth/hygiene-zone/toothbrush-ar.html?mode=learning&diff=easy&time=90&classroom=1", status:"classroom-core-ar-v3", requiredReturnContract:true },
        { id:"bath", title:"Bath AR", thai:"ภารกิจอาบน้ำ", url:"../herohealth/hygiene-zone/bath-ar-v5.html", status:"catalog-only", requiredReturnContract:true },
        { id:"maskcough", title:"Mask & Cough", thai:"ภารกิจป้องกันไอจาม", url:"../herohealth/maskcough-v2.html", status:"catalog-only", requiredReturnContract:true },
        { id:"clean-objects", title:"Clean Objects", thai:"ภารกิจทำความสะอาดสิ่งของ", url:"../herohealth/clean-objects-v3/clean-objects.html", status:"catalog-only", requiredReturnContract:true },
        { id:"germ-detective", title:"Germ Detective", thai:"นักสืบเชื้อโรค", url:"../herohealth/germ-detective.html", status:"catalog-only", requiredReturnContract:true }
      ]
    },
    {
      id: "nutrition", label: "Nutrition Hero", thai: "ฐานโภชนาการ", emoji: "🥗", accent: "#22c55e",
      description: "จำแนกอาหารและเลือกอาหารที่เหมาะสม",
      games: [
        { id:"groups", title:"Food Groups AR", thai:"Groups AR", url:"../herohealth/groups-ar-gate.html", status:"classroom-core", requiredReturnContract:true },
        { id:"goodjunk", title:"GoodJunk AR", thai:"GoodJunk AR", url:"../herohealth/goodjunk-ar-v11.html", status:"classroom-core", requiredReturnContract:true },
        { id:"hydration", title:"Hydration", thai:"ภารกิจพิทักษ์น้ำ", url:"../herohealth/hydration-v2.html", status:"catalog-only", requiredReturnContract:true },
        { id:"balanced-plate", title:"Balanced Plate", thai:"ภารกิจจานสุขภาพ", url:"../herohealth/plate/plate-launcher.html", status:"catalog-only", requiredReturnContract:true }
      ]
    },
    {
      id: "fitness", label: "Fitness Hero", thai: "ฐานการเคลื่อนไหว", emoji: "🏃", accent: "#f97316",
      description: "ฝึกการตอบสนองและการทรงตัวอย่างปลอดภัย",
      games: [
        { id:"jumpduck", title:"JumpDuck AR", thai:"JumpDuck AR", url:"../fitness/jumpduck-ar.html", status:"classroom-core", requiredReturnContract:true },
        { id:"rhythm-boxer", title:"Rhythm Boxer AR", thai:"ชกตามจังหวะ", url:"../fitness/rhythm-boxer-ar.html", status:"catalog-only", requiredReturnContract:true },
        { id:"balance-hold", title:"Balance Hold AR", thai:"Balance Hold AR", url:"../fitness/balance-hold-ar2.html", status:"classroom-core", requiredReturnContract:true },
        { id:"shadow-breaker", title:"Shadow Breaker AR", thai:"ตอบสนองและเคลื่อนไหว", url:"../fitness/shadow-breaker-ar.html", status:"catalog-only", requiredReturnContract:true }
      ]
    }
  ],
  rotation: {
    A:["hygiene","nutrition","fitness"],
    B:["hygiene","nutrition","fitness"],
    C:["hygiene","nutrition","fitness"],
    D:["hygiene","nutrition","fitness"],
    E:["hygiene","nutrition","fitness"],
    F:["hygiene","nutrition","fitness"],
    G:["hygiene","nutrition","fitness"],
    H:["hygiene","nutrition","fitness"],
    I:["hygiene","nutrition","fitness"],
    J:["hygiene","nutrition","fitness"]
  }
};
