/* =========================================================
   /vocab/vocab.reward.js
   TechPath Vocab Arena — Reward Screen
   Version: 20260503a
   Depends on:
   - vocab.utils.js
   - vocab.state.js
   - vocab.ui.js
   Optional:
   - vocab.storage.js
========================================================= */
(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const U = WIN.VocabUtils || {};
  const UI = WIN.VocabUI || {};
  const Storage = WIN.VocabStorage || {};
  const State = WIN.VocabState || {};
  const game = State.game || WIN.vocabGame || {};

  const VERSION = "vocab-reward-20260503a";

  function byId(id){
    return DOC.getElementById(id);
  }

  function getRewardPanel(){
    return byId("vocabRewardPanel") || byId("v6RewardPanel");
  }

  function getBattlePanel(){
    return byId("vocabBattlePanel") || byId("v6BattlePanel");
  }

  function getMenuPanel(){
    return byId("vocabMenuPanel") || byId("v6MenuPanel");
  }

  function esc(s){
    if(U.escapeHtml) return U.escapeHtml(s);

    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function fmt(v){
    return String(Math.round(n(v)));
  }

  function modeIcon(mode){
    mode = String(mode || "").toLowerCase();

    if(mode === "speed") return "⚡";
    if(mode === "mission") return "🎯";
    if(mode === "battle") return "👾";
    if(mode === "bossrush") return "💀";

    return "🤖";
  }

  function nextDifficulty(result){
    const acc = n(result.accuracy);
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
  }

  function nextMode(result, coach){
    const acc = n(result.accuracy);
    const mode = String(result.mode || "").toLowerCase();

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

  function weakText(result){
    const list = Array.isArray(result.weakestTerms) ? result.weakestTerms : [];

    if(!list.length){
      return "ยังไม่พบคำที่ควรทบทวน";
    }

    return list
      .slice(0, 4)
      .map(x => x.term || x.word || "")
      .filter(Boolean)
      .join(" • ");
  }

  function statCard(label, value, sub){
    return `
      <div class="vocab-reward-stat v81-stat-card">
        <b>${esc(value)}</b>
        <span>${esc(label)}</span>
        ${sub ? `<small>${esc(sub)}</small>` : ""}
      </div>
    `;
  }

  function stats(result){
    const rank = result.rank ? `#${result.rank}` : "-";
    const personalBest = result.personalBest || result.score || 0;
    const improvement = n(result.improvement);

    const improveText = improvement > 0
      ? `+${improvement}`
      : improvement < 0
        ? `${Math.abs(improvement)} to PB`
        : "0";

    return `
      <div class="vocab-reward-stat-grid v81-stat-grid">
        ${statCard("Score", fmt(result.score))}
        ${statCard("Accuracy", `${fmt(result.accuracy)}%`)}
        ${statCard("Best Combo", `x${fmt(result.comboMax)}`)}
        ${statCard("Rank", rank)}
        ${statCard("Personal Best", fmt(personalBest))}
        ${statCard("Progress", improveText)}
      </div>
    `;
  }

  function detailStats(result, reward){
    const fever = result.feverCount || result.powerStats?.feverCount || 0;
    const aiHelp = result.aiHelpUsed || result.powerStats?.aiHelpUsed || 0;
    const stars = reward && reward.stars ? reward.stars : 0;

    return `
      <div class="vocab-reward-detail-grid v81-detail-grid">
        ${statCard("Stars", "⭐".repeat(stars) || "-")}
        ${statCard("Fever", fmt(fever))}
        ${statCard("AI Help", fmt(aiHelp))}
        ${statCard("Weak Words", weakText(result))}
      </div>
    `;
  }

  function actions(){
    return `
      <div class="vocab-reward-actions v81-actions">
        <button class="vocab-reward-btn v81-btn primary" type="button" data-vocab-reward-action="again">
          🔁 Play Again
        </button>

        <button class="vocab-reward-btn v81-btn" type="button" data-vocab-reward-action="next">
          🚀 Next Challenge
        </button>

        <button class="vocab-reward-btn v81-btn secondary" type="button" data-vocab-reward-action="menu">
          🏠 Back to Menu
        </button>
      </div>
    `;
  }

  function render(result, reward, coach){
    result = result || {};
    reward = reward || {};
    coach = coach || {};

    installClickHandler();

    const rewardPanel = getRewardPanel();
    const battlePanel = getBattlePanel();
    const menuPanel = getMenuPanel();

    if(!rewardPanel){
      alert(`จบเกม! Score: ${result.score || 0}, Accuracy: ${result.accuracy || 0}%`);
      return;
    }

    if(battlePanel){
      battlePanel.hidden = true;
      battlePanel.style.display = "none";
      battlePanel.style.pointerEvents = "none";
    }

    if(menuPanel){
      menuPanel.hidden = true;
      menuPanel.style.display = "none";
      menuPanel.style.pointerEvents = "none";
    }

    rewardPanel.hidden = false;
    rewardPanel.style.display = "block";
    rewardPanel.style.pointerEvents = "auto";

    const stars = reward.stars || 1;
    const starText = "⭐".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars));
    const aiHelpUsed = n(result.aiHelpUsed || result.powerStats?.aiHelpUsed);
    const noHelpText = aiHelpUsed > 0 ? `AI Help x${aiHelpUsed}` : "No AI Help";

    rewardPanel.innerHTML = `
      <div class="vocab-reward-card v81-reward">
        <div class="vocab-reward-trophy v81-trophy">🏆</div>

        <h2>Victory Reward</h2>

        <div class="vocab-reward-mode v81-mode-line">
          ${modeIcon(result.mode)} ${esc(result.modeLabel || result.mode || "AI Training")}
        </div>

        <div class="vocab-reward-badges v81-badge-row">
          <span class="vocab-reward-badge v81-badge">🎯 ${esc(result.difficulty || "normal")}</span>
          <span class="vocab-reward-badge v81-badge">📚 Bank ${esc(result.bank || "-")}</span>
          <span class="vocab-reward-badge v81-badge">🏅 ${esc(noHelpText)}</span>
          <span class="vocab-reward-badge v81-badge">🎖️ ${esc(reward.badge || "Vocabulary Starter")}</span>
        </div>

        <div class="vocab-reward-stars v81-stars">${starText}</div>

        <p class="vocab-reward-message v81-message">
          ${esc(reward.message || "คุณทำภารกิจสำเร็จ!")}
        </p>

        ${stats(result)}

        <section class="vocab-reward-coach v81-next-card">
          <h3>🤖 AI Coach</h3>
          <p>${esc(coach.headline || "ทำได้ดีแล้ว รอบต่อไปลองเพิ่มความแม่นและรักษา Combo ให้ยาวขึ้น")}</p>
          <p><b>Next Challenge:</b> ${esc(nextMode(result, coach))} • ${esc(nextDifficulty(result))}</p>
          <p><b>Review:</b> ${esc(weakText(result))}</p>
        </section>

        ${actions()}

        <details class="vocab-reward-details v81-details">
          <summary>Details</summary>
          <div class="vocab-reward-details-body v81-details-body">
            ${detailStats(result, reward)}
            <p class="vocab-reward-muted v81-muted">
              ข้อมูลรายละเอียดถูกเก็บเพื่อช่วยแนะนำเส้นทางฝึกครั้งต่อไป
            </p>
          </div>
        </details>
      </div>
    `;

    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}
  }

  function clearGameTimers(){
    try{
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
    }catch(e){}

    try{
      if(WIN.VocabGame && WIN.VocabGame.clearTimer){
        WIN.VocabGame.clearTimer();
      }
    }catch(e){}
  }

  function currentOptions(kind){
    let bank = "A";
    let difficulty = "normal";
    let mode = "learn";

    try{
      bank = game.bank || WIN.VocabConfig?.selectedBank || WIN.VOCAB_APP?.selectedBank || "A";
      difficulty = game.difficulty || WIN.VocabConfig?.selectedDifficulty || WIN.VOCAB_APP?.selectedDifficulty || "normal";
      mode = game.mode || WIN.VocabConfig?.selectedMode || WIN.VOCAB_APP?.selectedMode || "learn";
    }catch(e){}

    if(kind === "next"){
      mode = "mission";

      if(difficulty === "easy") difficulty = "normal";
      else if(difficulty === "normal") difficulty = "hard";
      else difficulty = "challenge";
    }

    return { bank, difficulty, mode };
  }

  function syncSelections(options){
    try{
      if(WIN.VocabConfig){
        WIN.VocabConfig.selectedBank = options.bank;
        WIN.VocabConfig.selectedDifficulty = options.difficulty;
        WIN.VocabConfig.selectedMode = options.mode;
      }

      if(WIN.VOCAB_APP){
        WIN.VOCAB_APP.selectedBank = options.bank;
        WIN.VOCAB_APP.selectedDifficulty = options.difficulty;
        WIN.VOCAB_APP.selectedMode = options.mode;
      }

      if(UI.updateSelectors) UI.updateSelectors();
      if(UI.updateDifficultyPreview) UI.updateDifficultyPreview();
      if(UI.updateModePreview) UI.updateModePreview();
      if(UI.updateBankLabel) UI.updateBankLabel();
    }catch(e){}
  }

  function startRun(kind){
    clearGameTimers();

    const options = currentOptions(kind);
    syncSelections(options);

    const rewardPanel = getRewardPanel();

    if(rewardPanel){
      rewardPanel.hidden = true;
      rewardPanel.style.display = "none";
      rewardPanel.style.pointerEvents = "none";
    }

    setTimeout(() => {
      if(WIN.VocabGame && WIN.VocabGame.start){
        WIN.VocabGame.start(options);
        return;
      }

      if(typeof WIN.startVocabBattleV6 === "function"){
        WIN.startVocabBattleV6(options);
        return;
      }

      location.reload();
    }, 80);
  }

  function backMenu(){
    clearGameTimers();

    const rewardPanel = getRewardPanel();
    const battlePanel = getBattlePanel();
    const menuPanel = getMenuPanel();

    if(rewardPanel){
      rewardPanel.hidden = true;
      rewardPanel.style.display = "none";
      rewardPanel.style.pointerEvents = "none";
    }

    if(battlePanel){
      battlePanel.hidden = true;
      battlePanel.style.display = "none";
      battlePanel.style.pointerEvents = "none";
    }

    if(menuPanel){
      menuPanel.hidden = false;
      menuPanel.style.display = "";
      menuPanel.style.pointerEvents = "auto";
    }

    try{
      game.active = false;
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){}

    if(UI.renderLeaderboard){
      UI.renderLeaderboard(WIN.VocabConfig?.selectedMode || WIN.VOCAB_APP?.selectedMode || "learn");
    }
  }

  function installClickHandler(){
    if(WIN.__VOCAB_REWARD_CLICK_HANDLER__) return;
    WIN.__VOCAB_REWARD_CLICK_HANDLER__ = true;

    DOC.addEventListener("click", function(e){
      const btn = e.target && e.target.closest
        ? e.target.closest("[data-vocab-reward-action]")
        : null;

      if(!btn) return;

      const action = btn.getAttribute("data-vocab-reward-action");

      e.preventDefault();
      e.stopPropagation();

      if(action === "again"){
        startRun("again");
      }else if(action === "next"){
        startRun("next");
      }else if(action === "menu"){
        backMenu();
      }

      return false;
    }, true);
  }

  const API = {
    version: VERSION,
    render,
    startRun,
    backMenu,
    installClickHandler
  };

  WIN.VocabReward = API;
  WIN.VOCAB_REWARD = API;

  WIN.renderRewardScreenV6 = render;

  WIN.__VOCAB_V81_PLAY_AGAIN = function(){
    startRun("again");
  };

  WIN.__VOCAB_V81_NEXT_CHALLENGE = function(){
    startRun("next");
  };

  WIN.__VOCAB_V81_BACK_MENU = function(){
    backMenu();
  };

  installClickHandler();

  console.log("[VOCAB REWARD] module ready", VERSION);
})();
