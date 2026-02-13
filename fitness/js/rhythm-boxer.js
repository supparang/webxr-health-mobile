// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer UI Controller — PRODUCTION (Calibration B + AutoCal C + Debug D)
// ✅ Cal +/-/Reset + persist localStorage
// ✅ Auto-Cal 10s
// ✅ DEBUG overlay (?debug=1) shows dt + closest notes

'use strict';

(function(){
  const DOC = document;

  const LS_KEY = 'RB_CAL_MS_V1';

  function qs(sel){ return DOC.querySelector(sel); }
  function qsa(sel){ return Array.from(DOC.querySelectorAll(sel)); }

  function show(el){ if(el) el.classList.remove('hidden'); }
  function hide(el){ if(el) el.classList.add('hidden'); }

  function readFlag(key){
    try{
      const v = new URL(location.href).searchParams.get(key);
      return v==='1' || v==='true' || v==='yes';
    }catch(_){ return false; }
  }

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

  // Calibration UI
  const calVal = qs('#rb-hud-cal');
  const btnCalMinus = qs('#rb-cal-minus');
  const btnCalPlus  = qs('#rb-cal-plus');
  const btnCalReset = qs('#rb-cal-reset');

  // Auto-Cal UI
  const btnCalAuto = qs('#rb-cal-auto');
  const calSuggest = qs('#rb-cal-suggest');
  const calAutoStatus = qs('#rb-cal-status');

  // Debug
  const DEBUG = readFlag('debug');
  let dbgEl = null;

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
    if(typeof engine.setCalibrationMs === 'function') engine.setCalibrationMs(ms);
    if(calVal) calVal.textContent = `${loadCalMs()}ms`;
    if(calSuggest) calSuggest.textContent = '';
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

    qsa('#rb-track-options .rb-mode-btn').forEach(lbl=>{
      const m = lbl.getAttribute('data-mode');
      if(!m) return;
      if(m === mode) lbl.classList.remove('hidden');
      else lbl.classList.add('hidden');
    });

    const currentTrack = getSelectedRadio('rb-track') || 'n1';
    const ok = !!DOC.querySelector(`#rb-track-options .rb-mode-btn[data-mode="${mode}"] input[value="${currentTrack}"]`);
    if(!ok){
      const first = DOC.querySelector(`#rb-track-options .rb-mode-btn[data-mode="${mode}"] input[name="rb-track"]`);
      if(first) first.checked = true;
    }
  }

  function bindModeRadios(){
    qsa('input[name="rb-mode"]').forEach(r=> r.addEventListener('change', updateModeUI));
  }

  function ensureDebugOverlay(){
    if(!DEBUG) return;
    if(dbgEl) return;
    dbgEl = DOC.createElement('div');
    dbgEl.id = 'rb-debug';
    dbgEl.innerHTML = `
      <div class="rb-debug-title">DEBUG</div>
      <div class="rb-debug-body" id="rb-debug-body">waiting…</div>
      <div class="rb-debug-tip">เปิดด้วย ?debug=1 · ดู dt ใกล้ 0 แล้วต้องตีติด</div>
    `;
    DOC.body.appendChild(dbgEl);
  }

  function initEngine(){
    ensureDebugOverlay();

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
        onTick(payload){
          if(!DEBUG || !dbgEl) return;
          const body = qs('#rb-debug-body');
          if(!body) return;

          const live = (payload.live || []).slice().sort((a,b)=>a.abs-b.abs).slice(0,3);
          const lines = [];

          lines.push(`t=${payload.songTime.toFixed(3)}s · Cal=${payload.calMs}ms · lanes=${payload.laneCount}`);
          lines.push(`hitlineY(var)=${payload.hitlineY}px · live=${(payload.live||[]).length}`);

          if(live.length){
            lines.push('closest notes:');
            for(const n of live){
              lines.push(`- lane ${n.lane} dt=${(n.dt*1000).toFixed(0)}ms abs=${(n.abs*1000).toFixed(0)}ms rectTop=${n.top.toFixed(0)} rectBot=${n.bottom.toFixed(0)}`);
            }
          }else{
            lines.push('(no live notes yet)');
          }

          body.textContent = lines.join('\n');
        },
        onEnd(summary){
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
    applyCalToEngine();
    engine.start(mode, trackId, meta);

    if(calAutoStatus) calAutoStatus.textContent = '';
  }

  function stopGame(){
    if(engine) engine.stop('manual-stop');
  }

  // ===== Auto-Cal (same asก่อนหน้า) =====
  let _autoCalRunning = false;
  let _autoCalCancel = null;

  function _beepOnce(audioCtx, whenSec, freq, durSec, gainVal){
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gainVal;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(whenSec);
    o.stop(whenSec + durSec);
  }

  function _median(arr){
    if(!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
  }

  function startAutoCal(){
    if(_autoCalRunning) return;
    if(!engine || !engine.running){
      if(calAutoStatus) calAutoStatus.textContent = 'ต้องเริ่มเกมก่อน ถึงจะ Auto-Cal ได้';
      return;
    }

    _autoCalRunning = true;
    if(btnCalAuto) btnCalAuto.disabled = true;
    if(calAutoStatus) calAutoStatus.textContent = 'Auto-Cal: ฟัง “ติ๊ก” แล้วแตะตาม 10 วินาที…';
    if(calSuggest) calSuggest.textContent = '';

    if(btnCalMinus) btnCalMinus.disabled = true;
    if(btnCalPlus) btnCalPlus.disabled = true;
    if(btnCalReset) btnCalReset.disabled = true;

    const bpm = (engine.track && engine.track.bpm) ? engine.track.bpm : 120;
    const beatSec = 60 / bpm;

    const totalSec = 10.0;
    const warmBeats = 2;

    const AC = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AC();

    const startPerf = performance.now()/1000;
    const startAudio = audioCtx.currentTime + 0.15;

    const offsetsMs = [];

    const onTap = ()=>{
      if(!_autoCalRunning) return;
      const tPerf = performance.now()/1000;

      const k = Math.round((tPerf - (startPerf + 0.15)) / beatSec);
      const beatAt = (startPerf + 0.15) + k * beatSec;

      if(k < warmBeats) return;

      const offSec = tPerf - beatAt;
      const offMs = offSec * 1000;

      if(Math.abs(offMs) <= 250) offsetsMs.push(offMs);
    };

    lanesEl.addEventListener('pointerdown', onTap, {passive:true});

    const tickCount = Math.ceil(totalSec / beatSec) + 1;
    for(let i=0;i<tickCount;i++){
      const when = startAudio + i * beatSec;
      const freq = (i===0) ? 880 : 660;
      _beepOnce(audioCtx, when, freq, 0.04, 0.08);
    }

    const finishAtPerf = (startPerf + 0.15) + totalSec;

    const raf = ()=>{
      if(!_autoCalRunning) return;
      const t = performance.now()/1000;
      const left = Math.max(0, finishAtPerf - t);
      if(calAutoStatus){
        calAutoStatus.textContent = left>0.1
          ? `Auto-Cal: แตะตาม “ติ๊ก” … เหลือ ${left.toFixed(1)}s`
          : 'Auto-Cal: กำลังคำนวณ…';
      }
      if(t >= finishAtPerf){
        stopAutoCal(true, audioCtx, offsetsMs);
        return;
      }
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    _autoCalCancel = ()=>stopAutoCal(false, audioCtx, offsetsMs);

    function cleanup(){
      lanesEl.removeEventListener('pointerdown', onTap);
      try{ audioCtx.close(); }catch(_){}
    }

    function stopAutoCal(isDone, ctx, arr){
      if(!_autoCalRunning) return;
      _autoCalRunning = false;

      cleanup();

      if(btnCalAuto) btnCalAuto.disabled = false;
      if(btnCalMinus) btnCalMinus.disabled = false;
      if(btnCalPlus) btnCalPlus.disabled = false;
      if(btnCalReset) btnCalReset.disabled = false;

      if(!isDone){
        if(calAutoStatus) calAutoStatus.textContent = 'Auto-Cal: ยกเลิกแล้ว';
        return;
      }

      let rec = 0;
      if(arr.length >= 6){
        const med = _median(arr);
        rec = Math.round(med * 0.85);
      }else{
        rec = 0;
      }

      rec = Math.max(-200, Math.min(200, rec));
      saveCalMs(rec);
      applyCalToEngine();

      if(calSuggest) calSuggest.textContent = `แนะนำ: ${rec}ms (sample ${arr.length})`;
      if(calAutoStatus){
        calAutoStatus.textContent = (arr.length >= 6)
          ? 'Auto-Cal: เสร็จแล้ว ✅ กดเล่นต่อได้เลย'
          : 'Auto-Cal: sample น้อยไป (ลองใหม่แล้วแตะให้ทันทุก “ติ๊ก”)';
      }
    }
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
      if(calAutoStatus) calAutoStatus.textContent = '';
    });

    if(btnBackMenu) btnBackMenu.addEventListener('click', ()=> setView('menu'));

    if(btnDlEvents) btnDlEvents.addEventListener('click', ()=>{
      const csv = engine ? engine.getEventsCsv() : '';
      downloadText(`rhythm_events_${Date.now()}.csv`, csv);
    });
    if(btnDlSessions) btnDlSessions.addEventListener('click', ()=>{
      const csv = engine ? engine.getSessionCsv() : '';
      downloadText(`rhythm_sessions_${Date.now()}.csv`, csv);
    });

    if(btnCalMinus) btnCalMinus.addEventListener('click', ()=>{
      saveCalMs(loadCalMs() - 10);
      applyCalToEngine();
    });
    if(btnCalPlus) btnCalPlus.addEventListener('click', ()=>{
      saveCalMs(loadCalMs() + 10);
      applyCalToEngine();
    });
    if(btnCalReset) btnCalReset.addEventListener('click', ()=>{
      saveCalMs(0);
      applyCalToEngine();
    });

    if(btnCalAuto) btnCalAuto.addEventListener('click', startAutoCal);
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