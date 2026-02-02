// === js/rhythm-boxer.js — UI glue (menu / play / result) ===
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

  // view helper (pc/mobile/cvr)
  function getView(){
    try{
      const v = (new URL(location.href).searchParams.get('view')||'').toLowerCase();
      if (v === 'cvr' || v === 'cardboard') return 'cvr';
      if (v === 'mobile') return 'mobile';
      if (v === 'pc') return 'pc';
    }catch(_){}
    // fallback by UA
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent||'') ? 'mobile' : 'pc';
  }
  function applyViewClass(){
    const v = getView();
    document.body.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    if (v === 'cvr') { document.body.classList.add('view-cvr','cardboard'); }
    else if (v === 'mobile') document.body.classList.add('view-mobile');
    else document.body.classList.add('view-pc');
  }
  applyViewClass();

  // show/hide note lanes for cVR (we keep 5 in DOM but CSS hides 0 and 4)
  const VIEW = getView();
  const isCVR = (VIEW === 'cvr');

  // optional: cVR big buttons overlay (3 lanes) for Cardboard
  function ensureCvrPad(){
    if (!isCVR) return null;
    if (document.querySelector('.rb-cvr-pad')) return document.querySelector('.rb-cvr-pad');

    const pad = document.createElement('div');
    pad.className = 'rb-cvr-pad';
    const labels = ['L1','C','R1'];
    const lanes  = [1,2,3];

    lanes.forEach((lane, idx)=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rb-cvr-btn';
      b.textContent = labels[idx];
      b.addEventListener('click', ()=>{
        if (engine && typeof engine.handleLaneTap === 'function') engine.handleLaneTap(lane);
      });
      pad.appendChild(b);
    });

    document.body.appendChild(pad);
    return pad;
  }

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

  // แสดงผลสรุป
  const res = {
    mode:        $('#rb-res-mode'),
    track:       $('#rb-res-track'),
    endReason:   $('#rb-res-endreason'),
    score:       $('#rb-res-score'),
    maxCombo:    $('#rb-res-maxcombo'),
    hits:        $('#rb-res-detail-hit'),
    acc:         $('#rb-res-acc'),
    duration:    $('#rb-res-duration'),
    rank:        $('#rb-res-rank'),
    offsetAvg:   $('#rb-res-offset-avg'),
    offsetStd:   $('#rb-res-offset-std'),
    participant: $('#rb-res-participant'),
    qualityNote: $('#rb-res-quality-note')
  };

  // mapping เพลงในเมนู → engine trackId + diff + label
  const TRACK_CONFIG = {
    n1: { engineId: 'n1', labelShort: 'Warm-up Groove', diff: 'easy'   },
    n2: { engineId: 'n2', labelShort: 'Focus Combo',    diff: 'normal' },
    n3: { engineId: 'n3', labelShort: 'Speed Rush',     diff: 'hard'   },
    r1: { engineId: 'r1', labelShort: 'Research 120',   diff: 'normal' }
  };

  let engine = null;

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
      modeDescEl.textContent =
        'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      trackModeLbl.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
      researchBox.classList.add('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.add('hidden');
        else lbl.classList.remove('hidden');
      });

      if (getSelectedTrackKey() === 'r1') setSelectedTrackKey('n1');

    } else {
      modeDescEl.textContent =
        'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV';
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
      hooks: { onEnd: handleEngineEnd, onAIUpdate: handleAIUpdate }
    });
  }

  function startGame() {
    if (!engine) createEngine();

    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

    wrap.dataset.diff = cfg.diff;

    hud.mode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
    hud.track.textContent = cfg.labelShort;

    // AI assist switch:
    // - Research: locked always (AI shows prediction but cannot adjust)
    // - Normal: enable adapt only when ?ai=1
    let aiAssistEnabled = false;
    try{
      const sp = new URL(location.href).searchParams;
      const q = (sp.get('ai')||'').toLowerCase();
      aiAssistEnabled = (mode !== 'research') && (q === '1' || q === 'true' || q === 'yes');
    }catch(_){}

    const meta = {
      id:   (inputParticipant && inputParticipant.value || '').trim(),
      group:(inputGroup && inputGroup.value || '').trim(),
      note: (inputNote && inputNote.value || '').trim(),
      aiAssist: aiAssistEnabled ? 1 : 0
    };

    engine.start(mode, cfg.engineId, meta);

    // cVR: optional big buttons
    ensureCvrPad();

    switchView('play');
  }

  function stopGame(reason) {
    if (engine) engine.stop(reason || 'manual-stop');
  }

  function handleEngineEnd(summary) {
    res.mode.textContent      = summary.modeLabel;
    res.track.textContent     = summary.trackName;
    res.endReason.textContent = summary.endReason;
    res.score.textContent     = summary.finalScore;
    res.maxCombo.textContent  = summary.maxCombo;
    res.hits.textContent      = `${summary.hitPerfect} / ${summary.hitGreat} / ${summary.hitGood} / ${summary.hitMiss}`;
    res.acc.textContent       = summary.accuracyPct.toFixed(1) + ' %';
    res.duration.textContent  = summary.durationSec.toFixed(1) + ' s';
    res.rank.textContent      = summary.rank;

    res.offsetAvg.textContent = (summary.offsetMean != null && Number.isFinite(summary.offsetMean)) ? summary.offsetMean.toFixed(3) + ' s' : '-';
    res.offsetStd.textContent = (summary.offsetStd != null && Number.isFinite(summary.offsetStd)) ? summary.offsetStd.toFixed(3) + ' s' : '-';
    res.participant.textContent = summary.participant || '-';

    if (summary.qualityNote) {
      res.qualityNote.textContent = summary.qualityNote;
      res.qualityNote.classList.remove('hidden');
    } else {
      res.qualityNote.textContent = '';
      res.qualityNote.classList.add('hidden');
    }

    switchView('result');
  }

  function handleAIUpdate(ai){
    if (!ai || !hud) return;
    if (hud.aiFatigue) hud.aiFatigue.textContent = Math.round((ai.fatigueRisk||0)*100) + '%';
    if (hud.aiSkill)   hud.aiSkill.textContent   = Math.round((ai.skillScore||0)*100) + '%';
    if (hud.aiSuggest) hud.aiSuggest.textContent = (ai.suggestedDifficulty||'normal');
    if (hud.aiTip){
      hud.aiTip.textContent = ai.tip || '';
      hud.aiTip.classList.toggle('hidden', !ai.tip);
    }
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