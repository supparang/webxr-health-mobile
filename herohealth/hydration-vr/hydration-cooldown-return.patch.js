/* =========================================================
   HeroHealth Hydration Cooldown Return Force Patch
   File: /herohealth/hydration-vr/hydration-cooldown-return.patch.js
   Version: v20260518-pack25-hydration-cooldown-return-force

   Purpose:
   - บังคับ Hydration Cooldown ให้กลับ Nutrition Zone เสมอ
   - ไม่กลับ hub.html / hub-v2.html / hydration launcher / run.html
   - override goHydrationCooldownThenHub()
   - capture ปุ่ม Cooldown ใน Summary
   - ใส่ next / cdnext / return / back / hub ให้ warmup-gate ทุกแบบอ่านได้
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260518-pack25-hydration-cooldown-return-force';

  if(window.HHA_HYDRATION_COOLDOWN_RETURN_PACK25_LOADED){
    return;
  }

  window.HHA_HYDRATION_COOLDOWN_RETURN_PACK25_LOADED = true;

  function getUrl(){
    try{
      return new URL(location.href);
    }catch(e){
      return new URL('./run.html', location.origin);
    }
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

  function safeDecode(v){
    try{
      return decodeURIComponent(String(v || ''));
    }catch(e){
      return String(v || '');
    }
  }

  function normalizeNutritionUrl(raw){
    var base = heroBase();

    try{
      var decoded = safeDecode(raw || '');

      if(decoded && decoded.indexOf('nutrition-zone.html') !== -1){
        return decoded;
      }
    }catch(e){}

    return new URL('nutrition-zone.html', base).toString();
  }

  function nutritionZoneUrl(){
    var base = heroBase();
    var current = getUrl();

    /*
      ถ้า hub เดิมเป็น nutrition-zone อยู่แล้ว ใช้ได้
      ถ้า hub เดิมเป็น hub.html ให้สร้าง nutrition-zone ใหม่
    */
    var hubRaw = current.searchParams.get('hub') || '';
    var zone = normalizeNutritionUrl(hubRaw);

    var u = new URL(zone, base);

    [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'log',
      'api',
      'studyId',
      'conditionGroup'
    ].forEach(function(k){
      var v = current.searchParams.get(k);
      if(v !== null && v !== ''){
        u.searchParams.set(k, v);
      }
    });

    /*
      หน้า Nutrition Zone เองควรมี hub หลักเป็น hub.html
      แต่ปลายทางหลัง cooldown คือ nutrition-zone.html
    */
    if(!u.searchParams.get('hub')){
      u.searchParams.set('hub', new URL('hub.html', base).toString());
    }

    return u.toString();
  }

  function buildCooldownGateUrl(){
    var base = heroBase();
    var current = getUrl();
    var zone = nutritionZoneUrl();

    var gate = new URL('warmup-gate.html', base);

    [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'log',
      'api',
      'studyId',
      'conditionGroup'
    ].forEach(function(k){
      var v = current.searchParams.get(k);
      if(v !== null && v !== ''){
        gate.searchParams.set(k, v);
      }
    });

    gate.searchParams.set('zone', 'nutrition');
    gate.searchParams.set('cat', 'nutrition');
    gate.searchParams.set('game', 'hydration');
    gate.searchParams.set('gameId', 'hydration');
    gate.searchParams.set('theme', 'hydration');

    gate.searchParams.set('phase', 'cooldown');
    gate.searchParams.set('gatePhase', 'cooldown');
    gate.searchParams.set('studyPhase', 'cooldown');
    gate.searchParams.set('run', 'gate');

    /*
      ใส่ทุกชื่อ key ที่ gate หลายเวอร์ชันอาจอ่าน
      เพื่อกันกลับผิด
    */
    gate.searchParams.set('next', zone);
    gate.searchParams.set('cdnext', zone);
    gate.searchParams.set('return', zone);
    gate.searchParams.set('back', zone);
    gate.searchParams.set('hub', zone);

    /*
      mark ไว้ให้ warmup-gate patch รู้ว่า Hydration cooldown
      ต้องกลับ nutrition-zone เท่านั้น
    */
    gate.searchParams.set('forceReturn', 'nutrition-zone');
    gate.searchParams.set('fromGame', 'hydration');
    gate.searchParams.set('cooldownReturnFix', PATCH);

    return gate.toString();
  }

  function safeStop(ev){
    if(!ev) return;

    try{ ev.preventDefault(); }catch(e){}
    try{ ev.stopPropagation(); }catch(e){}

    try{
      if(ev.stopImmediatePropagation){
        ev.stopImmediatePropagation();
      }
    }catch(e){}
  }

  function flushBeforeCooldown(){
    try{
      window.dispatchEvent(new Event('pagehide'));
    }catch(e){}

    try{
      document.dispatchEvent(new Event('visibilitychange'));
    }catch(e){}
  }

  function goCooldown(ev){
    safeStop(ev);

    flushBeforeCooldown();

    location.href = buildCooldownGateUrl();

    return false;
  }

  function isCooldownButton(target){
    if(!target || !target.closest) return false;

    var btn = target.closest('button, a, [role="button"]');
    if(!btn) return false;

    var text = String(btn.textContent || '').toLowerCase();

    return (
      text.indexOf('cooldown') !== -1 ||
      text.indexOf('คูลดาวน์') !== -1 ||
      text.indexOf('ทำ cooldown') !== -1 ||
      text.indexOf('cooldown แล้วกลับ') !== -1 ||
      btn.classList.contains('hha-final-cooldown') ||
      btn.classList.contains('hha-summary-btn') && text.indexOf('cooldown') !== -1 ||
      btn.dataset.hhaCooldown === '1' ||
      btn.dataset.hhaHydrationCooldown === '1'
    );
  }

  function bindGlobalCooldownCapture(){
    if(window.HHA_HYDRATION_COOLDOWN_RETURN_GLOBAL_BOUND_PACK25){
      return;
    }

    window.HHA_HYDRATION_COOLDOWN_RETURN_GLOBAL_BOUND_PACK25 = true;

    function handler(ev){
      if(isCooldownButton(ev.target)){
        return goCooldown(ev);
      }
    }

    window.addEventListener('click', handler, true);
    window.addEventListener('pointerup', handler, true);
    window.addEventListener('mouseup', handler, true);
    window.addEventListener('touchend', handler, { passive:false, capture:true });

    document.addEventListener('click', handler, true);
    document.addEventListener('pointerup', handler, true);
    document.addEventListener('mouseup', handler, true);
    document.addEventListener('touchend', handler, { passive:false, capture:true });
  }

  function bindExistingButtons(){
    var buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));

    buttons.forEach(function(btn){
      if(btn.dataset.hhaHydrationCooldownReturnPack25 === PATCH) return;

      if(isCooldownButton(btn)){
        btn.dataset.hhaHydrationCooldownReturnPack25 = PATCH;
        btn.dataset.hhaHydrationCooldown = '1';

        /*
          ตั้ง onclick ทับเฉพาะปุ่ม cooldown เท่านั้น
          เพื่อกัน function เก่าพาไปผิดหน้า
        */
        btn.onclick = goCooldown;

        btn.addEventListener('click', goCooldown, true);
        btn.addEventListener('pointerup', goCooldown, true);
        btn.addEventListener('mouseup', goCooldown, true);
        btn.addEventListener('touchend', goCooldown, { passive:false, capture:true });
      }
    });
  }

  function patchSummaryButtons(){
    var summary = document.querySelector(
      '.hha-hydration-summary, #hha-hydration-summary, .hha-summary-card, [data-hha-summary]'
    );

    if(!summary) return;

    bindExistingButtons();
  }

  function boot(){
    /*
      override function เดิมทั้งหมด
    */
    window.goHydrationCooldownThenHub = goCooldown;
    window.goHydrationCooldown = goCooldown;

    bindGlobalCooldownCapture();
    bindExistingButtons();
    patchSummaryButtons();

    var mo = new MutationObserver(function(){
      bindExistingButtons();
      patchSummaryButtons();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style']
    });

    setInterval(function(){
      bindExistingButtons();
      patchSummaryButtons();
    }, 900);

    window.HHA = window.HHA || {};
    window.HHA.HydrationCooldownReturnFix = {
      version: PATCH,
      nutritionZoneUrl: nutritionZoneUrl,
      buildCooldownGateUrl: buildCooldownGateUrl,
      go: goCooldown
    };

    console.info('[Hydration Pack25] cooldown return force loaded');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
