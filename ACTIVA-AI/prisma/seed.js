import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const department = await prisma.department.upsert({
    where: { code: "SCI" },
    update: { name: "คณะวิทยาศาสตร์" },
    create: { code: "SCI", name: "คณะวิทยาศาสตร์" },
  });

  const demoUsers = [
    { employeeId: "ADM001", name: "ผู้ดูแลระบบตัวอย่าง", role: "ADMIN" },
    { employeeId: "ORG001", name: "ผู้จัดกิจกรรมตัวอย่าง", role: "ORGANIZER" },
    { employeeId: "STF001", name: "เจ้าหน้าที่ตรวจสอบตัวอย่าง", role: "STAFF" },
    { employeeId: "P001", name: "ผู้เข้าร่วมตัวอย่าง 1", role: "PARTICIPANT" },
    { employeeId: "P002", name: "ผู้เข้าร่วมตัวอย่าง 2", role: "PARTICIPANT" },
    { employeeId: "P003", name: "ผู้เข้าร่วมตัวอย่าง 3", role: "PARTICIPANT" },
  ];

  const users = {};
  for (const item of demoUsers) {
    users[item.employeeId] = await prisma.user.upsert({
      where: { employeeId: item.employeeId },
      update: {
        name: item.name,
        role: item.role,
        departmentId: department.id,
        status: "ACTIVE",
      },
      create: {
        employeeId: item.employeeId,
        name: item.name,
        role: item.role,
        departmentId: department.id,
        status: "ACTIVE",
      },
    });
  }

  const existing = await prisma.activity.findFirst({
    where: { title: "อบรมการใช้ AI อย่างรับผิดชอบ" },
  });

  if (!existing) {
    const startAt = new Date();
    startAt.setHours(9, 0, 0, 0);
    const endAt = new Date();
    endAt.setHours(16, 0, 0, 0);

    await prisma.activity.create({
      data: {
        title: "อบรมการใช้ AI อย่างรับผิดชอบ",
        category: "พัฒนาบุคลากร",
        description: "กิจกรรมตัวอย่างสำหรับทดสอบ ACTIVA-AI",
        location: "ห้องประชุมคณะ",
        startAt,
        endAt,
        organizerId: users.ORG001.id,
        policy: {
          create: {
            qrRequired: true,
            identityRequired: true,
            checkinRequired: true,
            checkoutRequired: true,
            durationRequired: true,
            staffRequired: true,
            signatureRequired: false,
            minDurationRatio: 0.75,
          },
        },
      },
    });
  }

  console.log("ACTIVA-AI demo seed completed.");
  console.log("Use x-activa-user-id headers: ADM001, ORG001, STF001, P001, P002, P003");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
