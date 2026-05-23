(function GoodJunkSoloBossFinalPolishPatch(){
  'use strict';

  const PATCH_VERSION = 'v8.47.3-solo-boss-final-polish-summary-nav';

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

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function now(){
    return Date.now();
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

  function copyCommonParams(out){
    const keys = [
      'pid','name','diff','time','view','device','hub','zone','cat',
      'studyId','conditionGroup','api','log','game','gameId','mode'
    ];

    keys.forEach(function(k){
      if (out.searchParams.get(k)) return;

      let v = params.get(k);

      if (k === 'pid') v = getPid();
      if (k === 'name') v = getName();
      if (k === 'view' || k === 'device') v = normalizeView(params.get('view') || params.get('device') || '');
      if (k === 'zone' || k === 'cat') v = params.get(k) || 'nutrition';
      if (k === 'game' || k === 'gameId') v = params.get(k) || 'goodjunk';
      if (k === 'mode') v = params.get(k) || 'solo-boss';

      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    return out;
  }

  function buildReplayUrl(){
    const out = new URL(location.href);

    out.searchParams.set('pid', getPid());
    out.searchParams.set('name', getName());
    out.searchParams.set('view', normalizeView(params.get('view') || params.get('device') || ''));
    out.searchParams.set('device', normalizeView(params.get('view') || params.get('device') || ''));
    out.searchParams.set('run', 'play');
    out.searchParams.set('phase', 'play');
    out.searchParams.set('mode', params.get('mode') || 'solo-boss');
    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('seed', String(now()));
    out.searchParams.set('replay', PATCH_VERSION);
    out.searchParams.set('t', String(now()));

    return out.toString();
  }

  function buildLauncherUrl(){
    const out = new URL('../goodjunk-launcher.html', location.href);
    copyCommonParams(out);

    out.searchParams.delete('run');
    out.searchParams.delete('phase');
    out.searchParams.delete('room');
    out.searchParams.delete('roomCode');
    out.searchParams.delete('matchId');
    out.searchParams.delete('roundId');

    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('from', 'solo-boss-final');

    return out.toString();
  }

  function buildNutritionZoneUrl(){
    const out = new URL('../nutrition-zone.html', location.href);
    copyCommonParams(out);

    out.searchParams.delete('run');
    out.searchParams.delete('phase');
    out.searchParams.delete('room');
    out.searchParams.delete('roomCode');
    out.searchParams.delete('matchId');
    out.searchParams.delete('roundId');

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('from', 'goodjunk-solo-boss');

    return out.toString();
  }

  function buildHubUrl(){
    const hub = params.get('hub');

    if (hub){
      try{
        return new URL(hub, location.href).toString();
      }catch(_){}
    }

    const out = new URL('../hub.html', location.href);
    copyCommonParams(out);
    return out.toString();
  }

  function buildCooldownUrl(){
    /*
     * ใช้ warmup-gate.html เป็น shared gate
     * phase=cooldown และ next กลับ goodjunk-launcher.html
     */
    const out = new URL('../warmup-gate.html', location.href);
    copyCommonParams(out);

    out.searchParams.set('phase', 'cooldown');
    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('mode', params.get('mode') || 'solo-boss');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('next', buildLauncherUrl());
    out.searchParams.set('back', buildLauncherUrl());
    out.searchParams.set('hub', params.get('hub') || buildNutritionZoneUrl());
    out.searchParams.set('from', 'goodjunk-solo-boss-final');

    return out.toString();
  }

  function go(url){
    location.href = url;
  }

  function injectStyle(){
    if ($('#gjSoloBossFinalPolishStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjSoloBossFinalPolishStyle';

    style.textContent = `
      html.gj-solo-boss-final-polish,
      html.gj-solo-boss-final-polish body{
        overscroll-behavior:none;
      }

      /*
       * Summary / Result modal mobile polish
       */
      @media (max-width:760px){
        html.gj-solo-boss-final-polish .result-overlay,
        html.gj-solo-boss-final-polish .summary-overlay,
        html.gj-solo-boss-final-polish .end-overlay,
        html.gj-solo-boss-final-polish #resultOverlay,
        html.gj-solo-boss-final-polish #summaryOverlay,
        html.gj-solo-boss-final-polish #endOverlay{
          align-items:center !important;
          justify-content:center !important;
          padding:10px 10px calc(14px + env(safe-area-inset-bottom)) !important;
          overflow:hidden !important;
        }

        html.gj-solo-boss-final-polish .result-card,
        html.gj-solo-boss-final-polish .summary-card,
        html.gj-solo-boss-final-polish .end-card,
        html.gj-solo-boss-final-polish .modal-card,
        html.gj-solo-boss-final-polish .battle-result,
        html.gj-solo-boss-final-polish [data-summary-card]{
          width:min(94vw,440px) !important;
          max-height:calc(100dvh - 22px) !important;
          overflow:auto !important;
          -webkit-overflow-scrolling:touch !important;
          padding:18px 13px calc(16px + env(safe-area-inset-bottom)) !important;
          border-radius:26px !important;
        }

        html.gj-solo-boss-final-polish .result-title,
        html.gj-solo-boss-final-polish .summary-title,
        html.gj-solo-boss-final-polish .end-title,
        html.gj-solo-boss-final-polish [data-result-title]{
          font-size:clamp(28px,8.6vw,42px) !important;
          line-height:1.06 !important;
          margin-bottom:8px !important;
        }

        html.gj-solo-boss-final-polish .result-icon,
        html.gj-solo-boss-final-polish .summary-icon,
        html.gj-solo-boss-final-polish .end-icon{
          width:64px !important;
          height:64px !important;
          font-size:34px !important;
          margin-bottom:8px !important;
        }

        html.gj-solo-boss-final-polish .result-note,
        html.gj-solo-boss-final-polish .summary-note,
        html.gj-solo-boss-final-polish .badge-note{
          font-size:14px !important;
          padding:7px 10px !important;
          margin:8px auto !important;
        }

        html.gj-solo-boss-final-polish .result-score-grid,
        html.gj-solo-boss-final-polish .summary-grid,
        html.gj-solo-boss-final-polish .stats-grid,
        html.gj-solo-boss-final-polish [data-summary-grid]{
          grid-template-columns:1fr 1fr !important;
          gap:7px !important;
          margin:10px 0 !important;
        }

        html.gj-solo-boss-final-polish .score-box,
        html.gj-solo-boss-final-polish .stat-box,
        html.gj-solo-boss-final-polish .summary-box{
          padding:9px 8px !important;
          border-radius:17px !important;
        }

        html.gj-solo-boss-final-polish .score-box .big,
        html.gj-solo-boss-final-polish .stat-box .big,
        html.gj-solo-boss-final-polish .summary-box .big,
        html.gj-solo-boss-final-polish .coin-value,
        html.gj-solo-boss-final-polish .rank-value{
          font-size:clamp(24px,7vw,34px) !important;
          line-height:1 !important;
        }

        html.gj-solo-boss-final-polish .result-actions,
        html.gj-solo-boss-final-polish .summary-actions,
        html.gj-solo-boss-final-polish .end-actions,
        html.gj-solo-boss-final-polish .modal-actions{
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:8px !important;
          margin-top:10px !important;
          padding-bottom:4px !important;
        }

        html.gj-solo-boss-final-polish .result-actions button,
        html.gj-solo-boss-final-polish .summary-actions button,
        html.gj-solo-boss-final-polish .end-actions button,
        html.gj-solo-boss-final-polish .modal-actions button,
        html.gj-solo-boss-final-polish .result-actions a,
        html.gj-solo-boss-final-polish .summary-actions a,
        html.gj-solo-boss-final-polish .end-actions a,
        html.gj-solo-boss-final-polish .modal-actions a{
          min-height:46px !important;
          font-size:15px !important;
          border-radius:16px !important;
        }

        /*
         * ตอน summary เปิด ซ่อนปุ่มลอย/ปุ่มกลับที่อยู่ด้านหลัง
         */
        html.gj-solo-summary-open [data-floating],
        html.gj-solo-summary-open .floating-back,
        html.gj-solo-summary-open .back-floating,
        html.gj-solo-summary-open .corner-back,
        html.gj-solo-summary-open #btnFloatingBack,
        html.gj-solo-summary-open #btnBackFloating,
        html.gj-solo-summary-open #backToModeFloating,
        html.gj-solo-summary-open #btnBackModeFloating{
          opacity:0 !important;
          pointer-events:none !important;
          visibility:hidden !important;
        }

        /*
         * กันปุ่ม cooldown ชน browser gesture bar
         */
        html.gj-solo-boss-final-polish button,
        html.gj-solo-boss-final-polish a{
          touch-action:manipulation !important;
        }
      }

      @media (max-width:390px){
        html.gj-solo-boss-final-polish .result-score-grid,
        html.gj-solo-boss-final-polish .summary-grid,
        html.gj-solo-boss-final-polish .stats-grid,
        html.gj-solo-boss-final-polish [data-summary-grid]{
          grid-template-columns:1fr !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function isVisible(el){
    if (!el) return false;

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0){
      return false;
    }

    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function findSummaryOverlay(){
    const candidates = [
      '#resultOverlay',
      '#summaryOverlay',
      '#endOverlay',
      '.result-overlay',
      '.summary-overlay',
      '.end-overlay',
      '.game-summary',
      '.summary-modal'
    ];

    for (const sel of candidates){
      const el = $(sel);
      if (el && isVisible(el)) return el;
    }

    const textMatches = $all('section,div,main').find(function(el){
      if (!isVisible(el)) return false;
      const t = (el.textContent || '').trim();
      return /Rank|Coins|Summary|สรุป|เล่นอีกครั้ง|Cooldown|คูลดาวน์|กลับเลือกโหมด/i.test(t);
    });

    return textMatches || null;
  }

  function updateSummaryOpenClass(){
    const overlay = findSummaryOverlay();
    document.documentElement.classList.toggle('gj-solo-summary-open', !!overlay);
  }

  function buttonText(el){
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function bindButtonOnce(el, key, handler){
    if (!el || el.dataset[key] === '1') return;
    el.dataset[key] = '1';

    el.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      handler(ev, el);
    }, true);
  }

  function bindActionButtons(){
    const buttons = $all('button,a');

    buttons.forEach(function(btn){
      const t = buttonText(btn);
      const id = btn.id || '';
      const data = JSON.stringify(btn.dataset || {});

      /*
       * Replay / เล่นอีกครั้ง
       */
      if (
        /เล่นอีกครั้ง|Replay|Play Again|Try Again|Restart/i.test(t) ||
        /replay|restart|playagain/i.test(id + data)
      ){
        bindButtonOnce(btn, 'gjSoloReplayBound', function(){
          go(buildReplayUrl());
        });
        return;
      }

      /*
       * Cooldown
       */
      if (
        /Cooldown|คูลดาวน์|ผ่อนคลาย|ยืดเหยียด/i.test(t) ||
        /cooldown/i.test(id + data)
      ){
        bindButtonOnce(btn, 'gjSoloCooldownBound', function(){
          go(buildCooldownUrl());
        });
        return;
      }

      /*
       * กลับเลือกโหมด / launcher
       */
      if (
        /กลับเลือกโหมด|เลือกโหมด|โหมดทั้งหมด|Mode|Modes|Launcher/i.test(t) ||
        /mode|modes|launcher|backLobby|backMode/i.test(id + data)
      ){
        bindButtonOnce(btn, 'gjSoloLauncherBound', function(){
          go(buildLauncherUrl());
        });
        return;
      }

      /*
       * Nutrition Zone
       */
      if (
        /Nutrition Zone|โซนโภชนาการ|กลับ Zone|กลับโซน|อาหาร/i.test(t) ||
        /nutrition|zone|backZone/i.test(id + data)
      ){
        bindButtonOnce(btn, 'gjSoloZoneBound', function(){
          go(buildNutritionZoneUrl());
        });
        return;
      }

      /*
       * Hub
       */
      if (
        /^Hub$|HUB|🏠|หน้าหลัก/i.test(t) ||
        /hub|backHub/i.test(id + data)
      ){
        bindButtonOnce(btn, 'gjSoloHubBound', function(){
          go(buildHubUrl());
        });
      }
    });
  }

  function patchCloseSummaryButtons(){
    const closeButtons = $all('button,a').filter(function(btn){
      const t = buttonText(btn);
      const id = btn.id || '';
      return (
        t === '×' ||
        t === 'X' ||
        /ปิดสรุป|Close/i.test(t) ||
        /close|dismiss/i.test(id)
      );
    });

    closeButtons.forEach(function(btn){
      if (btn.dataset.gjSoloCloseLabel === '1') return;
      btn.dataset.gjSoloCloseLabel = '1';

      if (buttonText(btn) === '×' || buttonText(btn) === 'X'){
        btn.setAttribute('aria-label', 'ปิดสรุปผล');
        btn.title = 'ปิดสรุปผล';
      }
    });
  }

  function patchGlobalHelpers(){
    window.GJ_SOLO_BOSS_FINAL_POLISH = {
      version: PATCH_VERSION,
      buildReplayUrl,
      buildCooldownUrl,
      buildLauncherUrl,
      buildNutritionZoneUrl,
      buildHubUrl,
      updateSummaryOpenClass,
      bindActionButtons
    };
  }

  function boot(){
    document.documentElement.classList.add('gj-solo-boss-final-polish');

    injectStyle();
    patchGlobalHelpers();
    bindActionButtons();
    patchCloseSummaryButtons();
    updateSummaryOpenClass();

    const mo = new MutationObserver(function(){
      bindActionButtons();
      patchCloseSummaryButtons();
      updateSummaryOpenClass();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','hidden']
    });

    setInterval(function(){
      bindActionButtons();
      patchCloseSummaryButtons();
      updateSummaryOpenClass();
    }, 900);

    console.info('[GoodJunk Solo Boss Final Polish]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();