// === /herohealth/hydration-v2-hub-strip.js ===
// Hydration V2 Global Hub Profile Strip
// PATCH v20260320k-HYDRATION-V2-HUB-STRIP

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

  boot();

  function boot() {
    ensureStyles();
    renderStrip();
  }

  function ensureStyles() {
    if (document.getElementById('hhv2-hub-strip-style')) return;

    const style = document.createElement('style');
    style.id = 'hhv2-hub-strip-style';
    style.textContent = `
      #hhv2-hub-strip{
        margin: 0 auto 16px;
        width: min(1180px, calc(100vw - 24px));
        border-radius: 24px;
        background:
          radial-gradient(circle at top right, rgba(76,201,255,.12), transparent 30%),
          linear-gradient(180deg, rgba(3,21,37,.94), rgba(6,28,48,.92));
        border: 1px solid rgba(148,163,184,.16);
        box-shadow: 0 18px 42px rgba(0,0,0,.18);
        color:#ecf8ff;
        overflow:hidden;
      }
      #hhv2-hub-strip .hhv2-strip-inner{
        padding:14px 16px;
        display:grid;
        gap:12px;
      }
      #hhv2-hub-strip .hhv2-strip-top{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        flex-wrap:wrap;
      }
      #hhv2-hub-strip .hhv2-title{
        font:1000 18px/1.15 "Noto Sans Thai",system-ui,sans-serif;
        margin-bottom:6px;
      }
      #hhv2-hub-strip .hhv2-sub{
        color:#cce6f7;
        font:800 12px/1.5 "Noto Sans Thai",system-ui,sans-serif;
      }
      #hhv2-hub-strip .hhv2-chip-row{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      #hhv2-hub-strip .hhv2-chip{
        display:inline-flex;
        align-items:center;
        gap:6px;
        min-height:34px;
        padding:7px 10px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.14);
        background:rgba(255,255,255,.06);
        color:#eef8ff;
        font:900 12px/1.2 "Noto Sans Thai",system-ui,sans-serif;
      }
      #hhv2-hub-strip .hhv2-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
      }
      #hhv2-hub-strip .hhv2-box{
        min-height:74px;
        padding:12px;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.12);
        background:rgba(255,255,255,.05);
      }
      #hhv2-hub-strip .hhv2-box-title{
        font:1000 12px/1.1 "Noto Sans Thai",system-ui,sans-serif;
        color:#dff3ff;
        margin-bottom:6px;
      }
      #hhv2-hub-strip .hhv2-box-body{
        font:800 12px/1.55 "Noto Sans Thai",system-ui,sans-serif;
        color:#cce6f7;
      }
      #hhv2-hub-strip .hhv2-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      #hhv2-hub-strip .hhv2-btn{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        min-height:40px;
        padding:9px 14px;
        border-radius:999px;
        text-decoration:none;
        font:1000 13px/1 "Noto Sans Thai",system-ui,sans-serif;
      }
      #hhv2-hub-strip .hhv2-btn.primary{
        background:linear-gradient(180deg,#56d3ff,#1ca6df);
        color:#042033;
      }
      #hhv2-hub-strip .hhv2-btn.ghost{
        background:rgba(255,255,255,.06);
        border:1px solid rgba(148,163,184,.14);
        color:#eef8ff;
      }
      @media (max-width: 900px){
        #hhv2-hub-strip .hhv2-grid{
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderStrip() {
    const identity = resolveIdentity();
    const album = loadAlbum(identity.pid, identity.studyId);
    const progression = loadProgression(identity.pid, identity.studyId);
    const lastResearch = readJson('HHA_HYDRATION_V2_RESEARCH_LAST', null);
    const lastSummary = readJson('HHA_LAST_SUMMARY', null);

    const launcherUrl = buildLauncherUrl(identity, lastResearch, lastSummary);
    const dashboardUrl = buildDashboardUrl();

    const strip = document.createElement('section');
    strip.id = 'hhv2-hub-strip';

    const unlockedIds = Object.keys(album?.stickers || {});
    const latestUnlocked = Array.isArray(album?.lastUnlocked) ? album.lastUnlocked.slice(0, 3) : [];
    const active7 = countActiveDaysInLast7(progression);
    const goals = buildReplayGoals(album, progression, lastSummary);
    const nextGoal = goals[0] || null;
    const sessionNo = positiveInt(lastSummary?.nextSessionNo) ||
      (positiveInt(lastResearch?.sessionNo) ? positiveInt(lastResearch.sessionNo) + 1 : 1);
    const weekNo = positiveInt(lastSummary?.nextWeekNo) || deriveWeekNo(sessionNo);

    strip.innerHTML = `
      <div class="hhv2-strip-inner">
        <div class="hhv2-strip-top">
          <div>
            <div class="hhv2-title">💧 Hydration V2 Progress</div>
            <div class="hhv2-sub">
              PID ${escapeHtml(identity.pid)} • Study ${escapeHtml(identity.studyId)} • Continue W${weekNo} S${sessionNo}
            </div>
          </div>

          <div class="hhv2-actions">
            <a class="hhv2-btn primary" href="${escapeHtmlAttr(launcherUrl)}">▶ Continue Hydration V2</a>
            <a class="hhv2-btn ghost" href="${escapeHtmlAttr(dashboardUrl)}">📊 Open Dashboard</a>
          </div>
        </div>

        <div class="hhv2-chip-row">
          <span class="hhv2-chip">🔥 ${positiveInt(progression?.streakDays)} day streak</span>
          <span class="hhv2-chip">🎮 ${positiveInt(progression?.todayRuns)} runs today</span>
          <span class="hhv2-chip">🃏 ${unlockedIds.length}/${TOTAL_STICKERS} stickers</span>
          <span class="hhv2-chip">📅 ${active7} active days / 7d</span>
        </div>

        <div class="hhv2-grid">
          <div class="hhv2-box">
            <div class="hhv2-box-title">Latest Unlock</div>
            <div class="hhv2-box-body">
              ${latestUnlocked.length
                ? latestUnlocked.map((id) => {
                    const meta = ALBUM_META[id];
                    return `• ${escapeHtml(meta?.icon || '✨')} ${escapeHtml(meta?.label || id)}`;
                  }).join('<br/>')
                : '• ยังไม่มีของใหม่ล่าสุด'}
            </div>
          </div>

          <div class="hhv2-box">
            <div class="hhv2-box-title">Next Unlock</div>
            <div class="hhv2-box-body">
              ${nextGoal
                ? `• ${escapeHtml(nextGoal.icon)} ${escapeHtml(nextGoal.title)}<br/>• ${escapeHtml(nextGoal.tip)}`
                : '• สะสมได้เยอะมากแล้ว • ลองเล่นเพื่อทำสถิติใหม่'}
            </div>
          </div>

          <div class="hhv2-box">
            <div class="hhv2-box-title">Come Back Reason</div>
            <div class="hhv2-box-body">
              ${renderDailyReturnReason(progression, lastSummary, goals)}
            </div>
          </div>
        </div>
      </div>
    `;

    const firstMain = findHubInsertPoint();
    if (firstMain) {
      firstMain.parentNode.insertBefore(strip, firstMain);
    } else {
      document.body.prepend(strip);
    }
  }

  function findHubInsertPoint() {
    return (
      document.querySelector('main') ||
      document.querySelector('.hub-main') ||
      document.querySelector('.wrap') ||
      document.querySelector('.container') ||
      document.body.firstElementChild
    );
  }

  function renderDailyReturnReason(progression, lastSummary, goals) {
    const streak = positiveInt(progression?.streakDays);
    const todayRuns = positiveInt(progression?.todayRuns);

    const lines = [];

    if (streak < 3) lines.push(`• 🔥 อีก ${3 - streak} วัน จะได้ 3-Day Streak`);
    else if (streak < 5) lines.push(`• 🚀 อีก ${5 - streak} วัน จะได้ 5-Day Streak`);

    if (todayRuns === 0) {
      lines.push('• วันนี้ยังไม่ได้เล่น ลองเข้ารอบแรกของวัน');
    } else if (todayRuns < 3) {
      lines.push(`• วันนี้เล่นแล้ว ${todayRuns} รอบ ลองอีกรอบเพื่อเก็บของเพิ่ม`);
    }

    if (goals[0]) {
      lines.push(`• ${escapeHtml(goals[0].icon)} ${escapeHtml(goals[0].tip)}`);
    }

    if (lastSummary?.finalChallengeCleared === false && lastSummary?.finalChallengeLabel) {
      lines.push(`• บอสล่าสุดยังไม่ผ่าน: ${escapeHtml(String(lastSummary.finalChallengeLabel))}`);
    }

    return lines.length ? lines.join('<br/>') : '• ตอนนี้ progress ดีมากแล้ว ลองเล่นเพื่อทำคะแนนใหม่';
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

  function buildDashboardUrl() {
    const u = new URL('./hydration-v2-dashboard.html', location.href);
    u.searchParams.set('hub', FIXED_HUB_URL);
    u.searchParams.set('launcher', './hydration-v2.html');
    return u.toString();
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