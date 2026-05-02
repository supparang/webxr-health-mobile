/* =========================================================
   /vocab/vocab.ui.js
   TechPath Vocab Arena — UI Controller
   Version: 20260502a

   ต้องโหลดหลัง:
   - vocab.config.js
   - vocab.utils.js
   - vocab.state.js
   - vocab.data.js
   - vocab.question.js

   หน้าที่:
   - จัดการหน้าจอ Menu / Battle / Reward
   - Render HUD
   - Render Question / Choices
   - Render Reward แบบ compact
   - ป้องกัน reward/menu/battle ทับกัน
   - bind ปุ่มแบบ delegated click กันปุ่มไม่ติด
   ========================================================= */

(function(){
  "use strict";

  const U = window.VocabUtils;
  const S = window.VocabState;
  const D = window.VocabData;
  const Q = window.VocabQuestion;

  if(!U){
    console.error("[VOCAB] vocab.ui.js requires vocab.utils.js");
    return;
  }

  const UI = {};

  /* =========================================================
     DOM HELPERS
  ========================================================= */

  UI.byId = function byId(id){
    return document.getElementById(id);
  };

  UI.qs = function qs(sel, root){
    return (root || document).querySelector(sel);
  };

  UI.qsa = function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  };

  UI.setText = function setText(id, value){
    const el = UI.byId(id);
    if(el) el.textContent = value;
  };

  UI.setHtml = function setHtml(id, html){
    const el = UI.byId(id);
    if(el) el.innerHTML = html;
  };

  UI.hide = function hide(id, hidden = true){
    const el = UI.byId(id);
    if(!el) return;
    el.hidden = hidden;
    el.style.display = hidden ? "none" : "";
    el.style.pointerEvents = hidden ? "none" : "auto";
  };

  UI.show = function show(id, displayValue = ""){
    const el = UI.byId(id);
    if(!el) return;
    el.hidden = false;
    el.style.display = displayValue || "";
    el.style.pointerEvents = "auto";
  };

  UI.safeScrollTop = function safeScrollTop(){
    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){
      window.scrollTo(0, 0);
    }
  };

  /* =========================================================
     SCREEN GOVERNOR
  ========================================================= */

  UI.showOnlyMenu = function showOnlyMenu(){
    UI.show("v6MenuPanel");
    UI.hide("v6BattlePanel", true);
    UI.hide("v6RewardPanel", true);

    const reward = UI.byId("v6RewardPanel");
    if(reward){
      reward.innerHTML = "";
    }

    UI.safeScrollTop();
  };

  UI.showOnlyBattle = function showOnlyBattle(){
    UI.hide("v6MenuPanel", true);
    UI.show("v6BattlePanel");
    UI.hide("v6RewardPanel", true);

    UI.safeScrollTop();
  };

  UI.showOnlyReward = function showOnlyReward(){
    UI.hide("v6MenuPanel", true);
    UI.hide("v6BattlePanel", true);

    const reward = UI.byId("v6RewardPanel");
    if(reward){
      reward.hidden = false;
      reward.style.display = "block";
      reward.style.pointerEvents = "auto";
      reward.style.minHeight = "auto";
      reward.style.height = "auto";
      reward.style.position = "relative";
      reward.style.zIndex = "20";
    }

    UI.safeScrollTop();
  };

  UI.governScreens = function governScreens(){
    const reward = UI.byId("v6RewardPanel");
    const battle = UI.byId("v6BattlePanel");
    const menu = UI.byId("v6MenuPanel");

    if(!reward || !battle || !menu) return;

    const rewardVisible =
      !reward.hidden &&
      reward.style.display !== "none" &&
      String(reward.innerHTML || "").trim().length > 0;

    const gameActive = !!(window.vocabGame && window.vocabGame.active);

    if(rewardVisible){
      UI.showOnlyReward();
      return;
    }

    if(gameActive){
      UI.showOnlyBattle();
      return;
    }
  };

  UI.installScreenGovernor = function installScreenGovernor(){
    if(window.__VOCAB_UI_SCREEN_GOVERNOR__) return;
    window.__VOCAB_UI_SCREEN_GOVERNOR__ = true;

    setInterval(UI.governScreens, 500);

    document.addEventListener("DOMContentLoaded", function(){
      setTimeout(UI.governScreens, 500);
      setTimeout(UI.governScreens, 1500);
      setTimeout(UI.governScreens, 3000);
    });
  };

  /* =========================================================
     CSS
  ========================================================= */

  UI.injectCss = function injectCss(){
    if(UI.byId("vocabUiCss")) return;

    const css = document.createElement("style");
    css.id = "vocabUiCss";
    css.textContent = `
      #v6RewardPanel{
        min-height:auto !important;
        height:auto !important;
        display:block;
        padding:12px !important;
        overflow:visible !important;
        background:
          radial-gradient(circle at 50% 0%, rgba(255,209,102,.16), transparent 28%),
          linear-gradient(180deg,#10284a,#06111f) !important;
      }

      #v6RewardPanel[hidden]{
        display:none !important;
      }

      .vocab-reward{
        width:min(980px,100%);
        margin:12px auto 24px;
        padding:clamp(18px,3vw,30px);
        border-radius:34px;
        border:1px solid rgba(255,255,255,.16);
        background:
          radial-gradient(circle at top, rgba(255,209,102,.20), transparent 34%),
          radial-gradient(circle at 88% 16%, rgba(89,208,255,.14), transparent 28%),
          rgba(8,16,32,.94);
        box-shadow:0 22px 70px rgba(0,0,0,.40);
        text-align:center;
        color:var(--text,#eef7ff);
      }

      .vocab-reward h2{
        margin:0;
        font-size:clamp(38px,6vw,64px);
        line-height:1;
        letter-spacing:-.055em;
      }

      .vocab-reward-trophy{
        font-size:42px;
        line-height:1;
        margin-bottom:8px;
      }

      .vocab-reward-mode{
        margin-top:14px;
        color:#dbeafe;
        font-weight:1000;
        font-size:clamp(20px,3vw,28px);
      }

      .vocab-badge-row{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:10px;
        margin:14px 0 12px;
      }

      .vocab-badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:9px 14px;
        border-radius:999px;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.18);
        color:#eef7ff;
        font-weight:950;
        font-size:15px;
      }

      .vocab-stars{
        margin:10px 0 14px;
        font-size:42px;
        letter-spacing:4px;
        filter:drop-shadow(0 8px 16px rgba(255,207,90,.30));
      }

      .vocab-reward-message{
        margin:14px auto 18px;
        max-width:760px;
        color:#eef7ff;
        font-size:clamp(20px,3vw,28px);
        font-weight:1000;
        line-height:1.35;
      }

      .vocab-stat-grid{
        display:grid;
        grid-template-columns:repeat(6,1fr);
        gap:12px;
        margin:18px 0;
      }

      .vocab-detail-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:10px;
        margin-top:10px;
      }

      .vocab-stat-card{
        min-height:102px;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
        gap:7px;
        padding:14px 10px;
        border-radius:24px;
        background:rgba(255,255,255,.09);
        border:1px solid rgba(255,255,255,.18);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
      }

      .vocab-stat-card b{
        display:block;
        font-size:clamp(26px,3.7vw,40px);
        line-height:1;
        color:#ffffff;
        overflow-wrap:anywhere;
      }

      .vocab-stat-card span{
        display:block;
        color:#b9c9df;
        font-weight:1000;
        font-size:14px;
      }

      .vocab-stat-card small{
        color:#94a9c2;
        font-weight:800;
      }

      .vocab-coach-card{
        margin:20px auto;
        padding:18px;
        border-radius:26px;
        max-width:820px;
        text-align:left;
        background:rgba(68,223,147,.12);
        border:1px solid rgba(68,223,147,.36);
      }

      .vocab-coach-card h3{
        margin:0 0 10px;
        font-size:26px;
      }

      .vocab-coach-card p{
        margin:8px 0;
        color:#eef7ff;
        font-size:18px;
        font-weight:850;
        line-height:1.5;
      }

      .vocab-actions{
        display:grid;
        grid-template-columns:1.1fr 1fr 1fr;
        gap:12px;
        margin-top:18px;
      }

      .vocab-btn{
        min-height:60px;
        border-radius:22px;
        border:1px solid rgba(255,255,255,.18);
        padding:12px 16px;
        color:#fff;
        font-weight:1000;
        font-size:20px;
        cursor:pointer;
        background:rgba(255,255,255,.10);
        pointer-events:auto !important;
        touch-action:manipulation;
      }

      .vocab-btn.primary{
        background:linear-gradient(135deg,#59d0ff,#8b5cf6);
        box-shadow:0 16px 36px rgba(89,208,255,.22);
      }

      .vocab-btn.secondary{
        background:rgba(255,255,255,.08);
      }

      .vocab-btn:active{
        transform:scale(.985);
        filter:brightness(1.12);
      }

      .vocab-details{
        max-width:820px;
        margin:16px auto 0;
        border-radius:22px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.14);
        overflow:hidden;
        text-align:left;
      }

      .vocab-details summary{
        list-style:none;
        padding:15px 18px;
        color:#dbeafe;
        font-weight:1000;
        font-size:18px;
        cursor:pointer;
      }

      .vocab-details summary::-webkit-details-marker{
        display:none;
      }

      .vocab-details summary::before{
        content:"▸ ";
      }

      .vocab-details[open] summary::before{
        content:"▾ ";
      }

      .vocab-details-body{
        padding:0 16px 16px;
      }

      .vocab-muted{
        color:#a8bdd6;
        font-weight:800;
        line-height:1.5;
      }

      .vocab-float{
        position:fixed;
        left:50%;
        top:46%;
        transform:translate(-50%,-50%);
        z-index:9999;
        padding:14px 22px;
        border-radius:999px;
        color:#fff;
        font-weight:1000;
        font-size:clamp(22px,5vw,46px);
        pointer-events:none;
        animation:vocabFloat .9s ease forwards;
        text-shadow:0 8px 20px rgba(0,0,0,.35);
      }

      .vocab-float.good{ background:rgba(68,223,147,.92); }
      .vocab-float.bad{ background:rgba(255,110,135,.92); }
      .vocab-float.stage{ background:rgba(89,208,255,.92); }

      @keyframes vocabFloat{
        0%{ opacity:0; transform:translate(-50%,-30%) scale(.86); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.04); }
        100%{ opacity:0; transform:translate(-50%,-95%) scale(.96); }
      }

      @media (max-width:900px){
        .vocab-stat-grid{
          grid-template-columns:repeat(3,1fr);
        }

        .vocab-detail-grid{
          grid-template-columns:repeat(2,1fr);
        }

        .vocab-actions{
          grid-template-columns:1fr;
        }
      }

      @media (max-width:560px){
        #v6RewardPanel{
          padding:8px !important;
        }

        .vocab-reward{
          padding:18px;
          border-radius:24px;
        }

        .vocab-stat-grid{
          grid-template-columns:repeat(2,1fr);
        }

        .vocab-detail-grid{
          grid-template-columns:1fr;
        }
      }
    `;

    document.head.appendChild(css);
  };

  /* =========================================================
     MENU UI
  ========================================================= */

  UI.updateDiffPreview = function updateDiffPreview(){
    const el = UI.byId("v6DiffPreview");
    if(!el) return;

    const selected = window.VOCAB_APP?.selectedDifficulty || "easy";
    const feel = D && D.getDifficultyFeel ? D.getDifficultyFeel(selected) : null;

    const fallback = {
      easy: "✨ Easy: คำถามตรง เวลาเยอะ เหมาะกับเริ่มทบทวน",
      normal: "⚔️ Normal: มีโจทย์บริบทและตัวเลือกหลอกมากขึ้น",
      hard: "🔥 Hard: ตัวเลือกยากขึ้นและเวลาเริ่มกดดัน",
      challenge: "💀 Challenge: โจทย์ยาก เวลาเร็ว และบอสลงโทษหนัก"
    };

    el.textContent = feel?.preview || fallback[selected] || fallback.easy;
  };

  UI.updateModePreview = function updateModePreview(){
    const el = UI.byId("v66ModePreview");
    if(!el) return;

    const modeId = window.VOCAB_APP?.selectedMode || "learn";
    const mode = window.VOCAB_PLAY_MODES?.[modeId] || window.VOCAB_PLAY_MODES?.learn;

    if(!mode){
      el.textContent = "เลือกโหมดการเล่น";
      return;
    }

    el.textContent = `${mode.icon || "🎮"} ${mode.label || modeId}: ${mode.description || ""}`;
  };

  UI.updateBankLabel = function updateBankLabel(){
    const el = UI.byId("v6BankLabel");
    if(!el) return;

    const bank = window.vocabGame?.bank || window.VOCAB_APP?.selectedBank || "A";
    const modeId = window.vocabGame?.mode || window.VOCAB_APP?.selectedMode || "learn";
    const mode = window.VOCAB_PLAY_MODES?.[modeId] || window.VOCAB_PLAY_MODES?.learn || {};

    el.textContent = `Bank ${bank} • ${mode.icon || "🎮"} ${mode.label || modeId}`;
  };

  UI.updateModeHud = function updateModeHud(){
    const el = UI.byId("v66ModeHud");
    if(!el) return;

    const modeId = window.vocabGame?.mode || window.VOCAB_APP?.selectedMode || "learn";
    const mode = window.VOCAB_PLAY_MODES?.[modeId] || window.VOCAB_PLAY_MODES?.learn || {};

    el.textContent = `${mode.icon || "🎮"} ${mode.shortLabel || mode.label || modeId}`;
  };

  UI.bindMenuButtons = function bindMenuButtons(){
    UI.qsa("[data-v6-bank]").forEach(btn => {
      btn.addEventListener("click", () => {
        if(window.VOCAB_APP){
          window.VOCAB_APP.selectedBank = btn.dataset.v6Bank || "A";
        }

        UI.qsa("[data-v6-bank]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });

        UI.updateBankLabel();
      });
    });

    UI.qsa("[data-v6-diff]").forEach(btn => {
      btn.addEventListener("click", () => {
        if(window.VOCAB_APP){
          window.VOCAB_APP.selectedDifficulty = btn.dataset.v6Diff || "easy";
        }

        UI.qsa("[data-v6-diff]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });

        UI.updateDiffPreview();
      });
    });

    UI.qsa("[data-v6-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        if(window.VOCAB_APP){
          window.VOCAB_APP.selectedMode = btn.dataset.v6Mode || "learn";
        }

        UI.qsa("[data-v6-mode]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });

        UI.updateModePreview();
        UI.updateBankLabel();
      });
    });

    const startBtn = UI.byId("v6StartBtn");
    if(startBtn && !startBtn.__vocabStartBound){
      startBtn.__vocabStartBound = true;
      startBtn.addEventListener("click", function(){
        if(typeof window.startVocabBattleV6 === "function"){
          window.startVocabBattleV6({
            bank: window.VOCAB_APP?.selectedBank || "A",
            difficulty: window.VOCAB_APP?.selectedDifficulty || "easy",
            mode: window.VOCAB_APP?.selectedMode || "learn"
          });
        }
      });
    }

    UI.qsa("[data-lb-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.lbMode || "learn";

        UI.qsa("[data-lb-mode]").forEach(x => {
          x.classList.toggle("active", x === btn);
        });

        if(typeof window.renderLeaderboardV68 === "function"){
          window.renderLeaderboardV68(mode);
        }
      });
    });
  };

  /* =========================================================
     HUD
  ========================================================= */

  UI.updateHud = function updateHud(){
    const game = window.vocabGame || {};
    const total = typeof window.getTotalPlannedQuestionsV6 === "function"
      ? window.getTotalPlannedQuestionsV6()
      : (game.stagePlan || []).reduce((sum, s) => sum + Number(s.count || 0), 0);

    UI.setText("v6Score", game.score || 0);
    UI.setText("v6Combo", `x${game.combo || 0}`);
    UI.setText("v6Hp", game.playerHp > 0 ? "❤️".repeat(game.playerHp) : "💔");
    UI.setText("v6QuestionNo", `${game.globalQuestionIndex || 0}/${total || 0}`);

    const hpFill = UI.byId("v6EnemyHpFill");
    const hpText = UI.byId("v6EnemyHpText");

    const hpPct = game.enemyHpMax
      ? Math.max(0, Math.min(100, Number(game.enemyHp || 0) / Number(game.enemyHpMax || 1) * 100))
      : 100;

    if(hpFill) hpFill.style.width = `${hpPct}%`;
    if(hpText) hpText.textContent = `${Math.round(hpPct)}%`;

    UI.updateBankLabel();
    UI.updateModeHud();

    if(typeof window.updatePowerHudV62 === "function"){
      window.updatePowerHudV62();
    }
  };

  UI.renderTimer = function renderTimer(){
    const game = window.vocabGame || {};
    const el = UI.byId("v6Timer");

    if(el){
      el.textContent = `${game.timeLeft || 0}s`;
      el.classList.toggle("danger", Number(game.timeLeft || 0) <= 3);
    }
  };

  /* =========================================================
     QUESTION UI
  ========================================================= */

  UI.renderQuestion = function renderQuestion(question, stage){
    const game = window.vocabGame || {};

    UI.showOnlyBattle();

    const panel = UI.byId("v6BattlePanel");
    const stageChip = UI.byId("v6StageChip");
    const stageGoal = UI.byId("v6StageGoal");
    const enemyAvatar = UI.byId("v6EnemyAvatar");
    const enemyName = UI.byId("v6EnemyName");
    const enemySkill = UI.byId("v6EnemySkill");
    const questionText = UI.byId("v6QuestionText");
    const choicesBox = UI.byId("v6Choices");
    const explainBox = UI.byId("v6ExplainBox");

    if(!panel || !stageChip || !choicesBox || !questionText){
      console.warn("[VOCAB UI] battle UI not found");
      return;
    }

    if(explainBox){
      explainBox.hidden = true;
      explainBox.innerHTML = "";
    }

    const aiBox = UI.byId("v67AiHelpBox");
    if(aiBox){
      aiBox.hidden = true;
      aiBox.innerHTML = "";
    }

    stageChip.textContent = `${stage?.icon || "✨"} ${stage?.name || "Round"}`;
    if(stageGoal) stageGoal.textContent = `Goal: ${stage?.goal || "ตอบให้ถูก"}`;

    if(enemyAvatar) enemyAvatar.textContent = game.enemy?.avatar || "👾";
    if(enemyName) enemyName.textContent = `${game.enemy?.name || "Enemy"} • ${game.enemy?.title || ""}`;
    if(enemySkill) enemySkill.textContent = game.enemy?.skill || "";

    questionText.innerHTML = `
      <span class="v6-question-main">${U.escapeHtml(question.prompt || "")}</span>
      ${
        question.answerMode === "meaning"
          ? `<small class="v6-question-hint">เลือกความหมายที่ถูกต้อง</small>`
          : `<small class="v6-question-hint">เลือกคำศัพท์ที่เหมาะกับสถานการณ์</small>`
      }
    `;

    choicesBox.innerHTML = "";

    (question.choices || []).forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.className = "v6-choice";
      btn.type = "button";
      btn.dataset.choiceIndex = String(index);
      btn.innerHTML = `
        <span style="opacity:.72; margin-right:8px;">${String.fromCharCode(65 + index)}.</span>
        <span>${U.escapeHtml(choice.text)}</span>
      `;

      btn.addEventListener("click", function(){
        if(typeof window.answerQuestionV6 === "function"){
          window.answerQuestionV6(choice, btn);
        }
      });

      choicesBox.appendChild(btn);
    });

    UI.updateHud();
    UI.governScreens();
  };

  UI.lockChoices = function lockChoices(){
    UI.qsa(".v6-choice").forEach(btn => {
      btn.disabled = true;
    });
  };

  UI.revealCorrectChoice = function revealCorrectChoice(question){
    const q = question || window.vocabGame?.currentQuestion;
    const correctText = Q && Q.getCorrectChoiceText
      ? Q.getCorrectChoiceText(q)
      : "";

    UI.qsa(".v6-choice").forEach(btn => {
      const text = btn.textContent || "";
      if(correctText && text.includes(correctText)){
        btn.classList.add("correct");
      }
    });
  };

  UI.showAnswerExplain = function showAnswerExplain(isCorrect, question){
    const box = UI.byId("v6ExplainBox");
    if(!box || !question) return;

    const correctWord = question.correctTerm?.term || "";
    const correctMeaning = question.correctTerm?.meaning || question.correctTerm?.definition || "";

    box.hidden = false;
    box.innerHTML = isCorrect
      ? `✅ ถูกต้อง! <b>${U.escapeHtml(correctWord)}</b> = ${U.escapeHtml(correctMeaning)}`
      : `💡 คำตอบที่ถูกคือ <b>${U.escapeHtml(correctWord)}</b> = ${U.escapeHtml(correctMeaning)}`;

    setTimeout(() => {
      if(box) box.hidden = true;
    }, isCorrect ? 900 : 1500);
  };

  UI.showAiHelp = function showAiHelp(html){
    let box = UI.byId("v67AiHelpBox");

    if(!box){
      box = document.createElement("div");
      box.id = "v67AiHelpBox";
      box.className = "v67-ai-help-box";

      const qCard = UI.qs(".v6-question-card");
      const choices = UI.byId("v6Choices");

      if(qCard && choices){
        qCard.insertBefore(box, choices);
      }else if(qCard){
        qCard.appendChild(box);
      }
    }

    box.hidden = false;
    box.innerHTML = html || "";
  };

  UI.floatText = function floatText(text, type = "good"){
    const fx = document.createElement("div");
    fx.className = `vocab-float ${type}`;
    fx.textContent = text;

    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 900);
  };

  /* =========================================================
     REWARD HELPERS
  ========================================================= */

  UI.modeIcon = function modeIcon(mode){
    const m = String(mode || "").toLowerCase();

    if(m === "speed") return "⚡";
    if(m === "mission") return "🎯";
    if(m === "battle") return "👾";
    if(m === "bossrush") return "💀";

    return "🤖";
  };

  UI.nextDifficulty = function nextDifficulty(result){
    const acc = Number(result.accuracy || 0);
    const diff = String(result.difficulty || "normal").toLowerCase();

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

    if(acc < 60){
      return "easy";
    }

    return diff || "normal";
  };

  UI.nextMode = function nextMode(result, coach){
    const acc = Number(result.accuracy || 0);
    const mode = String(result.mode || "").toLowerCase();

    if(coach && coach.nextMode){
      const cleaned = String(coach.nextMode || "").trim();
      if(cleaned) return cleaned;
    }

    if(mode === "learn" && acc >= 80) return "Debug Mission";
    if(mode === "speed" && acc >= 80) return "Debug Mission";
    if(mode === "mission" && acc >= 80) return "Boss Battle";
    if(acc >= 90) return "Debug Mission";
    if(acc >= 75) return "Speed Run";

    return "AI Training";
  };

  UI.coachText = function coachText(result, coach){
    if(coach && coach.headline){
      return String(coach.headline || "").trim();
    }

    const acc = Number(result.accuracy || 0);
    const combo = Number(result.comboMax || 0);

    if(acc >= 90 && combo >= 4){
      return "แม่นยำมาก รอบต่อไปลองใช้คำศัพท์ในสถานการณ์จริงเพื่อเพิ่มความท้าทาย";
    }

    if(acc >= 75){
      return "พื้นฐานดีแล้ว รอบต่อไปเน้นอ่าน context และทำ combo ให้ต่อเนื่องขึ้น";
    }

    return "เริ่มต้นได้ดี รอบต่อไปลองฝึกคำที่พลาดและใช้ AI Help เฉพาะตอนจำเป็น";
  };

  UI.weakText = function weakText(result){
    const list = Array.isArray(result.weakestTerms) ? result.weakestTerms : [];

    if(!list.length) return "ยังไม่พบคำที่ควรทบทวน";

    return list
      .slice(0, 4)
      .map(x => x.term || x.word || "")
      .filter(Boolean)
      .join(" • ");
  };

  UI.statCard = function statCard(label, value, sub = ""){
    return `
      <div class="vocab-stat-card">
        <b>${U.escapeHtml(value)}</b>
        <span>${U.escapeHtml(label)}</span>
        ${sub ? `<small>${U.escapeHtml(sub)}</small>` : ""}
      </div>
    `;
  };

  UI.resultCards = function resultCards(result){
    const rank = result.rank ? `#${result.rank}` : "-";
    const personalBest = result.personalBest || result.score || 0;
    const improvement = Number(result.improvement || 0);

    const improveText = improvement > 0
      ? `+${improvement}`
      : improvement < 0
        ? `${Math.abs(improvement)} to PB`
        : "0";

    return `
      <div class="vocab-stat-grid">
        ${UI.statCard("Score", U.fmt(result.score))}
        ${UI.statCard("Accuracy", `${U.fmt(result.accuracy)}%`)}
        ${UI.statCard("Best Combo", `x${U.fmt(result.comboMax)}`)}
        ${UI.statCard("Rank", rank)}
        ${UI.statCard("Personal Best", U.fmt(personalBest))}
        ${UI.statCard("Progress", improveText)}
      </div>
    `;
  };

  UI.detailCards = function detailCards(result, reward){
    const weakText = UI.weakText(result);
    const fever = result.feverCount || result.powerStats?.feverCount || 0;
    const aiHelp = result.aiHelpUsed || result.powerStats?.aiHelpUsed || 0;
    const stars = reward?.stars || 0;

    return `
      <div class="vocab-detail-grid">
        ${UI.statCard("Stars", "⭐".repeat(stars) || "-")}
        ${UI.statCard("Fever", U.fmt(fever))}
        ${UI.statCard("AI Help", U.fmt(aiHelp))}
        ${UI.statCard("Weak Words", weakText)}
      </div>
    `;
  };

  UI.actionButtons = function actionButtons(){
    return `
      <div class="vocab-actions">
        <button class="vocab-btn primary" type="button" data-vocab-action="again">
          🔁 Play Again
        </button>
        <button class="vocab-btn" type="button" data-vocab-action="next">
          🚀 Next Challenge
        </button>
        <button class="vocab-btn secondary" type="button" data-vocab-action="menu">
          🏠 Back to Menu
        </button>
      </div>
    `;
  };

  UI.studentDetails = function studentDetails(result, reward){
    return `
      <details class="vocab-details">
        <summary>Details</summary>
        <div class="vocab-details-body">
          ${UI.detailCards(result, reward)}
          <p class="vocab-muted">
            รายละเอียดนี้ใช้ช่วยแนะนำเส้นทางฝึกครั้งต่อไป โดยแสดงเฉพาะข้อมูลที่จำเป็นสำหรับผู้เรียน
          </p>
        </div>
      </details>
    `;
  };

  UI.teacherDetails = function teacherDetails(result){
    const isTeacher = (() => {
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
    })();

    if(!isTeacher) return "";

    const stageStats = result.stageStats || {};
    const stages = Object.keys(stageStats).map(k => {
      const s = stageStats[k] || {};
      const total = Number(s.correct || 0) + Number(s.wrong || 0);
      const acc = total ? Math.round((Number(s.correct || 0) / total) * 100) : 0;
      return `${k}: ${acc}%`;
    }).join(" • ");

    return `
      <details class="vocab-details">
        <summary>Teacher Analytics</summary>
        <div class="vocab-details-body">
          <p><b>Time:</b> ${U.fmt(result.durationSec)}s</p>
          <p><b>Mode:</b> ${U.escapeHtml(result.modeLabel || result.mode || "")}</p>
          <p><b>Stage Accuracy:</b> ${U.escapeHtml(stages || "-")}</p>
          <p><b>Weak Terms:</b> ${U.escapeHtml(UI.weakText(result))}</p>
        </div>
      </details>
    `;
  };

  UI.renderReward = function renderReward(result = {}, reward = {}, coach = {}){
    UI.injectCss();

    const rewardPanel = UI.byId("v6RewardPanel");

    if(!rewardPanel){
      alert(`จบเกม! Score: ${result.score || 0}, Accuracy: ${result.accuracy || 0}%`);
      return;
    }

    const stars = reward.stars || 1;
    const starText = "⭐".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars));
    const nextMode = UI.nextMode(result, coach);
    const nextDiff = UI.nextDifficulty(result);
    const coachText = UI.coachText(result, coach);
    const modeText = result.modeLabel || result.mode || "AI Training";
    const aiHelpUsed = Number(result.aiHelpUsed || result.powerStats?.aiHelpUsed || 0);
    const noHelpText = aiHelpUsed > 0 ? `AI Help x${aiHelpUsed}` : "No AI Help";
    const rewardMsg = reward.message || "คุณทำภารกิจสำเร็จ!";

    rewardPanel.innerHTML = `
      <div class="vocab-reward">
        <div class="vocab-reward-trophy">🏆</div>
        <h2>Victory Reward</h2>

        <div class="vocab-reward-mode">
          ${UI.modeIcon(result.mode)} ${U.escapeHtml(modeText)}
        </div>

        <div class="vocab-badge-row">
          <span class="vocab-badge">🎯 ${U.escapeHtml(result.difficulty || "normal")}</span>
          <span class="vocab-badge">📚 Bank ${U.escapeHtml(result.bank || "-")}</span>
          <span class="vocab-badge">🏅 ${U.escapeHtml(noHelpText)}</span>
        </div>

        <div class="vocab-stars">${starText}</div>

        <p class="vocab-reward-message">${U.escapeHtml(rewardMsg)}</p>

        ${UI.resultCards(result)}

        <section class="vocab-coach-card">
          <h3>🤖 AI Coach</h3>
          <p>${U.escapeHtml(coachText)}</p>
          <p><b>Next Challenge:</b> ${U.escapeHtml(nextMode)} • ${U.escapeHtml(nextDiff)}</p>
          <p><b>Review:</b> ${U.escapeHtml(UI.weakText(result))}</p>
        </section>

        ${UI.actionButtons()}

        ${UI.studentDetails(result, reward)}

        ${UI.teacherDetails(result)}
      </div>
    `;

    UI.showOnlyReward();

    setTimeout(UI.bindRewardButtons, 0);
    setTimeout(UI.bindRewardButtons, 100);
    setTimeout(UI.bindRewardButtons, 300);
  };

  /* =========================================================
     REWARD NAVIGATION
  ========================================================= */

  UI.clearGameTimers = function clearGameTimers(){
    const game = window.vocabGame;

    try{
      if(game){
        if(game.timerId){
          clearInterval(game.timerId);
          clearTimeout(game.timerId);
          game.timerId = null;
        }

        if(game.feverTimerId){
          clearInterval(game.feverTimerId);
          clearTimeout(game.feverTimerId);
          game.feverTimerId = null;
        }

        game.fever = false;
        game.feverUntil = 0;
      }
    }catch(e){}

    try{
      if(typeof window.clearTimerV6 === "function") window.clearTimerV6();
    }catch(e){}

    try{
      if(typeof window.stopFeverV62 === "function") window.stopFeverV62();
    }catch(e){}
  };

  UI.removeFx = function removeFx(){
    [
      ".v6-float",
      ".vocab-float",
      ".v6-laser-beam",
      ".v6-fx-burst",
      ".v72-announcer",
      ".v72-flash",
      ".v72-particle",
      ".v74-toast",
      ".v78-guard-toast"
    ].forEach(sel => {
      UI.qsa(sel).forEach(node => {
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
  };

  UI.getCurrentRunOptions = function getCurrentRunOptions(kind){
    const game = window.vocabGame || {};

    let bank = game.bank || window.VOCAB_APP?.selectedBank || "A";
    let difficulty = game.difficulty || window.VOCAB_APP?.selectedDifficulty || "normal";
    let mode = game.mode || window.VOCAB_APP?.selectedMode || "learn";

    if(kind === "next"){
      mode = "mission";

      if(difficulty === "easy") difficulty = "normal";
      else if(difficulty === "normal") difficulty = "hard";
      else difficulty = "challenge";
    }

    return { bank, difficulty, mode };
  };

  UI.syncSelections = function syncSelections(options){
    if(window.VOCAB_APP){
      window.VOCAB_APP.selectedBank = options.bank;
      window.VOCAB_APP.selectedDifficulty = options.difficulty;
      window.VOCAB_APP.selectedMode = options.mode;
    }

    UI.qsa("[data-v6-bank]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Bank === options.bank);
    });

    UI.qsa("[data-v6-diff]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Diff === options.difficulty);
    });

    UI.qsa("[data-v6-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.v6Mode === options.mode);
    });

    UI.updateDiffPreview();
    UI.updateModePreview();
    UI.updateBankLabel();
    UI.updateModeHud();
  };

  UI.startRunFromReward = function startRunFromReward(kind){
    UI.clearGameTimers();
    UI.removeFx();

    const options = UI.getCurrentRunOptions(kind);
    UI.syncSelections(options);
    UI.showOnlyBattle();

    setTimeout(() => {
      UI.showOnlyBattle();

      if(typeof window.startVocabBattleV6 === "function"){
        window.startVocabBattleV6(options);

        setTimeout(UI.showOnlyBattle, 80);
        setTimeout(UI.showOnlyBattle, 200);
        return;
      }

      location.reload();
    }, 100);
  };

  UI.backToMenu = function backToMenu(){
    UI.clearGameTimers();
    UI.removeFx();

    if(window.vocabGame){
      window.vocabGame.active = false;
    }

    UI.showOnlyMenu();

    if(typeof window.renderLeaderboardV68 === "function"){
      window.renderLeaderboardV68(window.VOCAB_APP?.selectedMode || "learn");
    }
  };

  UI.bindRewardButtons = function bindRewardButtons(){
    UI.qsa("#v6RewardPanel .vocab-btn").forEach(btn => {
      btn.style.pointerEvents = "auto";
      btn.style.cursor = "pointer";
    });
  };

  UI.installRewardDelegatedClick = function installRewardDelegatedClick(){
    if(window.__VOCAB_UI_REWARD_CLICK__) return;
    window.__VOCAB_UI_REWARD_CLICK__ = true;

    document.addEventListener("click", function(e){
      const btn = e.target && e.target.closest
        ? e.target.closest("#v6RewardPanel [data-vocab-action]")
        : null;

      if(!btn) return;

      const action = btn.dataset.vocabAction || "";

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if(action === "again"){
        UI.startRunFromReward("again");
      }else if(action === "next"){
        UI.startRunFromReward("next");
      }else if(action === "menu"){
        UI.backToMenu();
      }

      return false;
    }, true);
  };

  /* =========================================================
     COMPATIBILITY EXPORTS
  ========================================================= */

  window.VocabUI = UI;

  window.byId = window.byId || UI.byId;
  window.setTextV6 = UI.setText;

  window.hideEl = function hideEl(id, hidden = true){
    UI.hide(id, hidden);
  };

  window.showMenuScreenV65 = UI.showOnlyMenu;
  window.showBattleScreenV6 = UI.showOnlyBattle;

  window.backToVocabMenuV6 = function backToVocabMenuV6(){
    UI.backToMenu();
  };

  window.updateV6DiffPreview = UI.updateDiffPreview;
  window.updateV66ModePreview = UI.updateModePreview;
  window.updateV6BankLabel = UI.updateBankLabel;
  window.updateV66ModeHud = UI.updateModeHud;
  window.updateHudV6 = UI.updateHud;
  window.renderTimerV6 = UI.renderTimer;
  window.renderQuestionV6 = UI.renderQuestion;
  window.lockChoicesV6 = UI.lockChoices;
  window.revealCorrectChoiceV6 = UI.revealCorrectChoice;
  window.showAnswerExplainV61 = UI.showAnswerExplain;
  window.renderAiHelpBoxV67 = UI.showAiHelp;
  window.showFloatingTextV6 = UI.floatText;
  window.renderRewardScreenV6 = UI.renderReward;

  window.__VOCAB_V81_PLAY_AGAIN = function(){
    UI.startRunFromReward("again");
  };

  window.__VOCAB_V81_NEXT_CHALLENGE = function(){
    UI.startRunFromReward("next");
  };

  window.__VOCAB_V81_BACK_MENU = function(){
    UI.backToMenu();
  };

  UI.injectCss();
  UI.installScreenGovernor();
  UI.installRewardDelegatedClick();

  document.addEventListener("DOMContentLoaded", function(){
    UI.injectCss();
    UI.bindMenuButtons();
    UI.updateDiffPreview();
    UI.updateModePreview();
    UI.updateBankLabel();
    UI.updateModeHud();
    UI.showOnlyMenu();

    if(typeof window.renderLeaderboardV68 === "function"){
      window.renderLeaderboardV68("learn");
    }

    console.log("[VOCAB] UI controller loaded");
  });

})();
