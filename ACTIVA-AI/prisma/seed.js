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
    { employeeId: "ORG001", name: "บุคลากรตัวอย่าง (ได้รับสิทธิ์จัดกิจกรรม)", role: "ORGANIZER" },
    { employeeId: "STF001", name: "ผู้ตรวจสอบหลักฐานตัวอย่าง", role: "STAFF" },
    { employeeId: "P001", name: "บุคลากรผู้เข้าร่วมตัวอย่าง 1", role: "PARTICIPANT" },
    { employeeId: "P002", name: "บุคลากรผู้เข้าร่วมตัวอย่าง 2", role: "PARTICIPANT" },
    { employeeId: "P003", name: "บุคลากรผู้เข้าร่วมตัวอย่าง 3", role: "PARTICIPANT" },
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

  const organizerPermissions = [
    "CAN_CREATE_ACTIVITY",
    "CAN_EDIT_OWN_ACTIVITY",
    "CAN_ASSIGN_CO_ORGANIZER",
    "CAN_ASSIGN_VERIFIER",
    "CAN_CLOSE_ACTIVITY",
  ];

  for (const permission of organizerPermissions) {
    await prisma.userActivityPermission.upsert({
      where: {
        userId_permission: {
          userId: users.ORG001.id,
          permission,
        },
      },
      update: {
        revokedAt: null,
        revokedById: null,
        revokeReason: null,
        validFrom: null,
        validUntil: null,
        reason: "Demo organizer permission seed",
        grantedById: users.ADM001.id,
      },
      create: {
        userId: users.ORG001.id,
        permission,
        grantedById: users.ADM001.id,
        reason: "Demo organizer permission seed",
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
