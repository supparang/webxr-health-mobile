/* =========================================================
   HeroHealth • GoodJunk Mobile Solo Boss
   PATCH: v20260526-GOODJUNK-MOBILE-BOSS-BALANCE-POWER-FINAL
   FILE: /herohealth/vr-goodjunk/goodjunk-mobile-boss-balance-power-final-patch.js

   PURPOSE:
   - ปรับ Boss ไม่ให้ชนะง่ายเกินไป
   - บังคับให้ normal ต้องยิง GOOD ประมาณ 16–20 ครั้ง
   - ปรับ Rank / Stars ให้ไม่แจกง่าย
   - ทำ Shield / Magnet / Fever ให้ active ชัดขึ้น
   - ไม่รื้อไฟล์หลัก ไม่แตะ cVR
========================================================= */

(function(){
  'use strict';

  if (window.__GJ_MOBILE_BOSS_BALANCE_POWER_FINAL__) return;
  window.__GJ_MOBILE_BOSS_BALANCE_POWER_FINAL__ = true;

  const PATCH = 'v20260526-GOODJUNK-MOBILE-BOSS-BALANCE-POWER-FINAL';
  const qs = new URLSearchParams(location.search || '');

  const view = String(qs.get('view') || '').toLowerCase();
  const isMobile =
    view === 'mobile' ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  if (!isMobile) return;

  const BALANCE = {
    easy: {
      bossHp: 190,
      minGoodToWin: 11,
      damageMul: 0.82,
      scoreMul: 1.00,
      rankGoodS: 13,
      rankComboS: 6
    },
    normal: {
      bossHp: 300,
      minGoodToWin: 17,
      damageMul: 0.58,
      scoreMul: 0.92,
      rankGoodS: 18,
      rankComboS: 8
    },
    hard: {
      bossHp: 390,
      minGoodToWin: 23,
      damageMul: 0.48,
      scoreMul: 0.96,
      rankGoodS: 25,
      rankComboS: 10
    },
    challenge: {
      bossHp: 480,
      minGoodToWin: 30,
      damageMul: 0.42,
      scoreMul: 1.04,
      rankGoodS: 32,
      rankComboS: 12
    }
  };

  const diff = String(qs.get('diff') || 'normal').toLowerCase();
  const B = BALANCE[diff] || BALANCE.normal;

  let lastKnown = {
    score: 0,
    goodHits: 0,
    junkHits: 0,
    fakeHits: 0,
    miss: 0,
    bestCombo: 0,
    accuracy: 0,
    rank: '',
    stars: 0,
    bossHp: B.bossHp,
    bossMaxHp: B.bossHp
  };

  function $(id){
    return document.getElementById(id);
  }

  function text(el){
    return String(el && el.textContent || '').trim();
  }

  function num(v, fallback){
    const n = Number(String(v || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function toast(msg){
    let t = document.getElementById('gjBalanceToast');

    if (!t){
      t = document.createElement('div');
      t.id = 'gjBalanceToast';
      t.style.position = 'fixed';
      t.style.left = '50%';
      t.style.bottom = 'calc(86px + env(safe-area-inset-bottom,0px))';
      t.style.transform = 'translateX(-50%) translateY(8px) scale(.96)';
      t.style.zIndex = '2147482000';
      t.style.width = 'min(390px, calc(100vw - 26px))';
      t.style.borderRadius = '999px';
      t.style.padding = '11px 15px';
      t.style.background = 'rgba(15,23,42,.88)';
      t.style.color = '#fff';
      t.style.border = '2px solid rgba(255,255,255,.78)';
      t.style.boxShadow = '0 16px 34px rgba(15,23,42,.28)';
      t.style.textAlign = 'center';
      t.style.fontSize = '13px';
      t.style.fontWeight = '1000';
      t.style.pointerEvents = 'none';
      t.style.opacity = '0';
      t.style.transition = '.18s ease';
      document.body.appendChild(t);
    }

    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0) scale(1)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function(){
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(8px) scale(.96)';
    }, 1300);
  }

  function bigFx(msg, type){
    let fx = document.getElementById('gjBalanceBigFx');

    if (!fx){
      fx = document.createElement('div');
      fx.id = 'gjBalanceBigFx';
      fx.style.position = 'fixed';
      fx.style.left = '50%';
      fx.style.top = '45%';
      fx.style.zIndex = '2147482100';
      fx.style.transform = 'translate(-50%,-50%) scale(.72)';
      fx.style.minWidth = 'min(360px, calc(100vw - 34px))';
      fx.style.borderRadius = '28px';
      fx.style.padding = '16px 18px';
      fx.style.color = '#fff';
      fx.style.textAlign = 'center';
      fx.style.fontSize = 'clamp(30px, 9vw, 56px)';
      fx.style.fontWeight = '1000';
      fx.style.lineHeight = '1';
      fx.style.letterSpacing = '-.05em';
      fx.style.textShadow = '0 4px 16px rgba(15,23,42,.30)';
      fx.style.pointerEvents = 'none';
      fx.style.opacity = '0';
      fx.style.transition = '.18s ease';
      document.body.appendChild(fx);
    }

    const bg =
      type === 'bad'
        ? 'linear-gradient(135deg,rgba(239,68,68,.96),rgba(185,28,28,.90))'
        : type === 'power'
          ? 'linear-gradient(135deg,rgba(37,99,235,.96),rgba(14,165,233,.90))'
          : type === 'warn'
            ? 'linear-gradient(135deg,rgba(245,158,11,.96),rgba(217,119,6,.90))'
            : 'linear-gradient(135deg,rgba(34,197,94,.96),rgba(22,163,74,.90))';

    fx.textContent = msg;
    fx.style.background = bg;
    fx.style.opacity = '1';
    fx.style.transform = 'translate(-50%,-50%) scale(1.05)';

    clearTimeout(bigFx._timer1);
    clearTimeout(bigFx._timer2);

    bigFx._timer1 = setTimeout(function(){
      fx.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 110);

    bigFx._timer2 = setTimeout(function(){
      fx.style.opacity = '0';
      fx.style.transform = 'translate(-50%,-58%) scale(.92)';
    }, 780);
  }

  function pulsePowerCard(label){
    const cards = Array.from(document.querySelectorAll('.gjpu-card, [data-power], .power-card, .powerup-card'));
    const target = cards.find(function(card){
      return text(card).toLowerCase().includes(String(label || '').toLowerCase());
    });

    if (!target) return;

    target.style.transition = '.16s ease';
    target.style.transform = 'scale(1.10)';
    target.style.boxShadow = '0 0 0 4px rgba(34,197,94,.35), 0 16px 34px rgba(15,23,42,.24)';

    setTimeout(function(){
      target.style.transform = '';
      target.style.boxShadow = '';
    }, 420);
  }

  function getHudValues(){
    const score =
      num(text($('gjmScore')), lastKnown.score) ||
      num(text(document.querySelector('[data-score]')), lastKnown.score);

    const combo =
      num(text($('gjmCombo')), lastKnown.bestCombo) ||
      lastKnown.bestCombo;

    return { score, combo };
  }

  function readSummaryFromDOM(){
    const bodyText = document.body ? document.body.innerText : '';

    const scoreCandidates = [
      document.getElementById('gjrScore'),
      document.getElementById('sumScore'),
      document.querySelector('[data-summary-score]'),
      document.querySelector('.score-value')
    ];

    const goodCandidates = [
      document.getElementById('gjrGood'),
      document.getElementById('sumGood'),
      document.querySelector('[data-summary-good]')
    ];

    const missCandidates = [
      document.getElementById('gjrMiss'),
      document.getElementById('sumMiss'),
      document.querySelector('[data-summary-miss]')
    ];

    const comboCandidates = [
      document.getElementById('gjrCombo'),
      document.querySelector('[data-summary-combo]')
    ];

    const scoreEl = scoreCandidates.find(Boolean);
    const goodEl = goodCandidates.find(Boolean);
    const missEl = missCandidates.find(Boolean);
    const comboEl = comboCandidates.find(Boolean);

    const score = scoreEl ? num(text(scoreEl), lastKnown.score) : lastKnown.score;
    const goodHits = goodEl ? num(text(goodEl), lastKnown.goodHits) : lastKnown.goodHits;
    const miss = missEl ? num(text(missEl), lastKnown.miss) : lastKnown.miss;
    const bestCombo = comboEl ? num(text(comboEl), lastKnown.bestCombo) : lastKnown.bestCombo;

    const accMatch = bodyText.match(/(\d{1,3})\s*%/);
    const accuracy = accMatch ? num(accMatch[1], lastKnown.accuracy) : lastKnown.accuracy;

    return {
      score,
      goodHits,
      miss,
      bestCombo,
      accuracy
    };
  }

  function rankByRealDifficulty(summary){
    const good = Number(summary.goodHits || 0);
    const miss = Number(summary.miss || 0);
    const combo = Number(summary.bestCombo || 0);
    const acc = Number(summary.accuracy || 0);
    const score = Number(summary.score || 0);

    let stars = 1;

    if (good >= Math.ceil(B.minGoodToWin * 0.75)) stars++;
    if (good >= B.minGoodToWin) stars++;
    if (combo >= Math.max(5, B.rankComboS - 2)) stars++;
    if (acc >= 80 && miss <= 3) stars++;
    if (good >= B.rankGoodS && combo >= B.rankComboS && acc >= 85 && miss <= 2) stars++;

    if (good < B.minGoodToWin) stars = Math.min(stars, 3);
    if (good < Math.ceil(B.minGoodToWin * 0.65)) stars = Math.min(stars, 2);
    if (score < 300) stars = Math.min(stars, 3);
    if (miss >= 5) stars = Math.min(stars, 3);
    if (miss >= 8) stars = Math.min(stars, 2);

    stars = Math.max(1, Math.min(5, stars));

    const rank =
      stars >= 5 ? 'Legend Hero' :
      stars >= 4 ? 'Super Hero' :
      stars >= 3 ? 'Smart Hero' :
      stars >= 2 ? 'Food Learner' :
      'Try Again Hero';

    return { rank, stars };
  }

  function starText(n){
    n = Math.max(1, Math.min(5, Number(n || 1)));
    return '⭐'.repeat(n) + '☆'.repeat(5 - n);
  }

  function patchSummaryRank(){
    const modalText = document.body ? document.body.innerText : '';
    if (!/ชนะบอส|summary|rank|คะแนน/i.test(modalText)) return;

    const summary = readSummaryFromDOM();
    const result = rankByRealDifficulty(summary);

    lastKnown = Object.assign({}, lastKnown, summary, result);

    const rankEls = Array.from(document.querySelectorAll('*')).filter(function(el){
      const t = text(el);
      return /Legend Hero|Super Hero|Smart Hero|Food Learner|Try Again Hero/i.test(t);
    });

    rankEls.forEach(function(el){
      if (el.children && el.children.length > 0) return;
      el.textContent = result.rank;
    });

    const starEls = Array.from(document.querySelectorAll('*')).filter(function(el){
      const t = text(el);
      return /^⭐+☆*$/.test(t) || /⭐⭐⭐|⭐⭐⭐⭐|⭐⭐⭐⭐⭐/.test(t);
    });

    starEls.forEach(function(el){
      if (el.children && el.children.length > 0) return;
      el.textContent = starText(result.stars);
    });

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify({
        patch: PATCH,
        score: summary.score,
        goodHits: summary.goodHits,
        miss: summary.miss,
        bestCombo: summary.bestCombo,
        accuracy: summary.accuracy,
        rank: result.rank,
        stars: result.stars,
        minGoodToWin: B.minGoodToWin,
        diff: diff,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}
  }

  function patchBossHpIfGlobalExists(){
    const candidates = [
      window.GJ_SOLO_BOSS,
      window.GoodJunkSoloBoss,
      window.GJ_SOLO_BOSS_GAME,
      window.GJMobileSoloBoss
    ].filter(Boolean);

    candidates.forEach(function(api){
      try{
        if (api.__gjBalancePatched) return;
        api.__gjBalancePatched = true;

        if (typeof api.getState === 'function'){
          const st = api.getState();
          if (st){
            if ('bossHp' in st) st.bossHp = Math.max(Number(st.bossHp || 0), B.bossHp);
            if ('bossMaxHp' in st) st.bossMaxHp = Math.max(Number(st.bossMaxHp || 0), B.bossHp);
            if ('bossHP' in st) st.bossHP = Math.max(Number(st.bossHP || 0), B.bossHp);
          }
        }

        if (typeof api.hitGood === 'function'){
          const old = api.hitGood;
          api.hitGood = function(){
            const before = api.getState ? api.getState() : null;
            const hpBefore = before ? Number(before.bossHp || before.bossHP || 0) : 0;
            const scoreBefore = before ? Number(before.score || 0) : 0;

            const r = old.apply(this, arguments);

            const after = api.getState ? api.getState() : null;

            if (after){
              const hpAfter = Number(after.bossHp || after.bossHP || 0);
              const damage = hpBefore > hpAfter ? hpBefore - hpAfter : 0;

              if (damage > 0){
                const fixedDamage = Math.max(4, Math.round(damage * B.damageMul));
                const newHp = Math.max(0, hpBefore - fixedDamage);

                if ('bossHp' in after) after.bossHp = newHp;
                if ('bossHP' in after) after.bossHP = newHp;
              }

              const scoreAfter = Number(after.score || 0);
              const gained = scoreAfter - scoreBefore;

              if (gained > 0 && B.scoreMul !== 1){
                after.score = Math.round(scoreBefore + gained * B.scoreMul);
              }
            }

            return r;
          };
        }
      }catch(_){}
    });
  }

  function patchPowerupsClick(){
    document.addEventListener('click', function(ev){
      const card = ev.target && ev.target.closest
        ? ev.target.closest('.gjpu-card, [data-power], .power-card, .powerup-card')
        : null;

      if (!card) return;

      const t = text(card).toLowerCase();

      if (/shield|โล่|🛡/.test(t)){
        pulsePowerCard('Shield');
        bigFx('SHIELD!', 'power');
        toast('🛡️ Shield เปิดใช้: กันพลาดครั้งถัดไป');
        card.classList.add('on', 'active', 'ready');
      }

      if (/magnet|แม่เหล็ก|🧲/.test(t)){
        pulsePowerCard('Magnet');
        bigFx('MAGNET!', 'power');
        toast('🧲 Magnet เปิดใช้: ช่วยดึงอาหารดีใกล้เป้า');
        card.classList.add('on', 'active', 'ready');

        document.body.setAttribute('data-gj-magnet-active', '1');
        clearTimeout(patchPowerupsClick._magnetTimer);
        patchPowerupsClick._magnetTimer = setTimeout(function(){
          document.body.removeAttribute('data-gj-magnet-active');
        }, 7000);
      }

      if (/fever|⚡/.test(t)){
        pulsePowerCard('Fever');
        bigFx('FEVER!', 'power');
        toast('⚡ Fever เปิดใช้: คะแนนและจังหวะโจมตีแรงขึ้น');
        card.classList.add('on', 'active', 'ready');

        document.body.setAttribute('data-gj-fever-active', '1');
        clearTimeout(patchPowerupsClick._feverTimer);
        patchPowerupsClick._feverTimer = setTimeout(function(){
          document.body.removeAttribute('data-gj-fever-active');
        }, 8000);
      }
    }, true);
  }

  function patchCooldownButtonData(){
    document.addEventListener('click', function(ev){
      const btn = ev.target && ev.target.closest
        ? ev.target.closest('#gjrZoneBtn,[data-go-cooldown="1"]')
        : null;

      if (!btn) return;

      const summary = readSummaryFromDOM();
      const result = rankByRealDifficulty(summary);

      try{
        localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify({
          patch: PATCH,
          score: summary.score,
          goodHits: summary.goodHits,
          miss: summary.miss,
          bestCombo: summary.bestCombo,
          accuracy: summary.accuracy,
          rank: result.rank,
          stars: result.stars,
          minGoodToWin: B.minGoodToWin,
          diff: diff,
          savedAt: new Date().toISOString()
        }));
      }catch(_){}
    }, true);
  }

  function patchVersionBadge(){
    let badge = document.getElementById('gjBalanceVersionBadge');

    if (!badge){
      badge = document.createElement('div');
      badge.id = 'gjBalanceVersionBadge';
      badge.style.position = 'fixed';
      badge.style.right = 'calc(10px + env(safe-area-inset-right,0px))';
      badge.style.bottom = 'calc(10px + env(safe-area-inset-bottom,0px))';
      badge.style.zIndex = '2147480000';
      badge.style.padding = '6px 9px';
      badge.style.borderRadius = '999px';
      badge.style.background = 'rgba(15,23,42,.70)';
      badge.style.color = '#fff';
      badge.style.border = '1px solid rgba(255,255,255,.42)';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = '1000';
      badge.style.pointerEvents = 'none';
      badge.style.backdropFilter = 'blur(8px)';
      document.body.appendChild(badge);
    }

    badge.textContent = 'Mobile Boss Balance';
    badge.title = PATCH;
  }

  function exposeCheck(){
    window.GJ_MOBILE_BOSS_BALANCE_POWER_FINAL_CHECK = function(){
      const summary = readSummaryFromDOM();
      const result = rankByRealDifficulty(summary);

      const snap = {
        patch: PATCH,
        view,
        isMobile,
        diff,
        balance: B,
        lastKnown,
        domSummary: summary,
        rankPreview: result,
        expectedNormalGoodHits: 'normal ≈ 16–20 GOOD hits',
        targetReturn: 'goodjunk-launcher.html'
      };

      console.log('[GJ_MOBILE_BOSS_BALANCE_POWER_FINAL_CHECK]', snap);
      return snap;
    };
  }

  function boot(){
    document.body.setAttribute('data-gj-mobile-boss-balance-power-final', '1');

    patchBossHpIfGlobalExists();
    patchPowerupsClick();
    patchCooldownButtonData();
    patchVersionBadge();
    exposeCheck();

    let count = 0;
    const timer = setInterval(function(){
      count++;

      patchBossHpIfGlobalExists();
      patchSummaryRank();

      if (count > 3600){
        clearInterval(timer);
      }
    }, 300);

    try{
      localStorage.setItem('GJ_MOBILE_BOSS_BALANCE_POWER_FINAL_BOOT', JSON.stringify({
        patch: PATCH,
        view,
        diff,
        balance: B,
        savedAt: new Date().toISOString()
      }));
    }catch(_){}

    console.info('[GoodJunk Mobile Boss Balance + Power Final]', PATCH, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
