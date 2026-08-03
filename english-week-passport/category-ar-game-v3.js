(function () {
  "use strict";

  const cfg = window.EW_CONFIG;
  const authorityApi = window.EW_AUTHORITY;
  const root = document.getElementById("arRoot");
  const loading = document.getElementById("arLoading");
  const loadingText = document.getElementById("arLoadingText");
  const backBtn = document.getElementById("backBtn");
  const exitBtn = document.getElementById("exitBtn");

  const VERSION = "2026-08-03-CATEGORY-FOREST-V3-INTEGRITY";
  const PORTALS = Object.freeze([
    { id:"Travel", label:"Travel", thai:"การเดินทาง", icon:"✈️" },
    { id:"Technology", label:"Technology", thai:"เทคโนโลยี", icon:"💻" },
    { id:"Environment", label:"Environment", thai:"สิ่งแวดล้อม", icon:"🌱" },
    { id:"Health", label:"Health", thai:"สุขภาพ", icon:"❤️" }
  ]);
  const ITEMS = Object.freeze([
    { id:"cf01", word:"passport", thai:"หนังสือเดินทาง", visual:"🛂", category:"Travel", explanation:"passport เป็นเอกสารประจำตัวสำหรับการเดินทางระหว่างประเทศ" },
    { id:"cf02", word:"boarding pass", thai:"บัตรโดยสารขึ้นเครื่อง", visual:"✈️", category:"Travel", explanation:"boarding pass ใช้ยืนยันสิทธิ์ขึ้นเครื่องบิน" },
    { id:"cf03", word:"destination", thai:"จุดหมายปลายทาง", visual:"📍", category:"Travel", explanation:"destination คือสถานที่ปลายทางของการเดินทาง" },
    { id:"cf04", word:"keyboard", thai:"แป้นพิมพ์", visual:"⌨️", category:"Technology", explanation:"keyboard เป็นอุปกรณ์ป้อนข้อมูลเข้าสู่คอมพิวเตอร์" },
    { id:"cf05", word:"password", thai:"รหัสผ่าน", visual:"🔐", category:"Technology", explanation:"password ใช้ยืนยันตัวตนและปกป้องบัญชีดิจิทัล" },
    { id:"cf06", word:"smartphone", thai:"โทรศัพท์อัจฉริยะ", visual:"📱", category:"Technology", explanation:"smartphone เป็นอุปกรณ์เทคโนโลยีเพื่อการสื่อสารและใช้งานแอป" },
    { id:"cf07", word:"recycle", thai:"นำกลับมาใช้ใหม่", visual:"♻️", category:"Environment", explanation:"recycle ช่วยลดขยะและผลกระทบต่อสิ่งแวดล้อม" },
    { id:"cf08", word:"pollution", thai:"มลพิษ", visual:"🏭", category:"Environment", explanation:"pollution คือสิ่งปนเปื้อนที่ทำลายสิ่งแวดล้อม" },
    { id:"cf09", word:"wildlife", thai:"สัตว์ป่า", visual:"🦋", category:"Environment", explanation:"wildlife เป็นส่วนหนึ่งของธรรมชาติและระบบนิเวศ" },
    { id:"cf10", word:"exercise", thai:"การออกกำลังกาย", visual:"🏃", category:"Health", explanation:"exercise ช่วยเสริมสร้างสมรรถภาพและสุขภาพ" },
    { id:"cf11", word:"hydration", thai:"การได้รับน้ำเพียงพอ", visual:"💧", category:"Health", explanation:"hydration ช่วยให้ร่างกายมีน้ำเพียงพอต่อการทำงาน" },
    { id:"cf12", word:"medicine", thai:"ยา", visual:"💊", category:"Health", explanation:"medicine ใช้รักษาหรือบรรเทาอาการเจ็บป่วย" }
  ]);

  const state = {
    identity:null,
    authority:null,
    stream:null,
    mode:"fallback",
    questions:[],
    index:0,
    correct:0,
    points:0,
    combo:0,
    answers:[],
    startedAt:0,
    locked:false,
    pendingPayload:null
  };

  function h(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shuffle(values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function readIdentity() {
    try { return JSON.parse(localStorage.getItem(cfg.cacheKeys.identity) || "null"); }
    catch (_) { return null; }
  }

  function showLoading(message) {
    loadingText.textContent = message || "กำลังโหลดข้อมูล…";
    loading.hidden = false;
  }
  function hideLoading() { loading.hidden = true; }

  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }

  function goPassport() {
    stopCamera();
    window.location.href = "./index.html?resume=1&v=20260803-category3";
  }

  function portalById(id) { return PORTALS.find(portal => portal.id === id); }

  function validateBank() {
    const validIds = new Set(PORTALS.map(portal => portal.id));
    const itemIds = new Set();
    const counts = Object.fromEntries(PORTALS.map(portal => [portal.id, 0]));
    ITEMS.forEach(item => {
      if (!item.id || itemIds.has(item.id)) throw new Error("CATEGORY_DUPLICATE_ITEM_ID");
      if (!item.word || !item.thai || !validIds.has(item.category)) throw new Error("CATEGORY_INVALID_ITEM");
      itemIds.add(item.id);
      counts[item.category] += 1;
    });
    PORTALS.forEach(portal => {
      if (counts[portal.id] !== 3) throw new Error("CATEGORY_UNBALANCED_BANK");
    });
    return true;
  }

  function renderScene(content) {
    root.innerHTML = `
      <div class="ar-fallback-bg"></div><div class="ar-shade"></div>
      <div class="ar-content"><div class="ar-intro-wrap">${content}</div></div>`;
  }

  function renderNeedLogin() {
    renderScene(`<section class="ar-card"><div class="ar-hero">🔐</div><h1>กรุณาเข้าสู่ระบบก่อน</h1>
      <p>Category Forest ต้องอ่านรหัสผู้เล่นและสิทธิ์ปลดล็อกจาก English Week Passport</p>
      <div class="ar-actions"><button id="loginBtn" class="ar-btn primary">กลับหน้า Login</button></div></section>`);
    document.getElementById("loginBtn").onclick = goPassport;
  }

  function renderLocked() {
    renderScene(`<section class="ar-card"><div class="ar-hero">🔒</div><h1>ด่านนี้ยังไม่ปลดล็อก</h1>
      <p>ต้องผ่าน Word Match Village ก่อนจึงจะเข้า Category Forest ได้</p>
      <div class="ar-actions"><button id="lockedBackBtn" class="ar-btn primary">กลับ English Passport</button></div></section>`);
    document.getElementById("lockedBackBtn").onclick = goPassport;
  }

  function renderIntro(message) {
    const cameraAvailable = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
    renderScene(`<section class="ar-card"><div class="ar-hero">🌳</div><h1>Category Forest AR</h1>
      <p>อ่านคำศัพท์และความหมายไทย แล้วส่งเข้าประตูหมวดที่ตรงกันให้ครบ 12 ข้อ</p>
      ${message ? `<div class="ar-notice">${h(message)}</div>` : ""}
      <div class="ar-notice"><strong>4 ประตูคงที่ตลอดเกม</strong><br>
        ✈️ Travel — การเดินทาง<br>💻 Technology — เทคโนโลยี<br>
        🌱 Environment — สิ่งแวดล้อม<br>❤️ Health — สุขภาพ</div>
      <div class="ar-notice">กล้องใช้เป็นฉากสดเท่านั้น ระบบไม่บันทึกหรืออัปโหลดภาพ</div>
      <div class="ar-actions ${cameraAvailable ? "two" : ""}">
        ${cameraAvailable ? '<button id="cameraBtn" class="ar-btn primary">📷 เปิดกล้อง AR</button>' : ""}
        <button id="fallbackBtn" class="ar-btn secondary">🌲 เล่นแบบไม่ใช้กล้อง</button>
        <button id="introBackBtn" class="ar-btn secondary">กลับ English Passport</button>
      </div></section>`);
    if (cameraAvailable) document.getElementById("cameraBtn").onclick = startCamera;
    document.getElementById("fallbackBtn").onclick = () => startGame("fallback");
    document.getElementById("introBackBtn").onclick = goPassport;
  }

  async function startCamera() {
    showLoading("กำลังเปิดกล้องด้านหลัง…");
    try {
      stopCamera();
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1280 }, height:{ ideal:720 } }
      });
      startGame("camera");
    } catch (error) {
      console.error("Category camera error", error);
      renderIntro(error?.name === "NotAllowedError"
        ? "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาเลือกเล่นแบบไม่ใช้กล้อง"
        : "เปิดกล้องไม่สำเร็จบนอุปกรณ์นี้ กรุณาเลือกเล่นแบบไม่ใช้กล้อง");
    } finally { hideLoading(); }
  }

  function startGame(mode) {
    validateBank();
    state.mode = mode;
    state.questions = shuffle(ITEMS);
    state.index = 0;
    state.correct = 0;
    state.points = 0;
    state.combo = 0;
    state.answers = [];
    state.startedAt = Date.now();
    state.locked = false;
    state.pendingPayload = null;
    renderGameShell();
    renderQuestion();
  }

  function renderGameShell() {
    root.innerHTML = `
      ${state.mode === "camera" ? '<video id="cameraVideo" class="ar-camera" autoplay muted playsinline></video>' : '<div class="ar-fallback-bg"></div>'}
      <div class="ar-shade"></div>
      <div class="ar-content">
        <div class="ar-hud">
          <div class="ar-progress-box"><small id="questionCount">ข้อ 1 / 12</small><div class="ar-progress-line"><span id="progressBar"></span></div></div>
          <div class="ar-score-box"><small>คะแนน</small><strong id="scoreText">0</strong></div>
        </div>
        <section class="ar-playfield"><div class="ar-reticle" aria-hidden="true"></div><div id="wordCard" class="ar-word-card"></div></section>
        <div id="feedback" class="ar-feedback">เลือกประตูที่ตรงกับความหมายของคำศัพท์</div>
        <div id="categoryButtons" class="ar-categories"></div>
      </div>`;
    if (state.mode === "camera" && state.stream) {
      const video = document.getElementById("cameraVideo");
      video.srcObject = state.stream;
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
  }

  function renderQuestion() {
    const question = state.questions[state.index];
    if (!question) return finishGame();
    state.locked = false;
    document.getElementById("questionCount").textContent = `ข้อ ${state.index + 1} / ${state.questions.length}`;
    document.getElementById("progressBar").style.width = `${Math.round((state.index / state.questions.length) * 100)}%`;
    document.getElementById("scoreText").textContent = String(state.points);
    document.getElementById("wordCard").innerHTML = `
      <span class="emoji">${h(question.visual)}</span>
      <span class="word">${h(question.word)}</span>
      <span class="prompt">${h(question.thai)}</span>
      <span class="prompt">คำนี้ควรเข้าสู่ประตูใด?</span>`;
    const feedback = document.getElementById("feedback");
    feedback.className = "ar-feedback";
    feedback.textContent = "เลือก 1 จาก 4 ประตูด้านล่าง";
    const buttons = document.getElementById("categoryButtons");
    buttons.innerHTML = PORTALS.map(portal => `
      <button class="ar-category" type="button" data-answer="${h(portal.id)}">
        <span>${portal.icon} ${h(portal.label)}</span><small>${h(portal.thai)}</small>
      </button>`).join("");
    buttons.querySelectorAll(".ar-category").forEach(button => {
      button.addEventListener("click", () => answer(button.dataset.answer));
    });
  }

  function answer(selected) {
    if (state.locked) return;
    state.locked = true;
    const question = state.questions[state.index];
    const correct = selected === question.category;
    if (correct) {
      state.correct += 1;
      state.combo += 1;
      state.points += 100 + Math.min(100, state.combo * 10);
    } else {
      state.combo = 0;
    }
    state.answers.push({
      itemId:question.id,
      word:question.word,
      selected,
      correctAnswer:question.category,
      correct,
      answeredAtMs:Date.now() - state.startedAt,
      inputMode:state.mode,
      bankVersion:VERSION
    });
    document.querySelectorAll(".ar-category").forEach(button => {
      button.disabled = true;
      if (button.dataset.answer === question.category) button.classList.add("correct");
      else if (button.dataset.answer === selected) button.classList.add("wrong");
    });
    document.getElementById("scoreText").textContent = String(state.points);
    const correctPortal = portalById(question.category);
    const feedback = document.getElementById("feedback");
    feedback.className = `ar-feedback ${correct ? "good" : "bad"}`;
    feedback.innerHTML = correct
      ? `<strong>ถูกต้อง! ${h(question.word)} → ${correctPortal.icon} ${h(correctPortal.label)} (${h(correctPortal.thai)})</strong><br>${h(question.explanation)}`
      : `<strong>คำตอบคือ ${correctPortal.icon} ${h(correctPortal.label)} — ${h(correctPortal.thai)}</strong><br>${h(question.explanation)}`;
    window.setTimeout(() => { state.index += 1; renderQuestion(); }, 1500);
  }

  async function finishGame() {
    const durationMs = Date.now() - state.startedAt;
    state.pendingPayload = {
      playerId:state.identity.playerId,
      nickname:state.authority?.profile?.nickname || state.authority?.profile?.fullName || state.identity.nickname,
      stageId:"category_forest",
      score:state.correct,
      total:state.questions.length,
      durationMs,
      answers:state.answers,
      clientPoints:state.points,
      inputMode:state.mode,
      gameMetrics:{ bankVersion:VERSION, portalCount:PORTALS.length, integrityValidated:true }
    };
    stopCamera();
    await submitResult(state.pendingPayload);
  }

  async function submitResult(payload) {
    showLoading("กำลังส่งผลและตรวจสิทธิ์ปลดล็อก…");
    try {
      const receipt = await authorityApi.submitGame(payload);
      if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");
      state.authority = receipt.authority;
      renderResult(receipt, payload.durationMs);
    } catch (error) {
      console.error("Category submit error", error);
      renderSubmitError(error);
    } finally { hideLoading(); }
  }

  function renderResult(receipt, durationMs) {
    const accuracy = Math.round((state.correct / state.questions.length) * 100);
    const passed = Boolean(receipt.passed);
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    renderScene(`<section class="ar-card"><div class="ar-hero">${passed ? "🌟" : "💪"}</div>
      <h1>${passed ? "ผ่าน Category Forest!" : "ยังไม่ผ่านภารกิจ"}</h1>
      <p>${passed ? "Server ยืนยันผลและปลดล็อก Sentence City แล้ว" : `ต้องได้อย่างน้อย ${receipt.passMark || 70}%`}</p>
      <div class="ar-result-ring" style="--angle:${accuracy * 3.6}deg"><div><strong>${accuracy}%</strong><small>Accuracy</small></div></div>
      <div class="ar-metrics">
        <div class="ar-metric"><strong>${state.correct}/${state.questions.length}</strong><small>ตอบถูก</small></div>
        <div class="ar-metric"><strong>${state.points}</strong><small>คะแนนเกม</small></div>
        <div class="ar-metric"><strong>${minutes}:${String(seconds).padStart(2,"0")}</strong><small>เวลา</small></div>
      </div>
      <div class="ar-notice">Receipt: ${h(receipt.receiptId || "SERVER-OK")}<br>Question Bank: ${VERSION}</div>
      <div class="ar-actions ${passed ? "" : "two"}">
        ${passed ? "" : '<button id="retryBtn" class="ar-btn secondary">เล่นอีกครั้ง</button>'}
        <button id="resultBackBtn" class="ar-btn primary">กลับ English Passport</button>
      </div></section>`);
    if (!passed) document.getElementById("retryBtn").onclick = () => renderIntro("เลือกโหมดเพื่อเริ่มรอบใหม่");
    document.getElementById("resultBackBtn").onclick = goPassport;
  }

  function renderSubmitError(error) {
    renderScene(`<section class="ar-card"><div class="ar-hero">📡</div><h1>ยังยืนยันผลไม่ได้</h1>
      <p>ระบบจะไม่ปลดล็อก Sentence City จนกว่าจะได้รับ Receipt จาก Server</p>
      <div class="ar-notice error">${h(friendlyError(error?.message))}</div>
      <div class="ar-actions"><button id="retrySubmitBtn" class="ar-btn primary">ลองส่งผลอีกครั้ง</button>
      <button id="submitBackBtn" class="ar-btn secondary">กลับ English Passport</button></div></section>`);
    document.getElementById("retrySubmitBtn").onclick = () => submitResult(state.pendingPayload);
    document.getElementById("submitBackBtn").onclick = goPassport;
  }

  function renderLoadError(error) {
    renderScene(`<section class="ar-card"><div class="ar-hero">⚠️</div><h1>โหลดเกมไม่สำเร็จ</h1>
      <div class="ar-notice error">${h(friendlyError(error?.message))}</div>
      <div class="ar-actions"><button id="reloadBtn" class="ar-btn primary">ลองโหลดอีกครั้ง</button>
      <button id="loadBackBtn" class="ar-btn secondary">กลับ English Passport</button></div></section>`);
    document.getElementById("reloadBtn").onclick = initialize;
    document.getElementById("loadBackBtn").onclick = goPassport;
  }

  function friendlyError(code) {
    const map = {
      REQUEST_TIMEOUT:"Server ตอบกลับช้าเกินกำหนด",
      NETWORK_ERROR:"เครือข่ายขัดข้อง",
      PLAYER_NOT_FOUND:"ไม่พบรหัสผู้เล่น",
      PLAYER_INACTIVE:"รหัสผู้เล่นถูกระงับ",
      STAGE_LOCKED:"ด่านนี้ยังไม่ปลดล็อก",
      RECEIPT_MISSING:"ไม่ได้รับหลักฐานยืนยันจาก Server",
      INVALID_SERVER_RESPONSE:"รูปแบบข้อมูลจาก Server ไม่ถูกต้อง",
      RESUME_FAILED:"กู้คืนความก้าวหน้าไม่สำเร็จ",
      CATEGORY_DUPLICATE_ITEM_ID:"คลัง Category มีรหัสคำซ้ำ",
      CATEGORY_INVALID_ITEM:"คลัง Category มีคำหรือหมวดไม่ถูกต้อง",
      CATEGORY_UNBALANCED_BANK:"คลัง Category ไม่สมดุลหมวดละ 3 คำ"
    };
    return map[code] || code || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  }

  async function initialize() {
    state.identity = readIdentity();
    if (!state.identity?.playerId) return renderNeedLogin();
    showLoading("กำลังตรวจสถานะและคลังคำ Category Forest…");
    try {
      validateBank();
      state.authority = await authorityApi.resume(state.identity.playerId, state.identity.nickname);
      if (!state.authority?.ok) throw new Error(state.authority?.error || "RESUME_FAILED");
      if (!state.authority.progress?.unlocked?.includes("category_forest")) return renderLocked();
      renderIntro();
    } catch (error) {
      console.error("Category initialize error", error);
      renderLoadError(error);
    } finally { hideLoading(); }
  }

  backBtn.addEventListener("click", goPassport);
  exitBtn.addEventListener("click", goPassport);
  window.addEventListener("pagehide", stopCamera);
  window.addEventListener("beforeunload", stopCamera);
  initialize();
}());
