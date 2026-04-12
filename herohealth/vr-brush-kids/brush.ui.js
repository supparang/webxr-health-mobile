export function createBrushUI(el) {
  ensureBrushUiStyle();

  let centerHint = null;

  if (el.brushPad) {
    centerHint = document.createElement('div');
    centerHint.className = 'brush-center-hint';
    el.brushPad.appendChild(centerHint);
  }

  const faceMap = {
    neutral: '🦷',
    happy: '😁',
    sad: '😅',
    fever: '⚡'
  };

  function setCoach(face, line) {
    if (el.coachFace) {
      el.coachFace.textContent = faceMap[face] || '🦷';
      el.coachFace.dataset.mood = face || 'neutral';
    }
    if (el.coachLine) {
      el.coachLine.textContent = line || '';
    }
  }

  function renderHud(data) {
    if (el.timeText) el.timeText.textContent = data.timeText || '00:00';
    if (el.coverageText) el.coverageText.textContent = `${data.coveragePercent ?? 0}%`;
    if (el.comboText) el.comboText.textContent = String(data.comboMax ?? 0);
    if (el.phaseText) el.phaseText.textContent = data.phaseText || 'เล่นอยู่';

    if (el.goalFill) el.goalFill.style.width = `${data.coveragePercent ?? 0}%`;
    if (el.goalMiniText) el.goalMiniText.textContent = data.goalText || '';
    if (el.miniMissionText) el.miniMissionText.textContent = data.miniMissionText || '';

    if (el.zonesDoneText) el.zonesDoneText.textContent = `${data.zonesDone ?? 0} / ${data.zonesTotal ?? 0}`;
    if (el.activeZoneText) el.activeZoneText.textContent = data.activeZoneLabel || 'ยังไม่ได้เลือก';
    if (el.speedText) el.speedText.textContent = data.speedLabel || 'ปกติ';
    if (el.warnText) el.warnText.textContent = String(data.warnings ?? 0);

    el.btnLearn?.classList.toggle('is-active', data.modeId === 'learn');
    el.btnChallenge?.classList.toggle('is-active', data.modeId === 'challenge');
  }

  function renderPattern(data) {
    if (el.patternBadge) el.patternBadge.textContent = data.label || 'เลือกโซนก่อน';
    if (el.patternHint) el.patternHint.textContent = data.hint || '';
    if (el.patternProgressFill) {
      el.patternProgressFill.style.width = `${Math.max(0, Math.min(100, data.progressPercent ?? 0))}%`;
    }
    if (el.patternProgressText) {
      el.patternProgressText.textContent = data.progressText || '0 / 0 รอบ';
    }
  }

  function renderZones(zones, activeZoneId, options = {}) {
    const recommendedZoneId = options.recommendedZoneId || null;

    document.querySelectorAll('.tooth-zone').forEach(btn => {
      const zoneId = btn.dataset.zone || '';
      const zone = zones.find(z => z.id === zoneId);

      btn.classList.toggle('is-active', zoneId === activeZoneId);
      btn.classList.toggle('is-recommended', zoneId === recommendedZoneId);
      btn.classList.toggle('is-done', !!zone?.done);

      const percent = Math.round(zone?.clean || 0);
      const percentNode = btn.querySelector('.zone-percent');
      const fillNode = btn.querySelector('.zone-fill');

      if (percentNode) percentNode.textContent = `${percent}%`;
      if (fillNode) fillNode.style.width = `${percent}%`;

      btn.setAttribute(
        'aria-label',
        zone ? `${zone.label} ${percent}%` : zoneId
      );
    });
  }

  function moveBrushCursor(e, pad, cursor) {
    if (!pad || !cursor) return;
    const rect = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.style.opacity = '1';
  }

  function openHelp(open) {
    if (!el.helpModal) return;
    el.helpModal.hidden = !open;
    el.helpModal.classList.toggle('is-open', !!open);
  }

  function openSummary(result) {
    if (el.summaryTitle) {
      el.summaryTitle.textContent =
        result.summaryTitle ||
        `สรุปผล • ${result.finalRank || 'เล่นจบแล้ว'}`;
    }

    if (el.summaryRank) el.summaryRank.textContent = result.finalRank || '-';
    if (el.summaryTime) {
      el.summaryTime.textContent =
        result.timeText ||
        result.durationText ||
        result.elapsedText ||
        '00:00';
    }

    if (el.summaryCoverage) {
      el.summaryCoverage.textContent = `${result.coveragePercent ?? 0}%`;
    }

    if (el.summaryZones) {
      const zonesDone = result.zonesDone ?? 0;
      const totalZones = result.totalZones ?? 6;
      el.summaryZones.textContent = `${zonesDone} / ${totalZones}`;
    }

    if (el.summaryWarn) {
      el.summaryWarn.textContent = String(result.warnings ?? 0);
    }

    if (el.summaryAdvice) {
      el.summaryAdvice.textContent =
        result.summaryAdvice ||
        result.advice ||
        result.adviceLine ||
        'ทำได้ดีมาก ลองเล่นอีกครั้งเพื่อเก็บให้ครบทุกโซน';
    }

    if (el.summaryModal) {
      el.summaryModal.hidden = false;
      el.summaryModal.classList.add('is-open');
    }
  }

  function closeSummary() {
    if (!el.summaryModal) return;
    el.summaryModal.hidden = true;
    el.summaryModal.classList.remove('is-open');
  }

  function flashZone(zoneId) {
    const node = document.querySelector(`.tooth-zone[data-zone="${zoneId}"]`);
    if (!node) return;
    node.classList.remove('flash-zone');
    void node.offsetWidth;
    node.classList.add('flash-zone');
    setTimeout(() => node.classList.remove('flash-zone'), 650);
  }

  function setViewMode(viewMode) {
    document.documentElement.dataset.brushView = viewMode || 'pc';

    if (el.brushCursor) {
      el.brushCursor.style.display = viewMode === 'cvr' ? 'none' : '';
    }
  }

  function showCenterHint(show) {
    if (!centerHint) return;
    centerHint.classList.toggle('show', !!show);
  }

  return {
    setCoach,
    renderHud,
    renderPattern,
    renderZones,
    moveBrushCursor,
    openHelp,
    openSummary,
    closeSummary,
    flashZone,
    setViewMode,
    showCenterHint
  };
}

function ensureBrushUiStyle() {
  if (document.getElementById('brush-ui-extra-style')) return;

  const style = document.createElement('style');
  style.id = 'brush-ui-extra-style';
  style.textContent = `
    .tooth-zone.is-recommended{
      outline:3px solid #7fdcff;
      box-shadow:0 0 0 7px rgba(127,220,255,.22);
      transform:scale(1.03);
    }

    .tooth-zone.is-active{
      outline:3px solid #59c9fb;
      box-shadow:0 0 0 9px rgba(89,201,251,.22);
    }

    .tooth-zone.is-done{
      background:linear-gradient(180deg,#f7fff9,#eefcf4);
    }

    .tooth-zone.flash-zone{
      animation:brush-zone-flash .55s ease;
    }

    @keyframes brush-zone-flash{
      0%   { transform:scale(1); }
      40%  { transform:scale(1.08); }
      100% { transform:scale(1); }
    }

    .brush-center-hint{
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      width:96px;
      height:96px;
      border-radius:999px;
      border:4px dashed rgba(89,201,251,.82);
      box-shadow:0 0 0 10px rgba(89,201,251,.14);
      pointer-events:none;
      display:none;
      z-index:5;
    }

    .brush-center-hint::before,
    .brush-center-hint::after{
      content:"";
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      background:rgba(89,201,251,.92);
      border-radius:999px;
    }

    .brush-center-hint::before{
      width:36px;
      height:5px;
    }

    .brush-center-hint::after{
      width:5px;
      height:36px;
    }

    .brush-center-hint.show{
      display:block;
    }

    html[data-brush-view="cvr"] .brush-pad-guide-title::after{
      content:" • cVR-lite";
      color:#35b6f3;
    }

    html[data-brush-view="cvr"] .brush-pad-guide-text{
      content:"";
    }
  `;
  document.head.appendChild(style);
}
