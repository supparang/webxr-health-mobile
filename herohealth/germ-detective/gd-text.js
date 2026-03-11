// === /herohealth/germ-detective/gd-text.js ===
// Germ Detective UI Text Pack
// PATCH v20260310-GD-TEXT-PACK
// ใช้ได้ทั้ง PC / Mobile / cVR

export const GD_TEXT = {
  title: "Germ Detective",
  titleTH: "นักสืบเชื้อโรค",
  subtitle: "ค้นหาจุดแพร่เชื้อ เก็บหลักฐาน และหยุดการแพร่กระจายก่อนหมดเวลา",

  intro: {
    short: "มีเชื้อโรคซ่อนอยู่ในพื้นที่นี้ รีบหาจุดเสี่ยง เก็บหลักฐาน และทำให้พื้นที่ปลอดภัยอีกครั้ง",
    medium: "พื้นที่นี้มีจุดสัมผัสร่วมหลายแห่งที่อาจเป็นแหล่งแพร่เชื้อ ใช้เครื่องมือของคุณให้คุ้มที่สุด แล้วหยุดการแพร่กระจายก่อนหมดเวลา",
    story: "รับภารกิจนักสืบสุขอนามัย ตรวจหาต้นตอการแพร่เชื้อและปิดคดีให้สำเร็จ"
  },

  objective: {
    main: "ภารกิจ: ลดความเสี่ยงของพื้นที่ให้ถึงระดับปลอดภัยก่อนหมดเวลา",
    sub: "ตรวจหาจุดเสี่ยงหลัก • ยืนยันหลักฐาน • ทำความสะอาดจุดสำคัญ",
    compact: "หา • ตรวจ • ยืนยัน • Clean"
  },

  hud: {
    time: "เวลา",
    risk: "ความเสี่ยงพื้นที่",
    evidence: "หลักฐาน",
    critical: "จุดเสี่ยงหลัก",
    cleaned: "ทำความสะอาดแล้ว",
    score: "คะแนน",
    tool: "เครื่องมือ",
    scene: "ฉาก",
    phase: "ช่วงภารกิจ"
  },

  phase: {
    search: {
      key: "search",
      title: "Phase 1: Search",
      titleTH: "ค้นหา",
      objective: "ค้นหาจุดน่าสงสัยด้วย UV"
    },
    investigate: {
      key: "investigate",
      title: "Phase 2: Investigate",
      titleTH: "ยืนยันหลักฐาน",
      objective: "ใช้ Swab และ Camera เพื่อยืนยันหลักฐาน"
    },
    stop: {
      key: "stop",
      title: "Phase 3: Stop the Spread",
      titleTH: "หยุดการแพร่เชื้อ",
      objective: "รีบ Clean จุดสำคัญเพื่อลดความเสี่ยงของพื้นที่"
    }
  },

  tools: {
    uv: {
      key: "uv",
      name: "UV Scanner",
      short: "สแกนหาร่องรอย",
      hint: "ใช้เพื่อค้นหาจุดน่าสงสัยและร่องรอยที่ควรตรวจต่อ"
    },
    swab: {
      key: "swab",
      name: "Swab Test",
      short: "ตรวจยืนยันเชื้อ",
      hint: "ใช้เพื่อยืนยันว่าจุดนี้เป็นแหล่งเสี่ยงจริงหรือไม่"
    },
    cam: {
      key: "cam",
      name: "Camera",
      short: "เก็บภาพหลักฐาน",
      hint: "ใช้เก็บภาพหลักฐานของจุดสำคัญ"
    },
    clean: {
      key: "clean",
      name: "Clean",
      short: "ลดความเสี่ยง",
      hint: "ใช้ทำความสะอาดเพื่อลดการแพร่เชื้อของจุดนี้"
    }
  },

  hints: {
    general: [
      "เริ่มจากจุดสัมผัสร่วมก่อน",
      "ของที่หลายคนจับร่วมกันมักเสี่ยงสูง",
      "คุณไม่จำเป็นต้องตรวจทุกจุด",
      "เลือกจุดสำคัญก่อนเพื่อประหยัดเวลา"
    ],
    early: [
      "ลองใช้ UV กับลูกบิด ก๊อกน้ำ โต๊ะ หรือของใช้ร่วม",
      "เริ่มจากของที่หลายคนสัมผัสร่วมกันบ่อย ๆ"
    ],
    mid: [
      "ตอนนี้คุณมีเป้าหมายแล้ว ใช้ Swab หรือ Camera เพื่อยืนยันหลักฐาน",
      "ถ้าเจอจุดน่าสงสัยแล้ว อย่าลืมยืนยันก่อนสรุป"
    ],
    late: [
      "เวลาใกล้หมดแล้ว รีบ Clean จุดที่สำคัญที่สุด",
      "Focus ที่จุดเสี่ยงหลักก่อน อย่าเสียเวลากับจุดรอง"
    ]
  },

  tutorial: [
    {
      step: 1,
      title: "มองหาจุดสัมผัสร่วม",
      body: "เริ่มจากของที่หลายคนใช้ร่วมกัน เช่น ลูกบิด โต๊ะ ก๊อกน้ำ รีโมต หรือช้อนกลาง"
    },
    {
      step: 2,
      title: "ใช้เครื่องมือให้เหมาะ",
      body: "UV ช่วยหาเป้า, Swab ช่วยยืนยัน, Camera ช่วยเก็บหลักฐาน, Clean ช่วยลดความเสี่ยง"
    },
    {
      step: 3,
      title: "จัดการจุดสำคัญก่อน",
      body: "คุณไม่จำเป็นต้องทำทุกจุด เลือกจุดที่มีผลต่อการแพร่เชื้อสูงที่สุดก่อน"
    }
  ],

  feedback: {
    uv: {
      hit: ["พบร่องรอยน่าสงสัย", "จุดนี้ควรตรวจต่อ"],
      miss: ["จุดนี้ยังไม่ใช่เป้าหมายหลัก", "ลองมองหาจุดสัมผัสร่วมอื่น"]
    },
    swab: {
      hit: ["ยืนยันจุดเสี่ยงสำเร็จ", "พบหลักฐานสำคัญ"],
      miss: ["ไม่พบความเสี่ยงเด่นชัด", "ลองตรวจจุดสัมผัสร่วมอื่น"]
    },
    cam: {
      hit: ["บันทึกหลักฐานแล้ว", "เพิ่มข้อมูลในรายงาน"]
    },
    clean: {
      hit: ["ลดความเสี่ยงของจุดนี้แล้ว", "พื้นที่ปลอดภัยขึ้น"]
    },
    generic: {
      smart: ["ตัดสินใจได้ดีมาก", "คุณจัดการจุดสำคัญได้ถูกต้อง"],
      weak: ["ระวังการใช้เวลามากเกินไปกับจุดรอง", "ลองกลับไปมองหาจุดสัมผัสร่วม"]
    },
    warning: {
      lowTime: ["เวลาเหลือน้อยแล้ว", "รีบจัดการจุดเสี่ยงหลักก่อน"],
      highRisk: ["ความเสี่ยงของพื้นที่ยังสูงอยู่", "ยังมีจุดสำคัญที่ไม่ได้จัดการ"],
      lowEvidence: ["หลักฐานยังไม่พอสำหรับสรุปคดี"]
    }
  },

  summary: {
    title: "Mission Report",
    titleTH: "สรุปภารกิจนักสืบเชื้อโรค",
    labels: {
      score: "คะแนนรวม",
      riskDown: "ความเสี่ยงที่ลดลง",
      evidence: "หลักฐานที่เก็บได้",
      criticalFound: "จุดเสี่ยงหลักที่พบ",
      cleaned: "จุดที่ทำความสะอาดแล้ว",
      topTool: "เครื่องมือที่ใช้บ่อยที่สุด"
    },
    result: {
      greatTitle: "คุณหยุดการแพร่เชื้อได้ยอดเยี่ยม",
      greatBody: "คุณระบุจุดเสี่ยงหลักได้แม่นและลดความเสี่ยงของพื้นที่ได้อย่างมีประสิทธิภาพ",
      midTitle: "ภารกิจสำเร็จ แต่ยังพัฒนาได้อีก",
      midBody: "คุณลดความเสี่ยงของพื้นที่ได้ระดับหนึ่ง ครั้งหน้าลองเลือกจุดสำคัญให้เร็วขึ้น",
      failTitle: "ภารกิจยังไม่สำเร็จ",
      failBody: "ยังมีจุดเสี่ยงหลักที่ไม่ได้รับการจัดการ ลองเริ่มจากจุดสัมผัสร่วมก่อนในรอบถัดไป"
    },
    explainableGood: [
      "คุณเลือกตรวจจุดสัมผัสร่วมได้ดี",
      "คุณใช้ Swab กับจุดสำคัญได้เหมาะสม",
      "คุณลด Risk ของพื้นที่ได้รวดเร็ว"
    ],
    explainableImprove: [
      "คุณเสียเวลาไปกับจุดที่ไม่ใช่ต้นตอหลักมากเกินไป",
      "คุณ Clean จุดสำคัญช้าเกินไป",
      "คุณควรเก็บหลักฐานให้ครบก่อนสรุปผล"
    ]
  },

  rank: {
    S: { key: "S", title: "Master Germ Detective", th: "ยอดนักสืบสุขอนามัย" },
    A: { key: "A", title: "Elite Risk Hunter", th: "นักล่าความเสี่ยงชั้นยอด" },
    B: { key: "B", title: "Smart Hygiene Scout", th: "หน่วยสำรวจสุขอนามัย" },
    C: { key: "C", title: "Junior Germ Detective", th: "นักสืบฝึกหัด" },
    D: { key: "D", title: "Trainee Investigator", th: "ผู้ช่วยนักสืบ" }
  },

  coach: {
    start: [
      "เริ่มจากจุดที่หลายคนสัมผัสร่วมกันก่อนนะ",
      "มองหาจุดที่คนหลายคนใช้ร่วมกันบ่อย ๆ ก่อน"
    ],
    smart: [
      "ดีมาก จุดนี้มีโอกาสเป็นต้นตอสูง",
      "ใช่เลย จุดนี้ควรตรวจต่อ"
    ],
    drift: [
      "ลองกลับไปมองหาจุดสัมผัสร่วม จะคุ้มเวลากว่า",
      "ตอนนี้คุณอาจเสียเวลากับจุดรองมากไป"
    ],
    lowTime: [
      "ตอนนี้ต้องจัดลำดับความสำคัญแล้ว เลือกจุดหลักก่อน",
      "เวลาน้อยแล้ว รีบลด Risk ของพื้นที่ก่อน"
    ],
    end: [
      "การเลือกจุดสำคัญถูกก่อน ทำให้พื้นที่ปลอดภัยขึ้นมาก",
      "ภารกิจนี้ช่วยให้คุณเห็นว่าจุดสัมผัสร่วมสำคัญแค่ไหน"
    ]
  },

  scene: {
    classroom: {
      title: "ห้องเรียน",
      intro: "ห้องเรียนนี้มีของใช้ร่วมหลายอย่าง รีบหาจุดที่เชื้ออาจแพร่ต่อได้"
    },
    home: {
      title: "บ้าน",
      intro: "ในบ้านมีจุดสัมผัสร่วมที่คนในครอบครัวใช้ร่วมกัน ตรวจให้รอบคอบ"
    },
    canteen: {
      title: "โรงอาหาร",
      intro: "โรงอาหารมีจุดสัมผัสร่วมจำนวนมาก เลือกตรวจจุดที่มีผลต่อการแพร่เชื้อก่อน"
    }
  },

  ui: {
    continue: "ต่อไป",
    start: "เริ่มภารกิจ",
    retry: "เล่นอีกครั้ง",
    backHub: "กลับ HUB",
    report: "สรุปรายงาน",
    missionClear: "Mission Clear",
    missionFail: "Mission Failed",
    loading: "กำลังโหลดภารกิจ…"
  }
};

// ------------------------
// helper functions
// ------------------------

export function gdPick(arr, fallback = "") {
  return Array.isArray(arr) && arr.length
    ? arr[Math.floor(Math.random() * arr.length)]
    : fallback;
}

export function gdGetToolText(toolKey) {
  return GD_TEXT.tools[toolKey] || GD_TEXT.tools.uv;
}

export function gdGetSceneText(sceneKey) {
  return GD_TEXT.scene[sceneKey] || GD_TEXT.scene.classroom;
}

export function gdGetPhaseText(phaseKey) {
  return GD_TEXT.phase[phaseKey] || GD_TEXT.phase.search;
}

export function gdGetRankText(rankKey) {
  return GD_TEXT.rank[rankKey] || GD_TEXT.rank.D;
}

export function gdGetToast(toolKey, ok = true) {
  if (toolKey === "uv") {
    return gdPick(ok ? GD_TEXT.feedback.uv.hit : GD_TEXT.feedback.uv.miss, "");
  }
  if (toolKey === "swab") {
    return gdPick(ok ? GD_TEXT.feedback.swab.hit : GD_TEXT.feedback.swab.miss, "");
  }
  if (toolKey === "cam") {
    return gdPick(GD_TEXT.feedback.cam.hit, "");
  }
  if (toolKey === "clean") {
    return gdPick(GD_TEXT.feedback.clean.hit, "");
  }
  return ok
    ? gdPick(GD_TEXT.feedback.generic.smart, "")
    : gdPick(GD_TEXT.feedback.generic.weak, "");
}

export function gdGetCoachLine(kind = "start") {
  return gdPick(GD_TEXT.coach[kind] || GD_TEXT.coach.start, "");
}

export function gdBuildHudStrings(state = {}) {
  return {
    time: `${GD_TEXT.hud.time}: ${state.timeLeft ?? 0}s`,
    risk: `${GD_TEXT.hud.risk}: ${state.areaRisk ?? 0}%`,
    evidence: `${GD_TEXT.hud.evidence}: ${state.evidenceCount ?? 0}`,
    critical: `${GD_TEXT.hud.critical}: ${state.criticalFound ?? 0}/${state.criticalTotal ?? 0}`,
    cleaned: `${GD_TEXT.hud.cleaned}: ${state.cleanedCount ?? 0}`,
    score: `${GD_TEXT.hud.score}: ${state.score ?? 0}`
  };
}

export function gdBuildSummaryText(summary = {}) {
  const score = Number(summary.score ?? 0);
  const riskDown = Number(summary.riskDown ?? 0);
  const criticalFound = Number(summary.criticalFound ?? 0);
  const criticalTotal = Number(summary.criticalTotal ?? 0);

  let tier = "fail";
  if (riskDown >= 50 && criticalFound >= Math.max(1, criticalTotal - 1) && score >= 180) {
    tier = "great";
  } else if (riskDown >= 25 && criticalFound >= Math.max(1, Math.floor(criticalTotal / 2))) {
    tier = "mid";
  }

  return {
    tier,
    title: GD_TEXT.summary.result[`${tier}Title`],
    body: GD_TEXT.summary.result[`${tier}Body`]
  };
}

export function gdScoreToRank(score = 0, riskDown = 0, criticalFound = 0, criticalTotal = 0) {
  score = Number(score) || 0;
  riskDown = Number(riskDown) || 0;
  criticalFound = Number(criticalFound) || 0;
  criticalTotal = Number(criticalTotal) || 0;

  const ratio = criticalTotal > 0 ? (criticalFound / criticalTotal) : 0;

  if (score >= 240 && riskDown >= 60 && ratio >= 0.9) return "S";
  if (score >= 180 && riskDown >= 45 && ratio >= 0.75) return "A";
  if (score >= 120 && riskDown >= 25 && ratio >= 0.5) return "B";
  if (score >= 60) return "C";
  return "D";
}