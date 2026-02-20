// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer Page Controller — PRODUCTION (Menu/Play/Result) + CSV Download
// Works with:
//  - /fitness/js/ai-predictor.js  (Classic script -> window.RB_AI)
//  - /fitness/js/dom-renderer-rhythm.js (window.RhythmDomRenderer)
//  - /fitness/js/rhythm-engine.js (window.RhythmBoxerEngine)

'use strict';

(function(){
  const DOC = document;
  const WIN = window;

  const $ = (sel, root=DOC)=>root.querySelector(sel);
  const $$ = (sel, root=DOC)=>Array.from(root.querySelectorAll(sel));

  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
  function qs(key, fallback=''){
    try{
      const v = new URL(location.href).searchParams.get(key);
      return (v==null || v==='') ? fallback : v;
    }catch(_){
      return fallback;
    }
  }

  function setView(name){
    const views = ['menu','play','result'];
    for(const v of views){
      const el = $(`#rb-view-${v}`);
      if(!el) continue;
      el.classList.toggle('hidden', v !== name);
    }
  }

  function setModeUi(mode){
    const desc = $('#rb-mode-desc');
    const fields = $('#rb-research-fields');
    const label = $('#rb-track-mode-label');

    if(mode === 'research'){
      if(desc) desc.textContent = 'Research: ล็อกเกม 100% (แสดง AI prediction ได้ แต่ห้ามปรับความยาก) + เก็บ Event/Session CSV';
      if(fields) fields.classList.remove('hidden');
      if(label) label.textContent = 'โหมด Research — ใช้เพลง Research Track (ซ้ำได้เหมือนเดิมทุกครั้ง)';
    }else{
      if(desc) desc.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
      if(fields) fields.classList.add('hidden');
      if(label) label.textContent = 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // show/hide track options by data-mode
    $$('#rb-track-options .rb-mode-btn').forEach(lbl=>{
      const m = (lbl.getAttribute('data-mode')||'normal').toLowerCase();
      lbl.style.display = (m === mode) ? '' : 'none';
    });

    // ensure a track selected for that mode
    const trackRadio = $$('input[name="rb-track"]')
      .find(r => r.checked && (r.closest('.rb-mode-btn')?.getAttribute('data-mode')||'normal') === mode);

    if(!trackRadio){
      // pick default per mode
      const def = (mode==='research') ? 'r1' : 'n1';
      const r = $(`input[name="rb-track"][value="${def}"]`);
      if(r) r.checked = true;
    }
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  function prettyTrackName(trackId){
    const map = {
      n1:'Warm-up Groove',
      n2:'Focus Combo',
      n3:'Speed Rush',
      r1:'Research Track 120'
    };
    return map[trackId] || trackId;
  }

  function readModeFromUi(){
    const m = $$('input[name="rb-mode"]').find(x=>x.checked)?.value || 'normal';
    return (m === 'research') ? 'research' : 'normal';
  }

  function readTrackFromUi(){
    return $$('input[name="rb-track"]').find(x=>x.checked)?.value || 'n1';
  }

  function readResearchMeta(){
    return {
      participant_id: ($('#rb-participant')?.value || '').trim(),
      id: ($('#rb-participant')?.value || '').trim(), // alias
      group: ($('#rb-group')?.value || '').trim(),
      note: ($('#rb-note')?.value || '').trim()
    };
  }

  // ===== boot =====
  const wrap = $('#rb-wrap');
  const lanesEl = $('#rb-lanes');
  const field = $('#rb-field');
  const audio = $('#rb-audio');
  const feedbackEl = $('#rb-feedback');

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
    progText: $('#rb-progress-text'),
  };

  // Result elements
  const res = {
    mode: $('#rb-res-mode'),
    track: $('#rb-res-track'),
    endReason: $('#rb-res-endreason'),
    score: $('#rb-res-score'),
    maxCombo: $('#rb-res-maxcombo'),
    detailHit: $('#rb-res-detail-hit'),
    acc: $('#rb-res-acc'),
    duration: $('#rb-res-duration'),
    rank: $('#rb-res-rank'),
    offAvg: $('#rb-res-offset-avg'),
    offStd: $('#rb-res-offset-std'),
    participant: $('#rb-res-participant'),
    qualityNote: $('#rb-res-quality-note'),
  };

  // Renderer (FX + note decorations) optional
  const renderer = (WIN.RhythmDomRenderer)
    ? new WIN.RhythmDomRenderer({ lanesEl, fieldEl: field, feedbackEl })
    : null;

  // Engine
  const engine = new WIN.RhythmBoxerEngine({
    wrap,
    field,
    lanesEl,
    audio,
    renderer,
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
      aiTip: hud.aiTip,
    },
    hooks: {
      onStart(info){
        // HUD top labels
        if(hud.mode) hud.mode.textContent = (info.mode === 'research') ? 'Research' : 'Normal';
        if(hud.track) hud.track.textContent = info.track?.name || prettyTrackName(info.track?.id || '');
      },
      onEnd(summary){
        // fill result UI
        if(res.mode) res.mode.textContent = summary.modeLabel || '-';
        if(res.track) res.track.textContent = summary.trackName || '-';
        if(res.endReason) res.endReason.textContent = summary.endReason || '-';
        if(res.score) res.score.textContent = String(summary.finalScore ?? 0);
        if(res.maxCombo) res.maxCombo.textContent = String(summary.maxCombo ?? 0);

        if(res.detailHit){
          res.detailHit.textContent =
            `${summary.hitPerfect ?? 0} / ${summary.hitGreat ?? 0} / ${summary.hitGood ?? 0} / ${summary.hitMiss ?? 0}`;
        }

        if(res.acc) res.acc.textContent = (Number(summary.accuracyPct||0)).toFixed(1) + ' %';
        if(res.duration) res.duration.textContent = (Number(summary.durationSec||0)).toFixed(1) + ' s';
        if(res.rank) res.rank.textContent = summary.rank || '-';

        if(res.offAvg) res.offAvg.textContent = (Number(summary.offsetMean||0)).toFixed(4) + ' s';
        if(res.offStd) res.offStd.textContent = (Number(summary.offsetStd||0)).toFixed(4) + ' s';

        if(res.participant) res.participant.textContent = summary.participant || '-';

        if(res.qualityNote){
          const txt = summary.qualityNote || '';
          res.qualityNote.textContent = txt;
          res.qualityNote.classList.toggle('hidden', !txt);
        }

        // go result view
        setView('result');
      }
    }
  });

  // ===== UI binds =====
  const btnStart = $('#rb-btn-start');
  const btnStop  = $('#rb-btn-stop');
  const btnAgain = $('#rb-btn-again');
  const btnBackMenu = $('#rb-btn-back-menu');
  const btnDlEvents = $('#rb-btn-dl-events');
  const btnDlSessions = $('#rb-btn-dl-sessions');

  // mode toggle
  $$('input[name="rb-mode"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      const mode = readModeFromUi();
      setModeUi(mode);
    });
  });

  // stop
  if(btnStop){
    btnStop.addEventListener('click', ()=>{
      engine.stop('manual-stop');
    });
  }

  // start
  if(btnStart){
    btnStart.addEventListener('click', ()=>{
      const mode = readModeFromUi();
      const trackId = readTrackFromUi();

      // apply URL param mode for RB_AI (optional)
      try{
        const u = new URL(location.href);
        u.searchParams.set('mode', mode);
        // keep ?ai=1 if user already set
        history.replaceState({}, '', u.toString());
      }catch(_){}

      // meta
      const meta = (mode === 'research') ? readResearchMeta() : {};
      // small guard: research needs participant id (optional but recommended)
      // (no hard stop — still allow)

      // HUD labels
      if(hud.mode) hud.mode.textContent = (mode === 'research') ? 'Research' : 'Normal';
      if(hud.track) hud.track.textContent = prettyTrackName(trackId);

      // show play view first (so audio play is user gesture-friendly)
      setView('play');

      // start engine
      engine.start(mode, trackId, meta);

      // feedback
      if(renderer && typeof renderer.setFeedback === 'function'){
        renderer.setFeedback('เริ่มเลย!', 'ready');
      }
    });
  }

  // play same track again
  if(btnAgain){
    btnAgain.addEventListener('click', ()=>{
      // restart with same settings that were used last
      const mode = engine.mode || readModeFromUi();
      const trackId = engine.track?.id || readTrackFromUi();
      const meta = (mode === 'research') ? readResearchMeta() : {};
      setView('play');
      engine.start(mode, trackId, meta);
      if(renderer && typeof renderer.setFeedback === 'function'){
        renderer.setFeedback('เริ่มใหม่!', 'ready');
      }
    });
  }

  // back to menu
  if(btnBackMenu){
    btnBackMenu.addEventListener('click', ()=>{
      setView('menu');
    });
  }

  // download CSV
  if(btnDlEvents){
    btnDlEvents.addEventListener('click', ()=>{
      const csv = engine.getEventsCsv();
      const sid = engine.sessionId || 'session';
      downloadText(`rhythm-events-${sid}.csv`, csv);
    });
  }
  if(btnDlSessions){
    btnDlSessions.addEventListener('click', ()=>{
      const csv = engine.getSessionCsv();
      const sid = engine.sessionId || 'session';
      downloadText(`rhythm-sessions-${sid}.csv`, csv);
    });
  }

  // ===== initial state =====
  setView('menu');
  setModeUi(readModeFromUi());

  // Optional: respect query mode at load
  const qMode = (qs('mode','')||'').toLowerCase();
  if(qMode === 'research'){
    const r = $('input[name="rb-mode"][value="research"]');
    if(r){ r.checked = true; setModeUi('research'); }
  }

})();