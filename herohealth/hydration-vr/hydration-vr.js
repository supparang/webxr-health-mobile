/* =========================================================
   HeroHealth Hydration VR
   File: /herohealth/hydration-vr/hydration-vr.js
   Version: v9.9.0-full-engine
   Purpose:
   - Aqua Rush hydration game
   - PC / Mobile / Cardboard cVR
   - Wave + Mini Mission + Heat Boss + Fever
   - Badge / Personal Best / Daily Challenge
   - HeroHealth event hooks + safe summary
   ========================================================= */

(function(){
  'use strict';

  window.HHA = window.HHA || {};
  window.HHA.Hydration = window.HHA.Hydration || {
    VERSION: 'v9.9.0-full-engine',
    booted: false,
    started: false,
    destroyed: false,
    timers: new Set(),
    rafId: 0,
    listeners: [],
    debug: false
  };

  const HYD = window.HHA.Hydration;
  HYD.VERSION = 'v9.9.0-full-engine';

  /* =========================================================
     Namespace exports for inline onclick
     ========================================================= */

  window.beginHydrationFromOverlay = beginHydrationFromOverlay;
  window.toggleHydrationPause = toggleHydrationPause;
  window.resumeHydrationGame = resumeHydrationGame;
  window.goHydrationBackHub = goHydrationBackHub;
  window.restartHydrationSameChallenge = restartHydrationSameChallenge;
  window.restartHydrationNewSeed = restartHydrationNewSeed;
  window.answerHydrationQuickCheck = answerHydrationQuickCheck;

  /* =========================================================
     Safe Helpers
     ========================================================= */

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function esc(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function qs(k, d){
    try{
      return new URL(location.href).searchParams.get(k) || d;
    }catch(e){
      return d;
    }
  }

  function hhaHydrationQS(sel, root){
    try{
      return (root || document).querySelector(sel);
    }catch(e){
      return null;
    }
  }

  function hhaHydrationQSA(sel, root){
    try{
      return Array.from((root || document).querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function hhaHydrationRemove(sel){
    hhaHydrationQSA(sel).forEach(n => {
      try{ n.remove(); }catch(e){}
    });
  }

  function hhaHydrationEnsure(id, cls, parent){
    let n = document.getElementById(id);
    if(!n){
      n = document.createElement('div');
      n.id = id;
      if(cls) n.className = cls;
      (parent || document.body).appendChild(n);
    }
    return n;
  }

  function hhaHydrationSetTimeout(fn, ms){
    const id = setTimeout(() => {
      HYD.timers.delete(id);
      try{ fn(); }catch(e){ hhaHydrationDebugError(e); }
    }, ms);
    HYD.timers.add(id);
    return id;
  }

  function hhaHydrationClearTimers(){
    HYD.timers.forEach(id => {
      try{ clearTimeout(id); }catch(e){}
    });
    HYD.timers.clear();
  }

  function hhaHydrationCancelRAF(){
    if(HYD.rafId){
      try{ cancelAnimationFrame(HYD.rafId); }catch(e){}
      HYD.rafId = 0;
    }
  }

  function hhaHydrationOn(target, type, handler, options){
    try{
      target.addEventListener(type, handler, options);
      HYD.listeners.push({ target, type, handler, options });
    }catch(e){}
  }

  function hhaHydrationStorageGet(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(raw === null || raw === undefined) return fallback;
      return raw;
    }catch(e){
      return fallback;
    }
  }

  function hhaHydrationStorageSet(key, value){
    try{
      localStorage.setItem(key, value);
      return true;
    }catch(e){
      return false;
    }
  }

  function hhaHydrationStorageJsonGet(key, fallback){
    try{
      const raw = hhaHydrationStorageGet(key, '');
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  }

  function hhaHydrationStorageJsonSet(key, obj){
    try{
      return hhaHydrationStorageSet(key, JSON.stringify(obj));
    }catch(e){
      return false;
    }
  }

  function hhaHydrationIsDebug(){
    try{
      return new URL(location.href).searchParams.get('debug') === '1';
    }catch(e){
      return false;
    }
  }

  function hhaHydrationDebugLog(){
    if(!HYD.debug) return;
    try{
      console.log.apply(console, ['[Hydration]', ...arguments]);
    }catch(e){}
  }

  function hhaHydrationDebugError(e){
    if(!HYD.debug) return;
    try{
      console.warn('[Hydration Error]', e);
    }catch(_){}
  }

  function getBangkokYmd(){
    try{
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone:'Asia/Bangkok',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      });
      return fmt.format(new Date());
    }catch(e){
      return new Date().toISOString().slice(0,10);
    }
  }

  function updateLiveRegion(text){
    const n = document.getElementById('hha-hydration-live-region');
    if(n) n.textContent = String(text || '');
  }

  /* =========================================================
     Seeded RNG
     ========================================================= */

  function hhaHydrationHashSeed(s){
    s = String(s || 'hydration');
    let h = 2166136261;
    for(let i=0; i<s.length; i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hhaHydrationMulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hhaHydrationMakeRng(seed){
    return hhaHydrationMulberry32(hhaHydrationHashSeed(seed));
  }

  function hhaHydrationRand(){
    if(typeof HYD.rng === 'function') return HYD.rng();
    return Math.random();
  }

  function hhaHydrationPick(arr){
    arr = Array.isArray(arr) ? arr : [];
    if(!arr.length) return null;
    return arr[Math.floor(hhaHydrationRand() * arr.length)];
  }

  /* =========================================================
     Context / Flow
     ========================================================= */

  const HHA_HYDRATION_FLOW = {
    started: false,
    paused: false,
    ended: false,
    pauseStartedAt: 0,
    pausedTotalMs: 0,
    sessionId: '',
    ctx: null
  };

  function makeHydrationSessionId(){
    return 'hydration_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function getHydrationCtx(){
    let u;
    try{ u = new URL(location.href); }
    catch(e){ u = { searchParams: new URLSearchParams() }; }

    return {
      pid: u.searchParams.get('pid') || 'anon',
      name: u.searchParams.get('name') || u.searchParams.get('nick') || 'Hero',
      nick: u.searchParams.get('nick') || u.searchParams.get('name') || 'Hero',
      diff: u.searchParams.get('diff') || 'normal',
      time: Number(u.searchParams.get('time') || 150),
      seed: u.searchParams.get('seed') || String(Date.now()),
      view: u.searchParams.get('view') || 'mobile',
      run: u.searchParams.get('run') || 'play',
      zone: u.searchParams.get('zone') || 'fitness',
      game: u.searchParams.get('game') || 'hydration',
      mode: u.searchParams.get('mode') || u.searchParams.get('view') || 'mobile',
      hub: u.searchParams.get('hub') || '',
      log: u.searchParams.get('log') || '',
      api: u.searchParams.get('api') || '',
      studyId: u.searchParams.get('studyId') || '',
      phase: u.searchParams.get('phase') || '',
      conditionGroup: u.searchParams.get('conditionGroup') || ''
    };
  }

  /* =========================================================
     Data: Waves / Items / Missions / Boss / Learning
     ========================================================= */

  const HHA_HYDRATION_WAVES = [
    {
      id: 'warm-rush',
      name: 'Warm Rush',
      label: 'เริ่มเติมน้ำ!',
      from: 0,
      to: 0.18,
      goodRate: 0.82,
      spawnEvery: 1050,
      speed: 1.0,
      hydrationDrain: 0.04,
      missionChance: 0.15
    },
    {
      id: 'sweat-storm',
      name: 'Sweat Storm',
      label: 'เหงื่อเริ่มมา!',
      from: 0.18,
      to: 0.38,
      goodRate: 0.70,
      spawnEvery: 900,
      speed: 1.14,
      hydrationDrain: 0.075,
      missionChance: 0.24
    },
    {
      id: 'sugar-trap',
      name: 'Sugar Trap',
      label: 'ของหวานหลอก!',
      from: 0.38,
      to: 0.58,
      goodRate: 0.58,
      spawnEvery: 780,
      speed: 1.28,
      hydrationDrain: 0.095,
      missionChance: 0.32
    },
    {
      id: 'crisis',
      name: 'Dehydration Crisis',
      label: 'ระวังร่างกายแห้ง!',
      from: 0.58,
      to: 0.82,
      goodRate: 0.55,
      spawnEvery: 680,
      speed: 1.44,
      hydrationDrain: 0.13,
      missionChance: 0.42
    },
    {
      id: 'heat-boss',
      name: 'Heat Boss',
      label: 'บอสแดดร้อนมาแล้ว!',
      from: 0.82,
      to: 1.01,
      goodRate: 0.50,
      spawnEvery: 610,
      speed: 1.62,
      hydrationDrain: 0.17,
      missionChance: 0.55,
      boss: true
    }
  ];

  const HHA_HYDRATION_ITEMS = {
    good: [
      { id:'water', icon:'💧', label:'น้ำเปล่า', short:'เติมน้ำ!', score:120, hydration:+9, combo:+1, kind:'good' },
      { id:'watermelon', icon:'🍉', label:'แตงโม', short:'ฉ่ำน้ำ!', score:100, hydration:+7, combo:+1, kind:'good' },
      { id:'cucumber', icon:'🥒', label:'แตงกวา', short:'น้ำเยอะ!', score:95, hydration:+6, combo:+1, kind:'good' },
      { id:'ice', icon:'🧊', label:'Ice Shield', short:'กันแดด!', score:80, hydration:+4, shield:+1, combo:+1, kind:'good' },
      { id:'milk', icon:'🥛', label:'นมจืด', short:'ดีต่อร่างกาย!', score:90, hydration:+5, combo:+1, kind:'good' }
    ],
    junk: [
      { id:'soda', icon:'🥤', label:'น้ำอัดลม', short:'หวานเกิน!', score:-80, hydration:-8, combo:0, kind:'junk' },
      { id:'bubbletea', icon:'🧋', label:'ชานมหวาน', short:'น้ำตาลสูง!', score:-100, hydration:-10, combo:0, kind:'junk' },
      { id:'salty', icon:'🍟', label:'เค็มจัด', short:'กระหายน้ำ!', score:-90, hydration:-9, combo:0, kind:'junk' },
      { id:'sun', icon:'🌞', label:'แดดแรง', short:'Heat Attack!', score:-120, hydration:-12, combo:0, kind:'danger' },
      { id:'energy', icon:'⚡', label:'Energy Drink', short:'ไม่เหมาะ!', score:-110, hydration:-11, combo:0, kind:'junk' }
    ]
  };

  const HHA_HYDRATION_LEARN = {
    water: {
      good: true,
      learn: 'น้ำเปล่าช่วยให้ร่างกายสดชื่น',
      why: 'ดื่มน้ำเปล่าเป็นตัวเลือกที่ดีที่สุดเมื่อกระหายน้ำ',
      skill: 'เลือกเครื่องดื่มที่เหมาะสม'
    },
    watermelon: {
      good: true,
      learn: 'แตงโมมีน้ำมาก ช่วยเติมความสดชื่น',
      why: 'ผลไม้ฉ่ำน้ำช่วยเพิ่มน้ำให้ร่างกายได้',
      skill: 'รู้จักอาหารที่ช่วยเติมน้ำ'
    },
    cucumber: {
      good: true,
      learn: 'แตงกวามีน้ำเยอะและกินง่าย',
      why: 'ผักบางชนิดช่วยเพิ่มน้ำและใยอาหาร',
      skill: 'เลือกผักผลไม้ที่เหมาะกับสุขภาพ'
    },
    ice: {
      good: true,
      learn: 'ความเย็นช่วยลดความร้อน แต่ต้องดื่มน้ำให้พอ',
      why: 'Ice Shield ช่วยกัน Heat Attack ในเกม',
      skill: 'ป้องกันความร้อน'
    },
    milk: {
      good: true,
      learn: 'นมจืดเป็นตัวเลือกที่ดีกว่าน้ำหวาน',
      why: 'นมจืดมีประโยชน์และไม่หวานจัด',
      skill: 'แยกเครื่องดื่มดีจากเครื่องดื่มหวาน'
    },
    soda: {
      good: false,
      learn: 'น้ำอัดลมหวานมาก ไม่ควรดื่มแทนน้ำเปล่า',
      why: 'หวานเกินไปและไม่ใช่น้ำหลักของร่างกาย',
      skill: 'หลีกเลี่ยงน้ำหวาน'
    },
    bubbletea: {
      good: false,
      learn: 'ชานมหวานมีน้ำตาลสูง',
      why: 'ดื่มบ่อยเกินไปทำให้ได้รับน้ำตาลมาก',
      skill: 'ตัดสินใจเลือกเครื่องดื่ม'
    },
    salty: {
      good: false,
      learn: 'อาหารเค็มจัดทำให้กระหายน้ำ',
      why: 'กินเค็มมากอาจทำให้ร่างกายต้องการน้ำเพิ่ม',
      skill: 'รู้ผลของอาหารเค็ม'
    },
    sun: {
      good: false,
      learn: 'แดดแรงทำให้เสียเหงื่อเร็ว',
      why: 'เมื่อเสียเหงื่อ ต้องดื่มน้ำให้เพียงพอ',
      skill: 'ดูแลตัวเองเมื่ออากาศร้อน'
    },
    energy: {
      good: false,
      learn: 'Energy drink ไม่เหมาะกับเด็ก',
      why: 'ไม่ควรใช้แทนน้ำเปล่าเมื่อกระหายน้ำ',
      skill: 'เลือกเครื่องดื่มปลอดภัย'
    }
  };

  const HHA_HYDRATION_WAVE_LESSONS = {
    'warm-rush': { icon:'💧', title:'เริ่มเติมน้ำ', text:'น้ำเปล่าเป็นตัวเลือกที่ดีที่สุดเมื่อกระหายน้ำ' },
    'sweat-storm': { icon:'💨', title:'เหงื่อเริ่มมา', text:'เมื่อเหงื่อออก ร่างกายต้องการน้ำเพิ่ม' },
    'sugar-trap': { icon:'🧋', title:'ของหวานหลอก', text:'น้ำหวานไม่ควรใช้แทนน้ำเปล่า' },
    'crisis': { icon:'💚', title:'รักษาโซนเขียว', text:'ดื่มน้ำให้พอดีช่วยให้ร่างกายสดชื่น' },
    'heat-boss': { icon:'🌞', title:'สู้แดดร้อน', text:'แดดแรงทำให้เสียเหงื่อ ต้องเติมน้ำให้พอ' }
  };

  const HHA_HYDRATION_MISSIONS = [
    {
      id:'collect-water',
      icon:'💧',
      title:'เก็บน้ำให้ทัน!',
      instruction:'เก็บของดี 4 ชิ้น',
      duration:9000,
      goal:4,
      type:'collectGood',
      rewardScore:320,
      rewardHydration:10,
      bossDamage:12
    },
    {
      id:'avoid-sugar',
      icon:'🧋',
      title:'หลบน้ำหวาน!',
      instruction:'อย่าโดนของเสี่ยง 8 วิ',
      duration:8000,
      goal:8,
      type:'surviveNoJunk',
      rewardScore:280,
      rewardHydration:6,
      bossDamage:10
    },
    {
      id:'green-zone',
      icon:'💚',
      title:'รักษาโซนเขียว!',
      instruction:'Hydration ≥ 65% นาน 7 วิ',
      duration:11000,
      goal:7,
      type:'holdGreen',
      rewardScore:360,
      rewardHydration:8,
      bossDamage:14
    },
    {
      id:'combo-rush',
      icon:'🔥',
      title:'Combo Rush!',
      instruction:'ทำ Combo 5',
      duration:10000,
      goal:5,
      type:'reachCombo',
      rewardScore:400,
      rewardHydration:5,
      bossDamage:15
    },
    {
      id:'ice-shield',
      icon:'🧊',
      title:'สร้างเกราะน้ำแข็ง!',
      instruction:'เก็บ Ice Shield 1 ชิ้น',
      duration:10000,
      goal:1,
      type:'collectIce',
      rewardScore:260,
      rewardHydration:6,
      rewardShield:1,
      bossDamage:9
    }
  ];

  const HHA_HEAT_BOSS_ATTACKS = [
    { id:'heat-ray', icon:'🌞', name:'Heat Ray', warning:'แดดแรง! รีบเก็บน้ำ', duration:6500, drainBoost:2.2, junkBoost:0.08 },
    { id:'sugar-bomb', icon:'🧋', name:'Sugar Bomb', warning:'ของหวานหลอกมาเยอะ!', duration:7000, drainBoost:1.15, junkBoost:0.20 },
    { id:'salt-storm', icon:'🍟', name:'Salt Storm', warning:'เค็มจัดทำให้กระหายน้ำ!', duration:6500, drainBoost:1.65, junkBoost:0.14 },
    { id:'sweat-drain', icon:'💨', name:'Sweat Drain', warning:'เหงื่อออกเร็ว!', duration:6000, drainBoost:2.0, junkBoost:0.06 }
  ];

  const HHA_HEAT_ATTACK_LESSONS = {
    'heat-ray': 'แดดแรงทำให้เสียเหงื่อเร็ว ต้องเติมน้ำ',
    'sugar-bomb': 'น้ำหวานดื่มบ่อยไม่ดี และไม่แทนน้ำเปล่า',
    'salt-storm': 'กินเค็มจัดอาจทำให้กระหายน้ำมากขึ้น',
    'sweat-drain': 'เหงื่อออกมาก ร่างกายต้องการน้ำเพิ่ม'
  };

  const HHA_HYDRATION_DAILY_CHALLENGES = [
    { id:'green-day', icon:'💚', title:'Green Zone Day', goalText:'จบเกมด้วย Hydration 70%+', test:r => r.hydration >= 70, reward:'Green Hero' },
    { id:'combo-day', icon:'🔥', title:'Combo Splash Day', goalText:'ทำ Combo 10+', test:r => r.maxCombo >= 10, reward:'Fever Bonus' },
    { id:'mission-day', icon:'🎯', title:'Mission Rush Day', goalText:'ทำ Mission สำเร็จ 3 ครั้ง', test:r => r.missionsCompleted >= 3, reward:'Mission Badge' },
    { id:'boss-day', icon:'🌞', title:'Heat Boss Day', goalText:'ชนะ Heat Monster', test:r => r.bossDefeated, reward:'Boss Slayer' },
    { id:'clean-choice-day', icon:'🧋', title:'Sugar Dodger Day', goalText:'โดนของเสี่ยงไม่เกิน 2 ครั้ง', test:r => r.hitsJunk <= 2, reward:'Sugar Dodger' }
  ];

  const HHA_HYDRATION_QUICK_CHECKS = [
    {
      id:'best-drink',
      q:'ถ้ากระหายน้ำ ควรเลือกอะไร?',
      choices:[
        { text:'น้ำเปล่า 💧', correct:true },
        { text:'น้ำอัดลม 🥤', correct:false }
      ],
      explain:'น้ำเปล่าเหมาะที่สุดเมื่อกระหายน้ำ'
    },
    {
      id:'hot-day',
      q:'วันที่ร้อนมาก ควรทำอะไร?',
      choices:[
        { text:'ดื่มน้ำให้พอ 💧', correct:true },
        { text:'รอจนเวียนหัวก่อน', correct:false }
      ],
      explain:'อากาศร้อนทำให้เสียเหงื่อ ต้องเติมน้ำ'
    },
    {
      id:'salty-food',
      q:'กินเค็มจัดแล้วมักรู้สึกอย่างไร?',
      choices:[
        { text:'กระหายน้ำ 🍟', correct:true },
        { text:'ไม่ต้องดื่มน้ำเลย', correct:false }
      ],
      explain:'อาหารเค็มจัดทำให้กระหายน้ำมากขึ้น'
    },
    {
      id:'sweet-drink',
      q:'น้ำหวานควรดื่มแทนน้ำเปล่าทุกวันไหม?',
      choices:[
        { text:'ไม่ควร 🧋', correct:true },
        { text:'ควรทุกครั้ง', correct:false }
      ],
      explain:'น้ำหวานมีน้ำตาลสูง ควรดื่มแต่น้อย'
    }
  ];

  const HHA_HYDRATION_BADGES = [
    { id:'aqua-master', icon:'🏆', title:'Aqua Master', desc:'คะแนนสูงและน้ำในร่างกายดีมาก', test:r => r.score >= 2600 && r.hydration >= 65 },
    { id:'green-zone-hero', icon:'💚', title:'Green Zone Hero', desc:'รักษา Hydration ให้อยู่ระดับดี', test:r => r.hydration >= 75 },
    { id:'combo-splash', icon:'🔥', title:'Combo Splash', desc:'ทำ Combo สูงมาก', test:r => r.maxCombo >= 10 },
    { id:'mission-clearer', icon:'🎯', title:'Mission Clearer', desc:'ทำ Mission สำเร็จหลายครั้ง', test:r => r.missionsCompleted >= 3 },
    { id:'boss-slayer', icon:'🌞', title:'Heat Boss Slayer', desc:'ชนะ Heat Monster ได้', test:r => r.bossDefeated },
    { id:'sugar-dodger', icon:'🧋', title:'Sugar Dodger', desc:'โดนของเสี่ยงน้อย', test:r => r.hitsJunk <= 2 && r.score >= 900 },
    { id:'water-collector', icon:'💧', title:'Water Collector', desc:'เก็บของดีได้เยอะ', test:r => r.hitsGood >= 20 },
    { id:'ice-guardian', icon:'🧊', title:'Ice Guardian', desc:'ใช้ Shield ช่วยกันอันตราย', test:r => r.shieldUsed >= 1 || r.shieldLeft >= 2 },
    { id:'daily-hero', icon:'📅', title:'Daily Hero', desc:'ผ่านภารกิจประจำวัน', test:r => r.dailyCleared }
  ];

  /* =========================================================
     Runtime State
     ========================================================= */

  const HHA_HYDRATION_STATE = {
    score: 0,
    hydration: 72,
    combo: 0,
    maxCombo: 0,
    shield: 0,
    shieldUsed: 0,
    hitsGood: 0,
    hitsJunk: 0,
    misses: 0,
    fever: 0,
    feverActive: false,
    bossHp: 100
  };

  const HHA_HYDRATION_MISSION_STATE = {
    active: null,
    startedAt: 0,
    endsAt: 0,
    nextAt: 0,
    progress: 0,
    goal: 0,
    completed: 0,
    failed: 0,
    lastKind: '',
    greenZoneHold: 0
  };

  const HHA_HEAT_BOSS_STATE = {
    active: false,
    hp: 100,
    attack: null,
    nextAttackAt: 0,
    attackEndsAt: 0,
    attackCount: 0
  };

  const HHA_HYDRATION_LEARNING_STATE = {
    goodChoices: 0,
    riskyChoices: 0,
    waterChoices: 0,
    fruitVegChoices: 0,
    sugarMistakes: 0,
    saltyMistakes: 0,
    heatMistakes: 0,
    skills: {}
  };

  const HHA_HYDRATION_JUICE = {
    audioReady: false,
    audioCtx: null,
    reducedMotion: false,
    aimAssistPx: 52,
    lastVibeAt: 0
  };

  let HHA_GAME_STARTED_AT = 0;
  let HHA_GAME_TOTAL_SEC = 150;
  let HHA_LAST_TICK_MS = 0;
  let HHA_LAST_SPAWN_MS = 0;
  let HHA_LAST_WAVE_ID = '';

  /* =========================================================
     Setup / Boot UI
     ========================================================= */

  function mountHydrationStartOverlay(){
    const ctx = getHydrationCtx();

    HHA_HYDRATION_FLOW.ctx = ctx;
    if(!HHA_HYDRATION_FLOW.sessionId){
      HHA_HYDRATION_FLOW.sessionId = makeHydrationSessionId();
    }

    let overlay = hhaHydrationQS('.hha-hydration-start');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.className = 'hha-hydration-start';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="hha-start-card">
        <div class="hha-start-hero">💧</div>
        <div class="hha-start-kicker">HeroHealth Hydration</div>
        <h1>Aqua Rush</h1>
        <p>ช่วยร่างกายเติมน้ำ หลบของหวาน สู้ Heat Monster!</p>

        <div class="hha-start-howto">
          <div><b>💧 เก็บ</b><span>น้ำเปล่า / แตงโม / แตงกวา</span></div>
          <div><b>🧋 หลบ</b><span>น้ำหวาน / เค็มจัด / แดดแรง</span></div>
          <div><b>🎯 ทำ</b><span>Mission ให้ทันเพื่อชนะบอส</span></div>
        </div>

        <div class="hha-learning-goal">
          <b>วันนี้จะได้ฝึกอะไร?</b>
          <span>เลือกน้ำดี หลบหวาน/เค็ม และดูแลร่างกายเมื่อร้อน</span>
        </div>

        <div class="hha-start-info">
          <span>ระดับ: <b>${esc(ctx.diff)}</b></span>
          <span>เวลา: <b>${esc(ctx.time)}s</b></span>
          <span>โหมด: <b>${esc(ctx.view)}</b></span>
        </div>

        <button class="hha-start-btn" type="button" onclick="beginHydrationFromOverlay()">
          เริ่มภารกิจ 💧
        </button>

        <button class="hha-start-back" type="button" onclick="goHydrationBackHub()">
          กลับ HUB
        </button>
      </div>
    `;
  }

  function beginHydrationFromOverlay(){
    if(HYD.started) return;

    const overlay = hhaHydrationQS('.hha-hydration-start');
    if(overlay) overlay.remove();

    const ctx = HHA_HYDRATION_FLOW.ctx || getHydrationCtx();

    HYD.started = true;
    HYD.destroyed = false;

    HHA_HYDRATION_FLOW.started = true;
    HHA_HYDRATION_FLOW.paused = false;
    HHA_HYDRATION_FLOW.ended = false;
    HHA_HYDRATION_FLOW.pausedTotalMs = 0;
    HHA_HYDRATION_FLOW.pauseStartedAt = 0;

    emitHydrationEvent('session_start', {
      sessionId: HHA_HYDRATION_FLOW.sessionId,
      diff: ctx.diff,
      time: ctx.time,
      view: ctx.view,
      mode: ctx.mode
    });

    startHydrationArcadeGame({
      time: ctx.time,
      diff: ctx.diff,
      view: ctx.view,
      seed: ctx.seed
    });
  }

  function bootHydrationGame(){
    if(HYD.booted) return;

    HYD.booted = true;
    HYD.destroyed = false;
    HYD.debug = hhaHydrationIsDebug();

    const ctx = getHydrationCtx();

    HHA_HYDRATION_FLOW.ctx = ctx;
    HHA_HYDRATION_FLOW.sessionId = makeHydrationSessionId();

    bindHydrationViewportFix();
    bindHydrationExitFlush();

    document.body.classList.add('hha-hydration-arena');
    document.body.classList.add('hha-view-' + ctx.view);

    mountHydrationDebugPanel();

    emitHydrationEvent('page_open', {
      sessionId: HHA_HYDRATION_FLOW.sessionId,
      diff: ctx.diff,
      time: ctx.time,
      view: ctx.view,
      mode: ctx.mode
    });

    mountHydrationStartOverlay();

    hhaHydrationDebugLog('booted', ctx);
  }

  /* =========================================================
     Game Start / Cleanup
     ========================================================= */

  function startHydrationArcadeGame(options){
    options = options || {};

    cleanupHydrationGame();
    HYD.destroyed = false;
    HYD.started = true;

    initHydrationJuice();

    const ctx = HHA_HYDRATION_FLOW.ctx || getHydrationCtx();
    const tune = getHydrationDifficultyTuning();

    HYD.rng = hhaHydrationMakeRng(options.seed || ctx.seed || Date.now());

    HHA_HYDRATION_JUICE.aimAssistPx = tune.aimAssistPx;

    HHA_GAME_TOTAL_SEC = Number(options.time || ctx.time || qs('time', 150)) || 150;
    HHA_GAME_STARTED_AT = 0;
    HHA_LAST_TICK_MS = 0;
    HHA_LAST_SPAWN_MS = 0;
    HHA_LAST_WAVE_ID = '';

    HHA_HYDRATION_FLOW.ended = false;
    HHA_HYDRATION_FLOW.paused = false;
    HHA_HYDRATION_FLOW.pausedTotalMs = 0;
    HHA_HYDRATION_FLOW.pauseStartedAt = 0;

    document.body.classList.add('hha-hydration-arena');
    document.body.classList.add('hha-view-' + (ctx.view || 'mobile'));

    mountHydrationControlButtons();
    mountHydrationTimeBar();

    enableHydrationAimAssist();
    enableHydrationShootEvent();

    Object.assign(HHA_HYDRATION_STATE, {
      score: 0,
      hydration: 72,
      combo: 0,
      maxCombo: 0,
      shield: 0,
      shieldUsed: 0,
      hitsGood: 0,
      hitsJunk: 0,
      misses: 0,
      fever: 0,
      feverActive: false,
      bossHp: 100
    });

    Object.assign(HHA_HYDRATION_MISSION_STATE, {
      active: null,
      startedAt: 0,
      endsAt: 0,
      nextAt: 0,
      progress: 0,
      goal: 0,
      completed: 0,
      failed: 0,
      lastKind: '',
      greenZoneHold: 0
    });

    Object.assign(HHA_HEAT_BOSS_STATE, {
      active: false,
      hp: 100,
      attack: null,
      nextAttackAt: 0,
      attackEndsAt: 0,
      attackCount: 0
    });

    resetHydrationLearningState();

    document.body.classList.remove(
      'hha-fever-mode',
      'hha-heat-boss',
      'hha-boss-attacking',
      'hha-dehydration-danger',
      'hha-shake'
    );
    document.body.removeAttribute('data-heat-attack');

    const field = getHydrationPlayfield();
    field.innerHTML = '';

    scheduleNextHydrationMission(performance.now() + 5000);

    updateHydrationHUD();
    updateHydrationTimeBar(0, HHA_GAME_TOTAL_SEC);

    showHydrationBanner('💧 เริ่มภารกิจเติมน้ำ!');
    showHydrationDailyChallengeIntro();

    HYD.rafId = requestAnimationFrame(hydrationGameTick);
  }

  function cleanupHydrationGame(){
    HYD.destroyed = true;

    hhaHydrationCancelRAF();
    hhaHydrationClearTimers();

    [
      '.hha-hydration-target',
      '.hha-hit-pop',
      '.hha-learn-pop',
      '.hha-splash-particle',
      '.hha-junk-particle',
      '.hha-shield-burst',
      '.hha-fever-ring',
      '.hha-mission-burst',
      '.hha-heat-wave-fx',
      '.hha-reward-confetti',
      '.hha-mission-hud',
      '.hha-wave-lesson',
      '.hha-daily-challenge',
      '.hha-boss-attack-hud',
      '.hha-boss-reason',
      '.hha-heat-boss-hud',
      '.hha-quick-check',
      '.hha-pause-overlay'
    ].forEach(hhaHydrationRemove);

    document.body.classList.remove(
      'hha-fever-mode',
      'hha-heat-boss',
      'hha-boss-attacking',
      'hha-dehydration-danger',
      'hha-shake'
    );

    document.body.removeAttribute('data-heat-attack');
  }

  /* =========================================================
     Tick / Waves / Difficulty
     ========================================================= */

  function getHydrationDifficultyTuning(){
    const diff = qs('diff', 'normal');

    if(diff === 'easy'){
      return { aimAssistPx:68, lifeMul:1.18, spawnMul:1.12, drainMul:0.78 };
    }

    if(diff === 'hard'){
      return { aimAssistPx:46, lifeMul:0.88, spawnMul:0.86, drainMul:1.18 };
    }

    if(diff === 'challenge'){
      return { aimAssistPx:38, lifeMul:0.78, spawnMul:0.76, drainMul:1.34 };
    }

    return { aimAssistPx:54, lifeMul:1, spawnMul:1, drainMul:1 };
  }

  function getHydrationWave(elapsedSec, totalSec){
    const p = clamp(elapsedSec / Math.max(1, totalSec), 0, 1);
    return HHA_HYDRATION_WAVES.find(w => p >= w.from && p < w.to) || HHA_HYDRATION_WAVES[0];
  }

  function checkHydrationWaveChange(elapsedSec, totalSec){
    const wave = getHydrationWave(elapsedSec, totalSec);

    if(wave.id !== HHA_LAST_WAVE_ID){
      HHA_LAST_WAVE_ID = wave.id;
      document.body.dataset.hydrationWave = wave.id;

      showHydrationBanner(`💧 ${wave.label}`);
      showHydrationWaveLesson(wave);

      emitHydrationEvent('wave_change', {
        waveId: wave.id,
        waveName: wave.name,
        elapsedSec: Math.round(elapsedSec)
      });

      emitHydrationEvent('wave_lesson', {
        waveId: wave.id,
        waveName: wave.name,
        lesson: HHA_HYDRATION_WAVE_LESSONS[wave.id] || null
      });

      if(wave.boss && !HHA_HEAT_BOSS_STATE.active && HHA_HEAT_BOSS_STATE.hp > 0){
        startHeatBossPhase();
      }
    }

    return wave;
  }

  function hydrationGameTick(now){
    if(HYD.destroyed) return;
    if(HHA_HYDRATION_FLOW.paused || HHA_HYDRATION_FLOW.ended) return;

    if(!HHA_GAME_STARTED_AT){
      HHA_GAME_STARTED_AT = now;
      HHA_LAST_TICK_MS = now;
      HHA_LAST_SPAWN_MS = now;
    }

    const effectiveNow = now - HHA_HYDRATION_FLOW.pausedTotalMs;
    const elapsedSec = (effectiveNow - HHA_GAME_STARTED_AT) / 1000;

    const dt = Math.min(0.08, Math.max(0, (now - HHA_LAST_TICK_MS) / 1000));
    HHA_LAST_TICK_MS = now;

    const wave = checkHydrationWaveChange(elapsedSec, HHA_GAME_TOTAL_SEC);

    applyHydrationDrain(wave, dt);

    maybeStartHydrationMission(now, wave);
    updateHydrationMissionTick(now, dt);
    updateHeatBossAttackTick(now, dt, wave);

    const tune = getHydrationDifficultyTuning();

    if(now - HHA_LAST_SPAWN_MS >= wave.spawnEvery * tune.spawnMul){
      HHA_LAST_SPAWN_MS = now;
      spawnHydrationTargetForWave(wave);
    }

    updateHydrationHUD();
    updateHydrationTimeBar(elapsedSec, HHA_GAME_TOTAL_SEC);
    updateHydrationDebugPanel();

    if(elapsedSec < HHA_GAME_TOTAL_SEC){
      HYD.rafId = requestAnimationFrame(hydrationGameTick);
    } else {
      endHydrationGame();
    }
  }

  function applyHydrationDrain(wave, dt){
    const S = HHA_HYDRATION_STATE;
    const tune = getHydrationDifficultyTuning();
    const feverBonus = S.feverActive ? 0.35 : 1;

    S.hydration = clamp(
      S.hydration - wave.hydrationDrain * dt * 10 * feverBonus * tune.drainMul,
      0,
      100
    );

    if(S.hydration <= 18){
      document.body.classList.add('hha-dehydration-danger');
    } else {
      document.body.classList.remove('hha-dehydration-danger');
    }
  }

  /* =========================================================
     Playfield / Spawn / Targets
     ========================================================= */

  function getHydrationPlayfield(){
    let field = document.getElementById('hha-hydration-playfield');
    if(!field){
      field = document.createElement('div');
      field.id = 'hha-hydration-playfield';
      field.className = 'hha-hydration-playfield';
      document.body.appendChild(field);
    }
    return field;
  }

  function pickHydrationItem(wave){
    const BS = HHA_HEAT_BOSS_STATE;

    let goodRate = wave.goodRate;

    if(BS.active && BS.attack){
      goodRate = clamp(goodRate - (BS.attack.junkBoost || 0), 0.35, 0.9);
    }

    if(HHA_HYDRATION_STATE.feverActive){
      goodRate = clamp(goodRate + 0.18, 0.35, 0.95);
    }

    const isGood = hhaHydrationRand() < goodRate;
    const pool = isGood ? HHA_HYDRATION_ITEMS.good : HHA_HYDRATION_ITEMS.junk;

    return hhaHydrationPick(pool);
  }

  function createHydrationTarget(item, wave){
    const node = document.createElement('button');

    node.type = 'button';
    node.className = [
      'hha-hydration-target',
      item.kind === 'good' ? 'is-good' : 'is-junk',
      item.kind === 'danger' ? 'is-danger' : '',
      wave.boss ? 'is-boss-wave' : ''
    ].join(' ');

    node.dataset.itemId = item.id;
    node.dataset.kind = item.kind;

    const driftX = (hhaHydrationRand() * 2 - 1) * 22;
    const driftY = (hhaHydrationRand() * 2 - 1) * 18;
    const spin = (hhaHydrationRand() * 2 - 1) * 4;

    node.style.setProperty('--drift-x', driftX + 'px');
    node.style.setProperty('--drift-y', driftY + 'px');
    node.style.setProperty('--spin', spin + 'deg');
    node.style.setProperty('--move-dur', (1.2 + hhaHydrationRand() * 0.7) + 's');

    node.innerHTML = `
      <span class="hha-target-icon">${esc(item.icon)}</span>
      <span class="hha-target-label">${esc(item.label)}</span>
      <span class="hha-target-short">${esc(item.short)}</span>
    `;

    node.addEventListener('pointerdown', function(ev){
      ev.preventDefault();
      handleHydrationHit(item, node);
    }, { passive:false });

    return node;
  }

  function getHydrationSpawnLane(){
    const lanes = [
      { x:0.18, y:0.28 },
      { x:0.50, y:0.25 },
      { x:0.82, y:0.28 },
      { x:0.28, y:0.52 },
      { x:0.72, y:0.52 },
      { x:0.18, y:0.73 },
      { x:0.50, y:0.75 },
      { x:0.82, y:0.73 }
    ];

    return hhaHydrationPick(lanes) || lanes[0];
  }

  function spawnHydrationTargetForWave(wave){
    if(HHA_HYDRATION_FLOW.paused || HHA_HYDRATION_FLOW.ended || HYD.destroyed) return;

    const field = getHydrationPlayfield();
    const item = pickHydrationItem(wave);
    if(!item) return;

    const node = createHydrationTarget(item, wave);

    const targetW = window.innerWidth <= 520 ? 84 : 96;
    const targetH = window.innerWidth <= 520 ? 100 : 112;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const lane = getHydrationSpawnLane();

    const jitterX = (hhaHydrationRand() * 2 - 1) * 36;
    const jitterY = (hhaHydrationRand() * 2 - 1) * 28;

    const x = clamp((vw * lane.x) - targetW / 2 + jitterX, 12, vw - targetW - 12);
    const y = clamp((vh * lane.y) - targetH / 2 + jitterY, 108, vh - targetH - 86);

    node.style.left = x + 'px';
    node.style.top = y + 'px';

    const tune = getHydrationDifficultyTuning();
    const life = Math.max(620, (1800 / wave.speed) * tune.lifeMul);

    field.appendChild(node);

    emitHydrationEvent('target_spawn', {
      itemId: item.id,
      itemKind: item.kind,
      waveId: wave.id
    });

    hhaHydrationSetTimeout(function(){
      if(node && node.parentNode){
        node.remove();
        handleHydrationMiss(item);
      }
    }, life);
  }

  function handleHydrationHit(item, node){
    if(HHA_HYDRATION_FLOW.ended || HHA_HYDRATION_FLOW.paused) return;

    const S = HHA_HYDRATION_STATE;
    const info = getHydrationLearn(item);

    if(item.kind === 'good'){
      const gained = item.score * (S.feverActive ? 2 : 1);

      S.score += gained;
      S.hydration = clamp(S.hydration + item.hydration, 0, 100);
      S.combo += 1;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.hitsGood += 1;

      if(item.shield){
        S.shield += item.shield;
      }

      S.fever = clamp(S.fever + 12, 0, 100);

      showHydrationPop(node, `+${gained} ${item.short}`, 'good');
      showHydrationLearnPop(node, item);
      spawnHydrationSplash(node, item);
      hydrationFeedback('good');
      pulseHydrationMeter('good');

      if(S.combo >= 8 && S.fever >= 100){
        startHydrationFever();
      }
    } else {
      if(S.shield > 0){
        S.shield -= 1;
        S.shieldUsed = (S.shieldUsed || 0) + 1;

        showHydrationPop(node, '🛡️ กันไว้ได้!', 'shield');
        showHydrationLearnPop(node, item);
        spawnHydrationShieldBurst(node);
        hydrationFeedback('shield');
        pulseHydrationMeter('shield');
      } else {
        S.score += item.score;
        S.hydration = clamp(S.hydration + item.hydration, 0, 100);
        S.combo = 0;
        S.hitsJunk += 1;
        S.misses += 1;

        showHydrationPop(node, item.short, 'bad');
        showHydrationLearnPop(node, item);
        spawnHydrationJunkBurst(node, item);
        hydrationFeedback('bad');
        pulseHydrationMeter('bad');
        screenShakeHydration();
      }
    }

    trackHydrationLearning(item);
    updateHydrationMissionByHit(item);

    emitHydrationEvent('target_hit', {
      itemId: item.id,
      itemKind: item.kind,
      goodLearning: !!info.good,
      score: Math.round(S.score),
      hydration: Math.round(S.hydration),
      combo: S.combo
    });

    if(node && node.parentNode){
      node.remove();
    }

    updateHydrationHUD();
  }

  function handleHydrationMiss(item){
    const S = HHA_HYDRATION_STATE;

    if(item.kind === 'good'){
      S.combo = 0;
      S.misses += 1;
      S.hydration = clamp(S.hydration - 3, 0, 100);
      showHydrationBanner('พลาดน้ำดี! เติมน้ำให้ทันนะ');
    }

    emitHydrationEvent('target_miss', {
      itemId: item.id,
      itemKind: item.kind,
      hydration: Math.round(S.hydration),
      misses: S.misses
    });

    updateHydrationHUD();
  }

  function findHydrationItemById(id){
    const all = []
      .concat(HHA_HYDRATION_ITEMS.good || [])
      .concat(HHA_HYDRATION_ITEMS.junk || []);

    return all.find(x => x.id === id) || null;
  }

  /* =========================================================
     HUD / UI
     ========================================================= */

  function updateHydrationHUD(){
    const S = HHA_HYDRATION_STATE;

    let hud = hhaHydrationQS('.hha-hydration-hud');
    if(!hud){
      hud = document.createElement('div');
      hud.className = 'hha-hydration-hud';
      document.body.appendChild(hud);
    }

    const hydrationClass =
      S.hydration >= 65 ? 'good' :
      S.hydration >= 35 ? 'warn' : 'danger';

    hud.innerHTML = `
      <div class="hha-hud-pill hha-water ${hydrationClass}">
        <b>💧 ${Math.round(S.hydration)}%</b>
        <span>Hydration</span>
      </div>

      <div class="hha-hud-pill">
        <b>⭐ ${Math.max(0, Math.round(S.score))}</b>
        <span>Score</span>
      </div>

      <div class="hha-hud-pill">
        <b>🔥 ${S.combo}</b>
        <span>Combo</span>
      </div>

      <div class="hha-hud-pill">
        <b>🛡️ ${S.shield}</b>
        <span>Shield</span>
      </div>

      ${S.feverActive ? `
        <div class="hha-hud-pill fever">
          <b>🌈 x2</b>
          <span>Fever</span>
        </div>
      ` : `
        <div class="hha-hud-pill">
          <b>⚡ ${Math.round(S.fever)}%</b>
          <span>Fever</span>
        </div>
      `}
    `;
  }

  function mountHydrationControlButtons(){
    let box = hhaHydrationQS('.hha-hydration-controls');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-hydration-controls';
      document.body.appendChild(box);
    }

    box.innerHTML = `
      <button type="button" class="hha-control-btn" onclick="toggleHydrationPause()" aria-label="Pause">⏸️</button>
      <button type="button" class="hha-control-btn" onclick="goHydrationBackHub()" aria-label="Back">🏠</button>
    `;
  }

  function mountHydrationTimeBar(){
    let bar = hhaHydrationQS('.hha-timebar');
    if(!bar){
      bar = document.createElement('div');
      bar.className = 'hha-timebar';
      document.body.appendChild(bar);
    }

    bar.innerHTML = `
      <div class="hha-timebar-track"><i></i></div>
      <span>${HHA_GAME_TOTAL_SEC}s</span>
    `;
  }

  function updateHydrationTimeBar(elapsedSec, totalSec){
    const bar = hhaHydrationQS('.hha-timebar');
    if(!bar) return;

    const left = Math.max(0, Math.ceil(totalSec - elapsedSec));
    const pct = clamp((1 - elapsedSec / Math.max(1,totalSec)) * 100, 0, 100);

    const fill = bar.querySelector('i');
    const text = bar.querySelector('span');

    if(fill) fill.style.width = pct + '%';
    if(text) text.textContent = left + 's';

    bar.classList.toggle('danger', left <= 20);
  }

  function showHydrationBanner(text){
    let box = hhaHydrationQS('.hha-hydration-banner');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-hydration-banner';
      document.body.appendChild(box);
    }

    box.textContent = text;
    updateLiveRegion(text);

    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');

    if(box._t) clearTimeout(box._t);
    box._t = hhaHydrationSetTimeout(function(){
      box.classList.remove('show');
    }, 1900);
  }

  function showHydrationPop(node, text, type){
    if(!node) return;

    const pop = document.createElement('div');
    pop.className = 'hha-hit-pop ' + (type || '');
    pop.textContent = text;

    const r = node.getBoundingClientRect();
    pop.style.left = (r.left + r.width / 2) + 'px';
    pop.style.top = (r.top + 10) + 'px';

    document.body.appendChild(pop);

    hhaHydrationSetTimeout(function(){
      pop.remove();
    }, 760);
  }

  function pulseHydrationMeter(type){
    const hud = hhaHydrationQS('.hha-hydration-hud');
    if(!hud) return;

    hud.classList.remove('pulse-good', 'pulse-bad', 'pulse-shield');
    void hud.offsetWidth;

    if(type === 'good') hud.classList.add('pulse-good');
    if(type === 'bad') hud.classList.add('pulse-bad');
    if(type === 'shield') hud.classList.add('pulse-shield');

    hhaHydrationSetTimeout(function(){
      hud.classList.remove('pulse-good', 'pulse-bad', 'pulse-shield');
    }, 420);
  }

  function showHydrationDailyChallengeIntro(){
    const c = getTodayHydrationChallenge();

    showHydrationBanner(`${c.icon} วันนี้: ${c.goalText}`);

    let box = hhaHydrationQS('.hha-daily-challenge');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-daily-challenge';
      document.body.appendChild(box);
    }

    box.innerHTML = `
      <div class="hha-daily-card">
        <div class="hha-daily-icon">${esc(c.icon)}</div>
        <div>
          <b>${esc(c.title)}</b>
          <span>${esc(c.goalText)}</span>
        </div>
      </div>
    `;

    box.classList.add('show');

    if(box._t) clearTimeout(box._t);
    box._t = hhaHydrationSetTimeout(function(){
      box.classList.remove('show');
    }, 2600);
  }

  function showHydrationWaveLesson(wave){
    const lesson = HHA_HYDRATION_WAVE_LESSONS[wave.id];
    if(!lesson) return;

    let box = hhaHydrationQS('.hha-wave-lesson');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-wave-lesson';
      document.body.appendChild(box);
    }

    box.innerHTML = `
      <div class="hha-wave-lesson-card">
        <div class="hha-wave-lesson-icon">${esc(lesson.icon)}</div>
        <div>
          <b>${esc(lesson.title)}</b>
          <span>${esc(lesson.text)}</span>
        </div>
      </div>
    `;

    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');

    if(box._t) clearTimeout(box._t);
    box._t = hhaHydrationSetTimeout(function(){
      box.classList.remove('show');
    }, 2600);
  }

  /* =========================================================
     Pause
     ========================================================= */

  function toggleHydrationPause(){
    if(HHA_HYDRATION_FLOW.ended || !HYD.started) return;

    if(!HHA_HYDRATION_FLOW.paused){
      HHA_HYDRATION_FLOW.paused = true;
      HHA_HYDRATION_FLOW.pauseStartedAt = performance.now();
      showHydrationPauseOverlay();
      emitHydrationEvent('pause', {});
    } else {
      resumeHydrationGame();
    }
  }

  function resumeHydrationGame(){
    if(!HHA_HYDRATION_FLOW.paused) return;

    const now = performance.now();
    const pausedMs = now - HHA_HYDRATION_FLOW.pauseStartedAt;

    HHA_HYDRATION_FLOW.pausedTotalMs += pausedMs;
    HHA_HYDRATION_FLOW.paused = false;
    HHA_HYDRATION_FLOW.pauseStartedAt = 0;

    if(HHA_HYDRATION_MISSION_STATE.active){
      HHA_HYDRATION_MISSION_STATE.endsAt += pausedMs;
    } else if(HHA_HYDRATION_MISSION_STATE.nextAt){
      HHA_HYDRATION_MISSION_STATE.nextAt += pausedMs;
    }

    if(HHA_HEAT_BOSS_STATE.attack){
      HHA_HEAT_BOSS_STATE.attackEndsAt += pausedMs;
    } else if(HHA_HEAT_BOSS_STATE.nextAttackAt){
      HHA_HEAT_BOSS_STATE.nextAttackAt += pausedMs;
    }

    const overlay = hhaHydrationQS('.hha-pause-overlay');
    if(overlay) overlay.remove();

    emitHydrationEvent('resume', {});
    HYD.rafId = requestAnimationFrame(hydrationGameTick);
  }

  function showHydrationPauseOverlay(){
    let overlay = hhaHydrationQS('.hha-pause-overlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.className = 'hha-pause-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="hha-pause-card">
        <div class="hha-pause-icon">⏸️</div>
        <h2>พักภารกิจ</h2>
        <p>กดเล่นต่อเมื่อพร้อมเติมน้ำต่อ</p>
        <button type="button" onclick="resumeHydrationGame()">เล่นต่อ 💧</button>
        <button type="button" class="soft" onclick="goHydrationBackHub()">กลับ HUB</button>
      </div>
    `;
  }

  /* =========================================================
     Fever
     ========================================================= */

  function startHydrationFever(){
    const S = HHA_HYDRATION_STATE;
    if(S.feverActive) return;

    S.feverActive = true;
    S.fever = 0;

    document.body.classList.add('hha-fever-mode');
    showHydrationBanner('🌈 FEVER MODE! คะแนน x2 เก็บน้ำรัว ๆ!');
    hydrationFeedback('fever');
    spawnHydrationFeverRing();

    emitHydrationEvent('fever_start', {
      score: Math.round(S.score),
      hydration: Math.round(S.hydration),
      combo: S.combo
    });

    hhaHydrationSetTimeout(function(){
      S.feverActive = false;
      document.body.classList.remove('hha-fever-mode');
      showHydrationBanner('กลับสู่ภารกิจเติมน้ำ!');
      updateHydrationHUD();
      emitHydrationEvent('fever_end', {});
    }, 8000);

    updateHydrationHUD();
  }

  /* =========================================================
     Missions
     ========================================================= */

  function scheduleNextHydrationMission(now){
    const gap = 18000 + hhaHydrationRand() * 10000;
    HHA_HYDRATION_MISSION_STATE.nextAt = now + gap;
  }

  function maybeStartHydrationMission(now, wave){
    const MS = HHA_HYDRATION_MISSION_STATE;

    if(MS.active) return;
    if(now < MS.nextAt) return;

    const pool = HHA_HYDRATION_MISSIONS.filter(m => {
      if(m.id === 'green-zone') return HHA_HYDRATION_STATE.hydration >= 45;
      return true;
    });

    const mission = hhaHydrationPick(pool);
    if(!mission) return;

    MS.active = mission;
    MS.startedAt = now;
    MS.endsAt = now + mission.duration;
    MS.progress = 0;
    MS.goal = mission.goal;
    MS.greenZoneHold = 0;
    MS.lastKind = '';

    showHydrationBanner(`${mission.icon} ${mission.title}`);
    updateHydrationMissionHUD();

    emitHydrationEvent('mission_start', {
      missionId: mission.id,
      missionType: mission.type,
      waveId: wave ? wave.id : ''
    });
  }

  function updateHydrationMissionTick(now, dt){
    const MS = HHA_HYDRATION_MISSION_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!MS.active) return;

    const m = MS.active;

    if(m.type === 'holdGreen'){
      if(S.hydration >= 65){
        MS.greenZoneHold += dt;
        MS.progress = Math.min(m.goal, MS.greenZoneHold);
      }
    }

    if(m.type === 'surviveNoJunk'){
      const elapsed = Math.max(0, (now - MS.startedAt) / 1000);
      MS.progress = Math.min(m.goal, elapsed);
    }

    if(m.type === 'reachCombo'){
      MS.progress = Math.min(m.goal, S.combo);
    }

    if(MS.progress >= MS.goal){
      completeHydrationMission();
      return;
    }

    if(now >= MS.endsAt){
      failHydrationMission();
      return;
    }

    updateHydrationMissionHUD();
  }

  function updateHydrationMissionByHit(item){
    const MS = HHA_HYDRATION_MISSION_STATE;
    if(!MS.active) return;

    const m = MS.active;

    if(m.type === 'collectGood' && item.kind === 'good'){
      MS.progress += 1;
    }

    if(m.type === 'collectIce' && item.id === 'ice'){
      MS.progress += 1;
    }

    if(m.type === 'surviveNoJunk' && item.kind !== 'good'){
      failHydrationMission();
      return;
    }

    updateHydrationMissionHUD();
  }

  function completeHydrationMission(){
    const MS = HHA_HYDRATION_MISSION_STATE;
    const BS = HHA_HEAT_BOSS_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!MS.active) return;

    const m = MS.active;

    S.score += m.rewardScore || 0;
    S.hydration = clamp(S.hydration + (m.rewardHydration || 0), 0, 100);

    if(m.rewardShield){
      S.shield += m.rewardShield;
    }

    if(BS.active){
      BS.hp = clamp(BS.hp - (m.bossDamage || 10), 0, 100);
      S.bossHp = BS.hp;
      mountHeatBossHUD();
      pulseHeatBossDamage();

      if(BS.hp <= 0){
        defeatHeatBoss();
      }
    }

    MS.completed += 1;

    showHydrationBanner(`สำเร็จ! ${m.icon} +${m.rewardScore}`);
    showHydrationMissionToast(`✅ Mission Clear! บอสเสียพลัง -${m.bossDamage || 10}`);
    hydrationFeedback('mission');
    spawnHydrationMissionBurst();

    emitHydrationEvent('mission_clear', {
      missionId: m.id,
      missionsCompleted: MS.completed,
      bossHp: BS.hp,
      score: Math.round(S.score)
    });

    MS.active = null;
    scheduleNextHydrationMission(performance.now());
    updateHydrationMissionHUD();
    updateHydrationHUD();

    maybeShowHydrationQuickCheck();
  }

  function failHydrationMission(){
    const MS = HHA_HYDRATION_MISSION_STATE;
    const BS = HHA_HEAT_BOSS_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!MS.active) return;

    const m = MS.active;

    MS.failed += 1;
    S.combo = 0;
    S.hydration = clamp(S.hydration - 6, 0, 100);

    if(BS.active){
      BS.hp = clamp(BS.hp + 4, 0, 100);
      S.bossHp = BS.hp;
      mountHeatBossHUD();
    }

    showHydrationBanner(`พลาดภารกิจ! ${m.icon}`);
    showHydrationMissionToast('⚠️ ตั้งหลักใหม่ รีบเติมน้ำกลับมา!');
    screenShakeHydration();

    emitHydrationEvent('mission_fail', {
      missionId: m.id,
      missionsFailed: MS.failed,
      bossHp: BS.hp,
      hydration: Math.round(S.hydration)
    });

    MS.active = null;
    scheduleNextHydrationMission(performance.now() + 2000);
    updateHydrationMissionHUD();
    updateHydrationHUD();
  }

  function updateHydrationMissionHUD(){
    let box = hhaHydrationQS('.hha-mission-hud');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-mission-hud';
      document.body.appendChild(box);
    }

    const MS = HHA_HYDRATION_MISSION_STATE;

    if(!MS.active){
      box.classList.remove('show');
      box.innerHTML = '';
      return;
    }

    const m = MS.active;
    const now = performance.now();
    const left = Math.max(0, Math.ceil((MS.endsAt - now) / 1000));
    const pct = clamp((MS.progress / Math.max(1, MS.goal)) * 100, 0, 100);

    box.innerHTML = `
      <div class="hha-mission-card">
        <div class="hha-mission-icon">${esc(m.icon)}</div>
        <div class="hha-mission-main">
          <b>${esc(m.title)}</b>
          <span>${esc(m.instruction)}</span>
          <div class="hha-mission-bar"><i style="width:${pct}%"></i></div>
        </div>
        <div class="hha-mission-time">${left}s</div>
      </div>
    `;

    box.classList.add('show');
  }

  function showHydrationMissionToast(text){
    let toast = hhaHydrationQS('.hha-mission-toast');
    if(!toast){
      toast = document.createElement('div');
      toast.className = 'hha-mission-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = text;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');

    if(toast._t) clearTimeout(toast._t);
    toast._t = hhaHydrationSetTimeout(function(){
      toast.classList.remove('show');
    }, 1400);
  }

  /* =========================================================
     Boss
     ========================================================= */

  function startHeatBossPhase(){
    const S = HHA_HYDRATION_STATE;
    const BS = HHA_HEAT_BOSS_STATE;

    BS.active = true;
    BS.hp = 100;
    BS.attack = null;
    BS.attackCount = 0;
    BS.nextAttackAt = performance.now() + 2500;
    BS.attackEndsAt = 0;

    S.bossHp = 100;

    document.body.classList.add('hha-heat-boss');
    showHydrationBanner('🌞 Heat Monster มาแล้ว! ทำ Mission เพื่อลด HP!');
    mountHeatBossHUD();

    emitHydrationEvent('boss_start', {});
  }

  function mountHeatBossHUD(){
    let boss = hhaHydrationQS('.hha-heat-boss-hud');
    if(!boss){
      boss = document.createElement('div');
      boss.className = 'hha-heat-boss-hud';
      document.body.appendChild(boss);
    }

    const hp = Math.round(HHA_HEAT_BOSS_STATE.hp);

    boss.innerHTML = `
      <div class="hha-boss-face">🌞</div>
      <div class="hha-boss-info">
        <b>Heat Monster</b>
        <div class="hha-boss-bar"><i style="width:${hp}%"></i></div>
      </div>
    `;
  }

  function updateHeatBossAttackTick(now, dt, wave){
    const BS = HHA_HEAT_BOSS_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!BS.active) return;

    if(BS.attack && now >= BS.attackEndsAt){
      endHeatBossAttack();
    }

    if(!BS.attack && now >= BS.nextAttackAt){
      startRandomHeatBossAttack(now);
    }

    if(BS.attack){
      const drain = 0.11 * (BS.attack.drainBoost || 1);
      S.hydration = clamp(S.hydration - drain * dt * 10, 0, 100);
    }

    updateHeatBossAttackHUD();
  }

  function startRandomHeatBossAttack(now){
    const BS = HHA_HEAT_BOSS_STATE;
    const atk = hhaHydrationPick(HHA_HEAT_BOSS_ATTACKS);
    if(!atk) return;

    BS.attack = atk;
    BS.attackEndsAt = now + atk.duration;
    BS.attackCount += 1;

    document.body.dataset.heatAttack = atk.id;
    document.body.classList.add('hha-boss-attacking');

    showHydrationBanner(`${atk.icon} ${atk.warning}`);
    showHeatAttackReason(atk);
    updateHeatBossAttackHUD();
    hydrationFeedback('boss');
    spawnHeatWaveFX();

    emitHydrationEvent('boss_attack', {
      attackId: atk.id,
      attackName: atk.name,
      bossHp: BS.hp
    });
  }

  function endHeatBossAttack(){
    const BS = HHA_HEAT_BOSS_STATE;

    BS.attack = null;
    BS.attackEndsAt = 0;
    BS.nextAttackAt = performance.now() + 7000 + hhaHydrationRand() * 5000;

    document.body.classList.remove('hha-boss-attacking');
    document.body.removeAttribute('data-heat-attack');

    updateHeatBossAttackHUD();
  }

  function updateHeatBossAttackHUD(){
    let box = hhaHydrationQS('.hha-boss-attack-hud');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-boss-attack-hud';
      document.body.appendChild(box);
    }

    const BS = HHA_HEAT_BOSS_STATE;

    if(!BS.active || !BS.attack){
      box.classList.remove('show');
      box.innerHTML = '';
      return;
    }

    const left = Math.max(0, Math.ceil((BS.attackEndsAt - performance.now()) / 1000));

    box.innerHTML = `
      <div class="hha-boss-attack-card">
        <b>${esc(BS.attack.icon)} ${esc(BS.attack.name)}</b>
        <span>${esc(BS.attack.warning)}</span>
        <em>${left}s</em>
      </div>
    `;

    box.classList.add('show');
  }

  function showHeatAttackReason(atk){
    if(!atk) return;

    const text = HHA_HEAT_ATTACK_LESSONS[atk.id] || atk.warning;

    let box = hhaHydrationQS('.hha-boss-reason');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-boss-reason';
      document.body.appendChild(box);
    }

    box.innerHTML = `
      <b>${esc(atk.icon)} ${esc(atk.name)}</b>
      <span>${esc(text)}</span>
    `;

    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');

    if(box._t) clearTimeout(box._t);
    box._t = hhaHydrationSetTimeout(function(){
      box.classList.remove('show');
    }, 2300);
  }

  function defeatHeatBoss(){
    const BS = HHA_HEAT_BOSS_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!BS.active && BS.hp <= 0) return;

    BS.active = false;
    BS.attack = null;
    BS.hp = 0;
    S.bossHp = 0;

    S.score += 800;
    S.hydration = clamp(S.hydration + 18, 0, 100);
    S.fever = 100;

    document.body.classList.remove('hha-heat-boss', 'hha-boss-attacking');
    document.body.removeAttribute('data-heat-attack');

    hhaHydrationRemove('.hha-heat-boss-hud');
    updateHeatBossAttackHUD();
    updateHydrationHUD();

    showHydrationBanner('🏆 ชนะ Heat Monster!');
    showHydrationMissionToast('โบนัส +800 และเติมน้ำกลับมา!');

    emitHydrationEvent('boss_defeated', {
      score: Math.round(S.score),
      hydration: Math.round(S.hydration)
    });
  }

  function pulseHeatBossDamage(){
    const boss = hhaHydrationQS('.hha-heat-boss-hud');
    if(!boss) return;

    boss.classList.remove('damage');
    void boss.offsetWidth;
    boss.classList.add('damage');

    hhaHydrationSetTimeout(function(){
      boss.classList.remove('damage');
    }, 420);
  }

  /* =========================================================
     Learning
     ========================================================= */

  function getHydrationLearn(item){
    return HHA_HYDRATION_LEARN[item.id] || {
      good: item.kind === 'good',
      learn: item.kind === 'good' ? 'ตัวเลือกนี้ช่วยร่างกาย' : 'ตัวเลือกนี้ควรระวัง',
      why: '',
      skill: 'เลือกอย่างเหมาะสม'
    };
  }

  function showHydrationLearnPop(node, item){
    if(!node) return;

    const info = getHydrationLearn(item);
    const pop = document.createElement('div');

    pop.className = 'hha-learn-pop ' + (info.good ? 'good' : 'bad');
    pop.innerHTML = `
      <b>${info.good ? 'ดีต่อร่างกาย!' : 'ควรระวัง!'}</b>
      <span>${esc(info.learn)}</span>
    `;

    const r = node.getBoundingClientRect();
    pop.style.left = (r.left + r.width / 2) + 'px';
    pop.style.top = (r.bottom + 6) + 'px';

    document.body.appendChild(pop);

    hhaHydrationSetTimeout(function(){
      pop.remove();
    }, 1250);
  }

  function resetHydrationLearningState(){
    Object.assign(HHA_HYDRATION_LEARNING_STATE, {
      goodChoices: 0,
      riskyChoices: 0,
      waterChoices: 0,
      fruitVegChoices: 0,
      sugarMistakes: 0,
      saltyMistakes: 0,
      heatMistakes: 0,
      skills: {}
    });
  }

  function trackHydrationLearning(item){
    const L = HHA_HYDRATION_LEARNING_STATE;
    const info = getHydrationLearn(item);

    if(info.good){
      L.goodChoices += 1;
    } else {
      L.riskyChoices += 1;
    }

    if(item.id === 'water') L.waterChoices += 1;
    if(item.id === 'watermelon' || item.id === 'cucumber') L.fruitVegChoices += 1;
    if(item.id === 'soda' || item.id === 'bubbletea' || item.id === 'energy') L.sugarMistakes += 1;
    if(item.id === 'salty') L.saltyMistakes += 1;
    if(item.id === 'sun') L.heatMistakes += 1;

    L.skills[info.skill] = (L.skills[info.skill] || 0) + 1;
  }

  function getHydrationLearningInsight(result){
    const L = HHA_HYDRATION_LEARNING_STATE;

    if(L.sugarMistakes >= 5){
      return { icon:'🧋', title:'บทเรียนรอบนี้', text:'น้ำหวานไม่ควรดื่มแทนน้ำเปล่า เพราะมีน้ำตาลสูง' };
    }

    if(L.saltyMistakes >= 3){
      return { icon:'🍟', title:'บทเรียนรอบนี้', text:'อาหารเค็มจัดทำให้กระหายน้ำ ควรดื่มน้ำให้พอ' };
    }

    if(L.heatMistakes >= 3 || result.hydration < 45){
      return { icon:'🌞', title:'บทเรียนรอบนี้', text:'เมื่ออากาศร้อนหรือเสียเหงื่อ ต้องเติมน้ำให้เพียงพอ' };
    }

    if(L.waterChoices >= 8){
      return { icon:'💧', title:'บทเรียนรอบนี้', text:'เลือกน้ำเปล่าได้ดีมาก เป็นตัวเลือกหลักของร่างกาย' };
    }

    if(L.fruitVegChoices >= 6){
      return { icon:'🍉', title:'บทเรียนรอบนี้', text:'ผักผลไม้ฉ่ำน้ำช่วยเติมความสดชื่นให้ร่างกาย' };
    }

    return { icon:'💚', title:'บทเรียนรอบนี้', text:'เลือกเครื่องดื่มให้เหมาะ และรักษา Hydration ให้อยู่โซนดี' };
  }

  function calculateHydrationBloomEvidence(result){
    const L = HHA_HYDRATION_LEARNING_STATE;

    return {
      remember: {
        label: 'Remember',
        evidence: L.goodChoices + L.riskyChoices,
        meaning: 'จำแนกสิ่งที่ช่วยเติมน้ำและสิ่งที่ควรระวัง'
      },
      understand: {
        label: 'Understand',
        evidence: result.missionsCompleted,
        meaning: 'เข้าใจผลของน้ำหวาน เค็มจัด แดดร้อน และการเสียเหงื่อ'
      },
      apply: {
        label: 'Apply',
        evidence: result.hydration >= 55 ? 1 : 0,
        meaning: 'เลือกสิ่งที่เหมาะสมเพื่อรักษา Hydration ในสถานการณ์เกม'
      },
      analyze: {
        label: 'Analyze',
        evidence: result.maxCombo >= 8 || result.bossDefeated ? 1 : 0,
        meaning: 'ตัดสินใจภายใต้เวลา ความเสี่ยง และภารกิจ'
      }
    };
  }

  /* =========================================================
     Quick Check
     ========================================================= */

  function maybeShowHydrationQuickCheck(){
    if(HHA_HYDRATION_FLOW.paused || HHA_HYDRATION_FLOW.ended) return;
    if(hhaHydrationRand() > 0.32) return;

    const q = hhaHydrationPick(HHA_HYDRATION_QUICK_CHECKS);
    showHydrationQuickCheck(q);
  }

  function showHydrationQuickCheck(q){
    if(!q) return;

    let box = hhaHydrationQS('.hha-quick-check');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-quick-check';
      document.body.appendChild(box);
    }

    const choices = q.choices.map((c, idx) => `
      <button type="button" onclick="answerHydrationQuickCheck('${esc(q.id)}', ${idx})">
        ${esc(c.text)}
      </button>
    `).join('');

    box.dataset.qid = q.id;
    box.innerHTML = `
      <div class="hha-quick-card">
        <b>คำถามโบนัส 🎯</b>
        <span>${esc(q.q)}</span>
        <div class="hha-quick-choices">${choices}</div>
      </div>
    `;

    box.classList.add('show');

    if(box._t) clearTimeout(box._t);
    box._t = hhaHydrationSetTimeout(function(){
      box.classList.remove('show');
    }, 5200);

    emitHydrationEvent('quick_check_show', {
      questionId: q.id
    });
  }

  function answerHydrationQuickCheck(qid, idx){
    const q = HHA_HYDRATION_QUICK_CHECKS.find(x => x.id === qid);
    if(!q) return;

    const choice = q.choices[idx];
    const correct = !!(choice && choice.correct);
    const S = HHA_HYDRATION_STATE;

    if(correct){
      S.score += 160;
      S.hydration = clamp(S.hydration + 5, 0, 100);
      showHydrationMissionToast('✅ ถูกต้อง! โบนัส +160');
      hydrationFeedback('mission');
    } else {
      S.hydration = clamp(S.hydration - 3, 0, 100);
      showHydrationMissionToast('ลองจำไว้นะ: ' + q.explain);
      hydrationFeedback('bad');
    }

    emitHydrationEvent('quick_check_answer', {
      questionId: qid,
      choiceIndex: idx,
      correct,
      explain: q.explain
    });

    const box = hhaHydrationQS('.hha-quick-check');
    if(box) box.classList.remove('show');

    updateHydrationHUD();
  }

  /* =========================================================
     Juice / Audio / Vibration / FX
     ========================================================= */

  function initHydrationJuice(){
    try{
      HHA_HYDRATION_JUICE.reducedMotion =
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }catch(e){
      HHA_HYDRATION_JUICE.reducedMotion = false;
    }

    if(!HYD.audioUnlockBound){
      HYD.audioUnlockBound = true;
      hhaHydrationOn(window, 'pointerdown', unlockHydrationAudio, { passive:true });
      hhaHydrationOn(window, 'touchstart', unlockHydrationAudio, { passive:true });
    }
  }

  function unlockHydrationAudio(){
    const J = HHA_HYDRATION_JUICE;

    if(J.audioReady && J.audioCtx) return;

    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;

      if(!J.audioCtx){
        J.audioCtx = new AC();
      }

      J.audioReady = true;

      if(J.audioCtx.state === 'suspended'){
        J.audioCtx.resume().catch(()=>{});
      }
    }catch(e){
      hhaHydrationDebugError(e);
    }
  }

  function playHydrationTone(type){
    const J = HHA_HYDRATION_JUICE;
    const ctx = J.audioCtx;

    if(!ctx || !J.audioReady) return;

    try{
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      let freq = 440;
      let dur = 0.12;
      let wave = 'sine';
      let vol = 0.06;

      if(type === 'good'){
        freq = 620; dur = 0.11; wave = 'triangle'; vol = 0.055;
      } else if(type === 'bad'){
        freq = 170; dur = 0.16; wave = 'sawtooth'; vol = 0.045;
      } else if(type === 'shield'){
        freq = 760; dur = 0.15; wave = 'square'; vol = 0.045;
      } else if(type === 'fever'){
        freq = 880; dur = 0.32; wave = 'triangle'; vol = 0.06;
      } else if(type === 'mission'){
        freq = 720; dur = 0.22; wave = 'sine'; vol = 0.06;
      } else if(type === 'boss'){
        freq = 120; dur = 0.35; wave = 'sawtooth'; vol = 0.05;
      }

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);

      if(type === 'good' || type === 'mission'){
        osc.frequency.exponentialRampToValueAtTime(freq * 1.32, now + dur);
      }

      if(type === 'bad' || type === 'boss'){
        osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.62), now + dur);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + dur + 0.03);
    }catch(e){}
  }

  function hydrationVibrate(pattern){
    const now = performance.now();

    if(now - HHA_HYDRATION_JUICE.lastVibeAt < 70) return;
    HHA_HYDRATION_JUICE.lastVibeAt = now;

    try{
      if(!navigator.vibrate) return;
      navigator.vibrate(pattern);
    }catch(e){}
  }

  function hydrationFeedback(type){
    if(type === 'good'){
      playHydrationTone('good');
      hydrationVibrate(18);
    } else if(type === 'bad'){
      playHydrationTone('bad');
      hydrationVibrate([45, 25, 45]);
    } else if(type === 'shield'){
      playHydrationTone('shield');
      hydrationVibrate([22, 18, 22]);
    } else if(type === 'fever'){
      playHydrationTone('fever');
      hydrationVibrate([25, 30, 25, 30, 60]);
    } else if(type === 'mission'){
      playHydrationTone('mission');
      hydrationVibrate([25, 25, 55]);
    } else if(type === 'boss'){
      playHydrationTone('boss');
      hydrationVibrate([70, 40, 70]);
    }
  }

  function spawnHydrationSplash(node, item){
    if(!node || HHA_HYDRATION_JUICE.reducedMotion) return;

    const r = node.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const count = item.id === 'water' ? 12 : 8;

    for(let i=0; i<count; i++){
      const p = document.createElement('span');
      p.className = 'hha-splash-particle';
      p.textContent = item.id === 'watermelon' ? '🍉' : '💧';

      const ang = hhaHydrationRand() * Math.PI * 2;
      const dist = 34 + hhaHydrationRand() * 46;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');
      p.style.setProperty('--rot', (hhaHydrationRand() * 90 - 45) + 'deg');

      document.body.appendChild(p);
      hhaHydrationSetTimeout(() => p.remove(), 680);
    }
  }

  function spawnHydrationJunkBurst(node, item){
    if(!node || HHA_HYDRATION_JUICE.reducedMotion) return;

    const r = node.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const icons = item.id === 'sun' ? ['🔥','🌞','⚠️'] : ['💥','❌','⚠️'];

    for(let i=0; i<9; i++){
      const p = document.createElement('span');
      p.className = 'hha-junk-particle';
      p.textContent = icons[i % icons.length];

      const dx = (hhaHydrationRand() * 2 - 1) * 70;
      const dy = (hhaHydrationRand() * 2 - 1) * 58;

      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.setProperty('--dx', dx + 'px');
      p.style.setProperty('--dy', dy + 'px');

      document.body.appendChild(p);
      hhaHydrationSetTimeout(() => p.remove(), 620);
    }
  }

  function spawnHydrationShieldBurst(node){
    if(!node || HHA_HYDRATION_JUICE.reducedMotion) return;

    const r = node.getBoundingClientRect();
    const ring = document.createElement('div');

    ring.className = 'hha-shield-burst';
    ring.style.left = (r.left + r.width / 2) + 'px';
    ring.style.top = (r.top + r.height / 2) + 'px';

    document.body.appendChild(ring);
    hhaHydrationSetTimeout(() => ring.remove(), 680);
  }

  function spawnHydrationFeverRing(){
    if(HHA_HYDRATION_JUICE.reducedMotion) return;

    const ring = document.createElement('div');
    ring.className = 'hha-fever-ring';
    document.body.appendChild(ring);

    hhaHydrationSetTimeout(() => ring.remove(), 1100);
  }

  function spawnHydrationMissionBurst(){
    if(HHA_HYDRATION_JUICE.reducedMotion) return;

    const box = document.createElement('div');
    box.className = 'hha-mission-burst';
    box.textContent = 'MISSION CLEAR!';
    document.body.appendChild(box);

    hhaHydrationSetTimeout(() => box.remove(), 900);
  }

  function spawnHeatWaveFX(){
    if(HHA_HYDRATION_JUICE.reducedMotion) return;

    const fx = document.createElement('div');
    fx.className = 'hha-heat-wave-fx';
    document.body.appendChild(fx);

    hhaHydrationSetTimeout(() => fx.remove(), 1200);
  }

  function spawnHydrationRewardConfetti(){
    if(HHA_HYDRATION_JUICE.reducedMotion) return;

    const icons = ['💧','⭐','🎯','💚','🏆','🌊'];

    for(let i=0; i<34; i++){
      const p = document.createElement('span');
      p.className = 'hha-reward-confetti';
      p.textContent = icons[i % icons.length];

      p.style.left = (8 + hhaHydrationRand() * 84) + 'vw';
      p.style.top = '-30px';
      p.style.setProperty('--delay', (hhaHydrationRand() * 0.36) + 's');
      p.style.setProperty('--fall', (70 + hhaHydrationRand() * 26) + 'vh');
      p.style.setProperty('--x', ((hhaHydrationRand() * 2 - 1) * 80) + 'px');
      p.style.setProperty('--rot', ((hhaHydrationRand() * 2 - 1) * 220) + 'deg');

      document.body.appendChild(p);
      hhaHydrationSetTimeout(() => p.remove(), 1800);
    }
  }

  function screenShakeHydration(){
    document.body.classList.remove('hha-shake');
    void document.body.offsetWidth;
    document.body.classList.add('hha-shake');

    hhaHydrationSetTimeout(function(){
      document.body.classList.remove('hha-shake');
    }, 360);
  }

  /* =========================================================
     Aim Assist / cVR Shoot
     ========================================================= */

  function findNearestHydrationTarget(x, y, maxPx){
    const nodes = hhaHydrationQSA('.hha-hydration-target');
    let best = null;
    let bestD = Infinity;

    nodes.forEach(node => {
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = cx - x;
      const dy = cy - y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if(d < bestD){
        bestD = d;
        best = node;
      }
    });

    if(best && bestD <= maxPx) return best;
    return null;
  }

  function onHydrationAimAssist(ev){
    const view = qs('view', 'mobile');
    const isAssistView = view === 'mobile' || view === 'cvr';

    if(!isAssistView) return;
    if(ev.target && ev.target.closest && ev.target.closest('.hha-hydration-target')) return;

    const maxPx = view === 'cvr' ? 72 : HHA_HYDRATION_JUICE.aimAssistPx;
    const target = findNearestHydrationTarget(ev.clientX, ev.clientY, maxPx);

    if(target){
      ev.preventDefault();

      const item = findHydrationItemById(target.dataset.itemId);
      if(item) handleHydrationHit(item, target);
    }
  }

  function enableHydrationAimAssist(){
    if(HYD.aimAssistOn) return;
    HYD.aimAssistOn = true;
    hhaHydrationOn(document, 'pointerdown', onHydrationAimAssist, { passive:false });
  }

  function onHydrationShoot(ev){
    const detail = ev.detail || {};
    const x = Number(detail.clientX || window.innerWidth / 2);
    const y = Number(detail.clientY || window.innerHeight / 2);

    const target = findNearestHydrationTarget(x, y, 86);

    if(target){
      const item = findHydrationItemById(target.dataset.itemId);
      if(item) handleHydrationHit(item, target);
    }
  }

  function enableHydrationShootEvent(){
    if(HYD.shootEventOn) return;
    HYD.shootEventOn = true;
    hhaHydrationOn(window, 'hha:shoot', onHydrationShoot, false);
  }

  /* =========================================================
     Daily / Best / Badge / Summary
     ========================================================= */

  function getHydrationPlayerKey(){
    const pid = qs('pid', 'anon') || 'anon';
    const diff = qs('diff', 'normal') || 'normal';
    return `HHA_HYDRATION_BEST_${pid}_${diff}`;
  }

  function seededDailyIndex(){
    const d = getBangkokYmd().replaceAll('-', '');
    let n = 0;
    for(let i=0; i<d.length; i++){
      n = (n * 31 + d.charCodeAt(i)) >>> 0;
    }
    return n % HHA_HYDRATION_DAILY_CHALLENGES.length;
  }

  function getTodayHydrationChallenge(){
    return HHA_HYDRATION_DAILY_CHALLENGES[seededDailyIndex()];
  }

  function loadHydrationBest(){
    return hhaHydrationStorageJsonGet(getHydrationPlayerKey(), null);
  }

  function saveHydrationBest(result){
    const old = loadHydrationBest();

    const next = {
      score: result.score,
      hydration: result.hydration,
      maxCombo: result.maxCombo,
      missionsCompleted: result.missionsCompleted,
      bossDefeated: !!result.bossDefeated,
      stars: result.stars,
      medal: result.medal,
      playedAt: new Date().toISOString()
    };

    if(!old || result.score > Number(old.score || 0)){
      hhaHydrationStorageJsonSet(getHydrationPlayerKey(), next);
      return { isNewBest:true, oldBest:old, best:next };
    }

    return { isNewBest:false, oldBest:old, best:old };
  }

  function calculateHydrationStars(result){
    let stars = 0;

    if(result.score >= 1000) stars += 1;
    if(result.hydration >= 55) stars += 1;
    if(result.missionsCompleted >= 2 || result.bossDefeated) stars += 1;

    return clamp(stars, 1, 3);
  }

  function renderStars(n){
    n = clamp(Number(n || 1), 1, 3);
    return '⭐'.repeat(n) + '☆'.repeat(3 - n);
  }

  function calculateHydrationMedal(r){
    if(r.score >= 2600 && r.hydration >= 65 && r.bossDefeated) return 'Aqua Legend 🏆';
    if(r.score >= 2200 && r.hydration >= 60) return 'Aqua Master 💎';
    if(r.score >= 1600 && r.hydration >= 50) return 'Gold 💧';
    if(r.score >= 900) return 'Silver ⭐';
    return 'Bronze 👍';
  }

  function calculateHydrationBadges(result){
    return HHA_HYDRATION_BADGES.filter(b => {
      try{ return b.test(result); }
      catch(e){ return false; }
    });
  }

  function endHydrationGame(){
    if(HHA_HYDRATION_FLOW.ended) return;

    HHA_HYDRATION_FLOW.ended = true;
    HYD.started = false;

    hhaHydrationCancelRAF();

    const S = HHA_HYDRATION_STATE;
    const MS = HHA_HYDRATION_MISSION_STATE;
    const BS = HHA_HEAT_BOSS_STATE;

    hhaHydrationRemove('.hha-hydration-target');
    hhaHydrationRemove('.hha-hydration-controls');
    hhaHydrationRemove('.hha-timebar');
    hhaHydrationRemove('.hha-mission-hud');
    hhaHydrationRemove('.hha-boss-attack-hud');
    hhaHydrationRemove('.hha-boss-reason');
    hhaHydrationRemove('.hha-heat-boss-hud');
    hhaHydrationRemove('.hha-quick-check');

    const baseResult = {
      score: Math.max(0, Math.round(S.score)),
      hydration: Math.round(S.hydration),
      maxCombo: S.maxCombo,
      hitsGood: S.hitsGood,
      hitsJunk: S.hitsJunk,
      misses: S.misses,
      shieldLeft: S.shield || 0,
      shieldUsed: S.shieldUsed || 0,
      missionsCompleted: MS.completed,
      missionsFailed: MS.failed,
      bossDefeated: BS.hp <= 0 || S.bossHp <= 0
    };

    const daily = getTodayHydrationChallenge();
    baseResult.dailyChallenge = daily;
    baseResult.dailyCleared = !!daily.test(baseResult);

    baseResult.stars = calculateHydrationStars(baseResult);
    baseResult.medal = calculateHydrationMedal(baseResult);
    baseResult.badges = calculateHydrationBadges(baseResult);
    baseResult.learningInsight = getHydrationLearningInsight(baseResult);
    baseResult.learningStats = Object.assign({}, HHA_HYDRATION_LEARNING_STATE);
    baseResult.bloomEvidence = calculateHydrationBloomEvidence(baseResult);

    const bestInfo = saveHydrationBest(baseResult);
    baseResult.isNewBest = bestInfo.isNewBest;
    baseResult.previousBest = bestInfo.oldBest;
    baseResult.best = bestInfo.best;

    saveHydrationLastSummary(baseResult);

    emitHydrationEvent('session_end', {
      scoreFinal: baseResult.score,
      hydrationFinal: baseResult.hydration,
      maxCombo: baseResult.maxCombo,
      hitsGood: baseResult.hitsGood,
      hitsJunk: baseResult.hitsJunk,
      misses: baseResult.misses,
      missionsCompleted: baseResult.missionsCompleted,
      missionsFailed: baseResult.missionsFailed,
      bossDefeated: baseResult.bossDefeated,
      stars: baseResult.stars,
      medal: baseResult.medal,
      dailyCleared: baseResult.dailyCleared,
      learningGoodChoices: HHA_HYDRATION_LEARNING_STATE.goodChoices,
      learningRiskyChoices: HHA_HYDRATION_LEARNING_STATE.riskyChoices,
      learningWaterChoices: HHA_HYDRATION_LEARNING_STATE.waterChoices,
      learningFruitVegChoices: HHA_HYDRATION_LEARNING_STATE.fruitVegChoices,
      learningSugarMistakes: HHA_HYDRATION_LEARNING_STATE.sugarMistakes,
      learningSaltyMistakes: HHA_HYDRATION_LEARNING_STATE.saltyMistakes,
      learningHeatMistakes: HHA_HYDRATION_LEARNING_STATE.heatMistakes,
      learningInsight: baseResult.learningInsight ? baseResult.learningInsight.text : ''
    });

    showHydrationEndSummary(baseResult);
  }

  function saveHydrationLastSummary(result){
    const payload = {
      game: 'hydration',
      mode: qs('mode', qs('view', 'mobile')),
      diff: qs('diff', 'normal'),
      pid: qs('pid', 'anon'),
      score: result.score,
      hydration: result.hydration,
      stars: result.stars,
      medal: result.medal,
      badges: result.badges.map(b => b.id),
      missionsCompleted: result.missionsCompleted,
      bossDefeated: result.bossDefeated,
      dailyCleared: result.dailyCleared,
      learningInsight: result.learningInsight ? result.learningInsight.text : '',
      bloomEvidence: result.bloomEvidence || null,
      endedAt: new Date().toISOString()
    };

    hhaHydrationStorageJsonSet('HHA_LAST_SUMMARY', payload);
    hhaHydrationStorageJsonSet('HHA_LAST_SUMMARY_HYDRATION', payload);
  }

  function showHydrationEndSummary(result){
    let box = hhaHydrationQS('.hha-hydration-summary');
    if(!box){
      box = document.createElement('div');
      box.className = 'hha-hydration-summary';
      document.body.appendChild(box);
    }

    hydrationFeedback(result.stars >= 3 ? 'mission' : 'good');

    if(result.isNewBest){
      hhaHydrationSetTimeout(() => hydrationFeedback('fever'), 220);
    }

    if(result.stars >= 3 || result.isNewBest || result.bossDefeated){
      spawnHydrationRewardConfetti();
    }

    const badgesHtml = renderHydrationBadges(result.badges);
    const daily = result.dailyChallenge;

    box.innerHTML = `
      <div class="hha-summary-card hha-reward-card">
        <div class="hha-summary-kicker">
          ${result.isNewBest ? '🎉 New Personal Best!' : 'ภารกิจเติมน้ำสำเร็จ!'}
        </div>

        <div class="hha-summary-title">${esc(result.medal)}</div>

        <div class="hha-stars">${renderStars(result.stars)}</div>

        <div class="hha-score-big">
          <b>${result.score}</b>
          <span>คะแนนรวม</span>
        </div>

        <div class="hha-summary-grid">
          <div><b>${result.hydration}%</b><span>Hydration</span></div>
          <div><b>${result.maxCombo}</b><span>Combo สูงสุด</span></div>
          <div><b>${result.missionsCompleted}</b><span>Mission สำเร็จ</span></div>
          <div><b>${result.bossDefeated ? 'ชนะ' : 'ยังไม่ชนะ'}</b><span>Heat Boss</span></div>
        </div>

        <div class="hha-daily-result ${result.dailyCleared ? 'clear' : 'notclear'}">
          <b>${esc(daily.icon)} ${esc(daily.title)}</b>
          <span>${esc(daily.goalText)}</span>
          <em>${result.dailyCleared ? 'สำเร็จวันนี้!' : 'ลองอีกครั้งเพื่อผ่าน Challenge'}</em>
        </div>

        <div class="hha-learning-summary">
          <div class="hha-learning-icon">${esc(result.learningInsight.icon)}</div>
          <div>
            <b>${esc(result.learningInsight.title)}</b>
            <span>${esc(result.learningInsight.text)}</span>
          </div>
        </div>

        ${badgesHtml}

        <div class="hha-best-row">
          ${renderHydrationBestText(result)}
        </div>

        <div class="hha-summary-tip">
          ${esc(getHydrationSmartTip(result))}
        </div>

        <div class="hha-summary-actions">
          <button class="hha-summary-btn primary" onclick="restartHydrationSameChallenge()">เล่นอีกครั้ง</button>
          <button class="hha-summary-btn soft" onclick="restartHydrationNewSeed()">Challenge ใหม่</button>
          <button class="hha-summary-btn ghost" onclick="goHydrationBackHub()">กลับ HUB</button>
        </div>
      </div>
    `;
  }

  function renderHydrationBadges(badges){
    badges = Array.isArray(badges) ? badges : [];

    if(!badges.length){
      return `
        <div class="hha-badges empty">
          <b>Badge รอบนี้</b>
          <span>อีกนิดเดียว! ลองเก็บน้ำดีและทำ Mission ให้มากขึ้น</span>
        </div>
      `;
    }

    return `
      <div class="hha-badges">
        <b>Badge ที่ได้</b>
        <div class="hha-badge-list">
          ${badges.slice(0,4).map(b => `
            <div class="hha-badge">
              <i>${esc(b.icon)}</i>
              <strong>${esc(b.title)}</strong>
              <span>${esc(b.desc)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderHydrationBestText(result){
    if(result.isNewBest){
      return `
        <b>🏅 สถิติใหม่!</b>
        <span>เก่งมาก รอบนี้ทำคะแนนดีที่สุดของตัวเอง</span>
      `;
    }

    const bestScore = result.best ? Number(result.best.score || 0) : 0;
    const gap = Math.max(0, bestScore - result.score);

    if(bestScore > 0){
      return `
        <b>สถิติเดิม: ${bestScore}</b>
        <span>อีก ${gap} คะแนนจะทำลายสถิติ</span>
      `;
    }

    return `
      <b>เริ่มเก็บสถิติแล้ว</b>
      <span>เล่นรอบต่อไปเพื่อทำคะแนนให้สูงขึ้น</span>
    `;
  }

  function getHydrationSmartTip(r){
    if(r.hydration < 35){
      return '💧 รอบหน้าให้รีบเก็บน้ำเปล่าและแตงโมก่อน เพราะ Hydration ต่ำเกินไป';
    }

    if(r.hitsJunk >= 6){
      return '🧋 ระวังน้ำหวานและของเค็ม พวกนี้ทำให้เสีย Combo และ Hydration ลดเร็ว';
    }

    if(r.missionsCompleted <= 1){
      return '🎯 ลองโฟกัส Mission กลางจอให้มากขึ้น เพราะ Mission ช่วยลดพลังบอสได้';
    }

    if(!r.bossDefeated && r.score >= 1200){
      return '🌞 คะแนนดีแล้ว รอบหน้าลองทำ Mission ตอน Boss เพื่อชนะ Heat Monster';
    }

    if(r.maxCombo < 5){
      return '🔥 พยายามเก็บของดีต่อเนื่องเพื่อเข้า Fever Mode คะแนนจะขึ้นเร็วมาก';
    }

    if(r.dailyCleared){
      return '🏆 เยี่ยมมาก! วันนี้ผ่าน Daily Challenge แล้ว ลองเล่นอีกรอบเพื่อเก็บ Badge เพิ่ม';
    }

    return '💚 ทำได้ดีมาก! ดื่มน้ำให้พอดี เลือกเครื่องดื่มที่ดี และหลีกเลี่ยงหวาน/เค็มจัด';
  }

  function restartHydrationSameChallenge(){
    const u = new URL(location.href);
    u.searchParams.set('run', 'play');
    location.href = u.toString();
  }

  function restartHydrationNewSeed(){
    const u = new URL(location.href);
    u.searchParams.set('run', 'play');
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  /* =========================================================
     Back / Exit / Logging
     ========================================================= */

  function goHydrationBackHub(){
    const ctx = HHA_HYDRATION_FLOW.ctx || getHydrationCtx();

    emitHydrationEvent('back_hub', {
      score: HHA_HYDRATION_STATE ? Math.round(HHA_HYDRATION_STATE.score) : 0,
      hydration: HHA_HYDRATION_STATE ? Math.round(HHA_HYDRATION_STATE.hydration) : 0
    });

    if(ctx.hub){
      try{
        const hubUrl = new URL(ctx.hub, location.href);
        preserveHydrationParams(hubUrl);
        location.href = hubUrl.toString();
        return;
      }catch(e){
        location.href = ctx.hub;
        return;
      }
    }

    let fallback = '/webxr-health-mobile/herohealth/hub.html';

    if(ctx.zone === 'nutrition'){
      fallback = '/webxr-health-mobile/herohealth/nutrition-zone.html';
    } else if(ctx.zone === 'fitness'){
      fallback = '/webxr-health-mobile/herohealth/fitness-zone.html';
    } else if(ctx.zone === 'hygiene'){
      fallback = '/webxr-health-mobile/herohealth/hygiene-zone.html';
    }

    const u = new URL(fallback, location.origin);
    preserveHydrationParams(u);
    location.href = u.toString();
  }

  function preserveHydrationParams(u){
    const ctx = HHA_HYDRATION_FLOW.ctx || getHydrationCtx();

    [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'zone',
      'game',
      'mode',
      'studyId',
      'phase',
      'conditionGroup'
    ].forEach(k => {
      if(ctx[k] !== undefined && ctx[k] !== null && String(ctx[k]) !== ''){
        u.searchParams.set(k, String(ctx[k]));
      }
    });

    return u;
  }

  function emitHydrationEvent(type, data){
    const ctx = HHA_HYDRATION_FLOW.ctx || getHydrationCtx();

    const payload = Object.assign({
      projectTag: 'HeroHealth',
      game: 'hydration',
      eventType: type,
      sessionId: HHA_HYDRATION_FLOW.sessionId || '',
      pid: ctx.pid,
      name: ctx.name,
      nick: ctx.nick,
      diff: ctx.diff,
      view: ctx.view,
      mode: ctx.mode,
      seed: ctx.seed,
      run: ctx.run,
      zone: ctx.zone,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      timestampIso: new Date().toISOString(),
      localDate: getBangkokYmd(),
      version: HYD.VERSION
    }, data || {});

    hhaHydrationDebugLog('event', type, payload);

    try{
      window.dispatchEvent(new CustomEvent('hha:hydration:event', { detail: payload }));
    }catch(e){}

    try{
      window.dispatchEvent(new CustomEvent('hha:game:event', { detail: payload }));
    }catch(e){}

    try{
      if(window.HHA_LOGGER && typeof window.HHA_LOGGER.event === 'function'){
        window.HHA_LOGGER.event(payload);
      }
    }catch(e){
      hhaHydrationDebugError(e);
    }

    return payload;
  }

  function flushHydrationBeforeExit(reason){
    if(HHA_HYDRATION_FLOW.ended) return;

    try{
      const S = HHA_HYDRATION_STATE || {};
      const payload = {
        game: 'hydration',
        reason: reason || 'exit',
        pid: qs('pid', 'anon'),
        diff: qs('diff', 'normal'),
        view: qs('view', 'mobile'),
        score: Math.max(0, Math.round(S.score || 0)),
        hydration: Math.round(S.hydration || 0),
        combo: S.combo || 0,
        endedAt: new Date().toISOString(),
        partial: true
      };

      hhaHydrationStorageJsonSet('HHA_LAST_SUMMARY_HYDRATION_PARTIAL', payload);
      emitHydrationEvent('session_partial_exit', payload);
    }catch(e){}
  }

  function bindHydrationExitFlush(){
    if(HYD.exitFlushOn) return;
    HYD.exitFlushOn = true;

    hhaHydrationOn(window, 'pagehide', () => flushHydrationBeforeExit('pagehide'), { passive:true });
    hhaHydrationOn(document, 'visibilitychange', () => {
      if(document.visibilityState === 'hidden'){
        flushHydrationBeforeExit('visibility_hidden');
      }
    }, { passive:true });
  }

  /* =========================================================
     Viewport / Debug
     ========================================================= */

  function updateHydrationViewportVars(){
    try{
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--hha-vh', vh + 'px');
    }catch(e){}
  }

  function bindHydrationViewportFix(){
    if(HYD.viewportFixOn) return;
    HYD.viewportFixOn = true;

    updateHydrationViewportVars();
    hhaHydrationOn(window, 'resize', updateHydrationViewportVars, { passive:true });
    hhaHydrationOn(window, 'orientationchange', () => {
      hhaHydrationSetTimeout(updateHydrationViewportVars, 250);
    }, { passive:true });
  }

  function mountHydrationDebugPanel(){
    if(!HYD.debug) return;

    const box = hhaHydrationEnsure('hha-hydration-debug', 'hha-debug-panel');

    box.innerHTML = `
      <b>Hydration Debug</b>
      <span>version: ${esc(HYD.VERSION)}</span>
      <span>state: ready</span>
    `;
  }

  function updateHydrationDebugPanel(extra){
    if(!HYD.debug) return;

    const box = hhaHydrationQS('#hha-hydration-debug');
    if(!box) return;

    const S = HHA_HYDRATION_STATE || {};
    const MS = HHA_HYDRATION_MISSION_STATE || {};
    const BS = HHA_HEAT_BOSS_STATE || {};

    box.innerHTML = `
      <b>Hydration Debug</b>
      <span>score: ${Math.round(S.score || 0)}</span>
      <span>hydration: ${Math.round(S.hydration || 0)}</span>
      <span>combo: ${S.combo || 0}</span>
      <span>mission: ${MS.active ? esc(MS.active.id) : '-'}</span>
      <span>boss: ${BS.active ? Math.round(BS.hp || 0) : '-'}</span>
      <span>${esc(extra || HYD.VERSION)}</span>
    `;
  }

  /* =========================================================
     Boot
     ========================================================= */

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootHydrationGame, { once:true });
  } else {
    bootHydrationGame();
  }

})();