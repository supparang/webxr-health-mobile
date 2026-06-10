// === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-authority-v852a.js ===
// PATCH v20260608-GOODJUNK-SOLO-BOSS-SUMMARY-AUTHORITY-V852A2
// FINAL PURPOSE:
// 1) Summary owner ตัวเดียว
// 2) นับเฉพาะ target อาหารจริงที่กดจริง
// 3) ไม่ default unknown เป็น good/junk/fake — unknown = ignore
// 4) Shield block แล้ว junk ไม่ถูกนับ และไม่เป็น miss
// 5) สูตรเดียวทั้งไฟล์:
//    totalAttempts = goodHits + junkHits + fakeHits + missedGood
//    miss = missedGood + junkHits
//    accuracy = goodHits / totalAttempts * 100
// 6) เปิด summary หลังจบเกมจริงเท่านั้น และกัน summary ซ้อน/กระพริบ

(function(){
  'use strict';

  const PATCH = 'v20260608-GOODJUNK-SUMMARY-AUTHORITY-V852A2';

  if(window.__GJ_SUMMARY_AUTHORITY_V852A__){
    console.warn('[GJ Summary Authority V852A] already loaded');
    return;
  }
  window.__GJ_SUMMARY_AUTHORITY_V852A__ = true;

  const S = {
    started:false,
    ended:false,
    opened:false,

    goodHits:0,
    junkHits:0,
    fakeHits:0,
    missedGood:0,

    combo:0,
    maxCombo:0,
    score:0,

    startAt:0,
    endAt:0,
    endReason:'',

    acceptedIds:new Set(),
    lastHitAt:0
  };

  const FOOD_SELECTOR = [
    '.gjpu-item',
    '.gjm-food',
    '.food-target',
    '[data-food-kind]',
    '[data-food-type]',
    '[data-food-id]',
    '[data-food]',
    '[data-kind]',
    '[data-type]',
    '[data-good]',
    '[data-junk]',
    '[data-fake]'
  ].join(',');

  const BLOCK_SELECTOR = [
    '#gjmHud',
    '#shellBackBtn',
    '#gjmStartBtn',
    '#gjmStartOverlay',
    '#shellLoading',
    '#gjAuthoritySummaryOverlay',
    '#gjFreshSummaryOverlay',
    '#gjSummaryOverlay',
    '#gjRewardOverlay',
    '#gjrOverlay',
    '.shell-back',
    '.shell-loading',
    '.gjm-start',
    '.gjpu-root',
    '.gjpu-card',
    '.gjpu-toast',
    '.gj-summary-overlay',
    '.gjr-overlay',
    '.gjr-root',
    '.boss',
    '.boss-bar',
    '.bossHp',
    '.gj-boss',
    '.powerup',
    '.power-up',
    'button',
    'a',
    '[role="button"]',
    '[data-goodjunk-summary="1"]',
    '[data-gj-summary="1"]',
    '[data-summary-owner]'
  ].join(',');

  function log(){
    try{
      console.log.apply(console, ['[GJ Summary Authority V852A]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function warn(){
    try{
      console.warn.apply(console, ['[GJ Summary Authority V852A]'].concat([].slice.call(arguments)));
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

  function byId(id){
    return document.getElementById(id);
  }

  function textOf(el){
    return String(
      (el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      )) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function clearOldSummaryStorage(){
    [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_LAST_SUMMARY_FRESH',
      'GJ_SOLO_BOSS_AUTHORITATIVE_SUMMARY',
      'GJ_SOLO_BOSS_AUTHORITATIVE_SUMMARY_V852A',
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

  function removeSummaryOverlays(){
    [
      '#gjAuthoritySummaryOverlay',
      '#gjFreshSummaryOverlay',
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
        try{
          el.remove();
        }catch(_){
          try{
            el.style.setProperty('display','none','important');
            el.style.setProperty('pointer-events','none','important');
          }catch(__){}
        }
      });
    });
  }

  function unlockPointer(){
    [document.body, byId('gjSoloBossMain'), byId('gjSoloBossArea')].forEach(function(el){
      if(!el) return;
      try{
        el.style.setProperty('pointer-events','auto','important');
      }catch(_){}
    });
  }

  function markStarted(reason){
    if(S.started) return;

    S.started = true;
    S.startAt = Date.now();

    try{
      document.documentElement.dataset.gjAuthorityStarted = '1';
      document.body.dataset.gjAuthorityStarted = '1';
    }catch(_){}

    log('started:', reason || 'unknown');
  }

  function isBlockedUi(el){
    if(!el || !el.closest) return true;
    return !!el.closest(BLOCK_SELECTOR);
  }

  function findFoodTarget(raw){
    if(!raw || !raw.closest) return null;

    const target = raw.closest(FOOD_SELECTOR);
    if(!target) return null;

    if(isBlockedUi(target)) return null;

    return target;
  }

  function isShieldIgnoredTarget(target){
    if(!target || !target.dataset) return false;

    return (
      target.dataset.gjShieldBlocked === '1' ||
      target.dataset.gjAuthorityIgnore === '1' ||
      target.dataset.gjIgnoreSummary === '1'
    );
  }

  function shieldRecentlyBlocked(){
    const until = Number(window.GJ_IGNORE_NEXT_JUNK_HIT_UNTIL || 0);
    const last = Number(window.GJ_LAST_SHIELD_BLOCK_AT || 0);
    const t = Date.now();

    return (
      window.GJ_SHIELD_ACTIVE === true ||
      (until && t < until) ||
      (last && t - last < 1200)
    );
  }

  function ensureTargetId(el){
    if(!el) return '';

    const d = el.dataset || {};

    const existing =
      d.gjAuthorityId ||
      d.foodId ||
      d.id ||
      d.uid ||
      d.key ||
      d.spawnId ||
      '';

    if(existing){
      d.gjAuthorityId = existing;
      return existing;
    }

    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : {left:0,top:0,width:0,height:0};
    const txt = textOf(el).slice(0, 32);

    d.gjAuthorityId = [
      'target',
      Date.now(),
      Math.round(rect.left),
      Math.round(rect.top),
      Math.round(rect.width),
      Math.round(rect.height),
      Math.random().toString(36).slice(2, 8),
      txt
    ].join('_');

    return d.gjAuthorityId;
  }

  function getFoodKind(el){
    if(!el) return null;

    const d = el.dataset || {};

    const explicit = String(
      d.foodKind ||
      d.foodType ||
      d.kind ||
      d.type ||
      d.category ||
      d.group ||
      ''
    ).toLowerCase().trim();

    if([
      'good',
      'healthy',
      'protein',
      'fruit',
      'veg',
      'vegetable',
      'carb',
      'grain',
      'water',
      'milk'
    ].includes(explicit)){
      return 'good';
    }

    if([
      'junk',
      'bad',
      'unhealthy',
      'trash',
      'sugar',
      'fat',
      'salt'
    ].includes(explicit)){
      return 'junk';
    }

    if([
      'fake',
      'trap',
      'trick',
      'decoy',
      'bomb'
    ].includes(explicit)){
      return 'fake';
    }

    if(d.good === '1' || d.isGood === '1' || d.healthy === '1') return 'good';
    if(d.junk === '1' || d.isJunk === '1' || d.bad === '1') return 'junk';
    if(d.fake === '1' || d.isFake === '1' || d.trap === '1') return 'fake';

    const cls = String(el.className || '').toLowerCase();

    if(
      cls.includes('food-good') ||
      cls.includes('good-food') ||
      cls.includes('is-good') ||
      cls.includes('healthy-food') ||
      cls.includes('target-good')
    ){
      return 'good';
    }

    if(
      cls.includes('food-junk') ||
      cls.includes('junk-food') ||
      cls.includes('is-junk') ||
      cls.includes('target-junk')
    ){
      return 'junk';
    }

    if(
      cls.includes('food-fake') ||
      cls.includes('fake-food') ||
      cls.includes('is-fake') ||
      cls.includes('target-fake') ||
      cls.includes('trap-food')
    ){
      return 'fake';
    }

    return null;
  }

  function scoreForGood(combo){
    return 14 + Math.min(30, combo * 2);
  }

  function acceptHit(kind, source){
    markStarted(source || 'hit');

    if(kind === 'good'){
      S.goodHits += 1;
      S.combo += 1;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.score += scoreForGood(S.combo);
      return;
    }

    if(kind === 'junk'){
      S.junkHits += 1;
      S.combo = 0;
      return;
    }

    if(kind === 'fake'){
      S.fakeHits += 1;
      S.combo = 0;
    }
  }

  function handleFoodPointer(ev){
    if(S.opened || S.ended) return;

    const target = findFoodTarget(ev.target);
    if(!target) return;

    if(isShieldIgnoredTarget(target)){
      log('ignored shield-blocked target');
      return;
    }

    const kind = getFoodKind(target);

    if(!kind){
      warn('ignored unknown target kind', {
        text:textOf(target),
        className:String(target.className || ''),
        dataset:Object.assign({}, target.dataset || {})
      });
      return;
    }

    if(kind === 'junk' && shieldRecentlyBlocked()){
      log('ignored junk because shield is active/recently blocked');
      try{
        target.dataset.gjAuthorityIgnore = '1';
        target.dataset.gjIgnoreSummary = '1';
      }catch(_){}
      return;
    }

    const id = ensureTargetId(target);
    if(!id) return;

    if(S.acceptedIds.has(id)){
      return;
    }

    S.acceptedIds.add(id);
    S.lastHitAt = Date.now();

    try{
      target.dataset.gjAuthorityAccepted = '1';
      target.style.setProperty('pointer-events','none','important');
    }catch(_){}

    acceptHit(kind, ev.type);

    log('hit accepted', {
      kind,
      good:S.goodHits,
      junk:S.junkHits,
      fake:S.fakeHits,
      missedGood:S.missedGood,
      combo:S.combo,
      score:S.score
    });
  }

  function handleMissEvent(name, detail){
    if(S.opened || S.ended) return;

    const kind = String(
      (detail && (detail.kind || detail.type || detail.foodKind || detail.foodType)) || ''
    ).toLowerCase();

    if(
      (kind === 'junk' || kind === 'bad' || kind === 'unhealthy') &&
      shieldRecentlyBlocked()
    ){
      log('ignored miss event because shield blocked junk', name, detail || {});
      return;
    }

    markStarted(name || 'miss');

    if(kind === 'good' || kind === 'healthy'){
      S.missedGood += 1;
      S.combo = 0;
      log('missed good accepted', S.missedGood);
      return;
    }

    warn('ignored vague miss event', name, detail || {});
  }

  function totalAttempts(){
    return S.goodHits + S.junkHits + S.fakeHits + S.missedGood;
  }

  function missTotal(){
    return S.missedGood + S.junkHits;
  }

  function accuracy(){
    const total = totalAttempts();
    if(total <= 0) return 0;
    return Math.round((S.goodHits / total) * 100);
  }

  function stars(score, acc){
    const miss = missTotal();

    if(S.goodHits <= 0) return 1;
    if(acc === 100 && S.goodHits >= 18 && miss === 0 && S.fakeHits === 0) return 5;
    if(acc >= 90 && score >= 700) return 5;
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
    for(let i = 0; i < 5; i++){
      out += i < k ? '⭐' : '☆';
    }
    return out;
  }

  function finalScore(){
    return Math.max(0, Math.round(S.score));
  }

  function validateData(data){
    const expectedTotal =
      data.goodHits +
      data.junkHits +
      data.fakeHits +
      data.missedGood;

    const expectedMiss =
      data.missedGood +
      data.junkHits;

    const expectedAccuracy =
      expectedTotal > 0
        ? Math.round((data.goodHits / expectedTotal) * 100)
        : 0;

    const ok =
      data.totalAttempts === expectedTotal &&
      data.miss === expectedMiss &&
      data.accuracy === expectedAccuracy;

    if(!ok){
      warn('summary formula mismatch', {
        data,
        expectedTotal,
        expectedMiss,
        expectedAccuracy
      });
    }

    return ok;
  }

  function makeSummaryData(reason){
    const score = finalScore();
    const acc = accuracy();
    const st = stars(score, acc);
    const rk = rank(score, acc);

    const data = {
      patch:PATCH,
      reason:reason || 'unknown',

      score,
      goodHits:S.goodHits,
      junkHits:S.junkHits,
      fakeHits:S.fakeHits,
      missedGood:S.missedGood,

      miss:missTotal(),
      totalAttempts:totalAttempts(),
      accuracy:acc,

      maxCombo:S.maxCombo,
      stars:st,
      rank:rk,

      startedAt:S.startAt || 0,
      endedAt:S.endAt || Date.now()
    };

    data.formulaOk = validateData(data);

    return data;
  }

  function ensureStyle(){
    if(byId('gjAuthoritySummaryStyleV852A')) return;

    const style = document.createElement('style');
    style.id = 'gjAuthoritySummaryStyleV852A';
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
        width:min(540px,calc(100vw - 28px));
        max-height:calc(100dvh - 28px);
        overflow:auto;
        border-radius:28px;
        background:rgba(255,255,255,.985);
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
        max-width:430px;
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
        color:#0f172a;
      }

      .gjAuthMetric span{
        display:block;
        margin-top:5px;
        color:#64748b;
        font-size:12px;
        font-weight:1000;
      }

      .gjAuthMetric.warn{
        border-color:rgba(239,68,68,.35);
        background:#fff1f2;
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

      #gjAuthReplay{
        background:linear-gradient(135deg,#22c55e,#16a34a);
      }

      #gjAuthCooldown{
        background:linear-gradient(135deg,#38bdf8,#2563eb);
      }

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

        #gjAuthoritySummaryCard h1{
          font-size:34px;
        }

        .gjAuthGrid{
          gap:8px;
        }

        .gjAuthMetric{
          min-height:62px;
          border-radius:15px;
        }

        .gjAuthMetric b{
          font-size:23px;
        }

        .gjAuthBtns button{
          min-height:54px;
          font-size:13px;
        }
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
    u.searchParams.set('cat','nutrition');
    u.searchParams.set('game','goodjunk');
    u.searchParams.set('gameId','goodjunk');
    u.searchParams.set('mode','solo');
    u.searchParams.set('entry','summary-v852a2');

    return u.href;
  }

  function cooldownUrl(data){
    const p = new URLSearchParams();
    const back = launcherUrl();

    p.set('phase','cooldown');
    p.set('zone','nutrition');
    p.set('cat','nutrition');
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
    p.set('accuracy', String(data.accuracy));
    p.set('goodHits', String(data.goodHits));
    p.set('junkHits', String(data.junkHits));
    p.set('fakeHits', String(data.fakeHits));
    p.set('missedGood', String(data.missedGood));
    p.set('miss', String(data.miss));
    p.set('totalAttempts', String(data.totalAttempts));
    p.set('bestCombo', String(data.maxCombo));
    p.set('rank', String(data.rank));
    p.set('stars', String(data.stars));
    p.set('formulaOk', String(data.formulaOk ? 1 : 0));
    p.set('from', 'goodjunk-summary-authority-v852a2');

    return 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html?' + p.toString();
  }

  function showSummary(reason){
    if(S.opened) return;

    if(!S.started || totalAttempts() <= 0){
      warn('blocked summary: no valid food target was counted', {
        reason,
        started:S.started,
        totalAttempts:totalAttempts()
      });
      removeSummaryOverlays();
      unlockPointer();
      return;
    }

    S.opened = true;
    S.ended = true;
    S.endAt = Date.now();
    S.endReason = reason || 'unknown';

    const data = makeSummaryData(reason);

    try{
      window.GJ_SOLO_BOSS_AUTHORITATIVE_SUMMARY_V852A = data;
      sessionStorage.setItem('GJ_SOLO_BOSS_AUTHORITATIVE_SUMMARY_V852A', JSON.stringify(data));
    }catch(_){}

    removeSummaryOverlays();
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.id = 'gjAuthoritySummaryOverlay';
    overlay.dataset.goodjunkSummary = '1';
    overlay.dataset.gjSummary = '1';
    overlay.dataset.summaryOwner = PATCH;

    overlay.innerHTML = `
      <section id="gjAuthoritySummaryCard" role="dialog" aria-modal="true" aria-label="GoodJunk summary">
        <div class="cup">🏆</div>
        <h1>สรุปผล GoodJunk</h1>
        <div class="stars">${starText(data.stars)}</div>
        <p class="sub">
          จบเกมแล้ว • Summary นี้คำนวณจากสูตรเดียว ไม่ใช้ค่า summary เก่า
        </p>

        <div class="gjAuthGrid">
          <div class="gjAuthMetric"><b>${data.score}</b><span>คะแนนรวม</span></div>
          <div class="gjAuthMetric"><b>${data.accuracy}%</b><span>ความแม่นยำ</span></div>
          <div class="gjAuthMetric"><b>${data.goodHits}</b><span>อาหารดีที่กดถูก</span></div>
          <div class="gjAuthMetric"><b>${data.junkHits}</b><span>แตะ junk</span></div>
          <div class="gjAuthMetric"><b>${data.fakeHits}</b><span>อาหารหลอกตา</span></div>
          <div class="gjAuthMetric"><b>${data.missedGood}</b><span>อาหารดีที่พลาด</span></div>
          <div class="gjAuthMetric"><b>${data.miss}</b><span>Miss รวม</span></div>
          <div class="gjAuthMetric"><b>${data.totalAttempts}</b><span>จำนวนครั้งที่คิดผล</span></div>
          <div class="gjAuthMetric"><b>x${data.maxCombo}</b><span>คอมโบสูงสุด</span></div>
          <div class="gjAuthMetric ${data.formulaOk ? '' : 'warn'}"><b>${data.formulaOk ? 'OK' : 'CHECK'}</b><span>สูตรคำนวณ</span></div>
        </div>

        <div class="gjAuthExplain">
          <b>สูตรที่ใช้:</b><br>
          totalAttempts = goodHits + junkHits + fakeHits + missedGood<br>
          miss = missedGood + junkHits<br>
          accuracy = goodHits ÷ totalAttempts × 100<br>
          ถ้า Shield กัน junk ได้ junk และ miss ต้องไม่เพิ่ม
        </div>

        <div class="gjAuthBtns">
          <button id="gjAuthReplay" type="button">🔁 เล่นอีกครั้ง</button>
          <button id="gjAuthCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    const replay = byId('gjAuthReplay');
    const cooldown = byId('gjAuthCooldown');

    if(replay){
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        const u = new URL(location.href);
        u.searchParams.set('_v', String(Date.now()));
        location.href = u.href;
      }, true);
    }

    if(cooldown){
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        location.href = cooldownUrl(data);
      }, true);
    }

    log('summary shown', data);
  }

  function bindStartButton(){
    function bind(){
      const btn = byId('gjmStartBtn');
      const overlay = byId('gjmStartOverlay');

      if(!btn || btn.dataset.gjAuthorityV852aStart === '1') return;
      btn.dataset.gjAuthorityV852aStart = '1';

      btn.addEventListener('click', function(){
        markStarted('start-button');

        removeSummaryOverlays();
        unlockPointer();

        if(overlay){
          overlay.style.setProperty('display','none','important');
          overlay.style.setProperty('pointer-events','none','important');
        }

        log('start button captured');
      }, true);
    }

    bind();
    setTimeout(bind, 250);
    setTimeout(bind, 800);
    setTimeout(bind, 1500);
  }

  function hookFoodEvents(){
    document.addEventListener('pointerdown', handleFoodPointer, true);
    document.addEventListener('click', handleFoodPointer, true);

    [
      'gj:food-hit',
      'goodjunk:food-hit',
      'gj:hit',
      'goodjunk:hit'
    ].forEach(function(name){
      window.addEventListener(name, function(ev){
        if(S.opened || S.ended) return;

        const d = ev && ev.detail ? ev.detail : {};
        const kindRaw = String(d.kind || d.type || d.foodKind || d.foodType || '').toLowerCase();

        let kind = null;

        if(['good','healthy','protein','fruit','veg','vegetable'].includes(kindRaw)){
          kind = 'good';
        }else if(['junk','bad','unhealthy'].includes(kindRaw)){
          kind = 'junk';
        }else if(['fake','trap','trick','decoy'].includes(kindRaw)){
          kind = 'fake';
        }

        if(!kind){
          warn('ignored vague hit event', name, d);
          return;
        }

        if(kind === 'junk' && shieldRecentlyBlocked()){
          log('ignored junk event because shield is active/recently blocked', name, d);
          return;
        }

        const id = String(d.id || d.foodId || d.targetId || d.uid || '');
        const eventKey = id ? ('event_' + id) : ('event_' + name + '_' + Date.now() + '_' + Math.random());

        if(S.acceptedIds.has(eventKey)) return;
        S.acceptedIds.add(eventKey);

        acceptHit(kind, name);
      }, true);
    });

    [
      'gj:miss',
      'goodjunk:miss'
    ].forEach(function(name){
      window.addEventListener(name, function(ev){
        handleMissEvent(name, ev && ev.detail ? ev.detail : {});
      }, true);
    });
  }

  function hookEndEvents(){
    [
      'gj:game-over',
      'gj:end',
      'gj:boss-defeated',
      'goodjunk:end',
      'goodjunk:game-over',
      'goodjunk:boss-defeated'
    ].forEach(function(name){
      window.addEventListener(name, function(){
        if(S.opened) return;

        setTimeout(function(){
          showSummary(name);
        }, 650);
      }, true);
    });
  }

  function blockEarlyOldSummary(){
    const originalDispatch = window.dispatchEvent.bind(window);

    window.dispatchEvent = function(ev){
      try{
        const type = ev && ev.type ? String(ev.type) : '';
        const isOldSummary =
          type.includes('summary') ||
          type === 'gj:reward-summary-shown';

        if(isOldSummary){
          if(!S.opened){
            warn('blocked old summary dispatch', type);
            removeSummaryOverlays();
            unlockPointer();
            return true;
          }
        }
      }catch(_){}

      return originalDispatch(ev);
    };
  }

  function boot(){
    clearOldSummaryStorage();
    removeSummaryOverlays();
    unlockPointer();

    bindStartButton();
    hookFoodEvents();
    hookEndEvents();
    blockEarlyOldSummary();

    setInterval(function(){
      if(!S.started && !S.opened){
        removeSummaryOverlays();
        unlockPointer();
      }
    }, 1000);

    window.GJ_SUMMARY_AUTHORITY_V852A = {
      patch:PATCH,
      state:S,
      showSummary:showSummary,
      makeSummaryData:makeSummaryData,
      removeSummaryOverlays:removeSummaryOverlays,
      formula:{
        totalAttempts:'goodHits + junkHits + fakeHits + missedGood',
        miss:'missedGood + junkHits',
        accuracy:'goodHits / totalAttempts * 100'
      }
    };

    log('installed', PATCH);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();