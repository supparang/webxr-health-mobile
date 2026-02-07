// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer UI Controller — PRODUCTION
// ✅ Wires Menu/Play/Result views
// ✅ Mode toggle (normal/research) + research fields show/hide
// ✅ Track options filtered by mode (normal: n1/n2/n3, research: r1)
// ✅ Starts engine with meta (participant/group/note)
// ✅ Stop early
// ✅ Result view + CSV download (events + sessions)
// ✅ Safe if renderer not present

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (s, p=DOC)=>p.querySelector(s);
  const qsa = (s, p=DOC)=>Array.from(p.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  // ----- views -----
  const wrap = qs('#rb-wrap');

  const viewMenu   = qs('#rb-view-menu');
  const viewPlay   = qs('#rb-view-play');
  const viewResult = qs('#rb-view-result');

  // ----- menu controls -----
  const modeDesc = qs('#rb-mode-desc');
  const researchFields = qs('#rb-research-fields');
  const trackModeLabel = qs('#rb-track-mode-label');
  const trackOptionsWrap = qs('#rb-track-options');
  const btnStart = qs('#rb-btn-start');

  const inPid   = qs('#rb-participant');
  const inGroup = qs('#rb-group');
  const inNote  = qs('#rb-note');

  // ----- play controls -----
  const btnStop = qs('#rb-btn-stop');
  const lanesEl = qs('#rb-lanes');
  const audioEl = qs('#rb-audio');

  // ----- HUD -----
  const hud = {
    mode: qs('#rb-hud-mode'),
    track: qs('#rb-hud-track'),

    score: qs('#rb-hud-score'),
    combo: qs('#rb-hud-combo'),
    acc: qs('#rb-hud-acc'),

    aiFatigue: qs('#rb-hud-ai-fatigue'),
    aiSkill: qs('#rb-hud-ai-skill'),
    aiSuggest: qs('#rb-hud-ai-suggest'),
    aiTip: qs('#rb-hud-ai-tip'),

    hp: qs('#rb-hud-hp'),
    shield: qs('#rb-hud-shield'),
    time: qs('#rb-hud-time'),

    countPerfect: qs('#rb-hud-perfect'),
    countGreat: qs('#rb-hud-great'),
    countGood: qs('#rb-hud-good'),
    countMiss: qs('#rb-hud-miss'),

    feverFill: qs('#rb-fever-fill'),
    feverStatus: qs('#rb-fever-status'),

    progFill: qs('#rb-progress-fill'),
    progText: qs('#rb-progress-text'),
  };

  // ----- result controls -----
  const resMode = qs('#rb-res-mode');
  const resTrack = qs('#rb-res-track');
  const resEnd = qs('#rb-res-endreason');
  const resScore = qs('#rb-res-score');
  const resMaxCombo = qs('#rb-res-maxcombo');
  const resHit = qs('#rb-res-detail-hit');
  const resAcc = qs('#rb-res-acc');
  const resDur = qs('#rb-res-duration');
  const resRank = qs('#rb-res-rank');

  const resOffAvg = qs('#rb-res-offset-avg');
  const resOffStd = qs('#rb-res-offset-std');
  const resParticipant = qs('#rb-res-participant');

  const resQuality = qs('#rb-res-quality-note');

  const btnAgain = qs('#rb-btn-again');
  const btnBackMenu = qs('#rb-btn-back-menu');
  const btnDlEvents = qs('#rb-btn-dl-events');
  const btnDlSessions = qs('#rb-btn-dl-sessions');

  // ----- feedback flash (optional) -----
  const flashEl = qs('#rb-flash');
  const feedbackEl = qs('#rb-feedback');

  // ----- renderer (optional) -----
  // dom-renderer-rhythm.js should expose something; but we stay safe.
  const renderer = (WIN.RhythmDomRenderer && typeof WIN.RhythmDomRenderer.create === 'function')
    ? WIN.RhythmDomRenderer.create({ lanesEl, feedbackEl, flashEl })
    : (WIN.domRendererRhythm && typeof WIN.domRendererRhythm.create === 'function')
      ? WIN.domRendererRhythm.create({ lanesEl, feedbackEl, flashEl })
      : {
          showHitFx(){},
          showMissFx(){},
          setFeedback(msg){ if(feedbackEl) feedbackEl.textContent = msg || ''; }
        };

  // ----- engine -----
  if(!WIN.RhythmBoxerEngine){
    console.error('RhythmBoxerEngine not found. Check js/rhythm-engine.js loaded.');
  }

  let engine = null;

  const STATE = {
    mode: 'normal',
    trackId: 'n1',
    lastTrackByMode: { normal:'n1', research:'r1' },
    lastMeta: { id:'', group:'', note:'' },
  };

  function setView(which){
    viewMenu.classList.toggle('hidden', which !== 'menu');
    viewPlay.classList.toggle('hidden', which !== 'play');
    viewResult.classList.toggle('hidden', which !== 'result');

    // scroll to top for mobile
    try { window.scrollTo(0,0); } catch {}
  }

  function getSelectedMode(){
    const el = qs('input[name="rb-mode"]:checked');
    return (el && el.value === 'research') ? 'research' : 'normal';
  }

  function getSelectedTrack(){
    const el = qs('input[name="rb-track"]:checked');
    return el ? el.value : 'n1';
  }

  function setSelectedTrack(trackId){
    const radio = qs(`input[name="rb-track"][value="${trackId}"]`);
    if(radio) radio.checked = true;
  }

  function updateModeUI(mode){
    STATE.mode = mode;

    const isResearch = mode === 'research';
    researchFields.classList.toggle('hidden', !isResearch);

    modeDesc.textContent = isResearch
      ? 'Research: เก็บข้อมูลเชิงทดลอง (แนะนำกรอก Participant/กลุ่ม/หมายเหตุ)'
      : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';

    trackModeLabel.textContent = isResearch
      ? 'โหมด Research — เพลงทดลองสำหรับวิจัย'
      : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';

    // filter visible tracks by data-mode
    qsa('label.rb-mode-btn[data-mode]').forEach(lb=>{
      const m = (lb.getAttribute('data-mode') || '').toLowerCase();
      lb.classList.toggle('hidden', (m !== mode));
    });

    // ensure a valid track is selected for the mode
    const desired = STATE.lastTrackByMode[mode] || (isResearch ? 'r1' : 'n1');
    setSelectedTrack(desired);
    STATE.trackId = getSelectedTrack();
  }

  function readMetaFromUI(){
    return {
      id: (inPid && inPid.value || '').trim(),
      group: (inGroup && inGroup.value || '').trim(),
      note: (inNote && inNote.value || '').trim(),
      participant_id: (inPid && inPid.value || '').trim(),
    };
  }

  function rememberSelections(){
    try{
      const payload = {
        mode: STATE.mode,
        trackId: STATE.trackId,
        lastTrackByMode: STATE.lastTrackByMode,
        meta: STATE.lastMeta
      };
      localStorage.setItem('RB_UI_STATE', JSON.stringify(payload));
    }catch{}
  }

  function restoreSelections(){
    try{
      const raw = localStorage.getItem('RB_UI_STATE');
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s && typeof s === 'object'){
        if(s.lastTrackByMode) STATE.lastTrackByMode = Object.assign(STATE.lastTrackByMode, s.lastTrackByMode);
        if(s.meta) STATE.lastMeta = Object.assign(STATE.lastMeta, s.meta);
        if(typeof s.mode === 'string') STATE.mode = (s.mode === 'research') ? 'research' : 'normal';
        if(typeof s.trackId === 'string') STATE.trackId = s.trackId;
      }
    }catch{}
  }

  function applyMetaToUI(){
    if(inPid) inPid.value = STATE.lastMeta.id || STATE.lastMeta.participant_id || '';
    if(inGroup) inGroup.value = STATE.lastMeta.group || '';
    if(inNote) inNote.value = STATE.lastMeta.note || '';
  }

  function showFeedback(msg){
    try{ renderer.setFeedback(msg); }catch{}
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

  // ----- hooks from engine -----
  function onStart(info){
    // update HUD labels
    if(hud.mode) hud.mode.textContent = (STATE.mode === 'research') ? 'Research' : 'Normal';
    if(hud.track) hud.track.textContent = info && info.track ? info.track.name : '';

    showFeedback('เริ่ม!');
  }

  function onEnd(summary){
    // fill result view
    resMode.textContent = summary.modeLabel || '-';
    resTrack.textContent = summary.trackName || '-';
    resEnd.textContent = summary.endReason || '-';
    resScore.textContent = String(summary.finalScore ?? 0);
    resMaxCombo.textContent = String(summary.maxCombo ?? 0);
    resHit.textContent =
      `${summary.hitPerfect ?? 0} / ${summary.hitGreat ?? 0} / ${summary.hitGood ?? 0} / ${summary.hitMiss ?? 0}`;
    resAcc.textContent = (summary.accuracyPct != null ? summary.accuracyPct.toFixed(1) : '0.0') + ' %';
    resDur.textContent = (summary.durationSec != null ? summary.durationSec.toFixed(1) : '0.0') + ' s';
    resRank.textContent = summary.rank || '-';

    resOffAvg.textContent = (summary.offsetMean != null ? (summary.offsetMean.toFixed(4) + ' s') : '-');
    resOffStd.textContent = (summary.offsetStd != null ? (summary.offsetStd.toFixed(4) + ' s') : '-');
    resParticipant.textContent = summary.participant || '-';

    if(summary.qualityNote){
      resQuality.textContent = summary.qualityNote;
      resQuality.classList.remove('hidden');
    }else{
      resQuality.classList.add('hidden');
    }

    setView('result');
  }

  // ----- start/stop -----
  function ensureEngine(){
    if(engine) return engine;
    engine = new WIN.RhythmBoxerEngine({
      wrap,
      field: qs('#rb-field'),
      lanesEl,
      audio: audioEl,
      renderer,
      hud,
      hooks: { onStart, onEnd }
    });
    return engine;
  }

  function startGame(){
    const mode = getSelectedMode();
    const trackId = getSelectedTrack();
    const meta = readMetaFromUI();

    STATE.mode = mode;
    STATE.trackId = trackId;
    STATE.lastTrackByMode[mode] = trackId;
    STATE.lastMeta = meta;

    rememberSelections();

    setView('play');

    // user gesture already happened by click
    const e = ensureEngine();
    e.start(mode, trackId, meta);
  }

  function stopGame(){
    if(engine) engine.stop('manual-stop');
  }

  // ----- UI wiring -----
  function bindUI(){
    // mode radio change
    qsa('input[name="rb-mode"]').forEach(r=>{
      r.addEventListener('change', ()=>{
        const mode = getSelectedMode();
        updateModeUI(mode);
        rememberSelections();
      });
    });

    // track change
    qsa('input[name="rb-track"]').forEach(r=>{
      r.addEventListener('change', ()=>{
        STATE.trackId = getSelectedTrack();
        STATE.lastTrackByMode[STATE.mode] = STATE.trackId;
        rememberSelections();
      });
    });

    // start
    btnStart.addEventListener('click', ()=>{
      // minimal validation for research
      const mode = getSelectedMode();
      if(mode === 'research'){
        const pid = (inPid && inPid.value || '').trim();
        // allow empty but gently nudge (no block)
        if(!pid){
          // quick hint
          showFeedback('Tip: Research แนะนำใส่ Participant ID');
        }
      }
      startGame();
    });

    // stop
    btnStop.addEventListener('click', ()=>{
      stopGame();
    });

    // result actions
    btnAgain.addEventListener('click', ()=>{
      setView('play');
      const e = ensureEngine();
      // replay same mode/track/meta
      e.start(STATE.mode, STATE.trackId, STATE.lastMeta || {});
    });

    btnBackMenu.addEventListener('click', ()=>{
      setView('menu');
    });

    btnDlEvents.addEventListener('click', ()=>{
      if(!engine) return;
      const csv = engine.getEventsCsv();
      const fn = `RB_events_${engine.sessionId || 'session'}.csv`;
      downloadText(fn, csv);
    });

    btnDlSessions.addEventListener('click', ()=>{
      if(!engine) return;
      const csv = engine.getSessionCsv();
      const fn = `RB_sessions_${engine.sessionId || 'session'}.csv`;
      downloadText(fn, csv);
    });
  }

  // ----- init -----
  function init(){
    restoreSelections();
    applyMetaToUI();

    // set initial radio for mode
    const m = STATE.mode === 'research' ? 'research' : 'normal';
    const mr = qs(`input[name="rb-mode"][value="${m}"]`);
    if(mr) mr.checked = true;

    updateModeUI(m);

    // restore last track for that mode
    const tid = STATE.lastTrackByMode[m] || (m==='research'?'r1':'n1');
    setSelectedTrack(tid);
    STATE.trackId = getSelectedTrack();

    bindUI();
    setView('menu');
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();