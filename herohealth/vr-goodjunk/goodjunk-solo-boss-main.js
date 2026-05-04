// === /herohealth/vr-goodjunk/goodjunk-solo-boss-main.js ===
// GoodJunk Solo Boss Main Integration
// PATCH v8.41.0-FULL-MAIN-INTEGRATION
// ✅ playable main loop
// ✅ HUD / timer / lives / combo
// ✅ spawn loop using GJBS.makeFood()
// ✅ hit / miss / escape / end bridge
// ✅ works with v8.40.1-8.40.8 addons
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.41.0-FULL-MAIN-INTEGRATION';

  const CFG = {
    run: QS.get('run') || '',
    mode: QS.get('mode') || QS.get('entry') || 'solo_boss',
    diff: String(QS.get('diff') || 'normal').toLowerCase(),
    time: Math.max(45, Number(QS.get('time')) || 120),
    autoStart: QS.get('mainAutoStart') !== '0',
    fallbackUI: QS.get('mainFallback') !== '0',
    debug: QS.get('debugBoss') === '1'
  };

  const DIFF = {
    easy: {
      lives: 5,
      baseSpawnDelay: 1250,
      baseFallDuration: 5200,
      goodScore: 12,
      junkPenalty: 8,
      fakePenalty: 10
    },
    normal: {
      lives: 4,
      baseSpawnDelay: 1050,
      baseFallDuration: 4700,
      goodScore: 12,
      junkPenalty: 10,
      fakePenalty: 12
    },
    hard: {
      lives: 3,
      baseSpawnDelay: 900,
      baseFallDuration: 4100,
      goodScore: 14,
      junkPenalty: 12,
      fakePenalty: 14
    },
    challenge: {
      lives: 3,
      baseSpawnDelay: 760,
      baseFallDuration: 3600,
      goodScore: 15,
      junkPenalty: 15,
      fakePenalty: 18
    }
  };

  const D = DIFF[CFG.diff] || DIFF.normal;

  const state = {
    mounted:false,
    started:false,
    ended:false,
    paused:false,

    startAt:0,
    elapsed:0,
    timeLeft:CFG.time,

    score:0,
    lives:D.lives,
    combo:0,
    maxCombo:0,

    spawned:0,
    goodHits:0,
    junkHits:0,
    fakeHits:0,
    goodMissed:0,
    totalMisses:0,

    active:new Set(),
    spawnTimer:null,
    clockTimer:null,

    root:null,
    area:null,
    hud:null,
    message:null,
    startOverlay:null
  };

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function shouldAutoPlay(){
    return (
      CFG.autoStart &&
      (
        CFG.run === 'play' ||
        CFG.mode === 'solo' ||
        CFG.mode === 'boss' ||
        CFG.mode === 'solo_boss'
      )
    );
  }

  function getShim(){
    return WIN.GJBS || WIN.GoodJunkSoloBossShim || null;
  }

  function dispatch(name, detail){
    WIN.dispatchEvent(new CustomEvent(name, {
      detail:{
        patch:PATCH,
        source:'main-integration',
        ...(detail || {})
      }
    }));
  }

  function ensureStyle(){
    if(DOC.getElementById('gjSoloBossMainStyle')) return;

    const css = DOC.createElement('style');
    css.id = 'gjSoloBossMainStyle';
    css.textContent = `
      .gjm-root{
        position:fixed;
        inset:0;
        z-index:20;
        overflow:hidden;
        background:
          radial-gradient(circle at 20% 18%,rgba(134,239,172,.35),transparent 30%),
          radial-gradient(circle at 82% 18%,rgba(251,191,36,.34),transparent 32%),
          linear-gradient(180deg,#dcfce7 0%,#eff6ff 48%,#fef3c7 100%);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        color:#172033;
        touch-action:manipulation;
      }

      .gjm-bg-orbs{
        position:absolute;
        inset:0;
        pointer-events:none;
        overflow:hidden;
      }

      .gjm-bg-orbs i{
        position:absolute;
        width:140px;
        height:140px;
        border-radius:999px;
        background:rgba(255,255,255,.34);
        filter:blur(2px);
        animation:gjmFloat 7s ease-in-out infinite alternate;
      }

      .gjm-bg-orbs i:nth-child(1){ left:6%; top:16%; }
      .gjm-bg-orbs i:nth-child(2){ right:8%; top:28%; animation-delay:.8s; }
      .gjm-bg-orbs i:nth-child(3){ left:42%; bottom:12%; animation-delay:1.4s; }

      .gjm-hud{
        position:absolute;
        left:10px;
        right:10px;
        top:calc(10px + env(safe-area-inset-top));
        z-index:40;
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:8px;
        pointer-events:none;
      }

      .gjm-pill{
        border-radius:18px;
        background:rgba(255,255,255,.88);
        border:2px solid rgba(255,255,255,.92);
        box-shadow:0 10px 24px rgba(15,23,42,.12);
        padding:8px 10px;
        min-height:54px;
        backdrop-filter:blur(8px);
      }

      .gjm-pill span{
        display:block;
        font-size:11px;
        font-weight:900;
        color:#64748b;
        text-transform:uppercase;
        letter-spacing:.06em;
      }

      .gjm-pill b{
        display:block;
        margin-top:2px;
        font-size:21px;
        line-height:1;
        color:#0f172a;
      }

      .gjm-area{
        position:absolute;
        left:0;
        right:0;
        top:0;
        bottom:0;
        overflow:hidden;
      }

      .gjm-lane{
        position:absolute;
        left:0;
        right:0;
        bottom:0;
        height:22%;
        background:linear-gradient(180deg,transparent,rgba(34,197,94,.16));
        pointer-events:none;
      }

      .gjm-food{
        position:absolute;
        top:-90px;
        width:76px;
        min-height:86px;
        border:0;
        border-radius:26px;
        background:rgba(255,255,255,.94);
        box-shadow:
          0 14px 28px rgba(15,23,42,.18),
          inset 0 -5px 0 rgba(15,23,42,.06);
        display:grid;
        place-items:center;
        padding:8px 6px;
        cursor:pointer;
        user-select:none;
        touch-action:manipulation;
        animation-name:gjmFall;
        animation-timing-function:linear;
        animation-fill-mode:forwards;
        animation-duration:var(--dur, 4.5s);
      }

      .gjm-food:active{
        transform:scale(.94);
      }

      .gjm-food b{
        display:block;
        font-size:38px;
        line-height:1;
      }

      .gjm-food span{
        display:block;
        margin-top:3px;
        max-width:70px;
        font-size:11px;
        font-weight:900;
        line-height:1.05;
        color:#334155;
        text-align:center;
      }

      .gjm-food[data-food-type="good"]{
        background:linear-gradient(180deg,#ffffff,#ecfdf5);
      }

      .gjm-food[data-food-type="junk"]{
        background:linear-gradient(180deg,#ffffff,#fff7ed);
      }

      .gjm-food[data-food-type="fake"]{
        background:linear-gradient(180deg,#ffffff,#fef3c7);
      }

      .gjm-message{
        position:absolute;
        left:50%;
        top:52%;
        z-index:45;
        transform:translate(-50%,-50%) scale(.92);
        width:min(430px, calc(100vw - 26px));
        border-radius:28px;
        padding:16px;
        background:rgba(15,23,42,.88);
        color:#fff;
        text-align:center;
        box-shadow:0 20px 50px rgba(15,23,42,.32);
        opacity:0;
        pointer-events:none;
        transition:opacity .16s ease, transform .16s ease;
      }

      .gjm-message.show{
        opacity:1;
        transform:translate(-50%,-50%) scale(1);
      }

      .gjm-message b{
        display:block;
        font-size:24px;
        line-height:1.1;
      }

      .gjm-message span{
        display:block;
        margin-top:6px;
        color:#fde68a;
        font-size:14px;
        font-weight:800;
        line-height:1.25;
      }

      .gjm-start{
        position:absolute;
        inset:0;
        z-index:80;
        display:grid;
        place-items:center;
        background:
          radial-gradient(circle at 50% 35%,rgba(255,255,255,.72),transparent 40%),
          rgba(15,23,42,.38);
        backdrop-filter:blur(4px);
      }

      .gjm-start-card{
        width:min(520px, calc(100vw - 28px));
        border-radius:32px;
        background:rgba(255,255,255,.96);
        border:3px solid rgba(255,255,255,.95);
        box-shadow:0 30px 80px rgba(15,23,42,.34);
        padding:22px;
        text-align:center;
      }

      .gjm-start-icon{
        font-size:58px;
        line-height:1;
      }

      .gjm-start-card h1{
        margin:8px 0 0;
        color:#0f172a;
        font-size:clamp(28px,7vw,44px);
        line-height:1.05;
      }

      .gjm-start-card p{
        margin:10px auto 0;
        color:#475569;
        font-size:15px;
        font-weight:800;
        line-height:1.4;
        max-width:420px;
      }

      .gjm-start-btn{
        margin-top:16px;
        border:0;
        border-radius:22px;
        padding:14px 20px;
        background:linear-gradient(135deg,#22c55e,#2563eb);
        color:#fff;
        font-size:17px;
        font-weight:1000;
        box-shadow:0 14px 28px rgba(37,99,235,.24);
        cursor:pointer;
      }

      .gjm-start-btn:active{
        transform:scale(.97);
      }

      .gjm-debug{
        position:fixed;
        right:10px;
        top:calc(210px + env(safe-area-inset-top));
        z-index:100070;
        width:min(280px, calc(100vw - 20px));
        border-radius:16px;
        padding:10px;
        background:rgba(15,23,42,.84);
        color:#e5e7eb;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        font-size:11px;
        line-height:1.35;
        white-space:pre-wrap;
        pointer-events:none;
      }

      @keyframes gjmFall{
        from{ transform:translateY(0) rotate(-2deg); }
        to{ transform:translateY(calc(100dvh + 130px)) rotate(8deg); }
      }

      @keyframes gjmFloat{
        from{ transform:translateY(0) scale(1); }
        to{ transform:translateY(-22px) scale(1.08); }
      }

      @media (max-width:720px){
        .gjm-hud{
          grid-template-columns:repeat(2,1fr);
          top:calc(8px + env(safe-area-inset-top));
          gap:6px;
        }

        .gjm-pill{
          min-height:46px;
          border-radius:15px;
          padding:7px 9px;
        }

        .gjm-pill b{
          font-size:18px;
        }

        .gjm-pill span{
          font-size:10px;
        }

        .gjm-food{
          width:66px;
          min-height:76px;
          border-radius:22px;
        }

        .gjm-food b{
          font-size:33px;
        }

        .gjm-food span{
          font-size:10px;
          max-width:60px;
        }

        .gjm-start-card{
          padding:18px;
          border-radius:27px;
        }

        .gjm-start-icon{
          font-size:50px;
        }
      }
    `;

    DOC.head.appendChild(css);
  }

  function ensureMainUI(){
    if(state.mounted) return;

    ensureStyle();

    let root = DOC.getElementById('gjSoloBossMain');

    if(!root && CFG.fallbackUI){
      root = DOC.createElement('main');
      root.id = 'gjSoloBossMain';
      root.className = 'gjm-root';
      root.innerHTML = `
        <div class="gjm-bg-orbs"><i></i><i></i><i></i></div>

        <section class="gjm-hud" id="gjmHud">
          <div class="gjm-pill"><span>Score</span><b id="gjmScore">0</b></div>
          <div class="gjm-pill"><span>Time</span><b id="gjmTime">${CFG.time}</b></div>
          <div class="gjm-pill"><span>Lives</span><b id="gjmLives">${'💚'.repeat(D.lives)}</b></div>
          <div class="gjm-pill"><span>Combo</span><b id="gjmCombo">x0</b></div>
        </section>

        <section class="gjm-area" id="gjSoloBossArea" aria-label="GoodJunk Solo Boss play area">
          <div class="gjm-lane"></div>
        </section>

        <div class="gjm-message" id="gjmMessage" aria-live="polite">
          <b id="gjmMessageMain">Ready!</b>
          <span id="gjmMessageSub">เลือกอาหารดี หลบอาหารขยะ</span>
        </div>

        <section class="gjm-start" id="gjmStartOverlay">
          <div class="gjm-start-card">
            <div class="gjm-start-icon">🥗👾</div>
            <h1>GoodJunk Solo Boss</h1>
            <p>เก็บอาหารดีเพื่อโจมตีบอส หลบอาหารขยะและอาหารหลอกตา ทำคอมโบให้สูงเพื่อชนะบอส!</p>
            <button class="gjm-start-btn" id="gjmStartBtn" type="button">เริ่มสู้บอส</button>
          </div>
        </section>
      `;
      DOC.body.appendChild(root);
    }

    state.root = root || DOC.body;
    state.area =
      DOC.getElementById('gjSoloBossArea') ||
      DOC.getElementById('gameArea') ||
      DOC.querySelector('.game-area') ||
      DOC.querySelector('.play-area') ||
      state.root;

    state.hud = DOC.getElementById('gjmHud');
    state.message = DOC.getElementById('gjmMessage');
    state.startOverlay = DOC.getElementById('gjmStartOverlay');

    const btn = DOC.getElementById('gjmStartBtn');
    if(btn && !btn.dataset.bound){
      btn.dataset.bound = '1';
      btn.addEventListener('click', function(){
        startGame({ manual:true });
      });
    }

    state.mounted = true;
    updateHUD();
  }

  function updateHUD(){
    const score = DOC.getElementById('gjmScore');
    const time = DOC.getElementById('gjmTime');
    const lives = DOC.getElementById('gjmLives');
    const combo = DOC.getElementById('gjmCombo');

    if(score) score.textContent = String(Math.max(0, Math.round(state.score)));
    if(time) time.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    if(lives) lives.textContent = state.lives > 0 ? '💚'.repeat(state.lives) : '💔';
    if(combo) combo.textContent = `x${state.combo}`;
  }

  let msgTimer = null;
  function showMessage(main, sub, ms){
    const box = DOC.getElementById('gjmMessage');
    if(!box) return;

    const a = DOC.getElementById('gjmMessageMain');
    const b = DOC.getElementById('gjmMessageSub');

    if(a) a.textContent = main || '';
    if(b) b.textContent = sub || '';

    box.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(()=>box.classList.remove('show'), ms || 1100);
  }

  function hideStart(){
    if(state.startOverlay){
      state.startOverlay.style.display = 'none';
    }
  }

  function randomX(){
    return clamp(5 + Math.random() * 82, 5, 87);
  }

  function makeFood(){
    const shim = getShim();

    let food = shim?.makeFood?.();

    if(!food){
      food = {
        type:'good',
        icon:'🥦',
        name:'อาหารดี',
        group:'veg',
        tip:'อาหารดีช่วยให้ร่างกายแข็งแรง'
      };
    }

    return food;
  }

  function getSpawnDelay(){
    const shim = getShim();
    if(shim?.getSpawnDelay){
      return shim.getSpawnDelay(D.baseSpawnDelay);
    }
    return D.baseSpawnDelay;
  }

  function getFallDuration(){
    const shim = getShim();
    const speed = shim?.getItemSpeed ? shim.getItemSpeed(1) : 1;
    return clamp(D.baseFallDuration / Math.max(.55, speed), 2200, 6800);
  }

  function spawnFood(){
    if(!state.started || state.ended || state.paused) return;

    ensureMainUI();

    const food = makeFood();
    const el = DOC.createElement('button');

    el.type = 'button';
    el.className = 'gjm-food goodjunk-food food-target';
    el.dataset.foodType = food.type;
    el.dataset.foodName = food.name;
    el.dataset.foodIcon = food.icon;
    el.dataset.foodGroup = food.group || food.type;
    el.dataset.foodId = food.id || `main_${Date.now()}_${Math.floor(Math.random() * 99999)}`;

    el.style.left = `${randomX()}%`;
    el.style.setProperty('--dur', `${getFallDuration()}ms`);

    el.innerHTML = `<b>${esc(food.icon)}</b><span>${esc(food.name)}</span>`;

    const shim = getShim();
    if(shim?.decorateElement){
      shim.decorateElement(el, food, {
        bindClick:false
      });
    }

    el.addEventListener('click', function(ev){
      ev.preventDefault();
      hitFood(food, el, ev);
    }, { passive:false });

    el.addEventListener('animationend', function(){
      foodEscaped(food, el);
    });

    state.area.appendChild(el);
    state.active.add(el);
    state.spawned += 1;

    renderDebug();
  }

  function spawnLoop(){
    if(!state.started || state.ended) return;

    spawnFood();

    clearTimeout(state.spawnTimer);
    state.spawnTimer = setTimeout(spawnLoop, getSpawnDelay());
  }

  function hitFood(food, el, ev){
    if(!state.started || state.ended) return;
    if(!food || !el) return;
    if(el.dataset.consumed === '1') return;

    el.dataset.consumed = '1';
    state.active.delete(el);

    const x = ev && typeof ev.clientX === 'number'
      ? clamp((ev.clientX / Math.max(1, WIN.innerWidth)) * 100, 0, 100)
      : 50;

    const y = ev && typeof ev.clientY === 'number'
      ? clamp((ev.clientY / Math.max(1, WIN.innerHeight)) * 100, 0, 100)
      : 50;

    const shim = getShim();
    shim?.hit?.(food, { el, x, y });

    if(food.type === 'good'){
      state.goodHits += 1;
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += D.goodScore + Math.min(30, state.combo * 2);

      showMessage(
        state.combo >= 5 ? `Combo x${state.combo}!` : 'ดีมาก!',
        'อาหารดีช่วยโจมตีบอส'
      );
    }else if(food.type === 'fake'){
      state.fakeHits += 1;
      state.totalMisses += 1;
      state.combo = 0;
      state.lives = Math.max(0, state.lives - 1);
      state.score = Math.max(0, state.score - D.fakePenalty);

      showMessage('อาหารหลอกตา!', 'ดูน้ำตาล น้ำมัน และซอสแฝงด้วย', 1300);
    }else{
      state.junkHits += 1;
      state.totalMisses += 1;
      state.combo = 0;
      state.lives = Math.max(0, state.lives - 1);
      state.score = Math.max(0, state.score - D.junkPenalty);

      showMessage('ระวัง junk!', 'ของทอด น้ำหวาน ขนมหวาน ทำให้บอสได้เปรียบ', 1300);
    }

    el.remove();
    updateHUD();
    renderDebug();

    if(state.lives <= 0){
      endGame('no-lives');
    }
  }

  function foodEscaped(food, el){
    if(!state.started || state.ended) return;
    if(!el || el.dataset.consumed === '1') return;

    el.dataset.consumed = '1';
    state.active.delete(el);

    if(food && food.type === 'good'){
      state.goodMissed += 1;
      state.totalMisses += 1;
      state.combo = 0;
      state.lives = Math.max(0, state.lives - 1);

      getShim()?.miss?.(food, {
        el,
        x:50,
        y:88,
        reason:'good-food-escaped'
      });

      showMessage('พลาดอาหารดี!', 'อาหารดีหลุดไปแล้ว ลองเก็บให้ทัน', 1100);
    }

    el.remove();
    updateHUD();
    renderDebug();

    if(state.lives <= 0){
      endGame('no-lives');
    }
  }

  function startClock(){
    clearInterval(state.clockTimer);

    state.clockTimer = setInterval(function(){
      if(!state.started || state.ended || state.paused) return;

      state.elapsed = (Date.now() - state.startAt) / 1000;
      state.timeLeft = Math.max(0, CFG.time - state.elapsed);

      updateHUD();

      if(state.timeLeft <= 0){
        endGame('time-up');
      }

      renderDebug();
    }, 250);
  }

  function clearActiveItems(){
    state.active.forEach(el => {
      try{ el.remove(); }catch(e){}
    });
    state.active.clear();
  }

  function startGame(extra){
    if(state.started && !state.ended) return;

    ensureMainUI();
    hideStart();

    state.started = true;
    state.ended = false;
    state.paused = false;

    state.startAt = Date.now();
    state.elapsed = 0;
    state.timeLeft = CFG.time;

    state.score = 0;
    state.lives = D.lives;
    state.combo = 0;
    state.maxCombo = 0;

    state.spawned = 0;
    state.goodHits = 0;
    state.junkHits = 0;
    state.fakeHits = 0;
    state.goodMissed = 0;
    state.totalMisses = 0;

    clearActiveItems();

    const shim = getShim();
    if(shim?.start){
      shim.start({
        reason:'main-integration-start',
        ...(extra || {})
      });
    }else{
      dispatch('gj:solo-boss-start', {
        reason:'main-integration-start-no-shim',
        ...(extra || {})
      });
    }

    showMessage('เริ่มสู้บอส!', 'เก็บอาหารดี หลบ junk และอาหารหลอกตา', 1400);

    updateHUD();
    startClock();
    spawnLoop();
    renderDebug();
  }

  function endGame(reason, extra){
    if(state.ended) return;

    state.ended = true;
    state.paused = true;

    clearTimeout(state.spawnTimer);
    clearInterval(state.clockTimer);

    clearActiveItems();

    const summary = {
      reason:reason || 'finished',
      score:Math.max(0, Math.round(state.score)),
      elapsedSec:Math.round(state.elapsed),
      timeLeft:Math.round(state.timeLeft),
      lives:state.lives,
      combo:state.combo,
      maxCombo:state.maxCombo,
      spawned:state.spawned,
      goodHits:state.goodHits,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      goodMissed:state.goodMissed,
      misses:state.totalMisses,
      ...(extra || {})
    };

    const shim = getShim();
    if(shim?.end){
      shim.end(summary.reason, summary);
    }else{
      dispatch('gj:game-end', summary);
    }

    showMessage(
      reason === 'no-lives' ? 'พลังหมดแล้ว!' : 'หมดเวลา!',
      'กำลังสรุปผลการสู้บอส',
      1200
    );

    setTimeout(function(){
      if(shim?.forceSummary){
        shim.forceSummary({
          reason:'main-integration-end-summary',
          ...summary
        });
      }else if(WIN.GoodJunkSoloBossReward?.showSummary){
        WIN.GoodJunkSoloBossReward.showSummary(summary);
      }
    }, 850);

    try{
      localStorage.setItem('GJ_SOLO_BOSS_MAIN_LAST', JSON.stringify({
        patch:PATCH,
        ...summary,
        savedAt:new Date().toISOString()
      }));
    }catch(e){}

    renderDebug();
  }

  function onBossDefeated(e){
    if(state.ended) return;

    state.score += 250;
    updateHUD();

    endGame('boss-defeated', {
      defeated:true,
      ...(e.detail || {})
    });
  }

  function ensureDebug(){
    if(!CFG.debug) return null;

    let box = DOC.getElementById('gjSoloBossMainDebug');
    if(box) return box;

    box = DOC.createElement('pre');
    box.id = 'gjSoloBossMainDebug';
    box.className = 'gjm-debug';
    DOC.body.appendChild(box);

    return box;
  }

  function renderDebug(){
    if(!CFG.debug) return;

    const box = ensureDebug();
    if(!box) return;

    const mod = getShim()?.getModifiers?.() || {};

    box.textContent =
`GoodJunk Main
${PATCH}

started: ${state.started}
ended: ${state.ended}
time: ${Math.ceil(state.timeLeft)}
score: ${Math.round(state.score)}
lives: ${state.lives}
combo: ${state.combo}
maxCombo: ${state.maxCombo}

spawned: ${state.spawned}
good: ${state.goodHits}
junk: ${state.junkHits}
fake: ${state.fakeHits}
goodMissed: ${state.goodMissed}

pressure: ${mod.pressure ?? '-'}
assist: ${mod.assist ?? '-'}
phase: ${mod.phaseId ?? '-'}`;
  }

  function boot(){
    ensureMainUI();

    WIN.addEventListener('gj:boss-defeated', onBossDefeated);

    if(shouldAutoPlay()){
      setTimeout(function(){
        startGame({ auto:true });
      }, 450);
    }
  }

  WIN.GoodJunkSoloBossMain = {
    version:PATCH,
    startGame,
    endGame,
    spawnFood,
    hitFood,
    foodEscaped,
    updateHUD,
    getState:()=>JSON.parse(JSON.stringify({
      mounted:state.mounted,
      started:state.started,
      ended:state.ended,
      elapsed:state.elapsed,
      timeLeft:state.timeLeft,
      score:state.score,
      lives:state.lives,
      combo:state.combo,
      maxCombo:state.maxCombo,
      spawned:state.spawned,
      goodHits:state.goodHits,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      goodMissed:state.goodMissed,
      totalMisses:state.totalMisses
    }))
  };

  WIN.GJSBM = WIN.GoodJunkSoloBossMain;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();
