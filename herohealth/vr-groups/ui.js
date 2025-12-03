// === /herohealth/vr-groups/ui.js ===
// HUD UI for Food Groups VR
// Production Ready 2025-12-05

(function (ns) {

  'use strict';

  let root = null;
  let elScore = null;

  // quest
  let elGoalLabel = null;
  let elGoalBar = null;
  let elGoalCap = null;

  let elMiniWrap = null;

  // coach
  let elCoach = null;
  let elCoachText = null;

  function ensureUI() {
    if (root && root.isConnected) return;

    // root wrapper
    root = document.createElement('div');
    root.className = 'fg-hud-root';
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '650';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.justifyContent = 'space-between';
    root.style.padding = '10px';

    // ---- Top Left: Score + Goal + Mini ----
    const top = document.createElement('div');
    top.style.display = 'flex';
    top.style.flexDirection = 'column';
    top.style.gap = '10px';
    top.style.pointerEvents = 'none';

    // Score card
    const cardScore = document.createElement('div');
    cardScore.className = 'fg-card';
    cardScore.style.pointerEvents = 'auto';
    cardScore.style.padding = '8px 12px';
    cardScore.style.background = 'rgba(15,23,42,0.92)';
    cardScore.style.border = '1px solid rgba(148,163,184,0.25)';
    cardScore.style.borderRadius = '14px';
    cardScore.style.maxWidth = '200px';

    const lblScore = document.createElement('div');
    lblScore.style.fontSize = '11px';
    lblScore.style.color = '#9ca3af';
    lblScore.textContent = 'คะแนน';

    elScore = document.createElement('div');
    elScore.style.fontSize = '22px';
    elScore.style.fontWeight = '700';
    elScore.style.color = '#22c55e';
    elScore.textContent = '0';

    cardScore.appendChild(lblScore);
    cardScore.appendChild(elScore);

    // Goal card
    const cardGoal = document.createElement('div');
    cardGoal.className = 'fg-card';
    cardGoal.style.pointerEvents = 'auto';
    cardGoal.style.padding = '8px 12px';
    cardGoal.style.background = 'rgba(15,23,42,0.92)';
    cardGoal.style.border = '1px solid rgba(148,163,184,0.25)';
    cardGoal.style.borderRadius = '14px';
    cardGoal.style.maxWidth = '300px';

    const lblGoal = document.createElement('div');
    lblGoal.style.fontSize = '11px';
    lblGoal.style.color = '#9ca3af';
    lblGoal.style.marginBottom = '3px';
    lblGoal.textContent = 'Goal';

    elGoalLabel = document.createElement('div');
    elGoalLabel.style.fontSize = '13px';
    elGoalLabel.style.fontWeight = '600';
    elGoalLabel.textContent = '-';

    const barGoal = document.createElement('div');
    barGoal.style.position = 'relative';
    barGoal.style.height = '5px';
    barGoal.style.background = 'rgba(15,23,42,0.6)';
    barGoal.style.borderRadius = '999px';
    barGoal.style.marginTop = '5px';
    barGoal.style.overflow = 'hidden';

    elGoalBar = document.createElement('div');
    elGoalBar.style.position = 'absolute';
    elGoalBar.style.inset = '0';
    elGoalBar.style.width = '0%';
    elGoalBar.style.background = 'linear-gradient(90deg,#22c55e,#4ade80)';
    elGoalBar.style.transition = 'width .2s ease-out';

    barGoal.appendChild(elGoalBar);

    elGoalCap = document.createElement('div');
    elGoalCap.style.fontSize = '10px';
    elGoalCap.style.marginTop = '3px';
    elGoalCap.style.color = '#9ca3af';
    elGoalCap.textContent = '0 / 0';

    cardGoal.appendChild(lblGoal);
    cardGoal.appendChild(elGoalLabel);
    cardGoal.appendChild(barGoal);
    cardGoal.appendChild(elGoalCap);

    // Mini Quest card
    const cardMini = document.createElement('div');
    cardMini.className = 'fg-card';
    cardMini.style.pointerEvents = 'auto';
    cardMini.style.padding = '8px 12px';
    cardMini.style.background = 'rgba(15,23,42,0.92)';
    cardMini.style.border = '1px solid rgba(148,163,184,0.25)';
    cardMini.style.borderRadius = '14px';
    cardMini.style.maxWidth = '300px';

    const lblMini = document.createElement('div');
    lblMini.style.fontSize = '11px';
    lblMini.style.color = '#9ca3af';
    lblMini.style.marginBottom = '3px';
    lblMini.textContent = 'Mini Quests';

    elMiniWrap = document.createElement('div');
    elMiniWrap.style.display = 'flex';
    elMiniWrap.style.flexDirection = 'column';
    elMiniWrap.style.gap = '6px';

    cardMini.appendChild(lblMini);
    cardMini.appendChild(elMiniWrap);

    top.appendChild(cardScore);
    top.appendChild(cardGoal);
    top.appendChild(cardMini);

    // ---- Bottom Coach ----
    elCoach = document.createElement('div');
    elCoach.style.minWidth = '60%';
    elCoach.style.maxWidth = '700px';
    elCoach.style.margin = '0 auto 20px';
    elCoach.style.padding = '8px 16px';
    elCoach.style.display = 'none';
    elCoach.style.alignItems = 'center';
    elCoach.style.justifyContent = 'center';
    elCoach.style.gap = '8px';
    elCoach.style.pointerEvents = 'auto';

    elCoach.style.background = 'rgba(15,23,42,0.95)';
    elCoach.style.border = '1px solid rgba(52,211,153,0.55)';
    elCoach.style.borderRadius = '999px';
    elCoach.style.fontSize = '13px';

    const coachLbl = document.createElement('span');
    coachLbl.style.fontSize = '11px';
    coachLbl.style.letterSpacing = '.12em';
    coachLbl.style.color = '#6ee7b7';
    coachLbl.style.textTransform = 'uppercase';
    coachLbl.textContent = 'โค้ช';

    elCoachText = document.createElement('span');
    elCoachText.textContent = 'ยินดีต้อนรับ';

    elCoach.appendChild(coachLbl);
    elCoach.appendChild(elCoachText);

    root.appendChild(top);
    root.appendChild(elCoach);
    document.body.appendChild(root);
  }

  // ---------------------------------------------------------
  // Public API
  // ---------------------------------------------------------
  ns.foodGroupsUI = {

    attachScene() {
      ensureUI();
    },

    show() {
      if (!root) ensureUI();
      root.style.display = 'flex';
    },

    hide() {
      if (!root) return;
      root.style.display = 'none';
    },

    reset() {
      if (!root) ensureUI();
      elScore.textContent = '0';
      elGoalLabel.textContent = '-';
      elGoalBar.style.width = '0%';
      elGoalCap.textContent = '0 / 0';
      elMiniWrap.innerHTML = '';
    },

    setScore(v) {
      if (!root) ensureUI();
      elScore.textContent = v;
    },

    // -------- Quest UI update --------
    updateQuest({ goal, minis }) {
      ensureUI();

      // Goal
      if (goal) {
        elGoalLabel.textContent = goal.label || 'Goal';
        const pct = goal.target ? (goal.prog / goal.target) * 100 : 0;
        elGoalBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
        elGoalCap.textContent = `${goal.prog} / ${goal.target}`;
      }

      // Minis
      elMiniWrap.innerHTML = '';
      minis.forEach((mq) => {
        const row = document.createElement('div');

        const lbl = document.createElement('div');
        lbl.style.fontSize = '12px';
        lbl.style.fontWeight = '500';
        lbl.textContent = mq.label;

        const bar = document.createElement('div');
        bar.style.position = 'relative';
        bar.style.height = '4px';
        bar.style.background = 'rgba(15,23,42,0.7)';
        bar.style.borderRadius = '999px';
        bar.style.marginTop = '3px';
        bar.style.overflow = 'hidden';

        const barFill = document.createElement('div');
        barFill.style.position = 'absolute';
        barFill.style.inset = '0';
        const pct = mq.target ? (mq.prog / mq.target) * 100 : 0;
        barFill.style.width = Math.min(100, Math.max(0, pct)) + '%';
        barFill.style.background = mq.cleared
          ? 'linear-gradient(90deg,#22c55e,#4ade80)'
          : 'linear-gradient(90deg,#3b82f6,#60a5fa)';
        barFill.style.transition = 'width .2s ease-out';

        bar.appendChild(barFill);

        const cap = document.createElement('div');
        cap.style.fontSize = '10px';
        cap.style.color = '#9ca3af';
        cap.style.marginTop = '2px';
        cap.textContent = `${mq.prog} / ${mq.target}`;

        row.appendChild(lbl);
        row.appendChild(bar);
        row.appendChild(cap);

        elMiniWrap.appendChild(row);
      });
    },

    // -------- Coach --------
    coachSay(text) {
      ensureUI();
      elCoachText.textContent = text;
      elCoach.style.display = 'flex';
      setTimeout(() => {
        if (elCoach) elCoach.style.display = 'none';
      }, 4200);
    }
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));