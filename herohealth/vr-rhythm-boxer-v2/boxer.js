(function(){
  'use strict';

  const qs = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MODE_PRESETS = {
    learn:  { bpm: 96,  density: 0.58, banner: 'Learn Mode'  },
    active: { bpm: 112, density: 0.74, banner: 'Active Mode' },
    cardio: { bpm: 120, density: 0.84, banner: 'Cardio Mode' }
  };

  const DIFF_PRESETS = {
    easy:      { densityBonus: -0.08 },
    normal:    { densityBonus:  0.00 },
    challenge: { densityBonus:  0.08 }
  };

  const ACTIONS = {
    jab:   { lane: 0, label: 'Jab',   icon: '👊', key: 'KeyA', alt: 'ArrowLeft'  },
    cross: { lane: 1, label: 'Cross', icon: '💥', key: 'KeyL', alt: 'ArrowRight' },
    block: { lane: 2, label: 'Block', icon: '🛡', key: 'KeyW', alt: 'ArrowUp'    },
    duck:  { lane: 3, label: 'Duck',  icon: '⬇', key: 'KeyS', alt: 'ArrowDown'  }
  };

  const WINDOWS = {
    perfect: 80,
    great: 140,
    good: 220
  };

  const STORAGE_LAST = 'HHA_LAST_SUMMARY';
  const STORAGE_HISTORY = 'HHA_SUMMARY_HISTORY';

  const params = {
    pid: qs.get('pid') || 'anon',
    nick: qs.get('nick') || '',
    mode: (qs.get('mode') || 'active').toLowerCase(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    durSec: clamp(Number(qs.get('dur') || 120), 30, 600),
    bpm: clamp(Number(qs.get('bpm') || MODE_PRESETS[qs.get('mode') || 'active']?.bpm || 112), 72, 180),
    view: (qs.get('view') || 'mobile').toLowerCase(),
    seed: qs.get('seed') || String(Date.now()),
    hub: qs.get('hub') || '../hub.html',
    run: qs.get('run') || 'play',
    audio: (qs.get('audio') || '1') !== '0',
    gameId: qs.get('game') || 'rhythm-boxer-v2',
    zone: qs.get('zone') || 'fitness',
    studyId: qs.get('studyId') || '',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || ''
  };

  const modePreset = MODE_PRESETS[params.mode] || MODE_PRESETS.active;
  const diffPreset = DIFF_PRESETS[params.diff] || DIFF_PRESETS.normal;

  const density = clamp(modePreset.density + diffPreset.densityBonus, 0.42, 0.94);
  const beatMs = 60000 / params.bpm;
  const totalMs = params.durSec * 1000;
  const travelMs = params.view === 'mobile' ? 1650 : 1500;
  const startDelayMs = 3200;

  const seeded = mulberry32(xmur3(`${params.seed}|${params.pid}|${params.mode}|${params.diff}`)());

  const TARGET_MIX = {
    learn:  { jab: 0.34, cross: 0.34, block: 0.16, duck: 0.16 },
    active: { jab: 0.32, cross: 0.32, block: 0.18, duck: 0.18 },
    cardio: { jab: 0.34, cross: 0.34, block: 0.16, duck: 0.16 }
  };

  function makePattern(label, steps, hint){
    const maxBeat = Math.max.apply(null, steps.map(s => s.beat));
    return {
      label,
      steps,
      hint: hint || label,
      len: maxBeat + 1
    };
  }

  const PATTERNS = {
    warmup: [
      makePattern('Jab', [{ action:'jab', beat:0 }], 'ตีจังหวะเดียวให้แม่น'),
      makePattern('Cross', [{ action:'cross', beat:0 }], 'ตีจังหวะเดียวให้แม่น'),
      makePattern('Block', [{ action:'block', beat:0 }], 'ยกการ์ดให้ตรงจังหวะ'),
      makePattern('Duck', [{ action:'duck', beat:0 }], 'ก้มหลบให้ตรงจังหวะ'),
      makePattern('Jab → Cross', [
        { action:'jab', beat:0 },
        { action:'cross', beat:1 }
      ], 'ซ้าย แล้ว ขวา')
    ],

    basic: [
      makePattern('Jab → Cross', [
        { action:'jab', beat:0 },
        { action:'cross', beat:1 }
      ], 'ซ้าย แล้ว ขวา'),
      makePattern('Jab → Jab', [
        { action:'jab', beat:0 },
        { action:'jab', beat:1 }
      ], 'ตีซ้าย 2 ครั้ง'),
      makePattern('Cross → Block', [
        { action:'cross', beat:0 },
        { action:'block', beat:1 }
      ], 'ตีแล้วกัน'),
      makePattern('Jab → Duck', [
        { action:'jab', beat:0 },
        { action:'duck', beat:1 }
      ], 'ตีแล้วก้มหลบ')
    ],

    normal: [
      makePattern('Jab → Cross', [
        { action:'jab', beat:0 },
        { action:'cross', beat:1 }
      ], 'ซ้าย แล้ว ขวา'),
      makePattern('Block → Cross', [
        { action:'block', beat:0 },
        { action:'cross', beat:1 }
      ], 'กันก่อนแล้วค่อยตี'),
      makePattern('Jab → Duck → Cross', [
        { action:'jab', beat:0 },
        { action:'duck', beat:1 },
        { action:'cross', beat:2 }
      ], 'ตี ก้ม แล้วตี'),
      makePattern('Jab → Cross → Block', [
        { action:'jab', beat:0 },
        { action:'cross', beat:1 },
        { action:'block', beat:2 }
      ], 'ตีสองครั้งแล้วกัน'),
      makePattern('Jab → Cross (เร็ว)', [
        { action:'jab', beat:0 },
        { action:'cross', beat:0.5 }
      ], 'ตีเร็วขึ้นครึ่งจังหวะ')
    ],

    advanced: [
      makePattern('Jab → Cross → Duck', [
        { action:'jab', beat:0 },
        { action:'cross', beat:1 },
        { action:'duck', beat:2 }
      ], 'ตีสองครั้งแล้วก้ม'),
      makePattern('Block → Jab → Cross', [
        { action:'block', beat:0 },
        { action:'jab', beat:1 },
        { action:'cross', beat:2 }
      ], 'กันก่อนค่อยสวน'),
      makePattern('Jab → Cross → Block → Duck', [
        { action:'jab', beat:0 },
        { action:'cross', beat:1 },
        { action:'block', beat:2 },
        { action:'duck', beat:3 }
      ], 'ครบทั้งตี กัน และก้ม'),
      makePattern('Jab → Cross (เร็ว) → Block', [
        { action:'jab', beat:0 },
        { action:'cross', beat:0.5 },
        { action:'block', beat:1.5 }
      ], 'เร็วขึ้นแล้วกันตอนท้าย'),
      makePattern('Duck → Jab → Cross', [
        { action:'duck', beat:0 },
        { action:'jab', beat:1 },
        { action:'cross', beat:2 }
      ], 'เริ่มด้วยหลบแล้วสวน')
    ],

    finale: [
      makePattern('Jab → Cross → Block', [
        { action:'jab', beat:0 },
        { action:'cross', beat:1 },
        { action:'block', beat:2 }
      ], 'คอมโบรอบท้าย'),
      makePattern('Jab → Duck → Cross → Block', [
        { action:'jab', beat:0 },
        { action:'duck', beat:1 },
        { action:'cross', beat:2 },
        { action:'block', beat:3 }
      ], 'ตี ก้ม ตี กัน'),
      makePattern('Block → Jab → Cross → Duck', [
        { action:'block', beat:0 },
        { action:'jab', beat:1 },
        { action:'cross', beat:2 },
        { action:'duck', beat:3 }
      ], 'กันก่อนแล้วเล่นต่อ'),
      makePattern('Jab → Cross (เร็ว) → Duck', [
        { action:'jab', beat:0 },
        { action:'cross', beat:0.5 },
        { action:'duck', beat:1.5 }
      ], 'เร็วขึ้นแล้วก้มหลบ')
    ]
  };

  const els = {
    subline: $('subline'),
    scoreValue: $('scoreValue'),
    comboValue: $('comboValue'),
    accValue: $('accValue'),
    timeValue: $('timeValue'),
    coachText: $('coachText'),
    patternLabel: $('patternLabel'),
    patternHint: $('patternHint'),
    roundChip: $('roundChip'),
    segmentLabel: $('segmentLabel'),
    segmentHint: $('segmentHint'),
    arena: $('arena'),
    noteLayer: $('noteLayer'),
    hitLine: $('hitLine'),
    phaseBanner: $('phaseBanner'),
    countdownLayer: $('countdownLayer'),
    countdownNum: $('countdownNum'),
    breathOverlay: $('breathOverlay'),
    breathAction: $('breathAction'),
    breathCircle: $('breathCircle'),
    breathHint: $('breathHint'),
    breathCount: $('breathCount'),
    feedbackPop: $('feedbackPop'),
    arenaPulse: $('arenaPulse'),
    audioToggle: $('audioToggle'),
    summaryOverlay: $('summaryOverlay'),
    sumScore: $('sumScore'),
    sumAcc: $('sumAcc'),
    sumCombo: $('sumCombo'),
    sumTime: $('sumTime'),
    sumPerfect: $('sumPerfect'),
    sumGreat: $('sumGreat'),
    sumGood: $('sumGood'),
    sumMiss: $('sumMiss'),
    sumJab: $('sumJab'),
    sumCross: $('sumCross'),
    sumBlock: $('sumBlock'),
    sumDuck: $('sumDuck'),
    sumBalance: $('sumBalance'),
    sumCoach: $('sumCoach'),
    summarySub: $('summarySub'),
    summaryGrade: $('summaryGrade'),
    btnReplay: $('btnReplay'),
    btnBackHubTop: $('btnBackHubTop'),
    btnBackHubBottom: $('btnBackHubBottom')
  };

  els.audioToggle.checked = params.audio;
  els.btnBackHubTop.href = params.hub;
  els.btnBackHubBottom.href = params.hub;
  els.subline.textContent =
    `${params.mode.toUpperCase()} • ${params.diff.toUpperCase()} • ${params.bpm} BPM • ${params.durSec}s`;

  const inputButtons = Array.from(document.querySelectorAll('.pad-btn'));

  const state = {
    started: false,
    ended: false,
    startAt: performance.now() + startDelayMs,
    beatIndex: -1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    blankTap: 0,
    totalNotes: 0,
    judgedNotes: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    actions: { jab: 0, cross: 0, block: 0, duck: 0 },
    scheduledActions: { jab: 0, cross: 0, block: 0, duck: 0 },
    offsets: [],
    notes: [],
    segments: [],
    lastCoachAt: 0,
    feedbackHideAt: 0,
    currentPatternId: '',
    currentSegmentId: '',
    currentBreathMode: '',
    events: [],
    audioCtx: null
  };

  function ensureAudio(){
    if(state.audioCtx) return state.audioCtx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if(!AudioCtx) return null;
    try{
      state.audioCtx = new AudioCtx();
    }catch(_){
      state.audioCtx = null;
    }
    return state.audioCtx;
  }

  function beep(freq, dur, vol){
    if(!els.audioToggle.checked) return;
    const ctx = ensureAudio();
    if(!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function weightedPick(items){
    const total = items.reduce((s, x) => s + x.w, 0);
    let r = seeded() * total;
    for(const item of items){
      r -= item.w;
      if(r <= 0) return item.v;
    }
    return items[items.length - 1].v;
  }

  function patternCounts(pattern){
    const out = { jab:0, cross:0, block:0, duck:0 };
    for(const s of pattern.steps){
      out[s.action] += 1;
    }
    return out;
  }

  function buildSegments(){
    const blueprint = [
      {
        id:'warmup',
        type:'play',
        weight:0.16,
        pool:'warmup',
        banner:'Warmup',
        roundLabel:'Round 0 • Warmup',
        segmentLabel:'Warmup',
        segmentHint:'ค่อย ๆ จับจังหวะก่อน',
        coach:'เริ่มเบา ๆ ก่อนนะ จับจังหวะให้แม่น'
      },
      {
        id:'recover1',
        type:'breath',
        weight:0.08,
        banner:'Recovery',
        roundLabel:'Recovery 1 • Breathing',
        segmentLabel:'Recovery 1',
        segmentHint:'หายใจเข้า-ออกตามวง',
        coach:'พักสั้น ๆ แล้วหายใจตามวง',
        breathCycleMs: params.mode === 'cardio' ? 2800 : 3200
      },
      {
        id:'round1',
        type:'play',
        weight:0.20,
        pool: params.diff === 'easy' ? 'basic' : 'normal',
        banner:'Round 1',
        roundLabel:'Round 1 • Basic Combo',
        segmentLabel:'Round 1',
        segmentHint:'เริ่มเล่นเป็นคอมโบแล้ว',
        coach:'ดู pattern แล้วตีตามลำดับ'
      },
      {
        id:'recover2',
        type:'breath',
        weight:0.08,
        banner:'Recovery',
        roundLabel:'Recovery 2 • Breathing',
        segmentLabel:'Recovery 2',
        segmentHint:'พักไหล่และผ่อนลมหายใจ',
        coach:'ช้า ๆ ก่อน แล้วค่อยไปต่อ',
        breathCycleMs: params.mode === 'cardio' ? 2800 : 3200
      },
      {
        id:'round2',
        type:'play',
        weight:0.20,
        pool: params.diff === 'challenge' ? 'advanced' : 'normal',
        banner:'Round 2',
        roundLabel:'Round 2 • Boxing Pattern',
        segmentLabel:'Round 2',
        segmentHint:'คอมโบยาวขึ้นและมีหลบ/กันมากขึ้น',
        coach:'คอมโบยาวขึ้นแล้วนะ ดูลำดับให้ดี'
      },
      {
        id:'recover3',
        type:'breath',
        weight:0.08,
        banner:'Recovery',
        roundLabel:'Recovery 3 • Breathing',
        segmentLabel:'Recovery 3',
        segmentHint:'เตรียมตัวก่อนเข้ารอบท้าย',
        coach:'พักอีกนิด แล้วเตรียมเข้ารอบสุดท้าย',
        breathCycleMs: params.mode === 'cardio' ? 2700 : 3000
      },
      {
        id:'boss',
        type:'play',
        weight:0.13,
        pool:'finale',
        banner:'Boss Finale',
        roundLabel:'Finale • Pattern Test',
        segmentLabel:'Boss Finale',
        segmentHint:'รอบท้าย pattern จะเร็วขึ้นนิดหนึ่ง',
        coach:'รอบสุดท้ายแล้ว ตั้งใจดู pattern ให้ดี'
      },
      {
        id:'cooldown',
        type:'breath',
        weight:0.07,
        banner:'Cooldown',
        roundLabel:'Cooldown • Breathing',
        segmentLabel:'Cooldown',
        segmentHint:'คูลดาวน์และหายใจช้า ๆ',
        coach:'ดีมาก ตอนนี้คูลดาวน์ช้า ๆ',
        breathCycleMs: 3600
      }
    ];

    let cursor = 0;
    state.segments = blueprint.map((cfg) => {
      const duration = cfg.weight * totalMs;
      const seg = {
        ...cfg,
        start: cursor,
        end: cursor + duration,
        duration
      };
      cursor = seg.end;
      return seg;
    });
  }

  function getSegmentAt(elapsed){
    for(const seg of state.segments){
      if(elapsed >= seg.start && elapsed < seg.end) return seg;
    }
    return state.segments[state.segments.length - 1] || null;
  }

  function choosePattern(segment, recentLabels, availableMs){
    const pool = PATTERNS[segment.pool] || PATTERNS.normal;
    const target = TARGET_MIX[params.mode] || TARGET_MIX.active;
    const scheduledTotal =
      state.scheduledActions.jab +
      state.scheduledActions.cross +
      state.scheduledActions.block +
      state.scheduledActions.duck;

    let candidates = pool.filter((pt) => (pt.len * beatMs) <= (availableMs + beatMs * 0.35));
    if(!candidates.length){
      const shortest = pool
        .slice()
        .sort((a, b) => a.len - b.len)[0];
      candidates = shortest ? [shortest] : [];
    }
    if(!candidates.length) return null;

    const items = candidates.map((pt) => {
      const cnt = patternCounts(pt);
      let w = 1;

      for(const action of Object.keys(ACTIONS)){
        const currentRatio = scheduledTotal > 0 ? (state.scheduledActions[action] / scheduledTotal) : 0;
        const deficit = target[action] - currentRatio;
        w += cnt[action] * Math.max(-0.12, deficit * 4.5);
      }

      if(recentLabels.includes(pt.label)) w *= 0.26;
      if(segment.id === 'warmup' && pt.len > 2) w *= 0.28;
      if(segment.id === 'boss' && pt.len >= 3) w *= 1.22;
      if(segment.id === 'boss' && pt.label.includes('เร็ว')) w *= 1.15;
      if(params.diff === 'easy' && pt.len >= 4) w *= 0.55;
      if(params.diff === 'challenge' && pt.len >= 3) w *= 1.08;

      return {
        v: pt,
        w: Math.max(0.08, w)
      };
    });

    return weightedPick(items);
  }

  function makeNote(id, action, hitTime, pattern, segment){
    return {
      id,
      action,
      lane: ACTIONS[action].lane,
      hitTime,
      spawnTime: hitTime - travelMs,
      judged: false,
      result: '',
      offsetMs: null,
      el: null,
      patternId: pattern.patternId,
      patternLabel: pattern.label,
      patternHint: pattern.hint,
      patternSeqText: pattern.seqText,
      segmentId: segment.id
    };
  }

  function generateSchedule(){
    const notes = [];
    const recentLabels = [];
    let noteId = 0;
    let patternSerial = 0;

    for(const segment of state.segments){
      if(segment.type !== 'play') continue;

      let t = segment.start + travelMs + 140;
      if(t > segment.end - 280) continue;

      while(t < segment.end - 260){
        const available = segment.end - t - 240;
        const pattern = choosePattern(segment, recentLabels, available);
        if(!pattern) break;

        const patternId = `p${patternSerial++}`;
        const seqText = pattern.steps.map(s => ACTIONS[s.action].label).join(' → ');

        for(const step of pattern.steps){
          const hitTime = t + (step.beat * beatMs);
          if(hitTime >= segment.end - 220) continue;

          const note = makeNote(`n${noteId++}`, step.action, hitTime, {
            patternId,
            label: pattern.label,
            hint: pattern.hint,
            seqText
          }, segment);

          notes.push(note);
          state.scheduledActions[step.action] += 1;
        }

        recentLabels.push(pattern.label);
        if(recentLabels.length > 3) recentLabels.shift();

        const gapBeats =
          segment.id === 'warmup' ? 0.82 :
          segment.id === 'boss' ? 0.42 : 0.62;

        t += (pattern.len + gapBeats + (1.12 - density) + seeded() * 0.22) * beatMs;
      }
    }

    notes.sort((a, b) => a.hitTime - b.hitTime);
    state.totalNotes = notes.length;
    return notes;
  }

  function buildNoteEl(note){
    const el = document.createElement('div');
    el.className = `note note--${note.action}`;
    el.dataset.noteId = note.id;
    el.innerHTML = `
      <div class="note-inner">
        <div class="note-icon">${ACTIONS[note.action].icon}</div>
        <div class="note-label">${ACTIONS[note.action].label.toUpperCase()}</div>
        <div class="note-small">${note.action === 'duck' ? 'ลงต่ำ' : 'ตรงเส้น'}</div>
      </div>
    `;
    els.noteLayer.appendChild(el);
    note.el = el;
  }

  function buildNotes(){
    state.notes = generateSchedule();
    for(const n of state.notes) buildNoteEl(n);
  }

  function scoreFor(result, combo){
    const base = { perfect: 100, great: 72, good: 44, miss: 0 }[result] || 0;
    const comboBonus = Math.min(60, Math.floor(combo / 5) * 6);
    return base + comboBonus;
  }

  function judgeFromOffset(offsetMs){
    const a = Math.abs(offsetMs);
    if(a <= WINDOWS.perfect) return 'perfect';
    if(a <= WINDOWS.great) return 'great';
    if(a <= WINDOWS.good) return 'good';
    return 'miss';
  }

  function setCoach(text){
    els.coachText.textContent = text;
  }

  function pulseArena(){
    els.arenaPulse.classList.add('is-beat');
    setTimeout(() => els.arenaPulse.classList.remove('is-beat'), 120);
  }

  function showFeedback(result, text){
    const el = els.feedbackPop;
    el.className = 'feedback-pop show ' + result;
    el.textContent = text;
    state.feedbackHideAt = performance.now() + 380;
  }

  function clearFeedback(now){
    if(state.feedbackHideAt && now >= state.feedbackHideAt){
      state.feedbackHideAt = 0;
      els.feedbackPop.className = 'feedback-pop';
      els.feedbackPop.textContent = '';
    }
  }

  function updateHUD(elapsed){
    els.scoreValue.textContent = String(Math.round(state.score));
    els.comboValue.textContent = String(state.combo);
    els.accValue.textContent = `${computeAccuracyPercent()}%`;
    const secLeft = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
    els.timeValue.textContent = fmtTime(secLeft);
  }

  function computeAccuracyPercent(){
    if(state.totalNotes <= 0) return 0;
    const weighted = (state.perfect * 1.0) + (state.great * 0.8) + (state.good * 0.55);
    return Math.round((weighted / state.totalNotes) * 100);
  }

  function nearestNote(action, elapsed){
    let best = null;
    let bestAbs = Infinity;

    for(const note of state.notes){
      if(note.action !== action || note.judged) continue;
      const abs = Math.abs(elapsed - note.hitTime);
      if(abs <= WINDOWS.good && abs < bestAbs){
        best = note;
        bestAbs = abs;
      }
    }
    return best;
  }

  function pressPad(action){
    const btn = document.querySelector(`.pad-btn[data-action="${action}"]`);
    if(!btn) return;
    btn.classList.add('is-pressed');
    setTimeout(() => btn.classList.remove('is-pressed'), 90);
  }

  function flashLane(action){
    const lane = document.querySelector(`.lane[data-action="${action}"]`);
    if(!lane) return;
    lane.animate(
      [
        { filter: 'brightness(1)', transform: 'scale(1)' },
        { filter: 'brightness(1.08)', transform: 'scale(1.003)' },
        { filter: 'brightness(1)', transform: 'scale(1)' }
      ],
      { duration: 120, easing: 'ease-out' }
    );
  }

  function registerHit(note, elapsed){
    const offset = elapsed - note.hitTime;
    const result = judgeFromOffset(offset);
    if(result === 'miss') return false;

    note.judged = true;
    note.result = result;
    note.offsetMs = offset;
    state.judgedNotes += 1;
    state.offsets.push(offset);
    state.actions[note.action] += 1;

    if(note.el){
      note.el.classList.add('is-hit');
      setTimeout(() => { if(note.el) note.el.style.display = 'none'; }, 120);
    }

    if(result === 'perfect'){
      state.perfect += 1;
      state.combo += 1;
      state.score += scoreFor(result, state.combo);
      showFeedback('perfect', 'Perfect!');
      setCoach('แม่นมาก! ตรงจังหวะพอดีเลย');
      beep(980, 0.04, 0.028);
    }else if(result === 'great'){
      state.great += 1;
      state.combo += 1;
      state.score += scoreFor(result, state.combo);
      showFeedback('great', 'Great!');
      setCoach('ดีมาก! ใกล้เป๊ะแล้ว');
      beep(860, 0.035, 0.024);
    }else{
      state.good += 1;
      state.combo += 1;
      state.score += scoreFor(result, state.combo);
      showFeedback('good', 'Good!');
      setCoach('ดีเลย ลองให้ตรงเส้นอีกนิดนะ');
      beep(720, 0.03, 0.020);
    }

    if(state.combo > state.maxCombo) state.maxCombo = state.combo;

    state.events.push({
      eventType: 'note_result',
      ts: Date.now(),
      noteId: note.id,
      action: note.action,
      hitTimeMs: Math.round(note.hitTime),
      inputElapsedMs: Math.round(elapsed),
      offsetMs: Math.round(offset),
      result,
      combo: state.combo,
      score: Math.round(state.score),
      patternLabel: note.patternLabel,
      segmentId: note.segmentId
    });

    return true;
  }

  function registerMiss(note){
    if(note.judged) return;
    note.judged = true;
    note.result = 'miss';
    note.offsetMs = null;
    state.judgedNotes += 1;
    state.miss += 1;
    state.combo = 0;

    if(note.el){
      note.el.classList.add('is-miss');
      setTimeout(() => { if(note.el) note.el.style.display = 'none'; }, 180);
    }

    state.events.push({
      eventType: 'note_result',
      ts: Date.now(),
      noteId: note.id,
      action: note.action,
      hitTimeMs: Math.round(note.hitTime),
      inputElapsedMs: null,
      offsetMs: null,
      result: 'miss',
      combo: 0,
      score: Math.round(state.score),
      patternLabel: note.patternLabel,
      segmentId: note.segmentId
    });

    if(performance.now() - state.lastCoachAt > 500){
      setCoach('ไม่เป็นไร ลองฟังจังหวะก่อนแล้วค่อยกดนะ');
      state.lastCoachAt = performance.now();
    }
  }

  function handleInput(action){
    if(state.ended) return;
    const now = performance.now();

    if(!state.started){
      ensureAudio();
      if(state.audioCtx && state.audioCtx.state === 'suspended'){
        state.audioCtx.resume().catch(() => {});
      }
      return;
    }

    const elapsed = now - state.startAt;
    const seg = getSegmentAt(elapsed);

    pressPad(action);
    flashLane(action);

    if(seg && seg.type === 'breath'){
      setCoach('ตอนนี้พักหายใจก่อนนะ');
      showFeedback('good', 'Breathing time');
      return;
    }

    const note = nearestNote(action, elapsed);
    if(note){
      registerHit(note, elapsed);
    }else{
      state.blankTap += 1;
      if(now - state.lastCoachAt > 550){
        setCoach('ลองรอให้โน้ตแตะเส้นก่อนนะ');
        state.lastCoachAt = now;
      }
      showFeedback('miss', 'Wait for the beat');
      beep(440, 0.02, 0.012);
    }
  }

  function attachInputs(){
    for(const btn of inputButtons){
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', () => handleInput(action));
      btn.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        handleInput(action);
      }, { passive: false });
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
      });
    }

    window.addEventListener('keydown', (ev) => {
      if(ev.repeat) return;
      const action = Object.keys(ACTIONS).find((k) => ACTIONS[k].key === ev.code || ACTIONS[k].alt === ev.code);
      if(action){
        ev.preventDefault();
        handleInput(action);
      }
    });
  }

  function layoutNote(note, elapsed){
    const arenaRect = els.arena.getBoundingClientRect();
    const lineRect = els.hitLine.getBoundingClientRect();

    const lineY = lineRect.top - arenaRect.top + (lineRect.height / 2);
    const laneWidth = arenaRect.width / 4;
    const laneCenterX = (laneWidth * note.lane) + (laneWidth / 2);

    const progress = (elapsed - note.spawnTime) / (note.hitTime - note.spawnTime);
    const clampedProgress = clamp(progress, -0.35, 1.18);
    const startY = 28;
    const y = startY + (lineY - startY) * clampedProgress;
    const scale = 0.88 + clamp(progress, 0, 1) * 0.16;

    note.el.style.left = `${laneCenterX}px`;
    note.el.style.transform = `translate(-50%, ${y}px) scale(${scale})`;

    if(Math.abs(elapsed - note.hitTime) <= WINDOWS.good){
      note.el.classList.add('is-near');
    }else{
      note.el.classList.remove('is-near');
    }

    if(elapsed < note.spawnTime - 120){
      note.el.style.display = 'none';
    }else{
      note.el.style.display = '';
    }
  }

  function buildReplayUrl(){
    const url = new URL(location.href);
    url.searchParams.set('seed', String(Date.now()));
    return url.toString();
  }

  function setPlayHudForSegment(seg){
    els.phaseBanner.textContent = seg.banner;
    els.roundChip.textContent = seg.roundLabel;
    els.segmentLabel.textContent = seg.segmentLabel;
    els.segmentHint.textContent = seg.segmentHint;
    els.breathOverlay.classList.add('hidden');
    state.currentBreathMode = '';
    state.currentPatternId = '';
    setCoach(seg.coach);
  }

  function setBreathHudForSegment(seg){
    els.phaseBanner.textContent = seg.banner;
    els.roundChip.textContent = seg.roundLabel;
    els.segmentLabel.textContent = seg.segmentLabel;
    els.segmentHint.textContent = seg.segmentHint;
    els.patternLabel.textContent = seg.id === 'cooldown' ? 'Cooldown Breathing' : 'Recovery Breathing';
    els.patternHint.textContent = 'หายใจตามวง ไม่ต้องกดปุ่ม';
    els.breathOverlay.classList.remove('hidden');
    state.currentPatternId = '';
    setCoach(seg.coach);
  }

  function onSegmentChange(seg){
    if(!seg || state.currentSegmentId === seg.id) return;
    state.currentSegmentId = seg.id;
    if(seg.type === 'play') setPlayHudForSegment(seg);
    else setBreathHudForSegment(seg);
  }

  function updatePatternHud(elapsed, seg){
    if(!seg || seg.type !== 'play') return;

    const nextNote = state.notes.find((n) =>
      !n.judged &&
      n.segmentId === seg.id &&
      elapsed <= n.hitTime + WINDOWS.good + 40
    );
    if(!nextNote) return;

    if(state.currentPatternId !== nextNote.patternId){
      state.currentPatternId = nextNote.patternId;
      els.patternLabel.textContent = nextNote.patternSeqText || nextNote.patternLabel;
      els.patternHint.textContent = nextNote.patternHint || 'ตีตามลำดับที่เห็น';
    }
  }

  function updateBreathOverlay(elapsed, seg){
    if(!seg || seg.type !== 'breath') return;

    const local = elapsed - seg.start;
    const cycleMs = seg.breathCycleMs || 3200;
    const phaseMs = local % cycleMs;
    const inhaleMs = cycleMs * 0.5;
    const mode = phaseMs < inhaleMs ? 'inhale' : 'exhale';
    const remainSec = Math.max(0, Math.ceil((seg.end - elapsed) / 1000));

    if(state.currentBreathMode !== mode){
      state.currentBreathMode = mode;
      if(mode === 'inhale'){
        beep(520, 0.04, 0.010);
      }else{
        beep(420, 0.04, 0.010);
      }
    }

    els.breathAction.textContent = mode === 'inhale' ? 'หายใจเข้า' : 'หายใจออก';
    els.breathHint.textContent = mode === 'inhale'
      ? 'ขยายอกช้า ๆ แล้วเตรียมผ่อนลม'
      : 'ผ่อนลมหายใจออกยาว ๆ';
    els.breathCircle.className = `breath-circle ${mode}`;
    els.breathCount.textContent = `${remainSec}s`;
  }

  function updateCountdown(now){
    const remain = state.startAt - now;
    if(remain <= 0){
      els.countdownLayer.classList.add('hidden');
      if(!state.started){
        state.started = true;
        const firstSeg = state.segments[0];
        onSegmentChange(firstSeg);
        ensureAudio();
        if(state.audioCtx && state.audioCtx.state === 'suspended'){
          state.audioCtx.resume().catch(() => {});
        }
      }
      return;
    }

    const sec = Math.ceil(remain / 1000);
    els.countdownNum.textContent = String(sec);
    if(sec === 3) els.phaseBanner.textContent = 'Ready';
    if(sec === 2) els.phaseBanner.textContent = 'Set';
    if(sec === 1) els.phaseBanner.textContent = 'Go Soon';
  }

  function computeBalanceText(){
    const jab = state.actions.jab;
    const cross = state.actions.cross;
    const block = state.actions.block;
    const duck = state.actions.duck;

    const punchTotal = jab + cross;
    const defendTotal = block + duck;

    let msg1 = 'สมดุลดี';
    let msg2 = '';

    if(punchTotal > 0){
      const punchDiff = Math.abs(jab - cross) / punchTotal;
      if(punchDiff < 0.12) msg1 = 'Jab และ Cross สมดุลดีมาก';
      else if(jab > cross) msg1 = 'วันนี้ใช้ Jab มากกว่า Cross';
      else msg1 = 'วันนี้ใช้ Cross มากกว่า Jab';
    }

    if(defendTotal > 0){
      const defendDiff = Math.abs(block - duck) / defendTotal;
      if(defendDiff < 0.18) msg2 = 'Block และ Duck กระจายดี';
      else if(block > duck) msg2 = 'ใช้ Block มากกว่า Duck';
      else msg2 = 'ใช้ Duck มากกว่า Block';
    } else {
      msg2 = 'รอบหน้าเพิ่ม Block และ Duck อีกนิด';
    }

    return `${msg1} • ${msg2}`;
  }

  function computeCoachSummary(acc){
    if(acc >= 90) return 'เยี่ยมมาก! วันนี้ทั้งแม่นจังหวะ เล่นคอมโบได้ดี และคุมรอบพักได้สวยมาก';
    if(acc >= 82) return 'ดีมากเลย คอมโบเริ่มนิ่งแล้ว รอบหน้าลองเก็บ Perfect เพิ่มอีกนิด';
    if(state.miss > Math.max(8, state.totalNotes * 0.18)) return 'ลองมองลำดับ pattern ให้ชัด แล้วรอให้โน้ตแตะเส้นก่อนกด';
    if(state.blankTap > Math.max(6, state.totalNotes * 0.12)) return 'วันนี้มีการกดเร็วไปนิด ลองรอจังหวะให้ชัดก่อน จะช่วยให้ pattern ต่อเนื่องขึ้น';
    return 'ทำได้ดีมาก จังหวะเริ่มนิ่งแล้ว และเล่นเป็น session ได้ต่อเนื่องขึ้นมาก';
  }

  function computeGrade(acc){
    if(acc >= 92) return 'S';
    if(acc >= 84) return 'A';
    if(acc >= 72) return 'B';
    if(acc >= 60) return 'C';
    return 'D';
  }

  function saveSummary(summary){
    try{
      localStorage.setItem(STORAGE_LAST, JSON.stringify(summary));
      const arr = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
      arr.unshift(summary);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(arr.slice(0, 30)));
    }catch(_){}
  }

  function endGame(){
    if(state.ended) return;
    state.ended = true;
    els.phaseBanner.textContent = 'Summary';
    els.breathOverlay.classList.add('hidden');

    const acc = computeAccuracyPercent();
    const coach = computeCoachSummary(acc);
    const grade = computeGrade(acc);
    const balanceText = computeBalanceText();

    const summary = {
      gameId: params.gameId,
      zone: params.zone,
      pid: params.pid,
      nick: params.nick,
      mode: params.mode,
      diff: params.diff,
      bpm: params.bpm,
      durationSec: params.durSec,
      seed: params.seed,
      run: params.run,
      score: Math.round(state.score),
      accuracy: acc,
      maxCombo: state.maxCombo,
      perfect: state.perfect,
      great: state.great,
      good: state.good,
      miss: state.miss,
      blankTap: state.blankTap,
      jab: state.actions.jab,
      cross: state.actions.cross,
      block: state.actions.block,
      duck: state.actions.duck,
      coach,
      grade,
      balanceText,
      studyId: params.studyId,
      phase: params.phase,
      conditionGroup: params.conditionGroup,
      ts: Date.now()
    };

    saveSummary(summary);

    els.sumScore.textContent = String(summary.score);
    els.sumAcc.textContent = `${summary.accuracy}%`;
    els.sumCombo.textContent = String(summary.maxCombo);
    els.sumTime.textContent = `${summary.durationSec}s`;
    els.sumPerfect.textContent = String(summary.perfect);
    els.sumGreat.textContent = String(summary.great);
    els.sumGood.textContent = String(summary.good);
    els.sumMiss.textContent = String(summary.miss);
    els.sumJab.textContent = String(summary.jab);
    els.sumCross.textContent = String(summary.cross);
    els.sumBlock.textContent = String(summary.block);
    els.sumDuck.textContent = String(summary.duck);
    els.sumBalance.textContent = summary.balanceText;
    els.sumCoach.textContent = summary.coach;
    els.summarySub.textContent = `${params.mode.toUpperCase()} • ${params.diff.toUpperCase()} • ${params.bpm} BPM`;
    els.summaryGrade.textContent = grade;
    els.btnReplay.href = buildReplayUrl();

    els.summaryOverlay.classList.remove('hidden');
  }

  function tick(now){
    updateCountdown(now);
    clearFeedback(now);

    if(!state.started){
      updateHUD(0);
      requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - state.startAt;
    const seg = getSegmentAt(elapsed);
    onSegmentChange(seg);

    if(seg && seg.type === 'play'){
      const nextBeat = Math.floor(elapsed / beatMs);
      if(nextBeat > state.beatIndex){
        state.beatIndex = nextBeat;
        pulseArena();
        if(nextBeat >= 0){
          beep(620, 0.025, 0.013);
        }
      }
    }

    for(const note of state.notes){
      if(note.judged) continue;

      if(elapsed > note.hitTime + WINDOWS.good){
        registerMiss(note);
        continue;
      }

      if(note.el){
        layoutNote(note, elapsed);
      }
    }

    if(seg && seg.type === 'breath'){
      updateBreathOverlay(elapsed, seg);
    } else {
      els.breathOverlay.classList.add('hidden');
      updatePatternHud(elapsed, seg);
    }

    updateHUD(elapsed);

    if(elapsed >= totalMs){
      endGame();
      return;
    }

    requestAnimationFrame(tick);
  }

  function boot(){
    buildSegments();
    buildNotes();
    attachInputs();
    updateHUD(0);

    els.phaseBanner.textContent = 'Ready';
    els.patternLabel.textContent = 'Warmup • Jab';
    els.patternHint.textContent = 'ค่อย ๆ จับลำดับก่อน';
    els.roundChip.textContent = 'Round 0 • Warmup';
    els.segmentLabel.textContent = 'Warmup';
    els.segmentHint.textContent = 'ค่อย ๆ จับจังหวะก่อน';
    setCoach('ฟังจังหวะ แล้วกดตอนโน้ตแตะเส้นล่างนะ');

    if(params.audio){
      ensureAudio();
    }

    requestAnimationFrame(tick);
  }

  boot();
})();