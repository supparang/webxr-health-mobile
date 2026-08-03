(function () {
  "use strict";

  const cfg = window.EW_CONFIG;
  const bank = window.EW_WORD_BANK;
  const authorityApi = window.EW_AUTHORITY;
  const screen = document.getElementById("screen");
  const toast = document.getElementById("toast");
  const loading = document.getElementById("loading");
  const loadingText = document.getElementById("loadingText");
  const homeBtn = document.getElementById("homeBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const STAGES = Object.freeze([
    { id:"pre_challenge", title:"Pre-Challenge", subtitle:"สำรวจระดับคำศัพท์ก่อนเริ่ม", icon:"🧭", kind:"assessment" },
    { id:"word_match", title:"Word Match Village", subtitle:"จับคู่คำศัพท์กับความหมาย", icon:"🧩", kind:"game" },
    { id:"category_forest", title:"Category Forest", subtitle:"จำแนกคำศัพท์ตามหมวด", icon:"🌳", kind:"game" },
    { id:"sentence_city", title:"Sentence City", subtitle:"เลือกคำให้เหมาะกับบริบท", icon:"🏙️", kind:"game" },
    { id:"word_detective", title:"Word Detective Lab", subtitle:"สืบความหมายจากคำใบ้", icon:"🔎", kind:"game" },
    { id:"final_boss", title:"English Champion Arena", subtitle:"ภารกิจรวมทักษะ Final Boss", icon:"🏆", kind:"game" },
    { id:"post_challenge", title:"Post-Challenge", subtitle:"ตรวจพัฒนาการหลังจบภารกิจ", icon:"📈", kind:"assessment" },
    { id:"certificate", title:"Certificate", subtitle:"รับประกาศนียบัตรดิจิทัล", icon:"🎓", kind:"certificate" }
  ]);

  const state = {
    identity: null,
    authority: null,
    activeStage: null,
    questions: [],
    index: 0,
    answers: [],
    correct: 0,
    points: 0,
    combo: 0,
    startedAt: 0,
    answered: false,
    lastReceipt: null
  };

  function h(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showLoading(message) {
    loadingText.textContent = message || "กำลังโหลดข้อมูล…";
    loading.hidden = false;
  }
  function hideLoading() { loading.hidden = true; }
  function showToast(message, duration) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, duration || 2600);
  }
  function setNav({ home = false, logout = Boolean(state.identity) } = {}) {
    homeBtn.hidden = !home;
    logoutBtn.hidden = !logout;
  }
  function saveIdentity(identity) {
    state.identity = identity;
    localStorage.setItem(cfg.cacheKeys.identity, JSON.stringify(identity));
  }
  function readIdentity() {
    try { return JSON.parse(localStorage.getItem(cfg.cacheKeys.identity) || "null"); }
    catch (_) { return null; }
  }
  function clearIdentity() {
    localStorage.removeItem(cfg.cacheKeys.identity);
    state.identity = null;
    state.authority = null;
  }
  function profile() {
    return state.authority?.profile || state.identity || {};
  }
  function progress() {
    return state.authority?.progress || {
      unlocked: ["pre_challenge"], passed: [], bestScores: {}, preDone: false,
      postDone: false, finalDone: false, certificateEligible: false, totalScore: 0
    };
  }
  function stageById(id) { return STAGES.find(stage => stage.id === id); }
  function isUnlocked(id) { return progress().unlocked?.includes(id); }
  function isPassed(id) {
    if (id === "pre_challenge") return Boolean(progress().preDone);
    if (id === "post_challenge") return Boolean(progress().postDone);
    if (id === "certificate") return Boolean(progress().certificateEligible);
    return progress().passed?.includes(id);
  }
  function completedCount() { return STAGES.filter(stage => isPassed(stage.id)).length; }

  function modeBanner() {
    if (authorityApi.endpointReady()) {
      return '<div class="status-banner ok">● เชื่อมต่อ Google Sheet Authority แล้ว</div>';
    }
    return '<div class="status-banner">โหมดทดสอบบนเครื่อง — ยังไม่ได้ใส่ Web App URL ใน <code>config.js</code></div>';
  }

  function renderLogin() {
    clearSession();
    setNav({ home:false, logout:false });
    const cached = readIdentity();
    screen.innerHTML = `
      <section class="hero-card">
        <div class="hero-emoji">🗺️</div>
        <h1>English Week Passport</h1>
        <p class="lead">เดินทางผ่าน 4 เมืองคำศัพท์ พิชิต Final Boss และรับประกาศนียบัตร English Week</p>
        ${modeBanner()}
        <form id="loginForm" class="form-grid" novalidate>
          <div class="field">
            <label for="playerId">รหัสผู้เล่น</label>
            <input id="playerId" name="playerId" inputmode="numeric" autocomplete="off" maxlength="24" value="${h(cached?.playerId || "")}" placeholder="กรอกรหัสจากผู้จัดกิจกรรม" required />
          </div>
          ${authorityApi.endpointReady() ? "" : `
          <div class="field">
            <label for="nickname">ชื่อเล่นสำหรับทดสอบ</label>
            <input id="nickname" name="nickname" maxlength="40" value="${h(cached?.nickname || "")}" placeholder="เช่น Mint" />
          </div>`}
          <button class="btn btn-primary" type="submit">ตรวจสอบรหัสและเริ่มภารกิจ</button>
        </form>
        <p class="note" style="margin-top:14px">ข้อมูลความก้าวหน้าในระบบจริงจะอ่านจาก Google Sheet ทุกครั้ง ไม่ใช้สถานะในเครื่องเป็นหลัก</p>
      </section>`;

    document.getElementById("loginForm").addEventListener("submit", handleLogin);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const playerId = String(form.get("playerId") || "").trim();
    const nickname = String(form.get("nickname") || "").trim();
    if (!playerId) return showToast("กรุณากรอกรหัสผู้เล่น");
    showLoading("กำลังตรวจสอบรหัสจากระบบ…");
    try {
      const lookup = await authorityApi.profileLookup(playerId, nickname);
      if (!lookup?.ok || !lookup.profile) throw new Error(lookup?.error || "PLAYER_NOT_FOUND");
      saveIdentity({
        playerId: lookup.profile.playerId || playerId,
        nickname: lookup.profile.nickname || lookup.profile.fullName || nickname,
        fullName: lookup.profile.fullName || lookup.profile.nickname || nickname
      });
      state.authority = await authorityApi.resume(playerId, nickname);
      if (!state.authority?.ok) throw new Error(state.authority?.error || "RESUME_FAILED");
      if (progress().preDone) renderPassport(); else renderWelcome();
    } catch (error) {
      console.error(error);
      const message = error.message === "PLAYER_NOT_FOUND"
        ? "ไม่พบรหัสผู้เล่น กรุณาติดต่อเจ้าหน้าที่"
        : `โหลดข้อมูลไม่สำเร็จ: ${friendlyError(error.message)}`;
      showToast(message, 4200);
    } finally {
      hideLoading();
    }
  }

  function renderWelcome() {
    setNav({ home:false, logout:true });
    const p = profile();
    screen.innerHTML = `
      <section class="hero-card">
        <div class="hero-emoji">👋</div>
        <h1>ยินดีต้อนรับ ${h(p.nickname || p.fullName || "นักผจญภัย")}</h1>
        <p class="lead">ก่อนเปิด Passport ให้ทำ Pre-Challenge 10 ข้อเพื่อสำรวจระดับเริ่มต้น ผลส่วนนี้ไม่ใช้ตัดสินการผ่านกิจกรรม</p>
        <div class="panel" style="padding:16px;text-align:left;margin-top:18px">
          <strong>เส้นทางของคุณ</strong>
          <p class="note" style="margin:7px 0 0">Pre-Challenge → 4 Zones → Final Boss → Post-Challenge → Certificate</p>
        </div>
        <button id="startPreBtn" class="btn btn-primary" style="width:100%;margin-top:18px">เริ่ม Pre-Challenge</button>
      </section>`;
    document.getElementById("startPreBtn").addEventListener("click", () => startStage("pre_challenge"));
  }

  function renderPassport() {
    clearSession();
    setNav({ home:false, logout:true });
    const p = profile();
    const pr = progress();
    const pct = Math.round((completedCount() / STAGES.length) * 100);
    const cards = STAGES.map((stage) => {
      const passed = isPassed(stage.id);
      const unlocked = isUnlocked(stage.id);
      const statusClass = passed ? "passed" : unlocked ? "ready clickable" : "locked";
      const statusText = passed ? "ผ่านแล้ว ✓" : unlocked ? "เริ่มได้" : "ยังล็อก 🔒";
      const best = pr.bestScores?.[stage.id];
      return `
        <article class="stage-card ${statusClass}" data-stage="${h(stage.id)}" ${unlocked ? 'tabindex="0" role="button"' : ""}>
          <div class="stage-icon">${stage.icon}</div>
          <div>
            <strong>${h(stage.title)}</strong>
            <small>${h(stage.subtitle)}${Number.isFinite(Number(best)) ? ` • ดีที่สุด ${Number(best)}%` : ""}</small>
          </div>
          <div class="stage-state">${statusText}</div>
        </article>`;
    }).join("");

    screen.innerHTML = `
      <section class="profile-strip">
        <div class="avatar">🧑‍🚀</div>
        <div><strong>${h(p.nickname || p.fullName)}</strong><small>${h(p.groupName || cfg.defaultGroup)} • ${h(p.playerId)}</small></div>
        <div class="score-chip">${Number(pr.totalScore || 0)} pts</div>
      </section>
      <section class="panel" style="padding:18px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:end">
          <div><h2 style="margin:0">เส้นทาง Passport</h2><span class="note">ทำภารกิจตามลำดับเพื่อปลดล็อกด่านถัดไป</span></div>
          <strong>${pct}%</strong>
        </div>
        <div class="progress-track"><span style="width:${pct}%"></span></div>
        <div class="passport-map">${cards}</div>
      </section>
      <div class="btn-row two no-print">
        <button id="leaderboardBtn" class="btn btn-secondary">🏅 Leaderboard</button>
        <button id="refreshBtn" class="btn btn-secondary">↻ โหลดสถานะจาก Sheet</button>
      </div>`;

    screen.querySelectorAll(".stage-card.clickable").forEach(card => {
      const open = () => startStage(card.dataset.stage);
      card.addEventListener("click", open);
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
    });
    document.getElementById("leaderboardBtn").addEventListener("click", renderLeaderboard);
    document.getElementById("refreshBtn").addEventListener("click", refreshAuthority);
  }

  async function refreshAuthority() {
    if (!state.identity) return renderLogin();
    showLoading("กำลังโหลดสถานะล่าสุดจาก Google Sheet…");
    try {
      state.authority = await authorityApi.resume(state.identity.playerId, state.identity.nickname);
      if (!state.authority?.ok) throw new Error(state.authority?.error || "RESUME_FAILED");
      renderPassport();
      showToast("อัปเดตสถานะล่าสุดแล้ว");
    } catch (error) {
      console.error(error);
      showToast(`โหลดสถานะไม่สำเร็จ: ${friendlyError(error.message)}`, 4000);
    } finally { hideLoading(); }
  }

  function startStage(stageId) {
    if (!isUnlocked(stageId)) return showToast("ด่านนี้ยังไม่ปลดล็อก");
    if (stageId === "certificate") return renderCertificate();
    const stage = stageById(stageId);
    if (!stage) return;
    state.activeStage = stageId;
    state.index = 0;
    state.answers = [];
    state.correct = 0;
    state.points = 0;
    state.combo = 0;
    state.startedAt = Date.now();
    state.answered = false;
    if (stageId === "pre_challenge") state.questions = bank.assessment("A");
    else if (stageId === "post_challenge") state.questions = bank.assessment("B");
    else if (stageId === "final_boss") state.questions = bank.finalBoss(20);
    else state.questions = bank.questionsForZone(stageId, 10);
    renderQuestion();
  }

  function renderQuestion() {
    setNav({ home:false, logout:false });
    const stage = stageById(state.activeStage);
    const q = state.questions[state.index];
    if (!q) return finishStage();
    const progressPct = Math.round((state.index / state.questions.length) * 100);
    state.answered = false;
    screen.innerHTML = `
      <div class="question-meta" style="margin-bottom:10px">
        <span>${h(stage.title)}</span><span>คะแนน ${state.points}</span>
      </div>
      <div class="progress-track"><span style="width:${progressPct}%"></span></div>
      <section class="question-card">
        <div class="question-meta"><span>ข้อ ${state.index + 1} / ${state.questions.length}</span><span>Combo ×${Math.max(1, state.combo)}</span></div>
        <div class="question-prompt">
          <span class="visual" aria-hidden="true">${q.visual || "🔤"}</span>
          <h2>${h(q.prompt)}</h2>
        </div>
        <div id="answerGrid" class="answer-grid">
          ${q.options.map(option => `<button class="answer-btn" type="button" data-answer="${h(option)}">${h(option)}</button>`).join("")}
        </div>
        <div id="feedback" class="feedback">เลือกคำตอบที่ถูกต้อง</div>
        <button id="nextBtn" class="btn btn-primary" style="width:100%;margin-top:12px" hidden>${state.index === state.questions.length - 1 ? "ส่งผลภารกิจ" : "ข้อต่อไป"}</button>
      </section>`;

    screen.querySelectorAll(".answer-btn").forEach(button => {
      button.addEventListener("click", () => answerQuestion(button.dataset.answer));
    });
    document.getElementById("nextBtn").addEventListener("click", () => {
      state.index += 1;
      renderQuestion();
    });
  }

  function answerQuestion(selected) {
    if (state.answered) return;
    state.answered = true;
    const q = state.questions[state.index];
    const correct = selected === q.answer;
    const elapsedMs = Date.now() - state.startedAt;
    if (correct) {
      state.correct += 1;
      state.combo += 1;
      state.points += 100 + Math.min(100, state.combo * 10);
    } else {
      state.combo = 0;
    }
    state.answers.push({
      itemId: q.id,
      selected,
      correctAnswer: q.answer,
      correct,
      answeredAtMs: elapsedMs
    });

    screen.querySelectorAll(".answer-btn").forEach(button => {
      button.disabled = true;
      if (button.dataset.answer === q.answer) button.classList.add("correct");
      else if (button.dataset.answer === selected) button.classList.add("wrong");
    });
    const feedback = document.getElementById("feedback");
    feedback.className = `feedback ${correct ? "good" : "bad"}`;
    feedback.innerHTML = `<strong>${correct ? "ถูกต้อง!" : `คำตอบที่ถูกคือ “${h(q.answer)}”`}</strong><br>${h(q.explanation)}`;
    document.getElementById("nextBtn").hidden = false;
  }

  async function finishStage() {
    const stageId = state.activeStage;
    const stage = stageById(stageId);
    const durationMs = Date.now() - state.startedAt;
    const payloadBase = {
      playerId: state.identity.playerId,
      nickname: profile().nickname || profile().fullName,
      score: state.correct,
      total: state.questions.length,
      durationMs,
      answers: state.answers,
      clientPoints: state.points
    };
    showLoading("กำลังบันทึกผลและตรวจสิทธิ์ปลดล็อก…");
    try {
      let receipt;
      if (stage.kind === "assessment") {
        receipt = await authorityApi.submitAssessment({
          ...payloadBase,
          assessmentType: stageId === "pre_challenge" ? "pre" : "post",
          formId: stageId === "pre_challenge" ? "A" : "B"
        });
      } else {
        receipt = await authorityApi.submitGame({ ...payloadBase, stageId });
      }
      if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");
      state.authority = receipt.authority;
      state.lastReceipt = receipt;
      renderStageSummary(stageId, receipt, durationMs);
    } catch (error) {
      console.error(error);
      renderSubmitFailure(error);
    } finally { hideLoading(); }
  }

  function renderSubmitFailure(error) {
    setNav({ home:false, logout:false });
    screen.innerHTML = `
      <section class="summary-card">
        <div class="hero-emoji">📡</div>
        <h2>ยังยืนยันผลไม่ได้</h2>
        <p class="lead">ระบบจะไม่ปลดล็อกด่านถัดไปจนกว่าจะได้รับ Receipt จาก Server เพื่อป้องกันข้อมูลความก้าวหน้าคลาดเคลื่อน</p>
        <div class="status-banner error">${h(friendlyError(error.message))}</div>
        <div class="btn-row">
          <button id="retrySubmitBtn" class="btn btn-primary">ลองส่งผลอีกครั้ง</button>
          <button id="backPassportBtn" class="btn btn-secondary">กลับ English Passport</button>
        </div>
      </section>`;
    document.getElementById("retrySubmitBtn").addEventListener("click", finishStage);
    document.getElementById("backPassportBtn").addEventListener("click", refreshAuthority);
  }

  function renderStageSummary(stageId, receipt, durationMs) {
    setNav({ home:false, logout:false });
    const stage = stageById(stageId);
    const accuracy = Math.round((state.correct / state.questions.length) * 100);
    const assessment = stage.kind === "assessment";
    const passed = assessment ? true : Boolean(receipt.passed);
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const title = assessment
      ? (stageId === "pre_challenge" ? "บันทึกระดับเริ่มต้นแล้ว" : "จบการเดินทาง English Week แล้ว!")
      : (passed ? "ผ่านภารกิจแล้ว!" : "ยังไม่ผ่านภารกิจ");
    const message = assessment
      ? "ระบบบันทึกคำตอบครบถ้วนและอัปเดต Passport แล้ว"
      : passed
        ? "Server ยืนยันผลและปลดล็อกด่านถัดไปแล้ว"
        : `ต้องได้อย่างน้อย ${receipt.passMark || 70}% จึงจะปลดล็อกด่านถัดไป`;

    screen.innerHTML = `
      <section class="summary-card">
        <div class="hero-emoji">${passed ? "🌟" : "💪"}</div>
        <h2>${title}</h2>
        <p class="lead">${message}</p>
        <div class="result-ring" style="--score-angle:${accuracy * 3.6}deg"><div><strong>${accuracy}%</strong><small>Accuracy</small></div></div>
        <div class="metric-grid">
          <div class="metric"><strong>${state.correct}/${state.questions.length}</strong><small>ตอบถูก</small></div>
          <div class="metric"><strong>${state.points}</strong><small>Game points</small></div>
          <div class="metric"><strong>${minutes}:${String(seconds).padStart(2,"0")}</strong><small>เวลา</small></div>
        </div>
        <div class="status-banner ok">Receipt: ${h(receipt.receiptId || "SERVER-OK")}</div>
        <div class="btn-row ${!passed && !assessment ? "two" : ""}">
          ${!passed && !assessment ? '<button id="retryStageBtn" class="btn btn-secondary">ฝึกอีกครั้ง</button>' : ""}
          <button id="summaryNextBtn" class="btn btn-primary">${stageId === "post_challenge" ? "ดู Certificate" : "กลับ English Passport"}</button>
        </div>
      </section>`;

    if (!passed && !assessment) {
      document.getElementById("retryStageBtn").addEventListener("click", () => startStage(stageId));
    }
    document.getElementById("summaryNextBtn").addEventListener("click", () => {
      if (stageId === "post_challenge") renderCertificate(); else renderPassport();
    });
  }

  function renderCertificate() {
    if (!progress().certificateEligible) return showToast("Certificate ยังไม่ปลดล็อก");
    setNav({ home:true, logout:true });
    const p = profile();
    const cert = progress().certificate || {};
    const award = cert.awardLevel || authorityApi.awardLevel(progress().totalScore || 0);
    const issued = cert.issuedAt ? new Date(cert.issuedAt) : new Date();
    screen.innerHTML = `
      <section class="certificate">
        <p style="letter-spacing:.18em;font-weight:900;color:#9a7518">CERTIFICATE OF ACHIEVEMENT</p>
        <h1>English Week Passport</h1>
        <p class="lead">This certificate is proudly presented to</p>
        <h2 class="certificate-name">${h(p.fullName || p.nickname)}</h2>
        <p>for successfully completing the Vocabulary Adventure and earning the level</p>
        <h2 style="color:#9a7518">${h(award)}</h2>
        <p><strong>Total Passport Score:</strong> ${Number(progress().totalScore || 0)} points</p>
        <p><strong>Date:</strong> ${h(issued.toLocaleDateString("th-TH", { year:"numeric", month:"long", day:"numeric" }))}</p>
        <p class="certificate-id">Certificate ID: ${h(cert.certificateId || "PENDING-ID")}</p>
      </section>
      <div class="btn-row two no-print">
        <button id="printBtn" class="btn btn-primary">พิมพ์ / บันทึก Certificate</button>
        <button id="certPassportBtn" class="btn btn-secondary">กลับ English Passport</button>
      </div>`;
    document.getElementById("printBtn").addEventListener("click", () => window.print());
    document.getElementById("certPassportBtn").addEventListener("click", renderPassport);
  }

  async function renderLeaderboard() {
    setNav({ home:true, logout:true });
    showLoading("กำลังโหลด Leaderboard…");
    try {
      const result = await authorityApi.leaderboard(cfg.leaderboardLimit);
      if (!result?.ok) throw new Error(result?.error || "LEADERBOARD_FAILED");
      const rows = result.rows || [];
      screen.innerHTML = `
        <section class="panel" style="padding:20px">
          <h1>🏅 English Week Leaderboard</h1>
          <p class="lead">จัดอันดับจากคะแนนดีที่สุดที่ Server รับรองในแต่ละด่าน</p>
          <div class="leaderboard">
            ${rows.length ? rows.map((row, index) => `
              <div class="leader-row">
                <div class="leader-rank">${index < 3 ? ["🥇","🥈","🥉"][index] : index + 1}</div>
                <div><strong>${h(row.nickname || row.fullName || row.playerId)}</strong><small style="display:block;color:var(--muted)">${h(row.groupName || "English Week")}</small></div>
                <div class="leader-score">${Number(row.totalScore || 0)}</div>
              </div>`).join("") : '<div class="leader-row"><div>—</div><div>ยังไม่มีข้อมูลคะแนน</div><div>0</div></div>'}
          </div>
          <button id="leaderBackBtn" class="btn btn-primary" style="width:100%;margin-top:16px">กลับ English Passport</button>
        </section>`;
      document.getElementById("leaderBackBtn").addEventListener("click", renderPassport);
    } catch (error) {
      console.error(error);
      showToast(`โหลด Leaderboard ไม่สำเร็จ: ${friendlyError(error.message)}`, 4000);
      renderPassport();
    } finally { hideLoading(); }
  }

  function clearSession() {
    state.activeStage = null;
    state.questions = [];
    state.index = 0;
    state.answers = [];
    state.correct = 0;
    state.points = 0;
    state.combo = 0;
    state.startedAt = 0;
    state.answered = false;
    state.lastReceipt = null;
  }

  function friendlyError(code) {
    const map = {
      WEB_APP_URL_MISSING: "ยังไม่ได้กำหนด Web App URL",
      REQUEST_TIMEOUT: "Server ตอบกลับช้าเกินกำหนด",
      NETWORK_ERROR: "เครือข่ายขัดข้อง",
      PLAYER_NOT_FOUND: "ไม่พบรหัสผู้เล่น",
      PLAYER_INACTIVE: "รหัสผู้เล่นถูกระงับ",
      STAGE_LOCKED: "ด่านนี้ยังไม่ปลดล็อก",
      POST_NOT_UNLOCKED: "ยังไม่ผ่าน Final Boss",
      RECEIPT_MISSING: "ไม่ได้รับหลักฐานยืนยันจาก Server",
      INVALID_SERVER_RESPONSE: "รูปแบบข้อมูลจาก Server ไม่ถูกต้อง",
      RESUME_FAILED: "กู้คืนความก้าวหน้าไม่สำเร็จ"
    };
    return map[code] || code || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  }

  homeBtn.addEventListener("click", renderPassport);
  logoutBtn.addEventListener("click", () => {
    clearIdentity();
    renderLogin();
    showToast("ออกจากระบบแล้ว");
  });

  window.addEventListener("error", event => {
    console.error("EW runtime error", event.error || event.message);
  });

  renderLogin();
}());
