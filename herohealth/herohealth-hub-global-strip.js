// === /herohealth/herohealth-hub-global-strip.js ===
// HeroHealth Hub Global Profile Strip
// PATCH v20260320l-HEROHEALTH-HUB-GLOBAL-STRIP

(() => {
  'use strict';

  const FIXED_HUB_URL = 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';

  boot();

  function boot() {
    ensureStyles();
    renderStrip();
  }

  function ensureStyles() {
    if (document.getElementById('hh-global-strip-style')) return;

    const style = document.createElement('style');
    style.id = 'hh-global-strip-style';
    style.textContent = `
      #hh-global-strip{
        width:min(1180px, calc(100vw - 24px));
        margin:0 auto 16px;
        border-radius:26px;
        background:
          radial-gradient(circle at top right, rgba(76,201,255,.10), transparent 26%),
          radial-gradient(circle at left center, rgba(255,212,92,.08), transparent 24%),
          linear-gradient(180deg, rgba(6,20,38,.96), rgba(8,28,49,.94));
        border:1px solid rgba(148,163,184,.16);
        color:#eef8ff;
        box-shadow:0 18px 42px rgba(0,0,0,.18);
        overflow:hidden;
      }
      #hh-global-strip .hhgs-inner{
        padding:14px 16px;
        display:grid;
        gap:12px;
      }
      #hh-global-strip .hhgs-top{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        flex-wrap:wrap;
      }
      #hh-global-strip .hhgs-title{
        font:1000 18px/1.15 "Noto Sans Thai",system-ui,sans-serif;
        margin-bottom:6px;
      }
      #hh-global-strip .hhgs-sub{
        color:#cfe7f9;
        font:800 12px/1.55 "Noto Sans Thai",system-ui,sans-serif;
      }
      #hh-global-strip .hhgs-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      #hh-global-strip .hhgs-btn{
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
      #hh-global-strip .hhgs-btn.primary{
        background:linear-gradient(180deg,#56d3ff,#1ca6df);
        color:#042033;
      }
      #hh-global-strip .hhgs-btn.ghost{
        background:rgba(255,255,255,.06);
        border:1px solid rgba(148,163,184,.14);
        color:#eef8ff;
      }
      #hh-global-strip .hhgs-chip-row{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      #hh-global-strip .hhgs-chip{
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
      #hh-global-strip .hhgs-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
      }
      #hh-global-strip .hhgs-box{
        min-height:84px;
        padding:12px;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.12);
        background:rgba(255,255,255,.05);
      }
      #hh-global-strip .hhgs-box-title{
        font:1000 12px/1.1 "Noto Sans Thai",system-ui,sans-serif;
        color:#dff3ff;
        margin-bottom:6px;
      }
      #hh-global-strip .hhgs-box-body{
        font:800 12px/1.55 "Noto Sans Thai",system-ui,sans-serif;
        color:#cce6f7;
      }
      #hh-global-strip .hhgs-list{
        display:grid;
        gap:4px;
      }
      @media (max-width: 980px){
        #hh-global-strip .hhgs-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }
      @media (max-width: 720px){
        #hh-global-strip .hhgs-grid{
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderStrip() {
    const summaries = collectHeroHealthSummaries();
    const stats = computeStats(summaries);
    const hydration = buildHydrationContinueInfo();

    const strip = document.createElement('section');
    strip.id = 'hh-global-strip';

    strip.innerHTML = `
      <div class="hhgs-inner">
        <div class="hhgs-top">
          <div>
            <div class="hhgs-title">🌟 HeroHealth Progress Overview</div>
            <div class="hhgs-sub">
              สรุปจาก localStorage ของเกมที่เคยเล่นไว้บนอุปกรณ์นี้ • ใช้ดูภาพรวมก่อนเข้าเล่นต่อ
            </div>
          </div>

          <div class="hhgs-actions">
            <a class="hhgs-btn primary" href="${escapeHtmlAttr(hydration.launcherUrl)}">▶ Continue Hydration V2</a>
            <a class="hhgs-btn ghost" href="${escapeHtmlAttr(FIXED_HUB_URL)}">🏠 Refresh Hub</a>
          </div>
        </div>

        <div class="hhgs-chip-row">
          <span class="hhgs-chip">🎮 วันนี้ ${stats.todayRuns} รอบ</span>
          <span class="hhgs-chip">🧩 เล่นแล้ว ${stats.totalRuns} summaries</span>
          <span class="hhgs-chip">🗂 ${stats.uniqueGames} เกม</span>
          <span class="hhgs-chip">🗺 ${stats.uniqueZones} โซน</span>
          <span class="hhgs-chip">⏱ ล่าสุด ${escapeHtml(stats.latestWhen)}</span>
        </div>

        <div class="hhgs-grid">
          <div class="hhgs-box">
            <div class="hhgs-box-title">Latest Game</div>
            <div class="hhgs-box-body">
              ${stats.latestGame
                ? `• ${escapeHtml(stats.latestGame.title)}<br/>• zone ${escapeHtml(stats.latestGame.zone || '-')}<br/>• score ${escapeHtml(String(stats.latestGame.score || 0))}`
                : '• ยังไม่พบ summary ของเกม'}
            </div>
          </div>

          <div class="hhgs-box">
            <div class="hhgs-box-title">Zone Activity</div>
            <div class="hhgs-box-body hhgs-list">
              ${stats.zoneLines.length
                ? stats.zoneLines.map(line => `<div>• ${escapeHtml(line)}</div>`).join('')
                : '<div>• ยังไม่พบข้อมูลโซน</div>'}
            </div>
          </div>

          <div class="hhgs-box">
            <div class="hhgs-box-title">Recent Games</div>
            <div class="hhgs-box-body hhgs-list">
              ${stats.recentGames.length
                ? stats.recentGames.map(line => `<div>• ${escapeHtml(line)}</div>`).join('')
                : '<div>• ยังไม่มี recent games</div>'}
            </div>
          </div>

          <div class="hhgs-box">
            <div class="hhgs-box-title">Continue Reason</div>
            <div class="hhgs-box-body">
              ${hydration.reasonHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    const insertPoint = findHubInsertPoint();
    if (insertPoint) {
      insertPoint.parentNode.insertBefore(strip, insertPoint);
    } else {
      document.body.prepend(strip);
    }
  }

  function collectHeroHealthSummaries() {
    const out = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;

      let value = null;
      try {
        value = JSON.parse(localStorage.getItem(key));
      } catch (_) {
        continue;
      }

      if (!value) continue;

      if (Array.isArray(value)) {
        value.forEach((item) => {
          const mapped = normalizeSummary(item, key);
          if (mapped) out.push(mapped);
        });
      } else {
        const mapped = normalizeSummary(value, key);
        if (mapped) out.push(mapped);
      }
    }

    out.sort((a, b) => b.savedAtMs - a.savedAtMs);

    const dedup = [];
    const seen = new Set();

    out.forEach((item) => {
      const sig = `${item.key}|${item.savedAtMs}|${item.title}|${item.zone}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      dedup.push(item);
    });

    return dedup.slice(0, 120);
  }

  function normalizeSummary(v, key) {
    if (!v || typeof v !== 'object') return null;

    const gameId = firstNonEmpty(
      v.gameId,
      v.game,
      v.gameKey,
      v.theme,
      ''
    );
    const zone = firstNonEmpty(
      v.zone,
      inferZoneFromGameId(gameId),
      ''
    );
    const savedAt = firstNonEmpty(
      v.savedAt,
      v.ts_iso,
      v.startedAt,
      ''
    );

    const title = humanizeGameTitle(gameId || firstNonEmpty(v.title, v.name, ''));

    const score = finiteNum(
      v.totalScore,
      v.scoreFinal,
      v.score,
      v.actionScore,
      0
    );

    const looksHeroHealth =
      !!gameId ||
      !!zone ||
      key.includes('HHA_') ||
      key.includes('HeroHealth') ||
      key.includes('herohealth');

    if (!looksHeroHealth) return null;

    return {
      key,
      gameId: gameId || '',
      zone: zone || '',
      title: title || 'HeroHealth Item',
      score,
      savedAt: savedAt || '',
      savedAtMs: toMs(savedAt),
      raw: v
    };
  }

  function computeStats(items) {
    const today = todayLocalKey();
    const todayRuns = items.filter(x => x.savedAt.startsWith(today)).length;

    const uniqueGames = new Set(items.map(x => x.gameId || x.title).filter(Boolean)).size;
    const uniqueZones = new Set(items.map(x => x.zone).filter(Boolean)).size;

    const latest = items[0] || null;
    const zoneCount = {};
    items.forEach((x) => {
      const z = x.zone || 'other';
      zoneCount[z] = (zoneCount[z] || 0) + 1;
    });

    const zoneLines = Object.entries(zoneCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([z, n]) => `${z} • ${n} runs`);

    const recentGames = items.slice(0, 4).map((x) => {
      const when = x.savedAt ? shortDate(x.savedAt) : '-';
      return `${x.title} • ${when}`;
    });

    return {
      totalRuns: items.length,
      todayRuns,
      uniqueGames,
      uniqueZones,
      latestWhen: latest?.savedAt ? shortDate(latest.savedAt) : 'ยังไม่มี',
      latestGame: latest ? {
        title: latest.title,
        zone: latest.zone,
        score: latest.score
      } : null,
      zoneLines,
      recentGames
    };
  }

  function buildHydrationContinueInfo() {
    const lastResearch = readJson('HHA_HYDRATION_V2_RESEARCH_LAST', null);
    const lastSummary = readJson('HHA_LAST_SUMMARY', null);

    const pid = firstNonEmpty(lastResearch?.pid, lastSummary?.pid, 'anon');
    const studyId = firstNonEmpty(lastResearch?.studyId, lastSummary?.studyId, 'nostudy');
    const sessionNo = positiveInt(lastSummary?.nextSessionNo) ||
      (positiveInt(lastResearch?.sessionNo) ? positiveInt(lastResearch.sessionNo) + 1 : 1);
    const weekNo = positiveInt(lastSummary?.nextWeekNo) || deriveWeekNo(sessionNo);

    const launcherUrl = new URL('./hydration-v2.html', location.href);
    launcherUrl.searchParams.set('pid', pid);
    launcherUrl.searchParams.set('studyId', studyId);
    launcherUrl.searchParams.set('mode', firstNonEmpty(lastResearch?.mode, lastSummary?.mode, 'quick'));
    launcherUrl.searchParams.set('type', firstNonEmpty(lastResearch?.type, lastSummary?.type, 'solo'));
    launcherUrl.searchParams.set('run', firstNonEmpty(lastResearch?.run, lastSummary?.run, 'play'));
    launcherUrl.searchParams.set('diff', firstNonEmpty(lastResearch?.diff, lastSummary?.diff, 'normal'));
    launcherUrl.searchParams.set('session', String(sessionNo));
    launcherUrl.searchParams.set('week', String(weekNo));
    launcherUrl.searchParams.set('seed', String(Date.now()));
    launcherUrl.searchParams.set('hub', FIXED_HUB_URL);

    const lines = [];

    if (lastSummary?.finalChallengeCleared === false && lastSummary?.finalChallengeLabel) {
      lines.push(`• บอสล่าสุดยังไม่ผ่าน: ${String(lastSummary.finalChallengeLabel)}`);
    }

    if (positiveInt(lastSummary?.missionBonusScore) < 20) {
      lines.push('• ลองอีกรอบเพื่อเก็บ Daily Mission เพิ่ม');
    }

    if (positiveInt(lastSummary?.rewardCount) < 3) {
      lines.push(`• reward ล่าสุด ${positiveInt(lastSummary?.rewardCount)} ชิ้น • ยังมีลุ้นปลดล็อกเพิ่ม`);
    }

    if (!lines.length) {
      lines.push(`• Continue W${weekNo} S${sessionNo}`);
      lines.push('• กลับมาเล่นเพื่อสะสม progress ต่อ');
    }

    return {
      launcherUrl: launcherUrl.toString(),
      reasonHtml: lines.map(x => escapeHtml(x)).join('<br/>')
    };
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

  function inferZoneFromGameId(gameId) {
    const id = String(gameId || '').toLowerCase();
    if (!id) return '';
    if (id.includes('hydration') || id.includes('plate') || id.includes('group') || id.includes('goodjunk')) return 'nutrition';
    if (id.includes('brush') || id.includes('bath') || id.includes('germ') || id.includes('mask') || id.includes('handwash') || id.includes('clean')) return 'hygiene';
    if (id.includes('shadow') || id.includes('rhythm') || id.includes('jump') || id.includes('balance') || id.includes('fitness')) return 'fitness';
    return '';
  }

  function humanizeGameTitle(v) {
    const raw = String(v || '').trim();
    if (!raw) return '';
    const map = {
      hydration: 'Hydration',
      goodjunk: 'GoodJunk',
      groups: 'Food Groups',
      plate: 'Balanced Plate',
      rhythmboxer: 'Rhythm Boxer',
      shadowbreaker: 'Shadow Breaker',
      jumpduck: 'Jump & Duck',
      balancehold: 'Balance Hold',
      fitnessplanner: 'Fitness Planner'
    };
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    return map[key] || raw.replace(/[-_]/g, ' ');
  }

  function firstNonEmpty(...values) {
    for (const v of values) {
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return '';
  }

  function finiteNum(...values) {
    for (const v of values) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  function toMs(value) {
    if (!value) return 0;
    const n = Date.parse(value);
    return Number.isFinite(n) ? n : 0;
  }

  function shortDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value || '-');
    return d.toLocaleString('th-TH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function deriveWeekNo(sessionNo) {
    const s = positiveInt(sessionNo) || 1;
    return Math.max(1, Math.floor((s - 1) / 2) + 1);
  }

  function todayLocalKey() {
    const d = new Date();
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