/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-visible-v850e.js === */
/* PATCH v20260607-v850e
   Purpose:
   - แก้ฉาก blur/mask ค้างแต่ summary card ไม่แสดง
   - ไม่ซ่อน summary แบบแรงเหมือน v850d
   - ดึง summary ที่มีอยู่ให้ขึ้นมาอยู่ด้านหน้า
   - ถ้าไม่มี card จริง ๆ ให้สร้าง fallback summary จาก localStorage/state
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-VISIBLE-V850E';

  if(window.GJ_SUMMARY_VISIBLE_V850E_LOADED){
    return;
  }
  window.GJ_SUMMARY_VISIBLE_V850E_LOADED = true;

  function all(sel){
    try{
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function txt(el){
    return String(
      el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute && el.getAttribute('aria-label') ||
        ''
      ) || ''
    ).replace(/\s+/g,' ').trim();
  }

  function visible(el){
    if(!el) return false;
    try{
      var st = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity || 1) > 0.02 &&
        r.width > 40 &&
        r.height > 40
      );
    }catch(e){
      return false;
    }
  }

  function looksSummary(el){
    if(!el) return false;

    var s = txt(el);
    var id = String(el.id || '').toLowerCase();
    var cls = String(el.className || '').toLowerCase();

    return (
      id.includes('summary') ||
      cls.includes('summary') ||
      id.includes('reward') ||
      cls.includes('reward') ||
      id.includes('result') ||
      cls.includes('result') ||
      s.includes('ชนะบอส') ||
      s.includes('เกือบชนะ') ||
      s.includes('เล่นอีกครั้ง') ||
      s.includes('Cooldown') ||
      s.includes('คะแนน') ||
      s.includes('ความแม่นยำ')
    );
  }

  function scoreCard(el){
    var s = txt(el);
    var score = 0;

    try{
      var r = el.getBoundingClientRect();
      var cx = window.innerWidth / 2;
      var cy = window.innerHeight / 2;
      var ex = r.left + r.width / 2;
      var ey = r.top + r.height / 2;

      score += 10000 - Math.abs(cx - ex) - Math.abs(cy - ey);
      score += Math.min(r.width * r.height / 100, 8000);
    }catch(e){}

    if(s.includes('Cooldown')) score += 8000;
    if(s.includes('เล่นอีกครั้ง')) score += 8000;
    if(s.includes('ชนะบอส')) score += 6000;
    if(s.includes('เกือบชนะ')) score += 5000;

    return score;
  }

  function findSummaryCards(){
    var nodes = [];

    [
      '[id*="summary" i]',
      '[class*="summary" i]',
      '[id*="reward" i]',
      '[class*="reward" i]',
      '[id*="result" i]',
      '[class*="result" i]',
      '[role="dialog"]',
      '.modal',
      '.overlay'
    ].forEach(function(sel){
      all(sel).forEach(function(el){
        if(nodes.indexOf(el) < 0) nodes.push(el);
      });
    });

    all('div,section,main,article').forEach(function(el){
      if(nodes.indexOf(el) >= 0) return;
      if(looksSummary(el)) nodes.push(el);
    });

    return nodes.filter(function(el){
      return looksSummary(el);
    });
  }

  function bringToFront(el){
    if(!el) return;

    try{
      el.style.setProperty('display', '', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('z-index', '2147483600', 'important');
      el.style.setProperty('filter', 'none', 'important');
      el.style.setProperty('transform', el.style.transform || '', 'important');
      el.dataset.gjSummaryVisibleV850e = 'front';
    }catch(e){}

    var p = el.parentElement;
    var n = 0;

    while(p && p !== document.body && n < 5){
      try{
        p.style.setProperty('display', '', 'important');
        p.style.setProperty('visibility', 'visible', 'important');
        p.style.setProperty('opacity', '1', 'important');
        p.style.setProperty('pointer-events', 'auto', 'important');
        p.style.setProperty('z-index', String(2147483500 - n), 'important');
      }catch(e){}
      p = p.parentElement;
      n++;
    }
  }

  function removeDuplicateCards(front, cards){
    cards.forEach(function(el){
      if(el === front) return;
      if(el.contains && el.contains(front)) return;

      var s = txt(el);

      /*
        ซ่อนเฉพาะ duplicate card ที่เป็น summary จริง ๆ
        ไม่ซ่อน overlay/wrapper ใหญ่
      */
      if(
        s.includes('ชนะบอส') ||
        s.includes('เกือบชนะ') ||
        s.includes('เล่นอีกครั้ง') ||
        s.includes('Cooldown')
      ){
        try{
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.dataset.gjSummaryVisibleV850eHidden = 'duplicate-card';
        }catch(e){}
      }
    });
  }

  function readLatest(){
    var keys = [
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_PC_COOLDOWN_TARGET_LAST',
      'GJ_SOLO_BOSS_COOLDOWN_TARGET_LAST'
    ];

    for(var i=0;i<keys.length;i++){
      try{
        var raw = localStorage.getItem(keys[i]);
        if(!raw) continue;

        var obj = JSON.parse(raw);
        if(obj){
          if(obj.summary) return obj.summary;
          if(obj.detail) return obj.detail;
          return obj;
        }
      }catch(e){}
    }

    return {};
  }

  function fallbackSummary(){
    if(document.getElementById('gjSummaryVisibleFallbackV850e')){
      bringToFront(document.getElementById('gjSummaryVisibleFallbackV850e'));
      return;
    }

    var latest = readLatest();

    var score = Number(latest.score || latest.points || 0) || 0;
    var acc = latest.accuracy || latest.acc || '';
    var good = latest.goodHits || latest.good || latest.goodCount || '';
    var combo = latest.bestCombo || latest.combo || '';

    var overlay = document.createElement('div');
    overlay.id = 'gjSummaryVisibleFallbackV850e';
    overlay.innerHTML = [
      '<div class="gjv850e-card">',
        '<div class="gjv850e-cup">🏆</div>',
        '<h1>สรุปผล GoodJunk</h1>',
        '<p>เกมจบแล้ว ระบบกำลังแสดงผลสรุป</p>',
        '<div class="gjv850e-grid">',
          '<div><b>' + score + '</b><span>คะแนน</span></div>',
          '<div><b>' + (acc || '-') + '</b><span>ความแม่นยำ</span></div>',
          '<div><b>' + (good || '-') + '</b><span>อาหารดี</span></div>',
          '<div><b>x' + (combo || 0) + '</b><span>คอมโบสูงสุด</span></div>',
        '</div>',
        '<div class="gjv850e-actions">',
          '<button id="gjv850eReplay" type="button">🔁 เล่นอีกครั้ง</button>',
          '<button id="gjv850eCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>',
        '</div>',
      '</div>'
    ].join('');

    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483600',
      'display:grid',
      'place-items:center',
      'padding:20px',
      'background:rgba(15,23,42,.48)',
      'backdrop-filter:blur(6px)',
      'pointer-events:auto'
    ].join(';');

    var style = document.createElement('style');
    style.textContent = [
      '#gjSummaryVisibleFallbackV850e .gjv850e-card{',
        'width:min(520px,calc(100vw - 34px));',
        'border-radius:30px;',
        'background:rgba(255,255,255,.96);',
        'box-shadow:0 30px 90px rgba(15,23,42,.34);',
        'border:2px solid rgba(255,255,255,.94);',
        'padding:24px;',
        'text-align:center;',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
        'color:#0f172a;',
      '}',
      '#gjSummaryVisibleFallbackV850e .gjv850e-cup{font-size:54px;line-height:1;}',
      '#gjSummaryVisibleFallbackV850e h1{margin:8px 0 4px;font-size:clamp(30px,7vw,44px);line-height:1.05;}',
      '#gjSummaryVisibleFallbackV850e p{margin:0 0 14px;color:#64748b;font-weight:900;}',
      '#gjSummaryVisibleFallbackV850e .gjv850e-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;}',
      '#gjSummaryVisibleFallbackV850e .gjv850e-grid div{border:2px solid #e2e8f0;border-radius:18px;padding:12px;background:#fff;}',
      '#gjSummaryVisibleFallbackV850e .gjv850e-grid b{display:block;font-size:28px;}',
      '#gjSummaryVisibleFallbackV850e .gjv850e-grid span{display:block;color:#64748b;font-weight:900;font-size:13px;}',
      '#gjSummaryVisibleFallbackV850e .gjv850e-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;}',
      '#gjSummaryVisibleFallbackV850e button{border:0;border-radius:18px;min-height:56px;font:1000 16px system-ui;color:#fff;cursor:pointer;}',
      '#gjv850eReplay{background:linear-gradient(135deg,#22c55e,#16a34a);}',
      '#gjv850eCooldown{background:linear-gradient(135deg,#38bdf8,#2563eb);}',
      '@media(max-width:520px){#gjSummaryVisibleFallbackV850e .gjv850e-card{padding:20px;border-radius:26px;}#gjSummaryVisibleFallbackV850e .gjv850e-actions{grid-template-columns:1fr;}#gjSummaryVisibleFallbackV850e h1{font-size:34px;}}'
    ].join('');

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    function qs(){
      return new URLSearchParams(location.search || '');
    }

    function launcherUrl(){
      var q = qs();
      var u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html');

      u.searchParams.set('pid', q.get('pid') || 'anon');
      u.searchParams.set('name', q.get('name') || q.get('nick') || 'Hero');
      u.searchParams.set('diff', q.get('diff') || 'normal');
      u.searchParams.set('time', q.get('time') || '90');
      u.searchParams.set('view', q.get('view') || 'mobile');
      u.searchParams.set('zone', 'nutrition');
      u.searchParams.set('cat', 'nutrition');
      u.searchParams.set('game', 'goodjunk');
      u.searchParams.set('gameId', 'goodjunk');
      u.searchParams.set('mode', 'solo');

      return u.toString();
    }

    document.getElementById('gjv850eReplay').addEventListener('click', function(){
      var u = new URL(location.href);
      u.searchParams.set('run', 'play');
      u.searchParams.set('replay', String(Date.now()));
      u.searchParams.delete('phase');
      location.href = u.toString();
    });

    document.getElementById('gjv850eCooldown').addEventListener('click', function(){
      if(window.GJ_SOLO_BOSS_SHELL && typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'){
        window.GJ_SOLO_BOSS_SHELL.goCooldown({
          reason:'fallback-summary-v850e',
          score:score,
          accuracy:acc,
          goodHits:good,
          bestCombo:combo
        });
        return;
      }

      location.href = launcherUrl();
    });

    console.warn('[GoodJunk Summary Visible V850E] fallback summary created');
  }

  function fix(reason){
    var cards = findSummaryCards().filter(visible);

    if(cards.length){
      cards.sort(function(a,b){
        return scoreCard(b) - scoreCard(a);
      });

      var front = cards[0];
      bringToFront(front);
      removeDuplicateCards(front, cards);

      console.info('[GoodJunk Summary Visible V850E] summary visible', {
        reason: reason || '',
        cards: cards.length,
        front: front.id || String(front.className || '').slice(0,80)
      });

      return true;
    }

    /*
      ถ้าพบว่า body ถูก blur/มี overlay แต่ไม่มี summary card ให้สร้าง fallback
    */
    var bodyText = txt(document.body);
    var seemsEnded =
      bodyText.includes('ชนะบอส') ||
      bodyText.includes('Cooldown') ||
      bodyText.includes('เล่นอีกครั้ง') ||
      bodyText.includes('Boss Defeated') ||
      bodyText.includes('เกือบชนะ');

    if(seemsEnded){
      fallbackSummary();
      return true;
    }

    return false;
  }

  function schedule(reason, delay){
    setTimeout(function(){
      fix(reason);
    }, delay || 80);
  }

  window.addEventListener('gj:reward-summary-shown', function(){
    schedule('event-gj-reward-summary-shown', 80);
    schedule('event-gj-reward-summary-shown-400', 400);
    schedule('event-gj-reward-summary-shown-1200', 1200);
  }, true);

  document.addEventListener('click', function(){
    schedule('after-click', 150);
    schedule('after-click-800', 800);
  }, true);

  try{
    new MutationObserver(function(){
      schedule('mutation', 120);
    }).observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','hidden','aria-hidden']
    });
  }catch(e){}

  schedule('boot-500', 500);
  schedule('boot-1800', 1800);
  schedule('boot-3500', 3500);

  window.GJ_SUMMARY_VISIBLE_V850E = {
    patch: PATCH,
    fix: fix,
    fallbackSummary: fallbackSummary
  };

  console.info('[GoodJunk Summary Visible V850E] installed');
})();
