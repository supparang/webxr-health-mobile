// === /fitness/js/rhythm-boxer.js — UI glue (menu / play / result / calibration) ===
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

  // buttons menu
  const btnStart      = $('#rb-btn-start');
  const btnCalibOpen  = $('#rb-btn-calib');
  const calibStatusEl = $('#rb-calib-status');

  const modeRadios    = $$('input[name="rb-mode"]');
  const trackRadios   = $$('input[name="rb-track"]');
  const trackLabels   = $$('#rb-track-options .rb-mode-btn');
  const modeDescEl    = $('#rb-mode-desc');
  const trackModeLbl  = $('#rb-track-mode-label');
  const researchBox   = $('#rb-research-fields');

  // research fields
  const inputParticipant = $('#rb-participant');
  const inputGroup       = $('#rb-group');
  const inputNote        = $('#rb-note');

  // play / result buttons
  const btnStop        = $('#rb-btn-stop');
  const btnAgain       = $('#rb-btn-again');
  const btnBackMenu    = $('#rb-btn-back-menu');
  const btnDlEvents    = $('#rb-btn-dl-events');
  const btnDlSessions  = $('#rb-btn-dl-sessions');

  // result extra fields
  const resCalib = $('#rb-res-calib');

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
    aiTip:        $('#rb-hud-ai-tip'),
    calib:        $('#rb-hud-calib')
  };

  // Result mapping
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

  // Track config from UI -> engine
  const TRACK_CONFIG = {
    n1: { engineId: 'n1', labelShort: 'Warm-up Groove', diff: 'easy'   },
    n2: { engineId: 'n2', labelShort: 'Focus Combo',    diff: 'normal' },
    n3: { engineId: 'n3', labelShort: 'Speed Rush',     diff: 'hard'   },
    r1: { engineId: 'r1', labelShort: 'Research 120',   diff: 'normal' }
  };

  let engine = null;

  // ---- calibration store ----
  function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

  function getCalibMs(){
    try{
      const v = localStorage.getItem('RB_CAL_OFFSET_MS');
      const n = Number(v);
      if(Number.isFinite(n)) return clamp(n, -180, 180);
    }catch(_){}
    return 0;
  }
  function setCalibMs(ms){
    const n = clamp(ms, -180, 180);
    try{ localStorage.setItem('RB_CAL_OFFSET_MS', String(n)); }catch(_){}
    return n;
  }

  function updateCalibStatus(){
    const ms = getCalibMs();
    if (calibStatusEl){
      calibStatusEl.textContent = `Calibration: ${ms} ms (เก็บในเครื่องนี้)`;
    }
  }

  // ---- UI selectors ----
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
        'Research: ใช้เก็บข้อมูลเชิงวิจัย พร้อมดาวน์โหลด CSV (AI prediction แสดงได้ แต่ล็อกไม่ให้ช่วยปรับเกม)';
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

  function startGame() {
    if (!engine) createEngine();

    const mode = getSelectedMode();
    const trackKey = getSelectedTrackKey();
    const cfg = TRACK_CONFIG[trackKey] || TRACK_CONFIG.n1;

    wrap.dataset.diff = cfg.diff;

    if (hud.mode)  hud.mode.textContent  = (mode === 'research') ? 'Research' : 'Normal';
    if (hud.track) hud.track.textContent = cfg.labelShort;

    const cm = getCalibMs();
    if (hud.calib) hud.calib.textContent = `${cm}ms`;

    const meta = {
      id:   (inputParticipant && inputParticipant.value || '').trim(),
      group:(inputGroup && inputGroup.value || '').trim(),
      note: (inputNote && inputNote.value || '').trim()
    };

    // IMPORTANT: research lock — RB_AI already locks assist when mode=research
    engine.start(mode, cfg.engineId, meta);
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

    res.offsetAvg.textContent = (summary.offsetMean != null && Number.isFinite(summary.offsetMean))
      ? summary.offsetMean.toFixed(3) + ' s' : '-';
    res.offsetStd.textContent = (summary.offsetStd != null && Number.isFinite(summary.offsetStd))
      ? summary.offsetStd.toFixed(3) + ' s' : '-';

    res.participant.textContent = summary.participant || '-';

    const cm = getCalibMs();
    if (resCalib) resCalib.textContent = `${cm} ms`;

    if (summary.qualityNote) {
      res.qualityNote.textContent = summary.qualityNote;
      res.qualityNote.classList.remove('hidden');
    } else {
      res.qualityNote.textContent = '';
      res.qualityNote.classList.add('hidden');
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

  // ===== Calibration Modal =====
  function openCalibrationModal(){
    // create overlay
    const modal = document.createElement('div');
    modal.className = 'rb-modal';
    modal.innerHTML = `
      <div class="rb-modal-card" role="dialog" aria-modal="true">
        <h2 class="rb-modal-title">⏱ Calibration (Offset)</h2>
        <p class="rb-modal-sub">
          เป้าหมาย: ตั้งค่า “offset (ms)” ให้การกดตรงเส้นตีมากขึ้น<br/>
          วิธีทำ: เมื่อเห็นจุดเต้น (beat) ให้แตะหน้าจอ/คลิกตามจังหวะ 10–14 ครั้ง แล้วระบบจะสรุปค่า offset
        </p>

        <div class="rb-modal-meter">
          <div id="rb-cal-dot" class="rb-beat-dot"></div>
          <div class="rb-modal-text">
            <div>Beat: <b id="rb-cal-bpm">120</b> BPM · Interval: <b id="rb-cal-int">500</b> ms</div>
            <div>Samples: <b id="rb-cal-n">0</b> · Mean offset: <b id="rb-cal-mean">0</b> ms</div>
            <div style="color:#9ca3af;font-size:.86rem">
              * offset บวก = คุณกดช้ากว่าจังหวะ (late) / offset ลบ = กดเร็วกว่าจังหวะ (early)
            </div>
          </div>
        </div>

        <div class="rb-modal-actions">
          <button class="rb-btn rb-btn-primary" id="rb-cal-save" type="button">💾 Save offset</button>
          <button class="rb-btn" id="rb-cal-reset" type="button">♻ Reset</button>
          <button class="rb-btn rb-btn-ghost" id="rb-cal-close" type="button">✖ Close</button>
        </div>

        <p class="rb-modal-foot">
          Tip: ทำ calibration ในสภาพแวดล้อมที่จะใช้จริง (มือถือ/คอม/โหมด cVR)
        </p>
      </div>
    `;
    document.body.appendChild(modal);

    const dot  = modal.querySelector('#rb-cal-dot');
    const elBpm= modal.querySelector('#rb-cal-bpm');
    const elInt= modal.querySelector('#rb-cal-int');
    const elN  = modal.querySelector('#rb-cal-n');
    const elMean = modal.querySelector('#rb-cal-mean');

    const btnSave = modal.querySelector('#rb-cal-save');
    const btnReset= modal.querySelector('#rb-cal-reset');
    const btnClose= modal.querySelector('#rb-cal-close');

    const bpm = 120;
    const intervalMs = Math.round(60000 / bpm);
    elBpm.textContent = String(bpm);
    elInt.textContent = String(intervalMs);

    let t0 = performance.now();
    let beatIdx = 0;
    let samples = []; // tapTime - beatTime (ms)

    function beat(){
      beatIdx++;
      dot.classList.add('is-beat');
      setTimeout(()=>dot.classList.remove('is-beat'), 80);

      // schedule next
      if(modal.isConnected){
        setTimeout(beat, intervalMs);
      }
    }
    // start beat loop
    setTimeout(beat, 180);

    function currentBeatTimeMs(){
      // approximate by using t0 and beatIdx
      // We align to nearest beat time.
      const now = performance.now();
      const dt = now - t0;
      const k = Math.round(dt / intervalMs);
      return t0 + k*intervalMs;
    }

    function updateStats(){
      elN.textContent = String(samples.length);
      const m = samples.length ? (samples.reduce((s,x)=>s+x,0)/samples.length) : 0;
      elMean.textContent = String(Math.round(m));
    }

    function onTap(){
      const now = performance.now();
      const bt = currentBeatTimeMs();
      const off = now - bt; // ms (late positive)
      samples.push(off);
      if(samples.length > 20) samples.shift();
      updateStats();
    }

    modal.addEventListener('pointerdown', (e)=>{
      // ignore if clicking buttons
      const t = e.target;
      if(t && t.closest && t.closest('.rb-modal-actions')) return;
      onTap();
    }, {passive:true});

    btnReset.addEventListener('click', ()=>{
      samples = [];
      updateStats();
    });

    btnSave.addEventListener('click', ()=>{
      const m = samples.length ? (samples.reduce((s,x)=>s+x,0)/samples.length) : 0;
      const save = setCalibMs(Math.round(m));
      updateCalibStatus();
      if(hud.calib) hud.calib.textContent = `${save}ms`;
      btnSave.textContent = `💾 Saved (${save}ms)`;
      setTimeout(()=>{ btnSave.textContent = '💾 Save offset'; }, 900);
    });

    function close(){
      modal.remove();
    }
    btnClose.addEventListener('click', close);

    // close on ESC
    window.addEventListener('keydown', function esc(e){
      if(e.key === 'Escape'){
        window.removeEventListener('keydown', esc);
        close();
      }
    });
  }

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

  // wiring
  modeRadios.forEach(r => r.addEventListener('change', updateModeUI));
  if(btnStart) btnStart.addEventListener('click', startGame);
  if(btnStop) btnStop.addEventListener('click', () => stopGame('manual-stop'));
  if(btnAgain) btnAgain.addEventListener('click', () => startGame());
  if(btnBackMenu) btnBackMenu.addEventListener('click', () => switchView('menu'));

  if(btnDlEvents) btnDlEvents.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getEventsCsv(), 'rb-events.csv');
  });
  if(btnDlSessions) btnDlSessions.addEventListener('click', () => {
    if (!engine) return;
    downloadCsv(engine.getSessionCsv(), 'rb-sessions.csv');
  });

  if(btnCalibOpen) btnCalibOpen.addEventListener('click', openCalibrationModal);

  // init UI
  updateModeUI();
  switchView('menu');
  updateCalibStatus();

})();