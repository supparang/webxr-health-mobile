// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer UI Controller — PRODUCTION
// ✅ Menu mode/track selects
// ✅ Research fields show/hide + meta collection
// ✅ Start/Stop/Again/Back menu
// ✅ Result render
// ✅ CSV download (events + sessions)
// ✅ Mode in URL (?mode=research|normal) so RB_AI lock works

'use strict';

(function(){
  const DOC = document;
  const WIN = window;

  // ---------- helpers ----------
  const $ = (sel, root=DOC)=>root.querySelector(sel);
  const $$ = (sel, root=DOC)=>Array.from(root.querySelectorAll(sel));

  function setHidden(el, hidden){
    if(!el) return;
    el.classList.toggle('hidden', !!hidden);
  }

  function safeText(el, txt){
    if(!el) return;
    el.textContent = (txt==null? '' : String(txt));
  }

  function fmtPct(v, d=1){
    const n = Number(v)||0;
    return n.toFixed(d) + '%';
  }

  function fmtNum(v, d=1){
    const n = Number(v)||0;
    return n.toFixed(d);
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
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }

  function getSelectedRadio(name){
    const el = DOC.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  }

  function setQueryParam(key, value){
    try{
      const u = new URL(location.href);
      if(value==null || value==='') u.searchParams.delete(key);
      else u.searchParams.set(key, value);
      history.replaceState({}, '', u.toString());
    }catch(_){}
  }

  function readQueryParam(key){
    try{ return new URL(location.href).searchParams.get(key); }catch(_){ return null; }
  }

  // ---------- elements ----------
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  const modeDesc   = $('#rb-mode-desc');
  const researchFields = $('#rb-research-fields');

  const trackModeLabel = $('#rb-track-mode-label');

  const btnStart = $('#rb-btn-start');
  const btnStop  = $('#rb-btn-stop');
  const btnAgain = $('#rb-btn-again');
  const btnBackMenu = $('#rb-btn-back-menu');

  const btnDlEvents   = $('#rb-btn-dl-events');
  const btnDlSessions = $('#rb-btn-dl-sessions');

  const audioEl = $('#rb-audio');
  const fieldEl = $('#rb-field');
  const lanesEl = $('#rb-lanes');

  // HUD
  const hud = {
    mode: $('#rb-hud-mode'),
    track: $('#rb-hud-track'),
    score: $('#rb-hud-score'),
    combo: $('#rb-hud-combo'),
    acc: $('#rb-hud-acc'),
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
    progText: $('#rb-progress-text'),
    aiFatigue: $('#rb-hud-ai-fatigue'),
    aiSkill: $('#rb-hud-ai-skill'),
    aiSuggest: $('#rb-hud-ai-suggest'),
    aiTip: $('#rb-hud-ai-tip')
  };

  // Result
  const res = {
    mode: $('#rb-res-mode'),
    track: $('#rb-res-track'),
    endreason: $('#rb-res-endreason'),
    score: $('#rb-res-score'),
    maxcombo: $('#rb-res-maxcombo'),
    detailHit: $('#rb-res-detail-hit'),
    acc: $('#rb-res-acc'),
    duration: $('#rb-res-duration'),
    rank: $('#rb-res-rank'),
    offsetAvg: $('#rb-res-offset-avg'),
    offsetStd: $('#rb-res-offset-std'),
    participant: $('#rb-res-participant'),
    qualityNote: $('#rb-res-quality-note')
  };

  // Research inputs
  const inpPid  = $('#rb-participant');
  const inpGroup= $('#rb-group');
  const inpNote = $('#rb-note');

  // ---------- state ----------
  let engine = null;
  let lastMode = 'normal';
  let lastTrackId = 'n1';
  let lastMeta = {};

  function showView(name){
    setHidden(viewMenu,   name!=='menu');
    setHidden(viewPlay,   name!=='play');
    setHidden(viewResult, name!=='result');
  }

  function updateModeUI(mode){
    const isResearch = mode === 'research';
    setHidden(researchFields, !isResearch);

    safeText(modeDesc,
      isResearch
        ? 'Research: เก็บข้อมูลวิจัย (Event CSV + Session CSV) — แสดง AI prediction ได้ แต่ “ล็อกเกม” ไม่ให้ AI ปรับอะไร'
        : 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)'
    );

    // Track options label
    safeText(trackModeLabel,
      isResearch
        ? 'โหมด Research — ใช้แทร็กมาตรฐานเดียว (ควบคุมตัวแปรง่าย)'
        : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก'
    );

    // Filter track radio by data-mode
    $$('#rb-track-options .rb-mode-btn').forEach(lbl=>{
      const m = lbl.getAttribute('data-mode');
      if(!m) return;
      lbl.style.display = (m === mode) ? '' : 'none';
    });

    // Ensure a valid track for that mode is selected
    const current = getSelectedRadio('rb-track');
    if(mode==='research'){
      if(current !== 'r1'){
        const r1 = DOC.querySelector('input[name="rb-track"][value="r1"]');
        if(r1) r1.checked = true;
      }
    }else{
      if(current && current.startsWith('r')){
        const n1 = DOC.querySelector('input[name="rb-track"][value="n1"]');
        if(n1) n1.checked = true;
      }
    }
  }

  function wireModeRadios(){
    $$('input[name="rb-mode"]').forEach(r=>{
      r.addEventListener('change', ()=>{
        const mode = getSelectedRadio('rb-mode') || 'normal';
        updateModeUI(mode);
      });
    });
  }

  function getTrackNameById(trackId){
    const map = {
      n1: 'Warm-up Groove',
      n2: 'Focus Combo',
      n3: 'Speed Rush',
      r1: 'Research Track 120'
    };
    return map[trackId] || trackId;
  }

  function collectMeta(mode){
    if(mode !== 'research'){
      return { id:'', participant_id:'', group:'', note:'' };
    }
    return {
      id: (inpPid && inpPid.value || '').trim(),
      participant_id: (inpPid && inpPid.value || '').trim(),
      group: (inpGroup && inpGroup.value || '').trim(),
      note: (inpNote && inpNote.value || '').trim()
    };
  }

  function startGame(){
    const mode = getSelectedRadio('rb-mode') || 'normal';
    const trackId = getSelectedRadio('rb-track') || (mode==='research' ? 'r1' : 'n1');
    const meta = collectMeta(mode);

    // Put mode in URL so RB_AI reads it
    setQueryParam('mode', mode);

    // Build engine if needed
    if(!WIN.RhythmBoxerEngine){
      alert('Engine ยังไม่โหลด (RhythmBoxerEngine missing)');
      return;
    }

    engine = new WIN.RhythmBoxerEngine({
      wrap: $('#rb-wrap'),
      field: fieldEl,
      lanesEl: lanesEl,
      audio: audioEl,
      renderer: WIN.RhythmDomRenderer ? new WIN.RhythmDomRenderer({ root: $('#rb-wrap') }) : null,
      hud,
      hooks: {
        onStart(info){
          // HUD mode/track header
          safeText(hud.mode, info.mode === 'research' ? 'Research' : 'Normal');
          safeText(hud.track, getTrackNameById(trackId));
        },
        onEnd(summary){
          renderResult(summary);
          showView('result');
        }
      }
    });

    lastMode = mode;
    lastTrackId = trackId;
    lastMeta = meta;

    // Switch view to play first (so mobile audio unlock continues)
    showView('play');

    // Fill HUD static
    safeText(hud.mode, mode === 'research' ? 'Research' : 'Normal');
    safeText(hud.track, getTrackNameById(trackId));

    // Start engine
    engine.start(mode, trackId, meta);
  }

  function stopGame(){
    if(engine && typeof engine.stop === 'function'){
      engine.stop('manual-stop');
    }else{
      showView('menu');
    }
  }

  function playAgain(){
    if(!engine){
      showView('menu');
      return;
    }
    // re-create engine cleanly to avoid leftover notes
    showView('menu');
    // slight defer to let UI paint
    setTimeout(()=>{
      // restore radios
      const m = DOC.querySelector(`input[name="rb-mode"][value="${lastMode}"]`);
      if(m) m.checked = true;
      updateModeUI(lastMode);

      const t = DOC.querySelector(`input[name="rb-track"][value="${lastTrackId}"]`);
      if(t) t.checked = true;

      if(inpPid) inpPid.value = lastMeta.id || lastMeta.participant_id || '';
      if(inpGroup) inpGroup.value = lastMeta.group || '';
      if(inpNote) inpNote.value = lastMeta.note || '';

      startGame();
    }, 50);
  }

  function renderResult(summary){
    // summary from engine.hooks.onEnd
    safeText(res.mode, summary.modeLabel || '-');
    safeText(res.track, summary.trackName || '-');
    safeText(res.endreason, summary.endReason || '-');

    safeText(res.score, summary.finalScore ?? 0);
    safeText(res.maxcombo, summary.maxCombo ?? 0);

    safeText(res.detailHit,
      `${summary.hitPerfect ?? 0} / ${summary.hitGreat ?? 0} / ${summary.hitGood ?? 0} / ${summary.hitMiss ?? 0}`
    );

    safeText(res.acc, fmtNum(summary.accuracyPct ?? 0, 1) + ' %');
    safeText(res.duration, fmtNum(summary.durationSec ?? 0, 1) + ' s');
    safeText(res.rank, summary.rank || '-');

    safeText(res.offsetAvg, fmtNum(summary.offsetMean ?? 0, 4) + ' s');
    safeText(res.offsetStd, fmtNum(summary.offsetStd ?? 0, 4) + ' s');

    safeText(res.participant, summary.participant || '-');

    if(summary.qualityNote){
      safeText(res.qualityNote, summary.qualityNote);
      setHidden(res.qualityNote, false);
    }else{
      setHidden(res.qualityNote, true);
    }
  }

  function downloadEvents(){
    if(!engine || typeof engine.getEventsCsv !== 'function'){
      alert('ยังไม่มีข้อมูล Event CSV');
      return;
    }
    const csv = engine.getEventsCsv();
    const name = `rb_events_${(lastMeta.id||lastMeta.participant_id||'anon')}_${Date.now()}.csv`;
    downloadText(name, csv);
  }

  function downloadSessions(){
    if(!engine || typeof engine.getSessionCsv !== 'function'){
      alert('ยังไม่มีข้อมูล Session CSV');
      return;
    }
    const csv = engine.getSessionCsv();
    const name = `rb_sessions_${(lastMeta.id||lastMeta.participant_id||'anon')}_${Date.now()}.csv`;
    downloadText(name, csv);
  }

  // ---------- init ----------
  function init(){
    // Show menu first
    showView('menu');

    // Wire mode UI
    wireModeRadios();

    // Initial mode UI
    const mode0 = getSelectedRadio('rb-mode') || 'normal';
    updateModeUI(mode0);

    // Respect URL mode if provided (optional)
    const qm = (readQueryParam('mode') || '').toLowerCase();
    if(qm === 'research' || qm === 'normal'){
      const r = DOC.querySelector(`input[name="rb-mode"][value="${qm}"]`);
      if(r) r.checked = true;
      updateModeUI(qm);
      lastMode = qm;
    }

    // Start
    if(btnStart) btnStart.addEventListener('click', startGame);

    // Stop
    if(btnStop) btnStop.addEventListener('click', stopGame);

    // Result buttons
    if(btnAgain) btnAgain.addEventListener('click', playAgain);
    if(btnBackMenu) btnBackMenu.addEventListener('click', ()=>{
      // clear URL mode? keep it is fine; but return to menu
      showView('menu');
    });

    // CSV
    if(btnDlEvents) btnDlEvents.addEventListener('click', downloadEvents);
    if(btnDlSessions) btnDlSessions.addEventListener('click', downloadSessions);

    // Update play instruction text to match your intent (gold line at bottom)
    // (ไม่แก้ HTML ตรง ๆ แต่คุณสามารถเปลี่ยนใน HTML ก็ได้)
    // Note: ถ้าต้องการแก้ข้อความในหน้า play ให้ผมแก้ HTML ด้วย เดี๋ยวจัดไฟล์ rhythm-boxer.html ต่อ
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

})();