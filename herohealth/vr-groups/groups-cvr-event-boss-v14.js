// === /herohealth/vr-groups/groups-cvr-event-boss-v14.js ===
// HeroHealth Groups cVR — v1.4 Event Director + Boss VR
// Adds:
// - VR Event Director: Score Burst / Combo Focus / Power Hunt / Decoy Calm
// - Boss VR Commands during boss phase
// - Soft 3D boss aura + event rings
// - Summary extension for cVR event/boss performance
// Safe add-on: visual + tracking only, does not change core scoring.
// PATCH v20260515-GROUPS-CVR-V14-EVENT-BOSS

(function () {
  'use strict';

  const VERSION = 'v1.4-cvr-event-boss-20260515';

  if (window.__HHA_GROUPS_CVR_EVENT_BOSS_V14__) return;
  window.__HHA_GROUPS_CVR_EVENT_BOSS_V14__ = true;

  const WIN = window;
  const DOC = document;

  const EVENTS = {
    scoreBurst: {
      id: 'scoreBurst',
      icon: '🏆',
      title: 'Score Burst!',
      desc: 'ทำคะแนนเพิ่มให้ถึงเป้า',
      target: 70,
      duration: 15000,
      color: '#ffd966'
    },
    comboFocus: {
      id: 'comboFocus',
      icon: '🔥',
      title: 'Combo Focus!',
      desc: 'รักษาคอมโบให้ถึงเป้า',
      target: 4,
      duration: 15000,
      color: '#ff9d3f'
    },
    powerHunt: {
      id: 'powerHunt',
      icon: '⚡',
      title: 'Power Hunt!',
      desc: 'ยิงเก็บ Power-up ให้ได้',
      target: 1,
      duration: 17000,
      color: '#61bbff'
    },
    decoyCalm: {
      id: 'decoyCalm',
      icon: '🚫',
      title: 'Decoy Calm!',
      desc: 'อย่ายิงตัวหลอกจนหมดเวลา',
      target: 1,
      duration: 12000,
      color: '#7ed957'
    }
  };

  const BOSS_COMMANDS = {
    bossCorrect: {
      id: 'bossCorrect',
      icon: '👑',
      title: 'Boss Command!',
      desc: 'ตอบถูกใน Boss Phase',
      target: 4,
      duration: 18000,
      color: '#ffb347'
    },
    bossCombo: {
      id: 'bossCombo',
      icon: '🔥',
      title: 'Boss Combo!',
      desc: 'ทำคอมโบใน Boss Phase',
      target: 4,
      duration: 16000,
      color: '#ff9d3f'
    },
    bossNoMiss: {
      id: 'bossNoMiss',
      icon: '🛡️',
      title: 'Boss Guard!',
      desc: 'ห้ามพลาดช่วง Boss',
      target: 1,
      duration: 10000,
      color: '#61bbff'
    }
  };

  const state = {
    active: null,
    progress: 0,
    startedAt: 0,
    endsAt: 0,
    nextAt: 0,

    bossActive: null,
    bossProgress: 0,
    bossStartedAt: 0,
    bossEndsAt: 0,
    bossNextAt: 0,

    completed: 0,
    failed: 0,
    bossCleared: 0,
    bossFailed: 0,
    badges: [],

    baseScore: 0,
    baseCombo: 0,
    baseCorrect: 0,
    baseMiss: 0,
    basePowerShield: 0,
    basePowerSlow: 0,

    lastScore: 0,
    lastCorrect: 0,
    lastMiss: 0,
    lastCombo: 0,
    lastPhase: '',
    lastCurrentSig: '',

    poll: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function gs() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function now() {
    return Date.now();
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function isPlaying(s) {
    return s && s.mode === 'game' && !s.ended;
  }

  function injectStyle() {
    if ($('groups-cvr-v14-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v14-style';
    style.textContent = `
      .cvr-v14-event-card{
        position:fixed;
        left:50%;
        top:calc(138px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:2147482100;
        width:min(540px,calc(100vw - 24px));
        border-radius:24px;
        padding:10px 12px;
        background:rgba(255,255,255,.92);
        color:#244e68;
        box-shadow:0 16px 44px rgba(35,81,107,.18);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:none;
        display:none;
      }

      body.cvr-v14-event-active .cvr-v14-event-card{
        display:block;
      }

      .cvr-v14-event-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .cvr-v14-event-title{
        min-width:0;
        display:flex;
        align-items:center;
        gap:7px;
        font-size:clamp(14px,3.8vw,21px);
        line-height:1.1;
        font-weight:1000;
      }

      .cvr-v14-event-title span:last-child{
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .cvr-v14-event-count{
        flex:0 0 auto;
        border-radius:999px;
        padding:5px 8px;
        background:#fff5ca;
        color:#806000;
        font-size:12px;
        line-height:1;
        font-weight:1000;
      }

      .cvr-v14-event-desc{
        margin-top:5px;
        color:#7193a8;
        font-size:12px;
        line-height:1.25;
        font-weight:850;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .cvr-v14-bars{
        display:grid;
        grid-template-columns:1fr 80px;
        gap:8px;
        margin-top:8px;
      }

      .cvr-v14-progress,
      .cvr-v14-time{
        height:9px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(97,187,255,.16);
      }

      .cvr-v14-progress i,
      .cvr-v14-time i{
        display:block;
        height:100%;
        width:0%;
        border-radius:inherit;
        background:linear-gradient(90deg,#7ed957,#ffd966,#ff9d3f);
        transition:width .16s ease;
      }

      .cvr-v14-time i{
        background:linear-gradient(90deg,#61bbff,#ff9d3f,#ff7d7d);
      }

      .cvr-v14-boss-card{
        position:fixed;
        left:50%;
        top:calc(206px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:2147482100;
        width:min(520px,calc(100vw - 24px));
        border-radius:24px;
        padding:10px 12px;
        background:linear-gradient(135deg,rgba(255,244,224,.96),rgba(255,255,255,.92));
        border:2px solid rgba(255,179,71,.72);
        color:#8a3c20;
        box-shadow:0 16px 44px rgba(35,81,107,.18);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:none;
        display:none;
      }

      body.cvr-v14-boss-active .cvr-v14-boss-card{
        display:block;
      }

      .cvr-v14-boss-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        font-size:clamp(14px,3.8vw,21px);
        line-height:1.1;
        font-weight:1000;
      }

      .cvr-v14-boss-desc{
        margin-top:5px;
        color:#8a6a31;
        font-size:12px;
        line-height:1.25;
        font-weight:850;
      }

      .cvr-v14-boss-meter{
        height:10px;
        margin-top:8px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,125,125,.18);
      }

      .cvr-v14-boss-meter i{
        display:block;
        height:100%;
        width:0%;
        border-radius:inherit;
        background:linear-gradient(90deg,#ff7d7d,#ffb347,#ffd966);
        transition:width .18s ease;
      }

      .cvr-v14-alert{
        position:fixed;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        z-index:2147482300;
        width:min(460px,82vw);
        border-radius:32px;
        padding:16px 14px;
        text-align:center;
        background:rgba(255,255,255,.95);
        color:#714300;
        box-shadow:0 24px 70px rgba(35,81,107,.22);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:clamp(26px,8vw,54px);
        line-height:1.05;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .cvr-v14-alert.show{
        animation:cvrV14Alert .92s ease both;
      }

      .cvr-v14-alert small{
        display:block;
        margin-top:7px;
        color:#8a6a31;
        font-size:clamp(12px,3.5vw,17px);
        line-height:1.25;
        font-weight:900;
      }

      @keyframes cvrV14Alert{
        0%{opacity:0; transform:translate(-50%,-38%) scale(.8);}
        18%{opacity:1; transform:translate(-50%,-50%) scale(1.08);}
        74%{opacity:1; transform:translate(-50%,-52%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-66%) scale(.94);}
      }

      .cvr-v14-summary{
        margin-top:12px;
        border-radius:24px;
        padding:13px;
        background:linear-gradient(180deg,#ffffff,#f5fcff);
        border:2px solid #d7edf7;
      }

      .cvr-v14-summary h3{
        margin:0;
        color:#244e68;
        font-size:17px;
        line-height:1.15;
        font-weight:1000;
      }

      .cvr-v14-summary p{
        margin:7px 0 0;
        color:#7193a8;
        font-size:13px;
        line-height:1.35;
        font-weight:850;
      }

      @media (max-height:720px){
        .cvr-v14-event-card{
          top:calc(118px + env(safe-area-inset-top,0px));
          padding:8px 10px;
        }

        .cvr-v14-boss-card{
          top:calc(178px + env(safe-area-inset-top,0px));
          padding:8px 10px;
        }

        .cvr-v14-event-desc,
        .cvr-v14-boss-desc{
          display:none;
        }

        .cvr-v14-alert{
          top:54%;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    if (!$('cvrV14EventCard')) {
      const card = DOC.createElement('div');
      card.id = 'cvrV14EventCard';
      card.className = 'cvr-v14-event-card';
      card.innerHTML = `
        <div class="cvr-v14-event-top">
          <div class="cvr-v14-event-title">
            <span id="cvrV14EventIcon">⭐</span>
            <span id="cvrV14EventTitle">Event</span>
          </div>
          <div id="cvrV14EventCount" class="cvr-v14-event-count">0/3</div>
        </div>
        <div id="cvrV14EventDesc" class="cvr-v14-event-desc">ทำภารกิจพิเศษให้สำเร็จ</div>
        <div class="cvr-v14-bars">
          <div class="cvr-v14-progress"><i id="cvrV14EventFill"></i></div>
          <div class="cvr-v14-time"><i id="cvrV14EventTime"></i></div>
        </div>
      `;
      DOC.body.appendChild(card);
    }

    if (!$('cvrV14BossCard')) {
      const boss = DOC.createElement('div');
      boss.id = 'cvrV14BossCard';
      boss.className = 'cvr-v14-boss-card';
      boss.innerHTML = `
        <div class="cvr-v14-boss-title">
          <span id="cvrV14BossTitle">👑 Boss VR</span>
          <span id="cvrV14BossCount">0/4</span>
        </div>
        <div id="cvrV14BossDesc" class="cvr-v14-boss-desc">เข้าสู่ Boss Phase แล้วทำคำสั่งให้สำเร็จ</div>
        <div class="cvr-v14-boss-meter"><i id="cvrV14BossFill"></i></div>
      `;
      DOC.body.appendChild(boss);
    }

    if (!$('cvrV14Alert')) {
      const alert = DOC.createElement('div');
      alert.id = 'cvrV14Alert';
      alert.className = 'cvr-v14-alert';
      DOC.body.appendChild(alert);
    }
  }

  function ensure3d() {
    const arena = $('arena');
    const fxRoot = $('fxRoot') || arena;
    if (!arena || !fxRoot) return;

    if (!$('cvrV14BossAura')) {
      const aura = DOC.createElement('a-torus');
      aura.id = 'cvrV14BossAura';
      aura.setAttribute('position', '0 1.18 -4.22');
      aura.setAttribute('rotation', '0 0 0');
      aura.setAttribute('radius', '1.22');
      aura.setAttribute('radius-tubular', '.025');
      aura.setAttribute('color', '#ff9d3f');
      aura.setAttribute('material', 'shader:flat; transparent:true; opacity:.0');
      aura.setAttribute('animation__spin', 'property: rotation; to: 0 0 360; dur: 9000; loop: true; easing: linear');
      fxRoot.appendChild(aura);
    }

    if (!$('cvrV14EventRing')) {
      const ring = DOC.createElement('a-torus');
      ring.id = 'cvrV14EventRing';
      ring.setAttribute('position', '0 .12 -3.2');
      ring.setAttribute('rotation', '90 0 0');
      ring.setAttribute('radius', '2.05');
      ring.setAttribute('radius-tubular', '.018');
      ring.setAttribute('color', '#ffd966');
      ring.setAttribute('material', 'shader:flat; transparent:true; opacity:.0');
      ring.setAttribute('animation__pulse', 'property: scale; dir: alternate; to: 1.08 1.08 1.08; dur: 900; loop: true; easing: easeInOutSine');
      fxRoot.appendChild(ring);
    }
  }

  function alertBox(title, desc) {
    const el = $('cvrV14Alert');
    if (!el) return;

    el.innerHTML = `${title}<small>${desc || ''}</small>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function setAura(active) {
    const aura = $('cvrV14BossAura');
    if (!aura) return;

    aura.setAttribute(
      'material',
      `shader:flat; transparent:true; opacity:${active ? '.72' : '.0'}; color:#ff9d3f`
    );
  }

  function setEventRing(active, color) {
    const ring = $('cvrV14EventRing');
    if (!ring) return;

    ring.setAttribute(
      'material',
      `shader:flat; transparent:true; opacity:${active ? '.72' : '.0'}; color:${color || '#ffd966'}`
    );
  }

  function chooseEvent(s) {
    const pool = [EVENTS.scoreBurst, EVENTS.comboFocus, EVENTS.decoyCalm];

    const powerUsed = s.powerUsed || {};
    const powerTotal = Number(powerUsed.shield || 0) + Number(powerUsed.slow || 0);

    if (powerTotal < 2) pool.push(EVENTS.powerHunt);

    return pool[Math.floor(Math.random() * pool.length) % pool.length];
  }

  function chooseBossCommand() {
    const pool = [BOSS_COMMANDS.bossCorrect, BOSS_COMMANDS.bossCombo, BOSS_COMMANDS.bossNoMiss];
    return pool[Math.floor(Math.random() * pool.length) % pool.length];
  }

  function scheduleNext(ms) {
    state.nextAt = now() + (ms || 10000 + Math.random() * 6500);
  }

  function scheduleBossNext(ms) {
    state.bossNextAt = now() + (ms || 3500 + Math.random() * 2500);
  }

  function snapshotBaselines(s) {
    state.baseScore = Number(s.score || 0);
    state.baseCombo = Number(s.combo || 0);
    state.baseCorrect = Number(s.correct || 0);
    state.baseMiss = Number(s.miss || 0);

    const p = s.powerUsed || {};
    state.basePowerShield = Number(p.shield || 0);
    state.basePowerSlow = Number(p.slow || 0);
  }

  function startEvent(def) {
    const s = gs();

    state.active = Object.assign({}, def);
    state.progress = 0;
    state.startedAt = now();
    state.endsAt = now() + def.duration;

    snapshotBaselines(s);

    DOC.body.classList.add('cvr-v14-event-active');
    setEventRing(true, def.color);

    alertBox(`${def.icon} ${def.title}`, def.desc);
    vibrate([24, 14, 24]);
    updateEventUi();

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v14:event-start', {
        detail: { version: VERSION, event: def.id, title: def.title }
      }));
    } catch (e) {}
  }

  function clearEvent() {
    state.active = null;
    state.progress = 0;
    DOC.body.classList.remove('cvr-v14-event-active');
    setEventRing(false);
    updateEventUi();
  }

  function completeEvent() {
    if (!state.active) return;

    const e = state.active;

    state.completed += 1;

    const badge = `${e.icon} ${e.title.replace('!', '')}`;
    if (!state.badges.includes(badge)) state.badges.push(badge);

    alertBox(`สำเร็จ! ${e.icon}`, 'Event Clear');
    vibrate([34, 18, 34]);

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v14:event-complete', {
        detail: { version: VERSION, event: e.id, completed: state.completed }
      }));
    } catch (err) {}

    clearEvent();
    scheduleNext(12000 + Math.random() * 5000);
  }

  function failEvent() {
    if (!state.active) return;

    const e = state.active;

    state.failed += 1;

    alertBox('พลาด Event', `${e.icon} ${e.title} หมดเวลา`);

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v14:event-fail', {
        detail: { version: VERSION, event: e.id, failed: state.failed }
      }));
    } catch (err) {}

    clearEvent();
    scheduleNext(9000 + Math.random() * 4500);
  }

  function startBoss(def) {
    const s = gs();

    state.bossActive = Object.assign({}, def);
    state.bossProgress = 0;
    state.bossStartedAt = now();
    state.bossEndsAt = now() + def.duration;

    snapshotBaselines(s);

    DOC.body.classList.add('cvr-v14-boss-active');
    setAura(true);

    alertBox(`${def.icon} ${def.title}`, def.desc);
    vibrate([35, 18, 35]);

    updateBossUi();

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v14:boss-start', {
        detail: { version: VERSION, command: def.id, title: def.title }
      }));
    } catch (e) {}
  }

  function clearBoss() {
    state.bossActive = null;
    state.bossProgress = 0;
    DOC.body.classList.remove('cvr-v14-boss-active');
    updateBossUi();
  }

  function completeBoss() {
    if (!state.bossActive) return;

    const b = state.bossActive;

    state.bossCleared += 1;

    const badge = `${b.icon} ${b.title.replace('!', '')}`;
    if (!state.badges.includes(badge)) state.badges.push(badge);

    alertBox('👑 Boss Clear!', 'ทำคำสั่ง Boss สำเร็จ');
    vibrate([38, 20, 38]);

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v14:boss-clear', {
        detail: { version: VERSION, command: b.id, cleared: state.bossCleared }
      }));
    } catch (err) {}

    clearBoss();
    scheduleBossNext(5200 + Math.random() * 2800);
  }

  function failBoss() {
    if (!state.bossActive) return;

    const b = state.bossActive;

    state.bossFailed += 1;

    alertBox('Boss พลาด', `${b.icon} ${b.title} ยังไม่สำเร็จ`);

    try {
      WIN.dispatchEvent(new CustomEvent('groups-cvr:v14:boss-fail', {
        detail: { version: VERSION, command: b.id, failed: state.bossFailed }
      }));
    } catch (err) {}

    clearBoss();
    scheduleBossNext(4400 + Math.random() * 2400);
  }

  function updateEventProgress(s) {
    if (!state.active) return;

    const e = state.active;

    if (e.id === 'scoreBurst') {
      state.progress = clamp(Number(s.score || 0) - state.baseScore, 0, e.target);
    }

    if (e.id === 'comboFocus') {
      state.progress = Math.max(state.progress, clamp(Number(s.combo || 0), 0, e.target));
    }

    if (e.id === 'powerHunt') {
      const p = s.powerUsed || {};
      const total =
        Number(p.shield || 0) +
        Number(p.slow || 0) -
        state.basePowerShield -
        state.basePowerSlow;

      state.progress = clamp(total, 0, e.target);
    }

    if (e.id === 'decoyCalm') {
      const missDelta = Number(s.miss || 0) - state.baseMiss;

      if (missDelta > 0) {
        failEvent();
        return;
      }

      state.progress = 1;
    }

    if (state.progress >= e.target) {
      completeEvent();
      return;
    }

    if (now() >= state.endsAt) {
      if (e.id === 'decoyCalm') completeEvent();
      else failEvent();
      return;
    }

    updateEventUi();
  }

  function updateBossProgress(s) {
    if (!state.bossActive) return;

    const b = state.bossActive;

    if (b.id === 'bossCorrect') {
      state.bossProgress = clamp(Number(s.correct || 0) - state.baseCorrect, 0, b.target);
    }

    if (b.id === 'bossCombo') {
      state.bossProgress = Math.max(state.bossProgress, clamp(Number(s.combo || 0), 0, b.target));
    }

    if (b.id === 'bossNoMiss') {
      const missDelta = Number(s.miss || 0) - state.baseMiss;

      if (missDelta > 0) {
        failBoss();
        return;
      }

      state.bossProgress = 1;
    }

    if (state.bossProgress >= b.target) {
      completeBoss();
      return;
    }

    if (now() >= state.bossEndsAt) {
      if (b.id === 'bossNoMiss') completeBoss();
      else failBoss();
      return;
    }

    updateBossUi();
  }

  function updateEventUi() {
    const e = state.active;

    if (!e) return;

    const icon = $('cvrV14EventIcon');
    const title = $('cvrV14EventTitle');
    const count = $('cvrV14EventCount');
    const desc = $('cvrV14EventDesc');
    const fill = $('cvrV14EventFill');
    const time = $('cvrV14EventTime');

    if (icon) icon.textContent = e.icon;
    if (title) title.textContent = e.title;
    if (desc) desc.textContent = e.desc;
    if (count) count.textContent = `${state.progress}/${e.target}`;

    if (fill) {
      fill.style.width = clamp(state.progress / Math.max(1, e.target) * 100, 0, 100) + '%';
    }

    if (time) {
      const left = clamp((state.endsAt - now()) / Math.max(1, e.duration), 0, 1);
      time.style.width = left * 100 + '%';
    }
  }

  function updateBossUi() {
    const b = state.bossActive;

    if (!b) return;

    const title = $('cvrV14BossTitle');
    const count = $('cvrV14BossCount');
    const desc = $('cvrV14BossDesc');
    const fill = $('cvrV14BossFill');

    if (title) title.textContent = `${b.icon} ${b.title}`;
    if (count) count.textContent = `${state.bossProgress}/${b.target}`;

    if (desc) {
      const left = Math.max(0, Math.ceil((state.bossEndsAt - now()) / 1000));
      desc.textContent = `${b.desc} • ${left}s`;
    }

    if (fill) {
      fill.style.width = clamp(state.bossProgress / Math.max(1, b.target) * 100, 0, 100) + '%';
    }
  }

  function poll() {
    const s = gs();

    if (!isPlaying(s)) {
      if (state.active) clearEvent();
      if (state.bossActive) clearBoss();
      setAura(false);
      return;
    }

    ensureUi();
    ensure3d();

    const phase = s.phase || '';

    if (!state.nextAt) scheduleNext(8000);

    if (!state.active && now() >= state.nextAt && phase !== 'boss') {
      startEvent(chooseEvent(s));
    }

    if (state.active) {
      updateEventProgress(s);
    }

    if (phase === 'boss') {
      setAura(true);

      if (!state.bossNextAt) scheduleBossNext(900);

      if (!state.bossActive && now() >= state.bossNextAt) {
        startBoss(chooseBossCommand());
      }

      if (state.bossActive) {
        updateBossProgress(s);
      }
    } else {
      setAura(false);

      if (state.bossActive) {
        clearBoss();
      }

      state.bossNextAt = 0;
    }

    if (phase !== state.lastPhase) {
      state.lastPhase = phase;

      if (phase === 'boss') {
        alertBox('👑 Boss VR!', 'ทำคำสั่งพิเศษให้สำเร็จ');
      } else if (phase === 'storm') {
        alertBox('⚡ VR Speed Sort!', 'เล็งให้ไวขึ้น');
      }
    }
  }

  function appendSummary(detail) {
    setTimeout(() => {
      let summary = detail;

      try {
        if (!summary) {
          const raw = localStorage.getItem('HHA_GROUPS_CVR_SUMMARY');
          if (raw) summary = JSON.parse(raw);
        }
      } catch (e) {}

      if (!summary) return;

      const card = DOC.querySelector('#summary .card');
      if (!card) return;

      let box = $('cvrV14Summary');

      if (!box) {
        box = DOC.createElement('div');
        box.id = 'cvrV14Summary';
        box.className = 'cvr-v14-summary';

        const actions = card.querySelector('.actions');
        card.insertBefore(box, actions);
      }

      const badgeText = state.badges.length ? state.badges.join(' • ') : 'ยังไม่มี Event Badge';

      box.innerHTML = `
        <h3>⚡ cVR Event + Boss VR</h3>
        <p>
          Event สำเร็จ ${state.completed} • พลาด ${state.failed}<br>
          Boss Clear ${state.bossCleared} • Boss Fail ${state.bossFailed}<br>
          ${badgeText}
        </p>
      `;

      try {
        summary.cvrEventBoss = {
          version: VERSION,
          completed: state.completed,
          failed: state.failed,
          bossCleared: state.bossCleared,
          bossFailed: state.bossFailed,
          badges: state.badges.slice()
        };

        localStorage.setItem('HHA_GROUPS_CVR_SUMMARY', JSON.stringify(summary));
      } catch (e) {}
    }, 340);
  }

  function installEvents() {
    WIN.addEventListener('groups-cvr:end', ev => {
      appendSummary(ev.detail || null);
    });

    WIN.addEventListener('groups:end', ev => {
      appendSummary(ev.detail || null);
    });

    WIN.addEventListener('hha:summary-enriched', ev => {
      appendSummary(ev.detail || null);
    });
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_EVENT_BOSS_V14 = {
      version: VERSION,
      startEvent: function (id) {
        if (EVENTS[id]) startEvent(EVENTS[id]);
      },
      startBoss: function (id) {
        if (BOSS_COMMANDS[id]) startBoss(BOSS_COMMANDS[id]);
      },
      getState: function () {
        return {
          version: VERSION,
          active: state.active,
          progress: state.progress,
          bossActive: state.bossActive,
          bossProgress: state.bossProgress,
          completed: state.completed,
          failed: state.failed,
          bossCleared: state.bossCleared,
          bossFailed: state.bossFailed,
          badges: state.badges.slice()
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    ensure3d();
    installEvents();
    expose();

    state.poll = setInterval(poll, 220);

    console.info('[Groups cVR v1.4] event director + boss VR installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
