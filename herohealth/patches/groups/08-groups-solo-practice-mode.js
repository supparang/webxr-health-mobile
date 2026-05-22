/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260522-groups-solo-practice-mode-08
   File: /herohealth/patches/groups/08-groups-solo-practice-mode.js

   Purpose:
   - Make Practice mode visibly and behaviorally different from Solo Arena
   - Triggered by variant=practice or practice=1 or assist=1
   - Add food-group helper panel 1–5
   - Add coach hints and practice-friendly feedback
   - Keep PC / Mobile / cVR compatible
   - Preserve canonical run file /herohealth/vr-groups/groups.html
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-solo-practice-mode-08';

  if (window.__HHA_GROUPS_SOLO_PRACTICE_MODE_08__) return;
  window.__HHA_GROUPS_SOLO_PRACTICE_MODE_08__ = true;

  const qs = new URLSearchParams(location.search);

  const isPractice =
    String(qs.get('variant') || '').toLowerCase() === 'practice' ||
    qs.get('practice') === '1' ||
    qs.get('assist') === '1';

  if (!isPractice) {
    console.info('[HeroHealth Groups Practice]', PATCH_ID, 'skipped: not practice mode');
    return;
  }

  const GROUPS = [
    {
      no: 1,
      emoji: '🥩',
      short: 'โปรตีน',
      name: 'หมู่ 1 โปรตีน',
      desc: 'เนื้อ นม ไข่ ถั่วเมล็ดแห้ง',
      hint: 'อาหารสร้างกล้ามเนื้อและซ่อมแซมร่างกาย'
    },
    {
      no: 2,
      emoji: '🍚',
      short: 'แป้ง',
      name: 'หมู่ 2 คาร์โบไฮเดรต',
      desc: 'ข้าว แป้ง เผือก มัน น้ำตาล',
      hint: 'อาหารให้พลังงานหลัก'
    },
    {
      no: 3,
      emoji: '🥦',
      short: 'ผัก',
      name: 'หมู่ 3 ผัก',
      desc: 'ผักชนิดต่าง ๆ',
      hint: 'ช่วยเรื่องวิตามิน เกลือแร่ และใยอาหาร'
    },
    {
      no: 4,
      emoji: '🍎',
      short: 'ผลไม้',
      name: 'หมู่ 4 ผลไม้',
      desc: 'ผลไม้ชนิดต่าง ๆ',
      hint: 'ให้วิตามิน ใยอาหาร และความสดชื่น'
    },
    {
      no: 5,
      emoji: '🥑',
      short: 'ไขมัน',
      name: 'หมู่ 5 ไขมัน',
      desc: 'น้ำมัน ไขมันจากพืชและสัตว์',
      hint: 'ให้พลังงานสูง ควรกินพอดี'
    }
  ];

  const state = {
    patch: PATCH_ID,
    startedAt: Date.now(),
    view: normalizeView(),
    coachOpen: true,
    lastTipAt: 0,
    tipCount: 0,
    seenTargets: 0,
    practiceClicks: 0,
    correct: 0,
    miss: 0
  };

  window.HHA_GROUPS_SOLO_PRACTICE = state;

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(){
    const raw = String(qs.get('view') || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch','tablet'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function textOf(el){
    return String(el && (
      el.innerText ||
      el.textContent ||
      el.getAttribute('aria-label') ||
      el.value ||
      ''
    ) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    const t = pageText();

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('Food Hero') && t.includes('คะแนน') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('กลับ Nutrition Zone')
    );
  }

  function isIntroVisible(){
    const t = pageText();

    return (
      t.includes('Groups Solo Arena') ||
      t.includes('แตะหรือ') ||
      t.includes('เริ่มเล่น')
    ) && !isSummaryVisible();
  }

  function addStyle(){
    if (document.getElementById('hha-groups-practice-mode-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-practice-mode-style';
    style.textContent = `
      body.hha-groups-practice-mode{
        --practice-green:#7ed957;
        --practice-blue:#61bbff;
        --practice-yellow:#ffd966;
        --practice-text:#214f64;
        --practice-muted:#6f8fa1;
      }

      body.hha-groups-practice-mode::before{
        content:"Practice Mode";
        position:fixed;
        left:12px;
        top:calc(12px + env(safe-area-inset-top,0px));
        z-index:999998;
        padding:8px 12px;
        border-radius:999px;
        background:rgba(239,255,234,.94);
        color:#2f7a31;
        border:2px solid rgba(126,217,87,.65);
        box-shadow:0 10px 24px rgba(37,89,121,.12);
        font:950 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:none;
      }

      .hha-practice-coach{
        position:fixed;
        right:12px;
        top:calc(12px + env(safe-area-inset-top,0px));
        z-index:999997;
        width:min(92vw, 360px);
        border-radius:24px;
        background:rgba(255,255,255,.94);
        color:var(--practice-text);
        border:2px solid rgba(214,237,247,.95);
        box-shadow:0 18px 42px rgba(37,89,121,.18);
        overflow:hidden;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        backdrop-filter:blur(12px);
      }

      .hha-practice-coach.closed .hha-practice-body{
        display:none;
      }

      .hha-practice-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:11px 13px;
        background:linear-gradient(135deg,rgba(239,255,234,.96),rgba(234,248,255,.96));
        border-bottom:1px solid rgba(214,237,247,.9);
      }

      .hha-practice-title{
        font:950 15px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-practice-toggle{
        border:0;
        border-radius:999px;
        background:rgba(255,255,255,.9);
        color:#214f64;
        min-width:34px;
        min-height:30px;
        font-weight:950;
        cursor:pointer;
      }

      .hha-practice-body{
        padding:11px 12px 13px;
      }

      .hha-practice-tip{
        margin:0 0 10px;
        padding:9px 10px;
        border-radius:16px;
        background:rgba(255,250,226,.92);
        border:1px solid rgba(255,217,102,.72);
        color:#6f5010;
        font:850 13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-practice-map{
        display:grid;
        grid-template-columns:1fr;
        gap:6px;
      }

      .hha-practice-row{
        display:grid;
        grid-template-columns:34px 1fr;
        gap:8px;
        align-items:center;
        padding:7px 8px;
        border-radius:15px;
        background:#f7fdff;
        border:1px solid rgba(214,237,247,.9);
      }

      .hha-practice-no{
        display:grid;
        place-items:center;
        width:31px;
        height:31px;
        border-radius:12px;
        background:linear-gradient(135deg,#eaf8ff,#fff);
        border:1px solid rgba(214,237,247,.9);
        font-weight:950;
        color:#2388b9;
      }

      .hha-practice-name{
        font-weight:950;
        font-size:13px;
        line-height:1.15;
      }

      .hha-practice-desc{
        color:#6f8fa1;
        font-weight:800;
        font-size:11px;
        line-height:1.2;
        margin-top:2px;
      }

      .hha-practice-mini{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        justify-content:center;
        margin:10px auto;
      }

      .hha-practice-chip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        min-height:34px;
        padding:7px 10px;
        border-radius:999px;
        background:#f7fdff;
        border:2px solid rgba(214,237,247,.95);
        color:#214f64;
        font:900 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        white-space:nowrap;
      }

      .hha-practice-intro-badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        min-height:38px;
        padding:8px 13px;
        border-radius:999px;
        background:rgba(239,255,234,.94);
        color:#2f7a31;
        border:2px solid rgba(126,217,87,.65);
        font-weight:950;
        margin:8px auto 12px;
      }

      body.hha-groups-practice-mode .hha-summary-root::before{
        content:"Practice Result";
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:36px;
        padding:8px 14px;
        margin:0 auto 12px;
        border-radius:999px;
        background:rgba(239,255,234,.94);
        color:#2f7a31;
        border:2px solid rgba(126,217,87,.65);
        font:950 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-practice-summary-box{
        width:min(88vw, 760px);
        margin:14px auto;
        padding:14px;
        border-radius:24px;
        background:linear-gradient(180deg,rgba(239,255,234,.94),rgba(255,255,255,.96));
        border:2px solid rgba(126,217,87,.45);
        text-align:center;
        color:#214f64;
      }

      .hha-practice-summary-box h3{
        margin:0 0 8px;
        font-size:clamp(22px,5vw,32px);
        line-height:1.12;
      }

      .hha-practice-summary-box p{
        margin:0;
        color:#6f8fa1;
        font-weight:850;
        line-height:1.35;
      }

      .hha-practice-toast{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(14px);
        z-index:999999;
        width:min(92vw,560px);
        padding:12px 16px;
        border-radius:20px;
        background:rgba(21,48,74,.94);
        color:white;
        text-align:center;
        font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 42px rgba(0,0,0,.24);
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-practice-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      body.hha-practice-view-mobile .hha-practice-coach,
      body.hha-practice-view-cvr .hha-practice-coach{
        left:10px;
        right:10px;
        top:auto;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        width:auto;
        max-height:42vh;
        overflow:auto;
      }

      body.hha-practice-view-cvr .hha-practice-coach{
        opacity:.82;
        transform:scale(.92);
        transform-origin:bottom right;
      }

      body.hha-practice-view-mobile::before,
      body.hha-practice-view-cvr::before{
        top:calc(8px + env(safe-area-inset-top,0px));
        left:8px;
        font-size:10px;
        padding:6px 9px;
      }

      @media (max-width:720px){
        .hha-practice-map{
          grid-template-columns:1fr;
        }

        .hha-practice-row{
          padding:6px 7px;
        }

        .hha-practice-name{
          font-size:12px;
        }

        .hha-practice-desc{
          font-size:10px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  let toastBox = null;
  let toastTimer = null;

  function toast(message){
    addStyle();

    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'hha-practice-toast';
      document.body.appendChild(toastBox);
    }

    toastBox.textContent = String(message || '');
    toastBox.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      toastBox.classList.remove('show');
    }, 2100);

    try {
      window.dispatchEvent(new CustomEvent('hha:toast', {
        detail:{
          type:'info',
          message:String(message || '')
        }
      }));
    } catch(e) {}
  }

  function ensureCoach(){
    if (document.querySelector('.hha-practice-coach')) return;

    const coach = document.createElement('aside');
    coach.className = 'hha-practice-coach';
    coach.setAttribute('aria-label', 'Practice Coach');

    coach.innerHTML = `
      <div class="hha-practice-head">
        <div class="hha-practice-title">🧪 Practice Coach</div>
        <button class="hha-practice-toggle" type="button" aria-label="toggle practice coach">−</button>
      </div>

      <div class="hha-practice-body">
        <p class="hha-practice-tip" data-practice-tip>
          จำง่าย ๆ: เลือกอาหารก่อน แล้วส่งเข้าประตูหมู่ 1–5 ให้ถูก
        </p>

        <div class="hha-practice-map">
          ${GROUPS.map(function(g){
            return `
              <div class="hha-practice-row" data-practice-group="${g.no}">
                <div class="hha-practice-no">${g.no}</div>
                <div>
                  <div class="hha-practice-name">${g.emoji} ${g.name}</div>
                  <div class="hha-practice-desc">${g.desc}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(coach);

    const toggle = coach.querySelector('.hha-practice-toggle');

    if (toggle) {
      toggle.addEventListener('click', function(){
        state.coachOpen = !state.coachOpen;
        coach.classList.toggle('closed', !state.coachOpen);
        toggle.textContent = state.coachOpen ? '−' : '+';
      });
    }
  }

  function setTip(message, force){
    const now = Date.now();

    if (!force && now - state.lastTipAt < 1800) return;

    state.lastTipAt = now;
    state.tipCount += 1;

    const tip = document.querySelector('[data-practice-tip]');
    if (tip) tip.textContent = message;

    if (force) toast(message);
  }

  function findGroupFromText(txt){
    const t = String(txt || '').toLowerCase();

    const explicit = t.match(/หมู่\s*([1-5])|group\s*([1-5])|ประตู\s*([1-5])/i);
    if (explicit) {
      return Number(explicit[1] || explicit[2] || explicit[3]);
    }

    const keywords = [
      ['เนื้อ','นม','ไข่','ถั่ว','โปรตีน','protein','meat','egg','milk','bean'],
      ['ข้าว','แป้ง','เผือก','มัน','น้ำตาล','คาร์บ','carb','rice','bread','sugar'],
      ['ผัก','vegetable','veg','broccoli','carrot'],
      ['ผลไม้','fruit','apple','banana','orange'],
      ['ไขมัน','น้ำมัน','oil','fat','butter','avocado']
    ];

    for (let i = 0; i < keywords.length; i++) {
      if (keywords[i].some(function(k){ return t.includes(k); })) return i + 1;
    }

    return null;
  }

  function coachForElement(el){
    const txt = textOf(el);
    const no = findGroupFromText(txt);

    if (!no) return;

    const g = GROUPS[no - 1];

    if (!g) return;

    setTip(g.emoji + ' ' + g.name + ': ' + g.hint, false);
  }

  function patchIntro(){
    if (!isIntroVisible()) return;

    const all = Array.from(document.querySelectorAll('h1,h2,h3,p,div,span'));

    all.forEach(function(el){
      const txt = textOf(el);

      if (txt === 'Groups Solo Arena') {
        el.textContent = 'Groups Practice Arena';
      }

      if (txt.includes('แตะหรือ') && txt.includes('ส่งเข้าประตูหมู่')) {
        el.textContent = 'โหมดฝึก: ดูคำใบ้ แล้วส่งอาหารเข้าประตูหมู่ 1–5 ให้ถูกแบบไม่ต้องรีบ!';
      }
    });

    const root = findIntroRoot();

    if (root && !root.querySelector('.hha-practice-intro-badge')) {
      const badge = document.createElement('div');
      badge.className = 'hha-practice-intro-badge';
      badge.textContent = '🧪 Practice • ช้าลง • มีตัวช่วยจำหมู่';

      const h = root.querySelector('h1,h2,h3') || root.firstElementChild;

      if (h) h.insertAdjacentElement('afterend', badge);
      else root.prepend(badge);
    }

    addMiniChips(root);
  }

  function findIntroRoot(){
    const candidates = Array.from(document.querySelectorAll('main,section,article,div'))
      .map(function(el){
        const t = textOf(el);
        const r = el.getBoundingClientRect();

        return {
          el:el,
          text:t,
          area:r.width * r.height
        };
      })
      .filter(function(x){
        return (
          x.area > 20000 &&
          x.text.includes('เริ่มเล่น') &&
          (x.text.includes('Groups') || x.text.includes('แตะ'))
        );
      })
      .sort(function(a,b){
        return b.area - a.area;
      });

    return candidates.length ? candidates[0].el : null;
  }

  function addMiniChips(root){
    if (!root) return;
    if (root.querySelector('.hha-practice-mini')) return;

    const wrap = document.createElement('div');
    wrap.className = 'hha-practice-mini';

    GROUPS.forEach(function(g){
      const chip = document.createElement('div');
      chip.className = 'hha-practice-chip';
      chip.textContent = g.no + ' ' + g.emoji + ' ' + g.short;
      wrap.appendChild(chip);
    });

    const start = Array.from(root.querySelectorAll('button,a,[role="button"],.btn'))
      .find(function(el){
        const t = textOf(el);
        return t.includes('เริ่มเล่น') || t.includes('Start');
      });

    if (start && start.parentElement) {
      start.parentElement.insertAdjacentElement('beforebegin', wrap);
    } else {
      root.appendChild(wrap);
    }
  }

  function patchTargets(){
    if (isSummaryVisible()) return;

    const targets = Array.from(document.querySelectorAll(
      '[data-food],[data-target],[data-choice],[data-group],[data-gate],.food,.food-card,.foodItem,.target,.orb,.item,.gate,.group,.bucket,.answer,.choice,button'
    ));

    targets.forEach(function(el){
      if (!el || el.__hhaPracticeHintBound) return;

      el.__hhaPracticeHintBound = true;

      el.addEventListener('mouseenter', function(){
        coachForElement(el);
      }, true);

      el.addEventListener('focus', function(){
        coachForElement(el);
      }, true);

      el.addEventListener('touchstart', function(){
        coachForElement(el);
      }, { passive:true, capture:true });

      el.addEventListener('click', function(){
        state.practiceClicks += 1;
        coachForElement(el);
      }, true);
    });
  }

  function bindPracticeEvents(){
    if (window.__HHA_GROUPS_PRACTICE_EVENTS_BOUND__) return;
    window.__HHA_GROUPS_PRACTICE_EVENTS_BOUND__ = true;

    window.addEventListener('hha:judge', function(ev){
      const d = ev.detail || {};

      if (d.ok || d.correct || d.result === 'correct') {
        state.correct += 1;
        setTip('เยี่ยมมาก! ทำถูกแล้ว ลองจำเหตุผลของหมู่นี้ไว้ด้วยนะ', true);
        return;
      }

      if (d.wrong || d.miss || d.result === 'wrong' || d.result === 'miss') {
        state.miss += 1;
        setTip('ไม่เป็นไร โหมดฝึกให้ลองใหม่ได้ ดูตารางหมู่ 1–5 ทางขวา/ด้านล่างนะ', true);
      }
    }, true);

    window.addEventListener('hha:miss', function(){
      state.miss += 1;
      setTip('ค่อย ๆ เล็งใหม่ ดูว่าอาหารนี้เป็นโปรตีน แป้ง ผัก ผลไม้ หรือไขมัน', true);
    }, true);

    window.addEventListener('hha:score', function(ev){
      const d = ev.detail || {};
      if (d.correct || d.ok) {
        state.correct += 1;
      }
    }, true);

    document.addEventListener('keydown', function(ev){
      if (!/^[1-5]$/.test(ev.key)) return;

      const g = GROUPS[Number(ev.key) - 1];

      if (g) {
        setTip('ปุ่ม ' + g.no + ' = ' + g.emoji + ' ' + g.name + ' • ' + g.desc, true);
      }
    }, true);
  }

  function patchSummary(){
    if (!isSummaryVisible()) return;

    document.body.classList.add('hha-groups-summary-mode');

    const root = findSummaryRoot();

    if (!root) return;

    root.classList.add('hha-summary-root');

    const all = Array.from(root.querySelectorAll('h1,h2,h3,div,span,p'));

    all.forEach(function(el){
      const txt = textOf(el);

      if (txt === 'สรุปผลการเล่น') {
        el.textContent = 'สรุปผลการฝึก';
      }

      if (txt === 'Food Hero') {
        el.textContent = 'Practice Hero';
      }
    });

    if (!root.querySelector('.hha-practice-summary-box')) {
      const box = document.createElement('div');
      box.className = 'hha-practice-summary-box';

      box.innerHTML = `
        <h3>🧪 Practice Complete</h3>
        <p>
          รอบนี้เป็นโหมดฝึก เน้นจำหมู่อาหารให้แม่นก่อนเล่น Solo Arena / Challenge
        </p>
      `;

      const actions = Array.from(root.querySelectorAll('button,a,[role="button"],.btn'))
        .find(function(el){
          const t = textOf(el);
          return t.includes('เล่นอีกครั้ง') || t.includes('กลับ Nutrition');
        });

      if (actions && actions.parentElement) {
        actions.parentElement.insertAdjacentElement('beforebegin', box);
      } else {
        root.appendChild(box);
      }
    }
  }

  function findSummaryRoot(){
    const candidates = Array.from(document.querySelectorAll('main,section,article,div'))
      .map(function(el){
        const t = textOf(el);
        const r = el.getBoundingClientRect();

        return {
          el:el,
          text:t,
          area:r.width * r.height
        };
      })
      .filter(function(x){
        return (
          x.area > 10000 &&
          (
            x.text.includes('สรุปผลการเล่น') ||
            x.text.includes('Food Hero') ||
            x.text.includes('Practice Hero') ||
            x.text.includes('เล่นอีกครั้ง')
          )
        );
      })
      .sort(function(a,b){
        return b.area - a.area;
      });

    return candidates.length ? candidates[0].el : null;
  }

  function markPracticeMode(){
    document.body.classList.add('hha-groups-practice-mode');
    document.body.classList.add('hha-practice-view-' + state.view);

    document.documentElement.classList.add('hha-groups-practice-mode');

    document.body.dataset.hhaVariant = 'practice';
    document.body.dataset.hhaPractice = '1';
    document.body.dataset.hhaAssist = '1';
  }

  function patchDocumentTitle(){
    if (!document.title.includes('Practice')) {
      document.title = 'HeroHealth • Groups Practice';
    }
  }

  function scan(){
    markPracticeMode();
    patchDocumentTitle();
    ensureCoach();
    patchIntro();
    patchTargets();
    patchSummary();
  }

  function boot(){
    addStyle();
    markPracticeMode();
    ensureCoach();
    bindPracticeEvents();

    setTip('Practice Mode: จำหมู่ 1–5 ให้แม่นก่อน แล้วค่อยไป Solo Arena', true);

    scan();

    setTimeout(scan, 300);
    setTimeout(scan, 900);
    setTimeout(scan, 1600);
    setTimeout(scan, 3000);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_PRACTICE_SCAN_TIMER__);
      window.__HHA_GROUPS_PRACTICE_SCAN_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','href','aria-label','data-food','data-target','data-group','data-gate']
    });

    console.info('[HeroHealth Groups Practice]', PATCH_ID, 'ready', {
      view:state.view,
      query:Object.fromEntries(qs.entries())
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
