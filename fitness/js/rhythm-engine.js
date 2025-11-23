// === fitness/js/rhythm-engine.js — Rhythm Boxer (Research-Ready, autoplay-safe) ===
'use strict';

// ----- Config -----

const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2

// emoji สำหรับแต่ละเลน
const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];

// ขนาด note ตามระดับความยาก (px) — ผูกกับ CSS (ใช้เป็น base)
const NOTE_SIZE_BY_DIFF = {
  easy:  64,
  normal:56,
  hard:  48
};

// hit window (วินาที)
const HIT_WINDOWS = {
  perfect: 0.06,
  great:   0.12,
  good:    0.20
};

// spawn ล่วงหน้าก่อนถึงเส้นตี (วินาที)
const PRE_SPAWN_SEC = 2.0;

// chart ตัวอย่าง (track demo เดียวก่อน)
// time = เวลาที่ note จะถึงเส้นตี (วินาที)
const TRACKS = [
  {
    id: 'warmup-easy',
    name: 'Warm-up Groove (Easy)',
    audio: 'audio/warmup-groove.mp3',
    duration: 32,      // ประมาณเวลาเพลงจริง (ใช้ตัดจบ timeline)
    bpm: 100,
    diff: 'easy',
    chart: makeWarmupChart()
  }
];

// ----- Utilities -----

function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

function $(id){ return document.getElementById(id); }

// logger แบบง่ายสำหรับ Event CSV
class EventLogger {
  constructor(){ this.rows = []; }

  add(row){ this.rows.push(row); }

  toCsv(){
    if (!this.rows.length) return '';
    const cols = Object.keys(this.rows[0]);
    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')){
        return '"' + s.replace(/"/g,'""') + '"';
      }
      return s;
    };
    const lines = [];
    lines.push(cols.join(','));
    for (const r of this.rows){
      lines.push(cols.map(c => esc(r[c])).join(','));
    }
    return lines.join('\n');
  }
}

// สร้าง chart แบบ 4 ลักษณะง่าย ๆ (8 beat / 4 bar) demo
function makeWarmupChart(){
  const out = [];
  let t = 2.0;          // เริ่มหลัง 2 วินาที
  const beat = 60 / 100; // bpm = 100 → 0.6s/beat

  // 4 bar แรก: single note สลับเลน
  const seq1 = [2, 1, 3, 2, 1, 3, 2, 3];
  for (let bar = 0; bar < 4; bar++){
    for (let i = 0; i < seq1.length; i++){
      out.push({ time: t, lane: seq1[i], type: 'note' });
      t += beat;
    }
  }

  // แทรก shield / bomb / hp เบา ๆ
  out.push({ time:  t + beat * 0.5, lane: 0, type: 'hp'     });
  out.push({ time:  t + beat * 1.5, lane: 4, type: 'shield' });
  out.push({ time:  t + beat * 3.0, lane: 2, type: 'bomb'   });

  return out;
}

// ----- Main game module -----

(function(){

  // DOM refs (จะ set ใน init)
  let elMode, elTrackSelect, elTrackName;
  let elScore, elCombo, elAcc, elHp, elShield, elTime;
  let elFeverFill, elFeverStatus;
  let elProgFill, elProgLabel;
  let elCntPerfect, elCntGreat, elCntGood, elCntMiss;
  let elField, elLaneWrap, elTapHint, elHitLine;
  let elBtnStop, elBtnCsv;

  // Research form
  let elModeNormal, elModeResearch;
  let elInputId, elInputGroup, elInputNote;

  // Audio
  let audioEl = null;

  // Timeline
  let running = false;
  let started = false;
  let startPerf = 0;
  let lastPerf  = 0;
  let currentSongTime = 0;

  // Game state
  let sessionId = makeSessionId();
  let runIndex  = 0;
  let currentTrack = TRACKS[0];
  let currentDiff  = 'easy';

  let chart = [];
  let chartIndex = 0;
  let activeNotes = [];   // [{id, lane, time, type, el, judged, hit, removed}]

  let nextNoteId = 1;

  // Stats
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hp = 100;
  let shield = 0;
  let fever = 0;
  let feverActive = false;

  let cntPerfect = 0;
  let cntGreat   = 0;
  let cntGood    = 0;
  let cntMiss    = 0;

  // Logging
  const eventLogger = new EventLogger();

  // Research meta
  let mode = 'normal'; // 'normal' | 'research'
  let participant = '';
  let group = '';

  // 8-beat timing guide
  let guideBeatPhase = 0;

  // ----- Init -----

  function init(){
    // DOM query
    elTrackSelect = $('rb-track');
    elTrackName   = $('rb-track-name');
    elScore       = $('rb-score');
    elCombo       = $('rb-combo');
    elAcc         = $('rb-acc');
    elHp          = $('rb-hp');
    elShield      = $('rb-shield');
    elTime        = $('rb-time');
    elFeverFill   = $('rb-fever-fill');
    elFeverStatus = $('rb-fever-status');
    elProgFill    = $('rb-progress-fill');
    elProgLabel   = $('rb-progress-label');
    elCntPerfect  = $('rb-count-perfect');
    elCntGreat    = $('rb-count-great');
    elCntGood     = $('rb-count-good');
    elCntMiss     = $('rb-count-miss');
    elField       = $('rb-field');
    elLaneWrap    = $('rb-lane-wrap');
    elTapHint     = $('rb-tap-hint');
    elHitLine     = $('rb-hit-line');
    elBtnStop     = $('rb-btn-stop');
    elBtnCsv      = $('rb-btn-download-csv');

    elModeNormal   = $('rb-mode-normal');
    elModeResearch = $('rb-mode-research');
    elInputId      = $('rb-input-id');
    elInputGroup   = $('rb-input-group');
    elInputNote    = $('rb-input-note');

    audioEl = $('rb-audio');

    // เติม track select (ตอนนี้มีแค่ track เดียว แต่เตรียมรองรับเพิ่ม)
    if (elTrackSelect){
      elTrackSelect.innerHTML = '';
      for (const t of TRACKS){
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        elTrackSelect.appendChild(opt);
      }
      elTrackSelect.value = TRACKS[0].id;
      elTrackSelect.addEventListener('change', onChangeTrack);
    }

    if (elModeNormal){
      elModeNormal.checked = true;
      elModeNormal.addEventListener('change', onModeChange);
    }
    if (elModeResearch){
      elModeResearch.addEventListener('change', onModeChange);
    }

    if (elBtnStop) elBtnStop.addEventListener('click', stopEarly);
    if (elBtnCsv)  elBtnCsv.addEventListener('click', downloadCsv);

    // แตะ field หรือ hint เพื่อเริ่มเพลง/เวลา
    if (elField) elField.addEventListener('pointerdown', handleFirstTap);
    if (elTapHint){
      elTapHint.addEventListener('pointerdown', (ev)=>{
        ev.stopPropagation();
        handleFirstTap();
      });
    }

    // tap lane เพื่อ hit
    if (elLaneWrap){
      elLaneWrap.addEventListener('pointerdown', onLaneTap);
    }

    // ปุ่มเริ่มในเมนู (อยู่ใน html shadow-breaker style เดียวกัน: ใช้ data-action)
    const btnPlay = document.querySelector('[data-action="rb-start"]');
    if (btnPlay){
      btnPlay.addEventListener('click', startNewRunFromMenu);
    }

    // โหลด track และ reset
    applyTrack(TRACKS[0]);
    resetState();
    updateHUD();
  }

  // ----- Session / track -----

  function makeSessionId(){
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth()+1).padStart(2,'0');
    const d = String(t.getDate()).padStart(2,'0');
    const hh = String(t.getHours()).padStart(2,'0');
    const mm = String(t.getMinutes()).padStart(2,'0');
    const ss = String(t.getSeconds()).padStart(2,'0');
    return `RB-${y}${m}${d}-${hh}${mm}${ss}`;
  }

  function onModeChange(){
    mode = elModeResearch && elModeResearch.checked ? 'research' : 'normal';
  }

  function onChangeTrack(){
    const id = elTrackSelect ? elTrackSelect.value : TRACKS[0].id;
    const t = TRACKS.find(x => x.id === id) || TRACKS[0];
    applyTrack(t);
    resetState();
    updateHUD();
  }

  function applyTrack(track){
    currentTrack = track;
    currentDiff  = track.diff || 'easy';
    chart        = track.chart || [];
    chartIndex   = 0;

    if (elTrackName) elTrackName.textContent = track.name || '-';

    // ตั้ง audio src
    if (audioEl){
      audioEl.src = track.audio;
      audioEl.load();
    }
  }

  // ----- Game flow -----

  function startNewRunFromMenu(){
    // ดึงข้อมูลแบบฟอร์มวิจัย (ถ้าเลือก research)
    mode = elModeResearch && elModeResearch.checked ? 'research' : 'normal';
    if (mode === 'research'){
      participant = (elInputId && elInputId.value.trim()) || '-';
      group       = (elInputGroup && elInputGroup.value.trim()) || '-';
    }else{
      participant = '';
      group       = '';
    }

    resetState();
    updateHUD();

    // แสดง hint ให้แตะเพื่อเริ่มเพลง
    if (elTapHint) elTapHint.classList.remove('hidden');
    if (elField)   elField.classList.add('rb-wait-start');

    // scroll ลงไปให้เห็น field
    if (elField && elField.scrollIntoView){
      elField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function resetState(){
    running = false;
    started = false;
    startPerf = 0;
    lastPerf  = 0;
    currentSongTime = 0;
    chartIndex = 0;
    activeNotes = [];
    nextNoteId = 1;

    score = 0;
    combo = 0;
    maxCombo = 0;
    hp = 100;
    shield = 0;
    fever = 0;
    feverActive = false;

    cntPerfect = 0;
    cntGreat   = 0;
    cntGood    = 0;
    cntMiss    = 0;

    guideBeatPhase = 0;

    runIndex++;
    // ไม่ reset sessionId เพื่อให้หลาย run อยู่ใน session เดียวกัน

    // ล้าง note DOM
    if (elLaneWrap){
      const notes = elLaneWrap.querySelectorAll('.rb-note');
      notes.forEach(n => n.remove());
    }
  }

  // เริ่ม timeline เมื่อแตะครั้งแรก
  function handleFirstTap(){
    if (started) return;
    started = true;
    running = true;
    startPerf = performance.now();
    lastPerf  = startPerf;
    currentSongTime = 0;

    if (elTapHint) elTapHint.classList.add('hidden');
    if (elField)   elField.classList.remove('rb-wait-start');

    // พยายามเล่นเพลง (ถ้าโดน block ก็ปล่อยให้ timeline รันแบบเงียบ)
    if (audioEl){
      const p = audioEl.play();
      if (p && typeof p.catch === 'function'){
        p.catch(()=>{
          console.log('[Rhythm] Audio autoplay blocked — running silent timeline.');
        });
      }
    }

    requestAnimationFrame(loop);
  }

  function stopEarly(){
    if (!running && !started) return;
    running = false;
    started = false;

    if (audioEl){
      try{
        audioEl.pause();
        audioEl.currentTime = 0;
      }catch(e){}
    }

    // แสดง hint ใหม่ถ้าจะเล่นอีกรอบ
    if (elTapHint) elTapHint.classList.remove('hidden');
    if (elField)   elField.classList.add('rb-wait-start');
  }

  // ----- Main loop -----

  function loop(now){
    if (!running) return;

    const dt   = (now - lastPerf) / 1000;
    const time = (now - startPerf) / 1000;
    lastPerf   = now;
    currentSongTime = time;

    const dur = currentTrack.duration || 30;
    const clampedTime = clamp(time, 0, dur);

    updateTimeline(clampedTime, dt);
    updateHUD();

    // check end
    if (clampedTime >= dur){
      running = false;
      console.log('[Rhythm] track end');
      return;
    }

    requestAnimationFrame(loop);
  }

  function updateTimeline(songTime, dt){
    // 1) spawn note ใหม่
    spawnNotes(songTime);

    // 2) เคลื่อน note
    updateNotePositions(songTime);

    // 3) auto-miss note ที่ผ่าน hit window ไปแล้ว
    autoJudgeMiss(songTime);

    // 4) 8-beat timing guide (แค่ไว้ใช้ CSS pulse)
    guideBeatPhase += dt * (currentTrack.bpm || 100) / 60;
    const phase = guideBeatPhase % 1;
    if (elHitLine){
      elHitLine.style.opacity = phase < 0.15 ? 1.0 : 0.6;
    }
  }

  function spawnNotes(songTime){
    if (!chart || !chart.length) return;

    const pre = PRE_SPAWN_SEC;
    const len = chart.length;

    while (chartIndex < len && chart[chartIndex].time <= songTime + pre){
      const n = chart[chartIndex];
      createNote(n);
      chartIndex++;
    }
  }

  function createNote(info){
    if (!elLaneWrap) return;
    const laneIndex = clamp(info.lane|0, 0, LANES.length-1);

    const laneEl = elLaneWrap.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
    if (!laneEl) return;

    const noteEl = document.createElement('div');
    noteEl.className = 'rb-note';
    noteEl.dataset.lane = String(laneIndex);
    noteEl.dataset.time = String(info.time);
    noteEl.dataset.type = info.type || 'note';

    const inner = document.createElement('div');
    inner.className = 'rb-note-inner';
    inner.textContent = NOTE_EMOJI_BY_LANE[laneIndex] || '🎵';
    noteEl.appendChild(inner);

    laneEl.appendChild(noteEl);

    const id = nextNoteId++;

    const noteObj = {
      id,
      lane: laneIndex,
      time: info.time,
      type: info.type || 'note',
      el: noteEl,
      judged: false,
      hit: false,
      removed: false
    };

    activeNotes.push(noteObj);
  }

  function updateNotePositions(songTime){
    if (!elLaneWrap) return;
    const laneRect = elLaneWrap.getBoundingClientRect();
    const h = laneRect.height || 1;

    const pre = PRE_SPAWN_SEC;
    const travel = h * 0.85; // ระยะจากด้านบนลงมาเกือบถึงล่าง

    for (const n of activeNotes){
      if (!n.el || n.removed) continue;

      const dt = n.time - songTime;
      const progress = 1 - (dt / pre);  // 0 → ยังอยู่นอกจอ, 1 → ถึงเส้นตี
      const pClamp = clamp(progress, 0, 1.2);
      const y = pClamp * travel;

      n.el.style.transform = `translateY(${y}px)`;
      n.el.style.opacity   = (pClamp <= 1.0) ? 1 : clamp(1.2 - pClamp, 0, 1);
    }
  }

  function autoJudgeMiss(songTime){
    const missWindow = HIT_WINDOWS.good + 0.05;

    for (const n of activeNotes){
      if (n.judged) continue;
      if (songTime > n.time + missWindow){
        // ถ้าเป็น bomb / shield / hp แล้วไม่โดน ไม่ถือว่า miss
        if (n.type !== 'note') {
          n.judged = true;
          continue;
        }
        applyJudgement(n, 'miss', songTime);
      }
    }

    // ล้าง note ที่ถูกถอดแล้ว
    activeNotes = activeNotes.filter(n => !n.removed);
  }

  // ----- Hit handling -----

  function onLaneTap(ev){
    if (!running || !started) return;

    const laneEl = ev.target.closest('.rb-lane');
    if (!laneEl) return;

    const laneIndex = parseInt(laneEl.dataset.lane || '0', 10);

    // ห note ใน lane นี้ที่ใกล้เวลา songTime ที่สุด
    let best = null;
    let bestDiff = Infinity;

    for (const n of activeNotes){
      if (n.judged) continue;
      if (n.lane !== laneIndex) continue;

      const diff = Math.abs(n.time - currentSongTime);
      if (diff < bestDiff){
        bestDiff = diff;
        best = n;
      }
    }

    if (!best) return;

    // ถ้าเป็น item พิเศษ hp/shield/bomb → ใช้ hit window กว้างหน่อย
    const isItem = (best.type === 'hp' || best.type === 'shield' || best.type === 'bomb');
    const windowGood = isItem ? HIT_WINDOWS.good * 1.5 : HIT_WINDOWS.good;

    if (bestDiff > windowGood){
      // กดเร็ว/ช้าเกินไป → ถือว่า miss
      if (!isItem){
        applyJudgement(best, 'miss', currentSongTime);
      }
      return;
    }

    // ตัดสินเกรด
    let grade = 'good';
    if (bestDiff <= HIT_WINDOWS.perfect) grade = 'perfect';
    else if (bestDiff <= HIT_WINDOWS.great) grade = 'great';

    applyJudgement(best, grade, currentSongTime);
  }

  function applyJudgement(note, grade, songTime){
    if (note.judged) return;
    note.judged = true;

    const isBomb   = note.type === 'bomb';
    const isHp     = note.type === 'hp';
    const isShield = note.type === 'shield';

    let eventType = 'hit';
    let deltaScore = 0;

    // เก็บค่าเดิม
    const scoreBefore  = score;
    const comboBefore  = combo;
    const hpBefore     = hp;
    const shieldBefore = shield;
    const feverBefore  = fever;

    if (isBomb){
      eventType = 'hit-bomb';
      combo = 0;
      score = Math.max(0, score - 100);
      hp = clamp(hp - 20, 0, 100);
      cntMiss++;
    }else if (isHp){
      eventType = 'hit-hp';
      combo++;
      score += 80;
      hp = clamp(hp + 15, 0, 100);
      cntGood++;
    }else if (isShield){
      eventType = 'hit-shield';
      combo++;
      score += 80;
      shield = clamp(shield + 10, 0, 100);
      cntGood++;
    }else if (grade === 'miss'){
      eventType = 'miss';
      combo = 0;
      hp = clamp(hp - 8, 0, 100);
      cntMiss++;
    }else{
      // note ปกติ
      combo++;
      if (grade === 'perfect'){
        deltaScore = 150;
        cntPerfect++;
        fever = clamp(fever + 7, 0, 100);
      }else if (grade === 'great'){
        deltaScore = 110;
        cntGreat++;
        fever = clamp(fever + 5, 0, 100);
      }else{ // good
        deltaScore = 70;
        cntGood++;
        fever = clamp(fever + 3, 0, 100);
      }
      score += deltaScore;
    }

    maxCombo = Math.max(maxCombo, combo);

    // FEVER ready/on (logic ง่าย ๆ)
    if (!feverActive && fever >= 100){
      feverActive = true;
      fever = 100;
      if (elFeverStatus){
        elFeverStatus.classList.add('on');
        elFeverStatus.textContent = 'FEVER!!';
      }
    }

    // visual feedback เล็ก ๆ
    if (note.el){
      note.el.classList.add('rb-note-hit');
      setTimeout(()=>{ if (note.el) note.el.remove(); }, 220);
    }
    note.removed = true;

    // accuracy
    const totalJudged = cntPerfect + cntGreat + cntGood + cntMiss;
    const hitCount = cntPerfect + cntGreat + cntGood;
    const accPct = totalJudged ? (hitCount / totalJudged) * 100 : 0;

    // logging
    const offsetMs = (songTime - note.time) * 1000;

    eventLogger.add({
      session_id : sessionId,
      run_index  : runIndex,
      mode       : mode,
      track_id   : currentTrack.id || '',
      track_name : currentTrack.name || '',
      participant: participant,
      group      : group,

      note_id    : note.id,
      lane       : note.lane,
      event_type : eventType,
      grade      : grade,

      offset_ms   : offsetMs.toFixed(1),
      song_time_s : songTime.toFixed(3),
      accuracy_pct: accPct.toFixed(1),

      score_delta : score - scoreBefore,
      score_total : score,
      combo_before: comboBefore,
      combo_after : combo,
      hp_before   : hpBefore,
      hp_after    : hp,
      shield_before: shieldBefore,
      shield_after : shield,
      fever_before : feverBefore,
      fever_after  : fever
    });

    updateHUD();
  }

  // ----- HUD / CSV -----

  function updateHUD(){
    if (elScore) elScore.textContent = String(score);
    if (elCombo) elCombo.textContent = String(combo);

    const totalJudged = cntPerfect + cntGreat + cntGood + cntMiss;
    const hitCount = cntPerfect + cntGreat + cntGood;
    const accPct = totalJudged ? (hitCount / totalJudged) * 100 : 0;

    if (elAcc) elAcc.textContent = accPct.toFixed(1) + '%';

    if (elHp) elHp.textContent = String(hp);
    if (elShield) elShield.textContent = String(shield);

    if (elCntPerfect) elCntPerfect.textContent = String(cntPerfect);
    if (elCntGreat)   elCntGreat.textContent   = String(cntGreat);
    if (elCntGood)    elCntGood.textContent    = String(cntGood);
    if (elCntMiss)    elCntMiss.textContent    = String(cntMiss);

    if (elTime) elTime.textContent = currentSongTime.toFixed(1);

    const dur = currentTrack.duration || 30;
    const prog = clamp(currentSongTime / dur, 0, 1);
    if (elProgFill)   elProgFill.style.transform = `scaleX(${prog})`;
    if (elProgLabel)  elProgLabel.textContent = Math.round(prog * 100) + '%';

    const feverRatio = clamp(fever / 100, 0, 1);
    if (elFeverFill) elFeverFill.style.transform = `scaleX(${feverRatio})`;
    if (elFeverStatus){
      if (feverActive){
        elFeverStatus.textContent = 'FEVER!!';
        elFeverStatus.classList.add('on');
      }else{
        elFeverStatus.classList.remove('on');
        elFeverStatus.textContent = feverRatio >= 1 ? 'READY' : 'FEVER';
      }
    }
  }

  function downloadCsv(){
    if (!eventLogger.rows.length){
      alert('ยังไม่มีข้อมูล Event สำหรับบันทึก');
      return;
    }
    const csv = eventLogger.toCsv();
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const pid  = (participant || 'Pxxx').replace(/[^a-z0-9_-]/gi,'');
    a.href = url;
    a.download = `rhythm-boxer-events-${pid || 'Pxxx'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ----- Auto init -----

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

  // เผื่อ debug จาก console
  window.__RB_DEBUG = {
    getState: () => ({
      running, started, currentSongTime,
      score, combo, hp, shield, fever,
      activeNotes: activeNotes.map(n=>({id:n.id, lane:n.lane, time:n.time, type:n.type, judged:n.judged}))
    })
  };

})();