// === /herohealth/vr-groups/groups-mobile-final-polish-v103.js ===
// HeroHealth Groups Mobile — v10.3 Final Polish Pack
// Adds: classroom polish, accessibility toggles, practice reminder, research metrics,
// balance summary, reduced FX mode, mute mode, large text mode.
// Safe add-on: does not change core scoring.
// PATCH v20260515-GROUPS-MOBILE-V103-FINAL-POLISH

(function () {
  'use strict';

  const VERSION = 'v10.3-mobile-final-polish-pack-20260515';

  if (window.__HHA_GROUPS_MOBILE_FINAL_POLISH_V103__) return;
  window.__HHA_GROUPS_MOBILE_FINAL_POLISH_V103__ = true;

  const WIN = window;
  const DOC = document;

  const STORE = {
    settings: 'HHA_GROUPS_MOBILE_V103_SETTINGS',
    metrics: 'HHA_GROUPS_MOBILE_V103_METRICS',
    firstRun: 'HHA_GROUPS_MOBILE_V103_FIRST_RUN_DONE'
  };

  const state = {
    settings: {
      largeText: false,
      reducedFx: false,
      mute: false,
      teacherMode: true
    },
    itemSig: '',
    itemStartedAt: 0,
    responseTimes: [],
    itemSeen: 0,
    judgeCount: 0,
    correct: 0,
    miss: 0,
    decoyDodged: 0,
    goldenHit: 0,
    powerCueSeen: 0,
    decoyCueSeen: 0,
    groupMistakes: {},
    startedAt: Date.now(),
    poll: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_MOBILE_V9 || null;
  }

  function gs() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function getJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function loadSettings() {
    state.settings = Object.assign(
      {},
      state.settings,
      getJson(STORE.settings, {})
    );
  }

  function saveSettings() {
    setJson(STORE.settings, state.settings);
  }

  function itemSignature(item) {
    if (!item) return 'none';
    return [
      item.kind || '',
      item.icon || '',
      item.power || '',
      item.group && item.group.key || ''
    ].join('|');
  }

  function injectStyle() {
    if ($('groups-mobile-v103-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-mobile-v103-style';
    style.textContent = `
      body.v103-large-text .prompt,
      body.v103-large-text .v102-live-hint{
        font-size:clamp(17px,5vw,25px) !important;
      }

      body.v103-large-text .gate .label{
        font-size:12.5px !important;
      }

      body.v103-reduced-fx .fx,
      body.v103-reduced-fx .v97-particles,
      body.v103-reduced-fx .v98-alert,
      body.v103-reduced-fx .v97-stage-toast,
      body.v103-reduced-fx .v101-power-tip,
      body.v103-reduced-fx .v102-rule-chip{
        animation:none !important;
      }

      body.v103-reduced-fx .food,
      body.v103-reduced-fx .gate,
      body.v103-reduced-fx .game{
        animation:none !important;
        transition:none !important;
      }

      .v103-panel{
        margin:14px auto 0;
        max-width:620px;
        border-radius:28px;
        padding:14px;
        background:linear-gradient(180deg,#ffffff,#f4fbff);
        border:2px solid #d7edf7;
        box-shadow:0 14px 34px rgba(35,81,107,.10);
        text-align:left;
      }

      .v103-title{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        color:#244e68;
        font-size:17px;
        line-height:1.15;
        font-weight:1000;
      }

      .v103-pill{
        border-radius:999px;
        padding:5px 8px;
        background:#fff5ca;
        color:#806000;
        font-size:11px;
        font-weight:1000;
        white-space:nowrap;
      }

      .v103-text{
        margin-top:7px;
        color:#7193a8;
        font-size:13px;
        line-height:1.34;
        font-weight:850;
      }

      .v103-toggles{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:11px;
      }

      .v103-toggle{
        border:0;
        border-radius:999px;
        padding:9px 8px;
        background:#fff;
        box-shadow:inset 0 0 0 2px #e4f2f8;
        color:#244e68;
        font-size:12px;
        line-height:1.1;
        font-weight:1000;
        cursor:pointer;
      }

      .v103-toggle.on{
        background:#fff5ca;
        color:#806000;
        box-shadow:inset 0 0 0 2px #ffd966;
      }

      .v103-floating{
        position:fixed;
        right:10px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:2147482100;
        display:flex;
        gap:6px;
        pointer-events:auto;
      }

      body.playing .v103-floating{
        bottom:calc(8px + env(safe-area-inset-bottom,0px));
      }

      body.playing .v103-floating button{
        width:38px;
        height:38px;
        padding:0;
        font-size:16px;
      }

      .v103-floating button{
        border:0;
        border-radius:999px;
        width:42px;
        height:42px;
        background:rgba(255,255,255,.94);
        box-shadow:0 12px 30px rgba(35,81,107,.16);
        font:inherit;
        font-size:17px;
        font-weight:1000;
        color:#244e68;
        cursor:pointer;
      }

      .v103-summary{
        margin-top:12px;
        border-radius:24px;
        padding:13px;
        background:linear-gradient(180deg,#ffffff,#f5fcff);
        border:2px solid #d7edf7;
      }

      .v103-summary h3{
        margin:0;
        color:#244e68;
        font-size:17px;
        line-height:1.15;
        font-weight:1000;
      }

      .v103-summary p{
        margin:7px 0 0;
        color:#7193a8;
        font-size:13px;
        line-height:1.35;
        font-weight:850;
      }

      .v103-metric-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      .v103-metric{
        border-radius:18px;
        padding:9px 7px;
        background:#fff;
        box-shadow:inset 0 0 0 2px #e4f2f8;
        text-align:center;
      }

      .v103-metric b{
        display:block;
        color:#244e68;
        font-size:20px;
        line-height:1;
        font-weight:1000;
      }

      .v103-metric span{
        display:block;
        margin-top:4px;
        color:#7193a8;
        font-size:11px;
        line-height:1.15;
        font-weight:850;
      }

      @media (max-width:420px){
        .v103-toggles,
        .v103-metric-grid{
          grid-template-columns:1fr;
        }

        .v103-floating{
          right:7px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function applySettings() {
    DOC.body.classList.toggle('v103-large-text', Boolean(state.settings.largeText));
    DOC.body.classList.toggle('v103-reduced-fx', Boolean(state.settings.reducedFx));
    DOC.body.classList.toggle('v103-mute', Boolean(state.settings.mute));

    updateToggleButtons();
  }

  function toggleSetting(key) {
    state.settings[key] = !state.settings[key];
    saveSettings();
    applySettings();
  }

  function updateToggleButtons() {
    DOC.querySelectorAll('[data-v103-toggle]').forEach(btn => {
      const key = btn.dataset.v103Toggle;
      btn.classList.toggle('on', Boolean(state.settings[key]));
    });
  }

  function ensureIntroPanel() {
    const card = DOC.querySelector('.intro-card');
    if (!card || $('v103IntroPanel')) return;

    const firstRunDone = localStorage.getItem(STORE.firstRun) === '1';

    const panel = DOC.createElement('div');
    panel.id = 'v103IntroPanel';
    panel.className = 'v103-panel';
    panel.innerHTML = `
      <div class="v103-title">
        <span>✅ Final Polish Pack</span>
        <span class="v103-pill">Mobile Ready</span>
      </div>
      <div class="v103-text">
        ${firstRunDone ? 'พร้อมเล่นจริง: ใช้คำใบ้ item ระหว่างเกม และมีตัวช่วยสำหรับเด็กบนมือถือ' : 'แนะนำรอบแรก: เล่นโหมดซ้อมก่อน เพื่อเรียนรู้ Power / Golden / Decoy'}
      </div>
      <div class="v103-toggles">
        <button class="v103-toggle" type="button" data-v103-toggle="largeText">🔎 ข้อความใหญ่</button>
        <button class="v103-toggle" type="button" data-v103-toggle="reducedFx">🌿 ลดเอฟเฟกต์</button>
        <button class="v103-toggle" type="button" data-v103-toggle="mute">🔇 เงียบ</button>
      </div>
    `;

    const actions = card.querySelector('.actions');
    card.insertBefore(panel, actions);

    panel.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-v103-toggle]');
      if (!btn) return;
      toggleSetting(btn.dataset.v103Toggle);
    });

    updateToggleButtons();
  }

  function ensureFloating() {
    if ($('v103Floating')) return;

    const box = DOC.createElement('div');
    box.id = 'v103Floating';
    box.className = 'v103-floating';
    box.innerHTML = `
      <button type="button" title="ข้อความใหญ่" data-v103-toggle="largeText">🔎</button>
      <button type="button" title="ลดเอฟเฟกต์" data-v103-toggle="reducedFx">🌿</button>
      <button type="button" title="ปิด/เปิดเสียง" data-v103-toggle="mute">🔇</button>
    `;

    DOC.body.appendChild(box);

    box.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-v103-toggle]');
      if (!btn) return;
      toggleSetting(btn.dataset.v103Toggle);
    });

    updateToggleButtons();
  }

  function patchAudioIfNeeded() {
    if (WIN.__HHA_GROUPS_MOBILE_V103_AUDIO_PATCHED__) return;
    WIN.__HHA_GROUPS_MOBILE_V103_AUDIO_PATCHED__ = true;

    const OriginalAudioContext = WIN.AudioContext || WIN.webkitAudioContext;
    if (!OriginalAudioContext) return;

    /*
      Soft mute: reduce master volume by suspending newly created contexts when mute is on.
      Existing core beeps may still happen briefly, but future sounds become much quieter.
    */
    const proto = OriginalAudioContext.prototype;
    if (!proto.__v103ResumePatched && proto.resume) {
      const oldResume = proto.resume;
      proto.resume = function () {
        if (state.settings.mute) {
          try { return this.suspend(); } catch (e) {}
        }
        return oldResume.apply(this, arguments);
      };
      proto.__v103ResumePatched = true;
    }
  }

  function currentKind(s) {
    try {
      return s.current && s.current.kind || '';
    } catch (e) {
      return '';
    }
  }

  function currentGroupKey(s) {
    try {
      return s.current && s.current.group && s.current.group.key || '';
    } catch (e) {
      return '';
    }
  }

  function pollMetrics() {
    const s = gs();

    if (!s || s.mode !== 'game' || s.ended) return;

    const sig = itemSignature(s.current);

    if (sig !== state.itemSig) {
      state.itemSig = sig;
      state.itemStartedAt = Date.now();
      state.itemSeen += 1;

      if (currentKind(s) === 'power') state.powerCueSeen += 1;
      if (currentKind(s) === 'decoy') state.decoyCueSeen += 1;
    }
  }

  function average(arr) {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  function balanceRecommendation(summary, metrics) {
    const acc = Number(summary.accuracy || 0);
    const combo = Number(summary.bestCombo || 0);
    const miss = Number(summary.miss || 0);
    const rt = Number(metrics.avgResponseMs || 0);
    const decoyMistake = Number(metrics.decoyMistake || 0);

    if (acc < 65) return 'แนะนำ: ลดความเร็ว/เล่นโหมดซ้อมก่อน เพราะความแม่นยำยังต่ำ';
    if (rt > 2600) return 'แนะนำ: ข้อความหรือ item อาจเร็วเกินไป เด็กอาจต้องใช้ระดับ easy/normal';
    if (miss >= 5) return 'แนะนำ: ลดตัวหลอกหรือยืดเวลาตกเล็กน้อย';
    if (decoyMistake >= 3) return 'แนะนำ: เด็กยังสับสนตัวหลอก ควรเน้นคำใบ้ “อย่าแตะ”';
    if (combo < 5) return 'แนะนำ: เพิ่มเวลาฝึกคอมโบก่อนเข้าเล่นจริง';
    if (acc >= 85 && combo >= 10) return 'เหมาะสมดี: เด็กควรลองระดับ hard/challenge ได้';
    return 'เหมาะสมดี: พร้อมใช้ทดสอบจริงในห้องเรียน';
  }

  function buildMetrics(summary) {
    const metrics = {
      version: VERSION,
      itemSeen: state.itemSeen,
      judgeCount: state.judgeCount,
      correct: state.correct,
      miss: state.miss,
      decoyDodged: state.decoyDodged,
      goldenHit: state.goldenHit,
      avgResponseMs: average(state.responseTimes),
      minResponseMs: state.responseTimes.length ? Math.min.apply(null, state.responseTimes) : 0,
      maxResponseMs: state.responseTimes.length ? Math.max.apply(null, state.responseTimes) : 0,
      powerCueSeen: state.powerCueSeen,
      decoyCueSeen: state.decoyCueSeen,
      groupMistakes: Object.assign({}, state.groupMistakes),
      durationMs: Date.now() - state.startedAt
    };

    metrics.recommendation = balanceRecommendation(summary || {}, metrics);

    return metrics;
  }

  function appendSummary(detail) {
    setTimeout(() => {
      let summary = detail;

      try {
        if (!summary) {
          const raw = localStorage.getItem('HHA_GROUPS_MOBILE_SUMMARY');
          if (raw) summary = JSON.parse(raw);
        }
      } catch (e) {}

      if (!summary) return;

      const metrics = buildMetrics(summary);
      setJson(STORE.metrics, metrics);

      const card = DOC.querySelector('.summary-card');
      if (!card) return;

      let box = $('v103Summary');
      if (!box) {
        box = DOC.createElement('div');
        box.id = 'v103Summary';
        box.className = 'v103-summary';

        const actions = card.querySelector('.actions');
        card.insertBefore(box, actions);
      }

      box.innerHTML = `
        <h3>✅ Mobile Final Polish</h3>
        <p>${metrics.recommendation}</p>
        <div class="v103-metric-grid">
          <div class="v103-metric"><b>${metrics.avgResponseMs}</b><span>Avg Response ms</span></div>
          <div class="v103-metric"><b>${metrics.itemSeen}</b><span>Items Seen</span></div>
          <div class="v103-metric"><b>${metrics.decoyDodged}</b><span>Decoy Dodged</span></div>
        </div>
      `;

      try {
        summary.mobileFinalPolish = metrics;
        localStorage.setItem('HHA_GROUPS_MOBILE_SUMMARY', JSON.stringify(summary));
      } catch (e) {}

      localStorage.setItem(STORE.firstRun, '1');
    }, 320);
  }

  function installEvents() {
    WIN.addEventListener('groups:judge', ev => {
      const d = ev.detail || {};
      state.judgeCount += 1;

      const rt = Date.now() - state.itemStartedAt;
      if (rt > 80 && rt < 15000) state.responseTimes.push(rt);

      if (d.ok || d.correct) {
        state.correct += 1;
      } else {
        state.miss += 1;

        const s = gs();
        const key = currentGroupKey(s) || 'unknown';
        state.groupMistakes[key] = (state.groupMistakes[key] || 0) + 1;
      }

      const s = gs();
      if (currentKind(s) === 'golden') state.goldenHit += 1;
    });

    WIN.addEventListener('groups:decoy-dodged', () => {
      state.decoyDodged += 1;
    });

    WIN.addEventListener('groups:end', ev => {
      appendSummary(ev.detail || null);
    });

    WIN.addEventListener('hha:summary-enriched', ev => {
      appendSummary(ev.detail || null);
    });
  }

  function expose() {
    WIN.HHA_GROUPS_MOBILE_V103_FINAL_POLISH = {
      version: VERSION,
      getSettings: () => Object.assign({}, state.settings),
      setSetting: function (key, value) {
        if (!(key in state.settings)) return;
        state.settings[key] = Boolean(value);
        saveSettings();
        applySettings();
      },
      getMetrics: function () {
        return buildMetrics({});
      }
    };
  }

  function init() {
    injectStyle();
    loadSettings();
    ensureIntroPanel();
    ensureFloating();
    patchAudioIfNeeded();
    applySettings();
    installEvents();
    expose();

    state.poll = setInterval(pollMetrics, 180);

    console.info('[Groups Mobile v10.3] final polish installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
