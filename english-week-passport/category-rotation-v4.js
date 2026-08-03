(async function () {
  "use strict";

  const rotation = window.EW_ROTATION;
  const VERSION = "2026-08-03-CATEGORY-ROTATION-V4";
  const ENGINE_URL = "./category-ar-game-v3.js?v=20260803-category4";
  const PORTAL_IDS = Object.freeze(["Travel", "Technology", "Environment", "Health"]);
  const BANK = Object.freeze([
    {id:"tr01",word:"passport",thai:"หนังสือเดินทาง",visual:"🛂",category:"Travel",level:"A2",explanation:"passport เป็นเอกสารประจำตัวสำหรับการเดินทางระหว่างประเทศ"},
    {id:"tr02",word:"ticket",thai:"ตั๋วโดยสาร",visual:"🎫",category:"Travel",level:"A2",explanation:"ticket ใช้ยืนยันสิทธิ์โดยสารหรือเข้าร่วมกิจกรรม"},
    {id:"tr03",word:"luggage",thai:"สัมภาระ",visual:"🧳",category:"Travel",level:"A2+",explanation:"luggage คือกระเป๋าและสิ่งของที่นำติดตัวในการเดินทาง"},
    {id:"tr04",word:"boarding pass",thai:"บัตรขึ้นเครื่อง",visual:"✈️",category:"Travel",level:"A2+",explanation:"boarding pass ใช้ยืนยันสิทธิ์ขึ้นเครื่องบิน"},
    {id:"tr05",word:"destination",thai:"จุดหมายปลายทาง",visual:"📍",category:"Travel",level:"B1",explanation:"destination คือสถานที่ปลายทางของการเดินทาง"},
    {id:"tr06",word:"accommodation",thai:"ที่พัก",visual:"🏨",category:"Travel",level:"B1",explanation:"accommodation หมายถึงสถานที่พักระหว่างการเดินทาง"},
    {id:"tr07",word:"itinerary",thai:"กำหนดการเดินทาง",visual:"🗺️",category:"Travel",level:"B1+",explanation:"itinerary คือแผนรายละเอียดของการเดินทาง"},
    {id:"tr08",word:"departure",thai:"การออกเดินทาง",visual:"🛫",category:"Travel",level:"B1+",explanation:"departure หมายถึงการออกจากสถานที่ต้นทาง"},

    {id:"te01",word:"keyboard",thai:"แป้นพิมพ์",visual:"⌨️",category:"Technology",level:"A2",explanation:"keyboard เป็นอุปกรณ์ป้อนข้อมูลเข้าสู่คอมพิวเตอร์"},
    {id:"te02",word:"smartphone",thai:"โทรศัพท์อัจฉริยะ",visual:"📱",category:"Technology",level:"A2",explanation:"smartphone เป็นอุปกรณ์สื่อสารและใช้งานแอป"},
    {id:"te03",word:"password",thai:"รหัสผ่าน",visual:"🔐",category:"Technology",level:"A2+",explanation:"password ใช้ยืนยันตัวตนและปกป้องบัญชีดิจิทัล"},
    {id:"te04",word:"website",thai:"เว็บไซต์",visual:"🌐",category:"Technology",level:"A2+",explanation:"website คือกลุ่มหน้าเว็บที่เข้าถึงผ่านอินเทอร์เน็ต"},
    {id:"te05",word:"software",thai:"ซอฟต์แวร์",visual:"💻",category:"Technology",level:"B1",explanation:"software คือโปรแกรมและคำสั่งที่ทำงานบนอุปกรณ์"},
    {id:"te06",word:"database",thai:"ฐานข้อมูล",visual:"🗄️",category:"Technology",level:"B1",explanation:"database ใช้จัดเก็บและจัดการข้อมูลอย่างเป็นระบบ"},
    {id:"te07",word:"cybersecurity",thai:"ความมั่นคงปลอดภัยไซเบอร์",visual:"🛡️",category:"Technology",level:"B1+",explanation:"cybersecurity คือการปกป้องระบบและข้อมูลจากภัยคุกคาม"},
    {id:"te08",word:"artificial intelligence",thai:"ปัญญาประดิษฐ์",visual:"🤖",category:"Technology",level:"B1+",explanation:"artificial intelligence ทำให้ระบบสามารถเรียนรู้และตัดสินใจได้"},

    {id:"en01",word:"recycle",thai:"นำกลับมาใช้ใหม่",visual:"♻️",category:"Environment",level:"A2",explanation:"recycle ช่วยลดปริมาณขยะ"},
    {id:"en02",word:"wildlife",thai:"สัตว์ป่า",visual:"🦋",category:"Environment",level:"A2",explanation:"wildlife หมายถึงสัตว์และสิ่งมีชีวิตในธรรมชาติ"},
    {id:"en03",word:"pollution",thai:"มลพิษ",visual:"🏭",category:"Environment",level:"A2+",explanation:"pollution คือสิ่งปนเปื้อนที่ทำลายสิ่งแวดล้อม"},
    {id:"en04",word:"forest",thai:"ป่าไม้",visual:"🌳",category:"Environment",level:"A2+",explanation:"forest เป็นระบบนิเวศที่มีต้นไม้จำนวนมาก"},
    {id:"en05",word:"renewable energy",thai:"พลังงานหมุนเวียน",visual:"☀️",category:"Environment",level:"B1",explanation:"renewable energy มาจากแหล่งที่เกิดทดแทนได้"},
    {id:"en06",word:"conservation",thai:"การอนุรักษ์",visual:"🌿",category:"Environment",level:"B1",explanation:"conservation คือการปกป้องทรัพยากรธรรมชาติ"},
    {id:"en07",word:"sustainability",thai:"ความยั่งยืน",visual:"🌍",category:"Environment",level:"B1+",explanation:"sustainability คือการตอบสนองความต้องการโดยไม่ทำลายอนาคต"},
    {id:"en08",word:"biodiversity",thai:"ความหลากหลายทางชีวภาพ",visual:"🐝",category:"Environment",level:"B1+",explanation:"biodiversity หมายถึงความหลากหลายของสิ่งมีชีวิต"},

    {id:"he01",word:"exercise",thai:"การออกกำลังกาย",visual:"🏃",category:"Health",level:"A2",explanation:"exercise ช่วยเสริมสร้างสมรรถภาพและสุขภาพ"},
    {id:"he02",word:"medicine",thai:"ยา",visual:"💊",category:"Health",level:"A2",explanation:"medicine ใช้รักษาหรือบรรเทาอาการเจ็บป่วย"},
    {id:"he03",word:"hydration",thai:"การได้รับน้ำเพียงพอ",visual:"💧",category:"Health",level:"A2+",explanation:"hydration ช่วยให้ร่างกายมีน้ำเพียงพอ"},
    {id:"he04",word:"nutrition",thai:"โภชนาการ",visual:"🥗",category:"Health",level:"A2+",explanation:"nutrition เกี่ยวข้องกับอาหารและสารอาหารที่ร่างกายต้องการ"},
    {id:"he05",word:"well-being",thai:"สุขภาวะ",visual:"😊",category:"Health",level:"B1",explanation:"well-being หมายถึงภาวะที่ดีทั้งทางกายและใจ"},
    {id:"he06",word:"prevention",thai:"การป้องกัน",visual:"🩺",category:"Health",level:"B1",explanation:"prevention คือการลดโอกาสเกิดโรคหรืออันตราย"},
    {id:"he07",word:"mental health",thai:"สุขภาพจิต",visual:"🧠",category:"Health",level:"B1+",explanation:"mental health เกี่ยวข้องกับอารมณ์ ความคิด และการปรับตัว"},
    {id:"he08",word:"balanced lifestyle",thai:"วิถีชีวิตที่สมดุล",visual:"⚖️",category:"Health",level:"B1+",explanation:"balanced lifestyle จัดเวลาให้เหมาะสมระหว่างสุขภาพ งาน และการพักผ่อน"}
  ]);

  const assignment = rotation?.getAssignment();
  const selectedItems = PORTAL_IDS.flatMap(portal => {
    const pool = BANK.filter(item => item.category === portal);
    return rotation
      ? rotation.balancedSample(pool, 3, `category_forest:${portal}`, item => item.level)
      : pool.slice(0, 3);
  });
  rotation?.installStageRandom("category_forest");

  function json(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  async function loadEngine() {
    const response = await fetch(ENGINE_URL, { cache:"no-store" });
    if (!response.ok) throw new Error(`CATEGORY_ENGINE_${response.status}`);
    let source = await response.text();
    source = source.replace(/const ITEMS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\);/, `const ITEMS = Object.freeze(${json(selectedItems)});`);
    const blob = new Blob([source], { type:"text/javascript" });
    const url = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => URL.revokeObjectURL(url);
    document.body.appendChild(script);
  }

  const motion = {
    gamma:0,
    beta:0,
    baselineBeta:null,
    seen:false,
    target:null,
    dwellStart:0,
    cooldownUntil:0,
    raf:0,
    permissionRequested:false
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function requestPermission() {
    if (motion.permissionRequested) return;
    motion.permissionRequested = true;
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }

  function onOrientation(event) {
    if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
    motion.seen = true;
    if (motion.baselineBeta === null) motion.baselineBeta = event.beta;
    motion.gamma = clamp(event.gamma, -30, 30);
    motion.beta = clamp(event.beta - motion.baselineBeta, -22, 22);
  }

  function ensureGuide() {
    if (!document.getElementById("ewArDwellGuide")) {
      const guide = document.createElement("div");
      guide.id = "ewArDwellGuide";
      guide.textContent = "หมุนเครื่องเล็ง Portal แล้วค้าง";
      document.body.appendChild(guide);
    }
  }

  function replaceUnavailableFallback() {
    const fallback = document.getElementById("fallbackBtn");
    if (!fallback) return;
    fallback.hidden = true;
    const actions = fallback.closest(".ar-actions");
    if (actions && !actions.querySelector(".ew-camera-required")) {
      const note = document.createElement("div");
      note.className = "ar-notice ew-camera-required";
      note.innerHTML = "<strong>Camera + Motion Required</strong><br>ด่านนี้ไม่มีโหมดแตะหรือโหมดไม่ใช้กล้อง";
      actions.before(note);
    }
  }

  function activeButtons() {
    return Array.from(document.querySelectorAll(".ar-category:not([disabled])"))
      .filter(button => button.getBoundingClientRect().width > 10);
  }

  function updateDwell() {
    ensureGuide();
    replaceUnavailableFallback();
    const guide = document.getElementById("ewArDwellGuide");
    const buttons = activeButtons();
    buttons.forEach(button => button.classList.remove("ew-dwell-focus"));

    if (!buttons.length) {
      motion.target = null;
      motion.dwellStart = 0;
      motion.raf = requestAnimationFrame(updateDwell);
      return;
    }

    if (!motion.seen) {
      guide.textContent = "กำลังรอ Motion Sensor • ถือเครื่องตั้งตรงแล้วหมุนเบา ๆ";
      motion.raf = requestAnimationFrame(updateDwell);
      return;
    }

    const horizontal = (motion.gamma + 30) / 60;
    const vertical = (motion.beta + 22) / 44;
    const column = horizontal < 0.5 ? 0 : 1;
    const row = vertical < 0.5 ? 0 : 1;
    const index = Math.min(buttons.length - 1, row * 2 + column);
    const target = buttons[index];
    target.classList.add("ew-dwell-focus");

    const now = performance.now();
    if (motion.target !== target) {
      motion.target = target;
      motion.dwellStart = now;
    }
    const percent = Math.min(100, Math.round((now - motion.dwellStart) / 850 * 100));
    guide.textContent = `${assignment?.passportRotation || "P"} • Scan ${target.dataset.answer || "Portal"} ${percent}%`;
    if (percent >= 100 && now >= motion.cooldownUntil) {
      motion.cooldownUntil = now + 950;
      motion.dwellStart = now;
      target.click();
    }
    motion.raf = requestAnimationFrame(updateDwell);
  }

  document.addEventListener("click", event => {
    if (event.target?.closest?.("#cameraBtn")) requestPermission();
    const answer = event.target?.closest?.(".ar-category");
    if (answer && event.isTrusted) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("deviceorientation", onOrientation, true);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(motion.raf);
    window.removeEventListener("deviceorientation", onOrientation, true);
  });

  const style = document.createElement("style");
  style.textContent = `
    #fallbackBtn{display:none!important}
    .ar-category{pointer-events:none!important;transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
    .ar-category.ew-dwell-focus{transform:translateY(-5px) scale(1.045);filter:brightness(1.18);box-shadow:0 0 0 4px #facc15,0 12px 28px rgba(0,0,0,.35)!important}
    #ewArDwellGuide{position:fixed;z-index:9999;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:94vw;padding:8px 13px;border-radius:999px;background:rgba(2,20,28,.92);color:white;font-size:.76rem;font-weight:900;text-align:center;pointer-events:none}
  `;
  document.head.appendChild(style);
  new MutationObserver(replaceUnavailableFallback).observe(document.documentElement, { childList:true, subtree:true });

  try {
    await loadEngine();
    updateDwell();
  } catch (error) {
    console.error(error);
    const root = document.getElementById("arRoot");
    if (root) root.innerHTML = `<section class="ar-card"><div class="ar-hero">⚠️</div><h1>โหลด Category Forest ไม่สำเร็จ</h1><p>${String(error.message || error)}</p><button onclick="location.reload()" class="ar-btn primary">โหลดใหม่</button></section>`;
  }
}());