/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-win-gate-v849d.js === */
/* FULL PATCH v20260606-GOODJUNK-SOLO-BOSS-WIN-GATE-V849D
   Fix from v849c:
   - ไม่ block ระหว่าง gameplay
   - ไม่ setInterval ถี่ ๆ
   - ไม่ใช้ goodHits=0 เป็นเหตุ block
   - ตรวจเฉพาะตอน summary/reward แสดงจริง
*/

(function(){
  'use strict';

  const PATCH = 'v20260606-GOODJUNK-SOLO-BOSS-WIN-GATE-V849D';

  if(window.GJ_SOLO_BOSS_WIN_GATE_V849D_LOADED) return;
  window.GJ_SOLO_BOSS_WIN_GATE_V849D_LOADED = true;

  const qs = new URLSearchParams(location.search || '');

  function num(v, d){
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  }

  const TIME = Math.max(60, num(qs.get('time'), 90));
  const DIFF = String(qs.get('diff') || 'normal').toLowerCase();

  function requiredHits(){
    let base;

    if(TIME <= 60) base = 30;
    else if(TIME <= 90) base = 40;
    else if(TIME <= 120) base = 52;
    else if(TIME <= 150) base = 62;
    else base = 75;

    if(DIFF === 'easy') base = Math.round(base * 0.82);
    if(DIFF === 'hard') base = Math.round(base * 1.12);
    if(DIFF === 'challenge') base = Math.round(base * 1.25);

    return Math.max(24, base);
  }

  const REQUIRED = requiredHits();

  window.GJ_REQUIRED_GOOD_HITS_TO_WIN = REQUIRED;
  window.GJ_SOLO_BOSS_WIN_GATE = {
    patch: PATCH,
    time: TIME,
    diff: DIFF,
    requiredGoodHits: REQUIRED
  };

  function readLatestSummary(){
    const keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_LAST_SUMMARY'
    ];

    for(const k of keys){
      try{
        const raw = localStorage.getItem(k);
        if(!raw) continue;

        const obj = JSON.parse(raw);
        if(obj && typeof obj === 'object') return obj;
      }catch(_){}
    }

    return {};
  }

  function extractGoodHits(detail){
    const d = detail && typeof detail === 'object' ? detail : {};
    const latest = readLatestSummary();

    const candidates = [
      d.goodHits,
      d.good,
      d.correct,
      d.goodCount,
      d.totalGood,
      latest.goodHits,
      latest.good,
      latest.correct,
      latest.goodCount,
      latest.totalGood
    ];

    for(const v of candidates){
      const x = Number(v);
      if(Number.isFinite(x) && x > 0) return x;
    }

    return 0;
  }

  function summaryLooksVisible(){
    const btn = document.getElementById('gjrZoneBtn');
    const text = String(document.body && document.body.innerText || '');

    return !!btn || (
      text.includes('วันนี้ได้เรียนรู้อะไร') &&
      (
        text.includes('เล่นอีกครั้ง') ||
        text.includes('Cooldown') ||
        text.includes('ชนะบอส') ||
        text.includes('แพ้บอส') ||
        text.includes('เกือบชนะ')
      )
    );
  }

  function summaryLooksWin(){
    const text = String(document.body && document.body.innerText || '');
    return text.includes('ชนะบอส') || text.includes('สุดยอด');
  }

  function replaceTextContaining(selector, fromText, toText){
    const nodes = Array.from(document.querySelectorAll(selector));

    nodes.forEach(function(el){
      const t = String(el.textContent || '');
      if(t.includes(fromText)){
        el.textContent = t.replace(fromText, toText);
      }
    });
  }

  function showNotice(goodHits){
    if(document.getElementById('gjWinGateV849dNotice')) return;

    const need = Math.max(0, REQUIRED - goodHits);

    const box = document.createElement('div');
    box.id = 'gjWinGateV849dNotice';
    box.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:18px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'width:min(540px,calc(100vw - 28px))',
      'border-radius:22px',
      'padding:12px 16px',
      'background:rgba(15,23,42,.92)',
      'color:#fff',
      'font:900 14px system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 18px 44px rgba(15,23,42,.28)',
      'text-align:center',
      'pointer-events:none'
    ].join(';');

    box.innerHTML =
      '👾 เกือบชนะบอสแล้ว! เลือกอาหารดี ' +
      goodHits +
      '/' +
      REQUIRED +
      ' ครั้ง<br><span style="color:#fde68a">อีก ' +
      need +
      ' ครั้ง จะชนะบอสแบบสมบูรณ์</span>';

    document.documentElement.appendChild(box);
  }

  function downgradeSummary(detail, reason){
    if(!summaryLooksVisible()) return false;
    if(!summaryLooksWin()) return false;

    const goodHits = extractGoodHits(detail);

    /*
      สำคัญมาก:
      ถ้าอ่าน goodHits ไม่ได้ ห้าม block
      เพราะจะทำให้จอมืด/ค้างเหมือน v849c
    */
    if(goodHits <= 0){
      console.warn('[GoodJunk Win Gate v849d] skip because goodHits unavailable', {
        patch: PATCH,
        reason: reason || '',
        goodHits: goodHits,
        requiredGoodHits: REQUIRED
      });
      return false;
    }

    if(goodHits >= REQUIRED){
      console.log('[GoodJunk Win Gate v849d] win accepted', {
        goodHits: goodHits,
        requiredGoodHits: REQUIRED
      });
      return false;
    }

    replaceTextContaining('h1,h2,h3,b,strong,div,span', 'ชนะบอสแบบสุดยอด!', 'เกือบชนะบอสแล้ว!');
    replaceTextContaining('h1,h2,h3,b,strong,div,span', 'ชนะบอส', 'เกือบชนะบอส');
    replaceTextContaining('h1,h2,h3,b,strong,div,span', 'Legend Hero', 'Boss Challenger');

    showNotice(goodHits);

    try{
      const latest = readLatestSummary();

      latest.win = false;
      latest.result = 'near_win';
      latest.rank = 'Boss Challenger';
      latest.stars = Math.min(Number(latest.stars || 3), 3);
      latest.goodHits = goodHits;
      latest.requiredGoodHits = REQUIRED;
      latest.patchWinGate = PATCH;
      latest.winGateReason = reason || '';

      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(latest));
    }catch(_){}

    window.GJ_WIN_GATE_BLOCKED = {
      patch: PATCH,
      goodHits: goodHits,
      requiredGoodHits: REQUIRED,
      reason: reason || '',
      blockedAt: new Date().toISOString()
    };

    console.warn('[GoodJunk Win Gate v849d] downgraded early win', window.GJ_WIN_GATE_BLOCKED);
    return true;
  }

  window.addEventListener('gj:reward-summary-shown', function(ev){
    const detail = ev && ev.detail ? ev.detail : {};

    setTimeout(function(){ downgradeSummary(detail, 'summary-event-40ms'); }, 40);
    setTimeout(function(){ downgradeSummary(detail, 'summary-event-300ms'); }, 300);
    setTimeout(function(){ downgradeSummary(detail, 'summary-event-900ms'); }, 900);
  }, true);

  /*
    เผื่อบาง core ไม่ dispatch event แต่ summary render แล้ว
    ตรวจแค่ไม่กี่ครั้งช่วงท้าย ไม่ใช่ loop ถาวร
  */
  [1200, 2200, 3500, 5200].forEach(function(ms){
    setTimeout(function(){
      downgradeSummary(null, 'late-summary-check-' + ms);
    }, ms);
  });

  try{
    localStorage.setItem('GJ_SOLO_BOSS_WIN_GATE_V849D', JSON.stringify({
      patch: PATCH,
      time: TIME,
      diff: DIFF,
      requiredGoodHits: REQUIRED,
      savedAt: new Date().toISOString()
    }));
  }catch(_){}

  console.log('[GoodJunk Solo Boss Win Gate v849d ready]', {
    patch: PATCH,
    time: TIME,
    diff: DIFF,
    requiredGoodHits: REQUIRED
  });
})();