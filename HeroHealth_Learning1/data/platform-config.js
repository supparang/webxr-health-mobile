window.HH_CONFIG = {
  platformVersion: "2026.07-PRODUCTION-RC2-GAME-CATALOG",
  appName: "HeroHealth Learning Platform",
  deploymentState: "LOCKED_FOR_STUDENT_QA",
  sourceOfTruthMode: "roster-guarded-frontend",
  allowUnknownStudent: false,
  allowStudentGroupSelection: false,
  allowPrototypeCompletion: false,
  classroomMinutes: 60,
  stationMinutes: 10,
  transitionMinutes: 2,
  passingScore: 70,
  teacherPin: "",
  routes: {
    pretest: "#pretest",
    posttest: "#posttest",
    reflection: "#reflection",
    certificate: "#certificate"
  },
  missionProfiles: {
    CLASS_60: {
      label: "คาบเรียน 60 นาที",
      description: "ใช้เกมแกนหลักรายฐาน ส่วนเกมอื่นคงอยู่ในคลังสำหรับคาบต่อไปหรือกิจกรรมเสริม",
      games: {
        hygiene: ["handwash"],
        nutrition: ["groups", "goodjunk"],
        fitness: ["jumpduck", "rhythm-boxer"]
      }
    },
    FULL_PLATFORM: {
      label: "HeroHealth Full Platform",
      description: "เส้นทางเต็มทุกเกม ใช้หลายคาบหรือกิจกรรมทั้งวัน",
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
      id: "hygiene",
      label: "Hygiene Hero",
      thai: "ฐานสุขอนามัย",
      emoji: "🧼",
      accent: "#0ea5e9",
      description: "ล้างมือ ดูแลช่องปากและร่างกาย ป้องกันเชื้อโรค และดูแลสิ่งแวดล้อมรอบตัว",
      games: [
        { id:"handwash", title:"Handwash Realistic AR", thai:"ภารกิจล้างมือ", url:"../herohealth/hygiene-zone/handwash-realistic-v3.html", status:"provided-production", requiredReturnContract:true },
        { id:"toothbrush", title:"Toothbrush AR", thai:"ภารกิจแปรงฟัน", url:"../herohealth/vr-brush-kids/brush-launcher.html", status:"needs-qa", requiredReturnContract:true },
        { id:"bath", title:"Bath AR", thai:"ภารกิจอาบน้ำ", url:"../herohealth/hygiene-zone/bath-ar-v5.html", status:"needs-qa", requiredReturnContract:true },
        { id:"maskcough", title:"Mask & Cough", thai:"ภารกิจป้องกันไอจาม", url:"../herohealth/maskcough-v2.html", status:"needs-qa", requiredReturnContract:true },
        { id:"clean-objects", title:"Clean Objects", thai:"ภารกิจทำความสะอาดสิ่งของ", url:"../herohealth/clean-objects-v3/clean-objects.html", status:"needs-qa", requiredReturnContract:true },
        { id:"germ-detective", title:"Germ Detective", thai:"นักสืบเชื้อโรค", url:"../herohealth/germ-detective.html", status:"needs-qa", requiredReturnContract:true }
      ]
    },
    {
      id: "nutrition",
      label: "Nutrition Hero",
      thai: "ฐานโภชนาการ",
      emoji: "🥗",
      accent: "#22c55e",
      description: "จำแนกอาหาร เลือกอาหาร ดื่มน้ำ และจัดจานสุขภาพ",
      games: [
        { id:"groups", title:"Food Groups AR", thai:"ภารกิจอาหาร 5 หมู่", url:"../herohealth/groups-ar-gate.html", status:"provided-production", requiredReturnContract:true },
        { id:"goodjunk", title:"GoodJunk AR", thai:"ภารกิจเลือกอาหารดี", url:"../herohealth/goodjunk-ar-mobile-v10.html", status:"provided-production", requiredReturnContract:true },
        { id:"hydration", title:"Hydration", thai:"ภารกิจพิทักษ์น้ำ", url:"../herohealth/hydration-v2.html", status:"needs-qa", requiredReturnContract:true },
        { id:"balanced-plate", title:"Balanced Plate", thai:"ภารกิจจานสุขภาพ", url:"../herohealth/plate/plate-launcher.html", status:"needs-qa", requiredReturnContract:true }
      ]
    },
    {
      id: "fitness",
      label: "Fitness Hero",
      thai: "ฐานการเคลื่อนไหว",
      emoji: "🏃",
      accent: "#f97316",
      description: "เคลื่อนไหว ทรงตัว ประสานสัมพันธ์ และตอบสนองอย่างปลอดภัย",
      games: [
        { id:"jumpduck", title:"JumpDuck AR", thai:"กระโดดและหลบ", url:"../fitness/jumpduck-ar.html", status:"provided-production", requiredReturnContract:true },
        { id:"rhythm-boxer", title:"Rhythm Boxer AR", thai:"ชกตามจังหวะ", url:"../fitness/rhythm-boxer-ar.html", status:"provided-production", requiredReturnContract:true },
        { id:"balance-hold", title:"Balance Hold AR", thai:"ฝึกการทรงตัว", url:"../fitness/balance-hold-ar2.html", status:"provided-production", requiredReturnContract:true },
        { id:"shadow-breaker", title:"Shadow Breaker AR", thai:"ตอบสนองและเคลื่อนไหว", url:"../fitness/shadow-breaker-ar.html", status:"provided-production", requiredReturnContract:true }
      ]
    }
  ],
  rotation: {
    A:["hygiene","nutrition","fitness"], B:["nutrition","fitness","hygiene"], C:["fitness","hygiene","nutrition"],
    D:["hygiene","fitness","nutrition"], E:["nutrition","hygiene","fitness"], F:["fitness","nutrition","hygiene"],
    G:["hygiene","nutrition","fitness"], H:["nutrition","fitness","hygiene"], I:["fitness","hygiene","nutrition"],
    J:["hygiene","fitness","nutrition"]
  }
};