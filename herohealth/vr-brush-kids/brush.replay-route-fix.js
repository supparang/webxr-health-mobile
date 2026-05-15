/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.replay-route-fix.js
 * PATCH v20260514-P50-BRUSH-KIDS-REPLAY-ROUTE-FIX
 *
 * Purpose:
 * - ปุ่ม "เล่นอีกครั้ง" ต้องกลับไป brush.html?run=menu
 * - ไม่ไป brush-vr-kids.html / launcher อื่น
 * - preserve pid/name/diff/time/view/hub
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260514-P50-BRUSH-KIDS-REPLAY-ROUTE-FIX';

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
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
      try{ return new URL(String(raw || ''), baseHero()).toString(); }
      catch(__){ return ''; }
    }
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

  function hubV2Url(){
    return baseHero() + 'hub-v2.html';
  }

  function hygieneZoneUrl(){
    const currentHub = cleanUrl(param('hub', ''));

    /*
     * ถ้า hub ปัจจุบันเป็น hygiene-zone.html อยู่แล้ว ให้ใช้ต่อเลย
     * เช่น URL ที่อาจารย์ส่งมา
     */
    if(currentHub && /hygiene-zone\.html/i.test(currentHub)){
      return currentHub;
    }

    const zoneCtx = {
      pid: param('pid', 'anon'),
      name: param('name', 'Hero'),
      diff: param('diff', 'normal'),
      time: param('time', '90'),
      view: param('view', 'pc'),
      hub: currentHub || hubV2Url()
    };

    return baseHero() + 'hygiene-zone.html?' + toQuery(zoneCtx);
  }

  function replayUrl(){
    const ctx = {
      pid: param('pid', 'anon'),
      name: param('name', 'Hero'),
      diff: param('diff', 'normal'),
      time: param('time', '90'),
      view: param('view', 'pc'),

      zone: 'hygiene',
      cat: 'hygiene',
      game: 'brush',
      gameId: 'brush',
      variant: 'kids-vr',
      mode: param('mode', 'learn'),
      entry: 'brush-kids',
      theme: 'brush',

      /*
       * replay กลับหน้า menu/prep ของ brush.html
       */
      seed: param('seed', String(Date.now())),
      run: 'menu',
      hub: hygieneZoneUrl()
    };

    return baseHero() + 'vr-brush-kids/brush.html?' + toQuery(ctx);
  }

  function goReplay(){
    const url = replayUrl();

    try{
      WIN.location.href = url;
    }catch(_){
      try{ WIN.location.assign(url); }catch(__){}
    }
  }

  function isReplayButton(el){
    if(!el) return false;

    if(el.id === 'btnReplay') return true;

    const t = String(el.textContent || '').trim();

    return /เล่นอีกครั้ง|Replay|ลองใหม่/i.test(t);
  }

  function bindReplayButtons(){
    Array.from(DOC.querySelectorAll('button,a,[role="button"]')).forEach(el => {
      if(!isReplayButton(el)) return;
      if(el.__hhaReplayRouteFixBound) return;

      el.__hhaReplayRouteFixBound = true;

      el.addEventListener('click', function(ev){
        try{
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        }catch(_){}

        goReplay();
      }, true);

      try{
        if(el.tagName && el.tagName.toLowerCase() === 'a'){
          el.setAttribute('href', replayUrl());
        }
      }catch(_){}
    });
  }

  function expose(){
    WIN.HHA_BRUSH_REPLAY_ROUTE_FIX = {
      patch: PATCH_ID,
      replayUrl,
      goReplay,
      apply: bindReplayButtons
    };
  }

  function apply(){
    bindReplayButtons();
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 80);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true
      });
    }catch(_){}

    setTimeout(apply, 80);
    setTimeout(apply, 300);
    setTimeout(apply, 900);
    setTimeout(apply, 1800);
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
