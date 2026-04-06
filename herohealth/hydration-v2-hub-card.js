// === /herohealth/hydration-v2-hub-card.js ===
// Hydration V2 Hub Card Preview + Continue Session
// PATCH v20260320j-HYDRATION-V2-HUB-CARD

(() => {
  'use strict';

  const FIXED_HUB_URL = 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';

  const ALBUM_META = {
    theme_regular_school: { icon:'🏫', label:'School Day' },
    theme_hot_day: { icon:'☀️', label:'Hot Day' },
    theme_pe_day: { icon:'🏃', label:'PE Day' },
    theme_exam_day: { icon:'📝', label:'Exam Day' },
    theme_sweet_control: { icon:'🥤', label:'No Sugar Day' },
    theme_activity_day: { icon:'🎉', label:'Activity Day' },

    mission_triple: { icon:'🎯', label:'Mission Trio' },
    mission_perfect_control: { icon:'🛡️', label:'Perfect Control' },
    mission_combo_star: { icon:'✨', label:'Combo Star' },

    event_heat_wave: { icon:'☀️', label:'Heat Wave' },
    event_sugar_storm: { icon:'🥤', label:'Sugar Storm' },
    event_water_rush: { icon:'💧', label:'Water Rush' },
    event_shield_time: { icon:'🛡️', label:'Shield Time' },

    score_100: { icon:'💯', label:'Score 100' },
    score_180: { icon:'🏆', label:'Score 180' },
    combo_8: { icon:'🌟', label:'Combo 8' },
    reward_3: { icon:'🎁', label:'Reward Hunter' },

    team_goal_clear: { icon:'🤝', label:'Team Goal Clear' },
    team_3_stars: { icon:'⭐', label:'3 Stars Team' },

    streak_3: { icon:'🔥', label:'3-Day Streak' },
    streak_5: { icon:'🚀', label:'5-Day Streak' },
    runs_5: { icon:'🎮', label:'5 Runs' },
    runs_10: { icon:'🏅', label:'10 Runs' },
    week_3_days: { icon:'📅', label:'3 Active Days' }
  };

  const TOTAL_STICKERS = Object.keys(ALBUM_META).length;

  let scheduled = false;

  boot();

  function boot() {
    ensureStyles();
    patchHubCards();

    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        patchHubCards();
      });
    });

    mo.observe(document.documentElement, {
      subtree: true,
      childList: true
    });
  }

  function ensureStyles() {
    if (document.getElementById('hhv2-hub-preview-style')) return;

    const style = document.createElement('style');
    style.id = 'hhv2-hub-preview-style';
    style.textContent = `
      .hhv2-hub-preview{
        margin-top:12px;
        padding:12px 12px 10px;
        border-radius:16px;
        background:rgba(3,21,37,.72);
        border:1px solid rgba(148,163,184,.16);
        color:#eaf6ff;
        font:800 12px/1.45 "Noto Sans Thai",system-ui,sans-serif;
        box-shadow:0 10px 24px rgba(0,0,0,.16);
      }
      .hhv2-hub-preview .hhv2-row{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-bottom:8px;
      }
      .hhv2-hub-preview .hhv2-chip{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:6px 9px;
        border-radius:999px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(148,163,184,.14);
        color:#eaf6ff;
        white-space:nowrap;
      }
      .hhv2-hub-preview .hhv2-line{
        margin-top:6px;
        color:#dcefff;
      }
      .hhv2-hub-preview .hhv2-sub{
        opacity:.86;
        font-size:11px;
      }
      .hhv2-hub-preview .hhv2-cta{
        margin-top:10px;
        display:inline-flex;
        align-items:center;
        gap:8px;
        min-height:36px;
        padding:8px 12px;
        border-radius:999px;
        background:linear-gradient(180deg,#4cc9ff,#1ca6df);
        color:#031525;
        text-decoration:none;
        font-weight:1000;
        box-shadow:0 8px 18px rgba(0,0,0,.14);
      }
      .hhv2-hub-preview .hhv2-cta-label{
        font-size:12px;
      }
      .hhv2-hub-preview .hhv2-mini{
        margin-top:8px;
        font-size:11px;
        color:#bfe2f8;
      }
      .hhv2-hub-anchor .hhv2-hub-preview{
        pointer-events:none;
      }
      .hhv2-hub-anchor{
        text-decoration:none;
      }
    `;
    document.head.appendChild(style);
  }

  function patchHubCards() {
    const cards = findHydrationV2Cards();
    if (!cards.length) return;

    const identity = resolveIdentity();
    const album = loadAlbum(identity.pid, identity.studyId);
    const progression = loadProgression(identity.pid, identity.studyId);
    const lastResearch = readJson('HHA_HYDRATION_V2_RESEARCH_LAST', null);
    const lastSummary = readJson('HHA_LAST_SUMMARY', null);
    const launcherUrl = buildLauncherUrl(identity, lastResearch, lastSummary);
    const preview = buildPreview(identity, album, progression, lastResearch, lastSummary);

    cards.forEach((card) => {
      renderCardPreview(card, launcherUrl, preview);
    });
  }

  function findHydrationV2Cards() {
    const found = new Set();

    const directSelectors = [
      'a[href*="hydration-v2.html"]',
      'a[href*="vr-hydration-v2"]',
      '[data-game="hydration-v2"]',
      '[data-game="hydration_v2"]',
      '[data-game-id="hydration-v2"]',
      '[data-game-id="hydration_v2"]'
    ];

    directSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        found.add(normalizeCardContainer(el));
      });
    });

    if (!found.size) {
      document.querySelectorAll('a, article, section, .card, .tile, .game-card').forEach((el) => {
        const text = String(el.textContent || '').toLowerCase();
        const href = String(el.getAttribute?.('href') || '').toLowerCase();
        if (
          (text.includes('hydration v2') || text.includes('hydration')) &&
          (href.includes('hydration-v2') || text.includes('v2'))
        ) {
          found.add(normalizeCardContainer(el));
        }
      });
    }

    return [...found].filter(Boolean);
  }

  function normalizeCardContainer(el) {
    if (!el) return null;
    return el.closest('a, .game-card, .tile, .card, article, section, [data-game], [data-game-id]') || el;
  }

  function resolveIdentity() {
    const qs = new URLSearchParams(location.search);
    const lastResearch = readJson('HHA_HYDRATION_V2_RESEARCH_LAST', null);
    const lastSummary = readJson('HHA_LAST_SUMMARY', null);

    return {
      pid: String(
        qs.get('pid') ||
        lastResearch?.pid ||
        lastSummary?.pid ||
        'anon'
      ).trim() || 'anon',
      studyId: String(
        qs.get('studyId') ||
        lastResearch?.studyId ||
        lastSummary?.studyId ||
        'nostudy'
      ).trim() || 'nostudy'
    };
  }

  function buildLauncherUrl(identity, lastResearch, lastSummary) {
    const u = new URL('./hydration-v2.html', location.href);

    const nextSessionNo = positiveInt(lastSummary?.nextSessionNo) ||
      (positiveInt(lastResearch?.sessionNo) ? positiveInt(lastResearch.sessionNo) + 1 : 1);

    const nextWeekNo = positiveInt(lastSummary?.nextWeekNo) ||
      deriveWeekNo(nextSessionNo);

    const mode = String(lastResearch?.mode || lastSummary?.mode || 'quick');
    const type = String(lastResearch?.type || lastSummary?.type || 'solo');
    const run = String(lastResearch?.run || lastSummary?.run || 'play');
    const diff = String(lastResearch?.diff || lastSummary?.diff || 'normal');

    u.searchParams.set('pid', identity.pid);
    u.searchParams.set('studyId', identity.studyId);
    u.searchParams.set('mode', mode);
    u.searchParams.set('type', type);
    u.searchParams.set('run', run);
    u.searchParams.set('diff', diff);
    u.searchParams.set('session', String(nextSessionNo || 1));
    u.searchParams.set('week', String(nextWeekNo || 1));
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('hub', FIXED_HUB_URL);

    return u.toString();
  }

  function buildPreview(identity, album, progression, lastResearch, lastSummary) {
    const unlockedIds = Object.keys(album?.stickers || {});
    const latestUnlocked = Array.isArray(album?.lastUnlocked) ? album.lastUnlocked.slice(0, 3) : [];
    const todayRuns = positiveInt(progression?.todayRuns);
    const totalRuns = positiveInt(progression?.totalRuns);
    const streakDays = positiveInt(progression?.streakDays);
    const active7 = countActiveDaysInLast7(progression);

    const goals = buildReplayGoals(album, progression, lastSummary);
    const nextGoal = goals[0] || null;

    const sessionNo = positiveInt(lastSummary?.nextSessionNo) ||
      (positiveInt(lastResearch?.sessionNo) ? positiveInt(lastResearch.sessionNo) + 1 : 1);
    const weekNo = positiveInt(lastSummary?.nextWeekNo) || deriveWeekNo(sessionNo);

    const lastSummaryTitle = buildLastSummaryTitle(lastSummary, latestUnlocked);

    return {
      albumCount: unlockedIds.length,
      todayRuns,
      totalRuns,
      streakDays,
      active7,
      nextGoal,
      sessionNo,
      weekNo,
      lastSummaryTitle,
      latestUnlocked
    };
  }

  function buildLastSummaryTitle(lastSummary, latestUnlocked) {
    if (latestUnlocked.length) {
      const first = latestUnlocked[0];
      const meta = ALBUM_META[first];
      return `${meta?.icon || '✨'} ${meta?.label || first}`;
    }

    if (lastSummary?.roundThemeId) {
      return `รอบล่าสุด: ${String(lastSummary.roundThemeId).replaceAll('_', ' ')}`;
    }

    return 'ยังไม่มีของใหม่ล่าสุด';
  }

  function buildReplayGoals(album, progression, lastSummary) {
    const unlocked = new Set(Object.keys(album?.stickers || {}));
    const summary = lastSummary || {};
    const actionScore = Number(summary?.actionScore || 0);
    const totalScore = Number(summary?.totalScore || 0);
    const bestCombo = Number(summary?.bestCombo || 0);
    const rewardCount = Number(summary?.rewardCount || 0);
    const teamStars = Number(summary?.teamStars || 0);
    const teamMissionDone = !!summary?.teamMissionDone;
    const type = String(summary?.type || 'solo');

    const checklist = {
      goodCatchOk: Number(summary?.goodCatch || 0) >= 8,
      choicesOk: Number(summary?.correctChoices || 0) >= 1,
      planOk: Number(summary?.createdPlanScore || 0) >= 60,
      contributionOk: Number(summary?.classTankContribution || 0) >= 60
    };

    const goals = [];

    pushGoal(goals, unlocked, 'score_100', '💯', 'Action 100', Math.max(0, 100 - Math.round(actionScore)), `อีก ${Math.max(0, 100 - Math.round(actionScore))} คะแนน`);
    pushGoal(goals, unlocked, 'score_180', '🏆', 'Total 180', Math.max(0, 180 - Math.round(totalScore)), `อีก ${Math.max(0, 180 - Math.round(totalScore))} คะแนนรวม`);
    pushGoal(goals, unlocked, 'combo_8', '🌟', 'Combo 8', Math.max(0, 8 - bestCombo), `อีก ${Math.max(0, 8 - bestCombo)} คอมโบ`);
    pushGoal(goals, unlocked, 'reward_3', '🎁', 'Reward 3', Math.max(0, 3 - rewardCount), `อีก ${Math.max(0, 3 - rewardCount)} reward`);

    if (type === 'team' && !unlocked.has('team_goal_clear')) {
      const missing = [];
      if (!checklist.goodCatchOk) missing.push('เก็บน้ำ 8+');
      if (!checklist.choicesOk) missing.push('Scenarios ถูก 1+');
      if (!checklist.planOk) missing.push('Plan 60+');
      if (!checklist.contributionOk) missing.push('Contribution 60%+');

      goals.push({
        icon: '🤝',
        title: 'Team Goal',
        remain: missing.length,
        tip: missing.length ? `ยังขาด ${missing.join(' • ')}` : (teamMissionDone ? 'ผ่านแล้ว' : 'ใกล้แล้ว')
      });
    }

    if (type === 'team' && !unlocked.has('team_3_stars')) {
      goals.push({
        icon: '⭐',
        title: '3 Stars Team',
        remain: teamStars >= 3 ? 0 : (3 - teamStars),
        tip: teamStars >= 3 ? 'ผ่านแล้ว' : `ตอนนี้ ${teamStars} ดาว`
      });
    }

    const totalRuns = positiveInt(progression?.totalRuns);
    const streakDays = positiveInt(progression?.streakDays);
    const active7 = countActiveDaysInLast7(progression);

    pushGoal(goals, unlocked, 'runs_5', '🎮', '5 Runs', Math.max(0, 5 - totalRuns), `อีก ${Math.max(0, 5 - totalRuns)} รอบ`);
    pushGoal(goals, unlocked, 'runs_10', '🏅', '10 Runs', Math.max(0, 10 - totalRuns), `อีก ${Math.max(0, 10 - totalRuns)} รอบ`);
    pushGoal(goals, unlocked, 'streak_3', '🔥', '3-Day Streak', Math.max(0, 3 - streakDays), `อีก ${Math.max(0, 3 - streakDays)} วัน`);
    pushGoal(goals, unlocked, 'streak_5', '🚀', '5-Day Streak', Math.max(0, 5 - streakDays), `อีก ${Math.max(0, 5 - streakDays)} วัน`);
    pushGoal(goals, unlocked, 'week_3_days', '📅', '3 Active Days', Math.max(0, 3 - active7), `อีก ${Math.max(0, 3 - active7)} วัน active`);

    goals.sort((a, b) => Number(a.remain || 0) - Number(b.remain || 0));
    return goals;
  }

  function pushGoal(arr, unlocked, stickerId, icon, title, remain, tip) {
    if (unlocked.has(stickerId)) return;
    arr.push({ icon, title, remain, tip });
  }

  function renderCardPreview(card, launcherUrl, preview) {
    if (!card) return;

    card.classList.add('hhv2-hub-anchor');

    if (card.tagName.toLowerCase() === 'a') {
      card.href = launcherUrl;
    } else {
      const primaryLink = card.querySelector('a[href]');
      if (primaryLink) primaryLink.href = launcherUrl;
    }

    let mount = card.querySelector('.hhv2-hub-preview');
    if (!mount) {
      mount = document.createElement('div');
      mount.className = 'hhv2-hub-preview';
      card.appendChild(mount);
    }

    const latest = preview.latestUnlocked?.length
      ? preview.latestUnlocked.map((id) => {
          const meta = ALBUM_META[id];
          return `${escapeHtml(meta?.icon || '✨')} ${escapeHtml(meta?.label || id)}`;
        }).join(' • ')
      : 'ยังไม่มีของใหม่ล่าสุด';

    const nextGoalHtml = preview.nextGoal
      ? `${escapeHtml(preview.nextGoal.icon)} ${escapeHtml(preview.nextGoal.title)} — ${escapeHtml(preview.nextGoal.tip)}`
      : 'สะสมได้เยอะมากแล้ว • ลองเล่นเพื่อทำสถิติใหม่';

    const isAnchorCard = card.tagName.toLowerCase() === 'a';

    mount.innerHTML = `
      <div class="hhv2-row">
        <span class="hhv2-chip">🔥 ${preview.streakDays} day streak</span>
        <span class="hhv2-chip">🎮 ${preview.todayRuns} runs today</span>
        <span class="hhv2-chip">🃏 ${preview.albumCount}/${TOTAL_STICKERS}</span>
      </div>

      <div class="hhv2-line">
        <strong>Next:</strong> ${nextGoalHtml}
      </div>

      <div class="hhv2-line hhv2-sub">
        <strong>Latest:</strong> ${escapeHtml(preview.lastSummaryTitle)}
      </div>

      <div class="hhv2-mini">
        วันนี้เล่นรวม ${preview.todayRuns} รอบ • ทั้งหมด ${preview.totalRuns} รอบ • 7 วันล่าสุด active ${preview.active7} วัน
      </div>

      <div class="hhv2-mini">
        ของใหม่ล่าสุด: ${latest}
      </div>

      ${isAnchorCard
        ? `<div class="hhv2-mini"><strong>Continue:</strong> W${preview.weekNo} S${preview.sessionNo}</div>`
        : `<a class="hhv2-cta" href="${escapeHtmlAttr(launcherUrl)}"><span>▶</span><span class="hhv2-cta-label">Continue W${preview.weekNo} S${preview.sessionNo}</span></a>`
      }
    `;
  }

  function loadAlbum(pid, studyId) {
    return readJson(buildAlbumKey(pid, studyId), {
      stickers: {},
      totalRuns: 0,
      unlockedCount: 0,
      lastUnlocked: [],
      updatedAt: ''
    });
  }

  function loadProgression(pid, studyId) {
    return readJson(buildProgressionKey(pid, studyId), {
      totalRuns: 0,
      todayKey: '',
      todayRuns: 0,
      streakDays: 0,
      activeDays: [],
      lastPlayedDate: ''
    });
  }

  function buildAlbumKey(pid, studyId) {
    return `HHA_HYD_V2_ALBUM:${pid}:${studyId}`;
  }

  function buildProgressionKey(pid, studyId) {
    return `HHA_HYD_V2_PROGRESSION:${pid}:${studyId}`;
  }

  function countActiveDaysInLast7(prog) {
    const active = Array.isArray(prog?.activeDays) ? prog.activeDays : [];
    if (!active.length) return 0;

    const today = todayLocalKey();
    const windowKeys = new Set();
    for (let i = 0; i < 7; i += 1) {
      windowKeys.add(shiftDateKey(today, -i));
    }

    return active.filter(d => windowKeys.has(d)).length;
  }

  function deriveWeekNo(sessionNo) {
    const s = positiveInt(sessionNo) || 1;
    return Math.max(1, Math.floor((s - 1) / 2) + 1);
  }

  function todayLocalKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function shiftDateKey(dateKey, deltaDays) {
    const d = new Date(`${dateKey}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function positiveInt(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function escapeHtmlAttr(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
})();