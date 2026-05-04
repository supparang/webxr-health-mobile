// === /herohealth/vr-goodjunk/goodjunk-solo-boss-director.js ===
// GoodJunk Solo Boss Fair Difficulty Director + Finale Phase
// PATCH v8.40.5-BOSS-PHASE-FINALE-FAIR-DIRECTOR
// ✅ fair local difficulty director
// ✅ pressure adjusts from player performance
// ✅ never punishes repeated mistakes too harshly
// ✅ finale boss phases
// ✅ coach micro-tips
// ✅ spawn/speed modifiers for main game
// ✅ works with v8.40.1 ultimate + v8.40.2 drama + v8.40.3 juice + v8.40.4 reward
// ✅ no backend / no Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search || '');

  const PATCH = 'v8.40.5-BOSS-PHASE-FINALE-FAIR-DIRECTOR';

  const CFG = {
    diff: String(QS.get('diff') || 'normal').toLowerCase(),
    seed: Number(QS.get('seed')) || Date.now(),
    time: Math.max(60, Number(QS.get('time')) || 120),
    enabled: QS.get('director') !== '0'
  };

  const DIFF = {
    easy: {
      maxPressure: 3,
      baseSpeed: 0.92,
      helpMistakes: 2,
      helpAccuracy: 58,
      rampAccuracy: 84,
      rampCombo: 6
    },
    normal: {
      maxPressure: 4,
      baseSpeed: 1.00,
      helpMistakes: 3,
      helpAccuracy: 55,
      rampAccuracy: 82,
      rampCombo: 7
    },
    hard: {
      maxPressure: 5,
      baseSpeed: 1.08,
      helpMistakes: 3,
      helpAccuracy: 60,
      rampAccuracy: 80,
      rampCombo: 8
    },
    challenge: {
      maxPressure: 5,
      baseSpeed: 1.16,
      helpMistakes: 4,
      helpAccuracy: 62,
      rampAccuracy: 78,
      rampCombo: 9
    }
  };

  const D = DIFF[CFG.diff] || DIFF.normal;

  let rngState = CFG.seed >>> 0;
  function rand(){
    rngState += 0x6D2B79F5;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pick(arr){
    return arr[Math.floor(rand() * arr.length)];
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  const FINALE_PHASES = [
    {
      id:'opening',
      hpAt:101,
      icon:'🥗',
      title:'Healthy Start!',
      desc:'เลือกอาหารดีเพื่อเปิดทางสู้บอส',
      coach:'เริ่มจากแยก “อาหารดี” กับ “อาหารขยะ” ให้ชัดก่อน'
    },
    {
      id:'junkGate',
      hpAt:72,
      icon:'🚧',
      title:'Junk Gate!',
      desc:'บอสเริ่มปล่อยอาหารขยะถี่ขึ้น',
      coach:'ของทอด น้ำหวาน และขนมหวาน ทำให้บอสฟื้นพลังได้'
    },
    {
      id:'fakeParade',
      hpAt:48,
      icon:'🧃',
      title:'Fake Healthy Parade!',
      desc:'อาหารหลอกตาเริ่มมาแล้ว',
      coach:'ดูให้ดี บางอย่างเหมือนสุขภาพดี แต่อาจมีน้ำตาลหรือซอสแฝง'
    },
    {
      id:'finalClean',
      hpAt:25,
      icon:'🔥',
      title:'Final Clean Strike!',
      desc:'บอสใกล้แพ้แล้ว ทำคอมโบปิดฉาก!',
      coach:'ช่วงท้ายให้เก็บอาหารดีต่อเนื่อง อย่าแตะ junk'
    },
    {
      id:'lastBite',
      hpAt:10,
      icon:'⚡',
      title:'Last Bite!',
      desc:'อีกนิดเดียว! ระวังอาหารหลอกตา',
      coach:'อย่ารีบกด ให้มองก่อนว่าเป็นอาหารดีจริงไหม'
    }
  ];

  const COACH_TIPS = {
    good: [
      'เยี่ยม! เก็บอาหารดีต่อเนื่องเพื่อทำคอมโบ',
      'ดีมาก! อาหารดีช่วยโจมตีบอสได้แรงขึ้น',
      'จำไว้: ผัก ผลไม้ โปรตีน และอาหารหลักที่เหมาะสมช่วยให้ร่างกายแข็งแรง'
    ],
    junk: [
      'ระวัง junk! ของทอด น้ำหวาน และขนมหวานทำให้บอสได้เปรียบ',
      'ลองชะลอก่อนกด ถ้าเป็นของทอดหรือหวานมากให้หลบ',
      'อาหารขยะกินได้บ้าง แต่ไม่ควรกินบ่อย'
    ],
    fake: [
      'อาหารหลอกตา! ดูน้ำตาล น้ำมัน และซอสแฝงด้วย',
      'ของที่ดูเหมือนผลไม้หรือสลัด อาจหวานหรือมันเกินไป',
      'อย่าดูแค่หน้าตา ต้องคิดว่าในอาหารมีอะไรแฝงอยู่'
    ],
    help: [
      'ไม่เป็นไร รอบนี้โค้ชช่วยลดแรงกดดันให้ ตั้งใจมองอาหารทีละชิ้น',
      'หายใจนิดหนึ่ง แล้วเลือกเฉพาะอาหารที่มั่นใจว่าเป็นอาหารดี',
      'ตอนพลาดติดกัน ให้หยุดกดมั่ว แล้วมองสัญลักษณ์อาหารก่อน'
    ],
    ramp: [
      'เก่งมาก! เกมจะท้าทายขึ้นนิดหนึ่ง',
      'คอมโบดีแล้ว บอสจะกดดันเพิ่ม แต่ยังสู้ได้',
      'ฝีมือกำลังมา! ลองรักษาคอมโบต่อเนื่อง'
    ],
    finale: [
      'ช่วงท้ายแล้ว! เก็บอาหารดีต่อเนื่องเพื่อปิดฉาก',
      'บอสใกล้แพ้แล้ว อย่าพลาดอาหารหลอกตา',
      'ทำคอมโบช่วงท้าย จะโจมตีบอสได้แรงมาก'
    ]
  };

  const state = {
    started:false,
    ended:false,
    elapsed:0,
    lastTick:performance.now(),

    pressure:0,
    targetPressure:0,
    assist:false,
    assistUntil:0,

    hpPercent:100,
    hp:0,
    hpMax:0,

    goodHits:0,
    junkHits:0,
    fakeHits:0,
    missGood:0,
    totalAttempts:0,

    combo:0,
    maxCombo:0,
    missionDone:0,
    bossAttacks:0,

    recentMistakes:[],
    recentGoods:[],

    phaseId:'',
    phaseIndex:-1,
    lastCoachAt:-999,
    lastPressureEmitAt:-999,
    lastHelpAt:-999,
    lastEventKey:'',
    lastEventAt:0
  };

  function accuracy(){
    const attempts = Math.max(1, state.goodHits + state.junkHits + state.fakeHits + state.missGood);
    return Math.round((state.goodHits / attempts) * 100);
  }

  function mistakeCountRecent(windowSec){
    const minTime = state.elapsed - (windowSec || 12);
    state.recentMistakes = state.recentMistakes.filter(t => t >= minTime);
    return state.recentMistakes.length;
  }

  function goodCountRecent(windowSec){
    const minTime = state.elapsed - (windowSec || 12);
    state.recentGoods = state.recentGoods.filter(t => t >= minTime);
    return state.recentGoods.length;
  }

  function ensureLayer(){
    let root = DOC.getElementById('gjDirectorLayer');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'gjDirectorLayer';
    root.innerHTML = `
      <div class="gjdir-phase" id="gjDirPhase">
        <div class="gjdir-phase-icon" id="gjDirPhaseIcon">🥗</div>
        <div>
          <b id="gjDirPhaseTitle">Healthy Start!</b>
          <span id="gjDirPhaseDesc">เลือกอาหารดีเพื่อเปิดทางสู้บอส</span>
        </div>
      </div>

      <div class="gjdir-coach" id="gjDirCoach">
        <div class="gjdir-coach-face" id="gjDirCoachFace">🤖</div>
        <div>
          <b id="gjDirCoachTitle">AI Coach</b>
          <span id="gjDirCoachText">พร้อมช่วยเลือกอาหารให้ถูกต้อง</span>
        </div>
      </div>

      <div class="gjdir-pressure" id="gjDirPressure">
        <span>Fair Pressure</span>
        <div class="gjdir-dots" id="gjDirDots"></div>
      </div>
    `;

    DOC.body.appendChild(root);

    if(!DOC.getElementById('gjDirectorStyle')){
      const css = DOC.createElement('style');
      css.id = 'gjDirectorStyle';
      css.textContent = `
        #gjDirectorLayer{
          position:fixed;
          inset:0;
          z-index:99975;
          pointer-events:none;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .gjdir-phase{
          position:absolute;
          left:50%;
          top:calc(156px + env(safe-area-inset-top));
          transform:translateX(-50%) translateY(-12px) scale(.96);
          width:min(520px, calc(100vw - 24px));
          display:flex;
          gap:10px;
          align-items:center;
          border-radius:24px;
          padding:12px 14px;
          background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(219,234,254,.92));
          border:2px solid rgba(255,255,255,.90);
          box-shadow:0 18px 42px rgba(15,23,42,.20);
          color:#0f172a;
          opacity:0;
          transition:opacity .18s ease, transform .18s ease;
          backdrop-filter:blur(10px);
        }

        .gjdir-phase.show{
          opacity:1;
          transform:translateX(-50%) translateY(0) scale(1);
        }

        .gjdir-phase-icon{
          width:50px;
          height:50px;
          border-radius:18px;
          display:grid;
          place-items:center;
          font-size:30px;
          background:linear-gradient(180deg,#fff7ed,#fde68a);
          box-shadow:inset 0 -5px 0 rgba(0,0,0,.08);
        }

        .gjdir-phase b{
          display:block;
          font-size:19px;
          line-height:1.1;
        }

        .gjdir-phase span{
          display:block;
          margin-top:4px;
          color:#475569;
          font-size:13px;
          font-weight:800;
          line-height:1.25;
        }

        .gjdir-coach{
          position:absolute;
          left:12px;
          bottom:calc(104px + env(safe-area-inset-bottom));
          width:min(360px, calc(100vw - 88px));
          display:flex;
          gap:9px;
          align-items:center;
          border-radius:22px;
          padding:10px 12px;
          background:linear-gradient(135deg,rgba(240,253,244,.96),rgba(255,255,255,.94));
          border:2px solid rgba(255,255,255,.88);
          box-shadow:0 16px 36px rgba(15,23,42,.18);
          opacity:0;
          transform:translateY(12px) scale(.96);
          transition:opacity .18s ease, transform .18s ease;
          color:#0f172a;
          backdrop-filter:blur(9px);
        }

        .gjdir-coach.show{
          opacity:1;
          transform:translateY(0) scale(1);
        }

        .gjdir-coach-face{
          width:42px;
          height:42px;
          border-radius:16px;
          display:grid;
          place-items:center;
          font-size:24px;
          background:linear-gradient(180deg,#dbeafe,#bbf7d0);
          box-shadow:inset 0 -4px 0 rgba(0,0,0,.07);
        }

        .gjdir-coach b{
          display:block;
          font-size:13px;
          line-height:1.1;
          color:#2563eb;
        }

        .gjdir-coach span{
          display:block;
          margin-top:3px;
          color:#334155;
          font-size:12px;
          font-weight:800;
          line-height:1.25;
        }

        .gjdir-pressure{
          position:absolute;
          right:calc(66px + env(safe-area-inset-right));
          bottom:calc(106px + env(safe-area-inset-bottom));
          min-width:132px;
          border-radius:999px;
          padding:8px 11px;
          background:rgba(15,23,42,.74);
          color:#fff;
          border:2px solid rgba(255,255,255,.70);
          box-shadow:0 12px 28px rgba(15,23,42,.20);
          backdrop-filter:blur(8px);
        }

        .gjdir-pressure span{
          display:block;
          margin-bottom:5px;
          font-size:10px;
          font-weight:1000;
          text-transform:uppercase;
          letter-spacing:.08em;
          color:#bfdbfe;
        }

        .gjdir-dots{
          display:flex;
          gap:4px;
        }

        .gjdir-dot{
          width:12px;
          height:12px;
          border-radius:999px;
          background:rgba(255,255,255,.26);
        }

        .gjdir-dot.on{
          background:linear-gradient(135deg,#22c55e,#facc15,#fb7185);
          box-shadow:0 0 10px rgba(250,204,21,.45);
        }

        .gjdir-dot.help{
          background:linear-gradient(135deg,#38bdf8,#22c55e);
          box-shadow:0 0 10px rgba(56,189,248,.45);
        }

        @media (max-width:640px){
          .gjdir-phase{
            top:calc(135px + env(safe-area-inset-top));
            padding:10px 12px;
            border-radius:21px;
          }

          .gjdir-phase-icon{
            width:42px;
            height:42px;
            font-size:25px;
            border-radius:15px;
          }

          .gjdir-phase b{
            font-size:16px;
          }

          .gjdir-phase span{
            font-size:12px;
          }

          .gjdir-coach{
            left:9px;
            bottom:calc(92px + env(safe-area-inset-bottom));
            width:min(310px, calc(100vw - 76px));
            border-radius:19px;
            padding:8px 10px;
          }

          .gjdir-coach-face{
            width:36px;
            height:36px;
            font-size:21px;
            border-radius:13px;
          }

          .gjdir-coach span{
            font-size:11px;
          }

          .gjdir-pressure{
            right:calc(58px + env(safe-area-inset-right));
            bottom:calc(94px + env(safe-area-inset-bottom));
            min-width:116px;
            padding:7px 9px;
          }

          .gjdir-dot{
            width:10px;
            height:10px;
          }
        }
      `;
      DOC.head.appendChild(css);
    }

    renderPressureDots();
    return root;
  }

  function setText(id, txt){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(txt ?? '');
  }

  let phaseTimer = null;
  function showPhase(phase){
    ensureLayer();

    const box = DOC.getElementById('gjDirPhase');
    if(!box) return;

    setText('gjDirPhaseIcon', phase.icon);
    setText('gjDirPhaseTitle', phase.title);
    setText('gjDirPhaseDesc', phase.desc);

    box.classList.add('show');
    clearTimeout(phaseTimer);
    phaseTimer = setTimeout(()=>box.classList.remove('show'), 2300);

    WIN.dispatchEvent(new CustomEvent('gj:director-finale-phase', {
      detail:{
        patch:PATCH,
        phaseId:phase.id,
        phaseIndex:state.phaseIndex,
        title:phase.title,
        desc:phase.desc,
        icon:phase.icon,
        hpPercent:state.hpPercent,
        pressure:state.pressure
      }
    }));

    coach(phase.coach, phase.icon, 'Phase Coach', true);
  }

  let coachTimer = null;
  function coach(text, face, title, force){
    if(!CFG.enabled) return;

    if(!force && state.elapsed - state.lastCoachAt < 8) return;
    state.lastCoachAt = state.elapsed;

    ensureLayer();

    const box = DOC.getElementById('gjDirCoach');
    if(!box) return;

    setText('gjDirCoachFace', face || '🤖');
    setText('gjDirCoachTitle', title || 'AI Coach');
    setText('gjDirCoachText', text || 'ตั้งใจเลือกอาหารให้ดี');

    box.classList.add('show');
    clearTimeout(coachTimer);
    coachTimer = setTimeout(()=>box.classList.remove('show'), 3600);

    WIN.dispatchEvent(new CustomEvent('gj:director-coach-tip', {
      detail:{
        patch:PATCH,
        text,
        face:face || '🤖',
        title:title || 'AI Coach',
        pressure:state.pressure,
        assist:state.assist
      }
    }));
  }

  function renderPressureDots(){
    ensureLayer();

    const dots = DOC.getElementById('gjDirDots');
    if(!dots) return;

    let html = '';
    for(let i = 1; i <= 5; i++){
      const cls = i <= state.pressure
        ? (state.assist ? 'gjdir-dot help on' : 'gjdir-dot on')
        : 'gjdir-dot';
      html += `<i class="${cls}"></i>`;
    }
    dots.innerHTML = html;
  }

  function getCurrentPhaseByHp(){
    const hp = clamp(state.hpPercent, 0, 101);

    let chosen = FINALE_PHASES[0];
    for(const p of FINALE_PHASES){
      if(hp <= p.hpAt) chosen = p;
    }

    return chosen;
  }

  function updatePhase(){
    const phase = getCurrentPhaseByHp();
    const idx = FINALE_PHASES.findIndex(p => p.id === phase.id);

    if(phase.id !== state.phaseId){
      state.phaseId = phase.id;
      state.phaseIndex = idx;
      showPhase(phase);
    }
  }

  function calculateTargetPressure(){
    const acc = accuracy();
    const attempts = state.goodHits + state.junkHits + state.fakeHits + state.missGood;
    const recentMistakes = mistakeCountRecent(12);
    const recentGoods = goodCountRecent(10);

    let target = 1;

    if(state.hpPercent <= 72) target = Math.max(target, 2);
    if(state.hpPercent <= 48) target = Math.max(target, 3);
    if(state.hpPercent <= 25) target = Math.max(target, 4);

    if(acc >= D.rampAccuracy && state.maxCombo >= D.rampCombo && attempts >= 8){
      target += 1;
    }

    if(recentGoods >= 6 && state.combo >= 5){
      target += 1;
    }

    if(state.missionDone >= 2){
      target += 1;
    }

    if(recentMistakes >= D.helpMistakes){
      target -= 2;
    }

    if(attempts >= 8 && acc < D.helpAccuracy){
      target -= 1;
    }

    if(state.assist){
      target = Math.min(target, 2);
    }

    return clamp(target, 0, D.maxPressure);
  }

  function updateAssist(){
    const attempts = state.goodHits + state.junkHits + state.fakeHits + state.missGood;
    const acc = accuracy();
    const recentMistakes = mistakeCountRecent(12);

    const shouldAssist =
      attempts >= 6 &&
      (
        recentMistakes >= D.helpMistakes ||
        (attempts >= 10 && acc < D.helpAccuracy)
      );

    if(shouldAssist && state.elapsed > state.assistUntil){
      state.assist = true;
      state.assistUntil = state.elapsed + 14;

      coach(pick(COACH_TIPS.help), '💚', 'Fair Help', true);

      WIN.dispatchEvent(new CustomEvent('gj:director-fair-help', {
        detail:{
          patch:PATCH,
          assist:true,
          durationSec:14,
          reason:recentMistakes >= D.helpMistakes ? 'recent-mistakes' : 'low-accuracy',
          accuracy:acc,
          recentMistakes,
          modifiers:getModifiers()
        }
      }));
    }

    if(state.assist && state.elapsed >= state.assistUntil){
      state.assist = false;

      WIN.dispatchEvent(new CustomEvent('gj:director-fair-help', {
        detail:{
          patch:PATCH,
          assist:false,
          reason:'assist-ended',
          accuracy:acc,
          modifiers:getModifiers()
        }
      }));
    }
  }

  function updatePressure(force){
    updateAssist();

    state.targetPressure = calculateTargetPressure();

    if(state.pressure < state.targetPressure){
      state.pressure += 1;
      if(state.pressure >= 3){
        coach(pick(COACH_TIPS.ramp), '⚡', 'Challenge Up', false);
      }
    }else if(state.pressure > state.targetPressure){
      state.pressure -= 1;
      if(state.assist){
        coach('ลดความกดดันให้นิดหนึ่ง ตั้งใจเลือกอาหารทีละชิ้น', '💚', 'Fair Help', false);
      }
    }

    renderPressureDots();

    if(force || state.elapsed - state.lastPressureEmitAt >= 3){
      state.lastPressureEmitAt = state.elapsed;

      WIN.dispatchEvent(new CustomEvent('gj:director-pressure', {
        detail:{
          patch:PATCH,
          pressure:state.pressure,
          targetPressure:state.targetPressure,
          assist:state.assist,
          hpPercent:state.hpPercent,
          accuracy:accuracy(),
          combo:state.combo,
          maxCombo:state.maxCombo,
          recentMistakes:mistakeCountRecent(12),
          modifiers:getModifiers()
        }
      }));
    }
  }

  function getModifiers(){
    const p = clamp(state.pressure, 0, 5);
    const assist = state.assist;

    let speedMul = D.baseSpeed + p * 0.055;
    let spawnIntervalMul = 1 - p * 0.045;
    let junkBoost = 1 + p * 0.055;
    let fakeChanceAdd = p * 0.018;
    let bossAttackMul = 1 - p * 0.045;
    let goodHintChance = 0.04;

    if(state.phaseId === 'fakeParade'){
      fakeChanceAdd += 0.055;
      junkBoost += 0.02;
    }

    if(state.phaseId === 'finalClean'){
      speedMul += 0.08;
      spawnIntervalMul -= 0.04;
      bossAttackMul -= 0.05;
      goodHintChance += 0.04;
    }

    if(state.phaseId === 'lastBite'){
      speedMul += 0.12;
      spawnIntervalMul -= 0.06;
      fakeChanceAdd += 0.035;
      bossAttackMul -= 0.08;
    }

    if(assist){
      speedMul *= 0.86;
      spawnIntervalMul *= 1.14;
      junkBoost *= 0.84;
      fakeChanceAdd *= 0.45;
      bossAttackMul *= 1.18;
      goodHintChance += 0.16;
    }

    return {
      patch:PATCH,
      pressure:p,
      assist,
      phaseId:state.phaseId || 'opening',
      hpPercent:state.hpPercent,

      // เกมหลักใช้คูณความเร็ว target/อาหาร
      speedMul:round(speedMul, 3),

      // เกมหลักใช้คูณ interval; ค่าน้อย = spawn ถี่ขึ้น
      spawnIntervalMul:round(clamp(spawnIntervalMul, 0.68, 1.25), 3),

      // เกมหลักใช้เพิ่มโอกาส junk/fake
      junkBoost:round(clamp(junkBoost, 0.72, 1.45), 3),
      fakeChanceAdd:round(clamp(fakeChanceAdd, 0, 0.18), 3),

      // เกมหลักใช้กับเวลาบอสโจมตี; ค่าน้อย = โจมตีถี่ขึ้น
      bossAttackMul:round(clamp(bossAttackMul, 0.72, 1.28), 3),

      // เกมหลักใช้แสดง glow/outline กับอาหารดีเป็นบางครั้ง
      goodHintChance:round(clamp(goodHintChance, 0, 0.28), 3),

      // กันเด็กท้อ: ช่วง assist ให้ผ่อน mission เล็กน้อย
      missionGraceSec:assist ? 3 : 0
    };
  }

  function round(v, digits){
    const m = Math.pow(10, digits || 2);
    return Math.round(v * m) / m;
  }

  function directFood(food){
    const mod = getModifiers();

    if(!food || typeof food !== 'object'){
      return food;
    }

    const type = String(food.type || food.kind || '').toLowerCase();

    // ช่วง assist ลดอาหารหลอกตา/ขยะบางส่วนแบบยุติธรรม ไม่ได้ทำให้ชนะอัตโนมัติ
    if(mod.assist && (type === 'fake' || type === 'trap' || type === 'junk' || type === 'bad')){
      if(rand() < 0.22){
        return {
          type:'good',
          icon:'🥦',
          name:'ผักช่วยชีวิต',
          group:'veg',
          tip:'ผักช่วยให้ร่างกายแข็งแรง',
          directorConverted:true
        };
      }
    }

    // ช่วง fake parade เพิ่ม tag เตือนให้เกมหลักแสดง effect ได้
    if(state.phaseId === 'fakeParade' && (type === 'fake' || type === 'trap')){
      return {
        ...food,
        directorPhase:'fakeParade',
        warningGlow:true
      };
    }

    // ช่วง final clean อาหารดีมีโอกาสเป็น power food
    if((state.phaseId === 'finalClean' || state.phaseId === 'lastBite') && type === 'good'){
      if(rand() < 0.18){
        return {
          ...food,
          powerFood:true,
          directorPhase:state.phaseId,
          tip:food.tip || 'อาหารดีช่วยปิดฉากบอส'
        };
      }
    }

    return food;
  }

  function shouldShowGoodHint(){
    return rand() < getModifiers().goodHintChance;
  }

  function recordGood(detail){
    state.goodHits += 1;
    state.totalAttempts += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.recentGoods.push(state.elapsed);

    if(state.combo === 5 || state.combo === 10 || state.combo === 15){
      coach(pick(COACH_TIPS.good), '✅', 'Good Combo', false);
    }
  }

  function recordMistake(kind, detail){
    state.totalAttempts += 1;
    state.combo = 0;
    state.recentMistakes.push(state.elapsed);

    if(kind === 'junk'){
      state.junkHits += 1;
      coach(pick(COACH_TIPS.junk), '🍟', 'ระวัง junk', false);
    }else if(kind === 'fake'){
      state.fakeHits += 1;
      coach(pick(COACH_TIPS.fake), '🧃', 'อาหารหลอกตา', false);
    }else{
      state.missGood += 1;
      coach('พลาดอาหารดีไม่เป็นไร รอบหน้ามองหาอาหารที่มีประโยชน์อีกครั้ง', '💚', 'ลองใหม่', false);
    }
  }

  function acceptEvent(type, detail){
    const nowMs = performance.now();
    const x = detail && (detail.x || detail.xy?.x || '');
    const y = detail && (detail.y || detail.xy?.y || '');
    const name = detail && (detail.food?.name || detail.item?.name || detail.name || '');
    const key = `${type}|${name}|${x}|${y}`;

    if(key === state.lastEventKey && nowMs - state.lastEventAt < 90){
      return false;
    }

    state.lastEventKey = key;
    state.lastEventAt = nowMs;
    return true;
  }

  function onItemHit(e){
    const d = e && e.detail ? e.detail : {};
    if(!acceptEvent('item-hit', d)) return;

    const item = d.food || d.item || d;
    const type = String(d.type || item.type || item.kind || '').toLowerCase();

    if(type === 'good') recordGood(d);
    else if(type === 'fake' || type === 'trap' || type === 'fakehealthy') recordMistake('fake', d);
    else if(type === 'junk' || type === 'bad') recordMistake('junk', d);

    updatePressure(false);
  }

  function onGood(e){
    const d = e && e.detail ? e.detail : {};
    if(!acceptEvent('good', d)) return;
    recordGood(d);
    updatePressure(false);
  }

  function onJunk(e){
    const d = e && e.detail ? e.detail : {};
    if(!acceptEvent('junk', d)) return;
    recordMistake('junk', d);
    updatePressure(false);
  }

  function onFake(e){
    const d = e && e.detail ? e.detail : {};
    if(!acceptEvent('fake', d)) return;
    recordMistake('fake', d);
    updatePressure(false);
  }

  function onMissGood(e){
    const d = e && e.detail ? e.detail : {};
    if(!acceptEvent('miss-good', d)) return;
    recordMistake('missGood', d);
    updatePressure(false);
  }

  function onMissionComplete(e){
    const count = n(e.detail && e.detail.missionDoneCount);
    state.missionDone = Math.max(state.missionDone, count || state.missionDone + 1);

    coach('ภารกิจสำเร็จ! ใช้จังหวะนี้โจมตีบอสต่อเลย', '🏅', 'Mission Clear', true);
    updatePressure(true);
  }

  function onBossHp(e){
    const d = e && e.detail ? e.detail : {};

    state.hp = n(d.hp, state.hp);
    state.hpMax = n(d.hpMax, state.hpMax || state.hp || 1);

    if(state.hpMax > 0){
      state.hpPercent = clamp((state.hp / state.hpMax) * 100, 0, 100);
    }

    updatePhase();
    updatePressure(false);

    if(state.hpPercent <= 25 && state.hpPercent > 0){
      coach(pick(COACH_TIPS.finale), '🔥', 'Finale Coach', false);
    }
  }

  function onBossAttack(){
    state.bossAttacks += 1;

    if(state.assist){
      coach('บอสโจมตีแล้ว แต่โหมดช่วยเหลือกำลังลดแรงกดดันให้', '🛡️', 'Fair Help', false);
    }
  }

  function start(){
    if(!CFG.enabled) return;

    state.started = true;
    state.ended = false;
    state.elapsed = 0;
    state.lastTick = performance.now();

    state.pressure = 0;
    state.targetPressure = 0;
    state.assist = false;
    state.assistUntil = 0;

    state.hpPercent = 100;
    state.hp = 0;
    state.hpMax = 0;

    state.goodHits = 0;
    state.junkHits = 0;
    state.fakeHits = 0;
    state.missGood = 0;
    state.totalAttempts = 0;

    state.combo = 0;
    state.maxCombo = 0;
    state.missionDone = 0;
    state.bossAttacks = 0;

    state.recentMistakes = [];
    state.recentGoods = [];

    state.phaseId = '';
    state.phaseIndex = -1;
    state.lastCoachAt = -999;
    state.lastPressureEmitAt = -999;
    state.lastHelpAt = -999;

    ensureLayer();
    updatePhase();
    updatePressure(true);

    coach('โค้ชจะช่วยปรับความท้าทายให้พอดี ไม่ง่ายเกินไปและไม่กดดันเกินไป', '🤖', 'Fair Director', true);

    WIN.dispatchEvent(new CustomEvent('gj:director-start', {
      detail:{
        patch:PATCH,
        diff:CFG.diff,
        modifiers:getModifiers()
      }
    }));
  }

  function end(extra){
    if(!state.started) return;

    state.ended = true;

    const summary = {
      patch:PATCH,
      pressure:state.pressure,
      maxPressure:D.maxPressure,
      assistUsed:state.assistUntil > 0,
      accuracy:accuracy(),
      goodHits:state.goodHits,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      missGood:state.missGood,
      maxCombo:state.maxCombo,
      missionDone:state.missionDone,
      phaseId:state.phaseId,
      bossAttacks:state.bossAttacks,
      modifiers:getModifiers(),
      ...(extra || {})
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_DIRECTOR_LAST', JSON.stringify({
        ...summary,
        savedAt:new Date().toISOString()
      }));
    }catch(e){}

    WIN.dispatchEvent(new CustomEvent('gj:director-summary', {
      detail:summary
    }));

    return summary;
  }

  function tick(){
    const nowMs = performance.now();
    const dt = Math.min(0.08, (nowMs - state.lastTick) / 1000);
    state.lastTick = nowMs;

    if(state.started && !state.ended && CFG.enabled){
      state.elapsed += dt;

      if(Math.floor(state.elapsed) % 3 === 0){
        updatePhase();
      }

      if(state.elapsed - state.lastPressureEmitAt >= 3){
        updatePressure(true);
      }

      if(state.assist && state.elapsed >= state.assistUntil){
        updateAssist();
        updatePressure(true);
      }
    }

    requestAnimationFrame(tick);
  }

  WIN.GoodJunkSoloBossDirector = {
    version:PATCH,
    start,
    end,
    getModifiers,
    directFood,
    shouldShowGoodHint,
    coach,
    updatePressure,
    getState:()=>JSON.parse(JSON.stringify({
      started:state.started,
      ended:state.ended,
      elapsed:state.elapsed,
      pressure:state.pressure,
      targetPressure:state.targetPressure,
      assist:state.assist,
      assistUntil:state.assistUntil,
      hpPercent:state.hpPercent,
      accuracy:accuracy(),
      goodHits:state.goodHits,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      missGood:state.missGood,
      combo:state.combo,
      maxCombo:state.maxCombo,
      missionDone:state.missionDone,
      phaseId:state.phaseId,
      phaseIndex:state.phaseIndex,
      modifiers:getModifiers()
    }))
  };

  WIN.addEventListener('gj:game-start', start);
  WIN.addEventListener('gj:boss-start', start);
  WIN.addEventListener('gj:solo-boss-start', start);

  WIN.addEventListener('gj:item-hit', onItemHit);
  WIN.addEventListener('gj:hit-good', onGood);
  WIN.addEventListener('gj:hit-junk', onJunk);
  WIN.addEventListener('gj:hit-fake', onFake);
  WIN.addEventListener('gj:miss-good', onMissGood);

  WIN.addEventListener('gj:ultimate-mission-complete', onMissionComplete);
  WIN.addEventListener('gj:boss-hp-change', onBossHp);
  WIN.addEventListener('gj:boss-visual-attack', onBossAttack);
  WIN.addEventListener('gj:ultimate-boss-attack', onBossAttack);

  WIN.addEventListener('gj:boss-defeated', e => end({
    defeated:true,
    ...(e.detail || {})
  }));

  WIN.addEventListener('gj:game-end', e => end(e.detail || {}));
  WIN.addEventListener('gj:boss-end', e => end(e.detail || {}));

  DOC.addEventListener('DOMContentLoaded', ensureLayer);
  requestAnimationFrame(tick);
})();