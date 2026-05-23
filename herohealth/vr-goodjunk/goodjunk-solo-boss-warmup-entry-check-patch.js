(function GoodJunkSoloBossWarmupEntryCheckPatch(){
  'use strict';

  const PATCH_VERSION = 'v8.47.4-solo-boss-warmup-entry-check';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  /*
   * ใช้เฉพาะ Solo / Solo Boss
   * ไม่ยุ่ง Battle / Race / Duet / Coop / Lobby
   */
  const blocked =
    /battle|race|duet|coop|lobby/i.test(path) ||
    /battle|race|duet|coop/i.test(params.get('mode') || '');

  if (blocked) return;

  const phase = String(params.get('phase') || '').toLowerCase();

  /*
   * ถ้าอยู่ cooldown หรือกำลังอยู่ gate ไม่ต้อง redirect
   */
  if (phase === 'cooldown' || /warmup-gate/i.test(path)){
    return;
  }

  function now(){
    return Date.now();
  }

  function pad(n){
    return String(n).padStart(2, '0');
  }

  function todayKey(){
    const d = new Date();
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate())
    );
  }

  function normalizeView(v){
    v = String(v || '').toLowerCase().trim();

    if (v === 'cvr' || v === 'vr' || v === 'cardboard-vr') return 'cardboard';
    if (v === 'cardboard') return 'cardboard';
    if (v === 'mobile' || v === 'phone' || v === 'touch') return 'mobile';
    if (v === 'pc' || v === 'desktop') return 'pc';

    const mobile =
      (window.matchMedia && window.matchMedia('(max-width:760px)').matches) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    return mobile ? 'mobile' : 'pc';
  }

  function getPid(){
    return (
      params.get('pid') ||
      localStorage.getItem('GJ_BATTLE_PID') ||
      localStorage.getItem('HHA_GJ_PID') ||
      'anon'
    );
  }

  function getName(){
    return (
      params.get('name') ||
      localStorage.getItem('GJ_BATTLE_NAME') ||
      localStorage.getItem('HHA_GJ_NAME') ||
      'Hero'
    );
  }

  function getMode(){
    return params.get('mode') || 'solo-boss';
  }

  function getGame(){
    return params.get('game') || params.get('gameId') || 'goodjunk';
  }

  function storageKeys(){
    const pid = getPid();
    const game = getGame();
    const mode = getMode();
    const day = todayKey();

    return [
      /*
       * HHA standard gate keys
       */
      'HHA_GATE_WARMUP_' + pid + '_' + game + '_' + mode + '_' + day,
      'HHA_GATE_warmup_' + pid + '_' + game + '_' + mode + '_' + day,

      /*
       * GoodJunk solo local fallback
       */
      'GJ_SOLO_BOSS_WARMUP_DONE_' + pid + '_' + day,
      'GJ_SOLO_BOSS_WARMUP_DONE_' + pid + '_' + game + '_' + mode + '_' + day
    ];
  }

  function hasStoredDone(){
    const keys = storageKeys();

    for (const key of keys){
      try{
        const v1 = localStorage.getItem(key);
        const v2 = sessionStorage.getItem(key);

        if (v1 && v1 !== '0' && v1 !== 'false') return true;
        if (v2 && v2 !== '0' && v2 !== 'false') return true;
      }catch(_){}
    }

    return false;
  }

  function markWarmupDone(source){
    const keys = storageKeys();

    keys.forEach(function(key){
      try{
        localStorage.setItem(key, '1');
        sessionStorage.setItem(key, '1');
      }catch(_){}
    });

    try{
      sessionStorage.setItem('GJ_SOLO_BOSS_WARMUP_LAST_SOURCE', source || PATCH_VERSION);
    }catch(_){}
  }

  function cameBackFromWarmup(){
    return (
      params.get('warmupOk') === '1' ||
      params.get('warmupDone') === '1' ||
      params.get('fromWarmup') === '1' ||
      params.get('gateDone') === 'warmup'
    );
  }

  function buildLauncherUrl(){
    const out = new URL('../goodjunk-launcher.html', location.href);

    [
      'pid','name','diff','time','view','device','hub',
      'studyId','conditionGroup','api','log'
    ].forEach(function(k){
      let v = params.get(k);

      if (k === 'pid') v = getPid();
      if (k === 'name') v = getName();
      if (k === 'view' || k === 'device'){
        v = normalizeView(params.get('view') || params.get('device') || '');
      }

      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('from', 'solo-boss-warmup-check');

    return out.toString();
  }

  function buildNutritionZoneUrl(){
    const out = new URL('../nutrition-zone.html', location.href);

    [
      'pid','name','diff','time','view','device','hub',
      'studyId','conditionGroup','api','log'
    ].forEach(function(k){
      let v = params.get(k);

      if (k === 'pid') v = getPid();
      if (k === 'name') v = getName();
      if (k === 'view' || k === 'device'){
        v = normalizeView(params.get('view') || params.get('device') || '');
      }

      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('from', 'goodjunk-solo-boss');

    return out.toString();
  }

  function buildReturnUrl(){
    const next = new URL(location.href);

    next.searchParams.set('pid', getPid());
    next.searchParams.set('name', getName());
    next.searchParams.set('view', normalizeView(params.get('view') || params.get('device') || ''));
    next.searchParams.set('device', normalizeView(params.get('view') || params.get('device') || ''));

    next.searchParams.set('zone', 'nutrition');
    next.searchParams.set('game', 'goodjunk');
    next.searchParams.set('gameId', 'goodjunk');
    next.searchParams.set('mode', getMode());

    next.searchParams.set('run', 'play');
    next.searchParams.set('phase', 'play');

    /*
     * ตัวนี้สำคัญ: กลับจาก warmup แล้วไม่ redirect ซ้ำ
     */
    next.searchParams.set('warmupOk', '1');
    next.searchParams.set('warmupChecked', PATCH_VERSION);
    next.searchParams.set('t', String(now()));

    return next.toString();
  }

  function buildWarmupGateUrl(){
    const gate = new URL('../warmup-gate.html', location.href);

    [
      'pid','name','diff','time','view','device',
      'studyId','conditionGroup','api','log'
    ].forEach(function(k){
      let v = params.get(k);

      if (k === 'pid') v = getPid();
      if (k === 'name') v = getName();
      if (k === 'view' || k === 'device'){
        v = normalizeView(params.get('view') || params.get('device') || '');
      }

      if (v !== null && v !== ''){
        gate.searchParams.set(k, v);
      }
    });

    gate.searchParams.set('phase', 'warmup');
    gate.searchParams.set('gate', 'warmup');
    gate.searchParams.set('game', 'goodjunk');
    gate.searchParams.set('gameId', 'goodjunk');
    gate.searchParams.set('mode', getMode());
    gate.searchParams.set('zone', 'nutrition');

    /*
     * Warmup เสร็จกลับเข้า Solo Boss เดิม
     */
    gate.searchParams.set('next', buildReturnUrl());

    /*
     * ถ้ากด back ออกจาก gate ให้กลับ launcher
     */
    gate.searchParams.set('back', buildLauncherUrl());

    /*
     * hub ให้คงของเดิม ถ้าไม่มี ใช้ Nutrition Zone
     */
    gate.searchParams.set('hub', params.get('hub') || buildNutritionZoneUrl());

    gate.searchParams.set('once', 'day');
    gate.searchParams.set('source', PATCH_VERSION);

    return gate.toString();
  }

  function shouldSkipWarmup(){
    /*
     * ใช้สำหรับ debug เท่านั้น
     */
    return (
      params.get('skipWarmup') === '1' ||
      params.get('warmup') === 'skip'
    );
  }

  function showRedirectNote(){
    try{
      document.documentElement.classList.add('gj-solo-warmup-redirecting');

      const style = document.createElement('style');
      style.textContent = `
        html.gj-solo-warmup-redirecting body::before{
          content:'';
          position:fixed;
          inset:0;
          z-index:100000;
          background:rgba(40,28,18,.24);
          backdrop-filter:blur(5px);
        }

        html.gj-solo-warmup-redirecting body::after{
          content:'อบอุ่นร่างกายก่อนเริ่ม GoodJunk Solo Boss...';
          position:fixed;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          z-index:100001;
          width:min(92vw,440px);
          padding:18px 20px;
          border-radius:28px;
          border:4px solid rgba(255,199,125,.95);
          background:rgba(255,254,248,.97);
          color:#753119;
          font:1000 20px system-ui,sans-serif;
          text-align:center;
          box-shadow:0 22px 50px rgba(70,34,10,.24);
        }
      `;
      document.head.appendChild(style);
    }catch(_){}
  }

  function redirectToWarmup(){
    const target = buildWarmupGateUrl();

    try{
      sessionStorage.setItem('GJ_SOLO_BOSS_WARMUP_REDIRECT_TARGET', target);
    }catch(_){}

    showRedirectNote();

    console.info('[GoodJunk Solo Boss Warmup Check] redirect to warmup', {
      version: PATCH_VERSION,
      target
    });

    setTimeout(function(){
      location.replace(target);
    }, 120);
  }

  function boot(){
    window.GJ_SOLO_BOSS_WARMUP_ENTRY_CHECK = {
      version: PATCH_VERSION,
      storageKeys,
      hasStoredDone,
      markWarmupDone,
      buildWarmupGateUrl,
      buildReturnUrl
    };

    if (shouldSkipWarmup()){
      console.info('[GoodJunk Solo Boss Warmup Check] skipped by query');
      return;
    }

    if (cameBackFromWarmup()){
      markWarmupDone('returned-from-warmup');
      console.info('[GoodJunk Solo Boss Warmup Check] warmup marked done');
      return;
    }

    if (hasStoredDone()){
      console.info('[GoodJunk Solo Boss Warmup Check] warmup already done today');
      return;
    }

    redirectToWarmup();
  }

  /*
   * ให้ redirect เร็วที่สุดก่อน game runtime เริ่ม
   */
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();