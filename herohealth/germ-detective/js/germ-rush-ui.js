// /herohealth/germ-detective/js/germ-rush-ui.js
// Germ Detective: Outbreak Rush
// UI LAYER MODULE
// PATCH v20260410d-germ-rush-ui-polish1

import {
  TOOL_ORDER,
  UI_TEXT,
  getToolDef,
  clamp
} from './germ-rush-data.js';

const TOOL_MATCH_COLORS = {
  wipe: '#67c8ff',
  spray: '#7ae582',
  trash: '#ffb84d'
};

export function createGermRushUI({ ui, query }) {
  let bound = false;
  let selectedTool = 'wipe';

  function fmtTime(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function setPrompt(text) {
    if (ui.promptBox) ui.promptBox.textContent = text;
  }

  function applyIntroText() {
    if (ui.startTitle) ui.startTitle.textContent = UI_TEXT.introTitle;
    if (ui.startSub) ui.startSub.textContent = UI_TEXT.introShort;
  }

  function renderToolBar(onSelectTool) {
    if (!ui.toolBar) return;

    ui.toolBar.innerHTML = '';

    for (const toolId of TOOL_ORDER) {
      const tool = getToolDef(toolId);
      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.dataset.toolId = tool.id;
      btn.innerHTML = `
        <span class="tool-icon">${tool.icon}</span>
        <span class="tool-name">${tool.shortLabel}</span>
        <span class="tool-key">กด ${tool.key}</span>
      `;
      btn.addEventListener('click', () => onSelectTool(tool.id));
      ui.toolBar.appendChild(btn);
    }

    syncToolButtons(selectedTool);
  }

  function syncToolButtons(toolId) {
    selectedTool = toolId;
    if (!ui.toolBar) return;

    [...ui.toolBar.querySelectorAll('.tool-btn')].forEach((btn) => {
      const id = btn.dataset.toolId;
      const active = id === selectedTool;
      btn.classList.toggle('is-selected', active);
      btn.style.background = active
        ? `${TOOL_MATCH_COLORS[id]}22`
        : 'rgba(255,255,255,.07)';
      btn.style.borderColor = active
        ? `${TOOL_MATCH_COLORS[id]}aa`
        : 'rgba(255,255,255,.10)';
    });
  }

  function updateHUD({
    infection = 0,
    score = 0,
    combo = 0,
    wrongTool = 0,
    phaseLabel = 'READY',
    timeLeftMs = 0,
    bossPct = 0
  }) {
    if (ui.infectionValue) ui.infectionValue.textContent = Math.round(infection);
    if (ui.infectionFill) {
      ui.infectionFill.style.width = `${clamp(infection, 0, 100)}%`;
      if (infection < 35) ui.infectionFill.style.filter = 'saturate(1)';
      else if (infection < 70) ui.infectionFill.style.filter = 'saturate(1.15)';
      else ui.infectionFill.style.filter = 'saturate(1.4)';
    }

    if (ui.scoreText) ui.scoreText.textContent = `SCORE ${String(Math.round(score)).padStart(4, '0')}`;
    if (ui.comboValue) ui.comboValue.textContent = combo;
    if (ui.wrongToolValue) ui.wrongToolValue.textContent = wrongTool;
    if (ui.phaseText) ui.phaseText.textContent = String(phaseLabel || 'READY').toUpperCase();
    if (ui.timerText) ui.timerText.textContent = fmtTime(timeLeftMs);
    if (ui.bossFill) ui.bossFill.style.width = `${clamp(bossPct, 0, 100)}%`;
  }

  function updateRoomTint({ infection = 0, bossActive = false }) {
    if (!ui.roomTint) return;

    const normalized = clamp(infection / 100, 0, 1);
    const bossBonus = bossActive ? 0.12 : 0;
    const opacity = Math.min(0.42, (normalized * 0.34) + bossBonus);

    ui.roomTint.style.opacity = String(opacity);

    if (bossActive) {
      ui.roomTint.style.background = `
        radial-gradient(circle at center, rgba(255,255,255,0) 30%, rgba(255,122,139,.18) 100%),
        linear-gradient(180deg, rgba(255,0,60,.04), rgba(255,0,60,.10))
      `;
    } else if (infection >= 70) {
      ui.roomTint.style.background = `
        radial-gradient(circle at center, rgba(255,255,255,0) 34%, rgba(255,122,139,.16) 100%),
        linear-gradient(180deg, rgba(255,0,60,.00), rgba(255,0,60,.09))
      `;
    } else if (infection >= 35) {
      ui.roomTint.style.background = `
        radial-gradient(circle at center, rgba(255,255,255,0) 36%, rgba(255,215,104,.12) 100%),
        linear-gradient(180deg, rgba(255,180,0,.00), rgba(255,180,0,.05))
      `;
    } else {
      ui.roomTint.style.background = `
        radial-gradient(circle at center, rgba(255,255,255,0) 38%, rgba(114,240,255,.08) 100%),
        linear-gradient(180deg, rgba(0,180,255,.00), rgba(0,180,255,.02))
      `;
    }
  }

  function showBossAlarm(text = 'BOSS ALERT!') {
    if (!ui.bossAlarm) return;
    ui.bossAlarm.textContent = text;
    ui.bossAlarm.style.display = 'block';
  }

  function hideBossAlarm() {
    if (!ui.bossAlarm) return;
    ui.bossAlarm.style.display = 'none';
  }

  function showFeedback(text, kind = 'good') {
    if (!ui.feedbackChip) return;

    ui.feedbackChip.textContent = text;
    ui.feedbackChip.style.display = 'block';

    if (kind === 'good') {
      ui.feedbackChip.style.background = 'rgba(119,239,157,.16)';
      ui.feedbackChip.style.border = '1px solid rgba(119,239,157,.30)';
      ui.feedbackChip.style.color = '#e7fff0';
    } else if (kind === 'warn') {
      ui.feedbackChip.style.background = 'rgba(255,215,104,.18)';
      ui.feedbackChip.style.border = '1px solid rgba(255,215,104,.34)';
      ui.feedbackChip.style.color = '#fff1b9';
    } else {
      ui.feedbackChip.style.background = 'rgba(255,122,139,.16)';
      ui.feedbackChip.style.border = '1px solid rgba(255,122,139,.30)';
      ui.feedbackChip.style.color = '#ffe4e8';
    }

    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => {
      ui.feedbackChip.style.display = 'none';
    }, kind === 'warn' ? 780 : 900);
  }

  function flashDamage() {
    if (!ui.damageFlash) return;

    ui.damageFlash.style.display = 'block';
    ui.damageFlash.style.opacity = '1';

    clearTimeout(flashDamage._t1);
    clearTimeout(flashDamage._t2);

    flashDamage._t1 = setTimeout(() => {
      ui.damageFlash.style.opacity = '0';
    }, 180);

    flashDamage._t2 = setTimeout(() => {
      ui.damageFlash.style.display = 'none';
    }, 650);
  }

  function showCombo(combo) {
    if (!ui.comboChip || combo < 2) return;

    let label = `COMBO x${combo}`;
    if (combo >= 10) label = `ULTRA CLEAN x${combo}`;
    else if (combo >= 7) label = `SUPER CLEAN x${combo}`;
    else if (combo >= 5) label = `GREAT x${combo}`;
    else if (combo >= 3) label = `NICE x${combo}`;

    ui.comboChip.textContent = label;
    ui.comboChip.style.display = 'block';

    clearTimeout(showCombo._t);
    showCombo._t = setTimeout(() => {
      ui.comboChip.style.display = 'none';
    }, 950);
  }

  function showStart() {
    if (ui.startOverlay) ui.startOverlay.classList.add('is-open');
  }

  function hideStart() {
    if (ui.startOverlay) ui.startOverlay.classList.remove('is-open');
  }

  function showSummary({ win, summary }) {
    if (ui.summaryTitle) {
      ui.summaryTitle.textContent = win ? 'Mission Clear!' : 'Mission Incomplete';
      ui.summaryTitle.style.color = win ? '#86ffb2' : '#ff9aa5';
    }

    if (ui.summarySub) {
      ui.summarySub.textContent = win
        ? 'คุณหยุดการแพร่เชื้อได้ดีมาก'
        : 'ยังมีการแพร่เชื้อเกินควบคุมในรอบนี้';
    }

    if (ui.starsText) {
      ui.starsText.textContent =
        summary.stars === 3 ? '⭐ ⭐ ⭐' :
        summary.stars === 2 ? '⭐ ⭐' : '⭐';
    }

    if (ui.sumScore) ui.sumScore.textContent = summary.score;
    if (ui.sumCombo) ui.sumCombo.textContent = summary.bestCombo;
    if (ui.sumCleared) ui.sumCleared.textContent = summary.cleared;
    if (ui.sumWrong) ui.sumWrong.textContent = summary.wrongTool;
    if (ui.sumInfection) ui.sumInfection.textContent = summary.infection;
    if (ui.sumBadge) ui.sumBadge.textContent = summary.badge;

    if (ui.adviceList) {
      ui.adviceList.innerHTML = '';
      summary.advice.forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        ui.adviceList.appendChild(li);
      });
    }

    if (ui.summaryOverlay) ui.summaryOverlay.classList.add('is-open');
  }

  function hideSummary() {
    if (ui.summaryOverlay) ui.summaryOverlay.classList.remove('is-open');
  }

  function bindStaticButtons({ onStart, onReplay, onGoHub }) {
    if (bound) return;
    bound = true;

    if (query.hub) {
      if (ui.backHubBtn) {
        ui.backHubBtn.style.display = 'inline-flex';
        ui.backHubBtn.onclick = onGoHub;
      }
      if (ui.summaryHubBtn) {
        ui.summaryHubBtn.style.display = 'inline-flex';
        ui.summaryHubBtn.onclick = onGoHub;
      }
    }

    if (ui.startBtn) ui.startBtn.addEventListener('click', onStart);
    if (ui.replayBtn) ui.replayBtn.addEventListener('click', onReplay);
  }

  return {
    applyIntroText,
    renderToolBar,
    syncToolButtons,
    updateHUD,
    updateRoomTint,
    showBossAlarm,
    hideBossAlarm,
    setPrompt,
    showFeedback,
    flashDamage,
    showCombo,
    showStart,
    hideStart,
    showSummary,
    hideSummary,
    bindStaticButtons
  };
}