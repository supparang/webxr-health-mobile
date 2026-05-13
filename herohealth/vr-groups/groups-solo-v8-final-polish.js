// === /herohealth/vr-groups/groups-solo-v8-final-polish.js ===
// HeroHealth Groups Solo — v8.7 Final Polish Pack
// Includes:
// v8.4 Mission Clarity
// v8.5 Summary Merge
// v8.6 Gameplay Feel
// v8.7 Final Guard + QA
// PATCH v20260513-GROUPS-SOLO-V87-FINAL-POLISH

(function () {
  'use strict';

  const VERSION = 'v8.7-final-polish-20260513';

  if (window.__HHA_GROUPS_SOLO_V87_FINAL_POLISH__) {
    console.warn('[GroupsSolo v8.7] already installed');
    return;
  }
  window.__HHA_GROUPS_SOLO_V87_FINAL_POLISH__ = true;

  const WIN = window;
  const DOC = document;

  const FOOD_GROUPS = [
    { id: 1, key: 'protein', label: 'โปรตีน', icon: '🐟', hint: 'เนื้อ นม ไข่ ถั่ว' },
    { id: 2, key: 'carb', label: 'ข้าว/แป้ง', icon: '🍚', hint: 'ข้าว แป้ง เผือก มัน' },
    { id: 3, key: 'veg', label: 'ผัก', icon: '🥦', hint: 'ผักหลากสี' },
    { id: 4, key: 'fruit', label: 'ผลไม้', icon: '🍎', hint: 'ผลไม้สด' },
    { id: 5, key: 'fat', label: 'ไขมัน', icon: '🥑', hint: 'ไขมันดี พอดี' }
  ];

  const state = {
    startedAt: 0,
    ended: false,
    playing: false,

    correct: 0,
    miss: 0,
    combo: 0,
    bestCombo: 0,
    missionDone: 0,
    bossCleared: false,
    bossMeter: 0,
    bonus: 0,
    decoyHit: 0,

    lastJudgeAt: 0,
    lastCoachAt: 0,
    lastFxAt: 0,
    lastSummaryAt: 0,
    lastMissionKey: '',

    summaryMounted: false,
    cleanupLoop: null
  };

  function qs(name, fallback = '') {
    try {
      const u = new URL(location.href);
      return u.searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function textOf(el) {
    return String(el ? el.textContent || '' : '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;

    const cs = getComputedStyle(el);
    if (
      cs.display === 'none' ||
      cs.visibility === 'hidden' ||
      Number(cs.opacity) === 0
    ) {
      return false;
    }

    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }

  function isGroupsPage() {
    const path = location.pathname.toLowerCase();
    const game = qs('game', 'groups').toLowerCase();
    const mode = qs('mode', 'solo').toLowerCase();

    return path.includes('groups') || game === 'groups' || mode === 'solo';
  }

  function summaryRoot() {
    const selectors = [
      '#summary',
      '.summary',
      '.result',
      '.result-screen',
      '.game-over',
      '.end-screen',
      '[data-summary]',
      '[data-screen="summary"]',
      '[data-state="ended"]'
    ];

    for (const sel of selectors) {
      const nodes = DOC.querySelectorAll(sel);
      for (const n of nodes) {
        if (!isVisible(n)) continue;

        const tx = textOf(n);

        if (
          tx.includes('สรุปผล') ||
          tx.includes('สรุปผลการเล่น') ||
          tx.includes('Hero Rank') ||
          tx.includes('Food Rookie') ||
          tx.includes('ความแม่นยำ') ||
          tx.includes('คอมโบสูงสุด') ||
          tx.includes('คะแนน')
        ) {
          return n;
        }
      }
    }

    const bodyText = textOf(DOC.body);

    if (
      bodyText.includes('สรุปผลการเล่น') &&
      (
        bodyText.includes('Hero Rank') ||
        bodyText.includes('ความแม่นยำ') ||
        bodyText.includes('คอมโบสูงสุด')
      )
    ) {
      return DOC.querySelector('main') || DOC.body;
    }

    return null;
  }

  function looksLikeSummary() {
    return Boolean(summaryRoot());
  }

  function buildNutritionZoneUrl() {
    const hub = qs('hub', '');

    if (hub && hub.includes('nutrition-zone.html')) {
      return hub;
    }

    const u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html');

    [
      'pid',
      'name',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup'
    ].forEach(function (k) {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('from', 'groups');
    u.searchParams.set(
      'hub',
      'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html'
    );

    return u.toString();
  }

  function injectStyle() {
    if (DOC.getElementById('hha-groups-v87-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-groups-v87-style';
    style.textContent = `
      :root{
        --hha-v87-safe-top: env(safe-area-inset-top, 0px);
        --hha-v87-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      body.hha-groups-v87{
        --hha-v87-blue:#62bfff;
        --hha-v87-green:#7ed957;
        --hha-v87-yellow:#ffd966;
        --hha-v87-pink:#ff9fd0;
        --hha-v87-text:#244e68;
        --hha-v87-card:rgba(255,255,255,.94);
      }

      /*
        ใช้ v8.7 mission panel ตัวเดียว ลดความรกจาก panel เดิม
      */
      body.hha-groups-v87-playing .hha-groups-v81-mission{
        display:none !important;
      }

      .hha-groups-v87-mission{
        position: fixed;
        left: 50%;
        bottom: calc(12px + var(--hha-v87-safe-bottom));
        transform: translateX(-50%);
        z-index: 99987;
        width: min(560px, calc(100vw - 22px));
        border-radius: 28px;
        padding: 10px 12px;
        background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(237,250,255,.92));
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 18px 48px rgba(35,81,107,.18);
        color: var(--hha-v87-text);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
        backdrop-filter: blur(12px);
        display: none;
      }

      body.hha-groups-v87-playing:not(.hha-groups-v87-ended) .hha-groups-v87-mission{
        display: block;
      }

      .hha-groups-v87-mission-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
      }

      .hha-groups-v87-mission-main{
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }

      .hha-groups-v87-mission-icon{
        width:42px;
        height:42px;
        border-radius:18px;
        display:grid;
        place-items:center;
        background:linear-gradient(145deg,#fff8c7,#ffffff);
        box-shadow:0 8px 18px rgba(35,81,107,.13);
        font-size:25px;
        flex:0 0 auto;
      }

      .hha-groups-v87-mission-text{
        min-width:0;
      }

      .hha-groups-v87-mission-title{
        font-size:15px;
        line-height:1.18;
        font-weight:1000;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-groups-v87-mission-hint{
        margin-top:2px;
        font-size:11px;
        line-height:1.2;
        font-weight:850;
        opacity:.76;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-groups-v87-mission-count{
        flex:0 0 auto;
        border-radius:999px;
        padding:8px 10px;
        background:rgba(255,217,102,.34);
        color:#6b4c00;
        font-size:13px;
        font-weight:1000;
      }

      .hha-groups-v87-bar{
        position:relative;
        height:10px;
        margin-top:8px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(98,191,255,.18);
      }

      .hha-groups-v87-bar > i{
        position:absolute;
        inset:0 auto 0 0;
        width:0%;
        border-radius:inherit;
        background:linear-gradient(90deg,var(--hha-v87-green),var(--hha-v87-yellow));
        transition:width .18s ease;
      }

      .hha-groups-v87-coach{
        position: fixed;
        left: 50%;
        top: calc(16px + var(--hha-v87-safe-top));
        transform: translateX(-50%);
        z-index: 99988;
        width: min(540px, calc(100vw - 22px));
        border-radius: 999px;
        padding: 10px 14px;
        background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,252,255,.92));
        box-shadow: 0 16px 42px rgba(35,81,107,.16);
        color: var(--hha-v87-text);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: clamp(12px, 2.8vw, 16px);
        font-weight: 1000;
        text-align:center;
        pointer-events:none;
        animation:hhaV87Coach 3.5s ease both;
      }

      .hha-groups-v87-fx{
        position: fixed;
        z-index: 99999;
        left: 50%;
        top: 50%;
        transform: translate(-50%,-50%);
        pointer-events:none;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: clamp(22px, 5vw, 42px);
        font-weight:1000;
        color: var(--hha-v87-text);
        text-shadow: 0 3px 0 rgba(255,255,255,.9), 0 12px 26px rgba(35,81,107,.18);
        animation:hhaV87Fx .72s ease-out both;
      }

      body.hha-groups-v87-shake{
        animation:hhaV87Shake .18s ease both;
      }

      .hha-groups-v87-summary{
        margin: 14px auto 0;
        width: min(620px, calc(100% - 18px));
        border-radius: 28px;
        padding: 14px;
        background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(238,250,255,.92));
        border: 2px solid rgba(255,255,255,.92);
        box-shadow: 0 18px 48px rgba(35,81,107,.16);
        color: var(--hha-v87-text);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .hha-groups-v87-summary h3{
        margin:0 0 10px;
        font-size: clamp(18px, 4vw, 26px);
        line-height:1.16;
        font-weight:1000;
        color:var(--hha-v87-text);
      }

      .hha-groups-v87-summary-grid{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:8px;
      }

      .hha-groups-v87-stat{
        border-radius:20px;
        padding:10px 8px;
        background:rgba(255,255,255,.72);
        box-shadow:inset 0 0 0 1px rgba(98,191,255,.13);
        text-align:center;
      }

      .hha-groups-v87-stat b{
        display:block;
        font-size:clamp(19px,4vw,30px);
        line-height:1;
        font-weight:1000;
      }

      .hha-groups-v87-stat span{
        display:block;
        margin-top:4px;
        font-size:11px;
        line-height:1.15;
        font-weight:850;
        opacity:.78;
      }

      .hha-groups-v87-summary-actions{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:8px;
        margin-top:12px;
      }

      .hha-groups-v87-btn{
        border:0;
        border-radius:999px;
        padding:11px 14px;
        font-weight:1000;
        font-size:13px;
        color:var(--hha-v87-text);
        background:#ffffff;
        box-shadow:0 12px 28px rgba(35,81,107,.15);
        cursor:pointer;
      }

      .hha-groups-v87-btn.primary{
        background:linear-gradient(135deg,#dff7ff,#ffffff);
      }

      .hha-groups-v87-btn.zone{
        background:linear-gradient(135deg,#e8ffd9,#ffffff);
      }

      body.hha-groups-v87-ended .hha-groups-v87-mission,
      body.hha-groups-v87-ended .hha-groups-v87-coach,
      body.hha-groups-v87-ended .hha-groups-v87-fx,
      body.hha-groups-v87-ended .hha-groups-v82-layer,
      body.hha-groups-v87-ended .hha-groups-v82-target,
      body.hha-groups-v87-ended [data-hha-v82-target="1"],
      body.hha-groups-v87-ended .hha-groups-v82-fx,
      body.hha-groups-v87-ended .hha-groups-v81-pop,
      body.hha-groups-v87-ended .hha-groups-v8-burst{
        display:none !important;
        opacity:0 !important;
        pointer-events:none !important;
        animation:none !important;
      }

      @media (max-width:640px){
        .hha-groups-v87-mission{
          bottom: calc(8px + var(--hha-v87-safe-bottom));
          border-radius:22px;
          padding:8px 9px;
        }

        .hha-groups-v87-mission-icon{
          width:36px;
          height:36px;
          border-radius:15px;
          font-size:22px;
        }

        .hha-groups-v87-mission-title{
          font-size:13px;
        }

        .hha-groups-v87-mission-hint{
          font-size:10px;
        }

        .hha-groups-v87-mission-count{
          font-size:11px;
          padding:7px 8px;
        }

        .hha-groups-v87-summary-grid{
          grid-template-columns:repeat(2, minmax(0,1fr));
        }
      }

      @keyframes hhaV87Coach{
        0%{opacity:0; transform:translateX(-50%) translateY(-10px);}
        14%{opacity:1; transform:translateX(-50%) translateY(0);}
        82%{opacity:1; transform:translateX(-50%) translateY(0);}
        100%{opacity:0; transform:translateX(-50%) translateY(-8px);}
      }

      @keyframes hhaV87Fx{
        0%{opacity:0; transform:translate(-50%,-45%) scale(.72);}
        20%{opacity:1; transform:translate(-50%,-70%) scale(1.14);}
        100%{opacity:0; transform:translate(-50%,-128%) scale(.92);}
      }

      @keyframes hhaV87Shake{
        0%{transform:translateX(0);}
        25%{transform:translateX(-2px);}
        50%{transform:translateX(2px);}
        100%{transform:translateX(0);}
      }
    `;

    DOC.head.appendChild(style);
    DOC.body.classList.add('hha-groups-v87');
  }

  function apiState(name) {
    try {
      const api = WIN[name];
      if (api && typeof api.getState === 'function') {
        return api.getState() || {};
      }
    } catch (e) {}
    return {};
  }

  function getMission() {
    const s81 = apiState('HHA_GROUPS_V81');
    const tuning = WIN.HHA_GROUPS_CORE_TUNING || {};

    const raw =
      s81.missionTarget ||
      tuning.mission ||
      apiState('HHA_GROUPS_V82').mission ||
      apiState('HHA_GROUPS_V83').mission ||
      null;

    if (raw && raw.key) {
      const found = FOOD_GROUPS.find(g => g.key === raw.key);
      if (found) {
        return {
          group: found,
          got: Number(raw.got ?? s81.missionGot ?? 0) || 0,
          need: Number(raw.need ?? s81.missionNeed ?? 3) || 3
        };
      }
    }

    const idx = Math.floor(Date.now() / 20000) % FOOD_GROUPS.length;

    return {
      group: FOOD_GROUPS[idx],
      got: 0,
      need: 3
    };
  }

  function isPlaying() {
    if (state.ended || looksLikeSummary()) return false;

    const s83 = apiState('HHA_GROUPS_V83');
    const s82 = apiState('HHA_GROUPS_V82');

    if (s83.playing && !s83.countdownActive) return true;
    if (s82.playing) return true;

    const cls = String(DOC.body.className || '').toLowerCase();

    return (
      cls.includes('hha-groups-v821-playing') ||
      cls.includes('hha-groups-v822-playing') ||
      cls.includes('hha-groups-v83-playing') ||
      cls.includes('playing')
    );
  }

  function ensureMissionPanel() {
    let panel = DOC.getElementById('hha-groups-v87-mission');
    if (panel) return panel;

    panel = DOC.createElement('div');
    panel.id = 'hha-groups-v87-mission';
    panel.className = 'hha-groups-v87-mission';
    panel.innerHTML = `
      <div class="hha-groups-v87-mission-top">
        <div class="hha-groups-v87-mission-main">
          <div class="hha-groups-v87-mission-icon" data-v87-mission-icon>🥗</div>
          <div class="hha-groups-v87-mission-text">
            <div class="hha-groups-v87-mission-title" data-v87-mission-title>ดูโจทย์ แล้วเก็บอาหารให้ถูกหมู่</div>
            <div class="hha-groups-v87-mission-hint" data-v87-mission-hint>หลบตัวหลอก เช่น ขนม น้ำหวาน ของทอด</div>
          </div>
        </div>
        <div class="hha-groups-v87-mission-count" data-v87-mission-count>0/3</div>
      </div>
      <div class="hha-groups-v87-bar"><i data-v87-mission-bar></i></div>
    `;

    DOC.body.appendChild(panel);
    return panel;
  }

  function updateMissionPanel() {
    const panel = ensureMissionPanel();

    const playing = isPlaying();
    state.playing = playing;

    DOC.body.classList.toggle('hha-groups-v87-playing', playing && !state.ended);

    if (!playing || state.ended) return;

    const mission = getMission();
    const g = mission.group;
    const got = clamp(mission.got, 0, mission.need);
    const need = Math.max(1, mission.need);
    const pct = clamp((got / need) * 100, 0, 100);

    const icon = panel.querySelector('[data-v87-mission-icon]');
    const title = panel.querySelector('[data-v87-mission-title]');
    const hint = panel.querySelector('[data-v87-mission-hint]');
    const count = panel.querySelector('[data-v87-mission-count]');
    const bar = panel.querySelector('[data-v87-mission-bar]');

    icon.textContent = g.icon;
    title.textContent = `เก็บหมู่ ${g.label}`;
    hint.textContent = `${g.hint} • หลบ 🍩 🥤 🍬`;
    count.textContent = `${got}/${need}`;
    bar.style.width = pct + '%';

    if (state.lastMissionKey && state.lastMissionKey !== g.key) {
      coach(`${g.icon} ภารกิจใหม่: เก็บหมู่ ${g.label}`);
    }

    state.lastMissionKey = g.key;
  }

  function coach(text, force) {
    if (state.ended || looksLikeSummary()) return;

    const now = Date.now();
    if (!force && now - state.lastCoachAt < 3600) return;
    state.lastCoachAt = now;

    const old = DOC.getElementById('hha-groups-v87-coach');
    if (old) old.remove();

    const el = DOC.createElement('div');
    el.id = 'hha-groups-v87-coach';
    el.className = 'hha-groups-v87-coach';
    el.textContent = text;

    DOC.body.appendChild(el);

    setTimeout(function () {
      el.remove();
    }, 3600);
  }

  function fx(text, x, y) {
    if (state.ended || looksLikeSummary()) return;

    const now = Date.now();
    if (now - state.lastFxAt < 90) return;
    state.lastFxAt = now;

    const el = DOC.createElement('div');
    el.className = 'hha-groups-v87-fx';
    el.textContent = text;
    el.style.left = Math.round(x || WIN.innerWidth / 2) + 'px';
    el.style.top = Math.round(y || WIN.innerHeight / 2) + 'px';

    DOC.body.appendChild(el);

    setTimeout(function () {
      el.remove();
    }, 780);
  }

  function shake() {
    if (state.ended || looksLikeSummary()) return;

    DOC.body.classList.remove('hha-groups-v87-shake');
    void DOC.body.offsetWidth;
    DOC.body.classList.add('hha-groups-v87-shake');

    setTimeout(function () {
      DOC.body.classList.remove('hha-groups-v87-shake');
    }, 220);
  }

  function collectApiMetrics() {
    const s81 = apiState('HHA_GROUPS_V81');
    const s82 = apiState('HHA_GROUPS_V82');

    const metrics = {
      correct: Math.max(
        Number(state.correct) || 0,
        Number(s82.correct) || 0,
        Number(s81.correct) || 0
      ),
      miss: Math.max(
        Number(state.miss) || 0,
        Number(s82.miss) || 0,
        Number(s81.miss) || 0
      ),
      combo: Math.max(
        Number(state.bestCombo) || 0,
        Number(s82.bestCombo) || 0,
        Number(s81.bestCombo) || 0
      ),
      bonus: Math.max(
        Number(state.bonus) || 0,
        Number(s82.scoreBonus) || 0,
        Number(s82.scoreBonusV82) || 0,
        Number(s81.scoreBonus) || 0
      ),
      missionDone: Math.max(
        Number(state.missionDone) || 0,
        Number(s81.missionDone) || 0
      ),
      bossMeter: Math.max(
        Number(state.bossMeter) || 0,
        Number(s81.bossMeter) || 0
      ),
      bossCleared: Boolean(state.bossCleared || s81.bossCleared),
      decoyHit: Math.max(
        Number(state.decoyHit) || 0,
        Number(s82.decoyHit) || 0,
        Number(s82.decoyHitV82) || 0
      )
    };

    try {
      const raw82 = JSON.parse(localStorage.getItem('HHA_GROUPS_V82_SUMMARY') || '{}');
      const sum82 = raw82.summary || {};

      metrics.correct = Math.max(metrics.correct, Number(sum82.correctV82) || 0);
      metrics.miss = Math.max(metrics.miss, Number(sum82.missV82) || 0);
      metrics.combo = Math.max(metrics.combo, Number(sum82.bestComboV82) || 0);
      metrics.bonus = Math.max(metrics.bonus, Number(sum82.scoreBonusV82) || 0);
      metrics.decoyHit = Math.max(metrics.decoyHit, Number(sum82.decoyHitV82) || 0);
    } catch (e) {}

    const total = Math.max(1, metrics.correct + metrics.miss);
    metrics.accuracy = Math.round((metrics.correct / total) * 100);

    if (metrics.accuracy >= 90 && metrics.combo >= 6) {
      metrics.rank = 'Food Hero';
      metrics.rankIcon = '🏆';
    } else if (metrics.accuracy >= 75) {
      metrics.rank = 'Smart Eater';
      metrics.rankIcon = '⭐';
    } else if (metrics.accuracy >= 55) {
      metrics.rank = 'Food Explorer';
      metrics.rankIcon = '🌱';
    } else {
      metrics.rank = 'Keep Trying';
      metrics.rankIcon = '💪';
    }

    return metrics;
  }

  function saveSummary(reason) {
    const metrics = collectApiMetrics();

    const summary = {
      ts: new Date().toISOString(),
      game: 'groups',
      mode: 'solo',
      patch: VERSION,
      reason: reason || 'summary',
      pid: qs('pid', 'anon'),
      diff: qs('diff', 'normal'),
      view: qs('view', ''),
      time: qs('time', ''),
      correct: metrics.correct,
      miss: metrics.miss,
      accuracy: metrics.accuracy,
      bestCombo: metrics.combo,
      bonus: metrics.bonus,
      missionDone: metrics.missionDone,
      bossMeter: metrics.bossMeter,
      bossCleared: metrics.bossCleared,
      decoyHit: metrics.decoyHit,
      rank: metrics.rank
    };

    try {
      localStorage.setItem('HHA_GROUPS_V87_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        ts: summary.ts,
        game: 'groups',
        mode: 'solo',
        summary
      }));
    } catch (e) {}

    return summary;
  }

  function cleanupFloating(reason) {
    [
      '.hha-groups-v82-target',
      '[data-hha-v82-target="1"]',
      '.hha-groups-v82-fx',
      '.hha-groups-v81-pop',
      '.hha-groups-v8-burst',
      '.hha-groups-v87-fx',
      '.hha-groups-v87-coach'
    ].forEach(function (sel) {
      DOC.querySelectorAll(sel).forEach(function (el) {
        try {
          clearTimeout(el.__hhaV82Timeout);
          el.remove();
        } catch (e) {}
      });
    });

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.killAllTargets === 'function') {
        WIN.HHA_GROUPS_V82.killAllTargets();
      }
    } catch (e) {}

    try {
      if (WIN.HHA_GROUPS_V82 && typeof WIN.HHA_GROUPS_V82.setEnabled === 'function') {
        WIN.HHA_GROUPS_V82.setEnabled(false);
      }
    } catch (e) {}

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v87:cleanup', {
        detail: {
          version: VERSION,
          reason: reason || 'cleanup'
        }
      }));
    } catch (e) {}
  }

  function markEnded(reason) {
    const now = Date.now();
    if (now - state.lastSummaryAt < 120 && state.ended) return;
    state.lastSummaryAt = now;

    state.ended = true;
    state.playing = false;

    DOC.body.classList.add('hha-groups-v87-ended');
    DOC.body.classList.remove('hha-groups-v87-playing');

    cleanupFloating(reason || 'end');
    saveSummary(reason || 'end');

    mountSummaryPanel(reason || 'end');

    clearInterval(state.cleanupLoop);
    state.cleanupLoop = setInterval(function () {
      cleanupFloating('post-end-loop');
      mountSummaryPanel('post-end-loop');
    }, 200);

    setTimeout(function () {
      clearInterval(state.cleanupLoop);
      state.cleanupLoop = null;
      cleanupFloating('post-end-final');
      mountSummaryPanel('post-end-final');
    }, 3200);
  }

  function mountSummaryPanel(reason) {
    const root = summaryRoot();
    if (!root) return;

    let panel = DOC.getElementById('hha-groups-v87-summary');

    const metrics = collectApiMetrics();
    const zoneUrl = buildNutritionZoneUrl();

    if (!panel) {
      panel = DOC.createElement('div');
      panel.id = 'hha-groups-v87-summary';
      panel.className = 'hha-groups-v87-summary';

      /*
        ถ้า root เป็น body ให้ append ได้เลย
        ถ้าเป็น summary card ให้แปะข้างใน เพื่อไม่ให้เป็น floating layer
      */
      root.appendChild(panel);
    }

    panel.innerHTML = `
      <h3>${metrics.rankIcon} สรุปเสริม Groups Solo</h3>

      <div class="hha-groups-v87-summary-grid">
        <div class="hha-groups-v87-stat">
          <b>${metrics.accuracy}%</b>
          <span>ความแม่นยำ</span>
        </div>
        <div class="hha-groups-v87-stat">
          <b>${metrics.combo}</b>
          <span>คอมโบสูงสุด</span>
        </div>
        <div class="hha-groups-v87-stat">
          <b>+${metrics.bonus}</b>
          <span>โบนัส</span>
        </div>
        <div class="hha-groups-v87-stat">
          <b>${metrics.missionDone}</b>
          <span>Mission Clear</span>
        </div>
        <div class="hha-groups-v87-stat">
          <b>${metrics.bossCleared ? 'Yes' : Math.round(metrics.bossMeter) + '%'}</b>
          <span>Boss Rush</span>
        </div>
        <div class="hha-groups-v87-stat">
          <b>${esc(metrics.rank)}</b>
          <span>Hero Rank</span>
        </div>
      </div>

      <div class="hha-groups-v87-summary-actions">
        <button type="button" class="hha-groups-v87-btn primary" data-v87-replay>🔁 เล่นอีกครั้ง</button>
        <button type="button" class="hha-groups-v87-btn zone" data-v87-zone>🥗 กลับ Nutrition Zone</button>
      </div>
    `;

    const replay = panel.querySelector('[data-v87-replay]');
    const zone = panel.querySelector('[data-v87-zone]');

    replay.addEventListener('click', function () {
      const u = new URL(location.href);
      u.searchParams.set('run', 'play');
      u.searchParams.set('mode', 'solo');
      u.searchParams.set('game', 'groups');
      u.searchParams.set('seed', String(Date.now()));
      location.href = u.toString();
    });

    zone.addEventListener('click', function () {
      try {
        WIN.dispatchEvent(new CustomEvent('hha:flush', {
          detail: {
            reason: 'groups-v87-return-zone',
            version: VERSION,
            summary: collectApiMetrics()
          }
        }));
      } catch (e) {}

      setTimeout(function () {
        location.href = zoneUrl;
      }, 80);
    });

    state.summaryMounted = true;

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v87:summary-ready', {
        detail: {
          version: VERSION,
          reason,
          metrics
        }
      }));
    } catch (e) {}
  }

  function onJudge(ok, detail) {
    const now = Date.now();
    if (now - state.lastJudgeAt < 70) return;
    state.lastJudgeAt = now;

    const d = detail || {};
    const p = d.point || d || {};
    const x = Number(p.x || p.clientX || WIN.innerWidth / 2);
    const y = Number(p.y || p.clientY || WIN.innerHeight / 2);

    if (ok) {
      state.correct += 1;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

      const gain = Number(d.bonus || 0);
      if (gain > 0) state.bonus = Math.max(state.bonus, gain);

      if (state.combo === 3) {
        coach('ดีมาก! เริ่มจำหมู่อาหารได้แล้ว');
      }

      if (state.combo === 5) {
        coach('🔥 Fever! แตะให้แม่น อย่าโดนตัวหลอก');
        fx('🔥 Fever!', x, y - 30);
      } else {
        fx('เยี่ยม!', x, y);
      }
    } else {
      state.miss += 1;
      state.combo = 0;

      if (String(d.reason || '').includes('decoy')) {
        state.decoyHit += 1;
        coach('ตัวหลอกมาแล้ว! ขนม น้ำหวาน ของทอด ให้หลบก่อน');
      } else {
        coach('ไม่เป็นไร ลองดูโจทย์ด้านล่างอีกครั้ง');
      }

      fx('ลองใหม่!', x, y);
      shake();
    }
  }

  function installEventHooks() {
    WIN.addEventListener('groups:v82:judge', function (ev) {
      const d = ev.detail || {};
      onJudge(Boolean(d.ok || d.correct || d.result === 'correct'), d);
    });

    WIN.addEventListener('hha:judge', function (ev) {
      const d = ev.detail || {};
      onJudge(Boolean(d.ok || d.correct || d.result === 'correct'), d);
    });

    WIN.addEventListener('groups:judge', function (ev) {
      const d = ev.detail || {};
      onJudge(Boolean(d.ok || d.correct || d.result === 'correct'), d);
    });

    WIN.addEventListener('groups:v81:mission-clear', function (ev) {
      state.missionDone += 1;
      state.bonus += 25;
      coach('⭐ Mission Clear! เปลี่ยนภารกิจต่อไป', true);
      fx('⭐ Mission Clear!', WIN.innerWidth / 2, WIN.innerHeight * 0.35);
    });

    WIN.addEventListener('groups:v81:boss-clear', function (ev) {
      state.bossCleared = true;
      state.bossMeter = 100;
      state.bonus += 50;
      coach('👑 Boss Clear! สุดยอดมาก', true);
      fx('👑 Boss Clear!', WIN.innerWidth / 2, WIN.innerHeight * 0.3);
    });

    [
      'groups:end',
      'hha:end',
      'game:end',
      'groups:summary',
      'hha:summary',
      'groups:v82:end',
      'groups:v83:end'
    ].forEach(function (name) {
      WIN.addEventListener(name, function () {
        markEnded(name);
      });
    });

    WIN.addEventListener('pagehide', function () {
      cleanupFloating('pagehide');
      saveSummary('pagehide');
    });

    DOC.addEventListener('visibilitychange', function () {
      if (DOC.hidden) {
        cleanupFloating('hidden');
        saveSummary('hidden');
      }
    });
  }

  function installTuningGuard() {
    const wait = setInterval(function () {
      const api = WIN.HHA_GROUPS_V81;
      if (!api || typeof api.getTuning !== 'function') return;

      clearInterval(wait);

      if (api.__HHA_V87_TUNING_PATCHED__) return;
      api.__HHA_V87_TUNING_PATCHED__ = true;

      const original = api.getTuning.bind(api);

      api.getTuning = function () {
        const t = Object.assign({}, original());

        if (state.ended || looksLikeSummary()) {
          t.spawnMs = 999999;
          t.fallSpeed = 0.1;
          t.distractorRate = 0;
          t.targetScale = 0.01;
          t.phase = 'ended';
          return t;
        }

        /*
          ปล่อย v8.3 เป็นตัวคุม ramp หลัก
          v8.7 แค่กันไม่ให้ช่วงแรกกลับมาเร็วเกินอีก
        */
        const s83 = apiState('HHA_GROUPS_V83');
        const sec = Number(s83.elapsedSec || 0);

        if (s83.playing && sec < 20) {
          t.spawnMs = Math.max(Number(t.spawnMs || 980), 1450);
          t.fallSpeed = Math.min(Number(t.fallSpeed || 1), 0.76);
          t.distractorRate = Math.min(Number(t.distractorRate || 0.22), 0.12);
        }

        WIN.HHA_GROUPS_V87_TUNING = Object.assign({}, t, {
          source: VERSION,
          summaryVisible: looksLikeSummary(),
          ended: state.ended
        });

        return t;
      };

      console.info('[GroupsSolo v8.7] tuning guard installed');
    }, 140);

    setTimeout(function () {
      clearInterval(wait);
    }, 7000);
  }

  function qaTick() {
    const summary = looksLikeSummary();

    if (summary && !state.ended) {
      markEnded('qa-summary-detected');
      return;
    }

    if (state.ended || summary) {
      cleanupFloating('qa-ended-clean');
      mountSummaryPanel('qa-ended-clean');
      return;
    }

    updateMissionPanel();

    const playing = isPlaying();
    DOC.body.classList.toggle('hha-groups-v87-playing', playing);
  }

  function publicApi() {
    WIN.HHA_GROUPS_V87 = {
      version: VERSION,
      getState: function () {
        return {
          version: VERSION,
          playing: isPlaying(),
          ended: state.ended,
          summaryVisible: looksLikeSummary(),
          metrics: collectApiMetrics(),
          mission: getMission()
        };
      },
      cleanup: cleanupFloating,
      end: markEnded,
      saveSummary: saveSummary,
      returnToNutritionZone: function () {
        location.href = buildNutritionZoneUrl();
      }
    };
  }

  function init() {
    if (!isGroupsPage()) return;

    injectStyle();
    ensureMissionPanel();
    installEventHooks();
    installTuningGuard();
    publicApi();

    setInterval(qaTick, 280);

    /*
      เปิดด้วยข้อความสั้น ๆ หลังเริ่มจริงเท่านั้น
      v8.3 จะคุม countdown อยู่แล้ว
    */
    setTimeout(function () {
      if (isPlaying() && !looksLikeSummary()) {
        coach('ดูภารกิจด้านล่าง แล้วเก็บอาหารให้ถูกหมู่', true);
      }
    }, 4500);

    if (looksLikeSummary()) {
      markEnded('init-summary');
    } else {
      cleanupFloating('init-clean');
    }

    console.info('[GroupsSolo v8.7] final polish installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();