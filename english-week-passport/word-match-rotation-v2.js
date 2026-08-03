(async function () {
  "use strict";

  const rotation = window.EW_ROTATION;
  const VERSION = "2026-08-03-WORD-MATCH-ROTATION-V2";
  const ENGINE_URL = "./word-match-memory.js?v=20260803-memory2";
  const PAIR_BANK = Object.freeze([
    {id:"wm01",word:"journey",meaning:"การเดินทาง",emoji:"🧳",level:"A2"},
    {id:"wm02",word:"healthy",meaning:"มีสุขภาพดี",emoji:"🥗",level:"A2"},
    {id:"wm03",word:"device",meaning:"อุปกรณ์",emoji:"📱",level:"A2"},
    {id:"wm04",word:"schedule",meaning:"กำหนดการ",emoji:"🗓️",level:"A2"},
    {id:"wm05",word:"passport",meaning:"หนังสือเดินทาง",emoji:"🛂",level:"A2"},
    {id:"wm06",word:"exercise",meaning:"การออกกำลังกาย",emoji:"🏃",level:"A2"},
    {id:"wm07",word:"environment",meaning:"สิ่งแวดล้อม",emoji:"🌱",level:"A2+"},
    {id:"wm08",word:"volunteer",meaning:"อาสาสมัคร",emoji:"🙋",level:"A2+"},
    {id:"wm09",word:"protect",meaning:"ปกป้อง",emoji:"🛡️",level:"A2+"},
    {id:"wm10",word:"community",meaning:"ชุมชน",emoji:"🏘️",level:"A2+"},
    {id:"wm11",word:"destination",meaning:"จุดหมายปลายทาง",emoji:"📍",level:"A2+"},
    {id:"wm12",word:"improve",meaning:"พัฒนาให้ดีขึ้น",emoji:"📈",level:"A2+"},
    {id:"wm13",word:"opportunity",meaning:"โอกาส",emoji:"🚪",level:"B1"},
    {id:"wm14",word:"confident",meaning:"มั่นใจ",emoji:"💪",level:"B1"},
    {id:"wm15",word:"reliable",meaning:"น่าเชื่อถือ",emoji:"✅",level:"B1"},
    {id:"wm16",word:"feedback",meaning:"ข้อมูลป้อนกลับ",emoji:"📊",level:"B1"},
    {id:"wm17",word:"pollution",meaning:"มลพิษ",emoji:"🌫️",level:"B1"},
    {id:"wm18",word:"interview",meaning:"การสัมภาษณ์",emoji:"🧑‍💼",level:"B1"},
    {id:"wm19",word:"achievement",meaning:"ความสำเร็จ",emoji:"🏆",level:"B1+"},
    {id:"wm20",word:"responsibility",meaning:"ความรับผิดชอบ",emoji:"🧭",level:"B1+"},
    {id:"wm21",word:"sustainable",meaning:"ยั่งยืน",emoji:"♻️",level:"B1+"},
    {id:"wm22",word:"collaboration",meaning:"การทำงานร่วมกัน",emoji:"🤝",level:"B1+"},
    {id:"wm23",word:"recommendation",meaning:"ข้อเสนอแนะ",emoji:"💡",level:"B1+"},
    {id:"wm24",word:"communication",meaning:"การสื่อสาร",emoji:"💬",level:"B1+"}
  ]);

  const assignment = rotation?.getAssignment();
  const selectedPool = rotation
    ? rotation.balancedSample(PAIR_BANK, 12, "word_match:pool", item => item.level)
    : PAIR_BANK.slice(0, 12);
  rotation?.installStageRandom("word_match");

  function escapeScriptJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  async function loadEngine() {
    const response = await fetch(ENGINE_URL, { cache:"no-store" });
    if (!response.ok) throw new Error(`WORD_MATCH_ENGINE_${response.status}`);
    let source = await response.text();
    const replacement = `const PAIRS = Object.freeze(${escapeScriptJson(selectedPool)});`;
    source = source.replace(/const PAIRS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\);/, replacement);
    source = source.replace("Word Match Village Memory Game", "Word Match Village Tilt Mission");
    const blob = new Blob([source], { type:"text/javascript" });
    const script = document.createElement("script");
    const objectUrl = URL.createObjectURL(blob);
    script.src = objectUrl;
    script.onload = () => URL.revokeObjectURL(objectUrl);
    script.onerror = () => URL.revokeObjectURL(objectUrl);
    document.body.appendChild(script);
  }

  const control = {
    gamma:0,
    beta:0,
    baselineBeta:null,
    orientationSeen:false,
    activeCard:null,
    dwellStart:0,
    cooldownUntil:0,
    raf:0,
    permissionRequested:false
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function requestOrientationPermission() {
    if (control.permissionRequested) return;
    control.permissionRequested = true;
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  }

  function onOrientation(event) {
    if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
    control.orientationSeen = true;
    if (control.baselineBeta === null) control.baselineBeta = event.beta;
    control.gamma = clamp(event.gamma, -28, 28);
    control.beta = clamp(event.beta - control.baselineBeta, -24, 24);
  }

  function ensureControlUi() {
    if (document.getElementById("ewTiltPointer")) return;
    const pointer = document.createElement("div");
    pointer.id = "ewTiltPointer";
    pointer.innerHTML = "✦";
    document.body.appendChild(pointer);
    const guide = document.createElement("div");
    guide.id = "ewTiltGuide";
    guide.textContent = `${assignment?.passportRotation || "P"} • เอียงมือถือเพื่อเลือก • ค้างเพื่อเปิด`;
    document.body.appendChild(guide);
  }

  function visibleCards() {
    return Array.from(document.querySelectorAll(".memory-card:not(.matched):not([disabled])"))
      .filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.width > 10 && rect.height > 10;
      });
  }

  function updateTiltSelection() {
    ensureControlUi();
    const pointer = document.getElementById("ewTiltPointer");
    const guide = document.getElementById("ewTiltGuide");
    const board = document.getElementById("memoryGrid");
    if (!pointer || !guide || !board) {
      control.raf = requestAnimationFrame(updateTiltSelection);
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const x = viewportWidth * 0.5 + control.gamma / 28 * viewportWidth * 0.42;
    const y = viewportHeight * 0.54 + control.beta / 24 * viewportHeight * 0.30;
    pointer.style.transform = `translate3d(${x}px,${y}px,0)`;

    let nearest = null;
    let nearestDistance = Infinity;
    visibleCards().forEach(card => {
      const rect = card.getBoundingClientRect();
      const distance = Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y);
      card.classList.remove("ew-tilt-focus");
      if (distance < nearestDistance) {
        nearest = card;
        nearestDistance = distance;
      }
    });

    const now = performance.now();
    if (!control.orientationSeen) {
      guide.textContent = "กำลังรอ Motion Sensor • ถือเครื่องตั้งตรงแล้วเอียงเบา ๆ";
      control.activeCard = null;
      control.dwellStart = 0;
    } else if (nearest && nearestDistance < Math.max(86, nearest.getBoundingClientRect().width * 0.82)) {
      nearest.classList.add("ew-tilt-focus");
      if (control.activeCard !== nearest) {
        control.activeCard = nearest;
        control.dwellStart = now;
      }
      const percent = Math.min(100, Math.round((now - control.dwellStart) / 720 * 100));
      guide.textContent = `${assignment?.passportRotation || "P"} • กำลังเปิด ${percent}%`;
      if (percent >= 100 && now >= control.cooldownUntil) {
        control.cooldownUntil = now + 650;
        control.dwellStart = now;
        nearest.click();
      }
    } else {
      control.activeCard = null;
      control.dwellStart = 0;
      guide.textContent = "เอียงให้วงแสงอยู่กลางการ์ด แล้วค้างประมาณ 0.7 วินาที";
    }
    control.raf = requestAnimationFrame(updateTiltSelection);
  }

  document.addEventListener("click", event => {
    if (event.target?.closest?.("#startBtn")) requestOrientationPermission();
    const card = event.target?.closest?.(".memory-card");
    if (card && event.isTrusted) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("deviceorientation", onOrientation, true);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(control.raf);
    window.removeEventListener("deviceorientation", onOrientation, true);
  });

  const style = document.createElement("style");
  style.textContent = `
    .memory-card{pointer-events:none!important}
    .memory-card.ew-tilt-focus{outline:4px solid #facc15!important;outline-offset:4px;filter:brightness(1.12);transform:translateY(-3px) scale(1.025)}
    #ewTiltPointer{position:fixed;left:-18px;top:-18px;z-index:9998;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(250,204,21,.90);border:3px solid white;box-shadow:0 5px 20px rgba(0,0,0,.28);color:#17324d;font-size:1.1rem;pointer-events:none;will-change:transform}
    #ewTiltGuide{position:fixed;z-index:9999;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:92vw;padding:8px 13px;border-radius:999px;background:rgba(7,24,39,.90);color:white;font-size:.76rem;font-weight:900;text-align:center;pointer-events:none}
  `;
  document.head.appendChild(style);

  try {
    await loadEngine();
    updateTiltSelection();
  } catch (error) {
    console.error(error);
    const root = document.getElementById("memoryRoot");
    if (root) root.innerHTML = `<section class="intro-card"><div class="hero">⚠️</div><h1>โหลด Word Match ไม่สำเร็จ</h1><p class="lead">${String(error.message || error)}</p><button onclick="location.reload()" class="btn primary">โหลดใหม่</button></section>`;
  }
}());