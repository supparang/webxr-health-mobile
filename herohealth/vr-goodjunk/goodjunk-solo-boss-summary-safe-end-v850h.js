/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-safe-end-v850h.js === */
/* PATCH v20260607-v850h
   Purpose:
   - แทน v850g ที่ trigger เร็วเกินไป
   - ไม่ใช้ blur เป็นเงื่อนไขจบเกมอีกแล้ว
   - summary จะขึ้นเมื่อมี end condition จริงเท่านั้น:
     1) boss defeated จริง
     2) time หมดจริง
     3) event reward-summary-shown จริง
     4) มีปุ่ม summary จริงแต่ถูกซ่อนหลัง overlay
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SUMMARY-SAFE-END-V850H';

  if(window.GJ_SUMMARY_SAFE_END_V850H_LOADED){
    return;
  }
  window.GJ_SUMMARY_SAFE_END_V850H_LOADED = true;

  var gameStartedAt = Date.now();
  var ended = false;
  var showing = false;

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

  function visible(el){
    if(!el) return false;

    try{
      var st = getComputedStyle(el);
      var r = el.getBoundingClientRect();

      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity || 1) > 0.05 &&
        r.width > 20 &&
        r.height > 20
      );
    }catch(e){
      return false;
    }
  }

  function numFromText(s){
    var n = Number(String(s || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function getScore(){
    var ids = ['gjmScore','score','scoreText'];
    for(var i = 0; i < ids.length; i++){
      var el = document.getElementById(ids[i]);
      if(el){
        var n = numFromText(textOf(el));
        if(n > 0) return n;
      }
    }

    try{
      var latest = readLatest();
      return Number(latest.score || latest.points || latest.totalScore || 0) || 0;
    }catch(e){
      return 0;
    }
  }

  function getCombo(){
    var el = document.getElementById('gjmCombo');
    if(el){
      return numFromText(textOf(el));
    }

    var latest = readLatest();
    return Number(latest.combo || latest.bestCombo || 0) || 0;
  }

  function getTimeLeft(){
    var el = document.getElementById('gjmTime');
    if(!el) return null;

    var n = numFromText(textOf(el));
    return Number.isFinite(n) ? n : null;
  }

  function bossLooksDead(){
    var bodyText = textOf(document.body).toLowerCase();

    if(bodyText.includes('boss defeated')) return true;
    if(bodyText.includes('ชนะบอสแล้ว')) return true;
    if(bodyText.includes('ชนะบอส')) return true;
    if(bodyText.includes('บอสพ่ายแพ้')) return true;
    if(bodyText.includes('ชนะบอสแบบสุดยอด')) return true;

    try{
      var bossBars = Array.prototype.slice.call(document.querySelectorAll('*'));
      return bossBars.some(function(el){
        if(!visible(el)) return false;

        var s = textOf(el).toLowerCase();
        var cls = String(el.className || '').toLowerCase();
        var id = String(el.id || '').toLowerCase();

        return (
          (id.includes('boss') || cls.includes('boss')) &&
          (
            s.includes('defeated') ||
            s.includes('ชนะ') ||
            s.includes('พ่ายแพ้') ||
            s.includes('0%')
          )
        );
      });
    }catch(e){
      return false;
    }
  }

  function realSummaryExists(){
    var buttons = Array.prototype.slice.call(document.querySelectorAll(
      'button,a,[role="button"]'
    ));

    return buttons.some(function(el){
      if(!visible(el)) return false;

      var s = textOf(el);
      var r = el.getBoundingClientRect();

      if(r.width < 80 || r.height < 36) return false;

      return (
        s.includes('เล่นอีกครั้ง') ||
        s.includes('Cooldown') ||
        s.includes('คูลดาวน์')
      );
    });
  }

  function readLatest(){
    var keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_RESULT',
      'GJ_LAST_SUMMARY',
      'GJ_SUMMARY_EMERGENCY_V850G_LAST',
      'GJ_SUMMARY_FORCE_VISIBLE_V850F_LAST'
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
        if(obj.data) return obj.data;
        return obj;
      }catch(e){}
    }

    return {};
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
    u.searchParams.set('entry', 'summary-safe-end-v850h');

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
    u.searchParams.set('from', 'summary-safe-end-v850h');

    return u.toString();
  }

  function removeDuplicateSummaries(){
    var keep = null;

    var candidates = Array.prototype.slice.call(document.querySelectorAll(
      '#gjSummaryEmergencyV850g,' +
      '#gjSummaryForceVisibleV850f,' +
      '#gjSummarySafeEndV850h,' +
      '.gjr-modal,' +
      '.gjr-overlay,' +
      '[data-gj-summary]'
    ));

    candidates.forEach(function(el){
      if(!el || !el.parentNode) return;

      if(el.id === 'gjSummarySafeEndV850h'){
        keep = el;
        return;
      }

      try{
        el.remove();
      }catch(e){}
    });

    return keep;
  }

  function showSummary(reason){
    if(showing) return;
    showing = true;
    ended = true;

    removeDuplicateSummaries();

    if(realSummaryExists() && !document.getElementById('gjSummarySafeEndV850h')){
      console.info('[GoodJunk Summary Safe End V850H] real summary already exists');
      return;
    }

    var latest = readLatest();

    var score = Number(
      latest.score ||
      latest.points ||
      latest.totalScore ||
      getScore() ||
      0
    ) || 0;

    var accuracy = latest.accuracy || latest.acc || '';
    var goodHits = latest.goodHits || latest.good || latest.goodCount || '';
    var combo = latest.bestCombo || latest.combo || getCombo() || '';

    var data = {
      score: score,
      accuracy: accuracy || 0,
      goodHits: goodHits || 0,
      combo: combo || 0
    };

    var old = document.getElementById('gjSummarySafeEndV850h');
    if(old) old.remove();

    var styleOld = document.getElementById('gjSummarySafeEndV850hStyle');
    if(styleOld) styleOld.remove();

    var style = document.createElement('style');
    style.id = 'gjSummarySafeEndV850hStyle';
    style.textContent = [
      '#gjSummarySafeEndV850h *{box-sizing:border-box;}',
      '#gjSummarySafeEndV850h{',
        'position:fixed;',
        'inset:0;',
        'z-index:2147483647;',
        'display:grid;',
        'place-items:center;',
        'padding:18px;',
        'background:rgba(15,23,42,.52);',
        'backdrop-filter:blur(10px);',
        '-webkit-backdrop-filter:blur(10px);',
        'pointer-events:auto;',
      '}',
      '#gjSummarySafeEndV850h .card{',
        'width:min(560px,calc(100vw - 34px));',
        'max-height:calc(100dvh - 40px);',
        'overflow:auto;',
        'border-radius:32px;',
        'background:rgba(255,255,255,.98);',
        'box-shadow:0 34px 90px rgba(15,23,42,.42);',
        'border:2px solid rgba(255,255,255,.96);',
        'padding:24px;',
        'text-align:center;',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
        'color:#0f172a;',
      '}',
      '#gjSummarySafeEndV850h .icon{font-size:58px;line-height:1;}',
      '#gjSummarySafeEndV850h h1{margin:8px 0 8px;font-size:clamp(32px,7vw,48px);line-height:1.05;font-weight:1000;}',
      '#gjSummarySafeEndV850h p{margin:0 0 14px;color:#64748b;font-weight:900;line-height:1.35;font-size:15px;}',
      '#gjSummarySafeEndV850h .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;}',
      '#gjSummarySafeEndV850h .grid div{border:2px solid #e2e8f0;border-radius:18px;padding:12px;background:#fff;}',
      '#gjSummarySafeEndV850h .grid b{display:block;font-size:30px;font-weight:1000;}',
      '#gjSummarySafeEndV850h .grid span{display:block;color:#64748b;font-weight:900;font-size:13px;}',
      '#gjSummarySafeEndV850h .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;}',
      '#gjSummarySafeEndV850h button{border:0;border-radius:18px;min-height:62px;font:1000 16px system-ui;color:#fff;cursor:pointer;padding:10px;}',
      '#gj850hReplay{background:linear-gradient(135deg,#22c55e,#16a34a);}',
      '#gj850hCooldown{background:linear-gradient(135deg,#38bdf8,#2563eb);}',
      '@media(max-width:520px){',
        '#gjSummarySafeEndV850h{padding:12px;}',
        '#gjSummarySafeEndV850h .card{padding:20px;border-radius:28px;}',
        '#gjSummarySafeEndV850h .actions{grid-template-columns:1fr;}',
        '#gjSummarySafeEndV850h h1{font-size:36px;}',
      '}'
    ].join('');

    var overlay = document.createElement('div');
    overlay.id = 'gjSummarySafeEndV850h';
    overlay.setAttribute('data-gj-summary', 'safe-end-v850h');

    overlay.innerHTML = [
      '<div class="card" role="dialog" aria-modal="true">',
        '<div class="icon">🏆</div>',
        '<h1>สรุปผล GoodJunk</h1>',
        '<p>จบเกมแล้ว แสดงผลหลังเล่นจริง</p>',
        '<div class="grid">',
          '<div><b>' + score + '</b><span>คะแนน</span></div>',
          '<div><b>' + (accuracy || '-') + '</b><span>ความแม่นยำ</span></div>',
          '<div><b>' + (goodHits || '-') + '</b><span>อาหารดี</span></div>',
          '<div><b>x' + (combo || 0) + '</b><span>คอมโบสูงสุด</span></div>',
        '</div>',
        '<div class="actions">',
          '<button id="gj850hReplay" type="button">🔁 เล่นอีกครั้ง</button>',
          '<button id="gj850hCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>',
        '</div>',
      '</div>'
    ].join('');

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    document.getElementById('gj850hReplay').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      location.href = replayUrl();
    }, true);

    document.getElementById('gj850hCooldown').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if(window.GJ_SOLO_BOSS_SHELL && typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'){
        window.GJ_SOLO_BOSS_SHELL.goCooldown({
          reason:'summary-safe-end-v850h',
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
      localStorage.setItem('GJ_SUMMARY_SAFE_END_V850H_LAST', JSON.stringify({
        patch: PATCH,
        reason: reason || '',
        data: data,
        savedAt: new Date().toISOString()
      }));
    }catch(e){}

    console.warn('[GoodJunk Summary Safe End V850H] shown', {
      reason: reason,
      data: data
    });
  }

  function canEndByTime(){
    var t = getTimeLeft();

    if(t === null) return false;
    return t <= 0;
  }

  function canEndByBoss(){
    /*
      กันไม่ให้ขึ้นตอนตีแค่ 1-4 ครั้ง:
      ต้องเล่นมาอย่างน้อย 12 วินาที และมีคะแนน/คอมโบเกิดขึ้นจริง
    */
    var age = Date.now() - gameStartedAt;
    if(age < 12000) return false;

    if(!bossLooksDead()) return false;

    return true;
  }

  function check(reason){
    if(showing) return;
    if(realSummaryExists()) return;

    if(canEndByTime()){
      showSummary(reason || 'time-ended');
      return;
    }

    if(canEndByBoss()){
      showSummary(reason || 'boss-ended');
      return;
    }
  }

  window.addEventListener('gj:reward-summary-shown', function(){
    setTimeout(function(){
      showSummary('event-reward-summary-shown');
    }, 350);
  }, true);

  window.addEventListener('gj:boss-defeated', function(){
    setTimeout(function(){
      check('event-boss-defeated');
    }, 1200);
  }, true);

  window.addEventListener('gj:game-ended', function(){
    setTimeout(function(){
      showSummary('event-game-ended');
    }, 500);
  }, true);

  setInterval(function(){
    check('interval');
  }, 1500);

  window.GJ_SUMMARY_SAFE_END_V850H = {
    patch: PATCH,
    showSummary: showSummary,
    check: check,
    bossLooksDead: bossLooksDead,
    realSummaryExists: realSummaryExists
  };

  console.info('[GoodJunk Summary Safe End V850H] installed');
})();
