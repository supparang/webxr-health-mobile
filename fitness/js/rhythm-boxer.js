// === /fitness/js/rhythm-boxer.js ===
// Rhythm Boxer — FULL CLEAN FINAL
// PATCH v20260403a-RB-COOLDOWN-GATE-FLOW
// ✅ fix parse error / duplicate const
// ✅ child-friendly
// ✅ missions + stars + medal + badge
// ✅ boss round
// ✅ AI coach + AI difficulty director
// ✅ deterministic pattern generator
// ✅ research CSV
// ✅ hub / planner bridge compatible
// ✅ warmup → run → cooldown gate flow

'use strict';

(function(){
  const W = window, D = document;

  // --------------------------------------------------
  // helpers
  // --------------------------------------------------
  const qs = (k, d='')=>{
    try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  };

  const qbool = (k, d=false)=>{
    const v = String(qs(k, d ? '1' : '0')).toLowerCase();
    return ['1','true','yes','y','on'].includes(v);
  };

  const clamp = (v,a,b)=>{
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();

  const mean = (arr)=>{
    if(!arr || !arr.length) return null;
    let s = 0;
    for(const x of arr) s += x;
    return s / arr.length;
  };

  const std = (arr)=>{
    if(!arr || arr.length < 2) return null;
    const m = mean(arr);
    let s = 0;
    for(const x of arr){
      const d = x - m;
      s += d*d;
    }
    return Math.sqrt(s/(arr.length-1));
  };

  const median = (arr)=>{
    if(!arr || !arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return (a.length % 2) ? a[m] : (a[m-1] + a[m]) / 2;
  };

  function rand(seed){
    let x = (seed|0) || 123456789;
    return ()=>{
      x ^= x << 13; x |= 0;
      x ^= x >>> 17; x |= 0;
      x ^= x << 5; x |= 0;
      return ((x>>>0) / 4294967296);
    };
  }

  function normalizeWeights(arr){
    const sum = arr.reduce((a,b)=>a+b, 0) || 1;
    return arr.map(v => v / sum);
  }

  function weightedPick(weights, rnd){
    const w = normalizeWeights(weights);
    const r = rnd();
    let acc = 0;
    for(let i=0;i<w.length;i++){
      acc += w[i];
      if(r <= acc) return i;
    }
    return w.length - 1;
  }

  function $(id){ return D.getElementById(id); }

  // --------------------------------------------------
  // params
  // --------------------------------------------------
  const RUN = String(qs('run','play')).toLowerCase();
  const DIFF = String(qs('diff','normal')).toLowerCase();
  const TIME_SEC = clamp(qs('time','80'), 20, 300);
  const SEED = Number(qs('seed', String(Date.now()))) || Date.now();
  const PID = String(qs('pid','')).trim() || 'anon';

  const HUB = String(qs('hub','')).trim();
  const PLAN_DAY = String(qs('planDay','')).trim();
  const PLAN_SLOT = String(qs('planSlot','')).trim();
  const ZONE = String(qs('zone','fitness')).trim() || 'fitness';
  const CAT = String(qs('cat','fitness')).trim() || 'fitness';
  const GAME_ID = 'rhythmboxer';
  const AUTO_NEXT = qbool('autoNext', false);

  // --------------------------------------------------
  // DOM refs
  // --------------------------------------------------
  const VIEW_MENU = $('rb-view-menu');
  const VIEW_PLAY = $('rb-view-play');
  const VIEW_RESULT = $('rb-view-result');

  const BTN_START = $('rb-btn-start');
  const BTN_STOP = $('rb-btn-stop');
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
  const FIELD = $('rb-field');

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

  const RES_STARS = $('rb-res-stars');
  const RES_MEDAL = $('rb-res-medal');
  const RES_BADGE = $('rb-res-badge');
  const RES_PRAISE = $('rb-res-praise');
  const RES_MISSION_SCORE = $('rb-res-mission-score');
  const RES_MISSION_COMBO = $('rb-res-mission-combo');
  const RES_MISSION_ACC = $('rb-res-mission-acc');
  const RES_NOMISS = $('rb-res-nomiss');
  const RES_BOSSCLEAR = $('rb-res-bossclear');

  const BOSS_HUD = $('rb-boss-hud');
  const BOSS_FILL = $('rb-boss-fill');
  const BOSS_TEXT = $('rb-boss-text');

  const MISSION_HUD = $('rb-mission-hud');
  const MISSION_SCORE = $('rb-mission-score');
  const MISSION_COMBO = $('rb-mission-combo');
  const MISSION_ACC = $('rb-mission-acc');

  // --------------------------------------------------
  // planner HUD patch
  // --------------------------------------------------
  (function patchPlanHud(){
    const elDay = $('hhDay');
    const elSlot = $('hhSlot');
    if(elDay) elDay.textContent = PLAN_DAY || '—';
    if(elSlot) elSlot.textContent = PLAN_SLOT || '—';

    const btnBack = $('hhBack');
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

    const backLink = $('rb-back-link');
    if(backLink){
      if(HUB){
        try{ backLink.href = new URL(HUB, location.href).toString(); }
        catch{ backLink.href = HUB; }
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

  // --------------------------------------------------
  // tracks
  // --------------------------------------------------
  const TRACKS = {
    n1: { key:'n1', name:'Warm-up Groove', bpm:100, density:0.72, jitter:0.10, feverRate:1.00, missDmg:4, blankPenalty:1 },
    n2: { key:'n2', name:'Focus Combo',   bpm:120, density:0.90, jitter:0.12, feverRate:1.05, missDmg:5, blankPenalty:1 },
    n3: { key:'n3', name:'Speed Rush',    bpm:140, density:1.10, jitter:0.14, feverRate:1.10, missDmg:6, blankPenalty:2 },
    r1: { key:'r1', name:'Research 120',  bpm:120, density:0.88, jitter:0.08, feverRate:1.00, missDmg:5, blankPenalty:1, research:true }
  };

  function diffScale(){
    if(DIFF === 'easy') return 0.85;
    if(DIFF === 'hard') return 1.15;
    return 1.0;
  }

  function getSelectedMode(){
    const el = D.querySelector('input[name="rb-mode"]:checked');
    return el ? String(el.value || 'normal') : 'normal';
  }

  function getSelectedTrack(){
    const el = D.querySelector('input[name="rb-track"]:checked');
    const key = el ? String(el.value || 'n1') : 'n1';
    return TRACKS[key] ? key : 'n1';
  }

  // --------------------------------------------------
  // state
  // --------------------------------------------------
  const S = {
    running:false,
    mode:'normal',
    trackKey:'n1',
    t0:0,
    tEnd:0,
    tLast:0,
    seed:SEED,
    rng:rand(SEED|0),

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
    shield:0,
    fever:0,
    feverOn:false,

    offsets:[],
    tapTimes:[],
    blankTaps:0,

    notes:[],
    nextId:1,

    events:[],
    sessions:[],

    ai:{ fatigue:0, skill:0.5, suggest:'normal', tip:'' },
    aiLastTipAt:0,

    director:{
      laneBias:[1,1,1,1,1],
      pressure:0.5,
      lastAdjustAt:0,
      skillBand:'mid',
      fatigueBand:'low',
      patternSeed:0
    },

    pattern:{
      current:'basic',
      bossStep:0,
      lastBossPatternAt:0
    },

    endReason:'timeup',
    phase:'warmup',

    mission:{
      stars:0,
      score1:false,
      combo1:false,
      acc1:false,
      noMiss:false,
      bossClear:false
    },

    boss:{
      active:false,
      hp:0,
      hpMax:24,
      windowOn:false,
      lastSpawnAt:0,
      introShown:false,
      clear:false
    },

    ui:{
      missionMounted:false,
      bossMounted:false
    }
  };

  // --------------------------------------------------
  // UI helpers
  // --------------------------------------------------
  function refreshModeUI(){
    const mode = getSelectedMode();
    S.mode = mode;

    if(mode === 'research'){
      if(RESEARCH_FIELDS) RESEARCH_FIELDS.classList.remove('hidden');
      if(MODE_DESC) MODE_DESC.textContent = 'Research: เก็บข้อมูล Event/Session เพื่อใช้วิเคราะห์';
    }else{
      if(RESEARCH_FIELDS) RESEARCH_FIELDS.classList.add('hidden');
      if(MODE_DESC) MODE_DESC.textContent = 'Normal: เล่นสนุก ฝึกจังหวะ และเก็บดาว';
    }

    const lab = $('rb-track-mode-label');
    if(lab){
      lab.textContent = (mode === 'research')
        ? 'โหมด Research — เพลงมาตรฐาน 1 ชุด'
        : 'โหมด Normal — เพลง 3 ระดับ: ง่าย / ปกติ / ยาก';
    }

    const opts = D.querySelectorAll('#rb-track-options .rb-mode-btn');
    opts.forEach(o=>{
      const m = String(o.getAttribute('data-mode') || 'normal');
      const input = o.querySelector('input[type="radio"]');
      if(!input) return;
      const allow = (m === mode);
      input.disabled = !allow;
      o.style.opacity = allow ? '1' : '0.45';
      o.style.pointerEvents = allow ? 'auto' : 'none';
    });

    const chosen = getSelectedTrack();
    const chosenMeta = TRACKS[chosen];
    if(mode === 'research' && !chosenMeta.research){
      const r = D.querySelector('input[name="rb-track"][value="r1"]');
      if(r) r.checked = true;
    }
    if(mode === 'normal' && chosenMeta.research){
      const n = D.querySelector('input[name="rb-track"][value="n1"]');
      if(n) n.checked = true;
    }
  }

  function showView(name){
    const set = (el, on)=>{
      if(!el) return;
      el.classList.toggle('hidden', !on);
    };
    set(VIEW_MENU, name === 'menu');
    set(VIEW_PLAY, name === 'play');
    set(VIEW_RESULT, name === 'result');
  }

  function setFeedback(msg, type=''){
    if(!FEEDBACK) return;
    FEEDBACK.textContent = msg || '';
    FEEDBACK.className = 'rb-feedback show';
    if(type) FEEDBACK.classList.add(type);
    setTimeout(()=>{
      if(FEEDBACK) FEEDBACK.className = 'rb-feedback';
    }, 220);
  }

  function flash(){
    const f = $('rb-flash');
    if(!f) return;
    f.classList.add('active');
    setTimeout(()=> f.classList.remove('active'), 90);
  }

  function beatPulse(){
    if(FIELD) FIELD.classList.add('rb-beat-pulse');
    if(LANES_WRAP) LANES_WRAP.classList.add('rb-lanes-pulse');
    setTimeout(()=>{
      if(FIELD) FIELD.classList.remove('rb-beat-pulse');
      if(LANES_WRAP) LANES_WRAP.classList.remove('rb-lanes-pulse');
    }, 110);
  }

  function coachCallout(text, type='cue'){
    if(!FIELD || !text) return;
    const el = D.createElement('div');
    el.className = `rb-coach-callout ${type}`;
    el.textContent = text;
    FIELD.appendChild(el);
    setTimeout(()=> el.remove(), 920);
  }

  function roundBanner(title, sub='', type='warmup'){
    if(!FIELD) return;
    const el = D.createElement('div');
    el.className = `rb-round-banner ${type}`;
    el.innerHTML = `
      <div class="rb-round-banner-title">${title}</div>
      <div class="rb-round-banner-sub">${sub}</div>
    `;
    FIELD.appendChild(el);
    setTimeout(()=> el.remove(), 980);
  }

  function comboBurst(txt){
    if(!FIELD) return;
    const el = D.createElement('div');
    el.className = 'rb-combo-burst';
    el.textContent = txt;
    FIELD.appendChild(el);
    setTimeout(()=> el.remove(), 680);
  }

  function hitFx(type='great'){
    if(!FIELD) return;
    const el = D.createElement('div');
    el.className = `rb-hit-fx ${String(type).toLowerCase()}`;
    FIELD.appendChild(el);
    setTimeout(()=> el.remove(), 320);
  }

  function scorePopup(txt, type='great'){
    if(!FIELD) return;
    const el = D.createElement('div');
    el.className = `rb-score-popup ${String(type).toLowerCase()}`;
    el.textContent = txt;
    FIELD.appendChild(el);
    setTimeout(()=> el.remove(), 560);
  }

  // --------------------------------------------------
  // mission / boss
  // --------------------------------------------------
  function mountMissionHud(){
    if(MISSION_HUD){
      MISSION_HUD.classList.remove('hidden');
      S.ui.missionMounted = true;
    }
  }

  function mountBossHud(){
    if(BOSS_HUD){
      BOSS_HUD.classList.add('hidden');
      S.ui.bossMounted = true;
    }
  }

  function updateMissionHud(){
    const acc = (S.shots > 0) ? (S.hits / S.shots * 100) : 0;

    S.mission.score1 = S.score >= 2500;
    S.mission.combo1 = S.maxCombo >= 20;
    S.mission.acc1 = acc >= 85;

    if(MISSION_SCORE){
      MISSION_SCORE.className = `rb-mission-item ${S.mission.score1 ? 'done' : ''}`;
      MISSION_SCORE.textContent = `${S.mission.score1 ? '✅' : '⭐'} ทำคะแนน 2500`;
    }
    if(MISSION_COMBO){
      MISSION_COMBO.className = `rb-mission-item ${S.mission.combo1 ? 'done' : ''}`;
      MISSION_COMBO.textContent = `${S.mission.combo1 ? '✅' : '⭐'} คอมโบถึง 20`;
    }
    if(MISSION_ACC){
      MISSION_ACC.className = `rb-mission-item ${S.mission.acc1 ? 'done' : ''}`;
      MISSION_ACC.textContent = `${S.mission.acc1 ? '✅' : '⭐'} Accuracy ถึง 85%`;
    }

    if(BOSS_HUD){
      BOSS_HUD.classList.toggle('hidden', !S.boss.active);
    }
    if(BOSS_FILL){
      const pct = S.boss.hpMax > 0 ? clamp((S.boss.hp / S.boss.hpMax) * 100, 0, 100) : 0;
      BOSS_FILL.style.width = `${pct}%`;
    }
    if(BOSS_TEXT){
      BOSS_TEXT.textContent = S.boss.active ? `BOSS HP ${Math.max(0, S.boss.hp)}/${S.boss.hpMax}` : '';
    }
  }

  function bossStart(){
    if(S.boss.active) return;
    S.boss.active = true;
    S.boss.hp = S.boss.hpMax;
    S.boss.windowOn = false;
    S.boss.lastSpawnAt = 0;

    if(!S.boss.introShown){
      roundBanner('BOSS ROUND!', 'ตีแม่น ๆ เพื่อลดพลังบอส', 'final');
      S.boss.introShown = true;
    }
    coachCallout('เข้าช่วงบอสแล้ว! อย่ากดมั่วนะ', 'great');
    updateMissionHud();
  }

  function bossEnd(clear){
    S.boss.active = false;
    S.boss.windowOn = false;
    S.boss.clear = !!clear;
    S.mission.bossClear = !!clear;

    if(clear){
      roundBanner('ชนะบอส!', 'เก่งมาก! ด่านสุดท้ายผ่านแล้ว', 'success');
      comboBurst('BOSS CLEAR!');
    }
    updateMissionHud();
  }

  function bossTick(now){
    if(!S.boss.active) return;

    if((now - S.boss.lastSpawnAt) > 1100){
      S.boss.lastSpawnAt = now;
      S.boss.windowOn = true;
      coachCallout('ตีจังหวะนี้เพื่อลดพลังบอส!', 'great');
      setTimeout(()=>{
        S.boss.windowOn = false;
      }, 360);
    }

    if(S.boss.hp <= 0){
      bossEnd(true);
    }
  }

  function hitBossByJudge(judge){
    if(!S.boss.active || !S.boss.windowOn) return;

    let dmg = 0;
    if(judge === 'Perfect') dmg = 4;
    else if(judge === 'Great') dmg = 3;
    else if(judge === 'Good') dmg = 2;

    if(dmg <= 0) return;

    S.boss.hp = Math.max(0, S.boss.hp - dmg);
    S.boss.windowOn = false;
    updateMissionHud();
  }

  // --------------------------------------------------
  // AI
  // --------------------------------------------------
  function aiBandOfSkill(skill){
    if(skill >= 0.78) return 'high';
    if(skill >= 0.48) return 'mid';
    return 'low';
  }

  function aiBandOfFatigue(fatigue){
    if(fatigue >= 0.72) return 'high';
    if(fatigue >= 0.42) return 'mid';
    return 'low';
  }

  function updateAI(now){
    const horizonMs = 12000;
    const recent = S.tapTimes.filter(t => (now - t) <= horizonMs);
    const tapsPerSec = recent.length / (horizonMs/1000);

    const missRate = (S.shots > 0) ? (S.miss / S.shots) : 0;
    const acc = (S.shots > 0) ? (S.hits / S.shots) : 0;

    const offAbs = S.offsets.slice(-20).map(x=>Math.abs(x));
    const offMed = median(offAbs);

    let timingScore = 0.5;
    if(offMed != null){
      timingScore = clamp(1 - (offMed/160), 0, 1);
    }

    const skill = clamp(0.25*acc + 0.75*timingScore, 0, 1);

    const hpLoss = (100 - S.hp) / 100;
    const fatigue = clamp(
      0.25*hpLoss +
      0.35*missRate +
      0.25*(tapsPerSec/6) +
      0.15*(S.blankTaps / Math.max(1, S.shots)),
      0, 1
    );

    let suggest = 'normal';
    if(fatigue > 0.72) suggest = 'easy';
    else if(skill > 0.78 && fatigue < 0.45) suggest = 'hard';

    let tip = '';
    const tSince = now - S.aiLastTipAt;
    if(tSince > 6000){
      if(S.blankTaps >= 6 && (S.blankTaps / Math.max(1,S.shots)) > 0.22){
        tip = 'รอหัวโน้ตถึงเส้นก่อนค่อยกด จะช่วยให้แม่นขึ้น';
      }else if(offMed != null && offMed > 95){
        tip = 'จังหวะยังแกว่งนิดหน่อย ลองหายใจลึก ๆ แล้วกดตามเส้น';
      }else if(S.combo > 0 && S.combo % 20 === 0){
        tip = 'ดีมาก! คอมโบกำลังสวย รักษาจังหวะนี้ไว้';
      }else if(fatigue > 0.7){
        tip = 'ถ้าเริ่มล้า ให้ผ่อนมือแป๊บหนึ่งแล้วค่อยกลับมา';
      }else if(S.boss.active){
        tip = 'ช่วงบอส ให้กดเฉพาะจังหวะที่ชัวร์';
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

  function updateDirector(now){
    if((now - S.director.lastAdjustAt) < 2200) return;
    S.director.lastAdjustAt = now;

    const skillBand = aiBandOfSkill(S.ai.skill || 0.5);
    const fatigueBand = aiBandOfFatigue(S.ai.fatigue || 0);
    S.director.skillBand = skillBand;
    S.director.fatigueBand = fatigueBand;

    let pressure = 0.5;
    if(skillBand === 'high') pressure += 0.18;
    if(skillBand === 'low') pressure -= 0.12;
    if(fatigueBand === 'high') pressure -= 0.18;
    if(fatigueBand === 'mid') pressure -= 0.05;
    if(S.combo >= 20) pressure += 0.08;
    if(S.miss >= 6) pressure -= 0.08;
    pressure = clamp(pressure, 0.18, 0.88);

    S.director.pressure = pressure;

    if(fatigueBand === 'high'){
      S.director.laneBias = [0.72, 0.95, 1.45, 0.95, 0.72];
      coachCallout('AI ปรับให้เล่นง่ายขึ้นนิดนึงแล้ว', 'good');
    }else if(skillBand === 'high' && fatigueBand === 'low'){
      S.director.laneBias = [1.18, 1.02, 0.88, 1.02, 1.18];
      if(pressure > 0.62) coachCallout('AI เพิ่มความท้าทายขึ้นอีกนิด!', 'great');
    }else{
      S.director.laneBias = [0.95, 1.05, 1.10, 1.05, 0.95];
    }
  }

  function choosePatternName(phase){
    const skillBand = S.director.skillBand;
    const fatigueBand = S.director.fatigueBand;

    if(phase === 'warmup') return 'basic';
    if(phase === 'groove'){
      if(skillBand === 'high') return 'alternate';
      return 'basic';
    }
    if(phase === 'rush'){
      if(fatigueBand === 'high') return 'stair';
      if(skillBand === 'high') return 'zigzag';
      return 'alternate';
    }
    if(phase === 'boss'){
      if(skillBand === 'high' && fatigueBand === 'low') return 'boss-wide';
      if(fatigueBand === 'high') return 'boss-center';
      return 'boss-mix';
    }
    return 'basic';
  }

  function nextPatternLane(pattern, rnd){
    const bias = S.director.laneBias || [1,1,1,1,1];

    if(pattern === 'basic'){
      return weightedPick(bias, rnd);
    }

    if(pattern === 'alternate'){
      const seq = [1,3,1,3,2];
      const lane = seq[S.pattern.bossStep % seq.length];
      S.pattern.bossStep += 1;
      return lane;
    }

    if(pattern === 'zigzag'){
      const seq = [0,2,4,2,1,3,2];
      const lane = seq[S.pattern.bossStep % seq.length];
      S.pattern.bossStep += 1;
      return lane;
    }

    if(pattern === 'stair'){
      const seq = [2,1,2,3,2,1,2,3];
      const lane = seq[S.pattern.bossStep % seq.length];
      S.pattern.bossStep += 1;
      return lane;
    }

    if(pattern === 'boss-center'){
      const seq = [2,2,1,2,3,2];
      const lane = seq[S.pattern.bossStep % seq.length];
      S.pattern.bossStep += 1;
      return lane;
    }

    if(pattern === 'boss-wide'){
      const seq = [0,4,1,3,0,4,2];
      const lane = seq[S.pattern.bossStep % seq.length];
      S.pattern.bossStep += 1;
      return lane;
    }

    if(pattern === 'boss-mix'){
      const seq = [2,0,2,4,1,3,2];
      const lane = seq[S.pattern.bossStep % seq.length];
      S.pattern.bossStep += 1;
      return lane;
    }

    return weightedPick(bias, rnd);
  }

  function nextPunchType(pattern, rnd){
    if(pattern === 'boss-center') return 'jab';
    if(pattern === 'boss-wide'){
      const seq = ['hook','hook','jab','hook','uppercut'];
      return seq[S.pattern.bossStep % seq.length];
    }
    if(pattern === 'zigzag'){
      const seq = ['jab','hook','jab','hook','uppercut'];
      return seq[S.pattern.bossStep % seq.length];
    }

    const r = rnd();
    if(r > 0.92) return 'uppercut';
    if(r > 0.72) return 'hook';
    return 'jab';
  }

  function laneToSide(lane){
    if(lane <= 1) return 'left';
    if(lane >= 3) return 'right';
    return 'center';
  }

  // --------------------------------------------------
  // logging
  // --------------------------------------------------
  function logEvent(ev){
    if(S.mode !== 'research') return;
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
      zone: ZONE,
      cat: CAT,
      game: GAME_ID
    };
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    const a = D.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    D.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1200);
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

  // --------------------------------------------------
  // schedule / notes
  // --------------------------------------------------
  function buildSchedule(trackKey, durSec){
    const t = TRACKS[trackKey];
    const bpm = t.bpm;
    const beatMs = 60000 / bpm;
    const baseStep = beatMs / 2;
    const densityBase = (t.density || 0.9) * diffScale();

    const rnd = S.rng;
    const notes = [];
    let tt = 1400;

    S.pattern.bossStep = 0;
    S.director.patternSeed = (S.seed ^ 0x9e3779b9) >>> 0;

    while(tt < durSec*1000 - 900){
      const phase =
        tt < durSec*1000*0.18 ? 'warmup' :
        tt < durSec*1000*0.48 ? 'groove' :
        tt < durSec*1000*0.78 ? 'rush' : 'boss';

      const pattern = choosePatternName(phase);
      S.pattern.current = pattern;

      let pressure = S.director.pressure || 0.5;
      if(phase === 'warmup') pressure *= 0.84;
      if(phase === 'rush') pressure *= 1.08;
      if(phase === 'boss') pressure *= 1.12;

      const density = clamp(densityBase * (0.72 + pressure*0.5), 0.42, 1.18);
      const spawn = (rnd() < Math.min(0.94, density));

      if(spawn){
        const lane = nextPatternLane(pattern, rnd);
        const punch = nextPunchType(pattern, rnd);
        const side = laneToSide(lane);

        let jitter = (rnd()*2 - 1) * (t.jitter || 0.1) * baseStep;
        if(t.research) jitter *= 0.4;
        if(phase === 'boss') jitter *= 0.6;

        notes.push({
          lane,
          tHit: tt + jitter,
          punch,
          side,
          phase,
          pattern
        });
      }

      if(!t.research && (phase === 'rush' || phase === 'boss') && S.director.fatigueBand !== 'high'){
        const doubleChance = phase === 'boss' ? 0.13 : 0.08;
        if(rnd() < doubleChance){
          const lane2 = nextPatternLane(pattern, rnd);
          const punch2 = nextPunchType(pattern, rnd);
          notes.push({
            lane: lane2,
            tHit: tt + 72,
            punch: punch2,
            side: laneToSide(lane2),
            phase,
            pattern
          });
        }
      }

      tt += baseStep;
    }

    return notes.sort((a,b)=>a.tHit - b.tHit);
  }

  function laneEls(){
    return Array.from(D.querySelectorAll('.rb-lane'));
  }

  function makeNoteEl(note){
    const lane = laneEls()[note.lane];
    if(!lane) return null;

    const el = D.createElement('div');
    el.className = `rb-note punch-${note.punch || 'jab'} side-${note.side || 'center'}`;
    el.innerHTML = `<div class="rb-note-ico">${
      note.punch === 'uppercut' ? '⬆️' :
      note.punch === 'hook' ? '↩️' : '👊'
    }</div>`;
    lane.appendChild(el);
    return el;
  }

  function removeNoteEl(note){
    if(note && note.el && note.el.parentNode){
      note.el.parentNode.removeChild(note.el);
    }
    note.el = null;
  }

  function judgeWindows(){
    const base = (DIFF === 'hard') ? 70 : (DIFF === 'easy' ? 95 : 82);
    return {
      perfect: base,
      great: base * 1.55,
      good: base * 2.40
    };
  }

  function addScore(judge){
    const feverMult = S.feverOn ? 1.25 : 1.0;
    let add = 0;
    if(judge === 'Perfect') add = 120;
    else if(judge === 'Great') add = 85;
    else if(judge === 'Good') add = 50;

    const comboBonus = Math.min(60, Math.floor(S.combo/10)*10);
    S.score += Math.round((add + comboBonus) * feverMult);
  }

  function addFever(judge, track){
    const rate = (track.feverRate || 1.0) * diffScale();
    let inc = 0;
    if(judge === 'Perfect') inc = 9;
    else if(judge === 'Great') inc = 6;
    else if(judge === 'Good') inc = 3;

    S.fever = clamp(S.fever + inc*rate, 0, 100);
    if(S.fever >= 100){
      S.feverOn = true;
      S.fever = 100;
      if(FIELD) FIELD.classList.add('is-fever');
    }
  }

  function drainFever(dt){
    if(!S.feverOn) return;
    S.fever = clamp(S.fever - dt*0.022, 0, 100);
    if(S.fever <= 0){
      S.feverOn = false;
      S.fever = 0;
      if(FIELD) FIELD.classList.remove('is-fever');
    }
  }

  function applyMissDamage(track){
    if(S.shield > 0){
      S.shield -= 1;
      return;
    }
    const dmg = (track.missDmg || 5) * diffScale();
    S.hp = clamp(S.hp - dmg, 0, 100);
  }

  function maybeGainShield(){
    if(S.combo > 0 && S.combo % 30 === 0){
      S.shield = clamp(S.shield + 1, 0, 3);
      coachCallout('ได้โล่เพิ่ม 1 อัน!', 'good');
    }
  }

  function noteTravelMs(){
    if(DIFF === 'hard') return 1050;
    if(DIFF === 'easy') return 1250;
    return 1150;
  }

  function spawnNotes(schedule){
    S.notes = schedule.map(n => ({
      id: S.nextId++,
      lane: n.lane,
      tHit: n.tHit,
      punch: n.punch || 'jab',
      side: n.side || 'center',
      spawned:false,
      hit:false,
      miss:false,
      el:null
    }));
  }

  function renderNotes(now){
    const travel = noteTravelMs();
    const lanes = laneEls();
    if(!lanes.length) return;

    const laneRect = lanes[0].getBoundingClientRect();
    const laneH = laneRect.height || 240;
    const hitY = laneH * 0.82;

    for(const note of S.notes){
      if(note.hit || note.miss) continue;

      const tRel = now - S.t0;
      const dtToHit = note.tHit - tRel;
      const y = hitY - (dtToHit / travel) * hitY;

      if(!note.spawned && dtToHit < travel){
        note.spawned = true;
        note.el = makeNoteEl(note);
      }

      if(note.el){
        const yy = clamp(y, -24, hitY + 80);
        note.el.style.transform = `translate(-50%, ${yy}px)`;

        const win = judgeWindows().good;
        if(dtToHit < -win){
          note.miss = true;
          removeNoteEl(note);

          S.shots += 1;
          S.miss += 1;
          S.combo = 0;

          setFeedback('MISS', 'miss');
          hitFx('miss');
          flash();
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
            tsIso: nowIso()
          });
        }
      }
    }
  }

  function findNearestNote(lane, now){
    const tRel = now - S.t0;
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
    if(S.tapTimes.length > 300){
      S.tapTimes.splice(0, S.tapTimes.length - 300);
    }

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
        found.note.hit = true;
        removeNoteEl(found.note);

        S.shots += 1;
        S.hits += 1;

        if(judge === 'Perfect') S.perfect += 1;
        else if(judge === 'Great') S.great += 1;
        else S.good += 1;

        S.combo += 1;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        addScore(judge);
        addFever(judge, TRACKS[S.trackKey]);
        maybeGainShield();
        hitBossByJudge(judge);

        S.offsets.push(dt);
        if(S.offsets.length > 400){
          S.offsets.splice(0, S.offsets.length - 400);
        }

        setFeedback(judge.toUpperCase(), judge.toLowerCase());
        hitFx(judge);
        scorePopup(
          judge === 'Perfect' ? '+120' :
          judge === 'Great' ? '+85' : '+50',
          judge
        );
        flash();

        if(S.combo > 0 && S.combo % 10 === 0){
          comboBurst(`${S.combo} COMBO!`);
        }
      }else{
        blank = true;
      }
    }else{
      blank = true;
    }

    if(blank){
      S.blankTaps += 1;
      S.shots += 1;
      S.combo = 0;

      const t = TRACKS[S.trackKey];
      const pen = (t.blankPenalty || 1) * diffScale();
      S.score = Math.max(0, S.score - pen*8);

      if(S.blankTaps >= 6 && (S.blankTaps / S.shots) > 0.25){
        S.hp = clamp(S.hp - 1.2, 0, 100);
      }

      setFeedback('MISS', 'miss');
      hitFx('miss');
      flash();
      judge = 'Miss';
      dt = 9999;
    }

    updateMissionHud();

    logEvent({
      ...sessionMeta(),
      kind:'event',
      tMs: Math.round(tRel),
      lane,
      action:(blank ? 'blank_tap' : 'tap'),
      source: source || '',
      judge,
      offsetMs:(dt===9999 ? '' : Math.round(dt)),
      score: Math.round(S.score),
      combo: S.combo,
      hp: Math.round(S.hp),
      fever: Math.round(S.fever),
      shield: S.shield,
      tsIso: nowIso()
    });
  }

  // --------------------------------------------------
  // inputs
  // --------------------------------------------------
  function bindInputs(){
    if(LANES_WRAP){
      LANES_WRAP.addEventListener('pointerdown', (e)=>{
        const laneEl = e.target.closest('.rb-lane');
        if(!laneEl) return;
        const lane = Number(laneEl.getAttribute('data-lane'));
        if(!Number.isFinite(lane)) return;
        handleTap(lane, 'pointer');
      });
    }

    const keyMap = { 'a':0, 's':1, 'd':2, 'j':3, 'k':4 };
    W.addEventListener('keydown', (e)=>{
      const k = String(e.key || '').toLowerCase();
      if(!(k in keyMap)) return;
      e.preventDefault();
      handleTap(keyMap[k], 'key');
    }, {passive:false});
  }

  // --------------------------------------------------
  // phase
  // --------------------------------------------------
  function phaseOf(now){
    const dur = Math.max(1, S.tEnd - S.t0);
    const p = clamp((now - S.t0) / dur, 0, 1);
    if(p < 0.18) return 'warmup';
    if(p < 0.48) return 'groove';
    if(p < 0.78) return 'rush';
    return 'boss';
  }

  function maybePhaseChange(now){
    const phase = phaseOf(now);
    if(S.phase === phase) return;

    S.phase = phase;
    if(FIELD) FIELD.setAttribute('data-phase', phase);

    if(phase === 'warmup'){
      roundBanner('วอร์มอัปก่อนนะ', 'ค่อย ๆ จับจังหวะ', 'warmup');
    }else if(phase === 'groove'){
      roundBanner('เริ่มเข้าจังหวะแล้ว!', 'รักษาคอมโบไว้', 'groove');
    }else if(phase === 'rush'){
      roundBanner('เร็วขึ้นอีกนิด!', 'มองเส้นแล้วกดให้พอดี', 'rush');
    }else if(phase === 'boss'){
      roundBanner('BOSS ROUND!', 'ตีให้แม่นเพื่อลดพลังบอส', 'final');
      bossStart();
    }
  }

  // --------------------------------------------------
  // lifecycle
  // --------------------------------------------------
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

    S.offsets = [];
    S.tapTimes = [];
    S.blankTaps = 0;

    S.notes = [];
    S.nextId = 1;

    S.events = [];
    S.endReason = 'timeup';
    S.phase = 'warmup';

    S.ai = { fatigue:0, skill:0.5, suggest:'normal', tip:'' };
    S.aiLastTipAt = 0;

    S.director = {
      laneBias:[1,1,1,1,1],
      pressure:0.5,
      lastAdjustAt:0,
      skillBand:'mid',
      fatigueBand:'low',
      patternSeed:0
    };

    S.pattern = {
      current:'basic',
      bossStep:0,
      lastBossPatternAt:0
    };

    S.mission = {
      stars:0,
      score1:false,
      combo1:false,
      acc1:false,
      noMiss:false,
      bossClear:false
    };

    S.boss = {
      active:false,
      hp:0,
      hpMax:24,
      windowOn:false,
      lastSpawnAt:0,
      introShown:false,
      clear:false
    };

    laneEls().forEach(l=>{
      Array.from(l.querySelectorAll('.rb-note')).forEach(n=>n.remove());
    });

    if(FIELD){
      FIELD.classList.remove('is-fever');
      FIELD.setAttribute('data-phase', 'warmup');
    }

    if(MISSION_HUD) MISSION_HUD.classList.remove('hidden');
    if(BOSS_HUD) BOSS_HUD.classList.add('hidden');

    updateMissionHud();
  }

  function updateHUD(now){
    const acc = (S.shots > 0) ? (S.hits / S.shots * 100) : 0;

    if(HUD_MODE) HUD_MODE.textContent = (S.mode === 'research' ? 'Research' : 'Normal');
    if(HUD_TRACK) HUD_TRACK.textContent = TRACKS[S.trackKey].name;
    if(HUD_SCORE) HUD_SCORE.textContent = String(Math.round(S.score));
    if(HUD_COMBO) HUD_COMBO.textContent = String(S.combo);
    if(HUD_ACC) HUD_ACC.textContent = `${acc.toFixed(1)}%`;

    if(HUD_HP) HUD_HP.textContent = String(Math.round(S.hp));
    if(HUD_SHIELD) HUD_SHIELD.textContent = String(S.shield);

    const t = (now - S.t0) / 1000;
    if(HUD_TIME) HUD_TIME.textContent = t.toFixed(1);

    if(HUD_PERF) HUD_PERF.textContent = String(S.perfect);
    if(HUD_GREAT) HUD_GREAT.textContent = String(S.great);
    if(HUD_GOOD) HUD_GOOD.textContent = String(S.good);
    if(HUD_MISS) HUD_MISS.textContent = String(S.miss);

    if(FEVER_FILL){
      FEVER_FILL.style.width = `${clamp(S.fever, 0, 100)}%`;
      FEVER_FILL.style.opacity = S.feverOn ? '1' : '0.85';
    }
    if(FEVER_STATUS){
      FEVER_STATUS.textContent = S.feverOn ? 'ON' : (S.fever >= 100 ? 'READY' : 'BUILD');
    }

    const prog = clamp((now - S.t0) / (S.tEnd - S.t0), 0, 1);
    if(PROG_FILL) PROG_FILL.style.width = `${Math.round(prog*100)}%`;
    if(PROG_TEXT) PROG_TEXT.textContent = `${Math.round(prog*100)}%`;
  }

  function startGame(){
    refreshModeUI();
    resetStateForRun();

    S.mode = getSelectedMode();
    S.trackKey = getSelectedTrack();
    S.seed = SEED;
    S.rng = rand((SEED|0) ^ (S.trackKey.charCodeAt(0)<<16) ^ (S.trackKey.charCodeAt(1)<<8));

    const schedule = buildSchedule(S.trackKey, TIME_SEC);
    spawnNotes(schedule);

    showView('play');
    setFeedback('พร้อม!', 'great');

    mountMissionHud();
    mountBossHud();
    updateMissionHud();

    S.running = true;
    S.t0 = nowMs();
    S.tLast = S.t0;
    S.tEnd = S.t0 + TIME_SEC * 1000;

    updateHUD(S.t0);
    updateAI(S.t0);

    roundBanner('เริ่มเลย!', 'มองเส้นแล้วกดตามจังหวะ', 'warmup');

    logEvent({
      ...sessionMeta(),
      kind:'marker',
      marker:'start',
      tsIso: nowIso(),
      durSec: TIME_SEC,
      bpm: TRACKS[S.trackKey].bpm,
      density: TRACKS[S.trackKey].density
    });

    requestAnimationFrame(tick);
  }

  function stopGame(reason){
    if(!S.running) return;
    S.endReason = reason || 'stop';
    endGame();
  }

  function computeRank(){
    const acc = (S.shots > 0) ? (S.hits / S.shots) : 0;
    const survive = S.hp / 100;
    const combo = S.maxCombo;

    let score = 0.65*acc + 0.20*survive + 0.15*clamp(combo/80, 0, 1);
    if(S.mode === 'research') score *= 0.98;

    if(score >= 0.88) return 'S';
    if(score >= 0.78) return 'A';
    if(score >= 0.68) return 'B';
    if(score >= 0.55) return 'C';
    return 'D';
  }

  function computeReward(){
    const rank = computeRank();
    const acc = (S.shots > 0) ? (S.hits / S.shots) : 0;

    S.mission.noMiss = (S.miss === 0 && S.shots > 0);

    let stars = 0;
    if(S.mission.score1) stars += 1;
    if(S.mission.combo1) stars += 1;
    if(S.mission.acc1) stars += 1;

    if(stars <= 0){
      if(rank === 'S' || rank === 'A') stars = 2;
      else stars = 1;
    }

    let medal = 'bronze';
    if(stars >= 3) medal = 'gold';
    else if(stars === 2) medal = 'silver';

    let badge = '-';
    if(S.mission.bossClear && S.mission.noMiss) badge = 'Boss No-Miss';
    else if(S.mission.bossClear) badge = 'Boss Clear';
    else if(S.mission.noMiss) badge = 'No-Miss';
    else if(S.maxCombo >= 40) badge = 'Combo Hero';
    else if(acc >= 0.9) badge = 'Timing Star';
    else if(S.feverOn || S.fever >= 90) badge = 'Fever Kid';

    let label = '';
    if(stars >= 3) label = 'ได้ 3 ดาว! เยี่ยมมาก!';
    else if(stars === 2) label = 'ได้ 2 ดาว! เก่งมาก!';
    else label = 'ได้ 1 ดาว! เริ่มดีมาก!';

    return { stars, medal, badge, label, rank };
  }

  function makeResultPayload(reward, dur, accPct, offAvg, offStd){
    return {
      ...sessionMeta(),
      kind:'session',
      endReason:S.endReason,
      durationSec:dur.toFixed(2),
      score:Math.round(S.score),
      maxCombo:S.maxCombo,
      shots:S.shots,
      hits:S.hits,
      accPct:accPct.toFixed(2),
      perfect:S.perfect,
      great:S.great,
      good:S.good,
      miss:S.miss,
      hpEnd:Math.round(S.hp),
      shieldEnd:S.shield,
      feverEnd:Math.round(S.fever),
      offsetAbsMeanMs:(offAvg==null ? '' : offAvg.toFixed(2)),
      offsetAbsStdMs:(offStd==null ? '' : offStd.toFixed(2)),
      rank:reward.rank,
      stars:reward.stars,
      medal:reward.medal,
      badge:reward.badge,
      missionScore:S.mission.score1 ? 1 : 0,
      missionCombo:S.mission.combo1 ? 1 : 0,
      missionAcc:S.mission.acc1 ? 1 : 0,
      missionNoMiss:S.mission.noMiss ? 1 : 0,
      bossClear:S.mission.bossClear ? 1 : 0,
      bossHpLeft:S.boss.hp,
      aiSkillBand:S.director.skillBand,
      aiFatigueBand:S.director.fatigueBand,
      aiPressure:(S.director.pressure ?? 0).toFixed(3),
      aiPattern:S.pattern.current || 'basic',
      tsIsoEnd:nowIso()
    };
  }

  function buildCooldownUrl(){
    const gate = new URL('../warmup-gate.html', location.href);

    gate.searchParams.set('phase', 'cooldown');
    gate.searchParams.set('gatePhase', 'cooldown');

    gate.searchParams.set('zone', ZONE || 'fitness');
    gate.searchParams.set('cat', CAT || 'fitness');
    gate.searchParams.set('game', GAME_ID || 'rhythmboxer');
    gate.searchParams.set('gameId', GAME_ID || 'rhythmboxer');
    gate.searchParams.set('theme', GAME_ID || 'rhythmboxer');

    gate.searchParams.set('pid', PID || 'anon');
    gate.searchParams.set('run', RUN || 'play');
    gate.searchParams.set('diff', DIFF || 'normal');
    gate.searchParams.set('time', String(TIME_SEC || 80));
    gate.searchParams.set('seed', String(S.seed || SEED || Date.now()));
    gate.searchParams.set('view', qs('view', 'pc'));
    gate.searchParams.set('hub', HUB || '../hub.html');

    const cdur = String(qs('cdur', '20')).trim() || '20';
    gate.searchParams.set('cdur', cdur);

    if (PLAN_DAY) gate.searchParams.set('planDay', PLAN_DAY);
    if (PLAN_SLOT) gate.searchParams.set('planSlot', PLAN_SLOT);
    if (AUTO_NEXT || qbool('autoNext', false)) gate.searchParams.set('autoNext', '1');

    return gate.toString();
  }

  function goCooldownSummary(delayMs = 550){
    const href = buildCooldownUrl();
    setTimeout(() => {
      location.href = href;
    }, Math.max(0, Number(delayMs) || 0));
  }

  function goHubNow(){
    if(HUB){
      try{
        location.href = new URL(HUB, location.href).toString();
      }catch(_){
        location.href = HUB;
      }
      return;
    }
    location.href = '../hub.html';
  }

  function endGame(){
    S.running = false;

    if(S.boss.active){
      bossEnd(S.boss.hp <= 0);
    }

    for(const n of S.notes){
      if(n && n.el) removeNoteEl(n);
    }

    const endAt = nowMs();
    const dur = Math.max(0, (endAt - S.t0) / 1000);
    const accPct = (S.shots > 0) ? (S.hits / S.shots * 100) : 0;

    const off = S.offsets.filter(x=>Number.isFinite(x));
    const offAbs = off.map(x=>Math.abs(x));
    const offAvg = mean(offAbs);
    const offStd = std(offAbs);

    const reward = computeReward();

    showView('result');

    if(RES_MODE) RES_MODE.textContent = (S.mode === 'research' ? 'Research' : 'Normal');
    if(RES_TRACK) RES_TRACK.textContent = TRACKS[S.trackKey].name;
    if(RES_END) RES_END.textContent = S.endReason || 'timeup';
    if(RES_SCORE) RES_SCORE.textContent = String(Math.round(S.score));
    if(RES_MAXCOMBO) RES_MAXCOMBO.textContent = String(S.maxCombo);
    if(RES_DETAIL_HIT) RES_DETAIL_HIT.textContent = `${S.perfect} / ${S.great} / ${S.good} / ${S.miss}`;
    if(RES_ACC) RES_ACC.textContent = `${accPct.toFixed(1)} %`;
    if(RES_DUR) RES_DUR.textContent = `${dur.toFixed(1)} s`;
    if(RES_RANK) RES_RANK.textContent = reward.rank;
    if(RES_OFF_AVG) RES_OFF_AVG.textContent = (offAvg==null ? '-' : `${offAvg.toFixed(1)} ms`);
    if(RES_OFF_STD) RES_OFF_STD.textContent = (offStd==null ? '-' : `${offStd.toFixed(1)} ms`);
    if(RES_PART) RES_PART.textContent = (IN_PART && IN_PART.value) ? String(IN_PART.value).trim() : '-';

    if(RES_STARS) RES_STARS.textContent = '⭐'.repeat(Math.max(1, reward.stars || 1));
    if(RES_MEDAL){
      RES_MEDAL.textContent =
        reward.medal === 'gold' ? 'Gold' :
        reward.medal === 'silver' ? 'Silver' : 'Bronze';
      RES_MEDAL.className = `rb-reward-medal ${reward.medal || 'bronze'}`;
    }
    if(RES_BADGE) RES_BADGE.textContent = reward.badge || '-';
    if(RES_PRAISE) RES_PRAISE.textContent = reward.label || '';

    if(RES_MISSION_SCORE) RES_MISSION_SCORE.textContent = S.mission.score1 ? '✅' : '—';
    if(RES_MISSION_COMBO) RES_MISSION_COMBO.textContent = S.mission.combo1 ? '✅' : '—';
    if(RES_MISSION_ACC) RES_MISSION_ACC.textContent = S.mission.acc1 ? '✅' : '—';
    if(RES_NOMISS) RES_NOMISS.textContent = S.mission.noMiss ? '✅' : '—';
    if(RES_BOSSCLEAR) RES_BOSSCLEAR.textContent = S.mission.bossClear ? '✅' : '—';

    if(RES_QUALITY_NOTE){
      const note = [];
      if(S.blankTaps > 8) note.push('กดล่วงหน้า/กดรัวค่อนข้างเยอะ');
      if(S.hp < 45) note.push('ความล้าหรือพลาดค่อนข้างสูง');
      if(offAvg != null && offAvg > 110) note.push('จังหวะยังไม่คงที่');

      if(S.mode === 'research' && note.length){
        RES_QUALITY_NOTE.classList.remove('hidden');
        RES_QUALITY_NOTE.textContent = 'ข้อสังเกตคุณภาพข้อมูล: ' + note.join(' · ');
      }else{
        RES_QUALITY_NOTE.classList.add('hidden');
        RES_QUALITY_NOTE.textContent = '';
      }
    }

    const payload = makeResultPayload(reward, dur, accPct, offAvg, offStd);
    S.sessions.push(payload);

    try{
      const extra = {
        url: location.href,
        zone: ZONE,
        cat: CAT,
        game: GAME_ID
      };

      const hubSummary = {
        pid: PID,
        game: 'rhythmboxer',
        runMode: S.mode,
        diff: DIFF,
        scoreFinal: payload.score,
        accPct: Number(payload.accPct),
        comboMax: payload.maxCombo,
        misses: payload.miss,
        end_reason: payload.endReason,
        rank: payload.rank,
        stars: payload.stars,
        badge: payload.badge,
        missionScore: payload.missionScore,
        missionCombo: payload.missionCombo,
        missionAcc: payload.missionAcc,
        missionNoMiss: payload.missionNoMiss,
        bossClear: payload.bossClear,
        durationSec: Number(payload.durationSec),
        timestampIso: nowIso(),
        __extraJson: JSON.stringify(extra)
      };

      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(hubSummary));
      localStorage.setItem(`HHA_LAST_SUMMARY:rhythmboxer:${PID}`, JSON.stringify(hubSummary));
    }catch(_){}

    logEvent({
      ...sessionMeta(),
      kind:'marker',
      marker:'end',
      endReason:S.endReason,
      durationSec:dur.toFixed(2),
      score:Math.round(S.score),
      accPct:accPct.toFixed(2),
      miss:S.miss,
      stars:reward.stars,
      rank:reward.rank,
      tsIso:nowIso()
    });

    const shouldGoCooldown =
      qbool('cooldown', true) ||
      qs('returnPhase', '') === 'cooldown';

    const shouldAutoReturn =
      AUTO_NEXT ||
      (HUB && String(HUB).includes('seq=1'));

    if(shouldGoCooldown){
      goCooldownSummary(550);
      return;
    }

    if(shouldAutoReturn && typeof W.HH_END_GAME === 'function'){
      setTimeout(()=>{
        try{
          W.HH_END_GAME('result', {
            score: payload.score,
            acc: payload.accPct,
            miss: payload.miss,
            rank: payload.rank,
            stars: payload.stars
          });
        }catch(_){
          goHubNow();
        }
      }, 900);
      return;
    }

    goHubNow();
  }

  function tick(){
    if(!S.running) return;

    const now = nowMs();
    const dt = now - S.tLast;
    S.tLast = now;

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

    maybePhaseChange(now);
    beatPulse();
    bossTick(now);
    drainFever(dt);
    renderNotes(now);
    updateHUD(now);
    updateAI(now);
    updateDirector(now);
    updateMissionHud();

    requestAnimationFrame(tick);
  }

  // --------------------------------------------------
  // download
  // --------------------------------------------------
  function downloadEventsCSV(){
    const rows = S.events.slice();
    const cols = [
      'tsIso','pid','participant','group','note','planDay','planSlot','diff','run','seed','track','mode','zone','cat','game',
      'kind','marker','tMs','lane','action','source','judge','offsetMs','score','combo','hp','fever','shield',
      'bpm','density','durSec','endReason','stars','rank'
    ];
    downloadText(`rhythm_events_${PID}_${S.trackKey}_${Date.now()}.csv`, toCSV(rows, cols));
  }

  function downloadSessionsCSV(){
    const rows = S.sessions.slice();
    const cols = [
      'tsIso','tsIsoEnd','pid','participant','group','note','planDay','planSlot','diff','run','seed','track','mode','zone','cat','game',
      'endReason','durationSec','score','maxCombo','shots','hits','accPct',
      'perfect','great','good','miss','hpEnd','shieldEnd','feverEnd',
      'offsetAbsMeanMs','offsetAbsStdMs','rank','stars','medal','badge',
      'missionScore','missionCombo','missionAcc','missionNoMiss','bossClear','bossHpLeft',
      'aiSkillBand','aiFatigueBand','aiPressure','aiPattern'
    ];
    downloadText(`rhythm_sessions_${PID}_${S.trackKey}_${Date.now()}.csv`, toCSV(rows, cols));
  }

  // --------------------------------------------------
  // boot
  // --------------------------------------------------
  function boot(){
    const modeRadios = D.querySelectorAll('input[name="rb-mode"]');
    modeRadios.forEach(r => r.addEventListener('change', refreshModeUI));

    if(BTN_START){
      BTN_START.addEventListener('click', ()=>{
        refreshModeUI();
        startGame();
      });
    }

    if(BTN_STOP){
      BTN_STOP.addEventListener('click', ()=>{
        stopGame('stop');
      });
    }

    if(BTN_AGAIN){
      BTN_AGAIN.addEventListener('click', ()=>{
        startGame();
      });
    }

    if(BTN_BACK_MENU){
      BTN_BACK_MENU.addEventListener('click', ()=>{
        showView('menu');
      });
    }

    if(BTN_DL_EVENTS){
      BTN_DL_EVENTS.addEventListener('click', downloadEventsCSV);
    }

    if(BTN_DL_SESS){
      BTN_DL_SESS.addEventListener('click', downloadSessionsCSV);
    }

    bindInputs();
    refreshModeUI();

    if(RUN === 'research'){
      const r = D.querySelector('input[name="rb-mode"][value="research"]');
      if(r) r.checked = true;
      refreshModeUI();
      const t = D.querySelector('input[name="rb-track"][value="r1"]');
      if(t) t.checked = true;
    }

    if(typeof W.HH_END_GAME !== 'function'){
      W.HH_END_GAME = function(){
        const shouldGoCooldown =
          qbool('cooldown', true) ||
          qs('returnPhase', '') === 'cooldown';

        if(shouldGoCooldown){
          goCooldownSummary(0);
          return;
        }

        goHubNow();
      };
    }

    console.log('[RB] boot OK', {
      RUN, DIFF, TIME_SEC, PID, HUB, zone:ZONE, cat:CAT, game:GAME_ID
    });
  }

  boot();

})();