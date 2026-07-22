window.HH_CONFIG = {
  platformVersion: "2026.07-PRODUCTION-RC1",
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
  zones: [
    { id:"hygiene", label:"Hygiene Hero", thai:"ฐานสุขอนามัย", emoji:"🧼", accent:"#0ea5e9", description:"ล้างมือ ป้องกันเชื้อโรค ดูแลช่องปากและร่างกาย", gameUrl:"../hygiene/hub.html" },
    { id:"nutrition", label:"Nutrition Hero", thai:"ฐานโภชนาการ", emoji:"🥗", accent:"#22c55e", description:"เลือกอาหาร จัดกลุ่มอาหาร ดื่มน้ำ และจัดจานสุขภาพ", gameUrl:"../nutrition/hub.html" },
    { id:"fitness", label:"Fitness Hero", thai:"ฐานการเคลื่อนไหว", emoji:"🏃", accent:"#f97316", description:"อบอุ่นร่างกาย ทรงตัว เคลื่อนไหว และผ่อนร่างกาย", gameUrl:"../fitness/hub.html" }
  ],
  rotation: {
    A:["hygiene","nutrition","fitness"], B:["nutrition","fitness","hygiene"], C:["fitness","hygiene","nutrition"],
    D:["hygiene","fitness","nutrition"], E:["nutrition","hygiene","fitness"], F:["fitness","nutrition","hygiene"],
    G:["hygiene","nutrition","fitness"], H:["nutrition","fitness","hygiene"], I:["fitness","hygiene","nutrition"],
    J:["hygiene","fitness","nutrition"]
  }
};
