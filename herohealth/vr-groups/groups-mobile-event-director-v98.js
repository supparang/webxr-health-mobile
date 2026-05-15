// === /herohealth/vr-groups/groups-mobile-event-director-v98.js ===
// HeroHealth Groups Mobile — v9.8 Event Director
// Adds timed mini-events: Veg Storm, Fruit Rush, Junk Rain, Golden Window, Boss Command.
// Safe add-on: does not modify v9.6 core scoring/spawn logic.
// PATCH v20260514-GROUPS-MOBILE-V98-EVENT-DIRECTOR

(function () {
  'use strict';

  const VERSION = 'v9.8-mobile-event-director-20260514';

  if (window.__HHA_GROUPS_MOBILE_V98_EVENT_DIRECTOR__) {
    console.warn('[Groups Mobile v9.8] already installed');
    return;
  }

  window.__HHA_GROUPS_MOBILE_V98_EVENT_DIRECTOR__ = true;

  const WIN = window;
  const DOC = document;

  const EVENTS = {
    vegStorm: {
      id: 'vegStorm',
      icon: '🥦',
      title: 'Veg Storm!',
      desc: 'เก็บหมู่ผักให้ได้',
      target: 3,
      duration: 15000,
      color: 'green'
    },
    fruitRush: {
      id: 'fruitRush',
      icon: '🍎',
      title: 'Fruit Rush!',
      desc: 'เก็บผลไม้ต่อเนื่อง',
      target: 3,
      duration: 15000,
      color: 'pink'
    },
    junkRain: {
      id: 'junkRain',
      icon: '🚫',
      title: 'Junk Rain!',
      desc: 'หลบตัวหลอกให้ได้',
      target: 2,
      duration: 16000,
      color: 'red'
    },
    goldenWindow: {
      id: 'goldenWindow',
      icon: '⭐',
      title: 'Golden Window!',
      desc: 'เก็บ Golden Food ให้ทัน',
      target: 1,
      duration: 14000,
      color: 'gold'
    },
    bossCommand: {
      id: 'bossCommand',
      icon: '👑',
      title: 'Boss Command!',
      desc: 'ตอบถูกใน Boss Phase',
      target: 4,
      duration: 18000,
      color: 'boss'
    },
    comboSprint: {
      id: 'comboSprint',
      icon: '🔥',
      title: 'Combo Sprint!',
      desc: 'ทำคอมโบให้ถึงเป้า',
      target: 5,
      duration: 15000,
      color: 'orange'
    }
  };

  const state = {
    active: null,
    progress: 0,
    startedAt: 0,
    endsAt: 0,
    completed: 0,
    failed: 0,
    bonus: 0,
    badges: [],
    lastEventAt: 0,
    nextEventAt: 0,
    lastPhase: '',
    lastCombo: 0,
    lastCorrect: 0,
    lastMiss: 0,
    timer: null,
    audio: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_MOBILE_V9 || null;
  }

  function getGameState() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function isPlaying(s) {
    return s && s.mode === 'game' && !s.ended;
  }

  function now() {
    return Date.now();
  }

  function rnd() {
    return Math.random();
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function injectStyle() {
    if ($('groups-mobile-v98-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-mobile-v98-style';
    style.textContent = `
      :root{
        --v98-safe-top: env(safe-area-inset-top, 0px);
        --v98-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      .v98-event-card{
        position:absolute;
        left:10px;
        right:10px;
        top:calc(204px + var(--v98-safe-top));
        z-index:37;
        border-radius:20px;
        padding:9px 10px;
        background:rgba(255,255,255,.92);
        box-shadow:0 14px 34px rgba(35,81,107,.16);
        pointer-events:none;
        display:none;
        border:2px solid rgba(255,255,255,.94);
      }

      body.v98-event-active .v98-event-card{
        display:block;
      }

      .v98-event-card.gold{
        background:linear-gradient(135deg,rgba(255,249,218,.96),rgba(255,255,255,.94));
        border-color:#ffd966;
      }

      .v98-event-card.green{
        background:linear-gradient(135deg,rgba(236,255,229,.96),rgba(255,255,255,.94));
        border-color:#a7f28e;
      }

      .v98-event-card.pink{
        background:linear-gradient(135deg,rgba(255,239,248,.96),rgba(255,255,255,.94));
        border-color:#ffb2d9;
      }

      .v98-event-card.red{
        background:linear-gradient(135deg,rgba(255,239,239,.96),rgba(255,255,255,.94));
        border-color:#ffaaa0;
      }

      .v98-event-card.orange,
      .v98-event-card.boss{
        background:linear-gradient(135deg,rgba(255,244,224,.97),rgba(255,255,255,.94));
        border-color:#ffb347;
      }

      .v98-event-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .v98-event-title{
        min-width:0;
        display:flex;
        align-items:center;
        gap:7px;
        font-size:13px;
        line-height:1.12;
        font-weight:1000;
        color:#244e68;
      }

      .v98-event-title span:last-child{
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .v98-event-count{
        flex:0 0 auto;
        border-radius:999px;
        padding:4px 7px;
        background:#fff5ca;
        color:#806000;
        font-size:11px;
        line-height:1;
        font-weight:1000;
      }

      .v98-event-desc{
        margin-top:4px;
        color:#7193a8;
        font-size:11px;
        line-height:1.18;
        font-weight:850;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .v98-event-bars{
        display:grid;
        grid-template-columns:1fr 58px;
        gap:7px;
        margin-top:7px;
      }

      .v98-event-progress,
      .v98-event-time{
        height:8px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(97,187,255,.16);
      }

      .v98-event-progress i,
      .v98-event-time i{
        display:block;
        height:100%;
        width:0%;
        border-radius:inherit;
        background:linear-gradient(90deg,#7ed957,#ffd966,#ff9d3f);
        transition:width .16s ease;
      }

      .v98-event-time i{
        background:linear-gradient(90deg,#61bbff,#ff9d3f,#ff7d7d);
      }

      .v98-alert{
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        z-index:86;
        width:min(84vw,430px);
        border-radius:32px;
        padding:18px 16px;
        text-align:center;
        background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(255,248,220,.96));
        box-shadow:0 28px 78px rgba(35,81,107,.26);
        color:#714300;
        font-size:clamp(24px,7vw,42px);
        line-height:1.08;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .v98-alert.show{
        animation:v98AlertPop .98s ease both;
      }

      .v98-alert small{
        display:block;
        margin-top:7px;
        color:#8a6a31;
        font-size:clamp(12px,3.4vw,16px);
        line-height:1.25;
        font-weight:900;
      }

      @keyframes v98AlertPop{
        0%{opacity:0; transform:translate(-50%,-42%) scale(.78);}
        18%{opacity:1; transform:translate(-50%,-50%) scale(1.08);}
        72%{opacity:1; transform:translate(-50%,-50%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-60%) scale(.94);}
      }

      body.v98-golden-window .game{
        filter:saturate(1.16) brightness(1.05);
      }

      body.v98-junk-rain .game{
        filter:saturate(1.08) contrast(1.03);
      }

      body.v98-event-complete .game{
        animation:v98CompleteFlash .45s ease both;
      }

      @keyframes v98CompleteFlash{
        0%{filter:brightness(1);}
        40%{filter:brightness(1.18) saturate(1.18);}
        100%{filter:brightness(1);}
      }

      .v98-summary-row{
        margin-top:10px;
        border-radius:22px;
        padding:12px;
        background:linear-gradient(180deg,#f7fdff,#ffffff);
        border:2px solid #d7edf7;
      }

      .v98-summary-title{
        font-size:14px;
        font-weight:1000;
        color:#244e68;
      }

      .v98-summary-text{
        margin-top:5px;
        font-size:12px;
        line-height:1.28;
        color:#7193a8;
        font-weight:850;
      }

      @media (max-height:740px){
        .v98-event-card{
          top:calc(182px + var(--v98-safe-top));
          padding:8px 9px;
        }

        .v98-event-desc{
          display:none;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureUi() {
    const game = $('game');
    if (!game) return;

    if (!$('v98EventCard')) {
      const card = DOC.createElement('div');
      card.id = 'v98EventCard';
      card.className = 'v98-event-card';
      card.innerHTML = `
        <div class="v98-event-top">
          <div class="v98-event-title">
            <span id="v98EventIcon">⭐</span>
            <span id="v98EventTitle">Event</span>
          </div>
          <div id="v98EventCount" class="v98-event-count">0/3</div>
        </div>
        <div id="v98EventDesc" class="v98-event-desc">ทำภารกิจพิเศษให้สำเร็จ</div>
        <div class="v98-event-bars">
          <div class="v98-event-progress"><i id="v98EventProgress"></i></div>
          <div class="v98-event-time"><i id="v98EventTime"></i></div>
        </div>
      `;
      game.appendChild(card);
    }

    if (!$('v98Alert')) {
      const alert = DOC.createElement('div');
      alert.id = 'v98Alert';
      alert.className = 'v98-alert';
      alert.innerHTML = `⭐ Event!<small>ทำภารกิจพิเศษให้สำเร็จ</small>`;
      game.appendChild(alert);
    }
  }

  function alertBox(title, desc) {
    const el = $('v98Alert');
    if (!el) return;

    el.innerHTML = `${title}<small>${desc || ''}</small>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function unlockAudio() {
    try {
      if (!state.audio) {
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if (AC) state.audio = new AC();
      }

      if (state.audio && state.audio.state === 'suspended') {
        state.audio.resume();
      }
    } catch (e) {}
  }

  function beep(freq, dur, type) {
    try {
      unlockAudio();

      const ctx = state.audio;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.value = freq || 760;

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.08));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + (dur || 0.08) + 0.02);
    } catch (e) {}
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function scheduleNext(delay) {
    state.nextEventAt = now() + (delay || (9000 + rnd() * 7000));
  }

  function chooseEvent(s) {
    const phase = s.phase || 'calm';

    if (phase === 'boss' && rnd() < 0.55) return EVENTS.bossCommand;

    const pool = [];

    pool.push(EVENTS.comboSprint);
    pool.push(EVENTS.junkRain);
    pool.push(EVENTS.vegStorm);
    pool.push(EVENTS.fruitRush);

    if (phase !== 'calm') pool.push(EVENTS.goldenWindow);
    if (s.feverActive) pool.push(EVENTS.goldenWindow);

    return pool[Math.floor(rnd() * pool.length) % pool.length];
  }

  function startEvent(eventDef) {
    if (!eventDef) return;

    state.active = Object.assign({}, eventDef);
    state.progress = 0;
    state.startedAt = now();
    state.endsAt = now() + eventDef.duration;
    state.lastEventAt = now();

    DOC.body.classList.add('v98-event-active');
    DOC.body.classList.toggle('v98-golden-window', eventDef.id === 'goldenWindow');
    DOC.body.classList.toggle('v98-junk-rain', eventDef.id === 'junkRain');

    alertBox(`${eventDef.icon} ${eventDef.title}`, eventDef.desc);

    beep(880, 0.11);
    setTimeout(() => beep(1160, 0.09), 105);
    vibrate([24, 18, 24]);

    updateUi();

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v98:event-start', {
        detail: {
          version: VERSION,
          event: eventDef.id,
          title: eventDef.title,
          target: eventDef.target,
          duration: eventDef.duration
        }
      }));
    } catch (e) {}
  }

  function clearEventClasses() {
    DOC.body.classList.remove(
      'v98-event-active',
      'v98-golden-window',
      'v98-junk-rain',
      'v98-event-complete'
    );
  }

  function completeEvent() {
    if (!state.active) return;

    const e = state.active;

    state.completed += 1;
    state.bonus += 25;

    const badge = `${e.icon} ${e.title.replace('!', '')}`;
    if (!state.badges.includes(badge)) state.badges.push(badge);

    alertBox(`สำเร็จ! ${e.icon}`, `Event Clear +25 Bonus`);
    DOC.body.classList.add('v98-event-complete');
    setTimeout(() => DOC.body.classList.remove('v98-event-complete'), 480);

    beep(980, 0.1);
    setTimeout(() => beep(1260, 0.12), 120);
    vibrate([35, 20, 35]);

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v98:event-complete', {
        detail: {
          version: VERSION,
          event: e.id,
          title: e.title,
          bonus: 25,
          completed: state.completed
        }
      }));
    } catch (err) {}

    state.active = null;
    state.progress = 0;

    clearEventClasses();
    scheduleNext(11500 + rnd() * 6000);
  }

  function failEvent() {
    if (!state.active) return;

    const e = state.active;

    state.failed += 1;

    alertBox(`พลาด Event`, `${e.icon} ${e.title} หมดเวลา`);
    beep(220, 0.12, 'triangle');

    try {
      WIN.dispatchEvent(new CustomEvent('groups:v98:event-fail', {
        detail: {
          version: VERSION,
          event: e.id,
          title: e.title,
          failed: state.failed
        }
      }));
    } catch (err) {}

    state.active = null;
    state.progress = 0;

    clearEventClasses();
    scheduleNext(9000 + rnd() * 5000);
  }

  function updateUi() {
    const card = $('v98EventCard');
    if (!card || !state.active) return;

    const e = state.active;

    card.className = `v98-event-card ${e.color || ''}`;

    const icon = $('v98EventIcon');
    const title = $('v98EventTitle');
    const desc = $('v98EventDesc');
    const count = $('v98EventCount');
    const progress = $('v98EventProgress');
    const time = $('v98EventTime');

    if (icon) icon.textContent = e.icon;
    if (title) title.textContent = e.title;
    if (desc) desc.textContent = e.desc;
    if (count) count.textContent = `${state.progress}/${e.target}`;

    if (progress) {
      progress.style.width = clamp((state.progress / Math.max(1, e.target)) * 100, 0, 100) + '%';
    }

    if (time) {
      const left = clamp((state.endsAt - now()) / Math.max(1, e.duration), 0, 1);
      time.style.width = (left * 100) + '%';
    }
  }

  function currentGroupKey(s) {
    try {
      return s && s.current && s.current.group && s.current.group.key;
    } catch (e) {
      return '';
    }
  }

  function currentKind(s) {
    try {
      return s && s.current && s.current.kind;
    } catch (e) {
      return '';
    }
  }

  function progressEvent(type, detail) {
    if (!state.active) return;

    const s = getGameState();
    const e = state.active;

    let add = 0;

    if (type === 'correct') {
      const groupKey = currentGroupKey(s);
      const kind = currentKind(s);
      const combo = Number(s.combo || 0);

      if (e.id === 'vegStorm' && groupKey === 'veg') add = 1;
      if (e.id === 'fruitRush' && groupKey === 'fruit') add = 1;
      if (e.id === 'goldenWindow' && kind === 'golden') add = 1;
      if (e.id === 'bossCommand' && (s.phase === 'boss' || detail.phase === 'boss')) add = 1;

      if (e.id === 'comboSprint') {
        state.progress = Math.max(state.progress, Math.min(e.target, combo));
        updateUi();

        if (state.progress >= e.target) completeEvent();
        return;
      }
    }

    if (type === 'dodge' && e.id === 'junkRain') {
      add = 1;
    }

    if (type === 'miss') {
      if (e.id === 'bossCommand' || e.id === 'comboSprint') {
        state.progress = Math.max(0, state.progress - 1);
        updateUi();
        return;
      }
    }

    if (add > 0) {
      state.progress = clamp(state.progress + add, 0, e.target);
      updateUi();

      if (state.progress >= e.target) {
        completeEvent();
      } else {
        beep(760 + state.progress * 70, 0.055);
      }
    }
  }

  function poll() {
    const s = getGameState();

    if (!isPlaying(s)) {
      if (state.active) {
        state.active = null;
        state.progress = 0;
        clearEventClasses();
      }
      return;
    }

    if (!state.nextEventAt) {
      scheduleNext(7000);
    }

    if (!state.active && now() >= state.nextEventAt) {
      startEvent(chooseEvent(s));
      return;
    }

    if (state.active) {
      if (now() >= state.endsAt) {
        failEvent();
        return;
      }

      updateUi();
    }
  }

  function appendSummary() {
    const card = DOC.querySelector('.summary-card');
    if (!card) return;

    let box = $('v98Summary');
    if (!box) {
      box = DOC.createElement('div');
      box.id = 'v98Summary';
      box.className = 'v98-summary-row';

      const actions = card.querySelector('.actions');
      card.insertBefore(box, actions);
    }

    const badgeText = state.badges.length ? state.badges.join(' • ') : 'ยังไม่มี Event Badge';

    box.innerHTML = `
      <div class="v98-summary-title">⚡ Event Director</div>
      <div class="v98-summary-text">
        สำเร็จ ${state.completed} Event • พลาด ${state.failed} Event • Bonus ${state.bonus}<br>
        ${badgeText}
      </div>
    `;

    try {
      const raw = localStorage.getItem('HHA_GROUPS_MOBILE_SUMMARY');
      if (raw) {
        const summary = JSON.parse(raw);
        summary.eventDirector = {
          version: VERSION,
          completed: state.completed,
          failed: state.failed,
          bonus: state.bonus,
          badges: state.badges.slice()
        };
        localStorage.setItem('HHA_GROUPS_MOBILE_SUMMARY', JSON.stringify(summary));
      }
    } catch (e) {}
  }

  function installEvents() {
    WIN.addEventListener('groups:judge', function (ev) {
      const d = ev.detail || {};

      if (d.ok || d.correct) {
        progressEvent('correct', d);
      } else {
        progressEvent('miss', d);
      }
    });

    WIN.addEventListener('groups:decoy-dodged', function (ev) {
      progressEvent('dodge', ev.detail || {});
    });

    WIN.addEventListener('groups:end', function () {
      if (state.active) {
        state.active = null;
        state.progress = 0;
        clearEventClasses();
      }

      setTimeout(appendSummary, 80);
      setTimeout(appendSummary, 450);
    });

    DOC.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    DOC.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  }

  function expose() {
    WIN.HHA_GROUPS_MOBILE_V98_EVENT_DIRECTOR = {
      version: VERSION,
      startEvent: function (id) {
        if (EVENTS[id]) startEvent(EVENTS[id]);
      },
      completeEvent,
      failEvent,
      getState: function () {
        return {
          version: VERSION,
          active: state.active,
          progress: state.progress,
          completed: state.completed,
          failed: state.failed,
          bonus: state.bonus,
          badges: state.badges.slice(),
          nextEventAt: state.nextEventAt
        };
      }
    };
  }

  function init() {
    injectStyle();
    ensureUi();
    installEvents();
    expose();

    state.timer = setInterval(poll, 180);

    console.info('[Groups Mobile v9.8] event director installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
