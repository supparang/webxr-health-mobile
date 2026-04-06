// === /herohealth/fitness-zone.jumpduck.patch.js ===
// Fitness Zone + JumpDuck featured hero / focus / action patch
// v20260406a-jd-fitness-zone-patch

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

  function setLastZone(zone) {
    try { localStorage.setItem(LAST_ZONE_KEY, zone); } catch (_) {}
  }

  function qget(key, fallback = '') {
    const v = qs.get(key);
    return (v == null || v === '') ? fallback : v;
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
    u.searchParams.set('featured', 'jumpduck');
    u.searchParams.set('focus', 'jumpduck');
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

  function bindZoneMemoryLinks(root) {
    if (!root) return;
    root.querySelectorAll('[data-zone-memory="fitness"]').forEach((el) => {
      if (el.__zoneMemoryBound) return;
      el.__zoneMemoryBound = true;
      el.addEventListener('click', function () {
        setLastZone('fitness');
      });
    });
  }

  function injectStyle() {
    if (document.getElementById('jdFitnessZonePatchStyle')) return;

    const style = document.createElement('style');
    style.id = 'jdFitnessZonePatchStyle';
    style.textContent = `
      .game-card[data-game-card="jumpduck"], #gameCard-jumpduck, .jumpduck-card{position:relative;overflow:hidden;scroll-margin-top:24px;}
      .game-card.jumpduck-featured, #gameCard-jumpduck.jumpduck-featured, .jumpduck-card.jumpduck-featured{
        border:3px solid #bfe8ff !important;
        background:radial-gradient(circle at top right, rgba(255,255,255,.7), transparent 24%), linear-gradient(180deg,#fffefb,#ffffff) !important;
        box-shadow:0 0 0 4px rgba(127,207,255,.16),0 22px 40px rgba(86,155,194,.14) !important;
      }
      .game-card-focus{
        border-color:#7fcfff !important;
        box-shadow:0 0 0 4px rgba(127,207,255,.24),0 18px 36px rgba(86,155,194,.16) !important;
        transform:translateY(-2px);
      }
      .jumpduck-ribbon{
        position:absolute;top:12px;right:12px;z-index:3;min-height:34px;padding:7px 12px;border-radius:999px;
        background:linear-gradient(180deg,#eefbff,#ffffff);border:2px solid #cdeeff;color:#2d6f8b;font-size:12px;font-weight:1000;
        display:inline-flex;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(86,155,194,.12);
      }
      .jumpduck-feature-box,.jumpduck-recent-box,.fitness-recommended-strip,.fitness-mission-strip{
        margin-top:10px;border-radius:18px;border:2px solid #d7edf7;background:linear-gradient(180deg,#fffef8,#fff);padding:12px;display:grid;gap:8px;
      }
      .jumpduck-feature-title,.fitness-strip-title{font-size:14px;font-weight:1000;color:#4d4a42;}
      .jumpduck-feature-sub,.fitness-strip-sub{font-size:13px;line-height:1.5;font-weight:1000;color:#7b7a72;}
      .jumpduck-tag-row{display:flex;gap:8px;flex-wrap:wrap;}
      .jumpduck-tag{min-height:28px;display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;border-radius:999px;background:#fff;border:2px solid #d7edf7;color:#5d6e7a;font-size:11px;font-weight:1000;}
      .jumpduck-action-grid,.fitness-mission-actions{margin-top:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .jumpduck-action-grid .btn,.jumpduck-action-grid a,.fitness-mission-actions .btn,.fitness-mission-actions a{
        min-height:42px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;text-align:center;
      }
      .jumpduck-action-grid .btn-wide{grid-column:1 / -1;}
      .jumpduck-recent-title{font-size:12px;font-weight:1000;color:#6a6a62;}
      .jumpduck-recent-grid,.fitness-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
      .jumpduck-recent-pill,.fitness-stat-pill,.fitness-mission-card{
        border-radius:14px;border:2px solid #d7edf7;background:#fff;padding:10px;
      }
      .jumpduck-recent-k,.fitness-stat-k{font-size:11px;color:#7b7a72;font-weight:1000;}
      .jumpduck-recent-v,.fitness-stat-v{margin-top:4px;font-size:17px;color:#4d4a42;font-weight:1000;}
      .fitness-hero-feature{
        margin-top:14px;border-radius:28px;border:3px solid #d7edf7;background:radial-gradient(circle at top right, rgba(255,255,255,.75), transparent 24%), linear-gradient(180deg,#fffef8,#ffffff);
        box-shadow:0 18px 36px rgba(86,155,194,.14);padding:16px;display:grid;grid-template-columns:1.2fr .8fr;gap:14px;align-items:center;overflow:hidden;
      }
      .fitness-hero-copy{display:grid;gap:10px;}
      .fitness-hero-kicker{font-size:12px;font-weight:1000;letter-spacing:.08em;color:#5ea8d0;}
      .fitness-hero-title{font-size:32px;line-height:1.02;font-weight:1000;color:#4d4a42;}
      .fitness-hero-sub{font-size:14px;line-height:1.6;color:#7b7a72;font-weight:1000;max-width:720px;}
      .fitness-hero-tags{display:flex;gap:8px;flex-wrap:wrap;}
      .fitness-hero-tag{min-height:30px;display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:#fff;border:2px solid #d7edf7;color:#5d6e7a;font-size:12px;font-weight:1000;}
      .fitness-hero-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .fitness-hero-actions .btn,.fitness-hero-actions a{min-height:44px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;}
      .fitness-hero-actions .wide{grid-column:1 / -1;}
      .fitness-hero-art{min-height:220px;border-radius:24px;border:2px dashed #d7edf7;background:linear-gradient(180deg,#bfe8ff 0%, #dcf6ff 42%, #eefed9 43%, #dff6d4 100%);position:relative;overflow:hidden;}
      .fitness-hero-art .lane{position:absolute;inset:16px 16px 24px 16px;border-radius:24px;border:2px dashed rgba(255,255,255,.45);background:linear-gradient(180deg, rgba(255,255,255,.25), rgba(255,255,255,.1)), linear-gradient(90deg, rgba(255,255,255,.25), rgba(255,255,255,.08));}
      .fitness-hero-art .beat{position:absolute;left:50%;transform:translateX(-50%);bottom:54px;width:min(320px,72%);height:14px;border-radius:999px;background:linear-gradient(90deg, rgba(255,255,255,.25), rgba(255,255,255,.95), rgba(255,255,255,.25));box-shadow:0 0 0 7px rgba(118,207,255,.22);}
      .fitness-hero-art .cue{position:absolute;top:22px;left:50%;transform:translateX(-50%);width:min(180px,60%);min-height:86px;border-radius:22px;border:3px solid rgba(255,255,255,.85);background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(245,252,255,.95));display:grid;place-items:center;text-align:center;box-shadow:0 16px 28px rgba(0,0,0,.12);font-weight:1000;}
      .fitness-hero-art .cue .emoji{font-size:34px;line-height:1;}
      .fitness-hero-art .cue .label{font-size:20px;margin-top:4px;line-height:1.1;}
      .fitness-hero-art .runner{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:130px;height:120px;filter:drop-shadow(0 12px 16px rgba(0,0,0,.08));}
      .fitness-hero-art .runner .head{position:absolute;left:50%;top:12px;transform:translateX(-50%);width:42px;height:42px;border-radius:50%;background:#fff0d0;border:3px solid rgba(77,74,67,.12);}
      .fitness-hero-art .runner .body{position:absolute;left:50%;top:48px;transform:translateX(-50%);width:58px;height:42px;border-radius:18px 18px 14px 14px;background:linear-gradient(180deg,#8fd6ff,#55b9f7);border:3px solid rgba(77,74,67,.09);}
      .fitness-strip-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;}
      .fitness-mission-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
      .fitness-mission-card strong{font-size:14px;color:#4d4a42;line-height:1.2;}
      .fitness-mission-card span{font-size:12px;color:#7b7a72;font-weight:1000;line-height:1.45;}
      @media (max-width:900px){
        .fitness-hero-feature{grid-template-columns:1fr;}
        .jumpduck-recent-grid,.fitness-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
        .fitness-mission-row{grid-template-columns:1fr;}
      }
      @media (max-width:640px){
        .fitness-hero-title{font-size:26px;}
        .fitness-hero-actions,.jumpduck-action-grid,.fitness-mission-actions{grid-template-columns:1fr;}
        .jumpduck-action-grid .btn-wide,.fitness-hero-actions .wide{grid-column:auto;}
        .jumpduck-ribbon{position:static;margin:0 0 10px auto;width:max-content;}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMount(id) {
    let node = document.getElementById(id);
    if (node) return node;

    node = document.createElement('section');
    node.id = id;

    const anchor =
      document.querySelector('.games-grid') ||
      document.querySelector('.game-grid') ||
      document.querySelector('.content') ||
      getJumpDuckCard()?.parentNode;

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(node, anchor);
    } else {
      document.body.appendChild(node);
    }
    return node;
  }

  function ensureJumpDuckCardEnhancements() {
    const card = getJumpDuckCard();
    if (!card) return;

    card.classList.add('jumpduck-featured');

    if (!card.querySelector('.jumpduck-ribbon')) {
      const ribbon = document.createElement('div');
      ribbon.className = 'jumpduck-ribbon';
      ribbon.textContent = '🎯 Featured from Hub';
      card.insertBefore(ribbon, card.firstChild);
    }

    if (!card.querySelector('.jumpduck-feature-box')) {
      const box = document.createElement('div');
      box.className = 'jumpduck-feature-box';
      box.innerHTML = `
        <div class="jumpduck-feature-title">JumpDuck • Rhythmic Jump Circuit</div>
        <div class="jumpduck-feature-sub">
          ฝึก jump + duck + landing + beat สำหรับเด็ก แบบอ่านง่ายและมีสรุปผลทักษะหลังเล่น
        </div>
        <div class="jumpduck-tag-row">
          <span class="jumpduck-tag">🥁 Rhythm</span>
          <span class="jumpduck-tag">⬆️ Jump</span>
          <span class="jumpduck-tag">⬇️ Duck</span>
          <span class="jumpduck-tag">✋ Landing Hold</span>
          <span class="jumpduck-tag">⭐ Summary</span>
        </div>
      `;

      const actions = card.querySelector('.actions') || card.querySelector('.game-actions');
      if (actions && actions.parentNode) {
        actions.parentNode.insertBefore(box, actions);
      } else {
        card.appendChild(box);
      }
    }

    if (!card.querySelector('.jumpduck-action-grid')) {
      const box = document.createElement('div');
      box.className = 'jumpduck-action-grid';
      box.innerHTML = `
        <a id="btnPlayJumpDuck" class="btn primary btn-wide" href="${buildJumpDuckLauncherUrl('play')}" data-zone-memory="fitness">▶ เล่น JumpDuck</a>
        <a id="btnQuickJumpDuck" class="btn secondary" href="${buildJumpDuckLauncherUrl('quick')}" data-zone-memory="fitness">⚡ Quick Play</a>
        <a id="btnResearchJumpDuck" class="btn secondary" href="${buildJumpDuckLauncherUrl('research')}" data-zone-memory="fitness">🧪 Research</a>
        <a id="btnDemoJumpDuck" class="btn secondary btn-wide" href="${buildJumpDuckLauncherUrl('demo')}" data-zone-memory="fitness">🎈 Demo 60s</a>
      `;

      const actions = card.querySelector('.actions') || card.querySelector('.game-actions');
      if (actions && actions.parentNode) {
        actions.parentNode.insertBefore(box, actions);
        actions.style.display = 'none';
      } else {
        card.appendChild(box);
      }
    }

    bindZoneMemoryLinks(card);
  }

  function renderJumpDuckRecentStrip() {
    const card = getJumpDuckCard();
    if (!card) return;

    const old = card.querySelector('.jumpduck-recent-box');
    if (old) old.remove();

    const s = readJumpDuckSummary();
    if (!s) return;

    const score = Number(s.score || 0);
    const stars = Number(s.stars || 0);
    const rhythm = Number(s.rhythmAccuracy || 0);
    const landing = Number(s.landingControl || 0);
    const posts = Number(s.postsCleared || 0);

    const box = document.createElement('div');
    box.className = 'jumpduck-recent-box';
    box.innerHTML = `
      <div class="jumpduck-recent-title">🕹️ JumpDuck ล่าสุด</div>
      <div class="jumpduck-recent-grid">
        <div class="jumpduck-recent-pill"><div class="jumpduck-recent-k">Stars</div><div class="jumpduck-recent-v">${stars}⭐</div></div>
        <div class="jumpduck-recent-pill"><div class="jumpduck-recent-k">Rhythm</div><div class="jumpduck-recent-v">${rhythm}%</div></div>
        <div class="jumpduck-recent-pill"><div class="jumpduck-recent-k">Landing</div><div class="jumpduck-recent-v">${landing}%</div></div>
        <div class="jumpduck-recent-pill"><div class="jumpduck-recent-k">Posts</div><div class="jumpduck-recent-v">${posts}/7</div></div>
      </div>
      <div style="font-size:13px;color:#7b7a72;font-weight:1000;">
        Score ${score} • เข้าเล่นต่อได้ทั้ง Play / Quick / Research / Demo
      </div>
    `;

    const actionBox = card.querySelector('.jumpduck-action-grid');
    if (actionBox && actionBox.parentNode) {
      actionBox.parentNode.insertBefore(box, actionBox);
    } else {
      card.appendChild(box);
    }
  }

  function renderHeroFeature() {
    const mount = ensureMount('fitnessHeroFeatureMount');
    mount.innerHTML = `
      <section class="fitness-hero-feature">
        <div class="fitness-hero-copy">
          <div class="fitness-hero-kicker">FITNESS FEATURED</div>
          <div class="fitness-hero-title">JumpDuck</div>
          <div class="fitness-hero-sub">
            เกมฝึก <strong>jump + duck + landing + beat</strong> สำหรับเด็ก
            แบบอ่านง่าย มี cue กลางจอ และมีสรุปผลทักษะหลังเล่น
          </div>

          <div class="fitness-hero-tags">
            <span class="fitness-hero-tag">🥁 Rhythm</span>
            <span class="fitness-hero-tag">⬆️ Jump</span>
            <span class="fitness-hero-tag">⬇️ Duck</span>
            <span class="fitness-hero-tag">✋ Landing Hold</span>
            <span class="fitness-hero-tag">⭐ Summary</span>
          </div>

          <div class="fitness-hero-actions">
            <a class="btn primary wide" data-zone-memory="fitness" href="${buildJumpDuckLauncherUrl('play')}">▶ เล่น JumpDuck</a>
            <a class="btn secondary" data-zone-memory="fitness" href="${buildJumpDuckLauncherUrl('quick')}">⚡ Quick Play</a>
            <a class="btn secondary" data-zone-memory="fitness" href="${buildJumpDuckLauncherUrl('research')}">🧪 Research</a>
          </div>
        </div>

        <div class="fitness-hero-art" aria-hidden="true">
          <div class="lane"></div>
          <div class="cue">
            <div>
              <div class="emoji">⬆️</div>
              <div class="label">Jump</div>
            </div>
          </div>
          <div class="beat"></div>
          <div class="runner">
            <div class="head"></div>
            <div class="body"></div>
          </div>
        </div>
      </section>
    `;
    bindZoneMemoryLinks(mount);
  }

  function renderRecommendedStrip() {
    const mount = ensureMount('fitnessRecommendedMount');
    const s = readJumpDuckSummary();

    if (!s) {
      mount.innerHTML = `
        <section class="fitness-recommended-strip">
          <div class="fitness-strip-head">
            <div class="fitness-strip-title">🏃 แนะนำให้เริ่มจาก JumpDuck</div>
            <div class="fitness-strip-sub">เหมาะกับการเริ่มเล่นใน Fitness Zone</div>
          </div>

          <div class="fitness-stat-grid">
            <div class="fitness-stat-pill"><div class="fitness-stat-k">Mode</div><div class="fitness-stat-v">Play</div></div>
            <div class="fitness-stat-pill"><div class="fitness-stat-k">Time</div><div class="fitness-stat-v">90s</div></div>
            <div class="fitness-stat-pill"><div class="fitness-stat-k">Focus</div><div class="fitness-stat-v">Rhythm</div></div>
            <div class="fitness-stat-pill"><div class="fitness-stat-k">Goal</div><div class="fitness-stat-v">7 Posts</div></div>
          </div>
        </section>
      `;
      return;
    }

    const score = Number(s.score || 0);
    const stars = Number(s.stars || 0);
    const rhythm = Number(s.rhythmAccuracy || 0);
    const landing = Number(s.landingControl || 0);

    mount.innerHTML = `
      <section class="fitness-recommended-strip">
        <div class="fitness-strip-head">
          <div class="fitness-strip-title">🕹️ JumpDuck ล่าสุด</div>
          <div class="fitness-strip-sub">${stars}⭐ • เล่นต่อได้ทันที</div>
        </div>

        <div class="fitness-stat-grid">
          <div class="fitness-stat-pill"><div class="fitness-stat-k">Score</div><div class="fitness-stat-v">${score}</div></div>
          <div class="fitness-stat-pill"><div class="fitness-stat-k">Rhythm</div><div class="fitness-stat-v">${rhythm}%</div></div>
          <div class="fitness-stat-pill"><div class="fitness-stat-k">Landing</div><div class="fitness-stat-v">${landing}%</div></div>
          <div class="fitness-stat-pill"><div class="fitness-stat-k">Stars</div><div class="fitness-stat-v">${stars}⭐</div></div>
        </div>
      </section>
    `;
  }

  function renderMissionStrip() {
    const mount = ensureMount('fitnessMissionMount');
    mount.innerHTML = `
      <section class="fitness-mission-strip">
        <div class="fitness-strip-head">
          <div class="fitness-strip-title">🎯 Quick Missions</div>
          <div class="fitness-strip-sub">เลือกแบบที่อยากเล่นได้เลย</div>
        </div>

        <div class="fitness-mission-row">
          <div class="fitness-mission-card">
            <strong>เริ่มแบบมาตรฐาน</strong>
            <span>warmup + game + summary + cooldown</span>
          </div>
          <div class="fitness-mission-card">
            <strong>ซ้อมเร็ว</strong>
            <span>เข้าเกมเลย ไม่ผ่าน warmup</span>
          </div>
          <div class="fitness-mission-card">
            <strong>สาธิตสั้น</strong>
            <span>easy • 60 วินาที • พร้อมสอนจังหวะ</span>
          </div>
        </div>

        <div class="fitness-mission-actions">
          <a class="btn primary" data-zone-memory="fitness" href="${buildJumpDuckLauncherUrl('play')}">▶ Standard Play</a>
          <a class="btn secondary" data-zone-memory="fitness" href="${buildJumpDuckLauncherUrl('quick')}">⚡ Quick Play</a>
          <a class="btn secondary" data-zone-memory="fitness" href="${buildJumpDuckLauncherUrl('demo')}">🎈 Demo 60s</a>
          <a class="btn secondary" data-zone-memory="fitness" href="${buildJumpDuckLauncherUrl('research')}">🧪 Research Run</a>
        </div>
      </section>
    `;
    bindZoneMemoryLinks(mount);
  }

  function focusJumpDuckFromHub() {
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
    }, 120);
  }

  function boot() {
    setLastZone('fitness');
    injectStyle();
    renderHeroFeature();
    renderRecommendedStrip();
    renderMissionStrip();
    ensureJumpDuckCardEnhancements();
    renderJumpDuckRecentStrip();
    focusJumpDuckFromHub();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('load', boot);
  window.addEventListener('focus', boot);
})();