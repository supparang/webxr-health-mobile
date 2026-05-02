/* =========================================================
   /vocab/vocab.ui-question-hotfix.js
   TechPath Vocab Arena — Question Render Hotfix
   Version: 20260503b
   Purpose:
   - แก้ปัญหา Battle ขึ้น "Question text" แต่ไม่มีตัวเลือก
   - ทำให้ renderQuestion รองรับหลาย schema:
     prompt / question / text / title
     choices: string[] หรือ object[]
========================================================= */
(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  function byId(id){
    return DOC.getElementById(id);
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function getGame(){
    return (
      WIN.VocabState?.game ||
      WIN.vocabGame ||
      {}
    );
  }

  function getQuestionText(q){
    if(!q) return "Question not found";

    return (
      q.prompt ||
      q.question ||
      q.text ||
      q.title ||
      q.label ||
      "Question not found"
    );
  }

  function getChoices(q){
    if(!q) return [];

    const raw =
      q.choices ||
      q.options ||
      q.answers ||
      [];

    if(!Array.isArray(raw)) return [];

    return raw.map((c, index) => {
      if(typeof c === "string"){
        return {
          text: c,
          correct: false,
          index
        };
      }

      return {
        text: c.text ?? c.label ?? c.answer ?? c.meaning ?? c.term ?? "",
        correct: !!(c.correct || c.isCorrect || c.ok),
        term: c.term,
        meaning: c.meaning,
        index
      };
    }).filter(c => String(c.text || "").trim());
  }

  function getCorrectChoice(q, choices){
    if(!q) return null;

    let found = choices.find(c => c.correct);
    if(found) return found;

    const answer =
      q.correctAnswer ||
      q.answer ||
      q.correct ||
      q.correctText ||
      q.correctMeaning;

    if(answer){
      found = choices.find(c => String(c.text).trim() === String(answer).trim());
      if(found){
        found.correct = true;
        return found;
      }
    }

    if(q.correctTerm){
      const meaning = q.correctTerm.meaning;
      const term = q.correctTerm.term;

      found = choices.find(c =>
        String(c.text).trim() === String(meaning || "").trim() ||
        String(c.text).trim() === String(term || "").trim()
      );

      if(found){
        found.correct = true;
        return found;
      }
    }

    if(choices[0]){
      choices[0].correct = true;
      return choices[0];
    }

    return null;
  }

  function updateText(id, value){
    const el = byId(id);
    if(el) el.textContent = value;
  }

  function showBattleScreen(){
    const menu = byId("vocabMenuPanel");
    const battle = byId("vocabBattlePanel");
    const reward = byId("vocabRewardPanel");

    if(menu){
      menu.hidden = true;
      menu.style.display = "none";
    }

    if(reward){
      reward.hidden = true;
      reward.style.display = "none";
    }

    if(battle){
      battle.hidden = false;
      battle.style.display = "";
      battle.style.pointerEvents = "auto";
    }
  }

  function updateHud(){
    const g = getGame();

    updateText("vocabScore", String(g.score ?? 0));
    updateText("vocabCombo", "x" + String(g.combo ?? 0));

    const hp = Math.max(0, Number(g.playerHp ?? 0));
    updateText("vocabHp", "❤️".repeat(hp) || "💔");

    updateText("vocabTimer", String(g.timeLeft ?? 0) + "s");

    const total = Array.isArray(g.stagePlan)
      ? g.stagePlan.reduce((sum, s) => sum + Number(s.count || 0), 0)
      : 0;

    updateText("vocabQuestionNo", String(g.globalQuestionIndex ?? 0) + "/" + String(total || 0));

    const modeLabel =
      g.mode === "speed" ? "⚡ Speed" :
      g.mode === "mission" ? "🎯 Mission" :
      g.mode === "battle" ? "👾 Boss" :
      "🤖 AI";

    updateText("vocabModeHud", modeLabel);

    if(g.enemy){
      updateText("vocabEnemyName", g.enemy.name || "Bug Slime");
      updateText("vocabEnemySkill", g.enemy.skill || "Enemy skill");

      const avatar = byId("vocabEnemyAvatar");
      if(avatar) avatar.textContent = g.enemy.avatar || "👾";
    }

    const max = Number(g.enemyHpMax || 100);
    const hpNow = Number(g.enemyHp ?? max);
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(hpNow / max * 100))) : 100;

    updateText("vocabEnemyHpText", pct + "%");

    const fill = byId("vocabEnemyHpFill");
    if(fill) fill.style.width = pct + "%";
  }

  function updatePowerHud(){
    const g = getGame();

    updateText("vocabFeverChip", g.fever ? "🔥 Fever: ON" : "🔥 Fever: OFF");
    updateText("vocabShieldChip", "🛡️ Shield x" + String(g.shield ?? 0));
    updateText("vocabLaserChip", g.laserReady ? "🔴 Laser: READY" : "🔴 Laser: Not ready");

    const hintBtn = byId("vocabHintBtn");
    if(hintBtn){
      hintBtn.textContent = "💡 Hint x" + String(g.hints ?? 0);
      hintBtn.disabled = Number(g.hints || 0) <= 0;
    }

    const aiBtn = byId("vocabAiHelpBtn");
    if(aiBtn){
      aiBtn.textContent = "🤖 AI Help x" + String(g.aiHelpLeft ?? 0);
      aiBtn.disabled = Number(g.aiHelpLeft || 0) <= 0;
    }

    const battle = byId("vocabBattlePanel");
    if(battle){
      battle.classList.toggle("fever", !!g.fever);
    }
  }

  function renderTimer(){
    const g = getGame();
    const timer = byId("vocabTimer");

    if(timer){
      timer.textContent = String(g.timeLeft ?? 0) + "s";
      timer.classList.toggle("danger", Number(g.timeLeft || 0) <= 3);
    }
  }

  function renderQuestion(question, stage){
    showBattleScreen();

    const g = getGame();
    const q = question || g.currentQuestion || {};
    const currentStage = stage || g.currentStage || {};

    const text = getQuestionText(q);
    const choices = getChoices(q);
    getCorrectChoice(q, choices);

    const qText = byId("vocabQuestionText");
    const choiceBox = byId("vocabChoices");
    const explainBox = byId("vocabExplainBox");
    const aiBox = byId("vocabAiHelpBox");

    if(qText){
      qText.innerHTML = esc(text);
    }

    if(explainBox){
      explainBox.hidden = true;
      explainBox.innerHTML = "";
    }

    if(aiBox){
      aiBox.hidden = true;
      aiBox.innerHTML = "";
    }

    updateText(
      "vocabStageChip",
      `${currentStage.icon || "✨"} ${currentStage.name || "Warm-up Round"}`
    );

    updateText(
      "vocabStageGoal",
      `Goal: ${currentStage.goal || "ตอบให้ถูกและเก็บคะแนน"}`
    );

    updateText(
      "vocabBankLabel",
      `Bank ${g.bank || "A"} • ${
        g.mode === "speed" ? "⚡ Speed Run" :
        g.mode === "mission" ? "🎯 Debug Mission" :
        g.mode === "battle" ? "👾 Boss Battle" :
        "🤖 AI Training"
      }`
    );

    if(!choiceBox) return;

    if(!choices.length){
      choiceBox.innerHTML = `
        <div class="vocab-explain-box" style="display:block">
          ⚠️ ไม่พบตัวเลือกของคำถามนี้ ให้เช็ก vocab.question.js ว่าส่ง choices ออกมาหรือไม่
        </div>
      `;
      updateHud();
      updatePowerHud();
      return;
    }

    choiceBox.innerHTML = choices.map((choice, index) => `
      <button
        class="vocab-choice v6-choice"
        type="button"
        data-vocab-choice-index="${index}"
      >
        ${esc(choice.text)}
      </button>
    `).join("");

    choiceBox.querySelectorAll("[data-vocab-choice-index]").forEach(btn => {
      btn.addEventListener("click", function(){
        const index = Number(this.getAttribute("data-vocab-choice-index"));
        const choice = choices[index];

        if(WIN.VocabGame && typeof WIN.VocabGame.answerQuestion === "function"){
          WIN.VocabGame.answerQuestion(choice, this);
          return;
        }

        if(typeof WIN.answerQuestionV6 === "function"){
          WIN.answerQuestionV6(choice, this);
        }
      });
    });

    updateHud();
    updatePowerHud();
  }

  function lockChoices(){
    DOC.querySelectorAll(".vocab-choice, .v6-choice").forEach(btn => {
      btn.disabled = true;
    });
  }

  function revealCorrectChoice(question){
    const q = question || getGame().currentQuestion || {};
    const choices = getChoices(q);
    const correct = getCorrectChoice(q, choices);

    if(!correct) return;

    DOC.querySelectorAll(".vocab-choice, .v6-choice").forEach(btn => {
      if(String(btn.textContent || "").trim() === String(correct.text || "").trim()){
        btn.classList.add("correct");
      }
    });
  }

  function renderExplain(isCorrect, question){
    const box = byId("vocabExplainBox");
    if(!box) return;

    const q = question || getGame().currentQuestion || {};
    const term = q.correctTerm || {};
    const explain =
      q.explain ||
      q.explanation ||
      (term.term && term.meaning ? `"${term.term}" = ${term.meaning}` : "");

    box.hidden = false;
    box.innerHTML = `
      <b>${isCorrect ? "✅ Correct!" : "❌ Review"}</b><br>
      ${esc(explain || "ลองทบทวนคำนี้อีกครั้ง")}
    `;
  }

  function renderAiHelp(html){
    const box = byId("vocabAiHelpBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = html || "AI Help";
  }

  function floatingText(text, type){
    const el = DOC.createElement("div");
    el.className = "vocab-float v6-float " + (type || "");
    el.textContent = text;
    DOC.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function createBurst(){
    const el = DOC.createElement("div");
    el.className = "vocab-fx-burst v6-fx-burst";
    DOC.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function createLaser(){
    const el = DOC.createElement("div");
    el.className = "vocab-laser-beam v6-laser-beam";
    DOC.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }

  function addEnemyHitFx(){
    const enemy = byId("vocabEnemyAvatar");
    if(!enemy) return;

    enemy.animate(
      [
        { transform:"scale(1) rotate(0deg)" },
        { transform:"scale(1.15) rotate(-5deg)" },
        { transform:"scale(1) rotate(0deg)" }
      ],
      { duration:260, easing:"ease-out" }
    );
  }

  function addBossAttackFx(){
    const battle = byId("vocabBattlePanel");
    if(!battle) return;

    battle.animate(
      [
        { transform:"translateX(0)" },
        { transform:"translateX(-8px)" },
        { transform:"translateX(8px)" },
        { transform:"translateX(0)" }
      ],
      { duration:260, easing:"ease-out" }
    );
  }

  function showStageIntro(stage){
    floatingText(`${stage.icon || "✨"} ${stage.name || "Next Stage"}`, "stage");
  }

  const old = WIN.VocabUI || {};

  const api = Object.assign({}, old, {
    renderQuestion,
    updateHud,
    updatePowerHud,
    renderTimer,
    showBattleScreen,
    lockChoices,
    revealCorrectChoice,
    renderExplain,
    renderAiHelp,
    floatingText,
    createBurst,
    createLaser,
    addEnemyHitFx,
    addBossAttackFx,
    showStageIntro
  });

  WIN.VocabUI = api;
  WIN.VOCAB_UI = api;

  console.log("[VOCAB UI HOTFIX] question renderer ready 20260503b");
})();
