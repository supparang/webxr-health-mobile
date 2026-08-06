import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, "service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ ไม่พบ service-account.json ใน tools/herohealth-admin");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(serviceAccount), projectId: "herohealth-learning" });
const db = getFirestore(app);

const students = [
  { studentId: "990015", fullName: "Production Test Student 15", section: "QA-P5", group: "A" },
  { studentId: "990016", fullName: "Production Test Student 16", section: "QA-P5", group: "B" },
  { studentId: "990017", fullName: "Production Test Student 17", section: "QA-P5", group: "C" }
];

async function seedStudent(student) {
  const sid = student.studentId;
  const rosterRef = db.collection("studentsSandbox").doc(sid);
  const progressRef = db.collection("studentProgressSandbox").doc(sid);

  await rosterRef.set({
    ...student,
    classId: student.section,
    rotationGroup: student.group,
    active: true,
    testAccount: true,
    authority: "firebase-sandbox",
    seededAt: FieldValue.serverTimestamp(),
    seededBy: "tools/herohealth-admin/seed-sandbox-students.mjs"
  }, { merge: true });

  const progressSnapshot = await progressRef.get();
  if (!progressSnapshot.exists) {
    await progressRef.set({
      studentId: sid,
      currentStep: "pretest",
      currentZone: "hygiene",
      progressPct: 0,
      completedCount: 0,
      pretestCompleted: false,
      posttestCompleted: false,
      reflectionCompleted: false,
      certificateEligible: false,
      gameCompleted: {
        hygiene: {},
        nutrition: {},
        fitness: {}
      },
      gameResults: {},
      assessments: {},
      completed: {
        pretest: false,
        hygiene: false,
        nutrition: false,
        fitness: false,
        posttest: false,
        reflection: false
      },
      testScenario: sid === "990015" ? "new-student" : sid === "990016" ? "resume-mid-flow" : "complete-flow",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      build: "20260806-SANDBOX-THREE-STUDENT-SEED-R1"
    });
  }

  console.log(`✅ ${sid} ${student.fullName} → studentsSandbox + studentProgressSandbox`);
}

async function main() {
  console.log("กำลังสร้างผู้เรียนทดสอบ HeroHealth Sandbox 3 คน…");
  for (const student of students) await seedStudent(student);
  console.log("\n✅ สร้างครบแล้ว: 990015, 990016, 990017");
  console.log("หมายเหตุ: สคริปต์จะไม่ล้าง progress เดิม หากเอกสารมีอยู่แล้ว");
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("❌ Seed ไม่สำเร็จ:", error);
  process.exit(1);
});