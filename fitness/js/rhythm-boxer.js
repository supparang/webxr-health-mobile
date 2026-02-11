// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer — Controller/UI glue
// ✅ Switch views: Menu / Play / Result
// ✅ Read mode + track + research meta
// ✅ Boot Engine + Renderer
// ✅ Download CSV (events/sessions)
// ✅ Keeps Research lock: AI prediction only (no gameplay adaptation)

'use strict';

(function(){
  const DOC = document;
  const WIN = window;

  // ---------- helpers ----------
  const qs  = (s, root=DOC)=>root.querySelector(s);
  const qsa = (s, root=DOC)=>Array.from(root.querySelectorAll(s));

  function setHidden(el, hidden){
    if(!el) return;
    el.classList.toggle('hidden', !!hidden);
  }

  function safeText(el, txt){
    if(el) el.textContent = (txt==null ? '' : String(txt));
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }catch(_){}
  }

  function getSelectedRadio(name){
    const el = qs(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function setView(viewId){
    const views = ['rb-view-menu','rb-view-play','rb-view-result'];
    for(const id of views){
      const el = qs('#'+id);
      setHidden(el, id !== viewId);
    }
  }

  function readModeFromUI(){
    const v = getSelectedRadio('rb-mode');
    return (v === 'research') ? 'research' : 'normal';
  }

  function applyModeUI(mode){
    const desc = qs('#rb-mode-desc');
    const fields = qs('#rb-research-fields');
    const trackLabel = qs('#rb-track-mode-label');

    if(mode === 'research'){
      if(desc) desc.textContent = 'Research: เก็บข้อมูลวิจัย (กรอก Participant/Group/Note) · บันทึก CSV';
      setHidden(fields, false);
      if(trackLabel) trackLabel.textContent = 'โหมด Research — เพลงทดลอง (คงที่สำหรับงานวิจัย)';
    }else{
      if(desc) desc.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      setHidden(fields, true);
      if(trackLabel) trackLabel.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // show/hide track choices by data-mode
    qsa('#rb-track-options .rb-mode-btn').forEach(lbl=>{
      const m = (lbl.getAttribute('data-mode')||'').toLowerCase();
      if(!m) return;
      setHidden(lbl, m !== mode);
    });

    // if current selected track isn't visible in this mode => auto select first
    const current = qs('input[name="rb-track"]:checked');
    if(current){
      const parent = current.closest('.rb-mode-btn');
      const pmode = (parent && parent.getAttribute('data-mode')||'').toLowerCase();
      if(pmode && pmode !== mode){
        const first = qs(`#rb-track-options .rb-mode-btn[data-mode="${mode}"] input[name="rb-track"]`);
        if(first) first.checked = true;
      }
    }
  }

  function getTrackName(trackId){
    // keep in sync with engine TRACKS labels
    const map = {
      n1: 'Warm-up Groove',
      n2: 'Focus Combo',
      n3: 'Speed Rush',
      r1: 'Research Track 120'
    };
    return map[trackId] || trackId;
  }

  // ---------- bind UI ----------
  const btnStart = qs('#rb-btn-start');
  const btnStop  = qs('#rb-btn-stop');

  const btnAgain = qs('#rb-btn-again');
  const btnBackMenu = qs('#rb-btn-back-menu');

  const btnDlEvents   = qs('#rb-btn-dl-events');
  const btnDlSessions = qs('#rb-btn-dl-sessions');

  const lanesEl = qs('#rb-lanes');
  const audioEl = qs('#rb-audio');

  // HUD refs
  const HUD = {
    mode: qs('#rb-hud-mode'),
    track: qs('#rb-hud-track'),

    score: qs('#rb-hud-score'),
    combo: qs('#rb-hud-combo'),
    acc:   qs('#rb-hud-acc'),

    hp: qs('#rb-hud-hp'),
    shield: qs('#rb-hud-shield'),
    time: qs('#rb-hud-time'),

    countPerfect: qs('#rb-hud-perfect'),
    countGreat:   qs('#rb-hud-great'),
    countGood:    qs('#rb-hud-good'),
    countMiss:    qs('#rb-hud-miss'),

    feverFill: qs('#rb-fever-fill'),
    feverStatus: qs('#rb-fever-status'),
    progFill: qs('#rb-progress-fill'),
    progText: qs('#rb-progress-text'),

    aiFatigue: qs('#rb-hud-ai-fatigue'),
    aiSkill: qs('#rb-hud-ai-skill'),
    aiSuggest: qs('#rb-hud-ai-suggest'),
    aiTip: qs('#rb-hud-ai-tip')
  };

  // Result refs
  const RES = {
    mode: qs('#rb-res-mode'),
    track: qs('#rb-res-track'),
    endreason: qs('#rb-res-endreason'),
    score: qs('#rb-res-score'),
    maxcombo: qs('#rb-res-maxcombo'),
    detailHit: qs('#rb-res-detail-hit'),
    acc: qs('#rb-res-acc'),
    duration: qs('#rb-res-duration'),
    rank: qs('#rb-res-rank'),
    offAvg: qs('#rb-res-offset-avg'),
    offStd: qs('#rb-res-offset-std'),
    participant: qs('#rb-res-participant'),
    qualityNote: qs('#rb-res-quality-note')
  };

  const feedbackEl = qs('#rb-feedback');

  // mode change
  qsa('input[name="rb-mode"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      const mode = readModeFromUI();
      applyModeUI(mode);
    });
  });
  // initial apply
  applyModeUI(readModeFromUI());

  // ---------- Renderer (optional) ----------
  // dom-renderer-rhythm.js should expose window.DomRendererRhythm (classic global)
  const renderer = (WIN.DomRendererRhythm)
    ? new WIN.DomRendererRhythm({
        lanesEl,
        flashEl: qs('#rb-flash'),
        feedbackEl
      })
    : null;

  // ---------- Engine ----------
  if(!WIN.RhythmBoxerEngine){
    console.error('[RhythmBoxer] missing RhythmBoxerEngine');
  }

  let engine = null;

  function bootEngine(){
    engine = new WIN.RhythmBoxerEngine({
      wrap: qs('#rb-wrap'),
      field: qs('#rb-field'),
      lanesEl,
      audio: audioEl,
      renderer,
      hud: {
        score: HUD.score,
        combo: HUD.combo,
        acc: HUD.acc,
        hp: HUD.hp,
        shield: HUD.shield,
        time: HUD.time,

        countPerfect: HUD.countPerfect,
        countGreat: HUD.countGreat,
        countGood: HUD.countGood,
        countMiss: HUD.countMiss,

        feverFill: HUD.feverFill,
        feverStatus: HUD.feverStatus,
        progFill: HUD.progFill,
        progText: HUD.progText,

        aiFatigue: HUD.aiFatigue,
        aiSkill: HUD.aiSkill,
        aiSuggest: HUD.aiSuggest,
        aiTip: HUD.aiTip
      },
      hooks: {
        onStart: (info)=>{
          safeText(HUD.mode, info.mode === 'research' ? 'Research' : 'Normal');
          safeText(HUD.track, info.track ? info.track.name : '');
          if(renderer && renderer.reset) renderer.reset();
        },
        onEnd: (summary)=>{
          // fill result view
          safeText(RES.mode, summary.modeLabel);
          safeText(RES.track, summary.trackName);
          safeText(RES.endreason, summary.endReason);
          safeText(RES.score, summary.finalScore);
          safeText(RES.maxcombo, summary.maxCombo);
          safeText(RES.detailHit, `${summary.hitPerfect} / ${summary.hitGreat} / ${summary.hitGood} / ${summary.hitMiss}`);
          safeText(RES.acc, `${Number(summary.accuracyPct||0).toFixed(1)} %`);
          safeText(RES.duration, `${Number(summary.durationSec||0).toFixed(1)} s`);
          safeText(RES.rank, summary.rank || '-');

          safeText(RES.offAvg, (summary.offsetMean!=null) ? `${Number(summary.offsetMean).toFixed(4)} s` : '-');
          safeText(RES.offStd, (summary.offsetStd!=null) ? `${Number(summary.offsetStd).toFixed(4)} s` : '-');
          safeText(RES.participant, summary.participant || '-');

          if(summary.qualityNote){
            safeText(RES.qualityNote, summary.qualityNote);
            setHidden(RES.qualityNote, false);
          }else{
            setHidden(RES.qualityNote, true);
          }

          setView('rb-view-result');
        }
      }
    });
  }

  bootEngine();

  // ---------- Start flow ----------
  function collectMeta(mode){
    if(mode !== 'research'){
      return { id:'', group:'', note:'' };
    }
    const pid = (qs('#rb-participant') && qs('#rb-participant').value || '').trim();
    const grp = (qs('#rb-group') && qs('#rb-group').value || '').trim();
    const note = (qs('#rb-note') && qs('#rb-note').value || '').trim();
    return { id: pid, participant_id: pid, group: grp, note };
  }

  function startGame(){
    const mode = readModeFromUI();
    const trackId = getSelectedRadio('rb-track') || 'n1';

    // enforce AI lock behavior through URL param "mode"
    // (ai-predictor.js reads mode from query; we keep UI mode as source of truth)
    try{
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      // keep ?ai as is (normal assist only if user passes ?ai=1)
      history.replaceState(null, '', url.toString());
    }catch(_){}

    const meta = collectMeta(mode);

    safeText(HUD.mode, mode === 'research' ? 'Research' : 'Normal');
    safeText(HUD.track, getTrackName(trackId));

    setView('rb-view-play');

    // small "Ready" feedback
    if(feedbackEl) feedbackEl.textContent = 'เริ่มเลย!';

    // start engine
    engine.start(mode, trackId, meta);
  }

  if(btnStart){
    btnStart.addEventListener('click', ()=>{
      startGame();
    });
  }

  if(btnStop){
    btnStop.addEventListener('click', ()=>{
      if(engine) engine.stop('manual-stop');
    });
  }

  // again / back menu
  if(btnAgain){
    btnAgain.addEventListener('click', ()=>{
      // restart with same UI selections
      setView('rb-view-play');
      startGame();
    });
  }
  if(btnBackMenu){
    btnBackMenu.addEventListener('click', ()=>{
      setView('rb-view-menu');
    });
  }

  // CSV download
  function makeCsvName(prefix){
    const mode = readModeFromUI();
    const trackId = getSelectedRadio('rb-track') || 'n1';
    const pid = (qs('#rb-participant') && qs('#rb-participant').value || '').trim();
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const ptag = pid ? `_${pid}` : '';
    return `${prefix}_${mode}_${trackId}${ptag}_${stamp}.csv`;
  }

  if(btnDlEvents){
    btnDlEvents.addEventListener('click', ()=>{
      if(!engine) return;
      downloadText(makeCsvName('rb_events'), engine.getEventsCsv());
    });
  }
  if(btnDlSessions){
    btnDlSessions.addEventListener('click', ()=>{
      if(!engine) return;
      downloadText(makeCsvName('rb_sessions'), engine.getSessionCsv());
    });
  }

})();