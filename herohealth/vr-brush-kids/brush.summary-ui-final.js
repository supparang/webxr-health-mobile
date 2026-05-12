/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-ui-final.js
 * PATCH v20260512-P37-BRUSH-KIDS-SUMMARY-UI-FINAL
 *
 * Purpose:
 * - Final cleanup for Summary screen
 * - Hide emergency/floating start button on summary
 * - Fix bottom actions: Replay / Cooldown / Hygiene Zone
 * - Prevent buttons from overlapping content
 * - Improve mobile responsive layout
 * - Route Replay/Cooldown/Zone correctly
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260512-P37-BRUSH-KIDS-SUMMARY-UI-FINAL';

  function log(){
    try{ console.log('[BrushSummaryUIFinal]', PATCH_ID, ...arguments); }catch(_){}
  }

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
  }

  function isSummary(){
    const t = text();
    return /ผลการแปรงฟันของฉัน|Replay Challenge|Brushing Surface Mastery|Tooth Pet Rescue|Cooldown|กลับ Hygiene Zone/i.test(t);
  }

  function baseHero(){
    try{
      const path = WIN.location.pathname || '';
      const marker = '/herohealth/';
      const idx = path.indexOf(marker);
      if(idx >= 0){
        return WIN.location.origin + path.slice(0, idx + marker.length);
      }
    }catch(_){}
    return WIN.location.origin + '/herohealth/';
  }

  function cleanUrl(raw){
    try{
      const s = String(raw || '').trim();
      if(!s) return '';
      return new URL(decodeURIComponent(s), baseHero()).toString();
    }catch(_){
      try{
        return new URL(String(raw || ''), baseHero()).toString();
      }catch(__){
        return '';
      }
    }
  }

  function ctx(){
    const p = qs();

    const out = {
      pid: param('pid', 'anon'),
      name: param('name', 'Hero'),
      diff: param('diff', 'normal'),
      time: param('time', '120'),
      view: param('view', 'mobile'),
      zone: 'hygiene',
      cat: 'hygiene',
      game: 'brush',
      gameId: 'brush',
      variant: 'kids-vr',
      mode: param('mode', 'learn'),
      entry: 'brush-kids',
      theme: 'brush',
      run: 'play',
      seed: param('seed', String(Date.now()))
    };

    [
      'studyId',
      'conditionGroup',
      'log',
      'api',
      'runMode',
      'nick'
    ].forEach(k => {
      const v = p.get(k);
      if(v !== null && v !== '') out[k] = v;
    });

    return out;
  }

  function toQuery(obj){
    const q = new URLSearchParams();
    Object.keys(obj || {}).forEach(k => {
      const v = obj[k];
      if(v === undefined || v === null || v === '') return;
      q.set(k, String(v));
    });
    return q.toString();
  }

  function hygieneZoneUrl(){
    const explicit = cleanUrl(param('hub', '')) ||
                     cleanUrl(param('back', '')) ||
                     cleanUrl(param('return', ''));

    if(explicit && /hygiene-zone\.html/i.test(explicit)){
      return explicit;
    }

    const c = ctx();
    const rootHub = cleanUrl(param('rootHub', '')) || baseHero() + 'hub.html';
    c.run = 'menu';
    c.hub = rootHub;

    return baseHero() + 'hygiene-zone.html?' + toQuery(c);
  }

  function launcherUrl(){
    const c = ctx();
    c.run = 'menu';
    c.hub = hygieneZoneUrl();

    return baseHero() + 'brush-vr-kids.html?' + toQuery(c);
  }

  function mainRunUrl(){
    const c = ctx();
    c.run = 'play';
    c.stage = 'howto';
    c.cooldown = '1';
    c.hub = hygieneZoneUrl();
    c.back = hygieneZoneUrl();
    c.return = hygieneZoneUrl();

    return baseHero() + 'vr-brush-kids/brush.html?' + toQuery(c);
  }

  function cooldownUrl(){
    const c = ctx();
    const zone = hygieneZoneUrl();

    c.run = 'cooldown';
    c.phase = 'cooldown';
    c.cooldown = '1';
    c.once = '1';
    c.next = zone;
    c.back = zone;
    c.return = zone;
    c.hub = zone;

    return baseHero() + 'warmup-gate.html?' + toQuery(c);
  }

  function go(url){
    try{ WIN.location.href = url; }
    catch(_){
      try{ WIN.location.assign(url); }catch(__){}
    }
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-brush-summary-ui-final-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-brush-summary-ui-final-style';
    style.textContent = `
      html.hha-brush-summary-final,
      body.hha-brush-summary-final{
        min-height:100%;
        overflow-x:hidden !important;
      }

      body.hha-brush-summary-final{
        padding-bottom:calc(132px + env(safe-area-inset-bottom,0px)) !important;
      }

      body.hha-brush-summary-final #hha-brush-emergency-start,
      body.hha-brush-summary-final .hha-summary-hide-on-final{
        display:none !important;
        visibility:hidden !important;
        pointer-events:none !important;
      }

      #hha-brush-summary-final-actions{
        position:fixed;
        left:50%;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        width:min(96vw,980px);
        z-index:999999;
        display:grid;
        grid-template-columns:1.15fr .95fr 1fr;
        gap:12px;
        padding:12px;
        border-radius:30px;
        background:rgba(255,255,255,.88);
        border:3px solid rgba(189,244,255,.92);
        box-shadow:0 18px 52px rgba(23,56,79,.20);
        backdrop-filter:blur(14px);
      }

      .hha-brush-summary-final-btn{
        min-height:64px;
        border:0;
        border-radius:24px;
        padding:12px 16px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        text-align:center;
        font-family:inherit;
        font-size:clamp(16px,2.2vw,24px);
        font-weight:1000;
        line-height:1.12;
        color:#17384f;
        cursor:pointer;
        text-decoration:none;
        box-shadow:0 12px 28px rgba(23,56,79,.14);
        touch-action:manipulation;
        -webkit-tap-highlight-color:transparent;
      }

      .hha-brush-summary-final-btn.replay{
        background:linear-gradient(180deg,#fff2a8,#ffd84d);
        color:#5b4200;
      }

      .hha-brush-summary-final-btn.cooldown{
        background:linear-gradient(180deg,#effcff,#ffffff);
        border:3px solid #bdf4ff;
        color:#0f766e;
      }

      .hha-brush-summary-final-btn.zone{
        background:linear-gradient(180deg,#dcfff2,#baf4cf);
        color:#14532d;
      }

      body.hha-brush-summary-final main,
      body.hha-brush-summary-final .page,
      body.hha-brush-summary-final .app,
      body.hha-brush-summary-final .summary,
      body.hha-brush-summary-final [class*="summary"],
      body.hha-brush-summary-final [id*="summary"]{
        max-width:100% !important;
      }

      body.hha-brush-summary-final .hha-score-panel,
      body.hha-brush-summary-final .scorePanel,
      body.hha-brush-summary-final .score-panel{
        min-height:auto !important;
      }

      body.hha-brush-summary-final .hha-summary-repair-card{
        margin-bottom:16px !important;
      }

      body.hha-brush-summary-final [data-summary-repaired="pass"],
      body.hha-brush-summary-final .hha-summary-repaired-pass{
        border-color:#86efac !important;
        background:rgba(236,253,245,.92) !important;
      }

      body.hha-brush-summary-final .hha-summary-stack-safe{
        position:relative !important;
        bottom:auto !important;
        transform:none !important;
      }

      @media (max-width:820px){
        body.hha-brush-summary-final{
          padding-bottom:calc(238px + env(safe-area-inset-bottom,0px)) !important;
        }

        #hha-brush-summary-final-actions{
          grid-template-columns:1fr;
          width:min(94vw,560px);
          gap:9px;
          padding:10px;
          border-radius:26px;
        }

        .hha-brush-summary-final-btn{
          min-height:54px;
          border-radius:20px;
          font-size:18px;
        }
      }

      @media (max-width:560px){
        body.hha-brush-summary-final{
          padding-bottom:calc(218px + env(safe-area-inset-bottom,0px)) !important;
        }

        #hha-brush-summary-final-actions{
          bottom:calc(8px + env(safe-area-inset-bottom,0px));
        }

        .hha-brush-summary-final-btn{
          min-height:50px;
          font-size:16px;
        }
      }
    `;
    DOC.head.appendChild(style);
  }

  function hideEmergencyStart(){
    const emergency = DOC.getElementById('hha-brush-emergency-start');
    if(emergency){
      try{ emergency.remove(); }catch(_){ emergency.style.display = 'none'; }
    }

    Array.from(DOC.querySelectorAll('button,a,div,span')).forEach(el => {
      const t = (el.textContent || '').trim();

      if(t === '🪥 เริ่มแปรงฟัน' || t === 'เริ่มแปรงฟัน'){
        const cs = WIN.getComputedStyle ? WIN.getComputedStyle(el) : null;
        const fixedLike = !cs || cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute';

        if(fixedLike){
          el.classList.add('hha-summary-hide-on-final');
          try{ el.remove(); }catch(_){ el.style.display = 'none'; }
        }
      }
    });
  }

  function stopGameplayLayers(){
    try{
      if(WIN.HHA_BRUSH_POLISH && typeof WIN.HHA_BRUSH_POLISH.stop === 'function'){
        WIN.HHA_BRUSH_POLISH.stop();
      }
    }catch(_){}

    [
      'hha-brush-polish-layer',
      'hha-brush-cvr-layer',
      'hha-brush-cvr-crosshair',
      'hha-brush-cvr-hint'
    ].forEach(id => {
      const el = DOC.getElementById(id);
      if(el){
        try{ el.style.display = 'none'; }catch(_){}
      }
    });

    Array.from(DOC.querySelectorAll('.hha-brush-target,.hha-brush-pop,.hha-brush-sparkle')).forEach(el => {
      try{ el.remove(); }catch(_){ el.style.display = 'none'; }
    });
  }

  function markOldBottomActionsSafe(){
    const words = ['เล่นอีกครั้ง', 'Cooldown', 'กลับ Hygiene Zone'];

    Array.from(DOC.querySelectorAll('button,a,div')).forEach(el => {
      const t = text(el).trim();
      if(!t) return;

      const matched = words.some(w => t.includes(w));
      if(!matched) return;

      const cs = WIN.getComputedStyle ? WIN.getComputedStyle(el) : null;
      if(cs && (cs.position === 'fixed' || cs.position === 'sticky')){
        el.classList.add('hha-summary-stack-safe');
      }
    });
  }

  function bindExistingButtons(){
    Array.from(DOC.querySelectorAll('button,a')).forEach(el => {
      const t = text(el).trim();

      if(/เล่นอีกครั้ง|Replay|ลองใหม่/i.test(t)){
        el.addEventListener('click', function(ev){
          try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
          go(launcherUrl());
        }, true);
      }

      if(/Cooldown|คูลดาวน์/i.test(t)){
        el.addEventListener('click', function(ev){
          try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
          go(cooldownUrl());
        }, true);
      }

      if(/กลับ Hygiene Zone|Hygiene Zone|กลับโซน/i.test(t)){
        el.addEventListener('click', function(ev){
          try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
          go(hygieneZoneUrl());
        }, true);
      }
    });
  }

  function mountFinalActions(){
    let bar = DOC.getElementById('hha-brush-summary-final-actions');

    if(!bar){
      bar = DOC.createElement('nav');
      bar.id = 'hha-brush-summary-final-actions';
      bar.setAttribute('aria-label', 'Brush Kids summary actions');

      bar.innerHTML = `
        <button class="hha-brush-summary-final-btn replay" type="button" data-final-action="replay">↩️ เล่นอีกครั้ง</button>
        <button class="hha-brush-summary-final-btn cooldown" type="button" data-final-action="cooldown">🧘 Cooldown</button>
        <button class="hha-brush-summary-final-btn zone" type="button" data-final-action="zone">🏠 กลับ Hygiene Zone</button>
      `;

      DOC.body.appendChild(bar);
    }

    const replay = bar.querySelector('[data-final-action="replay"]');
    const cooldown = bar.querySelector('[data-final-action="cooldown"]');
    const zone = bar.querySelector('[data-final-action="zone"]');

    if(replay && !replay.__hhaFinalBound){
      replay.__hhaFinalBound = true;
      replay.addEventListener('click', function(ev){
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        go(launcherUrl());
      }, { passive:false });
    }

    if(cooldown && !cooldown.__hhaFinalBound){
      cooldown.__hhaFinalBound = true;
      cooldown.addEventListener('click', function(ev){
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        go(cooldownUrl());
      }, { passive:false });
    }

    if(zone && !zone.__hhaFinalBound){
      zone.__hhaFinalBound = true;
      zone.addEventListener('click', function(ev){
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        go(hygieneZoneUrl());
      }, { passive:false });
    }
  }

  function reduceHugeScorePanel(){
    /*
     * ไม่แก้ DOM แรง ๆ แค่กัน panel คะแนนกินพื้นที่จน layout ล้นในจอเตี้ย/มือถือ
     */
    const bodyText = text();

    if(!/คะแนนของฉัน|ผลการแปรงฟันของฉัน/i.test(bodyText)) return;

    Array.from(DOC.querySelectorAll('section,article,div')).forEach(el => {
      const t = text(el);
      if(t.length > 250) return;

      if(/คะแนนของฉัน/.test(t) && /\d{3,}/.test(t)){
        el.style.maxHeight = 'min(42vh, 420px)';
        el.style.overflow = 'hidden';
      }
    });
  }

  function apply(){
    if(!isSummary()) return;

    DOC.documentElement.classList.add('hha-brush-summary-final');
    if(DOC.body) DOC.body.classList.add('hha-brush-summary-final');

    ensureStyle();
    hideEmergencyStart();
    stopGameplayLayers();
    markOldBottomActionsSafe();
    bindExistingButtons();
    mountFinalActions();
    reduceHugeScorePanel();

    try{
      WIN.dispatchEvent(new CustomEvent('hha:brush-summary-ui-final', {
        detail: {
          patch: PATCH_ID,
          replay: launcherUrl(),
          cooldown: cooldownUrl(),
          zone: hygieneZoneUrl()
        }
      }));
    }catch(_){}

    log('applied');
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true,
        attributeFilter:['class','style']
      });
    }catch(_){}

    setTimeout(apply, 120);
    setTimeout(apply, 500);
    setTimeout(apply, 1200);
    setTimeout(apply, 2400);
    setTimeout(apply, 4200);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_UI_FINAL = {
      patch: PATCH_ID,
      apply,
      urls: {
        launcher: launcherUrl,
        mainRun: mainRunUrl,
        cooldown: cooldownUrl,
        zone: hygieneZoneUrl
      }
    };
  }

  function boot(){
    expose();
    observe();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
