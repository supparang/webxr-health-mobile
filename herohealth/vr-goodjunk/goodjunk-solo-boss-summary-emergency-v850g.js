/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-emergency-v850g.js === */
/* PATCH v20260607-v850g
   Emergency fix:
   - แก้จอ blur ค้างหลังจบเกม
   - ไม่ให้ toast ด้านบนถูกนับเป็น summary
   - ถ้าไม่มีปุ่มสรุปจริง ให้สร้าง summary card ทับทันที
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SUMMARY-EMERGENCY-V850G';

  if(window.GJ_SUMMARY_EMERGENCY_V850G_LOADED){
    return;
  }
  window.GJ_SUMMARY_EMERGENCY_V850G_LOADED = true;

  var startedAt = Date.now();
  var shown = false;

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function q(name, fallback){
    var v = qs().get(name);
    return v === null || v === '' ? fallback : v;
  }

  function txt(el){
    return String(
      el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute && el.getAttribute('aria-label') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function visible(el){
    if(!el) return false;

    try{
      var st = getComputedStyle(el);
      var r = el.getBoundingClientRect();

      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity || 1) > 0.05 &&
        r.width > 40 &&
        r.height > 36
      );
    }catch(e){
      return false;
    }
  }

  function hasClickableRealSummary(){
    var buttons = Array.prototype.slice.call(document.querySelectorAll(
      'button,a,[role="button"]'
    ));

    return buttons.some(function(el){
      if(!visible(el)) return false;

      var s = txt(el);
      var r = el.getBoundingClientRect();

      /*
        กันปุ่มเล็ก/ปุ่มลอย/ปุ่มกลับเลือกโหมดด้านล่าง
        summary จริงต้องอยู่กลาง dialog และมีปุ่มเล่นอีกครั้งหรือ Cooldown
      */
      if(r.top < 120) return false;
      if(r.width < 100 || r.height < 40) return false;

      return (
        s.includes('เล่นอีกครั้ง') ||
        s.includes('Cooldown') ||
        s.includes('คูลดาวน์')
      );
    });
  }

  function blurIsStuck(){
    var found = false;

    try{
      Array.prototype.slice.call(document.querySelectorAll('*')).some(function(el){
        if(!visible(el)) return false;

        var st = getComputedStyle(el);
        var filter = String(st.filter || '');
        var backdrop = String(st.backdropFilter || st.webkitBackdropFilter || '');
        var r = el.getBoundingClientRect();

        if(
          r.width > window.innerWidth * 0.45 &&
          r.height > window.innerHeight * 0.45 &&
          (
            filter.indexOf('blur') >= 0 ||
            backdrop.indexOf('blur') >= 0
          )
        ){
          found = true;
          return true;
        }

        return false;
      });
    }catch(e){}

    return found;
  }

  function readLatest(){
    var keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_RESULT',
      'GJ_LAST_SUMMARY',
      'GJ_SUMMARY_FORCE_VISIBLE_V850F_LAST',
      'GJ_SOLO_BOSS_PC_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST'
    ];

    for(var i = 0; i < keys.length; i++){
      try{
        var raw = localStorage.getItem(keys[i]);
        if(!raw) continue;

        var obj = JSON.parse(raw);
        if(!obj) continue;

        if(obj.summary) return obj.summary;
        if(obj.detail) return obj.detail;
        if(obj.result) return obj.result;
        return obj;
      }catch(e){}
    }

    return {};
  }

  function numberFromDom(id, fallback){
    try{
      var el = document.getElementById(id);
      if(!el) return fallback;

      var n = Number(txt(el).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : fallback;
    }catch(e){
      return fallback;
    }
  }

  function launcherUrl(){
    var u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html');

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', q('name', q('nick', 'Hero')));
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '90'));
    u.searchParams.set('view', q('view', 'mobile'));
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'summary-emergency-v850g');

    return u.toString();
  }

  function replayUrl(){
    var u = new URL(location.href);

    u.searchParams.set('run', 'play');
    u.searchParams.set('replay', String(Date.now()));
    u.searchParams.delete('phase');
    u.searchParams.delete('summary');
    u.searchParams.delete('result');

    return u.toString();
  }

  function cooldownUrl(data){
    var launcher = launcherUrl();
    var u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html');

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo_boss');
    u.searchParams.set('phase', 'cooldown');

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', q('name', q('nick', 'Hero')));
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '90'));
    u.searchParams.set('view', q('view', 'mobile'));

    u.searchParams.set('hub', launcher);
    u.searchParams.set('next', launcher);
    u.searchParams.set('back', launcher);
    u.searchParams.set('launcher', launcher);
    u.searchParams.set('return', launcher);
    u.searchParams.set('returnUrl', launcher);
    u.searchParams.set('cdnext', launcher);

    u.searchParams.set('score', String(data.score || 0));
    u.searchParams.set('accuracy', String(data.accuracy || 0));
    u.searchParams.set('goodHits', String(data.goodHits || 0));
    u.searchParams.set('bestCombo', String(data.combo || 0));
    u.searchParams.set('from', 'summary-emergency-v850g');

    return u.toString();
  }

  function removeOldEmergency(){
    [
      'gjSummaryEmergencyV850g',
      'gjSummaryForceVisibleV850f'
    ].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.remove();
    });
  }

  function show(reason){
    if(shown) return;

    if(hasClickableRealSummary()){
      return;
    }

    shown = true;
    removeOldEmergency();

    var latest = readLatest();

    var score = Number(
      latest.score ||
      latest.points ||
      latest.totalScore ||
      numberFromDom('gjmScore', 0) ||
      0
    ) || 0;

    var accuracy = latest.accuracy || latest.acc || '';
    var goodHits = latest.goodHits || latest.good || latest.goodCount || '';
    var combo = latest.bestCombo || latest.combo || '';

    var data = {
      score: score,
      accuracy: accuracy || 0,
      goodHits: goodHits || 0,
      combo: combo || 0
    };

    var overlay = document.createElement('div');
    overlay.id = 'gjSummaryEmergencyV850g';

    overlay.innerHTML = [
      '<div class="gj850g-card" role="dialog" aria-modal="true">',
        '<div class="gj850g-icon">🏆</div>',
        '<h1>สรุปผล GoodJunk</h1>',
        '<p>เกมจบแล้ว ระบบเปิดหน้าสรุปสำรองให้อัตโนมัติ</p>',
        '<div class="gj850g-grid">',
          '<div><b>' + score + '</b><span>คะแนน</span></div>',
          '<div><b>' + (accuracy || '-') + '</b><span>ความแม่นยำ</span></div>',
          '<div><b>' + (goodHits || '-') + '</b><span>อาหารดี</span></div>',
          '<div><b>x' + (combo || 0) + '</b><span>คอมโบสูงสุด</span></div>',
        '</div>',
        '<div class="gj850g-actions">',
          '<button id="gj850gReplay" type="button">🔁 เล่นอีกครั้ง</button>',
          '<button id="gj850gCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>',
        '</div>',
      '</div>'
    ].join('');

    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:grid',
      'place-items:center',
      'padding:18px',
      'background:rgba(15,23,42,.52)',
      'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)',
      'pointer-events:auto'
    ].join(';');

    var style = document.createElement('style');
    style.id = 'gjSummaryEmergencyV850gStyle';
    style.textContent = [
      '#gjSummaryEmergencyV850g *{box-sizing:border-box;}',
      '#gjSummaryEmergencyV850g .gj850g-card{',
        'width:min(520px,calc(100vw - 34px));',
        'max-height:calc(100dvh - 40px);',
        'overflow:auto;',
        'border-radius:30px;',
        'background:rgba(255,255,255,.98);',
        'box-shadow:0 34px 90px rgba(15,23,42,.42);',
        'border:2px solid rgba(255,255,255,.96);',
        'padding:24px;',
        'text-align:center;',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
        'color:#0f172a;',
      '}',
      '#gjSummaryEmergencyV850g .gj850g-icon{font-size:56px;line-height:1;}',
      '#gjSummaryEmergencyV850g h1{margin:8px 0 8px;font-size:clamp(31px,7vw,46px);line-height:1.05;font-weight:1000;}',
      '#gjSummaryEmergencyV850g p{margin:0 0 14px;color:#64748b;font-weight:900;line-height:1.35;font-size:15px;}',
      '#gjSummaryEmergencyV850g .gj850g-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;}',
      '#gjSummaryEmergencyV850g .gj850g-grid div{border:2px solid #e2e8f0;border-radius:18px;padding:12px;background:#fff;}',
      '#gjSummaryEmergencyV850g .gj850g-grid b{display:block;font-size:30px;font-weight:1000;}',
      '#gjSummaryEmergencyV850g .gj850g-grid span{display:block;color:#64748b;font-weight:900;font-size:13px;}',
      '#gjSummaryEmergencyV850g .gj850g-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;}',
      '#gjSummaryEmergencyV850g button{border:0;border-radius:18px;min-height:60px;font:1000 16px system-ui;color:#fff;cursor:pointer;padding:10px;}',
      '#gj850gReplay{background:linear-gradient(135deg,#22c55e,#16a34a);}',
      '#gj850gCooldown{background:linear-gradient(135deg,#38bdf8,#2563eb);}',
      '@media(max-width:520px){',
        '#gjSummaryEmergencyV850g{padding:12px;}',
        '#gjSummaryEmergencyV850g .gj850g-card{padding:20px;border-radius:26px;}',
        '#gjSummaryEmergencyV850g .gj850g-actions{grid-template-columns:1fr;}',
        '#gjSummaryEmergencyV850g h1{font-size:36px;}',
      '}'
    ].join('');

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    document.getElementById('gj850gReplay').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      location.href = replayUrl();
    }, true);

    document.getElementById('gj850gCooldown').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if(window.GJ_SOLO_BOSS_SHELL && typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'){
        window.GJ_SOLO_BOSS_SHELL.goCooldown({
          reason:'summary-emergency-v850g',
          score:data.score,
          accuracy:data.accuracy,
          goodHits:data.goodHits,
          bestCombo:data.combo
        });
        return;
      }

      location.href = cooldownUrl(data);
    }, true);

    try{
      localStorage.setItem('GJ_SUMMARY_EMERGENCY_V850G_LAST', JSON.stringify({
        patch: PATCH,
        reason: reason || '',
        data: data,
        savedAt: new Date().toISOString()
      }));
    }catch(e){}

    console.warn('[GoodJunk Summary Emergency V850G] shown', {
      reason: reason,
      data: data
    });
  }

  function check(reason){
    if(shown) return;

    var age = Date.now() - startedAt;

    /*
      4 วิพอ เพราะตอนนี้อาการคือ blur ค้างหลังจบทันที
    */
    if(age < 4000) return;

    if(hasClickableRealSummary()){
      return;
    }

    if(blurIsStuck()){
      show(reason || 'blur-stuck');
    }
  }

  function later(reason, ms){
    setTimeout(function(){
      check(reason);
    }, ms);
  }

  window.addEventListener('gj:reward-summary-shown', function(){
    later('event-reward-summary-500', 500);
    later('event-reward-summary-1500', 1500);
    later('event-reward-summary-3000', 3000);
  }, true);

  window.addEventListener('gj:boss-defeated', function(){
    later('event-boss-defeated-1000', 1000);
    later('event-boss-defeated-2500', 2500);
  }, true);

  document.addEventListener('click', function(){
    later('after-click-1200', 1200);
  }, true);

  try{
    new MutationObserver(function(){
      later('mutation-900', 900);
    }).observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','hidden','aria-hidden']
    });
  }catch(e){}

  setInterval(function(){
    check('interval');
  }, 1200);

  window.GJ_SUMMARY_EMERGENCY_V850G = {
    patch: PATCH,
    show: show,
    check: check,
    hasClickableRealSummary: hasClickableRealSummary,
    blurIsStuck: blurIsStuck
  };

  console.info('[GoodJunk Summary Emergency V850G] installed');
})();
