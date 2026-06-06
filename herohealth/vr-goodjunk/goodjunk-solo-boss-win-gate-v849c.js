/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-win-gate-v849c.js === */
/* FULL PATCH v20260606-GOODJUNK-SOLO-BOSS-WIN-GATE-V849C
   Purpose:
   - กันชนะบอสเร็วเกินไป
   - 60s normal ต้องไม่จบที่ 16–19 hits
   - บังคับ minimum good hits ก่อนยอมให้เป็น Win/5 stars/Legend
   - ไม่แตะ path/cooldown
*/

(function(){
  'use strict';

  const PATCH = 'v20260606-GOODJUNK-SOLO-BOSS-WIN-GATE-V849C';

  if(window.GJ_SOLO_BOSS_WIN_GATE_V849C_LOADED) return;
  window.GJ_SOLO_BOSS_WIN_GATE_V849C_LOADED = true;

  const qs = new URLSearchParams(location.search || '');

  function n(v, d){
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  }

  const TIME = Math.max(60, n(qs.get('time'), 90));
  const DIFF = String(qs.get('diff') || 'normal').toLowerCase();

  function minHits(){
    let base;

    if(TIME <= 60) base = 30;
    else if(TIME <= 90) base = 40;
    else if(TIME <= 120) base = 52;
    else if(TIME <= 150) base = 62;
    else base = 75;

    if(DIFF === 'easy') base = Math.round(base * .82);
    if(DIFF === 'hard') base = Math.round(base * 1.12);
    if(DIFF === 'challenge') base = Math.round(base * 1.25);

    return Math.max(24, base);
  }

  const REQUIRED_HITS = minHits();

  window.GJ_REQUIRED_GOOD_HITS_TO_WIN = REQUIRED_HITS;
  window.GJ_SOLO_BOSS_WIN_GATE = {
    patch:PATCH,
    time:TIME,
    diff:DIFF,
    requiredGoodHits:REQUIRED_HITS
  };

  function readGoodHitsFromDom(){
    const text = String(document.body && document.body.innerText || '');

    const patterns = [
      /(\d+)\s*อาหารดี\s*เลือก/g,
      /good\s*hits?\s*[:=]?\s*(\d+)/ig,
      /เลือกอาหารดี\s*[:=]?\s*(\d+)/g
    ];

    for(const re of patterns){
      let m;
      while((m = re.exec(text))){
        const val = Number(m[1]);
        if(Number.isFinite(val)) return val;
      }
    }

    return 0;
  }

  function readGoodHits(){
    const keys = [
      'goodHits',
      'good',
      'GJ_GOOD_HITS',
      'gjGoodHits',
      'selectedGood',
      'correctHits'
    ];

    for(const k of keys){
      try{
        if(typeof window[k] === 'number') return window[k];
      }catch(_){}
    }

    try{
      const last = JSON.parse(
        localStorage.getItem('GJ_SOLO_BOSS_LAST_SUMMARY') ||
        localStorage.getItem('GJ_FULL_3D_VR_LAST_SUMMARY') ||
        '{}'
      );

      const val =
        last.goodHits ??
        last.good ??
        last.correct ??
        last.goodCount ??
        0;

      if(Number.isFinite(Number(val))) return Number(val);
    }catch(_){}

    return readGoodHitsFromDom();
  }

  function isSummaryVisible(){
    const text = String(document.body && document.body.innerText || '');

    return (
      text.includes('ชนะบอส') ||
      text.includes('แพ้บอส') ||
      text.includes('สรุป') ||
      text.includes('วันนี้ได้เรียนรู้อะไร') ||
      text.includes('Cooldown แล้วกลับเลือกโหมด') ||
      !!document.getElementById('gjrZoneBtn')
    );
  }

  function downgradeSummaryIfTooFast(){
    if(!isSummaryVisible()) return;

    const goodHits = readGoodHits();

    if(goodHits >= REQUIRED_HITS) return;

    const text = String(document.body && document.body.innerText || '');

    if(!text.includes('ชนะบอส')) return;

    const needMore = REQUIRED_HITS - goodHits;

    const titleCandidates = Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span'))
      .filter(el => String(el.textContent || '').includes('ชนะบอส'));

    titleCandidates.forEach(el => {
      el.textContent = 'เกือบชนะบอสแล้ว!';
    });

    const badgeCandidates = Array.from(document.querySelectorAll('*'))
      .filter(el => String(el.textContent || '').includes('Legend Hero'));

    badgeCandidates.forEach(el => {
      el.textContent = String(el.textContent || '').replace('Legend Hero', 'Boss Challenger');
    });

    const learnBox = document.createElement('div');
    learnBox.id = 'gjWinGateV849cNotice';
    learnBox.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:18px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'width:min(520px,calc(100vw - 28px))',
      'border-radius:22px',
      'padding:12px 16px',
      'background:rgba(15,23,42,.92)',
      'color:#fff',
      'font:900 14px system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 18px 44px rgba(15,23,42,.28)',
      'text-align:center'
    ].join(';');

    learnBox.innerHTML =
      '👾 บอสยังอึดได้อีก! รอบนี้เลือกอาหารดี ' +
      goodHits +
      '/' +
      REQUIRED_HITS +
      ' ครั้ง<br><span style="color:#fde68a">อีก ' +
      needMore +
      ' ครั้ง จะชนะบอสแบบสมบูรณ์</span>';

    if(!document.getElementById('gjWinGateV849cNotice')){
      document.documentElement.appendChild(learnBox);
    }

    try{
      const latest = JSON.parse(localStorage.getItem('GJ_SOLO_BOSS_LAST_SUMMARY') || '{}') || {};
      latest.win = false;
      latest.result = 'near_win';
      latest.rank = 'Boss Challenger';
      latest.stars = Math.min(Number(latest.stars || 3), 3);
      latest.goodHits = goodHits;
      latest.requiredGoodHits = REQUIRED_HITS;
      latest.patchWinGate = PATCH;
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(latest));
    }catch(_){}

    window.GJ_WIN_GATE_BLOCKED = {
      patch:PATCH,
      goodHits:goodHits,
      requiredGoodHits:REQUIRED_HITS,
      blockedAt:new Date().toISOString()
    };

    console.warn('[GoodJunk Win Gate] blocked early win', window.GJ_WIN_GATE_BLOCKED);
  }

  function patchSummaryEvent(){
    window.addEventListener('gj:reward-summary-shown', function(ev){
      const d = ev && ev.detail ? ev.detail : {};
      const goodHits = Number(d.goodHits || d.good || readGoodHits() || 0);

      if(goodHits < REQUIRED_HITS){
        d.win = false;
        d.result = 'near_win';
        d.rank = 'Boss Challenger';
        d.stars = Math.min(Number(d.stars || 3), 3);
        d.requiredGoodHits = REQUIRED_HITS;
        d.patchWinGate = PATCH;
      }

      setTimeout(downgradeSummaryIfTooFast, 40);
      setTimeout(downgradeSummaryIfTooFast, 300);
      setTimeout(downgradeSummaryIfTooFast, 900);
    }, true);
  }

  patchSummaryEvent();

  const iv = setInterval(downgradeSummaryIfTooFast, 450);

  setTimeout(function(){
    clearInterval(iv);
  }, 180000);

  try{
    localStorage.setItem('GJ_SOLO_BOSS_WIN_GATE_V849C', JSON.stringify({
      patch:PATCH,
      time:TIME,
      diff:DIFF,
      requiredGoodHits:REQUIRED_HITS,
      savedAt:new Date().toISOString()
    }));
  }catch(_){}

  console.log('[GoodJunk Solo Boss Win Gate v849c]', {
    time:TIME,
    diff:DIFF,
    requiredGoodHits:REQUIRED_HITS
  });
})();
