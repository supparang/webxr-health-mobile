// Phase 3.0 — Interactive Multi-Grade Quiz Arena Engine
// Features: Grade-specific curated questions, Combo Streak multiplier (🔥), Speed Bonus Timer bar (⏱️),
// Lifeline Power-ups (✂️ 50:50 & 💡 Hint), visual choice highlighting, and final Rank Trophy!
import { detectQuizTopic, getQuizQuestions } from "./quiz-bank.js";
import { parseCustomQuizQuestions } from "./thai-game-planner.js";
import { sound } from "./sound.js";

export function mountQuiz(container, game, prompt, onStatus = () => {}) {
  const age = game.ageLevel || "p4";
  const diff = Number(game.rules?.difficulty) || 2;
  const isHardP1 = age === "p1" && diff >= 3;
  const isHardP4 = age === "p4" && diff >= 4;
  const isHardM1 = age === "m1" && diff >= 4;
  const isHardM4 = age === "m4" && diff >= 5;
  const topic = detectQuizTopic(prompt);
  const ageCount = {
    p1: isHardP1 ? 5 : 3,
    p4: isHardP4 ? 6 : 4,
    m1: isHardM1 ? 6 : 5,
    m4: 6
  };
  const customList = Array.isArray(game.rules?.customQuestions) && game.rules.customQuestions.length > 0
    ? game.rules.customQuestions
    : parseCustomQuizQuestions(prompt);
  const isCustom = customList.length > 0;
  // When a student selects Hard/Boss Mode in their grade, step up the question pool challenge!
  const effectiveQuizAge = isHardP1 ? "p4" : isHardP4 ? "m1" : isHardM1 ? "m4" : age;
  const questions = isCustom ? customList : getQuizQuestions(topic, effectiveQuizAge, ageCount[age] || 4);

  const topicLabels = {
    science: "🔬 วิทยาศาสตร์และธรรมชาติ",
    math: "🧮 คณิตศาสตร์และตรรกะ",
    general: "💡 ความรู้รอบตัวและเทคโนโลยี"
  };

  const ageTimeBonus = {
    p1: isHardP1 ? 14 : 20,
    p4: isHardP4 ? 11 : 15,
    m1: isHardM1 ? 9 : 12,
    m4: isHardM4 ? 7 : 10
  };
  const maxQuestionTime = ageTimeBonus[age] || 15;

  let position = 0, score = 0, bonusPoints = 0, streak = 0, bestStreak = 0;
  let answered = false, finished = false, lastCorrect = false, selectedIdx = -1, speedBonusEarned = false;
  let usedFifty = false, usedHint = false, hiddenChoices = new Set(), hintVisible = false;
  let questionTimeLeft = maxQuestionTime, timerId = null, timeFillEl = null, timeTextEl = null;

  container.hidden = false;

  function element(tag, text, className) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (className) e.className = className;
    return e;
  }

  function stopQuestionTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startQuestionTimer() {
    stopQuestionTimer();
    questionTimeLeft = maxQuestionTime;
    timerId = setInterval(() => {
      if (answered || finished) {
        stopQuestionTimer();
        return;
      }
      questionTimeLeft = Math.max(0, questionTimeLeft - 1);
      if (timeFillEl) {
        const pct = Math.round((questionTimeLeft / maxQuestionTime) * 100);
        timeFillEl.style.width = `${pct}%`;
        timeFillEl.style.background = questionTimeLeft <= 4 ? "#e74c3c" : questionTimeLeft <= 8 ? "#f39c12" : "#2ecc71";
      }
      if (timeTextEl) {
        timeTextEl.textContent = questionTimeLeft > 0
          ? `⏱️ โบนัสตอบไว: ${questionTimeLeft}s`
          : `⏱️ หมดเวลาโบนัส (ยังเลือกคำตอบได้)`;
      }
      if (questionTimeLeft === 0) {
        stopQuestionTimer();
      }
    }, 1000);
  }

  function render() {
    container.replaceChildren();

    const arena = element("div");
    arena.style.background = "linear-gradient(145deg, #f8fbff, #eef5ff)";
    arena.style.border = "2px solid #cfe0fc";
    arena.style.borderRadius = "16px";
    arena.style.padding = "16px";

    // Header Row: Topic & Stats
    const headerRow = element("div");
    headerRow.style.display = "flex";
    headerRow.style.justifyContent = "space-between";
    headerRow.style.alignItems = "center";
    headerRow.style.flexWrap = "wrap";
    headerRow.style.gap = "8px";
    headerRow.style.marginBottom = "10px";

    const badgeText = isCustom
      ? `✍️ โจทย์สร้างเองอิสระ (${questions.length} ข้อ)`
      : `${topicLabels[topic] || topicLabels.general} (${age.toUpperCase()})`;
    const badge = element("span", badgeText);
    badge.style.background = "#dce8ff";
    badge.style.color = "#173db7";
    badge.style.padding = "4px 12px";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "13px";
    badge.style.fontWeight = "bold";
    headerRow.append(badge);

    const statsBadge = element("span", `⭐ คะแนน ${score}/${questions.length}` + (bonusPoints > 0 ? ` (+โบนัส ${bonusPoints})` : "") + (streak >= 2 ? `   🔥 คอมโบ x${streak}!` : ""));
    statsBadge.style.fontWeight = "bold";
    statsBadge.style.color = streak >= 2 ? "#d35400" : "#1e3a5f";
    statsBadge.style.fontSize = "15px";
    headerRow.append(statsBadge);
    arena.append(headerRow);

    // Progress Bar
    const progressTrack = element("div");
    progressTrack.style.height = "8px";
    progressTrack.style.background = "#dbe7f9";
    progressTrack.style.borderRadius = "99px";
    progressTrack.style.overflow = "hidden";
    progressTrack.style.marginBottom = "12px";

    const progressFill = element("div");
    const pct = finished ? 100 : Math.round((position / questions.length) * 100);
    progressFill.style.width = `${pct}%`;
    progressFill.style.height = "100%";
    progressFill.style.background = "linear-gradient(90deg, #3458db, #2ecc71)";
    progressFill.style.transition = "width 0.3s ease";
    progressTrack.append(progressFill);
    arena.append(progressTrack);

    if (finished) {
      stopQuestionTimer();
      sound.playWin();
      const ratio = score / questions.length;
      const rankTitle = ratio === 1
        ? "🏆 ปรมาจารย์อัจฉริยะ (Perfect Master!)"
        : ratio >= 0.7
        ? "🌟 นักคิดวิเคราะห์ยอดเยี่ยม (Star Scholar!)"
        : "💪 นักสำรวจผู้ไม่ยอมแพ้ (Rising Explorer!)";

      const titleEl = element("h3", `จบเกม! ได้ ${score} คะแนนจาก ${questions.length} คะแนน 🎉`);
      titleEl.style.color = "#183f69";
      arena.append(titleEl);

      const rankBox = element("div");
      rankBox.style.background = "#ffffff";
      rankBox.style.border = "2px solid #b8d4f6";
      rankBox.style.borderRadius = "12px";
      rankBox.style.padding = "14px";
      rankBox.style.margin = "10px 0";
      rankBox.style.textAlign = "center";

      const rankP = element("p", rankTitle);
      rankP.style.fontSize = "18px";
      rankP.style.fontWeight = "bold";
      rankP.style.color = "#2b50aa";
      rankP.style.margin = "0 0 6px";
      rankBox.append(rankP);

      const subP = element("p", `คอมโบสูงสุด: 🔥 ${bestStreak} ข้อรวด  |  คะแนนโบนัสความไว: ⚡ +${bonusPoints} แต้ม`);
      subP.style.fontSize = "14px";
      subP.style.color = "#4a5568";
      subP.style.margin = "0";
      rankBox.append(subP);
      arena.append(rankBox);

      arena.append(element("p", score === questions.length ? "ยอดเยี่ยมมาก! ตอบถูกต้องครบทุกข้อเลย" : "ลองกดเริ่มใหม่เพื่อทำสถิติคอมโบและเก็บคะแนนเต็มได้เลย!"));
      container.append(arena);
      return;
    }

    const item = questions[position];
    const qHeader = element("h3", "ตอบคำถาม — ข้อ " + Math.min(position + 1, questions.length) + "/" + questions.length);
    qHeader.style.margin = "4px 0 8px";
    arena.append(qHeader);

    // Speed Bonus Timer Bar
    const timerRow = element("div");
    timerRow.style.display = "flex";
    timerRow.style.alignItems = "center";
    timerRow.style.gap = "10px";
    timerRow.style.marginBottom = "10px";

    timeTextEl = element("small", `⏱️ โบนัสตอบไว: ${questionTimeLeft}s`);
    timeTextEl.style.fontWeight = "bold";
    timeTextEl.style.color = "#2c5282";
    timeTextEl.style.minWidth = "135px";
    timerRow.append(timeTextEl);

    const timeBarBg = element("div");
    timeBarBg.style.flex = "1";
    timeBarBg.style.height = "6px";
    timeBarBg.style.background = "#e2e8f0";
    timeBarBg.style.borderRadius = "99px";
    timeBarBg.style.overflow = "hidden";

    timeFillEl = element("div");
    timeFillEl.style.width = `${Math.round((questionTimeLeft / maxQuestionTime) * 100)}%`;
    timeFillEl.style.height = "100%";
    timeFillEl.style.background = "#2ecc71";
    timeFillEl.style.transition = "width 0.3s linear";
    timeBarBg.append(timeFillEl);
    timerRow.append(timeBarBg);
    arena.append(timerRow);

    // Question Card
    const qCard = element("p", item.q);
    qCard.style.background = "#ffffff";
    qCard.style.padding = "14px 16px";
    qCard.style.borderRadius = "12px";
    qCard.style.border = "1.5px solid #d8e6fb";
    qCard.style.fontSize = "18px";
    qCard.style.fontWeight = "700";
    qCard.style.color = "#172a52";
    qCard.style.margin = "8px 0 12px";
    arena.append(qCard);

    // Lifelines Row (50:50 and Hint)
    if (!answered) {
      const lifelineRow = element("div");
      lifelineRow.style.display = "flex";
      lifelineRow.style.gap = "8px";
      lifelineRow.style.marginBottom = "10px";
      lifelineRow.style.flexWrap = "wrap";

      const fiftyBtn = element("button", usedFifty ? "✂️ ใช้ตัวช่วย 50:50 แล้ว" : "✂️ ตัวช่วย 50:50 (ตัดช้อยส์ผิด 2 ข้อ)");
      fiftyBtn.type = "button";
      fiftyBtn.disabled = usedFifty;
      fiftyBtn.style.width = "auto";
      fiftyBtn.style.flex = "1";
      fiftyBtn.style.minHeight = "40px";
      fiftyBtn.style.padding = "6px 12px";
      fiftyBtn.style.fontSize = "13px";
      fiftyBtn.style.background = usedFifty ? "#cbd5e1" : "#8e44ad";
      fiftyBtn.addEventListener("click", () => {
        if (usedFifty || answered) return;
        usedFifty = true;
        sound.playPowerUp();
        const wrongIndices = [0, 1, 2, 3].filter(idx => idx !== item.correct);
        // Deterministically hide 2 wrong options
        hiddenChoices.add(wrongIndices[0]);
        hiddenChoices.add(wrongIndices[1]);
        render();
      });
      lifelineRow.append(fiftyBtn);

      if (item.hint) {
        const hintBtn = element("button", usedHint ? "💡 เปิดคำใบ้แล้ว" : "💡 ดูคำใบ้พิเศษ (1 ครั้ง)");
        hintBtn.type = "button";
        hintBtn.disabled = usedHint;
        hintBtn.style.width = "auto";
        hintBtn.style.flex = "1";
        hintBtn.style.minHeight = "40px";
        hintBtn.style.padding = "6px 12px";
        hintBtn.style.fontSize = "13px";
        hintBtn.style.background = usedHint ? "#cbd5e1" : "#e67e22";
        hintBtn.addEventListener("click", () => {
          if (usedHint || answered) return;
          usedHint = true;
          hintVisible = true;
          sound.playPowerUp();
          render();
        });
        lifelineRow.append(hintBtn);
      }

      arena.append(lifelineRow);
    }

    if (hintVisible && item.hint) {
      const hintBox = element("p", `💡 คำใบ้: ${item.hint}`);
      hintBox.style.background = "#fff9db";
      hintBox.style.border = "1.5px solid #f59f00";
      hintBox.style.color = "#8c5700";
      hintBox.style.padding = "8px 12px";
      hintBox.style.borderRadius = "10px";
      hintBox.style.fontSize = "14px";
      hintBox.style.fontWeight = "600";
      hintBox.style.margin = "0 0 10px";
      arena.append(hintBox);
    }

    // Answer Choices Grid
    const choices = element("div", undefined, "quiz-choices");
    item.a.forEach((answer, i) => {
      const isEliminated = hiddenChoices.has(i);
      const b = element("button", isEliminated ? `${i + 1}. (ตัดออกแล้ว)` : `${i + 1}. ${answer}`);
      b.type = "button";
      b.disabled = answered || isEliminated;
      b.style.textAlign = "left";
      b.style.fontWeight = "600";
      b.style.transition = "transform 0.1s, background 0.2s";

      if (isEliminated) {
        b.style.background = "#cbd5e1";
        b.style.color = "#64748b";
        b.style.textDecoration = "line-through";
      } else if (answered) {
        if (i === item.correct) {
          b.style.background = "#27ae60";
          b.style.color = "#ffffff";
        } else if (i === selectedIdx) {
          b.style.background = "#e74c3c";
          b.style.color = "#ffffff";
        }
      }

      b.addEventListener("click", () => choose(i));
      choices.append(b);
    });
    arena.append(choices);

    if (answered) {
      const feedback = element("p", lastCorrect
        ? `ถูกต้อง! ✅ ${speedBonusEarned ? "(⚡ โบนัสตอบไว +1!) " : ""}`
        : "ยังไม่ถูกต้อง ❌ ");
      feedback.append(element("span", item.why));
      feedback.setAttribute("role", "status");
      feedback.style.background = lastCorrect ? "#e6f9ed" : "#fdeaea";
      feedback.style.border = `1.5px solid ${lastCorrect ? "#2ecc71" : "#e74c3c"}`;
      feedback.style.color = lastCorrect ? "#155724" : "#721c24";
      feedback.style.padding = "12px 14px";
      feedback.style.borderRadius = "10px";
      feedback.style.fontWeight = "600";
      feedback.style.margin = "12px 0";
      arena.append(feedback);

      const next = element("button", position === questions.length - 1 ? "🏆 ดูผลคะแนนสรุป" : "ข้อต่อไป ➔");
      next.type = "button";
      next.style.background = "#2563eb";
      next.style.fontWeight = "bold";
      next.addEventListener("click", () => {
        sound.playClick();
        position++;
        hiddenChoices.clear();
        hintVisible = false;
        if (position >= questions.length) {
          finished = true;
          onStatus("จบเกมตอบคำถาม: " + score + "/" + questions.length);
        } else {
          startQuestionTimer();
        }
        answered = false;
        render();
      });
      arena.append(next);
    }

    container.append(arena);
  }

  function choose(i) {
    if (answered || finished) return;
    stopQuestionTimer();
    answered = true;
    selectedIdx = i;
    lastCorrect = (i === questions[position].correct);
    speedBonusEarned = false;

    if (lastCorrect) {
      score++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      if (questionTimeLeft >= Math.ceil(maxQuestionTime * 0.4)) {
        bonusPoints++;
        speedBonusEarned = true;
      }
      if (streak >= 2) sound.playCombo(streak);
      else sound.playCollect();
    } else {
      streak = 0;
      sound.playHit();
    }
    render();
  }

  function restart() {
    stopQuestionTimer();
    position = 0;
    score = 0;
    bonusPoints = 0;
    streak = 0;
    bestStreak = 0;
    answered = false;
    finished = false;
    selectedIdx = -1;
    usedFifty = false;
    usedHint = false;
    hiddenChoices.clear();
    hintVisible = false;
    onStatus("เริ่มเกมตอบคำถาม");
    startQuestionTimer();
    render();
  }

  function destroy() {
    stopQuestionTimer();
    container.replaceChildren();
    container.hidden = true;
  }

  restart();
  return { restart, destroy, setTouch() {} };
}
