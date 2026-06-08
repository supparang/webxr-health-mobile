/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-single-layer-v850d.js === */
/* PATCH v20260607-v850d
   Purpose:
   - กันหน้าสรุป GoodJunk ซ้อน 2 ชั้น
   - ให้เหลือ summary modal ชั้นเดียวที่อยู่ด้านหน้า
   - ซ่อน/ลด opacity summary เก่าที่เป็น background duplicate
   - ไม่ยุ่งกับ gameplay ก่อนจบเกม
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-SINGLE-LAYER-V850D';

  if(window.GJ_SUMMARY_SINGLE_LAYER_V850D_LOADED){
    return;
  }
  window.GJ_SUMMARY_SINGLE_LAYER_V850D_LOADED = true;

  function qsAll(sel){
    try{
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function textOf(el){
    return String(
      el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute && el.getAttribute('aria-label') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function looksLikeSummary(el){
    if(!el) return false;

    var txt = textOf(el);
    var id = String(el.id || '').toLowerCase();
    var cls = String(el.className || '').toLowerCase();

    return (
      id.indexOf('summary') !== -1 ||
      id.indexOf('reward') !== -1 ||
      id.indexOf('result') !== -1 ||
      cls.indexOf('summary') !== -1 ||
      cls.indexOf('reward') !== -1 ||
      cls.indexOf('result') !== -1 ||
      txt.indexOf('ชนะบอส') !== -1 ||
      txt.indexOf('เกือบชนะ') !== -1 ||
      txt.indexOf('Cooldown') !== -1 ||
      txt.indexOf('เล่นอีกครั้ง') !== -1 ||
      txt.indexOf('คะแนน') !== -1 && txt.indexOf('ความแม่นยำ') !== -1
    );
  }

  function isVisible(el){
    if(!el) return false;

    try{
      var st = getComputedStyle(el);
      var r = el.getBoundingClientRect();

      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity || 1) > 0.05 &&
        r.width > 80 &&
        r.height > 80
      );
    }catch(e){
      return false;
    }
  }

  function zIndexOf(el){
    try{
      var z = getComputedStyle(el).zIndex;
      if(z === 'auto') return 0;
      return Number(z) || 0;
    }catch(e){
      return 0;
    }
  }

  function areaOf(el){
    try{
      var r = el.getBoundingClientRect();
      return Math.max(0, r.width) * Math.max(0, r.height);
    }catch(e){
      return 0;
    }
  }

  function centerScore(el){
    try{
      var r = el.getBoundingClientRect();
      var cx = window.innerWidth / 2;
      var cy = window.innerHeight / 2;
      var ex = r.left + r.width / 2;
      var ey = r.top + r.height / 2;
      var dx = Math.abs(cx - ex);
      var dy = Math.abs(cy - ey);

      return 100000 - dx - dy + zIndexOf(el) * 2;
    }catch(e){
      return 0;
    }
  }

  function collectSummaryCards(){
    var selectors = [
      '[id*="summary" i]',
      '[class*="summary" i]',
      '[id*="reward" i]',
      '[class*="reward" i]',
      '[id*="result" i]',
      '[class*="result" i]',
      '[role="dialog"]',
      '.modal',
      '.popup',
      '.overlay'
    ];

    var found = [];

    selectors.forEach(function(sel){
      qsAll(sel).forEach(function(el){
        if(found.indexOf(el) === -1){
          found.push(el);
        }
      });
    });

    /*
      เผื่อ summary เก่าไม่ได้มี class/id ชัดเจน
      ไล่เฉพาะ div/section/main ที่มีข้อความ summary
    */
    qsAll('div,section,main,article').forEach(function(el){
      if(found.indexOf(el) !== -1) return;
      if(!looksLikeSummary(el)) return;
      found.push(el);
    });

    return found.filter(function(el){
      return isVisible(el) && looksLikeSummary(el);
    });
  }

  function chooseFrontSummary(cards){
    if(!cards.length) return null;

    /*
      ให้คะแนนตัวที่ควรเป็น summary ชั้นหน้า:
      - มีปุ่ม Cooldown
      - มีปุ่มเล่นอีกครั้ง
      - อยู่กลางจอ
      - z-index สูง
      - ไม่ใหญ่เกินทั้งจอ
    */
    return cards.slice().sort(function(a,b){
      function score(el){
        var txt = textOf(el);
        var score = centerScore(el);
        var ar = areaOf(el);
        var screen = window.innerWidth * window.innerHeight;

        if(txt.indexOf('Cooldown') !== -1) score += 20000;
        if(txt.indexOf('เล่นอีกครั้ง') !== -1) score += 12000;
        if(txt.indexOf('ชนะบอส') !== -1) score += 9000;
        if(txt.indexOf('เกือบชนะ') !== -1) score += 8000;

        /*
          ตัวที่ใหญ่มากเกินไปมักเป็น summary เก่าชั้นหลัง/overlay หลัง
        */
        if(ar > screen * 0.65) score -= 18000;

        return score;
      }

      return score(b) - score(a);
    })[0];
  }

  function hideDuplicateSummary(el, reason){
    if(!el || el.dataset.gjSummarySingleLayerKeep === '1') return;

    try{
      el.dataset.gjSummarySingleLayerHidden = PATCH;
      el.dataset.gjSummarySingleLayerReason = reason || 'duplicate';

      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('z-index', '-1', 'important');
    }catch(e){}
  }

  function keepFrontSummary(el){
    if(!el) return;

    try{
      el.dataset.gjSummarySingleLayerKeep = '1';

      el.style.setProperty('display', '', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('z-index', '2147483600', 'important');
    }catch(e){}

    /*
      ถ้ามี parent overlay ให้ดันขึ้นหน้า แต่ไม่ทำให้ parent ใหญ่ซ้อนอีกชั้น
    */
    try{
      var p = el.parentElement;
      var guard = 0;

      while(p && p !== document.body && guard < 4){
        if(looksLikeSummary(p) || String(p.className || '').toLowerCase().indexOf('overlay') !== -1){
          p.dataset.gjSummarySingleLayerParent = PATCH;
          p.style.setProperty('z-index', '2147483500', 'important');
          p.style.setProperty('pointer-events', 'auto', 'important');
        }
        p = p.parentElement;
        guard++;
      }
    }catch(e){}
  }

  function dedupeSummary(reason){
    var cards = collectSummaryCards();

    if(cards.length < 2){
      if(cards.length === 1){
        keepFrontSummary(cards[0]);
      }
      return;
    }

    var front = chooseFrontSummary(cards);
    keepFrontSummary(front);

    cards.forEach(function(el){
      if(el === front) return;

      /*
        ถ้าตัวอื่นเป็น parent ของ front อย่าซ่อนทันที เพราะอาจเป็น overlay wrapper
        แต่ทำให้โปร่งและไม่ซ้อนเป็น card อีกใบ
      */
      try{
        if(el.contains(front)){
          el.dataset.gjSummarySingleLayerWrapper = PATCH;
          el.style.setProperty('background', 'rgba(15,23,42,.52)', 'important');
          el.style.setProperty('pointer-events', 'auto', 'important');
          return;
        }
      }catch(e){}

      hideDuplicateSummary(el, reason || 'duplicate-summary');
    });

    try{
      console.info('[GoodJunk Summary Single Layer]', {
        patch: PATCH,
        reason: reason || '',
        cards: cards.length,
        kept: front && (front.id || front.className || textOf(front).slice(0,60))
      });
    }catch(e){}
  }

  /*
    ซ่อนปุ่มลอยกลับเลือกโหมดเฉพาะตอน summary เปิด
    เพราะในมือถือมันมักบัง summary ด้านล่าง
  */
  function polishFloatingButtons(){
    var hasSummary = collectSummaryCards().length > 0;
    if(!hasSummary) return;

    qsAll('button,a,[role="button"]').forEach(function(el){
      var txt = textOf(el);

      if(
        txt.indexOf('กลับเลือกโหมด') !== -1 ||
        txt.indexOf('กลับเลือก') !== -1 ||
        txt.indexOf('GoodJunk') !== -1 && txt.indexOf('กลับ') !== -1
      ){
        var insideSummary = false;

        try{
          var p = el;
          while(p && p !== document.body){
            if(p.dataset && p.dataset.gjSummarySingleLayerKeep === '1'){
              insideSummary = true;
              break;
            }
            p = p.parentElement;
          }
        }catch(e){}

        if(!insideSummary){
          try{
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
          }catch(e){}
        }
      }
    });
  }

  function run(reason){
    dedupeSummary(reason);
    polishFloatingButtons();
  }

  var timer = 0;
  function schedule(reason){
    clearTimeout(timer);
    timer = setTimeout(function(){
      run(reason);
    }, 60);
  }

  window.addEventListener('gj:reward-summary-shown', function(){
    schedule('event-gj-reward-summary-shown');
    setTimeout(function(){ run('event-gj-reward-summary-shown-250'); }, 250);
    setTimeout(function(){ run('event-gj-reward-summary-shown-900'); }, 900);
  }, true);

  window.addEventListener('GJ_SUMMARY_OPEN', function(){
    schedule('event-GJ_SUMMARY_OPEN');
  }, true);

  document.addEventListener('click', function(){
    setTimeout(function(){ run('after-click'); }, 120);
    setTimeout(function(){ run('after-click-700'); }, 700);
  }, true);

  var mo = null;

  try{
    mo = new MutationObserver(function(){
      schedule('mutation');
    });

    mo.observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','id','open','hidden','aria-hidden']
    });
  }catch(e){}

  /*
    ช่วง summary มักถูกสร้างหลังจบเกมหลายจังหวะ
  */
  setTimeout(function(){ run('boot-500'); }, 500);
  setTimeout(function(){ run('boot-1500'); }, 1500);
  setTimeout(function(){ run('boot-3000'); }, 3000);

  window.GJ_SUMMARY_SINGLE_LAYER_V850D = {
    patch: PATCH,
    run: run,
    collect: collectSummaryCards
  };

  console.info('[GoodJunk Summary Single Layer V850D] installed');
})();
