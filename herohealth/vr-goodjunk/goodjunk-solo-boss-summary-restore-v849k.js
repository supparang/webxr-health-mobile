// === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-restore-v849k.js ===
// PATCH v20260606-GOODJUNK-SOLO-BOSS-SUMMARY-RESTORE-V849K
// Purpose:
// - กัน Summary โผล่ก่อนเล่นจริง
// - กัน Summary ถูก block หลังชนะบอสจริง
// - เปิด Summary เฉพาะเมื่อมี real play แล้วเท่านั้น
// - ใช้ได้ทั้ง mobile / pc ของ GoodJunk Solo Boss

(function(){
  'use strict';

  if(window.GJ_SUMMARY_RESTORE_V849K_LOADED) return;
  window.GJ_SUMMARY_RESTORE_V849K_LOADED = true;

  const PATCH = 'v20260606-GOODJUNK-SOLO-BOSS-SUMMARY-RESTORE-V849K';

  const state = {
    startedAt: 0,
    realPlay: false,
    summaryOpened: false,
    lastSummaryAt: 0,
    lastGoodHits: 0,
    lastScore: 0,
    lastCombo: 0,
    lastReason: '',
    earlyBlockCount: 0
  };

  function now(){
    return Date.now();
  }

  function textOf(el){
    return String(
      el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute?.('aria-label') ||
        el.getAttribute?.('title') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function numberFromText(txt){
    const m = String(txt || '').match(/-?\d+/);
    return m ? Number(m[0]) || 0 : 0;
  }

  function readScore(){
    const el = document.getElementById('gjmScore');
    return el ? numberFromText(textOf(el)) : 0;
  }

  function readCombo(){
    const el = document.getElementById('gjmCombo');
    return el ? numberFromText(textOf(el)) : 0;
  }

  function readGoodHits(){
    const candidates = [
      window.GJ_GOOD_HITS,
      window.goodHits,
      window.gjGoodHits,
      window.GJ_STATS && window.GJ_STATS.goodHits,
      window.GJ_GAME_STATS && window.GJ_GAME_STATS.goodHits,
      window.GJ_SOLO_BOSS_STATE && window.GJ_SOLO_BOSS_STATE.goodHits,
      window.GJ_SOLO_BOSS_STATE && window.GJ_SOLO_BOSS_STATE.good
    ];

    for(const v of candidates){
      const n = Number(v);
      if(Number.isFinite(n) && n > 0) return n;
    }

    return state.lastGoodHits || 0;
  }

  function hasRealPlay(){
    const score = Math.max(readScore(), Number(state.lastScore || 0));
    const combo = Math.max(readCombo(), Number(state.lastCombo || 0));
    const goodHits = Math.max(readGoodHits(), Number(state.lastGoodHits || 0));

    if(state.realPlay) return true;
    if(score > 0) return true;
    if(combo > 0) return true;
    if(goodHits > 0) return true;

    return false;
  }

  function markRealPlay(reason){
    state.realPlay = true;
    state.lastReason = reason || 'real-play';

    if(!state.startedAt){
      state.startedAt = now();
    }

    state.lastScore = Math.max(state.lastScore, readScore());
    state.lastCombo = Math.max(state.lastCombo, readCombo());
    state.lastGoodHits = Math.max(state.lastGoodHits, readGoodHits());

    try{
      document.documentElement.dataset.gjRealPlay = '1';
      document.body.dataset.gjRealPlay = '1';
    }catch(_){}
  }

  function isSummaryNode(el){
    if(!el) return false;

    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const txt = textOf(el);

    return (
      id.includes('summary') ||
      id.includes('reward') ||
      id.includes('result') ||
      cls.includes('summary') ||
      cls.includes('reward') ||
      cls.includes('result') ||
      txt.includes('ชนะบอสแบบสุดยอด') ||
      txt.includes('ชนะบอสแล้ว') ||
      txt.includes('Cooldown แล้วกลับเลือกโหมด') ||
      txt.includes('เล่นอีกครั้ง')
    );
  }

  function looksLikeSummaryOpen(){
    const nodes = Array.from(document.querySelectorAll(
      '#gjRewardSummary,#gjrSummary,.gjr-summary,.gj-reward,.reward-summary,.summary-modal,[data-gj-summary],[data-summary]'
    ));

    if(nodes.some(function(el){
      const cs = getComputedStyle(el);
      return cs.display !== 'none' &&
             cs.visibility !== 'hidden' &&
             Number(cs.opacity || 1) > 0.05;
    })){
      return true;
    }

    const bodyText = textOf(document.body);
    return (
      bodyText.includes('ชนะบอสแบบสุดยอด') ||
      bodyText.includes('Cooldown แล้วกลับเลือกโหมด') ||
      bodyText.includes('เลือกอาหารดีและหลบอาหารขยะได้เยี่ยมมาก')
    );
  }

  function hideBadEarlySummary(reason){
    if(hasRealPlay()) return false;

    state.earlyBlockCount++;

    const nodes = Array.from(document.querySelectorAll(
      '#gjRewardSummary,#gjrSummary,.gjr-summary,.gj-reward,.reward-summary,.summary-modal,[data-gj-summary],[data-summary]'
    ));

    nodes.forEach(function(el){
      try{
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
        el.style.setProperty('opacity','0','important');
        el.style.setProperty('pointer-events','none','important');
        el.dataset.gjBlockedEarlySummary = PATCH;
      }catch(_){}
    });

    try{
      console.warn('[GoodJunk Summary Restore V849K] blocked early summary', {
        patch: PATCH,
        reason: reason || '',
        score: readScore(),
        combo: readCombo(),
        goodHits: readGoodHits(),
        blockedCount: state.earlyBlockCount
      });
    }catch(_){}

    return true;
  }

  function collectSummaryData(reason){
    const score = Math.max(readScore(), Number(state.lastScore || 0));
    const combo = Math.max(readCombo(), Number(state.lastCombo || 0));
    const goodHits = Math.max(readGoodHits(), Number(state.lastGoodHits || 0));

    let accuracy = 0;
    try{
      const badHits =
        Number(window.GJ_JUNK_HITS || window.junkHits || 0) +
        Number(window.GJ_FAKE_HITS || window.fakeHits || 0);

      const total = Math.max(1, goodHits + badHits);
      accuracy = Math.round((goodHits / total) * 100);
    }catch(_){
      accuracy = goodHits > 0 ? 100 : 0;
    }

    const stars =
      accuracy >= 90 && goodHits >= 8 ? 5 :
      accuracy >= 75 && goodHits >= 5 ? 4 :
      accuracy >= 60 ? 3 :
      accuracy >= 40 ? 2 : 1;

    return {
      patch: PATCH,
      reason: reason || 'summary-restore',
      game: 'goodjunk',
      mode: 'solo_boss',
      result: 'win',
      win: true,
      score: score,
      goodHits: goodHits,
      accuracy: accuracy,
      acc: accuracy,
      combo: combo,
      bestCombo: combo,
      stars: stars,
      coins: Math.max(20, Math.round(score * 0.3)),
      badge: stars >= 5 ? 'Nutrition Champion' : 'Good Food Hero',
      missionDone: goodHits >= 8 ? 2 : 1,
      hasRealPlay: hasRealPlay(),
      savedAt: new Date().toISOString()
    };
  }

  function saveSummary(data){
    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(data));
      localStorage.setItem('GJ_FULL_3D_VR_LAST_SUMMARY', JSON.stringify(data));
      localStorage.setItem('GJ_SOLO_BOSS_SUMMARY_RESTORE_V849K_LAST', JSON.stringify(data));
    }catch(_){}
  }

  function openNativeSummary(data){
    const fnList = [
      window.GJ_SHOW_REWARD_SUMMARY,
      window.showRewardSummary,
      window.gjShowRewardSummary,
      window.GJ_OPEN_SUMMARY,
      window.openSummary,
      window.showSummary
    ].filter(Boolean);

    for(const fn of fnList){
      try{
        fn(data);
        return true;
      }catch(e){}
    }

    return false;
  }

  function openFallbackSummary(data){
    if(document.getElementById('gjSummaryRestoreV849K')) return;

    const overlay = document.createElement('section');
    overlay.id = 'gjSummaryRestoreV849K';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-label','GoodJunk summary');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:grid',
      'place-items:center',
      'padding:18px',
      'background:rgba(15,23,42,.42)',
      'backdrop-filter:blur(5px)'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width:min(520px,calc(100vw - 32px))',
      'border-radius:28px',
      'background:rgba(255,255,255,.96)',
      'border:3px solid rgba(255,255,255,.95)',
      'box-shadow:0 28px 80px rgba(15,23,42,.34)',
      'padding:22px',
      'text-align:center',
      'font-family:system-ui,-apple-system,Segoe UI,sans-serif',
      'color:#172033'
    ].join(';');

    card.innerHTML = `
      <div style="font-size:54px;line-height:1">🏆</div>
      <h1 style="margin:8px 0 0;font-size:34px;line-height:1.05;color:#0f172a">ชนะบอสแบบสุดยอด!</h1>
      <div style="font-size:24px;margin-top:6px;color:#facc15">${'⭐'.repeat(Math.max(1, Math.min(5, Number(data.stars || 1))))}</div>
      <p style="margin:8px 0 14px;color:#64748b;font-weight:900">เลือกอาหารดีและหลบอาหารขยะได้เยี่ยมมาก</p>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px">
        <div style="border:2px solid #e2e8f0;border-radius:16px;padding:10px"><b style="font-size:24px">${data.score || 0}</b><br><span style="font-size:12px;font-weight:900;color:#64748b">คะแนน</span></div>
        <div style="border:2px solid #e2e8f0;border-radius:16px;padding:10px"><b style="font-size:24px">${data.accuracy || 0}%</b><br><span style="font-size:12px;font-weight:900;color:#64748b">ความแม่นยำ</span></div>
        <div style="border:2px solid #e2e8f0;border-radius:16px;padding:10px"><b style="font-size:24px">${data.goodHits || 0}</b><br><span style="font-size:12px;font-weight:900;color:#64748b">อาหารดี</span></div>
        <div style="border:2px solid #e2e8f0;border-radius:16px;padding:10px"><b style="font-size:24px">x${data.bestCombo || data.combo || 0}</b><br><span style="font-size:12px;font-weight:900;color:#64748b">คอมโบสูงสุด</span></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <button id="gjSummaryReplayV849K" type="button" style="min-height:48px;border:0;border-radius:16px;background:#22c55e;color:#fff;font-weight:1000;font-size:15px">🔁 เล่นอีกครั้ง</button>
        <button id="gjSummaryCooldownV849K" type="button" style="min-height:48px;border:0;border-radius:16px;background:#2563eb;color:#fff;font-weight:1000;font-size:15px">🧘 Cooldown แล้วกลับเลือกโหมด</button>
      </div>
    `;

    overlay.appendChild(card);
    document.documentElement.appendChild(overlay);

    const replay = document.getElementById('gjSummaryReplayV849K');
    const cooldown = document.getElementById('gjSummaryCooldownV849K');

    replay?.addEventListener('click', function(){
      const u = new URL(location.href);
      u.searchParams.set('run','play');
      u.searchParams.set('phase','main');
      u.searchParams.set('replay','1');
      location.href = u.toString();
    });

    cooldown?.addEventListener('click', function(){
      if(window.GJ_SOLO_BOSS_SHELL && window.GJ_SOLO_BOSS_SHELL.goCooldown){
        window.GJ_SOLO_BOSS_SHELL.goCooldown(data);
        return;
      }

      const launcher = 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';
      location.href = launcher;
    });
  }

  function openSummary(reason){
    if(state.summaryOpened) return;
    if(!hasRealPlay()){
      hideBadEarlySummary(reason || 'open-summary-no-real-play');
      return;
    }

    state.summaryOpened = true;
    state.lastSummaryAt = now();

    const data = collectSummaryData(reason || 'open-summary');
    saveSummary(data);

    try{
      window.dispatchEvent(new CustomEvent('gj:reward-summary-shown', {
        detail: data
      }));
    }catch(_){}

    const openedNative = openNativeSummary(data);
    if(!openedNative){
      openFallbackSummary(data);
    }

    console.log('[GoodJunk Summary Restore V849K] opened', data);
  }

  function patchFinishFunctions(){
    const names = [
      'finishGame',
      'endGame',
      'gameOver',
      'completeGame',
      'showRewardSummary',
      'showSummary',
      'openSummary'
    ];

    names.forEach(function(name){
      const old = window[name];
      if(typeof old !== 'function' || old.__gjSummaryRestoreV849K) return;

      const wrapped = function(){
        if(!hasRealPlay()){
          hideBadEarlySummary('wrapped-' + name);
          return;
        }

        markRealPlay('wrapped-' + name);

        try{
          const r = old.apply(this, arguments);
          window.setTimeout(function(){
            if(!looksLikeSummaryOpen()){
              openSummary('wrapped-fallback-' + name);
            }
          }, 120);
          return r;
        }catch(e){
          openSummary('wrapped-error-' + name);
        }
      };

      wrapped.__gjSummaryRestoreV849K = true;
      window[name] = wrapped;
    });
  }

  function observeSummaryNodes(){
    const mo = new MutationObserver(function(muts){
      for(const m of muts){
        for(const node of m.addedNodes || []){
          if(node.nodeType !== 1) continue;

          if(isSummaryNode(node) || textOf(node).includes('ชนะบอสแบบสุดยอด')){
            if(!hasRealPlay()){
              hideBadEarlySummary('mutation-summary-before-play');
            }else{
              state.summaryOpened = true;
              state.lastSummaryAt = now();
            }
          }
        }
      }
    });

    try{
      mo.observe(document.documentElement, {
        childList:true,
        subtree:true
      });
    }catch(_){}
  }

  function bindGameplaySignals(){
    ['pointerdown','mousedown','touchstart','keydown','click'].forEach(function(type){
      document.addEventListener(type, function(ev){
        const target = ev.target && ev.target.closest
          ? ev.target.closest('#gjSoloBossArea,.gjpu-item,.gjm-area,#gjmStartBtn,.gjm-start-btn')
          : null;

        if(target){
          markRealPlay(type);
        }
      }, true);
    });

    window.addEventListener('gj:hit', function(){
      markRealPlay('gj:hit');
    });

    window.addEventListener('gj:good-hit', function(){
      state.lastGoodHits++;
      markRealPlay('gj:good-hit');
    });

    window.addEventListener('gj:score', function(ev){
      const detail = ev && ev.detail || {};
      state.lastScore = Math.max(state.lastScore, Number(detail.score || detail.value || 0));
      markRealPlay('gj:score');
    });

    window.addEventListener('gj:boss-defeated', function(ev){
      markRealPlay('gj:boss-defeated');

      const d = ev && ev.detail || {};
      if(d.goodHits) state.lastGoodHits = Math.max(state.lastGoodHits, Number(d.goodHits) || 0);
      if(d.score) state.lastScore = Math.max(state.lastScore, Number(d.score) || 0);
      if(d.combo) state.lastCombo = Math.max(state.lastCombo, Number(d.combo) || 0);

      window.setTimeout(function(){
        openSummary('boss-defeated-event');
      }, 420);
    });

    window.addEventListener('gj:win', function(ev){
      markRealPlay('gj:win');
      window.setTimeout(function(){
        openSummary('gj-win-event');
      }, 420);
    });
  }

  function fallbackCheckLoop(){
    window.setInterval(function(){
      state.lastScore = Math.max(state.lastScore, readScore());
      state.lastCombo = Math.max(state.lastCombo, readCombo());
      state.lastGoodHits = Math.max(state.lastGoodHits, readGoodHits());

      if(!hasRealPlay() && looksLikeSummaryOpen()){
        hideBadEarlySummary('interval-early-summary');
      }

      const bodyText = textOf(document.body);
      const bossDefeated =
        bodyText.includes('Boss Defeated') ||
        bodyText.includes('Junk Boss คลั่ง') && bodyText.includes('Boss Defeated') ||
        bodyText.includes('ชนะบอสแล้ว');

      if(bossDefeated && hasRealPlay() && !state.summaryOpened){
        window.setTimeout(function(){
          openSummary('fallback-boss-defeated-text');
        }, 600);
      }
    }, 450);
  }

  window.GJ_SUMMARY_RESTORE_V849K = {
    patch: PATCH,
    state: state,
    markRealPlay: markRealPlay,
    openSummary: openSummary,
    hideBadEarlySummary: hideBadEarlySummary,
    collectSummaryData: collectSummaryData
  };

  bindGameplaySignals();
  observeSummaryNodes();
  patchFinishFunctions();
  fallbackCheckLoop();

  window.setTimeout(patchFinishFunctions, 250);
  window.setTimeout(patchFinishFunctions, 800);
  window.setTimeout(patchFinishFunctions, 1500);
  window.setTimeout(function(){
    if(!hasRealPlay() && looksLikeSummaryOpen()){
      hideBadEarlySummary('boot-early-summary');
    }
  }, 700);

  console.log('[GoodJunk Summary Restore V849K] installed');
})();
