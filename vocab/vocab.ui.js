/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena
   UI / Screen / Reward / Navigation Controller
   ========================================================= */

"use strict";

/* =========================================================
   DOM HELPERS
========================================================= */

function byId(id){
  return document.getElementById(id);
}

function qs(sel, root){
  return (root || document).querySelector(sel);
}

function qsa(sel, root){
  return Array.from((root || document).querySelectorAll(sel));
}

function setTextV6(id, value){
  const el = byId(id);
  if(el) el.textContent = String(value ?? "");
}

function hideEl(id, hidden = true){
  const el = byId(id);
  if(!el) return;
  el.hidden = !!hidden;
  el.style.display = hidden ? "none" : "";
  el.style.pointerEvents = hidden ? "none" : "auto";
}

function escapeHtmlV6(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeNumber(v, fallback = 0){
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function fmtNumber(v){
  return String(Math.round(safeNumber(v, 0)));
}

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

function safeCall(fn, fallback){
  try{
    if(typeof fn === "function") return fn();
  }catch(e){
    console.warn("[VOCAB UI] safeCall warning", e);
  }
  return fallback;
}

/* =========================================================
   SCREEN GOVERNOR
========================================================= */

const VOCAB_SCREEN = {
  MENU: "menu",
  BATTLE: "battle",
  REWARD: "reward"
};

let vocabCurrentScreen = VOCAB_SCREEN.MENU;

function setVisibleScreenNode(node, visible, displayValue = ""){
  if(!node) return;

  node.hidden = !visible;
  node.style.display = visible ? displayValue : "none";
  node.style.pointerEvents = visible ? "auto" : "none";

  node.classList.toggle("vocab-screen-active", !!visible);
  node.classList.toggle("vocab-screen-hidden", !visible);
}

function getMenuPanelVocab(){
  return byId("v6MenuPanel");
}

function getBattlePanelVocab(){
  return byId("v6BattlePanel");
}

function getRewardPanelVocab(){
  return byId("v6RewardPanel");
}

function showMenuScreenV65(){
  vocabCurrentScreen = VOCAB_SCREEN.MENU;

  forceClearGameTimersVocabUI();
  forceRemoveGameFxVocabUI();

  setVisibleScreenNode(getMenuPanelVocab(), true, "");
  setVisibleScreenNode(getBattlePanelVocab(), false);
  setVisibleScreenNode(getRewardPanelVocab(), false);

  window.scrollTo({ top:0, behavior:"auto" });

  try{
    renderLeaderboardV68(VOCAB_APP?.selectedMode || "learn");
  }catch(e){}
}

function showBattleScreenV6(){
  vocabCurrentScreen = VOCAB_SCREEN.BATTLE;

  setVisibleScreenNode(getMenuPanelVocab(), false);
  setVisibleScreenNode(getRewardPanelVocab(), false);
  setVisibleScreenNode(getBattlePanelVocab(), true, "");

  window.scrollTo({ top:0, behavior:"auto" });
}

function showRewardScreenVocabUI(){
  vocabCurrentScreen = VOCAB_SCREEN.REWARD;

  forceClearGameTimersVocabUI();

  setVisibleScreenNode(getMenuPanelVocab(), false);
  setVisibleScreenNode(getBattlePanelVocab(), false);
  setVisibleScreenNode(getRewardPanelVocab(), true, "block");

  const reward = getRewardPanelVocab();
  if(reward){
    reward.style.position = "relative";
    reward.style.zIndex = "30";
    reward.style.minHeight = "auto";
    reward.style.height = "auto";
    reward.style.overflow = "visible";
  }

  window.scrollTo({ top:0, behavior:"auto" });
}

function governVocabScreen(){
  const reward = getRewardPanelVocab();
  const battle = getBattlePanelVocab();
  const menu = getMenuPanelVocab();

  if(!reward || !battle || !menu) return;

  const rewardHasContent = !!(reward.innerHTML || "").trim();
  const rewardVisible = !reward.hidden && reward.style.display !== "none";

  if(rewardHasContent && rewardVisible && vocabCurrentScreen === VOCAB_SCREEN.REWARD){
    showRewardScreenVocabUI();
    return;
  }

  if(window.vocabGame && vocabGame.active){
    showBattleScreenV6();
    return;
  }

  if(vocabCurrentScreen === VOCAB_SCREEN.MENU){
    showMenuScreenV65();
  }
}

/* =========================================================
   TIMER / FX CLEANUP
========================================================= */

function forceClearGameTimersVocabUI(){
  try{
    if(window.vocabGame){
      if(vocabGame.timerId){
        clearInterval(vocabGame.timerId);
        clearTimeout(vocabGame.timerId);
        vocabGame.timerId = null;
      }

      if(vocabGame.feverTimerId){
        clearInterval(vocabGame.feverTimerId);
        clearTimeout(vocabGame.feverTimerId);
        vocabGame.feverTimerId = null;
      }

      vocabGame.fever = false;
      vocabGame.feverUntil = 0;
    }
  }catch(e){}

  try{
    if(typeof clearTimerV6 === "function") clearTimerV6();
  }catch(e){}

  try{
    if(typeof stopFeverV62 === "function") stopFeverV62();
  }catch(e){}
}

function forceRemoveGameFxVocabUI(){
  [
    ".v6-float",
    ".v6-laser-beam",
    ".v6-fx-burst",
    ".v72-announcer",
    ".v72-flash",
    ".v72-particle",
    ".v74-toast",
    ".v78-guard-toast"
  ].forEach(sel => {
    qsa(sel).forEach(node => {
      try{ node.remove(); }catch(e){}
    });
  });

  document.body.classList.remove(
    "v72-screen-shake",
    "v72-hard-hit",
    "v72-boss-rage",
    "v72-fever-rainbow",
    "v73-final-lock"
  );
}

/* =========================================================
   MENU UI
========================================================= */

function getSelectedBankV6(){
  return VOCAB_APP?.selectedBank || "A";
}

function getSelectedDifficultyV6(){
  return VOCAB_APP?.selectedDifficulty || "easy";
}

function getSelectedModeV66(){
  return VOCAB_APP?.selectedMode || "learn";
}

function getModeConfigVocabUI(modeId){
  if(typeof getModeConfigV66 === "function"){
    return getModeConfigV66(modeId);
  }

  return VOCAB_PLAY_MODES?.[modeId || "learn"] || {
    id:"learn",
    label:"AI Training",
    shortLabel:"AI",
    icon:"🤖",
    description:"ฝึกคำศัพท์พร้อมคำแนะนำ"
  };
}

function updateV6BankLabel(){
  const el = byId("v6BankLabel");
  if(!el) return;

  const bank = window.vocabGame?.bank || VOCAB_APP?.selectedBank || "A";
  const modeId = window.vocabGame?.mode || VOCAB_APP?.selectedMode || "learn";
  const mode = getModeConfigVocabUI(modeId);

  el.textContent = `Bank ${bank} • ${mode.icon || "🤖"} ${mode.label || "AI Training"}`;
}

function updateV66ModeHud(){
  const el = byId("v66ModeHud");
  if(!el) return;

  const mode = getModeConfigVocabUI(window.vocabGame?.mode || VOCAB_APP?.selectedMode || "learn");
  el.textContent = `${mode.icon || "🤖"} ${mode.shortLabel || mode.label || "AI"}`;
}

function updateV6DiffPreview(){
  const el = byId("v6DiffPreview");
  if(!el) return;

  const d = VOCAB_APP?.selectedDifficulty || "easy";

  const text = {
    easy: "✨ Easy: คำถามตรง เวลาเยอะ เหมาะกับการทบทวนพื้นฐาน",
    normal: "⚔️ Normal: เริ่มมีตัวเลือกหลอก ต้องเข้าใจคำศัพท์มากขึ้น",
    hard: "🔥 Hard: ตัวเลือกยากขึ้น เวลาเร็วขึ้น เหมาะกับคนที่เริ่มแม่น",
    challenge: "💀 Challenge: เวลาน้อย ตัวเลือกหลอกหนัก เหมาะกับการท้าทาย"
  };

  el.textContent = text[d] || text.easy;
}

function updateV66ModePreview(){
  const el = byId("v66ModePreview");
  if(!el) return;

  const mode = getModeConfigVocabUI(getSelectedModeV66());
  el.textContent = `${mode.icon || "🤖"} ${mode.label || "AI Training"}: ${mode.description || "ฝึกคำศัพท์แบบสนุกและท้าทาย"}`;
}

function syncMenuSelectionsVocabUI(options){
  const opt = options || {};

  if(window.VOCAB_APP){
    if(opt.bank) VOCAB_APP.selectedBank = opt.bank;
    if(opt.difficulty) VOCAB_APP.selectedDifficulty = opt.difficulty;
    if(opt.mode) VOCAB_APP.selectedMode = opt.mode;
  }

  qsa("[data-v6-bank]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.v6Bank === VOCAB_APP.selectedBank);
  });

  qsa("[data-v6-diff]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.v6Diff === VOCAB_APP.selectedDifficulty);
  });

  qsa("[data-v6-mode]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.v6Mode === VOCAB_APP.selectedMode);
  });

  updateV6DiffPreview();
  updateV66ModePreview();
  updateV6BankLabel();
  updateV66ModeHud();
}

function initVocabV6UI(){
  qsa("[data-v6-bank]").forEach(btn => {
    btn.addEventListener("click", () => {
      VOCAB_APP.selectedBank = btn.dataset.v6Bank || "A";
      syncMenuSelectionsVocabUI({
        bank: VOCAB_APP.selectedBank,
        difficulty: VOCAB_APP.selectedDifficulty,
        mode: VOCAB_APP.selectedMode
      });

      try{
        if(typeof v74RenderMenu === "function") v74RenderMenu();
      }catch(e){}
    });
  });

  qsa("[data-v6-diff]").forEach(btn => {
    btn.addEventListener("click", () => {
      VOCAB_APP.selectedDifficulty = btn.dataset.v6Diff || "easy";
      syncMenuSelectionsVocabUI({
        bank: VOCAB_APP.selectedBank,
        difficulty: VOCAB_APP.selectedDifficulty,
        mode: VOCAB_APP.selectedMode
      });
    });
  });

  qsa("[data-v6-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      VOCAB_APP.selectedMode = btn.dataset.v6Mode || "learn";
      syncMenuSelectionsVocabUI({
        bank: VOCAB_APP.selectedBank,
        difficulty: VOCAB_APP.selectedDifficulty,
        mode: VOCAB_APP.selectedMode
      });
    });
  });

  const startBtn = byId("v6StartBtn");
  if(startBtn){
    startBtn.addEventListener("click", () => {
      if(typeof validateStudentInfoBeforeStart === "function"){
        const ok = validateStudentInfoBeforeStart();
        if(!ok) return;
      }

      if(typeof startVocabBattleV6 === "function"){
        startVocabBattleV6({
          bank: VOCAB_APP.selectedBank,
          difficulty: VOCAB_APP.selectedDifficulty,
          mode: VOCAB_APP.selectedMode
        });
      }
    });
  }

  const hintBtn = byId("v6HintBtn");
  if(hintBtn && typeof useHintV62 === "function"){
    hintBtn.addEventListener("click", useHintV62);
  }

  const aiHelpBtn = byId("v67AiHelpBtn");
  if(aiHelpBtn && typeof useAiHelpV67 === "function"){
    aiHelpBtn.addEventListener("click", useAiHelpV67);
  }

  qsa("[data-lb-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.lbMode || "learn";

      qsa("[data-lb-mode]").forEach(x => {
        x.classList.toggle("active", x === btn);
      });

      if(typeof renderLeaderboardV68 === "function"){
        renderLeaderboardV68(mode);
      }
    });
  });

  syncMenuSelectionsVocabUI({
    bank: VOCAB_APP.selectedBank,
    difficulty: VOCAB_APP.selectedDifficulty,
    mode: VOCAB_APP.selectedMode
  });
}

/* =========================================================
   STUDENT MODE CLEANUP
========================================================= */

function isTeacherModeVocabUI(){
  try{
    const p = new URL(location.href).searchParams;
    return (
      p.get("teacher") === "1" ||
      p.get("role") === "teacher" ||
      p.get("admin") === "1" ||
      p.get("qa") === "1" ||
      p.get("debug") === "1"
    );
  }catch(e){
    return false;
  }
}

function cleanStudentMenuVocabUI(){
  document.title = "TechPath Vocab Arena";

  const h1 = qs(".v6-hero-card h1");
  if(h1) h1.textContent = "TechPath Vocab Arena";

  const subtitle = qs(".v6-subtitle");
  if(subtitle){
    subtitle.textContent = "ฝึกศัพท์สาย CS/AI สำหรับนักศึกษาปี 2 ผ่านโหมดท้าทายและระบบ AI Learning";
  }

  const startBtn = byId("v6StartBtn");
  if(startBtn && startBtn.closest){
    const startCard = startBtn.closest(".v6-card");
    if(startCard){
      const h2 = startCard.querySelector("h2");
      if(h2) h2.textContent = "เริ่มเล่น";

      const missionRow = startCard.querySelector(".v6-mission-row");
      if(missionRow) missionRow.style.display = "none";

      if(!byId("vocabStudentStartNote")){
        const note = document.createElement("p");
        note.id = "vocabStudentStartNote";
        note.className = "v63-note";
        note.textContent = "เลือก Word Bank, ระดับ, โหมดการเล่น และกรอกข้อมูลผู้เรียนให้ครบ จากนั้นกด Start เพื่อเริ่มเกม";
        startCard.insertBefore(note, startBtn);
      }
    }
  }

  if(!isTeacherModeVocabUI()){
    hideOptionalStudentPanelsVocabUI();
  }
}

function hideOptionalStudentPanelsVocabUI(){
  const knownIds = [
    "v78FinalPanel",
    "v791SetupCard",
    "v79LiveBoardWrap",
    "v76Board",
    "v77Panel",
    "v75Campaign",
    "v74UnlockPanel"
  ];

  knownIds.forEach(x => {
    const el = byId(x);
    if(el) el.style.display = "none";
  });

  qsa(".v73-reward-panel, .v74-reward-panel, #v75Reward, #v76Reward, #v77Reward").forEach(el => {
    el.style.display = "none";
  });
}

/* =========================================================
   HUD
========================================================= */

function updateHudV6(){
  if(!window.vocabGame) return;

  setTextV6("v6Score", vocabGame.score || 0);
  setTextV6("v6Combo", `x${vocabGame.combo || 0}`);

  const hp = safeNumber(vocabGame.playerHp, 0);
  setTextV6("v6Hp", hp > 0 ? "❤️".repeat(Math.min(hp, 8)) : "💔");

  const total = typeof getTotalPlannedQuestionsV6 === "function"
    ? getTotalPlannedQuestionsV6()
    : safeNumber(vocabGame.stagePlan?.reduce((s,x) => s + safeNumber(x.count), 0), 0);

  setTextV6("v6QuestionNo", `${vocabGame.globalQuestionIndex || 0}/${total || 0}`);

  const enemyHpFill = byId("v6EnemyHpFill");
  const enemyHpText = byId("v6EnemyHpText");
  const enemyMax = Math.max(1, safeNumber(vocabGame.enemyHpMax, 100));
  const hpPct = clamp((safeNumber(vocabGame.enemyHp, 0) / enemyMax) * 100, 0, 100);

  if(enemyHpFill) enemyHpFill.style.width = `${hpPct}%`;
  if(enemyHpText) enemyHpText.textContent = `${Math.round(hpPct)}%`;

  updateV6BankLabel();
  updateV66ModeHud();

  if(typeof updatePowerHudV62 === "function"){
    updatePowerHudV62();
  }
}

/* =========================================================
   QUESTION UI
========================================================= */

function lockChoicesV6(){
  qsa(".v6-choice").forEach(btn => {
    btn.disabled = true;
    btn.classList.add("locked");
  });
}

function getCorrectChoiceTextVocabUI(question){
  if(typeof getCorrectChoiceTextV62 === "function"){
    return getCorrectChoiceTextV62(question);
  }

  if(!question) return "";
  const term = question.correctTerm || {};

  if(question.answerMode === "meaning"){
    return term.meaning || term.definition || "";
  }

  return term.term || term.word || "";
}

function revealCorrectChoiceV6(){
  const correctText = getCorrectChoiceTextVocabUI(window.vocabGame?.currentQuestion);

  qsa(".v6-choice").forEach(btn => {
    const text = btn.textContent || "";
    if(correctText && text.includes(correctText)){
      btn.classList.add("correct");
    }
  });
}

function showAnswerExplainV61(isCorrect, question){
  const box = byId("v6ExplainBox");
  if(!box) return;

  const correctWord = question?.correctTerm?.term || question?.correctTerm?.word || "";
  const correctMeaning = question?.correctTerm?.meaning || question?.correctTerm?.definition || "";

  box.hidden = false;
  box.innerHTML = isCorrect
    ? `✅ ถูกต้อง! <b>${escapeHtmlV6(correctWord)}</b> = ${escapeHtmlV6(correctMeaning)}`
    : `💡 คำตอบที่ถูกคือ <b>${escapeHtmlV6(correctWord)}</b> = ${escapeHtmlV6(correctMeaning)}`;

  setTimeout(() => {
    if(box) box.hidden = true;
  }, isCorrect ? 900 : 1500);
}

function showStageIntroV6(stage){
  if(typeof showFloatingTextV6 === "function"){
    showFloatingTextV6(`${stage.icon || "✨"} ${stage.name || "Next Stage"}`, "stage");
  }

  if(typeof playSfxV6 === "function"){
    playSfxV6("stage");
  }
}

/* =========================================================
   REWARD DATA FORMAT
========================================================= */

function modeIconVocabReward(mode){
  const m = String(mode || "").toLowerCase();
  if(m === "speed") return "⚡";
  if(m === "mission") return "🎯";
  if(m === "battle") return "👾";
  if(m === "bossrush") return "💀";
  return "🤖";
}

function getNextDifficultyVocabReward(result){
  const acc = safeNumber(result?.accuracy, 0);
  const diff = String(result?.difficulty || "normal").toLowerCase();

  if(acc >= 95){
    if(diff === "easy") return "normal";
    if(diff === "normal") return "hard";
    if(diff === "hard") return "challenge";
    return "challenge";
  }

  if(acc >= 85){
    if(diff === "easy") return "normal";
    if(diff === "normal") return "hard";
    return diff || "normal";
  }

  if(acc < 60) return "easy";

  return diff || "normal";
}

function getNextModeVocabReward(result, coach){
  const acc = safeNumber(result?.accuracy, 0);
  const mode = String(result?.mode || "").toLowerCase();

  if(coach && coach.nextMode){
    return String(coach.nextMode);
  }

  if(mode === "learn" && acc >= 80) return "Debug Mission";
  if(mode === "speed" && acc >= 80) return "Debug Mission";
  if(mode === "mission" && acc >= 80) return "Boss Battle";
  if(acc >= 90) return "Debug Mission";
  if(acc >= 75) return "Speed Run";

  return "AI Training";
}

function getCoachTextVocabReward(result, coach){
  if(coach && coach.headline){
    return String(coach.headline);
  }

  const acc = safeNumber(result?.accuracy, 0);
  const combo = safeNumber(result?.comboMax, 0);

  if(acc >= 90 && combo >= 4){
    return "แม่นยำมาก รอบต่อไปลองใช้คำศัพท์ในสถานการณ์จริงเพื่อเพิ่มความท้าทาย";
  }

  if(acc >= 75){
    return "พื้นฐานดีแล้ว รอบต่อไปเน้นอ่าน context และทำ combo ให้ต่อเนื่องขึ้น";
  }

  return "เริ่มต้นได้ดี รอบต่อไปลองฝึกคำที่พลาดและใช้ AI Help เฉพาะตอนจำเป็น";
}

function getWeakTextVocabReward(result){
  const list = Array.isArray(result?.weakestTerms) ? result.weakestTerms : [];
  if(!list.length) return "ยังไม่พบคำที่ควรทบทวน";

  const terms = list
    .slice(0, 4)
    .map(x => x.term || x.word || "")
    .filter(Boolean);

  return terms.length ? terms.join(" • ") : "ยังไม่พบคำที่ควรทบทวน";
}

function statCardVocabReward(label, value, sub = ""){
  return `
    <div class="v81-stat-card">
      <b>${escapeHtmlV6(value)}</b>
      <span>${escapeHtmlV6(label)}</span>
      ${sub ? `<small>${escapeHtmlV6(sub)}</small>` : ""}
    </div>
  `;
}

function compactResultCardsVocabReward(result){
  const rank = result?.rank ? `#${result.rank}` : "-";
  const personalBest = result?.personalBest || result?.score || 0;
  const improvement = safeNumber(result?.improvement, 0);

  const improveText = improvement > 0
    ? `+${improvement}`
    : improvement < 0
      ? `${Math.abs(improvement)} to PB`
      : "0";

  return `
    <div class="v81-stat-grid">
      ${statCardVocabReward("Score", fmtNumber(result?.score))}
      ${statCardVocabReward("Accuracy", `${fmtNumber(result?.accuracy)}%`)}
      ${statCardVocabReward("Best Combo", `x${fmtNumber(result?.comboMax)}`)}
      ${statCardVocabReward("Rank", rank)}
      ${statCardVocabReward("Personal Best", fmtNumber(personalBest))}
      ${statCardVocabReward("Progress", improveText)}
    </div>
  `;
}

function detailCardsVocabReward(result, reward){
  const weakText = getWeakTextVocabReward(result);
  const fever = result?.feverCount || result?.powerStats?.feverCount || 0;
  const aiHelp = result?.aiHelpUsed || result?.powerStats?.aiHelpUsed || 0;
  const stars = reward?.stars || 0;
  const duration = result?.durationSec || 0;
  const correct = result?.correct || 0;
  const wrong = result?.wrong || 0;

  return `
    <div class="v81-detail-grid">
      ${statCardVocabReward("Stars", "⭐".repeat(stars) || "-")}
      ${statCardVocabReward("Fever", fmtNumber(fever))}
      ${statCardVocabReward("AI Help", fmtNumber(aiHelp))}
      ${statCardVocabReward("Time", `${fmtNumber(duration)}s`)}
      ${statCardVocabReward("Correct", fmtNumber(correct))}
      ${statCardVocabReward("Wrong", fmtNumber(wrong))}
      ${statCardVocabReward("Weak Words", weakText)}
    </div>
  `;
}

function studentDetailsVocabReward(result, reward){
  return `
    <details class="v81-details">
      <summary>Details</summary>
      <div class="v81-details-body">
        ${detailCardsVocabReward(result, reward)}
        <p class="v81-muted">
          ข้อมูลรายละเอียดถูกใช้เพื่อช่วยแนะนำเส้นทางฝึกครั้งต่อไป โดยหน้าผู้เรียนจะแสดงเฉพาะข้อมูลที่จำเป็น
        </p>
      </div>
    </details>
  `;
}

function teacherDetailsVocabReward(result){
  if(!isTeacherModeVocabUI()) return "";

  const stageStats = result?.stageStats || {};
  const stages = Object.keys(stageStats).map(k => {
    const s = stageStats[k] || {};
    const total = safeNumber(s.correct) + safeNumber(s.wrong);
    const acc = total ? Math.round((safeNumber(s.correct) / total) * 100) : 0;
    return `${k}: ${acc}%`;
  }).join(" • ");

  return `
    <details class="v81-details" open>
      <summary>Teacher Analytics</summary>
      <div class="v81-details-body">
        <p><b>Time:</b> ${fmtNumber(result?.durationSec)}s</p>
        <p><b>Mode:</b> ${escapeHtmlV6(result?.modeLabel || result?.mode || "")}</p>
        <p><b>Stage Accuracy:</b> ${escapeHtmlV6(stages || "-")}</p>
        <p><b>Weak Terms:</b> ${escapeHtmlV6(getWeakTextVocabReward(result))}</p>
      </div>
    </details>
  `;
}

/* =========================================================
   REWARD RENDERER
========================================================= */

function renderRewardScreenV6(result = {}, reward = {}, coach = {}){
  forceClearGameTimersVocabUI();
  forceRemoveGameFxVocabUI();

  const battlePanel = getBattlePanelVocab();
  const rewardPanel = getRewardPanelVocab();

  if(battlePanel) setVisibleScreenNode(battlePanel, false);

  if(!rewardPanel){
    alert(`จบเกม! Score: ${result.score || 0}, Accuracy: ${result.accuracy || 0}%`);
    return;
  }

  const stars = reward?.stars || 1;
  const starText = "⭐".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars));
  const nextMode = getNextModeVocabReward(result, coach);
  const nextDiff = getNextDifficultyVocabReward(result);
  const coachText = getCoachTextVocabReward(result, coach);
  const modeText = result?.modeLabel || result?.mode || "AI Training";
  const aiHelpUsed = safeNumber(result?.aiHelpUsed || result?.powerStats?.aiHelpUsed, 0);
  const noHelpText = aiHelpUsed > 0 ? `AI Help x${aiHelpUsed}` : "No AI Help";
  const rewardMsg = reward?.message || "คุณทำภารกิจสำเร็จ!";

  rewardPanel.innerHTML = `
    <div class="v81-reward">
      <div class="v81-trophy">🏆</div>
      <h2>Victory Reward</h2>

      <div class="v81-mode-line">
        ${modeIconVocabReward(result?.mode)} ${escapeHtmlV6(modeText)}
      </div>

      <div class="v81-badge-row">
        <span class="v81-badge">🎯 ${escapeHtmlV6(result?.difficulty || "normal")}</span>
        <span class="v81-badge">📚 Bank ${escapeHtmlV6(result?.bank || "-")}</span>
        <span class="v81-badge">🏅 ${escapeHtmlV6(noHelpText)}</span>
      </div>

      <div class="v81-stars">${starText}</div>

      <p class="v81-message">${escapeHtmlV6(rewardMsg)}</p>

      ${compactResultCardsVocabReward(result)}

      <section class="v81-next-card">
        <h3>🤖 AI Coach</h3>
        <p>${escapeHtmlV6(coachText)}</p>
        <p><b>Next Challenge:</b> ${escapeHtmlV6(nextMode)} • ${escapeHtmlV6(nextDiff)}</p>
        <p><b>Review:</b> ${escapeHtmlV6(getWeakTextVocabReward(result))}</p>
      </section>

      <div class="v81-actions">
        <button class="v81-btn primary" type="button" data-vocab-reward-action="again">
          🔁 Play Again
        </button>

        <button class="v81-btn" type="button" data-vocab-reward-action="next">
          🚀 Next Challenge
        </button>

        <button class="v81-btn secondary" type="button" data-vocab-reward-action="menu">
          🏠 Back to Menu
        </button>
      </div>

      ${studentDetailsVocabReward(result, reward)}
      ${teacherDetailsVocabReward(result)}
    </div>
  `;

  showRewardScreenVocabUI();

  bindRewardButtonsVocabUI();

  setTimeout(bindRewardButtonsVocabUI, 80);
  setTimeout(bindRewardButtonsVocabUI, 250);
  setTimeout(showRewardScreenVocabUI, 80);
  setTimeout(showRewardScreenVocabUI, 250);
}

/* =========================================================
   REWARD NAVIGATION
========================================================= */

function getCurrentRunOptionsVocabUI(kind){
  let bank = "A";
  let difficulty = "normal";
  let mode = "learn";

  try{
    bank =
      window.vocabGame?.bank ||
      window.VOCAB_APP?.selectedBank ||
      "A";

    difficulty =
      window.vocabGame?.difficulty ||
      window.VOCAB_APP?.selectedDifficulty ||
      "normal";

    mode =
      window.vocabGame?.mode ||
      window.VOCAB_APP?.selectedMode ||
      "learn";
  }catch(e){}

  if(kind === "next"){
    mode = "mission";

    if(difficulty === "easy") difficulty = "normal";
    else if(difficulty === "normal") difficulty = "hard";
    else difficulty = "challenge";
  }

  return { bank, difficulty, mode };
}

function startFreshRunFromRewardVocabUI(kind){
  forceClearGameTimersVocabUI();
  forceRemoveGameFxVocabUI();

  const opt = getCurrentRunOptionsVocabUI(kind);

  syncMenuSelectionsVocabUI(opt);
  showBattleScreenV6();

  setTimeout(() => {
    showBattleScreenV6();

    try{
      if(typeof startVocabBattleV6 === "function"){
        startVocabBattleV6(opt);

        setTimeout(showBattleScreenV6, 80);
        setTimeout(showBattleScreenV6, 180);
        return;
      }
    }catch(e){
      console.error("[VOCAB UI] startFreshRunFromReward failed", e);
    }

    location.reload();
  }, 100);
}

function backToVocabMenuV6(){
  forceClearGameTimersVocabUI();
  forceRemoveGameFxVocabUI();

  try{
    if(window.vocabGame){
      vocabGame.active = false;
    }
  }catch(e){}

  showMenuScreenV65();
}

function bindRewardButtonsVocabUI(){
  const reward = getRewardPanelVocab();
  if(!reward) return;

  reward.style.pointerEvents = "auto";

  qsa("[data-vocab-reward-action], .v81-btn", reward).forEach(btn => {
    btn.style.pointerEvents = "auto";
    btn.style.cursor = "pointer";

    if(!btn.getAttribute("data-vocab-reward-action")){
      const t = String(btn.textContent || "").toLowerCase();

      if(t.includes("play again")) btn.setAttribute("data-vocab-reward-action", "again");
      else if(t.includes("next challenge")) btn.setAttribute("data-vocab-reward-action", "next");
      else if(t.includes("back to menu")) btn.setAttribute("data-vocab-reward-action", "menu");
    }
  });
}

function installRewardDelegatedClickVocabUI(){
  if(window.__VOCAB_REWARD_DELEGATED_CLICK__) return;
  window.__VOCAB_REWARD_DELEGATED_CLICK__ = true;

  document.addEventListener("click", function(e){
    const btn = e.target && e.target.closest
      ? e.target.closest("#v6RewardPanel [data-vocab-reward-action], #v6RewardPanel .v81-btn")
      : null;

    if(!btn) return;

    let action = btn.getAttribute("data-vocab-reward-action") || "";
    const text = String(btn.textContent || "").toLowerCase();

    if(!action){
      if(text.includes("play again")) action = "again";
      else if(text.includes("next challenge")) action = "next";
      else if(text.includes("back to menu")) action = "menu";
    }

    if(!action) return;

    try{
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }catch(err){}

    if(action === "again"){
      startFreshRunFromRewardVocabUI("again");
    }else if(action === "next"){
      startFreshRunFromRewardVocabUI("next");
    }else if(action === "menu"){
      backToVocabMenuV6();
    }

    return false;
  }, true);
}

/* Inline compatibility */
window.__VOCAB_V81_PLAY_AGAIN = function(){
  startFreshRunFromRewardVocabUI("again");
};

window.__VOCAB_V81_NEXT_CHALLENGE = function(){
  startFreshRunFromRewardVocabUI("next");
};

window.__VOCAB_V81_BACK_MENU = function(){
  backToVocabMenuV6();
};

/* =========================================================
   FLOATING FX
========================================================= */

function showFloatingTextV6(text, type = "good"){
  const fx = document.createElement("div");
  fx.className = `v6-float ${type}`;
  fx.textContent = text;

  document.body.appendChild(fx);

  setTimeout(() => {
    try{ fx.remove(); }catch(e){}
  }, 900);
}

/* =========================================================
   BOOT UI
========================================================= */

function bootVocabUI(){
  initVocabV6UI();
  cleanStudentMenuVocabUI();
  installRewardDelegatedClickVocabUI();

  showMenuScreenV65();

  setTimeout(cleanStudentMenuVocabUI, 500);
  setTimeout(cleanStudentMenuVocabUI, 1500);

  setInterval(() => {
    governVocabScreen();
    bindRewardButtonsVocabUI();
  }, 500);

  console.log("[VOCAB] UI controller loaded");
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", bootVocabUI, { once:true });
}else{
  bootVocabUI();
}
