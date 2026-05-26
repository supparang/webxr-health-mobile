/* =========================================================
   HeroHealth Hydration Solo Adaptive Balance Patch
   File: /herohealth/hydration-vr/hydration-solo-balance-pack43.patch.js
   Version: v20260526-pack43-adaptive-balance

   Purpose:
   - Reduce score inflation without touching the stable clean core
   - Add adaptive challenge pressure while keeping the game fair
   - Make Diamond harder but still achievable
   - Designed to load AFTER:
       1) hydration-solo-core.js
       2) hydration-solo-effects-pack41.patch.js
       3) hydration-solo-boss-pack42.patch.js
   - Does NOT load or depend on old hydration-vr.js
   ========================================================= */

(function(){
  'use strict';

  var VERSION = 'v20260526-pack43-adaptive-balance';

  if(window.HHA_HYDRATION_SOLO_BALANCE_PACK43){
    console.warn('[Hydration Solo Balance Pack43] already loaded');
    return;
  }

  window.HHA_HYDRATION_SOLO_BALANCE_PACK43 = true;

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
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function readNumber(sel, fallback){
    var el = q(sel);
    if(!el) return fallback;
    var raw = String(el.textContent || '').replace(/[^0-9.-]/g,'');
    var n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function currentView(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.view || document.body.dataset.view || 'mobile').toLowerCase();
  }

  function currentDiff(){
    var ctx = window.HHA_HYDRATION_RUN_CONTEXT || {};
    return String(ctx.diff || 'normal').toLowerCase();
  }

  function injectStyle(){
    if(q('#hha-hydration-solo-balance-pack43-css')) return;

    var style = document.createElement('style');
    style.id = 'hha-hydration-solo-balance-pack43-css';
    style.textContent = `
      .hha-balance43-chip{
        position:fixed;
        left:50%;
        top:calc(224px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:10013;
        display:flex;
        align-items:center;
        gap:8px;
        max-width:min(420px,72vw);
        padding:8px 12px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(204,238,251,.92);
        box-shadow:0 12px 28px rgba(30,75,115,.14);
        color:#24445c;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
        transition:.18s ease;
      }

      .hha-balance43-chip.show{
        opacity:1;
        transform:translateX(-50%) translateY(3px);
      }

      .hha-balance43-chip b{
        white-space:nowrap;
        font-size:13px;
      }

      .hha-balance43-meter{
        width:120px;
        height:9px;
        border-radius:999px;
        overflow:hidden;
        background:#edf8fd;
        box-shadow:inset 0 0 0 2px rgba(204,238,251,.88);
      }

      .hha-balance43-fill{
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#62e68f,#ffd966,#ff9f43,#ff6b6b);
        transition:width .22s ease;
      }

      .hha-balance43-label{
        color:#66879c;
        font-size:12px;
        white-space:nowrap;
      }

      .hha-balance43-tip{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(12px);
        z-index:12010;
        width:min(430px,88vw);
        padding:10px 13px;
        border-radius:22px;
        background:rgba(255,255,255,.94);
        border:3px solid #d7f3ff;
        box-shadow:0 16px 42px rgba(30,75,115,.18);
        color:#24445c;
        font-weight:1000;
        text-align:center;
        pointer-events:none;
        opacity:0;
        transition:.2s ease;
      }

      .hha-balance43-tip.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      .hha-balance43-tip small{
        display:block;
        color:#66879c;
        margin-top:3px;
        font-weight:900;
      }

      body.hha-balance43-pressure-high .hha-solo-target.good,
      body.hha-balance43-pressure-high .hha-hydration-target.good{
        box-shadow:0 12px 32px rgba(30,75,115,.20),0 0 0 5px rgba(255,217,102,.14);
      }

      body.hha-balance43-pressure-max .hha-solo-target,
      body.hha-balance43-pressure-max .hha-hydration-target{
        animation-duration:1.05s !important;
      }

      .hha-balance43-converted{
        border-color:#ff996f !important;
        background:rgba(255,250,246,.96) !important;
      }

      .hha-summary-rebalanced-badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        margin:8px auto 0;
        padding:8px 12px;
        border-radius:999px;
        background:#fff4c5;
        color:#85631b;
        font-weight:1000;
        font-size:13px;
      }

      @media (max-width:520px){
        .hha-balance43-chip{
          top:calc(236px + env(safe-area-inset-top,0px));
          max-width:86vw;
          padding:7px 10px;
          gap:6px;
        }

        .hha-balance43-chip b{font-size:11px}
        .hha-balance43-label{font-size:10px}
        .hha-balance43-meter{width:84px;height:8px}

        .hha-balance43-tip{
          bottom:calc(10px + env(safe-area-inset-bottom,0px));
          width:min(330px,88vw);
          padding:9px 11px;
          border-radius:20px;
          font-size:13px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureChallengeChip(){
    var chip = q('.hha-balance43-chip');
    if(chip) return chip;

    chip = document.createElement('div');
    chip.className = 'hha-balance43-chip';
    chip.innerHTML = `
      <b>⚡ Challenge</b>
      <div class="hha-balance43-meter"><div class="hha-balance43-fill" id="hha-balance43-fill"></div></div>
      <span class="hha-balance43-label" id="hha-balance43-label">Fair</span>
    `;
    document.body.appendChild(chip);
    return chip;
  }

  function showTip(title, sub, ms){
    try{
      var tip = q('.hha-balance43-tip');
      if(!tip){
        tip = document.createElement('div');
        tip.className = 'hha-balance43-tip';
        document.body.appendChild(tip);
      }

      tip.innerHTML = esc(title || '') + (sub ? '<small>' + esc(sub) + '</small>' : '');
      tip.classList.add('show');

      clearTimeout(tip._timer);
      tip._timer = setTimeout(function(){
        tip.classList.remove('show');
      }, ms || 1450);
    }catch(e){}
  }

  function readHud(){
    return {
      hydration:readNumber('#hha-solo-hydration', 60),
      score:readNumber('#hha-solo-score', 0),
      combo:readNumber('#hha-solo-combo', 0),
      fever:readNumber('#hha-solo-fever', 0),
      shield:readNumber('#hha-solo-shield', 0),
      time:readNumber('#hha-solo-time', 0),
      hasHud:!!q('.hha-solo-hud'),
      hasSummary:!!q('.hha-solo-summary')
    };
  }

  var pressure = {
    value:0,
    level:'Fair',
    lastLevel:'Fair',
    lastTipAt:0,
    ticks:0
  };

  function calcPressure(h){
    var diff = currentDiff();
    var base = 0;

    base += clamp((h.hydration - 55) * 0.85, 0, 28);
    base += clamp(h.combo * 1.18, 0, 36);
    base += clamp(h.score / 360, 0, 22);
    base += h.fever >= 70 ? 10 : h.fever >= 45 ? 5 : 0;
    base += h.shield >= 2 ? 5 : 0;

    if(diff === 'easy') base *= 0.72;
    if(diff === 'hard') base *= 1.12;
    if(diff === 'challenge') base *= 1.26;

    if(h.hydration < 38) base *= 0.52;
    if(h.combo <= 2) base *= 0.74;

    return clamp(Math.round(base), 0, 100);
  }

  function pressureLabel(v){
    if(v >= 82) return 'Heat Max';
    if(v >= 62) return 'Heat High';
    if(v >= 38) return 'Rising';
    return 'Fair';
  }

  function updateChallengeChip(h){
    var chip = ensureChallengeChip();
    var fill = q('#hha-balance43-fill');
    var label = q('#hha-balance43-label');

    chip.classList.toggle('show', h.hasHud && !h.hasSummary);
    if(fill) fill.style.width = pressure.value + '%';
    if(label) label.textContent = pressure.level;

    document.body.classList.toggle('hha-balance43-pressure-high', pressure.value >= 62);
    document.body.classList.toggle('hha-balance43-pressure-max', pressure.value >= 82);

    if(pressure.level !== pressure.lastLevel){
      if(pressure.value >= 62){
        showTip('Heat Pressure เพิ่มขึ้น!', 'เล่นดีมาก เกมจะท้าทายขึ้นแบบยุติธรรม', 1450);
      }
      if(pressure.value < 38 && pressure.lastLevel !== 'Fair'){
        showTip('ลดความกดดันแล้ว', 'กลับมาเก็บน้ำและต่อคอมโบใหม่ได้', 1350);
      }
      pressure.lastLevel = pressure.level;
    }
  }

  function getComboBonus(combo){
    return Math.min(Number(combo || 0) * 8, 160);
  }

  function desiredGoodGain(h){
    var gain = 68;

    if(currentDiff() === 'easy') gain += 10;
    if(currentDiff() === 'hard') gain -= 8;
    if(currentDiff() === 'challenge') gain -= 14;

    gain -= Math.round(pressure.value * 0.22);

    if(h.hydration < 45) gain += 18;
    if(h.combo >= 20) gain -= 8;

    return clamp(gain, 34, 82);
  }

  function desiredHydrate(h, original){
    original = Number(original || 0);

    if(h.hydration >= 90) return Math.min(original, 2);
    if(h.hydration >= 78) return Math.min(original, 3);
    if(h.hydration <= 35) return Math.max(original, 9);
    if(h.hydration <= 50) return Math.max(original, 7);
    return clamp(original || 5, 3, 9);
  }

  function shouldConvertGoodToHeat(target, h){
    if(!target || target.dataset.good !== '1') return false;
    if(target.dataset.shield === '1') return false;
    if(target.dataset.hha43Converted === '1') return true;
    if(pressure.value < 70) return false;

    var raw = target.dataset.hha43Seed;
    if(!raw){
      raw = String(Date.now() + Math.random()).slice(-6);
      target.dataset.hha43Seed = raw;
    }

    var n = Math.abs(parseInt(raw.replace(/\D/g,''), 10) || 0) % 100;
    var rate = pressure.value >= 86 ? 28 : 16;

    if(h.hydration < 58) rate = 0;
    if(h.combo < 12) rate = 0;

    return n < rate;
  }

  function rewriteTarget(target, h){
    if(!target || !target.isConnected) return;
    if(target.dataset.hha43Locked === '1') return;

    var isGood = target.dataset.good === '1';
    var isBad = target.dataset.good === '0';
    var comboBonus = getComboBonus(h.combo);

    if(isGood){
      if(!target.dataset.hha43OriginalScore) target.dataset.hha43OriginalScore = target.dataset.score || '0';
      if(!target.dataset.hha43OriginalHydrate) target.dataset.hha43OriginalHydrate = target.dataset.hydrate || '0';

      if(shouldConvertGoodToHeat(target, h)){
        target.dataset.good = '0';
        target.dataset.score = String(-95 - Math.round(pressure.value * 0.4));
        target.dataset.hydrate = String(-10 - Math.round(pressure.value / 16));
        target.dataset.boss = '1';
        target.dataset.hha43Converted = '1';
        target.classList.remove('good','is-good','shield');
        target.classList.add('bad','is-bad','hha-balance43-converted');
        target.innerHTML = '<span><span class="icon">☀️</span><span class="title">Heat Wave</span><span class="sub">หลบแดด!</span></span>';
        return;
      }

      var targetGain = desiredGoodGain(h);
      target.dataset.score = String(Math.round(targetGain - comboBonus));
      target.dataset.hydrate = String(desiredHydrate(h, Number(target.dataset.hha43OriginalHydrate || target.dataset.hydrate || 5)));
      return;
    }

    if(isBad){
      if(!target.dataset.hha43OriginalScore) target.dataset.hha43OriginalScore = target.dataset.score || '0';
      if(!target.dataset.hha43OriginalHydrate) target.dataset.hha43OriginalHydrate = target.dataset.hydrate || '0';

      var penalty = -72 - Math.round(pressure.value * 0.45);
      var hydrateLoss = -8 - Math.round(pressure.value / 14);

      if(h.hydration < 40){
        penalty = Math.max(penalty, -70);
        hydrateLoss = Math.max(hydrateLoss, -9);
      }

      target.dataset.score = String(penalty);
      target.dataset.hydrate = String(hydrateLoss);
    }
  }

  function rebalanceTargets(h){
    qa('.hha-solo-target, .hha-hydration-target').forEach(function(target){
      rewriteTarget(target, h);
    });
  }

  function summaryShown(){
    return q('.hha-solo-summary') || q('#hha-hydration-summary');
  }

  function parseSummaryNumber(labelRegex, fallback){
    var stats = qa('.hha-solo-stat');
    for(var i=0; i<stats.length; i++){
      var t = stats[i];
      var text = String(t.textContent || '');
      if(labelRegex.test(text)){
        var b = q('b', t);
        var n = Number(String((b && b.textContent) || '').replace(/[^0-9.-]/g,''));
        if(Number.isFinite(n)) return n;
      }
    }
    return fallback;
  }

  function computeBalancedSummary(){
    var scoreEl = q('.hha-solo-bigscore');
    var originalScore = scoreEl ? Number(String(scoreEl.childNodes[0] && scoreEl.childNodes[0].nodeValue || scoreEl.textContent || '').replace(/[^0-9.-]/g,'')) : 0;

    var hydration = parseSummaryNumber(/Hydration/i, 0);
    var combo = parseSummaryNumber(/Combo|คอมโบ/i, 0);
    var missions = parseSummaryNumber(/Mission/i, 0);
    var good = parseSummaryNumber(/เก็บของดี/i, 0);
    var bad = parseSummaryNumber(/โดนของเสีย/i, 0);
    var miss = parseSummaryNumber(/พลาด/i, 0);

    var bossWin = /ชนะ/.test(document.body.textContent || '');

    var balanced = 0;
    balanced += good * 64;
    balanced += Math.min(combo, 40) * 38;
    balanced += Math.max(0, combo - 40) * 12;
    balanced += missions * 260;
    balanced += hydration >= 90 ? 760 : hydration >= 75 ? 560 : hydration >= 55 ? 300 : 120;
    balanced += bossWin ? 850 : 0;
    balanced -= bad * 145;
    balanced -= miss * 42;

    if(currentDiff() === 'easy') balanced *= 0.88;
    if(currentDiff() === 'hard') balanced *= 1.06;
    if(currentDiff() === 'challenge') balanced *= 1.14;

    balanced = Math.max(0, Math.round(balanced));

    var rank = 'Bronze';
    var stars = 1;

    if(balanced >= 8200 && hydration >= 72 && combo >= 22 && missions >= 4 && bad <= 4 && bossWin){
      rank = 'Diamond';
      stars = 3;
    }
    }else if(balanced >= 5600 && hydration >= 58 && combo >= 12){
      rank = 'Gold';
      stars = 2;
    }else if(balanced >= 3200 && hydration >= 38){
      rank = 'Silver';
      stars = 2;
    }

    return {
      originalScore:originalScore,
      score:balanced,
      rank:rank,
      stars:stars,
      hydration:hydration,
      combo:combo,
      missions:missions,
      good:good,
      bad:bad,
      miss:miss,
      bossWin:bossWin
    };
  }

  function applySummaryRebalance(){
    var summary = summaryShown();
    if(!summary || summary.dataset.hhaBalance43Done === '1') return;
    summary.dataset.hhaBalance43Done = '1';

    var data = computeBalancedSummary();

    var rankEl = q('.hha-solo-rank', summary);
    if(rankEl){
      rankEl.textContent = data.rank + ' 💧';
    }

    var starsEl = q('.hha-solo-stars', summary);
    if(starsEl){
      starsEl.textContent = '⭐'.repeat(data.stars) + '☆'.repeat(3 - data.stars);
    }

    var scoreBox = q('.hha-solo-bigscore', summary);
    if(scoreBox){
      scoreBox.innerHTML = String(data.score) + '<small>คะแนนรวม • ปรับสมดุล Pack43</small>';
    }

    var badge = document.createElement('div');
    badge.className = 'hha-summary-rebalanced-badge';
    badge.textContent = '⚖️ Adaptive Balance • เดิม ' + data.originalScore + ' → ใหม่ ' + data.score;

    if(scoreBox && scoreBox.parentNode){
      scoreBox.parentNode.insertBefore(badge, scoreBox.nextSibling);
    }

    try{
      var payload = {
        game:'hydration',
        mode:'solo',
        view:currentView(),
        score:data.score,
        originalScore:data.originalScore,
        hydration:data.hydration,
        combo:data.combo,
        missions:data.missions,
        good:data.good,
        bad:data.bad,
        miss:data.miss,
        bossDefeated:data.bossWin,
        rank:data.rank,
        stars:data.stars,
        balanced:true,
        balanceVersion:VERSION,
        endedAt:new Date().toISOString()
      };

      localStorage.setItem('HHA_LAST_SUMMARY_HYDRATION', JSON.stringify(payload));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
    }catch(e){}

    console.info('[Hydration Solo Balance Pack43] summary rebalanced', data);
  }

  function loop(){
    setInterval(function(){
      try{
        var h = readHud();

        if(h.hasSummary){
          applySummaryRebalance();
          return;
        }

        if(!h.hasHud){
          var chip = q('.hha-balance43-chip');
          if(chip) chip.classList.remove('show');
          return;
        }

        pressure.value = calcPressure(h);
        pressure.level = pressureLabel(pressure.value);
        pressure.ticks += 1;

        updateChallengeChip(h);
        rebalanceTargets(h);
      }catch(e){}
    }, 260);
  }

  function observeTargets(){
    var mo = new MutationObserver(function(){
      try{
        var h = readHud();
        rebalanceTargets(h);
      }catch(e){}
    });

    mo.observe(document.body, { childList:true, subtree:true });
  }

  function boot(){
    injectStyle();
    ensureChallengeChip();
    observeTargets();
    loop();
    console.info('[Hydration Solo Balance Pack43] loaded', VERSION, { view:currentView(), diff:currentDiff() });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
