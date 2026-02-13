// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer UI Controller — PRODUCTION (Calibration B)
// ✅ Add Cal HUD: +10ms / -10ms / Reset
// ✅ Persist to localStorage (per device)
// ✅ Applies to engine via setCalibrationMs()

'use strict';

(function(){
  const DOC = document;

  const LS_KEY = 'RB_CAL_MS_V1';

  function qs(sel){ return DOC.querySelector(sel); }
  function qsa(sel){ return Array.from(DOC.querySelectorAll(sel)); }

  function show(el){ if(el) el.classList.remove('hidden'); }
  function hide(el){ if(el) el.classList.add('hidden'); }

  function getSelectedRadio(name){
    const el = DOC.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
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

  // Views
  const viewMenu   = qs('#rb-view-menu');
  const viewPlay   = qs('#rb-view-play');
  const viewResult = qs('#rb-view-result');

  const btnStart = qs('#rb-btn-start');
  const btnStop  = qs('#rb-btn-stop');

  const btnAgain = qs('#rb-btn-again');
  const btnBackMenu = qs('#rb-btn-back-menu');

  const btnDlEvents   = qs('#rb-btn-dl-events');
  const btnDlSessions = qs('#rb-btn-dl-sessions');

  // Mode toggles
  const modeDesc = qs('#rb-mode-desc');
  const researchFields = qs('#rb-research-fields');
  const trackModeLabel = qs('#rb-track-mode-label');
  const trackOptions = qs('#rb-track-options');

  // Research inputs
  const inpPid = qs('#rb-participant');
  const inpGroup = qs('#rb-group');
  const inpNote = qs('#rb-note');

  // Audio + DOM
  const lanesEl = qs('#rb-lanes');
  const fieldEl = qs('#rb-field');
  const audioEl = qs('#rb-audio');

  // HUD wires
  const hud = {
    score: qs('#rb-hud-score'),
    combo: qs('#rb-hud-combo'),
    acc: qs('#rb-hud-acc'),
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

    aiFatigue: qs('#rb-hud-ai-fatigue'),
    aiSkill: qs('#rb-hud-ai-skill'),
    aiSuggest: qs('#rb-hud-ai-suggest'),
    aiTip: qs('#rb-hud-ai-tip')
  };

  // Header HUD
  const hudMode = qs('#rb-hud-mode');
  const hudTrack = qs('#rb-hud-track');

  // Result UI
  const resMode = qs('#rb-res-mode');
  const resTrack = qs('#rb-res-track');
  const resEnd = qs('#rb-res-endreason');
  const resScore = qs('#rb-res-score');
  const resMaxCombo = qs('#rb-res-maxcombo');
  const resDetailHit = qs('#rb-res-detail-hit');
  const resAcc = qs('#rb-res-acc');
  const resDur = qs('#rb-res-duration');
  const resRank = qs('#rb-res-rank');
  const resOffsetAvg = qs('#rb-res-offset-avg');
  const resOffsetStd = qs('#rb-res-offset-std');
  const resParticipant = qs('#rb-res-participant');
  const resQualityNote = qs('#rb-res-quality-note');

  // Calibration UI (must exist in HTML for B)
  const calVal = qs('#rb-hud-cal');
  const btnCalMinus = qs('#rb-cal-minus');
  const btnCalPlus  = qs('#rb-cal-plus');
  const btnCalReset = qs('#rb-cal-reset');

  // Renderer bridge (optional)
  const renderer = (window.DomRendererRhythm && typeof window.DomRendererRhythm.create === 'function')
    ? window.DomRendererRhythm.create({ field: fieldEl })
    : null;

  let engine = null;
  let lastMode = 'normal';
  let lastTrackId = 'n1';

  function loadCalMs(){
    try{
      const v = Number(localStorage.getItem(LS_KEY));
      return Number.isFinite(v) ? Math.max(-250, Math.min(250, Math.round(v))) : 0;
    }catch(_){
      return 0;
    }
  }
  function saveCalMs(ms){
    try{ localStorage.setItem(LS_KEY, String(Math.round(ms))); }catch(_){}
  }

  function applyCalToEngine(){
    if(!engine) return;
    const ms = loadCalMs();
    if(typeof engine.setCalibrationMs === 'function'){
      engine.setCalibrationMs(ms);
    }
    if(calVal) calVal.textContent = `${loadCalMs()}ms`;
  }

  function setView(which){
    hide(viewMenu); hide(viewPlay); hide(viewResult);
    if(which==='menu') show(viewMenu);
    if(which==='play') show(viewPlay);
    if(which==='result') show(viewResult);
  }

  function updateModeUI(){
    const mode = getSelectedRadio('rb-mode') || 'normal';
    if(mode === 'research'){
      modeDesc.textContent = 'Research: ล็อกเกม 100% สำหรับงานวิจัย (AI แสดง prediction ได้ แต่ไม่ปรับความยาก)';
      show(researchFields);
      trackModeLabel.textContent = 'โหมด Research — เพลงมาตรฐานเพื่อเก็บข้อมูล (120 BPM)';
    }else{
      modeDesc.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      hide(researchFields);
      trackModeLabel.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // filter track options by data-mode
    qsa('#rb-track-options .rb-mode-btn').forEach(lbl=>{
      const m = lbl.getAttribute('data-mode');
      if(!m) return;
      if(m === mode) lbl.classList.remove('hidden');
      else lbl.classList.add('hidden');
    });

    // ensure selected track is valid in that mode
    const currentTrack = getSelectedRadio('rb-track') || 'n1';
    const ok = !!DOC.querySelector(`#rb-track-options .rb-mode-btn[data-mode="${mode}"] input[value="${currentTrack}"]`);
    if(!ok){
      // switch to first available
      const first = DOC.querySelector(`#rb-track-options .rb-mode-btn[data-mode="${mode}"] input[name="rb-track"]`);
      if(first) first.checked = true;
    }
  }

  function bindModeRadios(){
    qsa('input[name="rb-mode"]').forEach(r=>{
      r.addEventListener('change', updateModeUI);
    });
  }

  function initEngine(){
    engine = new window.RhythmBoxerEngine({
      wrap: qs('#rb-wrap'),
      field: fieldEl,
      lanesEl,
      audio: audioEl,
      renderer,
      hud,
      hooks: {
        onStart(info){
          if(hudMode) hudMode.textContent = (info.mode === 'research') ? 'Research' : 'Normal';
          if(hudTrack) hudTrack.textContent = info.track ? info.track.name : '-';
        },
        onEnd(summary){
          // fill result
          resMode.textContent = summary.modeLabel || '-';
          resTrack.textContent = summary.trackName || '-';
          resEnd.textContent = summary.endReason || '-';
          resScore.textContent = String(summary.finalScore ?? 0);
          resMaxCombo.textContent = String(summary.maxCombo ?? 0);
          resDetailHit.textContent = `${summary.hitPerfect||0} / ${summary.hitGreat||0} / ${summary.hitGood||0} / ${summary.hitMiss||0}`;
          resAcc.textContent = (summary.accuracyPct!=null) ? `${summary.accuracyPct.toFixed(1)} %` : '0.0 %';
          resDur.textContent = (summary.durationSec!=null) ? `${summary.durationSec.toFixed(1)} s` : '0.0 s';
          resRank.textContent = summary.rank || '-';
          resOffsetAvg.textContent = (summary.offsetMean!=null) ? `${(summary.offsetMean*1000).toFixed(0)} ms` : '-';
          resOffsetStd.textContent = (summary.offsetStd!=null) ? `${(summary.offsetStd*1000).toFixed(0)} ms` : '-';
          resParticipant.textContent = summary.participant || '-';

          if(summary.qualityNote){
            resQualityNote.textContent = summary.qualityNote;
            resQualityNote.classList.remove('hidden');
          }else{
            resQualityNote.classList.add('hidden');
          }

          setView('result');
        }
      }
    });

    // apply stored calibration on init
    applyCalToEngine();
  }

  function startGame(){
    const mode = getSelectedRadio('rb-mode') || 'normal';
    const trackId = getSelectedRadio('rb-track') || 'n1';

    lastMode = mode;
    lastTrackId = trackId;

    const meta = {
      participant_id: inpPid ? inpPid.value.trim() : '',
      group: inpGroup ? inpGroup.value.trim() : '',
      note: inpNote ? inpNote.value.trim() : ''
    };

    setView('play');

    // ensure calibration is applied before start
    applyCalToEngine();

    engine.start(mode, trackId, meta);
  }

  function stopGame(){
    if(engine) engine.stop('manual-stop');
  }

  function bindButtons(){
    if(btnStart) btnStart.addEventListener('click', startGame);
    if(btnStop) btnStop.addEventListener('click', stopGame);

    if(btnAgain) btnAgain.addEventListener('click', ()=>{
      setView('play');
      applyCalToEngine();
      engine.start(lastMode, lastTrackId, {
        participant_id: inpPid ? inpPid.value.trim() : '',
        group: inpGroup ? inpGroup.value.trim() : '',
        note: inpNote ? inpNote.value.trim() : ''
      });
    });

    if(btnBackMenu) btnBackMenu.addEventListener('click', ()=>{
      setView('menu');
    });

    if(btnDlEvents) btnDlEvents.addEventListener('click', ()=>{
      const csv = engine ? engine.getEventsCsv() : '';
      downloadText(`rhythm_events_${Date.now()}.csv`, csv);
    });
    if(btnDlSessions) btnDlSessions.addEventListener('click', ()=>{
      const csv = engine ? engine.getSessionCsv() : '';
      downloadText(`rhythm_sessions_${Date.now()}.csv`, csv);
    });

    // Calibration buttons
    if(btnCalMinus) btnCalMinus.addEventListener('click', ()=>{
      const v = loadCalMs() - 10;
      saveCalMs(v);
      applyCalToEngine();
    });
    if(btnCalPlus) btnCalPlus.addEventListener('click', ()=>{
      const v = loadCalMs() + 10;
      saveCalMs(v);
      applyCalToEngine();
    });
    if(btnCalReset) btnCalReset.addEventListener('click', ()=>{
      saveCalMs(0);
      applyCalToEngine();
    });
  }

  function boot(){
    bindModeRadios();
    updateModeUI();

    initEngine();
    bindButtons();
    setView('menu');
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();
})();