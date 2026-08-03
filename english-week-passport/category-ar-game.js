(function () {
  "use strict";

  const cfg = window.EW_CONFIG;
  const bank = window.EW_WORD_BANK;
  const authorityApi = window.EW_AUTHORITY;
  const root = document.getElementById("arRoot");
  const loading = document.getElementById("arLoading");
  const loadingText = document.getElementById("arLoadingText");
  const backBtn = document.getElementById("backBtn");
  const exitBtn = document.getElementById("exitBtn");

  const state = {
    identity: null,
    authority: null,
    stream: null,
    mode: "fallback",
    questions: [],
    index: 0,
    correct: 0,
    points: 0,
    combo: 0,
    answers: [],
    startedAt: 0,
    locked: false,
    pendingPayload: null
  };

  function h(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readIdentity() {
    try {
      return JSON.parse(localStorage.getItem(cfg.cacheKeys.identity) || "null");
    } catch (_) {
      return null;
    }
  }

  function showLoading(message) {
    loadingText.textContent = message || "กำลังโหลดข้อมูล…";
    loading.hidden = false;
  }

  function hideLoading() {
    loading.hidden = true;
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      state.stream = null;
    }
  }

  function goPassport() {
    stopCamera();
    window.location.href = "./index.html?resume=1&v=20260803-ar1";
  }

  function categoryIcon(category) {
    const icons = {
      Travel: "✈️",
      Technology: "💻",
      Environment: "🌱",
      Health: "❤️",
      Career: "💼",
      Food: "🍎"
    };
    return icons[category] || "🔤";
  }

  function extractWord(question) {
    const match = String(question.prompt || "").match(/“([^”]+)”/);
    return match ? match[1] : question.prompt;
  }

  function renderNeedLogin() {
    root.innerHTML = `
      <div class="ar-fallback-bg"></div><div class="ar-shade"></div>
      <div class="ar-content"><div class="ar-intro-wrap"><section class="ar-card">
        <div class="ar-hero">🔐</div>
        <h1>กรุณาเข้าสู่ระบบก่อน</h1>
        <p>Category Forest AR ต้องใช้รหัสผู้เล่นและสถานะปลดล็อกจาก English Week Passport</p>
        <div class="ar-actions"><button id="loginBtn" class="ar-btn primary">กลับไปหน้า Login</button></div>
      </section></div></div>`;
    document.getElementById("loginBtn").addEventListener("click", goPassport);
  }

  function renderLocked() {
    root.innerHTML = `
      <div class="ar-fallback-bg"></div><div class="ar-shade"></div>
      <div class="ar-content"><div class="ar-intro-wrap"><section class="ar-card">
        <div class="ar-hero">🔒</div>
        <h1>ด่านนี้ยังไม่ปลดล็อก</h1>
        <p>ต้องทำ Pre-Challenge และผ่าน Word Match Village ก่อน จึงจะเข้า Category Forest AR ได้</p>
        <div class="ar-actions"><button id="lockedBackBtn" class="ar-btn primary">กลับ English Passport</button></div>
      </section></div></div>`;
    document.getElementById("lockedBackBtn").addEventListener("click", goPassport);
  }

  function renderIntro(message) {
    const cameraAvailable = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
    root.innerHTML = `
      <div class="ar-fallback-bg"></div><div class="ar-shade"></div>
      <div class="ar-content"><div class="ar-intro-wrap"><section class="ar-card">
        <div class="ar-hero">🌳</div>
        <h1>Category Forest AR</h1>
        <p>คำศัพท์จะปรากฏตรงกลางฉาก เลือกประตูหมวดที่ถูกต้องให้ครบ 10 ข้อ ต้องได้อย่างน้อย 70% จึงจะปลดล็อก Sentence City</p>
        ${message ? `<div class="ar-notice">${h(message)}</div>` : ""}
        <div class="ar-notice">ระบบจะขอใช้กล้องเมื่อกด “เปิดกล้อง AR” เท่านั้น และไม่บันทึกภาพหรือวิดีโอ</div>
        <div class="ar-actions ${cameraAvailable ? "two" : ""}">
          ${cameraAvailable ? '<button id="cameraBtn" class="ar-btn primary">📷 เปิดกล้อง AR</button>' : ""}
          <button id="fallbackBtn" class="ar-btn secondary">🌲 เล่นแบบไม่ใช้กล้อง</button>
          <button id="introBackBtn" class="ar-btn secondary">กลับ English Passport</button>
        </div>
      </section></div></div>`;

    if (cameraAvailable) document.getElementById("cameraBtn").addEventListener("click", startCamera);
    document.getElementById("fallbackBtn").addEventListener("click", () => startGame("fallback"));
    document.getElementById("introBackBtn").addEventListener("click", goPassport);
  }

  async function startCamera() {
    showLoading("กำลังเปิดกล้องด้านหลัง…");
    try {
      stopCamera();
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      startGame("camera");
    } catch (error) {
      console.error("Category Forest camera error", error);
      const message = error && error.name === "NotAllowedError"
        ? "ไม่ได้รับอนุญาตให้ใช้กล้อง สามารถเล่นแบบไม่ใช้กล้องได้โดยใช้โจทย์และเกณฑ์เดียวกัน"
        : "เปิดกล้องไม่สำเร็จบนอุปกรณ์นี้ สามารถเล่นแบบไม่ใช้กล้องแทนได้";
      renderIntro(message);
    } finally {
      hideLoading();
    }
  }

  function startGame(mode) {
    state.mode = mode;
    state.questions = bank.questionsForZone("category_forest", 10);
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
          <div class="ar-progress-box"><small id="questionCount">ข้อ 1 / 10</small><div class="ar-progress-line"><span id="progressBar" style="width:0%"></span></div></div>
          <div class="ar-score-box"><small>คะแนน</small><strong id="scoreText">0</strong></div>
        </div>
        <section class="ar-playfield">
          <div class="ar-reticle" aria-hidden="true"></div>
          <div id="wordCard" class="ar-word-card"></div>
        </section>
        <div id="feedback" class="ar-feedback">เลือกหมวดที่เหมาะสมกับคำศัพท์</div>
        <div id="categoryButtons" class="ar-categories"></div>
      </div>`;

    if (state.mode === "camera" && state.stream) {
      const video = document.getElementById("cameraVideo");
      video.srcObject = state.stream;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
    }
  }

  function renderQuestion() {
    const question = state.questions[state.index];
    if (!question) return finishGame();
    state.locked = false;
    const word = extractWord(question);
    document.getElementById("questionCount").textContent = `ข้อ ${state.index + 1} / ${state.questions.length}`;
    document.getElementById("progressBar").style.width = `${Math.round((state.index / state.questions.length) * 100)}%`;
    document.getElementById("scoreText").textContent = state.points;
    document.getElementById("wordCard").innerHTML = `
      <span class="emoji">${h(question.visual || "🔤")}</span>
      <span class="word">${h(word)}</span>
      <span class="prompt">คำนี้อยู่ในหมวดใด?</span>`;
    const feedback = document.getElementById("feedback");
    feedback.className = "ar-feedback";
    feedback.textContent = state.mode === "camera" ? "เล็งคำศัพท์กลางฉาก แล้วแตะประตูหมวด" : "แตะหมวดที่ถูกต้อง";
    const categoryButtons = document.getElementById("categoryButtons");
    categoryButtons.innerHTML = question.options.map(option => `
      <button class="ar-category" type="button" data-answer="${h(option)}">${categoryIcon(option)} ${h(option)}</button>`).join("");
    categoryButtons.querySelectorAll(".ar-category").forEach(button => {
      button.addEventListener("click", () => answer(button.dataset.answer));
    });
  }

  function answer(selected) {
    if (state.locked) return;
    state.locked = true;
    const question = state.questions[state.index];
    const correct = selected === question.answer;
    if (correct) {
      state.correct += 1;
      state.combo += 1;
      state.points += 100 + Math.min(100, state.combo * 10);
    } else {
      state.combo = 0;
    }
    state.answers.push({
      itemId: question.id,
      selected,
      correctAnswer: question.answer,
      correct,
      answeredAtMs: Date.now() - state.startedAt,
      inputMode: state.mode
    });

    document.querySelectorAll(".ar-category").forEach(button => {
      button.disabled = true;
      if (button.dataset.answer === question.answer) button.classList.add("correct");
      else if (button.dataset.answer === selected) button.classList.add("wrong");
    });
    document.getElementById("scoreText").textContent = state.points;
    const feedback = document.getElementById("feedback");
    feedback.className = `ar-feedback ${correct ? "good" : "bad"}`;
    feedback.innerHTML = correct
      ? `<strong>ถูกต้อง! Combo ×${Math.max(1, state.combo)}</strong>`
      : `<strong>คำตอบที่ถูกคือ ${h(question.answer)}</strong>`;

    window.setTimeout(() => {
      state.index += 1;
      renderQuestion();
    }, 1050);
  }

  async function finishGame() {
    const durationMs = Date.now() - state.startedAt;
    const payload = {
      playerId: state.identity.playerId,
      nickname: state.authority?.profile?.nickname || state.authority?.profile?.fullName || state.identity.nickname,
      stageId: "category_forest",
      score: state.correct,
      total: state.questions.length,
      durationMs,
      answers: state.answers,
      clientPoints: state.points,
      inputMode: state.mode
    };
    state.pendingPayload = payload;
    stopCamera();
    await submitResult(payload);
  }

  async function submitResult(payload) {
    showLoading("กำลังส่งผลและตรวจสิทธิ์ปลดล็อก…");
    try {
      const receipt = await authorityApi.submitGame(payload);
      if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");
      state.authority = receipt.authority;
      renderResult(receipt, payload.durationMs);
    } catch (error) {
      console.error("Category Forest submit error", error);
      renderSubmitError(error);
    } finally {
      hideLoading();
    }
  }

  function renderResult(receipt, durationMs) {
    const accuracy = Math.round((state.correct / state.questions.length) * 100);
    const passed = Boolean(receipt.passed);
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    root.innerHTML = `
      <div class="ar-fallback-bg"></div><div class="ar-shade"></div>
      <div class="ar-content"><div class="ar-intro-wrap"><section class="ar-card">
        <div class="ar-hero">${passed ? "🌟" : "💪"}</div>
        <h1>${passed ? "ผ่าน Category Forest AR!" : "ยังไม่ผ่านภารกิจ"}</h1>
        <p>${passed ? "Server ยืนยันผลและปลดล็อก Sentence City แล้ว" : `ต้องได้อย่างน้อย ${receipt.passMark || 70}% จึงจะปลดล็อกด่านถัดไป`}</p>
        <div class="ar-result-ring" style="--angle:${accuracy * 3.6}deg"><div><strong>${accuracy}%</strong><small>Accuracy</small></div></div>
        <div class="ar-metrics">
          <div class="ar-metric"><strong>${state.correct}/${state.questions.length}</strong><small>ตอบถูก</small></div>
          <div class="ar-metric"><strong>${state.points}</strong><small>คะแนนเกม</small></div>
          <div class="ar-metric"><strong>${minutes}:${String(seconds).padStart(2, "0")}</strong><small>เวลา</small></div>
        </div>
        <div class="ar-notice">Receipt: ${h(receipt.receiptId || "SERVER-OK")} • Mode: ${h(state.mode)}</div>
        <div class="ar-actions ${passed ? "" : "two"}">
          ${passed ? "" : '<button id="retryBtn" class="ar-btn secondary">เล่นอีกครั้ง</button>'}
          <button id="resultBackBtn" class="ar-btn primary">กลับ English Passport</button>
        </div>
      </section></div></div>`;
    if (!passed) document.getElementById("retryBtn").addEventListener("click", () => renderIntro("เลือกโหมดเพื่อเริ่มรอบใหม่"));
    document.getElementById("resultBackBtn").addEventListener("click", goPassport);
  }

  function renderSubmitError(error) {
    root.innerHTML = `
      <div class="ar-fallback-bg"></div><div class="ar-shade"></div>
      <div class="ar-content"><div class="ar-intro-wrap"><section class="ar-card">
        <div class="ar-hero">📡</div>
        <h1>ยังยืนยันผลไม่ได้</h1>
        <p>ระบบจะไม่ปลดล็อก Sentence City จนกว่าจะได้รับ Receipt จาก Server</p>
        <div class="ar-notice error">${h(friendlyError(error && error.message))}</div>
        <div class="ar-actions">
          <button id="retrySubmitBtn" class="ar-btn primary">ลองส่งผลอีกครั้ง</button>
          <button id="submitBackBtn" class="ar-btn secondary">กลับ English Passport</button>
        </div>
      </section></div></div>`;
    document.getElementById("retrySubmitBtn").addEventListener("click", () => submitResult(state.pendingPayload));
    document.getElementById("submitBackBtn").addEventListener("click", goPassport);
  }

  function renderLoadError(error) {
    root.innerHTML = `
      <div class="ar-fallback-bg"></div><div class="ar-shade"></div>
      <div class="ar-content"><div class="ar-intro-wrap"><section class="ar-card">
        <div class="ar-hero">⚠️</div>
        <h1>โหลดสถานะไม่สำเร็จ</h1>
        <div class="ar-notice error">${h(friendlyError(error && error.message))}</div>
        <div class="ar-actions">
          <button id="reloadBtn" class="ar-btn primary">ลองโหลดอีกครั้ง</button>
          <button id="loadBackBtn" class="ar-btn secondary">กลับ English Passport</button>
        </div>
      </section></div></div>`;
    document.getElementById("reloadBtn").addEventListener("click", initialize);
    document.getElementById("loadBackBtn").addEventListener("click", goPassport);
  }

  function friendlyError(code) {
    const map = {
      REQUEST_TIMEOUT: "Server ตอบกลับช้าเกินกำหนด",
      NETWORK_ERROR: "เครือข่ายขัดข้อง",
      PLAYER_NOT_FOUND: "ไม่พบรหัสผู้เล่น",
      PLAYER_INACTIVE: "รหัสผู้เล่นถูกระงับ",
      STAGE_LOCKED: "ด่านนี้ยังไม่ปลดล็อก",
      RECEIPT_MISSING: "ไม่ได้รับหลักฐานยืนยันจาก Server",
      INVALID_SERVER_RESPONSE: "รูปแบบข้อมูลจาก Server ไม่ถูกต้อง",
      RESUME_FAILED: "กู้คืนความก้าวหน้าไม่สำเร็จ"
    };
    return map[code] || code || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  }

  async function initialize() {
    state.identity = readIdentity();
    if (!state.identity?.playerId) return renderNeedLogin();
    showLoading("กำลังตรวจสถานะ Category Forest…");
    try {
      state.authority = await authorityApi.resume(state.identity.playerId, state.identity.nickname);
      if (!state.authority?.ok) throw new Error(state.authority?.error || "RESUME_FAILED");
      if (!state.authority.progress?.unlocked?.includes("category_forest")) return renderLocked();
      renderIntro();
    } catch (error) {
      console.error("Category Forest initialize error", error);
      renderLoadError(error);
    } finally {
      hideLoading();
    }
  }

  backBtn.addEventListener("click", goPassport);
  exitBtn.addEventListener("click", goPassport);
  window.addEventListener("pagehide", stopCamera);
  window.addEventListener("beforeunload", stopCamera);

  initialize();
}());
