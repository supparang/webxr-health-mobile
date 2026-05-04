// === /herohealth/vr-goodjunk/goodjunk-solo-boss-ultimate.js ===
// GoodJunk Solo Boss Ultimate Addon
// PATCH v8.40.1-BOSS-REPLAY-ANTI-BORING-CORE
// ✅ replay pattern ไม่ซ้ำง่าย
// ✅ mini mission ระหว่าง boss
// ✅ fake healthy trap
// ✅ boss counter attack
// ✅ child-friendly feedback
// ✅ ไม่ยุ่ง backend / ไม่ยุ่ง Apps Script

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const QS = new URLSearchParams(location.search || '');

  const CFG = {
    seed: Number(QS.get('seed')) || Date.now(),
    diff: String(QS.get('diff') || 'normal'),
    time: Math.max(60, Number(QS.get('time')) || 120),
    enabled: true
  };

  const DIFF = {
    easy: {
      missionEvery: 22,
      bossAttackEvery: 16,
      fakeChance: 0.12,
      pressureRate: 0.85,
      missionNeed: 2
    },
    normal: {
      missionEvery: 18,
      bossAttackEvery: 13,
      fakeChance: 0.18,
      pressureRate: 1.0,
      missionNeed: 3
    },
    hard: {
      missionEvery: 15,
      bossAttackEvery: 10,
      fakeChance: 0.24,
      pressureRate: 1.16,
      missionNeed: 4
    },
    challenge: {
      missionEvery: 12,
      bossAttackEvery: 8,
      fakeChance: 0.30,
      pressureRate: 1.32,
      missionNeed: 5
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

  const FOOD_BANK = {
    good: [
      { icon:'🍎', name:'แอปเปิล', group:'fruit', tip:'ผลไม้ช่วยเพิ่มวิตามิน' },
      { icon:'🍌', name:'กล้วย', group:'fruit', tip:'ให้พลังงานที่ดี' },
      { icon:'🥦', name:'บรอกโคลี', group:'veg', tip:'ผักช่วยให้ร่างกายแข็งแรง' },
      { icon:'🥕', name:'แครอท', group:'veg', tip:'ผักสีส้มมีประโยชน์ต่อสายตา' },
      { icon:'🥚', name:'ไข่', group:'protein', tip:'โปรตีนช่วยซ่อมแซมร่างกาย' },
      { icon:'🐟', name:'ปลา', group:'protein', tip:'ปลาเป็นโปรตีนที่ดี' },
      { icon:'🍚', name:'ข้าว', group:'carb', tip:'คาร์โบไฮเดรตให้พลังงาน' },
      { icon:'🥛', name:'นม', group:'protein', tip:'นมช่วยเรื่องกระดูกและฟัน' },
      { icon:'🫘', name:'ถั่ว', group:'protein', tip:'ถั่วเป็นโปรตีนจากพืช' }
    ],
    junk: [
      { icon:'🍟', name:'เฟรนช์ฟรายส์', group:'junk', tip:'ของทอดควรกินแต่น้อย' },
      { icon:'🍩', name:'โดนัท', group:'junk', tip:'หวานมาก กินบ่อยไม่ดี' },
      { icon:'🍭', name:'ลูกอม', group:'junk', tip:'น้ำตาลสูง ทำให้ฟันผุได้' },
      { icon:'🥤', name:'น้ำอัดลม', group:'junk', tip:'น้ำตาลสูง ดื่มบ่อยไม่ดี' },
      { icon:'🍔', name:'เบอร์เกอร์', group:'junk', tip:'ไขมันและโซเดียมสูง' },
      { icon:'🍕', name:'พิซซ่า', group:'junk', tip:'ควรกินพอดี ไม่บ่อยเกินไป' }
    ],
    fakeHealthy: [
      { icon:'🧃', name:'น้ำผลไม้หวาน', group:'fake', tip:'ดูเหมือนผลไม้ แต่บางชนิดน้ำตาลสูงมาก' },
      { icon:'🥣', name:'ซีเรียลหวาน', group:'fake', tip:'บางแบบมีน้ำตาลแฝงสูง' },
      { icon:'🍌', name:'กล้วยทอด', group:'fake', tip:'กล้วยดี แต่ทอดแล้วมีน้ำมันมาก' },
      { icon:'🥗', name:'สลัดราดครีมเยอะ', group:'fake', tip:'ผักดี แต่ซอสครีมมากไปไม่ดี' }
    ]
  };

  const PHASE_PATTERNS = [
    {
      id:'storm',
      name:'Junk Storm',
      title:'พายุอาหารขยะ!',
      desc:'ขยะมาเยอะขึ้น ต้องหลบให้ไว',
      effect:{
        junkBoost:1.35,
        goodBoost:0.90,
        fakeBoost:1.0,
        speedBoost:1.10
      }
    },
    {
      id:'protein',
      name:'Protein Charge',
      title:'ภารกิจพลังโปรตีน!',
      desc:'เก็บโปรตีนให้มาก บอสจะโดนโจมตีแรงขึ้น',
      effect:{
        targetGroup:'protein',
        junkBoost:1.0,
        goodBoost:1.10,
        fakeBoost:1.0,
        speedBoost:1.0
      }
    },
    {
      id:'rainbow',
      name:'Rainbow Plate',
      title:'จานสีรุ้ง!',
      desc:'เก็บผักและผลไม้เพื่อชาร์จพลัง',
      effect:{
        targetGroups:['veg','fruit'],
        junkBoost:0.95,
        goodBoost:1.20,
        fakeBoost:1.1,
        speedBoost:1.0
      }
    },
    {
      id:'trap',
      name:'Fake Healthy Trap',
      title:'อาหารหลอกตา!',
      desc:'ของบางอย่างดูดี แต่มีน้ำตาล/น้ำมันแฝง',
      effect:{
        junkBoost:1.0,
        goodBoost:1.0,
        fakeBoost:1.75,
        speedBoost:1.05
      }
    },
    {
      id:'frenzy',
      name:'Boss Frenzy',
      title:'บอสคลั่งแล้ว!',
      desc:'เร็วขึ้น แต่ถ้าคอมโบสูงจะสวนกลับได้แรง',
      effect:{
        junkBoost:1.15,
        goodBoost:1.10,
        fakeBoost:1.2,
        speedBoost:1.25
      }
    }
  ];

  const MISSIONS = [
    {
      id:'good3',
      label:'เก็บอาหารดีให้ครบ',
      build:()=>({ kind:'good', need:D.missionNeed, progress:0 }),
      text:m=>`เก็บอาหารดี ${m.progress}/${m.need}`
    },
    {
      id:'nojunk',
      label:'หลบ junk ให้ได้',
      build:()=>({ kind:'noJunk', need:10, progress:0, secondsLeft:10 }),
      text:m=>`อย่าแตะ junk ${Math.ceil(m.secondsLeft)} วิ`
    },
    {
      id:'protein',
      label:'หาโปรตีน',
      build:()=>({ kind:'group', group:'protein', need:Math.max(2, D.missionNeed - 1), progress:0 }),
      text:m=>`เก็บโปรตีน ${m.progress}/${m.need}`
    },
    {
      id:'rainbow',
      label:'ผักผลไม้',
      build:()=>({ kind:'groups', groups:['veg','fruit'], need:D.missionNeed, progress:0 }),
      text:m=>`เก็บผัก/ผลไม้ ${m.progress}/${m.need}`
    }
  ];

  const state = {
    started:false,
    ended:false,
    elapsed:0,
    phaseIndex:0,
    phase:null,
    nextPhaseAt:0,
    lastMissionAt:-999,
    lastBossAttackAt:-999,
    mission:null,
    missionDoneCount:0,
    bossRage:0,
    combo:0,
    maxCombo:0,
    shield:0,
    fever:0,
    scoreBonus:0,
    misses:0,
    fakeHits:0,
    goodHits:0,
    junkHits:0,
    learningTips:[]
  };

  function ensureLayer(){
    let root = DOC.getElementById('gjUltimateLayer');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'gjUltimateLayer';
    root.innerHTML = `
      <div class="gj-u-top">
        <div class="gj-u-boss">
          <div class="gj-u-boss-face" id="gjUBossFace">👾</div>
          <div class="gj-u-boss-text">
            <b id="gjUPhaseTitle">Boss Ready</b>
            <span id="gjUPhaseDesc">เตรียมลุย!</span>
          </div>
        </div>
        <div class="gj-u-mission" id="gjUMissionBox">
          <b>ภารกิจ</b>
          <span id="gjUMissionText">รอภารกิจ...</span>
        </div>
      </div>
      <div class="gj-u-toast" id="gjUToast" aria-live="polite"></div>
      <div class="gj-u-floating" id="gjUFloating"></div>
    `;
    DOC.body.appendChild(root);

    const css = DOC.createElement('style');
    css.id = 'gjUltimateStyle';
    css.textContent = `
      #gjUltimateLayer{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:99990;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      .gj-u-top{
        position:absolute;
        top:calc(10px + env(safe-area-inset-top));
        left:10px;
        right:10px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        align-items:start;
      }
      .gj-u-boss,
      .gj-u-mission{
        border:2px solid rgba(255,255,255,.78);
        background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(255,247,220,.90));
        color:#334155;
        border-radius:20px;
        box-shadow:0 10px 24px rgba(15,23,42,.16);
        padding:10px 12px;
        min-height:70px;
        backdrop-filter:blur(8px);
      }
      .gj-u-boss{
        display:flex;
        gap:10px;
        align-items:center;
      }
      .gj-u-boss-face{
        width:50px;
        height:50px;
        display:grid;
        place-items:center;
        border-radius:17px;
        background:linear-gradient(180deg,#fff7ed,#fed7aa);
        font-size:30px;
        box-shadow:inset 0 -4px 0 rgba(0,0,0,.07);
      }
      .gj-u-boss-text b,
      .gj-u-mission b{
        display:block;
        font-size:15px;
        line-height:1.15;
        color:#0f172a;
      }
      .gj-u-boss-text span,
      .gj-u-mission span{
        display:block;
        margin-top:4px;
        font-size:13px;
        line-height:1.25;
        color:#475569;
      }
      .gj-u-mission{
        background:linear-gradient(135deg,rgba(236,253,245,.94),rgba(219,234,254,.90));
      }
      .gj-u-toast{
        position:absolute;
        left:50%;
        top:47%;
        transform:translate(-50%,-50%) scale(.98);
        min-width:min(82vw,430px);
        max-width:90vw;
        text-align:center;
        padding:14px 16px;
        border-radius:24px;
        background:rgba(15,23,42,.88);
        color:#fff;
        font-weight:900;
        font-size:20px;
        line-height:1.25;
        opacity:0;
        filter:drop-shadow(0 16px 28px rgba(15,23,42,.35));
        transition:opacity .18s ease, transform .18s ease;
      }
      .gj-u-toast.show{
        opacity:1;
        transform:translate(-50%,-50%) scale(1);
      }
      .gj-u-toast small{
        display:block;
        margin-top:6px;
        font-size:13px;
        font-weight:700;
        color:#fde68a;
      }
      .gj-u-floating{
        position:absolute;
        left:0;
        top:0;
        right:0;
        bottom:0;
      }
      .gj-u-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font-weight:1000;
        font-size:24px;
        color:#fff;
        text-shadow:0 3px 10px rgba(0,0,0,.35);
        animation:gjUPop .75s ease forwards;
      }
      @keyframes gjUPop{
        0%{ opacity:0; transform:translate(-50%,-40%) scale(.7); }
        18%{ opacity:1; transform:translate(-50%,-55%) scale(1.16); }
        100%{ opacity:0; transform:translate(-50%,-100%) scale(.9); }
      }
      .gj-u-shake{
        animation:gjUShake .32s ease;
      }
      @keyframes gjUShake{
        0%,100%{ transform:translate(0,0); }
        20%{ transform:translate(-5px,2px); }
        40%{ transform:translate(5px,-2px); }
        60%{ transform:translate(-4px,1px); }
        80%{ transform:translate(4px,-1px); }
      }
      @media (max-width:640px){
        .gj-u-top{
          grid-template-columns:1fr;
          gap:7px;
        }
        .gj-u-boss,
        .gj-u-mission{
          min-height:auto;
          padding:8px 10px;
          border-radius:17px;
        }
        .gj-u-boss-face{
          width:42px;
          height:42px;
          font-size:25px;
          border-radius:14px;
        }
        .gj-u-boss-text b,
        .gj-u-mission b{
          font-size:14px;
        }
        .gj-u-boss-text span,
        .gj-u-mission span{
          font-size:12px;
        }
        .gj-u-toast{
          font-size:18px;
        }
      }
    `;
    DOC.head.appendChild(css);

    return root;
  }

  function setText(id, txt){
    const el = DOC.getElementById(id);
    if(el) el.textContent = txt;
  }

  let toastTimer = null;
  function toast(main, sub){
    ensureLayer();
    const el = DOC.getElementById('gjUToast');
    if(!el) return;

    el.innerHTML = sub
      ? `${escapeHtml(main)}<small>${escapeHtml(sub)}</small>`
      : escapeHtml(main);

    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>el.classList.remove('show'), 1500);
  }

  function pop(text, x, y){
    ensureLayer();
    const box = DOC.getElementById('gjUFloating');
    if(!box) return;

    const p = DOC.createElement('div');
    p.className = 'gj-u-pop';
    p.textContent = text;
    p.style.left = `${clamp(Number(x) || 50, 10, 90)}%`;
    p.style.top = `${clamp(Number(y) || 50, 16, 86)}%`;
    box.appendChild(p);
    setTimeout(()=>p.remove(), 850);
  }

  function shake(){
    DOC.body.classList.remove('gj-u-shake');
    void DOC.body.offsetWidth;
    DOC.body.classList.add('gj-u-shake');
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function choosePhase(){
    const prev = state.phase && state.phase.id;
    let choices = PHASE_PATTERNS.filter(p => p.id !== prev);
    const phase = pick(choices);
    state.phase = phase;
    state.phaseIndex += 1;

    setText('gjUPhaseTitle', phase.title);
    setText('gjUPhaseDesc', phase.desc);

    const face = DOC.getElementById('gjUBossFace');
    if(face){
      face.textContent = phase.id === 'storm' ? '🌪️'
        : phase.id === 'protein' ? '💪'
        : phase.id === 'rainbow' ? '🌈'
        : phase.id === 'trap' ? '🧃'
        : '👾';
    }

    toast(phase.title, phase.desc);

    WIN.dispatchEvent(new CustomEvent('gj:ultimate-phase', {
      detail:{
        phaseId:phase.id,
        phaseIndex:state.phaseIndex,
        effect:phase.effect
      }
    }));
  }

  function startMission(){
    const template = pick(MISSIONS);
    state.mission = {
      id:template.id,
      label:template.label,
      ...template.build(),
      startedAt:state.elapsed
    };

    updateMissionText();
    toast(`ภารกิจใหม่: ${template.label}`, getMissionText());
  }

  function getMissionText(){
    if(!state.mission) return 'รอภารกิจ...';
    const t = MISSIONS.find(x => x.id === state.mission.id);
    return t ? t.text(state.mission) : 'ทำภารกิจให้สำเร็จ';
  }

  function updateMissionText(){
    const box = DOC.getElementById('gjUMissionBox');
    setText('gjUMissionText', getMissionText());

    if(box && state.mission){
      box.style.transform = 'scale(1.02)';
      setTimeout(()=>{ box.style.transform = ''; }, 130);
    }
  }

  function completeMission(){
    state.missionDoneCount += 1;
    state.scoreBonus += 50;
    state.shield = Math.min(3, state.shield + 1);
    toast('ภารกิจสำเร็จ! +Shield', 'บอสโจมตีเบาลง 1 ครั้ง');
    pop('+MISSION', 50, 42);

    WIN.dispatchEvent(new CustomEvent('gj:ultimate-mission-complete', {
      detail:{
        missionDoneCount:state.missionDoneCount,
        shield:state.shield,
        scoreBonus:state.scoreBonus
      }
    }));

    state.mission = null;
    updateMissionText();
  }

  function bossAttack(reason){
    if(state.shield > 0){
      state.shield -= 1;
      toast('โล่ช่วยไว้ได้! 🛡️', 'ระวัง junk รอบต่อไป');
      pop('SHIELD!', 50, 54);

      WIN.dispatchEvent(new CustomEvent('gj:ultimate-shield-block', {
        detail:{ shield:state.shield, reason }
      }));
      return;
    }

    state.bossRage = clamp(state.bossRage + 10, 0, 100);
    state.combo = 0;
    shake();
    toast('บอสสวนกลับ!', reason || 'พลาดแล้ว ต้องตั้งใจใหม่');
    pop('BOSS HIT!', 50, 54);

    WIN.dispatchEvent(new CustomEvent('gj:ultimate-boss-attack', {
      detail:{
        reason,
        bossRage:state.bossRage
      }
    }));
  }

  function onGood(food, xy){
    if(state.ended) return;

    state.goodHits += 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    const group = food && food.group;
    const label = food && food.icon ? food.icon : '✅';

    pop(`${label} +${10 + Math.min(30, state.combo * 2)}`, xy?.x, xy?.y);

    if(state.combo > 0 && state.combo % 5 === 0){
      toast(`Combo x${state.combo}!`, 'บอสโดนโจมตีแรงขึ้น');
      WIN.dispatchEvent(new CustomEvent('gj:ultimate-combo-strike', {
        detail:{ combo:state.combo }
      }));
    }

    if(state.mission){
      if(state.mission.kind === 'good'){
        state.mission.progress += 1;
      }else if(state.mission.kind === 'group' && state.mission.group === group){
        state.mission.progress += 1;
      }else if(state.mission.kind === 'groups' && state.mission.groups.includes(group)){
        state.mission.progress += 1;
      }

      if(state.mission.progress >= state.mission.need){
        completeMission();
      }else{
        updateMissionText();
      }
    }
  }

  function onJunk(food, xy){
    if(state.ended) return;

    state.junkHits += 1;
    state.misses += 1;
    state.combo = 0;

    const tip = food && food.tip ? food.tip : 'อาหารขยะควรกินแต่น้อย';
    state.learningTips.push(tip);
    if(state.learningTips.length > 5) state.learningTips.shift();

    pop('MISS!', xy?.x, xy?.y);

    if(state.mission && state.mission.kind === 'noJunk'){
      state.mission = null;
      updateMissionText();
      bossAttack('ภารกิจหลบ junk ล้มเหลว');
    }else{
      bossAttack(tip);
    }
  }

  function onFake(food, xy){
    if(state.ended) return;

    state.fakeHits += 1;
    state.misses += 1;
    state.combo = 0;

    const tip = food && food.tip ? food.tip : 'อาหารหลอกตา ต้องดูน้ำตาล/น้ำมันแฝง';
    state.learningTips.push(tip);
    if(state.learningTips.length > 5) state.learningTips.shift();

    pop('TRAP!', xy?.x, xy?.y);
    bossAttack(tip);
  }

  function onMissGood(food, xy){
    if(state.ended) return;

    state.misses += 1;
    state.combo = 0;
    pop('พลาด!', xy?.x, xy?.y);

    if(state.misses % 3 === 0){
      bossAttack('พลาดอาหารดีหลายครั้งแล้ว');
    }
  }

  function tick(dt){
    if(!state.started || state.ended) return;

    dt = Number(dt);
    if(!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;

    state.elapsed += dt;

    if(!state.phase || state.elapsed >= state.nextPhaseAt){
      choosePhase();
      state.nextPhaseAt = state.elapsed + pick([18, 22, 26]) / D.pressureRate;
    }

    if(!state.mission && state.elapsed - state.lastMissionAt >= D.missionEvery){
      state.lastMissionAt = state.elapsed;
      startMission();
    }

    if(state.mission && state.mission.kind === 'noJunk'){
      state.mission.secondsLeft -= dt;
      if(state.mission.secondsLeft <= 0){
        state.mission.progress = state.mission.need;
        completeMission();
      }else{
        updateMissionText();
      }
    }

    if(state.elapsed - state.lastBossAttackAt >= D.bossAttackEvery){
      state.lastBossAttackAt = state.elapsed;

      if(state.combo < 3 && state.elapsed > 10){
        bossAttack('บอสกดดัน! ต้องทำคอมโบให้ได้');
      }else if(state.combo >= 6){
        toast('สวนกลับสำเร็จ!', `Combo x${state.combo} ทำให้บอสชะงัก`);
        WIN.dispatchEvent(new CustomEvent('gj:ultimate-counter-strike', {
          detail:{ combo:state.combo }
        }));
      }
    }
  }

  function start(){
    if(state.started) return;
    state.started = true;
    state.ended = false;
    ensureLayer();

    choosePhase();
    state.nextPhaseAt = 18;
    state.lastMissionAt = -999;
    state.lastBossAttackAt = 0;

    toast('Solo Boss Ultimate!', 'ระวังอาหารหลอกตาและภารกิจบอส');
  }

  function end(extra){
    if(state.ended) return;
    state.ended = true;

    const summary = {
      patch:'v8.40.1-BOSS-REPLAY-ANTI-BORING-CORE',
      phaseCount:state.phaseIndex,
      missionDoneCount:state.missionDoneCount,
      maxCombo:state.maxCombo,
      goodHits:state.goodHits,
      junkHits:state.junkHits,
      fakeHits:state.fakeHits,
      misses:state.misses,
      scoreBonus:state.scoreBonus,
      learningTips:[...new Set(state.learningTips)].slice(0,3),
      ...extra
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_ULTIMATE_LAST', JSON.stringify({
        ...summary,
        savedAt:new Date().toISOString()
      }));
    }catch(e){}

    WIN.dispatchEvent(new CustomEvent('gj:ultimate-summary', {
      detail:summary
    }));

    return summary;
  }

  function getSpawnProfile(){
    const phase = state.phase || PHASE_PATTERNS[0];
    const e = phase.effect || {};

    return {
      phaseId:phase.id,
      phaseTitle:phase.title,
      junkBoost:e.junkBoost || 1,
      goodBoost:e.goodBoost || 1,
      fakeBoost:(e.fakeBoost || 1) * (1 + D.fakeChance),
      speedBoost:e.speedBoost || 1,
      targetGroup:e.targetGroup || null,
      targetGroups:e.targetGroups || null,
      fakeChance:D.fakeChance
    };
  }

  function makeFoodSuggestion(){
    const p = getSpawnProfile();
    let roll = rand();

    const fakeChance = clamp(D.fakeChance * p.fakeBoost, 0.08, 0.45);
    const junkChance = clamp(0.34 * p.junkBoost, 0.20, 0.58);

    if(roll < fakeChance){
      return {
        type:'fake',
        ...pick(FOOD_BANK.fakeHealthy)
      };
    }

    if(roll < fakeChance + junkChance){
      return {
        type:'junk',
        ...pick(FOOD_BANK.junk)
      };
    }

    let goods = FOOD_BANK.good.slice();

    if(p.targetGroup){
      const targeted = goods.filter(f => f.group === p.targetGroup);
      if(targeted.length && rand() < 0.55) goods = targeted;
    }

    if(p.targetGroups){
      const targeted = goods.filter(f => p.targetGroups.includes(f.group));
      if(targeted.length && rand() < 0.60) goods = targeted;
    }

    return {
      type:'good',
      ...pick(goods)
    };
  }

  function bridgeHit(payload){
    payload = payload || {};
    const food = payload.food || payload.item || payload;
    const xy = payload.xy || {
      x:payload.x,
      y:payload.y
    };

    const type = String(payload.type || food.type || food.kind || '').toLowerCase();

    if(type === 'good') onGood(food, xy);
    else if(type === 'fake' || type === 'fakehealthy' || type === 'trap') onFake(food, xy);
    else if(type === 'junk' || type === 'bad') onJunk(food, xy);
  }

  function bridgeMiss(payload){
    payload = payload || {};
    onMissGood(payload.food || payload.item || payload, payload.xy || { x:payload.x, y:payload.y });
  }

  WIN.GoodJunkSoloBossUltimate = {
    version:'v8.40.1-BOSS-REPLAY-ANTI-BORING-CORE',
    start,
    tick,
    end,
    onGood,
    onJunk,
    onFake,
    onMissGood,
    hit:bridgeHit,
    miss:bridgeMiss,
    getSpawnProfile,
    makeFoodSuggestion,
    getState:()=>JSON.parse(JSON.stringify(state))
  };

  WIN.addEventListener('gj:game-start', start);
  WIN.addEventListener('gj:boss-start', start);
  WIN.addEventListener('gj:solo-boss-start', start);

  WIN.addEventListener('gj:hit-good', e => onGood(e.detail?.food || e.detail, e.detail?.xy));
  WIN.addEventListener('gj:hit-junk', e => onJunk(e.detail?.food || e.detail, e.detail?.xy));
  WIN.addEventListener('gj:hit-fake', e => onFake(e.detail?.food || e.detail, e.detail?.xy));
  WIN.addEventListener('gj:miss-good', e => onMissGood(e.detail?.food || e.detail, e.detail?.xy));

  WIN.addEventListener('gj:item-hit', e => bridgeHit(e.detail));
  WIN.addEventListener('gj:item-miss', e => bridgeMiss(e.detail));

  WIN.addEventListener('gj:game-end', e => end(e.detail || {}));
  WIN.addEventListener('gj:boss-end', e => end(e.detail || {}));

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.08, (now - last) / 1000);
    last = now;
    tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  DOC.addEventListener('DOMContentLoaded', ensureLayer);
})();
