// === /fitness/js/rhythm-boxer.js — UI glue (menu / play / result) ===
// PATCH v20260223-ABC
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

  // Calibration buttons
  const btnCalMinus = $('#rb-btn-cal-minus');
  const btnCalPlus  = $('#rb-btn-cal-plus');
  const btnCalReset = $('#rb-btn-cal-reset');

  // Result fields (optional-safe)
  const res = {
    mode: $('#rb-res-mode'),
    track: $('#rb-res-track'),
    score: $('#rb-res-score'),
    combo: $('#rb-res-combo'),
    acc: $('#rb-res-acc'),
    p: $('#rb-res-perfect'),
    g: $('#rb-res-great'),
    gd: $('#rb-res-good'),
    m: $('#rb-res-miss'),
    dur: $('#rb-res-dur'),
    rank: $('#rb-res-rank'),
    note: $('#rb-res-note'),
    offsetMean: $('#rb-res-offset-mean'),
    offsetStd: $('#rb-res-offset-std'),
    endReason: $('#rb-res-end-reason'),
    participant: $('#rb-res-participant')
  };

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

  const TRACK_CONFIG = {
    n1: { engineId: 'n1', labelShort: 'Warm-up Groove', diff: 'easy'   },
    n2: { engineId: 'n2', labelShort: 'Focus Combo',    diff: 'normal' },
    n3: { engineId: 'n3', labelShort: 'Speed Rush',     diff: 'hard'   },
    r1: { engineId: 'r1', labelShort: 'Research 120',   diff: 'normal' }
  };

  let engine = null;
  let lastSummary = null;

  // ---------- URL helpers ----------
  function getSP() { try { return new URL(location.href).searchParams; } catch(_) { return new URLSearchParams(); } }
  function q(k, d=''){ const v = getSP().get(k); return (v == null || v === '') ? d : v; }
  function hubHref(defaultHref='hub.html'){
    const h = q('hub', defaultHref);
    return h || defaultHref;
  }
  function getLogUrl(){
    const s = q('log', '').trim();
    return s || '';
  }

  // ---------- Cloud logger (optional) ----------
  async function postLogSession(summary){
    const logUrl = getLogUrl();
    if(!logUrl) return { skipped:true, reason:'no-log-param' };

    const payload = {
      _table: 'sessions',
      type: 'session',
      projectTag: 'HeroHealth-RhythmBoxer',
      timestampIso: new Date().toISOString(),
      page: location.pathname,
      gameId: 'rhythm-boxer',
      mode: summary.modeLabel || '',
      trackName: summary.trackName || '',
      endReason: summary.endReason || '',
      scoreFinal: Number(summary.finalScore || 0),
      comboMax: Number(summary.maxCombo || 0),
      accuracyPct: Number(summary.accuracyPct || 0),
      hitPerfect: Number(summary.hitPerfect || 0),
      hitGreat: Number(summary.hitGreat || 0),
      hitGood: Number(summary.hitGood || 0),
      hitMiss: Number(summary.hitMiss || 0),
      durationPlayedSec: Number(summary.durationSec || 0),
      rank: summary.rank || '',
      participantId: summary.participant || '',
      note: summary.qualityNote || '',
      aiEnabled: (window.RB_AI && window.RB_AI.isAssistEnabled) ? !!window.RB_AI.isAssistEnabled() : false,
      aiLocked: (window.RB_AI && window.RB_AI.isLocked) ? !!window.RB_AI.isLocked() : false,
      __extraJson: JSON.stringify({
        offsetMean: summary.offsetMean ?? null,
        offsetStd: summary.offsetStd ?? null
      })
    };

    try{
      const r = await fetch(logUrl, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch(_) {}
      return { ok: r.ok, status: r.status, body: j || txt };
    }catch(err){
      return { ok:false, error:String(err && (err.message || err) || err) };
    }
  }

  // ---------- UI ----------
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
      if (modeDescEl) modeDescEl.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      if (trackModeLbl) trackModeLbl.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
      if (researchBox) researchBox.classList.add('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.add('hidden');
        else lbl.classList.remove('hidden');
      });

      if (getSelectedTrackKey() === 'r1') setSelectedTrackKey('n1');
    } else {
      if (modeDescEl) modeDescEl.textContent = 'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV';
      if (trackModeLbl) trackModeLbl.textContent = 'โหมด Research — เพลงวิจัย Research Track 120';
      if (researchBox) researchBox.classList.remove('hidden');

      trackLabels.forEach(lbl => {
        const m = lbl.getAttribute('data-mode') || 'normal';
        if (m === 'research') lbl.classList.remove('hidden');
        else lbl.classList.add('hidden');
      });

      setSelectedTrackKey('r1');
    }
  }

  function switchView(name) {
    if (viewMenu) viewMenu.classList.add('hidden');
    if (viewPlay) viewPlay.classList.add('hidden');
    if (viewResult) viewResult.classList.add('hidden');

    if (name === 'menu' && viewMenu) viewMenu.classList.remove('hidden');
    else if (name === 'play' && viewPlay) viewPlay.classList.remove('hidden');
    else if (name === 'result' && viewResult) viewResult.classList.remove('hidden');
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
      renderer,
      hud,
      hooks: {
        onEnd: handleEngineEnd
      }
    });
  }

  function startGame() {
    if (!engine) createEngine();

    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

    if (wrap) wrap.dataset.diff = cfg.diff;

    if (hud.mode)  hud.mode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
    if (hud.track) hud.track.textContent = cfg.labelShort;

    // AI flags by URL
    // ?ai=1 enables assist in normal mode only; research remains locked
    if (window.RB_AI && typeof window.RB_AI.configure === 'function') {
      window.RB_AI.configure({
        mode,
        assistEnabled: String(q('ai','0')) === '1',
        locked: (mode === 'research')
      });
    }

    const meta = {
      id:   (inputParticipant && inputParticipant.value || '').trim(),
      group:(inputGroup && inputGroup.value || '').trim(),
      note: (inputNote && inputNote.value || '').trim()
    };

    engine.start(mode, cfg.engineId, meta);
    switchView('play');
  }

  function stopGame(reason) {
    if (engine) engine.stop(reason || 'manual-stop');
  }

  function fmtMs(s){
    if (s == null || s === '' || !Number.isFinite(Number(s))) return '-';
    return `${Math.round(Number(s)*1000)} ms`;
  }

  async function handleEngineEnd(summary) {
    lastSummary = summary || {};

    // result UI (optional-safe)
    if (res.mode)        res.mode.textContent = summary.modeLabel || '-';
    if (res.track)       res.track.textContent = summary.trackName || '-';
    if (res.score)       res.score.textContent = String(summary.finalScore ?? 0);
    if (res.combo)       res.combo.textContent = String(summary.maxCombo ?? 0);
    if (res.acc)         res.acc.textContent = `${Number(summary.accuracyPct || 0).toFixed(1)}%`;
    if (res.p)           res.p.textContent = String(summary.hitPerfect ?? 0);
    if (res.g)           res.g.textContent = String(summary.hitGreat ?? 0);
    if (res.gd)          res.gd.textContent = String(summary.hitGood ?? 0);
    if (res.m)           res.m.textContent = String(summary.hitMiss ?? 0);
    if (res.dur)         res.dur.textContent = `${Number(summary.durationSec || 0).toFixed(1)}s`;
    if (res.rank)        res.rank.textContent = summary.rank || 'C';
    if (res.note)        res.note.textContent = summary.qualityNote || '—';
    if (res.offsetMean)  res.offsetMean.textContent = fmtMs(summary.offsetMean);
    if (res.offsetStd)   res.offsetStd.textContent = fmtMs(summary.offsetStd);
    if (res.endReason)   res.endReason.textContent = summary.endReason || '-';
    if (res.participant) res.participant.textContent = summary.participant || '-';

    // save last summary (HHA-style quick recall)
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game: 'rhythm-boxer',
        ts: new Date().toISOString(),
        page: location.href,
        summary
      }));
    }catch(_){}

    // optional cloud log via ?log=
    try{
      const r = await postLogSession(summary);
      if (r && r.ok) {
        console.log('[RB] cloud log ok', r);
      } else if (r && !r.skipped) {
        console.warn('[RB] cloud log fail', r);
      }
    }catch(err){
      console.warn('[RB] cloud log error', err);
    }

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
  if (btnStart)   btnStart.addEventListener('click', startGame);
  if (btnStop)    btnStop.addEventListener('click', () => stopGame('manual-stop'));
  if (btnAgain)   btnAgain.addEventListener('click', () => startGame());
  if (btnBackMenu)btnBackMenu.addEventListener('click', () => switchView('menu'));

  if (btnDlEvents) {
    btnDlEvents.addEventListener('click', () => {
      if (!engine) return;
      downloadCsv(engine.getEventsCsv(), 'rb-events.csv');
    });
  }
  if (btnDlSessions) {
    btnDlSessions.addEventListener('click', () => {
      if (!engine) return;
      downloadCsv(engine.getSessionCsv(), 'rb-sessions.csv');
    });
  }

  // Calibration
  function calDelta(ms){
    if(!engine) return;
    engine.adjustCalMs(ms);
  }
  if(btnCalMinus) btnCalMinus.addEventListener('click', ()=>calDelta(-20));
  if(btnCalPlus)  btnCalPlus.addEventListener('click',  ()=>calDelta(+20));
  if(btnCalReset) btnCalReset.addEventListener('click', ()=>{ if(engine) engine.setCalMs(0); });

  // apply mode from URL (?mode=research|play)
  (function applyModeFromQuery(){
    try{
      const m = (q('mode','') || '').toLowerCase();
      if (m === 'research'){
        const r = modeRadios.find(x => x.value === 'research');
        if (r) r.checked = true;
      } else if (m === 'play' || m === 'normal'){
        const r = modeRadios.find(x => x.value === 'normal');
        if (r) r.checked = true;
      }
    }catch(_){}
  })();

  // back-to-hub links (if present)
  (function patchHubLinks(){
    const href = hubHref('hub.html');
    ['#rb-btn-hub-menu', '#rb-btn-hub-play', '#rb-btn-hub-result'].forEach(sel=>{
      const a = $(sel);
      if (a && a.tagName === 'A') a.href = href;
    });
  })();

  updateModeUI();
  switchView('menu');
})();