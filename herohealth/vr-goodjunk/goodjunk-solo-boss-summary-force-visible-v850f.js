/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-force-visible-v850f.js === */
/* PATCH v20260607-v850f
   Fix:
   - เกมจบแล้วจอ blur ค้าง แต่ summary ไม่ขึ้น
   - บังคับเปิด fallback summary ถ้า overlay/blur ค้างเกินเวลา
   - ไม่รอ bodyText อย่างเดียว
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SUMMARY-FORCE-VISIBLE-V850F';

  if(window.GJ_SUMMARY_FORCE_VISIBLE_V850F_LOADED){
    return;
  }
  window.GJ_SUMMARY_FORCE_VISIBLE_V850F_LOADED = true;

  var startedAt = Date.now();
  var forced = false;

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function q(name, fallback){
    var v = qs().get(name);
    return v === null || v === '' ? fallback : v;
  }

  function textOf(el){
    return String(
      el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute && el.getAttribute('aria-label') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function isVisible(el){
    if(!el) return false;

    try{
      var st = getComputedStyle(el);
      var r = el.getBoundingClientRect();

      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity || 1) > 0.02 &&
        r.width > 30 &&
        r.height > 30
      );
    }catch(e){
      return false;
    }
  }

  function hasRealSummary(){
    var nodes = Array.prototype.slice.call(document.querySelectorAll(
      '[id*="summary" i], [class*="summary" i], [id*="reward" i], [class*="reward" i], [role="dialog"], .modal'
    ));

    return nodes.some(function(el){
      if(!isVisible(el)) return false;

      var s = textOf(el);
      return (
        s.includes('เล่นอีกครั้ง') ||
        s.includes('Cooldown') ||
        s.includes('ชนะบอส') ||
        s.includes('เกือบชนะ') ||
        s.includes('คะแนน')
      );
    });
  }

  function pageLooksBlurredOrEnded(){
    var body = document.body;
    if(!body) return false;

    var bodyText = textOf(body);

    if(
      bodyText.includes('Boss Defeated') ||
      bodyText.includes('ชนะบอส') ||
      bodyText.includes('เกือบชนะ') ||
      bodyText.includes('เล่นอีกครั้ง') ||
      bodyText.includes('Cooldown') ||
      bodyText.includes('Boss') && bodyText.includes('Defeated')
    ){
      return true;
    }

    var blurred = false;

    try{
      Array.prototype.slice.call(document.querySelectorAll('*')).some(function(el){
        var st = getComputedStyle(el);
        var filter = String(st.filter || '');
        var backdrop = String(st.backdropFilter || st.webkitBackdropFilter || '');
        var opacity = Number(st.opacity || 1);
        var r = el.getBoundingClientRect();

        if(
          r.width > window.innerWidth * 0.5 &&
          r.height > window.innerHeight * 0.5 &&
          (
            filter.includes('blur') ||
            backdrop.includes('blur') ||
            opacity < 0.92
          )
        ){
          blurred = true;
          return true;
        }

        return false;
      });
    }catch(e){}

    return blurred;
  }

  function readLatest(){
    var keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_PC_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_RESULT',
      'GJ_LAST_SUMMARY'
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

  function makeLauncherUrl(){
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
    u.searchParams.set('entry', 'summary-force-v850f');

    return u.toString();
  }

  function makeReplayUrl(){
    var u = new URL(location.href);

    u.searchParams.set('run', 'play');
    u.searchParams.set('replay', String(Date.now()));
    u.searchParams.delete('phase');
    u.searchParams.delete('result');
    u.searchParams.delete('summary');

    return u.toString();
  }

  function showFallback(reason){
    if(forced) return;
    if(hasRealSummary()) return;

    forced = true;

    var old = document.getElementById('gjSummaryForceVisibleV850f');
    if(old) old.remove();

    var latest = readLatest();

    var score = Number(
      latest.score ||
      latest.points ||
      latest.totalScore ||
      window.GJ_SCORE ||
      0
    ) || 0;

    var accuracy = latest.accuracy || latest.acc || '';
    var goodHits = latest.goodHits || latest.good || latest.goodCount || '';
    var combo = latest.bestCombo || latest.combo || '';

    var title = score > 0 ? 'สรุปผล GoodJunk' : 'สรุปผลรอบนี้';
    var sub = score > 0
      ? 'เกมจบแล้ว ระบบแสดงผลสรุปสำรองให้เรียบร้อย'
      : 'เกมจบแล้ว แต่ระบบอ่านคะแนนหลักไม่ได้ จึงแสดงสรุปสำรอง';

    var overlay = document.createElement('div');
    overlay.id = 'gjSummaryForceVisibleV850f';

    overlay.innerHTML = [
      '<div class="gj850f-card">',
        '<div class="gj850f-cup">🏆</div>',
        '<h1>' + title + '</h1>',
        '<p>' + sub + '</p>',
        '<div class="gj850f-grid">',
          '<div><b>' + score + '</b><span>คะแนน</span></div>',
          '<div><b>' + (accuracy || '-') + '</b><span>ความแม่นยำ</span></div>',
          '<div><b>' + (goodHits || '-') + '</b><span>อาหารดี</span></div>',
          '<div><b>x' + (combo || 0) + '</b><span>คอมโบสูงสุด</span></div>',
        '</div>',
        '<div class="gj850f-actions">',
          '<button id="gj850fReplay" type="button">🔁 เล่นอีกครั้ง</button>',
          '<button id="gj850fCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>',
        '</div>',
      '</div>'
    ].join('');

    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:grid',
      'place-items:center',
      'padding:20px',
      'background:rgba(15,23,42,.48)',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'pointer-events:auto'
    ].join(';');

    var style = document.createElement('style');
    style.id = 'gjSummaryForceVisibleV850fStyle';
    style.textContent = [
      '#gjSummaryForceVisibleV850f *{box-sizing:border-box;}',
      '#gjSummaryForceVisibleV850f .gj850f-card{',
        'width:min(520px,calc(100vw - 34px));',
        'max-height:calc(100dvh - 40px);',
        'overflow:auto;',
        'border-radius:30px;',
        'background:rgba(255,255,255,.97);',
        'box-shadow:0 30px 90px rgba(15,23,42,.38);',
        'border:2px solid rgba(255,255,255,.94);',
        'padding:24px;',
        'text-align:center;',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
        'color:#0f172a;',
      '}',
      '#gjSummaryForceVisibleV850f .gj850f-cup{font-size:54px;line-height:1;}',
      '#gjSummaryForceVisibleV850f h1{margin:8px 0 6px;font-size:clamp(30px,7vw,44px);line-height:1.05;font-weight:1000;}',
      '#gjSummaryForceVisibleV850f p{margin:0 0 14px;color:#64748b;font-weight:900;line-height:1.35;}',
      '#gjSummaryForceVisibleV850f .gj850f-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;}',
      '#gjSummaryForceVisibleV850f .gj850f-grid div{border:2px solid #e2e8f0;border-radius:18px;padding:12px;background:#fff;}',
      '#gjSummaryForceVisibleV850f .gj850f-grid b{display:block;font-size:28px;font-weight:1000;}',
      '#gjSummaryForceVisibleV850f .gj850f-grid span{display:block;color:#64748b;font-weight:900;font-size:13px;}',
      '#gjSummaryForceVisibleV850f .gj850f-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;}',
      '#gjSummaryForceVisibleV850f button{border:0;border-radius:18px;min-height:58px;font:1000 16px system-ui;color:#fff;cursor:pointer;padding:10px;}',
      '#gj850fReplay{background:linear-gradient(135deg,#22c55e,#16a34a);}',
      '#gj850fCooldown{background:linear-gradient(135deg,#38bdf8,#2563eb);}',
      '@media(max-width:520px){',
        '#gjSummaryForceVisibleV850f{padding:14px;}',
        '#gjSummaryForceVisibleV850f .gj850f-card{padding:20px;border-radius:26px;}',
        '#gjSummaryForceVisibleV850f .gj850f-actions{grid-template-columns:1fr;}',
        '#gjSummaryForceVisibleV850f h1{font-size:34px;}',
      '}'
    ].join('');

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    document.getElementById('gj850fReplay').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      location.href = makeReplayUrl();
    });

    document.getElementById('gj850fCooldown').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if(window.GJ_SOLO_BOSS_SHELL && typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'){
        window.GJ_SOLO_BOSS_SHELL.goCooldown({
          reason:'force-visible-v850f',
          score:score,
          accuracy:accuracy,
          goodHits:goodHits,
          bestCombo:combo
        });
        return;
      }

      location.href = makeLauncherUrl();
    });

    try{
      localStorage.setItem('GJ_SUMMARY_FORCE_VISIBLE_V850F_LAST', JSON.stringify({
        patch: PATCH,
        reason: reason || '',
        score: score,
        accuracy: accuracy,
        goodHits: goodHits,
        combo: combo,
        savedAt: new Date().toISOString()
      }));
    }catch(e){}

    console.warn('[GoodJunk Summary Force Visible V850F] fallback shown', {
      reason: reason || '',
      score: score,
      accuracy: accuracy,
      goodHits: goodHits,
      combo: combo
    });
  }

  function check(reason){
    if(forced) return;
    if(hasRealSummary()) return;

    /*
      อย่าเปิดเร็วเกินไปตอนกำลังเล่น
      ต้องผ่านอย่างน้อย 6 วิ และเห็นลักษณะจอจบ/blur
    */
    var age = Date.now() - startedAt;

    if(age < 6000){
      return;
    }

    if(pageLooksBlurredOrEnded()){
      showFallback(reason || 'blur-ended-detected');
    }
  }

  function schedule(reason, delay){
    setTimeout(function(){
      check(reason);
    }, delay || 100);
  }

  window.addEventListener('gj:reward-summary-shown', function(){
    schedule('event-gj-reward-summary-shown', 300);
    schedule('event-gj-reward-summary-shown-1200', 1200);
    schedule('event-gj-reward-summary-shown-2500', 2500);
  }, true);

  window.addEventListener('gj:boss-defeated', function(){
    schedule('event-gj-boss-defeated', 500);
    schedule('event-gj-boss-defeated-2000', 2000);
  }, true);

  document.addEventListener('click', function(){
    schedule('after-click', 1000);
  }, true);

  try{
    new MutationObserver(function(){
      schedule('mutation', 800);
    }).observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','hidden','aria-hidden']
    });
  }catch(e){}

  setInterval(function(){
    check('interval-check');
  }, 1500);

  window.GJ_SUMMARY_FORCE_VISIBLE_V850F = {
    patch: PATCH,
    check: check,
    showFallback: showFallback,
    hasRealSummary: hasRealSummary
  };

  console.info('[GoodJunk Summary Force Visible V850F] installed');
})();
