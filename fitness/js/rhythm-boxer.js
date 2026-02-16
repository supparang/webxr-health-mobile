// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer — Page Controller (MENU/PLAY/RESULT)
// ✅ Wires HUD to RhythmBoxerEngine
// ✅ Uses DomRendererRhythm for hit/miss FX + auto hitline + 🎵 note icon
// ✅ Mobile-safe audio unlock (must start from user gesture)
// ✅ Download CSV (events + sessions)
// ✅ Stop early / back to menu / play again

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const $ = (s,root=DOC)=>root.querySelector(s);
  const $$ = (s,root=DOC)=>Array.from(root.querySelectorAll(s));

  function clamp(v,min,max){
    v = Number(v);
    if(!Number.isFinite(v)) v = min;
    return Math.max(min, Math.min(max, v));
  }

  function dlText(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }

  // ---- Views ----
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  function showView(which){
    const map = { menu:viewMenu, play:viewPlay, result:viewResult };
    for(const k of Object.keys(map)){
      const el = map[k];
      if(!el) continue;
      el.classList.toggle('hidden', k !== which);
    }
  }

  // ---- Menu controls ----
  const modeRadios = $$('input[name="rb-mode"]');
  const trackRadios = $$('input[name="rb-track"]');
  const btnStart = $('#rb-btn-start');

  const modeDesc = $('#rb-mode-desc');
  const researchFields = $('#rb-research-fields');
  const trackModeLabel = $('#rb-track-mode-label');
  const trackOptions = $('#rb-track-options');

  const inpParticipant = $('#rb-participant');
  const inpGroup = $('#rb-group');
  const inpNote = $('#rb-note');

  function getMode(){
    const r = modeRadios.find(x=>x.checked);
    return (r && r.value === 'research') ? 'research' : 'normal';
  }
  function getTrackId(){
    const r = trackRadios.find(x=>x.checked);
    return (r && r.value) ? r.value : 'n1';
  }

  function refreshModeUI(){
    const mode = getMode();

    if(researchFields){
      researchFields.classList.toggle('hidden', mode !== 'research');
    }
    if(modeDesc){
      modeDesc.textContent =
        (mode === 'research')
          ? 'Research: ล็อกการช่วยเล่น (แค่ “ทำนาย” แสดงผล) + บันทึก CSV เพื่อวิเคราะห์'
          : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
    }

    // show/hide track radios by data-mode
    if(trackOptions){
      const labels = $$('#rb-track-options .rb-mode-btn');
      for(const lb of labels){
        const m = (lb.getAttribute('data-mode')||'normal').toLowerCase();
        lb.classList.toggle('hidden', m !== mode);
      }
    }
    if(trackModeLabel){
      trackModeLabel.textContent =
        (mode === 'research')
          ? 'โหมด Research — เพลงทดลอง (คงรูปแบบเพื่อวิจัย)'
          : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // ensure a valid track is selected
    const visibleTracks = trackRadios.filter(r=>{
      const lb = r.closest('.rb-mode-btn');
      if(!lb) return true;
      return !lb.classList.contains('hidden');
    });
    const cur = trackRadios.find(r=>r.checked);
    if(cur){
      const lb = cur.closest('.rb-mode-btn');
      if(lb && lb.classList.contains('hidden')){
        // pick first visible
        if(visibleTracks[0]) visibleTracks[0].checked = true;
      }
    }else{
      if(visibleTracks[0]) visibleTracks[0].checked = true;
    }
  }

  modeRadios.forEach(r=>r.addEventListener('change', refreshModeUI));
  refreshModeUI();

  // ---- Play controls / HUD ----
  const btnStop = $('#rb-btn-stop');

  const hud = {
    mode: $('#rb-hud-mode'),
    track: $('#rb-hud-track'),

    score: $('#rb-hud-score'),
    combo: $('#rb-hud-combo'),
    acc: $('#rb-hud-acc'),

    aiFatigue: $('#rb-hud-ai-fatigue'),
    aiSkill: $('#rb-hud-ai-skill'),
    aiSuggest: $('#rb-hud-ai-suggest'),
    aiTip: $('#rb-hud-ai-tip'),

    hp: $('#rb-hud-hp'),
    shield: $('#rb-hud-shield'),
    time: $('#rb-hud-time'),

    countPerfect: $('#rb-hud-perfect'),
    countGreat: $('#rb-hud-great'),
    countGood: $('#rb-hud-good'),
    countMiss: $('#rb-hud-miss'),

    feverFill: $('#rb-fever-fill'),
    feverStatus: $('#rb-fever-status'),
    progFill: $('#rb-progress-fill'),
    progText: $('#rb-progress-text')
  };

  const lanesEl = $('#rb-lanes');
  const fieldEl = $('#rb-field');
  const feedbackEl = $('#rb-feedback');
  const flashEl = $('#rb-flash');
  const audioEl = $('#rb-audio');

  // ---- Result UI ----
  const resMode = $('#rb-res-mode');
  const resTrack = $('#rb-res-track');
  const resEndReason = $('#rb-res-endreason');
  const resScore = $('#rb-res-score');
  const resMaxCombo = $('#rb-res-maxcombo');
  const resHit = $('#rb-res-detail-hit');
  const resAcc = $('#rb-res-acc');
  const resDur = $('#rb-res-duration');
  const resRank = $('#rb-res-rank');
  const resOffAvg = $('#rb-res-offset-avg');
  const resOffStd = $('#rb-res-offset-std');
  const resParticipant = $('#rb-res-participant');
  const resQuality = $('#rb-res-quality-note');

  const btnAgain = $('#rb-btn-again');
  const btnBackMenu = $('#rb-btn-back-menu');
  const btnDlEvents = $('#rb-btn-dl-events');
  const btnDlSessions = $('#rb-btn-dl-sessions');

  // ---- Engine/Renderer ----
  let renderer = null;
  let engine = null;

  function wireHudModeTrack(mode, trackName){
    if(hud.mode) hud.mode.textContent = (mode === 'research') ? 'Research' : 'Normal';
    if(hud.track) hud.track.textContent = trackName || '-';
  }

  function ensureAudioUnlocked(){
    // mobile browsers require play() from a gesture; we call this inside start handler
    if(!audioEl) return Promise.resolve();
    try{
      audioEl.muted = true;
      const p = audioEl.play();
      return Promise.resolve(p).catch(()=>{}).then(()=>{
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.muted = false;
      });
    }catch(_){
      return Promise.resolve();
    }
  }

  function getMeta(mode){
    if(mode !== 'research'){
      return { id:'', group:'', note:'' };
    }
    return {
      id: (inpParticipant && inpParticipant.value || '').trim(),
      participant_id: (inpParticipant && inpParticipant.value || '').trim(),
      group: (inpGroup && inpGroup.value || '').trim(),
      note: (inpNote && inpNote.value || '').trim()
    };
  }

  function startGame(){
    const mode = getMode();
    const trackId = getTrackId();
    const meta = getMeta(mode);

    // make renderer
    if(!renderer){
      renderer = new WIN.DomRendererRhythm({
        wrap: $('#rb-wrap') || DOC.body,
        field: fieldEl,
        lanesEl,
        feedbackEl,
        flashEl,
        noteIcon: '🎵'
      });
    }else{
      renderer.ensureHitlines();
    }

    // make engine
    engine = new WIN.RhythmBoxerEngine({
      wrap: $('#rb-wrap') || DOC.body,
      field: fieldEl,
      lanesEl,
      audio: audioEl,
      renderer,
      hud,
      hooks: {
        onStart: ({sessionId, mode, track})=>{
          wireHudModeTrack(mode, track && track.name);
          if(feedbackEl) feedbackEl.textContent = 'เริ่ม!';
        },
        onEnd: (summary)=>{ showResult(summary); }
      }
    });

    // update top HUD immediately
    const trackName =
      (trackId === 'n1') ? 'Warm-up Groove' :
      (trackId === 'n2') ? 'Focus Combo' :
      (trackId === 'n3') ? 'Speed Rush' :
      (trackId === 'r1') ? 'Research Track 120' : 'Track';
    wireHudModeTrack(mode, trackName);

    showView('play');

    // start only after audio unlock attempt
    ensureAudioUnlocked().finally(()=>{
      engine.start(mode, trackId, meta);
    });
  }

  function stopGame(){
    if(engine && typeof engine.stop === 'function'){
      engine.stop('manual-stop');
    }
  }

  function showResult(summary){
    showView('result');

    // fill result UI
    if(resMode) resMode.textContent = summary.modeLabel || '-';
    if(resTrack) resTrack.textContent = summary.trackName || '-';
    if(resEndReason) resEndReason.textContent = summary.endReason || '-';
    if(resScore) resScore.textContent = String(summary.finalScore ?? 0);
    if(resMaxCombo) resMaxCombo.textContent = String(summary.maxCombo ?? 0);
    if(resHit) resHit.textContent = `${summary.hitPerfect||0} / ${summary.hitGreat||0} / ${summary.hitGood||0} / ${summary.hitMiss||0}`;
    if(resAcc) resAcc.textContent = (summary.accuracyPct!=null) ? `${Number(summary.accuracyPct).toFixed(1)} %` : '0.0 %';
    if(resDur) resDur.textContent = (summary.durationSec!=null) ? `${Number(summary.durationSec).toFixed(1)} s` : '0.0 s';
    if(resRank) resRank.textContent = summary.rank || '-';
    if(resOffAvg) resOffAvg.textContent = (summary.offsetMean!=null) ? `${Number(summary.offsetMean).toFixed(4)} s` : '-';
    if(resOffStd) resOffStd.textContent = (summary.offsetStd!=null) ? `${Number(summary.offsetStd).toFixed(4)} s` : '-';
    if(resParticipant) resParticipant.textContent = summary.participant || '-';

    if(resQuality){
      const note = summary.qualityNote || '';
      resQuality.classList.toggle('hidden', !note);
      resQuality.textContent = note;
    }
  }

  function playAgain(){
    // restart same selections (mode/track from menu radios still set)
    showView('play');
    if(engine && typeof engine.start === 'function'){
      // but safest: rebuild to reset DOM observers cleanly
      try{ if(renderer && renderer.destroy) renderer.destroy(); }catch(_){}
      renderer = null;
      engine = null;
      startGame();
    }else{
      startGame();
    }
  }

  function backToMenu(){
    try{ if(engine && engine.stop) engine.stop('back-menu'); }catch(_){}
    engine = null;
    showView('menu');
  }

  function downloadEvents(){
    if(!engine || typeof engine.getEventsCsv !== 'function') return;
    const csv = engine.getEventsCsv();
    const name = `rhythm_events_${Date.now()}.csv`;
    dlText(name, csv);
  }

  function downloadSessions(){
    if(!engine || typeof engine.getSessionCsv !== 'function') return;
    const csv = engine.getSessionCsv();
    const name = `rhythm_sessions_${Date.now()}.csv`;
    dlText(name, csv);
  }

  // ---- Bind buttons ----
  if(btnStart){
    btnStart.addEventListener('click', ()=>{
      startGame();
    });
  }
  if(btnStop){
    btnStop.addEventListener('click', ()=>{
      stopGame();
    });
  }
  if(btnAgain){
    btnAgain.addEventListener('click', ()=>{
      playAgain();
    });
  }
  if(btnBackMenu){
    btnBackMenu.addEventListener('click', ()=>{
      backToMenu();
    });
  }
  if(btnDlEvents){
    btnDlEvents.addEventListener('click', ()=>{
      downloadEvents();
    });
  }
  if(btnDlSessions){
    btnDlSessions.addEventListener('click', ()=>{
      downloadSessions();
    });
  }

  // Start at menu
  showView('menu');
})();