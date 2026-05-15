/* =========================================================
   HeroHealth Hydration VR
   File: /herohealth/hydration-vr/hydration-vr.js
   Version: v10.1.2-cooldown-nutrition-return
   Purpose:
   - Aqua Rush hydration game
   - PC / Mobile / Cardboard cVR
   - Wave + Mini Mission + Heat Boss + Fever
   - Badge / Personal Best / Daily Challenge
   - Boss fair win + combo pressure + green-zone pressure
   - Boss 90s balance
   - Target size balance
   - Emoji default target + optional image target fallback
   - Summary + learning analytics
   - Cooldown must return to Nutrition Zone
   ========================================================= */

(function(){
  'use strict';

  window.HHA = window.HHA || {};
  window.HHA = window.HHA || {};
window.HHA.Hydration = window.HHA.Hydration || {
  VERSION: 'v10.1.2-cooldown-nutrition-return',
  booted: false,
  started: false,
  destroyed: false,
  timers: new Set(),
  rafId: 0,
  listeners: [],
  debug: false
};

const HYD = window.HHA.Hydration;
HYD.VERSION = 'v10.1.2-cooldown-nutrition-return';

  window.beginHydrationFromOverlay = beginHydrationFromOverlay;
  window.toggleHydrationPause = toggleHydrationPause;
  window.resumeHydrationGame = resumeHydrationGame;
  window.goHydrationBackHub = goHydrationBackHub;
  window.goHydrationCooldownThenHub = goHydrationCooldownThenHub;
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
     Flow / Context
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
      zone: 'nutrition',
      game: u.searchParams.get('game') || 'hydration',
      mode: u.searchParams.get('mode') || u.searchParams.get('view') || 'mobile',
      hub: u.searchParams.get('hub') || '',
      log: u.searchParams.get('log') || '',
      api: u.searchParams.get('api') || '',
      studyId: u.searchParams.get('studyId') || '',
      phase: u.searchParams.get('phase') || '',
      studyPhase: u.searchParams.get('studyPhase') || '',
      conditionGroup: u.searchParams.get('conditionGroup') || ''
    };
  }

  function getHydrationNutritionReturnUrl(ctx){
    ctx = ctx || getHydrationCtx();

    const rawHub = String(ctx.hub || '');

    try{
      const decoded = decodeURIComponent(rawHub || '');
      if(decoded && decoded.includes('nutrition-zone.html')){
        return rawHub;
      }
    }catch(e){}

    return './nutrition-zone.html';
  }

  /* =========================================================
     Data
     ========================================================= */

  const HHA_HYDRATION_ASSET_BASE = './assets/hydration/';

  /*
    Default = emoji first.
    If image files are uploaded and paths are correct, change this to true.
  */
  const HHA_HYDRATION_USE_IMAGE_TARGETS = false;

  const HHA_HYDRATION_ITEM_IMAGES = {
    water: 'water.png',
    watermelon: 'watermelon.png',
    cucumber: 'cucumber.png',
    ice: 'ice-shield.png',
    milk: 'milk.png',
    soda: 'soda.png',
    bubbletea: 'bubble-tea.png',
    salty: 'salty-fries.png',
    sun: 'heat-sun.png',
    energy: 'energy-drink.png'
  };

  function getHydrationItemImageSrc(item){
    if(!HHA_HYDRATION_USE_IMAGE_TARGETS) return '';

    const file = HHA_HYDRATION_ITEM_IMAGES[item.id];
    if(!file) return '';

    return HHA_HYDRATION_ASSET_BASE + file;
  }

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
      hydrationDrain: 0.04
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
      hydrationDrain: 0.075
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
      hydrationDrain: 0.095
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
      hydrationDrain: 0.13
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
    {
      id:'green-day',
      icon:'💚',
      title:'Green Zone Day',
      goalText:'จบเกมด้วย Hydration 60%+',
      test:r => r.hydration >= 60,
      reward:'Green Hero'
    },
    {
      id:'combo-day',
      icon:'🔥',
      title:'Combo Splash Day',
      goalText:'ทำ Combo 10+',
      test:r => r.maxCombo >= 10,
      reward:'Fever Bonus'
    },
    {
      id:'mission-day',
      icon:'🎯',
      title:'Mission Rush Day',
      goalText:'ทำ Mission สำเร็จ 3 ครั้ง',
      test:r => r.missionsCompleted >= 3,
      reward:'Mission Badge'
    },
    {
      id:'boss-day',
      icon:'🌞',
      title:'Heat Boss Day',
      goalText:'ชนะ Heat Monster',
      test:r => r.bossDefeated,
      reward:'Boss Slayer'
    },
    {
      id:'clean-choice-day',
      icon:'🧋',
      title:'Sugar Dodger Day',
      goalText:'โดนของเสี่ยงไม่เกิน 2 ครั้ง',
      test:r => r.hitsJunk <= 2,
      reward:'Sugar Dodger'
    }
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
     Boot / Start UI
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
          กลับ Nutrition Zone
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
    HYD.ready = true;
    window.HHA_HYDRATION_ENGINE_READY = true;

    HYD.destroyed = false;
    HYD.debug = hhaHydrationIsDebug();

    const ctx = getHydrationCtx();

    HHA_HYDRATION_FLOW.ctx = ctx;
    HHA_HYDRATION_FLOW.sessionId = makeHydrationSessionId();

    bindHydrationViewportFix();
    bindHydrationExitFlush();

    document.body.classList.add('hha-hydration-arena');
    document.body.classList.add('hha-view-' + ctx.view);
    document.body.dataset.hhaView = ctx.view;

    mountHydrationDebugPanel();

    emitHydrationEvent('page_open', {
      sessionId: HHA_HYDRATION_FLOW.sessionId,
      diff: ctx.diff,
      time: ctx.time,
      view: ctx.view,
      mode: ctx.mode,
      zone: 'nutrition'
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
    document.body.dataset.hhaView = ctx.view || 'mobile';

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
      'hha-shake',
      'hha-hydration-final-tension',
      'hha-hydration-boss-drama'
    );
    document.body.removeAttribute('data-heat-attack');

    const field = getHydrationPlayfield();
    field.innerHTML = '';

    scheduleNextHydrationMission(performance.now());

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
      '.hha-pause-overlay',
      '.hha-boss-damage-pop',
      '.hha-boss-victory-fx'
    ].forEach(hhaHydrationRemove);

    document.body.classList.remove(
      'hha-fever-mode',
      'hha-heat-boss',
      'hha-boss-attacking',
      'hha-dehydration-danger',
      'hha-shake',
      'hha-hydration-final-tension',
      'hha-hydration-boss-drama'
    );

    document.body.removeAttribute('data-heat-attack');
  }

  /* =========================================================
     Tick / Difficulty / Waves
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

  function isHydrationShortRun(){
    return Number(HHA_GAME_TOTAL_SEC || qs('time', 150)) <= 100;
  }

  function getHydrationWave(elapsedSec, totalSec){
    const p = clamp(elapsedSec / Math.max(1, totalSec), 0, 1);

    if(Number(totalSec || 150) <= 100){
      if(p >= 0.74){
        return HHA_HYDRATION_WAVES.find(w => w.id === 'heat-boss') || HHA_HYDRATION_WAVES[4];
      }

      if(p >= 0.56){
        return HHA_HYDRATION_WAVES.find(w => w.id === 'crisis') || HHA_HYDRATION_WAVES[3];
      }
    }

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
    const timeLeftSec = HHA_GAME_TOTAL_SEC - elapsedSec;

    document.body.classList.toggle(
      'hha-hydration-final-tension',
      timeLeftSec <= 20 && !HHA_HYDRATION_FLOW.ended
    );

    const dt = Math.min(0.08, Math.max(0, (now - HHA_LAST_TICK_MS) / 1000));
    HHA_LAST_TICK_MS = now;

    const wave = checkHydrationWaveChange(elapsedSec, HHA_GAME_TOTAL_SEC);

    applyHydrationDrain(wave, dt);

    maybeStartHydrationMission(now, wave);
    updateHydrationMissionTick(now, dt);
    updateHeatBossAttackTick(now, dt, wave);
    applyGreenZoneBossPressure(dt);

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
     Playfield / Targets
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

  function getHydrationTargetSizeByView(){
    const view = qs('view', 'mobile');

    if(view === 'pc'){
      return { w: 74, h: 88 };
    }

    if(view === 'cvr'){
      return { w: 92, h: 108 };
    }

    return {
      w: window.innerWidth <= 520 ? 76 : 84,
      h: window.innerWidth <= 520 ? 90 : 98
    };
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
    node.style.setProperty('--move-dur', (1.02 + hhaHydrationRand() * 0.52) + 's');

    const imgSrc = getHydrationItemImageSrc(item);

    node.innerHTML = `
      <span class="hha-target-icon ${imgSrc ? 'has-img' : ''}">
        ${
          imgSrc
            ? `<img src="${esc(imgSrc)}" alt="${esc(item.label)}" loading="lazy" onerror="this.remove();this.parentNode.textContent='${esc(item.icon)}';">`
            : esc(item.icon)
        }
      </span>
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

    const size = getHydrationTargetSizeByView();
    const targetW = size.w;
    const targetH = size.h;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const lane = getHydrationSpawnLane();

    const jitterX = (hhaHydrationRand() * 2 - 1) * 36;
    const jitterY = (hhaHydrationRand() * 2 - 1) * 28;

    const x = clamp((vw * lane.x) - targetW / 2 + jitterX, 12, vw - targetW - 12);

    const view = qs('view', 'mobile');

    const topSafe =
      view === 'cvr' ? 132 :
      view === 'pc' ? 96 :
      104;

    const bottomSafe =
      view === 'cvr' ? 126 :
      view === 'pc' ? 78 :
      84;

    const y = clamp(
      (vh * lane.y) - targetH / 2 + jitterY,
      topSafe,
      vh - targetH - bottomSafe
    );

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
      const gained = Math.round(item.score * (S.feverActive ? 1.55 : 1));

      S.score += gained;
      S.hydration = clamp(S.hydration + item.hydration, 0, 100);
      S.combo += 1;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.hitsGood += 1;

      applyBossComboPressure();

      if(item.shield){
        S.shield += item.shield;
      }

      S.fever = clamp(S.fever + 12, 0, 100);

      if(HHA_HEAT_BOSS_STATE.active){
        let bossHitDamage = 1.6;

        if(item.id === 'water') bossHitDamage = 2.4;
        if(item.id === 'ice') bossHitDamage = 3.2;
        if(S.combo >= 8) bossHitDamage += 1.2;
        if(S.feverActive) bossHitDamage += 1.8;

        damageHeatBoss(bossHitDamage, 'good_item_hit');
      }

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
          <b>🌈 x1.55</b>
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
        <button type="button" class="soft" onclick="goHydrationBackHub()">กลับ Nutrition Zone</button>
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
    showHydrationBanner('🌈 FEVER MODE! คะแนนพิเศษ เก็บน้ำรัว ๆ!');
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
    const BS = HHA_HEAT_BOSS_STATE;

    let gap = 14500 + hhaHydrationRand() * 6500;

    if(BS.active){
      gap = isHydrationShortRun()
        ? 2400 + hhaHydrationRand() * 1600
        : 3400 + hhaHydrationRand() * 2200;
    }

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
      const bossMissionDamage = (m.bossDamage || 10) * 1.65;
      damageHeatBoss(bossMissionDamage, 'mission_clear');
    }

    MS.completed += 1;

    showHydrationBanner(`สำเร็จ! ${m.icon} +${m.rewardScore}`);
    showHydrationMissionToast(`✅ Mission Clear! บอสเสียพลัง -${Math.round((m.bossDamage || 10) * 1.65)}`);
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

  function applyBossComboPressure(){
    const BS = HHA_HEAT_BOSS_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!BS.active) return;
    if(BS.hp <= 0) return;

    if(S.combo > 0 && S.combo % 10 === 0){
      damageHeatBoss(8, 'combo_milestone_' + S.combo);
      showHydrationMissionToast('🔥 Combo ' + S.combo + '! บอสเสียพลัง -8');
    }
  }

  function applyGreenZoneBossPressure(dt){
    const BS = HHA_HEAT_BOSS_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!BS.active) return;
    if(BS.hp <= 0) return;

    if(S.hydration >= 90){
      damageHeatBoss(1.25 * dt, 'green_zone_pressure_90');
      return;
    }

    if(S.hydration >= 80){
      damageHeatBoss(0.9 * dt, 'green_zone_pressure_80');
    }
  }

  function getHydrationBossStartHp(){
    const diff = qs('diff', 'normal');
    const shortRun = isHydrationShortRun();

    if(diff === 'easy') return shortRun ? 36 : 45;
    if(diff === 'hard') return shortRun ? 68 : 80;
    if(diff === 'challenge') return shortRun ? 88 : 100;

    return shortRun ? 46 : 58;
  }

  function damageHeatBoss(amount, reason){
    const BS = HHA_HEAT_BOSS_STATE;
    const S = HHA_HYDRATION_STATE;

    if(!BS.active) return;
    if(BS.hp <= 0) return;

    amount = Number(amount || 0);
    if(amount <= 0) return;

    BS.hp = clamp(BS.hp - amount, 0, 100);
    S.bossHp = BS.hp;

    mountHeatBossHUD();
    pulseHeatBossDamage();
    showBossDamagePop(amount, reason);

    emitHydrationEvent('boss_damage', {
      amount: Math.round(amount),
      reason: reason || 'unknown',
      bossHp: Math.round(BS.hp),
      score: Math.round(S.score)
    });

    if(BS.hp <= 0){
      defeatHeatBoss();
    }
  }

  function startHeatBossPhase(){
    const S = HHA_HYDRATION_STATE;
    const BS = HHA_HEAT_BOSS_STATE;

    const startHp = getHydrationBossStartHp();

    BS.active = true;
    BS.hp = startHp;
    BS.attack = null;
    BS.attackCount = 0;
    BS.nextAttackAt = performance.now() + 2200;
    BS.attackEndsAt = 0;

    S.bossHp = startHp;

    document.body.classList.add('hha-heat-boss');
    document.body.classList.add('hha-hydration-boss-drama');

    showHydrationBanner('🌞 Heat Monster มาแล้ว! เก็บน้ำ + ทำ Mission เพื่อลด HP!');
    mountHeatBossHUD();

    HHA_HYDRATION_MISSION_STATE.nextAt = performance.now() + 1500;

    emitHydrationEvent('boss_start', {
      bossHp: startHp
    });
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

    BS.active = false;
    BS.attack = null;
    BS.hp = 0;
    S.bossHp = 0;

    S.score += 800;
    S.hydration = clamp(S.hydration + 18, 0, 100);
    S.fever = 100;

    document.body.classList.remove('hha-heat-boss', 'hha-boss-attacking', 'hha-hydration-boss-drama');
    document.body.removeAttribute('data-heat-attack');

    hhaHydrationRemove('.hha-heat-boss-hud');
    updateHeatBossAttackHUD();
    updateHydrationHUD();

    showHydrationBanner('🏆 ชนะ Heat Monster!');
    showHydrationMissionToast('โบนัส +800 และเติมน้ำกลับมา!');
    spawnBossVictoryFx();

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

  function showBossDamagePop(amount, reason){
    const pop = document.createElement('div');
    pop.className = 'hha-boss-damage-pop';
    pop.textContent = '-' + Math.max(1, Math.round(amount)) + ' HP';

    const boss = hhaHydrationQS('.hha-heat-boss-hud');
    if(boss){
      const r = boss.getBoundingClientRect();
      pop.style.left = (r.left + r.width / 2) + 'px';
      pop.style.top = (r.top + 8) + 'px';
    }else{
      pop.style.left = '50vw';
      pop.style.top = '78vh';
    }

    document.body.appendChild(pop);
    hhaHydrationSetTimeout(() => pop.remove(), 760);
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
     Juice / Audio / FX
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

  function spawnBossVictoryFx(){
    if(HHA_HYDRATION_JUICE.reducedMotion) return;

    const fx = document.createElement('div');
    fx.className = 'hha-boss-victory-fx';
    fx.innerHTML = '<b>🏆 HEAT BOSS CLEARED!</b>';
    document.body.appendChild(fx);

    hhaHydrationSetTimeout(() => fx.remove(), 1400);
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
     Daily / Best / Summary
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
    if(r.score >= 2600 && r.hydration >= 65 && r.bossDefeated){
      return 'Aqua Legend 🏆';
    }

    if(r.score >= 2200 && r.hydration >= 60 && r.bossDefeated){
      return 'Aqua Master 💎';
    }

    if(r.score >= 2200 && r.hydration >= 55){
      return 'Aqua Hero 💧';
    }

    if(r.score >= 1600 && r.hydration >= 50){
      return 'Gold 💧';
    }

    if(r.score >= 900){
      return 'Silver ⭐';
    }

    return 'Bronze 👍';
  }

  function calculateHydrationBadges(result){
    return HHA_HYDRATION_BADGES.filter(b => {
      try{ return b.test(result); }
      catch(e){ return false; }
    });
  }

  function applyHydrationFairBossWinBeforeSummary(){
    const S = HHA_HYDRATION_STATE;
    const BS = HHA_HEAT_BOSS_STATE;
    const MS = HHA_HYDRATION_MISSION_STATE;

    if(BS.hp <= 0 || S.bossHp <= 0) return;

    const shortRun = isHydrationShortRun();

    const excellentHydration = shortRun ? S.hydration >= 70 : S.hydration >= 85;
    const strongCombo = shortRun ? S.maxCombo >= 25 : S.maxCombo >= 30;
    const goodScore = shortRun ? S.score >= 6000 : S.score >= 5000;
    const missionOk = shortRun ? MS.completed >= 2 : MS.completed >= 1;

    if(excellentHydration && strongCombo && goodScore && missionOk){
      BS.hp = 0;
      S.bossHp = 0;

      S.score += shortRun ? 350 : 500;

      emitHydrationEvent('boss_fair_win', {
        reason: shortRun ? 'short_run_excellent_play' : 'excellent_hydration_combo_score',
        hydration: Math.round(S.hydration),
        maxCombo: S.maxCombo,
        missionsCompleted: MS.completed,
        score: Math.round(S.score),
        shortRun: !!shortRun
      });

      showHydrationMissionToast(
        shortRun
          ? '🏆 เล่นดีมาก! ชนะ Heat Boss ในโหมด 90s'
          : '🏆 เล่นดีมาก! ชนะ Heat Boss แบบ Fair Win'
      );
    }
  }

  function endHydrationGame(){
    if(HHA_HYDRATION_FLOW.ended) return;

    HHA_HYDRATION_FLOW.ended = true;
    HYD.started = false;

    hhaHydrationCancelRAF();

    const S = HHA_HYDRATION_STATE;
    const MS = HHA_HYDRATION_MISSION_STATE;
    const BS = HHA_HEAT_BOSS_STATE;

    applyHydrationFairBossWinBeforeSummary();

    document.body.classList.remove(
      'hha-hydration-final-tension',
      'hha-hydration-boss-drama',
      'hha-boss-attacking',
      'hha-heat-boss'
    );
    document.body.removeAttribute('data-heat-attack');

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

    baseResult.accuracyGoodPct = baseResult.hitsGood + baseResult.hitsJunk > 0
      ? Math.round((baseResult.hitsGood / (baseResult.hitsGood + baseResult.hitsJunk)) * 100)
      : 0;

    baseResult.riskAvoidancePct = baseResult.hitsGood + baseResult.hitsJunk > 0
      ? Math.round((1 - baseResult.hitsJunk / (baseResult.hitsGood + baseResult.hitsJunk)) * 100)
      : 0;

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
      accuracyGoodPct: baseResult.accuracyGoodPct,
      riskAvoidancePct: baseResult.riskAvoidancePct,
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
      zone: 'nutrition',
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
      accuracyGoodPct: result.accuracyGoodPct,
      riskAvoidancePct: result.riskAvoidancePct,
      learningStats: result.learningStats || null,
      learningInsight: result.learningInsight ? result.learningInsight.text : '',
      bloomEvidence: result.bloomEvidence || null,
      endedAt: new Date().toISOString()
    };

    hhaHydrationStorageJsonSet('HHA_LAST_SUMMARY', payload);
    hhaHydrationStorageJsonSet('HHA_LAST_SUMMARY_HYDRATION', payload);
  }

  function getHydrationNextGoal(result){
    if(!result.bossDefeated){
      return 'รอบหน้า: ชนะ Heat Monster ให้ได้ 🌞';
    }

    if(result.maxCombo < 50){
      return 'รอบหน้า: ทำ Combo 50 ให้ได้ 🔥';
    }

    if(result.hydration < 95){
      return 'รอบหน้า: จบเกมด้วย Hydration 95%+ 💧';
    }

    if(result.missionsCompleted < 4){
      return 'รอบหน้า: ทำ Mission สำเร็จ 4 ครั้ง 🎯';
    }

    return 'รอบหน้า: ทำคะแนนใหม่ให้สูงกว่าเดิม 🏆';
  }

  function showHydrationEndSummary(result){
    hhaHydrationRemove('.hha-hydration-summary');

    const box = document.createElement('div');
    box.className = 'hha-hydration-summary';
    document.body.appendChild(box);

    const dbg = document.getElementById('hha-hydration-debug');
    if(dbg){
      dbg.style.opacity = '.22';
      dbg.style.transform = 'scale(.82)';
      dbg.style.transformOrigin = 'left bottom';
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

        <div class="hha-next-goal">
          <b>เป้าหมายรอบหน้า</b>
          <span>${esc(getHydrationNextGoal(result))}</span>
        </div>

        <div class="hha-best-row">
          ${renderHydrationBestText(result)}
        </div>

        <div class="hha-summary-tip">
          ${esc(getHydrationSmartTip(result))}
        </div>

        <div class="hha-summary-actions">
          <button class="hha-summary-btn primary" onclick="restartHydrationSameChallenge()">เล่นอีกครั้ง</button>
          <button class="hha-summary-btn soft" onclick="restartHydrationNewSeed()">Challenge ใหม่</button>
          <button class="hha-summary-btn ghost" onclick="goHydrationCooldownThenHub()">Cooldown แล้วกลับ Zone</button>
          <button class="hha-summary-btn ghost" onclick="goHydrationBackHub()">กลับ Nutrition Zone</button>
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

    if(r.missionsCompleted <= 1 && !r.bossDefeated){
      return '🎯 ลองโฟกัส Mission กลางจอให้มากขึ้น เพราะ Mission ช่วยลดพลังบอสได้';
    }

    if(!r.bossDefeated && r.score >= 1200){
      return '🌞 คะแนนดีแล้ว รอบหน้าลองทำ Mission และเก็บน้ำดีตอน Boss เพื่อชนะ Heat Monster';
    }

    if(r.maxCombo < 5){
      return '🔥 พยายามเก็บของดีต่อเนื่องเพื่อเข้า Fever Mode คะแนนจะขึ้นเร็วมาก';
    }

    if(r.dailyCleared){
      return '🏆 เยี่ยมมาก! วันนี้ผ่าน Daily Challenge แล้ว ลองเล่นอีกรอบเพื่อเก็บ Badge เพิ่ม';
    }

    return '💚 ทำได้ดีมาก! ดื่มน้ำให้พอดี เลือกเครื่องดื่มที่ดี และหลีกเลี่ยงหวาน/เค็มจัด';
  }

  /* =========================================================
     Navigation / Flow
     ========================================================= */

  function restartHydrationSameChallenge(){
    if(window.__HHA_HYDRATION_NAV_LOCK__) return;
    window.__HHA_HYDRATION_NAV_LOCK__ = true;

    const u = new URL(location.href);
    u.searchParams.set('run', 'play');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('hub', getHydrationNutritionReturnUrl(HHA_HYDRATION_FLOW.ctx || getHydrationCtx()));
    location.href = u.toString();
  }

  function restartHydrationNewSeed(){
    if(window.__HHA_HYDRATION_NAV_LOCK__) return;
    window.__HHA_HYDRATION_NAV_LOCK__ = true;

    const u = new URL(location.href);
    u.searchParams.set('run', 'play');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('hub', getHydrationNutritionReturnUrl(HHA_HYDRATION_FLOW.ctx || getHydrationCtx()));
    location.href = u.toString();
  }

  function goHydrationCooldownThenHub(){
    if(window.__HHA_HYDRATION_NAV_LOCK__) return;
    window.__HHA_HYDRATION_NAV_LOCK__ = true;

    const ctx = HHA_HYDRATION_FLOW.ctx || getHydrationCtx();
    const hubBack = getHydrationNutritionReturnUrl(ctx);
    const cooldown = new URL('./warmup-gate.html', location.href);

    cooldown.searchParams.set('phase', 'cooldown');
    cooldown.searchParams.set('game', 'hydration');
    cooldown.searchParams.set('gameId', 'hydration');
    cooldown.searchParams.set('zone', 'nutrition');
    cooldown.searchParams.set('mode', ctx.view || ctx.mode || 'mobile');
    cooldown.searchParams.set('view', ctx.view || 'mobile');
    cooldown.searchParams.set('pid', ctx.pid || 'anon');
    cooldown.searchParams.set('name', ctx.name || 'Hero');
    cooldown.searchParams.set('nick', ctx.nick || ctx.name || 'Hero');
    cooldown.searchParams.set('diff', ctx.diff || 'normal');
    cooldown.searchParams.set('time', String(ctx.time || 150));
    cooldown.searchParams.set('seed', ctx.seed || String(Date.now()));

    cooldown.searchParams.set('hub', hubBack);
    cooldown.searchParams.set('next', hubBack);

    if(ctx.log) cooldown.searchParams.set('log', ctx.log);
    if(ctx.api) cooldown.searchParams.set('api', ctx.api);
    if(ctx.studyId) cooldown.searchParams.set('studyId', ctx.studyId);
    if(ctx.phase) cooldown.searchParams.set('studyPhase', ctx.phase);
    if(ctx.studyPhase) cooldown.searchParams.set('studyPhase', ctx.studyPhase);
    if(ctx.conditionGroup) cooldown.searchParams.set('conditionGroup', ctx.conditionGroup);

    location.href = cooldown.toString();
  }

  function goHydrationBackHub(){
    if(window.__HHA_HYDRATION_NAV_LOCK__) return;
    window.__HHA_HYDRATION_NAV_LOCK__ = true;

    const ctx = HHA_HYDRATION_FLOW.ctx || getHydrationCtx();
    const backUrl = getHydrationNutritionReturnUrl(ctx);

    emitHydrationEvent('back_hub', {
      score: HHA_HYDRATION_STATE ? Math.round(HHA_HYDRATION_STATE.score) : 0,
      hydration: HHA_HYDRATION_STATE ? Math.round(HHA_HYDRATION_STATE.hydration) : 0,
      forcedZone: 'nutrition',
      backUrl: backUrl
    });

    try{
      const u = new URL(backUrl, location.href);

      u.searchParams.set('zone', 'nutrition');

      [
        'pid',
        'name',
        'nick',
        'diff',
        'time',
        'view',
        'run'
      ].forEach(function(k){
        const v = ctx[k];
        if(v !== undefined && v !== null && String(v) !== ''){
          u.searchParams.set(k, String(v));
        }
      });

      location.href = u.toString();
    }catch(e){
      location.href = './nutrition-zone.html';
    }
  }

  /* =========================================================
     Logging
     ========================================================= */

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
      zone: 'nutrition',
      studyId: ctx.studyId,
      phase: ctx.phase,
      studyPhase: ctx.studyPhase,
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
        zone: 'nutrition',
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
      <span>zone: nutrition</span>
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
      <span>version: ${esc(HYD.VERSION)}</span>
      <span>zone: nutrition</span>
      <span>score: ${Math.round(S.score || 0)}</span>
      <span>hydration: ${Math.round(S.hydration || 0)}</span>
      <span>combo: ${S.combo || 0}</span>
      <span>mission: ${MS.active ? esc(MS.active.id) : '-'}</span>
      <span>boss: ${Math.round(BS.hp || 0)}</span>
      <span>${esc(extra || '')}</span>
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
/* =========================================================
   PATCH v20260513-hydration-target-safe-zone-pack3
   กันเป้าโผล่ใต้ HUD / timebar / banner บน mobile
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260513-hydration-target-safe-zone-pack3';

  function getView(){
    try{
      var u = new URL(location.href);
      return u.searchParams.get('view') || document.body.dataset.view || 'mobile';
    }catch(e){
      return document.body.dataset.view || 'mobile';
    }
  }

  function getSafeTop(){
    var view = getView();
    var w = window.innerWidth || 360;

    if(view === 'cvr') return 190;
    if(w <= 520) return 230;
    if(w <= 820) return 190;
    return 140;
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function fixTargetPosition(target){
    if(!target || target.dataset.hhaSafeZone === VERSION) return;
    target.dataset.hhaSafeZone = VERSION;

    requestAnimationFrame(function(){
      try{
        var playfield = document.getElementById('hha-hydration-playfield');
        if(!playfield || !target.isConnected) return;

        var pf = playfield.getBoundingClientRect();
        var tw = target.offsetWidth || 70;
        var th = target.offsetHeight || 84;

        var pad = 10;
        var safeTop = getSafeTop();
        var maxLeft = Math.max(pad, pf.width - tw - pad);
        var maxTop = Math.max(safeTop + 20, pf.height - th - 28);

        var left = parseFloat(target.style.left || '0');
        var top = parseFloat(target.style.top || '0');

        if(!Number.isFinite(left)) left = pad + Math.random() * (maxLeft - pad);
        if(!Number.isFinite(top)) top = safeTop + Math.random() * (maxTop - safeTop);

        left = clamp(left, pad, maxLeft);

        if(top < safeTop || top > maxTop){
          top = safeTop + Math.random() * Math.max(20, maxTop - safeTop);
        }

        target.style.left = Math.round(left) + 'px';
        target.style.top = Math.round(top) + 'px';
      }catch(e){}
    });
  }

  function observeTargets(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    playfield.querySelectorAll('.hha-hydration-target').forEach(fixTargetPosition);

    var mo = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if(!node || node.nodeType !== 1) return;

          if(node.classList && node.classList.contains('hha-hydration-target')){
            fixTargetPosition(node);
          }

          if(node.querySelectorAll){
            node.querySelectorAll('.hha-hydration-target').forEach(fixTargetPosition);
          }
        });
      });
    });

    mo.observe(playfield, { childList:true, subtree:true });

    window.addEventListener('resize', function(){
      playfield.querySelectorAll('.hha-hydration-target').forEach(function(t){
        t.dataset.hhaSafeZone = '';
        fixTargetPosition(t);
      });
    }, { passive:true });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', observeTargets, { once:true });
  }else{
    observeTargets();
  }
})();
/* =========================================================
   PATCH v20260513-hydration-safe-spawn-pack5
   กันเป้าเกิดชน HUD / timebar / banner โดยเฉพาะ mobile
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260513-hydration-safe-spawn-pack5';

  function getView(){
    try{
      var u = new URL(location.href);
      return u.searchParams.get('view') || document.body.dataset.view || 'mobile';
    }catch(e){
      return document.body.dataset.view || 'mobile';
    }
  }

  function safeTopPx(){
    var view = getView();
    var w = window.innerWidth || 390;
    var h = window.innerHeight || 800;

    if(view === 'cvr') return 190;

    /* mobile แนวตั้งแบบในภาพ */
    if(w <= 520 && h >= 760) return 245;
    if(w <= 520) return 225;

    /* tablet */
    if(w <= 820) return 185;

    /* pc */
    return 135;
  }

  function safeBottomPad(){
    var w = window.innerWidth || 390;
    if(w <= 520) return 84;
    return 48;
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function repositionTarget(target){
    if(!target || !target.isConnected) return;
    if(target.dataset.hhaSafeSpawn === PATCH) return;
    target.dataset.hhaSafeSpawn = PATCH;

    requestAnimationFrame(function(){
      try{
        var playfield = document.getElementById('hha-hydration-playfield');
        if(!playfield || !target.isConnected) return;

        var rect = playfield.getBoundingClientRect();

        var tw = target.offsetWidth || 68;
        var th = target.offsetHeight || 82;

        var padX = 12;
        var topMin = safeTopPx();
        var topMax = Math.max(topMin + 20, rect.height - th - safeBottomPad());

        var leftMin = padX;
        var leftMax = Math.max(leftMin, rect.width - tw - padX);

        var left = parseFloat(target.style.left || '0');
        var top = parseFloat(target.style.top || '0');

        if(!Number.isFinite(left)){
          left = leftMin + Math.random() * Math.max(1, leftMax - leftMin);
        }

        if(!Number.isFinite(top) || top < topMin || top > topMax){
          top = topMin + Math.random() * Math.max(1, topMax - topMin);
        }

        target.style.left = Math.round(clamp(left, leftMin, leftMax)) + 'px';
        target.style.top = Math.round(clamp(top, topMin, topMax)) + 'px';
      }catch(e){}
    });
  }

  function bootSafeSpawn(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    playfield.querySelectorAll('.hha-hydration-target').forEach(repositionTarget);

    var mo = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if(!node || node.nodeType !== 1) return;

          if(node.classList && node.classList.contains('hha-hydration-target')){
            repositionTarget(node);
          }

          if(node.querySelectorAll){
            node.querySelectorAll('.hha-hydration-target').forEach(repositionTarget);
          }
        });
      });
    });

    mo.observe(playfield, {
      childList:true,
      subtree:true
    });

    window.addEventListener('resize', function(){
      playfield.querySelectorAll('.hha-hydration-target').forEach(function(t){
        t.dataset.hhaSafeSpawn = '';
        repositionTarget(t);
      });
    }, { passive:true });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootSafeSpawn, { once:true });
  }else{
    bootSafeSpawn();
  }
})();
/* =========================================================
   PATCH v20260513-hydration-target-spacing-pack6
   กันเป้าซ้อนกัน / กระจายเป้าให้เล่นสนุกขึ้น
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260513-hydration-target-spacing-pack6';

  function getView(){
    try{
      var u = new URL(location.href);
      return u.searchParams.get('view') || document.body.dataset.view || 'mobile';
    }catch(e){
      return document.body.dataset.view || 'mobile';
    }
  }

  function safeTopPx(){
    var view = getView();
    var w = window.innerWidth || 390;
    var h = window.innerHeight || 800;

    if(view === 'cvr') return 190;
    if(w <= 520 && h >= 760) return 245;
    if(w <= 520) return 225;
    if(w <= 820) return 185;
    return 135;
  }

  function safeBottomPad(){
    var w = window.innerWidth || 390;
    if(w <= 520) return 84;
    return 48;
  }

  function minDistance(){
    var view = getView();
    var w = window.innerWidth || 390;

    if(view === 'cvr') return 96;
    if(w <= 520) return 82;
    if(w <= 820) return 90;
    return 88;
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function getCenter(el){
    var left = parseFloat(el.style.left || '0');
    var top = parseFloat(el.style.top || '0');
    var w = el.offsetWidth || 68;
    var h = el.offsetHeight || 82;

    return {
      x:left + w / 2,
      y:top + h / 2
    };
  }

  function tooClose(a, b, dist){
    var ca = getCenter(a);
    var cb = getCenter(b);
    var dx = ca.x - cb.x;
    var dy = ca.y - cb.y;
    return Math.sqrt(dx * dx + dy * dy) < dist;
  }

  function randomPlace(target, playfield){
    var rect = playfield.getBoundingClientRect();
    var tw = target.offsetWidth || 68;
    var th = target.offsetHeight || 82;

    var padX = 12;
    var topMin = safeTopPx();
    var topMax = Math.max(topMin + 20, rect.height - th - safeBottomPad());

    var leftMin = padX;
    var leftMax = Math.max(leftMin, rect.width - tw - padX);

    return {
      left: leftMin + Math.random() * Math.max(1, leftMax - leftMin),
      top: topMin + Math.random() * Math.max(1, topMax - topMin)
    };
  }

  function repositionIfOverlap(target){
    if(!target || !target.isConnected) return;

    requestAnimationFrame(function(){
      try{
        var playfield = document.getElementById('hha-hydration-playfield');
        if(!playfield || !target.isConnected) return;

        var all = Array.from(playfield.querySelectorAll('.hha-hydration-target'))
          .filter(function(t){
            return t !== target && t.isConnected;
          });

        if(!all.length) return;

        var dist = minDistance();
        var overlaps = all.some(function(other){
          return tooClose(target, other, dist);
        });

        if(!overlaps) return;

        var tries = 0;
        var ok = false;
        var pos;

        while(tries < 12 && !ok){
          tries++;
          pos = randomPlace(target, playfield);

          target.style.left = Math.round(pos.left) + 'px';
          target.style.top = Math.round(pos.top) + 'px';

          ok = !all.some(function(other){
            return tooClose(target, other, dist);
          });
        }

        target.dataset.hhaSpacingPack = PATCH;
      }catch(e){}
    });
  }

  function bootSpacing(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    playfield.querySelectorAll('.hha-hydration-target').forEach(repositionIfOverlap);

    var mo = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if(!node || node.nodeType !== 1) return;

          if(node.classList && node.classList.contains('hha-hydration-target')){
            repositionIfOverlap(node);
          }

          if(node.querySelectorAll){
            node.querySelectorAll('.hha-hydration-target').forEach(repositionIfOverlap);
          }
        });
      });
    });

    mo.observe(playfield, {
      childList:true,
      subtree:true
    });

    window.addEventListener('resize', function(){
      playfield.querySelectorAll('.hha-hydration-target').forEach(repositionIfOverlap);
    }, { passive:true });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bootSpacing, { once:true });
  }else{
    bootSpacing();
  }
})();
/* =========================================================
   PATCH v20260513-hydration-gameplay-rush-pack7
   Rush visual controller: end-game pressure without touching scoring core
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260513-hydration-gameplay-rush-pack7';
  var lastMode = '';
  var toastTimer = 0;

  function q(sel){
    try{ return document.querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel){
    try{ return Array.from(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function parseSecondsFromText(text){
    text = String(text || '');
    var nums = text.match(/\d+/g);
    if(!nums || !nums.length) return null;

    /* ปกติ timebar จะมีเลขวินาทีเด่นสุด เลือกเลขท้ายสุดเพื่อความปลอดภัย */
    var n = Number(nums[nums.length - 1]);
    if(!Number.isFinite(n)) return null;
    return n;
  }

  function getRemainingSeconds(){
    var candidates = [
      '.hha-timebar span',
      '.hha-hud-pill.time b',
      '.hha-hud-pill.timer b',
      '[data-hha-time]',
      '[data-time-left]'
    ];

    for(var i=0; i<candidates.length; i++){
      var el = q(candidates[i]);
      if(!el) continue;

      var n = parseSecondsFromText(el.textContent || el.getAttribute('data-time-left') || '');
      if(n !== null) return n;
    }

    /* fallback: หา pill ที่มีคำว่า time/เวลา */
    var pills = qa('.hha-hud-pill');
    for(var j=0; j<pills.length; j++){
      var t = pills[j].textContent || '';
      if(/time|เวลา|วิ|sec/i.test(t)){
        var m = parseSecondsFromText(t);
        if(m !== null) return m;
      }
    }

    return null;
  }

  function ensureToast(){
    var el = document.getElementById('hha-rush-toast');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'hha-rush-toast';
    el.className = 'hha-rush-toast';
    el.textContent = '⚡ Rush!';
    document.body.appendChild(el);
    return el;
  }

  function showToast(text){
    var el = ensureToast();
    el.textContent = text;
    el.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      el.classList.remove('show');
    }, 1100);
  }

  function setMode(mode, seconds){
    if(mode === lastMode) return;
    lastMode = mode;

    document.body.classList.remove(
      'hha-hydration-rush',
      'hha-hydration-last10'
    );

    if(mode === 'rush'){
      document.body.classList.add('hha-hydration-rush');
      showToast('⚡ Rush Mode! รีบเติมน้ำให้ทัน');
    }

    if(mode === 'last10'){
      document.body.classList.add('hha-hydration-rush');
      document.body.classList.add('hha-hydration-last10');
      showToast('🔥 เหลือ ' + seconds + ' วิ! ระวังของหวาน');
    }

    if(mode === 'normal'){
      var toast = document.getElementById('hha-rush-toast');
      if(toast) toast.classList.remove('show');
    }
  }

  function tick(){
    try{
      var sec = getRemainingSeconds();

      if(sec === null){
        requestAnimationFrame(tick);
        return;
      }

      if(sec <= 10){
        setMode('last10', sec);
      }else if(sec <= 25){
        setMode('rush', sec);
      }else{
        setMode('normal', sec);
      }
    }catch(e){}

    requestAnimationFrame(tick);
  }

  function markTargets(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    var mo = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if(!node || node.nodeType !== 1) return;

          if(node.classList && node.classList.contains('hha-hydration-target')){
            node.dataset.hhaRushPack = PATCH;
          }

          if(node.querySelectorAll){
            node.querySelectorAll('.hha-hydration-target').forEach(function(t){
              t.dataset.hhaRushPack = PATCH;
            });
          }
        });
      });
    });

    mo.observe(playfield, { childList:true, subtree:true });
  }

  function boot(){
    markTargets();
    tick();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
/* =========================================================
   PATCH v20260513-hydration-boss-fever-pack8
   Detect Fever / Boss state from DOM and add visual class
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260513-hydration-boss-fever-pack8';
  var lastBoss = false;
  var lastFever = false;
  var bossToastTimer = 0;
  var feverToastTimer = 0;

  function qa(sel){
    try{ return Array.from(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function textOfPage(){
    try{
      return document.body ? String(document.body.textContent || '') : '';
    }catch(e){
      return '';
    }
  }

  function ensureToast(id, cls, text){
    var el = document.getElementById(id);
    if(el) return el;

    el = document.createElement('div');
    el.id = id;
    el.className = cls;
    el.textContent = text || '';
    document.body.appendChild(el);
    return el;
  }

  function showBossToast(text){
    var el = ensureToast('hha-boss-toast', 'hha-boss-toast', text);
    el.textContent = text || '🌞 Heat Boss! รีบเติมน้ำ';
    el.classList.add('show');

    clearTimeout(bossToastTimer);
    bossToastTimer = setTimeout(function(){
      el.classList.remove('show');
    }, 1200);
  }

  function showFeverToast(text){
    var el = ensureToast('hha-fever-toast', 'hha-fever-toast', text);
    el.textContent = text || '💧 Fever! เก็บน้ำให้ต่อเนื่อง';
    el.classList.add('show');

    clearTimeout(feverToastTimer);
    feverToastTimer = setTimeout(function(){
      el.classList.remove('show');
    }, 1100);
  }

  function hasBossSignal(){
    var t = textOfPage();

    if(/Heat Boss|บอสแดด|Boss|Heat Monster|แดดร้อน/i.test(t)){
      return true;
    }

    return qa('.hha-hydration-target.is-boss-wave, .hha-hydration-target.is-danger').length >= 1;
  }

  function hasFeverSignal(){
    var t = textOfPage();

    if(/Fever|FEVER|Combo Rush|Rush Mode/i.test(t)){
      return true;
    }

    if(document.body.classList.contains('hha-hydration-rush')){
      var goodTargets = qa('.hha-hydration-target.is-good').length;
      if(goodTargets >= 2) return true;
    }

    return qa('.hha-hud-pill.fever, .fever, [data-fever="1"]').length >= 1;
  }

  function applyState(){
    var boss = hasBossSignal();
    var fever = hasFeverSignal();

    if(boss !== lastBoss){
      lastBoss = boss;
      document.body.classList.toggle('hha-hydration-boss', boss);

      if(boss){
        showBossToast('🌞 Heat Boss! ระวังแดดแรง');
      }
    }

    if(fever !== lastFever){
      lastFever = fever;
      document.body.classList.toggle('hha-hydration-fever', fever);

      if(fever){
        showFeverToast('💧 Fever! เก็บน้ำต่อเนื่อง');
      }
    }
  }

  function observe(){
    applyState();

    var mo = new MutationObserver(function(){
      applyState();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','data-fever','data-wave','data-state']
    });

    setInterval(applyState, 600);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', observe, { once:true });
  }else{
    observe();
  }
})();
/* =========================================================
   PATCH v20260513-hydration-summary-cooldown-pack9
   Inject final buttons + save latest summary
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260513-hydration-summary-cooldown-pack9';

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./hydration-vr.html', location.origin); }
  }

  function getParam(k, d){
    try{ return getUrl().searchParams.get(k) || d; }
    catch(e){ return d; }
  }

  function copyCommonParams(toUrl){
    var u = getUrl();
    [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'log',
      'api',
      'studyId',
      'conditionGroup'
    ].forEach(function(k){
      var v = u.searchParams.get(k);
      if(v !== null && v !== '') toUrl.searchParams.set(k, v);
    });

    toUrl.searchParams.set('zone', 'nutrition');
    toUrl.searchParams.set('game', 'hydration');

    return toUrl;
  }

  function nutritionZoneUrl(){
    var rawHub = getParam('hub', '');

    try{
      var decoded = decodeURIComponent(rawHub || '');
      if(decoded && decoded.indexOf('nutrition-zone.html') !== -1){
        return decoded;
      }
    }catch(e){}

    var url = new URL('./nutrition-zone.html', location.href);
    copyCommonParams(url);
    url.searchParams.set('run', 'menu');
    return url.toString();
  }

  function cooldownUrl(){
    var returnUrl = nutritionZoneUrl();

    /*
      ใช้ warmup-gate.html เป็น gate กลางเหมือนเดิม
      phase=cooldown เพื่อบอกว่าเป็น cooldown หลังจบเกม
    */
    var url = new URL('./warmup-gate.html', location.href);
    copyCommonParams(url);

    url.searchParams.set('phase', 'cooldown');
    url.searchParams.set('studyPhase', 'cooldown');
    url.searchParams.set('mode', getParam('mode', getParam('view', 'mobile')));
    url.searchParams.set('next', returnUrl);
    url.searchParams.set('hub', returnUrl);

    return url.toString();
  }

  function saveLastSummary(summaryEl){
    try{
      var text = summaryEl ? String(summaryEl.textContent || '') : '';
      var data = {
        game:'hydration',
        zone:'nutrition',
        savedAt:new Date().toISOString(),
        pid:getParam('pid','anon'),
        name:getParam('name', getParam('nick','Hero')),
        diff:getParam('diff','normal'),
        time:getParam('time','150'),
        view:getParam('view','mobile'),
        text:text.slice(0, 1600),
        url:location.href
      };

      localStorage.setItem('HHA_LAST_SUMMARY_HYDRATION', JSON.stringify(data));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(data));
    }catch(e){}
  }

  function restartGame(){
    try{
      if(typeof window.restartHydrationSameChallenge === 'function'){
        window.restartHydrationSameChallenge();
        return;
      }
    }catch(e){}

    try{
      var u = getUrl();
      u.searchParams.set('run', 'play');
      u.searchParams.set('seed', String(Date.now()));
      location.href = u.toString();
    }catch(e){
      location.reload();
    }
  }

  function goCooldown(){
    try{
      if(typeof window.goHydrationCooldownThenHub === 'function'){
        window.goHydrationCooldownThenHub();
        return;
      }
    }catch(e){}

    location.href = cooldownUrl();
  }

  function goZone(){
    location.href = nutritionZoneUrl();
  }

  function findSummary(){
    var selectors = [
      '#hha-hydration-summary',
      '.hha-hydration-summary',
      '#hydration-summary',
      '.hha-summary-panel',
      '.hha-summary',
      '[data-hha-summary]'
    ];

    for(var i=0; i<selectors.length; i++){
      try{
        var el = document.querySelector(selectors[i]);
        if(el) return el;
      }catch(e){}
    }

    return null;
  }

  function injectActions(summaryEl){
    if(!summaryEl || !summaryEl.isConnected) return;
    if(summaryEl.dataset.hhaPack9 === PATCH) return;

    summaryEl.dataset.hhaPack9 = PATCH;
    saveLastSummary(summaryEl);

    var old = summaryEl.querySelector('.hha-hydration-final-actions');
    if(old) old.remove();

    var actions = document.createElement('div');
    actions.className = 'hha-hydration-final-actions';
    actions.innerHTML = [
      '<button type="button" class="hha-final-cooldown">🧘 ทำ Cooldown</button>',
      '<button type="button" class="hha-final-zone">🥗 กลับ Nutrition Zone</button>',
      '<button type="button" class="hha-final-replay">🔁 เล่นใหม่</button>'
    ].join('');

    summaryEl.appendChild(actions);

    var cooldownBtn = actions.querySelector('.hha-final-cooldown');
    var zoneBtn = actions.querySelector('.hha-final-zone');
    var replayBtn = actions.querySelector('.hha-final-replay');

    if(cooldownBtn) cooldownBtn.addEventListener('click', goCooldown);
    if(zoneBtn) zoneBtn.addEventListener('click', goZone);
    if(replayBtn) replayBtn.addEventListener('click', restartGame);
  }

  function scan(){
    var summary = findSummary();
    if(summary) injectActions(summary);
  }

  function boot(){
    scan();

    var mo = new MutationObserver(function(){
      scan();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(scan, 900);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
/* =========================================================
   PATCH v20260513-hydration-final-qa-lock-pack10
   Final QA Lock: view class / boot check / path sanity
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260513-hydration-final-qa-lock-pack10';

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./hydration-vr.html', location.origin); }
  }

  function getParam(k, d){
    try{ return getUrl().searchParams.get(k) || d; }
    catch(e){ return d; }
  }

  function q(sel){
    try{ return document.querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel){
    try{ return Array.from(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function setViewClass(){
    var view = getParam('view', 'mobile');

    document.body.dataset.view = view;
    document.body.classList.add('hha-view-' + view);

    if(getParam('debug','') === '1' || getParam('qa','') === '1'){
      document.body.dataset.debug = '1';
      document.body.classList.add('hha-debug');
    }
  }

  function nutritionZoneLooksOk(){
    var hub = getParam('hub', '');

    try{
      var decoded = decodeURIComponent(hub || '');
      if(decoded.indexOf('nutrition-zone.html') !== -1) return true;
    }catch(e){}

    return true; /* fallback เป็น ./nutrition-zone.html ใน pack9 แล้ว */
  }

  function collectStatus(){
    var hyd = window.HHA && window.HHA.Hydration;

    var hasPlayfield = !!q('#hha-hydration-playfield');
    var hasStart = !!(
      q('.hha-hydration-start') ||
      q('.hha-start') ||
      q('[data-hha-hydration-start]')
    );

    var hasHud = !!(
      q('.hha-hydration-hud') ||
      q('#hydration-hud') ||
      q('.hha-timebar')
    );

    var hasSummary = !!(
      q('#hha-hydration-summary') ||
      q('.hha-hydration-summary') ||
      q('#hydration-summary') ||
      q('.hha-summary-panel') ||
      q('.hha-summary')
    );

    var targets = qa('.hha-hydration-target').length;

    return {
      version: PATCH,
      view: getParam('view','mobile'),
      run: getParam('run','play'),
      pid: getParam('pid','anon'),
      diff: getParam('diff','normal'),
      time: getParam('time','150'),
      playfield: hasPlayfield,
      start: hasStart,
      hud: hasHud,
      summary: hasSummary,
      targets: targets,
      hydBooted: !!(hyd && hyd.booted),
      hydStarted: !!(hyd && hyd.started),
      nutritionReturn: nutritionZoneLooksOk()
    };
  }

  function ensureBadge(){
    var el = document.getElementById('hha-hydration-qa-badge');
    if(el) return el;

    el = document.createElement('div');
    el.id = 'hha-hydration-qa-badge';
    el.className = 'hha-hydration-qa-badge';
    document.body.appendChild(el);
    return el;
  }

  function renderBadge(){
    var st = collectStatus();
    var el = ensureBadge();

    el.innerHTML = [
      'Hydration QA: ' + st.version,
      'view=' + st.view + ' run=' + st.run,
      'playfield=' + (st.playfield ? 'OK' : 'NO') +
        ' hud=' + (st.hud ? 'OK' : 'NO') +
        ' start=' + (st.start ? 'OK' : 'NO'),
      'summary=' + (st.summary ? 'OK' : 'NO') +
        ' targets=' + st.targets +
        ' booted=' + (st.hydBooted ? 'OK' : 'WAIT')
    ].join('<br>');
  }

  function showBootWarn(msg){
    if(q('#hha-hydration-final-boot-warn')) return;

    /* แสดงเฉพาะตอน debug/qa หรือกรณีไม่พบ playfield จริง ๆ */
    var debug = getParam('debug','') === '1' || getParam('qa','') === '1';
    if(!debug && q('#hha-hydration-playfield')) return;

    var box = document.createElement('div');
    box.id = 'hha-hydration-final-boot-warn';
    box.className = 'hha-hydration-boot-warn';
    box.innerHTML = [
      '<div class="hha-hydration-boot-warn-card">',
      '<div style="font-size:44px">⚠️</div>',
      '<h2>Hydration QA พบจุดที่ต้องตรวจ</h2>',
      '<p>' + String(msg || 'ตรวจ hydration-vr.js / hydration-vr.css / path อีกครั้ง') + '</p>',
      '<button type="button" onclick="location.reload()">โหลดใหม่</button>',
      '</div>'
    ].join('');

    document.body.appendChild(box);
  }

  function finalBootCheck(){
    var st = collectStatus();

    if(!st.playfield){
      showBootWarn('ไม่พบ #hha-hydration-playfield ใน hydration-vr.html');
      return;
    }

    /*
      ถ้าไม่มี start ไม่มี summary และไม่มี target หลังโหลดพักหนึ่ง
      อาจหมายถึง engine ไม่ boot
    */
    if(!st.start && !st.summary && st.targets === 0 && !st.hydBooted){
      showBootWarn('โหลดหน้าได้ แต่ยังไม่พบ start screen / summary / target / HYD.booted');
    }

    document.body.classList.add('hha-hydration-boot-ok');
  }

  function boot(){
    setViewClass();
    renderBadge();

    setTimeout(finalBootCheck, 1800);
    setInterval(renderBadge, 1000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
/* =========================================================
   PATCH v20260514-hydration-summary-dedupe-pack11
   ลบ/จัดปุ่ม Summary ซ้ำ ให้เหลือชุดที่ใช้งานชัดเจน
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260514-hydration-summary-dedupe-pack11';

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function findSummary(){
    var selectors = [
      '#hha-hydration-summary',
      '.hha-hydration-summary',
      '#hydration-summary',
      '.hha-summary-panel',
      '.hha-summary',
      '[data-hha-summary]'
    ];

    for(var i=0; i<selectors.length; i++){
      var el = q(selectors[i]);
      if(el) return el;
    }

    return null;
  }

  function textHasAction(text, key){
    text = String(text || '').toLowerCase();
    key = String(key || '').toLowerCase();

    if(key === 'cooldown'){
      return text.indexOf('cooldown') !== -1 || text.indexOf('คูลดาวน์') !== -1 || text.indexOf('ทำ cooldown') !== -1;
    }

    if(key === 'zone'){
      return text.indexOf('nutrition') !== -1 || text.indexOf('zone') !== -1 || text.indexOf('กลับ') !== -1;
    }

    if(key === 'replay'){
      return text.indexOf('เล่นใหม่') !== -1 || text.indexOf('เล่นอีกครั้ง') !== -1 || text.indexOf('replay') !== -1;
    }

    return false;
  }

  function cleanupDuplicateActions(summary){
    if(!summary || !summary.isConnected) return;

    var allButtons = qa('button, a', summary);
    var hasCooldown = allButtons.some(function(b){ return textHasAction(b.textContent, 'cooldown'); });
    var hasZone = allButtons.some(function(b){ return textHasAction(b.textContent, 'zone'); });
    var hasReplay = allButtons.some(function(b){ return textHasAction(b.textContent, 'replay'); });

    var pack9 = qa('.hha-hydration-final-actions', summary);

    /*
      ถ้า Summary เดิมมีปุ่มครบแล้ว ให้ลบชุด Pack9 ที่ inject ซ้ำ
      เพื่อไม่ให้ท้ายจอมีปุ่มเขียว/ฟ้า/ขาวยักษ์ซ้ำหลายชุด
    */
    if(hasCooldown && hasZone && hasReplay && pack9.length > 0){
      pack9.forEach(function(box){
        try{ box.remove(); }catch(e){}
      });
      summary.dataset.hhaPack11 = PATCH + '-removed-duplicate';
      return;
    }

    /*
      ถ้ามี Pack9 หลายชุด ให้เหลือชุดเดียว
    */
    if(pack9.length > 1){
      pack9.slice(1).forEach(function(box){
        try{ box.remove(); }catch(e){}
      });
    }

    summary.dataset.hhaPack11 = PATCH;
  }

  function scan(){
    var summary = findSummary();
    if(summary) cleanupDuplicateActions(summary);
  }

  function boot(){
    scan();

    var mo = new MutationObserver(function(){
      scan();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(scan, 900);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
/* =========================================================
   PATCH v20260514-hydration-3view-cvr-shoot-pack13
   PC / Mobile / Cardboard cVR view lock + hha:shoot support
   Append at end of /herohealth/hydration-vr/hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260514-hydration-3view-cvr-shoot-pack13';

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./hydration-vr.html', location.origin); }
  }

  function getView(){
    try{
      var v = getUrl().searchParams.get('view') || document.body.dataset.view || 'mobile';
      return ['pc','mobile','cvr'].includes(v) ? v : 'mobile';
    }catch(e){
      return 'mobile';
    }
  }

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function setViewClass(){
    var view = getView();
    document.body.dataset.view = view;
    document.body.classList.remove('hha-view-pc','hha-view-mobile','hha-view-cvr');
    document.body.classList.add('hha-view-' + view);

    if(view === 'cvr'){
      document.body.classList.add('hha-cardboard-ready');
    }
  }

  function ensureFallbackCrosshair(){
    if(getView() !== 'cvr') return;

    var old = document.getElementById('hha-cvr-fallback-crosshair');
    if(old) return;

    var c = document.createElement('div');
    c.id = 'hha-cvr-fallback-crosshair';
    c.className = 'hha-cvr-fallback-crosshair';
    c.innerHTML = '<i></i>';
    document.body.appendChild(c);
  }

  function centerPoint(){
    return {
      x: Math.round((window.innerWidth || document.documentElement.clientWidth || 0) / 2),
      y: Math.round((window.innerHeight || document.documentElement.clientHeight || 0) / 2)
    };
  }

  function rectCenterDistance(rect, x, y){
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var dx = cx - x;
    var dy = cy - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findTargetAtCenter(){
    var p = centerPoint();
    var targets = qa('.hha-hydration-target')
      .filter(function(t){
        if(!t || !t.isConnected) return false;
        var r = t.getBoundingClientRect();
        if(r.width <= 0 || r.height <= 0) return false;

        /*
          cVR aim assist:
          เล็งใกล้เป้าก็ยิงได้ เพื่อไม่ให้เด็กต้องเล็งเป๊ะเกินไป
        */
        var pad = 28;
        var inside =
          p.x >= r.left - pad &&
          p.x <= r.right + pad &&
          p.y >= r.top - pad &&
          p.y <= r.bottom + pad;

        return inside;
      })
      .sort(function(a,b){
        return rectCenterDistance(a.getBoundingClientRect(), p.x, p.y) -
               rectCenterDistance(b.getBoundingClientRect(), p.x, p.y);
      });

    return targets[0] || null;
  }

  function fireClick(target){
    if(!target) return false;

    try{
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        pointerType:'mouse'
      }));
    }catch(e){}

    try{
      target.dispatchEvent(new MouseEvent('mousedown', {
        bubbles:true,
        cancelable:true
      }));
    }catch(e){}

    try{
      target.click();
      return true;
    }catch(e){
      try{
        target.dispatchEvent(new MouseEvent('click', {
          bubbles:true,
          cancelable:true
        }));
        return true;
      }catch(_){}
    }

    return false;
  }

  function shootCenter(){
    if(getView() !== 'cvr') return false;

    var target = findTargetAtCenter();

    if(target){
      target.dataset.hhaCvrShot = PATCH;
      return fireClick(target);
    }

    return false;
  }

  function onHhaShoot(ev){
    try{
      if(getView() !== 'cvr') return;

      var ok = shootCenter();

      if(!ok && ev && ev.detail && ev.detail.target){
        fireClick(ev.detail.target);
      }
    }catch(e){}
  }

  function bindTapFallback(){
    /*
      ใช้เฉพาะ cVR: แตะจอ = ยิงจาก crosshair กลางจอ
      ไม่ใช้ elementFromPoint เพราะเป้าบางครั้ง animate/transform
    */
    document.addEventListener('click', function(ev){
      if(getView() !== 'cvr') return;

      var t = ev.target;
      if(t && t.closest && t.closest('button, a, input, select, textarea, .hha-control-btn')){
        return;
      }

      var ok = shootCenter();
      if(ok){
        ev.preventDefault();
        ev.stopPropagation();
      }
    }, true);

    document.addEventListener('touchend', function(ev){
      if(getView() !== 'cvr') return;

      var t = ev.target;
      if(t && t.closest && t.closest('button, a, input, select, textarea, .hha-control-btn')){
        return;
      }

      shootCenter();
    }, { passive:true, capture:true });
  }

  function markCvrTargets(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    qa('.hha-hydration-target', playfield).forEach(function(t){
      t.dataset.hhaViewReady = PATCH;
    });

    var mo = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if(!node || node.nodeType !== 1) return;

          if(node.classList && node.classList.contains('hha-hydration-target')){
            node.dataset.hhaViewReady = PATCH;
          }

          if(node.querySelectorAll){
            node.querySelectorAll('.hha-hydration-target').forEach(function(t){
              t.dataset.hhaViewReady = PATCH;
            });
          }
        });
      });
    });

    mo.observe(playfield, { childList:true, subtree:true });
  }

  function boot(){
    setViewClass();
    ensureFallbackCrosshair();
    bindTapFallback();
    markCvrTargets();

    window.addEventListener('hha:shoot', onHhaShoot);
    document.addEventListener('hha:shoot', onHhaShoot);

    window.HHA = window.HHA || {};
    window.HHA.HydrationViewLock = {
      version: PATCH,
      view: getView,
      shootCenter: shootCenter
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
