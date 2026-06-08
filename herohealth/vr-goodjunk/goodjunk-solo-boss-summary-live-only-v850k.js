/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-live-only-v850k.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-LIVE-ONLY-V850K
   หน้าที่:
   - เปิด summary จากผลรอบปัจจุบันเท่านั้น
   - ไม่ restore ค่าเก่าจาก localStorage
   - กัน summary ซ้อน
   - กันค่าซ้ำ 702 / 50 / x11 ที่ค้างจากรอบก่อน
   - ไม่เปิด summary ถ้ายังไม่มีการเล่นจริง
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-LIVE-ONLY-V850K';

  if(window.GJ_SUMMARY_LIVE_ONLY_V850K_LOADED){
    return;
  }
  window.GJ_SUMMARY_LIVE_ONLY_V850K_LOADED = true;

  var qs = new URLSearchParams(location.search || '');
  var startedAt = Date.now();

  var live = {
    patch: PATCH,
    startedAt: startedAt,
    started: false,
    ended: false,
    summaryOpen: false,
    score: 0,
    goodHits: 0,
    junkHits: 0,
    fakeHits: 0,
    miss: 0,
    combo: 0,
    bestCombo: 0,
    clicks: 0,
    firstPlayAt: 0,
    lastPlayAt: 0
  };

  window.GJ_LIVE_SUMMARY_V850K = live;

  /*
    ล้างค่าค้างเฉพาะ summary restore ของ GoodJunk
    ไม่ล้างค่ารวมโปรไฟล์/เหรียญระยะยาว
  */
  function clearStaleSummary(){
    try{
      [
        'GJ_SOLO_BOSS_LAST_SUMMARY',
        'GJ_FULL_3D_VR_LAST_SUMMARY',
        'GJ_SOLO_BOSS_PC_COOLDOWN_TARGET_LAST',
        'GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST',
        'GJ_SUMMARY_RESTORE_V849F',
        'GJ_SUMMARY_RESTORE_V849K',
        'GJ_LAST_SUMMARY',
        'HHA_LAST_SUMMARY'
      ].forEach(function(k){
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    }catch(_){}
  }

  clearStaleSummary();

  function textOf(el){
    return String(
      el && (
        el.textContent ||
        el.getAttribute && el.getAttribute('aria-label') ||
        el.getAttribute && el.getAttribute('title') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function numberFromText(s){
    var m = String(s || '').match(/-?\d+/);
    return m ? Number(m[0]) || 0 : 0;
  }

  function readHudNumber(id, fallback){
    var el = document.getElementById(id);
    if(!el) return fallback || 0;
    return numberFromText(el.textContent);
  }

  function markPlay(reason){
    live.started = true;
    live.lastPlayAt = Date.now();
    if(!live.firstPlayAt) live.firstPlayAt = live.lastPlayAt;

    if(reason){
      live.lastReason = reason;
    }
  }

  /*
    จับการเล่นจริงจาก click/pointer/touch บนอาหาร
  */
  document.addEventListener('pointerdown', function(ev){
    var el = ev.target && ev.target.closest
      ? ev.target.closest('.gjpu-item,.food,.target,[data-food],[data-kind],[data-type],button')
      : null;

    if(!el) return;

    var label = textOf(el).toLowerCase();

    if(
      label.includes('เล่นอีกครั้ง') ||
      label.includes('cooldown') ||
      label.includes('กลับ') ||
      label.includes('summary')
    ){
      return;
    }

    live.clicks += 1;
    markPlay('pointerdown');
  }, true);

  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest
      ? ev.target.closest('.gjpu-item,.food,.target,[data-food],[data-kind],[data-type],button')
      : null;

    if(!el) return;

    var label = textOf(el).toLowerCase();

    if(
      label.includes('เล่นอีกครั้ง') ||
      label.includes('cooldown') ||
      label.includes('กลับ') ||
      label.includes('summary')
    ){
      return;
    }

    live.clicks += 1;
    markPlay('click');
  }, true);

  /*
    ฟัง event ถ้ามีไฟล์หลักยิงมา
  */
  [
    'gj:hit',
    'gj:good-hit',
    'gj:junk-hit',
    'gj:fake-hit',
    'gj:score',
    'gj:combo',
    'gj:boss-hit',
    'gj:game-start',
    'gj:game-over',
    'gj:boss-defeated',
    'gj:summary-request'
  ].forEach(function(name){
    window.addEventListener(name, function(ev){
      var d = ev && ev.detail ? ev.detail : {};

      if(name !== 'gj:summary-request'){
        markPlay(name);
      }

      if(name === 'gj:good-hit' || d.kind === 'good' || d.type === 'good'){
        live.goodHits += 1;
      }

      if(name === 'gj:junk-hit' || d.kind === 'junk' || d.type === 'junk'){
        live.junkHits += 1;
        live.miss += 1;
      }

      if(name === 'gj:fake-hit' || d.kind === 'fake' || d.type === 'fake'){
        live.fakeHits += 1;
      }

      if(typeof d.score !== 'undefined'){
        live.score = Math.max(live.score, Number(d.score) || 0);
      }

      if(typeof d.combo !== 'undefined'){
        live.combo = Number(d.combo) || 0;
        live.bestCombo = Math.max(live.bestCombo, live.combo);
      }

      if(name === 'gj:game-over' || name === 'gj:boss-defeated' || name === 'gj:summary-request'){
        requestSummary(name, d);
      }
    }, true);
  });

  function scanLiveMetrics(){
    var scoreHud = readHudNumber('gjmScore', 0);
    var comboHud = readHudNumber('gjmCombo', 0);

    live.score = Math.max(live.score, scoreHud);
    live.combo = Math.max(live.combo, comboHud);
    live.bestCombo = Math.max(live.bestCombo, comboHud);

    /*
      อ่านจาก DOM เฉพาะอาหารที่ถูก mark ว่า collected/hit จริง
      ไม่อ่านจำนวน card ทั้งหมดบนจอ
    */
    try{
      var goodNodes = document.querySelectorAll(
        '[data-hit="good"],[data-collected="good"],.gj-good-hit,.good-hit'
      );
      if(goodNodes.length > live.goodHits){
        live.goodHits = goodNodes.length;
      }

      var junkNodes = document.querySelectorAll(
        '[data-hit="junk"],[data-collected="junk"],.gj-junk-hit,.junk-hit'
      );
      if(junkNodes.length > live.junkHits){
        live.junkHits = junkNodes.length;
      }
    }catch(_){}
  }

  function elapsedSec(){
    var base = live.firstPlayAt || startedAt;
    return Math.max(0, Math.round((Date.now() - base) / 1000));
  }

  function hasRealPlay(){
    scanLiveMetrics();

    return (
      live.started &&
      live.clicks >= 3 &&
      elapsedSec() >= 8 &&
      (
        live.score > 0 ||
        live.goodHits > 0 ||
        live.junkHits > 0 ||
        live.bestCombo > 0
      )
    );
  }

  function shouldAllowSummary(reason, detail){
    detail = detail || {};
    scanLiveMetrics();

    if(live.summaryOpen) return false;

    if(detail.force === true || detail.realEnd === true){
      return hasRealPlay();
    }

    /*
      กันจบเร็วจากข้อความ boss / toast / candidate
    */
    if(!hasRealPlay()){
      console.warn('[GoodJunk Summary Live Only v850k] block stale/early summary', {
        reason: reason,
        live: Object.assign({}, live),
        elapsed: elapsedSec()
      });
      return false;
    }

    /*
      ถ้าเวลายังน้อยเกินไป และยังเก็บน้อย ไม่ให้ขึ้น summary
    */
    if(elapsedSec() < 20 && live.goodHits < 8 && live.score < 120){
      console.warn('[GoodJunk Summary Live Only v850k] block too early', {
        reason: reason,
        elapsed: elapsedSec(),
        goodHits: live.goodHits,
        score: live.score
      });
      return false;
    }

    return true;
  }

  function starsFromAccuracy(acc){
    if(acc >= 95) return 5;
    if(acc >= 85) return 4;
    if(acc >= 70) return 3;
    if(acc >= 50) return 2;
    return 1;
  }

  function rankFrom(score, acc, goodHits){
    if(acc >= 90 && goodHits >= 18) return 'Nutrition Champion';
    if(acc >= 75 && goodHits >= 12) return 'Food Hero';
    if(acc >= 55 && goodHits >= 8) return 'Good Choice Hero';
    return 'Food Learner';
  }

  function calcSummary(){
    scanLiveMetrics();

    var totalAction = Math.max(1, live.goodHits + live.junkHits + live.fakeHits + live.miss);
    var acc = Math.round((live.goodHits / totalAction) * 100);

    /*
      ถ้า event goodHits ไม่มา แต่ score/combo มา ให้ประเมินแบบ conservative
      ไม่ให้เด้งเป็น 50 อีก
    */
    var goodHits = live.goodHits;
    if(goodHits <= 0 && live.score > 0){
      goodHits = Math.max(1, Math.min(30, Math.round(live.score / 18)));
    }

    goodHits = Math.max(0, Math.min(40, goodHits));

    var score = Math.max(live.score, goodHits * 14 - live.junkHits * 8 - live.fakeHits * 4);
    score = Math.max(0, Math.round(score));

    var accuracy = live.goodHits > 0
      ? Math.max(0, Math.min(100, acc))
      : Math.max(0, Math.min(100, goodHits > 0 ? 80 : 0));

    var stars = starsFromAccuracy(accuracy);
    var rank = rankFrom(score, accuracy, goodHits);

    return {
      patch: PATCH,
      score: score,
      accuracy: accuracy,
      goodHits: goodHits,
      junkHits: live.junkHits,
      fakeHits: live.fakeHits,
      miss: live.miss,
      combo: live.bestCombo,
      bestCombo: live.bestCombo,
      stars: stars,
      rank: rank,
      coins: Math.max(20, Math.round(score / 6)),
      elapsedSec: elapsedSec(),
      realPlay: true,
      savedAt: new Date().toISOString()
    };
  }

  function removeOldSummaries(){
    try{
      document.querySelectorAll(
        '.gjr-overlay,.gjr-modal,.gj-summary,.gj-summary-overlay,.gjSummary,.summaryOverlay,[data-gj-summary],[data-summary-owner]'
      ).forEach(function(el){
        el.remove();
      });
    }catch(_){}
  }

  function makeSummary(summary){
    removeOldSummaries();

    var overlay = document.createElement('div');
    overlay.setAttribute('data-summary-owner', PATCH);
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483600',
      'display:grid',
      'place-items:center',
      'background:rgba(15,23,42,.46)',
      'backdrop-filter:blur(8px)',
      'padding:18px',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    var card = document.createElement('section');
    card.style.cssText = [
      'width:min(520px,calc(100vw - 28px))',
      'max-height:calc(100dvh - 34px)',
      'overflow:auto',
      'border-radius:28px',
      'background:rgba(255,255,255,.96)',
      'border:2px solid rgba(255,255,255,.9)',
      'box-shadow:0 26px 80px rgba(15,23,42,.35)',
      'padding:22px',
      'text-align:center',
      'color:#0f172a'
    ].join(';');

    var starText = '⭐'.repeat(Math.max(1, Math.min(5, summary.stars || 1)));

    card.innerHTML = [
      '<div style="font-size:50px;line-height:1">🏆</div>',
      '<h1 style="margin:8px 0 4px;font-size:clamp(30px,8vw,44px);line-height:1.05">สรุปผล GoodJunk</h1>',
      '<div style="font-size:26px;margin:4px 0 8px">' + starText + '</div>',
      '<p style="margin:0 0 14px;color:#64748b;font-weight:900">จบเกมแล้ว แสดงผลหลังเล่นจริง</p>',

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">',
        metric(summary.score, 'คะแนน'),
        metric(summary.accuracy + '%', 'ความแม่นยำ'),
        metric(summary.goodHits, 'อาหารดี'),
        metric('x' + summary.bestCombo, 'คอมโบสูงสุด'),
        metric(summary.junkHits, 'แตะ junk'),
        metric(summary.rank, 'Rank'),
      '</div>',

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">',
        '<button id="gjLiveReplayBtn" type="button" style="min-height:56px;border:0;border-radius:18px;background:#22c55e;color:white;font-weight:1000;font-size:16px">🔁 เล่นอีกครั้ง</button>',
        '<button id="gjLiveCooldownBtn" type="button" style="min-height:56px;border:0;border-radius:18px;background:#2563eb;color:white;font-weight:1000;font-size:16px">🧘 Cooldown แล้วกลับเลือกโหมด</button>',
      '</div>'
    ].join('');

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    document.getElementById('gjLiveReplayBtn').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      try{
        clearStaleSummary();
      }catch(_){}

      var u = new URL(location.href);
      u.searchParams.set('x', 'replay-' + Date.now());
      u.searchParams.delete('summary');
      u.searchParams.delete('result');
      location.replace(u.toString());
    });

    document.getElementById('gjLiveCooldownBtn').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      var shell = window.GJ_SOLO_BOSS_SHELL;
      if(shell && typeof shell.goCooldown === 'function'){
        shell.goCooldown(summary);
        return;
      }

      location.href = '../warmup-gate.html?game=goodjunk&phase=cooldown';
    });
  }

  function metric(value, label){
    return [
      '<div style="border:2px solid #e5edf5;border-radius:16px;padding:12px 8px;background:#fff">',
        '<b style="display:block;font-size:26px;line-height:1.1;word-break:break-word">' + escapeHtml(value) + '</b>',
        '<span style="display:block;margin-top:4px;color:#64748b;font-size:12px;font-weight:900">' + escapeHtml(label) + '</span>',
      '</div>'
    ].join('');
  }

  function escapeHtml(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function requestSummary(reason, detail){
    if(!shouldAllowSummary(reason, detail)){
      return false;
    }

    live.ended = true;
    live.summaryOpen = true;

    var summary = calcSummary();

    try{
      sessionStorage.setItem('GJ_SOLO_BOSS_THIS_RUN_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('GJ_SOLO_BOSS_LAST_VALID_LIVE_SUMMARY', JSON.stringify(summary));
    }catch(_){}

    makeSummary(summary);

    console.info('[GoodJunk Summary Live Only v850k] opened', summary);

    return true;
  }

  /*
    ให้ไฟล์อื่นเรียกได้ แต่ยังผ่าน guard
  */
  window.GJ_OPEN_LIVE_SUMMARY_V850K = function(detail){
    return requestSummary('manual-call', detail || {});
  };

  window.GJ_REQUEST_SUMMARY = function(detail){
    return requestSummary('GJ_REQUEST_SUMMARY', detail || {});
  };

  /*
    ตรวจ timeout: จบเพราะเวลาหมดเท่านั้น
  */
  setInterval(function(){
    if(live.summaryOpen) return;

    var timeLeft = readHudNumber('gjmTime', 999);
    if(timeLeft <= 0 && hasRealPlay()){
      requestSummary('time-up', { realEnd:true });
    }
  }, 800);

  console.info('[GoodJunk Summary Live Only v850k] installed');
})();
