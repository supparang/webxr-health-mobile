// === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-fresh-only-v851b.js ===
// PATCH v20260608-GOODJUNK-SOLO-BOSS-SUMMARY-FRESH-ONLY-V851B
// เป้าหมาย:
// 1) ห้ามเปิด summary เองตอนโหลดหน้า
// 2) ล้าง summary เก่าที่ค้างจาก localStorage / overlay เดิม
// 3) เปิด summary เฉพาะเมื่อมี real play แล้วเท่านั้น
// 4) กัน overlay summary บังเมาส์ก่อนเริ่มเล่น
// 5) ให้เมาส์/มือถือคลิกอาหารได้ตามปกติ

(function(){
  'use strict';

  const PATCH = 'v20260608-GOODJUNK-SOLO-BOSS-SUMMARY-FRESH-ONLY-V851B';

  const state = {
    realPlay: false,
    firstHitAt: 0,
    hitCount: 0,
    goodHits: 0,
    junkHits: 0,
    fakeHits: 0,
    miss: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    opened: false,
    startAt: 0
  };

  function qs(name, fallback){
    try{
      const p = new URLSearchParams(location.search || '');
      const v = p.get(name);
      return v === null || v === '' ? fallback : v;
    }catch(_){
      return fallback;
    }
  }

  function now(){
    return Date.now();
  }

  function n(v, fallback){
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }

  function byId(id){
    return document.getElementById(id);
  }

  function log(){
    try{
      console.log.apply(console, ['[GoodJunk Summary Fresh V851B]'].concat([].slice.call(arguments)));
    }catch(_){}
  }

  function removeOldSummaryNodes(){
    const selectors = [
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
    ];

    selectors.forEach(function(sel){
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

  function clearStaleStorage(){
    const keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_PC_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_SUMMARY_LOCK',
      'GJ_SUMMARY_OPENED',
      'GJ_REWARD_SUMMARY_OPENED'
    ];

    keys.forEach(function(k){
      try{ localStorage.removeItem(k); }catch(_){}
      try{ sessionStorage.removeItem(k); }catch(_){}
    });
  }

  function unlockPlayPointer(){
    const area = byId('gjSoloBossArea');
    const main = byId('gjSoloBossMain');
    const start = byId('gjmStartOverlay');

    [document.body, main, area].forEach(function(el){
      if(!el) return;
      try{
        el.style.setProperty('pointer-events','auto','important');
      }catch(_){}
    });

    if(area){
      area.style.setProperty('z-index','30','important');
    }

    if(start && start.style.display === 'none'){
      start.style.setProperty('pointer-events','none','important');
    }
  }

  function markRealPlay(reason){
    if(!state.realPlay){
      state.realPlay = true;
      state.startAt = now();
      try{
        document.documentElement.dataset.gjRealPlay = '1';
        document.body.dataset.gjRealPlay = '1';
      }catch(_){}
      log('real play started:', reason || 'unknown');
    }
  }

  function readTextNumber(id){
    const el = byId(id);
    if(!el) return 0;
    return n(String(el.textContent || '').replace(/[^\d.-]/g,''), 0);
  }

  function readLiveStats(){
    const scoreFromHud = readTextNumber('gjmScore');
    const comboFromHud = readTextNumber('gjmCombo');

    const good =
      state.goodHits ||
      n(window.GJ_GOOD_HITS, 0) ||
      n(window.goodHits, 0) ||
      n(window.GJ_STATS && window.GJ_STATS.goodHits, 0) ||
      n(window.GJ_SOLO_STATS && window.GJ_SOLO_STATS.goodHits, 0);

    const junk =
      state.junkHits ||
      n(window.GJ_JUNK_HITS, 0) ||
      n(window.junkHits, 0) ||
      n(window.GJ_STATS && window.GJ_STATS.junkHits, 0) ||
      n(window.GJ_SOLO_STATS && window.GJ_SOLO_STATS.junkHits, 0);

    const fake =
      state.fakeHits ||
      n(window.GJ_FAKE_HITS, 0) ||
      n(window.fakeHits, 0) ||
      n(window.GJ_STATS && window.GJ_STATS.fakeHits, 0) ||
      n(window.GJ_SOLO_STATS && window.GJ_SOLO_STATS.fakeHits, 0);

    const miss =
      state.miss ||
      n(window.GJ_MISS, 0) ||
      n(window.miss, 0) ||
      n(window.misses, 0) ||
      n(window.GJ_STATS && (window.GJ_STATS.miss || window.GJ_STATS.misses), 0) ||
      n(window.GJ_SOLO_STATS && (window.GJ_SOLO_STATS.miss || window.GJ_SOLO_STATS.misses), 0);

    const maxCombo =
      state.maxCombo ||
      n(window.GJ_MAX_COMBO, 0) ||
      n(window.bestCombo, 0) ||
      n(window.GJ_STATS && (window.GJ_STATS.maxCombo || window.GJ_STATS.bestCombo), 0) ||
      n(window.GJ_SOLO_STATS && (window.GJ_SOLO_STATS.maxCombo || window.GJ_SOLO_STATS.bestCombo), 0) ||
      comboFromHud;

    const score =
      scoreFromHud ||
      state.score ||
      n(window.GJ_SCORE, 0) ||
      n(window.score, 0) ||
      n(window.GJ_STATS && window.GJ_STATS.score, 0) ||
      n(window.GJ_SOLO_STATS && window.GJ_SOLO_STATS.score, 0);

    return {
      score: Math.max(0, Math.round(score)),
      goodHits: Math.max(0, Math.round(good)),
      junkHits: Math.max(0, Math.round(junk)),
      fakeHits: Math.max(0, Math.round(fake)),
      miss: Math.max(0, Math.round(miss)),
      maxCombo: Math.max(0, Math.round(maxCombo))
    };
  }

  function calcAccuracy(good, miss, junk, fake){
    const total = good + miss + junk + fake;
    if(total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((good / total) * 100)));
  }

  function calcStars(score, acc, good, miss){
    if(good <= 0) return 1;
    if(acc >= 90 && score >= 700 && miss <= 1) return 5;
    if(acc >= 80 && score >= 450) return 4;
    if(acc >= 65 && score >= 250) return 3;
    if(acc >= 45) return 2;
    return 1;
  }

  function calcRank(score, acc, good){
    if(score >= 800 && acc >= 90 && good >= 18) return 'Legend Hero';
    if(score >= 600 && acc >= 80 && good >= 14) return 'Nutrition Champion';
    if(score >= 350 && acc >= 65 && good >= 9) return 'Food Hero';
    return 'Junior Hero';
  }

  function starsText(stars){
    let s = '';
    for(let i = 0; i < 5; i++){
      s += i < stars ? '⭐' : '☆';
    }
    return s;
  }

  function ensureStyle(){
    if(byId('gjFreshSummaryStyle')) return;

    const css = document.createElement('style');
    css.id = 'gjFreshSummaryStyle';
    css.textContent = `
      #gjFreshSummaryOverlay{
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(15,23,42,.54);
        backdrop-filter:blur(9px);
        -webkit-backdrop-filter:blur(9px);
        pointer-events:auto;
      }

      #gjFreshSummaryCard{
        width:min(520px, calc(100vw - 28px));
        max-height:calc(100dvh - 30px);
        overflow:auto;
        border-radius:28px;
        background:rgba(255,255,255,.98);
        border:3px solid rgba(255,255,255,.96);
        box-shadow:0 28px 80px rgba(15,23,42,.35);
        padding:22px;
        text-align:center;
        color:#111827;
      }

      #gjFreshSummaryCard h1{
        margin:5px 0 2px;
        font-size:clamp(30px, 7vw, 44px);
        line-height:1.05;
        letter-spacing:-.03em;
      }

      #gjFreshSummaryCard .cup{
        font-size:48px;
        line-height:1;
      }

      #gjFreshSummaryCard .stars{
        margin:8px 0 6px;
        font-size:28px;
        letter-spacing:1px;
      }

      #gjFreshSummaryCard .sub{
        margin:0 auto 14px;
        max-width:410px;
        color:#64748b;
        font-weight:900;
        font-size:13px;
        line-height:1.35;
      }

      #gjFreshSummaryGrid{
        display:grid;
        grid-template-columns:repeat(2, minmax(0, 1fr));
        gap:10px;
        margin-top:12px;
      }

      .gjFreshMetric{
        border-radius:17px;
        border:2px solid #e2e8f0;
        background:linear-gradient(180deg,#fff,#f8fafc);
        min-height:70px;
        padding:10px 8px;
        display:grid;
        align-content:center;
      }

      .gjFreshMetric b{
        display:block;
        font-size:28px;
        line-height:1;
        color:#0f172a;
      }

      .gjFreshMetric span{
        display:block;
        margin-top:5px;
        color:#64748b;
        font-size:12px;
        font-weight:1000;
      }

      #gjFreshExplain{
        margin-top:12px;
        border-radius:16px;
        border:2px solid rgba(250,204,21,.38);
        background:#fffbeb;
        color:#334155;
        padding:10px 12px;
        text-align:left;
        font-size:12px;
        line-height:1.35;
        font-weight:800;
      }

      #gjFreshBtns{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
        margin-top:14px;
      }

      #gjFreshBtns button{
        min-height:50px;
        border:0;
        border-radius:16px;
        color:#fff;
        font-size:14px;
        font-weight:1000;
        cursor:pointer;
        box-shadow:0 10px 24px rgba(15,23,42,.18);
      }

      #gjFreshReplay{
        background:linear-gradient(135deg,#22c55e,#16a34a);
      }

      #gjFreshCooldown{
        background:linear-gradient(135deg,#38bdf8,#2563eb);
      }

      @media (max-width:520px){
        #gjFreshSummaryOverlay{
          padding:10px;
          align-items:start;
          padding-top:calc(18px + env(safe-area-inset-top,0px));
        }

        #gjFreshSummaryCard{
          width:calc(100vw - 20px);
          border-radius:25px;
          padding:18px;
        }

        #gjFreshSummaryCard .cup{
          font-size:42px;
        }

        #gjFreshSummaryCard h1{
          font-size:34px;
        }

        #gjFreshSummaryGrid{
          gap:8px;
        }

        .gjFreshMetric{
          min-height:64px;
          border-radius:15px;
        }

        .gjFreshMetric b{
          font-size:24px;
        }

        #gjFreshBtns button{
          min-height:54px;
          font-size:13px;
        }
      }
    `;
    document.head.appendChild(css);
  }

  function buildLauncherUrl(){
    const base = 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';
    const u = new URL(base);
    u.searchParams.set('pid', qs('pid','anon'));
    u.searchParams.set('name', qs('name', qs('nick','Hero')));
    u.searchParams.set('diff', qs('diff','normal'));
    u.searchParams.set('time', qs('time','90'));
    u.searchParams.set('view', qs('view','mobile'));
    u.searchParams.set('zone','nutrition');
    u.searchParams.set('game','goodjunk');
    u.searchParams.set('mode','solo');
    return u.href;
  }

  function buildCooldownUrl(data){
    const gate = 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html';
    const back = buildLauncherUrl();
    const p = new URLSearchParams();

    p.set('phase','cooldown');
    p.set('zone','nutrition');
    p.set('game','goodjunk');
    p.set('gameId','goodjunk');
    p.set('mode','solo_boss');
    p.set('pid', qs('pid','anon'));
    p.set('name', qs('name', qs('nick','Hero')));
    p.set('diff', qs('diff','normal'));
    p.set('time', qs('time','90'));
    p.set('view', qs('view','mobile'));

    p.set('hub', back);
    p.set('next', back);
    p.set('back', back);
    p.set('launcher', back);
    p.set('return', back);
    p.set('returnUrl', back);

    p.set('score', String(data.score || 0));
    p.set('accuracy', String(data.accuracy || 0));
    p.set('goodHits', String(data.goodHits || 0));
    p.set('junkHits', String(data.junkHits || 0));
    p.set('fakeHits', String(data.fakeHits || 0));
    p.set('miss', String(data.miss || 0));
    p.set('bestCombo', String(data.maxCombo || 0));
    p.set('rank', String(data.rank || 'Junior Hero'));
    p.set('stars', String(data.stars || 1));
    p.set('from', 'goodjunk-summary-fresh-v851b');

    return gate + '?' + p.toString();
  }

  function openSummary(reason){
    if(state.opened) return;

    if(!state.realPlay && state.hitCount <= 0){
      log('blocked summary before real play:', reason);
      removeOldSummaryNodes();
      unlockPlayPointer();
      return;
    }

    const live = readLiveStats();
    const good = Math.max(live.goodHits, state.goodHits);
    const junk = Math.max(live.junkHits, state.junkHits);
    const fake = Math.max(live.fakeHits, state.fakeHits);
    const miss = Math.max(live.miss, state.miss);
    const combo = Math.max(live.maxCombo, state.maxCombo);
    const score = Math.max(live.score, state.score);

    const accuracy = calcAccuracy(good, miss, junk, fake);
    const stars = calcStars(score, accuracy, good, miss + junk + fake);
    const rank = calcRank(score, accuracy, good);

    const data = {
      patch: PATCH,
      reason: reason || 'unknown',
      score,
      accuracy,
      goodHits: good,
      junkHits: junk,
      fakeHits: fake,
      miss,
      maxCombo: combo,
      stars,
      rank,
      openedAt: new Date().toISOString()
    };

    state.opened = true;

    try{
      window.GJ_SOLO_BOSS_LAST_SUMMARY_FRESH = data;
      sessionStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY_FRESH', JSON.stringify(data));
    }catch(_){}

    removeOldSummaryNodes();
    ensureStyle();

    const overlay = document.createElement('div');
    overlay.id = 'gjFreshSummaryOverlay';
    overlay.dataset.goodjunkSummary = '1';
    overlay.dataset.summaryOwner = PATCH;

    overlay.innerHTML = `
      <section id="gjFreshSummaryCard" role="dialog" aria-modal="true" aria-label="GoodJunk summary">
        <div class="cup">🏆</div>
        <h1>สรุปผล GoodJunk</h1>
        <div class="stars">${starsText(stars)}</div>
        <p class="sub">
          จบเกมแล้ว แสดงผลหลังเล่นจริง พร้อมแยก “พลาด” ออกจาก “แตะ junk” เพื่อให้อ่านผลไม่งง
        </p>

        <div id="gjFreshSummaryGrid">
          <div class="gjFreshMetric"><b>${score}</b><span>คะแนนรวม</span></div>
          <div class="gjFreshMetric"><b>${accuracy}%</b><span>ความแม่นยำ</span></div>
          <div class="gjFreshMetric"><b>${good}</b><span>อาหารดี</span></div>
          <div class="gjFreshMetric"><b>${miss}</b><span>พลาด / miss</span></div>
          <div class="gjFreshMetric"><b>${junk}</b><span>แตะ junk</span></div>
          <div class="gjFreshMetric"><b>${fake}</b><span>อาหารหลอกตา</span></div>
          <div class="gjFreshMetric"><b>x${combo}</b><span>คอมโบสูงสุด</span></div>
          <div class="gjFreshMetric"><b>${rank}</b><span>Rank</span></div>
        </div>

        <div id="gjFreshExplain">
          <b>อธิบายผล:</b><br>
          • ความแม่นยำคิดจาก อาหารดี ÷ (อาหารดี + พลาด + junk + อาหารหลอกตา)<br>
          • อาหารดีควรใกล้เคียงจำนวนครั้งที่ตีโดนอาหารดีจริง<br>
          • ถ้าไม่แตะ junk และไม่พลาด ค่า miss ควรเป็น 0
        </div>

        <div id="gjFreshBtns">
          <button id="gjFreshReplay" type="button">🔁 เล่นอีกครั้ง</button>
          <button id="gjFreshCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    const replay = byId('gjFreshReplay');
    const cooldown = byId('gjFreshCooldown');

    if(replay){
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        const u = new URL(location.href);
        u.searchParams.set('run','play');
        u.searchParams.set('_fresh', String(Date.now()));
        location.href = u.href;
      }, true);
    }

    if(cooldown){
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        location.href = buildCooldownUrl(data);
      }, true);
    }

    log('summary opened:', data);
  }

  function looksLikeFoodTarget(el){
    if(!el) return false;

    const s = String(
      (el.className || '') + ' ' +
      (el.id || '') + ' ' +
      (el.dataset ? JSON.stringify(el.dataset) : '') + ' ' +
      (el.textContent || '')
    ).toLowerCase();

    return (
      s.includes('gjpu-item') ||
      s.includes('food') ||
      s.includes('good') ||
      s.includes('junk') ||
      s.includes('target') ||
      s.includes('อาหาร')
    );
  }

  function detectHitFromEvent(ev){
    const target = ev.target && ev.target.closest
      ? ev.target.closest('.gjpu-item,[data-kind],[data-type],[data-food],[data-good],[data-junk],button,div')
      : ev.target;

    if(!looksLikeFoodTarget(target)) return;

    markRealPlay(ev.type);

    state.hitCount += 1;
    state.firstHitAt = state.firstHitAt || now();

    const text = String(target.textContent || '').toLowerCase();
    const cls = String(target.className || '').toLowerCase();
    const ds = target.dataset || {};
    const pack = JSON.stringify(ds).toLowerCase() + ' ' + text + ' ' + cls;

    if(pack.includes('junk') || pack.includes('ขยะ') || pack.includes('เฟรนช์ฟราย') || pack.includes('cola')){
      state.junkHits += 1;
      state.combo = 0;
    }else if(pack.includes('fake') || pack.includes('หลอก')){
      state.fakeHits += 1;
      state.combo = 0;
    }else{
      state.goodHits += 1;
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += 14 + Math.min(30, state.combo * 2);
    }
  }

  function hookEvents(){
    ['pointerdown','click','touchstart'].forEach(function(type){
      document.addEventListener(type, detectHitFromEvent, true);
    });

    [
      'gj:game-start',
      'gj:start',
      'goodjunk:start',
      'goodjunk:game-start'
    ].forEach(function(name){
      window.addEventListener(name, function(){
        markRealPlay(name);
      }, true);
    });

    [
      'gj:food-hit',
      'gj:hit',
      'goodjunk:hit',
      'goodjunk:food-hit'
    ].forEach(function(name){
      window.addEventListener(name, function(ev){
        markRealPlay(name);
        state.hitCount += 1;

        const d = ev && ev.detail ? ev.detail : {};
        const kind = String(d.kind || d.type || d.group || '').toLowerCase();

        if(kind.includes('junk')){
          state.junkHits += 1;
          state.combo = 0;
        }else if(kind.includes('fake') || kind.includes('trick')){
          state.fakeHits += 1;
          state.combo = 0;
        }else{
          state.goodHits += 1;
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          state.score += n(d.score, 14 + Math.min(30, state.combo * 2));
        }
      }, true);
    });

    [
      'gj:miss',
      'goodjunk:miss'
    ].forEach(function(name){
      window.addEventListener(name, function(){
        markRealPlay(name);
        state.miss += 1;
        state.combo = 0;
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
          openSummary(name);
        }, 500);
      }, true);
    });
  }

  function blockEarlySummaryOpeners(){
    const originalDispatch = window.dispatchEvent.bind(window);

    window.dispatchEvent = function(ev){
      try{
        const type = ev && ev.type ? String(ev.type) : '';

        const isSummary =
          type.includes('summary') ||
          type === 'gj:reward-summary-shown';

        if(isSummary && !state.realPlay && state.hitCount <= 0){
          log('blocked dispatch summary before play:', type);
          removeOldSummaryNodes();
          unlockPlayPointer();
          return true;
        }
      }catch(_){}

      return originalDispatch(ev);
    };
  }

  function patchStartButton(){
    function bind(){
      const btn = byId('gjmStartBtn');
      const overlay = byId('gjmStartOverlay');

      if(!btn || btn.dataset.freshV851bBound === '1') return;

      btn.dataset.freshV851bBound = '1';

      btn.addEventListener('click', function(){
        markRealPlay('start-button');
        removeOldSummaryNodes();

        if(overlay){
          overlay.style.setProperty('display','none','important');
          overlay.style.setProperty('pointer-events','none','important');
        }

        unlockPlayPointer();
      }, true);
    }

    bind();
    setTimeout(bind, 300);
    setTimeout(bind, 900);
    setTimeout(bind, 1500);
  }

  function boot(){
    clearStaleStorage();
    removeOldSummaryNodes();
    unlockPlayPointer();
    blockEarlySummaryOpeners();
    hookEvents();
    patchStartButton();

    setInterval(function(){
      if(!state.realPlay && !state.opened){
        removeOldSummaryNodes();
        unlockPlayPointer();
      }
    }, 900);

    window.GJ_SUMMARY_FRESH_V851B = {
      patch: PATCH,
      state,
      openSummary,
      removeOldSummaryNodes,
      markRealPlay
    };

    log('installed');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
