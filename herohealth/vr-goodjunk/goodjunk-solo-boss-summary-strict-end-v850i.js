/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-strict-end-v850i.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-STRICT-END-V850I
   เป้าหมาย:
   - กัน summary ขึ้นเร็วเกินไป
   - ไม่เปิด summary จาก interval / blur / text-detected / small score
   - เปิด summary เฉพาะเมื่อจบจริง:
      1) boss defeated จริง + เล่นจริงพอสมควร
      2) time up จริง
      3) lives หมดจริง
   - ล้าง summary เก่าที่ซ้อนกันให้เหลือชั้นเดียว
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-STRICT-END-V850I';

  if(window.GJ_SUMMARY_STRICT_END_V850I_LOADED){
    return;
  }
  window.GJ_SUMMARY_STRICT_END_V850I_LOADED = true;

  var qs = new URLSearchParams(location.search || '');

  function num(v, d){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  var GAME_TIME = Math.max(45, num(qs.get('time'), 90));
  var startedAt = Date.now();
  var armedAt = startedAt + 12000; // ห้าม summary ก่อน 12 วิแรกเด็ดขาด
  var shown = false;

  var MIN_REAL_SECONDS = 18;
  var MIN_GOOD_HITS_FOR_BOSS_WIN = 12;
  var MIN_SCORE_FOR_BOSS_WIN = 180;

  function textOf(el){
    return String(
      el && (
        el.textContent ||
        el.getAttribute && el.getAttribute('aria-label') ||
        el.getAttribute && el.getAttribute('title') ||
        ''
      ) || ''
    ).replace(/\s+/g,' ').trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '')
      .replace(/\s+/g,' ')
      .trim();
  }

  function readState(){
    var text = pageText();

    var scoreEl = document.getElementById('gjmScore');
    var comboEl = document.getElementById('gjmCombo');
    var timeEl = document.getElementById('gjmTime');
    var livesEl = document.getElementById('gjmLives');

    var score = num(scoreEl && scoreEl.textContent, 0);
    var combo = num(String(comboEl && comboEl.textContent || '').replace(/[^\d.-]/g,''), 0);
    var timeLeft = num(timeEl && timeEl.textContent, GAME_TIME);
    var livesText = textOf(livesEl);
    var lives = (livesText.match(/💚/g) || []).length;

    var goodHits = 0;
    var junkHits = 0;
    var fakeHits = 0;
    var miss = 0;

    try{
      var keys = [
        'GJ_SOLO_BOSS_LAST_SUMMARY',
        'GJ_FULL_3D_VR_LAST_SUMMARY',
        'GJ_SOLO_BOSS_STATE',
        'GJ_SOLO_BOSS_STATS'
      ];

      keys.forEach(function(k){
        try{
          var o = JSON.parse(localStorage.getItem(k) || '{}') || {};
          goodHits = Math.max(goodHits, num(o.goodHits ?? o.good ?? o.goodCount, 0));
          junkHits = Math.max(junkHits, num(o.junkHits ?? o.junk ?? o.junkCount, 0));
          fakeHits = Math.max(fakeHits, num(o.fakeHits ?? o.fake ?? o.fakeCount, 0));
          miss = Math.max(miss, num(o.miss ?? o.misses, 0));
          score = Math.max(score, num(o.score, score));
          combo = Math.max(combo, num(o.combo ?? o.bestCombo, combo));
        }catch(_){}
      });
    }catch(_){}

    var elapsedSec = Math.floor((Date.now() - startedAt) / 1000);

    var bossText =
      /Boss Defeated/i.test(text) ||
      /ชนะบอสแล้ว/i.test(text) ||
      /ชนะบอสแบบสุดยอด/i.test(text) ||
      /บอสถูกกำจัด/i.test(text);

    var timeUpText =
      /หมดเวลา/i.test(text) ||
      /Time Up/i.test(text);

    var livesOutText =
      /พลังหมด/i.test(text) ||
      /lives out/i.test(text) ||
      /game over/i.test(text);

    return {
      score:score,
      combo:combo,
      timeLeft:timeLeft,
      lives:lives,
      goodHits:goodHits,
      junkHits:junkHits,
      fakeHits:fakeHits,
      miss:miss,
      elapsedSec:elapsedSec,
      bossText:bossText,
      timeUpText:timeUpText,
      livesOutText:livesOutText,
      rawText:text
    };
  }

  function isRealEnd(s){
    if(Date.now() < armedAt){
      return {
        ok:false,
        reason:'not-armed-yet'
      };
    }

    if(s.timeLeft <= 0 || s.timeUpText){
      return {
        ok:true,
        reason:'time-up'
      };
    }

    if(s.lives <= 0 && s.elapsedSec >= 10){
      return {
        ok:true,
        reason:'lives-out'
      };
    }

    if(s.bossText){
      if(s.elapsedSec < MIN_REAL_SECONDS){
        return {
          ok:false,
          reason:'boss-text-too-early'
        };
      }

      if(s.goodHits < MIN_GOOD_HITS_FOR_BOSS_WIN && s.score < MIN_SCORE_FOR_BOSS_WIN){
        return {
          ok:false,
          reason:'boss-text-but-not-enough-play'
        };
      }

      return {
        ok:true,
        reason:'boss-defeated-real'
      };
    }

    return {
      ok:false,
      reason:'not-ended'
    };
  }

  function removeOldSummaryLayers(){
    var selectors = [
      '#gjrOverlay',
      '#gjRewardOverlay',
      '#gjSummaryOverlay',
      '#gjSummaryModal',
      '#gjFinalSummary',
      '.gjr-overlay',
      '.gj-summary-overlay',
      '.gj-final-summary',
      '[data-gj-summary]',
      '[data-goodjunk-summary]',
      '[data-summary-layer]'
    ];

    selectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        try{ el.remove(); }catch(_){}
      });
    });
  }

  function starsFromState(s){
    if(s.score >= 800 && s.goodHits >= 18) return '⭐⭐⭐⭐⭐';
    if(s.score >= 520 && s.goodHits >= 14) return '⭐⭐⭐⭐';
    if(s.score >= 280 && s.goodHits >= 9) return '⭐⭐⭐';
    if(s.score >= 120 && s.goodHits >= 5) return '⭐⭐';
    return '⭐';
  }

  function rankFromState(s){
    if(s.score >= 800 && s.goodHits >= 18) return 'Legend Hero';
    if(s.score >= 520 && s.goodHits >= 14) return 'Nutrition Champion';
    if(s.score >= 280 && s.goodHits >= 9) return 'Food Hero';
    if(s.score >= 120 && s.goodHits >= 5) return 'Good Choice Hero';
    return 'Food Learner';
  }

  function accuracyFromState(s){
    var total = s.goodHits + s.junkHits + s.fakeHits + s.miss;
    if(total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((s.goodHits / total) * 100)));
  }

  function buildCooldownUrl(s){
    var base = 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html';
    var launcher = 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

    var u = new URL(base);

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo_boss');
    u.searchParams.set('phase', 'cooldown');

    u.searchParams.set('pid', qs.get('pid') || 'anon');
    u.searchParams.set('name', qs.get('name') || qs.get('nick') || 'Hero');
    u.searchParams.set('diff', qs.get('diff') || 'normal');
    u.searchParams.set('time', qs.get('time') || '90');
    u.searchParams.set('view', qs.get('view') || 'mobile');

    u.searchParams.set('hub', launcher);
    u.searchParams.set('next', launcher);
    u.searchParams.set('back', launcher);
    u.searchParams.set('launcher', launcher);
    u.searchParams.set('return', launcher);
    u.searchParams.set('returnUrl', launcher);

    u.searchParams.set('score', String(s.score || 0));
    u.searchParams.set('goodHits', String(s.goodHits || 0));
    u.searchParams.set('junkHits', String(s.junkHits || 0));
    u.searchParams.set('fakeHits', String(s.fakeHits || 0));
    u.searchParams.set('miss', String(s.miss || 0));
    u.searchParams.set('bestCombo', String(s.combo || 0));
    u.searchParams.set('accuracy', String(accuracyFromState(s)));
    u.searchParams.set('rank', rankFromState(s));
    u.searchParams.set('stars', starsFromState(s));
    u.searchParams.set('from', 'goodjunk-summary-strict-end-v850i');

    return u.toString();
  }

  function buildLauncherUrl(){
    var u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html');

    u.searchParams.set('pid', qs.get('pid') || 'anon');
    u.searchParams.set('name', qs.get('name') || qs.get('nick') || 'Hero');
    u.searchParams.set('diff', qs.get('diff') || 'normal');
    u.searchParams.set('time', qs.get('time') || '90');
    u.searchParams.set('view', qs.get('view') || 'mobile');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'summary-return');

    return u.toString();
  }

  function showSummary(s, reason){
    if(shown) return;
    shown = true;

    removeOldSummaryLayers();

    var acc = accuracyFromState(s);
    var stars = starsFromState(s);
    var rank = rankFromState(s);

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify({
        patch:PATCH,
        reason:reason,
        score:s.score,
        accuracy:acc,
        goodHits:s.goodHits,
        junkHits:s.junkHits,
        fakeHits:s.fakeHits,
        miss:s.miss,
        bestCombo:s.combo,
        rank:rank,
        stars:stars,
        savedAt:new Date().toISOString()
      }));
    }catch(_){}

    var overlay = document.createElement('section');
    overlay.id = 'gjStrictSummaryV850I';
    overlay.setAttribute('data-goodjunk-summary', 'strict-v850i');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:grid',
      'place-items:center',
      'padding:18px',
      'background:rgba(15,23,42,.48)',
      'backdrop-filter:blur(8px)',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    overlay.innerHTML =
      '<div style="width:min(520px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;border-radius:30px;background:rgba(255,255,255,.96);box-shadow:0 28px 80px rgba(15,23,42,.34);padding:22px;text-align:center;color:#111827;">' +
        '<div style="font-size:54px;line-height:1;">🏆</div>' +
        '<h1 style="margin:8px 0 0;font-size:clamp(30px,7vw,46px);line-height:1.05;font-weight:1000;">สรุปผล GoodJunk</h1>' +
        '<div style="margin:8px 0 2px;font-size:25px;">' + stars + '</div>' +
        '<p style="margin:8px auto 14px;color:#64748b;font-weight:900;">จบเกมแล้ว แสดงผลหลังเล่นจริง</p>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px;">' +
          card(s.score, 'คะแนน') +
          card(acc + '%', 'ความแม่นยำ') +
          card(s.goodHits, 'อาหารดี') +
          card('x' + s.combo, 'คอมโบสูงสุด') +
          card(s.junkHits, 'แตะ junk') +
          card(rank, 'Rank') +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">' +
          '<button id="gjStrictReplayBtn" type="button" style="min-height:58px;border:0;border-radius:18px;background:linear-gradient(180deg,#22c55e,#16a34a);color:white;font-size:16px;font-weight:1000;">🔁 เล่นอีกครั้ง</button>' +
          '<button id="gjStrictCooldownBtn" type="button" style="min-height:58px;border:0;border-radius:18px;background:linear-gradient(180deg,#38bdf8,#2563eb);color:white;font-size:16px;font-weight:1000;">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</div>';

    document.documentElement.appendChild(overlay);

    var replayBtn = document.getElementById('gjStrictReplayBtn');
    var cooldownBtn = document.getElementById('gjStrictCooldownBtn');

    if(replayBtn){
      replayBtn.addEventListener('click', function(){
        var u = new URL(location.href);
        u.searchParams.set('x', 'replay-' + Date.now());
        u.searchParams.set('run', 'play');
        u.searchParams.set('phase', 'main');
        location.href = u.toString();
      });
    }

    if(cooldownBtn){
      cooldownBtn.addEventListener('click', function(){
        location.href = buildCooldownUrl(s);
      });
    }

    console.info('[GoodJunk Summary Strict End v850i] shown', {
      patch:PATCH,
      reason:reason,
      state:s
    });
  }

  function card(value, label){
    return (
      '<div style="border:2px solid #e5e7eb;border-radius:18px;padding:12px 8px;background:linear-gradient(180deg,#fff,#f8fafc);min-height:72px;display:grid;place-items:center;">' +
        '<b style="font-size:26px;line-height:1;color:#0f172a;">' + esc(value) + '</b>' +
        '<span style="display:block;margin-top:4px;color:#64748b;font-size:12px;font-weight:1000;">' + esc(label) + '</span>' +
      '</div>'
    );
  }

  function esc(v){
    return String(v ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function tick(){
    if(shown) return;

    var s = readState();
    var decision = isRealEnd(s);

    if(decision.ok){
      showSummary(s, decision.reason);
    }else{
      if(decision.reason !== 'not-ended'){
        console.warn('[GoodJunk Summary Strict End v850i] blocked early summary', {
          reason:decision.reason,
          state:s
        });
      }
    }
  }

  /*
    กัน event เก่าที่เปิด summary เร็ว:
    ไม่ให้ event summary ภายใน core เรียก summary ซ้อนก่อนเวลาจริง
  */
  window.addEventListener('gj:reward-summary-shown', function(ev){
    var s = readState();
    var d = isRealEnd(s);

    if(!d.ok){
      try{
        ev.stopImmediatePropagation();
        ev.stopPropagation();
      }catch(_){}

      removeOldSummaryLayers();

      console.warn('[GoodJunk Summary Strict End v850i] removed early reward summary', {
        reason:d.reason,
        state:s
      });
    }
  }, true);

  window.addEventListener('gj:game-over', function(){
    setTimeout(tick, 120);
    setTimeout(tick, 500);
  }, true);

  window.addEventListener('gj:boss-defeated', function(){
    setTimeout(tick, 120);
    setTimeout(tick, 500);
    setTimeout(tick, 1200);
  }, true);

  setInterval(tick, 1200);

  setTimeout(tick, 5000);
  setTimeout(tick, 9000);
  setTimeout(tick, 13000);

  console.info('[GoodJunk Summary Strict End v850i] installed');
})();
