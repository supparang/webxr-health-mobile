// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — v4.2 + GatePatch v20260210 (FIXED FULL FILE)
// ✅ End Summary overlay (see before leaving)
// ✅ Daily Warmup mark (if wType/wPct present)
// ✅ Daily Cooldown (per PID) by CATEGORY (nutrition): first time/day -> cooldown gate
// ✅ Cooldown routing uses cdGateUrl/cdur but overrides to per-category keys
//
// FIXED:
// - pickByShootAt(): dx*dx + dy*dy (no dxdx/dydy crash)
// - template strings corrected everywhere (`${}`)
// - adaptive formula fixed ((played-8)*5, played*0.002)
// - coach msg / mini msg fixed (strings)
// - aria-label fixed
// - progress/fever widths fixed
'use strict';

import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';
import { awardBadge, getPid } from '../badges.safe.js';

const WIN = window;
const DOC = document;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const qs = (k, d = null) => { try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };
const emit = (n, d) => { try { WIN.dispatchEvent(new CustomEvent(n, { detail: d })); } catch { } };

function makeRNG(seed) {
  let x = (Number(seed) || Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => (x = x * 16807 % 2147483647) / 2147483647;
}

/** BADGES helper */
function badgeMeta(extra) {
  let pid = '';
  try { pid = (typeof getPid === 'function') ? (getPid() || '') : ''; } catch { }
  let q;
  try { q = new URL(location.href).searchParams; } catch { q = new URLSearchParams(); }

  const base = {
    pid,
    run: String(q.get('run') || '').toLowerCase() || 'play',
    diff: String(q.get('diff') || '').toLowerCase() || 'normal',
    time: Number(q.get('time') || 0) || 0,
    seed: Number(q.get('seed') || 0) || 0,
    view: String(q.get('view') || '').toLowerCase() || '',
    style: String(q.get('style') || '').toLowerCase() || '',
    game: 'goodjunk'
  };
  if (extra && typeof extra === 'object') {
    for (const k of Object.keys(extra)) base[k] = extra[k];
  }
  return base;
}

function awardOnce(gameKey, badgeId, meta) {
  try { return !!awardBadge(gameKey, badgeId, badgeMeta(meta)); }
  catch { return false; }
}

/** อ่าน safe vars แล้วคืนค่าเป็น number px */
function cssPx(varName, fallback) {
  try {
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(varName);
    const n = parseFloat(String(v || '').trim());
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

/** ✅ Safe rect relative to a specific layer element */
function getSafeRectForLayer(layerEl) {
  const r = layerEl.getBoundingClientRect();
  const topSafe = cssPx('--gj-top-safe', 90);
  const botSafe = cssPx('--gj-bottom-safe', 95);

  const padX = 14;

  const x = padX;
  const y = Math.max(8, topSafe);
  const w = Math.max(140, r.width - padX * 2);
  const h = Math.max(190, r.height - y - botSafe);

  return { x, y, w, h, rect: r };
}

/** ยิงจากจุด (x,y) viewport แล้ว pick target ที่ใกล้สุดใน lockPx */
function pickByShootAt(x, y, lockPx = 28) {
  const els = Array.from(DOC.querySelectorAll('.gj-target'));
  let best = null;

  for (const el of els) {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;

    const inside =
      (x >= b.left - lockPx && x <= b.right + lockPx) &&
      (y >= b.top - lockPx && y <= b.bottom + lockPx);

    if (!inside) continue;

    const ex = (b.left + b.right) / 2;
    const ey = (b.top + b.bottom) / 2;
    const dx = (ex - x);
    const dy = (ey - y);
    const d2 = dx * dx + dy * dy;

    if (!best || d2 < best.d2) best = { el, d2 };
  }
  return best ? best.el : null;
}

// --- Target decoration ---
function chooseGroupId(rng) {
  return 1 + Math.floor((typeof rng === 'function' ? rng() : Math.random()) * 5);
}

function decorateTarget(el, t) {
  if (!el || !t) return;

  if (t.kind === 'good') {
    const gid = t.groupId || 1;
    const emo = emojiForGroup(t.rng, gid);
    el.textContent = emo;
    el.dataset.group = String(gid);
    el.setAttribute('aria-label', `${labelForGroup(gid)} ${emo}`);
  } else if (t.kind === 'junk') {
    const emo = pickEmoji(t.rng, JUNK.emojis);
    el.textContent = emo;
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', `${JUNK.labelTH} ${emo}`);
  }
}

// --- Quests ---
function makeGoals() {
  return [
    { key: 'clean', name: 'แยกของดี/ของเสีย', desc: 'เก็บของดีให้เยอะ และอย่าโดนของเสีย', targetGood: 18, maxMiss: 6 },
    { key: 'combo', name: 'คอมโบของดี', desc: 'ทำคอมโบของดีให้ถึง 8', targetCombo: 8 },
    { key: 'survive', name: 'ช่วงบอส', desc: 'ช่วงท้ายอย่าให้พลาด (MISS ไม่เกิน 3)', maxMiss: 3 }
  ];
}

// ✅ AI safe wrapper
function makeAI(opts) {
  let ai = null;
  try {
    if (WIN.HHA && WIN.HHA.AIHooks && typeof WIN.HHA.AIHooks.create === 'function') {
      ai = WIN.HHA.AIHooks.create(opts || {});
    } else if (WIN.HHA && typeof WIN.HHA.createAIHooks === 'function') {
      ai = WIN.HHA.createAIHooks(opts || {});
    }
  } catch { ai = null; }

  ai = ai || {};
  if (typeof ai.onEvent !== 'function') ai.onEvent = () => { };
  if (typeof ai.getTip !== 'function') ai.getTip = () => null;
  if (typeof ai.getDifficulty !== 'function') ai.getDifficulty = (_sec, base) => Object.assign({}, base || {});
  if (typeof ai.enabled !== 'boolean') ai.enabled = false;
  return ai;
}

// -----------------------------
// Daily helpers (PID + category)
// -----------------------------
function getLocalDayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dailyKey(prefix, category, pid) {
  const day = getLocalDayKey();
  const p = (pid || 'anon').trim() || 'anon';
  return `${prefix}:${category}:${p}:${day}`;
}
function markDaily(prefix, category, pid) {
  try { localStorage.setItem(dailyKey(prefix, category, pid), '1'); } catch { }
}
function isDaily(prefix, category, pid) {
  try { return localStorage.getItem(dailyKey(prefix, category, pid)) === '1'; } catch { return false; }
}

function hasWarmupBuffInQS() {
  return !!(
    qs('wType', '') || qs('wPct', '') || qs('rank', '') ||
    qs('wCrit', '') || qs('wDmg', '') || qs('wHeal', '') || qs('calm', '')
  );
}

// -----------------------------
// Summary Overlay + routing
// -----------------------------
function ensureSummaryOverlay() {
  let ov = DOC.getElementById('gjEndOverlay');
  if (ov) return ov;

  ov = DOC.createElement('div');
  ov.id = 'gjEndOverlay';
  ov.style.position = 'fixed';
  ov.style.inset = '0';
  ov.style.zIndex = '9999';
  ov.style.display = 'none';
  ov.style.alignItems = 'center';
  ov.style.justifyContent = 'center';
  ov.style.padding = '24px';
  ov.style.background = 'rgba(2,6,23,.72)';
  ov.style.backdropFilter = 'blur(6px)';

  const card = DOC.createElement('div');
  card.style.width = 'min(720px, 92vw)';
  card.style.border = '1px solid rgba(148,163,184,.18)';
  card.style.borderRadius = '22px';
  card.style.background = 'linear-gradient(180deg, rgba(2,6,23,.92), rgba(2,6,23,.70))';
  card.style.boxShadow = '0 18px 60px rgba(0,0,0,.45)';
  card.style.padding = '16px';

  card.innerHTML = `
<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
  <div style="font-weight:1000; letter-spacing:.2px;">สรุปผล GoodJunkVR</div>
  <div id="gjEndGrade" style="margin-left:auto; font-weight:1000; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.18); background:rgba(2,6,23,.45);">—</div>
</div>
<div id="gjEndMsg" style="margin-top:8px; color:rgba(229,231,235,.82); font-weight:850; font-size:12px; line-height:1.35;">—</div>

<div style="margin-top:12px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;">
  <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
    <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">SCORE</div>
    <div id="gjEndScore" style="font-size:18px; font-weight:1000; margin-top:2px;">0</div>
  </div>
  <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
    <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">MISS</div>
    <div id="gjEndMiss" style="font-size:18px; font-weight:1000; margin-top:2px;">0</div>
  </div>
  <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
    <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">COMBO MAX</div>
    <div id="gjEndCombo" style="font-size:18px; font-weight:1000; margin-top:2px;">0</div>
  </div>
  <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
    <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">BOSS</div>
    <div id="gjEndBoss" style="font-size:18px; font-weight:1000; margin-top:2px;">—</div>
  </div>
</div>

<div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
  <button id="gjEndToHub" style="font-weight:1000; padding:10px 14px; border-radius:14px; border:1px solid rgba(148,163,184,.18); background:rgba(2,6,23,.35); color:#e5e7eb;">กลับ HUB</button>
  <button id="gjEndNext" style="font-weight:1000; padding:10px 14px; border-radius:14px; border:1px solid rgba(34,197,94,.35); background:rgba(34,197,94,.18); color:#e5e7eb;">ต่อไป</button>
</div>
`;

  ov.appendChild(card);
  DOC.body.appendChild(ov);
  return ov;
}

function showSummaryOverlay(summary, ctx, onNext) {
  const ov = ensureSummaryOverlay();
  const $ = (id) => DOC.getElementById(id);

  try {
    const grade = summary.grade || '—';
    if ($('gjEndGrade')) $('gjEndGrade').textContent = `GRADE: ${grade}`;
    if ($('gjEndScore')) $('gjEndScore').textContent = String(summary.scoreFinal ?? 0);
    if ($('gjEndMiss')) $('gjEndMiss').textContent = String(summary.miss ?? 0);
    if ($('gjEndCombo')) $('gjEndCombo').textContent = String(summary.comboMax ?? 0);
    if ($('gjEndBoss')) $('gjEndBoss').textContent = summary.bossCleared ? 'CLEAR ✅' : '—';

    const msg =
      (Number(summary.miss) <= 3 && Number(summary.scoreFinal) >= 150) ? 'สุดยอด! ความแม่นยำดีมาก 👍' :
      (Number(summary.miss) <= 6) ? 'ดีมาก! รอบหน้าลองลด MISS ลงอีกนิดนะ ✨' :
      'รอบหน้าลองเน้น “ของดี” ให้มากขึ้น และระวังของเสีย 👀';
    if ($('gjEndMsg')) $('gjEndMsg').textContent = msg;

    const btnHub = $('gjEndToHub');
    const btnNext = $('gjEndNext');

    if (btnHub) {
      const n = btnHub.cloneNode(true);
      btnHub.parentNode.replaceChild(n, btnHub);
      n.addEventListener('click', () => {
        location.href = ctx.hub || '../hub.html';
      });
    }
    if (btnNext) {
      const n = btnNext.cloneNode(true);
      btnNext.parentNode.replaceChild(n, btnNext);
      n.addEventListener('click', () => {
        try { ov.style.display = 'none'; } catch { }
        if (typeof onNext === 'function') onNext();
      });
    }
  } catch { }

  ov.style.display = 'flex';
}

// -----------------------------
// MAIN GAME
// -----------------------------
export function boot(opts = {}) {
  const view = String(opts.view || qs('view', 'mobile')).toLowerCase();
  const run = String(opts.run || qs('run', 'play')).toLowerCase();
  const diff = String(opts.diff || qs('diff', 'normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time', '80')) || 80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  const category = 'nutrition';

  let pid = String(opts.pid || qs('pid', '') || '').trim();
  if (!pid) {
    try { pid = String(getPid?.() || '').trim(); } catch { }
  }
  if (!pid) pid = 'anon';

  if (hasWarmupBuffInQS()) {
    markDaily('HHA_WARMUP_DONE', category, pid);
  }

  const hub = String(opts.hub || qs('hub', '../hub.html') || '../hub.html');

  const elScore = DOC.getElementById('hud-score');
  const elTime = DOC.getElementById('hud-time');
  const elMiss = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');

  const elGoalName = DOC.getElementById('hud-goal');
  const elGoalDesc = DOC.getElementById('goalDesc');
  const elGoalCur = DOC.getElementById('hud-goal-cur');
  const elGoalTarget = DOC.getElementById('hud-goal-target');

  const elMiniText = DOC.getElementById('hud-mini');
  const elMiniTimer = DOC.getElementById('miniTimer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield = DOC.getElementById('shieldPills');

  const elLowOverlay = DOC.getElementById('lowTimeOverlay');
  const elLowNum = DOC.getElementById('gj-lowtime-num');

  const elProgFill = DOC.getElementById('gjProgressFill');

  const elBossBar = DOC.getElementById('bossBar');
  const elBossFill = DOC.getElementById('bossFill');
  const elBossHint = DOC.getElementById('bossHint');

  const layerL = opts.layerL || DOC.getElementById('gj-layer');
  const layerR = opts.layerR || DOC.getElementById('gj-layer-r');

  const rng = makeRNG(seed);

  const Pair = new Map();
  let uidSeq = 1;

  const S = {
    started: false, ended: false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score: 0, miss: 0,
    hitGood: 0, hitJunk: 0, expireGood: 0,
    combo: 0, comboMax: 0,

    shield: 0,
    fever: 18,

    lastTick: 0,
    lastSpawn: 0,

    goals: makeGoals(),
    goalIndex: 0,

    mini: { windowSec: 12, windowStartAt: 0, groups: new Set(), done: false },

    boss: {
      active: false,
      startedAtSec: null,
      durationSec: 10,
      hp: 100,
      hpMax: 100,
      cleared: false
    },

    badge_streak10: false,
    badge_mini: false,
    badge_boss: false
  };

  const adaptiveOn = (run === 'play');
  const aiOn = (run === 'play');

  const AI = makeAI({ game: 'GoodJunkVR', mode: run, rng, enabled: true });

  function setFever(p) {
    S.fever = clamp(p, 0, 100);
    if (elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if (elFeverText) elFeverText.textContent = `${S.fever}%`;
  }
  function setShieldUI() {
    if (!elShield) return;
    elShield.textContent = (S.shield > 0) ? `x${S.shield}` : '—';
  }

  function gradeNow() {
    if (S.score >= 190 && S.miss <= 3) return 'A';
    if (S.score >= 125 && S.miss <= 6) return 'B';
    if (S.score >= 70) return 'C';
    return 'D';
  }

  function setHUD() {
    if (elScore) elScore.textContent = String(S.score);
    if (elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    if (elMiss) elMiss.textContent = String(S.miss);
    if (elGrade) elGrade.textContent = gradeNow();
    setShieldUI();
    emit('hha:score', { score: S.score });
  }

  function addScore(delta) {
    S.score += (delta | 0);
    if (S.score < 0) S.score = 0;
  }

  function currentGoal() { return S.goals[S.goalIndex] || S.goals[0]; }
  function resetMiniWindow() {
    S.mini.windowStartAt = (performance.now ? performance.now() : Date.now());
    S.mini.groups.clear();
    S.mini.done = false;
  }

  function updateQuestUI() {
    const g = currentGoal();
    if (elGoalName) elGoalName.textContent = g?.name || '—';
    if (elGoalDesc) elGoalDesc.textContent = g?.desc || '—';

    let cur = 0, target = 1;

    if (g?.targetGood) {
      cur = S.hitGood; target = g.targetGood;
      if (elGoalDesc) elGoalDesc.textContent = `${g.desc} (ของดี ≥ ${g.targetGood}, MISS ≤ ${g.maxMiss})`;
    } else if (g?.targetCombo) {
      cur = S.comboMax; target = g.targetCombo;
      if (elGoalDesc) elGoalDesc.textContent = `${g.desc} (คอมโบสูงสุด ≥ ${g.targetCombo})`;
    } else {
      cur = Math.max(0, Math.floor(S.timePlan - S.timeLeft));
      target = Math.floor(S.timePlan);
      if (elGoalDesc) elGoalDesc.textContent = `${g.desc} (MISS ≤ ${g.maxMiss})`;
    }

    if (elGoalCur) elGoalCur.textContent = String(cur);
    if (elGoalTarget) elGoalTarget.textContent = String(target);

    const now = (performance.now ? performance.now() : Date.now());
    const left = Math.max(0, (S.mini.windowSec * 1000 - (now - S.mini.windowStartAt)) / 1000);
    const miniCur = S.mini.groups.size;
    const miniTar = 3;

    if (elMiniText) {
      elMiniText.textContent = S.mini.done
        ? `ผ่านแล้ว! 🎁 รับโบนัสแล้ว`
        : `ครบ ${miniTar} หมู่ใน ${S.mini.windowSec} วิ (${miniCur}/${miniTar})`;
    }
    if (elMiniTimer) {
      elMiniTimer.textContent = S.mini.done ? 'DONE' : `${left.toFixed(0)}s`;
    }

    emit('quest:update', {
      goal: { title: g?.name || '—', desc: g?.desc || '—', cur, target, done: false },
      mini: { title: `ครบ ${miniTar} หมู่ใน ${S.mini.windowSec} วิ`, cur: miniCur, target: miniTar, done: S.mini.done },
      allDone: false
    });
  }

  function advanceGoalIfDone() {
    const g = currentGoal();
    let done = false;
    if (g?.targetGood) done = (S.hitGood >= g.targetGood) && (S.miss <= g.maxMiss);
    else if (g?.targetCombo) done = (S.comboMax >= g.targetCombo);

    if (done) {
      const prev = S.goalIndex;
      S.goalIndex = Math.min(S.goals.length - 1, S.goals.length > 0 ? (S.goalIndex + 1) : 0);
      if (S.goalIndex !== prev) {
        emit('hha:coach', { msg: `GOAL ผ่านแล้ว ✅ ไปต่อ: ${currentGoal().name}`, tag: 'Coach' });
      }
    }
  }

  function onHitGoodMeta(groupId) {
    const now = (performance.now ? performance.now() : Date.now());
    if (!S.mini.windowStartAt) resetMiniWindow();
    if (now - S.mini.windowStartAt > S.mini.windowSec * 1000) resetMiniWindow();

    if (!S.mini.done) {
      S.mini.groups.add(Number(groupId) || 1);
      const tar = 3;
      if (S.mini.groups.size >= tar) {
        S.mini.done = true;

        if (!S.badge_mini) {
          S.badge_mini = true;
          awardOnce('goodjunk', 'mini_clear_1', {
            miniTar: tar,
            miniWindowSec: S.mini.windowSec | 0,
            score: S.score | 0,
            miss: S.miss | 0,
            comboMax: S.comboMax | 0
          });
        }

        const preferShield = (S.miss >= 2);
        if (preferShield) {
          S.shield = Math.min(3, S.shield + 1);
          addScore(14);
          emit('hha:judge', { type: 'perfect', label: 'BONUS 🛡️' });
        } else {
          const before = S.miss;
          S.miss = Math.max(0, S.miss - 1);
          addScore(18);
          emit('hha:judge', { type: 'perfect', label: (before !== S.miss) ? 'BONUS MISS-1' : 'BONUS ⭐' });
        }

        emit('hha:coach', { msg: `สุดยอด! ครบ 3 หมู่ใน ${S.mini.windowSec} วิ 🎁 โบนัสแล้ว!`, tag: 'Coach' });
      }
    }
  }

  function updateLowTime() {
    if (!elLowOverlay || !elLowNum) return;
    const t = Math.ceil(S.timeLeft);
    if (t <= 5 && t >= 0) {
      elLowOverlay.setAttribute('aria-hidden', 'false');
      elLowNum.textContent = String(t);
    } else {
      elLowOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  function updateProgress() {
    if (!elProgFill) return;
    const played = clamp(S.timePlan - S.timeLeft, 0, S.timePlan);
    const p = (S.timePlan > 0) ? (played / S.timePlan) : 0;
    elProgFill.style.width = `${Math.round(p * 100)}%`;
  }

  function setBossUI(active) {
    if (!elBossBar) return;
    elBossBar.setAttribute('aria-hidden', active ? 'false' : 'true');
    emit('gj:measureSafe', {});
  }
  function updateBossUI() {
    if (!elBossFill) return;
    const p = clamp(S.boss.hp / S.boss.hpMax, 0, 1);
    elBossFill.style.width = `${Math.round(p * 100)}%`;
  }

  function startBossIfNeeded() {
    if (S.boss.active || S.boss.cleared) return;

    const played = S.timePlan - S.timeLeft;
    const triggerAt = Math.max(18, S.timePlan * 0.70);
    if (played >= triggerAt) {
      S.boss.active = true;
      S.boss.startedAtSec = played;
      S.boss.hp = S.boss.hpMax = (diff === 'hard') ? 120 : (diff === 'easy') ? 90 : 100;
      setBossUI(true);
      updateBossUI();
      if (elBossHint) elBossHint.textContent = 'โหมดบอส: เก็บของดีเพื่อลดพลังบอส / อย่าโดนของเสีย!';
      emit('hha:coach', { msg: '⚡ เข้าสู่ BOSS PHASE! เก็บของดีให้แม่น ๆ', tag: 'Coach' });
      setFever(Math.min(100, S.fever + 8));
    }
  }

  function endBoss(success) {
    if (!S.boss.active) return;
    S.boss.active = false;
    S.boss.cleared = !!success;
    setBossUI(false);

    if (success) {
      if (!S.badge_boss) {
        S.badge_boss = true;
        awardOnce('goodjunk', 'boss_clear_1', {
          score: S.score | 0,
          miss: S.miss | 0,
          comboMax: S.comboMax | 0,
          hitGood: S.hitGood | 0,
          hitJunk: S.hitJunk | 0,
          expireGood: S.expireGood | 0
        });
      }

      addScore(120);
      setFever(Math.max(0, S.fever - 18));
      emit('hha:judge', { type: 'perfect', label: 'BOSS CLEAR!' });
      emit('hha:coach', { msg: '🏆 บอสแพ้แล้ว! เก่งมาก!', tag: 'Coach' });
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
    } else {
      emit('hha:coach', { msg: 'จบช่วงบอส! รอบหน้าลองเน้นของดีให้มากขึ้นนะ', tag: 'Coach' });
    }
    setHUD();
  }

  function onHit(kind, extra = {}) {
    if (S.ended) return;
    const tNow = performance.now();

    if (kind === 'good') {
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      if (!S.badge_streak10 && S.combo >= 10) {
        S.badge_streak10 = true;
        awardOnce('goodjunk', 'streak_10', {
          combo: S.combo | 0,
          comboMax: S.comboMax | 0,
          score: S.score | 0,
          miss: S.miss | 0
        });
      }

      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      if (extra.groupId) onHitGoodMeta(extra.groupId);
      emit('hha:judge', { type: 'good', label: 'GOOD' });
      if (aiOn) AI.onEvent('hitGood', { t: tNow });

      if (S.boss.active) {
        S.boss.hp = Math.max(0, S.boss.hp - 6);
        updateBossUI();
        if (S.boss.hp <= 0) endBoss(true);
      }
    }
    else if (kind === 'junk') {
      if (S.shield > 0) {
        S.shield--;
        setShieldUI();
        emit('hha:judge', { type: 'perfect', label: 'BLOCK!' });
      } else {
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type: 'bad', label: 'OOPS' });
        if (aiOn) AI.onEvent('hitJunk', { t: tNow });

        if (S.boss.active) {
          S.boss.hp = Math.min(S.boss.hpMax, S.boss.hp + 10);
          updateBossUI();
        }
      }
    }
    else if (kind === 'star') {
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type: 'perfect', label: (before !== S.miss) ? 'MISS -1!' : 'STAR!' });
    }
    else if (kind === 'shield') {
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
      addScore(8);
      emit('hha:judge', { type: 'perfect', label: 'SHIELD!' });
    }

    if (aiOn) {
      const played = S.timePlan - S.timeLeft;
      const tip = AI.getTip(played);
      if (tip) emit('hha:coach', tip);
    }

    setHUD();
    updateQuestUI();
    advanceGoalIfDone();
  }

  function killUid(uid) {
    const p = Pair.get(uid);
    if (!p || !p.alive) return;
    p.alive = false;
    for (const el of p.els) { try { el.remove(); } catch { } }
    Pair.delete(uid);
  }

  function makeTargetEl(kind, obj, sizePx) {
    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;
    t.style.position = 'absolute';
    t.style.lineHeight = '1';
    t.style.willChange = 'transform,left,top';

    if (kind === 'good' || kind === 'junk') {
      decorateTarget(t, obj);
    } else {
      t.textContent = (kind === 'star') ? '⭐' : '🛡️';
    }

    t.style.fontSize = sizePx + 'px';
    return t;
  }

  function spawn(kind) {
    if (S.ended) return;
    if (!layerL) return;

    const isCVR = DOC.body.classList.contains('view-cvr') && !!layerR;

    const size = (kind === 'good') ? 56 : (kind === 'junk') ? 58 : 52;

    const obj = { kind, rng: S.rng, groupId: null };
    if (kind === 'good') obj.groupId = chooseGroupId(S.rng);

    const uid = String(uidSeq++);

    const safeL = getSafeRectForLayer(layerL);
    const xL = safeL.x + S.rng() * safeL.w;
    const yL = safeL.y + S.rng() * safeL.h;

    const elL = makeTargetEl(kind, obj, size);
    elL.dataset.uid = uid;

    elL.style.left = Math.round(xL) + 'px';
    elL.style.top = Math.round(yL) + 'px';

    let els = [elL];

    if (isCVR) {
      const safeR = getSafeRectForLayer(layerR);
      const xRatio = safeR.w / Math.max(1, safeL.w);
      const xR = safeR.x + (xL - safeL.x) * xRatio;
      const yR = yL;

      const elR = makeTargetEl(kind, obj, size);
      elR.dataset.uid = uid;
      elR.style.left = Math.round(xR) + 'px';
      elR.style.top = Math.round(yR) + 'px';
      els.push(elR);
    }

    Pair.set(uid, { els, alive: true, kind, groupId: obj.groupId });

    function hitThis() {
      const p = Pair.get(uid);
      if (!p || !p.alive || S.ended) return;
      killUid(uid);
      if (kind === 'good') onHit('good', { groupId: obj.groupId });
      else onHit(kind);
    }

    for (const el of els) {
      el.addEventListener('pointerdown', hitThis, { passive: true });
    }

    layerL.appendChild(elL);
    if (isCVR && els[1] && layerR) layerR.appendChild(els[1]);

    const ttl = (kind === 'star' || kind === 'shield') ? 1700 : 1600;

    setTimeout(() => {
      const p = Pair.get(uid);
      if (!p || !p.alive || S.ended) return;

      killUid(uid);

      if (kind === 'good') {
        S.expireGood++;
        S.miss++;
        S.combo = 0;
        setFever(S.fever + 5);
        emit('hha:judge', { type: 'miss', label: 'MISS' });
        if (aiOn) AI.onEvent('miss', { t: performance.now() });

        if (S.boss.active) {
          S.boss.hp = Math.min(S.boss.hpMax, S.boss.hp + 12);
          updateBossUI();
        }

        setHUD();
        updateQuestUI();
      }
    }, ttl);
  }

  function onShoot(ev) {
    if (S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;

    let x = Number(ev?.detail?.x);
    let y = Number(ev?.detail?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const r = DOC.documentElement.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }

    if (aiOn) AI.onEvent('shoot', { t: performance.now() });

    const picked = pickByShootAt(x, y, lockPx);
    if (!picked) return;

    const uid = picked.dataset.uid || null;
    const kind = picked.dataset.kind || 'good';
    const groupId = picked.dataset.group ? Number(picked.dataset.group) : null;

    if (uid) killUid(uid);
    else { try { picked.remove(); } catch { } }

    if (kind === 'good') onHit('good', { groupId });
    else onHit(kind);
  }

  function goCooldownThenHub(summary) {
    const cdGateUrl = String(qs('cdGateUrl', qs('gateUrl', '../warmup-gate.html')) || '../warmup-gate.html');
    const cdur = Math.max(5, Math.min(60, Number(qs('cdur', '20')) || 20));

    const already = isDaily('HHA_COOLDOWN_DONE', category, pid);
    if (already) {
      location.href = hub;
      return;
    }

    markDaily('HHA_COOLDOWN_DONE', category, pid);

    const u = new URL(cdGateUrl, location.href);
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('cdur', String(cdur));
    u.searchParams.set('dur', String(cdur));
    u.searchParams.set('next', hub);
    u.searchParams.set('hub', hub);
    u.searchParams.set('category', category);
    u.searchParams.set('pid', pid);

    try {
      u.searchParams.set('score', String(summary.scoreFinal ?? 0));
      u.searchParams.set('grade', String(summary.grade ?? ''));
    } catch { }

    location.replace(u.toString());
  }

  function endGame(reason = 'timeup') {
    if (S.ended) return;
    S.ended = true;

    if (S.boss.active) endBoss(false);

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';

    const denom = Math.max(1, (S.hitGood | 0) + (S.hitJunk | 0) + (S.expireGood | 0) + (S.miss | 0));
    const acc = (S.hitGood | 0) / denom;

    if (acc >= 0.80) {
      awardOnce('goodjunk', 'score_80p', {
        accuracy: Number(acc.toFixed(4)),
        hitGood: S.hitGood | 0,
        hitJunk: S.hitJunk | 0,
        expireGood: S.expireGood | 0,
        miss: S.miss | 0,
        scoreFinal: S.score | 0,
        comboMax: S.comboMax | 0,
        bossCleared: !!S.boss.cleared
      });
    }
    if ((S.miss | 0) === 0) {
      awardOnce('goodjunk', 'perfect_run', {
        accuracy: Number(acc.toFixed(4)),
        hitGood: S.hitGood | 0,
        hitJunk: S.hitJunk | 0,
        expireGood: S.expireGood | 0,
        miss: S.miss | 0,
        scoreFinal: S.score | 0,
        comboMax: S.comboMax | 0,
        bossCleared: !!S.boss.cleared
      });
    }

    const summary = {
      game: 'GoodJunkVR',
      category,
      pack: 'fair-v4.2-boss-layout+gatepatch',
      view: S.view,
      runMode: S.run,
      diff: S.diff,
      seed: S.seed,
      pid,
      durationPlannedSec: S.timePlan,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),
      scoreFinal: S.score,
      miss: S.miss,
      comboMax: S.comboMax,
      hitGood: S.hitGood,
      hitJunk: S.hitJunk,
      expireGood: S.expireGood,
      shieldRemaining: S.shield,
      bossCleared: S.boss.cleared,
      grade,
      reason
    };

    try { localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); } catch { }
    try {
      WIN.removeEventListener('hha:shoot', onShoot);
      WIN.removeEventListener('gj:shoot', onShoot);
    } catch { }
    emit('hha:end', summary);

    showSummaryOverlay(summary, { hub }, () => {
      goCooldownThenHub(summary);
    });
  }

  function tick(ts) {
    if (S.ended) return;
    if (!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick) / 1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if (elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left: S.timeLeft });

    updateLowTime();
    updateProgress();
    startBossIfNeeded();

    const played = (S.timePlan - S.timeLeft);

    let base = { spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 };

    if (diff === 'easy') { base.spawnMs = 980; base.pJunk = 0.22; base.pGood = 0.74; }
    else if (diff === 'hard') { base.spawnMs = 820; base.pJunk = 0.30; base.pGood = 0.66; }

    if (S.boss.active) {
      base.spawnMs = Math.max(520, base.spawnMs - 260);
      base.pJunk = Math.min(0.52, base.pJunk + 0.16);
      base.pGood = Math.max(0.40, base.pGood - 0.14);
      base.pStar = base.pStar + 0.01;
      base.pShield = base.pShield + 0.02;
    }

    const D = (adaptiveOn && aiOn) ? AI.getDifficulty(played, base)
      : (adaptiveOn ? {
        spawnMs: Math.max(560, base.spawnMs - (played > 8 ? (played - 8) * 5 : 0)),
        pGood: base.pGood - Math.min(0.10, played * 0.002),
        pJunk: base.pJunk + Math.min(0.10, played * 0.002),
        pStar: base.pStar,
        pShield: base.pShield
      } : { ...base });

    {
      let s = D.pGood + D.pJunk + D.pStar + D.pShield;
      if (s <= 0) s = 1;
      D.pGood /= s; D.pJunk /= s; D.pStar /= s; D.pShield /= s;
    }

    if (ts - S.lastSpawn >= D.spawnMs) {
      S.lastSpawn = ts;
      const r = S.rng();
      if (r < D.pGood) spawn('good');
      else if (r < D.pGood + D.pJunk) spawn('junk');
      else if (r < D.pGood + D.pJunk + D.pStar) spawn('star');
      else spawn('shield');
    }

    if (S.boss.active && S.boss.startedAtSec != null) {
      if (played - S.boss.startedAtSec >= S.boss.durationSec) {
        endBoss(false);
      }
    }

    if (S.timeLeft <= 0) {
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  resetMiniWindow();
  setFever(S.fever);
  setShieldUI();
  setHUD();
  updateQuestUI();
  updateProgress();
  setBossUI(false);

  awardOnce('goodjunk', 'first_play', {});

  WIN.addEventListener('hha:shoot', onShoot, { passive: true });
  WIN.addEventListener('gj:shoot', onShoot, { passive: true });

  emit('hha:start', {
    game: 'GoodJunkVR',
    category,
    pack: 'fair-v4.2-boss-layout+gatepatch',
    view,
    runMode: run,
    diff,
    timePlanSec: timePlan,
    seed,
    pid
  });

  requestAnimationFrame(tick);
}