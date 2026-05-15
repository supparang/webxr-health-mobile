// === /herohealth/vr-groups/groups-pc-final-polish-v18.js ===
// HeroHealth Groups PC — v1.8 Final Polish Pack
// Adds: classroom polish, accessibility toggles, keyboard practice cue,
// research metrics, balance summary, reduced FX mode, final production hints.
// Safe add-on: does not change core scoring.
// PATCH v20260515-GROUPS-PC-V18-FINAL-POLISH

(function () {
  'use strict';

  const VERSION = 'v1.8-pc-final-polish-pack-20260515';

  if (window.__HHA_GROUPS_PC_FINAL_POLISH_V18__) return;
  window.__HHA_GROUPS_PC_FINAL_POLISH_V18__ = true;

  const WIN = window;
  const DOC = document;

  const STORE = {
    settings: 'HHA_GROUPS_PC_V18_SETTINGS',
    metrics: 'HHA_GROUPS_PC_V18_METRICS',
    firstRun: 'HHA_GROUPS_PC_V18_FIRST_RUN_DONE'
  };

  const state = {
    settings: {
      largeText: false,
      reducedFx: false,
      teacherMode: true,
      keyboardCoach: true
    },
    responseTimes: [],
    itemSig: '',
    itemStartedAt: 0,
    keyUse: 0,
    mouseUse: 0,
    itemSeen: 0,
    judgeCount: 0,
    correct: 0,
    miss: 0,
    stageItemsMax: 0,
    startedAt: Date.now(),
    poll: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_PC_V1 || null;
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

  function injectStyle() {
    if ($('groups-pc-v18-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-pc-v18-style';
    style.textContent = `
      body.pc-v18-large-text .prompt,
      body.pc-v18-large-text .pc-v17-coachbar,
      body.pc-v18-large-text .wave-sub{
        font-size:clamp(17px,1.9vw,24px) !important;
      }

      body.pc-v18-large-text .gate .label{
        font-size:22px !important;
      }

      body.pc-v18-reduced-fx .fx,
      body.pc-v18-reduced-fx .pc-v11-particles,
      body.pc-v18-reduced-fx .pc-v11-toast,
      body.pc-v18-reduced-fx .pc-v12-alert,
      body.pc-v18-reduced-fx .pc-v13-flash{
        animation:none !important;
      }

      body.pc-v18-reduced-fx .fall-item,
      body.pc-v18-reduced-fx .gate,
      body.pc-v18-reduced-fx .game{
        animation:none !important;
        transition:none !important;
      }

      .pc-v18-panel{
        margin:18px auto 0;
        max-width:780px;
        border-radius:30px;
        padding:16px;
        background:linear-gradient(180deg,#ffffff,#f4fbff);
        border:2px solid #d7edf7;
        box-shadow:0 16px 38px rgba(35,81,107,.10);
        text-align:left;
      }

      .pc-v18-title{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        color:#244e68;
        font-size:20px;
        line-height:1.15;
        font-weight:1000;
      }

      .pc-v18-pill{
        border-radius:999px;
        padding:6px 10px;
        background:#fff5ca;
        color:#806000;
        font-size:12px;
        font-weight:1000;
        white-space:nowrap;
      }

      .pc-v18-text{
        margin-top:8px;
        color:#7193a8;
        font-size:14px;
        line-height:1.35;
        font-weight:850;
      }

      .pc-v18-toggles{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin-top:12px;
      }

      .pc-v18-toggle{
        border:0;
        border-radius:999px;
        padding:10px 9px;
        background:#fff;
        box-shadow:inset 0 0 0 2px #e4f2f8;
        color:#244e68;
        font-size:13px;
        line-height:1.1;
        font-weight:1000;
        cursor:pointer;
      }

      .pc-v18-toggle.on{
        background:#fff5ca;
        color:#806000;
        box-shadow:inset 0 0 0 2px #ffd966;
      }

      .pc-v18-floating{
        position:fixed;
        right:16px;
        bottom:16px;
        z-index:2147482100;
        display:flex;
        gap:8px;
      }

      .pc-v18-floating button{
        border:0;
        border-radius:999px;
        width:44px;
        height:44px;
        background:rgba(255,255,255,.94);
        box-shadow:0 12px 30px rgba(35,81,107,.16);
        font:inherit;
        font-size:18px;
        font-weight:1000;
        color:#244e68;
        cursor:pointer;
      }

      .pc-v18-keyboard-coach{
        position:absolute;
        left:50%;
        bottom:88px;
        transform:translateX(-50%);
        z-index:96;
        width:min(760px,calc(100vw - 44px));
        border-radius:999px;
        padding:10px 16px;
        background:rgba(255,255,255,.92);
        box-shadow:0 16px 42px rgba(35,81,107,.16);
        color:#244e68;
        text-align:center;
        font-size:clamp(15px,1.7vw,22px);
        line-height:1.12;
        font-weight:1000;
        pointer-events:none;
        display:none;
      }

      body.playing.pc-v18-keycoach .pc-v18-keyboard-coach{
        display:block;
      }

      .pc-v18-summary{
        margin-top:12px;
        border-radius:24px;
        padding:14px;
        background:linear-gradient(180deg,#ffffff,#f5fcff);
        border:2px solid #d7edf7;
      }

      .pc-v18-summary h3{
        margin:0;
        color:#244e68;
        font-size:18px;
        line-height:1.15;
        font-weight:1000;
      }

      .pc-v18-summary p{
        margin:7px 0 0;
        color:#7193a8;
        font-size:14px;
        line-height:1.35;
        font-weight:850;
      }

      .pc-v18-metric-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:9px;
        margin-top:11px;
      }

      .pc-v18-metric{
        border-radius:18px;
        padding:10px 8px;
        background:#fff;
        box-shadow:inset 0 0 0 2px #e4f2f8;
        text-align:center;
      }

      .pc-v18-metric b{
        display:block;
        color:#244e68;
        font-size:22px;
        line-height:1;
        font-weight:1000;
      }

      .pc-v18-metric span{
        display:block;
        margin-top:5px;
        color:#7193a8;
        font-size:11px;
        line-height:1.15;
        font-weight:850;
      }

      @media (max-width:900px){
        .pc-v18-toggles,
        .pc-v18-metric-grid{
          grid-template-columns:1fr 1fr;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function applySettings() {
    DOC.body.classList.toggle('pc-v18-large-text', Boolean(state.settings.largeText));
    DOC.body.classList.toggle('pc-v18-reduced-fx', Boolean(state.settings.reducedFx));
    DOC.body.classList.toggle('pc-v18-keycoach', Boolean(state.settings.keyboardCoach));
    updateToggleButtons();
  }

  function toggleSetting(key) {
    state.settings[key] = !state.settings[key];
    saveSettings();
    applySettings();
  }

  function updateToggleButtons() {
    DOC.querySelectorAll('[data-pcv18-toggle]').forEach(btn => {
      const key = btn.dataset.pcv18Toggle;
      btn.classList.toggle('on', Boolean(state.settings[key]));
    });
  }

  function ensureIntroPanel() {
    const card = DOC.querySelector('.intro-card');
    if (!card || $('pcv18IntroPanel')) return;

    const firstRunDone = localStorage.getItem(STORE.firstRun) === '1';

    const panel = DOC.createElement('div');
    panel.id = 'pcv18IntroPanel';
    panel.className = 'pc-v18-panel';
    panel.innerHTML = `
      <div class="pc-v18-title">
        <span>✅ PC Final Polish Pack</span>
        <span class="pc-v18-pill">PC Ready</span>
      </div>
      <div class="pc-v18-text">
        ${firstRunDone ? 'พร้อมเล่นจริง: ใช้เมาส์ + คีย์บอร์ดเลข 1–5 เพื่อเล่นให้เร็วขึ้น' : 'แนะนำรอบแรก: เล่นโหมดซ้อมก่อน แล้วลองกดเลข 1–5 แทนการคลิกประตู'}
      </div>
      <div class="pc-v18-toggles">
        <button class="pc-v18-toggle" type="button" data-pcv18-toggle="largeText">🔎 ข้อความใหญ่</button>
        <button class="pc-v18-toggle" type="button" data-pcv18-toggle="reducedFx">🌿 ลดเอฟเฟกต์</button>
        <button class="pc-v18-toggle" type="button" data-pcv18-toggle="keyboardCoach">⌨️ Coach ปุ่มเลข</button>
      </div>
    `;

    const actions = card.querySelector('.actions');
    card.insertBefore(panel, actions);

    panel.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-pcv18-toggle]');
      if (!btn) return;
      toggleSetting(btn.dataset.pcv18Toggle);
    });

    updateToggleButtons();
  }

  function ensureFloating() {
    if ($('pcv18Floating')) return;

    const box = DOC.createElement('div');
    box.id = 'pcv18Floating';
    box.className = 'pc-v18-floating';
    box.innerHTML = `
      <button type="button" title="ข้อความใหญ่" data-pcv18-toggle="largeText">🔎</button>
      <button type="button" title="ลดเอฟเฟกต์" data-pcv18-toggle="reducedFx">🌿</button>
      <button type="button" title="Coach ปุ่มเลข" data-pcv18-toggle="keyboardCoach">⌨️</button>
    `;

    DOC.body.appendChild(box);

    box.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-pcv18-toggle]');
      if (!btn) return;
      toggleSetting(btn.dataset.pcv18Toggle);
    });

    updateToggleButtons();
  }

  function ensureKeyboardCoach() {
    const game = $('game');
    if (!game || $('pcv18KeyboardCoach')) return;

    const el = DOC.createElement('div');
    el.id = 'pcv18KeyboardCoach';
    el.className = 'pc-v18-keyboard-coach';
    el.textContent = '⌨️ เคล็ดลับ PC: คลิกอาหาร แล้วกดเลข 1–5 เพื่อส่งเข้าหมู่เร็วขึ้น';
    game.appendChild(el);
  }

  function signature(s) {
    return [
      s.mode || '',
      s.items || 0,
      s.score || 0,
      s.correct || 0,
      s.miss || 0,
      s.combo || 0,
      s.phase || ''
    ].join('|');
  }

  function pollMetrics() {
    const s = gs();

    if (!s || s.mode !== 'game' || s.ended) return;

    const sig = signature(s);

    if (sig !== state.itemSig) {
      state.itemSig = sig;
      state.itemStartedAt = Date.now();
    }

    const itemCount = Number(s.items || 0);
    state.stageItemsMax = Math.max(state.stageItemsMax, itemCount);

    if (state.settings.keyboardCoach && itemCount >= 4) {
      const coach = $('pcv18KeyboardCoach');
      if (coach) coach.textContent = '⌨️ หลายชิ้นแล้ว! ใช้ปุ่มเลข 1–5 จะเร็วกว่าเมาส์อย่างเดียว';
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
    const keyUse = Number(metrics.keyUse || 0);
    const itemsMax = Number(metrics.stageItemsMax || 0);

    if (acc < 70) return 'แนะนำ: ผู้เล่นยังไม่แม่น ควรใช้ normal/easy และฝึกเลือกหมู่ก่อน';
    if (miss >= 6) return 'แนะนำ: อาหารหลายเลนอาจเร็วเกินไป ควรลดระดับความยาก';
    if (keyUse < 3) return 'แนะนำ: ผู้เล่นยังไม่ใช้ปุ่มเลข 1–5 ควรเปิด Keyboard Coach ต่อ';
    if (itemsMax >= 7 && acc < 80) return 'แนะนำ: จำนวน item บนจออาจเยอะเกินสำหรับผู้เล่นกลุ่มนี้';
    if (combo >= 12 && acc >= 85) return 'เหมาะสมดี: PC Solo พร้อมทดสอบระดับ hard/challenge';
    return 'เหมาะสมดี: PC Solo พร้อมใช้ทดสอบจริงในห้องเรียน';
  }

  function buildMetrics(summary) {
    const metrics = {
      version: VERSION,
      judgeCount: state.judgeCount,
      correct: state.correct,
      miss: state.miss,
      keyUse: state.keyUse,
      mouseUse: state.mouseUse,
      avgResponseMs: average(state.responseTimes),
      minResponseMs: state.responseTimes.length ? Math.min.apply(null, state.responseTimes) : 0,
      maxResponseMs: state.responseTimes.length ? Math.max.apply(null, state.responseTimes) : 0,
      stageItemsMax: state.stageItemsMax,
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
          const raw = localStorage.getItem('HHA_GROUPS_PC_SUMMARY');
          if (raw) summary = JSON.parse(raw);
        }
      } catch (e) {}

      if (!summary) return;

      const metrics = buildMetrics(summary);
      setJson(STORE.metrics, metrics);

      const card = DOC.querySelector('.summary-card');
      if (!card) return;

      let box = $('pcv18Summary');
      if (!box) {
        box = DOC.createElement('div');
        box.id = 'pcv18Summary';
        box.className = 'pc-v18-summary';

        const actions = card.querySelector('.actions');
        card.insertBefore(box, actions);
      }

      box.innerHTML = `
        <h3>✅ PC Final Polish</h3>
        <p>${metrics.recommendation}</p>
        <div class="pc-v18-metric-grid">
          <div class="pc-v18-metric"><b>${metrics.avgResponseMs}</b><span>Avg Response ms</span></div>
          <div class="pc-v18-metric"><b>${metrics.keyUse}</b><span>Keyboard Use</span></div>
          <div class="pc-v18-metric"><b>${metrics.mouseUse}</b><span>Mouse Use</span></div>
          <div class="pc-v18-metric"><b>${metrics.stageItemsMax}</b><span>Max Items</span></div>
        </div>
      `;

      try {
        summary.pcFinalPolish = metrics;
        localStorage.setItem('HHA_GROUPS_PC_SUMMARY', JSON.stringify(summary));
      } catch (e) {}

      localStorage.setItem(STORE.firstRun, '1');
    }, 340);
  }

  function installEvents() {
    WIN.addEventListener('groups-pc:judge', ev => {
      const d = ev.detail || {};
      state.judgeCount += 1;

      const rt = Date.now() - state.itemStartedAt;
      if (rt > 80 && rt < 15000) state.responseTimes.push(rt);

      if (d.ok) state.correct += 1;
      else state.miss += 1;
    });

    DOC.addEventListener('keydown', ev => {
      if (['1', '2', '3', '4', '5'].includes(ev.key)) {
        state.keyUse += 1;
      }
    });

    DOC.addEventListener('pointerdown', ev => {
      if (ev.target && ev.target.closest && ev.target.closest('.gate,.fall-item')) {
        state.mouseUse += 1;
      }
    }, { passive: true });

    WIN.addEventListener('groups:end', ev => {
      appendSummary(ev.detail || null);
    });

    WIN.addEventListener('hha:summary-enriched', ev => {
      appendSummary(ev.detail || null);
    });
  }

  function expose() {
    WIN.HHA_GROUPS_PC_V18_FINAL_POLISH = {
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
    ensureKeyboardCoach();
    applySettings();
    installEvents();
    expose();

    state.poll = setInterval(pollMetrics, 220);

    console.info('[Groups PC v1.8] final polish installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
