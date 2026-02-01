// === /fitness/js/engine.js ===
// Shadow Breaker Engine (Module, self-contained)
// ✅ Fix overlay: showView() hard switch
// ✅ Mobile-safe: lock scroll + full-screen play view via CSS PATCH A
// ✅ Targets clickable (sb-target) + simple boss phases
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

  // ---------- state ----------
  const clamp01 = (v)=>Math.max(0, Math.min(1, Number(v)||0));
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const rand = (a,b)=>a + Math.random()*(b-a);

  const BOSSES = [
    { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', hp: 100 },
    { name:'Iron Shadow',  emoji:'🦾', desc:'จะมี Decoy เยอะขึ้น—อย่าหลง', hp: 120 },
    { name:'Neon Fury',    emoji:'💥', desc:'จังหวะเร็วขึ้น—คุมคอมโบให้ดี', hp: 140 },
  ];

  const S = {
    mode: 'normal',      // normal | research
    diff: 'normal',      // easy | normal | hard
    durationSec: 70,
    running: false,
    paused: false,

    // gameplay
    tLeft: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    shield: 0,
    fever: 0,            // 0..1
    youHp: 100,
    bossHp: 100,
    bossIndex: 0,
    phase: 1,
    bossesCleared: 0,

    // accuracy
    hits: 0,
    total: 0,

    // loops
    rafId: 0,
    spawnTimer: 0,
    lastTick: 0,
  };

  // ---------- view helpers ----------
  function showView(which){
    // hard switch (PATCH A)
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

    // toggle which start button is primary-visible (optional)
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
    // spawn interval + lifetime scale
    if (S.diff === 'easy') return { spawnMs: 620, lifeMs: 1300, size: 80 };
    if (S.diff === 'hard') return { spawnMs: 420, lifeMs: 900,  size: 74 };
    return { spawnMs: 520, lifeMs: 1100, size: 78 };
  }

  function chooseTargetType(){
    // weighted, with phase affecting decoy/heal/shield
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

  function spawnTarget(){
    if (!S.running || S.paused) return;
    if (!UI.layer) return;

    const stage = UI.layer.closest('.sb-stage');
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
        // miss only for main targets
        if (type === 'hit'){
          S.miss += 1;
          S.combo = 0;
          S.total += 1;
          // small hp penalty
          S.youHp = Math.max(0, S.youHp - 2);
        }
        updateHUD();
      }
    }

    const ttl = window.setTimeout(()=>kill('timeout'), lifeMs);

    el.addEventListener('click', () => {
      if (!S.running || S.paused) return;
      window.clearTimeout(ttl);
      const rt = performance.now() - born;

      S.total += 1;

      if (type === 'decoy'){
        // decoy: punish unless shield
        if (S.shield > 0){
          S.shield -= 1;
          // protected
          S.score += 2;
        }else{
          S.youHp = Math.max(0, S.youHp - 8);
          S.combo = 0;
          S.miss += 1;
        }
      } else if (type === 'heal'){
        S.youHp = Math.min(100, S.youHp + 10);
        S.score += 6;
        S.combo += 1;
        S.hits += 1;
      } else if (type === 'shield'){
        S.shield = Math.min(3, S.shield + 1);
        S.score += 5;
        S.combo += 1;
        S.hits += 1;
      } else {
        // hit
        S.hits += 1;
        S.combo += 1;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        // fever build
        S.fever = clamp01(S.fever + 0.08 + Math.min(0.05, S.combo*0.002));

        // damage boss
        const boss = BOSSES[S.bossIndex] || BOSSES[0];
        let dmg = 6;
        if (S.diff === 'hard') dmg += 2;
        if (S.fever >= 1) dmg += 5;

        // RT bonus (faster -> more)
        const rtScore = clamp(1 - (rt / 700), 0.2, 1.0);
        S.score += Math.round(10 * rtScore) + (S.fever >= 1 ? 6 : 0);

        S.bossHp = Math.max(0, S.bossHp - dmg);
      }

      // consume fever if ready (short burst)
      if (S.fever >= 1){
        S.fever = 0.18; // keep some glow after burst
      }

      kill('hit');
      updateHUD();

      // boss defeated?
      if (S.bossHp <= 0){
        bossDefeated();
      }
      // player defeated?
      if (S.youHp <= 0){
        endGame('lose');
      }
    });

    UI.layer.appendChild(el);
  }

  function bossDefeated(){
    S.bossesCleared += 1;
    S.bossIndex += 1;
    if (S.bossIndex >= BOSSES.length){
      // loop bosses and ramp phase
      S.bossIndex = 0;
      S.phase += 1;
    }
    const boss = BOSSES[S.bossIndex] || BOSSES[0];
    S.bossHp = boss.hp;
    S.shield = Math.min(3, S.shield + 1);
    // little heal reward
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

    // PATCH A: view switching hard + lock scroll
    showView('play');
    document.body.classList.add('sb-playing');
    try{ window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }catch{ window.scrollTo(0,0); }

    S.running = true;
    startSpawning();
    S.rafId = requestAnimationFrame(tick);
  }

  function endGame(reason){
    if (!S.running) return;

    S.running = false;
    stopSpawning();
    if (S.rafId) cancelAnimationFrame(S.rafId);
    S.rafId = 0;

    // PATCH A: unlock scroll
    document.body.classList.remove('sb-playing');
    try{ window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }catch{ window.scrollTo(0,0); }

    clearTargets();

    // results
    const played = S.durationSec - S.tLeft;
    const accPct = (S.total > 0) ? (S.hits / S.total) * 100 : 0;

    if (UI.resTime) UI.resTime.textContent = `${played.toFixed(1)} s`;
    if (UI.resScore) UI.resScore.textContent = String(S.score|0);
    if (UI.resMaxCombo) UI.resMaxCombo.textContent = String(S.maxCombo|0);
    if (UI.resMiss) UI.resMiss.textContent = String(S.miss|0);
    if (UI.resPhase) UI.resPhase.textContent = String(S.phase|0);
    if (UI.resBossCleared) UI.resBossCleared.textContent = String(S.bossesCleared|0);
    if (UI.resAcc) UI.resAcc.textContent = `${accPct.toFixed(1)} %`;

    // grade rough
    let grade = 'C';
    if (accPct >= 85 && S.score >= 420) grade = 'SS';
    else if (accPct >= 78 && S.score >= 340) grade = 'S';
    else if (accPct >= 68 && S.score >= 260) grade = 'A';
    else if (accPct >= 55 && S.score >= 180) grade = 'B';
    else grade = 'C';
    if (reason === 'lose') grade = 'C';

    if (UI.resGrade) UI.resGrade.textContent = grade;

    showView('result');
  }

  // ---------- menu interactions ----------
  function readSettingsFromMenu(){
    S.diff = (UI.diff?.value || 'normal').toLowerCase();
    S.durationSec = Number(UI.time?.value || 70) || 70;
  }

  function bind(){
    // mode
    UI.modeNormal?.addEventListener('click', ()=>setMode('normal'));
    UI.modeResearch?.addEventListener('click', ()=>setMode('research'));

    // howto
    UI.btnHowto?.addEventListener('click', ()=>{
      if (!UI.howto) return;
      UI.howto.classList.toggle('is-open');
    });

    // start
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

    // back to menu
    UI.btnBackMenu?.addEventListener('click', ()=>{
      S.running = false;
      stopSpawning();
      if (S.rafId) cancelAnimationFrame(S.rafId);
      S.rafId = 0;
      document.body.classList.remove('sb-playing');
      clearTargets();
      showView('menu');
    });

    // pause/stop
    UI.chkPause?.addEventListener('change', ()=>{
      S.paused = !!UI.chkPause.checked;
      if (UI.msgMain){
        UI.msgMain.textContent = S.paused ? 'หยุดชั่วคราว — ปิด Stop เพื่อเล่นต่อ' : 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!';
      }
    });

    // result buttons
    UI.btnRetry?.addEventListener('click', ()=>{
      // keep current diff/time
      startGame();
    });

    UI.btnMenu2?.addEventListener('click', ()=>{
      showView('menu');
    });

    // downloads (placeholder)
    UI.btnDlEvents?.addEventListener('click', ()=>{
      alert('Events CSV: (พักไว้ก่อน) — ตอนนี้โฟกัสให้เกมเล่นได้สมบูรณ์ก่อน ✅');
    });
    UI.btnDlSession?.addEventListener('click', ()=>{
      alert('Session CSV: (พักไว้ก่อน) — ตอนนี้โฟกัสให้เกมเล่นได้สมบูรณ์ก่อน ✅');
    });
  }

  function boot(){
    // initial
    setMode((qs('mode','normal')||'normal').toLowerCase() === 'research' ? 'research' : 'normal');
    showView('menu');
    updateHUD();
    bind();
  }

  // DOM ready
  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})();