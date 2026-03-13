// === /herohealth/vr-goodjunk/goodjunk.summary.js ===
// GoodJunk Solo Master Pack
// FULL PATCH v20260313c-GJ-SUMMARY-SOLO-MASTER

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

export function getCooldownDone(cat, gameKey, pid) {
  const day = dayKey();
  const p = String(pid || 'anon').trim() || 'anon';
  const c = String(cat || 'nutrition').toLowerCase();
  const g = String(gameKey || 'unknown').toLowerCase();
  const kNew = `HHA_COOLDOWN_DONE:${c}:${g}:${p}:${day}`;
  const kOld = `HHA_COOLDOWN_DONE:${c}:${p}:${day}`;
  return (lsGet(kNew) === '1') || (lsGet(kOld) === '1');
}

export function buildCooldownUrl({
  currentUrl,
  hub,
  nextAfterCooldown,
  cat,
  gameKey,
  pid
}) {
  const here = new URL(currentUrl || location.href);
  const gate = new URL('../warmup-gate.html', here);
  const sp = here.searchParams;

  const zone = String(sp.get('zone') || cat || 'nutrition');
  const run = String(
    sp.get('run') ||
    (sp.get('mode') === 'solo' ? 'play' : (sp.get('mode') || 'play'))
  );

  gate.searchParams.set('phase', 'cooldown');
  gate.searchParams.set('game', String(gameKey || 'unknown'));
  gate.searchParams.set('zone', zone);
  gate.searchParams.set('cat', String(cat || zone || 'nutrition'));
  gate.searchParams.set('pid', String(pid || 'anon'));
  gate.searchParams.set('run', run);

  if (hub) gate.searchParams.set('hub', String(hub));
  gate.searchParams.set('next', String(nextAfterCooldown || hub || '../hub.html'));

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

  gate.searchParams.set('phase', 'cooldown');
  gate.searchParams.set('game', String(gameKey || 'unknown'));

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

  return {
    title: summarizeOutcomeTitle(detail),
    subtitle: summarizeOutcomeSubtitle(detail, ai),
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
      canCooldown: true,
      canBackHub: true
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
  if (getCooldownDone(cat, gameKey, pid)) return null;

  const here = new URL(currentUrl, location.href);
  const cdnext = here.searchParams.get('cdnext') || '';
  const nextAfterCooldown = cdnext || hub || '../hub.html';
  const url = buildCooldownUrl({
    currentUrl,
    hub,
    nextAfterCooldown,
    cat,
    gameKey,
    pid
  });

  const row =
    endActionsEl ||
    endOverlayEl.querySelector('.end-actions') ||
    endOverlayEl.querySelector('.panel') ||
    endOverlayEl;

  if (!row) return null;
  const existing = row.querySelector('[data-gj-cd="1"]');
  if (existing) return existing;

  const btn = documentRef.createElement('button');
  btn.type = 'button';
  btn.dataset.gjCd = '1';
  btn.textContent = '🧘 ไป Cooldown';
  btn.className = 'btn good';
  btn.addEventListener('click', () => {
    location.href = url;
  });

  const backHubBtn = row.querySelector('#btnEndBackHub');
  if (backHubBtn && backHubBtn.parentNode === row) {
    row.insertBefore(btn, backHubBtn);
  } else {
    row.appendChild(btn);
  }

  return btn;
}
