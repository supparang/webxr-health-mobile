/* =========================================================
   HeroHealth Hydration Mode Patch
   File: /herohealth/hydration-vr/hydration-vr.mode-patch.js
   Version: v20260515-pack14
   Purpose:
   - view class: pc / mobile / cvr
   - mode class: solo / duet / race / battle / coop
   - Cardboard VR hha:shoot + fallback crosshair
   - target safe zone / spacing
   - summary action dedupe
   - latest summary save
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260515-hydration-mode-patch-pack14';

  function getUrl(){
    try{ return new URL(location.href); }
    catch(e){ return new URL('./run.html', location.origin); }
  }

  function getParam(k, d){
    try{ return getUrl().searchParams.get(k) || d; }
    catch(e){ return d; }
  }

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }
    catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.from((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function getView(){
    var v = getParam('view', document.body.dataset.view || 'mobile');
    return ['pc','mobile','cvr'].includes(v) ? v : 'mobile';
  }

  function getMode(){
    var m = getParam('mode', document.body.dataset.mode || 'solo');
    return ['solo','duet','race','battle','coop'].includes(m) ? m : 'solo';
  }

  function setViewModeClass(){
    var view = getView();
    var mode = getMode();

    document.body.dataset.view = view;
    document.body.dataset.mode = mode;

    document.body.classList.remove('hha-view-pc','hha-view-mobile','hha-view-cvr');
    document.body.classList.remove('hha-mode-solo','hha-mode-duet','hha-mode-race','hha-mode-battle','hha-mode-coop');

    document.body.classList.add('hha-view-' + view);
    document.body.classList.add('hha-mode-' + mode);

    if(view === 'cvr'){
      document.body.classList.add('hha-cardboard-ready');
    }
  }

  function ensureModeBadge(){
    var mode = getMode();
    if(mode === 'solo') return;

    var old = document.getElementById('hha-mode-badge');
    if(old) return;

    var room = getParam('room','');
    var label = {
      duet:'🤝 Duet',
      race:'🏁 Race',
      battle:'⚔️ Battle',
      coop:'🌈 Coop'
    }[mode] || mode;

    var badge = document.createElement('div');
    badge.id = 'hha-mode-badge';
    badge.className = 'hha-mode-badge';
    badge.textContent = label + (room ? ' • ' + room : ' • multiplayer');
    document.body.appendChild(badge);
  }

  /* =========================================================
     cVR crosshair + shoot support
     ========================================================= */

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

        var pad = 28;

        return (
          p.x >= r.left - pad &&
          p.x <= r.right + pad &&
          p.y >= r.top - pad &&
          p.y <= r.bottom + pad
        );
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

  function bindShoot(){
    function onShoot(ev){
      try{
        if(getView() !== 'cvr') return;

        var ok = shootCenter();

        if(!ok && ev && ev.detail && ev.detail.target){
          fireClick(ev.detail.target);
        }
      }catch(e){}
    }

    window.addEventListener('hha:shoot', onShoot);
    document.addEventListener('hha:shoot', onShoot);

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

  /* =========================================================
     Target safe zone + spacing
     ========================================================= */

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

  function fixTarget(target){
    if(!target || !target.isConnected) return;

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

        var all = qa('.hha-hydration-target', playfield)
          .filter(function(t){
            return t !== target && t.isConnected;
          });

        if(all.length){
          var dist = minDistance();
          var overlaps = all.some(function(other){
            return tooClose(target, other, dist);
          });

          if(overlaps){
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
          }
        }

        target.dataset.hhaModePatch = PATCH;
      }catch(e){}
    });
  }

  function observeTargets(){
    var playfield = document.getElementById('hha-hydration-playfield');
    if(!playfield) return;

    qa('.hha-hydration-target', playfield).forEach(fixTarget);

    var mo = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if(!node || node.nodeType !== 1) return;

          if(node.classList && node.classList.contains('hha-hydration-target')){
            fixTarget(node);
          }

          if(node.querySelectorAll){
            node.querySelectorAll('.hha-hydration-target').forEach(fixTarget);
          }
        });
      });
    });

    mo.observe(playfield, {
      childList:true,
      subtree:true
    });

    window.addEventListener('resize', function(){
      qa('.hha-hydration-target', playfield).forEach(fixTarget);
    }, { passive:true });
  }

  /* =========================================================
     Summary clean + save
     ========================================================= */

  function findSummary(){
    var selectors = [
      '#hha-hydration-summary',
      '.hha-hydration-summary',
      '#hydration-summary',
      '.hha-summary-panel',
      '.hha-summary',
      '.hha-summary-card',
      '[data-hha-summary]'
    ];

    for(var i=0; i<selectors.length; i++){
      var el = q(selectors[i]);
      if(el) return el;
    }

    return null;
  }

  function nutritionZoneUrl(){
    var rawHub = getParam('hub', '');

    try{
      var decoded = decodeURIComponent(rawHub || '');
      if(decoded && decoded.indexOf('nutrition-zone.html') !== -1){
        return decoded;
      }
    }catch(e){}

    return new URL('../nutrition-zone.html', location.href).toString();
  }

  function cooldownUrl(){
    var returnUrl = nutritionZoneUrl();
    var url = new URL('../warmup-gate.html', location.href);

    var current = getUrl();

    [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'mode',
      'room',
      'log',
      'api',
      'studyId',
      'conditionGroup'
    ].forEach(function(k){
      var v = current.searchParams.get(k);
      if(v !== null && v !== ''){
        url.searchParams.set(k, v);
      }
    });

    url.searchParams.set('zone','nutrition');
    url.searchParams.set('game','hydration');
    url.searchParams.set('phase','cooldown');
    url.searchParams.set('studyPhase','cooldown');
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
        mode:getMode(),
        view:getView(),
        savedAt:new Date().toISOString(),
        pid:getParam('pid','anon'),
        name:getParam('name', getParam('nick','Hero')),
        diff:getParam('diff','normal'),
        time:getParam('time','150'),
        room:getParam('room',''),
        text:text.slice(0,1600),
        url:location.href
      };

      localStorage.setItem('HHA_LAST_SUMMARY_HYDRATION', JSON.stringify(data));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(data));
    }catch(e){}
  }

  function textHasAction(text, key){
    text = String(text || '').toLowerCase();

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

  function injectSummaryActions(summary){
    if(!summary || !summary.isConnected) return;

    saveLastSummary(summary);

    var buttons = qa('button, a', summary);
    var hasCooldown = buttons.some(function(b){ return textHasAction(b.textContent, 'cooldown'); });
    var hasZone = buttons.some(function(b){ return textHasAction(b.textContent, 'zone'); });
    var hasReplay = buttons.some(function(b){ return textHasAction(b.textContent, 'replay'); });

    var existing = qa('.hha-hydration-final-actions', summary);

    if(hasCooldown && hasZone && hasReplay && existing.length){
      existing.forEach(function(box){
        try{ box.remove(); }catch(e){}
      });
      return;
    }

    if(existing.length > 1){
      existing.slice(1).forEach(function(box){
        try{ box.remove(); }catch(e){}
      });
    }

    if(hasCooldown && hasZone && hasReplay) return;

    var actions = existing[0];

    if(!actions){
      actions = document.createElement('div');
      actions.className = 'hha-hydration-final-actions';
      summary.appendChild(actions);
    }

    actions.innerHTML = [
      '<button type="button" class="hha-final-cooldown">🧘 ทำ Cooldown</button>',
      '<button type="button" class="hha-final-zone">🥗 กลับ Nutrition Zone</button>',
      '<button type="button" class="hha-final-replay">🔁 เล่นใหม่</button>'
    ].join('');

    var c = q('.hha-final-cooldown', actions);
    var z = q('.hha-final-zone', actions);
    var r = q('.hha-final-replay', actions);

    if(c) c.addEventListener('click', function(){
      try{
        if(typeof window.goHydrationCooldownThenHub === 'function'){
          window.goHydrationCooldownThenHub();
          return;
        }
      }catch(e){}

      location.href = cooldownUrl();
    });

    if(z) z.addEventListener('click', function(){
      location.href = nutritionZoneUrl();
    });

    if(r) r.addEventListener('click', function(){
      try{
        if(typeof window.restartHydrationSameChallenge === 'function'){
          window.restartHydrationSameChallenge();
          return;
        }
      }catch(e){}

      var u = getUrl();
      u.searchParams.set('seed', String(Date.now()));
      u.searchParams.set('run','play');
      location.href = u.toString();
    });
  }

  function scanSummary(){
    var summary = findSummary();
    if(summary) injectSummaryActions(summary);
  }

  /* =========================================================
     Final boot
     ========================================================= */

  function boot(){
    setViewModeClass();
    ensureModeBadge();
    ensureFallbackCrosshair();
    bindShoot();
    observeTargets();

    scanSummary();

    var mo = new MutationObserver(function(){
      scanSummary();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(scanSummary, 900);

    window.HHA = window.HHA || {};
    window.HHA.HydrationModePatch = {
      version:PATCH,
      getView:getView,
      getMode:getMode,
      shootCenter:shootCenter,
      nutritionZoneUrl:nutritionZoneUrl,
      cooldownUrl:cooldownUrl
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
