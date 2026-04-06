// === /herohealth/fitness-zone.jumpduck.picker.patch.js ===
// Fitness Zone picker / recommended / recent integration for JumpDuck
// v20260406a-jd-fitness-picker-patch

(function () {
  'use strict';

  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const JUMPDUCK_SUMMARY_KEY = 'HHA_LAST_SUMMARY_JUMPDUCK';

  const qs = new URLSearchParams(location.search);

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

  function readJumpDuckSummary() {
    const jd = readJsonKey(JUMPDUCK_SUMMARY_KEY);
    if (jd && String(jd.game || '').toLowerCase() === 'jumpduck') return jd;

    const generic = readJsonKey(LAST_SUMMARY_KEY);
    if (generic && String(generic.game || '').toLowerCase() === 'jumpduck') return generic;

    return null;
  }

  function qget(key, fallback = '') {
    const v = qs.get(key);
    return (v == null || v === '') ? fallback : v;
  }

  function setLastZone(zone) {
    try { localStorage.setItem(LAST_ZONE_KEY, zone); } catch (_) {}
  }

  function buildJumpDuckLauncherUrl(mode) {
    const u = new URL('./jump-duck-vr.html', location.href);

    const passthroughKeys = [
      'pid', 'name', 'nickName', 'studyId',
      'run', 'diff', 'view', 'time', 'seed',
      'debug', 'api', 'log',
      'studentKey', 'schoolCode', 'classRoom', 'studentNo',
      'conditionGroup', 'sessionNo', 'weekNo'
    ];

    passthroughKeys.forEach((k) => {
      const v = qs.get(k);
      if (v != null && v !== '') u.searchParams.set(k, v);
    });

    if (!u.searchParams.get('pid')) u.searchParams.set('pid', 'anon');
    if (!u.searchParams.get('name')) u.searchParams.set('name', qget('nickName', 'Hero'));
    if (!u.searchParams.get('diff')) u.searchParams.set('diff', 'normal');
    if (!u.searchParams.get('view')) u.searchParams.set('view', 'mobile');
    if (!u.searchParams.get('time')) u.searchParams.set('time', '90');
    if (!u.searchParams.get('seed')) u.searchParams.set('seed', String(Date.now()));

    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('cat', 'fitness');
    u.searchParams.set('game', 'jumpduck');
    u.searchParams.set('gameId', 'jumpduck');
    u.searchParams.set('theme', 'jumpduck');
    u.searchParams.set('focus', 'jumpduck');
    u.searchParams.set('featured', 'jumpduck');
    u.searchParams.set('hub', location.href);

    if (mode === 'play') {
      u.searchParams.set('run', 'play');
      u.searchParams.set('gate', '1');
      u.searchParams.set('cooldown', '1');
      u.searchParams.set('returnPhase', 'cooldown');
    } else if (mode === 'quick') {
      u.searchParams.set('run', 'play');
      u.searchParams.set('gate', '0');
      u.searchParams.set('cooldown', '1');
      u.searchParams.set('returnPhase', 'cooldown');
    } else if (mode === 'research') {
      u.searchParams.set('run', 'research');
      u.searchParams.set('gate', '1');
      u.searchParams.set('cooldown', '1');
      u.searchParams.set('returnPhase', 'cooldown');
    } else if (mode === 'demo') {
      u.searchParams.set('run', 'demo');
      u.searchParams.set('diff', 'easy');
      u.searchParams.set('time', '60');
      u.searchParams.set('gate', '0');
      u.searchParams.set('cooldown', '0');
      u.searchParams.set('returnPhase', 'hub');
    }

    return u.toString();
  }

  function getJumpDuckCard() {
    return (
      document.getElementById('gameCard-jumpduck') ||
      document.querySelector('[data-game-card="jumpduck"]') ||
      document.querySelector('.jumpduck-card')
    );
  }

  function injectStyle() {
    if (document.getElementById('jdFitnessPickerPatchStyle')) return;

    const style = document.createElement('style');
    style.id = 'jdFitnessPickerPatchStyle';
    style.textContent = `
      .jd-picker-item{
        display:grid;
        gap:8px;
        padding:12px;
        border-radius:18px;
        border:2px solid #d7edf7;
        background:#fff;
      }
      .jd-picker-title{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }
      .jd-picker-title strong{
        font-size:15px;
        color:#4d4a42;
        line-height:1.2;
      }
      .jd-picker-badge{
        min-height:28px;
        padding:4px 10px;
        border-radius:999px;
        background:#eefbff;
        border:2px solid #cdeeff;
        color:#2d6f8b;
        font-size:11px;
        font-weight:1000;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }
      .jd-picker-sub{
        font-size:13px;
        line-height:1.5;
        color:#7b7a72;
        font-weight:1000;
      }
      .jd-picker-tags{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .jd-picker-tag{
        min-height:28px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:5px 10px;
        border-radius:999px;
        background:#fff;
        border:2px solid #d7edf7;
        color:#5d6e7a;
        font-size:11px;
        font-weight:1000;
      }
      .jd-picker-actions{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }
      .jd-picker-actions a{
        min-height:40px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        text-decoration:none;
        text-align:center;
        border-radius:14px;
        font-weight:1000;
      }
      .jd-picker-actions a.primary{
        background:linear-gradient(180deg,#7ed957,#58c33f);
        color:#173b0b;
      }
      .jd-picker-actions a.secondary{
        background:#fff;
        color:#6c6a61;
        border:2px solid #d7edf7;
      }

      .jd-recommended-card,
      .jd-recent-card{
        display:grid;
        gap:8px;
        padding:12px;
        border-radius:18px;
        border:2px solid #d7edf7;
        background:#fff;
      }
      .jd-recommended-head,
      .jd-recent-head{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }
      .jd-recommended-title,
      .jd-recent-title{
        font-size:15px;
        color:#4d4a42;
        font-weight:1000;
      }
      .jd-recommended-sub,
      .jd-recent-sub{
        font-size:13px;
        line-height:1.5;
        color:#7b7a72;
        font-weight:1000;
      }
      .jd-recent-stats{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }
      .jd-recent-stat{
        border-radius:12px;
        border:2px solid #d7edf7;
        background:#fff;
        padding:8px;
      }
      .jd-recent-stat-k{
        font-size:11px;
        color:#7b7a72;
        font-weight:1000;
      }
      .jd-recent-stat-v{
        margin-top:3px;
        font-size:15px;
        color:#4d4a42;
        font-weight:1000;
      }

      @media (max-width:720px){
        .jd-picker-actions{
          grid-template-columns:1fr;
        }
        .jd-recent-stats{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function bindFitnessLinks(root) {
    if (!root) return;
    root.querySelectorAll('[data-zone-memory="fitness"]').forEach((el) => {
      if (el.__zoneMemoryBound) return;
      el.__zoneMemoryBound = true;
      el.addEventListener('click', function () {
        setLastZone('fitness');
      });
    });
  }

  function createPickerItem() {
    const wrap = document.createElement('div');
    wrap.className = 'jd-picker-item';
    wrap.setAttribute('data-picker-jumpduck', '1');

    const summary = readJumpDuckSummary();
    const extra = summary
      ? `ล่าสุด ${Number(summary.stars || 0)}⭐ • Rhythm ${Number(summary.rhythmAccuracy || 0)}%`
      : 'เหมาะกับการเริ่มเล่นใน Fitness Zone';

    wrap.innerHTML = `
      <div class="jd-picker-title">
        <strong>🏃 JumpDuck</strong>
        <span class="jd-picker-badge">Featured</span>
      </div>

      <div class="jd-picker-sub">
        Rhythmic Jump Circuit • jump + duck + landing + beat • ${extra}
      </div>

      <div class="jd-picker-tags">
        <span class="jd-picker-tag">🥁 Rhythm</span>
        <span class="jd-picker-tag">⬆️ Jump</span>
        <span class="jd-picker-tag">⬇️ Duck</span>
        <span class="jd-picker-tag">✋ Landing</span>
      </div>

      <div class="jd-picker-actions">
        <a class="primary" href="${buildJumpDuckLauncherUrl('play')}" data-zone-memory="fitness">▶ Play</a>
        <a class="secondary" href="${buildJumpDuckLauncherUrl('quick')}" data-zone-memory="fitness">⚡ Quick</a>
        <a class="secondary" href="${buildJumpDuckLauncherUrl('research')}" data-zone-memory="fitness">🧪 Research</a>
        <a class="secondary" href="${buildJumpDuckLauncherUrl('demo')}" data-zone-memory="fitness">🎈 Demo</a>
      </div>
    `;

    bindFitnessLinks(wrap);
    return wrap;
  }

  function patchPickerList() {
    const pickerList =
      document.getElementById('pickerList') ||
      document.querySelector('.picker-list') ||
      document.querySelector('[data-picker-list]');

    if (!pickerList) return;
    if (pickerList.querySelector('[data-picker-jumpduck="1"]')) return;

    pickerList.prepend(createPickerItem());
  }

  function patchRecommendedArea() {
    const host =
      document.getElementById('recommendedBox') ||
      document.getElementById('recommendedList') ||
      document.querySelector('.recommended-box') ||
      document.querySelector('.recommended-list') ||
      document.querySelector('[data-recommended-list]');

    if (!host) return;

    const old = host.querySelector('[data-jd-recommended="1"]');
    if (old) old.remove();

    const card = document.createElement('div');
    card.className = 'jd-recommended-card';
    card.setAttribute('data-jd-recommended', '1');
    card.innerHTML = `
      <div class="jd-recommended-head">
        <div class="jd-recommended-title">🎯 แนะนำ: JumpDuck</div>
        <span class="jd-picker-badge">Fitness Featured</span>
      </div>

      <div class="jd-recommended-sub">
        เริ่มเล่นแบบมาตรฐาน หรือกด Quick Play ได้ทันทีจากที่นี่
      </div>

      <div class="jd-picker-actions">
        <a class="primary" href="${buildJumpDuckLauncherUrl('play')}" data-zone-memory="fitness">▶ Standard Play</a>
        <a class="secondary" href="${buildJumpDuckLauncherUrl('quick')}" data-zone-memory="fitness">⚡ Quick Play</a>
      </div>
    `;

    host.prepend(card);
    bindFitnessLinks(card);
  }

  function patchRecentArea() {
    const host =
      document.getElementById('recentBox') ||
      document.getElementById('recentList') ||
      document.querySelector('.recent-box') ||
      document.querySelector('.recent-list') ||
      document.querySelector('[data-recent-list]');

    if (!host) return;

    const old = host.querySelector('[data-jd-recent="1"]');
    if (old) old.remove();

    const s = readJumpDuckSummary();
    if (!s) return;

    const stars = Number(s.stars || 0);
    const rhythm = Number(s.rhythmAccuracy || 0);
    const landing = Number(s.landingControl || 0);
    const posts = Number(s.postsCleared || 0);

    const card = document.createElement('div');
    card.className = 'jd-recent-card';
    card.setAttribute('data-jd-recent', '1');
    card.innerHTML = `
      <div class="jd-recent-head">
        <div class="jd-recent-title">🕹️ JumpDuck ล่าสุด</div>
        <span class="jd-picker-badge">${stars}⭐</span>
      </div>

      <div class="jd-recent-sub">
        เล่นต่อจากผลล่าสุดได้ทันที
      </div>

      <div class="jd-recent-stats">
        <div class="jd-recent-stat">
          <div class="jd-recent-stat-k">Rhythm</div>
          <div class="jd-recent-stat-v">${rhythm}%</div>
        </div>
        <div class="jd-recent-stat">
          <div class="jd-recent-stat-k">Landing</div>
          <div class="jd-recent-stat-v">${landing}%</div>
        </div>
        <div class="jd-recent-stat">
          <div class="jd-recent-stat-k">Posts</div>
          <div class="jd-recent-stat-v">${posts}/7</div>
        </div>
        <div class="jd-recent-stat">
          <div class="jd-recent-stat-k">Stars</div>
          <div class="jd-recent-stat-v">${stars}⭐</div>
        </div>
      </div>

      <div class="jd-picker-actions">
        <a class="primary" href="${buildJumpDuckLauncherUrl('play')}" data-zone-memory="fitness">▶ เล่นต่อ</a>
        <a class="secondary" href="${buildJumpDuckLauncherUrl('demo')}" data-zone-memory="fitness">🎈 Demo</a>
      </div>
    `;

    host.prepend(card);
    bindFitnessLinks(card);
  }

  function patchToolbarButtons() {
    const mappings = [
      ['btnQuickRecommended', 'play'],
      ['btnQuickRecent', 'play'],
      ['btnQuickAllGames', 'quick']
    ];

    mappings.forEach(([id, mode]) => {
      const el = document.getElementById(id);
      if (!el || el.__jdToolbarBound) return;

      el.__jdToolbarBound = true;
      el.addEventListener('click', function (e) {
        const inFitnessPage =
          /fitness-zone/i.test(location.pathname) ||
          document.body?.dataset?.zone === 'fitness';

        if (!inFitnessPage) return;

        e.preventDefault();
        setLastZone('fitness');
        location.href = buildJumpDuckLauncherUrl(mode);
      });
    });
  }

  function patchFallbackLibrary() {
    const host =
      document.getElementById('libraryBox') ||
      document.querySelector('.library-box') ||
      document.querySelector('[data-library-box]');

    if (!host) return;
    if (host.querySelector('[data-jd-library="1"]')) return;

    const box = document.createElement('div');
    box.className = 'jd-picker-item';
    box.setAttribute('data-jd-library', '1');
    box.innerHTML = `
      <div class="jd-picker-title">
        <strong>🏃 JumpDuck</strong>
        <span class="jd-picker-badge">Quick Access</span>
      </div>

      <div class="jd-picker-sub">
        เข้าเล่น JumpDuck ได้โดยตรงจาก library ของ Fitness Zone
      </div>

      <div class="jd-picker-actions">
        <a class="primary" href="${buildJumpDuckLauncherUrl('play')}" data-zone-memory="fitness">▶ Play</a>
        <a class="secondary" href="${buildJumpDuckLauncherUrl('quick')}" data-zone-memory="fitness">⚡ Quick</a>
      </div>
    `;

    host.prepend(box);
    bindFitnessLinks(box);
  }

  function focusJumpDuckCardIfNeeded() {
    const focus = String(qget('focus', '') || qget('featured', '')).toLowerCase();
    if (focus !== 'jumpduck') return;

    const card = getJumpDuckCard();
    if (!card) return;

    card.classList.add('game-card-focus');
    setTimeout(() => {
      try {
        card.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      } catch (_) {}
    }, 160);
  }

  function boot() {
    injectStyle();
    patchPickerList();
    patchRecommendedArea();
    patchRecentArea();
    patchToolbarButtons();
    patchFallbackLibrary();
    focusJumpDuckCardIfNeeded();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  window.addEventListener('focus', boot);
})();