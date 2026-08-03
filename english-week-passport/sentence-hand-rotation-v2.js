(async function () {
  "use strict";

  const rotation = window.EW_ROTATION;
  const VERSION = "2026-08-03-SENTENCE-HAND-ROTATION-V2";
  const ENGINE_URL = "./sentence-builder.js?v=20260803-sentence2";
  const MP = Object.freeze({
    module:"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs",
    wasm:"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    model:"https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  });

  const BANK = Object.freeze([
    {id:"sc01",kind:"Fill the Gap",level:"A2",visual:"💧",prompt:"Students should ___ enough water during hot weather.",tokens:["drink","repair","borrow","paint"],answer:["drink"],hint:"Use the verb that commonly goes with water."},
    {id:"sc02",kind:"Word Order",level:"A2",visual:"🔒",prompt:"Build the correct instruction.",tokens:["your password","Please","private","keep"],answer:["Please","keep","your password","private"],hint:"Begin the instruction with Please."},
    {id:"sc03",kind:"Repair",level:"A2",visual:"♻️",prompt:"Repair: We should reducing plastic waste.",tokens:["We","should","reduce","plastic waste"],answer:["We","should","reduce","plastic waste"],hint:"Use the base verb after should."},
    {id:"sc04",kind:"Fill the Gap",level:"A2",visual:"🚸",prompt:"Always ___ both sides before crossing the road.",tokens:["check","cook","collect","design"],answer:["check"],hint:"Choose the safety action before crossing."},
    {id:"sc05",kind:"Word Order",level:"A2",visual:"🏫",prompt:"Build the sentence about English Week.",tokens:["starts","English Week","on Monday"],answer:["English Week","starts","on Monday"],hint:"Start with the event."},
    {id:"sc06",kind:"Context",level:"A2",visual:"🧳",prompt:"Complete the travel instruction.",tokens:["Keep","your ticket","in a safe place"],answer:["Keep","your ticket","in a safe place"],hint:"Use an imperative sentence."},

    {id:"sc07",kind:"Fill the Gap",level:"A2+",visual:"📝",prompt:"You need to ___ the application form before Friday.",tokens:["submit","climb","mix","throw"],answer:["submit"],hint:"Choose the verb for sending a form officially."},
    {id:"sc08",kind:"Word Order",level:"A2+",visual:"🏛️",prompt:"Build the sentence about a museum tour.",tokens:["at 10 a.m.","the museum tour","will begin","The guide"],answer:["The guide","will begin","the museum tour","at 10 a.m."],hint:"Start with The guide."},
    {id:"sc09",kind:"Repair",level:"A2+",visual:"📚",prompt:"Repair: This app helps students practicing vocabulary.",tokens:["This app","helps students","practice","new vocabulary"],answer:["This app","helps students","practice","new vocabulary"],hint:"Use the base verb after helps students."},
    {id:"sc10",kind:"Fill the Gap",level:"A2+",visual:"🌦️",prompt:"The weather report will help us ___ our trip.",tokens:["plan","taste","fold","translate"],answer:["plan"],hint:"Choose the verb used before a trip."},
    {id:"sc11",kind:"Word Order",level:"A2+",visual:"💬",prompt:"Build the correct question.",tokens:["this word","Can you","in a sentence","use"],answer:["Can you","use","this word","in a sentence"],hint:"Begin with Can you."},
    {id:"sc12",kind:"Context",level:"A2+",visual:"🤝",prompt:"Build a polite request for teamwork.",tokens:["Could you","help me","with this task","please"],answer:["Could you","help me","with this task","please"],hint:"Begin with Could you."},

    {id:"sc13",kind:"Fill the Gap",level:"B1",visual:"💡",prompt:"Our team will ___ ideas before choosing the best one.",tokens:["share","melt","lock","deliver"],answer:["share"],hint:"Choose the verb used when exchanging ideas."},
    {id:"sc14",kind:"Word Order",level:"B1",visual:"🌱",prompt:"Build a sentence about environmental responsibility.",tokens:["to reduce waste","everyone","should take action"],answer:["everyone","should take action","to reduce waste"],hint:"Start with the subject everyone."},
    {id:"sc15",kind:"Repair",level:"B1",visual:"🏆",prompt:"Repair: The school will organized an English competition.",tokens:["The school","will organize","an English competition","next week"],answer:["The school","will organize","an English competition","next week"],hint:"Use the base verb after will."},
    {id:"sc16",kind:"Fill the Gap",level:"B1",visual:"🔐",prompt:"A strong password can ___ your account from unauthorized access.",tokens:["protect","invite","measure","borrow"],answer:["protect"],hint:"Choose the verb meaning keep safe."},
    {id:"sc17",kind:"Word Order",level:"B1",visual:"📊",prompt:"Build a sentence about using feedback.",tokens:["can improve","constructive feedback","your performance"],answer:["constructive feedback","can improve","your performance"],hint:"Start with the noun phrase constructive feedback."},
    {id:"sc18",kind:"Context",level:"B1",visual:"🧭",prompt:"Build the most logical travel recommendation.",tokens:["Before departure","check","your itinerary","carefully"],answer:["Before departure","check","your itinerary","carefully"],hint:"Place the time phrase first."},

    {id:"sc19",kind:"Fill the Gap",level:"B1+",visual:"🌍",prompt:"Communities must ___ sustainable solutions to environmental problems.",tokens:["develop","cancel","hide","separate"],answer:["develop"],hint:"Choose the verb meaning create and improve."},
    {id:"sc20",kind:"Word Order",level:"B1+",visual:"🤖",prompt:"Build a sentence expressing a condition and result.",tokens:["students can learn more effectively","is used responsibly","If technology"],answer:["If technology","is used responsibly","students can learn more effectively"],hint:"Begin with the If-clause."},
    {id:"sc21",kind:"Repair",level:"B1+",visual:"🧠",prompt:"Repair: Although the task was challenging, but the team completed it.",tokens:["Although the task was challenging","the team","completed it","successfully"],answer:["Although the task was challenging","the team","completed it","successfully"],hint:"Do not use but after Although."},
    {id:"sc22",kind:"Fill the Gap",level:"B1+",visual:"🗣️",prompt:"Clear communication helps prevent ___ during collaborative work.",tokens:["misunderstandings","destinations","ingredients","departures"],answer:["misunderstandings"],hint:"Choose the noun for incorrect understanding."},
    {id:"sc23",kind:"Word Order",level:"B1+",visual:"♻️",prompt:"Build a sentence showing cause and effect.",tokens:["because it reduces waste","Recycling is important","and saves resources"],answer:["Recycling is important","because it reduces waste","and saves resources"],hint:"State the main idea before the reason."},
    {id:"sc24",kind:"Context",level:"B1+",visual:"🎯",prompt:"Build a recommendation based on evidence.",tokens:["Based on the survey results","the school should","extend the activity","next year"],answer:["Based on the survey results","the school should","extend the activity","next year"],hint:"Begin with the evidence phrase."}
  ]);

  const quotas = Object.freeze({"Fill the Gap":3,"Word Order":3,"Repair":2,"Context":2});
  const selectedTasks = Object.entries(quotas).flatMap(([kind, count]) => {
    const pool = BANK.filter(item => item.kind === kind);
    return rotation
      ? rotation.balancedSample(pool, count, `sentence_city:${kind}`, item => item.level)
      : pool.slice(0, count);
  });
  const orderedTasks = rotation ? rotation.order(selectedTasks, "sentence_city", "task-order") : selectedTasks;
  rotation?.installStageRandom("sentence_city");

  function json(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  async function loadEngine() {
    const response = await fetch(ENGINE_URL, { cache:"no-store" });
    if (!response.ok) throw new Error(`SENTENCE_ENGINE_${response.status}`);
    let source = await response.text();
    source = source.replace(/const TASKS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\);/, `const TASKS = Object.freeze(${json(orderedTasks)});`);
    source = source.replace("ใช้การแตะเป็นหลักและลากวางได้บนอุปกรณ์ที่รองรับ", "ใช้มือชี้และจีบนิ้วเพื่อหยิบ วาง และตรวจประโยค");
    source = source.replace("แตะบล็อกคำตามลำดับ หรือกดค้างแล้วลากเข้าพื้นที่สร้างประโยค", "ชี้บล็อกคำแล้วจีบนิ้วเพื่อเลือก จากนั้นจัดลำดับประโยค");
    const blob = new Blob([source], { type:"text/javascript" });
    const url = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => URL.revokeObjectURL(url);
    document.body.appendChild(script);
  }

  const hand = {
    stream:null,
    detector:null,
    raf:0,
    lastVideoTime:-1,
    lastPinch:false,
    activeElement:null,
    missingSince:0,
    starting:false
  };

  function distance(a, b) {
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 99;
  }

  async function createDetector() {
    const vision = await import(MP.module);
    const files = await vision.FilesetResolver.forVisionTasks(MP.wasm);
    return vision.HandLandmarker.createFromOptions(files, {
      baseOptions:{ modelAssetPath:MP.model, delegate:"GPU" },
      runningMode:"VIDEO",
      numHands:1,
      minHandDetectionConfidence:.42,
      minHandPresenceConfidence:.42,
      minTrackingConfidence:.42
    });
  }

  function ensureHandUi() {
    if (!document.getElementById("sentenceHandVideo")) {
      const video = document.createElement("video");
      video.id = "sentenceHandVideo";
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      document.body.appendChild(video);
    }
    if (!document.getElementById("sentenceHandPointer")) {
      const pointer = document.createElement("div");
      pointer.id = "sentenceHandPointer";
      pointer.hidden = true;
      document.body.appendChild(pointer);
    }
    if (!document.getElementById("sentenceHandGuide")) {
      const guide = document.createElement("div");
      guide.id = "sentenceHandGuide";
      guide.textContent = "ยกมือหนึ่งข้าง ชี้บล็อก แล้วจีบนิ้วเพื่อเลือก";
      document.body.appendChild(guide);
    }
  }

  async function startHandTracking() {
    if (hand.stream || hand.starting || !document.querySelector(".game-card")) return;
    hand.starting = true;
    ensureHandUi();
    const guide = document.getElementById("sentenceHandGuide");
    try {
      guide.textContent = "กำลังเปิดกล้องและเตรียม Hand Tracking…";
      hand.stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{facingMode:{ideal:"user"},width:{ideal:960},height:{ideal:720}}
      });
      hand.detector = await createDetector();
      const video = document.getElementById("sentenceHandVideo");
      video.srcObject = hand.stream;
      await video.play();
      hand.lastVideoTime = -1;
      hand.missingSince = performance.now();
      guide.textContent = "ชี้บล็อกคำหรือปุ่ม แล้วจีบนิ้วโป้งกับนิ้วชี้";
      handLoop();
    } catch (error) {
      console.error(error);
      guide.innerHTML = "เปิด Hand Tracking ไม่สำเร็จ • ตรวจสิทธิ์กล้องและแสง แล้ว <strong>โหลดหน้าใหม่</strong>";
      guide.onclick = () => location.reload();
      guide.style.pointerEvents = "auto";
    } finally {
      hand.starting = false;
    }
  }

  function eligibleAt(x, y) {
    const element = document.elementFromPoint(x, y);
    return element?.closest?.(".token,.built-token button,#checkBtn,#hintBtn") || null;
  }

  function clearHover() {
    document.querySelectorAll(".ew-hand-focus").forEach(element => element.classList.remove("ew-hand-focus"));
  }

  function processHand(result) {
    ensureHandUi();
    const pointer = document.getElementById("sentenceHandPointer");
    const guide = document.getElementById("sentenceHandGuide");
    const landmarks = result?.landmarks?.[0];
    if (!landmarks) {
      pointer.hidden = true;
      clearHover();
      hand.activeElement = null;
      hand.lastPinch = false;
      if (performance.now() - hand.missingSince > 2500) guide.textContent = "ยังไม่พบมือ • ให้เห็นฝ่ามือและนิ้วในกรอบกล้อง";
      return;
    }

    hand.missingSince = performance.now();
    const index = landmarks[8];
    const thumb = landmarks[4];
    const x = (1 - index.x) * window.innerWidth;
    const y = index.y * window.innerHeight;
    pointer.hidden = false;
    pointer.style.transform = `translate3d(${x}px,${y}px,0)`;
    const target = eligibleAt(x, y);
    clearHover();
    if (target && !target.disabled) target.classList.add("ew-hand-focus");
    hand.activeElement = target && !target.disabled ? target : null;

    const pinch = distance(index, thumb) < .052;
    pointer.classList.toggle("pinching", pinch);
    guide.textContent = hand.activeElement
      ? `พร้อมเลือก ${hand.activeElement.textContent.trim().slice(0, 30)} • จีบนิ้วหนึ่งครั้ง`
      : "ขยับนิ้วชี้ไปยังบล็อกคำหรือปุ่มตรวจประโยค";

    if (pinch && !hand.lastPinch && hand.activeElement) {
      const targetToClick = hand.activeElement;
      targetToClick.click();
      if (navigator.vibrate) navigator.vibrate(25);
    }
    hand.lastPinch = pinch;
  }

  function handLoop() {
    const video = document.getElementById("sentenceHandVideo");
    const run = () => {
      if (!hand.detector || !video || !document.body.contains(video)) return;
      if (video.readyState >= 2 && video.currentTime !== hand.lastVideoTime) {
        hand.lastVideoTime = video.currentTime;
        try {
          processHand(hand.detector.detectForVideo(video, performance.now()));
        } catch (error) {
          console.warn(error);
        }
      }
      hand.raf = requestAnimationFrame(run);
    };
    run();
  }

  function stopHand() {
    cancelAnimationFrame(hand.raf);
    hand.raf = 0;
    if (hand.stream) hand.stream.getTracks().forEach(track => track.stop());
    hand.stream = null;
    if (hand.detector?.close) try { hand.detector.close(); } catch (_) {}
    hand.detector = null;
  }

  document.addEventListener("click", event => {
    const controlled = event.target?.closest?.(".token,.built-token button,#checkBtn,#hintBtn");
    if (controlled && event.isTrusted) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (document.querySelector(".game-card")) startHandTracking();
    const intro = document.querySelector(".intro");
    const preview = document.getElementById("sentenceHandVideo");
    const pointer = document.getElementById("sentenceHandPointer");
    if (intro && preview) preview.hidden = true;
    else if (preview) preview.hidden = false;
    if (intro && pointer) pointer.hidden = true;
  });
  observer.observe(document.documentElement, {childList:true,subtree:true});
  window.addEventListener("pagehide", stopHand);

  const style = document.createElement("style");
  style.textContent = `
    .token,.built-token button,#checkBtn,#hintBtn{pointer-events:none!important}
    .ew-hand-focus{outline:4px solid #facc15!important;outline-offset:3px;transform:translateY(-3px) scale(1.035)!important;filter:brightness(1.12)}
    #sentenceHandVideo{position:fixed;z-index:30;right:10px;bottom:58px;width:92px;height:122px;object-fit:cover;transform:scaleX(-1);border-radius:16px;border:3px solid rgba(255,255,255,.92);box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none}
    #sentenceHandPointer{position:fixed;z-index:9998;left:-18px;top:-18px;width:36px;height:36px;border-radius:50%;background:rgba(124,58,237,.88);border:3px solid white;box-shadow:0 5px 18px rgba(0,0,0,.28);pointer-events:none;will-change:transform}
    #sentenceHandPointer.pinching{background:#facc15;transform-origin:center}
    #sentenceHandGuide{position:fixed;z-index:9999;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:92vw;padding:8px 13px;border-radius:999px;background:rgba(35,20,75,.94);color:white;font-size:.75rem;font-weight:900;text-align:center;pointer-events:none}
  `;
  document.head.appendChild(style);

  try {
    await loadEngine();
  } catch (error) {
    console.error(error);
    const root = document.getElementById("sentenceRoot");
    if (root) root.innerHTML = `<section class="intro"><div class="hero">⚠️</div><h1>โหลด Sentence City ไม่สำเร็จ</h1><p class="lead">${String(error.message || error)}</p><button onclick="location.reload()" class="btn primary">โหลดใหม่</button></section>`;
  }
}());