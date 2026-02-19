// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer Page Controller — FULL
// ✅ Menu <-> Play <-> Result
// ✅ Start/Stop wiring to RhythmBoxerEngine
// ✅ Research fields gated by mode
// ✅ Download Event CSV + Session CSV
// ✅ HUD binding
'use strict';

(function(){
  const $ = (sel)=>document.querySelector(sel);
  const $$ = (sel)=>Array.from(document.querySelectorAll(sel));
  const qs = (k, d='')=>{
    try{ const v=new URL(location.href).searchParams.get(k); return (v==null?d:v); }catch(_){ return d; }
  };

  // Views
  const viewMenu   = $('#rb-view-menu');
  const viewPlay   = $('#rb-view-play');
  const viewResult = $('#rb-view-result');

  // Menu controls
  const modeDesc = $('#rb-mode-desc');
  const researchFields = $('#rb-research-fields');
  const trackModeLabel = $('#rb-track-mode-label');
  const btnStart = $('#rb-btn-start');

  // Inputs (research)
  const inpPid = $('#rb-participant');
  const inpGroup = $('#rb-group');
  const inpNote = $('#rb-note');

  // Play controls
  const btnStop = $('#rb-btn-stop');

  // Audio
  const audioEl = $('#rb-audio');

  // HUD elements
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

    // AI HUD
    aiFatigue: $('#rb-hud-ai-fatigue'),
    aiSkill: $('#rb-hud-ai-skill'),
    aiSuggest: $('#rb-hud-ai-suggest'),
    aiTip: $('#rb-hud-ai-tip')
  };

  // Result elements
  const res = {
    mode: $('#rb-res-mode'),
    track: $('#rb-res-track'),
    endReason: $('#rb-res-endreason'),
    score: $('#rb-res-score'),
    maxCombo: $('#rb-res-maxcombo'),
    hitDetail: $('#rb-res-detail-hit'),
    acc: $('#rb-res-acc'),
    dur: $('#rb-res-duration'),
    rank: $('#rb-res-rank'),

    offAvg: $('#rb-res-offset-avg'),
    offStd: $('#rb-res-offset-std'),
    pid: $('#rb-res-participant'),

    quality: $('#rb-res-quality-note')
  };

  const btnAgain = $('#rb-btn-again');
  const btnBackMenu = $('#rb-btn-back-menu');
  const btnDlEvents = $('#rb-btn-dl-events');
  const btnDlSessions = $('#rb-btn-dl-sessions');

  // Field / lanes
  const lanesEl = $('#rb-lanes');

  // Engine
  let engine = null;
  let lastRun = { mode:'normal', trackId:'n1', meta:{} };

  function show(view){
    [viewMenu, viewPlay, viewResult].forEach(v=>v && v.classList.add('hidden'));
    view && view.classList.remove('hidden');
  }

  function getSelectedMode(){
    const el = document.querySelector('input[name="rb-mode"]:checked');
    return (el && el.value === 'research') ? 'research' : 'normal';
  }

  function getSelectedTrack(){
    const el = document.querySelector('input[name="rb-track"]:checked');
    return (el && el.value) ? el.value : 'n1';
  }

  function updateModeUI(){
    const mode = getSelectedMode();

    // toggle research fields
    if(mode === 'research'){
      researchFields && researchFields.classList.remove('hidden');
      modeDesc && (modeDesc.textContent = 'Research: แสดง AI prediction ได้ แต่ล็อก 100% (ไม่ให้ AI ปรับเกมแม้แต่นิดเดียว) + เก็บ CSV');
      trackModeLabel && (trackModeLabel.textContent = 'โหมด Research — ใช้ Research Track เพื่อความเที่ยงตรง');
    }else{
      researchFields && researchFields.classList.add('hidden');
      modeDesc && (modeDesc.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)');
      trackModeLabel && (trackModeLabel.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก');
    }

    // show/hide track radios by data-mode
    $$('#rb-track-options .rb-mode-btn').forEach(lbl=>{
      const m = (lbl.getAttribute('data-mode')||'normal').toLowerCase();
      if(m === mode) lbl.classList.remove('hidden');
      else lbl.classList.add('hidden');
    });

    // ensure selected track exists for mode
    const cur = getSelectedTrack();
    const curLbl = document.querySelector(`#rb-track-options .rb-mode-btn[data-mode="${mode}"] input[value="${cur}"]`);
    if(!curLbl){
      const first = document.querySelector(`#rb-track-options .rb-mode-btn[data-mode="${mode}"] input[name="rb-track"]`);
      if(first) first.checked = true;
    }
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
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }

  function readMeta(mode){
    if(mode !== 'research'){
      return { id:'', group:'', note:'' };
    }
    return {
      id: (inpPid && inpPid.value || '').trim(),
      group: (inpGroup && inpGroup.value || '').trim(),
      note: (inpNote && inpNote.value || '').trim()
    };
  }

  function bindEngine(){
    engine = new window.RhythmBoxerEngine({
      lanesEl,
      audio: audioEl,
      hud: {
        score: hud.score,
        combo: hud.combo,
        acc: hud.acc,
        hp: hud.hp,
        shield: hud.shield,
        time: hud.time,
        countPerfect: hud.countPerfect,
        countGreat: hud.countGreat,
        countGood: hud.countGood,
        countMiss: hud.countMiss,
        feverFill: hud.feverFill,
        feverStatus: hud.feverStatus,
        progFill: hud.progFill,
        progText: hud.progText,

        aiFatigue: hud.aiFatigue,
        aiSkill: hud.aiSkill,
        aiSuggest: hud.aiSuggest,
        aiTip: hud.aiTip
      },
      hooks: {
        onStart(info){
          // HUD header
          if(hud.mode) hud.mode.textContent = (info.mode === 'research') ? 'Research' : 'Normal';
          if(hud.track) hud.track.textContent = info.track ? info.track.name : '-';
        },
        onEnd(summary){
          // switch view to result
          fillResult(summary);
          show(viewResult);
        }
      }
    });
  }

  function fillResult(summary){
    const modeLabel = summary.modeLabel || '-';
    const trackName = summary.trackName || '-';

    res.mode && (res.mode.textContent = modeLabel);
    res.track && (res.track.textContent = trackName);
    res.endReason && (res.endReason.textContent = summary.endReason || '-');

    res.score && (res.score.textContent = String(summary.finalScore || 0));
    res.maxCombo && (res.maxCombo.textContent = String(summary.maxCombo || 0));

    const hp = [summary.hitPerfect||0, summary.hitGreat||0, summary.hitGood||0, summary.hitMiss||0];
    res.hitDetail && (res.hitDetail.textContent = `${hp[0]} / ${hp[1]} / ${hp[2]} / ${hp[3]}`);

    res.acc && (res.acc.textContent = (Number(summary.accuracyPct)||0).toFixed(1) + ' %');
    res.dur && (res.dur.textContent = (Number(summary.durationSec)||0).toFixed(1) + ' s');
    res.rank && (res.rank.textContent = summary.rank || '-');

    res.offAvg && (res.offAvg.textContent = (Number(summary.offsetMean)||0).toFixed(4) + ' s');
    res.offStd && (res.offStd.textContent = (Number(summary.offsetStd)||0).toFixed(4) + ' s');
    res.pid && (res.pid.textContent = summary.participant || '-');

    if(res.quality){
      const q = summary.qualityNote || '';
      res.quality.textContent = q;
      res.quality.classList.toggle('hidden', !q);
    }
  }

  function startGame(){
    if(!engine) bindEngine();

    const mode = getSelectedMode();
    const trackId = getSelectedTrack();
    const meta = readMeta(mode);

    // Basic research check (soft)
    if(mode === 'research' && !meta.id){
      // ไม่ block แต่เตือนนุ่ม ๆ
      try{ alert('Research แนะนำให้ใส่ Participant ID เพื่อกันข้อมูลหลุด/ซ้ำ'); }catch(_){}
    }

    lastRun = { mode, trackId, meta };

    // show play
    show(viewPlay);

    // start
    engine.start(mode, trackId, meta);
  }

  function stopGame(){
    if(engine) engine.stop('manual-stop');
  }

  function playAgain(){
    if(!engine) return;
    show(viewPlay);
    engine.start(lastRun.mode, lastRun.trackId, lastRun.meta);
  }

  function backToMenu(){
    show(viewMenu);
  }

  function downloadEvents(){
    if(!engine) return;
    const csv = engine.getEventsCsv();
    const name = `rhythmboxer-events-${Date.now()}.csv`;
    downloadText(name, csv);
  }

  function downloadSessions(){
    if(!engine) return;
    const csv = engine.getSessionCsv();
    const name = `rhythmboxer-sessions-${Date.now()}.csv`;
    downloadText(name, csv);
  }

  // ---- wire UI ----
  function init(){
    // apply initial mode UI
    updateModeUI();

    // mode radio changes
    $$('input[name="rb-mode"]').forEach(r=>{
      r.addEventListener('change', updateModeUI);
    });

    // start/stop
    btnStart && btnStart.addEventListener('click', startGame);
    btnStop && btnStop.addEventListener('click', stopGame);

    // result buttons
    btnAgain && btnAgain.addEventListener('click', playAgain);
    btnBackMenu && btnBackMenu.addEventListener('click', backToMenu);

    btnDlEvents && btnDlEvents.addEventListener('click', downloadEvents);
    btnDlSessions && btnDlSessions.addEventListener('click', downloadSessions);

    // Optional: autoselect by URL query
    // ?mode=research
    const modeQ = String(qs('mode','')).toLowerCase();
    if(modeQ === 'research'){
      const r = document.querySelector('input[name="rb-mode"][value="research"]');
      if(r) r.checked = true;
      updateModeUI();
    }

    // ?track=n2 etc.
    const tr = String(qs('track','')).toLowerCase();
    if(tr){
      const t = document.querySelector(`input[name="rb-track"][value="${tr}"]`);
      if(t){
        t.checked = true;
      }
    }

    // start view
    show(viewMenu);
  }

  init();
})();