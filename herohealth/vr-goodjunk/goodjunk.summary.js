// === /herohealth/vr-goodjunk/goodjunk.summary.js ===
// GoodJunk Solo Master Pack
// FULL PATCH v20260314k-GJ-SUMMARY-FLOW-STATUS

'use strict';

function clamp(v, a, b) {
  v = Number(v);
  if (!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function safeJsonParse(raw, fallback = null) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function safeUrl(raw, base = location.href, fallback = '') {
  try {
    if (!raw) return fallback;
    return new URL(raw, base).toString();
  } catch {
    return fallback;
  }
}

export function getCooldownDone(cat, gameKey, pid) {
  const day = dayKey();
  const p = String(pid || 'anon').trim() || 'anon';
  const c = String(cat || 'nutrition').toLowerCase();
  const g = String(gameKey || 'unknown').toLowerCase();
  const kNew = `HHA_COOLDOWN_DONE:${c}:${g}:${p}:${day}`;
  const kOld = `HHA_COOLDOWN_DONE:${c}:${p}:${day}`;
  return (lsGet(kNew) === '1') || (lsGet(kOld) === '1');
}

export function getWarmupDone(cat, gameKey, pid) {
  const day = dayKey();
  const p = String(pid || 'anon').trim() || 'anon';
  const c = String(cat || 'nutrition').toLowerCase();
  const g = String(gameKey || 'unknown').toLowerCase();
  const k = `HHA_WARMUP_DONE:${c}:${g}:${p}:${day}`;
  return lsGet(k) === '1';
}

export function getFlowDone(cat, gameKey, pid) {
  return getWarmupDone(cat, gameKey, pid) && getCooldownDone(cat, gameKey, pid);
}

export function getCooldownUiState(cat, gameKey, pid) {
  const done = getCooldownDone(cat, gameKey, pid);
  return {
    done,
    backHubLabel: done ? 'กลับ HUB ได้เลย' : 'กลับ HUB (ข้าม Cooldown)',
    cooldownLabel: done ? 'Cooldown วันนี้เสร็จแล้ว ✅' : '🧘 ไป Cooldown'
  };
}

export function getFlowUiState(cat, gameKey, pid) {
  const warmDone = getWarmupDone(cat, gameKey, pid);
  const cooldownDone = getCooldownDone(cat, gameKey, pid);
  const flowDone = warmDone && cooldownDone;

  return {
    warmDone,
    cooldownDone,
    flowDone,
    flowLabel: flowDone ? 'ครบ flow วันนี้แล้ว ✅' : 'ยังไม่ครบ flow วันนี้ ✨'
  };
}

export function buildCooldownUrl({
  currentUrl,
  hub,
  nextAfterCooldown,
  cat,
  gameKey,
  pid
}) {
  const here = new URL(currentUrl || location.href, location.href);
  const gate = new URL('../warmup-gate.html', here);
  const sp = here.searchParams;

  const zone = String(sp.get('zone') || cat || 'nutrition').toLowerCase();
  const run = String(
    sp.get('run') ||
    (sp.get('mode') === 'solo' ? 'play' : (sp.get('mode') || 'play'))
  );

  const resolvedHub = safeUrl(
    hub || sp.get('hub') || '../hub.html',
    here,
    new URL('../hub.html', here).toString()
  );

  const resolvedNext = safeUrl(
    nextAfterCooldown || resolvedHub,
    here,
    resolvedHub
  );

  gate.searchParams.set('phase', 'cooldown');
  gate.searchParams.set('gatePhase', 'cooldown');
  gate.searchParams.set('mode', 'cooldown');

  gate.searchParams.set('game', String(gameKey || 'unknown').toLowerCase());
  gate.searchParams.set('zone', zone);
  gate.searchParams.set('cat', String(cat || zone || 'nutrition').toLowerCase());
  gate.searchParams.set('pid', String(pid || 'anon'));
  gate.searchParams.set('run', run);

  gate.searchParams.set('hub', resolvedHub);
  gate.searchParams.set('next', resolvedNext);

  [
    'diff','time','seed','studyId','conditionGroup','view','log',
    'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
    'plannedGame','finalGame','cdnext','grade',
    'battle','room','autostart','forfeit',
    'ai','pro','wait','bestOf','waitTimeout'
  ].forEach(k => {
    const v = sp.get(k);
    if (v != null && v !== '') gate.searchParams.set(k, v);
  });

  return gate.toString();
}

export function gradeFromPerformance({
  score = 0,
  scoreTarget = 650,
  accPct = 0,
  missTotal = 0
} = {}) {
  if (score >= scoreTarget && accPct >= 80 && missTotal <= 2) return 'S';
  if (score >= scoreTarget && accPct >= 70 && missTotal <= 4) return 'A';
  if (score >= scoreTarget * 0.85) return 'B';
  if (score >= scoreTarget * 0.70) return 'C';
  return 'D';
}

export function starsFromPerformance({
  win = false,
  accPct = 0,
  missTotal = 0,
  bestCombo = 0
} = {}) {
  let stars = win ? 1 : 0;
  if (accPct >= 75) stars += 1;
  if (missTotal <= 2 || bestCombo >= 10) stars += 1;
  return clamp(stars, 1, 3);
}

export function summarizeBestMoment(detail = {}) {
  const combo = Number(detail.comboBest || 0);
  const score = Number(detail.scoreFinal || detail.score || 0);
  const phase = String(detail.stageFinal || detail.phaseFinal || '');

  if (combo >= 15) return `คอมโบเดือด ${combo} ช่วง${phase ? ' ' + phase : ''}`;
  if (detail.bossCleared) return 'ปิดบอสได้สำเร็จในช่วงท้าย';
  if (score >= Number(detail.scoreTarget || 650)) return 'ไล่แต้มถึงเป้าหมายได้สำเร็จ';
  if (combo >= 8) return `รักษาคอมโบได้ดี (${combo})`;
  return 'รักษาจังหวะเล่นได้ต่อเนื่อง';
}

export function summarizeWeakness(detail = {}) {
  const missJunk = Number(detail.missJunkHit || 0);
  const missExpire = Number(detail.missGoodExpired || 0);
  const accPct = Number(detail.accPct || 0);

  if (missJunk >= missExpire && missJunk >= 4) return 'ยังโดนของขยะบ่อยเกินไป';
  if (missExpire >= 4) return 'ยังปล่อยของดีหลุดบ่อยเกินไป';
  if (accPct < 60) return 'ความแม่นยำยังต่ำเกินไปในช่วงกดดัน';
  if (!detail.bossCleared && Number(detail.bossHpLeft || 0) > 0) return 'จบบอสยังไม่ทันก่อนหมดเวลา';
  return 'ช่วงท้ายยังรักษาโมเมนตัมได้ไม่พอ';
}

export function summarizeNextTip(detail = {}, ai = null) {
  const pred = ai?.pred || ai || {};
  const top = Array.isArray(pred.topFactors) ? pred.topFactors[0] : null;
  const missJunk = Number(detail.missJunkHit || 0);
  const missExpire = Number(detail.missGoodExpired || 0);

  if (top?.key === 'junk_confusion_10s') {
    return 'ลองรอครึ่งจังหวะก่อนยิงเมื่อเป้าหลอกเริ่มเยอะ';
  }
  if (top?.key === 'rt_median_10s') {
    return 'คุมจังหวะสายตาให้นิ่งก่อน แล้วค่อยกดยิง';
  }
  if (top?.key === 'expire_rate_10s') {
    return 'โฟกัสของดีชิ้นใกล้หมดเวลาก่อนเสมอ';
  }
  if (missJunk > missExpire) {
    return 'ลดการรีบยิง แล้วแยกของดี/ขยะให้ชัดขึ้น';
  }
  if (missExpire > missJunk) {
    return 'ขยับสายตาไปเป้าถัดไปให้เร็วขึ้นอีกนิด';
  }
  return 'รักษาคอมโบช่วง TRICK และอย่าพลาดจังหวะฟรีใน RELIEF';
}

export function summarizeOutcomeTitle(detail = {}) {
  if (detail.win) return 'ชนะแล้ว! 🎉';
  if (String(detail.reason || '').startsWith('battle-win')) return 'ชนะ Battle! ⚔️';
  if (String(detail.reason || '').startsWith('battle-lose')) return 'แพ้ Battle';
  if (detail.reason === 'miss-limit') return 'พลาดเกินกำหนด';
  if (detail.reason === 'time') return 'หมดเวลา';
  return 'จบเกม';
}

export function summarizeOutcomeSubtitle(detail = {}, ai = null) {
  const pred = ai?.pred || ai || {};
  const explain = String(pred.explainText || '').trim();

  const bits = [
    `score ${detail.scoreFinal ?? detail.score ?? 0}`,
    `acc ${detail.accPct ?? 0}%`,
    `miss ${detail.missTotal ?? 0}`
  ];

  if (explain) bits.push(explain);
  return bits.join(' • ');
}

export function buildEndSummary(detail = {}, ai = null) {
  const grade = detail.grade || gradeFromPerformance(detail);
  const stars = starsFromPerformance({
    win: !!detail.win,
    accPct: Number(detail.accPct || 0),
    missTotal: Number(detail.missTotal || 0),
    bestCombo: Number(detail.comboBest || 0)
  });

  const cat = String(detail.cat || 'nutrition');
  const gameKey = String(detail.gameKey || detail.game || 'goodjunk');
  const pid = String(detail.pid || 'anon');
  const flowUi = getFlowUiState(cat, gameKey, pid);

  let title = summarizeOutcomeTitle(detail);
  if (flowUi.flowDone) {
    title = 'ครบ flow วันนี้แล้ว ✅';
  }

  let subtitle = summarizeOutcomeSubtitle(detail, ai);
  if (!flowUi.flowDone && getWarmupDone(cat, gameKey, pid) && !getCooldownDone(cat, gameKey, pid)) {
    subtitle += ' • ยังเหลือ Cooldown วันนี้';
  }

  return {
    title,
    subtitle,
    outcome: detail.win ? 'win' : 'lose',
    grade,
    stars,
    bestMoment: summarizeBestMoment(detail),
    weakness: summarizeWeakness(detail),
    coachInsight: String(ai?.pred?.coach || ai?.coach || 'คุณกำลังพัฒนาได้ดีขึ้น'),
    nextTip: summarizeNextTip(detail, ai),
    scoreFinal: Number(detail.scoreFinal ?? detail.score ?? 0),
    scoreTarget: Number(detail.scoreTarget ?? 0),
    accPct: Number(detail.accPct ?? 0),
    missTotal: Number(detail.missTotal ?? 0),
    comboBest: Number(detail.comboBest ?? 0),
    stageFinal: String(detail.stageFinal || ''),
    bossCleared: !!detail.bossCleared,
    reason: String(detail.reason || ''),
    flow: {
      canReplay: true,
      canCooldown: !flowUi.cooldownDone,
      canBackHub: true,
      doneToday: flowUi.flowDone
    }
  };
}

export function saveLastSummary({
  gameKey = 'goodjunk',
  pid = 'anon',
  detail,
  summary
}) {
  const row = {
    savedAtIso: new Date().toISOString(),
    gameKey,
    pid,
    detail,
    summary
  };

  lsSet(`HHA_LAST_SUMMARY:${gameKey}:${pid}`, JSON.stringify(row));
  lsSet('HHA_LAST_SUMMARY', JSON.stringify(row));

  const historyKey = `HHA_SUMMARY_HISTORY:${gameKey}:${pid}`;
  const history = safeJsonParse(lsGet(historyKey), []);
  history.unshift(row);
  lsSet(historyKey, JSON.stringify(history.slice(0, 20)));

  return row;
}

export function applySummaryToOverlay({
  summary,
  detail,
  endTitleEl,
  endSubEl,
  endGradeEl,
  endScoreEl,
  endMissEl,
  endTimeEl,
  endDecisionEl,
  endTopEl,
  panelEl
}) {
  if (endTitleEl) endTitleEl.textContent = summary.title || 'จบเกม';
  if (endSubEl) endSubEl.textContent = summary.subtitle || '—';
  if (endGradeEl) endGradeEl.textContent = summary.grade || '-';
  if (endScoreEl) endScoreEl.textContent = String(summary.scoreFinal ?? 0);
  if (endMissEl) endMissEl.textContent = String(summary.missTotal ?? 0);
  if (endTimeEl) endTimeEl.textContent = String(detail.timePlayedSec ?? 0);

  if (endDecisionEl) {
    endDecisionEl.innerHTML = `
      <div style="font-size:15px;font-weight:1000;">⭐ ${summary.bestMoment}</div>
      <div style="margin-top:6px;">จุดที่ยังพัฒนาได้: ${summary.weakness}</div>
      <div style="margin-top:6px;">AI Coach: ${summary.coachInsight}</div>
      <div style="margin-top:6px;">คำแนะนำรอบหน้า: ${summary.nextTip}</div>
    `;
  }

  if (panelEl && !panelEl.querySelector('[data-gj-summary-box="1"]')) {
    const box = document.createElement('div');
    box.dataset.gjSummaryBox = '1';
    box.style.marginTop = '14px';
    box.style.borderRadius = '18px';
    box.style.border = '1px solid rgba(148,163,184,.14)';
    box.style.background = 'rgba(2,6,23,.54)';
    box.style.padding = '12px 14px';
    box.innerHTML = `
      <div style="font-size:14px;font-weight:1000;color:#a5f3fc;">Summary Insight</div>
      <div style="margin-top:8px;font-size:14px;line-height:1.7;">
        <div><strong>Best moment:</strong> ${summary.bestMoment}</div>
        <div><strong>Weakness:</strong> ${summary.weakness}</div>
        <div><strong>Next tip:</strong> ${summary.nextTip}</div>
      </div>
    `;
    panelEl.appendChild(box);
  }

  if (endTopEl && !endTopEl.querySelector('[data-gj-stars="1"]')) {
    const stars = document.createElement('div');
    stars.dataset.gjStars = '1';
    stars.style.marginTop = '8px';
    stars.style.fontSize = '20px';
    stars.style.fontWeight = '1000';
    stars.textContent = `ดาว ${'⭐'.repeat(Number(summary.stars || 1))}`;
    endTopEl.appendChild(stars);
  }

  const pid = String(detail?.pid || 'anon');
  const cat = String(detail?.cat || 'nutrition');
  const gameKey = String(detail?.gameKey || detail?.game || 'goodjunk');
  const cooldownDone = getCooldownDone(cat, gameKey, pid);

  if (panelEl && !panelEl.querySelector('[data-gj-cooldown-status="1"]')) {
    const badge = document.createElement('div');
    badge.dataset.gjCooldownStatus = '1';
    badge.style.marginTop = '12px';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '8px';
    badge.style.padding = '8px 12px';
    badge.style.borderRadius = '999px';
    badge.style.fontWeight = '1000';
    badge.style.fontSize = '13px';

    if (cooldownDone) {
      badge.style.border = '1px solid rgba(34,197,94,.28)';
      badge.style.background = 'rgba(34,197,94,.14)';
      badge.style.color = '#dcfce7';
      badge.textContent = 'Cooldown วันนี้เสร็จแล้ว ✅';
    } else {
      badge.style.border = '1px solid rgba(245,158,11,.28)';
      badge.style.background = 'rgba(245,158,11,.14)';
      badge.style.color = '#fde68a';
      badge.textContent = 'ยังไม่ได้ทำ Cooldown วันนี้ 🧘';
    }

    panelEl.appendChild(badge);
  }

  const flowUi = getFlowUiState(cat, gameKey, pid);

  if (panelEl && !panelEl.querySelector('[data-gj-flow-status="1"]')) {
    const flowBadge = document.createElement('div');
    flowBadge.dataset.gjFlowStatus = '1';
    flowBadge.style.marginTop = '10px';
    flowBadge.style.display = 'inline-flex';
    flowBadge.style.alignItems = 'center';
    flowBadge.style.gap = '8px';
    flowBadge.style.padding = '8px 12px';
    flowBadge.style.borderRadius = '999px';
    flowBadge.style.fontWeight = '1000';
    flowBadge.style.fontSize = '13px';

    if (flowUi.flowDone) {
      flowBadge.style.border = '1px solid rgba(34,197,94,.28)';
      flowBadge.style.background = 'rgba(34,197,94,.14)';
      flowBadge.style.color = '#dcfce7';
      flowBadge.textContent = 'ครบ flow วันนี้แล้ว ✅';
    } else {
      flowBadge.style.border = '1px solid rgba(59,130,246,.26)';
      flowBadge.style.background = 'rgba(59,130,246,.12)';
      flowBadge.style.color = '#bfdbfe';
      flowBadge.textContent = 'ยังไม่ครบ flow วันนี้ ✨';
    }

    panelEl.appendChild(flowBadge);
  }

  const ui = getCooldownUiState(cat, gameKey, pid);
  const backHubBtn = panelEl?.querySelector?.('#btnEndBackHub') || document.getElementById('btnEndBackHub');
  if (backHubBtn) {
    backHubBtn.textContent = ui.backHubLabel;
  }
}

export function injectCooldownButton({
  documentRef = document,
  endOverlayEl,
  endActionsEl,
  hub,
  cat = 'nutrition',
  gameKey = 'goodjunk',
  pid = 'anon',
  currentUrl = location.href
}) {
  if (!endOverlayEl) return null;

  const row =
    endActionsEl ||
    endOverlayEl.querySelector('.end-actions') ||
    endOverlayEl.querySelector('.panel') ||
    endOverlayEl;

  if (!row) return null;

  const backHubBtn = row.querySelector('#btnEndBackHub');
  const ui = getCooldownUiState(cat, gameKey, pid);

  if (backHubBtn) {
    backHubBtn.textContent = ui.backHubLabel;
  }

  const existingBtn = row.querySelector('[data-gj-cd="1"]');
  const existingDone = row.querySelector('[data-gj-cd-done="1"]');
  if (existingBtn || existingDone) return existingBtn || existingDone;

  const cooldownDone = ui.done;

  if (cooldownDone) {
    const badge = documentRef.createElement('div');
    badge.dataset.gjCdDone = '1';
    badge.textContent = 'Cooldown วันนี้เสร็จแล้ว ✅';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.minHeight = '42px';
    badge.style.padding = '10px 14px';
    badge.style.borderRadius = '14px';
    badge.style.border = '1px solid rgba(34,197,94,.28)';
    badge.style.background = 'rgba(34,197,94,.14)';
    badge.style.color = '#dcfce7';
    badge.style.fontWeight = '1000';

    if (backHubBtn && backHubBtn.parentNode === row) {
      row.insertBefore(badge, backHubBtn);
    } else {
      row.appendChild(badge);
    }

    try {
      window.dispatchEvent(new CustomEvent('hha:toast', {
        detail: { message: 'วันนี้ทำ Cooldown แล้ว กลับ HUB ได้เลย' }
      }));
    } catch {}

    return badge;
  }

  const here = new URL(currentUrl, location.href);
  const cdnext = here.searchParams.get('cdnext') || '';
  const resolvedHub = safeUrl(hub || '../hub.html', here, new URL('../hub.html', here).toString());
  const nextAfterCooldown = safeUrl(cdnext || resolvedHub, here, resolvedHub);

  const url = buildCooldownUrl({
    currentUrl,
    hub: resolvedHub,
    nextAfterCooldown,
    cat,
    gameKey,
    pid
  });

  const btn = documentRef.createElement('button');
  btn.type = 'button';
  btn.dataset.gjCd = '1';
  btn.textContent = '🧘 ไป Cooldown';
  btn.className = 'btn good';
  btn.addEventListener('click', () => {
    location.href = url;
  });

  if (backHubBtn && backHubBtn.parentNode === row) {
    row.insertBefore(btn, backHubBtn);
  } else {
    row.appendChild(btn);
  }

  try {
    window.dispatchEvent(new CustomEvent('hha:toast', {
      detail: { message: 'ยังไม่ได้ทำ Cooldown วันนี้' }
    }));
  } catch {}

  return btn;
}