// === /herohealth/vr/quest-hud-vr.js ===
// HUD กลางสำหรับโหมด Hero Health (GoodJunk, Hydration ฯลฯ)

'use strict';

function formatTime(sec) {
  sec = sec | 0;
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function createHud() {
  if (document.getElementById('hhaQuestHud')) return null;

  const wrap = document.createElement('div');
  wrap.id = 'hhaQuestHud';
  wrap.style.position = 'fixed';
  wrap.style.top = '16px';
  wrap.style.right = '16px';
  wrap.style.zIndex = '50';
  wrap.style.minWidth = '240px';
  wrap.style.maxWidth = '280px';
  wrap.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  wrap.style.fontSize = '13px';
  wrap.style.color = '#e5e7eb';

  // กล่องหลัก
  const card = document.createElement('div');
  card.style.background = 'rgba(15,23,42,0.92)';
  card.style.borderRadius = '16px';
  card.style.padding = '10px 12px';
  card.style.boxShadow = '0 12px 30px rgba(0,0,0,0.45)';
  card.style.border = '1px solid rgba(148,163,184,0.4)';
  card.style.backdropFilter = 'blur(12px)';

  // header: mode + diff
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '6px';

  const modeEl = document.createElement('div');
  modeEl.id = 'hhaHudMode';
  modeEl.textContent = 'Hero Health';
  modeEl.style.fontSize = '12px';
  modeEl.style.letterSpacing = '0.06em';
  modeEl.style.textTransform = 'uppercase';
  modeEl.style.opacity = '0.9';

  const diffEl = document.createElement('div');
  diffEl.id = 'hhaHudDiff';
  diffEl.textContent = '';
  diffEl.style.fontSize = '11px';
  diffEl.style.padding = '2px 8px';
  diffEl.style.borderRadius = '999px';
  diffEl.style.border = '1px solid rgba(56,189,248,0.75)';
  diffEl.style.color = '#a5f3fc';
  diffEl.style.background = 'rgba(15,23,42,0.9)';

  header.appendChild(modeEl);
  header.appendChild(diffEl);

  // แถวคะแนน
  const rowScore = document.createElement('div');
  rowScore.style.display = 'flex';
  rowScore.style.justifyContent = 'space-between';
  rowScore.style.marginBottom = '4px';

  const scoreEl = document.createElement('div');
  scoreEl.id = 'hhaHudScore';
  scoreEl.textContent = 'Score 0';
  scoreEl.style.fontWeight = '600';

  const comboEl = document.createElement('div');
  comboEl.id = 'hhaHudCombo';
  comboEl.textContent = 'Combo 0';
  comboEl.style.opacity = '0.9';

  rowScore.appendChild(scoreEl);
  rowScore.appendChild(comboEl);

  // แถวเวลา / miss
  const rowTime = document.createElement('div');
  rowTime.style.display = 'flex';
  rowTime.style.justifyContent = 'space-between';
  rowTime.style.marginBottom = '6px';

  const timeEl = document.createElement('div');
  timeEl.id = 'hhaHudTime';
  timeEl.textContent = 'Time 0:00';
  timeEl.style.opacity = '0.9';

  const missEl = document.createElement('div');
  missEl.id = 'hhaHudMiss';
  missEl.textContent = 'Miss 0';
  missEl.style.opacity = '0.9';

  rowTime.appendChild(timeEl);
  rowTime.appendChild(missEl);

  // กล่อง goal / mini
  const goalsWrap = document.createElement('div');
  goalsWrap.style.display = 'flex';
  goalsWrap.style.flexDirection = 'column';
  goalsWrap.style.gap = '4px';

  const goalBox = document.createElement('div');
  goalBox.id = 'hhaHudGoal';
  goalBox.style.fontSize = '12px';
  goalBox.style.padding = '6px 8px';
  goalBox.style.borderRadius = '10px';
  goalBox.style.background = 'rgba(22,163,74,0.16)';
  goalBox.style.border = '1px solid rgba(34,197,94,0.7)';
  goalBox.textContent = 'Goal: -';

  const miniBox = document.createElement('div');
  miniBox.id = 'hhaHudMini';
  miniBox.style.fontSize = '12px';
  miniBox.style.padding = '6px 8px';
  miniBox.style.borderRadius = '10px';
  miniBox.style.background = 'rgba(59,130,246,0.16)';
  miniBox.style.border = '1px solid rgba(59,130,246,0.7)';
  miniBox.textContent = 'Mini quest: -';

  goalsWrap.appendChild(goalBox);
  goalsWrap.appendChild(miniBox);

  card.appendChild(header);
  card.appendChild(rowScore);
  card.appendChild(rowTime);
  card.appendChild(goalsWrap);

  wrap.appendChild(card);
  document.body.appendChild(wrap);

  // แถบสรุปเมื่อจบเกม
  const summary = document.createElement('div');
  summary.id = 'hhaHudSummary';
  summary.style.position = 'fixed';
  summary.style.left = '50%';
  summary.style.bottom = '32px';
  summary.style.transform = 'translateX(-50%)';
  summary.style.padding = '10px 16px';
  summary.style.borderRadius = '16px';
  summary.style.background = 'rgba(15,23,42,0.96)';
  summary.style.border = '1px solid rgba(250,250,250,0.25)';
  summary.style.color = '#e5e7eb';
  summary.style.fontSize = '13px';
  summary.style.boxShadow = '0 14px 40px rgba(0,0,0,0.55)';
  summary.style.maxWidth = '420px';
  summary.style.textAlign = 'center';
  summary.style.display = 'none';
  summary.style.zIndex = '60';

  document.body.appendChild(summary);

  return {
    modeEl,
    diffEl,
    scoreEl,
    comboEl,
    timeEl,
    missEl,
    goalBox,
    miniBox,
    summary
  };
}

(function init() {
  let hud;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { hud = createHud(); });
  } else {
    hud = createHud();
  }

  const state = {
    mode: '',
    diff: '',
    score: 0,
    combo: 0,
    misses: 0,
    timeSec: 0
  };

  function ensureHud() {
    if (!hud) {
      hud = createHud();
    }
    return hud;
  }

  // hha:score → อัปเดตคะแนน/คอมโบ/มิส
  window.addEventListener('hha:score', ev => {
    const d = ev.detail || {};
    const h = ensureHud();
    state.mode   = d.mode   || d.modeLabel || state.mode || 'Hero Health';
    state.diff   = d.difficulty || state.diff || '';
    state.score  = d.score  ?? state.score;
    state.combo  = d.combo  ?? state.combo;
    state.misses = d.misses ?? state.misses;
    if (typeof d.waterZone === 'string') {
      // แสดงโซนน้ำต่อท้าย diff ถ้าเป็น Hydration
      state.zone = d.waterZone;
    }

    h.modeEl.textContent = state.mode;
    h.diffEl.textContent = state.diff
      ? state.zone ? `${state.diff.toUpperCase()} · ${state.zone}` : state.diff.toUpperCase()
      : '';
    h.scoreEl.textContent = `Score ${state.score}`;
    h.comboEl.textContent = `Combo ${state.combo}`;
    h.missEl.textContent  = `Miss ${state.misses}`;
  });

  // hha:time → อัปเดตเวลา
  window.addEventListener('hha:time', ev => {
    const d = ev.detail || {};
    const h = ensureHud();
    if (typeof d.sec === 'number') {
      state.timeSec = d.sec;
    }
    h.timeEl.textContent = `Time ${formatTime(state.timeSec)}`;
  });

  // quest:update → แสดง Goal / Mini quest
  window.addEventListener('quest:update', ev => {
    const d = ev.detail || {};
    const h = ensureHud();

    if (d.mode || d.modeKey) {
      state.mode = d.mode || state.mode;
      h.modeEl.textContent = state.mode;
    }

    const goal = d.goal || null;
    const mini = d.mini || null;

    if (goal) {
      const done = goal.done ? '✓ ' : '';
      h.goalBox.textContent = `Goal: ${done}${goal.label || goal.id || '-'}`;
    } else {
      h.goalBox.textContent = 'Goal: -';
    }

    if (mini) {
      const done = mini.done ? '✓ ' : '';
      h.miniBox.textContent = `Mini quest: ${done}${mini.label || mini.id || '-'}`;
    } else {
      h.miniBox.textContent = 'Mini quest: -';
    }
  });

  // hha:end → สรุปสั้น ๆ ตอนจบเกม
  window.addEventListener('hha:end', ev => {
    const d = ev.detail || {};
    const h = ensureHud();

    const modeLabel = d.modeLabel || d.mode || state.mode || 'Hero Health';
    const diff = d.difficulty ? d.difficulty.toUpperCase() : (state.diff || '').toUpperCase();
    const score = d.score ?? state.score;
    const miss  = d.misses ?? state.misses;
    const dur   = d.duration ?? state.timeSec;

    let extra = '';
    if (typeof d.goalsCleared === 'number' && typeof d.goalsTotal === 'number') {
      extra += `Goals ${d.goalsCleared}/${d.goalsTotal}  ·  `;
    }
    if (typeof d.questsCleared === 'number' && typeof d.questsTotal === 'number') {
      extra += `Mini ${d.questsCleared}/${d.questsTotal}  ·  `;
    }
    if (typeof d.greenTick === 'number') {
      extra += `GREEN ${d.greenTick}s`;
    }

    h.summary.textContent =
      `${modeLabel} (${diff}) — Score ${score} · Miss ${miss} · Time ${formatTime(dur)}${extra ? ' · ' + extra : ''}`;
    h.summary.style.display = 'block';

    // ซ่อนหลัง 6 วินาที
    window.setTimeout(() => {
      h.summary.style.display = 'none';
    }, 6000);
  });
})();
