/* === /herohealth/vr-goodjunk/goodjunk-pc-return-launcher-final-patch.js === */
/* FULL PATCH v20260606-pc-return-launcher-final
   Purpose:
   - ใช้ใน goodjunk-solo-boss-pc.html
   - ปุ่มกลับ / summary / เลือกโหมด ต้องไป /herohealth/goodjunk-launcher.html เสมอ
   - กัน path ผิด /webxr-health-mobile/goodjunk-launcher.html
*/

(function(){
  'use strict';

  const PATCH = 'v20260606-pc-return-launcher-final';

  if(window.GJ_PC_RETURN_LAUNCHER_FINAL_LOADED){
    return;
  }
  window.GJ_PC_RETURN_LAUNCHER_FINAL_LOADED = true;

  const GOODJUNK_LAUNCHER =
    'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  const qs = new URLSearchParams(location.search || '');

  function q(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function normalize(url){
    let s = String(url || '');

    s = s.replace(
      'https://supparang.github.io/webxr-health-mobile/goodjunk-launcher.html',
      GOODJUNK_LAUNCHER
    );

    s = s.replace(
      '/webxr-health-mobile/goodjunk-launcher.html',
      '/webxr-health-mobile/herohealth/goodjunk-launcher.html'
    );

    s = s.replace(
      '/herohealth/herohealth/goodjunk-launcher.html',
      '/herohealth/goodjunk-launcher.html'
    );

    s = s.replace(
      'https://supparang.github.io/webxr-health-mobile/herohealth/herohealth/goodjunk-launcher.html',
      GOODJUNK_LAUNCHER
    );

    return s;
  }

  function launcherUrl(){
    const u = new URL(GOODJUNK_LAUNCHER);

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', q('name', q('nick', 'Hero')));
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '120'));
    u.searchParams.set('view', q('view', 'pc'));

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'pc-return');
    u.searchParams.set('theme', 'goodjunk');

    [
      'studyId',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api',
      'seed'
    ].forEach(function(k){
      const v = qs.get(k);
      if(v) u.searchParams.set(k, v);
    });

    return normalize(u.toString());
  }

  const TARGET = launcherUrl();

  function labelOf(el){
    return String(
      el && (
        el.textContent ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function hrefOf(el){
    return String(el && el.getAttribute && el.getAttribute('href') || '');
  }

  function isGoodJunkReturn(el){
    if(!el || !el.closest) return false;

    const btn = el.closest('a,button,[role="button"]');
    if(!btn) return false;

    const label = labelOf(btn);
    const href = hrefOf(btn);

    return (
      label.includes('กลับเลือกโหมด') ||
      label.includes('กลับหน้าเลือกเกม') ||
      label.includes('กลับหน้าโหมดเกม') ||
      label.includes('เลือกโหมด') ||
      label.includes('GoodJunk') ||
      label.includes('เล่นอีกครั้ง') ||
      href.includes('goodjunk-launcher.html')
    );
  }

  function go(reason){
    try{
      localStorage.setItem('GJ_PC_RETURN_LAUNCHER_FINAL_LAST', JSON.stringify({
        patch: PATCH,
        target: TARGET,
        reason: reason || '',
        savedAt: new Date().toISOString()
      }));
    }catch(e){}

    location.href = TARGET;
  }

  function markButtons(){
    try{
      document.querySelectorAll('a,button,[role="button"]').forEach(function(el){
        if(!isGoodJunkReturn(el)) return;

        el.dataset.gjPcReturnLauncher = PATCH;

        if(el.tagName && el.tagName.toLowerCase() === 'a'){
          el.setAttribute('href', TARGET);
        }
      });
    }catch(e){}
  }

  document.addEventListener('click', function(ev){
    if(!isGoodJunkReturn(ev.target)) return;

    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    go('captured-click');
    return false;
  }, true);

  function boot(){
    markButtons();

    try{
      const btn = document.getElementById('shellBackBtn');
      if(btn){
        btn.innerHTML = '🎮 กลับเลือกโหมด GoodJunk';
        btn.setAttribute('aria-label', 'กลับหน้าเลือกโหมด GoodJunk');
        btn.dataset.gjPcReturnLauncher = PATCH;
      }
    }catch(e){}

    try{
      const mo = new MutationObserver(markButtons);
      mo.observe(document.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['href','class','style','data-action']
      });
    }catch(e){}

    setTimeout(markButtons, 80);
    setTimeout(markButtons, 350);
    setTimeout(markButtons, 900);
    setTimeout(markButtons, 1800);
    setTimeout(markButtons, 3200);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

  window.GJ_PC_RETURN_LAUNCHER_FINAL = {
    patch: PATCH,
    target: TARGET,
    go: go,
    normalize: normalize,
    launcherUrl: launcherUrl,
    markButtons: markButtons
  };

  console.info('[GoodJunk PC return launcher final]', TARGET);
})();
