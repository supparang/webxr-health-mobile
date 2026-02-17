// === /fitness/js/rhythm-boxer.js — UI glue (menu / play / result) — PATCH D+E v20260217a ===
'use strict';

(function () {

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const wrap = $('#rb-wrap');
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  const flashEl    = $('#rb-flash');
  const fieldEl    = $('#rb-field');
  const lanesEl    = $('#rb-lanes');
  const feedbackEl = $('#rb-feedback');
  const audioEl    = $('#rb-audio');

  // ปุ่มเมนู
  const btnStart      = $('#rb-btn-start');
  const modeRadios    = $$('input[name="rb-mode"]');
  const trackRadios   = $$('input[name="rb-track"]');
  const trackLabels   = $$('#rb-track-options .rb-mode-btn');
  const modeDescEl    = $('#rb-mode-desc');
  const trackModeLbl  = $('#rb-track-mode-label');
  const researchBox   = $('#rb-research-fields');

  // ฟอร์มวิจัย
  const inputParticipant = $('#rb-participant');
  const inputGroup       = $('#rb-group');
  const inputNote        = $('#rb-note');

  // ปุ่มตอนเล่น / สรุปผล
  const btnStop        = $('#rb-btn-stop');
  const btnAgain       = $('#rb-btn-again');
  const btnBackMenu    = $('#rb-btn-back-menu');
  const btnDlEvents    = $('#rb-btn-dl-events');
  const btnDlSessions  = $('#rb-btn-dl-sessions');

  // ✅ NEW: Calibration buttons
  const btnCalMinus = $('#rb-btn-cal-minus');
  const btnCalPlus  = $('#rb-btn-cal-plus');
  const btnCalReset = $('#rb-btn-cal-reset');

  // HUD elements
  const hud = {
    mode:   $('#rb-hud-mode'),
    track:  $('#rb-hud-track'),
    score:  $('#rb-hud-score'),
    combo:  $('#rb-hud-combo'),
    acc:    $('#rb-hud-acc'),
    hp:     $('#rb-hud-hp'),
    shield: $('#rb-hud-shield'),
    time:   $('#rb-hud-time'),
    countPerfect: $('#rb-hud-perfect'),
    countGreat:   $('#rb-hud-great'),
    countGood:    $('#rb-hud-good'),
    countMiss:    $('#rb-hud-miss'),
    feverFill:    $('#rb-fever-fill'),
    feverStatus:  $('#rb-fever-status'),
    progFill:     $('#rb-progress-fill'),
    progText:     $('#rb-progress-text'),
    aiFatigue:    $('#rb-hud-ai-fatigue'),
    aiSkill:      $('#rb-hud-ai-skill'),
    aiSuggest:    $('#rb-hud-ai-suggest'),
    aiTip:        $('#rb-hud-ai-tip')
  };

  // =========================
  // D+E: Boss HUD + Scheduler
  // =========================

  // lazy module loaders (ไม่พังถ้าไฟล์ยังไม่วาง)
  async function loadBossModules(){
    try{
      const [{ mountBossHUD }, { createBossScheduler }] = await Promise.all([
        import('../../herohealth/boss/boss-hud.js'),
        import('../../herohealth/boss/boss-scheduler.js')
      ]);
      return { mountBossHUD, createBossScheduler };
    }catch(err){
      console.warn('[RB] boss modules missing?', err);
      return null;
    }
  }

  let boss = {
    ready: false,
    hudApi: null,
    sched: null,
    cfg: { enabled: true, mixed: true, countInBeats: 1 },
    bpm: 120,
    lastToken: null
  };

  // telegraph UI: reuse feedbackEl / flashEl แบบไม่รบกวน engine
  function bossTele(on, text){
    try{
      if (!feedbackEl) return;
      if (on){
        feedbackEl.textContent = text || 'RHYTHM!';
        feedbackEl.classList.add('show');
        if (flashEl) flashEl.classList.add('on');
        setTimeout(()=>{ if (flashEl) flashEl.classList.remove('on'); }, 120);
      } else {
        feedbackEl.classList.remove('show');
      }
    }catch(_){}
  }

  function bossSkillLabel(skill){
    if (skill === 'reverse') return 'REVERSE';
    if (skill === 'combo_lock') return 'LOCK';
    if (skill === 'stamina_drain') return 'DRAIN';
    if (skill === 'fake_callout') return 'FAKE';
    return 'BURST';
  }

  // simple mixed boss planner (เบา ๆ แต่สนุก)
  function pickBossMeta(mode, diff, trackKey){
    const presetPool = (diff === 'hard')
      ? ['burst', 'syncop', 'stutter', 'shield']
      : (diff === 'easy')
        ? ['burst', 'shield']
        : ['burst', 'syncop', 'shield'];

    const skillPool = (mode === 'research')
      ? ['burst', 'shield', 'reverse'] // research ก็มีบอส แต่ไม่โหดเกิน
      : ['burst', 'shield', 'reverse', 'combo_lock', 'fake_callout'];

    const preset = presetPool[Math.floor(Math.random()*presetPool.length)];
    const skill  = skillPool[Math.floor(Math.random()*skillPool.length)];
    return { preset, skill, trackKey };
  }

  // build A/B sequence by preset
  function buildBossSeq(preset, len){
    const n = Math.max(4, Math.min(18, len|0));
    const seq = [];
    if (preset === 'syncop'){
      // A _ B _ A B (syncop)
      for (let i=0;i<n;i++){
        seq.push((i%3===1) ? 'B' : 'A');
      }
      return seq;
    }
    if (preset === 'stutter'){
      // A A B B A A...
      for (let i=0;i<n;i++){
        seq.push((Math.floor(i/2)%2===0) ? 'A' : 'B');
      }
      return seq;
    }
    if (preset === 'shield'){
      // A B A B แต่ยาวขึ้น
      for (let i=0;i<n;i++){
        seq.push((i%2===0) ? 'A' : 'B');
      }
      return seq;
    }
    // default burst: random แต่ไม่สุ่มติดยาวเกิน
    let last = '';
    for (let i=0;i<n;i++){
      let s = (Math.random() < 0.5) ? 'A' : 'B';
      if (s === last && Math.random() < 0.65) s = (s==='A')?'B':'A';
      seq.push(s); last = s;
    }
    return seq;
  }

  // boss beat => ส่งให้ engine ถ้ามี API, ไม่งั้นยิง event ให้ engine ไปฟังได้ภายหลัง
  function emitBossBeat(payload){
    // payload: {symbol, i, total, meta}
    try{
      if (engine && typeof engine.onBossBeat === 'function'){
        engine.onBossBeat(payload);
        return;
      }
    }catch(_){}

    try{
      window.dispatchEvent(new CustomEvent('rb:bossbeat', { detail: payload }));
    }catch(_){}
  }

  async function ensureBossReady(){
    if (boss.ready) return true;
    const mods = await loadBossModules();
    if (!mods) return false;

    try{
      boss.hudApi = mods.mountBossHUD();
      boss.sched = mods.createBossScheduler({
        getBpm: ()=> boss.bpm,
        countInBeats: boss.cfg.countInBeats,
        onTele: (on, text)=> bossTele(on, text),
        onBeat: ({symbol, i, total, meta})=>{
          emitBossBeat({ symbol, i, total, meta });
          // update HUD minimal per beat (engine จะอัปเดตของตัวเองต่อได้)
          if (boss.hudApi){
            boss.hudApi.show(true);
            boss.hudApi.setHUD({
              hp: meta.hp ?? 100,
              preset: meta.preset || '—',
              skill: meta.skill || 'burst',
              skillLabel: bossSkillLabel(meta.skill),
              reverseOn: !!meta.reverseOn,
              shieldNeed: meta.shieldNeed || 0,
              shieldStreak: meta.shieldStreak || 0
            });
          }
        }
      });
      boss.ready = true;
      return true;
    }catch(err){
      console.warn('[RB] boss init failed', err);
      return false;
    }
  }

  function bossStop(){
    try{ boss.sched && boss.sched.stop && boss.sched.stop(); }catch(_){}
    try{ boss.hudApi && boss.hudApi.show(false); }catch(_){}
  }

  // เริ่มบอสแบบ “mixed”
  async function bossStartBurst(mode, diff, trackKey){
    if (!boss.cfg.enabled) return;
    const ok = await ensureBossReady();
    if (!ok) return;

    const meta0 = pickBossMeta(mode, diff, trackKey);

    // skill effects (simple flags to show HUD; engine จะเลือกใช้จริงภายหลัง)
    const meta = {
      preset: meta0.preset,
      skill: meta0.skill,
      reverseOn: (meta0.skill === 'reverse'),
      shieldNeed: (meta0.preset === 'shield' || meta0.skill === 'shield') ? 3 : 0,
      shieldStreak: 0,
      hp: 100,
      trackKey
    };

    // length by diff
    const len = (diff === 'hard') ? 14 : (diff === 'easy' ? 8 : 11);
    const seq = buildBossSeq(meta.preset, len);

    // tele text
    const teleText = (meta.reverseOn) ? 'REVERSE!' : (meta.preset === 'shield' ? 'SHIELD!' : 'BOSS BURST!');
    boss.lastToken = boss.sched.startSequence(seq, Object.assign({ teleText }, meta));
  }

  function bossTick(){
    try{
      if (boss.sched && boss.sched.tick) boss.sched.tick();
    }catch(_){}
  }

  // mapping เพลงในเมนู → engine trackId + diff + label + bpm
  const TRACK_CONFIG = {
    n1: { engineId: 'n1', labelShort: 'Warm-up Groove', diff: 'easy',   bpm: 110 },
    n2: { engineId: 'n2', labelShort: 'Focus Combo',    diff: 'normal', bpm: 126 },
    n3: { engineId: 'n3', labelShort: 'Speed Rush',     diff: 'hard',   bpm: 142 },
    r1: { engineId: 'r1', labelShort: 'Research 120',   diff: 'normal', bpm: 120 }
  };

  let engine = null;
  let bossLoopRAF = 0;

  function getSelectedMode() {
    const r = modeRadios.find(x => x.checked);
    return r ? r.value : 'normal';
  }
  function getSelectedTrackKey() {
    const r = trackRadios.find(x => x.checked);
    return r ? r.value : 'n1';
  }
  function setSelectedTrackKey(key) {
    trackRadios.forEach(r => { r.checked = (r.value === key); });
  }

  function updateModeUI() {
    const mode = getSelectedMode();
    if (mode === 'normal') {
      modeDescEl.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      trackModeLbl.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
      researchBox.classList.add('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.add('hidden');
        else lbl.classList.remove('hidden');
      });

      if (getSelectedTrackKey() === 'r1') setSelectedTrackKey('n1');
    } else {
      modeDescEl.textContent = 'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV';
      trackModeLbl.textContent = 'โหมด Research — เพลงวิจัย Research Track 120';
      researchBox.classList.remove('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.remove('hidden');
        else lbl.classList.add('hidden');
      });

      setSelectedTrackKey('r1');
    }
  }

  function switchView(name) {
    viewMenu.classList.add('hidden');
    viewPlay.classList.add('hidden');
    viewResult.classList.add('hidden');
    if (name === 'menu') viewMenu.classList.remove('hidden');
    else if (name === 'play') viewPlay.classList.remove('hidden');
    else if (name === 'result') viewResult.classList.remove('hidden');
  }

  function createEngine() {
    const renderer = new window.RbDomRenderer(fieldEl, {
      flashEl,
      feedbackEl,
      wrapEl: document.body
    });

    engine = new window.RhythmBoxerEngine({
      wrap: wrap,
      field: fieldEl,
      lanesEl: lanesEl,
      audio: audioEl,
      renderer: renderer,
      hud: hud,
      hooks: { onEnd: handleEngineEnd }
    });

    // ✅ Optional: ให้ engine รู้ว่าเราจะมี boss (ถ้ามี API)
    try{
      if (engine && typeof engine.setBossEnabled === 'function') engine.setBossEnabled(true);
    }catch(_){}
  }

  function startBossLoop(){
    cancelAnimationFrame(bossLoopRAF);
    const loop = ()=>{
      bossTick();
      bossLoopRAF = requestAnimationFrame(loop);
    };
    bossLoopRAF = requestAnimationFrame(loop);
  }

  function stopBossLoop(){
    cancelAnimationFrame(bossLoopRAF);
    bossLoopRAF = 0;
    bossStop();
  }

  async function startGame() {
    if (!engine) createEngine();

    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

    wrap.dataset.diff = cfg.diff;

    hud.mode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
    hud.track.textContent = cfg.labelShort;

    // D+E: set bpm per track
    boss.bpm = Number(cfg.bpm || 120);

    const meta = {
      id:   (inputParticipant && inputParticipant.value || '').trim(),
      group:(inputGroup && inputGroup.value || '').trim(),
      note: (inputNote && inputNote.value || '').trim()
    };

    engine.start(mode, cfg.engineId, meta);
    switchView('play');

    // ✅ D+E: boss is ON for both Normal & Research
    // เริ่ม loop ของ scheduler และปล่อย burst แรกหลังเริ่ม 2 วิ (ให้ warm-up)
    startBossLoop();
    setTimeout(()=> bossStartBurst(mode, cfg.diff, trackKey), 2000);

    // ปล่อย burst ซ้ำเป็นระยะ (ยุติธรรม: research ช้ากว่า)
    // ถ้า engine มี event hook ภายหลัง เราค่อยย้ายไป sync กับ progress ได้
    const intervalMs = (mode === 'research') ? 18000 : 14000;
    try{
      startGame._bossT && clearInterval(startGame._bossT);
      startGame._bossT = setInterval(()=> bossStartBurst(mode, cfg.diff, trackKey), intervalMs);
    }catch(_){}
  }

  function stopGame(reason) {
    if (engine) engine.stop(reason || 'manual-stop');
  }

  function handleEngineEnd(summary) {
    // stop boss
    try{ startGame._bossT && clearInterval(startGame._bossT); }catch(_){}
    stopBossLoop();

    // (ส่วน result เดิมของคุณใช้ได้ 그대로)
    // ... (คงโค้ดเดิมทั้งหมดได้เลย)
    switchView('result');
  }

  function downloadCsv(csvText, filename) {
    if (!csvText) return;
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // wiring
  modeRadios.forEach(r => r.addEventListener('change', updateModeUI));
  btnStart.addEventListener('click', startGame);
  btnStop.addEventListener('click', () => stopGame('manual-stop'));
  btnAgain.addEventListener('click', () => startGame());
  btnBackMenu.addEventListener('click', () => switchView('menu'));

  btnDlEvents.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getEventsCsv(), 'rb-events.csv');
  });
  btnDlSessions.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getSessionCsv(), 'rb-sessions.csv');
  });

  // ✅ NEW: Cal buttons wiring (works only while running)
  function calDelta(ms){
    if(!engine) return;
    engine.adjustCalMs(ms);
  }
  if(btnCalMinus) btnCalMinus.addEventListener('click', ()=>calDelta(-20));
  if(btnCalPlus)  btnCalPlus.addEventListener('click',  ()=>calDelta(+20));
  if(btnCalReset) btnCalReset.addEventListener('click', ()=>{ if(engine) engine.setCalMs(0); });

  // ==== apply mode from URL (?mode=research|play) ====
  (function applyModeFromQuery(){
    try{
      const sp = new URL(location.href).searchParams;
      const m = (sp.get('mode')||'').toLowerCase();
      if (m === 'research'){
        const r = modeRadios.find(x => x.value === 'research');
        if (r) r.checked = true;
      } else if (m === 'play' || m === 'normal'){
        const r = modeRadios.find(x => x.value === 'normal');
        if (r) r.checked = true;
      }
    }catch(_){}
  })();

  updateModeUI();
  switchView('menu');

})();