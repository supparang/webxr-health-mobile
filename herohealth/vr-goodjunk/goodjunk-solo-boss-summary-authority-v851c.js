// === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-authority-v851c.js ===
// PATCH v20260608-GOODJUNK-SOLO-BOSS-SUMMARY-AUTHORITY-V851C
// Fix: ห้ามนับ junk จาก class/text กว้าง ๆ อีกต่อไป
// นับเฉพาะการกด target อาหารจริงเท่านั้น และ ignore overlay / button / boss / powerup / HUD

(function(){
  'use strict';

  const PATCH = 'v20260608-GOODJUNK-SOLO-BOSS-SUMMARY-AUTHORITY-V851C';

  const S = {
    started:false,
    ended:false,
    opened:false,
    goodHits:0,
    junkHits:0,
    fakeHits:0,
    miss:0,
    combo:0,
    maxCombo:0,
    score:0,
    acceptedTargetIds:new Set(),
    startedAt:0
  };

  function log(){
    try{
      console.log.apply(console, ['[GJ Summary Authority V851C]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function q(name, fallback){
    try{
      const p = new URLSearchParams(location.search || '');
      const v = p.get(name);
      return v === null || v === '' ? fallback : v;
    }catch(_){
      return fallback;
    }
  }

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function byId(id){
    return document.getElementById(id);
  }

  function markStarted(reason){
    if(!S.started){
      S.started = true;
      S.startedAt = Date.now();
      document.documentElement.dataset.gjAuthorityStarted = '1';
      document.body.dataset.gjAuthorityStarted = '1';
      log('started:', reason || 'unknown');
    }
  }

  function removeSummaryOverlays(){
    [
      '#gjFreshSummaryOverlay',
      '#gjAuthoritySummaryOverlay',
      '#gjSummaryOverlay',
      '#gjRewardOverlay',
      '#gjrOverlay',
      '.gj-summary-overlay',
      '.gjr-overlay',
      '.gjRewardOverlay',
      '.gj-summary',
      '.gjr-root',
      '[data-goodjunk-summary="1"]',
      '[data-gj-summary="1"]',
      '[data-summary-owner]'
    ].forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        try{ el.remove(); }catch(_){}
      });
    });
  }

  function clearOldSummaryStorage(){
    [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_LAST_SUMMARY_FRESH',
      'GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_PC_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_SUMMARY_LOCK',
      'GJ_SUMMARY_OPENED',
      'GJ_REWARD_SUMMARY_OPENED'
    ].forEach(function(k){
      try{ localStorage.removeItem(k); }catch(_){}
      try{ sessionStorage.removeItem(k); }catch(_){}
    });
  }

  function unlockPointer(){
    [document.body, byId('gjSoloBossMain'), byId('gjSoloBossArea')].forEach(function(el){
      if(!el) return;
      el.style.setProperty('pointer-events','auto','important');
    });
  }

  function isBlockedUi(el){
    if(!el) return true;

    const block = el.closest(
      '#gjAuthoritySummaryOverlay,' +
      '#gjFreshSummaryOverlay,' +
      '#gjSummaryOverlay,' +
      '#gjRewardOverlay,' +
      '#gjrOverlay,' +
      '#gjmHud,' +
      '#shellBackBtn,' +
      '#gjmStartBtn,' +
      '.shell-back,' +
      '.gjm-start,' +
      '.gjpu-root,' +
      '.gjpu-card,' +
      '.gjpu-toast,' +
      '.boss,' +
      '.boss-bar,' +
      '.bossHp,' +
      '.gj-boss,' +
      '[data-goodjunk-summary="1"],' +
      '[data-gj-summary="1"],' +
      'button'
    );

    return !!block;
  }

  function findFoodTarget(el){
    if(!el || !el.closest) return null;

    const target = el.closest(
      '.gjpu-item,' +
      '[data-food-kind],' +
      '[data-food-type],' +
      '[data-kind="good"],' +
      '[data-kind="junk"],' +
      '[data-kind="fake"],' +
      '[data-type="good"],' +
      '[data-type="junk"],' +
      '[data-type="fake"],' +
      '[data-good="1"],' +
      '[data-junk="1"],' +
      '[data-fake="1"]'
    );

    if(!target) return null;
    if(isBlockedUi(target)) return null;

    return target;
  }

  function targetId(el){
    if(!el) return '';
    if(!el.dataset.gjAuthorityId){
      el.dataset.gjAuthorityId = 'gjTarget_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    }
    return el.dataset.gjAuthorityId;
  }

  function getKind(el){
    const d = el.dataset || {};

    const explicit = String(
      d.foodKind ||
      d.foodType ||
      d.kind ||
      d.type ||
      d.group ||
      ''
    ).toLowerCase();

    if(explicit === 'good' || explicit === 'healthy' || explicit === 'protein' || explicit === 'fruit' || explicit === 'veg' || explicit === 'vegetable') return 'good';
    if(explicit === 'junk' || explicit === 'bad') return 'junk';
    if(explicit === 'fake' || explicit === 'trick' || explicit === 'trap') return 'fake';

    if(d.good === '1' || d.isGood === '1') return 'good';
    if(d.junk === '1' || d.isJunk === '1') return 'junk';
    if(d.fake === '1' || d.isFake === '1') return 'fake';

    const cls = String(el.className || '').toLowerCase();

    if(cls.includes('good-food') || cls.includes('is-good') || cls.includes('healthy')) return 'good';
    if(cls.includes('junk-food') || cls.includes('is-junk')) return 'junk';
    if(cls.includes('fake-food') || cls.includes('is-fake') || cls.includes('trap')) return 'fake';

    /*
      สำคัญ:
      default เป็น good ไม่ใช่ junk
      เพราะของเดิมนับ junk ผิดจากคำว่า goodjunk ใน class/path/text
    */
    return 'good';
  }

  function addHit(kind){
    markStarted('food-hit');

    if(kind === 'junk'){
      S.junkHits += 1;
      S.combo = 0;
      return;
    }

    if(kind === 'fake'){
      S.fakeHits += 1;
      S.combo = 0;
      return;
    }

    S.goodHits += 1;
    S.combo += 1;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    const comboBonus = Math.min(30, S.combo * 2);
    S.score += 14 + comboBonus;
  }

  function onPointer(ev){
    const target = findFoodTarget(ev.target);
    if(!target) return;

    const id = targetId(target);

    // กัน pointerdown + click นับซ้ำ target เดิม
    if(S.acceptedTargetIds.has(id)) return;
    S.acceptedTargetIds.add(id);

    const kind = getKind(target);
    addHit(kind);

    log('accepted target:', { kind, good:S.goodHits, junk:S.junkHits, fake:S.fakeHits, combo:S.combo });
  }

  function readCoreLiveScore(){
    const hudScore = byId('gjmScore');
    const v = hudScore ? n(String(hudScore.textContent || '').replace(/[^\d.-]/g,''), 0) : 0;

    // ใช้ score ที่มากกว่า เพราะ core อาจคำนวณคะแนนไว้แล้ว
    return Math.max(v, S.score);
  }

  function accuracy(){
    const total = S.goodHits + S.miss + S.junkHits + S.fakeHits;
    if(total <= 0) return 0;
    return Math.round((S.goodHits / total) * 100);
  }

  function stars(score, acc){
    if(S.goodHits <= 0) return 1;
    if(acc >= 90 && score >= 700 && S.junkHits === 0 && S.fakeHits === 0 && S.miss === 0) return 5;
    if(acc >= 80 && score >= 450) return 4;
    if(acc >= 65 && score >= 250) return 3;
    if(acc >= 45) return 2;
    return 1;
  }

  function rank(score, acc){
    if(score >= 800 && acc >= 90 && S.goodHits >= 18) return 'Legend Hero';
    if(score >= 600 && acc >= 80 && S.goodHits >= 14) return 'Nutrition Champion';
    if(score >= 350 && acc >= 65 && S.goodHits >= 9) return 'Food Hero';
    return 'Junior Hero';
  }

  function starText(k){
    let out = '';
    for(let i=0;i<5;i++) out += i < k ? '⭐' : '☆';
    return out;
  }

  function css(){
    if(byId('gjAuthoritySummaryStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjAuthoritySummaryStyle';
    style.textContent = `
      #gjAuthoritySummaryOverlay{
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(15,23,42,.54);
        backdrop-filter:blur(8px);
        -webkit-backdrop-filter:blur(8px);
        pointer-events:auto;
      }
      #gjAuthoritySummaryCard{
        width:min(520px,calc(100vw - 28px));
        max-height:calc(100dvh - 28px);
        overflow:auto;
        border-radius:28px;
        background:rgba(255,255,255,.98);
        border:3px solid rgba(255,255,255,.96);
        box-shadow:0 28px 80px rgba(15,23,42,.34);
        padding:22px;
        text-align:center;
        color:#0f172a;
      }
      #gjAuthoritySummaryCard .cup{
        font-size:46px;
        line-height:1;
      }
      #gjAuthoritySummaryCard h1{
        margin:6px 0 0;
        font-size:clamp(30px,7vw,44px);
        line-height:1.05;
      }
      #gjAuthoritySummaryCard .stars{
        margin:8px 0 6px;
        font-size:27px;
      }
      #gjAuthoritySummaryCard .sub{
        margin:0 auto 13px;
        max-width:410px;
        color:#64748b;
        font-size:13px;
        font-weight:900;
        line-height:1.35;
      }
      .gjAuthGrid{
        display:grid;
        grid-template-columns:repeat(2,1fr);
        gap:9px;
      }
      .gjAuthMetric{
        border:2px solid #e2e8f0;
        border-radius:17px;
        background:linear-gradient(180deg,#fff,#f8fafc);
        min-height:68px;
        display:grid;
        align-content:center;
        padding:10px 8px;
      }
      .gjAuthMetric b{
        display:block;
        font-size:27px;
        line-height:1;
      }
      .gjAuthMetric span{
        display:block;
        margin-top:5px;
        color:#64748b;
        font-size:12px;
        font-weight:1000;
      }
      .gjAuthExplain{
        margin-top:11px;
        padding:10px 12px;
        border-radius:16px;
        border:2px solid rgba(250,204,21,.38);
        background:#fffbeb;
        color:#334155;
        text-align:left;
        font-size:12px;
        font-weight:850;
        line-height:1.35;
      }
      .gjAuthBtns{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
        margin-top:13px;
      }
      .gjAuthBtns button{
        min-height:50px;
        border:0;
        border-radius:16px;
        color:#fff;
        font-size:14px;
        font-weight:1000;
        cursor:pointer;
      }
      #gjAuthReplay{ background:linear-gradient(135deg,#22c55e,#16a34a); }
      #gjAuthCooldown{ background:linear-gradient(135deg,#38bdf8,#2563eb); }

      @media(max-width:520px){
        #gjAuthoritySummaryOverlay{
          padding:10px;
          align-items:start;
          padding-top:calc(16px + env(safe-area-inset-top,0px));
        }
        #gjAuthoritySummaryCard{
          width:calc(100vw - 20px);
          padding:18px;
          border-radius:25px;
        }
        #gjAuthoritySummaryCard h1{ font-size:34px; }
        .gjAuthMetric{ min-height:64px; }
        .gjAuthMetric b{ font-size:24px; }
      }
    `;
    document.head.appendChild(style);
  }

  function launcherUrl(){
    const u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html');
    u.searchParams.set('pid', q('pid','anon'));
    u.searchParams.set('name', q('name', q('nick','Hero')));
    u.searchParams.set('diff', q('diff','normal'));
    u.searchParams.set('time', q('time','60'));
    u.searchParams.set('view', q('view','mobile'));
    u.searchParams.set('zone','nutrition');
    u.searchParams.set('game','goodjunk');
    u.searchParams.set('mode','solo');
    return u.href;
  }

  function cooldownUrl(data){
    const p = new URLSearchParams();
    const back = launcherUrl();

    p.set('phase','cooldown');
    p.set('zone','nutrition');
    p.set('game','goodjunk');
    p.set('gameId','goodjunk');
    p.set('mode','solo_boss');
    p.set('pid', q('pid','anon'));
    p.set('name', q('name', q('nick','Hero')));
    p.set('diff', q('diff','normal'));
    p.set('time', q('time','60'));
    p.set('view', q('view','mobile'));

    p.set('hub', back);
    p.set('next', back);
    p.set('back', back);
    p.set('launcher', back);
    p.set('return', back);
    p.set('returnUrl', back);

    p.set('score', String(data.score));
    p.set('accuracy', String(data.acc));
    p.set('goodHits', String(S.goodHits));
    p.set('junkHits', String(S.junkHits));
    p.set('fakeHits', String(S.fakeHits));
    p.set('miss', String(S.miss));
    p.set('bestCombo', String(S.maxCombo));
    p.set('rank', String(data.rank));
    p.set('stars', String(data.stars));

    return 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html?' + p.toString();
  }

  function showSummary(reason){
    if(S.opened) return;

    if(!S.started || S.goodHits + S.junkHits + S.fakeHits + S.miss <= 0){
      log('blocked summary: no real hit', reason);
      removeSummaryOverlays();
      unlockPointer();
      return;
    }

    S.opened = true;
    S.ended = true;

    const score = Math.round(readCoreLiveScore());
    const acc = accuracy();
    const st = stars(score, acc);
    const rk = rank(score, acc);

    const data = {
      patch:PATCH,
      reason:reason || 'unknown',
      score,
      acc,
      stars:st,
      rank:rk,
      goodHits:S.goodHits,
      junkHits:S.junkHits,
      fakeHits:S.fakeHits,
      miss:S.miss,
      maxCombo:S.maxCombo
    };

    try{
      window.GJ_SOLO_BOSS_AUTHORITATIVE_SUMMARY = data;
      sessionStorage.setItem('GJ_SOLO_BOSS_AUTHORITATIVE_SUMMARY', JSON.stringify(data));
    }catch(_){}

    removeSummaryOverlays();
    css();

    const overlay = document.createElement('div');
    overlay.id = 'gjAuthoritySummaryOverlay';
    overlay.dataset.goodjunkSummary = '1';
    overlay.dataset.summaryOwner = PATCH;

    overlay.innerHTML = `
      <section id="gjAuthoritySummaryCard" role="dialog" aria-modal="true">
        <div class="cup">🏆</div>
        <h1>สรุปผล GoodJunk</h1>
        <div class="stars">${starText(st)}</div>
        <p class="sub">จบเกมแล้ว แสดงผลจาก target อาหารที่กดจริงเท่านั้น</p>

        <div class="gjAuthGrid">
          <div class="gjAuthMetric"><b>${score}</b><span>คะแนนรวม</span></div>
          <div class="gjAuthMetric"><b>${acc}%</b><span>ความแม่นยำ</span></div>
          <div class="gjAuthMetric"><b>${S.goodHits}</b><span>อาหารดี</span></div>
          <div class="gjAuthMetric"><b>${S.miss}</b><span>พลาด / miss</span></div>
          <div class="gjAuthMetric"><b>${S.junkHits}</b><span>แตะ junk</span></div>
          <div class="gjAuthMetric"><b>${S.fakeHits}</b><span>อาหารหลอกตา</span></div>
          <div class="gjAuthMetric"><b>x${S.maxCombo}</b><span>คอมโบสูงสุด</span></div>
          <div class="gjAuthMetric"><b>${rk}</b><span>Rank</span></div>
        </div>

        <div class="gjAuthExplain">
          <b>อธิบายผล:</b><br>
          • นับเฉพาะ target อาหารที่กดจริง ไม่เอาปุ่ม/overlay/boss/powerup มาคิด<br>
          • Accuracy = อาหารดี ÷ (อาหารดี + miss + junk + อาหารหลอกตา)<br>
          • ถ้าเล่นถูก good อย่างเดียว ค่า junk / fake / miss ต้องเป็น 0
        </div>

        <div class="gjAuthBtns">
          <button id="gjAuthReplay" type="button">🔁 เล่นอีกครั้ง</button>
          <button id="gjAuthCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    byId('gjAuthReplay').addEventListener('click', function(ev){
      ev.preventDefault();
      const u = new URL(location.href);
      u.searchParams.set('_v', String(Date.now()));
      location.href = u.href;
    }, true);

    byId('gjAuthCooldown').addEventListener('click', function(ev){
      ev.preventDefault();
      location.href = cooldownUrl(data);
    }, true);

    log('summary shown', data);
  }

  function hookStart(){
    function bind(){
      const btn = byId('gjmStartBtn');
      const overlay = byId('gjmStartOverlay');

      if(!btn || btn.dataset.gjAuthorityStart === '1') return;
      btn.dataset.gjAuthorityStart = '1';

      btn.addEventListener('click', function(){
        markStarted('start-button');
        removeSummaryOverlays();

        if(overlay){
          overlay.style.setProperty('display','none','important');
          overlay.style.setProperty('pointer-events','none','important');
        }

        unlockPointer();
      }, true);
    }

    bind();
    setTimeout(bind, 300);
    setTimeout(bind, 900);
    setTimeout(bind, 1500);
  }

  function hookFoodClicks(){
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('click', onPointer, true);
  }

  function hookCoreEvents(){
    [
      'gj:game-start',
      'gj:start',
      'goodjunk:start',
      'goodjunk:game-start'
    ].forEach(function(name){
      window.addEventListener(name, function(){
        markStarted(name);
      }, true);
    });

    [
      'gj:miss',
      'goodjunk:miss'
    ].forEach(function(name){
      window.addEventListener(name, function(){
        markStarted(name);
        S.miss += 1;
        S.combo = 0;
      }, true);
    });

    [
      'gj:game-over',
      'gj:end',
      'gj:boss-defeated',
      'goodjunk:end',
      'goodjunk:game-over',
      'goodjunk:boss-defeated'
    ].forEach(function(name){
      window.addEventListener(name, function(){
        setTimeout(function(){
          showSummary(name);
        }, 650);
      }, true);
    });
  }

  function patchBadSummaryDispatch(){
    const originalDispatch = window.dispatchEvent.bind(window);

    window.dispatchEvent = function(ev){
      try{
        const type = ev && ev.type ? String(ev.type) : '';
        const isSummary = type.includes('summary') || type === 'gj:reward-summary-shown';

        if(isSummary && (!S.started || S.goodHits + S.junkHits + S.fakeHits + S.miss <= 0)){
          log('blocked summary dispatch before real target:', type);
          removeSummaryOverlays();
          unlockPointer();
          return true;
        }
      }catch(_){}

      return originalDispatch(ev);
    };
  }

  function boot(){
    clearOldSummaryStorage();
    removeSummaryOverlays();
    unlockPointer();

    hookStart();
    hookFoodClicks();
    hookCoreEvents();
    patchBadSummaryDispatch();

    setInterval(function(){
      if(!S.started && !S.opened){
        removeSummaryOverlays();
        unlockPointer();
      }
    }, 1000);

    window.GJ_AUTH_SUMMARY_V851C = {
      patch:PATCH,
      state:S,
      showSummary:showSummary,
      removeSummaryOverlays:removeSummaryOverlays
    };

    log('installed');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
