(function () {
  "use strict";

  const cfg = window.EW_CONFIG;
  const authorityApi = window.EW_AUTHORITY;
  const root = document.getElementById("memoryRoot");
  const loading = document.getElementById("memoryLoading");
  const loadingText = document.getElementById("memoryLoadingText");

  const PAIRS = Object.freeze([
    { id:"wm01", word:"journey", meaning:"การเดินทาง", emoji:"🧳" },
    { id:"wm02", word:"healthy", meaning:"มีสุขภาพดี", emoji:"🥗" },
    { id:"wm03", word:"environment", meaning:"สิ่งแวดล้อม", emoji:"🌱" },
    { id:"wm04", word:"device", meaning:"อุปกรณ์", emoji:"📱" },
    { id:"wm05", word:"volunteer", meaning:"อาสาสมัคร", emoji:"🙋" },
    { id:"wm06", word:"creative", meaning:"สร้างสรรค์", emoji:"🎨" },
    { id:"wm07", word:"protect", meaning:"ปกป้อง", emoji:"🛡️" },
    { id:"wm08", word:"community", meaning:"ชุมชน", emoji:"🏘️" },
    { id:"wm09", word:"improve", meaning:"พัฒนาให้ดีขึ้น", emoji:"📈" },
    { id:"wm10", word:"opportunity", meaning:"โอกาส", emoji:"🚪" },
    { id:"wm11", word:"schedule", meaning:"กำหนดการ", emoji:"🗓️" },
    { id:"wm12", word:"confident", meaning:"มั่นใจ", emoji:"💪" }
  ]);

  const state = {
    identity:null,
    authority:null,
    deck:[],
    first:null,
    second:null,
    boardLocked:false,
    matchedPairs:0,
    mistakes:0,
    flips:0,
    combo:0,
    bestCombo:0,
    points:0,
    startedAt:0,
    pairStats:{},
    pendingPayload:null,
    timerId:null
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

  function goPassport() {
    stopTimer();
    window.location.href = "./index.html?resume=memory&v=20260803-memory1";
  }

  function stopTimer() {
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = null;
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
      RESUME_FAILED:"กู้คืนความก้าวหน้าไม่สำเร็จ"
    };
    return map[code] || code || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  }

  function shell(content) {
    return `<div class="memory-shell">
      <header class="memory-top">
        <button id="backBtn" class="icon-btn" type="button" aria-label="กลับ Passport">←</button>
        <div class="title"><strong>🧩 Word Match Village</strong><small>Memory Pairing Mission</small></div>
        <button id="exitBtn" class="icon-btn" type="button" aria-label="ออกจากเกม">🗺️</button>
      </header>${content}</div>`;
  }

  function wireBackButtons() {
    const back = document.getElementById("backBtn");
    const exit = document.getElementById("exitBtn");
    if (back) back.addEventListener("click", goPassport);
    if (exit) exit.addEventListener("click", goPassport);
  }

  function renderNeedLogin() {
    root.innerHTML = shell(`<section class="intro-card">
      <div class="hero">🔐</div><h1>กรุณาเข้าสู่ระบบก่อน</h1>
      <p class="lead">Word Match Village ต้องใช้รหัสผู้เล่นจาก English Week Passport</p>
      <div class="action-grid"><button id="loginBtn" class="btn primary">กลับหน้า Login</button></div>
    </section>`);
    wireBackButtons();
    document.getElementById("loginBtn").addEventListener("click", goPassport);
  }

  function renderLocked() {
    root.innerHTML = shell(`<section class="intro-card">
      <div class="hero">🔒</div><h1>ด่านนี้ยังไม่ปลดล็อก</h1>
      <p class="lead">ทำ Pre-Challenge ให้ครบก่อน จึงจะเข้าสู่ Word Match Village ได้</p>
      <div class="action-grid"><button id="lockedBtn" class="btn primary">กลับ English Passport</button></div>
    </section>`);
    wireBackButtons();
    document.getElementById("lockedBtn").addEventListener("click", goPassport);
  }

  function renderIntro(message) {
    root.innerHTML = shell(`<section class="intro-card">
      <div class="hero">🧩</div><h1>Word Match Memory</h1>
      <p class="lead">เปิดการ์ดครั้งละ 2 ใบ แล้วจับคู่คำศัพท์ภาษาอังกฤษกับความหมายภาษาไทยให้ครบ 6 คู่</p>
      ${message ? `<div class="notice">${h(message)}</div>` : ""}
      <div class="notice"><strong>เกณฑ์ผ่าน:</strong> จับคู่ครบและรักษาความแม่นยำอย่างน้อย 70% ระบบให้โอกาสผิดได้ประมาณ 6 ครั้งก่อนคะแนนต่ำกว่าเกณฑ์</div>
      <div class="action-grid">
        <button id="startBtn" class="btn primary">เริ่มเปิดการ์ด</button>
        <button id="introBackBtn" class="btn secondary">กลับ English Passport</button>
      </div>
    </section>`);
    wireBackButtons();
    document.getElementById("startBtn").addEventListener("click", startGame);
    document.getElementById("introBackBtn").addEventListener("click", goPassport);
  }

  function startGame() {
    stopTimer();
    const selectedPairs = shuffle(PAIRS).slice(0, 6);
    state.deck = shuffle(selectedPairs.flatMap(pair => [
      { cardId:`${pair.id}-word`, pairId:pair.id, side:"word", label:pair.word, emoji:pair.emoji, matched:false, flipped:false },
      { cardId:`${pair.id}-meaning`, pairId:pair.id, side:"meaning", label:pair.meaning, emoji:pair.emoji, matched:false, flipped:false }
    ]));
    state.first = null;
    state.second = null;
    state.boardLocked = false;
    state.matchedPairs = 0;
    state.mistakes = 0;
    state.flips = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.points = 0;
    state.startedAt = Date.now();
    state.pairStats = Object.fromEntries(selectedPairs.map(pair => [pair.id, { attempts:0, matchedAtMs:null }]));
    state.pendingPayload = null;
    renderBoard();
    state.timerId = window.setInterval(updateElapsed, 1000);
  }

  function renderBoard() {
    root.innerHTML = shell(`<section class="hud">
      <div class="hud-box"><small>ความก้าวหน้า</small><strong id="matchCount">0 / 6 คู่</strong><div class="progress-line"><span id="matchProgress" style="width:0%"></span></div></div>
      <div class="hud-box"><small>เปิดผิด</small><strong id="mistakeCount">0</strong></div>
      <div class="hud-box"><small>เวลา</small><strong id="elapsed">0:00</strong></div>
    </section>
    <section class="panel game-panel">
      <p class="instruction">แตะเปิดการ์ดคำศัพท์ 1 ใบ และการ์ดความหมาย 1 ใบ</p>
      <div id="memoryGrid" class="memory-grid">${state.deck.map(cardHtml).join("")}</div>
      <div id="memoryFeedback" class="feedback">เริ่มจับคู่ได้เลย! ✨</div>
    </section>`);
    wireBackButtons();
    root.querySelectorAll(".memory-card").forEach(button => {
      button.addEventListener("click", () => flipCard(button.dataset.cardId));
    });
    updateHud();
  }

  function cardHtml(card) {
    return `<button class="memory-card${card.flipped ? " flipped" : ""}${card.matched ? " matched" : ""}" type="button" data-card-id="${h(card.cardId)}" aria-label="การ์ดคำศัพท์" ${card.matched ? "disabled" : ""}>
      <span class="memory-card-inner">
        <span class="memory-face memory-back">EW</span>
        <span class="memory-face memory-front ${card.side}">${card.side === "word" ? `<span>${h(card.emoji)}<br>${h(card.label)}</span>` : h(card.label)}</span>
      </span>
    </button>`;
  }

  function flipCard(cardId) {
    if (state.boardLocked) return;
    const card = state.deck.find(item => item.cardId === cardId);
    if (!card || card.matched || card.flipped) return;
    card.flipped = true;
    state.flips += 1;
    const button = root.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`);
    if (button) button.classList.add("flipped");

    if (!state.first) {
      state.first = card;
      setFeedback("เลือกการ์ดอีกใบเพื่อจับคู่", "");
      return;
    }

    state.second = card;
    state.boardLocked = true;
    const pairStat = state.pairStats[state.first.pairId];
    if (pairStat) pairStat.attempts += 1;
    evaluatePair();
  }

  function evaluatePair() {
    const first = state.first;
    const second = state.second;
    const matched = first.pairId === second.pairId && first.side !== second.side;
    if (matched) {
      first.matched = true;
      second.matched = true;
      state.matchedPairs += 1;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.points += 150 + Math.min(150, state.combo * 20);
      state.pairStats[first.pairId].matchedAtMs = Date.now() - state.startedAt;
      root.querySelectorAll(`[data-card-id="${CSS.escape(first.cardId)}"],[data-card-id="${CSS.escape(second.cardId)}"]`).forEach(button => {
        button.classList.add("matched");
        button.disabled = true;
      });
      setFeedback(`จับคู่ถูกต้อง! Combo ×${state.combo} 🌟`, "good");
      resetTurn(620, true);
    } else {
      state.mistakes += 1;
      state.combo = 0;
      root.querySelectorAll(`[data-card-id="${CSS.escape(first.cardId)}"],[data-card-id="${CSS.escape(second.cardId)}"]`).forEach(button => button.classList.add("wrong"));
      setFeedback("ยังไม่ใช่คู่เดียวกัน ลองจำตำแหน่งแล้วเปิดใหม่", "bad");
      resetTurn(880, false);
    }
    updateHud();
  }

  function resetTurn(delay, matched) {
    window.setTimeout(() => {
      const first = state.first;
      const second = state.second;
      if (!matched) {
        [first, second].forEach(card => {
          card.flipped = false;
          const button = root.querySelector(`[data-card-id="${CSS.escape(card.cardId)}"]`);
          if (button) button.classList.remove("flipped", "wrong");
        });
      }
      state.first = null;
      state.second = null;
      state.boardLocked = false;
      if (state.matchedPairs >= 6) finishGame();
    }, delay);
  }

  function updateHud() {
    const count = document.getElementById("matchCount");
    const progress = document.getElementById("matchProgress");
    const mistakes = document.getElementById("mistakeCount");
    if (count) count.textContent = `${state.matchedPairs} / 6 คู่`;
    if (progress) progress.style.width = `${Math.round((state.matchedPairs / 6) * 100)}%`;
    if (mistakes) mistakes.textContent = String(state.mistakes);
  }

  function updateElapsed() {
    const elapsed = document.getElementById("elapsed");
    if (!elapsed || !state.startedAt) return;
    const seconds = Math.floor((Date.now() - state.startedAt) / 1000);
    elapsed.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function setFeedback(message, className) {
    const feedback = document.getElementById("memoryFeedback");
    if (!feedback) return;
    feedback.className = `feedback${className ? ` ${className}` : ""}`;
    feedback.textContent = message;
  }

  function buildPayload() {
    const durationMs = Date.now() - state.startedAt;
    const masteryScore = Math.max(0, 10 - Math.floor(state.mistakes / 2));
    const answers = Object.entries(state.pairStats).map(([itemId, stat]) => ({
      itemId,
      selected:"matched-pair",
      correctAnswer:"word-meaning-pair",
      correct:true,
      pairAttempts:stat.attempts,
      matchedAtMs:stat.matchedAtMs,
      inputMode:"touch-memory"
    }));
    return {
      playerId:state.identity.playerId,
      nickname:state.authority?.profile?.nickname || state.authority?.profile?.fullName || state.identity.nickname,
      stageId:"word_match",
      score:masteryScore,
      total:10,
      durationMs,
      answers,
      clientPoints:state.points,
      inputMode:"touch-memory",
      gameMetrics:{
        pairs:6,
        mistakes:state.mistakes,
        flips:state.flips,
        bestCombo:state.bestCombo,
        masteryScore
      }
    };
  }

  async function finishGame() {
    stopTimer();
    state.pendingPayload = buildPayload();
    await submitResult(state.pendingPayload);
  }

  async function submitResult(payload) {
    showLoading("กำลังบันทึกผลและตรวจสิทธิ์ปลดล็อก…");
    try {
      const receipt = await authorityApi.submitGame(payload);
      if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");
      state.authority = receipt.authority;
      renderResult(receipt, payload);
    } catch (error) {
      console.error("Word Match submit error", error);
      renderSubmitError(error);
    } finally { hideLoading(); }
  }

  function renderResult(receipt, payload) {
    const accuracy = Math.round((payload.score / payload.total) * 100);
    const passed = Boolean(receipt.passed);
    const seconds = Math.floor(payload.durationMs / 1000);
    root.innerHTML = shell(`<section class="result-card">
      <div class="hero">${passed ? "🏅" : "💪"}</div>
      <h1>${passed ? "ผ่าน Word Match Village!" : "ยังไม่ผ่านภารกิจ"}</h1>
      <p class="lead">${passed ? "Server ยืนยันผลและปลดล็อก Category Forest AR แล้ว" : `ต้องได้อย่างน้อย ${receipt.passMark || 70}% ลองลดจำนวนการเปิดผิดในรอบถัดไป`}</p>
      <div class="result-ring" style="--angle:${accuracy * 3.6}deg"><div><strong>${accuracy}%</strong><small>Mastery</small></div></div>
      <div class="metrics">
        <div class="metric"><strong>${state.mistakes}</strong><small>เปิดผิด</small></div>
        <div class="metric"><strong>${state.bestCombo}</strong><small>Best combo</small></div>
        <div class="metric"><strong>${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,"0")}</strong><small>เวลา</small></div>
      </div>
      <div class="notice ok">Receipt: ${h(receipt.receiptId || "SERVER-OK")} • Touch Memory</div>
      <div class="action-grid ${passed ? "" : "two"}">
        ${passed ? "" : '<button id="retryBtn" class="btn secondary">เล่นอีกครั้ง</button>'}
        <button id="resultBackBtn" class="btn primary">กลับ English Passport</button>
      </div>
    </section>`);
    wireBackButtons();
    if (!passed) document.getElementById("retryBtn").addEventListener("click", startGame);
    document.getElementById("resultBackBtn").addEventListener("click", goPassport);
  }

  function renderSubmitError(error) {
    root.innerHTML = shell(`<section class="result-card">
      <div class="hero">📡</div><h1>ยังยืนยันผลไม่ได้</h1>
      <p class="lead">ระบบจะไม่ปลดล็อก Category Forest จนกว่าจะได้รับ Receipt จาก Server</p>
      <div class="notice error">${h(friendlyError(error && error.message))}</div>
      <div class="action-grid">
        <button id="retrySubmitBtn" class="btn primary">ลองส่งผลอีกครั้ง</button>
        <button id="errorBackBtn" class="btn secondary">กลับ English Passport</button>
      </div>
    </section>`);
    wireBackButtons();
    document.getElementById("retrySubmitBtn").addEventListener("click", () => submitResult(state.pendingPayload));
    document.getElementById("errorBackBtn").addEventListener("click", goPassport);
  }

  function renderLoadError(error) {
    root.innerHTML = shell(`<section class="result-card">
      <div class="hero">⚠️</div><h1>โหลดสถานะไม่สำเร็จ</h1>
      <div class="notice error">${h(friendlyError(error && error.message))}</div>
      <div class="action-grid">
        <button id="reloadBtn" class="btn primary">ลองโหลดอีกครั้ง</button>
        <button id="loadBackBtn" class="btn secondary">กลับ English Passport</button>
      </div>
    </section>`);
    wireBackButtons();
    document.getElementById("reloadBtn").addEventListener("click", initialize);
    document.getElementById("loadBackBtn").addEventListener("click", goPassport);
  }

  async function initialize() {
    state.identity = readIdentity();
    if (!state.identity?.playerId) return renderNeedLogin();
    showLoading("กำลังตรวจสถานะ Word Match Village…");
    try {
      state.authority = await authorityApi.resume(state.identity.playerId, state.identity.nickname);
      if (!state.authority?.ok) throw new Error(state.authority?.error || "RESUME_FAILED");
      if (!state.authority.progress?.unlocked?.includes("word_match")) return renderLocked();
      renderIntro();
    } catch (error) {
      console.error("Word Match initialize error", error);
      renderLoadError(error);
    } finally { hideLoading(); }
  }

  window.addEventListener("pagehide", stopTimer);
  window.addEventListener("beforeunload", stopTimer);
  initialize();
}());
