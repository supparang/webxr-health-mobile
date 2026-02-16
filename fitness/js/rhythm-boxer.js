// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer UI glue — PRODUCTION + HHA passthrough + Save Last Summary
// ✅ hub/pid/seed/view/run/diff/time/studyId/phase/conditionGroup passthrough
// ✅ Back HUB uses ?hub=... if provided
// ✅ Save last summary + history in localStorage (HHA-ish)
// ✅ CSV filename includes pid/studyId/track/seed
// ✅ NEW: Auto-load Universal VR UI (/herohealth/vr/vr-ui.js) for Cardboard/cVR (hha:shoot)

'use strict';

(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function qs(k, d = '') {
    try { return new URL(location.href).searchParams.get(k) ?? d; } catch (_) { return d; }
  }
  function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
  function str(v, d = '') { v = (v == null) ? '' : String(v); v = v.trim(); return v ? v : d; }

  function buildCtx() {
    const hub  = str(qs('hub', ''), '');
    const pid  = str(qs('pid', ''), '');
    const seed = str(qs('seed', ''), str(Date.now()));
    const view = str(qs('view', ''), '');          // pc | mobile | cvr
    const run  = str(qs('run', ''), '');
    const diff = str(qs('diff', ''), '');
    const time = num(qs('time', ''), null);

    const studyId = str(qs('studyId', ''), '');
    const phase   = str(qs('phase', ''), '');
    const conditionGroup = str(qs('conditionGroup', ''), '');

    return { hub, pid, seed, view, run, diff, time, studyId, phase, conditionGroup };
  }

  const CTX = buildCtx();

  function passThroughQuery(extra = {}) {
    const sp = new URLSearchParams();
    if (CTX.hub)  sp.set('hub', CTX.hub);
    if (CTX.pid)  sp.set('pid', CTX.pid);
    if (CTX.seed) sp.set('seed', CTX.seed);
    if (CTX.view) sp.set('view', CTX.view);
    if (CTX.run)  sp.set('run', CTX.run);
    if (CTX.diff) sp.set('diff', CTX.diff);
    if (CTX.time != null) sp.set('time', String(CTX.time));
    if (CTX.studyId) sp.set('studyId', CTX.studyId);
    if (CTX.phase) sp.set('phase', CTX.phase);
    if (CTX.conditionGroup) sp.set('conditionGroup', CTX.conditionGroup);

    Object.keys(extra || {}).forEach(k => {
      const v = extra[k];
      if (v == null || v === '') sp.delete(k);
      else sp.set(k, String(v));
    });

    const q = sp.toString();
    return q ? ('?' + q) : '';
  }

  // ✅ NEW: Safe script loader
  function loadScriptOnce(src){
    return new Promise((resolve)=>{
      const exist = document.querySelector(`script[data-src="${src}"]`);
      if(exist) return resolve(true);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.dataset.src = src;
      s.onload = ()=>resolve(true);
      s.onerror = ()=>resolve(false);
      document.head.appendChild(s);
    });
  }

  // ✅ NEW: Boot VR UI if view=cvr OR if user enters VR
  async function ensureVRUI(){
    // path from /fitness to /herohealth
    const ok = await loadScriptOnce('../herohealth/vr/vr-ui.js');
    // vr-ui.js is universal; it self-creates buttons + emits hha:shoot on tap/crosshair
    return ok;
  }

  // --------- DOM ----------
  const wrap = $('#rb-wrap');
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  const flashEl    = $('#rb-flash');
  const fieldEl    = $('#rb-field');
  const lanesEl    = $('#rb-lanes');
  const feedbackEl = $('#rb-feedback');
  const audioEl    = $('#rb-audio');

  const btnStart      = $('#rb-btn-start');
  const modeRadios    = $$('input[name="rb-mode"]');
  const trackRadios   = $$('input[name="rb-track"]');
  const trackLabels   = $$('#rb-track-options .rb-mode-btn');
  const modeDescEl    = $('#rb-mode-desc');
  const trackModeLbl  = $('#rb-track-mode-label');
  const researchBox   = $('#rb-research-fields');

  const inputParticipant = $('#rb-participant');
  const inputGroup       = $('#rb-group');
  const inputNote        = $('#rb-note');

  const btnStop        = $('#rb-btn-stop');
  const btnAgain       = $('#rb-btn-again');
  const btnBackMenu    = $('#rb-btn-back-menu');
  const btnDlEvents    = $('#rb-btn-dl-events');
  const btnDlSessions  = $('#rb-btn-dl-sessions');

  const backHubLink = document.querySelector('a.rb-back');

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
      modeDescEl.textContent = 'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV (AI prediction แสดงได้ แต่ล็อกไม่ให้ปรับเกม)';
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
  }

  async function startGame() {
    // ✅ ensure VR UI if view=cvr (Cardboard style)
    if ((CTX.view || '').toLowerCase() === 'cvr') {
      await ensureVRUI();
      document.body.setAttribute('data-view', 'cvr');
    }

    if (!engine) createEngine();

    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

    wrap.dataset.diff = cfg.diff;

    if (hud.mode)  hud.mode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
    if (hud.track) hud.track.textContent = cfg.labelShort;

    const meta = {
      id:   str((inputParticipant && inputParticipant.value) || '', CTX.pid || ''),
      group: str((inputGroup && inputGroup.value) || '', CTX.conditionGroup || ''),
      note: str((inputNote && inputNote.value) || '', ''),
      studyId: CTX.studyId || '',
      phase: CTX.phase || '',
      conditionGroup: CTX.conditionGroup || '',
      seed: CTX.seed || ''
    };

    engine.start(mode, cfg.engineId, meta);
    switchView('play');
  }

  function stopGame(reason) { if (engine) engine.stop(reason || 'manual-stop'); }

  function pushHistory(entry){
    try{
      const KEY = 'HHA_FITNESS_HISTORY';
      const raw = localStorage.getItem(KEY);
      let arr = [];
      if(raw){ try{ arr = JSON.parse(raw)||[]; }catch(_){ arr=[]; } }
      arr.unshift(entry);
      if(arr.length > 50) arr.length = 50;
      localStorage.setItem(KEY, JSON.stringify(arr));
    }catch(_){}
  }

  function saveLastSummary(entry){
    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(entry)); }catch(_){}
  }

  function buildSummaryPayload(summary){
    return {
      game: 'Fitness-RhythmBoxer',
      ts: Date.now(),
      iso: new Date().toISOString(),

      pid: CTX.pid || '',
      seed: CTX.seed || '',
      view: CTX.view || '',
      hub: CTX.hub || '',
      studyId: CTX.studyId || '',
      phase: CTX.phase || '',
      conditionGroup: CTX.conditionGroup || '',

      mode: summary.modeLabel || '',
      track: summary.trackName || '',
      endReason: summary.endReason || '',
      score: summary.finalScore || 0,
      maxCombo: summary.maxCombo || 0,
      hitPerfect: summary.hitPerfect || 0,
      hitGreat: summary.hitGreat || 0,
      hitGood: summary.hitGood || 0,
      hitMiss: summary.hitMiss || 0,
      accuracyPct: summary.accuracyPct || 0,
      offsetMean: summary.offsetMean,
      offsetStd: summary.offsetStd,
      durationSec: summary.durationSec || 0,
      rank: summary.rank || '',
      participant: summary.participant || '',
      qualityNote: summary.qualityNote || '',

      aiLocked: (window.RB_AI && window.RB_AI.isLocked && window.RB_AI.isLocked()) ? 1 : 0,
      aiAssistOn: (window.RB_AI && window.RB_AI.isAssistEnabled && window.RB_AI.isAssistEnabled()) ? 1 : 0
    };
  }

  function handleEngineEnd(summary) {
    if (res.mode) res.mode.textContent      = summary.modeLabel;
    if (res.track) res.track.textContent     = summary.trackName;
    if (res.endReason) res.endReason.textContent = summary.endReason;
    if (res.score) res.score.textContent     = summary.finalScore;
    if (res.maxCombo) res.maxCombo.textContent  = summary.maxCombo;
    if (res.hits) res.hits.textContent      = `${summary.hitPerfect} / ${summary.hitGreat} / ${summary.hitGood} / ${summary.hitMiss}`;
    if (res.acc) res.acc.textContent        = summary.accuracyPct.toFixed(1) + ' %';
    if (res.duration) res.duration.textContent  = summary.durationSec.toFixed(1) + ' s';
    if (res.rank) res.rank.textContent      = summary.rank;

    if (res.offsetAvg) res.offsetAvg.textContent =
      (summary.offsetMean != null && Number.isFinite(summary.offsetMean)) ? summary.offsetMean.toFixed(3) + ' s' : '-';
    if (res.offsetStd) res.offsetStd.textContent =
      (summary.offsetStd != null && Number.isFinite(summary.offsetStd)) ? summary.offsetStd.toFixed(3) + ' s' : '-';
    if (res.participant) res.participant.textContent = summary.participant || '-';

    if (res.qualityNote) {
      if (summary.qualityNote) {
        res.qualityNote.textContent = summary.qualityNote;
        res.qualityNote.classList.remove('hidden');
      } else {
        res.qualityNote.textContent = '';
        res.qualityNote.classList.add('hidden');
      }
    }

    const payload = buildSummaryPayload(summary);
    saveLastSummary(payload);
    pushHistory(payload);

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

  function makeCsvName(kind){
    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

    const pid = str((inputParticipant && inputParticipant.value) || '', CTX.pid || 'anon').replace(/\s+/g,'_');
    const study = str(CTX.studyId,'').replace(/\s+/g,'_');
    const seed = str(CTX.seed,'').replace(/\s+/g,'_');

    const parts = ['rb', kind, mode, cfg.engineId, pid];
    if(study) parts.push(study);
    if(seed) parts.push('seed'+seed);
    return parts.join('-') + '.csv';
  }

  (function applyModeFromQuery(){
    try{
      const m = (qs('mode','')||'').toLowerCase();
      if (m === 'research'){
        const r = modeRadios.find(x => x.value === 'research');
        if (r) r.checked = true;
      } else if (m === 'play' || m === 'normal'){
        const r = modeRadios.find(x => x.value === 'normal');
        if (r) r.checked = true;
      }
    }catch(_){}
  })();

  (function setupBackHub(){
    if(!backHubLink) return;
    if(CTX.hub){
      backHubLink.href = CTX.hub + passThroughQuery({});
    }else{
      backHubLink.href = 'hub.html' + passThroughQuery({});
    }
  })();

  modeRadios.forEach(r => r.addEventListener('change', updateModeUI));
  if(btnStart) btnStart.addEventListener('click', startGame);
  if(btnStop) btnStop.addEventListener('click', () => stopGame('manual-stop'));
  if(btnAgain) btnAgain.addEventListener('click', () => startGame());
  if(btnBackMenu) btnBackMenu.addEventListener('click', () => switchView('menu'));

  if(btnDlEvents) btnDlEvents.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getEventsCsv(), makeCsvName('events'));
  });
  if(btnDlSessions) btnDlSessions.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getSessionCsv(), makeCsvName('sessions'));
  });

  // ✅ if open directly in cVR, preload VR UI early
  (function preloadIfCVR(){
    if((CTX.view||'').toLowerCase()==='cvr'){
      ensureVRUI().then(()=>{ document.body.setAttribute('data-view','cvr'); });
    }
  })();

  updateModeUI();
  switchView('menu');

})();