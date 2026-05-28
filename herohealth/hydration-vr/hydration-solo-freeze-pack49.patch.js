/* =========================================================
   HeroHealth Hydration Solo Cooldown / Summary QA Freeze Patch
   File: /herohealth/hydration-vr/hydration-solo-freeze-pack49.patch.js
   Version: v20260528-pack49-cooldown-summary-qa-freeze

   Purpose:
   - Freeze the Solo end-flow after Pack41–48
   - Make Summary buttons reliable on PC/Mobile/cVR
   - Ensure Cooldown returns to Nutrition Zone, not HUB or bad nested URLs
   - Save latest summary safely for HeroHealth dashboard/zone return
   - Does NOT alter gameplay scoring/spawn/balance
   - Does NOT depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260528-pack49-cooldown-summary-qa-freeze';

  if(window.HHA_HYDRATION_SOLO_FREEZE_PACK49){
    console.warn('[Hydration Solo Freeze Pack49] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_FREEZE_PACK49 = true;

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function safeText(el){
    return String((el && el.textContent) || '').replace(/\s+/g,' ').trim();
  }

  function ctx(){
    return window.HHA_HYDRATION_RUN_CONTEXT || {};
  }

  function heroBase(){
    try{
      var marker = '/herohealth/';
      var idx = location.pathname.indexOf(marker);
      if(idx >= 0){
        return location.origin + location.pathname.slice(0, idx + marker.length);
      }
      return new URL('../', location.href).toString();
    }catch(e){
      return 'https://supparang.github.io/webxr-health-mobile/herohealth/';
    }
  }

  function getParam(k, fallback){
    try{
      var u = new URL(location.href);
      var v = u.searchParams.get(k);
      return v == null || v === '' ? fallback : v;
    }catch(e){
      return fallback;
    }
  }

  function cleanName(v){
    return String(v || '').trim() || 'Hero';
  }

  function mode(){ return String(ctx().mode || getParam('mode','solo') || 'solo').toLowerCase(); }
  function view(){ return String(ctx().view || getParam('view','mobile') || 'mobile').toLowerCase(); }
  function diff(){ return String(ctx().diff || getParam('diff','normal') || 'normal').toLowerCase(); }
  function time(){ return String(ctx().time || getParam('time','150') || '150'); }
  function pid(){ return String(ctx().pid || getParam('pid','anon') || 'anon'); }
  function name(){ return cleanName(ctx().name || getParam('name', getParam('nick','Hero'))); }
  function nick(){ return cleanName(ctx().nick || getParam('nick', getParam('name','Hero'))); }

  function nutritionZoneUrl(){
    try{
      if(typeof window.HHA_HYDRATION_BUILD_NUTRITION_ZONE_URL === 'function'){
        var fromRun = window.HHA_HYDRATION_BUILD_NUTRITION_ZONE_URL();
        if(fromRun && !isBadUrl(fromRun)) return fromRun;
      }
    }catch(e){}

    var base = heroBase();
    var url = new URL('nutrition-zone.html', base);
    url.searchParams.set('pid', pid());
    url.searchParams.set('name', name());
    url.searchParams.set('nick', nick());
    url.searchParams.set('diff', diff());
    url.searchParams.set('time', time());
    url.searchParams.set('view', view());
    url.searchParams.set('hub', new URL('hub.html', base).toString());

    ['log','api','studyId','conditionGroup'].forEach(function(k){
      var v = getParam(k, '');
      if(v) url.searchParams.set(k, v);
    });

    return url.toString();
  }

  function isBadUrl(raw){
    var s = '';
    try{ s = decodeURIComponent(String(raw || '')).toLowerCase(); }
    catch(e){ s = String(raw || '').toLowerCase(); }

    return !s ||
      s.indexOf('warmup-gate.html') >= 0 ||
      s.indexOf('phase=cooldown') >= 0 ||
      s.indexOf('gatephase=cooldown') >= 0 ||
      s.indexOf('hydration-vr/run.html') >= 0 ||
      s.indexOf('hydration-vr/lobby.html') >= 0 ||
      s.indexOf('lobby.html') >= 0;
  }

  function runUrl(opts){
    opts = opts || {};
    var base = new URL('./run.html', location.href);
    base.searchParams.set('pid', pid());
    base.searchParams.set('name', name());
    base.searchParams.set('nick', nick());
    base.searchParams.set('zone', 'nutrition');
    base.searchParams.set('game', 'hydration');
    base.searchParams.set('mode', 'solo');
    base.searchParams.set('view', opts.view || view());
    base.searchParams.set('diff', opts.diff || diff());
    base.searchParams.set('time', opts.time || time());
    base.searchParams.set('hub', nutritionZoneUrl());
    base.searchParams.set('run', 'play');
    base.searchParams.set('seed', String(opts.seed || Date.now()));
    base.searchParams.set('cacheBust', opts.cacheBust || ('pack49-replay-' + Date.now()));
    return base.toString();
  }

  function cooldownUrl(){
    var base = heroBase();
    var gate = new URL('warmup-gate.html', base);
    var nz = nutritionZoneUrl();

    gate.searchParams.set('phase', 'cooldown');
    gate.searchParams.set('gatePhase', 'cooldown');
    gate.searchParams.set('game', 'hydration');
    gate.searchParams.set('gameId', 'hydration');
    gate.searchParams.set('zone', 'nutrition');
    gate.searchParams.set('cat', 'nutrition');
    gate.searchParams.set('mode', 'solo');
    gate.searchParams.set('view', view());
    gate.searchParams.set('pid', pid());
    gate.searchParams.set('name', name());
    gate.searchParams.set('nick', nick());
    gate.searchParams.set('diff', diff());
    gate.searchParams.set('time', time());
    gate.searchParams.set('seed', String(Date.now()));
    gate.searchParams.set('fromLauncher', 'hydration-launcher');
    gate.searchParams.set('run', 'play');

    /* สำคัญ: hub/next/cdnext ทุกตัวชี้กลับ Nutrition Zone */
    gate.searchParams.set('hub', nz);
    gate.searchParams.set('next', nz);
    gate.searchParams.set('cdnext', nz);
    gate.searchParams.set('return', nz);
    gate.searchParams.set('returnTo', nz);
    gate.searchParams.set('after', nz);
    gate.searchParams.set('hubRoot', new URL('hub.html', base).toString());

    ['log','api','studyId','conditionGroup'].forEach(function(k){
      var v = getParam(k, '');
      if(v) gate.searchParams.set(k, v);
    });

    return gate.toString();
  }

  function challengeUrl(){
    var nextDiff = diff() === 'challenge' ? 'challenge' : 'challenge';
    return runUrl({ diff: nextDiff, seed: Date.now(), cacheBust:'pack49-challenge-' + Date.now() });
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-freeze-pack49-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-freeze-pack49-css';
    style.textContent = `
      .hha-freeze49-banner{
        margin:10px 0 0;
        padding:10px 12px;
        border-radius:20px;
        background:linear-gradient(180deg,#f4fdff,#ffffff);
        border:2px solid #d7f3ff;
        color:#42677d;
        font-size:13px;
        font-weight:950;
        text-align:center;
        line-height:1.32;
      }

      .hha-freeze49-actions{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
        margin:12px 0 0;
      }

      .hha-freeze49-actions a,
      .hha-freeze49-actions button{
        min-height:54px;
        border:0;
        border-radius:20px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:12px 14px;
        text-decoration:none;
        font-weight:1000;
        font-size:15px;
        cursor:pointer;
        touch-action:manipulation;
      }

      .hha-freeze49-primary{
        color:white;
        background:linear-gradient(180deg,#43c7ff,#2388ff);
        box-shadow:0 14px 30px rgba(35,136,255,.20);
      }

      .hha-freeze49-green{
        color:white;
        background:linear-gradient(180deg,#62e68f,#31c968);
        box-shadow:0 14px 30px rgba(49,201,104,.18);
      }

      .hha-freeze49-soft{
        color:#22749e;
        background:#f2fbff;
        border:2px solid #d7f3ff !important;
      }

      .hha-freeze49-white{
        color:#24445c;
        background:#ffffff;
        border:2px solid #d7f3ff !important;
      }

      .hha-freeze49-check{
        margin:10px 0 0;
        padding:9px 11px;
        border-radius:18px;
        background:#f0fff4;
        border:2px solid #b9efc5;
        color:#256b44;
        font-size:12px;
        font-weight:950;
        line-height:1.32;
        text-align:center;
      }

      .hha-freeze49-toast{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        z-index:23000;
        transform:translateX(-50%) translateY(12px);
        width:min(420px,86vw);
        padding:10px 13px;
        border-radius:999px;
        background:rgba(255,255,255,.95);
        border:2px solid #d7f3ff;
        box-shadow:0 14px 34px rgba(30,75,115,.18);
        color:#24445c;
        text-align:center;
        font-weight:1000;
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-freeze49-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      @media (max-width:520px){
        .hha-freeze49-actions{
          gap:8px;
        }

        .hha-freeze49-actions a,
        .hha-freeze49-actions button{
          min-height:52px;
          border-radius:18px;
          font-size:13px;
          padding:10px 9px;
        }

        .hha-freeze49-banner,
        .hha-freeze49-check{
          font-size:11.5px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function showToast(text){
    var toast = q('.hha-freeze49-toast');
    if(!toast){
      toast = document.createElement('div');
      toast.className = 'hha-freeze49-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      toast.classList.remove('show');
    }, 1500);
  }

  function statValue(pattern){
    var stats = qa('.hha-solo-stat, .hha-stat, [data-hha-summary-stat]');
    for(var i=0; i<stats.length; i++){
      var text = safeText(stats[i]);
      if(pattern.test(text)){
        var b = q('b', stats[i]);
        var raw = safeText(b || stats[i]).replace(/[^0-9.-]/g,'');
        var n = Number(raw);
        if(Number.isFinite(n)) return n;
      }
    }
    return 0;
  }

  function bigScore(){
    var el = q('.hha-solo-bigscore, .hha-bigscore');
    if(!el) return 0;
    var raw = safeText(el).replace(/[^0-9.-]/g,'');
    var n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function rankText(){
    var el = q('.hha-solo-rank, .hha-rank');
    return safeText(el) || '';
  }

  function saveLatestSummary(){
    try{
      var payload = {
        game:'hydration',
        mode:'solo',
        view:view(),
        diff:diff(),
        time:time(),
        pid:pid(),
        name:name(),
        nick:nick(),
        score:bigScore(),
        rank:rankText(),
        hydration:statValue(/Hydration/i),
        combo:statValue(/Combo|คอมโบ/i),
        missions:statValue(/Mission/i),
        good:statValue(/เก็บของดี/i),
        bad:statValue(/โดนของเสีย/i),
        miss:statValue(/พลาด/i),
        bossDefeated:/ชนะ/.test(document.body.textContent || ''),
        cooldownUrl:cooldownUrl(),
        nutritionZoneUrl:nutritionZoneUrl(),
        replayUrl:runUrl({ seed:Date.now() }),
        challengeUrl:challengeUrl(),
        flowFrozen:true,
        freezeVersion:VERSION,
        savedAt:new Date().toISOString()
      };

      localStorage.setItem('HHA_LAST_SUMMARY_HYDRATION', JSON.stringify(payload));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
      localStorage.setItem('HHA_HYDRATION_SOLO_LAST_FLOW', JSON.stringify(payload));
      return payload;
    }catch(e){
      return null;
    }
  }

  function go(url, label){
    showToast(label || 'กำลังไปหน้าถัดไป...');
    setTimeout(function(){
      location.href = url;
    }, 120);
  }

  function createAction(label, cls, url, handler){
    var a = document.createElement('a');
    a.href = url || '#';
    a.className = cls;
    a.textContent = label;
    a.setAttribute('role','button');
    a.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if(handler) handler();
      else go(url, label);
    }, true);
    return a;
  }

  function findSummary(){
    return q('.hha-solo-summary, .hha-hydration-summary, #hha-hydration-summary, [data-hha-summary]');
  }

  function normalizeExistingButtons(summary){
    if(!summary) return;

    var replay = runUrl({ seed:Date.now(), cacheBust:'pack49-replay-' + Date.now() });
    var challenge = challengeUrl();
    var cd = cooldownUrl();
    var nz = nutritionZoneUrl();

    qa('a,button', summary).forEach(function(el){
      var text = safeText(el);
      var lower = text.toLowerCase();
      var target = '';
      var label = '';

      if(/เล่นอีกครั้ง|replay|again/.test(lower)){
        target = replay;
        label = 'เล่นอีกครั้ง';
      }else if(/challenge|ท้าทาย|ใหม่/.test(lower)){
        target = challenge;
        label = 'Challenge ใหม่';
      }else if(/cooldown|คูลดาวน์|ผ่อนคลาย/.test(lower)){
        target = cd;
        label = 'ทำ Cooldown';
      }else if(/nutrition|zone|กลับ/.test(lower)){
        target = nz;
        label = 'กลับ Nutrition Zone';
      }

      if(!target) return;

      if(el.tagName.toLowerCase() === 'a'){
        el.setAttribute('href', target);
      }

      el.dataset.hhaFreeze49Url = target;
      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        saveLatestSummary();
        go(target, label);
      }, true);
    });
  }

  function addFrozenActions(summary){
    if(!summary || summary.dataset.hhaFreeze49Done === '1') return;
    summary.dataset.hhaFreeze49Done = '1';

    saveLatestSummary();
    normalizeExistingButtons(summary);

    var card = q('.hha-solo-summary-card', summary) || q('.hha-summary-card', summary) || summary.firstElementChild || summary;

    var banner = document.createElement('div');
    banner.className = 'hha-freeze49-banner';
    banner.innerHTML = 'สรุปผลล็อกเส้นทางแล้ว: เล่นซ้ำ / Challenge / Cooldown / กลับ Nutrition Zone ได้ถูกต้อง';

    var actions = document.createElement('div');
    actions.className = 'hha-freeze49-actions';
    actions.appendChild(createAction('เล่นอีกครั้ง', 'hha-freeze49-primary', runUrl({ seed:Date.now() }), function(){
      saveLatestSummary();
      go(runUrl({ seed:Date.now(), cacheBust:'pack49-replay-click-' + Date.now() }), 'เล่นอีกครั้ง');
    }));
    actions.appendChild(createAction('Challenge ใหม่', 'hha-freeze49-green', challengeUrl(), function(){
      saveLatestSummary();
      go(challengeUrl(), 'Challenge ใหม่');
    }));
    actions.appendChild(createAction('ทำ Cooldown', 'hha-freeze49-soft', cooldownUrl(), function(){
      saveLatestSummary();
      go(cooldownUrl(), 'ทำ Cooldown');
    }));
    actions.appendChild(createAction('กลับ Nutrition Zone', 'hha-freeze49-white', nutritionZoneUrl(), function(){
      saveLatestSummary();
      go(nutritionZoneUrl(), 'กลับ Nutrition Zone');
    }));

    var check = document.createElement('div');
    check.className = 'hha-freeze49-check';
    check.textContent = 'QA Freeze: cooldown hub/next/cdnext → Nutrition Zone • replay seed ใหม่ • mode=solo • view=' + view();

    card.appendChild(banner);
    card.appendChild(actions);
    card.appendChild(check);

    console.info('[Hydration Solo Freeze Pack49] summary actions frozen', {
      replay:runUrl({ seed:'NEXT' }),
      cooldown:cooldownUrl(),
      zone:nutritionZoneUrl()
    });
  }

  function patchSummary(){
    var summary = findSummary();
    if(summary){
      addFrozenActions(summary);
    }
  }

  function interceptGlobalClicks(){
    document.addEventListener('click', function(ev){
      var summary = findSummary();
      if(!summary) return;

      var el = ev.target && ev.target.closest ? ev.target.closest('a,button') : null;
      if(!el || !summary.contains(el)) return;

      var url = el.dataset && el.dataset.hhaFreeze49Url;
      if(url){
        ev.preventDefault();
        ev.stopPropagation();
        saveLatestSummary();
        go(url, safeText(el));
      }
    }, true);
  }

  function watch(){
    var mo = new MutationObserver(function(){
      try{ patchSummary(); }catch(e){}
    });

    mo.observe(document.body, { childList:true, subtree:true });

    setInterval(function(){
      try{ patchSummary(); }catch(e){}
    }, 700);
  }

  function boot(){
    injectStyle();
    interceptGlobalClicks();
    watch();
    patchSummary();

    console.info('[Hydration Solo Freeze Pack49] loaded', VERSION, {
      view:view(),
      diff:diff(),
      nutritionZone:nutritionZoneUrl()
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
