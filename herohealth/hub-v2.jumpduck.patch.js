// === /herohealth/hub-v2.jumpduck.patch.js ===
// Hub v2 zone-first + JumpDuck awareness patch
// v20260406a-jd-hub-patch

(function () {
  'use strict';

  const GJ_HUB_SNAPSHOT_KEY = 'HHA_GJ_HUB_SNAPSHOT';
  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
  const NEXT_ZONE_KEY = 'HHA_NEXT_ZONE';
  const RECOMMENDED_ZONE_KEY = 'HHA_RECOMMENDED_ZONE';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const JUMPDUCK_SUMMARY_KEY = 'HHA_LAST_SUMMARY_JUMPDUCK';

  const $ = (id) => document.getElementById(id);

  function safeJsonParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function readJsonKey(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? safeJsonParse(raw, null) : null;
    } catch (_) {
      return null;
    }
  }

  function readGoodJunkHubSnapshot() {
    return readJsonKey(GJ_HUB_SNAPSHOT_KEY);
  }

  function clearGoodJunkHubSnapshot() {
    try { localStorage.removeItem(GJ_HUB_SNAPSHOT_KEY); } catch (_) {}
  }

  function readJumpDuckSummary() {
    const jd = readJsonKey(JUMPDUCK_SUMMARY_KEY);
    if (jd && String(jd.game || '').toLowerCase() === 'jumpduck') return jd;

    const generic = readJsonKey(LAST_SUMMARY_KEY);
    if (generic && String(generic.game || '').toLowerCase() === 'jumpduck') return generic;

    return null;
  }

  function qsGet(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (_) {
      return d;
    }
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
  }

  function setHref(id, href) {
    const el = $(id);
    if (el) el.href = href;
  }

  function setLastZone(zone) {
    try { localStorage.setItem(LAST_ZONE_KEY, zone); } catch (_) {}
  }

  function getLastZone() {
    try { return localStorage.getItem(LAST_ZONE_KEY) || ''; } catch (_) { return ''; }
  }

  function getNextZone() {
    try { return localStorage.getItem(NEXT_ZONE_KEY) || ''; } catch (_) { return ''; }
  }

  function getRecommendedZone() {
    try { return localStorage.getItem(RECOMMENDED_ZONE_KEY) || ''; } catch (_) { return ''; }
  }

  function buildZoneUrl(zone) {
    const map = {
      hygiene: './hygiene-zone.html',
      nutrition: './nutrition-zone.html',
      fitness: './fitness-zone.html'
    };

    const base = map[zone] || './hub-v2.html';
    const u = new URL(base, location.href);

    const pid = qsGet('pid', 'anon');
    const name = qsGet('name', qsGet('nickName', 'Hero'));
    const run = qsGet('run', 'play');
    const diff = qsGet('diff', 'normal');
    const view = qsGet('view', 'mobile');
    const time = qsGet('time', '90');
    const studyId = qsGet('studyId', '');
    const seed = qsGet('seed', '');
    const debug = qsGet('debug', '');
    const api = qsGet('api', '');
    const log = qsGet('log', '');

    u.searchParams.set('zone', zone);
    u.searchParams.set('pid', pid);
    u.searchParams.set('name', name);
    u.searchParams.set('run', run);
    u.searchParams.set('diff', diff);
    u.searchParams.set('view', view);
    u.searchParams.set('time', time);
    u.searchParams.set('hub', location.href);

    if (studyId) u.searchParams.set('studyId', studyId);
    if (seed) u.searchParams.set('seed', seed);
    if (debug) u.searchParams.set('debug', debug);
    if (api) u.searchParams.set('api', api);
    if (log) u.searchParams.set('log', log);

    return u.toString();
  }

  function buildZoneUrlWithFocus(zone, focusGame) {
    const u = new URL(buildZoneUrl(zone));
    if (focusGame) {
      u.searchParams.set('focus', focusGame);
      u.searchParams.set('featured', focusGame);
    }
    return u.toString();
  }

  function goZone(zone) {
    setLastZone(zone);
    location.href = buildZoneUrl(zone);
  }

  function bindZoneMemoryAnchors(root) {
    if (!root) return;
    root.querySelectorAll('[data-zone-memory]').forEach((el) => {
      if (el.__zoneMemoryBound) return;
      el.__zoneMemoryBound = true;
      el.addEventListener('click', function () {
        const zone = this.getAttribute('data-zone-memory') || '';
        if (zone) setLastZone(zone);
      });
    });
  }

  function stripZonePreview() {
    ['hygPreview', 'nutriPreview', 'fitPreview'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.innerHTML = '';
      el.hidden = true;
      el.style.display = 'none';
    });
  }

  function bindZoneButtons() {
    const hygieneUrl = buildZoneUrl('hygiene');
    const nutritionUrl = buildZoneUrl('nutrition');
    const fitnessUrl = buildZoneUrlWithFocus('fitness', 'jumpduck');

    setHref('btnPlayHygiene', hygieneUrl);
    setHref('btnPlayNutrition', nutritionUrl);
    setHref('btnPlayFitness', fitnessUrl);

    [
      ['btnZoneHygiene', 'hygiene'],
      ['btnZoneNutrition', 'nutrition'],
      ['btnZoneFitness', 'fitness']
    ].forEach(([id, zone]) => {
      const el = $(id);
      if (!el || el.__zoneBound) return;
      el.__zoneBound = true;
      el.addEventListener('click', function () {
        if (zone === 'fitness') {
          setLastZone('fitness');
          location.href = buildZoneUrlWithFocus('fitness', 'jumpduck');
          return;
        }
        goZone(zone);
      });
    });

    [
      ['btnPlayHygiene', 'hygiene'],
      ['btnPlayNutrition', 'nutrition'],
      ['btnPlayFitness', 'fitness']
    ].forEach(([id, zone]) => {
      const el = $(id);
      if (!el || el.__playBound) return;
      el.__playBound = true;
      el.addEventListener('click', function () {
        setLastZone(zone);
      });
    });

    const resumeBtn = $('btnResumeNow');
    if (resumeBtn && !resumeBtn.__resumeBound) {
      resumeBtn.__resumeBound = true;
      resumeBtn.addEventListener('click', function () {
        const z = getLastZone() || 'fitness';
        if (z === 'fitness') {
          location.href = buildZoneUrlWithFocus('fitness', 'jumpduck');
          return;
        }
        goZone((z === 'hygiene' || z === 'nutrition' || z === 'fitness') ? z : 'fitness');
      });
    }

    const nextBtn = $('btnNextInZone');
    if (nextBtn && !nextBtn.__nextBound) {
      nextBtn.__nextBound = true;
      nextBtn.addEventListener('click', function () {
        const z = getNextZone() || getRecommendedZone() || 'fitness';
        if (z === 'fitness') {
          location.href = buildZoneUrlWithFocus('fitness', 'jumpduck');
          return;
        }
        goZone((z === 'hygiene' || z === 'nutrition' || z === 'fitness') ? z : 'fitness');
      });
    }

    const quickRecommended = $('btnQuickRecommended');
    if (quickRecommended && !quickRecommended.__bound) {
      quickRecommended.__bound = true;
      quickRecommended.addEventListener('click', function () {
        const z = getRecommendedZone() || 'fitness';
        if (z === 'fitness') {
          location.href = buildZoneUrlWithFocus('fitness', 'jumpduck');
          return;
        }
        goZone((z === 'hygiene' || z === 'nutrition' || z === 'fitness') ? z : 'fitness');
      });
    }

    const quickRecent = $('btnQuickRecent');
    if (quickRecent && !quickRecent.__bound) {
      quickRecent.__bound = true;
      quickRecent.addEventListener('click', function () {
        const z = getLastZone() || 'fitness';
        if (z === 'fitness') {
          location.href = buildZoneUrlWithFocus('fitness', 'jumpduck');
          return;
        }
        goZone((z === 'hygiene' || z === 'nutrition' || z === 'fitness') ? z : 'fitness');
      });
    }

    const quickAll = $('btnQuickAllGames');
    if (quickAll && !quickAll.__bound) {
      quickAll.__bound = true;
      quickAll.addEventListener('click', function () {
        const z = getRecommendedZone() || 'fitness';
        if (z === 'fitness') {
          location.href = buildZoneUrlWithFocus('fitness', 'jumpduck');
          return;
        }
        goZone((z === 'hygiene' || z === 'nutrition' || z === 'fitness') ? z : 'fitness');
      });
    }
  }

  function renderGoodJunkHubCard() {
    const snapshot = readGoodJunkHubSnapshot();

    const pct = Number(snapshot?.archive?.completionPct || 0);
    const hallRank = String(snapshot?.archive?.hallRank || 'Rookie');
    const rewardTitle = String(snapshot?.reward?.title || 'ยังไม่มี reward ล่าสุด');
    const rewardBadge = String(snapshot?.reward?.badge || '📚');
    const rivalLabel = String(snapshot?.rivalry?.label || '-');
    const deckTier = String(snapshot?.rivalry?.deckTier || '-');
    const targetLabel = String(snapshot?.target?.label || '-');
    const nextReason = String(snapshot?.nextPlan?.reason || 'เข้า Nutrition Zone แล้วค่อยเลือกเกมและโหมด');
    const recent = Array.isArray(snapshot?.archive?.recent) ? snapshot.archive.recent : [];

    setText('gjArchiveBadge', '📚 ' + hallRank);
    setText('gjArchiveReward', rewardBadge + ' ' + rewardTitle);
    setText('gjArchivePct', pct + '%');
    setText('gjHallRank', hallRank);
    setText('gjRivalArc', rivalLabel);
    setText('gjDeckTier', deckTier);
    setText('gjArchiveTarget', targetLabel || '-');
    setText('gjNextPlanTitle', 'Open Nutrition Zone');
    setText('gjNextPlanReason', nextReason);

    const fill = $('gjArchiveFill');
    if (fill) fill.style.width = pct + '%';

    setHtml(
      'gjNextPlanChips',
      [
        '<span class="gj-chip">Zone First</span>',
        '<span class="gj-chip">Then Game</span>',
        '<span class="gj-chip">Then Mode</span>'
      ].join('')
    );

    setHtml(
      'gjRecentChips',
      recent.length
        ? recent.slice(0, 8).map((x) => '<span class="gj-chip">' + x.group + ': ' + x.label + '</span>').join('')
        : '<span class="gj-chip">ยังไม่มี collection ล่าสุด</span>'
    );

    const nutritionZoneUrl = buildZoneUrl('nutrition');
    setHref('gjQuickRematchBtn', nutritionZoneUrl);
    setHref('gjOpenLauncherBtn', nutritionZoneUrl);

    const rematchBtn = $('gjQuickRematchBtn');
    if (rematchBtn && !rematchBtn.__bound) {
      rematchBtn.__bound = true;
      rematchBtn.addEventListener('click', function () {
        setLastZone('nutrition');
      });
    }

    const openBtn = $('gjOpenLauncherBtn');
    if (openBtn && !openBtn.__bound) {
      openBtn.__bound = true;
      openBtn.addEventListener('click', function () {
        setLastZone('nutrition');
      });
    }

    const clearBtn = $('gjClearSnapshotBtn');
    if (clearBtn && !clearBtn.__bound) {
      clearBtn.__bound = true;
      clearBtn.addEventListener('click', function () {
        clearGoodJunkHubSnapshot();
        renderGoodJunkHubCard();
      });
    }

    if (snapshot?.target?.label) {
      const featured = $('nutriFeatured');
      if (featured) featured.textContent = snapshot.target.label;
    }

    if (recent.length) {
      const recentPill = $('nutriRecentPill');
      const recentText = $('nutriRecentText');
      if (recentPill) recentPill.hidden = false;
      if (recentText) recentText.textContent = recent[0].label || '-';
    }
  }

  function renderJumpDuckHubPatch() {
    const fitUrl = buildZoneUrlWithFocus('fitness', 'jumpduck');
    const jumpduckSummary = readJumpDuckSummary();

    setHref('btnPlayFitness', fitUrl);

    const fitPlayBtn = $('btnPlayFitness');
    if (fitPlayBtn && !fitPlayBtn.__jumpduckBound) {
      fitPlayBtn.__jumpduckBound = true;
      fitPlayBtn.addEventListener('click', function () {
        setLastZone('fitness');
      });
    }

    const libraryBox = $('libraryBox');
    const summaryBox = $('summaryBox');
    const quickline = $('heroQuickline');
    const todayPlayedCount = $('todayPlayedCount');
    const todayZoneCount = $('todayZoneCount');
    const todayLastGame = $('todayLastGame');
    const todayNextGame = $('todayNextGame');
    const fitRecentPill = $('fitRecentPill');
    const fitRecentText = $('fitRecentText');
    const fitFeatured = $('fitFeatured');
    const fitProgressText = $('fitProgressText');
    const fitFill = $('fitFill');

    if (libraryBox) {
      libraryBox.innerHTML = `
        <div style="display:grid;gap:10px;">
          <a class="btn secondary small" data-zone-memory="hygiene" href="${buildZoneUrl('hygiene')}">🫧 Open Hygiene Zone</a>
          <a class="btn secondary small" data-zone-memory="nutrition" href="${buildZoneUrl('nutrition')}">🥗 Open Nutrition Zone</a>
          <a class="btn secondary small" data-zone-memory="fitness" href="${fitUrl}">🏃 Open Fitness Zone • JumpDuck</a>
        </div>
      `;
      bindZoneMemoryAnchors(libraryBox);
    }

    if (!jumpduckSummary) {
      if (fitFeatured) fitFeatured.textContent = 'Jump Duck';

      if (summaryBox) {
        summaryBox.innerHTML = `
          <div style="display:grid;gap:10px;">
            <div style="font-weight:1000;color:#4d4a42;">🏃 JumpDuck พร้อมแล้วใน Fitness Zone</div>
            <div style="font-size:13px;line-height:1.5;color:#7b7a72;font-weight:1000;">
              เข้า Fitness Zone ก่อน แล้วค่อยเลือก JumpDuck เพื่อคง flow แบบ zone-first
            </div>
            <a class="btn secondary small" data-zone-memory="fitness" href="${fitUrl}">🏃 Open Fitness Zone</a>
          </div>
        `;
        bindZoneMemoryAnchors(summaryBox);
      }

      if (quickline) quickline.textContent = 'วันนี้ลองเข้า Fitness Zone แล้วเล่น JumpDuck กันนะ';
      try {
        localStorage.setItem(RECOMMENDED_ZONE_KEY, 'fitness');
        localStorage.setItem(NEXT_ZONE_KEY, 'fitness');
      } catch (_) {}
      return;
    }

    const stars = Number(jumpduckSummary.stars || 0);
    const rhythm = Number(jumpduckSummary.rhythmAccuracy || 0);
    const jump = Number(jumpduckSummary.jumpSuccess || 0);
    const landing = Number(jumpduckSummary.landingControl || 0);
    const posts = Number(jumpduckSummary.postsCleared || 0);
    const score = Number(jumpduckSummary.score || 0);

    const progressPct = Math.max(20, Math.min(100, Math.round((posts / 7) * 100)));

    if (fitRecentPill) fitRecentPill.hidden = false;
    if (fitRecentText) fitRecentText.textContent = `JumpDuck • ${stars}⭐ • Rhythm ${rhythm}%`;
    if (fitFeatured) fitFeatured.textContent = 'Jump Duck';
    if (fitProgressText) fitProgressText.textContent = `${progressPct}%`;
    if (fitFill) fitFill.style.width = progressPct + '%';

    if (todayPlayedCount) {
      const n = Number(todayPlayedCount.textContent || 0);
      todayPlayedCount.textContent = String(Math.max(1, n || 0));
    }

    if (todayZoneCount) {
      const n = Number(todayZoneCount.textContent || 0);
      todayZoneCount.textContent = String(Math.max(1, n || 0));
    }

    if (todayLastGame && (!getLastZone() || getLastZone() === 'fitness')) {
      todayLastGame.textContent = 'JumpDuck';
    }

    if (todayNextGame) {
      todayNextGame.textContent = 'ไป Fitness Zone';
    }

    if (quickline) {
      quickline.textContent =
        stars >= 3
          ? 'JumpDuck วันนี้เก็บครบ 3 ดาวแล้ว เก่งมาก!'
          : `JumpDuck ล่าสุด: Rhythm ${rhythm}% • Landing ${landing}%`;
    }

    if (summaryBox) {
      summaryBox.innerHTML = `
        <div style="display:grid;gap:10px;">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
            <strong style="font-size:15px;color:#4d4a42;">🏃 JumpDuck ล่าสุด</strong>
            <span style="font-size:12px;font-weight:1000;color:#7b7a72;">${stars}⭐</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
            <div style="padding:10px;border-radius:14px;border:2px solid #d7edf7;background:#fff;">
              <div style="font-size:11px;color:#7b7a72;font-weight:1000;">Score</div>
              <div style="margin-top:4px;font-size:18px;font-weight:1000;color:#4d4a42;">${score}</div>
            </div>
            <div style="padding:10px;border-radius:14px;border:2px solid #d7edf7;background:#fff;">
              <div style="font-size:11px;color:#7b7a72;font-weight:1000;">Posts</div>
              <div style="margin-top:4px;font-size:18px;font-weight:1000;color:#4d4a42;">${posts}/7</div>
            </div>
            <div style="padding:10px;border-radius:14px;border:2px solid #d7edf7;background:#fff;">
              <div style="font-size:11px;color:#7b7a72;font-weight:1000;">Rhythm</div>
              <div style="margin-top:4px;font-size:18px;font-weight:1000;color:#4d4a42;">${rhythm}%</div>
            </div>
            <div style="padding:10px;border-radius:14px;border:2px solid #d7edf7;background:#fff;">
              <div style="font-size:11px;color:#7b7a72;font-weight:1000;">Landing</div>
              <div style="margin-top:4px;font-size:18px;font-weight:1000;color:#4d4a42;">${landing}%</div>
            </div>
          </div>

          <div style="font-size:13px;line-height:1.5;color:#7b7a72;font-weight:1000;">
            Jump ${jump}% • เข้า Fitness Zone เพื่อเล่นต่อหรือเก็บดาวเพิ่ม
          </div>

          <a class="btn secondary small" data-zone-memory="fitness" href="${fitUrl}">🏃 Open Fitness Zone</a>
        </div>
      `;
      bindZoneMemoryAnchors(summaryBox);
    }

    try {
      localStorage.setItem(RECOMMENDED_ZONE_KEY, 'fitness');
      if (!getNextZone()) localStorage.setItem(NEXT_ZONE_KEY, 'fitness');
    } catch (_) {}
  }

  function refreshTodayHints() {
    const lastZone = getLastZone();
    const nextZone = getNextZone() || getRecommendedZone();

    const todayZoneCount = $('todayZoneCount');
    const todayLastGame = $('todayLastGame');
    const todayNextGame = $('todayNextGame');

    if (todayZoneCount && lastZone) {
      todayZoneCount.textContent = '1';
    }

    if (todayLastGame && lastZone) {
      todayLastGame.textContent =
        lastZone === 'hygiene' ? 'Hygiene Zone' :
        lastZone === 'nutrition' ? 'Nutrition Zone' :
        lastZone === 'fitness' ? 'Fitness Zone' :
        'ยังไม่มี';
    }

    if (todayNextGame && nextZone) {
      todayNextGame.textContent =
        nextZone === 'hygiene' ? 'ไป Hygiene Zone' :
        nextZone === 'nutrition' ? 'ไป Nutrition Zone' :
        nextZone === 'fitness' ? 'ไป Fitness Zone' :
        todayNextGame.textContent;
    }
  }

  function boot() {
    stripZonePreview();
    bindZoneButtons();
    renderGoodJunkHubCard();
    renderJumpDuckHubPatch();
    refreshTodayHints();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  window.addEventListener('focus', boot);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) boot();
  });
})();