// === /fitness/js/engine.js ===
// Shadow Breaker Engine (Module, self-contained)
// ✅ View switching hard-fix (menu not overlay)
// ✅ Mobile-safe: lock scroll + full-screen play view via CSS patch (already in CSS)
// ✅ Targets clickable + boss phases
// ✅ FX restored: popText/burst/shake/flash (NO extra files needed)
// ✅ Optional AI bridge: window.RB_AI (if ai-predictor.js loaded elsewhere)

'use strict';

(function(){
  const DOC = document;
  const qs = (k, d=null) => { try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  // ---------- DOM ----------
  const VIEWS = {
    menu: DOC.getElementById('sb-view-menu'),
    play: DOC.getElementById('sb-view-play'),
    result: DOC.getElementById('sb-view-result'),
  };

  const UI = {
    // menu
    modeNormal: DOC.getElementById('sb-mode-normal'),
    modeResearch: DOC.getElementById('sb-mode-research'),
    modeDesc: DOC.getElementById('sb-mode-desc'),
    diff: DOC.getElementById('sb-diff'),
    time: DOC.getElementById('sb-time'),
    researchBox: DOC.getElementById('sb-research-box'),
    partId: DOC.getElementById('sb-part-id'),
    partGroup: DOC.getElementById('sb-part-group'),
    partNote: DOC.getElementById('sb-part-note'),
    btnPlay: DOC.getElementById('sb-btn-play'),
    btnResearch: DOC.getElementById('sb-btn-research'),
    btnHowto: DOC.getElementById('sb-btn-howto'),
    howto: DOC.getElementById('sb-howto'),

    // play HUD
    txtTime: DOC.getElementById('sb-text-time'),
    txtScore: DOC.getElementById('sb-text-score'),
    txtCombo: DOC.getElementById('sb-text-combo'),
    txtPhase: DOC.getElementById('sb-text-phase'),
    txtMiss: DOC.getElementById('sb-text-miss'),
    txtShield: DOC.getElementById('sb-text-shield'),
    bossName: DOC.getElementById('sb-current-boss-name'),

    hpYouTop: DOC.getElementById('sb-hp-you-top'),
    hpBossTop: DOC.getElementById('sb-hp-boss-top'),
    hpYouBottom: DOC.getElementById('sb-hp-you-bottom'),
    hpBossBottom: DOC.getElementById('sb-hp-boss-bottom'),

    feverBar: DOC.getElementById('sb-fever-bar'),
    feverLabel: DOC.getElementById('sb-label-fever'),

    // stage
    layer: DOC.getElementById('sb-target-layer'),
    msgMain: DOC.getElementById('sb-msg-main'),

    // meta
    metaEmoji: DOC.getElementById('sb-meta-emoji'),
    metaName: DOC.getElementById('sb-meta-name'),
    metaDesc: DOC.getElementById('sb-meta-desc'),
    bossPhaseLabel: DOC.getElementById('sb-boss-phase-label'),
    bossShieldLabel: DOC.getElementById('sb-boss-shield-label'),

    // controls
    btnBackMenu: DOC.getElementById('sb-btn-back-menu'),
    chkPause: DOC.getElementById('sb-btn-pause'),

    // result
    resTime: DOC.getElementById('sb-res-time'),
    resScore: DOC.getElementById('sb-res-score'),
    resMaxCombo: DOC.getElementById('sb-res-max-combo'),
    resMiss: DOC.getElementById('sb-res-miss'),
    resPhase: DOC.getElementById('sb-res-phase'),
    resBossCleared: DOC.getElementById('sb-res-boss-cleared'),
    resAcc: DOC.getElementById('sb-res-acc'),
    resGrade: DOC.getElementById('sb-res-grade'),
    btnRetry: DOC.getElementById('sb-btn-result-retry'),
    btnMenu2: DOC.getElementById('sb-btn-result-menu'),
    btnDlEvents: DOC.getElementById('sb-btn-download-events'),
    btnDlSession: DOC.getElementById('sb-btn-download-session'),
  };

  // ---------- utils ----------
  const clamp01 = (v)=>Math.max(0, Math.min(1, Number(v)||0));
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const rand = (a,b)=>a + Math.random()*(b-a);

  // ---------- FX (restored) ----------
  // Lightweight DOM FX: popText / burst / shake / flash
  const FX = (function(){
    const WIN = window;
    const has = (x)=>!!x;

    let layer = null;
    let styleInjected = false;

    function injectStyle(){
      if (styleInjected) return;
      styleInjected = true;

      const css = `
      .sb-fx-layer{
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
      }
      .sb-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font-weight: 900;
        letter-spacing: .2px;
        text-shadow: 0 10px 28px rgba(0,0,0,.55);
        opacity: 0;
        animation: sbfxPop 680ms ease-out forwards;
        will-change: transform, opacity, filter;
        user-select:none;
      }
      .sb-fx-pop.good{ color: #a7f3d0; }
      .sb-fx-pop.hit{ color: #93c5fd; }
      .sb-fx-pop.warn{ color: #fde68a; }
      .sb-fx-pop.bad{ color: #fda4af; }

      @keyframes sbfxPop{
        0%   { opacity:0; transform: translate(-50%,-40%) scale(.85); filter: blur(0px); }
        15%  { opacity:1; transform: translate(-50%,-55%) scale(1.06); }
        65%  { opacity:1; transform: translate(-50%,-92%) scale(1.0); }
        100% { opacity:0; transform: translate(-50%,-120%) scale(.98); filter: blur(.2px); }
      }

      .sb-fx-dot{
        position:absolute;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255,255,255,.9);
        opacity: .95;
        transform: translate(-50%,-50%);
        animation: sbfxDot 520ms ease-out forwards;
        will-change: transform, opacity;
      }
      @keyframes sbfxDot{
        0%   { opacity:1; transform: translate(var(--x0), var(--y0)) scale(1); }
        100% { opacity:0; transform: translate(var(--x1), var(--y1)) scale(.6); }
      }

      .sbfx-shake{
        animation: sbfxShake 220ms ease-in-out;
      }
      @keyframes sbfxShake{
        0%{ transform: translate3d(0,0,0); }
        25%{ transform: translate3d(-6px,0,0); }
        55%{ transform: translate3d(6px,0,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      .sbfx-flash{
        position:absolute;
        inset:0;
        background: radial-gradient(800px 420px at 50% 45%, rgba(56,189,248,.22), transparent 60%);
        opacity:0;
        animation: sbfxFlash 260ms ease-out forwards;
      }
      @keyframes sbfxFlash{
        0%{ opacity:0; }
        30%{ opacity:1; }
        100%{ opacity:0; }
      }
      `;
      const st = DOC.createElement('style');
      st.textContent = css;
      DOC.head.appendChild(st);
    }

    function ensureLayer(){
      injectStyle();
      if (layer && DOC.body.contains(layer)) return layer;
      layer = DOC.getElementById('sb-fx-layer');
      if (!layer){
        layer = DOC.createElement('div');
        layer.id = 'sb-fx-layer';
        layer.className = 'sb-fx-layer';
        DOC.body.appendChild(layer);
      }
      return layer;
    }

    function popText(x, y, text, tone){
      const L = ensureLayer();
      const el = DOC.createElement('div');
      el.className = `sb-fx-pop ${tone||'hit'}`;
      el.textContent = text;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.fontSize = (Math.max(16, Math.min(34, 18 + text.length*0.2))) + 'px';
      L.appendChild(el);
      window.setTimeout(()=>el.remove(), 750);
    }

    function burst(x, y, n, spread){
      const L = ensureLayer();
      const count = clamp(n ?? 10, 6, 24);
      const sp = clamp(spread ?? 70, 40, 140);
      for (let i=0;i<count;i++){
        const d = DOC.createElement('div');
        d.className = 'sb-fx-dot';
        // random start (near point)
        const x0 = x + rand(-6,6);
        const y0 = y + rand(-6,6);
        const ang = rand(0, Math.PI*2);
        const r = rand(sp*0.35, sp);
        const x1 = x0 + Math.cos(ang) * r;
        const y1 = y0 + Math.sin(ang) * r;

        d.style.left = x0 + 'px';
        d.style.top = y0 + 'px';
        d.style.setProperty('--x0', `-50%`);
        d.style.setProperty('--y0', `-50%`);
        d.style.setProperty('--x1', `${(x1-x0)}px`);
        d.style.setProperty('--y1', `${(y1-y0)}px`);

        // tint a bit
        const tint = Math.random();
        if (tint < .25) d.style.background = 'rgba(56,189,248,.95)';
        else if (tint < .5) d.style.background = 'rgba(168,85,247,.95)';
        else if (tint < .7) d.style.background = 'rgba(34,197,94,.95)';
        else if (tint < .85) d.style.background = 'rgba(250,204,21,.95)';
        else d.style.background = 'rgba(255,255,255,.92)';

        L.appendChild(d);
        window.setTimeout(()=>d.remove(), 620);
      }
    }

    function shake(el){
      if (!el) return;
      el.classList.remove('sbfx-shake');
      // force reflow
      void el.offsetWidth;
      el.classList.add('sbfx-shake');
      window.setTimeout(()=>el.classList.remove('sbfx-shake'), 260);
    }

    function flash(stageEl){
      if (!stageEl) return;
      const f = DOC.createElement('div');
      f.className = 'sbfx-flash';
      stageEl.appendChild(f);
      window.setTimeout(()=>f.remove(), 320);
    }

    // convert element-local point to viewport (for FX layer)
    function toViewportXY(el, localX, localY){
      const r = el.getBoundingClientRect();
      return { x: r.left + localX, y: r.top + localY };
    }

    return { popText, burst, shake, flash, toViewportXY };
  })();

  // ---------- game data ----------
  const BOSSES = [
    { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', hp: 100 },
    { name:'Iron Shadow',  emoji:'🦾', desc:'จะมี Decoy เยอะขึ้น—อย่าหลง', hp: 120 },
    { name:'Neon Fury',    emoji:'💥', desc:'จังหวะเร็วขึ้น—คุมคอมโบให้ดี', hp: 140 },
  ];

  // ---------- state ----------
  const S = {
    mode: 'normal',
    diff: 'normal',
    durationSec: 70,
    running: false,
    paused: false,

    tLeft: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    shield: 0,
    fever: 0,
    youHp: 100,
    bossHp: 100,
    bossIndex: 0,
    phase: 1,
    bossesCleared: 0,

    hits: 0,
    total: 0,

    rafId: 0,
    spawnTimer: 0,
    lastTick: 0,
  };

  // ---------- view helpers ----------
  function showView(which){
    for (const k of Object.keys(VIEWS)){
      const el = VIEWS[k];
      if (!el) continue;
      el.classList.remove('is-active');
    }
    const v = VIEWS[which];
    if (v) v.classList.add('is-active');
  }

  function setMode(m){
    S.mode = (m === 'research') ? 'research' : 'normal';

    UI.modeNormal?.classList.toggle('is-active', S.mode==='normal');
    UI.modeResearch?.classList.toggle('is-active', S.mode==='research');

    if (UI.researchBox){
      UI.researchBox.classList.toggle('is-visible', S.mode==='research');
    }

    if (UI.modeDesc){
      UI.modeDesc.textContent = (S.mode === 'research')
        ? 'Research: เก็บข้อมูลผู้เข้าร่วม + ล็อกการช่วยเหลือ AI เพื่อความยุติธรรม'
        : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
    }

    if (UI.btnResearch) UI.btnResearch.style.display = (S.mode==='research') ? 'inline-flex' : 'none';
    if (UI.btnPlay) UI.btnPlay.style.display = (S.mode==='normal') ? 'inline-flex' : 'none';
  }

  // ---------- HUD update ----------
  function setBar(el, pct){
    if(!el) return;
    const p = clamp01(pct) * 100;
    el.style.width = p.toFixed(1) + '%';
  }

  function updateHUD(){
    if (UI.txtTime) UI.txtTime.textContent = `${Math.max(0,S.tLeft).toFixed(1)} s`;
    if (UI.txtScore) UI.txtScore.textContent = String(S.score|0);
    if (UI.txtCombo) UI.txtCombo.textContent = String(S.combo|0);
    if (UI.txtPhase) UI.txtPhase.textContent = String(S.phase|0);
    if (UI.txtMiss) UI.txtMiss.textContent = String(S.miss|0);
    if (UI.txtShield) UI.txtShield.textContent = String(S.shield|0);

    const boss = BOSSES[S.bossIndex] || BOSSES[0];
    if (UI.bossName) UI.bossName.textContent = `${boss.name} ${boss.emoji}`;
    if (UI.metaEmoji) UI.metaEmoji.textContent = boss.emoji;
    if (UI.metaName) UI.metaName.textContent = boss.name;
    if (UI.metaDesc) UI.metaDesc.textContent = boss.desc;
    if (UI.bossPhaseLabel) UI.bossPhaseLabel.textContent = String(S.phase);
    if (UI.bossShieldLabel) UI.bossShieldLabel.textContent = String(S.shield);

    setBar(UI.hpYouTop, S.youHp/100);
    setBar(UI.hpYouBottom, S.youHp/100);
    setBar(UI.hpBossTop, S.bossHp / (boss.hp || 100));
    setBar(UI.hpBossBottom, S.bossHp / (boss.hp || 100));

    if (UI.feverBar) UI.feverBar.style.width = (clamp01(S.fever)*100).toFixed(1)+'%';
    if (UI.feverLabel){
      UI.feverLabel.textContent = (S.fever >= 1) ? 'READY' : 'BUILD';
    }
  }

  // ---------- targets ----------
  function clearTargets(){
    if (!UI.layer) return;
    UI.layer.innerHTML = '';
  }

  function diffParams(){
    if (S.diff === 'easy') return { spawnMs: 620, lifeMs: 1300, size: 80 };
    if (S.diff === 'hard') return { spawnMs: 420, lifeMs: 900,  size: 74 };
    return { spawnMs: 520, lifeMs: 1100, size: 78 };
  }

  function chooseTargetType(){
    const p = S.phase;
    const r = Math.random();
    const decoyW = clamp(0.10 + (p-1)*0.06, 0.10, 0.28);
    const healW  = clamp(0.08, 0.06, 0.10);
    const shieldW= clamp(0.06, 0.04, 0.08);
    const hitW   = 1 - (decoyW + healW + shieldW);

    if (r < hitW) return 'hit';
    if (r < hitW + decoyW) return 'decoy';
    if (r < hitW + decoyW + healW) return 'heal';
    return 'shield';
  }

  function targetEmoji(type){
    if (type === 'hit') return '🥊';
    if (type === 'decoy') return '💣';
    if (type === 'heal') return '❤️';
    if (type === 'shield') return '🛡️';
    return '🎯';
  }

  function stageEl(){
    return UI.layer?.closest('.sb-stage') || null;
  }

  function spawnTarget(){
    if (!S.running || S.paused) return;
    if (!UI.layer) return;

    const stage = stageEl();
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const pad = 40;
    const x = rand(pad, Math.max(pad+1, rect.width - pad));
    const y = rand(pad, Math.max(pad+1, rect.height - pad));

    const { lifeMs, size } = diffParams();
    const type = chooseTargetType();

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';
    el.dataset.type = type;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.textContent = targetEmoji(type);
    el.setAttribute('aria-label', type);

    const born = performance.now();
    let killed = false;

    function kill(reason){
      if (killed) return;
      killed = true;
      el.remove();
      if (reason === 'timeout'){
        if (type === 'hit'){
          S.miss += 1;
          S.combo = 0;
          S.total += 1;
          S.youHp = Math.max(0, S.youHp - 2);

          // FX: miss timeout
          const vp = FX.toViewportXY(stage, x, y);
          FX.popText(vp.x, vp.y, 'MISS', 'bad');
          FX.burst(vp.x, vp.y, 10, 70);
        }
        updateHUD();
      }
    }

    const ttl = window.setTimeout(()=>kill('timeout'), lifeMs);

    el.addEventListener('click', (ev) => {
      if (!S.running || S.paused) return;
      window.clearTimeout(ttl);

      const stage = stageEl();
      const vp = stage ? FX.toViewportXY(stage, x, y) : { x: ev.clientX, y: ev.clientY };

      const rt = performance.now() - born;
      S.total += 1;

      // tiny flash for feedback
      if (stage) FX.flash(stage);

      if (type === 'decoy'){
        if (S.shield > 0){
          S.shield -= 1;
          S.score += 2;
          S.combo += 1;
          S.hits += 1;

          FX.popText(vp.x, vp.y, '+2 (BLOCK)', 'warn');
          FX.burst(vp.x, vp.y, 12, 85);
        }else{
          S.youHp = Math.max(0, S.youHp - 8);
          S.combo = 0;
          S.miss += 1;

          if (stage) FX.shake(stage);
          FX.popText(vp.x, vp.y, '💣 OOPS!', 'bad');
          FX.burst(vp.x, vp.y, 14, 105);
        }
      } else if (type === 'heal'){
        S.youHp = Math.min(100, S.youHp + 10);
        S.score += 6;
        S.combo += 1;
        S.hits += 1;

        FX.popText(vp.x, vp.y, '+HP', 'good');
        FX.burst(vp.x, vp.y, 14, 95);
      } else if (type === 'shield'){
        S.shield = Math.min(3, S.shield + 1);
        S.score += 5;
        S.combo += 1;
        S.hits += 1;

        FX.popText(vp.x, vp.y, '🛡️ +1', 'warn');
        FX.burst(vp.x, vp.y, 12, 90);
      } else {
        // hit
        S.hits += 1;
        S.combo += 1;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        // fever build
        S.fever = clamp01(S.fever + 0.08 + Math.min(0.05, S.combo*0.002));

        const boss = BOSSES[S.bossIndex] || BOSSES[0];
        let dmg = 6;
        if (S.diff === 'hard') dmg += 2;
        if (S.fever >= 1) dmg += 5;

        const rtScore = clamp(1 - (rt / 700), 0.2, 1.0);
        const addScore = Math.round(10 * rtScore) + (S.fever >= 1 ? 6 : 0);
        S.score += addScore;

        S.bossHp = Math.max(0, S.bossHp - dmg);

        // FX: hit feedback
        FX.popText(vp.x, vp.y, `+${addScore}`, 'hit');
        FX.burst(vp.x, vp.y, 12, 95);

        if (S.combo > 0 && S.combo % 10 === 0){
          FX.popText(vp.x, vp.y - 24, `COMBO ${S.combo}!`, 'warn');
          FX.burst(vp.x, vp.y, 18, 130);
        }
      }

      // consume fever if ready (short burst)
      if (S.fever >= 1){
        S.fever = 0.18;
        FX.popText(vp.x, vp.y - 30, 'FEVER!', 'warn');
        FX.burst(vp.x, vp.y, 20, 140);
      }

      kill('hit');
      updateHUD();

      if (S.bossHp <= 0){
        bossDefeated();
      }
      if (S.youHp <= 0){
        endGame('lose');
      }
    });

    UI.layer.appendChild(el);
  }

  function bossDefeated(){
    const stage = stageEl();
    if (stage){
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width*0.5;
      const cy = r.top + r.height*0.38;
      FX.popText(cx, cy, 'BOSS DOWN!', 'good');
      FX.burst(cx, cy, 24, 170);
      FX.flash(stage);
      FX.shake(stage);
    }

    S.bossesCleared += 1;
    S.bossIndex += 1;
    if (S.bossIndex >= BOSSES.length){
      S.bossIndex = 0;
      S.phase += 1;
    }
    const boss = BOSSES[S.bossIndex] || BOSSES[0];
    S.bossHp = boss.hp;
    S.shield = Math.min(3, S.shield + 1);
    S.youHp = Math.min(100, S.youHp + 12);

    if (UI.msgMain) UI.msgMain.textContent = `เปลี่ยนบอส! ${boss.name} ${boss.emoji}`;
    updateHUD();
  }

  // ---------- loop ----------
  function tick(now){
    if (!S.running){
      S.rafId = 0;
      return;
    }
    if (!S.lastTick) S.lastTick = now;
    const dt = (now - S.lastTick) / 1000;
    S.lastTick = now;

    if (!S.paused){
      S.tLeft -= dt;
      if (S.tLeft <= 0){
        S.tLeft = 0;
        updateHUD();
        endGame('time');
        return;
      }
    }

    updateHUD();
    S.rafId = requestAnimationFrame(tick);
  }

  function startSpawning(){
    stopSpawning();
    const { spawnMs } = diffParams();
    S.spawnTimer = window.setInterval(spawnTarget, spawnMs);
  }
  function stopSpawning(){
    if (S.spawnTimer){
      window.clearInterval(S.spawnTimer);
      S.spawnTimer = 0;
    }
  }

  // ---------- start/stop ----------
  function resetGame(){
    S.running = false;
    S.paused = false;
    S.tLeft = S.durationSec;
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.miss = 0;
    S.shield = 0;
    S.fever = 0;
    S.youHp = 100;
    S.phase = 1;
    S.bossIndex = 0;
    S.bossesCleared = 0;

    S.hits = 0;
    S.total = 0;

    const boss = BOSSES[0];
    S.bossHp = boss.hp;

    S.lastTick = 0;
    if (UI.chkPause) UI.chkPause.checked = false;
    clearTargets();
    updateHUD();

    if (UI.msgMain) UI.msgMain.textContent = 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!';
  }

  function startGame(){
    resetGame();

    showView('play');
    document.body.classList.add('sb-playing');
    try{ window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }catch{ window.scrollTo(0,0); }

    S.running = true;
    startSpawning();
    S.rafId = requestAnimationFrame(tick);

    // FX: start
    const stage = stageEl();
    if (stage){
      const r = stage.getBoundingClientRect();
      FX.popText(r.left + r.width*0.5, r.top + r.height*0.25, 'GO!', 'good');
      FX.burst(r.left + r.width*0.5, r.top + r.height*0.32, 18, 160);
      FX.flash(stage);
    }
  }

  function endGame(reason){
    if (!S.running) return;

    S.running = false;
    stopSpawning();
    if (S.rafId) cancelAnimationFrame(S.rafId);
    S.rafId = 0;

    document.body.classList.remove('sb-playing');
    try{ window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }catch{ window.scrollTo(0,0); }

    clearTargets();

    const played = S.durationSec - S.tLeft;
    const accPct = (S.total > 0) ? (S.hits / S.total) * 100 : 0;

    if (UI.resTime) UI.resTime.textContent = `${played.toFixed(1)} s`;
    if (UI.resScore) UI.resScore.textContent = String(S.score|0);
    if (UI.resMaxCombo) UI.resMaxCombo.textContent = String(S.maxCombo|0);
    if (UI.resMiss) UI.resMiss.textContent = String(S.miss|0);
    if (UI.resPhase) UI.resPhase.textContent = String(S.phase|0);
    if (UI.resBossCleared) UI.resBossCleared.textContent = String(S.bossesCleared|0);
    if (UI.resAcc) UI.resAcc.textContent = `${accPct.toFixed(1)} %`;

    let grade = 'C';
    if (accPct >= 85 && S.score >= 420) grade = 'SS';
    else if (accPct >= 78 && S.score >= 340) grade = 'S';
    else if (accPct >= 68 && S.score >= 260) grade = 'A';
    else if (accPct >= 55 && S.score >= 180) grade = 'B';
    else grade = 'C';
    if (reason === 'lose') grade = 'C';

    if (UI.resGrade) UI.resGrade.textContent = grade;

    showView('result');

    // FX: end (small)
    const stage = stageEl();
    if (stage){
      const r = stage.getBoundingClientRect();
      FX.popText(r.left + r.width*0.5, r.top + r.height*0.30, `GRADE ${grade}`, grade==='SS'||grade==='S' ? 'good' : 'hit');
      FX.burst(r.left + r.width*0.5, r.top + r.height*0.34, 22, 170);
    }
  }

  // ---------- menu interactions ----------
  function readSettingsFromMenu(){
    S.diff = (UI.diff?.value || 'normal').toLowerCase();
    S.durationSec = Number(UI.time?.value || 70) || 70;
  }

  function bind(){
    UI.modeNormal?.addEventListener('click', ()=>setMode('normal'));
    UI.modeResearch?.addEventListener('click', ()=>setMode('research'));

    UI.btnHowto?.addEventListener('click', ()=>{
      if (!UI.howto) return;
      UI.howto.classList.toggle('is-open');
    });

    UI.btnPlay?.addEventListener('click', ()=>{
      readSettingsFromMenu();
      setMode('normal');
      startGame();
    });

    UI.btnResearch?.addEventListener('click', ()=>{
      readSettingsFromMenu();
      setMode('research');
      startGame();
    });

    UI.btnBackMenu?.addEventListener('click', ()=>{
      S.running = false;
      stopSpawning();
      if (S.rafId) cancelAnimationFrame(S.rafId);
      S.rafId = 0;
      document.body.classList.remove('sb-playing');
      clearTargets();
      showView('menu');
    });

    UI.chkPause?.addEventListener('change', ()=>{
      S.paused = !!UI.chkPause.checked;
      if (UI.msgMain){
        UI.msgMain.textContent = S.paused ? 'หยุดชั่วคราว — ปิด Stop เพื่อเล่นต่อ' : 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!';
      }
      // FX
      const stage = stageEl();
      if (stage && S.paused){
        const r = stage.getBoundingClientRect();
        FX.popText(r.left + r.width*0.5, r.top + r.height*0.28, 'PAUSE', 'warn');
      }
    });

    UI.btnRetry?.addEventListener('click', ()=>{
      startGame();
    });

    UI.btnMenu2?.addEventListener('click', ()=>{
      showView('menu');
    });

    UI.btnDlEvents?.addEventListener('click', ()=>{
      alert('Events CSV: (พักไว้ก่อน) — ตอนนี้โฟกัสให้เกมเล่นได้สมบูรณ์ก่อน ✅');
    });
    UI.btnDlSession?.addEventListener('click', ()=>{
      alert('Session CSV: (พักไว้ก่อน) — ตอนนี้โฟกัสให้เกมเล่นได้สมบูรณ์ก่อน ✅');
    });
  }

  function boot(){
    setMode((qs('mode','normal')||'normal').toLowerCase() === 'research' ? 'research' : 'normal');
    showView('menu');
    updateHUD();
    bind();
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})();