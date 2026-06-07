/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-final-gate-v850a.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-FINAL-GATE-V850A
   Purpose:
   - ลบ summary ปลอม
   - เปิด summary เฉพาะเมื่อจบจริง
   - ใช้ร่วมกับ balance-v850a / win-gate-v850a
*/

(function(){
  'use strict';

  if (window.GJ_SUMMARY_FINAL_GATE_V850A_LOADED) return;
  window.GJ_SUMMARY_FINAL_GATE_V850A_LOADED = true;

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-FINAL-GATE-V850A';
  var opened = false;
  var lastFalseRemovedAt = 0;

  function $(id){
    return document.getElementById(id);
  }

  function textOf(el){
    return String(
      (el && (el.textContent || el.innerText)) || ''
    ).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function pageText(){
    return textOf(document.body);
  }

  function numFromText(s){
    var m = String(s || '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function readScore(){
    return Math.max(0, numFromText(textOf($('gjmScore'))));
  }

  function readCombo(){
    var t = textOf($('gjmCombo'));
    var m = t.match(/x?\s*(\d+)/i);
    return m ? Math.max(0, Number(m[1])) : 0;
  }

  function readTimeLeft(){
    return Math.max(0, numFromText(textOf($('gjmTime'))));
  }

  function balance(){
    return window.GJ_BOSS_BALANCE_V850A || null;
  }

  function balanceState(){
    var b = balance();

    if (b && typeof b.state === 'function'){
      try{
        return b.state();
      }catch(_){}
    }

    return {
      score: readScore(),
      combo: readCombo(),
      goodHits: 0,
      timeLeft: readTimeLeft(),
      canOpenSummary: false,
      whyBlocked: 'no-balance'
    };
  }

  function canOpenSummary(){
    var b = balance();

    if (b && typeof b.canOpenSummary === 'function'){
      return !!b.canOpenSummary();
    }

    return false;
  }

  function whyBlocked(){
    var b = balance();

    if (b && typeof b.whyBlocked === 'function'){
      return b.whyBlocked();
    }

    return 'no-balance';
  }

  function looksLikeSummary(el){
    if (!el || el.id === 'gjFinalSummaryV850A') return false;

    var t = textOf(el);
    if (!t) return false;

    return (
      (
        t.includes('ชนะบอสแบบสุดยอด') ||
        t.includes('ชนะบอสแล้ว') ||
        t.includes('Boss Defeated')
      ) &&
      (
        t.includes('เล่นอีกครั้ง') ||
        t.includes('Cooldown') ||
        t.includes('ความแม่นยำ') ||
        t.includes('คะแนน')
      )
    );
  }

  function findOldSummary(){
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('section,div,article,aside')
    );

    for (var i = 0; i < nodes.length; i++){
      if (looksLikeSummary(nodes[i])) return nodes[i];
    }

    return null;
  }

  function removeFalseSummary(){
    var old = findOldSummary();
    if (!old) return false;

    if (canOpenSummary()){
      return false;
    }

    var now = Date.now();
    if (now - lastFalseRemovedAt < 250) return true;
    lastFalseRemovedAt = now;

    try{
      old.remove();
    }catch(_){
      old.style.setProperty('display', 'none', 'important');
      old.style.setProperty('visibility', 'hidden', 'important');
      old.style.setProperty('pointer-events', 'none', 'important');
    }

    console.warn('[GoodJunk Summary v850a] removed false summary:', whyBlocked(), balanceState());

    return true;
  }

  function removeAllOldSummaries(){
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('section,div,article,aside')
    );

    nodes.forEach(function(el){
      if (!looksLikeSummary(el)) return;

      try{
        el.remove();
      }catch(_){
        el.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function calcStars(score, combo, goodHits){
    if (score >= 900 || combo >= 15 || goodHits >= 60) return 5;
    if (score >= 650 || combo >= 12 || goodHits >= 48) return 4;
    if (score >= 420 || combo >= 8 || goodHits >= 36) return 3;
    if (score >= 220 || combo >= 4 || goodHits >= 20) return 2;
    return 1;
  }

  function calcAccuracy(score, goodHits){
    if (score <= 0 && goodHits <= 0) return 0;

    /*
      ไม่มี raw miss/click จาก core เสมอ
      จึงประเมินแบบ conservative จากการมีคะแนน/อาหารดี
    */
    if (goodHits >= 40) return 100;
    if (goodHits >= 30) return 90;
    if (goodHits >= 20) return 80;
    if (goodHits >= 10) return 65;
    return Math.min(50, Math.max(10, Math.round(score / 10)));
  }

  function buildLauncherUrl(){
    var qs = new URLSearchParams(location.search || '');
    var u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html');

    u.searchParams.set('pid', qs.get('pid') || 'anon');
    u.searchParams.set('name', qs.get('name') || qs.get('nick') || 'Hero');
    u.searchParams.set('diff', qs.get('diff') || 'normal');
    u.searchParams.set('time', qs.get('time') || '90');
    u.searchParams.set('view', qs.get('view') || qs.get('device') || 'mobile');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'summary-v850a');

    return u.toString();
  }

  function goCooldown(payload){
    try{
      if (
        window.GJ_SOLO_BOSS_SHELL &&
        typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'
      ){
        window.GJ_SOLO_BOSS_SHELL.goCooldown(payload || {});
        return;
      }
    }catch(_){}

    var qs = new URLSearchParams(location.search || '');
    var launcher = buildLauncherUrl();
    var gate = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html');

    gate.searchParams.set('zone', 'nutrition');
    gate.searchParams.set('cat', 'nutrition');
    gate.searchParams.set('game', 'goodjunk');
    gate.searchParams.set('gameId', 'goodjunk');
    gate.searchParams.set('phase', 'cooldown');
    gate.searchParams.set('mode', 'solo_boss');

    gate.searchParams.set('pid', qs.get('pid') || 'anon');
    gate.searchParams.set('name', qs.get('name') || qs.get('nick') || 'Hero');
    gate.searchParams.set('diff', qs.get('diff') || 'normal');
    gate.searchParams.set('time', qs.get('time') || '90');
    gate.searchParams.set('view', qs.get('view') || qs.get('device') || 'mobile');

    gate.searchParams.set('hub', launcher);
    gate.searchParams.set('next', launcher);
    gate.searchParams.set('back', launcher);
    gate.searchParams.set('launcher', launcher);
    gate.searchParams.set('return', launcher);
    gate.searchParams.set('returnUrl', launcher);
    gate.searchParams.set('cdnext', launcher);

    if (payload){
      Object.keys(payload).forEach(function(k){
        if (payload[k] !== undefined && payload[k] !== null && payload[k] !== ''){
          gate.searchParams.set(k, String(payload[k]));
        }
      });
    }

    location.href = gate.toString();
  }

  function replay(){
    var u = new URL(location.href);

    u.searchParams.set('run', 'play');
    u.searchParams.set('phase', 'main');
    u.searchParams.set('replay', String(Date.now()));

    location.href = u.toString();
  }

  function openSummary(reason){
    if (opened) return false;
    if (!canOpenSummary()){
      removeFalseSummary();
      return false;
    }

    var st = balanceState();
    var score = Math.max(readScore(), Number(st.score || 0));
    var combo = Math.max(readCombo(), Number(st.combo || 0));
    var goodHits = Math.max(0, Number(st.goodHits || 0));
    var stars = calcStars(score, combo, goodHits);
    var accuracy = calcAccuracy(score, goodHits);
    var coins = Math.max(20, Math.round(score / 7) + stars * 8);

    opened = true;
    removeAllOldSummaries();

    var old = $('gjFinalSummaryV850A');
    if (old) old.remove();

    var overlay = document.createElement('section');
    overlay.id = 'gjFinalSummaryV850A';
    overlay.setAttribute('aria-label', 'GoodJunk final summary');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483640',
      'display:grid',
      'place-items:center',
      'background:rgba(15,23,42,.42)',
      'backdrop-filter:blur(7px)',
      'padding:18px',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    overlay.innerHTML =
      '<div style="width:min(560px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;border-radius:30px;background:rgba(255,255,255,.98);box-shadow:0 32px 90px rgba(15,23,42,.34);padding:24px;text-align:center;color:#0f172a;">' +
        '<div style="font-size:58px;line-height:1;">🏆</div>' +
        '<h1 style="margin:8px 0 4px;font-size:clamp(30px,7vw,46px);line-height:1.05;font-weight:1000;">ชนะบอสแบบสุดยอด!</h1>' +
        '<div style="font-size:28px;line-height:1.1;margin:8px 0 12px;">' + '⭐'.repeat(stars) + '</div>' +
        '<p style="margin:0 auto 16px;max-width:420px;color:#64748b;font-size:15px;font-weight:900;line-height:1.35;">เลือกอาหารดีและหลบอาหารขยะได้เยี่ยมมาก</p>' +

        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0;">' +
          '<div style="border:2px solid #e2e8f0;border-radius:18px;padding:13px 10px;background:#fff;"><b style="display:block;font-size:26px;">' + score + '</b><span style="font-size:12px;font-weight:900;color:#64748b;">คะแนน</span></div>' +
          '<div style="border:2px solid #e2e8f0;border-radius:18px;padding:13px 10px;background:#fff;"><b style="display:block;font-size:26px;">' + accuracy + '%</b><span style="font-size:12px;font-weight:900;color:#64748b;">ความแม่นยำ</span></div>' +
          '<div style="border:2px solid #e2e8f0;border-radius:18px;padding:13px 10px;background:#fff;"><b style="display:block;font-size:26px;">' + goodHits + '</b><span style="font-size:12px;font-weight:900;color:#64748b;">อาหารดี</span></div>' +
          '<div style="border:2px solid #e2e8f0;border-radius:18px;padding:13px 10px;background:#fff;"><b style="display:block;font-size:26px;">x' + combo + '</b><span style="font-size:12px;font-weight:900;color:#64748b;">คอมโบสูงสุด</span></div>' +
          '<div style="grid-column:1 / -1;border:2px solid #e2e8f0;border-radius:18px;padding:13px 10px;background:#fff;"><b style="display:block;font-size:26px;">+' + coins + ' 🪙</b><span style="font-size:12px;font-weight:900;color:#64748b;">เหรียญ</span></div>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;">' +
          '<button id="gjV850AReplayBtn" type="button" style="min-height:58px;border:0;border-radius:18px;padding:12px;background:#22c55e;color:white;font-size:16px;font-weight:1000;cursor:pointer;">🔁 เล่นอีกครั้ง</button>' +
          '<button id="gjV850ACooldownBtn" type="button" style="min-height:58px;border:0;border-radius:18px;padding:12px;background:#2563eb;color:white;font-size:16px;font-weight:1000;cursor:pointer;">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</div>';

    document.documentElement.appendChild(overlay);

    var replayBtn = $('gjV850AReplayBtn');
    var cooldownBtn = $('gjV850ACooldownBtn');

    if (replayBtn){
      replayBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        replay();
      }, true);
    }

    if (cooldownBtn){
      cooldownBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        goCooldown({
          score: score,
          stars: stars,
          accuracy: accuracy,
          goodHits: goodHits,
          bestCombo: combo,
          combo: combo,
          coins: coins,
          reason: 'summary-v850a'
        });
      }, true);
    }

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify({
        patch: PATCH,
        reason: reason || '',
        score: score,
        stars: stars,
        accuracy: accuracy,
        goodHits: goodHits,
        bestCombo: combo,
        coins: coins,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}

    console.warn('[GoodJunk Summary v850a] opened:', reason, balanceState());

    return true;
  }

  function tick(){
    removeFalseSummary();

    if (canOpenSummary()){
      openSummary('watchdog');
    }
  }

  window.addEventListener('gj:final-win', function(){
    setTimeout(function(){
      openSummary('event:gj:final-win');
    }, 800);
  }, true);

  window.addEventListener('gj:boss-defeated', function(){
    setTimeout(function(){
      openSummary('event:gj:boss-defeated');
    }, 900);
  }, true);

  window.addEventListener('gj:time-up', function(){
    try{
      var b = balance();
      if (b && typeof b.forceTimeUp === 'function') b.forceTimeUp();
    }catch(_){}

    setTimeout(function(){
      openSummary('event:gj:time-up');
    }, 900);
  }, true);

  var mo = new MutationObserver(tick);

  try{
    mo.observe(document.documentElement, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['style','class']
    });
  }catch(_){}

  setInterval(tick, 800);

  setTimeout(tick, 600);
  setTimeout(tick, 1500);
  setTimeout(tick, 3000);

  window.GJ_SUMMARY_FINAL_GATE_V850A = {
    patch: PATCH,
    openSummary: openSummary,
    removeFalseSummary: removeFalseSummary,
    state: function(){
      return {
        patch: PATCH,
        opened: opened,
        canOpenSummary: canOpenSummary(),
        whyBlocked: whyBlocked(),
        balance: balanceState()
      };
    }
  };

  console.log('[GoodJunk Summary v850a] installed');
})();