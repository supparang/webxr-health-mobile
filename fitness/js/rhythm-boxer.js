// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer — PRODUCTION SAFE (MVP) — Planner/Research ready
// FULL v20260302-RB-SAFE-MVP
'use strict';

(function(){
  const W = window, D = document;

  // --------------------------- helpers ---------------------------
  const qs = (k, d='')=>{
    try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; }
  };
  const qbool = (k, d=false)=>{
    const v = String(qs(k, d?'1':'0')).toLowerCase();
    return ['1','true','yes','y','on'].includes(v);
  };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const rand = (seed)=>{
    // xorshift32
    let x = (seed|0) || 123456789;
    return ()=>{
      x ^= x << 13; x |= 0;
      x ^= x >>> 17; x |= 0;
      x ^= x << 5; x |= 0;
      return ((x>>>0) / 4294967296);
    };
  };
  const median = (arr)=>{
    if(!arr || !arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
  };
  const mean = (arr)=>{
    if(!arr || !arr.length) return null;
    let s=0; for(const x of arr) s+=x;
    return s/arr.length;
  };
  const std = (arr)=>{
    if(!arr || arr.length<2) return null;
    const m = mean(arr);
    let s=0;
    for(const x of arr){ const d=x-m; s += d*d; }
    return Math.sqrt(s/(arr.length-1));
  };

  function $(id){ return D.getElementById(id); }

  // --------------------------- params ---------------------------
  const RUN = String(qs('run','play')).toLowerCase(); // play|research (planner may pass)
  const DIFF = String(qs('diff','normal')).toLowerCase();
  const TIME_SEC = clamp(qs('time','80'), 20, 300);
  const SEED = Number(qs('seed', String(Date.now()))) || Date.now();
  const PID = String(qs('pid','')).trim() || 'anon';

  const HUB = String(qs('hub','')).trim(); // optional planner/hub
  const PLAN_DAY = String(qs('planDay','')).trim();
  const PLAN_SLOT = String(qs('planSlot','')).trim();

  // --------------------------- DOM refs ---------------------------
  const VIEW_MENU = $('rb-view-menu');
  const VIEW_PLAY = $('rb-view-play');
  const VIEW_RESULT = $('rb-view-result');

  const BTN_START = $('rb-btn-start');
  const BTN_STOP  = $('rb-btn-stop');
  const BTN_AGAIN = $('rb-btn-again');
  const BTN_BACK_MENU = $('rb-btn-back-menu');
  const BTN_DL_EVENTS = $('rb-btn-dl-events');
  const BTN_DL_SESS = $('rb-btn-dl-sessions');

  const MODE_DESC = $('rb-mode-desc');
  const RESEARCH_FIELDS = $('rb-research-fields');
  const IN_PART = $('rb-participant');
  const IN_GROUP = $('rb-group');
  const IN_NOTE = $('rb-note');

  const HUD_MODE = $('rb-hud-mode');
  const HUD_TRACK = $('rb-hud-track');
  const HUD_SCORE = $('rb-hud-score');
  const HUD_COMBO = $('rb-hud-combo');
  const HUD_ACC = $('rb-hud-acc');

  const HUD_AI_FAT = $('rb-hud-ai-fatigue');
  const HUD_AI_SKILL = $('rb-hud-ai-skill');
  const HUD_AI_SUGG = $('rb-hud-ai-suggest');
  const HUD_AI_TIP = $('rb-hud-ai-tip');

  const HUD_HP = $('rb-hud-hp');
  const HUD_SHIELD = $('rb-hud-shield');
  const HUD_TIME = $('rb-hud-time');

  const HUD_PERF = $('rb-hud-perfect');
  const HUD_GREAT = $('rb-hud-great');
  const HUD_GOOD = $('rb-hud-good');
  const HUD_MISS = $('rb-hud-miss');

  const FEVER_FILL = $('rb-fever-fill');
  const FEVER_STATUS = $('rb-fever-status');
  const PROG_FILL = $('rb-progress-fill');
  const PROG_TEXT = $('rb-progress-text');

  const FEEDBACK = $('rb-feedback');
  const LANES_WRAP = $('rb-lanes');

  const RES_MODE = $('rb-res-mode');
  const RES_TRACK = $('rb-res-track');
  const RES_END = $('rb-res-endreason');
  const RES_SCORE = $('rb-res-score');
  const RES_MAXCOMBO = $('rb-res-maxcombo');
  const RES_DETAIL_HIT = $('rb-res-detail-hit');
  const RES_ACC = $('rb-res-acc');
  const RES_DUR = $('rb-res-duration');
  const RES_RANK = $('rb-res-rank');
  const RES_OFF_AVG = $('rb-res-offset-avg');
  const RES_OFF_STD = $('rb-res-offset-std');
  const RES_PART = $('rb-res-participant');
  const RES_QUALITY_NOTE = $('rb-res-quality-note');

  // safety
  if(!VIEW_MENU || !VIEW_PLAY || !VIEW_RESULT || !BTN_START || !LANES_WRAP){
    console.warn('[RB] Missing essential DOM nodes. Check HTML ids.');
  }

  // --------------------------- HUD top planner pill (optional) ---------------------------
  (function patchPlanHud(){
    const elDay = D.getElementById('hhDay');
    const elSlot = D.getElementById('hhSlot');
    if(elDay) elDay.textContent = PLAN_DAY ? PLAN_DAY : '—';
    if(elSlot) elSlot.textContent = PLAN_SLOT ? PLAN_SLOT : '—';

    // back button (if present)
    const btnBack = D.getElementById('hhBack');
    if(btnBack){
      btnBack.addEventListener('click', ()=>{
        if(HUB){
          try{ location.href = new URL(HUB, location.href).toString(); }
          catch{ location.href = HUB; }
        }else{
          history.back();
        }
      });
    }

    // menu back link (if present)
    const backLink = D.getElementById('rb-back-link');
    if(backLink){
      if(HUB){
        try{ backLink.href = new URL(HUB, location.href).toString(); }catch{ backLink.href = HUB; }
      }
      backLink.addEventListener('click', (e)=>{
        if(HUB){
          e.preventDefault();
          try{ location.href = new URL(HUB, location.href).toString(); }
          catch{ location.href = HUB; }
        }
      }, {passive:false});
    }
  })();

  // --------------------------- tracks ---------------------------
  // lanes: 0..4 => L2 L1 C R1 R2
  const TRACKS = {
    n1: { key:'n1', name:'Warm-up Groove', bpm:100, density:0.72, jitter:0.10, feverRate:1.00, missDmg:4, blankPenalty:1 },
    n2: { key:'n2', name:'Focus Combo',   bpm:120, density:0.90, jitter:0.12, feverRate:1.05, missDmg:5, blankPenalty:1 },
    n3: { key:'n3', name:'Speed Rush',    bpm:140, density:1.10, jitter:0.14, feverRate:1.10, missDmg:6, blankPenalty:2 },
    r1: { key:'r1', name:'Research 120',  bpm:120, density:0.88, jitter:0.08, feverRate:1.00, missDmg:5, blankPenalty:1, research:true },
  };

  function diffScale(){
    if(DIFF==='easy') return 0.85;
    if(DIFF==='hard') return 1.15;
    return 1.0;
  }

  function getSelectedMode(){
    const el = D.querySelector('input[name="rb-mode"]:checked');
    return el ? String(el.value||'normal') : 'normal';
  }
  function getSelectedTrack(){
    const el = D.querySelector('input[name="rb-track"]:checked');
    const key = el ? String(el.value||'n1') : 'n1';
    return TRACKS[key] ? key : 'n1';
  }

  // --------------------------- state ---------------------------
  const S = {
    running:false,
    mode:'normal',
    trackKey:'n1',
    t0:0,
    tEnd:0,
    tLast:0,
    seed: SEED,
    rng: rand(SEED|0),

    // gameplay
    score:0,
    combo:0,
    maxCombo:0,
    shots:0,
    hits:0,
    perfect:0,
    great:0,
    good:0,
    miss:0,
    hp:100,
    shield:0,     // blocks one miss
    fever:0,      // 0..100
    feverOn:false,
    lastJudge:'READY',

    // timing
    offsets: [], // ms (signed)
    tapTimes: [], // ms timestamps
    blankTaps:0,

    // engine
    notes: [], // active notes {id, lane, tHit, spawned, hit, miss, el}
    nextId:1,

    // logging
    events: [],
    sessions: [],

    // AI
    ai: { fatigue:0, skill:0.5, suggest:'normal', tip:'' },
    aiLastTipAt:0,

    // end reason
    endReason:'timeup',
  };

  // --------------------------- UI: mode toggle visibility ---------------------------
  function refreshModeUI(){
    const mode = getSelectedMode();
    S.mode = mode;

    if(mode==='research'){
      if(RESEARCH_FIELDS) RESEARCH_FIELDS.classList.remove('hidden');
      if(MODE_DESC) MODE_DESC.textContent = 'Research: เก็บข้อมูล Event/Session เพื่อวิเคราะห์ (แนะนำกรอก Participant ID)';
    }else{
      if(RESEARCH_FIELDS) RESEARCH_FIELDS.classList.add('hidden');
      if(MODE_DESC) MODE_DESC.textContent = 'Normal: เล่นสนุก / ใช้สอนทั่วไป (ไม่จำเป็นต้องกรอกข้อมูลผู้เข้าร่วม)';
    }

    // show only matching track options (simple)
    const lab = $('rb-track-mode-label');
    if(lab){
      lab.textContent = (mode==='research')
        ? 'โหมด Research — เพลงมาตรฐาน 1 ชุด (ควบคุมเงื่อนไข)'
        : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    // disable/enable track radios by data-mode (optional)
    const opts = D.querySelectorAll('#rb-track-options .rb-mode-btn');
    opts.forEach(o=>{
      const m = String(o.getAttribute('data-mode')||'normal');
      const input = o.querySelector('input[type="radio"]');
      if(!input) return;
      const allow = (m===mode);
      input.disabled = !allow;
      o.style.opacity = allow ? '1' : '0.45';
      o.style.pointerEvents = allow ? 'auto' : 'none';
    });

    // if current selection is disabled, auto-pick
    const chosen = getSelectedTrack();
    const chosenMeta = TRACKS[chosen];
    if(mode==='research' && !chosenMeta.research){
      // select r1
      const r = D.querySelector('input[name="rb-track"][value="r1"]');
      if(r) r.checked = true;
    }
    if(mode==='normal' && chosenMeta.research){
      const n = D.querySelector('input[name="rb-track"][value="n1"]');
      if(n) n.checked = true;
    }
  }

  // --------------------------- view switching ---------------------------
  function showView(name){
    const set = (el, on)=>{ if(!el) return; el.classList.toggle('hidden', !on); };
    set(VIEW_MENU, name==='menu');
    set(VIEW_PLAY, name==='play');
    set(VIEW_RESULT, name==='result');
  }

  // --------------------------- feedback / flash ---------------------------
  function setFeedback(msg){
    if(!FEEDBACK) return;
    FEEDBACK.textContent = msg || '';
  }
  function flash(){
    const f = $('rb-flash');
    if(!f) return;
    f.style.opacity = '0.85';
    setTimeout(()=>{ f.style.opacity = '0'; }, 70);
  }

  // --------------------------- note rendering ---------------------------
  function laneEls(){
    return Array.from(D.querySelectorAll('.rb-lane'));
  }
  function makeNoteEl(laneIndex){
    const lane = laneEls()[laneIndex];
    if(!lane) return null;
    const el = D.createElement('div');
    el.className = 'rb-note';
    // fallback style if css missing
    el.style.position = 'absolute';
    el.style.left = '10%';
    el.style.right = '10%';
    el.style.top = '-14px';
    el.style.height = '14px';
    el.style.borderRadius = '10px';
    el.style.background = 'rgba(255,255,255,.85)';
    el.style.boxShadow = '0 8px 20px rgba(0,0,0,.25)';
    el.style.pointerEvents = 'none';
    lane.style.position = lane.style.position || 'relative';
    lane.appendChild(el);
    return el;
  }
  function removeNoteEl(note){
    if(note && note.el && note.el.parentNode){
      note.el.parentNode.removeChild(note.el);
    }
    note.el = null;
  }

  // --------------------------- judge windows (ms) ---------------------------
  function judgeWindows(){
    // tighter on hard
    const base = (DIFF==='hard') ? 70 : (DIFF==='easy' ? 95 : 82);
    return {
      perfect: base,
      great: base * 1.55,
      good: base * 2.40,
    };
  }

  function addScore(judge){
    // fever boosts
    const feverMult = S.feverOn ? 1.25 : 1.0;
    let add = 0;
    if(judge==='Perfect') add = 120;
    else if(judge==='Great') add = 85;
    else if(judge==='Good') add = 50;
    else add = 0;

    // combo bonus
    const comboBonus = Math.min(60, Math.floor(S.combo/10)*10);
    S.score += Math.round((add + comboBonus) * feverMult);
  }

  function addFever(judge, track){
    const rate = (track.feverRate || 1.0) * diffScale();
    let inc = 0;
    if(judge==='Perfect') inc = 9;
    else if(judge==='Great') inc = 6;
    else if(judge==='Good') inc = 3;
    else inc = 0;
    S.fever = clamp(S.fever + inc*rate, 0, 100);
    if(S.fever >= 100){
      S.feverOn = true;
      S.fever = 100;
    }
  }
  function drainFever(dt){
    if(!S.feverOn) return;
    // drain while active
    S.fever = clamp(S.fever - dt*0.022, 0, 100); // ~45s full drain
    if(S.fever <= 0){
      S.feverOn = false;
      S.fever = 0;
    }
  }

  function applyMissDamage(track){
    if(S.shield > 0){
      S.shield -= 1;
      // still counts as miss? (we count miss but no HP loss) — keep fair
      return;
    }
    const dmg = (track.missDmg || 5) * diffScale();
    S.hp = clamp(S.hp - dmg, 0, 100);
  }

  function maybeGainShield(){
    // reward long streak
    if(S.combo>0 && S.combo % 30 === 0){
      S.shield = clamp(S.shield + 1, 0, 3);
    }
  }

  // --------------------------- AI predictor (safe) ---------------------------
  function updateAI(now){
    // fatigue: based on tap rate + miss streak + HP drop
    const horizonMs = 12000;
    const recent = S.tapTimes.filter(t => (now - t) <= horizonMs);
    const tapsPerSec = recent.length / (horizonMs/1000);

    const missRate = (S.shots>0) ? (S.miss / S.shots) : 0;
    const acc = (S.shots>0) ? (S.hits / S.shots) : 0;

    // skill: accuracy + timing stability
    const offAbs = S.offsets.slice(-20).map(x=>Math.abs(x));
    const offMed = median(offAbs);
    let timingScore = 0.5;
    if(offMed!=null){
      timingScore = clamp(1 - (offMed/160), 0, 1);
    }

    const skill = clamp(0.25*acc + 0.75*timingScore, 0, 1);

    // fatigue proxy
    const hpLoss = (100 - S.hp) / 100;
    const fatigue = clamp(0.25*hpLoss + 0.35*missRate + 0.25*(tapsPerSec/6) + 0.15*(S.blankTaps/Math.max(1,S.shots)), 0, 1);

    // suggest diff
    let suggest = 'normal';
    if(fatigue > 0.72) suggest = 'easy';
    else if(skill > 0.78 && fatigue < 0.45) suggest = 'hard';

    // coach tip (rate-limited)
    let tip = '';
    const tSince = now - S.aiLastTipAt;
    if(tSince > 6000){
      if(S.blankTaps >= 6 && (S.blankTaps/Math.max(1,S.shots)) > 0.22){
        tip = 'ลอง “รอหัวโน้ตถึงเส้นเหลือง” ก่อนค่อยกด จะได้ไม่กดล่วงหน้า';
      }else if(offMed!=null && offMed > 95){
        tip = 'จังหวะยังแกว่งนิดนึง — ลอง “หายใจเข้า-ออก” แล้วกดตามเสียง/ภาพให้ช้าลงเล็กน้อย';
      }else if(S.combo>0 && S.combo % 20 === 0){
        tip = 'ดีมาก! คอมโบสูงแล้ว — รักษาจังหวะเดิมไว้';
      }else if(fatigue>0.7){
        tip = 'ถ้าเริ่มล้า ให้พักมือ 5 วินาที แล้วกลับมาลุยต่อ';
      }
      if(tip){
        S.aiLastTipAt = now;
        S.ai.tip = tip;
      }
    }

    S.ai.fatigue = fatigue;
    S.ai.skill = skill;
    S.ai.suggest = suggest;

    if(HUD_AI_FAT) HUD_AI_FAT.textContent = `${Math.round(fatigue*100)}%`;
    if(HUD_AI_SKILL) HUD_AI_SKILL.textContent = `${Math.round(skill*100)}%`;
    if(HUD_AI_SUGG) HUD_AI_SUGG.textContent = suggest;
    if(HUD_AI_TIP){
      if(S.ai.tip){
        HUD_AI_TIP.classList.remove('hidden');
        HUD_AI_TIP.textContent = S.ai.tip;
      }else{
        HUD_AI_TIP.classList.add('hidden');
        HUD_AI_TIP.textContent = '';
      }
    }
  }

  // --------------------------- logging ---------------------------
  function logEvent(ev){
    // minimize in normal
    if(S.mode!=='research') return;
    S.events.push(ev);
  }
  function sessionMeta(){
    return {
      tsIso: nowIso(),
      pid: PID,
      participant: (IN_PART && IN_PART.value) ? String(IN_PART.value).trim() : '',
      group: (IN_GROUP && IN_GROUP.value) ? String(IN_GROUP.value).trim() : '',
      note: (IN_NOTE && IN_NOTE.value) ? String(IN_NOTE.value).trim() : '',
      planDay: PLAN_DAY,
      planSlot: PLAN_SLOT,
      diff: DIFF,
      run: RUN,
      seed: String(S.seed),
      track: S.trackKey,
      mode: S.mode,
    };
  }
  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const a = D.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    D.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }
  function toCSV(rows, cols){
    const esc = (v)=>{
      v = (v===undefined || v===null) ? '' : String(v);
      if(/[",\n]/.test(v)) return `"${v.replace(/"/g,'""')}"`;
      return v;
    };
    const head = cols.join(',');
    const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  // --------------------------- engine: generate chart ---------------------------
  function buildSchedule(track, durSec){
    // Deterministic schedule: 5 lanes, beat-based
    const t = TRACKS[track];
    const bpm = t.bpm;
    const beatMs = 60000 / bpm;
    const baseStep = beatMs / 2; // 8th notes
    const density = (t.density || 0.9) * diffScale();
    const jitter = (t.jitter || 0.1);

    const r = S.rng;
    const notes = [];
    let tt = 1400; // start after 1.4s
    let lastLane = 2;

    while(tt < durSec*1000 - 900){
      // maybe spawn this step
      const p = clamp(density, 0.35, 1.35);
      const spawn = (r() < Math.min(0.92, p));
      if(spawn){
        // choose lane with slight anti-repeat
        let lane = Math.floor(r()*5);
        if(lane===lastLane && r()<0.6) lane = (lane + 1 + Math.floor(r()*3)) % 5;
        lastLane = lane;

        // add jitter ms (for normal; for research keep tighter)
        let j = (r()*2-1) * jitter * baseStep;
        if(t.research) j *= 0.4;

        notes.push({ lane, tHit: tt + j });
      }
      // occasionally add double notes (challenge)
      if(!t.research && r() < 0.10 * density){
        const lane2 = (lastLane + (r()<0.5?2:3))%5;
        notes.push({ lane: lane2, tHit: tt + 60 });
      }

      tt += baseStep;
    }
    return notes;
  }

  // --------------------------- play lifecycle ---------------------------
  function resetStateForRun(){
    S.running = false;
    S.t0 = 0;
    S.tEnd = 0;
    S.tLast = 0;

    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.shots = 0;
    S.hits = 0;

    S.perfect = 0;
    S.great = 0;
    S.good = 0;
    S.miss = 0;

    S.hp = 100;
    S.shield = 0;
    S.fever = 0;
    S.feverOn = false;
    S.lastJudge = 'READY';

    S.offsets = [];
    S.tapTimes = [];
    S.blankTaps = 0;

    S.notes = [];
    S.nextId = 1;

    S.endReason = 'timeup';

    // clear lane DOM notes
    laneEls().forEach(l=>{
      // remove any rb-note children
      Array.from(l.querySelectorAll('.rb-note')).forEach(n=>n.remove());
    });

    // clear AI tip
    S.ai = { fatigue:0, skill:0.5, suggest:'normal', tip:'' };
    S.aiLastTipAt = 0;
  }

  function updateHUD(now){
    const acc = (S.shots>0) ? (S.hits/S.shots*100) : 0;

    if(HUD_MODE) HUD_MODE.textContent = (S.mode==='research' ? 'Research' : 'Normal');
    if(HUD_TRACK) HUD_TRACK.textContent = TRACKS[S.trackKey].name;

    if(HUD_SCORE) HUD_SCORE.textContent = String(Math.round(S.score));
    if(HUD_COMBO) HUD_COMBO.textContent = String(S.combo);
    if(HUD_ACC) HUD_ACC.textContent = `${acc.toFixed(1)}%`;

    if(HUD_HP) HUD_HP.textContent = String(Math.round(S.hp));
    if(HUD_SHIELD) HUD_SHIELD.textContent = String(S.shield);

    const t = (now - S.t0)/1000;
    if(HUD_TIME) HUD_TIME.textContent = t.toFixed(1);

    if(HUD_PERF) HUD_PERF.textContent = String(S.perfect);
    if(HUD_GREAT) HUD_GREAT.textContent = String(S.great);
    if(HUD_GOOD) HUD_GOOD.textContent = String(S.good);
    if(HUD_MISS) HUD_MISS.textContent = String(S.miss);

    // fever bar
    if(FEVER_FILL){
      FEVER_FILL.style.width = `${clamp(S.fever,0,100)}%`;
      FEVER_FILL.style.opacity = S.feverOn ? '1' : '0.85';
      FEVER_FILL.style.filter = S.feverOn ? 'brightness(1.15)' : 'none';
    }
    if(FEVER_STATUS){
      FEVER_STATUS.textContent = S.feverOn ? 'ON' : (S.fever>=100 ? 'READY' : 'BUILD');
    }

    // progress
    const prog = clamp((now - S.t0) / (S.tEnd - S.t0), 0, 1);
    if(PROG_FILL) PROG_FILL.style.width = `${Math.round(prog*100)}%`;
    if(PROG_TEXT) PROG_TEXT.textContent = `${Math.round(prog*100)}%`;
  }

  function spawnNotes(schedule){
    // map schedule -> active notes with DOM elements created on demand
    S.notes = schedule.map(n => ({
      id: S.nextId++,
      lane: n.lane,
      tHit: n.tHit,
      spawned: false,
      hit: false,
      miss: false,
      el: null
    }));
  }

  function noteTravelMs(){
    // how long a note takes to fall to hit line
    // faster on hard
    if(DIFF==='hard') return 1050;
    if(DIFF==='easy') return 1250;
    return 1150;
  }

  function renderNotes(now){
    const travel = noteTravelMs();
    const lanes = laneEls();
    if(!lanes.length) return;

    // compute lane rect once
    const laneRect = lanes[0].getBoundingClientRect();
    const laneH = laneRect.height || 240;
    const hitY = laneH * 0.82; // hit line near bottom

    for(const note of S.notes){
      if(note.hit || note.miss) continue;

      const tRel = (now - S.t0);         // ms since start
      const dtToHit = note.tHit - tRel;  // ms until hit line
      const y = hitY - (dtToHit / travel) * hitY;

      // spawn when near top
      if(!note.spawned && dtToHit < travel){
        note.spawned = true;
        note.el = makeNoteEl(note.lane);
      }

      if(note.el){
        // clamp y
        const yy = clamp(y, -24, hitY + 80);
        note.el.style.transform = `translateY(${yy}px)`;

        // miss if passes window
        const win = judgeWindows().good;
        if(dtToHit < -win){
          note.miss = true;
          removeNoteEl(note);

          // stats
          S.shots += 1;
          S.miss += 1;
          S.combo = 0;
          setFeedback('MISS');
          applyMissDamage(TRACKS[S.trackKey]);

          logEvent({
            ...sessionMeta(),
            kind:'event',
            tMs: Math.round(tRel),
            lane: note.lane,
            action:'auto_miss',
            judge:'Miss',
            offsetMs: Math.round(dtToHit),
            score: Math.round(S.score),
            combo: S.combo,
            hp: Math.round(S.hp),
            fever: Math.round(S.fever),
            shield: S.shield,
            tsIso: nowIso(),
          });

          flash();
        }
      }
    }
  }

  function findNearestNote(lane, now){
    // choose the note in lane with smallest |dt|
    const tRel = (now - S.t0);
    let best = null;
    let bestAbs = 1e9;
    for(const n of S.notes){
      if(n.lane !== lane) continue;
      if(n.hit || n.miss) continue;
      if(!n.spawned) continue;
      const dt = n.tHit - tRel;
      const a = Math.abs(dt);
      if(a < bestAbs){
        bestAbs = a;
        best = { note:n, dt };
      }
    }
    return best;
  }

  function handleTap(lane, source){
    if(!S.running) return;
    const now = nowMs();
    const tRel = now - S.t0;

    S.tapTimes.push(now);
    // keep recent
    if(S.tapTimes.length > 300) S.tapTimes.splice(0, S.tapTimes.length-300);

    const found = findNearestNote(lane, now);
    const win = judgeWindows();

    let judge = 'Miss';
    let dt = 9999;
    let blank = false;

    if(found){
      dt = found.dt;
      const adt = Math.abs(dt);
      if(adt <= win.perfect) judge = 'Perfect';
      else if(adt <= win.great) judge = 'Great';
      else if(adt <= win.good) judge = 'Good';
      else judge = 'Miss';

      if(judge !== 'Miss'){
        // register hit
        found.note.hit = true;
        removeNoteEl(found.note);

        S.shots += 1;
        S.hits += 1;

        if(judge==='Perfect') S.perfect += 1;
        else if(judge==='Great') S.great += 1;
        else S.good += 1;

        S.combo += 1;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        addScore(judge);
        addFever(judge, TRACKS[S.trackKey]);
        maybeGainShield();

        setFeedback(judge.toUpperCase());
        flash();

        S.offsets.push(dt);
        if(S.offsets.length > 400) S.offsets.splice(0, S.offsets.length-400);

      }else{
        // miss (late/early too far) — treat as miss and consume note if passed?
        // we DO NOT consume the note (so player can still hit next), but count a "blank" to discourage spam
        blank = true;
      }
    }else{
      blank = true;
    }

    if(blank){
      S.blankTaps += 1;
      S.shots += 1; // count as shot to affect acc and anti-spam
      S.combo = 0;

      const t = TRACKS[S.trackKey];
      const pen = (t.blankPenalty || 1) * diffScale();
      S.score = Math.max(0, S.score - pen*8);

      // tiny HP penalty only if spammy
      if(S.blankTaps >= 6 && (S.blankTaps/S.shots) > 0.25){
        S.hp = clamp(S.hp - 1.2, 0, 100);
      }

      setFeedback('MISS');
      flash();
      judge = 'Miss';
      dt = 9999;
    }

    logEvent({
      ...sessionMeta(),
      kind:'event',
      tMs: Math.round(tRel),
      lane,
      action: (blank ? 'blank_tap' : 'tap'),
      source: source || '',
      judge,
      offsetMs: (dt===9999? '' : Math.round(dt)),
      score: Math.round(S.score),
      combo: S.combo,
      hp: Math.round(S.hp),
      fever: Math.round(S.fever),
      shield: S.shield,
      tsIso: nowIso(),
    });
  }

  // --------------------------- input wiring ---------------------------
  function bindInputs(){
    // lane clicks/taps
    LANES_WRAP.addEventListener('pointerdown', (e)=>{
      const laneEl = e.target.closest('.rb-lane');
      if(!laneEl) return;
      const lane = Number(laneEl.getAttribute('data-lane'));
      if(!Number.isFinite(lane)) return;
      handleTap(lane, 'pointer');
    });

    // keyboard A S D J K => 0..4
    const keyMap = { 'a':0, 's':1, 'd':2, 'j':3, 'k':4 };
    W.addEventListener('keydown', (e)=>{
      const k = String(e.key||'').toLowerCase();
      if(!(k in keyMap)) return;
      e.preventDefault();
      handleTap(keyMap[k], 'key');
    }, {passive:false});
  }

  // --------------------------- start/stop/end ---------------------------
  function startGame(){
    refreshModeUI();

    resetStateForRun();

    S.mode = getSelectedMode();
    S.trackKey = getSelectedTrack();

    // deterministic seed per run (respect provided seed)
    S.seed = SEED;
    S.rng = rand((SEED|0) ^ (S.trackKey.charCodeAt(0)<<16) ^ (S.trackKey.charCodeAt(1)<<8));

    // schedule
    const schedule = buildSchedule(S.trackKey, TIME_SEC);
    spawnNotes(schedule);

    // hud
    showView('play');
    setFeedback('พร้อม!');
    if(HUD_AI_TIP){ HUD_AI_TIP.classList.add('hidden'); HUD_AI_TIP.textContent=''; }

    S.running = true;
    S.t0 = nowMs();
    S.tLast = S.t0;
    S.tEnd = S.t0 + TIME_SEC*1000;

    // initial hud
    updateHUD(S.t0);
    updateAI(S.t0);

    // log session start marker
    logEvent({
      ...sessionMeta(),
      kind:'marker',
      marker:'start',
      tsIso: nowIso(),
      durSec: TIME_SEC,
      bpm: TRACKS[S.trackKey].bpm,
      density: TRACKS[S.trackKey].density,
    });

    requestAnimationFrame(tick);
  }

  function stopGame(reason){
    if(!S.running) return;
    S.endReason = reason || 'stop';
    endGame();
  }

  function computeRank(){
    const acc = (S.shots>0) ? (S.hits/S.shots) : 0;
    // include survival
    const survive = S.hp/100;
    const combo = S.maxCombo;

    let score = 0.65*acc + 0.20*survive + 0.15*clamp(combo/80, 0, 1);
    if(S.mode==='research') score *= 0.98; // strict

    if(score >= 0.88) return 'S';
    if(score >= 0.78) return 'A';
    if(score >= 0.68) return 'B';
    if(score >= 0.55) return 'C';
    return 'D';
  }

  function endGame(){
    S.running = false;

    // clear remaining notes DOM
    for(const n of S.notes){
      if(n && n.el) removeNoteEl(n);
    }

    // summary
    const endAt = nowMs();
    const dur = Math.max(0, (endAt - S.t0)/1000);
    const accPct = (S.shots>0) ? (S.hits/S.shots*100) : 0;
    const rank = computeRank();

    const off = S.offsets.filter(x=>Number.isFinite(x));
    const offAbs = off.map(x=>Math.abs(x));
    const offAvg = mean(offAbs);
    const offStd = std(offAbs);

    // populate result UI
    showView('result');
    if(RES_MODE) RES_MODE.textContent = (S.mode==='research' ? 'Research' : 'Normal');
    if(RES_TRACK) RES_TRACK.textContent = TRACKS[S.trackKey].name;
    if(RES_END) RES_END.textContent = S.endReason || 'timeup';
    if(RES_SCORE) RES_SCORE.textContent = String(Math.round(S.score));
    if(RES_MAXCOMBO) RES_MAXCOMBO.textContent = String(S.maxCombo);
    if(RES_DETAIL_HIT) RES_DETAIL_HIT.textContent = `${S.perfect} / ${S.great} / ${S.good} / ${S.miss}`;
    if(RES_ACC) RES_ACC.textContent = `${accPct.toFixed(1)} %`;
    if(RES_DUR) RES_DUR.textContent = `${dur.toFixed(1)} s`;
    if(RES_RANK) RES_RANK.textContent = rank;

    if(RES_OFF_AVG) RES_OFF_AVG.textContent = (offAvg==null ? '-' : `${offAvg.toFixed(1)} ms`);
    if(RES_OFF_STD) RES_OFF_STD.textContent = (offStd==null ? '-' : `${offStd.toFixed(1)} ms`);

    if(RES_PART) RES_PART.textContent = (IN_PART && IN_PART.value) ? String(IN_PART.value).trim() : '-';

    // quality note (research)
    if(RES_QUALITY_NOTE){
      const note = [];
      if(S.blankTaps > 8) note.push('กดล่วงหน้า/กดรัวค่อนข้างเยอะ (blank tap สูง)');
      if(S.hp < 45) note.push('ความล้า/พลาดสูง (HP ต่ำ)');
      if(offAvg!=null && offAvg > 110) note.push('จังหวะยังไม่คงที่ (offset สูง)');
      if(S.mode==='research' && note.length){
        RES_QUALITY_NOTE.classList.remove('hidden');
        RES_QUALITY_NOTE.textContent = 'ข้อสังเกตคุณภาพข้อมูล: ' + note.join(' · ');
      }else{
        RES_QUALITY_NOTE.classList.add('hidden');
        RES_QUALITY_NOTE.textContent = '';
      }
    }

    // save session row (for download)
    const sess = {
      ...sessionMeta(),
      kind:'session',
      endReason: S.endReason,
      durationSec: dur.toFixed(2),
      score: Math.round(S.score),
      maxCombo: S.maxCombo,
      shots: S.shots,
      hits: S.hits,
      accPct: accPct.toFixed(2),
      perfect: S.perfect,
      great: S.great,
      good: S.good,
      miss: S.miss,
      hpEnd: Math.round(S.hp),
      shieldEnd: S.shield,
      feverEnd: Math.round(S.fever),
      offsetAbsMeanMs: (offAvg==null? '' : offAvg.toFixed(2)),
      offsetAbsStdMs: (offStd==null? '' : offStd.toFixed(2)),
      rank,
      tsIsoEnd: nowIso(),
    };
    S.sessions.push(sess);

    // marker end
    logEvent({
      ...sessionMeta(),
      kind:'marker',
      marker:'end',
      endReason: S.endReason,
      durationSec: dur.toFixed(2),
      score: Math.round(S.score),
      accPct: accPct.toFixed(2),
      miss: S.miss,
      tsIso: nowIso(),
    });

    // ✅ If planner/hub expects end callback: call HH_END_GAME if defined and seq flow indicates autoNext
    // We'll only auto-return when explicit autoNext/seq=1 is present to avoid interrupting CSV download.
    const autoNext = (qs('autoNext','0')==='1');
    const hubHasSeq = HUB && String(HUB).includes('seq=1');

    if((autoNext || hubHasSeq) && typeof W.HH_END_GAME === 'function'){
      // short delay so user sees result briefly
      setTimeout(()=>{
        try{
          W.HH_END_GAME('result', { score: sess.score, acc: sess.accPct, miss: sess.miss });
        }catch(_){}
      }, 900);
    }
  }

  function tick(){
    if(!S.running) return;

    const now = nowMs();
    const dt = now - S.tLast;
    S.tLast = now;

    // time end or HP end
    if(now >= S.tEnd){
      S.endReason = 'timeup';
      endGame();
      return;
    }
    if(S.hp <= 0){
      S.endReason = 'hp0';
      endGame();
      return;
    }

    // fever drain
    drainFever(dt);

    // render notes
    renderNotes(now);

    // HUD + AI
    updateHUD(now);
    updateAI(now);

    requestAnimationFrame(tick);
  }

  // --------------------------- result buttons ---------------------------
  function playAgainSame(){
    // return to play with same selection (keep current radios)
    showView('menu');
    // start again quickly
    startGame();
  }

  function backToMenu(){
    showView('menu');
  }

  function downloadEventsCSV(){
    const rows = S.events.slice();
    const cols = [
      'tsIso','pid','participant','group','note','planDay','planSlot','diff','run','seed','track','mode',
      'kind','marker','tMs','lane','action','source','judge','offsetMs','score','combo','hp','fever','shield',
      'bpm','density','durSec','endReason'
    ];
    const csv = toCSV(rows, cols);
    const fn = `rhythm_events_${PID}_${S.trackKey}_${Date.now()}.csv`;
    downloadText(fn, csv);
  }

  function downloadSessionsCSV(){
    const rows = S.sessions.slice();
    const cols = [
      'tsIso','tsIsoEnd','pid','participant','group','note','planDay','planSlot','diff','run','seed','track','mode',
      'endReason','durationSec','score','maxCombo','shots','hits','accPct',
      'perfect','great','good','miss','hpEnd','shieldEnd','feverEnd',
      'offsetAbsMeanMs','offsetAbsStdMs','rank'
    ];
    const csv = toCSV(rows, cols);
    const fn = `rhythm_sessions_${PID}_${S.trackKey}_${Date.now()}.csv`;
    downloadText(fn, csv);
  }

  // --------------------------- boot ---------------------------
  function boot(){
    // bind mode change
    const modeRadios = D.querySelectorAll('input[name="rb-mode"]');
    modeRadios.forEach(r=>{
      r.addEventListener('change', refreshModeUI);
    });

    // bind start
    BTN_START.addEventListener('click', ()=>{
      refreshModeUI();
      startGame();
    });

    // stop
    if(BTN_STOP){
      BTN_STOP.addEventListener('click', ()=>{
        stopGame('stop');
      });
    }

    if(BTN_AGAIN){
      BTN_AGAIN.addEventListener('click', ()=>{
        // play same track again (keeping current selection)
        startGame();
      });
    }

    if(BTN_BACK_MENU){
      BTN_BACK_MENU.addEventListener('click', backToMenu);
    }

    if(BTN_DL_EVENTS){
      BTN_DL_EVENTS.addEventListener('click', downloadEventsCSV);
    }
    if(BTN_DL_SESS){
      BTN_DL_SESS.addEventListener('click', downloadSessionsCSV);
    }

    bindInputs();
    refreshModeUI();

    // If planner wants to force run=research or mode, you can auto-check:
    if(RUN==='research'){
      const r = D.querySelector('input[name="rb-mode"][value="research"]');
      if(r) r.checked = true;
      refreshModeUI();
      const t = D.querySelector('input[name="rb-track"][value="r1"]');
      if(t) t.checked = true;
    }

    // Expose end hook (for planner bridge)
    if(typeof W.HH_END_GAME !== 'function'){
      W.HH_END_GAME = function(reason){
        // fallback: go hub if provided
        if(HUB){
          try{ location.href = new URL(HUB, location.href).toString(); }
          catch{ location.href = HUB; }
        }
      };
    }

    // Small banner in console
    console.log('[RB] boot OK', {RUN, DIFF, TIME_SEC, PID, track: getSelectedTrack()});
  }

  boot();

})();