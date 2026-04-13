// /herohealth/vr-brush-kids/brush.ui.js

function setText(node, value) {
  if (!node) return;
  node.textContent = String(value ?? '');
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
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

  if ((zone?.threatPercent || 0) >= 70 && !zone?.done) {
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
      const n = Number.parseInt(String(vm.threatText || '0%'), 10);
      if (Number.isFinite(n)) {
        if (n >= 75) el.threatText.style.color = '#c93d5d';
        else if (n >= 45) el.threatText.style.color = '#9b7200';
        else el.threatText.style.color = '';
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

      const ring = document.querySelector(`[data-ring-zone="${zone.id}"]`);
      if (!ring) return;

      ring.classList.toggle('is-zone-active', !!zone.active);
      ring.classList.toggle('is-zone-done', !!zone.done);
    });
  }

  function renderCoach(face, line) {
    setText(el.coachFace, face || '🪥');
    setText(el.coachLine, line || '');
  }

  function renderScanHud(vm = {}) {
    setText(el.scanTimerText, vm.timerText || '');
    setText(el.scanFoundText, vm.foundText || '');

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
    if (el.summaryModal) el.summaryModal.hidden = true;
  }

  function renderObjective(text, sceneId = '') {
    if (!el.objectiveText) return;
    setText(el.objectiveText, text || '');

    el.objectiveCard?.classList.remove(
      'is-scan-mode',
      'is-guided-mode',
      'is-pressure-mode',
      'is-boss-mode',
      'is-finish-mode'
    );

    if (sceneId === 'scan') {
      el.objectiveCard?.classList.add('is-scan-mode');
    } else if (sceneId === 'guided' || sceneId === 'intro' || sceneId === 'launcher') {
      el.objectiveCard?.classList.add('is-guided-mode');
    } else if (sceneId === 'pressure' || sceneId === 'fever') {
      el.objectiveCard?.classList.add('is-pressure-mode');
    } else if (sceneId === 'bossBreak' || sceneId === 'boss') {
      el.objectiveCard?.classList.add('is-boss-mode');
    } else if (sceneId === 'finish' || sceneId === 'summary') {
      el.objectiveCard?.classList.add('is-finish-mode');
    }
  }

  function renderLauncherHint(modeLabel = 'Adventure') {
    renderCoach('🪥', 'พร้อมช่วยฟันแล้ว กดเริ่มได้เลย');
    renderObjective(`เริ่มภารกิจ ${modeLabel}`, 'launcher');
    renderSceneMood('launcher');
  }

  function renderSceneMood(sceneId) {
    if (!el.sceneStage) return;

    const root = el.sceneStage;
    root.dataset.scene = sceneId || '';

    el.scanCard?.classList.remove('is-emphasis');
    el.bossCard?.classList.remove('is-emphasis');
    el.helperCard?.classList.remove('is-warning', 'is-success');

    document.querySelectorAll('[data-ring-zone]').forEach((ring) => {
      ring.classList.remove('is-scene-focus');
    });

    if (sceneId === 'scan') {
      root.style.filter = 'saturate(1.03) brightness(1.02)';
      el.scanCard?.classList.add('is-emphasis');
      document.querySelectorAll('[data-ring-zone]').forEach((ring) => ring.classList.add('is-scene-focus'));
    } else if (sceneId === 'guided') {
      root.style.filter = 'brightness(1.01)';
      document.querySelectorAll('[data-ring-zone]').forEach((ring, index) => {
        if (index < 2) ring.classList.add('is-scene-focus');
      });
    } else if (sceneId === 'pressure' || sceneId === 'fever') {
      root.style.filter = 'saturate(1.06) contrast(1.01)';
      el.helperCard?.classList.add('is-warning');
      document.querySelectorAll('[data-ring-zone]').forEach((ring, index) => {
        if (index % 2 === 0) ring.classList.add('is-scene-focus');
      });
    } else if (sceneId === 'bossBreak' || sceneId === 'boss') {
      root.style.filter = 'saturate(1.10) contrast(1.03)';
      el.bossCard?.classList.add('is-emphasis');
      el.helperCard?.classList.add('is-warning');
      document.querySelectorAll('[data-ring-zone]').forEach((ring) => ring.classList.add('is-scene-focus'));
    } else if (sceneId === 'finish' || sceneId === 'summary') {
      root.style.filter = 'brightness(1.05) saturate(1.02)';
      el.helperCard?.classList.add('is-success');
      document.querySelectorAll('[data-ring-zone]').forEach((ring) => ring.classList.add('is-scene-focus'));
    } else {
      root.style.filter = '';
    }
  }

  function clearNode(node) {
    if (!node) return;
    node.innerHTML = '';
  }

  function applyPos(node, x, y) {
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
  }

  function playHitFxAt(x, y, kind = 'hit') {
    if (!el.fxLayer) return;

    const burst = document.createElement('div');
    burst.className = 'fx-burst';
    if (kind === 'miss') burst.classList.add('is-miss');
    if (kind === 'complete') burst.classList.add('is-complete');

    applyPos(burst, x, y);
    el.fxLayer.appendChild(burst);

    setTimeout(() => burst.remove(), 420);
  }

  function renderPlaques(items = []) {
    clearNode(el.plaqueLayer);

    ensureArray(items).forEach((item) => {
      if (item.hidden) return;

      const node = document.createElement('div');
      node.className = 'plaque-node';

      if (item.type === 'heavy') node.classList.add('is-heavy');
      if (item.type === 'gap') node.classList.add('is-gap');
      if (item.dim) node.classList.add('is-dim');
      if (item.active) node.classList.add('is-active-zone');
      if (item.levelClass === 'low') node.classList.add('is-low');
      if (item.levelClass === 'mid') node.classList.add('is-mid');
      if (item.levelClass === 'high') node.classList.add('is-high');
      if (item.rank) node.classList.add(`plaque-${item.rank}`);

      node.setAttribute('data-zone', item.zoneId);
      node.setAttribute('data-plaque-id', item.id);
      applyPos(node, item.x, item.y);

      el.plaqueLayer?.appendChild(node);
    });
  }

  function renderScanTargets(items = []) {
    clearNode(el.scanTargetLayer);

    ensureArray(items).forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'scan-target';
      btn.type = 'button';

      if (item.special) btn.classList.add('is-special');
      if (item.picked) btn.classList.add('is-picked');

      btn.disabled = !!item.picked;
      btn.setAttribute('aria-label', `scan target ${item.id}`);
      btn.title = `${item.zoneId}${item.special ? ' • special' : ''}`;

      applyPos(btn, item.x, item.y);

      btn.addEventListener('click', () => {
        window.brushScanPick?.(item.id);
      });

      el.scanTargetLayer?.appendChild(btn);
    });
  }

  function renderBossWeakPoints(items = []) {
    clearNode(el.bossWeakPointLayer);

    ensureArray(items).forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'boss-weakpoint';
      btn.type = 'button';

      if (item.hit) btn.classList.add('is-hit');
      btn.disabled = !!item.hit;
      btn.setAttribute('aria-label', `boss weak point ${item.id}`);
      btn.title = item.id;

      applyPos(btn, item.x, item.y);

      btn.addEventListener('click', () => {
        window.brushBossBreakHit?.(item.id);
      });

      el.bossWeakPointLayer?.appendChild(btn);
    });
  }

  function playTrailAt(xPx, yPx, kind = 'good') {
    if (!el.brushTrailLayer) return;

    const dot = document.createElement('div');
    dot.className = 'brush-trail-dot';
    if (kind === 'weak') dot.classList.add('is-weak');
    if (kind === 'bad') dot.classList.add('is-bad');

    dot.style.left = `${xPx}px`;
    dot.style.top = `${yPx}px`;

    el.brushTrailLayer.appendChild(dot);

    setTimeout(() => dot.remove(), 460);
  }

  function renderPatternTutor(vm = {}) {
    if (!el.patternTutor) return;

    if (!vm.visible) {
      el.patternTutor.hidden = true;
      return;
    }

    el.patternTutor.hidden = false;
    el.patternTutor.style.left = `${vm.x}%`;
    el.patternTutor.style.top = `${vm.y}%`;

    setText(el.patternTutorGlyph, vm.glyph || '↔');
    setText(el.patternTutorLabel, vm.label || '');

    el.patternTutor.classList.remove(
      'is-horizontal',
      'is-vertical',
      'is-circle',
      'is-perfect',
      'is-ok',
      'is-bad',
      'scene-guided',
      'scene-pressure',
      'scene-boss'
    );

    if (vm.patternType === 'horizontal') el.patternTutor.classList.add('is-horizontal');
    if (vm.patternType === 'vertical') el.patternTutor.classList.add('is-vertical');
    if (vm.patternType === 'circle') el.patternTutor.classList.add('is-circle');

    if (vm.quality === 'perfect') el.patternTutor.classList.add('is-perfect');
    else if (vm.quality === 'ok') el.patternTutor.classList.add('is-ok');
    else if (vm.quality === 'bad') el.patternTutor.classList.add('is-bad');

    if (vm.sceneTone) el.patternTutor.classList.add(vm.sceneTone);
  }

  function renderBossVisual(vm = {}) {
    if (!el.bossBody || !el.bossShield) return;

    if (!vm.visible) {
      el.bossBody.hidden = true;
      el.bossShield.hidden = true;
      el.bossBody.classList.remove('is-visible', 'is-break', 'is-burst', 'is-weak', 'is-hit');
      el.bossShield.classList.remove('is-visible', 'is-low', 'is-broken');
      return;
    }

    el.bossBody.hidden = false;
    el.bossShield.hidden = !vm.shieldVisible;

    el.bossBody.classList.remove('is-break', 'is-burst', 'is-weak', 'is-hit');
    el.bossShield.classList.remove('is-low', 'is-broken');

    el.bossBody.classList.add('is-visible');
    if (vm.shieldVisible) el.bossShield.classList.add('is-visible');

    if (vm.bossTone) el.bossBody.classList.add(vm.bossTone);
    if (vm.hitFlash) el.bossBody.classList.add('is-hit');

    const shieldRatio = clamp(Number(vm.shieldRatio || 0), 0, 1);
    if (shieldRatio <= 0.05) {
      el.bossShield.classList.add('is-broken');
    } else if (shieldRatio <= 0.45) {
      el.bossShield.classList.add('is-low');
    }

    el.bossBody.style.opacity = '1';
    el.bossShield.style.opacity = vm.shieldVisible ? '' : '0';
  }

  function showScorePopup(x, y, text, kind = 'good') {
    if (!el.scorePopupLayer) return;

    const node = document.createElement('div');
    node.className = 'score-popup';
    if (kind) node.classList.add(`is-${kind}`);

    node.textContent = text || '';
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;

    el.scorePopupLayer.appendChild(node);
    setTimeout(() => node.remove(), 760);
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
    renderSceneMood,
    renderPlaques,
    renderScanTargets,
    renderBossWeakPoints,
    renderBossVisual,
    playHitFxAt,
    playTrailAt,
    renderPatternTutor,
    showScorePopup
  };
}
