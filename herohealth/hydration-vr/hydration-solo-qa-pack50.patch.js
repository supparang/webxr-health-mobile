/* =========================================================
   HeroHealth Hydration Solo QA / Version Lock Patch
   File: /herohealth/hydration-vr/hydration-solo-qa-pack50.patch.js
   Version: v20260528-pack50-qa-version-lock

   Purpose:
   - Final QA lock after Pack41–49
   - Show small QA status badge
   - Check important patches are loaded
   - Save QA status to localStorage
   - Warn without blocking gameplay
   - Does NOT alter gameplay/scoring/spawn
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260528-pack50-qa-version-lock';

  if(window.HHA_HYDRATION_SOLO_QA_PACK50){
    console.warn('[Hydration Solo QA Pack50] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_QA_PACK50 = true;

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function ctx(){
    return window.HHA_HYDRATION_RUN_CONTEXT || {};
  }

  function currentView(){
    return String(ctx().view || document.body.dataset.view || 'mobile').toLowerCase();
  }

  function currentMode(){
    return String(ctx().mode || document.body.dataset.mode || 'solo').toLowerCase();
  }

  function currentDiff(){
    return String(ctx().diff || 'normal').toLowerCase();
  }

  function hasSummary(){
    return !!q('.hha-solo-summary, .hha-hydration-summary, #hha-hydration-summary, [data-hha-summary]');
  }

  function hasHud(){
    return !!q('.hha-solo-hud, .hha-hydration-hud');
  }

  function hasStart(){
    return !!q('.hha-solo-start, .hha-hydration-start, [data-hha-hydration-start]');
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-qa-pack50-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-qa-pack50-css';
    style.textContent = `
      .hha-qa50-badge{
        position:fixed;
        left:calc(10px + env(safe-area-inset-left,0px));
        top:calc(10px + env(safe-area-inset-top,0px));
        z-index:24000;
        display:flex;
        align-items:center;
        gap:7px;
        max-width:min(360px,86vw);
        padding:7px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:2px solid #d7f3ff;
        box-shadow:0 10px 26px rgba(30,75,115,.14);
        color:#24445c;
        font-size:11px;
        font-weight:1000;
        pointer-events:none;
      }

      .hha-qa50-badge.ok{
        border-color:#b9efc5;
      }

      .hha-qa50-badge.warn{
        border-color:#ffd28c;
      }

      .hha-qa50-dot{
        width:10px;
        height:10px;
        border-radius:999px;
        background:#62e68f;
        box-shadow:0 0 0 4px rgba(98,230,143,.16);
        flex:0 0 auto;
      }

      .hha-qa50-badge.warn .hha-qa50-dot{
        background:#ffbd59;
        box-shadow:0 0 0 4px rgba(255,189,89,.18);
      }

      .hha-qa50-badge span{
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hha-qa50-panel{
        position:fixed;
        right:calc(12px + env(safe-area-inset-right,0px));
        top:calc(76px + env(safe-area-inset-top,0px));
        z-index:24001;
        width:min(360px,86vw);
        padding:12px 13px;
        border-radius:22px;
        background:rgba(255,255,255,.96);
        border:3px solid #ffd28c;
        box-shadow:0 18px 46px rgba(30,75,115,.20);
        color:#24445c;
        font-size:12px;
        font-weight:900;
        line-height:1.35;
        pointer-events:none;
        opacity:0;
        transform:translateY(-8px);
        transition:.2s ease;
      }

      .hha-qa50-panel.show{
        opacity:1;
        transform:translateY(0);
      }

      .hha-qa50-panel b{
        display:block;
        margin-bottom:4px;
        font-size:14px;
        color:#85631b;
      }

      .hha-qa50-summary{
        margin:10px 0 0;
        padding:10px 12px;
        border-radius:18px;
        background:#f0fff4;
        border:2px solid #b9efc5;
        color:#256b44;
        text-align:center;
        font-weight:1000;
        font-size:12px;
        line-height:1.35;
      }

      body.hha-view-mobile .hha-qa50-badge{
        top:calc(6px + env(safe-area-inset-top,0px));
        left:calc(8px + env(safe-area-inset-left,0px));
        padding:6px 8px;
        font-size:10px;
      }

      body.hha-view-mobile .hha-qa50-panel{
        top:calc(62px + env(safe-area-inset-top,0px));
        right:8px;
        width:min(320px,88vw);
        border-radius:20px;
      }

      body.hha-view-cvr .hha-qa50-badge{
        top:calc(8px + env(safe-area-inset-top,0px));
        left:calc(8px + env(safe-area-inset-left,0px));
        opacity:.82;
      }
    `;

    document.head.appendChild(style);
  }

  var REQUIRED = [
    {
      label:'Core',
      test:function(){
        return !!window.HHA_HYDRATION_RUN_CONTEXT;
      }
    },
    {
      label:'Pack41 Effects',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_EFFECTS_PACK41; }
    },
    {
      label:'Pack42 Boss',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_BOSS_PACK42; }
    },
    {
      label:'Pack43 Balance',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_BALANCE_PACK43; }
    },
    {
      label:'Pack44 SFX',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_SFX_PACK44; }
    },
    {
      label:'Pack45 cVR',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_CVR_PACK45; }
    },
    {
      label:'Pack46 Assist',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_ASSIST_PACK46; }
    },
    {
      label:'Pack47 PC/Mobile',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_PC_MOBILE_PACK47; }
    },
    {
      label:'Pack48 Onboarding',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_ONBOARDING_PACK48; }
    },
    {
      label:'Pack49 Freeze',
      test:function(){ return !!window.HHA_HYDRATION_SOLO_FREEZE_PACK49; }
    }
  ];

  function checkPacks(){
    var ok = [];
    var missing = [];

    REQUIRED.forEach(function(item){
      var pass = false;

      try{
        pass = !!item.test();
      }catch(e){
        pass = false;
      }

      if(pass){
        ok.push(item.label);
      }else{
        missing.push(item.label);
      }
    });

    return {
      ok:ok,
      missing:missing,
      complete:missing.length === 0,
      total:REQUIRED.length
    };
  }

  function ensureBadge(){
    var badge = q('.hha-qa50-badge');
    if(badge) return badge;

    badge = document.createElement('div');
    badge.className = 'hha-qa50-badge';
    badge.innerHTML = '<i class="hha-qa50-dot"></i><span>Hydration Solo QA</span>';
    document.body.appendChild(badge);

    return badge;
  }

  function ensurePanel(){
    var panel = q('.hha-qa50-panel');
    if(panel) return panel;

    panel = document.createElement('div');
    panel.className = 'hha-qa50-panel';
    document.body.appendChild(panel);

    return panel;
  }

  function updateBadge(status){
    var badge = ensureBadge();
    var text = q('span', badge);

    badge.classList.toggle('ok', status.complete);
    badge.classList.toggle('warn', !status.complete);

    if(text){
      text.textContent = status.complete
        ? 'Hydration Solo Pack50 • READY'
        : 'Hydration Solo Pack50 • missing ' + status.missing.length;
    }
  }

  function showWarning(status){
    var panel = ensurePanel();

    if(status.complete){
      panel.classList.remove('show');
      return;
    }

    panel.innerHTML =
      '<b>⚠️ QA Warning</b>' +
      'ยังมี patch ที่ไม่โหลด: ' + status.missing.join(', ') +
      '<br>เกมยังเล่นต่อได้ แต่ควรตรวจ path/cache ของไฟล์ patch';

    panel.classList.add('show');

    clearTimeout(panel._timer);
    panel._timer = setTimeout(function(){
      panel.classList.remove('show');
    }, 4200);
  }

  function saveQaStatus(status){
    try{
      var payload = {
        game:'hydration',
        mode:currentMode(),
        view:currentView(),
        diff:currentDiff(),
        complete:status.complete,
        ok:status.ok,
        missing:status.missing,
        patchTotal:status.total,
        version:VERSION,
        runVersion:(window.HHA && window.HHA.HYDRATION_RUN_VERSION) || '',
        hasStart:hasStart(),
        hasHud:hasHud(),
        hasSummary:hasSummary(),
        savedAt:new Date().toISOString()
      };

      localStorage.setItem('HHA_HYDRATION_SOLO_QA_STATUS', JSON.stringify(payload));

      return payload;
    }catch(e){
      return null;
    }
  }

  function dedupeFreezePanels(){
    try{
      var summaries = qa('.hha-solo-summary, .hha-hydration-summary, #hha-hydration-summary, [data-hha-summary]');

      summaries.forEach(function(summary){
        [
          '.hha-freeze49-actions',
          '.hha-freeze49-banner',
          '.hha-freeze49-check',
          '.hha-qa50-summary'
        ].forEach(function(sel){
          qa(sel, summary).forEach(function(el, idx){
            if(idx > 0){
              try{ el.remove(); }catch(e){}
            }
          });
        });
      });
    }catch(e){}
  }

  function addSummaryQaNote(status){
    var summary = q('.hha-solo-summary, .hha-hydration-summary, #hha-hydration-summary, [data-hha-summary]');
    if(!summary || q('.hha-qa50-summary', summary)) return;

    var card =
      q('.hha-solo-summary-card', summary) ||
      q('.hha-summary-card', summary) ||
      summary.firstElementChild ||
      summary;

    var note = document.createElement('div');
    note.className = 'hha-qa50-summary';
    note.textContent = status.complete
      ? '✅ QA Lock: Solo flow พร้อมทดสอบปิดงานบน ' + currentView().toUpperCase()
      : '⚠️ QA Lock: มี patch บางตัวไม่โหลดครบ แต่ Summary ยังใช้งานได้';

    card.appendChild(note);
  }

  function runCheck(showPanel){
    var status = checkPacks();

    updateBadge(status);
    saveQaStatus(status);
    dedupeFreezePanels();

    if(showPanel){
      showWarning(status);
    }

    if(hasSummary()){
      addSummaryQaNote(status);
    }

    return status;
  }

  function watch(){
    var mo = new MutationObserver(function(){
      try{
        runCheck(false);
      }catch(e){}
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setTimeout(function(){ runCheck(true); }, 1200);
    setTimeout(function(){ runCheck(true); }, 2800);

    setInterval(function(){
      try{
        runCheck(false);
      }catch(e){}
    }, 1600);
  }

  function boot(){
    injectStyle();
    ensureBadge();
    watch();

    var status = runCheck(true);

    console.info('[Hydration Solo QA Pack50] loaded', VERSION, {
      view:currentView(),
      diff:currentDiff(),
      complete:status.complete,
      missing:status.missing
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();