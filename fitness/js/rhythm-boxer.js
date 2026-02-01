// === /fitness/js/rhythm-boxer.js ===
/* Rhythm Boxer — UI Controller (PRODUCTION)
   - Menu: mode + track selection
   - Play: starts engine + binds taps
   - Result: summary + CSV download
   - Research lock: mode=research => AI prediction only, NO assist
   - Normal: AI assist optional via ?ai=1 (prediction always shown)
*/

(function(){
  'use strict';

  const DOC = document;
  const WIN = window;

  const qs = (k, d=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; }
  };

  const el = (id)=>DOC.getElementById(id);

  const wrap = el('rb-wrap');

  const viewMenu   = el('rb-view-menu');
  const viewPlay   = el('rb-view-play');
  const viewResult = el('rb-view-result');

  const flash = el('rb-flash');

  const modeDesc = el('rb-mode-desc');
  const researchFields = el('rb-research-fields');

  const trackModeLabel = el('rb-track-mode-label');
  const btnStart = el('rb-btn-start');
  const btnStop  = el('rb-btn-stop');

  const btnAgain = el('rb-btn-again');
  const btnBackMenu = el('rb-btn-back-menu');
  const btnDlEvents = el('rb-btn-dl-events');
  const btnDlSessions = el('rb-btn-dl-sessions');

  // hud
  const hudMode = el('rb-hud-mode');
  const hudTrack = el('rb-hud-track');
  const hudScore = el('rb-hud-score');
  const hudCombo = el('rb-hud-combo');
  const hudAcc = el('rb-hud-acc');

  const hudAiFatigue = el('rb-hud-ai-fatigue');
  const hudAiSkill   = el('rb-hud-ai-skill');
  const hudAiSuggest = el('rb-hud-ai-suggest');
  const hudAiTip     = el('rb-hud-ai-tip');

  const hudHP = el('rb-hud-hp');
  const hudShield = el('rb-hud-shield');
  const hudTime = el('rb-hud-time');

  const hudPerfect = el('rb-hud-perfect');
  const hudGreat = el('rb-hud-great');
  const hudGood = el('rb-hud-good');
  const hudMiss = el('rb-hud-miss');

  const feverFill = el('rb-fever-fill');
  const feverStatus = el('rb-fever-status');

  const progFill = el('rb-progress-fill');
  const progText = el('rb-progress-text');

  const feedback = el('rb-feedback');
  const lanesWrap = el('rb-lanes');

  // result
  const resMode = el('rb-res-mode');
  const resTrack = el('rb-res-track');
  const resEndReason = el('rb-res-endreason');
  const resScore = el('rb-res-score');
  const resMaxCombo = el('rb-res-maxcombo');
  const resDetailHit = el('rb-res-detail-hit');
  const resAcc = el('rb-res-acc');
  const resDuration = el('rb-res-duration');
  const resRank = el('rb-res-rank');

  const resOffsetAvg = el('rb-res-offset-avg');
  const resOffsetStd = el('rb-res-offset-std');
  const resParticipant = el('rb-res-participant');

  const resQualityNote = el('rb-res-quality-note');

  // research fields inputs
  const inpParticipant = el('rb-participant');
  const inpGroup = el('rb-group');
  const inpNote = el('rb-note');

  // audio element
  const audioEl = el('rb-audio');

  // track map (id -> metadata)
  const TRACKS = {
    n1: { id:'n1', title:'Warm-up Groove', bpm:100, diff:'easy',   audio:'./audio/warmup-groove.mp3' },
    n2: { id:'n2', title:'Focus Combo',    bpm:120, diff:'normal', audio:'./audio/focus-combo.mp3' },
    n3: { id:'n3', title:'Speed Rush',     bpm:140, diff:'hard',   audio:'./audio/speed-rush.mp3' },
    r1: { id:'r1', title:'Research Track 120', bpm:120, diff:'normal', audio:'./audio/research-120.mp3', research:true }
  };

  // state
  let selectedMode = 'normal';
  let selectedTrackId = 'n1';
  let engine = null;

  // capture CSV buffers (engine returns them too)
  let lastCsvEvents = '';
  let lastCsvSessions = '';

  function showView(which){
    viewMenu.classList.toggle('hidden', which !== 'menu');
    viewPlay.classList.toggle('hidden', which !== 'play');
    viewResult.classList.toggle('hidden', which !== 'result');
  }

  function pulseFlash(kind){
    if(!flash) return;
    flash.className = '';
    flash.classList.add('rb-flash');
    if(kind) flash.classList.add('rb-flash-'+kind);
    void flash.offsetWidth; // reflow
    flash.classList.add('on');
    setTimeout(()=>{ try{ flash.classList.remove('on'); }catch(_){ } }, 140);
  }

  function setMode(m){
    selectedMode = (m === 'research') ? 'research' : 'normal';

    if(selectedMode === 'research'){
      modeDesc.textContent = 'Research: เก็บข้อมูล (ต้องกรอก Participant / กลุ่ม) · AI แสดง prediction ได้ แต่ไม่ปรับเกม';
      researchFields.classList.remove('hidden');
      trackModeLabel.textContent = 'โหมด Research — 1 เพลงมาตรฐานสำหรับทดลอง (120 BPM)';
    }else{
      modeDesc.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      researchFields.classList.add('hidden');
      trackModeLabel.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // hide/show track options by data-mode
    DOC.querySelectorAll('#rb-track-options .rb-mode-btn').forEach(lbl=>{
      const dm = (lbl.getAttribute('data-mode')||'').toLowerCase();
      const show = (selectedMode === 'research') ? (dm === 'research') : (dm === 'normal');
      lbl.classList.toggle('hidden', !show);
    });

    // ensure selected track exists for mode
    if(selectedMode === 'research' && !TRACKS[selectedTrackId]?.research){
      selectedTrackId = 'r1';
      const r = DOC.querySelector('input[name="rb-track"][value="r1"]');
      if(r) r.checked = true;
    }
    if(selectedMode === 'normal' && TRACKS[selectedTrackId]?.research){
      selectedTrackId = 'n1';
      const r = DOC.querySelector('input[name="rb-track"][value="n1"]');
      if(r) r.checked = true;
    }
  }

  function getSelectedTrack(){
    return TRACKS[selectedTrackId] || TRACKS.n1;
  }

  function setDiffOnWrap(diff){
    const d = (diff||'normal').toLowerCase();
    if(wrap) wrap.setAttribute('data-diff', d);
  }

  function bindMenuControls(){
    DOC.querySelectorAll('input[name="rb-mode"]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        if(inp.checked){
          setMode(inp.value);
        }
      });
    });

    DOC.querySelectorAll('input[name="rb-track"]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        if(inp.checked){
          selectedTrackId = inp.value;
          const t = getSelectedTrack();
          setDiffOnWrap(t.diff);
        }
      });
    });

    btnStart.addEventListener('click', ()=>{
      startGame();
    });
  }

  // tap / click lane mapping
  function laneFromEvent(ev){
    const laneEl = ev.target.closest('.rb-lane');
    if(!laneEl) return null;
    const idx = Number(laneEl.getAttribute('data-lane'));
    return Number.isFinite(idx) ? idx : null;
  }

  function bindPlayInput(){
    const onDown = (ev)=>{
      const lane = laneFromEvent(ev);
      if(lane == null) return;
      ev.preventDefault();

      if(engine && typeof engine.tapLane === 'function'){
        engine.tapLane(lane, { source: (ev.pointerType||'mouse') });
      }else if(engine && typeof engine.onTapLane === 'function'){
        engine.onTapLane(lane, { source: (ev.pointerType||'mouse') });
      }
    };

    lanesWrap.addEventListener('pointerdown', onDown, { passive:false });
  }

  function setFeedback(text, kind){
    if(!feedback) return;
    feedback.textContent = text || '';
    feedback.setAttribute('data-kind', kind || '');
  }

  function hookEngineEvents(){
    if(!engine || !engine.on) return;

    engine.on('tick', (s)=>{
      // core stats
      hudScore.textContent = String(s.score|0);
      hudCombo.textContent = String(s.combo|0);
      hudAcc.textContent = (Number(s.accPct)||0).toFixed(1) + '%';

      hudHP.textContent = String(s.hp|0);
      hudShield.textContent = String(s.shield|0);
      hudTime.textContent = (Number(s.timeSec)||0).toFixed(1);

      hudPerfect.textContent = String(s.hitPerfect|0);
      hudGreat.textContent   = String(s.hitGreat|0);
      hudGood.textContent    = String(s.hitGood|0);
      hudMiss.textContent    = String(s.hitMiss|0);

      // FEVER
      if(feverFill){
        const f = Math.max(0, Math.min(1, Number(s.fever)||0));
        feverFill.style.width = (f*100).toFixed(0) + '%';
      }
      if(feverStatus) feverStatus.textContent = String(s.feverStatus || '');

      // PROGRESS
      if(progFill){
        const p = Math.max(0, Math.min(1, Number(s.progress)||0));
        progFill.style.width = (p*100).toFixed(0) + '%';
      }
      if(progText) progText.textContent = ((Number(s.progress)||0)*100).toFixed(0) + '%';

      // AI panel (prediction always; assist may be locked)
      if(s.ai){
        hudAiFatigue.textContent = Math.round((s.ai.fatigueRisk||0)*100) + '%';
        hudAiSkill.textContent   = Math.round((s.ai.skillScore||0)*100) + '%';
        hudAiSuggest.textContent = String(s.ai.suggestedDifficulty || 'normal');
        const tip = String(s.ai.tip||'').trim();
        if(tip){
          hudAiTip.classList.remove('hidden');
          hudAiTip.textContent = tip;
        }else{
          hudAiTip.classList.add('hidden');
          hudAiTip.textContent = '';
        }
      }
    });

    engine.on('judge', (j)=>{
      // { lane, judge, offsetMs }
      if(!j) return;
      const judge = String(j.judge||'').toLowerCase();
      if(judge === 'perfect') { setFeedback('PERFECT!', 'perfect'); pulseFlash('perfect'); }
      else if(judge === 'great') { setFeedback('GREAT!', 'great'); pulseFlash('great'); }
      else if(judge === 'good') { setFeedback('GOOD', 'good'); pulseFlash('good'); }
      else { setFeedback('MISS', 'miss'); pulseFlash('miss'); }
    });

    engine.on('end', (r)=>{
      // result payload
      lastCsvEvents = r.csvEvents || '';
      lastCsvSessions = r.csvSessions || '';
      showResult(r);
    });
  }

  function ensureEngine(track, mode){
    if(engine && typeof engine.stop === 'function'){
      try{ engine.stop('restart'); }catch(_){}
    }

    // engine from global
    if(!WIN.RhythmBoxerEngine){
      throw new Error('RhythmBoxerEngine not loaded');
    }

    engine = new WIN.RhythmBoxerEngine({
      audioEl,
      track,
      mode,
      participant: (inpParticipant?.value||'').trim(),
      group: (inpGroup?.value||'').trim(),
      note: (inpNote?.value||'').trim(),
      // any other settings here
    });

    // connect renderer if available
    if(WIN.RB_DomRenderer && typeof engine.setRenderer === 'function'){
      try{ engine.setRenderer(new WIN.RB_DomRenderer({ lanesWrap })); }catch(_){}
    }

    hookEngineEvents();
  }

  function startGame(){
    const track = getSelectedTrack();
    const mode = selectedMode;

    // required fields in research
    if(mode === 'research'){
      const pid = (inpParticipant?.value||'').trim();
      if(!pid){
        alert('กรุณากรอก Participant ID สำหรับ Research');
        return;
      }
    }

    setDiffOnWrap(track.diff);

    // update URL mode flag (so AI predictor reads mode consistently)
    try{
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      history.replaceState(null, '', url.toString());
    }catch(_){}

    // update hud labels
    hudMode.textContent = (mode === 'research') ? 'Research' : 'Normal';
    hudTrack.textContent = track.title;

    showView('play');
    setFeedback('พร้อม!', '');

    ensureEngine(track, mode);

    // start engine
    if(engine && typeof engine.start === 'function'){
      engine.start();
    }

    btnStop.onclick = ()=>{
      if(engine && typeof engine.stop === 'function'){
        engine.stop('manual');
      }
    };
  }

  function showResult(r){
    showView('result');

    resMode.textContent = (r.mode === 'research') ? 'Research' : 'Normal';
    resTrack.textContent = r.trackTitle || '-';
    resEndReason.textContent = r.endReason || '-';

    resScore.textContent = String(r.score|0);
    resMaxCombo.textContent = String(r.maxCombo|0);
    resDetailHit.textContent = `${r.hitPerfect|0} / ${r.hitGreat|0} / ${r.hitGood|0} / ${r.hitMiss|0}`;
    resAcc.textContent = (Number(r.accPct)||0).toFixed(1) + ' %';
    resDuration.textContent = (Number(r.durationSec)||0).toFixed(1) + ' s';
    resRank.textContent = r.rank || '-';

    resOffsetAvg.textContent = (r.offsetMeanMs != null) ? (Number(r.offsetMeanMs).toFixed(1)+' ms') : '-';
    resOffsetStd.textContent = (r.offsetStdMs != null) ? (Number(r.offsetStdMs).toFixed(1)+' ms') : '-';
    resParticipant.textContent = r.participant || '-';

    // quality note
    const q = (r.qualityNote||'').trim();
    if(q){
      resQualityNote.classList.remove('hidden');
      resQualityNote.textContent = q;
    }else{
      resQualityNote.classList.add('hidden');
      resQualityNote.textContent = '';
    }

    btnAgain.onclick = ()=>{
      // play same track again
      showView('play');
      setFeedback('พร้อม!', '');
      ensureEngine(getSelectedTrack(), selectedMode);
      if(engine && typeof engine.start === 'function') engine.start();
    };

    btnBackMenu.onclick = ()=>{
      showView('menu');
    };

    btnDlEvents.onclick = ()=>{
      if(!lastCsvEvents){ alert('ยังไม่มี Event CSV'); return; }
      downloadText(lastCsvEvents, 'rhythm_events.csv');
    };
    btnDlSessions.onclick = ()=>{
      if(!lastCsvSessions){ alert('ยังไม่มี Session CSV'); return; }
      downloadText(lastCsvSessions, 'rhythm_sessions.csv');
    };
  }

  function downloadText(text, filename){
    try{
      const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){}; try{ a.remove(); }catch(_){}; }, 0);
    }catch(e){
      console.error(e);
      alert('ดาวน์โหลดไม่ได้: ' + (e && e.message ? e.message : e));
    }
  }

  // boot
  (function boot(){
    // init mode from URL if any
    const urlMode = (qs('mode','')||'').toLowerCase();
    if(urlMode === 'research'){
      const r = DOC.querySelector('input[name="rb-mode"][value="research"]');
      if(r) r.checked = true;
      setMode('research');
    }else{
      setMode('normal');
    }

    // init track
    const urlTrack = (qs('track','')||'').toLowerCase();
    if(TRACKS[urlTrack]){
      selectedTrackId = urlTrack;
      const ti = DOC.querySelector(`input[name="rb-track"][value="${urlTrack}"]`);
      if(ti) ti.checked = true;
    }
    setDiffOnWrap(getSelectedTrack().diff);

    bindMenuControls();
    bindPlayInput();

    // if direct start (optional)
    if(qs('autostart','0') === '1'){
      startGame();
    }
  })();

})();