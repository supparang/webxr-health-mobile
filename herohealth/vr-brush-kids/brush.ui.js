// /herohealth/vr-brush-kids/brush.ui.js
// Brush V5 UI renderer
// PATCH v20260413-brush-ui-first-playable

function setText(node, value) {
  if (!node) return;
  node.textContent = String(value ?? '');
}

function setHtml(node, value) {
  if (!node) return;
  node.innerHTML = String(value ?? '');
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function percentText(v) {
  return `${Math.round(Number(v) || 0)}%`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function findZoneButton(zoneId) {
  return document.querySelector(`[data-zone="${zoneId}"]`);
}

function zoneStateFromVm(zone) {
  if (!zone) return 'idle';
  if (zone.done) return 'done';
  if (zone.active) return 'active';
  if ((zone.cleanPercent || 0) > 0) return 'active';
  return 'idle';
}

function zoneLabelText(zone) {
  const clean = Math.round(zone?.cleanPercent || 0);
  return `${zone?.label || '-'} ${clean}%`;
}

function applyVisualStateToZoneButton(node, zone) {
  if (!node) return;

  const state = zoneStateFromVm(zone);
  node.dataset.state = state;
  node.setAttribute('aria-pressed', zone?.active ? 'true' : 'false');
  node.classList.toggle('is-active-zone', !!zone?.active);
  node.classList.toggle('is-done-zone', !!zone?.done);

  if (zone?.threatPercent >= 70 && !zone?.done) {
    node.style.boxShadow = '0 0 0 3px rgba(255,120,145,.18), 0 8px 20px rgba(71,156,197,.10)';
  } else {
    node.style.boxShadow = '';
  }
}

function sceneLabel(sceneId) {
  const map = {
    launcher: 'launcher',
    intro: 'intro',
    scan: 'scan',
    guided: 'guided',
    pressure: 'pressure',
    fever: 'fever',
    bossBreak: 'bossBreak',
    boss: 'boss',
    finish: 'finish',
    summary: 'summary'
  };
  return map[sceneId] || sceneId || '-';
}

function renderSummaryMetric(node, value, suffix = '') {
  if (!node) return;
  node.textContent = `${value ?? 0}${suffix}`;
}

export function createBrushUI(el) {
  function renderTopHud(vm = {}) {
    setText(el.timeText, vm.timeText || '0s');
    setText(el.scoreText, vm.scoreText ?? 0);
    setText(el.comboText, vm.comboText ?? 0);
    setText(el.threatText, vm.threatText || '0%');
    setText(el.sceneText, sceneLabel(vm.sceneText));

    if (el.threatText) {
      const threatValue = String(vm.threatText || '0%');
      const n = Number.parseInt(threatValue, 10);
      if (Number.isFinite(n)) {
        if (n >= 75) {
          el.threatText.style.color = '#c93d5d';
        } else if (n >= 45) {
          el.threatText.style.color = '#9b7200';
        } else {
          el.threatText.style.color = '';
        }
      }
    }

    if (el.comboText) {
      const combo = Number(vm.comboText || 0);
      if (combo >= 12) {
        el.comboText.style.color = '#ff7e48';
        el.comboText.style.textShadow = '0 0 10px rgba(255,126,72,.35)';
      } else if (combo >= 6) {
        el.comboText.style.color = '#4aaef0';
        el.comboText.style.textShadow = '0 0 8px rgba(74,174,240,.28)';
      } else {
        el.comboText.style.color = '';
        el.comboText.style.textShadow = '';
      }
    }

    if (el.scoreText) {
      if (vm.feverActive) {
        el.scoreText.style.color = '#e5672d';
        el.scoreText.style.textShadow = '0 0 12px rgba(255,160,88,.35)';
      } else {
        el.scoreText.style.color = '';
        el.scoreText.style.textShadow = '';
      }
    }
  }

  function renderMiniMap(zones = []) {
    const list = ensureArray(zones);

    list.forEach((zone) => {
      const node = findZoneButton(zone.id);
      if (!node) return;
      node.textContent = zoneLabelText(zone);
      applyVisualStateToZoneButton(node, zone);
      node.title = `${zone.label} • clean ${Math.round(zone.cleanPercent || 0)}% • threat ${Math.round(zone.threatPercent || 0)}%`;
    });
  }

  function renderCoach(face, line) {
    setText(el.coachFace, face || '🪥');
    setText(el.coachLine, line || '');
  }

  function renderScanHud(vm = {}) {
    setText(el.scanTimerText, vm.timerText || '');
    setText(el.scanFoundText, vm.foundText || '');

    if (vm.objectiveText) {
      setText(el.objectiveText, vm.objectiveText);
    }

    if (el.scanTimerText) {
      el.scanTimerText.style.opacity = vm.timerText ? '1' : '.35';
    }

    if (el.scanFoundText) {
      el.scanFoundText.style.opacity = vm.foundText ? '1' : '.35';
    }
  }

  function renderBossBreakHud(vm = {}) {
    setText(el.bossShieldText, vm.shieldText || '');
    setText(el.bossBreakTimerText, vm.timerText || '');
    setText(el.bossBreakCountText, vm.countText || '');

    if (el.bossBreakTimerText) {
      const timerNum = Number.parseInt(String(vm.timerText || '').replace(/[^\d-]/g, ''), 10);
      if (Number.isFinite(timerNum) && timerNum <= 3 && timerNum >= 0) {
        el.bossBreakTimerText.style.color = '#c93d5d';
        el.bossBreakTimerText.style.textShadow = '0 0 10px rgba(255,102,126,.32)';
      } else {
        el.bossBreakTimerText.style.color = '';
        el.bossBreakTimerText.style.textShadow = '';
      }
    }
  }

  function renderSummary(result = {}) {
    if (el.summaryModal) {
      el.summaryModal.hidden = false;
    }

    renderSummaryMetric(el.summaryRank, result.finalRank || '-');
    renderSummaryMetric(el.summaryScore, result.finalScore || 0);
    renderSummaryMetric(el.summaryCoverage, result.coveragePercent || 0, '%');
    renderSummaryMetric(el.summaryAccuracy, result.accuracyPercent || 0, '%');

    setText(el.summaryAdvice, result.summaryAdvice || 'ลองเล่นอีกรอบเพื่อดูความต่างของผลลัพธ์');

    if (el.summaryRank) {
      const rank = String(result.finalRank || '').toUpperCase();
      if (rank === 'S') {
        el.summaryRank.style.color = '#d48b00';
        el.summaryRank.style.textShadow = '0 0 12px rgba(255,200,92,.35)';
      } else if (rank === 'A') {
        el.summaryRank.style.color = '#1f8f66';
        el.summaryRank.style.textShadow = '0 0 10px rgba(143,236,192,.30)';
      } else if (rank === 'B') {
        el.summaryRank.style.color = '#2d7ac2';
        el.summaryRank.style.textShadow = '0 0 10px rgba(114,215,255,.30)';
      } else {
        el.summaryRank.style.color = '#7d5e6e';
        el.summaryRank.style.textShadow = '';
      }
    }

    if (el.summaryAdvice) {
      const coverage = Number(result.coveragePercent || 0);
      const accuracy = Number(result.accuracyPercent || 0);

      if (coverage >= 85 && accuracy >= 80) {
        el.summaryAdvice.style.color = '#1f8f66';
      } else if (coverage >= 65 && accuracy >= 60) {
        el.summaryAdvice.style.color = '#866400';
      } else {
        el.summaryAdvice.style.color = '#8a4863';
      }
    }
  }

  function closeSummary() {
    if (el.summaryModal) {
      el.summaryModal.hidden = true;
    }
  }

  function renderObjective(text) {
    if (!el.objectiveText) return;
    setText(el.objectiveText, text || '');
  }

  function renderLauncherHint(modeLabel = 'Adventure') {
    renderCoach('🪥', 'พร้อมช่วยฟันแล้ว กดเริ่มได้เลย');
    renderObjective(`เริ่มภารกิจ ${modeLabel}`);
  }

  function renderSceneMood(sceneId) {
    if (!el.sceneStage) return;

    const root = el.sceneStage;
    root.dataset.scene = sceneId || '';

    if (sceneId === 'scan') {
      root.style.filter = 'saturate(1.02) brightness(1.02)';
    } else if (sceneId === 'bossBreak' || sceneId === 'boss') {
      root.style.filter = 'saturate(1.08) contrast(1.02)';
    } else if (sceneId === 'finish' || sceneId === 'summary') {
      root.style.filter = 'brightness(1.04)';
    } else {
      root.style.filter = '';
    }
  }

  return {
    renderTopHud,
    renderMiniMap,
    renderCoach,
    renderScanHud,
    renderBossBreakHud,
    renderSummary,
    closeSummary,
    renderObjective,
    renderLauncherHint,
    renderSceneMood
  };
}