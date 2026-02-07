'use strict';

(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  const btnStart = $('#rb-btn-start');
  const btnStop  = $('#rb-btn-stop');
  const btnAgain = $('#rb-btn-again');
  const btnBackMenu = $('#rb-btn-back-menu');

  const modeDesc = $('#rb-mode-desc');
  const researchFields = $('#rb-research-fields');
  const trackModeLabel = $('#rb-track-mode-label');
  const trackOptions = $('#rb-track-options');

  const inpParticipant = $('#rb-participant');
  const inpGroup = $('#rb-group');
  const inpNote = $('#rb-note');

  const audio = $('#rb-audio');
  const lanesEl = $('#rb-lanes');
  const field = $('#rb-field');
  const flash = $('#rb-flash');

  // HUD elements
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

  // result UI
  const res = {
    mode: $('#rb-res-mode'),
    track: $('#rb-res-track'),
    endReason: $('#rb-res-endreason'),
    score: $('#rb-res-score'),
    maxCombo: $('#rb-res-maxcombo'),
    hit: $('#rb-res-detail-hit'),
    acc: $('#rb-res-acc'),
    dur: $('#rb-res-duration'),
    rank: $('#rb-res-rank'),
    offAvg: $('#rb-res-offset-avg'),
    offStd: $('#rb-res-offset-std'),
    participant: $('#rb-res-participant'),
    quality: $('#rb-res-quality-note')
  };

  const btnDlEvents = $('#rb-btn-dl-events');
  const btnDlSessions = $('#rb-btn-dl-sessions');

  const feedback = $('#rb-feedback');

  // dom renderer
  const renderer = window.DomRendererRhythm ? new window.DomRendererRhythm({
    field,
    lanesEl,
    flashEl: flash,
    feedbackEl: feedback
  }) : null;

  // engine
  let engine = null;
  let curMode = 'normal';
  let curTrack = 'n1';

  function setView(which){
    [viewMenu, viewPlay, viewResult].forEach(v=>v && v.classList.add('hidden'));
    if(which==='menu') viewMenu.classList.remove('hidden');
    if(which==='play') viewPlay.classList.remove('hidden');
    if(which==='result') viewResult.classList.remove('hidden');
  }

  function getSelectedMode(){
    const el = document.querySelector('input[name="rb-mode"]:checked');
    return (el && el.value) ? el.value : 'normal';
  }
  function getSelectedTrack(){
    const el = document.querySelector('input[name="rb-track"]:checked');
    return (el && el.value) ? el.value : 'n1';
  }

  function updateModeUI(){
    const m = getSelectedMode();
    curMode = m;
    const isResearch = (m === 'research');
    researchFields.classList.toggle('hidden', !isResearch);

    modeDesc.textContent = isResearch
      ? 'Research: เก็บข้อมูล CSV (Event/Session) · แนะนำให้กรอก Participant ID'
      : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';

    trackModeLabel.textContent = isResearch
      ? 'โหมด Research — ใช้เพลงทดสอบ (fixed BPM) เพื่อความเที่ยงตรงของข้อมูล'
      : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';

    // show/hide track options by data-mode
    trackOptions.querySelectorAll('[data-mode]').forEach(lbl=>{
      const ok = (lbl.getAttribute('data-mode') === (isResearch?'research':'normal'));
      lbl.style.display = ok ? '' : 'none';
    });

    // if current selected track is hidden, auto select first visible
    const checked = document.querySelector('input[name="rb-track"]:checked');
    const checkedLbl = checked ? checked.closest('[data-mode]') : null;
    if(checkedLbl && checkedLbl.style.display === 'none'){
      const first = trackOptions.querySelector(isResearch
        ? 'label[data-mode="research"] input[name="rb-track"]'
        : 'label[data-mode="normal"] input[name="rb-track"]');
      if(first){ first.checked = true; }
    }
  }

  function updateHudHeader(){
    if(hud.mode) hud.mode.textContent = (curMode==='research') ? 'Research' : 'Normal';
    const trackRadio = document.querySelector('input[name="rb-track"]:checked');
    const label = trackRadio ? trackRadio.closest('label') : null;
    const tText = label ? (label.textContent||'').trim() : '';
    if(hud.track) hud.track.textContent = tText.replace(/\s+/g,' ').split('·')[0].trim() || '—';
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2500);
  }

  function fillResult(summary){
    res.mode.textContent = summary.modeLabel || '-';
    res.track.textContent = summary.trackName || '-';
    res.endReason.textContent = summary.endReason || '-';
    res.score.textContent = String(summary.finalScore ?? 0);
    res.maxCombo.textContent = String(summary.maxCombo ?? 0);
    res.hit.textContent = `${summary.hitPerfect ?? 0} / ${summary.hitGreat ?? 0} / ${summary.hitGood ?? 0} / ${summary.hitMiss ?? 0}`;
    res.acc.textContent = (summary.accuracyPct!=null ? summary.accuracyPct.toFixed(1) : '0.0') + ' %';
    res.dur.textContent = (summary.durationSec!=null ? summary.durationSec.toFixed(1) : '0.0') + ' s';
    res.rank.textContent = summary.rank || '-';
    res.offAvg.textContent = (summary.offsetMean!=null ? summary.offsetMean.toFixed(4) : '-') + ' s';
    res.offStd.textContent = (summary.offsetStd!=null ? summary.offsetStd.toFixed(4) : '-') + ' s';
    res.participant.textContent = summary.participant || '-';

    if(summary.qualityNote){
      res.quality.textContent = summary.qualityNote;
      res.quality.classList.remove('hidden');
    }else{
      res.quality.classList.add('hidden');
    }
  }

  function ensureEngine(){
    if(engine) return engine;
    engine = new window.RhythmBoxerEngine({
      wrap: $('#rb-wrap'),
      field,
      lanesEl,
      audio,
      renderer,
      hud,
      hooks: {
        onStart(info){
          // update header
          updateHudHeader();
        },
        onEnd(summary){
          fillResult(summary);
          setView('result');
        }
      }
    });
    return engine;
  }

  function startGame(){
    updateModeUI();
    curMode = getSelectedMode();
    curTrack = getSelectedTrack();

    // meta for research
    const meta = {
      id: inpParticipant ? inpParticipant.value.trim() : '',
      group: inpGroup ? inpGroup.value.trim() : '',
      note: inpNote ? inpNote.value.trim() : ''
    };

    // enforce minimal research meta if desired (optional)
    // (we keep it permissive for classroom testing)

    // switch view
    setView('play');
    updateHudHeader();

    // start
    const e = ensureEngine();
    e.start(curMode, curTrack, meta);
  }

  function stopGame(){
    if(engine) engine.stop('manual-stop');
  }

  // wiring mode toggle
  document.addEventListener('change', (ev)=>{
    const t = ev.target;
    if(t && t.name === 'rb-mode'){
      updateModeUI();
    }
  });

  btnStart.addEventListener('click', startGame);
  btnStop.addEventListener('click', stopGame);

  btnAgain.addEventListener('click', ()=>{
    setView('play');
    updateHudHeader();
    const meta = {
      id: inpParticipant ? inpParticipant.value.trim() : '',
      group: inpGroup ? inpGroup.value.trim() : '',
      note: inpNote ? inpNote.value.trim() : ''
    };
    ensureEngine().start(curMode, curTrack, meta);
  });

  btnBackMenu.addEventListener('click', ()=>{
    setView('menu');
  });

  btnDlEvents.addEventListener('click', ()=>{
    if(!engine) return;
    const csv = engine.getEventsCsv();
    downloadText(`rhythm_events_${engine.sessionId||'session'}.csv`, csv);
  });

  btnDlSessions.addEventListener('click', ()=>{
    if(!engine) return;
    const csv = engine.getSessionCsv();
    downloadText(`rhythm_sessions_${engine.sessionId||'session'}.csv`, csv);
  });

  // init menu state
  updateModeUI();
  setView('menu');
})();