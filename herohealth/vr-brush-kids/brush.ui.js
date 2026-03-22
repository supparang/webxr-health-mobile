const FACE_MAP = {
  happy: '../img/coach-happy.png',
  neutral: '../img/coach-neutral.png',
  sad: '../img/coach-sad.png',
  fever: '../img/coach-fever.png'
};

export function createBrushUI(el) {
  function setCoach(mood = 'neutral', text = '') {
    if (el.coachFace) {
      el.coachFace.src = FACE_MAP[mood] || FACE_MAP.neutral;
      el.coachFace.alt = `Coach ${mood}`;
    }
    if (el.coachLine) {
      el.coachLine.textContent = text || '';
    }
  }

  function renderHud(view) {
    if (el.timeText) el.timeText.textContent = view.timeText || '00:00';
    if (el.coverageText) el.coverageText.textContent = `${view.coveragePercent ?? 0}%`;
    if (el.comboText) el.comboText.textContent = `x${view.comboMax ?? 0}`;
    if (el.phaseText) el.phaseText.textContent = view.phaseText || 'เตรียมพร้อม';

    if (el.goalFill) {
      const fill = clamp(Number(view.coveragePercent ?? 0), 0, 100);
      el.goalFill.style.width = `${fill}%`;
    }

    if (el.zonesDoneText) {
      el.zonesDoneText.textContent = `${view.zonesDone ?? 0} / ${view.zonesTotal ?? 0}`;
    }

    if (el.activeZoneText) {
      el.activeZoneText.textContent = view.activeZoneLabel || 'ยังไม่ได้เลือก';
    }

    if (el.speedText) {
      el.speedText.textContent = view.speedLabel || 'ปกติ';
    }

    if (el.warnText) {
      el.warnText.textContent = `${view.warnings ?? 0}`;
    }

    if (el.goalMiniText) {
      el.goalMiniText.textContent = view.goalText || '';
    }

    if (el.miniMissionText) {
      el.miniMissionText.textContent = view.miniMissionText || '';
    }
  }

  function renderZones(zones = [], activeZoneId = '') {
    zones.forEach(zone => {
      const label = document.querySelector(`[data-clean-label="${zone.id}"]`);
      if (label) {
        label.textContent = `${Math.round(zone.clean || 0)}%`;
      }

      const btn = document.querySelector(`.tooth-zone[data-zone="${zone.id}"]`);
      if (!btn) return;

      btn.classList.toggle('active', zone.id === activeZoneId);
      btn.classList.toggle('done', !!zone.done);

      if (zone.done) {
        btn.style.opacity = '1';
      } else {
        btn.style.opacity = '';
      }
    });
  }

  function renderPattern(view = {}) {
    if (el.patternBadge) {
      el.patternBadge.textContent = view.label || 'เลือกโซนก่อน';
    }

    if (el.patternHint) {
      el.patternHint.textContent = view.hint || 'เลือกโซนก่อน แล้วถูตามลายที่บอก';
    }

    if (el.patternProgressFill) {
      const fill = clamp(Number(view.progressPercent ?? 0), 0, 100);
      el.patternProgressFill.style.width = `${fill}%`;
    }

    if (el.patternProgressText) {
      el.patternProgressText.textContent =
        view.progressText || '0 / 2 รอบ';
    }
  }

  function moveBrushCursor(e, brushPad, brushCursor) {
    if (!brushPad || !brushCursor) return;

    const rect = brushPad.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);

    brushCursor.style.left = `${x}px`;
    brushCursor.style.top = `${y}px`;
  }

  function openHelp(open) {
    if (!el.helpModal) return;
    el.helpModal.classList.toggle('hidden', !open);
  }

  function openSummary(result) {
    if (!el.summaryModal) return;

    if (el.summaryTitle) {
      el.summaryTitle.textContent = result.summaryTitle || 'สรุปผล';
    }
    if (el.summaryRank) {
      el.summaryRank.textContent = result.finalRank || '-';
    }
    if (el.summaryTime) {
      el.summaryTime.textContent = result.timeText || '00:00';
    }
    if (el.summaryCoverage) {
      el.summaryCoverage.textContent = `${result.coveragePercent ?? 0}%`;
    }
    if (el.summaryZones) {
      el.summaryZones.textContent = `${result.zonesDone ?? 0} / ${result.zonesTotal ?? 0}`;
    }
    if (el.summaryWarn) {
      el.summaryWarn.textContent = `${result.warnings ?? 0}`;
    }
    if (el.summaryAdvice) {
      el.summaryAdvice.textContent = result.advice || '';
    }

    el.summaryModal.classList.remove('hidden');
  }

  function closeSummary() {
    if (!el.summaryModal) return;
    el.summaryModal.classList.add('hidden');
  }

  return {
    setCoach,
    renderHud,
    renderZones,
    renderPattern,
    moveBrushCursor,
    openHelp,
    openSummary,
    closeSummary
  };
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}